const RESOURCE_METHODS = [
  ['createBuffer', 'deleteBuffer'], ['createFramebuffer', 'deleteFramebuffer'],
  ['createProgram', 'deleteProgram'], ['createQuery', 'deleteQuery'],
  ['createRenderbuffer', 'deleteRenderbuffer'], ['createSampler', 'deleteSampler'],
  ['createShader', 'deleteShader'], ['createTexture', 'deleteTexture'],
  ['createTransformFeedback', 'deleteTransformFeedback'], ['createVertexArray', 'deleteVertexArray'],
  ['fenceSync', 'deleteSync'],
] as const;

type NativeMethod = (this: unknown, ...args: unknown[]) => unknown;

/**
 * Native context loss destroys all of that context's objects. Some renderer caches retain their
 * handles until ordinary resource disposal. Make that later deletion a no-op only for handles
 * this context already destroyed; unknown/current handles and borrowed receivers reach WebGL.
 */
export function guardContextEpoch(context: WebGL2RenderingContext): () => void {
  const methods = context as unknown as Record<string, NativeMethod>;
  const restores: Array<() => void> = [];
  let epoch = 0; let lost = context.isContextLost(); let active = true;
  const onLost = () => { if (!lost && context.isContextLost()) { lost = true; epoch++; } };
  const onRestored = () => { if (!context.isContextLost()) lost = false; };
  const restore = () => {
    if (!active) return;
    active = false;
    context.canvas.removeEventListener('webglcontextlost', onLost);
    context.canvas.removeEventListener('webglcontextrestored', onRestored);
    for (const undo of restores.reverse()) undo();
  };
  const replace = (name: string, wrapped: NativeMethod) => {
    const descriptor = Object.getOwnPropertyDescriptor(context, name);
    Object.defineProperty(context, name, { configurable: true, writable: true, enumerable: descriptor?.enumerable ?? true, value: wrapped });
    restores.push(() => {
      if (methods[name] !== wrapped) return;
      if (descriptor) Object.defineProperty(context, name, descriptor); else Reflect.deleteProperty(context, name);
    });
  };
  try {
    for (const [createName, deleteName] of RESOURCE_METHODS) {
      const create = methods[createName]; const remove = methods[deleteName];
      if (typeof create !== 'function' || typeof remove !== 'function') continue;
      const handles = new WeakMap<object, number>();
      replace(createName, function (...args) {
        const value: unknown = Reflect.apply(create, this, args);
        if (active && this === context && value !== null && typeof value === 'object') handles.set(value, epoch);
        return value;
      });
      replace(deleteName, function (...args) {
        const handle = args[0];
        if (active && this === context && handle !== null && typeof handle === 'object') {
          const created = handles.get(handle);
          if (created !== undefined && created < epoch) return;
        }
        return Reflect.apply(remove, this, args);
      });
    }
    context.canvas.addEventListener('webglcontextlost', onLost);
    context.canvas.addEventListener('webglcontextrestored', onRestored);
  } catch (error) { restore(); throw error; }
  return restore;
}
