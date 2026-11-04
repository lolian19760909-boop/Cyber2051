import { graphic } from '../recipes/graphic.mjs';
import { interfaceRecipe } from '../recipes/interface.mjs';

const result = status => ({ status });

export function createMotion({ settings = () => ({ enabled: true, reducedMotion: false }) } = {}) {
  const scopes = new Set();
  const roots = new WeakMap();
  let destroyed = false;

  function mount(root, { reducedMotion = () => false, profile = () => ({}), keyboard = () => false } = {}) {
    if (destroyed) throw new Error('Tavern Motion has been disposed.');
    if (!root?.ownerDocument || typeof root.contains !== 'function') throw new TypeError('A DOM element or ShadowRoot is required.');
    if (roots.has(root)) throw new Error('This root already has a motion scope.');
    const view = root.ownerDocument.defaultView;
    const media = view.matchMedia?.('(prefers-reduced-motion: reduce)');
    const entries = new Set();
    const pages = new Set();
    const panels = new Map();
    const channels = new WeakMap();
    const transitions = new Map();
    const presences = new Map();
    const timings = [];
    let completed = 0, interrupted = 0;
    let disposed = false;
    const reduced = () => disposed || settings().enabled === false || settings().reducedMotion === true || media?.matches || reducedMotion();
    const instant = () => reduced() || keyboard() || profile().level === 'low' || view.document?.hidden;
    const recipe = () => interfaceRecipe(profile());
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
          if (status === 'completed') completed++; else interrupted++;
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
      if (group === entries) for (const task of [...transitions.values()]) task.finish('cancelled');
    }

    function play(element, frames, options, group = pages) {
      if (!owns(element)) return Promise.resolve(result('cancelled'));
      if (instant() || typeof element.animate !== 'function') return Promise.resolve(result('completed'));
      return track(element, frames, options, group).finished;
    }

    // A channel replaces only the same operation on this element. Sample its visible
    // position before calling this function when retargeting an interrupted motion.
    function channel(element, key, frames, options = {}, settled = () => {}) {
      if (!owns(element)) { settled('cancelled'); return Promise.resolve(result('cancelled')); }
      let slots = channels.get(element);
      if (!slots) channels.set(element, slots = new Map());
      slots.get(key)?.settle('superseded');
      if (instant() || typeof element.animate !== 'function') { settled('completed'); return Promise.resolve(result('completed')); }
      const r = recipe();
      const entry = track(element, frames, { duration: r.duration, easing: r.ease, ...options }, null, status => {
        if (slots.get(key) === entry) slots.delete(key);
        settled(status);
      });
      slots.set(key, entry);
      return entry.finished;
    }

    function visual(element) {
      const style = view.getComputedStyle(element);
      return { opacity: style.opacity, transform: style.transform === 'none' ? 'none' : style.transform };
    }

    function capture(element) {
      if(!element || !owns(element))return null;
      const box=element.getBoundingClientRect(), state=visual(element);
      // The frozen layout must not count an in-flight translation twice.
      let x=0,y=0;
      if(state.transform!=='none' && view.DOMMatrixReadOnly){const m=new view.DOMMatrixReadOnly(state.transform);if(m.is2D&&m.a===1&&m.b===0&&m.c===0&&m.d===1){x=m.e;y=m.f;}}
      return {element,box:{left:box.left-x,top:box.top-y,width:box.width,height:box.height},visual:state};
    }

    function saveStyle(element, properties) {
      const values = properties.map(key => [key, element.style.getPropertyValue(key), element.style.getPropertyPriority(key)]);
      return () => { for (const [key, value, priority] of values) value ? element.style.setProperty(key, value, priority) : element.style.removeProperty(key); };
    }

    // Presence commits hidden only when the latest exit completes. Reopening samples
    // the in-flight frame, so it does not jump back to the entrance keyframe.
    function presence(element, visible, { origin, distance = 8, from } = {}) {
      if (!owns(element)) return Promise.resolve(result('cancelled'));
      const previous = presences.get(element), hidden = element.hidden;
      if (previous?.visible === visible) return previous.finished;
      if (!previous && hidden && !visible && !from?.box.width) return Promise.resolve(result('completed'));
      const start = from?.box.width ? from.visual : !hidden && (previous || !visible) ? visual(element) : null;
      const token = { visible, inert: previous?.inert ?? element.inert, base:previous?.base||visual(element), restore: previous?.restore || saveStyle(element, ['transform-origin']) };
      presences.set(element, token);
      element.hidden = false;
      if (origin) element.style.transformOrigin = origin;
      const end = { opacity: 0, transform: `${token.base.transform==='none'?'':token.base.transform+' '}translateY(${distance}px) scale(.985)` };
      element.inert = visible ? token.inert : true;
      token.finished = channel(element, 'presence', [start || end, visible ? token.base : end], { duration: visible ? recipe().duration : recipe().exit }, status => {
        if (presences.get(element) !== token) return;
        token.restore();
        element.hidden = !visible;
        element.inert = token.inert;
        presences.delete(element);
      });
      return token.finished;
    }

    // Call capture(previous) before changing route visibility. The old and new live
    // pages overlap for the transition; no cloned inputs, media, or iframe documents.
    function navigate(previous, next, { from = capture(previous), direction = 1, container = next?.parentElement } = {}) {
      if (!owns(next) || !container) return Promise.resolve(result('cancelled'));
      const start = channels.get(next)?.has('navigate') ? visual(next) : null;
      transitions.get(container)?.finish('superseded');
      if (previous === next || !previous || !owns(previous) || instant() || !from?.box?.width) {
        if (previous && previous !== next) previous.hidden = true;
        next.hidden = false;
        return Promise.resolve(result('completed'));
      }
      const restoreOld = saveStyle(previous, ['position','left','top','width','height','margin','z-index','pointer-events']);
      const restoreContainer = saveStyle(container, ['position']);
      const inert = previous.inert, box = container.getBoundingClientRect(), r = recipe();
      let done = false, resolve;
      const finished = new Promise(value => { resolve = value; });
      const task = { finish(status = 'completed') {
        if (done) return; done = true;
        if (transitions.get(container) === task) transitions.delete(container);
        channels.get(previous)?.get('navigate')?.settle(status);
        channels.get(next)?.get('navigate')?.settle(status);
        restoreOld(); restoreContainer(); previous.inert = inert;
        previous.hidden = previous !== next; next.hidden = false;
        resolve(result(status));
      } };
      transitions.set(container, task);
      if (view.getComputedStyle(container).position === 'static') container.style.position = 'relative';
      Object.assign(previous.style, { position:'absolute', left:from.box.left-box.left+container.scrollLeft+'px', top:from.box.top-box.top+container.scrollTop+'px', width:from.box.width+'px', height:from.box.height+'px', margin:'0', zIndex:'1', pointerEvents:'none' });
      previous.hidden = false; previous.inert = true; next.hidden = false;
      const begin = view.performance?.now() || 0;
      // 旧页退出结束就提交隐藏：entry.settle() 会 cancel() 掉动画并把透明度弹回元素自身的 1，
      // 若等两条通道都结束才统一隐藏，这段时间里旧页会重新压住新页（隔空复显）。
      // 只认"这一过渡仍然拥有容器"的完成回调；被替代／取消／销毁时不隐藏，交给 task.finish 收尾。
      const retireOld = status => {
        if (status !== 'completed') return;
        if (transitions.get(container) !== task) return;
        previous.hidden = true;
      };
      Promise.all([
        channel(previous, 'navigate', [from.visual, { opacity:0, transform:`translateX(${-Math.sign(direction)*r.distance}px)` }], {duration:r.exit}, retireOld),
        channel(next, 'navigate', [start || r.entry(direction)[0], {opacity:1,transform:'none'}]),
      ]).then(values => {
        if (done) return;
        timings.push((view.performance?.now() || begin)-begin); if(timings.length>60)timings.shift();
        task.finish(values.every(v=>v.status==='completed')?'completed':'cancelled');
      });
      return finished;
    }

    // Keep outgoing text/art briefly while a synchronous local render replaces it.
    // Media and frames retain their own lifecycle and are never cloned/restarted.
    function update(container, mutate, { direction = 1 } = {}) {
      if (!owns(container)) { mutate(); return Promise.resolve(result('cancelled')); }
      const start = channels.get(container)?.has('update') ? visual(container) : null;
      transitions.get(container)?.finish('superseded');
      let ghost = null, restore = () => {}, alignSnapshot = () => {}, done = false;
      const nodes = [...container.querySelectorAll('*')];
      if (container !== root && !instant() && container.getBoundingClientRect().width && nodes.length < 64 && ![container,...nodes].some(n=>n.shadowRoot || n.matches('iframe,canvas,video,audio,dialog,input,textarea,select,script'))) {
        // A closed shadow tree keeps display-only copies out of application queries.
        // Bound both style reads and retained nodes; larger/stateful views just enter.
        const copy=container.cloneNode(true), copies=[copy,...copy.querySelectorAll('*')];
        const styles=[container,...nodes].map(node=>{const computed=view.getComputedStyle(node);return [...computed].map(key=>key+':'+computed.getPropertyValue(key)+';').join('');});
        copies.forEach((node,i)=>{node.removeAttribute('id');node.removeAttribute('autofocus');for(const attr of [...node.attributes])if(attr.name.startsWith('on'))node.removeAttribute(attr.name);node.style.cssText=styles[i];node.style.animation='none';node.style.transition='none';});
        ghost=root.ownerDocument.createElement('div');
        ghost.attachShadow({mode:'closed'}).append(copy);
        ghost.setAttribute('aria-hidden','true'); ghost.inert=true;
        const b=container.getBoundingClientRect(), p=container.parentElement, pb=p.getBoundingClientRect();
        restore=saveStyle(p,['position']); if(view.getComputedStyle(p).position==='static')p.style.position='relative';
        Object.assign(ghost.style,{position:'absolute',left:b.left-pb.left+p.scrollLeft+'px',top:b.top-pb.top+p.scrollTop+'px',width:b.width+'px',height:b.height+'px',margin:'0',pointerEvents:'none',zIndex:'2',overflow:'hidden'});
        Object.assign(copy.style,{position:'relative',inset:'auto',margin:'0',transform:'none',width:b.width+'px',height:b.height+'px',boxSizing:'border-box'});
        const scrolls=[container,...nodes].map(node=>[node.scrollLeft,node.scrollTop]);
        alignSnapshot=()=>copies.forEach((node,i)=>{[node.scrollLeft,node.scrollTop]=scrolls[i];});
      }
      const finish = (status='completed') => { if(done)return;done=true;channels.get(container)?.get('update')?.settle(status);if(ghost)channels.get(ghost)?.get('update')?.settle(status);ghost?.remove();restore();if(transitions.get(container)?.finish===finish)transitions.delete(container); };
      try { mutate(); } catch(error) { finish(); throw error; }
      if(ghost){container.parentElement.append(ghost);alignSnapshot();}
      transitions.set(container,{finish});
      const r=recipe(), incoming=channel(container,'update',[start || r.entry(direction)[0],r.entry(direction)[1]]);
      // Ghost is owned by the same scope but never catches focus or input.
      // 旧副本的退场同样要在"自己退出完成"时立刻收起来：settle() 里的 cancel() 会让它弹回不透明，
      // 而它 z-index 高于新内容，等待入场结束再统一清理就会出现旧画面复显。
      const retireGhost = status => {
        if (status !== 'completed' || !ghost) return;
        if (transitions.get(container)?.finish !== finish) return;
        ghost.style.display = 'none';
      };
      const outgoing=ghost?channel(ghost,'update',[{opacity:1},{opacity:0}],{duration:r.exit},retireGhost):Promise.resolve(result('completed'));
      return Promise.all([incoming,outgoing]).then(values=>{finish();return result(values.every(v=>v.status==='completed')?'completed':'cancelled');});
    }

    function feedback(element, kind = 'press') {
      const frames = kind === 'success' ? [{opacity:.55},{opacity:1}] : [{transform:'scale(.975)'},{transform:'none'}];
      return channel(element,'feedback',frames,{duration:kind==='success'?180:120});
    }

    function rows(container, candidates = container.querySelectorAll('[data-motion-row]')) {
      if (!owns(container) || instant()) return;
      const viewport = container.getBoundingClientRect();
      const visible = [];
      for (const row of candidates) {
        if (!container.contains(row)) continue;
        const rect = row.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || rect.bottom <= viewport.top || rect.top >= viewport.bottom) continue;
        visible.push(row);
        if (visible.length === graphic.rowLimit) break;
      }
      visible.forEach((row, count) => { void play(row, graphic.row, { duration: graphic.rowDuration, delay: count * graphic.rowDelay, fill: 'backwards' }); });
    }
    function layout(candidates, mutate, options = {}) {
      const elements = [...new Set(candidates)].filter(owns);
      const before = elements.map(element => element.getBoundingClientRect());
      for(const element of elements)channels.get(element)?.get('layout')?.settle('superseded');
      mutate(); // Author applies final DOM state once, synchronously.
      const after = elements.map(element => ({ box: element.getBoundingClientRect(), transform: view.getComputedStyle(element).transform }));
      return Promise.all(elements.map((element, i) => {
        const a = before[i], b = after[i].box, end = after[i].transform === 'none' ? '' : after[i].transform;
        if (!a.width || !a.height || !b.width || !b.height) return result('completed');
        return channel(element, 'layout', [
          { transformOrigin: '0 0', transform: `translate(${a.left-b.left}px,${a.top-b.top}px) scale(${a.width/b.width},${a.height/b.height}) ${end}` },
          { transformOrigin: '0 0', transform: end || 'none' },
        ], { duration: 240, ...options });
      }));
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
      for (const task of [...transitions.values()]) task.finish('completed');
    }

    const onMedia = () => { if (reduced()) finish(); };
    media?.addEventListener('change', onMedia);
    const onHidden=()=>{if(view.document?.hidden)finish();};
    view.document?.addEventListener('visibilitychange',onHidden);
    const scope = {
      open: element => setOpen(element, true),
      close: element => setOpen(element, false),
      switchPage, rows, cancel, finish, layout, capture, navigate, presence, update, feedback,
      animate: (element, frames, options = {}) => options.channel ? channel(element,options.channel,frames,options) : play(element, frames, { duration: 240, ...options }),
      diagnostics: () => ({ active: entries.size, panels: panels.size, transitions:transitions.size, completed, interrupted, recentDurations:[...timings], disposed }),
      dispose() {
        if (disposed) return;
        disposed = true;
        cancel();
        media?.removeEventListener('change', onMedia);
        view.document?.removeEventListener('visibilitychange',onHidden);
        panels.clear();
        presences.clear();
        roots.delete(root);
        scopes.delete(scope);
      },
    };
    roots.set(root, scope);
    scopes.add(scope);
    return scope;
  }

  return Object.freeze({
    api: 1, version: '0.2.0', features: Object.freeze(['navigation','presence','content-transition','channels','layout']), recipe: graphic.id, mount,
    refresh() { for (const scope of scopes) scope.finish(); },
    diagnostics: () => ({ scopes: scopes.size, active: [...scopes].reduce((sum, scope) => sum + scope.diagnostics().active, 0), destroyed }),
    dispose() { if (destroyed) return; destroyed = true; for (const scope of [...scopes]) scope.dispose(); },
  });
}
