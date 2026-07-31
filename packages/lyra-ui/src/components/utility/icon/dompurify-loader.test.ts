import { expect } from '@open-wc/testing';
import { clearIconSanitizerCache, loadIconSanitizer, loadIconSanitizerDeps } from './dompurify-loader.js';

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

it('returns null and logs the import error when dompurify is unavailable', async () => {
  const importError = new Error('dompurify boom');
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    expect(await loadIconSanitizerDeps(() => Promise.reject(importError))).to.equal(null);
    expect(calls.flat()).to.contain(importError);
    expect(calls.flat().join(' ')).to.contain('pnpm add dompurify');
  } finally {
    console.warn = originalWarn;
  }
});

it('consults the injected importer only while the shared cache is cold', async () => {
  const fake = fakeDompurifyModule();
  const other = fakeDompurifyModule();
  expect(await loadIconSanitizer(() => Promise.resolve(fake))).to.equal(fake);
  expect(await loadIconSanitizer(() => Promise.resolve(other))).to.equal(fake);
  clearIconSanitizerCache();
  expect(await loadIconSanitizer(() => Promise.resolve(other))).to.equal(other);
});
