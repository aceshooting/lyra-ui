const fail = () => { throw new TypeError('Scene GL operation unavailable.'); };
const capabilities = ['BLEND', 'CULL_FACE', 'DEPTH_TEST', 'STENCIL_TEST', 'SCISSOR_TEST',
  'POLYGON_OFFSET_FILL', 'SAMPLE_ALPHA_TO_COVERAGE', 'SAMPLE_COVERAGE', 'RASTERIZER_DISCARD', 'DITHER'];
const scalars = ['CURRENT_PROGRAM', 'VERTEX_ARRAY_BINDING', 'ARRAY_BUFFER_BINDING',
  'DRAW_FRAMEBUFFER_BINDING', 'READ_FRAMEBUFFER_BINDING', 'COLOR_WRITEMASK', 'COLOR_CLEAR_VALUE',
  'DEPTH_WRITEMASK', 'DEPTH_FUNC', 'DEPTH_RANGE', 'DEPTH_CLEAR_VALUE',
  'STENCIL_FUNC', 'STENCIL_REF', 'STENCIL_VALUE_MASK', 'STENCIL_WRITEMASK',
  'STENCIL_FAIL', 'STENCIL_PASS_DEPTH_FAIL', 'STENCIL_PASS_DEPTH_PASS',
  'STENCIL_BACK_FUNC', 'STENCIL_BACK_REF', 'STENCIL_BACK_VALUE_MASK', 'STENCIL_BACK_WRITEMASK',
  'STENCIL_BACK_FAIL', 'STENCIL_BACK_PASS_DEPTH_FAIL', 'STENCIL_BACK_PASS_DEPTH_PASS', 'STENCIL_CLEAR_VALUE',
  'BLEND_EQUATION_RGB', 'BLEND_EQUATION_ALPHA', 'BLEND_SRC_RGB', 'BLEND_DST_RGB',
  'BLEND_SRC_ALPHA', 'BLEND_DST_ALPHA', 'BLEND_COLOR', 'CULL_FACE_MODE', 'FRONT_FACE',
  'POLYGON_OFFSET_FACTOR', 'POLYGON_OFFSET_UNITS', 'SAMPLE_COVERAGE_VALUE', 'SAMPLE_COVERAGE_INVERT',
  'LINE_WIDTH', 'VIEWPORT', 'SCISSOR_BOX'];
const tupleLengths = { COLOR_WRITEMASK: 4, COLOR_CLEAR_VALUE: 4, DEPTH_RANGE: 2,
  BLEND_COLOR: 4, VIEWPORT: 4, SCISSOR_BOX: 4 };

function rasterOperations(gl, state) {
  const operations = capabilities.map((name, index) => [state.enabled[index] ? 'enable' : 'disable', gl[name]]);
  operations.push(['colorMask', ...state.COLOR_WRITEMASK], ['clearColor', ...state.COLOR_CLEAR_VALUE],
    ['depthMask', state.DEPTH_WRITEMASK], ['depthFunc', state.DEPTH_FUNC], ['depthRange', ...state.DEPTH_RANGE],
    ['clearDepth', state.DEPTH_CLEAR_VALUE]);
  for (const [face, suffix] of [[gl.FRONT, ''], [gl.BACK, '_BACK']]) {
    operations.push(['stencilFuncSeparate', face, state[`STENCIL${suffix}_FUNC`], state[`STENCIL${suffix}_REF`], state[`STENCIL${suffix}_VALUE_MASK`]],
      ['stencilMaskSeparate', face, state[`STENCIL${suffix}_WRITEMASK`]],
      ['stencilOpSeparate', face, state[`STENCIL${suffix}_FAIL`], state[`STENCIL${suffix}_PASS_DEPTH_FAIL`], state[`STENCIL${suffix}_PASS_DEPTH_PASS`]]);
  }
  operations.push(['clearStencil', state.STENCIL_CLEAR_VALUE], ['blendEquationSeparate', state.BLEND_EQUATION_RGB, state.BLEND_EQUATION_ALPHA],
    ['blendFuncSeparate', state.BLEND_SRC_RGB, state.BLEND_DST_RGB, state.BLEND_SRC_ALPHA, state.BLEND_DST_ALPHA],
    ['blendColor', ...state.BLEND_COLOR], ['cullFace', state.CULL_FACE_MODE], ['frontFace', state.FRONT_FACE],
    ['polygonOffset', state.POLYGON_OFFSET_FACTOR, state.POLYGON_OFFSET_UNITS],
    ['sampleCoverage', state.SAMPLE_COVERAGE_VALUE, state.SAMPLE_COVERAGE_INVERT],
    ['lineWidth', state.LINE_WIDTH], ['viewport', ...state.VIEWPORT], ['scissor', ...state.SCISSOR_BOX]);
  return operations;
}

/**
 * Restores the declared state around trusted, synchronous point operations.
 * Work uses only owned programs, VAOs and array buffers plus admitted scalar raster state.
 * Native resource mutation, map/style reentry and asynchronous GL work are excluded;
 * host notifications must be deferred until after the operation returns.
 */
export function createSceneGlEnvelope(gl, options) {
  if (options?.profile === 'three-model' || options?.profile === 'terrain-point') return createCompleteEnvelope(gl, options);
  if (options?.profile !== 'point' || typeof options.isCurrent !== 'function' ||
      typeof gl?.isContextLost !== 'function' || typeof gl.bindVertexArray !== 'function' ||
      typeof gl.getQuery !== 'function') fail();
  const isCurrent = options.isCurrent;
  let disposed = false, running = false, lost = false;
  function liveContext() {
    if (lost) return false;
    if (gl.isContextLost()) { lost = true; return false; }
    return true;
  }
  function invoke(name, ...args) {
    if (!liveContext()) fail();
    const result = gl[name](...args);
    if (!liveContext()) fail();
    return result;
  }
  function current() {
    if (disposed || !liveContext()) return false;
    const result = isCurrent();
    return !disposed && Boolean(result) && liveContext();
  }
  function baseline() {
    if (!current()) fail();
    for (const name of ['ANY_SAMPLES_PASSED', 'ANY_SAMPLES_PASSED_CONSERVATIVE', 'TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN']) {
      if (invoke('getQuery', gl[name], gl.CURRENT_QUERY) !== null) fail();
    }
    const timer = invoke('getExtension', 'EXT_disjoint_timer_query_webgl2');
    if (timer && invoke('getQuery', timer.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) !== null) fail();
    // ACTIVE remains true while feedback is paused; never end or resume another owner's operation.
    if (invoke('getParameter', gl.TRANSFORM_FEEDBACK_ACTIVE)) fail();
    if (!current()) fail();
  }
  function capture() {
    const state = Object.create(null);
    for (const name of scalars) {
      const value = invoke('getParameter', gl[name]), length = tupleLengths[name];
      state[name] = length ? Array.from({ length }, (_, index) => value[index]) : value;
    }
    state.enabled = capabilities.map(name => invoke('isEnabled', gl[name]));
    for (const [name, validator] of [['CURRENT_PROGRAM', 'isProgram'],
      ['VERTEX_ARRAY_BINDING', 'isVertexArray'], ['ARRAY_BUFFER_BINDING', 'isBuffer']]) {
      if (state[name] !== null && !invoke(validator, state[name])) fail();
    }
    return state;
  }
  function restore(state) {
    let failed = false;
    const attempt = work => {
      try { work(); } catch { failed = true; }
    };
    for (const name of ['DRAW_FRAMEBUFFER_BINDING', 'READ_FRAMEBUFFER_BINDING']) {
      attempt(() => { if (invoke('getParameter', gl[name]) !== state[name]) failed = true; });
    }
    // Native/default VAO element bindings are untouched; restore the VAO before generic ARRAY_BUFFER.
    attempt(() => invoke('bindVertexArray', state.VERTEX_ARRAY_BINDING));
    attempt(() => invoke('bindBuffer', gl.ARRAY_BUFFER, state.ARRAY_BUFFER_BINDING));
    for (const [method, ...args] of rasterOperations(gl, state)) attempt(() => invoke(method, ...args));
    attempt(() => invoke('useProgram', state.CURRENT_PROGRAM));
    return !failed && liveContext();
  }
  return Object.freeze({
    run(work) {
      if (running || disposed || lost || typeof work !== 'function') fail();
      running = true;
      let state, result, failed = false;
      try {
        baseline(); state = capture();
        if (!current()) fail();
        result = work();
        if (result !== null && (typeof result === 'object' || typeof result === 'function') && typeof result.then === 'function') {
          void Promise.resolve(result).catch(() => undefined);
          fail();
        }
        if (!current()) fail();
      } catch { failed = true; }
      finally {
        if (state) {
          try {
            if (!restore(state)) failed = true;
          } catch { failed = true; }
        }
        running = false;
      }
      if (failed) fail();
      return result;
    },
    dispose() { disposed = true; }
  });
}

const bufferTargets = ['COPY_READ_BUFFER', 'COPY_WRITE_BUFFER', 'PIXEL_PACK_BUFFER', 'PIXEL_UNPACK_BUFFER', 'UNIFORM_BUFFER'];
const textureTargets = ['TEXTURE_2D', 'TEXTURE_CUBE_MAP', 'TEXTURE_3D', 'TEXTURE_2D_ARRAY'];
const textureParameters = ['TEXTURE_BINDING_2D', 'TEXTURE_BINDING_CUBE_MAP', 'TEXTURE_BINDING_3D', 'TEXTURE_BINDING_2D_ARRAY'];
const pixelParameters = ['PACK_ALIGNMENT', 'PACK_ROW_LENGTH', 'PACK_SKIP_PIXELS', 'PACK_SKIP_ROWS',
  'UNPACK_ALIGNMENT', 'UNPACK_ROW_LENGTH', 'UNPACK_IMAGE_HEIGHT', 'UNPACK_SKIP_PIXELS',
  'UNPACK_SKIP_ROWS', 'UNPACK_SKIP_IMAGES', 'UNPACK_FLIP_Y_WEBGL', 'UNPACK_PREMULTIPLY_ALPHA_WEBGL', 'UNPACK_COLORSPACE_CONVERSION_WEBGL'];
const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
function ownField(value, key) {
  if (!value || typeof value !== 'object') fail();
  const property = Object.getOwnPropertyDescriptor(value, key);
  if (!property || !Object.hasOwn(property, 'value')) fail();
  return property.value;
}
function copyTuple(value, length) {
  const result = Array.from({ length }, (_, index) => value[index]);
  if (!result.every(number => typeof number === 'number' && Number.isFinite(number))) fail();
  return Object.freeze(result);
}

/** Shared raw-state inventory with distinct model-target and numeric-terrain admission. */
function createCompleteEnvelope(gl, options) {
  const terrain = options.profile === 'terrain-point';
  const epoch = ownField(options, 'epoch'), isCurrent = ownField(options, 'isCurrent');
  const targetMetadata = terrain ? undefined : ownField(options, 'targetMetadata');
  if (!positiveInteger(epoch) || typeof isCurrent !== 'function' || !terrain && typeof targetMetadata !== 'function' ||
      typeof gl?.isContextLost !== 'function' || typeof gl.getIndexedParameter !== 'function' ||
      typeof gl.bindVertexArray !== 'function' || typeof gl.getQuery !== 'function') fail();
  let disposed = false, lost = false, active, limits;
  function liveContext() {
    if (lost) return false;
    if (gl.isContextLost()) { lost = true; return false; }
    return true;
  }
  function invoke(name, ...args) {
    if (!liveContext()) fail();
    return gl[name](...args);
  }
  const local = token => !disposed && !lost && active === token;
  function current(token) {
    if (!local(token)) return false;
    const admitted = isCurrent();
    return local(token) && Boolean(admitted) && liveContext();
  }
  function check(token) { if (!current(token)) fail(); }
  function preflight(token) {
    if (!liveContext()) fail();
    check(token);
    for (const name of ['ANY_SAMPLES_PASSED', 'ANY_SAMPLES_PASSED_CONSERVATIVE', 'TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN']) {
      if (invoke('getQuery', gl[name], gl.CURRENT_QUERY) !== null) fail();
    }
    const timer = invoke('getExtension', 'EXT_disjoint_timer_query_webgl2');
    if (timer && invoke('getQuery', timer.TIME_ELAPSED_EXT, gl.CURRENT_QUERY) !== null) fail();
    if (invoke('getParameter', gl.TRANSFORM_FEEDBACK_ACTIVE)) fail();
    check(token);
  }
  function readLimits() {
    if (limits) return limits;
    const result = Object.create(null);
    for (const name of ['MAX_DRAW_BUFFERS', 'MAX_COLOR_ATTACHMENTS', 'MAX_UNIFORM_BUFFER_BINDINGS', 'MAX_VERTEX_ATTRIBS', 'MAX_COMBINED_TEXTURE_IMAGE_UNITS']) {
      const value = invoke('getParameter', gl[name]);
      if (!positiveInteger(value)) fail();
      result[name] = value;
    }
    limits = Object.freeze(result);
    return limits;
  }
  function color(name) {
    if (!(name in gl)) return Object.freeze({ present: false });
    if (!liveContext()) fail();
    const value = Reflect.get(gl, name, gl);
    if (value !== 'srgb' && value !== 'display-p3') fail();
    return Object.freeze({ present: true, value });
  }
  function capture() {
    const counts = readLimits(), state = Object.create(null);
    for (const name of scalars) {
      const value = invoke('getParameter', gl[name]), length = tupleLengths[name];
      // Color masks contain booleans; numeric vector state is copied separately below.
      state[name] = length ? Object.freeze(Array.from({ length }, (_, index) => value[index])) : value;
    }
    for (const [name, validator] of [['CURRENT_PROGRAM', 'isProgram'], ['VERTEX_ARRAY_BINDING', 'isVertexArray'], ['ARRAY_BUFFER_BINDING', 'isBuffer']]) {
      if (state[name] !== null && !invoke(validator, state[name])) fail();
    }
    if (terrain) {
      const readElementBuffer = () => {
        const buffer = invoke('getParameter', gl.ELEMENT_ARRAY_BUFFER_BINDING);
        if (buffer !== null && !invoke('isBuffer', buffer)) fail();
        return buffer;
      };
      const entry = readElementBuffer();
      let defaultBuffer = entry;
      if (state.VERTEX_ARRAY_BINDING !== null) {
        try {
          invoke('bindVertexArray', null);
          defaultBuffer = readElementBuffer();
        } finally {
          if (liveContext()) invoke('bindVertexArray', state.VERTEX_ARRAY_BINDING);
        }
      }
      state.elementBuffers = Object.freeze({ entry, defaultBuffer });
    }
    state.enabled = Object.freeze(capabilities.map(name => invoke('isEnabled', gl[name])));
    state.RENDERBUFFER_BINDING = invoke('getParameter', gl.RENDERBUFFER_BINDING);
    state.READ_BUFFER = invoke('getParameter', gl.READ_BUFFER);
    const drawBufferCount = state.DRAW_FRAMEBUFFER_BINDING === null ? 1 : counts.MAX_DRAW_BUFFERS;
    state.drawBuffers = Object.freeze(Array.from({ length: drawBufferCount }, (_, index) => invoke('getParameter', gl.DRAW_BUFFER0 + index)));
    state.buffers = Object.freeze(bufferTargets.map(name => invoke('getParameter', gl[`${name}_BINDING`])));
    state.ubos = Object.freeze(Array.from({ length: counts.MAX_UNIFORM_BUFFER_BINDINGS }, (_, index) => {
      const buffer = invoke('getIndexedParameter', gl.UNIFORM_BUFFER_BINDING, index);
      const start = invoke('getIndexedParameter', gl.UNIFORM_BUFFER_START, index), size = invoke('getIndexedParameter', gl.UNIFORM_BUFFER_SIZE, index);
      if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(size) || size < 0 || (buffer === null && (start !== 0 || size !== 0))) fail();
      return Object.freeze({ buffer, start, size });
    }));
    state.attributes = Object.freeze(Array.from({ length: counts.MAX_VERTEX_ATTRIBS }, (_, index) => {
      const value = invoke('getVertexAttrib', index, gl.CURRENT_VERTEX_ATTRIB);
      const type = value instanceof Float32Array ? 'vertexAttrib4fv' : value instanceof Int32Array ? 'vertexAttribI4iv' : value instanceof Uint32Array ? 'vertexAttribI4uiv' : undefined;
      if (!type || value.length !== 4) fail();
      return Object.freeze({ method: type, value: copyTuple(value, 4) });
    }));
    state.ACTIVE_TEXTURE = invoke('getParameter', gl.ACTIVE_TEXTURE);
    const units = [];
    try {
      for (let index = 0; index < counts.MAX_COMBINED_TEXTURE_IMAGE_UNITS; index++) {
        if (!liveContext()) fail();
        invoke('activeTexture', gl.TEXTURE0 + index);
        units.push(Object.freeze({ textures: Object.freeze(textureParameters.map(name => invoke('getParameter', gl[name]))),
          sampler: invoke('getParameter', gl.SAMPLER_BINDING) }));
      }
    } finally {
      if (liveContext()) invoke('activeTexture', state.ACTIVE_TEXTURE);
    }
    state.units = Object.freeze(units);
    state.pixels = Object.freeze(pixelParameters.map(name => invoke('getParameter', gl[name])));
    state.drawingColor = color('drawingBufferColorSpace');
    state.unpackColor = color('unpackColorSpace');
    return state;
  }
  function legalBuffers(state) {
    const draw = state.DRAW_FRAMEBUFFER_BINDING;
    if (draw === null) {
      if ((state.drawBuffers[0] !== gl.BACK && state.drawBuffers[0] !== gl.NONE) ||
          state.drawBuffers.slice(1).some(value => value !== gl.NONE)) fail();
    } else if (state.drawBuffers.some((value, index) => value !== gl.NONE && value !== gl.COLOR_ATTACHMENT0 + index)) fail();
    const read = state.READ_BUFFER;
    if (state.READ_FRAMEBUFFER_BINDING === null) {
      if (read !== gl.BACK && read !== gl.NONE) fail();
    } else if (read !== gl.NONE && (!Number.isSafeInteger(read) || read < gl.COLOR_ATTACHMENT0 || read >= gl.COLOR_ATTACHMENT0 + limits.MAX_COLOR_ATTACHMENTS)) fail();
  }
  function target(token, state, operation) {
    const supplied = targetMetadata();
    check(token);
    const draw = ownField(supplied, 'draw'), width = ownField(supplied, 'width'), height = ownField(supplied, 'height');
    const outputPolicy = ownField(supplied, 'outputPolicy');
    if (draw !== state.DRAW_FRAMEBUFFER_BINDING || !positiveInteger(width) || !positiveInteger(height) ||
        (outputPolicy !== 'default-srgb' && outputPolicy !== 'unsupported')) fail();
    if (outputPolicy === 'default-srgb' && (draw !== null || !state.drawingColor.present || state.drawingColor.value !== 'srgb')) fail();
    if (operation === 'frame' && outputPolicy !== 'default-srgb') fail();
    legalBuffers(state);
    const viewport = copyTuple(state.VIEWPORT, 4), scissor = copyTuple(state.SCISSOR_BOX, 4), depthRange = copyTuple(state.DEPTH_RANGE, 2);
    if (![...viewport, ...scissor].every(Number.isSafeInteger) || viewport[2] < 0 || viewport[3] < 0 || scissor[2] < 0 || scissor[3] < 0 ||
        depthRange.some(value => value < 0 || value > 1)) fail();
    if (invoke('getParameter', gl.DRAW_FRAMEBUFFER_BINDING) !== draw) fail();
    check(token);
    return Object.freeze({ draw, read: state.READ_FRAMEBUFFER_BINDING, width, height, viewport, scissor,
      scissorTest: state.enabled[capabilities.indexOf('SCISSOR_TEST')],
      drawBuffers: Object.freeze(draw === null ? [state.drawBuffers[0]] : [...state.drawBuffers]),
      readBuffer: state.READ_BUFFER, depthRange, depthFunc: state.DEPTH_FUNC, outputPolicy });
  }
  function uploadBaseline(state) {
    invoke('bindBuffer', gl.PIXEL_PACK_BUFFER, null); invoke('bindBuffer', gl.PIXEL_UNPACK_BUFFER, null);
    for (let index = 0; index < state.units.length; index++) invoke('bindSampler', index, null);
    invoke('activeTexture', gl.TEXTURE0);
    for (const name of pixelParameters) {
      const value = name.endsWith('ALIGNMENT') ? 4 : name === 'UNPACK_COLORSPACE_CONVERSION_WEBGL' ? gl.NONE :
        name === 'UNPACK_FLIP_Y_WEBGL' || name === 'UNPACK_PREMULTIPLY_ALPHA_WEBGL' ? false : 0;
      invoke('pixelStorei', gl[name], value);
    }
    invoke('disable', gl.RASTERIZER_DISCARD);
    if (terrain) invoke('disable', gl.SCISSOR_TEST);
  }
  function restore(state) {
    let failed = false;
    const attempt = work => {
      if (!liveContext()) { failed = true; return false; }
      try { work(); return true; } catch { failed = true; return false; }
    };
    const call = (name, ...args) => attempt(() => gl[name](...args));
    const drawBound = call('bindFramebuffer', gl.DRAW_FRAMEBUFFER, state.DRAW_FRAMEBUFFER_BINDING);
    const readBound = call('bindFramebuffer', gl.READ_FRAMEBUFFER, state.READ_FRAMEBUFFER_BINDING);
    if (drawBound) call('drawBuffers', state.DRAW_FRAMEBUFFER_BINDING === null ? [state.drawBuffers[0]] : [...state.drawBuffers]);
    if (readBound) call('readBuffer', state.READ_BUFFER);
    call('bindRenderbuffer', gl.RENDERBUFFER, state.RENDERBUFFER_BINDING);
    for (let index = 0; index < state.ubos.length; index++) {
      const { buffer, start, size } = state.ubos[index];
      if (buffer !== null && size > 0) call('bindBufferRange', gl.UNIFORM_BUFFER, index, buffer, start, size);
      else call('bindBufferBase', gl.UNIFORM_BUFFER, index, buffer);
    }
    for (let index = 0; index < bufferTargets.length; index++) call('bindBuffer', gl[bufferTargets[index]], state.buffers[index]);
    for (let index = 0; index < state.units.length; index++) {
      const selected = call('activeTexture', gl.TEXTURE0 + index);
      if (selected) for (let targetIndex = 0; targetIndex < textureTargets.length; targetIndex++) call('bindTexture', gl[textureTargets[targetIndex]], state.units[index].textures[targetIndex]);
      call('bindSampler', index, state.units[index].sampler);
    }
    call('activeTexture', state.ACTIVE_TEXTURE);
    for (let index = 0; index < state.attributes.length; index++) call(state.attributes[index].method, index, state.attributes[index].value);
    if (terrain) {
      if (call('bindVertexArray', null)) call('bindBuffer', gl.ELEMENT_ARRAY_BUFFER, state.elementBuffers.defaultBuffer);
      if (state.VERTEX_ARRAY_BINDING !== null && call('bindVertexArray', state.VERTEX_ARRAY_BINDING)) {
        call('bindBuffer', gl.ELEMENT_ARRAY_BUFFER, state.elementBuffers.entry);
      }
    } else call('bindVertexArray', state.VERTEX_ARRAY_BINDING);
    call('bindBuffer', gl.ARRAY_BUFFER, state.ARRAY_BUFFER_BINDING);
    for (const [method, ...args] of rasterOperations(gl, state)) call(method, ...args);
    for (let index = 0; index < pixelParameters.length; index++) call('pixelStorei', gl[pixelParameters[index]], state.pixels[index]);
    attempt(() => {
      const actual = color('drawingBufferColorSpace');
      if (actual.present !== state.drawingColor.present || actual.value !== state.drawingColor.value) fail();
    });
    attempt(() => {
      const actual = color('unpackColorSpace');
      if (actual.present !== state.unpackColor.present) fail();
      if (actual.present && actual.value !== state.unpackColor.value) {
        if (!Reflect.set(gl, 'unpackColorSpace', state.unpackColor.value, gl)) fail();
      }
    });
    call('useProgram', state.CURRENT_PROGRAM);
    return !failed;
  }
  return Object.freeze({
    run(operation, work) {
      if (terrain) { work = operation; operation = 'terrain'; }
      if (disposed || lost || active || !(terrain ? operation === 'terrain' : ['construct', 'frame', 'dispose'].includes(operation)) || typeof work !== 'function') fail();
      const token = {}; active = token;
      let state, result, failed = false;
      try {
        preflight(token); state = capture(); check(token);
        if (terrain) legalBuffers(state);
        const paintTarget = terrain ? undefined : target(token, state, operation);
        uploadBaseline(state); check(token);
        const entry = Object.freeze({ epoch, target: paintTarget, isCurrent() {
          try { return current(token); } catch { return false; }
        } });
        result = terrain ? work() : work(entry);
        if (result !== null && (typeof result === 'object' || typeof result === 'function') && typeof result.then === 'function') {
          void Promise.resolve(result).catch(() => undefined); fail();
        }
        check(token);
      } catch { failed = true; }
      finally {
        try { if (state && !restore(state)) failed = true; }
        catch { failed = true; }
        active = undefined;
      }
      if (failed) fail();
      return result;
    },
    dispose() { disposed = true; }
  });
}
