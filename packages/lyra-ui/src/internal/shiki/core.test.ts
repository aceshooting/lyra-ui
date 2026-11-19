import { expect } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { captureDevWarnings } from '../../../test/expected-dev-warnings.js';
import {
  __resetShikiCoreEngineForTesting,
  __setShikiHighlighterCoreLoaderForTesting,
  ensureShikiLanguageLoaded,
  isShikiHighlighter,
  loadShikiHighlighterCore,
  normalizeShikiLanguage,
  resolvedShikiLanguages,
  setShikiCoreEngine,
  SHIKI_THEMES,
  type ShikiHighlighterCore,
  type ShikiLanguageLoader,
  type ShikiLanguageRegistration,
} from './core.js';

const LAZY_WARNING =
  'Lyra syntax highlighting could not load a lazy `languages` grammar loader. That language renders as plain text.';
const CORE_WARNING =
  'Lyra syntax highlighting failed to build a fine-grained shiki highlighter from the supplied grammars. Code is rendered as plain text.';

let grammarSequence = 0;
function uniqueGrammar(): ShikiLanguageRegistration {
  const name = `lyra-internal-shiki-${++grammarSequence}`;
  return { name, scopeName: `source.${name}`, patterns: [{ match: 'alpha', name: 'keyword.control' }] };
}

function deepFrozen<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFrozen(child);
    Object.freeze(value);
  }
  return value;
}

function recordingCore(failLoads = 0): ShikiHighlighterCore & { loads: unknown[] } {
  const loads: unknown[] = [];
  return {
    loads,
    codeToHtml: () => '',
    getLoadedLanguages: () => [],
    async loadLanguage(grammar) {
      loads.push(grammar);
      if (loads.length <= failLoads) throw new Error('grammar rejected');
    },
  };
}

function dispose(core: ShikiHighlighterCore | null): void {
  (core as (ShikiHighlighterCore & { dispose?: () => void }) | null)?.dispose?.();
}

afterEach(() => {
  __resetShikiCoreEngineForTesting();
  __setShikiHighlighterCoreLoaderForTesting(undefined);
});

describe('ensureShikiLanguageLoaded', () => {
  it('shares one attempt, evicts a rejected loader and retries on the next request', async () => {
    const core = recordingCore();
    const grammar = uniqueGrammar();
    let attempts = 0;
    const loader: ShikiLanguageLoader = () => ++attempts === 1
      ? Promise.reject(new Error('chunk unavailable'))
      : Promise.resolve({ default: grammar });
    const warnings = await captureDevWarnings(async () => {
      const first = ensureShikiLanguageLoaded(core, 'demo', loader);
      expect(ensureShikiLanguageLoaded(core, 'demo', loader) === first, 'concurrent requests share the attempt').to.equal(true);
      expect(await first).to.equal(false);
      expect(await ensureShikiLanguageLoaded(core, 'demo', loader)).to.equal(true);
      expect(await ensureShikiLanguageLoaded(core, 'demo', loader)).to.equal(true);
    });
    expect(attempts, 'the success is cached; only the failure is retried').to.equal(2);
    expect(core.loads.length).to.equal(1);
    expect(core.loads[0] === grammar).to.equal(true);
    expect(warnings).to.deep.equal([LAZY_WARNING]);
  });

  it('retries a grammar the core rejected, and keeps keys and cores independent', async () => {
    const core = recordingCore(1);
    const other = recordingCore();
    const grammar = uniqueGrammar();
    const loader: ShikiLanguageLoader = () => Promise.resolve([grammar]);
    await captureDevWarnings(async () => {
      expect(await ensureShikiLanguageLoaded(core, 'demo', loader)).to.equal(false);
      expect(await ensureShikiLanguageLoaded(core, 'demo', loader)).to.equal(true);
      expect(await ensureShikiLanguageLoaded(other, 'demo', loader)).to.equal(true);
      expect(await ensureShikiLanguageLoaded(core, 'alias', loader)).to.equal(true);
    });
    expect(core.loads.length).to.equal(3);
    expect(other.loads.length).to.equal(1);
  });

  it('resolves a concrete grammar without loading anything', async () => {
    const core = recordingCore();
    expect(await ensureShikiLanguageLoaded(core, 'demo', uniqueGrammar())).to.equal(true);
    expect(core.loads.length).to.equal(0);
  });

  it('aliases a lazily loaded grammar under its requested key in a built core', async function () {
    this.timeout(60_000);
    const core = await loadShikiHighlighterCore({});
    expect(core).to.not.equal(null);
    try {
      const grammar = uniqueGrammar();
      expect(await ensureShikiLanguageLoaded(core!, 'custom-key', () => Promise.resolve(grammar))).to.equal(true);
      expect(core!.codeToHtml('alpha', { lang: 'custom-key', themes: SHIKI_THEMES })).to.match(/<span style="[^"]*">alpha<\/span>/);
    } finally {
      dispose(core);
    }
  });
});

describe('loadShikiHighlighterCore', () => {
  it('builds one core per languages identity, under an author key the grammar does not declare', async function () {
    this.timeout(60_000);
    const grammar = uniqueGrammar();
    const languages = { 'author-key': grammar };
    const pending = loadShikiHighlighterCore(languages);
    expect(loadShikiHighlighterCore(languages) === pending).to.equal(true);
    const core = await pending;
    try {
      expect(isShikiHighlighter(core)).to.equal(true);
      expect(core!.codeToHtml('alpha', { lang: 'author-key', themes: SHIKI_THEMES })).to.match(/<span style="[^"]*">alpha<\/span>/);
    } finally {
      dispose(core);
    }
  });

  it('reuses a core for an equal frozen grammar map but not for a different one', async function () {
    this.timeout(60_000);
    const grammar = deepFrozen(uniqueGrammar());
    const first = await loadShikiHighlighterCore(Object.freeze({ demo: grammar }));
    const equal = await loadShikiHighlighterCore(deepFrozen({ demo: structuredClone(grammar) }));
    const different = await loadShikiHighlighterCore(deepFrozen({ demo: uniqueGrammar() }));
    try {
      expect(first !== null && equal === first).to.equal(true);
      expect(different !== null && different !== first).to.equal(true);
    } finally {
      dispose(first);
      dispose(different);
    }
  });

  it('keeps identity-only reuse for frozen grammar data it cannot prove equal', async function () {
    this.timeout(120_000);
    class Opaque {}
    const nested = (depth: number): unknown => depth === 0 ? 'leaf' : { next: nested(depth - 1) };
    const variants: readonly [string, () => unknown, () => unknown][] = [
      ['a function value', () => () => undefined, () => () => undefined],
      ['a symbol value', () => Symbol('a'), () => Symbol('a')],
      ['a changed value type', () => 'one', () => 1],
      ['nesting past the depth limit', () => nested(40), () => nested(40)],
      ['a non-plain prototype', () => new Opaque(), () => new Opaque()],
      ['an array-like object against an array', () => Object.setPrototypeOf({}, Array.prototype), () => []],
    ];
    for (const [label, left, right] of variants) {
      const grammar = uniqueGrammar();
      const first = await loadShikiHighlighterCore(deepFrozen({ demo: { ...grammar, extra: right() } }));
      const second = await loadShikiHighlighterCore(deepFrozen({ demo: { ...grammar, extra: left() } }));
      try {
        expect(first !== null && second !== null && second !== first, label).to.equal(true);
      } finally {
        dispose(first);
        dispose(second);
      }
    }
  });

  it('skips an undefined languages entry while deriving aliases for its siblings', async function () {
    this.timeout(60_000);
    const grammar = uniqueGrammar();
    const core = await loadShikiHighlighterCore({ missing: undefined, 'sibling-key': grammar } as never);
    try {
      expect(core!.codeToHtml('alpha', { lang: 'sibling-key', themes: SHIKI_THEMES })).to.match(/<span style="[^"]*">alpha<\/span>/);
    } finally {
      dispose(core);
    }
  });

  it('retries a rejected engine and warns once', async function () {
    this.timeout(60_000);
    let calls = 0;
    setShikiCoreEngine(() => {
      if (++calls === 1) throw new Error('engine asset unavailable');
      return createJavaScriptRegexEngine() as never;
    });
    const languages = { json: jsonGrammar };
    let core: ShikiHighlighterCore | null = null;
    const warnings = await captureDevWarnings(async () => {
      expect(await loadShikiHighlighterCore(languages)).to.equal(null);
      core = await loadShikiHighlighterCore(languages);
    });
    try {
      expect(isShikiHighlighter(core)).to.equal(true);
      expect(calls).to.equal(2);
      expect(warnings).to.deep.equal([CORE_WARNING]);
    } finally {
      dispose(core);
    }
  });

  it('routes every request through an installed test loader', async () => {
    const core = recordingCore();
    const seen: unknown[] = [];
    __setShikiHighlighterCoreLoaderForTesting(async (languages) => { seen.push(languages); return core; });
    const languages = { json: jsonGrammar };
    expect(await loadShikiHighlighterCore(languages) === core).to.equal(true);
    expect(seen.length === 1 && seen[0] === languages).to.equal(true);
  });

  it('accepts only the javascript preset or a factory', () => {
    expect(() => setShikiCoreEngine('oniguruma' as never)).to.throw(TypeError);
    expect(() => setShikiCoreEngine('javascript')).to.not.throw();
  });
});

describe('peer-neutral helpers', () => {
  it('normalizes filename-style language ids and narrows highlighter candidates', () => {
    expect(normalizeShikiLanguage('  .TSX ')).to.equal('tsx');
    expect(isShikiHighlighter(recordingCore())).to.equal(true);
    expect(isShikiHighlighter(Object.assign(() => undefined, recordingCore()))).to.equal(true);
    expect(isShikiHighlighter({ codeToHtml: () => '' })).to.equal(false);
    expect(isShikiHighlighter(null)).to.equal(false);
    expect(isShikiHighlighter('highlighter')).to.equal(false);
  });

  it('keeps a loader-free map and memoizes the concrete subset of one with loaders', () => {
    const concrete = { json: jsonGrammar };
    expect(resolvedShikiLanguages(concrete) === concrete).to.equal(true);
    const grammar = uniqueGrammar();
    const mixed = { json: jsonGrammar, lazy: () => Promise.resolve(grammar), missing: undefined } as never;
    const subset = resolvedShikiLanguages(mixed);
    expect(Object.keys(subset)).to.deep.equal(['json']);
    expect(resolvedShikiLanguages(mixed) === subset).to.equal(true);
  });
});
