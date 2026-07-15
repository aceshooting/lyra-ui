import { expect } from '@open-wc/testing';
import { clearPapaParseCache, loadPapaParse, loadPapaParseDeps } from './dataset-loader.js';

afterEach(() => clearPapaParseCache());

it('loads papaparse and caches the resolved module', async () => {
  const first = await loadPapaParse();
  const second = await loadPapaParse();
  expect(first).to.not.equal(null);
  expect(first!.parse).to.exist;
  expect(second).to.equal(first);
});

it('returns null and logs the import error when papaparse is unavailable', async () => {
  const importError = new Error('papaparse boom');
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    expect(await loadPapaParseDeps(() => Promise.reject(importError))).to.equal(null);
    expect(calls.flat()).to.contain(importError);
    expect(calls.flat().join(' ')).to.contain('pnpm add papaparse');
  } finally {
    console.warn = originalWarn;
  }
});
