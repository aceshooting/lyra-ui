import { expect, fixture, html } from '@open-wc/testing';
import './heatmap.js';
import type { LyraHeatmap } from './heatmap.js';

const data = {
  kind: 'matrix' as const,
  rowLabels: ['Monday', 'Tuesday'],
  colLabels: ['Morning', 'Evening'],
  values: [
    [1, 2],
    [3, 4],
  ],
};
const steps = ['#101010', '#202020', '#303030'];

/** Never hands chai a live node: the assertion payload is a boolean plus a message. */
function hasPart(el: LyraHeatmap, part: string): boolean {
  return el.shadowRoot!.querySelector(`[part~="${part}"]`) !== null;
}
function countPart(el: LyraHeatmap, selector: string): number {
  return el.shadowRoot!.querySelectorAll(selector).length;
}
function gradient(el: LyraHeatmap): string {
  return el.style.getPropertyValue('--lr-heatmap-color-steps-gradient');
}

describe('lr-heatmap withoutLegend', () => {
  it('renders the legend row by default', async () => {
    const el = (await fixture(
      html`<lr-heatmap .data=${data} .colorSteps=${steps}></lr-heatmap>`,
    )) as LyraHeatmap;
    expect(el.withoutLegend, 'withoutLegend defaults to false').to.equal(false);
    expect(hasPart(el, 'legend'), 'the legend row renders by default').to.equal(true);
    expect(hasPart(el, 'legend-value-label'), 'the value-label caption renders').to.equal(true);
    expect(countPart(el, 'slot[name="legend"]'), 'the legend slot renders').to.equal(1);
  });

  it('removes the legend row from the DOM entirely, slot included', async () => {
    const el = (await fixture(html`<lr-heatmap
      without-legend
      .data=${data}
      .colorSteps=${steps}
    ><span slot="legend" id="custom">Custom key</span></lr-heatmap>`)) as LyraHeatmap;

    expect(hasPart(el, 'legend'), 'no legend row is rendered').to.equal(false);
    expect(hasPart(el, 'legend-lo'), 'no gradient endpoint is rendered').to.equal(false);
    expect(hasPart(el, 'legend-hi'), 'no gradient endpoint is rendered').to.equal(false);
    expect(hasPart(el, 'legend-value-label'), 'no value-label caption is rendered').to.equal(false);
    expect(countPart(el, 'slot[name="legend"]'), 'no legend slot is rendered').to.equal(0);
    const slotted = el.querySelector('#custom') as HTMLElement;
    expect(slotted.assignedSlot === null, 'slotted legend content is unassigned').to.equal(true);
    expect(hasPart(el, 'canvas'), 'the heatmap canvas still renders').to.equal(true);
  });

  it('reflects to the without-legend attribute', async () => {
    const el = (await fixture(
      html`<lr-heatmap .data=${data}></lr-heatmap>`,
    )) as LyraHeatmap;
    el.withoutLegend = true;
    await el.updateComplete;
    expect(el.hasAttribute('without-legend'), 'the property reflects').to.equal(true);
  });

  it('stops the legend-only colour-ramp gradient write while hidden', async () => {
    const el = (await fixture(
      html`<lr-heatmap .data=${data} .colorSteps=${steps}></lr-heatmap>`,
    )) as LyraHeatmap;
    expect(gradient(el).includes('linear-gradient'), 'the legend bar gradient is written').to.equal(
      true,
    );

    el.withoutLegend = true;
    await el.updateComplete;
    expect(gradient(el), 'hiding the legend stops its gradient work').to.equal('');
  });

  it('restores the legend, its slot and its gradient when withoutLegend is unset again', async () => {
    const el = (await fixture(html`<lr-heatmap
      without-legend
      .data=${data}
      .colorSteps=${steps}
    ><span slot="legend" id="custom">Custom key</span></lr-heatmap>`)) as LyraHeatmap;
    el.withoutLegend = false;
    await el.updateComplete;

    expect(hasPart(el, 'legend'), 'the legend row comes back').to.equal(true);
    expect(countPart(el, 'slot[name="legend"]'), 'the legend slot comes back').to.equal(1);
    const slotted = el.querySelector('#custom') as HTMLElement;
    expect(slotted.assignedSlot !== null, 'slotted legend content is assigned again').to.equal(true);
    expect(gradient(el).includes('linear-gradient'), 'the gradient write resumes').to.equal(true);
  });

  it('keeps the legend hidden across a disconnect and reconnect', async () => {
    const el = (await fixture(
      html`<lr-heatmap without-legend .data=${data}></lr-heatmap>`,
    )) as LyraHeatmap;
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect(hasPart(el, 'legend'), 'no legend row after reconnect').to.equal(false);
  });

  it('hides the legend under dir="rtl" too, leaving the accessible summary intact', async () => {
    const el = (await fixture(html`<div dir="rtl">
      <lr-heatmap without-legend value-label="requests" .data=${data}></lr-heatmap>
    </div>`)).querySelector('lr-heatmap') as LyraHeatmap;
    await el.updateComplete;
    expect(
      (el as unknown as { readonly effectiveDirection: string }).effectiveDirection,
      'the heatmap resolves RTL',
    ).to.equal('rtl');
    expect(hasPart(el, 'legend'), 'no legend row under RTL').to.equal(false);
    expect(
      (el.getAttribute('aria-label') ?? '').includes('requests'),
      'the generated summary still names the value label',
    ).to.equal(true);
  });

  it('renders a .strings override in the legend caption, and nothing at all when hidden', async () => {
    const shown = (await fixture(html`<lr-heatmap
      .strings=${{ heatmapValueLabel: 'valeur' }}
      .data=${data}
    ></lr-heatmap>`)) as LyraHeatmap;
    expect(
      shown.shadowRoot!.querySelector('[part="legend-value-label"]')?.textContent,
      'the override reaches the legend caption',
    ).to.equal('valeur');

    const hidden = (await fixture(html`<lr-heatmap
      without-legend
      .strings=${{ heatmapValueLabel: 'valeur' }}
      .data=${data}
    ></lr-heatmap>`)) as LyraHeatmap;
    expect(hasPart(hidden, 'legend-value-label'), 'nothing renders the caption').to.equal(false);
  });

  it('stays accessible with a populated matrix and no legend', async () => {
    const el = (await fixture(
      html`<lr-heatmap without-legend .data=${data} .colorSteps=${steps}></lr-heatmap>`,
    )) as LyraHeatmap;
    await expect(el).to.be.accessible();
  });
});
