import { expect, fixture, html } from '@open-wc/testing';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import type { LyraCategoryBar } from './category-bar.class.js';
import '../../lr-category-bar.js';

function parts(el: LyraCategoryBar, name: string): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>(`[part~="${name}"]`)];
}

function part(el: LyraCategoryBar, name: string): HTMLElement | null {
  return el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
}

function text(node: Element | null | undefined): string {
  return (node?.textContent ?? '').replace(/[  \s]+/g, ' ').trim();
}

/** Every rendered element's tag, attributes (style via its CSSOM serialization, which does not
 *  depend on whether the declaration arrived as attribute text or a property write) and leaf text,
 *  so two renders compare without Lit's per-render marker comments. */
function renderProjection(el: LyraCategoryBar): string[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('*')]
    .filter((node) => node.localName !== 'style')
    .map((node) => {
      const attributes = [...node.attributes]
        .map((attribute) => (attribute.name === 'style' ? `style=${node.style.cssText}` : `${attribute.name}=${attribute.value}`))
        .sort();
      return `${node.localName}[${attributes.join('|')}]${node.childElementCount === 0 ? text(node) : ''}`;
    });
}

expectLocaleFallback('de-DE', ['chart', 'categoryBarMarker']);

describe('<lr-category-bar>', () => {
  it('draws consecutive ranges and names the range the marker falls in, accessibly', async () => {
    const el = await fixture<LyraCategoryBar>(
      html`<lr-category-bar
        label="Credit score"
        marker="62"
        .values=${[40, 30, 30]}
        .variants=${['danger', 'warning', 'success']}
      ></lr-category-bar>`,
    );
    const base = part(el, 'base')!;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('Credit score');
    expect(parts(el, 'range').map((range) => range.style.inlineSize)).to.deep.equal(['40%', '30%', '30%']);
    expect(part(el, 'marker')!.style.insetInlineStart).to.equal('62%');
    expect(text(part(el, 'description'))).to.equal('Marker: 62, range 40 to 70');
    expect(el.shadowRoot!.querySelector('.graphic')!.getAttribute('aria-hidden')).to.equal('true');
    await expect(el).to.be.accessible();
  });

  it('lists every range when there is no marker, skipping zero and invalid widths', async () => {
    const el = await fixture<LyraCategoryBar>(
      html`<lr-category-bar .values=${[10, 0, Number.NaN, -5, 15]}></lr-category-bar>`,
    );
    expect(part(el, 'marker') === null).to.equal(true);
    expect(parts(el, 'range')).to.have.lengthOf(2);
    expect(text(part(el, 'description'))).to.equal('0 to 10, 10 to 25');
  });

  it('assigns a marker on a boundary to the next range and pins an off-scale marker to the nearer end', async () => {
    const el = await fixture<LyraCategoryBar>(html`<lr-category-bar marker="40" .values=${[40, 30, 30]}></lr-category-bar>`);
    expect(text(part(el, 'description'))).to.equal('Marker: 40, range 40 to 70');

    el.marker = 140;
    await el.updateComplete;
    expect(part(el, 'marker')!.style.insetInlineStart).to.equal('100%');
    expect(text(part(el, 'description'))).to.equal('Marker: 140, range 70 to 100');

    el.marker = -3;
    await el.updateComplete;
    expect(part(el, 'marker')!.style.insetInlineStart).to.equal('0%');
    expect(text(part(el, 'description'))).to.equal('Marker: -3, range 0 to 40');

    el.setAttribute('marker', '');
    await el.updateComplete;
    expect(el.marker).to.equal(undefined);
    expect(part(el, 'marker') === null).to.equal(true);
  });

  it('shows boundary values with with-labels and colors ranges from variants or the chart palette', async () => {
    const el = await fixture<LyraCategoryBar>(
      html`<lr-category-bar with-labels .values=${[25, 25, 50]} .variants=${['success']}></lr-category-bar>`,
    );
    expect(parts(el, 'range-label').map(text)).to.deep.equal(['0', '25', '50', '100']);
    expect(part(el, 'labels')!.getAttribute('aria-hidden')).to.equal('true');
    const [first, second] = parts(el, 'range');
    expect(first!.style.getPropertyValue('--_lr-category-bar-color')).to.equal('var(--lr-color-success-fill-loud)');
    expect(second!.style.getPropertyValue('--_lr-category-bar-color')).to.equal('var(--lr-color-chart-2)');
    expect(getComputedStyle(first!).backgroundColor).to.not.equal(getComputedStyle(second!).backgroundColor);
    await expect(el).to.be.accessible();
  });

  it('formats numbers in the effective locale and honors a .strings override', async () => {
    const el = await fixture<LyraCategoryBar>(
      html`<lr-category-bar lang="de-DE" marker="1500.5" .values=${[1000, 1000]}></lr-category-bar>`,
    );
    expect(text(part(el, 'description'))).to.equal('Marker: 1.500,5, range 1.000 to 2.000');

    el.strings = { categoryBarMarker: 'Repère {value} ({start}–{end})' };
    await el.updateComplete;
    expect(text(part(el, 'description'))).to.equal('Repère 1.500,5 (1.000–2.000)');
  });

  it('names the group from a host aria-label first and renders a localized empty state', async () => {
    const el = await fixture<LyraCategoryBar>(html`<lr-category-bar label="Score" .values=${[1, 2]}></lr-category-bar>`);
    el.setAttribute('aria-label', 'Risk');
    await el.updateComplete;
    expect(part(el, 'base')!.getAttribute('aria-label')).to.equal('Risk');

    el.values = [0, Number.POSITIVE_INFINITY];
    await el.updateComplete;
    expect(text(part(el, 'empty'))).to.equal('No data');
    expect(part(el, 'bar') === null).to.equal(true);
  });

  it('places the marker from the inline start under RTL', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      html`<div dir="rtl" style="inline-size: 400px"><lr-category-bar marker="25" .values=${[50, 50]}></lr-category-bar></div>`,
    );
    const el = wrapper.querySelector('lr-category-bar') as LyraCategoryBar;
    await el.updateComplete;
    const bar = part(el, 'bar')!.getBoundingClientRect();
    const marker = part(el, 'marker')!.getBoundingClientRect();
    const center = marker.left + marker.width / 2;
    expect(Math.abs(center - (bar.right - bar.width * 0.25))).to.be.lessThan(2);
  });

  it('keeps a usable size in a shrink-to-fit allocation and hides inner boundary values when narrow', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="display: grid; place-items: center; inline-size: 320px">
      <lr-category-bar with-labels .values=${[10, 20, 30, 40]}></lr-category-bar>
    </div>`);
    const el = wrapper.querySelector('lr-category-bar') as LyraCategoryBar;
    await el.updateComplete;
    expect(el.getBoundingClientRect().width).to.be.greaterThan(100);
    const labels = parts(el, 'range-label');
    expect(getComputedStyle(labels[0]!).visibility).to.equal('visible');
    expect(getComputedStyle(labels[1]!).visibility).to.equal('hidden');
    expect(getComputedStyle(labels[labels.length - 1]!).visibility).to.equal('visible');
  });

  it('animates the marker and stops under reduced motion', async () => {
    await setReducedMotion('no-preference');
    try {
      const el = await fixture<LyraCategoryBar>(html`<lr-category-bar marker="5" .values=${[10]}></lr-category-bar>`);
      const marker = part(el, 'marker')!;
      expect(getComputedStyle(marker).transitionProperty).to.equal('inset-inline-start');
      await setReducedMotion('reduce');
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      expect(getComputedStyle(marker).transitionDuration).to.equal('0s');
    } finally {
      await setReducedMotion('no-preference');
    }
  });

  describe('valueFormatter', () => {
    const hm = (hours: number): string => `${Math.floor(hours)}:${String(Math.round((hours % 1) * 60)).padStart(2, '0')}`;

    it('formats scale labels and the accessible description, and unset keeps the locale format', async () => {
      const el = await fixture<LyraCategoryBar>(
        html`<lr-category-bar marker="10.5667" with-labels .values=${[8, 4]}></lr-category-bar>`,
      );
      const before = renderProjection(el);
      const plainDescription = text(part(el, 'description'));
      el.valueFormatter = hm;
      await el.updateComplete;
      expect(parts(el, 'range-label').map(text)).to.deep.equal(['0:00', '8:00', '12:00']);
      expect(text(part(el, 'description'))).to.contain('10:34');
      expect(text(part(el, 'description'))).to.not.equal(plainDescription);
      el.valueFormatter = undefined;
      await el.updateComplete;
      expect(renderProjection(el)).to.deep.equal(before);
    });

    it('formats the range list description when there is no marker', async () => {
      const el = await fixture<LyraCategoryBar>(html`<lr-category-bar .values=${[8, 4]} .valueFormatter=${hm}></lr-category-bar>`);
      expect(text(part(el, 'description'))).to.contain('8:00').and.to.contain('12:00');
    });

    it('falls back to the locale format when the formatter throws or returns a non-string', async () => {
      const el = await fixture<LyraCategoryBar>(html`<lr-category-bar with-labels .values=${[10, 20]}></lr-category-bar>`);
      const expected = parts(el, 'range-label').map(text);
      el.valueFormatter = () => {
        throw new Error('boom');
      };
      await el.updateComplete;
      expect(parts(el, 'range-label').map(text)).to.deep.equal(expected);
      el.valueFormatter = (() => 5) as unknown as (value: number) => string;
      await el.updateComplete;
      expect(parts(el, 'range-label').map(text)).to.deep.equal(expected);
    });
  });
});
