import { expect } from '@open-wc/testing';
import { createMapSceneSessionFacade } from './map-scene-session.js';
import type { MapSceneSessionBacking, SceneCameraProfile, SceneCompletedFrame } from './map-scene-contract.js';
import { sceneBackingHarness, sceneStateHarness, sceneTarget, sceneViewport } from '../../test/map-scene-session-fixtures.js';

function setup() {
  const state = sceneStateHarness(), target = sceneTarget();
  state.set([target]);
  const facade = createMapSceneSessionFacade({ connection: state.connection });
  expect(facade.bindState(state.state)).to.equal(true);
  const backing = sceneBackingHarness(state);
  expect(facade.promote(backing.backing)).to.equal(true);
  return { state, target, facade, backing, attachment: facade.attachment };
}

for (const connection of [null, undefined, 1, 'connection', true, () => {}]) {
  it(`rejects a ${typeof connection} connection token before establishing a scene session`, () => {
    expect(() => createMapSceneSessionFacade({ connection: connection as unknown as object })).to.throw(TypeError);
  });
}

for (const method of ['subscribeTargets', 'subscribeViewport', 'subscribeCompletedFrames'] as const) {
  it(`validates ${method} listeners and makes subscriptions after close inert`, () => {
    const { state, facade, backing, attachment } = setup();
    try {
      for (const invalid of [null, undefined, 7, {}]) {
        expect(() => attachment[method](invalid as unknown as () => void)).to.throw(TypeError);
      }
      facade.close();
      let calls = 0;
      const release = attachment[method](() => { calls++; });
      state.set([sceneTarget('later', 2, 2)]);
      state.viewport(sceneViewport(2, 800));
      backing.emit(backing.frame(1));
      release(); release();
      expect(calls).to.equal(0);
      expect(state.releases).to.equal(1);
      expect(backing.releases).to.equal(1);
    } finally { facade.close(); }
  });
}

for (const method of ['subscribeCompletedFrames', 'watchTarget', 'requestFrame', 'projectTarget', 'current'] as const) {
  for (const malformed of ['missing', 'accessor'] as const) {
    it(`rejects a ${malformed} backing ${method} without retiring the working renderer`, () => {
      const { target, facade, backing, attachment } = setup();
      let reads = 0;
      try {
        const original = backing.frame(1); backing.emit(original);
        const candidate = { ...backing.backing, [method]: undefined };
        if (malformed === 'accessor') {
          Object.defineProperty(candidate, method, { get() { reads++; throw new Error('Unavailable capability'); } });
        }
        expect(facade.promote(Object.freeze(candidate) as unknown as MapSceneSessionBacking)).to.equal(false);
        expect(reads).to.equal(0);
        expect(backing.releases).to.equal(0);
        expect(attachment.current(original, target)).to.equal(true);
        expect(attachment.projectTarget(original, target.id)?.point).to.deep.equal([20, 30]);
        attachment.requestFrame();
        expect(backing.requests).to.equal(1);
      } finally { facade.close(); }
      expect(backing.releases).to.equal(1);
    });
  }
}

for (const flag of ['explicitBounds', 'explicitZoomLimits', 'nativeBounds', 'terrain', 'canPan',
  'canObserveMotion', 'canStop', 'moving', 'hasProjection'] as const) {
  it(`rejects a non-boolean camera ${flag} without consuming the completed frame serial`, () => {
    const { target, facade, backing, attachment } = setup();
    const serials: number[] = [];
    try {
      attachment.subscribeCompletedFrames(frame => serials.push(frame.stamp.paintFrameSerial));
      const original = backing.frame(1); backing.emit(original);
      const invalid = backing.frame(100, {
        cameraProfile: Object.freeze({ ...original.cameraProfile, [flag]: 1 }) as unknown as SceneCameraProfile,
      });
      backing.emit(invalid);
      expect(serials).to.deep.equal([1]);
      expect(attachment.current(invalid, target)).to.equal(false);
      expect(attachment.current(original, target)).to.equal(true);
      const next = backing.frame(2); backing.emit(next);
      expect(serials).to.deep.equal([1, 2]);
      expect(attachment.current(next, target)).to.equal(true);
    } finally { facade.close(); }
  });
}

it('retains target and allocation baselines for subscriptions acquired during a capture failure', () => {
  const { state, facade, attachment } = setup();
  const targets: string[][] = [], widths: number[] = [];
  try {
    state.hooks.captureError = true;
    attachment.subscribeTargets(notice => targets.push([...notice.changedIds]));
    attachment.subscribeViewport(notice => widths.push(notice.width));
    state.hooks.captureError = false;
    state.emit();
    expect(targets).to.deep.equal([]);
    expect(widths).to.deep.equal([]);
    state.set([sceneTarget('replacement', 2, 2)]);
    state.viewport(sceneViewport(2, 800));
    expect(targets).to.deep.equal([['replacement', 'target']]);
    expect(widths).to.deep.equal([800]);
    expect(state.subscriptions).to.equal(1);
  } finally { facade.close(); }
});

it('continues independent viewport and frame listeners after a preceding consumer throws', () => {
  const { state, target, facade, backing, attachment } = setup();
  const widths: number[] = [], frames: number[] = [];
  try {
    attachment.subscribeViewport(() => { throw new Error('Consumer viewport handler'); });
    attachment.subscribeViewport(notice => widths.push(notice.width));
    attachment.subscribeCompletedFrames(() => { throw new Error('Consumer frame handler'); });
    attachment.subscribeCompletedFrames(frame => frames.push(frame.stamp.paintFrameSerial));
    state.viewport(sceneViewport(2, 800));
    const frame = backing.frame(1); backing.emit(frame);
    expect(widths).to.deep.equal([800]);
    expect(frames).to.deep.equal([1]);
    expect(attachment.current(frame, target)).to.equal(true);
    expect(backing.releases).to.equal(0);
    expect(state.releases).to.equal(0);
  } finally { facade.close(); }
});

it('honors target and frame listener cancellation during delivery', () => {
  const { state, facade, backing, attachment } = setup();
  const calls: string[] = [];
  let releaseTarget = () => {}, releaseFrame = () => {};
  try {
    attachment.subscribeTargets(() => { calls.push('target-first'); releaseTarget(); });
    releaseTarget = attachment.subscribeTargets(() => calls.push('target-canceled'));
    attachment.subscribeCompletedFrames(() => { calls.push('frame-first'); releaseFrame(); });
    releaseFrame = attachment.subscribeCompletedFrames(() => calls.push('frame-canceled'));
    state.set([sceneTarget('replacement', 2, 2)]);
    backing.emit(backing.frame(1));
    backing.emit(backing.frame(2));
    expect(calls).to.deep.equal(['target-first', 'frame-first', 'frame-first']);
  } finally { facade.close(); }
});

it('bounds currency queries made during frame delivery and recovers with a new renderer', () => {
  const { state, target, facade, backing, attachment } = setup();
  const replacement = sceneBackingHarness(state);
  let accepted = 0, refused = 0;
  try {
    const release = attachment.subscribeCompletedFrames(frame => {
      for (let index = 0; index < 7_000; index++) {
        if (attachment.current(frame, target)) accepted++; else refused++;
      }
    });
    const frame: SceneCompletedFrame = backing.frame(1); backing.emit(frame);
    expect(accepted).to.be.greaterThan(0);
    expect(accepted).to.be.at.most(6_144);
    expect(refused).to.equal(7_000 - accepted);
    expect(backing.currentCalls).to.equal(accepted);
    expect(backing.releases).to.equal(1);
    expect(state.releases).to.equal(0);
    expect(attachment.target(target.id).status).to.equal('accepted');
    release();
    expect(facade.promote(replacement.backing)).to.equal(true);
    const next = replacement.frame(2); replacement.emit(next);
    expect(attachment.current(frame, target)).to.equal(false);
    expect(attachment.current(next, target)).to.equal(true);
  } finally { facade.close(); }
  expect(replacement.releases).to.equal(1);
});
