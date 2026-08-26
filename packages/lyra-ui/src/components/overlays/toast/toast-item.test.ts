import { fixture, expect, oneEvent, html, aTimeout, waitUntil } from '@open-wc/testing';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import './toast-item.js';
import './toast.js';
import type { LyraToastItem, LyraToastSize, LyraToastVariant } from './toast-item.js';
import { styles } from './toast-item.styles.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import { sendKeys } from '@web/test-runner-commands';

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

it('exposes the live toast item surface across state updates and reconnects', async () => {
  const el = (await fixture(html`<lr-toast-item duration="0">Message</lr-toast-item>`)) as LyraToastItem;
  const surface = el.toastItemElement;
  expect(surface === el.shadowRoot!.querySelector('[part="toast-item"]')).to.equal(true);
  el.variant = 'danger';
  await el.updateComplete;
  expect(el.toastItemElement === surface).to.equal(true);
  const parent = el.parentElement!;
  el.remove();
  parent.append(el);
  await el.updateComplete;
  expect(el.toastItemElement === surface).to.equal(true);
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

it("restarts the full normalized duration after a one-shot auto-dismiss veto", async () => {
  const el = (await fixture(html`
    <lr-toast-item
      duration="80"
      style="--lr-toast-show-duration: 0ms; --lr-toast-hide-duration: 0ms"
      >retry countdown</lr-toast-item
    >
  `)) as LyraToastItem;
  const hideTimes: number[] = [];
  el.addEventListener("lr-hide", (event) => {
    hideTimes.push(performance.now());
    if (hideTimes.length === 1) event.preventDefault();
  });
  await oneEvent(el, "lr-show");
  const afterHide = oneEvent(el, "lr-after-hide");

  await aTimeout(125);
  expect(
    hideTimes.length,
    "a full restarted duration has not elapsed yet"
  ).to.equal(1);
  expect(el.isConnected).to.be.true;

  await waitUntil(
    () => hideTimes.length === 2,
    "the restarted timer requests dismissal again"
  );
  expect(hideTimes[1]! - hideTimes[0]!).to.be.at.least(60);
  await afterHide;
  expect(el.isConnected).to.be.false;
});

it("restarts the rendered progress animation with a vetoed timer countdown", async () => {
  const el = (await fixture(html`
    <lr-toast-item
      duration="180"
      style="--lr-toast-show-duration: 0ms; --lr-toast-hide-duration: 0ms"
      >retry progress</lr-toast-item
    >
  `)) as LyraToastItem;
  await oneEvent(el, "lr-show");
  const firstIndicator = el.shadowRoot!.querySelector<SVGCircleElement>(
    '[part="progress-ring__indicator"]'
  )!;
  let hideCount = 0;
  el.addEventListener("lr-hide", (event) => {
    hideCount += 1;
    event.preventDefault();
  });

  await waitUntil(() => hideCount === 1, "the first timer dismissal is vetoed");
  await el.updateComplete;
  const restartedIndicator = el.shadowRoot!.querySelector<SVGCircleElement>(
    '[part="progress-ring__indicator"]'
  )!;
  expect(
    restartedIndicator === firstIndicator,
    "the finished animation node is replaced"
  ).to.equal(false);
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const animation = restartedIndicator.getAnimations()[0];
    expect(
      animation !== undefined,
      "the replacement owns a live progress animation"
    ).to.equal(true);
    expect(
      Number(animation!.currentTime),
      "the progress animation restarts near its origin"
    ).to.be.lessThan(90);
  }
  el.remove();
});

it("keeps rearming a full duration while every timer dismissal is vetoed", async () => {
  const el = (await fixture(html`
    <lr-toast-item duration="35" style="--lr-toast-show-duration: 0ms"
      >persistent veto</lr-toast-item
    >
  `)) as LyraToastItem;
  let hideCount = 0;
  el.addEventListener("lr-hide", (event) => {
    hideCount += 1;
    event.preventDefault();
  });
  await oneEvent(el, "lr-show");

  await aTimeout(150);
  expect(hideCount).to.be.at.least(3);
  expect(el.isConnected).to.be.true;
  expect(el.hasAttribute("data-visible")).to.be.true;
  expect(el.hasAttribute("data-hiding")).to.be.false;
  el.remove();
});

it("holds a restarted vetoed countdown while paused, then resumes from the full duration", async () => {
  const el = (await fixture(html`
    <lr-toast-item
      duration="70"
      style="--lr-toast-show-duration: 0ms; --lr-toast-hide-duration: 0ms"
      >paused retry</lr-toast-item
    >
  `)) as LyraToastItem;
  const surface = el.shadowRoot!.querySelector(
    '[part="toast-item"]'
  ) as HTMLElement;
  let hideCount = 0;
  el.addEventListener("lr-hide", (event) => {
    hideCount += 1;
    if (hideCount === 1) {
      event.preventDefault();
      surface.dispatchEvent(new PointerEvent("pointerenter"));
    }
  });
  await oneEvent(el, "lr-show");
  await waitUntil(() => hideCount === 1, "the first timer dismissal is vetoed");

  await aTimeout(110);
  expect(hideCount, "the pointer pause suppresses every retry").to.equal(1);
  const afterHide = oneEvent(el, "lr-after-hide");
  surface.dispatchEvent(new PointerEvent("pointerleave"));
  await aTimeout(35);
  expect(
    hideCount,
    "resume starts from a full duration, not an expired remainder"
  ).to.equal(1);
  await afterHide;
  expect(hideCount).to.equal(2);
});

it("keeps a vetoed countdown stopped while disconnected and restarts it on reconnect", async () => {
  const parent = (await fixture(html`<div></div>`)) as HTMLDivElement;
  const el = document.createElement("lr-toast-item") as LyraToastItem;
  el.duration = 70;
  el.style.setProperty("--lr-toast-show-duration", "0ms");
  el.style.setProperty("--lr-toast-hide-duration", "0ms");
  el.textContent = "reconnected retry";
  let hideCount = 0;
  el.addEventListener("lr-hide", (event) => {
    hideCount += 1;
    if (hideCount === 1) {
      event.preventDefault();
      el.remove();
    }
  });
  parent.append(el);
  await oneEvent(el, "lr-show");
  await waitUntil(() => hideCount === 1, "the first timer dismissal is vetoed");

  await aTimeout(100);
  expect(hideCount).to.equal(1);
  parent.append(el);
  const afterHide = oneEvent(el, "lr-after-hide");
  await aTimeout(35);
  expect(hideCount, "reconnect starts a full duration").to.equal(1);
  await waitUntil(
    () => hideCount === 2,
    "the reconnected timer requests dismissal again"
  );
  await afterHide;
  expect(el.isConnected).to.be.false;
});

it("uses a duration changed by the veto listener and lets a manual retry dismiss immediately", async () => {
  const el = (await fixture(html`
    <lr-toast-item
      duration="45"
      style="--lr-toast-show-duration: 0ms; --lr-toast-hide-duration: 0ms"
      >changed retry</lr-toast-item
    >
  `)) as LyraToastItem;
  let hideCount = 0;
  el.addEventListener("lr-hide", (event) => {
    hideCount += 1;
    if (hideCount === 1) {
      event.preventDefault();
      el.duration = 300;
    }
  });
  await oneEvent(el, "lr-show");
  await waitUntil(() => hideCount === 1, "the first timer dismissal is vetoed");
  await aTimeout(90);
  expect(
    hideCount,
    "the changed normalized duration controls the retry"
  ).to.equal(1);

  const afterHide = oneEvent(el, "lr-after-hide");
  await el.hide();
  await afterHide;
  expect(hideCount).to.equal(2);
  await aTimeout(320);
  expect(hideCount, "manual success clears the rearmed timer").to.equal(2);
});

it("rearms an initial show and a visible auto-dismiss timer after reconnect", async () => {
  const early = document.createElement("lr-toast-item") as LyraToastItem;
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

it('continues an in-flight hide after an immediate reconnect and completes exactly once', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0" style="--lr-toast-hide-duration: 2s linear">msg</lr-toast-item>`,
  )) as LyraToastItem;
  const parent = el.parentElement!;
  await oneEvent(el, 'lr-show');

  let afterHideCount = 0;
  el.addEventListener('lr-after-hide', () => afterHideCount++);
  const afterHide = oneEvent(el, 'lr-after-hide');
  const hidden = el.hide();
  el.remove();
  parent.append(el);

  // Let the cancelled first wait restart against the reconnected surface before completing it.
  await Promise.resolve();
  await Promise.resolve();
  const surface = el.shadowRoot!.querySelector('[part="toast-item"]')!;
  surface.dispatchEvent(new Event('transitionend'));
  await afterHide;
  await hidden;

  expect(afterHideCount).to.equal(1);
  expect(el.isConnected).to.be.false;
});

it('continues an accepted show after an immediate reconnect and completes exactly once', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0" style="--lr-toast-show-duration: 2s linear">show reconnect</lr-toast-item>`,
  )) as LyraToastItem;
  const parent = el.parentElement!;
  await oneEvent(el, 'lr-show');
  let afterShowCount = 0;
  el.addEventListener('lr-after-show', () => afterShowCount++);

  el.remove();
  parent.append(el);
  await Promise.resolve();
  await Promise.resolve();
  el.shadowRoot!
    .querySelector('[part="toast-item"]')!
    .dispatchEvent(new Event('transitionend'));

  const completed = await Promise.race([
    waitUntil(() => afterShowCount === 1).then(() => true),
    aTimeout(180).then(() => false),
  ]);
  expect(completed, 'the accepted show transaction must resume after reconnect').to.equal(true);
  el.shadowRoot!
    .querySelector('[part="toast-item"]')!
    .dispatchEvent(new Event('transitionend'));
  await aTimeout(0);
  expect(afterShowCount).to.equal(1);
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

it("round-trips valid upstream size spellings through IDL, reflection, selectors, and cloning", async () => {
  const el = (await fixture(
    html`<lr-toast-item size="small" duration="0"
      >Migrated toast</lr-toast-item
    >`
  )) as LyraToastItem;
  expect(el.size).to.equal("small");
  expect(el.getAttribute("size")).to.equal("small");
  expect(el.matches('[size="small"]')).to.be.true;
  expect(el.dataset["effectiveSize"]).to.equal("s");
  const canonical = (await fixture(
    html`<lr-toast-item size="s" duration="0">Canonical toast</lr-toast-item>`
  )) as LyraToastItem;
  const surface = el.shadowRoot!.querySelector(
    '[part="toast-item"]'
  ) as HTMLElement;
  const canonicalSurface = canonical.shadowRoot!.querySelector(
    '[part="toast-item"]'
  ) as HTMLElement;
  expect(getComputedStyle(surface).paddingTop).to.equal(
    getComputedStyle(canonicalSurface).paddingTop
  );
  expect(getComputedStyle(surface).fontSize).to.equal(
    getComputedStyle(canonicalSurface).fontSize
  );

  el.size = "large";
  await el.updateComplete;
  expect(el.size).to.equal("large");
  expect(el.getAttribute("size")).to.equal("large");
  expect(el.dataset["effectiveSize"]).to.equal("l");
  expect((el.cloneNode(true) as LyraToastItem).getAttribute("size")).to.equal(
    "large"
  );
});

it("covers the whole shared six-step ladder, including the 2xs step the local union used to omit", async () => {
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
  expect(withoutIcon.shadowRoot!.querySelector('[part="icon"]') === null).to.be
    .true;

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

it("keeps the close button operable after a one-shot hide veto and allows a retry", async () => {
  const el = (await fixture(html`
    <lr-toast-item duration="0" style="--lr-toast-hide-duration: 0ms">
      retry dismissal
    </lr-toast-item>
  `)) as LyraToastItem;
  await oneEvent(el, "lr-show");
  const button = el.shadowRoot!.querySelector(
    '[part="close-button"]'
  ) as HTMLButtonElement;

  let hideCount = 0;
  el.addEventListener("lr-hide", (event) => {
    hideCount += 1;
    if (hideCount === 1) event.preventDefault();
  });

  button.click();
  expect(hideCount, "the first click should reach the veto point").to.equal(1);
  expect(button.getAttribute("aria-disabled")).to.equal("false");
  expect(el.isConnected, "the vetoed toast should remain visible").to.equal(
    true
  );

  const afterHide = oneEvent(el, "lr-after-hide");
  button.click();
  expect(button.getAttribute("aria-disabled")).to.equal("true");
  await afterHide;

  expect(hideCount, "the retry should request dismissal again").to.equal(2);
  expect(el.isConnected, "the accepted retry should remove the toast").to.equal(
    false
  );
});

it("gives the close button the shared minimum hit area", async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0">dismiss me</lr-toast-item>`
  )) as LyraToastItem;
  await oneEvent(el, "lr-show");
  const button = el.shadowRoot!.querySelector(
    '[part="close-button"]'
  ) as HTMLElement;
  expect(getComputedStyle(button).minInlineSize).to.equal("40px");
  expect(getComputedStyle(button).minBlockSize).to.equal("40px");
});

it('keeps a visible gap between the message text and a slotted action button, even under a page-level layered CSS reset', async () => {
  // Mirrors LyraToast.create()'s actual DOM shape (toast.class.ts): a plain
  // text-content message followed by an appended <button>, with no
  // whitespace text node in between -- exactly what toast() produces for
  // `action: { label: 'Undo', ... }`. That button is a real light-DOM node
  // (the shadow root only reaches it through ::slotted()), so it is also
  // reachable by the *consumer's own* page-level CSS -- e.g. Tailwind's
  // Preflight, which zeroes margins via `@layer base { *, ::before, ::after,
  // ::backdrop { margin: 0; ... } }`. An unlayered `::slotted(button)` rule
  // loses to that layered reset (confirmed against Storybook's own
  // tailwind.css bundle, which reproduces "Item deletedUndo" with zero
  // visual gap), so the fix must be robust to it, not just to a plain
  // reset with no layer.
  const resetStyle = document.createElement('style');
  resetStyle.textContent = `
    @layer reset {
      *, ::before, ::after, ::backdrop {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
    }
  `;
  document.head.append(resetStyle);
  const el = document.createElement('lr-toast-item') as LyraToastItem;
  el.duration = 0;
  el.textContent = 'Item deleted';
  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = 'Undo';
  el.append(action);
  document.body.append(el);
  try {
    await oneEvent(el, 'lr-show');
    const messageRange = document.createRange();
    messageRange.selectNodeContents(el.firstChild!);
    const messageRect = messageRange.getBoundingClientRect();
    const actionRect = action.getBoundingClientRect();
    expect(
      actionRect.left - messageRect.right,
      'a slotted action button must not visually run into the preceding message text, even under a page-level layered reset',
    ).to.be.greaterThan(0);
  } finally {
    el.remove();
    resetStyle.remove();
  }
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
  const [first, second] = [...wrapper.querySelectorAll<LyraToastItem>('lr-toast-item')];
  if (!first || !second) throw new Error('expected two toast items');
  const before = wrapper.querySelector('#before') as HTMLButtonElement;
  const action = first.querySelector('#action') as HTMLButtonElement;
  const secondClose = second.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
  await waitUntil(() => first.hasAttribute('data-visible') && second.hasAttribute('data-visible'));
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

it('repairs focus immediately on reconnect when a standalone visible item never entered an lr-toast region', async () => {
  const el = (await fixture(html`
    <lr-toast-item duration="0">
      Standalone toast <button id="action">Undo</button>
    </lr-toast-item>
  `)) as LyraToastItem;
  const parent = el.parentElement!;
  await waitUntil(() => el.hasAttribute('data-visible'));
  const action = el.querySelector('#action') as HTMLButtonElement;
  action.focus();
  expect(document.activeElement === action).to.equal(true);

  el.remove();
  parent.append(el);
  await el.updateComplete;

  expect(
    document.activeElement === action,
    'a standalone item outside any lr-toast region must repair focus synchronously on reconnect, not wait for region promotion',
  ).to.equal(true);
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
  const firstSurface = el.shadowRoot?.querySelector<HTMLElement>('[part="toast-item"]');
  expect(firstSurface?.hidden, 'the server-equivalent first render must remain hidden').to.be.true;
  expect(firstSurface?.inert, 'the server-equivalent first render must remain inert').to.be.true;
  const closeLabel = (): string | null =>
    el.shadowRoot?.querySelector<HTMLElement>('[part="close-button"]')?.getAttribute('aria-label') ?? null;
  expect(closeLabel()).to.equal('Close');

  await el.updateComplete;
  expect(closeLabel()).to.equal('Close: Upload complete');
  await waitUntil(() => el.hasAttribute('data-visible'));
  expect(firstSurface?.hidden, 'an accepted client show releases hidden state').to.be.false;
  expect(firstSurface?.inert, 'an accepted client show releases inert state').to.be.false;

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

it('falls back to the default-locale segmenter when the effective-locale segmenter construction throws', async () => {
  const originalSegmenter = Intl.Segmenter;
  let calls = 0;
  class ThrowingFirstSegmenter {
    constructor(locale?: string | string[], options?: Intl.SegmenterOptions) {
      calls += 1;
      if (calls === 1) throw new RangeError('unsupported locale');
      // eslint-disable-next-line constructor-super
      return new originalSegmenter(locale, options);
    }
  }
  Object.defineProperty(Intl, 'Segmenter', {
    configurable: true,
    value: ThrowingFirstSegmenter,
  });
  // A locale unused elsewhere in this file -- getSegmenter() caches per locale+options key, so a
  // previously-warmed cache entry would return the cached real Segmenter without ever attempting
  // (and failing) construction again, defeating the whole point of this test.
  const prefix = 'x'.repeat(39);
  const message = `${prefix}éy`;
  const snippet = `${prefix}é`;
  try {
    const el = (await fixture(html`
      <lr-toast-item
        locale="fr"
        duration="0"
        .strings=${{
          closeWithContext: 'Wrong template {snippet}',
          closeWithTruncatedContext: 'Dismiss [{snippet}] (more)',
        }}
      >${message}</lr-toast-item>
    `)) as LyraToastItem;
    const button = el.shadowRoot?.querySelector<HTMLElement>('[part="close-button"]');
    // Proves the RangeError-catch fallback path itself ran and produced a correct grapheme-aware
    // truncation -- not just that some result rendered. The fallback getSegmenter(undefined, ...)
    // call may hit an already-cached instance for the resolved default locale rather than
    // constructing a fresh one (a legitimate cache hit, not a missed code path), so `calls` is not
    // asserted beyond having attempted (and failed) construction at least once.
    expect(calls, 'the effective-locale segmenter construction must have been attempted').to.be.at.least(1);
    expect(button?.getAttribute('aria-label')).to.equal(`Dismiss [${snippet}] (more)`);
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

it('tracks an external aria-labelledby target for close context and live announcements', async () => {
  const before = announcementTexts('polite');
  const wrapper = await fixture<HTMLDivElement>(html`
    <div>
      <span id="external-toast-label">Upload complete</span>
      <lr-toast-item duration="0">
        <span aria-labelledby="external-toast-label">Ignored fallback</span>
      </lr-toast-item>
    </div>
  `);
  const el = wrapper.querySelector('lr-toast-item') as LyraToastItem;
  await oneEvent(el, 'lr-show');
  const button = el.shadowRoot!.querySelector<HTMLElement>('[part="close-button"]')!;
  expect(button.getAttribute('aria-label')).to.equal('Close: Upload complete');

  wrapper.querySelector('#external-toast-label')!.textContent = 'Upload failed';
  await waitUntil(
    () => button.getAttribute('aria-label') === 'Close: Upload failed',
    'external referenced text should remain in the observer graph',
  );
  expect(announcementTexts('polite').slice(before.length)).to.deep.equal([
    'Upload complete',
    'Upload failed',
  ]);
});

it('tracks an external label through its open shadow root across reconnect, adoption, and replacement', async () => {
  const frame = document.createElement('iframe');
  document.body.append(frame);
  const frameDocument = frame.contentDocument!;
  const fixtureRoot = await fixture<HTMLDivElement>(html`<div></div>`);
  const scenario = document.createElement('div');
  const label = document.createElement('toast-open-shadow-label');
  label.id = 'external-shadow-toast-label';
  label.attachShadow({ mode: 'open' }).textContent = 'Alpha';
  const message = document.createElement('span');
  message.setAttribute('aria-labelledby', label.id);
  message.textContent = 'Ignored fallback';
  const el = document.createElement('lr-toast-item') as LyraToastItem;
  el.duration = 0;
  el.append(message);
  scenario.append(label, el);
  const before = announcementTexts('polite');
  const shown = oneEvent(el, 'lr-show');
  fixtureRoot.append(scenario);

  try {
    await shown;
    const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="close-button"]')!;
    expect(close.getAttribute('aria-label')).to.equal('Close: Alpha');

    label.shadowRoot!.textContent = 'Beta';
    await waitUntil(
      () => close.getAttribute('aria-label') === 'Close: Beta',
      'a referenced open shadow root remains in the observer graph',
    );
    expect(announcementTexts('polite').slice(before.length)).to.deep.equal(['Alpha', 'Beta']);

    scenario.remove();
    fixtureRoot.append(scenario);
    await el.updateComplete;
    label.shadowRoot!.textContent = 'Gamma';
    await waitUntil(
      () => close.getAttribute('aria-label') === 'Close: Gamma',
      'reconnect restores observation of the traversed root',
    );

    scenario.remove();
    frameDocument.body.append(frameDocument.adoptNode(scenario));
    await el.updateComplete;
    label.shadowRoot!.textContent = 'Delta';
    await waitUntil(
      () => close.getAttribute('aria-label') === 'Close: Delta',
      'adoption rebinds observation through the new owner realm',
    );

    const replacement = frameDocument.createElement('toast-open-shadow-label');
    replacement.id = label.id;
    replacement.attachShadow({ mode: 'open' }).textContent = 'Epsilon';
    label.replaceWith(replacement);
    await waitUntil(
      () => close.getAttribute('aria-label') === 'Close: Epsilon',
      'replacing the referenced host discovers its new traversed root',
    );
    replacement.shadowRoot!.textContent = 'Zeta';
    await waitUntil(
      () => close.getAttribute('aria-label') === 'Close: Zeta',
      'the replacement shadow root remains observed after discovery',
    );
  } finally {
    scenario.remove();
    frame.remove();
  }
});

it('keeps pruned action shadow content out of message observation and accessible context', async () => {
  const fixtureRoot = await fixture<HTMLDivElement>(html`<div></div>`);
  const el = document.createElement('lr-toast-item') as LyraToastItem;
  el.duration = 0;
  const action = document.createElement('button');
  const actionLabel = document.createElement('toast-pruned-shadow-label');
  actionLabel.attachShadow({ mode: 'open' }).textContent = 'Alpha';
  action.append(actionLabel);
  const message = document.createElement('span');
  message.textContent = 'Visible message';
  el.append(action, message);
  fixtureRoot.append(el);
  await oneEvent(el, 'lr-show');
  const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="close-button"]')!;
  const before = announcementTexts('polite');

  expect(close.getAttribute('aria-label')).to.equal('Close: Visible message');
  actionLabel.shadowRoot!.textContent = 'Beta';
  await aTimeout(30);
  await el.updateComplete;

  expect(close.getAttribute('aria-label')).to.equal('Close: Visible message');
  expect(announcementTexts('polite')).to.deep.equal(before);
});

it('uses a localized truthful fallback when bounded traversal yields no message prefix', async () => {
  const before = announcementTexts('polite');
  const fixtureRoot = await fixture<HTMLDivElement>(html`<div></div>`);
  const el = document.createElement('lr-toast-item') as LyraToastItem;
  el.duration = 0;
  let cursor: HTMLElement = el;
  for (let depth = 0; depth < 260; depth += 1) {
    const child = document.createElement('span');
    cursor.append(child);
    cursor = child;
  }
  cursor.textContent = 'Text beyond the traversal boundary';
  const shown = oneEvent(el, 'lr-show');
  fixtureRoot.append(el);
  await shown;

  const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="close-button"]')!;
  expect(close.getAttribute('aria-label')).to.equal('Close: Notification with incomplete content');
  expect(announcementTexts('polite').slice(before.length)).to.deep.equal([
    'Notification with incomplete content',
  ]);

  el.strings = {
    closeWithContext: 'Dismiss: {snippet}',
    closeWithTruncatedContext: 'Wrong truncated template: {snippet}',
    toastContentIncomplete: 'Localized incomplete notification',
  };
  await el.updateComplete;
  expect(close.getAttribute('aria-label')).to.equal('Dismiss: Localized incomplete notification');
});

it('marks a traversal-limited message as incomplete in both the close name and announcement', async () => {
  const before = announcementTexts('polite');
  const message = 'x'.repeat(5_000);
  const el = (await fixture(html`
    <lr-toast-item
      duration="0"
      .strings=${{
        closeWithContext: 'Wrong complete template {snippet}',
        closeWithTruncatedContext: 'Dismiss [{snippet}] (more)',
      }}
    >${message}</lr-toast-item>
  `)) as LyraToastItem;
  await oneEvent(el, 'lr-show');

  const button = el.shadowRoot!.querySelector<HTMLElement>('[part="close-button"]')!;
  expect(button.getAttribute('aria-label')).to.equal(`Dismiss [${'x'.repeat(40)}] (more)`);
  const announcement = announcementTexts('polite').slice(before.length).at(-1)!;
  expect(announcement.length, 'the bounded prefix carries one explicit truncation marker').to.equal(4_097);
  expect(announcement.endsWith('…')).to.equal(true);
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

it('tracks direct text through a forwarding slot', async () => {
  const wrapper = (await fixture(html`
    <toast-message-forward-wrapper>Upload complete</toast-message-forward-wrapper>
  `)) as ToastMessageForwardWrapper;
  const el = wrapper.shadowRoot!.querySelector('lr-toast-item') as LyraToastItem;
  await el.updateComplete;
  const button = el.shadowRoot!.querySelector<HTMLElement>('[part="close-button"]')!;
  const message = wrapper.firstChild as Text;

  expect(button.getAttribute('aria-label')).to.equal('Close: Upload complete');

  message.data = 'Upload failed';
  await Promise.resolve();
  await el.updateComplete;
  expect(button.getAttribute('aria-label')).to.equal('Close: Upload failed');
});

it('derives its initial close label without MutationObserver support', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
  Object.defineProperty(window, 'MutationObserver', { configurable: true, value: undefined });
  try {
    const el = (await fixture(
      html`<lr-toast-item duration="0">Upload complete</lr-toast-item>`,
    )) as LyraToastItem;
    const button = el.shadowRoot!.querySelector<HTMLElement>('[part="close-button"]')!;
    expect(button.getAttribute('aria-label')).to.equal('Close: Upload complete');
  } finally {
    if (descriptor) Object.defineProperty(window, 'MutationObserver', descriptor);
    else Reflect.deleteProperty(window, 'MutationObserver');
  }
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
    await el.updateComplete;
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
    else Reflect.deleteProperty(frameWindow, 'MutationObserver');
    frame.remove();
  }
});

it('queues inertly then self-releases when its lr-toast parent never gets an upgraded region controller', async () => {
  const frame = document.createElement('iframe');
  const loaded = oneEvent(frame, 'load');
  frame.srcdoc = '<!doctype html><html><body></body></html>';
  document.body.append(frame);
  await loaded;
  const frameDocument = frame.contentDocument!;
  try {
    expect(frame.contentWindow!.customElements.get('lr-toast')).to.equal(undefined);
    const item = (await fixture(
      html`<lr-toast-item duration="0">Adopted item</lr-toast-item>`,
    )) as LyraToastItem;
    item.remove();
    const region = frameDocument.createElement('lr-toast');
    frameDocument.body.append(region);
    region.append(frameDocument.adoptNode(item));
    await item.updateComplete;

    expect(item.hasAttribute('data-toast-queued'), 'queues inertly behind the unavailable parent').to.be
      .true;
    await waitUntil(() => !item.isConnected, 'an unavailable owner-realm controller must release the queued item', {
      timeout: 300,
    });
  } finally {
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
  const wrapper = (await fixture(html`
    <div>
      <lr-toast-item duration="0">Themed close button</lr-toast-item>
    </div>
  `)) as HTMLElement;
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

it('collapses the show/hide transition duration under prefers-reduced-motion', async () => {
  expect(styles.cssText).to.match(/@media \(prefers-reduced-motion: reduce\)/);
  expect(styles.cssText).to.match(/transition-duration:\s*0\.01ms/);

  try {
    await setReducedMotion('no-preference');
    const el = (await fixture(
      html`<lr-toast-item
        duration="0"
        style="--lr-toast-show-duration: 2s linear"
      >Motion</lr-toast-item>`,
    )) as LyraToastItem;
    await waitUntil(() => el.hasAttribute('data-visible'));
    const surface = el.shadowRoot!.querySelector<HTMLElement>('[part="toast-item"]')!;
    expect(
      getComputedStyle(surface)
        .transitionDuration.split(', ')
        .every((duration) => duration === '2s'),
    ).to.equal(true);

    await setReducedMotion('reduce');
    await waitUntil(
      () => parseFloat(getComputedStyle(surface).transitionDuration) < 0.001,
      'toast transition duration did not collapse under reduced motion',
    );
  } finally {
    await setReducedMotion('no-preference');
  }
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
  })) as unknown as typeof window.matchMedia;

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

it('renders the close-button focus-visible outline from the shared focus-ring tokens', async () => {
  const el = await fixture<LyraToastItem>(html`
    <lr-toast-item
      duration="0"
      style="--lr-focus-ring-width: 6px; --lr-focus-ring-color: rgb(1, 2, 3); --lr-focus-ring-offset: 4px"
    >Focus test</lr-toast-item>
  `);
  await waitUntil(() => el.hasAttribute('data-visible'));
  const close = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="close-button"]')!;
  await sendKeys({ press: 'Tab' });
  close.focus();
  await waitUntil(() => {
    const computed = getComputedStyle(close);
    return (
      computed.outlineWidth === '6px' &&
      computed.outlineColor === 'rgb(1, 2, 3)' &&
      computed.outlineOffset === '4px'
    );
  }, 'the rendered toast close-button focus ring never appeared');
});

it('keeps the inactive subtree inert and hidden, then releases a vetoed initial show', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0">suppressed <a href="#suppressed-target">action</a></lr-toast-item>`,
  )) as LyraToastItem;
  let hiddenDuringRequest = false;
  let inertDuringRequest = false;
  el.addEventListener('lr-show', (event) => {
    const requestedSurface = el.shadowRoot!.querySelector<HTMLElement>('[part="toast-item"]')!;
    hiddenDuringRequest = requestedSurface.hidden === true;
    inertDuringRequest = requestedSurface.inert;
    event.preventDefault();
  });
  let afterShows = 0;
  el.addEventListener('lr-after-show', () => { afterShows += 1; });

  const surface = el.shadowRoot!.querySelector<HTMLElement>('[part="toast-item"]')!;
  const action = el.querySelector<HTMLAnchorElement>('a')!;
  action.focus();
  expect(surface.hidden, 'pre-show content is not painted').to.be.true;
  expect(surface.inert, 'pre-show actions are outside sequential/programmatic focus').to.be.true;
  expect(document.activeElement === action, 'an inert slotted action must reject focus').to.be.false;

  await aTimeout(80);
  expect(hiddenDuringRequest, 'the surface stays hidden throughout the veto point').to.be.true;
  expect(inertDuringRequest, 'the surface stays inert throughout the veto point').to.be.true;
  expect(el.hasAttribute('data-visible'), 'a vetoed toast never becomes visible').to.be.false;
  expect(afterShows, 'a transition that never happened has no after-event').to.equal(0);
  expect(el.isConnected, 'the rejected item releases its owner instead of lingering invisibly').to.be.false;
});

it('coalesces a reentrant hide request so the outer veto remains authoritative', async () => {
  const el = (await fixture(
    html`<lr-toast-item duration="0">reentrant dismissal</lr-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lr-after-show');
  let hideRequests = 0;
  let nestedHide: Promise<void> = Promise.resolve();
  const vetoReentrantHide = (event: Event): void => {
    hideRequests += 1;
    if (hideRequests !== 1) return;
    nestedHide = el.hide();
    event.preventDefault();
  };
  el.addEventListener('lr-hide', vetoReentrantHide);

  const outerHide = el.hide();
  await Promise.all([outerHide, nestedHide]);
  expect(hideRequests, 'nested calls share the in-flight hide request').to.equal(1);
  expect(el.isConnected, 'the outer veto keeps the item mounted').to.be.true;
  expect(el.hasAttribute('data-visible')).to.be.true;
  expect(el.hasAttribute('data-hiding')).to.be.false;
  const close = el.shadowRoot!.querySelector<HTMLElement>('[part="close-button"]')!;
  expect(close.getAttribute('aria-disabled')).to.equal('false');

  el.removeEventListener('lr-hide', vetoReentrantHide);
  await el.hide();
  expect(el.isConnected).to.be.false;
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

it('accepts every LyraToastVariant literal via the JS property and reflects it as an attribute', async () => {
  const el = (await fixture(html`<lr-toast-item duration="0">typed</lr-toast-item>`)) as LyraToastItem;
  const variants: readonly LyraToastVariant[] = ['neutral', 'brand', 'success', 'warning', 'danger'];
  for (const variant of variants) {
    el.variant = variant;
    await el.updateComplete;
    expect(el.getAttribute('variant')).to.equal(variant);
  }
});

it('accepts every LyraToastSize literal via the JS property and reflects it as an attribute', async () => {
  const el = (await fixture(html`<lr-toast-item duration="0">typed</lr-toast-item>`)) as LyraToastItem;
  const sizes: readonly LyraToastSize[] = ['2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large'];
  for (const size of sizes) {
    el.size = size;
    await el.updateComplete;
    expect(el.getAttribute('size')).to.equal(size);
  }
});

describe('a slotted [hidden] action button', () => {
  it('is removed from the rendered box, not just from the accessibility tree', async () => {
    const el = (await fixture(html`
      <lr-toast-item duration="0">
        Item deleted
        <button id="gone" type="button" hidden>Undo</button>
        <button id="shown" type="button">Retry</button>
      </lr-toast-item>
    `)) as LyraToastItem;
    await el.updateComplete;
    const surface = el.shadowRoot!.querySelector<HTMLElement>('[part="toast-item"]')!;
    await waitUntil(() => !surface.hasAttribute('hidden'), 'the toast surface never mounted');
    const gone = el.querySelector<HTMLButtonElement>('#gone')!;
    const shown = el.querySelector<HTMLButtonElement>('#shown')!;
    expect(getComputedStyle(gone).display).to.equal('none');
    expect(gone.getClientRects().length).to.equal(0);
    // The companion proves the ::slotted(button) rule itself is still live, so the assertion
    // above cannot pass merely because the toast failed to style its slotted actions at all.
    expect(getComputedStyle(shown).display).to.equal('inline-block');
    expect(shown.getClientRects().length).to.equal(1);
  });
});

it('falls back to the medium rendering tier for an invalid size property write', async () => {
  const el = await fixture<LyraToastItem>(html`
    <lr-toast-item duration="0">Invalid size</lr-toast-item>
  `);
  el.size = 'unexpected' as LyraToastSize;
  await el.updateComplete;

  expect(el.getAttribute('data-effective-size')).to.equal('m');
});

it('keeps non-actionable tabindex=-1 message content in the contextual close name', async () => {
  const el = await fixture<LyraToastItem>(html`
    <lr-toast-item duration="0">
      Saved <span tabindex="-1">draft</span>
    </lr-toast-item>
  `);
  await el.updateComplete;

  expect(
    el.shadowRoot!
      .querySelector<HTMLElement>('[part="close-button"]')!
      .getAttribute('aria-label'),
  ).to.equal('Close: Saved draft');
});

it('does not resurrect a show request whose lifecycle listener disconnects the item', async () => {
  for (const veto of [false, true]) {
    const el = document.createElement('lr-toast-item') as LyraToastItem;
    el.duration = 0;
    el.textContent = veto ? 'Removed and vetoed' : 'Removed during request';
    let afterShows = 0;
    el.addEventListener('lr-show', (event) => {
      el.remove();
      if (veto) event.preventDefault();
    });
    el.addEventListener('lr-after-show', () => afterShows++);

    document.body.append(el);
    await aTimeout(40);

    expect(el.isConnected, `veto=${veto}`).to.be.false;
    expect(el.hasAttribute('data-visible'), `veto=${veto}`).to.be.false;
    expect(afterShows, `veto=${veto}`).to.equal(0);
  }
});

it('parses millisecond and second CSS timing lists before transition completion', async () => {
  const el = await fixture<LyraToastItem>(html`
    <lr-toast-item duration="0">Timed dismissal</lr-toast-item>
  `);
  await oneEvent(el, 'lr-after-show');
  const surface = el.shadowRoot!.querySelector<HTMLElement>('[part="toast-item"]')!;
  const nativeGetComputedStyle = window.getComputedStyle;
  window.getComputedStyle = ((element: Element, pseudo?: string | null) => {
    const computed = nativeGetComputedStyle.call(window, element, pseudo);
    if (element !== surface) return computed;
    return new Proxy(computed, {
      get(target, property, receiver) {
        if (property === 'transitionDuration') return 'invalid, 2ms, 0.003s';
        if (property === 'transitionDelay') return '0ms, 0s';
        if (property === 'animationDuration') return '0ms';
        if (property === 'animationDelay') return '0s';
        const value = Reflect.get(target, property, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }) as typeof window.getComputedStyle;

  try {
    const hidden = el.hide();
    surface.dispatchEvent(new Event('transitionend'));
    await hidden;
    expect(el.isConnected).to.be.false;
  } finally {
    window.getComputedStyle = nativeGetComputedStyle;
    el.remove();
  }
});
