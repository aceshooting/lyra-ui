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
