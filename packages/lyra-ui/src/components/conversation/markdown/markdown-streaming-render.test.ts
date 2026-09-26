import { expect, oneEvent, waitUntil } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import type { MessagePart } from '../../../ai/types.js';
import './markdown.js';
import './markdown-core.js';
import '../streaming-text/streaming-text.js';
import '../streaming-text/streaming-text-core.js';
import '../message-parts/message-parts.js';
import { preloadMarkdown } from './markdown.js';

type MarkdownHost = HTMLElement & {
  content: string;
  streaming: boolean;
  streamingRender: 'plain' | 'progressive';
  headingAnchors: boolean;
  codeBlockChrome: boolean;
  highlightCode: boolean;
  languages: Record<string, unknown>;
  marked?: unknown;
  updateComplete: Promise<boolean>;
  renderMarkdown(): void;
};

const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const element of mounted.splice(0)) element.remove();
  window.getSelection()?.removeAllRanges();
});

function mountMarkdown(
  tag: 'lr-markdown' | 'lr-markdown-core',
  content: string,
): MarkdownHost {
  const el = document.createElement(tag) as MarkdownHost;
  el.content = content;
  el.streaming = true;
  el.streamingRender = 'progressive';
  mounted.push(el);
  document.body.append(el);
  return el;
}

async function contentRoot(el: MarkdownHost): Promise<HTMLElement> {
  await el.updateComplete;
  await waitUntil(
    () => Boolean(el.shadowRoot?.querySelector('[part="content"] h1, [part="content"] h2')),
    'progressive Markdown heading did not reach the rendered content',
  );
  return el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
}

it('recovers progressive output for both tags when the first optional-peer load settles', async () => {
  const source = '# Ready\n\nSettled **paragraph**\n\nlive first\n  live second  \n';
  const full = mountMarkdown('lr-markdown', source);
  const core = mountMarkdown('lr-markdown-core', source);

  await Promise.all([full.updateComplete, core.updateComplete]);
  expect(full.getAttribute('aria-busy')).to.equal('true');
  expect(core.getAttribute('aria-busy')).to.equal('true');

  await preloadMarkdown();
  const roots = await Promise.all([contentRoot(full), contentRoot(core)]);
  for (const root of roots) {
    expect(root.querySelector('h1')?.textContent).to.equal('Ready');
    expect(root.querySelector('p strong')?.textContent).to.equal('paragraph');
    const tail = root.querySelector<HTMLElement>('[part="streaming-tail"]');
    expect(tail?.textContent).to.equal('live first\n  live second  \n');
    expect(tail ? getComputedStyle(tail).whiteSpace : '').to.equal('pre-wrap');
  }
});

it('keeps settled heading nodes and selection stable where supported as the exact multiline tail grows', async () => {
  await preloadMarkdown();
  const source = '# Stable\n\nSettled **portion**\n\nlive first\n  live second  \n';

  for (const tag of ['lr-markdown', 'lr-markdown-core'] as const) {
    const el = mountMarkdown(tag, source);
    const root = await contentRoot(el);
    const heading = root.querySelector('h1');
    const strong = root.querySelector('strong');
    const selectedText = strong?.firstChild;
    expect(Boolean(heading && strong && selectedText)).to.equal(true);
    if (!heading || !strong || !selectedText) continue;

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(selectedText, 0);
    range.setEnd(selectedText, 'portion'.length);
    selection?.removeAllRanges();
    selection?.addRange(range);
    // WebKit rejects programmatic Selection ranges whose endpoints are inside a shadow tree;
    // markdown.test.ts documents the same engine limitation for composed selection events.
    const nativeShadowSelection = Boolean(
      selection && selection.rangeCount > 0 && selection.anchorNode === selectedText,
    );

    el.content = `${source} appended`;
    await el.updateComplete;
    const updatedRoot = el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
    expect(updatedRoot.querySelector('h1') === heading).to.equal(true);
    if (nativeShadowSelection) expect(selection?.anchorNode === selectedText).to.equal(true);
    else expect(selectedText.isConnected).to.equal(true);
    expect(updatedRoot.textContent?.endsWith('live first\n  live second  \n appended')).to.equal(true);
  }
});

it('appends to the same tail Text node without collapsing live range offsets', async () => {
  await preloadMarkdown();
  for (const tag of ['lr-markdown', 'lr-markdown-core'] as const) {
    const el = mountMarkdown(tag, '# Stable\n\nselected tail');
    const root = await contentRoot(el);
    const tail = root.querySelector('[part="streaming-tail"]')!;
    const text = [...tail.childNodes].find((node) => node.nodeType === Node.TEXT_NODE)!;
    const range = document.createRange();
    range.setStart(text, 2); range.setEnd(text, 8);
    el.content += ' appended'; await el.updateComplete;
    expect(range.startContainer === text && range.endContainer === text).to.equal(true);
    expect([range.startOffset, range.endOffset]).to.deep.equal([2, 8]);
    expect(text.textContent).to.equal('selected tail appended');
  }
});

it('adopts identical settled output at completion and keeps normalized blank lines out of the tail', async () => {
  await preloadMarkdown();
  for (const tag of ['lr-markdown', 'lr-markdown-core'] as const) {
    const el = mountMarkdown(tag, '# Stable\r\n\r\n');
    const root = await contentRoot(el);
    const heading = root.querySelector('h1');
    expect(root.querySelector('[part="streaming-tail"]') === null).to.equal(true);
    el.streaming = false; await el.updateComplete;
    expect(root.querySelector('h1') === heading).to.equal(true);
    el.streaming = true; el.content += 'next tail'; await el.updateComplete;
    expect(root.querySelector('h1') === heading).to.equal(true);
    expect(root.querySelector('[part="streaming-tail"]')?.textContent).to.equal('next tail');
  }
});

it('keeps an open fence literal and LTR without highlight or chrome until its closing fence arrives', async () => {
  await preloadMarkdown();
  for (const tag of ['lr-markdown', 'lr-markdown-core'] as const) {
    const el = mountMarkdown(tag, '# Code\n\n```javascript\nconst answer = 42;\n');
    el.codeBlockChrome = true;
    el.highlightCode = true;
    await el.updateComplete;
    const root = await contentRoot(el);
    const open = root.querySelector<HTMLElement>('pre[part="code-block"]');
    expect(Boolean(open)).to.equal(true);
    expect(open ? getComputedStyle(open).direction : '').to.equal('ltr');
    expect(open?.textContent).to.equal('const answer = 42;\n');
    expect(open?.querySelector('span') === null).to.equal(true);
    expect(root.querySelector('[part="code-block-header"]') === null).to.equal(true);

    el.content += '```\n\nAfter the code block\n';
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="code-block-frame"] pre') !== null,
      'closed streaming fence did not commit as a Markdown code block',
    );
    expect(el.shadowRoot!.querySelectorAll('[part="code-block-frame"]').length).to.equal(1);
  }
});

it('resets replaced sources and parses full-document references when streaming completes', async () => {
  await preloadMarkdown();
  const referenceSource =
    '# Current\n\nSee [guide][guide].\n\n[guide]: https://example.com/docs\n\nNext block\n';

  for (const tag of ['lr-markdown', 'lr-markdown-core'] as const) {
    const el = mountMarkdown(tag, '# Previous\n\nold live tail');
    const firstRoot = await contentRoot(el);
    expect(firstRoot.querySelector('h1')?.textContent).to.equal('Previous');

    el.content = referenceSource;
    await el.updateComplete;
    const replacementRoot = await contentRoot(el);
    expect(replacementRoot.querySelectorAll('h1')).to.have.lengthOf(1);
    expect(replacementRoot.querySelector('h1')?.textContent).to.equal('Current');
    expect(replacementRoot.textContent?.includes('Previous')).to.equal(false);

    el.streaming = false;
    await el.updateComplete;
    await waitUntil(
      () => replacementRoot.querySelector('a[href="https://example.com/docs"]') !== null,
      'final Markdown parse did not resolve a document-level reference link',
    );
    expect(replacementRoot.querySelector('a')?.textContent).to.equal('guide');
  }
});

it('keeps aria-busy during streaming and emits composed settle events after tail and completion updates', async () => {
  await preloadMarkdown();
  for (const tag of ['lr-markdown', 'lr-markdown-core'] as const) {
    const el = mountMarkdown(tag, '# Busy\n\ncurrent tail');
    await contentRoot(el);
    expect(el.getAttribute('aria-busy')).to.equal('true');

    const appended = oneEvent(el, 'lr-content-settled');
    el.content += ' extended';
    const appendEvent = await appended as CustomEvent<null>;
    expect(appendEvent.detail).to.equal(null);
    expect(appendEvent.bubbles && appendEvent.composed).to.equal(true);
    expect(el.shadowRoot!.querySelector('[part="streaming-tail"]')?.textContent).to.equal('current tail extended');
    expect(el.getAttribute('aria-busy')).to.equal('true');

    const completed = oneEvent(el, 'lr-content-settled');
    el.streaming = false;
    const completionEvent = await completed as CustomEvent<null>;
    expect(completionEvent.detail).to.equal(null);
    await el.updateComplete;
    expect(el.hasAttribute('aria-busy')).to.equal(false);
  }
});

it('keeps settled nodes, selection, and repeated heading ids stable through async Shiki refresh', async function () {
  this.timeout(60_000);
  await preloadMarkdown();
  const source = [
    '# Repeat',
    '',
    'Selected **phrase** remains.',
    '',
    '```json',
    '{"initial":true}',
    '```',
    '',
    '> ## Repeat',
    '>',
    '> - nested item',
    '>',
    '>   ### Repeat',
    '>',
    '>   ```json',
    '>   {"nested":true}',
    '>   ```',
    '',
    'live tail',
  ].join('\n');

  for (const tag of ['lr-markdown', 'lr-markdown-core'] as const) {
    const el = mountMarkdown(tag, '# Repeat\n\nSelected **phrase** remains.\n\n');
    el.headingAnchors = true;
    await contentRoot(el);
    el.content = source;
    el.highlightCode = true;
    el.languages = { json: jsonGrammar };
    await contentRoot(el);

    const root = el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
    await waitUntil(
      () => root.querySelectorAll('h1, h2, h3').length === 3,
      `nested quote/list headings were not fully rendered: ${root.innerHTML}`,
    );
    expect(root.querySelectorAll('[part="code-block"]').length).to.equal(2);
    const paragraph = root.querySelector('p');
    const strong = paragraph?.querySelector('strong');
    const selectedText = strong?.firstChild;
    expect(Boolean(paragraph && strong && selectedText)).to.equal(true);
    if (!paragraph || !selectedText) continue;

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(selectedText, 0);
    range.setEnd(selectedText, 'phrase'.length);
    selection?.removeAllRanges();
    selection?.addRange(range);
    // WebKit rejects programmatic Selection ranges whose endpoints are inside a shadow tree;
    // markdown.test.ts documents the same engine limitation for composed selection events.
    const nativeShadowSelection = Boolean(
      selection && selection.rangeCount > 0 && selection.anchorNode === selectedText,
    );
    const headings = [...root.querySelectorAll<HTMLElement>('h1, h2, h3')];
    const headingIds = headings.map((heading) => heading.id);
    expect(headingIds.length).to.equal(3);
    expect(new Set(headingIds).size).to.equal(3);

    // Progressive mode starts the lazy Shiki request for this settled fence. Append while that
    // request is still in flight so its eventual HTML replacement preserves settled document state.
    el.content = `${source}\nappended after code`;
    await el.updateComplete;
    expect(root.querySelector('p') === paragraph).to.equal(true);
    if (nativeShadowSelection) expect(selection?.anchorNode === selectedText).to.equal(true);
    else expect(selectedText.isConnected).to.equal(true);

    await waitUntil(
      () => root.querySelectorAll('[part="code-block"] span').length >= 2,
      'settled fenced code blocks did not receive Shiki token spans',
      { timeout: 45_000 },
    );
    expect(root.querySelector('p') === paragraph).to.equal(true);
    if (nativeShadowSelection) expect(selection?.anchorNode === selectedText).to.equal(true);
    else expect(selectedText.isConnected).to.equal(true);
    expect([...root.querySelectorAll<HTMLElement>('h1, h2, h3')].map((heading) => heading.id))
      .to.deep.equal(headingIds);
    expect(root.textContent?.includes('appended after code')).to.equal(true);
  }
});

it('falls back to plain streaming for a custom preprocess hook and uses it on completion', async () => {
  await preloadMarkdown();
  const source = '# Refresh\n\nCONFIGURED_TOKEN\n\nlive tail';
  const originalWarn = console.warn;
  const warnings: string[] = [];
  console.warn = (...values: unknown[]) => warnings.push(values.map(String).join(' '));
  try {
  for (const tag of ['lr-markdown', 'lr-markdown-core'] as const) {
    const el = mountMarkdown(tag, source);
    await contentRoot(el);
    await waitUntil(() => Boolean(el.marked), 'instance parser did not load');
    const parser = el.marked as {
      use(extension: { hooks: { preprocess(value: string): string } }): void;
    };
    parser.use({
      hooks: {
        preprocess(value) {
          return value.replace('CONFIGURED_TOKEN', '**configured parser**');
        },
      },
    });

    el.renderMarkdown();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')?.textContent).to.equal(source);
    el.streaming = false;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="content"] strong')?.textContent === 'configured parser');
    expect(el.shadowRoot!.querySelector('[part="content"]')?.textContent?.includes('CONFIGURED_TOKEN')).to.equal(false);
  }
  expect(warnings.some((warning) => warning.includes('plain streaming'))).to.equal(true);
  } finally { console.warn = originalWarn; }
});

it('forwards progressive mode through both streaming-text variants and message text/reasoning parts', async () => {
  await preloadMarkdown();
  for (const [tag, markdownTag] of [
    ['lr-streaming-text', 'lr-markdown'],
    ['lr-streaming-text-core', 'lr-markdown-core'],
  ] as const) {
    const el = document.createElement(tag) as HTMLElement & {
      content: string;
      streaming: boolean;
      coalesceMs: number;
      updateComplete: Promise<boolean>;
    };
    el.setAttribute('content-mode', 'markdown');
    el.setAttribute('streaming-render', 'progressive');
    el.content = '# Wrapper\n\nstreaming tail';
    el.streaming = true;
    el.coalesceMs = 0;
    mounted.push(el);
    document.body.append(el);
    await el.updateComplete;
    const nested = el.shadowRoot!.querySelector(markdownTag) as MarkdownHost | null;
    expect(Boolean(nested)).to.equal(true);
    if (!nested) continue;
    await nested.updateComplete;
    expect(nested.streamingRender).to.equal('progressive');
    expect(nested.hasAttribute('streaming-render')).to.equal(false);
    await waitUntil(
      () => Boolean(nested.shadowRoot?.querySelector('[part="content"] h1')),
      `${tag} did not render its settled heading progressively`,
    );
    expect(nested.shadowRoot!.querySelector('[part="content"] h1')?.textContent).to.equal('Wrapper');
  }

  const parts = document.createElement('lr-message-parts') as HTMLElement & {
    parts: readonly MessagePart[];
    showReasoning: boolean;
    updateComplete: Promise<boolean>;
  };
  parts.setAttribute('content-mode', 'markdown');
  parts.setAttribute('streaming-render', 'progressive');
  parts.parts = [
    { id: 'stream-text', type: 'text', state: 'streaming', text: '# Text part\n\ncurrent text' },
    { id: 'stream-reasoning', type: 'reasoning', state: 'streaming', text: '# Reasoning part\n\ncurrent reasoning' },
  ];
  parts.showReasoning = true;
  mounted.push(parts);
  document.body.append(parts);
  await parts.updateComplete;
  const nestedMarkdown = Array.from(parts.shadowRoot!.querySelectorAll('lr-markdown')) as MarkdownHost[];
  expect(nestedMarkdown).to.have.lengthOf(2);
  await Promise.all(nestedMarkdown.map((el) => el.updateComplete));
  expect(nestedMarkdown.every((el) => el.streamingRender === 'progressive')).to.equal(true);
  expect(nestedMarkdown.every((el) => el.streaming)).to.equal(true);
  await waitUntil(
    () => nestedMarkdown.every((el) => Boolean(el.shadowRoot?.querySelector('[part="content"] h1'))),
    'message text and reasoning did not render their settled headings progressively',
  );
  expect(nestedMarkdown.map((el) => el.shadowRoot!.querySelector('[part="content"] h1')?.textContent))
    .to.deep.equal(['Text part', 'Reasoning part']);
});
