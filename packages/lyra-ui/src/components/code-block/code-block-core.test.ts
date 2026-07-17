import { fixture, expect, html, waitUntil, aTimeout, oneEvent } from '@open-wc/testing';
import jsonGrammar from 'shiki/langs/json.mjs';
import './code-block-core.js';
import type { LyraCodeBlockCore } from './code-block-core.js';

async function el2Ready(el: LyraCodeBlockCore): Promise<void> {
  await el.updateComplete;
  await aTimeout(0);
  await el.updateComplete;
}

describe('lyra-code-block-core', () => {
  it('renders optional line numbers for plain code', async () => {
    const el = (await fixture(
      html`<lyra-code-block-core line-numbers .code=${'first\nsecond'}></lyra-code-block-core>`,
    )) as LyraCodeBlockCore;
    expect(el.lineNumbers).to.be.true;
    expect(el.shadowRoot!.querySelectorAll('[part="pre"] .line')).to.have.lengthOf(2);
  });

  it('forwards a host aria-label to the internal named code region and keeps it reactive', async () => {
    const el = (await fixture(
      html`<lyra-code-block-core aria-label="Response payload" language="json"></lyra-code-block-core>`,
    )) as LyraCodeBlockCore;
    const body = el.shadowRoot!.querySelector('[part="body"]') as HTMLElement;
    expect(body.getAttribute('aria-label')).to.equal('Response payload');

    el.accessibleLabel = 'Updated response payload';
    await el.updateComplete;
    expect(body.getAttribute('aria-label')).to.equal('Updated response payload');
  });

  it('highlights code using a supplied languages map', async () => {
    const el = (await fixture(html`<lyra-code-block-core language="json"></lyra-code-block-core>`)) as LyraCodeBlockCore;
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
    const el = document.createElement('lyra-code-block-core') as LyraCodeBlockCore;
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
    const el = (await fixture(html`<lyra-code-block-core language="python"></lyra-code-block-core>`)) as LyraCodeBlockCore;
    el.languages = { json: jsonGrammar };
    el.code = 'print(1)';
    await el.updateComplete;
    const pre = el.shadowRoot!.querySelector('pre');
    expect(pre).to.exist;
    expect(pre!.textContent).to.include('print(1)');
  });

  it('is accessible', async () => {
    const el = (await fixture(html`<lyra-code-block-core language="json" copyable></lyra-code-block-core>`)) as LyraCodeBlockCore;
    el.languages = { json: jsonGrammar };
    el.code = '{"a":1}';
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });
});

describe('highlight-lines', () => {
  it('marks the specified lines with data-highlighted and part line-highlight', async () => {
    const el = (await fixture(
      html`<lyra-code-block-core code=${'a\nb\nc\nd'} highlight-lines="2-3"></lyra-code-block-core>`,
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const lines = [...el.shadowRoot!.querySelectorAll('[data-line]')];
    expect(lines.map((l) => l.hasAttribute('data-highlighted'))).to.deep.equal([false, true, true, false]);
    expect(lines[1]!.getAttribute('part')).to.equal('line-highlight');
    expect(lines[0]!.hasAttribute('part')).to.be.false;
  });

  it('renders identically between the shiki and plain-text fallback paths for the same highlight-lines', async () => {
    const plain = (await fixture(
      html`<lyra-code-block-core code=${'a\nb\nc'} highlight-lines="2"></lyra-code-block-core>`,
    )) as LyraCodeBlockCore;
    await el2Ready(plain);
    const plainHighlighted = [...plain.shadowRoot!.querySelectorAll('[data-highlighted]')].length;
    expect(plainHighlighted).to.equal(1);
  });

  it('back-compat: default render is byte-identical with highlight-lines/highlights/interactive-lines unset', async () => {
    const before = (await fixture(html`<lyra-code-block-core code=${'a\nb'}></lyra-code-block-core>`)) as LyraCodeBlockCore;
    await before.updateComplete;
    const beforeHtml = before.shadowRoot!.querySelector('[part="body"]')!.innerHTML;
    const after = (await fixture(
      html`<lyra-code-block-core code=${'a\nb'} .highlightLines=${''} .highlights=${[]} .interactiveLines=${false}></lyra-code-block-core>`,
    )) as LyraCodeBlockCore;
    await after.updateComplete;
    expect(after.shadowRoot!.querySelector('[part="body"]')!.innerHTML).to.equal(beforeHtml);
  });
});

describe('anchor-target (line-range)', () => {
  it('scrolls to the start line of a line-range anchor', async () => {
    const el = (await fixture(html`<lyra-code-block-core code=${'a\nb\nc\nd\ne'}></lyra-code-block-core>`)) as LyraCodeBlockCore;
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
    const el = (await fixture(html`<lyra-code-block-core code=${'a\nb'}></lyra-code-block-core>`)) as LyraCodeBlockCore;
    await el.updateComplete;
    expect(await el.scrollToAnchor({ kind: 'line-range', start: 99 })).to.be.false;
  });

  it('renders a line-range highlight from the highlights array', async () => {
    const el = (await fixture(
      html`<lyra-code-block-core code=${'a\nb\nc'}></lyra-code-block-core>`,
    )) as LyraCodeBlockCore;
    el.highlights = [{ id: 'h1', anchor: { kind: 'line-range', start: 2, end: 2 } }];
    await el.updateComplete;
    const line2 = el.shadowRoot!.querySelector('[data-line="2"]')!;
    expect(line2.hasAttribute('data-highlighted')).to.be.true;
  });
});

describe('interactive-lines', () => {
  it('renders gutter numbers as buttons with roving tabindex when line-numbers and interactive-lines are both set', async () => {
    const el = (await fixture(
      html`<lyra-code-block-core code=${'a\nb\nc'} line-numbers interactive-lines></lyra-code-block-core>`,
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const buttons = [...el.shadowRoot!.querySelectorAll('[part~="line-button"]')] as HTMLButtonElement[];
    expect(buttons).to.have.lengthOf(3);
    expect(buttons.map((b) => b.tabIndex)).to.deep.equal([0, -1, -1]);
  });

  it('emits lyra-line-click on Enter and on click', async () => {
    const el = (await fixture(
      html`<lyra-code-block-core code=${'a\nb'} line-numbers interactive-lines></lyra-code-block-core>`,
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const listener = oneEvent(el, 'lyra-line-click');
    const first = el.shadowRoot!.querySelector('[data-line="1"]') as HTMLButtonElement;
    first.click();
    const event = (await listener) as CustomEvent<{ line: number }>;
    expect(event.detail).to.deep.equal({ line: 1 });
  });

  it('moves focus with ArrowDown/ArrowUp/Home/End', async () => {
    const el = (await fixture(
      html`<lyra-code-block-core code=${'a\nb\nc'} line-numbers interactive-lines></lyra-code-block-core>`,
    )) as LyraCodeBlockCore;
    await el.updateComplete;
    const first = el.shadowRoot!.querySelector('[data-line="1"]') as HTMLButtonElement;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[data-line="2"]')!.getAttribute('tabindex')).to.equal('0');
  });

  it('does not emit lyra-line-click while interactive-lines is off', async () => {
    const el = (await fixture(html`<lyra-code-block-core code=${'a\nb'} line-numbers></lyra-code-block-core>`)) as LyraCodeBlockCore;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part~="line-button"]').length).to.equal(0);
  });
});
