import { expect } from '@open-wc/testing';
import { clearEmailDepsCache, getEmailDepsIfLoaded, loadEmailAndSanitizer, loadEmailDeps } from './email-loader.js';

afterEach(() => clearEmailDepsCache());

describe('email loader', () => {
  it('loads the real postal-mime and DOMPurify APIs', async () => {
    const deps = await loadEmailDeps();
    expect(deps.PostalMime?.parse).to.exist;
    expect(deps.DOMPurify?.sanitize).to.exist;
  });

  it('caches the resolved object and exposes it synchronously', async () => {
    const first = await loadEmailDeps();
    const second = await loadEmailDeps();
    expect(first).to.equal(second);
    expect(getEmailDepsIfLoaded()).to.equal(second);
  });

  it('loads each peer independently', async () => {
    const error = new Error('postal boom');
    const originalWarn = console.warn;
    const warnings: unknown[][] = [];
    console.warn = (...args: unknown[]) => warnings.push(args);
    let deps: Awaited<ReturnType<typeof loadEmailAndSanitizer>>;
    try {
      deps = await loadEmailAndSanitizer(
        () => Promise.reject(error),
        () => Promise.resolve({ default: { sanitize: (value: string) => value } }),
      );
    } finally {
      console.warn = originalWarn;
    }
    expect(deps.PostalMime).to.be.undefined;
    expect(deps.DOMPurify?.sanitize).to.exist;
    expect(warnings.flat()).to.contain(error);
    expect(warnings.flat().join(' ')).to.contain('pnpm add postal-mime');
  });

  it('preserves postal-mime when DOMPurify fails and logs install fixes', async () => {
    const error = new Error('purify boom');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      const deps = await loadEmailAndSanitizer(
        () => Promise.resolve({ default: { parse: () => Promise.resolve({}) } }),
        () => Promise.reject(error),
      );
      expect(deps.PostalMime?.parse).to.exist;
      expect(deps.DOMPurify).to.be.undefined;
      expect(calls.flat()).to.contain(error);
      expect(calls.flat().join(' ')).to.contain('pnpm add dompurify');
    } finally {
      console.warn = originalWarn;
    }
  });
});
