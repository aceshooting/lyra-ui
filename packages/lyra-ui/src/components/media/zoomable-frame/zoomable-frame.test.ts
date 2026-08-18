import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './zoomable-frame.js';
import type { LyraZoomableFrame } from './zoomable-frame.js';
import * as classModule from './zoomable-frame.class.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const INLINE_DOCUMENT = '<!doctype html><html><body><p>Inline preview</p></body></html>';

function frameOf(el: LyraZoomableFrame): HTMLIFrameElement {
  return el.shadowRoot!.querySelector('[part="iframe"]') as HTMLIFrameElement;
}

it('keeps implementation constants and sink-policy helpers private', () => {
  const exportedNames = Object.keys(classModule);
  expect(exportedNames.includes('DEFAULT_ZOOM_LEVELS')).to.be.false;
  expect(exportedNames.includes('DEFAULT_IFRAME_SANDBOX')).to.be.false;
  expect(exportedNames.includes('safeZoomableFrameSrc')).to.be.false;
  expect(exportedNames.includes('safeZoomableFrameSandbox')).to.be.false;
});

async function eventually(condition: () => boolean): Promise<void> {
  // scheduleFrameFocusReconciliation (zoomable-frame.class.ts) defers through a setTimeout(fn, 0)
  // macrotask, which can land well past 0ms once the event loop's macrotask queue is backed up --
  // observed to exceed a 1000ms deadline deep inside the full multi-hundred-file engine suite,
  // though never in an isolated run of this file alone. 3000ms keeps the same poll shape with
  // headroom for that queue depth.
  const deadline = Date.now() + 3000;
  while (!condition() && Date.now() < deadline) await aTimeout(10);
  expect(condition()).to.be.true;
}

describe('mapped iframe surface', () => {
  it('forwards src, fullscreen, loading, referrer policy, and sandbox to a named iframe', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame
        src="about:blank"
        allowfullscreen
        loading="lazy"
        referrerpolicy="same-origin"
        sandbox="allow-forms allow-same-origin"
        aria-label="Component preview"
      ></lr-zoomable-frame>
    `);
    const frame = frameOf(el);
    expect(frame.getAttribute('src')).to.equal('about:blank');
    expect(frame.hasAttribute('allowfullscreen')).to.be.true;
    expect(frame.getAttribute('loading')).to.equal('lazy');
    expect(frame.getAttribute('referrerpolicy')).to.equal('same-origin');
    expect(frame.getAttribute('sandbox')).to.equal('allow-forms allow-same-origin');
    expect(frame.title).to.equal('Zoomable content');
  });

  it('gives present srcdoc precedence and omits src entirely', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame src="https://example.test/ignored" .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
    `);
    const frame = frameOf(el);
    expect(frame.hasAttribute('src')).to.be.false;
    expect(frame.srcdoc).to.equal(INLINE_DOCUMENT);
  });

  it('treats an explicitly present empty srcdoc as authoritative over src', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame src="https://example.test/ignored" srcdoc=""></lr-zoomable-frame>
    `);
    const frame = frameOf(el);
    expect(frame.hasAttribute('src')).to.be.false;
    expect(frame.hasAttribute('srcdoc')).to.be.true;
  });

  it('observes empty srcdoc presence changes even when the property value stays empty', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame src="about:blank"></lr-zoomable-frame>
    `);
    const first = frameOf(el);
    el.setAttribute('srcdoc', '');
    await el.updateComplete;
    const inline = frameOf(el);
    expect(inline === first).to.be.false;
    expect(inline.hasAttribute('src')).to.be.false;
    expect(inline.hasAttribute('srcdoc')).to.be.true;

    el.removeAttribute('srcdoc');
    await el.updateComplete;
    const navigated = frameOf(el);
    expect(navigated === inline).to.be.false;
    expect(navigated.getAttribute('src')).to.equal('about:blank');
  });

  it('rejects active and navigation-only URL schemes without assigning a fallback navigation', async () => {
    for (const src of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'mailto:x@example.test']) {
      const el = await fixture<LyraZoomableFrame>(html`<lr-zoomable-frame .src=${src}></lr-zoomable-frame>`);
      const frame = frameOf(el);
      expect(frame.hasAttribute('src'), src).to.be.false;
      expect(frame.getAttribute('sandbox'), src).to.not.equal(null);
    }
  });

  it('keeps a restrictive sandbox by default and removes the script/same-origin escape pair', async () => {
    const defaults = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
    `);
    expect(frameOf(defaults).getAttribute('sandbox')).to.equal('allow-same-origin');

    const dangerous = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame
        .srcdoc=${INLINE_DOCUMENT}
        sandbox="allow-scripts allow-same-origin unknown-token allow-forms"
      ></lr-zoomable-frame>
    `);
    const tokens = new Set(frameOf(dangerous).getAttribute('sandbox')!.split(/\s+/));
    expect(tokens.has('allow-scripts')).to.be.true;
    expect(tokens.has('allow-forms')).to.be.true;
    expect(tokens.has('allow-same-origin')).to.be.false;
    expect(tokens.has('unknown-token')).to.be.false;
  });

  it('keeps the sandbox attribute restrictive for a non-string runtime value', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
    `);
    el.sandbox = null as unknown as string;
    await el.updateComplete;
    const frame = frameOf(el);
    expect(frame.hasAttribute('sandbox')).to.be.true;
    expect(frame.getAttribute('sandbox')).to.equal('');
  });

  it('normalizes invalid loading/referrer values to non-widening fallbacks', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame loading="later" referrerpolicy="send-everything"></lr-zoomable-frame>
    `);
    const frame = frameOf(el);
    expect(frame.getAttribute('loading')).to.equal('eager');
    expect(frame.getAttribute('referrerpolicy')).to.equal('no-referrer');
  });

  it('exposes iframe, contentWindow, and same-origin contentDocument while connected', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
    `);
    const frame = frameOf(el);
    expect(el.iframe === frame).to.be.true;
    expect(el.contentWindow === frame.contentWindow).to.be.true;
    expect(el.contentDocument === frame.contentDocument).to.be.true;
  });

  it('returns null instead of exposing an opaque-frame contentDocument failure', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
    `);
    const privateEl = el as unknown as {
      iframe?: { readonly contentDocument: Document };
    };
    const previous = Object.getOwnPropertyDescriptor(privateEl, 'iframe');
    Object.defineProperty(privateEl, 'iframe', {
      configurable: true,
      value: {
        get contentDocument(): Document {
          throw new DOMException('Cross-origin frame', 'SecurityError');
        },
      },
    });
    try {
      expect(el.contentDocument === null).to.be.true;
    } finally {
      if (previous) Object.defineProperty(privateEl, 'iframe', previous);
      else delete privateEl.iframe;
    }
  });
});

describe('zoom controls and interaction', () => {
  it('parses sorted discrete percentage/decimal levels and steps around arbitrary zoom values', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame zoom="0.6" zoom-levels="100% invalid 0.25 50% 0.5 2"></lr-zoomable-frame>
    `);
    el.zoomIn();
    expect(el.zoom).to.equal(1);
    el.zoomOut();
    expect(el.zoom).to.equal(0.5);
    el.zoomOut();
    expect(el.zoom).to.equal(0.25);
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="zoom-out-button"]') as HTMLButtonElement).disabled).to.be.true;
  });

  it('falls back to default zoom stops for blank, invalid, and non-string runtime levels', async () => {
    const el = await fixture<LyraZoomableFrame>(html`<lr-zoomable-frame zoom="1"></lr-zoomable-frame>`);
    for (const zoomLevels of ['   ', 'invalid 0.001 1001', null] as Array<string | null>) {
      el.zoom = 1;
      el.zoomLevels = zoomLevels as unknown as string;
      el.zoomIn();
      expect(el.zoom, String(zoomLevels)).to.equal(1.25);
    }
  });

  it('bounds zoom-level source scanning before a valid million-character tail can affect controls', async () => {
    const el = await fixture<LyraZoomableFrame>(html`<lr-zoomable-frame zoom="1"></lr-zoomable-frame>`);
    el.zoomLevels = `${'x'.repeat(1_000_000)} 200%`;
    el.zoomIn();
    expect(el.zoom).to.equal(1.25);
  });

  it('accepts a complete boundary token but discards one cut at the source ceiling', async () => {
    const el = await fixture<LyraZoomableFrame>(html`<lr-zoomable-frame zoom="1"></lr-zoomable-frame>`);

    el.zoomLevels = `${' '.repeat(16_380)}200% 300%`;
    el.zoomIn();
    expect(el.zoom).to.equal(2);

    el.zoom = 1;
    el.zoomLevels = `${' '.repeat(16_381)}200%`;
    el.zoomIn();
    expect(el.zoom).to.equal(1.25);
  });

  it('caps and caches the sorted zoom-level projection across getter reads and actions', () => {
    const el = document.createElement('lr-zoomable-frame') as LyraZoomableFrame;
    const withZoomCache = el as unknown as { readonly availableZoomLevels: readonly number[] };
    el.zoomLevels = Array.from({ length: 300 }, (_, index) => `${index + 1}%`).join(' ');

    const first = withZoomCache.availableZoomLevels;
    const second = withZoomCache.availableZoomLevels;
    expect(first).to.have.lengthOf(256);
    expect(second).to.equal(first);
    el.zoom = 1;
    el.zoomIn();
    el.zoomOut();
    expect(withZoomCache.availableZoomLevels).to.equal(first);

    el.zoomLevels = '25% 50% 100%';
    expect(withZoomCache.availableZoomLevels).to.not.equal(first);
  });

  it('does not move below the lowest configured zoom stop', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame zoom="0.25" zoom-levels="25% 50% 100%"></lr-zoomable-frame>
    `);
    el.zoomOut();
    expect(el.zoom).to.equal(0.25);
  });

  it('does not restrict a finite programmatic zoom to the available levels', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame zoom="0.63" zoom-levels="0.5 1"></lr-zoomable-frame>
    `);
    const frame = frameOf(el);
    expect(frame.style.getPropertyValue('--lr-zoomable-frame-zoom')).to.equal('0.63');
  });

  it('normalizes non-finite/unsafe zoom input before layout math', async () => {
    const el = await fixture<LyraZoomableFrame>(html`<lr-zoomable-frame zoom="NaN"></lr-zoomable-frame>`);
    const value = frameOf(el).style.getPropertyValue('--lr-zoomable-frame-zoom');
    expect(Number.isFinite(Number(value))).to.be.true;
    expect(Number(value)).to.be.greaterThan(0);
  });

  it('keeps every zoom level physically top-left aligned in LTR and RTL', async () => {
    for (const direction of ['ltr', 'rtl'] as const) {
      const wrapper = await fixture<HTMLElement>(html`
        <div dir=${direction} style="inline-size: 320px;">
          <lr-zoomable-frame .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
        </div>
      `);
      const el = wrapper.querySelector('lr-zoomable-frame') as LyraZoomableFrame;
      const controls = el.shadowRoot!.querySelector('[part="controls"]') as HTMLElement;

      if (direction === 'rtl') {
        const host = el.getBoundingClientRect();
        const toolbar = controls.getBoundingClientRect();
        expect(toolbar.left - host.left, 'RTL toolbar inline-end gap').to.be.lessThan(
          host.right - toolbar.right,
        );
      }

      for (const zoom of [0.25, 0.75, 1, 1.5]) {
        el.zoom = zoom;
        await el.updateComplete;
        const host = el.getBoundingClientRect();
        const frame = frameOf(el).getBoundingClientRect();
        expect(frame.left, `${direction} ${zoom} left`).to.be.closeTo(host.left + el.clientLeft, 1);
        expect(frame.top, `${direction} ${zoom} top`).to.be.closeTo(host.top + el.clientTop, 1);
        expect(frame.width, `${direction} ${zoom} width`).to.be.closeTo(el.clientWidth, 1);
        expect(frame.height, `${direction} ${zoom} height`).to.be.closeTo(el.clientHeight, 1);
      }
    }
  });

  it('uses default and ancestor-themed hover backgrounds for zoom controls', async () => {
    const defaults = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
    `);
    const defaultButton = defaults.shadowRoot!.querySelector<HTMLElement>('[part="zoom-in-button"]')!;
    const defaultBackground = getComputedStyle(defaultButton).backgroundColor;

    const wrapper = await fixture<HTMLElement>(html`
      <div style="--lr-zoomable-frame-control-hover-background: rgb(29, 30, 31)">
        <lr-zoomable-frame .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
      </div>
    `);
    const themedButton = wrapper.querySelector<LyraZoomableFrame>('lr-zoomable-frame')!.shadowRoot!
      .querySelector<HTMLElement>('[part="zoom-in-button"]')!;
    const moveTo = async (target: HTMLElement): Promise<void> => {
      target.scrollIntoView({ block: 'center', inline: 'center' });
      await aTimeout(0);
      const rect = target.getBoundingClientRect();
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await aTimeout(0);
    };

    try {
      await resetMouse();
      await moveTo(defaultButton);
      expect(getComputedStyle(defaultButton).backgroundColor === defaultBackground).to.be.false;
      await moveTo(themedButton);
      expect(getComputedStyle(themedButton).backgroundColor).to.equal('rgb(29, 30, 31)');
    } finally {
      await resetMouse();
    }
  });

  it('keeps a bound-disabled zoom control visually inert on hover and press', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame
        zoom="0.25"
        style="--lr-zoomable-frame-control-hover-background:rgb(1,2,3)"
      ></lr-zoomable-frame>
    `);
    const button = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="zoom-out-button"]')!;
    expect(button.disabled).to.equal(true);
    const rest = getComputedStyle(button).backgroundColor;
    const rect = button.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await aTimeout(0);
      expect(getComputedStyle(button).backgroundColor).to.equal(rest);
      await sendMouse({ type: 'down' });
      await aTimeout(0);
      expect(getComputedStyle(button).backgroundColor).to.equal(rest);
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });

  it('supports localized slotted icon controls and keyboard plus/minus shortcuts', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame zoom="1" zoom-levels="50% 100% 150%">
        <span slot="zoom-in-icon">larger</span>
        <span slot="zoom-out-icon">smaller</span>
      </lr-zoomable-frame>
    `);
    const controls = el.shadowRoot!.querySelector('[part="controls"]') as HTMLElement;
    expect(controls.getAttribute('role')).to.equal('toolbar');
    expect(el.querySelectorAll('[slot="zoom-in-icon"]').length).to.equal(1);
    controls.dispatchEvent(new KeyboardEvent('keydown', { key: '+', bubbles: true, cancelable: true }));
    expect(el.zoom).to.equal(1.5);
    controls.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true, cancelable: true }));
    expect(el.zoom).to.equal(1);
  });

  it('leaves zoom shortcuts alone when toolbar keydown has modifiers or an unrelated key', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame zoom="1" zoom-levels="50% 100% 150%"></lr-zoomable-frame>
    `);
    const controls = el.shadowRoot!.querySelector('[part="controls"]') as HTMLElement;
    const modified = new KeyboardEvent('keydown', {
      key: '+',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    expect(controls.dispatchEvent(modified)).to.be.true;
    expect(modified.defaultPrevented).to.be.false;
    expect(el.zoom).to.equal(1);

    const unrelated = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
    expect(controls.dispatchEvent(unrelated)).to.be.true;
    expect(unrelated.defaultPrevented).to.be.false;
    expect(el.zoom).to.equal(1);
  });

  it('keeps hostile icon overrides projected but inert under the native zoom controls', async () => {
    const root = await fixture<HTMLElement>(html`
      <div>
        <button id="outside" type="button">Outside</button>
        <lr-zoomable-frame
          aria-label="Icon slot probe"
          style="inline-size: 320px"
          zoom="1"
          zoom-levels="50% 100% 150%"
        >
          <button id="zoom-in-glyph" slot="zoom-in-icon" type="button">Larger</button>
          <a id="zoom-out-glyph" slot="zoom-out-icon" href="#zoom-out-glyph">Smaller</a>
        </lr-zoomable-frame>
      </div>
    `);
    const el = root.querySelector<LyraZoomableFrame>('lr-zoomable-frame')!;
    const outside = root.querySelector<HTMLButtonElement>('#outside')!;
    const zoomInGlyph = root.querySelector<HTMLButtonElement>('#zoom-in-glyph')!;
    const zoomOutGlyph = root.querySelector<HTMLAnchorElement>('#zoom-out-glyph')!;

    for (const name of ['zoom-in-icon', 'zoom-out-icon']) {
      const slot = el.shadowRoot!.querySelector<HTMLSlotElement>(`slot[name="${name}"]`)!;
      expect(slot.assignedElements().length, `${name} stays projected`).to.equal(1);
      expect(
        slot.closest<HTMLElement>('[inert]')?.getAttribute('aria-hidden'),
        `${name} is decorative inert chrome`,
      ).to.equal('true');
    }
    expect(zoomInGlyph.getBoundingClientRect().width).to.be.greaterThan(0);
    expect(zoomOutGlyph.getBoundingClientRect().width).to.be.greaterThan(0);

    outside.focus();
    zoomInGlyph.focus();
    expect(document.activeElement?.id).to.equal('outside');
    zoomOutGlyph.focus();
    expect(document.activeElement?.id).to.equal('outside');

    let zoomInGlyphClicks = 0;
    let zoomOutGlyphClicks = 0;
    zoomInGlyph.addEventListener('click', () => zoomInGlyphClicks++);
    zoomOutGlyph.addEventListener('click', () => zoomOutGlyphClicks++);
    const clickCenter = async (target: HTMLElement): Promise<void> => {
      const rect = target.getBoundingClientRect();
      await sendMouse({
        type: 'click',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
    };

    el.scrollIntoView({ block: 'center', inline: 'center' });
    await aTimeout(0);
    try {
      await resetMouse();
      await clickCenter(zoomInGlyph);
      await el.updateComplete;
      expect(zoomInGlyphClicks, 'the decorative zoom-in glyph receives no pointer click').to.equal(0);
      expect(el.zoom).to.equal(1.5);

      await clickCenter(zoomOutGlyph);
      await el.updateComplete;
      expect(zoomOutGlyphClicks, 'the decorative zoom-out glyph receives no pointer click').to.equal(0);
      expect(el.zoom).to.equal(1);
      await expect(el).to.be.accessible();
    } finally {
      await resetMouse();
    }
  });

  it('removes controls and disables pointer/keyboard entry without interaction', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame without-controls without-interaction .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
    `);
    expect(el.shadowRoot!.querySelectorAll('[part="controls"]').length).to.equal(0);
    const frame = frameOf(el);
    expect(frame.tabIndex).to.equal(-1);
    expect(frame.inert).to.be.true;
    expect(frame.hasAttribute('aria-disabled')).to.be.false;
    expect(getComputedStyle(frame).pointerEvents).to.equal('none');
    let clicks = 0;
    frame.addEventListener('click', () => clicks++);
    el.focus();
    el.click();
    expect(el.shadowRoot!.activeElement === null).to.be.true;
    expect(clicks).to.equal(0);
  });

  it('routes the iframe and toolbar accessible names through .strings', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame .strings=${{
        zoomableFrameLabel: 'Aperçu intégré',
        zoomControls: 'Échelle',
        zoomIn: 'Agrandir',
        zoomOut: 'Réduire',
      }}></lr-zoomable-frame>
    `);
    expect(frameOf(el).title).to.equal('Aperçu intégré');
    expect(el.shadowRoot!.querySelector('[part="controls"]')!.getAttribute('aria-label')).to.equal('Échelle');
    expect(el.shadowRoot!.querySelector('[part="zoom-in-button"]')!.getAttribute('aria-label')).to.equal('Agrandir');
    expect(el.shadowRoot!.querySelector('[part="zoom-out-button"]')!.getAttribute('aria-label')).to.equal('Réduire');
  });

  it('preserves an explicit empty host name without restoring a fallback iframe title', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame aria-label="" .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
    `);
    expect(frameOf(el).title).to.equal('');
  });
});

describe('navigation lifecycle and theme sync', () => {
  it('relays each current iframe load/error exactly once as native non-composed events', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
    `);
    const frame = frameOf(el);
    type EventSnapshot = { native: boolean; custom: boolean; bubbles: boolean; composed: boolean; target: string };
    const snapshot = (event: Event): EventSnapshot => ({
      native: event instanceof Event,
      custom: event instanceof CustomEvent,
      bubbles: event.bubbles,
      composed: event.composed,
      target: (event.target as Element | null)?.localName ?? '',
    });
    const loads: EventSnapshot[] = [];
    const errors: EventSnapshot[] = [];
    el.addEventListener('load', event => loads.push(snapshot(event)));
    el.addEventListener('error', event => errors.push(snapshot(event)));
    frame.dispatchEvent(new Event('load'));
    frame.dispatchEvent(new Event('error'));
    expect(loads).to.have.lengthOf(1);
    expect(errors).to.have.lengthOf(1);
    for (const event of [...loads, ...errors]) expect(event).to.deep.equal({
      native: true,
      custom: false,
      bubbles: false,
      composed: false,
      target: 'lr-zoomable-frame',
    });
  });

  it('rekeys navigation and rejects late events from the previous iframe generation', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame .srcdoc=${'<p>first</p>'}></lr-zoomable-frame>
    `);
    const first = frameOf(el);
    let loads = 0;
    el.addEventListener('load', () => loads++);
    el.srcdoc = '<p>second</p>';
    await el.updateComplete;
    const second = frameOf(el);
    expect((second) !== (first)).to.equal(true);
    first.dispatchEvent(new Event('load'));
    expect(loads).to.equal(0);
    second.dispatchEvent(new Event('load'));
    expect(loads).to.equal(1);
  });

  it('rejects an old-frame event synchronously after navigation input changes', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame .srcdoc=${'<p>first</p>'}></lr-zoomable-frame>
    `);
    const first = frameOf(el);
    let loads = 0;
    el.addEventListener('load', () => loads++);
    el.srcdoc = '<p>second</p>';
    first.dispatchEvent(new Event('load'));
    expect(loads).to.equal(0);

    await el.updateComplete;
    frameOf(el).dispatchEvent(new Event('load'));
    expect(loads).to.equal(1);
  });

  it('suppresses detached events, returns null accessors, and uses a fresh frame after reconnect', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
    `);
    const oldFrame = frameOf(el);
    let loads = 0;
    el.addEventListener('load', () => loads++);
    el.remove();
    oldFrame.dispatchEvent(new Event('load'));
    expect(loads).to.equal(0);
    expect(el.contentWindow).to.equal(null);
    expect((el.contentDocument) === (null)).to.equal(true);

    document.body.append(el);
    await el.updateComplete;
    expect((frameOf(el)) !== (oldFrame)).to.equal(true);
  });

  it('syncs Lyra theme selectors after load and later host-theme changes', async () => {
    const root = document.documentElement;
    const previousClass = root.getAttribute('class');
    const previousTheme = root.getAttribute('data-lr-theme');
    try {
      root.classList.add('lr-dark', 'unrelated-class');
      root.setAttribute('data-lr-theme', 'dark');
      const el = await fixture<LyraZoomableFrame>(html`
        <lr-zoomable-frame with-theme-sync .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
      `);
      const frame = frameOf(el);
      frame.dispatchEvent(new Event('load'));
      const childRoot = (): HTMLElement | null => frame.contentDocument?.documentElement ?? null;
      await eventually(() => childRoot()?.classList.contains('lr-dark') === true);
      expect(childRoot()?.classList.contains('unrelated-class') ?? false).to.be.false;
      expect(childRoot()?.getAttribute('data-lr-theme') ?? null).to.equal('dark');

      root.setAttribute('data-lr-theme', 'high-contrast');
      await eventually(() => childRoot()?.getAttribute('data-lr-theme') === 'high-contrast');

      root.classList.remove('lr-dark');
      root.classList.add('lr-light');
      root.setAttribute('data-lr-theme', 'light');
      await eventually(() =>
        childRoot()?.classList.contains('lr-dark') === false &&
        childRoot()?.classList.contains('lr-light') === true &&
        childRoot()?.getAttribute('data-lr-theme') === 'light'
      );
    } finally {
      if (previousClass === null) root.removeAttribute('class');
      else root.setAttribute('class', previousClass);
      if (previousTheme === null) root.removeAttribute('data-lr-theme');
      else root.setAttribute('data-lr-theme', previousTheme);
    }
  });

  it('syncs and removes resolved --lr-theme properties from a same-origin frame', async () => {
    const root = document.documentElement;
    const property = '--lr-theme-zoomable-frame-coverage-probe';
    const previousValue = root.style.getPropertyValue(property);
    const previousPriority = root.style.getPropertyPriority(property);
    try {
      root.style.setProperty(property, 'rgb(12, 34, 56)');
      const el = await fixture<LyraZoomableFrame>(html`
        <lr-zoomable-frame with-theme-sync .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
      `);
      const frame = frameOf(el);
      frame.dispatchEvent(new Event('load'));
      const childRoot = (): HTMLElement | null => frame.contentDocument?.documentElement ?? null;
      await eventually(() => childRoot()?.style.getPropertyValue(property) === 'rgb(12, 34, 56)');

      root.style.removeProperty(property);
      await eventually(() => childRoot()?.style.getPropertyValue(property) === '');
    } finally {
      if (previousValue) root.style.setProperty(property, previousValue, previousPriority);
      else root.style.removeProperty(property);
    }
  });

  it('restores iframe-owned theme state and ignores later host changes after theme sync is disabled', async () => {
    const root = document.documentElement;
    const restoredProperty = '--lr-theme-zoomable-frame-restored-probe';
    const externallyChangedProperty = '--lr-theme-zoomable-frame-external-probe';
    const previousClass = root.getAttribute('class');
    const previousAttributes = new Map(
      ['data-lr-theme', 'data-theme', 'data-color-scheme'].map(attribute => [
        attribute,
        root.getAttribute(attribute),
      ] as const),
    );
    const previousStyles = new Map(
      [restoredProperty, externallyChangedProperty, 'color-scheme'].map(property => [
        property,
        [root.style.getPropertyValue(property), root.style.getPropertyPriority(property)] as const,
      ] as const),
    );
    try {
      root.classList.add('lr-dark');
      root.setAttribute('data-lr-theme', 'host-dark');
      root.setAttribute('data-theme', 'host-theme');
      root.setAttribute('data-color-scheme', 'host-scheme');
      root.style.setProperty(restoredProperty, 'rgb(12, 34, 56)');
      root.style.setProperty(externallyChangedProperty, 'rgb(65, 43, 21)');
      root.style.setProperty('color-scheme', 'light');

      const el = await fixture<LyraZoomableFrame>(html`
        <lr-zoomable-frame .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
      `);
      const frame = frameOf(el);
      const childRoot = frame.contentDocument!.documentElement;
      childRoot.classList.add('lr-light');
      childRoot.setAttribute('data-lr-theme', 'embedded-dark');
      childRoot.setAttribute('data-theme', 'embedded-theme');
      childRoot.setAttribute('data-color-scheme', 'embedded-scheme');
      childRoot.style.setProperty(restoredProperty, 'rgb(1, 2, 3)');
      childRoot.style.setProperty(externallyChangedProperty, 'rgb(3, 2, 1)');
      childRoot.style.setProperty('color-scheme', 'dark');

      el.withThemeSync = true;
      await el.updateComplete;
      frame.dispatchEvent(new Event('load'));
      await eventually(() =>
        childRoot.classList.contains('lr-dark') &&
        childRoot.getAttribute('data-lr-theme') === 'host-dark' &&
        childRoot.style.getPropertyValue(restoredProperty) === 'rgb(12, 34, 56)' &&
        childRoot.style.getPropertyValue('color-scheme') === 'light',
      );

      childRoot.setAttribute('data-theme', 'embedded-after-sync');
      childRoot.style.setProperty(externallyChangedProperty, 'rgb(7, 8, 9)');
      el.withThemeSync = false;
      await el.updateComplete;

      expect(childRoot.classList.contains('lr-dark')).to.be.false;
      expect(childRoot.classList.contains('lr-light')).to.be.true;
      expect(childRoot.getAttribute('data-lr-theme')).to.equal('embedded-dark');
      expect(childRoot.getAttribute('data-theme')).to.equal('embedded-after-sync');
      expect(childRoot.getAttribute('data-color-scheme')).to.equal('embedded-scheme');
      expect(childRoot.style.getPropertyValue(restoredProperty)).to.equal('rgb(1, 2, 3)');
      expect(childRoot.style.getPropertyValue(externallyChangedProperty)).to.equal('rgb(7, 8, 9)');
      expect(childRoot.style.getPropertyValue('color-scheme')).to.equal('dark');

      root.classList.remove('lr-dark');
      root.classList.add('lr-light');
      root.setAttribute('data-lr-theme', 'host-light');
      root.style.setProperty(restoredProperty, 'rgb(90, 80, 70)');
      await aTimeout(0);

      expect(childRoot.classList.contains('lr-light')).to.be.true;
      expect(childRoot.getAttribute('data-lr-theme')).to.equal('embedded-dark');
      expect(childRoot.style.getPropertyValue(restoredProperty)).to.equal('rgb(1, 2, 3)');
    } finally {
      if (previousClass === null) root.removeAttribute('class');
      else root.setAttribute('class', previousClass);
      for (const [attribute, value] of previousAttributes) {
        if (value === null) root.removeAttribute(attribute);
        else root.setAttribute(attribute, value);
      }
      for (const [property, [value, priority]] of previousStyles) {
        if (value) root.style.setProperty(property, value, priority);
        else root.style.removeProperty(property);
      }
    }
  });

  it('resets theme-sync bookkeeping even when navigation already replaced the synced document before sync is disabled', async () => {
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
    `);
    const firstFrame = frameOf(el);
    el.withThemeSync = true;
    await el.updateComplete;
    firstFrame.dispatchEvent(new Event('load'));
    await el.updateComplete;
    const state = (el as unknown as { themeSyncState?: { target: Node } }).themeSyncState;
    expect(state?.target === firstFrame.contentDocument!.documentElement).to.be.true;

    // Navigating replaces the iframe (keyed on navigationGeneration) before it ever fires its own
    // 'load' event -- disabling sync in the same update batch must find restoreTheme()'s tracked
    // target stale (it still points at the superseded frame's document) and bail out of every
    // mutation loop without throwing, while its `finally` still resets the bookkeeping.
    el.srcdoc = `${INLINE_DOCUMENT}<!-- second -->`;
    el.withThemeSync = false;
    await el.updateComplete;

    expect(frameOf(el) === firstFrame).to.be.false;
    const resetState = (el as unknown as { themeSyncState?: unknown }).themeSyncState;
    expect(resetState === undefined).to.be.true;
  });
});

it('is accessible with a populated inline document and visible controls', async () => {
  const el = await fixture<LyraZoomableFrame>(html`
    <lr-zoomable-frame aria-label="Inline preview" .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
  `);
  await expect(el).to.be.accessible();
});

it('forwards host focus()/blur()/click() to the frame and re-dispatches its focus/blur with no prefixed alias', async () => {
  const wrapper = await fixture<HTMLElement>(html`
    <div><lr-zoomable-frame .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame></div>
  `);
  const el = wrapper.querySelector('lr-zoomable-frame') as LyraZoomableFrame;
  await el.updateComplete;
  const frame = frameOf(el);
  const nativeEvents: FocusEvent[] = [];
  const aliases: string[] = [];
  const sequence: string[] = [];
  wrapper.addEventListener('focus', (event) => {
    nativeEvents.push(event as FocusEvent);
    sequence.push('focus');
  });
  wrapper.addEventListener('blur', (event) => {
    nativeEvents.push(event as FocusEvent);
    sequence.push('blur');
  });
  wrapper.addEventListener('lr-focus', () => {
    aliases.push('lr-focus');
  });
  wrapper.addEventListener('lr-blur', () => {
    aliases.push('lr-blur');
  });

  el.focus();
  expect(el.shadowRoot!.activeElement === frame).to.equal(true);
  expect(el.hasAttribute('data-frame-focused')).to.be.true;
  const focusedStyle = getComputedStyle(el);
  expect(focusedStyle.outlineStyle).to.equal('solid');
  expect(Number.parseFloat(focusedStyle.outlineWidth)).to.be.greaterThan(0);

  let clicks = 0;
  frame.addEventListener('click', () => {
    clicks += 1;
  });
  el.click();
  expect(clicks).to.equal(1);

  el.blur();
  expect(el.shadowRoot!.activeElement === null).to.equal(true);
  expect(el.hasAttribute('data-frame-focused')).to.be.false;
  expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
  expect(nativeEvents.every((event) => event instanceof FocusEvent)).to.be.true;
  expect(nativeEvents.every((event) => event.target === el && event.bubbles && event.composed)).to.be.true;
  expect(sequence).to.deep.equal(['focus', 'blur']);
  expect(aliases, 'lr-focus/lr-blur compatibility aliases must not fire').to.deep.equal([]);
});

it('tracks sequential Tab/Shift+Tab and pointer entry at the browsing-context boundary', async function () {
  // Reproduced under WTR_SHARD_INDEX=3 WTR_SHARD_TOTAL=4 WTR_BROWSER=firefox (the full 120-file
  // engine shard, CPU-constrained to match a standard CI runner): a *synthesized* pointer click's
  // native focus transfer into the iframe's nested browsing context can simply not register on the
  // first attempt under heavy concurrent load -- confirmed with instrumentation showing
  // `data-frame-focused` staying false for a full, actively-polled 20 real seconds (this test's own
  // poll loop kept running the whole time; nothing here was itself stalled), reproducibly across
  // both the original attempt and mocha's automatic retry. That rules out pure scheduling delay: an
  // earlier fix (1000ms -> 3000ms poll deadline) only widened the wait, which cannot help a click
  // whose focus transfer never happened in the first place. Retrying the physical click -- not just
  // the wait -- is what actually recovers it; empirically confirmed clean across repeated shard runs
  // after this change. `this.timeout()` needs the enclosing function to be non-arrow.
  this.timeout(20000);
  const wrapper = await fixture<HTMLElement>(html`
    <div>
      <button id="before" type="button">Before</button>
      <lr-zoomable-frame without-controls .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
      <button id="after" type="button">After</button>
    </div>
  `);
  const before = wrapper.querySelector<HTMLButtonElement>('#before')!;
  const el = wrapper.querySelector('lr-zoomable-frame') as LyraZoomableFrame;
  const frame = frameOf(el);

  before.focus();
  await sendKeys({ press: 'Tab' });
  await eventually(() => el.hasAttribute('data-frame-focused'));
  expect(el.shadowRoot!.activeElement === frame).to.be.true;
  expect(getComputedStyle(el).outlineStyle).to.equal('solid');

  await sendKeys({ press: 'Shift+Tab' });
  await eventually(() => !el.hasAttribute('data-frame-focused'));
  expect(el.shadowRoot!.activeElement === null).to.be.true;
  expect(document.activeElement === el).to.be.false;

  try {
    await resetMouse();
    const rect = frame.getBoundingClientRect();
    const position: [number, number] = [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
    // Up to 5 real click attempts, 1000ms of polling headroom each -- generous relative to the
    // near-instant (observed 0-16ms) resolution every successful attempt shows, bounded well within
    // this.timeout() above even in the worst case of every attempt needing the full window.
    let focused = false;
    for (let attempt = 0; attempt < 5 && !focused; attempt += 1) {
      await sendMouse({ type: 'click', position });
      const deadline = Date.now() + 1000;
      while (!el.hasAttribute('data-frame-focused') && Date.now() < deadline) {
        await aTimeout(10);
      }
      focused = el.hasAttribute('data-frame-focused');
    }
    expect(focused, 'the iframe never gained focus after repeated click attempts').to.be.true;
    expect(el.shadowRoot!.activeElement === frame).to.be.true;
  } finally {
    await resetMouse();
  }
});

it('clears the browsing-context focus ring on navigation rekey and true interaction disablement', async () => {
  const el = await fixture<LyraZoomableFrame>(html`
    <lr-zoomable-frame .srcdoc=${'<p>first</p>'}></lr-zoomable-frame>
  `);
  const first = frameOf(el);
  el.focus();
  expect(el.hasAttribute('data-frame-focused')).to.be.true;

  el.srcdoc = '<p>second</p>';
  await el.updateComplete;
  const second = frameOf(el);
  expect(second === first).to.be.false;
  expect(el.hasAttribute('data-frame-focused')).to.be.false;
  expect(el.shadowRoot!.activeElement === null).to.be.true;

  el.focus();
  expect(el.hasAttribute('data-frame-focused')).to.be.true;
  el.withoutInteraction = true;
  await el.updateComplete;
  expect(frameOf(el).inert).to.be.true;
  expect(frameOf(el).tabIndex).to.equal(-1);
  expect(el.hasAttribute('data-frame-focused')).to.be.false;
  expect(el.shadowRoot!.activeElement === null).to.be.true;
});

it('does not invent focus transitions before a live iframe exists', () => {
  const el = document.createElement('lr-zoomable-frame') as LyraZoomableFrame;
  const events: string[] = [];
  el.addEventListener('focus', () => events.push('focus'));
  el.addEventListener('blur', () => events.push('blur'));
  el.focus();
  el.blur();
  expect(events).to.deep.equal([]);
  expect(el.hasAttribute('data-frame-focused')).to.be.false;
});

it('constructs iframe focus relays in the host owner realm, preserves payload, and fires no prefixed alias', async () => {
  const ownerFrame = document.createElement('iframe');
  const loaded = new Promise<void>((resolve) => ownerFrame.addEventListener('load', () => resolve(), { once: true }));
  ownerFrame.srcdoc = '<!doctype html><html><body></body></html>';
  document.body.append(ownerFrame);
  await loaded;

  try {
    const frameWindow = ownerFrame.contentWindow!;
    const frameDocument = ownerFrame.contentDocument!;
    const el = await fixture<LyraZoomableFrame>(html`
      <lr-zoomable-frame .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
    `);
    el.remove();
    frameDocument.body.append(frameDocument.adoptNode(el));
    await el.updateComplete;

    const related = frameDocument.createElement('button');
    const nativeEvents: FocusEvent[] = [];
    const aliases: string[] = [];
    const sequence: string[] = [];
    el.addEventListener('focus', (event) => {
      nativeEvents.push(event);
      sequence.push('focus');
    });
    el.addEventListener('blur', (event) => {
      nativeEvents.push(event);
      sequence.push('blur');
    });
    el.addEventListener('lr-focus', () => {
      aliases.push('lr-focus');
    });
    el.addEventListener('lr-blur', () => {
      aliases.push('lr-blur');
    });

    const internal = el as unknown as {
      dispatchHostFocusEvent: (type: 'focus' | 'blur', source: FocusEvent) => void;
    };
    internal.dispatchHostFocusEvent('focus', new frameWindow.FocusEvent('focusin', {
      bubbles: true,
      composed: true,
      relatedTarget: related,
      view: frameWindow,
      detail: 3,
    }));
    internal.dispatchHostFocusEvent('blur', new frameWindow.FocusEvent('focusout', {
      bubbles: true,
      composed: true,
      relatedTarget: related,
      view: frameWindow,
      detail: 5,
    }));

    expect(nativeEvents.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
    expect(nativeEvents.every((event) => event instanceof frameWindow.FocusEvent)).to.be.true;
    expect(nativeEvents.every((event) => event instanceof FocusEvent), 'not ambient-branded').to.be.false;
    expect(nativeEvents.every((event) => event.target === el && event.relatedTarget === related)).to.be.true;
    expect(nativeEvents.map((event) => event.detail)).to.deep.equal([3, 5]);
    expect(sequence).to.deep.equal(['focus', 'blur']);
    expect(aliases, 'lr-focus/lr-blur compatibility aliases must not fire').to.deep.equal([]);
  } finally {
    ownerFrame.remove();
  }
});
