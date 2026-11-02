import { expect, waitUntil } from '@open-wc/testing';
import './markdown.js';
import './markdown-core.js';
import { finishMarkdownHtml, markdownSanitizerPolicy } from './markdown-shared.js';
import { loadMarkdownDeps } from './markdown-loader.js';

type MarkdownTag = 'lr-markdown' | 'lr-markdown-core';
type MarkdownHost = HTMLElement & {
  content: string;
  htmlMode: 'sanitize' | 'escape' | 'trusted';
  withoutImages: boolean;
  streaming: boolean;
  streamingRender: 'plain' | 'progressive';
  updateComplete: Promise<boolean>;
};

const TAGS: readonly MarkdownTag[] = ['lr-markdown', 'lr-markdown-core'];
const mounted: HTMLElement[] = [];

afterEach(() => {
  for (const element of mounted.splice(0)) element.remove();
});

let beaconSequence = 0;
/** A unique, unreachable URL per assertion, so resource timing can prove it was never requested. */
function beaconUrl(): string {
  beaconSequence += 1;
  return `https://example.invalid/lyra-without-images-${beaconSequence}-${Date.now()}.png`;
}

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

function imageLoaders(root: ParentNode): number {
  return root.querySelectorAll('img, picture source, image, feImage, input[type="image"], video[poster]').length;
}

function requested(url: string): boolean {
  return performance.getEntriesByName(url).length > 0;
}

for (const tag of TAGS) {
  describe(`<${tag}> without-images`, () => {
    it('defaults to false and still renders a Markdown image (unset-regression)', async () => {
      const src = beaconUrl();
      const el = mount(tag, (host) => { host.content = `before ![chart](${src}) after`; });
      expect(el.withoutImages).to.equal(false);
      expect(el.hasAttribute('without-images')).to.equal(false);
      await el.updateComplete;
      await waitUntil(() => contentOf(el)?.querySelector('img') != null, 'default image did not render');
      const img = contentOf(el)!.querySelector('img')!;
      expect(img.getAttribute('src')).to.equal(src);
      expect(img.getAttribute('alt')).to.equal('chart');
      expect(img.getAttribute('part')).to.equal('img');
    });

    it('reflects the without-images attribute into the property', async () => {
      const el = mount(tag, (host) => { host.setAttribute('without-images', ''); });
      await el.updateComplete;
      expect(el.withoutImages).to.equal(true);
    });

    it('renders a Markdown image as its alt text and never requests its source', async () => {
      const src = beaconUrl();
      const el = mount(tag, (host) => {
        host.setAttribute('without-images', '');
        host.content = `before ![tracking *pixel*](${src} "title") after`;
      });
      const root = await rendered(el, 'after');
      expect(imageLoaders(root)).to.equal(0);
      expect(root.textContent).to.include('before tracking pixel after');
      // Give a hypothetical request time to surface in resource timing.
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(requested(src)).to.equal(false);
    });

    it('renders a linked image as alt text inside the surviving link', async () => {
      const el = mount(tag, (host) => {
        host.withoutImages = true;
        host.content = `[![badge](${beaconUrl()})](https://example.com/build) done`;
      });
      const root = await rendered(el, 'done');
      expect(imageLoaders(root)).to.equal(0);
      const link = root.querySelector('a[part="link"]')!;
      expect(link.getAttribute('href')).to.equal('https://example.com/build');
      expect(link.textContent).to.equal('badge');
    });

    for (const mode of ['sanitize', 'trusted'] as const) {
      it(`strips raw-HTML image loaders in ${mode} mode, keeping img alt text`, async () => {
        const src = beaconUrl();
        const srcset = beaconUrl();
        const poster = beaconUrl();
        const svgImage = beaconUrl();
        const el = mount(tag, (host) => {
          host.withoutImages = true;
          host.htmlMode = mode;
          host.content = [
            `lead <img src="${src}" srcset="${srcset} 2x" alt="raw alt"> tail`,
            '',
            `<picture><source srcset="${srcset}"><img src="${src}" alt="pictured"></picture>`,
            '',
            `<p><svg width="10" height="10"><image href="${svgImage}" width="10" height="10"></image></svg> svg</p>`,
            '',
            `<video poster="${poster}"></video>`,
            '',
            `<p><input type="image" src="${src}" alt="submit image"> end</p>`,
          ].join('\n');
        });
        const root = await rendered(el, 'end');
        expect(imageLoaders(root)).to.equal(0);
        expect(root.querySelector('video')?.hasAttribute('poster') ?? false).to.equal(false);
        expect(root.textContent).to.include('lead raw alt tail');
        expect(root.textContent).to.include('pictured');
        expect(root.textContent).to.include('submit image');
        await new Promise((resolve) => setTimeout(resolve, 50));
        for (const url of [src, srcset, poster, svgImage]) expect(requested(url), url).to.equal(false);
      });
    }

    it('keeps escape mode showing raw HTML as text while dropping Markdown images', async () => {
      const el = mount(tag, (host) => {
        host.withoutImages = true;
        host.htmlMode = 'escape';
        host.content = `![alt words](${beaconUrl()}) and <img alt="x" src="y"> end`;
      });
      const root = await rendered(el, 'end');
      expect(imageLoaders(root)).to.equal(0);
      expect(root.textContent).to.include('alt words and <img alt="x" src="y"> end');
    });

    it('removes authored style elements in sanitize mode', async () => {
      const el = mount(tag, (host) => {
        host.withoutImages = true;
        host.content = `styled <span>x</span><style>:host { background: url(/lyra-without-images-beacon.png); }</style> end`;
      });
      const root = await rendered(el, 'x end');
      expect(root.querySelector('style') === null).to.equal(true);
    });

    it('re-renders when the property toggles in either direction', async () => {
      const src = beaconUrl();
      const el = mount(tag, (host) => { host.content = `![toggle alt](${src}) end`; });
      await el.updateComplete;
      await waitUntil(() => contentOf(el)?.querySelector('img') != null, 'image did not render before toggling');

      el.withoutImages = true;
      await el.updateComplete;
      await waitUntil(() => contentOf(el)?.querySelector('img') == null, 'image survived without-images');
      expect(contentOf(el)!.textContent).to.include('toggle alt end');

      el.withoutImages = false;
      await el.updateComplete;
      await waitUntil(() => contentOf(el)?.querySelector('img') != null, 'image did not return after clearing');
      expect(contentOf(el)!.querySelector('img')!.getAttribute('src')).to.equal(src);
    });

    it('applies to progressively streamed settled blocks and the settled document', async () => {
      const el = mount(tag, (host) => {
        host.withoutImages = true;
        host.streaming = true;
        host.streamingRender = 'progressive';
        host.content = `# Answer\n\n![streamed alt](${beaconUrl()})\n\n<img src="${beaconUrl()}" alt="raw streamed">\n\nnext block\n\n`;
      });
      await el.updateComplete;
      await waitUntil(() => (contentOf(el)?.textContent ?? '').includes('next block'), 'progressive blocks did not settle');
      expect(imageLoaders(contentOf(el)!)).to.equal(0);
      expect(contentOf(el)!.textContent).to.include('streamed alt');

      el.streaming = false;
      await el.updateComplete;
      await waitUntil(() => contentOf(el)?.querySelector('h1') != null && !el.hasAttribute('aria-busy'), 'document did not settle');
      expect(imageLoaders(contentOf(el)!)).to.equal(0);
      expect(contentOf(el)!.textContent).to.include('raw streamed');
    });
  });
}

describe('without-images helpers', () => {
  it('forbids style elements in the sanitize policy only when requested', () => {
    expect(markdownSanitizerPolicy({ htmlMode: 'sanitize', math: false, codeBlockHeader: false, withoutImages: true }))
      .to.have.deep.property('FORBID_TAGS', ['style']);
    expect(markdownSanitizerPolicy({ htmlMode: 'sanitize', math: false, codeBlockHeader: false, withoutImages: false }))
      .to.not.have.property('FORBID_TAGS');
    expect(markdownSanitizerPolicy({ htmlMode: 'trusted', math: false, codeBlockHeader: false, withoutImages: true })).to.equal(null);
  });

  it('strips images even when the parser reported no raw HTML (consumer renderer output)', async () => {
    const deps = await loadMarkdownDeps();
    const markup = '<p><img src="https://example.invalid/a.png" alt="from extension"> ok</p>';
    expect(finishMarkdownHtml(deps, null, markup, false, true)).to.equal('<p>from extension ok</p>');
    expect(finishMarkdownHtml(deps, null, markup, false)).to.equal(markup);
  });
});
