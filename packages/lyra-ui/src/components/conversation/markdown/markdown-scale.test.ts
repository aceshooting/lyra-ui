import { expect, nextFrame, waitUntil } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.class.js';
import jsonGrammar from 'shiki/langs/json.mjs';
import { markdownHighlightKey, type PendingHighlight } from './markdown-shared.js';

async function settleProgressiveHighlightRepaint(el: LyraMarkdown): Promise<void> {
  const seam = el as unknown as {
    progressiveSession?: { pending: boolean };
    highlightRepaintTimer?: unknown;
  };
  await waitUntil(() => seam.progressiveSession?.pending === false &&
    !el.isUpdatePending && seam.highlightRepaintTimer === undefined,
  'progressive Markdown and highlight repaint did not settle');
  await el.updateComplete;
}

for (const tag of ['lr-markdown', 'lr-markdown-core'] as const) {
  it(`${tag} appends plain streaming text without replacing the retained prefix`, async () => {
    const el = document.createElement(tag); el.streaming = true; el.content = 'x'.repeat(10000);
    document.body.append(el);
    try {
      await el.updateComplete; await nextFrame();
      const root = el.shadowRoot!.querySelector('[part="content"]')!;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Text | null = null;
      while (walker.nextNode()) if (walker.currentNode.textContent?.startsWith('xxx')) node = walker.currentNode as Text;
      expect(Boolean(node)).equal(true);
      const range = document.createRange(); range.setStart(node!, 100); range.setEnd(node!, 200);
      let appended = 0; const append = node!.appendData.bind(node);
      node!.appendData = value => { appended += value.length; append(value); };
      el.content += 'y'.repeat(1000); await el.updateComplete; await nextFrame();
      expect(range.startOffset).equal(100); expect(range.endOffset).equal(200);
      expect(appended).equal(1000);
      recordScaleMeasurement(tag, 'n=10000 plain prefix append1000', { appended });
    } finally { el.remove(); }
  });
}
it('full markdown resolves a lazy authored grammar exactly once', async () => {
  const el = document.createElement('lr-markdown') as LyraMarkdown;
  document.body.append(el);
  try {
    await el.updateComplete; let loads = 0;
    const languages = { json: async () => { loads++; return { default: jsonGrammar }; }, unused: async () => { throw new Error('Unused grammar must stay lazy'); } };
    const code = '{"lazy":true}\n'; const pending = { key: markdownHighlightKey('json', code), lang: 'json', code };
    const seam = el as unknown as { tokenizePendingHighlight(pending: PendingHighlight, languages: unknown, current: () => boolean): Promise<string | null | undefined> };
    el.languageLoaders = languages;
    const output = await seam.tokenizePendingHighlight(pending, el.languages, () => true);
    expect(typeof output).equal('string'); expect(loads).equal(1);
  } finally { el.remove(); }
});

import { loadMarkdownDeps } from './markdown-loader.js';
import { parseMarkdownDocument, tokenizeMarkdownHighlight } from './markdown-shared.js';
it('rejects oversized highlight work before queueing or calling the tokenizer', async () => {
  const pending: PendingHighlight[] = [];
  parseMarkdownDocument({ marked: (await loadMarkdownDeps()).marked!, content: '```json\n' + 'x'.repeat(8193) + '\n```',
    gfm: true, linkTarget: null, headingOffset: 0, escapeHtmlOption: false, trustedHtmlOption: false,
    highlightCodeOption: true, getCachedHighlight: () => undefined, failedHighlightKeys: new Set(),
    headingAnchorsOption: false, mathOption: false, cachedKatex: null, pendingKeys: pending, headingTreeOut: [] });
  expect(pending.length).equal(0);
  let calls = 0;
  const highlighter = { codeToHtml: () => { calls++; return '<pre>huge</pre>'; } };
  tokenizeMarkdownHighlight(highlighter as never, { key: 'oversized', lang: 'json', code: 'x'.repeat(8193) });
  expect(calls).equal(0);
  recordScaleMeasurement('lr-markdown', 'n=8193 code admission', { queued: pending.length, calls });
});

import { renderMarkdownDocument } from './markdown-shared.js';
it('avoids a second DOM parse for one thousand native Markdown links', async () => {
  const deps = await loadMarkdownDeps(); let templates = 0;
  const create = document.createElement.bind(document);
  const parsed = parseMarkdownDocument({ marked: deps.marked!, content: '[link](https://example.org)\n\n'.repeat(1000),
    gfm: true, linkTarget: '_blank', headingOffset: 0, escapeHtmlOption: false, trustedHtmlOption: false,
    highlightCodeOption: false, getCachedHighlight: () => undefined, failedHighlightKeys: new Set(),
    headingAnchorsOption: false, mathOption: false, cachedKatex: null, pendingKeys: [], headingTreeOut: [] });
  document.createElement = ((name: string, options?: ElementCreationOptions) => { if (name === 'template') templates++; return create(name, options); }) as typeof document.createElement;
  try {
    const result = renderMarkdownDocument({ tag: 'lr-markdown', deps, htmlMode: 'sanitize', math: false,
      parse: () => parsed, onParsed() {}, isKatexConfirmedMissing: () => false });
    expect(result.status).equal('rendered'); expect(templates).equal(0);
    recordScaleMeasurement('lr-markdown', 'n=1000 native links', { templates });
  } finally { document.createElement = create; }
});
it('shares bounded highlighted output across both tags without crossing grammar identities', async () => {
  const full = document.createElement('lr-markdown'); const core = document.createElement('lr-markdown-core');
  const grammar = { json: jsonGrammar }; full.languages = grammar; core.languages = grammar;
  document.body.append(full, core);
  type Cache = { setCachedHighlight(key: string, html: string): boolean; getCachedHighlight(key: string): string | undefined };
  try {
    await Promise.all([full.updateComplete, core.updateComplete]);
    const key = markdownHighlightKey('json', 'shared unique content');
    (full as unknown as Cache).setCachedHighlight(key, '<pre>shared</pre>');
    expect((core as unknown as Cache).getCachedHighlight(key)).equal('<pre>shared</pre>');
    core.languages = { json: { name: 'json', scopeName: 'source.other' } }; await core.updateComplete;
    expect((core as unknown as Cache).getCachedHighlight(key)).equal(undefined);
  } finally { full.remove(); core.remove(); }
});
it('discovers progressive table and code chrome only in newly mounted groups', async () => {
  const el = document.createElement('lr-markdown'); el.streaming = true; el.streamingRender = 'progressive';
  el.codeBlockHeader = true; el.withoutSyntaxHighlighting = true;
  el.content = '| A |\n| - |\n| value |\n\n```text\ncode\n```\n\n' + '# stable\n\n'.repeat(1000) + 'tail';
  document.body.append(el);
  try {
    await loadMarkdownDeps(); await el.updateComplete; await nextFrame(); await el.updateComplete;
    const root = el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
    let scans = 0; const one = root.querySelector.bind(root); const all = root.querySelectorAll.bind(root);
    root.querySelector = ((selector: string) => { if (selector.includes('table-wrapper')) scans++; return one(selector); }) as typeof root.querySelector;
    root.querySelectorAll = ((selector: string) => { if (selector.includes('table-wrapper') || selector.includes('data-lr-code-frame')) scans++; return all(selector); }) as typeof root.querySelectorAll;
    el.content += '\n\n# Added\n\nnext'; await el.updateComplete; await nextFrame(); await el.updateComplete;
    expect(scans).equal(0);
    recordScaleMeasurement('lr-markdown', 'n=1000 settled blocks append chrome', { wholeRootScans: scans });
  } finally { el.remove(); }
});
it('keeps concurrent documents highlighted when their combined working set exceeds the shared LRU', async () => {
  const hosts = [document.createElement('lr-markdown'), document.createElement('lr-markdown-core')];
  let calls = 0;
  for (const el of hosts) {
    (el as unknown as { tokenizePendingHighlight(pending: PendingHighlight): Promise<string> }).tokenizePendingHighlight = async pending => {
      calls++;
      if (calls > 320) throw new Error('Highlighting repeated after eviction');
      return `<pre part="code-block"><code><span>${pending.code}</span></code></pre>\n`;
    };
  }
  document.body.append(...hosts);
  try {
    await Promise.all(hosts.map(el => el.updateComplete));
    for (const [index, el] of hosts.entries()) el.content = Array.from({ length: 80 }, (_, block) => '```json\n' + `${index}-${block}` + '\n```\n\n').join('');
    for (let frame = 0; frame < 20; frame++) { await nextFrame(); await Promise.all(hosts.map(el => el.updateComplete)); }
    expect(calls).equal(160);
    expect(hosts.map(el => el.shadowRoot!.querySelectorAll('[part="code-block"] span').length)).deep.equal([80, 80]);
  } finally { hosts.forEach(el => el.remove()); }
});

import { createMarkdownRenderContext, normalizeMarkdownLeadingTabs } from './markdown-shared.js';
it('does not re-lex unrelated tabbed prose to restore a plain code header source', async () => {
  const raw = 'intro\n\tcontinuation\n\n```text\n  plain\n```';
  const context = createMarkdownRenderContext({ marked: (await loadMarkdownDeps()).marked!, content: normalizeMarkdownLeadingTabs(raw, 4), rawContent: raw, tabSize: 4,
    codeBlockHeaderOption: true, codeFrameNonce: 'tabs', codeBlocksOut: [],
    gfm: true, linkTarget: null, headingOffset: 0, escapeHtmlOption: false, trustedHtmlOption: false,
    highlightCodeOption: false, getCachedHighlight: () => undefined, failedHighlightKeys: new Set(),
    headingAnchorsOption: false, mathOption: false, cachedKatex: null, pendingKeys: [], headingTreeOut: [] });
  const parser = context.instance as unknown as { lexer(source: string, options: unknown): unknown };
  const lexer = parser.lexer.bind(parser); let calls = 0;
  parser.lexer = (source, options) => { calls++; return lexer(source, options); };
  context.render(normalizeMarkdownLeadingTabs(raw, 4));
  expect(calls).equal(0);
});
it('coalesces progressive highlight repaint requests and cancels them on disconnect', async () => {
  const el = document.createElement('lr-markdown'); el.streaming = true; el.streamingRender = 'progressive';
  el.withoutSyntaxHighlighting = true; el.content = '# Stable\n\n' + 'paragraph\n\n'.repeat(1000) + 'tail';
  el.highlights = [{ id: 'stable', anchor: { kind: 'text-quote', quote: 'Stable' } }];
  document.body.append(el);
  try {
    await loadMarkdownDeps(); await el.updateComplete; await settleProgressiveHighlightRepaint(el);
    const seam = el as unknown as { repaintHighlights(): void; updated(changed: Map<string, unknown>): void };
    let paints = 0; const original = seam.repaintHighlights.bind(el);
    seam.repaintHighlights = () => { paints++; original(); };
    for (let index = 0; index < 20; index++) seam.updated(new Map([['streamingTail', null]]));
    expect(paints).equal(0);
    // wait-reason: observe the real 100ms debounce window to reject extra paints after the burst.
    await new Promise(resolve => setTimeout(resolve, 130)); expect(paints).equal(1);
    recordScaleMeasurement('lr-markdown', 'n=1000 paragraphs20 highlight requests', { paints });
    seam.updated(new Map([['streamingTail', null]])); el.remove();
    // wait-reason: pass the scheduled 100ms deadline to prove disconnect cancelled the repaint.
    await new Promise(resolve => setTimeout(resolve, 130)); expect(paints).equal(1);
  } finally { el.remove(); }
});
it('settles a document whose highlighted output exceeds the shared byte budget', async () => {
  const el = document.createElement('lr-markdown'); let calls = 0;
  (el as unknown as { tokenizePendingHighlight(pending: PendingHighlight): Promise<string> }).tokenizePendingHighlight = async pending => {
    calls++;
    if (calls > 160) return null as unknown as string;
    return `<pre part="code-block"><code><span>${pending.code}${' '.repeat(22000)}</span></code></pre>`;
  };
  document.body.append(el);
  try {
    await el.updateComplete;
    el.content = Array.from({ length: 80 }, (_, index) => '```json\nbyte-pressure-' + index + '\n```\n\n').join('');
    for (let frame = 0; frame < 40; frame++) { await nextFrame(); await el.updateComplete; }
    expect(calls).equal(80);
    expect(el.shadowRoot!.querySelectorAll('[part="code-block"] span').length).greaterThan(0);
  } finally { el.remove(); }
});
it('keeps full fallback grammars out of the core shared cache', async () => {
  const full = document.createElement('lr-markdown'), core = document.createElement('lr-markdown-core');
  const languages = {}; full.languages = languages; core.languages = languages;
  document.body.append(full, core);
  try {
    await Promise.all([full.updateComplete, core.updateComplete]);
    const key = markdownHighlightKey('javascript', 'full fallback only');
    const writer = full as unknown as { setCachedHighlight(key: string, html: string): boolean };
    const reader = core as unknown as { getCachedHighlight(key: string): string | undefined };
    writer.setCachedHighlight(key, '<pre>full fallback</pre>');
    expect(reader.getCachedHighlight(key)).equal(undefined);
  } finally { full.remove(); core.remove(); }
});
import { labelMarkdownTableWrappers, markdownHasTableWrappers } from './markdown-shared.js';
it('labels a newly committed table wrapper from a foreign document', async () => {
  const iframe = document.createElement('iframe'); document.body.append(iframe);
  try {
    const wrapper = iframe.contentDocument!.createElement('div');
    wrapper.setAttribute('part', 'table-wrapper'); wrapper.setAttribute('role', 'group');
    expect(markdownHasTableWrappers(wrapper)).equal(true);
    labelMarkdownTableWrappers(wrapper, 'Localized table');
    expect(wrapper.getAttribute('aria-label')).equal('Localized table');
  } finally { iframe.remove(); }
});
it('discovers appended chrome without enumerating the retained root collection', async () => {
  const el = document.createElement('lr-markdown'); el.streaming = true; el.streamingRender = 'progressive';
  el.withoutSyntaxHighlighting = true; el.content = '# stable\n\n'.repeat(1000) + 'tail'; document.body.append(el);
  try {
    await loadMarkdownDeps(); await el.updateComplete; await nextFrame(); await el.updateComplete;
    const root = el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
    let reads = 0; const children = root.children;
    Object.defineProperty(root, 'children', { get() { reads++; return children; }, configurable: true });
    el.content += '\n\n# New\n\nnext'; await el.updateComplete; await nextFrame(); await el.updateComplete;
    expect(reads).equal(0);
  } finally { el.remove(); }
});
it('extends the rendered progressive highlight index without rescanning settled text', async () => {
  const el = document.createElement('lr-markdown'); el.streaming = true; el.streamingRender = 'progressive'; el.withoutSyntaxHighlighting = true;
  el.content = '# Needle\n\n' + 'paragraph\n\n'.repeat(1000) + 'tail';
  el.highlights = [{ id: 'needle', anchor: { kind: 'text-quote', quote: 'Needle' } }]; document.body.append(el);
  try {
    await loadMarkdownDeps(); await el.updateComplete; await settleProgressiveHighlightRepaint(el);
    const seam = el as unknown as { textQuoteIndexCache: { index: { scannedCodeUnits: number } } };
    const previous = seam.textQuoteIndexCache.index, units = previous.scannedCodeUnits;
    el.content += '\n\n# Added\n\nnext'; await el.updateComplete; await settleProgressiveHighlightRepaint(el);
    expect(seam.textQuoteIndexCache.index === previous).equal(true);
    expect(previous.scannedCodeUnits - units).at.most(100);
    recordScaleMeasurement('lr-markdown', 'n=1000 paragraphs append highlight search', { scannedCodeUnits: previous.scannedCodeUnits - units });
  } finally { el.remove(); }
});
import { MarkdownCodeHeaderController, renderMarkdownCodeHeader } from './markdown-code-header.js';
it('creates a header on a newly committed foreign-document code frame', async () => {
  const iframe = document.createElement('iframe'); document.body.append(iframe);
  const host = document.createElement('lr-markdown'); document.body.append(host);
  let controller: MarkdownCodeHeaderController | undefined;
  try {
    await host.updateComplete;
    const root = iframe.contentDocument!.createElement('div'); const frame = iframe.contentDocument!.createElement('div');
    root.append(frame); iframe.contentDocument!.body.append(root);
    controller = new MarkdownCodeHeaderController(host, { isEnabled: () => true, contentVersion: () => 1,
      getContentRoot: () => root, getChangedRoots: () => [frame], localize: key => key,
      buildHeader: renderMarkdownCodeHeader, emitCopy() {}, emitCopyError() {} });
    frame.setAttribute('data-lr-code-frame', `${controller.nonce}:0`);
    controller.setBlocks([{ language: 'text', source: 'source', ordinal: 0 }]); controller.hostUpdated();
    expect(frame.querySelectorAll('button').length).equal(1);
  } finally { controller?.hostDisconnected(); host.remove(); iframe.remove(); }
});
it('does no retained metadata or template work for a progressive tail-only update', async function () {
  this.timeout(30000); // Budget for a heavily loaded multi-browser host; the asserted bounds are unchanged.
  const el = document.createElement('lr-markdown'); el.streaming = true; el.streamingRender = 'progressive'; el.withoutSyntaxHighlighting = true;
  el.content = Array.from({ length: 1000 }, (_, index) => `# ${index} ${'x'.repeat(2050)}\n\n`).join('') + 'tail';
  document.body.append(el);
  try {
    await loadMarkdownDeps(); await el.updateComplete;
    const seam = el as unknown as { progressiveSession: { blocks: Array<{ html: string; headings: unknown[]; codeBlocks: unknown[] }>; pending: boolean }; renderedBlocks: Array<{ html: string }> };
    for (let frame = 0; frame < 80 && (!seam.progressiveSession || seam.progressiveSession.pending); frame++) { await nextFrame(); await el.updateComplete; }
    expect(seam.progressiveSession.blocks.length).at.least(1000);
    let reads = 0;
    for (const block of seam.progressiveSession.blocks) for (const key of ['html', 'headings', 'codeBlocks'] as const) {
      const value = block[key]; Object.defineProperty(block, key, { configurable: true, get() { reads++; return value; } });
    }
    for (const block of seam.renderedBlocks) { const value = block.html; Object.defineProperty(block, 'html', { configurable: true, get() { reads++; return value; } }); }
    el.content += ' more'; await el.updateComplete; await nextFrame(); await el.updateComplete;
    expect(reads).equal(0);
    recordScaleMeasurement('lr-markdown', 'n=1000 committed groups tail metadata', { retainedReads: reads });
    reads = 0;
    el.content += '\n\n# Added\n\nnext'; await el.updateComplete; await nextFrame(); await el.updateComplete;
    expect(reads).equal(0);
    recordScaleMeasurement('lr-markdown', 'n=1000 committed groups append metadata', { retainedReads: reads });
  } finally { el.remove(); }
});
