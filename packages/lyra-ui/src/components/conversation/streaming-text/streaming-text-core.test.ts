import { fixture, expect, html, waitUntil } from '@open-wc/testing';
import './streaming-text-core.js';
import type { LyraStreamingTextCore } from './streaming-text-core.js';

/** True once the browser has actually fetched a module whose URL ends with `suffix` -- the
 *  reliable proxy for "reached by the static import graph" under `@web/test-runner`'s unbundled
 *  ESM serving, where every distinct specifier is its own HTTP resource (mirrors
 *  `toaster.test.ts`'s identical helper). */
function fetchedModuleEnding(suffix: string): boolean {
  return performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(suffix));
}

describe('lr-streaming-text-core registration', () => {
  it('registers lr-streaming-text-core and lr-markdown-core, and never fetches the full lr-markdown class module', () => {
    expect(customElements.get('lr-streaming-text-core')).to.exist;
    expect(customElements.get('lr-markdown-core')).to.exist;
    expect(
      fetchedModuleEnding('/markdown/markdown.class.ts'),
      'the core entry must never pull in the full lr-markdown class module',
    ).to.equal(false);
    expect(fetchedModuleEnding('/markdown/markdown-core.class.ts')).to.equal(true);
  });
});

describe('lr-streaming-text-core rendering', () => {
  it('defaults to empty content, streaming=false, coalesce-ms=50, and contentMode="auto"', async () => {
    const el = (await fixture(html`<lr-streaming-text-core></lr-streaming-text-core>`)) as LyraStreamingTextCore;
    expect(el.content).to.equal('');
    expect(el.streaming).to.be.false;
    expect(el.coalesceMs).to.equal(50);
    expect(el.contentMode).to.equal('auto');
  });

  it('auto-detects Markdown syntax and routes it through lr-markdown-core, never lr-markdown', async () => {
    const el = (await fixture(
      html`<lr-streaming-text-core .content=${'# Heading\n\nSome **bold** text.'}></lr-streaming-text-core>`,
    )) as LyraStreamingTextCore;
    expect(el.shadowRoot!.querySelector('lr-markdown-core')).to.exist;
    expect(el.shadowRoot!.querySelector('lr-markdown') === null).to.be.true;
    expect(el.shadowRoot!.querySelector('.plain') === null).to.be.true;
  });

  it('renders plain text for content-mode="plain" regardless of Markdown syntax', async () => {
    const el = (await fixture(
      html`<lr-streaming-text-core
        content-mode="plain"
        .content=${'# Heading'}
      ></lr-streaming-text-core>`,
    )) as LyraStreamingTextCore;
    expect(el.shadowRoot!.querySelector('lr-markdown-core') === null).to.be.true;
    expect(el.shadowRoot!.querySelector('.plain')).to.exist;
  });

  it('forwards languages verbatim to the composed lr-markdown-core, defaulting to an empty map', async () => {
    const languages = { bash: { name: 'bash', scopeName: 'source.bash' } };
    const withLanguages = (await fixture(
      html`<lr-streaming-text-core
        content-mode="markdown"
        .languages=${languages}
      ></lr-streaming-text-core>`,
    )) as LyraStreamingTextCore;
    const markdown = withLanguages.shadowRoot!.querySelector('lr-markdown-core') as unknown as {
      languages: typeof languages;
    };
    expect(markdown.languages).to.equal(languages);

    const withoutLanguages = (await fixture(
      html`<lr-streaming-text-core content-mode="markdown"></lr-streaming-text-core>`,
    )) as LyraStreamingTextCore;
    const bareMarkdown = withoutLanguages.shadowRoot!.querySelector('lr-markdown-core') as unknown as {
      languages: Record<string, unknown>;
    };
    expect(bareMarkdown.languages).to.deep.equal({});
  });

  it('forwards streaming through to the nested lr-markdown-core as its own streaming hint prop', async () => {
    const el = (await fixture(
      html`<lr-streaming-text-core
        content-mode="markdown"
        streaming
      ></lr-streaming-text-core>`,
    )) as LyraStreamingTextCore;
    const markdown = el.shadowRoot!.querySelector('lr-markdown-core') as unknown as { streaming: boolean };
    expect(markdown.streaming).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="cursor"]')).to.exist;
  });

  it("forwards the composed lr-markdown-core's own defaults unchanged when the markdown configuration properties are left unset", async () => {
    const el = (await fixture(
      html`<lr-streaming-text-core content-mode="markdown"></lr-streaming-text-core>`,
    )) as LyraStreamingTextCore;
    const markdown = el.shadowRoot!.querySelector('lr-markdown-core') as unknown as {
      tabSize: number;
      htmlMode: string;
      gfm: boolean;
      linkTarget: string | null;
      internalLinkPrefix: string;
      headingOffset: number;
      highlightCode: boolean;
      headingAnchors: boolean;
      math: boolean;
      maxHeight: string;
    };
    expect(markdown.tabSize).to.equal(4);
    expect(markdown.htmlMode).to.equal('sanitize');
    expect(markdown.gfm).to.equal(true);
    expect(markdown.linkTarget).to.equal('_blank');
    expect(markdown.internalLinkPrefix).to.equal('');
    expect(markdown.headingOffset).to.equal(0);
    expect(markdown.highlightCode).to.equal(true);
    expect(markdown.headingAnchors).to.equal(false);
    expect(markdown.math).to.equal(false);
    expect(markdown.maxHeight).to.equal('');
  });

  it('renders identically to before these markdown configuration properties existed, when left unset (unset-regression)', async () => {
    (window as unknown as { __lyraStreamingTextCoreXss?: boolean }).__lyraStreamingTextCoreXss = undefined;
    const el = (await fixture(
      html`<lr-streaming-text-core
        content-mode="markdown"
        .content=${'# Heading\n\nSome **bold** text and a [link](https://example.com).\n\nhi <img alt="test" onerror="window.__lyraStreamingTextCoreXss = true">'}
      ></lr-streaming-text-core>`,
    )) as LyraStreamingTextCore;
    const markdown = el.shadowRoot!.querySelector('lr-markdown-core')!;
    await waitUntil(() => markdown.shadowRoot!.querySelector('img') !== null);

    expect(markdown.shadowRoot!.querySelector('h1'), 'a source "#" still renders <h1>').to.exist;
    const img = markdown.shadowRoot!.querySelector('img')!;
    expect(img.getAttribute('onerror'), 'the inline event handler is still sanitized away').to.equal(null);
    expect(
      (window as unknown as { __lyraStreamingTextCoreXss?: boolean }).__lyraStreamingTextCoreXss,
    ).to.equal(undefined);
    const link = markdown.shadowRoot!.querySelector('a')!;
    expect(link.getAttribute('target')).to.equal('_blank');
    expect(link.getAttribute('rel')).to.equal('noopener noreferrer');
  });

  it('forwards non-default markdown configuration properties verbatim to the composed lr-markdown-core', async () => {
    const el = (await fixture(
      html`<lr-streaming-text-core
        content-mode="markdown"
        link-target=""
        html-mode="escape"
        gfm="false"
        internal-link-prefix="/docs/"
        heading-offset="2"
        tab-size="8"
        highlight-code="false"
        heading-anchors
        math
        max-height="10rem"
      ></lr-streaming-text-core>`,
    )) as LyraStreamingTextCore;
    const markdown = el.shadowRoot!.querySelector('lr-markdown-core') as unknown as {
      tabSize: number;
      htmlMode: string;
      gfm: boolean;
      linkTarget: string | null;
      internalLinkPrefix: string;
      headingOffset: number;
      highlightCode: boolean;
      headingAnchors: boolean;
      math: boolean;
      maxHeight: string;
    };
    expect(markdown.tabSize).to.equal(8);
    expect(markdown.htmlMode).to.equal('escape');
    expect(markdown.gfm).to.equal(false);
    expect(markdown.linkTarget).to.equal('');
    expect(markdown.internalLinkPrefix).to.equal('/docs/');
    expect(markdown.headingOffset).to.equal(2);
    expect(markdown.highlightCode).to.equal(false);
    expect(markdown.headingAnchors).to.equal(true);
    expect(markdown.math).to.equal(true);
    expect(markdown.maxHeight).to.equal('10rem');
  });

  it('a forwarded non-default linkTarget still gets the composed lr-markdown-core\'s rel="noopener noreferrer" guard, and never a bare "opener"', async () => {
    const el = (await fixture(
      html`<lr-streaming-text-core
        content-mode="markdown"
        link-target="_self"
        .content=${'[docs](https://example.com/docs)'}
      ></lr-streaming-text-core>`,
    )) as LyraStreamingTextCore;
    const markdown = el.shadowRoot!.querySelector('lr-markdown-core')!;
    await waitUntil(() => markdown.shadowRoot!.querySelector('a') !== null);
    const a = markdown.shadowRoot!.querySelector('a')!;
    expect(a.getAttribute('target')).to.equal('_self');
    expect(a.getAttribute('rel')).to.equal('noopener noreferrer');
    expect(a.getAttribute('rel')).to.not.match(/(?:^|\s)opener(?:\s|$)/);
  });

  it('omits target/rel entirely on a forwarded link-target="" (same-tab links), matching the composed lr-markdown-core\'s own contract', async () => {
    const el = (await fixture(
      html`<lr-streaming-text-core
        content-mode="markdown"
        link-target=""
        .content=${'[docs](https://example.com/docs)'}
      ></lr-streaming-text-core>`,
    )) as LyraStreamingTextCore;
    const markdown = el.shadowRoot!.querySelector('lr-markdown-core')!;
    await waitUntil(() => markdown.shadowRoot!.querySelector('a') !== null);
    const a = markdown.shadowRoot!.querySelector('a')!;
    expect(a.hasAttribute('target')).to.be.false;
    expect(a.hasAttribute('rel')).to.be.false;
  });
});

describe('composed lr-markdown-core CSS parts forwarding', () => {
  const LINK_AND_IMAGE_CONTENT =
    '[docs](https://example.com/docs)\n\n![alt text](https://example.com/pic.png)';

  it("forwards the composed lr-markdown-core's documented parts so a host-level ::part(link)/::part(img) rule reaches the rendered <a>/<img>, matching the same rule applied directly to lr-markdown-core", async () => {
    const wrapper = await fixture(html`
      <div>
        <style>
          lr-streaming-text-core.parts-probe::part(link) {
            color: rgb(1, 2, 3);
          }
          lr-streaming-text-core.parts-probe::part(img) {
            border: 4px solid rgb(9, 8, 7);
          }
          lr-markdown-core.parts-probe::part(link) {
            color: rgb(1, 2, 3);
          }
          lr-markdown-core.parts-probe::part(img) {
            border: 4px solid rgb(9, 8, 7);
          }
        </style>
        <lr-streaming-text-core
          class="parts-probe"
          content-mode="markdown"
          .content=${LINK_AND_IMAGE_CONTENT}
        ></lr-streaming-text-core>
        <lr-markdown-core class="parts-probe" .content=${LINK_AND_IMAGE_CONTENT}></lr-markdown-core>
      </div>
    `);
    const streaming = wrapper.querySelector('lr-streaming-text-core') as LyraStreamingTextCore;
    const direct = wrapper.querySelector('lr-markdown-core')!;
    const nested = streaming.shadowRoot!.querySelector('lr-markdown-core')!;
    await waitUntil(() => nested.shadowRoot!.querySelector('img') !== null);
    await waitUntil(() => direct.shadowRoot!.querySelector('img') !== null);

    const nestedLink = nested.shadowRoot!.querySelector('a')!;
    const nestedImg = nested.shadowRoot!.querySelector('img')!;
    const directLink = direct.shadowRoot!.querySelector('a')!;
    const directImg = direct.shadowRoot!.querySelector('img')!;

    expect(
      getComputedStyle(nestedLink).color,
      'the forwarded link part must actually receive the outer host-level rule',
    ).to.equal('rgb(1, 2, 3)');
    expect(getComputedStyle(nestedLink).color).to.equal(getComputedStyle(directLink).color);
    expect(getComputedStyle(nestedImg).borderTopWidth).to.equal('4px');
    expect(getComputedStyle(nestedImg).borderTopWidth).to.equal(
      getComputedStyle(directImg).borderTopWidth,
    );
    expect(getComputedStyle(nestedImg).borderTopColor).to.equal(
      getComputedStyle(directImg).borderTopColor,
    );
  });

  it("keeps its own base/cursor parts reachable via ::part() after the lr-markdown-core exportparts forwarding was added, proving no name collision", async () => {
    const wrapper = await fixture(html`
      <div>
        <style>
          lr-streaming-text-core.own-parts-probe::part(base) {
            background-color: rgb(4, 5, 6);
          }
          lr-streaming-text-core.own-parts-probe::part(cursor) {
            background-color: rgb(7, 8, 9);
          }
        </style>
        <lr-streaming-text-core
          class="own-parts-probe"
          streaming
          .content=${'hi'}
        ></lr-streaming-text-core>
      </div>
    `);
    const el = wrapper.querySelector('lr-streaming-text-core') as LyraStreamingTextCore;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const cursor = el.shadowRoot!.querySelector('[part="cursor"]') as HTMLElement;
    expect(getComputedStyle(base).backgroundColor).to.equal('rgb(4, 5, 6)');
    expect(getComputedStyle(cursor).backgroundColor).to.equal('rgb(7, 8, 9)');
  });
});

describe('lr-streaming-text-core accessibility', () => {
  it('is accessible while streaming, populated with Markdown content and a visible cursor', async () => {
    const el = (await fixture(
      html`<lr-streaming-text-core
        streaming
        .content=${'# Heading\n\nSome **bold** text and a [link](https://example.com).'}
      ></lr-streaming-text-core>`,
    )) as LyraStreamingTextCore;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('is accessible once content has settled after streaming ends, still rendering Markdown', async () => {
    const el = (await fixture(
      html`<lr-streaming-text-core
        .content=${'# Heading\n\nSome **bold** text and a [link](https://example.com).'}
      ></lr-streaming-text-core>`,
    )) as LyraStreamingTextCore;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('lr-markdown-core') !== null);
    expect(el.streaming, 'this is the settled, non-streaming case').to.be.false;
    expect(el.shadowRoot!.querySelector('[part="cursor"]') === null, 'no cursor once settled').to.be.true;
    await expect(el).to.be.accessible();
  });
});
