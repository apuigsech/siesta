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

**Slug:** preview

**Status:** accepted on 2026-10-30 by the owner: "Sí".

Completion criteria:

- [ ] The checks pass.

## Phase 2 — Customers return garments

**Slug:** returns

**Status:** proposed

Completion criteria:

- [ ] Returns work.
`;

const spec = ({ id, title, kind = 'epic', status, phase, feature, extra = '' }) => `---
id: ${id}
title: ${title}
kind: ${kind}
status: ${status}
roadmap: 20261030-open-the-shop
phase: ${phase}
depends_on: []
waits_for: [OQ-02]
touches: [orders, payments]
${feature ? `feature: ${feature}\n` : ''}${extra}---

# ${title}

What is true when it is done.
`;

const FILES = {
  '.siesta/config.yaml': CONFIG,
  '.siesta/roadmaps/20261030-open-the-shop.md': ROADMAP,
  '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass', status: 'planned', phase: 'preview' }),
  '.siesta/epics/20261030-carrier-events/spec.md': spec({ id: '20261030-carrier-events', title: 'When the carrier events arrive', kind: 'spike', status: 'planned', phase: 'preview' }),
  '.siesta/epics/20261030-returns/spec.md': spec({ id: '20261030-returns', title: 'Returns', status: 'proposed', phase: 'returns', feature: 'order-cancellations-and-returns' }),
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
  return { dir, run, github, statePath };
}

const issueFor = (github, id) => github.issues.find((i) => i.body.includes(`<!-- siesta-id: ${id} -->`));
const labelsOf = (issue) => [...issue.labels].sort();

test('check reports every item missing from an empty GitHub', () => {
  const { run } = setup();
  const { code, out } = run('check');
  assert.equal(code, 1);
  for (const id of ['20261030-open-the-shop', '20261030-open-the-shop/preview', '20261030-open-the-shop/returns', '20261030-checks-pass', '20261030-carrier-events', '20261030-returns', 'feature/order-cancellations-and-returns']) {
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

  const phase1 = gh.milestones.find((m) => m.description.includes('<!-- siesta-id: 20261030-open-the-shop/preview -->'));
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
  writeFiles(dir, { '.siesta/epics/20261030-unmerged/spec.md': spec({ id: '20261030-unmerged', title: 'Not merged yet', status: 'proposed', phase: 'returns' }) });
  run('publish');
  assert.equal(issueFor(github(), '20261030-unmerged'), undefined);
});

test('publish leaves an existing issue status alone, and check reports the difference', () => {
  const { dir, run, github } = setup();
  run('publish');
  writeFiles(dir, { '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass', status: 'completed', phase: 'preview' }) });
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
    '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass', status: 'completed', phase: 'preview' }),
    '.siesta/epics/20261030-carrier-events/spec.md': spec({ id: '20261030-carrier-events', title: 'When the carrier events arrive', kind: 'spike', status: 'cancelled', phase: 'preview' }),
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
  writeFiles(dir, { '.siesta/epics/20261030-returns/spec.md': spec({ id: '20261030-returns', title: 'Returns', status: 'completed', phase: 'returns', feature: 'order-cancellations-and-returns' }) });
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
  const phase1 = github().milestones.find((m) => m.description.includes('open-the-shop/preview -->'));
  assert.equal(phase1.state, 'closed');
});

test('a phase keeps its milestone when it is renumbered and retitled, because its slug does not change', () => {
  const { dir, run, github } = setup();
  run('publish');
  const before = github().milestones.find((m) => m.description.includes('open-the-shop/returns -->'));
  writeFiles(dir, { '.siesta/roadmaps/20261030-open-the-shop.md': ROADMAP.replace('## Phase 2 — Customers return garments', '## Phase 3 — Customers return what they bought') });
  commitAndPush(dir, 'renumber');
  run('publish');
  const milestones = github().milestones.filter((m) => m.description.includes('open-the-shop/returns -->'));
  assert.equal(milestones.length, 1);
  assert.equal(milestones[0].number, before.number);
  assert.equal(milestones[0].title, 'Open the shop: Customers return what they bought');
  assert.equal(issueFor(github(), '20261030-returns').milestone, before.number);
});

test('check reports a phase with no slug and an epic naming a slug its roadmap lacks', () => {
  const { dir, run } = setup();
  writeFiles(dir, {
    '.siesta/roadmaps/20261030-open-the-shop.md': ROADMAP.replace('**Slug:** returns\n\n', ''),
    '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass', status: 'planned', phase: 'nowhere' }),
  });
  commitAndPush(dir, 'break the phases');
  const { code, out } = run('check');
  assert.equal(code, 1);
  assert.match(out, /problem.*phase 2 of 20261030-open-the-shop has no slug/);
  assert.match(out, /problem.*20261030-checks-pass names the phase nowhere/);
});

test('publish follows a renamed epic by its id', () => {
  const { dir, run, github } = setup();
  run('publish');
  writeFiles(dir, { '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass in CI', status: 'planned', phase: 'preview' }) });
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
  writeFiles(dir, { '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass', status: 'active', phase: 'preview' }) });
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

const CHECKS_ID = '20261030-checks-pass';
const CHECKS_PATH = `.siesta/epics/${CHECKS_ID}/spec.md`;
const checksSpec = (status, extra = '') => spec({ id: CHECKS_ID, title: 'The checks pass', status, phase: 'preview', extra });

test('delivery links preserve legacy and multiple PRs, and only completed work says delivered', () => {
  const extra = 'delivery:\n  url: https://github.com/acme/shop/pull/27\n  urls: [https://github.com/acme/shop/pull/28, https://github.com/acme/other/pull/3]\n';
  const { dir, run, github } = setup({ ...FILES, [CHECKS_PATH]: checksSpec('active', extra) });
  assert.equal(run('publish').code, 0);
  let body = issueFor(github(), CHECKS_ID).body;
  assert.match(body, /Delivery PRs:/);
  assert.doesNotMatch(body, /Delivered by/);
  for (const label of ['#27', '#28', 'acme/other#3']) assert.ok(body.includes(`[${label}]`));
  writeFiles(dir, { [CHECKS_PATH]: checksSpec('completed', extra) });
  commitAndPush(dir, 'deliver');
  assert.equal(run('publish').code, 0);
  assert.match(issueFor(github(), CHECKS_ID).body, /Delivered by:/);
  assert.equal(run('status', CHECKS_ID).code, 0);
  assert.equal(run('check').code, 0);
});

test('blocked metadata preserves lifecycle, prevents start, and clears independently', () => {
  const extra = 'blocked: { since: 2026-11-11, reason: Waiting for access }\ntype: test\n';
  const { dir, run, github } = setup({ ...FILES, [CHECKS_PATH]: checksSpec('planned', extra) });
  assert.equal(run('publish').code, 0);
  let issue = issueFor(github(), CHECKS_ID);
  assert.ok(issue.labels.includes('status:planned'));
  assert.ok(issue.labels.includes('siesta:blocked'));
  assert.match(issue.body, /Blocked since 2026-11-11: Waiting for access/);
  assert.equal(run('start', CHECKS_ID).code, 2);
  assert.equal(run('check').code, 0);
  writeFiles(dir, { [CHECKS_PATH]: checksSpec('planned', 'blocked: null\ntype: test\n') });
  commitAndPush(dir, 'access available');
  assert.match(run('check').out, /blocker label differs/);
  assert.equal(run('publish').code, 0);
  issue = issueFor(github(), CHECKS_ID);
  assert.ok(issue.labels.includes('status:planned'));
  assert.ok(!issue.labels.includes('siesta:blocked'));
  assert.doesNotMatch(issue.body, /Blocked since/);
  assert.equal(run('check').code, 0);
});

test('legacy blocked status is preserved with an advisory migration warning', () => {
  const { run, github } = setup({ ...FILES, [CHECKS_PATH]: checksSpec('blocked') });
  assert.equal(run('publish').code, 0);
  const result = run('check', '--json');
  assert.equal(result.code, 0);
  const data = JSON.parse(result.out);
  assert.ok(data.warnings.some((x) => x.includes('legacy status: blocked')));
  assert.ok(issueFor(github(), CHECKS_ID).labels.includes('status:blocked'));
  assert.equal(run('start', CHECKS_ID).code, 2);
});

test('unnumbered phases preserve milestones and accept closure evidence', () => {
  const { dir, run, github } = setup();
  run('publish');
  const before = github().milestones.map((m) => m.number);
  writeFiles(dir, { '.siesta/roadmaps/20261030-open-the-shop.md': ROADMAP
    .replace('## Phase 1 —', '## Phase —')
    .replace('## Phase 2 —', '## Phase —')
    .replace('**Status:** accepted on 2026-10-30 by the owner: "Sí".', '**Status:** Completed on 2026-11-11: criteria verified on main at abc123.') });
  commitAndPush(dir, 'unnumbered phases');
  assert.equal(run('publish').code, 0);
  assert.deepEqual(github().milestones.map((m) => m.number), before);
  assert.equal(github().milestones[0].state, 'closed');
  assert.equal(run('check').code, 0);
});

test('live slug collisions block writes, while completed historical slugs may be reused', () => {
  const otherPath = '.siesta/epics/20261111-checks-pass/spec.md';
  const other = spec({ id: '20261111-checks-pass', title: 'More checks', status: 'planned', phase: 'preview' });
  const { dir, run, github } = setup({ ...FILES, [otherPath]: other });
  assert.match(run('check').out, /share the live slug checks-pass/);
  assert.equal(run('publish').code, 2);
  assert.equal(github()?.writes.length ?? 0, 0);
  assert.equal(run('start', CHECKS_ID).code, 2);
  writeFiles(dir, { [CHECKS_PATH]: checksSpec('completed') });
  commitAndPush(dir, 'old epic done');
  assert.equal(run('publish').code, 0);
  assert.equal(run('check').code, 0);
});

test('custom slugs are checked across epics and spikes irrespective of commit type', () => {
  const custom = spec({ id: 'custom-id', title: 'Custom', kind: 'spike', status: 'planned', phase: 'preview', extra: 'slug: checks-pass\ntype: docs\n' });
  const { run } = setup({ ...FILES, '.siesta/epics/custom-id/spec.md': custom });
  assert.match(run('check').out, /share the live slug checks-pass/);
  assert.equal(run('publish').code, 2);
});

test('malformed metadata is reported before any write', () => {
  const { run, github } = setup({ ...FILES, [CHECKS_PATH]: checksSpec('completed', 'blocked: { since: yesterday, reason: 42 }\ntype: "../bad"\ndelivery:\n  urls: ["javascript:bad"]\n') });
  const result = run('check');
  assert.equal(result.code, 1);
  assert.match(result.out, /blocked must/);
  assert.match(result.out, /invalid commit type/);
  assert.match(result.out, /invalid delivery URL/);
  assert.equal(run('publish').code, 2);
  assert.equal(run('status', CHECKS_ID).code, 2);
  assert.equal(github()?.writes.length ?? 0, 0);
});

test('branch observations are advisory, read-only and survive branch progress to completed', () => {
  const { dir, run, github } = setup();
  run('publish');
  git(dir, 'checkout', '-q', '-b', 'chore/checks-pass');
  writeFiles(dir, { [CHECKS_PATH]: checksSpec('active') });
  commitAndPush(dir, 'started', 'chore/checks-pass');
  assert.equal(run('start', CHECKS_ID).code, 0);
  writeFiles(dir, { [CHECKS_PATH]: checksSpec('completed') });
  commitAndPush(dir, 'ready for review', 'chore/checks-pass');
  let result = run('check', '--json');
  assert.equal(result.code, 0);
  let data = JSON.parse(result.out);
  assert.equal(data.warnings.length, 0);
  assert.ok(data.pending.some((x) => x.id === CHECKS_ID && x.status === 'completed'));
  assert.ok(issueFor(github(), CHECKS_ID).labels.includes('status:active'));
  git(dir, 'checkout', '-q', 'main');
  git(dir, 'push', '-q', 'origin', '--delete', 'chore/checks-pass');
  const writes = github().writes.length;
  result = run('check', '--json');
  assert.equal(result.code, 0, result.err);
  data = JSON.parse(result.out);
  assert.ok(data.warnings.some((x) => x.includes('no published worker branch')));
  assert.equal(data.pending.length, 0);
  assert.equal(github().writes.length, writes);
  writeFiles(dir, { [CHECKS_PATH]: checksSpec('completed') });
  commitAndPush(dir, 'delivered');
  data = JSON.parse(run('check', '--json').out);
  assert.equal(data.warnings.length, 0, 'a merged final PR may have its branch deleted before sync');
});

test('a completed epic cannot retain a blocker, and explicit slugs support custom IDs', () => {
  const { dir, run, github } = setup({ ...FILES, [CHECKS_PATH]: checksSpec('completed', 'blocked: { since: 2026-11-11, reason: Still waiting }\n') });
  assert.match(run('check').out, /completed but still has a blocker/);
  assert.equal(run('publish').code, 2);
  assert.equal(github()?.writes.length ?? 0, 0);
  writeFiles(dir, { [CHECKS_PATH]: spec({ id: 'OPS_42', title: 'Operations', status: 'planned', phase: 'preview', extra: 'slug: operations\ntype: chore\n' }) });
  commitAndPush(dir, 'custom identity');
  assert.equal(run('publish').code, 0);
  assert.equal(run('check').code, 0);
});

test('malformed unmerged branch metadata produces warnings without failing the mirror check', () => {
  const { dir, run, github } = setup();
  run('publish');
  git(dir, 'checkout', '-q', '-b', 'test/checks-pass');
  writeFiles(dir, { [CHECKS_PATH]: checksSpec('active') });
  commitAndPush(dir, 'start', 'test/checks-pass');
  assert.equal(run('start', CHECKS_ID).code, 0);
  writeFiles(dir, { [CHECKS_PATH]: '---\nid: 20261030-checks-pass\nnot yaml\n---\n' });
  commitAndPush(dir, 'invalid unmerged metadata', 'test/checks-pass');
  const writes = github().writes.length;
  const result = run('check', '--json');
  assert.equal(result.code, 0, result.err);
  assert.ok(JSON.parse(result.out).warnings.some((x) => x.includes('could not be inspected')));
  assert.equal(github().writes.length, writes);
});

// Changes GitHub behind the script's back, as a person or another writer would.
function editGitHub(statePath, change) {
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  change(state);
  writeFileSync(statePath, JSON.stringify(state, null, 2));
}

test('status and start honour --dry-run: they print what they would change and write nothing (#14)', () => {
  const { dir, run, github, statePath } = setup();
  run('publish');
  writeFiles(dir, { '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass', status: 'completed', phase: 'preview' }) });
  commitAndPush(dir, 'complete');
  const writes = github().writes.length;
  const dry = run('status', '20261030-checks-pass', '--dry-run');
  assert.equal(dry.code, 0, dry.err);
  assert.match(dry.out, /would set 20261030-checks-pass to completed/);
  assert.equal(github().writes.length, writes, 'a dry status writes nothing');

  const fresh = setup();
  fresh.run('publish');
  git(fresh.dir, 'checkout', '-q', '-b', 'chore/checks-pass');
  writeFiles(fresh.dir, { '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass', status: 'active', phase: 'preview' }) });
  commitAndPush(fresh.dir, 'start', 'chore/checks-pass');
  const before = fresh.github().writes.length;
  const started = fresh.run('start', '20261030-checks-pass', '--dry-run');
  assert.equal(started.code, 0, started.err);
  assert.match(started.out, /would set 20261030-checks-pass to active/);
  assert.equal(fresh.github().writes.length, before, 'a dry start writes nothing');
  assert.ok(statePath);
});

test('an explicit status restores the record exactly: planned over active, and the closing reason (#15)', () => {
  const { dir, run, github, statePath } = setup();
  run('publish');
  const epic = issueFor(github(), '20261030-checks-pass');
  editGitHub(statePath, (state) => {
    state.issues.find((i) => i.number === epic.number).labels = ['siesta', 'siesta:epic', 'status:active'];
  });
  assert.equal(run('status', '20261030-checks-pass').code, 0);
  assert.deepEqual(labelsOf(issueFor(github(), '20261030-checks-pass')), ['siesta', 'siesta:epic', 'status:planned'], 'an explicit status undoes a wrong start');

  writeFiles(dir, { '.siesta/epics/20261030-checks-pass/spec.md': spec({ id: '20261030-checks-pass', title: 'The checks pass', status: 'completed', phase: 'preview' }) });
  commitAndPush(dir, 'complete');
  run('status', '20261030-checks-pass');
  editGitHub(statePath, (state) => {
    state.issues.find((i) => i.number === epic.number).state_reason = 'not_planned';
  });
  const { code, out } = run('check');
  assert.equal(code, 1);
  assert.match(out, /status.*20261030-checks-pass.*closed as not_planned/, 'check reports a wrong closing reason');
  run('status', '20261030-checks-pass');
  assert.equal(issueFor(github(), '20261030-checks-pass').state_reason, 'completed');
  assert.equal(run('check').code, 0);
});

test('check reports an id that two issues or two milestones carry, and the writers refuse it (#16)', () => {
  const { run, github, statePath } = setup();
  run('publish');
  const epic = issueFor(github(), '20261030-checks-pass');
  editGitHub(statePath, (state) => {
    state.issues.push({ ...structuredClone(state.issues.find((i) => i.number === epic.number)), number: 99, id: 9999 });
    const milestone = state.milestones.find((m) => m.description.includes('20261030-open-the-shop/preview'));
    state.milestones.push({ ...milestone, number: 98, title: 'Old name' });
  });
  const { code, out } = run('check');
  assert.equal(code, 1);
  assert.match(out, new RegExp(`problem.*20261030-checks-pass is carried by 2 issues: #${epic.number}, #99`));
  assert.match(out, /problem.*20261030-open-the-shop\/preview is carried by 2 milestones/);
  const writes = github().writes.length;
  assert.equal(run('publish').code, 2);
  assert.equal(run('status', '20261030-checks-pass').code, 2);
  assert.equal(run('issue', '20261030-checks-pass').code, 2);
  assert.equal(github().writes.length, writes, 'nothing is written for a duplicated id');
});

test('check reports an issue with two status labels or two kind labels, and publish removes the stale kind (#17)', () => {
  const { run, github, statePath } = setup();
  run('publish');
  const epic = issueFor(github(), '20261030-checks-pass');
  editGitHub(statePath, (state) => {
    state.issues.find((i) => i.number === epic.number).labels = ['siesta', 'siesta:epic', 'siesta:spike', 'status:planned', 'status:completed'];
  });
  const { code, out } = run('check');
  assert.equal(code, 1);
  assert.match(out, /labels.*20261030-checks-pass.*also has siesta:spike/);
  assert.match(out, /labels.*20261030-checks-pass.*has 2 status labels/);
  run('publish');
  assert.deepEqual(labelsOf(issueFor(github(), '20261030-checks-pass')), ['siesta', 'siesta:epic', 'status:completed', 'status:planned'], 'publish leaves status labels to status');
  run('status', '20261030-checks-pass');
  assert.deepEqual(labelsOf(issueFor(github(), '20261030-checks-pass')), ['siesta', 'siesta:epic', 'status:planned']);
  assert.equal(run('check').code, 0);
});

test('publish adds and removes labels one by one, so it never writes back a status another writer set (#18)', () => {
  const { run, github, statePath } = setup();
  run('publish');
  const epic = issueFor(github(), '20261030-checks-pass');
  editGitHub(statePath, (state) => {
    // A person removed the kind label, and another writer has since set the status.
    state.issues.find((i) => i.number === epic.number).labels = ['siesta', 'status:active'];
  });
  run('publish');
  const after = issueFor(github(), '20261030-checks-pass');
  assert.deepEqual(labelsOf(after), ['siesta', 'siesta:epic', 'status:active']);
  const labelWrites = github().writes.filter((w) => w.path.includes(`/issues/${epic.number}`) && (w.body.labels || w.method === 'DELETE'));
  assert.ok(labelWrites.every((w) => w.method !== 'PATCH'), 'no label set is replaced');
  assert.ok(labelWrites.every((w) => !(w.body.labels ?? []).some((l) => l.startsWith('status:'))), 'publish writes no status label');
});

test('a phase without its Status line, or with another word, is a problem and stops publish (#19)', () => {
  const noStatus = ROADMAP.replace('**Status:** proposed\n\n', '');
  const { run, github } = setup({ ...FILES, '.siesta/roadmaps/20261030-open-the-shop.md': noStatus });
  const { code, out } = run('check');
  assert.equal(code, 1);
  assert.match(out, /problem.*phase returns of 20261030-open-the-shop has no \*\*Status:\*\* line/);
  assert.equal(run('publish').code, 2);
  assert.equal(github()?.writes.length ?? 0, 0);

  const odd = setup({ ...FILES, '.siesta/roadmaps/20261030-open-the-shop.md': ROADMAP.replace('**Status:** proposed', '**Status:** done') });
  assert.match(odd.run('check').out, /phase returns of 20261030-open-the-shop has the status "done"/);
});
