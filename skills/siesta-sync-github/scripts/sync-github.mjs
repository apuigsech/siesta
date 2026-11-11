#!/usr/bin/env node
// Siesta's sync with GitHub. It mirrors the roadmaps, phases, epics, spikes and features found on
// the integration branch to GitHub issues and milestones. The repository is the record and GitHub
// follows it; nothing here deletes anything in GitHub.
//
//   node sync-github.mjs check [--json] [--no-fetch]    compare, change nothing; exit 1 on a difference
//   node sync-github.mjs publish [--dry-run] [--no-fetch]  create and update everything but statuses
//   node sync-github.mjs status <id>... [--dry-run] [--no-fetch]  set exactly those items' statuses from the record
//   node sync-github.mjs start <id> [--dry-run] [--no-fetch]      mark a planned epic active once its branch is pushed
//   node sync-github.mjs issue <id>                     print the issue number of an id
//   node sync-github.mjs version                        print this script's version
//
// Exit codes: 0 done or in step, 1 check found a difference, 2 could not run.
// SIESTA_GH names the GitHub CLI to run, `gh` by default.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// Siesta's version, the same as in its manifests, which a test compares. A repository's copy of
// this script is out of date when its version is older.
export const VERSION = '0.5.1';

// The defaults this script needs: the same values as the siesta skill's assets/defaults.yaml,
// which a test compares.
export const DEFAULTS = {
  paths: { roadmaps: '.siesta/roadmaps/', epics: '.siesta/epics/', feature: 'docs/features/{feature}.md' },
  git: { integration_branch: null },
};

const STATUSES = ['proposed', 'planned', 'active', 'blocked', 'completed', 'cancelled'];
const PHASE_STATUSES = ['proposed', 'accepted', 'completed'];
const KIND_LABEL = /^siesta:(roadmap|epic|spike|feature)$/;
const MARKER = /<!-- siesta-id: (.+?) -->/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const marker = (id) => `<!-- siesta-id: ${id} -->`;

class Failure extends Error {}

// ---------------------------------------------------------------------------------------------
// A YAML subset: block maps and lists, flow lists and maps, plain and quoted scalars, comments.
// It reads what Siesta writes: its configuration and its files' frontmatter.

export function parseYaml(text) {
  const lines = [];
  for (const raw of text.split(/\r?\n/)) {
    const content = stripComment(raw).replace(/\s+$/, '');
    if (content.trim() === '' || content.trim() === '---') continue;
    const indent = content.length - content.trimStart().length;
    lines.push({ indent, text: content.trim() });
  }
  if (lines.length === 0) return {};
  const [value] = parseBlock(lines, 0, lines[0].indent);
  return value;
}

function stripComment(line) {
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseBlock(lines, i, indent) {
  return lines[i].text.startsWith('- ') || lines[i].text === '-' ? parseList(lines, i, indent) : parseMap(lines, i, indent);
}

function parseMap(lines, i, indent) {
  const map = {};
  while (i < lines.length && lines[i].indent === indent && !lines[i].text.startsWith('- ')) {
    const { key, rest } = splitKey(lines[i].text);
    i++;
    if (rest !== '') map[key] = parseValue(rest);
    else if (i < lines.length && lines[i].indent > indent) [map[key], i] = parseBlock(lines, i, lines[i].indent);
    else if (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith('- ')) [map[key], i] = parseList(lines, i, indent);
    else map[key] = null;
  }
  return [map, i];
}

function parseList(lines, i, indent) {
  const list = [];
  while (i < lines.length && lines[i].indent === indent && (lines[i].text.startsWith('- ') || lines[i].text === '-')) {
    const item = lines[i].text.slice(1).trimStart();
    i++;
    if (item === '') {
      if (i < lines.length && lines[i].indent > indent) {
        let value;
        [value, i] = parseBlock(lines, i, lines[i].indent);
        list.push(value);
      } else list.push(null);
    } else if (isMapEntry(item)) {
      // An item that is a map: its first entry shares the dash's line, the others follow, indented.
      const inner = i < lines.length && lines[i].indent > indent ? lines[i].indent : indent + 2;
      const nested = [{ indent: inner, text: item }];
      while (i < lines.length && lines[i].indent > indent) nested.push(lines[i++]);
      const [value] = parseMap(nested, 0, inner);
      list.push(value);
    } else list.push(parseValue(item));
  }
  return [list, i];
}

function isMapEntry(text) {
  if (/^["'[{]/.test(text)) return false;
  return /^[^:]+:(\s|$)/.test(text);
}

function splitKey(text) {
  const match = /^("[^"]*"|'[^']*'|[^:]+?):(?:\s+(.*))?$/.exec(text);
  if (!match) throw new Failure(`cannot read the YAML line "${text}"`);
  return { key: unquote(match[1]), rest: (match[2] ?? '').trim() };
}

function parseValue(text) {
  if (text.startsWith('[') || text.startsWith('{')) {
    const [value, end] = parseFlow(text, 0);
    if (text.slice(end).trim() !== '') throw new Failure(`cannot read the YAML value "${text}"`);
    return value;
  }
  return scalar(text);
}

function parseFlow(text, i) {
  const open = text[i];
  const close = open === '[' ? ']' : '}';
  const result = open === '[' ? [] : {};
  i++;
  const skip = () => {
    while (/\s/.test(text[i] ?? '')) i++;
  };
  skip();
  if (text[i] === close) return [result, i + 1];
  for (;;) {
    skip();
    let key;
    if (open === '{') {
      const [k, after] = flowItem(text, i, ':');
      key = String(k);
      i = after + 1;
      skip();
    }
    let value;
    if (text[i] === '[' || text[i] === '{') [value, i] = parseFlow(text, i);
    else [value, i] = flowItem(text, i, `,${close}`);
    if (open === '[') result.push(value);
    else result[key] = value;
    skip();
    if (text[i] === ',') {
      i++;
      continue;
    }
    if (text[i] === close) return [result, i + 1];
    throw new Failure(`cannot read the YAML value "${text}"`);
  }
}

function flowItem(text, i, stops) {
  if (text[i] === '"' || text[i] === "'") {
    const quote = text[i];
    let j = i + 1;
    while (j < text.length && !(text[j] === quote && text[j - 1] !== '\\')) j++;
    return [unquote(text.slice(i, j + 1)), j + 1];
  }
  let j = i;
  while (j < text.length && !stops.includes(text[j])) j++;
  return [scalar(text.slice(i, j).trim()), j];
}

function unquote(text) {
  if (text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1).replace(/\\(["\\n])/g, (_, c) => (c === 'n' ? '\n' : c));
  if (text.startsWith("'") && text.endsWith("'")) return text.slice(1, -1).replace(/''/g, "'");
  return text;
}

function scalar(text) {
  if (text.startsWith('"') || text.startsWith("'")) return unquote(text);
  if (text === '' || text === 'null' || text === '~') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^-?\d+$/.test(text)) return Number(text);
  return text;
}

export function frontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  return match ? parseYaml(match[1]) : {};
}

// ---------------------------------------------------------------------------------------------
// The repository: its configuration and its record on the integration branch.

function git(root, ...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function tryGit(root, ...args) {
  try {
    return git(root, ...args);
  } catch {
    return null;
  }
}

function context(options) {
  const root = tryGit(process.cwd(), 'rev-parse', '--show-toplevel');
  if (!root) throw new Failure('run it inside a git repository');
  const configPath = join(root, '.siesta/config.yaml');
  if (!existsSync(configPath)) throw new Failure('the repository is not set up for Siesta: .siesta/config.yaml is missing');
  const config = parseYaml(readFileSync(configPath, 'utf8'));
  const paths = { ...DEFAULTS.paths, ...(config.paths ?? {}) };
  const addon = config.addons?.['sync-github'] ?? {};
  if (!options.noFetch) git(root, 'fetch', '-q', '--prune', 'origin');
  const branch =
    config.git?.integration_branch ??
    tryGit(root, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD')?.replace(/^origin\//, '') ??
    'main';
  const ref = `origin/${branch}`;
  if (!tryGit(root, 'rev-parse', '--verify', '-q', ref)) throw new Failure(`${ref} does not exist: push the integration branch first`);
  const repo = addon.repo ?? repoFromRemote(tryGit(root, 'remote', 'get-url', 'origin'));
  if (!repo) throw new Failure('set addons.sync-github.repo in .siesta/config.yaml: the origin remote is not on GitHub');
  return { root, paths, branch, ref, repo };
}

function repoFromRemote(url) {
  const match = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(url ?? '');
  return match ? match[1] : null;
}

function filesUnder(ctx, ref, dir) {
  const out = tryGit(ctx.root, 'ls-tree', '-r', '--name-only', ref, '--', dir);
  return out ? out.split('\n').filter(Boolean) : [];
}

function show(ctx, ref, path) {
  return tryGit(ctx.root, 'show', `${ref}:${path}`);
}

function readRecord(ctx) {
  const items = new Map();
  const problems = [];
  const warnings = [];
  const liveSlugs = new Map();
  const add = (item) => {
    if (items.has(item.id)) problems.push(`two items share the id ${item.id}`);
    items.set(item.id, item);
  };

  for (const path of filesUnder(ctx, ctx.ref, ctx.paths.roadmaps).filter((p) => p.endsWith('.md'))) {
    const text = show(ctx, ctx.ref, path);
    const fm = frontmatter(text);
    if (!fm.id || !fm.title) {
      problems.push(`${path} has no id or title`);
      continue;
    }
    add({ id: String(fm.id), kind: 'roadmap', title: fm.title, status: fm.status, path });
    for (const phase of phases(text)) {
      if (!SLUG.test(phase.slug ?? '')) {
        problems.push(`phase ${phase.n} of ${fm.id} has ${phase.slug ? `the slug "${phase.slug}", which is not lowercase words joined by hyphens` : 'no slug'}`);
        continue;
      }
      // A lost status line would read as proposed and reopen a completed phase's milestone.
      if (phase.status === null) problems.push(`phase ${phase.slug} of ${fm.id} has no **Status:** line`);
      else if (!PHASE_STATUSES.includes(phase.status)) problems.push(`phase ${phase.slug} of ${fm.id} has the status "${phase.status}", which is not one of ${PHASE_STATUSES.join(', ')}`);
      add({ id: `${fm.id}/${phase.slug}`, kind: 'phase', title: `${fm.title}: ${phase.title}`, status: phase.status, roadmap: String(fm.id), slug: phase.slug });
    }
  }

  const features = new Map();
  for (const path of filesUnder(ctx, ctx.ref, ctx.paths.epics).filter((p) => p.endsWith('/spec.md'))) {
    const fm = frontmatter(show(ctx, ctx.ref, path));
    if (!fm.id || !fm.title) {
      problems.push(`${path} has no id or title`);
      continue;
    }
    const kind = fm.kind === 'spike' ? 'spike' : 'epic';
    const slug = fm.slug ?? String(fm.id).replace(/^\d{8}-/, '');
    if (typeof slug !== 'string' || !SLUG.test(slug)) problems.push(`${fm.id} needs a lowercase hyphenated slug (set slug explicitly for custom ids)`);
    if (!['completed', 'cancelled'].includes(fm.status)) {
      if (liveSlugs.has(slug)) problems.push(`${fm.id} and ${liveSlugs.get(slug)} share the live slug ${slug}, hence the worktree name`);
      liveSlugs.set(slug, fm.id);
    }
    if (fm.type != null && (typeof fm.type !== 'string' || !SLUG.test(fm.type))) problems.push(`${fm.id} has an invalid commit type`);
    let blocked = fm.blocked ?? null;
    if (blocked !== null && (typeof blocked !== 'object' || Array.isArray(blocked) || typeof blocked.since !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(blocked.since) || typeof blocked.reason !== 'string' || !blocked.reason.trim())) {
      problems.push(`${fm.id} blocked must be null or { since: YYYY-MM-DD, reason: text }`);
      blocked = null;
    }
    if (blocked && ['completed', 'cancelled'].includes(fm.status)) problems.push(`${fm.id} is ${fm.status} but still has a blocker`);
    if (fm.status === 'blocked') warnings.push(`${fm.id} uses legacy status: blocked; recover its prior status from evidence before migrating`);
    const delivery = fm.delivery ?? {};
    if (typeof delivery !== 'object' || Array.isArray(delivery)) problems.push(`${fm.id} delivery must be an object with urls`);
    let urls = delivery.urls ?? [];
    if (!Array.isArray(urls)) { problems.push(`${fm.id} delivery.urls must be a list`); urls = []; }
    if (delivery.url != null) urls = [...urls, delivery.url];
    urls = [...new Set(urls)].filter((url) => {
      try { if (typeof url === 'string' && ['http:', 'https:'].includes(new URL(url).protocol)) return true; } catch {}
      problems.push(`${fm.id} has an invalid delivery URL`);
      return false;
    });
    add({ id: String(fm.id), kind, slug, type: fm.type ?? null, blocked, delivery: urls, title: fm.title, status: fm.status, roadmap: fm.roadmap ? String(fm.roadmap) : null, phase: fm.phase == null ? null : String(fm.phase), feature: fm.feature ?? null, path });
    if (fm.feature) features.set(String(fm.feature), [...(features.get(String(fm.feature)) ?? []), String(fm.id)]);
  }

  for (const [slug, epics] of features) {
    const path = ctx.paths.feature.replace('{feature}', slug);
    const text = show(ctx, ctx.ref, path);
    if (text === null) problems.push(`feature ${slug} is named by ${epics.join(', ')} but ${path} does not exist`);
    const title = /^# (.+)$/m.exec(text ?? '')?.[1] ?? slug;
    add({ id: `feature/${slug}`, kind: 'feature', title, path, epics });
  }

  for (const item of items.values()) {
    if ((item.kind === 'roadmap' || item.kind === 'epic' || item.kind === 'spike') && !STATUSES.includes(item.status)) {
      problems.push(`${item.id} has the status "${item.status}", which is not one of ${STATUSES.join(', ')}`);
    }
    if (item.kind === 'epic' || item.kind === 'spike') {
      if (!items.has(item.roadmap)) problems.push(`${item.id} names the roadmap ${item.roadmap}, which is not on ${ctx.ref}`);
      else if (!items.has(`${item.roadmap}/${item.phase}`)) problems.push(`${item.id} names the phase ${item.phase}, which ${item.roadmap} does not have`);
    }
  }
  return { items, problems, warnings };
}

function phases(text) {
  const found = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const heading = /^## Phase(?: (\d+))?\s*[—–-]\s*(.+)$/.exec(lines[i]);
    if (!heading) continue;
    let status = null;
    let slug = null;
    for (let j = i + 1; j < lines.length && !lines[j].startsWith('## '); j++) {
      const statusLine = /^\*\*Status:\*\*\s*([A-Za-z]+)/.exec(lines[j]);
      if (statusLine && status === null) status = statusLine[1].toLowerCase();
      const slugLine = /^\*\*Slug:\*\*\s*`?([^`\s]+)`?\s*$/.exec(lines[j]);
      if (slugLine) slug = slugLine[1];
    }
    found.push({ n: heading[1] ? Number(heading[1]) : found.length + 1, title: heading[2].trim(), status, slug });
  }
  return found;
}

// ---------------------------------------------------------------------------------------------
// GitHub, through its CLI.

function makeGh(dryRun) {
  const bin = process.env.SIESTA_GH || 'gh';
  const exec = (args, input) => {
    const [command, commandArgs] = /\.m?js$/.test(bin) ? [process.execPath, [bin, ...args]] : [bin, args];
    try {
      return execFileSync(command, commandArgs, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
    } catch (error) {
      throw new Failure(`${bin} ${args.slice(0, 3).join(' ')} failed: ${(error.stderr || error.message).trim()}`);
    }
  };
  let placeholder = 0;
  return {
    list: (path) => JSON.parse(exec(['api', '--paginate', '--slurp', path]) || '[]').flat(),
    send: (method, path, body, description) => {
      if (dryRun) {
        console.log(`would ${description}`);
        placeholder++;
        return { number: `new-${placeholder}`, id: `new-${placeholder}`, title: body.title, body: body.body, labels: body.labels?.map((name) => ({ name })) ?? [] };
      }
      return JSON.parse(exec(['api', '-X', method, path, '--input', '-'], JSON.stringify(body)) || '{}');
    },
  };
}

function readGitHub(gh, repo, items) {
  const issues = new Map();
  const unknown = [];
  // Every carrier of an id, so that two issues or two milestones with one id are reported, not silently merged.
  const carriers = new Map();
  const carry = (key, number) => carriers.set(key, [...(carriers.get(key) ?? []), number]);
  for (const issue of gh.list(`repos/${repo}/issues?state=all&labels=siesta&per_page=100`)) {
    if (issue.pull_request) continue;
    const id = MARKER.exec(issue.body ?? '')?.[1];
    if (!id) continue;
    issue.labelNames = issue.labels.map((l) => (typeof l === 'string' ? l : l.name));
    carry(`issue ${id}`, issue.number);
    if (items.has(id)) issues.set(id, issue);
    else unknown.push({ id, issue });
  }
  const milestones = new Map();
  for (const milestone of gh.list(`repos/${repo}/milestones?state=all&per_page=100`)) {
    const id = MARKER.exec(milestone.description ?? '')?.[1];
    if (!id) continue;
    carry(`milestone ${id}`, milestone.number);
    milestones.set(id, milestone);
  }
  const duplicates = new Map();
  for (const [key, numbers] of carriers) {
    if (numbers.length < 2) continue;
    const [what, id] = key.split(' ');
    duplicates.set(id, `${id} is carried by ${numbers.length} ${what}s: ${numbers.map((n) => `#${n}`).join(', ')}; a person decides which one stays`);
  }
  const labels = new Set(gh.list(`repos/${repo}/labels?per_page=100`).map((l) => l.name));
  const parents = new Map();
  for (const [id, issue] of issues) {
    if (items.get(id).kind !== 'roadmap') continue;
    for (const child of gh.list(`repos/${repo}/issues/${issue.number}/sub_issues?per_page=100`)) parents.set(child.number, issue.number);
  }
  return { issues, milestones, labels, parents, unknown, duplicates };
}

// ---------------------------------------------------------------------------------------------
// What GitHub should show for each item.

const kindLabels = (item) => ['siesta', `siesta:${item.kind}`, ...(item.blocked ? ['siesta:blocked'] : [])];
const statusOf = (issue) => issue.labelNames.find((l) => l.startsWith('status:'))?.slice('status:'.length) ?? null;
const closedBy = (status) => (status === 'completed' ? 'completed' : status === 'cancelled' ? 'not_planned' : null);
const inStep = (github, record) => github === record || (github === 'active' && record === 'planned');

function fileLink(ctx, path) {
  return `https://github.com/${ctx.repo}/blob/${ctx.branch}/${path}`;
}

function title(item) {
  return `${item.title} [${item.id}]`;
}

function body(ctx, item, numbers) {
  const note = `_Mirrored by Siesta from \`${item.path}\` on \`${ctx.branch}\`. Change the file, not this issue._`;
  const kind = { roadmap: 'Roadmap', epic: 'Epic', spike: 'Spike', feature: 'Feature' }[item.kind];
  const parts = [`${kind}: [${item.path}](${fileLink(ctx, item.path)})`];
  if ((item.kind === 'epic' || item.kind === 'spike') && item.feature) {
    const feature = numbers.get(`feature/${item.feature}`);
    if (feature) parts.push(`Feature: #${feature}`);
  }
  if (item.kind === 'feature') {
    const epics = item.epics.filter((id) => numbers.get(id)).sort().map((id) => `- #${numbers.get(id)}`);
    if (epics.length) parts.push(`Epics:\n\n${epics.join('\n')}`);
  }
  if (item.blocked) parts.push(`Blocked since ${item.blocked.since}: ${item.blocked.reason}`);
  if (item.delivery?.length) {
    const links = item.delivery.map((url) => {
      const parsed = new URL(url);
      const match = parsed.hostname === 'github.com' && parsed.pathname.match(/^\/([^/]+\/[^/]+)\/pull\/(\d+)$/);
      const label = match ? (match[1] === ctx.repo ? `#${match[2]}` : `${match[1]}#${match[2]}`) : 'PR';
      return `[${label}](<${parsed.href.replace(/>/g, '%3E')}>)`;
    });
    parts.push(`${item.status === 'completed' ? 'Delivered by' : 'Delivery PRs'}: ${links.join(', ')}`);
  }
  parts.push(note, marker(item.id));
  return parts.join('\n\n');
}

function featureClosed(record, item) {
  const epics = item.epics.map((id) => record.items.get(id)).filter(Boolean);
  return epics.length > 0 && epics.every((e) => e.status === 'completed' || e.status === 'cancelled');
}

// ---------------------------------------------------------------------------------------------
// Commands.

function compare(ctx, record, github) {
  const differences = record.problems.map((p) => `problem    ${p}`);
  for (const duplicate of github.duplicates.values()) differences.push(`problem    ${duplicate}`);
  const numbers = new Map([...github.issues].map(([id, issue]) => [id, issue.number]));
  for (const item of record.items.values()) {
    if (item.kind === 'phase') {
      const milestone = github.milestones.get(item.id);
      if (!milestone) differences.push(`missing    milestone  ${item.id}  ${item.title}`);
      else {
        if (milestone.title !== item.title) differences.push(`title      ${item.id}  "${milestone.title}" → "${item.title}"`);
        const state = item.status === 'completed' ? 'closed' : 'open';
        if (milestone.state !== state) differences.push(`state      ${item.id}  GitHub: ${milestone.state}  record: ${state}`);
      }
      continue;
    }
    const issue = github.issues.get(item.id);
    if (!issue) {
      differences.push(`missing    issue  ${item.id}  ${item.title}`);
      continue;
    }
    if (issue.title !== title(item)) differences.push(`title      ${item.id}  "${issue.title}" → "${title(item)}"`);
    if (!kindLabels(item).every((l) => issue.labelNames.includes(l))) differences.push(`labels     ${item.id}  lacks ${kindLabels(item).join(', ')}`);
    const otherKinds = issue.labelNames.filter((l) => KIND_LABEL.test(l) && l !== `siesta:${item.kind}`);
    if (otherKinds.length) differences.push(`labels     ${item.id}  also has ${otherKinds.join(', ')}`);
    const statusLabels = issue.labelNames.filter((l) => l.startsWith('status:'));
    if (statusLabels.length > 1) differences.push(`labels     ${item.id}  has ${statusLabels.length} status labels: ${statusLabels.join(', ')}`);
    if (issue.labelNames.includes('siesta:blocked') !== Boolean(item.blocked)) differences.push(`labels     ${item.id} blocker label differs`);
    if ((issue.body ?? '') !== body(ctx, item, numbers)) differences.push(`body       ${item.id}`);
    if (item.kind === 'feature') {
      const state = featureClosed(record, item) ? 'closed' : 'open';
      if (issue.state !== state) differences.push(`state      ${item.id}  GitHub: ${issue.state}  record: ${state}`);
      continue;
    }
    const status = statusOf(issue);
    const stateFits = (issue.state === 'closed') === Boolean(closedBy(item.status)) || (status === 'active' && item.status === 'planned' && issue.state === 'open');
    if (!inStep(status, item.status) || !stateFits) differences.push(`status     ${item.id}  GitHub: ${status ?? 'none'} (${issue.state})  record: ${item.status}`);
    else if (issue.state === 'closed' && closedBy(item.status) && issue.state_reason !== closedBy(item.status)) {
      differences.push(`status     ${item.id}  closed as ${issue.state_reason ?? 'unknown'}, record: ${item.status} (${closedBy(item.status)})`);
    }
    if (item.kind === 'epic' || item.kind === 'spike') {
      const milestone = github.milestones.get(`${item.roadmap}/${item.phase}`);
      if (milestone && issue.milestone?.number !== milestone.number) differences.push(`milestone  ${item.id}  not in ${milestone.title}`);
      const parent = github.issues.get(item.roadmap);
      if (parent && github.parents.get(issue.number) !== parent.number) differences.push(`parent     ${item.id}  not a sub-issue of #${parent.number}`);
    }
  }
  for (const { id, issue } of github.unknown) differences.push(`not in the record: #${issue.number} ${id}`);
  return differences;
}

function remoteBranches(ctx) {
  return (tryGit(ctx.root, 'for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin') ?? '')
    .split('\n').filter((b) => b && b !== 'origin/HEAD' && b !== 'origin' && b !== ctx.ref);
}

// These are observations only: never publish branch contents as the integration record.
function branchDiagnostics(ctx, record, github) {
  const warnings = [...record.warnings];
  const pending = [];
  const branches = remoteBranches(ctx);
  for (const item of record.items.values()) {
    if (!['epic', 'spike'].includes(item.kind) || ['completed', 'cancelled'].includes(item.status)) continue;
    const base = show(ctx, ctx.ref, item.path);
    const candidates = [];
    for (const branch of branches) {
      const text = show(ctx, branch, item.path);
      let fm;
      try { fm = frontmatter(text ?? ''); } catch (error) {
        warnings.push(`${item.id} on ${branch} could not be inspected: ${error.message}`);
        continue;
      }
      if (String(fm.id) !== item.id || !['active', 'blocked', 'completed'].includes(fm.status)) continue;
      if (text === base && !branch.endsWith(`/${item.slug}`)) continue;
      candidates.push(branch);
      pending.push({ id: item.id, branch, status: fm.status, blocked: fm.blocked ?? null });
    }
    if ((item.status === 'active' || statusOf(github.issues.get(item.id) ?? { labelNames: [] }) === 'active') && !candidates.length) {
      warnings.push(`${item.id} is active but no published worker branch was found; check its PR and assignment before restarting`);
    }
  }
  return { warnings, pending };
}

function check(ctx, options) {
  const record = readRecord(ctx);
  const gh = makeGh(false);
  const github = readGitHub(gh, ctx.repo, record.items);
  const differences = compare(ctx, record, github);
  const { warnings, pending } = branchDiagnostics(ctx, record, github);
  if (options.json) console.log(JSON.stringify({ ref: ctx.ref, repo: ctx.repo, differences, warnings, pending }, null, 2));
  else {
    console.log(differences.length ? differences.join('\n') : `GitHub (${ctx.repo}) mirrors the plan on ${ctx.ref}.`);
    for (const warning of warnings) console.log(`warning    ${warning}`);
    for (const item of pending) console.log(`pending    ${item.id} on ${item.branch}: ${item.status}${item.blocked ? ' (blocked)' : ''}; not merged`);
  }
  return differences.length === 0 ? 0 : 1;
}

function publish(ctx, options) {
  const record = readRecord(ctx);
  if (record.problems.length) throw new Failure(record.problems.join('\n'));
  for (const warning of record.warnings) console.log(`warning: ${warning}`);
  const gh = makeGh(options.dryRun);
  const github = readGitHub(gh, ctx.repo, record.items);
  if (github.duplicates.size) throw new Failure([...github.duplicates.values()].join('\n'));
  const numbers = new Map([...github.issues].map(([id, issue]) => [id, issue.number]));
  let changes = 0;
  const send = (method, path, payload, description) => {
    changes++;
    const result = gh.send(method, path, payload, description);
    if (!options.dryRun) console.log(description);
    return result;
  };
  const items = (...kinds) => [...record.items.values()].filter((i) => kinds.includes(i.kind));

  const wantedLabels = new Set(['siesta', 'siesta:roadmap', 'siesta:epic', 'siesta:spike', 'siesta:feature']);
  for (const item of items('roadmap', 'epic', 'spike')) if (STATUSES.includes(item.status)) wantedLabels.add(`status:${item.status}`);
  if (items('epic', 'spike').some((item) => item.blocked)) wantedLabels.add('siesta:blocked');
  for (const name of wantedLabels) {
    if (github.labels.has(name)) continue;
    send('POST', `repos/${ctx.repo}/labels`, { name, color: name.startsWith('status:') ? 'c5def5' : 'fbca04', description: 'Managed by Siesta' }, `create label ${name}`);
  }

  for (const item of items('phase')) {
    const state = item.status === 'completed' ? 'closed' : 'open';
    const milestone = github.milestones.get(item.id);
    if (!milestone) {
      const created = send('POST', `repos/${ctx.repo}/milestones`, { title: item.title, description: marker(item.id), state }, `create milestone ${item.id}`);
      github.milestones.set(item.id, created);
    } else if (milestone.title !== item.title || milestone.state !== state) {
      send('PATCH', `repos/${ctx.repo}/milestones/${milestone.number}`, { title: item.title, state }, `update milestone ${item.id}`);
    }
  }

  const upsert = (item, extra = {}) => {
    const issue = github.issues.get(item.id);
    const wantedBody = body(ctx, item, numbers);
    if (!issue) {
      const status = item.kind === 'feature' ? [] : [`status:${item.status}`];
      const created = send('POST', `repos/${ctx.repo}/issues`, { title: title(item), body: wantedBody, labels: [...kindLabels(item), ...status], ...extra }, `create issue ${item.id}`);
      created.labelNames = [...kindLabels(item), ...status];
      created.state = 'open';
      created.milestone = extra.milestone ? { number: extra.milestone } : null;
      created.body = wantedBody;
      github.issues.set(item.id, created);
      numbers.set(item.id, created.number);
      const reason = item.kind === 'feature' ? (featureClosed(record, item) ? 'completed' : null) : closedBy(item.status);
      if (reason) {
        send('PATCH', `repos/${ctx.repo}/issues/${created.number}`, { state: 'closed', state_reason: reason }, `close issue ${item.id}`);
        created.state = 'closed';
      }
      return created;
    }
    const patch = {};
    if (issue.title !== title(item)) patch.title = title(item);
    if ((issue.body ?? '') !== wantedBody) patch.body = wantedBody;
    // Labels are added and removed one by one, never replaced as a set: a status label another writer set since this run read
    // the issue is never written back.
    const missing = kindLabels(item).filter((name) => !issue.labelNames.includes(name));
    const stale = issue.labelNames.filter((name) => (name === 'siesta:blocked' && !item.blocked) || (KIND_LABEL.test(name) && name !== `siesta:${item.kind}`));
    if (extra.milestone !== undefined && issue.milestone?.number !== extra.milestone) patch.milestone = extra.milestone;
    if (item.kind === 'feature') {
      const state = featureClosed(record, item) ? 'closed' : 'open';
      if (issue.state !== state) Object.assign(patch, { state, state_reason: state === 'closed' ? 'completed' : null });
    }
    if (Object.keys(patch).length) {
      send('PATCH', `repos/${ctx.repo}/issues/${issue.number}`, patch, `update issue ${item.id} (${Object.keys(patch).join(', ')})`);
      Object.assign(issue, patch);
    }
    if (missing.length) {
      send('POST', `repos/${ctx.repo}/issues/${issue.number}/labels`, { labels: missing }, `label issue ${item.id} (${missing.join(', ')})`);
      issue.labelNames = [...issue.labelNames, ...missing];
    }
    for (const name of stale) {
      send('DELETE', `repos/${ctx.repo}/issues/${issue.number}/labels/${encodeURIComponent(name)}`, {}, `unlabel issue ${item.id} (${name})`);
      issue.labelNames = issue.labelNames.filter((l) => l !== name);
    }
    return issue;
  };

  for (const item of items('roadmap')) upsert(item);
  for (const item of items('feature')) upsert(item);
  for (const item of items('epic', 'spike')) {
    const milestone = github.milestones.get(`${item.roadmap}/${item.phase}`);
    const issue = upsert(item, milestone ? { milestone: milestone.number } : {});
    const parent = github.issues.get(item.roadmap);
    if (parent && github.parents.get(issue.number) !== parent.number) {
      try {
        send('POST', `repos/${ctx.repo}/issues/${parent.number}/sub_issues`, { sub_issue_id: issue.id }, `make ${item.id} a sub-issue of ${item.roadmap}`);
        github.parents.set(issue.number, parent.number);
      } catch (error) {
        if (!(error instanceof Failure)) throw error;
        console.log(`problem: ${item.id} could not become a sub-issue of ${item.roadmap}: ${error.message}`);
      }
    }
  }
  for (const item of items('feature')) upsert(item);

  for (const { id, issue } of github.unknown) console.log(`not in the record, left as it is: #${issue.number} ${id}`);
  if (changes === 0) console.log(`Nothing to change: GitHub (${ctx.repo}) mirrors the plan on ${ctx.ref}.`);
  return 0;
}

// An explicit status sets exactly the record's lifecycle — one status label, the state and the closing reason — unlike check
// and publish, which let a starting epic be active in GitHub while it is still planned on the integration branch.
function setStatus(ctx, ids, wanted, options = {}) {
  const record = readRecord(ctx);
  if (record.problems.length) throw new Failure(record.problems.join('\n'));
  const gh = makeGh(Boolean(options.dryRun));
  const github = readGitHub(gh, ctx.repo, record.items);
  for (const id of ids) {
    const item = record.items.get(id);
    if (!item || !['roadmap', 'epic', 'spike'].includes(item.kind)) throw new Failure(`${id} is not a roadmap, epic or spike on ${ctx.ref}`);
    if (github.duplicates.has(id)) throw new Failure(github.duplicates.get(id));
    if (!github.issues.get(id)) throw new Failure(`${id} has no issue yet: publish first`);
  }
  for (const id of ids) {
    const issue = github.issues.get(id);
    const status = wanted ?? record.items.get(id).status;
    const reason = closedBy(status);
    const statusLabels = issue.labelNames.filter((l) => l.startsWith('status:'));
    const exact = statusLabels.length === 1 && statusLabels[0] === `status:${status}`
      && issue.state === (reason ? 'closed' : 'open') && (!reason || issue.state_reason === reason);
    if (exact) continue;
    const labels = [...issue.labelNames.filter((l) => !l.startsWith('status:')), `status:${status}`];
    const patch = { labels, state: reason ? 'closed' : 'open', state_reason: reason };
    gh.send('PATCH', `repos/${ctx.repo}/issues/${issue.number}`, patch, `set ${id} to ${status}`);
    if (!options.dryRun) console.log(`#${issue.number} ${id}: ${status}`);
  }
  return 0;
}

function start(ctx, id, options = {}) {
  const record = readRecord(ctx);
  const item = record.items.get(id);
  if (!item || !['epic', 'spike'].includes(item.kind)) throw new Failure(`${id} is not an epic or spike on ${ctx.ref}`);
  if (record.problems.length) throw new Failure(record.problems.join('\n'));
  if (item.blocked) throw new Failure(`${id} is blocked since ${item.blocked.since}: ${item.blocked.reason}`);
  if (item.status !== 'planned') throw new Failure(`${id} is ${item.status} on ${ctx.ref}; only a planned epic starts`);
  const started = remoteBranches(ctx).find((b) => {
    const fm = frontmatter(show(ctx, b, item.path) ?? '');
    return String(fm.id) === id && fm.status === 'active' && !fm.blocked;
  });
  if (!started) throw new Failure(`no branch on origin has ${id} active: push the epic's branch, with its spec set to active, first`);
  console.log(`${id} is active on ${started}`);
  return setStatus(ctx, [id], 'active', options);
}

function issueNumber(ctx, id) {
  const record = readRecord(ctx);
  const github = readGitHub(makeGh(false), ctx.repo, record.items);
  if (github.duplicates.has(id)) throw new Failure(github.duplicates.get(id));
  const issue = github.issues.get(id);
  if (!issue) throw new Failure(`${id} has no issue`);
  console.log(issue.number);
  return 0;
}

function main(argv) {
  const [command, ...rest] = argv;
  if (command === 'version') {
    console.log(VERSION);
    return 0;
  }
  const options = {
    json: rest.includes('--json'),
    dryRun: rest.includes('--dry-run'),
    noFetch: rest.includes('--no-fetch') || command === 'issue',
  };
  const ids = rest.filter((a) => !a.startsWith('--'));
  const ctx = context(options);
  switch (command) {
    case 'check':
      return check(ctx, options);
    case 'publish':
      return publish(ctx, options);
    case 'status':
      if (ids.length === 0) throw new Failure('name the ids whose status to set');
      return setStatus(ctx, ids, null, options);
    case 'start':
      if (ids.length !== 1) throw new Failure('name one epic to start');
      return start(ctx, ids[0], options);
    case 'issue':
      if (ids.length !== 1) throw new Failure('name one id');
      return issueNumber(ctx, ids[0]);
    default:
      throw new Failure('use one of: check, publish, status <id>..., start <id>, issue <id>');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof Failure)) throw error;
    console.error(`sync-github: ${error.message}`);
    process.exitCode = 2;
  }
}
