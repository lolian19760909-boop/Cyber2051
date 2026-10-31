// Synthetic S0 probe only. Not a released card component or production extension.
const ctx = () => SillyTavern.getContext();
const promptId = 'cxx-context-s0-summary';
const state = { config: {}, traces: [], ready: [], order: [] };
function clearPrompt() { ctx().setExtensionPrompt(promptId, '', 1, 0, false, 0); }
function configure(config) {
  clearPrompt();
  state.config = config;
  state.traces = [];
  state.ready = [];
  state.order = [];
}
function worldinfo(payload) {
  state.order.push('worldinfo');
  for (const key of ['globalLore', 'characterLore', 'chatLore', 'personaLore']) {
    const rows = payload[key];
    if (!Array.isArray(rows)) continue;
    // This host reads the original arrays after the event. Keep their identity.
    const kept = rows.filter(row => !state.config.hiddenWorldIds?.includes(`${row.world}:${row.uid}`));
    rows.splice(0, rows.length, ...kept);
  }
}
function finalPrompt(payload) {
  state.order.push('prompt-ready');
  state.ready.push(structuredClone(payload));
  if (state.config.replaceFinalProperty) payload.chat = [{ role: 'system', content: 'S0_REPLACEMENT_PROPERTY' }];
}
function finished() { clearPrompt(); }
globalThis.CxxContextS0_intercept = async function (rows, contextSize, abort, type) {
  state.order.push('interceptor');
  clearPrompt();
  if (!['normal', 'regenerate', 'swipe', 'continue', undefined].includes(type)) return;
  const live = ctx().chat;
  const mapped = rows.map(row => {
    // Fixtures deliberately assign stable identities. Production migration is not implemented here.
    const id = row.extra?.cxx_s0_id;
    const matches = live.map((source, floor) => ({ source, floor })).filter(x => id && x.source.extra?.cxx_s0_id === id);
    if (matches.length !== 1) return { id: id ?? null, valid: false, index: row.index };
    const { source, floor } = matches[0];
    return { id, valid: true, floor, index: row.index, swipe: source.swipe_id ?? 0,
      sourceText: source.mes, requestText: row.mes, sameExtraReference: source.extra === row.extra };
  });
  const trace = { type, contextSize, mapped, before: rows.length, after: rows.length, aborted: false };
  state.traces.push(trace);
  if (mapped.some(row => !row.valid)) { trace.aborted = true; abort(true); return; }
  const drop = new Set(state.config.dropIds || []);
  const kept = rows.filter(row => !drop.has(row.extra.cxx_s0_id));
  rows.splice(0, rows.length, ...kept);
  trace.after = rows.length;
  if (state.config.summary) ctx().setExtensionPrompt(promptId, state.config.summary, 1, 0, false, 0);
};
const bindings = [
  [ctx().eventTypes.WORLDINFO_ENTRIES_LOADED, worldinfo],
  [ctx().eventTypes.CHAT_COMPLETION_PROMPT_READY, finalPrompt],
  [ctx().eventTypes.GENERATION_ENDED, finished],
  [ctx().eventTypes.GENERATION_STOPPED, finished],
  [ctx().eventTypes.CHAT_CHANGED, finished],
];
for (const [event, callback] of bindings) ctx().eventSource.on(event, callback);
globalThis.CxxContextS0 = { state, configure };
export function clean() {
  clearPrompt();
  for (const [event, callback] of bindings) ctx().eventSource.removeListener(event, callback);
  delete globalThis.CxxContextS0_intercept;
  delete globalThis.CxxContextS0;
}
