import { aTimeout, expect, fixture, html, oneEvent } from '@open-wc/testing';
import './zoomable-frame.js';
import type { LyraZoomableFrame } from './zoomable-frame.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

const INLINE_DOCUMENT = '<!doctype html><html><body><p>Inline preview</p></body></html>';

function frameOf(el: LyraZoomableFrame): HTMLIFrameElement {
  return el.shadowRoot!.querySelector('[part="iframe"]') as HTMLIFrameElement;
}

async function eventually(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 1000;
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
    expect(frame.title).to.equal('Component preview');
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
    expect(getComputedStyle(frame).pointerEvents).to.equal('none');
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
});

it('is accessible with a populated inline document and visible controls', async () => {
  const el = await fixture<LyraZoomableFrame>(html`
    <lr-zoomable-frame aria-label="Inline preview" .srcdoc=${INLINE_DOCUMENT}></lr-zoomable-frame>
  `);
  await expect(el).to.be.accessible();
});
