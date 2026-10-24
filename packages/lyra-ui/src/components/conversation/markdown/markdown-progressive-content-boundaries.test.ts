import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { preloadMarkdown, type LyraMarkdown } from './markdown.js';
import type { LyraMarkdownCore } from './markdown-core.js';
import './markdown-core.js';

type MarkdownElement = LyraMarkdown | LyraMarkdownCore;
type MarkdownTag = 'lr-markdown' | 'lr-markdown-core';
async function mount(tag: MarkdownTag, source: string, streaming = true, headers = false): Promise<MarkdownElement> {
  await preloadMarkdown();
  const wrapper = await fixture<HTMLDivElement>(html`<div></div>`);
  const element = document.createElement(tag);
  element.withoutSyntaxHighlighting = true;
  element.codeBlockHeader = headers;
  element.streamingRender = 'progressive';
  element.streaming = streaming;
  element.content = source;
  wrapper.append(element);
  await element.updateComplete;
  await waitUntil(() => element.shadowRoot!.querySelector('[part="content"] h1') !== null, 'the heading has rendered');
  return element;
}
const content = (element: MarkdownElement) => element.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
const documentText = (element: MarkdownElement) => [...content(element).querySelectorAll('h1, p, pre code')]
  .map(node => ({ tag: node.localName, text: node.textContent }));
async function complete(element: MarkdownElement): Promise<void> {
  element.streaming = false;
  await element.updateComplete;
  await waitUntil(() => content(element).querySelector('[part="streaming-tail"]') === null, 'the stream is fully parsed');
}

for (const tag of ['lr-markdown', 'lr-markdown-core'] as const) {
  it(`${tag} retains Unicode separators while normalizing following streamed indentation`, async () => {
    const prefix = '# Stable\n\n';
    let body = 'before\u2028 \tsecond\u2029\tthird\n';
    const element = await mount(tag, prefix + body);
    expect(content(element).querySelector('[part="streaming-tail"]')?.textContent)
      .to.equal('before\u2028    second\u2029    third\n');
    body += 'last **phrase**\n';
    element.content = prefix + body;
    await element.updateComplete;
    expect(content(element).querySelector('[part="streaming-tail"]')?.textContent)
      .to.equal('before\u2028    second\u2029    third\nlast **phrase**\n');
    await complete(element);
    const reference = await mount(tag, prefix + body, false);
    expect(documentText(element)).to.deep.equal(documentText(reference));
    expect(content(element).querySelector('strong')?.textContent).to.equal('phrase');
    expect(content(element).querySelector('p')?.textContent).to.contain('before\u2028    second\u2029    third');
  });

  it(`${tag} keeps a long unsettled paragraph current across small appended chunks`, async () => {
    const prefix = '# Stable\n\n';
    let body = `${'paragraph text '.repeat(1200)}continued\n`;
    const element = await mount(tag, prefix + body);
    const heading = content(element).querySelector('h1')!;
    expect(body.length).to.be.greaterThan(16_384);
    for (const chunk of ['first appended line\n', 'second appended line\n', 'last appended line\n']) {
      body += chunk;
      element.content = prefix + body;
      await element.updateComplete;
      expect(content(element).querySelector('h1') === heading).to.equal(true);
      expect(content(element).querySelector('[part="streaming-tail"]')?.textContent).to.equal(body);
    }
    await complete(element);
    expect(content(element).querySelector('h1') === heading).to.equal(true);
    expect(content(element).querySelector('p')?.textContent).to.equal(body.trimEnd());
    const reference = await mount(tag, prefix + body, false);
    expect(documentText(element)).to.deep.equal(documentText(reference));
  });

  for (const indentation of [1, 2, 3]) {
    it(`${tag} preserves literal code while completing a fence indented by ${indentation} spaces`, async () => {
      const pad = ' '.repeat(indentation);
      const code = 'const\tanswer = 42;\n  nested();';
      const opening = `# Code\n\n${pad}\`\`\`text\n${pad}const\tanswer = 42;\n${pad}  nested();\n`;
      const element = await mount(tag, opening, true, true);
      expect(content(element).querySelector('pre[part="code-block"]')?.textContent).to.equal(`${code}\n`);
      expect(content(element).querySelectorAll('[part="code-block-header"]').length).to.equal(0);
      const closed = `${opening}${pad}\`\`\`\n\nAfter the code\n`;
      element.content = closed;
      await element.updateComplete;
      await waitUntil(() => content(element).querySelector('[part~="code-block-copy"]') !== null, 'the closed fence has a copy control');
      await complete(element);
      const reference = await mount(tag, closed, false, true);
      expect(documentText(element)).to.deep.equal(documentText(reference));
      expect(content(element).querySelector('pre code')?.textContent).to.equal(`${code}\n`);
      const writes: string[] = [];
      const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: async (text: string) => { writes.push(text); } },
      });
      try {
        const copied = oneEvent(element, 'lr-copy');
        content(element).querySelector<HTMLButtonElement>('[part~="code-block-copy"]')!.click();
        await copied;
        expect(writes).to.deep.equal([code]);
      } finally {
        if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    });
  }
}
