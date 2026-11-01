import assert from 'node:assert/strict';

const capabilities = ['BLEND', 'CULL_FACE', 'DEPTH_TEST', 'STENCIL_TEST', 'SCISSOR_TEST', 'POLYGON_OFFSET_FILL',
  'SAMPLE_ALPHA_TO_COVERAGE', 'SAMPLE_COVERAGE', 'RASTERIZER_DISCARD', 'DITHER'];
const pixelParameters = ['PACK_ALIGNMENT', 'PACK_ROW_LENGTH', 'PACK_SKIP_PIXELS', 'PACK_SKIP_ROWS',
  'UNPACK_ALIGNMENT', 'UNPACK_ROW_LENGTH', 'UNPACK_IMAGE_HEIGHT', 'UNPACK_SKIP_PIXELS', 'UNPACK_SKIP_ROWS',
  'UNPACK_SKIP_IMAGES', 'UNPACK_FLIP_Y_WEBGL', 'UNPACK_PREMULTIPLY_ALPHA_WEBGL', 'UNPACK_COLORSPACE_CONVERSION_WEBGL'];
const bufferTargets = ['ARRAY_BUFFER', 'COPY_READ_BUFFER', 'COPY_WRITE_BUFFER', 'PIXEL_PACK_BUFFER', 'PIXEL_UNPACK_BUFFER', 'UNIFORM_BUFFER'];
const textureTargets = ['TEXTURE_2D', 'TEXTURE_CUBE_MAP', 'TEXTURE_3D', 'TEXTURE_2D_ARRAY'];
const textureParameters = ['TEXTURE_BINDING_2D', 'TEXTURE_BINDING_CUBE_MAP', 'TEXTURE_BINDING_3D', 'TEXTURE_BINDING_2D_ARRAY'];
const copy = value => ArrayBuffer.isView(value) ? Array.from(value) : Array.isArray(value) ? [...value] : value;

/** Stateful composition fixture. It records draw packets, not GPU circle pixels. */
export function createSceneBridgeGl({ width = 640, height = 480, pixelRatio = 1 } = {}) {
  assert.ok(Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0 && Number.isFinite(pixelRatio) && pixelRatio > 0);
  const calls = [], draws = [], created = new Set(), deleted = new Set();
  const resources = new Map(), buffers = new Map(), textures = new Map(), framebuffers = new Map();
  const programs = new Map(), shaders = new Map(), syncs = new Map(), elementBuffers = new Map(), queries = new Map();
  const baseBindings = new Set(), readbacks = new Map(), pendingReadbacks = new Set();
  let sequence = 0, lost = false, coverage = [100, 1], fenceStatus, drawingColor = 'srgb', unpackColor = 'display-p3';
  const native = (kind, name) => {
    const result = Object.freeze({ kind, id: ++sequence, name });
    resources.set(result, kind);
    return result;
  };
  const nativeProgram = native('Program', 'native-program'), nativeVao = native('VertexArray', 'native-vao');
  const nativeRead = native('Framebuffer', 'native-read'), nativeHeight = native('Framebuffer', 'native-height');
  const state = new Map(Object.entries({
    MAX_DRAW_BUFFERS: 2, MAX_COLOR_ATTACHMENTS: 4, MAX_UNIFORM_BUFFER_BINDINGS: 6, MAX_VERTEX_ATTRIBS: 3, MAX_COMBINED_TEXTURE_IMAGE_UNITS: 4,
    CURRENT_PROGRAM: nativeProgram, VERTEX_ARRAY_BINDING: nativeVao,
    DRAW_FRAMEBUFFER_BINDING: null, READ_FRAMEBUFFER_BINDING: nativeRead, RENDERBUFFER_BINDING: native('Renderbuffer', 'native-rbo'),
    ACTIVE_TEXTURE: 0x84c1, COLOR_WRITEMASK: [true, false, true, false], COLOR_CLEAR_VALUE: [0.2, 0.3, 0.4, 0.5],
    DEPTH_WRITEMASK: true, DEPTH_FUNC: 'LEQUAL', DEPTH_RANGE: [0, 1], DEPTH_CLEAR_VALUE: 0.5,
    STENCIL_FUNC: 'LESS', STENCIL_REF: 3, STENCIL_VALUE_MASK: 15, STENCIL_WRITEMASK: 31,
    STENCIL_FAIL: 'INCR', STENCIL_PASS_DEPTH_FAIL: 'DECR', STENCIL_PASS_DEPTH_PASS: 'REPLACE',
    STENCIL_BACK_FUNC: 'GEQUAL', STENCIL_BACK_REF: 7, STENCIL_BACK_VALUE_MASK: 63, STENCIL_BACK_WRITEMASK: 127,
    STENCIL_BACK_FAIL: 'INVERT', STENCIL_BACK_PASS_DEPTH_FAIL: 'ZERO', STENCIL_BACK_PASS_DEPTH_PASS: 'KEEP', STENCIL_CLEAR_VALUE: 5,
    BLEND_EQUATION_RGB: 'FUNC_SUBTRACT', BLEND_EQUATION_ALPHA: 'FUNC_REVERSE_SUBTRACT',
    BLEND_SRC_RGB: 'SRC_ALPHA', BLEND_DST_RGB: 'ONE_MINUS_SRC_ALPHA', BLEND_SRC_ALPHA: 'ONE', BLEND_DST_ALPHA: 'ZERO',
    BLEND_COLOR: [0.1, 0.2, 0.3, 0.4], CULL_FACE_MODE: 'FRONT', FRONT_FACE: 'CW',
    POLYGON_OFFSET_FACTOR: 2, POLYGON_OFFSET_UNITS: 3, SAMPLE_COVERAGE_VALUE: 0.5, SAMPLE_COVERAGE_INVERT: true,
    LINE_WIDTH: 2, VIEWPORT: [0, 0, Math.round(width * pixelRatio), Math.round(height * pixelRatio)], SCISSOR_BOX: [19, 23, 101, 83],
    TRANSFORM_FEEDBACK_ACTIVE: false, TRANSFORM_FEEDBACK_PAUSED: false
  }));
  for (const target of bufferTargets) {
    const buffer = native('Buffer', `native-${target}`);
    state.set(`${target}_BINDING`, buffer); buffers.set(buffer, new Uint8Array(512));
  }
  for (const name of pixelParameters) state.set(name, name.endsWith('ALIGNMENT') ? 8 : name.includes('WEBGL') ? true : 2);
  state.set('UNPACK_COLORSPACE_CONVERSION_WEBGL', 'BROWSER_DEFAULT_WEBGL');
  const enabled = new Set(capabilities);
  const units = Array.from({ length: 4 }, (_, index) => ({
    textures: textureTargets.map(target => native('Texture', `unit-${index}-${target}`)), sampler: native('Sampler', `sampler-${index}`)
  }));
  const ubos = Array.from({ length: 6 }, (_, index) => index === 1 ? { buffer: null, start: 0, size: 0 } : {
    buffer: native('Buffer', `native-ubo-${index}`), start: index * 16, size: 48 + index * 16
  });
  for (const binding of ubos) if (binding.buffer) buffers.set(binding.buffer, new Uint8Array(512));
  const attributes = [new Float32Array([0.25, 0.5, 0.75, 1]), new Int32Array([-2, 3, 4, 5]), new Uint32Array([2, 3, 4, 5])];
  elementBuffers.set(null, native('Buffer', 'default-element-buffer'));
  elementBuffers.set(nativeVao, native('Buffer', 'entry-element-buffer'));
  const gl = { TEXTURE0: 0x84c0, DRAW_BUFFER0: 0x8825, COLOR_ATTACHMENT0: 0x8ce0, COLOR_ATTACHMENT1: 0x8ce1,
    COLOR_BUFFER_BIT: 0x4000, DEPTH_BUFFER_BIT: 0x100, STENCIL_BUFFER_BIT: 0x400,
    drawingBufferWidth: Math.round(width * pixelRatio), drawingBufferHeight: Math.round(height * pixelRatio) };
  for (const name of [...state.keys(), ...capabilities, ...pixelParameters, ...bufferTargets, ...textureTargets, ...textureParameters,
    'CURRENT_QUERY', 'CURRENT_VERTEX_ATTRIB', 'ANY_SAMPLES_PASSED', 'ANY_SAMPLES_PASSED_CONSERVATIVE', 'TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN',
    'UNIFORM_BUFFER_START', 'UNIFORM_BUFFER_SIZE', 'DRAW_FRAMEBUFFER', 'READ_FRAMEBUFFER', 'FRAMEBUFFER', 'RENDERBUFFER',
    'FRONT', 'BACK', 'FRONT_AND_BACK', 'NONE', 'BROWSER_DEFAULT_WEBGL', 'SAMPLER_BINDING', 'ELEMENT_ARRAY_BUFFER', 'ELEMENT_ARRAY_BUFFER_BINDING',
    'FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE', 'FRAMEBUFFER_ATTACHMENT_OBJECT_NAME', 'TEXTURE', 'RGBA32F', 'RGBA', 'FLOAT', 'UNSIGNED_BYTE',
    'TEXTURE_MIN_FILTER', 'TEXTURE_MAG_FILTER', 'TEXTURE_WRAP_S', 'TEXTURE_WRAP_T', 'NEAREST', 'CLAMP_TO_EDGE', 'FRAMEBUFFER_COMPLETE',
    'STREAM_READ', 'DYNAMIC_DRAW', 'STATIC_DRAW', 'SYNC_GPU_COMMANDS_COMPLETE', 'TIMEOUT_EXPIRED', 'WAIT_FAILED', 'ALREADY_SIGNALED', 'CONDITION_SATISFIED',
    'FRAGMENT_SHADER', 'VERTEX_SHADER', 'COMPILE_STATUS', 'LINK_STATUS', 'TRIANGLE_STRIP', 'TRIANGLES', 'POINTS', 'LEQUAL', 'ALWAYS',
    'ONE', 'ZERO', 'ONE_MINUS_SRC_ALPHA', 'FUNC_ADD', 'CCW', 'NO_ERROR']) if (!(name in gl)) gl[name] = name;
  gl.FRAMEBUFFER_BINDING = gl.DRAW_FRAMEBUFFER_BINDING;
  const fboRecord = framebuffer => {
    assert.ok(framebuffer === null || resources.get(framebuffer) === 'Framebuffer');
    if (!framebuffers.has(framebuffer)) framebuffers.set(framebuffer, {
      attachments: new Map(), drawBuffers: framebuffer === null ? [gl.BACK, gl.NONE] : [gl.COLOR_ATTACHMENT0, gl.NONE],
      readBuffer: framebuffer === null ? gl.BACK : gl.COLOR_ATTACHMENT0
    });
    return framebuffers.get(framebuffer);
  };
  for (const framebuffer of [null, nativeRead, nativeHeight]) fboRecord(framebuffer);
  programs.set(nativeProgram, { uniforms: new Map(), attached: new Set(), linked: true });
  gl.canvas = { width: gl.drawingBufferWidth, height: gl.drawingBufferHeight, clientWidth: width, clientHeight: height,
    addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width, height, right: width, bottom: height }) };
  const fixture = { gl, calls, draws, created, deleted, state, values: state, enabled, units, ubos, attributes, queries,
    buffers, textures, framebuffers, elementBuffers, programs, shaders, nativeFramebuffer: nativeHeight,
    beforeCall: undefined, afterCall: undefined };
  const call = (name, args, work) => {
    calls.push([name, ...args]);
    assert.equal(lost, false, `${name} after context loss`);
    fixture.beforeCall?.(name, args);
    assert.equal(lost, false, `${name} lost during beforeCall`);
    const result = work();
    fixture.afterCall?.(name, args, result);
    return result;
  };
  const method = (name, work) => {
    gl[name] = function (...args) { assert.equal(this, gl, `${name} requires GL receiver`); return call(name, args, () => work(...args)); };
  };
  const liveHandle = (value, kind) => assert.ok(value === null || resources.get(value) === kind && !deleted.has(value), `live ${kind} handle`);
  const create = kind => { const resource = native(kind, `owned-${kind}-${sequence + 1}`); created.add(resource); return resource; };
  const binding = target => target === gl.ELEMENT_ARRAY_BUFFER ? elementBuffers.get(state.get('VERTEX_ARRAY_BINDING')) ?? null : state.get(`${target}_BINDING`);
  const selectedUnit = () => units[state.get('ACTIVE_TEXTURE') - gl.TEXTURE0];
  const framebufferFor = target => {
    assert.ok([gl.FRAMEBUFFER, gl.DRAW_FRAMEBUFFER, gl.READ_FRAMEBUFFER].includes(target));
    return state.get(target === gl.READ_FRAMEBUFFER ? 'READ_FRAMEBUFFER_BINDING' : 'DRAW_FRAMEBUFFER_BINDING');
  };
  const textureFor = target => {
    const index = textureTargets.indexOf(target); assert.ok(index >= 0);
    return selectedUnit().textures[index];
  };
  const attachmentTexture = (target, readSelection = false) => {
    const framebuffer = framebufferFor(target); assert.notEqual(framebuffer, null);
    const record = fboRecord(framebuffer), attachment = readSelection ? record.readBuffer : gl.COLOR_ATTACHMENT0;
    assert.equal(attachment, gl.COLOR_ATTACHMENT0, 'read selection addresses the modeled color attachment');
    const texture = record.attachments.get(attachment);
    assert.ok(texture && textures.has(texture), 'framebuffer has allocated color texture');
    return textures.get(texture);
  };
  const insideScissor = (x, y) => {
    const box = state.get('SCISSOR_BOX');
    return !enabled.has(gl.SCISSOR_TEST) || x >= box[0] && y >= box[1] && x < box[0] + box[2] && y < box[1] + box[3];
  };
  const writePixel = (texture, x, y, rgba) => {
    const selection = fboRecord(state.get('DRAW_FRAMEBUFFER_BINDING')).drawBuffers[0];
    if (selection === gl.NONE) return;
    assert.equal(selection, gl.COLOR_ATTACHMENT0, 'draw selection addresses the modeled color attachment');
    if (!insideScissor(x, y)) return;
    assert.ok(x >= 0 && y >= 0 && x < texture.width && y < texture.height);
    const mask = state.get('COLOR_WRITEMASK');
    for (let channel = 0; channel < 4; channel++) if (mask[channel]) texture.rgba[(y * texture.width + x) * 4 + channel] = rgba[channel];
  };
  const snapshot = () => ({
    values: [...state].map(([key, value]) => [key, copy(value)]), enabled: [...enabled].sort(),
    units: units.map(unit => ({ textures: [...unit.textures], sampler: unit.sampler })), ubos: ubos.map(value => ({ ...value })),
    attributes: attributes.map(value => ({ type: value.constructor.name, value: [...value] })),
    drawBuffers: [...fboRecord(state.get('DRAW_FRAMEBUFFER_BINDING')).drawBuffers],
    readBuffer: fboRecord(state.get('READ_FRAMEBUFFER_BINDING')).readBuffer,
    drawingColor, unpackColor, defaultElementBuffer: elementBuffers.get(null), entryElementBuffer: elementBuffers.get(nativeVao)
  });
  fixture.snapshot = snapshot;
  fixture.lose = () => { lost = true; calls.push(['context-loss']); };
  const initialState = new Map([...state].map(([key, value]) => [key, copy(value)]));
  fixture.restore = () => {
    assert.equal(lost, true);
    // Model a restored context after its native owner reestablishes the entry bindings.
    // Previous custom resources cease to exist without forwarding deletion calls.
    for (const resource of created) deleted.add(resource);
    for (const [key, value] of initialState) state.set(key, copy(value));
    for (const record of framebuffers.values()) record.attachments.clear();
    readbacks.clear(); pendingReadbacks.clear(); syncs.clear();
    lost = false; calls.push(['context-restored']);
  };
  fixture.setCoverage = (heightValue, alpha) => { assert.ok(Number.isFinite(heightValue) && (alpha === 0 || alpha === 1)); coverage = [heightValue, alpha]; };
  fixture.signal = () => { for (const sync of syncs.values()) sync.signaled = true; };
  fixture.setFenceStatus = status => { assert.ok(status === undefined || [gl.TIMEOUT_EXPIRED, gl.WAIT_FAILED, gl.ALREADY_SIGNALED, gl.CONDITION_SATISFIED].includes(status)); fenceStatus = status; };
  gl.isContextLost = function () { assert.equal(this, gl); calls.push(['isContextLost']); return lost; };
  for (const name of ['drawingBufferColorSpace', 'unpackColorSpace']) Object.defineProperty(gl, name, {
    get() { assert.equal(this, gl); return call(`get:${name}`, [], () => name === 'drawingBufferColorSpace' ? drawingColor : unpackColor); },
    set(value) { assert.equal(this, gl); call(`set:${name}`, [value], () => { if (name === 'drawingBufferColorSpace') drawingColor = value; else unpackColor = value; }); }
  });
  method('getParameter', parameter => {
    if (parameter === gl.ELEMENT_ARRAY_BUFFER_BINDING) return binding(gl.ELEMENT_ARRAY_BUFFER);
    if (textureParameters.includes(parameter)) return selectedUnit().textures[textureParameters.indexOf(parameter)];
    if (parameter === gl.SAMPLER_BINDING) return selectedUnit().sampler;
    if (parameter === gl.READ_BUFFER) return fboRecord(state.get('READ_FRAMEBUFFER_BINDING')).readBuffer;
    if (parameter === gl.DRAW_BUFFER0 || parameter === gl.DRAW_BUFFER0 + 1) return fboRecord(state.get('DRAW_FRAMEBUFFER_BINDING')).drawBuffers[parameter - gl.DRAW_BUFFER0];
    assert.ok(state.has(parameter), `known parameter ${parameter}`); return copy(state.get(parameter));
  });
  gl.READ_BUFFER = 'READ_BUFFER';
  method('getIndexedParameter', (parameter, index) => {
    assert.ok(index >= 0 && index < ubos.length);
    if (parameter === gl.UNIFORM_BUFFER_BINDING) return ubos[index].buffer;
    if (parameter === gl.UNIFORM_BUFFER_START) return ubos[index].start;
    assert.equal(parameter, gl.UNIFORM_BUFFER_SIZE); return ubos[index].size;
  });
  method('getVertexAttrib', (index, parameter) => { assert.equal(parameter, gl.CURRENT_VERTEX_ATTRIB); return attributes[index].slice(); });
  for (const [name, Type] of [['vertexAttrib4fv', Float32Array], ['vertexAttribI4iv', Int32Array], ['vertexAttribI4uiv', Uint32Array]]) method(name, (index, value) => { attributes[index] = new Type(value); });
  method('getQuery', (target, parameter) => { assert.equal(parameter, gl.CURRENT_QUERY); return queries.get(target) ?? null; });
  method('getExtension', name => {
    if (name === 'EXT_color_buffer_float') return {};
    assert.equal(name, 'EXT_disjoint_timer_query_webgl2'); return null;
  });
  method('isEnabled', capability => enabled.has(capability));
  method('enable', capability => { assert.ok(capabilities.includes(capability)); enabled.add(capability); });
  method('disable', capability => { assert.ok(capabilities.includes(capability)); enabled.delete(capability); });
  for (const kind of ['Buffer', 'Texture', 'Framebuffer', 'VertexArray', 'Shader', 'Program']) {
    method(`create${kind}`, (...args) => {
      const value = create(kind);
      if (kind === 'Buffer') buffers.set(value, new Uint8Array());
      if (kind === 'Texture') textures.set(value, { width: 0, height: 0, rgba: null, parameters: new Map() });
      if (kind === 'Framebuffer') fboRecord(value);
      if (kind === 'VertexArray') elementBuffers.set(value, null);
      if (kind === 'Shader') shaders.set(value, { type: args[0], source: '', compiled: false });
      if (kind === 'Program') programs.set(value, { uniforms: new Map(), attached: new Set(), linked: false });
      return value;
    });
    method(`delete${kind}`, value => {
      if (value === null) return;
      liveHandle(value, kind); assert.ok(created.has(value), 'delete only fixture-owned resources');
      if (kind === 'Program') assert.notEqual(state.get('CURRENT_PROGRAM'), value, 'restore the host program before retiring an owned program');
      if (kind === 'Shader') assert.equal([...programs].some(([program, record]) => !deleted.has(program) && record.attached.has(value)), false,
        'retire attached programs before counting shader storage as deleted');
      deleted.add(value);
      if (kind === 'Buffer') {
        for (const [key, current] of state) if (key.endsWith('_BUFFER_BINDING') && current === value) state.set(key, null);
        for (const entry of ubos) if (entry.buffer === value) Object.assign(entry, { buffer: null, start: 0, size: 0 });
        for (const [vao, current] of elementBuffers) if (current === value) elementBuffers.set(vao, null);
      }
      if (kind === 'Texture') {
        for (const unit of units) unit.textures = unit.textures.map(texture => texture === value ? null : texture);
        // Only currently bound FBOs lose their attachment; unbound FBO retention remains observable.
        for (const framebuffer of [state.get('DRAW_FRAMEBUFFER_BINDING'), state.get('READ_FRAMEBUFFER_BINDING')]) {
          for (const [attachment, texture] of fboRecord(framebuffer).attachments) if (texture === value) fboRecord(framebuffer).attachments.delete(attachment);
        }
      }
      if (kind === 'Framebuffer') for (const key of ['DRAW_FRAMEBUFFER_BINDING', 'READ_FRAMEBUFFER_BINDING']) if (state.get(key) === value) state.set(key, null);
      if (kind === 'VertexArray' && state.get('VERTEX_ARRAY_BINDING') === value) state.set('VERTEX_ARRAY_BINDING', null);
    });
    method(`is${kind}`, value => value !== null && resources.get(value) === kind && !deleted.has(value));
  }
  method('bindBuffer', (target, value) => {
    liveHandle(value, 'Buffer');
    if (target === gl.ELEMENT_ARRAY_BUFFER) elementBuffers.set(state.get('VERTEX_ARRAY_BINDING'), value);
    else { assert.ok(bufferTargets.includes(target)); state.set(`${target}_BINDING`, value); }
  });
  method('bindBufferBase', (target, index, value) => {
    assert.equal(target, gl.UNIFORM_BUFFER); liveHandle(value, 'Buffer'); assert.ok(index >= 0 && index < ubos.length);
    baseBindings.add(index);
    ubos[index] = { buffer: value, start: 0, size: value ? buffers.get(value)?.byteLength ?? 0 : 0 }; state.set('UNIFORM_BUFFER_BINDING', value);
  });
  method('bindBufferRange', (target, index, value, start, size) => {
    assert.equal(target, gl.UNIFORM_BUFFER); liveHandle(value, 'Buffer'); assert.ok(index >= 0 && index < ubos.length);
    baseBindings.delete(index);
    ubos[index] = { buffer: value, start, size }; state.set('UNIFORM_BUFFER_BINDING', value);
  });
  method('bufferData', (target, data, usage) => {
    assert.ok([gl.STREAM_READ, gl.STATIC_DRAW, gl.DYNAMIC_DRAW].includes(usage));
    const buffer = binding(target); liveHandle(buffer, 'Buffer'); assert.ok(buffer);
    const bytes = typeof data === 'number' ? new Uint8Array(data) : new Uint8Array(data.buffer, data.byteOffset, data.byteLength).slice();
    buffers.set(buffer, bytes);
    readbacks.delete(buffer);
    for (const index of baseBindings) if (ubos[index].buffer === buffer) ubos[index].size = bytes.byteLength;
  });
  method('bufferSubData', (target, offset, data) => {
    const buffer = binding(target); liveHandle(buffer, 'Buffer'); assert.ok(buffer);
    buffers.get(buffer).set(new Uint8Array(data.buffer, data.byteOffset, data.byteLength), offset);
  });
  method('activeTexture', value => { assert.ok(Number.isInteger(value) && units[value - gl.TEXTURE0]); state.set('ACTIVE_TEXTURE', value); });
  method('bindTexture', (target, value) => { liveHandle(value, 'Texture'); const index = textureTargets.indexOf(target); assert.ok(index >= 0); selectedUnit().textures[index] = value; });
  method('bindSampler', (index, value) => { liveHandle(value, 'Sampler'); assert.ok(units[index]); units[index].sampler = value; });
  method('texStorage2D', (target, levels, format, w, h) => {
    assert.equal(target, gl.TEXTURE_2D); assert.equal(levels, 1); assert.equal(format, gl.RGBA32F);
    assert.equal(state.get('PIXEL_UNPACK_BUFFER_BINDING'), null);
    const texture = textures.get(textureFor(target)); assert.ok(texture && w > 0 && h > 0);
    Object.assign(texture, { width: w, height: h, rgba: new Float32Array(w * h * 4) });
  });
  method('texParameteri', (target, parameter, value) => { const texture = textures.get(textureFor(target)); assert.ok(texture); texture.parameters.set(parameter, value); });
  method('bindFramebuffer', (target, value) => {
    liveHandle(value, 'Framebuffer'); fboRecord(value);
    assert.ok([gl.FRAMEBUFFER, gl.DRAW_FRAMEBUFFER, gl.READ_FRAMEBUFFER].includes(target));
    if (target === gl.FRAMEBUFFER || target === gl.DRAW_FRAMEBUFFER) state.set('DRAW_FRAMEBUFFER_BINDING', value);
    if (target === gl.FRAMEBUFFER || target === gl.READ_FRAMEBUFFER) state.set('READ_FRAMEBUFFER_BINDING', value);
  });
  method('framebufferTexture2D', (target, attachment, textureTarget, texture, level) => {
    const framebuffer = framebufferFor(target); assert.notEqual(framebuffer, null);
    assert.equal(attachment, gl.COLOR_ATTACHMENT0); assert.equal(textureTarget, gl.TEXTURE_2D); assert.equal(level, 0); liveHandle(texture, 'Texture');
    if (texture === null) fboRecord(framebuffer).attachments.delete(attachment); else fboRecord(framebuffer).attachments.set(attachment, texture);
  });
  method('getFramebufferAttachmentParameter', (target, attachment, parameter) => {
    assert.equal(attachment, gl.COLOR_ATTACHMENT0);
    const texture = fboRecord(framebufferFor(target)).attachments.get(attachment) ?? null;
    if (parameter === gl.FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE) return texture === null ? gl.NONE : gl.TEXTURE;
    assert.equal(parameter, gl.FRAMEBUFFER_ATTACHMENT_OBJECT_NAME); return texture;
  });
  method('checkFramebufferStatus', target => { attachmentTexture(target); return gl.FRAMEBUFFER_COMPLETE; });
  method('drawBuffers', values => {
    const framebuffer = state.get('DRAW_FRAMEBUFFER_BINDING');
    assert.ok(values.length > 0 && values.length <= (framebuffer === null ? 1 : 2));
    values.forEach((value, index) => assert.ok(value === gl.NONE || value === (framebuffer === null ? gl.BACK : gl.COLOR_ATTACHMENT0 + index)));
    fboRecord(framebuffer).drawBuffers = [values[0], values[1] ?? gl.NONE];
  });
  method('readBuffer', value => {
    const framebuffer = state.get('READ_FRAMEBUFFER_BINDING');
    assert.ok(value === gl.NONE || value === (framebuffer === null ? gl.BACK : gl.COLOR_ATTACHMENT0)); fboRecord(framebuffer).readBuffer = value;
  });
  method('copyTexSubImage2D', (target, level, xoffset, yoffset, x, y, w, h) => {
    assert.equal(target, gl.TEXTURE_2D); assert.equal(level, 0);
    const source = attachmentTexture(gl.READ_FRAMEBUFFER, true), destination = textures.get(textureFor(target)); assert.ok(destination?.rgba);
    for (let row = 0; row < h; row++) for (let column = 0; column < w; column++) {
      assert.ok(x + column < source.width && y + row < source.height && xoffset + column < destination.width && yoffset + row < destination.height);
      destination.rgba.set(source.rgba.subarray(((y + row) * source.width + x + column) * 4, ((y + row) * source.width + x + column) * 4 + 4), ((yoffset + row) * destination.width + xoffset + column) * 4);
    }
  });
  method('readPixels', (x, y, w, h, format, type, offset) => {
    assert.equal(format, gl.RGBA); assert.equal(type, gl.FLOAT); assert.ok(Number.isSafeInteger(offset));
    const source = attachmentTexture(gl.READ_FRAMEBUFFER, true), buffer = binding(gl.PIXEL_PACK_BUFFER); assert.ok(buffer);
    assert.equal(state.get('PACK_ROW_LENGTH'), 0); assert.equal(state.get('PACK_SKIP_PIXELS'), 0); assert.equal(state.get('PACK_SKIP_ROWS'), 0);
    const destination = new Float32Array(buffers.get(buffer).buffer);
    for (let row = 0; row < h; row++) for (let column = 0; column < w; column++) destination.set(source.rgba.subarray(((y + row) * source.width + x + column) * 4, ((y + row) * source.width + x + column) * 4 + 4), offset / 4 + (row * w + column) * 4);
    const submission = { buffer, fence: null, waited: false };
    readbacks.set(buffer, submission); pendingReadbacks.add(submission);
  });
  method('fenceSync', (condition, flags) => {
    assert.equal(condition, gl.SYNC_GPU_COMMANDS_COMPLETE); assert.equal(flags, 0);
    const sync = create('Sync'), submissions = [...pendingReadbacks];
    for (const submission of submissions) submission.fence = sync;
    pendingReadbacks.clear(); syncs.set(sync, { signaled: false, submissions }); return sync;
  });
  method('flush', () => { for (const sync of syncs.values()) sync.signaled = true; });
  method('clientWaitSync', (sync, flags, timeout) => {
    liveHandle(sync, 'Sync'); assert.equal(flags, 0); assert.equal(timeout, 0);
    const record = syncs.get(sync), status = fenceStatus ?? (record.signaled ? gl.CONDITION_SATISFIED : gl.TIMEOUT_EXPIRED);
    if (status === gl.CONDITION_SATISFIED || status === gl.ALREADY_SIGNALED) {
      record.signaled = true;
      for (const submission of record.submissions) submission.waited = true;
    }
    return status;
  });
  method('deleteSync', sync => { liveHandle(sync, 'Sync'); assert.ok(created.has(sync)); deleted.add(sync); });
  method('getBufferSubData', (target, offset, destination) => {
    assert.equal(target, gl.PIXEL_PACK_BUFFER);
    const buffer = binding(target), submission = readbacks.get(buffer);
    assert.ok(submission?.fence && !deleted.has(submission.fence) && submission.waited,
      'the current PBO submission requires a successful wait on its corresponding fence');
    const source = buffers.get(buffer); assert.ok(source && offset >= 0 && offset + destination.byteLength <= source.byteLength);
    new Uint8Array(destination.buffer, destination.byteOffset, destination.byteLength).set(source.subarray(offset, offset + destination.byteLength));
  });
  method('bindRenderbuffer', (target, value) => { assert.equal(target, gl.RENDERBUFFER); liveHandle(value, 'Renderbuffer'); state.set('RENDERBUFFER_BINDING', value); });
  method('pixelStorei', (parameter, value) => { assert.ok(pixelParameters.includes(parameter)); state.set(parameter, value); });
  const scalar = (name, key) => method(name, value => state.set(key, value));
  const tuple = (name, key) => method(name, (...values) => state.set(key, values));
  for (const [name, key] of [['depthMask', 'DEPTH_WRITEMASK'], ['depthFunc', 'DEPTH_FUNC'], ['clearDepth', 'DEPTH_CLEAR_VALUE'],
    ['clearStencil', 'STENCIL_CLEAR_VALUE'], ['cullFace', 'CULL_FACE_MODE'], ['frontFace', 'FRONT_FACE'], ['lineWidth', 'LINE_WIDTH']]) scalar(name, key);
  for (const [name, key] of [['colorMask', 'COLOR_WRITEMASK'], ['clearColor', 'COLOR_CLEAR_VALUE'], ['depthRange', 'DEPTH_RANGE'],
    ['blendColor', 'BLEND_COLOR'], ['viewport', 'VIEWPORT'], ['scissor', 'SCISSOR_BOX']]) tuple(name, key);
  const faces = face => { assert.ok([gl.FRONT, gl.BACK, gl.FRONT_AND_BACK].includes(face)); return face === gl.FRONT_AND_BACK ? ['STENCIL', 'STENCIL_BACK'] : [face === gl.FRONT ? 'STENCIL' : 'STENCIL_BACK']; };
  method('stencilFuncSeparate', (face, func, ref, mask) => { for (const prefix of faces(face)) { state.set(`${prefix}_FUNC`, func); state.set(`${prefix}_REF`, ref); state.set(`${prefix}_VALUE_MASK`, mask); } });
  method('stencilMaskSeparate', (face, mask) => { for (const prefix of faces(face)) state.set(`${prefix}_WRITEMASK`, mask); });
  method('stencilOpSeparate', (face, fail, depthFail, pass) => { for (const prefix of faces(face)) { state.set(`${prefix}_FAIL`, fail); state.set(`${prefix}_PASS_DEPTH_FAIL`, depthFail); state.set(`${prefix}_PASS_DEPTH_PASS`, pass); } });
  method('blendEquationSeparate', (rgb, alpha) => { state.set('BLEND_EQUATION_RGB', rgb); state.set('BLEND_EQUATION_ALPHA', alpha); });
  method('blendFuncSeparate', (sr, dr, sa, da) => { for (const [key, value] of [['SRC_RGB', sr], ['DST_RGB', dr], ['SRC_ALPHA', sa], ['DST_ALPHA', da]]) state.set(`BLEND_${key}`, value); });
  method('polygonOffset', (factor, unitsValue) => { state.set('POLYGON_OFFSET_FACTOR', factor); state.set('POLYGON_OFFSET_UNITS', unitsValue); });
  method('sampleCoverage', (value, invert) => { state.set('SAMPLE_COVERAGE_VALUE', value); state.set('SAMPLE_COVERAGE_INVERT', invert); });
  method('bindVertexArray', vao => { liveHandle(vao, 'VertexArray'); state.set('VERTEX_ARRAY_BINDING', vao); });
  method('shaderSource', (shader, source) => { liveHandle(shader, 'Shader'); shaders.get(shader).source = source; });
  method('compileShader', shader => { liveHandle(shader, 'Shader'); shaders.get(shader).compiled = true; });
  method('getShaderParameter', (shader, parameter) => { liveHandle(shader, 'Shader'); assert.equal(parameter, gl.COMPILE_STATUS); return shaders.get(shader).compiled; });
  method('attachShader', (program, shader) => { liveHandle(program, 'Program'); liveHandle(shader, 'Shader'); programs.get(program).attached.add(shader); });
  method('linkProgram', program => { liveHandle(program, 'Program'); const record = programs.get(program); record.linked = [...record.attached].every(shader => shaders.get(shader).compiled); });
  method('getProgramParameter', (program, parameter) => { liveHandle(program, 'Program'); assert.equal(parameter, gl.LINK_STATUS); return programs.get(program).linked; });
  method('getUniformLocation', (program, name) => { liveHandle(program, 'Program'); assert.ok(programs.get(program).linked); return Object.freeze({ program, name }); });
  method('useProgram', program => { liveHandle(program, 'Program'); state.set('CURRENT_PROGRAM', program); });
  const uniform = (name, length, matrix = false) => method(name, (location, ...args) => {
    if (location === null) return;
    assert.equal(location.program, state.get('CURRENT_PROGRAM')); liveHandle(location.program, 'Program');
    if (matrix) assert.equal(args.shift(), false);
    const value = args.length === 1 && typeof args[0] !== 'number' ? Array.from(args[0]) : args;
    assert.equal(value.length, length); assert.ok(value.every(Number.isFinite));
    programs.get(location.program).uniforms.set(location.name, [...value]);
  });
  for (const [name, length] of [['uniform1f', 1], ['uniform1i', 1], ['uniform2fv', 2], ['uniform3fv', 3], ['uniform4fv', 4], ['uniform2f', 2], ['uniform3f', 3], ['uniform4f', 4]]) uniform(name, length);
  uniform('uniformMatrix4fv', 16, true);
  method('drawArrays', (mode, first, count) => {
    assert.ok([gl.TRIANGLE_STRIP, gl.TRIANGLES, gl.POINTS].includes(mode));
    const program = state.get('CURRENT_PROGRAM'); liveHandle(program, 'Program'); assert.ok(program && programs.get(program).linked);
    assert.ok(Number.isSafeInteger(first) && first >= 0 && Number.isSafeInteger(count) && count >= 0);
    draws.push({ mode, first, count, program, vao: state.get('VERTEX_ARRAY_BINDING'),
      uniforms: Object.fromEntries([...programs.get(program).uniforms].map(([name, value]) => [name, [...value]])), state: snapshot(), enabled: [...enabled].sort() });
  });
  method('clear', mask => {
    if (!(mask & gl.COLOR_BUFFER_BIT)) return;
    if (fboRecord(state.get('DRAW_FRAMEBUFFER_BINDING')).drawBuffers[0] === gl.NONE) return;
    const texture = attachmentTexture(gl.DRAW_FRAMEBUFFER);
    for (let y = 0; y < texture.height; y++) for (let x = 0; x < texture.width; x++) writePixel(texture, x, y, state.get('COLOR_CLEAR_VALUE'));
  });
  method('getError', () => { assert.fail('composition must not drain the GL error queue'); });
  fixture.renderTerrainHeightMap = target => call('renderTerrainHeightMap', [target], () => {
    assert.equal(target.width, 1); assert.equal(target.height, 1);
    assert.ok(Array.isArray(target.bounds) && target.bounds.length === 4 && target.bounds.every(Number.isFinite));
    assert.ok(target.bounds[0] < target.bounds[2] && target.bounds[1] < target.bounds[3]);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, nativeHeight);
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
    gl.viewport(0, 0, 1, 1); gl.colorMask(true, true, true, true); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    if (!enabled.has(gl.RASTERIZER_DISCARD)) writePixel(attachmentTexture(gl.DRAW_FRAMEBUFFER), 0, 0, [coverage[0], 0, 0, coverage[1]]);
    gl.framebufferTexture2D(gl.DRAW_FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, null, 0);
  });
  return fixture;
}
