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

it('supports injected imports and reports a missing peer', async () => {
  const fake = { read: () => null, utils: {} };
  expect(await loadSheetJs(() => Promise.resolve(fake))).to.equal(fake);
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    expect(await loadSheetJs(() => Promise.reject(new Error('xlsx boom')))).to.equal(null);
    expect(calls.flat().join(' ')).to.contain('pnpm add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz');
  } finally { console.warn = originalWarn; }
});
