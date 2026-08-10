import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
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
  expect(el.shadowRoot!.querySelector('[part="frame"]') !== null).to.be.true;
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

it('closes on backdrop click and emits lr-lightbox-close with reason "backdrop" when light-dismiss is set', async () => {
  const el = (await fixture(
    html`<lr-lightbox .images=${[image]} open light-dismiss></lr-lightbox>`,
  )) as LyraLightbox;
  let detail: unknown;
  el.addEventListener('lr-lightbox-close', (e) => (detail = (e as CustomEvent).detail));

  (el.shadowRoot!.querySelector('[part="backdrop"]') as HTMLElement).click();
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(detail).to.equal('backdrop');
});

// Opt-in, mirroring `<lr-dialog>`'s `lightDismiss`, which in turn matches `wa-dialog`.
it('ignores a backdrop click by default', async () => {
  const el = (await fixture(
    html`<lr-lightbox .images=${[image]} open></lr-lightbox>`,
  )) as LyraLightbox;

  expect(el.lightDismiss).to.equal(false);
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
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;
  expect(sink !== null, 'reparenting reacquires a sink in the connected document').to.be.true;
  expect(sink.childElementCount, 'reparenting does not replay the current image').to.equal(0);
  destination.remove();
});

it('schedules reconnect focus in the adopted owner realm and ignores a stale callback after re-adoption', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('Could not create an iframe realm for the lightbox lifecycle test.');
  }
  const scheduled: VoidFunction[] = [];
  const originalQueueMicrotask = frameWindow.queueMicrotask;
  frameWindow.queueMicrotask = (callback: VoidFunction) => {
    scheduled.push(callback);
  };
  const el = (await fixture(html`<lr-lightbox .images=${[image]}></lr-lightbox>`)) as LyraLightbox;
  await el.updateComplete;
  el.remove();
  frameDocument.adoptNode(el);
  el.open = true;

  try {
    frameDocument.body.append(el);
    expect(scheduled.length, 'the owner window schedules reconnect focus').to.equal(1);
    const reconnectFocus = scheduled.shift()!;
    const overlay = (el as unknown as {
      overlay: { focusInitial(): void };
    }).overlay;
    let focusCalls = 0;
    overlay.focusInitial = () => {
      focusCalls += 1;
    };

    el.remove();
    document.adoptNode(el);
    document.body.append(el);
    reconnectFocus();

    expect(focusCalls, 'the old-realm callback cannot focus the new connection').to.equal(0);
  } finally {
    el.open = false;
    await el.updateComplete;
    frameWindow.queueMicrotask = originalQueueMicrotask;
    iframe.remove();
    el.remove();
  }
});

it('schedules lasting-disconnect cleanup in the owner realm and ignores it after ownership changes', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('Could not create an iframe realm for the lightbox lifecycle test.');
  }
  const scheduled: VoidFunction[] = [];
  const originalQueueMicrotask = frameWindow.queueMicrotask;
  frameWindow.queueMicrotask = (callback: VoidFunction) => {
    scheduled.push(callback);
  };
  const el = (await fixture(html`<lr-lightbox .images=${[image]}></lr-lightbox>`)) as LyraLightbox;
  await el.updateComplete;
  el.remove();
  frameDocument.adoptNode(el);
  el.open = true;
  frameDocument.body.append(el);

  try {
    scheduled.shift()?.();
    await el.updateComplete;
    scheduled.length = 0;
    let unmounted = false;
    el.addEventListener('lr-lightbox-close', (event) => {
      if ((event as CustomEvent).detail === 'unmount') unmounted = true;
    });

    el.remove();
    expect(scheduled.length, 'the owner window schedules disconnect cleanup').to.equal(1);
    const disconnectCleanup = scheduled.shift()!;
    document.adoptNode(el);
    disconnectCleanup();

    expect(el.open, 'an old-document callback cannot close an adopted instance').to.be.true;
    expect(unmounted).to.be.false;
  } finally {
    el.open = false;
    await el.updateComplete;
    frameWindow.queueMicrotask = originalQueueMicrotask;
    iframe.remove();
    el.remove();
  }
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

it('announces navigation through light DOM and keeps an aria-hidden part mirror in sync', async () => {
  const images = [image, { ...image, caption: 'Second' }, { ...image, caption: 'Third' }];
  const el = (await fixture(html`<lr-lightbox .images=${images} open></lr-lightbox>`)) as LyraLightbox;
  await el.updateComplete;
  const liveRegion = el.shadowRoot!.querySelector('[part="live-region"]') as HTMLElement;
  expect(liveRegion.textContent).to.equal('Image 1 of 3');
  expect(liveRegion.getAttribute('aria-hidden')).to.equal('true');
  expect(liveRegion.hasAttribute('role')).to.be.false;
  expect(liveRegion.hasAttribute('aria-live')).to.be.false;
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  )!;
  expect(sink !== null, 'the sink is mounted before navigation').to.be.true;
  expect(sink.childElementCount, 'initial open state stays silent').to.equal(0);

  el.next();
  await el.updateComplete;
  expect(liveRegion.textContent).to.equal('Image 2 of 3');
  expect(Array.from(sink.children, (child) => child.textContent)).to.deep.equal(['Image 2 of 3']);

  el.open = false;
});

it('keeps consumer-driven index announcements silent when the host or a composed ancestor is accessibility-excluded', async () => {
  const scenarios: Array<{
    label: string;
    exclude(host: LyraLightbox, ancestor: HTMLElement): void;
  }> = [
    {
      label: 'hidden host',
      exclude: (host) => {
        host.hidden = true;
      },
    },
    {
      label: 'visibility-hidden composed ancestor',
      exclude: (_host, ancestor) => {
        ancestor.style.visibility = 'hidden';
      },
    },
    {
      label: 'visibility-collapse composed ancestor',
      exclude: (_host, ancestor) => {
        ancestor.style.visibility = 'collapse';
      },
    },
    {
      label: 'content-visibility-hidden composed ancestor',
      exclude: (_host, ancestor) => {
        ancestor.style.contentVisibility = 'hidden';
      },
    },
  ];
  const images = [image, { ...image, caption: 'Second' }];

  for (const scenario of scenarios) {
    const ancestor = document.createElement('div');
    const root = ancestor.attachShadow({ mode: 'open' });
    root.append(document.createElement('slot'));
    const el = document.createElement('lr-lightbox') as LyraLightbox;
    el.images = images;
    el.open = true;
    ancestor.append(el);
    document.body.append(ancestor);

    try {
      await el.updateComplete;
      const sink = document.querySelector<HTMLElement>(
        `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
      )!;
      scenario.exclude(el, ancestor);

      el.index = 1;
      await el.updateComplete;

      expect(sink.childElementCount, scenario.label).to.equal(0);
    } finally {
      el.open = false;
      await el.updateComplete;
      ancestor.remove();
    }
  }
});

it('formats counter and live-region numbers with the effective locale', async () => {
  const images = [image, { ...image, caption: 'Second' }, { ...image, caption: 'Third' }];
  const el = (await fixture(html`<lr-lightbox lang="ar-EG" .images=${images} open></lr-lightbox>`)) as LyraLightbox;
  expect(el.shadowRoot!.querySelector('[part="counter"]')!.textContent).to.contain('١');
  expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.contain('٣');
  el.open = false;
});

it('resets view state when the current image source is replaced at the same index', async () => {
  const images = [image, { ...image, caption: 'Second' }];
  const el = (await fixture(html`<lr-lightbox .images=${images} open></lr-lightbox>`)) as LyraLightbox;
  const frame = el.shadowRoot!.querySelector('lr-pan-zoom') as HTMLElement & {
    resetView(): void;
  };
  let resets = 0;
  frame.resetView = () => resets++;
  el.images = [{ ...image, src: `${image.src}#replacement` }, images[1]!];
  await el.updateComplete;
  expect(resets).to.equal(1);
  el.open = false;
});

it('does not hijack navigation keys from slotted editable actions', async () => {
  const images = [image, { ...image, caption: 'Second' }];
  const el = (await fixture(html`
    <lr-lightbox .images=${images} open>
      <input slot="actions" value="edit me" />
    </lr-lightbox>
  `)) as LyraLightbox;
  const input = el.querySelector('input')!;
  const key = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true });
  input.dispatchEvent(key);
  await el.updateComplete;
  expect(el.index).to.equal(0);
  expect(key.defaultPrevented).to.be.false;
  el.open = false;
});

it('does not hijack navigation keys from iframe-realm slotted controls after adoption', async () => {
  const iframe = document.createElement('iframe');
  document.body.append(iframe);
  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    throw new Error('Could not create an iframe realm for the lightbox test.');
  }
  // Render once in the defining realm so Lit attaches its constructed stylesheets before the
  // normal custom-element adoption lifecycle moves the existing shadow root to another document.
  const el = (await fixture(
    html`<lr-lightbox .images=${[image, { ...image, caption: 'Second' }]}></lr-lightbox>`,
  )) as LyraLightbox;
  el.remove();
  frameDocument.adoptNode(el);
  const input = frameDocument.createElement('input');
  input.slot = 'actions';
  el.append(input);

  try {
    frameDocument.body.append(el);
    await el.updateComplete;
    el.open = true;
    await el.updateComplete;
    const key = new frameWindow.KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      composed: true,
      cancelable: true,
    });

    input.dispatchEvent(key);
    await el.updateComplete;

    expect(input instanceof frameWindow.HTMLElement).to.be.true;
    expect(el.index).to.equal(0);
    expect(key.defaultPrevented).to.be.false;
  } finally {
    el.open = false;
    iframe.remove();
  }
});

it('silently consumes detached navigation whose update flushes after reconnect', async () => {
  const images = [image, { ...image, caption: 'Second' }, { ...image, caption: 'Third' }];
  const el = (await fixture(html`<lr-lightbox .images=${images} open></lr-lightbox>`)) as LyraLightbox;
  await el.updateComplete;
  el.remove();
  el.index = 1;

  try {
    document.body.append(el);
    await el.updateComplete;
    const sink = document.querySelector<HTMLElement>(
      `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
    );
    expect(sink !== null, 'reconnect mounts the owner-document sink').to.be.true;
    expect(sink?.childElementCount, 'a detached index change is only a new baseline').to.equal(0);

    el.index = 2;
    await el.updateComplete;
    expect(Array.from(sink?.children ?? [], (child) => child.textContent)).to.deep.equal([
      'Image 3 of 3',
    ]);
  } finally {
    el.open = false;
    el.remove();
  }
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
// <lr-pan-zoom> child in its shadow DOM, which itself extends LyraElement directly with no
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
    expect(el.shadowRoot!.querySelector('[part="counter"]') === null).to.be.true;
    el.open = false;
  });

  it('a .showCounter=${false} property binding also clears it', async () => {
    const el = (await fixture(
      html`<lr-lightbox .images=${[image, { ...image, caption: 'Second' }]} open .showCounter=${false}></lr-lightbox>`,
    )) as LyraLightbox;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="counter"]') === null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="live-region"]')!.textContent).to.equal('Image 1 of 2');
    el.open = false;
  });
});

it('treats non-finite goTo() indexes as no-ops and emits no terminal index event', async () => {
  const el = (await fixture(html`
    <lr-lightbox .images=${[image, { ...image, caption: 'Second' }]}></lr-lightbox>
  `)) as LyraLightbox;
  let changes = 0;
  el.addEventListener('lr-index-change', () => changes++);

  el.goTo(Number.NaN);
  el.goTo(Number.POSITIVE_INFINITY);
  el.goTo(Number.NEGATIVE_INFINITY);
  await el.updateComplete;

  expect(el.index).to.equal(0);
  expect(changes).to.equal(0);
});

it('normalizes fractional goTo() indexes before emitting, storing, and rendering their destination', async () => {
  const images = [image, { ...image, caption: 'Second' }, { ...image, caption: 'Third' }];
  const el = (await fixture(html`<lr-lightbox .images=${images}></lr-lightbox>`)) as LyraLightbox;

  let changes = 0;
  el.addEventListener('lr-index-change', () => changes++);
  el.goTo(0.4);
  expect(el.index).to.equal(0);
  expect(changes).to.equal(0);

  const clamped = oneEvent(el, 'lr-index-change');
  el.goTo(1.9);
  expect((await clamped as CustomEvent<{ index: number }>).detail.index).to.equal(1);
  expect(el.index).to.equal(1);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="caption"]')!.textContent).to.contain('Second');

  el.loop = true;
  await el.updateComplete;
  const wrapped = oneEvent(el, 'lr-index-change');
  el.goTo(-1.5);
  expect((await wrapped as CustomEvent<{ index: number }>).detail.index).to.equal(2);
  expect(el.index).to.equal(2);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="caption"]')!.textContent).to.contain('Third');
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
