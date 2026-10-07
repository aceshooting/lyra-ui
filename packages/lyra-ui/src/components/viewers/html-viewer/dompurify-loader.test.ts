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

it('returns null with one fixed dev diagnostic that never includes importer failures', async () => {
  const importError = new Error('dompurify boom; html-secret');
  const originalWarn = console.warn;
  const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
  const originalIssuedWarnings = runtime.litIssuedWarnings;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  runtime.litIssuedWarnings = new Set();
  try {
    expect(await loadHtmlSanitizerDeps(() => Promise.reject(importError))).to.equal(null);
    expect(await loadHtmlSanitizerDeps(() => Promise.reject(new Error('second failure')))).to.equal(null);
    expect(calls).to.have.length(1);
    expect(calls.flat().map(String).join(' ')).to.equal('A lyra-ui component could not load its optional dompurify peer.');
  } finally {
    console.warn = originalWarn;
    if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
    else runtime.litIssuedWarnings = originalIssuedWarnings;
  }
});
