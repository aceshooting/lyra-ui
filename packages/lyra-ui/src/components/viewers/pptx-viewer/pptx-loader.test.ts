import { expect } from '@open-wc/testing';
import { getPptxRenderer, loadPptxRenderer, __setPptxRendererForTesting } from './pptx-loader.js';

afterEach(() => __setPptxRendererForTesting(undefined));

describe('pptx loader', () => {
  it('normalizes named, default-wrapped, and mixed module shapes capability-first', async () => {
    const named = { PptxViewer: { open() {} }, RECOMMENDED_ZIP_LIMITS: { source: 'named' } };
    const fallback = { PptxViewer: { open() {} }, RECOMMENDED_ZIP_LIMITS: { source: 'default' } };

    expect(await loadPptxRenderer(async () => named as never)).to.equal(named);
    expect(
      await loadPptxRenderer(async () => ({ default: fallback }) as never),
    ).to.equal(fallback);
    const mixed = await loadPptxRenderer(async () => ({ ...named, default: fallback }) as never);
    expect(mixed!.PptxViewer).to.equal(named.PptxViewer);
    expect(mixed!.RECOMMENDED_ZIP_LIMITS).to.equal(named.RECOMMENDED_ZIP_LIMITS);
  });

  it('falls back from a malformed named capability and fails closed when neither shape can open', async () => {
    const fallback = { PptxViewer: { open() {} }, RECOMMENDED_ZIP_LIMITS: { source: 'default' } };
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

  it('loads the installed renderer module', async function () {
    this.timeout(60_000);
    const module = await loadPptxRenderer();
    expect(module).to.not.be.null;
    expect(module!.PptxViewer).to.exist;
    expect(module!.RECOMMENDED_ZIP_LIMITS).to.exist;
  });

  it('returns null for an unavailable peer and caches successful loads', async () => {
    const error = new Error('missing');
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    try {
      expect(await loadPptxRenderer(() => Promise.reject(error))).to.be.null;
    } finally {
      console.warn = originalWarn;
    }
    expect(warnings.flat()).to.contain(error);
    expect(warnings.flat().join(' ')).to.contain('@aiden0z/pptx-renderer');
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
