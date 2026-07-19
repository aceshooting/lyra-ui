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
