import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-markdown.js';
import '../../lr-markdown-core.js';
import { loadMarkdownDeps } from './markdown-loader.js';

const tags = ['lr-markdown', 'lr-markdown-core'] as const;
const content = '# Title\n\nSome `inline` code.\n\n```\nfenced\n```';

async function mount(tag: (typeof tags)[number], style: string, header = false) {
  await loadMarkdownDeps();
  const wrapper = await fixture<HTMLElement>(html`<div style=${`color: rgb(10, 20, 30); ${style}`}></div>`);
  const el = document.createElement(tag) as HTMLElement & { content: string; codeBlockHeader: boolean; updateComplete: Promise<unknown> };
  el.content = content;
  el.codeBlockHeader = header;
  wrapper.append(el);
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="code-block"]') && el.shadowRoot!.querySelector('[part="inline-code"]'), 'never rendered', { timeout: 4000 });
  const q = (sel: string) => getComputedStyle(el.shadowRoot!.querySelector(sel) as HTMLElement);
  return { q, el };
}

for (const tag of tags) {
  describe(`${tag} heading, inline-code and code-block border tokens`, () => {
    it('applies heading and inline code colors without touching code inside a fenced block', async () => {
      const { q } = await mount(tag, '--lr-markdown-heading-color: rgb(1, 2, 3); --lr-markdown-code-color: rgb(4, 5, 6);');
      expect(q('[part~="heading"]').color).to.equal('rgb(1, 2, 3)');
      expect(q('[part="inline-code"]').color).to.equal('rgb(4, 5, 6)');
      expect(q('[part="code-block"] code').color).to.equal(q('[part="code-block"]').color);
      expect(q('[part="code-block"]').color).to.not.equal('rgb(4, 5, 6)');
    });

    it('unset: heading and inline code inherit the content color; plain block has no border', async () => {
      const { q } = await mount(tag, '--lr-markdown-color: rgb(10, 20, 30);');
      expect(q('[part~="heading"]').color).to.equal('rgb(10, 20, 30)');
      expect(q('[part="inline-code"]').color).to.equal('rgb(10, 20, 30)');
      expect(q('[part="code-block"]').borderTopWidth).to.equal('0px');
    });

    it('applies the border color and width to the plain block', async () => {
      const { q } = await mount(tag, '--lr-markdown-code-block-border-color: rgb(7, 8, 9); --lr-markdown-code-block-border-width: 3px;');
      expect(q('[part="code-block"]').borderTopColor).to.equal('rgb(7, 8, 9)');
      expect(q('[part="code-block"]').borderTopWidth).to.equal('3px');
    });

    it('framed block: unset keeps the thin subtle border; tokens override it', async () => {
      const base = await mount(tag, '', true);
      const frame = '[part~="code-block-frame"]';
      const unsetColor = base.q(frame).borderTopColor;
      const unsetWidth = base.q(frame).borderTopWidth;
      expect(unsetWidth).to.not.equal('0px');
      expect(base.q('[part="code-block"]').borderTopWidth).to.equal('0px');
      const themed = await mount(tag, '--lr-markdown-code-block-border-color: rgb(7, 8, 9); --lr-markdown-code-block-border-width: 4px;', true);
      expect(themed.q(frame).borderTopColor).to.equal('rgb(7, 8, 9)');
      expect(themed.q(frame).borderTopWidth).to.equal('4px');
      expect(themed.q('[part="code-block"]').borderTopWidth).to.equal('0px');
      expect(unsetColor).to.not.equal('rgb(7, 8, 9)');
    });
  });
}
