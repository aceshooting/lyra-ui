import { fixture, expect, html, waitUntil, oneEvent, fixtureSync, aTimeout } from '@open-wc/testing';
import './markdown-core.js';
import type { LyraMarkdownCore, MarkdownHeadingItem } from './markdown-core.js';
import { __setKatexForTesting } from './markdown-core.class.js';
import { loadMarkdownDeps } from './markdown-loader.js';
import { supportsCustomHighlights } from '../../../internal/text-highlights.js';
import type { LyraAnchor } from '../../viewers/document-viewer/anchors.js';

/** Whether a `text-quote` highlight painted with `tone` is currently visible, via whichever paint
 *  path this browser uses -- mirrors `markdown.test.ts`'s own identically-named helper. */
function highlightPainted(el: LyraMarkdownCore, tone = 'accent'): boolean {
  if (supportsCustomHighlights()) {
    const registry = (globalThis as unknown as { CSS: { highlights: Map<string, { size: number }> } }).CSS.highlights;
    return (registry.get(`lr-highlight-${tone}`)?.size ?? 0) > 0;
  }
  return el.shadowRoot!.querySelector(`[part="content"] mark[data-lr-highlight-tone="${tone}"]`) !== null;
}

// Blocks the test suite from ever navigating the actual test page/opening a real tab -- mirrors
// markdown.test.ts's own identically-named helper.
function withNavigationBlocked<T>(run: () => T): T {
  const blockNav = (e: Event) => e.preventDefault();
  document.addEventListener('click', blockNav, { capture: true });
  try {
    return run();
  } finally {
    document.removeEventListener('click', blockNav, { capture: true });
  }
}

describe('lr-markdown-core', () => {
  it('renders sanitized GFM content (heading/bold/link/blockquote/table) identically to lr-markdown', async () => {
    const content = `# Heading

Some **bold** text with a [link](https://example.com/docs).

> A quote worth reading.

| a | b |
| --- | --- |
| 1 | 2 |
`;
    const el = (await fixture(html`<lr-markdown-core .content=${content}></lr-markdown-core>`)) as LyraMarkdownCore;
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
      html`<lr-markdown-core .sanitize=${false} content=${'<div id="raw">hi</div>'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await el.updateComplete;
    // Same async-load window as above -- wait for the real (unsanitized) output.
    await waitUntil(() => el.shadowRoot!.querySelector('#raw') !== null);
    expect(el.shadowRoot!.querySelector('#raw')).to.exist;
  });

  it('escapes raw HTML when escape-html is set', async () => {
    const el = (await fixture(
      html`<lr-markdown-core escape-html content=${'<b>raw</b>'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.innerHTML).to.include('&lt;b&gt;raw&lt;/b&gt;');
  });

  it('is accessible with plain content', async () => {
    // Includes a link (focusable content) alongside the heading -- axe's scrollable-region-focusable
    // rule flags [part="content"]'s overflow-inline: auto whenever the rendered content has no
    // focusable descendant at all, a pre-existing characteristic this component inherits unchanged
    // from <lr-markdown> (its own populated-accessibility test's richSample content always
    // includes a link for the same reason).
    const el = (await fixture(
      html`<lr-markdown-core content=${'# Title\n\nSee the [docs](https://example.com/docs).'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    await expect(el).to.be.accessible();
  });
});

describe('languages (build-lean shiki, no full-bundle fallback)', () => {
  it('defaults languages to an empty object, highlightCode to true', async () => {
    const el = (await fixture(html`<lr-markdown-core></lr-markdown-core>`)) as LyraMarkdownCore;
    expect(el.languages).to.deep.equal({});
    expect(el.highlightCode).to.be.true;
  });

  it('highlights a fenced block whose language is a key in languages', async function () {
    this.timeout(20_000);
    const tsLang = await import('shiki/langs/typescript.mjs').catch(() => null);
    if (!tsLang) return; // shiki not installed in this environment -- covered elsewhere
    const el = (await fixture(html`<lr-markdown-core></lr-markdown-core>`)) as LyraMarkdownCore;
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
    const el = (await fixture(html`<lr-markdown-core></lr-markdown-core>`)) as LyraMarkdownCore;
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
    const el = (await fixture(html`<lr-markdown-core streaming></lr-markdown-core>`)) as LyraMarkdownCore;
    el.languages = { typescript: tsLang.default };
    el.content = '```typescript\nconst x = 1;\n```';
    await el.updateComplete;
    await aTimeout(300);
    expect(el.shadowRoot!.querySelector('[part="code-block"] span')).to.not.exist;
  });

  it('does not highlight when highlightCode is false', async () => {
    const el = (await fixture(html`<lr-markdown-core></lr-markdown-core>`)) as LyraMarkdownCore;
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
    const el = (await fixture(html`<lr-markdown-core></lr-markdown-core>`)) as LyraMarkdownCore;
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

  it('discards a stale in-flight highlight superseded by a newer content change (highlightToken guard)', async function () {
    this.timeout(20_000);
    const tsLang = await import('shiki/langs/typescript.mjs').catch(() => null);
    if (!tsLang) return;
    type Internals = { highlightToken: number };
    const el = (await fixture(html`<lr-markdown-core></lr-markdown-core>`)) as LyraMarkdownCore;
    el.languages = { typescript: tsLang.default };
    el.content = '```typescript\nconst x = 1;\n```';
    await el.updateComplete;
    const tokenAfterFirst = (el as unknown as Internals).highlightToken;
    el.content = '```typescript\nconst x = 2;\n```';
    await el.updateComplete;
    expect((el as unknown as Internals).highlightToken).to.be.greaterThan(tokenAfterFirst);

    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="code-block"] span') !== null,
      'never highlighted',
      { timeout: 8000 },
    );
    expect(el.shadowRoot!.querySelector('[part="code-block"]')!.textContent).to.include('const x = 2;');
  });
});

describe('streaming raf scheduling / renderMarkdown guards', () => {
  it('coalesces rapid streaming content updates to one parse per animation frame', async () => {
    const el = (await fixture(html`<lr-markdown-core content="Initial"></lr-markdown-core>`)) as LyraMarkdownCore;
    await waitUntil(() => !el.hasAttribute('aria-busy'));
    type Internals = { renderMarkdown(): void; renderedHtml: string | null };
    const internals = el as unknown as Internals;
    let renders = 0;
    const original = internals.renderMarkdown.bind(el);
    internals.renderMarkdown = () => {
      renders++;
      original();
    };

    el.streaming = true;
    await el.updateComplete;
    renders = 0;
    el.content = 'Chunk 1';
    el.content = 'Chunk 2';
    await el.updateComplete;
    expect(renders).to.equal(1);
    expect(internals.renderedHtml).to.contain('Chunk 2');
  });

  it('renderMarkdown() no-ops when deps has not been set yet', () => {
    const el = fixtureSync(html`<lr-markdown-core content="# hi"></lr-markdown-core>`) as LyraMarkdownCore;
    type Internals = { deps?: unknown; renderMarkdown(): void; renderedHtml: string | null };
    const internals = el as unknown as Internals;
    expect(internals.deps).to.equal(undefined);
    internals.renderMarkdown();
    expect(internals.renderedHtml, 'no render should have happened').to.equal(null);
  });

  it('does not schedule a second streaming raf while one is already pending (scheduleStreamingRender guard)', async () => {
    const el = (await fixture(html`<lr-markdown-core></lr-markdown-core>`)) as LyraMarkdownCore;
    await el.updateComplete;
    type Internals = { streamingRenderRaf?: number; scheduleStreamingRender(): void };
    const internals = el as unknown as Internals;
    internals.scheduleStreamingRender();
    const rafId = internals.streamingRenderRaf;
    expect(rafId, 'a raf should now be scheduled').to.not.equal(undefined);
    internals.scheduleStreamingRender(); // guarded no-op: must not replace the pending raf
    expect(internals.streamingRenderRaf).to.equal(rafId);
    cancelAnimationFrame(rafId!);
    internals.streamingRenderRaf = undefined; // cleanup so no stray renderMarkdown() fires later
  });
});

describe('heading anchors / scrollToAnchor (unaffected by the shiki split)', () => {
  it('computes the heading tree and stamps id when heading-anchors is set', async () => {
    const el = (await fixture(
      html`<lr-markdown-core heading-anchors content=${'# Getting Started'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    const expected: MarkdownHeadingItem[] = [{ id: 'getting-started', label: 'Getting Started', level: 1 }];
    expect(el.getHeadingTree()).to.deep.equal(expected);
    expect(el.shadowRoot!.querySelector('h1')!.getAttribute('id')).to.equal('getting-started');
  });

  it('scrolls to a heading by fragment id', async () => {
    const el = (await fixture(
      html`<lr-markdown-core content=${'# Title\n\n## Section One'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    let scrolled = false;
    (el.shadowRoot!.querySelector('h2') as HTMLElement).scrollIntoView = () => (scrolled = true);
    expect(await el.scrollToAnchor({ kind: 'fragment', id: 'section-one' })).to.be.true;
    expect(scrolled).to.be.true;
  });

  it('resolves false for an empty fragment id', async () => {
    const el = (await fixture(html`<lr-markdown-core content=${'# Title'}></lr-markdown-core>`)) as LyraMarkdownCore;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    expect(await el.scrollToAnchor({ kind: 'fragment', id: '' })).to.be.false;
  });

  it('resolves false for an unknown fragment id', async () => {
    const el = (await fixture(html`<lr-markdown-core content=${'# Title'}></lr-markdown-core>`)) as LyraMarkdownCore;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    expect(await el.scrollToAnchor({ kind: 'fragment', id: 'does-not-exist' })).to.be.false;
  });

  it('applyAnchor/computeSelectionAnchor no-op when the content root is not yet in the DOM', async () => {
    const el = fixtureSync(html`<lr-markdown-core content=${'# Title'}></lr-markdown-core>`) as LyraMarkdownCore;
    expect(el.shadowRoot!.querySelector('[part="content"]')).to.equal(null);
    type Internals = {
      applyAnchor(anchor: LyraAnchor): Promise<boolean>;
      computeSelectionAnchor(range: Range): unknown;
    };
    const internals = el as unknown as Internals;
    // computeSelectionAnchor() first, synchronously -- awaiting applyAnchor() below yields at
    // least one microtask, which is enough for Lit's already-scheduled first update to slip in
    // and render [part="content"], which would otherwise make this a false negative.
    const range = document.createRange();
    expect(internals.computeSelectionAnchor(range)).to.equal(null);
    expect(await internals.applyAnchor({ kind: 'fragment', id: 'x' })).to.be.false;
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
    const el = (await fixture(html`<lr-markdown-core math content=${'$x$'}></lr-markdown-core>`)) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="math"]') !== null);
    expect(el.shadowRoot!.querySelector('[part="math"]')!.getAttribute('data-display')).to.equal('inline');
  });

  it('fires lr-render-error and renders literal source when katex is confirmed missing', async () => {
    __setKatexForTesting(null);
    const el = fixtureSync(html`<lr-markdown-core math content=${'$E=mc^2$'}></lr-markdown-core>`) as LyraMarkdownCore;
    const event = (await oneEvent(el, 'lr-render-error')) as CustomEvent<{ error: unknown }>;
    expect(event.detail.error).to.exist;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent).to.contain('$E=mc^2$');
  });

  it('fires lr-render-error only once even after further re-renders', async () => {
    __setKatexForTesting(null);
    const el = fixtureSync(html`<lr-markdown-core math content=${'$a$'}></lr-markdown-core>`) as LyraMarkdownCore;
    await oneEvent(el, 'lr-render-error');
    let firedAgain = false;
    el.addEventListener('lr-render-error', () => (firedAgain = true));
    el.content = '$b$';
    await el.updateComplete;
    expect(firedAgain).to.be.false;
  });

  it('still reports a permanently-missing katex peer even when sanitize is explicitly false', async () => {
    __setKatexForTesting(null);
    const el = fixtureSync(html`<lr-markdown-core math .sanitize=${false} content=${'$a$'}></lr-markdown-core>`) as LyraMarkdownCore;
    const event = (await oneEvent(el, 'lr-render-error')) as CustomEvent<{ error: unknown }>;
    expect(event.detail.error).to.exist;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent).to.contain('$a$');
  });

  it('invokes the math extension\'s start() hook to locate a `$` after leading plain text', async () => {
    __setKatexForTesting(null);
    const el = (await fixture(
      html`<lr-markdown-core math content=${'Value: $x$ done'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    // katex confirmed missing -- the literal, unparsed $x$ survives inside the real (non-fallback) parse.
    expect(el.shadowRoot!.querySelector('[part="paragraph"]')!.textContent).to.equal('Value: $x$ done');
  });

  it('treats a `$` with no matching closing delimiter as literal text (tokenizer declines to match)', async () => {
    __setKatexForTesting(null);
    const el = (await fixture(
      html`<lr-markdown-core math content=${'Cost is $5 not math'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    expect(el.shadowRoot!.querySelector('[part="paragraph"]')!.textContent).to.equal('Cost is $5 not math');
  });

  it('renders block ($$...$$) math as MathML with data-display="block"', async () => {
    const fakeKatex = { renderToString: (tex: string) => `<math><mi>${tex}</mi></math>` };
    __setKatexForTesting(fakeKatex as never);
    const el = (await fixture(html`<lr-markdown-core math content=${'$$x^2$$'}></lr-markdown-core>`)) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="math"]') !== null);
    expect(el.shadowRoot!.querySelector('[part="math"]')!.getAttribute('data-display')).to.equal('block');
  });

  it('renders literal block-math source and fires lr-render-error when katex is confirmed missing', async () => {
    __setKatexForTesting(null);
    const el = fixtureSync(html`<lr-markdown-core math content=${'$$x^2$$'}></lr-markdown-core>`) as LyraMarkdownCore;
    const event = (await oneEvent(el, 'lr-render-error')) as CustomEvent<{ error: unknown }>;
    expect(event.detail.error).to.exist;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent).to.contain('$$x^2$$');
  });

  it('falls back to the literal source (inline and block) when the katex peer throws while rendering, without firing an error', async () => {
    const throwingKatex = {
      renderToString: () => {
        throw new Error('boom');
      },
    };
    __setKatexForTesting(throwingKatex as never);
    const el = (await fixture(
      html`<lr-markdown-core math content=${'$x$ and $$y$$'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    let fired = false;
    el.addEventListener('lr-render-error', () => (fired = true));
    await waitUntil(() => !el.shadowRoot!.querySelector('[part="content"]')!.hasAttribute('data-fallback'));
    const text = el.shadowRoot!.querySelector('[part="content"]')!.textContent!;
    expect(text).to.contain('$x$');
    expect(text).to.contain('$$y$$');
    expect(el.shadowRoot!.querySelector('[part="math"]')).to.not.exist;
    expect(fired, 'a throwing (but installed) peer is not "confirmed missing" -- no error event').to.be.false;
  });
});

describe('math (real katex peer, unmocked)', () => {
  it('loads the real katex peer and renders MathML when math is on without any test override', async function () {
    // A real, unmocked dynamic import('katex') -- mirrors the "shiki highlighting (real peer)"
    // describe block's own budget/rationale in markdown.test.ts for a first cold peer load.
    this.timeout(20_000);
    const el = (await fixture(html`<lr-markdown-core math content=${'$x^2$'}></lr-markdown-core>`)) as LyraMarkdownCore;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="math"] math') !== null,
      'never rendered via the real katex peer',
      { timeout: 15_000 },
    );
    expect(el.shadowRoot!.querySelector('[part="math"]')!.getAttribute('data-display')).to.equal('inline');
  });
});

describe('cleanHref (malformed href)', () => {
  it('drops the anchor and renders only the link text when the href is malformed (lone surrogate)', async () => {
    const el = (await fixture(html`<lr-markdown-core content=${'[a](\uD800)'}></lr-markdown-core>`)) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]')!.textContent!.trim().length > 0);
    expect(el.shadowRoot!.querySelector('a')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent).to.contain('a');
  });
});

describe('eager-load / connect timing', () => {
  it('eager-load synchronously adopts the already-warm marked/dompurify cache, skipping the async import() hop', async () => {
    // Prime the module-level cache markdown-loader.ts shares across every <lr-markdown-core>
    // instance -- by the time this resolves, getMarkdownDepsIfLoaded() returns synchronously.
    await loadMarkdownDeps();

    const el = fixtureSync(html`<lr-markdown-core eager-load content="# hi"></lr-markdown-core>`) as LyraMarkdownCore;
    type Internals = { deps?: unknown; renderedHtml: string | null };
    const internals = el as unknown as Internals;
    expect(internals.deps, 'deps must already be set synchronously, before any microtask has run').to.exist;
    expect(internals.renderedHtml, 'renderMarkdown() must already have run synchronously').to.not.equal(null);

    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.hasAttribute('data-fallback')).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('hi');
  });

  it('cancels a pending streaming raf on disconnect before it fires', async () => {
    const el = (await fixture(html`<lr-markdown-core></lr-markdown-core>`)) as LyraMarkdownCore;
    await el.updateComplete;
    type Internals = { streamingRenderRaf?: number };
    // A real, still-pending raf id we can safely cancel twice -- avoids racing the real
    // scheduleStreamingRender() timing while still exercising disconnectedCallback()'s own cleanup.
    const rafId = requestAnimationFrame(() => {});
    (el as unknown as Internals).streamingRenderRaf = rafId;
    el.remove();
    expect((el as unknown as Internals).streamingRenderRaf).to.equal(undefined);
    cancelAnimationFrame(rafId);
  });

  it('cancels a stale pending streaming raf when a non-streaming property change triggers an immediate render', async () => {
    const el = (await fixture(html`<lr-markdown-core content="hello"></lr-markdown-core>`)) as LyraMarkdownCore;
    await el.updateComplete;
    type Internals = { streamingRenderRaf?: number };
    const rafId = requestAnimationFrame(() => {});
    (el as unknown as Internals).streamingRenderRaf = rafId;
    el.sanitize = false;
    await el.updateComplete;
    expect((el as unknown as Internals).streamingRenderRaf).to.equal(undefined);
  });
});

describe('fallback matrix', () => {
  it('falls back to plain text and fires lr-render-error when the marked peer is unavailable', async () => {
    const el = (await fixture(html`<lr-markdown-core content="# hi"></lr-markdown-core>`)) as LyraMarkdownCore;
    type Internals = { deps?: { marked: unknown; DOMPurify: unknown }; renderMarkdown(): void };
    await waitUntil(() => (el as unknown as Internals).deps !== undefined);
    const internals = el as unknown as Internals;

    const listener = oneEvent(el, 'lr-render-error');
    internals.deps = { marked: undefined, DOMPurify: internals.deps!.DOMPurify };
    internals.renderMarkdown();
    const { detail } = await listener;
    expect(detail.error).to.exist;

    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.hasAttribute('data-fallback')).to.be.true;
    expect(el.shadowRoot!.textContent).to.contain('# hi');
  });

  it('falls back and fires lr-render-error when sanitize is true (default) but dompurify is unavailable, even though marked loaded fine', async () => {
    const el = (await fixture(html`<lr-markdown-core content="**bold**"></lr-markdown-core>`)) as LyraMarkdownCore;
    type Internals = { deps?: { marked: unknown; DOMPurify: unknown }; renderMarkdown(): void };
    await waitUntil(() => (el as unknown as Internals).deps !== undefined);
    const internals = el as unknown as Internals;
    expect(internals.deps!.marked, 'precondition: marked must have actually loaded').to.exist;

    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      const listener = oneEvent(el, 'lr-render-error');
      internals.deps = { marked: internals.deps!.marked, DOMPurify: undefined };
      internals.renderMarkdown();
      const { detail } = await listener;
      expect(detail.error).to.exist;
      expect(calls).to.have.length(1);
      expect(calls[0][0]).to.contain('dompurify');
    } finally {
      console.warn = originalWarn;
    }

    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.hasAttribute('data-fallback')).to.be.true;
  });

  it('renders unsanitized (no fallback, no event) when sanitize is explicitly false and dompurify is unavailable', async () => {
    const el = (await fixture(html`<lr-markdown-core content="**bold**"></lr-markdown-core>`)) as LyraMarkdownCore;
    el.sanitize = false;
    type Internals = { deps?: { marked: unknown; DOMPurify: unknown }; renderMarkdown(): void };
    await waitUntil(() => (el as unknown as Internals).deps !== undefined);
    const internals = el as unknown as Internals;

    let fired = false;
    el.addEventListener('lr-render-error', () => (fired = true));
    internals.deps = { marked: internals.deps!.marked, DOMPurify: undefined };
    internals.renderMarkdown();
    await el.updateComplete;

    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.hasAttribute('data-fallback')).to.be.false;
    expect(el.shadowRoot!.querySelector('strong')).to.exist;
  });

  it('falls back and fires lr-render-error with the actual caught error when marked itself throws while parsing', async () => {
    const el = (await fixture(html`<lr-markdown-core content="whatever"></lr-markdown-core>`)) as LyraMarkdownCore;
    type Internals = { deps?: { marked: unknown; DOMPurify: unknown }; renderMarkdown(): void };
    await waitUntil(() => (el as unknown as Internals).deps !== undefined);
    const internals = el as unknown as Internals;

    const boom = new Error('parse boom');
    class ThrowingMarked {
      use(): this {
        return this;
      }
      parse(): never {
        throw boom;
      }
    }
    internals.deps = { marked: { Marked: ThrowingMarked }, DOMPurify: internals.deps!.DOMPurify };

    const listener = oneEvent(el, 'lr-render-error');
    internals.renderMarkdown();
    const { detail } = await listener;
    expect(detail.error).to.equal(boom);
  });
});

describe('paragraph/list/inline-code/image parts', () => {
  it('adds part="paragraph" to rendered <p>', async () => {
    const el = (await fixture(html`<lr-markdown-core content="Hello world"></lr-markdown-core>`)) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]'), 'never rendered', { timeout: 4000 });
    expect(el.shadowRoot!.querySelector('[part="paragraph"]')!.textContent).to.equal('Hello world');
  });

  it('adds part="list" to a rendered <ul> and <ol>, with a start attribute when an ordered list does not start at 1', async () => {
    const el = (await fixture(html`<lr-markdown-core content=${'- a\n- b'}></lr-markdown-core>`)) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="list"]'), 'never rendered', { timeout: 4000 });
    expect(el.shadowRoot!.querySelector('[part="list"]')!.tagName).to.equal('UL');

    el.content = '5. a\n6. b';
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="list"]')?.tagName === 'OL', 'never rendered', { timeout: 4000 });
    expect(el.shadowRoot!.querySelector('[part="list"]')!.getAttribute('start')).to.equal('5');
  });

  it('adds part="inline-code" to a bare inline codespan, but not to a fenced code block\'s <code>', async () => {
    const el = (await fixture(
      html`<lr-markdown-core content=${'some `inline` and:\n\n```\nfenced\n```'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="inline-code"]'), 'never rendered', { timeout: 4000 });
    expect(el.shadowRoot!.querySelector('[part="inline-code"]')!.textContent).to.equal('inline');
    const fencedCode = el.shadowRoot!.querySelector('[part="code-block"] code')!;
    expect(fencedCode.hasAttribute('part')).to.be.false;
  });

  it('escapes HTML in an inline codespan the same way the default renderer would', async () => {
    const el = (await fixture(html`<lr-markdown-core content=${'`<script>`'}></lr-markdown-core>`)) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="inline-code"]'), 'never rendered', { timeout: 4000 });
    expect(el.shadowRoot!.querySelector('[part="inline-code"]')!.textContent).to.equal('<script>');
    expect(el.shadowRoot!.querySelector('script')).to.not.exist;
  });

  it('renders a 4-space indented code block (marked pre-escapes it; token.escaped is true)', async () => {
    const el = (await fixture(
      html`<lr-markdown-core content=${'    <div>indented</div>'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="code-block"]') !== null);
    const code = el.shadowRoot!.querySelector('[part="code-block"] code')!;
    expect(code.textContent).to.equal('<div>indented</div>\n');
    expect(el.shadowRoot!.querySelector('[part="code-block"] div')).to.not.exist;
  });

  it('renders an <img> from source markdown with part="img"', async () => {
    const el = (await fixture(
      html`<lr-markdown-core content=${'![alt text](https://example.com/pic.png)'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('img') !== null);

    const img = el.shadowRoot!.querySelector('img')!;
    expect(img.getAttribute('part')).to.equal('img');
    expect(img.getAttribute('src')).to.equal('https://example.com/pic.png');
    expect(img.getAttribute('alt')).to.equal('alt text');
  });

  it('renders a title attribute on a link and an image when the source supplies one', async () => {
    const el = (await fixture(
      html`<lr-markdown-core content=${'[docs](https://example.com "Docs title")\n\n![alt](https://example.com/pic.png "Pic title")'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('img') !== null);
    expect(el.shadowRoot!.querySelector('a')!.getAttribute('title')).to.equal('Docs title');
    expect(el.shadowRoot!.querySelector('img')!.getAttribute('title')).to.equal('Pic title');
  });

  it('drops an <img> (rendering the escaped alt text) when its href is malformed (lone surrogate)', async () => {
    const el = (await fixture(html`<lr-markdown-core content=${'![alt](\uD800)'}></lr-markdown-core>`)) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]')!.textContent!.trim().length > 0);
    expect(el.shadowRoot!.querySelector('img')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent).to.contain('alt');
  });

  it('adds an align attribute to an aligned table header cell, and omits <tbody> for a header-only table', async () => {
    const el = (await fixture(
      html`<lr-markdown-core content=${'| a | b |\n| :--- | ---: |\n'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
    const ths = el.shadowRoot!.querySelectorAll('[part="table"] th');
    expect(ths[0].getAttribute('align')).to.equal('left');
    expect(ths[1].getAttribute('align')).to.equal('right');
    expect(el.shadowRoot!.querySelector('[part="table"] tbody')).to.not.exist;
  });
});

describe('link-target edge cases', () => {
  it('omits target/rel on rendered links when link-target is explicitly disabled', async () => {
    const el = (await fixture(html`<lr-markdown-core link-target=""></lr-markdown-core>`)) as LyraMarkdownCore;
    el.content = '[docs](https://example.com/docs)';
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);

    const a = el.shadowRoot!.querySelector('a')!;
    expect(a.getAttribute('target')).to.equal(null);
    expect(a.getAttribute('rel')).to.equal(null);
    expect(a.getAttribute('part')).to.equal('link');
    expect(a.getAttribute('href')).to.equal('https://example.com/docs');
  });

  it('omits target/rel on rendered links when link-target is set to null via the property', async () => {
    const el = (await fixture(html`<lr-markdown-core></lr-markdown-core>`)) as LyraMarkdownCore;
    el.linkTarget = null;
    el.content = '[docs](https://example.com/docs)';
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);

    const a = el.shadowRoot!.querySelector('a')!;
    expect(a.getAttribute('target')).to.equal(null);
    expect(a.getAttribute('rel')).to.equal(null);
  });
});

describe('highlight cache LRU (setCachedHighlight)', () => {
  type Internals = {
    highlightCache: Map<string, string>;
    setCachedHighlight(key: string, html: string): void;
  };
  function internalsOf(el: LyraMarkdownCore): Internals {
    return el as unknown as Internals;
  }

  it('overwrites (refreshes) an existing cache entry instead of duplicating it', async () => {
    const el = (await fixture(html`<lr-markdown-core></lr-markdown-core>`)) as LyraMarkdownCore;
    const internals = internalsOf(el);
    internals.setCachedHighlight('k1', 'first');
    internals.setCachedHighlight('k1', 'second');
    expect(internals.highlightCache.get('k1')).to.equal('second');
    expect(internals.highlightCache.size).to.equal(1);
  });

  it('evicts the oldest entry once the cache exceeds its 100-entry bound', async () => {
    const el = (await fixture(html`<lr-markdown-core></lr-markdown-core>`)) as LyraMarkdownCore;
    const internals = internalsOf(el);
    for (let i = 0; i < 100; i++) internals.setCachedHighlight(`k${i}`, `v${i}`);
    expect(internals.highlightCache.has('k0')).to.be.true;
    internals.setCachedHighlight('k100', 'v100');
    expect(internals.highlightCache.has('k0'), 'oldest entry should have been evicted').to.be.false;
    expect(internals.highlightCache.size).to.equal(100);
  });
});

describe('fine-grained highlighter build failure (languages, no default fallback)', () => {
  it('records a language as permanently failed when its supplied grammar cannot build a highlighter', async () => {
    const el = (await fixture(html`<lr-markdown-core></lr-markdown-core>`)) as LyraMarkdownCore;
    // A garbage "grammar" object under a key matching the fenced block's language -- passes the
    // languages[lang] presence check, but createHighlighterCore() has nothing valid to register,
    // so loadShikiHighlighterCore() resolves null via its own real (unmocked) catch().
    el.languages = { bogus: { not: 'a real shiki grammar' } as never };
    el.content = '```bogus\nhello\n```';
    await el.updateComplete;
    await aTimeout(1500);
    expect(el.shadowRoot!.querySelector('[part="code-block"] span')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="code-block"] code')!.textContent).to.equal('hello\n');
  });
});

describe('applyAnchor default case', () => {
  it('resolves false via the default switch case for an anchor kind this component does not support', async () => {
    const el = (await fixture(html`<lr-markdown-core content=${'# Title'}></lr-markdown-core>`)) as LyraMarkdownCore;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    const unsupported: LyraAnchor = { kind: 'page', page: 1 };
    expect(await el.scrollToAnchor(unsupported)).to.be.false;
  });
});

describe('scrollToAnchor / highlights (text-quote)', () => {
  it('scrolls to a text-quote anchor', async () => {
    const el = (await fixture(
      html`<lr-markdown-core content=${'The quick brown fox jumps over the lazy dog.'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    let scrolled = false;
    const paragraph = el.shadowRoot!.querySelector('[part="paragraph"]') as HTMLElement;
    paragraph.scrollIntoView = () => {
      scrolled = true;
    };
    const result = await el.scrollToAnchor({ kind: 'text-quote', quote: 'brown fox' });
    expect(result).to.be.true;
    expect(scrolled).to.be.true;
  });

  it('resolves false for a text-quote anchor that matches nothing', async () => {
    const el = (await fixture(html`<lr-markdown-core content=${'Hello world'}></lr-markdown-core>`)) as LyraMarkdownCore;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'nothing to see here' })).to.be.false;
  });

  it('paints a text-quote highlight (CSS Custom Highlight API, or a <mark> fallback)', async () => {
    const el = (await fixture(
      html`<lr-markdown-core content=${'The quick brown fox jumps over the lazy dog.'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'brown fox' } }];
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    await el.updateComplete;
    expect(highlightPainted(el)).to.be.true;
    if (!supportsCustomHighlights()) {
      const mark = el.shadowRoot!.querySelector('[part="content"] mark[data-lr-highlight-tone="accent"]')!;
      expect(mark.textContent).to.equal('brown fox');
      expect(mark.getAttribute('part')).to.equal('highlight');
    }
  });

  it('ignores a non-text-quote highlight kind (nothing to paint) while still painting a text-quote one alongside it', async () => {
    const el = (await fixture(
      html`<lr-markdown-core content=${'The quick brown fox jumps over the lazy dog.'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    el.highlights = [
      { id: 'h0', anchor: { kind: 'fragment', id: 'nope' } },
      { id: 'h1', anchor: { kind: 'text-quote', quote: 'brown fox' } },
    ];
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    await el.updateComplete;
    expect(highlightPainted(el)).to.be.true;
  });

  it('skips a text-quote highlight whose quote does not resolve against the rendered content', async () => {
    const el = (await fixture(
      html`<lr-markdown-core content=${'The quick brown fox jumps over the lazy dog.'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    el.highlights = [
      { id: 'h0', anchor: { kind: 'text-quote', quote: 'nothing to see here' } },
      { id: 'h1', anchor: { kind: 'text-quote', quote: 'brown fox' } },
    ];
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    await el.updateComplete;
    expect(highlightPainted(el)).to.be.true;
  });

  it('marks the active highlight via activeHighlightId', async () => {
    const el = (await fixture(
      html`<lr-markdown-core content=${'The quick brown fox jumps over the lazy dog.'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'brown fox' } }];
    el.activeHighlightId = 'h1';
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    await el.updateComplete;
    if (supportsCustomHighlights()) {
      const registry = (globalThis as unknown as { CSS: { highlights: Map<string, { size: number }> } }).CSS.highlights;
      expect((registry.get('lr-highlight-active')?.size ?? 0) > 0).to.be.true;
    } else {
      expect(el.shadowRoot!.querySelector('[part="content"] mark[data-lr-highlight-name="lr-highlight-active"]')).to.exist;
    }
  });

  it('clears a previously-painted highlight once highlights is set back to empty', async () => {
    const el = (await fixture(
      html`<lr-markdown-core content=${'The quick brown fox jumps over the lazy dog.'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'brown fox' } }];
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    await el.updateComplete;
    expect(highlightPainted(el)).to.be.true;

    el.highlights = [];
    await el.updateComplete;
    expect(highlightPainted(el)).to.be.false;
  });

  it('emits lr-highlight-activate when a painted highlight is clicked', async () => {
    const el = (await fixture(html`<lr-markdown-core content=${'Hello world'}></lr-markdown-core>`)) as LyraMarkdownCore;
    el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'world' } }];
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    await el.updateComplete;

    const paragraph = el.shadowRoot!.querySelector('[part="content"] p')!;
    const textNode = paragraph.firstChild as Text;
    const offset = textNode.data.indexOf('world');
    const range = document.createRange();
    range.setStart(textNode, offset);
    range.setEnd(textNode, offset + 'world'.length);
    const rect = range.getClientRects()[0];

    const listener = oneEvent(el, 'lr-highlight-activate');
    paragraph.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        composed: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }),
    );
    const event = await listener;
    expect((event as CustomEvent).detail).to.deep.equal({ id: 'h1' });
  });

  it('does not activate a highlight, and falls through to normal link handling, on a click elsewhere in the content', async () => {
    const el = (await fixture(
      html`<lr-markdown-core internal-link-prefix="/docs/" content=${'Hello [world](/docs/world) and highlighted brown fox'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'brown fox' } }];
    await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
    await el.updateComplete;

    let highlightFired = false;
    el.addEventListener('lr-highlight-activate', () => (highlightFired = true));
    const listener = oneEvent(el, 'lr-link-click');
    withNavigationBlocked(() => (el.shadowRoot!.querySelector('a') as HTMLElement).click());
    const { detail } = await listener;
    expect(detail).to.deep.equal({ href: '/docs/world', internal: true });
    expect(highlightFired).to.be.false;
  });

  it('does not intercept any link when internal-link-prefix is unset', async () => {
    const el = (await fixture(html`<lr-markdown-core></lr-markdown-core>`)) as LyraMarkdownCore;
    el.content = '[setup](/docs/setup)';
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
    const a = el.shadowRoot!.querySelector('a')!;

    let fired = false;
    el.addEventListener('lr-link-click', () => (fired = true));
    withNavigationBlocked(() => a.click());
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it('does not fire lr-link-click for an ordinary external link even when internal-link-prefix is set', async () => {
    const el = (await fixture(
      html`<lr-markdown-core internal-link-prefix="/docs/" content=${'[site](https://example.com)'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
    const a = el.shadowRoot!.querySelector('a')!;

    let fired = false;
    el.addEventListener('lr-link-click', () => (fired = true));
    withNavigationBlocked(() => a.click());
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it('no-ops when the click target has no anchor in its composed path, even with internal-link-prefix set', async () => {
    const el = (await fixture(
      html`<lr-markdown-core internal-link-prefix="/docs/" content=${'Plain paragraph text'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);

    let fired = false;
    el.addEventListener('lr-link-click', () => (fired = true));
    const paragraph = el.shadowRoot!.querySelector('[part="paragraph"]') as HTMLElement;
    withNavigationBlocked(() =>
      paragraph.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true, clientX: 1, clientY: 1 })),
    );
    await el.updateComplete;
    expect(fired).to.be.false;
  });

  it('emits lr-text-select with a text-quote anchor on selection', async () => {
    const el = (await fixture(
      html`<lr-markdown-core content=${'The quick brown fox jumps over the lazy dog.'}></lr-markdown-core>`,
    )) as LyraMarkdownCore;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    await el.updateComplete;
    const paragraph = el.shadowRoot!.querySelector('[part="content"] p')!;
    const textNode = paragraph.firstChild!;
    const range = document.createRange();
    range.setStart(textNode, 10);
    range.setEnd(textNode, 15);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const listener = oneEvent(el, 'lr-text-select');
    (paragraph as HTMLElement).dispatchEvent(new MouseEvent('pointerup', { bubbles: true, composed: true }));
    const event = (await listener) as CustomEvent<{ text: string; anchor: unknown }>;
    expect(event.detail.text).to.equal('brown');
    selection.removeAllRanges();
  });

  it('repaintHighlights no-ops when the content root is not yet in the DOM', () => {
    const el = fixtureSync(html`<lr-markdown-core></lr-markdown-core>`) as LyraMarkdownCore;
    // Precondition: fixtureSync() connects but does not await the first Lit update, so the
    // [part="content"] wrapper hasn't been rendered into the shadow root yet.
    expect(el.shadowRoot!.querySelector('[part="content"]')).to.equal(null);
    (el as unknown as { repaintHighlights(): void }).repaintHighlights();
    // No throw -- repaintHighlights() must bail out cleanly with nothing to paint into yet.
  });
});
