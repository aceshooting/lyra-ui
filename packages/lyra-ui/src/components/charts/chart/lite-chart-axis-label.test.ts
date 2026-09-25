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

describe('lr-lite-chart sparse category ticks', () => {
  // Sixteen weekly categories with one short month name every four weeks: at a 240px host the
  // derived slot is ~12px, far too narrow for a three-letter month on its own.
  const WEEKS = Array.from({ length: 16 }, (_, index) => `Week ${index + 1}`);
  const WEEK_DATA = [{ label: 'Visits', data: WEEKS.map((_, index) => index + 1) }];
  const MONTH_AT: Readonly<Record<number, string>> = { 1: 'Oct', 5: 'Nov', 9: 'Dec', 13: 'Jan' };
  const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan'];

  function labelledTicks(el: LyraLiteChart): SVGTextElement[] {
    return categoryTicks(el).filter((tick) => (tick.getAttribute('data-full-label') ?? '') !== '');
  }
  /** Client-space horizontal geometry box (not Gecko's padded ink rect) of a tick. */
  function horizontalBox(tick: SVGTextElement): { left: number; right: number } {
    const box = tick.getBBox();
    const ctm = tick.getScreenCTM()!;
    return { left: ctm.a * box.x + ctm.e, right: ctm.a * (box.x + box.width) + ctm.e };
  }
  function expectNoOverlap(ticks: SVGTextElement[]): void {
    const boxes = ticks.map(horizontalBox).sort((a, b) => a.left - b.left);
    for (let index = 1; index < boxes.length; index++) {
      expect(boxes[index]!.left, `tick ${index} starts after its neighbor ends`).to.be.at.least(
        boxes[index - 1]!.right - 0.01,
      );
    }
  }

  for (const layout of ['fit', 'scroll'] as const) {
    it(`lets a lone label use its empty neighbors' slots in layout="${layout}"`, async () => {
      const el = await mount(html`<lr-lite-chart
        type="bar"
        layout=${layout}
        bar-width="12"
        style="inline-size: 240px"
        .labels=${WEEKS}
        .datasets=${WEEK_DATA}
        .axisLabelText=${(_label: string, index: number) => MONTH_AT[index] ?? ''}
      ></lr-lite-chart>`);
      const ticks = labelledTicks(el);
      expect(ticks.map((tick) => tick.textContent), 'no month name is ellipsized').to.deep.equal(MONTHS);
      expect(
        ticks.every((tick) => !tick.hasAttribute('aria-label')),
        'an unclipped tick carries no duplicate accessible name',
      ).to.equal(true);
      expectNoOverlap(ticks);
    });
  }

  it('treats an empty source label like an empty override', async () => {
    const el = await mount(html`<lr-lite-chart
      type="bar"
      style="inline-size: 240px"
      .labels=${WEEKS.map((_, index) => MONTH_AT[index] ?? '')}
      .datasets=${WEEK_DATA}
    ></lr-lite-chart>`);
    expect(labelledTicks(el).map((tick) => tick.textContent)).to.deep.equal(MONTHS);
  });

  it('sizes the pre-layout estimate from the empty neighbors too', async () => {
    // A hidden scroll chart renders without layout, so only the character-count estimate applies.
    const wrapper = await fixture(html`<div style="display: none">
      <lr-lite-chart
        type="bar"
        layout="scroll"
        bar-width="12"
        .labels=${WEEKS}
        .datasets=${WEEK_DATA}
        .axisLabelText=${(_label: string, index: number) => MONTH_AT[index] ?? ''}
      ></lr-lite-chart>
    </div>`);
    const el = wrapper.querySelector('lr-lite-chart') as LyraLiteChart;
    await el.updateComplete;
    const ticks = labelledTicks(el);
    expect(ticks.map((tick) => tick.textContent)).to.deep.equal(MONTHS);
    // Half the four-slot gap to each labelled neighbor, both sides, minus the 4px margin.
    expect(Number(ticks[1]!.getAttribute('data-label-extent'))).to.be.closeTo(4 * 12 - 4, 0.001);
  });

  it('never grows a lone label into a labelled neighbor slot and leaves labelled neighbors unchanged', async () => {
    const LONG = Array.from({ length: 12 }, (_, index) => `Category ${index + 1}`);
    const data = [{ label: 'S', data: LONG.map((_, index) => index + 1) }];
    const full = await mount(html`<lr-lite-chart
      type="bar"
      style="inline-size: 360px"
      .labels=${LONG}
      .datasets=${data}
    ></lr-lite-chart>`);
    const sparse = await mount(html`<lr-lite-chart
      type="bar"
      style="inline-size: 360px"
      .labels=${LONG}
      .datasets=${data}
      .axisLabelText=${(label: string, index: number) => (index === 7 || index === 9 ? '' : label)}
    ></lr-lite-chart>`);
    const fullTicks = categoryTicks(full);
    const sparseTicks = categoryTicks(sparse);
    const snapshot = (tick: SVGTextElement) =>
      [tick.textContent, tick.getAttribute('data-label-extent'), tick.getAttribute('aria-label')].join('|');
    // Ticks 0..5 and 11 have only labelled neighbors; 6 and 10 each have a labelled neighbor on
    // one side, so their symmetric extent is still bounded by that side -- all ellipsized exactly
    // as before.
    for (const index of [0, 1, 2, 3, 4, 5, 11]) {
      expect(snapshot(sparseTicks[index]!), `tick ${index}`).to.equal(snapshot(fullTicks[index]!));
    }
    // The one-sided ticks resolve the same bound from a differently-summed gap, so only
    // floating-point noise may differ in the extent; the painted text must not.
    const textOf = (tick: SVGTextElement) => [tick.textContent, tick.getAttribute('aria-label')].join('|');
    for (const index of [6, 10]) {
      expect(textOf(sparseTicks[index]!), `tick ${index}`).to.equal(textOf(fullTicks[index]!));
      expect(Number(sparseTicks[index]!.getAttribute('data-label-extent')), `tick ${index} extent`).to.be.closeTo(
        Number(fullTicks[index]!.getAttribute('data-label-extent')),
        1e-9,
      );
    }
    // Tick 8 sits between two empty ticks and gains their room on both sides.
    expect(Number(sparseTicks[8]!.getAttribute('data-label-extent'))).to.be.greaterThan(
      Number(fullTicks[8]!.getAttribute('data-label-extent')) * 1.5,
    );
    expect((sparseTicks[8]!.textContent ?? '').length).to.be.greaterThan(
      (fullTicks[8]!.textContent ?? '').length,
    );
    expectNoOverlap(sparseTicks.filter((tick) => tick.textContent !== ''));
  });
});
