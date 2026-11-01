import assert from 'node:assert/strict';
import test from 'node:test';
import { ArrayCamera, ClampToEdgeWrapping, DoubleSide, LinearFilter, Matrix4, NormalBlending,
  PerspectiveCamera, Scene, SRGBColorSpace, Vector4, WebGLRenderer } from 'three';
import { createPointBatch } from '../dist/points/batches.js';
import { admitPointsData } from '../dist/points/data.js';
import { DEFAULT_LYRA_3D_STYLE, resolveLyra3dStyle } from '../dist/core/style.js';
import { createPointsXrAllocationAccount, createPointsXrLabelLayout, finishPointsXrLabelLayout } from '../dist/points/xr-label-layout.js';
import { createPointsXrLabelResources, disposePointsXrLabelResources } from '../dist/points/xr-label-resources.js';
import { FakeCanvas, installFakeBrowser } from './fake-browser.mjs';
import { createLabelFixture, finishLabelPresentation, labelMeshes, presentLabels } from './points-xr-label-fixture.mjs';

// The actual renderer owns the submitted matrices and buffers; fake GL does not prove pixels.
function groups(owner, pass, visit = () => {}) {
  owner.beginGroups(pass);
  for (;;) { const next = owner.nextGroup(); if (next.kind === 'done') break; if (next.kind === 'group') visit(next.group); }
  owner.endGroups();
}
function fixture(t) {
  const browser = installFakeBrowser(), savedSelf = Object.getOwnPropertyDescriptor(globalThis, 'self');
  Object.defineProperty(globalThis, 'self', { configurable: true, value: { requestAnimationFrame, cancelAnimationFrame } });
  const canvas = document.createElement('canvas'), renderer = new WebGLRenderer({ canvas, context: canvas.getContext('webgl2') });
  renderer.setSize(1440, 600, false);
  const data = admitPointsData({ positions: new Float32Array([-.2, 0, -2, .2, .1, -2.5]), sizes: new Float32Array([6, 12]),
    labels: ['point', 'other'], axes: [{ axis: 'x', min: -1, max: 1, label: 'axis', ticks: [] }] });
  const style = resolveLyra3dStyle(), state = { selected: new Set(), dimmed: new Set([1]), hover: -1, focus: -1 };
  const points = createPointBatch(data); points.paint(style, state); points.resize(640, 480);
  const account = createPointsXrAllocationAccount(), identity = Object.freeze({}), owner = createPointsXrLabelLayout(data, style, state, identity, account);
  while (!owner.stepIndex().done) { /* Advance bounded work. */ }
  groups(owner, 'fonts'); groups(owner, 'readiness');
  groups(owner, 'measure', group => owner.acceptMetrics(group, { left: 1.25, right: 7.1, ascent: 3.2, descent: 2.1 }));
  while (!owner.stepPack().done) { /* Advance bounded work. */ }
  while (!owner.stepFill().done) { /* Advance bounded work. */ }
  groups(owner, 'paint', group => { owner.paintRun(group); });
  const layout = finishPointsXrLabelLayout(owner, identity), atlas = new FakeCanvas({ context2d: true }); atlas.width = atlas.height = 1024;
  const resources = createPointsXrLabelResources(layout, points.resources, atlas, account), scene = new Scene(); scene.add(...resources.meshes);
  const eyes = [new PerspectiveCamera(70, 640 / 480, .01, 100), new PerspectiveCamera(65, 800 / 600, .01, 100)];
  eyes.forEach((eye, index) => {
    eye.position.set(index === 0 ? -.032 : .032, 0, 0); eye.rotation.y = index === 0 ? .04 : -.025;
    eye.projectionMatrix.elements[8] = index === 0 ? -.11 : .09; eye.projectionMatrix.elements[9] = index === 0 ? .06 : -.03;
    eye.projectionMatrixInverse.copy(eye.projectionMatrix).invert();
    eye.viewport = new Vector4(index === 0 ? 0 : 640, 0, index === 0 ? 640 : 800, index === 0 ? 480 : 600); eye.updateMatrixWorld(true);
  });
  const camera = new ArrayCamera(eyes), gl = renderer.getContext().state;
  t.after(() => {
    try { disposePointsXrLabelResources(resources); points.dispose(); } finally {
      try { renderer.dispose(); gl.lose(); } finally {
        browser.restore(); if (savedSelf) Object.defineProperty(globalThis, 'self', savedSelf); else delete globalThis.self;
      }
    }
  });
  return { renderer, data, style, points, layout, resources, scene, eyes, camera, gl,
    draws: () => gl.callsOf('drawElementsInstanced').length + gl.callsOf('drawArraysInstanced').length };
}

test('actual renderer submits world-label geometry separately through asymmetric canted eyes', t => {
  const f = fixture(t), observed = new Map(), before = f.draws();
  const projections = f.eyes.map(eye => eye.projectionMatrix.toArray());
  for (const mesh of f.resources.meshes) {
    observed.set(mesh, []); mesh.onAfterRender = (_renderer, _scene, eye) => observed.get(mesh).push({ eye, modelView: mesh.modelViewMatrix.toArray() });
  }
  f.renderer.render(f.scene, f.camera);
  assert.equal(f.draws() - before, f.resources.meshes.length * 2);
  for (const [mesh, entries] of observed) {
    assert.deepEqual(entries.map(entry => entry.eye), f.eyes); assert.notDeepEqual(entries[0].modelView, entries[1].modelView);
    for (let index = 0; index < 2; index++) {
      const expected = new Matrix4().copy(f.eyes[index].matrixWorld).invert().multiply(mesh.matrixWorld).toArray();
      assert.deepEqual(entries[index].modelView, expected);
    }
  }
  assert.deepEqual(f.eyes.map(eye => eye.projectionMatrix.toArray()), projections);
  assert.deepEqual(f.eyes.map(eye => eye.viewport.toArray()), [[0, 0, 640, 480], [640, 0, 800, 600]]);
});

test('native label anchors and world rectangles remain fixed through eye frame and inline size changes', t => {
  const f = fixture(t), rows = [...f.layout.instanceData], anchors = f.points.mesh.geometry.getAttribute('pointPosition').array;
  const sizes = f.points.mesh.geometry.getAttribute('pointSize').array, axis = [...f.layout.axisAnchors];
  const geometries = [...f.resources.geometries], attributes = geometries.map(geometry => ({ ...geometry.attributes }));
  assert.deepEqual(rows.slice(0, 4), [-.004, -.006, .010, .005].map(Math.fround));
  assert.equal(rows[8], 1); assert.equal(rows[17], Math.fround(.3)); assert.equal(rows[26], 1);
  for (let frame = 0; frame < 3; frame++) {
    f.renderer.setSize(320 + frame * 450, 240 + frame * 270, false); f.points.resize(1 + frame, 2 + frame);
    f.eyes.forEach((eye, index) => { eye.position.y = frame * .1; eye.rotation.x = frame * (index ? -.07 : .05); eye.updateMatrixWorld(true); });
    f.renderer.render(f.scene, f.camera);
    assert.deepEqual([...f.layout.instanceData], rows); assert.deepEqual([...f.layout.axisAnchors], axis);
    assert.equal(geometries[0].getAttribute('labelAnchor').array, anchors); assert.equal(geometries[0].getAttribute('labelRadius').array, sizes);
    for (let index = 0; index < geometries.length; index++) for (const [name, attribute] of Object.entries(attributes[index])) assert.equal(geometries[index].getAttribute(name), attribute);
    for (const material of f.resources.materials) assert.equal(Object.hasOwn(material.uniforms, 'viewportSize'), false);
  }
  assert.deepEqual([...sizes], [6, 12]); assert.deepEqual([...anchors], [-.2, 0, -2, .2, .1, -2.5].map(Math.fround));
});

test('label depth blend and texture settings preserve one final forced-color canvas composite', async t => {
  const f = await createLabelFixture(t, { style: { ...DEFAULT_LYRA_3D_STYLE, foreground: 'rgba(0, 0, 255, 0.5)', forcedColors: true } });
  f.record.engine.setState({ selected: new Set(), dimmed: new Set([0, 1]), hover: -1, focus: -1 });
  const prepared = await f.record.engine.prepareXrPresentation();
  const atlas = f.text.canvases.find(entry => entry.commands.some(command => command[0] === 'fillText'));
  assert.ok(atlas, 'Preparation must rasterize complete runs into a candidate canvas');
  const commands = atlas.commands, paints = commands.map((command, index) => command[0] === 'fillText' ? index : -1).filter(index => index >= 0);
  const sourceIn = commands.map((command, index) => command[0] === 'set' && command[1] === 'globalCompositeOperation' && command[2] === 'source-in' ? index : -1).filter(index => index >= 0);
  assert.equal(sourceIn.length, 1); assert.ok(paints.length > 0); assert.ok(paints.every(index => index < sourceIn[0]));
  for (const index of paints) assert.equal(commands[index].length, 4, 'fillText receives the complete text and x/y only');
  for (const draw of f.text.draws.filter(value => value.canvas === atlas.canvas)) {
    assert.equal(draw.globalAlpha, 1); assert.doesNotMatch(draw.fillStyle, /(?:0\.5|50%)/u, 'Foreground alpha belongs to the one final recolor');
  }
  const recolor = commands.findIndex((command, index) => index > sourceIn[0] && command[0] === 'fillRect');
  assert.ok(recolor > sourceIn[0]); assert.deepEqual(commands[recolor].slice(1), [0, 0, 1024, 1024]);
  const priorAlpha = commands.slice(0, recolor).filter(command => command[0] === 'set' && command[1] === 'globalAlpha').at(-1);
  assert.deepEqual(priorAlpha, ['set', 'globalAlpha', 1]);
  const priorFill = commands.slice(0, recolor).filter(command => command[0] === 'set' && command[1] === 'fillStyle').at(-1);
  assert.ok(priorFill); assert.match(priorFill[2], /(?:0\.5|50%)/u);
  assert.ok(commands.slice(recolor + 1).some(command => command[0] === 'restore' || (command[0] === 'set' && command[1] === 'globalCompositeOperation' && command[2] === 'source-over')));
  assert.equal(atlas.context.globalCompositeOperation, 'source-over'); assert.equal(atlas.context.globalAlpha, 1);
  const active = await presentLabels(f, { prepared });
  const meshes = labelMeshes(f.record.viewport); assert.ok(meshes.length > 0);
  for (const mesh of meshes) {
    const material = mesh.material;
    assert.equal(material.transparent, true); assert.equal(material.depthTest, true); assert.equal(material.depthWrite, false);
    assert.equal(material.side, DoubleSide); assert.equal(material.forceSinglePass, true); assert.equal(material.blending, NormalBlending);
    assert.equal(mesh.frustumCulled, false); assert.equal(mesh.renderOrder, 100);
    const texture = Object.values(material.uniforms).map(uniform => uniform.value).find(value => value?.isCanvasTexture);
    assert.ok(texture); assert.equal(texture.image, atlas.canvas); assert.equal(texture.colorSpace, SRGBColorSpace);
    assert.equal(texture.generateMipmaps, false); assert.equal(texture.minFilter, LinearFilter); assert.equal(texture.magFilter, LinearFilter);
    assert.equal(texture.wrapS, ClampToEdgeWrapping); assert.equal(texture.wrapT, ClampToEdgeWrapping); assert.equal(texture.flipY, true);
    const dim = mesh.geometry.getAttribute('labelDim'); for (let row = 0; row < mesh.geometry.instanceCount; row++) assert.equal(dim.getX(row), 1);
  }
  await finishLabelPresentation(f, active);
});

test('first-pose placement reflection and camera clipping configuration reach actual label draws', async t => {
  const f = await createLabelFixture(t), active = await presentLabels(f), viewport = f.record.viewport, root = viewport.world.matrix.toArray();
  const basis = new Matrix4().fromArray(root); assert.ok(basis.determinant() < 0, 'The common root has one semantic-y reflection');
  const meshes = labelMeshes(viewport), before = new Map(meshes.map(mesh => [mesh, mesh.geometry.getAttribute('labelRect').data.array.slice()]));
  assert.ok(meshes.length > 0); const seen = [];
  for (const mesh of meshes) mesh.onAfterRender = (_renderer, _scene, eye) => seen.push({ mesh, eye, matrix: mesh.modelViewMatrix.toArray() });
  active.attempt.deliver(true, new Matrix4().makeRotationY(.35).setPosition(.4, 1.7, -.3).toArray());
  assert.deepEqual(viewport.world.matrix.toArray(), root); assert.equal(seen.length, meshes.length * 2);
  for (const entry of seen) assert.deepEqual(entry.matrix, new Matrix4().copy(entry.eye.matrixWorld).invert().multiply(entry.mesh.matrixWorld).toArray());
  for (const eye of viewport.renderer.xr.getCamera().cameras) {
    assert.equal(eye.near, .01); assert.equal(eye.far, 100);
    assert.equal(eye.projectionMatrix.elements.every(Number.isFinite), true);
  }
  for (const mesh of meshes) assert.deepEqual([...mesh.geometry.getAttribute('labelRect').data.array], [...before.get(mesh)]);
  assert.deepEqual([active.attempt.session.renderState.depthNear, active.attempt.session.renderState.depthFar], [.01, 100]);
  await finishLabelPresentation(f, active);
});
