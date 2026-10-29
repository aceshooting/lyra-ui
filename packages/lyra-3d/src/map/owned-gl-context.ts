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
  reservePayload(request: Readonly<{ kind: 'texture'; key: string; pool: 'gpu-texture'; width: number; height: number; layers: number; faces: number; bytesPerPixel: number; mipLevels: number }
    | { kind: 'bytes'; key: string; pool: 'gpu-buffer'; byteLength: number }>): Lease;
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
  deleteRequested?: boolean; references?: number;
  buffer?: { size: number; confirmed: boolean; payloads: Reservation[] };
  vao?: { element: Handle | null; attributes: Map<number, VertexAttribute>; uncertain: Handle[]; confirmed: boolean };
  shader?: { type: number };
  program?: { shaders: Set<Handle>; linked: boolean; generation: number; uniforms?: Reflection[]; attributes?: Reflection[] };
}
interface VertexAttribute { enabled: boolean; buffer?: Handle; size?: number; stride?: number; offset?: number }
interface Reflection { name: string; type: number; size: number; location?: number }
interface UniformLocation { program: Handle; generation: number; type: number; size: number }
const drawMethods = new Set(('createBuffer deleteBuffer bindBuffer bufferData bufferSubData getBufferParameter createVertexArray deleteVertexArray bindVertexArray enableVertexAttribArray disableVertexAttribArray vertexAttribPointer vertexAttribDivisor createShader deleteShader shaderSource compileShader getShaderParameter getShaderInfoLog createProgram deleteProgram attachShader linkProgram getProgramParameter getProgramInfoLog useProgram getActiveUniform getUniformLocation getActiveAttrib getAttribLocation bindAttribLocation uniform1f uniform2f uniform3f uniform4f uniform1fv uniform2fv uniform3fv uniform4fv uniform1i uniform1iv uniformMatrix3fv uniformMatrix4fv drawElements').split(' '));
const deleteMethods: Partial<Record<GlHandleKind, string>> = { texture: 'deleteTexture', framebuffer: 'deleteFramebuffer',
  buffer: 'deleteBuffer', vao: 'deleteVertexArray', shader: 'deleteShader', program: 'deleteProgram' };

/** A synchronous, explicitly profiled capability over a host-owned WebGL context. */
export function createOwnedGlEpoch(input: {
  epoch: number; gl: WebGL2RenderingContext; canvas: HTMLCanvasElement; isCurrent(): boolean; budget: OwnedGlBudget;
  profile?: 'constructor' | 'model-draw';
}): OwnedGlEpoch {
  const profile = Object.getOwnPropertyDescriptor(input, 'profile');
  if (profile && (!Object.hasOwn(profile, 'value') || profile.value !== undefined && profile.value !== 'constructor' && profile.value !== 'model-draw')) return refuse();
  const modelDraw = profile?.value === 'model-draw';
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
  let arrayBuffer: Handle | null = null, vertexArray: Handle | null = null, currentProgram: Handle | null = null;
  // A prior entry may still hold this native program until the host restores state.
  const retainedPrograms = new Set<Handle>();
  let maxAttributes: number | undefined;
  let viewport: readonly number[] = [], scissor: readonly number[] = [], depthRange: readonly number[] = [];
  let drawSelections: readonly number[] = [], readSelection: number | undefined;
  let scissorTest = false, depthFunction: number | undefined;
  const uniformLocations = new Map<object, UniformLocation>();
  const callback = <T>(work: () => T): T => { callbackDepth++; try { return work(); } finally { callbackDepth--; } };
  const width = input.canvas.width, height = input.canvas.height;
  const isLive = () => phase === 'live';
  const check = () => {
    const entry = active;
    if (callbackDepth || !isLive() || !entry || entry.epoch !== input.epoch) return refuse();
    const hostCurrent = callback(input.isCurrent);
    if (!hostCurrent || !isLive() || active !== entry) { if (modelDraw) active = undefined; return refuse(); }
    const current = callback(() => entry.isCurrent());
    if (!current || !isLive() || active !== entry) { if (modelDraw) active = undefined; return refuse(); }
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
    if (!record || record.kind !== kind || record.status !== 'live' || record.deleteRequested) return refuse();
    return record;
  };
  const completeDeletion = (record: Handle): void => {
    if (record.status !== 'live' || !record.deleteRequested || (record.references ?? 0) !== 0 || retainedPrograms.has(record)) return;
    record.status = 'deleted'; live[record.kind]--; deleted[record.kind]++;
    const dependencies: Handle[] = [];
    if (record.vao) {
      if (record.vao.element) dependencies.push(record.vao.element);
      for (const attribute of record.vao.attributes.values()) if (attribute.buffer) dependencies.push(attribute.buffer);
      dependencies.push(...record.vao.uncertain);
      record.vao.element = null; record.vao.attributes.clear(); record.vao.uncertain = [];
    }
    if (record.program) { dependencies.push(...record.program.shaders); record.program.shaders.clear(); delete record.program.uniforms; delete record.program.attributes; }
    let failed = releaseAll(record.reservations);
    for (const dependency of dependencies) {
      dependency.references = (dependency.references ?? 0) - 1;
      try { completeDeletion(dependency); } catch { failed++; }
    }
    if (failed) return refuse();
  };
  const dropReference = (record: Handle | undefined | null): void => {
    if (!record) return;
    record.references = (record.references ?? 0) - 1; completeDeletion(record);
  };
  const destroy = (record: Handle) => {
    if (record.status !== 'live') return;
    if (record.deleteRequested) { completeDeletion(record); return; }
    check(); record.status = 'retiring';
    const method = deleteMethods[record.kind];
    if (!method) { record.status = 'live'; return refuse(); }
    try { native(method, [record.native]); }
    catch (error) { if (record.status === 'retiring') record.status = 'live'; throw error; }
    if (record.status !== 'retiring') return;
    if (modelDraw && ['buffer', 'vao', 'shader', 'program'].includes(record.kind)) {
      record.status = 'live'; record.deleteRequested = true;
      if (record === vertexArray) vertexArray = null;
      if (record === arrayBuffer) arrayBuffer = null;
      if (record === currentProgram) currentProgram = null;
      if (record.program) { record.program.linked = false; record.program.generation++; }
      completeDeletion(record); return;
    }
    record.status = 'deleted'; live[record.kind]--; deleted[record.kind]++;
    if (releaseAll(record.reservations)) return refuse();
  };
  const deletes: Record<string, GlHandleKind> = { deleteTexture: 'texture', deleteFramebuffer: 'framebuffer', deleteBuffer: 'buffer', deleteProgram: 'program', deleteShader: 'shader', deleteVertexArray: 'vao', deleteRenderbuffer: 'renderbuffer', deleteSampler: 'sampler' };
  const nullBinds = new Set(['bindBuffer', 'bindFramebuffer', 'bindRenderbuffer', 'bindSampler', 'bindTexture', 'bindVertexArray', 'useProgram']);
  const scalar = new Set(['enable', 'disable', 'blendEquation', 'blendFunc', 'blendFuncSeparate', 'blendColor', 'colorMask', 'clearColor', 'depthMask', 'depthFunc', 'clearDepth', 'stencilMask', 'stencilFunc', 'stencilOp', 'clearStencil', 'cullFace', 'frontFace', 'polygonOffset', 'lineWidth', 'scissor', 'viewport', 'pixelStorei', 'drawBuffers', 'readBuffer', 'depthRange']);
  const reads = ['VERSION', 'MAX_COMBINED_TEXTURE_IMAGE_UNITS', 'MAX_TEXTURE_IMAGE_UNITS', 'MAX_VERTEX_TEXTURE_IMAGE_UNITS', 'MAX_TEXTURE_SIZE', 'MAX_CUBE_MAP_TEXTURE_SIZE', 'MAX_VERTEX_ATTRIBS', 'MAX_VERTEX_UNIFORM_VECTORS', 'MAX_VARYING_VECTORS', 'MAX_FRAGMENT_UNIFORM_VECTORS', 'MAX_SAMPLES', 'SAMPLES', 'MAX_UNIFORM_BUFFER_BINDINGS', 'SCISSOR_BOX', 'VIEWPORT'];
  const integer = (value: unknown, maximum = Number.MAX_SAFE_INTEGER): number => {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) return refuse();
    return value;
  };
  const call = (method: string, args: unknown[]): unknown => { const value = native(method, args); check(); return value; };
  const name = (value: unknown): string => {
    if (typeof value !== 'string' || value.length === 0 || value.length > 16384 || value.includes('\0')) return refuse();
    return value;
  };
  const output = () => {
    const entry = check();
    if (entry.target.outputPolicy !== 'default-srgb' || entry.target.draw !== null) return refuse();
    return entry;
  };
  const typed = (value: unknown, tags: readonly string[]) => {
    const prototype = Object.getPrototypeOf(Float32Array.prototype) as object;
    const get = (key: PropertyKey): unknown => Object.getOwnPropertyDescriptor(prototype, key)?.get?.call(value);
    try {
      const tag = get(Symbol.toStringTag);
      if (typeof tag !== 'string' || !tags.includes(tag)) return refuse();
      const buffer = get('buffer');
      integer(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength')?.get?.call(buffer));
      if (Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'resizable')?.get?.call(buffer)) return refuse();
      const bytes = integer(get('byteLength')), length = integer(get('length'));
      return { bytes, length, values: value as Float32Array | Uint32Array | Int32Array };
    } catch { return refuse(); }
  };
  const attributeSlot = (value: unknown) => {
    maxAttributes ??= integer(call('getParameter', [raw['MAX_VERTEX_ATTRIBS']]), 65536);
    if (!maxAttributes) return refuse();
    return integer(value, maxAttributes - 1);
  };
  const boundBuffer = (target: unknown): Handle => {
    if (enumIs(target, ['ARRAY_BUFFER'])) return arrayBuffer ? owned(arrayBuffer.native, 'buffer') : refuse();
    if (!enumIs(target, ['ELEMENT_ARRAY_BUFFER']) || !vertexArray) return refuse();
    const state = owned(vertexArray.native, 'vao').vao!;
    if (!state.confirmed) return refuse();
    const element = state.element;
    return element ? owned(element.native, 'buffer') : refuse();
  };
  const confirmedBuffer = (record: Handle) => {
    if (!record.buffer?.confirmed) return refuse();
    return record.buffer;
  };
  const invalidateUniforms = (program: Handle) => {
    for (const [location, record] of uniformLocations) if (record.program === program) uniformLocations.delete(location);
  };
  const reflect = (program: Handle, uniforms: boolean): Reflection[] => {
    const data = program.program!;
    if (!data.linked) return refuse();
    const cached = uniforms ? data.uniforms : data.attributes;
    if (cached) return cached;
    const count = integer(call('getProgramParameter', [program.native, raw[uniforms ? 'ACTIVE_UNIFORMS' : 'ACTIVE_ATTRIBUTES']]), 65536);
    const result: Reflection[] = [];
    for (let index = 0; index < count; index++) {
      const info = call(uniforms ? 'getActiveUniform' : 'getActiveAttrib', [program.native, index]) as WebGLActiveInfo | null;
      if (!info) return refuse();
      const row: Reflection = { name: name(info.name), type: integer(info.type), size: integer(info.size, 65536) };
      if (row.size === 0) return refuse();
      if (!uniforms) row.location = attributeSlot(call('getAttribLocation', [program.native, row.name]));
      result.push(row);
    }
    if (uniforms) data.uniforms = result; else data.attributes = result;
    return result;
  };
  const createDrawHandle = (method: string, args: unknown[]): object => {
    const kind: GlHandleKind = method === 'createBuffer' ? 'buffer' : method === 'createVertexArray' ? 'vao' : method === 'createShader' ? 'shader' : 'program';
    if (kind === 'shader' && (args.length !== 1 || !enumIs(args[0], ['VERTEX_SHADER', 'FRAGMENT_SHADER']))) return refuse();
    if (kind !== 'shader' && args.length !== 0) return refuse();
    const reservation = reserve(() => input.budget.reserveHandle(kind));
    let handle: unknown;
    try { handle = native(method, args); } catch (error) { releaseAll([reservation]); throw error; }
    if (typeof handle !== 'object' || handle === null) { releaseAll([reservation]); return refuse(); }
    const record: Handle = { kind, native: handle, reservations: [reservation], status: 'live', faces: 0, storage: false, references: 0 };
    if (kind === 'buffer') record.buffer = { size: 0, confirmed: false, payloads: [] };
    if (kind === 'vao') record.vao = { element: null, attributes: new Map(), uncertain: [], confirmed: true };
    if (kind === 'shader') record.shader = { type: args[0] as number };
    if (kind === 'program') record.program = { shaders: new Set(), linked: false, generation: 0 };
    records.set(handle, record); pending.delete(reservation); live[kind]++; created[kind]++;
    if (!isLive()) { record.status = 'lost'; live[kind]--; invalidatedByLoss[kind]++; releaseAll(record.reservations); return refuse(); }
    check(); return handle;
  };
  const bindProgram = (program: Handle | null) => {
    if (program && !program.program!.linked) return refuse();
    // A throwing native setter may have taken effect. Keep both possibilities charged.
    if (program) retainedPrograms.add(program);
    currentProgram = null;
    native('useProgram', [program?.native ?? null]);
    if (!isLive()) return refuse();
    const previous = [...retainedPrograms];
    retainedPrograms.clear(); if (program) retainedPrograms.add(program); currentProgram = program;
    for (const prior of previous) if (prior !== program) completeDeletion(prior);
    check();
  };
  const drawInvoke = (method: string, args: unknown[]): unknown => {
    if (['createBuffer', 'createVertexArray', 'createShader', 'createProgram'].includes(method)) return createDrawHandle(method, args);
    if (method.startsWith('delete')) {
      if (args[0] === null) return;
      const kind = deletes[method];
      const record = typeof args[0] === 'object' && args[0] !== null ? records.get(args[0]) : undefined;
      if (!record || record.kind !== kind || record.status === 'lost') return refuse();
      if (record.program) invalidateUniforms(record);
      destroy(record); check(); return;
    }
    if (method === 'bindVertexArray') {
      const record = args[0] === null ? null : owned(args[0], 'vao');
      vertexArray = null; native(method, args);
      if (!isLive()) return refuse(); vertexArray = record; check(); return;
    }
    if (method === 'useProgram') { bindProgram(args[0] === null ? null : owned(args[0], 'program')); return; }
    if (method === 'bindBuffer') {
      if (!enumIs(args[0], ['ARRAY_BUFFER', 'ELEMENT_ARRAY_BUFFER'])) return refuse();
      const record = args[1] === null ? null : owned(args[1], 'buffer');
      if (enumIs(args[0], ['ARRAY_BUFFER'])) {
        arrayBuffer = null; native(method, args);
        if (!isLive()) return refuse(); arrayBuffer = record; check(); return;
      }
      if (!vertexArray) return refuse();
      const state = owned(vertexArray.native, 'vao').vao!, old = state.element;
      if (!state.confirmed) return refuse();
      if (record && record !== old) { record.references = (record.references ?? 0) + 1; state.uncertain.push(record); }
      try { native(method, args); } catch (error) { state.confirmed = false; throw error; }
      if (!isLive()) return refuse();
      state.element = record;
      if (record !== old) { if (record) state.uncertain.pop(); dropReference(old); }
      check(); return;
    }
    if (method === 'bufferData') {
      output();
      if (args.length !== 3 || !enumIs(args[2], ['STATIC_DRAW'])) return refuse();
      const record = boundBuffer(args[0]), data = record.buffer!;
      const size = typeof args[1] === 'number' ? integer(args[1]) : typed(args[1], ['Float32Array', 'Uint32Array']).bytes;
      const reservation = reserve(() => input.budget.reservePayload({ kind: 'bytes', key: `buffer-${input.epoch}-${serial++}`, pool: 'gpu-buffer', byteLength: size }));
      const previous = [...data.payloads];
      record.reservations.push(reservation); data.payloads.push(reservation); pending.delete(reservation); data.confirmed = false;
      call(method, args);
      const actual = integer(call('getBufferParameter', [args[0], raw['BUFFER_SIZE']]));
      if (actual !== size) return refuse();
      data.size = size; data.confirmed = true; data.payloads = [reservation];
      if (releaseAll(previous)) return refuse();
      record.reservations = record.reservations.filter(item => !item.released);
      check(); return;
    }
    if (method === 'bufferSubData') {
      output();
      if (args.length < 3 || args.length > 5) return refuse();
      const data = confirmedBuffer(boundBuffer(args[0])), offset = integer(args[1]);
      const source = typed(args[2], ['Float32Array', 'Uint32Array']);
      const start = args.length > 3 ? integer(args[3]) : 0;
      if (start > source.length) return refuse();
      const requested = args.length > 4 ? integer(args[4]) : 0;
      const length = requested || source.length - start;
      if (length > source.length - start || offset > data.size || length > Math.floor((data.size - offset) / 4)) return refuse();
      return call(method, args);
    }
    if (method === 'getBufferParameter') {
      if (!enumIs(args[1], ['BUFFER_SIZE'])) return refuse();
      boundBuffer(args[0]); return integer(call(method, args));
    }
    if (['enableVertexAttribArray', 'disableVertexAttribArray', 'vertexAttribPointer', 'vertexAttribDivisor'].includes(method)) {
      if (!vertexArray) return refuse();
      const state = owned(vertexArray.native, 'vao').vao!, slot = attributeSlot(args[0]);
      if (!state.confirmed) return refuse();
      const previous: VertexAttribute = state.attributes.get(slot) ?? { enabled: false };
      if (method === 'vertexAttribDivisor') { if (args[1] !== 0) return refuse(); return call(method, args); }
      if (method !== 'vertexAttribPointer') {
        try { native(method, args); } catch (error) { state.confirmed = false; throw error; }
        if (!isLive()) return refuse();
        state.attributes.set(slot, { ...previous, enabled: method === 'enableVertexAttribArray' }); check(); return;
      }
      if (args.length !== 6 || !enumIs(args[2], ['FLOAT']) || typeof args[3] !== 'boolean' || !arrayBuffer) return refuse();
      const buffer = owned(arrayBuffer.native, 'buffer'), data = confirmedBuffer(buffer);
      const size = integer(args[1], 4), stride = integer(args[4], 255), offset = integer(args[5]);
      if (!size || stride % 4 || offset % 4 || stride !== 0 && stride < size * 4 || offset > data.size || size * 4 > data.size - offset) return refuse();
      if (previous.buffer !== buffer) { buffer.references = (buffer.references ?? 0) + 1; state.uncertain.push(buffer); }
      try { native(method, args); } catch (error) { state.confirmed = false; throw error; }
      if (!isLive()) return refuse();
      state.attributes.set(slot, { ...previous, buffer, size, stride: stride || size * 4, offset });
      if (previous.buffer !== buffer) { state.uncertain.pop(); dropReference(previous.buffer); }
      check(); return;
    }
    if (['shaderSource', 'compileShader', 'getShaderParameter', 'getShaderInfoLog'].includes(method)) {
      owned(args[0], 'shader');
      if (method === 'shaderSource') {
        if (args.length !== 2 || typeof args[1] !== 'string' || args[1].length > 1048576) return refuse();
        return call(method, args);
      }
      if (method === 'compileShader') { output(); return call(method, args); }
      if (method === 'getShaderParameter') {
        if (!enumIs(args[1], ['COMPILE_STATUS'])) return refuse();
        const result = call(method, args); if (typeof result !== 'boolean') return refuse(); return result;
      }
      const result = call(method, args); if (typeof result !== 'string') return refuse(); return result;
    }
    if (method === 'attachShader') {
      const program = owned(args[0], 'program'), shader = owned(args[1], 'shader'), attached = program.program!.shaders;
      if ([...attached].some(record => record.shader!.type === shader.shader!.type)) return refuse();
      attached.add(shader); shader.references = (shader.references ?? 0) + 1;
      call(method, args); return;
    }
    if (method === 'linkProgram') {
      output();
      const program = owned(args[0], 'program'), data = program.program!;
      data.generation++; data.linked = false; delete data.uniforms; delete data.attributes; invalidateUniforms(program);
      call(method, args);
      const linked = call('getProgramParameter', [program.native, raw['LINK_STATUS']]);
      if (typeof linked !== 'boolean') return refuse(); data.linked = linked; return;
    }
    if (method === 'bindAttribLocation') {
      owned(args[0], 'program'); attributeSlot(args[1]); name(args[2]); return call(method, args);
    }
    if (method === 'getProgramParameter') {
      owned(args[0], 'program');
      if (!enumIs(args[1], ['LINK_STATUS', 'ACTIVE_UNIFORMS', 'ACTIVE_ATTRIBUTES'])) return refuse();
      const result = call(method, args);
      if (enumIs(args[1], ['LINK_STATUS'])) { if (typeof result !== 'boolean') return refuse(); return result; }
      return integer(result, 65536);
    }
    if (method === 'getProgramInfoLog') {
      owned(args[0], 'program'); const result = call(method, args); if (typeof result !== 'string') return refuse(); return result;
    }
    if (method === 'getActiveUniform' || method === 'getActiveAttrib') {
      const rows = reflect(owned(args[0], 'program'), method === 'getActiveUniform');
      const row = rows[integer(args[1], rows.length - 1)]; if (!row) return refuse();
      return Object.freeze({ name: row.name, type: row.type, size: row.size });
    }
    if (method === 'getAttribLocation') {
      const program = owned(args[0], 'program'); if (!program.program!.linked) return refuse();
      name(args[1]); const location = call(method, args); return location === -1 ? -1 : attributeSlot(location);
    }
    if (method === 'getUniformLocation') {
      const program = owned(args[0], 'program'), requested = name(args[1]);
      const rows = reflect(program, true);
      const location = call(method, args);
      if (location === null) return null;
      if (typeof location !== 'object') return refuse();
      const row = rows.find(info => info.name === requested || info.name.endsWith('[0]') && info.name.slice(0, -3) === requested);
      if (!row) return refuse();
      uniformLocations.set(location, { program, generation: program.program!.generation, type: row.type, size: row.size });
      return location;
    }
    if (method.startsWith('uniform')) {
      if (args[0] === null) return;
      const location = typeof args[0] === 'object' && args[0] !== null ? uniformLocations.get(args[0]) : undefined;
      if (!location || currentProgram !== location.program) return refuse();
      const program = owned(location.program.native, 'program').program!;
      if (!program.linked || program.generation !== location.generation) return refuse();
      const matrix = method === 'uniformMatrix3fv' ? 3 : method === 'uniformMatrix4fv' ? 4 : 0;
      const components = matrix ? matrix * matrix : Number(method[7]);
      const integerUniform = method === 'uniform1i' || method === 'uniform1iv';
      const typeNames = matrix ? [matrix === 3 ? 'FLOAT_MAT3' : 'FLOAT_MAT4'] : integerUniform ? ['INT', 'BOOL'] :
        [components === 1 ? 'FLOAT' : `FLOAT_VEC${components}`];
      if (!enumIs(location.type, typeNames)) return refuse();
      const vector = method.endsWith('v'), expected = components * (vector ? location.size : 1);
      let upload = args;
      const finiteUniform = (value: unknown): number => {
        if (typeof value !== 'number' || !Number.isFinite(value) || !integerUniform && !Number.isFinite(Math.fround(value)) || integerUniform &&
          (!Number.isInteger(value) || value < -2147483648 || value > 2147483647 || enumIs(location.type, ['BOOL']) && value !== 0 && value !== 1)) return refuse();
        return value;
      };
      if (vector) {
        if (args.length !== (matrix ? 3 : 2) || matrix && args[1] !== false) return refuse();
        const values = args[matrix ? 2 : 1];
        const snapshot = integerUniform ? new Int32Array(expected) : new Float32Array(expected);
        if (Array.isArray(values)) {
          if (values.length !== expected) return refuse();
          for (let index = 0; index < expected; index++) {
            const field = Object.getOwnPropertyDescriptor(values, String(index));
            if (!field || !Object.hasOwn(field, 'value')) return refuse(); snapshot[index] = finiteUniform(field.value);
          }
        } else {
          const view = typed(values, integerUniform ? ['Int32Array', 'Float32Array'] : ['Float32Array']);
          if (view.length !== expected) return refuse();
          for (let index = 0; index < view.length; index++) snapshot[index] = finiteUniform(view.values[index]);
        }
        upload = [...args]; upload[matrix ? 2 : 1] = snapshot;
      } else {
        if (location.size !== 1 || args.length !== components + 1) return refuse();
        for (const value of args.slice(1)) finiteUniform(value);
      }
      const current = owned(location.program.native, 'program').program!;
      if (currentProgram !== location.program || !current.linked || current.generation !== location.generation) return refuse();
      return call(method, upload);
    }
    if (method === 'drawElements') {
      const entry = output();
      if (args.length !== 4 || !enumIs(args[0], ['TRIANGLES']) || !currentProgram || !vertexArray) return refuse();
      const program = owned(currentProgram.native, 'program'), state = owned(vertexArray.native, 'vao').vao!;
      if (!program.program!.linked || !state.confirmed || !state.element) return refuse();
      const data = confirmedBuffer(owned(state.element.native, 'buffer'));
      const count = integer(args[1]), offset = integer(args[3]);
      const size = enumIs(args[2], ['UNSIGNED_INT']) ? 4 : enumIs(args[2], ['UNSIGNED_SHORT']) ? 2 : enumIs(args[2], ['UNSIGNED_BYTE']) ? 1 : refuse();
      if (offset % size || offset > data.size || count > Math.floor((data.size - offset) / size)) return refuse();
      for (const info of reflect(program, false)) {
        const attribute = state.attributes.get(info.location!);
        if (!attribute?.enabled || !attribute.buffer || attribute.size === undefined || attribute.offset === undefined) return refuse();
        const storage = confirmedBuffer(owned(attribute.buffer.native, 'buffer'));
        if (attribute.offset > storage.size || attribute.size * 4 > storage.size - attribute.offset) return refuse();
      }
      const matches = (actual: readonly number[], expected: readonly number[]) => actual.length === expected.length && actual.every((value, index) => value === expected[index]);
      if (drawBinding !== entry.target.draw || readBinding !== entry.target.read || !matches(viewport, entry.target.viewport) ||
          !matches(scissor, entry.target.scissor) || scissorTest !== entry.target.scissorTest ||
          !matches(depthRange, entry.target.depthRange) || depthFunction !== entry.target.depthFunc ||
          !matches(drawSelections, entry.target.drawBuffers) || readSelection !== entry.target.readBuffer) return refuse();
      return call(method, args);
    }
    return refuse();
  };
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
    if (modelDraw && drawMethods.has(method)) return drawInvoke(method, args);
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
    if (modelDraw && method === 'frontFace' && !enumIs(args[0], ['CW', 'CCW'])) return refuse();
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
    const result = modelDraw ? call(method, args) : native(method, args);
    if (modelDraw) {
      if (method === 'viewport') viewport = args as number[];
      else if (method === 'scissor') scissor = args as number[];
      else if (method === 'depthRange') depthRange = args as number[];
      else if (method === 'depthFunc') depthFunction = args[0] as number;
      else if (method === 'drawBuffers') drawSelections = [...args[0] as number[]];
      else if (method === 'readBuffer') readSelection = args[0] as number;
      else if ((method === 'enable' || method === 'disable') && enumIs(args[0], ['SCISSOR_TEST'])) scissorTest = method === 'enable';
    }
    return result;
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
  if (modelDraw) {
    for (const method of drawMethods) allowed.add(method);
    for (const name of 'ARRAY_BUFFER ELEMENT_ARRAY_BUFFER STATIC_DRAW BUFFER_SIZE FLOAT UNSIGNED_INT UNSIGNED_SHORT TRIANGLES LINES COMPILE_STATUS LINK_STATUS ACTIVE_UNIFORMS ACTIVE_ATTRIBUTES FLOAT_VEC2 FLOAT_VEC3 FLOAT_VEC4 FLOAT_MAT2 FLOAT_MAT3 FLOAT_MAT4 INT BOOL CW COLOR_ATTACHMENT0'.split(' ')) constants.add(name);
  }
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
        if (modelDraw) {
          arrayBuffer = null; vertexArray = null; currentProgram = null;
          viewport = [...entry.target.viewport]; scissor = [...entry.target.scissor]; depthRange = [...entry.target.depthRange];
          drawSelections = [...entry.target.drawBuffers]; readSelection = entry.target.readBuffer;
          scissorTest = entry.target.scissorTest; depthFunction = entry.target.depthFunc;
        }
        const result = work(gl, canvas);
        if (result !== null && (typeof result === 'object' || typeof result === 'function') && 'then' in result) return refuse();
        check(); return result;
      } finally { active = undefined; entering = false; }
    },
    sweep() {
      check(); if (sweeping) return refuse(); sweeping = true; let failed = 0;
      try {
        if (modelDraw) {
          try { bindProgram(null); } catch { failed++; }
          try { call('bindVertexArray', [null]); vertexArray = null; } catch { failed++; }
          try { call('bindBuffer', [raw['ARRAY_BUFFER'], null]); arrayBuffer = null; } catch { failed++; }
        }
        for (const [target, record] of bindings) { if (record?.status === 'live') { try { native('bindTexture', [target, null]); bindings.set(target, null); } catch { failed++; } } }
        const priority = (kind: GlHandleKind) => kind === 'vao' ? 0 : kind === 'program' ? 1 : kind === 'shader' ? 2 : kind === 'buffer' ? 3 : 4;
        const owners = [...records.values()].filter(record => record.status === 'live').sort((a, b) => modelDraw ? priority(a.kind) - priority(b.kind) : Number(b.kind === 'framebuffer') - Number(a.kind === 'framebuffer'));
        for (const record of owners) { if (!isLive()) { failed++; break; } try { destroy(record); } catch { failed++; } }
      } finally { sweeping = false; }
      if (failed) return refuse();
    },
    assertCurrent() {
      if (callbackDepth || !isLive() || active || entering) return refuse();
      const current = callback(input.isCurrent);
      if (!current || !isLive()) return refuse();
    },
    retire() { if (callbackDepth || releaseFailures || !isLive() || active || entering || Object.values(live).some(value => value !== 0)) return refuse(); listeners.clear(); records.clear(); uniformLocations.clear(); retainedPrograms.clear(); currentProgram = null; vertexArray = null; arrayBuffer = null; phase = 'retired'; },
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
      finally { listeners.clear(); bindings.clear(); records.clear(); uniformLocations.clear(); retainedPrograms.clear(); currentProgram = null; vertexArray = null; arrayBuffer = null; phase = 'retired'; }
      terminalResult = Object.freeze({ failed: failed + releaseFailures }); return terminalResult;
    }
  };
  return Object.freeze(epoch);
}
