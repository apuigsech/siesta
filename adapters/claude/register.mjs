import { atom, read, update } from 'claude-code';
import { drawStatus } from './view.mjs';

const PANE = 'siesta-pulse';
const loaded = atom({ plugin: 'siesta', key: 'pulse' }, {
  status: null, error: null, refreshing: false, refreshId: null, root: null,
  roadmap: null, more: false, item: null, language: null, running: {}, pulse: false, activity: [],
}, { shape: 'siesta-pulse-3' });

// Whether the pane is open, as the last check found it: the beat runs only then.
let paneOpen = false;
const isOpen = async $ => (paneOpen = (await $.ui.panes()).some(pane => pane.id === PANE));

// Which workers' sessions are running a turn. Claude Desktop says so through its session server; elsewhere nothing
// answers, and the activity records below are the only source.
async function watchSessions($) {
  const state = await read($, loaded);
  const ids = new Set((state.status?.roadmaps ?? []).flatMap(roadmap => roadmap.active.map(epic => epic.session)).filter(Boolean));
  let running = {};
  if (ids.size) {
    try {
      const result = await $.mcp.call('ccd_session_mgmt', 'list_sessions', { limit: 100 });
      const rows = JSON.parse(result.content.find(block => block.type === 'text')?.text ?? '[]');
      running = Object.fromEntries(rows.filter(row => ids.has(row.sessionId)).map(row => [row.sessionId, Boolean(row.isRunning)]));
    } catch { running = {}; }
  }
  await update($, loaded, value => JSON.stringify(value.running) === JSON.stringify(running) ? value : ({ ...value, running }));
}

// This session's own activity, for the panes of every session in the same repository: whether it runs a turn and how
// many background tasks it has, renewed every 30 s, in `<git common dir>/siesta-activity/`, outside the tree. Only in
// a checkout with a Siesta configuration. The status reader's `readActivity` reads the same records.
const ACTIVITY_STALE_MS = 120_000;
const ACTIVE_AGENT = new Set(['pending', 'running', 'waiting']);
let own = null;
const mainTurns = new Set();

async function setupActivity($) {
  try {
    const cwd = await $.session.cwd();
    const found = await $.process.run(['git', 'rev-parse', '--path-format=absolute', '--show-toplevel', '--git-common-dir'], { cwd, timeoutMs: 5_000 });
    if (found.exitCode !== 0) return;
    const [top, common] = found.stdout.trim().split('\n');
    if (!top || !common || !(await $.fs.exists(`${top}/.siesta/config.yaml`))) return;
    own = { file: `${common}/siesta-activity/${cwd.replace(/[^\w.-]+/g, '_').slice(-180)}.json`, cwd, running: false, tasks: 0 };
  } catch { own = null; }
}

async function publish($, change = {}, at = new Date()) {
  if (!own) return;
  Object.assign(own, change);
  try {
    await $.fs.write(own.file, JSON.stringify({ cwd: own.cwd, running: own.running, tasks: own.tasks, at: at.toISOString() }));
  } catch { /* best effort: a pane only reads it */ }
}

async function activeAgents($) {
  try { return (await $.agent.list()).filter(agent => ACTIVE_AGENT.has(agent.status)).length; } catch { return own?.tasks ?? 0; }
}

// The workers' activity records, read every 10 s while the pane is open.
async function watchActivity($) {
  const state = await read($, loaded);
  const dir = state.status?.activityDir;
  const activity = [];
  if (dir) {
    try {
      const now = Date.now();
      const names = (await $.fs.list(dir)).filter(entry => entry.kind === 'file' && entry.name.endsWith('.json')).map(entry => entry.name);
      for (const name of names) {
        try {
          const record = JSON.parse(await $.fs.read(`${dir}/${name}`));
          if (typeof record.cwd !== 'string' || typeof record.at !== 'string') continue;
          const fresh = now - Date.parse(record.at) < ACTIVITY_STALE_MS;
          activity.push({
            cwd: record.cwd,
            state: !fresh ? 'gone' : record.running ? 'running' : 'idle',
            tasks: fresh && Number.isInteger(record.tasks) ? record.tasks : 0,
          });
        } catch { /* a record being written */ }
      }
    } catch { /* no records yet */ }
  }
  await update($, loaded, value => JSON.stringify(value.activity) === JSON.stringify(activity) ? value : ({ ...value, activity }));
}

async function refresh($) {
  const refreshId = crypto.randomUUID();
  const claim = await update($, loaded, state => state.refreshing ? state : ({ ...state, refreshing: true, refreshId, error: null }));
  if (claim.refreshId !== refreshId) return;
  try {
    const root = await $.session.cwd();
    await update($, loaded, state => ({ ...state,
      ...(root !== state.root ? { root, status: null, roadmap: null, item: null } : {}),
    }));
    const result = await $.process.run(['node', `${$.plugin.root}/skills/siesta-status/scripts/read-status.mjs`, '--root', root], { cwd: root, timeoutMs: 60_000 });
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || `Status reader exited ${result.exitCode}`);
    if (result.isStdoutTruncated) throw new Error('Status output was truncated.');
    const status = JSON.parse(result.stdout);
    if (status.schemaVersion !== 1 || !Array.isArray(status.roadmaps)) throw new Error('Unsupported status snapshot.');
    await update($, loaded, state => state.refreshId === refreshId ? ({ ...state, status, error: null }) : state);
  } catch (error) {
    await update($, loaded, state => state.refreshId === refreshId ? ({ ...state, error: String(error.message || error) }) : state);
  } finally {
    await update($, loaded, state => state.refreshId === refreshId ? ({ ...state, refreshing: false, refreshId: null }) : state);
  }
}

const watch = async $ => { await watchSessions($); await watchActivity($); };

export const register = on => {
  on('session.start', async ($, e, next) => {
    await update($, loaded, state => ({ ...state, status: null, error: null, refreshing: false, refreshId: null, root: null, item: null }));
    await setupActivity($);
    await publish($);
    $.clock.every(30_000, async () => {
      if (own) await publish($, own.running ? { tasks: await activeAgents($) } : {});
    });
    // The skill keeps its own name. Opening this pane does not call the model.
    await $.command.register({ name: 'siesta-panel', description: 'Open the Siesta roadmap status panel', immediate: true });
    $.clock.every(60_000, async () => {
      if (await isOpen($)) await refresh($);
    });
    $.clock.every(10_000, async () => {
      if (await isOpen($)) await watch($);
    });
    $.clock.every(800, async () => {
      if (!paneOpen) return;
      const state = await read($, loaded);
      const beating = Object.values(state.running).some(Boolean) || state.activity.some(item => item.state === 'running');
      if (beating) await update($, loaded, value => ({ ...value, pulse: !value.pulse }));
    });
    return next(e);
  });

  // The session's own turns; a subagent's turns carry its id and are left out.
  on('turn.start', async ($, e, next) => {
    if (!e.agentId) { mainTurns.add(e.turnId); await publish($, { running: true }); }
    return next(e);
  });
  on('turn.complete', async ($, e, next) => {
    if (mainTurns.delete(e.turnId)) await publish($, { running: false });
    return next(e);
  });
  // What the session leaves running when a turn ends: its shells, subagents and monitors.
  on('classic.Stop', async ($, e, next) => {
    await publish($, { tasks: Array.isArray(e.background_tasks) ? e.background_tasks.length : 0 });
    return next(e);
  });
  on('session.end', async ($, e, next) => {
    await publish($, { running: false, tasks: 0 }, new Date(0));
    return next(e);
  });

  on('command.run', { command: 'siesta-panel' }, async ($, e) => {
    await $.ui.open({ id: PANE, title: 'Siesta', focus: true, closeOnEscape: true });
    paneOpen = true;
    await refresh($);
    await watch($);
    if (e.args.trim()) await update($, loaded, state => ({ ...state, roadmap: e.args.trim() }));
    return {};
  });

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const state = await read($, loaded);
    return drawStatus($.ui.resolve(e), state, {
      refresh: async () => { await refresh($); await watch($); },
      select: id => update($, loaded, value => ({ ...value, roadmap: id, item: null })),
      more: () => update($, loaded, value => ({ ...value, more: !value.more })),
      item: id => update($, loaded, value => ({ ...value, item: value.item === id ? null : id })),
      language: code => update($, loaded, value => ({ ...value, language: code })),
    }, e.surface);
  });
};
