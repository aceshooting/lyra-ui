import { aTimeout, fixture, expect, html, oneEvent } from '@open-wc/testing';
import './word-cloud.js';
import type { LyraWordCloud } from './word-cloud.js';
import { MAX_FONT_SIZE_PX, MAX_WORDS, MIN_SANE_FONT_SIZE } from './word-cloud-layout.js';
import { invalidateLyraTheme } from '../../../internal/theme-watcher.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

function sinkElement(doc: Document = document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`);
}

function sinkTexts(doc: Document = document): string[] {
  const sink = sinkElement(doc);
  return sink ? Array.from(sink.children, (child) => child.textContent ?? '') : [];
}

const WORDS = [
  { text: 'alpha', weight: 10 },
  { text: 'beta', weight: 5 },
  { text: 'gamma', weight: 1 },
];

it('checks typography tokens after an out-of-band theme invalidation', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`);
  let refreshes = 0;
  const originalRefresh = el.refreshTheme;
  el.refreshTheme = () => {
    refreshes += 1;
  };
  try {
    el.style.setProperty('--lr-font', 'monospace');
    invalidateLyraTheme(el);
    await aTimeout(0);
    expect(refreshes).to.equal(1);
  } finally {
    el.refreshTheme = originalRefresh;
  }
});

it('rejects url and declaration-breaking word and legend paint values', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud show-legend></lr-word-cloud>`);
  el.words = [{ text: 'unsafe', weight: 1, color: 'url("data:image/svg+xml,<svg/>")' }];
  el.legend = [{ label: 'Unsafe', color: 'red;position:fixed' }];
  await el.updateComplete;
  const word = el.shadowRoot!.querySelector('[part="word"]')!;
  const swatch = el.shadowRoot!.querySelector('[part="legend-swatch"]') as HTMLElement;
  expect(word.getAttribute('fill')).to.not.contain('url(');
  expect(swatch.style.position).to.equal('');
  expect(swatch.style.backgroundColor).to.equal('transparent');

  el.words = [{ text: 'safe', weight: 1, color: 'var(--lr-color-brand)' }];
  el.legend = [{ label: 'Safe', color: '#123456' }];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="word"]')!.getAttribute('fill')).to.equal('var(--lr-color-brand)');
});

function svgEl(el: LyraWordCloud): SVGSVGElement {
  return el.shadowRoot!.querySelector('[part="svg"]') as unknown as SVGSVGElement;
}

function keydown(el: LyraWordCloud, key: string): void {
  svgEl(el).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true }));
}

function wordClientPoint(el: LyraWordCloud, text: string): { clientX: number; clientY: number } {
  const word = Array.from(el.shadowRoot!.querySelectorAll<SVGTextElement>('[part="word"]')).find(
    (candidate) => candidate.textContent === text,
  );
  if (!word) throw new Error(`Missing rendered word: ${text}`);
  const matrix = svgEl(el).getScreenCTM();
  if (!matrix) throw new Error('Missing SVG screen transform');
  const point = new DOMPoint(Number(word.getAttribute('x')), Number(word.getAttribute('y'))).matrixTransform(matrix);
  return { clientX: point.x, clientY: point.y };
}

function clickWord(el: LyraWordCloud, text: string): void {
  const point = wordClientPoint(el, text);
  svgEl(el).dispatchEvent(new MouseEvent('click', { ...point, bubbles: true, composed: true }));
}

function pointerDownWord(el: LyraWordCloud, text: string): void {
  const point = wordClientPoint(el, text);
  svgEl(el).dispatchEvent(
    new PointerEvent('pointerdown', { ...point, pointerId: 1, bubbles: true, composed: true, buttons: 1 }),
  );
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
  expect(svgEl(el).getAttribute('role')).to.equal('application');
  expect(svgEl(el).getAttribute('aria-label')).to.equal('Word cloud of 3 words');
  expect(svgEl(el).getAttribute('aria-describedby')).to.equal(null);
  expect(el.getAttribute('role')).to.be.null;
  expect(el.getAttribute('aria-label')).to.be.null;
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
  expect(
    Array.from(el.shadowRoot!.querySelectorAll('[part="legend-label"]')).map((node) => node.textContent)
  ).to.deep.equal(['Group A', 'gamma']);
});

it('sizes the heaviest word larger than the lightest', async () => {
  const el = (await fixture(
    html`<lr-word-cloud .words=${WORDS} min-font-size="10" max-font-size="40"></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  const nodes = Array.from(el.shadowRoot!.querySelectorAll('[part="word"]'));
  const alpha = nodes.find((n) => n.textContent === 'alpha')!;
  const gamma = nodes.find((n) => n.textContent === 'gamma')!;
  expect(Number(alpha.getAttribute('font-size'))).to.be.greaterThan(Number(gamma.getAttribute('font-size')));
});

it('uses an explicit weight domain so comparable clouds share one input scale', async () => {
  const sharedDomain: [number, number] = [0, 200];
  const first = await fixture<LyraWordCloud>(html`
    <lr-word-cloud
      min-font-size="10"
      max-font-size="40"
      .domain=${sharedDomain}
      .words=${[
        { text: 'low-a', weight: 0 },
        { text: 'shared-a', weight: 50 },
        { text: 'high-a', weight: 100 },
      ]}
    ></lr-word-cloud>
  `);
  const second = await fixture<LyraWordCloud>(html`
    <lr-word-cloud
      min-font-size="10"
      max-font-size="40"
      .domain=${sharedDomain}
      .words=${[
        { text: 'low-b', weight: 0 },
        { text: 'shared-b', weight: 50 },
        { text: 'high-b', weight: 200 },
      ]}
    ></lr-word-cloud>
  `);
  const fontSize = (el: LyraWordCloud, text: string): number =>
    Number(
      Array.from(el.shadowRoot!.querySelectorAll('[part="word"]')).find(
        (node) => node.textContent === text,
      )!.getAttribute('font-size'),
    );

  expect(fontSize(first, 'shared-a')).to.equal(fontSize(second, 'shared-b'));
});

it('leaves the weight domain unset by default and keeps data-derived scaling', async () => {
  const el = await fixture<LyraWordCloud>(html`
    <lr-word-cloud
      min-font-size="10"
      max-font-size="40"
      .words=${[
        { text: 'low', weight: 0 },
        { text: 'middle', weight: 50 },
        { text: 'high', weight: 100 },
      ]}
    ></lr-word-cloud>
  `);
  const middleSize = (): number =>
    Number(
      Array.from(el.shadowRoot!.querySelectorAll('[part="word"]')).find(
        (node) => node.textContent === 'middle',
      )!.getAttribute('font-size'),
    );

  expect(el.domain).to.equal(undefined);
  expect(middleSize()).to.equal(25);

  el.domain = [0, 200];
  await el.updateComplete;
  expect(middleSize()).to.equal(17.5);

  el.domain = undefined;
  await el.updateComplete;
  expect(middleSize(), 'unsetting the opt-in restores data-derived scaling').to.equal(25);
});

it('reads the font-family/font-weight tokens once per relayout, not once per word', async () => {
  const el = (await fixture(html`
    <lr-word-cloud
      style="inline-size: 80rem; block-size: 40rem"
      min-font-size="4"
      max-font-size="4"
    ></lr-word-cloud>
  `)) as LyraWordCloud;
  const words = Array.from({ length: 20 }, (_, i) => ({ text: `w${i}`, weight: i + 1 }));

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
  expect(el.shadowRoot!.querySelectorAll('[part="word"]')).to.have.lengthOf(words.length);
});

it('bounds huge finite font-size attributes before rendering', async () => {
  const el = (await fixture(
    html`<lr-word-cloud
      .words=${[{ text: 'bounded', weight: 1 }]}
      min-font-size="1e100"
      max-font-size="1e100"
    ></lr-word-cloud>`
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

it('puts the composite role and generated word count on the focusable SVG only', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  expect(el.getAttribute('role')).to.be.null;
  expect(el.getAttribute('aria-label')).to.be.null;
  expect(svgEl(el).getAttribute('role')).to.equal('application');
  expect(svgEl(el).getAttribute('aria-label')).to.equal('Word cloud of 3 words');
});

it('forwards an authored host aria-label to the focusable SVG semantic owner', async () => {
  const el = (await fixture(
    html`<lr-word-cloud role="img" aria-label="Custom" .words=${WORDS}></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('img');
  expect(el.getAttribute('aria-label')).to.equal('Custom');
  expect(svgEl(el).getAttribute('role')).to.equal('application');
  expect(svgEl(el).getAttribute('aria-label')).to.equal('Custom');

  el.words = [{ text: 'fresh', weight: 1 }];
  await el.updateComplete;
  expect(el.getAttribute('role')).to.equal('img');
  expect(el.getAttribute('aria-label')).to.equal('Custom');
  expect(svgEl(el).getAttribute('aria-label')).to.equal('Custom');
  await expect(el).to.be.accessible();
});

it('uses host aria-label presence, including empty, and restores the localized generated name on removal', async () => {
  const el = (await fixture(html`
    <lr-word-cloud
      .strings=${{
        wordCloud: 'Nuage de {count} {word}',
        wordCloudWord: 'mot',
        wordCloudWords: 'mots',
      }}
      .words=${WORDS}
    ></lr-word-cloud>
  `)) as LyraWordCloud;
  await el.updateComplete;
  expect(svgEl(el).getAttribute('aria-label')).to.equal('Nuage de 3 mots');

  el.setAttribute('aria-label', 'Late custom');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.equal('Late custom');
  expect(svgEl(el).getAttribute('aria-label')).to.equal('Late custom');

  el.setAttribute('aria-label', 'Changed custom');
  await el.updateComplete;
  expect(svgEl(el).getAttribute('aria-label')).to.equal('Changed custom');

  el.setAttribute('aria-label', '');
  await el.updateComplete;
  expect(svgEl(el).getAttribute('aria-label')).to.equal('');

  el.removeAttribute('aria-label');
  await el.updateComplete;
  expect(el.getAttribute('aria-label')).to.be.null;
  expect(svgEl(el).getAttribute('role')).to.equal('application');
  expect(svgEl(el).getAttribute('aria-label')).to.equal('Nuage de 3 mots');
});

it('singularizes the aria-label for exactly one word', async () => {
  const el = (await fixture(
    html`<lr-word-cloud .words=${[{ text: 'solo', weight: 1 }]}></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  expect(svgEl(el).getAttribute('aria-label')).to.equal('Word cloud of 1 word');
});

it("fires lr-word-activate with the word's text/weight/group on click", async () => {
  const el = (await fixture(
    html`<lr-word-cloud .words=${[{ text: 'clickme', weight: 5, group: 'g1' }]}></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  const eventPromise = oneEvent(el, 'lr-word-activate');
  clickWord(el, 'clickme');
  const event = await eventPromise;

  expect((event as CustomEvent).detail).to.deep.equal({ text: 'clickme', weight: 5, group: 'g1' });
});

it('uses one normalized nonnegative weight for layout, activation and announcements', async () => {
  const el = (await fixture(
    html`<lr-word-cloud .words=${[{ text: 'negative', weight: -5 }]}></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  expect(el.words[0]!.weight).to.equal(0);

  const eventPromise = oneEvent(el, 'lr-word-activate');
  clickWord(el, 'negative');
  const event = await eventPromise;

  expect((event as CustomEvent).detail.weight).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.equal('negative, 0');
});

it('moves roving focus with arrow keys, wraps at neither end, and Home/End jump to the ends', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;

  // First arrow press just lands on the first word in declaration order.
  keydown(el, 'ArrowRight');
  await el.updateComplete;
  let ring = el.shadowRoot!.querySelector('[part="focus-ring"]');
  expect(ring != null).to.equal(true);

  keydown(el, 'End');
  await el.updateComplete;
  const eventPromise = oneEvent(el, 'lr-word-activate');
  keydown(el, 'Enter');
  const event = await eventPromise;
  expect((event as CustomEvent).detail.text).to.equal('gamma'); // last in declaration order

  keydown(el, 'Home');
  await el.updateComplete;
  const eventPromise2 = oneEvent(el, 'lr-word-activate');
  keydown(el, ' ');
  const event2 = await eventPromise2;
  expect((event2 as CustomEvent).detail.text).to.equal('alpha'); // first in declaration order
});

it('routes word-focus feedback through a light-DOM sink and repeats identical edge announcements', async () => {
  const el = (await fixture(
    html`<lr-word-cloud .words=${[{ text: 'alpha', weight: 10 }]}></lr-word-cloud>`
  )) as LyraWordCloud;
  const mirror = el.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement;
  expect(sinkTexts(), 'the initial layout must stay silent').to.deep.equal([]);
  expect(mirror.getAttribute('aria-hidden')).to.equal('true');
  expect(mirror.getAttribute('role')).to.equal(null);
  expect(mirror.getAttribute('aria-live')).to.equal(null);

  keydown(el, 'ArrowRight');
  keydown(el, 'ArrowRight');
  await el.updateComplete;
  expect(sinkTexts()).to.deep.equal(['alpha, 10', 'alpha, 10']);

  el.remove();
  expect(sinkElement() === null).to.be.true;
});

it('re-targets word-focus announcements after cross-document adoption', async () => {
  const el = (await fixture(
    html`<lr-word-cloud .words=${[{ text: 'alpha', weight: 10 }]}></lr-word-cloud>`
  )) as LyraWordCloud;
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument!;
  try {
    frameDocument.body.append(el);
    keydown(el, 'ArrowRight');
    await el.updateComplete;
    expect(sinkElement() === null, 'the original document must release the adopted cloud').to.be.true;
    expect(sinkTexts(frameDocument)).to.deep.equal(['alpha, 10']);
  } finally {
    el.remove();
    iframe.remove();
  }
});

it('swaps which arrow key advances/retreats roving focus under dir="rtl"', async () => {
  // Mirrors lr-tree's identical dir="rtl" arrow-key swap test -- word-cloud
  // is one of the components named in AGENTS.md's RTL roving-focus history.
  const el = (await fixture(html`<lr-word-cloud dir="rtl" .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;

  // First arrow press (either key) just lands on the first word, same as LTR.
  keydown(el, 'ArrowLeft');
  await el.updateComplete;
  const eventPromise1 = oneEvent(el, 'lr-word-activate');
  keydown(el, 'Enter');
  expect((await eventPromise1).detail.text).to.equal('alpha');

  // Under RTL, ArrowLeft is the mirrored "forward" key -- advances to the next word.
  keydown(el, 'ArrowLeft');
  await el.updateComplete;
  const eventPromise2 = oneEvent(el, 'lr-word-activate');
  keydown(el, 'Enter');
  expect((await eventPromise2).detail.text).to.equal('beta');

  // ArrowRight is the mirrored "backward" key under RTL -- retreats to the previous word.
  keydown(el, 'ArrowRight');
  await el.updateComplete;
  const eventPromise3 = oneEvent(el, 'lr-word-activate');
  keydown(el, 'Enter');
  expect((await eventPromise3).detail.text).to.equal('alpha');
});

it('establishes the first word silently on Tab focus so immediate Enter activates it', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  expect(sinkTexts()).to.deep.equal([]);

  svgEl(el).focus();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="focus-ring"]')).to.exist;
  expect(sinkTexts()).to.deep.equal([]);

  const eventPromise = oneEvent(el, 'lr-word-activate');
  keydown(el, 'Enter');
  expect((await eventPromise).detail.text).to.equal('alpha');
});

it('ignores synthetic Enter dispatched while its SVG does not own focus', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  let fired = false;
  el.addEventListener('lr-word-activate', () => (fired = true), { once: true });
  keydown(el, 'Enter');
  expect(fired).to.be.false;
});

it('fresh End focuses the last word before Enter activates it', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;

  keydown(el, 'End');
  await el.updateComplete;
  const eventPromise = oneEvent(el, 'lr-word-activate');
  keydown(el, 'Enter');
  expect((await eventPromise).detail.text).to.equal('gamma');
});

it('activating the nearest word through the SVG surface sets the keyboard cursor', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  clickWord(el, 'beta');
  await el.updateComplete;

  const eventPromise = oneEvent(el, 'lr-word-activate');
  keydown(el, 'Enter');
  const event = await eventPromise;
  expect((event as CustomEvent).detail.text).to.equal('beta');
});

it('uses one adequately sized SVG hit surface instead of tiny per-word pointer targets', async () => {
  const el = (await fixture(
    html`<lr-word-cloud style="inline-size: 320px; block-size: 192px" .words=${WORDS}></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;

  const surface = svgEl(el);
  const rect = surface.getBoundingClientRect();
  expect(rect.width).to.be.at.least(24);
  expect(rect.height).to.be.at.least(24);
  for (const word of el.shadowRoot!.querySelectorAll('[part="word"]')) {
    expect(getComputedStyle(word).pointerEvents).to.equal('none');
  }

  const eventPromise = oneEvent(el, 'lr-word-activate');
  clickWord(el, 'gamma');
  expect((await eventPromise).detail.text).to.equal('gamma');
});

it('paints a computed SVG-native pressed cue for the pointer-down frame', async () => {
  const el = (await fixture(
    html`<lr-word-cloud style="inline-size: 320px; block-size: 192px" .words=${WORDS}></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  svgEl(el).focus();
  await el.updateComplete;
  const normalRing = el.shadowRoot!.querySelector('[part="focus-ring"]') as SVGRectElement;
  const normalDash = getComputedStyle(normalRing).strokeDasharray;

  pointerDownWord(el, 'beta');
  await el.updateComplete;
  const pressedRing = el.shadowRoot!.querySelector('[part="focus-ring"]') as SVGRectElement;
  expect(pressedRing.hasAttribute('data-pressed')).to.be.true;
  expect(getComputedStyle(pressedRing).strokeDasharray).to.not.equal(normalDash);

  svgEl(el).dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, bubbles: true, composed: true }));
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="focus-ring"]') as SVGRectElement).hasAttribute('data-pressed')).to.be
    .false;
});

it('resets the roving-focus cursor when words changes', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  keydown(el, 'ArrowRight');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="focus-ring"]')).to.exist;

  el.words = [{ text: 'fresh', weight: 1 }];
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="focus-ring"]')) == null).to.be.true;
});

it('does not render a legend when show-legend is left at its default (unset regression)', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  expect(el.showLegend).to.be.false;
  expect((el.shadowRoot!.querySelector('[part="legend"]')) == null).to.be.true;
});

it('colors words sharing a group the same, and differently from an ungrouped word', async () => {
  const el = (await fixture(
    html`<lr-word-cloud
      .words=${[
        { text: 'a', weight: 1, group: 'x' },
        { text: 'b', weight: 1, group: 'x' },
        { text: 'c', weight: 1 },
      ]}
    ></lr-word-cloud>`
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
    html`<lr-word-cloud .words=${[{ text: 'a', weight: 1, color: 'rgb(1, 2, 3)' }]}></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  const node = el.shadowRoot!.querySelector('[part="word"]')!;
  expect(node.getAttribute('fill')).to.equal('rgb(1, 2, 3)');
});

it('never sets a rotate transform with the default no-rotation mode', async () => {
  const words = Array.from({ length: 10 }, (_, i) => ({ text: `w${i}`, weight: i + 1 }));
  const el = (await fixture(html`
    <lr-word-cloud
      min-font-size="4"
      max-font-size="4"
      .words=${words}
    ></lr-word-cloud>
  `)) as LyraWordCloud;
  await el.updateComplete;
  const rendered = el.shadowRoot!.querySelectorAll('[part="word"]');
  for (const node of rendered) {
    expect(node.getAttribute('transform')).to.be.null;
  }
});

it('renders a rotate transform when wordRotation is "mixed" and the word was placed rotated', async () => {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0; // clears ROTATE_PROBABILITY's threshold every time -- forces rotated=true
    const el = (await fixture(
      html`<lr-word-cloud word-rotation="mixed" .words=${[{ text: 'spin', weight: 1 }]}></lr-word-cloud>`
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

it('clone-owns and freezes readonly word, palette and legend snapshots', async () => {
  const sourceWord = { text: 'original', weight: 3, group: 'group' };
  const sourceWords = [sourceWord];
  const sourcePalette = ['rgb(1, 2, 3)'];
  const sourceLegend = [{ label: 'Original legend', color: 'rgb(1, 2, 3)' }];
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
  el.words = sourceWords;
  el.palette = sourcePalette;
  el.legend = sourceLegend;

  sourceWord.text = 'mutated';
  sourceWords.push({ text: 'late', weight: 1, group: 'group' });
  sourcePalette[0] = 'red';
  sourceLegend[0]!.label = 'mutated';
  await el.updateComplete;

  expect(el.words.map((word) => word.text)).to.deep.equal(['original']);
  expect(el.palette).to.deep.equal(['rgb(1, 2, 3)']);
  expect(el.legend.map((item) => item.label)).to.deep.equal(['Original legend']);
  expect(Object.isFrozen(el.words)).to.be.true;
  expect(Object.isFrozen(el.words[0]!)).to.be.true;
  expect(Object.isFrozen(el.palette!)).to.be.true;
  expect(Object.isFrozen(el.legend)).to.be.true;
  expect(Object.isFrozen(el.legend[0]!)).to.be.true;
});

it('retains valid partial data while rejecting malformed records and hostile getters', async () => {
  const hostileWord = { text: 'hostile' } as { text: string; weight?: number };
  Object.defineProperty(hostileWord, 'weight', { get: () => { throw new Error('hostile weight'); } });
  const hostileLegend = { label: 'hostile' } as { label: string; color?: string };
  Object.defineProperty(hostileLegend, 'color', { get: () => { throw new Error('hostile color'); } });
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud show-legend></lr-word-cloud>`);

  const warnings = await captureWarnings(async () => {
    el.words = [null, 'not-a-record', hostileWord, { text: 'valid', weight: 2 }, { text: 'finite', weight: Infinity }] as never;
    el.legend = [null, hostileLegend, { label: 'Valid legend', color: '#123456' }] as never;
    await el.updateComplete;
  });
  expect(warnings).to.deep.equal([
    '<lr-word-cloud> could not place 3 word(s) (blank text, over the 150-word cap, or the layout search was exhausted) -- they were dropped, not rendered.',
  ]);

  expect(el.words.map((word) => word.text)).to.deep.equal(['valid', 'finite']);
  expect(el.words.map((word) => word.weight)).to.deep.equal([2, 0]);
  expect(el.legend.map((item) => item.label)).to.deep.equal(['Valid legend']);
  expect(el.shadowRoot!.querySelector('[part="word"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="legend-label"]')!.textContent).to.equal('Valid legend');

  const { proxy, revoke } = Proxy.revocable([], {});
  revoke();
  el.words = proxy as never;
  el.legend = { length: 1 } as never;
  await el.updateComplete;
  expect(el.words).to.deep.equal([]);
  expect(el.legend).to.deep.equal([]);
  expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
});

it('bounds per-item text and explicit legend nodes with visible localized disclosures', async () => {
  const hugeText = 'x'.repeat(1_000_000);
  const legend = Array.from({ length: 10_000 }, (_, index) => ({
    label: `${index}-${'l'.repeat(400)}`,
    color: '#123456',
  }));
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud show-legend></lr-word-cloud>`);
  el.words = [{ text: hugeText, weight: 1 }];
  el.legend = legend;
  await el.updateComplete;

  const wordText = el.shadowRoot!.querySelector('[part="word"]')!.textContent!;
  const legendLabels = Array.from(el.shadowRoot!.querySelectorAll('[part="legend-label"]'));
  expect(wordText.length).to.be.at.most(256);
  expect(wordText.endsWith('…')).to.be.true;
  expect(legendLabels.length).to.be.at.most(100);
  expect(legendLabels.every((label) => (label.textContent?.length ?? 0) <= 256)).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="limit"]')).to.exist;
  expect(svgEl(el).getAttribute('aria-describedby')).to.equal('word-limit');
  const legendLimit = el.shadowRoot!.querySelector('[part="legend-limit"]')!;
  expect(legendLimit.textContent).to.include('10,000');
  expect(el.shadowRoot!.querySelector('[part="legend"]')!.getAttribute('aria-describedby')).to.equal('legend-limit');
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
    .legend=${[
      {
        label: 'ExtremelyLongUnbrokenLegendLabelThatMustRemainInsideTheAllocatedComponentWidth',
        color: 'rgb(1, 2, 3)',
      },
    ]}
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
    ></lr-word-cloud>`
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
    ></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  const before = el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox');
  el.style.setProperty('--lr-font', 'monospace');
  el.refreshTheme();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox')).to.not.equal(before);
});

it('preserves the focused word and its announcement across an explicit theme relayout', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`);
  await el.updateComplete;
  clickWord(el, 'beta');
  await el.updateComplete;
  const announcement = el.shadowRoot!.querySelector('[part="live-region"]')!.textContent;

  el.style.setProperty('--lr-font', 'monospace');
  el.refreshTheme();
  await el.updateComplete;

  const eventPromise = oneEvent(el, 'lr-word-activate');
  keydown(el, 'Enter');
  expect((await eventPromise).detail.text).to.equal('beta');
  expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.equal(announcement);
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
      ></lr-word-cloud>`
    )) as LyraWordCloud;
    await el.updateComplete;
  });
  expect(warnings.join('\n')).to.include('1 word(s)');
  expect(svgEl(el).getAttribute('aria-label')).to.include('1 word');
  expect(svgEl(el).getAttribute('aria-describedby')).to.equal('word-limit');
});

it('warns only once when the same omitted-word count recurs on one instance', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
  const warnings = await captureWarnings(async () => {
    el.words = [{ text: '', weight: 1 }, { text: 'kept', weight: 2 }];
    await el.updateComplete;
    el.words = [{ text: '   ', weight: 3 }, { text: 'fresh', weight: 4 }];
    await el.updateComplete;
  });

  expect(warnings.filter((warning) => warning.includes('1 word(s)'))).to.have.length(1);
});

it('keeps the palette on theme tokens so explicit dark themes are not overridden by the OS preference', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  el.style.setProperty('--lr-word-cloud-color-1', 'rgb(1, 2, 3)');
  el.refreshTheme();
  await el.updateComplete;
  const word = el.shadowRoot!.querySelector('[part="word"]') as SVGTextElement;
  expect(word.getAttribute('fill')).to.equal('rgb(1, 2, 3)');
});

it('inherits categorical palette hooks from an ancestor while direct host values still win', async () => {
  const wrapper = await fixture(html`
    <div style="--lr-word-cloud-color-1:rgb(4, 5, 6)">
      <lr-word-cloud .words=${WORDS}></lr-word-cloud>
    </div>
  `);
  const el = wrapper.querySelector('lr-word-cloud') as LyraWordCloud;
  await el.updateComplete;
  let word = el.shadowRoot!.querySelector('[part="word"]') as SVGTextElement;
  expect(word.getAttribute('fill')).to.equal('rgb(4, 5, 6)');

  el.style.setProperty('--lr-word-cloud-color-1', 'rgb(7, 8, 9)');
  el.refreshTheme();
  await el.updateComplete;
  word = el.shadowRoot!.querySelector('[part="word"]') as SVGTextElement;
  expect(word.getAttribute('fill')).to.equal('rgb(7, 8, 9)');
});

it("localizes the wordCloud aria-label's pluralized noun via this.localize()", async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  el.strings = { wordCloudWords: 'mots' };
  await el.updateComplete;
  expect(svgEl(el).getAttribute('aria-label')).to.equal(`Word cloud of ${WORDS.length} mots`);
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
  expect(svgEl(el).getAttribute('aria-label')).to.equal(`Word cloud of ${WORDS.length} words`);
});

it('requests an update (not a relayout) for a palette-only theme invalidation', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`);
  await el.updateComplete;
  const viewBoxBefore = el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox');
  let refreshes = 0;
  const originalRefresh = el.refreshTheme.bind(el);
  el.refreshTheme = () => {
    refreshes += 1;
    originalRefresh();
  };
  try {
    el.style.setProperty('--lr-word-cloud-color-1', 'rgb(9, 9, 9)');
    invalidateLyraTheme(el);
    await aTimeout(0);
    await el.updateComplete;
    expect(refreshes).to.equal(0);
    expect(el.shadowRoot!.querySelector('svg')!.getAttribute('viewBox')).to.equal(viewBoxBefore);
    const word = el.shadowRoot!.querySelector('[part="word"]') as SVGTextElement;
    expect(word.getAttribute('fill')).to.equal('rgb(9, 9, 9)');
  } finally {
    el.refreshTheme = originalRefresh;
  }
});

it('falls back to bounding-rect hit testing when the SVG has no screen transform', async () => {
  const el = (await fixture(
    html`<lr-word-cloud style="inline-size: 320px; block-size: 192px" .words=${WORDS}></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  const svg = svgEl(el);
  const original = svg.getScreenCTM;
  svg.getScreenCTM = () => null;
  try {
    const rect = svg.getBoundingClientRect();
    const eventPromise = oneEvent(el, 'lr-word-activate');
    svg.dispatchEvent(
      new MouseEvent('click', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
        composed: true,
      })
    );
    const event = await eventPromise;
    expect(WORDS.map((w) => w.text)).to.include((event as CustomEvent).detail.text);
  } finally {
    svg.getScreenCTM = original;
  }
});

it('ignores pointerdown/click when both the screen transform and the fallback bounding rect are unusable', async () => {
  const el = (await fixture(
    html`<lr-word-cloud style="inline-size: 320px; block-size: 192px" .words=${WORDS}></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  const svg = svgEl(el);
  const originalCtm = svg.getScreenCTM;
  const originalRect = svg.getBoundingClientRect;
  svg.getScreenCTM = () => null;
  svg.getBoundingClientRect = () => new DOMRect(0, 0, 0, 0);
  try {
    let fired = false;
    el.addEventListener('lr-word-activate', () => (fired = true), { once: true });
    svg.dispatchEvent(
      new PointerEvent('pointerdown', {
        clientX: 10,
        clientY: 10,
        pointerId: 1,
        bubbles: true,
        composed: true,
        buttons: 1,
      })
    );
    svg.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 10, bubbles: true, composed: true }));
    await el.updateComplete;
    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="focus-ring"]') == null).to.be.true;
  } finally {
    svg.getScreenCTM = originalCtm;
    svg.getBoundingClientRect = originalRect;
  }
});

it('marks the pointer-hovered word via data-hovered, and clears it on pointerleave', async () => {
  const el = (await fixture(
    html`<lr-word-cloud style="inline-size: 320px; block-size: 192px" .words=${WORDS}></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  const point = wordClientPoint(el, 'beta');
  svgEl(el).dispatchEvent(
    new PointerEvent('pointermove', { ...point, pointerId: 1, bubbles: true, composed: true })
  );
  await el.updateComplete;
  const betaNode = Array.from(el.shadowRoot!.querySelectorAll('[part="word"]')).find(
    (n) => n.textContent === 'beta'
  )!;
  expect(betaNode.hasAttribute('data-hovered')).to.be.true;

  svgEl(el).dispatchEvent(new PointerEvent('pointerleave', { pointerId: 1, bubbles: true, composed: true }));
  await el.updateComplete;
  expect(betaNode.hasAttribute('data-hovered')).to.be.false;
});

it('clears pointer hover when a relayout replaces the words under a stationary pointer', async () => {
  const el = await fixture<LyraWordCloud>(html`
    <lr-word-cloud
      style="inline-size: 320px; block-size: 192px"
      .words=${WORDS}
    ></lr-word-cloud>
  `);
  const point = wordClientPoint(el, 'beta');
  svgEl(el).dispatchEvent(
    new PointerEvent('pointermove', { ...point, pointerId: 1, bubbles: true, composed: true }),
  );
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="word"][data-hovered]')?.textContent).to.equal('beta');

  el.words = [
    { text: 'replacement-zero', weight: 10 },
    { text: 'replacement-one', weight: 5 },
  ];
  await el.updateComplete;

  expect(
    el.shadowRoot!.querySelector('[part="word"][data-hovered]') == null,
    'the replacement at the same original index must not inherit stale hover',
  ).to.be.true;
});

it('ignores a non-navigation key without moving the keyboard cursor', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`);
  await el.updateComplete;
  const event = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true });
  svgEl(el).dispatchEvent(event);
  await el.updateComplete;

  expect(event.defaultPrevented).to.be.false;
  expect(el.shadowRoot!.querySelectorAll('[part="focus-ring"]')).to.have.length(0);
});

it('clears the pressed cue on pointercancel', async () => {
  const el = (await fixture(
    html`<lr-word-cloud style="inline-size: 320px; block-size: 192px" .words=${WORDS}></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  pointerDownWord(el, 'beta');
  await el.updateComplete;
  let ring = el.shadowRoot!.querySelector('[part="focus-ring"]') as SVGRectElement;
  expect(ring.hasAttribute('data-pressed')).to.be.true;

  svgEl(el).dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true, composed: true }));
  await el.updateComplete;
  ring = el.shadowRoot!.querySelector('[part="focus-ring"]') as SVGRectElement;
  expect(ring.hasAttribute('data-pressed')).to.be.false;
});

it('resets transient interaction state (focus/hover/press/live text) on disconnect', async () => {
  const el = (await fixture(
    html`<lr-word-cloud style="inline-size: 320px; block-size: 192px" .words=${WORDS}></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  keydown(el, 'ArrowRight');
  pointerDownWord(el, 'beta');
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="focus-ring"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.not.equal('');

  const parent = el.parentNode!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  expect((el.shadowRoot!.querySelector('[part="focus-ring"]')) == null).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.equal('');
});

it('drops a word record whose text field is not a string, keeping valid neighbors', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
  const warnings = await captureWarnings(async () => {
    el.words = [{ text: 123, weight: 1 }, { text: 'valid', weight: 2 }] as never;
    await el.updateComplete;
  });
  expect(warnings).to.deep.equal([
    '<lr-word-cloud> could not place 1 word(s) (blank text, over the 150-word cap, or the layout search was exhausted) -- they were dropped, not rendered.',
  ]);
  expect(el.words.map((w) => w.text)).to.deep.equal(['valid']);
});

it('normalizes an omitted runtime weight to zero', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
  el.words = [{ text: 'weightless' }] as never;
  await el.updateComplete;
  expect(el.words[0]!.weight).to.equal(0);
});

it('normalizes non-array runtime collections without retaining stale words or legend entries', async () => {
  const el = await fixture<LyraWordCloud>(html`
    <lr-word-cloud show-legend .words=${WORDS}></lr-word-cloud>
  `);
  el.legend = [{ label: 'Existing', color: '#123456' }];
  el.palette = ['#654321'];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="svg"]')).to.exist;

  el.words = null as never;
  el.legend = { stale: true } as never;
  el.palette = 'not-a-palette' as never;
  await el.updateComplete;

  expect(el.words).to.deep.equal([]);
  expect(el.legend).to.deep.equal([]);
  expect(el.palette).to.deep.equal([]);
  expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
});

it('bounds oversized optional word metadata and reports the truncated record', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
  el.words = [
    {
      text: 'bounded',
      weight: 1,
      color: 'x'.repeat(300),
      group: 'y'.repeat(300),
    },
  ];
  await el.updateComplete;

  expect(el.words[0]!.color!.length).to.equal(256);
  expect(el.words[0]!.group!.length).to.equal(256);
  expect(el.words[0]!.color!.endsWith('…')).to.equal(true);
  expect(el.shadowRoot!.querySelector('[part="limit"]')).to.exist;
});

it('fails closed when collection length accessors throw after passing the array check', async () => {
  const hostileWords = new Proxy([], {
    get(target, key, receiver) {
      if (key === 'length') throw new Error('hostile word length');
      return Reflect.get(target, key, receiver);
    },
  });
  const hostileLegend = new Proxy([], {
    get(target, key, receiver) {
      if (key === 'length') throw new Error('hostile legend length');
      return Reflect.get(target, key, receiver);
    },
  });
  const hostilePalette = new Proxy([], {
    get(target, key, receiver) {
      if (key === 'length') throw new Error('hostile palette length');
      return Reflect.get(target, key, receiver);
    },
  });
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);

  el.words = hostileWords;
  el.legend = hostileLegend;
  el.palette = hostilePalette;
  await el.updateComplete;

  expect(el.words).to.deep.equal([]);
  expect(el.legend).to.deep.equal([]);
  expect(el.palette).to.equal(undefined);
});

it('renders an omission disclosure even when every supplied word is blank', async () => {
  const warnings = await captureWarnings(async () => {
    const el = await fixture<LyraWordCloud>(html`
      <lr-word-cloud .words=${[{ text: '   ', weight: 1 }]}></lr-word-cloud>
    `);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No data');
    expect(el.shadowRoot!.querySelector('[part="limit"]')!.textContent).to.contain('1 word');
  });
  expect(warnings.join('\n')).to.contain('1 word(s)');
});

it('draws a focus ring with rotated geometry for a keyboard-focused mixed word', async () => {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    const el = await fixture<LyraWordCloud>(html`
      <lr-word-cloud
        word-rotation="mixed"
        .words=${[{ text: 'rotated-wide-word', weight: 1 }]}
      ></lr-word-cloud>
    `);
    await el.updateComplete;
    svgEl(el).focus();
    await el.updateComplete;

    const word = el.shadowRoot!.querySelector('[part="word"]')!;
    const ring = el.shadowRoot!.querySelector('[part="focus-ring"]')!;
    expect(word.getAttribute('transform')).to.contain('rotate(-90');
    expect(Number(ring.getAttribute('height'))).to.be.greaterThan(Number(ring.getAttribute('width')));
  } finally {
    Math.random = originalRandom;
  }
});

it('drops a legend entry whose label is blank/whitespace-only, keeping valid neighbors', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud show-legend></lr-word-cloud>`);
  el.legend = [{ label: '   ', color: '#123456' }, { label: 'Valid', color: '#654321' }];
  await el.updateComplete;
  expect(el.legend.map((item) => item.label)).to.deep.equal(['Valid']);
});

it('drops entirely any word once the aggregate word-text character budget is exhausted', async () => {
  const words = Array.from({ length: 100 }, (_, i) => ({ text: 'x'.repeat(256), weight: i + 1 }));
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
  const warnings = await captureWarnings(async () => {
    el.words = words;
    await el.updateComplete;
  });
  // MAX_TOTAL_WORD_TEXT (16,384) / 256 chars per word caps well below the 100 supplied.
  expect(el.words.length).to.be.lessThan(100);
  expect(el.words.length).to.be.at.most(64);
  expect(warnings).to.deep.equal([
    '<lr-word-cloud> could not place 36 word(s) (blank text, over the 150-word cap, or the layout search was exhausted) -- they were dropped, not rendered.',
  ]);
});

it('drops (not truncates) an optional color field once the aggregate word-text budget hits exactly zero', async () => {
  const MAX_TOTAL_WORD_TEXT = 16_384; // mirrors the internal budget in word-cloud.class.ts
  const fillerCount = Math.floor((MAX_TOTAL_WORD_TEXT - 2) / 256);
  const remainderLen = MAX_TOTAL_WORD_TEXT - 2 - fillerCount * 256;
  const words: { text: string; weight: number; color?: string }[] = Array.from(
    { length: fillerCount },
    (_, i) => ({ text: 'x'.repeat(256), weight: i + 1 })
  );
  if (remainderLen > 0) words.push({ text: 'y'.repeat(remainderLen), weight: 999 });
  words.push({ text: 'ab', weight: 1000, color: 'blue' });

  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
  el.words = words;
  await el.updateComplete;

  const last = el.words[el.words.length - 1]!;
  expect(last.text).to.equal('ab');
  expect(last.color).to.equal(undefined);
  expect(el.shadowRoot!.querySelector('[part="limit"]')).to.exist;
});

it('retains later valid palette entries when a hostile indexed getter throws', async () => {
  const hostilePalette: unknown[] = ['rgb(1, 2, 3)', undefined, 'rgb(4, 5, 6)'];
  Object.defineProperty(hostilePalette, '1', {
    get: () => {
      throw new Error('hostile palette entry');
    },
  });
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud></lr-word-cloud>`);
  el.palette = hostilePalette as never;
  await el.updateComplete;
  expect(el.palette).to.deep.equal(['rgb(1, 2, 3)', 'rgb(4, 5, 6)']);
});

it('falls back to the default palette tokens when palette is assigned a revoked proxy', async () => {
  const { proxy, revoke } = Proxy.revocable([], {});
  revoke();
  const el = await fixture<LyraWordCloud>(
    html`<lr-word-cloud .words=${[{ text: 'alpha', weight: 1 }]}></lr-word-cloud>`
  );
  el.palette = proxy as never;
  await el.updateComplete;
  expect(el.palette).to.equal(undefined);
  const word = el.shadowRoot!.querySelector('[part="word"]')!;
  expect(word.getAttribute('fill')).to.not.equal(null);
});

it('shows only a legend-limit disclosure (no legend list) when every explicit legend entry is invalid', async () => {
  const el = await fixture<LyraWordCloud>(html`<lr-word-cloud show-legend .words=${WORDS}></lr-word-cloud>`);
  el.legend = [null, 'not-a-record', { label: 123 }] as never;
  await el.updateComplete;
  expect(el.legend).to.deep.equal([]);
  expect(el.shadowRoot!.querySelector('[part="legend"]') == null).to.be.true;
  expect(el.shadowRoot!.querySelector('[part="legend-limit"]')).to.exist;
});

it('relayouts when scale changes on a mounted element without reassigning words', async () => {
  const words = [
    { text: 'alpha', weight: 100 },
    { text: 'mid', weight: 50 },
    { text: 'gamma', weight: 1 },
  ];
  const el = (await fixture(
    html`<lr-word-cloud .words=${words} min-font-size="10" max-font-size="40"></lr-word-cloud>`
  )) as LyraWordCloud;
  await el.updateComplete;
  const midNode = () =>
    Array.from(el.shadowRoot!.querySelectorAll('[part="word"]')).find((n) => n.textContent === 'mid')!;
  const linearSize = Number(midNode().getAttribute('font-size'));

  el.scale = 'sqrt';
  await el.updateComplete;
  expect(el.scale).to.equal('sqrt');
  const sqrtSize = Number(midNode().getAttribute('font-size'));
  expect(sqrtSize).to.not.equal(linearSize);
});

it('requests an update for a redundant scale/wordRotation assignment that still normalizes to the current value', async () => {
  const el = (await fixture(html`<lr-word-cloud .words=${WORDS}></lr-word-cloud>`)) as LyraWordCloud;
  await el.updateComplete;
  expect(el.scale).to.equal('linear');
  expect(el.wordRotation).to.equal('none');

  let updateCount = 0;
  const originalRequestUpdate = el.requestUpdate.bind(el);
  el.requestUpdate = ((...args: Parameters<typeof originalRequestUpdate>) => {
    updateCount++;
    return originalRequestUpdate(...args);
  }) as typeof el.requestUpdate;
  try {
    el.scale = 'bogus' as never;
    expect(el.scale).to.equal('linear');
    expect(updateCount).to.be.greaterThan(0);

    updateCount = 0;
    el.wordRotation = 'bogus' as never;
    expect(el.wordRotation).to.equal('none');
    expect(updateCount).to.be.greaterThan(0);
  } finally {
    el.requestUpdate = originalRequestUpdate;
  }
});
