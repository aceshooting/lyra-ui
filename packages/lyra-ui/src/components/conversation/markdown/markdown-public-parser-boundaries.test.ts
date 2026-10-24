import { expect, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { preloadMarkdown, type LyraMarkdown } from './markdown.js';
import type { LyraMarkdownCore } from './markdown-core.js';
import './markdown-core.js';

type MarkdownElement = LyraMarkdown | LyraMarkdownCore;
const mounted: MarkdownElement[] = [];
afterEach(() => { for (const element of mounted.splice(0)) element.remove(); });

async function mount(tag: 'lr-markdown' | 'lr-markdown-core'): Promise<MarkdownElement> {
  await preloadMarkdown();
  const element = document.createElement(tag);
  element.withoutSyntaxHighlighting = true;
  mounted.push(element);
  document.body.append(element);
  await waitUntil(() => element.marked !== undefined);
  await element.updateComplete;
  return element;
}

for (const tag of ['lr-markdown', 'lr-markdown-core'] as const) {
  it(`${tag} applies its configured token walker to committed streaming blocks and completion`, async () => {
    const element = await mount(tag);
    element.marked!.use({ walkTokens(token: { type?: string; text?: string }) {
      if (token.type === 'text' && typeof token.text === 'string') token.text = token.text.replace('TOKEN', 'configured');
    } });
    element.streaming = true;
    element.streamingRender = 'progressive';
    element.content = '# Stable\n\n**TOKEN**\n\nlive tail';
    await element.updateComplete;
    await waitUntil(() => element.shadowRoot!.querySelector('strong')?.textContent === 'configured');
    const heading = element.shadowRoot!.querySelector('h1')!;
    element.content += ' appended';
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('h1') === heading).to.equal(true);
    expect(element.shadowRoot!.querySelector('strong')?.textContent).to.equal('configured');
    expect(element.shadowRoot!.querySelector('[part="streaming-tail"]')?.textContent).to.equal('live tail appended');
    element.streaming = false;
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('strong')?.textContent).to.equal('configured');
    expect(element.shadowRoot!.querySelectorAll('[part="streaming-tail"]').length).to.equal(0);
  });

  it(`${tag} copies source tabs after configured preprocessing and token processing`, async () => {
    const element = await mount(tag);
    element.marked!.use({ hooks: {
      preprocess(source: string) { return source.replace('TOKEN', 'configured'); },
      processAllTokens(tokens: unknown) { return tokens; },
    } });
    element.codeBlockHeader = true;
    element.content = '```make\n\tTOKEN\n```';
    await element.updateComplete;
    await waitUntil(() => element.shadowRoot!.querySelector('[part~="code-block-copy"]') !== null);
    expect(element.shadowRoot!.querySelector('pre')?.textContent).to.contain('configured');
    const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', { configurable: true,
      value: { writeText: async (text: string) => { writes.push(text); } } });
    try {
      const button = element.shadowRoot!.querySelector<HTMLButtonElement>('[part~="code-block-copy"]')!;
      await focusByKeyboard(button);
      const copied = oneEvent(element, 'lr-copy');
      await sendKeys({ press: 'Enter' });
      const event = await copied;
      expect(event.detail).to.deep.equal({ ok: true, text: '\tconfigured' });
      expect(writes).to.deep.equal(['\tconfigured']);
      expect(event.bubbles && event.composed).to.equal(true);
    } finally {
      if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it(`${tag} exposes escaped source for a malformed parser result and recovers through the public refresh method`, async () => {
    const element = await mount(tag);
    let returnMarkup = false;
    element.marked!.use({ hooks: {
      postprocess(markup: string) { return returnMarkup ? markup : { invalid: 'parser result' }; },
    } });
    const source = '# Safe\n\n<span onclick="void 0">Raw text</span>';
    const failed = oneEvent(element, 'lr-render-error');
    element.content = source;
    const event = await failed;
    await element.updateComplete;
    expect(event.bubbles && event.composed).to.equal(true);
    expect(event.detail.error instanceof TypeError).to.equal(true);
    expect(element.shadowRoot!.querySelector('[part="content"]')?.textContent).to.equal(source);
    expect(element.shadowRoot!.querySelectorAll('[part="content"] h1, [part="content"] span').length).to.equal(0);
    returnMarkup = true;
    element.renderMarkdown();
    await element.updateComplete;
    await waitUntil(() => element.shadowRoot!.querySelector('h1')?.textContent === 'Safe');
    expect(element.shadowRoot!.querySelector('[part="content"] span')?.textContent).to.equal('Raw text');
    expect(element.shadowRoot!.querySelectorAll('[part="content"] [onclick]').length).to.equal(0);
  });
}
