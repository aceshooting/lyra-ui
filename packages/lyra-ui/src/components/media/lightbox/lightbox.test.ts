import { expect, fixture, html } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './lightbox.js';
import type { LyraLightbox } from './lightbox.js';
import { LyraElement } from '../../../internal/lyra-element.js';

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

it('renders a .strings override for the close/previous/next labels and the counter/live-region position text', async () => {
  const images = [image, { ...image, caption: 'Second' }];
  const el = (await fixture(html`
    <lr-lightbox
      .images=${images}
      open
      .strings=${{
        close: 'Fermer',
        previous: 'Précédent',
        next: 'Suivant',
        lightboxImagePosition: 'Image {index} sur {total}',
      }}
    ></lr-lightbox>
  `)) as LyraLightbox;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="close-button"]')!.getAttribute('aria-label')).to.equal('Fermer');
  expect(el.shadowRoot!.querySelector('[part="previous-button"]')!.getAttribute('aria-label')).to.equal('Précédent');
  expect(el.shadowRoot!.querySelector('[part="next-button"]')!.getAttribute('aria-label')).to.equal('Suivant');
  expect(el.shadowRoot!.querySelector('[part="counter"]')!.textContent).to.equal('Image 1 sur 2');
  expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.equal('Image 1 sur 2');

  el.open = false;
});

// Regression coverage for the lifecycle-super-call-omitted defect class -- no user-visible
// symptom today, but a future shared willUpdate()/updated() behavior on LyraElement (mirroring
// the DocumentAnchorTarget mixin precedent already used elsewhere in this family) would silently
// never run for <lr-lightbox> if its own overrides shadow the base hook instead of calling it.
// The patched flag is scoped to `this === el` specifically -- <lr-lightbox> embeds an
// <lr-zoomable-frame> child in its shadow DOM, which itself extends LyraElement directly with no
// willUpdate/updated override of its own, so an unscoped check would false-positive on the
// child's own inherited call regardless of whether the lightbox's own override calls super.
it('calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
  // Monkey-patch LyraElement.prototype.willUpdate (the established pattern, e.g. checkbox.test.ts)
  // to prove LyraLightbox's own willUpdate() override actually calls super.willUpdate(...)
  // rather than shadowing it silently. Scoped by tagName (not a captured `el` variable) --
  // `fixture()` only resolves once the element's *first* update (and thus its first willUpdate
  // call) has already completed, so a variable assigned from its return value is still
  // undefined at the time that first call fires.
  const proto = LyraElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void };
  const original = proto.willUpdate;
  let calledOnSelf = false;
  proto.willUpdate = function (this: LyraElement, changed: PropertyValues): void {
    if (this.tagName === 'LR-LIGHTBOX') calledOnSelf = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-lightbox .images=${[image]}></lr-lightbox>`)) as LyraLightbox;
    await el.updateComplete;
    expect(calledOnSelf).to.be.true;
  } finally {
    proto.willUpdate = original;
  }
});

it('calls super.updated so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
  const proto = LyraElement.prototype as unknown as { updated: (changed: PropertyValues) => void };
  const original = proto.updated;
  let calledOnSelf = false;
  proto.updated = function (this: LyraElement, changed: PropertyValues): void {
    if (this.tagName === 'LR-LIGHTBOX') calledOnSelf = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-lightbox .images=${[image]}></lr-lightbox>`)) as LyraLightbox;
    await el.updateComplete;
    expect(calledOnSelf).to.be.true;
  } finally {
    proto.updated = original;
  }
});

// Regression coverage for the api-surface-true-default-boolean-attribute defect class -- Lit's
// default presence-based `type: Boolean` converter can never clear a `true`-defaulting property
// from a plain-HTML attribute (`show-counter="false"` still counts as "present"), so showCounter
// needs a custom converter that checks the literal string, matching every other `show*`
// true-defaulting boolean in this library (e.g. <lr-generation-status>'s showStop).
describe('showCounter', () => {
  it('defaults to true and renders the counter', async () => {
    const el = (await fixture(html`<lr-lightbox .images=${[image, { ...image, caption: 'Second' }]} open></lr-lightbox>`)) as LyraLightbox;
    expect(el.showCounter).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part="counter"]').length).to.equal(1);
    el.open = false;
  });

  it('a plain HTML show-counter="false" attribute (no property binding) actually clears it', async () => {
    const el = (await fixture(
      html`<lr-lightbox show-counter="false" open .images=${[image, { ...image, caption: 'Second' }]}></lr-lightbox>`,
    )) as LyraLightbox;
    await el.updateComplete;
    expect(el.showCounter).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="counter"]')).to.equal(null);
    el.open = false;
  });

  it('a .showCounter=${false} property binding also clears it', async () => {
    const el = (await fixture(
      html`<lr-lightbox .images=${[image, { ...image, caption: 'Second' }]} open .showCounter=${false}></lr-lightbox>`,
    )) as LyraLightbox;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="counter"]')).to.equal(null);
    el.open = false;
  });
});

// Regression coverage for the shadow-part-selector-specificity defect class -- a consumer's
// `::part(close-button):hover` / `::part(previous-button):hover` / `::part(next-button):hover`
// override must be able to win without `!important`. jsdom/browser test runners don't synthesize
// a real :hover pseudo-class from a dispatched event, so assert via the internal rule's computed
// specificity instead, mirroring lr-attachment-trigger's identical `:where()`-wrapped fix.
describe('close/previous/next-button hover specificity', () => {
  it('the internal hover rules are :where()-wrapped so a ::part(x):hover override wins without !important', async () => {
    const el = (await fixture(html`<lr-lightbox .images=${[image, { ...image, caption: 'Second' }]}></lr-lightbox>`)) as LyraLightbox;
    const internalRule = (el.shadowRoot!.adoptedStyleSheets ?? [])
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .map((rule) => rule.cssText)
      .find((text) => text.includes(':hover') && text.includes('close-button'));
    expect(internalRule, 'expected an internal close-button :hover rule to exist').to.be.a('string');
    expect(internalRule!.includes(':where(')).to.be.true;
  });
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
