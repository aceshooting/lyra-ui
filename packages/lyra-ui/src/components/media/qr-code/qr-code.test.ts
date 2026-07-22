import { aTimeout, fixture, expect, html, waitUntil } from '@open-wc/testing';
import { LitElement, type PropertyValues } from 'lit';
import './qr-code.js';
import type { LyraQrCode, LyraQrCodeErrorCorrection } from './qr-code.js';

interface FakeModules {
  size: number;
  get(row: number, col: number): number;
}

interface FakeQrCodeApi {
  create: (value: string, options: { errorCorrectionLevel: string }) => { modules: FakeModules };
}

/** A trivial 1×1-module symbol whose single dark module always spans the exact geometric center
 *  of the rendered canvas, regardless of `size` -- convenient for pixel sampling in tests without
 *  hand-computing quiet-zone offsets. */
function fakeModules(dark: boolean): FakeModules {
  return { size: 1, get: () => (dark ? 1 : 0) };
}

function fakeApi(create: FakeQrCodeApi['create']): FakeQrCodeApi {
  return { create };
}

function installFakeLoader(el: LyraQrCode, api: FakeQrCodeApi | null): void {
  (el as unknown as { loadLibrary: () => Promise<FakeQrCodeApi | null> }).loadLibrary = () => Promise.resolve(api);
}

async function waitForPart(el: LyraQrCode, part: string): Promise<void> {
  await waitUntil(() => el.shadowRoot!.querySelector(`[part="${part}"]`) !== null);
  await el.updateComplete;
}

describe('lr-qr-code', () => {
  it('defaults value/label/size/radius/errorCorrection to their documented values', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    expect(el.value).to.equal('');
    expect(el.label).to.equal('');
    expect(el.size).to.equal(128);
    expect(el.radius).to.equal(0);
    expect(el.errorCorrection).to.equal('H');
  });

  it('renders the empty state and never loads the optional peer when value is empty', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    let calls = 0;
    (el as unknown as { loadLibrary: () => Promise<FakeQrCodeApi | null> }).loadLibrary = () => {
      calls++;
      return Promise.resolve(null);
    };
    await el.updateComplete;
    await aTimeout(20);
    const empty = el.shadowRoot!.querySelector('[part="empty"]');
    expect(empty).to.exist;
    expect(empty!.textContent).to.equal('No data');
    expect(el.shadowRoot!.querySelector('canvas')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[role="img"]')).to.not.exist;
    expect(calls).to.equal(0);
  });

  it('shows the loading state while the optional peer is first loading', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    (el as unknown as { loadLibrary: () => Promise<FakeQrCodeApi | null> }).loadLibrary = () => new Promise(() => {});
    el.value = 'hello';
    await waitForPart(el, 'loading');
    expect(el.shadowRoot!.querySelector('[part="loading"]')!.textContent).to.equal('Loading…');
  });

  it('shows the missing-library error when the optional peer fails to load', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(el, null);
    el.value = 'hello';
    await waitForPart(el, 'error');
    const error = el.shadowRoot!.querySelector('[part="error"]')!;
    expect(error.getAttribute('role')).to.equal('alert');
    expect(error.textContent).to.equal('This component needs the optional "qrcode" package installed to render QR codes.');
  });

  it('shows the generation-failed error when encoding throws', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => {
        throw new Error('boom');
      }),
    );
    el.value = 'hello';
    await waitForPart(el, 'error');
    const error = el.shadowRoot!.querySelector('[part="error"]')!;
    expect(error.getAttribute('role')).to.equal('alert');
    expect(error.textContent).to.equal('This value could not be encoded as a QR code.');
  });

  it('ignores a pending peer-load result if the element is disconnected before it resolves', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    let resolveLoad!: (api: FakeQrCodeApi | null) => void;
    const pending = new Promise<FakeQrCodeApi | null>((resolve) => {
      resolveLoad = resolve;
    });
    (el as unknown as { loadLibrary: () => Promise<FakeQrCodeApi | null> }).loadLibrary = () => pending;
    el.value = 'hello';
    await waitForPart(el, 'loading');
    el.remove();
    resolveLoad(fakeApi(() => ({ modules: fakeModules(true) })));
    await aTimeout(20);
    expect(el.isConnected).to.be.false;
    expect(el.shadowRoot!.querySelector('canvas')).to.not.exist;
  });

  it('ignores a stale generate() call if the generation advances while the peer loader is still pending', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    let createCalls = 0;
    (el as unknown as { loadLibrary: () => Promise<FakeQrCodeApi | null> }).loadLibrary = () => {
      // Simulates a second generate() call (e.g. a rapid `value` change) winning the race and
      // advancing the generation counter before this call's own peer load resolves.
      (el as unknown as { generation: number }).generation++;
      return Promise.resolve(
        fakeApi(() => {
          createCalls++;
          return { modules: fakeModules(true) };
        }),
      );
    };
    el.value = 'hello';
    await el.updateComplete;
    await aTimeout(20);
    expect(createCalls).to.equal(0);
    expect(el.shadowRoot!.querySelector('[part="loading"]')).to.exist;
  });

  it('discards a successful create() result if the generation advances synchronously while create() runs', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => {
        // The injectable `create()` seam is the only thing that runs between the two
        // post-await generation checks (there's no `await` in between), so a stale
        // generation there has to come from `create()` itself mutating it.
        (el as unknown as { generation: number }).generation++;
        return { modules: fakeModules(true) };
      }),
    );
    el.value = 'hello';
    await el.updateComplete;
    await aTimeout(20);
    expect(el.shadowRoot!.querySelector('canvas')).to.not.exist;
  });

  it('discards an error result if the generation advances synchronously while create() throws', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => {
        (el as unknown as { generation: number }).generation++;
        throw new Error('boom');
      }),
    );
    el.value = 'hello';
    await el.updateComplete;
    await aTimeout(20);
    expect(el.shadowRoot!.querySelector('[part="error"]')).to.not.exist;
  });

  it('renders a canvas sized to `size` CSS px with a DPR-scaled backing store', async () => {
    const el = (await fixture(html`
      <lr-qr-code
        size="90"
        style="--lr-qr-code-fill: #000; --lr-qr-code-background: #fff;"
      ></lr-qr-code>
    `)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    expect(parseInt(canvas.style.width, 10)).to.equal(90);
    expect(parseInt(canvas.style.height, 10)).to.equal(90);
    expect(canvas.width).to.equal(Math.round(90 * dpr));
    expect(canvas.height).to.equal(Math.round(90 * dpr));
  });

  it('normalizes error-correction: lowercase valid letters upper-case, invalid values fall back to H', async () => {
    const lower = (await fixture(html`<lr-qr-code error-correction="l"></lr-qr-code>`)) as LyraQrCode;
    expect(lower.errorCorrection).to.equal('L');

    const bogus = (await fixture(html`<lr-qr-code error-correction="bogus"></lr-qr-code>`)) as LyraQrCode;
    expect(bogus.errorCorrection).to.equal('H');

    lower.errorCorrection = 'q' as LyraQrCodeErrorCorrection;
    expect(lower.errorCorrection).to.equal('Q');
  });

  it('falls back to the default error-correction level when the attribute is removed', async () => {
    const el = (await fixture(html`<lr-qr-code error-correction="l"></lr-qr-code>`)) as LyraQrCode;
    expect(el.errorCorrection).to.equal('L');
    el.removeAttribute('error-correction');
    await el.updateComplete;
    expect(el.errorCorrection).to.equal('H');
  });

  it('clamps radius and size to their documented ranges', async () => {
    const el = (await fixture(html`<lr-qr-code radius="-1" size="0"></lr-qr-code>`)) as LyraQrCode;
    expect(el.radius).to.equal(0);
    expect(el.size).to.equal(1);

    el.radius = 5;
    expect(el.radius).to.equal(0.5);
    el.size = 99999;
    expect(el.size).to.equal(2048);
    el.size = Number.NaN;
    expect(el.size).to.equal(128);
  });

  it('resolves the accessible name from `value` by default', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'https://example.test';
    await waitForPart(el, 'canvas');
    const canvas = el.shadowRoot!.querySelector('canvas')!;
    expect(canvas.getAttribute('role')).to.equal('img');
    expect(canvas.getAttribute('aria-label')).to.equal('https://example.test');
  });

  it('`label` overrides `value` for the accessible name', async () => {
    const el = (await fixture(html`<lr-qr-code label="My QR code"></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'https://example.test';
    await waitForPart(el, 'canvas');
    expect(el.shadowRoot!.querySelector('canvas')!.getAttribute('aria-label')).to.equal('My QR code');
  });

  it('forwards a host `aria-label` onto the canvas when `label` is unset', async () => {
    const el = (await fixture(html`<lr-qr-code aria-label="Host label"></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'https://example.test';
    await waitForPart(el, 'canvas');
    expect(el.shadowRoot!.querySelector('canvas')!.getAttribute('aria-label')).to.equal('Host label');
  });

  it('`label` wins over a host `aria-label` when both are set', async () => {
    const el = (await fixture(
      html`<lr-qr-code label="Label wins" aria-label="Host label"></lr-qr-code>`,
    )) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'https://example.test';
    await waitForPart(el, 'canvas');
    expect(el.shadowRoot!.querySelector('canvas')!.getAttribute('aria-label')).to.equal('Label wins');
  });

  it('refreshTheme() redraws from the cached matrix without recalling loadLibrary/create', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    let loadCalls = 0;
    let createCalls = 0;
    (el as unknown as { loadLibrary: () => Promise<FakeQrCodeApi | null> }).loadLibrary = () => {
      loadCalls++;
      return Promise.resolve(
        fakeApi(() => {
          createCalls++;
          return { modules: fakeModules(true) };
        }),
      );
    };
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    expect(loadCalls).to.equal(1);
    expect(createCalls).to.equal(1);

    el.refreshTheme();
    await el.updateComplete;
    expect(loadCalls).to.equal(1);
    expect(createCalls).to.equal(1);
  });

  it('re-arms the DPR media query and redraws when the DPR change handler fires', async () => {
    const el = (await fixture(html`<lr-qr-code size="90"></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(parseInt(canvas.style.width, 10)).to.equal(90);
    expect(() => (el as unknown as { onDprChange(): void }).onDprChange()).to.not.throw();
    expect(parseInt(canvas.style.width, 10)).to.equal(90);
  });

  it('redraws (coalesced) when an ancestor theme attribute mutates, via the shared ThemeWatcher', async () => {
    const el = (await fixture(html`<lr-qr-code size="90"></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    let refreshCalls = 0;
    const originalRefreshTheme = el.refreshTheme.bind(el);
    el.refreshTheme = () => {
      refreshCalls++;
      originalRefreshTheme();
    };
    // A burst of watched-attribute writes must coalesce to a single refresh.
    el.setAttribute('data-theme', 'a');
    el.setAttribute('data-color-scheme', 'b');
    await aTimeout(20);
    expect(refreshCalls).to.equal(1);
  });

  it('warns once and falls back to #000000 for an invalid --lr-qr-code-fill override', async () => {
    const el = (await fixture(
      html`<lr-qr-code style="--lr-qr-code-fill: not-a-color"></lr-qr-code>`,
    )) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      el.value = 'hello';
      await waitForPart(el, 'canvas');
      const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const center = Math.round(canvas.width / 2);
      const pixel = ctx.getImageData(center, center, 1, 1).data;
      expect(pixel[0]).to.equal(0);
      expect(pixel[1]).to.equal(0);
      expect(pixel[2]).to.equal(0);
      const matches = calls.filter((args) => args.join(' ').includes('not-a-color'));
      expect(matches.length).to.equal(1);

      // A second draw with the same bad value must not warn again.
      el.refreshTheme();
      const stillMatches = calls.filter((args) => args.join(' ').includes('not-a-color'));
      expect(stillMatches.length).to.equal(1);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('paints the resolved fill/background colors correctly when both are valid', async () => {
    const el = (await fixture(html`
      <lr-qr-code
        size="90"
        style="--lr-qr-code-fill: #000; --lr-qr-code-background: #fff;"
      ></lr-qr-code>
    `)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    // Center of the canvas always falls inside the single dark module of a 1x1-module symbol.
    const center = Math.round(canvas.width / 2);
    const darkPixel = ctx.getImageData(center, center, 1, 1).data;
    expect([...darkPixel.slice(0, 3)]).to.deep.equal([0, 0, 0]);
    // Top-left corner is always inside the quiet zone (background).
    const bgPixel = ctx.getImageData(1, 1, 1, 1).data;
    expect([...bgPixel.slice(0, 3)]).to.deep.equal([255, 255, 255]);
  });

  it('falls back to the default fill/background hex when the CSS custom property resolves empty', async () => {
    const el = (await fixture(html`<lr-qr-code size="40"></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = ((target: Element, pseudo?: string | null) => {
      if (target === el) return { getPropertyValue: () => '' } as unknown as CSSStyleDeclaration;
      return originalGetComputedStyle(target, pseudo);
    }) as typeof window.getComputedStyle;
    try {
      el.value = 'hello';
      await waitForPart(el, 'canvas');
      const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const center = Math.round(canvas.width / 2);
      const darkPixel = ctx.getImageData(center, center, 1, 1).data;
      expect([...darkPixel.slice(0, 3)]).to.deep.equal([0, 0, 0]);
      const bgPixel = ctx.getImageData(1, 1, 1, 1).data;
      expect([...bgPixel.slice(0, 3)]).to.deep.equal([255, 255, 255]);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  });

  it('is accessible in the ready state', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'https://example.test';
    await waitForPart(el, 'canvas');
    await expect(el).to.be.accessible();
  });

  it('is accessible in the error state', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(el, null);
    el.value = 'hello';
    await waitForPart(el, 'error');
    await expect(el).to.be.accessible();
  });

  it('renders the built-in English fallback strings with no locale registered', async () => {
    const empty = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    await empty.updateComplete;
    expect(empty.shadowRoot!.querySelector('[part="empty"]')!.textContent).to.equal('No data');

    const missing = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(missing, null);
    missing.value = 'hello';
    await waitForPart(missing, 'error');
    expect(missing.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
      'This component needs the optional "qrcode" package installed to render QR codes.',
    );
  });

  it('reaches the rendered error text through a `.strings` override', async () => {
    const el = (await fixture(
      html`<lr-qr-code .strings=${{ qrCodeMissingLibrary: 'Bibliothèque manquante.' }}></lr-qr-code>`,
    )) as LyraQrCode;
    installFakeLoader(el, null);
    el.value = 'hello';
    await waitForPart(el, 'error');
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal('Bibliothèque manquante.');
  });

  it('chains updated() to super.updated() so a mixin layered under LyraElement would still run', async () => {
    // No shared mixin actually overrides updated() today, so the only way to prove the chain is
    // live (rather than grepping source text for the call) is to patch the base-class hook itself
    // -- the exact hook a future mixin would extend -- and confirm it actually fires.
    const hadOwn = Object.prototype.hasOwnProperty.call(LitElement.prototype, 'updated');
    const original = (LitElement.prototype as unknown as { updated?: (changed: PropertyValues) => void })
      .updated;
    let called = false;
    (LitElement.prototype as unknown as { updated: (changed: PropertyValues) => void }).updated = function (
      this: LitElement,
      changed: PropertyValues,
    ) {
      called = true;
      original?.call(this, changed);
    };
    try {
      const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
      await el.updateComplete;
      expect(called).to.be.true;
    } finally {
      if (hadOwn) {
        (LitElement.prototype as unknown as { updated: unknown }).updated = original;
      } else {
        delete (LitElement.prototype as unknown as { updated?: unknown }).updated;
      }
    }
  });

  it('skips the canvas redraw while scrolled off-screen and catches up once visible again', async () => {
    const el = (await fixture(html`<lr-qr-code size="90"></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(parseInt(canvas.style.width, 10)).to.equal(90);

    (el as unknown as { visible: boolean }).visible = false;
    el.size = 150;
    await el.updateComplete;
    // The canvas geometry-changing redraw was skipped entirely while off-screen.
    expect(parseInt(canvas.style.width, 10)).to.equal(90);

    (el as unknown as { visible: boolean }).visible = true;
    (el as unknown as { draw(): void }).draw();
    await el.updateComplete;
    expect(parseInt(canvas.style.width, 10)).to.equal(150);
  });

  it('no-ops draw() while the load state is not ready', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    await el.updateComplete;
    expect(() => (el as unknown as { draw(): void }).draw()).to.not.throw();
    expect(el.shadowRoot!.querySelector('canvas')).to.not.exist;
  });

  it('no-ops draw() when the canvas element has not rendered yet for the current load state', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    await el.updateComplete;
    // Bypasses the normal generate()/Lit-render flow: forces `ready` state directly, then calls
    // draw() synchronously before Lit's async render has had a chance to create the <canvas>.
    (el as unknown as { loadState: unknown }).loadState = { kind: 'ready', modules: fakeModules(true) };
    expect(el.shadowRoot!.querySelector('canvas')).to.not.exist;
    expect(() => (el as unknown as { draw(): void }).draw()).to.not.throw();
  });

  it('falls back to a DPR of 1 when window.devicePixelRatio is falsy', async () => {
    const el = (await fixture(html`<lr-qr-code size="40"></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    Object.defineProperty(window, 'devicePixelRatio', { value: 0, configurable: true });
    try {
      (el as unknown as { draw(): void }).draw();
      expect(canvas.width).to.equal(40);
      expect(canvas.height).to.equal(40);
    } finally {
      delete (window as unknown as { devicePixelRatio?: number }).devicePixelRatio;
    }
  });

  it('no-ops without throwing when the rendering canvas cannot produce a 2D context', async () => {
    const el = (await fixture(html`<lr-qr-code size="40"></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
    try {
      el.value = 'hello';
      await waitForPart(el, 'canvas');
    } finally {
      HTMLCanvasElement.prototype.getContext = originalGetContext;
    }
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas.width).to.be.greaterThan(0);
    // Sanity: the real context works again now that the stub is restored.
    expect(canvas.getContext('2d')).to.exist;
  });

  it('paints only the background when the encoded symbol has zero modules', async () => {
    const el = (await fixture(html`
      <lr-qr-code size="40" style="--lr-qr-code-fill: #000; --lr-qr-code-background: #fff;"></lr-qr-code>
    `)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: { size: 0, get: () => 0 } })),
    );
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const pixel = ctx.getImageData(1, 1, 1, 1).data;
    expect([...pixel.slice(0, 3)]).to.deep.equal([255, 255, 255]);
  });

  it('draws rounded modules via roundRect and skips light modules when radius > 0 on a mixed symbol', async () => {
    const el = (await fixture(html`
      <lr-qr-code size="40" radius="0.5" style="--lr-qr-code-fill: #000; --lr-qr-code-background: #fff;"></lr-qr-code>
    `)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({
        modules: { size: 2, get: (row: number, col: number) => (row === 1 && col === 1 ? 1 : 0) },
      })),
    );
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    // size=40, moduleCount=2, quiet zone 4 modules/side => moduleSize = 40/10 = 4px; offset = 16px.
    // Module (1,1) (dark) spans [20,24)x[20,24), center (22,22). Module (0,0) (light) spans
    // [16,20)x[16,20), center (18,18).
    const darkCenter = Math.round(22 * dpr);
    const darkPixel = ctx.getImageData(darkCenter, darkCenter, 1, 1).data;
    expect([...darkPixel.slice(0, 3)]).to.deep.equal([0, 0, 0]);
    const lightCenter = Math.round(18 * dpr);
    const lightPixel = ctx.getImageData(lightCenter, lightCenter, 1, 1).data;
    expect([...lightPixel.slice(0, 3)]).to.deep.equal([255, 255, 255]);
  });

  it('fits comfortably inside a 320px-narrow container at the default size', async () => {
    const wrapper = await fixture(html`<div style="inline-size: 320px"><lr-qr-code></lr-qr-code></div>`);
    const el = wrapper.querySelector('lr-qr-code') as LyraQrCode;
    await el.updateComplete;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    const rect = el.getBoundingClientRect();
    expect(rect.width).to.be.lessThan(320);
  });
});
