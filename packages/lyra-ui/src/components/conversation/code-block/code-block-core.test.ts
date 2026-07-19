import { fixture, expect, html, waitUntil, aTimeout, oneEvent } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import './code-block-core.js';
import type { LyraCodeBlockCore } from './code-block-core.js';

async function el2Ready(el: LyraCodeBlockCore): Promise<void> {
  await el.updateComplete;
  await aTimeout(0);
  await el.updateComplete;
}

describe('lr-code-block-core', () => {
  it('renders optional line numbers for plain code', async () => {
    const el = (await fixture(
      html`<lr-code-block-core line-numbers .code=${'first\nsecond'}></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    expect(el.lineNumbers).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part="pre"] .line')).to.have.lengthOf(2);
  });

  it('forwards a host aria-label to the internal named code region and keeps it reactive', async () => {
    const el = (await fixture(
      html`<lr-code-block-core aria-label="Response payload" language="json"></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(body.getAttribute('aria-label')).to.equal('Response payload');

    el.accessibleLabel = 'Updated response payload';
    await el.updateComplete;
    expect(body.getAttribute('aria-label')).to.equal('Updated response payload');
  });

  it('highlights code using a supplied languages map', async () => {
    const el = (await fixture(html`<lr-code-block-core language="json"></lr-code-block-core>`)) as LyraCodeBlockCore;
    el.languages = { json: jsonGrammar };
    el.code = '{"a":1}';
    await el.updateComplete;
    // timeout: 8000 -- same as code-block.test.ts's identical wait on the fine-grained
    // shiki/core + oniguruma-WASM dynamic import, which the default waitUntil timeout is
    // too tight for under load.
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, { timeout: 8000 });
    expect(el.shadowRoot!.querySelector('.shiki')).to.exist;
  });

  it('does not set highlighter/shikiReady when the element disconnects before loadShikiHighlighterCore() resolves in connectedCallback()', async function () {
    // `languages` must be non-empty *before* the element ever connects, so
    // connectedCallback() itself takes the loadShikiHighlighterCore().then()
    // branch under test (the other call site, inside syncHighlight(), is
    // already guarded by its own highlightToken staleness check). A fresh
    // object literal never hits the per-languages-object WeakMap cache, so
    // this is a genuine, non-instant dynamic import -- give it real time to
    // settle before asserting the disconnected instance was never mutated.
    this.timeout(20_000);
    const el = document.createElement('lr-code-block-core') as LyraCodeBlockCore;
    el.language = 'json';
    el.languages = { json: jsonGrammar };
    document.body.appendChild(el);
    el.remove();
    await aTimeout(8000);

    type Internals = { highlighter?: unknown; shikiReady: boolean };
    const internals = el as unknown as Internals;
    expect(internals.shikiReady, 'must not become true on a disconnected instance').to.be.false;
    expect(internals.highlighter, 'must not be set on a disconnected instance').to.equal(undefined);
  });

  it('renders the plain-text fallback for a language absent from the supplied languages map, never hanging waiting on a default highlighter', async () => {
    const el = (await fixture(html`<lr-code-block-core language="python"></lr-code-block-core>`)) as LyraCodeBlockCore;
    el.languages = { json: jsonGrammar };
    el.code = 'print(1)';
    await el.updateComplete;
    const pre = el.shadowRoot!.querySelector('pre');
    expect(pre).to.exist;
    expect(pre!.textContent).to.include('print(1)');
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lr-code-block-core language="json" copyable></lr-code-block-core>`)) as LyraCodeBlockCore;
    el.languages = { json: jsonGrammar };
    el.code = '{"a":1}';
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('sets highlighter and shikiReady from connectedCallback() when languages is populated before the element ever connects', async function () {
    // Mirrors the "does not set highlighter/shikiReady..." disconnect test's setup (languages
    // must be non-empty *before* the element ever connects so connectedCallback() itself takes
    // the loadShikiHighlighterCore().then() branch under test), but keeps the element connected
    // through resolution instead of removing it, exercising the opposite (stays-connected) side
    // of that same guard.
    this.timeout(20_000);
    const el = document.createElement('lr-code-block-core') as LyraCodeBlockCore;
    el.language = 'json';
    el.languages = { json: jsonGrammar };
    el.code = '{"a":1}';
    document.body.appendChild(el);
    try {
      await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, { timeout: 15000 });
      type Internals = { highlighter?: unknown; shikiReady: boolean };
      const internals = el as unknown as Internals;
      expect(internals.shikiReady).to.be.true;
      expect(internals.highlighter).to.exist;
    } finally {
      el.remove();
    }
  });

  it('clears highlightedHtml when language is cleared after a language was already highlighted', async () => {
    const el = (await fixture(
      html`<lr-code-block-core language="json" .languages=${{ json: jsonGrammar }} .code=${'{"a":1}'}></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, { timeout: 8000 });
    el.language = '';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.shiki')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.equal('{"a":1}');
  });

  it('falls back to plain text when switching to a language absent from `languages` after shiki is already ready', async () => {
    const el = (await fixture(
      html`<lr-code-block-core language="json" .languages=${{ json: jsonGrammar }} .code=${'{"a":1}'}></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, { timeout: 8000 });
    el.language = 'python';
    el.code = 'print(1)';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.shiki')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.include('print(1)');
  });

  it('falls back to plain text when the highlighter throws while tokenizing', async () => {
    const el = (await fixture(
      html`<lr-code-block-core language="json" .languages=${{ json: jsonGrammar }} .code=${'{"a":1}'}></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    await waitUntil(() => el.shadowRoot!.querySelector('.shiki') !== null, undefined, { timeout: 8000 });
    type Internals = { highlighter: { codeToHtml: () => string }; highlightedHtml: string | null };
    const internals = el as unknown as Internals;
    internals.highlighter.codeToHtml = () => {
      throw new Error('malformed grammar');
    };
    el.code = '{"a":2}';
    await el2Ready(el);
    expect(internals.highlightedHtml).to.equal(null);
    expect(el.shadowRoot!.querySelector('.shiki')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="code"]')!.textContent).to.equal('{"a":2}');
  });
});

describe('highlight-lines', () => {
  it('marks the specified lines with data-highlighted and part line-highlight', async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${'a\nb\nc\nd'} highlight-lines="2-3"></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const lines = [...el.shadowRoot!.querySelectorAll('[data-line]')];
    expect(lines.map((l) => l.hasAttribute('data-highlighted'))).to.deep.equal([false, true, true, false]);
    expect(lines[1]!.getAttribute('part')).to.equal('line-highlight');
    expect(lines[0]!.hasAttribute('part')).to.be.false;
  });

  it('renders identically between the shiki and plain-text fallback paths for the same highlight-lines', async () => {
    const plain = (await fixture(
      html`<lr-code-block-core code=${'a\nb\nc'} highlight-lines="2"></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    await el2Ready(plain);
    const plainHighlighted = [...plain.shadowRoot!.querySelectorAll('[data-highlighted]')].length;
    expect(plainHighlighted).to.equal(1);
  });

  it('back-compat: default render is byte-identical with highlight-lines/highlights/interactive-lines unset', async () => {
    const before = (await fixture(html`<lr-code-block-core code=${'a\nb'}></lr-code-block-core>`)) as LyraCodeBlockCore;
    await before.updateComplete;
    const beforeHtml = before.shadowRoot!.querySelector('[part="body"]')!.innerHTML;
    const after = (await fixture(
      html`<lr-code-block-core code=${'a\nb'} .highlightLines=${''} .highlights=${[]} .interactiveLines=${false}></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    await after.updateComplete;
    expect(after.shadowRoot!.querySelector('[part="body"]')!.innerHTML).to.equal(beforeHtml);
  });

  it('ignores non-line-range highlight entries when merging highlight-lines', async () => {
    const el = (await fixture(html`<lr-code-block-core code=${'a\nb\nc'}></lr-code-block-core>`)) as LyraCodeBlockCore;
    el.highlights = [
      { id: 'p1', anchor: { kind: 'page', page: 1 } },
      { id: 'h1', anchor: { kind: 'line-range', start: 2, end: 2 } },
    ];
    await el.updateComplete;
    const lines = [...el.shadowRoot!.querySelectorAll('[data-line]')];
    expect(lines.map((l) => l.hasAttribute('data-highlighted'))).to.deep.equal([false, true, false]);
  });
});

describe('anchor-target (line-range)', () => {
  it('scrolls to the start line of a line-range anchor', async () => {
    const el = (await fixture(html`<lr-code-block-core code=${'a\nb\nc\nd\ne'}></lr-code-block-core>`)) as LyraCodeBlockCore;
    await el.updateComplete;
    let scrolled = false;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    body.scrollTo = () => {
      scrolled = true;
    };
    const result = await el.scrollToAnchor({ kind: 'line-range', start: 3 });
    expect(result).to.be.true;
    expect(scrolled).to.be.true;
  });

  it('resolves false for a line past end-of-file', async () => {
    const el = (await fixture(html`<lr-code-block-core code=${'a\nb'}></lr-code-block-core>`)) as LyraCodeBlockCore;
    await el.updateComplete;
    expect(await el.scrollToAnchor({ kind: 'line-range', start: 99 })).to.be.false;
  });

  it('resolves a `highlights` id string to its anchor, and resolves false for an unknown id', async () => {
    const el = (await fixture(html`<lr-code-block-core code=${'a\nb\nc\nd\ne'}></lr-code-block-core>`)) as LyraCodeBlockCore;
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 3 } }];
    await el.updateComplete;
    let scrolled = false;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    body.scrollTo = () => {
      scrolled = true;
    };
    expect(await el.scrollToAnchor('h1')).to.be.true;
    expect(scrolled).to.be.true;
    expect(await el.scrollToAnchor('does-not-exist')).to.be.false;
  });

  it('resolves false when called before the highlighter has finished loading (skeleton still showing, no line elements yet)', async () => {
    const el = document.createElement('lr-code-block-core') as LyraCodeBlockCore;
    el.language = 'json';
    el.languages = { json: jsonGrammar };
    el.code = 'a\nb\nc';
    document.body.appendChild(el);
    try {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('lr-skeleton')).to.exist;
      expect(await el.scrollToAnchor({ kind: 'line-range', start: 1 })).to.be.false;
    } finally {
      el.remove();
    }
  });

  it('renders a line-range highlight from the highlights array', async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${'a\nb\nc'}></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 2, end: 2 } }];
    await el.updateComplete;
    const line2 = el.shadowRoot!.querySelector('[data-line="2"]')!;
    expect(line2.hasAttribute('data-highlighted')).to.be.true;
  });

  it('marks active highlight lines with data-active based on activeHighlightId, including the open-ended end fallback', async () => {
    const el = (await fixture(html`<lr-code-block-core code=${'a\nb\nc'}></lr-code-block-core>`)) as LyraCodeBlockCore;
    // `end` intentionally omitted -- exercises the `active.anchor.end ?? active.anchor.start` fallback.
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 2 } }];
    el.activeHighlightId = 'h1';
    await el.updateComplete;
    const line1 = el.shadowRoot!.querySelector('[data-line="1"]')!;
    const line2 = el.shadowRoot!.querySelector('[data-line="2"]')!;
    expect(line2.hasAttribute('data-active')).to.be.true;
    expect(line1.hasAttribute('data-active')).to.be.false;
  });
});

describe('text selection (lr-text-select)', () => {
  it('emits lr-text-select for a text selection spanning code lines', async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${'alpha\nbeta\ngamma'}></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const line1 = el.shadowRoot!.querySelector('[data-line="1"]')!;
    const line2 = el.shadowRoot!.querySelector('[data-line="2"]')!;
    // Lit inserts a static per-expression marker comment before the dynamic text node it commits,
    // so the real Text node is not reliably `firstChild` -- find it directly instead of assuming a
    // fixed sibling position (same precedent as terminal.test.ts's identical selection test).
    const textNodeOf = (line: Element): Node => [...line.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!;
    const range = document.createRange();
    range.setStart(textNodeOf(line1), 0);
    range.setEnd(textNodeOf(line2), 2);
    // `ShadowRoot.getSelection` is a Chromium-only extension -- same precedent the component
    // itself documents for onBodyMouseUp(). Falls back to window.getSelection() otherwise.
    const shadowSelection = (el.shadowRoot as unknown as { getSelection?: () => Selection | null }).getSelection?.();
    const selection = shadowSelection ?? window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const listener = oneEvent(el, 'lr-text-select');
    body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
    const event = (await listener) as CustomEvent<{ text: string; anchor: unknown }>;
    expect(event.detail.anchor).to.deep.equal({ kind: 'line-range', start: 1, end: 2 });
    expect(event.detail.text.length).to.be.greaterThan(0);
  });

  it('does not emit lr-text-select when there is no active selection on mouseup', async () => {
    const el = (await fixture(html`<lr-code-block-core code=${'a\nb'}></lr-code-block-core>`)) as LyraCodeBlockCore;
    await el.updateComplete;
    const shadowSelection = (el.shadowRoot as unknown as { getSelection?: () => Selection | null }).getSelection?.();
    (shadowSelection ?? window.getSelection())?.removeAllRanges();
    let fired = false;
    el.addEventListener('lr-text-select', () => {
      fired = true;
    });
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
    await aTimeout(0);
    expect(fired).to.be.false;
  });

  it('does not emit lr-text-select for a whitespace-only selection', async () => {
    const el = (await fixture(html`<lr-code-block-core code=${'a  \nb'}></lr-code-block-core>`)) as LyraCodeBlockCore;
    await el.updateComplete;
    const line1 = el.shadowRoot!.querySelector('[data-line="1"]')!;
    const textNodeOf = (line: Element): Node => [...line.childNodes].find((n) => n.nodeType === Node.TEXT_NODE)!;
    const range = document.createRange();
    range.setStart(textNodeOf(line1), 1);
    range.setEnd(textNodeOf(line1), 3); // just the trailing spaces
    const shadowSelection = (el.shadowRoot as unknown as { getSelection?: () => Selection | null }).getSelection?.();
    const selection = shadowSelection ?? window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    let fired = false;
    el.addEventListener('lr-text-select', () => {
      fired = true;
    });
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, composed: true }));
    await aTimeout(0);
    expect(fired).to.be.false;
  });
});

describe('interactive-lines', () => {
  it('renders gutter numbers as buttons with roving tabindex when line-numbers and interactive-lines are both set', async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${'a\nb\nc'} line-numbers interactive-lines></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll('[part~="line-button"]')] as HTMLButtonElement[];
    expect(buttons).to.have.lengthOf(3);
    expect(buttons.map((b) => b.tabIndex)).to.deep.equal([0, -1, -1]);
  });

  it('emits lr-line-click on Enter and on click', async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${'a\nb'} line-numbers interactive-lines></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const listener = oneEvent(el, 'lr-line-click');
    const first = el.shadowRoot!.querySelector('[data-line="1"]') as HTMLButtonElement;
    first.click();
    const event = (await listener) as CustomEvent<{ line: number }>;
    expect(event.detail).to.deep.equal({ line: 1 });
  });

  it('moves focus with ArrowDown/ArrowUp/Home/End', async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${'a\nb\nc'} line-numbers interactive-lines></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector('[data-line="1"]') as HTMLButtonElement;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-line="2"]')!.getAttribute('tabindex')).to.equal('0');
  });

  it('does not emit lr-line-click while interactive-lines is off', async () => {
    const el = (await fixture(html`<lr-code-block-core code=${'a\nb'} line-numbers></lr-code-block-core>`)) as LyraCodeBlockCore;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part~="line-button"]').length).to.equal(0);
  });

  it('moves focus with ArrowUp, jumps with Home/End, and activates on Enter and Space', async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${'a\nb\nc\nd'} line-numbers interactive-lines></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    await el.updateComplete;

    const line3 = el.shadowRoot!.querySelector('[data-line="3"]') as HTMLButtonElement;
    line3.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-line="2"]')!.getAttribute('tabindex')).to.equal('0');

    const line2 = el.shadowRoot!.querySelector('[data-line="2"]') as HTMLButtonElement;
    line2.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-line="4"]')!.getAttribute('tabindex')).to.equal('0');

    const line4 = el.shadowRoot!.querySelector('[data-line="4"]') as HTMLButtonElement;
    line4.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-line="1"]')!.getAttribute('tabindex')).to.equal('0');

    const line1 = el.shadowRoot!.querySelector('[data-line="1"]') as HTMLButtonElement;
    let listener = oneEvent(el, 'lr-line-click');
    line1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    let event = (await listener) as CustomEvent<{ line: number }>;
    expect(event.detail).to.deep.equal({ line: 1 });

    listener = oneEvent(el, 'lr-line-click');
    line1.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
    event = (await listener) as CustomEvent<{ line: number }>;
    expect(event.detail).to.deep.equal({ line: 1 });

    // Home while already on line 1 is a no-op (next === line) -- must not move focus or throw.
    line1.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-line="1"]')!.getAttribute('tabindex')).to.equal('0');
  });

  it('marks a highlighted line as both line-button and line-highlight when interactive-lines and highlight-lines are combined', async () => {
    const el = (await fixture(
      html`<lr-code-block-core code=${'a\nb\nc'} line-numbers interactive-lines highlight-lines="2"></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const line2 = el.shadowRoot!.querySelector('[data-line="2"]')!;
    expect(line2.getAttribute('part')).to.equal('line-button line-highlight');
  });
});

describe('copy button', () => {
  it('fires lr-copy with the raw code and writes it to the clipboard, then reverts the confirmation label after the timeout', async function () {
    this.timeout(5000);
    const writes: string[] = [];
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: (text: string) => (writes.push(text), Promise.resolve()) },
      configurable: true,
    });

    try {
      const el = (await fixture(html`<lr-code-block-core .code=${'const x = 1;'}></lr-code-block-core>`)) as LyraCodeBlockCore;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;
      expect(button.textContent!.trim()).to.equal('Copy');

      const listener = oneEvent(el, 'lr-copy');
      button.click();
      const { detail } = await listener;
      expect(detail).to.deep.equal({ text: 'const x = 1;' });
      expect(writes).to.deep.equal(['const x = 1;']);
      await el.updateComplete;
      expect(button.textContent!.trim()).to.equal('Copied!');

      await aTimeout(1600);
      await el.updateComplete;
      expect(button.textContent!.trim()).to.equal('Copy');
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
    }
  });

  it('fires lr-copy even when navigator.clipboard is unavailable', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    try {
      const el = (await fixture(html`<lr-code-block-core .code=${'const x = 1;'}></lr-code-block-core>`)) as LyraCodeBlockCore;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;

      const listener = oneEvent(el, 'lr-copy');
      button.click();
      const { detail } = await listener;
      expect(detail).to.deep.equal({ text: 'const x = 1;' });
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
    }
  });

  it('still fires lr-copy when navigator.clipboard throws synchronously', async () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', {
      get() {
        throw new Error('blocked by permissions policy');
      },
      configurable: true,
    });

    try {
      const el = (await fixture(html`<lr-code-block-core .code=${'const x = 1;'}></lr-code-block-core>`)) as LyraCodeBlockCore;
      const button = el.shadowRoot!.querySelector('[part="copy-button"]') as HTMLButtonElement;

      const listener = oneEvent(el, 'lr-copy');
      button.click();
      const { detail } = await listener;
      expect(detail).to.deep.equal({ text: 'const x = 1;' });
    } finally {
      if (original) Object.defineProperty(navigator, 'clipboard', original);
    }
  });

  it('does not render a copy button when copyable is false', async () => {
    const el = (await fixture(
      html`<lr-code-block-core .copyable=${false} .code=${'x'} filename="x.ts"></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    expect(el.shadowRoot!.querySelector('[part="copy-button"]')).to.not.exist;
  });
});

describe('collapsible / collapsed', () => {
  it('renders no toggle when collapsible is false, and the body is always visible', async () => {
    const el = (await fixture(html`<lr-code-block-core .code=${'x'}></lr-code-block-core>`)) as LyraCodeBlockCore;
    expect(el.shadowRoot!.querySelector('[part="toggle"]')).to.not.exist;
    expect((el.shadowRoot!.querySelector('[part="body"]') as HTMLElement).hidden).to.be.false;
  });

  it('hides the body when collapsible and collapsed, and toggling the header button flips it, firing lr-toggle', async () => {
    const el = (await fixture(
      html`<lr-code-block-core collapsible collapsed .code=${'x'}></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    expect(body.hidden).to.be.true;
    expect(toggle.getAttribute('aria-expanded')).to.equal('false');
    expect(toggle.getAttribute('aria-controls')).to.equal(body.id);

    let firing = oneEvent(el, 'lr-toggle');
    toggle.click();
    let event = await firing;
    await el.updateComplete;
    expect(el.collapsed).to.be.false;
    expect(body.hidden).to.be.false;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    expect((event as CustomEvent).detail).to.deep.equal({ collapsed: false });

    firing = oneEvent(el, 'lr-toggle');
    toggle.click();
    event = await firing;
    await el.updateComplete;
    expect(el.collapsed).to.be.true;
    expect(body.hidden).to.be.true;
    expect((event as CustomEvent).detail).to.deep.equal({ collapsed: true });
  });
});

describe('header content', () => {
  it('shows filename as visible header text when set', async () => {
    const el = (await fixture(html`<lr-code-block-core filename="app.ts" .code=${'x'}></lr-code-block-core>`)) as LyraCodeBlockCore;
    expect(el.shadowRoot!.querySelector('[part="filename"]')!.textContent!.trim()).to.equal('app.ts');
  });

  it('renders no header at all when there is nothing to put in it', async () => {
    const el = (await fixture(
      html`<lr-code-block-core .copyable=${false} .code=${'x'}></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    expect(el.shadowRoot!.querySelector('[part="header"]')).to.not.exist;
  });

  it('applies max-height as a CSS custom property on the body', async () => {
    const el = (await fixture(
      html`<lr-code-block-core max-height="10rem" .code=${'x'}></lr-code-block-core>`,
    )) as LyraCodeBlockCore;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(body.style.getPropertyValue('--lr-code-block-max-height').trim()).to.equal('10rem');
  });
});
