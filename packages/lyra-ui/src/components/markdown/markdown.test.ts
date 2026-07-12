import { fixture, expect, html, waitUntil, oneEvent } from '@open-wc/testing';
import './markdown.js';
import type { LyraMarkdown } from './markdown.js';

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
