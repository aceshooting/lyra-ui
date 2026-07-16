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

it('returns null and warns (mentioning the install command) when the peer is unavailable', async () => {
  const importError = new Error('papaparse boom');
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    expect(await loadPapaParse(() => Promise.reject(importError))).to.equal(null);
    expect(calls.flat()).to.contain(importError);
    expect(calls.flat().join(' ')).to.contain('pnpm add papaparse');
  } finally {
    console.warn = originalWarn;
  }
});
