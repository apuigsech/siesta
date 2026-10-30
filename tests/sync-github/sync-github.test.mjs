import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const script = join(here, '../../skills/siesta-sync-github/scripts/sync-github.mjs');
const fakeGh = join(here, 'fake-gh.mjs');
const siestaDefaults = join(here, '../../skills/siesta/assets/defaults.yaml');

const CONFIG = `version: 1
# The shop, set up for Siesta.
git:
  integration_branch: main
  merge: { by: pm }
roles:
  reviewer: { harness: codex, model: default }
autonomy:
  waits_for_human:
    - decision
    - "merging anything that touches payments"
  standing_approvals:
    - id: delete-own-previews
      allows: Delete the previews of the epic's own branch
      granted: 2026-10-30
addons:
  sync-github:
    repo: acme/shop   # the repository the issues live in
`;

const ROADMAP = `---
id: 20261030-open-the-shop
title: Open the shop
status: active
---

# Open the shop

The shop opens to the public.

## Phase 1 — The shop runs in a preview

**Status:** accepted on 2026-10-30 by the owner: "Sí".

Completion criteria:

- [ ] The checks pass.

## Phase 2 — Customers return garments

**Status:** proposed

Completion criteria:

- [ ] Returns work.
`;

const spec = ({ id, title, kind = 'epic', status, phase, feature }) => `---
id: ${id}
title: ${title}
kind: ${kind}
status: ${status}
roadmap: 20261030-open-the-shop
phase: ${phase}
depends_on: []
waits_for: [OQ-02]
touches: [orders, payments]
${feature ? `feature: ${feature}\n` : ''}---

# ${title}

What is true when it is done.
`;

const FILES = {
  '.siesta/config.yaml': CONFIG,
  '.siesta/roadmaps/20261030-open-the-shop.md': ROADMAP,
  '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass', status: 'planned', phase: 1 }),
  '.siesta/epics/20261030-carrier-events/spec.md': spec({ id: '20261030-carrier-events', title: 'When the carrier events arrive', kind: 'spike', status: 'planned', phase: 1 }),
  '.siesta/epics/20261030-returns/spec.md': spec({ id: '20261030-returns', title: 'Returns', status: 'proposed', phase: 2, feature: 'order-cancellations-and-returns' }),
  'docs/features/order-cancellations-and-returns.md': '# Order cancellations and returns\n\nA customer cancels or returns.\n',
};

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const gitEnv = ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false'];

function writeFiles(dir, files) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
}

function commitAndPush(dir, message, branch = 'main') {
  git(dir, 'add', '-A');
  git(dir, ...gitEnv, 'commit', '-qm', message);
  git(dir, 'push', '-q', 'origin', branch);
}

function setup(files = FILES) {
  const root = mkdtempSync(join(tmpdir(), 'siesta-sync-'));
  const origin = join(root, 'origin.git');
  const dir = join(root, 'work');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  execFileSync('git', ['clone', '-q', origin, dir], { stdio: 'ignore' });
  git(dir, 'checkout', '-q', '-b', 'main');
  writeFiles(dir, files);
  commitAndPush(dir, 'plan');
  const statePath = join(root, 'github.json');
  const run = (...args) => {
    const result = spawnSync(process.execPath, [script, ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: { ...process.env, SIESTA_GH: fakeGh, FAKE_GH_STATE: statePath },
    });
    return { code: result.status, out: result.stdout, err: result.stderr };
  };
  const github = () => (existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null);
  return { dir, run, github };
}

const issueFor = (github, id) => github.issues.find((i) => i.body.includes(`<!-- siesta-id: ${id} -->`));
const labelsOf = (issue) => [...issue.labels].sort();

test('check reports every item missing from an empty GitHub', () => {
  const { run } = setup();
  const { code, out } = run('check');
  assert.equal(code, 1);
  for (const id of ['20261030-open-the-shop', '20261030-open-the-shop/phase-1', '20261030-open-the-shop/phase-2', '20261030-checks-pass', '20261030-carrier-events', '20261030-returns', 'feature/order-cancellations-and-returns']) {
    assert.match(out, new RegExp(`missing.*${id.replace('/', '\\/')}`), `check names ${id} as missing`);
  }
});

test('publish creates the roadmap, its phases, epics, spikes and features, and check then passes', () => {
  const { run, github } = setup();
  assert.equal(run('publish').code, 0);
  const gh = github();

  const roadmap = issueFor(gh, '20261030-open-the-shop');
  assert.equal(roadmap.title, 'Open the shop [20261030-open-the-shop]');
  assert.deepEqual(labelsOf(roadmap), ['siesta', 'siesta:roadmap', 'status:active']);

  const phase1 = gh.milestones.find((m) => m.description.includes('<!-- siesta-id: 20261030-open-the-shop/phase-1 -->'));
  assert.equal(phase1.title, 'Open the shop: The shop runs in a preview');
  assert.equal(phase1.state, 'open');

  const epic = issueFor(gh, '20261030-checks-pass');
  assert.equal(epic.title, 'The checks pass [20261030-checks-pass]');
  assert.deepEqual(labelsOf(epic), ['siesta', 'siesta:epic', 'status:planned']);
  assert.equal(epic.milestone, phase1.number);
  assert.equal(gh.parents[epic.number], roadmap.number, 'an epic is a sub-issue of its roadmap');
  assert.match(epic.body, /\.siesta\/epics\/20261030-checks-pass\/spec\.md/);

  const spike = issueFor(gh, '20261030-carrier-events');
  assert.deepEqual(labelsOf(spike), ['siesta', 'siesta:spike', 'status:planned']);

  const feature = issueFor(gh, 'feature/order-cancellations-and-returns');
  assert.equal(feature.title, 'Order cancellations and returns [feature/order-cancellations-and-returns]');
  assert.deepEqual(labelsOf(feature), ['siesta', 'siesta:feature']);
  assert.equal(gh.parents[feature.number], undefined, 'a feature is not a sub-issue');
  const returns = issueFor(gh, '20261030-returns');
  assert.match(returns.body, new RegExp(`Feature: #${feature.number}\\b`), 'an epic links its feature');
  assert.match(feature.body, new RegExp(`#${returns.number}\\b`), 'a feature lists its epics');

  const { code, out } = run('check');
  assert.equal(code, 0, out);
});

test('publish is idempotent', () => {
  const { run, github } = setup();
  run('publish');
  const writes = github().writes.length;
  assert.equal(run('publish').code, 0);
  assert.equal(github().writes.length, writes, 'a second publish writes nothing');
});

test('publish --dry-run lists the changes and writes nothing', () => {
  const { run, github } = setup();
  const { code, out } = run('publish', '--dry-run');
  assert.equal(code, 0);
  assert.match(out, /create issue.*20261030-checks-pass/);
  assert.equal(github()?.writes.length ?? 0, 0);
});

test('publish reads the integration branch, not the working tree', () => {
  const { dir, run, github } = setup();
  writeFiles(dir, { '.siesta/epics/20261030-unmerged/spec.md': spec({ id: '20261030-unmerged', title: 'Not merged yet', status: 'proposed', phase: 2 }) });
  run('publish');
  assert.equal(issueFor(github(), '20261030-unmerged'), undefined);
});

test('publish leaves an existing issue status alone, and check reports the difference', () => {
  const { dir, run, github } = setup();
  run('publish');
  writeFiles(dir, { '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass', status: 'completed', phase: 1 }) });
  commitAndPush(dir, 'complete the checks');
  run('publish');
  const epic = issueFor(github(), '20261030-checks-pass');
  assert.ok(epic.labels.includes('status:planned'), 'publish does not change a status');
  assert.equal(epic.state, 'open');
  const { code, out } = run('check');
  assert.equal(code, 1);
  assert.match(out, /status.*20261030-checks-pass.*planned.*completed/);
});

test('status applies the record, closing a completed epic as completed and a cancelled one as not planned', () => {
  const { dir, run, github } = setup();
  run('publish');
  writeFiles(dir, {
    '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass', status: 'completed', phase: 1 }),
    '.siesta/epics/20261030-carrier-events/spec.md': spec({ id: '20261030-carrier-events', title: 'When the carrier events arrive', kind: 'spike', status: 'cancelled', phase: 1 }),
  });
  commitAndPush(dir, 'statuses');
  assert.equal(run('status', '20261030-checks-pass', '20261030-carrier-events').code, 0);
  const gh = github();
  const done = issueFor(gh, '20261030-checks-pass');
  assert.deepEqual(labelsOf(done), ['siesta', 'siesta:epic', 'status:completed']);
  assert.equal(done.state, 'closed');
  assert.equal(done.state_reason, 'completed');
  const dropped = issueFor(gh, '20261030-carrier-events');
  assert.equal(dropped.state, 'closed');
  assert.equal(dropped.state_reason, 'not_planned');
});

test('a feature closes once every epic that builds it is completed or cancelled', () => {
  const { dir, run, github } = setup();
  run('publish');
  writeFiles(dir, { '.siesta/epics/20261030-returns/spec.md': spec({ id: '20261030-returns', title: 'Returns', status: 'completed', phase: 2, feature: 'order-cancellations-and-returns' }) });
  commitAndPush(dir, 'returns done');
  run('status', '20261030-returns');
  run('publish');
  assert.equal(issueFor(github(), 'feature/order-cancellations-and-returns').state, 'closed');
});

test('a phase milestone closes when the roadmap marks the phase completed', () => {
  const { dir, run, github } = setup();
  run('publish');
  writeFiles(dir, { '.siesta/roadmaps/20261030-open-the-shop.md': ROADMAP.replace('**Status:** accepted on 2026-10-30 by the owner: "Sí".', '**Status:** completed on 2026-11-20.') });
  commitAndPush(dir, 'phase 1 done');
  run('publish');
  const phase1 = github().milestones.find((m) => m.description.includes('phase-1 -->'));
  assert.equal(phase1.state, 'closed');
});

test('publish follows a renamed epic by its id', () => {
  const { dir, run, github } = setup();
  run('publish');
  writeFiles(dir, { '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass in CI', status: 'planned', phase: 1 }) });
  commitAndPush(dir, 'rename');
  run('publish');
  assert.equal(issueFor(github(), '20261030-checks-pass').title, 'The checks pass in CI [20261030-checks-pass]');
});

test('an issue whose id is no longer in the record is reported, never deleted or closed', () => {
  const { dir, run, github } = setup();
  run('publish');
  git(dir, 'rm', '-q', '-r', '.siesta/epics/20261030-carrier-events');
  commitAndPush(dir, 'drop the spike');
  run('publish');
  const orphan = issueFor(github(), '20261030-carrier-events');
  assert.equal(orphan.state, 'open');
  const { code, out } = run('check');
  assert.equal(code, 1);
  assert.match(out, /not in the record.*20261030-carrier-events/);
});

test('start marks a planned epic active once its branch is on the remote', () => {
  const { dir, run, github } = setup();
  run('publish');
  assert.equal(run('start', '20261030-checks-pass').code, 2, 'no branch yet: refused');
  git(dir, 'checkout', '-q', '-b', 'chore/checks-pass');
  writeFiles(dir, { '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass', status: 'active', phase: 1 }) });
  commitAndPush(dir, 'start the checks', 'chore/checks-pass');
  assert.equal(run('start', '20261030-checks-pass').code, 0);
  assert.ok(issueFor(github(), '20261030-checks-pass').labels.includes('status:active'));
  const { code, out } = run('check');
  assert.equal(code, 0, `an active issue for an epic planned on the integration branch is in step: ${out}`);
});

test('start refuses an epic that is not planned on the integration branch', () => {
  const { run } = setup();
  run('publish');
  const { code, err } = run('start', '20261030-returns');
  assert.equal(code, 2);
  assert.match(err, /planned/);
});

test('issue prints the issue number of an id', () => {
  const { run, github } = setup();
  run('publish');
  const { code, out } = run('issue', '20261030-checks-pass');
  assert.equal(code, 0);
  assert.equal(out.trim(), String(issueFor(github(), '20261030-checks-pass').number));
});

test('the script reads the same defaults as the siesta skill', async () => {
  const { DEFAULTS, parseYaml } = await import(script);
  const defaults = parseYaml(readFileSync(siestaDefaults, 'utf8'));
  for (const key of ['roadmaps', 'epics', 'feature']) assert.equal(DEFAULTS.paths[key], defaults.paths[key], `paths.${key}`);
  assert.equal(DEFAULTS.git.integration_branch, defaults.git.integration_branch);
});

test('parseYaml reads flow maps, block lists, lists of maps, quotes and comments', async () => {
  const { parseYaml } = await import(script);
  const config = parseYaml(CONFIG);
  assert.deepEqual(config.git, { integration_branch: 'main', merge: { by: 'pm' } });
  assert.deepEqual(config.roles.reviewer, { harness: 'codex', model: 'default' });
  assert.deepEqual(config.autonomy.waits_for_human, ['decision', 'merging anything that touches payments']);
  assert.equal(config.autonomy.standing_approvals[0].allows, "Delete the previews of the epic's own branch");
  assert.equal(config.addons['sync-github'].repo, 'acme/shop');
  assert.deepEqual(parseYaml('a: []\nb: [x, "y, z"]\nc: null\nd: 3\n'), { a: [], b: ['x', 'y, z'], c: null, d: 3 });
});
