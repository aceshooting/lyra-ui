import { expect } from '@open-wc/testing';
import { clearNotebookSanitizerCache, loadNotebookSanitizer, loadNotebookSanitizerDeps } from './dompurify-loader.js';

afterEach(() => clearNotebookSanitizerCache());

it('loads dompurify and caches the resolved module', async () => {
  const first = await loadNotebookSanitizer();
  const second = await loadNotebookSanitizer();
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
    expect(await loadNotebookSanitizerDeps(() => Promise.reject(importError))).to.equal(null);
    expect(calls.flat()).to.contain(importError);
    expect(calls.flat().join(' ')).to.contain('pnpm add dompurify');
  } finally {
    console.warn = originalWarn;
  }
});
