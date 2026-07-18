import { fixture, expect, oneEvent, html, aTimeout } from '@open-wc/testing';
import './toast-item.js';
import type { LyraToastItem } from './toast-item.js';
import { styles } from './toast-item.styles.js';

it('emits lifecycle events and uses an assertive role for danger', async () => {
  const el = (await fixture(
    html`<lyra-toast-item variant="danger" duration="0">boom</lyra-toast-item>`,
  )) as LyraToastItem;

  await oneEvent(el, 'lyra-show');
  expect(el.getAttribute('role')).to.equal('alert');

  setTimeout(() => void el.hide());
  await oneEvent(el, 'lyra-after-hide');
  expect(el.isConnected).to.be.false;
});

it('uses a polite role for neutral/brand/success', async () => {
  const el = (await fixture(
    html`<lyra-toast-item variant="success" duration="0">ok</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
  expect(el.getAttribute('role')).to.equal('status');
});

it('auto-dismisses after its duration', async () => {
  const el = (await fixture(
    html`<lyra-toast-item duration="10">bye</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-after-hide');
  expect(el.isConnected).to.be.false;
});

it('does not auto-dismiss early after an interleaved pointer+focus pause/resume sequence', async () => {
  // An earlier resumeTimer() call that isn't cleared before a later one
  // orphans its own setTimeout -- that leaked timer keeps running even
  // after a subsequent pauseTimer() call, and can fire hide() while the
  // toast is still meant to be paused (hovering/focused).
  const el = (await fixture(html`<lyra-toast-item duration="120">hi</lyra-toast-item>`)) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
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
    html`<lyra-toast-item duration="60">extend me</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-show');

  el.duration = 400; // extend well past the original 60ms window
  await el.updateComplete;

  await aTimeout(150); // past the original duration, well before the new one
  expect(el.isConnected, 'toast should still be open -- duration was extended').to.be.true;

  await oneEvent(el, 'lyra-after-hide');
  expect(el.isConnected).to.be.false;
});

it('hides immediately when called before the show animation frame has run', async () => {
  const el = document.createElement('lyra-toast-item') as LyraToastItem;
  el.textContent = 'msg';
  let sawShow = false;
  el.addEventListener('lyra-show', () => (sawShow = true));
  document.body.appendChild(el);
  const hidden = el.hide(); // runs before firstUpdated()'s rAF has had a chance to fire
  await hidden;
  expect(el.isConnected).to.be.false;
  // The pending rAF must not resurrect the show sequence on top of an
  // already-hiding item -- without the `if (this.hiding) return;` guard, the
  // rAF still fires (it isn't cancelled until disconnectedCallback, which
  // only runs once hide() reaches this.remove()) and re-sets data-visible /
  // emits lyra-show underneath the in-flight hide().
  expect(sawShow, 'lyra-show should not fire once hide() ran before the first frame').to.be.false;
  expect(el.hasAttribute('data-visible'), 'data-visible should not be resurrected by a stale rAF callback').to
    .be.false;
});

it('hides promptly when duration is shortened below the already-elapsed time', async () => {
  const el = (await fixture(html`<lyra-toast-item duration="5000">msg</lyra-toast-item>`)) as LyraToastItem;
  await aTimeout(50);
  el.duration = 10;
  // resumeTimer() must call hide() synchronously once it sees the shortened
  // duration is already behind elapsedMs -- but hide() still runs the full
  // ANIM_MS hide animation before this.remove() actually disconnects it, so
  // the wait budget needs to clear that delay too, not just the (already
  // negative) timer remainder.
  await oneEvent(el, 'lyra-after-hide');
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
      html`<lyra-toast-item duration="5000">msg</lyra-toast-item>`,
    )) as LyraToastItem;
    await aTimeout(50);
    el.duration = 10; // already behind elapsedMs -- resumeTimer() calls hide() synchronously
    await oneEvent(el, 'lyra-after-hide');
  } finally {
    console.warn = originalWarn;
  }

  const messages = calls.flat().map(String);
  expect(messages.some((m) => m.includes('scheduled an update'))).to.be.false;
});

it('restarts the timer when duration changes from disabled (0) back to a positive value', async () => {
  const el = (await fixture(html`<lyra-toast-item duration="0">msg</lyra-toast-item>`)) as LyraToastItem;
  await aTimeout(20);
  expect(el.isConnected).to.be.true;
  el.duration = 15;
  await oneEvent(el, 'lyra-after-hide');
  expect(el.isConnected).to.be.false;
});

it('keeps an explicit Infinity duration meaning "never auto-dismiss" instead of coercing it into a large finite timeout', async () => {
  const el = (await fixture(html`<lyra-toast-item duration="Infinity">msg</lyra-toast-item>`)) as LyraToastItem;
  expect((el as any).safeDuration).to.equal(Infinity);
  await aTimeout(60);
  expect(el.isConnected, 'Infinity must never schedule a real dismiss timer').to.be.true;
});

it('self-heals a NaN duration to the constructed default, and a negative duration to the same disabled state as 0', async () => {
  const nanEl = (await fixture(html`<lyra-toast-item duration="NaN">msg</lyra-toast-item>`)) as LyraToastItem;
  expect((nanEl as any).safeDuration).to.equal(5000);

  const negativeEl = (await fixture(html`<lyra-toast-item duration="-50">msg</lyra-toast-item>`)) as LyraToastItem;
  expect((negativeEl as any).safeDuration).to.equal(0);
  await aTimeout(30);
  expect(negativeEl.isConnected, 'a negative duration clamps to 0, which this component already treats as disabled').to.be
    .true;
});

it('resolves hide() even if the element disconnects mid-hide-animation', async () => {
  const el = (await fixture(html`<lyra-toast-item>msg</lyra-toast-item>`)) as LyraToastItem;
  const hidden = el.hide();
  el.remove();
  await hidden; // must not hang forever
});

it('applies distinct visual sizing per the `size` property', async () => {
  const xs = (await fixture(
    html`<lyra-toast-item size="xs" duration="0">a</lyra-toast-item>`,
  )) as LyraToastItem;
  const xl = (await fixture(
    html`<lyra-toast-item size="xl" duration="0">a</lyra-toast-item>`,
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

it('updates the ARIA role live when `variant` changes after creation', async () => {
  const el = (await fixture(
    html`<lyra-toast-item variant="neutral" duration="0">progress</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
  expect(el.getAttribute('role')).to.equal('status');

  el.variant = 'danger';
  await el.updateComplete;
  expect(el.getAttribute('role'), 'role should switch to alert once variant becomes danger').to.equal('alert');
});

it('renders the icon part/slot only when withIcon is true', async () => {
  const withoutIcon = (await fixture(
    html`<lyra-toast-item duration="0">no icon</lyra-toast-item>`,
  )) as LyraToastItem;
  expect(withoutIcon.shadowRoot!.querySelector('[part="icon"]')).to.be.null;

  const withIcon = (await fixture(
    html`<lyra-toast-item with-icon duration="0">has icon</lyra-toast-item>`,
  )) as LyraToastItem;
  expect(withIcon.shadowRoot!.querySelector('[part="icon"]')).to.exist;
  expect(withIcon.shadowRoot!.querySelector('[part="icon"] slot[name="icon"]')).to.exist;
});

it('does not fire lyra-hide/lyra-after-hide twice when hide() is called twice concurrently', async () => {
  const el = (await fixture(html`<lyra-toast-item duration="0">dup</lyra-toast-item>`)) as LyraToastItem;
  await oneEvent(el, 'lyra-show');

  let hideCount = 0;
  let afterHideCount = 0;
  el.addEventListener('lyra-hide', () => hideCount++);
  el.addEventListener('lyra-after-hide', () => afterHideCount++);

  void el.hide();
  void el.hide();

  await aTimeout(300);
  expect(hideCount, 'lyra-hide should fire exactly once').to.equal(1);
  expect(afterHideCount, 'lyra-after-hide should fire exactly once').to.equal(1);
});

it('marks the close button aria-disabled once hiding starts and ignores a rapid double-click', async () => {
  const el = (await fixture(html`<lyra-toast-item duration="0">dup</lyra-toast-item>`)) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;

  let hideCount = 0;
  let afterHideCount = 0;
  el.addEventListener('lyra-hide', () => hideCount++);
  el.addEventListener('lyra-after-hide', () => afterHideCount++);

  button.click();
  expect(button.getAttribute('aria-disabled')).to.equal('true');
  button.click();

  await aTimeout(300);
  expect(hideCount, 'lyra-hide should fire exactly once').to.equal(1);
  expect(afterHideCount, 'lyra-after-hide should fire exactly once').to.equal(1);
});

it('gives the close button the shared minimum hit area', async () => {
  const el = (await fixture(html`<lyra-toast-item duration="0">dismiss me</lyra-toast-item>`)) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
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
    html`<lyra-toast-item duration="0">focus me</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;

  button.focus();
  expect(el.shadowRoot!.activeElement).to.equal(button);

  button.click();
  await el.updateComplete;
  expect(
    el.shadowRoot!.activeElement,
    'close button should remain focused, not blurred to <body>',
  ).to.equal(button);
});

it('stays paused on pointerleave while focus still holds it paused', async () => {
  const el = (await fixture(html`<lyra-toast-item duration="120">hi</lyra-toast-item>`)) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
  const item = el.shadowRoot!.querySelector('[part="toast-item"]') as HTMLElement;

  item.dispatchEvent(new PointerEvent('pointerenter'));
  item.dispatchEvent(new FocusEvent('focusin'));
  item.dispatchEvent(new PointerEvent('pointerleave')); // hover ends, but focus still holds the pause

  await aTimeout(200); // past `duration`, but focus should still hold the toast paused
  expect(el.isConnected, 'toast should still be open -- focus still holds the pause').to.be.true;
});

it('stays paused on focusout while the pointer is still hovering', async () => {
  const el = (await fixture(html`<lyra-toast-item duration="120">hi</lyra-toast-item>`)) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
  const item = el.shadowRoot!.querySelector('[part="toast-item"]') as HTMLElement;

  item.dispatchEvent(new FocusEvent('focusin'));
  item.dispatchEvent(new PointerEvent('pointerenter'));
  item.dispatchEvent(new FocusEvent('focusout')); // focus ends, but hover still holds the pause

  await aTimeout(200); // past `duration`, but hover should still hold the toast paused
  expect(el.isConnected, 'toast should still be open -- hover still holds the pause').to.be.true;
});

it('cancels the pending first-paint rAF when removed before it fires, so it cannot resurrect a detached toast', async () => {
  const el = (await fixture(
    html`<lyra-toast-item duration="0">gone before paint</lyra-toast-item>`,
  )) as LyraToastItem;
  await el.updateComplete; // firstUpdated ran and scheduled its rAF, which hasn't fired yet

  let sawShow = false;
  el.addEventListener('lyra-show', () => (sawShow = true));
  el.remove(); // disconnect before the browser's next paint

  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await aTimeout(20);

  expect(sawShow, 'lyra-show should not fire for a toast removed before first paint').to.be.false;
  expect(el.hasAttribute('data-visible')).to.be.false;
});

it('cancels the pending show-animation timeout when disconnected out-of-band, so it cannot emit on a detached node', async () => {
  const el = (await fixture(
    html`<lyra-toast-item duration="0">detach mid-show</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-show'); // the lyra-after-show setTimeout is now pending

  let sawAfterShow = false;
  el.addEventListener('lyra-after-show', () => (sawAfterShow = true));

  el.remove(); // disconnect out-of-band (e.g. the hosting region itself was torn down)

  await aTimeout(220); // past ANIM_MS
  expect(sawAfterShow, 'lyra-after-show should not fire for a node disconnected mid-show-animation').to.be
    .false;
});

it('cancels the pending hide-animation timeout when disconnected out-of-band, so it cannot emit or re-remove a detached node', async () => {
  const el = (await fixture(
    html`<lyra-toast-item duration="0">detach mid-hide</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-show');

  let sawAfterHide = false;
  el.addEventListener('lyra-after-hide', () => (sawAfterHide = true));

  void el.hide(); // starts the ANIM_MS hide delay
  el.remove(); // disconnect out-of-band before the hide animation timeout fires

  await aTimeout(220); // past ANIM_MS
  expect(sawAfterHide, 'lyra-after-hide should not fire for a node disconnected mid-hide-animation').to.be
    .false;
});

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-toast-item variant="brand" duration="0">hello</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
  await expect(el).to.be.accessible();
});

it('derives the close button aria-label from the toast message for a11y in multi-toast stacks', async () => {
  const el = (await fixture(
    html`<lyra-toast-item duration="0">Upload complete</lyra-toast-item>`,
  )) as LyraToastItem;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  expect(button.getAttribute('aria-label')).to.equal('Close: Upload complete');
});

it('falls back to a generic close label when the toast has no text content', async () => {
  const el = (await fixture(html`<lyra-toast-item duration="0"></lyra-toast-item>`)) as LyraToastItem;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  expect(button.getAttribute('aria-label')).to.equal('Close');
});

it('excludes an appended action button\'s text from the derived close label', async () => {
  // Mirrors toaster.ts, which appends a light-DOM <button> sibling of the
  // message text after the item's first render (the action-button feature).
  const el = (await fixture(
    html`<lyra-toast-item duration="0">Item deleted</lyra-toast-item>`,
  )) as LyraToastItem;
  const action = document.createElement('button');
  action.type = 'button';
  action.textContent = 'Undo';
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
    html`<lyra-toast-item with-icon duration="0">Upload complete</lyra-toast-item>`,
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
    html`<lyra-toast-item duration="0">hi</lyra-toast-item>`,
  )) as LyraToastItem;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  expect(button.querySelector('svg')).to.exist;
  expect(button.textContent?.trim()).to.equal('');
});

it('uses the configured hide transition duration for lifecycle completion', async () => {
  const el = (await fixture(
    html`<lyra-toast-item duration="0">bye</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
  el.style.setProperty('--lyra-toast-hide-duration', '20ms linear');
  const start = performance.now();
  void el.hide();
  await oneEvent(el, 'lyra-after-hide');
  const elapsed = performance.now() - start;
  expect(elapsed).to.be.lessThan(150);
});

it('exposes distinct namespaced show and hide transition properties', () => {
  expect(styles.cssText).to.include('var(--lyra-transition-base');
  expect(styles.cssText).to.include('--lyra-toast-show-duration');
  expect(styles.cssText).to.include('--lyra-toast-hide-duration');
  expect(styles.cssText).to.not.include('--show-duration');
  expect(styles.cssText).to.not.include('--hide-duration');
});

it('completes a hide on transitionend without waiting for the fallback timeout', async () => {
  const el = (await fixture(
    html`<lyra-toast-item duration="0">transition</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
  el.style.setProperty('--lyra-toast-hide-duration', '2s linear');
  const afterHide = oneEvent(el, 'lyra-after-hide');
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
      html`<lyra-toast-item duration="0">reduced motion</lyra-toast-item>`,
    )) as LyraToastItem;
    const showStart = performance.now();
    await oneEvent(el, 'lyra-after-show');
    expect(performance.now() - showStart).to.be.lessThan(100);

    const hideStart = performance.now();
    void el.hide();
    await oneEvent(el, 'lyra-after-hide');
    expect(performance.now() - hideStart).to.be.lessThan(100);
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

it('defines a focus-visible outline for the close button using the shared focus-ring tokens', () => {
  expect(styles.cssText).to.match(/\[part=['"]close-button['"]\]:focus-visible/);
  expect(styles.cssText).to.match(
    /outline:\s*var\(--lyra-focus-ring-width\)\s*solid\s*var\(--lyra-focus-ring-color\)/,
  );
});
