import { fixture, fixtureSync, expect, html, waitUntil, oneEvent, aTimeout } from '@open-wc/testing';
import './markdown.js';
import type { LyraMarkdown, MarkdownHeadingItem } from './markdown.js';
import { loadMarkdownDeps } from './markdown-loader.js';
import { supportsCustomHighlights } from '../../internal/text-highlights.js';
import { __setKatexForTesting } from './markdown.class.js';

/** Whether a `text-quote` highlight painted with `tone` is currently visible, via whichever paint
 *  path this browser uses -- the CSS Custom Highlight API registers ranges with no DOM element to
 *  query, so this checks the shared `CSS.highlights` registry directly there, and falls back to the
 *  `<mark data-lr-highlight-tone>` element the fallback path creates otherwise. Mirrors
 *  `text-highlights.test.ts`'s own branching. */
function highlightPainted(el: LyraMarkdown, tone = 'accent'): boolean {
  if (supportsCustomHighlights()) {
    const registry = (globalThis as unknown as { CSS: { highlights: Map<string, { size: number }> } }).CSS.highlights;
    return (registry.get(`lr-highlight-${tone}`)?.size ?? 0) > 0;
  }
  return el.shadowRoot!.querySelector(`[part="content"] mark[data-lr-highlight-tone="${tone}"]`) !== null;
}

const richSample = `# Heading

Some **bold** text with a [link](https://example.com/docs).

> A quote worth reading.

\`\`\`ts
const x = 1;
\`\`\`

| a | b |
| --- | --- |
| 1 | 2 |
`;

// Blocks in the test suite from ever navigating the actual test page/opening
// a real tab, regardless of whether the component's own preventDefault()
// logic behaves as expected — belt-and-suspenders around every real .click().
function withNavigationBlocked<T>(run: () => T): T {
  const blockNav = (e: Event) => e.preventDefault();
  document.addEventListener('click', blockNav, { capture: true });
  try {
    return run();
  } finally {
    document.removeEventListener('click', blockNav, { capture: true });
  }
}

it('is accessible with no content set', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  await expect(el).to.be.accessible();
});

it('is accessible once populated, richly-formatted content has rendered', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  el.content = richSample;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
  await expect(el).to.be.accessible();
});

it('uses logical size containment and an internal overflow surface at a narrow allocation', async () => {
  const el = (await fixture(html`
    <lr-markdown
      style="inline-size: 320px; max-inline-size: 100%;"
      .content=${'| Very long heading | Another very long heading |\n| --- | --- |\n| alpha | beta |\n\n```\n' +
      'const unbroken = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";\n```'}
    ></lr-markdown>
  `)) as LyraMarkdown;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
  const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;

  expect(getComputedStyle(el).minInlineSize).to.equal('0px');
  expect(getComputedStyle(el).maxInlineSize).to.equal('100%');
  expect(getComputedStyle(content).minInlineSize).to.equal('0px');
  expect(getComputedStyle(content).maxInlineSize).to.equal('100%');
  expect(getComputedStyle(content).overflowInline).to.equal('auto');
});

it('parses GFM tables, code blocks, links, headings, and blockquotes with part attributes injected, sanitized by default', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  let fired = false;
  el.addEventListener('lr-render-error', () => (fired = true));
  el.content = richSample;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);

  expect(fired, 'no lr-render-error should fire on a clean render').to.be.false;
  expect(el.shadowRoot!.querySelector('[part="heading"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="code-block"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="link"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="blockquote"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="table"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="content"]')!.hasAttribute('data-fallback')).to.be.false;
});

it('does not recognize a GFM table when gfm is disabled', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  el.gfm = false;
  el.content = '| a | b |\n| --- | --- |\n| 1 | 2 |\n';
  await el.updateComplete;
  await waitUntil(() => (el as unknown as { renderedHtml: string | null }).renderedHtml !== null);
  expect(el.shadowRoot!.querySelector('[part="table"]')).to.not.exist;
});

it('strips inline event-handler attributes from raw HTML passthrough when sanitize is true (the default)', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  el.content = 'hi <img alt="test" onerror="window.__lyraMarkdownXss = true">';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('img') !== null);

  const img = el.shadowRoot!.querySelector('img')!;
  expect(img.getAttribute('onerror')).to.equal(null);
  expect((window as unknown as { __lyraMarkdownXss?: boolean }).__lyraMarkdownXss).to.equal(undefined);
});

it('renders unsanitized raw HTML when sanitize is explicitly false', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  el.sanitize = false;
  el.content = 'hi <img alt="test" onerror="window.__lyraMarkdownXssOptOut = true">';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('img') !== null);

  const img = el.shadowRoot!.querySelector('img')!;
  expect(img.getAttribute('onerror')).to.equal('window.__lyraMarkdownXssOptOut = true');
});

it('renders embedded raw HTML as visible escaped text when escapeHtml is set, instead of real elements', async () => {
  const el = (await fixture(html`<lr-markdown escape-html></lr-markdown>`)) as LyraMarkdown;
  el.content = 'hi <img alt="test" onerror="window.__lyraMarkdownEscapeTest = true">';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent).to.include('<img alt="test" onerror="window.__lyraMarkdownEscapeTest = true">');
  expect((window as unknown as { __lyraMarkdownEscapeTest?: boolean }).__lyraMarkdownEscapeTest).to.be.undefined;
});

it('defaults to false, preserving today\'s exact raw-HTML passthrough (sanitized) behavior', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  expect(el.escapeHtml).to.be.false;
  el.content = 'hi <em>there</em>';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('em') !== null);
  expect(el.shadowRoot!.querySelector('em')!.textContent).to.equal('there');
});

it('applies link-target and forces rel="noopener noreferrer" on every rendered link, surviving sanitization', async () => {
  const el = (await fixture(html`<lr-markdown link-target="_self"></lr-markdown>`)) as LyraMarkdown;
  el.content = '[docs](https://example.com/docs)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);

  const a = el.shadowRoot!.querySelector('a')!;
  expect(a.getAttribute('target')).to.equal('_self');
  expect(a.getAttribute('rel')).to.equal('noopener noreferrer');
  expect(a.getAttribute('part')).to.equal('link');
});

it('defaults link-target to "_blank"', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  expect(el.linkTarget).to.equal('_blank');
  el.content = '[docs](https://example.com/docs)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
  expect(el.shadowRoot!.querySelector('a')!.getAttribute('target')).to.equal('_blank');
});

it('intercepts a click on a link whose href matches internal-link-prefix and fires lr-link-click with the click prevented', async () => {
  const el = (await fixture(
    html`<lr-markdown internal-link-prefix="/docs/"></lr-markdown>`,
  )) as LyraMarkdown;
  el.content = '[setup](/docs/setup)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
  const a = el.shadowRoot!.querySelector('a')!;

  const listener = oneEvent(el, 'lr-link-click');
  withNavigationBlocked(() => a.click());
  const { detail } = await listener;
  expect(detail).to.deep.equal({ href: '/docs/setup', internal: true });
});

it('does not fire lr-link-click for an ordinary external link', async () => {
  const el = (await fixture(
    html`<lr-markdown internal-link-prefix="/docs/"></lr-markdown>`,
  )) as LyraMarkdown;
  el.content = '[site](https://example.com)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
  const a = el.shadowRoot!.querySelector('a')!;

  let fired = false;
  el.addEventListener('lr-link-click', () => (fired = true));
  withNavigationBlocked(() => a.click());
  // No event to await — give the (synchronous) click handler a turn, then assert it never fired.
  await el.updateComplete;
  expect(fired).to.be.false;
});

it('does not intercept any link when internal-link-prefix is unset', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
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

it('percent-encodes a link href that needs it, matching marked\'s own default renderer', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  el.content = '[t](café.md)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
  expect(el.shadowRoot!.querySelector('a')!.getAttribute('href')).to.equal('caf%C3%A9.md');
});

it('does not double-encode a link href that is already percent-encoded', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  el.content = '[t](a%20b.md)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
  expect(el.shadowRoot!.querySelector('a')!.getAttribute('href')).to.equal('a%20b.md');
});

it('drops the anchor and renders only the link text when the href is malformed (lone surrogate)', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  el.content = '[a](\uD800)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]')!.textContent!.trim().length > 0);
  expect(el.shadowRoot!.querySelector('a')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent).to.contain('a');
});

it('adds scope="col" to every rendered table header cell', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  el.content = richSample;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
  const ths = el.shadowRoot!.querySelectorAll('[part="table"] th');
  expect(ths.length).to.be.greaterThan(0);
  ths.forEach((th) => expect(th.getAttribute('scope')).to.equal('col'));
});

it('renders an <img> from source markdown with part="img"', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  el.content = '![alt text](https://example.com/pic.png)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('img') !== null);

  const img = el.shadowRoot!.querySelector('img')!;
  expect(img.getAttribute('part')).to.equal('img');
  expect(img.getAttribute('src')).to.equal('https://example.com/pic.png');
  expect(img.getAttribute('alt')).to.equal('alt text');
});

it('defaults heading-offset to 0, preserving today\'s exact <h${depth}> output', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  expect(el.headingOffset).to.equal(0);
  el.content = '# one\n\n## two\n';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
  const headings = el.shadowRoot!.querySelectorAll('[part="heading"]');
  expect(headings[0].tagName).to.equal('H1');
  expect(headings[1].tagName).to.equal('H2');
});

it('shifts every rendered heading by heading-offset, clamped at h6', async () => {
  const el = (await fixture(html`<lr-markdown heading-offset="2"></lr-markdown>`)) as LyraMarkdown;
  el.content = '# one\n\n## two\n\n###### deep\n';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
  const headings = el.shadowRoot!.querySelectorAll('[part="heading"]');
  expect(headings[0].tagName).to.equal('H3');
  expect(headings[1].tagName).to.equal('H4');
  expect(headings[2].tagName, 'a source h6 clamps at h6 rather than overflowing').to.equal('H6');
});

it('normalizes a NaN heading-offset to 0 instead of producing an invalid <hNaN> tag', async () => {
  const el = (await fixture(html`<lr-markdown heading-offset="not-a-number"></lr-markdown>`)) as LyraMarkdown;
  expect(Number.isNaN(el.headingOffset)).to.be.true;
  el.content = '# one\n\n## two\n';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
  const headings = el.shadowRoot!.querySelectorAll('[part="heading"]');
  expect(headings[0].tagName).to.equal('H1');
  expect(headings[1].tagName).to.equal('H2');
});

it('omits target/rel on rendered links when link-target is explicitly disabled', async () => {
  const el = (await fixture(html`<lr-markdown link-target=""></lr-markdown>`)) as LyraMarkdown;
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
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  el.linkTarget = null;
  el.content = '[docs](https://example.com/docs)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);

  const a = el.shadowRoot!.querySelector('a')!;
  expect(a.getAttribute('target')).to.equal(null);
  expect(a.getAttribute('rel')).to.equal(null);
});

it('renders target="_blank" rel="noopener noreferrer" by default, unchanged from today', async () => {
  const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
  el.content = '[docs](https://example.com/docs)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);

  const a = el.shadowRoot!.querySelector('a')!;
  expect(a.getAttribute('target')).to.equal('_blank');
  expect(a.getAttribute('rel')).to.equal('noopener noreferrer');
});

it('eager-load synchronously adopts the already-warm marked/dompurify cache, skipping the async import() hop', async () => {
  // Prime the module-level cache `markdown-loader.ts` shares across every
  // <lr-markdown> instance -- by the time this resolves,
  // getMarkdownDepsIfLoaded() (what eager-load relies on) returns synchronously.
  await loadMarkdownDeps();

  // fixtureSync() (unlike fixture()) does not await updateComplete -- it only
  // connects the element and returns, so this checks state immediately after
  // connectedCallback() with zero microtasks having had a chance to run yet,
  // proving eager-load skipped the async hop rather than merely "winning a race"
  // against it.
  const el = fixtureSync(html`<lr-markdown eager-load content="# hi"></lr-markdown>`) as LyraMarkdown;
  type Internals = { deps?: unknown; renderedHtml: string | null };
  const internals = el as unknown as Internals;
  expect(internals.deps, 'deps must already be set synchronously, before any microtask has run').to.exist;
  expect(internals.renderedHtml, 'renderMarkdown() must already have run synchronously').to.not.equal(null);

  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part="content"]')!.hasAttribute('data-fallback')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('hi');
});

it('without eager-load, deps stay unset synchronously even with an already-warm cache -- the async hop still applies by default', async () => {
  await loadMarkdownDeps();

  const el = fixtureSync(html`<lr-markdown content="# hi"></lr-markdown>`) as LyraMarkdown;
  type Internals = { deps?: unknown };
  expect(
    (el as unknown as Internals).deps,
    'the default (non-eager) path always defers to the async .then(), even with a warm cache',
  ).to.equal(undefined);

  await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
  expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('hi');
});

it('does not set deps or render when the element disconnects before loadMarkdownDeps() resolves', async () => {
  const el = document.createElement('lr-markdown') as LyraMarkdown;
  el.content = '# hi';
  document.body.appendChild(el);
  // Disconnect in the same synchronous tick as connect, before the
  // (module-cached) loadMarkdownDeps() promise's .then() callback -- always
  // deferred to a microtask, even when the promise is already resolved from
  // an earlier test -- has a chance to run.
  el.remove();
  await aTimeout(50);

  type Internals = { deps?: unknown; renderedHtml: string | null };
  const internals = el as unknown as Internals;
  expect(internals.deps, 'deps must not be set on a disconnected instance').to.equal(undefined);
  expect(internals.renderedHtml).to.equal(null);
});

it('reflects streaming and keeps the host busy through incremental renders until the stream completes', async () => {
  const el = (await fixture(html`<lr-markdown content="First chunk"></lr-markdown>`)) as LyraMarkdown;
  await waitUntil(() => !el.hasAttribute('aria-busy'));
  expect(el.hasAttribute('streaming')).to.be.false;

  el.streaming = true;
  await el.updateComplete;
  expect(el.hasAttribute('streaming')).to.be.true;
  expect(el.getAttribute('aria-busy')).to.equal('true');

  el.content = 'First chunk\n\nSecond chunk';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelectorAll('[part="paragraph"]').length === 2);
  expect(el.getAttribute('aria-busy')).to.equal('true');

  el.streaming = false;
  await el.updateComplete;
  expect(el.hasAttribute('streaming')).to.be.false;
  expect(el.hasAttribute('aria-busy')).to.be.false;
});

it('coalesces rapid streaming content updates to one parse per animation frame', async () => {
  const el = (await fixture(html`<lr-markdown content="Initial"></lr-markdown>`)) as LyraMarkdown;
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

describe('fallback matrix', () => {
  it('falls back to plain text and fires lr-render-error when the marked peer is unavailable', async () => {
    const el = (await fixture(html`<lr-markdown content="# hi"></lr-markdown>`)) as LyraMarkdown;
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
    const el = (await fixture(html`<lr-markdown content="**bold**"></lr-markdown>`)) as LyraMarkdown;
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
    const el = (await fixture(html`<lr-markdown content="**bold**"></lr-markdown>`)) as LyraMarkdown;
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
    const el = (await fixture(html`<lr-markdown content="whatever"></lr-markdown>`)) as LyraMarkdown;
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

describe('paragraph/list/inline-code parts', () => {
  it('adds part="paragraph" to rendered <p>', async () => {
    const el = (await fixture(html`<lr-markdown content="Hello world"></lr-markdown>`)) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]'), 'never rendered', { timeout: 4000 });
    expect(el.shadowRoot!.querySelector('[part="paragraph"]')!.textContent).to.equal('Hello world');
  });

  it('adds part="list" to a rendered <ul> and <ol>', async () => {
    const el = (await fixture(html`<lr-markdown content=${'- a\n- b'}></lr-markdown>`)) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="list"]'), 'never rendered', { timeout: 4000 });
    expect(el.shadowRoot!.querySelector('[part="list"]')!.tagName).to.equal('UL');

    el.content = '1. a\n2. b';
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="list"]')?.tagName === 'OL', 'never rendered', { timeout: 4000 });
  });

  it('adds part="inline-code" to a bare inline codespan, but not to a fenced code block\'s <code>', async () => {
    const el = (await fixture(html`<lr-markdown content=${'some `inline` and:\n\n```\nfenced\n```'}></lr-markdown>`)) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="inline-code"]'), 'never rendered', { timeout: 4000 });
    expect(el.shadowRoot!.querySelector('[part="inline-code"]')!.textContent).to.equal('inline');
    const fencedCode = el.shadowRoot!.querySelector('[part="code-block"] code')!;
    expect(fencedCode.hasAttribute('part')).to.be.false;
  });

  it('escapes HTML in an inline codespan the same way the default renderer would', async () => {
    const el = (await fixture(html`<lr-markdown content=${'`<script>`'}></lr-markdown>`)) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="inline-code"]'), 'never rendered', { timeout: 4000 });
    expect(el.shadowRoot!.querySelector('[part="inline-code"]')!.textContent).to.equal('<script>');
    expect(el.shadowRoot!.querySelector('script')).to.not.exist;
  });
});

describe('highlightCode cache plumbing (no async loading yet)', () => {
  type Internals = {
    highlightCache: Map<string, string>;
  };
  function internalsOf(el: LyraMarkdown): Internals {
    return el as unknown as Internals;
  }

  it('defaults highlightCode to true, languages to undefined, languagesOnly to false', async () => {
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    expect(el.highlightCode).to.be.true;
    expect(el.languages).to.equal(undefined);
    expect(el.languagesOnly).to.be.false;
  });

  it('renders a fenced code block plain (no cache entry yet) even with highlightCode true (unchanged default)', async () => {
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    el.content = '```ts\nconst x = 1;\n```';
    await el.updateComplete;
    const pre = el.shadowRoot!.querySelector('[part="code-block"]') as HTMLElement;
    expect(pre).to.exist;
    expect(pre.querySelector('span')).to.not.exist; // no shiki spans -- still plain
    expect(pre.querySelector('code')!.className).to.equal('language-ts');
    expect(pre.querySelector('code')!.textContent).to.equal('const x = 1;\n');
  });

  it('uses a pre-populated cache entry on render, keyed by lang+code', async () => {
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    internalsOf(el).highlightCache.set('ts\nconst x = 1;\n', '<pre part="code-block"><code class="language-ts"><span>FAKE HIGHLIGHTED</span></code></pre>\n');
    el.content = '```ts\nconst x = 1;\n```';
    await el.updateComplete;
    const pre = el.shadowRoot!.querySelector('[part="code-block"]') as HTMLElement;
    expect(pre.querySelector('span')!.textContent).to.equal('FAKE HIGHLIGHTED');
  });

  it('never consults or benefits from the cache when highlightCode is false, even if pre-populated', async () => {
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    el.highlightCode = false;
    internalsOf(el).highlightCache.set('ts\nconst x = 1;\n', '<pre part="code-block"><code class="language-ts"><span>FAKE HIGHLIGHTED</span></code></pre>\n');
    el.content = '```ts\nconst x = 1;\n```';
    await el.updateComplete;
    const pre = el.shadowRoot!.querySelector('[part="code-block"]') as HTMLElement;
    expect(pre.querySelector('span')).to.not.exist;
  });

  it('never consults the cache while streaming is true, even if pre-populated', async () => {
    const el = (await fixture(html`<lr-markdown streaming></lr-markdown>`)) as LyraMarkdown;
    internalsOf(el).highlightCache.set('ts\nconst x = 1;\n', '<pre part="code-block"><code class="language-ts"><span>FAKE HIGHLIGHTED</span></code></pre>\n');
    el.content = '```ts\nconst x = 1;\n```';
    await el.updateComplete;
    const pre = el.shadowRoot!.querySelector('[part="code-block"]') as HTMLElement;
    expect(pre.querySelector('span')).to.not.exist;
  });

  it('skips the cache for a fenced block with no language tag, even with highlightCode true', async () => {
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    el.content = '```\nplain text\n```';
    await el.updateComplete;
    const pre = el.shadowRoot!.querySelector('[part="code-block"]') as HTMLElement;
    expect(pre.querySelector('code')!.className).to.equal('');
    expect(pre.querySelector('code')!.textContent).to.equal('plain text\n');
  });
});

describe('shiki highlighting (real peer)', () => {
  it('renders plain on first paint, then upgrades to highlighted output once shiki resolves', async function () {
    // This is the first real (unmocked) shiki cold load in this file -- the full `shiki` package
    // import plus its typescript grammar. Mirrors code-block.test.ts's own first real-peer test,
    // which documents the same 8-way default @web/test-runner concurrency + WASM+grammar load
    // occasionally exceeding mocha's global 6000ms default under load; bumping this one test's own
    // budget (rather than the shared config) keeps every later test in this describe fast, since
    // `loadShikiHighlighter()`'s module-level singleton is warm for the rest of the suite afterward.
    this.timeout(20_000);
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    el.content = '```ts\nconst x = 1;\n```';
    await el.updateComplete;
    const preBefore = el.shadowRoot!.querySelector('[part="code-block"]') as HTMLElement;
    expect(preBefore.querySelector('span')).to.not.exist;

    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="code-block"] span') !== null,
      'never highlighted',
      { timeout: 8000 },
    );
    const pre = el.shadowRoot!.querySelector('[part="code-block"]') as HTMLElement;
    expect(pre.getAttribute('part')).to.equal('code-block');
    expect(pre.querySelector('code')!.className).to.include('language-ts');
    // The highlighted code text (ignoring markup) still matches the source exactly.
    expect(pre.textContent).to.include('const x = 1;');
  });

  it('does not highlight while streaming is true, and highlights once streaming flips to false', async () => {
    const el = (await fixture(html`<lr-markdown streaming></lr-markdown>`)) as LyraMarkdown;
    el.content = '```ts\nconst x = 1;\n```';
    await el.updateComplete;
    await aTimeout(300); // long enough that a wrongly-kicked-off highlight would have resolved
    expect(el.shadowRoot!.querySelector('[part="code-block"] span')).to.not.exist;

    el.streaming = false;
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="code-block"] span') !== null,
      'never highlighted after streaming ended',
      { timeout: 8000 },
    );
  });

  it('highlights two distinct fenced blocks in the same document, each with its own language', async () => {
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    el.content = '```ts\nconst x = 1;\n```\n\n```python\nx = 1\n```';
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelectorAll('[part="code-block"] span').length > 0,
      'never highlighted',
      { timeout: 8000 },
    );
    const blocks = [...el.shadowRoot!.querySelectorAll('[part="code-block"]')] as HTMLElement[];
    expect(blocks.length).to.equal(2);
    expect(blocks[0].querySelector('code')!.className).to.include('language-ts');
    expect(blocks[1].querySelector('code')!.className).to.include('language-python');
  });

  it('does not block or delay a valid language when another fenced block has an unrecognized one', async () => {
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    el.content = '```ts\nconst x = 1;\n```\n\n```not-a-real-language-xyz\nhello\n```';
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="code-block"] span') !== null,
      'the valid-language block never highlighted',
      { timeout: 8000 },
    );
    const blocks = [...el.shadowRoot!.querySelectorAll('[part="code-block"]')] as HTMLElement[];
    expect(blocks[0].querySelector('span')).to.exist; // ts: highlighted
    expect(blocks[1].querySelector('span')).to.not.exist; // unrecognized: stays plain
    expect(blocks[1].querySelector('code')!.textContent).to.equal('hello\n');
  });

  it('discards a stale in-flight highlight superseded by a newer content change (highlightToken guard)', async () => {
    type Internals = { highlightToken: number };
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    el.content = '```ts\nconst x = 1;\n```';
    await el.updateComplete;
    const tokenAfterFirst = (el as unknown as Internals).highlightToken;
    el.content = '```ts\nconst x = 2;\n```';
    await el.updateComplete;
    expect((el as unknown as Internals).highlightToken).to.be.greaterThan(tokenAfterFirst);

    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="code-block"] span') !== null,
      'never highlighted',
      { timeout: 8000 },
    );
    // The final, current content is what ends up highlighted -- not the superseded first value.
    expect(el.shadowRoot!.querySelector('[part="code-block"]')!.textContent).to.include('const x = 2;');
  });

  it('does not highlight when highlightCode is false, even after waiting', async () => {
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    el.highlightCode = false;
    el.content = '```ts\nconst x = 1;\n```';
    await el.updateComplete;
    await aTimeout(500);
    expect(el.shadowRoot!.querySelector('[part="code-block"] span')).to.not.exist;
  });

  it('is accessible once a fenced code block has been highlighted', async () => {
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    el.content = '```ts\nconst x = 1;\n```';
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="code-block"] span') !== null,
      'never highlighted',
      { timeout: 8000 },
    );
    await expect(el).to.be.accessible();
  });
});

describe('languages (fine-grained shiki opt-in) — markdown', () => {
  it('highlights a language covered by `languages` via the fine-grained core highlighter', async function () {
    // A distinct cold load from the describe above -- shiki/core + the oniguruma WASM engine,
    // never warmed by loadShikiHighlighter()'s own singleton. Same rationale as that describe's
    // this.timeout(20_000) override.
    this.timeout(20_000);
    const bashLang = await import('shiki/langs/bash.mjs').catch(() => null);
    if (!bashLang) return; // shiki not installed in this environment -- covered elsewhere
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    el.languages = { bash: bashLang.default };
    el.content = '```bash\necho hi\n```';
    await el.updateComplete;
    await waitUntil(
      () => el.shadowRoot!.querySelector('[part="code-block"] span') !== null,
      'never highlighted via languages',
      { timeout: 8000 },
    );
    expect(el.shadowRoot!.querySelector('[part="code-block"] code')!.className).to.include('language-bash');
  });

  it('languagesOnly leaves an uncovered language plain instead of falling back to the full bundle', async () => {
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    el.languages = {};
    el.languagesOnly = true;
    el.content = '```ts\nconst x = 1;\n```';
    await el.updateComplete;
    await aTimeout(500);
    expect(el.shadowRoot!.querySelector('[part="code-block"] span')).to.not.exist;
  });
});

describe('getHeadingTree / heading-anchors', () => {
  it('computes the heading tree even when heading-anchors is off', async () => {
    const el = (await fixture(
      html`<lr-markdown content=${'# Title\n\n## Section One\n\n## Section One'}></lr-markdown>`,
    )) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    const expected: MarkdownHeadingItem[] = [
      { id: 'title', label: 'Title', level: 1 },
      { id: 'section-one', label: 'Section One', level: 2 },
      { id: 'section-one-1', label: 'Section One', level: 2 },
    ];
    expect(el.getHeadingTree()).to.deep.equal(expected);
    expect(el.shadowRoot!.querySelector('h1')!.hasAttribute('id')).to.be.false;
  });

  it('stamps id attributes only when heading-anchors is on', async () => {
    // "Getting Started" (not "Title") deliberately -- DOMPurify's default DOM-clobbering guard
    // (SANITIZE_DOM) strips an id/name attribute whose *value* collides with a real `document`
    // property name (e.g. slug "title" collides with `document.title`), so a heading literally
    // titled "Title" would have its id silently stripped by sanitize=true (the default) -- see the
    // headingAnchors property doc for this same interaction spelled out for consumers.
    const el = (await fixture(
      html`<lr-markdown heading-anchors content=${'# Getting Started'}></lr-markdown>`,
    )) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    expect(el.shadowRoot!.querySelector('h1')!.getAttribute('id')).to.equal('getting-started');
  });

  it('a slug colliding with a real `document` property name (e.g. "title") loses its id under sanitize=true, the default -- DOMPurify DOM-clobbering protection', async () => {
    const el = (await fixture(
      html`<lr-markdown heading-anchors content=${'# Title'}></lr-markdown>`,
    )) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    expect(el.getHeadingTree()).to.deep.equal([{ id: 'title', label: 'Title', level: 1 }]);
    expect(el.shadowRoot!.querySelector('h1')!.hasAttribute('id')).to.be.false;
  });

  it('reflects heading-offset in the tree level, matching the rendered tag', async () => {
    const el = (await fixture(
      html`<lr-markdown heading-offset="2" content=${'# Title'}></lr-markdown>`,
    )) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    expect(el.getHeadingTree()).to.deep.equal([{ id: 'title', label: 'Title', level: 3 }]);
    expect(el.shadowRoot!.querySelector('h3')).to.exist;
  });

  it('strips inline markup from the slug/label via the plain-text renderer', async () => {
    const el = (await fixture(
      html`<lr-markdown content=${'# Hello **World**'}></lr-markdown>`,
    )) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    expect(el.getHeadingTree()).to.deep.equal([{ id: 'hello-world', label: 'Hello World', level: 1 }]);
  });

  it('getHeadingTree() returns a fresh array each call -- mutating the result cannot corrupt internal state', async () => {
    const el = (await fixture(html`<lr-markdown content=${'# Title'}></lr-markdown>`)) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    const tree = el.getHeadingTree();
    tree.push({ id: 'injected', label: 'Injected', level: 1 });
    expect(el.getHeadingTree()).to.have.length(1);
  });
});

describe('scrollToAnchor (fragment)', () => {
  it('scrolls to a heading by id even with heading-anchors off', async () => {
    const el = (await fixture(
      html`<lr-markdown content=${'# Title\n\nBody text.\n\n## Section One'}></lr-markdown>`,
    )) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    let scrolled = false;
    const heading = el.shadowRoot!.querySelector('h2') as HTMLElement;
    heading.scrollIntoView = () => {
      scrolled = true;
    };
    const result = await el.scrollToAnchor({ kind: 'fragment', id: 'section-one' });
    expect(result).to.be.true;
    expect(scrolled).to.be.true;
  });

  it('resolves false for an unknown fragment id', async () => {
    const el = (await fixture(html`<lr-markdown content=${'# Title'}></lr-markdown>`)) as LyraMarkdown;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    expect(await el.scrollToAnchor({ kind: 'fragment', id: 'does-not-exist' })).to.be.false;
  });

  it('reports its supported anchor kinds', async () => {
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    expect(el.anchorKinds).to.deep.equal(['fragment', 'text-quote']);
  });

  it('resolves a fragment anchor via position even when DOMPurify stripped its id (a document-property-colliding slug)', async () => {
    const el = (await fixture(
      html`<lr-markdown heading-anchors content=${'# Title'}></lr-markdown>`,
    )) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    expect(el.shadowRoot!.querySelector('h1')!.hasAttribute('id'), 'precondition: DOMPurify stripped it').to.be.false;
    let scrolled = false;
    (el.shadowRoot!.querySelector('h1') as HTMLElement).scrollIntoView = () => {
      scrolled = true;
    };
    expect(await el.scrollToAnchor({ kind: 'fragment', id: 'title' })).to.be.true;
    expect(scrolled).to.be.true;
  });
});

describe('scrollToAnchor / highlights (text-quote)', () => {
  it('scrolls to a text-quote anchor', async () => {
    const el = (await fixture(
      html`<lr-markdown content=${'The quick brown fox jumps over the lazy dog.'}></lr-markdown>`,
    )) as LyraMarkdown;
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
    const el = (await fixture(html`<lr-markdown content=${'Hello world'}></lr-markdown>`)) as LyraMarkdown;
    (el as unknown as { anchorTimeoutMs: number }).anchorTimeoutMs = 30;
    (el as unknown as { anchorRetryIntervalMs: number }).anchorRetryIntervalMs = 5;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    expect(await el.scrollToAnchor({ kind: 'text-quote', quote: 'nothing to see here' })).to.be.false;
  });

  it('paints a text-quote highlight (CSS Custom Highlight API, or a <mark> fallback)', async () => {
    const el = (await fixture(
      html`<lr-markdown content=${'The quick brown fox jumps over the lazy dog.'}></lr-markdown>`,
    )) as LyraMarkdown;
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

  it('paints with a non-default tone', async () => {
    const el = (await fixture(
      html`<lr-markdown content=${'The quick brown fox jumps over the lazy dog.'}></lr-markdown>`,
    )) as LyraMarkdown;
    el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'brown fox' }, tone: 'warning' }];
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    await el.updateComplete;
    expect(highlightPainted(el, 'warning')).to.be.true;
    expect(highlightPainted(el, 'accent')).to.be.false;
  });

  it('survives a streaming content re-render (resolution by quote, not node identity)', async () => {
    const el = (await fixture(html`<lr-markdown content=${'The quick '}></lr-markdown>`)) as LyraMarkdown;
    el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'brown fox' } }];
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    await el.updateComplete;
    expect(highlightPainted(el)).to.be.false;

    el.content = 'The quick brown fox jumps.';
    await el.updateComplete;
    expect(highlightPainted(el)).to.be.true;
  });

  it('clears a previously-painted highlight once highlights is set back to empty', async () => {
    const el = (await fixture(
      html`<lr-markdown content=${'The quick brown fox jumps over the lazy dog.'}></lr-markdown>`,
    )) as LyraMarkdown;
    el.highlights = [{ id: 'h1', anchor: { kind: 'text-quote', quote: 'brown fox' } }];
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]') !== null);
    await el.updateComplete;
    expect(highlightPainted(el)).to.be.true;

    el.highlights = [];
    await el.updateComplete;
    expect(highlightPainted(el)).to.be.false;
  });

  it('emits lr-highlight-activate when a painted highlight is clicked', async () => {
    const el = (await fixture(html`<lr-markdown content=${'Hello world'}></lr-markdown>`)) as LyraMarkdown;
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
      html`<lr-markdown internal-link-prefix="/docs/" content=${'Hello [world](/docs/world) and highlighted brown fox'}></lr-markdown>`,
    )) as LyraMarkdown;
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

  it('emits lr-text-select with a text-quote anchor on selection', async () => {
    const el = (await fixture(
      html`<lr-markdown content=${'The quick brown fox jumps over the lazy dog.'}></lr-markdown>`,
    )) as LyraMarkdown;
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
});

describe('math (KaTeX)', () => {
  afterEach(() => __setKatexForTesting(undefined));

  it('renders raw delimited source and fires lr-render-error when katex is confirmed missing', async () => {
    __setKatexForTesting(null);
    // fixtureSync() (not fixture()) so the `oneEvent()` listener attaches before the
    // connectedCallback()-kicked-off async deps-loading microtask has any chance to run and fire
    // the event first -- the same oneEvent()-vs-synchronous-dispatch race AGENTS.md's testing
    // section warns about, one microtask hop removed.
    const el = fixtureSync(html`<lr-markdown math content=${'Energy: $E=mc^2$'}></lr-markdown>`) as LyraMarkdown;
    const listener = oneEvent(el, 'lr-render-error');
    const event = (await listener) as CustomEvent<{ error: unknown }>;
    expect(event.detail.error).to.exist;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent).to.contain('$E=mc^2$');
  });

  it('fires lr-render-error only once even after further re-renders', async () => {
    __setKatexForTesting(null);
    const el = fixtureSync(html`<lr-markdown math content=${'$a$'}></lr-markdown>`) as LyraMarkdown;
    await oneEvent(el, 'lr-render-error');
    let firedAgain = false;
    el.addEventListener('lr-render-error', () => (firedAgain = true));
    el.content = '$b$';
    await el.updateComplete;
    expect(firedAgain).to.be.false;
  });

  it('renders inline math as MathML via katex.renderToString when the peer is installed', async () => {
    const fakeKatex = {
      renderToString: (tex: string) =>
        `<math><semantics><mrow><mi>${tex}</mi></mrow><annotation encoding="application/x-tex">${tex}</annotation></semantics></math>`,
    };
    __setKatexForTesting(fakeKatex as never);
    const el = (await fixture(html`<lr-markdown math content=${'$x$'}></lr-markdown>`)) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="math"]') !== null);
    expect(el.shadowRoot!.querySelector('[part="math"]')!.getAttribute('data-display')).to.equal('inline');
    expect(el.shadowRoot!.querySelector('annotation')).to.exist;
  });

  it('renders block math with data-display="block"', async () => {
    const fakeKatex = { renderToString: (tex: string) => `<math><mi>${tex}</mi></math>` };
    __setKatexForTesting(fakeKatex as never);
    const el = (await fixture(html`<lr-markdown math content=${'$$x^2$$'}></lr-markdown>`)) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="math"]') !== null);
    expect(el.shadowRoot!.querySelector('[part="math"]')!.getAttribute('data-display')).to.equal('block');
  });

  it('leaves $ literal when math is off (default)', async () => {
    const el = (await fixture(html`<lr-markdown content=${'Cost: $5 not math'}></lr-markdown>`)) as LyraMarkdown;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent).to.contain('$5');
  });

  it('defaults math to false', async () => {
    const el = (await fixture(html`<lr-markdown></lr-markdown>`)) as LyraMarkdown;
    expect(el.math).to.be.false;
  });
});

describe('back-compat', () => {
  it('renders byte-identical output with heading-anchors, math, and highlights all unset', async () => {
    const el = (await fixture(html`<lr-markdown content=${'# Title\n\nBody.'}></lr-markdown>`)) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
    const withoutNewProps = el.shadowRoot!.querySelector('[part="content"]')!.innerHTML;

    const el2 = (await fixture(
      html`<lr-markdown
        content=${'# Title\n\nBody.'}
        .headingAnchors=${false}
        .math=${false}
        .highlights=${[]}
      ></lr-markdown>`,
    )) as LyraMarkdown;
    await waitUntil(() => el2.shadowRoot!.querySelector('[part="heading"]') !== null);
    expect(el2.shadowRoot!.querySelector('[part="content"]')!.innerHTML).to.equal(withoutNewProps);
  });
});
