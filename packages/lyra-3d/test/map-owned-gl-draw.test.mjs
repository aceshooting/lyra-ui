import assert from 'node:assert/strict';
import test from 'node:test';
import { createDrawFixture, DRAW_ENUMS, DRAW_METHODS, uploadBuffer, createProgram,
  applyTarget, prepareTriangle, retireFixture } from './map-owned-gl-draw-fixture.mjs';

const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const noForward = (f, method, work) => {
  const before = f.callsOf(method).length; assert.throws(work); assert.equal(f.callsOf(method).length, before);
};

test('omitted and explicit constructor profiles preserve their restricted manifest', () => {
  for (const profile of [undefined, 'constructor']) {
    const f = createDrawFixture({ profile });
    f.owner.run(f.entry, gl => {
      assert.throws(() => gl.createBuffer()); assert.throws(() => gl.createShader(DRAW_ENUMS.VERTEX_SHADER));
      const texture = gl.createTexture(); gl.deleteTexture(texture);
    });
    assert.equal(f.callsOf('createBuffer').length, 0); assert.equal(f.callsOf('createShader').length, 0);
    retireFixture(f);
  }
});

test('unknown draw profiles refuse before any native call or reservation', () => {
  let calls = 0;
  for (const profile of ['draw', '', null, 0, {}]) {
    assert.throws(() => createDrawFixture({ profile, before() { calls++; }, handle() { calls++; }, payload() { calls++; } }));
  }
  assert.equal(calls, 0);
});

test('model draw profile exposes the exact bounded method and enum additions', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    for (const name of DRAW_METHODS) assert.equal(typeof gl[name], 'function', name);
    for (const [name, value] of Object.entries(DRAW_ENUMS)) assert.equal(gl[name], value, name);
    gl.frontFace(gl.CW); gl.frontFace(gl.CCW);
    for (const name of ['getError', 'clear', 'createQuery', 'fenceSync', 'createTransformFeedback',
      'drawElementsInstanced', 'drawArrays', 'detachShader', 'copyBufferSubData', 'readPixels', 'bindBufferBase', 'bindBufferRange']) {
      assert.throws(() => gl[name]);
    }
  });
  assert.equal(f.calls.some(call => call.method.startsWith('create') || call.method.startsWith('reserve') ||
    ['bufferData', 'bufferSubData', 'drawElements', 'drawArrays'].includes(call.method)), false);
  retireFixture(f);
});

test('buffer handle and exact viewed payload reserve before native allocation', () => {
  const f = createDrawFixture({ cap: 12 });
  f.owner.run(f.entry, gl => {
    const backing = new Float32Array(20), view = new Float32Array(backing.buffer, 8, 3);
    const buffer = uploadBuffer(gl, gl.ARRAY_BUFFER, view);
    assert.equal(gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE), 12);
    assert.equal(f.bytes, 12); assert.equal(f.owner.handles.live.buffer, 1);
    const reservation = f.callsOf('reservePayload')[0].args[0];
    assert.equal(reservation.kind, 'bytes'); assert.equal(reservation.pool, 'gpu-buffer');
    assert.equal(reservation.byteLength, view.byteLength); assert.equal(typeof reservation.key, 'string');
    assert.ok(f.calls.findIndex(row => row.method === 'reserveHandle') < f.calls.findIndex(row => row.method === 'createBuffer'));
    assert.ok(f.calls.findIndex(row => row.method === 'reservePayload') < f.calls.findIndex(row => row.method === 'bufferData'));
    assert.equal(f.callsOf('bufferData')[0].bytes, 12);
    gl.deleteBuffer(buffer);
  });
  retireFixture(f);
});

test('one uploaded backing shared by attribute declarations charges once and separate buffers charge twice', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const values = new Float32Array(18);
    uploadBuffer(gl, gl.ARRAY_BUFFER, values);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    assert.equal(f.bytes, 72); assert.equal(f.callsOf('reservePayload').length, 1);
    uploadBuffer(gl, gl.ARRAY_BUFFER, values);
    assert.equal(f.bytes, 144); assert.equal(f.callsOf('reservePayload').length, 2);
    const keys = f.callsOf('reservePayload').map(call => call.args[0].key); assert.equal(new Set(keys).size, 2);
  });
  retireFixture(f);
});

test('payload cap plus one refuses before allocation without disturbing installed storage', () => {
  const f = createDrawFixture({ cap: 48 });
  f.owner.run(f.entry, gl => {
    const installed = uploadBuffer(gl, gl.ARRAY_BUFFER, 48), candidate = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, candidate);
    noForward(f, 'bufferData', () => gl.bufferData(gl.ARRAY_BUFFER, 1, gl.STATIC_DRAW));
    assert.equal(f.bytes, 48); assert.equal(f.bufferSizes.get(installed), 48);
    gl.deleteBuffer(candidate);
  });
  retireFixture(f);
});

test('confirmed buffer replacement reserves overlap then releases only the old storage', () => {
  const f = createDrawFixture({ cap: 48 });
  f.owner.run(f.entry, gl => {
    uploadBuffer(gl, gl.ARRAY_BUFFER, 16);
    gl.bufferData(gl.ARRAY_BUFFER, 32, gl.STATIC_DRAW);
    assert.equal(f.peakBytes, 48); assert.equal(f.bytes, 32);
    assert.equal(f.callsOf('bufferData')[1].bytes, 48);
    assert.equal(gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE), 32);
  });
  retireFixture(f);
});

test('rejected replacement keeps the previous buffer storage usable and charged', () => {
  const f = createDrawFixture({ cap: 47 });
  f.owner.run(f.entry, gl => {
    uploadBuffer(gl, gl.ARRAY_BUFFER, 16);
    noForward(f, 'bufferData', () => gl.bufferData(gl.ARRAY_BUFFER, 32, gl.STATIC_DRAW));
    assert.equal(f.bytes, 16); assert.equal(gl.getBufferParameter(gl.ARRAY_BUFFER, gl.BUFFER_SIZE), 16);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, new Uint32Array([7]));
    assert.equal(f.callsOf('bufferSubData').length, 1);
  });
  retireFixture(f);
});

test('unknown driver allocation outcomes retain conservative leases until native buffer retirement', () => {
  for (const outcome of ['throw', 'ignore']) {
    let uploads = 0;
    const f = createDrawFixture({ bufferDataOutcome() { if (++uploads === 2) return outcome; } });
    f.owner.run(f.entry, gl => {
      const buffer = uploadBuffer(gl, gl.ARRAY_BUFFER, 16);
      assert.throws(() => gl.bufferData(gl.ARRAY_BUFFER, 32, gl.STATIC_DRAW));
      assert.equal(f.bytes, 48, 'neither possible allocation retires merely because allocation failed');
      assert.equal(f.callsOf('getError').length, 0);
      gl.deleteBuffer(buffer); assert.equal(f.bytes, 0);
    });
    retireFixture(f);
  }
});

test('subData slices use source element offsets and destination byte offsets without new reservations', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    uploadBuffer(gl, gl.ARRAY_BUFFER, 20);
    const source = new Uint32Array(new Uint32Array([9, 10, 11, 12, 13, 14]).buffer, 4, 4);
    const leases = f.leases.size;
    gl.bufferSubData(gl.ARRAY_BUFFER, 12, source, 1, 2);
    gl.bufferSubData(gl.ARRAY_BUFFER, 8, source, 1, 0);
    assert.equal(f.callsOf('bufferSubData').length, 2); assert.equal(f.bytes, 20); assert.equal(f.leases.size, leases);
    for (const args of [[13, source, 1, 2], [0, source, 5, 0], [0, source, 3, 2], [-1, source],
      [0, source, 0.5, 1], [0, source, 0, -1]]) {
      noForward(f, 'bufferSubData', () => gl.bufferSubData(gl.ARRAY_BUFFER, ...args));
    }
  });
  retireFixture(f);
});

test('buffer payload shape and selectors refuse unsupported sources before reservation', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const initial = f.callsOf('reservePayload').length;
    for (const value of [-1, Infinity, NaN, 1.5, Number.MAX_SAFE_INTEGER + 1, {}, new DataView(new ArrayBuffer(8))]) {
      noForward(f, 'bufferData', () => gl.bufferData(gl.ARRAY_BUFFER, value, gl.STATIC_DRAW));
    }
    noForward(f, 'bufferData', () => gl.bufferData(gl.ARRAY_BUFFER, 8, 0xdead));
    noForward(f, 'bindBuffer', () => gl.bindBuffer(0x8f36, buffer));
    noForward(f, 'getBufferParameter', () => gl.getBufferParameter(gl.ARRAY_BUFFER, 0xdead));
    assert.equal(f.callsOf('reservePayload').length, initial);
  });
  retireFixture(f);
});

test('foreign deleted and cross-epoch buffers cannot be bound or mutated', () => {
  const f = createDrawFixture(), other = createDrawFixture(); let foreign;
  other.owner.run(other.entry, gl => { foreign = gl.createBuffer(); });
  f.owner.run(f.entry, gl => {
    const own = gl.createBuffer(); gl.deleteBuffer(own);
    for (const value of [{ native: 'host' }, foreign, own]) noForward(f, 'bindBuffer', () => gl.bindBuffer(gl.ARRAY_BUFFER, value));
    noForward(f, 'deleteBuffer', () => gl.deleteBuffer(foreign));
    noForward(f, 'bufferData', () => gl.bufferData(gl.ARRAY_BUFFER, 4, gl.STATIC_DRAW));
  });
  retireFixture(f); retireFixture(other);
});

test('VAO element bindings are independent and native or null VAOs cannot be mutated', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    const first = gl.createVertexArray(), second = gl.createVertexArray();
    gl.bindVertexArray(first); uploadBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, 12);
    gl.bindVertexArray(second); uploadBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, 24);
    gl.bindVertexArray(first); assert.equal(gl.getBufferParameter(gl.ELEMENT_ARRAY_BUFFER, gl.BUFFER_SIZE), 12);
    noForward(f, 'bufferSubData', () => gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 12, new Uint32Array([1])));
    gl.bindVertexArray(second); gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 12, new Uint32Array([1]));
    gl.bindVertexArray(null);
    for (const [method, args] of [['bindBuffer', [gl.ELEMENT_ARRAY_BUFFER, null]], ['enableVertexAttribArray', [0]],
      ['disableVertexAttribArray', [0]], ['vertexAttribPointer', [0, 3, gl.FLOAT, false, 0, 0]], ['vertexAttribDivisor', [0, 0]]]) {
      noForward(f, method, () => gl[method](...args));
    }
    noForward(f, 'bindVertexArray', () => gl.bindVertexArray({ native: 'host' }));
  });
  retireFixture(f);
});

test('attribute declarations reject invalid slots strides types offsets and instancing', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    gl.bindVertexArray(gl.createVertexArray()); uploadBuffer(gl, gl.ARRAY_BUFFER, 36);
    for (const args of [[-1, 3, gl.FLOAT, false, 0, 0], [16, 3, gl.FLOAT, false, 0, 0],
      [0, 5, gl.FLOAT, false, 0, 0], [0, 3, 0xdead, false, 0, 0], [0, 3, gl.FLOAT, false, 10, 0],
      [0, 3, gl.FLOAT, false, 0, 2], [0, 3, gl.FLOAT, false, 0, 28], [0, 3, gl.FLOAT, false, -4, 0]]) {
      noForward(f, 'vertexAttribPointer', () => gl.vertexAttribPointer(...args));
    }
    noForward(f, 'vertexAttribDivisor', () => gl.vertexAttribDivisor(0, 1));
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0); gl.vertexAttribDivisor(0, 0);
  });
  retireFixture(f);
});

test('owned shader and program reflection forwards only supported selectors and identities', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    const { program, vertex } = createProgram(gl);
    assert.equal(gl.getShaderParameter(vertex, gl.COMPILE_STATUS), true); assert.equal(gl.getShaderInfoLog(vertex), '');
    assert.equal(gl.getProgramInfoLog(program), ''); assert.equal(gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS), 2);
    assert.equal(gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES), 1);
    assert.deepEqual(gl.getActiveUniform(program, 0), { name: 'matrix', type: gl.FLOAT_MAT4, size: 1 });
    assert.deepEqual(gl.getActiveAttrib(program, 0), { name: 'position', type: gl.FLOAT_VEC3, size: 1 });
    assert.equal(gl.getAttribLocation(program, 'position'), 0);
    noForward(f, 'getShaderParameter', () => gl.getShaderParameter(vertex, 0xdead));
    noForward(f, 'getProgramParameter', () => gl.getProgramParameter(program, 0xdead));
    noForward(f, 'getActiveUniform', () => gl.getActiveUniform(program, -1));
    noForward(f, 'attachShader', () => gl.attachShader(program, {}));
    noForward(f, 'bindAttribLocation', () => gl.bindAttribLocation({}, 0, 'position'));
    noForward(f, 'bindAttribLocation', () => gl.bindAttribLocation(program, 16, 'position'));
    noForward(f, 'useProgram', () => gl.useProgram({ native: 'program' }));
    const bind = f.calls.findIndex(call => call.method === 'bindAttribLocation');
    assert.ok(bind >= 0 && bind < f.calls.findIndex(call => call.method === 'linkProgram'));
  });
  retireFixture(f);
});

test('uniform locations belong to their exact currently bound program and link generation', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    const first = createProgram(gl), matrix = gl.getUniformLocation(first.program, 'matrix');
    gl.uniformMatrix4fv(matrix, false, identity);
    const second = createProgram(gl);
    noForward(f, 'uniformMatrix4fv', () => gl.uniformMatrix4fv(matrix, false, identity));
    gl.useProgram(first.program); gl.linkProgram(first.program);
    noForward(f, 'uniformMatrix4fv', () => gl.uniformMatrix4fv(matrix, false, identity));
    const next = gl.getUniformLocation(first.program, 'matrix'); gl.uniformMatrix4fv(next, false, identity);
    noForward(f, 'uniformMatrix4fv', () => gl.uniformMatrix4fv({ program: first.program }, false, identity));
    gl.useProgram(second.program);
  });
  retireFixture(f);
});

test('uniform setters preserve finite shape checks and null location no-op semantics', () => {
  const f = createDrawFixture({ uniforms: [
    { name: 'matrix', type: DRAW_ENUMS.FLOAT_MAT4, size: 1 }, { name: 'color', type: DRAW_ENUMS.FLOAT_VEC4, size: 1 },
    { name: 'directionalLights[0].direction', type: DRAW_ENUMS.FLOAT_VEC3, size: 1 },
  ] });
  f.owner.run(f.entry, gl => {
    const { program } = createProgram(gl), matrix = gl.getUniformLocation(program, 'matrix'), color = gl.getUniformLocation(program, 'color');
    gl.uniform4f(color, 1, 0.5, 0, 1); gl.uniform4fv(color, new Float32Array([1, 0.5, 0, 1]));
    const direction = gl.getUniformLocation(program, 'directionalLights[0].direction');
    assert.notEqual(direction, null); gl.uniform3f(direction, 0, 0, 1);
    noForward(f, 'uniform1f', () => gl.uniform1f(color, 1));
    noForward(f, 'uniform4fv', () => gl.uniform4fv(matrix, new Float32Array(4)));
    noForward(f, 'uniformMatrix4fv', () => gl.uniformMatrix4fv(color, false, identity));
    noForward(f, 'uniform4f', () => gl.uniform4f(color, 1, NaN, 0, 1));
    noForward(f, 'uniform4fv', () => gl.uniform4fv(color, new Float32Array(3)));
    noForward(f, 'uniformMatrix4fv', () => gl.uniformMatrix4fv(matrix, true, identity));
    noForward(f, 'uniformMatrix4fv', () => gl.uniformMatrix4fv(matrix, false, new Float32Array(15)));
    const bad = identity.slice(); bad[4] = Infinity;
    noForward(f, 'uniformMatrix4fv', () => gl.uniformMatrix4fv(matrix, false, bad));
    assert.equal(gl.getUniformLocation(program, 'missing'), null);
    gl.uniform1f(null, 1);
  });
  retireFixture(f);
});

test('admitted scalar vector array and matrix uniform families follow reflected types', () => {
  const descriptors = [
    ['scalar', DRAW_ENUMS.FLOAT, 1], ['pair', DRAW_ENUMS.FLOAT_VEC2, 1], ['triple', DRAW_ENUMS.FLOAT_VEC3, 1],
    ['quad', DRAW_ENUMS.FLOAT_VEC4, 1], ['enabled', DRAW_ENUMS.BOOL, 1], ['indices[0]', DRAW_ENUMS.INT, 2],
    ['weights[0]', DRAW_ENUMS.FLOAT, 2], ['normalMatrix', DRAW_ENUMS.FLOAT_MAT3, 1],
  ];
  const f = createDrawFixture({ uniforms: descriptors.map(([name, type, size]) => ({ name, type, size })) });
  f.owner.run(f.entry, gl => {
    const { program } = createProgram(gl);
    const location = name => gl.getUniformLocation(program, name);
    gl.uniform1f(location('scalar'), 0.5); gl.uniform2f(location('pair'), 1, 2);
    gl.uniform3f(location('triple'), 1, 2, 3); gl.uniform4f(location('quad'), 1, 2, 3, 4);
    gl.uniform1fv(location('weights[0]'), new Float32Array([0.25, 0.75]));
    gl.uniform2fv(location('pair'), new Float32Array([1, 2]));
    gl.uniform3fv(location('triple'), new Float32Array([1, 2, 3]));
    gl.uniform4fv(location('quad'), new Float32Array([1, 2, 3, 4]));
    gl.uniform1i(location('enabled'), 1); gl.uniform1iv(location('indices[0]'), new Int32Array([2, 3]));
    gl.uniformMatrix3fv(location('normalMatrix'), false, new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]));
    noForward(f, 'uniform1i', () => gl.uniform1i(location('enabled'), 0.5));
    noForward(f, 'uniform1fv', () => gl.uniform1fv(location('weights[0]'), new Float32Array([1])));
    noForward(f, 'uniform1iv', () => gl.uniform1iv(location('indices[0]'), new Float32Array([1, 1.5])));
    for (const method of ['uniform1f', 'uniform2f', 'uniform3f', 'uniform4f', 'uniform1fv', 'uniform2fv',
      'uniform3fv', 'uniform4fv', 'uniform1i', 'uniform1iv', 'uniformMatrix3fv']) assert.equal(f.callsOf(method).length, 1, method);
  });
  retireFixture(f);
});

test('indexed triangles draw only after owned state is complete', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    noForward(f, 'drawElements', () => gl.drawElements(DRAW_ENUMS.TRIANGLES, 3, DRAW_ENUMS.UNSIGNED_INT, 0));
    prepareTriangle(gl, f.entry);
    gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0);
    assert.equal(f.callsOf('drawElements').length, 1);
    for (const args of [[gl.TRIANGLES, 4, gl.UNSIGNED_INT, 0], [gl.TRIANGLES, 3, gl.UNSIGNED_INT, 2],
      [gl.TRIANGLES, -1, gl.UNSIGNED_INT, 0], [gl.TRIANGLES, 3, gl.FLOAT, 0], [gl.LINES, 3, gl.UNSIGNED_INT, 0]]) {
      noForward(f, 'drawElements', () => gl.drawElements(...args));
    }
    noForward(f, 'drawArrays', () => gl.drawArrays(gl.TRIANGLES, 0, 3));
    gl.useProgram(null); noForward(f, 'drawElements', () => gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0));
  });
  retireFixture(f);
});

test('drawElements checks the selected VAO element backing instead of the last generic buffer', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    const first = prepareTriangle(gl, f.entry);
    const second = gl.createVertexArray(); gl.bindVertexArray(second);
    gl.bindBuffer(gl.ARRAY_BUFFER, first.vertices); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    uploadBuffer(gl, gl.ELEMENT_ARRAY_BUFFER, 4);
    noForward(f, 'drawElements', () => gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0));
    gl.bindVertexArray(first.vao); gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0);
    assert.equal(f.callsOf('drawElements').length, 1);
  });
  retireFixture(f);
});

test('current target viewport scissor and depth grant controls every draw', () => {
  const f = createDrawFixture(); let prepared;
  f.owner.run(f.entry, gl => { prepared = prepareTriangle(gl, f.entry); gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0); });
  const next = f.makeEntry({ width: 900, height: 600, viewport: [20, 30, 400, 250], scissor: [21, 31, 200, 100],
    depthRange: [0.2, 0.7], depthFunc: f.gl.LESS });
  f.owner.run(next, gl => {
    gl.useProgram(prepared.program); gl.bindVertexArray(prepared.vao); applyTarget(gl, next.target);
    gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, gl.createFramebuffer());
    noForward(f, 'drawElements', () => gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0));
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    for (const mismatch of [() => gl.viewport(...f.entry.target.viewport), () => gl.scissor(...f.entry.target.scissor),
      () => gl.depthFunc(gl.LEQUAL), () => gl.depthRange(0, 1), () => gl.disable(gl.SCISSOR_TEST)]) {
      applyTarget(gl, next.target);
      noForward(f, 'drawElements', () => { mismatch(); gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0); });
    }
  });
  assert.equal(f.callsOf('drawElements').length, 2); retireFixture(f);
});

test('unsupported output targets refuse compile upload and draw before forwarding', () => {
  for (const outputPolicy of ['unsupported', 'offscreen-linear-verified']) {
    const f = createDrawFixture(); let prepared;
    f.owner.run(f.entry, gl => { prepared = prepareTriangle(gl, f.entry); });
    const entry = f.makeEntry({ draw: { host: 'offscreen' }, outputPolicy });
    f.owner.run(entry, gl => {
      gl.bindBuffer(gl.ARRAY_BUFFER, prepared.vertices);
      noForward(f, 'bufferData', () => gl.bufferData(gl.ARRAY_BUFFER, 36, gl.STATIC_DRAW));
      noForward(f, 'compileShader', () => gl.compileShader(prepared.vertex));
      noForward(f, 'drawElements', () => gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0));
    });
    retireFixture(f);
  }
});

test('each new handle uses its own native deletion route and never deletes borrowed targets', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => { prepareTriangle(gl, f.entry); gl.createFramebuffer(); });
  retireFixture(f);
  for (const [method, count] of [['deleteBuffer', 2], ['deleteVertexArray', 1], ['deleteShader', 2], ['deleteProgram', 1], ['deleteFramebuffer', 1]]) {
    assert.equal(f.callsOf(method).length, count, method);
    assert.ok(f.callsOf(method).every(call => call.args[0]?.kind === method.replace('delete', 'create')));
  }
  assert.equal(f.nativeProgram, null); assert.equal(f.nativeVao, null);
});

test('attached shader and current program deletion keep accounting until references retire', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    const { program, vertex, fragment } = createProgram(gl);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    assert.equal(f.owner.handles.live.shader, 2);
    noForward(f, 'shaderSource', () => gl.shaderSource(vertex, 'void main(){}'));
    const location = gl.getUniformLocation(program, 'color');
    gl.deleteProgram(program);
    assert.equal(f.owner.handles.live.program, 1); assert.equal(f.owner.handles.live.shader, 2);
    noForward(f, 'uniform4f', () => gl.uniform4f(location, 1, 1, 1, 1));
    gl.useProgram(null);
    assert.equal(f.owner.handles.live.program, 0); assert.equal(f.owner.handles.live.shader, 0);
  });
  retireFixture(f);
  assert.equal(f.callsOf('deleteProgram').length, 1); assert.equal(f.callsOf('deleteShader').length, 2);
});

test('buffer deletion retains bytes while another owned VAO still holds its attributes', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    const first = gl.createVertexArray(), second = gl.createVertexArray(); gl.bindVertexArray(first);
    const buffer = uploadBuffer(gl, gl.ARRAY_BUFFER, 36); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(second); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, null); gl.deleteBuffer(buffer);
    assert.equal(f.bytes, 36); assert.equal(f.owner.handles.live.buffer, 1);
    noForward(f, 'bindBuffer', () => gl.bindBuffer(gl.ARRAY_BUFFER, buffer));
    gl.deleteVertexArray(first); assert.equal(f.bytes, 36);
    gl.deleteVertexArray(second); assert.equal(f.bytes, 0); assert.equal(f.owner.handles.live.buffer, 0);
  });
  retireFixture(f); assert.equal(f.callsOf('deleteBuffer').length, 1);
});

test('failed compilation and linking never make a usable program and all owners still retire', () => {
  const f = createDrawFixture({ compileOk: false, linkOk: false });
  f.owner.run(f.entry, gl => {
    const shader = gl.createShader(gl.VERTEX_SHADER); gl.shaderSource(shader, 'invalid'); gl.compileShader(shader);
    assert.equal(gl.getShaderParameter(shader, gl.COMPILE_STATUS), false); assert.match(gl.getShaderInfoLog(shader), /compile/);
    const program = gl.createProgram(); gl.attachShader(program, shader); gl.linkProgram(program);
    assert.equal(gl.getProgramParameter(program, gl.LINK_STATUS), false); assert.match(gl.getProgramInfoLog(program), /link/);
    noForward(f, 'useProgram', () => gl.useProgram(program));
    noForward(f, 'getUniformLocation', () => gl.getUniformLocation(program, 'matrix'));
  });
  retireFixture(f);
});

test('null native handle allocation releases its reservation without publishing a handle', () => {
  for (const method of ['createBuffer', 'createVertexArray', 'createShader', 'createProgram']) {
    const f = createDrawFixture({ nullCreate: method });
    f.owner.run(f.entry, gl => assert.throws(() => method === 'createShader' ? gl[method](gl.VERTEX_SHADER) : gl[method]()));
    assert.equal(f.callsOf(method).length, 1); assert.equal(f.leases.size, 0); retireFixture(f);
  }
});

test('failed native deletion retains that owner while sweep attempts every other independent handle', () => {
  let failed, failing = true;
  const f = createDrawFixture({ before(method, args) { if (method === 'deleteBuffer' && args[0] === failed && failing) throw new Error('Driver delete refused'); } });
  f.owner.run(f.entry, gl => { failed = uploadBuffer(gl, gl.ARRAY_BUFFER, 16); uploadBuffer(gl, gl.ARRAY_BUFFER, 24); });
  assert.throws(() => f.owner.run(f.entry, () => f.owner.sweep()));
  assert.equal(f.owner.handles.live.buffer, 1); assert.equal(f.bytes, 16); assert.equal(f.callsOf('deleteBuffer').length, 2);
  assert.throws(() => f.owner.retire()); failing = false; retireFixture(f);
});

test('budget reentrancy cannot mutate admitted handles or forward allocation after loss', () => {
  for (const route of ['handle', 'payload']) {
    let context, buffer;
    const stop = f => {
      if (context && buffer) noForward(f, 'deleteBuffer', () => context.deleteBuffer(buffer));
      f.owner.lose();
    };
    const f = createDrawFixture(route === 'handle' ? { handle(_kind, item) { stop(item); } } : { payload(_request, item) { stop(item); } });
    assert.throws(() => f.owner.run(f.entry, gl => {
      context = gl; buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, 12, gl.STATIC_DRAW);
    }));
    assert.equal(f.callsOf(route === 'handle' ? 'createBuffer' : 'bufferData').length, 0);
    f.owner.retireAfterLoss([]); assert.equal(f.leases.size, 0);
    assert.ok([...f.releases.values()].every(count => count === 1));
  }
});

test('observed loss during compile upload or draw closes all later forwarding and cleanup stays CPU-only', () => {
  for (const stage of ['compileShader', 'bufferData', 'drawElements']) {
    let fired = false, retained;
    const f = createDrawFixture({ after(method, _args, item) { if (!fired && method === stage) { fired = true; item.owner.lose(); } } });
    assert.throws(() => f.owner.run(f.entry, gl => { retained = gl; prepareTriangle(gl, f.entry); gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0); }));
    assert.equal(fired, true); const calls = f.calls.length;
    assert.throws(() => retained.createBuffer());
    f.owner.retireAfterLoss([]);
    assert.equal(f.calls.length, calls); assert.equal(f.leases.size, 0); assert.equal(f.bytes, 0);
    assert.equal(f.calls.filter(call => call.method.startsWith('delete')).length, 0);
  }
});

test('expired entries and retained facade methods cannot upload draw or reenter a closed lease', () => {
  const f = createDrawFixture(); let retained, upload;
  f.owner.run(f.entry, gl => { retained = gl; prepareTriangle(gl, f.entry); upload = gl.bufferSubData; });
  const before = f.calls.length;
  assert.throws(() => upload(DRAW_ENUMS.ARRAY_BUFFER, 0, new Float32Array(3)));
  assert.throws(() => retained.drawElements(DRAW_ENUMS.TRIANGLES, 3, DRAW_ENUMS.UNSIGNED_INT, 0));
  assert.equal(f.calls.length, before);
  assert.throws(() => f.owner.run({ ...f.entry, epoch: 2 }, () => assert.fail('Mismatched epoch entered')));
  assert.throws(() => f.owner.run({ ...f.entry, isCurrent: () => false }, () => assert.fail('Expired frame entered')));
  f.owner.run(f.entry, () => assert.throws(() => f.owner.run(f.entry, () => assert.fail('Nested work entered'))));
  retireFixture(f);
});
