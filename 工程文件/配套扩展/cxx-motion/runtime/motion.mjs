import { graphic } from '../recipes/graphic.mjs';

const result = status => ({ status });

export function createMotion({ settings = () => ({ enabled: true, reducedMotion: false }) } = {}) {
  const scopes = new Set();
  const roots = new WeakMap();
  let destroyed = false;

  function mount(root, { reducedMotion = () => false } = {}) {
    if (destroyed) throw new Error('Tavern Motion has been disposed.');
    if (!root?.ownerDocument || typeof root.contains !== 'function') throw new TypeError('A DOM element or ShadowRoot is required.');
    if (roots.has(root)) throw new Error('This root already has a motion scope.');
    const view = root.ownerDocument.defaultView;
    const media = view.matchMedia?.('(prefers-reduced-motion: reduce)');
    const entries = new Set();
    const pages = new Set();
    const panels = new Map();
    let disposed = false;
    const reduced = () => disposed || settings().enabled === false || settings().reducedMotion === true || media?.matches || reducedMotion();
    const owns = element => !disposed && element && (root === element || root.contains(element));

    function track(element, frames, options, group = null, onSettle = () => {}) {
      let resolve;
      const finished = new Promise(done => { resolve = done; });
      const animation = element.animate(frames, { easing: graphic.ease, ...options });
      let settled = false;
      const entry = {
        animation, finished,
        settle(status) {
          if (settled) return;
          settled = true;
          entries.delete(entry);
          group?.delete(entry);
          animation.onfinish = animation.oncancel = null;
          animation.cancel();
          onSettle(status);
          resolve(result(status));
        },
      };
      entries.add(entry);
      group?.add(entry);
      animation.finished.catch(() => {});
      animation.onfinish = () => entry.settle('completed');
      animation.oncancel = () => entry.settle('cancelled');
      return entry;
    }

    function cancel(group = entries) {
      for (const entry of [...group]) entry.settle('cancelled');
    }

    function play(element, frames, options, group = pages) {
      if (!owns(element)) return Promise.resolve(result('cancelled'));
      if (reduced() || typeof element.animate !== 'function') return Promise.resolve(result('completed'));
      return track(element, frames, options, group).finished;
    }

    function rows(container, candidates = container.querySelectorAll('[data-motion-row]')) {
      if (!owns(container) || reduced()) return;
      const viewport = container.getBoundingClientRect();
      let count = 0;
      for (const row of candidates) {
        if (!container.contains(row)) continue;
        const rect = row.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || rect.bottom <= viewport.top || rect.top >= viewport.bottom) continue;
        void play(row, graphic.row, { duration: graphic.rowDuration, delay: count * graphic.rowDelay, fill: 'backwards' });
        if (++count === graphic.rowLimit) break;
      }
    }

    function setOpen(element, open) {
      if (!owns(element)) return Promise.resolve(result('cancelled'));
      let state = panels.get(element);
      if (!state) {
        state = { desired: !open, entry: null, resolve: null, finished: null };
        panels.set(element, state);
      }
      if (state.desired === open) return state.finished || Promise.resolve(result('completed'));
      state.resolve?.(result('superseded'));
      state.desired = open;
      state.finished = new Promise(resolve => { state.resolve = resolve; });
      const finished = state.finished;
      if (reduced() || typeof element.animate !== 'function') {
        state.entry?.settle('completed');
        state.resolve?.(result('completed'));
        state.resolve = state.finished = null;
        return finished;
      }
      if (!state.entry) {
        const entry = track(element, graphic.panel, { duration: graphic.panelDuration, fill: 'both' }, null, status => {
          state.entry = null;
          if (status !== 'completed') state.desired = undefined;
          state.resolve?.(result(status));
          state.resolve = state.finished = null;
        });
        state.entry = entry;
        entry.animation.pause();
        entry.animation.currentTime = open ? 0 : graphic.panelDuration;
      }
      state.entry.animation.playbackRate = open ? 1 : -1;
      state.entry.animation.play();
      return finished;
    }

    function switchPage(previous, next, { direction = 1, items } = {}) {
      if (!owns(next) || !owns(previous)) return Promise.resolve(result('cancelled'));
      const style = view.getComputedStyle(previous);
      const start = { opacity: style.opacity, transform: style.transform, clipPath: style.clipPath };
      cancel(pages);
      const outgoing = play(previous, [start, { opacity: 0, transform: `translateX(${-Math.sign(direction || 1) * 14}px)` }], { duration: graphic.pageDuration });
      const incoming = play(next, graphic.page(direction), { duration: graphic.pageDuration });
      rows(next, items);
      return Promise.all([outgoing, incoming]).then(values => result(values.every(value => value.status === 'completed') ? 'completed' : 'cancelled'));
    }

    function finish() {
      for (const entry of [...entries]) entry.settle('completed');
    }

    const onMedia = () => { if (reduced()) finish(); };
    media?.addEventListener('change', onMedia);
    const scope = {
      open: element => setOpen(element, true),
      close: element => setOpen(element, false),
      switchPage, rows, cancel, finish,
      diagnostics: () => ({ active: entries.size, panels: panels.size, disposed }),
      dispose() {
        if (disposed) return;
        disposed = true;
        cancel();
        media?.removeEventListener('change', onMedia);
        panels.clear();
        roots.delete(root);
        scopes.delete(scope);
      },
    };
    roots.set(root, scope);
    scopes.add(scope);
    return scope;
  }

  return Object.freeze({
    api: 1, version: '0.1.0', recipe: graphic.id, mount,
    refresh() { for (const scope of scopes) scope.finish(); },
    diagnostics: () => ({ scopes: scopes.size, active: [...scopes].reduce((sum, scope) => sum + scope.diagnostics().active, 0), destroyed }),
    dispose() { if (destroyed) return; destroyed = true; for (const scope of [...scopes]) scope.dispose(); },
  });
}
