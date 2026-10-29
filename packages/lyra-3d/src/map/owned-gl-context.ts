export type GlHandleKind = 'buffer' | 'texture' | 'sampler' | 'shader' | 'program' | 'vao' | 'framebuffer' | 'renderbuffer' | 'query' | 'sync' | 'transform-feedback';
export interface ThreePaintTarget {
  readonly draw: WebGLFramebuffer | null; readonly read: WebGLFramebuffer | null;
  readonly width: number; readonly height: number;
  readonly viewport: readonly [number, number, number, number]; readonly scissor: readonly [number, number, number, number];
  readonly scissorTest: boolean; readonly drawBuffers: readonly number[]; readonly readBuffer: number;
  readonly depthRange: readonly [number, number]; readonly depthFunc: number;
  readonly outputPolicy: 'default-srgb' | 'offscreen-linear-verified' | 'unsupported';
}
export interface ThreeGlEntry { readonly epoch: number; readonly target: ThreePaintTarget; isCurrent(): boolean }
interface Lease { release(): void }
export interface OwnedGlBudget {
  reserveHandle(kind: GlHandleKind): Lease;
  reservePayload(request: Readonly<{ kind: 'texture'; key: string; pool: 'gpu-texture'; width: number; height: number; layers: number; faces: number; bytesPerPixel: number; mipLevels: number }>): Lease;
}
export interface GlHandleSnapshot {
  readonly releaseFailures: number; readonly live: Readonly<Record<GlHandleKind, number>>; readonly created: Readonly<Record<GlHandleKind, number>>;
  readonly deleted: Readonly<Record<GlHandleKind, number>>; readonly invalidatedByLoss: Readonly<Record<GlHandleKind, number>>;
}
export interface OwnedGlEpoch {
  readonly handles: GlHandleSnapshot;
  run<T>(entry: ThreeGlEntry, work: (gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) => T): T;
  sweep(): void; retire(): void; lose(): void;
  assertCurrent(): void;
  retireAfterLoss(cleanups: readonly (() => void)[]): Readonly<{ failed: number }>;
}
const kinds: readonly GlHandleKind[] = ['buffer', 'texture', 'sampler', 'shader', 'program', 'vao', 'framebuffer', 'renderbuffer', 'query', 'sync', 'transform-feedback'];
const refuse = (): never => { throw new Error('Borrowed graphics capability unavailable'); };
interface Reservation { lease: Lease; released: boolean }
interface Handle {
  kind: GlHandleKind; native: object; reservations: Reservation[];
  status: 'live' | 'retiring' | 'deleted' | 'lost'; target?: number; faces: number; storage: boolean;
}

/** A synchronous constructor-only capability over a host-owned WebGL context. */
export function createOwnedGlEpoch(input: {
  epoch: number; gl: WebGL2RenderingContext; canvas: HTMLCanvasElement; isCurrent(): boolean; budget: OwnedGlBudget;
}): OwnedGlEpoch {
  const raw = input.gl as unknown as Record<string, unknown>;
  const count = () => Object.fromEntries(kinds.map(kind => [kind, 0])) as Record<GlHandleKind, number>;
  const live = count(), created = count(), deleted = count(), invalidatedByLoss = count();
  const records = new Map<object, Handle>(), pending = new Set<Reservation>();
  const bindings = new Map<number, Handle | null>();
  const listeners = new Map<string, Set<unknown>>();
  let phase: 'live' | 'lost' | 'lost-cleanup' | 'retired' = 'live';
  let active: ThreeGlEntry | undefined, entering = false, sweeping = false, serial = 0, callbackDepth = 0, releaseFailures = 0;
  let terminalResult: Readonly<{ failed: number }> | undefined;
  let drawBinding: WebGLFramebuffer | null = null, readBinding: WebGLFramebuffer | null = null;
  const callback = <T>(work: () => T): T => { callbackDepth++; try { return work(); } finally { callbackDepth--; } };
  const width = input.canvas.width, height = input.canvas.height;
  const isLive = () => phase === 'live';
  const check = () => {
    const entry = active;
    if (callbackDepth || !isLive() || !entry || entry.epoch !== input.epoch) return refuse();
    const hostCurrent = callback(input.isCurrent);
    if (!hostCurrent || !isLive() || active !== entry) return refuse();
    const current = callback(() => entry.isCurrent());
    if (!current || !isLive() || active !== entry) return refuse();
    return entry;
  };
  const native = (method: string, args: unknown[]) => {
    check(); const fn = raw[method];
    if (typeof fn !== 'function') return refuse();
    return Reflect.apply(fn, input.gl, args) as unknown;
  };
  const release = (reservation: Reservation) => {
    if (reservation.released) return;
    reservation.released = true; pending.delete(reservation); try { callback(() => reservation.lease.release()); } catch { releaseFailures++; throw new Error('Graphics reservation release failed'); }
  };
  const releaseAll = (reservations: readonly Reservation[]) => {
    let failed = 0;
    for (const reservation of reservations) { try { release(reservation); } catch { failed++; } }
    return failed;
  };
  const reserve = (get: () => Lease) => {
    const reservation = { lease: callback(get), released: false }; pending.add(reservation);
    try { check(); } catch { releaseAll([reservation]); throw new Error('Borrowed graphics capability unavailable'); }
    return reservation;
  };
  const enumIs = (value: unknown, names: readonly string[]) => names.some(name => typeof raw[name] === 'number' && raw[name] === value);
  const owned = (value: unknown, kind: GlHandleKind) => {
    const record = typeof value === 'object' && value !== null ? records.get(value) : undefined;
    if (!record || record.kind !== kind || record.status !== 'live') return refuse();
    return record;
  };
  const destroy = (record: Handle) => {
    if (record.status !== 'live') return;
    check(); record.status = 'retiring';
    try { native(record.kind === 'texture' ? 'deleteTexture' : 'deleteFramebuffer', [record.native]); }
    catch (error) { if (record.status === 'retiring') record.status = 'live'; throw error; }
    if (record.status !== 'retiring') return;
    record.status = 'deleted'; live[record.kind]--; deleted[record.kind]++;
    if (releaseAll(record.reservations)) return refuse();
  };
  const deletes: Record<string, GlHandleKind> = { deleteTexture: 'texture', deleteFramebuffer: 'framebuffer', deleteBuffer: 'buffer', deleteProgram: 'program', deleteShader: 'shader', deleteVertexArray: 'vao', deleteRenderbuffer: 'renderbuffer', deleteSampler: 'sampler' };
  const nullBinds = new Set(['bindBuffer', 'bindFramebuffer', 'bindRenderbuffer', 'bindSampler', 'bindTexture', 'bindVertexArray', 'useProgram']);
  const scalar = new Set(['enable', 'disable', 'blendEquation', 'blendFunc', 'blendFuncSeparate', 'blendColor', 'colorMask', 'clearColor', 'depthMask', 'depthFunc', 'clearDepth', 'stencilMask', 'stencilFunc', 'stencilOp', 'clearStencil', 'cullFace', 'frontFace', 'polygonOffset', 'lineWidth', 'scissor', 'viewport', 'pixelStorei', 'drawBuffers', 'readBuffer', 'depthRange']);
  const reads = ['VERSION', 'MAX_COMBINED_TEXTURE_IMAGE_UNITS', 'MAX_TEXTURE_IMAGE_UNITS', 'MAX_VERTEX_TEXTURE_IMAGE_UNITS', 'MAX_TEXTURE_SIZE', 'MAX_CUBE_MAP_TEXTURE_SIZE', 'MAX_VERTEX_ATTRIBS', 'MAX_VERTEX_UNIFORM_VECTORS', 'MAX_VARYING_VECTORS', 'MAX_FRAGMENT_UNIFORM_VECTORS', 'MAX_SAMPLES', 'SAMPLES', 'MAX_UNIFORM_BUFFER_BINDINGS', 'SCISSOR_BOX', 'VIEWPORT'];
  const invoke = (method: string, args: unknown[]): unknown => {
    if (callbackDepth) return refuse();
    if (phase === 'lost-cleanup') {
      if (method === 'isContextLost') return true;
      const kind = deletes[method];
      if (kind) { const handle = args[0]; if (handle === null || (typeof handle === 'object' && handle !== null && records.get(handle)?.kind === kind && records.get(handle)?.status === 'lost')) return; return refuse(); }
      if (nullBinds.has(method) && args[method === 'useProgram' || method === 'bindVertexArray' ? 0 : 1] === null) return;
      return refuse();
    }
    const entry = check();
    if (method === 'isContextLost') return false;
    if (method === 'getExtension') { if (typeof args[0] !== 'string' || args[0].length > 256) return refuse(); return null; }
    if (method === 'getSupportedExtensions') return [];
    if (method === 'createTexture' || method === 'createFramebuffer') {
      const kind = method === 'createTexture' ? 'texture' : 'framebuffer';
      const reservation = reserve(() => input.budget.reserveHandle(kind));
      let handle: unknown;
      try { handle = native(method, []); } catch (error) { releaseAll([reservation]); throw error; }
      if (typeof handle !== 'object' || handle === null) { releaseAll([reservation]); return refuse(); }
      const record: Handle = { kind, native: handle, reservations: [reservation], status: 'live', faces: 0, storage: false };
      records.set(handle, record); pending.delete(reservation); live[kind]++; created[kind]++;
      if (!isLive()) { record.status = 'lost'; live[kind]--; invalidatedByLoss[kind]++; releaseAll(record.reservations); return refuse(); }
      check(); return handle;
    }
    const deleteKind = deletes[method];
    if (deleteKind) { if (args[0] === null) return; destroy(owned(args[0], deleteKind)); return; }
    if (method === 'getParameter') {
      if (!enumIs(args[0], reads)) return refuse();
      const value = native(method, args);
      if (enumIs(args[0], ['VIEWPORT', 'SCISSOR_BOX'])) {
        if (!value || typeof value !== 'object' || !('length' in value) || value.length !== 4) return refuse();
        const tuple = Array.from(value as ArrayLike<unknown>);
        if (!tuple.every(item => typeof item === 'number' && Number.isSafeInteger(item))) return refuse();
        return Object.freeze(tuple);
      }
      if (typeof value !== 'number' && typeof value !== 'string') return refuse(); return value;
    }
    if (method === 'getContextAttributes' || method === 'getShaderPrecisionFormat') {
      if (method === 'getShaderPrecisionFormat' && (!enumIs(args[0], ['VERTEX_SHADER', 'FRAGMENT_SHADER']) || !enumIs(args[1], ['HIGH_FLOAT', 'MEDIUM_FLOAT']))) return refuse();
      const result = native(method, args) as Record<string, unknown> | null;
      if (!result) return refuse();
      const copy: Record<string, number | boolean> = {};
      const fields = method === 'getContextAttributes' ? ['alpha', 'depth', 'stencil', 'antialias', 'premultipliedAlpha', 'preserveDrawingBuffer', 'failIfMajorPerformanceCaveat', 'desynchronized'] : ['precision', 'rangeMin', 'rangeMax'];
      for (const key of fields) { const value = result[key]; if (value === undefined) continue; if (typeof value !== 'boolean' && (typeof value !== 'number' || !Number.isFinite(value))) return refuse(); copy[key] = value; }
      return Object.freeze(copy);
    }
    if (method === 'bindTexture') {
      if (!enumIs(args[0], ['TEXTURE_2D', 'TEXTURE_CUBE_MAP', 'TEXTURE_2D_ARRAY', 'TEXTURE_3D'])) return refuse();
      const target = args[0] as number, record = args[1] === null ? null : owned(args[1], 'texture');
      if (record) { if (record.target !== undefined && record.target !== target) return refuse(); record.target = target; }
      native(method, args); bindings.set(target, record); return;
    }
    if (method === 'texParameteri') {
      if (bindings.get(args[0] as number)?.status !== 'live' || !enumIs(args[1], ['TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER']) || !enumIs(args[2], ['NEAREST'])) return refuse();
      return native(method, args);
    }
    if (method === 'texImage2D' || method === 'texImage3D') {
      const face = typeof raw['TEXTURE_CUBE_MAP_POSITIVE_X'] === 'number' ? (args[0] as number) - raw['TEXTURE_CUBE_MAP_POSITIVE_X'] : -1;
      const cube = method === 'texImage2D' && face >= 0 && face < 6;
      const target = cube ? raw['TEXTURE_CUBE_MAP'] as number : args[0] as number;
      if (!(cube || enumIs(target, method === 'texImage2D' ? ['TEXTURE_2D'] : ['TEXTURE_2D_ARRAY', 'TEXTURE_3D']))) return refuse();
      const record = bindings.get(target); if (!record || record.status !== 'live') return refuse();
      const offset = method === 'texImage3D' ? 1 : 0;
      if (args.length !== 9 + offset || args[1] !== 0 || !enumIs(args[2], ['RGBA']) || args[3] !== 1 || args[4] !== 1 || (offset && args[5] !== 1) || args[5 + offset] !== 0 || !enumIs(args[6 + offset], ['RGBA']) || !enumIs(args[7 + offset], ['UNSIGNED_BYTE']) || !(args[8 + offset] instanceof Uint8Array) || (args[8 + offset] as Uint8Array).byteLength !== 4) return refuse();
      const bit = cube ? 1 << face : 1; if (record.faces & bit) return refuse();
      if (!record.storage) {
        const reservation = reserve(() => input.budget.reservePayload({ kind: 'texture', key: `fallback-${input.epoch}-${serial++}`, pool: 'gpu-texture', width: 1, height: 1, layers: 1, faces: cube ? 6 : 1, bytesPerPixel: 4, mipLevels: 1 }));
        record.reservations.push(reservation); pending.delete(reservation); record.storage = true;
      }
      native(method, args); record.faces |= bit; return;
    }
    if (method === 'activeTexture') { if (!enumIs(args[0], ['TEXTURE0'])) return refuse(); return native(method, args); }
    if (method === 'bindVertexArray' || method === 'useProgram') { if (args[0] !== null) return refuse(); return native(method, args); }
    if (method === 'bindFramebuffer') {
      if (!enumIs(args[0], ['FRAMEBUFFER', 'DRAW_FRAMEBUFFER', 'READ_FRAMEBUFFER'])) return refuse();
      if (args[1] !== null && args[1] !== entry.target.draw && args[1] !== entry.target.read) owned(args[1], 'framebuffer');
      const result = native(method, args);
      if (enumIs(args[0], ['FRAMEBUFFER', 'DRAW_FRAMEBUFFER'])) drawBinding = args[1] as WebGLFramebuffer | null;
      if (enumIs(args[0], ['FRAMEBUFFER', 'READ_FRAMEBUFFER'])) readBinding = args[1] as WebGLFramebuffer | null;
      return result;
    }
    if (!scalar.has(method)) return refuse();
    if ((method === 'enable' || method === 'disable') && !enumIs(args[0], ['BLEND', 'CULL_FACE', 'DEPTH_TEST', 'POLYGON_OFFSET_FILL', 'SCISSOR_TEST', 'STENCIL_TEST', 'SAMPLE_ALPHA_TO_COVERAGE'])) return refuse();
    if (method === 'pixelStorei') {
      const name = args[0], value = args[1];
      if (enumIs(name, ['PACK_ALIGNMENT', 'UNPACK_ALIGNMENT'])) { if (![1, 2, 4, 8].includes(value as number)) return refuse(); }
      else if (enumIs(name, ['UNPACK_FLIP_Y_WEBGL', 'UNPACK_PREMULTIPLY_ALPHA_WEBGL'])) { if (value !== false && value !== true && value !== 0 && value !== 1) return refuse(); }
      else if (enumIs(name, ['UNPACK_COLORSPACE_CONVERSION_WEBGL'])) { if (value !== 0 && !enumIs(value, ['BROWSER_DEFAULT_WEBGL'])) return refuse(); }
      else if (enumIs(name, ['PACK_ROW_LENGTH', 'PACK_SKIP_PIXELS', 'PACK_SKIP_ROWS', 'UNPACK_ROW_LENGTH', 'UNPACK_IMAGE_HEIGHT', 'UNPACK_SKIP_PIXELS', 'UNPACK_SKIP_ROWS', 'UNPACK_SKIP_IMAGES'])) { if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return refuse(); }
      else return refuse();
    }
    if (method === 'drawBuffers') { const values = args[0]; if (!Array.isArray(values) || !(drawBinding === null && values.length === 1 && enumIs(values[0], ['BACK'])) && (drawBinding !== entry.target.draw || values.length !== entry.target.drawBuffers.length || !values.every((value, i) => value === entry.target.drawBuffers[i]) || drawBinding !== null && values.some(value => enumIs(value, ['BACK'])))) return refuse(); }
    else if (method === 'readBuffer') { if (readBinding !== entry.target.read || args[0] !== entry.target.readBuffer) return refuse(); }
    else if (method === 'depthRange') { if (args[0] !== entry.target.depthRange[0] || args[1] !== entry.target.depthRange[1]) return refuse(); }
    else if (!args.every(value => typeof value === 'boolean' || typeof value === 'number' && Number.isFinite(value))) return refuse();
    return native(method, args);
  };
  const canvasMethods: Record<string, (...args: unknown[]) => void> = {
    addEventListener(type, listener) { check(); if (typeof type !== 'string' || !['webglcontextlost', 'webglcontextrestored', 'webglcontextcreationerror'].includes(type)) return refuse(); let set = listeners.get(type); if (!set) { set = new Set(); listeners.set(type, set); } set.add(listener); },
    removeEventListener(type, listener) { if (phase !== 'lost-cleanup') check(); if (typeof type !== 'string') return refuse(); listeners.get(type)?.delete(listener); }
  };
  const canvas = new Proxy(Object.create(null) as HTMLCanvasElement, {
    get(_target, key) { if (key === 'width') return width; if (key === 'height') return height; if (key === 'setAttribute') return undefined; if (typeof key === 'string' && Object.hasOwn(canvasMethods, key)) return canvasMethods[key]; return refuse(); },
    has(_target, key) { return key === 'width' || key === 'height' || typeof key === 'string' && Object.hasOwn(canvasMethods, key); },
    set: refuse, defineProperty: refuse, deleteProperty: refuse
  });
  const constants = new Set(('TEXTURE0 TEXTURE_2D TEXTURE_CUBE_MAP TEXTURE_CUBE_MAP_POSITIVE_X TEXTURE_CUBE_MAP_NEGATIVE_X TEXTURE_CUBE_MAP_POSITIVE_Y TEXTURE_CUBE_MAP_NEGATIVE_Y TEXTURE_CUBE_MAP_POSITIVE_Z TEXTURE_CUBE_MAP_NEGATIVE_Z TEXTURE_2D_ARRAY TEXTURE_3D RGBA UNSIGNED_BYTE TEXTURE_MIN_FILTER TEXTURE_MAG_FILTER NEAREST FRAMEBUFFER DRAW_FRAMEBUFFER READ_FRAMEBUFFER BACK VIEWPORT SCISSOR_BOX VERSION VERTEX_SHADER FRAGMENT_SHADER HIGH_FLOAT MEDIUM_FLOAT DEPTH_TEST CULL_FACE BLEND POLYGON_OFFSET_FILL SCISSOR_TEST STENCIL_TEST SAMPLE_ALPHA_TO_COVERAGE LEQUAL LESS CCW FUNC_ADD ONE ZERO ALWAYS KEEP PACK_ALIGNMENT UNPACK_ALIGNMENT UNPACK_FLIP_Y_WEBGL UNPACK_PREMULTIPLY_ALPHA_WEBGL UNPACK_COLORSPACE_CONVERSION_WEBGL BROWSER_DEFAULT_WEBGL PACK_ROW_LENGTH PACK_SKIP_PIXELS PACK_SKIP_ROWS UNPACK_ROW_LENGTH UNPACK_IMAGE_HEIGHT UNPACK_SKIP_PIXELS UNPACK_SKIP_ROWS UNPACK_SKIP_IMAGES MAX_COMBINED_TEXTURE_IMAGE_UNITS MAX_TEXTURE_IMAGE_UNITS MAX_VERTEX_TEXTURE_IMAGE_UNITS MAX_TEXTURE_SIZE MAX_CUBE_MAP_TEXTURE_SIZE MAX_VERTEX_ATTRIBS MAX_VERTEX_UNIFORM_VECTORS MAX_VARYING_VECTORS MAX_FRAGMENT_UNIFORM_VECTORS MAX_SAMPLES SAMPLES MAX_UNIFORM_BUFFER_BINDINGS FUNC_SUBTRACT FUNC_REVERSE_SUBTRACT MIN MAX SRC_COLOR ONE_MINUS_SRC_COLOR SRC_ALPHA ONE_MINUS_SRC_ALPHA DST_ALPHA ONE_MINUS_DST_ALPHA DST_COLOR ONE_MINUS_DST_COLOR SRC_ALPHA_SATURATE CONSTANT_COLOR ONE_MINUS_CONSTANT_COLOR CONSTANT_ALPHA ONE_MINUS_CONSTANT_ALPHA REPEAT CLAMP_TO_EDGE MIRRORED_REPEAT LINEAR NEAREST_MIPMAP_NEAREST LINEAR_MIPMAP_NEAREST NEAREST_MIPMAP_LINEAR LINEAR_MIPMAP_LINEAR NEVER EQUAL GREATER NOTEQUAL GEQUAL').split(' '));
  const methods = new Map<string, (...args: unknown[]) => unknown>();
  const allowed = new Set([...Object.keys(deletes), ...scalar, ...nullBinds, 'createTexture', 'createFramebuffer', 'getParameter', 'getContextAttributes', 'getShaderPrecisionFormat', 'isContextLost', 'getExtension', 'getSupportedExtensions', 'texParameteri', 'texImage2D', 'texImage3D', 'activeTexture']);
  const gl = new Proxy(Object.create(null) as WebGL2RenderingContext, {
    get(_target, key) {
      if (key === 'canvas') return canvas;
      if (key === 'drawingBufferWidth') return width; if (key === 'drawingBufferHeight') return height;
      if (typeof key !== 'string') return refuse();
      if (constants.has(key) && typeof raw[key] === 'number') return raw[key];
      if (key === 'drawingBufferColorSpace' || key === 'unpackColorSpace') { check(); return raw[key]; }
      if (!allowed.has(key)) return refuse();
      let fn = methods.get(key); if (!fn) { fn = (...args) => invoke(key, args); methods.set(key, fn); } return fn;
    },
    has(_target, key) { return key === 'drawingBufferColorSpace' || key === 'unpackColorSpace' ? key in raw : typeof key === 'string' && allowed.has(key); },
    set(_target, key, value) { check(); if (key === 'drawingBufferColorSpace' && value === raw[key]) return true; return refuse(); },
    defineProperty: refuse, deleteProperty: refuse
  });
  const epoch: OwnedGlEpoch = {
    get handles() { return Object.freeze({ releaseFailures, live: Object.freeze({ ...live }), created: Object.freeze({ ...created }), deleted: Object.freeze({ ...deleted }), invalidatedByLoss: Object.freeze({ ...invalidatedByLoss }) }); },
    run(entry, work) {
      if (callbackDepth || !isLive() || active || entering || entry.epoch !== input.epoch) return refuse();
      entering = true;
      try {
        const hostCurrent = callback(input.isCurrent);
        if (!hostCurrent || !isLive()) return refuse();
        const current = callback(() => entry.isCurrent());
        if (!current || !isLive()) return refuse();
        active = entry; bindings.clear(); drawBinding = entry.target.draw; readBinding = entry.target.read;
        const result = work(gl, canvas);
        if (result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result) return refuse();
        check(); return result;
      } finally { active = undefined; entering = false; }
    },
    sweep() {
      check(); if (sweeping) return refuse(); sweeping = true; let failed = 0;
      try {
        for (const [target, record] of bindings) { if (record?.status === 'live') { try { native('bindTexture', [target, null]); bindings.set(target, null); } catch { failed++; } } }
        const owners = [...records.values()].filter(record => record.status === 'live').sort((a, b) => Number(b.kind === 'framebuffer') - Number(a.kind === 'framebuffer'));
        for (const record of owners) { if (!isLive()) { failed++; break; } try { destroy(record); } catch { failed++; } }
      } finally { sweeping = false; }
      if (failed) return refuse();
    },
    assertCurrent() {
      if (callbackDepth || !isLive() || active || entering) return refuse();
      const current = callback(input.isCurrent);
      if (!current || !isLive()) return refuse();
    },
    retire() { if (callbackDepth || releaseFailures || !isLive() || active || entering || Object.values(live).some(value => value !== 0)) return refuse(); listeners.clear(); records.clear(); phase = 'retired'; },
    lose() {
      if (!isLive()) return;
      phase = 'lost'; active = undefined; listeners.clear();
      const reservations = [...pending];
      for (const record of records.values()) { if (record.status === 'live' || record.status === 'retiring') { record.status = 'lost'; live[record.kind]--; invalidatedByLoss[record.kind]++; reservations.push(...record.reservations); } }
      releaseAll(reservations);
    },
    retireAfterLoss(cleanups) {
      if (callbackDepth) return refuse();
      if (phase === 'retired' || phase === 'lost-cleanup') return terminalResult ?? Object.freeze({ failed: releaseFailures });
      if (phase !== 'lost') return refuse(); phase = 'lost-cleanup'; let failed = 0;
      try { for (const cleanup of [...cleanups]) { try { cleanup(); } catch { failed++; } } }
      finally { listeners.clear(); bindings.clear(); records.clear(); phase = 'retired'; }
      terminalResult = Object.freeze({ failed: failed + releaseFailures }); return terminalResult;
    }
  };
  return Object.freeze(epoch);
}
