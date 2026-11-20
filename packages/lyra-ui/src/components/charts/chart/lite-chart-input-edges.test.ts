import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-lite-chart.js';
import type { LyraLiteChart } from './lite-chart.class.js';
import type { LyraChartFormatter, LyraChartFormatterContext } from './chart.class.js';
import type { LyraPreparedSeriesData } from '../../../utilities/data-preparation.js';

type PreparedLite = LyraLiteChart & { preparedData: LyraPreparedSeriesData | null };

function revoked(): unknown {
  const { proxy, revoke } = Proxy.revocable([], {});
  revoke();
  return proxy;
}

async function settle(el: LyraLiteChart): Promise<void> {
  await waitUntil(() => {
    const chart = el as unknown as { plotWidth: number; plotHeight: number };
    return chart.plotWidth > 0 && chart.plotHeight > 0;
  }, 'plot never measured');
  await el.updateComplete;
}

async function mount(template: ReturnType<typeof html>): Promise<LyraLiteChart> {
  const el = await fixture<LyraLiteChart>(template);
  await settle(el);
  return el;
}

const marks = (el: LyraLiteChart) => el.shadowRoot!.querySelectorAll('[part="bar"], [part="point"]').length;

describe('lr-lite-chart unreadable and ragged inputs', () => {
  it('normalizes an unreadable datasets collection to no series', async () => {
    const el = await mount(html`<lr-lite-chart style="width:300px" .labels=${['A']} .datasets=${[{ label: 'S', data: [1] }]}></lr-lite-chart>`);
    expect(marks(el)).to.equal(1);
    el.datasets = revoked() as never;
    await el.updateComplete;
    expect(el.datasets).to.deep.equal([]);
    expect(Object.isFrozen(el.datasets)).to.equal(true);
    expect(marks(el)).to.equal(0);
  });

  it('appendData pads categories that had data but no label with empty labels', async () => {
    const el = await mount(html`<lr-lite-chart style="width:300px" .labels=${['A']} .datasets=${[{ label: 'S', data: [1, 2, 3] }]}></lr-lite-chart>`);
    el.appendData('D', [4]);
    await el.updateComplete;
    expect(el.labels).to.deep.equal(['A', '', '', 'D']);
    expect(el.datasets[0]!.data).to.deep.equal([1, 2, 3, 4]);
  });

  it('keeps a fixed bar slot finite when there are no categories yet', async () => {
    const el = await mount(html`<lr-lite-chart type="bar" style="width:300px" bar-slot-width="40" .labels=${[]} .datasets=${[]}></lr-lite-chart>`);
    expect(marks(el)).to.equal(0);
    el.labels = ['A', 'B'];
    el.datasets = [{ label: 'S', data: [1, 2] }];
    await el.updateComplete;
    const bars = [...el.shadowRoot!.querySelectorAll<SVGRectElement>('[part="bar"]')].map((bar) => Number(bar.getAttribute('x')));
    expect(bars).to.have.length(2);
    expect(bars[1]! - bars[0]!).to.be.closeTo(40, 0.5);
  });
});

describe('lr-lite-chart prepared series edges', () => {
  function prepared(): LyraPreparedSeriesData {
    return {
      kind: 'series', revision: 'r1', getPoint: (ref) => ({ x: ref.sourceIndex, y: 1 }),
      series: [
        { id: 'flat', label: 'Flat', counts: { sourceCount: 1, validCount: 1, invalidCount: 0 },
          xDomain: { min: 5, max: 5 }, yDomain: { min: 3, max: 3 },
          samples: [{ x: 5, y: 3, sourceIndex: 0, breakBefore: true }] },
        { id: 'falling', label: 'Falling', counts: { sourceCount: 3, validCount: 2, invalidCount: 1 },
          xDomain: { min: 5, max: 5 }, yDomain: { min: 1, max: 4 },
          samples: [{ x: 5, y: 4, sourceIndex: 0, breakBefore: true }, { x: 5, y: 1, sourceIndex: 2, breakBefore: false }] },
      ],
    } as LyraPreparedSeriesData;
  }

  it('centers a zero-width x domain, describes flat and falling series, and ignores appendData', async () => {
    const el = await fixture<PreparedLite>(html`<lr-lite-chart type="line" style="width:400px" .preparedData=${prepared()}></lr-lite-chart>`);
    await settle(el);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="point"]').length === 3, 'three prepared points render');
    const description = el.shadowRoot!.querySelector('[part="description"]')!.textContent!;
    expect(description).to.match(/flat/i);
    expect(description).to.match(/decreas/i);
    const svg = el.shadowRoot!.querySelector('svg')!;
    const xs = [...el.shadowRoot!.querySelectorAll('[part="point"]')].map((point) => Number(point.getAttribute('cx')));
    const width = Number(svg.getAttribute('width') ?? svg.getBoundingClientRect().width);
    for (const x of xs) {
      expect(x).to.be.greaterThan(width * 0.25);
      expect(x).to.be.lessThan(width * 0.75);
    }

    const labels = el.labels;
    el.appendData('ignored', [1]);
    expect(el.labels).to.equal(labels);
    expect(el.datasets).to.deep.equal([]);
  });

  it('exports prepared observations through the formatter, falling back to the raw value', async () => {
    const el = await fixture<PreparedLite>(html`<lr-lite-chart type="line" style="width:400px" .preparedData=${prepared()}></lr-lite-chart>`);
    await settle(el);
    await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="point"]').length === 3, 'three prepared points render');
    const contexts: LyraChartFormatterContext[] = [];
    // An untyped consumer may return nothing for a value.
    el.formatter = ((context: LyraChartFormatterContext) => {
      contexts.push(context);
      return context.datasetIndex === 0 ? `~${context.value}` : undefined;
    }) as LyraChartFormatter;
    const rows = el.exportData('csv').split('\r\n');
    expect(rows).to.have.length(4);
    expect(rows[1]).to.include('~3');
    expect(contexts.filter((context) => context.surface === 'export').map((context) => context.seriesLabel)).to.deep.equal(['Flat', 'Falling', 'Falling']);
    el.formatter = (() => undefined) as unknown as LyraChartFormatter;
    expect(el.exportData('csv').split('\r\n')[1]!.endsWith(',3,')).to.equal(true);
    el.formatter = undefined;
    expect(el.exportData('csv').split('\r\n')[1]!.endsWith(',3,')).to.equal(true);
  });
});

describe('lr-lite-chart retained marks and measured labels', () => {
  it('a bar retained after the chart is removed no longer activates', async () => {
    const el = await mount(html`<lr-lite-chart type="bar" style="width:300px" .labels=${['A', 'B']} .datasets=${[{ label: 'S', data: [1, 2] }]}></lr-lite-chart>`);
    const activations: unknown[] = [];
    el.addEventListener('lr-datum-activate', (event) => activations.push((event as CustomEvent).detail));
    const bar = el.shadowRoot!.querySelector<SVGElement>('[part="bar"]')!;
    bar.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(activations).to.have.length(1);
    el.remove();
    bar.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    expect(activations).to.have.length(1);
  });

  it('a keyboard move whose target mark disappears before rendering keeps one valid tab stop', async () => {
    const el = await mount(html`<lr-lite-chart type="bar" style="width:300px" .labels=${['A', 'B', 'C', 'D']} .datasets=${[{ label: 'S', data: [1, 2, 3, 4] }]}></lr-lite-chart>`);
    const first = el.shadowRoot!.querySelector<SVGElement>('[part="bar"]')!;
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
    await el.updateComplete;
    const marks = () => [...el.shadowRoot!.querySelectorAll<SVGElement>('[part="bar"]')];
    expect(marks()[1]!.getAttribute('tabindex')).to.equal('0');
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true, cancelable: true }));
    // The data shrinks in the same task, before the queued focus move renders.
    el.labels = ['A'];
    el.datasets = [{ label: 'S', data: [1] }];
    await el.updateComplete;
    await el.updateComplete;
    expect(marks()).to.have.length(1);
    // The sole surviving mark stays the roving tab stop.
    expect(marks()[0]!.getAttribute('tabindex')).to.equal('0');
  });

  it('never truncates a category label between the halves of a surrogate pair', async () => {
    const labels = Array.from({ length: 6 }, (_, index) => `${'x'.repeat(index)}${'\u{1F600}'.repeat(12)}`);
    const datasets = [{ label: 'S', data: labels.map((_, index) => index + 1) }];
    for (const width of [240, 260, 280, 300, 320, 340]) {
      const el = await mount(html`<lr-lite-chart type="bar" style=${`width:${width}px`} .labels=${labels} .datasets=${datasets}></lr-lite-chart>`);
      await waitUntil(() => [...el.shadowRoot!.querySelectorAll('[part="axis-label"]')].some((tick) => tick.textContent!.includes('…')),
        'labels were never truncated');
      for (const tick of el.shadowRoot!.querySelectorAll('[part="axis-label"]')) {
        const text = tick.textContent!.trim();
        if (!text.endsWith('…')) continue;
        const before = text.charCodeAt(text.length - 2);
        expect(before >= 0xd800 && before <= 0xdbff, `width ${width}: ${JSON.stringify(text)}`).to.equal(false);
      }
      el.remove();
    }
  });
});
