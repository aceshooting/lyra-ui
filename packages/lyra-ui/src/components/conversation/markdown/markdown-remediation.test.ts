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

customElements.define('late-slot-host', class extends HTMLElement {
  connectedCallback(): void {
    const root = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    queueMicrotask(() => root.append(document.createElement('slot')));
  }
});

for (const tagName of ['lr-markdown', 'lr-markdown-core']) {
  it(`${tagName} reads a dark page palette once the host that slots it has rendered`, async () => {
    const wrapper = await fixture<HTMLElement>(
      `<div data-lr-theme-scope style="--lr-theme-color-text-normal:#f2f2f2; --lr-theme-color-surface-default:#1a1a1a"><late-slot-host><${tagName}></${tagName}></late-slot-host></div>`,
    );
    const el = wrapper.querySelector<LyraMarkdown | LyraMarkdownCore>(tagName)!;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.getAttribute('data-dark-theme')).to.equal('true');
  });
}
