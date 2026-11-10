import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './chart.js';
import './lite-chart.js';
import type { LyraChart } from './chart.class.js';
import type { LyraLiteChart } from './lite-chart.class.js';

type SyncAccess = {
  chartSync: { enabled: boolean; publish(label: string, index: number): void };
  lastObservedInlineSize?: number;
  samplingWidth: number;
  resizeDrawFrame?: number;
  onSyncPointerMove(event: PointerEvent): void;
};

async function synchronizedCharts() {
  const host = await fixture<HTMLDivElement>(html`<div style="width:600px">
    <lr-chart sync-group="query-recovery" without-animation height="8rem" .labels=${['A', 'B']}
      .datasets=${[{ label: 'Source', data: [1, 2] }]}></lr-chart>
    <lr-lite-chart sync-group="query-recovery" height="8rem" .labels=${['A', 'B']}
      .datasets=${[{ label: 'Peer', data: [10, 20] }]}></lr-lite-chart>
  </div>`);
  const chart = host.querySelector<LyraChart>('lr-chart')!;
  const peer = host.querySelector<LyraLiteChart>('lr-lite-chart')!;
  const access = chart as unknown as SyncAccess;
  await waitUntil(() => {
    const width = access.lastObservedInlineSize;
    return Boolean(chart.chart && width !== undefined && width > 0 && access.samplingWidth === Math.floor(width) &&
      access.resizeDrawFrame === undefined && chart.chartArea && chart.chartArea.width > 0 && access.chartSync.enabled &&
      (peer as unknown as SyncAccess).chartSync.enabled);
  }, 'group is ready', { timeout: 5000 });
  const native = chart.chart!;
  // The native peer may violate its declaration; retain unknown at this boundary.
  const queryPeer = native as unknown as { getElementsAtEventForMode: () => unknown };
  const query = queryPeer.getElementsAtEventForMode;
  const move = () => access.onSyncPointerMove(new PointerEvent('pointermove'));
  const shown = () => Boolean(peer.shadowRoot!.querySelector('[part="sync-crosshair"]'));
  const tooltip = () => peer.shadowRoot!.querySelector('[part="sync-tooltip"]')?.textContent ?? '';
  async function publish(index: number) {
    queryPeer.getElementsAtEventForMode = () => [{ datasetIndex: 0, index }];
    move();
    await waitUntil(() => shown() && tooltip().includes(index === 0 ? '10' : '20'));
  }
  return { host, chart, peer, access, native, queryPeer, move, shown, publish,
    restore: () => { queryPeer.getElementsAtEventForMode = query; } };
}

describe('chart synchronized peer hit recovery', () => {
  it('contains a failed native hit query, clears the old category and accepts the next hit', async () => {
    const pair = await synchronizedCharts();
    try {
      await pair.publish(0);
      pair.queryPeer.getElementsAtEventForMode = () => { throw new Error('Hit query unavailable'); };
      expect(pair.move).not.to.throw();
      expect(pair.shown()).to.equal(false);
      await pair.publish(1);
    } finally { pair.restore(); }
  });

  const invalidHits: readonly [string, () => unknown][] = [
    ['null result', () => null],
    ['array-like result', () => ({ 0: { datasetIndex: 0, index: 0 }, length: 1 })],
    ['empty result', () => []],
    ['sparse result', () => new Array(1)],
    ['missing indexes', () => [{}]],
    ['fractional row', () => [{ datasetIndex: 0, index: 0.5 }]],
    ['out-of-range row', () => [{ datasetIndex: 0, index: 2 }]],
    ['out-of-range dataset', () => [{ datasetIndex: 1, index: 0 }]],
    ['inherited indexes', () => [Object.create({ datasetIndex: 0, index: 0 }) as unknown]],
    ['revoked result', () => {
      const result = Proxy.revocable([], {});
      result.revoke();
      return result.proxy;
    }],
  ];
  for (const [name, invalid] of invalidHits) {
    it(`clears the current cue for a ${name} and recovers`, async () => {
      const pair = await synchronizedCharts();
      try {
        await pair.publish(0);
        pair.queryPeer.getElementsAtEventForMode = invalid;
        expect(pair.move).not.to.throw();
        expect(pair.shown()).to.equal(false);
        await pair.publish(1);
      } finally { pair.restore(); }
    });
  }

  for (const boundary of ['entry', 'index'] as const) {
    it(`rejects a hit ${boundary} accessor without invoking it`, async () => {
      const pair = await synchronizedCharts();
      let reads = 0;
      const accessor = { get: () => { reads += 1; return boundary === 'entry' ? { datasetIndex: 0, index: 0 } : 0; } };
      const result = boundary === 'entry'
        ? Object.defineProperty([], '0', accessor)
        : [Object.defineProperty({ datasetIndex: 0 }, 'index', accessor)];
      try {
        await pair.publish(0);
        pair.queryPeer.getElementsAtEventForMode = () => result;
        expect(pair.move).not.to.throw();
        expect(reads).to.equal(0);
        expect(pair.shown()).to.equal(false);
        await pair.publish(1);
      } finally { pair.restore(); }
    });
  }

  it('clears a stale native hit on a now-hidden dataset and resumes after it becomes visible', async () => {
    const pair = await synchronizedCharts();
    try {
      await pair.publish(0);
      pair.native.setDatasetVisibility(0, false);
      pair.move();
      expect(pair.shown()).to.equal(false);
      pair.native.setDatasetVisibility(0, true);
      await pair.publish(1);
    } finally { pair.native.setDatasetVisibility(0, true); pair.restore(); }
  });

  for (const boundary of ['query', 'array', 'entry', 'index'] as const) {
    for (const replacement of ['group', 'data'] as const) {
      it(`does not publish an obsolete hit after ${replacement} changes during ${boundary} admission`, async () => {
        const pair = await synchronizedCharts();
        const controller = pair.access.chartSync;
        const publish = controller.publish;
        let publications = 0;
        let replacements = 0;
        const replace = () => {
          replacements += 1;
          if (replacement === 'group') pair.chart.syncGroup = 'replacement';
          else pair.chart.datasets = [{ label: 'Replacement', data: [3, 4] }];
        };
        const hit = { datasetIndex: 0, index: 1 };
        const result = boundary === 'index' ? [new Proxy(hit, {
          getOwnPropertyDescriptor(target, key) {
            if (key === 'index') replace();
            return Reflect.getOwnPropertyDescriptor(target, key);
          },
        })] : new Proxy([hit], {
          getOwnPropertyDescriptor(target, key) {
            if ((boundary === 'array' && key === 'length') || (boundary === 'entry' && key === '0')) replace();
            return Reflect.getOwnPropertyDescriptor(target, key);
          },
        });
        try {
          controller.publish = function (label, index) {
            publications += 1;
            publish.call(this, label, index);
          };
          pair.queryPeer.getElementsAtEventForMode = () => {
            if (boundary === 'query') replace();
            return result;
          };
          expect(pair.move).not.to.throw();
          expect(replacements).to.be.greaterThan(0);
          expect(publications).to.equal(0);
          expect(pair.shown()).to.equal(false);
          pair.chart.syncGroup = 'query-recovery';
          await pair.chart.updateComplete;
          await pair.publish(1);
        } finally { controller.publish = publish; pair.restore(); }
      });
    }
  }
});
