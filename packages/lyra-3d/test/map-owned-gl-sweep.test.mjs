import assert from 'node:assert/strict';
import test from 'node:test';
import { createDrawFixture, createProgram, prepareTriangle, retireFixture } from './map-owned-gl-draw-fixture.mjs';

test('a host that expires mid-callback closes the model-draw entry before forwarding', () => {
  const f = createDrawFixture();
  assert.throws(() => f.owner.run(f.entry, gl => { f.expire(); gl.createBuffer(); }));
  assert.equal(f.callsOf('createBuffer').length, 0);
  f.setCurrent(true); retireFixture(f);
});

test('an entry lease that expires while its host stays current closes the model-draw entry', () => {
  const f = createDrawFixture();
  let entryCurrent = true;
  const entry = { ...f.entry, isCurrent: () => entryCurrent };
  assert.throws(() => f.owner.run(entry, gl => { gl.createBuffer(); entryCurrent = false; gl.createBuffer(); }));
  assert.equal(f.callsOf('createBuffer').length, 1);
  entryCurrent = true; retireFixture(f);
});

test('model-draw front-face winding is limited to CW and CCW', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    gl.frontFace(gl.CW); gl.frontFace(gl.CCW);
    assert.throws(() => gl.frontFace(0x0404));
  });
  assert.deepEqual(f.callsOf('frontFace').map(call => call.args[0]), [f.gl.CW, f.gl.CCW]);
  retireFixture(f);
});

test('deleting the bound vertex array unbinds it so later draws cannot use it', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    const { vao } = prepareTriangle(gl, f.entry);
    gl.deleteVertexArray(vao);
    assert.equal(f.callsOf('deleteVertexArray').length, 1);
    assert.equal(f.owner.handles.live.vao, 0);
    assert.throws(() => gl.drawElements(gl.TRIANGLES, 3, gl.UNSIGNED_INT, 0));
  });
  assert.equal(f.callsOf('drawElements').length, 0);
  retireFixture(f);
});

test('sweeping a program retires shaders already marked for deletion exactly once', () => {
  const f = createDrawFixture();
  f.owner.run(f.entry, gl => {
    const { vertex, fragment } = createProgram(gl);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    assert.equal(f.owner.handles.live.shader, 2, 'attached shaders stay live until their program retires');
  });
  retireFixture(f);
  assert.equal(f.callsOf('deleteShader').length, 2); assert.equal(f.callsOf('deleteProgram').length, 1);
  assert.equal(f.owner.handles.live.shader, 0); assert.equal(f.owner.handles.live.program, 0);
});

test('a refused unbind during sweep is reported after every other owner was attempted', () => {
  for (const method of ['useProgram', 'bindVertexArray', 'bindBuffer']) {
    let failing = false;
    const f = createDrawFixture({ before(name, args) { if (failing && name === method && args.at(-1) === null) throw new Error('Driver unbind refused'); } });
    f.owner.run(f.entry, gl => { prepareTriangle(gl, f.entry); });
    failing = true;
    assert.throws(() => f.owner.run(f.entry, () => f.owner.sweep()), undefined, method);
    assert.equal(f.owner.handles.live.buffer, 0, `${method}: buffers still retire`);
    failing = false; retireFixture(f);
  }
});

test('sweep cannot be reentered from a native deletion callback', () => {
  let inner;
  const f = createDrawFixture({ before(name, _args, item) {
    if (name === 'deleteBuffer' && inner === undefined) { try { item.owner.sweep(); inner = 'completed'; } catch { inner = 'refused'; } }
  } });
  f.owner.run(f.entry, gl => { prepareTriangle(gl, f.entry); });
  f.owner.run(f.entry, () => f.owner.sweep());
  assert.equal(inner, 'refused');
  assert.equal(f.owner.handles.live.buffer, 0);
  assert.equal(f.callsOf('deleteBuffer').length, 2, 'the outer sweep still deletes each buffer once');
  retireFixture(f);
});
