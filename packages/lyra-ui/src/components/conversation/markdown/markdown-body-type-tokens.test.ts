import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-markdown.js';
import '../../lr-markdown-core.js';
import { loadMarkdownDeps } from './markdown-loader.js';

type MarkdownElement = HTMLElement & { content: string };

for (const tagName of ['lr-markdown', 'lr-markdown-core'] as const) {
  describe(`${tagName} body type and rhythm tokens`, () => {
    it('sets the content font size, line height and colour and splits paragraph and list gaps', async () => {
      await loadMarkdownDeps();
      const wrapper = await fixture<HTMLElement>(html`<div style="font-size: 14px; color: rgb(9, 9, 9)"></div>`);
      const make = (style: string): MarkdownElement => {
        const el = document.createElement(tagName) as MarkdownElement;
        el.setAttribute('style', style);
        el.content = 'One\n\n- item\n\nTwo\n';
        wrapper.append(el);
        return el;
      };
      const plain = make('');
      const themed = make('--lr-markdown-font-size: 18px; --lr-markdown-line-height: 30px; --lr-markdown-color: rgb(1, 2, 3); --lr-markdown-paragraph-gap: 3px; --lr-markdown-list-gap: 21px');
      const blockGap = make('--lr-markdown-block-gap: 11px');
      for (const el of [plain, themed, blockGap]) await waitUntil(() => el.shadowRoot?.querySelector('[part="list"]') != null);
      const read = (el: MarkdownElement) => {
        const root = el.shadowRoot!;
        const content = getComputedStyle(root.querySelector('[part="content"]')!);
        return {
          size: content.fontSize, color: content.color,
          lineHeight: getComputedStyle(root.querySelector('[part="paragraph"]')!).lineHeight,
          paragraphGap: getComputedStyle(root.querySelector('[part="paragraph"]')!).marginBlockEnd,
          listGap: getComputedStyle(root.querySelector('[part="list"]')!).marginBlockEnd,
        };
      };
      const defaults = read(plain);
      expect([defaults.size, defaults.color, defaults.paragraphGap, defaults.listGap])
        .to.deep.equal(['14px', getComputedStyle(plain).color, '8px', '8px']);
      expect(defaults.lineHeight).to.not.equal('30px');
      expect(read(themed)).to.deep.equal({ size: '18px', color: 'rgb(1, 2, 3)', lineHeight: '30px', paragraphGap: '3px', listGap: '21px' });
      expect([read(blockGap).paragraphGap, read(blockGap).listGap]).to.deep.equal(['11px', '11px']);
    });
  });
}
