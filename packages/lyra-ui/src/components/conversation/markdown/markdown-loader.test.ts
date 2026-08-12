import { expect } from '@open-wc/testing';
import { loadMarkdownDeps, loadMarkdownAndSanitizer, getMarkdownDepsIfLoaded } from './markdown-loader.js';
import { preloadMarkdown } from './markdown.js';

class UsableMarked {
  readonly defaults: Record<string, unknown> = {};

  use(): this {
    return this;
  }

  parse(): string {
    return '';
  }
}

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

it('exports preloadMarkdown as the stable public cache-warming entry point', () => {
  expect(preloadMarkdown).to.equal(loadMarkdownDeps);
});

it('getMarkdownDepsIfLoaded() returns the same resolved deps synchronously once loadMarkdownDeps() has settled', async () => {
  const awaited = await loadMarkdownDeps();
  const sync = getMarkdownDepsIfLoaded();
  expect(sync).to.equal(awaited);
});

describe('loadMarkdownAndSanitizer (independent marked / dompurify loading)', () => {
  it('resolves a Marked constructor from a default-wrapped module namespace', async () => {
    class WrappedMarked extends UsableMarked {}
    const wrappedModule = { default: { Marked: WrappedMarked } };

    const deps = await loadMarkdownAndSanitizer(
      () => Promise.resolve(wrappedModule),
      () => Promise.resolve({ sanitize: (html: string) => html }),
    );

    expect(deps.marked).to.equal(wrappedModule.default);
  });

  it('prefers a usable Marked capability on the module namespace over its default export', async () => {
    class NamespaceMarked extends UsableMarked {}
    class DefaultMarked extends UsableMarked {}
    const module = {
      Marked: NamespaceMarked,
      default: { Marked: DefaultMarked },
    };

    const deps = await loadMarkdownAndSanitizer(
      () => Promise.resolve(module),
      () => Promise.resolve({ sanitize: (html: string) => html }),
    );

    expect(deps.marked).to.equal(module);
  });

  it('falls back to a usable default export when the namespace constructor lacks the parser capability', async () => {
    class MissingParse {
      readonly defaults: Record<string, unknown> = {};
      use(): this {
        return this;
      }
    }
    class DefaultMarked extends UsableMarked {}
    const module = {
      Marked: MissingParse,
      default: { Marked: DefaultMarked },
    };

    const deps = await loadMarkdownAndSanitizer(
      () => Promise.resolve(module),
      () => Promise.resolve({ sanitize: (html: string) => html }),
    );

    expect(deps.marked === module.default).to.be.true;
  });

  it('fails closed when the Marked instance lacks defaults', async () => {
    class MissingDefaults {
      use(): this {
        return this;
      }
      parse(): string {
        return '';
      }
    }

    const deps = await loadMarkdownAndSanitizer(
      () => Promise.resolve({ Marked: MissingDefaults }),
      () => Promise.resolve({ sanitize: (html: string) => html }),
    );

    expect(deps.marked === undefined).to.be.true;
  });

  it('fails closed when the Marked instance use member is not callable', async () => {
    class NonCallableUse {
      readonly defaults: Record<string, unknown> = {};
      readonly use = 'not callable';
      parse(): string {
        return '';
      }
    }

    const deps = await loadMarkdownAndSanitizer(
      () => Promise.resolve({ Marked: NonCallableUse }),
      () => Promise.resolve({ sanitize: (html: string) => html }),
    );

    expect(deps.marked === undefined).to.be.true;
  });

  it('fails closed when the Marked instance parse member is not callable', async () => {
    class NonCallableParse {
      readonly defaults: Record<string, unknown> = {};
      readonly parse = 'not callable';
      use(): this {
        return this;
      }
    }

    const deps = await loadMarkdownAndSanitizer(
      () => Promise.resolve({ Marked: NonCallableParse }),
      () => Promise.resolve({ sanitize: (html: string) => html }),
    );

    expect(deps.marked === undefined).to.be.true;
  });

  it('rejects a Marked constructor that throws and still resolves a usable default export', async () => {
    class ThrowingMarked {
      constructor() {
        throw new Error('constructor boom');
      }
    }
    class DefaultMarked extends UsableMarked {}
    const module = {
      Marked: ThrowingMarked,
      default: { Marked: DefaultMarked },
    };

    const deps = await loadMarkdownAndSanitizer(
      () => Promise.resolve(module),
      () => Promise.resolve({ sanitize: (html: string) => html }),
    );

    expect(deps.marked === module.default).to.be.true;
  });

  it('fails closed when a default-wrapped marked peer lacks a usable constructor', async () => {
    const deps = await loadMarkdownAndSanitizer(
      () => Promise.resolve({ default: { Marked: 'not callable' } }),
      () => Promise.resolve({ sanitize: (html: string) => html }),
    );

    expect(deps.marked).to.equal(undefined);
  });

  it('still resolves dompurify when marked fails to load — content still renders sanitized-but-empty rather than every markdown surface breaking', async () => {
    const markedError = new Error('marked boom');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      const deps = await loadMarkdownAndSanitizer(
        () => Promise.reject(markedError),
        () => import('dompurify'),
      );
      expect(deps.marked).to.equal(undefined);
      expect(deps.DOMPurify).to.not.equal(undefined);
      expect(calls.flat()).to.contain(markedError);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('still resolves marked when dompurify fails to load — a sanitize="false" consumer does not need dompurify at all', async () => {
    const purifyError = new Error('dompurify boom');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      const deps = await loadMarkdownAndSanitizer(
        () => import('marked'),
        () => Promise.reject(purifyError),
      );
      expect(deps.marked).to.not.equal(undefined);
      expect(deps.DOMPurify).to.equal(undefined);
      expect(calls.flat()).to.contain(purifyError);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('falls back to the bare module namespace when the dompurify import resolves with no .default (module-shape interop)', async () => {
    // Different bundler/interop configurations resolve a CJS-published optional peer as either
    // `{ default: X }` or the bare module namespace -- reading only `.default` would silently
    // substitute `undefined` for the real sanitizer under the other resolution.
    const bareDompurifyModule = { sanitize: (html: string) => html, version: 'fake' };
    const deps = await loadMarkdownAndSanitizer(
      () => import('marked'),
      () => Promise.resolve(bareDompurifyModule),
    );
    expect(deps.DOMPurify).to.equal(bareDompurifyModule);
  });

  it('resolves both as undefined when both peers fail to load', async () => {
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      const deps = await loadMarkdownAndSanitizer(
        () => Promise.reject(new Error('marked boom')),
        () => Promise.reject(new Error('dompurify boom')),
      );
      expect(deps.marked).to.equal(undefined);
      expect(deps.DOMPurify).to.equal(undefined);
      expect(calls).to.have.length(2);
    } finally {
      console.warn = originalWarn;
    }
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
