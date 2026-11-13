// Native Claude elements, not React or a browser DOM. No build step or dependencies.
const words = {
  en: {
    pulse: 'Pulse', refresh: 'Refresh', refreshing: 'Refreshing…', loading: 'Reading Siesta…',
    noRoadmap: 'No roadmap on the integration branch.', missingRoadmap: 'The requested roadmap was not found.',
    epics: 'epics delivered', questions: 'Questions', hypotheses: 'Hypotheses', reviews: 'Recorded reviews', capacity: 'Assigned',
    needs: 'Needs you', noCheckpoint: 'Checkpoint unavailable at the configured path.', noQuestions: 'No open questions in the checkpoint.',
    active: 'In progress', noActive: 'No active epics recorded.', phases: 'Phases', criteria: 'criteria', tasks: 'tasks',
    noCriteria: 'No checkable criteria', noTasks: 'No checkable tasks', pendingMerge: 'Completed on worker branch · awaiting integration',
    blocker: 'Blocked', details: 'Details', ready: 'Ready in the record', noReady: 'No ready epics recorded.',
    sources: 'Sources', warnings: 'Data to check', local: 'Local refs · no fetch',
    stale: 'Refresh failed. Last successful snapshot shown.', error: 'Could not read Siesta',
    all: 'All roadmaps; includes paused and blocked assignments.', pm: 'Coordinator record', checkpoint: 'Checkpoint',
    delivered: 'Delivered since', noneDelivered: 'No new deliveries.', closedOne: 'closed', closedMany: 'closed', working: 'working',
  },
  es: {
    pulse: 'Pulso', refresh: 'Actualizar', refreshing: 'Actualizando…', loading: 'Leyendo Siesta…',
    noRoadmap: 'No hay roadmaps en la rama de integración.', missingRoadmap: 'No se encontró el roadmap solicitado.',
    epics: 'épicas entregadas', questions: 'Preguntas', hypotheses: 'Hipótesis', reviews: 'Revisiones registradas', capacity: 'Asignadas',
    needs: 'Te necesita', noCheckpoint: 'No hay checkpoint disponible en la ruta configurada.', noQuestions: 'Sin preguntas abiertas en el checkpoint.',
    active: 'En curso', noActive: 'No hay épicas activas registradas.', phases: 'Fases', criteria: 'criterios', tasks: 'tareas',
    noCriteria: 'Sin criterios verificables marcados', noTasks: 'Sin tareas verificables marcadas', pendingMerge: 'Terminada en su rama · pendiente de integración',
    blocker: 'Bloqueada', details: 'Detalles', ready: 'Listas según el registro', noReady: 'No hay épicas listas registradas.',
    sources: 'Fuentes', warnings: 'Datos que revisar', local: 'Refs locales · sin fetch',
    stale: 'Falló la actualización. Se muestra la última lectura correcta.', error: 'No se pudo leer Siesta',
    all: 'Todos los roadmaps; incluye asignaciones en pausa y bloqueadas.', pm: 'Registro del coordinador', checkpoint: 'Checkpoint',
    delivered: 'Entregado desde', noneDelivered: 'Sin nuevas entregas.', closedOne: 'cerrada', closedMany: 'cerradas', working: 'trabajando',
  },
};

// An SVG is drawn as an image, outside the theme: mid tones that read on a light and a dark pane alike. Claude's clay
// for work under way, a green for what is done, an amber for what waits on someone.
const INK = { track: 'rgba(127,127,127,.22)', clay: '#D97757', done: '#4E9A6A', late: '#C98A1B', muted: '#8C8C8C' };
const fraction = (done, total) => total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
const svg = (width, height, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">${body}</svg>`;
export function meterSvg(done, total, height = 6) {
  return svg(1000, height, `<rect width="1000" height="${height}" fill="${INK.track}"/><rect width="${(fraction(done, total) * 1000).toFixed(1)}" height="${height}" fill="${INK.clay}"/>`);
}
// The phases as one strip: a segment per phase, as wide as its share of the epics, filled by what it delivered.
export function phaseStripSvg(phases, height = 6) {
  const total = phases.reduce((sum, phase) => sum + phase.total, 0);
  if (total <= 0) return meterSvg(0, 0, height);
  let x = 0;
  return svg(1000, height, phases.map(phase => {
    const width = phase.total / total * 1000;
    const inner = Math.max(0, width - 6);
    const filled = inner * fraction(phase.completed, phase.total);
    const at = x.toFixed(1);
    x += width;
    return `<rect x="${at}" width="${inner.toFixed(1)}" height="${height}" fill="${INK.track}"/>`
      + `<rect x="${at}" width="${filled.toFixed(1)}" height="${height}" fill="${phase.status === 'completed' ? INK.done : INK.clay}"/>`;
  }).join(''));
}
// The figures' icons: line drawings on a 24-unit grid. The terminal, which draws no SVG, gets a glyph.
const ICONS = {
  questions: ['?', '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.6.3-1 .8-1 1.5v.5"/><path d="M12 16.9v.1"/>'],
  hypotheses: ['◇', '<path d="M9.5 17.5h5"/><path d="M10.5 20.5h3"/><path d="M12 3.5a5.8 5.8 0 0 0-3.4 10.5c.6.5.9 1.1.9 1.8v.2h5v-.2c0-.7.3-1.3.9-1.8A5.8 5.8 0 0 0 12 3.5z"/>'],
  reviews: ['◎', '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.4-4.4"/>'],
  capacity: ['▦', '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>'],
};
const stroke = (color, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const REFRESH = '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4.5h-4.5"/>';
// The refresh arrow turning while the reader runs, in the refresh button's place.
const SPINNER = stroke(INK.muted, `<g>${REFRESH}<animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.9s" repeatCount="indefinite"/></g>`);

export function drawStatus(elements, state, actions, surface) {
  const { Box, Text, Button, Link } = elements;
  const Svg = surface === 'terminal' ? null : elements.Svg;
  const status = state.status;
  const language = state.language || (status?.language?.startsWith('es') ? 'es' : 'en');
  const t = words[language] || words.en;
  const text = (value, props = {}) => Text({ ...props, children: [String(value)] });
  const column = (children, props = {}) => Box({ flexDirection: 'column', gap: 'sm', ...props, children: children.filter(Boolean) });
  const row = (children, props = {}) => Box({ flexDirection: 'row', flexWrap: 'wrap', gap: 'sm', ...props, children: children.filter(Boolean) });
  const heading = value => text(value, { weight: 'semibold', dimColor: true });
  const button = (key, label, onPress, props = {}) => Button({ key, label, onPress, ...props });
  const blocks = (done, total, width) => {
    const filled = Math.round(fraction(done, total) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
  };
  const meter = (key, count, label, height = 6) => Svg
    ? Svg({ key, source: meterSvg(count.done, count.total, height), alt: `${count.done}/${count.total} ${label}`, height })
    : text(blocks(count.done, count.total, 20), { key, mono: true, color: 'claude' });

  const refresh = state.refreshing
    ? (Svg ? Box({ key: 'refreshing', children: [Svg({ source: SPINNER, alt: t.refreshing, width: 18, height: 18, isInteractive: true })] }) : text('…', { key: 'refreshing', dimColor: true }))
    : button('refresh', '↻', actions.refresh, { plain: true });
  const controls = row([
    button('language', language === 'es' ? 'EN' : 'ES', () => actions.language(language === 'es' ? 'en' : 'es'), { plain: true }),
    refresh,
  ], { alignItems: 'center', flexWrap: 'nowrap' });
  const header = title => row([text(title, { size: 'title', weight: 'bold' }), controls], { justifyContent: 'space-between', alignItems: 'center', flexWrap: 'nowrap' });
  const error = state.error && column([
    text(status ? t.stale : t.error, { color: 'warning', weight: 'semibold' }), text(state.error, { size: 'footnote' }),
  ], { key: 'error', gap: 'xs' });
  if (!status) return column([header('Siesta'), error || text(t.loading, { dimColor: true })]);

  const roadmap = status.roadmaps.find(item => item.id === state.roadmap) || status.roadmaps.find(item => item.status !== 'completed') || status.roadmaps[0];
  const selector = status.roadmaps.length > 1 && row(status.roadmaps.map(item => button(`roadmap-${item.id}`, item.id === roadmap?.id ? `● ${item.title}` : item.title, () => actions.select(item.id), { plain: true })));
  const sources = text(`${status.repo} · ${status.source.ref} @ ${status.source.commit.slice(0, 7)}\n${t.local} · ${status.generatedAt.replace('T', ' ').replace(/\.\d+Z$/, ' UTC')}`, { key: 'source', size: 'caption', dimColor: true });
  if (!roadmap) return column([header('Siesta'), error, sources, text(t.noRoadmap)]);
  const checkpoint = status.checkpoint;
  const reviews = roadmap.active.filter(epic => /review|revisi[oó]n|recheck/i.test(epic.stage || ''));

  // A figure: its icon and its value, every tile the same width, the label kept as the icon's alt.
  const tile = (key, label, value, ink, color) => row([
    Svg ? Svg({ source: stroke(ink, ICONS[key][1]), alt: label, width: 18, height: 18 }) : text(ICONS[key][0], { color, dimColor: !color }),
    text(value, { size: 'heading', weight: 'semibold', tabular: true, color }),
  ], { key, alignItems: 'center', flexWrap: 'nowrap', width: '24%', flexGrow: 0, flexShrink: 0, paddingX: 'sm', paddingY: 'xs', borderStyle: 'round', borderColor: 'subtle' });
  const asked = checkpoint.questions.length;
  const full = status.capacity.used >= status.capacity.max;
  const tiles = row([
    tile('questions', t.questions, checkpoint.available ? asked : '—', asked ? INK.late : INK.done, asked ? 'warning' : 'success'),
    tile('hypotheses', t.hypotheses, checkpoint.available ? checkpoint.hypotheses.length : '—', INK.muted),
    tile('reviews', t.reviews, reviews.length, INK.muted),
    tile('capacity', t.capacity, `${status.capacity.used}/${status.capacity.max}`, full ? INK.clay : INK.muted, status.capacity.used > status.capacity.max ? 'warning' : undefined),
  ], { justifyContent: 'space-between', flexWrap: 'nowrap' });

  const checkpointItem = item => column([
    button(item.id, `${state.item === item.id ? '▾' : '▸'} ${item.id} · ${item.title}`, () => actions.item(item.id), { plain: true }),
    state.item === item.id && text(item.detail, { size: 'footnote' }),
  ], { key: `item-${item.id}`, gap: 'xs' });

  // An epic is measured as `status.progress` says: by its criteria, by its plan's tasks, or, `mixed`, by its tasks with
  // its criteria counted beside them.
  const epicCard = epic => {
    const byTasks = status.progress !== 'criteria';
    const [count, label, empty] = byTasks ? [epic.tasks, t.tasks, t.noTasks] : [epic.criteria, t.criteria, t.noCriteria];
    const other = status.progress === 'mixed' ? ` · ${epic.criteria?.total ? `${epic.criteria.done}/${epic.criteria.total} ${t.criteria}` : t.noCriteria}` : '';
    const where = state.more ? epic.readFrom : epic.readFrom.startsWith('worktree:') ? 'local' : epic.readFrom;
    // A worker whose session is running a turn: its card's border beats in clay, and it says so.
    const working = Boolean(epic.session && state.running?.[epic.session]);
    return column([
      row([
        text(epic.title, { weight: 'semibold' }),
        row([
          working && text(`● ${t.working}`, { size: 'caption', color: 'claude' }),
          text(where, { size: 'caption', dimColor: true }),
        ], { alignItems: 'center' }),
      ], { justifyContent: 'space-between', alignItems: 'center' }),
      row([
        text(count?.total ? `${count.done}/${count.total} ${label}` : empty, { size: 'footnote', dimColor: true, tabular: true }),
        other && text(other.slice(3), { size: 'footnote', dimColor: true, tabular: true }),
      ]),
      count?.total > 0 && meter(`progress-${epic.id}`, count, label, 4),
      epic.statusOnBranch === 'completed' && text(t.pendingMerge, { size: 'caption', dimColor: true }),
      epic.blocked && text(`${t.blocker}${epic.blocked.since ? ` · ${epic.blocked.since}` : ''}: ${typeof epic.blocked === 'string' ? epic.blocked : epic.blocked.reason || '—'}`, { color: 'warning', size: 'footnote' }),
      epic.stage && text(epic.stage, { size: 'footnote', dimColor: true }),
      ...epic.delivery.map((url, i) => Link({ key: `delivery-${epic.id}-${i}`, href: url, children: [`↗ ${url.replace(/^https?:\/\/(www\.)?github\.com\//, '')}`] })),
    ], { key: epic.id, paddingX: 'sm', paddingY: 'xs', borderStyle: 'round', borderColor: working && !state.pulse ? 'claude' : 'subtle', gap: 'xs' });
  };

  const openPhases = Svg ? roadmap.phases.filter(phase => phase.status !== 'completed') : roadmap.phases;
  const closedPhases = roadmap.phases.filter(phase => phase.status === 'completed');
  const phases = roadmap.phases.length > 0 && column([
    heading(t.phases),
    Svg && Svg({ key: 'phases', source: phaseStripSvg(roadmap.phases), alt: roadmap.phases.map(phase => `${phase.title} ${phase.completed}/${phase.total}`).join(', '), height: 6 }),
    ...openPhases.map(phase => row([
      text(`${Svg ? '' : `${blocks(phase.completed, phase.total, 10)} `}${phase.title}`, { size: 'footnote', wrap: 'truncate-end', dimColor: phase.status === 'completed' }),
      text(`${phase.completed}/${phase.total}`, { size: 'footnote', dimColor: true, tabular: true }),
    ], { key: `phase-${phase.slug}`, justifyContent: 'space-between', flexWrap: 'nowrap' })),
    Svg && closedPhases.length > 0 && text(`${closedPhases.length} ${closedPhases.length === 1 ? t.closedOne : t.closedMany}: ${closedPhases.map(phase => phase.title).join(', ')}`, { size: 'caption', dimColor: true }),
  ], { gap: 'xs' });

  const questions = state.more ? checkpoint.questions : checkpoint.questions.slice(0, 3);
  return column([
    header(roadmap.title), error, selector,
    state.roadmap && !status.roadmaps.some(item => item.id === state.roadmap) && text(t.missingRoadmap, { color: 'warning' }),
    column([
      meter('roadmap-progress', { done: roadmap.completed, total: roadmap.total }, t.epics),
      text(`${roadmap.completed}/${roadmap.total} ${t.epics}`, { key: 'roadmap-count', size: 'footnote', dimColor: true, tabular: true }),
    ], { gap: 'xs' }),
    tiles,
    column([
      heading(t.active), ...roadmap.active.map(epicCard), !roadmap.active.length && text(t.noActive, { dimColor: true }),
    ]),
    phases,
    column([
      heading(t.needs),
      !checkpoint.available ? text(t.noCheckpoint, { color: 'warning' }) : questions.length ? column(questions.map(checkpointItem), { gap: 'xs' }) : text(t.noQuestions, { dimColor: true }),
      !state.more && asked > 3 && button('all-questions', `+${asked - 3} · ${t.questions}`, actions.more, { plain: true }),
    ], { gap: 'xs' }),
    status.baseline && roadmap.delivered && column([
      heading(`${t.delivered} ${status.baseline.at.slice(0, 16).replace('T', ' ')} UTC`),
      ...roadmap.delivered.map(epic => column([
        text(epic.title, { size: 'footnote' }),
        ...epic.delivery.map(url => Link({ href: url, children: [url] })),
      ], { gap: 'xs' })),
      !roadmap.delivered.length && text(t.noneDelivered, { dimColor: true }),
    ], { gap: 'xs' }),
    status.warnings.length > 0 && text(`${t.warnings}: ${status.warnings.length} · ${status.warnings[0]}`, { key: 'warnings', color: 'warning', size: 'footnote' }),
    button('more', `${state.more ? '▾' : '▸'} ${t.details} · ${checkpoint.hypotheses.length} ${t.hypotheses.toLowerCase()} · ${roadmap.ready.length} ${t.ready.toLowerCase()}`, actions.more, { plain: true }),
    state.more && column([
      heading(t.hypotheses), ...checkpoint.hypotheses.map(checkpointItem),
      heading(t.ready), ...roadmap.ready.map(epic => text(epic.title, { key: `ready-${epic.id}`, size: 'footnote' })), !roadmap.ready.length && text(t.noReady, { dimColor: true }),
      heading(t.sources), sources, text(t.all, { size: 'footnote', dimColor: true }),
      text(`${t.checkpoint}: ${checkpoint.path}\n${checkpoint.modifiedAt || '—'}`, { size: 'caption', dimColor: true }),
      ...status.pmSources.map(source => text(`${t.pm}: ${source.path}\n${source.modifiedAt}`, { size: 'caption', dimColor: true })),
      ...status.warnings.slice(1).map((warning, i) => text(warning, { key: `warning-${i}`, color: 'warning', size: 'footnote' })),
    ], { gap: 'xs' }),
  ], { gap: 'lg' });
}
