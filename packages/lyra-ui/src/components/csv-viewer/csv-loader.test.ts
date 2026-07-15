import { expect } from '@open-wc/testing';
import { clearPapaParseCache, loadPapaParse, loadPapaParseCached } from './csv-loader.js';

afterEach(() => clearPapaParseCache());

it('loads and caches the real papaparse API', async () => {
  const first = await loadPapaParseCached();
  const second = await loadPapaParseCached();
  expect(first).to.not.equal(null);
  expect(first!.parse).to.exist;
  expect(first!.unparse).to.exist;
  expect(second).to.equal(first);
});

it('supports injected imports and reports a missing peer', async () => {
  const fake = { parse: () => ({ data: [] }), unparse: () => '' };
  expect(await loadPapaParse(() => Promise.resolve({ default: fake }))).to.equal(fake);
  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  try {
    expect(await loadPapaParse(() => Promise.reject(new Error('papaparse boom')))).to.equal(null);
    expect(calls.flat().join(' ')).to.contain('pnpm add papaparse');
  } finally { console.warn = originalWarn; }
});
