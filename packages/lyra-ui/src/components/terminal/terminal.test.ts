import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './terminal.js';
import type { LyraTerminal } from './terminal.js';

describe('lyra-terminal', () => {
  it('defaults to follow=true, wrap=true, copyable=true, maxScrollback=5000', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    expect(el.follow).to.be.true;
    expect(el.wrap).to.be.true;
    expect(el.copyable).to.be.true;
    expect(el.maxScrollback).to.equal(5000);
  });

  it('renders content as plain lines and getPlainText() returns the SGR-stripped text', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    el.content = 'line one\n\x1b[31mline two\x1b[0m';
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('line one\nline two');
  });

  it('write() appends without resetting scrollback, unlike reassigning content', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    el.content = 'first\n';
    await el.updateComplete;
    el.write('second');
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('first\nsecond');
    el.content = 'reset';
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('reset');
  });

  it('\\r moves the write cursor to line start so following text overwrites (progress bar)', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    el.write('50%\rdone!');
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('done!');
  });

  it('\\b steps back one cell and \\t advances to 8-column stops', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    el.write('abc\bX');
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('abX');
    const tabEl = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    tabEl.write('ab\tX');
    await tabEl.updateComplete;
    expect(tabEl.getPlainText()).to.equal('ab      X');
  });

  it('trims scrollback to maxScrollback, keeping absolute (1-based) line numbers', async () => {
    const el = (await fixture(html`<lyra-terminal max-scrollback="3"></lyra-terminal>`)) as LyraTerminal;
    el.write('l1\nl2\nl3\nl4\nl5');
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('l3\nl4\nl5');
    const found = await el.scrollToAnchor({ kind: 'line-range', start: 1 });
    expect(found).to.be.false; // trimmed line -- no longer resolvable
    const stillThere = await el.scrollToAnchor({ kind: 'line-range', start: 4 });
    expect(stillThere).to.be.true;
  });

  it('normalizes an invalid max-scrollback (negative, NaN, or fractional) instead of trusting it directly', async () => {
    const negative = (await fixture(html`<lyra-terminal max-scrollback="-5"></lyra-terminal>`)) as LyraTerminal;
    negative.write('l1\nl2\nl3');
    await negative.updateComplete;
    // A negative limit still keeps at least the most-recently-appended line (the same 1-line
    // floor the pre-existing ad hoc guard already enforced) rather than trimming everything away.
    expect(negative.getPlainText()).to.equal('l3');

    const fractional = (await fixture(html`<lyra-terminal max-scrollback="3.9"></lyra-terminal>`)) as LyraTerminal;
    fractional.write('l1\nl2\nl3\nl4\nl5');
    await fractional.updateComplete;
    expect(fractional.getPlainText()).to.equal('l3\nl4\nl5');

    const nan = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    nan.maxScrollback = NaN;
    nan.write('l1\nl2\nl3\nl4\nl5\nl6');
    await nan.updateComplete;
    // NaN falls back to the 5000-line default, not to a 1-line floor.
    expect(nan.getPlainText()).to.equal('l1\nl2\nl3\nl4\nl5\nl6');
  });

  it('clear() resets scrollback and parser state', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    el.write('\x1b[31msome text');
    await el.updateComplete;
    el.clear();
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('');
    el.write('fresh');
    await el.updateComplete;
    expect(el.getPlainText()).to.equal('fresh');
  });

  it('copy button emits lyra-copy with the SGR-stripped plain text', async () => {
    const el = (await fixture(html`<lyra-terminal copyable></lyra-terminal>`)) as LyraTerminal;
    el.write('\x1b[31mred\x1b[0m plain');
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lyra-copy');
    button.click();
    const event = (await listener) as CustomEvent<{ text: string }>;
    expect(event.detail.text).to.equal('red plain');
  });

  it('download button emits lyra-download with the configured filename', async () => {
    const el = (await fixture(
      html`<lyra-terminal downloadable filename="out.log"></lyra-terminal>`,
    )) as LyraTerminal;
    el.write('hi');
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="download-button"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lyra-download');
    button.click();
    const event = (await listener) as CustomEvent<{ filename: string }>;
    expect(event.detail.filename).to.equal('out.log');
  });

  it('search() resolves match count and lyra-search-change reports query/matchCount/activeIndex', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    el.write('error: bad\ninfo: ok\nerror: worse');
    await el.updateComplete;
    const listener = oneEvent(el, 'lyra-search-change');
    const count = await el.search('error');
    expect(count).to.equal(2);
    const event = (await listener) as CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
    expect(event.detail).to.deep.equal({ query: 'error', matchCount: 2, activeIndex: 0 });
  });

  it('searchNext()/searchPrevious() wrap around the match list', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    el.write('a\nb\na');
    await el.updateComplete;
    await el.search('a');
    el.searchNext();
    let active = -1;
    el.addEventListener('lyra-search-change', (e) => {
      active = (e as CustomEvent<{ activeIndex: number }>).detail.activeIndex;
    });
    el.searchNext();
    expect(active).to.equal(0); // wrapped from index 1 back to 0
    el.searchPrevious();
    expect(active).to.equal(1);
  });

  it('clearSearch() clears matches and emits a zero-count lyra-search-change', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    el.write('error');
    await el.updateComplete;
    await el.search('error');
    const listener = oneEvent(el, 'lyra-search-change');
    el.clearSearch();
    const event = (await listener) as CustomEvent<{ matchCount: number }>;
    expect(event.detail.matchCount).to.equal(0);
  });

  it('scrolling away from the bottom disengages follow and emits lyra-follow-change', async () => {
    const el = (await fixture(
      html`<div style="height:60px;display:block"><lyra-terminal></lyra-terminal></div>`,
    )) as HTMLDivElement;
    const term = el.querySelector('lyra-terminal') as LyraTerminal;
    // Kept well under lyra-virtual-list's own row-height="auto" per-row ResizeObserver measurement
    // batch that (independent of lyra-terminal -- reproducible with a bare <lyra-virtual-list>
    // rendering this many freshly-added rows at once) triggers the browser's real "ResizeObserver
    // loop completed with undelivered notifications" report above roughly 20-25 rows in one go.
    for (let i = 0; i < 15; i++) term.write(`line ${i}\n`);
    await term.updateComplete;
    const list = term.shadowRoot!.querySelector('lyra-virtual-list')!;
    // Real per-row measurement keeps settling asynchronously for a few more frames after
    // updateComplete resolves, each capable of firing its own genuine `lyra-visible-range-changed`
    // -- letting it fully settle first, before registering the listener and dispatching the mocked
    // range below, avoids a late genuine event racing the mocked one (this component reacts to
    // virtual-list's real range exactly the same way it reacts to a mocked one, so whichever lands
    // last wins the assertion).
    await new Promise((resolve) => setTimeout(resolve, 100));
    const listener = oneEvent(term, 'lyra-follow-change');
    list.dispatchEvent(new CustomEvent('lyra-visible-range-changed', { detail: { start: 0, end: 3 }, bubbles: true, composed: true }));
    const event = (await listener) as CustomEvent<{ following: boolean }>;
    expect(event.detail.following).to.be.false;
    expect(term.follow).to.be.false;
  });

  it('accessible label defaults to the localized terminalLabel and honors aria-label override', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]')!;
    expect(viewport.getAttribute('role')).to.equal('log');
    expect(viewport.getAttribute('aria-label')).to.be.a('string').and.not.equal('');
    const labeled = (await fixture(html`<lyra-terminal aria-label="Build output"></lyra-terminal>`)) as LyraTerminal;
    expect(labeled.shadowRoot!.querySelector('[part="viewport"]')!.getAttribute('aria-label')).to.equal(
      'Build output',
    );
  });

  it('renders a line-range highlight with data-highlight-tone and emits lyra-highlight-activate on click', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    el.write('a\nb\nc');
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 2, end: 2 }, tone: 'warning' }];
    await el.updateComplete;
    // Rendered lines live inside <lyra-virtual-list>'s own shadow root (it's the renderItem
    // delegate's real render root, not this component's) -- reach one level in to find them.
    const list = el.shadowRoot!.querySelector('lyra-virtual-list')!;
    const line = list.shadowRoot!.querySelector('[data-line-number="2"]') as HTMLElement;
    expect(line.getAttribute('data-highlight-tone')).to.equal('warning');
    const listener = oneEvent(el, 'lyra-highlight-activate');
    line.click();
    const event = (await listener) as CustomEvent<{ id: string }>;
    expect(event.detail.id).to.equal('h1');
  });

  it('scrollToAnchor resolves a highlight id and a line-range anchor', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    el.write('a\nb\nc');
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 3 } }];
    await el.updateComplete;
    expect(await el.scrollToAnchor('h1')).to.be.true;
    expect(await el.scrollToAnchor({ kind: 'line-range', start: 99 })).to.be.false;
  });

  it('announce-output routes appended text into the visually-hidden announcer region', async () => {
    const el = (await fixture(html`<lyra-terminal announce-output></lyra-terminal>`)) as LyraTerminal;
    el.write('build started');
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 20)); // Announcer's own throttle uses real timers
    const region = el.shadowRoot!.querySelector('[part="announcer"]')!;
    expect(region.getAttribute('role')).to.equal('status');
    expect(region.textContent).to.equal('build started');
  });

  it('does not populate the announcer region when announce-output is left off (default)', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    el.write('quiet output');
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(el.shadowRoot!.querySelector('[part="announcer"]')!.textContent).to.equal('');
  });

  it('emits lyra-text-select with a resolved line-range anchor when a selection lands inside two mounted lines', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    el.write('first\nsecond\nthird');
    await el.updateComplete;
    // Rendered lines live inside <lyra-virtual-list>'s own shadow root -- see the equivalent note
    // in the highlight-activate test above.
    const list = el.shadowRoot!.querySelector('lyra-virtual-list')!;
    const lines = [...list.shadowRoot!.querySelectorAll('[data-line-number]')];
    // Lit inserts a static per-expression marker comment before the dynamic text node it commits
    // (visible via `<span><!--?lit$...--> the actual text</span>`), so the real Text node is not
    // reliably `firstChild` -- find it directly instead of assuming a fixed sibling position.
    const textNodeOf = (line: Element): Node =>
      [...line.querySelector('span')!.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!;
    const range = document.createRange();
    range.setStart(textNodeOf(lines[0]), 0);
    range.setEnd(textNodeOf(lines[1]), 3);
    const selection = (list.shadowRoot as unknown as { getSelection?: () => Selection }).getSelection?.() ?? window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const listener = oneEvent(el, 'lyra-text-select');
    el.shadowRoot!.querySelector('[part="viewport"]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const event = (await listener) as CustomEvent<{ text: string; anchor: { kind: string; start: number; end: number } | null }>;
    expect(event.detail.text).to.be.a('string').and.not.equal('');
    expect(event.detail.anchor).to.deep.equal({ kind: 'line-range', start: 1, end: 2 });
  });

  it('does not emit lyra-text-select when nothing is selected (collapsed selection)', async () => {
    const el = (await fixture(html`<lyra-terminal></lyra-terminal>`)) as LyraTerminal;
    el.write('only line');
    await el.updateComplete;
    let fired = false;
    el.addEventListener('lyra-text-select', () => (fired = true));
    el.shadowRoot!.querySelector('[part="viewport"]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fired).to.be.false;
  });

  it('honors a .strings override for terminalLabel', async () => {
    const el = (await fixture(
      html`<lyra-terminal .strings=${{ terminalLabel: 'Console de sortie' }}></lyra-terminal>`,
    )) as LyraTerminal;
    expect(el.shadowRoot!.querySelector('[part="viewport"]')!.getAttribute('aria-label')).to.equal(
      'Console de sortie',
    );
  });

  it('is accessible with content, copy/download buttons, and a highlight set', async () => {
    const el = (await fixture(
      html`<lyra-terminal copyable downloadable></lyra-terminal>`,
    )) as LyraTerminal;
    el.write('line one\nline two');
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 1 } }];
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});
