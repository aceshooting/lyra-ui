const invalid = () => { throw new TypeError('Invalid layer lifetime input.'); };
function field(value, key, optional = false) {
  if (!value || typeof value !== 'object') invalid();
  const property = Object.getOwnPropertyDescriptor(value, key);
  if (!property) { if (optional) return undefined; invalid(); }
  if (!Object.hasOwn(property, 'value')) invalid();
  return property.value;
}
const text = value => typeof value === 'string' && value.trim().length > 0;
const revision = value => Number.isSafeInteger(value) && value > 0;
const thenable = value => value !== null && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function';

/** Owns one synchronous custom layer and its mount epochs. */
export function createLayerLifetime(map, host, services) {
  for (const name of ['prepare', 'geographic', 'openFrame', 'withState']) {
    if (typeof services?.[name] !== 'function') invalid();
  }
  const suppliedParticipant = field(services, 'participant', true);
  let participant;
  if (suppliedParticipant !== undefined) {
    const methods = {};
    for (const name of ['factory', 'create', 'prerender', 'render', 'dispose']) {
      const method = field(suppliedParticipant, name);
      if (typeof method !== 'function') invalid();
      methods[name] = method;
    }
    participant = Object.freeze(methods);
  }
  let desired, active, serial = 0, disposed = false, visible = true;
  const notifyError = (id, code) => { try { host.onError(id, code); } catch { /* Host callbacks cannot escape native drawing. */ } };
  const live = entry => !disposed && active === entry && !host.signal.aborted && !entry.controller.signal.aborted;
  function current(entry) {
    try {
      if (!live(entry) || !host.isCurrent(entry.request) || !live(entry)) return false;
      if (!host.isStyleReady() || !live(entry)) return false;
      if (entry.installed && map.getLayer(entry.descriptor.id) !== entry.handle) return false;
      return live(entry);
    } catch { notifyError(entry.descriptor.id, 'engine'); return false; }
  }
  function state(entry, value, code) {
    const publish = () => {
      if (!current(entry)) return;
      if (value === 'ready' && !entry.completed) return;
      if (entry.state === value && entry.stateCode === code) return;
      entry.state = value; entry.stateCode = code;
      try { host.onState(entry.descriptor.id, value, code); } catch { /* Isolate host notifications. */ }
    };
    if (entry.depth) queueMicrotask(publish); else publish();
  }
  function disposeInstance(entry) {
    const owned = entry.instance;
    if (!owned || owned.disposed) return;
    owned.disposed = true;
    try {
      const contextLost = Boolean(entry.lost || entry.gl?.isContextLost?.());
      if (entry.participant) entry.participant.dispose(owned.value, Object.freeze({ contextLost }));
      else if (contextLost || !entry.gl) owned.dispose.call(owned.value);
      else services.withState(entry.gl, () => owned.dispose.call(owned.value));
    } catch { notifyError(entry.descriptor.id, 'render'); }
  }
  function finishRetirement(entry) {
    if (entry.depth) return;
    disposeInstance(entry);
    if (entry.remove) {
      entry.remove = false;
      try {
        if (entry.handle && map.getLayer(entry.descriptor.id) === entry.handle) map.removeLayer(entry.descriptor.id);
      } catch { notifyError(entry.descriptor.id, 'engine'); }
    }
    entry.gl = undefined;
  }
  function retire(entry, lost = false, remove = true) {
    if (!entry) return;
    entry.lost ||= lost;
    entry.remove ||= remove;
    entry.controller.abort(); entry.repaint = false;
    if (active === entry) active = undefined;
    if (entry.depth) {
      if (!entry.retirementQueued) {
        entry.retirementQueued = true;
        queueMicrotask(() => { entry.retirementQueued = false; finishRetirement(entry); });
      }
    } else finishRetirement(entry);
  }
  function requestRender(entry) {
    if (!visible || !current(entry) || !entry.installed || entry.repaint) return;
    entry.repaint = true;
    try { map.triggerRepaint(); } catch { entry.repaint = false; notifyError(entry.descriptor.id, 'engine'); }
  }
  function capture(value, entry) {
    if (!value || typeof value !== 'object' || thenable(value)) invalid();
    if (entry?.participant) {
      const owned = { value, disposed: false, render: entry.participant.render, prerender: entry.participant.prerender };
      entry.instance = owned;
      return owned;
    }
    const dispose = value.dispose;
    const owned = { value, dispose, disposed: false };
    if (typeof dispose === 'function' && entry) entry.instance = owned;
    const render = value.render, prerender = value.prerender;
    const items = value.items, pick = value.pick, setInteraction = value.setInteraction;
    if (typeof render !== 'function' || typeof dispose !== 'function' ||
        [prerender, items, pick, setInteraction].some(method => method !== undefined && typeof method !== 'function')) invalid();
    return Object.assign(owned, { render, prerender, items, pick, setInteraction });
  }
  function callback(entry, method, gl, args) {
    // A selected participant owns its inner guards; never recursively create or render that owner.
    if (entry.participant && entry.depth) return;
    entry.depth++;
    let lease, failed = false, completed = false;
    try {
      if (!current(entry) || !entry.installed || !visible || entry.lost) return;
      entry.repaint = false;
      if (!entry.instance) {
        const geographic = services.geographic(entry.epoch, entry.controller.signal);
        if (!current(entry)) return;
        const context = Object.freeze({
          gl: entry.gl ?? gl, signal: entry.controller.signal,
          geographic,
          requestRender: () => requestRender(entry),
          reportState: (value, code) => {
            if (['loading', 'ready', 'unavailable'].includes(value)) state(entry, value, code);
          }
        });
        const create = () => current(entry) ? entry.participant ? entry.participant.create(context) : entry.descriptor.create(context) : undefined;
        const result = entry.participant ? create() : services.withState(context.gl, create);
        if (result === undefined && !current(entry)) return;
        if (thenable(result)) {
          void Promise.resolve(result).then(value => {
            const late = { ...entry, gl: entry.lost ? undefined : context.gl, instance: undefined };
            try { late.instance = capture(value, late); } catch { /* Async factories are unsupported. */ }
            disposeInstance(late);
          }, () => undefined);
          invalid();
        }
        entry.instance = capture(result, entry);
        if (!current(entry)) return;
      }
      const work = entry.instance[method];
      lease = services.openFrame(args, entry.epoch, entry.controller.signal);
      if (!current(entry)) return;
      if (work) {
        const invoke = () => {
          if (!current(entry)) return undefined;
          if (!entry.participant) return work.call(entry.instance.value, lease.frame);
          return method === 'prerender' ? work(entry.instance.value, lease.frame, lease.terrainHook) : work(entry.instance.value, lease.frame);
        };
        const result = entry.participant ? invoke() : services.withState(entry.gl ?? gl, invoke);
        if (thenable(result)) {
          void Promise.resolve(result).catch(() => undefined);
          invalid();
        }
      }
      completed = true;
    } catch { failed = true; }
    finally {
      if (lease) { try { lease.close(); } catch { failed = true; } }
      if (failed) {
        notifyError(entry.descriptor.id, 'render'); retire(entry);
      } else if (completed && current(entry)) {
        entry.completed = true; state(entry, 'ready');
      }
      if (!current(entry)) {
        retire(entry);
      }
      entry.depth--;
    }
  }
  function admit(request) {
    const source = field(request, 'descriptor');
    const descriptor = {
      id: field(source, 'id'), label: field(source, 'label'),
      create: field(source, 'create'), before: field(source, 'before', true)
    };
    const requestRevision = field(request, 'revision'), styleRevision = field(request, 'styleRevision');
    if (!text(descriptor.id) || !text(descriptor.label) || typeof descriptor.create !== 'function' ||
        (descriptor.before !== undefined && !text(descriptor.before)) ||
        !revision(requestRevision) || !revision(styleRevision)) invalid();
    return { request, descriptor: Object.freeze(descriptor), revision: requestRevision, styleRevision };
  }
  async function install(wanted) {
    if (disposed || host.signal.aborted || desired !== wanted || !host.isCurrent(wanted.request)) return;
    retire(active);
    const entry = {
      ...wanted, epoch: ++serial, controller: new AbortController(), depth: 0,
      lost: false, installed: false, completed: false, repaint: false, remove: false,
      participant: participant?.factory === wanted.descriptor.create ? participant : undefined
    };
    active = entry;
    entry.layer = {
      id: entry.descriptor.id, type: 'custom', renderingMode: '3d',
      onAdd(_map, gl) {
        entry.depth++;
        try {
          if (!entry.adding || !current(entry)) return;
          const handle = map.getLayer(entry.descriptor.id);
          if (!handle || !current(entry) || map.getLayer(entry.descriptor.id) !== handle || !current(entry)) {
            notifyError(entry.descriptor.id, 'engine'); retire(entry); return;
          }
          entry.handle = handle; entry.gl = gl;
        } catch { notifyError(entry.descriptor.id, 'engine'); retire(entry); }
        finally { entry.depth--; }
      },
      prerender(gl, args) { callback(entry, 'prerender', gl, args); },
      render(gl, args) { callback(entry, 'render', gl, args); },
      onRemove() { entry.installed = false; retire(entry, false, false); }
    };
    state(entry, 'loading');
    if (!current(entry)) { retire(entry); return; }
    try { await services.prepare(entry.layer, entry.controller.signal); }
    catch {
      if (current(entry)) { notifyError(entry.descriptor.id, 'engine'); retire(entry); }
      return;
    }
    if (!current(entry) || desired !== wanted) { retire(entry); return; }
    if (entry.descriptor.before && !map.getLayer(entry.descriptor.before)) return;
    if (map.getLayer(entry.descriptor.id)) return;
    try {
      entry.adding = true;
      map.addLayer(entry.layer, entry.descriptor.before);
      entry.adding = false;
      if (!current(entry)) { retire(entry); return; }
      if (!entry.handle || map.getLayer(entry.descriptor.id) !== entry.handle || !current(entry)) {
        notifyError(entry.descriptor.id, 'engine'); retire(entry); return;
      }
      entry.installed = true;
    } catch { notifyError(entry.descriptor.id, 'engine'); retire(entry); }
    finally { entry.adding = false; }
  }
  const abort = () => { retire(active); };
  host.signal.addEventListener('abort', abort, { once: true });
  return Object.freeze({
    async mount(request) {
      if (disposed || host.signal.aborted) return;
      let wanted;
      try { wanted = admit(request); }
      catch {
        let id = '';
        try { const value = field(field(request, 'descriptor'), 'id'); if (typeof value === 'string') id = value; } catch { /* Invalid data has no trusted identifier. */ }
        notifyError(id, 'invalid'); return;
      }
      desired = wanted;
      await install(wanted);
    },
    async retry() { if (desired) await install(desired); },
    setVisible(value) {
      const previous = visible; visible = Boolean(value);
      if (!visible && active) active.repaint = false;
      if (visible && !previous && active) requestRender(active);
    },
    invalidate(reason) { retire(active, reason === 'context-lost'); },
    dispose() {
      if (disposed) return;
      disposed = true; desired = undefined;
      host.signal.removeEventListener('abort', abort); retire(active);
    }
  });
}
