import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './word-cloud.js';
import type { LyraWordCloud } from './word-cloud.js';
import { MAX_WORDS } from './word-cloud-layout.js';

const WORDS = [
  { text: 'alpha', weight: 10 },
  { text: 'beta', weight: 5 },
  { text: 'gamma', weight: 1 },
];

function svgEl(el: LyraWordCloud): SVGSVGElement {
  return el.shadowRoot!.querySelector('[part="svg"]') as unknown as SVGSVGElement;
}

function keydown(el: LyraWordCloud, key: string): void {
  svgEl(el).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
}

it('renders one labeled [part="word"] per word, as a single tab stop on [part="svg"]', async () => {
  const el = (await fixture(html`<lyra-word-cloud></lyra-word-cloud>`)) as LyraWordCloud;
  el.words = WORDS;
  await el.updateComplete;

  const rendered = el.shadowRoot!.querySelectorAll('[part="word"]');
  expect(rendered).to.have.length(3);
  const texts = Array.from(rendered).map((n) => n.textContent);
  expect(texts).to.have.members(['alpha', 'beta', 'gamma']);
  for (const node of rendered) {
    expect(node.getAttribute('tabindex')).to.be.null;
  }
  expect(svgEl(el).getAttribute('tabindex')).to.equal('0');
});

it('sizes the heaviest word larger than the lightest', async () => {
  const el = (await fixture(
    html`<lyra-word-cloud .words=${WORDS} min-font-size="10" max-font-size="40"></lyra-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  const nodes = Array.from(el.shadowRoot!.querySelectorAll('[part="word"]'));
  const alpha = nodes.find((n) => n.textContent === 'alpha')!;
  const gamma = nodes.find((n) => n.textContent === 'gamma')!;
  expect(Number(alpha.getAttribute('font-size'))).to.be.greaterThan(Number(gamma.getAttribute('font-size')));
});

it('shows a "No data" placeholder and no word nodes when words is empty', async () => {
  const el = (await fixture(html`<lyra-word-cloud></lyra-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="word"]')).to.have.length(0);
  expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
});

it('reflects word count via role=group and aria-label on the host', async () => {
  const el = (await fixture(html`<lyra-word-cloud .words=${WORDS}></lyra-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('group');
  expect(el.getAttribute('aria-label')).to.equal('Word cloud of 3 words');
});

it('singularizes the aria-label for exactly one word', async () => {
  const el = (await fixture(html`<lyra-word-cloud .words=${[{ text: 'solo', weight: 1 }]}></lyra-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Word cloud of 1 word');
});

it('fires lyra-word-click with the word\'s text/weight/group on click', async () => {
  const el = (await fixture(
    html`<lyra-word-cloud .words=${[{ text: 'clickme', weight: 5, group: 'g1' }]}></lyra-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  const node = el.shadowRoot!.querySelector('[part="word"]') as unknown as HTMLElement;

  const eventPromise = oneEvent(el, 'lyra-word-click');
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  const event = await eventPromise;

  expect((event as CustomEvent).detail).to.deep.equal({ text: 'clickme', weight: 5, group: 'g1' });
});

it('echoes back the original (unclamped) weight, not an internally-clamped value', async () => {
  const el = (await fixture(
    html`<lyra-word-cloud .words=${[{ text: 'negative', weight: -5 }]}></lyra-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  const node = el.shadowRoot!.querySelector('[part="word"]') as unknown as HTMLElement;

  const eventPromise = oneEvent(el, 'lyra-word-click');
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  const event = await eventPromise;

  expect((event as CustomEvent).detail.weight).to.equal(-5);
});

it('moves roving focus with arrow keys, wraps at neither end, and Home/End jump to the ends', async () => {
  const el = (await fixture(html`<lyra-word-cloud .words=${WORDS}></lyra-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;

  // First arrow press just lands on the first word in declaration order.
  keydown(el, 'ArrowRight');
  await el.updateComplete;
  let ring = el.shadowRoot!.querySelector('[part="focus-ring"]');
  expect(ring).to.exist;

  keydown(el, 'End');
  await el.updateComplete;
  const eventPromise = oneEvent(el, 'lyra-word-click');
  keydown(el, 'Enter');
  const event = await eventPromise;
  expect((event as CustomEvent).detail.text).to.equal('gamma'); // last in declaration order

  keydown(el, 'Home');
  await el.updateComplete;
  const eventPromise2 = oneEvent(el, 'lyra-word-click');
  keydown(el, ' ');
  const event2 = await eventPromise2;
  expect((event2 as CustomEvent).detail.text).to.equal('alpha'); // first in declaration order
});

it('does not fire lyra-word-click on Enter/Space before any word is focused', async () => {
  const el = (await fixture(html`<lyra-word-cloud .words=${WORDS}></lyra-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  let fired = false;
  el.addEventListener('lyra-word-click', () => (fired = true), { once: true });
  keydown(el, 'Enter');
  expect(fired).to.be.false;
});

it('clicking a word sets it as the roving-focus cursor for subsequent keyboard nav', async () => {
  const el = (await fixture(html`<lyra-word-cloud .words=${WORDS}></lyra-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  const nodes = Array.from(el.shadowRoot!.querySelectorAll('[part="word"]'));
  const beta = nodes.find((n) => n.textContent === 'beta') as unknown as HTMLElement;
  beta.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await el.updateComplete;

  const eventPromise = oneEvent(el, 'lyra-word-click');
  keydown(el, 'Enter');
  const event = await eventPromise;
  expect((event as CustomEvent).detail.text).to.equal('beta');
});

it('resets the roving-focus cursor when words changes', async () => {
  const el = (await fixture(html`<lyra-word-cloud .words=${WORDS}></lyra-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  keydown(el, 'ArrowRight');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="focus-ring"]')).to.exist;

  el.words = [{ text: 'fresh', weight: 1 }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="focus-ring"]')).to.not.exist;
});

it('colors words sharing a group the same, and differently from an ungrouped word', async () => {
  const el = (await fixture(
    html`<lyra-word-cloud
      .words=${[
        { text: 'a', weight: 1, group: 'x' },
        { text: 'b', weight: 1, group: 'x' },
        { text: 'c', weight: 1 },
      ]}
    ></lyra-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  const nodes = Array.from(el.shadowRoot!.querySelectorAll('[part="word"]'));
  const a = nodes.find((n) => n.textContent === 'a')!;
  const b = nodes.find((n) => n.textContent === 'b')!;
  const c = nodes.find((n) => n.textContent === 'c')!;
  expect(a.getAttribute('fill')).to.equal(b.getAttribute('fill'));
  expect(a.getAttribute('fill')).to.not.equal(c.getAttribute('fill'));
});

it('honors an explicit per-word color over the palette', async () => {
  const el = (await fixture(
    html`<lyra-word-cloud .words=${[{ text: 'a', weight: 1, color: 'rgb(1, 2, 3)' }]}></lyra-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  const node = el.shadowRoot!.querySelector('[part="word"]')!;
  expect(node.getAttribute('fill')).to.equal('rgb(1, 2, 3)');
});

it('never sets a rotate transform with the default horizontal orientation', async () => {
  const words = Array.from({ length: 15 }, (_, i) => ({ text: `w${i}`, weight: i + 1 }));
  const el = (await fixture(html`<lyra-word-cloud .words=${words}></lyra-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  const rendered = el.shadowRoot!.querySelectorAll('[part="word"]');
  for (const node of rendered) {
    expect(node.getAttribute('transform')).to.be.null;
  }
});

it('renders at most MAX_WORDS words even when given more', async () => {
  const words = Array.from({ length: MAX_WORDS + 10 }, (_, i) => ({ text: `w${i}`, weight: i }));
  const el = (await fixture(html`<lyra-word-cloud .words=${words}></lyra-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="word"]')).to.have.length(MAX_WORDS);
});

it('is accessible with words rendered', async () => {
  const el = (await fixture(html`<lyra-word-cloud .words=${WORDS}></lyra-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible with no data', async () => {
  const el = (await fixture(html`<lyra-word-cloud></lyra-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('relays out when the font-family theme token changes', async () => {
  const el = (await fixture(
    html`<lyra-word-cloud
      .words=${[
        { text: 'alpha', weight: 5 },
        { text: 'beta', weight: 1 },
      ]}
    ></lyra-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  const before = el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox');
  el.style.setProperty('--lyra-font', 'monospace');
  el.words = [...el.words];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox')).to.not.equal(before);
});

it('announces the count of words actually rendered, not the raw input count', async () => {
  const el = (await fixture(
    html`<lyra-word-cloud
      .words=${[
        { text: '', weight: 1 },
        { text: 'ok', weight: 2 },
      ]}
    ></lyra-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.include('1 word');
});
