import { fixture, expect, waitUntil } from '@open-wc/testing';
import './markdown.js';
import './markdown-core.js';
import type { LyraMarkdown } from './markdown.js';
import type { LyraMarkdownCore } from './markdown-core.js';

for (const tagName of ['lr-markdown', 'lr-markdown-core']) {
  for (const streaming of [false, true]) {
    it(`${tagName} safely removes content while streaming=${streaming} and accepts later text`, async () => {
      const el = await fixture<LyraMarkdown | LyraMarkdownCore>(`<${tagName}></${tagName}>`);
      el.streaming = streaming;
      el.setAttribute('content', '**Before**');
      await waitUntil(() => !!el.shadowRoot!.querySelector('[part="content"]')?.textContent?.includes('Before'));
      el.removeAttribute('content');
      await el.updateComplete;
      expect(el.content).to.equal(null);
      const content = () => el.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!;
      await waitUntil(() => content().textContent?.trim() === '', 'cleared Markdown content');
      expect(content().hasAttribute('tabindex')).to.equal(false);
      el.setAttribute('content', '');
      await el.updateComplete;
      expect(el.content).to.equal('');
      el.setAttribute('content', '**After**');
      await waitUntil(() => !!content().textContent?.includes('After'), 'restored Markdown content');
      expect(content().getAttribute('tabindex')).to.equal('0');
      if (streaming) expect(content().textContent).to.include('**After**');
      else await waitUntil(() => content().querySelector('strong')?.textContent === 'After');
    });
  }
}

for (const [name, module] of [
  ['lr-markdown', () => import('./markdown.stories.js')],
  ['lr-markdown-core', () => import('./markdown-core.stories.js')],
] as const) {
  it(`${name} parser-refresh example restores defaults through their mutable options object`, async () => {
    const { InstanceParserRefresh } = await module();
    const root = await fixture<HTMLElement>(InstanceParserRefresh.render!({}, null as never));
    const el = root.querySelector<LyraMarkdown | LyraMarkdownCore>(name)!;
    await waitUntil(() => !!el.marked, 'loaded parser');
    const parser = el.marked!;
    const keys = Object.keys(parser.defaults).sort();
    const hooks = parser.defaults['hooks'];
    root.querySelector<HTMLButtonElement>('button')!.click();
    await waitUntil(() => !!el.shadowRoot!.querySelector('strong')?.textContent?.includes('Configured'), 'configured parser output');
    expect(Object.keys(parser.defaults).sort()).to.deep.equal(keys);
    expect(parser.defaults['hooks'] === hooks).to.equal(true);
    el.renderMarkdown();
    await waitUntil(() => !!el.shadowRoot!.querySelector('[part="content"]')?.textContent?.includes('CONFIGURED_TOKEN'), 'restored parser defaults');
    expect(el.shadowRoot!.querySelectorAll('strong').length).to.equal(0);
  });
}
