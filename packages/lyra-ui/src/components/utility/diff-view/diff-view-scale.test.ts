import { expect, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import jsonGrammar from 'shiki/langs/json.mjs';
import './diff-view.js';
it('declines oversized diff highlighting before calling the tokenizer', () => {
  const el = document.createElement('lr-diff-view'); let calls = 0;
  const seam = el as unknown as { tokenizeLines(highlighter: unknown, text: string, language: string): string[] | null };
  seam.tokenizeLines({ codeToHtml() { calls++; return ''; } }, 'x'.repeat(8193), 'json');
  expect(calls).equal(0);
  recordScaleMeasurement('lr-diff-view', 'n=8193 highlight admission', { calls });
});
it('caps rendered operations when max-lines is unbounded', async () => {
  const el = document.createElement('lr-diff-view'); el.maxLines = Infinity;
  el.oldText = 'same\n'.repeat(10001); el.newText = el.oldText; document.body.append(el);
  try {
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="line"]').length).at.most(10000);
    expect(Boolean(el.shadowRoot!.querySelector('[part="limit"]'))).equal(true);
    recordScaleMeasurement('lr-diff-view', 'n=10002 lines render admission', { lines: el.shadowRoot!.querySelectorAll('[part="line"]').length });
  } finally { el.remove(); }
});
it('loads a requested lazy diff grammar without the full highlighter module', async () => {
  const el = document.createElement('lr-diff-view'); let calls = 0; let unused = 0;
  el.languages = { json: async () => { calls++; return { default: jsonGrammar }; }, unused: async () => { unused++; return { default: jsonGrammar }; } };
  el.language = 'json'; el.oldText = '{"x":1}'; el.newText = '{"x":2}'; document.body.append(el);
  try { await el.updateComplete; await waitUntil(() => calls === 1, 'lazy grammar did not resolve', { timeout: 2500 }); expect(unused).equal(0); }
  finally { el.remove(); }
});

it('keeps both oversized diff inputs readable with a localized highlighting notice', async () => {
  const el = document.createElement('lr-diff-view');
  el.language = 'json'; el.oldText = 'x'.repeat(8193); el.newText = 'y'.repeat(8193);
  el.strings = { diffViewHighlightLimit: 'Custom diff limit' }; document.body.append(el);
  try {
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).equal('Custom diff limit');
    expect(el.shadowRoot!.textContent).contain(el.oldText).and.contain(el.newText);
    expect(el.shadowRoot!.querySelectorAll('[part="line"]').length).equal(2);
    const line = el.shadowRoot!.querySelector('[part="line"]')!;
    expect(getComputedStyle(line).contentVisibility).equal('auto');
  } finally { el.remove(); }
});
it('admits exactly ten thousand diff operations and keeps split cells bounded', async () => {
  const el = document.createElement('lr-diff-view'); el.maxLines = Infinity;
  el.oldText = Array(10000).fill('same').join('\n'); el.newText = el.oldText; document.body.append(el);
  try {
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="line"]').length).equal(10000);
    el.layout = 'split'; await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="line"]').length).equal(20000);
  } finally { el.remove(); }
});
it('retires a disconnected lazy grammar result and highlights again after reconnect', async () => {
  const el = document.createElement('lr-diff-view');
  let resolveGrammar!: (value: typeof jsonGrammar) => void;
  const pending = new Promise<typeof jsonGrammar>((resolve) => { resolveGrammar = resolve; });
  let called = false;
  el.languages = { json: () => { called = true; return pending; } };
  el.language = 'json'; el.oldText = '{"x":1}'; el.newText = '{"x":2}'; document.body.append(el);
  const seam = el as unknown as { highlightedOldLines: string[] | null };
  try {
    await waitUntil(() => called, 'lazy grammar was not requested');
    el.remove(); resolveGrammar(jsonGrammar);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(seam.highlightedOldLines === null).equal(true);
    document.body.append(el); await el.updateComplete;
    await waitUntil(() => seam.highlightedOldLines !== null, 'reconnected diff did not highlight');
  } finally { el.remove(); }
});

it('shows current plain source while a replacement lazy grammar is unresolved', async () => {
  const el = document.createElement('lr-diff-view');
  el.language = 'json'; el.languages = { json: jsonGrammar };
  el.oldText = '{"previousOld":1}'; el.newText = '{"previousNew":2}'; document.body.append(el);
  const seam = el as unknown as { highlightedOldLines: string[] | null };
  let resolveGrammar!: (value: typeof jsonGrammar) => void;
  const pending = new Promise<typeof jsonGrammar>((resolve) => { resolveGrammar = resolve; });
  try {
    await waitUntil(() => seam.highlightedOldLines !== null, 'initial highlighting missing');
    await el.updateComplete;
    el.languages = { replacement: () => pending }; el.language = 'replacement';
    el.oldText = '{"currentOld":3}'; el.newText = '{"currentNew":4}';
    await el.updateComplete;
    const rendered = el.shadowRoot!.textContent ?? '';
    expect(rendered).contain('currentOld').and.contain('currentNew');
    expect(rendered).not.contain('previousOld').and.not.contain('previousNew');
    resolveGrammar(jsonGrammar);
    await waitUntil(() => seam.highlightedOldLines !== null, 'replacement highlighting missing');
    await el.updateComplete;
    expect(el.shadowRoot!.textContent).contain('currentOld').and.contain('currentNew');
  } finally { resolveGrammar(jsonGrammar); el.remove(); }
});
