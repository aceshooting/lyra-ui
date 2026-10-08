import { expect } from '@open-wc/testing';
import {
  clearDocxDepsCache,
  getDocxDepsIfLoaded,
  loadDocxDeps,
  loadMammothAndSanitizer,
} from './docx-loader.js';

afterEach(() => clearDocxDepsCache());

function captureDevWarnings(): { calls: unknown[][]; restore: () => void } {
  const originalWarn = console.warn;
  const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
  const originalIssuedWarnings = runtime.litIssuedWarnings;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  runtime.litIssuedWarnings = new Set();
  return {
    calls,
    restore() {
      console.warn = originalWarn;
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
    },
  };
}

describe('loadMammothAndSanitizer()', () => {
  it('loads both peers independently', async () => {
    const deps = await loadMammothAndSanitizer(
      () => Promise.resolve({ default: { convertToHtml: () => Promise.resolve({ value: '', messages: [] }) } }),
      () => Promise.resolve({ default: { sanitize: (html: string) => html } }),
    );
    expect(deps.mammoth?.convertToHtml).to.exist;
    expect(deps.DOMPurify?.sanitize).to.exist;
  });

  it('accepts a bare module namespace that already satisfies the capability, with no .default wrapper', async () => {
    // Both peers ship in bundler/CJS-interop configurations where the dynamic import resolves to
    // the namespace carrying the named API directly, with no `default` re-export at all. The
    // shared resolveOptionalPeerCapability() checks that namespace BEFORE falling back to
    // `.default`; every other case in this file wraps its fake in `{ default: ... }`, so without
    // this case a regression that only ever read `.default` would leave both peers undefined and
    // silently disable DOCX rendering (and, for the sanitizer, sanitization) with no test failing.
    const bareMammoth = { convertToHtml: () => Promise.resolve({ value: '', messages: [] }) };
    const bareSanitizer = { sanitize: (html: string) => html };
    const deps = await loadMammothAndSanitizer(
      () => Promise.resolve(bareMammoth),
      () => Promise.resolve(bareSanitizer),
    );
    expect(deps.mammoth === bareMammoth).to.equal(true);
    expect(deps.DOMPurify === bareSanitizer).to.equal(true);
  });

  it('accepts callable peer namespaces when their required methods are present', async () => {
    const callableMammoth = Object.assign(() => undefined, {
      convertToHtml: () => Promise.resolve({ value: '', messages: [] }),
    });
    const callableSanitizer = Object.assign(() => undefined, {
      sanitize: (html: string) => html,
    });
    const deps = await loadMammothAndSanitizer(
      () => Promise.resolve(callableMammoth),
      () => Promise.resolve(callableSanitizer),
    );

    expect(deps.mammoth).to.equal(callableMammoth);
    expect(deps.DOMPurify).to.equal(callableSanitizer);
  });

  it('keeps DOMPurify available when mammoth fails, and warns once without the import error', async () => {
    const error = new Error('mammoth boom');
    const { calls, restore } = captureDevWarnings();
    try {
      const deps = await loadMammothAndSanitizer(
        () => Promise.reject(error),
        () => Promise.resolve({ default: { sanitize: (html: string) => html } }),
      );
      expect(deps.mammoth).to.be.undefined;
      expect(deps.DOMPurify).to.exist;
      expect(calls.flat().map(String).join(' ')).to.equal('<lr-docx-viewer> could not load its optional mammoth peer.');
    } finally {
      restore();
    }
  });

  it('keeps mammoth available when DOMPurify fails', async () => {
    const { calls, restore } = captureDevWarnings();
    try {
      const deps = await loadMammothAndSanitizer(
        () => Promise.resolve({ default: { convertToHtml: () => Promise.resolve({ value: '', messages: [] }) } }),
        () => Promise.reject(new Error('dompurify boom')),
      );
      expect(deps.mammoth).to.exist;
      expect(deps.DOMPurify).to.be.undefined;
      expect(calls.flat().map(String).join(' ')).to.equal('A lyra-ui component could not load its optional dompurify peer.');
    } finally {
      restore();
    }
  });
});

describe('loadDocxDeps()', () => {
  it('loads the real APIs', async () => {
    const deps = await loadDocxDeps();
    expect(deps.mammoth?.convertToHtml).to.exist;
    expect(deps.DOMPurify?.sanitize).to.exist;
  });

  it('caches the resolved object', async () => {
    const first = await loadDocxDeps();
    const second = await loadDocxDeps();
    expect(first).to.equal(second);
    expect(getDocxDepsIfLoaded()).to.equal(second);
  });
});
