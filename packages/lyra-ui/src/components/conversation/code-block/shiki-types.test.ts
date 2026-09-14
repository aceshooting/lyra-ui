import { expect } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import {
  loadShikiHighlighterCore,
  SHIKI_THEMES,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
  type ShikiLanguageRegistration,
} from './shiki-types.js';

/**
 * Building the fine-grained shiki/core highlighter -- importing shiki/core, the oniguruma WASM
 * engine, and both seed themes -- takes seconds once a saturated CI machine is compiling the regex
 * engine and instantiating WASM alongside the rest of the suite (mirrors code-loader.test.ts's
 * identical warning for the full loader's own module-level cache). A root-level before() pays that
 * cold-start cost once, with its own generous timeout, so every test below only ever awaits an
 * already-warm dynamic import graph.
 */
before(async function () {
  this.timeout(120_000);
  const warm = await loadShikiHighlighterCore({ json: jsonGrammar });
  (warm as (ShikiHighlighterCore & { dispose?: () => void }) | null)?.dispose?.();
});

let sequence = 0;

/** A minimal synthetic TextMate grammar -- mirrors code-block-core.test.ts's own `cacheGrammar()`
 *  helper -- whose only rule paints the literal text `alpha` as a `keyword.control` token, so a
 *  successful tokenization is visually distinguishable (an inline-styled `<span>`) from an
 *  unhighlighted echo of the source text. A unique `name` per call keeps each test's grammar out
 *  of this module's identity/content highlighter-core reuse caches. */
function testGrammar(): ShikiLanguageRegistration {
  const name = `lyra-shiki-alias-test-${++sequence}`;
  return {
    name,
    scopeName: `source.${name}`,
    patterns: [{ match: 'alpha', name: 'keyword.control' }],
  };
}

describe('loadShikiHighlighterCore language aliasing', () => {
  const cores = new Set<ShikiHighlighterCore>();

  afterEach(() => {
    for (const core of cores) (core as ShikiHighlighterCore & { dispose?: () => void }).dispose?.();
    cores.clear();
  });

  it("highlights under a languages map key that is neither the grammar's own name nor a declared alias", async function () {
    this.timeout(20_000);
    const grammar = testGrammar();
    // 'tsx' is deliberately unrelated to the grammar's own `name` -- the exact shape a consumer
    // reusing one grammar under a shorter/aliased public key produces (e.g. registering a
    // TypeScript grammar under the key `tsx` to avoid bundling a near-identical second grammar).
    const languages: Record<string, ShikiLanguageInput> = { tsx: grammar };
    const core = await loadShikiHighlighterCore(languages);
    expect(core, 'the optional shiki peer must build in this test environment').to.not.equal(null);
    cores.add(core!);

    // Before deriving `langAlias`, Shiki's own registry resolves `lang` against each loaded
    // grammar's own name/aliases only -- an unresolved 'tsx' throws `Language \`tsx\` not found`
    // here instead of ever reaching the tokenizer, which is exactly the "silently never
    // highlights" failure lr-markdown-core/lr-code-block-core swallow into a plain-text fallback.
    const html = core!.codeToHtml('alpha', { lang: 'tsx', themes: SHIKI_THEMES });
    expect(html).to.contain('alpha');
    expect(html).to.match(/<span style="[^"]*">alpha<\/span>/);
  });

  it("still highlights when the map key already matches the grammar's own name", async function () {
    this.timeout(20_000);
    const grammar = testGrammar();
    const languages: Record<string, ShikiLanguageInput> = { [grammar.name]: grammar };
    const core = await loadShikiHighlighterCore(languages);
    expect(core).to.not.equal(null);
    cores.add(core!);

    const html = core!.codeToHtml('alpha', { lang: grammar.name, themes: SHIKI_THEMES });
    expect(html).to.match(/<span style="[^"]*">alpha<\/span>/);
  });

  it("still highlights when the map key is one of the grammar's own declared aliases", async function () {
    this.timeout(20_000);
    const grammar: ShikiLanguageRegistration = { ...testGrammar(), aliases: ['legacy-alias'] };
    const languages: Record<string, ShikiLanguageInput> = { 'legacy-alias': grammar };
    const core = await loadShikiHighlighterCore(languages);
    expect(core).to.not.equal(null);
    cores.add(core!);

    const html = core!.codeToHtml('alpha', { lang: 'legacy-alias', themes: SHIKI_THEMES });
    expect(html).to.match(/<span style="[^"]*">alpha<\/span>/);
  });
});
