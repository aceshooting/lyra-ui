import { fixture, expect, oneEvent, html, aTimeout, waitUntil } from '@open-wc/testing';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import './toast-item.js';
import './toast.js';
import type { LyraToastItem } from './toast-item.js';
import { styles } from './toast-item.styles.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

function announcementTexts(politeness: 'polite' | 'assertive', ownerDocument = document): string[] {
  const sink = ownerDocument.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`);
  return sink ? Array.from(sink.children, (child) => child.textContent ?? '') : [];
}

class ToastMessageForwardWrapper extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const toast = this.ownerDocument.createElement('lr-toast-item');
    toast.duration = 0;
    toast.append(this.ownerDocument.createElement('slot'));
    root.append(toast);
  }
}
customElements.define('toast-message-forward-wrapper', ToastMessageForwardWrapper);

it('emits lifecycle events and uses the assertive sink for danger', async () => {
  const before = announcementTexts('assertive');
  const el = (await fixture(
    html`<lr-toast-item variant="danger" duration="0">boom</lr-toast-item>`,
  )) as LyraToastItem;

  await oneEvent(el, 'lr-show');
  expect(el.hasAttribute('role')).to.equal(false);
  expect(announcementTexts('assertive').slice(before.length)).to.deep.equal(['boom']);

  setTimeout(() => void el.hide());
  await oneEvent(el, 'lr-after-hide');
  expect(el.isConnected).to.be.false;
});

it('uses the polite sink for neutral/brand/success', async () => {
  const before = announcementTexts('polite');
  const el = (await fixture(
    html`<lr-toast-item variant="success" duration="0">ok</lr-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lr-show');
  expect(el.hasAttribute('role')).to.equal(false);
  expect(announcementTexts('polite').slice(before.length)).to.deep.equal(['ok']);
});

it('auto-dismisses after its duration', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="10">bye</lr-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lr-after-hide');
  expect(el.isConnected).to.be.false;
});

it('rearms an initial show and a visible auto-dismiss timer after reconnect', async () => {
  const early = document.createElement('lr-toast-item') as LyraToastItem;
  early.duration = 0;
  early.textContent = 'early';
  document.body.appendChild(early);
  await early.updateComplete;
  early.remove();
  document.body.appendChild(early);
  await oneEvent(early, 'lr-show');
  expect(early.hasAttribute('data-visible')).to.be.true;
  early.remove();

  const visible = (await fixture(html`<lr-toast-item duration="100">visible</lr-toast-item>`)) as LyraToastItem;
  await oneEvent(visible, 'lr-show');
  visible.remove();
  await aTimeout(30);
  document.body.appendChild(visible);
  await oneEvent(visible, 'lr-after-hide');
  expect(visible.isConnected).to.be.false;
});

it('does not auto-dismiss early after an interleaved pointer+focus pause/resume sequence', async () => {
  // An earlier resumeTimer() call that isn't cleared before a later one
  // orphans its own setTimeout -- that leaked timer keeps running even
  // after a subsequent pauseTimer() call, and can fire hide() while the
  // toast is still meant to be paused (hovering/focused).
  const el = (await fixture(html`<lr-toast-item duration="120">hi</lr-toast-item>`)) as LyraToastItem;
  await oneEvent(el, 'lr-show');
  const item = el.shadowRoot!.querySelector('[part="toast-item"]') as HTMLElement;

  item.dispatchEvent(new PointerEvent('pointerenter'));
  item.dispatchEvent(new FocusEvent('focusin'));
  item.dispatchEvent(new PointerEvent('pointerleave')); // resume: schedules a timer
  item.dispatchEvent(new FocusEvent('focusout')); // resume again, no pause between -- leaks the first one
  item.dispatchEvent(new PointerEvent('pointerenter')); // pause: should cancel *every* pending timer

  await aTimeout(300); // well past `duration`, and past any leaked timer's delay
  expect(el.isConnected, 'toast should still be open -- it was paused again after the leak').to.be.true;
});

it('resyncs the running auto-dismiss timer when `duration` changes after creation', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="60">extend me</lr-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lr-show');

  el.duration = 400; // extend well past the original 60ms window
  await el.updateComplete;

  await aTimeout(150); // past the original duration, well before the new one
  expect(el.isConnected, 'toast should still be open -- duration was extended').to.be.true;

  await oneEvent(el, 'lr-after-hide');
  expect(el.isConnected).to.be.false;
});

it('hides immediately when called before the show animation frame has run', async () => {
  const el = document.createElement('lr-toast-item') as LyraToastItem;
  el.textContent = 'msg';
  let sawShow = false;
  el.addEventListener('lr-show', () => (sawShow = true));
  document.body.appendChild(el);
  const hidden = el.hide(); // runs before firstUpdated()'s rAF has had a chance to fire
  await hidden;
  expect(el.isConnected).to.be.false;
  // The pending rAF must not resurrect the show sequence on top of an
  // already-hiding item -- without the `if (this.hiding) return;` guard, the
  // rAF still fires (it isn't cancelled until disconnectedCallback, which
  // only runs once hide() reaches this.remove()) and re-sets data-visible /
  // emits lr-show underneath the in-flight hide().
  expect(sawShow, 'lr-show should not fire once hide() ran before the first frame').to.be.false;
  expect(el.hasAttribute('data-visible'), 'data-visible should not be resurrected by a stale rAF callback').to
    .be.false;
});

it('hides promptly when duration is shortened below the already-elapsed time', async () => {
  const el = (await fixture(html`<lr-toast-item duration="5000">msg</lr-toast-item>`)) as LyraToastItem;
  await aTimeout(50);
  el.duration = 10;
  // resumeTimer() must call hide() synchronously once it sees the shortened
  // duration is already behind elapsedMs -- but hide() still runs the full
  // ANIM_MS hide animation before this.remove() actually disconnects it, so
  // the wait budget needs to clear that delay too, not just the (already
  // negative) timer remainder.
  await oneEvent(el, 'lr-after-hide');
  expect(el.isConnected).to.be.false;
});

it('does not schedule a redundant re-render when a shortened duration forces hide() from within its own update cycle', async () => {
  // Lit's dev-mode warns ("scheduled an update ... after an update
  // completed") whenever a reactive property is set from updated() rather
  // than willUpdate(), because that forces a second, wasted render pass on
  // top of the one that just ran. resumeTimer() (called via the `duration`
  // handling above) sets the `hiding` state property when it decides to call
  // hide() -- that handling must live in willUpdate(), not updated(), for
  // this scenario specifically since it's the one where remaining <= 0 makes
  // resumeTimer() call hide() synchronously, during the same tick.
  //
  // Reset Lit's own dedupe set first so this doesn't silently pass just
  // because an earlier test already tripped (and thus suppressed) the exact
  // same warning string.
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  if (globalWarnings) {
    [...globalWarnings].filter((w) => w.includes('scheduled an update')).forEach((w) => globalWarnings.delete(w));
  }

  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const el = (await fixture(
      html`<lr-toast-item duration="5000">msg</lr-toast-item>`,
    )) as LyraToastItem;
    await aTimeout(50);
    el.duration = 10; // already behind elapsedMs -- resumeTimer() calls hide() synchronously
    await oneEvent(el, 'lr-after-hide');
  } finally {
    console.warn = originalWarn;
  }

  const messages = calls.flat().map(String);
  expect(messages.some((m) => m.includes('scheduled an update'))).to.be.false;
});

it('restarts the timer when duration changes from disabled (0) back to a positive value', async () => {
  const el = (await fixture(html`<lr-toast-item duration="0">msg</lr-toast-item>`)) as LyraToastItem;
  await aTimeout(20);
  expect(el.isConnected).to.be.true;
  el.duration = 15;
  await oneEvent(el, 'lr-after-hide');
  expect(el.isConnected).to.be.false;
});

it('keeps an explicit Infinity duration meaning "never auto-dismiss" instead of coercing it into a large finite timeout', async () => {
  const el = (await fixture(html`<lr-toast-item duration="Infinity">msg</lr-toast-item>`)) as LyraToastItem;
  expect((el as any).safeDuration).to.equal(Infinity);
  await aTimeout(60);
  expect(el.isConnected, 'Infinity must never schedule a real dismiss timer').to.be.true;
});

it('self-heals a NaN duration to the constructed default, and a negative duration to the same disabled state as 0', async () => {
  const nanEl = (await fixture(html`<lr-toast-item duration="NaN">msg</lr-toast-item>`)) as LyraToastItem;
  expect((nanEl as any).safeDuration).to.equal(5000);

  const negativeEl = (await fixture(html`<lr-toast-item duration="-50">msg</lr-toast-item>`)) as LyraToastItem;
  expect((negativeEl as any).safeDuration).to.equal(0);
  await aTimeout(30);
  expect(negativeEl.isConnected, 'a negative duration clamps to 0, which this component already treats as disabled').to.be
    .true;
});

it('resolves hide() even if the element disconnects mid-hide-animation', async () => {
  const el = (await fixture(html`<lr-toast-item>msg</lr-toast-item>`)) as LyraToastItem;
  const hidden = el.hide();
  el.remove();
  await hidden; // must not hang forever
});

it('resumes an interrupted hide after reconnect and completes exactly once', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0" style="--lr-toast-hide-duration: 20ms linear">msg</lr-toast-item>`,
  )) as LyraToastItem;
  const parent = el.parentElement!;
  let afterHideCount = 0;
  el.addEventListener('lr-after-hide', () => afterHideCount++);

  const interruptedHide = el.hide();
  el.remove();
  await interruptedHide;
  expect(afterHideCount).to.equal(0);

  const completed = oneEvent(el, 'lr-after-hide');
  parent.append(el);
  await completed;

  expect(afterHideCount).to.equal(1);
  expect(el.isConnected).to.be.false;
});

it('applies distinct visual sizing per the `size` property', async () => {
  const xs = (await fixture(
    html`<lr-toast-item size="xs" duration="0">a</lr-toast-item>`,
  )) as LyraToastItem;
  const xl = (await fixture(
    html`<lr-toast-item size="xl" duration="0">a</lr-toast-item>`,
  )) as LyraToastItem;

  const xsBox = xs.shadowRoot!.querySelector('[part="toast-item"]') as HTMLElement;
  const xlBox = xl.shadowRoot!.querySelector('[part="toast-item"]') as HTMLElement;
  const xsFontSize = parseFloat(getComputedStyle(xsBox).fontSize);
  const xlFontSize = parseFloat(getComputedStyle(xlBox).fontSize);
  const xsPadding = parseFloat(getComputedStyle(xsBox).paddingBlockStart);
  const xlPadding = parseFloat(getComputedStyle(xlBox).paddingBlockStart);

  expect(xlFontSize, 'xl font-size should render larger than xs').to.be.greaterThan(xsFontSize);
  expect(xlPadding, 'xl padding should render larger than xs').to.be.greaterThan(xsPadding);
});

it('covers the whole shared six-step ladder, including the 2xs step the local union used to omit', async () => {
  const measured: { font: number; padding: number }[] = [];
  for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const) {
    const el = (await fixture(
      html`<lr-toast-item size=${size} duration="0">a</lr-toast-item>`,
    )) as LyraToastItem;
    const box = getComputedStyle(el.shadowRoot!.querySelector('[part="toast-item"]') as HTMLElement);
    measured.push({ font: parseFloat(box.fontSize), padding: parseFloat(box.paddingBlockStart) });
  }
  for (let i = 1; i < measured.length; i += 1) {
    expect(measured[i]!.font, `font tier ${i}`).to.be.greaterThan(measured[i - 1]!.font);
    expect(measured[i]!.padding, `padding tier ${i}`).to.be.at.least(measured[i - 1]!.padding);
  }
});

it('drives the accent bar from the shared semantic grid for every non-neutral variant', async () => {
  // The four per-variant blocks are gone; the accent now resolves through the shared `variants`
  // sheet's generic slots. Assert the rendered colours, which a slot that never resolved would
  // leave equal to the neutral border.
  const neutral = (await fixture(
    html`<lr-toast-item duration="0">a</lr-toast-item>`,
  )) as LyraToastItem;
  const neutralAccent = getComputedStyle(
    neutral.shadowRoot!.querySelector('[part="accent"]') as HTMLElement,
  ).backgroundColor;
  const seen = new Set<string>();
  for (const variant of ['brand', 'success', 'warning', 'danger'] as const) {
    const el = (await fixture(
      html`<lr-toast-item variant=${variant} duration="0">a</lr-toast-item>`,
    )) as LyraToastItem;
    const accent = getComputedStyle(
      el.shadowRoot!.querySelector('[part="accent"]') as HTMLElement,
    ).backgroundColor;
    expect(accent, `${variant} accent must leave the neutral default`).to.not.equal(neutralAccent);
    seen.add(accent);
  }
  expect(seen.size, 'all four variants must resolve to distinct accents').to.equal(4);
});

it('uses the current sink urgency when `variant` changes after creation', async () => {
  const politeBefore = announcementTexts('polite');
  const assertiveBefore = announcementTexts('assertive');
  const el = (await fixture(
    html`<lr-toast-item variant="neutral" duration="0">progress</lr-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lr-show');
  expect(el.hasAttribute('role')).to.equal(false);
  expect(announcementTexts('polite').slice(politeBefore.length)).to.deep.equal(['progress']);

  el.variant = 'danger';
  await el.updateComplete;
  expect(announcementTexts('assertive').slice(assertiveBefore.length)).to.deep.equal(['progress']);
});

it('announces a meaningful message update when a visible toast changes within the same urgency', async () => {
  const assertiveBefore = announcementTexts('assertive');
  const el = (await fixture(
    html`<lr-toast-item variant="warning" duration="0">Initial</lr-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lr-show');

  el.firstChild!.textContent = 'Updated';
  el.variant = 'danger';
  await Promise.resolve();
  await el.updateComplete;

  expect(announcementTexts('assertive').slice(assertiveBefore.length)).to.deep.equal([
    'Initial',
    'Updated',
  ]);
});

it('renders the icon part/slot only when withIcon is true', async () => {
  const withoutIcon = (await fixture(
    html`<lr-toast-item duration="0">no icon</lr-toast-item>`,
  )) as LyraToastItem;
  expect(withoutIcon.shadowRoot!.querySelector('[part="icon"]')).to.be.null;

  const withIcon = (await fixture(
    html`<lr-toast-item with-icon duration="0">has icon</lr-toast-item>`,
  )) as LyraToastItem;
  expect(withIcon.shadowRoot!.querySelector('[part="icon"]')).to.exist;
  expect(withIcon.shadowRoot!.querySelector('[part="icon"] slot[name="icon"]')).to.exist;
});

it('does not fire lr-hide/lr-after-hide twice when hide() is called twice concurrently', async () => {
  const el = (await fixture(html`<lr-toast-item duration="0">dup</lr-toast-item>`)) as LyraToastItem;
  await oneEvent(el, 'lr-show');

  let hideCount = 0;
  let afterHideCount = 0;
  el.addEventListener('lr-hide', () => hideCount++);
  el.addEventListener('lr-after-hide', () => afterHideCount++);

  void el.hide();
  void el.hide();

  await aTimeout(300);
  expect(hideCount, 'lr-hide should fire exactly once').to.equal(1);
  expect(afterHideCount, 'lr-after-hide should fire exactly once').to.equal(1);
});

it('marks the close button aria-disabled once hiding starts and ignores a rapid double-click', async () => {
  const el = (await fixture(html`<lr-toast-item duration="0">dup</lr-toast-item>`)) as LyraToastItem;
  await oneEvent(el, 'lr-show');
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;

  let hideCount = 0;
  let afterHideCount = 0;
  el.addEventListener('lr-hide', () => hideCount++);
  el.addEventListener('lr-after-hide', () => afterHideCount++);

  button.click();
  expect(button.getAttribute('aria-disabled')).to.equal('true');
  button.click();

  await aTimeout(300);
  expect(hideCount, 'lr-hide should fire exactly once').to.equal(1);
  expect(afterHideCount, 'lr-after-hide should fire exactly once').to.equal(1);
});

it('gives the close button the shared minimum hit area', async () => {
  const el = (await fixture(html`<lr-toast-item duration="0">dismiss me</lr-toast-item>`)) as LyraToastItem;
  await oneEvent(el, 'lr-show');
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  expect(getComputedStyle(button).minInlineSize).to.equal('40px');
  expect(getComputedStyle(button).minBlockSize).to.equal('40px');
});

it('keeps focus on the close button once hiding starts, instead of dropping it to <body>', async () => {
  // A native `disabled` attribute forces the browser to blur the element
  // outright with nothing to move focus to -- the primary way a keyboard or
  // switch-access user dismisses a toast is by activating this exact button
  // while it's focused, so aria-disabled (which doesn't blur) is used instead.
  const el = (await fixture(
    html`<lr-toast-item duration="0">focus me</lr-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lr-show');
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;

  button.focus();
  expect((el.shadowRoot!.activeElement) === (button)).to.equal(true);

  button.click();
  await el.updateComplete;
  expect((el.shadowRoot!.activeElement) === (button), 'close button should remain focused, not blurred to <body>').to.equal(true);
});

it('rehomes focus to an adjacent toast when a focused action toast is removed', async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="before">Before toasts</button>
      <lr-toast>
        <lr-toast-item duration="0" style="--lr-toast-hide-duration: 0ms">
          First message <button id="action">Undo</button>
        </lr-toast-item>
        <lr-toast-item duration="0">Second message</lr-toast-item>
      </lr-toast>
    </div>
  `);
  const [first, second] = [...wrapper.querySelectorAll('lr-toast-item')] as LyraToastItem[];
  const before = wrapper.querySelector('#before') as HTMLButtonElement;
  const action = first.querySelector('#action') as HTMLButtonElement;
  const secondClose = second.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  before.focus();
  action.focus();

  const afterHide = oneEvent(first, 'lr-after-hide');
  void first.hide();
  await afterHide;

  expect((second.shadowRoot!.activeElement) === (secondClose)).to.equal(true);
});

it('restores pre-toast focus when the only toast closes from its focused close button', async () => {
  const wrapper = await fixture(html`
    <div>
      <button id="before">Before toast</button>
      <lr-toast>
        <lr-toast-item duration="0" style="--lr-toast-hide-duration: 0ms">Only message</lr-toast-item>
      </lr-toast>
    </div>
  `);
  const before = wrapper.querySelector('#before') as HTMLButtonElement;
  const item = wrapper.querySelector('lr-toast-item') as LyraToastItem;
  const close = item.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  before.focus();
  close.focus();

  const afterHide = oneEvent(item, 'lr-after-hide');
  close.click();
  await afterHide;

  expect((document.activeElement) === (before)).to.equal(true);
});

it('stays paused on pointerleave while focus still holds it paused', async () => {
  const el = (await fixture(html`<lr-toast-item duration="120">hi</lr-toast-item>`)) as LyraToastItem;
  await oneEvent(el, 'lr-show');
  const item = el.shadowRoot!.querySelector('[part="toast-item"]') as HTMLElement;

  item.dispatchEvent(new PointerEvent('pointerenter'));
  item.dispatchEvent(new FocusEvent('focusin'));
  item.dispatchEvent(new PointerEvent('pointerleave')); // hover ends, but focus still holds the pause

  await aTimeout(200); // past `duration`, but focus should still hold the toast paused
  expect(el.isConnected, 'toast should still be open -- focus still holds the pause').to.be.true;
});

it('stays paused on focusout while the pointer is still hovering', async () => {
  const el = (await fixture(html`<lr-toast-item duration="120">hi</lr-toast-item>`)) as LyraToastItem;
  await oneEvent(el, 'lr-show');
  const item = el.shadowRoot!.querySelector('[part="toast-item"]') as HTMLElement;

  item.dispatchEvent(new FocusEvent('focusin'));
  item.dispatchEvent(new PointerEvent('pointerenter'));
  item.dispatchEvent(new FocusEvent('focusout')); // focus ends, but hover still holds the pause

  await aTimeout(200); // past `duration`, but hover should still hold the toast paused
  expect(el.isConnected, 'toast should still be open -- hover still holds the pause').to.be.true;
});

it('cancels the pending first-paint rAF when removed before it fires, so it cannot resurrect a detached toast', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0">gone before paint</lr-toast-item>`,
  )) as LyraToastItem;
  await el.updateComplete; // firstUpdated ran and scheduled its rAF, which hasn't fired yet

  let sawShow = false;
  el.addEventListener('lr-show', () => (sawShow = true));
  el.remove(); // disconnect before the browser's next paint

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await aTimeout(20);

  expect(sawShow, 'lr-show should not fire for a toast removed before first paint').to.be.false;
  expect(el.hasAttribute('data-visible')).to.be.false;
});

it('cancels the pending show-animation timeout when disconnected out-of-band, so it cannot emit on a detached node', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0">detach mid-show</lr-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lr-show'); // the lr-after-show setTimeout is now pending

  let sawAfterShow = false;
  el.addEventListener('lr-after-show', () => (sawAfterShow = true));

  el.remove(); // disconnect out-of-band (e.g. the hosting region itself was torn down)

  await aTimeout(220); // past ANIM_MS
  expect(sawAfterShow, 'lr-after-show should not fire for a node disconnected mid-show-animation').to.be
    .false;
});

it('cancels the pending hide-animation timeout when disconnected out-of-band, so it cannot emit or re-remove a detached node', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0">detach mid-hide</lr-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lr-show');

  let sawAfterHide = false;
  el.addEventListener('lr-after-hide', () => (sawAfterHide = true));

  void el.hide(); // starts the ANIM_MS hide delay
  el.remove(); // disconnect out-of-band before the hide animation timeout fires

  await aTimeout(220); // past ANIM_MS
  expect(sawAfterHide, 'lr-after-hide should not fire for a node disconnected mid-hide-animation').to.be
    .false;
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lr-toast-item variant="brand" duration="0">hello</lr-toast-item>`,
  )) as LyraToastItem;
  // `lr-show` only confirms the show sequence started (it fires synchronously before the
  // [part='toast-item'] opacity transition begins from data-visible), not that the transition
  // finished. Left running, axe's color-contrast check factors in the toast's current
  // (transitional) opacity, so sampling mid-fade blends its text and background toward each other
  // and reports a false "serious" violation. Finishing it outright matches the idiom
  // overlay.test.ts already uses for this same kind of reveal animation.
  await oneEvent(el, 'lr-show');
  el.shadowRoot!.querySelector('[part="toast-item"]')?.getAnimations().forEach((animation) => animation.finish());
  await expect(el).to.be.accessible();
});

it('derives the close button aria-label from the toast message for a11y in multi-toast stacks', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0">Upload complete</lr-toast-item>`,
  )) as LyraToastItem;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  expect(button.getAttribute('aria-label')).to.equal('Close: Upload complete');
});

it('matches the server close label on the first hydration render, then adopts declarative text and reconnect overrides', async () => {
  const container = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement('lr-toast-item') as LyraToastItem;
  el.duration = 0;
  // A shadow root present before first connection is the base class's hydration signal. Building
  // that boundary directly keeps the regression portable to engines whose imperative HTML parser
  // does not yet upgrade an empty declarative shadow root consistently in the test harness.
  el.attachShadow({ mode: 'open' });
  el.innerHTML = '<strong>Upload complete</strong>';
  container.append(el);

  await el.updateComplete;
  const closeLabel = (): string | null =>
    el.shadowRoot?.querySelector<HTMLElement>('[part="close-button"]')?.getAttribute('aria-label') ?? null;
  expect(closeLabel()).to.equal('Close');

  await el.updateComplete;
  expect(closeLabel()).to.equal('Close: Upload complete');

  el.strings = { closeWithContext: 'Dismiss {snippet}' };
  el.remove();
  container.append(el);
  await el.updateComplete;
  expect(closeLabel()).to.equal('Dismiss Upload complete');
});

it('renders a per-instance .strings override in the close button accessible name', async () => {
  const el = (await fixture(html`
    <lr-toast-item
      duration="0"
      .strings=${{ closeWithContext: 'Dismiss {snippet}' }}
    >Upload complete</lr-toast-item>
  `)) as LyraToastItem;
  const button = el.shadowRoot!.querySelector<HTMLElement>(
    '[part="close-button"]',
  );

  expect(button !== null).to.be.true;
  expect(button?.getAttribute('aria-label')).to.equal('Dismiss Upload complete');
});

it('truncates contextual close labels at grapheme boundaries through a localized whole-label template', async () => {
  const prefix = 'x'.repeat(39);
  const cases = [
    [`${prefix}👩‍💻y`, `${prefix}👩‍💻`],
    [`${prefix}e\u0301y`, `${prefix}e\u0301`],
  ] as const;

  for (const [message, snippet] of cases) {
    const el = (await fixture(html`
      <lr-toast-item
        locale="ja"
        duration="0"
        .strings=${{
          closeWithContext: 'Wrong template {snippet}',
          closeWithTruncatedContext: 'Dismiss [{snippet}] (more)',
        }}
      >${message}</lr-toast-item>
    `)) as LyraToastItem;
    try {
      const button = el.shadowRoot?.querySelector<HTMLElement>('[part="close-button"]');
      expect(button?.getAttribute('aria-label')).to.equal(`Dismiss [${snippet}] (more)`);
    } finally {
      el.remove();
    }
  }
});

it('keeps the whole contextual label when grapheme segmentation is unavailable', async () => {
  const originalSegmenter = Intl.Segmenter;
  Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: undefined });
  const message = `${'x'.repeat(39)}e\u0301y`;
  try {
    const el = (await fixture(html`
      <lr-toast-item
        duration="0"
        .strings=${{
          closeWithContext: 'Dismiss [{snippet}]',
          closeWithTruncatedContext: 'Wrong truncated template [{snippet}]',
        }}
      >${message}</lr-toast-item>
    `)) as LyraToastItem;
    const button = el.shadowRoot?.querySelector<HTMLElement>('[part="close-button"]');
    expect(button?.getAttribute('aria-label')).to.equal(`Dismiss [${message}]`);
    el.remove();
  } finally {
    Object.defineProperty(Intl, 'Segmenter', { configurable: true, value: originalSegmenter });
  }
});

it('derives and live-updates the close label from rich message markup', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0"><strong>Upload complete</strong></lr-toast-item>`,
  )) as LyraToastItem;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  const message = el.querySelector('strong')!;
  expect(button.getAttribute('aria-label')).to.equal('Close: Upload complete');

  message.textContent = 'Upload failed';
  await new Promise<void>((resolve) => queueMicrotask(resolve));
  await el.updateComplete;
  expect(button.getAttribute('aria-label')).to.equal('Close: Upload failed');
});

it('tracks contextual close text through a forwarding slot', async () => {
  const wrapper = (await fixture(html`
    <toast-message-forward-wrapper><span data-message>Upload complete</span></toast-message-forward-wrapper>
  `)) as ToastMessageForwardWrapper;
  const el = wrapper.shadowRoot!.querySelector('lr-toast-item') as LyraToastItem;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLElement>('[part="close-button"]')!;
  const message = wrapper.querySelector<HTMLElement>('[data-message]')!;
  expect(button.getAttribute('aria-label')).to.equal('Close: Upload complete');

  message.textContent = 'Upload failed';
  await Promise.resolve();
  await el.updateComplete;
  expect(button.getAttribute('aria-label')).to.equal('Close: Upload failed');

  message.hidden = true;
  await Promise.resolve();
  await el.updateComplete;
  expect(button.getAttribute('aria-label')).to.equal('Close');

  message.hidden = false;
  message.setAttribute('aria-label', 'Upload retried');
  await Promise.resolve();
  await el.updateComplete;
  expect(button.getAttribute('aria-label')).to.equal('Close: Upload retried');

  const replacement = wrapper.ownerDocument.createElement('span');
  replacement.textContent = 'Upload restored';
  const reassigned = oneEvent(el.querySelector('slot')!, 'slotchange');
  message.replaceWith(replacement);
  await reassigned;
  await el.updateComplete;
  expect(button.getAttribute('aria-label')).to.equal('Close: Upload restored');
});

it('releases and reacquires announcement sinks across adoption without replaying a visible toast', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const el = document.createElement('lr-toast-item') as LyraToastItem;
  el.duration = 0;
  el.textContent = 'Already visible';
  const shown = oneEvent(el, 'lr-show');
  document.body.append(el);

  try {
    await shown;
    const originalPolite = document.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
    );
    const originalAssertive = document.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
    );
    expect(originalPolite !== null, 'connected toast owns its polite sink').to.equal(true);
    expect(originalAssertive !== null, 'connected toast owns its assertive sink').to.equal(true);

    frameDocument.adoptNode(el);
    expect(originalPolite?.isConnected ?? true, 'adoption releases the old polite sink').to.equal(false);
    expect(originalAssertive?.isConnected ?? true, 'adoption releases the old assertive sink').to.equal(false);

    frameDocument.body.append(el);
    await el.updateComplete;
    const adoptedPolite = frameDocument.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
    );
    const adoptedAssertive = frameDocument.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
    );
    expect(adoptedPolite !== null, 'reconnect acquires a polite sink in the adopted document').to.equal(true);
    expect(adoptedAssertive !== null, 'reconnect acquires an assertive sink in the adopted document').to.equal(true);
    expect(announcementTexts('polite', frameDocument)).to.deep.equal([]);
    expect(announcementTexts('assertive', frameDocument)).to.deep.equal([]);

    el.remove();
    expect(adoptedPolite?.isConnected ?? true, 'disconnect releases the adopted polite sink').to.equal(false);
    expect(adoptedAssertive?.isConnected ?? true, 'disconnect releases the adopted assertive sink').to.equal(false);
  } finally {
    el.remove();
    frame.remove();
  }
});

it('rebinds its observer, animation frame, and timers to the adopted owner realm', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameWindow = frame.contentWindow!;
  const frameDocument = frame.contentDocument!;
  const observerDescriptor = Object.getOwnPropertyDescriptor(frameWindow, 'MutationObserver');
  const NativeMutationObserver = frameWindow.MutationObserver;
  const originalRaf = frameWindow.requestAnimationFrame;
  const originalCancelRaf = frameWindow.cancelAnimationFrame;
  const originalSetTimeout = frameWindow.setTimeout;
  const originalClearTimeout = frameWindow.clearTimeout;
  let constructions = 0;
  let nextRaf = 70;
  let nextTimer = 170;
  const rafCallbacks = new Map<number, FrameRequestCallback>();
  const cancelledRafs: number[] = [];
  const clearedTimers: number[] = [];
  class TrackingMutationObserver extends NativeMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback);
      constructions += 1;
    }
  }
  Object.defineProperty(frameWindow, 'MutationObserver', {
    configurable: true,
    value: TrackingMutationObserver,
  });
  frameWindow.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
    const handle = ++nextRaf;
    rafCallbacks.set(handle, callback);
    return handle;
  }) as typeof frameWindow.requestAnimationFrame;
  frameWindow.cancelAnimationFrame = ((handle: number): void => {
    cancelledRafs.push(handle);
    rafCallbacks.delete(handle);
  }) as typeof frameWindow.cancelAnimationFrame;
  frameWindow.setTimeout = ((handler: TimerHandler): number => {
    void handler;
    return ++nextTimer;
  }) as typeof frameWindow.setTimeout;
  frameWindow.clearTimeout = ((handle?: number): void => {
    if (handle !== undefined) clearedTimers.push(handle);
  }) as typeof frameWindow.clearTimeout;

  const el = (await fixture(html`<lr-toast-item duration="1000">Upload complete</lr-toast-item>`)) as LyraToastItem;
  el.remove();
  el.removeAttribute('data-visible');
  try {
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;
    expect(constructions, 'base and message observers use the adopted window').to.be.greaterThan(1);
    const firstRaf = nextRaf;
    expect(rafCallbacks.has(firstRaf), 'show schedules in the adopted window').to.be.true;
    el.remove();
    expect(cancelledRafs.includes(firstRaf), 'disconnect cancels through the scheduling window').to.be.true;

    frameDocument.body.append(el);
    await el.updateComplete;
    const secondRaf = nextRaf;
    const show = rafCallbacks.get(secondRaf)!;
    rafCallbacks.delete(secondRaf);
    show(frameWindow.performance.now());
    expect(nextTimer, 'show and auto-dismiss schedule adopted-window timers').to.be.greaterThan(170);
    el.remove();
    expect(clearedTimers.length, 'disconnect clears adopted-window timers').to.be.greaterThan(0);
  } finally {
    el.remove();
    frameWindow.requestAnimationFrame = originalRaf;
    frameWindow.cancelAnimationFrame = originalCancelRaf;
    frameWindow.setTimeout = originalSetTimeout;
    frameWindow.clearTimeout = originalClearTimeout;
    if (observerDescriptor) Object.defineProperty(frameWindow, 'MutationObserver', observerDescriptor);
    else delete (frameWindow as Window & { MutationObserver?: typeof MutationObserver }).MutationObserver;
    frame.remove();
  }
});

it('falls back to a generic close label when the toast has no text content', async () => {
  const el = (await fixture(html`<lr-toast-item duration="0"></lr-toast-item>`)) as LyraToastItem;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  expect(button.getAttribute('aria-label')).to.equal('Close');
});

it('excludes an appended action button\'s text from the derived close label', async () => {
  // Mirrors toaster.ts, which appends a light-DOM <button> sibling of the
  // message text after the item's first render (the action-button feature).
  const el = (await fixture(
    html`<lr-toast-item duration="0">Item deleted</lr-toast-item>`,
  )) as LyraToastItem;
  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = 'Undo';
  action.setAttribute('aria-label', 'Undo deletion');
  el.appendChild(action);

  // Force the same re-render that happens when the user presses close (or
  // the action itself calls item.hide()), which is what previously
  // recomputed `closeLabel` off of the now-contaminated `textContent`.
  const hidePromise = el.hide();
  await el.updateComplete;

  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  expect(button.getAttribute('aria-label')).to.equal('Close: Item deleted');
  await hidePromise;
});

it('excludes slot="icon" text from the derived close label', async () => {
  // Mirrors the WithIcon story, which appends a slot="icon" element whose
  // own text content ("✓") must not bleed into the close-button label.
  const el = (await fixture(
    html`<lr-toast-item with-icon duration="0">Upload complete</lr-toast-item>`,
  )) as LyraToastItem;
  const icon = document.createElement('span');
  icon.slot = 'icon';
  icon.textContent = '✓';
  el.appendChild(icon);

  const hidePromise = el.hide();
  await el.updateComplete;

  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  expect(button.getAttribute('aria-label')).to.equal('Close: Upload complete');
  await hidePromise;
});

it('renders the shared close icon svg instead of a literal times-entity glyph', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0">hi</lr-toast-item>`,
  )) as LyraToastItem;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  expect((button.querySelector('svg')) != null).to.equal(true);
  expect(button.textContent?.trim()).to.equal('');
});

it('exports the mapped close-icon and progress-ring part trees', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="5000">Progress</lr-toast-item>`,
  )) as LyraToastItem;
  const expectedParts = [
    'close-icon',
    'close-icon__svg',
    'progress-ring',
    'progress-ring__base',
    'progress-ring__indicator',
    'progress-ring__label',
    'progress-ring__track',
  ];

  for (const part of expectedParts) {
    expect(el.shadowRoot!.querySelector(`[part~="${part}"]`), `${part} should be exported`).to.exist;
  }
  expect(el.shadowRoot!.querySelector('[part~="close-icon__svg"]')?.localName).to.equal('svg');

  el.duration = 0;
});

it('honors the mapped item token aliases at the rendered surface', async () => {
  const el = (await fixture(html`
    <lr-toast-item
      duration="0"
      style="--accent-width: 7px; --padding: 19px; --show-duration: 23ms linear; --hide-duration: 31ms linear"
    >
      Aliased
    </lr-toast-item>
  `)) as LyraToastItem;
  const surface = el.shadowRoot!.querySelector<HTMLElement>('[part="toast-item"]')!;
  const accent = el.shadowRoot!.querySelector<HTMLElement>('[part="accent"]')!;

  expect(getComputedStyle(accent).inlineSize).to.equal('7px');
  expect(getComputedStyle(surface).paddingBlockStart).to.equal('19px');
  expect(getComputedStyle(surface).transitionDuration.split(',')[0]).to.equal('0.023s');

  el.setAttribute('data-hiding', '');
  expect(getComputedStyle(surface).transitionDuration.split(',')[0]).to.equal('0.031s');
});

it('keeps the region stack gap separate from inherited item geometry hooks', async () => {
  const region = await fixture(html`
    <lr-toast
      style="--lr-toast-gap: 31px; --lr-toast-item-gap: 23px; --lr-toast-item-radius: 17px"
    >
      <lr-toast-item duration="0">Scoped geometry</lr-toast-item>
    </lr-toast>
  `);
  const stack = region.shadowRoot!.querySelector<HTMLElement>('[part="stack"]')!;
  const item = region.querySelector<LyraToastItem>('lr-toast-item')!;
  const surface = item.shadowRoot!.querySelector<HTMLElement>('[part="toast-item"]')!;
  const accent = item.shadowRoot!.querySelector<HTMLElement>('[part="accent"]')!;

  expect(getComputedStyle(stack).gap).to.equal('31px');
  expect(getComputedStyle(surface).gap).to.equal('23px');
  expect(getComputedStyle(surface).borderTopLeftRadius).to.equal('17px');
  expect(getComputedStyle(accent).borderTopLeftRadius).to.equal('17px');
});

it('keeps shared item geometry fallbacks available at compact and large sizes', async () => {
  for (const size of ['2xs', 'xl'] as const) {
    const item = (await fixture(html`
      <lr-toast-item
        duration="0"
        size=${size}
        style="--lr-space-s: 13px; --lr-radius: 19px"
      >
        ${size} geometry
      </lr-toast-item>
    `)) as LyraToastItem;
    const surface = item.shadowRoot!.querySelector<HTMLElement>('[part="toast-item"]')!;
    const accent = item.shadowRoot!.querySelector<HTMLElement>('[part="accent"]')!;

    expect(getComputedStyle(surface).gap, `${size} keeps the unset shared gap fallback`).to.equal('13px');
    expect(getComputedStyle(surface).borderTopLeftRadius, `${size} keeps the unset shared radius fallback`).to.equal('19px');
    expect(getComputedStyle(accent).borderTopLeftRadius, `${size} keeps the accent radius in sync`).to.equal('19px');
  }
});

it('inherits close-button hover and active state hooks without changing their defaults', async () => {
  const wrapper = await fixture(html`
    <div>
      <lr-toast-item duration="0">Themed close button</lr-toast-item>
    </div>
  `);
  const item = wrapper.querySelector<LyraToastItem>('lr-toast-item')!;
  const close = item.shadowRoot!.querySelector<HTMLButtonElement>('[part="close-button"]')!;
  await waitUntil(() => item.hasAttribute('data-visible'));

  const resolveInShadow = (declaration: string, property: string): string => {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    item.shadowRoot!.append(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  };
  const rect = close.getBoundingClientRect();
  const centre: [number, number] = [
    Math.round(rect.left + rect.width / 2),
    Math.round(rect.top + rect.height / 2),
  ];
  expect(rect.width, 'the close button needs rendered geometry for pointer-state coverage').to.be.greaterThan(0);

  // A real mouse release normally invokes the button's dismissal handler. Stop just that test
  // fixture's click before Lit's listener so the same visible control can cover hover and active
  // styling without entering its normal hiding state.
  const preventDismissal = (event: Event): void => event.stopImmediatePropagation();
  close.addEventListener('click', preventDismissal, { capture: true });

  try {
    await sendMouse({ type: 'move', position: centre });
    expect(getComputedStyle(close).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(close).color).to.equal(
      resolveInShadow('color: var(--lr-color-text)', 'color'),
    );

    await sendMouse({ type: 'down' });
    expect(getComputedStyle(close).backgroundColor).to.equal(
      resolveInShadow(
        'background: color-mix(in oklab, transparent, var(--lr-color-mix-partner) var(--lr-color-mix-active))',
        'background-color',
      ),
    );
    expect(getComputedStyle(close).color).to.equal(
      resolveInShadow('color: var(--lr-color-text)', 'color'),
    );
    await sendMouse({ type: 'up' });

    wrapper.style.setProperty('--lr-toast-close-button-hover-bg', 'rgb(1, 2, 3)');
    wrapper.style.setProperty('--lr-toast-close-button-hover-color', 'rgb(4, 5, 6)');
    wrapper.style.setProperty('--lr-toast-close-button-active-bg', 'rgb(7, 8, 9)');
    wrapper.style.setProperty('--lr-toast-close-button-active-color', 'rgb(10, 11, 12)');
    expect(getComputedStyle(close).backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(close).color).to.equal('rgb(4, 5, 6)');

    await sendMouse({ type: 'down' });
    expect(getComputedStyle(close).backgroundColor).to.equal('rgb(7, 8, 9)');
    expect(getComputedStyle(close).color).to.equal('rgb(10, 11, 12)');
  } finally {
    await resetMouse();
    close.removeEventListener('click', preventDismissal, { capture: true });
  }
});

it('uses the configured hide transition duration for lifecycle completion', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0">bye</lr-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lr-show');
  el.style.setProperty('--lr-toast-hide-duration', '20ms linear');
  const start = performance.now();
  void el.hide();
  await oneEvent(el, 'lr-after-hide');
  const elapsed = performance.now() - start;
  expect(elapsed).to.be.lessThan(150);
});

it('exposes distinct namespaced show and hide transition properties', () => {
  expect(styles.cssText).to.include('var(--lr-transition-base');
  expect(styles.cssText).to.include('--lr-toast-show-duration');
  expect(styles.cssText).to.include('--lr-toast-hide-duration');
});

it('completes a hide on transitionend without waiting for the fallback timeout', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0">transition</lr-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lr-show');
  el.style.setProperty('--lr-toast-hide-duration', '2s linear');
  const afterHide = oneEvent(el, 'lr-after-hide');
  const surface = el.shadowRoot!.querySelector('[part="toast-item"]')!;
  void el.hide();
  surface.dispatchEvent(new Event('transitionend', { bubbles: true }));
  await afterHide;
  expect(el.isConnected).to.be.false;
});

it('collapses the show/hide transition duration under prefers-reduced-motion', () => {
  expect(styles.cssText).to.match(/@media \(prefers-reduced-motion: reduce\)/);
  expect(styles.cssText).to.match(/transition-duration:\s*0\.01ms/);
});

it('stops the visible progress-ring animation under prefers-reduced-motion', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="5000">Reduced motion progress</lr-toast-item>`,
  )) as LyraToastItem;
  await waitUntil(() => el.hasAttribute('data-visible'));
  const indicator = el.shadowRoot!.querySelector<SVGElement>(
    '[part="progress-ring__indicator"]',
  )!;
  expect(getComputedStyle(indicator).animationName).to.equal('lr-toast-progress');
  const reducedRule = el.shadowRoot!.adoptedStyleSheets
    .flatMap((sheet) => [...sheet.cssRules])
    .find(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule
        && rule.conditionText === '(prefers-reduced-motion: reduce)'
        && [...rule.cssRules].some(
          (nested) =>
            nested instanceof CSSStyleRule
            && nested.selectorText.includes('progress-ring__indicator'),
        ),
    );
  expect(reducedRule?.conditionText).to.equal('(prefers-reduced-motion: reduce)');
  const originalCondition = reducedRule!.media.mediaText;
  try {
    reducedRule!.media.mediaText = 'all';
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    expect(getComputedStyle(indicator).animationName).to.equal('none');
  } finally {
    reducedRule!.media.mediaText = originalCondition;
    el.duration = 0;
  }
});

it('skips the JS-side show/hide delay (not just the CSS transition) under prefers-reduced-motion', async () => {
  // A reduced-motion user should not wait for an animation that no longer
  // visibly plays, even if the theme supplies long transition properties.
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as typeof window.matchMedia;

  try {
    const el = (await fixture(
      html`<lr-toast-item duration="0">reduced motion</lr-toast-item>`,
    )) as LyraToastItem;
    const showStart = performance.now();
    await oneEvent(el, 'lr-after-show');
    expect(performance.now() - showStart).to.be.lessThan(100);

    const hideStart = performance.now();
    void el.hide();
    await oneEvent(el, 'lr-after-hide');
    expect(performance.now() - hideStart).to.be.lessThan(100);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it('defines a focus-visible outline for the close button using the shared focus-ring tokens', () => {
  expect(styles.cssText).to.match(/\[part=['"]close-button['"]\]:focus-visible/);
  expect(styles.cssText).to.match(
    /outline:\s*var\(--lr-focus-ring-width\)\s*solid\s*var\(--lr-focus-ring-color\)/,
  );
});

it('honours preventDefault() on lr-show, leaving the item present but never shown', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0">suppressed</lr-toast-item>`,
  )) as LyraToastItem;
  el.addEventListener('lr-show', (event) => event.preventDefault());
  let afterShows = 0;
  el.addEventListener('lr-after-show', () => { afterShows += 1; });

  await aTimeout(80);
  expect(el.hasAttribute('data-visible'), 'a vetoed toast never becomes visible').to.be.false;
  expect(afterShows, 'a transition that never happened has no after-event').to.equal(0);
  expect(el.isConnected, 'the vetoed item is left for its listener to remove').to.be.true;
});

it('honours preventDefault() on lr-hide, leaving the toast up', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0">stays</lr-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lr-show');
  el.addEventListener('lr-hide', (event) => event.preventDefault(), { once: true });

  await el.hide();
  await aTimeout(60);
  expect(el.isConnected, 'a vetoed dismissal never removes the item').to.be.true;
  expect(el.hasAttribute('data-visible')).to.be.true;
  expect(el.hasAttribute('data-hiding')).to.be.false;

  // The veto was one-shot, so the next dismissal completes normally.
  setTimeout(() => void el.hide());
  await oneEvent(el, 'lr-after-hide');
  expect(el.isConnected).to.be.false;
});

it('makes lr-show/lr-hide cancelable and the after-events not', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0">lifecycle</lr-toast-item>`,
  )) as LyraToastItem;
  const seen: CustomEvent[] = [];
  for (const type of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
    el.addEventListener(type, (event) => seen.push(event as CustomEvent));
  }
  await oneEvent(el, 'lr-show');
  setTimeout(() => void el.hide());
  await oneEvent(el, 'lr-after-hide');

  const byType = new Map(seen.map((event) => [event.type, event.cancelable]));
  expect(byType.get('lr-show')).to.equal(true);
  expect(byType.get('lr-hide')).to.equal(true);
  expect(byType.get('lr-after-hide')).to.equal(false);
});
