import { atom, read, update } from 'claude-code';
import { drawStatus } from './view.mjs';

const PANE = 'siesta-pulse';
const loaded = atom({ plugin: 'siesta', key: 'pulse' }, {
  status: null, error: null, refreshing: false, refreshId: null, root: null,
  roadmap: null, more: false, item: null, language: null, running: {}, pulse: false,
}, { shape: 'siesta-pulse-2' });

// Whether the pane is open, as the last check found it: the beat runs only then.
let paneOpen = false;
const isOpen = async $ => (paneOpen = (await $.ui.panes()).some(pane => pane.id === PANE));

// Which workers' sessions are running a turn. Claude Desktop says so through its session server; elsewhere nothing
// answers, and no card beats.
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

export const register = on => {
  on('session.start', async ($, e, next) => {
    await update($, loaded, state => ({ ...state, status: null, error: null, refreshing: false, refreshId: null, root: null, item: null }));
    // The skill keeps its own name. Opening this pane does not call the model.
    await $.command.register({ name: 'siesta-panel', description: 'Open the Siesta roadmap status panel', immediate: true });
    $.clock.every(60_000, async () => {
      if (await isOpen($)) await refresh($);
    });
    $.clock.every(10_000, async () => {
      if (await isOpen($)) await watchSessions($);
    });
    $.clock.every(800, async () => {
      if (!paneOpen) return;
      const state = await read($, loaded);
      if (Object.values(state.running).some(Boolean)) await update($, loaded, value => ({ ...value, pulse: !value.pulse }));
    });
    return next(e);
  });

  on('command.run', { command: 'siesta-panel' }, async ($, e) => {
    await $.ui.open({ id: PANE, title: 'Siesta', focus: true, closeOnEscape: true });
    paneOpen = true;
    await refresh($);
    await watchSessions($);
    if (e.args.trim()) await update($, loaded, state => ({ ...state, roadmap: e.args.trim() }));
    return {};
  });

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const state = await read($, loaded);
    return drawStatus($.ui.resolve(e), state, {
      refresh: async () => { await refresh($); await watchSessions($); },
      select: id => update($, loaded, value => ({ ...value, roadmap: id, item: null })),
      more: () => update($, loaded, value => ({ ...value, more: !value.more })),
      item: id => update($, loaded, value => ({ ...value, item: value.item === id ? null : id })),
      language: code => update($, loaded, value => ({ ...value, language: code })),
    }, e.surface);
  });
};
