import { registerLyraLocale } from '../../../internal/localization.js';
import { expect, nextFrame, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import jsonGrammar from 'shiki/langs/json.mjs';
import './code-block.js';
import './code-block-core.js';

for (const tag of ['lr-code-block', 'lr-code-block-core'] as const) {
  it(`${tag} moves the active gutter without rebuilding one thousand plain lines`, async () => {
    const el = document.createElement(tag); el.code = 'line\n'.repeat(999) + 'last'; el.lineNumbers = true; el.activatableLines = true;
    document.body.append(el);
    try {
      await el.updateComplete; await nextFrame(); await el.updateComplete;
      const seam = el as unknown as { renderPlainCode(): unknown; interactions: { setFocusedLine(line: number): void } };
      let templates = 0; const render = seam.renderPlainCode.bind(el);
      seam.renderPlainCode = () => { templates++; return render(); };
      const mutations = new MutationObserver(() => {});
      mutations.observe(el.shadowRoot!, { subtree: true, attributes: true, attributeFilter: ['tabindex'] });
      seam.interactions.setFocusedLine(2);
      const writes = mutations.takeRecords().length;
      mutations.disconnect();
      await el.updateComplete;
      expect(writes).equal(2);
      expect(templates).equal(0);
      expect(el.shadowRoot!.querySelector('[part~="line-button"][tabindex="0"]')?.getAttribute('data-line')).equal('2');
      recordScaleMeasurement(tag, 'n=1000 lines move gutter', { templates, writes });
    } finally { el.remove(); }
  });
  it(`${tag} updates highlighted line state without rerunning tokenization or replacing source nodes`, async () => {
    const el = document.createElement(tag); el.code = 'first\nsecond'; document.body.append(el);
    try {
      await el.updateComplete; await nextFrame();
      const seam = el as unknown as { syncHighlight(): void; shikiReady: boolean; highlightedHtml: string | null };
      seam.shikiReady = true; seam.highlightedHtml = '<pre part="pre"><code part="code"><span class="line" data-line="1">first</span><span class="line" data-line="2">second</span></code></pre>';
      await el.updateComplete;
      const node = el.shadowRoot!.querySelector('.line[data-line="2"]'); let calls = 0;
      seam.syncHighlight = () => { calls++; };
      el.highlightLines = '2'; await el.updateComplete;
      expect(calls).equal(0);
      expect(el.shadowRoot!.querySelector('.line[data-line="2"]') === node).equal(true);
      expect(node?.hasAttribute('data-highlighted')).equal(true);
    } finally { el.remove(); }
  });
  it(`${tag} reuses plain source while patching highlights, and refreshes its line index after source edits`, async () => {
    const el = document.createElement(tag); el.code = 'first\nsecond'; el.lineNumbers = true; el.activatableLines = true;
    document.body.append(el);
    try {
      await el.updateComplete; await nextFrame(); await el.updateComplete;
      const source = el.shadowRoot!.querySelector('code');
      el.highlightLines = '2'; await el.updateComplete;
      expect(el.shadowRoot!.querySelector('code') === source).equal(true);
      expect(el.shadowRoot!.querySelector('.line[data-line="2"]')?.hasAttribute('data-highlighted')).equal(true);
      el.highlightLines = '1'; await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.line[data-line="2"]')?.hasAttribute('data-highlighted')).equal(false);
      el.code = 'replacement\nchanged\nnew'; await el.updateComplete;
      el.highlightLines = '3'; await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.line[data-line="3"]')?.hasAttribute('data-highlighted')).equal(true);
      const seam = el as unknown as { interactions: { setFocusedLine(line: number): void } };
      seam.interactions.setFocusedLine(3);
      expect(el.shadowRoot!.querySelector('[part~="line-button"][tabindex="0"]')?.getAttribute('data-line')).equal('3');
      el.code = 'short'; await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part~="line-button"][tabindex="0"]')?.getAttribute('data-line')).equal('1');
    } finally { el.remove(); }
  });
  it(`${tag} preserves oversized source and resolves the limit label from strings`, async () => {
    const el = document.createElement(tag); el.code = 'x'.repeat(8193); el.language = 'json';
    el.strings = { codeBlockHighlightLimit: 'Custom highlight limit' };
    document.body.append(el);
    try {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('code')?.textContent).equal(el.code);
      expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).equal('Custom highlight limit');
      expect(el.shadowRoot!.querySelector('lr-skeleton') === null).equal(true);
      el.strings = { codeBlockHighlightLimit: 'Replacement limit' }; await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).equal('Replacement limit');
    } finally { el.remove(); }
  });
  it(`${tag} declines oversized source before calling a tokenizer`, async () => {
    const el = document.createElement(tag); el.code = 'x'.repeat(8193); let calls = 0;
    const seam = el as unknown as { tokenize(highlighter: unknown, language: string): string | null };
    seam.tokenize({ codeToHtml() { calls++; return ''; } }, 'json');
    expect(calls).equal(0);
    el.code = 'x'.repeat(8192);
    seam.tokenize({ codeToHtml() { calls++; return ''; } }, 'json');
    expect(calls).equal(1);
    recordScaleMeasurement(tag, 'n=8193 highlight admission', { calls: calls - 1 });
  });
}
it('full code block resolves only a requested lazy grammar', async () => {
  const el = document.createElement('lr-code-block'); let calls = 0; let unused = 0;
  el.languageLoaders = { json: async () => { calls++; return { default: jsonGrammar }; }, unused: async () => { unused++; return { default: jsonGrammar }; } };
  el.language = 'json'; el.code = '{"lazy":true}'; document.body.append(el);
  try {
    await el.updateComplete;
    await waitUntil(() => calls === 1, 'lazy grammar did not resolve', { timeout: 2500 });
    await waitUntil(() => Boolean(el.shadowRoot?.querySelector('code .line')), 'highlighted code not rendered');
    expect(calls).equal(1);
    expect(unused).equal(0);
  } finally { el.remove(); }
});

for (const tag of ['lr-code-block', 'lr-code-block-core'] as const) {
  it(`${tag} clears cached plain line state when remounting after highlighted output`, async () => {
    const el = document.createElement(tag);
    el.code = 'first\nsecond'; el.highlightLines = '1';
    el.highlights = [{ id: 'first', anchor: { kind: 'line-range', start: 1 } }];
    el.activeHighlightId = 'first'; document.body.append(el);
    try {
      await el.updateComplete; await nextFrame(); await el.updateComplete;
      const seam = el as unknown as { highlightedHtml: string | null };
      seam.highlightedHtml = '<pre part="pre"><code part="code"><span class="line" data-line="1">first</span><span class="line" data-line="2">second</span></code></pre>';
      await el.updateComplete;
      el.highlightLines = '2';
      el.highlights = [{ id: 'second', anchor: { kind: 'line-range', start: 2 } }];
      el.activeHighlightId = 'second'; await el.updateComplete;
      seam.highlightedHtml = null; await el.updateComplete;
      const first = el.shadowRoot!.querySelector('.line[data-line="1"]')!;
      const second = el.shadowRoot!.querySelector('.line[data-line="2"]')!;
      expect(first.hasAttribute('data-highlighted')).equal(false);
      expect(first.hasAttribute('data-active')).equal(false);
      expect(first.getAttribute('part') ?? '').not.contain('line-highlight');
      expect(second.hasAttribute('data-highlighted')).equal(true);
      expect(second.hasAttribute('data-active')).equal(true);
    } finally { el.remove(); }
  });
}

for (const tag of ['lr-code-block', 'lr-code-block-core'] as const) {
  for (const highlighted of [false, true]) {
    it(`${tag} refreshes ${highlighted ? 'highlighted' : 'plain'} gutter labels for strings and same-locale catalog replacement`, async () => {
      const locale = 'en-x-codeblock-cache';
      registerLyraLocale(locale, { codeBlockLineLabel: 'Catalog first {line}' });
      const el = document.createElement(tag); el.locale = locale;
      el.code = '{"value":1}'; el.lineNumbers = true; el.activatableLines = true;
      if (highlighted) { el.languages = { json: jsonGrammar }; el.language = 'json'; }
      document.body.append(el);
      const label = () => el.shadowRoot?.querySelector('[part~="line-button"][data-line="1"]')?.getAttribute('aria-label');
      try {
        await el.updateComplete;
        if (highlighted) await waitUntil(() => Boolean(el.shadowRoot?.querySelector('pre.shiki')), 'initial highlighted gutter missing');
        expect(label()).equal('Catalog first 1');
        el.strings = { codeBlockLineLabel: 'Override first {line}' };
        await waitUntil(() => label() === 'Override first 1', 'initial strings override missing');
        el.strings = { codeBlockLineLabel: 'Override replacement {line}' };
        el.filename = 'override.json'; el.requestUpdate();
        await waitUntil(() => label() === 'Override replacement 1', 'replacement strings override missing');
        el.strings = {}; await waitUntil(() => label() === 'Catalog first 1', 'catalog did not resume');
        registerLyraLocale(locale, { codeBlockLineLabel: 'Catalog replacement {line}' });
        el.filename = 'catalog.json'; el.requestUpdate();
        await waitUntil(() => label() === 'Catalog replacement 1', 'same-locale replacement did not refresh gutter');
      } finally {
        el.remove(); registerLyraLocale(locale, { codeBlockLineLabel: 'Catalog first {line}' });
      }
    });
  }
}

for (const tag of ['lr-code-block', 'lr-code-block-core'] as const) {
  it(`${tag} releases cached plain source when replacement code highlights synchronously`, async () => {
    const el = document.createElement(tag); el.code = 'x'.repeat(12_000); document.body.append(el);
    const seam = el as unknown as {
      plainTemplate: unknown;
      shikiReady: boolean;
      highlightedHtml: string | null;
      syncHighlight(): void;
    };
    try {
      await el.updateComplete; await nextFrame(); await el.updateComplete;
      expect(seam.plainTemplate !== undefined).equal(true);
      seam.shikiReady = true;
      seam.syncHighlight = () => {
        seam.highlightedHtml = '<pre class="shiki" part="pre"><code part="code"><span class="line" data-line="1">replacement</span></code></pre>';
      };
      el.language = 'json'; el.code = 'replacement'; await el.updateComplete;
      expect(el.shadowRoot!.querySelector('pre.shiki code')?.textContent).equal('replacement');
      expect(seam.plainTemplate === undefined).equal(true);
    } finally { el.remove(); }
  });
}

it('keeps concrete code grammars readable and gives them priority over opt-in loaders', async () => {
  const el = document.createElement('lr-code-block');
  expect(el.languageLoaders).equal(undefined);
  let calls = 0;
  const languages = { json: jsonGrammar };
  el.languages = languages;
  el.language = 'json'; el.code = '{"concrete":true}'; document.body.append(el);
  try {
    const seam = el as unknown as { highlightedHtml: string | null };
    await waitUntil(() => seam.highlightedHtml !== null, 'concrete grammar did not highlight');
    expect(el.languages).equal(languages);
    el.languageLoaders = { json: async () => { calls++; return jsonGrammar; } };
    await el.updateComplete;
    await waitUntil(() => seam.highlightedHtml !== null, 'concrete grammar lost priority');
    expect(calls).equal(0);
    el.languages = undefined;
    await el.updateComplete;
    await waitUntil(() => calls === 1, 'loader did not become active after removing concrete grammar');
  } finally { el.remove(); }
});

it('keeps the protected concrete grammar hook distinct from lazy availability and dispatches overrides', () => {
  const el = document.createElement('lr-code-block');
  const grammar = { name: 'example', scopeName: 'source.example' };
  const hooks = el as unknown as {
    preSuppliedGrammar(): typeof grammar | undefined;
    hasPreSuppliedGrammar(): boolean;
  };
  el.language = 'example'; el.languages = { example: grammar };
  expect(hooks.preSuppliedGrammar()).equal(grammar);
  el.languages = undefined;
  el.languageLoaders = { example: async () => grammar };
  expect(hooks.preSuppliedGrammar()).equal(undefined);
  expect(hooks.hasPreSuppliedGrammar()).equal(true);
  let calls = 0;
  hooks.preSuppliedGrammar = () => { calls++; return grammar; };
  el.languageLoaders = undefined;
  expect(hooks.hasPreSuppliedGrammar()).equal(true);
  expect(calls).equal(1);
  el.languages = { example: grammar };
  hooks.preSuppliedGrammar = () => { calls++; return undefined; };
  expect(hooks.hasPreSuppliedGrammar()).equal(false);
  expect(calls).equal(2);
});
