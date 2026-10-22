import { expect } from '@open-wc/testing';
import { planMapLayerOrder, type MapLayerOrderPlan } from './map-layer-order.js';

function replay(existing: readonly string[], plan: MapLayerOrderPlan): string[] {
  const result = [...existing];
  for (const operation of plan.operations) {
    const index = result.indexOf(operation.id);
    expect(index >= 0).to.equal(operation.kind === 'move');
    if (index >= 0) result.splice(index, 1);
    const before = operation.before === undefined ? result.length : result.indexOf(operation.before);
    expect(before).to.be.at.least(0);
    result.splice(before, 0, operation.id);
  }
  return result;
}

describe('planMapLayerOrder', () => {
  it('preserves basemap order and appends unanchored groups in their input order', () => {
    const existing = ['background', 'roads', 'labels'];
    const plan = planMapLayerOrder(existing, [
      { id: 'areas', layerIds: ['areas-fill', 'areas-line'] },
      { id: 'pins', layerIds: ['pins-circle', 'pins-icon'] },
    ]);
    expect(plan.valid).to.equal(true);
    expect(plan.order).to.deep.equal([...existing, 'areas-fill', 'areas-line', 'pins-circle', 'pins-icon']);
    expect(replay(existing, plan)).to.deep.equal(plan.order);
  });

  it('resolves forward group references and places a whole group before a basemap layer', () => {
    const existing = ['background', 'roads', 'labels'];
    const plan = planMapLayerOrder(existing, [
      { id: 'areas', layerIds: ['areas-fill', 'areas-line'], before: 'pins' },
      { id: 'pins', layerIds: ['pins-circle', 'pins-icon'], before: 'labels' },
    ]);
    expect(plan.order).to.deep.equal(['background', 'roads', 'areas-fill', 'areas-line', 'pins-circle', 'pins-icon', 'labels']);
    expect(replay(existing, plan)).to.deep.equal(plan.order);
  });

  it('anchors to the entire owning group when a concrete sublayer is named', () => {
    const plan = planMapLayerOrder(['base'], [
      { id: 'areas', layerIds: ['areas-fill', 'areas-line'] },
      { id: 'pins', layerIds: ['pins-circle'], before: 'areas-line' },
    ]);
    expect(plan.order).to.deep.equal(['base', 'pins-circle', 'areas-fill', 'areas-line']);
    expect(replay(['base'], plan)).to.deep.equal(plan.order);
  });

  it('diagnoses a missing anchor and explicitly falls back above the basemap', () => {
    const plan = planMapLayerOrder(['base', 'labels'], [
      { id: 'pins', layerIds: ['pins-circle'], before: 'removed-labels' },
    ]);
    expect(plan.valid).to.equal(true);
    expect(plan.diagnostics.map((entry) => entry.code)).to.deep.equal(['missing-anchor']);
    expect(plan.order).to.deep.equal(['base', 'labels', 'pins-circle']);
  });

  for (const before of ['a', 'a-fill', 'b']) {
    it(`rejects a self or group cycle involving ${before} without a partial mutation plan`, () => {
      const plan = planMapLayerOrder(['base'], [
        { id: 'a', layerIds: ['a-fill'], before },
        { id: 'b', layerIds: ['b-fill'], before: 'a' },
      ]);
      expect(plan.valid).to.equal(false);
      expect(plan.diagnostics.map((entry) => entry.code)).to.include('cycle');
      expect(plan.operations.length).to.equal(0);
      expect(plan.order.length).to.equal(0);
    });
  }

  it('rejects duplicate existing, logical and owned layer IDs', () => {
    const plans = [
      planMapLayerOrder(['base', 'base'], []),
      planMapLayerOrder([], [{ id: 'a', layerIds: ['one'] }, { id: 'a', layerIds: ['two'] }]),
      planMapLayerOrder([], [{ id: 'a', layerIds: ['one', 'one'] }]),
      planMapLayerOrder([], [{ id: 'a', layerIds: ['one'] }, { id: 'b', layerIds: ['one'] }]),
    ];
    expect(plans.map((plan) => plan.valid)).to.deep.equal([false, false, false, false]);
    expect(plans.every((plan) => plan.operations.length === 0)).to.equal(true);
  });

  it('moves existing sublayers as needed without moving basemap layers and avoids no-op moves', () => {
    const existing = ['base', 'a-line', 'labels', 'a-fill'];
    const groups = [{ id: 'a', layerIds: ['a-fill', 'a-line'], before: 'labels' }];
    const plan = planMapLayerOrder(existing, groups);
    expect(plan.order).to.deep.equal(['base', 'a-fill', 'a-line', 'labels']);
    expect(plan.operations.every((operation) => operation.kind === 'move' && operation.id.startsWith('a-'))).to.equal(true);
    expect(replay(existing, plan)).to.deep.equal(plan.order);
    expect(planMapLayerOrder(plan.order, groups).operations.length).to.equal(0);
  });

  it('replays deterministically against a replacement basemap with added layers', () => {
    const groups = [{ id: 'a', layerIds: ['a-fill', 'a-line'], before: 'labels' }];
    const first = planMapLayerOrder(['base', 'labels'], groups);
    const second = planMapLayerOrder(['base', 'roads', 'labels'], groups);
    expect(replay(['base', 'labels'], first)).to.deep.equal(['base', 'a-fill', 'a-line', 'labels']);
    expect(replay(['base', 'roads', 'labels'], second)).to.deep.equal(['base', 'roads', 'a-fill', 'a-line', 'labels']);
    expect(second.operations).to.deep.equal(first.operations);
  });

  it('uses a logical group anchor before a same-named concrete basemap layer', () => {
    const existing = ['base', 'areas'];
    const plan = planMapLayerOrder(existing, [
      { id: 'areas', layerIds: ['areas-fill'] },
      { id: 'pins', layerIds: ['pins-circle'], before: 'areas' },
    ]);
    expect(plan.order).to.deep.equal(['base', 'areas', 'pins-circle', 'areas-fill']);
    expect(replay(existing, plan)).to.deep.equal(plan.order);
  });

  it('mixes additions and moves with safe anchors for the generated cluster group', () => {
    const existing = ['base', 'pins-circle', 'labels', 'pins-cluster'];
    const plan = planMapLayerOrder(existing, [
      { id: 'pins', layerIds: ['pins-cluster', 'pins-cluster-count', 'pins-circle', 'pins-point-icon'], before: 'labels' },
    ]);
    expect(plan.order).to.deep.equal(['base', 'pins-cluster', 'pins-cluster-count', 'pins-circle', 'pins-point-icon', 'labels']);
    expect(plan.operations.some((operation) => operation.kind === 'add')).to.equal(true);
    expect(plan.operations.some((operation) => operation.kind === 'move')).to.equal(true);
    expect(replay(existing, plan)).to.deep.equal(plan.order);
  });

  it('rejects invalid IDs, empty groups and bounded-input overflow', () => {
    const plans = [
      planMapLayerOrder([''], []),
      planMapLayerOrder([], [{ id: 'a', layerIds: [] }]),
      planMapLayerOrder([], [{ id: 'a', layerIds: Array.from({ length: 33 }, (_, index) => `l${index}`) }]),
      planMapLayerOrder([], Array.from({ length: 129 }, (_, index) => ({ id: `g${index}`, layerIds: [`l${index}`] }))),
      planMapLayerOrder(Array.from({ length: 4097 }, (_, index) => `l${index}`), []),
    ];
    expect(plans.every((plan) => !plan.valid && plan.operations.length === 0)).to.equal(true);
  });

  it('does not mutate caller arrays and freezes its result', () => {
    const existing = Object.freeze(['base']);
    const groups = Object.freeze([Object.freeze({ id: 'a', layerIds: Object.freeze(['a-fill']) })]);
    const plan = planMapLayerOrder(existing, groups);
    expect(existing).to.deep.equal(['base']);
    expect(Object.isFrozen(plan) && Object.isFrozen(plan.order) && Object.isFrozen(plan.operations)).to.equal(true);
    expect(plan.operations.every(Object.isFrozen)).to.equal(true);
  });
});
