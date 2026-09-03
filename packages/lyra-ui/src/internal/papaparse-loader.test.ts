import { expect } from '@open-wc/testing';
import { clearPapaParseCache, loadPapaParse, loadPapaParseCached } from './papaparse-loader.js';

afterEach(() => clearPapaParseCache());

it('loads and caches the real papaparse API, shared across every caller', async () => {
  const first = await loadPapaParseCached();
  const second = await loadPapaParseCached();
  expect(first).to.not.equal(null);
  expect(first!.parse).to.exist;
  expect(second).to.equal(first);
});

it('supports an injected import and both the default-export and bare-module shapes', async () => {
  const fake = { parse: () => ({ data: [] }), unparse: () => '' };
  expect(await loadPapaParse(() => Promise.resolve({ default: fake }))).to.equal(fake);
  expect(await loadPapaParse(() => Promise.resolve(fake))).to.equal(fake);
});

it('returns null with one fixed dev diagnostic that never includes importer failures', async () => {
  const importError = new Error('papaparse boom; row-99');
  const originalWarn = console.warn;
  const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
  const originalIssuedWarnings = runtime.litIssuedWarnings;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  runtime.litIssuedWarnings = new Set();
  try {
    expect(await loadPapaParse(() => Promise.reject(importError))).to.equal(null);
    expect(await loadPapaParse(() => Promise.reject(new Error('second failure')))).to.equal(null);
    expect(calls).to.have.length(1);
    const message = calls.flat().map(String).join(' ');
    expect(message).to.equal('A lyra-ui component could not load its optional papaparse peer.');
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
    expect(await loadPapaParse(() => Promise.reject(new Error('production secret')))).to.equal(null);
    expect(calls).to.have.length(0);
  } finally {
    console.warn = originalWarn;
    if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
    else runtime.litIssuedWarnings = originalIssuedWarnings;
  }
});
