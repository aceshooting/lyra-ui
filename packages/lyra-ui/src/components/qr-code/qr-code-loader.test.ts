import { expect } from '@open-wc/testing';
import { clearQrCodeCache, loadQrCode, loadQrCodeCached } from './qr-code-loader.js';

afterEach(() => clearQrCodeCache());

function fakeQrCodeModule(): { create: () => unknown } {
  return { create: () => ({ modules: { size: 1, get: () => 1 } }) };
}

describe('loadQrCode()', () => {
  it('resolves an injected module directly when it already exposes `.create`', async () => {
    const fake = fakeQrCodeModule();
    expect(await loadQrCode(() => Promise.resolve(fake))).to.equal(fake);
  });

  it('unwraps an injected `{ default }` CJS-interop shape', async () => {
    const fake = fakeQrCodeModule();
    expect(await loadQrCode(() => Promise.resolve({ default: fake }))).to.equal(fake);
  });

  it('returns null and logs the import error when `qrcode` is unavailable', async () => {
    const importError = new Error('qrcode boom');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      expect(await loadQrCode(() => Promise.reject(importError))).to.equal(null);
      expect(calls.flat()).to.contain(importError);
      expect(calls.flat().join(' ')).to.contain('lr-qr-code');
      expect(calls.flat().join(' ')).to.contain('pnpm add qrcode');
    } finally {
      console.warn = originalWarn;
    }
  });

  it('loadQrCodeCached() shares one promise across every caller (not just one resolved value)', async () => {
    // No injected importer here -- loadQrCodeCached() always uses the module's real default
    // `() => import('qrcode')`. What's under test is that the *promise itself* is shared -- i.e.
    // the underlying importer only ever runs once regardless of how many callers ask -- not what
    // it resolves to (see the skipped test below for why this environment can't assert that part).
    const first = loadQrCodeCached();
    const second = loadQrCodeCached();
    expect(second).to.equal(first);
  });

  // A "caches the real optional module result" test (importing the actual `qrcode` package with
  // no injected fake, and asserting a real, non-null resolution -- mirroring pdf-loader.test.ts's
  // 4th test) is intentionally skipped rather than asserted either way: the `qrcode` peer is not
  // installed in this workspace (it's an optional peer this component only assumes, per its own
  // contract), and `qrcode`'s browser entry is genuine multi-file CommonJS with no single-file
  // browser bundle, so it is not yet known whether @web/test-runner's esbuild-based pipeline can
  // resolve/interop it once it *is* installed without additional CJS-interop wiring (a
  // `@rollup/plugin-commonjs` + `@web/dev-server-rollup` addition to web-test-runner.config.js is
  // the likely fix, scoped to `qrcode`'s own directory, but that is a centralized-config change
  // outside this component's own files). Every other loader behavior above is covered against an
  // injected fake, so this is real coverage's only gap.
  it.skip('caches the real optional module result', async () => {
    const first = await loadQrCodeCached();
    const second = await loadQrCodeCached();
    expect(second).to.equal(first);
  });
});
