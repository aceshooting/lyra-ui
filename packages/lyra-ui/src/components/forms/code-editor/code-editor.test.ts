import { fixture, expect, html } from '@open-wc/testing';
import './code-editor.js';
import type { LyraCodeEditor } from './code-editor.js';
import { styles } from './code-editor.styles.js';

it('keeps scrolling on the editor frame instead of creating a nested textarea scrollbar', () => {
  expect(styles.cssText).to.contain('grid-template-columns: auto max-content');
  expect(styles.cssText).to.contain('inline-size: max-content');
  expect(styles.cssText).to.contain('overflow: visible');
});

it('renders line numbers and inserts spaces for Tab', async () => {
  const el = (await fixture(html`<lr-code-editor value="one\ntwo" tab-size="2"></lr-code-editor>`)) as LyraCodeEditor;
  expect(el.shadowRoot!.querySelectorAll('[part="gutter"] div')).to.have.length(2);
  const textarea = el.shadowRoot!.querySelector('textarea')!;
  textarea.focus(); textarea.setSelectionRange(0, 0); textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  expect(el.value).to.contain('  one');
});

// Regression test for a confirmed crash: `tabSize` fed `' '.repeat(Math.max(1, this.tabSize))`
// directly. `String.prototype.repeat()` throws a `RangeError` for a count of `+Infinity`
// specifically (per spec, `ToIntegerOrInfinity` maps `NaN` to `0` -- harmless -- but `Infinity`
// stays `Infinity`, and `repeat()` explicitly rejects that) -- and `Number("Infinity")` is exactly
// what Lit's `type: Number` converter produces for a literal `tab-size="Infinity"` attribute, so
// this was reachable from plain markup, not just a hand-crafted property write. `tabSize` is now
// sanitized to a finite integer in `[1, 16]` at assignment time via `finiteInteger`, so neither
// `Infinity` nor any other non-finite/negative/oversized value ever reaches `repeat()`. Matching
// `finiteInteger`'s own established contract (see e.g. `<lr-qr-code>`'s `size`/`radius`), a
// non-finite input (Infinity/NaN) resolves to the documented fallback default, while a merely
// out-of-range *finite* input clamps to the nearest bound instead.
it('never throws RangeError from an Infinity/NaN/negative tabSize, and clamps it into a safe [1, 16] range', async () => {
  const el = (await fixture(html`<lr-code-editor value="one"></lr-code-editor>`)) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector('textarea')!;
  const pressTab = () => {
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  };

  el.tabSize = Infinity;
  await el.updateComplete;
  expect(pressTab).to.not.throw(RangeError);
  expect(el.tabSize).to.equal(2); // non-finite input falls back to the default, not left as Infinity

  el.value = 'one';
  el.tabSize = NaN;
  expect(el.tabSize).to.equal(2); // falls back to the documented default, not NaN
  await el.updateComplete;
  expect(pressTab).to.not.throw();
  expect(el.value).to.contain('  one'); // still indents (unlike raw NaN, silently a no-op insert)

  el.value = 'one';
  el.tabSize = -5;
  expect(el.tabSize).to.be.at.least(1); // out-of-range but finite -- clamped to the lower bound

  await el.updateComplete;
  expect(pressTab).to.not.throw();

  el.value = 'one';
  el.tabSize = 999;
  expect(el.tabSize).to.equal(16); // out-of-range but finite -- clamped to the upper bound
  await el.updateComplete;
  expect(pressTab).to.not.throw();
  expect(el.value.startsWith(' '.repeat(16))).to.be.true;
});

// `--lr-code-editor-tab-size` used to be inert: the stylesheet read it on the `textarea` part, but
// `render()` also wrote an inline `tab-size:${this.tabSize}` on that very element, and an inline
// declaration always beats a rule. The documented precedence is now: an explicitly assigned
// `tabSize` wins over everything, otherwise a host-level token override wins, otherwise the `:host`
// default of `2`.
describe('tab width precedence', () => {
  const computedTabSize = (el: LyraCodeEditor): string =>
    getComputedStyle(el.shadowRoot!.querySelector('textarea')!).tabSize;
  const pressTab = (el: LyraCodeEditor): void => {
    const textarea = el.shadowRoot!.querySelector('textarea')!;
    textarea.focus();
    textarea.setSelectionRange(0, 0);
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  };

  it('falls back to the token default when neither tabSize nor the token is set', async () => {
    const el = (await fixture(html`<lr-code-editor value="one"></lr-code-editor>`)) as LyraCodeEditor;
    expect(computedTabSize(el)).to.equal('2');
    pressTab(el);
    expect(el.value).to.equal('  one');
  });

  it('honours a host-level --lr-code-editor-tab-size override while tabSize is untouched', async () => {
    const el = (await fixture(
      html`<lr-code-editor value="one" style="--lr-code-editor-tab-size: 8"></lr-code-editor>`,
    )) as LyraCodeEditor;
    expect(computedTabSize(el)).to.equal('8');
    pressTab(el);
    expect(el.value).to.equal(`${' '.repeat(8)}one`);
  });

  it('keeps an explicitly set tabSize winning over a host-level token override', async () => {
    const el = (await fixture(
      html`<lr-code-editor value="one" tab-size="4" style="--lr-code-editor-tab-size: 8"></lr-code-editor>`,
    )) as LyraCodeEditor;
    expect(computedTabSize(el)).to.equal('4');
    pressTab(el);
    expect(el.value).to.equal('    one');

    const assigned = (await fixture(
      html`<lr-code-editor value="one" style="--lr-code-editor-tab-size: 8"></lr-code-editor>`,
    )) as LyraCodeEditor;
    assigned.tabSize = 3;
    await assigned.updateComplete;
    expect(computedTabSize(assigned)).to.equal('3');
    pressTab(assigned);
    expect(assigned.value).to.equal('   one');
  });

  // A length-valued token is a purely visual metric for rendering literal tab characters; it must
  // not be reinterpreted as a count of spaces for the Tab key.
  it('ignores a length-valued token for the indent unit but still renders it', async () => {
    const el = (await fixture(
      html`<lr-code-editor value="one" style="--lr-code-editor-tab-size: 40px"></lr-code-editor>`,
    )) as LyraCodeEditor;
    expect(computedTabSize(el)).to.equal('40px');
    pressTab(el);
    expect(el.value).to.equal('  one');
  });

  it('hands control back to the token when the tab-size attribute is removed', async () => {
    const el = (await fixture(
      html`<lr-code-editor value="one" tab-size="4" style="--lr-code-editor-tab-size: 8"></lr-code-editor>`,
    )) as LyraCodeEditor;
    expect(computedTabSize(el)).to.equal('4');
    el.removeAttribute('tab-size');
    await el.updateComplete;
    expect(computedTabSize(el)).to.equal('8');
    pressTab(el);
    expect(el.value).to.equal(`${' '.repeat(8)}one`);
  });

  // Out-of-range token values go through the same [1, 16] sanitisation as the property.
  it('clamps an out-of-range token before using it as the indent unit', async () => {
    const el = (await fixture(
      html`<lr-code-editor value="one" style="--lr-code-editor-tab-size: 999"></lr-code-editor>`,
    )) as LyraCodeEditor;
    pressTab(el);
    expect(el.value).to.equal(`${' '.repeat(16)}one`);
  });
});

// Keyboard-trap coverage (WCAG 2.1.2): a synthetic KeyboardEvent is untrusted, so the browser
// never performs real focus traversal for it — the observable contract is that the component
// leaves the event un-defaultPrevented (letting a real browser traverse) and inserts nothing.
it('lets Shift+Tab perform native reverse focus traversal instead of inserting spaces', async () => {
  const el = (await fixture(html`<lr-code-editor value="one"></lr-code-editor>`)) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector('textarea')!;
  textarea.focus();
  textarea.setSelectionRange(0, 0);
  const shiftTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
  textarea.dispatchEvent(shiftTab);
  expect(shiftTab.defaultPrevented).to.be.false;
  expect(el.value).to.equal('one');
});

it('releases the next Tab for native forward focus traversal after Escape', async () => {
  const el = (await fixture(html`<lr-code-editor value="one"></lr-code-editor>`)) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector('textarea')!;
  textarea.focus();
  textarea.setSelectionRange(0, 0);
  textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  textarea.dispatchEvent(tab);
  expect(tab.defaultPrevented).to.be.false;
  expect(el.value).to.equal('one');
});

it('re-arms Tab indentation after the Escape bypass is cancelled by typing or by leaving the editor', async () => {
  const el = (await fixture(html`<lr-code-editor value="one" tab-size="2"></lr-code-editor>`)) as LyraCodeEditor;
  const textarea = el.shadowRoot!.querySelector('textarea')!;
  const pressTab = () => {
    textarea.setSelectionRange(0, 0);
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
  };
  textarea.focus();

  // Any non-Tab keypress after Escape means the user resumed editing: Tab indents again.
  textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
  pressTab();
  expect(el.value).to.equal('  one');

  // Leaving the editor (blur) also clears the bypass, so a refocused editor indents on Tab.
  el.value = 'one';
  await el.updateComplete;
  textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  textarea.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  textarea.focus();
  pressTab();
  expect(el.value).to.equal('  one');
});

it('is accessible', async () => {
  const el = await fixture(html`<lr-code-editor label="Source"></lr-code-editor>`);
  await expect(el).to.be.accessible();
});

it('renders hint/errorText text and wires aria-describedby to the visible parts', async () => {
  const el = (await fixture(
    html`<lr-code-editor label="Source" hint="Keep it short" error-text="Required"></lr-code-editor>`,
  )) as LyraCodeEditor;
  const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(hint.hidden).to.be.false;
  expect(hint.textContent).to.contain('Keep it short');
  expect(error.hidden).to.be.false;
  expect(error.textContent).to.contain('Required');
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(textarea.getAttribute('aria-describedby')).to.equal(`${error.id} ${hint.id}`);
});

it('supports label, hint, and error slots with same-shadow description ids', async () => {
  const el = (await fixture(html`
    <lr-code-editor>
      <span slot="label">Slotted label</span>
      <span slot="hint">Slotted hint</span>
      <span slot="error">Slotted error</span>
    </lr-code-editor>
  `)) as LyraCodeEditor;
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(label.hidden).to.be.false;
  expect(hint.hidden).to.be.false;
  expect(error.hidden).to.be.false;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(textarea.getAttribute('aria-describedby')).to.equal(`${error.id} ${hint.id}`);
});

it('hides hint/error parts and omits aria-describedby when unset', async () => {
  const el = (await fixture(html`<lr-code-editor></lr-code-editor>`)) as LyraCodeEditor;
  const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(hint.hidden).to.be.true;
  expect(error.hidden).to.be.true;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  expect(textarea.hasAttribute('aria-describedby')).to.be.false;
});

it('toggles data-invalid once touched and invalid', async () => {
  const el = (await fixture(html`<lr-code-editor required></lr-code-editor>`)) as LyraCodeEditor;
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.false;
  const textarea = el.shadowRoot!.querySelector('textarea') as HTMLTextAreaElement;
  textarea.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.true;
});

it("colors the textarea's placeholder text instead of leaving the UA default", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='textarea'\]::placeholder\s*\{[^}]*color:\s*var\(--lr-color-text-quiet\)/);
});
