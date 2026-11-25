import { expect, fixture, html } from '@open-wc/testing';
import { expectLocaleFallback } from '../../../../test/expected-locale-fallbacks.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import type { LyraBarList, LyraBarListItem } from './bar-list.class.js';
import '../../lr-bar-list.js';

const PAGES: LyraBarListItem[] = [
  { label: '/pricing', value: 1200 },
  { label: '/home', value: 4800 },
  { label: '/docs', value: 2400, variant: 'success' },
];

function parts(el: LyraBarList, name: string): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>(`[part~="${name}"]`)];
}

function part(el: LyraBarList, name: string): HTMLElement | null {
  return el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`);
}

// Locale formatters use narrow/non-breaking spaces; normalize so assertions read as plain text.
function text(node: Element | null | undefined): string {
  return (node?.textContent ?? '').replace(/[  \s]+/g, ' ').trim();
}

expectLocaleFallback('de-DE', ['chart']);

describe('<lr-bar-list>', () => {
  it('renders a labeled list whose rows read "label value", largest first, and stays accessible', async () => {
    const el = await fixture<LyraBarList>(html`<lr-bar-list label="Top pages" .items=${PAGES}></lr-bar-list>`);
    const list = part(el, 'list')!;
    expect(list.localName).to.equal('ul');
    expect(list.getAttribute('role')).to.equal('list');
    expect(list.getAttribute('aria-label')).to.equal('Top pages');
    expect(parts(el, 'row').map(text)).to.deep.equal(['/home 4,800', '/docs 2,400', '/pricing 1,200']);
    expect(parts(el, 'bar').every((bar) => bar.getAttribute('aria-hidden') === 'true')).to.equal(true);
    expect(parts(el, 'bar').map((bar) => bar.style.inlineSize)).to.deep.equal(['100%', '50%', '25%']);
    await expect(el).to.be.accessible();
  });

  it('sorts ascending, keeps caller order with none, and places missing values last when sorting', async () => {
    const items: LyraBarListItem[] = [...PAGES, { label: '/broken', value: Number.NaN }];
    const el = await fixture<LyraBarList>(html`<lr-bar-list sort="ascending" .items=${items}></lr-bar-list>`);
    expect(parts(el, 'label').map(text)).to.deep.equal(['/pricing', '/docs', '/home', '/broken']);
    expect(text(parts(el, 'value')[3])).to.equal('No data');
    expect(parts(el, 'bar')[3]!.style.inlineSize).to.equal('0%');

    el.sort = 'none';
    await el.updateComplete;
    expect(parts(el, 'label').map(text)).to.deep.equal(['/pricing', '/home', '/docs', '/broken']);
  });

  it('measures bars against max, clamping values above it, and ignores a non-positive max', async () => {
    const el = await fixture<LyraBarList>(html`<lr-bar-list max="9600" .items=${PAGES}></lr-bar-list>`);
    expect(el.max).to.equal(9600);
    expect(parts(el, 'bar').map((bar) => bar.style.inlineSize)).to.deep.equal(['50%', '25%', '12.5%']);

    el.max = 2400;
    await el.updateComplete;
    expect(parts(el, 'bar').map((bar) => bar.style.inlineSize)).to.deep.equal(['100%', '100%', '50%']);

    el.max = -1;
    await el.updateComplete;
    expect(parts(el, 'bar')[0]!.style.inlineSize).to.equal('100%');

    el.setAttribute('max', '');
    await el.updateComplete;
    expect(el.max).to.equal(undefined);
  });

  it('formats values in the effective locale and lets a valueFormatter replace the text', async () => {
    const el = await fixture<LyraBarList>(html`<lr-bar-list lang="de-DE" .items=${PAGES}></lr-bar-list>`);
    expect(parts(el, 'value').map(text)).to.deep.equal(['4.800', '2.400', '1.200']);

    el.valueFormatter = (value) => `${value / 1000}k`;
    await el.updateComplete;
    expect(parts(el, 'value').map(text)).to.deep.equal(['4.8k', '2.4k', '1.2k']);
    expect(el.hasAttribute('value-formatter')).to.equal(false);

    el.valueFormatter = () => {
      throw new Error('boom');
    };
    await el.updateComplete;
    expect(parts(el, 'value').map(text)).to.deep.equal(['4.800', '2.400', '1.200']);
  });

  it('paints a variant bar from its own semantic fill', async () => {
    const el = await fixture<LyraBarList>(html`<lr-bar-list .items=${PAGES}></lr-bar-list>`);
    const [home, docs] = parts(el, 'bar');
    expect(docs!.dataset['variant']).to.equal('success');
    expect(home!.hasAttribute('data-variant')).to.equal(false);
    expect(getComputedStyle(docs!).backgroundColor).to.not.equal(getComputedStyle(home!).backgroundColor);

    el.style.setProperty('--lr-bar-list-bar-color', 'rgb(1, 2, 3)');
    await el.updateComplete;
    expect(getComputedStyle(home!).backgroundColor).to.equal('rgb(1, 2, 3)');
  });

  it('names the list from a host aria-label first, then a localized fallback', async () => {
    const el = await fixture<LyraBarList>(html`<lr-bar-list label="Top pages" .items=${PAGES}></lr-bar-list>`);
    el.setAttribute('aria-label', 'Traffic');
    el.label = 'Top pages ';
    await el.updateComplete;
    expect(part(el, 'list')!.getAttribute('aria-label')).to.equal('Traffic');

    el.removeAttribute('aria-label');
    el.label = '';
    await el.updateComplete;
    expect(part(el, 'list')!.getAttribute('aria-label')).to.equal('Chart');

    el.strings = { chart: 'Diagramme' };
    await el.updateComplete;
    expect(part(el, 'list')!.getAttribute('aria-label')).to.equal('Diagramme');
  });

  it('renders the localized empty state and skips malformed entries', async () => {
    const el = await fixture<LyraBarList>(html`<lr-bar-list></lr-bar-list>`);
    expect(text(part(el, 'empty'))).to.equal('No data');
    expect(part(el, 'list') === null).to.equal(true);

    el.items = [null, { value: 3 }, { label: 'ok', value: 3, variant: 'bogus' }] as unknown as LyraBarListItem[];
    await el.updateComplete;
    expect(parts(el, 'row').map(text)).to.deep.equal(['ok 3']);
    expect(parts(el, 'bar')[0]!.hasAttribute('data-variant')).to.equal(false);
  });

  it('detaches the assigned items from later caller mutation', async () => {
    const items = PAGES.map((item) => ({ ...item }));
    const el = await fixture<LyraBarList>(html`<lr-bar-list .items=${items}></lr-bar-list>`);
    items.push({ label: '/late', value: 99_999 });
    el.requestUpdate();
    await el.updateComplete;
    expect(parts(el, 'row')).to.have.lengthOf(3);
  });

  it('mirrors rows under RTL through logical layout', async () => {
    const wrapper = await fixture<HTMLDivElement>(
      html`<div dir="rtl" style="inline-size: 30rem"><lr-bar-list .items=${PAGES}></lr-bar-list></div>`,
    );
    const el = wrapper.querySelector('lr-bar-list') as LyraBarList;
    await el.updateComplete;
    const row = parts(el, 'row')[0]!.getBoundingClientRect();
    const bar = parts(el, 'bar')[0]!.getBoundingClientRect();
    const value = parts(el, 'value')[0]!.getBoundingClientRect();
    // The bar starts at the inline-start (right) edge and the value sits at the inline end (left).
    expect(Math.abs(bar.right - row.right)).to.be.lessThan(1);
    expect(value.left).to.be.lessThan(bar.left);
  });

  it('keeps a usable size in a narrow and a shrink-to-fit allocation', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div style="display: grid; place-items: center; inline-size: 320px">
      <lr-bar-list .items=${[{ label: 'A very long page path that has to wrap in a narrow column', value: 5 }]}></lr-bar-list>
    </div>`);
    const el = wrapper.querySelector('lr-bar-list') as LyraBarList;
    await el.updateComplete;
    expect(el.getBoundingClientRect().width).to.be.greaterThan(100);
    expect(el.getBoundingClientRect().width).to.be.at.most(320);
    expect(getComputedStyle(parts(el, 'label')[0]!).whiteSpace).to.not.equal('nowrap');
  });

  it('animates bar length and stops under reduced motion', async () => {
    await setReducedMotion('no-preference');
    try {
      const el = await fixture<LyraBarList>(html`<lr-bar-list .items=${PAGES}></lr-bar-list>`);
      const bar = parts(el, 'bar')[0]!;
      expect(getComputedStyle(bar).transitionProperty).to.equal('inline-size');
      await setReducedMotion('reduce');
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      expect(getComputedStyle(bar).transitionDuration).to.equal('0s');
    } finally {
      await setReducedMotion('no-preference');
    }
  });
});
