/** Add-only prepared mutations. Also embedded verbatim in the generated renderer. */
export async function addPreparedFeatures(map, input, options = {}) {
  const fail = code => { const error = new Error('Prepared map mutation failed.'); error.name = 'MapMutationError'; error.code = code; throw error; };
  const abort = () => { throw new DOMException('Prepared map mutation cancelled.', 'AbortError'); };
  const previous = map._modularMutation;
  const controller = new AbortController(); map._modularMutation = controller;
  const onAbort = () => controller.abort();
  let signal, signalListening = false, style, listening = false;
  let nativeError = false;
  const current = () => map._modularMutation === controller && !controller.signal.aborted && !map._removed && (style === undefined || map.style === style);
  const check = () => { if (!current()) abort(); };
  const addedSources = [], addedLayers = [];
  try {
    previous?.abort(); check();
    if (!options || typeof options !== 'object') fail('invalid-options');
    const optionFields = Object.getOwnPropertyDescriptors(options);
    if (Reflect.ownKeys(optionFields).some(key => key !== 'signal' || !Object.hasOwn(optionFields[key], 'value'))) fail('invalid-options');
    signal = optionFields.signal?.value;
    if (signal !== undefined) {
      const getter = Object.getOwnPropertyDescriptor(AbortSignal.prototype, 'aborted').get;
      let cancelled;
      try { cancelled = getter.call(signal); } catch { fail('invalid-options'); }
      EventTarget.prototype.addEventListener.call(signal, 'abort', onAbort, { once: true });
      signalListening = true;
      if (cancelled || getter.call(signal)) controller.abort();
    }
    check();
    let nodes = 0, text = 0;
    const plain = value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const prototype = Object.getPrototypeOf(value);
      return prototype === null || Object.getPrototypeOf(prototype) === null;
    };
    const record = value => {
      if (!plain(value)) fail('invalid-descriptor');
      const fields = Object.getOwnPropertyDescriptors(value);
      if (Reflect.ownKeys(fields).some(key => typeof key !== 'string' || !Object.hasOwn(fields[key], 'value'))) fail('invalid-descriptor');
      return fields;
    };
    const copy = (value, depth = 0, role = '') => {
      if (++nodes > 100000 || depth > 32) fail('invalid-descriptor');
      if (value === null || value === undefined || typeof value === 'boolean') return value;
      if (typeof value === 'number') { if (!Number.isFinite(value)) fail('invalid-descriptor'); return value; }
      if (typeof value === 'string') { text += value.length; if (text > 4194304) fail('invalid-descriptor'); return value; }
      if (Array.isArray(value)) {
        const fields = Object.getOwnPropertyDescriptors(value), length = fields.length.value;
        if (length > 100000 || Reflect.ownKeys(fields).length !== length + 1) fail('invalid-descriptor');
        const result = [];
        for (let index = 0; index < length; index++) {
          const entry = fields[index]; if (!entry || !Object.hasOwn(entry, 'value')) fail('invalid-descriptor');
          result.push(copy(entry.value, depth + 1));
        }
        return result;
      }
      // The renderer's worker transfer registry reads each record's constructor.
      // Preserve an ordinary prototype while defining keys without invoking setters.
      const fields = record(value), result = {};
      const set = (key, item) => Object.defineProperty(result, key, { value: item, enumerable: true, writable: true, configurable: true });
      for (const [key, entry] of Object.entries(fields)) {
        text += key.length; if (text > 4194304) fail('invalid-descriptor');
        if (role === 'source' && fields.type?.value === 'canvas' && key === 'canvas') {
          if (typeof entry.value === 'string') set(key, copy(entry.value, depth + 1));
          else {
            const getter = globalThis.HTMLCanvasElement && Object.getOwnPropertyDescriptor(globalThis.HTMLCanvasElement.prototype, 'width')?.get;
            try { if (!getter) fail('invalid-descriptor'); getter.call(entry.value); }
            catch { fail('invalid-descriptor'); }
            set(key, entry.value);
          }
        }
        else if (role === 'layer' && fields.type?.value === 'custom' &&
          ['render', 'prerender', 'onAdd', 'onRemove'].includes(key) && typeof entry.value === 'function') set(key, entry.value);
        else set(key, copy(entry.value, depth + 1));
      }
      return result;
    };
    const id = value => { if (typeof value !== 'string' || value.length === 0 || value.length > 1024) fail('invalid-descriptor'); return value; };
    const top = record(input);
    if (Object.keys(top).some(key => key !== 'sources' && key !== 'layers')) fail('invalid-descriptor');
    const sourceFields = top.sources?.value === undefined ? {} : record(top.sources.value);
    if (Object.keys(sourceFields).length > 64) fail('invalid-descriptor');
    const sources = Object.create(null);
    for (const [key, entry] of Object.entries(sourceFields)) {
      id(key); sources[key] = copy(entry.value, 0, 'source');
      if (!sources[key] || typeof sources[key].type !== 'string') fail('invalid-descriptor');
    }
    const rawLayers = top.layers?.value === undefined ? [] : top.layers.value;
    if (!Array.isArray(rawLayers)) fail('invalid-descriptor');
    const lengthField = Object.getOwnPropertyDescriptor(rawLayers, 'length');
    if (!lengthField || !Object.hasOwn(lengthField, 'value') || !Number.isInteger(lengthField.value) || lengthField.value < 0 || lengthField.value > 256) fail('invalid-descriptor');
    const length = lengthField.value;
    const arrayFields = Object.getOwnPropertyDescriptors(rawLayers), layers = [], byId = new Map();
    if (Reflect.ownKeys(arrayFields).length !== length + 1) fail('invalid-descriptor');
    for (let index = 0; index < length; index++) {
      const field = arrayFields[index]; if (!field || !Object.hasOwn(field, 'value')) fail('invalid-descriptor');
      const entry = record(field.value);
      if (Object.keys(entry).some(key => key !== 'layer' && key !== 'before')) fail('invalid-descriptor');
      const layer = copy(entry.layer?.value, 0, 'layer');
      if (!layer || typeof layer.type !== 'string') fail('invalid-descriptor');
      id(layer.id); if (byId.has(layer.id)) fail('invalid-descriptor');
      if (layer.source !== undefined) id(layer.source);
      else if (!['background', 'custom', 'sky'].includes(layer.type)) fail('missing-source');
      const before = entry.before?.value; if (before !== undefined) id(before);
      const item = { layer, before }; layers.push(item); byId.set(layer.id, item);
    }
    check(); map._lazyInitEmptyStyle?.(); check(); style = map.style;
    const validate = () => {
      for (const key of Object.keys(sources)) { if (map.getSource(key)) fail('collision'); check(); }
      for (const { layer, before } of layers) {
        if (map.getLayer(layer.id)) fail('collision'); check();
        if (layer.source !== undefined && !Object.hasOwn(sources, layer.source) && !map.getSource(layer.source)) fail('missing-source'); check();
        if (before !== undefined && !byId.has(before) && !map.getLayer(before)) fail('missing-anchor'); check();
      }
    };
    validate();
    const planOrder = () => {
      if (!layers.length) return [];
      const existing = map.getLayersOrder(); check();
      if (!Array.isArray(existing) || existing.length + layers.length > 4096) fail('invalid-descriptor');
      const names = [...existing, ...layers.map(entry => entry.layer.id)];
      const ranks = new Map(names.map((key, rank) => [id(key), rank]));
      if (ranks.size !== names.length) fail('collision');
      const outgoing = names.map(() => []), incoming = names.map(() => 0);
      const edge = (from, to) => { outgoing[from].push(to); incoming[to]++; };
      for (let index = 1; index < existing.length; index++) edge(index - 1, index);
      for (const entry of layers) {
        const rank = ranks.get(entry.layer.id);
        if (entry.before !== undefined) {
          const target = ranks.get(entry.before); if (target === undefined) fail('missing-anchor');
          edge(rank, target);
        } else if (existing.length) edge(existing.length - 1, rank);
      }
      const heap = [];
      const push = rank => {
        let index = heap.length; heap.push(rank);
        while (index > 0) { const parent = (index - 1) >> 1; if (heap[parent] <= rank) break; heap[index] = heap[parent]; index = parent; }
        heap[index] = rank;
      };
      const pop = () => {
        const first = heap[0], last = heap.pop();
        if (heap.length) {
          let index = 0;
          while (index * 2 + 1 < heap.length) {
            let child = index * 2 + 1;
            if (child + 1 < heap.length && heap[child + 1] < heap[child]) child++;
            if (last <= heap[child]) break;
            heap[index] = heap[child]; index = child;
          }
          heap[index] = last;
        }
        return first;
      };
      incoming.forEach((count, rank) => { if (!count) push(rank); });
      const result = [];
      while (heap.length) {
        const rank = pop(); result.push(names[rank]);
        for (const target of outgoing[rank]) if (--incoming[target] === 0) push(target);
      }
      if (result.length !== names.length) fail('cycle');
      return result;
    };
    planOrder();
    let detach;
    const cancelled = new Promise((_resolve, reject) => {
      const listener = () => reject(new DOMException('Prepared map mutation cancelled.', 'AbortError'));
      controller.signal.addEventListener('abort', listener, { once: true });
      detach = () => controller.signal.removeEventListener('abort', listener);
      if (controller.signal.aborted) listener();
    });
    try {
      await Promise.race([Promise.resolve().then(() => { check(); return map.prepareFeatures({ sources, layers: layers.map(entry => entry.layer) }, { signal: controller.signal }); }), cancelled]);
    } finally { detach(); }
    check(); validate();
    const order = planOrder();
    const onError = () => { nativeError = true; };
    map.on('error', onError); listening = onError;
    try {
      for (const [key, source] of Object.entries(sources)) {
        check(); addedSources.push(key); map.addSource(key, source); check();
        if (nativeError || !map.getSource(key)) fail('native-failure'); check();
      }
      let before;
      for (const key of [...order].reverse()) {
        const entry = byId.get(key);
        if (entry) {
          check(); addedLayers.push(key); map.addLayer(entry.layer, before); check();
          if (nativeError || !map.getLayer(key)) fail('native-failure'); check();
        }
        before = key;
      }
    } catch {
      if (!current()) abort();
      let rollbackFailed = false;
      const remove = (key, get, drop) => {
        check(); nativeError = false;
        try {
          const exists = get.call(map, key); check();
          if (exists) { drop.call(map, key); check(); if (get.call(map, key)) rollbackFailed = true; check(); }
          if (nativeError) rollbackFailed = true;
        } catch { check(); rollbackFailed = true; }
      };
      for (const key of [...addedLayers].reverse()) remove(key, map.getLayer, map.removeLayer);
      for (const key of [...addedSources].reverse()) remove(key, map.getSource, map.removeSource);
      check(); fail(rollbackFailed ? 'rollback-failure' : 'native-failure');
    }
    return map;
  } finally {
    try { if (listening) map.off('error', listening); }
    finally {
      try { if (signalListening) EventTarget.prototype.removeEventListener.call(signal, 'abort', onAbort); }
      finally { if (map._modularMutation === controller) map._modularMutation = undefined; }
    }
  }
}
