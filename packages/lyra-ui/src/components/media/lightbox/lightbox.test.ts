import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { render, type PropertyValues } from 'lit';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import './lightbox.js';
import { expectFocusReturnsToReshownOpener } from '../../../../test/hidden-opener.js';
import type { LyraLightbox, LyraLightboxImage } from './lightbox.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import {
  captureDeprecationWarnings,
  type DeprecatedUsage,
} from '../../../../test/expected-deprecations.js';

// Registers the real 'ar' catalog so the lang="ar-EG" counter/live-region digit-formatting test
// below resolves every key it incidentally touches (lightboxImagePosition, lightboxLabel, close,
// previous, next, zoom controls, ...) instead of tripping the partial-catalog fallback warning.
// 'ar-EG' chains down to the registered base 'ar'.
import '../../../translations/ar.js';

const image = {
  src: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"%3E%3Crect width="8" height="8" fill="%230969da"/%3E%3C/svg%3E',
  alt: 'Blue square',
  caption: 'A blue square',
};

function sizedImage(width: number, height: number, color: string, alt: string): LyraLightboxImage {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${color}"/></svg>`;
  return {
    src: `data:image/svg+xml,${encodeURIComponent(svg)}`,
    alt,
  };
}

async function waitForImage(
  frame: HTMLElement,
  width: number,
  height: number,
): Promise<HTMLImageElement> {
  let imageEl: HTMLImageElement | null = null;
  await waitUntil(() => {
    imageEl = frame.shadowRoot?.querySelector('img') ?? null;
    return imageEl?.complete === true && imageEl.naturalWidth === width && imageEl.naturalHeight === height;
  }, `the ${width}x${height} image did not load`);
  return imageEl!;
}

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

it('fits landscape and tall images on open and navigation at narrow allocations', async () => {
  const landscape = sizedImage(720, 360, '#0969da', 'Landscape');
  const tall = sizedImage(360, 720, '#cf222e', 'Tall');

  for (const width of [320, 375]) {
    const el = (await fixture(html`
      <lr-lightbox
        fit="contain"
        open
        .images=${[landscape, tall, landscape]}
        style=${`position: static; inset: auto; inline-size: ${width}px; block-size: 320px;`}
      ></lr-lightbox>
    `)) as LyraLightbox;
    await el.updateComplete;

    const frame = el.shadowRoot!.querySelector('lr-pan-zoom') as HTMLElement & {
      zoom: number;
      fit: string;
      updateComplete: Promise<boolean>;
    };
    const viewport = frame.shadowRoot!.querySelector('[part="viewport"]') as HTMLElement;
    const assertFits = async (expectedWidth: number, expectedHeight: number): Promise<void> => {
      await frame.updateComplete;
      const imageEl = await waitForImage(frame, expectedWidth, expectedHeight);
      const imageBounds = imageEl.getBoundingClientRect();
      expect(imageBounds.width, `${width}px ${expectedWidth}x${expectedHeight} inline fit`).to.be.at.most(
        viewport.clientWidth + 2,
      );
      expect(imageBounds.height, `${width}px ${expectedWidth}x${expectedHeight} block fit`).to.be.at.most(
        viewport.clientHeight + 2,
      );
      expect(frame.fit).to.equal('contain');
    };

    await assertFits(720, 360);
    frame.zoom = 2;
    await frame.updateComplete;
    const zoomBeforeResize = frame.zoom;
    el.style.inlineSize = `${width === 320 ? 375 : 320}px`;
    await waitUntil(() => frame.getBoundingClientRect().width > 0);
    expect(frame.zoom).to.equal(zoomBeforeResize);

    el.next();
    await el.updateComplete;
    await assertFits(360, 720);
    expect(frame.zoom).to.equal(1);

    el.goTo(2);
    await el.updateComplete;
    await assertFits(720, 360);

    el.previous();
    await el.updateComplete;
    await assertFits(360, 720);
    el.open = false;
  }
});

it('keeps the existing actual-size default and normalizes an invalid fit', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  const frame = el.shadowRoot!.querySelector('lr-pan-zoom') as HTMLElement & { fit: string };
  expect(el.fit).to.equal('actual');
  expect(frame.fit).to.equal('actual');

  el.fit = 'invalid' as never;
  await el.updateComplete;
  expect(el.fit).to.equal('actual');
  expect(frame.fit).to.equal('actual');

  el.fit = 'width';
  await el.updateComplete;
  expect(frame.fit).to.equal('width');
  el.open = false;
});

it('never shows a horizontal scrollbar on the caption, only a vertical one when content overflows', async () => {
  const longCaption = Array.from({ length: 40 }, (_, i) => `word${i}`).join(' ');
  const el = (await fixture(html`
    <lr-lightbox .images=${[{ ...image, caption: longCaption }]}></lr-lightbox>
  `)) as LyraLightbox;
  el.open = true;
  await el.updateComplete;
  const caption = el.shadowRoot!.querySelector('[part="caption"]') as HTMLElement;
  expect(getComputedStyle(caption).overflowX).to.not.equal('auto');
  expect(getComputedStyle(caption).overflowX).to.not.equal('scroll');
  expect(caption.scrollWidth).to.be.at.most(caption.clientWidth);
  el.open = false;
});

it('owns a bounded immutable image snapshot and skips malformed or hostile records', async () => {
  const authored = { ...image };
  const input = [authored];
  const el = (await fixture(html`<lr-lightbox></lr-lightbox>`)) as LyraLightbox;

  el.images = input;
  authored.caption = 'Mutated after assignment';
  input.push({ ...image, caption: 'Late alias' });
  await el.updateComplete;

  expect(el.images.length).to.equal(1);
  expect(el.images[0]?.caption).to.equal('A blue square');
  expect(Object.isFrozen(el.images)).to.equal(true);
  expect(Object.isFrozen(el.images[0])).to.equal(true);

  const hostile = Object.defineProperty({}, 'src', {
    get(): never { throw new Error('hostile src'); },
  });
  el.images = [
    hostile as LyraLightboxImage,
    { src: image.src, alt: 42 as unknown as string, caption: 'Retained valid field' },
  ];
  await el.updateComplete;
  expect(el.images.length).to.equal(1);
  expect(el.images[0]?.alt).to.equal(undefined);
  expect(el.images[0]?.caption).to.equal('Retained valid field');

  el.images = Array.from({ length: 10_005 }, (_, index) => ({ src: `${image.src}#${index}` }));
  await el.updateComplete;
  expect(el.images.length).to.equal(10_000);
});

it('runs one promise-based show/hide lifecycle in order and keeps vetoed state reflected', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]}></lr-lightbox>`)) as LyraLightbox;
  const lifecycle: string[] = [];
  const phaseDetails: unknown[] = [];
  let hideSource: Element | undefined;
  el.addEventListener('lr-show', (event) => {
    lifecycle.push('show');
    phaseDetails.push((event as CustomEvent).detail);
  });
  el.addEventListener('lr-after-show', (event) => {
    lifecycle.push('after-show');
    phaseDetails.push((event as CustomEvent).detail);
  });
  el.addEventListener('lr-hide', (event) => {
    lifecycle.push('hide');
    hideSource = (event as CustomEvent<{ source: Element }>).detail.source;
  });
  el.addEventListener('lr-close', () => lifecycle.push('close'));
  el.addEventListener('lr-after-hide', (event) => {
    lifecycle.push('after-hide');
    phaseDetails.push((event as CustomEvent).detail);
  });

  await el.show();
  expect(el.open).to.be.true;
  expect(el.hasAttribute('open')).to.be.true;
  expect(lifecycle).to.deep.equal(['show', 'after-show']);

  await el.hide();
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;
  expect(hideSource === el).to.be.true;
  expect(lifecycle).to.deep.equal(['show', 'after-show', 'hide', 'close', 'after-hide']);
  expect(phaseDetails).to.deep.equal([null, null, null]);

  const vetoShow = (event: Event): void => event.preventDefault();
  el.addEventListener('lr-show', vetoShow, { once: true });
  await el.show();
  expect(el.open).to.be.false;
  expect(el.hasAttribute('open')).to.be.false;

  await el.show();
  const vetoHide = (event: Event): void => event.preventDefault();
  el.addEventListener('lr-hide', vetoHide, { once: true });
  await el.hide();
  expect(el.open).to.be.true;
  expect(el.hasAttribute('open')).to.be.true;
  el.removeEventListener('lr-hide', vetoHide);
  el.open = false;
  await el.updateComplete;
});

it('routes post-render open writes through the lifecycle but treats initial open state as silent', async () => {
  const initial = document.createElement('lr-lightbox') as LyraLightbox;
  let initialShows = 0;
  initial.addEventListener('lr-show', () => initialShows++);
  initial.open = true;
  document.body.append(initial);
  await initial.updateComplete;
  expect(initialShows).to.equal(0);
  initial.remove();

  const el = (await fixture(html`<lr-lightbox .images=${[image]}></lr-lightbox>`)) as LyraLightbox;
  const lifecycle: string[] = [];
  el.addEventListener('lr-show', () => lifecycle.push('show'));
  el.addEventListener('lr-after-show', () => lifecycle.push('after-show'));
  el.addEventListener('lr-hide', () => lifecycle.push('hide'));
  el.addEventListener('lr-close', () => lifecycle.push('close'));
  el.addEventListener('lr-after-hide', () => lifecycle.push('after-hide'));

  el.open = true;
  await el.updateComplete;
  await Promise.resolve();
  el.open = false;
  await el.updateComplete;
  await Promise.resolve();

  expect(lifecycle).to.deep.equal(['show', 'after-show', 'hide', 'close', 'after-hide']);
});

it('is accessible while open', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  await expect(el).to.be.accessible();
  el.open = false;
});

it('inherits a 20px host font into the close and navigation controls and their one-em glyphs', async () => {
  const el = (await fixture(html`
    <lr-lightbox
      open
      loop
      style="font: 20px/1 monospace"
      .images=${[image, { ...image, caption: 'Second' }]}
    ></lr-lightbox>
  `)) as LyraLightbox;
  await el.updateComplete;

  expect(getComputedStyle(el).fontSize).to.equal('20px');
  for (const part of ['close-button', 'previous-button', 'next-button'] as const) {
    const control = el.shadowRoot!.querySelector<HTMLElement>(`[part="${part}"]`)!;
    const glyph = control.querySelector<SVGElement>('svg')!;

    expect(getComputedStyle(control).fontSize, `${part} font size`).to.equal('20px');
    expect(getComputedStyle(control).fontFamily, `${part} font family`).to.equal(
      getComputedStyle(el).fontFamily,
    );
    expect(getComputedStyle(glyph).width, `${part} one-em glyph width`).to.equal('20px');
    expect(getComputedStyle(glyph).height, `${part} one-em glyph height`).to.equal('20px');
  }

  el.open = false;
});

it('closes on Escape and emits lr-close with the escape reason', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  let detail: unknown;
  el.addEventListener('lr-close', (e) => (detail = (e as CustomEvent<{ reason: string }>).detail.reason));

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(detail).to.equal('escape');
});

it('does not respond to Escape while closed', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]}></lr-lightbox>`)) as LyraLightbox;
  let fired = false;
  el.addEventListener('lr-close', () => (fired = true));

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(fired).to.be.false;
});

it('closes on backdrop click and emits lr-close with the backdrop reason when light-dismiss is set', async () => {
  const el = (await fixture(
    html`<lr-lightbox .images=${[image]} open light-dismiss></lr-lightbox>`,
  )) as LyraLightbox;
  let detail: unknown;
  el.addEventListener('lr-close', (e) => (detail = (e as CustomEvent<{ reason: string }>).detail.reason));

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

it('closes via the close button and emits lr-close with the close-button reason', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  let detail: unknown;
  el.addEventListener('lr-close', (e) => (detail = (e as CustomEvent<{ reason: string }>).detail.reason));

  (el.shadowRoot!.querySelector('[part="close-button"]') as HTMLElement).click();
  await el.updateComplete;

  expect(el.open).to.be.false;
  expect(detail).to.equal('close-button');
});

it('stays open when an lr-close-request listener calls preventDefault()', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  el.addEventListener('lr-close-request', (e) => e.preventDefault());

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await el.updateComplete;

  expect(el.open).to.be.true;
  el.open = false;
});

it('emits non-cancelable lr-hide and lr-close with the unmount reason when removed while open', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  let detail: unknown;
  let hideCancelable: boolean | undefined;
  let hideSourceIsHost = false;
  el.addEventListener('lr-hide', (event) => {
    hideCancelable = event.cancelable;
    hideSourceIsHost = (event as CustomEvent<{ source: Element }>).detail.source === el;
    event.preventDefault();
  });
  el.addEventListener('lr-close', (e) => (detail = (e as CustomEvent<{ reason: string }>).detail.reason));

  el.remove();
  await Promise.resolve();
  await Promise.resolve();

  expect(hideCancelable).to.equal(false);
  expect(hideSourceIsHost).to.equal(true);
  expect(detail).to.equal('unmount');
  expect(el.open).to.equal(false);
});

it('does not treat a synchronous reparent as an unmount', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  let fired = false;
  el.addEventListener('lr-close', () => (fired = true));

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
    el.addEventListener('lr-close', (event) => {
      if ((event as CustomEvent<{ reason: string }>).detail.reason === 'unmount') unmounted = true;
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

it('leaves Arrow/Home/End with the focused pan-zoom viewport while panel chrome owns gallery navigation', async () => {
  const images = [image, { ...image, caption: 'Second' }];
  for (const direction of ['ltr', 'rtl'] as const) {
    const el = (await fixture(
      html`<lr-lightbox dir=${direction} .images=${images} open></lr-lightbox>`,
    )) as LyraLightbox;
    const panel = el.shadowRoot!.querySelector('[part="panel"]') as HTMLElement;
    const frame = el.shadowRoot!.querySelector('lr-pan-zoom') as HTMLElement & {
      shadowRoot: ShadowRoot;
      zoom: number;
      updateComplete: Promise<boolean>;
    };
    const viewport = frame.shadowRoot.querySelector('[part="viewport"]') as HTMLElement;
    const forward = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';

    frame.zoom = 2;
    await frame.updateComplete;
    viewport.focus();
    expect(frame.shadowRoot.activeElement === viewport, `${direction}: the real scroll owner is focused`).to.be.true;
    for (const key of [forward, 'Home', 'End']) {
      const event = new KeyboardEvent('keydown', {
        key,
        bubbles: true,
        composed: true,
        cancelable: true,
      });
      viewport.dispatchEvent(event);
      await el.updateComplete;
      expect(el.index, `${direction}: ${key} remains owned by the viewport`).to.equal(0);
      expect(event.defaultPrevented, `${direction}: lightbox does not consume ${key}`).to.be.false;
    }

    const closeButton = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
    closeButton.focus();
    const chromeKey = new KeyboardEvent('keydown', {
      key: forward,
      bubbles: true,
      composed: true,
      cancelable: true,
    });
    closeButton.dispatchEvent(chromeKey);
    await el.updateComplete;
    expect(el.index, `${direction}: panel chrome keeps gallery shortcuts`).to.equal(1);
    expect(chromeKey.defaultPrevented).to.be.true;

    el.index = 0;
    await el.updateComplete;
    const panelKey = new KeyboardEvent('keydown', { key: forward, cancelable: true });
    panel.dispatchEvent(panelKey);
    await el.updateComplete;
    expect(el.index, `${direction}: the panel itself keeps gallery shortcuts`).to.equal(1);
    expect(panelKey.defaultPrevented).to.be.true;
    el.open = false;
    await el.updateComplete;
  }
});

it('contains synthetic child focus aliases while deliberately allowing zoom changes through', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]} open></lr-lightbox>`)) as LyraLightbox;
  const frame = el.shadowRoot!.querySelector('lr-pan-zoom') as HTMLElement & {
    focus(): void;
    blur(): void;
    zoomIn(): void;
  };
  const escaped: string[] = [];
  for (const type of ['focus', 'blur', 'lr-focus', 'lr-blur']) {
    el.addEventListener(type, () => escaped.push(type));
  }
  let zoomChanges = 0;
  el.addEventListener('lr-zoom-change', () => zoomChanges++);

  frame.focus();
  frame.blur();
  frame.zoomIn();
  await el.updateComplete;

  expect(escaped).to.deep.equal([]);
  expect(zoomChanges).to.equal(1);
  el.open = false;
  await el.updateComplete;
});

it('forwards collision-resistant frame parts to outer consumers', async () => {
  const wrapper = await fixture(html`
    <div>
      <style>
        lr-lightbox.forwarded-frame-test::part(frame-viewport) {
          outline: 3px dashed rgb(1, 2, 3);
        }
      </style>
      <lr-lightbox class="forwarded-frame-test" .images=${[image]} open></lr-lightbox>
    </div>
  `);
  const el = wrapper.querySelector('lr-lightbox') as LyraLightbox;
  const frame = el.shadowRoot!.querySelector('lr-pan-zoom') as HTMLElement & { shadowRoot: ShadowRoot };
  const viewport = frame.shadowRoot.querySelector('[part="viewport"]') as HTMLElement;

  expect(frame.getAttribute('exportparts')).to.equal(
    'viewport:frame-viewport,content:frame-content,controls:frame-controls',
  );
  expect(getComputedStyle(viewport).outlineStyle).to.equal('dashed');
  expect(getComputedStyle(viewport).outlineWidth).to.equal('3px');
  el.open = false;
  await el.updateComplete;
});

it('seeds a populated actions slot before first render and preserves the projected node', async () => {
  const el = document.createElement('lr-lightbox') as LyraLightbox;
  const action = document.createElement('button');
  action.slot = 'actions';
  action.textContent = 'Download';
  el.append(action);
  document.body.append(el);
  try {
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
    const slot = wrapper.querySelector('slot') as HTMLSlotElement;
    expect(wrapper.hidden, 'populated first output is not serialized as empty chrome').to.be.false;
    expect(slot.assignedElements()[0] === action, 'the original projected node is retained').to.be.true;

    el.requestUpdate();
    await el.updateComplete;
    expect(slot.assignedElements()[0] === action, 'a follow-up render reuses the node').to.be.true;
  } finally {
    el.remove();
  }
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

it('caps a long caption instead of letting it starve the stage', async () => {
  const longCaption = 'word '.repeat(200).trim();
  const el = (await fixture(html`
    <lr-lightbox
      open
      style="position: static; inset: auto; inline-size: 320px; block-size: 500px;"
      .images=${[{ src: image.src, alt: image.alt, caption: longCaption }]}
    ></lr-lightbox>
  `)) as LyraLightbox;
  await el.updateComplete;

  const caption = el.shadowRoot!.querySelector('[part="caption"]') as HTMLElement;
  const captionBox = caption.getBoundingClientRect();
  const stageBox = el.shadowRoot!
    .querySelector('[part="stage"]')!
    .getBoundingClientRect();

  expect(
    captionBox.height,
    'the caption is capped, not floored at its full many-line content height'
  ).to.be.lessThan(150);
  expect(
    stageBox.height,
    'the stage keeps a usable amount of the host height'
  ).to.be.greaterThan(100);
  expect(caption.scrollHeight).to.be.greaterThan(caption.clientHeight);
  expect(caption.getAttribute('tabindex')).to.equal('0');
  await expect(el).to.be.accessible();
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

it('announces each navigation once while a parent re-renders the same images and mirrors the index', async () => {
  const images = [image, { ...image, caption: 'Second' }, { ...image, caption: 'Third' }];
  const mount = await fixture<HTMLElement>(html`<div></div>`);
  let index = 0;
  const view = () => html`<lr-lightbox .images=${images} .index=${index} open
    @lr-index-change=${(event: CustomEvent<{ index: number }>) => {
      index = event.detail.index;
      render(view(), mount);
    }}></lr-lightbox>`;
  render(view(), mount);
  const el = mount.querySelector('lr-lightbox') as LyraLightbox;
  await el.updateComplete;
  const sink = document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;
  const before = sink.childElementCount;
  el.next();
  await el.updateComplete;
  render(view(), mount);
  await el.updateComplete;
  expect(Array.from(sink.children, (child) => child.textContent).slice(before)).to.deep.equal(['Image 2 of 3']);
  el.open = false;
});

it('emits lr-index-change when a shrinking images moves the shown image, not for index writes', async () => {
  const images = [image, { ...image, caption: 'Second' }, { ...image, caption: 'Third' }];
  const el = (await fixture(html`<lr-lightbox .images=${images} index="2"></lr-lightbox>`)) as LyraLightbox;
  const changes: number[] = [];
  el.addEventListener('lr-index-change', (event) => changes.push((event as CustomEvent<{ index: number }>).detail.index));
  el.images = images.slice(0, 2);
  await el.updateComplete;
  expect(el.index).to.equal(1);
  el.index = 9;
  await el.updateComplete;
  expect(el.index).to.equal(1);
  expect(changes).to.deep.equal([1]);
});

it('declares next/previous/goTo as methods', () => {
  for (const name of ['next', 'previous', 'goTo']) {
    expect(typeof (customElements.get('lr-lightbox')!.prototype as Record<string, unknown>)[name]).to.equal('function');
  }
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

it('wraps a long slotted action without overflowing a 320px toolbar or clipping the close target in LTR or RTL', async () => {
  const longAction = `action-${'unbroken'.repeat(48)}`;

  for (const direction of ['ltr', 'rtl'] as const) {
    const el = (await fixture(html`
      <lr-lightbox
        dir=${direction}
        .images=${[image]}
        open
        style="position: static; inset: auto; display: flex; inline-size: 320px; block-size: 24rem;"
      >
        <button slot="actions">${longAction}</button>
      </lr-lightbox>
    `)) as LyraLightbox;
    await el.updateComplete;

    const toolbar = el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
    const actions = el.shadowRoot!.querySelector('[part="actions"]') as HTMLElement;
    const closeButton = el.shadowRoot!.querySelector('[part="close-button"]') as HTMLButtonElement;
    const action = el.querySelector('button[slot="actions"]') as HTMLButtonElement;
    const toolbarRect = toolbar.getBoundingClientRect();
    const closeRect = closeButton.getBoundingClientRect();
    const iconButtonSize = Number.parseFloat(getComputedStyle(closeButton).minInlineSize);

    expect(toolbar.scrollWidth, `${direction}: toolbar has no horizontal overflow`).to.be.at.most(toolbar.clientWidth + 1);
    expect(actions.scrollWidth, `${direction}: slotted actions have no horizontal overflow`).to.be.at.most(actions.clientWidth + 1);
    expect(action.scrollWidth, `${direction}: long action text wraps`).to.be.at.most(action.clientWidth + 1);
    expect(closeRect.width, `${direction}: close control retains its minimum hit width`).to.be.at.least(iconButtonSize);
    expect(closeRect.height, `${direction}: close control retains its minimum hit height`).to.be.at.least(iconButtonSize);
    expect(closeRect.left, `${direction}: close control stays inside the toolbar`).to.be.at.least(toolbarRect.left - 1);
    expect(closeRect.right, `${direction}: close control stays inside the toolbar`).to.be.at.most(toolbarRect.right + 1);

    el.open = false;
    await el.updateComplete;
  }
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

// `without-counter` hides only the visible counter. `show-counter` is its deprecated inverted
// alias; it keeps working, including the plain-HTML `show-counter="false"` spelling that Lit's
// presence-based boolean converter could never express, until its removal.
describe('withoutCounter visibility', () => {
  const SHOW_COUNTER: readonly DeprecatedUsage[] = [
    { tag: 'lr-lightbox', kind: 'property', name: 'showCounter' },
  ];
  const twoImages = [image, { ...image, caption: 'Second' }];
  const counters = (el: LyraLightbox): number =>
    el.shadowRoot!.querySelectorAll('[part="counter"]').length;
  const liveText = (el: LyraLightbox): string | null =>
    el.shadowRoot!.querySelector('[part="live-region"]')!.textContent;

  it('renders the counter by default, without a warning', async () => {
    const warnings = await captureDeprecationWarnings(SHOW_COUNTER, async () => {
      const el = (await fixture(html`<lr-lightbox .images=${twoImages} open></lr-lightbox>`)) as LyraLightbox;
      expect(el.withoutCounter).to.be.false;
      expect(counters(el)).to.equal(1);
      el.open = false;
    });
    expect(warnings).to.have.length(0);
  });

  it('without-counter hides only the visible counter', async () => {
    const el = (await fixture(
      html`<lr-lightbox without-counter open .images=${twoImages}></lr-lightbox>`,
    )) as LyraLightbox;
    await el.updateComplete;
    expect(el.withoutCounter).to.be.true;
    expect(counters(el)).to.equal(0);
    expect(liveText(el)).to.equal('Image 1 of 2');
    el.open = false;
  });

  // Neither spelling reflects: nothing styles or queries them, so no attribute is ever written
  // back from a property assignment.

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

describe('consumer hover part overrides', () => {
  it('applies consumer hover colors to the rendered close and navigation buttons', async function () {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
    const style = document.createElement('style');
    style.textContent = `
      lr-lightbox::part(close-button):hover,
      lr-lightbox::part(previous-button):hover,
      lr-lightbox::part(next-button):hover { color: rgb(1, 2, 3); }
    `;
    document.head.append(style);
    try {
      const el = (await fixture(html`
        <lr-lightbox open loop .images=${[image, { ...image, caption: 'Second' }]}></lr-lightbox>
      `)) as LyraLightbox;
      await resetMouse();
      for (const part of ['close-button', 'previous-button', 'next-button']) {
        const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLButtonElement;
        const bounds = button.getBoundingClientRect();
        await sendMouse({
          type: 'move',
          position: [
            Math.round(bounds.left + bounds.width / 2),
            Math.round(bounds.top + bounds.height / 2),
          ],
        });
        await waitUntil(
          () => getComputedStyle(button).color === 'rgb(1, 2, 3)',
          `the consumer hover color never reached the rendered ${part}`,
        );
      }
    } finally {
      await resetMouse();
      style.remove();
    }
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

it('emits the canonical request before the settled close notification and ignores the retired alias', async () => {
  const el = await fixture<LyraLightbox>(html`<lr-lightbox open .images=${[image]}></lr-lightbox>`);
  const reports: Array<{ type: string; detail: unknown; open: boolean; cancelable: boolean }> = [];
  for (const name of ['lr-close-request', 'lr-lightbox-close', 'lr-close']) {
    el.addEventListener(name, (event: Event) => {
      reports.push({ type: event.type, detail: (event as CustomEvent).detail, open: el.open, cancelable: event.cancelable });
    });
  }
  await el.close('api');
  expect(reports).to.deep.equal([
    { type: 'lr-close-request', detail: { reason: 'api' }, open: true, cancelable: true },
    { type: 'lr-close', detail: { reason: 'api' }, open: false, cancelable: false },
  ]);
});

it('keeps the canonical close veto and emits no compatibility event', async () => {
  const el = await fixture<LyraLightbox>(html`<lr-lightbox open .images=${[image]}></lr-lightbox>`);
  let retired = 0;
  el.addEventListener('lr-lightbox-close', () => retired++);
  el.addEventListener('lr-close-request', (event) => event.preventDefault());
  await el.close('api');
  expect(el.open).to.equal(true);
  expect(retired).to.equal(0);
});


it('returns focus to an opener the host re-shows only after lr-close', async () => {
  const el = (await fixture(html`<lr-lightbox .images=${[image]}></lr-lightbox>`)) as LyraLightbox;
  await expectFocusReturnsToReshownOpener({
    host: el,
    closeEvent: 'lr-close',
    open: async () => {
      await el.show();
    },
    close: async () => {
      await el.close('api');
    },
  });
});
