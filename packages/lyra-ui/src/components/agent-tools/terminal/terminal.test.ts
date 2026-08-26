import { aTimeout, fixture, expect, html, oneEvent } from '@open-wc/testing';
import './terminal.js';
import type { LyraTerminal } from './terminal.js';

async function settleClipboard(el: LyraTerminal): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await el.updateComplete;
}
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import type { LyraHighlight } from '../../viewers/document-viewer/anchors.js';

/** Reference oracle mirroring the *original* `highlightForLine()` implementation exactly (first
 *  match in array order wins any overlap) -- kept independent of the production code under test
 *  so the regression tests below actually prove the optimized `resolvedHighlightLines()` still
 *  computes the same per-line winner, not merely that it agrees with itself. */
function bruteForceHighlightForLine(
  highlights: LyraHighlight[],
  lineNumber: number,
): LyraHighlight | undefined {
  return highlights.find(
    (h) =>
      h.anchor.kind === 'line-range' &&
      lineNumber >= h.anchor.start &&
      lineNumber <= (h.anchor.end ?? h.anchor.start),
  );
}

function sinkElement(politeness: 'polite' | 'assertive'): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`);
}

function sinkTexts(politeness: 'polite' | 'assertive'): string[] {
  const element = sinkElement(politeness);
  return element ? Array.from(element.children).map((child) => child.textContent ?? '') : [];
}

describe('lr-terminal', () => {
  it('defaults to follow=true, wrap=true, copyable=true, maxScrollback=5000', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    expect(el.follow).to.be.true;
    expect(el.wrap).to.be.true;
    expect(el.copyable).to.be.true;
    expect(el.maxScrollback).to.equal(5000);
  });

  it('accepts follow="false", wrap="false", and copyable="false" as plain-HTML attribute strings', async () => {
    const el = (await fixture(
      html`<lr-terminal follow="false" wrap="false" copyable="false"></lr-terminal>`,
    )) as LyraTerminal;
    expect(el.follow).to.be.false;
    expect(el.wrap).to.be.false;
    expect(el.copyable).to.be.false;
    expect(el.hasAttribute('follow')).to.be.false;
    expect(el.hasAttribute('wrap')).to.be.false;
    expect(el.hasAttribute('copyable')).to.be.false;
  });

  it('renders content as plain lines and getPlainText() returns the SGR-stripped text', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.content = 'line one\n\x1b[31mline two\x1b[0m';
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('line one\nline two');
  });

  it('write() appends without resetting scrollback, unlike reassigning content', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.content = 'first\n';
    await el.updateComplete;
    el.write('second');
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('first\nsecond');
    el.content = 'reset';
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('reset');
  });

  it('commits same-turn replace/write/clear operations in call order', async () => {
    const el = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
    el.content = 'base';
    el.write(' + streamed');
    expect(el.getPlainText()).to.equal('base + streamed');

    el.content = 'must not resurrect';
    el.clear();
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('');

    el.replace('synchronous replacement');
    expect(el.getPlainText()).to.equal('synchronous replacement');
  });

  it('\\r moves the write cursor to line start so following text overwrites (progress bar)', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('50%\rdone!');
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('done!');
  });

  it('\\b steps back one cell and \\t advances to 8-column stops', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('abc\bX');
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('abX');
    const tabEl = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    tabEl.write('ab\tX');
    await tabEl.updateComplete;
    expect(tabEl.getPlainText()).to.equal('ab      X');
  });

  it('trims scrollback to maxScrollback, keeping absolute (1-based) line numbers', async () => {
    const el = (await fixture(html`<lr-terminal max-scrollback="3"></lr-terminal>`)) as LyraTerminal;
    el.write('l1\nl2\nl3\nl4\nl5');
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('l3\nl4\nl5');
    const found = await el.scrollToAnchor({ kind: 'line-range', start: 1 });
    expect(found).to.be.false; // trimmed line -- no longer resolvable
    const stillThere = await el.scrollToAnchor({ kind: 'line-range', start: 4 });
    expect(stillThere).to.be.true;
  });

  it('normalizes an invalid max-scrollback (negative, NaN, or fractional) instead of trusting it directly', async () => {
    const negative = (await fixture(html`<lr-terminal max-scrollback="-5"></lr-terminal>`)) as LyraTerminal;
    negative.write('l1\nl2\nl3');
    await negative.updateComplete;
    // A negative limit still keeps at least the most-recently-appended line (the same 1-line
    // floor the pre-existing ad hoc guard already enforced) rather than trimming everything away.
    expect(negative.getPlainText()).to.equal('l3');

    const fractional = (await fixture(html`<lr-terminal max-scrollback="3.9"></lr-terminal>`)) as LyraTerminal;
    fractional.write('l1\nl2\nl3\nl4\nl5');
    await fractional.updateComplete;
    expect(fractional.getPlainText()).to.equal('l3\nl4\nl5');

    const nan = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    nan.maxScrollback = NaN;
    nan.write('l1\nl2\nl3\nl4\nl5\nl6');
    await nan.updateComplete;
    // NaN falls back to the 5000-line default, not to a 1-line floor.
    expect(nan.getPlainText()).to.equal('l1\nl2\nl3\nl4\nl5\nl6');
  });

  it('bounds newline-free cells, retained cells, newline bursts, and huge finite scrollback', async () => {
    const single = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
    single.write('x'.repeat(25_000));
    expect(single.getPlainText()).to.have.length(20_000);

    const retained = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
    retained.maxScrollback = Number.MAX_VALUE;
    retained.write(`${'x'.repeat(20_001)}\n`.repeat(11));
    const retainedLines = retained.getPlainText().split('\n');
    expect(retainedLines).to.have.length(11);
    expect(retainedLines.reduce((count, line) => count + line.length, 0)).to.be.at.most(200_000);

    const burst = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
    burst.maxScrollback = Number.MAX_VALUE;
    burst.write('\n'.repeat(10_050));
    expect(burst.getPlainText().split('\n')).to.have.length(10_000);
  });

  it('clear() resets scrollback and parser state', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('\x1b[31msome text');
    await el.updateComplete;
    el.clear();
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('');
    el.write('fresh');
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('fresh');
  });

  it('recovers visible streamed output after an overlong unterminated OSC sequence', async () => {
    const el = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
    el.write(`\x1b]0;${'x'.repeat(5_000)}`);
    el.write('\x1b[31mrecovered');
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('recovered');
  });

  it('copy button emits lr-copy with the SGR-stripped plain text', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
    try {
      const el = (await fixture(html`<lr-terminal copyable></lr-terminal>`)) as LyraTerminal;
      el.write('\x1b[31mred\x1b[0m plain');
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      const listener = oneEvent(el, 'lr-copy');
      button.click();
      const event = (await listener) as CustomEvent<{ ok: true; text: string }>;
      expect(event.detail).to.deep.equal({ ok: true, text: 'red plain' });
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('download button emits lr-download with the configured filename', async () => {
    const el = (await fixture(
      html`<lr-terminal downloadable filename="out.log"></lr-terminal>`,
    )) as LyraTerminal;
    el.write('hi');
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="download-button"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lr-download');
    button.click();
    const event = (await listener) as CustomEvent<{ filename: string }>;
    expect(event.detail.filename).to.equal('out.log');
  });

  it('lr-download is cancelable; preventDefault() suppresses the built-in Blob download', async () => {
    const el = (await fixture(
      html`<lr-terminal downloadable filename="out.log"></lr-terminal>`,
    )) as LyraTerminal;
    el.write('hi');
    await el.updateComplete;
    const original = URL.createObjectURL;
    let createObjectURLCalled = false;
    URL.createObjectURL = ((blob: Blob) => {
      createObjectURLCalled = true;
      return original.call(URL, blob);
    }) as typeof URL.createObjectURL;
    try {
      el.addEventListener('lr-download', (e) => e.preventDefault(), { once: true });
      const button = el.shadowRoot!.querySelector('[part="download-button"]') as HTMLButtonElement;
      const listener = oneEvent(el, 'lr-download');
      button.click();
      const event = (await listener) as CustomEvent<{ filename: string }>;
      expect(event.detail.filename).to.equal('out.log');
      expect(event.defaultPrevented).to.be.true;
      expect(createObjectURLCalled).to.be.false;
    } finally {
      URL.createObjectURL = original;
    }
  });

  it('search() resolves match count and lr-search-change reports query/matchCount/matchCountExact/activeIndex', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('error: bad\ninfo: ok\nerror: worse');
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-search-change');
    const count = await el.search('error');
    expect(count).to.equal(2);
    const event = (await listener) as CustomEvent<{
      query: string;
      matchCount: number;
      matchCountExact: boolean;
      activeIndex: number;
    }>;
    expect(event.detail).to.deep.equal({ query: 'error', matchCount: 2, matchCountExact: true, activeIndex: 0 });
  });

  it('bounds the number of occurrence matches retained for an adversarial single line, and reports matchCountExact: false', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a'.repeat(12_000));
    const listener = oneEvent(el, 'lr-search-change');
    expect(await el.search('a')).to.equal(10_000);
    const event = (await listener) as CustomEvent<{ matchCount: number; matchCountExact: boolean }>;
    expect(event.detail.matchCount).to.equal(10_000);
    expect(event.detail.matchCountExact).to.equal(false); // the 10,000-match ceiling was hit
  });

  it('searchNext()/searchPrevious() wrap around the match list', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a\nb\na');
    await el.updateComplete;
    await el.search('a');
    el.searchNext();
    let active = -1;
    el.addEventListener('lr-search-change', (e) => {
      active = (e as CustomEvent<{ activeIndex: number }>).detail.activeIndex;
    });
    el.searchNext();
    expect(active).to.equal(0); // wrapped from index 1 back to 0
    el.searchPrevious();
    expect(active).to.equal(1);
  });

  it('clearSearch() clears matches and emits a zero-count lr-search-change', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('error');
    await el.updateComplete;
    await el.search('error');
    const listener = oneEvent(el, 'lr-search-change');
    el.clearSearch();
    const event = (await listener) as CustomEvent<{ matchCount: number; matchCountExact: boolean }>;
    expect(event.detail.matchCount).to.equal(0);
    expect(event.detail.matchCountExact).to.equal(true);
  });

  it('emits exactly once for search-state changes caused by writes, trims, clears, and content replacement', async () => {
    const el = (await fixture(html`<lr-terminal max-scrollback="3"></lr-terminal>`)) as LyraTerminal;
    el.write('error\nok');
    await el.updateComplete;
    await el.search('error');
    const details: Array<{
      query: string;
      matchCount: number;
      matchCountExact: boolean;
      activeIndex: number;
    }> = [];
    el.addEventListener('lr-search-change', (event) => {
      details.push(
        (event as CustomEvent<{ query: string; matchCount: number; matchCountExact: boolean; activeIndex: number }>)
          .detail,
      );
    });

    el.write('\nerror');
    await el.updateComplete;
    expect(details).to.deep.equal([{ query: 'error', matchCount: 2, matchCountExact: true, activeIndex: 0 }]);

    details.length = 0;
    el.maxScrollback = 2;
    await el.updateComplete;
    expect(details).to.deep.equal([{ query: 'error', matchCount: 1, matchCountExact: true, activeIndex: 0 }]);

    details.length = 0;
    el.clear();
    await el.updateComplete;
    expect(details).to.deep.equal([{ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 }]);

    el.write('error');
    await el.search('error');
    details.length = 0;
    el.content = 'replacement';
    await el.updateComplete;
    expect(details).to.deep.equal([{ query: '', matchCount: 0, matchCountExact: true, activeIndex: -1 }]);
  });

  it('does not emit lr-search-change when normalization leaves public search state unchanged', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('one match');
    await el.search('match');
    let deliveries = 0;
    el.addEventListener('lr-search-change', () => deliveries++);
    await el.search('match');
    el.searchNext();
    el.maxScrollback = 5000;
    await el.updateComplete;
    expect(deliveries).to.equal(0);
  });

  it('scrolling away from the bottom disengages follow and emits lr-follow-change', async () => {
    const el = (await fixture(
      html`<div style="height:60px;display:block"><lr-terminal></lr-terminal></div>`,
    )) as HTMLDivElement;
    const term = el.querySelector('lr-terminal') as LyraTerminal;
    // Kept well under lr-virtual-list's own row-height="auto" per-row ResizeObserver measurement
    // batch that (independent of lr-terminal -- reproducible with a bare <lr-virtual-list>
    // rendering this many freshly-added rows at once) triggers the browser's real "ResizeObserver
    // loop completed with undelivered notifications" report above roughly 20-25 rows in one go.
    for (let i = 0; i < 15; i++) term.write(`line ${i}\n`);
    await term.updateComplete;
    const list = term.shadowRoot!.querySelector('lr-virtual-list')!;
    // Real per-row measurement keeps settling asynchronously for a few more frames after
    // updateComplete resolves, each capable of firing its own genuine `lr-visible-range-change`
    // -- letting it fully settle first, before registering the listener and dispatching the mocked
    // range below, avoids a late genuine event racing the mocked one (this component reacts to
    // virtual-list's real range exactly the same way it reacts to a mocked one, so whichever lands
    // last wins the assertion).
    await new Promise((resolve) => setTimeout(resolve, 100));
    const listener = oneEvent(term, 'lr-follow-change');
    list.dispatchEvent(new CustomEvent('lr-visible-range-change', { detail: { start: 0, end: 3 }, bubbles: true, composed: true }));
    const event = (await listener) as CustomEvent<{ following: boolean }>;
    expect(event.detail.following).to.be.false;
    expect(term.follow).to.be.false;
  });

  it('does not leak the child virtual-list visible-range event through the terminal wrapper', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('one\ntwo');
    await el.updateComplete;
    let leaked = false;
    el.addEventListener('lr-visible-range-change', () => (leaked = true));
    el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(
      new CustomEvent('lr-visible-range-change', {
        detail: { start: 0, end: 1 },
        bubbles: true,
        composed: true,
      }),
    );
    expect(leaked).to.be.false;
  });

  it('mirrors a non-empty host aria-label onto the nested log, falling back to the generic label when unset', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]')!;
    expect(viewport.getAttribute('role')).to.equal('log');
    expect(viewport.getAttribute('aria-label')).to.equal('Terminal output');
    const labeled = (await fixture(html`<lr-terminal aria-label="Build output"></lr-terminal>`)) as LyraTerminal;
    const labeledViewport = labeled.shadowRoot!.querySelector('[part="viewport"]')!;
    expect(labeled.getAttribute('aria-label')).to.equal('Build output');
    expect(labeledViewport.getAttribute('aria-label')).to.equal('Build output');

    labeled.setAttribute('aria-label', '');
    await labeled.updateComplete;
    expect(labeledViewport.getAttribute('aria-label')).to.equal('Terminal output');
  });

  it('disables the log role implicit live behavior so announce-output has one dedicated announcer', async () => {
    const el = (await fixture(html`<lr-terminal announce-output></lr-terminal>`)) as LyraTerminal;
    expect(el.shadowRoot!.querySelector('[part="viewport"]')!.getAttribute('aria-live')).to.equal('off');
  });

  it('renders a line-range highlight with data-highlight-tone and emits lr-highlight-activate on click', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a\nb\nc');
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 2, end: 2 }, tone: 'warning' }];
    await el.updateComplete;
    // Rendered lines live inside <lr-virtual-list>'s own shadow root (it's the renderItem
    // delegate's real render root, not this component's) -- reach one level in to find them.
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const line = list.shadowRoot!.querySelector('[data-line-number="2"]') as HTMLElement;
    expect(line.getAttribute('data-highlight-tone')).to.equal('warning');
    const listener = oneEvent(el, 'lr-highlight-activate');
    line.click();
    const event = (await listener) as CustomEvent<{ highlightId: string }>;
    expect(event.detail.highlightId).to.equal('h1');
    await el.updateComplete;
    expect(line.getAttribute('aria-current')).to.equal('true');
  });

  it('drops missing or null highlight anchors from the first update without losing the terminal', async () => {
    const el = document.createElement('lr-terminal') as LyraTerminal;
    el.content = 'ready';
    el.highlights = [{ id: 'missing-anchor' }] as unknown as LyraHighlight[];
    document.body.append(el);
    try {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(1);
      expect(el.highlights.map((highlight) => highlight.id)).to.deep.equal([]);

      el.highlights = [{ id: 'null-anchor', anchor: null }] as unknown as LyraHighlight[];
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(1);
      expect(el.highlights.map((highlight) => highlight.id)).to.deep.equal([]);
    } finally {
      el.remove();
    }
  });

  it('gives a multi-line highlight one named interactive owner and leaves blank continuation lines non-interactive', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('first line\n\nthird line');
    el.highlights = [{
      id: 'range',
      label: 'Failure context',
      anchor: { kind: 'line-range', start: 1, end: 3 },
      tone: 'danger',
    }];
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const highlighted = [...list.shadowRoot!.querySelectorAll<HTMLElement>('[data-highlight-tone="danger"]')];
    expect(highlighted.length).to.equal(3);
    const buttons = highlighted.filter((line) => line.getAttribute('role') === 'button');
    expect(buttons.length).to.equal(1);
    expect(buttons[0]!.getAttribute('data-line-number')).to.equal('1');
    expect(buttons[0]!.getAttribute('aria-label') ?? '').to.include('Failure context');
    expect(highlighted[1]!.getAttribute('tabindex')).to.equal(null);
  });

  it('rehomes a trimmed line-range highlight owner to its first surviving covered line', async () => {
    const el = (await fixture(html`<lr-terminal max-scrollback="3"></lr-terminal>`)) as LyraTerminal;
    el.write('first\nsecond\nthird');
    el.highlights = [{
      id: 'range',
      label: 'Failure context',
      anchor: { kind: 'line-range', start: 1, end: 3 },
      tone: 'danger',
    }];
    await el.updateComplete;

    el.write('\nfourth');
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const highlighted = [...list.shadowRoot!.querySelectorAll<HTMLElement>('[data-highlight-tone="danger"]')];
    const buttons = highlighted.filter((line) => line.getAttribute('role') === 'button');
    expect(highlighted.map((line) => line.getAttribute('data-line-number'))).to.deep.equal(['2', '3']);
    expect(buttons).to.have.lengthOf(1);
    expect(buttons[0]!.getAttribute('data-line-number')).to.equal('2');

    const activated = oneEvent(el, 'lr-highlight-activate');
    buttons[0]!.click();
    expect(((await activated) as CustomEvent<{ highlightId: string }>).detail.highlightId)
      .to.equal('range');
  });

  it('gives every visibly resolved overlapping highlight exactly one interactive owner', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('one\ntwo\nthree\nfour');
    el.highlights = [
      { id: 'first', anchor: { kind: 'line-range', start: 1, end: 3 }, tone: 'danger' },
      { id: 'second', anchor: { kind: 'line-range', start: 2, end: 4 }, tone: 'warning' },
    ];
    await el.updateComplete;

    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const owners = [...list.shadowRoot!.querySelectorAll<HTMLElement>('[role="button"]')];
    expect(owners.map((line) => line.getAttribute('data-line-number'))).to.deep.equal(['1', '4']);
  });

  it('keeps array-order highlight priority for overlapping ranges even when start order disagrees', async () => {
    // Regression guard for the resolvedHighlightLines() perf rewrite: a naive "sort by start"
    // implementation of the same optimization would pick the wider/earlier-starting highlight as
    // the winner on the overlap -- but the original `.find()`-based behavior always prefers
    // whichever highlight is first in `this.highlights` array order, regardless of start value.
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write(Array.from({ length: 10 }, (_, i) => `line ${i + 1}`).join('\n'));
    el.highlights = [
      { id: 'narrow-later-start', anchor: { kind: 'line-range', start: 3, end: 6 }, tone: 'danger' },
      { id: 'wide-earlier-start', anchor: { kind: 'line-range', start: 1, end: 10 }, tone: 'warning' },
    ];
    await el.updateComplete;

    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const toneOf = (n: number) =>
      list.shadowRoot!.querySelector(`[data-line-number="${n}"]`)!.getAttribute('data-highlight-tone');
    for (const n of [3, 4, 5, 6]) expect(toneOf(n), `line ${n}`).to.equal('danger');
    for (const n of [1, 2, 7, 8, 9, 10]) expect(toneOf(n), `line ${n}`).to.equal('warning');

    const owners = [...list.shadowRoot!.querySelectorAll<HTMLElement>('[role="button"]')];
    expect(owners.map((line) => line.getAttribute('data-line-number'))).to.deep.equal(['1', '3']);
  });

  it('matches the brute-force per-line highlight owner at scale (many lines, many overlapping highlights)', async () => {
    // Exercises resolvedHighlightLines() -- the O(lines + highlights) replacement for the old
    // O(lines * highlights) per-render scan -- at a scale where a subtle clamping/priority bug in
    // the rewrite would plausibly show up but a handful of hand-picked lines would not.
    const el = (await fixture(html`<lr-terminal max-scrollback="3000"></lr-terminal>`)) as LyraTerminal;
    const lineCount = 3000;
    el.write(Array.from({ length: lineCount }, (_, i) => `line ${i + 1}`).join('\n'));
    await el.updateComplete;

    // Deterministic, purposely NOT sorted by start -- array index and start position disagree for
    // most of these, the same condition the priority test above targets, just at scale.
    const highlights: LyraHighlight[] = Array.from({ length: 400 }, (_, i) => {
      const start = ((i * 37) % lineCount) + 1;
      const span = (i % 11) + 1; // 1..11 lines
      const end = Math.min(lineCount, start + span - 1);
      return {
        id: `h${i}`,
        anchor: { kind: 'line-range' as const, start, end },
        tone: (['accent', 'success', 'warning', 'danger', 'neutral'] as const)[i % 5],
      };
    });
    el.highlights = highlights;
    await el.updateComplete;

    const priv = el as unknown as {
      resolvedHighlightLines(): {
        perLine: Map<number, LyraHighlight>;
        owners: Map<LyraHighlight, number>;
      };
      lines: { number: number }[];
    };
    const { perLine, owners } = priv.resolvedHighlightLines();
    const expectedOwners = new Map<LyraHighlight, number>();

    for (const line of priv.lines) {
      const expected = bruteForceHighlightForLine(highlights, line.number);
      if (expected && !expectedOwners.has(expected)) expectedOwners.set(expected, line.number);
      expect(perLine.get(line.number)?.id, `perLine at line ${line.number}`).to.equal(expected?.id);
    }

    const ownerById = new Map([...owners].map(([highlight, line]) => [highlight.id, line]));
    for (const h of highlights) {
      expect(ownerById.get(h.id), `owner line of ${h.id}`).to.equal(expectedOwners.get(h));
    }
  });

  it('renders per-line match/active-match state via O(1) lookups, combined with highlight tone, correctly across every rendered line', async () => {
    // Exercises renderLine()'s precomputed Set<lineNumber> and single active-match line number,
    // instead of a per-row this.searchMatches.some() scan, together with the highlight map. It
    // checks every one of 12 lines against an independently
    // reasoned expectation. Search state is poked directly (bypassing search()/searchNext(),
    // which themselves scroll the view via activeItemId and would otherwise make which lines are
    // actually mounted depend on virtual-list's own scroll-into-view timing) so this test stays
    // about renderLine()'s lookup wiring, not virtualization/scrolling.
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    const lineCount = 12;
    el.write(Array.from({ length: lineCount }, (_, i) => `line ${i + 1}`).join('\n'));
    await el.updateComplete;

    el.highlights = [
      { id: 'first', anchor: { kind: 'line-range', start: 3, end: 6 }, tone: 'danger' },
      { id: 'second', anchor: { kind: 'line-range', start: 5, end: 8 }, tone: 'warning' },
    ];
    const matchedLines = [2, 5, 9, 12];
    const priv = el as unknown as {
      searchQuery: string;
      searchMatches: { lineNumber: number }[];
      searchActiveIndex: number;
      requestUpdate(): void;
    };
    priv.searchQuery = 'needle';
    priv.searchMatches = matchedLines.map((lineNumber) => ({ lineNumber }));
    priv.searchActiveIndex = 2; // active match is line 9
    priv.requestUpdate();
    await el.updateComplete;

    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    for (let n = 1; n <= lineCount; n++) {
      const row = list.shadowRoot!.querySelector(`[data-line-number="${n}"]`) as HTMLElement;
      // A derived primitive, never the node itself: handing chai a live DOM node as
      // actual/expected hangs the whole file in the runner's message serialization.
      expect(row != null, `line ${n} rendered`).to.equal(true);

      const expectedMatch = !matchedLines.includes(n) ? null : n === 9 ? 'active' : '';
      expect(row.getAttribute('data-match'), `line ${n} data-match`).to.equal(expectedMatch);

      // Array-order priority: 'first' (danger) wins lines 5-6 over 'second' (warning), which
      // matches only lines 7-8.
      const expectedTone = n >= 3 && n <= 6 ? 'danger' : n >= 7 && n <= 8 ? 'warning' : null;
      expect(row.getAttribute('data-highlight-tone'), `line ${n} tone`).to.equal(expectedTone);
    }
  });

  it('retints an accent-tone highlighted line via --lr-terminal-highlight-accent-bg, decoupled from the shared --lr-color-brand-quiet token used by the toolbar-button hover state', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a\nb\nc');
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 2, end: 2 }, tone: 'accent' }];
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const line = list.shadowRoot!.querySelector('[data-line-number="2"]') as HTMLElement;
    const defaultBg = getComputedStyle(line).backgroundColor;

    el.style.setProperty('--lr-terminal-highlight-accent-bg', 'rgb(9, 8, 7)');
    await el.updateComplete;
    expect(getComputedStyle(line).backgroundColor).to.equal('rgb(9, 8, 7)');

    // Retinting the highlight doesn't retint the toolbar-button hover token they used to share.
    el.style.setProperty('--lr-color-brand-quiet', 'rgb(1, 2, 3)');
    await el.updateComplete;
    expect(getComputedStyle(line).backgroundColor).to.equal('rgb(9, 8, 7)');

    el.style.removeProperty('--lr-terminal-highlight-accent-bg');
    el.style.removeProperty('--lr-color-brand-quiet');
    await el.updateComplete;
    expect(getComputedStyle(line).backgroundColor).to.equal(defaultBg);
  });

  it('scrollToAnchor resolves a highlight id and a line-range anchor', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a\nb\nc');
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 3 } }];
    await el.updateComplete;
    expect(await el.scrollToAnchor('h1')).to.be.true;
    expect(await el.scrollToAnchor({ kind: 'line-range', start: 99 })).to.be.false;
  });

  it('scrollToAnchor disengages follow without echoing a user-only follow event', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a\nb');
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-follow-change', () => (fired = true));
    expect(await el.scrollToAnchor({ kind: 'line-range', start: 1 })).to.be.true;
    await el.updateComplete;
    expect(el.follow).to.be.false;
    expect(fired).to.be.false;
  });

  it('announce-output routes appended text into the shared light-DOM sink, not the shadow region', async () => {
    const el = (await fixture(html`<lr-terminal announce-output></lr-terminal>`)) as LyraTerminal;
    el.write('build started');
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 20)); // Announcer's own throttle uses real timers
    expect(sinkTexts('polite')).to.deep.equal(['build started']);
    const region = el.shadowRoot!.querySelector('[part="announcer"]')!;
    // The retained part is a styling/inspection mirror only -- it must not be a second live region,
    // or a browser that *does* announce shadow live regions reads every chunk twice.
    expect(region.getAttribute('role')).to.equal(null);
    expect(region.getAttribute('aria-live')).to.equal(null);
    expect(region.getAttribute('aria-hidden')).to.equal('true');
    expect(region.textContent).to.equal('build started');
  });

  it('announces a repeated identical chunk twice instead of silently rewriting one text node', async () => {
    const el = (await fixture(html`<lr-terminal announce-output></lr-terminal>`)) as LyraTerminal;
    el.write('same line');
    await new Promise((resolve) => setTimeout(resolve, 20));
    el.write('same line');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sinkTexts('polite')).to.deep.equal(['same line', 'same line']);
  });

  it('ref-counts the shared sink away once the last terminal disconnects', async () => {
    const first = (await fixture(html`<lr-terminal announce-output></lr-terminal>`)) as LyraTerminal;
    const second = (await fixture(html`<lr-terminal announce-output></lr-terminal>`)) as LyraTerminal;
    expect(sinkElement('polite') !== null, 'a connected terminal holds the sink').to.be.true;
    first.remove();
    expect(sinkElement('polite') !== null, 'a still-connected terminal keeps it mounted').to.be.true;
    second.remove();
    expect(sinkElement('polite') === null, 'the last disconnect unmounts it').to.be.true;
  });

  it('does not populate the announcer region when announce-output is left off (default)', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('quiet output');
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(el.shadowRoot!.querySelector('[part="announcer"]')!.textContent).to.equal('');
  });

  it('clears transient copied and pending announcement state across disconnect/reconnect', async () => {
    const el = (await fixture(html`<lr-terminal announce-output></lr-terminal>`)) as LyraTerminal;
    el.write('pending');
    (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
    el.remove();
    document.body.append(el);
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).textContent!.trim()).to.equal(
      'Copy',
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(el.shadowRoot!.querySelector('[part="announcer"]')!.textContent).to.equal('');
  });

  it('schedules and cancels queued announcements with the adopted document window', async () => {
    const el = (await fixture(html`<lr-terminal announce-output></lr-terminal>`)) as LyraTerminal;
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const ownerWindow = iframe.contentWindow!;
    const originalSetTimeout = ownerWindow.setTimeout;
    const originalClearTimeout = ownerWindow.clearTimeout;
    const callbacks = new Map<number, () => void>();
    const clears: number[] = [];
    ownerWindow.setTimeout = ((handler: TimerHandler) => {
      if (typeof handler === 'function') callbacks.set(71, () => handler());
      return 71;
    }) as typeof ownerWindow.setTimeout;
    ownerWindow.clearTimeout = ((handle?: number) => {
      if (handle !== undefined) {
        clears.push(handle);
        callbacks.delete(handle);
      }
    }) as typeof ownerWindow.clearTimeout;

    try {
      iframe.contentDocument!.body.append(el);
      (el as unknown as { announcer: { announce(text: string): void } }).announcer.announce('frame output');
      expect(callbacks.has(71), 'the adopted window must schedule the announcement').to.be.true;

      el.remove();
      expect(clears).to.include(71);
      expect(callbacks.size).to.equal(0);
    } finally {
      el.remove();
      ownerWindow.setTimeout = originalSetTimeout;
      ownerWindow.clearTimeout = originalClearTimeout;
      iframe.remove();
    }
  });

  it('uses the adopted realm for clipboard, copy timing, downloads, and selection fallback', async () => {
    const el = (await fixture(html`<lr-terminal downloadable></lr-terminal>`)) as LyraTerminal;
    el.write('frame output');
    await el.updateComplete;
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const ownerDocument = iframe.contentDocument!;
    const ownerWindow = iframe.contentWindow!;
    const originalClipboard = Object.getOwnPropertyDescriptor(ownerWindow.navigator, 'clipboard');
    const originalSetTimeout = ownerWindow.setTimeout;
    const originalClearTimeout = ownerWindow.clearTimeout;
    const originalCreateObjectURL = ownerWindow.URL.createObjectURL;
    const originalRevokeObjectURL = ownerWindow.URL.revokeObjectURL;
    const originalAnchorClick = ownerWindow.HTMLAnchorElement.prototype.click;
    const originalGetSelection = ownerDocument.getSelection;
    const clipboardWrites: string[] = [];
    const timers = new Map<number, { callback: () => void; delay: number }>();
    const clears: number[] = [];
    const blobs: Blob[] = [];
    const revoked: string[] = [];
    let nextHandle = 100;
    let clickedAnchorDocument: Document | undefined;

    Object.defineProperty(ownerWindow.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (text: string) => { clipboardWrites.push(text); return Promise.resolve(); } },
    });
    ownerWindow.setTimeout = ((handler: TimerHandler, delay?: number) => {
      const handle = ++nextHandle;
      if (typeof handler === 'function') timers.set(handle, { callback: () => handler(), delay: delay ?? 0 });
      return handle;
    }) as typeof ownerWindow.setTimeout;
    ownerWindow.clearTimeout = ((handle?: number) => {
      if (handle !== undefined) {
        clears.push(handle);
        timers.delete(handle);
      }
    }) as typeof ownerWindow.clearTimeout;
    ownerWindow.URL.createObjectURL = ((blob: Blob) => {
      blobs.push(blob);
      return 'blob:frame-terminal';
    }) as typeof ownerWindow.URL.createObjectURL;
    ownerWindow.URL.revokeObjectURL = ((url: string) => revoked.push(url)) as typeof ownerWindow.URL.revokeObjectURL;
    ownerWindow.HTMLAnchorElement.prototype.click = function () {
      clickedAnchorDocument = this.ownerDocument;
    };

    try {
      ownerDocument.body.append(el);
      await el.updateComplete;

      (el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement).click();
      await settleClipboard(el);
      expect(clipboardWrites).to.deep.equal(['frame output']);
      const copyTimer = [...timers].find(([, timer]) => timer.delay === 1500)?.[0];
      expect(copyTimer).to.be.a('number');

      (el.shadowRoot!.querySelector('[part="download-button"]') as HTMLButtonElement).click();
      expect(blobs.length).to.equal(1);
      expect(blobs[0] instanceof ownerWindow.Blob).to.be.true;
      expect(clickedAnchorDocument === ownerDocument).to.be.true;
      const revokeTimer = [...timers].find(([, timer]) => timer.delay === 5000)?.[0];
      expect(revokeTimer).to.be.a('number');
      timers.get(revokeTimer!)!.callback();
      expect(revoked).to.deep.equal(['blob:frame-terminal']);

      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const line = list.shadowRoot!.querySelector('[data-line-number="1"]') as HTMLElement;
      const range = ownerDocument.createRange();
      range.selectNodeContents(line);
      const selection = {
        isCollapsed: false,
        anchorNode: line,
        focusNode: line,
        getRangeAt: () => range,
      } as unknown as Selection;
      ownerDocument.getSelection = () => selection;
      (list.shadowRoot as unknown as { getSelection?: () => Selection | null }).getSelection = () => null;
      (el.shadowRoot as unknown as { getSelection?: () => Selection | null }).getSelection = () => null;
      let anchor: unknown;
      el.addEventListener('lr-text-select', (event) => {
        anchor = (event as CustomEvent<{ anchor: unknown }>).detail.anchor;
      }, { once: true });
      el.shadowRoot!.querySelector('[part="viewport"]')!.dispatchEvent(
        new ownerWindow.PointerEvent('pointerup', { bubbles: true }),
      );
      expect(anchor).to.deep.equal({ kind: 'line-range', start: 1, end: 1 });

      el.remove();
      expect(clears).to.include(copyTimer);
    } finally {
      el.remove();
      if (originalClipboard) Object.defineProperty(ownerWindow.navigator, 'clipboard', originalClipboard);
      else Reflect.deleteProperty(ownerWindow.navigator, 'clipboard');
      ownerWindow.setTimeout = originalSetTimeout;
      ownerWindow.clearTimeout = originalClearTimeout;
      ownerWindow.URL.createObjectURL = originalCreateObjectURL;
      ownerWindow.URL.revokeObjectURL = originalRevokeObjectURL;
      ownerWindow.HTMLAnchorElement.prototype.click = originalAnchorClick;
      ownerDocument.getSelection = originalGetSelection;
      iframe.remove();
    }
  });

  it('trims immediately when maxScrollback is lowered after output already exists', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('one\ntwo\nthree');
    el.maxScrollback = 2;
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('two\nthree');
  });

  it('emits lr-text-select with a resolved line-range anchor when a selection lands inside two mounted lines', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('first\nsecond\nthird');
    await el.updateComplete;
    // Rendered lines live inside <lr-virtual-list>'s own shadow root -- see the equivalent note
    // in the highlight-activate test above.
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const lines = [...list.shadowRoot!.querySelectorAll('[data-line-number]')];
    // Lit inserts a static per-expression marker comment before the dynamic text node it commits
    // (visible via `<span><!--?lit$...--> the actual text</span>`), so the real Text node is not
    // reliably `firstChild` -- find it directly instead of assuming a fixed sibling position.
    const textNodeOf = (line: Element): Node =>
      [...line.querySelector('span')!.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!;
    // WebKit does not expose ShadowRoot.getSelection(), so use a deterministic selection-shaped
    // value here and leave native cross-shadow selection support to the component's fail-closed path.
    const range = document.createRange();
    range.setStart(textNodeOf(lines[0]!), 0);
    range.setEnd(textNodeOf(lines[1]!), 3);
    const sourceRect = new DOMRect(1, 2, 3, 4);
    Object.defineProperty(range, 'getClientRects', {
      configurable: true,
      value: () => [sourceRect],
    });
    const selection = {
      isCollapsed: false,
      anchorNode: textNodeOf(lines[0]!),
      focusNode: textNodeOf(lines[1]!),
      getRangeAt: () => range,
    } as unknown as Selection;
    (list.shadowRoot as unknown as { getSelection: () => Selection }).getSelection = () => selection;
    el.addEventListener('lr-text-select', (rawEvent) => {
      const detail = (rawEvent as CustomEvent<{
        text: string;
        rects: readonly { x: number }[];
      }>).detail;
      try {
        (detail as { text: string }).text = 'mutated';
      } catch {
        // Frozen event snapshots reject listener mutation in strict mode.
      }
      try {
        (detail.rects as { x: number }[]).push({ x: 99 });
      } catch {
        // Frozen collection snapshots reject listener mutation in strict mode.
      }
      try {
        (detail.rects[0] as { x: number }).x = 99;
      } catch {
        // Frozen geometry snapshots reject listener mutation in strict mode.
      }
    }, { once: true });
    const listener = oneEvent(el, 'lr-text-select');
    el.shadowRoot!.querySelector('[part="viewport"]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const event = (await listener) as CustomEvent<{
      text: string;
      anchor: { kind: string; start: number; end: number } | null;
      rects: readonly { x: number; y: number; width: number; height: number }[];
    }>;
    expect(event.detail.text).to.be.a('string').and.not.equal('');
    expect(event.detail.anchor).to.deep.equal({ kind: 'line-range', start: 1, end: 2 });
    expect(event.detail.rects).to.have.lengthOf(1);
    expect(event.detail.rects[0]).not.to.equal(sourceRect);
    expect(event.detail.rects[0]).to.include({ x: 1, y: 2, width: 3, height: 4 });
    expect(Object.isFrozen(event.detail)).to.be.true;
    expect(Object.isFrozen(event.detail.anchor)).to.be.true;
    expect(Object.isFrozen(event.detail.rects)).to.be.true;
    expect(Object.isFrozen(event.detail.rects[0])).to.be.true;
  });

  it('does not emit lr-text-select when nothing is selected (collapsed selection)', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('only line');
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lr-text-select', () => (fired = true));
    el.shadowRoot!.querySelector('[part="viewport"]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fired).to.be.false;
  });

  it('contains a platform selection that reports content but exposes no readable range', async () => {
    const el = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
    el.write('selected output');
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const fakeSelection = {
      isCollapsed: false,
      getRangeAt: () => { throw new Error('range unavailable'); },
    } as unknown as Selection;
    (list.shadowRoot as unknown as { getSelection: () => Selection }).getSelection = () => fakeSelection;
    let selections = 0;
    el.addEventListener('lr-text-select', () => selections++);

    el.shadowRoot!.querySelector('[part="viewport"]')!.dispatchEvent(
      new PointerEvent('pointerup', { bubbles: true }),
    );

    expect(selections).to.equal(0);
  });

  it('honors a .strings override for terminalLabel', async () => {
    const el = (await fixture(
      html`<lr-terminal .strings=${{ terminalLabel: 'Console de sortie' }}></lr-terminal>`,
    )) as LyraTerminal;
    expect(el.shadowRoot!.querySelector('[part="viewport"]')!.getAttribute('aria-label')).to.equal(
      'Console de sortie',
    );
  });

  it('is accessible with content, copy/download buttons, and a highlight set', async () => {
    const el = (await fixture(
      html`<lr-terminal copyable downloadable></lr-terminal>`,
    )) as LyraTerminal;
    el.write('line one\nline two');
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 1 } }];
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('scrollToBottom() sets the virtual-list scroll target to the last buffered line even while follow is off', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.follow = false; // keep write() itself from moving the scroll target
    el.write('a\nb\nc');
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { activeItemId: unknown };
    expect(list.activeItemId).to.equal('');
    el.scrollToBottom();
    await el.updateComplete;
    expect(list.activeItemId).to.equal(3);
  });

  it('scrollToBottom() on an empty buffer clears the scroll target instead of throwing', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.scrollToBottom();
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { activeItemId: unknown };
    expect(list.activeItemId).to.equal('');
  });

  it('the "jump to latest" button re-engages follow, scrolls to the last line, and emits lr-follow-change', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a\nb\nc');
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { activeItemId: unknown };
    const released = oneEvent(el, 'lr-follow-change');
    list.dispatchEvent(new CustomEvent('lr-visible-range-change', {
      detail: { start: 0, end: 0 },
      bubbles: true,
      composed: true,
    }));
    expect((await released as CustomEvent<{ following: boolean }>).detail.following).to.be.false;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="jump-to-latest"]') as HTMLButtonElement;
    expect((button) != null).to.equal(true);
    const listener = oneEvent(el, 'lr-follow-change');
    button.click();
    const event = (await listener) as CustomEvent<{ following: boolean }>;
    expect(event.detail.following).to.be.true;
    expect(el.follow).to.be.true;
    expect(list.activeItemId).to.equal(3);
  });

  it('pressing End in the viewport re-engages follow via the same jump-to-latest path', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a\nb');
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const released = oneEvent(el, 'lr-follow-change');
    list.dispatchEvent(new CustomEvent('lr-visible-range-change', {
      detail: { start: 0, end: 0 },
      bubbles: true,
      composed: true,
    }));
    expect((await released as CustomEvent<{ following: boolean }>).detail.following).to.be.false;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-follow-change');
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]')!;
    viewport.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    const event = (await listener) as CustomEvent<{ following: boolean }>;
    expect(event.detail.following).to.be.true;
    expect(el.follow).to.be.true;
  });

  it('write() recomputes search matches when scrollback trimming drops a matched line, clamping an out-of-range active index', async () => {
    const el = (await fixture(html`<lr-terminal max-scrollback="3"></lr-terminal>`)) as LyraTerminal;
    el.write('error\nerror\nerror');
    await el.updateComplete;
    await el.search('error');
    el.searchNext();
    el.searchNext();
    const priv = el as unknown as { searchActiveIndex: number; searchMatches: { lineNumber: number }[] };
    expect(priv.searchActiveIndex).to.equal(2);
    el.write('\nx'); // trims line 1 ('error') out of the 3-line scrollback -- searchQuery is
    // still set at this point, so this write() also exercises the writeInternal() recompute path.
    await el.updateComplete;
    expect(priv.searchMatches).to.have.lengthOf(2);
    expect(priv.searchActiveIndex).to.equal(0); // clamped back into range rather than left dangling at 2
  });

  it('write() clears the active search index to -1 when scrollback trimming removes the last remaining match', async () => {
    const el = (await fixture(html`<lr-terminal max-scrollback="1"></lr-terminal>`)) as LyraTerminal;
    el.write('error');
    await el.updateComplete;
    await el.search('error');
    const priv = el as unknown as { searchActiveIndex: number; searchMatches: { lineNumber: number }[] };
    expect(priv.searchActiveIndex).to.equal(0);
    el.write('\nx'); // trims the only 'error' line out of the 1-line scrollback
    await el.updateComplete;
    expect(priv.searchMatches).to.have.lengthOf(0);
    expect(priv.searchActiveIndex).to.equal(-1);
  });

  it('Enter or Space on a highlighted line activates it, same as a click', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a\nb\nc');
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 2, end: 2 }, tone: 'warning' }];
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const line = list.shadowRoot!.querySelector('[data-line-number="2"]') as HTMLElement;
    const enterListener = oneEvent(el, 'lr-highlight-activate');
    line.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(((await enterListener) as CustomEvent<{ highlightId: string }>).detail.highlightId)
      .to.equal('h1');
    const spaceListener = oneEvent(el, 'lr-highlight-activate');
    line.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(((await spaceListener) as CustomEvent<{ highlightId: string }>).detail.highlightId)
      .to.equal('h1');
  });

  it('a synchronously-throwing clipboard write emits failure without false success', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: () => {
          throw new Error('denied');
        },
      },
    });
    try {
      const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
      el.write('secret');
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      let copies = 0;
      el.addEventListener('lr-copy', () => { copies += 1; });
      const errorListener = oneEvent(el, 'lr-copy-error');
      button.click();
      const errorEvent = (await errorListener) as CustomEvent<{ ok: false; text: string; reason: string; error: unknown }>;
      expect(errorEvent.detail.ok).to.equal(false);
      expect(errorEvent.detail.text).to.equal('secret');
      expect(errorEvent.detail.reason).to.equal('failed');
      expect(copies).to.equal(0);
      await el.updateComplete;
      expect(button.textContent!.trim()).to.equal('Copy failed');
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    }
  });

  it('copy button label swaps to the localized "copied" confirmation, then reverts after ~1.5s', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
    try {
      const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
      el.write('hi');
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      expect(button.textContent!.trim()).to.equal('Copy');
      button.click();
      await settleClipboard(el);
      expect(button.textContent!.trim()).to.equal('Copied!');
      await new Promise((resolve) => setTimeout(resolve, 1600));
      await el.updateComplete;
      expect(button.textContent!.trim()).to.equal('Copy');
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else Reflect.deleteProperty(navigator, 'clipboard');
    }
  });

  it('coalesces multiple write() bursts inside one throttle window into a single announcement', async () => {
    const el = (await fixture(html`<lr-terminal announce-output></lr-terminal>`)) as LyraTerminal;
    el.write('first chunk');
    el.write('second chunk');
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 20)); // Announcer's own throttle uses real timers
    const region = el.shadowRoot!.querySelector('[part="announcer"]')!;
    expect(region.textContent).to.equal('first chunk\nsecond chunk');
  });

  it('announces the visible logical output without ANSI or editing control sequences', async () => {
    const el = await fixture<LyraTerminal>(html`<lr-terminal announce-output></lr-terminal>`);
    el.write('\x1b[31mabc\rX\tY\bZ\x1b[0m');
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 20));
    const visible = 'Xbc     Z';
    expect(el.getPlainText()).to.equal(visible);
    expect(el.shadowRoot!.querySelector('[part="announcer"]')!.textContent).to.equal(visible);
    expect(el.shadowRoot!.querySelector('[part="announcer"]')!.textContent).not.to.match(/[\u001b\r\t\b]/);
  });

  it('cancels queued output when clear(), content replacement, or announce-output=false invalidates it', async () => {
    const el = (await fixture(html`<lr-terminal announce-output></lr-terminal>`)) as LyraTerminal;
    const region = el.shadowRoot!.querySelector('[part="announcer"]')!;

    el.write('cleared before speech');
    el.clear();
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(region.textContent).to.equal('');

    el.write('stale before replacement');
    el.content = 'replacement output';
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(region.textContent).to.equal('replacement output');

    region.textContent = '';
    el.write('disabled before speech');
    el.announceOutput = false;
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(region.textContent).to.equal('');
  });

  it('lr-text-select resolves a null anchor when a selection endpoint is not inside any mounted line', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('first\nsecond');
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    // A selection whose endpoints don't resolve to any [data-line-number] ancestor (landing on
    // <lr-virtual-list>'s own row/spacer scaffolding, or entirely outside the viewport) can't be
    // walked back to a line number by lineNumberOf(). Exercised via a stand-in Selection rather
    // than a real Range/addRange() at an element (non-text) boundary -- Chromium's Selection
    // doesn't reliably preserve such a boundary's exact container across addRange(), so a real
    // selection can't deterministically reproduce this case.
    const outside = document.createTextNode('outside text');
    const range = document.createRange();
    range.setStart(outside, 0);
    range.setEnd(outside, outside.data.length);
    const fakeSelection = {
      isCollapsed: false,
      anchorNode: document.body,
      focusNode: document.body,
      getRangeAt: () => range,
    } as unknown as Selection;
    (list.shadowRoot as unknown as { getSelection: () => Selection }).getSelection = () => fakeSelection;
    const listener = oneEvent(el, 'lr-text-select');
    el.shadowRoot!.querySelector('[part="viewport"]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const event = (await listener) as CustomEvent<{ text: string; anchor: unknown }>;
    expect(event.detail.text).to.equal('outside text');
    expect(event.detail.anchor).to.be.null;
  });

  it('lr-text-select falls back to empty rects when reading the selection range throws', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('first\nsecond');
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const line = list.shadowRoot!.querySelector('[data-line-number="1"]') as HTMLElement;
    const range = document.createRange();
    range.selectNodeContents(line);
    Object.defineProperty(range, 'getClientRects', {
      configurable: true,
      value: () => { throw new Error('no rects'); },
    });
    const fakeSelection = {
      isCollapsed: false,
      anchorNode: line,
      focusNode: line,
      getRangeAt: () => range,
    } as unknown as Selection;
    (list.shadowRoot as unknown as { getSelection: () => Selection }).getSelection = () => fakeSelection;
    const listener = oneEvent(el, 'lr-text-select');
    el.shadowRoot!.querySelector('[part="viewport"]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const event = (await listener) as CustomEvent<{ text: string; rects: readonly DOMRectReadOnly[] }>;
    expect(event.detail.text).to.equal('first');
    expect(event.detail.rects).to.deep.equal([]);
  });

  it('renders bold/dim/italic/underline/inverse SGR styles, including inverse swapping fg/bg', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write(
      '\x1b[1mbold\x1b[22m\x1b[2mdim\x1b[22m\x1b[3mitalic\x1b[23m\x1b[4munderline\x1b[24m\x1b[7;41minverse\x1b[0m',
    );
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const spans = [...list.shadowRoot!.querySelectorAll('[data-line-number="1"] span')] as HTMLElement[];
    const byText = (t: string): HTMLElement => spans.find((s) => s.textContent === t)!;
    expect(byText('bold').style.fontWeight).to.equal('bold');
    expect(byText('dim').style.opacity).to.equal('0.7');
    expect(byText('italic').style.fontStyle).to.equal('italic');
    expect(byText('underline').style.textDecoration).to.equal('underline');
    const inverse = byText('inverse');
    // \x1b[41m set an explicit background (red); inverse swaps it into `color`, and the unset
    // foreground's own fallback var into `background-color`.
    expect(inverse.style.color).to.equal('var(--lr-terminal-bg-red)');
    expect(inverse.style.backgroundColor).to.equal('var(--lr-color-text)');
  });

  it('uses the terminal surface as inverse foreground when no explicit background exists', async () => {
    const el = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
    el.write('\x1b[7minverse-default\x1b[0m');
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const segment = list.shadowRoot!.querySelector<HTMLElement>('[data-line-number="1"] span')!;
    expect(segment.style.color).to.equal('var(--lr-terminal-surface-color, var(--lr-color-surface-raised))');
    expect(segment.style.backgroundColor).to.equal('var(--lr-color-text)');
  });

  it('omits the toolbar entirely when both copyable and downloadable are false', async () => {
    const el = (await fixture(
      html`<lr-terminal .copyable=${false} .downloadable=${false}></lr-terminal>`,
    )) as LyraTerminal;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="toolbar"]')) === null).to.be.true;
  });

  it('renders only the download button when copyable is false and downloadable is true', async () => {
    const el = (await fixture(html`<lr-terminal .copyable=${false} downloadable></lr-terminal>`)) as LyraTerminal;
    await el.updateComplete;
    expect((el.shadowRoot!.querySelector('[part="copy-button"]')) === null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="download-button"]')).to.exist;
  });

  it('wrap=false uses a fixed 24px row-height on the virtual list instead of "auto"', async () => {
    const el = (await fixture(html`<lr-terminal .wrap=${false}></lr-terminal>`)) as LyraTerminal;
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    expect(list.getAttribute('row-height')).to.equal('24');
  });

  it('wrap=false makes the painted line span its full horizontal scroll extent', async () => {
    const container = document.createElement('div');
    container.style.inlineSize = '320px';
    const el = await fixture<LyraTerminal>(html`
      <lr-terminal .wrap=${false} .highlights=${[
        { id: 'long', anchor: { kind: 'line-range', start: 1 }, tone: 'danger' },
      ]}></lr-terminal>
    `, { parentNode: container });
    el.write('unbroken'.repeat(200));
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const line = list.shadowRoot!.querySelector<HTMLElement>('[data-line-number="1"]')!;
    expect(line.getBoundingClientRect().width).to.be.greaterThan(320);
    expect(Math.abs(line.getBoundingClientRect().width - line.scrollWidth)).to.be.lessThan(2);
  });

  it('exports the virtualized line part so a consumer stylesheet reaches it', async () => {
    // `line` is rendered inside <lr-virtual-list>'s own shadow root, two hops from a consumer:
    // without exportparts on that element, lr-terminal::part(line) matches nothing at all.
    const style = document.createElement('style');
    style.textContent = 'lr-terminal::part(line) { padding-block-start: 3px; }';
    document.head.append(style);
    try {
      const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
      el.content = 'alpha\nbravo';
      await el.updateComplete;
      const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
      const line = list.shadowRoot!.querySelector('[part="line"]') as HTMLElement;
      expect(line.getAttribute('data-line-number')).to.equal('1');
      expect(getComputedStyle(line).paddingBlockStart).to.equal('3px');
    } finally {
      style.remove();
    }
  });

  // These :focus-visible assertions are real-input-modality sensitive (Chromium tracks a
  // page-global "last focus trigger" and only matches :focus-visible on a programmatic .focus()
  // when that trigger isn't mouse/touch), so they run BEFORE the sendMouse `{ type: 'down' }`
  // press below: that command is a real, trusted mousedown on a focusable <button>, which is
  // exactly the kind of interaction that flips the page's modality to mouse for the rest of this
  // file's test run. Ordered this way, this suite never depends on that flag getting reset.
  for (const part of ['copy-button', 'download-button', 'jump-to-latest']) {
    it(`gives ${part} a visible :focus-visible outline, matching its :hover/:active treatment`, async () => {
      const el = (await fixture(html`<lr-terminal downloadable></lr-terminal>`)) as LyraTerminal;
      // jump-to-latest only renders once the viewport has stopped following the tail -- see the
      // hover/press test below for why `follow` is set only after this settling delay.
      el.write('a\nb\nc');
      await el.updateComplete;
      await aTimeout(100);
      el.follow = false;
      await el.updateComplete;
      const button = el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLButtonElement;
      expect((button) != null, `${part} must be rendered for this fixture`).to.equal(true);
      button.focus();
      expect(getComputedStyle(button).outlineStyle, `${part} :focus-visible outlineStyle`).to.equal('solid');
      expect(getComputedStyle(button).outlineWidth, `${part} :focus-visible outlineWidth`).to.equal('2px');
    });
  }

  it('gives an interactive (highlight-owning) line a visible :focus-visible outline', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a\nb\nc');
    // No tone: a toned highlight sets its background inline (styleMap), which would mask the
    // CSS hover/focus-visible background below it under the same specificity rules the class
    // doc's `lineStateStyle` comment already spells out for this component.
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 2, end: 2 } }];
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const line = list.shadowRoot!.querySelector('[data-line-number="2"]') as HTMLElement;
    expect(line.getAttribute('tabindex')).to.equal('0');
    line.focus();
    expect(getComputedStyle(line).outlineStyle, 'line :focus-visible outlineStyle').to.equal('solid');
    expect(getComputedStyle(line).outlineWidth, 'line :focus-visible outlineWidth').to.equal('2px');
  });

  for (const part of ['copy-button', 'download-button', 'jump-to-latest']) {
    it(`tints ${part} on hover, and further again while pressed`, async () => {
      const el = (await fixture(html`<lr-terminal downloadable></lr-terminal>`)) as LyraTerminal;
      // jump-to-latest only renders once the viewport has stopped following the tail. `follow` is
      // set only after the virtual list's own initial visible-range events have settled: those
      // re-derive `follow` from whether the last line is on screen, so an earlier assignment gets
      // silently undone a few milliseconds later and the pill disappears mid-test.
      el.write('a\nb\nc');
      await el.updateComplete;
      await aTimeout(100);
      el.follow = false;
      await el.updateComplete;
      // Re-queried on every read rather than captured once: this component re-renders while the
      // pointer commands are in flight (each is a real round-trip through the test runner), and a
      // getComputedStyle() call against a node Lit has already swapped out returns '' for every
      // property -- which reads as "hover did nothing" instead of failing honestly.
      const button = (): HTMLButtonElement =>
        el.shadowRoot!.querySelector(`[part="${part}"]`) as HTMLButtonElement;
      expect((button()) != null, `${part} must be rendered for this fixture`).to.equal(true);
      // sendMouse positions are window coordinates, so a target below the fold is simply
      // unreachable — the pointer lands on nothing and the test reports "hover did nothing". The
      // jump-to-latest pill sits at the far bottom of a 20rem viewport and hits exactly that.
      button().scrollIntoView({ block: 'center' });
      const rect = button().getBoundingClientRect();
      const centre: [number, number] = [
        Math.round(rect.left + rect.width / 2),
        Math.round(rect.top + rect.height / 2),
      ];
      const rest = getComputedStyle(button()).backgroundColor;
      try {
        await sendMouse({ type: 'move', position: centre });
        const hovered = getComputedStyle(button()).backgroundColor;
        await sendMouse({ type: 'down' });
        const pressed = getComputedStyle(button()).backgroundColor;
        await sendMouse({ type: 'up' });
        expect(hovered, 'hover must move the fill off its resting colour').to.not.equal(rest);
        expect(pressed, 'pressed must be visibly stronger than hover, not identical to it').to.not.equal(
          hovered,
        );
        expect(pressed).to.not.equal(rest);
      } finally {
        await resetMouse();
      }
    });
  }

  it('tints an interactive (highlight-owning) line on hover', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a\nb\nc');
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 2, end: 2 } }];
    await el.updateComplete;
    // Matches the copy/download/jump-to-latest hover tests above: the virtual list's own
    // initial visible-range/row-measurement events are still settling right after write(), and
    // an early getBoundingClientRect() races that settling -- the row can shift under the
    // pointer between this capture and sendMouse's round trip, landing the hover on nothing.
    await aTimeout(100);
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const line = (): HTMLElement => list.shadowRoot!.querySelector('[data-line-number="2"]') as HTMLElement;
    line().scrollIntoView({ block: 'center' });
    const rect = line().getBoundingClientRect();
    const centre: [number, number] = [
      Math.round(rect.left + rect.width / 2),
      Math.round(rect.top + rect.height / 2),
    ];
    const rest = getComputedStyle(line()).backgroundColor;
    try {
      await sendMouse({ type: 'move', position: centre });
      const hovered = getComputedStyle(line()).backgroundColor;
      expect(hovered, 'hover must move the fill off its resting colour').to.not.equal(rest);
    } finally {
      await resetMouse();
    }
  });

  it('preserves a semantic danger highlight through real pointer hover', async () => {
    const el = await fixture<LyraTerminal>(html`<lr-terminal></lr-terminal>`);
    el.write('danger line');
    el.highlights = [{ id: 'danger', anchor: { kind: 'line-range', start: 1 }, tone: 'danger' }];
    await el.updateComplete;
    await aTimeout(100);
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    const line = list.shadowRoot!.querySelector<HTMLElement>('[data-line-number="1"]')!;
    expect(line.getAttribute('part')).to.contain('line-highlight-danger');
    line.scrollIntoView({ block: 'center' });
    const rect = line.getBoundingClientRect();
    const rest = getComputedStyle(line).backgroundColor;
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      expect(getComputedStyle(line).backgroundColor).to.equal(rest);
    } finally {
      await resetMouse();
    }
  });
});

it('normalizes duplicate highlight ids first-wins before line ownership', async () => {
  const el = await fixture<LyraTerminal>(html`
    <lr-terminal
      .content=${'first\nsecond'}
      .highlights=${[
        { id: 'same', anchor: { kind: 'line-range', start: 1 }, tone: 'success' },
        { id: 'same', anchor: { kind: 'line-range', start: 2 }, tone: 'danger' },
      ] satisfies LyraHighlight[]}
    ></lr-terminal>
  `);
  const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
  const first = list.shadowRoot!.querySelector<HTMLElement>('[data-line-number="1"]')!;
  const second = list.shadowRoot!.querySelector<HTMLElement>('[data-line-number="2"]')!;
  expect(first.getAttribute('part')).to.contain('line-highlight-success');
  expect(second.getAttribute('part')).not.to.contain('line-highlight-danger');
});

it('searchNext/searchPrevious resolve a boolean, matching the shared viewer search contract', async () => {
  // `internal/text-viewer-target.ts`'s `LyraTextViewerTarget` declares both as
  // `Promise<boolean>`. These returned `void`, so a host driving several viewers through that one
  // typed surface -- `if (await viewer.searchNext())` -- got `undefined` here and took the
  // "nothing to move to" branch on every press, while every other viewer returned a real boolean.
  const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('error: bad\ninfo: ok\nerror: worse');
    await el.updateComplete;
  await el.updateComplete;

  expect(await el.search('error')).to.be.greaterThan(0);
  expect(await el.searchNext(), 'moved to the next match').to.be.true;
  expect(await el.searchPrevious(), 'moved to the previous match').to.be.true;

  expect(await el.search('__definitely_absent__')).to.equal(0);
  expect(await el.searchNext(), 'no matches to move to').to.be.false;
  expect(await el.searchPrevious(), 'no matches to move to').to.be.false;
});

describe('compact / frame escape hatches', () => {
  // A terminal is routinely nested inside another bordered container (an lr-agent-run panel, a
  // message bubble) -- the same embedded-in-a-transcript positioning its agent-tools siblings
  // lr-result-card, lr-stack-trace, lr-task-list, and lr-thinking-panel all expose `compact` +
  // `frame="plain"` for. Without them the outer border/background doubles with no opt-out.
  const LOG = 'first line\nsecond line\nthird line';

  function base(el: LyraTerminal): HTMLElement {
    return el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  }

  function toolbar(el: LyraTerminal): HTMLElement {
    return el.shadowRoot!.querySelector('[part="toolbar"]') as HTMLElement;
  }

  /** The rendered lines live inside <lr-virtual-list>'s own shadow root (see the class doc's
   *  `line` csspart note), and the list's initial range/row measurement is still settling right
   *  after a write -- the same wait idiom the hover tests above use. */
  async function firstLine(el: LyraTerminal): Promise<HTMLElement> {
    await aTimeout(100);
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    return list.shadowRoot!.querySelector('[data-line-number="1"]') as HTMLElement;
  }

  it('defaults to compact=false and frame="card", keeping the card chrome', async () => {
    const el = (await fixture(html`<lr-terminal .content=${LOG}></lr-terminal>`)) as LyraTerminal;
    expect(el.compact).to.be.false;
    expect(el.frame).to.equal('card');
    expect(el.hasAttribute('compact')).to.be.false;
    expect(el.getAttribute('frame')).to.equal('card');
    const style = getComputedStyle(base(el));
    expect(style.borderTopStyle).to.equal('solid');
    expect(Number.parseFloat(style.borderTopWidth)).to.be.greaterThan(0);
    expect(Number.parseFloat(style.borderTopLeftRadius)).to.be.greaterThan(0);
    expect(style.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it('tightens the toolbar padding and gap under compact, behind retunable cssprops', async () => {
    const regular = (await fixture(
      html`<lr-terminal downloadable .content=${LOG}></lr-terminal>`,
    )) as LyraTerminal;
    const compact = (await fixture(
      html`<lr-terminal compact downloadable .content=${LOG}></lr-terminal>`,
    )) as LyraTerminal;
    expect(compact.hasAttribute('compact')).to.be.true;

    const regularStyle = getComputedStyle(toolbar(regular));
    const compactStyle = getComputedStyle(toolbar(compact));
    expect(Number.parseFloat(compactStyle.paddingBlockStart)).to.be.lessThan(
      Number.parseFloat(regularStyle.paddingBlockStart),
    );
    expect(Number.parseFloat(compactStyle.paddingInlineStart)).to.be.lessThan(
      Number.parseFloat(regularStyle.paddingInlineStart),
    );
    expect(Number.parseFloat(compactStyle.columnGap)).to.be.lessThan(
      Number.parseFloat(regularStyle.columnGap),
    );

    // Behind inline var() fallbacks, so a transcript can retune every nested terminal at once
    // without restating the rule.
    compact.style.setProperty('--lr-terminal-compact-toolbar-padding', '1px 2px');
    compact.style.setProperty('--lr-terminal-compact-toolbar-gap', '3px');
    const retuned = getComputedStyle(toolbar(compact));
    expect(retuned.paddingBlockStart).to.equal('1px');
    expect(retuned.paddingInlineStart).to.equal('2px');
    expect(retuned.columnGap).to.equal('3px');

    // compact is a density knob, not a chrome knob -- the card border and background stay.
    expect(getComputedStyle(base(compact)).borderTopStyle).to.equal('solid');
    expect(getComputedStyle(base(compact)).backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it("tightens each rendered line's inline padding under compact, behind a retunable cssprop", async () => {
    const regular = (await fixture(html`<lr-terminal .content=${LOG}></lr-terminal>`)) as LyraTerminal;
    const compact = (await fixture(
      html`<lr-terminal compact .content=${LOG}></lr-terminal>`,
    )) as LyraTerminal;
    const regularPadding = Number.parseFloat(
      getComputedStyle(await firstLine(regular)).paddingInlineStart,
    );
    const compactLine = await firstLine(compact);
    expect(Number.parseFloat(getComputedStyle(compactLine).paddingInlineStart)).to.be.lessThan(
      regularPadding,
    );

    compact.style.setProperty('--lr-terminal-compact-line-padding-inline', '4px');
    expect(getComputedStyle(compactLine).paddingInlineStart).to.equal('4px');
  });

  it('drops the border, radius, and background under frame="plain", keeping the toolbar divider', async () => {
    const el = (await fixture(
      html`<lr-terminal frame="plain" downloadable .content=${LOG}></lr-terminal>`,
    )) as LyraTerminal;
    const style = getComputedStyle(base(el));
    expect(Number.parseFloat(style.borderTopWidth)).to.equal(0);
    expect(Number.parseFloat(style.borderTopLeftRadius)).to.equal(0);
    expect(style.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    // The toolbar/log divider is interior structure, not outer chrome -- same call task-list and
    // thinking-panel make for their own header/body divider.
    expect(Number.parseFloat(getComputedStyle(toolbar(el)).borderBlockEndWidth)).to.be.greaterThan(0);
  });

  it('restores the card chrome when frame goes back to "card"', async () => {
    const el = (await fixture(html`<lr-terminal .content=${LOG}></lr-terminal>`)) as LyraTerminal;
    el.frame = 'plain';
    await el.updateComplete;
    expect(Number.parseFloat(getComputedStyle(base(el)).borderTopWidth)).to.equal(0);
    el.frame = 'card';
    await el.updateComplete;
    expect(Number.parseFloat(getComputedStyle(base(el)).borderTopWidth)).to.be.greaterThan(0);
  });

  it('is accessible in the populated compact and plain states', async () => {
    const compact = await fixture(
      html`<lr-terminal compact downloadable .content=${LOG}></lr-terminal>`,
    );
    await expect(compact).to.be.accessible();
    const plain = await fixture(
      html`<lr-terminal frame="plain" downloadable .content=${LOG}></lr-terminal>`,
    );
    await expect(plain).to.be.accessible();
  });
});
