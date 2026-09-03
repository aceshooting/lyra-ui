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

it('returns null with one fixed dev diagnostic that never includes importer failures', async () => {
  const importError = new Error('dompurify boom; svg-secret');
  const originalWarn = console.warn;
  const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
  const originalIssuedWarnings = runtime.litIssuedWarnings;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  runtime.litIssuedWarnings = new Set();
  try {
    expect(await loadSvgSanitizerDeps(() => Promise.reject(importError))).to.equal(null);
    expect(await loadSvgSanitizerDeps(() => Promise.reject(new Error('second failure')))).to.equal(null);
    expect(calls).to.have.length(1);
    const message = calls.flat().map(String).join(' ');
    expect(message).to.equal('<lr-svg-viewer> could not load its optional dompurify peer.');
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
    expect(await loadSvgSanitizerDeps(() => Promise.reject(new Error('production secret')))).to.equal(null);
    expect(calls).to.have.length(0);
  } finally {
    console.warn = originalWarn;
    if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
    else runtime.litIssuedWarnings = originalIssuedWarnings;
  }
});
