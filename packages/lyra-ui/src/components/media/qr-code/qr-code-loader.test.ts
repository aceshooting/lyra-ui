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

  it('prefers a valid namespace capability over a malformed default export', async () => {
    const fake = { ...fakeQrCodeModule(), default: { create: 'not callable' } };
    expect(await loadQrCode(() => Promise.resolve(fake))).to.equal(fake);
  });

  for (const [name, malformed] of [
    ['null', null],
    ['an empty namespace', {}],
    ['a non-callable namespace create', { create: true }],
    ['a malformed default export', { default: { create: true } }],
  ] as const) {
    it(`fails closed when the imported peer is ${name}`, async () => {
      expect(await loadQrCode(() => Promise.resolve(malformed))).to.equal(null);
    });
  }

  it('fails closed and warns when an interop wrapper exposes a hostile capability getter', async () => {
    const hostile = Object.defineProperty({}, 'create', {
      get(): never {
        throw new Error('hostile create');
      },
    });
    const originalWarn = console.warn;
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    runtime.litIssuedWarnings = new Set();
    try {
      expect(await loadQrCode(() => Promise.resolve(hostile))).to.equal(null);
      expect(calls).to.have.length(1);
      expect(calls.flat().join(' ')).to.equal('<lr-qr-code> could not load its optional qrcode peer.');
    } finally {
      console.warn = originalWarn;
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
    }
  });

  it('returns null with one fixed dev diagnostic that never includes the import error', async () => {
    const importError = new Error('qrcode boom; account-99');
    const originalWarn = console.warn;
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    runtime.litIssuedWarnings = new Set();
    try {
      expect(await loadQrCode(() => Promise.reject(importError))).to.equal(null);
      expect(await loadQrCode(() => Promise.reject(new Error('second failure')))).to.equal(null);
      expect(calls).to.have.length(1);
      const message = calls.flat().map(String).join(' ');
      expect(message).to.equal('<lr-qr-code> could not load its optional qrcode peer.');
      expect(message).to.not.contain(importError.message);
      expect(message).to.not.contain('second failure');
    } finally {
      console.warn = originalWarn;
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
    }
  });

  it('stays silent when Lit development diagnostics are unavailable', async () => {
    const originalWarn = console.warn;
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    delete runtime.litIssuedWarnings;
    try {
      expect(await loadQrCode(() => Promise.reject(new Error('production secret')))).to.equal(null);
      expect(calls).to.have.length(0);
    } finally {
      console.warn = originalWarn;
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
    }
  });

  it('loadQrCodeCached() shares one promise across every caller (not just one resolved value)', async () => {
    // No injected importer here -- loadQrCodeCached() always uses the module's real default
    // `() => import('qrcode')`. What's under test is that the *promise itself* is shared -- i.e.
    // the underlying importer only ever runs once regardless of how many callers ask -- not what
    // it resolves to (see the skipped test below for why this environment can't assert that part).
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
      const first = loadQrCodeCached();
      const second = loadQrCodeCached();
      expect(second).to.equal(first);
      await first;
    } finally {
      console.warn = originalWarn;
    }
  });

  // A "caches the real optional module result" test (importing the actual `qrcode` package with
  // no injected fake, and asserting a real, non-null resolution -- mirroring pdf-loader.test.ts's
  // 4th test) is intentionally skipped rather than asserted either way: the `qrcode` peer is not
  // directly available to this browser runner: `qrcode`'s browser entry is genuine multi-file
  // CommonJS with no single-file browser bundle, so @web/test-runner's esbuild-based pipeline
  // cannot currently resolve it without additional CJS-interop wiring (a
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
