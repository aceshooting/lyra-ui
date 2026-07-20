import { expect } from '@open-wc/testing';
import { clearSvgSanitizerCache, loadSvgSanitizer, loadSvgSanitizerDeps } from './dompurify-loader.js';

afterEach(() => clearSvgSanitizerCache());

it('loads dompurify and caches the resolved module', async () => {
  const first = await loadSvgSanitizer();
  const second = await loadSvgSanitizer();
  expect(first).to.not.equal(null);
  expect(first!.sanitize).to.exist;
  expect(second).to.equal(first);
});

function fakeDompurifyModule(): { sanitize: () => string } {
  return { sanitize: () => '<svg></svg>' };
}

it('resolves an injected module directly when it already exposes `.sanitize`', async () => {
  // Regression test: under a bundler/interop resolution that returns the bare module namespace
  // (no `.default`) rather than `{ default: X }`, the loader previously fell straight to
  // `.default` and silently resolved `undefined` -- the sanitizer that stands between fetched
  // remote SVG markup and unsafe inline rendering would then silently no-op instead of failing
  // closed into the documented 'missing sanitizer' error state.
  const fake = fakeDompurifyModule();
  expect(await loadSvgSanitizerDeps(() => Promise.resolve(fake))).to.equal(fake);
});

it('unwraps an injected `{ default }` CJS-interop shape', async () => {
  const fake = fakeDompurifyModule();
  expect(await loadSvgSanitizerDeps(() => Promise.resolve({ default: fake }))).to.equal(fake);
});

it('returns null and logs the import error when dompurify is unavailable', async () => {
  const importError = new Error('dompurify boom');
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    expect(await loadSvgSanitizerDeps(() => Promise.reject(importError))).to.equal(null);
    expect(calls.flat()).to.contain(importError);
    expect(calls.flat().join(' ')).to.contain('pnpm add dompurify');
  } finally {
    console.warn = originalWarn;
  }
});
