import { fixture, html, expect, waitUntil } from '@open-wc/testing';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';

describe('GFM table wrapper', () => {
  for (const name of ['lr-markdown', 'lr-markdown-core'] as const) {
    it(`${name} names its scroll stop and relabels it without replacing table nodes`, async () => {
      const host = await fixture<HTMLElement>(html`<div style="inline-size: 320px"></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.content = '| Name | Number |\n| :--- | ---: |\n| LongUnbreakableColumnHeadingLongUnbreakableColumnHeading | 42 |';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('table')));
      const root = el.shadowRoot!;
      const table = root.querySelector('table')!;
      const wrapper = root.querySelector<HTMLElement>('[part="table-wrapper"]')!;
      expect(wrapper.getAttribute('role')).to.equal('group');
      expect(wrapper.getAttribute('aria-label')).to.equal('Table');
      expect(wrapper.tabIndex).to.equal(0);
      expect(wrapper.scrollWidth).to.be.greaterThan(wrapper.clientWidth);
      expect(getComputedStyle(table).wordBreak).to.equal('normal');
      expect(getComputedStyle(table).overflowWrap).to.equal('break-word');
      expect(getComputedStyle(root.querySelector('th[align="right"]')!).textAlign).to.match(/right$/);
      el.strings = { markdownTableRegion: 'Custom table' };
      await el.updateComplete;
      expect(wrapper.getAttribute('aria-label')).to.equal('Custom table');
      expect(root.querySelector('table') === table).to.equal(true);
      await expect(el).to.be.accessible();
    });
    it(`${name} leaves unwrapped tables and forged generic wrappers unchanged`, async () => {
      const host = await fixture<HTMLElement>(html`<div></div>`);
      const el = document.createElement(name) as LyraMarkdown;
      el.content = '<div part="table-wrapper">authored</div>\n\n<table part="table"><tr><td>authored</td></tr></table>';
      host.append(el);
      await waitUntil(() => Boolean(el.shadowRoot?.querySelector('table')));
      expect(el.shadowRoot!.querySelector('[part="table-wrapper"]')?.hasAttribute('aria-label')).to.equal(false);
      expect(getComputedStyle(el.shadowRoot!.querySelector('table')!).overflowWrap).to.equal('anywhere');
    });
  }
});
