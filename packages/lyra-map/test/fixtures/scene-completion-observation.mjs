import assert from 'node:assert/strict';
import { createSceneGlEnvelope } from '../../src/scene/gl-state.mjs';
import { createSceneGlyphRenderer, captureSceneGlyphObservation } from '../../src/scene/bridge-glyph.mjs';
import { createSceneCompletionObservation } from '../../src/scene/completion-observation.mjs';
import { beginNativeFrame, enterNativeCustomRender, leaveNativeCustomRender, sealNativeFrame,
  abortNativeFrame, registerNativeFrameDemand, captureNativeFrameAuthority } from '../../src/scene/native-frame-authority.mjs';
import { createSceneCompletionGl } from './scene-completion-gl.mjs';

export function createObservationFixture(options = {}) {
  const gpu = createSceneCompletionGl(options), { gl, raf } = gpu;
  gpu.state.set('READ_FRAMEBUFFER_BINDING', null);
  let current = true, disposing = false, nativeFrame, scope, authority, plan, paintCounts;
  const implementation = {}, originalRender = () => {}, originalArgs = {};
  const releaseDemand = registerNativeFrameDemand(gl, implementation, originalRender);
  const origin = Object.freeze({ key: 'origin' });
  const position = options.position ?? [0, 0, 0];
  const marker = Object.freeze({ id: 'anchor', acceptedPositionRevision: 1, radiusCss: options.radiusCss ?? 6,
    position: Object.freeze({ lngLat: Object.freeze([0, 0]), altitude: position[2], altitudeReference: options.reference ?? 'sea-level' }),
    rgba: Object.freeze([1, 0, 0, options.alpha ?? 1]) });
  const frame = Object.freeze({ width: options.width ?? 640, height: options.height ?? 480, pixelRatio: options.pixelRatio ?? 1,
    geographic: Object.freeze({
      resolve: value => ({ ...value, status: 'resolved' }),
      encode: () => [...position],
      project: () => ({ status: 'visibility-pending', visible: false, clip: [...position, 1],
        point: [(position[0] + 1) * (options.width ?? 640) / 2, (1 - position[1]) * (options.height ?? 480) / 2] }),
      shader: () => Object.freeze({ key: 'mercator', defines: '', horizonMode: options.horizonMode ?? 'none',
        uniforms: options.uploadedTransition === 'missing' ? [] : [{ name: 'u_projection_transition', type: 'float', value: options.uploadedTransition ?? 0 }],
        vertexPrelude: 'vec4 lrProjectPosition(vec3 p) { return vec4(p, 1.0); }\nvec3 lrHorizonPosition(vec3 p) { return p; }',
        fragmentPrelude: 'bool lrHorizonOccluded(vec3 p) { return false; }' })
    }) });
  const envelope = createSceneGlEnvelope(gl, { profile: 'point', isCurrent: () => current || disposing });
  const renderer = createSceneGlyphRenderer({ gl, geographic: { frameFor: () => origin }, isCurrent: () => current || disposing,
    reserve: () => ({ release() {} }), withState: (kind, work) => {
      disposing = kind === 'dispose';
      try { return envelope.run(work); } finally { disposing = false; }
    } });
  const completed = [], unavailable = [];
  const observation = createSceneCompletionObservation({ gl, isCurrent: () => current,
    requestAnimationFrame: callback => raf.request(callback), cancelAnimationFrame: id => raf.cancel(id), now: () => raf.now(),
    onComplete: (issue, result) => completed.push({ issue, result }), onUnavailable: (issue, code) => unavailable.push({ issue, code }) });
  const facts = () => ({ styleGeneration: 1, orderedLayers: [{ id: 'base', type: 'background' }, { id: 'scene', type: 'custom' }],
    terrainEnabled: options.terrain ?? false, projection: options.projection ?? 'mercator', projectionTransition: options.transition ?? 0,
    debug: options.debug ?? false, tailDraws: options.tailDraws ?? false });
  function open(change = {}) {
    nativeFrame = beginNativeFrame(gl, {}, { ...facts(), ...change });
    scope = enterNativeCustomRender(nativeFrame, implementation, originalRender, originalArgs, { pass: 'translucent', currentLayer: 1 });
    const captured = captureNativeFrameAuthority(gl, implementation, originalRender, originalArgs);
    assert.equal(captured.status, 'admitted'); authority = captured.authority;
    return { authority };
  }
  return {
    open, gpu, gl, raf, renderer, observation, marker, frame, completed, unavailable,
    get paintCounts() { return paintCounts; }, get plan() { return plan; }, get authority() { return authority; }, get nativeFrame() { return nativeFrame; },
    begin(change = {}, markers = [marker]) {
      open(change);
      renderer.render(frame, markers, authority);
      paintCounts = { created: gpu.created.size, draws: gpu.draws.length };
      options.beforeCapture?.(gpu);
      plan = captureSceneGlyphObservation(renderer, frame, marker, authority);
      assert.ok(plan); assert.ok(Object.isFrozen(plan)); return { plan, authority };
    },
    issue(value = { plan, authority }) { return observation.issue(value); },
    finish(normal = true) {
      leaveNativeCustomRender(scope, normal);
      if (normal) return sealNativeFrame(nativeFrame);
      abortNativeFrame(nativeFrame); return false;
    },
    settle(values = true) { gpu.settleQueries(values); gpu.signal(); raf.step(); },
    expire() { current = false; },
    stop() {
      observation.dispose({ contextLost: gl.isContextLost() });
      renderer.dispose({ contextLost: gl.isContextLost() }); envelope.dispose(); releaseDemand();
    }
  };
}
