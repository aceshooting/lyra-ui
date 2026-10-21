import { expect } from '@open-wc/testing';
import { captureDevWarnings } from '../../../../test/expected-dev-warnings.js';
import {
  loadShikiHighlighterCore,
  setShikiCoreEngine,
  __resetShikiCoreEngineForTesting,
  SHIKI_THEMES,
  type ShikiHighlighterCore,
  type ShikiLanguageInput,
  type ShikiLanguageRegistration,
} from './shiki-types.js';

type Disposable = ShikiHighlighterCore & { dispose?: () => void };

let sequence = 0;

/** A one-rule grammar painting `alpha` as a keyword; a unique name keeps every test out of the
 *  module's grammar-identity reuse caches. */
function testGrammar(): ShikiLanguageRegistration {
  const name = `lyra-shiki-coverage-${++sequence}`;
  return { name, scopeName: `source.${name}`, patterns: [{ match: 'alpha', name: 'keyword.control' }] };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function highlights(core: ShikiHighlighterCore | null, lang: string): boolean {
  const html = core!.codeToHtml('alpha', { lang, themes: SHIKI_THEMES });
  return /<span style="[^"]*">alpha<\/span>/.test(html);
}

describe('loadShikiHighlighterCore engine and reflection edge cases', () => {
  const cores = new Set<ShikiHighlighterCore | null>();
  afterEach(() => {
    for (const core of cores) (core as Disposable | null)?.dispose?.();
    cores.clear();
    __resetShikiCoreEngineForTesting();
  });

  it("builds a working highlighter when the 'oniguruma' preset is selected explicitly", async function () {
    this.timeout(120_000);
    setShikiCoreEngine('oniguruma');
    const grammar = testGrammar();
    const core = await loadShikiHighlighterCore({ [grammar.name]: grammar });
    cores.add(core);
    expect(core, 'the packaged Oniguruma engine must build a usable highlighter').to.not.equal(null);
    expect(highlights(core, grammar.name)).to.equal(true);
  });

  it('still builds from a languages map whose frozen state cannot be inspected', async function () {
    this.timeout(60_000);
    setShikiCoreEngine('javascript');
    const grammar = testGrammar();
    const languages = new Proxy({ [grammar.name]: grammar } as Record<string, ShikiLanguageInput>, {
      isExtensible() {
        throw new TypeError('extensibility unavailable');
      },
    });
    const core = await loadShikiHighlighterCore(languages);
    cores.add(core);
    expect(core, 'a hostile languages map must not break highlighting').to.not.equal(null);
    expect(highlights(core, grammar.name)).to.equal(true);
  });

  it('never reuses a core for a frozen grammar map it cannot prove equal', async function () {
    this.timeout(60_000);
    setShikiCoreEngine('javascript');
    const grammar = deepFreeze(testGrammar());
    const first = Object.freeze({ [grammar.name]: grammar }) as Record<string, ShikiLanguageInput>;
    const firstCore = await loadShikiHighlighterCore(first);
    cores.add(firstCore);
    expect(firstCore).to.not.equal(null);

    const hostile = new Proxy(deepFreeze(structuredClone(grammar)), {
      getPrototypeOf() {
        throw new TypeError('prototype unavailable');
      },
    });
    const second = Object.freeze({ [grammar.name]: hostile }) as Record<string, ShikiLanguageInput>;
    const warnings = await captureDevWarnings(async () => {
      const secondCore = await loadShikiHighlighterCore(second);
      cores.add(secondCore);

      expect(secondCore === firstCore).to.equal(false);
      expect(secondCore).to.equal(null);
      expect(highlights(firstCore, grammar.name)).to.equal(true);
    });
    expect(warnings).to.deep.equal([
      'Lyra syntax highlighting failed to build a fine-grained shiki highlighter from the supplied grammars. Code is rendered as plain text.',
    ]);
  });
});
