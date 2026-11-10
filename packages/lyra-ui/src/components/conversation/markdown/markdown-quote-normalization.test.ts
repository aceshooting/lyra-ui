import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';

for (const tag of ['lr-markdown', 'lr-markdown-core'] as const) {
  it(`${tag} resolves normalized quotes before and after inline formatting changes`, async () => {
    const wrapper = await fixture<HTMLElement>(html`<div></div>`);
    const element = document.createElement(tag) as LyraMarkdown;
    wrapper.append(element);
    for (const content of [
      '<p>Start|\u00a0 \u0344|End</p>',
      '<p>Start|<span>\u00a0</span><span> \u0344</span>|End</p>',
    ]) {
      element.content = content;
      await element.updateComplete;
      await waitUntil(() => element.shadowRoot?.querySelector('p')?.textContent === 'Start|\u00a0 \u0344|End'
        && element.shadowRoot.querySelectorAll('p span').length === (content.includes('<span>') ? 2 : 0));
      const paragraph = element.shadowRoot!.querySelector('p')!;
      expect(paragraph.textContent).to.equal('Start|\u00a0 \u0344|End');
      let scrolls = 0;
      paragraph.scrollIntoView = () => { scrolls++; };
      expect(await element.scrollToAnchor({ kind: 'text-quote', quote: 'Start| \u0308\u0301|End' })).to.equal(true);
      expect(scrolls).to.equal(1);
    }
  });
}
