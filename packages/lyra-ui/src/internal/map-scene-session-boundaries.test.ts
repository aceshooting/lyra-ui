import { expect } from '@open-wc/testing';
import { createMapSceneSessionFacade } from './map-scene-session.js';
import type { MapSceneSessionState, SceneTargetEntry, SceneTargetFact } from './map-scene-contract.js';
import { sceneBackingHarness, sceneStateHarness, sceneTarget, sceneViewport } from '../../test/map-scene-session-fixtures.js';

type InvalidTarget = readonly [string, (fact: SceneTargetFact) => unknown];
const invalidTargets: readonly InvalidTarget[] = [
  ['mutable target', fact => ({ ...fact })],
  ['unknown field', fact => Object.freeze({ ...fact, extra: true })],
  ['symbol field', fact => Object.freeze({ ...fact, [Symbol('extra')]: true })],
  ['empty identity', fact => Object.freeze({ ...fact, id: '' })],
  ['blank identity', fact => Object.freeze({ ...fact, id: ' \t ' })],
  ['oversized identity', fact => Object.freeze({ ...fact, id: 'x'.repeat(1025) })],
  ['non-string identity', fact => Object.freeze({ ...fact, id: 7 })],
  ['unknown kind', fact => Object.freeze({ ...fact, kind: 'point' })],
  ['position on a path', fact => Object.freeze({ ...fact, kind: 'path' })],
  ['mutable position', fact => Object.freeze({ ...fact, position: { ...fact.position } })],
  ['mutable coordinates', fact => Object.freeze({ ...fact, position: Object.freeze({ ...fact.position, lngLat: [0, 0] }) })],
  ['incomplete coordinates', fact => Object.freeze({ ...fact, position: Object.freeze({ ...fact.position, lngLat: Object.freeze([0]) }) })],
  ['unnormalized antimeridian', fact => sceneTarget(fact.id, 180, 2)],
  ['out-of-range latitude', fact => Object.freeze({ ...fact, position: Object.freeze({ ...fact.position, lngLat: Object.freeze([0, 90]) }) })],
  ['nonfinite altitude', fact => Object.freeze({ ...fact, position: Object.freeze({ ...fact.position, altitude: Infinity }) })],
  ['unknown altitude reference', fact => Object.freeze({ ...fact, position: Object.freeze({ ...fact.position, altitudeReference: 'ground' }) })],
];

describe('map scene session malformed state recovery', () => {
  for (const [name, invalid] of invalidTargets) {
    it(`rejects a ${name} atomically and recovers the previous target identity`, () => {
      const state = sceneStateHarness(), fact = sceneTarget();
      state.set([fact]);
      const facade = createMapSceneSessionFacade({ connection: state.connection });
      const attachment = facade.attachment, backing = sceneBackingHarness(state);
      try {
        expect(facade.bindState(state.state)).to.equal(true);
        expect(facade.promote(backing.backing)).to.equal(true);
        attachment.watchTarget(fact.id);
        expect(backing.activeWatches.get(fact.id)).to.equal(1);
        const frame = backing.frame(1);
        backing.emit(frame);
        expect(attachment.current(frame, fact)).to.equal(true);
        const notices: string[][] = [];
        attachment.subscribeTargets(notice => notices.push([...notice.changedIds]));
        // A valid first row must not become visible when a later row invalidates the capture.
        state.set([sceneTarget('uncommitted', 12, 2), invalid(fact)] as readonly SceneTargetEntry[], { notify: false });
        expect(() => state.emit()).not.to.throw();
        expect(() => attachment.target(fact.id)).to.throw(TypeError);
        expect(() => attachment.target('uncommitted')).to.throw(TypeError);
        expect(attachment.current(frame, fact)).to.equal(false);
        expect(attachment.projectTarget(frame, fact.id)).to.equal(undefined);
        expect(notices).to.deep.equal([]);
        expect(state.releases).to.equal(0);

        state.set([fact], { notify: false });
        expect(facade.bindState(state.state)).to.equal(true);
        const restored = attachment.target(fact.id);
        expect(restored.status === 'accepted' && restored.target === fact).to.equal(true);
        expect(attachment.target('uncommitted').status).to.equal('absent');
        expect(notices).to.deep.equal([]);
        expect(state.subscriptions).to.equal(1);
      } finally { facade.close(); }
      expect(state.releases).to.equal(1);
      expect(backing.activeWatches.size).to.equal(0);
    });
  }

  it('rejects target and coordinate accessors without evaluating application getters', () => {
    const state = sceneStateHarness(), fact = sceneTarget();
    state.set([fact]);
    const facade = createMapSceneSessionFacade({ connection: state.connection });
    let reads = 0;
    const target = Object.freeze({ ...fact, get id() { reads++; return 'target'; } });
    const coordinates = Object.freeze(Object.defineProperty([0, 0] as [number, number], '1', { get() { reads++; return 0; } }));
    const position = Object.freeze({ ...fact, position: Object.freeze({ ...fact.position, lngLat: coordinates }) });
    try {
      expect(facade.bindState(state.state)).to.equal(true);
      for (const invalid of [target, position]) {
        state.set([invalid] as readonly SceneTargetEntry[], { notify: false });
        expect(() => state.emit()).not.to.throw();
        expect(() => facade.attachment.target('target')).to.throw(TypeError);
        expect(reads).to.equal(0);
        state.set([fact], { notify: false });
        expect(facade.bindState(state.state)).to.equal(true);
        expect(facade.attachment.target('target').status).to.equal('accepted');
      }
    } finally { facade.close(); }
  });

  it('rejects duplicate target identities without picking a winner or emitting disappearance', () => {
    const state = sceneStateHarness(), fact = sceneTarget();
    state.set([fact]);
    const facade = createMapSceneSessionFacade({ connection: state.connection });
    try {
      facade.bindState(state.state);
      const notices: string[][] = [];
      facade.attachment.subscribeTargets(notice => notices.push([...notice.changedIds]));
      state.set([fact, sceneTarget('target', 12, 2)]);
      expect(() => facade.attachment.target('target')).to.throw(TypeError);
      state.set([fact], { notify: false });
      expect(facade.bindState(state.state)).to.equal(true);
      expect(notices).to.deep.equal([]);
      const restored = facade.attachment.target('target');
      expect(restored.status === 'accepted' && restored.target === fact).to.equal(true);
    } finally { facade.close(); }
  });

  for (const ratio of [0, -1, Infinity]) {
    it(`withholds an allocation with pixel ratio ${ratio} and recovers without a spurious viewport change`, () => {
      const state = sceneStateHarness(), fact = sceneTarget();
      state.set([fact]);
      const facade = createMapSceneSessionFacade({ connection: state.connection });
      const backing = sceneBackingHarness(state);
      try {
        facade.bindState(state.state);
        facade.promote(backing.backing);
        const original = backing.frame(1);
        backing.emit(original);
        expect(facade.attachment.current(original, fact)).to.equal(true);
        const notices: number[] = [];
        facade.attachment.subscribeViewport(notice => notices.push(notice.allocationRevision));
        state.viewport(Object.freeze({ ...sceneViewport(2), pixelRatio: ratio }));
        expect(() => facade.attachment.target('target')).to.throw(TypeError);
        expect(facade.attachment.current(original, fact)).to.equal(false);
        expect(notices).to.deep.equal([]);
        state.viewport(sceneViewport(3), false);
        expect(facade.bindState(state.state)).to.equal(true);
        expect(facade.attachment.target('target').status).to.equal('accepted');
        expect(notices).to.deep.equal([]);
        expect(facade.promote(backing.backing)).to.equal(true);
        const restored = backing.frame(2);
        backing.emit(restored);
        expect(facade.attachment.current(restored, fact)).to.equal(true);
      } finally { facade.close(); }
    });
  }

  it('refuses malformed state capabilities without invoking getters or subscribing, then accepts a valid binding', () => {
    const state = sceneStateHarness();
    state.set([sceneTarget()]);
    const facade = createMapSceneSessionFacade({ connection: state.connection });
    let reads = 0;
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    const invalid = [null, revoked.proxy, { ...state.state, connection: {} },
      { ...state.state, capture: null }, { ...state.state, subscribe: 1 },
      { ...state.state, get capture() { reads++; return state.state.capture; } }];
    try {
      for (const capability of invalid) {
        expect(facade.bindState(capability as MapSceneSessionState)).to.equal(false);
        expect(state.subscriptions).to.equal(0);
        expect(state.captures).to.equal(0);
      }
      expect(reads).to.equal(0);
      expect(facade.bindState(state.state)).to.equal(true);
      expect(facade.attachment.target('target').status).to.equal('accepted');
      expect(state.subscriptions).to.equal(1);
    } finally { facade.close(); }
    expect(state.releases).to.equal(1);
  });
});
