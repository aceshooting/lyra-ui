import { expect } from '@open-wc/testing';
import { clearSheetJsCache, loadSheetJs, loadSheetJsCached } from './spreadsheet-loader.js';

afterEach(() => clearSheetJsCache());

it('loads and caches the real xlsx API', async () => {
  const first = await loadSheetJsCached();
  const second = await loadSheetJsCached();
  expect(first).to.not.equal(null);
  expect(first!.read).to.exist;
  expect(first!.utils.sheet_to_json).to.exist;
  expect(second).to.equal(first);
});

it('supports injected imports and fails closed for an incomplete peer', async () => {
  const fake = { read: () => null, utils: { sheet_to_json: () => [] } };
  expect(await loadSheetJs(() => Promise.resolve(fake)) as unknown).to.equal(fake);
  expect(await loadSheetJs(() => Promise.resolve({ default: fake })) as unknown).to.equal(fake);
  const mixed = { ...fake, default: { read: () => null, utils: {} } };
  expect(await loadSheetJs(() => Promise.resolve(mixed as never)) as unknown).to.equal(mixed);
  const incomplete = { read: () => null, utils: {} };
  expect(await loadSheetJs(() => Promise.resolve(incomplete as never))).to.equal(null);
});

it('returns null with one fixed dev diagnostic that never includes importer failures', async () => {
  const importError = new Error('xlsx boom; workbook-secret');
  const originalWarn = console.warn;
  const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
  const originalIssuedWarnings = runtime.litIssuedWarnings;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  runtime.litIssuedWarnings = new Set();
  try {
    expect(await loadSheetJs(() => Promise.reject(importError))).to.equal(null);
    expect(await loadSheetJs(() => Promise.reject(new Error('second failure')))).to.equal(null);
    expect(calls).to.have.length(1);
    const message = calls.flat().map(String).join(' ');
    expect(message).to.equal('<lr-spreadsheet-viewer> could not load its optional xlsx peer.');
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
    expect(await loadSheetJs(() => Promise.reject(new Error('production secret')))).to.equal(null);
    expect(calls).to.have.length(0);
  } finally {
    console.warn = originalWarn;
    if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
    else runtime.litIssuedWarnings = originalIssuedWarnings;
  }
});
