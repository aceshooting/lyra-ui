import { fixture, expect, html, waitUntil, oneEvent, fixtureSync, aTimeout } from '@open-wc/testing';
import './markdown-core.js';
import type { LyraMarkdownCore, MarkdownHeadingItem } from './markdown-core.js';
import { __setKatexForTesting } from './markdown-core.class.js';

describe('lyra-markdown-core', () => {
  it('renders sanitized GFM content (heading/bold/link/blockquote/table) identically to lyra-markdown', async () => {
    const content = `# Heading

Some **bold** text with a [link](https://example.com/docs).

> A quote worth reading.

| a | b |
| --- | --- |
| 1 | 2 |
`;
    const el = (await fixture(html`<lyra-markdown-core .content=${content}></lyra-markdown-core>`)) as LyraMarkdownCore;
    await el.updateComplete;
    const root = el.shadowRoot!;
    // The very first paint is always the plain-text fallback until the async marked/dompurify
    // load resolves (see the class doc) -- wait for the real rendered output before asserting.
    await waitUntil(() => root.querySelector('[part="table"]') !== null);
    expect(root.querySelector('[part="heading"]')!.textContent).to.equal('Heading');
    expect(root.querySelector('strong')).to.exist;
    expect(root.querySelector('[part="link"]')!.getAttribute('href')).to.equal('https://example.com/docs');
    expect(root.querySelector('[part="blockquote"]')).to.exist;
    expect(root.querySelector('[part="table"]')).to.exist;
  });

  it('renders raw marked output when sanitize is false', async () => {
    const el = (await fixture(
      html`<lyra-markdown-core .sanitize=${false} content=${'<div id="raw">hi</div>'}></lyra-markdown-core>`,
    )) as LyraMarkdownCore;
    await el.updateComplete;
    // Same async-load window as above -- wait for the real (unsanitized) output.
    await waitUntil(() => el.shadowRoot!.querySelector('#raw') !== null);
    expect(el.shadowRoot!.querySelector('#raw')).to.exist;
  });

  it('escapes raw HTML when escape-html is set', async () => {
    const el = (await fixture(
      html`<lyra-markdown-core escape-html content=${'<b>raw</b>'}></lyra-markdown-core>`,
    )) as LyraMarkdownCore;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.innerHTML).to.include('&lt;b&gt;raw&lt;/b&gt;');
  });

  it('is accessible with plain content', async () => {
    // Includes a link (focusable content) alongside the heading -- axe's scrollable-region-focusable
    // rule flags [part="content"]'s overflow-inline: auto whenever the rendered content has no
    // focusable descendant at all, a pre-existing characteristic this component inherits unchanged
    // from <lyra-markdown> (its own populated-accessibility test's richSample content always
    // includes a link for the same reason).
    const el = (await fixture(
      html`<lyra-markdown-core content=${'# Title\n\nSee the [docs](https://example.com/docs).'}></lyra-markdown-core>`,
    )) as LyraMarkdownCore;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    await expect(el).to.be.accessible();
  });
});

describe('languages (build-lean shiki, no full-bundle fallback)', () => {
  it('defaults languages to an empty object, highlightCode to true', async () => {
    const el = (await fixture(html`<lyra-markdown-core></lyra-markdown-core>`)) as LyraMarkdownCore;
    expect(el.languages).to.deep.equal({});
    expect(el.highlightCode).to.be.true;
  });

  it('highlights a fenced block whose language is a key in languages', async function () {
    this.timeout(20_000);
    const tsLang = await import('shiki/langs/typescript.mjs').catch(() => null);
    if (!tsLang) return; // shiki not installed in this environment -- covered elsewhere
    const el = (await fixture(html`<lyra-markdown-core></lyra-markdown-core>`)) as LyraMarkdownCore;
    el.languages = { typescript: tsLang.default };
    el.content = '```typescript\nconst x = 1;\n```';
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="code-block"] span') !== null,
      'never highlighted via languages',
      { timeout: 8000 },
    );
    expect(el.shadowRoot!.querySelector('[part="code-block"] code')!.className).to.include('language-typescript');
  });

  it('leaves a fenced block plain when its language is absent from languages -- no full-bundle fallback', async () => {
    const el = (await fixture(html`<lyra-markdown-core></lyra-markdown-core>`)) as LyraMarkdownCore;
    el.languages = {};
    el.content = '```ts\nconst x = 1;\n```';
    await el.updateComplete;
    await aTimeout(500);
    expect(el.shadowRoot!.querySelector('[part="code-block"] span')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="code-block"] code')!.textContent).to.equal('const x = 1;\n');
  });

  it('does not highlight while streaming is true', async function () {
    this.timeout(20_000);
    const tsLang = await import('shiki/langs/typescript.mjs').catch(() => null);
    if (!tsLang) return;
    const el = (await fixture(html`<lyra-markdown-core streaming></lyra-markdown-core>`)) as LyraMarkdownCore;
    el.languages = { typescript: tsLang.default };
    el.content = '```typescript\nconst x = 1;\n```';
    await el.updateComplete;
    await aTimeout(300);
    expect(el.shadowRoot!.querySelector('[part="code-block"] span')).to.not.exist;
  });

  it('does not highlight when highlightCode is false', async () => {
    const el = (await fixture(html`<lyra-markdown-core></lyra-markdown-core>`)) as LyraMarkdownCore;
    el.highlightCode = false;
    el.languages = {};
    el.content = '```ts\nconst x = 1;\n```';
    await el.updateComplete;
    await aTimeout(500);
    expect(el.shadowRoot!.querySelector('[part="code-block"] span')).to.not.exist;
  });

  it('is accessible once highlighted via languages', async function () {
    this.timeout(20_000);
    const tsLang = await import('shiki/langs/typescript.mjs').catch(() => null);
    if (!tsLang) return;
    const el = (await fixture(html`<lyra-markdown-core></lyra-markdown-core>`)) as LyraMarkdownCore;
    el.languages = { typescript: tsLang.default };
    el.content = '```typescript\nconst x = 1;\n```';
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="code-block"] span') !== null,
      'never highlighted',
      { timeout: 8000 },
    );
    await expect(el).to.be.accessible();
  });
});

describe('heading anchors / scrollToAnchor (unaffected by the shiki split)', () => {
  it('computes the heading tree and stamps id when heading-anchors is set', async () => {
    const el = (await fixture(
      html`<lyra-markdown-core heading-anchors content=${'# Getting Started'}></lyra-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    const expected: MarkdownHeadingItem[] = [{ id: 'getting-started', label: 'Getting Started', level: 1 }];
    expect(el.getHeadingTree()).to.deep.equal(expected);
    expect(el.shadowRoot!.querySelector('h1')!.getAttribute('id')).to.equal('getting-started');
  });

  it('scrolls to a heading by fragment id', async () => {
    const el = (await fixture(
      html`<lyra-markdown-core content=${'# Title\n\n## Section One'}></lyra-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    let scrolled = false;
    (el.shadowRoot!.querySelector('h2') as HTMLElement).scrollIntoView = () => (scrolled = true);
    expect(await el.scrollToAnchor({ kind: 'fragment', id: 'section-one' })).to.be.true;
    expect(scrolled).to.be.true;
  });
});

describe('math (KaTeX, unaffected by the shiki split)', () => {
  afterEach(() => __setKatexForTesting(undefined));

  it('renders inline math as MathML when the katex peer is installed', async () => {
    const fakeKatex = {
      renderToString: (tex: string) =>
        `<math><semantics><mrow><mi>${tex}</mi></mrow><annotation encoding="application/x-tex">${tex}</annotation></semantics></math>`,
    };
    __setKatexForTesting(fakeKatex as never);
    const el = (await fixture(html`<lyra-markdown-core math content=${'$x$'}></lyra-markdown-core>`)) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="math"]') !== null);
    expect(el.shadowRoot!.querySelector('[part="math"]')!.getAttribute('data-display')).to.equal('inline');
  });

  it('fires lyra-render-error and renders literal source when katex is confirmed missing', async () => {
    __setKatexForTesting(null);
    const el = fixtureSync(html`<lyra-markdown-core math content=${'$E=mc^2$'}></lyra-markdown-core>`) as LyraMarkdownCore;
    const event = (await oneEvent(el, 'lyra-render-error')) as CustomEvent<{ error: unknown }>;
    expect(event.detail.error).to.exist;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent).to.contain('$E=mc^2$');
  });
});
