import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { renderedTemplateWhitespace } from '../rendered-whitespace.js';
import type { LyraStreamingTextCore } from '../../src/components/conversation/streaming-text/streaming-text-core.class.js';
import type { LyraStreamingText } from '../../src/components/conversation/streaming-text/streaming-text.class.js';

export function assertStreamingTextWhitespace(tag: 'lr-streaming-text' | 'lr-streaming-text-core'): void {
describe('template whitespace', () => {
  type StreamingElement = LyraStreamingTextCore | LyraStreamingText;
  const PRE_WRAP = 'white-space: pre-wrap';

  async function mount(
    mode: 'plain' | 'markdown',
    options: { streaming?: boolean; wrapperStyle?: string; content?: string } = {},
  ): Promise<StreamingElement> {
    const wrapper = await fixture<HTMLDivElement>(html`<div style=${options.wrapperStyle ?? ''}></div>`);
    const el = document.createElement(tag) as StreamingElement;
    el.contentMode = mode;
    el.streaming = options.streaming ?? false;
    el.content = options.content ?? 'Hello streamed reply';
    wrapper.appendChild(el);
    await el.updateComplete;
    return el;
  }

  const markdownOf = (el: StreamingElement): HTMLElement & { updateComplete: Promise<boolean> } =>
    el.shadowRoot!.querySelector('lr-markdown, lr-markdown-core') as HTMLElement & {
      updateComplete: Promise<boolean>;
    };

  const markdownContent = (el: StreamingElement): HTMLElement | null =>
    markdownOf(el)?.shadowRoot?.querySelector<HTMLElement>('[part="content"]') ?? null;

  const plainSpan = (el: StreamingElement): HTMLElement | null => el.shadowRoot!.querySelector<HTMLElement>('.plain');

  const plainSettled = (el: StreamingElement): Promise<void> =>
    waitUntil(() => plainSpan(el)?.textContent === el.content, 'the plain text never caught up');

  /** One space in the base font plus the cursor's resolved inline-start margin. */
  function expectedCursorGap(el: StreamingElement): number {
    const base = el.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    const space = document.createElement('span');
    space.style.whiteSpace = 'pre';
    space.textContent = ' ';
    const margin = document.createElement('div');
    margin.style.inlineSize = 'var(--lr-space-xs)';
    base.append(space, margin);
    const width = space.getBoundingClientRect().width + margin.getBoundingClientRect().width;
    space.remove();
    margin.remove();
    return width;
  }

  function cursorGap(el: StreamingElement): number {
    const text = Array.from(plainSpan(el)!.childNodes).find(
      (node): node is Text => node instanceof Text && node.data !== '',
    )!;
    const range = document.createRange();
    range.setStart(text, text.data.length - 1);
    range.setEnd(text, text.data.length);
    const cursor = el.shadowRoot!.querySelector<HTMLElement>('[part="cursor"]')!;
    return cursor.getBoundingClientRect().left - range.getBoundingClientRect().right;
  }

  it('streams Markdown with exact fallback text and no template whitespace, then parses', async () => {
    const el = await mount('markdown', { streaming: true, content: '' });
    for (const chunk of ['Hello', ' streamed', ' reply', ' in', ' chunks.']) {
      el.content += chunk;
      await waitUntil(() => markdownContent(el)?.textContent === el.content, 'the Markdown fallback never caught up');
    }
    await waitUntil(() => markdownContent(el)?.textContent === el.content, 'the Markdown fallback never caught up');
    expect(renderedTemplateWhitespace(el.shadowRoot!)).to.deep.equal([]);
    el.streaming = false;
    await waitUntil(
      () => markdownContent(el)?.querySelector('[part="paragraph"]') != null,
      'the Markdown never parsed',
    );
    expect(renderedTemplateWhitespace(el.shadowRoot!)).to.deep.equal([]);
  });

  it('keeps plain-mode text exact and one space before the cursor', async () => {
    const el = await mount('plain', { streaming: true });
    await plainSettled(el);
    expect(renderedTemplateWhitespace(el.shadowRoot!)).to.deep.equal([]);
    expect(cursorGap(el)).to.be.closeTo(expectedCursorGap(el), 1);
  });

  it('renders no template whitespace under an inherited pre-wrap', async () => {
    for (const [mode, streaming] of [
      ['plain', true],
      ['plain', false],
      ['markdown', true],
    ] as const) {
      const label = `${mode}, streaming=${streaming}`;
      const reference = await mount(mode, { streaming });
      const el = await mount(mode, { streaming, wrapperStyle: PRE_WRAP });
      if (mode === 'plain') {
        await plainSettled(reference);
        await plainSettled(el);
      } else {
        await waitUntil(() => markdownContent(el)?.textContent === el.content, label);
        await waitUntil(() => markdownContent(reference)?.textContent === reference.content, label);
      }
      expect(renderedTemplateWhitespace(el.shadowRoot!), label).to.deep.equal([]);
      expect(el.getBoundingClientRect().height, label).to.be.closeTo(reference.getBoundingClientRect().height, 1);
      if (mode === 'plain' && streaming) {
        expect(cursorGap(el), label).to.be.closeTo(expectedCursorGap(el), 1);
        await expect(el).to.be.accessible();
      }
    }
  });
});
}
