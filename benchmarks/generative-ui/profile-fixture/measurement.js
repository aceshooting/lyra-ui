/** Browser fixture instrumentation. Rendering opportunities never certify physical paint. */
const require = (condition, message) => { if (!condition) throw new TypeError(message); };
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const aborted = () => new Error('Measurement aborted.');

function untilAbort(promise, signal) {
  if (signal.aborted) { void Promise.resolve(promise).catch(() => {}); return Promise.reject(aborted()); }
  return new Promise((resolve, reject) => {
    const finish = (callback, value) => { signal.removeEventListener('abort', stop); callback(value); };
    const stop = () => finish(reject, aborted());
    signal.addEventListener('abort', stop, { once: true });
    void Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
  });
}
function browserFrame(signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(aborted()); return; }
    const stop = () => { cancelAnimationFrame(id); reject(aborted()); };
    const id = requestAnimationFrame(() => { signal.removeEventListener('abort', stop); resolve(); });
    signal.addEventListener('abort', stop, { once: true });
  });
}
/** Bounded diagnostic data only: never retain DOM nodes, accessors or cyclic graphs. */
export function copyDiagnostic(value) {
  let remaining = 4096;
  const seen = new Set();
  const copy = (item, depth) => {
    require(remaining-- > 0 && depth <= 8, 'Diagnostic exceeds its structural bound.');
    if (item === null || item === undefined) return null;
    if (typeof item === 'boolean') return item;
    if (typeof item === 'number') { require(Number.isFinite(item), 'Nonfinite diagnostic scalar.'); return item; }
    if (typeof item === 'string') { require(item.length <= 4096, 'Diagnostic string exceeds its bound.'); return item; }
    require(typeof item === 'object' && !seen.has(item), 'Diagnostic must contain acyclic scalar data.');
    require(Array.isArray(item) || Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null, 'Diagnostic cannot retain object handles.');
    seen.add(item);
    try {
      if (Array.isArray(item)) {
        require(item.length <= 512, 'Diagnostic array exceeds its bound.');
        return Array.from({ length: item.length }, (_value, index) => {
          const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
          require(descriptor && Object.hasOwn(descriptor, 'value'), 'Diagnostic cannot invoke array accessors.');
          return copy(descriptor.value, depth + 1);
        });
      }
      const result = {};
      for (const key of Object.keys(item)) {
        require(key.length <= 128 && !['__proto__', 'constructor', 'prototype'].includes(key), 'Invalid diagnostic key.');
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        require(descriptor && Object.hasOwn(descriptor, 'value'), 'Diagnostic cannot invoke accessors.');
        result[key] = copy(descriptor.value, depth + 1);
      }
      return result;
    } finally { seen.delete(item); }
  };
  const result = copy(value, 0);
  require(JSON.stringify(result).length <= 65536, 'Diagnostic exceeds its serialized bound.');
  return result;
}
export function validateOracle(oracle, generation, fingerprint) {
  require(oracle?.generation === generation, 'Result generation is stale.');
  require(oracle.status === 'committed' && oracle.fingerprint === fingerprint, 'Expected semantic result has not committed.');
  require(oracle.connected === true && oracle.visible === true, 'Semantic result must remain connected and visible.');
}

/** Supplemental lifecycle evidence; it never replaces required-input readiness timing. */
export function createFirstMountRecorder({ generation, now = () => performance.now(), isCurrent = () => true } = {}) {
  require(typeof generation === 'string' && generation.length > 0 && typeof now === 'function' && typeof isCurrent === 'function', 'Invalid first-mount lifecycle.');
  let first = true, pending = false;
  return async (operation, run) => {
    require(!pending && isCurrent() && typeof run === 'function', 'First-mount lifecycle is stale or concurrent.');
    pending = true;
    const initial = first; first = false;
    const start = initial ? now() : undefined;
    try {
      const result = await run();
      require(isCurrent() && result?.generation === generation && result.id === operation.id, 'First-mount result is stale.');
      require(result.firstMount === undefined, 'Fixture cannot supply the shared first-mount interval.');
      if (!initial) return result;
      require([start, result.start, result.semanticCommit, result.renderOpportunity].every(finite)
        && start <= result.start && result.start <= result.semanticCommit && result.semanticCommit <= result.renderOpportunity, 'Invalid first-mount timestamp order.');
      return { ...result, firstMount: { scope: 'first-operation-lifecycle', operationId: operation.id, generation, start,
        semanticCommit: result.semanticCommit, renderOpportunity: result.renderOpportunity } };
    } finally { pending = false; }
  };
}
/**
 * Fixtures call measureOperation from runOperation. waitForCommit must pre-arm
 * public readiness/state listeners synchronously and release them on its signal.
 * onArmed notifies the external driver only after the trusted event listener exists.
 */
export function createMeasurement({ now = () => performance.now(), frame = browserFrame,
  foreground = () => document.visibilityState === 'visible', fontsReady = () => document.fonts.ready, timeoutMs = 15000 } = {}) {
  require(typeof now === 'function' && typeof frame === 'function' && typeof foreground === 'function' && typeof fontsReady === 'function'
    && finite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 120000, 'Invalid measurement environment.');
  let pending = 0;
  return {
    get pendingOperations() { return pending; },
    async measureOperation({ operation, generation, signal, trigger, event, onArmed, waitForCommit, readOracle }) {
      require(pending === 0, 'Measurements must run serially.');
      require(typeof generation === 'string' && generation.length > 0 && typeof operation?.id === 'string' && operation.id.length > 0
        && ['ready', 'interaction', 'delayed'].includes(operation.kind) && ['host', 'event'].includes(operation.trigger)
        && typeof operation.expectedFingerprint === 'string' && operation.expectedFingerprint.length > 0, 'Invalid operation identity.');
      require(typeof waitForCommit === 'function' && typeof readOracle === 'function', 'Commit wait and visible oracle are required.');
      require(foreground() === true, 'Measurement requires a foreground page.');
      const controller = new AbortController();
      const stop = () => controller.abort();
      signal?.addEventListener('abort', stop, { once: true });
      if (signal?.aborted) controller.abort();
      const timer = setTimeout(stop, timeoutMs);
      let removeEvent = () => {};
      pending++;
      try {
        if (controller.signal.aborted) throw aborted();
        await untilAbort(Promise.resolve(fontsReady({ signal: controller.signal })), controller.signal);
        require(foreground() === true, 'Measurement page became hidden while fonts settled.');
        require(readOracle().generation === generation, 'Operation generation is stale before dispatch.');
        // Invoke before dispatch so an immediately committed host update cannot be missed.
        let start, listenerReceipt = null, nativeReceiptObserved = false, acceptNativeReceipt;
        const nativeReceipt = operation.trigger === 'event' ? new Promise(resolve => { acceptNativeReceipt = resolve; }) : undefined;
        const committed = Promise.resolve(waitForCommit({ signal: controller.signal })).then(async () => {
          // An earlier fixture capture listener may commit before this target listener runs.
          if (operation.trigger === 'event' && !nativeReceiptObserved) await untilAbort(nativeReceipt, controller.signal);
          if (controller.signal.aborted) throw aborted();
          if (operation.kind === 'ready') await untilAbort(Promise.resolve(fontsReady({ signal: controller.signal })), controller.signal);
          validateOracle(readOracle(), generation, operation.expectedFingerprint);
          return now();
        });
        void committed.catch(() => {});
        // Frame opportunities follow semantic commitment, independently of driver acknowledgement.
        const endpoint = committed.then(async semanticCommit => {
          validateOracle(readOracle(), generation, operation.expectedFingerprint);
          for (let index = 0; index < 2; index++) {
            await untilAbort(frame(controller.signal), controller.signal);
            require(foreground() === true, 'Measurement page became hidden.');
            validateOracle(readOracle(), generation, operation.expectedFingerprint);
          }
          const renderOpportunity = now();
          require(finite(semanticCommit) && finite(renderOpportunity) && start <= semanticCommit
            && (listenerReceipt === null || listenerReceipt <= semanticCommit) && semanticCommit <= renderOpportunity, 'Measurement clock moved backwards.');
          return { semanticCommit, renderOpportunity };
        });
        void endpoint.catch(() => {});
        if (operation.trigger === 'event') {
          require(event?.target && typeof event.target.addEventListener === 'function' && typeof event.target.removeEventListener === 'function'
            && typeof event.type === 'string' && event.type.length > 0 && typeof onArmed === 'function' && trigger === undefined, 'Native operation needs an event target and armed bridge.');
          const received = new Promise((resolve, reject) => {
            const listener = input => {
              try {
                require(input.isTrusted === true, 'A trusted native event is required.');
                listenerReceipt = now(); start = input.timeStamp;
                require(finite(start) && finite(listenerReceipt) && start <= listenerReceipt, 'Native event uses an invalid clock origin.');
                nativeReceiptObserved = true; acceptNativeReceipt();
                removeEvent(); resolve();
              } catch (error) { removeEvent(); reject(error); }
            };
            removeEvent = () => event.target.removeEventListener(event.type, listener, true);
            event.target.addEventListener(event.type, listener, { capture: true });
          });
          void received.catch(() => {});
          // The hook must notify the driver, not wait for runOperation to finish.
          await untilAbort(Promise.resolve(onArmed({ id: operation.id, generation })), controller.signal);
          await untilAbort(received, controller.signal);
        } else {
          require(typeof trigger === 'function' && event === undefined, 'Host operation needs an explicit trigger.');
          start = now(); require(finite(start), 'Host timestamp is invalid.');
          await untilAbort(Promise.resolve(trigger({ signal: controller.signal })), controller.signal);
        }
        const { semanticCommit, renderOpportunity } = await untilAbort(endpoint, controller.signal);
        validateOracle(readOracle(), generation, operation.expectedFingerprint);
        return { ...operation, generation, fingerprint: operation.expectedFingerprint, start, listenerReceipt, semanticCommit, renderOpportunity, censored: false };
      } finally {
        removeEvent(); clearTimeout(timer); signal?.removeEventListener('abort', stop); controller.abort(); pending--;
      }
    },
  };
}

/** Raw windows include interactions; positive-control qualification is supplied separately. */
export function createObserverWindow({ Observer = globalThis.PerformanceObserver, now = () => performance.now() } = {}) {
  let state = 'new', phase = 'mount', started, ended;
  const observers = [], longTasks = [], layoutShifts = [], phases = [];
  const supported = type => Array.isArray(Observer?.supportedEntryTypes) && Observer.supportedEntryTypes.includes(type);
  const capabilities = { longtask: supported('longtask'), layoutShift: supported('layout-shift') };
  const collect = (type, entries) => {
    for (const entry of entries) {
      if (!finite(entry.startTime)) throw new TypeError('Observer returned an invalid timestamp.');
      if (type === 'longtask') longTasks.push({ startTime: entry.startTime, duration: entry.duration });
      else layoutShifts.push({ startTime: entry.startTime, value: entry.value, hadRecentInput: entry.hadRecentInput,
        sources: Array.from(entry.sources ?? [], source => ({ previousRect: copyRect(source.previousRect), currentRect: copyRect(source.currentRect) })) });
    }
  };
  const drain = () => { for (const [observer, type] of observers) collect(type, observer.takeRecords()); };
  const disconnect = () => { for (const [observer] of observers) observer.disconnect(); };
  return {
    supported: Object.freeze(capabilities),
    start() {
      require(state === 'new', 'Observer window can only start once.'); started = now(); require(finite(started), 'Invalid observer start.'); state = 'active'; phases.push({ name: phase, start: started });
      try {
        for (const type of ['longtask', 'layout-shift']) if (supported(type)) {
          const observer = new Observer(list => collect(type, list.getEntries()));
          observers.push([observer, type]); observer.observe({ type, buffered: true });
        }
      } catch (error) { disconnect(); state = 'failed'; throw error; }
    },
    phase(next) { require(state === 'active' && typeof next === 'string' && next.length > 0, 'Invalid observer phase.'); drain(); const at = now(); require(finite(at) && at >= phases.at(-1).start, 'Invalid phase timestamp.'); phase = next; phases.push({ name: phase, start: at }); },
    finish() {
      require(state === 'active', 'Observer window is not active.');
      try { drain(); ended = now(); require(finite(ended) && ended >= started, 'Invalid observer end.'); }
      finally { disconnect(); state = 'closed'; }
      const attribution = entry => ({ ...entry, phase: phases.findLast(item => item.start <= entry.startTime)?.name ?? 'spanning-start',
        spansPhases: phases.filter(item => item.start > entry.startTime && item.start < entry.startTime + (entry.duration ?? 0)).map(item => item.name) });
      return {
        window: { start: started, end: ended, phases },
        longTasks: capabilities.longtask ? longTasks.filter(entry => entry.startTime <= ended && entry.startTime + entry.duration >= started).sort((a, b) => a.startTime - b.startTime).map(attribution) : null,
        layoutShifts: capabilities.layoutShift ? layoutShifts.filter(entry => entry.startTime >= started && entry.startTime <= ended).sort((a, b) => a.startTime - b.startTime).map(attribution) : null,
      };
    },
    dispose() { disconnect(); state = 'closed'; },
  };
}
function copyRect(rect) {
  if (!rect) return null;
  return Object.fromEntries(['x', 'y', 'width', 'height'].map(key => [key, rect[key]]));
}
