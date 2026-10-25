/** Feature preparation operations, embedded in the generated renderer with explicit dependencies. */
export function createPreparationRuntime({
  derefLayers,
  MessageType,
  prepareStyleLayers,
  prepareSources,
  prepareDraws,
  prepareShaders,
  prepareUniforms,
  prepareProjection,
  prepareSymbols,
  prepareTerrain,
  validateStyleAndEmit,
  snapshotFeatureRequirements
}) {
  function snapshotStyle(value) {
    if (Array.isArray(value)) return value.map(snapshotStyle);
    if (value && typeof value === 'object') {
      const prototype = Object.getPrototypeOf(value);
      if (prototype === null || Object.getPrototypeOf(prototype) === null)
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, snapshotStyle(item)]));
    }
    return value;
  }

  async function prepareReplacement(style, json, options, controller) {
    const previous = options.transformStyle ? style.serialize() : undefined;
    const state = snapshotStyle(options.transformStyle ? options.transformStyle(previous, json) : json);
    if ((options.validate ?? true) && validateStyleAndEmit(style, state)) return;
    await prepareTransaction(style, state, controller);
    return state;
  }

  async function prepareMapFeatures(map, requirements, options = {}) {
    options.signal?.throwIfAborted();
    map._lazyInitEmptyStyle();
    const style = map.style;
    const state = snapshotFeatureRequirements(requirements);
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    if (options.signal?.aborted) abort();
    (style._modularFeaturePreparations ??= new Set()).add(controller);
    try {
      await abortable(Promise.resolve(style._modularReady), controller.signal);
      await prepareTransaction(style, state, controller);
      if (map.style !== style || map._removed)
        throw new DOMException('Map removed or style replaced', 'AbortError');
    } finally {
      options.signal?.removeEventListener('abort', abort);
      style._modularFeaturePreparations.delete(controller);
    }
  }

  function beginPreparation(style) {
    style._modularPreparation?.abort();
    return style._modularPreparation = new AbortController();
  }

  async function abortable(promise, signal) {
    signal.throwIfAborted();
    let listener;
    try {
      return await Promise.race([
        promise,
        new Promise((_, reject) => {
          listener = () => reject(new DOMException('Style preparation aborted', 'AbortError'));
          signal.addEventListener('abort', listener, { once: true });
        })
      ]);
    } finally {
      signal.removeEventListener('abort', listener);
    }
  }

  async function prepareTransaction(style, state, controller) {
    try {
      const signal = controller.signal;
      await abortable(prepareStyle(state), signal);
      const actors = await abortable(style.dispatcher.actorsPromise, signal);
      signal.throwIfAborted();
      await Promise.all(actors.map(actor => actor.sendAsync({
        type: MessageType.prepareFeatures,
        data: {
          layers: derefLayers(state.layers).map(layer => ({ type: layer.type })),
          sources: Object.values(state.sources).map(s => s.type)
        }
      }, controller)));
      signal.throwIfAborted();
    } catch (error) {
      if (error?.name !== 'AbortError' && error instanceof Error) error.modularPreparationFailure = true;
      throw error;
    }
  }

  async function prepareStyle(style) {
    const layers = derefLayers(style.layers ?? []);
    const types = [...new Set(layers.map(l => l.type))];
    const programs = [...types, 'debug', 'sky'];
    if (types.includes('line') || types.includes('fill')) programs.push('layer-opacity');
    const projection = style.projection?.type ?? 'mercator';
    if (projection !== 'mercator') programs.push('globe');
    if (style.terrain) programs.push('terrain');
    await Promise.all([
      prepareStyleLayers(layers),
      prepareSources(Object.values(style.sources ?? {}).map(s => s.type)),
      prepareDraws(types),
      prepareShaders(programs),
      prepareUniforms(programs),
      prepareProjection(projection),
      types.includes('symbol') ? prepareSymbols() : undefined,
      style.terrain ? prepareTerrain() : undefined
    ]);
  }

  return { snapshotStyle, prepareReplacement, prepareMapFeatures, beginPreparation, prepareTransaction, prepareStyle };
}
