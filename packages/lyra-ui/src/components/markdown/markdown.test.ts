import { fixture, fixtureSync, expect, html, waitUntil, oneEvent, aTimeout } from '@open-wc/testing';
import './markdown.js';
import type { LyraMarkdown } from './markdown.js';
import { loadMarkdownDeps } from './markdown-loader.js';

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
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  await expect(el).to.be.accessible();
});

it('is accessible once populated, richly-formatted content has rendered', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  el.content = richSample;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
  await expect(el).to.be.accessible();
});

it('parses GFM tables, code blocks, links, headings, and blockquotes with part attributes injected, sanitized by default', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  let fired = false;
  el.addEventListener('lyra-render-error', () => (fired = true));
  el.content = richSample;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);

  expect(fired, 'no lyra-render-error should fire on a clean render').to.be.false;
  expect(el.shadowRoot!.querySelector('[part="heading"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="code-block"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="link"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="blockquote"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="table"]')).to.exist;
  expect(el.shadowRoot!.querySelector('[part="content"]')!.hasAttribute('data-fallback')).to.be.false;
});

it('does not recognize a GFM table when gfm is disabled', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  el.gfm = false;
  el.content = '| a | b |\n| --- | --- |\n| 1 | 2 |\n';
  await el.updateComplete;
  await waitUntil(() => (el as unknown as { renderedHtml: string | null }).renderedHtml !== null);
  expect(el.shadowRoot!.querySelector('[part="table"]')).to.not.exist;
});

it('strips inline event-handler attributes from raw HTML passthrough when sanitize is true (the default)', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  el.content = 'hi <img src="x" onerror="window.__lyraMarkdownXss = true">';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('img') !== null);

  const img = el.shadowRoot!.querySelector('img')!;
  expect(img.getAttribute('onerror')).to.equal(null);
  expect((window as unknown as { __lyraMarkdownXss?: boolean }).__lyraMarkdownXss).to.equal(undefined);
});

it('renders unsanitized raw HTML when sanitize is explicitly false', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  el.sanitize = false;
  el.content = 'hi <img src="x" onerror="window.__lyraMarkdownXssOptOut = true">';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('img') !== null);

  const img = el.shadowRoot!.querySelector('img')!;
  expect(img.getAttribute('onerror')).to.equal('window.__lyraMarkdownXssOptOut = true');
});

it('renders embedded raw HTML as visible escaped text when escapeHtml is set, instead of real elements', async () => {
  const el = (await fixture(html`<lyra-markdown escape-html></lyra-markdown>`)) as LyraMarkdown;
  el.content = 'hi <img src="x" onerror="window.__lyraMarkdownEscapeTest = true">';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]') !== null);
  expect(el.shadowRoot!.querySelector('img')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent).to.include('<img src="x" onerror="window.__lyraMarkdownEscapeTest = true">');
  expect((window as unknown as { __lyraMarkdownEscapeTest?: boolean }).__lyraMarkdownEscapeTest).to.be.undefined;
});

it('defaults to false, preserving today\'s exact raw-HTML passthrough (sanitized) behavior', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  expect(el.escapeHtml).to.be.false;
  el.content = 'hi <em>there</em>';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('em') !== null);
  expect(el.shadowRoot!.querySelector('em')!.textContent).to.equal('there');
});

it('applies link-target and forces rel="noopener noreferrer" on every rendered link, surviving sanitization', async () => {
  const el = (await fixture(html`<lyra-markdown link-target="_self"></lyra-markdown>`)) as LyraMarkdown;
  el.content = '[docs](https://example.com/docs)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);

  const a = el.shadowRoot!.querySelector('a')!;
  expect(a.getAttribute('target')).to.equal('_self');
  expect(a.getAttribute('rel')).to.equal('noopener noreferrer');
  expect(a.getAttribute('part')).to.equal('link');
});

it('defaults link-target to "_blank"', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  expect(el.linkTarget).to.equal('_blank');
  el.content = '[docs](https://example.com/docs)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
  expect(el.shadowRoot!.querySelector('a')!.getAttribute('target')).to.equal('_blank');
});

it('intercepts a click on a link whose href matches internal-link-prefix and fires lyra-link-click with the click prevented', async () => {
  const el = (await fixture(
    html`<lyra-markdown internal-link-prefix="/docs/"></lyra-markdown>`,
  )) as LyraMarkdown;
  el.content = '[setup](/docs/setup)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
  const a = el.shadowRoot!.querySelector('a')!;

  const listener = oneEvent(el, 'lyra-link-click');
  withNavigationBlocked(() => a.click());
  const { detail } = await listener;
  expect(detail).to.deep.equal({ href: '/docs/setup', internal: true });
});

it('does not fire lyra-link-click for an ordinary external link', async () => {
  const el = (await fixture(
    html`<lyra-markdown internal-link-prefix="/docs/"></lyra-markdown>`,
  )) as LyraMarkdown;
  el.content = '[site](https://example.com)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
  const a = el.shadowRoot!.querySelector('a')!;

  let fired = false;
  el.addEventListener('lyra-link-click', () => (fired = true));
  withNavigationBlocked(() => a.click());
  // No event to await — give the (synchronous) click handler a turn, then assert it never fired.
  await el.updateComplete;
  expect(fired).to.be.false;
});

it('does not intercept any link when internal-link-prefix is unset', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  el.content = '[setup](/docs/setup)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
  const a = el.shadowRoot!.querySelector('a')!;

  let fired = false;
  el.addEventListener('lyra-link-click', () => (fired = true));
  withNavigationBlocked(() => a.click());
  await el.updateComplete;
  expect(fired).to.be.false;
});

it('percent-encodes a link href that needs it, matching marked\'s own default renderer', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  el.content = '[t](café.md)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
  expect(el.shadowRoot!.querySelector('a')!.getAttribute('href')).to.equal('caf%C3%A9.md');
});

it('does not double-encode a link href that is already percent-encoded', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  el.content = '[t](a%20b.md)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);
  expect(el.shadowRoot!.querySelector('a')!.getAttribute('href')).to.equal('a%20b.md');
});

it('drops the anchor and renders only the link text when the href is malformed (lone surrogate)', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  el.content = '[a](\uD800)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="content"]')!.textContent!.trim().length > 0);
  expect(el.shadowRoot!.querySelector('a')).to.not.exist;
  expect(el.shadowRoot!.querySelector('[part="content"]')!.textContent).to.contain('a');
});

it('adds scope="col" to every rendered table header cell', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  el.content = richSample;
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="table"]') !== null);
  const ths = el.shadowRoot!.querySelectorAll('[part="table"] th');
  expect(ths.length).to.be.greaterThan(0);
  ths.forEach((th) => expect(th.getAttribute('scope')).to.equal('col'));
});

it('renders an <img> from source markdown with part="img"', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  el.content = '![alt text](https://example.com/pic.png)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('img') !== null);

  const img = el.shadowRoot!.querySelector('img')!;
  expect(img.getAttribute('part')).to.equal('img');
  expect(img.getAttribute('src')).to.equal('https://example.com/pic.png');
  expect(img.getAttribute('alt')).to.equal('alt text');
});

it('defaults heading-offset to 0, preserving today\'s exact <h${depth}> output', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  expect(el.headingOffset).to.equal(0);
  el.content = '# one\n\n## two\n';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
  const headings = el.shadowRoot!.querySelectorAll('[part="heading"]');
  expect(headings[0].tagName).to.equal('H1');
  expect(headings[1].tagName).to.equal('H2');
});

it('shifts every rendered heading by heading-offset, clamped at h6', async () => {
  const el = (await fixture(html`<lyra-markdown heading-offset="2"></lyra-markdown>`)) as LyraMarkdown;
  el.content = '# one\n\n## two\n\n###### deep\n';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
  const headings = el.shadowRoot!.querySelectorAll('[part="heading"]');
  expect(headings[0].tagName).to.equal('H3');
  expect(headings[1].tagName).to.equal('H4');
  expect(headings[2].tagName, 'a source h6 clamps at h6 rather than overflowing').to.equal('H6');
});

it('omits target/rel on rendered links when link-target is explicitly disabled', async () => {
  const el = (await fixture(html`<lyra-markdown link-target=""></lyra-markdown>`)) as LyraMarkdown;
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
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  el.linkTarget = null;
  el.content = '[docs](https://example.com/docs)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);

  const a = el.shadowRoot!.querySelector('a')!;
  expect(a.getAttribute('target')).to.equal(null);
  expect(a.getAttribute('rel')).to.equal(null);
});

it('renders target="_blank" rel="noopener noreferrer" by default, unchanged from today', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  el.content = '[docs](https://example.com/docs)';
  await el.updateComplete;
  await waitUntil(() => el.shadowRoot!.querySelector('a') !== null);

  const a = el.shadowRoot!.querySelector('a')!;
  expect(a.getAttribute('target')).to.equal('_blank');
  expect(a.getAttribute('rel')).to.equal('noopener noreferrer');
});

it('eager-load synchronously adopts the already-warm marked/dompurify cache, skipping the async import() hop', async () => {
  // Prime the module-level cache `markdown-loader.ts` shares across every
  // <lyra-markdown> instance -- by the time this resolves,
  // getMarkdownDepsIfLoaded() (what eager-load relies on) returns synchronously.
  await loadMarkdownDeps();

  // fixtureSync() (unlike fixture()) does not await updateComplete -- it only
  // connects the element and returns, so this checks state immediately after
  // connectedCallback() with zero microtasks having had a chance to run yet,
  // proving eager-load skipped the async hop rather than merely "winning a race"
  // against it.
  const el = fixtureSync(html`<lyra-markdown eager-load content="# hi"></lyra-markdown>`) as LyraMarkdown;
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

  const el = fixtureSync(html`<lyra-markdown content="# hi"></lyra-markdown>`) as LyraMarkdown;
  type Internals = { deps?: unknown };
  expect(
    (el as unknown as Internals).deps,
    'the default (non-eager) path always defers to the async .then(), even with a warm cache',
  ).to.equal(undefined);

  await waitUntil(() => el.shadowRoot!.querySelector('[part="heading"]') !== null);
  expect(el.shadowRoot!.querySelector('[part="heading"]')!.textContent).to.equal('hi');
});

it('does not set deps or render when the element disconnects before loadMarkdownDeps() resolves', async () => {
  const el = document.createElement('lyra-markdown') as LyraMarkdown;
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

it('reflects the streaming property as a boolean attribute with no rendering effect', async () => {
  const el = (await fixture(html`<lyra-markdown></lyra-markdown>`)) as LyraMarkdown;
  expect(el.hasAttribute('streaming')).to.be.false;
  el.streaming = true;
  await el.updateComplete;
  expect(el.hasAttribute('streaming')).to.be.true;
});

describe('fallback matrix', () => {
  it('falls back to plain text and fires lyra-render-error when the marked peer is unavailable', async () => {
    const el = (await fixture(html`<lyra-markdown content="# hi"></lyra-markdown>`)) as LyraMarkdown;
    type Internals = { deps?: { marked: unknown; DOMPurify: unknown }; renderMarkdown(): void };
    await waitUntil(() => (el as unknown as Internals).deps !== undefined);
    const internals = el as unknown as Internals;

    const listener = oneEvent(el, 'lyra-render-error');
    internals.deps = { marked: undefined, DOMPurify: internals.deps!.DOMPurify };
    internals.renderMarkdown();
    const { detail } = await listener;
    expect(detail.error).to.exist;

    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.hasAttribute('data-fallback')).to.be.true;
    expect(el.shadowRoot!.textContent).to.contain('# hi');
  });

  it('falls back and fires lyra-render-error when sanitize is true (default) but dompurify is unavailable, even though marked loaded fine', async () => {
    const el = (await fixture(html`<lyra-markdown content="**bold**"></lyra-markdown>`)) as LyraMarkdown;
    type Internals = { deps?: { marked: unknown; DOMPurify: unknown }; renderMarkdown(): void };
    await waitUntil(() => (el as unknown as Internals).deps !== undefined);
    const internals = el as unknown as Internals;
    expect(internals.deps!.marked, 'precondition: marked must have actually loaded').to.exist;

    const listener = oneEvent(el, 'lyra-render-error');
    internals.deps = { marked: internals.deps!.marked, DOMPurify: undefined };
    internals.renderMarkdown();
    const { detail } = await listener;
    expect(detail.error).to.exist;

    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.hasAttribute('data-fallback')).to.be.true;
  });

  it('renders unsanitized (no fallback, no event) when sanitize is explicitly false and dompurify is unavailable', async () => {
    const el = (await fixture(html`<lyra-markdown content="**bold**"></lyra-markdown>`)) as LyraMarkdown;
    el.sanitize = false;
    type Internals = { deps?: { marked: unknown; DOMPurify: unknown }; renderMarkdown(): void };
    await waitUntil(() => (el as unknown as Internals).deps !== undefined);
    const internals = el as unknown as Internals;

    let fired = false;
    el.addEventListener('lyra-render-error', () => (fired = true));
    internals.deps = { marked: internals.deps!.marked, DOMPurify: undefined };
    internals.renderMarkdown();
    await el.updateComplete;

    expect(fired).to.be.false;
    expect(el.shadowRoot!.querySelector('[part="content"]')!.hasAttribute('data-fallback')).to.be.false;
    expect(el.shadowRoot!.querySelector('strong')).to.exist;
  });

  it('falls back and fires lyra-render-error with the actual caught error when marked itself throws while parsing', async () => {
    const el = (await fixture(html`<lyra-markdown content="whatever"></lyra-markdown>`)) as LyraMarkdown;
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

    const listener = oneEvent(el, 'lyra-render-error');
    internals.renderMarkdown();
    const { detail } = await listener;
    expect(detail.error).to.equal(boom);
  });
});

describe('paragraph/list/inline-code parts', () => {
  it('adds part="paragraph" to rendered <p>', async () => {
    const el = (await fixture(html`<lyra-markdown content="Hello world"></lyra-markdown>`)) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="paragraph"]'), 'never rendered', { timeout: 4000 });
    expect(el.shadowRoot!.querySelector('[part="paragraph"]')!.textContent).to.equal('Hello world');
  });

  it('adds part="list" to a rendered <ul> and <ol>', async () => {
    const el = (await fixture(html`<lyra-markdown content=${'- a\n- b'}></lyra-markdown>`)) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="list"]'), 'never rendered', { timeout: 4000 });
    expect(el.shadowRoot!.querySelector('[part="list"]')!.tagName).to.equal('UL');

    el.content = '1. a\n2. b';
    await el.updateComplete;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="list"]')?.tagName === 'OL', 'never rendered', { timeout: 4000 });
  });

  it('adds part="inline-code" to a bare inline codespan, but not to a fenced code block\'s <code>', async () => {
    const el = (await fixture(html`<lyra-markdown content=${'some `inline` and:\n\n```\nfenced\n```'}></lyra-markdown>`)) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="inline-code"]'), 'never rendered', { timeout: 4000 });
    expect(el.shadowRoot!.querySelector('[part="inline-code"]')!.textContent).to.equal('inline');
    const fencedCode = el.shadowRoot!.querySelector('[part="code-block"] code')!;
    expect(fencedCode.hasAttribute('part')).to.be.false;
  });

  it('escapes HTML in an inline codespan the same way the default renderer would', async () => {
    const el = (await fixture(html`<lyra-markdown content=${'`<script>`'}></lyra-markdown>`)) as LyraMarkdown;
    await waitUntil(() => el.shadowRoot!.querySelector('[part="inline-code"]'), 'never rendered', { timeout: 4000 });
    expect(el.shadowRoot!.querySelector('[part="inline-code"]')!.textContent).to.equal('<script>');
    expect(el.shadowRoot!.querySelector('script')).to.not.exist;
  });
});
