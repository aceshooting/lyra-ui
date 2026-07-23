import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './terminal.js';
import type { LyraTerminal } from './terminal.js';
import { styles } from './terminal.styles.js';

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

  it('copy button emits lr-copy with the SGR-stripped plain text', async () => {
    const el = (await fixture(html`<lr-terminal copyable></lr-terminal>`)) as LyraTerminal;
    el.write('\x1b[31mred\x1b[0m plain');
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    const listener = oneEvent(el, 'lr-copy');
    button.click();
    const event = (await listener) as CustomEvent<{ text: string }>;
    expect(event.detail.text).to.equal('red plain');
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

  it('search() resolves match count and lr-search-change reports query/matchCount/activeIndex', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('error: bad\ninfo: ok\nerror: worse');
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-search-change');
    const count = await el.search('error');
    expect(count).to.equal(2);
    const event = (await listener) as CustomEvent<{ query: string; matchCount: number; activeIndex: number }>;
    expect(event.detail).to.deep.equal({ query: 'error', matchCount: 2, activeIndex: 0 });
  });

  it('bounds the number of occurrence matches retained for an adversarial single line', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a'.repeat(12_000));
    expect(await el.search('a')).to.equal(10_000);
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
    const event = (await listener) as CustomEvent<{ matchCount: number }>;
    expect(event.detail.matchCount).to.equal(0);
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
    // updateComplete resolves, each capable of firing its own genuine `lr-visible-range-changed`
    // -- letting it fully settle first, before registering the listener and dispatching the mocked
    // range below, avoids a late genuine event racing the mocked one (this component reacts to
    // virtual-list's real range exactly the same way it reacts to a mocked one, so whichever lands
    // last wins the assertion).
    await new Promise((resolve) => setTimeout(resolve, 100));
    const listener = oneEvent(term, 'lr-follow-change');
    list.dispatchEvent(new CustomEvent('lr-visible-range-changed', { detail: { start: 0, end: 3 }, bubbles: true, composed: true }));
    const event = (await listener) as CustomEvent<{ following: boolean }>;
    expect(event.detail.following).to.be.false;
    expect(term.follow).to.be.false;
  });

  it('does not leak the child virtual-list visible-range event through the terminal wrapper', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('one\ntwo');
    await el.updateComplete;
    let leaked = false;
    el.addEventListener('lr-visible-range-changed', () => (leaked = true));
    el.shadowRoot!.querySelector('lr-virtual-list')!.dispatchEvent(
      new CustomEvent('lr-visible-range-changed', {
        detail: { start: 0, end: 1 },
        bubbles: true,
        composed: true,
      }),
    );
    expect(leaked).to.be.false;
  });

  it('accessible label defaults to the localized terminalLabel and honors aria-label override', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    const viewport = el.shadowRoot!.querySelector('[part="viewport"]')!;
    expect(viewport.getAttribute('role')).to.equal('log');
    expect(viewport.getAttribute('aria-label')).to.be.a('string').and.not.equal('');
    const labeled = (await fixture(html`<lr-terminal aria-label="Build output"></lr-terminal>`)) as LyraTerminal;
    expect(labeled.shadowRoot!.querySelector('[part="viewport"]')!.getAttribute('aria-label')).to.equal(
      'Build output',
    );
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
    const event = (await listener) as CustomEvent<{ id: string }>;
    expect(event.detail.id).to.equal('h1');
    await el.updateComplete;
    expect(line.getAttribute('aria-current')).to.equal('true');
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

  it('scrollToAnchor emits follow=false when it disengages following', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a\nb');
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-follow-change');
    expect(await el.scrollToAnchor({ kind: 'line-range', start: 1 })).to.be.true;
    const event = (await listener) as CustomEvent<{ following: boolean }>;
    expect(event.detail.following).to.be.false;
  });

  it('announce-output routes appended text into the visually-hidden announcer region', async () => {
    const el = (await fixture(html`<lr-terminal announce-output></lr-terminal>`)) as LyraTerminal;
    el.write('build started');
    await el.updateComplete;
    await new Promise((resolve) => setTimeout(resolve, 20)); // Announcer's own throttle uses real timers
    const region = el.shadowRoot!.querySelector('[part="announcer"]')!;
    expect(region.getAttribute('role')).to.equal('status');
    expect(region.textContent).to.equal('build started');
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
    const range = document.createRange();
    range.setStart(textNodeOf(lines[0]), 0);
    range.setEnd(textNodeOf(lines[1]), 3);
    const selection = (list.shadowRoot as unknown as { getSelection?: () => Selection }).getSelection?.() ?? window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const listener = oneEvent(el, 'lr-text-select');
    el.shadowRoot!.querySelector('[part="viewport"]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const event = (await listener) as CustomEvent<{ text: string; anchor: { kind: string; start: number; end: number } | null }>;
    expect(event.detail.text).to.be.a('string').and.not.equal('');
    expect(event.detail.anchor).to.deep.equal({ kind: 'line-range', start: 1, end: 2 });
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
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { activeId: unknown };
    expect(list.activeId).to.equal('');
    el.scrollToBottom();
    await el.updateComplete;
    expect(list.activeId).to.equal(3);
  });

  it('scrollToBottom() on an empty buffer clears the scroll target instead of throwing', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.scrollToBottom();
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { activeId: unknown };
    expect(list.activeId).to.equal('');
  });

  it('the "jump to latest" button re-engages follow, scrolls to the last line, and emits lr-follow-change', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a\nb\nc');
    el.follow = false;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="jump-to-latest"]') as HTMLButtonElement;
    expect(button).to.exist;
    const listener = oneEvent(el, 'lr-follow-change');
    button.click();
    const event = (await listener) as CustomEvent<{ following: boolean }>;
    expect(event.detail.following).to.be.true;
    expect(el.follow).to.be.true;
    const list = el.shadowRoot!.querySelector('lr-virtual-list') as HTMLElement & { activeId: unknown };
    expect(list.activeId).to.equal(3);
  });

  it('pressing End in the viewport re-engages follow via the same jump-to-latest path', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('a\nb');
    el.follow = false;
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
    expect(((await enterListener) as CustomEvent<{ id: string }>).detail.id).to.equal('h1');
    const spaceListener = oneEvent(el, 'lr-highlight-activate');
    line.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    expect(((await spaceListener) as CustomEvent<{ id: string }>).detail.id).to.equal('h1');
  });

  it('best-effort copy: a synchronously-throwing navigator.clipboard.writeText does not block lr-copy', async () => {
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
      const listener = oneEvent(el, 'lr-copy');
      button.click();
      const event = (await listener) as CustomEvent<{ text: string }>;
      expect(event.detail.text).to.equal('secret');
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
      else delete (navigator as unknown as { clipboard?: unknown }).clipboard;
    }
  });

  it('copy button label swaps to the localized "copied" confirmation, then reverts after ~1.5s', async () => {
    const el = (await fixture(html`<lr-terminal></lr-terminal>`)) as LyraTerminal;
    el.write('hi');
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
    expect(button.textContent!.trim()).to.equal('Copy');
    button.click();
    await el.updateComplete;
    expect(button.textContent!.trim()).to.equal('Copied!');
    await new Promise((resolve) => setTimeout(resolve, 1600));
    await el.updateComplete;
    expect(button.textContent!.trim()).to.equal('Copy');
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
    const fakeSelection = {
      isCollapsed: false,
      anchorNode: document.body,
      focusNode: document.body,
      toString: () => 'outside text',
      getRangeAt: () => ({ getClientRects: () => [] }),
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
    // A real Selection can't be coerced into throwing from getRangeAt() once isCollapsed is
    // false (rangeCount is then guaranteed >= 1), so this exercises the defensive try/catch
    // around getClientRects() with a minimal stand-in exposing just the members onViewportPointerUp
    // actually reads -- the same shadow-scoped getSelection() override style the passing
    // lr-text-select tests above already use, just returning a stub instead of the real selection.
    const fakeSelection = {
      isCollapsed: false,
      anchorNode: line,
      focusNode: line,
      toString: () => 'first',
      getRangeAt: () => {
        throw new Error('no range');
      },
    } as unknown as Selection;
    (list.shadowRoot as unknown as { getSelection: () => Selection }).getSelection = () => fakeSelection;
    const listener = oneEvent(el, 'lr-text-select');
    el.shadowRoot!.querySelector('[part="viewport"]')!.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    const event = (await listener) as CustomEvent<{ text: string; rects: DOMRect[] }>;
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
    expect(inverse.style.color).to.equal('var(--lr-terminal-color-red)');
    expect(inverse.style.backgroundColor).to.equal('var(--lr-color-text)');
  });

  it('omits the toolbar entirely when both copyable and downloadable are false', async () => {
    const el = (await fixture(
      html`<lr-terminal .copyable=${false} .downloadable=${false}></lr-terminal>`,
    )) as LyraTerminal;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="toolbar"]')).to.be.null;
  });

  it('renders only the download button when copyable is false and downloadable is true', async () => {
    const el = (await fixture(html`<lr-terminal .copyable=${false} downloadable></lr-terminal>`)) as LyraTerminal;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="copy-button"]')).to.be.null;
    expect(el.shadowRoot!.querySelector('[part="download-button"]')).to.exist;
  });

  it('wrap=false uses a fixed 24px row-height on the virtual list instead of "auto"', async () => {
    const el = (await fixture(html`<lr-terminal .wrap=${false}></lr-terminal>`)) as LyraTerminal;
    await el.updateComplete;
    const list = el.shadowRoot!.querySelector('lr-virtual-list')!;
    expect(list.getAttribute('row-height')).to.equal('24');
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

  it('gives copy-button, download-button, and jump-to-latest a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='copy-button'\]:hover/);
    expect(css).to.match(/\[part='download-button'\]:hover/);
    expect(css).to.match(/\[part='jump-to-latest'\]:hover/);
  });
});
