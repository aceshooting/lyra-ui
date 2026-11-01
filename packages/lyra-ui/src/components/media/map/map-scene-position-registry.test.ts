import { expect } from '@open-wc/testing';
import { stageMapSceneAdmission } from './map-scene-admission.js';
import { createMapScenePositionRegistry } from './map-scene-position-registry.js';
import { sceneArc, sceneMarker, sceneModel, scenePath, sceneSourceHarness } from '../../../../test/map-scene-admission-fixtures.js';

function setup() {
  const h = sceneSourceHarness();
  const registry = createMapScenePositionRegistry({ connection: h.connection, sources: h.sources, isCurrent: h.isCurrent });
  const stage = (objects: readonly unknown[], advance = true) => stageMapSceneAdmission({ objects }, {
    request: advance ? h.next() : h.request(), sources: h.sources,
  });
  return { h, registry, stage, close() { registry.dispose(); h.sources.dispose(); } };
}
function target(registry: ReturnType<typeof createMapScenePositionRegistry>, id = 'target') {
  const lookup = registry.target(id);
  if (lookup.status !== 'accepted') throw new Error('Expected accepted target');
  return lookup.target;
}

describe('map scene accepted position registry', () => {
  it('distinguishes accepted marker/model, unsupported path/arc and absent IDs', () => {
    const { registry, stage, close } = setup();
    expect(registry.acceptedSceneRevision).to.equal(0);
    expect(registry.target('target')).to.deep.equal({ status: 'absent' });
    expect(registry.commit(stage([sceneMarker(), sceneModel(), scenePath(), sceneArc()]))).to.equal(true);
    expect(target(registry).kind).to.equal('marker'); expect(target(registry, 'model').kind).to.equal('model');
    expect(registry.target('route')).to.deep.equal({ status: 'unsupported-kind', kind: 'path' });
    expect(registry.target('arc')).to.deep.equal({ status: 'unsupported-kind', kind: 'arc' });
    expect(registry.target('other')).to.deep.equal({ status: 'absent' }); close();
  });

  it('publishes no facts or notices before committing the whole staged revision', () => {
    const { registry, stage, h, close } = setup();
    const notices: number[] = [];
    registry.subscribe(notice => notices.push(notice.acceptedSceneRevision));
    const candidate = stage([sceneMarker(), sceneModel()]);
    expect(registry.target('target').status).to.equal('absent'); expect(notices).to.deep.equal([]);
    h.next();
    expect(registry.commit(candidate)).to.equal(false);
    expect(registry.acceptedSceneRevision).to.equal(0); expect(notices).to.deep.equal([]);
    expect(h.liveBytes).to.equal(0); close();
  });

  it('changes target revision only for canonical authored position/reference/kind changes', () => {
    const { registry, stage, close } = setup();
    const seen: string[][] = [];
    registry.subscribe(notice => seen.push([...notice.changedIds]));
    registry.commit(stage([sceneMarker('target', 10)]));
    const initial = target(registry).acceptedPositionRevision;
    registry.commit(stage([{ ...sceneMarker('target', 370), label: 'Renamed', opacity: 0.5,
      position: { lngLat: [370, 0], altitude: 0, altitudeReference: 'sea-level' } }]));
    expect(target(registry).acceptedPositionRevision).to.equal(initial);
    expect(registry.acceptedSceneRevision).to.equal(2); expect(seen).to.deep.equal([['target']]);
    registry.commit(stage([{ ...sceneMarker('target', 10), position: { lngLat: [10, 0], altitude: 1 } }]));
    const elevated = target(registry).acceptedPositionRevision;
    expect(elevated).to.be.greaterThan(initial);
    registry.commit(stage([{ ...sceneMarker('target', 10), position: { lngLat: [10, 0], altitude: 1, altitudeReference: 'terrain' } }]));
    expect(target(registry).acceptedPositionRevision).to.be.greaterThan(elevated);
    expect(seen).to.deep.equal([['target'], ['target'], ['target']]); close();
  });

  it('retains source identity without making source, scale or orientation a target-position update', () => {
    const { registry, stage, h, close } = setup();
    const source = { format: 'glb' as const, bytes: new Uint8Array([1, 2, 3]) };
    registry.commit(stage([sceneModel('target', source)]));
    const revision = target(registry).acceptedPositionRevision;
    let notices = 0; registry.subscribe(() => notices++);
    registry.commit(stage([{ ...sceneModel('target', source), metersPerUnit: 2, orientation: [0, 0, 1, 1] }]));
    expect(h.allocations).to.equal(1); expect(notices).to.equal(0);
    registry.commit(stage([sceneModel('target', { format: 'glb', bytes: new Uint8Array([9]) })]));
    expect(target(registry).acceptedPositionRevision).to.equal(revision);
    expect(h.allocations).to.equal(2); expect(notices).to.equal(0); close(); expect(h.liveBytes).to.equal(0);
  });

  it('reports only changed IDs and gives removal/reappearance and kind changes fresh revisions', () => {
    const { registry, stage, close } = setup();
    registry.commit(stage([sceneMarker('target'), sceneMarker('other')]));
    const first = target(registry).acceptedPositionRevision;
    const changes: string[][] = []; registry.subscribe(notice => changes.push([...notice.changedIds]));
    registry.commit(stage([sceneMarker('target'), sceneMarker('other', 1)]));
    expect(changes).to.deep.equal([['other']]); expect(target(registry).acceptedPositionRevision).to.equal(first);
    registry.commit(stage([sceneMarker('other', 1)]));
    expect(registry.target('target').status).to.equal('absent');
    registry.commit(stage([sceneMarker('target'), sceneMarker('other', 1)]));
    const reappeared = target(registry).acceptedPositionRevision; expect(reappeared).to.be.greaterThan(first);
    registry.commit(stage([sceneModel('target'), sceneMarker('other', 1)]));
    expect(target(registry).acceptedPositionRevision).to.be.greaterThan(reappeared);
    registry.commit(stage([scenePath('target'), sceneMarker('other', 1)]));
    expect(registry.target('target')).to.deep.equal({ status: 'unsupported-kind', kind: 'path' });
    expect(changes.slice(1)).to.deep.equal([['target'], ['target'], ['target'], ['target']]); close();
  });

  it('preserves prior accepted facts and ownership when the next scene is invalid', () => {
    const { registry, stage, h, close } = setup();
    registry.commit(stage([sceneMarker(), sceneModel()]));
    const before = target(registry); const accepted = registry.acceptedSceneRevision;
    let notices = 0; registry.subscribe(() => notices++);
    expect(() => stage([sceneModel('new'), { ...sceneMarker('invalid'), opacity: Infinity }])).to.throw();
    expect(registry.acceptedSceneRevision).to.equal(accepted);
    expect(target(registry)).to.deep.equal(before); expect(notices).to.equal(0);
    expect(h.allocations).to.equal(1); expect(h.liveBytes).to.equal(3); close();
  });

  it('accepts URL intent with no body allocation or parser completion', () => {
    const { registry, stage, h, close } = setup();
    registry.commit(stage([{ ...sceneModel('target'), source: { format: 'glb', src: 'model.glb' } }]));
    expect(target(registry).position).to.deep.equal({ lngLat: [0, 0], altitude: 0, altitudeReference: 'sea-level' });
    expect(h.resolutions).to.equal(1); expect(h.allocations).to.equal(0); close();
  });

  it('clears reuse authority immediately while an installed owner delays byte retirement', () => {
    const { registry, stage, h, close } = setup();
    const source = { format: 'glb' as const, bytes: new Uint8Array([1, 2]) };
    const first = stage([sceneModel('target', source)]); registry.commit(first);
    const installed = h.sources.retain(first.sourceStage.receipts[0]!, 'installed');
    const previousPositionRevision = target(registry).acceptedPositionRevision;
    expect(registry.clear(h.next())).to.equal(true);
    expect(registry.target('target').status).to.equal('absent'); expect(h.liveBytes).to.equal(2);
    const next = stage([sceneModel('target', source)]); registry.commit(next);
    expect(h.allocations).to.equal(2); expect(h.liveBytes).to.equal(4);
    expect(target(registry).acceptedPositionRevision).to.be.greaterThan(previousPositionRevision);
    close(); expect(h.liveBytes).to.equal(2);
    installed.release(); expect(h.liveBytes).to.equal(0);
  });

  it('rejects fabricated, foreign and consumed candidates', () => {
    const own = setup(); const other = setup();
    expect(() => own.registry.commit({} as never)).to.throw();
    const foreign = other.stage([sceneMarker()]);
    expect(() => own.registry.commit(foreign)).to.throw();
    expect(other.registry.commit(foreign)).to.equal(true);
    expect(() => other.registry.commit(foreign)).to.throw();
    own.close(); other.close();
  });

  it('rejects a fresh candidate for an already committed request revision', () => {
    const { registry, stage, close } = setup();
    const first = stage([sceneMarker('target', 1)], false);
    expect(registry.commit(first)).to.equal(true);
    const repeated = stage([sceneMarker('target', 2)], false);
    expect(registry.commit(repeated)).to.equal(false);
    expect(registry.acceptedSceneRevision).to.equal(1);
    expect(target(registry).position.lngLat).to.deep.equal([1, 0]); close();
  });

  it('leaves facts and source reuse unchanged when clear belongs to a stale request', () => {
    const { registry, stage, h, close } = setup();
    const source = { format: 'glb' as const, bytes: new Uint8Array([1]) };
    registry.commit(stage([sceneModel('target', source)]));
    const stale = h.request(); h.next();
    expect(registry.clear(stale)).to.equal(false);
    expect(registry.target('target').status).to.equal('accepted');
    registry.commit(stage([sceneModel('target', source)]));
    expect(h.allocations).to.equal(1); close();
  });

  it('does not publish path geometry as a target move but does publish kind/removal changes', () => {
    const { registry, stage, close } = setup();
    registry.commit(stage([scenePath('target')]));
    const changes: string[][] = []; registry.subscribe(notice => { changes.push([...notice.changedIds]); });
    registry.commit(stage([{ ...scenePath('target'), positions: [{ lngLat: [20, 0] }, { lngLat: [30, 0] }] }]));
    expect(changes).to.deep.equal([]);
    registry.commit(stage([sceneArc('target')]));
    expect(changes).to.deep.equal([['target']]);
    registry.commit(stage([])); expect(changes).to.deep.equal([['target'], ['target']]); close();
  });

  it('suppresses obsolete notice delivery after a listener commits a newer scene', () => {
    const { registry, stage, close } = setup();
    const delivered: number[] = [];
    registry.subscribe(notice => {
      if (notice.acceptedSceneRevision === 1) registry.commit(stage([sceneMarker('target', 2)]));
    });
    registry.subscribe(notice => delivered.push(notice.acceptedSceneRevision));
    registry.commit(stage([sceneMarker('target', 1)]));
    expect(delivered).to.deep.equal([2]); expect(target(registry).position.lngLat).to.deep.equal([2, 0]); close();
  });

  it('rejects an older delivery when the currency callback reenters a newer commit', () => {
    const { registry, stage, h, close } = setup();
    const old = stage([sceneMarker('target', 1)]);
    h.hooks.current = () => {
      h.hooks.current = undefined;
      registry.commit(stage([sceneMarker('target', 9)]));
    };
    expect(registry.commit(old)).to.equal(false);
    expect(target(registry).position.lngLat).to.deep.equal([9, 0]);
    expect(registry.acceptedSceneRevision).to.equal(1); close();
  });

  it('makes cleanup and listener reentry unable to roll back the latest commit', () => {
    const { registry, stage, h, close } = setup();
    registry.commit(stage([sceneModel('target')]));
    let reentered = false;
    h.hooks.release = () => {
      if (reentered) return;
      reentered = true; registry.commit(stage([sceneMarker('target', 7)]));
    };
    registry.commit(stage([sceneMarker('target', 3)]));
    expect(target(registry).position.lngLat).to.deep.equal([7, 0]);
    expect(registry.acceptedSceneRevision).to.equal(3); expect(h.liveBytes).to.equal(0); close();
  });

  it('continues independent listeners after one throws and stops stale delivery after disposal', () => {
    const first = setup(); let delivered = 0;
    first.registry.subscribe(() => { throw new Error('Listener failed'); });
    first.registry.subscribe(() => delivered++);
    expect(() => first.registry.commit(first.stage([sceneMarker()]))).not.to.throw();
    expect(delivered).to.equal(1); first.close();
    const second = setup(); let stale = 0;
    second.registry.subscribe(() => second.registry.dispose());
    second.registry.subscribe(() => stale++);
    second.registry.commit(second.stage([sceneModel('target')]));
    expect(stale).to.equal(0); expect(second.registry.target('target').status).to.equal('absent');
    expect(second.h.liveBytes).to.equal(0); second.close();
  });

  it('makes subscriptions and disposal idempotent without retaining accepted bytes', () => {
    const { registry, stage, h, close } = setup(); let delivered = 0;
    const unsubscribe = registry.subscribe(() => delivered++);
    unsubscribe(); unsubscribe();
    registry.commit(stage([sceneModel('target')])); expect(delivered).to.equal(0);
    close(); close(); expect(h.liveBytes).to.equal(0); expect(h.releases).to.equal(1);
    expect(registry.target('target').status).to.equal('absent');
  });
});
