import { expect } from '@open-wc/testing';
import { admitMapViewpoint } from './map-camera-session-data.js';
import { prepareMapCameraFollow, startMapCameraFollow, type MapCameraFollowDependencies,
  type MapCameraFollowOwner, type MapCameraFollowTarget, type MapCameraFollowFrame,
  type MapCameraFollowNotice, type MapCameraFollowSnapshot, type MapCameraFollowStamp } from './map-camera-follow-controller.js';

function profile() {
  return { latitude: 0, zoom: 8, pitch: 60, width: 640, height: 480, projectionTransition: 1,
    padding: { top: 0, bottom: 0, left: 0, right: 0 }, explicitBounds: false, explicitZoomLimits: false,
    nativeBounds: false, nativeMinZoom: -2, nativeMaxZoom: 22, terrain: false, canPan: true,
    canObserveMotion: true, canStop: true, moving: false, hasProjection: true };
}
function fixture() {
  const identity = Object.freeze({});
  const targets = new Set<(notice: MapCameraFollowNotice) => void>();
  const frames = new Set<(frame: MapCameraFollowFrame) => void>();
  const published: MapCameraFollowSnapshot[] = [], prepared: (readonly number[])[] = [], pans: (readonly number[])[] = [];
  const preparations = new WeakMap<object, readonly [number, number]>();
  const state = {
    current: true, reduced: false, view: 1, placement: 1, style: 1, context: 1,
    target: { kind: 'eligible', objectKind: 'model', positionRevision: 1, center: [0, 0], altitude: 1000,
      altitudeReference: 'sea-level' } as MapCameraFollowTarget,
    watchAcquired: 0, watchReleased: 0, frameReleased: 0, targetReleased: 0, groundWrites: 0,
    requests: 0, commits: 0, depth: 0, maximumDepth: 0, rejectPan: false, throwPan: false,
    throwFrameSubscribe: false, throwRequest: false,
    order: [] as string[],
    onPrepare: undefined as (() => void) | undefined,
    onCommit: undefined as (() => void) | undefined,
  };
  const stamp = (): MapCameraFollowStamp => ({ owner: identity, context: state.context, style: state.style, view: state.view,
    position: state.target.kind === 'eligible' ? state.target.positionRevision : 0, placement: state.placement });
  const dependencies: MapCameraFollowDependencies = {
    current: () => state.current,
    capture: () => admitMapViewpoint({ center: [0, 0], zoom: 8, bearing: 0, pitch: 60 }),
    reducedMotion: () => state.reduced,
    scene: {
      target: () => state.target,
      watchTarget(objectId) {
        expect(objectId).to.equal('vehicle'); state.watchAcquired++; state.order.push('watch');
        let active = true; return () => { if (active) { active = false; state.watchReleased++; state.order.push('unwatch'); } };
      },
      subscribeTargets(listener) {
        state.order.push('targets'); targets.add(listener);
        return () => { if (targets.delete(listener)) state.targetReleased++; };
      },
      subscribeFrames(objectId, listener) {
        expect(objectId).to.equal('vehicle');
        if (state.throwFrameSubscribe) throw new Error('Frame subscription unavailable');
        state.order.push('frames'); frames.add(listener);
        return () => { if (frames.delete(listener)) state.frameReleased++; };
      },
      current(value) {
        const expected = stamp();
        return value.owner === expected.owner && value.context === expected.context && value.style === expected.style &&
          value.view === expected.view && value.position === expected.position && value.placement === expected.placement;
      },
      requestFrame(objectId) {
        expect(objectId).to.equal('vehicle'); state.requests++; state.order.push('request');
        if (state.throwRequest) throw new Error('Frame request unavailable');
      },
    },
  };
  const owner: MapCameraFollowOwner = {
    current: () => state.current,
    prepareGround() { throw new Error('Visual follow must not prepare a ground seed'); },
    commitGround() { state.groundWrites++; throw new Error('Visual follow must not write a ground seed'); },
    preparePan(offset) {
      prepared.push([...offset]); const value = Object.freeze({}); preparations.set(value, offset); state.onPrepare?.(); return value;
    },
    commitPan(value) {
      state.commits++; state.depth++; state.maximumDepth = Math.max(state.maximumDepth, state.depth);
      try {
        if (state.throwPan) throw new Error('Native detail must not be published');
        if (state.rejectPan) return false;
        const offset = preparations.get(value); if (!offset) throw new Error('Unknown prepared pan');
        pans.push([...offset]); state.view++; state.onCommit?.(); return true;
      } finally { state.depth--; }
    },
    publish(value) { expect(Object.isFrozen(value)).to.equal(true); published.push(value); },
  };
  const frame = (serial: number, offset = 20, result?: MapCameraFollowFrame['result']): MapCameraFollowFrame => ({
    serial, stamp: stamp(), profile: profile(), width: 640, height: 480,
    result: result ?? { status: 'visible', point: [320 + offset, 240] },
  });
  const emit = (value: MapCameraFollowFrame): void => { for (const listener of [...frames]) listener(value); };
  const notice = (value: MapCameraFollowNotice): void => { for (const listener of [...targets]) listener(value); };
  const advanceTarget = (): void => {
    if (state.target.kind !== 'eligible') throw new Error('Expected eligible target');
    state.target = { ...state.target, positionRevision: state.target.positionRevision + 1 };
    notice({ kind: 'target', objectId: 'vehicle' });
  };
  return { state, dependencies, owner, published, prepared, pans, targets, frames, frame, emit, notice, advanceTarget };
}
function start(h: ReturnType<typeof fixture>) {
  return startMapCameraFollow(prepareMapCameraFollow({ objectId: 'vehicle', mode: 'geographic-visual' }, h.dependencies), h.owner);
}

describe('injected visual camera follow runner', () => {
  it('acquires target demand before completed-frame observation and never seeds or guesses a projection', () => {
    const h = fixture(), runner = start(h);
    expect(h.state.watchAcquired).to.equal(1);
    expect(h.state.order.indexOf('watch')).to.be.lessThan(h.state.order.indexOf('frames'));
    expect(h.state.order.indexOf('frames')).to.be.lessThan(h.state.order.indexOf('request'));
    expect(h.state.requests).to.equal(1); expect(h.pans).to.deep.equal([]); expect(h.state.groundWrites).to.equal(0);
    h.emit(h.frame(1, 30)); expect(h.pans).to.deep.equal([[30, 0]]);
    expect(runner.snapshot).to.include({ status: 'centering', corrections: 1 });
    h.emit(h.frame(2, 1)); expect(runner.snapshot).to.include({ status: 'centered', corrections: 1 });
    runner.dispose(); runner.dispose();
    expect(h.state.watchReleased).to.equal(1); expect(h.state.frameReleased).to.equal(1); expect(h.state.targetReleased).to.equal(1);
  });

  it('releases partial startup ownership when a later subscription or request fails', () => {
    for (const failure of ['subscription', 'request'] as const) {
      const h = fixture(); h.state.throwFrameSubscribe = failure === 'subscription'; h.state.throwRequest = failure === 'request';
      const runner = start(h);
      expect(runner.snapshot).to.include({ status: 'unavailable', reason: 'engine' });
      expect(h.pans.length).to.equal(0); expect(h.targets.size).to.equal(0); expect(h.frames.size).to.equal(0);
      expect(h.state.targetReleased).to.equal(1); expect(h.state.watchReleased).to.equal(1);
      expect(h.state.frameReleased).to.equal(failure === 'request' ? 1 : 0);
      runner.dispose(); expect(h.state.targetReleased).to.equal(1); expect(h.state.watchReleased).to.equal(1);
    }
  });

  it('waits on pending placement and refuses all nonvisible results without spending corrections', () => {
    const h = fixture(), runner = start(h);
    h.emit(h.frame(1, 20, { status: 'pending' }));
    expect(runner.snapshot).to.include({ status: 'pending', corrections: 0 });
    for (const [index, status] of (['occluded', 'clipped', 'behind-camera', 'unavailable'] as const).entries()) {
      h.emit(h.frame(index + 2, 20, { status }));
      expect(runner.snapshot).to.include({ status: 'unavailable', reason: 'placement', corrections: 0 });
    }
    expect(h.prepared).to.deep.equal([]); expect(h.pans).to.deep.equal([]);
    h.emit(h.frame(10, 20)); expect(h.pans.length).to.equal(1); expect(runner.snapshot.corrections).to.equal(1);
    runner.dispose();
  });

  it('classifies profile refusal before any pan and does not reopen from a later frame alone', () => {
    for (const [change, reason] of [
      [{ nativeMinZoom: 0 }, 'camera-constraints'], [{ canPan: false }, 'camera-capability'],
      [{ zoom: 3 }, 'camera-domain'], [{ terrain: true }, 'terrain'],
    ] as const) {
      const h = fixture(), runner = start(h), refused = h.frame(1);
      h.emit({ ...refused, profile: { ...profile(), ...change } });
      expect(runner.snapshot).to.include({ status: 'unavailable', reason, corrections: 0 });
      h.emit(h.frame(2)); expect(h.prepared.length).to.equal(0); expect(h.pans.length).to.equal(0);
      h.advanceTarget(); h.emit(h.frame(3)); expect(h.pans.length).to.equal(1);
      runner.dispose();
    }
  });

  it('allows four improving corrections, measures the fifth frame and then stays limited', () => {
    const h = fixture(), runner = start(h);
    for (const [index, offset] of [40, 30, 20, 10, 5].entries()) h.emit(h.frame(index + 1, offset));
    expect(h.pans.length).to.equal(4); expect(runner.snapshot).to.include({ status: 'limited', corrections: 4 });
    h.state.placement++; h.emit(h.frame(6, 0));
    expect(h.pans.length).to.equal(4); expect(runner.snapshot.status).to.equal('limited');
    runner.dispose();
  });

  it('retains spent corrections when equal-target notices reenter accepted camera writes', () => {
    const h = fixture(), runner = start(h);
    h.state.onCommit = () => { h.notice({ kind: 'target', objectId: 'vehicle' }); };
    for (const [index, offset] of [60, 50, 40, 30, 20, 10].entries()) h.emit(h.frame(index + 1, offset));
    expect(h.pans.length).to.equal(4); expect(runner.snapshot).to.include({ status: 'limited', corrections: 4 });
    runner.dispose();
  });

  it('does not consume an older visible frame after a newer completed pending observation', () => {
    const h = fixture(), runner = start(h);
    h.emit(h.frame(10, 20, { status: 'pending' })); h.emit(h.frame(9, 20));
    expect(h.pans.length).to.equal(0); expect(runner.snapshot.status).to.equal('pending');
    h.emit(h.frame(11, 20)); expect(h.pans.length).to.equal(1); runner.dispose();
  });

  it('limits reduced-motion acquisition to one correction while allowing a centered next observation', () => {
    for (const remaining of [0, 10]) {
      const h = fixture(); h.state.reduced = true; const runner = start(h);
      h.emit(h.frame(1, 30)); h.emit(h.frame(2, remaining));
      expect(h.pans.length).to.equal(1);
      expect(runner.snapshot).to.include({ status: remaining === 0 ? 'centered' : 'limited', corrections: 1 });
      h.emit(h.frame(3, 20)); expect(h.pans.length).to.equal(1);
      runner.dispose();
    }
  });

  it('never mints another reduced-motion acquisition allowance on external resets or preference toggles', () => {
    const h = fixture(); h.state.reduced = true; const runner = start(h);
    h.emit(h.frame(1, 30)); expect(h.pans.length).to.equal(1);
    h.advanceTarget(); h.notice({ kind: 'viewport', revision: 1 }); h.emit(h.frame(2, 20));
    expect(h.pans.length).to.equal(1);
    h.state.reduced = false; runner.refreshMotion(false);
    h.state.reduced = true; runner.refreshMotion(true);
    h.advanceTarget(); h.notice({ kind: 'viewport', revision: 2 }); h.emit(h.frame(3, 10));
    expect(h.pans.length).to.equal(1);
    runner.dispose();
  });

  it('does not reopen a centered zero-write attempt when reduced motion becomes enabled', () => {
    const h = fixture(), runner = start(h); h.emit(h.frame(1, 0));
    runner.refreshMotion(true); h.emit(h.frame(2, 30));
    expect(h.pans.length).to.equal(0); expect(runner.snapshot.status).to.equal('centered'); runner.dispose();
  });

  it('rereads reduced motion at startup rather than using a stale preflight preference', () => {
    const h = fixture();
    const plan = prepareMapCameraFollow({ objectId: 'vehicle', mode: 'geographic-visual' }, h.dependencies);
    h.state.reduced = true;
    const runner = startMapCameraFollow(plan, h.owner);
    h.emit(h.frame(1, 30)); h.emit(h.frame(2, 20)); h.emit(h.frame(3, 10));
    expect(h.pans.length).to.equal(1); expect(runner.snapshot.status).to.equal('limited');
    runner.dispose();
  });

  it('never writes twice for a serial even across target and viewport budget resets', () => {
    const h = fixture(), runner = start(h);
    h.emit(h.frame(5, 30)); expect(h.pans.length).to.equal(1);
    h.advanceTarget(); h.emit(h.frame(5, 20)); expect(h.pans.length).to.equal(1);
    h.notice({ kind: 'viewport', revision: 1 }); h.emit(h.frame(5, 10)); expect(h.pans.length).to.equal(1);
    h.emit(h.frame(6, 10)); expect(h.pans.length).to.equal(2);
    expect(runner.snapshot.corrections).to.equal(1);
    runner.dispose();
  });

  it('keeps centered state terminal until a genuinely changed target or external viewport notice', () => {
    const h = fixture(), runner = start(h);
    h.emit(h.frame(1, 0)); h.emit(h.frame(2, 30));
    h.notice({ kind: 'target', objectId: 'unrelated' }); h.emit(h.frame(3, 30));
    h.notice({ kind: 'target', objectId: 'vehicle' }); h.emit(h.frame(4, 30));
    expect(h.pans.length).to.equal(0); expect(runner.snapshot.status).to.equal('centered');
    h.notice({ kind: 'viewport', revision: 1 }); h.emit(h.frame(5, 30));
    expect(h.pans.length).to.equal(1);
    h.notice({ kind: 'viewport', revision: 1 }); h.emit(h.frame(6, 20));
    expect(runner.snapshot.corrections).to.equal(2);
    runner.dispose();
  });

  it('ignores frames with stale target, style, camera or placement identities', () => {
    const h = fixture(), runner = start(h), before = h.published.length;
    for (const [index, key] of (['position', 'style', 'view', 'placement'] as const).entries()) {
      const value = h.frame(index + 1);
      h.emit({ ...value, stamp: { ...value.stamp, [key]: value.stamp[key] + 1 } });
    }
    expect(h.prepared.length).to.equal(0); expect(h.pans.length).to.equal(0); expect(h.published.length).to.equal(before);
    h.emit(h.frame(10)); expect(h.pans.length).to.equal(1);
    runner.dispose();
  });

  it('rechecks scene identity after pan preparation and owner identity before publication', () => {
    const h = fixture(), runner = start(h);
    h.state.onPrepare = () => { h.state.onPrepare = undefined; h.state.view++; };
    h.emit(h.frame(1)); expect(h.state.commits).to.equal(0); expect(h.pans.length).to.equal(0);
    const before = h.published.length;
    h.state.onPrepare = () => { h.state.current = false; };
    h.emit(h.frame(2)); expect(h.state.commits).to.equal(0); expect(h.published.length).to.equal(before);
    runner.dispose();
  });

  it('fences the old delivery when the same owner receives a new target position during preparePan', () => {
    const h = fixture(), runner = start(h);
    h.state.onPrepare = () => { h.state.onPrepare = undefined; h.advanceTarget(); };
    h.emit(h.frame(1, 30)); expect(h.state.commits).to.equal(0); expect(h.pans.length).to.equal(0);
    h.emit(h.frame(2, 20));
    expect(h.pans).to.deep.equal([[20, 0]]);
    expect(runner.snapshot).to.include({ status: 'centering', corrections: 1 });
    runner.dispose();
  });

  it('publishes only sanitized engine refusal for a current thrown or rejected pan', () => {
    for (const thrown of [false, true]) {
      const h = fixture(), runner = start(h); h.state.throwPan = thrown; h.state.rejectPan = !thrown;
      h.emit(h.frame(1));
      expect(runner.snapshot).to.include({ status: 'unavailable', reason: 'engine' });
      expect(h.pans.length).to.equal(0);
      expect(Object.keys(runner.snapshot).sort()).to.deep.equal(['corrections', 'reason', 'status']);
      runner.dispose();
    }
  });

  it('drains only the latest reentrant completed frame without recursively committing', () => {
    const h = fixture(), runner = start(h);
    h.state.onCommit = () => {
      h.state.onCommit = undefined;
      h.emit(h.frame(2, 30)); h.emit(h.frame(3, 20));
      expect(h.pans.length, 'Queued frames cannot recurse into commitPan').to.equal(1);
    };
    h.emit(h.frame(1, 40));
    expect(h.pans).to.deep.equal([[40, 0], [20, 0]]); expect(h.state.maximumDepth).to.equal(1);
    h.emit(h.frame(4, 0)); expect(runner.snapshot).to.include({ status: 'centered', corrections: 2 });
    runner.dispose();
  });

  it('drops queued frames and releases target demand exactly once when disposed inside commit', () => {
    const h = fixture(); let runner: ReturnType<typeof start>;
    runner = start(h);
    h.state.onCommit = () => { h.emit(h.frame(2, 20)); runner.dispose(); };
    h.emit(h.frame(1, 30)); const publications = h.published.length;
    h.emit(h.frame(3, 10)); runner.dispose();
    expect(h.pans.length).to.equal(1); expect(h.state.maximumDepth).to.equal(1); expect(h.published.length).to.equal(publications);
    expect(h.frames.size).to.equal(0); expect(h.targets.size).to.equal(0);
    expect(h.state.watchReleased).to.equal(1); expect(h.state.frameReleased).to.equal(1); expect(h.state.targetReleased).to.equal(1);
  });
});
