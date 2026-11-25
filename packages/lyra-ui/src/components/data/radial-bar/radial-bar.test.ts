import { expect, fixture, html } from '@open-wc/testing';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import type { LyraRadialBar, LyraRadialBarSegment } from './radial-bar.class.js';
import '../../lr-radial-bar.js';

const BROWSERS: LyraRadialBarSegment[] = [
  { label: 'Chrome', value: 275, max: 300 },
  { label: 'Safari', value: 200 },
  { label: 'Firefox', value: 150, variant: 'warning' },
];

function parts(el: LyraRadialBar, name: string): Element[] {
  return [...el.shadowRoot!.querySelectorAll(`[part~="${name}"]`)];
}

function part(el: LyraRadialBar, name: string): HTMLElement | null {
  return el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
}

function text(node: Element | null | undefined): string {
  return (node?.textContent ?? '').replace(/[  \s]+/g, ' ').trim();
}

expectLocaleFallback('de-DE', ['chart', 'radialBarSegment']);

describe('<lr-radial-bar>', () => {
  it('draws one decorative ring per segment and reads as a labeled "label: value of max" list', async () => {
    const el = await fixture<LyraRadialBar>(
      html`<lr-radial-bar label="Visitors" max="400" .segments=${BROWSERS}></lr-radial-bar>`,
    );
    expect(part(el, 'chart')!.getAttribute('aria-hidden')).to.equal('true');
    expect(parts(el, 'track')).to.have.lengthOf(3);
    const list = part(el, 'legend')!;
    expect(list.getAttribute('role')).to.equal('list');
    expect(list.getAttribute('aria-label')).to.equal('Visitors');
    expect(parts(el, 'legend-item').map(text)).to.deep.equal([
      'Chrome: 275 of 300',
      'Safari: 200 of 400',
      'Firefox: 150 of 400',
    ]);
    // Each arc covers its share of a full circle; the segment max wins over the host max.
    expect(parts(el, 'arc').map((arc) => Number.parseFloat(arc.getAttribute('stroke-dasharray')!))).to.deep.equal([
      (275 / 300) * 100,
      50,
      37.5,
    ]);
    await expect(el).to.be.accessible();
  });

  it('keeps the list visually hidden until with-legend, then shows it with swatches', async () => {
    const el = await fixture<LyraRadialBar>(html`<lr-radial-bar .segments=${BROWSERS}></lr-radial-bar>`);
    const legend = part(el, 'legend')!;
    expect(legend.getBoundingClientRect().width).to.be.at.most(1);

    el.withLegend = true;
    await el.updateComplete;
    expect(el.hasAttribute('with-legend')).to.equal(true);
    expect(part(el, 'legend')!.getBoundingClientRect().width).to.be.greaterThan(20);
    expect(parts(el, 'legend-swatch').every((swatch) => swatch.getAttribute('aria-hidden') === 'true')).to.equal(true);
    await expect(el).to.be.accessible();
  });

  it('scales to the largest value without a max, clamps overflow and draws no arc for empty values', async () => {
    const el = await fixture<LyraRadialBar>(
      html`<lr-radial-bar
        .segments=${[
          { label: 'A', value: 50 },
          { label: 'B', value: 100 },
          { label: 'C', value: 0 },
          { label: 'D', value: Number.NaN },
          { label: 'E', value: 500, max: 100 },
        ]}
      ></lr-radial-bar>`,
    );
    expect(parts(el, 'track')).to.have.lengthOf(5);
    expect(parts(el, 'arc').map((arc) => arc.getAttribute('stroke-dasharray'))).to.deep.equal([
      '50 100',
      '100 100',
      '100 100',
    ]);
    expect(text(parts(el, 'legend-item')[3])).to.equal('D: No data');
  });

  it('colors arcs from the variant token or the categorical chart palette', async () => {
    const el = await fixture<LyraRadialBar>(html`<lr-radial-bar .segments=${BROWSERS}></lr-radial-bar>`);
    const arcs = parts(el, 'arc') as SVGElement[];
    expect(arcs[0]!.style.getPropertyValue('--_lr-radial-bar-color')).to.equal('var(--lr-color-chart-1)');
    expect(arcs[2]!.style.getPropertyValue('--_lr-radial-bar-color')).to.equal('var(--lr-color-warning-fill-loud)');
    expect(getComputedStyle(arcs[0]!).stroke).to.not.equal(getComputedStyle(arcs[2]!).stroke);
    expect(getComputedStyle(arcs[0]!).stroke).to.not.equal('none');
  });

  it('formats numbers in the effective locale and honors a .strings override', async () => {
    const el = await fixture<LyraRadialBar>(
      html`<lr-radial-bar lang="de-DE" .segments=${[{ label: 'Umsatz', value: 1250.5, max: 2000 }]}></lr-radial-bar>`,
    );
    expect(text(parts(el, 'legend-item')[0])).to.equal('Umsatz: 1.250,5 of 2.000');

    el.strings = { radialBarSegment: '{label} — {value} sur {max}' };
    await el.updateComplete;
    expect(text(parts(el, 'legend-item')[0])).to.equal('Umsatz — 1.250,5 sur 2.000');
  });

  it('names the list from a host aria-label first and renders a localized empty state', async () => {
    const el = await fixture<LyraRadialBar>(html`<lr-radial-bar label="Visitors" .segments=${BROWSERS}></lr-radial-bar>`);
    el.setAttribute('aria-label', 'Browsers');
    await el.updateComplete;
    expect(part(el, 'legend')!.getAttribute('aria-label')).to.equal('Browsers');

    el.segments = [];
    await el.updateComplete;
    expect(text(part(el, 'empty'))).to.equal('No data');
    expect(part(el, 'chart') === null).to.equal(true);
  });

  it('mirrors the sweep under RTL', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      html`<div dir="rtl"><lr-radial-bar .segments=${BROWSERS}></lr-radial-bar></div>`,
    );
    const el = wrapper.querySelector('lr-radial-bar') as LyraRadialBar;
    await el.updateComplete;
    expect(getComputedStyle(part(el, 'chart')!).transform).to.equal('matrix(-1, 0, 0, 1, 0, 0)');
  });

  it('stacks the legend under the drawing in a narrow and a shrink-to-fit allocation', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="display: grid; place-items: center; inline-size: 320px">
      <lr-radial-bar with-legend .segments=${BROWSERS}></lr-radial-bar>
    </div>`);
    const el = wrapper.querySelector('lr-radial-bar') as LyraRadialBar;
    await el.updateComplete;
    expect(el.getBoundingClientRect().width).to.be.greaterThan(100);
    expect(getComputedStyle(part(el, 'base')!).flexDirection).to.equal('column');
  });

  it('animates arcs and stops under reduced motion', async () => {
    await setReducedMotion('no-preference');
    try {
      const el = await fixture<LyraRadialBar>(html`<lr-radial-bar .segments=${BROWSERS}></lr-radial-bar>`);
      const arc = parts(el, 'arc')[0]!;
      expect(getComputedStyle(arc).transitionProperty).to.equal('stroke-dasharray');
      await setReducedMotion('reduce');
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      expect(getComputedStyle(arc).transitionDuration).to.equal('0s');
    } finally {
      await setReducedMotion('no-preference');
    }
  });
});
