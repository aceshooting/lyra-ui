import { expect } from '@open-wc/testing';
import {
  adaptPptxViewer,
  getPptxRenderer,
  loadPptxRenderer,
  __setPptxRendererForTesting,
} from './pptx-loader.js';

afterEach(() => __setPptxRendererForTesting(undefined));

function zipLimits(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    maxEntries: 4_000,
    maxEntryUncompressedBytes: 32 * 1024 * 1024,
    maxTotalUncompressedBytes: 256 * 1024 * 1024,
    maxMediaBytes: 192 * 1024 * 1024,
    maxConcurrency: 8,
    ...overrides,
  };
}

describe('pptx loader', () => {
  it('adapts only complete window-safe viewer instances', () => {
    const complete = Object.assign(new EventTarget(), {
      slideCount: 2,
      currentSlideIndex: 0,
      goToSlide() {},
      searchText: () => [],
      highlightSearchResult: async () => null,
      renderThumbnailToContainer: () => ({ ready: Promise.resolve(), dispose() {} }),
      clearSearchHighlights() {},
      destroy() {},
    });
    const adapter = adaptPptxViewer(complete);
    expect(adapter).to.not.equal(complete);
    expect(adapter?.slideCount).to.equal(2);
    expect(adapter?.currentSlideIndex).to.equal(0);
    for (const key of ['goToSlide', 'searchText', 'highlightSearchResult', 'renderThumbnailToContainer', 'clearSearchHighlights', 'destroy'] as const) {
      expect(adaptPptxViewer({ ...complete, [key]: undefined }), key).to.be.null;
    }
    expect(adaptPptxViewer({ ...complete, slideCount: Number.POSITIVE_INFINITY })).to.be.null;
  });

  it('normalizes peer events into correlated adapter status and removes listeners on destroy', () => {
    let destroyed = 0;
    const raw = Object.assign(new EventTarget(), {
      slideCount: 3,
      currentSlideIndex: 0,
      goToSlide() {},
      searchText: () => [],
      highlightSearchResult: async () => null,
      renderThumbnailToContainer: () => ({ ready: Promise.resolve(), dispose() {} }),
      clearSearchHighlights() {},
      destroy: () => { destroyed++; },
    });
    const adapter = adaptPptxViewer(raw)!;
    const events: unknown[] = [];
    adapter.subscribe((event) => events.push(event));
    raw.dispatchEvent(new CustomEvent('slidechange', { detail: { index: 2 } }));
    raw.dispatchEvent(new CustomEvent('slideerror', {
      detail: { index: 1, error: 'slide', fatal: true },
    }));
    raw.dispatchEvent(new CustomEvent('nodeerror', {
      detail: { nodeId: 'chart-4', error: 'node' },
    }));
    expect(events).to.deep.equal([
      { kind: 'slide-change', index: 2 },
      {
        kind: 'diagnostic',
        code: 'pptx-slide-render-error',
        cause: 'slide',
        fatal: true,
        page: 2,
      },
      {
        kind: 'diagnostic',
        code: 'pptx-node-render-error',
        cause: 'node',
        fatal: false,
        nodeId: 'chart-4',
      },
    ]);

    raw.dispatchEvent(new CustomEvent('slideerror', {
      detail: { index: 99, error: 'unknown slide' },
    }));
    raw.dispatchEvent(new CustomEvent('nodeerror', {
      detail: { nodeId: 'x'.repeat(1_025), error: 'unknown node' },
    }));
    expect(events[3]).to.deep.equal({
      kind: 'diagnostic',
      code: 'pptx-slide-render-error',
      cause: 'unknown slide',
      fatal: false,
    });
    expect(events[4]).to.deep.equal({
      kind: 'diagnostic',
      code: 'pptx-node-render-error',
      cause: 'unknown node',
      fatal: false,
    });
    adapter.destroy();
    const unsubscribeAfterDestroy = adapter.subscribe((event) => events.push(event));
    unsubscribeAfterDestroy();
    adapter.destroy();
    raw.dispatchEvent(new CustomEvent('slidechange', { detail: { index: 1 } }));
    expect(events).to.have.lengthOf(5);
    expect(destroyed).to.equal(1);
  });

  it('rejects primitive and callable values that do not expose viewer capabilities', () => {
    expect(adaptPptxViewer(null)).to.equal(null);
    expect(adaptPptxViewer('viewer')).to.equal(null);
    expect(adaptPptxViewer(() => undefined)).to.equal(null);
  });

  it('validates thumbnail requests and wraps renderer-owned handles with idempotent disposal', async () => {
    let renders = 0;
    let disposals = 0;
    const raw = Object.assign(new EventTarget(), {
      slideCount: 2,
      currentSlideIndex: 0,
      goToSlide() {},
      searchText: () => [],
      highlightSearchResult: async () => null,
      renderThumbnailToContainer(index: number, container: HTMLElement, options?: { width?: number }) {
        renders++;
        container.dataset['request'] = `${index}:${options?.width}`;
        return { ready: Promise.resolve(), dispose: () => { disposals++; } };
      },
      clearSearchHighlights() {},
      destroy() {},
    });
    const adapter = adaptPptxViewer(raw)!;
    const container = document.createElement('div');
    expect(adapter.renderThumbnailToContainer(-1, container)).to.be.null;
    expect(adapter.renderThumbnailToContainer(2, container)).to.be.null;
    expect(adapter.renderThumbnailToContainer(0, container, { width: Number.NaN })).to.be.null;
    expect(renders).to.equal(0);

    const handle = adapter.renderThumbnailToContainer(1, container, { width: 80 })!;
    await handle.ready;
    expect(container.dataset['request']).to.equal('1:80');
    handle.dispose();
    handle.dispose();
    expect(disposals).to.equal(1);
  });
  it('normalizes named, default-wrapped, and mixed module shapes capability-first', async () => {
    const named = { PptxViewer: { open() {} }, RECOMMENDED_ZIP_LIMITS: zipLimits({ source: 'named' }) };
    const fallback = { PptxViewer: { open() {} }, RECOMMENDED_ZIP_LIMITS: zipLimits({ source: 'default' }) };

    expect(await loadPptxRenderer(async () => named as never)).to.equal(named);
    expect(
      await loadPptxRenderer(async () => ({ default: fallback }) as never),
    ).to.equal(fallback);
    const mixed = await loadPptxRenderer(async () => ({ ...named, default: fallback }) as never);
    expect(mixed!.PptxViewer as unknown).to.equal(named.PptxViewer);
    expect(mixed!.RECOMMENDED_ZIP_LIMITS).to.equal(named.RECOMMENDED_ZIP_LIMITS);
  });

  it('falls back from a malformed named capability and fails closed when neither shape can open', async () => {
    const fallback = { PptxViewer: { open() {} }, RECOMMENDED_ZIP_LIMITS: zipLimits({ source: 'default' }) };
    expect(
      await loadPptxRenderer(async () => ({ PptxViewer: undefined, default: fallback }) as never),
    ).to.equal(fallback);
    expect(
      await loadPptxRenderer(async () => ({
        PptxViewer: { open: 'not callable' },
        default: { PptxViewer: {} },
      }) as never),
    ).to.be.null;
  });

  it('fails closed when ZIP limits are missing, malformed, or more permissive than Lyra permits', async () => {
    const open = () => {};
    const malformedLimits = [
      undefined,
      null,
      {},
      zipLimits({ maxEntries: '4000' }),
      zipLimits({ maxEntryUncompressedBytes: Number.POSITIVE_INFINITY }),
      zipLimits({ maxTotalUncompressedBytes: 0 }),
      zipLimits({ maxMediaBytes: -1 }),
      zipLimits({ maxConcurrency: 1.5 }),
      zipLimits({ maxEntries: 4_001 }),
      zipLimits({ maxEntryUncompressedBytes: (32 * 1024 * 1024) + 1 }),
      zipLimits({ maxTotalUncompressedBytes: (256 * 1024 * 1024) + 1 }),
      zipLimits({ maxMediaBytes: (192 * 1024 * 1024) + 1 }),
      zipLimits({ maxConcurrency: 9 }),
    ];

    for (const limits of malformedLimits) {
      expect(
        await loadPptxRenderer(async () => ({
          PptxViewer: { open },
          RECOMMENDED_ZIP_LIMITS: limits,
        }) as never),
      ).to.be.null;
    }
  });

  it('uses a safe default export when the named renderer omits required ZIP limits', async () => {
    const fallback = { PptxViewer: { open() {} }, RECOMMENDED_ZIP_LIMITS: zipLimits() };
    expect(
      await loadPptxRenderer(async () => ({
        PptxViewer: { open() {} },
        default: fallback,
      }) as never),
    ).to.equal(fallback);
  });

  it('loads the installed renderer module', async function () {
    this.timeout(60_000);
    const module = await loadPptxRenderer();
    expect(module).to.not.be.null;
    expect((module!.PptxViewer) != null).to.equal(true);
    expect(module!.RECOMMENDED_ZIP_LIMITS).to.exist;
  });

  it('returns null with one fixed dev diagnostic that never includes importer failures', async () => {
    const error = new Error('missing; pptx-secret');
    const originalWarn = console.warn;
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    runtime.litIssuedWarnings = new Set();
    try {
      expect(await loadPptxRenderer(() => Promise.reject(error))).to.be.null;
      expect(await loadPptxRenderer(() => Promise.reject(new Error('second failure')))).to.be.null;
    } finally {
      console.warn = originalWarn;
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
    }
    expect(warnings).to.have.length(1);
    const message = warnings.flat().map(String).join(' ');
    expect(message).to.equal('<lr-pptx-viewer> could not load its optional @aiden0z/pptx-renderer peer.');
    expect(message).to.not.contain(error.message);
    expect(message).to.not.contain('second failure');
  });

  it('stays silent when Lit development diagnostics are unavailable', async () => {
    const originalWarn = console.warn;
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    delete runtime.litIssuedWarnings;
    try {
      expect(await loadPptxRenderer(() => Promise.reject(new Error('production secret')))).to.be.null;
      expect(warnings).to.have.length(0);
    } finally {
      console.warn = originalWarn;
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
    }
  });

  it('caches successful loads', async () => {
    const fake = { PptxViewer: class {}, RECOMMENDED_ZIP_LIMITS: {} } as never;
    __setPptxRendererForTesting(fake);
    expect(await getPptxRenderer()).to.equal(fake);
    expect(await getPptxRenderer()).to.equal(fake);
  });

  it('opens the real vendored PPTX fixture', async function () {
    this.timeout(60_000);
    const module = await loadPptxRenderer();
    const response = await fetch(new URL('./fixtures/table-stale-frame.pptx', import.meta.url));
    expect(response.ok).to.be.true;
    const container = document.createElement('div');
    document.body.append(container);
    try {
      const viewer = await module!.PptxViewer.open(await response.arrayBuffer(), container, {
        zipLimits: module!.RECOMMENDED_ZIP_LIMITS,
        listOptions: { windowed: true },
      });
      expect(viewer.slideCount).to.equal(1);
      expect(container.childElementCount).to.be.greaterThan(0);
      viewer.destroy();
    } finally {
      container.remove();
    }
  });

});
