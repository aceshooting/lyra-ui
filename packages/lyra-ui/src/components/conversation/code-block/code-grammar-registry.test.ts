import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import '../../lr-code-block.js';
import '../../lr-code-block-core.js';
import type { LyraCodeBlock } from '../../lr-code-block.js';
import type { LyraCodeBlockCore } from '../../lr-code-block-core.js';
import {
  getCodeGrammar,
  registerCodeGrammar,
  unregisterCodeGrammar,
  withRegisteredCodeGrammars,
} from './code-grammar-registry.js';
import { registerCodeGrammar as rootRegister } from '../../../lyra.js';

const NAMES = ['zz-reg', 'zz-alias', 'zz-late', 'zz-own', 'zz-fail', 'zz-moved'];
const highlighted = (el: Element) => el.shadowRoot!.querySelector('.shiki') !== null;
// The full block may first build the shared ~200-language highlighter, which is slow when the
// whole suite saturates the machine.
const SLOW = { timeout: 15000 };
const cleanup = () => NAMES.forEach(unregisterCodeGrammar);

describe('code grammar registry', () => {
  afterEach(cleanup);

  it('is exported from the root barrel', () => {
    expect(rootRegister).to.equal(registerCodeGrammar);
  });

  it('validates names, aliases and sources without registering anything', () => {
    expect(() => registerCodeGrammar('', jsonGrammar)).to.throw(TypeError);
    expect(() => registerCodeGrammar('bad name!', jsonGrammar)).to.throw(TypeError);
    expect(() => registerCodeGrammar('x'.repeat(65), jsonGrammar)).to.throw(TypeError);
    expect(() => registerCodeGrammar(5 as unknown as string, jsonGrammar)).to.throw(TypeError);
    expect(() => registerCodeGrammar('zz-reg', null as never)).to.throw(TypeError);
    expect(() => registerCodeGrammar('zz-reg', 'json' as never)).to.throw(TypeError);
    expect(() => registerCodeGrammar('zz-reg', jsonGrammar, { aliases: 'a' as never })).to.throw(TypeError);
    expect(() => registerCodeGrammar('zz-reg', jsonGrammar, { aliases: ['ok', '!'] })).to.throw(TypeError);
    expect(() => registerCodeGrammar('zz-reg', jsonGrammar, { aliases: Array(40).fill('a') })).to.throw(TypeError);
    expect(getCodeGrammar('zz-reg')).to.equal(undefined);
    expect(getCodeGrammar('ok')).to.equal(undefined);
  });

  it('registers names and aliases case-insensitively and removes them together', () => {
    registerCodeGrammar('ZZ-Reg', jsonGrammar, { aliases: ['zz-alias'] });
    expect(getCodeGrammar('zz-reg')).to.equal(jsonGrammar);
    expect(getCodeGrammar('.ZZ-ALIAS')).to.equal(jsonGrammar);
    unregisterCodeGrammar('zz-reg');
    expect(getCodeGrammar('zz-reg')).to.equal(undefined);
    expect(getCodeGrammar('zz-alias')).to.equal(undefined);
    unregisterCodeGrammar('never-registered');
  });

  it('keeps a stable merged map per registry version and lets element entries win', () => {
    const own = { 'zz-own': jsonGrammar };
    expect(withRegisteredCodeGrammars(own)).to.equal(own);
    registerCodeGrammar('zz-reg', jsonGrammar);
    const merged = withRegisteredCodeGrammars(own)!;
    expect(withRegisteredCodeGrammars(own)).to.equal(merged);
    expect(Object.keys(merged)).to.include.members(['zz-reg', 'zz-own']);
    const loader = async () => jsonGrammar;
    registerCodeGrammar('zz-own', loader);
    expect(withRegisteredCodeGrammars(own)!['zz-own']).to.equal(jsonGrammar);
    expect(withRegisteredCodeGrammars(undefined)!['zz-own']).to.equal(loader);
  });
});

for (const tag of ['lr-code-block', 'lr-code-block-core'] as const) {
  describe(`${tag} with the code grammar registry`, () => {
    afterEach(cleanup);
    const make = (language: string, extra: Record<string, unknown> = {}) => {
      const el = document.createElement(tag) as LyraCodeBlock | LyraCodeBlockCore;
      el.setAttribute('language', language);
      Object.assign(el, { code: '{"a": 1}' }, extra);
      document.body.append(el);
      return el;
    };

    it('highlights a registered grammar and a registered alias', async () => {
      registerCodeGrammar('zz-reg', jsonGrammar, { aliases: ['zz-alias'] });
      const a = make('zz-reg');
      const b = make('ZZ-Alias');
      try {
        await waitUntil(() => highlighted(a) && highlighted(b), 'registered grammars highlight', SLOW);
      } finally {
        a.remove();
        b.remove();
      }
    });

    it('accepts a lazy loader', async () => {
      let calls = 0;
      registerCodeGrammar('zz-reg', async () => { calls += 1; return { default: jsonGrammar }; });
      const el = make('zz-reg');
      try {
        await waitUntil(() => highlighted(el), undefined, SLOW);
        expect(calls).to.be.greaterThan(0);
      } finally {
        el.remove();
      }
    });

    it('re-highlights a rendered block when its language is registered late, then unregistered', async () => {
      const el = make('zz-late');
      try {
        await el.updateComplete;
        await new Promise((r) => setTimeout(r, 50));
        expect(highlighted(el)).to.equal(false);
        registerCodeGrammar('zz-late', jsonGrammar);
        await waitUntil(() => highlighted(el), 'late registration highlights', SLOW);
        unregisterCodeGrammar('zz-late');
        try {
          await waitUntil(
            () => !highlighted(el) && el.shadowRoot!.querySelector('[part="code"]') !== null,
            'unregister falls back to plain text',
            SLOW,
          );
        } catch (e) {
          throw new Error(String(e) + ' ' + el.shadowRoot!.innerHTML.replace(/\s+/g, ' ').slice(0, 900));
        }
        expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent ?? '').to.contain('"a"');
      } finally {
        el.remove();
      }
    });

    it('prefers the element map over the registry for the same language', async () => {
      let registryCalls = 0;
      registerCodeGrammar('zz-own', async () => { registryCalls += 1; return jsonGrammar; });
      const el = make('zz-own', { languages: { 'zz-own': jsonGrammar } });
      try {
        await waitUntil(() => highlighted(el), undefined, SLOW);
        expect(registryCalls).to.equal(0);
      } finally {
        el.remove();
      }
    });

    it('fails closed to the plain-text fallback when the loader rejects', async () => {
      registerCodeGrammar('zz-fail', async () => { throw new Error('nope'); });
      // The loader failure is reported through a one-time console.warn by design; capture it.
      (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings?.delete(
        'lyra-shiki-lazy-language-source-failed',
      );
      const originalWarn = console.warn;
      const warnings: string[] = [];
      console.warn = (...args: unknown[]) => { warnings.push(String(args[0])); };
      const el = make('zz-fail');
      try {
        await waitUntil(() => el.matches(':state(error)'), 'error state set', SLOW);
        expect(highlighted(el)).to.equal(false);
        expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.contain('"a"');
        expect(warnings.join('\n')).to.include('could not load a lazy `languages` grammar loader');
      } finally {
        console.warn = originalWarn;
        el.remove();
      }
    });

    it('ignores registrations while disconnected and does not leak a subscription', async () => {
      const el = make('zz-moved');
      await el.updateComplete;
      el.remove();
      registerCodeGrammar('zz-moved', jsonGrammar);
      await new Promise((r) => setTimeout(r, 30));
      expect(highlighted(el)).to.equal(false);
      // Reconnecting picks the grammar up and resubscribes.
      document.body.append(el);
      try {
        await waitUntil(() => highlighted(el), 'reconnected block highlights', SLOW);
        unregisterCodeGrammar('zz-moved');
        await waitUntil(() => !highlighted(el), undefined, SLOW);
      } finally {
        el.remove();
      }
    });

    it('does not touch a block showing another language', async () => {
      const el = (await fixture(html`<lr-code-block-core language="zz-reg" code="x"></lr-code-block-core>`)) as LyraCodeBlockCore;
      const before = el.shadowRoot!.innerHTML;
      registerCodeGrammar('zz-alias', jsonGrammar);
      await el.updateComplete;
      expect(el.shadowRoot!.innerHTML).to.equal(before);
    });
  });
}
