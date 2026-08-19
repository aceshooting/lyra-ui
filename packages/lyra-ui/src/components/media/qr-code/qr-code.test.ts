import { aTimeout, fixture, expect, html, waitUntil } from '@open-wc/testing';
import { LitElement, type PropertyValues } from 'lit';
import './qr-code.js';
import { LyraQrCode, type LyraQrCodeErrorCorrection } from './qr-code.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

function assertiveAnnouncements(): string[] {
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="assertive"]`,
  );
  return sink ? Array.from(sink.children, (child) => child.textContent ?? '') : [];
}

function politeAnnouncements(): string[] {
  const sink = document.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`,
  );
  return sink ? Array.from(sink.children, (child) => child.textContent ?? '') : [];
}

interface FakeModules {
  size: number;
  get(row: number, col: number): number;
}

interface FakeQrCodeApi {
  create: (value: string, options: { errorCorrectionLevel: string }) => unknown;
}

const RED_IMAGE_DATA =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"%3E%3Crect width="10" height="10" fill="%23ff0000"/%3E%3C/svg%3E';

/** A trivial 1×1-module symbol whose single dark module spans the full rendered canvas. */
function fakeModules(dark: boolean): FakeModules {
  return { size: 1, get: () => (dark ? 1 : 0) };
}

function mixedModules(): FakeModules {
  return {
    size: 2,
    get: (row, col) => (row === 1 && col === 1 ? 1 : 0),
  };
}

function fakeApi(create: FakeQrCodeApi['create']): FakeQrCodeApi {
  return { create };
}

function installFakeLoader(el: LyraQrCode, api: FakeQrCodeApi | null): void {
  (el as unknown as { loadLibrary: () => Promise<FakeQrCodeApi | null> }).loadLibrary = () => Promise.resolve(api);
}

async function waitForPart(el: LyraQrCode, part: string): Promise<void> {
  const selector = part === 'canvas' ? 'canvas:not([hidden])' : `[part="${part}"]`;
  await waitUntil(() => el.shadowRoot!.querySelector(selector) !== null);
  await el.updateComplete;
}

function semanticInternals(el: LyraQrCode): ElementInternals {
  const internals = (el as unknown as { accessibilityInternals?: ElementInternals })
    .accessibilityInternals;
  expect(internals !== undefined).to.equal(true);
  return internals!;
}

describe('lr-qr-code', () => {
  it('preloads the optional QR peer without generating a code', async () => {
    // `preload()` always goes through the real, non-injectable module-level `loadQrCodeCached()`
    // (unlike every other test here, which overrides the per-instance `loadLibrary` seam) --
    // by design, since its whole purpose is priming the actual peer for a real application.
    // `qrcode` is a genuine multi-file CommonJS package with no single-file browser bundle
    // (qr-code-loader.test.ts's own skipped "caches the real optional module result" test
    // documents the same gap), so this test browser cannot resolve it and the loader's documented
    // fail-closed `console.warn()` fires -- exactly the behavior under test, not a bug. Stub
    // `console.warn` locally (matching qr-code-loader.test.ts's "returns null and logs the import
    // error" pattern) so that expected warning doesn't trip strict-console mode.
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const preloadResult: Promise<boolean> = LyraQrCode.preload();
      const loaded = await preloadResult;
      expect(typeof loaded).to.equal('boolean');
    } finally {
      console.warn = originalWarn;
    }
  });

  it('exposes generate() as a synchronous void trigger', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    const result: void = el.generate();
    expect(result).to.equal(undefined);
  });

  it('defaults value/label/size/radius/errorCorrection to their documented values', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    expect(el.value).to.equal('');
    expect(el.label).to.equal('');
    expect(el.size).to.equal(128);
    expect(el.radius).to.equal(0);
    expect(el.errorCorrection).to.equal('H');
    expect(el.fill).to.equal('');
    expect(el.background).to.equal('');
    expect(el.image).to.equal(null);
    expect(el.imageBackground).to.equal(null);
    expect(el.imageCoverage).to.equal(null);
    expect(el.imagePadding).to.equal(null);
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
    expect((empty) != null).to.equal(true);
    expect(empty!.textContent).to.equal('No data');
    expect(el.canvas.hidden).to.equal(true);
    expect(el.canvas === el.shadowRoot!.querySelector('canvas')).to.equal(true);
    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect(el.shadowRoot!.querySelector('[role="img"]') == null).to.be.true;
    expect(calls).to.equal(0);
  });

  it('keeps base and qr-code as part aliases on the same wrapper node', async () => {
    // `base` is the Web Awesome / Shoelace spelling: wa-qr-code deprecates it in favour of
    // `qr-code`, while sl-qr-code still publishes it as its only part. Both tokens therefore stay
    // on one node so a migrated `::part(base)` rule keeps matching.
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    await el.updateComplete;
    const wrapper = el.shadowRoot!.querySelector('[part~="qr-code"]') as HTMLElement;
    expect(wrapper.part.contains('base')).to.equal(true);
    // Identity as a boolean -- a DOM node in chai's actual/expected hangs the file.
    expect(
      el.shadowRoot!.querySelector('[part~="base"]') === wrapper,
      'base resolves to the qr-code wrapper',
    ).to.be.true;
  });

  it('shows the loading state while the optional peer is first loading', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    (el as unknown as { loadLibrary: () => Promise<FakeQrCodeApi | null> }).loadLibrary = () => new Promise(() => {});
    el.value = 'hello';
    await waitForPart(el, 'loading');
    expect(el.shadowRoot!.querySelector('[part="loading"]')!.textContent).to.equal('Loading…');
    expect(el.canvas.hidden).to.equal(true);
    expect(el.getAttribute('aria-busy')).to.equal('true');
  });

  it('publishes honest initial busy semantics without announcing a mount', async () => {
    const el = document.createElement('lr-qr-code') as LyraQrCode;
    (el as unknown as { loadLibrary: () => Promise<FakeQrCodeApi | null> }).loadLibrary = () =>
      new Promise(() => {});
    el.value = 'declarative pending';
    await fixture(el);
    await waitForPart(el, 'loading');
    expect(el.getAttribute('aria-busy')).to.equal('true');
    expect(semanticInternals(el).role).to.equal('img');
    expect(semanticInternals(el).ariaLabel).to.equal('declarative pending');
    expect(politeAnnouncements()).to.deep.equal([]);
  });

  it('announces only a post-mount loading transition and publishes true/false busy on the host', async () => {
    const el = document.createElement('lr-qr-code') as LyraQrCode;
    installFakeLoader(el, fakeApi(() => ({ modules: fakeModules(true) })));
    el.value = 'ready first';
    await fixture(el);
    await waitForPart(el, 'canvas');
    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect(politeAnnouncements()).to.deep.equal([]);

    let resolveLoad!: (api: FakeQrCodeApi | null) => void;
    (el as unknown as { loadLibrary: () => Promise<FakeQrCodeApi | null> }).loadLibrary = () =>
      new Promise((resolve) => { resolveLoad = resolve; });
    el.value = 'next value';
    await waitForPart(el, 'loading');
    expect(el.getAttribute('aria-busy')).to.equal('true');
    expect(politeAnnouncements()).to.deep.equal(['Loading…']);
    resolveLoad(fakeApi(() => ({ modules: fakeModules(true) })));
    await waitForPart(el, 'canvas');
    expect(el.getAttribute('aria-busy')).to.equal('false');
  });

  it('shows the missing-library error when the optional peer fails to load', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(el, null);
    el.value = 'hello';
    await waitForPart(el, 'error');
    const error = el.shadowRoot!.querySelector('[part="error"]')!;
    expect(error.getAttribute('role')).to.equal(null);
    expect(error.textContent).to.equal('This component needs the optional "qrcode" package installed to render QR codes.');
    expect(el.getAttribute('aria-busy')).to.equal('false');
    expect(assertiveAnnouncements()).to.deep.equal([
      'This component needs the optional "qrcode" package installed to render QR codes.',
    ]);
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
    expect(error.getAttribute('role')).to.equal(null);
    expect(error.textContent).to.equal('This value could not be encoded as a QR code.');
    el.value = 'hello again';
    await el.updateComplete;
    await waitUntil(() => assertiveAnnouncements().length === 2);
    expect(assertiveAnnouncements()).to.deep.equal([
      'This value could not be encoded as a QR code.',
      'This value could not be encoded as a QR code.',
    ]);
  });

  const malformedMatrixCases: ReadonlyArray<readonly [string, () => unknown]> = [
    ['a null create result', () => null],
    ['a missing modules object', () => ({})],
    ['a zero size', () => ({ modules: { size: 0, get: () => 0 } })],
    ['a fractional size', () => ({ modules: { size: 1.5, get: () => 0 } })],
    ['a non-finite size', () => ({ modules: { size: Number.NaN, get: () => 0 } })],
    ['more than the QR version-40 maximum', () => ({ modules: { size: 178, get: () => 0 } })],
    ['a missing module reader', () => ({ modules: { size: 1 } })],
    ['a non-bit module value', () => ({ modules: { size: 1, get: () => '1' } })],
    ['a throwing module reader', () => ({ modules: { size: 1, get: () => { throw new Error('hostile'); } } })],
    ['a hostile size getter', () => ({ modules: Object.defineProperty({}, 'size', { get(): never { throw new Error('hostile'); } }) })],
  ];

  for (const [name, result] of malformedMatrixCases) {
    it(`fails closed through the localized error state for ${name}`, async () => {
      const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
      installFakeLoader(el, fakeApi(result));
      el.value = 'malformed peer result';
      await waitForPart(el, 'error');
      expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
        'This value could not be encoded as a QR code.',
      );
      expect(el.getAttribute('aria-busy')).to.equal('false');
      expect(el.canvas.hidden).to.equal(true);
    });
  }

  it('clones the validated matrix once so peer mutation and hostile later reads cannot alter redraws', async () => {
    const bits = [0, 0, 0, 1];
    let reads = 0;
    const peerModules: FakeModules = {
      size: 2,
      get(row, col) {
        reads++;
        return bits[row * 2 + col]!;
      },
    };
    const el = (await fixture(html`
      <lr-qr-code size="40" style="color: #000; background-color: #fff"></lr-qr-code>
    `)) as LyraQrCode;
    installFakeLoader(el, fakeApi(() => ({ modules: peerModules })));
    el.value = 'owned snapshot';
    await waitForPart(el, 'canvas');
    expect(reads).to.equal(4);
    bits.fill(1);
    peerModules.get = () => { throw new Error('must not be read after normalization'); };
    expect(() => el.refreshTheme()).to.not.throw();
    expect(reads).to.equal(4);
    const lightCenter = Math.round(el.canvas.width * 0.25);
    expect([
      ...el.canvas.getContext('2d')!.getImageData(lightCenter, lightCenter, 1, 1).data.slice(0, 3),
    ]).to.deep.equal([255, 255, 255]);
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
    expect(el.canvas.hidden).to.equal(true);
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
    expect(el.canvas.hidden).to.equal(true);
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
    expect(el.shadowRoot!.querySelector('[part="error"]') == null).to.be.true;
  });

  it('restarts generation on reconnect when a pending result was discarded while detached', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    let resolveLoad!: (api: FakeQrCodeApi | null) => void;
    const pending = new Promise<FakeQrCodeApi | null>((resolve) => {
      resolveLoad = resolve;
    });
    let loads = 0;
    (el as unknown as { loadLibrary: () => Promise<FakeQrCodeApi | null> }).loadLibrary = () => {
      loads++;
      return pending;
    };
    el.value = 'reconnect';
    await waitForPart(el, 'loading');
    const parent = el.parentElement!;

    el.remove();
    resolveLoad(fakeApi(() => ({ modules: fakeModules(true) })));
    await aTimeout(20);
    expect(el.canvas.hidden).to.equal(true);

    parent.append(el);
    await waitForPart(el, 'canvas');
    expect(loads).to.equal(2);
  });

  it('renders a canvas sized to `size` CSS px with the pinned fixed-2x backing store', async () => {
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
    expect(parseInt(canvas.style.width, 10)).to.equal(90);
    expect(parseInt(canvas.style.height, 10)).to.equal(90);
    expect(canvas.width).to.equal(180);
    expect(canvas.height).to.equal(180);
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

  it('uses the host as the single semantic owner and resolves its default name from `value`', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'https://example.test';
    await waitForPart(el, 'canvas');
    expect(semanticInternals(el).role).to.equal('img');
    expect(semanticInternals(el).ariaLabel).to.equal('https://example.test');
    expect(el.canvas.getAttribute('role')).to.equal(null);
    expect(el.canvas.getAttribute('aria-label')).to.equal(null);
    expect(el.canvas.getAttribute('aria-hidden')).to.equal('true');
  });

  it('`label` overrides `value` for the accessible name', async () => {
    const el = (await fixture(html`<lr-qr-code label="My QR code"></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'https://example.test';
    await waitForPart(el, 'canvas');
    expect(semanticInternals(el).ariaLabel).to.equal('My QR code');
  });

  it('preserves an author host `aria-label` without duplicating it onto the canvas', async () => {
    const el = (await fixture(html`<lr-qr-code aria-label="Host label"></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'https://example.test';
    await waitForPart(el, 'canvas');
    expect(el.getAttribute('aria-label')).to.equal('Host label');
    expect(semanticInternals(el).ariaLabel).to.equal('https://example.test');
    expect(el.canvas.getAttribute('aria-label')).to.equal(null);
  });

  it('keeps host `aria-label` authoritative over the internals label fallback', async () => {
    const el = (await fixture(
      html`<lr-qr-code label="Label fallback" aria-label="Host label"></lr-qr-code>`,
    )) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'https://example.test';
    await waitForPart(el, 'canvas');
    expect(el.getAttribute('aria-label')).to.equal('Host label');
    expect(semanticInternals(el).ariaLabel).to.equal('Label fallback');
    expect(el.canvas.getAttribute('aria-label')).to.equal(null);
  });

  it('preserves an explicit empty host aria-label, updates it live, and keeps internals as the fallback', async () => {
    const el = (await fixture(
      html`<lr-qr-code label="Label fallback" aria-label=""></lr-qr-code>`,
    )) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'https://example.test';
    await waitForPart(el, 'canvas');
    expect(el.getAttribute('aria-label')).to.equal('');
    expect(semanticInternals(el).ariaLabel).to.equal('Label fallback');

    el.setAttribute('aria-label', 'Live QR label');
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal('Live QR label');
    expect(el.canvas.getAttribute('aria-label')).to.equal(null);

    el.removeAttribute('aria-label');
    await el.updateComplete;
    expect(el.getAttribute('aria-label')).to.equal(null);
    expect(semanticInternals(el).ariaLabel).to.equal('Label fallback');
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

  it('keeps a fixed 2x backing for size 127 independently of live DPR', async () => {
    const el = (await fixture(html`<lr-qr-code size="127"></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    const canvas = el.canvas;
    const originalDpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    try {
      for (const dpr of [1, 1.25, 2.625, 4]) {
        Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
        (el as unknown as { draw(): void }).draw();
        expect(canvas.width).to.equal(254);
        expect(canvas.height).to.equal(254);
      }
    } finally {
      if (originalDpr) Object.defineProperty(window, 'devicePixelRatio', originalDpr);
      else delete (window as unknown as { devicePixelRatio?: number }).devicePixelRatio;
    }
  });

  it('uses the adopted owner realm for observers, styles, images, and cleanup', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalIntersectionObserver = Object.getOwnPropertyDescriptor(
      frameWindow,
      'IntersectionObserver',
    );
    const originalImage = Object.getOwnPropertyDescriptor(frameWindow, 'Image');
    let observerConstructions = 0;
    let observerDisconnects = 0;
    let observedInOwnerRealm = false;
    class OwnerIntersectionObserver {
      constructor(_callback: IntersectionObserverCallback) {
        observerConstructions += 1;
      }
      observe(target: Element): void {
        observedInOwnerRealm = target.ownerDocument === frameDocument;
      }
      unobserve(): void {}
      disconnect(): void {
        observerDisconnects += 1;
      }
      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }
    }
    Object.defineProperty(frameWindow, 'IntersectionObserver', {
      configurable: true,
      value: OwnerIntersectionObserver,
    });

    const NativeOwnerImage = frameWindow.Image;
    let ownerImageConstructions = 0;
    const OwnerImage = new Proxy(NativeOwnerImage, {
      construct(target, argumentsList) {
        ownerImageConstructions += 1;
        return Reflect.construct(target, argumentsList);
      },
    });
    Object.defineProperty(frameWindow, 'Image', { configurable: true, value: OwnerImage });

    const el = document.createElement('lr-qr-code') as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.size = 40;
    try {
      document.body.append(el);
      await el.updateComplete;
      const initialCanvas = el.canvas;
      frameDocument.adoptNode(el);
      frameDocument.body.append(el);
      el.value = 'owner realm';
      await waitForPart(el, 'canvas');
      const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
      expect(canvas === initialCanvas).to.equal(true);
      expect(observerConstructions).to.equal(1);
      expect(observedInOwnerRealm).to.be.true;
      expect(canvas.width).to.equal(80);
      expect(canvas.height).to.equal(80);

      const originalGetComputedStyleDescriptor = Object.getOwnPropertyDescriptor(
        frameWindow,
        'getComputedStyle',
      );
      const originalGetComputedStyle = frameWindow.getComputedStyle.bind(frameWindow);
      let ownerStyleReads = 0;
      Object.defineProperty(frameWindow, 'getComputedStyle', {
        configurable: true,
        value: (element: Element, pseudo?: string | null) => {
          ownerStyleReads += 1;
          return originalGetComputedStyle(element, pseudo);
        },
      });
      try {
        el.refreshTheme();
        expect(ownerStyleReads).to.be.greaterThan(0);
      } finally {
        if (originalGetComputedStyleDescriptor) {
          Object.defineProperty(frameWindow, 'getComputedStyle', originalGetComputedStyleDescriptor);
        } else {
          delete (frameWindow as unknown as { getComputedStyle?: typeof getComputedStyle })
            .getComputedStyle;
        }
      }

      const embedded = await (
        el as unknown as {
          loadEmbeddedImage(src: string): Promise<HTMLImageElement | undefined>;
        }
      ).loadEmbeddedImage(RED_IMAGE_DATA);
      expect(ownerImageConstructions).to.equal(1);
      expect(embedded?.ownerDocument === frameDocument).to.be.true;
    } finally {
      el.remove();
      if (originalIntersectionObserver) {
        Object.defineProperty(frameWindow, 'IntersectionObserver', originalIntersectionObserver);
      } else {
        delete (frameWindow as unknown as { IntersectionObserver?: typeof IntersectionObserver })
          .IntersectionObserver;
      }
      if (originalImage) Object.defineProperty(frameWindow, 'Image', originalImage);
      else delete (frameWindow as unknown as { Image?: typeof Image }).Image;
      iframe.remove();
      expect(observerDisconnects).to.equal(1);
    }
  });

  it('restores visibility and redraws after reconnecting into a realm without IntersectionObserver', async () => {
    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalIntersectionObserver = Object.getOwnPropertyDescriptor(
      frameWindow,
      'IntersectionObserver',
    );
    Object.defineProperty(frameWindow, 'IntersectionObserver', {
      configurable: true,
      value: undefined,
    });

    const el = document.createElement('lr-qr-code') as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: fakeModules(true) })),
    );
    el.size = 90;
    try {
      document.body.append(el);
      el.value = 'reconnect without observer';
      await waitForPart(el, 'canvas');
      const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
      expect(parseInt(canvas.style.width, 10)).to.equal(90);

      (el as unknown as { visible: boolean }).visible = false;
      el.size = 150;
      await el.updateComplete;
      expect(parseInt(canvas.style.width, 10)).to.equal(90);

      frameDocument.adoptNode(el);
      frameDocument.body.append(el);
      await el.updateComplete;
      expect(parseInt(canvas.style.width, 10)).to.equal(150);
    } finally {
      el.remove();
      if (originalIntersectionObserver) {
        Object.defineProperty(frameWindow, 'IntersectionObserver', originalIntersectionObserver);
      } else {
        delete (frameWindow as unknown as { IntersectionObserver?: typeof IntersectionObserver })
          .IntersectionObserver;
      }
      iframe.remove();
    }
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

  it('warns once and falls back to #000000 for an invalid fill property', async () => {
    const el = (await fixture(
      html`<lr-qr-code fill="not-a-color"></lr-qr-code>`,
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

  for (const color of ['#010203', 'rgb(1 2 3)']) {
    it(`accepts the valid color ${color} when it collides with the first validation sentinel`, async () => {
      const el = (await fixture(html`<lr-qr-code size="90" .fill=${color}></lr-qr-code>`)) as LyraQrCode;
      installFakeLoader(el, fakeApi(() => ({ modules: fakeModules(true) })));
      el.value = 'hello';
      await waitForPart(el, 'canvas');
      const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
      const center = Math.round(canvas.width / 2);
      expect([...canvas.getContext('2d')!.getImageData(center, center, 1, 1).data.slice(0, 3)])
        .to.deep.equal([1, 2, 3]);
    });
  }

  it('paints a one-module symbol to every full-canvas edge without injecting a quiet zone', async () => {
    const el = (await fixture(html`
      <lr-qr-code size="40" style="color: #000; background-color: #fff"></lr-qr-code>
    `)) as LyraQrCode;
    installFakeLoader(el, fakeApi(() => ({ modules: fakeModules(true) })));
    el.value = 'full canvas';
    await waitForPart(el, 'canvas');
    const ctx = el.canvas.getContext('2d')!;
    for (const [x, y] of [
      [0, 0],
      [el.canvas.width - 1, 0],
      [0, el.canvas.height - 1],
      [el.canvas.width - 1, el.canvas.height - 1],
    ]) {
      expect([...ctx.getImageData(x!, y!, 1, 1).data.slice(0, 3)]).to.deep.equal([0, 0, 0]);
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
      fakeApi(() => ({ modules: mixedModules() })),
    );
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const darkCenter = Math.round(canvas.width * 0.75);
    const darkPixel = ctx.getImageData(darkCenter, darkCenter, 1, 1).data;
    expect([...darkPixel.slice(0, 3)]).to.deep.equal([0, 0, 0]);
    const bgCenter = Math.round(canvas.width * 0.25);
    const bgPixel = ctx.getImageData(bgCenter, bgCenter, 1, 1).data;
    expect([...bgPixel.slice(0, 3)]).to.deep.equal([255, 255, 255]);
  });

  it('uses standard host color/background-color for canvas paint', async () => {
    const el = (await fixture(html`
      <lr-qr-code size="90" style="color: rgb(255, 0, 0); background-color: rgb(0, 255, 0)"></lr-qr-code>
    `)) as LyraQrCode;
    installFakeLoader(el, fakeApi(() => ({ modules: mixedModules() })));
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const darkCenter = Math.round(canvas.width * 0.75);
    const lightCenter = Math.round(canvas.width * 0.25);
    expect([...ctx.getImageData(darkCenter, darkCenter, 1, 1).data.slice(0, 3)]).to.deep.equal([255, 0, 0]);
    expect([...ctx.getImageData(lightCenter, lightCenter, 1, 1).data.slice(0, 3)]).to.deep.equal([0, 255, 0]);
  });

  it('supports the permanent upstream fill/background properties', async () => {
    const el = (await fixture(html`
      <lr-qr-code size="90" fill="#ff0000" background="#00ff00"></lr-qr-code>
    `)) as LyraQrCode;
    installFakeLoader(el, fakeApi(() => ({ modules: mixedModules() })));
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const darkCenter = Math.round(canvas.width * 0.75);
    const lightCenter = Math.round(canvas.width * 0.25);
    expect([...ctx.getImageData(darkCenter, darkCenter, 1, 1).data.slice(0, 3)]).to.deep.equal([255, 0, 0]);
    expect([...ctx.getImageData(lightCenter, lightCenter, 1, 1).data.slice(0, 3)]).to.deep.equal([0, 255, 0]);
    expect(getComputedStyle(el).color).to.not.equal('rgb(255, 0, 0)');
    expect(getComputedStyle(el).backgroundColor).to.not.equal('rgb(0, 255, 0)');
  });

  it('safely draws a centered embedded image with background, coverage, and padding', async () => {
    let correction = '';
    const el = (await fixture(html`
      <lr-qr-code
        size="100"
        image=${RED_IMAGE_DATA}
        image-background="#0000ff"
        image-coverage="0.5"
        image-padding="5"
        error-correction="L"
        style="--lr-qr-code-fill:#000; --lr-qr-code-background:#fff"
      ></lr-qr-code>
    `)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi((_value, options) => {
        correction = options.errorCorrectionLevel;
        return { modules: fakeModules(true) };
      }),
    );
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    await waitUntil(
      () => Boolean((el as unknown as { loadState?: { image?: HTMLImageElement } }).loadState?.image),
    );
    await el.updateComplete;
    const canvas = el.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
    const ctx = canvas.getContext('2d')!;
    const backingScale = canvas.width / el.size;
    const center = Math.round(50 * backingScale);
    const padded = Math.round(27 * backingScale);
    expect([...ctx.getImageData(center, center, 1, 1).data.slice(0, 3)]).to.deep.equal([255, 0, 0]);
    expect([...ctx.getImageData(padded, center, 1, 1).data.slice(0, 3)]).to.deep.equal([0, 0, 255]);
    expect(correction).to.equal('H');
  });

  it('rejects an unsafe embedded-image URL without preventing the QR symbol from rendering', async () => {
    const el = (await fixture(html`
      <lr-qr-code image="javascript:alert(1)"></lr-qr-code>
    `)) as LyraQrCode;
    installFakeLoader(el, fakeApi(() => ({ modules: fakeModules(true) })));
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    await aTimeout(20);
    expect((el.shadowRoot!.querySelector('canvas')) != null).to.equal(true);
    expect(((el as unknown as { loadState: { image?: HTMLImageElement } }).loadState.image) === (undefined)).to.equal(true);
  });

  it('normalizes non-finite/out-of-range embedded-image geometry before drawing', async () => {
    const el = (await fixture(html`<lr-qr-code image=${RED_IMAGE_DATA}></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(el, fakeApi(() => ({ modules: fakeModules(true) })));
    el.imageCoverage = Number.POSITIVE_INFINITY;
    el.imagePadding = -100;
    el.value = 'hello';
    await waitForPart(el, 'canvas');
    await waitUntil(
      () => Boolean((el as unknown as { loadState?: { image?: HTMLImageElement } }).loadState?.image),
    );
    expect(() => (el as unknown as { draw(): void }).draw()).to.not.throw();
  });

  it('falls back to black fill and a transparent background when computed host colors are empty', async () => {
    const el = (await fixture(html`<lr-qr-code size="40"></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: mixedModules() })),
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
      const darkCenter = Math.round(canvas.width * 0.75);
      const darkPixel = ctx.getImageData(darkCenter, darkCenter, 1, 1).data;
      expect([...darkPixel.slice(0, 3)]).to.deep.equal([0, 0, 0]);
      const lightCenter = Math.round(canvas.width * 0.25);
      const bgPixel = ctx.getImageData(lightCenter, lightCenter, 1, 1).data;
      expect(bgPixel[3]).to.equal(0);
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
    expect(el.canvas.hidden).to.equal(true);
  });

  it('keeps the public canvas identity stable across loading, ready, empty, and reconnect', async () => {
    const el = (await fixture(html`<lr-qr-code></lr-qr-code>`)) as LyraQrCode;
    await el.updateComplete;
    const canvas = el.canvas;
    let resolveLoad!: (api: FakeQrCodeApi | null) => void;
    (el as unknown as { loadLibrary: () => Promise<FakeQrCodeApi | null> }).loadLibrary = () =>
      new Promise((resolve) => { resolveLoad = resolve; });
    el.value = 'stable';
    await waitForPart(el, 'loading');
    expect(el.canvas === canvas).to.equal(true);
    resolveLoad(fakeApi(() => ({ modules: fakeModules(true) })));
    await waitForPart(el, 'canvas');
    expect(el.canvas === canvas).to.equal(true);
    el.value = '';
    await waitForPart(el, 'empty');
    expect(el.canvas === canvas).to.equal(true);
    const parent = el.parentElement!;
    el.remove();
    parent.append(el);
    await el.updateComplete;
    expect(el.canvas === canvas).to.equal(true);
  });

  it('uses exact fixed-2x allocation ordinarily and caps extreme total pixels uniformly', () => {
    const allocate = (
      LyraQrCode as unknown as {
        canvasAllocation(size: number): {
          cssWidth: number;
          cssHeight: number;
          pixelWidth: number;
          pixelHeight: number;
          scale: number;
          scaleX: number;
          scaleY: number;
        };
      }
    ).canvasAllocation;
    expect(allocate(127)).to.deep.equal({
      cssWidth: 127,
      cssHeight: 127,
      pixelWidth: 254,
      pixelHeight: 254,
      scale: 2,
      scaleX: 2,
      scaleY: 2,
    });
    expect(allocate(127.5).pixelWidth).to.equal(255);
    expect(allocate(127.5).pixelHeight).to.equal(255);
    const capped = allocate(2048);
    expect(capped.pixelWidth).to.be.at.most(4096);
    expect(capped.pixelHeight).to.be.at.most(4096);
    expect(capped.pixelWidth * capped.pixelHeight).to.be.at.most(8_388_608);
    expect(capped.scaleX).to.equal(capped.pixelWidth / 2048);
    expect(capped.scaleY).to.equal(capped.pixelHeight / 2048);
    const hostile = allocate(Number.POSITIVE_INFINITY);
    expect(Number.isFinite(hostile.scale)).to.equal(true);
    expect(hostile.pixelWidth).to.equal(2);
    expect(hostile.pixelHeight).to.equal(2);
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
    expect(canvas.getContext('2d') !== null).to.equal(true);
  });

  it('rejects a zero-size peer matrix through the localized error state', async () => {
    const el = (await fixture(html`<lr-qr-code size="40"></lr-qr-code>`)) as LyraQrCode;
    installFakeLoader(
      el,
      fakeApi(() => ({ modules: { size: 0, get: () => 0 } })),
    );
    el.value = 'hello';
    await waitForPart(el, 'error');
    expect(el.shadowRoot!.querySelector('[part="error"]')!.textContent).to.equal(
      'This value could not be encoded as a QR code.',
    );
    expect(el.canvas.hidden).to.equal(true);
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
    const backingScale = canvas.width / el.size;
    // The full canvas is the 2x2 matrix: module (1,1) centers at CSS (30,30), while the light
    // module (0,0) centers at CSS (10,10).
    const darkCenter = Math.round(30 * backingScale);
    const darkPixel = ctx.getImageData(darkCenter, darkCenter, 1, 1).data;
    expect([...darkPixel.slice(0, 3)]).to.deep.equal([0, 0, 0]);
    const lightCenter = Math.round(10 * backingScale);
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
