import { assertOptionalPeerSilent } from '../../../../test/contracts/optional-peer-loader.js';
import { expect } from '@open-wc/testing';
import { clearQrCodeCache, loadQrCode, loadQrCodeCached } from './qr-code-loader.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';

// Tests below deliberately make the optional peer unavailable or malformed; the loader's one-time diagnostic is expected.
expectDevWarning('lyra-qr-code-peer-unavailable');

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
    await assertOptionalPeerSilent(() => loadQrCode(() => Promise.reject(new Error('production secret'))));
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
});
