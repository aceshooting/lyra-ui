import { expect, fixture, html } from '@open-wc/testing';
import './lightbox.js';
import type { LyraLightbox } from './lightbox.js';

const image = {
  src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="%230969da"/%3E%3C/svg%3E',
  alt: 'Blue square',
  caption: 'A blue square',
};

it('renders the image frame and exposes a dialog when opened', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]}></lr-lightbox>`)) as LyraLightbox;
  expect(el.shadowRoot!.querySelector('[part="frame"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="panel"]')!.getAttribute('role')).to.equal(null);

  el.open = true;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="panel"]')!.getAttribute('role')).to.equal('dialog');
  expect(el.shadowRoot!.querySelector('[part="caption"]')!.textContent).to.contain('A blue square');
  el.open = false;
});

it('is accessible while open', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  await expect(el).to.be.accessible();
  el.open = false;
});

it('closes on Escape and emits lr-lightbox-close with reason "escape"', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  let detail: unknown;
  el.addEventListener('lr-lightbox-close', (e) => (detail = (e as CustomEvent).detail));

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(detail).to.equal('escape');
});

it('does not respond to Escape while closed', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]}></lr-lightbox>`)) as LyraLightbox;
  let fired = false;
  el.addEventListener('lr-lightbox-close', () => (fired = true));

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(fired).to.be.false;
});

it('closes on backdrop click and emits lr-lightbox-close with reason "backdrop"', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  let detail: unknown;
  el.addEventListener('lr-lightbox-close', (e) => (detail = (e as CustomEvent).detail));

  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(detail).to.equal('backdrop');
});

it('ignores a backdrop click when no-light-dismiss is set', async () => {
  const el = (await fixture(
    html`<lr-lightbox .images=${[image]} open no-light-dismiss></lr-lightbox>`,
  )) as LyraLightbox;

  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  await el.updateComplete;

  expect(el.open).to.be.true;
});

it('closes via the close button and emits lr-lightbox-close with reason "close-button"', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  let detail: unknown;
  el.addEventListener('lr-lightbox-close', (e) => (detail = (e as CustomEvent).detail));

  (el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement).click();
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(detail).to.equal('close-button');
});

it('stays open when a lr-lightbox-close listener calls preventDefault()', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  el.addEventListener('lr-lightbox-close', (e) => e.preventDefault());

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.open).to.be.true;
  el.open = false;
});

it('emits lr-lightbox-close with reason "unmount" when removed from the DOM while open', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  let detail: unknown;
  el.addEventListener('lr-lightbox-close', (e) => (detail = (e as CustomEvent).detail));

  el.remove();
  await Promise.resolve();
  await Promise.resolve();

  expect(detail).to.equal('unmount');
});

it('does not treat a synchronous reparent as an unmount', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  let fired = false;
  el.addEventListener('lr-lightbox-close', () => (fired = true));

  const destination = document.createElement('div');
  document.body.append(destination);
  destination.append(el);
  await Promise.resolve();
  await Promise.resolve();

  expect(fired).to.be.false;
  expect(el.open).to.be.true;
  destination.remove();
});

it('mirrors next/previous under dir="rtl" so the physical arrow key stays consistent', async () => {
  const images = [image, { ...image, caption: 'Second' }];
  const el = (await fixture(html`<lr-lightbox dir="rtl" .images=${images} open></lr-lightbox>`)) as LyraLightbox;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;

  panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }));
  await el.updateComplete;
  expect(el.index).to.equal(1);

  panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }));
  await el.updateComplete;
  expect(el.index).to.equal(0);

  el.open = false;
});

it('jumps to the first/last image on Home/End', async () => {
  const images = [image, { ...image, caption: 'Second' }, { ...image, caption: 'Third' }];
  const el = (await fixture(
    html`<lr-lightbox .images=${images} open index="1"></lr-lightbox>`,
  )) as LyraLightbox;
  const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;

  panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', cancelable: true }));
  await el.updateComplete;
  expect(el.index).to.equal(2);

  panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', cancelable: true }));
  await el.updateComplete;
  expect(el.index).to.equal(0);

  el.open = false;
});

// Regression coverage for the shared finite-number normalization layer (`src/internal/numbers.ts`)
// -- currentIndex() previously hand-rolled its own Number.isFinite/Math.trunc guard instead of
// using it; a non-finite, negative, non-integer, or out-of-range `index` must still clamp to a
// valid, in-bounds image instead of throwing or rendering nothing.
it('clamps a non-finite index to a valid in-range image instead of rendering nothing', async () => {
  const images = [image, { ...image, caption: 'Second' }, { ...image, caption: 'Third' }];
  const el = (await fixture(html`<lr-lightbox .images=${images} open></lr-lightbox>`)) as LyraLightbox;
  await el.updateComplete;

  el.index = Number.NaN;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="caption"]')!.textContent).to.contain('A blue square');

  // Non-finite falls back to 0, exactly like NaN above -- only a genuinely out-of-range *finite*
  // value (e.g. -5 below) clamps to the nearer bound instead.
  el.index = Infinity;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="caption"]')!.textContent).to.contain('A blue square');

  el.index = -5;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="caption"]')!.textContent).to.contain('A blue square');

  el.index = 1.9;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="caption"]')!.textContent).to.contain('Second');

  el.open = false;
});

// -- Live-region announcement (see willUpdate()'s doc for why liveText is derived there, not in
// updated()) --------------------------------------------------------------------------------

it('announces the current position in part="live-region" and keeps it in sync across navigation', async () => {
  const images = [image, { ...image, caption: 'Second' }, { ...image, caption: 'Third' }];
  const el = (await fixture(html`<lr-lightbox .images=${images} open></lr-lightbox>`)) as LyraLightbox;
  await el.updateComplete;
  const liveRegion = el.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement;
  expect(liveRegion.textContent).to.equal('Image 1 of 3');

  el.next();
  await el.updateComplete;
  expect(liveRegion.textContent).to.equal('Image 2 of 3');

  el.open = false;
});

it('does not trigger a Lit "scheduled an update after an update completed" dev warning when index/images change while open', async () => {
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  globalWarnings?.forEach((warning) => {
    if (warning.includes('scheduled an update')) globalWarnings.delete(warning);
  });
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    const images = [image, { ...image, caption: 'Second' }, { ...image, caption: 'Third' }];
    const el = (await fixture(html`<lr-lightbox .images=${images} open></lr-lightbox>`)) as LyraLightbox;
    await el.updateComplete;
    el.next();
    await el.updateComplete;
    el.previous();
    await el.updateComplete;
    el.images = [...images, { ...image, caption: 'Fourth' }];
    await el.updateComplete;
    el.open = false;
    await el.updateComplete;
  } finally {
    console.warn = originalWarn;
  }
  expect(calls.flat().map(String).some((message) => message.includes('scheduled an update'))).to.be.false;
});
