import { fixture, html, expect, waitUntil } from '@open-wc/testing';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';

describe('GFM task items', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    for (const htmlMode of ['sanitize', 'escape', 'trusted'] as const) {
      it(`${name} exposes completed state and preserves ordered numerals in ${htmlMode}`, async () => {
        const host = await fixture<HTMLElement>(html`<div></div>`);
        const el = document.createElement(name) as LyraMarkdown;
        el.htmlMode = htmlMode;
        el.content = '- [ ] Open\n- [x] Done\n\n1. [x] Ordered\n2. [ ] Next';
        host.append(el);
        await waitUntil(() => el.shadowRoot?.querySelectorAll('input').length === 4);
        const root = el.shadowRoot!;
        expect(root.querySelector('ul')?.getAttribute('role')).to.equal('list');
        expect(root.querySelectorAll('[part~="task-list"]').length).to.equal(2);
        expect(root.querySelectorAll('[part~="task-item-checked"]').length).to.equal(2);
        expect(root.querySelectorAll('[part="task-checkbox"]:disabled').length).to.equal(4);
        expect(getComputedStyle(root.querySelector('ol > li')!).listStyleType).to.equal('decimal');
        expect(getComputedStyle(root.querySelector('ul > li')!).listStyleType).to.equal('none');
        expect(root.querySelector('li')?.textContent).to.equal('Open');
        await expect(el).to.be.accessible();
      });
    }
    it(`${name} follows the checkbox size property without shifting task text away from sibling prose`, async () => {
      const host = await fixture<HTMLElement>(html`<div dir="rtl"></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.content = '- Ordinary\n- [x] Task';
      el.style.setProperty('--lr-markdown-task-checkbox-size', '1.5em');
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('input')));
      const checkbox = el.shadowRoot!.querySelector<HTMLInputElement>('input')!;
      const style = getComputedStyle(checkbox);
      expect(parseFloat(style.inlineSize)).to.be.closeTo(parseFloat(style.fontSize) * 1.5, 0.5);
      expect(style.opacity).to.equal('1');
      expect(style.getPropertyValue('print-color-adjust') || style.getPropertyValue('-webkit-print-color-adjust')).to.equal('exact');
      expect(getComputedStyle(checkbox, '::before').direction).to.equal('ltr');
    });
  }
});
