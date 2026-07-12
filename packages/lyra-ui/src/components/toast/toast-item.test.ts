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

it('is accessible', async () => {
  const el = (await fixture(
    html`<lyra-toast-item variant="brand" duration="0">hello</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
  await expect(el).to.be.accessible();
});

it('renders the shared close icon svg instead of a literal times-entity glyph', async () => {
  const el = (await fixture(
    html`<lyra-toast-item duration="0">hi</lyra-toast-item>`,
  )) as LyraToastItem;
  const button = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement;
  expect(button.querySelector('svg')).to.exist;
  expect(button.textContent?.trim()).to.equal('');
});

it('uses the shared 180ms transition-base duration for hide, not the old 250ms hardcode', async () => {
  const el = (await fixture(
    html`<lyra-toast-item duration="0">bye</lyra-toast-item>`,
  )) as LyraToastItem;
  await oneEvent(el, 'lyra-show');
  const start = performance.now();
  void el.hide();
  await oneEvent(el, 'lyra-after-hide');
  const elapsed = performance.now() - start;
  expect(elapsed).to.be.greaterThan(150);
  expect(elapsed).to.be.lessThan(230);
});

it('derives the CSS show/hide transition duration from --lyra-transition-base instead of a hardcoded 250ms', () => {
  expect(styles.cssText).to.include('var(--lyra-transition-base');
  expect(styles.cssText).to.not.include('250ms');
});

it('collapses the show/hide transition duration under prefers-reduced-motion', () => {
  expect(styles.cssText).to.match(/@media \(prefers-reduced-motion: reduce\)/);
  expect(styles.cssText).to.match(/transition-duration:\s*0\.01ms/);
});

it('defines a focus-visible outline for the close button using the shared focus-ring tokens', () => {
  expect(styles.cssText).to.match(/\[part=['"]close-button['"]\]:focus-visible/);
  expect(styles.cssText).to.match(
    /outline:\s*var\(--lyra-focus-ring-width\)\s*solid\s*var\(--lyra-focus-ring-color\)/,
  );
});
