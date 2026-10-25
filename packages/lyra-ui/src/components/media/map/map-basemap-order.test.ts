import { expect } from '@open-wc/testing';
import { MapBasemapOrder } from './map-basemap-order.js';
import type { LyraMapStyleOverride } from './map-style-override-admission.js';
import type { MapLayerOrderGroup } from './map-layer-order.js';

const unowned = () => false;
const style = (ids: readonly string[]) => ids.map(id => ({ id, source: 'base', type: 'line' }));
function apply(owner: MapBasemapOrder, current: readonly string[], overrides: readonly LyraMapStyleOverride[], groups: readonly MapLayerOrderGroup[] = []) {
  const draft = owner.stage(current, overrides, style(current), unowned);
  const plan = draft.plan(current, groups);
  expect(plan.valid).to.equal(true);
  const replay = [...current];
  for (const operation of plan.operations) {
    const at = replay.indexOf(operation.id);
    if (at >= 0) replay.splice(at, 1);
    const target = operation.before === undefined ? replay.length : replay.indexOf(operation.before);
    expect(target).to.be.at.least(0);
    replay.splice(target, 0, operation.id);
  }
  expect(replay).to.deep.equal(plan.order);
  draft.commit(replay);
  return replay;
}

describe('MapBasemapOrder', () => {
  it('does not claim or move paint-only basemap layers', () => {
    const owner = new MapBasemapOrder();
    expect(apply(owner, ['a', 'b', 'c'], [{ layerId: 'a', paint: { 'line-width': 2 } }])).to.deep.equal(['a', 'b', 'c']);
    expect(owner.active).to.equal(false);
  });

  it('restores several placements in baseline order regardless of input order', () => {
    const owner = new MapBasemapOrder();
    const moved = apply(owner, ['base', 'a', 'b', 'labels'], [{ layerId: 'b', before: null }, { layerId: 'a', before: null }]);
    expect(moved).to.deep.equal(['base', 'labels', 'b', 'a']);
    expect(apply(owner, moved, [])).to.deep.equal(['base', 'a', 'b', 'labels']);
    expect(owner.active).to.equal(false);
  });

  it('restores a released layer against surviving unowned neighbors while another placement stays active', () => {
    const owner = new MapBasemapOrder();
    const moved = apply(owner, ['base', 'a', 'b', 'labels'], [{ layerId: 'a', before: null }, { layerId: 'b', before: null }]);
    expect(moved).to.deep.equal(['base', 'labels', 'a', 'b']);
    expect(apply(owner, moved, [{ layerId: 'b', before: null }])).to.deep.equal(['base', 'a', 'labels', 'b']);
  });

  it('preserves the original baseline across changed placement requests', () => {
    const owner = new MapBasemapOrder();
    let order = apply(owner, ['base', 'a', 'roads', 'labels'], [{ layerId: 'a', before: null }]);
    order = apply(owner, order, [{ layerId: 'a', before: 'roads' }]);
    expect(order).to.deep.equal(['base', 'a', 'roads', 'labels']);
    expect(apply(owner, order, [])).to.deep.equal(['base', 'a', 'roads', 'labels']);
  });

  it('uses surviving original successors without moving newly inserted layers', () => {
    const owner = new MapBasemapOrder();
    apply(owner, ['base', 'a', 'roads', 'labels'], [{ layerId: 'a', before: null }]);
    expect(apply(owner, ['base', 'new', 'labels', 'a'], [])).to.deep.equal(['base', 'new', 'a', 'labels']);
  });

  it('leaves an external relocation alone on release, including after staging', () => {
    const owner = new MapBasemapOrder();
    const order = apply(owner, ['base', 'a', 'roads'], [{ layerId: 'a', before: null }]);
    const draft = owner.stage(order, [], style(order), unowned);
    const external = ['a', 'base', 'roads'];
    const plan = draft.plan(external, []);
    expect(plan.operations.length).to.equal(0);
    expect(plan.order).to.deep.equal(external);
  });

  it('reapplies active intent while capturing external placement as the new baseline', () => {
    const owner = new MapBasemapOrder();
    const input = [{ layerId: 'a', before: null }];
    apply(owner, ['base', 'a', 'roads'], input);
    const reapplied = apply(owner, ['a', 'base', 'roads'], input);
    expect(reapplied).to.deep.equal(['base', 'roads', 'a']);
    expect(apply(owner, reapplied, [])).to.deep.equal(['a', 'base', 'roads']);
  });

  it('does not commit a rejected or abandoned draft or an obsolete style draft', () => {
    const owner = new MapBasemapOrder();
    const draft = owner.stage(['a', 'b'], [{ layerId: 'a', before: null }], style(['a', 'b']), unowned);
    expect(owner.active).to.equal(false);
    owner.reset(); draft.commit(['b', 'a']);
    expect(owner.active).to.equal(false);
    expect(apply(owner, ['b', 'a'], [])).to.deep.equal(['b', 'a']);
  });

  it('forgets observed missing layers before an ID is reused', () => {
    const owner = new MapBasemapOrder();
    apply(owner, ['base', 'a', 'labels'], [{ layerId: 'a', before: null }]);
    apply(owner, ['base', 'labels'], []);
    expect(apply(owner, ['a', 'base', 'labels'], [])).to.deep.equal(['a', 'base', 'labels']);
  });

  it('groups selector matches in stable order and respects explicit whole-entry precedence', () => {
    const owner = new MapBasemapOrder();
    const input = [{ layerId: 'labels' }, { source: 'base', before: 'labels' }];
    let order = apply(owner, ['a', 'b', 'labels'], input);
    expect(order).to.deep.equal(['a', 'b', 'labels']);
    order = apply(owner, order, input);
    expect(order).to.deep.equal(['a', 'b', 'labels']);
    expect(apply(owner, order, [])).to.deep.equal(['a', 'b', 'labels']);
  });

  it('plans cross-owner anchors together and rejects cycles without operations', () => {
    const owner = new MapBasemapOrder();
    const draft = owner.stage(['base', 'borders', 'labels'], [{ layerId: 'borders', before: 'areas' }], style(['base', 'borders', 'labels']), unowned);
    const good = draft.plan(['base', 'borders', 'labels'], [{ id: 'areas', layerIds: ['areas-fill'], before: 'labels' }]);
    expect(good.order).to.deep.equal(['base', 'borders', 'areas-fill', 'labels']);
    const cycle = draft.plan(['base', 'borders', 'labels'], [{ id: 'areas', layerIds: ['areas-fill'], before: 'borders' }]);
    expect(cycle.valid).to.equal(false);
    expect(cycle.operations.length).to.equal(0);
    expect(owner.active).to.equal(false);
  });

  it('rejects generated subjects and self-group anchors', () => {
    const owner = new MapBasemapOrder();
    expect(() => owner.stage(['a'], [{ layerId: 'a', before: null }], style(['a']), () => true)).to.throw();
    const draft = owner.stage(['a', 'b'], [{ source: 'base', before: 'b' }], style(['a', 'b']), unowned);
    expect(draft.plan(['a', 'b'], []).valid).to.equal(false);
  });

  it('skips absent basemap subjects, retries later and drops obsolete placement baselines', () => {
    const owner = new MapBasemapOrder();
    const input = [{ layerId: 'border', before: null }];
    expect(apply(owner, ['base', 'labels'], input)).to.deep.equal(['base', 'labels']);
    expect(owner.active).to.equal(false);
    expect(apply(owner, ['base', 'border', 'labels'], input)).to.deep.equal(['base', 'labels', 'border']);
    expect(apply(owner, ['base', 'labels'], input)).to.deep.equal(['base', 'labels']);
    expect(owner.active).to.equal(false);
    const moved = apply(owner, ['border', 'base', 'labels'], input);
    expect(apply(owner, moved, [])).to.deep.equal(['border', 'base', 'labels']);
  });

  it('rejects an absent subject reserved by an owned group instead of silently skipping it', () => {
    const owner = new MapBasemapOrder();
    expect(() => owner.stage(['base'], [{ layerId: 'owned-future', before: null }], style(['base']),
      id => id === 'owned-future')).to.throw();
  });

  it('appends at a missing anchor and re-resolves it when it appears', () => {
    const owner = new MapBasemapOrder();
    const input = [{ layerId: 'a', before: 'future' }];
    const draft = owner.stage(['a', 'b'], input, style(['a', 'b']), unowned);
    expect(draft.plan(['a', 'b'], []).diagnostics.map(issue => issue.code)).to.deep.equal(['missing-anchor']);
    const order = apply(owner, ['a', 'b'], input);
    expect(apply(owner, [...order, 'future'], input)).to.deep.equal(['b', 'a', 'future']);
  });

  it('retains the original basemap baseline when an owned layer is recreated during reconciliation', () => {
    const owner = new MapBasemapOrder();
    const groups = [{ id: 'owned', layerIds: ['owned'] }];
    const input = [{ layerId: 'borders', before: null }];
    const order = apply(owner, ['base', 'borders', 'owned', 'labels'], input, groups);
    const draft = owner.stage(order, input, style(order), id => id === 'owned');
    // The controller removed and re-added its layer at the top before the final combined plan.
    const recreated = ['base', 'labels', 'borders', 'owned'];
    const final = draft.plan(recreated, groups);
    expect(final.valid).to.equal(true); draft.commit(final.order);
    expect(apply(owner, final.order, [], groups)).to.deep.equal(['base', 'borders', 'labels', 'owned']);
  });

  it('still observes genuine relocation relative to an owned layer before staging', () => {
    const owner = new MapBasemapOrder();
    const groups = [{ id: 'owned', layerIds: ['owned'] }];
    const input = [{ layerId: 'borders', before: null }];
    apply(owner, ['base', 'borders', 'owned', 'labels'], input, groups);
    const external = ['base', 'labels', 'borders', 'owned'];
    const draft = owner.stage(external, input, style(external), id => id === 'owned');
    const final = draft.plan(external, groups); draft.commit(final.order);
    expect(apply(owner, final.order, [], groups)).to.deep.equal(['base', 'labels', 'borders', 'owned']);
  });

  it('observes post-stage external relocation across unowned basemap IDs despite owned-layer recreation', () => {
    const owner = new MapBasemapOrder();
    const groups = [{ id: 'owned', layerIds: ['owned'] }];
    const input = [{ layerId: 'borders', before: null }];
    const order = apply(owner, ['base', 'borders', 'owned', 'labels'], input, groups);
    const draft = owner.stage(order, input, style(order), id => id === 'owned');
    const external = ['borders', 'base', 'labels', 'owned'];
    const final = draft.plan(external, groups); draft.commit(final.order);
    expect(apply(owner, final.order, [], groups)).to.deep.equal(['borders', 'base', 'labels', 'owned']);
  });

  it('admits bounded large selector groups without widening the total layer ceiling', () => {
    const owner = new MapBasemapOrder();
    const ids = Array.from({ length: 1000 }, (_, i) => `base-${i}`);
    const draft = owner.stage(ids, [{ source: 'base', before: null }], style(ids), unowned);
    expect(draft.plan(ids, []).valid).to.equal(true);
    expect(draft.plan([...ids, ...Array.from({ length: 3097 }, (_, i) => `other-${i}`)], []).valid).to.equal(false);
  });
});
