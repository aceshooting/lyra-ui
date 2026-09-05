import { fixture, expect, waitUntil } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import './code-block.js';
import './code-block-core.js';
import type { LyraCodeBlock } from './code-block.js';
import type { LyraCodeBlockCore } from './code-block-core.js';

type CodeBlock = LyraCodeBlock | LyraCodeBlockCore;
const source = '{\n  "answer": 42\n}';
const languages = { json: jsonGrammar };

async function highlighted(tagName: string): Promise<CodeBlock> {
  const wrapper = await fixture<HTMLElement>(`<div lang="en"><${tagName} line-numbers activatable-lines></${tagName}></div>`);
  const el = wrapper.firstElementChild as CodeBlock;
  if (tagName === 'lr-code-block-core') el.languages = languages;
  el.setAttribute('code', source);
  el.setAttribute('language', 'json');
  await waitUntil(() => !!el.shadowRoot!.querySelector('pre.shiki'), 'real Shiki output', { timeout: 10000 });
  return el;
}

for (const tagName of ['lr-code-block', 'lr-code-block-core']) {
  describe(`${tagName} removed attributes`, () => {
    for (const [attribute, property, initial] of [
      ['code', 'code', source],
      ['language', 'language', 'json'],
      ['highlight-lines', 'highlightLines', '2'],
    ] as const) {
      it(`treats removed ${attribute} as absence and recovers from explicit empty input`, async () => {
        const el = await highlighted(tagName);
        el.setAttribute(attribute, initial);
        await el.updateComplete;
        el.removeAttribute(attribute);
        await el.updateComplete;
        expect(el[property]).to.equal(null);
        if (attribute === 'code') expect(Array.from(el.shadowRoot!.querySelectorAll('.line-source'), (line) => line.textContent ?? '').join('')).to.equal('');
        if (attribute === 'language') expect(el.shadowRoot!.querySelectorAll('pre.shiki').length).to.equal(0);
        if (attribute === 'highlight-lines') expect(el.shadowRoot!.querySelectorAll('[data-highlighted]').length).to.equal(0);
        el.setAttribute(attribute, '');
        await el.updateComplete;
        expect(el[property]).to.equal('');
        el.setAttribute(attribute, initial);
        await el.updateComplete;
        await waitUntil(() => !!el.shadowRoot!.querySelector('pre.shiki'), 'restored highlighting', { timeout: 10000 });
        expect(el[property]).to.equal(initial);
        expect(el.shadowRoot!.textContent).to.include('answer');
        if (attribute === 'highlight-lines') expect(el.shadowRoot!.querySelectorAll('[data-highlighted]').length).to.equal(1);
      });
    }
  });

  describe(`${tagName} highlighted gutter localization`, () => {
    it('updates warmed line names for live strings while preserving unrelated cached markup', async () => {
      const el = await highlighted(tagName);
      const first = () => el.shadowRoot!.querySelector<HTMLElement>('[part~="line-button"][data-line="1"]')!;
      expect(first().getAttribute('aria-label')).to.equal('Line 1');
      el.strings = { codeBlockLineLabel: 'Ligne {line}' };
      await waitUntil(() => first().getAttribute('aria-label') === 'Ligne 1', 'live strings on highlighted gutter');
      const before = first();
      el.filename = 'answer.json';
      await el.updateComplete;
      expect(first() === before).to.equal(true);
    });

    it('updates warmed line digits and names when the inherited locale changes', async () => {
      const el = await highlighted(tagName);
      const wrapper = el.parentElement!;
      const first = () => el.shadowRoot!.querySelector<HTMLElement>('[part~="line-button"][data-line="1"]')!;
      wrapper.lang = 'ar-EG';
      const digit = new Intl.NumberFormat('ar-EG').format(1);
      await waitUntil(() => first().textContent?.trim() === digit, 'locale digits on highlighted gutter');
      expect(first().getAttribute('aria-label')).to.include(digit);
    });
  });
}
