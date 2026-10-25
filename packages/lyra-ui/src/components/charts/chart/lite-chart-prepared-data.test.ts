import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { registerLyraLocale } from '../../../internal/localization-runtime.js';
import { sendKeys, sendMouse } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './lite-chart.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import type { LyraPreparedSeriesData, LyraSeriesSample } from '../../../utilities/data-preparation.js';

type PreparedLite = LyraLiteChart & {
  preparedData: LyraPreparedSeriesData | null;
  revealSourcePoint(ref: { seriesId: string; sourceIndex: number }): Promise<boolean>;
};
function source(): LyraPreparedSeriesData {
  return { kind: 'series', revision: 'original', getPoint: ref => ({ x: ref.sourceIndex, y: 5 }), series: [{ id: 's', label: 'Signal',
    counts: { sourceCount: 1000, validCount: 999, invalidCount: 1 }, xDomain: { min: 0, max: 999 }, yDomain: { min: 0, max: 9 },
    samples: [0, 100, 900, 999].map((index, ordinal) => ({ x: index, y: ordinal * 3, sourceIndex: index, breakBefore: ordinal === 0 || ordinal === 2 })),
  }] };
}
async function mount(prepared = source()): Promise<PreparedLite> {
  const element = await fixture<PreparedLite>(html`<lr-lite-chart type="line" with-data-table style="width:600px" .preparedData=${prepared}></lr-lite-chart>`);
  await waitUntil(() => (element.shadowRoot?.querySelectorAll('[part="point"]').length ?? 0) > 0, 'prepared marks missing');
  return element;
}
function points(element: PreparedLite): SVGCircleElement[] { return [...element.shadowRoot!.querySelectorAll<SVGCircleElement>('[part="point"]')]; }
function activate(point: Element): void { point.dispatchEvent(new MouseEvent('click', { bubbles: true })); }

it('positions independent series by original x rather than shared sampled ordinal in line and bar modes', async () => {
  const prepared = source();
  const element = await mount({ ...prepared, series: [prepared.series[0]!, { ...prepared.series[0]!, id: 'other', samples: [
    { x: 0, y: 0, sourceIndex: 10, breakBefore: true },
    { x: 900, y: 3, sourceIndex: 500, breakBefore: false },
    { x: 950, y: 6, sourceIndex: 600, breakBefore: false },
    { x: 999, y: 9, sourceIndex: 999, breakBefore: false },
  ] }] });
  const first = element.shadowRoot!.querySelector<SVGCircleElement>('[part="point"][data-dataset-index="0"][data-index="1"]')!;
  const second = element.shadowRoot!.querySelector<SVGCircleElement>('[part="point"][data-dataset-index="1"][data-index="1"]')!;
  expect(Number(first.getAttribute('cx'))).to.be.lessThan(Number(second.getAttribute('cx')));
  const events: unknown[] = []; element.addEventListener('lr-source-point-select', event => events.push((event as CustomEvent).detail));
  activate(second);
  expect(events[0]).to.deep.equal({ revision: 'original', seriesId: 'other', sourceIndex: 500, point: { x: 900, y: 3 } });
  expect(element.shadowRoot!.querySelectorAll('[part="data-list"] li')).to.have.length(8);
  const csv = element.exportData('csv');
  expect(csv).to.include('500:'); expect(csv.split('\r\n')).to.have.length(9);
  element.type = 'bar'; element.barX = () => { throw new Error('Ordinal bar placement read'); }; element.barSlotWidth = 100;
  await element.updateComplete;
  const bars = element.shadowRoot!.querySelectorAll('[part="bar"]');
  const firstBar = [...bars].find(bar => bar.getAttribute('data-dataset-index') === '0' && bar.getAttribute('data-index') === '1')!;
  const secondBar = [...bars].find(bar => bar.getAttribute('data-dataset-index') === '1' && bar.getAttribute('data-index') === '1')!;
  expect(Number(firstBar.getAttribute('x'))).to.be.lessThan(Number(secondBar.getAttribute('x')));
});

it('preserves old rendered actions before replacement, cancels pending work and rejects detached hits', async () => {
  let signal!: AbortSignal; let resolve!: (point: { x: number; y: number }) => void;
  const prepared = { ...source(), getPoint: (_ref: unknown, request: { signal: AbortSignal }) => { signal = request.signal; return new Promise<{ x: number; y: number }>(done => { resolve = done; }); } };
  const element = await mount(prepared);
  const revisions: unknown[] = []; element.addEventListener('lr-source-point-select', event => revisions.push((event as CustomEvent).detail.revision));
  const pending = element.revealSourcePoint({ seriesId: 's', sourceIndex: 500 }); await element.updateComplete;
  expect(element.getAttribute('aria-busy')).to.equal('true');
  const old = points(element)[0]!;
  element.preparedData = { ...source(), revision: 'replacement' }; activate(old);
  expect(revisions).to.deep.equal(['original']);
  await element.updateComplete; expect(signal.aborted).to.equal(true); expect(await pending).to.equal(false);
  resolve({ x: 500, y: 5 }); await Promise.resolve();
  activate(points(element)[0]!); expect(revisions.at(-1)).to.equal('replacement');
  element.type = 'bar'; await element.updateComplete;
  const count = revisions.length; activate(old); expect(revisions).to.have.length(count);
});

it('refreshes same-reference and coalesced keyless mutable descriptors with localized lists', async () => {
  const prepared = { ...source(), revision: 'first' };
  const element = await mount(prepared);
  const revisions: unknown[] = []; element.addEventListener('lr-source-point-select', event => revisions.push((event as CustomEvent).detail.revision));
  prepared.revision = 'second'; element.preparedData = prepared; await element.updateComplete;
  activate(points(element)[0]!); expect(revisions.at(-1)).to.equal('second');
  prepared.revision = 'third'; element.requestUpdate(); element.height = '301px'; await element.updateComplete;
  activate(points(element)[0]!); expect(revisions.at(-1)).to.equal('third');
  element.strings = { chartPointCoordinates: 'Coordinates {x} / {y}', chartPreparedSummary: 'Full {validCount}; invalid {invalidCount}; shown {displayedCount}' };
  await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="data-list"]')!.textContent).to.include('Coordinates');
  expect(element.shadowRoot!.querySelector('[part="description"]')!.textContent).to.include('Full 999');
});

it('keeps prepared rendering, append, export and style independent of legacy getters', async () => {
  const element = await mount(); let reads = 0;
  Object.defineProperty(element, 'labels', { configurable: true, get() { reads++; throw new Error('Legacy labels read'); } });
  Object.defineProperty(element, 'datasets', { configurable: true, get() { reads++; throw new Error('Legacy series read'); } });
  try {
    element.requestUpdate(); element.height = '303px'; await element.updateComplete;
    element.exportData('csv'); element.exportData('svg'); element.appendData('ignored', [3]);
    expect(reads).to.equal(0);
  } finally { delete (element as Partial<PreparedLite>).labels; delete (element as Partial<PreparedLite>).datasets; }
});

it('bounds indexed refinement and isolates selected points without changing full-domain summaries', async () => {
  let requested = 0;
  const prepared = source();
  const element = await mount({ ...prepared, series: Array.from({ length: 50 }, (_, i) => ({ ...prepared.series[0]!, id: `s${i}`, samples: [prepared.series[0]!.samples[0]!] })),
    queryRange(request) { requested = request.maxPoints; return Array.from({ length: requested }, (_, i) => ({ x: request.startIndex + i, y: 5, sourceIndex: request.startIndex + i, breakBefore: true })); },
  });
  expect(await element.revealSourcePoint({ seriesId: 's0', sourceIndex: 500 })).to.equal(true); await element.updateComplete;
  expect(requested).to.be.at.most(9); expect(points(element).length).to.be.at.most(1000);
  expect(element.shadowRoot!.querySelector('[part="description"]')!.textContent).to.include('range 0 to 9');
});

it('cancels disconnect/adoption requests and supports reconnect', async () => {
  let signal!: AbortSignal;
  const prepared = { ...source(), getPoint: (_ref: unknown, request: { signal: AbortSignal }) => { signal = request.signal; return new Promise<null>(() => {}); } };
  const element = await mount(prepared);
  const pending = element.revealSourcePoint({ seriesId: 's', sourceIndex: 500 });
  element.remove(); expect(await pending).to.equal(false); expect(signal.aborted).to.equal(true);
  document.body.append(element); await element.updateComplete;
  const second = element.revealSourcePoint({ seriesId: 's', sourceIndex: 500 });
  const foreign = document.implementation.createHTMLDocument('other'); foreign.adoptNode(element);
  expect(await second).to.equal(false); expect(signal.aborted).to.equal(true);
  document.body.append(element); element.preparedData = source(); await element.updateComplete;
  expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 500 })).to.equal(true);
});

it('rejects incompatible stacked ordered summaries and restores the unchanged legacy export when unset', async () => {
  const element = await fixture<PreparedLite>(html`<lr-lite-chart type="bar" .labels=${['A','B']} .datasets=${[{ label: 'Legacy', data: [1,2] }]}></lr-lite-chart>`);
  const legacy = element.exportData('csv');
  element.strings = { chartPreparedUnavailable: 'Prepared unavailable' }; element.preparedData = source(); element.stacked = true;
  await element.updateComplete;
  expect(element.shadowRoot!.textContent).to.include('Prepared unavailable'); expect(element.shadowRoot!.querySelectorAll('[part="bar"]')).to.have.length(0);
  element.preparedData = null; element.stacked = false; await element.updateComplete;
  expect(element.exportData('csv')).to.equal(legacy);
});

it('keeps nonmonotonic x order and separated gaps under RTL and keyboard activation', async () => {
  const prepared = source();
  const samples: LyraSeriesSample[] = [0,900,100,999].map((x,i) => ({ x, y: i*3, sourceIndex: i, breakBefore: i === 0 || i === 2 }));
  const element = await mount({ ...prepared, series: [{ ...prepared.series[0]!, samples }] });
  element.dir = 'rtl'; await element.updateComplete;
  const marks = points(element);
  expect(Number(marks[0]!.getAttribute('cx'))).to.be.greaterThan(Number(marks[1]!.getAttribute('cx')));
  expect(Number(marks[1]!.getAttribute('cx'))).to.be.lessThan(Number(marks[2]!.getAttribute('cx')));
  expect(element.shadowRoot!.querySelector('[part="line"]')!.getAttribute('d')!.match(/M/g)).to.have.length(2);
  const events: { sourceIndex: number }[] = []; element.addEventListener('lr-source-point-select', event => events.push((event as CustomEvent).detail));
  const bounds = marks[2]!.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(bounds.x + bounds.width / 2), Math.round(bounds.y + bounds.height / 2)] });
  expect(events.at(-1)!.sourceIndex).to.equal(2);
  await focusByKeyboard(marks[0]! as unknown as HTMLElement); await sendKeys({ press: 'Enter' });
  expect(events.at(-1)!.sourceIndex).to.equal(0);
  await expect(element).to.be.accessible();
});

it('renders zero and all-invalid prepared summaries without treating them as errors', async () => {
  for (const count of [0, 1000000]) {
    const prepared = source();
    const element = await fixture<PreparedLite>(html`<lr-lite-chart type="line" .preparedData=${{ ...prepared, series: [{ ...prepared.series[0]!, samples: [], counts: { sourceCount: count, validCount: 0, invalidCount: count }, xDomain: null, yDomain: null }] }}></lr-lite-chart>`);
    expect(element.shadowRoot!.textContent).to.include('0 valid observations');
    expect(element.shadowRoot!.textContent).not.to.include('unavailable');
    expect(element.shadowRoot!.querySelectorAll('[part="point"]')).to.have.length(0);
  }
});

it('exports admitted zero observations even when skipZero hides their bars', async () => {
  const element = await mount(); element.type = 'bar'; element.skipZero = true; await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[part="bar"]')).to.have.length(3);
  expect(element.exportData('csv').split('\r\n')).to.have.length(5);
  expect(element.exportData('csv')).to.include('0:');
});

it('rejects malformed point/refinement replies while retaining the completed overview', async () => {
  const prepared = source();
  const element = await mount({ ...prepared, queryRange: () => [{ x: 1000, y: 5, sourceIndex: 1000, breakBefore: true }] });
  const before = element.exportData('csv');
  expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 500 })).to.equal(false); await element.updateComplete;
  expect(element.exportData('csv')).to.equal(before); expect(element.shadowRoot!.textContent).to.include('unavailable');
  element.preparedData = { ...prepared, getPoint: () => ({ x: Number.POSITIVE_INFINITY, y: 5 }) }; await element.updateComplete;
  expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: 500 })).to.equal(false); await element.updateComplete;
  expect(element.exportData('csv')).to.equal(before);
});


it('refreshes same-locale registered coordinate messages on a coalesced keyless update', async () => {
  const locale = 'en-XL';
  registerLyraLocale(locale, { chartPointCoordinates: 'First {x}/{y}' });
  const element = await mount(); element.locale = locale; await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="data-list"]')!.textContent).to.include('First');
  registerLyraLocale(locale, { chartPointCoordinates: 'Second {x}/{y}' });
  element.requestUpdate(); element.height = '307px'; await element.updateComplete;
  expect(element.shadowRoot!.querySelector('[part="data-list"]')!.textContent).to.include('Second');
});

it('keeps native per-point titles when ordered series replace category synchronization', async () => {
  const element = await fixture<PreparedLite>(html`<lr-lite-chart sync-group="prepared-route" .labels=${['A','B']} .datasets=${[{ label: 'Values', data: [1,2] }]}></lr-lite-chart>`);
  await waitUntil(() => element.shadowRoot!.querySelectorAll('[part="bar"]').length === 2);
  element.preparedData = source(); element.type = 'line'; await element.updateComplete;
  await waitUntil(() => points(element).length === 4 && points(element).every(point => point.querySelector('title') !== null));
  expect(points(element)[1]!.querySelector('title')!.textContent).to.include('100:');
});

it('uses the same rendered logarithmic axis ticks for prepared full domains and legacy values', async () => {
  const values = [1,10,100,1000];
  const legacy = await fixture<LyraLiteChart>(html`<lr-lite-chart scale="logarithmic" without-zero-baseline style="width:600px" .datasets=${[{ label: 'Values', data: values }]}></lr-lite-chart>`);
  const original = source();
  const prepared: LyraPreparedSeriesData = { ...original, series: [{ ...original.series[0]!, yDomain: { min: 1, max: 1000 },
    samples: values.map((y,i) => ({ x: i * 333, y, sourceIndex: i * 333, breakBefore: i === 0 })),
  }] };
  const element = await fixture<PreparedLite>(html`<lr-lite-chart scale="logarithmic" without-zero-baseline style="width:600px" .preparedData=${prepared}></lr-lite-chart>`);
  await waitUntil(() => legacy.shadowRoot!.querySelectorAll('[part="bar"]').length === 4 && element.shadowRoot!.querySelectorAll('[part="bar"]').length === 4);
  const ticks = (chart: LyraLiteChart) => [...chart.shadowRoot!.querySelectorAll('[part="axis-label"]')].map(label => label.textContent!.trim()).filter(Boolean);
  expect(ticks(element)).to.deep.equal(ticks(legacy));
  expect(ticks(element)).to.include('10');
});

it('preserves exact-reader receivers and endpoint refinement requests without accumulating overlays', async () => {
  const calls: unknown[] = [];
  const source: LyraPreparedSeriesData = { kind: 'series', revision: 'receiver',
    series: [{ id: 's', label: 'Signal', counts: { sourceCount: 1000, validCount: 1000, invalidCount: 0 },
      xDomain: { min: 0, max: 999 }, yDomain: { min: 0, max: 999 },
      samples: [{ x: 0, y: 0, sourceIndex: 0, breakBefore: true }, { x: 999, y: 999, sourceIndex: 999, breakBefore: false }],
    }],
    getPoint(ref, request) {
      calls.push(['point', this === source, ref.seriesId, ref.sourceIndex, request.signal.aborted]);
      return { x: ref.sourceIndex, y: ref.sourceIndex };
    },
    queryRange(request) {
      calls.push(['range', this === source, request.seriesId, request.startIndex, request.endIndex, request.maxPoints, request.signal.aborted]);
      return [{ x: request.startIndex, y: request.startIndex, sourceIndex: request.startIndex, breakBefore: true }];
    },
  };
  const element: PreparedLite = await mount(source);
  element.maxRecords = 9;
  await element.updateComplete;
  for (const index of [0, 500, 999]) {
    expect(await element.revealSourcePoint({ seriesId: 's', sourceIndex: index })).to.equal(true);
    await element.updateComplete;
  }
  expect(calls).to.deep.equal([
    ['point', true, 's', 0, false], ['range', true, 's', 0, 5, 4, false],
    ['point', true, 's', 500, false], ['range', true, 's', 496, 505, 4, false],
    ['point', true, 's', 999, false], ['range', true, 's', 995, 1000, 4, false],
  ]);
  const seam = element as unknown as { preparedModel: { peerCount: number; series: readonly { samples: readonly ({ sourceIndex: number } | null)[] }[] } };
  expect(seam.preparedModel.series[0]!.samples.map(point => point?.sourceIndex ?? null)).to.deep.equal([995, null, 999]);
  expect(seam.preparedModel.peerCount).to.equal(3);
});
