import { expect } from '@open-wc/testing';
import { __resetShikiCoreEngineForTesting, loadShikiHighlighterCore, setShikiCoreEngine } from './shiki-types.js';

describe('fine-grained default engine contract', () => {
  beforeEach(() => { __resetShikiCoreEngineForTesting(); });
  afterEach(() => { __resetShikiCoreEngineForTesting(); });

  it('uses the same engine as the JavaScript preset when no engine was selected', async function () {
    this.timeout(120_000);
    const grammar = { name: 'default-engine', scopeName: 'source.default-engine', patterns: [{ match: 'alpha', name: 'keyword.control' }] };
    const languages = { [grammar.name]: grammar };
    const defaultCore = await loadShikiHighlighterCore(languages);
    expect(defaultCore === null).to.equal(false);
    setShikiCoreEngine('javascript');
    expect(await loadShikiHighlighterCore(languages) === defaultCore).to.equal(true);
  });

  it('rejects the retired string preset before replacing a configured factory', async function () {
    this.timeout(120_000);
    let calls = 0;
    setShikiCoreEngine(async () => {
      calls++;
      const { createJavaScriptRegexEngine } = await import('shiki/engine/javascript');
      return createJavaScriptRegexEngine() as never;
    });
    expect(() => setShikiCoreEngine('oniguruma' as never)).to.throw(TypeError);
    const grammar = { name: 'preserved-engine', scopeName: 'source.preserved-engine', patterns: [] };
    expect(await loadShikiHighlighterCore({ [grammar.name]: grammar }) === null).to.equal(false);
    expect(calls).to.equal(1);
  });
});
