import { test, expect, mock } from 'claude-code/testing';

const status = {
  schemaVersion: 1, generatedAt: '2026-11-12T12:00:00Z', repo: 'example/project', language: 'es',
  source: { ref: 'origin/main', commit: '1234567890', fetched: false }, progress: 'mixed',
  capacity: { used: 1, max: 2 }, warnings: [], pmSources: [],
  checkpoint: { available: true, path: '/project/.siesta/checkpoint.md', modifiedAt: null,
    questions: [{ id: 'Q-7', title: 'Elegir el índice', detail: 'Q-7: aprobar el índice. Espera: búsqueda.' }], hypotheses: [] },
  roadmaps: [{ id: 'base', title: 'Base', status: 'accepted', total: 3, completed: 1, ready: [],
    phases: [{ slug: 'foundation', title: 'Foundation', status: 'accepted', total: 3, completed: 1, criteria: { done: 0, total: 1 } }],
    active: [{ id: 'search', title: 'Search', status: 'active', statusOnBranch: 'completed',
      criteria: { done: 2, total: 2 }, tasks: { done: 3, total: 4 },
      blocked: { since: '2026-11-11', reason: 'Waiting for access' }, stage: { key: 'review', round: 1, detail: null, from: 'log' },
      readFrom: 'feat/search', delivery: ['https://example.com/pull/7'] }],
  }, { id: 'second', title: 'Second', status: 'proposed', total: 0, completed: 0, ready: [], active: [], phases: [] }],
};
const props = { title: 'Siesta', isFocused: true, bodyColumns: 52, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} };

test('panel renders and responds on every surface, without a model turn', async ($, on) => {
  let calls = 0;
  on('session.cwd', async () => ({ value: '/project' }));
  on('process.run', async (_$, e) => {
    calls++;
    expect(e.argv[0]).toBe('node');
    expect(e.argv[2]).toBe('--root');
    return { value: { stdout: JSON.stringify(status), stderr: '', exitCode: 0, isStdoutTruncated: false, isStderrTruncated: false } };
  });
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'siesta', surface, component: 'Pane', requestId: 'siesta-pulse', props });
    await ui.press({ key: 'refresh' });
    expect(await ui.find({ type: 'Text', text: '1/3 épicas entregadas' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: '3/4 tareas' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'Search (revisión ronda 1)' })).toBeDefined();
    if (surface === 'terminal' && !await ui.find({ type: 'Text', text: /█+░+/ })) throw new Error('terminal meter missing');
    if (surface === 'desktop' && !await ui.find({ type: 'Svg' })) throw new Error('desktop SVG missing');
    expect(await ui.find({ type: 'Text', text: /pendiente de integración/ })).toBeDefined();
    await ui.press({ key: 'Q-7' });
    expect(await ui.find({ type: 'Text', text: /aprobar el índice/ })).toBeDefined();
    await ui.press({ key: 'more' });
    expect(await ui.find({ type: 'Text', text: 'feat/search' })).toBeDefined();
    await ui.press({ key: 'more' });
    await ui.press({ key: 'roadmap-second' });
    expect(await ui.find({ type: 'Text', text: '0/0 épicas entregadas' })).toBeDefined();
    await ui.press({ key: 'roadmap-base' });
    await ui.press({ key: 'language' });
    expect(await ui.find({ type: 'Text', text: '1/3 epics delivered' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'Search (review round 1)' })).toBeDefined();
    await ui.press({ key: 'language' });
    await ui.unmount();
  }
  expect(calls).toBe(4);
});

test('command opens the selected roadmap; polling stops when the pane is closed', async ($, on) => {
  const clock = mock.clock(on);
  let opened = false;
  let calls = 0;
  on('session.cwd', async () => ({ value: '/project' }));
  on('session.start', async (_$, e) => ({ cwd: e.cwd }));
  on('command.register', async (_$, e) => {
    expect(e.name).toBe('siesta-panel');
    expect(e.immediate).toBe(true);
    return { value: { command: e.name } };
  });
  on('ui.open', async (_$, e) => {
    expect(e.id).toBe('siesta-pulse');
    opened = true;
    return { value: { isPlaced: true } };
  });
  on('ui.panes', async () => ({ value: opened ? [{ id: 'siesta-pulse', title: 'Siesta', isShown: true, isFocused: true, isPlaced: true }] : [] }));
  on('process.run', async (_$, e) => {
    // The session's start asks git where its activity goes; here, outside a repository.
    if (e.argv[0] === 'git') return { value: { stdout: '', stderr: 'not a git repository', exitCode: 128, isStdoutTruncated: false, isStderrTruncated: false } };
    calls++;
    return { value: { stdout: JSON.stringify(status), stderr: '', exitCode: 0, isStdoutTruncated: false, isStderrTruncated: false } };
  });
  await $.session.start({ cwd: '/project', surface: 'desktop', isInteractive: true });
  await clock.advance(60_000);
  expect(calls).toBe(0);
  expect(await $.command.run({ command: 'siesta-panel', args: 'second' })).toEqual({});
  expect(calls).toBe(1);
  const ui = await $.ui.mount({ plugin: 'siesta', surface: 'desktop', component: 'Pane', requestId: 'siesta-pulse', props });
  expect(await ui.find({ type: 'Text', text: '0/0 épicas entregadas' })).toBeDefined();
  await clock.advance(60_000);
  expect(calls).toBe(2);
  opened = false;
  await clock.advance(120_000);
  expect(calls).toBe(2);
  await ui.unmount();
});

test('refresh failures retain the last snapshot and expose the error', async ($, on) => {
  let calls = 0;
  on('session.cwd', async () => ({ value: '/project' }));
  on('process.run', async () => {
    calls++;
    return { value: calls === 1
      ? { stdout: JSON.stringify(status), stderr: '', exitCode: 0, isStdoutTruncated: false, isStderrTruncated: false }
      : { stdout: '', stderr: 'node unavailable', exitCode: 1, isStdoutTruncated: false, isStderrTruncated: false } };
  });
  const ui = await $.ui.mount({ plugin: 'siesta', surface: 'desktop', component: 'Pane', requestId: 'siesta-pulse', props });
  await ui.press({ key: 'refresh' });
  await ui.press({ key: 'refresh' });
  expect(await ui.find({ type: 'Text', text: /última lectura correcta/ })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: '1/3 épicas entregadas' })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: 'node unavailable' })).toBeDefined();
  await ui.unmount();
});

test('a worker whose session runs a turn is marked working', async ($, on) => {
  const working = structuredClone(status);
  working.roadmaps[0].active[0].session = 'local_worker';
  on('session.cwd', async () => ({ value: '/project' }));
  on('process.run', async () => ({ value: { stdout: JSON.stringify(working), stderr: '', exitCode: 0, isStdoutTruncated: false, isStderrTruncated: false } }));
  on('mcp.call', async (_$, e) => {
    expect(e.server).toBe('ccd_session_mgmt');
    return { value: { content: [{ type: 'text', text: JSON.stringify([{ sessionId: 'local_worker', isRunning: true }]) }], isError: false } };
  });
  const ui = await $.ui.mount({ plugin: 'siesta', surface: 'desktop', component: 'Pane', requestId: 'siesta-pulse', props });
  await ui.press({ key: 'refresh' });
  expect(await ui.find({ type: 'Text', text: /trabajando/ })).toBeDefined();
  await ui.unmount();
});

test('the session writes its activity: a turn running, then idle', async ($, on) => {
  const written: string[] = [];
  mock.clock(on);
  on('session.start', async (_$, e) => ({ cwd: e.cwd }));
  on('command.register', async (_$, e) => ({ value: { command: e.name } }));
  on('turn.start', async (_$, e) => ({ turnId: e.turnId }));
  on('turn.complete', async (_$, e) => ({ text: e.text }));
  on('session.cwd', async () => ({ value: '/project/worktree' }));
  on('process.run', async (_$, e) => e.argv[0] === 'git'
    ? { value: { stdout: '/project/worktree\n/project/.git\n', stderr: '', exitCode: 0, isStdoutTruncated: false, isStderrTruncated: false } }
    : { value: { stdout: JSON.stringify(status), stderr: '', exitCode: 0, isStdoutTruncated: false, isStderrTruncated: false } });
  on('fs.exists', async (_$, e) => ({ value: e.path === '/project/worktree/.siesta/config.yaml' }));
  on('fs.write', async (_$, e) => {
    expect(e.path).toBe('/project/.git/siesta-activity/_project_worktree.json');
    written.push(e.text);
    return { value: undefined };
  });
  await $.session.start({ cwd: '/project/worktree', surface: 'desktop', isInteractive: true });
  expect(JSON.parse(written.at(-1)!)).toMatchObject({ cwd: '/project/worktree', running: false, tasks: 0 });
  await $.turn.start({ text: 'go', turnId: 't1' });
  expect(JSON.parse(written.at(-1)!).running).toBe(true);
  await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', text: 'done' });
  expect(JSON.parse(written.at(-1)!).running).toBe(false);
});

test('a worker that runs a turn with background tasks shows them; a stale record is a session gone', async ($, on) => {
  const withWorktree = structuredClone(status);
  Object.assign(withWorktree, { activityDir: '/project/.git/siesta-activity' });
  withWorktree.roadmaps[0].active.push({ ...structuredClone(withWorktree.roadmaps[0].active[0]), id: 'old', title: 'Old', worktree: '/w/old' });
  Object.assign(withWorktree.roadmaps[0].active[0], { worktree: '/w/search' });
  const now = new Date().toISOString();
  const records = {
    'search.json': { cwd: '/w/search', running: true, tasks: 3, at: now },
    'old.json': { cwd: '/w/old', running: true, tasks: 2, at: '2026-01-01T00:00:00Z' },
  };
  on('session.cwd', async () => ({ value: '/project' }));
  on('process.run', async () => ({ value: { stdout: JSON.stringify(withWorktree), stderr: '', exitCode: 0, isStdoutTruncated: false, isStderrTruncated: false } }));
  on('mcp.call', async () => ({ value: { content: [{ type: 'text', text: '[]' }], isError: false } }));
  on('fs.list', async () => ({ value: Object.keys(records).map(name => ({ name, kind: 'file', size: 1, mtimeMs: 0, isLink: false })) }));
  on('fs.read', async (_$, e) => ({ value: JSON.stringify(records[e.path.split('/').at(-1)]) }));
  const ui = await $.ui.mount({ plugin: 'siesta', surface: 'desktop', component: 'Pane', requestId: 'siesta-pulse', props });
  await ui.press({ key: 'refresh' });
  expect(await ui.find({ type: 'Text', text: 'trabajando' })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: '3 tareas' })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: 'sin sesión' })).toBeDefined();
  expect(await ui.find({ type: 'Text', text: '2 tareas' })).toBeUndefined();
  expect(await ui.find({ type: 'Text', text: '1/2' })).toBeDefined();
  await ui.unmount();
});

test('each epic shows its stage after its title; a blocked one keeps its stage and its dot turns amber', async ($, on) => {
  const staged = structuredClone(status);
  const first = staged.roadmaps[0].active[0];
  staged.roadmaps[0].active.push(
    { ...structuredClone(first), id: 'human', title: 'Index', blocked: null, stage: { key: 'human', round: null, detail: 'Q-7', from: 'log' } },
    { ...structuredClone(first), id: 'ready', title: 'Docs', blocked: null, stage: { key: 'ready', round: 2, detail: null, from: 'reviews' } },
    { ...structuredClone(first), id: 'free', title: 'Notes', blocked: null, stage: null, stageRecorded: 'Something else' },
    { ...structuredClone(first), id: 'paused', title: 'Billing', blocked: null, session: 'local_billing', stage: { key: 'paused', round: null, detail: 'waits for pricing', from: 'log' } },
  );
  first.stage = { key: 'fixing', round: 2, detail: null, from: 'reviews' };
  on('session.cwd', async () => ({ value: '/project' }));
  on('process.run', async () => ({ value: { stdout: JSON.stringify(staged), stderr: '', exitCode: 0, isStdoutTruncated: false, isStderrTruncated: false } }));
  on('mcp.call', async () => ({ value: { content: [{ type: 'text', text: JSON.stringify([{ sessionId: 'local_billing', isRunning: true }]) }], isError: false } }));
  const tall = { ...props, scroll: { offset: 0, bodyRows: 400 } };
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'siesta', surface, component: 'Pane', requestId: 'siesta-pulse', props: tall });
    await ui.press({ key: 'refresh' });
    expect(await ui.find({ type: 'Text', text: 'Search (corrigiendo ronda 2)' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'Index (espera al humano)' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'Q-7' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'Docs (lista para merge)' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'Notes (Something else)' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'Billing (en pausa)' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'waits for pricing' })).toBeDefined();
    if (surface === 'desktop') {
      const dot = (await ui.findAll({ type: 'Svg' })).find(node => /bloqueada/.test(node.props?.alt ?? ''));
      if (!dot || !String(dot.props?.source ?? dot.source ?? '').includes('#C98A1B')) throw new Error('blocked dot is not amber');
      const pausedDot = (await ui.findAll({ type: 'Svg' })).find(node => node.props?.alt === 'en pausa');
      if (!pausedDot || !String(pausedDot.props.source).includes('#8C8C8C') || /animate/.test(pausedDot.props.source)) throw new Error('paused dot is not muted');
    } else if (!(await ui.findAll({ type: 'Text', text: '●' })).some(node => node.props?.color === 'warning')) throw new Error('blocked dot is not amber in the terminal');
    await ui.press({ key: 'language' });
    expect(await ui.find({ type: 'Text', text: 'Search (fixing round 2)' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'Index (waits for the human)' })).toBeDefined();
    expect(await ui.find({ type: 'Text', text: 'Billing (paused)' })).toBeDefined();
    await ui.press({ key: 'language' });
    await ui.unmount();
  }
});
