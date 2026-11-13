import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { readStatus, countChecks, parseCheckpoint, parsePhases, parseWorkers } from '../../skills/siesta-status/scripts/read-status.mjs';

const roadmap = (id = 'base') => `---\nid: ${id}\ntitle: ${id}\nstatus: accepted\n---\n# ${id}\n## Phase — Foundation\n\n**Slug:** foundation\n\n**Status:** accepted\n\nCompletion criteria:\n- [ ] Works\n`;
const spec = (id, status = 'planned', extra = '', road = 'base') => `---\nid: ${id}\ntitle: ${id}\nroadmap: ${road}\nphase: foundation\nstatus: ${status}\ndepends_on: []\nwaits_for: []\n${extra}\n---\n# ${id}\n## Acceptance criteria\n- [x] First\n- [ ] Second\n## Other\n- [x] Not a criterion\n`;
function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'siesta-status-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, 'repo');
  const home = join(base, 'home');
  const notes = join(base, 'notes');
  mkdirSync(root); mkdirSync(home); mkdirSync(notes);
  const gitEnv = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com' };
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'commit.gpgsign=false', ...args], { env: gitEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = (path, text) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); };
  const file = (path, text) => put(join(root, path), text);
  const commit = (date = '2026-11-10T10:00:00Z') => {
    git('add', '.');
    execFileSync('git', ['-C', root, '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture'], { env: { ...gitEnv, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date } });
  };
  git('init', '-q', '-b', 'main');
  git('remote', 'add', 'origin', 'https://example.com/team/project.git');
  file('.siesta/config.yaml', `version: 1\ngit:\n  integration_branch: main\npaths:\n  notes: ${notes}\n`);
  file('.siesta/roadmaps/base.md', roadmap());
  const read = (at = root) => readStatus({ root: at, home, env: {}, now: new Date('2026-11-12T12:00:00Z') });
  return { base, root, home, notes, git, put, file, commit, read };
}

test('delivered counts integration only, excludes cancelled, and reads unpublished worker tasks', t => {
  const f = fixture(t);
  f.file('.siesta/epics/done/spec.md', spec('done', 'completed'));
  f.file('.siesta/epics/cancelled/spec.md', spec('cancelled', 'cancelled'));
  f.file('.siesta/epics/search/spec.md', spec('search', 'active', 'type: feat\nblocked: { since: 2026-11-10, reason: Access }'));
  f.commit();
  f.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  const worker = join(f.base, 'worker');
  f.git('worktree', 'add', '-qb', 'feat/search', worker);
  f.put(join(worker, '.siesta/epics/search/spec.md'), spec('search', 'completed', 'blocked: null'));
  f.put(join(worker, '.siesta/epics/search/plan.md'), '- [x] Build\n- [x] Test\n- [ ] Review\n');
  const status = f.read();
  assert.equal(status.roadmaps[0].completed, 1);
  assert.equal(status.roadmaps[0].total, 2);
  assert.equal(status.roadmaps[0].active[0].statusOnBranch, 'completed');
  assert.equal(status.roadmaps[0].active[0].blocked, null);
  assert.deepEqual(status.roadmaps[0].active[0].tasks, { done: 2, total: 3 });
  assert.deepEqual(status.roadmaps[0].active[0].criteria, { done: 1, total: 2 });
  assert.equal(status.capacity.used, 1);
  assert.match(status.roadmaps[0].active[0].readFrom, /^worktree:/);
});

test('configuration layers merge maps, reject unsupported versions, and keep the checkpoint in the main checkout', t => {
  const f = fixture(t);
  f.put(join(f.home, '.config/siesta/config.yaml'), 'project:\n  language: { human: es }\nexecution:\n  max_parallel_epics: 4\nautonomy:\n  never: []\n');
  f.file('.siesta/config.local.yaml', 'status: { progress: mixed }\nexecution: { max_parallel_epics: 3 }\n');
  f.file('.siesta/checkpoint.md', '**Q-1 - Pick.** Options\n');
  f.commit();
  const worker = join(f.base, 'worker');
  f.git('worktree', 'add', '-qb', 'feat/work', worker);
  f.put(join(worker, '.siesta/checkpoint.md'), '**Q-2 - Wrong checkout.**\n');
  const status = f.read(worker);
  assert.equal(status.language, 'es');
  assert.equal(status.progress, 'mixed');
  assert.equal(status.capacity.max, 3);
  assert.equal(status.checkpoint.questions[0].id, 'Q-1');
  assert.match(status.warnings.join('\n'), /Ignored autonomy/);
  f.file('.siesta/config.local.yaml', 'version: 2\n');
  assert.throws(() => f.read(), /Unsupported Siesta version/);
});

test('ready work requires accepted phase, merged dependencies, no waits and no blocker', t => {
  const f = fixture(t);
  f.file('.siesta/epics/done/spec.md', spec('done', 'completed'));
  f.file('.siesta/epics/ready/spec.md', spec('ready', 'planned', 'depends_on: [done]'));
  f.file('.siesta/epics/waits/spec.md', spec('waits', 'planned', 'waits_for: [Q-1]'));
  f.file('.siesta/epics/dependency/spec.md', spec('dependency', 'planned', 'depends_on: [missing]'));
  f.file('.siesta/epics/blocked/spec.md', spec('blocked', 'planned', 'blocked: { since: 2026-11-11, reason: Access }'));
  f.file('.siesta/roadmaps/later.md', roadmap('later').replace('**Status:** accepted', '**Status:** proposed'));
  f.file('.siesta/epics/later/spec.md', spec('later', 'planned', '', 'later'));
  f.commit();
  const status = f.read();
  assert.deepEqual(status.roadmaps[0].ready.map(epic => epic.id), ['ready']);
  assert.deepEqual(status.roadmaps[1].ready, []);
  assert.equal(status.roadmaps[0].phases[0].status, 'accepted');
});

test('paused assignments occupy capacity across roadmaps and the PM record selects resumed branches', t => {
  const f = fixture(t);
  f.file('.siesta/epics/search/spec.md', spec('search', 'planned'));
  f.file('.siesta/roadmaps/second.md', roadmap('second'));
  f.file('.siesta/epics/second/spec.md', spec('second', 'active', '', 'second'));
  f.commit();
  f.git('branch', 'feat/search');
  const worker = join(f.base, 'worker');
  f.git('worktree', 'add', '-qb', 'feat/search-2', worker);
  f.put(join(worker, '.siesta/epics/search/spec.md'), spec('search', 'active'));
  f.put(join(f.notes, 'pm-base.md'), '# PM\n## Workers\n| Epic | Session | Worktree and branch | Brief | Pull request | Stage | Since |\n|---|---|---|---|---|---|---|\n| search | Worker | `/tmp/worker`, `feat/search-2` | brief | — | Paused: Q-1 | 2026-11-11 |\n');
  const status = f.read();
  assert.equal(status.capacity.used, 2);
  assert.equal(status.roadmaps[0].active[0].branch, 'feat/search-2');
  assert.equal(status.roadmaps[0].active[0].stage, 'Paused: Q-1');
  assert.equal(status.roadmaps[0].ready.length, 0);
});

test('ambiguous branches and missing checkpoint are unknown, not fabricated progress or zero questions', t => {
  const f = fixture(t);
  f.file('.siesta/epics/search/spec.md', spec('search', 'active', 'type: feat'));
  f.commit();
  f.git('branch', 'feat/search'); f.git('branch', 'feat/search-2');
  const status = f.read();
  assert.equal(status.checkpoint.available, false);
  assert.equal(status.roadmaps[0].active[0].statusOnBranch, null);
  assert.match(status.warnings.join('\n'), /Ambiguous worker branch/);
});

test('delivery since the saved status compares integration history', t => {
  const f = fixture(t);
  f.file('.siesta/epics/search/spec.md', spec('search', 'active'));
  f.file('.siesta/epics/old/spec.md', spec('old', 'completed'));
  f.commit('2026-11-09T10:00:00Z');
  f.put(join(f.notes, 'status-20261110-1200.md'), '# Status\n');
  f.file('.siesta/epics/search/spec.md', spec('search', 'completed'));
  f.commit('2026-11-11T10:00:00Z');
  const status = f.read();
  assert.deepEqual(status.roadmaps[0].delivered.map(epic => epic.id), ['search']);
  assert.match(status.baseline.path, /status-20261110-1200.md$/);
});

test('parser ignores code examples, deduplicates item definitions and preserves checkpoint order', () => {
  assert.deepEqual(countChecks('- [x] Real\n```md\n- [ ] Example\n```\n- [ ] Real'), { done: 1, total: 2 });
  const items = parseCheckpoint('Reference Q-99\n**Q-7 — Question.** Context\nWaits for it: search\n**H-2 - Hypothesis.** Why\n```md\n**Q-8 - Example.**\n```\n**Q-7 - Duplicate.**\n');
  assert.deepEqual(items.map(item => item.id), ['Q-7', 'H-2']);
  assert.match(items[0].detail, /Waits for it: search/);
  assert.equal(parsePhases(roadmap().replace('Phase —', 'Phase 1 —'))[0].slug, 'foundation');
  assert.equal(parsePhases(roadmap().replace('**Status:** accepted', ''))[0].status, null);
  assert.deepEqual(parseWorkers('## Workers\n| search | too | few |\n'), []);
});

test('absent setup and records outside Git fail explicitly; reading never changes repository files', t => {
  const f = fixture(t);
  f.commit();
  const before = f.git('status', '--porcelain');
  const head = f.git('rev-parse', 'HEAD');
  f.read();
  assert.equal(f.git('status', '--porcelain'), before);
  assert.equal(f.git('rev-parse', 'HEAD'), head);
  f.file('.siesta/config.local.yaml', 'paths: { epics: /outside/repository }\n');
  assert.throws(() => f.read(), /Integration records must be inside/);
  rmSync(join(f.root, '.siesta/config.yaml'));
  assert.throws(() => f.read(), /not set up/);
});
