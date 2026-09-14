import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './lite-chart.js';
import type { LyraLiteChart } from './lite-chart.js';

const LABELS = ['Jan', 'Feb', 'Mar', 'Apr'];
const DATASETS = [{ label: 'Revenue', data: [1, 2, 3, 4] }];
// Two series so the built-in accessible TABLE renders; one series renders the `data-list` instead.
const PAIR = [
  { label: 'Revenue', data: [1, 2, 3, 4] },
  { label: 'Cost', data: [2, 3, 4, 5] },
];

async function mount(tpl: ReturnType<typeof html>): Promise<LyraLiteChart> {
  const el = (await fixture(tpl)) as LyraLiteChart;
  await waitUntil(() => {
    const chart = el as unknown as { plotWidth: number; plotHeight: number };
    return (
      !el.ownerDocument.defaultView?.ResizeObserver ||
      (chart.plotWidth > 0 && chart.plotHeight > 0)
    );
  });
  await el.updateComplete;
  return el;
}
/** Category ticks only — the value-axis ticks are the ones carrying `dominant-baseline`. */
function categoryTicks(el: LyraLiteChart): SVGTextElement[] {
  return [
    ...el.shadowRoot!.querySelectorAll<SVGTextElement>('[part="axis-label"]'),
  ].filter((label) => !label.hasAttribute('dominant-baseline'));
}
function tickTexts(el: LyraLiteChart): (string | null)[] {
  return categoryTicks(el).map((tick) => tick.textContent);
}
function tableRowHeaders(el: LyraLiteChart): (string | undefined)[] {
  return [...el.shadowRoot!.querySelectorAll('table tbody th')].map(
    (cell) => cell.textContent?.trim(),
  );
}

describe('lr-lite-chart axisLabelText', () => {
  it('renders every source label as its own tick when unset', async () => {
    const el = await mount(html`<lr-lite-chart
      type="bar"
      show-data-table
      .labels=${LABELS}
      .datasets=${DATASETS}
    ></lr-lite-chart>`);
    expect(el.axisLabelText, 'the callback is opt-in').to.equal(undefined);
    expect(tickTexts(el), 'every category renders its own tick').to.deep.equal(LABELS);
  });

  it('overrides the rendered tick text without touching the data source', async () => {
    const el = await mount(html`<lr-lite-chart
      type="bar"
      show-data-table
      .labels=${LABELS}
      .datasets=${PAIR}
      .axisLabelText=${(label: string, index: number) => `${index}:${label}`}
    ></lr-lite-chart>`);

    expect(tickTexts(el), 'the callback owns the tick text').to.deep.equal([
      '0:Jan',
      '1:Feb',
      '2:Mar',
      '3:Apr',
    ]);
    expect(el.labels, 'the labels array is untouched').to.deep.equal(LABELS);
    expect(tableRowHeaders(el), 'the accessible table keeps the real labels').to.deep.equal(
      LABELS,
    );
  });

  it('renders no tick at all for a category the callback blanks with null', async () => {
    const el = await mount(html`<lr-lite-chart
      type="bar"
      show-data-table
      .labels=${LABELS}
      .datasets=${PAIR}
      .axisLabelText=${(label: string, index: number) => (index % 2 === 0 ? label : null)}
    ></lr-lite-chart>`);

    expect(tickTexts(el), 'only the kept categories render ticks').to.deep.equal(['Jan', 'Mar']);
    expect(
      el.shadowRoot!.querySelectorAll('[part="bar"]').length,
      'every bar still renders',
    ).to.equal(8);
    expect(tableRowHeaders(el), 'the accessible table keeps every label').to.deep.equal(LABELS);
  });

  it('falls back to the source label when the callback returns a non-string', async () => {
    const el = await mount(html`<lr-lite-chart
      type="bar"
      .labels=${LABELS}
      .datasets=${DATASETS}
      .axisLabelText=${(() => 42) as unknown as (label: string, index: number) => string | null}
    ></lr-lite-chart>`);
    expect(tickTexts(el), 'a hostile return value never reaches the DOM').to.deep.equal(LABELS);
  });

  it('clips an overlong override the same way a source label is clipped', async () => {
    const el = await mount(html`<lr-lite-chart
      type="bar"
      style="inline-size: 240px"
      .labels=${LABELS}
      .datasets=${DATASETS}
      .axisLabelText=${() => 'an extremely long replacement tick label'}
    ></lr-lite-chart>`);
    const first = categoryTicks(el)[0]!;
    expect(
      (first.textContent ?? '').length < 'an extremely long replacement tick label'.length,
      'the override is ellipsized to its own slot',
    ).to.equal(true);
    expect(
      first.getAttribute('aria-label'),
      'the clipped tick still exposes its full text',
    ).to.equal('an extremely long replacement tick label');
  });

  it('applies under dir="rtl" without changing category order', async () => {
    const wrapper = await fixture(html`<div dir="rtl">
      <lr-lite-chart
        type="bar"
        .labels=${LABELS}
        .datasets=${DATASETS}
        .axisLabelText=${(label: string) => label.toUpperCase()}
      ></lr-lite-chart>
    </div>`);
    const el = wrapper.querySelector('lr-lite-chart') as LyraLiteChart;
    await waitUntil(() => {
      const chart = el as unknown as { plotWidth: number; plotHeight: number };
      return (
        !el.ownerDocument.defaultView?.ResizeObserver ||
        (chart.plotWidth > 0 && chart.plotHeight > 0)
      );
    });
    await el.updateComplete;
    expect(
      (el as unknown as { readonly effectiveDirection: string }).effectiveDirection,
      'the chart resolves RTL',
    ).to.equal('rtl');
    expect(tickTexts(el), 'the override applies in source order').to.deep.equal([
      'JAN',
      'FEB',
      'MAR',
      'APR',
    ]);
  });

  it('restores the source labels when the callback is unset again', async () => {
    const el = await mount(html`<lr-lite-chart
      type="bar"
      .labels=${LABELS}
      .datasets=${DATASETS}
      .axisLabelText=${() => null}
    ></lr-lite-chart>`);
    expect(tickTexts(el), 'every tick starts blanked').to.deep.equal([]);
    el.axisLabelText = undefined;
    await el.updateComplete;
    expect(tickTexts(el), 'unsetting the callback restores every tick').to.deep.equal(LABELS);
  });

  it('stays accessible with a populated chart and blanked ticks', async () => {
    const el = await mount(html`<lr-lite-chart
      type="bar"
      label="Revenue by month"
      .labels=${LABELS}
      .datasets=${DATASETS}
      .axisLabelText=${(label: string, index: number) => (index === 0 ? label : null)}
    ></lr-lite-chart>`);
    await expect(el).to.be.accessible();
  });
});
