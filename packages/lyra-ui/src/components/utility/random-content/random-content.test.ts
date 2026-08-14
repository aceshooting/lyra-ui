import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './random-content.js';
import type { LyraRandomContent } from './random-content.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

// A stand-in for a wrapper component that re-projects its own light-DOM
// children through a nested `<slot>` (e.g. a card wrapper rendering its own
// shadow tree around whatever's passed to it). From `lr-random-content`'s
// point of view this wrapper is one opaque direct child -- its own further
// children must never become eligible on their own. Flattened slot assignment
// follows forwarding `<slot>` elements but does not cross an arbitrary custom
// element's shadow root.
class RandomContentNestedWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.append(document.createElement('slot'));
  }
}
customElements.define('random-content-nested-wrapper', RandomContentNestedWrapper);

class RandomContentLiveTextForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const randomContent = document.createElement('lr-random-content');
    randomContent.mode = 'sequence';
    const candidate = document.createElement('div');
    const forwardingSlot = document.createElement('slot');
    forwardingSlot.textContent = 'Fallback selection';
    candidate.append(forwardingSlot);
    randomContent.append(candidate);
    root.append(randomContent);
  }
}
if (!customElements.get('random-content-live-text-forward-wrapper')) {
  customElements.define('random-content-live-text-forward-wrapper', RandomContentLiveTextForwardWrapper);
}

class RandomContentPoolForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const randomContent = document.createElement('lr-random-content');
    randomContent.mode = 'sequence';
    randomContent.append(document.createElement('slot'));
    root.append(randomContent);
  }
}
if (!customElements.get('random-content-pool-forward-wrapper')) {
  customElements.define('random-content-pool-forward-wrapper', RandomContentPoolForwardWrapper);
}

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

it('reflects the pinned Web Awesome mode property', async () => {
  const el = (await fixture(html`
    <lr-random-content
      ><div>Alpha</div>
      <div>Beta</div></lr-random-content
    >
  `)) as LyraRandomContent;
  el.mode = 'sequence';
  await el.updateComplete;
  expect(el.getAttribute('mode')).to.equal('sequence');
});

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

it('selects direct SVG candidates, reports them as Elements, and restores authored state', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lr-random-content') as LyraRandomContent;
  el.mode = 'sequence';
  el.innerHTML = `
    <svg id="svg-candidate" hidden="until-found" aria-hidden="true" viewBox="0 0 10 10">
      <circle cx="5" cy="5" r="4"></circle>
    </svg>
    <div id="html-candidate">HTML</div>
  `;
  const eventPromise = oneEvent(el, 'lr-content-change');
  container.append(el);
  const event = await eventPromise;
  await el.updateComplete;

  const svg = el.querySelector('#svg-candidate') as SVGSVGElement;
  expect(event.detail.items.map((item: Element) => item.id)).to.deep.equal([svg.id]);
  expect(event.detail.items[0]).to.be.instanceOf(SVGElement);
  expect(svg.hasAttribute('hidden')).to.be.false;
  expect(svg.getAttribute('aria-hidden')).to.equal('false');

  svg.remove();
  await Promise.resolve();
  expect(svg.getAttribute('hidden')).to.equal('until-found');
  expect(svg.getAttribute('aria-hidden')).to.equal('true');
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

it('exposes a frozen selection snapshot that cannot mutate the component-owned previous selection', async () => {
  const el = (await fixture(html`
    <lr-random-content mode="sequence">
      <div id="snapshot-0">0</div>
      <div id="snapshot-1">1</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  const changed = oneEvent(el, 'lr-content-change');
  const returned = el.randomize();
  const event = await changed;
  expect(Object.isFrozen(returned)).to.equal(true);
  expect(Object.isFrozen(event.detail)).to.equal(true);
  expect(event.detail.items === returned).to.equal(true);
  expect(() => (event.detail.items as Element[]).pop()).to.throw(TypeError);
  expect(shownIds(el)).to.deep.equal((returned as HTMLElement[]).map((item) => item.id));
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

it('selects flattened candidates from a direct forwarding slot and restores external author state', async () => {
  const wrapper = (await fixture(html`
    <random-content-pool-forward-wrapper>
      <div id="forwarded-a">Forwarded A</div>
      <div id="forwarded-b">Forwarded B</div>
    </random-content-pool-forward-wrapper>
  `)) as RandomContentPoolForwardWrapper;
  const el = wrapper.shadowRoot!.querySelector('lr-random-content') as LyraRandomContent;
  await el.updateComplete;
  const first = wrapper.querySelector('#forwarded-a') as HTMLElement;
  const second = wrapper.querySelector('#forwarded-b') as HTMLElement;
  expect([first, second].filter((candidate) => !candidate.hidden).map((candidate) => candidate.id)).to.deep.equal([
    'forwarded-a',
  ]);

  const change = oneEvent(el, 'lr-content-change');
  const returned = el.randomize();
  const event = await change;
  expect(returned.map((candidate) => candidate.id)).to.deep.equal(['forwarded-b']);
  expect((event.detail.items as HTMLElement[]).map((candidate) => candidate.id)).to.deep.equal(['forwarded-b']);

  el.randomize();
  expect(first.hidden, 'the first forwarded candidate is selected again').to.be.false;
  first.setAttribute('hidden', 'until-found');
  first.setAttribute('aria-hidden', 'true');
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(first.hidden, 'component selection remains applied while the candidate is managed').to.be.false;
  expect(first.getAttribute('aria-hidden')).to.equal('false');

  const forwardingSlot = el.querySelector<HTMLSlotElement>('slot')!;
  const slotChanged = oneEvent(forwardingSlot, 'slotchange');
  first.remove();
  await slotChanged;
  await Promise.resolve();
  expect(first.getAttribute('hidden')).to.equal('until-found');
  expect(first.getAttribute('aria-hidden')).to.equal('true');
  expect(second.hidden, 'the remaining forwarded candidate is selected').to.be.false;
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
  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;
  expect(sink.childElementCount).to.equal(0);
  expect(el.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('aria-live')).to.be.false;
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
  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;
  const announcementsBeforeTick = sink.childElementCount;

  // autoplay-interval="10" is clamped up to the 1000ms floor -- confirm no
  // tick has happened well before that floor.
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(shownChild(el).id).to.equal('a0');

  const eventPromise = oneEvent(el, 'lr-content-change');
  await eventPromise;
  await el.updateComplete;
  expect(shownChild(el).id).to.equal('a1');
  expect(sink.childElementCount, 'timer-driven selections stay silent').to.equal(announcementsBeforeTick);

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
      .strings=${{
        randomContentPause: 'Pause locale',
        randomContentResume: 'Resume locale',
      }}
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

it('emits lr-pause-change with the new paused state from the built-in pause/resume button', async () => {
  const el = (await fixture(html`
    <lr-random-content autoplay>
      <div>One</div>
      <div>Two</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  const button = el.shadowRoot!.querySelector('[part="pause-button"]') as HTMLButtonElement;

  // A host mirroring `paused` into its own UI (or persisting it) has no other way to learn the
  // user toggled the built-in control -- matching <lr-poll-status>'s identical lr-pause-change
  // contract for the identical affordance.
  const pausedEvent = oneEvent(el, 'lr-pause-change');
  button.click();
  const paused = await pausedEvent;
  expect(paused.detail).to.deep.equal({ paused: true });
  expect(Object.isFrozen(paused.detail)).to.equal(true);
  expect(el.paused).to.equal(true);

  const resumedEvent = oneEvent(el, 'lr-pause-change');
  button.click();
  const resumed = await resumedEvent;
  expect(resumed.detail).to.deep.equal({ paused: false });
  expect(el.paused).to.equal(false);
});

it('does not emit lr-pause-change when the host writes paused programmatically', async () => {
  const el = (await fixture(html`
    <lr-random-content autoplay>
      <div>One</div>
      <div>Two</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  let emitted = 0;
  el.addEventListener('lr-pause-change', () => {
    emitted += 1;
  });

  // Self-mutation must not echo back: a controlled binding writing `paused` would otherwise loop.
  el.paused = true;
  await el.updateComplete;
  expect(emitted).to.equal(0);
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

it('explicitly stops the rendered ::slotted entrance animation under prefers-reduced-motion', async () => {
  // The shared reduced-motion rule in tokens.styles.ts only reaches the
  // shadow tree, not ::slotted() content, so activate this component's media rule and assert the
  // rendered result rather than merely matching stylesheet text.
  const el = (await fixture(html`
    <lr-random-content animation="fade"
      ><div>One</div>
      <div>Two</div></lr-random-content
    >
  `)) as LyraRandomContent;
  await el.updateComplete;
  const shown = shownChild(el);
  expect(getComputedStyle(shown).animationName).to.equal('lr-random-content-fade-in');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    expect(getComputedStyle(shown).animationName).to.equal('none');
    return;
  }
  const reducedRule = el
    .shadowRoot!.adoptedStyleSheets.flatMap((sheet) => [...sheet.cssRules])
    .find(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule &&
        rule.conditionText === '(prefers-reduced-motion: reduce)' &&
        [...rule.cssRules].some(
          (nested) =>
            nested instanceof CSSStyleRule &&
            nested.selectorText.includes('::slotted') &&
            nested.style.getPropertyPriority('animation') === 'important',
        ),
    );
  expect(reducedRule).to.exist;
  const originalCondition = reducedRule!.media.mediaText;
  try {
    reducedRule!.media.mediaText = 'all';
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(getComputedStyle(shown).animationName).to.equal('none');
  } finally {
    reducedRule!.media.mediaText = originalCondition;
  }
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
  expect(getComputedStyle(shownChild(el)).animationName).to.equal('lr-random-content-fade-in-up');
});

it('gives an inline candidate a transformable box and real directional travel', async () => {
  const el = (await fixture(html`
    <lr-random-content animation="fade-left" style="--animation-duration: 10s">
      <span id="inline-candidate">Inline candidate</span>
      <span>Other</span>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  const shown = shownChild(el);

  expect(getComputedStyle(shown).display).to.equal('inline-block');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const animation = shown
    .getAnimations()
    .find((candidate) => candidate.animationName === 'lr-random-content-fade-in-left');
  expect(animation).to.exist;
  const keyframes = (animation!.effect as KeyframeEffect).getKeyframes();
  expect(keyframes.some((frame) => frame.transform !== undefined && frame.transform !== 'none')).to.be.true;
});

it('supports mapped short animation CSS aliases while retaining the existing long names', async () => {
  const upstream = (await fixture(html`
    <lr-random-content
      animation="fade-up"
      style="--animation-duration: 3s; --animation-easing: steps(2); --animation-translate: 12px"
      ><div>One</div>
      <div>Two</div></lr-random-content
    >
  `)) as LyraRandomContent;
  const upstreamStyle = getComputedStyle(shownChild(upstream));
  expect(upstreamStyle.animationDuration).to.equal('3s');
  expect(upstreamStyle.animationTimingFunction).to.equal('steps(2)');

  const short = (await fixture(html`
    <lr-random-content
      animation="fade-up"
      style="--lr-animation-duration: 2s; --lr-animation-easing: linear; --lr-animation-translate: 10px"
      ><div>One</div>
      <div>Two</div></lr-random-content
    >
  `)) as LyraRandomContent;
  const shortStyle = getComputedStyle(shownChild(short));
  expect(shortStyle.animationDuration).to.equal('2s');
  expect(shortStyle.animationTimingFunction).to.equal('linear');
  expect(shortStyle.getPropertyValue('--lr-animation-translate').trim()).to.equal('10px');

  const legacy = (await fixture(html`
    <lr-random-content
      animation="fade"
      style="--lr-random-content-animation-duration: 4s; --lr-random-content-animation-easing: ease-in"
      ><div>One</div>
      <div>Two</div></lr-random-content
    >
  `)) as LyraRandomContent;
  const legacyStyle = getComputedStyle(shownChild(legacy));
  expect(legacyStyle.animationDuration).to.equal('4s');
  expect(legacyStyle.animationTimingFunction).to.equal('ease-in');
});

it('exposes randomize as a prototype method, not an instance callback field', async () => {
  const el = (await fixture(html`
    <lr-random-content
      ><div>One</div>
      <div>Two</div></lr-random-content
    >
  `)) as LyraRandomContent;
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'randomize');
  expect(descriptor?.value === el.randomize).to.equal(true);
  expect(el.randomize()).to.have.length(1);
});

it('treats invalid runtime animation as none and invalid mode as unique', async () => {
  const el = (await fixture(html`
    <lr-random-content animation="invalid" mode="invalid">
      <div id="a">One</div>
      <div id="b">Two</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  expect(getComputedStyle(shownChild(el)).animationName).to.equal('none');

  const previous = shownIds(el)[0]!;
  const samePick = previous === 'a' ? 0 : 0.99;
  const differentPick = previous === 'a' ? 0.99 : 0;
  const restore = stubRandomSequence([samePick, differentPick]);
  try {
    el.randomize();
    expect(shownIds(el)).to.deep.equal([previous === 'a' ? 'b' : 'a']);
  } finally {
    restore();
  }
});

it('uses a labelled group for authored aria-label context and no redundant role when unnamed', async () => {
  const withLabel = (await fixture(html`
    <lr-random-content aria-label="Homepage hero copy">
      <div>1</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await withLabel.updateComplete;
  expect(withLabel.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
    'Homepage hero copy',
  );
  expect(withLabel.shadowRoot!.querySelector('[part="base"]')!.getAttribute('role')).to.equal('group');

  const withoutLabel = (await fixture(html`
    <lr-random-content>
      <div>1</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await withoutLabel.updateComplete;
  expect(withoutLabel.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('aria-label')).to.be.false;
  expect(withoutLabel.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('role')).to.be.false;
});

it('suppresses mount announcements, appends every manual selection, and keeps timer-driven autoplay silent', async () => {
  const idle = (await fixture(html`
    <lr-random-content mode="sequence"
      ><div>One</div>
      <div>Two</div></lr-random-content
    >
  `)) as LyraRandomContent;
  await idle.updateComplete;
  const idleBase = idle.shadowRoot!.querySelector('[part="base"]')!;
  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;
  expect(idleBase.hasAttribute('aria-live')).to.be.false;
  expect(idleBase.hasAttribute('role')).to.be.false;
  expect(sink.childElementCount).to.equal(0);
  idle.randomize();
  idle.randomize();
  idle.randomize();
  expect([...sink.children].map((node) => node.textContent)).to.deep.equal(['Two', 'One', 'Two']);

  const autoplaying = (await fixture(html`
    <lr-random-content autoplay autoplay-interval="10000" mode="sequence">
      <div>Auto one</div>
      <div>Auto two</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await autoplaying.updateComplete;
  const autoBase = autoplaying.shadowRoot!.querySelector('[part="base"]')!;
  const before = sink.childElementCount;
  autoplaying.randomize();
  expect(autoBase.hasAttribute('aria-live')).to.be.false;
  expect(sink.childElementCount, 'manual randomize announces even while autoplay is enabled').to.equal(before + 1);
  expect(sink.lastElementChild?.textContent).to.equal('Auto two');
});

it('excludes nested hidden and aria-hidden descendants from manual-selection announcements', async () => {
  const el = (await fixture(html`
    <lr-random-content mode="sequence">
      <div>Initial</div>
      <div>
        Visible
        <span hidden>native hidden text</span>
        <span aria-hidden=" TRUE ">ARIA hidden <strong>nested text</strong></span>
        <span style="display: none">CSS display hidden</span>
        <span style="visibility: hidden"
          >CSS visibility hidden <span style="visibility: visible">Visibility override</span></span
        >
        <span style="content-visibility: hidden">CSS content hidden</span>
        <span>ending</span>
      </div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;

  el.randomize();

  expect(sink.lastElementChild?.textContent).to.equal('Visible Visibility override ending');
});

it('extracts and observes assigned text behind a nested forwarding slot without mount noise', async () => {
  const wrapper = (await fixture(html`
    <random-content-live-text-forward-wrapper>
      <span id="forwarded-selection">Initial forwarded selection</span>
    </random-content-live-text-forward-wrapper>
  `)) as RandomContentLiveTextForwardWrapper;
  const el = wrapper.shadowRoot!.querySelector('lr-random-content') as LyraRandomContent;
  await el.updateComplete;
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;
  expect(sink.childElementCount, 'initial forwarded content stays silent').to.equal(0);

  wrapper.querySelector('#forwarded-selection')!.textContent = 'Updated forwarded selection';
  await Promise.resolve();
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal('Updated forwarded selection');
  expect(sink.textContent).to.not.include('Fallback');

  const selection = wrapper.querySelector('#forwarded-selection') as HTMLElement;
  const countBeforeHide = sink.childElementCount;
  selection.hidden = true;
  await Promise.resolve();
  await Promise.resolve();
  expect(sink.childElementCount, 'hiding all selected text does not append an empty message').to.equal(countBeforeHide);
  selection.hidden = false;
  await Promise.resolve();
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal('Updated forwarded selection');
  expect(sink.childElementCount).to.equal(countBeforeHide + 1);

  const forwardingSlot = el.querySelector<HTMLSlotElement>('slot')!;
  const slotChanged = oneEvent(forwardingSlot, 'slotchange');
  const detail = document.createElement('span');
  detail.textContent = 'Added forwarded detail';
  wrapper.append(detail);
  await slotChanged;
  await Promise.resolve();
  expect(sink.lastElementChild?.textContent).to.equal('Updated forwarded selection Added forwarded detail');
  expect(sink.textContent).to.not.include('Fallback');
});

it('announces rendered shadow content and image alternatives without leaking an unassigned named slot', async () => {
  const el = document.createElement('lr-random-content') as LyraRandomContent;
  el.mode = 'sequence';
  const initial = document.createElement('div');
  initial.textContent = 'Initial selection';
  const candidate = document.createElement('div');
  const shadowHost = document.createElement('div');
  const shadow = shadowHost.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<span>Rendered shadow selection</span><slot></slot>';
  const assigned = document.createElement('span');
  assigned.textContent = 'Rendered assigned selection';
  const unassigned = document.createElement('span');
  unassigned.slot = 'missing';
  unassigned.textContent = 'Unassigned selection leak';
  shadowHost.append(assigned, unassigned);
  const image = document.createElement('img');
  image.alt = 'Selection diagram';
  candidate.append(shadowHost, image);
  el.append(initial, candidate);
  document.body.append(el);
  await el.updateComplete;
  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;

  el.randomize();

  expect(sink.lastElementChild?.textContent).to.equal(
    'Rendered shadow selection Rendered assigned selection Selection diagram',
  );
  el.remove();
});

it('keeps explicit randomize() silent while the component host is hidden', async () => {
  const el = (await fixture(html`
    <lr-random-content hidden mode="sequence">
      <div>One</div>
      <div>Two</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;

  el.randomize();
  expect(sink.childElementCount, 'a hidden source must not speak through a document sink').to.equal(0);

  el.hidden = false;
  el.randomize();
  expect(sink.lastElementChild?.textContent).to.equal('One');
});

it('rebinds observer, media-query, timer, eligibility, and announcement work to an adopted iframe realm', async () => {
  const container = (await fixture(html`<div><iframe></iframe></div>`)) as HTMLDivElement;
  const iframe = container.querySelector('iframe')!;
  const ownerWindow = iframe.contentWindow!;
  const ownerDocument = iframe.contentDocument!;
  const originalMatchMedia = ownerWindow.matchMedia;
  const originalSetInterval = ownerWindow.setInterval;
  const originalClearInterval = ownerWindow.clearInterval;
  const originalMutationObserver = ownerWindow.MutationObserver;
  let matchMediaCalls = 0;
  let setIntervalCalls = 0;
  let clearIntervalCalls = 0;
  let mutationObserverConstructions = 0;
  let el: LyraRandomContent | undefined;

  try {
    ownerWindow.matchMedia = ((query: string) => {
      matchMediaCalls += 1;
      return originalMatchMedia.call(ownerWindow, query);
    }) as typeof ownerWindow.matchMedia;
    ownerWindow.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
      setIntervalCalls += 1;
      return originalSetInterval.call(ownerWindow, handler, timeout, ...args);
    }) as typeof ownerWindow.setInterval;
    ownerWindow.clearInterval = ((id?: number) => {
      clearIntervalCalls += 1;
      originalClearInterval.call(ownerWindow, id);
    }) as typeof ownerWindow.clearInterval;
    class RecordingMutationObserver extends originalMutationObserver {
      constructor(callback: MutationCallback) {
        mutationObserverConstructions += 1;
        super(callback);
      }
    }
    Object.defineProperty(ownerWindow, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: RecordingMutationObserver,
    });

    el = document.createElement('lr-random-content') as LyraRandomContent;
    el.autoplay = true;
    el.autoplayInterval = 10_000;
    el.items = 3;
    el.mode = 'sequence';
    el.innerHTML = '<div id="main-one">Main one</div><div id="main-two">Main two</div>';
    container.prepend(el);
    await el.updateComplete;
    const mainSink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;

    ownerDocument.adoptNode(el);
    ownerDocument.body.append(el);
    await el.updateComplete;

    const frameChild = ownerDocument.createElement('div');
    frameChild.id = 'frame-three';
    frameChild.textContent = 'Frame three';
    el.append(frameChild);
    await new Promise((resolve) => ownerWindow.setTimeout(resolve, 0));
    await el.updateComplete;

    expect(el.ownerDocument === ownerDocument).to.be.true;
    expect(shownIds(el).sort()).to.deep.equal(['frame-three', 'main-one', 'main-two']);
    expect(matchMediaCalls).to.be.greaterThan(0);
    expect(setIntervalCalls).to.be.greaterThan(0);
    expect(mutationObserverConstructions).to.be.greaterThan(0);
    expect(mainSink.isConnected, 'the old document sink is released during adoption').to.be.false;

    const frameSink = ownerDocument.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;
    const beforeManualSelection = frameSink.childElementCount;
    el.randomize();
    expect(frameSink.childElementCount).to.equal(beforeManualSelection + 1);
    expect(frameSink.lastElementChild?.textContent).to.equal('Main one Main two Frame three');

    el.remove();
    expect(clearIntervalCalls).to.be.greaterThan(0);
    expect(frameSink.isConnected, 'the adopted document sink is released on disconnect').to.be.false;
  } finally {
    el?.remove();
    ownerWindow.matchMedia = originalMatchMedia;
    ownerWindow.setInterval = originalSetInterval;
    ownerWindow.clearInterval = originalClearInterval;
    Object.defineProperty(ownerWindow, 'MutationObserver', {
      configurable: true,
      writable: true,
      value: originalMutationObserver,
    });
  }
});

it('releases its sink on disconnect and reacquires silently on reconnect', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lr-random-content') as LyraRandomContent;
  el.mode = 'sequence';
  el.innerHTML = '<div>First</div><div>Second</div>';
  container.append(el);
  await el.updateComplete;
  let sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;
  expect(sink.childElementCount).to.equal(0);
  el.randomize();
  expect(sink.lastElementChild?.textContent).to.equal('Second');

  el.remove();
  expect(sink.isConnected).to.be.false;
  el.items = 2;
  container.append(el);
  await el.updateComplete;
  sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;
  expect(
    sink.childElementCount,
    'a detached items update that flushes during reconnect is baseline, not an announcement',
  ).to.equal(0);
  el.randomize();
  expect(sink.childElementCount).to.equal(1);
});

it('ignores queued focusout and slotchange work after disconnect', async () => {
  const el = (await fixture(html`
    <lr-random-content autoplay autoplay-interval="1000">
      <button id="first">First</button>
      <button id="second">Second</button>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  let changes = 0;
  el.addEventListener('lr-content-change', () => changes++);
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  base.dispatchEvent(new FocusEvent('focusout', { bubbles: true, composed: true }));
  el.remove();
  const changesAtDisconnect = changes;

  const added = document.createElement('button');
  added.textContent = 'Added while detached';
  el.append(added);
  (el.shadowRoot!.querySelector('slot') as HTMLSlotElement).dispatchEvent(new Event('slotchange'));
  await Promise.resolve();

  expect((el as unknown as { timer?: number }).timer).to.equal(undefined);
  expect(changes).to.equal(changesAtDisconnect);
  for (const child of Array.from(el.children) as HTMLElement[]) {
    expect(child.hidden).to.be.false;
  }
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

it('observes late author hidden/aria-hidden changes and restores their latest values', async () => {
  const el = (await fixture(html`
    <lr-random-content mode="sequence">
      <div id="late-author-state">First</div>
      <div>Second</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  const item = el.querySelector('#late-author-state') as HTMLElement;

  item.setAttribute('hidden', 'until-found');
  item.setAttribute('aria-hidden', 'true');
  await new Promise((resolve) => setTimeout(resolve, 0));

  item.remove();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(item.getAttribute('hidden')).to.equal('until-found');
  expect(item.getAttribute('aria-hidden')).to.equal('true');
});

it('keeps a nested custom-element wrapper opaque while flattening only forwarding slot elements', async () => {
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
  // Flattening follows assigned <slot> elements, not arbitrary custom-element
  // shadow trees. The wrapper remains one opaque candidate and #nested is
  // never managed independently.
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
  const container = (await fixture(html`<div style="inline-size: 200px; overflow: hidden;"></div>`)) as HTMLDivElement;
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

for (const inlineSize of [319, 320]) {
  it(`owns a wrapping multi-item layout at ${inlineSize}px`, async () => {
    const container = (await fixture(html`
      <div style="inline-size: ${inlineSize}px; overflow: hidden;"></div>
    `)) as HTMLDivElement;
    const el = document.createElement('lr-random-content') as LyraRandomContent;
    el.items = 2;
    el.mode = 'sequence';
    el.innerHTML = `
      <div style="inline-size: 145px">First</div>
      <div style="inline-size: 145px">Second</div>
    `;
    container.append(el);
    await el.updateComplete;

    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const shown = [...el.children].filter((candidate) => !candidate.hasAttribute('hidden'));
    expect(getComputedStyle(base).display).to.equal('flex');
    expect(getComputedStyle(base).flexWrap).to.equal('wrap');
    expect(shown).to.have.length(2);
    expect(base.scrollWidth).to.be.at.most(container.clientWidth);
  });
}

it('honors the public multi-item gap and alignment hooks', async () => {
  const el = (await fixture(html`
    <lr-random-content items="2" style="--lr-random-content-item-gap: 13px; --lr-random-content-item-alignment: center">
      <div>First</div>
      <div>Second</div>
    </lr-random-content>
  `)) as LyraRandomContent;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const style = getComputedStyle(base);
  expect(style.columnGap).to.equal('13px');
  expect(style.rowGap).to.equal('13px');
  expect(style.alignItems).to.equal('center');
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

it('reacts to prefers-reduced-motion changing after mount', async () => {
  // Captures the media-query listener so the preference can flip while the component is live --
  // the only way to reach the change handler, since the real query can't be driven from the page.
  const originalMatchMedia = window.matchMedia;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  let matches = false;
  window.matchMedia = ((query: string) => ({
    get matches() {
      return query === '(prefers-reduced-motion: reduce)' ? matches : false;
    },
    media: query,
    addEventListener: (_t: string, fn: (e: MediaQueryListEvent) => void) => listeners.add(fn),
    removeEventListener: (_t: string, fn: (e: MediaQueryListEvent) => void) => listeners.delete(fn),
  })) as typeof window.matchMedia;

  try {
    const el = (await fixture(html`
      <lr-random-content autoplay autoplay-interval="1000">
        <div id="a">A</div>
        <div id="b">B</div>
      </lr-random-content>
    `)) as LyraRandomContent;
    await el.updateComplete;
    expect((el as unknown as { reduceMotion: boolean }).reduceMotion).to.be.false;

    matches = true;
    for (const fn of [...listeners]) fn({ matches: true } as MediaQueryListEvent);
    await el.updateComplete;
    expect((el as unknown as { reduceMotion: boolean }).reduceMotion, 'the preference is adopted').to.be.true;

    matches = false;
    for (const fn of [...listeners]) fn({ matches: false } as MediaQueryListEvent);
    await el.updateComplete;
    expect((el as unknown as { reduceMotion: boolean }).reduceMotion).to.be.false;
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});
