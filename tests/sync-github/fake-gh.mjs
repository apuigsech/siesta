// A stand-in for the GitHub CLI in the sync-github tests. It serves the few REST endpoints the
// script uses from a JSON file (FAKE_GH_STATE) and logs every write, so tests can check what was
// sent without reaching GitHub.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const statePath = process.env.FAKE_GH_STATE;
const empty = { issues: [], milestones: [], labels: [], parents: {}, next: { number: 1, id: 1000 }, writes: [] };
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : structuredClone(empty);
const save = () => writeFileSync(statePath, JSON.stringify(state, null, 2));
const fail = (status, message) => {
  process.stderr.write(`gh: ${message} (HTTP ${status})\n`);
  process.exit(1);
};
const out = (value) => process.stdout.write(JSON.stringify(value));

const args = process.argv.slice(2);
if (args[0] === 'auth' && args[1] === 'status') process.exit(0);
if (args[0] !== 'api') fail(400, `fake gh supports only "api", got "${args[0]}"`);

let method = 'GET';
let slurp = false;
let input = null;
let target = null;
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === '-X' || a === '--method') method = args[++i];
  else if (a === '--paginate') continue;
  else if (a === '--slurp') slurp = true;
  else if (a === '--input') input = args[++i];
  else if (a === '-H' || a === '--header') i++;
  else target = a;
}
const body = input === '-' ? JSON.parse(readFileSync(0, 'utf8') || '{}') : {};
const [path, query = ''] = target.replace(/^\//, '').split('?');
const params = Object.fromEntries(new URLSearchParams(query));
const parts = path.split('/');
if (parts[0] !== 'repos' || parts.length < 3) fail(404, 'Not Found');
const rest = parts.slice(3);
const list = (items) => out(slurp ? [items] : items);
const write = (entry) => {
  state.writes.push(entry);
  save();
};
const issueView = (issue) => ({
  ...issue,
  labels: issue.labels.map((name) => ({ name })),
  milestone: issue.milestone ? state.milestones.find((m) => m.number === issue.milestone) : null,
});

if (rest.length === 0) {
  out({ full_name: `${parts[1]}/${parts[2]}` });
} else if (rest[0] === 'labels' && rest.length === 1) {
  if (method === 'GET') list(state.labels);
  else {
    if (state.labels.some((l) => l.name === body.name)) fail(422, 'Validation Failed');
    state.labels.push({ name: body.name, color: body.color, description: body.description });
    write({ method, path, body });
    out(body);
  }
} else if (rest[0] === 'milestones' && rest.length === 1) {
  if (method === 'GET') {
    const wanted = params.state ?? 'open';
    list(state.milestones.filter((m) => wanted === 'all' || m.state === wanted));
  } else {
    const milestone = { number: state.next.number++, title: body.title, description: body.description ?? '', state: body.state ?? 'open' };
    state.milestones.push(milestone);
    write({ method, path, body });
    out(milestone);
  }
} else if (rest[0] === 'milestones' && rest.length === 2) {
  const milestone = state.milestones.find((m) => m.number === Number(rest[1]));
  if (!milestone) fail(404, 'Not Found');
  Object.assign(milestone, body);
  write({ method, path, body });
  out(milestone);
} else if (rest[0] === 'issues' && rest.length === 1) {
  if (method === 'GET') {
    const wanted = params.state ?? 'open';
    const labels = params.labels ? params.labels.split(',') : [];
    list(
      state.issues
        .filter((i) => wanted === 'all' || i.state === wanted)
        .filter((i) => labels.every((l) => i.labels.includes(l)))
        .map(issueView),
    );
  } else {
    const issue = {
      number: state.next.number++,
      id: state.next.id++,
      title: body.title,
      body: body.body ?? '',
      labels: body.labels ?? [],
      milestone: body.milestone ?? null,
      state: 'open',
      state_reason: null,
    };
    state.issues.push(issue);
    write({ method, path, body });
    out(issueView(issue));
  }
} else if (rest[0] === 'issues' && rest.length === 2) {
  const issue = state.issues.find((i) => i.number === Number(rest[1]));
  if (!issue) fail(404, 'Not Found');
  if (method === 'GET') out(issueView(issue));
  else {
    for (const key of ['title', 'body', 'labels', 'milestone', 'state', 'state_reason']) {
      if (key in body) issue[key] = body[key];
    }
    write({ method, path, body });
    out(issueView(issue));
  }
} else if (rest[0] === 'issues' && rest[2] === 'sub_issues') {
  const parent = Number(rest[1]);
  if (method === 'GET') {
    const children = Object.entries(state.parents)
      .filter(([, p]) => p === parent)
      .map(([child]) => issueView(state.issues.find((i) => i.number === Number(child))));
    list(children);
  } else {
    const child = state.issues.find((i) => i.id === body.sub_issue_id);
    if (!child) fail(404, 'Not Found');
    if (state.parents[child.number]) fail(422, 'Issue may not contain duplicate sub-issues or have more than one parent');
    state.parents[child.number] = parent;
    write({ method, path, body });
    out(issueView(child));
  }
} else {
  fail(404, 'Not Found');
}
