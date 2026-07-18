import { expect } from '@open-wc/testing';
import { getPptxRenderer, loadPptxRenderer, __setPptxRendererForTesting } from './pptx-loader.js';

afterEach(() => __setPptxRendererForTesting(undefined));

describe('pptx loader', () => {
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
