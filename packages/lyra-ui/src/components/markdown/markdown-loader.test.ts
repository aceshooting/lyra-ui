import { expect } from '@open-wc/testing';
import { loadMarkdownDeps, loadMarkdownAndSanitizer, getMarkdownDepsIfLoaded } from './markdown-loader.js';

it('resolves both the marked and dompurify modules', async () => {
  const deps = await loadMarkdownDeps();
  expect(deps.marked).to.not.equal(undefined);
  expect(deps.marked!.Marked).to.exist;
  expect(deps.DOMPurify).to.not.equal(undefined);
  expect(deps.DOMPurify!.sanitize).to.exist;
});

it('caches the module — a second call returns the same promise result', async () => {
  const a = await loadMarkdownDeps();
  const b = await loadMarkdownDeps();
  expect(a).to.equal(b);
});

it('getMarkdownDepsIfLoaded() returns the same resolved deps synchronously once loadMarkdownDeps() has settled', async () => {
  const awaited = await loadMarkdownDeps();
  const sync = getMarkdownDepsIfLoaded();
  expect(sync).to.equal(awaited);
});

describe('loadMarkdownAndSanitizer (independent marked / dompurify loading)', () => {
  it('still resolves dompurify when marked fails to load — content still renders sanitized-but-empty rather than every markdown surface breaking', async () => {
    const markedError = new Error('marked boom');
    const deps = await loadMarkdownAndSanitizer(
      () => Promise.reject(markedError),
      () => import('dompurify'),
    );
    expect(deps.marked).to.equal(undefined);
    expect(deps.DOMPurify).to.not.equal(undefined);
  });

  it('still resolves marked when dompurify fails to load — a sanitize="false" consumer does not need dompurify at all', async () => {
    const purifyError = new Error('dompurify boom');
    const deps = await loadMarkdownAndSanitizer(
      () => import('marked'),
      () => Promise.reject(purifyError),
    );
    expect(deps.marked).to.not.equal(undefined);
    expect(deps.DOMPurify).to.equal(undefined);
  });

  it('resolves both as undefined when both peers fail to load', async () => {
    const deps = await loadMarkdownAndSanitizer(
      () => Promise.reject(new Error('marked boom')),
      () => Promise.reject(new Error('dompurify boom')),
    );
    expect(deps.marked).to.equal(undefined);
    expect(deps.DOMPurify).to.equal(undefined);
  });

  it('logs the real caught error (not a generic message) when marked fails to load', async () => {
    const markedError = new Error('specific marked failure reason');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      await loadMarkdownAndSanitizer(
        () => Promise.reject(markedError),
        () => import('dompurify'),
      );
    } finally {
      console.warn = originalWarn;
    }
    expect(calls.flat()).to.contain(markedError);
  });

  it('logs the real caught error (not a generic message) when dompurify fails to load', async () => {
    const purifyError = new Error('specific dompurify failure reason');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      await loadMarkdownAndSanitizer(
        () => import('marked'),
        () => Promise.reject(purifyError),
      );
    } finally {
      console.warn = originalWarn;
    }
    expect(calls.flat()).to.contain(purifyError);
  });
});
