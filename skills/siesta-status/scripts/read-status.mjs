#!/usr/bin/env node
// A read-only snapshot, shared by any harness. No fetch, generated state or model calls.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseYaml, frontmatter } from '../../siesta-sync-github/scripts/sync-github.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const closed = new Set(['completed', 'cancelled']);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = value => Array.isArray(value) ? value : [];
const clean = text => String(text ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*`]/g, '').trim();
const read = path => {
  try { return readFileSync(path, 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
};
const modified = path => { try { return statSync(path).mtime.toISOString(); } catch { return null; } };
const merge = (base, patch) => {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error(`Invalid configuration key: ${key}`);
    result[key] = object(value) && object(base[key]) ? merge(base[key], value) : value;
  }
  return result;
};

function git(root, ...args) {
  return execFileSync('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', '-C', root, ...args], {
    encoding: 'utf8', timeout: 10_000, maxBuffer: 32 << 20, stdio: ['ignore', 'pipe', 'pipe'],
  }).trimEnd();
}
function tryGit(root, ...args) { try { return git(root, ...args); } catch { return null; } }

// Do not count examples inside fenced code blocks as work or checkpoint items.
export function prose(text) {
  let fence = null;
  return String(text ?? '').split(/\r?\n/).filter(line => {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      return false;
    }
    return !fence;
  }).join('\n');
}
export function countChecks(text) {
  if (text == null) return null;
  const checks = [...prose(text).matchAll(/^\s*[-*+] \[([ xX])\]/gm)];
  return { done: checks.filter(match => match[1] !== ' ').length, total: checks.length };
}
function section(text, heading) {
  const lines = prose(text).split('\n');
  const start = lines.findIndex(line => heading.test(line));
  if (start < 0) return null;
  const end = lines.findIndex((line, i) => i > start && /^## /.test(line));
  return lines.slice(start + 1, end < 0 ? undefined : end).join('\n');
}
export function parsePhases(text) {
  return prose(text).split(/(?=^## )/m).flatMap(block => {
    const heading = /^## Phase(?: \d+)?\s*[—–-]\s*(.+)/.exec(block);
    if (!heading) return [];
    return [{
      title: heading[1].trim(), slug: /^\*\*Slug:\*\*\s*`?([^`\s]+)/m.exec(block)?.[1] ?? null,
      status: /^\*\*Status:\*\*\s*(\w+)/m.exec(block)?.[1] ?? null,
      criteria: countChecks(block),
    }];
  });
}
export function parseCheckpoint(text) {
  const source = prose(text);
  const matches = [...source.matchAll(/^(?:#{1,6}\s+)?(?:\*\*)?((?:Q|H)-\d+)\s*[-—–:]\s*(.+)$/gm)];
  const seen = new Set();
  return matches.flatMap((match, i) => {
    if (seen.has(match[1])) return [];
    seen.add(match[1]);
    const title = clean(match[2].split('**')[0]);
    const body = source.slice(match.index, matches[i + 1]?.index ?? source.length).split(/^## /m)[0].trim();
    return [{ id: match[1], title, detail: body.slice(0, 8000) }];
  });
}
export function parseWorkers(text) {
  const workers = section(text, /^## Workers\s*$/i) ?? '';
  return workers.split('\n').flatMap(line => {
    if (!line.startsWith('|')) return [];
    const cells = line.split(/(?<!\\)\|/).slice(1, -1).map(value => value.trim());
    if (cells.length !== 7 || !cells[0] || /^(Epic|[-: ]+)$/i.test(cells[0])) return [];
    return [{
      id: clean(cells[0]),
      // The worker's session: the first quoted id in its cell, such as a Claude Desktop `local_…` id or a CLI session's.
      session: [...cells[1].matchAll(/`([^`\s/]+)`/g)].map(match => match[1]).find(value => /^[\w-]{8,}$/.test(value)) ?? null,
      branch: [...cells[2].matchAll(/`([^`]+)`/g)].map(match => match[1]).find(value => !value.startsWith('/') && !value.startsWith('~') && value.includes('/')) ?? null,
      stage: clean(cells[5]), since: clean(cells[6]),
      pullRequest: /https:\/\/[^\s)]+\/pull\/\d+/.exec(cells[4])?.[0] ?? null,
    }];
  });
}

function loadConfig(root, repo, home, env, warnings) {
  const defaults = parseYaml(readFileSync(join(here, '../../siesta/assets/defaults.yaml'), 'utf8'));
  let config = defaults;
  const layers = [
    [join(env.XDG_CONFIG_HOME || join(home, '.config'), 'siesta/config.yaml'), false],
    [join(root, '.siesta/config.yaml'), true],
    [join(root, '.siesta/config.local.yaml'), false],
  ];
  function unknownKeys(value, schema, prefix = '') {
    for (const [key, item] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (!(key in schema)) warnings.push(`Unknown configuration key: ${path}`);
      else if (key !== 'addons' && object(item) && object(schema[key]) && Object.keys(schema[key]).length) unknownKeys(item, schema[key], path);
    }
  }
  for (const [path, repository] of layers) {
    const text = read(path);
    if (text == null) {
      if (repository) throw new Error(`Siesta is not set up: ${path} is missing.`);
      continue;
    }
    const layer = parseYaml(text);
    if (!object(layer)) throw new Error(`Expected a configuration map: ${path}`);
    if ('version' in layer && layer.version !== 1) throw new Error(`Unsupported Siesta version in ${path}`);
    if (layer.extends != null) throw new Error(`Siesta presets are not supported: ${layer.extends}`);
    unknownKeys(layer, defaults);
    if (!repository && 'autonomy' in layer) {
      warnings.push(`Ignored autonomy outside repository configuration: ${path}`);
      delete layer.autonomy;
    }
    config = merge(config, layer);
  }
  if (!['criteria', 'tasks', 'mixed'].includes(config.status?.progress)) throw new Error('Invalid status.progress');
  if (!Number.isInteger(config.execution?.max_parallel_epics) || config.execution.max_parallel_epics < 1) throw new Error('Invalid execution.max_parallel_epics');
  const expand = (path, base = root) => {
    if (typeof path !== 'string' || !path) throw new Error('Expected a configured path');
    const value = path.replaceAll('{repo}', repo).replace(/^~(?=\/|$)/, home);
    if (/[{}]/.test(value)) throw new Error(`Unresolved path: ${path}`);
    return resolve(base, value);
  };
  return { config, expand };
}

export function readStatus({ root = process.cwd(), home = homedir(), env = process.env, now = new Date() } = {}) {
  root = git(resolve(root), 'rev-parse', '--show-toplevel');
  const warnings = [];
  const origin = tryGit(root, 'remote', 'get-url', 'origin');
  const repo = origin?.replace(/\.git$/, '').match(/[:/]([^/:]+\/[^/]+)$/)?.[1] ?? basename(root);
  const { config, expand } = loadConfig(root, repo, home, env, warnings);
  let integration = config.git?.integration_branch;
  if (!integration) integration = tryGit(root, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD')?.replace(/^origin\//, '');
  if (!integration) throw new Error('Set git.integration_branch, or establish origin/HEAD before opening the panel.');
  if (typeof integration !== 'string' || integration.startsWith('-')) throw new Error('Invalid integration branch');
  const remoteRef = `refs/remotes/origin/${integration}`;
  const localRef = `refs/heads/${integration}`;
  const ref = tryGit(root, 'rev-parse', '--verify', `${remoteRef}^{commit}`) ? remoteRef : localRef;
  const commit = git(root, 'rev-parse', '--verify', `${ref}^{commit}`);
  if (ref === localRef) warnings.push(`No origin/${integration}; counting the local integration branch.`);
  const show = (at, path) => tryGit(root, 'show', `${at}:${path}`);
  const trackedPath = path => {
    const rel = relative(root, expand(path));
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw new Error(`Integration records must be inside the repository: ${path}`);
    return rel.split(sep).join('/');
  };
  const roadmapsPath = trackedPath(config.paths.roadmaps);
  const epicsPath = trackedPath(config.paths.epics);
  const files = git(root, 'ls-tree', '-r', '--name-only', '-z', commit, '--', roadmapsPath, epicsPath).split('\0').filter(Boolean);
  const parse = (text, path) => {
    try { return frontmatter(text ?? ''); }
    catch (error) { throw new Error(`${path}: ${error.message}`); }
  };
  const roadmaps = files.filter(path => path.startsWith(`${roadmapsPath}/`) && path.endsWith('.md')).map(path => {
    const text = show(commit, path);
    if (text == null) throw new Error(`Cannot read ${path}`);
    const meta = parse(text, path);
    if (!meta.id) throw new Error(`Missing roadmap id: ${path}`);
    const phases = parsePhases(text);
    for (const phase of phases) {
      if (!phase.slug || !['proposed', 'accepted', 'completed'].includes(phase.status)) warnings.push(`Incomplete phase metadata: ${meta.id} / ${phase.title}`);
      if (phase.status === 'completed' && phase.criteria.done < phase.criteria.total) warnings.push(`Closed phase with unchecked criteria: ${phase.title}`);
    }
    return { id: meta.id, title: meta.title || meta.id, status: meta.status, phases, path };
  });
  const worktrees = git(root, 'worktree', 'list', '--porcelain', '-z').split('\0\0').map(block => {
    const parts = block.split('\0');
    return { path: parts.find(line => line.startsWith('worktree '))?.slice(9), branch: parts.find(line => line.startsWith('branch refs/heads/'))?.slice(18) };
  }).filter(item => item.path);
  const mainRoot = worktrees[0]?.path ?? root;
  const notes = expand(config.paths.notes);
  const assignments = new Map();
  const pmSources = [];
  for (const roadmap of roadmaps) {
    const path = join(notes, `pm-${roadmap.id}.md`);
    const text = read(path);
    if (text == null) continue;
    pmSources.push({ path, modifiedAt: modified(path) });
    for (const worker of parseWorkers(text)) assignments.set(worker.id, worker);
  }
  const branches = git(root, 'for-each-ref', '--format=%(refname)', 'refs/heads', 'refs/remotes/origin').split('\n');
  const branchNames = new Set(branches.map(branch => branch.replace(/^refs\/(heads|remotes\/origin)\//, '')));
  const epics = files.filter(path => path.startsWith(`${epicsPath}/`) && path.endsWith('/spec.md')).map(path => {
    const text = show(commit, path);
    if (text == null) throw new Error(`Cannot read ${path}`);
    const meta = parse(text, path);
    if (!meta.id || !['proposed', 'planned', 'active', 'blocked', 'completed', 'cancelled'].includes(meta.status)) throw new Error(`Invalid epic identity or status: ${path}`);
    for (const field of ['depends_on', 'waits_for']) {
      if (meta[field] != null && (!Array.isArray(meta[field]) || meta[field].some(id => typeof id !== 'string'))) throw new Error(`Expected a list of ids for ${field}: ${path}`);
    }
    if (!roadmaps.some(roadmap => roadmap.id === meta.roadmap)) warnings.push(`Epic has no known roadmap: ${meta.id}`);
    const worker = assignments.get(meta.id);
    const slug = meta.slug || meta.id.replace(/^\d{8}-/, '');
    const configured = meta.type ? config.naming.branch.replaceAll('{type}', meta.type).replaceAll('{slug}', slug) : null;
    const candidates = [...branchNames].filter(name => name !== integration && (name === configured || name.endsWith(`/${slug}`) || name.includes(`/${slug}-`)));
    let branch = worker?.branch || (candidates.length === 1 ? candidates[0] : null);
    let branchText = null;
    let plan = show(commit, `${dirname(path)}/plan.md`);
    let readFrom = ref.replace('refs/remotes/', '').replace('refs/heads/', '');
    if (!closed.has(meta.status)) {
      if (!worker?.branch && candidates.length > 1) warnings.push(`Ambiguous worker branch: ${meta.id}`);
      const folder = worktrees.find(item => item.branch === branch)?.path;
      const branchRef = branches.includes(`refs/heads/${branch}`) ? `refs/heads/${branch}` : `refs/remotes/origin/${branch}`;
      if (branch && folder) {
        branchText = read(join(folder, path));
        if (branchText != null) { plan = read(join(folder, dirname(path), 'plan.md')); readFrom = `worktree: ${folder}`; }
      } else if (branch && branches.includes(branchRef)) {
        branchText = show(branchRef, path);
        if (branchText != null) { plan = show(branchRef, `${dirname(path)}/plan.md`); readFrom = branchRef.replace('refs/heads/', '').replace('refs/remotes/', ''); }
      }
      if (!branchText && (meta.status === 'active' || worker)) warnings.push(`Worker progress unavailable: ${meta.id}; showing integration.`);
    } else branch = null;
    const branchMeta = branchText == null ? meta : parse(branchText, path);
    if (branchMeta.id !== meta.id) throw new Error(`Worker epic identity differs: ${path}`);
    const active = !closed.has(meta.status) && (Boolean(worker) || meta.status === 'active' || ['active', 'completed'].includes(branchMeta.status));
    if (meta.status === 'blocked') warnings.push(`Legacy blocked status; recover its lifecycle: ${meta.id}`);
    return {
      id: meta.id, title: meta.title || meta.id, roadmap: meta.roadmap, phase: meta.phase, path,
      status: meta.status, statusOnBranch: branchText == null ? null : branchMeta.status,
      blocked: Object.hasOwn(branchMeta, 'blocked') ? branchMeta.blocked : meta.blocked ?? null,
      dependsOn: list(meta.depends_on), waitsFor: list(meta.waits_for), active,
      criteria: countChecks(section(branchText ?? text, /^## Acceptance criteria\s*$/i)), tasks: countChecks(plan),
      branch, readFrom, session: worker?.session || null, stage: worker?.stage || null, since: worker?.since || null,
      delivery: [...list(meta.delivery?.urls), ...(meta.delivery?.url ? [meta.delivery.url] : []), ...(worker?.pullRequest ? [worker.pullRequest] : [])].filter(url => /^https?:\/\//.test(url)),
    };
  });
  if (new Set(epics.map(epic => epic.id)).size !== epics.length) throw new Error('Duplicate epic ids');
  if (new Set(roadmaps.map(roadmap => roadmap.id)).size !== roadmaps.length) throw new Error('Duplicate roadmap ids');
  const completedIds = new Set(epics.filter(epic => epic.status === 'completed').map(epic => epic.id));
  // Compare the integration record with the previous saved report. Never count a worker's completion as delivery.
  let baseline = null;
  let previousCommit = null;
  try {
    const name = readdirSync(notes).filter(name => /^status-\d{8}-\d{4}\.md$/.test(name)).sort().at(-1);
    if (name) {
      const [, y, mo, d, h, mi] = /^status-(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})\.md$/.exec(name);
      baseline = { path: join(notes, name), at: new Date(+y, +mo - 1, +d, +h, +mi).toISOString() };
      previousCommit = git(root, 'rev-list', '-1', `--before=${baseline.at}`, commit);
      if (!previousCommit) warnings.push('No integration history before the last status; recent delivery is unknown.');
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const roadmap of roadmaps) {
    const own = epics.filter(epic => epic.roadmap === roadmap.id && epic.status !== 'cancelled');
    roadmap.total = own.length;
    roadmap.completed = own.filter(epic => epic.status === 'completed').length;
    roadmap.active = own.filter(epic => epic.active);
    roadmap.delivered = baseline && previousCommit ? own.filter(epic => epic.status === 'completed' && parse(show(previousCommit, epic.path), epic.path).status !== 'completed').map(({ id, title, delivery }) => ({ id, title, delivery })) : null;
    roadmap.ready = own.filter(epic => epic.status === 'planned' && !epic.active && !epic.blocked && !epic.waitsFor.length && epic.dependsOn.every(id => completedIds.has(id)) && roadmap.phases.some(phase => phase.slug === epic.phase && phase.status === 'accepted'));
    for (const phase of roadmap.phases) {
      const members = own.filter(epic => epic.phase === phase.slug);
      phase.total = members.length;
      phase.completed = members.filter(epic => epic.status === 'completed').length;
    }
  }
  // Relative to the main checkout; when it is not there, the checkout the reader runs in, such as the coordinator's worktree.
  const configuredCheckpoint = expand(config.paths.checkpoint, mainRoot);
  const localCheckpoint = expand(config.paths.checkpoint, root);
  const checkpointPath = read(configuredCheckpoint) == null && read(localCheckpoint) != null ? localCheckpoint : configuredCheckpoint;
  const checkpointText = read(checkpointPath);
  const checkpointItems = checkpointText == null ? [] : parseCheckpoint(checkpointText);
  return {
    schemaVersion: 1, generatedAt: now.toISOString(), repo, root, mainRoot,
    project: config.project.name || repo, language: config.project.language.human,
    source: { ref: ref.replace('refs/remotes/', '').replace('refs/heads/', ''), commit, fetched: false },
    progress: config.status.progress, roadmaps,
    capacity: { used: epics.filter(epic => epic.active).length, max: config.execution.max_parallel_epics },
    checkpoint: { path: checkpointPath, available: checkpointText != null, modifiedAt: modified(checkpointPath), questions: checkpointItems.filter(item => item.id.startsWith('Q-')), hypotheses: checkpointItems.filter(item => item.id.startsWith('H-')) },
    baseline, pmSources, warnings: [...new Set(warnings)],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length && (args.length !== 2 || args[0] !== '--root')) throw new Error('Usage: read-status.mjs [--root <checkout>]');
    process.stdout.write(`${JSON.stringify(readStatus({ root: args[1] || process.cwd() }))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
