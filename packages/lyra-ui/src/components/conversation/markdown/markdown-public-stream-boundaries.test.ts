import { expect, waitUntil } from '@open-wc/testing';
import { preloadMarkdown, type LyraMarkdown } from './markdown.js';
import type { LyraMarkdownCore } from './markdown-core.js';
import './markdown-core.js';

type MarkdownElement = LyraMarkdown | LyraMarkdownCore;
const mounted: MarkdownElement[] = [];
afterEach(() => { for (const element of mounted.splice(0)) element.remove(); });

async function mount(tag: 'lr-markdown' | 'lr-markdown-core', source: string): Promise<MarkdownElement> {
  await preloadMarkdown();
  const element = document.createElement(tag);
  element.withoutSyntaxHighlighting = true;
  element.streaming = true;
  element.streamingRender = 'progressive';
  element.content = source;
  mounted.push(element);
  document.body.append(element);
  await element.updateComplete;
  await waitUntil(() => element.shadowRoot!.querySelector('h1') !== null);
  return element;
}

for (const tag of ['lr-markdown', 'lr-markdown-core'] as const) {
  it(`${tag} completes trusted open HTML as one document and resets it for a later stream`, async () => {
    const element = await mount(tag, '# Ready\n\n');
    element.htmlMode = 'trusted';
    element.codeBlockHeader = true;
    element.content += '<section>\n\n## Nested\n\nlive tail';
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('h2').length).to.equal(0);
    expect(element.shadowRoot!.querySelector('[part="streaming-tail"]')?.textContent).to.equal('<section>\n\n## Nested\n\nlive tail');
    element.streaming = false;
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('section h2')?.textContent).to.equal('Nested');
    expect(element.shadowRoot!.querySelector('section p')?.textContent).to.equal('live tail');
    expect(element.shadowRoot!.querySelectorAll('[part="streaming-tail"]').length).to.equal(0);
    element.content = '';
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="content"]')?.textContent).to.equal('');
    element.streaming = true;
    element.content = '# Replacement\n\nFresh body\n\nnew tail';
    await element.updateComplete;
    await waitUntil(() => element.shadowRoot!.querySelector('h1')?.textContent === 'Replacement');
    expect(element.shadowRoot!.querySelectorAll('section').length).to.equal(0);
    expect(element.shadowRoot!.querySelector('[part="content"]')?.textContent).not.to.contain('Nested');
    expect(element.shadowRoot!.querySelector('[part="streaming-tail"]')?.textContent).to.equal('new tail');
  });

  for (const htmlMode of ['trusted', 'escape'] as const) {
    it(`${tag} preserves settled balanced blocks when completing ${htmlMode} streaming`, async () => {
      const element = await mount(tag, '# Stable\n\nSettled **text**\n\n');
      element.htmlMode = htmlMode;
      await element.updateComplete;
      const heading = element.shadowRoot!.querySelector('h1')!;
      const strong = element.shadowRoot!.querySelector('strong')!;
      element.streaming = false;
      await element.updateComplete;
      expect(element.shadowRoot!.querySelector('h1') === heading).to.equal(true);
      expect(element.shadowRoot!.querySelector('strong') === strong).to.equal(true);
      expect(strong.textContent).to.equal('text');
      expect(element.shadowRoot!.querySelectorAll('[part="streaming-tail"]').length).to.equal(0);
    });
  }

  it(`${tag} settles an earlier update when the caller replaces a stream during the next animation frame`, async () => {
    const element = await mount(tag, '# Initial\n\nold tail');
    element.content = Array.from({ length: 2_000 }, (_, index) => `# Earlier ${index}\n\n`).join('');
    const earlierUpdate = element.updateComplete;
    await new Promise<void>(resolve => {
      requestAnimationFrame(() => {
        element.content = '# Latest\n\n**Current content**\n\nlatest tail';
        resolve();
      });
    });
    await earlierUpdate;
    await element.updateComplete;
    await waitUntil(() => element.shadowRoot!.querySelector('h1')?.textContent === 'Latest');
    expect(element.shadowRoot!.querySelectorAll('h1').length).to.equal(1);
    expect(element.shadowRoot!.querySelector('strong')?.textContent).to.equal('Current content');
    expect(element.shadowRoot!.querySelector('[part="streaming-tail"]')?.textContent).to.equal('latest tail');
    element.streaming = false;
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('[part="content"]')?.textContent).not.to.contain('Earlier');
  });

  it(`${tag} keeps quote navigation usable while deferring fallback marks until streaming completes`, async () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'Highlight');
    Object.defineProperty(window, 'Highlight', { configurable: true, value: undefined });
    let element: MarkdownElement | undefined;
    try {
      element = await mount(tag, '# Quotes\n\nA quoted passage remains readable.\n\n');
      element.highlights = [{ id: 'quote', anchor: { kind: 'text-quote', quote: 'quoted passage' } }];
      element.activeHighlightId = 'quote';
      await element.updateComplete;
      expect(await element.scrollToAnchor({ kind: 'text-quote', quote: 'quoted passage' })).to.equal(true);
      expect(element.shadowRoot!.querySelectorAll('mark[data-lr-highlight-tone]').length).to.equal(0);
      element.content += 'live tail';
      await element.updateComplete;
      expect(await element.scrollToAnchor({ kind: 'text-quote', quote: 'quoted passage' })).to.equal(true);
      expect(element.shadowRoot!.querySelector('[part="streaming-tail"]')?.textContent).to.equal('live tail');
      expect(element.shadowRoot!.querySelectorAll('mark[data-lr-highlight-tone]').length).to.equal(0);
      element.streaming = false;
      await element.updateComplete;
      const completed = element;
      await waitUntil(() => completed.shadowRoot!.querySelector('mark[data-lr-highlight-tone]')?.textContent === 'quoted passage');
      expect(await element.scrollToAnchor({ kind: 'text-quote', quote: 'quoted passage' })).to.equal(true);
      expect(element.shadowRoot!.querySelector('[part="content"]')?.textContent).to.contain('A quoted passage remains readable.');
    } finally {
      element?.remove();
      if (descriptor) Object.defineProperty(window, 'Highlight', descriptor);
      else Reflect.deleteProperty(window, 'Highlight');
    }
  });

  it(`${tag} continues progressive output after adoption into another browsing context`, async () => {
    const element = await mount(tag, '# Original\n\nSettled paragraph\n\nlive tail');
    const frame = document.createElement('iframe');
    document.body.append(frame);
    try {
      const target = frame.contentDocument;
      if (!target) throw new Error('The destination document is unavailable.');
      target.body.append(target.adoptNode(element));
      element.content = '# Adopted\n\n**New content**\n\nforeign tail';
      await element.updateComplete;
      await waitUntil(() => element.shadowRoot!.querySelector('h1')?.textContent === 'Adopted');
      expect(element.ownerDocument === target).to.equal(true);
      expect(element.shadowRoot!.querySelector('strong')?.textContent).to.equal('New content');
      expect(element.shadowRoot!.querySelector('[part="streaming-tail"]')?.textContent).to.equal('foreign tail');
      element.streaming = false;
      await element.updateComplete;
      expect(element.shadowRoot!.querySelectorAll('[part="streaming-tail"]').length).to.equal(0);
      expect(element.shadowRoot!.querySelector('[part="content"]')?.textContent).not.to.contain('Original');
    } finally { element.remove(); frame.remove(); }
  });
}
