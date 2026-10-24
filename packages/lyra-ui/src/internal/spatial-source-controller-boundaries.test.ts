import { expect, waitUntil } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { LyraSpatialPointSource, LyraSpatialQuery } from '../utilities/data-spatial.js';
import { SpatialSourceController, type SpatialPoint } from './spatial-source-controller.js';

const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
const point: SpatialPoint = { id: 'one', sourceIndex: 0, x: 20, y: 20 };
function source(): LyraSpatialPointSource<SpatialPoint> {
  return { revision: 1, count: 3, bounds,
    query: request => ({ matchedCount: 3, bins: [{ bounds: request.bounds, count: 3 }], points: [] }),
    getPoint: () => point };
}
function setup(locale: () => string = () => 'en') {
  const controllers = new Set<ReactiveController>();
  const host = Object.assign(document.createElement('div'), {
    addController: (controller: ReactiveController) => controllers.add(controller),
    removeController: (controller: ReactiveController) => controllers.delete(controller),
    requestUpdate: () => {}, updateComplete: Promise.resolve(true),
  }) satisfies HTMLElement & ReactiveControllerHost;
  document.body.append(host);
  const control = new SpatialSourceController(host, () => {}, locale);
  return { host, control, cleanup: () => {
    control.reset(); host.remove(); controllers.forEach(controller => controller.hostDisconnected?.());
  } };
}
const settled = (control: SpatialSourceController) => waitUntil(() => control.error || !control.loading && control.result !== undefined);

describe('spatial provider boundaries', () => {
  it('rejects inconsistent global metadata and missing methods before dispatch', () => {
    for (const [key, value] of [
      ['bounds', null], ['count', 0], ['bounds', { ...bounds, minY: 101 }],
      ['bounds', 4], ['query', undefined], ['getPoint', null],
    ] as const) {
      const test = setup(); let reads = 0;
      const input = source(); input.query = () => { reads++; return { matchedCount: 0, bins: [], points: [] }; };
      Reflect.set(input, key, value);
      try {
        test.control.bind(input, null, 20, '');
        expect(test.control.error, key).to.equal(true);
        expect(test.control.binding === undefined, key).to.equal(true);
        expect(reads, key).to.equal(0);
      } finally { test.cleanup(); }
    }
  });

  it('rejects malformed query shapes, point coordinates and density multiplicity without partial publication', async () => {
    const valid = { matchedCount: 3, bins: [{ bounds, count: 3 }], points: [point] };
    const replies: unknown[] = [
      null, { ...valid, matchedCount: 4 }, { ...valid, bins: {} }, { ...valid, points: {} },
      { ...valid, bins: [{ bounds: { ...bounds, maxY: 0 }, count: 3 }] },
      ...[{ id: ' ' }, { sourceIndex: 3 }, { x: 101 }].map(change => ({ ...valid, points: [{ ...point, ...change }] })),
      { matchedCount: 3, bins: [
        { bounds: { ...bounds, maxX: 50 }, count: 1 },
        { bounds: { ...bounds, minX: 50 }, count: 2 },
      ], points: [point, { ...point, id: 'two', sourceIndex: 1, x: 30 }] },
    ];
    for (const reply of replies) {
      const test = setup(); const input = source(); Reflect.set(input, 'query', () => reply);
      try {
        test.control.bind(input, null, 20, ''); await settled(test.control);
        expect(test.control.error).to.equal(true);
        expect(test.control.result === undefined).to.equal(true);
        expect(test.control.points().length).to.equal(0);
      } finally { test.cleanup(); }
    }
  });

  it('accepts an empty spatial match and rejects blank controlled selection without a lookup', async () => {
    const test = setup(); let reads = 0;
    const input = source(); input.query = () => ({ matchedCount: 0, bins: [], points: [] });
    input.getPoint = () => { reads++; return null; };
    try {
      test.control.bind(input, null, 20, ''); await settled(test.control);
      expect(test.control.result).to.deep.equal({ matchedCount: 0, bins: [], points: [] });
      expect(test.control.error).to.equal(false);
      test.control.setSelected(' ');
      expect(test.control.error).to.equal(true);
      expect(test.control.selected === undefined).to.equal(true);
      expect(reads).to.equal(0);
    } finally { test.cleanup(); }
  });

  it('rejects an exact point supplied by an empty source', async () => {
    const test = setup(); const input = { ...source(), count: 0, bounds: null };
    try {
      test.control.bind(input, null, 20, '');
      expect(test.control.result!.matchedCount).to.equal(0);
      expect(await test.control.reveal('one')).to.equal(null);
      expect(test.control.error).to.equal(true);
      expect(test.control.points().length).to.equal(0);
    } finally { test.cleanup(); }
  });

  it('rejects a missing exact reply when the current query has already established that identity', async () => {
    const test = setup(); const input = source();
    let finishQuery!: (reply: LyraSpatialQuery<SpatialPoint>) => void;
    let finishExact!: (reply: SpatialPoint | null) => void;
    input.query = () => new Promise(resolve => { finishQuery = resolve; });
    input.getPoint = () => new Promise(resolve => { finishExact = resolve; });
    try {
      test.control.bind(input, null, 20, '');
      const exact = test.control.reveal('one');
      finishQuery({ matchedCount: 3, bins: [{ bounds, count: 3 }], points: [point] });
      await settled(test.control); finishExact(null);
      expect(await exact).to.equal(null);
      expect(test.control.error).to.equal(true);
      expect(test.control.revealed === undefined).to.equal(true);
      expect(test.control.points().map(value => value.id)).to.deep.equal(['one']);
    } finally { test.cleanup(); }
  });

  it('keeps replacement authority when the locale callback replaces the query source', async () => {
    let replace: (() => void) | undefined;
    const test = setup(() => { const action = replace; replace = undefined; action?.(); return 'en'; });
    let obsoleteReads = 0; const obsolete = source();
    obsolete.query = () => { obsoleteReads++; return { matchedCount: 0, bins: [], points: [] }; };
    const newer = { ...source(), revision: 'replacement' };
    try {
      replace = () => test.control.bind(newer, null, 20, '');
      test.control.bind(obsolete, null, 20, ''); await settled(test.control);
      expect(test.control.binding!.revision).to.equal('replacement');
      expect(test.control.result!.matchedCount).to.equal(3);
      expect(test.control.error).to.equal(false); expect(obsoleteReads).to.equal(0);
    } finally { test.cleanup(); }
  });

  it('pans collapsed axes and preserves viewport span on either side of the visible range', async () => {
    const test = setup();
    try {
      expect(test.control.panTo(point)).to.equal(undefined);
      test.control.configure(null, 20);
      const global = { minX: 0, maxX: 0, minY: 0, maxY: 100 };
      test.control.bind({ ...source(), bounds: global }, { ...global, minY: 20, maxY: 40 }, 20, '');
      await settled(test.control);
      expect(test.control.error).to.equal(false);
      expect(test.control.panTo({ ...point, x: 0, y: 5 })).to.deep.equal({ ...global, minY: 5, maxY: 25 });
      expect(test.control.panTo({ ...point, x: 0, y: 90 })).to.deep.equal({ ...global, minY: 70, maxY: 90 });
      expect(test.control.panTo({ ...point, x: 0, y: 30 })).to.deep.equal({ ...global, minY: 20, maxY: 40 });
    } finally { test.cleanup(); }
  });

  it('declines a pan whose finite endpoints cannot preserve a representable viewport span', async () => {
    const test = setup();
    try {
      const global = { minX: -Number.MAX_VALUE, maxX: Number.MAX_VALUE, minY: 0, maxY: 100 };
      test.control.bind({ ...source(), bounds: global }, { ...global, minY: 20, maxY: 40 }, 20, '');
      await settled(test.control);
      expect(test.control.error).to.equal(false);
      expect(test.control.panTo({ ...point, y: 5 })).to.equal(undefined);
      const fine = { minX: 0, maxX: 1, minY: 20, maxY: 40 };
      test.control.configure(fine, 20); await settled(test.control);
      expect(test.control.error).to.equal(false);
      expect(test.control.panTo({ ...point, x: Number.MAX_VALUE, y: 30 })).to.equal(undefined);
      expect(test.control.view).to.deep.equal(fine);
    } finally { test.cleanup(); }
  });
});
