import { expect } from '@open-wc/testing';
import { clearHtmlSanitizerCache, loadHtmlSanitizer, loadHtmlSanitizerDeps } from './dompurify-loader.js';

afterEach(() => clearHtmlSanitizerCache());

it('loads dompurify and caches the resolved module', async () => {
  const first = await loadHtmlSanitizer();
  const second = await loadHtmlSanitizer();
  expect(first).to.not.equal(null);
  expect(first!.sanitize).to.exist;
  expect(second).to.equal(first);
});

it('falls back to the bare module namespace when the dynamic import has no .default', async () => {
  const bareModule = { sanitize: (value: string) => value };
  const resolved = await loadHtmlSanitizerDeps(() => Promise.resolve(bareModule));
  expect(resolved).to.equal(bareModule);
});

it('returns null and logs the import error when dompurify is unavailable', async () => {
  const importError = new Error('dompurify boom');
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    expect(await loadHtmlSanitizerDeps(() => Promise.reject(importError))).to.equal(null);
    expect(calls.flat()).to.contain(importError);
    expect(calls.flat().join(' ')).to.contain('pnpm add dompurify');
  } finally {
    console.warn = originalWarn;
  }
});
