import { assertOptionalPeerSilent } from '../../../../test/contracts/optional-peer-loader.js';
import { expect } from '@open-wc/testing';
import { clearIconSanitizerCache, loadIconSanitizer, loadIconSanitizerDeps } from './dompurify-loader.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';

// Tests below deliberately make the optional peer unavailable or malformed; the loader's one-time diagnostic is expected.
expectDevWarning('lyra-dompurify-unavailable');

afterEach(() => clearIconSanitizerCache());

it('loads dompurify and caches the resolved module', async () => {
  const first = await loadIconSanitizer();
  const second = await loadIconSanitizer();
  expect(first).to.not.equal(null);
  expect(first!.sanitize).to.exist;
  expect(second).to.equal(first);
});

function fakeDompurifyModule(): { sanitize: () => string } {
  return { sanitize: () => '<svg></svg>' };
}

it('resolves an injected module directly when it already exposes `.sanitize`', async () => {
  // Under a bundler/interop resolution that returns the bare module namespace (no `.default`),
  // reading `.default` alone resolves `undefined` — the sanitizer standing between fetched icon
  // markup and the DOM would then silently no-op instead of failing closed.
  const fake = fakeDompurifyModule();
  expect(await loadIconSanitizerDeps(() => Promise.resolve(fake))).to.equal(fake);
});

it('unwraps an injected `{ default }` CJS-interop shape', async () => {
  const fake = fakeDompurifyModule();
  expect(await loadIconSanitizerDeps(() => Promise.resolve({ default: fake }))).to.equal(fake);
});

it('rejects a module that cannot sanitize rather than returning it', async () => {
  expect(await loadIconSanitizerDeps(() => Promise.resolve({ default: {} }))).to.equal(null);
  expect(await loadIconSanitizerDeps(() => Promise.resolve({}))).to.equal(null);
});

it('returns null with one fixed dev diagnostic that never includes importer failures', async () => {
  const importError = new Error('dompurify boom; account-99');
  const originalWarn = console.warn;
  const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
  const originalIssuedWarnings = runtime.litIssuedWarnings;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  runtime.litIssuedWarnings = new Set();
  try {
    expect(await loadIconSanitizerDeps(() => Promise.reject(importError))).to.equal(null);
    expect(await loadIconSanitizerDeps(() => Promise.reject(new Error('second failure')))).to.equal(null);
    expect(calls).to.have.length(1);
    const message = calls.flat().map(String).join(' ');
    expect(message).to.equal('A lyra-ui component could not load its optional dompurify peer.');
    expect(message).to.not.contain(importError.message);
    expect(message).to.not.contain('second failure');
  } finally {
    console.warn = originalWarn;
    if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
    else runtime.litIssuedWarnings = originalIssuedWarnings;
  }
});

it('stays silent when Lit development diagnostics are unavailable', async () => {
  await assertOptionalPeerSilent(() => loadIconSanitizerDeps(() => Promise.reject(new Error('production secret'))));
});

it('loads an injected importer uncached and leaves the shared cache untouched', async () => {
  const fake = fakeDompurifyModule();
  const other = fakeDompurifyModule();
  expect(await loadIconSanitizer(() => Promise.resolve(fake))).to.equal(fake);
  expect(await loadIconSanitizer(() => Promise.resolve(other))).to.equal(other);
});
