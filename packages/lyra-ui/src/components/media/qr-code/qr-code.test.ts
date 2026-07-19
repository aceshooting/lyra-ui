import { aTimeout, fixture, expect, html, waitUntil } from '@open-wc/testing';
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
