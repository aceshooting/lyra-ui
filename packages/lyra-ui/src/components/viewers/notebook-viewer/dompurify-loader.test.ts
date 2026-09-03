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

it('returns null with one fixed dev diagnostic that never includes importer failures', async () => {
  const importError = new Error('dompurify boom; notebook-secret');
  const originalWarn = console.warn;
  const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
  const originalIssuedWarnings = runtime.litIssuedWarnings;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  runtime.litIssuedWarnings = new Set();
  try {
    expect(await loadNotebookSanitizerDeps(() => Promise.reject(importError))).to.equal(null);
    expect(await loadNotebookSanitizerDeps(() => Promise.reject(new Error('second failure')))).to.equal(null);
    expect(calls).to.have.length(1);
    const message = calls.flat().map(String).join(' ');
    expect(message).to.equal('<lr-notebook-viewer> could not load its optional dompurify peer.');
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
    expect(await loadNotebookSanitizerDeps(() => Promise.reject(new Error('production secret')))).to.equal(null);
    expect(calls).to.have.length(0);
  } finally {
    console.warn = originalWarn;
    if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
    else runtime.litIssuedWarnings = originalIssuedWarnings;
  }
});

// Different bundler/interop configurations resolve a CJS-published optional peer as either
// `{ default: X }` or the bare module namespace -- assuming only the `.default` shape silently
// substitutes `undefined` for the real sanitizer under the other resolution, which then makes
// every ensureSanitized() call fail closed even though the real dependency IS installed.
//
// NEVER assert `expect(result).to.equal(bareApi)` here: a *failing* assertion whose actual/expected
// is an object carrying a function property (like `sanitize`) hangs the whole wtr session the same
// way a DOM node does -- structuredClone() (used to ship the failure message off-page) throws on
// functions too, not just DOM nodes. Compare identity via a boolean instead.
it('falls back to the bare module namespace when the resolved module has no usable .default (cross-bundler interop)', async () => {
  const bareApi = { sanitize: (value: string) => value };
  const result = await loadNotebookSanitizerDeps(() => Promise.resolve(bareApi as unknown as { default: typeof bareApi }));
  expect(result === bareApi).to.equal(true);
});

// A `.default` that exists but isn't actually the sanitizer API (e.g. an interop shim exposing an
// unrelated `default` re-export) must not be trusted just because the key is present.
it('falls back to the module namespace when .default exists but is not a usable sanitizer', async () => {
  const bareApi = { sanitize: (value: string) => value, default: {} };
  const result = await loadNotebookSanitizerDeps(() => Promise.resolve(bareApi as unknown as { default: typeof bareApi }));
  expect(result === bareApi).to.equal(true);
});
