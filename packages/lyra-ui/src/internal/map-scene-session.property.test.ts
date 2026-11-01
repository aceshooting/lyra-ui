import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { createMapSceneSessionFacade } from './map-scene-session.js';
import { sceneBackingHarness, sceneStateHarness, sceneTarget, sceneViewport } from '../../test/map-scene-session-fixtures.js';

type WatchOperation =
  | { readonly kind: 'watch'; readonly id: number }
  | { readonly kind: 'release'; readonly owner: number }
  | { readonly kind: 'promote'; readonly fail: boolean }
  | { readonly kind: 'close' };

const operations: fc.Arbitrary<WatchOperation[]> = fc.array(fc.oneof(
  { weight: 5, arbitrary: fc.record({ kind: fc.constant('watch' as const), id: fc.integer({ min: 0, max: 5 }) }) },
  { weight: 4, arbitrary: fc.record({ kind: fc.constant('release' as const), owner: fc.nat({ max: 63 }) }) },
  { weight: 3, arbitrary: fc.record({ kind: fc.constant('promote' as const), fail: fc.boolean() }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'close' as const }) },
), { minLength: 1, maxLength: 48 });

function frequencies(ids: readonly string[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].sort(([first], [second]) => first.localeCompare(second));
}

describe('map scene session ownership properties', () => {
  it('conserves one backend watch per live ID across individual release, promotion, failure and close', () => {
    fc.assert(fc.property(operations, input => {
      const state = sceneStateHarness();
      const facade = createMapSceneSessionFacade({ connection: state.connection });
      expect(facade.bindState(state.state)).to.equal(true);
      const refs = new Map<string, number>();
      const owners: { id: string; live: boolean; release: () => void }[] = [];
      const backings: {
        harness: ReturnType<typeof sceneBackingHarness>;
        acquired: string[];
        retired: string[];
        subscriptionReleased: boolean;
      }[] = [];
      let active: (typeof backings)[number] | undefined;
      let closed = false;

      const retire = () => {
        if (!active) return;
        active.retired.push(...refs.keys());
        active.subscriptionReleased = true;
        active = undefined;
      };
      const check = () => {
        for (const backing of backings) {
          expect(frequencies(backing.harness.acquired), 'backend acquisitions').to.deep.equal(frequencies(backing.acquired));
          expect(frequencies(backing.harness.retired), 'backend releases').to.deep.equal(frequencies(backing.retired));
          const expected = backing === active ? [...refs.keys()].map(id => [id, 1] as const) : [];
          expect([...backing.harness.activeWatches].sort(), 'live backend demand').to.deep.equal(expected.sort());
          expect(backing.harness.subscriptions, 'frame subscription acquisition').to.equal(1);
          expect(backing.harness.releases, 'frame subscription release').to.equal(Number(backing.subscriptionReleased));
        }
        expect(state.subscriptions, 'persistent state subscription').to.equal(1);
        expect(state.releases, 'persistent state survives frame failure').to.equal(Number(closed));
      };

      try {
        for (const operation of input) {
          if (operation.kind === 'watch') {
            const id = `target-${operation.id}`;
            const previous = refs.get(id) ?? 0;
            const release = facade.attachment.watchTarget(id);
            owners.push({ id, live: !closed, release });
            if (!closed) {
              refs.set(id, previous + 1);
              if (previous === 0) active?.acquired.push(id);
            }
          } else if (operation.kind === 'release') {
            const owner = owners[operation.owner % Math.max(1, owners.length)];
            if (owner) {
              owner.release();
              owner.release();
              if (owner.live) {
                owner.live = false;
                const remaining = (refs.get(owner.id) ?? 0) - 1;
                if (remaining === 0) {
                  refs.delete(owner.id);
                  active?.retired.push(owner.id);
                } else refs.set(owner.id, remaining);
              }
            }
          } else if (operation.kind === 'promote') {
            const harness = sceneBackingHarness(state);
            if (operation.fail) harness.hooks.subscribe = () => { throw new Error('Frame installation unavailable'); };
            if (!closed) retire();
            const admitted = facade.promote(harness.backing);
            expect(admitted).to.equal(!closed && !operation.fail);
            if (closed) {
              expect(harness.subscriptions).to.equal(0);
              expect(harness.acquired.length).to.equal(0);
            } else {
              const model = { harness, acquired: operation.fail ? [] : [...refs.keys()],
                retired: [] as string[], subscriptionReleased: operation.fail };
              backings.push(model);
              if (!operation.fail) active = model;
            }
          } else {
            if (!closed) {
              retire();
              closed = true;
              refs.clear();
              for (const owner of owners) owner.live = false;
            }
            facade.close();
          }
          check();
        }
        if (!closed) {
          retire();
          closed = true;
          refs.clear();
        }
        facade.close();
        for (const owner of owners) { owner.release(); owner.release(); }
        facade.close();
        check();
      } finally { facade.close(); }
    }), propertyRuns());
  });

  it('preserves the exact selected fact through unrelated movement and metadata-only acceptance', () => {
    fc.assert(fc.property(
      fc.integer({ min: -179, max: 179 }),
      fc.uniqueArray(fc.integer({ min: -179, max: 179 }), { minLength: 1, maxLength: 16 }),
      (longitude, positions) => {
        const state = sceneStateHarness();
        const selected = sceneTarget('selected', longitude);
        state.set([selected, sceneTarget('other', -180, 2)]);
        const facade = createMapSceneSessionFacade({ connection: state.connection });
        try {
          expect(facade.bindState(state.state)).to.equal(true);
          const changed: string[][] = [];
          const viewportWidths: number[] = [];
          facade.attachment.subscribeTargets(notice => changed.push([...notice.changedIds]));
          facade.attachment.subscribeViewport(notice => viewportWidths.push(notice.width));
          changed.length = 0; viewportWidths.length = 0;
          for (const [index, position] of positions.entries()) {
            const other = sceneTarget('other', position, index + 3);
            state.set([selected, other]);
            expect(changed).to.deep.equal([['other']]);
            const lookup = facade.attachment.target('selected');
            expect(lookup.status === 'accepted' && lookup.target === selected, 'selected receipt identity').to.equal(true);
            changed.length = 0;
            state.set([selected, other], { registryRevision: state.snapshot.registryRevision });
            expect(changed, 'metadata-only acceptance').to.deep.equal([]);
            expect(viewportWidths, 'unrelated acceptance preserves allocation').to.deep.equal([]);
          }
        } finally { facade.close(); }
      },
    ), propertyRuns());
  });

  it('does not consume target or allocation notices when authoritative reads precede invalidation', () => {
    fc.assert(fc.property(
      fc.uniqueArray(fc.integer({ min: 641, max: 1280 }), { minLength: 1, maxLength: 16 }),
      fc.integer({ min: 1, max: 8 }),
      (widths, reads) => {
        const state = sceneStateHarness();
        state.set([sceneTarget()]);
        const facade = createMapSceneSessionFacade({ connection: state.connection });
        try {
          expect(facade.bindState(state.state)).to.equal(true);
          const targetNotices: string[][] = [];
          const viewportNotices: number[] = [];
          facade.attachment.subscribeTargets(notice => targetNotices.push([...notice.changedIds]));
          facade.attachment.subscribeViewport(notice => viewportNotices.push(notice.width));
          targetNotices.length = 0; viewportNotices.length = 0;
          for (const [index, width] of widths.entries()) {
            const target = sceneTarget('target', index + 1, index + 2);
            state.set([target], { notify: false });
            state.viewport(sceneViewport(index + 2, width), false);
            for (let read = 0; read < reads; read++) {
              const lookup = facade.attachment.target('target');
              expect(lookup.status === 'accepted' && lookup.target === target, 'read-through precedes invalidation').to.equal(true);
              expect(facade.attachment.target(`absent-${read}`).status).to.equal('absent');
            }
            expect(targetNotices).to.deep.equal([]);
            expect(viewportNotices).to.deep.equal([]);
            state.emit();
            expect(targetNotices).to.deep.equal([['target']]);
            expect(viewportNotices).to.deep.equal([width]);
            state.emit();
            expect(targetNotices, 'duplicate invalidation').to.deep.equal([['target']]);
            expect(viewportNotices, 'duplicate allocation invalidation').to.deep.equal([width]);
            targetNotices.length = 0; viewportNotices.length = 0;
          }
        } finally { facade.close(); }
      },
    ), propertyRuns());
  });

  it('keeps independent listener baselines when disjoint changes interrupt notification delivery', () => {
    fc.assert(fc.property(
      fc.integer({ min: -179, max: 179 }), fc.integer({ min: -179, max: 179 }),
      (firstLongitude, secondLongitude) => {
        const state = sceneStateHarness();
        const first = sceneTarget('first', -180), second = sceneTarget('second', -180, 2);
        const nextFirst = sceneTarget('first', firstLongitude, 3);
        const nextSecond = sceneTarget('second', secondLongitude, 4);
        state.set([first, second]);
        const facade = createMapSceneSessionFacade({ connection: state.connection });
        try {
          expect(facade.bindState(state.state)).to.equal(true);
          const firstNotices: string[][] = [], secondNotices: string[][] = [];
          const observedRevisions: number[] = [];
          let armed = false, reentered = false;
          facade.attachment.subscribeTargets(notice => {
            firstNotices.push([...notice.changedIds].sort());
            if (armed && !reentered) {
              reentered = true;
              const lookup = facade.attachment.target('first');
              if (lookup.status === 'accepted') observedRevisions.push(lookup.target.acceptedPositionRevision);
              state.set([nextFirst, nextSecond]);
            }
          });
          facade.attachment.subscribeTargets(notice => secondNotices.push([...notice.changedIds].sort()));
          firstNotices.length = 0; secondNotices.length = 0;
          armed = true;
          state.set([nextFirst, second]);
          expect(reentered).to.equal(true);
          expect(observedRevisions).to.deep.equal([3]);
          expect(firstNotices).to.deep.equal([['first'], ['second']]);
          expect(secondNotices).to.deep.equal([['first', 'second']]);
        } finally { facade.close(); }
      },
    ), propertyRuns());
  });
});
