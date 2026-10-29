import { expect } from '@open-wc/testing';
import { createMapSceneSessionFacade, mapSceneSessionAttachment, registerMapSceneSession } from './map-scene-session.js';
import { sceneBackingHarness, sceneStateHarness, sceneTarget, sceneViewport } from '../../test/map-scene-session-fixtures.js';
import type { SceneCompletedFrame, SceneRegistryNotice, SceneTargetProjection } from './map-scene-contract.js';

function setup(accepted = true) {
  const h = sceneStateHarness();
  const fact = sceneTarget();
  if (accepted) h.set([fact]);
  const facade = createMapSceneSessionFacade({ connection: h.connection });
  const b = sceneBackingHarness(h);
  return { h, fact, facade, a: facade.attachment, b };
}

describe('stable map scene attachment ownership', () => {
  it('registers one inert empty attachment and preserves it through held work and retry', () => {
    const { h, facade, a, b } = setup();
    const host = document.createElement('div');
    const unregister = registerMapSceneSession(host, a);
    expect(mapSceneSessionAttachment(host) === a).to.equal(true);
    expect(a.target('target')).to.deep.equal({ status: 'absent' });
    const frame = b.frame(1);
    expect(a.current(frame, sceneTarget())).to.equal(false);
    expect(a.projectTarget(frame, 'target')).to.equal(undefined);
    const stop = a.watchTarget('target'); a.requestFrame(); a.requestFrame();
    expect(b.subscriptions).to.equal(0); expect(b.requests).to.equal(0);
    expect(facade.bindState(h.state)).to.equal(true);
    expect(facade.promote(b.backing)).to.equal(true);
    expect(mapSceneSessionAttachment(host) === a).to.equal(true);
    expect(b.acquired).to.deep.equal(['target']); expect(b.requests).to.equal(1);
    stop(); facade.close(); unregister(); unregister();
    expect(mapSceneSessionAttachment(host)).to.equal(undefined);
  });

  it('delivers pre-load subscriptions and coalesces live watch owners and wakeups', () => {
    const { h, facade, a, b } = setup();
    const targets: string[][] = [], allocations: number[] = [], frames: number[] = [];
    a.subscribeTargets((notice: SceneRegistryNotice) => targets.push([...notice.changedIds]));
    a.subscribeViewport(notice => allocations.push(notice.allocationRevision));
    a.subscribeCompletedFrames(frame => frames.push(frame.stamp.paintFrameSerial));
    const first = a.watchTarget('target'), second = a.watchTarget('target');
    a.requestFrame(); a.requestFrame();
    facade.bindState(h.state); facade.promote(b.backing); b.emit(b.frame(1));
    expect(targets).to.deep.equal([['target']]); expect(allocations).to.deep.equal([1]);
    expect(frames).to.deep.equal([1]); expect(b.acquired).to.deep.equal(['target']);
    first(); first(); expect(b.retired).to.deep.equal([]);
    second(); second(); expect(b.retired).to.deep.equal(['target']);
    facade.close(); expect(h.releases).to.equal(1); expect(b.releases).to.equal(1);
  });

  it('does not revive a demand released before the lazy backing is installed', () => {
    const { h, facade, a, b } = setup();
    const release = a.watchTarget('target'); release(); release();
    facade.bindState(h.state); facade.promote(b.backing);
    expect(b.acquired).to.deep.equal([]); facade.close();
  });

  it('requires the exact bound state and does not let an old unregister remove reconnect state', () => {
    const old = setup(), next = setup(); const host = document.createElement('div');
    const unregister = registerMapSceneSession(host, old.a);
    old.facade.bindState(old.h.state);
    expect(old.facade.bindState(next.h.state)).to.equal(false);
    expect(old.facade.promote(next.b.backing)).to.equal(false);
    old.facade.close(); registerMapSceneSession(host, next.a); unregister();
    expect(mapSceneSessionAttachment(host) === next.a).to.equal(true);
    expect(old.facade.bindState(old.h.state)).to.equal(false);
    expect(old.facade.promote(old.b.backing)).to.equal(false);
    expect(old.b.subscriptions).to.equal(0); next.facade.close();
  });

  it('rejects a different state identity even when its connection token is copied', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state);
    const other = Object.freeze({ ...h.state });
    expect(facade.bindState(other)).to.equal(false);
    expect(facade.promote(Object.freeze({ ...b.backing, state: other }))).to.equal(false);
    expect(a.target('target').status).to.equal('accepted'); facade.close();
  });

  it('subscribes before capturing state changes made during subscription installation', () => {
    const { h, facade, a } = setup(false); const notices: string[][] = [];
    a.subscribeTargets(notice => notices.push([...notice.changedIds]));
    h.hooks.subscribe = () => h.set([sceneTarget('later', 2, 1)]);
    facade.bindState(h.state);
    expect(a.target('later').status).to.equal('accepted');
    expect(notices).to.deep.equal([['later']]); facade.close();
  });

  it('retries failed initial state binding without stranding callers or partial subscriptions', () => {
    const { h, facade, a } = setup(); const notices: string[][] = [];
    a.subscribeTargets(notice => notices.push([...notice.changedIds]));
    h.hooks.captureError = true;
    expect(facade.bindState(h.state)).to.equal(false);
    expect(h.releases).to.equal(1); expect(a.target('target')).to.deep.equal({ status: 'absent' });
    h.hooks.captureError = false;
    expect(facade.bindState(h.state)).to.equal(true);
    expect(notices).to.deep.equal([['target']]); facade.close(); expect(h.releases).to.equal(2);
  });

  it('keeps accepted B authoritative when frame installation fails after accepting B', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    const notices: string[][] = []; a.subscribeTargets(notice => notices.push([...notice.changedIds]));
    const replacement = sceneBackingHarness(h); const next = sceneTarget('target', 7, 2);
    replacement.hooks.subscribe = () => { h.set([next]); throw new Error('Frame backend unavailable'); };
    expect(facade.promote(replacement.backing)).to.equal(false);
    const read = a.target('target');
    expect(read.status).to.equal('accepted');
    if (read.status !== 'accepted') throw new Error('Expected authoritative target');
    expect(read.target === next).to.equal(true); expect(notices).to.deep.equal([['target']]);
    expect(h.releases).to.equal(0); expect(replacement.releases).to.equal(1);
    replacement.hooks.subscribe = undefined;
    facade.promote(replacement.backing); expect(notices).to.deep.equal([['target']]); facade.close();
  });

  it('reads changed authority before invalidation without consuming later listener notices', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    const frame = b.frame(1); b.emit(frame);
    const notices: string[][] = []; a.subscribeTargets(notice => notices.push([...notice.changedIds]));
    const next = sceneTarget('target', 8, 2); h.set([next], { notify: false });
    const read = a.target('target');
    if (read.status !== 'accepted') throw new Error('Expected current target');
    expect(read.target === next).to.equal(true);
    expect(a.current(frame, next)).to.equal(false); expect(a.projectTarget(frame, 'target')).to.equal(undefined);
    expect(notices).to.deep.equal([]); h.emit(); expect(notices).to.deep.equal([['target']]); facade.close();
  });

  it('preserves complete per-listener diffs across disjoint reentrant state changes', () => {
    const { h, facade, a } = setup(false);
    const x1 = sceneTarget('x', 0, 1), y1 = sceneTarget('y', 0, 2);
    h.set([x1, y1]); facade.bindState(h.state);
    const first: string[][] = [], second: string[][] = [];
    const x2 = sceneTarget('x', 1, 3), y2 = sceneTarget('y', 1, 4);
    let reentered = false;
    a.subscribeTargets(notice => {
      first.push([...notice.changedIds].sort());
      if (!reentered) { reentered = true; h.set([x2, y2]); }
    });
    a.subscribeTargets(notice => second.push([...notice.changedIds].sort()));
    h.set([x2, y1]);
    expect(first).to.deep.equal([['x'], ['y']]); expect(second).to.deep.equal([['x', 'y']]); facade.close();
  });

  it('continues current target and viewport notices across frame promotion inside a listener', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    const replacement = sceneBackingHarness(h); let targets = 0, viewports = 0;
    a.subscribeTargets(() => { facade.promote(replacement.backing); });
    a.subscribeTargets(() => targets++);
    a.subscribeViewport(() => { facade.promote(b.backing); });
    a.subscribeViewport(() => viewports++);
    h.set([sceneTarget('target', 3, 2)]); h.viewport(sceneViewport(2, 800));
    expect(targets).to.equal(1); expect(viewports).to.equal(1); expect(h.releases).to.equal(0); facade.close();
  });

  it('gives repeated callback registrations independent releases and isolates thrown callbacks', () => {
    const { h, facade, a } = setup(); facade.bindState(h.state); let calls = 0;
    const callback = () => { calls++; };
    const first = a.subscribeTargets(callback), second = a.subscribeTargets(callback);
    a.subscribeTargets(() => { throw new Error('Observer failed'); });
    first(); first(); h.set([sceneTarget('target', 1, 2)]);
    expect(calls).to.equal(1); second(); h.set([sceneTarget('target', 2, 3)]);
    expect(calls).to.equal(1); facade.close();
  });

  it('preserves exact identity through metadata changes and detects fresh same-position reappearance', () => {
    const { h, fact, facade, a } = setup(); facade.bindState(h.state);
    const changes: string[][] = []; a.subscribeTargets(notice => changes.push([...notice.changedIds]));
    h.set([fact], { registryRevision: h.snapshot.registryRevision });
    const same = a.target('target');
    expect(same.status === 'accepted' && same.target === fact).to.equal(true); expect(changes).to.deep.equal([]);
    h.set([]); h.set([sceneTarget('target', 0, 2)]);
    expect(changes).to.deep.equal([['target'], ['target']]); facade.close();
  });

  it('distinguishes unsupported target kinds from absence and eligible facts', () => {
    const { h, facade, a } = setup(false);
    h.set([Object.freeze({ id: 'route', kind: 'path' }), Object.freeze({ id: 'arc', kind: 'arc' })]);
    facade.bindState(h.state);
    expect(a.target('route')).to.deep.equal({ status: 'unsupported-kind', kind: 'path' });
    expect(a.target('arc')).to.deep.equal({ status: 'unsupported-kind', kind: 'arc' });
    expect(a.target('missing')).to.deep.equal({ status: 'absent' }); facade.close();
  });

  it('fails closed on unavailable state capture and does not invent target disappearance on recovery', () => {
    const { h, facade, a, b, fact } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    const frame = b.frame(1); b.emit(frame); const notices: string[][] = [];
    a.subscribeTargets(notice => notices.push([...notice.changedIds])); h.hooks.captureError = true;
    expect(() => a.target('target')).to.throw(TypeError);
    expect(a.current(frame, fact)).to.equal(false); expect(a.projectTarget(frame, 'target')).to.equal(undefined);
    h.hooks.captureError = false; facade.bindState(h.state);
    expect(a.target('target').status).to.equal('accepted'); expect(notices).to.deep.equal([]); facade.close();
  });

  it('contains malformed or rewound state and conflicting allocation without poisoning recovery', () => {
    const cases = ['accepted-rewind', 'registry-rewind', 'fractional-counter', 'invalid-position',
      'position-revision', 'conflicting-allocation'] as const;
    for (const scenario of cases) {
      const { h, fact, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
      const frame = b.frame(1); b.emit(frame);
      const targets: string[][] = [], viewports: number[] = [];
      a.subscribeTargets(notice => targets.push([...notice.changedIds]));
      a.subscribeViewport(notice => viewports.push(notice.allocationRevision));
      if (scenario === 'accepted-rewind') h.set([fact], { acceptedSceneRevision: 0, notify: false });
      else if (scenario === 'registry-rewind') h.set([fact], { registryRevision: 0, notify: false });
      else if (scenario === 'fractional-counter') h.set([fact], { acceptedSceneRevision: 1.5, notify: false });
      else if (scenario === 'invalid-position') h.set([sceneTarget('target', NaN, 2)], { notify: false });
      else if (scenario === 'position-revision') h.set([sceneTarget('target', 3, 0)], { notify: false });
      else h.viewport(sceneViewport(1, 800), false);
      expect(() => h.emit()).not.to.throw();
      expect(() => a.target('target')).to.throw(TypeError);
      expect(a.current(frame, fact)).to.equal(false);
      expect(a.projectTarget(frame, 'target')).to.equal(undefined); expect(h.releases).to.equal(0);
      h.set([fact], { acceptedSceneRevision: 3, registryRevision: 3, notify: false });
      h.viewport(sceneViewport(2), false); facade.bindState(h.state);
      const restored = a.target('target');
      expect(restored.status === 'accepted' && restored.target === fact).to.equal(true);
      expect(targets).to.deep.equal([]); expect(viewports).to.deep.equal([]); facade.close();
    }
  });

  it('reconciles watches added and removed while backing installation is in progress', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state);
    const releaseFirst = a.watchTarget('first'); let releaseSecond = () => {};
    b.hooks.watch = id => {
      if (id !== 'first') return;
      b.hooks.watch = undefined; releaseFirst(); releaseSecond = a.watchTarget('second');
    };
    facade.promote(b.backing);
    expect([...b.activeWatches.keys()]).to.deep.equal(['second']);
    expect(b.retired).to.deep.equal(['first']); releaseSecond(); facade.close();
  });

  it('retires late handles after promotion and close reentry without disturbing the newer owner', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state); a.watchTarget('target');
    const replacement = sceneBackingHarness(h);
    b.hooks.watch = () => { b.hooks.watch = undefined; facade.promote(replacement.backing); };
    facade.promote(b.backing);
    expect(b.activeWatches.size).to.equal(0); expect(replacement.activeWatches.get('target')).to.equal(1);
    expect(b.retired).to.deep.equal(['target']);
    const closing = sceneBackingHarness(h); closing.hooks.subscribe = () => facade.close();
    facade.promote(closing.backing);
    expect(closing.releases).to.equal(1); expect(replacement.activeWatches.size).to.equal(0);
    expect(a.target('target')).to.deep.equal({ status: 'absent' });
  });

  it('retires all frame demands if a later watch fails without detaching accepted state', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state);
    a.watchTarget('first'); a.watchTarget('second');
    b.hooks.watch = id => { if (id === 'second') throw new Error('Watch unavailable'); };
    expect(facade.promote(b.backing)).to.equal(false);
    expect(b.activeWatches.size).to.equal(0); expect(b.retired.length).to.equal(2);
    expect(b.releases).to.equal(1); expect(h.releases).to.equal(0);
    expect(a.target('target').status).to.equal('accepted'); facade.close();
  });

  it('attempts every independent retirement when release callbacks throw', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state);
    a.watchTarget('first'); a.watchTarget('second'); facade.promote(b.backing);
    b.hooks.release = () => { throw new Error('Retirement observer failed'); };
    expect(() => facade.close()).not.to.throw();
    expect(b.activeWatches.size).to.equal(0); expect(b.retired.length).to.equal(2);
    expect(b.releases).to.equal(1); expect(h.releases).to.equal(1);
  });

  it('closes safely when delivering the pending frame request reenters close', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state);
    a.watchTarget('target'); a.requestFrame();
    b.hooks.request = () => facade.close(); facade.promote(b.backing);
    expect(b.requests).to.equal(1); expect(b.activeWatches.size).to.equal(0);
    expect(b.releases).to.equal(1); expect(h.releases).to.equal(1);
    expect(a.target('target')).to.deep.equal({ status: 'absent' });
  });

  it('admits exactly 2000 distinct watched IDs without counting duplicate owners twice', () => {
    const { h, facade, a, b } = setup();
    const releases = Array.from({ length: 2000 }, (_, index) => a.watchTarget(String(index)));
    const duplicate = a.watchTarget('0');
    expect(() => a.watchTarget('excess')).to.throw();
    facade.bindState(h.state); facade.promote(b.backing);
    expect(b.activeWatches.size).to.equal(2000); duplicate(); releases.forEach(release => release());
    expect(b.activeWatches.size).to.equal(0); expect(b.retired.length).to.equal(2000); facade.close();
  });

  it('contains bounded watch reconciliation and reserves cleanup without releasing persistent state', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state);
    let nextId = 0, depth = 0, maximumDepth = 0;
    let releaseCurrent = a.watchTarget('0');
    b.hooks.watch = () => {
      depth++; maximumDepth = Math.max(maximumDepth, depth);
      try {
        if (nextId >= 7000) return;
        const previous = releaseCurrent;
        releaseCurrent = a.watchTarget(String(++nextId));
        previous();
      } finally { depth--; }
    };
    expect(facade.promote(b.backing)).to.equal(false);
    expect(nextId).to.be.greaterThan(1);
    expect(maximumDepth).to.equal(1);
    expect(b.acquired.length + b.retired.length + b.subscriptions + b.releases).to.be.at.most(8192);
    expect(b.activeWatches.size).to.equal(0); expect(h.releases).to.equal(0);
    expect(a.target('target').status).to.equal('accepted');
    b.hooks.watch = undefined;
    expect(facade.promote(b.backing)).to.equal(true);
    expect([...b.activeWatches.keys()]).to.deep.equal([String(nextId)]);
    releaseCurrent(); facade.close();
  });

  it('bounds reentrant state dispatch while preserving authoritative reads and pending listener baselines', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    let callbacks = 0, keepChanging = true, depth = 0, maximumDepth = 0;
    const observed: number[] = [];
    a.subscribeTargets(() => {
      depth++; maximumDepth = Math.max(maximumDepth, depth);
      try {
        callbacks++;
        if (keepChanging && callbacks < 7000) h.set([sceneTarget('target', callbacks % 170, callbacks + 2)]);
      } finally { depth--; }
    });
    a.subscribeTargets(() => {
      const value = a.target('target');
      if (value.status === 'accepted') observed.push(value.target.acceptedPositionRevision);
    });
    h.set([sceneTarget('target', 1, 2)]);
    expect(callbacks).to.be.greaterThan(1); expect(callbacks).to.be.at.most(6144);
    expect(maximumDepth).to.equal(1);
    const expected = h.snapshot.targets[0]!;
    if (expected.kind !== 'marker' && expected.kind !== 'model') throw new Error('Expected eligible target');
    const latest = a.target('target');
    expect(latest.status === 'accepted' && latest.target === expected).to.equal(true);
    expect(h.releases).to.equal(0); expect(b.releases).to.equal(1);
    keepChanging = false; facade.bindState(h.state);
    expect(observed.at(-1)).to.equal(expected.acceptedPositionRevision); facade.close();
  });
});

describe('map scene completed receipt authority', () => {
  it('accepts exact delivered receipts and refuses copied, unknown, old and closed receipts', () => {
    const { h, fact, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    const frame = b.frame(1); expect(a.current(frame, fact)).to.equal(false); b.emit(frame);
    expect(a.current(frame, fact)).to.equal(true);
    expect(b.currentArguments.at(-1)?.frame === frame).to.equal(true);
    expect(b.currentArguments.at(-1)?.target === fact).to.equal(true);
    expect(a.projectTarget(frame, 'target')?.visible).to.equal(true);
    expect(b.projectArguments.at(-1)?.frame === frame).to.equal(true);
    expect(b.projectArguments.at(-1)?.id).to.equal('target');
    const currentCalls = b.currentCalls, projectCalls = b.projects;
    expect(a.current(Object.freeze({ ...frame }), fact)).to.equal(false);
    expect(a.current(frame, Object.freeze({ ...fact }))).to.equal(false);
    expect(a.projectTarget(b.frame(2), 'target')).to.equal(undefined);
    expect(b.currentCalls).to.equal(currentCalls); expect(b.projects).to.equal(projectCalls);
    const replacement = sceneBackingHarness(h); facade.promote(replacement.backing);
    expect(a.current(frame, fact)).to.equal(false); facade.close();
    expect(a.current(frame, fact)).to.equal(false); expect(a.projectTarget(frame, 'target')).to.equal(undefined);
  });

  it('preserves original frame identity and issue order without invalidating a current no-op receipt', () => {
    const { h, fact, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    const delivered: SceneCompletedFrame[] = []; a.subscribeCompletedFrames(frame => delivered.push(frame));
    const first = b.frame(2), next = b.frame(3);
    b.emit(first); b.emit(b.frame(1)); b.emit(first); b.emit(next);
    expect(delivered.map(frame => frame.stamp.paintFrameSerial)).to.deep.equal([2, 3]);
    expect(delivered[0] === first).to.equal(true); expect(a.current(first, fact)).to.equal(true);
    b.setCurrent(false); expect(a.current(next, fact)).to.equal(false); facade.close();
  });

  it('keeps issue serials monotonic across backing promotion and rejects old receipt replay', () => {
    const { h, fact, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    const delivered: number[] = []; a.subscribeCompletedFrames(frame => delivered.push(frame.stamp.paintFrameSerial));
    const first = b.frame(2); b.emit(first);
    const replacement = sceneBackingHarness(h); facade.promote(replacement.backing);
    replacement.emit(first); const repeated = replacement.frame(2); replacement.emit(repeated);
    expect(a.current(first, fact)).to.equal(false); expect(a.current(repeated, fact)).to.equal(false);
    const fresh = replacement.frame(3); replacement.emit(fresh);
    expect(delivered).to.deep.equal([2, 3]); expect(a.current(fresh, fact)).to.equal(true); facade.close();
  });

  it('keeps the sole synchronous installation frame until watch and state authority are ready', () => {
    for (const boundary of ['subscribe', 'watch'] as const) {
      const { h, facade, a, b } = setup(); facade.bindState(h.state); a.watchTarget('target');
      const delivered: number[] = []; a.subscribeCompletedFrames(frame => delivered.push(frame.stamp.paintFrameSerial));
      b.hooks[boundary] = () => b.emit(b.frame(1));
      facade.promote(b.backing); expect(delivered).to.deep.equal([1]); facade.close();
    }
  });

  it('invalidates old accepted visuals on metadata-only acceptance without target or viewport resets', () => {
    const { h, fact, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    const old = b.frame(1); b.emit(old); let targetNotices = 0, viewportNotices = 0;
    a.subscribeTargets(() => targetNotices++); a.subscribeViewport(() => viewportNotices++);
    h.set([fact], { registryRevision: h.snapshot.registryRevision });
    expect(a.current(old, fact)).to.equal(false);
    const pending = b.frame(2, {}, { installedSceneRevision: 1 }); b.emit(pending);
    expect(a.current(pending, fact)).to.equal(false);
    const ready = b.frame(3); b.emit(ready); expect(a.current(ready, fact)).to.equal(true);
    expect(targetNotices).to.equal(0); expect(viewportNotices).to.equal(0); facade.close();
  });

  it('requires exact current allocation and does not reuse historical viewport authority', () => {
    const { h, fact, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    let notices = 0; a.subscribeViewport(() => notices++);
    for (const change of [{ width: 800 }, { height: 600 }, { pixelRatio: 2 },
      { padding: Object.freeze({ top: 1, bottom: 0, left: 0, right: 0 }) }]) {
      const frame = b.frame(1, { ...change, cameraProfile: undefined }); b.emit(frame); expect(a.current(frame, fact)).to.equal(false);
    }
    h.viewport(undefined); const missing = b.frame(2); b.emit(missing); expect(a.current(missing, fact)).to.equal(false);
    h.viewport(sceneViewport()); expect(notices).to.equal(0);
    h.viewport(sceneViewport(2, 800)); expect(notices).to.equal(1);
    const ready = b.frame(3); b.emit(ready); expect(a.current(ready, fact)).to.equal(true); facade.close();
  });

  it('never treats camera, sampling, paint or projection readiness as an allocation reset', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    let allocations = 0; a.subscribeViewport(() => allocations++);
    b.emit(b.frame(1)); b.emit(b.frame(2, {}, { samplingViewRevision: 2, paintRevision: 2, placementRevision: 2 }));
    expect(allocations).to.equal(0); facade.close();
  });

  it('keeps native control transition separate from the rounded rendering helper', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    const base = b.frame(1); if (!base.cameraProfile) throw new Error('Expected profile');
    const frames: SceneCompletedFrame[] = []; a.subscribeCompletedFrames(frame => frames.push(frame));
    const tiny = b.frame(1, { cameraProfile: Object.freeze({ ...base.cameraProfile, nativeControlTransition: Number.MIN_VALUE }) });
    b.emit(tiny); b.emit(b.frame(2, { cameraProfile: undefined }));
    expect(frames.length).to.equal(2); expect(frames[0]!.projectionTransition).to.equal(0);
    expect(frames[0]!.cameraProfile!.nativeControlTransition).to.equal(Number.MIN_VALUE);
    expect(frames[1]!.cameraProfile).to.equal(undefined); facade.close();
  });

  it('refuses mismatched or nonfinite camera facts without substituting shader zero', () => {
    const { h, fact, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    const base = b.frame(1); if (!base.cameraProfile) throw new Error('Expected profile');
    for (const change of [{ width: 641 }, { height: 481 }, { nativeControlTransition: NaN },
      { padding: Object.freeze({ top: 1, bottom: 0, left: 0, right: 0 }) }]) {
      const frame = b.frame(1, { cameraProfile: Object.freeze({ ...base.cameraProfile, ...change }) });
      b.emit(frame); expect(a.current(frame, fact)).to.equal(false);
    }
    const valid = b.frame(1); b.emit(valid); expect(a.current(valid, fact)).to.equal(true); facade.close();
  });

  it('copies projection data and preserves pending/nonvisible outcomes without fabricating points', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    const frame = b.frame(1); b.emit(frame);
    const point: [number, number] = [10, 20];
    b.setProjection({ acceptedPositionRevision: 1, status: 'resolved', visible: true, point });
    const result = a.projectTarget(frame, 'target'); point[0] = 99;
    expect(result?.point).to.deep.equal([10, 20]); expect(Object.isFrozen(result) && Object.isFrozen(result?.point)).to.equal(true);
    const statuses: SceneTargetProjection['status'][] = ['terrain-pending', 'terrain-unavailable', 'model-pending',
      'visibility-pending', 'clipped', 'occluded', 'unavailable'];
    for (const status of statuses) {
      b.setProjection({ acceptedPositionRevision: 1, status, visible: false });
      const pending = a.projectTarget(frame, 'target'); expect(pending?.status).to.equal(status);
      expect(pending?.visible).to.equal(false); expect(pending?.point).to.equal(undefined);
    }
    b.setProjection({ acceptedPositionRevision: 2, status: 'resolved', visible: true, point: [1, 2] });
    expect(a.projectTarget(frame, 'target')).to.equal(undefined);
    b.setProjection({ acceptedPositionRevision: 1, status: 'resolved', visible: true, point: [NaN, 2] });
    expect(a.projectTarget(frame, 'target')).to.equal(undefined);
    b.setProjection({ acceptedPositionRevision: 1, status: 'resolved', visible: true });
    expect(a.projectTarget(frame, 'target')).to.equal(undefined);
    b.setProjection({ acceptedPositionRevision: 1, status: 'model-pending', visible: true, point: [1, 2] });
    expect(a.projectTarget(frame, 'target')).to.equal(undefined); facade.close();
  });

  it('rechecks authority after callback-capable projection and currency returns', () => {
    for (const boundary of ['project', 'current'] as const) {
      const { h, fact, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
      const frame = b.frame(1); b.emit(frame);
      b.hooks[boundary] = () => { b.hooks[boundary] = undefined; h.set([sceneTarget('target', 4, 2)]); };
      if (boundary === 'project') expect(a.projectTarget(frame, 'target')).to.equal(undefined);
      else expect(a.current(frame, fact)).to.equal(false);
      facade.close();
    }
  });

  it('ignores old backing callbacks and stops obsolete frame listeners after reentry', () => {
    const { h, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    const replacement = sceneBackingHarness(h); const delivered: number[] = [];
    a.subscribeCompletedFrames(() => { facade.promote(replacement.backing); });
    a.subscribeCompletedFrames(frame => delivered.push(frame.stamp.paintFrameSerial));
    b.emit(b.frame(1)); b.listenerHistory[0]!(b.frame(2));
    expect(delivered).to.deep.equal([]); facade.close();
  });

  it('bounds self-triggering frame notifications without retiring accepted state', () => {
    const { h, fact, facade, a, b } = setup(); facade.bindState(h.state); facade.promote(b.backing);
    let callbacks = 0, depth = 0, maximumDepth = 0;
    let last = b.frame(1);
    const stop = a.subscribeCompletedFrames(frame => {
      depth++; maximumDepth = Math.max(maximumDepth, depth);
      try {
        callbacks++; last = frame;
        if (callbacks < 7000) b.emit(b.frame(frame.stamp.paintFrameSerial + 1));
      } finally { depth--; }
    });
    b.emit(last);
    expect(callbacks).to.be.greaterThan(1); expect(callbacks).to.be.at.most(6144);
    expect(maximumDepth).to.equal(1);
    expect(b.releases).to.equal(1); expect(h.releases).to.equal(0);
    expect(a.current(last, fact)).to.equal(false); expect(a.target('target').status).to.equal('accepted');
    stop(); facade.close();
  });
});
