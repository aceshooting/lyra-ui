import { expect } from '@open-wc/testing';
import {
  clearDocxDepsCache,
  getDocxDepsIfLoaded,
  loadDocxDeps,
  loadMammothAndSanitizer,
} from './docx-loader.js';

afterEach(() => clearDocxDepsCache());

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

  it('keeps DOMPurify available when mammoth fails', async () => {
    const error = new Error('mammoth boom');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      const deps = await loadMammothAndSanitizer(
        () => Promise.reject(error),
        () => Promise.resolve({ default: { sanitize: (html: string) => html } }),
      );
      expect(deps.mammoth).to.be.undefined;
      expect(deps.DOMPurify).to.exist;
      expect(calls.flat()).to.contain(error);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('keeps mammoth available when DOMPurify fails', async () => {
    const error = new Error('dompurify boom');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      const deps = await loadMammothAndSanitizer(
        () => Promise.resolve({ default: { convertToHtml: () => Promise.resolve({ value: '', messages: [] }) } }),
        () => Promise.reject(error),
      );
      expect(deps.mammoth).to.exist;
      expect(deps.DOMPurify).to.be.undefined;
      expect(calls.flat()).to.contain(error);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('names the component and install fixes in warnings', async () => {
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      await loadMammothAndSanitizer(() => Promise.reject(new Error('boom')), () => Promise.reject(new Error('boom')));
      const message = calls.flat().filter((value): value is string => typeof value === 'string').join(' ');
      expect(message).to.contain('lr-docx-viewer');
      expect(message).to.contain('pnpm add mammoth');
      expect(message).to.contain('pnpm add dompurify');
    } finally {
      console.warn = originalWarn;
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
