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
      blocked: { since: '2026-11-11', reason: 'Waiting for access' }, stage: 'review round 1',
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
  on('process.run', async () => {
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
