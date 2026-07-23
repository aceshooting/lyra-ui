import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './word-cloud.js';
import type { LyraWordCloud } from './word-cloud.js';
import { MAX_FONT_SIZE_PX, MAX_WORDS, MIN_SANE_FONT_SIZE } from './word-cloud-layout.js';

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

async function captureWarnings(work: () => Promise<void>): Promise<string[]> {
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...args: unknown[]) => warnings.push(args.map(String).join(' '));
  try {
    await work();
  } finally {
    console.warn = originalWarn;
  }
  return warnings;
}

it('renders one labeled [part="word"] per word, as a single tab stop on [part="svg"]', async () => {
  const el = (await fixture(html`<lr-word-cloud></lr-word-cloud>`)) as LyraWordCloud;
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
  expect(svgEl(el).getAttribute('role')).to.equal('group');
  expect(svgEl(el).getAttribute('aria-label')).to.equal('Word cloud of 3 words');
  expect(svgEl(el).getAttribute('aria-describedby')).to.equal('live-region');
});

it('renders named color overrides in an optional legend', async () => {
  const el = (await fixture(html`<lr-word-cloud
    show-legend
    .words=${[{ text: 'alpha', weight: 1, color: 'rgb(1, 2, 3)' }]}
    .legend=${[{ label: 'Important', color: 'rgb(1, 2, 3)' }]}
  ></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  const legend = el.shadowRoot!.querySelector('[part="legend"]')!;
  expect(legend.querySelector('[part="legend-label"]')!.textContent).to.equal('Important');
  expect(legend.querySelector('[part="legend-swatch"]')!.getAttribute('style')).to.contain('rgb(1, 2, 3)');
});

it('derives legend entries for grouped and explicitly colored words', async () => {
  const el = (await fixture(html`<lr-word-cloud
    show-legend
    .words=${[
      { text: 'alpha', weight: 2, group: 'Group A' },
      { text: 'beta', weight: 1, group: 'Group A' },
      { text: 'gamma', weight: 1, color: 'rgb(4, 5, 6)' },
    ]}
  ></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  expect(Array.from(el.shadowRoot!.querySelectorAll('[part="legend-label"]')).map((node) => node.textContent)).to.deep.equal(['Group A', 'gamma']);
});

it('sizes the heaviest word larger than the lightest', async () => {
  const el = (await fixture(
    html`<lr-word-cloud .words=${WORDS} min-font-size="10" max-font-size="40"></lr-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  const nodes = Array.from(el.shadowRoot!.querySelectorAll('[part="word"]'));
  const alpha = nodes.find((n) => n.textContent === 'alpha')!;
  const gamma = nodes.find((n) => n.textContent === 'gamma')!;
  expect(Number(alpha.getAttribute('font-size'))).to.be.greaterThan(Number(gamma.getAttribute('font-size')));
});

it('reads the font-family/font-weight tokens once per relayout, not once per word', async () => {
  const el = (await fixture(html`<lr-word-cloud></lr-word-cloud>`)) as LyraWordCloud;
  const words = Array.from({ length: 20 }, (_, i) => ({ text: `word${i}`, weight: i + 1 }));

  const original = window.getComputedStyle;
  let calls = 0;
  window.getComputedStyle = ((...args: Parameters<typeof original>) => {
    calls++;
    return original(...args);
  }) as typeof window.getComputedStyle;
  try {
    el.words = words;
    await el.updateComplete;
  } finally {
    window.getComputedStyle = original;
  }

  // Regression: before caching, measureText() re-read both tokens per word
  // (up to 2 * 20 = 40 calls here); a fixed per-relayout cost stays a small
  // constant regardless of word count.
  expect(calls).to.be.lessThan(words.length);
});

it('bounds huge finite font-size attributes before rendering', async () => {
  const el = (await fixture(
    html`<lr-word-cloud
      .words=${[{ text: 'bounded', weight: 1 }]}
      min-font-size="1e100"
      max-font-size="1e100"
    ></lr-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;

  const word = el.shadowRoot!.querySelector('[part="word"]')!;
  expect(Number(word.getAttribute('font-size'))).to.equal(MAX_FONT_SIZE_PX);
});

it('bounds huge finite font sizes assigned directly as properties', async () => {
  const el = (await fixture(html`<lr-word-cloud></lr-word-cloud>`)) as LyraWordCloud;
  el.words = [{ text: 'bounded', weight: 1 }];
  el.minFontSize = Number.MAX_VALUE;
  el.maxFontSize = Number.MAX_VALUE;
  await el.updateComplete;

  const word = el.shadowRoot!.querySelector('[part="word"]')!;
  expect(Number(word.getAttribute('font-size'))).to.equal(MAX_FONT_SIZE_PX);
});

it('clamps a negative/zero minFontSize to the minimum sane font size instead of NaN/non-positive output', async () => {
  const el = (await fixture(html`<lr-word-cloud></lr-word-cloud>`)) as LyraWordCloud;
  el.words = [{ text: 'bounded', weight: 1 }];
  el.minFontSize = -5;
  await el.updateComplete;
  let word = el.shadowRoot!.querySelector('[part="word"]')!;
  expect(Number(word.getAttribute('font-size'))).to.equal(MIN_SANE_FONT_SIZE);

  el.minFontSize = 0;
  await el.updateComplete;
  word = el.shadowRoot!.querySelector('[part="word"]')!;
  expect(Number(word.getAttribute('font-size'))).to.equal(MIN_SANE_FONT_SIZE);
});

it('falls back to the default maxFontSize for a non-finite (NaN/Infinity) value instead of NaN output', async () => {
  // A single word always gets t=0 (weight === the only weight present), so its font-size reflects
  // minFontSize regardless of maxFontSize -- two differently-weighted words are needed so the
  // heaviest one (t=1) actually exercises the guarded maxFontSize value.
  const words = [
    { text: 'alpha', weight: 10 },
    { text: 'gamma', weight: 1 },
  ];
  const el = (await fixture(html`<lr-word-cloud></lr-word-cloud>`)) as LyraWordCloud;
  el.words = words;
  el.maxFontSize = Number.NaN;
  await el.updateComplete;
  let alpha = Array.from(el.shadowRoot!.querySelectorAll('[part="word"]')).find((n) => n.textContent === 'alpha')!;
  expect(Number(alpha.getAttribute('font-size'))).to.equal(48); // DEFAULT_MAX_FONT_SIZE

  el.maxFontSize = Number.POSITIVE_INFINITY;
  await el.updateComplete;
  alpha = Array.from(el.shadowRoot!.querySelectorAll('[part="word"]')).find((n) => n.textContent === 'alpha')!;
  expect(Number(alpha.getAttribute('font-size'))).to.equal(48);
});

it('renders every word with a finite, positive, in-range font-size for a reversed or all-invalid min/max pair', async () => {
  const words = [
    { text: 'alpha', weight: 10 },
    { text: 'beta', weight: 5 },
    { text: 'gamma', weight: 1 },
  ];

  for (const [minFontSize, maxFontSize] of [
    [40, 10], // reversed (min > max)
    [Number.NaN, Number.NaN],
    [-100, -1],
  ] as const) {
    const el = (await fixture(html`<lr-word-cloud></lr-word-cloud>`)) as LyraWordCloud;
    el.words = words;
    el.minFontSize = minFontSize;
    el.maxFontSize = maxFontSize;
    await el.updateComplete;

    const rendered = el.shadowRoot!.querySelectorAll('[part="word"]');
    expect(rendered.length).to.equal(3);
    for (const node of rendered) {
      const size = Number(node.getAttribute('font-size'));
      expect(Number.isFinite(size)).to.be.true;
      expect(size).to.be.greaterThan(0);
      expect(size).to.be.at.most(MAX_FONT_SIZE_PX);
      expect(node.getAttribute('font-size')).to.not.contain('NaN');
    }
  }
});

it('shows a "No data" placeholder and no word nodes when words is empty', async () => {
  const el = (await fixture(html`<lr-word-cloud></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="word"]')).to.have.length(0);
  expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
});

it('reflects word count via role=group and aria-label on the host', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('group');
  expect(el.getAttribute('aria-label')).to.equal('Word cloud of 3 words');
});

it('does not overwrite an author-supplied role/aria-label, including on a later words update', async () => {
  const el = (await fixture(
    html`<lr-word-cloud role="img" aria-label="Custom" .words=${WORDS}></lr-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('img');
  expect(el.getAttribute('aria-label')).to.equal('Custom');

  el.words = [{ text: 'fresh', weight: 1 }];
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('img');
  expect(el.getAttribute('aria-label')).to.equal('Custom');
});

it('honors late host role/aria-label changes and restores generated defaults after removal', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;

  el.setAttribute('role', 'application');
  el.setAttribute('aria-label', 'Late custom');
  await el.updateComplete;
  el.words = [{ text: 'fresh', weight: 1 }];
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('application');
  expect(el.getAttribute('aria-label')).to.equal('Late custom');

  el.removeAttribute('role');
  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('group');
  expect(el.getAttribute('aria-label')).to.equal('Word cloud of 1 word');
});

it('singularizes the aria-label for exactly one word', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${[{ text: 'solo', weight: 1 }]}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Word cloud of 1 word');
});

it('fires lr-word-click with the word\'s text/weight/group on click', async () => {
  const el = (await fixture(
    html`<lr-word-cloud .words=${[{ text: 'clickme', weight: 5, group: 'g1' }]}></lr-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  const node = el.shadowRoot!.querySelector('[part="word"]') as unknown as HTMLElement;

  const eventPromise = oneEvent(el, 'lr-word-click');
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  const event = await eventPromise;

  expect((event as CustomEvent).detail).to.deep.equal({ text: 'clickme', weight: 5, group: 'g1' });
});

it('echoes back the original (unclamped) weight, not an internally-clamped value', async () => {
  const el = (await fixture(
    html`<lr-word-cloud .words=${[{ text: 'negative', weight: -5 }]}></lr-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  const node = el.shadowRoot!.querySelector('[part="word"]') as unknown as HTMLElement;

  const eventPromise = oneEvent(el, 'lr-word-click');
  node.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  const event = await eventPromise;

  expect((event as CustomEvent).detail.weight).to.equal(-5);
});

it('moves roving focus with arrow keys, wraps at neither end, and Home/End jump to the ends', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;

  // First arrow press just lands on the first word in declaration order.
  keydown(el, 'ArrowRight');
  await el.updateComplete;
  let ring = el.shadowRoot!.querySelector('[part="focus-ring"]');
  expect(ring).to.exist;

  keydown(el, 'End');
  await el.updateComplete;
  const eventPromise = oneEvent(el, 'lr-word-click');
  keydown(el, 'Enter');
  const event = await eventPromise;
  expect((event as CustomEvent).detail.text).to.equal('gamma'); // last in declaration order

  keydown(el, 'Home');
  await el.updateComplete;
  const eventPromise2 = oneEvent(el, 'lr-word-click');
  keydown(el, ' ');
  const event2 = await eventPromise2;
  expect((event2 as CustomEvent).detail.text).to.equal('alpha'); // first in declaration order
});

it('swaps which arrow key advances/retreats roving focus under dir="rtl"', async () => {
  // Mirrors lr-tree's identical dir="rtl" arrow-key swap test -- word-cloud
  // is one of the components named in AGENTS.md's RTL roving-focus history.
  const el = (await fixture(html`<lr-word-cloud dir="rtl" .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;

  // First arrow press (either key) just lands on the first word, same as LTR.
  keydown(el, 'ArrowLeft');
  await el.updateComplete;
  const eventPromise1 = oneEvent(el, 'lr-word-click');
  keydown(el, 'Enter');
  expect((await eventPromise1).detail.text).to.equal('alpha');

  // Under RTL, ArrowLeft is the mirrored "forward" key -- advances to the next word.
  keydown(el, 'ArrowLeft');
  await el.updateComplete;
  const eventPromise2 = oneEvent(el, 'lr-word-click');
  keydown(el, 'Enter');
  expect((await eventPromise2).detail.text).to.equal('beta');

  // ArrowRight is the mirrored "backward" key under RTL -- retreats to the previous word.
  keydown(el, 'ArrowRight');
  await el.updateComplete;
  const eventPromise3 = oneEvent(el, 'lr-word-click');
  keydown(el, 'Enter');
  expect((await eventPromise3).detail.text).to.equal('alpha');
});

it('does not fire lr-word-click on Enter/Space before any word is focused', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  let fired = false;
  el.addEventListener('lr-word-click', () => (fired = true), { once: true });
  keydown(el, 'Enter');
  expect(fired).to.be.false;
});

it('clicking a word sets it as the roving-focus cursor for subsequent keyboard nav', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  const nodes = Array.from(el.shadowRoot!.querySelectorAll('[part="word"]'));
  const beta = nodes.find((n) => n.textContent === 'beta') as unknown as HTMLElement;
  beta.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
  await el.updateComplete;

  const eventPromise = oneEvent(el, 'lr-word-click');
  keydown(el, 'Enter');
  const event = await eventPromise;
  expect((event as CustomEvent).detail.text).to.equal('beta');
});

it('resets the roving-focus cursor when words changes', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
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
    html`<lr-word-cloud
      .words=${[
        { text: 'a', weight: 1, group: 'x' },
        { text: 'b', weight: 1, group: 'x' },
        { text: 'c', weight: 1 },
      ]}
    ></lr-word-cloud>`,
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
    html`<lr-word-cloud .words=${[{ text: 'a', weight: 1, color: 'rgb(1, 2, 3)' }]}></lr-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  const node = el.shadowRoot!.querySelector('[part="word"]')!;
  expect(node.getAttribute('fill')).to.equal('rgb(1, 2, 3)');
});

it('never sets a rotate transform with the default horizontal orientation', async () => {
  const words = Array.from({ length: 15 }, (_, i) => ({ text: `w${i}`, weight: i + 1 }));
  const el = (await fixture(html`<lr-word-cloud .words=${words}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  const rendered = el.shadowRoot!.querySelectorAll('[part="word"]');
  for (const node of rendered) {
    expect(node.getAttribute('transform')).to.be.null;
  }
});

it('renders a rotate transform on [part="word"] when orientations is "mixed" and the word was placed rotated', async () => {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0; // clears ROTATE_PROBABILITY's threshold every time -- forces rotated=true
    const el = (await fixture(
      html`<lr-word-cloud orientations="mixed" .words=${[{ text: 'spin', weight: 1 }]}></lr-word-cloud>`,
    )) as LyraWordCloud;
    await el.updateComplete;
    const node = el.shadowRoot!.querySelector('[part="word"]')!;
    expect(node.getAttribute('transform')).to.match(/^rotate\(-90, [\d.]+, [\d.]+\)$/);
  } finally {
    Math.random = originalRandom;
  }
});

it('renders at most MAX_WORDS words even when given more', async () => {
  const words = Array.from({ length: MAX_WORDS + 10 }, (_, i) => ({ text: `w${i}`, weight: i }));
  let el!: LyraWordCloud;
  const warnings = await captureWarnings(async () => {
    el = (await fixture(html`<lr-word-cloud .words=${words}></lr-word-cloud>`)) as LyraWordCloud;
    await el.updateComplete;
  });
  expect(warnings.join('\n')).to.include('10 word(s)');
  expect(el.shadowRoot!.querySelectorAll('[part="word"]')).to.have.length(MAX_WORDS);
});

it('is accessible with words rendered', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible with no data', async () => {
  const el = (await fixture(html`<lr-word-cloud></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('constrains its rendered SVG to a host-assigned height instead of overflowing', async () => {
  const el = (await fixture(html`<lr-word-cloud
    style="height: 128px; display: block;"
    .words=${[
      { text: 'alpha', weight: 10 },
      { text: 'beta', weight: 5 },
    ]}
  ></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  const hostRect = el.getBoundingClientRect();
  const svg = el.shadowRoot!.querySelector('svg') as SVGSVGElement;
  const svgRect = svg.getBoundingClientRect();
  expect(Math.round(svgRect.height)).to.equal(Math.round(hostRect.height));
});

it('contains long unbroken legend labels at a 320px allocation', async () => {
  const el = (await fixture(html`<lr-word-cloud
    style="inline-size: 320px;"
    show-legend
    .words=${[{ text: 'alpha', weight: 1, color: 'rgb(1, 2, 3)' }]}
    .legend=${[{ label: 'ExtremelyLongUnbrokenLegendLabelThatMustRemainInsideTheAllocatedComponentWidth', color: 'rgb(1, 2, 3)' }]}
  ></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;

  const legend = el.shadowRoot!.querySelector('[part="legend"]') as HTMLElement;
  const label = el.shadowRoot!.querySelector('[part="legend-label"]') as HTMLElement;
  expect(legend.scrollWidth).to.be.at.most(legend.clientWidth);
  expect(label.getBoundingClientRect().right).to.be.at.most(legend.getBoundingClientRect().right);
});

it('relays out when the font-family theme token changes', async () => {
  const el = (await fixture(
    html`<lr-word-cloud
      .words=${[
        { text: 'alpha', weight: 5 },
        { text: 'beta', weight: 1 },
      ]}
    ></lr-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  const before = el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox');
  el.style.setProperty('--lr-font', 'monospace');
  el.words = [...el.words];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox')).to.not.equal(before);
});

it('calls refreshTheme() alone to re-measure and re-layout for font-family change', async () => {
  const el = (await fixture(
    html`<lr-word-cloud
      .words=${[
        { text: 'alpha', weight: 5 },
        { text: 'beta', weight: 1 },
      ]}
    ></lr-word-cloud>`,
  )) as LyraWordCloud;
  await el.updateComplete;
  const before = el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox');
  el.style.setProperty('--lr-font', 'monospace');
  el.refreshTheme();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox')).to.not.equal(before);
});

it('announces the count of words actually rendered, not the raw input count', async () => {
  let el!: LyraWordCloud;
  const warnings = await captureWarnings(async () => {
    el = (await fixture(
      html`<lr-word-cloud
        .words=${[
          { text: '', weight: 1 },
          { text: 'ok', weight: 2 },
        ]}
      ></lr-word-cloud>`,
    )) as LyraWordCloud;
    await el.updateComplete;
  });
  expect(warnings.join('\n')).to.include('1 word(s)');
  expect(el.getAttribute('aria-label')).to.include('1 word');
});

it('keeps the palette on theme tokens so explicit dark themes are not overridden by the OS preference', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  el.style.setProperty('--lr-word-cloud-color-1', 'rgb(1, 2, 3)');
  el.refreshTheme();
  await el.updateComplete;
  const word = el.shadowRoot!.querySelector('[part="word"]') as SVGTextElement;
  expect(word.getAttribute('fill')).to.equal('rgb(1, 2, 3)');
});

it("localizes the wordCloud aria-label's pluralized noun via this.localize()", async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  el.strings = { wordCloudWords: 'mots' };
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal(`Word cloud of ${WORDS.length} mots`);
});

it('localizes the whole focused-word announcement and formats its weight with the effective locale', async () => {
  const el = (await fixture(html`<lr-word-cloud
    locale="de-DE"
    .strings=${{ wordCloudWordAnnouncement: '{weight} :: {text}' }}
    .words=${[{ text: 'alpha', weight: 1234.5 }]}
  ></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;

  keydown(el, 'ArrowRight');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.equal('1.234,5 :: alpha');
});

it('defaults to English "word"/"words" when no strings override is set', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal(`Word cloud of ${WORDS.length} words`);
});
