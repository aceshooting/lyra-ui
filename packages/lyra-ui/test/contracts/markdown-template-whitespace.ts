import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { inMarkdownCodeBlock, renderedTemplateWhitespace } from '../rendered-whitespace.js';
import { nextFrame } from '../frames.js';
import type { MarkdownRuntimeBase } from '../../src/components/conversation/markdown/markdown-base.class.js';

export function assertMarkdownTemplateWhitespace(tag: 'lr-markdown' | 'lr-markdown-core'): void {
describe('template whitespace', () => {
  type MarkdownElement = MarkdownRuntimeBase;
  type Internals = { deps?: { marked: unknown; DOMPurify: unknown }; renderMarkdown(): void };

  interface MountOptions {
    streaming?: boolean;
    dir?: 'rtl';
    wrapperStyle?: string;
  }

  async function mount(content: string, options: MountOptions = {}): Promise<MarkdownElement> {
    const wrapper = await fixture<HTMLDivElement>(html`<div style=${options.wrapperStyle ?? ''}></div>`);
    const el = document.createElement(tag) as MarkdownElement;
    el.content = content;
    el.streaming = options.streaming ?? false;
    if (options.dir) el.setAttribute('dir', options.dir);
    wrapper.appendChild(el);
    await el.updateComplete;
    return el;
  }

  const contentPart = (el: MarkdownElement): HTMLElement =>
    el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;

  const peersReady = (el: MarkdownElement): Promise<void> =>
    waitUntil(() => (el as unknown as Internals).deps !== undefined, 'the Markdown peers never loaded');

  const rendered = (el: MarkdownElement): Promise<void> =>
    waitUntil(() => !contentPart(el).hasAttribute('data-fallback'), 'the parsed Markdown never rendered');

  function lengthPx(element: HTMLElement, value: string): number {
    if (value.endsWith('px')) return parseFloat(value);
    return parseFloat(value) * parseFloat(getComputedStyle(element).fontSize);
  }

  const lineHeightPx = (part: HTMLElement): number => lengthPx(part, getComputedStyle(part).lineHeight);

  /** The rect of the first glyph of the content text. */
  function firstGlyphRect(part: HTMLElement): DOMRect {
    const text = Array.from(part.childNodes).find(
      (node): node is Text => node instanceof Text && node.data.trim() !== '',
    )!;
    const start = text.data.search(/\S/);
    const range = document.createRange();
    range.setStart(text, start);
    range.setEnd(text, start + 1);
    return range.getBoundingClientRect();
  }

  it('shows exactly content while streaming, with no rendered template whitespace', async () => {
    const el = await mount('Hello streamed reply', { streaming: true });
    const part = contentPart(el);
    expect(part.hasAttribute('data-fallback')).to.be.true;
    expect(part.textContent).to.equal(el.content);
    expect(renderedTemplateWhitespace(el.shadowRoot!)).to.deep.equal([]);
  });

  it('starts the first glyph at the content edge and sizes one line as one line box', async () => {
    const el = await mount('Hello streamed reply', { streaming: true });
    const part = contentPart(el);
    const partRect = part.getBoundingClientRect();
    const glyph = firstGlyphRect(part);
    const lineHeight = lineHeightPx(part);
    expect(glyph.left - partRect.left).to.be.at.most(1);
    expect(glyph.top - partRect.top).to.be.lessThan(lineHeight);
    const minBlockSize = lengthPx(part, getComputedStyle(part).minBlockSize);
    expect(partRect.height).to.be.closeTo(Math.max(minBlockSize, lineHeight), 1);
  });

  it('keeps an empty streaming placeholder at its minimum block size', async () => {
    const el = await mount('', { streaming: true });
    const part = contentPart(el);
    const minBlockSize = lengthPx(part, getComputedStyle(part).minBlockSize);
    expect(part.getBoundingClientRect().height).to.be.closeTo(minBlockSize, 0.5);
    expect(renderedTemplateWhitespace(el.shadowRoot!)).to.deep.equal([]);
  });

  it('stays exact across a chunk timeline and keeps a one-paragraph height at stream end', async () => {
    const el = await mount('', { streaming: true });
    await peersReady(el);
    for (const chunk of ['Hello', ' streamed', ' reply', ' in', ' six', ' chunks.']) {
      el.content += chunk;
      await el.updateComplete;
      expect(contentPart(el).textContent, chunk).to.equal(el.content);
      expect(renderedTemplateWhitespace(el.shadowRoot!), chunk).to.deep.equal([]);
      expect(el.getAttribute('aria-busy'), chunk).to.equal('true');
      await nextFrame();
    }
    const heightBefore = el.getBoundingClientRect().height;
    el.streaming = false;
    await rendered(el);
    await el.updateComplete;
    expect(el.hasAttribute('aria-busy')).to.be.false;
    expect(Math.abs(el.getBoundingClientRect().height - heightBefore)).to.be.at.most(1);
    expect(renderedTemplateWhitespace(el.shadowRoot!)).to.deep.equal([]);
  });

  it('shows exactly content again when a rendered element starts streaming', async () => {
    const el = await mount('Hello');
    await rendered(el);
    el.streaming = true;
    await el.updateComplete;
    const part = contentPart(el);
    expect(part.hasAttribute('data-fallback')).to.be.true;
    expect(part.textContent).to.equal(el.content);
    expect(renderedTemplateWhitespace(el.shadowRoot!)).to.deep.equal([]);
    expect(el.getAttribute('aria-busy')).to.equal('true');
  });

  it('shows exactly content in the fail-closed fallback', async () => {
    const el = await mount('# hi');
    await peersReady(el);
    const internals = el as unknown as Internals;
    const listener = oneEvent(el, 'lr-render-error');
    internals.deps = { marked: undefined, DOMPurify: internals.deps!.DOMPurify };
    internals.renderMarkdown();
    await listener;
    await el.updateComplete;
    const part = contentPart(el);
    expect(part.hasAttribute('data-fallback')).to.be.true;
    expect(part.textContent).to.equal(el.content);
    expect(renderedTemplateWhitespace(el.shadowRoot!)).to.deep.equal([]);
    expect(el.hasAttribute('aria-busy')).to.be.false;
  });

  it('copies exactly content from the streaming fallback', async () => {
    const el = await mount('Copy this reply', { streaming: true });
    const range = document.createRange();
    range.selectNodeContents(contentPart(el));
    expect(range.toString()).to.equal(el.content);
  });

  it('starts the first glyph at the inline-start edge under dir="rtl"', async () => {
    const el = await mount('שלום עולם', { streaming: true, dir: 'rtl' });
    const part = contentPart(el);
    const glyph = firstGlyphRect(part);
    expect(part.getBoundingClientRect().right - glyph.right).to.be.at.most(1);
    expect(glyph.top - part.getBoundingClientRect().top).to.be.lessThan(lineHeightPx(part));
    await expect(el).to.be.accessible();
  });

  it('renders no template whitespace under an inherited pre-wrap', async () => {
    const reference = await mount('Hello streamed reply', { streaming: true });
    const el = await mount('Hello streamed reply', { streaming: true, wrapperStyle: 'white-space: pre-wrap' });
    expect(renderedTemplateWhitespace(el.shadowRoot!)).to.deep.equal([]);
    expect(el.getBoundingClientRect().height).to.be.closeTo(reference.getBoundingClientRect().height, 1);
  });

  it('keeps the rendered-state contracts', async () => {
    const source = 'The quick brown fox jumps.\n\n# Heading\n\n```\nconst x = 1;\n```';
    const el = await mount(source);
    await rendered(el);
    await el.updateComplete;
    const part = contentPart(el);
    const paragraph = part.querySelector<HTMLElement>('[part="paragraph"]')!;
    paragraph.scrollIntoView = () => {};
    expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'quick brown fox' })).to.be.true;
    expect(el.getHeadingTree().map((item) => item.label)).to.deep.equal(['Heading']);
    expect(getComputedStyle(part.firstElementChild!).marginBlockStart).to.equal('0px');
    expect(renderedTemplateWhitespace(el.shadowRoot!, { allow: inMarkdownCodeBlock })).to.deep.equal([]);

    el.streaming = true;
    await el.updateComplete;
    expect(part.hasAttribute('data-fallback')).to.be.true;
    await expect(el).to.be.accessible();
  });
});
}
