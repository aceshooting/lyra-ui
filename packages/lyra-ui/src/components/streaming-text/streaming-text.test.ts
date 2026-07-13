import { fixture, expect, html, aTimeout } from '@open-wc/testing';
import './streaming-text.js';
import '../markdown/markdown.js';
import { looksLikeMarkdown } from './streaming-text.js';
import type { LyraStreamingText } from './streaming-text.js';
import { styles } from './streaming-text.styles.js';

// `@sinonjs/fake-timers` doesn't work in this test environment (CJS-only,
// no shim configured) -- real timers with short, generously-margined
// thresholds are used instead, the same way lyra-stream-status's own
// timer-driven tests do.

type Internals = { displayedContent: string };

function plainText(el: LyraStreamingText): string {
  const span = el.shadowRoot!.querySelector('.plain');
  return span ? (span.textContent ?? '') : '';
}

it('defaults to empty content, streaming=false, coalesce-ms=50, and markdown=undefined (auto-detect)', async () => {
  const el = (await fixture(html`<lyra-streaming-text></lyra-streaming-text>`)) as LyraStreamingText;
  expect(el.content).to.equal('');
  expect(el.streaming).to.be.false;
  expect(el.coalesceMs).to.equal(50);
  expect(el.markdown).to.be.undefined;
});

it('reflects streaming as a boolean host attribute', async () => {
  const el = (await fixture(html`<lyra-streaming-text></lyra-streaming-text>`)) as LyraStreamingText;
  expect(el.hasAttribute('streaming')).to.be.false;

  el.streaming = true;
  await el.updateComplete;
  expect(el.hasAttribute('streaming')).to.be.true;

  el.streaming = false;
  await el.updateComplete;
  expect(el.hasAttribute('streaming')).to.be.false;
});

it('maps the coalesce-ms attribute onto the coalesceMs number property', async () => {
  const el = (await fixture(html`<lyra-streaming-text coalesce-ms="120"></lyra-streaming-text>`)) as LyraStreamingText;
  expect(el.coalesceMs).to.equal(120);
});

it('honors coalesceMs reassigned after mount for a subsequent burst, not just the initial attribute mapping', async () => {
  const el = (await fixture(
    html`<lyra-streaming-text coalesce-ms="5000"></lyra-streaming-text>`,
  )) as LyraStreamingText;
  expect(el.coalesceMs, 'precondition: mounted with the large window').to.equal(5000);

  // Shrink the window well below the original mount-time value before
  // starting a fresh burst -- if the reassignment didn't actually reach the
  // underlying coalescer, this burst would still be governed by the stale
  // 5000ms window and wouldn't flush within this test's real-time budget.
  el.coalesceMs = 50;
  await el.updateComplete;

  el.content = 'a';
  await el.updateComplete;
  el.content = 'ab';
  await el.updateComplete;
  el.content = 'abc';
  await el.updateComplete;

  await aTimeout(150);
  expect(
    plainText(el),
    'the burst should flush using the newly-assigned coalesceMs, not the original 5000ms window',
  ).to.equal('abc');
});

describe('markdown tri-state attribute parsing', () => {
  it('is undefined when the markdown attribute is entirely absent', async () => {
    const el = (await fixture(html`<lyra-streaming-text></lyra-streaming-text>`)) as LyraStreamingText;
    expect(el.markdown).to.be.undefined;
  });

  it('is true for a bare markdown attribute', async () => {
    const el = (await fixture(html`<lyra-streaming-text markdown></lyra-streaming-text>`)) as LyraStreamingText;
    expect(el.markdown).to.be.true;
  });

  it('is false only for markdown="false"', async () => {
    const el = (await fixture(html`<lyra-streaming-text markdown="false"></lyra-streaming-text>`)) as LyraStreamingText;
    expect(el.markdown).to.be.false;
  });
});

describe('coalescing', () => {
  it('flushes the element\'s initial content immediately, even with a huge coalesce-ms window', async () => {
    // coalesce-ms is set absurdly high on purpose: if the very first update
    // weren't force-flushed, this assertion would only ever pass after a
    // 5s real-timer wait -- proving the "no artificial startup delay" claim
    // in the class doc without actually waiting 5s.
    const el = (await fixture(
      html`<lyra-streaming-text coalesce-ms="5000" .content=${'hello'}></lyra-streaming-text>`,
    )) as LyraStreamingText;
    expect(plainText(el)).to.equal('hello');
  });

  it('coalesces a rapid burst of subsequent content changes across several render passes, keeping only the latest', async () => {
    const el = (await fixture(html`<lyra-streaming-text coalesce-ms="150"></lyra-streaming-text>`)) as LyraStreamingText;
    expect(plainText(el), 'the initial empty content is the forced first flush').to.equal('');

    // Each assignment below is its own Lit update pass (separated by an
    // awaited updateComplete), not a single batched pass -- proving the
    // *Announcer's* coalescing, not just Lit's own synchronous batching.
    el.content = 'a';
    await el.updateComplete;
    el.content = 'ab';
    await el.updateComplete;
    el.content = 'abc';
    await el.updateComplete;

    expect(plainText(el), 'nothing should have flushed yet -- still inside the coalesce window').to.equal('');

    await aTimeout(250);
    expect(plainText(el), 'only the latest value in the burst should ever land').to.equal('abc');
  });

  it('flushes immediately, bypassing the coalesce window, when streaming transitions from true to false', async () => {
    const el = (await fixture(
      html`<lyra-streaming-text streaming coalesce-ms="5000"></lyra-streaming-text>`,
    )) as LyraStreamingText;
    expect(plainText(el)).to.equal('');

    el.content = 'final chunk';
    el.streaming = false;
    await el.updateComplete;

    expect(plainText(el), 'the stream-end transition must force-flush the final content').to.equal('final chunk');
  });

  it('flushes immediately, bypassing the coalesce window, when streaming restarts (false -> true) on a reused element', async () => {
    const el = (await fixture(
      html`<lyra-streaming-text coalesce-ms="5000"></lyra-streaming-text>`,
    )) as LyraStreamingText;

    // Finish a first stream so the element is left showing that stream's
    // final content, exactly like a reused chat-message element would be
    // between two separate assistant turns.
    el.content = 'first stream final content';
    el.streaming = true;
    await el.updateComplete;
    el.streaming = false;
    await el.updateComplete;
    expect(plainText(el), 'precondition: the first stream flushed its final content').to.equal(
      'first stream final content',
    );

    // Restarting the stream on the same element with new content must
    // force-flush immediately -- otherwise the previous stream's stale final
    // content would keep showing for up to the full 5000ms coalesce window
    // even though a new stream has already started.
    el.content = 'second stream first chunk';
    el.streaming = true;
    await el.updateComplete;

    expect(plainText(el), 'a stream restart must force-flush immediately').to.equal('second stream first chunk');
  });

  it('does not force-flush a no-op reassignment of streaming to the same value', async () => {
    const el = (await fixture(
      html`<lyra-streaming-text streaming coalesce-ms="5000"></lyra-streaming-text>`,
    )) as LyraStreamingText;
    el.content = 'partial';
    el.streaming = true; // no-op: already true, must not force-flush
    await el.updateComplete;
    expect(plainText(el), 'reassigning streaming to its current value must not bypass the coalesce window').to.equal(
      '',
    );
  });

  it('cancels any pending coalesced flush on disconnect', async () => {
    const el = (await fixture(html`<lyra-streaming-text coalesce-ms="60"></lyra-streaming-text>`)) as LyraStreamingText;
    el.content = 'partial';
    await el.updateComplete;
    expect((el as unknown as Internals).displayedContent, 'precondition: still queued, not yet flushed').to.equal(
      '',
    );

    el.remove();
    await aTimeout(120);
    expect(
      (el as unknown as Internals).displayedContent,
      'a disconnected element must not still flush a pending burst',
    ).to.equal('');
  });
});

describe('markdown heuristic memoization', () => {
  it('does not re-run the markdown auto-detect heuristic on a render triggered only by streaming, with no displayedContent change', async () => {
    const el = (await fixture(
      html`<lyra-streaming-text .content=${'just plain prose, no markdown syntax here'}></lyra-streaming-text>`,
    )) as LyraStreamingText;
    await el.updateComplete;

    const originalTest = RegExp.prototype.test;
    let scans = 0;
    try {
      RegExp.prototype.test = function (this: RegExp, str: string): boolean {
        scans++;
        return originalTest.call(this, str);
      };

      // Neither of these transitions touches `content`/`displayedContent` --
      // each is still its own genuine `streaming` change (so each re-renders),
      // but the text the heuristic would scan is identical both times.
      el.streaming = true;
      await el.updateComplete;
      el.streaming = false;
      await el.updateComplete;

      expect(
        scans,
        'a render triggered only by `streaming` toggling must not re-scan unchanged displayedContent',
      ).to.equal(0);
    } finally {
      RegExp.prototype.test = originalTest;
    }
  });
});

describe('markdown auto-detection and rendering mode', () => {
  it('renders plain prose through the .plain text container by default', async () => {
    const el = (await fixture(
      html`<lyra-streaming-text .content=${'just some ordinary sentence, nothing special.'}></lyra-streaming-text>`,
    )) as LyraStreamingText;
    expect(el.shadowRoot!.querySelector('.plain')).to.exist;
    expect(el.shadowRoot!.querySelector('lyra-markdown')).to.not.exist;
  });

  it('auto-detects Markdown syntax and routes it through lyra-markdown', async () => {
    const el = (await fixture(
      html`<lyra-streaming-text .content=${'# Heading\n\nSome **bold** text.'}></lyra-streaming-text>`,
    )) as LyraStreamingText;
    expect(el.shadowRoot!.querySelector('lyra-markdown')).to.exist;
    expect(el.shadowRoot!.querySelector('.plain')).to.not.exist;
  });

  it('markdown=true forces Markdown rendering even for plain-looking content', async () => {
    const el = (await fixture(
      html`<lyra-streaming-text markdown .content=${'no markdown syntax here at all'}></lyra-streaming-text>`,
    )) as LyraStreamingText;
    expect(el.shadowRoot!.querySelector('lyra-markdown')).to.exist;
  });

  it('markdown=false forces plain-text rendering even for Markdown-looking content', async () => {
    const el = (await fixture(
      html`<lyra-streaming-text markdown="false" .content=${'# Heading with **bold**'}></lyra-streaming-text>`,
    )) as LyraStreamingText;
    expect(el.shadowRoot!.querySelector('lyra-markdown')).to.not.exist;
    expect(plainText(el)).to.equal('# Heading with **bold**');
  });

  it('forwards streaming through to the nested lyra-markdown as its own streaming hint prop', async () => {
    const el = (await fixture(
      html`<lyra-streaming-text streaming markdown .content=${'# Heading'}></lyra-streaming-text>`,
    )) as LyraStreamingText;
    const md = el.shadowRoot!.querySelector('lyra-markdown') as unknown as { streaming: boolean };
    expect(md.streaming).to.be.true;
  });
});

describe('looksLikeMarkdown()', () => {
  it('returns false for empty or plain prose', () => {
    expect(looksLikeMarkdown('')).to.be.false;
    expect(looksLikeMarkdown('just a normal sentence with no special syntax')).to.be.false;
  });

  it('recognizes headings, emphasis, code, lists, links, and blockquotes', () => {
    expect(looksLikeMarkdown('# Heading')).to.be.true;
    expect(looksLikeMarkdown('some **bold** text')).to.be.true;
    expect(looksLikeMarkdown('some _italic_ text')).to.be.true;
    expect(looksLikeMarkdown('inline `code` span')).to.be.true;
    expect(looksLikeMarkdown('```\nfenced\n```')).to.be.true;
    expect(looksLikeMarkdown('- a bullet item')).to.be.true;
    expect(looksLikeMarkdown('1. a numbered item')).to.be.true;
    expect(looksLikeMarkdown('see [the docs](https://example.com)')).to.be.true;
    expect(looksLikeMarkdown('> a quoted line')).to.be.true;
  });
});

describe('cursor', () => {
  it('renders no cursor part while not streaming', async () => {
    const el = (await fixture(html`<lyra-streaming-text .content=${'hi'}></lyra-streaming-text>`)) as LyraStreamingText;
    expect(el.shadowRoot!.querySelector('[part="cursor"]')).to.not.exist;
  });

  it('renders a decorative (aria-hidden) cursor part while streaming', async () => {
    const el = (await fixture(
      html`<lyra-streaming-text streaming .content=${'hi'}></lyra-streaming-text>`,
    )) as LyraStreamingText;
    const cursor = el.shadowRoot!.querySelector('[part="cursor"]');
    expect(cursor).to.exist;
    expect(cursor!.getAttribute('aria-hidden')).to.equal('true');
  });

  it('gives the cursor a looping blink animation that is disabled under reduced motion', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('animation: lyra-streaming-text-cursor-blink var(--lyra-transition-base) infinite;');
    expect(css).to.match(/@media \(prefers-reduced-motion: reduce\) \{[^}]*animation: none !important;/);
  });

  it('sizes the cursor bar from themeable --lyra-streaming-text-cursor-width/-height custom properties, not hardcoded literals', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.include('--lyra-streaming-text-cursor-width: var(--lyra-size-0-125rem);');
    expect(css).to.include('--lyra-streaming-text-cursor-height: var(--lyra-size-1em);');
    expect(css).to.include('inline-size: var(--lyra-streaming-text-cursor-width);');
    expect(css).to.include('block-size: var(--lyra-streaming-text-cursor-height);');
  });
});

it('does not dispatch any lyra-* events -- purely presentational', async () => {
  const el = (await fixture(html`<lyra-streaming-text></lyra-streaming-text>`)) as LyraStreamingText;
  let sawEvent = false;
  const onAny = () => (sawEvent = true);
  el.addEventListener('lyra-streaming-text-change', onAny);
  el.content = 'hello';
  el.streaming = true;
  await el.updateComplete;
  el.streaming = false;
  await el.updateComplete;
  expect(sawEvent).to.be.false;
});

it('is accessible in the default (empty, not streaming) state', async () => {
  const el = (await fixture(html`<lyra-streaming-text></lyra-streaming-text>`)) as LyraStreamingText;
  await expect(el).to.be.accessible();
});

it('is accessible while streaming, populated with Markdown content and a visible cursor', async () => {
  const el = (await fixture(
    html`<lyra-streaming-text streaming .content=${'# Heading\n\nSome **bold** text and a [link](https://example.com).'}></lyra-streaming-text>`,
  )) as LyraStreamingText;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});
