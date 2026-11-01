import { expect } from '@open-wc/testing';
import type { SceneTargetEntry, SceneTargetFact, SceneTargetSnapshot } from '../../../internal/map-scene-contract.js';
import { stageMapSceneAdmission } from './map-scene-admission.js';
import { createMapScenePositionRegistry } from './map-scene-position-registry.js';
import { sceneArc, sceneMarker, sceneModel, scenePath, sceneSourceHarness } from '../../../../test/map-scene-admission-fixtures.js';

function setup() {
  const h = sceneSourceHarness();
  const registry = createMapScenePositionRegistry({ connection: h.connection, sources: h.sources, isCurrent: h.isCurrent });
  const stage = (objects: readonly unknown[]) => stageMapSceneAdmission({ objects }, {
    request: h.next(), sources: h.sources,
  });
  return { h, registry, stage, close() { registry.dispose(); h.sources.dispose(); } };
}

function target(registry: ReturnType<typeof createMapScenePositionRegistry>, id: string) {
  const lookup = registry.target(id);
  if (lookup.status !== 'accepted') throw new Error('Expected accepted target');
  return lookup.target;
}

function assertEligible(entry: SceneTargetEntry | undefined): asserts entry is SceneTargetFact {
  if (!entry || (entry.kind !== 'marker' && entry.kind !== 'model')) throw new Error('Expected eligible target');
}

describe('map scene registry atomic capture', () => {
  it('returns the same immutable empty snapshot without invoking callbacks or source work', () => {
    const { registry, h, close } = setup();
    try {
      let callbacks = 0;
      h.hooks.current = () => { callbacks++; };
      h.hooks.release = () => { callbacks++; };
      registry.subscribe(() => { callbacks++; });
      const snapshot: SceneTargetSnapshot = registry.capture();
      expect(snapshot).to.deep.equal({ acceptedSceneRevision: 0, registryRevision: 0, targets: [] });
      expect(Object.isFrozen(snapshot)).to.equal(true);
      expect(Object.isFrozen(snapshot.targets)).to.equal(true);
      for (let index = 0; index < 8; index++) expect(registry.capture()).to.equal(snapshot);
      expect(callbacks).to.equal(0);
      expect(h.allocations).to.equal(0);
      expect(h.resolutions).to.equal(0);
      expect(h.releases).to.equal(0);
    } finally { close(); }
  });

  it('captures the complete inventory with exact current eligible facts and identified unsupported kinds', () => {
    const { registry, stage, h, close } = setup();
    try {
      registry.commit(stage([sceneMarker('pin'), sceneModel('asset'), scenePath('route'), sceneArc('flight')]));
      let callbacks = 0;
      h.hooks.current = () => { callbacks++; };
      registry.subscribe(() => { callbacks++; });
      const snapshot: SceneTargetSnapshot = registry.capture();
      expect(snapshot.acceptedSceneRevision).to.equal(registry.acceptedSceneRevision);
      expect(snapshot.registryRevision).to.equal(1);
      expect(snapshot.targets.map(entry => entry.id).sort()).to.deep.equal(['asset', 'flight', 'pin', 'route']);
      const byId = new Map(snapshot.targets.map(entry => [entry.id, entry] as const));
      expect(byId.get('pin')).to.equal(target(registry, 'pin'));
      expect(byId.get('asset')).to.equal(target(registry, 'asset'));
      expect(byId.get('route')).to.deep.equal({ id: 'route', kind: 'path' });
      expect(byId.get('flight')).to.deep.equal({ id: 'flight', kind: 'arc' });
      expect(snapshot.targets.every(entry => Object.isFrozen(entry))).to.equal(true);
      for (const entry of snapshot.targets) {
        if (entry.kind === 'path' || entry.kind === 'arc') continue;
        assertEligible(entry);
        expect(Object.isFrozen(entry.position)).to.equal(true);
        expect(Object.isFrozen(entry.position.lngLat)).to.equal(true);
      }
      expect(registry.capture()).to.equal(snapshot);
      expect(callbacks).to.equal(0);
    } finally { close(); }
  });

  it('advances source-only acceptance metadata before retirement while preserving exact target receipts', () => {
    const { registry, stage, h, close } = setup();
    try {
      registry.commit(stage([sceneMarker('pin', 12), sceneModel('asset')]));
      const before: SceneTargetSnapshot = registry.capture();
      const firstPin = target(registry, 'pin');
      const firstAsset = target(registry, 'asset');
      const retirements: SceneTargetSnapshot[] = [];
      let notices = 0;
      h.hooks.release = () => { retirements.push(registry.capture()); };
      registry.subscribe(() => { notices++; });
      registry.commit(stage([sceneMarker('pin', 372), {
        ...sceneModel('asset', { format: 'glb', bytes: new Uint8Array([9]) }),
        label: 'Replacement asset', metersPerUnit: 2, orientation: [0, 0, 1, 1],
      }]));
      const after: SceneTargetSnapshot = registry.capture();
      expect(after).not.to.equal(before);
      expect(after.acceptedSceneRevision).to.equal(before.acceptedSceneRevision + 1);
      expect(after.registryRevision).to.equal(before.registryRevision);
      expect(after.targets.find(entry => entry.id === 'pin')).to.equal(firstPin);
      expect(after.targets.find(entry => entry.id === 'asset')).to.equal(firstAsset);
      expect(target(registry, 'pin')).to.equal(firstPin);
      expect(target(registry, 'asset')).to.equal(firstAsset);
      expect(retirements.length).to.equal(1);
      expect(retirements[0]).to.equal(after);
      expect(notices).to.equal(0);
      expect(registry.capture()).to.equal(after);
      expect(before.acceptedSceneRevision).to.equal(1);
    } finally { close(); }
  });

  it('keeps prior snapshots and nested position facts immutable through replacement, clear and disposal', () => {
    const { registry, stage, h, close } = setup();
    try {
      const marker = sceneMarker('pin', 10);
      registry.commit(stage([marker]));
      const before: SceneTargetSnapshot = registry.capture();
      const fact = target(registry, 'pin');
      marker.position.lngLat.fill(99);
      marker.label = 'Changed caller data';
      expect(Reflect.set(before, 'acceptedSceneRevision', 999)).to.equal(false);
      expect(Reflect.set(before.targets, '0', { id: 'other', kind: 'path' })).to.equal(false);
      expect(Reflect.set(fact, 'acceptedPositionRevision', 999)).to.equal(false);
      expect(Reflect.set(fact.position, 'altitude', 999)).to.equal(false);
      expect(Reflect.set(fact.position.lngLat, '0', 999)).to.equal(false);
      registry.commit(stage([sceneMarker('pin', 20)]));
      const replacement: SceneTargetSnapshot = registry.capture();
      expect(replacement.targets[0]).not.to.equal(fact);
      registry.clear(h.next());
      registry.dispose();
      expect(before.acceptedSceneRevision).to.equal(1);
      expect(before.registryRevision).to.equal(1);
      expect(before.targets.length).to.equal(1);
      expect(before.targets[0]).to.equal(fact);
      expect(fact.position.lngLat).to.deep.equal([10, 0]);
      expect(fact.position.altitude).to.equal(0);
      const replacedFact = replacement.targets[0];
      assertEligible(replacedFact);
      expect(replacedFact.position.lngLat).to.deep.equal([20, 0]);
      expect(replacement.acceptedSceneRevision).to.equal(2);
    } finally { close(); }
  });

  it('swaps the complete snapshot before source retirement and changed-target notifications', () => {
    const { registry, stage, h, close } = setup();
    try {
      registry.commit(stage([sceneModel('old')]));
      const observations: { phase: 'retire' | 'notice'; snapshot: SceneTargetSnapshot }[] = [];
      h.hooks.release = () => { observations.push({ phase: 'retire', snapshot: registry.capture() }); };
      registry.subscribe(() => { observations.push({ phase: 'notice', snapshot: registry.capture() }); });
      registry.commit(stage([sceneMarker('new', 40), sceneArc('flight')]));
      const after: SceneTargetSnapshot = registry.capture();
      expect(observations.map(entry => entry.phase)).to.deep.equal(['retire', 'notice']);
      expect(observations.every(entry => entry.snapshot === after)).to.equal(true);
      expect(after.acceptedSceneRevision).to.equal(2);
      expect(after.registryRevision).to.equal(2);
      expect(after.targets.map(entry => entry.id).sort()).to.deep.equal(['flight', 'new']);
      expect(after.targets.find(entry => entry.id === 'new')).to.equal(target(registry, 'new'));
      expect(registry.target('old').status).to.equal('absent');
    } finally { close(); }
  });

  it('preserves the newest capture when source retirement reenters a newer accepted replacement', () => {
    const { registry, stage, h, close } = setup();
    try {
      registry.commit(stage([sceneModel('target')]));
      const duringRetirement: SceneTargetSnapshot[] = [];
      const notifications: SceneTargetSnapshot[] = [];
      const nestedResults: boolean[] = [];
      h.hooks.release = () => {
        h.hooks.release = undefined;
        duringRetirement.push(registry.capture());
        nestedResults.push(registry.commit(stage([sceneMarker('target', 9)])));
        duringRetirement.push(registry.capture());
      };
      registry.subscribe(() => { notifications.push(registry.capture()); });
      expect(registry.commit(stage([sceneMarker('target', 3)]))).to.equal(true);
      const latest: SceneTargetSnapshot = registry.capture();
      expect(nestedResults).to.deep.equal([true]);
      expect(duringRetirement.length).to.equal(2);
      expect(duringRetirement[0]!.acceptedSceneRevision).to.equal(2);
      expect(duringRetirement[1]).to.equal(latest);
      expect(latest.acceptedSceneRevision).to.equal(3);
      expect(latest.registryRevision).to.equal(3);
      expect(latest.targets[0]).to.equal(target(registry, 'target'));
      expect(target(registry, 'target').position.lngLat).to.deep.equal([9, 0]);
      expect(notifications.length).to.equal(1);
      expect(notifications[0]).to.equal(latest);
      const earlierFact = duringRetirement[0]!.targets[0];
      assertEligible(earlierFact);
      expect(earlierFact.position.lngLat).to.deep.equal([3, 0]);
    } finally { close(); }
  });

  it('publishes an immutable empty clear snapshot before retiring sources or notifying observers', () => {
    const { registry, stage, h, close } = setup();
    try {
      registry.commit(stage([sceneModel('asset'), scenePath('route')]));
      const before: SceneTargetSnapshot = registry.capture();
      const observations: SceneTargetSnapshot[] = [];
      h.hooks.release = () => { observations.push(registry.capture()); };
      registry.subscribe(() => { observations.push(registry.capture()); });
      expect(registry.clear(h.next())).to.equal(true);
      const empty: SceneTargetSnapshot = registry.capture();
      expect(empty).not.to.equal(before);
      expect(empty.targets).to.deep.equal([]);
      expect(empty.acceptedSceneRevision).to.equal(before.acceptedSceneRevision + 1);
      expect(empty.registryRevision).to.equal(before.registryRevision + 1);
      expect(Object.isFrozen(empty) && Object.isFrozen(empty.targets)).to.equal(true);
      expect(observations.length).to.equal(2);
      expect(observations.every(snapshot => snapshot === empty)).to.equal(true);
      expect(before.targets.length).to.equal(2);
      expect(registry.capture()).to.equal(empty);
    } finally { close(); }
  });

  it('exposes a stable empty disposed snapshot before retirement with no capture-driven notifications', () => {
    const { registry, stage, h, close } = setup();
    try {
      registry.commit(stage([sceneModel('asset')]));
      const before: SceneTargetSnapshot = registry.capture();
      const retirements: SceneTargetSnapshot[] = [];
      let notices = 0;
      h.hooks.release = () => { retirements.push(registry.capture()); };
      registry.subscribe(() => { notices++; });
      registry.dispose();
      const empty: SceneTargetSnapshot = registry.capture();
      expect(empty).not.to.equal(before);
      expect(empty.targets).to.deep.equal([]);
      expect(Object.isFrozen(empty) && Object.isFrozen(empty.targets)).to.equal(true);
      expect(retirements.length).to.equal(1);
      expect(retirements[0]).to.equal(empty);
      registry.dispose();
      expect(registry.capture()).to.equal(empty);
      expect(notices).to.equal(0);
      expect(h.liveBytes).to.equal(0);
      expect(before.targets.length).to.equal(1);
    } finally { close(); }
  });

  it('does not replace capture identity for rejected candidates or stale clear requests', () => {
    const { registry, stage, h, close } = setup();
    try {
      registry.commit(stage([sceneMarker('target', 5)]));
      const before: SceneTargetSnapshot = registry.capture();
      const rejected = stage([sceneModel('pending')]);
      const stale = h.request();
      h.next();
      const retirements: SceneTargetSnapshot[] = [];
      let notices = 0;
      h.hooks.release = () => { retirements.push(registry.capture()); };
      registry.subscribe(() => { notices++; });
      expect(registry.commit(rejected)).to.equal(false);
      expect(registry.clear(stale)).to.equal(false);
      expect(() => stage([{ ...sceneMarker('invalid'), opacity: NaN }])).to.throw();
      expect(registry.capture()).to.equal(before);
      expect(retirements.length).to.equal(1);
      expect(retirements[0]).to.equal(before);
      expect(notices).to.equal(0);
      expect(h.liveBytes).to.equal(0);
    } finally { close(); }
  });
});
