import { expect, waitUntil } from '@open-wc/testing';
import '../../lr-markdown.js';
import '../../lr-markdown-core.js';
import { finishMarkdownHtml } from './markdown-shared.js';
import { parseLinkSchemes } from '../../../internal/safe-url.js';

type MarkdownTag = 'lr-markdown' | 'lr-markdown-core';
type MarkdownHost = HTMLElement & {
  content: string;
  htmlMode: 'sanitize' | 'escape' | 'trusted';
  linkSchemes?: string;
  streaming: boolean;
  streamingRender: 'plain' | 'progressive';
  updateComplete: Promise<boolean>;
};

const TAGS: readonly MarkdownTag[] = ['lr-markdown', 'lr-markdown-core'];
const REPRO = '[a](http://example.com) [b](mailto:someone@example.com?subject=hi) [c](/relative) [d](https://example.com/d) end';
const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const element of mounted.splice(0)) element.remove();
});

function mount(tag: MarkdownTag, setup: (el: MarkdownHost) => void): MarkdownHost {
  const el = document.createElement(tag) as MarkdownHost;
  setup(el);
  mounted.push(el);
  document.body.append(el);
  return el;
}

function contentOf(el: MarkdownHost): HTMLElement | null {
  return el.shadowRoot?.querySelector<HTMLElement>('[part="content"]') ?? null;
}

async function rendered(el: MarkdownHost, text: string): Promise<HTMLElement> {
  await el.updateComplete;
  await waitUntil(
    () => contentOf(el)?.querySelector('p') != null && (contentOf(el)?.textContent ?? '').includes(text),
    `${el.localName} did not render ${text}`,
  );
  return contentOf(el)!;
}

function hrefs(root: ParentNode): (string | null)[] {
  return [...root.querySelectorAll('a, area')].map((link) => link.getAttribute('href'));
}

for (const tag of TAGS) {
  describe(`<${tag}> link-schemes`, () => {
    it('is unset by default and keeps the standard allowlist (unset-regression)', async () => {
      const el = mount(tag, (host) => { host.content = REPRO; });
      expect(el.linkSchemes).to.equal(undefined);
      expect(el.hasAttribute('link-schemes')).to.equal(false);
      const root = await rendered(el, 'end');
      expect(hrefs(root)).to.deep.equal([
        'http://example.com', 'mailto:someone@example.com?subject=hi', '/relative', 'https://example.com/d',
      ]);
    });

    it('link-schemes="https" keeps only https anchors and renders the rest as text', async () => {
      const el = mount(tag, (host) => {
        host.setAttribute('link-schemes', 'https');
        host.content = REPRO;
      });
      expect(el.linkSchemes).to.equal('https');
      const root = await rendered(el, 'end');
      expect(hrefs(root)).to.deep.equal(['https://example.com/d']);
      expect(root.querySelector('a')!.getAttribute('part')).to.equal('link');
      expect(root.textContent).to.include('a b c d end');
    });

    it('admits scheme-less URLs only with the relative token', async () => {
      const el = mount(tag, (host) => {
        host.linkSchemes = 'HTTPS: relative';
        host.content = REPRO;
      });
      const root = await rendered(el, 'end');
      expect(hrefs(root)).to.deep.equal(['/relative', 'https://example.com/d']);
    });

    it('fails closed for raw HTML, SVG and autolinked anchors after sanitization', async () => {
      const el = mount(tag, (host) => {
        host.linkSchemes = 'https';
        host.content = [
          'raw <a href="http://example.com/raw">raw link</a>',
          '<a href="https://example.com/ok">ok link</a>',
          '<svg><a href="http://example.com/svg"><text>svg link</text></a></svg>',
          'auto http://example.com/auto <map name="m"><area href="mailto:x@example.com" alt="area"></map> end',
        ].join(' ');
      });
      const root = await rendered(el, 'end');
      expect(hrefs(root)).to.deep.equal(['https://example.com/ok']);
      expect(root.textContent).to.include('raw link');
      expect(root.textContent).to.include('svg link');
      expect(root.textContent).to.include('http://example.com/auto');
    });

    it('applies under trusted mode as an explicit narrowing', async () => {
      const el = mount(tag, (host) => {
        host.htmlMode = 'trusted';
        host.linkSchemes = 'https';
        host.content = '[md](http://example.com/md) <a href="mailto:x@example.com">raw</a> [ok](https://example.com) end';
      });
      const root = await rendered(el, 'end');
      expect(hrefs(root)).to.deep.equal(['https://example.com']);
    });

    it('allows no link at all when no token is recognised, and never widens', async () => {
      const el = mount(tag, (host) => {
        host.linkSchemes = 'javascript data';
        host.content = '[x](javascript:alert(1)) [y](https://example.com) end';
      });
      const root = await rendered(el, 'end');
      expect(hrefs(root)).to.deep.equal([]);
      expect(root.textContent).to.include('x y end');
    });

    it('re-renders when link-schemes changes or is removed', async () => {
      const el = mount(tag, (host) => { host.content = REPRO; });
      await rendered(el, 'end');
      el.setAttribute('link-schemes', 'mailto');
      await waitUntil(() => hrefs(contentOf(el)!).length === 1, 'link-schemes change did not re-render');
      expect(hrefs(contentOf(el)!)).to.deep.equal(['mailto:someone@example.com?subject=hi']);
      el.removeAttribute('link-schemes');
      await waitUntil(() => hrefs(contentOf(el)!).length === 4, 'removing link-schemes did not restore links');
    });

    it('narrows progressive streaming blocks too', async () => {
      const el = mount(tag, (host) => {
        host.linkSchemes = 'https';
        host.streaming = true;
        host.streamingRender = 'progressive';
        host.content = '[a](http://example.com/a)\n\n[b](https://example.com/b)\n\n<a href="mailto:x@example.com">c</a> end\n\n';
      });
      const root = await rendered(el, 'end');
      expect(hrefs(root)).to.deep.equal(['https://example.com/b']);
      el.streaming = false;
      await el.updateComplete;
      await waitUntil(() => (contentOf(el)?.textContent ?? '').includes('end'));
      expect(hrefs(contentOf(el)!)).to.deep.equal(['https://example.com/b']);
    });

    it('stays accessible with refused and kept links', async () => {
      const el = mount(tag, (host) => {
        host.linkSchemes = 'https';
        host.content = REPRO;
      });
      const root = await rendered(el, 'end');
      expect(hrefs(root)).to.have.lengthOf(1);
      await expect(el).to.be.accessible();
    });
  });
}

describe('finishMarkdownHtml link-scheme pass', () => {
  const noPeers = { marked: undefined, DOMPurify: undefined } as unknown as Parameters<typeof finishMarkdownHtml>[0];

  it('unwraps refused anchors, removes refused areas, and leaves markup alone when unset', () => {
    const markup = '<p><a href="http://x.example">x</a> <a href="https://y.example">y</a> <a name="n">anchor</a></p>';
    expect(finishMarkdownHtml(noPeers, null, markup, false)).to.equal(markup);
    expect(finishMarkdownHtml(noPeers, null, markup, false, false, parseLinkSchemes('https'))).to.equal(
      '<p>x <a href="https://y.example">y</a> <a name="n">anchor</a></p>',
    );
    expect(finishMarkdownHtml(noPeers, null, '<map><area href="/r" alt="r"></map>', false, false, parseLinkSchemes('https')))
      .to.equal('<map></map>');
  });
});
