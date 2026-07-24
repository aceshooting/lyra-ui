import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './random-content.js';
import type { LyraRandomContent } from './random-content.js';
import { styles } from './random-content.styles.js';

// A stand-in for a wrapper component that re-projects its own light-DOM
// children through a nested `<slot>` (e.g. a card wrapper rendering its own
// shadow tree around whatever's passed to it). From `lr-random-content`'s
// point of view this wrapper is one opaque direct child -- its own further
// children must never become eligible on their own, proving
// `assignedElements()` was read without `{ flatten: true }`.
class RandomContentNestedWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.append(document.createElement('slot'));
  }
}
customElements.define('random-content-nested-wrapper', RandomContentNestedWrapper);

function shownChild(el: LyraRandomContent): HTMLElement {
  return ([...el.children] as HTMLElement[]).find((child) => !child.hidden)!;
}

function shownIds(el: LyraRandomContent): string[] {
  return ([...el.children] as HTMLElement[]).filter((child) => !child.hidden).map((child) => child.id);
}

/** Stubs `Math.random` to return a fixed sequence of values, cycling the last
 *  one once exhausted. Returns a restore function -- always call it, even on
 *  a failing assertion, so a later test never inherits a stubbed RNG. */
function stubRandomSequence(values: number[]): () => void {
  const original = Math.random;
  let index = 0;
  Math.random = () => {
    const value = values[Math.min(index, values.length - 1)];
    index += 1;
    return value;
  };
  return () => {
    Math.random = original;
  };
}

it('renders exactly one child by default and marks the rest hidden', async () => {
  const el = (await fixture(html`
    <lr-random-content>
      <div id="a">A</div>
      <div id="b">B</div>
      <div id="c">C</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;

  const children = [...el.children] as HTMLElement[];
  const shown = children.filter((child) => !child.hidden);
  const hidden = children.filter((child) => child.hidden);
  expect(shown.length).to.equal(1);
  expect(hidden.length).to.equal(2);
  expect(shown[0].getAttribute('aria-hidden')).to.equal('false');
  for (const child of hidden) {
    expect(child.getAttribute('aria-hidden')).to.equal('true');
  }
});

it('clamps items to the pool size in both directions and coerces invalid values to 1', async () => {
  const under = (await fixture(html`
    <lr-random-content items="2">
      <div>1</div>
      <div>2</div>
      <div>3</div>
      <div>4</div>
      <div>5</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await under.updateComplete;
  expect(shownIds(under).length).to.equal(2);

  const over = (await fixture(html`
    <lr-random-content items="10">
      <div>1</div>
      <div>2</div>
      <div>3</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await over.updateComplete;
  expect(([...over.children] as HTMLElement[]).filter((child) => !child.hidden).length).to.equal(3);

  for (const invalid of [0, -1, NaN]) {
    const el = (await fixture(html`
      <lr-random-content .items=${invalid}>
        <div>1</div>
        <div>2</div>
        <div>3</div>
      </lr-random-content>
    `)) as LyraRandomContent;
    await el.updateComplete;
    expect(
      ([...el.children] as HTMLElement[]).filter((child) => !child.hidden).length,
      `items=${invalid} should coerce to 1`,
    ).to.equal(1);
  }
});

it('mode="sequence" is deterministic and wraps around the pool', async () => {
  const el = (await fixture(html`
    <lr-random-content mode="sequence">
      <div id="s0">0</div>
      <div id="s1">1</div>
      <div id="s2">2</div>
      <div id="s3">3</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;

  // The initial connect selection is itself the first step of the sequence.
  expect(shownChild(el).id).to.equal('s0');
  expect(el.randomize().map((c) => c.id)).to.deep.equal(['s1']);
  expect(el.randomize().map((c) => c.id)).to.deep.equal(['s2']);
  expect(el.randomize().map((c) => c.id)).to.deep.equal(['s3']);
  expect(el.randomize().map((c) => c.id)).to.deep.equal(['s0']);
  expect(el.randomize().map((c) => c.id)).to.deep.equal(['s1']);
});

it('mode="random" may repeat the immediately-previous selection', async () => {
  let restore = stubRandomSequence([0]);
  let el: LyraRandomContent;
  try {
    el = (await fixture(html`
      <lr-random-content mode="random">
        <div id="r0">0</div>
        <div id="r1">1</div>
        <div id="r2">2</div>
        <div id="r3">3</div>
      </lr-random-content>
    `)) as LyraRandomContent;
    await el.updateComplete;
  } finally {
    restore();
  }
  expect(shownChild(el).id).to.equal('r0');

  restore = stubRandomSequence([0]);
  try {
    el.randomize();
  } finally {
    restore();
  }
  // 'random' has no anti-repeat logic: the exact same forced draw repeats.
  expect(shownChild(el).id).to.equal('r0');
});

it('mode="unique" retries to avoid repeating the immediately-previous selection when an alternative exists', async () => {
  let restore = stubRandomSequence([0]);
  let el: LyraRandomContent;
  try {
    el = (await fixture(html`
      <lr-random-content mode="unique">
        <div id="u0">0</div>
        <div id="u1">1</div>
        <div id="u2">2</div>
        <div id="u3">3</div>
      </lr-random-content>
    `)) as LyraRandomContent;
    await el.updateComplete;
  } finally {
    restore();
  }
  expect(shownChild(el).id).to.equal('u0');

  // First redraw attempt is stubbed to also land on u0 (forcing the retry
  // path); the retry's second attempt is stubbed to land on a different
  // element, proving the bounded retry actually re-draws.
  restore = stubRandomSequence([0, 0.3]);
  try {
    el.randomize();
  } finally {
    restore();
  }
  expect(shownChild(el).id).to.not.equal('u0');
});

it('mode="unique" accepts a forced repeat when no alternative composition exists (items === pool size)', async () => {
  const el = (await fixture(html`
    <lr-random-content mode="unique" items="3">
      <div id="p0">0</div>
      <div id="p1">1</div>
      <div id="p2">2</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  expect(shownIds(el).sort()).to.deep.equal(['p0', 'p1', 'p2']);
  el.randomize();
  // Every element is always shown -- the "repeat" is unavoidable and unique
  // mode must accept it rather than spin its bounded retry needlessly.
  expect(shownIds(el).sort()).to.deep.equal(['p0', 'p1', 'p2']);
});

it('emits lr-content-change on the first post-connect selection, with detail.items matching what is shown', async () => {
  // The listener must be attached before the element ever connects --
  // `fixture()` itself awaits the first render internally, so attaching
  // afterward would already be too late to observe this event.
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lr-random-content') as LyraRandomContent;
  el.innerHTML = '<div id="x">X</div><div id="y">Y</div><div id="z">Z</div>';
  const eventPromise = oneEvent(el, 'lr-content-change');
  container.append(el);
  const event = await eventPromise;
  await el.updateComplete;

  const detailIds = (event.detail.items as HTMLElement[]).map((item) => item.id);
  expect(detailIds).to.deep.equal(shownIds(el));
  expect(detailIds.length).to.equal(1);
});

it('emits lr-content-change on randomize(), and its return value matches detail.items', async () => {
  const el = (await fixture(html`
    <lr-random-content mode="sequence">
      <div id="m0">0</div>
      <div id="m1">1</div>
      <div id="m2">2</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;

  const eventPromise = oneEvent(el, 'lr-content-change');
  const returned = el.randomize();
  const event = await eventPromise;
  expect((event.detail.items as HTMLElement[]).map((item) => item.id)).to.deep.equal(returned.map((item) => item.id));
});

it('re-runs selection and emits again when the slotted pool changes (slotchange)', async () => {
  const el = (await fixture(html`
    <lr-random-content>
      <div id="c0">0</div>
      <div id="c1">1</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;

  const eventPromise = oneEvent(el, 'lr-content-change');
  const added = document.createElement('div');
  added.id = 'c2';
  el.appendChild(added);
  const event = await eventPromise;
  await el.updateComplete;

  expect(([...el.children] as HTMLElement[]).map((child) => child.id)).to.deep.equal(['c0', 'c1', 'c2']);
  expect((event.detail.items as HTMLElement[]).length).to.equal(1);
});

it('restarts autoplay after a disconnect/reconnect cycle instead of leaving it permanently stopped', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lr-random-content') as LyraRandomContent;
  el.autoplay = true;
  el.setAttribute('autoplay-interval', '1000');
  el.setAttribute('mode', 'sequence');
  el.innerHTML = '<div id="d0">0</div><div id="d1">1</div>';
  container.append(el);
  await el.updateComplete;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).timer, 'autoplay should be running after the initial connect').to.not.be.undefined;

  el.remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).timer, 'disconnect must stop the timer').to.be.undefined;

  container.append(el);
  await el.updateComplete;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).timer, 'reconnecting must restart autoplay -- firstUpdated() never runs again').to.not.be
    .undefined;
});

it('clears stale focus-within suspension across a focused disconnect/reconnect cycle', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lr-random-content') as LyraRandomContent;
  el.autoplay = true;
  el.autoplayInterval = 1000;
  el.mode = 'sequence';
  el.innerHTML = '<button id="focused-reconnect">Focused</button><button>Other</button>';
  container.append(el);
  await el.updateComplete;

  (el.querySelector('#focused-reconnect') as HTMLButtonElement).focus();
  await Promise.resolve();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).timer).to.be.undefined;

  el.remove();
  container.append(el);
  await el.updateComplete;
  await Promise.resolve();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).timer).to.not.be.undefined;
});

it('immediately reapplies one configured selection on reconnect without enabling mount announcements', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lr-random-content') as LyraRandomContent;
  el.setAttribute('mode', 'sequence');
  el.innerHTML = '<div id="reconnect-0">0</div><div id="reconnect-1">1</div>';
  container.append(el);
  await el.updateComplete;
  expect(shownIds(el).length).to.equal(1);

  el.remove();
  expect(shownIds(el).length).to.equal(2);
  container.append(el);
  await el.updateComplete;

  expect(shownIds(el).length).to.equal(1);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-live')).to.equal('off');
});

it('autoplay ticks at the clamped 1000ms floor and stops on disconnect', async () => {
  const el = (await fixture(html`
    <lr-random-content autoplay autoplay-interval="10" mode="sequence">
      <div id="a0">0</div>
      <div id="a1">1</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  expect(shownChild(el).id).to.equal('a0');

  // autoplay-interval="10" is clamped up to the 1000ms floor -- confirm no
  // tick has happened well before that floor.
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(shownChild(el).id).to.equal('a0');

  const eventPromise = oneEvent(el, 'lr-content-change');
  await eventPromise;
  await el.updateComplete;
  expect(shownChild(el).id).to.equal('a1');

  let firedAfterDisconnect = false;
  el.addEventListener('lr-content-change', () => (firedAfterDisconnect = true));
  el.remove();
  await new Promise((resolve) => setTimeout(resolve, 1200));
  expect(firedAfterDisconnect).to.be.false;
  expect(
    ([...el.children] as HTMLElement[]).every((child) => !child.hidden),
    'disconnect restores the author-owned visibility state instead of freezing the last managed selection',
  ).to.be.true;
});

it('pauses autoplay while focus is inside and never hides the focused subtree', async () => {
  const outside = (await fixture(html`<button>Outside</button>`)) as HTMLButtonElement;
  const el = (await fixture(html`
    <lr-random-content autoplay autoplay-interval="1000" mode="sequence">
      <button id="focus-a">A</button>
      <button id="focus-b">B</button>
      <button id="focus-c">C</button>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;

  const focused = el.querySelector('#focus-c') as HTMLButtonElement;
  focused.hidden = false;
  focused.removeAttribute('aria-hidden');
  focused.focus();
  await new Promise((resolve) => setTimeout(resolve, 0));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).timer, 'focus inside must suspend autoplay').to.be.undefined;

  el.randomize();
  expect(focused.hidden, 'a manual reselection must not hide the subtree that still owns focus').to.be.false;

  outside.focus();
  await new Promise((resolve) => setTimeout(resolve, 0));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).timer, 'autoplay resumes after focus leaves').to.not.be.undefined;
});

it('exposes a localized pause/resume action whenever autoplay is enabled', async () => {
  const el = (await fixture(html`
    <lr-random-content
      autoplay
      .strings=${{ randomContentPause: 'Pause locale', randomContentResume: 'Resume locale' }}
    >
      <div>One</div>
      <div>Two</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  const button = el.shadowRoot!.querySelector('[part="pause-button"]') as HTMLButtonElement;
  expect(button.getAttribute('aria-label')).to.equal('Pause locale');
  expect(button.getAttribute('aria-pressed')).to.equal('false');

  button.click();
  await el.updateComplete;
  expect(el.paused).to.be.true;
  expect(el.hasAttribute('paused')).to.be.true;
  expect(button.getAttribute('aria-label')).to.equal('Resume locale');
  expect(button.getAttribute('aria-pressed')).to.equal('true');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).timer).to.be.undefined;
});

it('leaves paused explicitly unset by default', async () => {
  const el = (await fixture(html`
    <lr-random-content autoplay>
      <div>One</div>
      <div>Two</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  const button = el.shadowRoot!.querySelector('[part="pause-button"]') as HTMLButtonElement;
  expect(el.paused).to.be.false;
  expect(el.hasAttribute('paused')).to.be.false;
  expect(button.getAttribute('aria-pressed')).to.equal('false');
});

it('does not autoplay-tick when only one eligible child exists', async () => {
  const el = (await fixture(html`
    <lr-random-content autoplay autoplay-interval="1000">
      <div id="only">Only</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).timer).to.be.undefined;
  await new Promise((resolve) => setTimeout(resolve, 1200));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  expect((el as any).timer).to.be.undefined;
});

it('disables autoplay ticking entirely under prefers-reduced-motion', async () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as typeof window.matchMedia;

  try {
    const el = (await fixture(html`
      <lr-random-content autoplay autoplay-interval="1000" mode="sequence">
        <div id="r0">0</div>
        <div id="r1">1</div>
      </lr-random-content>
    `)) as LyraRandomContent;
    await el.updateComplete;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((el as any).reduceMotion).to.be.true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((el as any).timer).to.be.undefined;
    const before = shownChild(el).id;
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(shownChild(el).id).to.equal(before);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it('explicitly guards the entrance animation under prefers-reduced-motion for ::slotted content', () => {
  // The shared reduced-motion rule in tokens.styles.ts only reaches the
  // shadow tree, not ::slotted() content -- this proves the explicit guard
  // exists rather than relying on that (non-reaching) global rule.
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include("@media (prefers-reduced-motion: reduce) { ::slotted(*) { animation: none !important; } }");
});

it('reflects the animation attribute and gates the matching keyframe', async () => {
  const el = (await fixture(html`
    <lr-random-content animation="fade-up">
      <div>1</div>
      <div>2</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  expect(el.getAttribute('animation')).to.equal('fade-up');

  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.include("[animation='fade-up']");
  expect(css).to.include('lr-random-content-fade-in-up');
});

it('exposes the documented animation custom properties with WA-matching defaults', () => {
  const css = styles.cssText;
  expect(css).to.include('var(--lr-random-content-animation-duration, 300ms)');
  expect(css).to.include('var(--lr-random-content-animation-easing, ease)');
  expect(css).to.include('var(--lr-random-content-animation-translate, var(--lr-size-0-5em))');
});

it('forwards a host aria-label to the internal role="status" element, and omits it when absent', async () => {
  const withLabel = (await fixture(html`
    <lr-random-content aria-label="Homepage hero copy">
      <div>1</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await withLabel.updateComplete;
  expect(withLabel.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Homepage hero copy',
  );

  const withoutLabel = (await fixture(html`
    <lr-random-content>
      <div>1</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await withoutLabel.updateComplete;
  expect(withoutLabel.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('aria-label')).to.be.false;
});

it('suppresses the initial mount announcement, then enables polite announcements for manual changes', async () => {
  const idle = (await fixture(html`<lr-random-content><div>1</div></lr-random-content>`)) as LyraRandomContent;
  await idle.updateComplete;
  const idleBase = idle.shadowRoot!.querySelector('[part="base"]')!;
  expect(idleBase.getAttribute('aria-live')).to.equal('off');
  expect(idleBase.getAttribute('aria-atomic')).to.equal('true');
  idle.randomize();
  await idle.updateComplete;
  expect(idleBase.getAttribute('aria-live')).to.equal('polite');

  const autoplaying = (await fixture(html`
    <lr-random-content autoplay>
      <div>1</div>
      <div>2</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await autoplaying.updateComplete;
  const autoBase = autoplaying.shadowRoot!.querySelector('[part="base"]')!;
  expect(autoBase.getAttribute('aria-live')).to.equal('off');
  expect(autoBase.getAttribute('aria-atomic')).to.equal('true');
});

it('restores every author-supplied hidden/aria-hidden state when it stops managing a child', async () => {
  const el = (await fixture(html`
    <lr-random-content mode="sequence">
      <div id="author-hidden" hidden aria-hidden="true">Hidden by author</div>
      <div id="author-visible" aria-hidden="false">Visible by author</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  const authorHidden = el.querySelector('#author-hidden') as HTMLElement;
  const authorVisible = el.querySelector('#author-visible') as HTMLElement;

  el.remove();
  expect(authorHidden.hidden).to.be.true;
  expect(authorHidden.getAttribute('aria-hidden')).to.equal('true');
  expect(authorVisible.hidden).to.be.false;
  expect(authorVisible.getAttribute('aria-hidden')).to.equal('false');
});

it('restores the author-supplied hidden="until-found" mode exactly', async () => {
  const el = (await fixture(html`
    <lr-random-content mode="sequence">
      <div id="until-found" hidden="until-found">Findable hidden content</div>
      <div>Visible content</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  const untilFound = el.querySelector('#until-found') as HTMLElement;

  el.remove();
  expect(untilFound.getAttribute('hidden')).to.equal('until-found');
});

it('only treats direct children as eligible, not elements re-slotted through a nested wrapper (no flatten)', async () => {
  const el = (await fixture(html`
    <lr-random-content items="1" mode="sequence">
      <random-content-nested-wrapper id="wrapper">
        <div id="nested">nested</div>
      </random-content-nested-wrapper>
      <div id="direct">direct</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;

  const wrapper = el.querySelector('#wrapper') as HTMLElement;
  const nested = el.querySelector('#nested') as HTMLElement;
  const direct = el.querySelector('#direct') as HTMLElement;

  expect(wrapper.hidden).to.be.false;
  expect(direct.hidden).to.be.true;
  // The wrapper's own nested content is never a candidate at all -- proves
  // `assignedElements()` was read without `{ flatten: true }`, which would
  // have pulled #nested directly into the pool instead of the wrapper itself.
  expect(nested.hasAttribute('hidden')).to.be.false;
  expect(nested.hasAttribute('aria-hidden')).to.be.false;
});

it('ignores stray text nodes between slotted elements', async () => {
  const el = (await fixture(html`
    <lr-random-content items="5">
      <div id="t1">1</div>
      a stray run of text
      <div id="t2">2</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  expect(shownIds(el).sort()).to.deep.equal(['t1', 't2']);
});

it('does not overflow a narrow ancestor even with a long intrinsic-width slotted child', async () => {
  const container = (await fixture(
    html`<div style="inline-size: 200px; overflow: hidden;"></div>`,
  )) as HTMLDivElement;
  const el = document.createElement('lr-random-content') as LyraRandomContent;
  const long = document.createElement('div');
  long.style.whiteSpace = 'pre';
  long.textContent =
    'A very long unbroken line of testimonial copy that would otherwise force a wide intrinsic size onto its ancestor.';
  el.appendChild(long);
  container.append(el);
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(getComputedStyle(el).minInlineSize).to.equal('0px');
  expect(getComputedStyle(base).minInlineSize).to.equal('0px');
});

it('renders non-autoplay content correctly with no locale registered', async () => {
  const el = (await fixture(html`
    <lr-random-content>
      <div id="only">Only child</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="base"]')).to.exist;
  expect((el.children[0] as HTMLElement).hidden).to.be.false;
});

it('is accessible', async () => {
  const el = (await fixture(html`
    <lr-random-content aria-label="Rotating tips">
      <div>Tip one</div>
      <div>Tip two</div>
      <div>Tip three</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible while autoplaying', async () => {
  const el = (await fixture(html`
    <lr-random-content autoplay aria-label="Rotating tips">
      <div>Tip one</div>
      <div>Tip two</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
