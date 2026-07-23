import { fixture, expect, oneEvent, html, aTimeout, waitUntil } from '@open-wc/testing';
import { LitElement, type PropertyValues } from 'lit';
import './combobox.js';
import './option.js';
import '../input/input.js';
import '../select/select.js';
import '../../layout/segmented/segmented.js';
import type { ComboboxFilterDetail, LyraCombobox } from './combobox.js';
import { styles } from './combobox.styles.js';

const basic = () => html`
  <lr-combobox>
    <lr-option value="a">Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </lr-combobox>
`;

async function typeQuery(el: LyraCombobox, text: string) {
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.value = text;
  input.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      composed: true,
      data: text,
      inputType: 'insertText',
    }),
  );
  await el.updateComplete;
  return input;
}

it('exposes exactly one composed InputEvent when the user types', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const inputEvents: Event[] = [];
  let changeCount = 0;
  el.addEventListener('input', (event) => inputEvents.push(event));
  el.addEventListener('change', () => changeCount++);

  await typeQuery(el, 'ban');

  expect(inputEvents.length).to.equal(1);
  expect(inputEvents[0].constructor.name).to.equal('InputEvent');
  expect(inputEvents[0].bubbles).to.be.true;
  expect(inputEvents[0].composed).to.be.true;
  expect(inputEvents[0].cancelable).to.be.false;
  expect((inputEvents[0].target as Element).localName).to.equal('lr-combobox');
  expect((inputEvents[0] as InputEvent).data).to.equal('ban');
  expect((inputEvents[0] as InputEvent).inputType).to.equal('insertText');
  expect((inputEvents[0] as InputEvent).isComposing).to.be.false;
  expect(changeCount).to.equal(0);
});

it('emits lr-change with the new value alongside native-style change/input', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;
  const seen: Array<{ type: string; detail: unknown }> = [];
  for (const type of ['input', 'change', 'lr-change']) {
    el.addEventListener(type, (e) => seen.push({ type, detail: (e as CustomEvent).detail }));
  }
  const option = el.shadowRoot!.querySelectorAll('[part="option"]')[1] as HTMLElement;
  option.click();
  await el.updateComplete;

  expect(seen.map((s) => s.type)).to.deep.equal(['input', 'change', 'lr-change']);
  for (const s of seen) expect(s.detail).to.deep.equal({ value: 'b' });
});

it('emits one native input/change pair, in order, when a row changes the selection', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;
  const events: Event[] = [];
  el.addEventListener('input', (event) => events.push(event));
  el.addEventListener('change', (event) => events.push(event));

  (el.shadowRoot!.querySelectorAll('[part="option"]')[1] as HTMLElement).click();

  expect(events.map((event) => event.type)).to.deep.equal(['input', 'change']);
  expect(events.map((event) => event.constructor.name)).to.deep.equal(['CustomEvent', 'CustomEvent']);
  expect(events.every((event) => event.bubbles && event.composed)).to.be.true;
  expect(events.every((event) => !event.cancelable)).to.be.true;
});

it('emits one native input/change pair for keyboard selection', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.focus();
  el.open = true;
  await el.updateComplete;
  const events: Event[] = [];
  el.addEventListener('input', (event) => events.push(event));
  el.addEventListener('change', (event) => events.push(event));

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

  expect(events.map((event) => event.type)).to.deep.equal(['input', 'change']);
  expect(events.map((event) => event.constructor.name)).to.deep.equal(['CustomEvent', 'CustomEvent']);
});

it('emits one native input/change pair for both adding and toggling off a multiple value', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.open = true;
  await el.updateComplete;
  const events: Event[] = [];
  el.addEventListener('input', (event) => events.push(event));
  el.addEventListener('change', (event) => events.push(event));

  (el.shadowRoot!.querySelectorAll('[part="option"]')[0] as HTMLElement).click();
  expect(events.map((event) => event.type)).to.deep.equal(['input', 'change']);
  expect(events.map((event) => event.constructor.name)).to.deep.equal(['CustomEvent', 'CustomEvent']);

  events.length = 0;
  await el.updateComplete;
  (el.shadowRoot!.querySelectorAll('[part="option"]')[0] as HTMLElement).click();
  expect(events.map((event) => event.type)).to.deep.equal(['input', 'change']);
  expect(events.map((event) => event.constructor.name)).to.deep.equal(['CustomEvent', 'CustomEvent']);
});

it('emits the same native input/change pair when a selected tag is removed', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.value = ['a', 'b'];
  await el.updateComplete;
  const events: Event[] = [];
  el.addEventListener('input', (event) => events.push(event));
  el.addEventListener('change', (event) => events.push(event));

  (el.shadowRoot!.querySelector('[part="tag__remove-button"]') as HTMLButtonElement).click();

  expect(events.map((event) => event.type)).to.deep.equal(['input', 'change']);
  expect(events.map((event) => event.constructor.name)).to.deep.equal(['CustomEvent', 'CustomEvent']);
  expect(events.every((event) => !event.cancelable)).to.be.true;
});

it('emits the native input/change pair when Backspace removes the last tag', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.value = ['a'];
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  const events: Event[] = [];
  el.addEventListener('input', (event) => events.push(event));
  el.addEventListener('change', (event) => events.push(event));

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));

  expect(el.value).to.deep.equal([]);
  expect(events.map((event) => event.type)).to.deep.equal(['input', 'change']);
});

it('emits one input/change pair and one lr-clear event when cleared', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.withClear = true;
  el.value = 'a';
  await el.updateComplete;
  const events: Event[] = [];
  el.addEventListener('input', (event) => events.push(event));
  el.addEventListener('change', (event) => events.push(event));
  el.addEventListener('lr-clear', (event) => events.push(event));

  (el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement).click();

  expect(events.map((event) => event.type)).to.deep.equal(['input', 'change', 'lr-clear']);
  expect(events.slice(0, 2).map((event) => event.constructor.name)).to.deep.equal(['CustomEvent', 'CustomEvent']);
  expect(events.slice(0, 2).every((event) => !event.cancelable)).to.be.true;
});

it('does not emit input/change for programmatic values or re-picking the current single value', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  let eventCount = 0;
  el.addEventListener('input', () => eventCount++);
  el.addEventListener('change', () => eventCount++);

  el.value = 'a';
  await el.updateComplete;
  el.open = true;
  await el.updateComplete;
  (el.shadowRoot!.querySelectorAll('[part="option"]')[0] as HTMLElement).click();

  expect(eventCount).to.equal(0);
});

it('keeps a programmatic value write silent on lr-change too, not just input/change', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  let count = 0;
  for (const type of ['input', 'change', 'lr-change']) {
    el.addEventListener(type, () => count++);
  }
  el.value = 'a';
  await el.updateComplete;
  el.multiple = true;
  el.value = ['a', 'b'];
  await el.updateComplete;
  expect(count).to.equal(0);
});

it('keeps programmatic multiple-value writes silent', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  let eventCount = 0;
  el.addEventListener('input', () => eventCount++);
  el.addEventListener('change', () => eventCount++);

  el.value = ['a', 'b'];
  await el.updateComplete;

  expect(eventCount).to.equal(0);
});

it('filters options and emits change on select (single)', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  await typeQuery(el, 'ban');
  const rows = el.shadowRoot!.querySelectorAll('[part="option"]');
  expect(rows.length).to.equal(1);

  setTimeout(() => (rows[0] as HTMLElement).click());
  await oneEvent(el, 'change');
  expect(el.value).to.equal('b');
});

it('supports multiple selection with tags and array value', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.open = true;
  await el.updateComplete;

  const rows = () => el.shadowRoot!.querySelectorAll('[part="option"]');
  (rows()[0] as HTMLElement).click();
  await el.updateComplete;
  (rows()[2] as HTMLElement).click();
  await el.updateComplete;

  expect(el.value).to.deep.equal(['a', 'c']);
  expect(el.shadowRoot!.querySelectorAll('[part="tag"]').length).to.equal(2);
});

it('removes a value via its tag button', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.value = ['a', 'b'];
  await el.updateComplete;

  const removeBtn = el.shadowRoot!.querySelector('[part="tag__remove-button"]') as HTMLButtonElement;
  removeBtn.click();
  await el.updateComplete;
  expect(el.value).to.deep.equal(['b']);
});

it('clears the value with the clear button', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.withClear = true;
  el.value = 'a';
  await el.updateComplete;

  const clear = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement;
  setTimeout(() => clear.click());
  await oneEvent(el, 'lr-clear');
  expect(el.value).to.equal('');
});

it('opens the listbox on ArrowUp when closed, same as ArrowDown', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  expect(el.open).to.be.false;

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
  await el.updateComplete;
  expect(el.open).to.be.true;
});

it('selects with keyboard (ArrowDown + Enter)', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.focus();
  el.open = true;
  await el.updateComplete;

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  setTimeout(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
  await oneEvent(el, 'change');
  expect(el.value).to.equal('b');
});

it('forwards selection editing methods to the native input and handles an empty name', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.value = 'Apple';
  input.setSelectionRange(1, 3);

  el.selectionStart = 0;
  el.selectionEnd = 2;
  el.selectionDirection = 'backward';
  expect(el.selectionStart).to.equal(0);
  expect(el.selectionEnd).to.equal(2);
  expect(el.selectionDirection).to.equal('backward');

  el.setRangeText('X');
  expect(input.value).to.equal('Xple');
  expect(el.query).to.equal('Xple');

  el.name = 'fruit';
  expect(el.getAttribute('name')).to.equal('fruit');
  el.name = '';
  expect(el.hasAttribute('name')).to.be.false;
});

it('keeps the native editing facade safe before the internal input exists', () => {
  const el = document.createElement('lr-combobox') as LyraCombobox;

  expect(el.input === null).to.be.true;
  expect(el.selectionStart).to.equal(null);
  expect(el.selectionEnd).to.equal(null);
  expect(el.selectionDirection).to.equal(undefined);
  expect(() => {
    el.selectionStart = 0;
    el.selectionEnd = 0;
    el.selectionDirection = 'forward';
    el.setSelectionRange(0, 0);
    el.setRangeText('ignored');
  }).to.not.throw();
});

it('renders the native autocomplete attribute only when configured', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = () => el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;

  expect(input().getAttribute('autocomplete')).to.equal('off');
  el.autocomplete = '';
  await el.updateComplete;
  expect(input().hasAttribute('autocomplete')).to.be.false;
  el.autocomplete = 'one-time-code';
  await el.updateComplete;
  expect(input().getAttribute('autocomplete')).to.equal('one-time-code');
});

it('resolves selectedRows from local rows and uncached async rows', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.value = 'a';
  const state = el as unknown as {
    _selectedRowCache: Map<string, unknown>;
    asyncRows: Array<{ value: string; label: string }>;
  };
  state._selectedRowCache.clear();
  expect(el.selectedRows[0]?.value).to.equal('a');

  el.value = 'remote';
  state._selectedRowCache.clear();
  state.asyncRows = [{ value: 'remote', label: 'Remote' }];
  expect(el.selectedRows[0]?.label).to.equal('Remote');
});

it('participates in a form (single + multiple)', async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-combobox') as LyraCombobox;
  el.value = 'b';
  await el.updateComplete;
  expect(new FormData(form).get('fruit')).to.equal('b');

  el.multiple = true;
  el.value = ['a', 'b'];
  await el.updateComplete;
  expect(new FormData(form).getAll('fruit')).to.deep.equal(['a', 'b']);
});

it('is accessible', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.label = 'Fruit';
  el.open = true;
  await el.updateComplete;
  await expect(el).to.be.accessible();
});

it('is accessible with the listbox open, a keyboard-active option, and selected tags (multiple)', async () => {
  // Populated-state axe check: selected-value tags with their remove buttons, and the
  // aria-activedescendant wiring, only render in this state — the open-but-untouched axe
  // test above exercises neither. Assert the populated markers rendered before running axe.
  const el = (await fixture(basic())) as LyraCombobox;
  el.label = 'Fruit';
  el.multiple = true;
  el.value = ['a', 'b'];
  el.open = true;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="tag"]').length).to.be.greaterThan(0);
  expect(el.shadowRoot!.querySelector('[part="tag__remove-button"]') !== null).to.be.true;
  expect(input.getAttribute('aria-activedescendant')).to.not.be.empty;
  await expect(el).to.be.accessible();
});

it('blocks a required, empty combobox from submitting the form', async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit" required>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;
});

it('focuses the inner input after direct and submit-driven validity reporting', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before combobox</button>
      <lr-combobox name="fruit" required>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector('button') as HTMLButtonElement;
  const el = form.querySelector('lr-combobox') as LyraCombobox;
  let submitCount = 0;
  form.addEventListener('submit', (event) => {
    submitCount += 1;
    event.preventDefault();
  });

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lr-combobox');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('combobox-input');

  sentinel.focus();
  form.requestSubmit();
  expect(submitCount).to.equal(0);
  expect(document.activeElement?.localName).to.equal('lr-combobox');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('combobox-input');
});

it('updates dynamic required validity synchronously without awaiting a Lit update', async () => {
  const el = (await fixture(basic())) as LyraCombobox;

  el.required = true;
  expect(el.hasAttribute('required')).to.be.true;
  expect(el.checkValidity()).to.be.false;

  el.required = false;
  expect(el.hasAttribute('required')).to.be.false;
  expect(el.checkValidity()).to.be.true;
});

it('updates disabled form participation synchronously without awaiting a Lit update', async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-combobox') as LyraCombobox;
  el.value = 'a';
  expect(new FormData(form).get('fruit')).to.equal('a');

  el.disabled = true;
  expect(el.hasAttribute('disabled')).to.be.true;
  expect(new FormData(form).has('fruit')).to.be.false;

  el.disabled = false;
  expect(el.hasAttribute('disabled')).to.be.false;
  expect(new FormData(form).get('fruit')).to.equal('a');
});

it('switches the submitted single/multiple representation synchronously', async () => {
  const form = (await fixture(html`
    <form><lr-combobox name="tags"></lr-combobox></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-combobox') as LyraCombobox;
  el.value = ['a', 'b'];
  expect(new FormData(form).getAll('tags')).to.deep.equal(['a']);

  el.multiple = true;
  expect(el.hasAttribute('multiple')).to.be.true;
  expect(new FormData(form).getAll('tags')).to.deep.equal(['a', 'b']);

  el.multiple = false;
  expect(el.hasAttribute('multiple')).to.be.false;
  expect(new FormData(form).getAll('tags')).to.deep.equal(['a']);
});

it('seeds the initial selection from a declaratively-selected <lr-option>', async () => {
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" selected>Banana</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  expect(el.value).to.equal('b');
});

it('restores the declared default selection on form.reset()', async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b" selected>Banana</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-combobox') as LyraCombobox;
  await el.updateComplete;
  el.value = 'a';
  form.reset();
  expect(el.value).to.equal('b');
});

it('does not let a user pick become the reset default when no option is declared selected', async () => {
  // Regression test: previously the *first* pick on an initially-unselected
  // combobox silently became the permanent reset default, so a later
  // different pick could never reset back to empty.
  const form = (await fixture(html`
    <form>
      <lr-combobox name="fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-combobox') as LyraCombobox;
  await el.updateComplete;
  el.value = 'a';
  el.value = 'b';
  form.reset();
  expect(el.value).to.equal('');
});

it('uses shared svg icons instead of literal glyphs for chevron, clear, and tag-remove', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.withClear = true;
  el.value = ['a'];
  await el.updateComplete;

  const expandIcon = el.shadowRoot!.querySelector('[part="expand-icon"]') as HTMLElement;
  expect(expandIcon.querySelector('svg') !== null).to.be.true;
  expect(expandIcon.textContent?.trim()).to.equal('');

  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLElement;
  expect(clearBtn.querySelector('svg') !== null).to.be.true;
  expect(clearBtn.textContent?.trim()).to.equal('');

  const removeBtn = el.shadowRoot!.querySelector('[part="tag__remove-button"]') as HTMLElement;
  expect(removeBtn.querySelector('svg') !== null).to.be.true;
  expect(removeBtn.textContent?.trim()).to.equal('');

  // The chevron is rotated to a "down" glyph via its wrapping part, not the svg itself.
  expect(styles.cssText).to.include("[part='expand-icon'] svg");
});

it('transitions the listbox with the shared fast-transition token and respects reduced motion', () => {
  const css = styles.cssText;
  const listboxBlock = /\[part=['"]?listbox['"]?]\s*{([^}]*)}/.exec(css);
  expect(listboxBlock, 'expected a base [part="listbox"] rule').to.not.equal(null);
  expect(listboxBlock![1]).to.include('var(--lr-transition-fast)');
  expect(css).to.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

it('uses the shared disabled-opacity token for the disabled host and disabled options', async () => {
  const el = (await fixture(html`
    <lr-combobox open>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b" disabled>Banana</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;

  const css = styles.cssText;
  const disabledHostBlock = /:host\(:disabled\)\s*\[part=['"]?combobox['"]?]\s*{([^}]*)}/.exec(css);
  expect(disabledHostBlock, 'expected a :host(:disabled) [part="combobox"] rule').to.not.equal(null);
  expect(disabledHostBlock![1]).to.include('var(--lr-opacity-disabled)');

  const disabledOptionBlock = /\[part=['"]?option['"]?]\[aria-disabled=['"]?true['"]?]\s*{([^}]*)}/.exec(css);
  expect(disabledOptionBlock, 'expected a [part="option"][aria-disabled="true"] rule').to.not.equal(null);
  expect(disabledOptionBlock![1]).to.include('var(--lr-opacity-disabled)');

  const disabledOption = el.shadowRoot!.querySelectorAll('[part="option"]')[1] as HTMLElement;
  expect(getComputedStyle(disabledOption).opacity).to.equal('0.5');
});

it('exposes --lr-combobox-gap and --lr-combobox-radius, defaulting to the pre-existing literals', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const combobox = el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
  const cs = getComputedStyle(combobox);
  expect(cs.gap).to.equal('4px');
  expect(cs.borderRadius).to.equal('6px');
});

it('retunes the trigger gap and corner radius with no ::part(combobox) rule', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.style.setProperty('--lr-combobox-gap', '12px');
  el.style.setProperty('--lr-combobox-radius', '3px');
  await el.updateComplete;
  const combobox = el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
  const cs = getComputedStyle(combobox);
  expect(cs.gap).to.equal('12px');
  expect(cs.borderRadius).to.equal('3px');
});

it('declares --lr-combobox-gap/--lr-combobox-radius on :host and consumes them once on [part="combobox"]', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/:host \{[^}]*--lr-combobox-gap: var\(--lr-space-xs\);/);
  expect(css).to.match(/:host \{[^}]*--lr-combobox-radius: var\(--lr-radius\);/);
  expect(css).to.include('gap: var(--lr-combobox-gap);');
  expect(css).to.include('border-radius: var(--lr-combobox-radius);');
});

it('gives the clear button and expand icon a real touch target instead of collapsing to bare glyph height', async () => {
  const css = styles.cssText;
  // [part='clear-button'] and [part='expand-icon'] used to share one rule for their sizing; they
  // now resolve independently ([[part='clear-button'] to the full --lr-icon-button-size floor,
  // since it's a real independently-focusable button; [part='expand-icon'] to its smaller capped
  // box, since it's a decorative aria-hidden indicator with no click handler of its own) -- both
  // still reference the shared token.
  // Each part now has its own dedicated sizing rule (in addition to the shared base rule the two
  // still share for layout/color/cursor) -- there can be more than one block whose selector
  // matches either part, so scan every match and require at least one dedicated rule per part to
  // reference the shared token.
  const clearBlocks = [...css.matchAll(/\[part=['"]?clear-button['"]?]\s*{([^}]*)}/g)];
  expect(clearBlocks.length, 'expected at least one [part="clear-button"] rule').to.be.greaterThan(0);
  expect(clearBlocks.some((m) => m[1].includes('var(--lr-icon-button-size)'))).to.be.true;
  const expandBlocks = [...css.matchAll(/\[part=['"]?expand-icon['"]?]\s*{([^}]*)}/g)];
  expect(expandBlocks.length, 'expected at least one [part="expand-icon"] rule').to.be.greaterThan(0);
  expect(expandBlocks.some((m) => m[1].includes('var(--lr-icon-button-size)'))).to.be.true;

  const el = (await fixture(basic())) as LyraCombobox;
  el.withClear = true;
  el.value = 'a';
  await el.updateComplete;
  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLElement;
  expect(clearBtn.getBoundingClientRect().height).to.be.greaterThan(24);
  // WCAG 2.2 SC 2.5.8 requires a 24x24 CSS-px minimum target *in both
  // dimensions* — a tall-but-narrow button still fails it.
  expect(clearBtn.getBoundingClientRect().width).to.be.greaterThan(24);

  const expandIcon = el.shadowRoot!.querySelector('[part="expand-icon"]') as HTMLElement;
  expect(expandIcon.getBoundingClientRect().width).to.be.greaterThan(24);
});

it('meets the shared 40px hit-area floor on the tag remove button and clear button', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.multiple = true;
  el.withClear = true;
  el.value = ['a'];
  await el.updateComplete;

  const removeBtn = el.shadowRoot!.querySelector('[part="tag__remove-button"]') as HTMLElement;
  expect(getComputedStyle(removeBtn).minInlineSize).to.equal('40px');
  expect(getComputedStyle(removeBtn).minBlockSize).to.equal('40px');

  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLElement;
  expect(getComputedStyle(clearBtn).minInlineSize).to.equal('40px');
  expect(getComputedStyle(clearBtn).minBlockSize).to.equal('40px');
});

it('hides the error and hint parts when empty, shows them once populated', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  // Neither part can rely on `:empty` — each always contains a literal
  // `<slot>` child element, so `:empty` never matches regardless of
  // assigned/text content (same bug class fixed for lr-stat).
  expect(getComputedStyle(errorPart).display).to.equal('none');
  expect(getComputedStyle(hintPart).display).to.equal('none');

  el.errorText = 'Selection required';
  el.hint = 'Pick a fruit';
  await el.updateComplete;
  expect(getComputedStyle(errorPart).display).to.not.equal('none');
  expect(getComputedStyle(hintPart).display).to.not.equal('none');
});

it('renders errorText in var(--lr-color-danger), distinct from and alongside the hint', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.hint = 'Pick a fruit';
  el.errorText = 'Selection required';
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  expect(errorPart !== null).to.be.true;
  expect(errorPart.textContent).to.contain('Selection required');
  expect(hintPart.textContent).to.contain('Pick a fruit');
  expect(getComputedStyle(errorPart).color).to.not.equal(getComputedStyle(hintPart).color);
});

it('reflects an invalid state only after the field has been interacted with once', async () => {
  const el = (await fixture(html`
    <lr-combobox required>
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.false;

  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.dispatchEvent(new FocusEvent('focus'));
  input.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(el.hasAttribute('data-invalid')).to.be.true;
});

it('shows a required-field asterisk after the label', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.label = 'Fruit';
  el.required = true;
  await el.updateComplete;

  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  const after = getComputedStyle(label, '::after');
  expect(after.content).to.contain('*');
});

it('does not render an orphaned asterisk when required but no label is provided', async () => {
  const el = (await fixture(html`
    <lr-combobox required>
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;

  // The label box always contains a literal `<slot name="label">` child,
  // so `:empty` can never match it (same bug class already fixed for
  // hint/error) -- real emptiness must be tracked in JS and reflected via
  // `hidden`, or the required-asterisk `::after` (which attaches to this
  // box) renders a stray ' *' with nothing before it.
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  expect(getComputedStyle(label).display).to.equal('none');
});

it('applies the shared focus-ring tokens to the clear and tag-remove buttons', () => {
  const css = styles.cssText;
  const clearFocusBlock = /\[part=['"]?clear-button['"]?]:focus-visible,\s*\[part=['"]?tag__remove-button['"]?]:focus-visible\s*{([^}]*)}/.exec(css);
  expect(clearFocusBlock, 'expected a shared clear/tag-remove :focus-visible rule').to.not.equal(null);
  expect(clearFocusBlock![1]).to.include('var(--lr-focus-ring-width)');
  expect(clearFocusBlock![1]).to.include('var(--lr-focus-ring-color)');
});

it('renders a data-value on each option row for delegated click/mousedown handling', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;
  const first = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  expect(first.dataset.value).to.equal('a');
});

it('resolves the correct row via a delegated listbox listener after a re-render reorders options', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;
  // Force a re-render that changes row content (typing a filter) -- the
  // delegated listbox listener must resolve *current* row data via its
  // data-value lookup rather than any closure captured in an earlier render.
  await typeQuery(el, 'a');
  await el.updateComplete;
  const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  setTimeout(() => row.click());
  await oneEvent(el, 'change');
  expect(el.value).to.equal('a');
});

it('pairs the form-control label with the combobox input via for/id so clicking the label focuses it', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.label = 'Fruit';
  await el.updateComplete;
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLLabelElement;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  expect(label.htmlFor, 'label should have a for attribute').to.not.equal('');
  expect(label.htmlFor).to.equal(input.id);
});

it('renders sub and dot-color from light-DOM options', async () => {
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="a" sub="Running" dot-color="green">Meter A</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="option-sub"]')!.textContent).to.equal('Running');
  expect((el.shadowRoot!.querySelector('[part="option-dot"]') as HTMLElement).style.background).to.equal(
    'green',
  );
});

it('sanitizes maxOptionsVisible/maxRender to finite non-negative integers instead of poisoning the row cap/tag cap with NaN', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;

  el.maxOptionsVisible = NaN;
  expect(el.maxOptionsVisible).to.equal(3); // falls back to the documented default

  el.maxOptionsVisible = -5;
  expect(el.maxOptionsVisible).to.equal(0); // clamped to the non-negative floor

  el.maxRender = NaN;
  expect(el.maxRender).to.equal(200); // falls back to the documented default

  el.maxRender = -5;
  expect(el.maxRender).to.equal(0); // clamped to the non-negative floor

  // A capped-to-0 maxRender must not crash renderRows()/renderedRows -- rendering falls through to
  // the empty-listbox message (no rows survive the 0-sized cap), rather than throwing.
  const opt = document.createElement('lr-option');
  opt.value = '0';
  opt.textContent = 'Item 0';
  el.appendChild(opt);
  el.open = true;
  expect(async () => await el.updateComplete).to.not.throw();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(0);
});

it('caps rendered rows at maxRender and shows an overflow indicator', async () => {
  const el = (await fixture(html`<lr-combobox max-render="3"></lr-combobox>`)) as LyraCombobox;
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement('lr-option');
    opt.value = `${i}`;
    opt.textContent = `Item ${i}`;
    el.appendChild(opt);
  }
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(3);
  expect(el.shadowRoot!.querySelector('[part="option-overflow"]')!.textContent).to.contain('+7 more');
});

it('always keeps the current selection visible even when capped out', async () => {
  const el = (await fixture(html`<lr-combobox max-render="3"></lr-combobox>`)) as LyraCombobox;
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement('lr-option');
    opt.value = `${i}`;
    opt.textContent = `Item ${i}`;
    el.appendChild(opt);
  }
  el.value = '9';
  el.open = true;
  await el.updateComplete;

  const rows = Array.from(el.shadowRoot!.querySelectorAll('[part="option"]'));
  expect(rows.some((r) => r.textContent?.includes('Item 9'))).to.be.true;
});

it('calls source with the current query (debounced) and renders its rows', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  const calls: string[] = [];
  el.source = async (query: string) => {
    calls.push(query);
    return [{ value: 'x', label: `Result for "${query}"` }];
  };
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  expect(calls).to.deep.equal(['']);
  expect(el.shadowRoot!.querySelector('[part="option"] [part="option-label"]')!.textContent).to.contain(
    'Result for ""',
  );

  await typeQuery(el, 'ban');
  await aTimeout(250);
  await el.updateComplete;

  expect(calls).to.deep.equal(['', 'ban']);
});

it('shows a loading row while an in-flight source call is pending', async () => {
  const el = (await fixture(html`<lr-combobox source-delay="500"></lr-combobox>`)) as LyraCombobox;
  let resolve!: (rows: { value: string; label: string }[]) => void;
  el.source = () => new Promise((r) => (resolve = r));
  el.open = true;
  await el.updateComplete;
  await waitUntil(
    () => el.shadowRoot!.querySelector('.loading') !== null,
    'loading state was not rendered after the source debounce',
    { timeout: 2000 },
  );

  // Resolving the source promise only fires the `.then()` -> set asyncRows -> `.finally()` ->
  // set loading=false chain on later microtask ticks (`.finally()` is itself a `.then()` under
  // the hood), so a single already-scheduled `updateComplete` await can resolve before that
  // chain -- and the render it triggers -- has actually run. `aTimeout(0)` forces a macrotask
  // boundary that lets all of those microtasks (and the resulting Lit update) drain first.
  resolve([{ value: 'x', label: 'Found' }]);
  await aTimeout(0);
  await el.updateComplete;

  // Boolean-cast rather than `.to.not.exist` on the live element: if this ever regresses, chai/
  // loupe formatting a failing HTMLElement can stall long enough to blow through the test
  // runner's timeout, hiding the real assertion failure behind a misleading "did not finish" hang.
  expect(!!el.shadowRoot!.querySelector('.loading')).to.equal(false);
});

it('ignores a stale source response that resolves after a newer query', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  const resolvers: Array<(rows: { value: string; label: string }[]) => void> = [];
  el.source = () => new Promise((r) => resolvers.push(r));
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);

  await typeQuery(el, 'second');
  await aTimeout(250);

  expect(resolvers).to.have.length(2);
  resolvers[0]([{ value: 'stale', label: 'Stale result' }]);
  await aTimeout(0);
  await el.updateComplete;
  resolvers[1]([{ value: 'fresh', label: 'Fresh result' }]);
  // See the comment in the "shows a loading row" test above: resolving triggers a `.then()` ->
  // set asyncRows -> render chain that needs a macrotask boundary to fully settle before a
  // subsequent `updateComplete` reliably reflects it.
  await aTimeout(0);
  await el.updateComplete;

  // `.trim()`: `[part="option-label"]`'s textContent includes the template's own whitespace
  // (it wraps the label in a nested `<span>` alongside a conditional `sub` span), so comparing
  // the raw textContent against a bare label string was never actually going to match.
  const labels = Array.from(el.shadowRoot!.querySelectorAll('[part="option-label"]')).map((n) =>
    n.textContent?.trim(),
  );
  expect(labels).to.deep.equal(['Fresh result']);
});

it('registers the click-outside listener and fires lr-show/lr-hide when `open` is set directly, bypassing show()/hide()', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  await el.updateComplete;

  setTimeout(() => {
    el.open = true;
  });
  await oneEvent(el, 'lr-show');
  await el.updateComplete;
  expect(el.open).to.be.true;

  // A pointerdown anywhere outside the element must still dismiss it, even
  // though `show()` (which normally registers the listener) was never called.
  setTimeout(() => {
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  });
  await oneEvent(el, 'lr-hide');
  expect(el.open).to.be.false;
});

it('closes the listbox on a pointerdown outside the element after it was opened via focus', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.dispatchEvent(new FocusEvent('focus'));
  await el.updateComplete;
  expect(el.open).to.be.true;

  document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('re-fetches with the reset query after picking a row, refreshing stale async results (multiple + source)', async () => {
  const el = (await fixture(html`<lr-combobox multiple></lr-combobox>`)) as LyraCombobox;
  const calls: string[] = [];
  el.source = async (query: string) => {
    calls.push(query);
    return query === 'ban'
      ? [{ value: 'b', label: 'Banana' }]
      : [
          { value: 'a', label: 'Apple' },
          { value: 'b', label: 'Banana' },
        ];
  };
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  await typeQuery(el, 'ban');
  await aTimeout(250);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(1);

  const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  row.click();
  await aTimeout(250);
  await el.updateComplete;

  expect(calls).to.deep.equal(['', 'ban', '']);
  const labels = Array.from(el.shadowRoot!.querySelectorAll('[part="option-label"]')).map((n) =>
    n.textContent?.trim(),
  );
  expect(labels).to.deep.equal(['Apple', 'Banana']);
});

it('re-fetches with the reset query after clear(), refreshing stale async results (source mode)', async () => {
  const el = (await fixture(html`<lr-combobox with-clear></lr-combobox>`)) as LyraCombobox;
  const calls: string[] = [];
  el.source = async (query: string) => {
    calls.push(query);
    return query === 'ban'
      ? [{ value: 'b', label: 'Banana' }]
      : [
          { value: 'a', label: 'Apple' },
          { value: 'b', label: 'Banana' },
        ];
  };
  el.value = 'b';
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  await typeQuery(el, 'ban');
  await aTimeout(250);
  await el.updateComplete;

  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement;
  setTimeout(() => clearBtn.click());
  await oneEvent(el, 'lr-clear');
  await aTimeout(250);
  await el.updateComplete;

  expect(calls).to.deep.equal(['', 'ban', '']);
});

it('seeds the selection from a <lr-option selected> appended after the initial slotchange', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  await el.updateComplete;
  expect(el.value).to.equal('');

  const opt = document.createElement('lr-option');
  opt.setAttribute('value', 'd');
  opt.textContent = 'Date';
  opt.selected = true;
  el.appendChild(opt);
  // slotchange fires on its own microtask queue -- force a macrotask
  // boundary (see the source-debounce tests above) before asserting.
  await aTimeout(0);
  await el.updateComplete;

  expect(el.value).to.equal('d');
  expect(opt.selected).to.be.true;
});

it('does not merge two nameless multiple comboboxes under a shared "value" form key', async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox multiple>
        <lr-option value="a" selected>Apple</lr-option>
      </lr-combobox>
      <lr-combobox multiple>
        <lr-option value="b" selected>Banana</lr-option>
      </lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const els = Array.from(form.querySelectorAll('lr-combobox')) as LyraCombobox[];
  await Promise.all(els.map((e) => e.updateComplete));
  expect(els.map((e) => e.value)).to.deep.equal([['a'], ['b']]);

  expect(new FormData(form).getAll('value')).to.deep.equal([]);
});

it('clears the pending debounced source timer on disconnect so a detached element never invokes a stale fetch', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  let called = false;
  el.source = async () => {
    called = true;
    return [];
  };
  await typeQuery(el, 'ban');
  el.remove();
  await aTimeout(250);
  expect(called).to.be.false;
});

it('uses a custom filter function instead of the default label/searchText matcher when provided', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.filter = (option, query) => option.value === query;
  el.open = true;
  await el.updateComplete;

  await typeQuery(el, 'a');
  // The default label/searchText matcher would also match "Banana" (its
  // label contains "a"); only the custom filter narrows this to one row.
  const rows = el.shadowRoot!.querySelectorAll('[part="option"]');
  expect(rows.length).to.equal(1);
  expect(rows[0].textContent).to.contain('Apple');
});

it('renders a group-label header when option rows are grouped', async () => {
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="a" group="Fruits">Apple</lr-option>
      <lr-option value="b" group="Fruits">Banana</lr-option>
      <lr-option value="c" group="Vegetables">Carrot</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  const groups = Array.from(el.shadowRoot!.querySelectorAll('.group-label')).map((n) => n.textContent);
  expect(groups).to.deep.equal(['Fruits', 'Vegetables']);
});

it('caps visible tags at maxOptionsVisible and shows a "+N" overflow tag', async () => {
  const el = (await fixture(html`
    <lr-combobox multiple max-options-visible="2">
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
      <lr-option value="c">Cherry</lr-option>
      <lr-option value="d">Date</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.value = ['a', 'b', 'c', 'd'];
  await el.updateComplete;

  const tags = el.shadowRoot!.querySelectorAll('[part="tag"]');
  expect(tags.length).to.equal(3);
  expect(tags[2].textContent?.trim()).to.equal('+2 more');
});

it('shows the empty-state message with a custom emptyText when no rows match', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.emptyText = 'Nothing here';
  el.open = true;
  await el.updateComplete;

  await typeQuery(el, 'zzz');
  const empty = el.shadowRoot!.querySelector('.empty');
  expect(empty !== null).to.be.true;
  expect(empty!.textContent).to.equal('Nothing here');
});

// The loadingText/emptyText/overflowText props are passed to localize() as
// `this.xText || undefined`, so with the props unset the .strings/registry
// path must resolve each listbox message -- a set prop wins verbatim instead
// (covered by the emptyText test above).
it('resolves the loading message through .strings when loadingText is unset', async () => {
  const el = (await fixture(
    html`<lr-combobox .strings=${{ loading: 'Chargement…' }}></lr-combobox>`,
  )) as LyraCombobox;
  el.source = () => new Promise(() => {});
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('.loading')!.textContent).to.equal('Chargement…');
});

it('resolves the no-matches message through .strings when emptyText is unset', async () => {
  const el = (await fixture(
    html`<lr-combobox .strings=${{ noMatches: 'Aucun résultat' }}></lr-combobox>`,
  )) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('.empty')!.textContent).to.equal('Aucun résultat');
});

it('resolves the overflow indicator through .strings, interpolating {n}, when overflowText is unset', async () => {
  const el = (await fixture(
    html`<lr-combobox max-render="3" .strings=${{ comboboxOverflow: '+{n} de plus' }}></lr-combobox>`,
  )) as LyraCombobox;
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement('lr-option');
    opt.value = `${i}`;
    opt.textContent = `Item ${i}`;
    el.appendChild(opt);
  }
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="option-overflow"]')!.textContent).to.contain('+7 de plus');
});

it('disables the combobox when its containing fieldset is disabled', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-combobox name="fruit">
          <lr-option value="a">Apple</lr-option>
        </lr-combobox>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-combobox') as LyraCombobox;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  await el.updateComplete;
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.false;

  fieldset.disabled = true;
  await el.updateComplete;
  // `el.disabled` (the consumer-facing IDL property/attribute) is never
  // mutated by fieldset cascading -- only the combined `effectiveDisabled`
  // reflects it (mirrors native `<input>` and the Task 2 FormAssociated
  // mixin's own `_fieldsetDisabled`/`effectiveDisabled` pattern).
  expect((el as unknown as { effectiveDisabled: boolean }).effectiveDisabled).to.be.true;
  expect(el.disabled).to.be.false;
  const combobox = el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
  expect(getComputedStyle(combobox).opacity).to.equal('0.5');
  expect(getComputedStyle(combobox).cursor).to.equal('not-allowed');
});

it('is accessible while showing the loading state (async source pending)', async () => {
  const el = (await fixture(html`<lr-combobox source-delay="0"></lr-combobox>`)) as LyraCombobox;
  el.source = () => new Promise(() => {});
  el.open = true;
  await el.updateComplete;

  await waitUntil(
    () => el.shadowRoot!.querySelector('.loading') !== null,
    'loading state was not rendered before the accessibility check',
    { timeout: 2000 },
  );
  await expect(el).to.be.accessible();
});

it('renders structured async-row adornments and preserves selected opaque data', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  const payload = { kind: 'city', longitude: 6.13 };
  el.source = async () => [
    {
      value: 'lux',
      label: 'Luxembourg',
      sub: 'Lëtzebuerg',
      icon: html`<span>⌖</span>`,
      badge: 'City',
      accessibleLabel: 'Luxembourg, city in Luxembourg',
      data: payload,
    },
  ];
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  expect(row.getAttribute('aria-label')).to.equal('Luxembourg, city in Luxembourg');
  expect(row.querySelector('[part="option-icon"]')?.getAttribute('aria-hidden')).to.equal('true');
  expect(row.querySelector('[part="option-badge"]')?.textContent).to.equal('City');
  row.click();
  await el.updateComplete;
  expect(el.selectedRows).to.have.length(1);
  expect(el.selectedRows[0]!.data).to.equal(payload);
});

it('retains a loaded async row when its value is selected programmatically before a later query omits it', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  const payload = { kind: 'city', longitude: 6.13 };
  el.source = async (query) =>
    query ? [] : [{ value: 'lux', label: 'Luxembourg', data: payload }];
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  el.value = 'lux';
  await el.updateComplete;
  await typeQuery(el, 'elsewhere');
  await aTimeout(250);
  await el.updateComplete;

  expect(el.selectedRows).to.have.length(1);
  expect(el.selectedRows[0]!.data).to.equal(payload);
});

it('is accessible while showing the empty state (no matching rows)', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('.empty') !== null).to.be.true;
  await expect(el).to.be.accessible();
});

it('reflects required/invalid state onto the input as aria-required/aria-invalid', async () => {
  const el = (await fixture(html`
    <lr-combobox required>
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  expect(input.getAttribute('aria-required')).to.equal('true');
  expect(input.getAttribute('aria-invalid')).to.equal('false');

  input.dispatchEvent(new FocusEvent('focus'));
  input.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(input.getAttribute('aria-invalid')).to.equal('true');
});

it('closes the listbox when the input blurs (e.g. tabbing away), not just on outside click or Escape', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.dispatchEvent(new FocusEvent('focus'));
  await el.updateComplete;
  expect(el.open).to.be.true;

  input.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('keeps the dropdown open on a mousedown inside the listbox but outside any option (scrollbar, group label, overflow row)', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.focus();
  await el.updateComplete;
  expect(el.open).to.be.true;

  const listbox = el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement;
  const ev = new MouseEvent('mousedown', { bubbles: true, composed: true, cancelable: true });
  listbox.dispatchEvent(ev);
  // The browser's default action for an uncancelled mousedown moves focus to
  // the pressed element, blurring the input. Synthetic dispatchEvent never
  // runs default actions, so replicate that blur here for the un-prevented
  // path -- exactly what happens when a user grabs the listbox scrollbar.
  if (!ev.defaultPrevented) input.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;

  expect(el.open, 'dropdown must stay open while interacting with the listbox itself').to.be.true;
  expect(ev.defaultPrevented, 'mousedown default must be prevented so the input keeps focus').to.be.true;
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('combobox-input');
});

it('ignores a mousedown on the combobox container while disabled', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.disabled = true;
  await el.updateComplete;

  const container = el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
  container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
});

it('prefers a host-level aria-label over label/placeholder for the input', async () => {
  const el = (await fixture(
    html`<lr-combobox aria-label="Filter items" placeholder="Search…"></lr-combobox>`,
  )) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLElement;
  expect(input.getAttribute('aria-label')).to.equal('Filter items');
});

it('falls back to placeholder when no host aria-label or label is set', async () => {
  const el = (await fixture(html`<lr-combobox placeholder="Search…"></lr-combobox>`)) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLElement;
  expect(input.getAttribute('aria-label')).to.equal('Search…');
});

it('re-syncs the submitted FormData when `name` changes after a value is already set', async () => {
  const form = document.createElement('form');
  const el = (await fixture(html`
    <lr-combobox name="a"><lr-option value="x" selected></lr-option></lr-combobox>
  `)) as LyraCombobox;
  form.appendChild(el);
  document.body.appendChild(form);
  el.name = 'b';
  await el.updateComplete;
  const data = new FormData(form);
  expect(data.has('a')).to.be.false;
  expect(data.get('b')).to.equal('x');
  form.remove();
});

it('reflects `name` onto the attribute synchronously, with no await/microtask in between', async () => {
  // `reflect: true` alone defers the attribute write to Lit's async update
  // cycle (a microtask), not the property setter itself -- so
  // `el.name = 'b'; new FormData(form)` (no `await` in between) could still
  // observe the stale attribute. The hand-written `name` accessor must write
  // the attribute inline, matching Task 2's `FormAssociated.name`.
  const el = (await fixture(basic())) as LyraCombobox;
  el.name = 'b';
  expect(el.getAttribute('name')).to.equal('b');
});

it('rebinds multiple FormData entries to a new name synchronously', async () => {
  const form = (await fixture(html`
    <form>
      <lr-combobox name="old" multiple .value=${['a', 'b']}></lr-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-combobox') as LyraCombobox;

  el.name = 'next';
  const data = new FormData(form);

  expect(data.has('old')).to.be.false;
  expect(data.getAll('next')).to.deep.equal(['a', 'b']);
});

it('re-syncs FormData when switching between single and multiple mode', async () => {
  const form = document.createElement('form');
  const el = (await fixture(html`
    <lr-combobox name="tags"><lr-option value="x" selected></lr-option></lr-combobox>
  `)) as LyraCombobox;
  form.appendChild(el);
  document.body.appendChild(form);
  // Force two entries into `_selected` while still in single mode (the
  // `value` setter itself doesn't gate on `multiple`, so this doesn't
  // require a second declared-`selected` option, which single mode would
  // collapse down to just the last one anyway). This makes a two-entry
  // `data.getAll('tags')` below only possible if switching `multiple` on
  // actually re-ran `syncFormValue()`'s `FormData.append()` path -- the old
  // single-value path (`setFormValue(this._selected[0] ?? '')`, still in
  // effect from the most recent `value` assignment) can only ever produce
  // one entry, so a stale sync would leave just `['x']`.
  el.value = ['x', 'y'];
  await el.updateComplete;
  el.multiple = true;
  await el.updateComplete;
  const data = new FormData(form);
  expect(data.getAll('tags')).to.deep.equal(['x', 'y']);
  form.remove();
});

it('keeps the clear and tag-remove buttons disabled while the combobox is disabled', async () => {
  const el = (await fixture(html`
    <lr-combobox disabled multiple with-clear><lr-option value="x" selected></lr-option></lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement | null;
  const removeBtn = el.shadowRoot!.querySelector('[part="tag__remove-button"]') as HTMLButtonElement | null;
  expect(clearBtn?.disabled).to.be.true;
  expect(removeBtn?.disabled).to.be.true;
});

it('restores its own explicit `disabled` after an ancestor fieldset re-enables', async () => {
  const el = (await fixture(html`<lr-combobox disabled></lr-combobox>`)) as LyraCombobox;
  (el as unknown as { formDisabledCallback(d: boolean): void }).formDisabledCallback(true);
  (el as unknown as { formDisabledCallback(d: boolean): void }).formDisabledCallback(false);
  await el.updateComplete;
  expect(el.disabled).to.be.true;
});

it('resets `open` to false on disconnect so a reconnect never resumes half-open with stale positioning/listeners', async () => {
  // The actual fix behavior: `disconnectedCallback()` sets `open = false`
  // rather than leaving it `true` across the disconnect -- a naive assertion
  // that `listbox.style.position` is non-empty after reconnect would pass
  // regardless, since that inline style is set once on first open and never
  // cleared, whether or not reconnect logic runs at all.
  const el = (await fixture(html`<lr-combobox open><lr-option value="x"></lr-option></lr-combobox>`)) as LyraCombobox;
  await el.updateComplete;
  expect(el.open).to.be.true;

  const parent = el.parentElement!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('re-renders when an already-slotted option mutates its own label', async () => {
  const el = (await fixture(html`<lr-combobox><lr-option value="x">Old label</lr-option></lr-combobox>`)) as LyraCombobox;
  // Open *before* mutating the option's label so the `lr-option-change`
  // notification path (MutationObserver -> emit -> `onOptionChange()`
  // reassigning `options`) is the only thing that can update the
  // already-rendered row afterward -- opening *after* the mutation (the
  // previous version of this test) forces an ordinary first-render read of
  // live option data regardless of whether that path ever fired.
  el.open = true;
  await el.updateComplete;
  const row = () => el.shadowRoot!.querySelector('[part="option"]')!;
  expect(row().textContent).to.include('Old label');

  const option = el.querySelector('lr-option')!;
  option.textContent = 'New label';
  // The MutationObserver callback (and the `lr-option-change` ->
  // `onOptionChange()` -> `requestUpdate()` chain it triggers) runs on its
  // own microtask queue -- by the time this line reaches `updateComplete`,
  // the getter may still capture the *previous*, already-settled update
  // promise rather than the new one the mutation is about to schedule. Force
  // a macrotask boundary first (same fix as the slotchange/async-source
  // timing elsewhere in this file) so the new update is already pending (or
  // done) by the time `updateComplete` is evaluated below.
  await aTimeout(0);
  await el.updateComplete;
  expect(row().textContent).to.include('New label');
});

it('recovers loading=false and does not throw when source() rejects', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  // A bare `.finally()` (with no `.catch()`) would also reset `loading` back
  // to `false` while leaving the rejection unhandled -- spy on
  // `console.warn` to prove the `.catch()` handler itself specifically ran
  // and consumed the rejection, not just that `loading` incidentally ended
  // up `false` via a code path that was never actually broken.
  const originalWarn = console.warn;
  const warnCalls: unknown[][] = [];
  console.warn = (...args: unknown[]) => {
    warnCalls.push(args);
  };
  try {
    el.source = async () => {
      throw new Error('network failure');
    };
    el.open = true;
    await el.updateComplete;
    await aTimeout(250);
    expect((el as unknown as { loading: boolean }).loading).to.be.false;
    expect(warnCalls.length).to.be.greaterThan(0);
    expect(String(warnCalls[0][0])).to.include('rejected');
  } finally {
    console.warn = originalWarn;
  }
});

it('recovers loading=false when source() throws synchronously instead of returning a rejected promise', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  const error = new Error('synchronous failure');
  const originalWarn = console.warn;
  const warnCalls: unknown[][] = [];
  console.warn = (...args: unknown[]) => warnCalls.push(args);
  try {
    el.source = (() => {
      throw error;
    }) as unknown as (query: string) => Promise<import('./combobox.js').ComboboxSourceRow[]>;
    el.open = true;
    await el.updateComplete;
    await aTimeout(250);
    expect((el as unknown as { loading: boolean }).loading).to.be.false;
  } finally {
    console.warn = originalWarn;
  }
  expect(warnCalls.flat()).to.contain(error);
  expect(String(warnCalls[0][0])).to.include('rejected');
});

it('resolves a programmatically-set value to its label from asyncRows, warming the fetch before the listbox ever opens (single-select)', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  el.source = async () => [
    { value: 'a', label: 'Apple' },
    { value: 'b', label: 'Banana' },
  ];
  // Set the value first, then let the element render -- this must warm
  // `asyncRows` on its own, without the listbox ever having been opened.
  el.value = 'b';
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  expect(el.open).to.be.false;
  expect(input.value).to.equal('Banana');
});

it('associates grouped options through role=group and aria-labelledby', async () => {
  const el = (await fixture(html`
    <lr-combobox open>
      <lr-option value="a" group="Fruit">Apple</lr-option>
      <lr-option value="b" group="Fruit">Banana</lr-option>
      <lr-option value="c" group="Vegetables">Carrot</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await aTimeout(0);
  await el.updateComplete;
  const groups = [...el.shadowRoot!.querySelectorAll('[role="group"]')] as HTMLElement[];
  expect(groups.length).to.equal(2);
  for (const group of groups) {
    const labelId = group.getAttribute('aria-labelledby')!;
    expect(labelId).to.not.equal('');
    expect(el.shadowRoot!.getElementById(labelId)?.textContent?.trim()).to.not.equal('');
    expect(group.querySelectorAll('[role="option"]').length).to.be.greaterThan(0);
  }
});

it('omits aria-activedescendant when no option is active', async () => {
  const el = (await fixture(html`<lr-combobox open></lr-combobox>`)) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  expect(input.hasAttribute('aria-activedescendant')).to.be.false;
});

it('localizes and locale-formats the selected-tag overflow count', async () => {
  const el = (await fixture(html`
    <lr-combobox multiple max-options-visible="1" locale="ar-EG"
      .strings=${{ comboboxSelectedOverflow: '{n} إضافية' }}>
      <lr-option value="a">A</lr-option>
      <lr-option value="b">B</lr-option>
      <lr-option value="c">C</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.value = ['a', 'b', 'c'];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="tag"]')[1]!.textContent?.trim()).to.equal('٢ إضافية');
});

it('renders a localized alert and clears stale rows when an async source fails', async () => {
  const el = (await fixture(html`
    <lr-combobox source-delay="0" open
      .strings=${{ comboboxLoadError: 'Options unavailable' }}></lr-combobox>
  `)) as LyraCombobox;
  el.source = async () => {
    throw new Error('private server detail');
  };
  await el.updateComplete;
  await aTimeout(20);
  await el.updateComplete;
  const alert = el.shadowRoot!.querySelector('[role="alert"]') as HTMLElement;
  expect(alert.textContent?.trim()).to.equal('Options unavailable');
  expect(alert.textContent).to.not.contain('private server detail');
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(0);
});

it('invalidates an in-flight request when source is replaced and clamps active state after shrink', async () => {
  let resolveOld!: (rows: import('./combobox.js').ComboboxSourceRow[]) => void;
  const oldRows = new Promise<import('./combobox.js').ComboboxSourceRow[]>((resolve) => {
    resolveOld = resolve;
  });
  const el = (await fixture(html`<lr-combobox source-delay="0" open></lr-combobox>`)) as LyraCombobox;
  el.source = () => oldRows;
  await el.updateComplete;
  await aTimeout(10);

  el.source = async () => [{ value: 'new', label: 'New' }];
  await el.updateComplete;
  await aTimeout(10);
  await el.updateComplete;
  resolveOld([{ value: 'old', label: 'Old' }]);
  await aTimeout(0);
  await el.updateComplete;

  const labels = [...el.shadowRoot!.querySelectorAll('[part="option"]')]
    .map((row) => row.textContent?.trim());
  expect(labels).to.deep.equal(['New']);
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  expect(input.hasAttribute('aria-activedescendant')).to.be.false;
});

it('resolves a programmatically-set value to its label from asyncRows in multi-select tag chips', async () => {
  const el = (await fixture(html`<lr-combobox multiple></lr-combobox>`)) as LyraCombobox;
  el.source = async () => [
    { value: 'a', label: 'Apple' },
    { value: 'b', label: 'Banana' },
  ];
  el.value = ['a', 'b'];
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  const tagLabels = Array.from(el.shadowRoot!.querySelectorAll('[part="tag"]')).map((t) => t.textContent?.trim());
  expect(tagLabels).to.deep.equal(['Apple', 'Banana']);
});

it('resets an abandoned single-select filter query on close (Escape) so a reopen does not show stale text', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  const input = await typeQuery(el, 'ban');
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(1);

  // Dismiss via Escape without picking a row.
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await el.updateComplete;
  expect(el.open).to.be.false;

  el.open = true;
  await el.updateComplete;
  const reopenedInput = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  expect(reopenedInput.value).to.equal('');
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(3);
});

it('resets an abandoned single-select filter query on close (blur) so a reopen does not show stale text', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  const input = await typeQuery(el, 'ban');
  input.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(el.open).to.be.false;

  el.open = true;
  await el.updateComplete;
  const reopenedInput = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  expect(reopenedInput.value).to.equal('');
});

it('keeps a preserved out-of-cap selection in its own group instead of duplicating the group header at the tail', async () => {
  const el = (await fixture(html`<lr-combobox multiple max-render="4"></lr-combobox>`)) as LyraCombobox;
  for (const v of ['a0', 'a1', 'a2', 'a3', 'a4', 'a5']) {
    const opt = document.createElement('lr-option');
    opt.value = v;
    opt.setAttribute('group', 'Fruits');
    opt.textContent = v;
    el.appendChild(opt);
  }
  for (const v of ['b0', 'b1', 'b2']) {
    const opt = document.createElement('lr-option');
    opt.value = v;
    opt.setAttribute('group', 'Vegetables');
    opt.textContent = v;
    el.appendChild(opt);
  }
  await el.updateComplete;

  // 'b0' precedes 'a4' in `_selected` even though 'a4' comes first in
  // document order -- the old append-at-the-tail logic rendered them in
  // this (wrong) relative order, splitting the "Fruits" group into two
  // blocks separated by "Vegetables" and duplicating its header.
  el.value = ['b0', 'a4'];
  el.open = true;
  await el.updateComplete;

  const groupLabels = Array.from(el.shadowRoot!.querySelectorAll('.group-label')).map((n) => n.textContent);
  expect(groupLabels).to.deep.equal(['Fruits', 'Vegetables']);
});

it('uses a custom loadingText instead of the hardcoded default while a source call is pending', async () => {
  const el = (await fixture(html`<lr-combobox loading-text="Fetching…"></lr-combobox>`)) as LyraCombobox;
  el.source = () => new Promise(() => {});
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('.loading')!.textContent).to.equal('Fetching…');
});

it('uses a custom overflowText with a {n} token substitution instead of the hardcoded default', async () => {
  const el = (await fixture(
    html`<lr-combobox max-render="3" overflow-text="Only 3 shown, {n} hidden"></lr-combobox>`,
  )) as LyraCombobox;
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement('lr-option');
    opt.value = `${i}`;
    opt.textContent = `Item ${i}`;
    el.appendChild(opt);
  }
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="option-overflow"]')!.textContent).to.equal(
    'Only 3 shown, 7 hidden',
  );
});

it('jumps to the first row on Home and the last navigable row on End', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.focus();
  el.open = true;
  await el.updateComplete;

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  await el.updateComplete;

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
  await el.updateComplete;
  let activeRow = el.shadowRoot!.getElementById(input.getAttribute('aria-activedescendant')!);
  expect(activeRow?.textContent).to.contain('Apple');

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await el.updateComplete;
  activeRow = el.shadowRoot!.getElementById(input.getAttribute('aria-activedescendant')!);
  expect(activeRow?.textContent).to.contain('Cherry');
});

it('skips a trailing disabled option so End lands on the last navigable row', async () => {
  const el = (await fixture(html`
    <lr-combobox>
      <lr-option value="a">Apple</lr-option>
      <lr-option value="b">Banana</lr-option>
      <lr-option value="c" disabled>Cherry</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.focus();
  el.open = true;
  await el.updateComplete;

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
  await el.updateComplete;
  const activeRow = el.shadowRoot!.getElementById(input.getAttribute('aria-activedescendant')!);
  expect(activeRow?.textContent).to.contain('Banana');
});

it('scrolls the keyboard-active option into view in a scrolling listbox', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  for (let i = 0; i < 20; i++) {
    const opt = document.createElement('lr-option');
    opt.value = `${i}`;
    opt.textContent = `Item ${i}`;
    el.appendChild(opt);
  }
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  input.focus();
  el.open = true;
  await el.updateComplete;
  const box = el.shadowRoot!.querySelector('[part="listbox"]') as HTMLElement;

  // The listbox is height-capped (max-block-size: 18rem) and scrollable --
  // 20 rows overflow it, so arrowing this far down would otherwise leave the
  // active row scrolled out of view (same fix/test shape as
  // lr-mention-popover's identical listbox).
  for (let i = 0; i < 15; i++) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
  }

  const activeRow = el.shadowRoot!.querySelector('[part="option"][data-active]') as HTMLElement;
  expect(activeRow !== null).to.be.true;
  const rowRect = activeRow.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  expect(rowRect.top >= boxRect.top - 1, 'active row top must be within the scrolled listbox viewport').to.be.true;
  expect(rowRect.bottom <= boxRect.bottom + 1, 'active row bottom must be within the scrolled listbox viewport').to
    .be.true;
});

it('prunes _selectedLabelCache back to the live selection instead of growing unboundedly', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
  el.source = async () => [{ value: 'lux', label: 'Luxembourg' }];
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  // pickRow() -- driven here via a real row click, not a direct `value`
  // assignment -- is the only place that ever writes into
  // `_selectedLabelCache`.
  const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
  row.click();
  await el.updateComplete;
  const labelCache = (el as unknown as { _selectedLabelCache: Map<string, string> })._selectedLabelCache;
  expect(labelCache.has('lux')).to.be.true;

  // Deselecting -- the same `value` setter that already prunes
  // `_selectedRowCache` back to the live selection -- must prune the label
  // cache the same way instead of leaving a permanent orphaned entry.
  el.value = '';
  await el.updateComplete;
  expect(labelCache.has('lux')).to.be.false;
});

it('registers the outside-click pointerdown listener on this.ownerDocument, not the bare global document', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  const fakeDoc = document.implementation.createHTMLDocument('fake');
  let addCalls = 0;
  let removeCalls = 0;
  const originalAdd = fakeDoc.addEventListener.bind(fakeDoc);
  const originalRemove = fakeDoc.removeEventListener.bind(fakeDoc);
  fakeDoc.addEventListener = ((...args: Parameters<typeof originalAdd>) => {
    addCalls++;
    return originalAdd(...args);
  }) as typeof fakeDoc.addEventListener;
  fakeDoc.removeEventListener = ((...args: Parameters<typeof originalRemove>) => {
    removeCalls++;
    return originalRemove(...args);
  }) as typeof fakeDoc.removeEventListener;
  // Swaps what `this.ownerDocument` resolves to for this instance only --
  // proves the listener is registered against the *instance's own*
  // document rather than the bare global `document` the module closure
  // captured at evaluation time (the bug this regression guards against
  // only manifests when those two differ, e.g. a same-origin iframe).
  Object.defineProperty(el, 'ownerDocument', { value: fakeDoc, configurable: true });

  el.open = true;
  await el.updateComplete;
  expect(addCalls).to.equal(1);

  el.open = false;
  await el.updateComplete;
  expect(removeCalls).to.equal(1);
});

it('folds the filter query and option labels through locale-aware toLocaleLowerCase, not the invariant toLowerCase', async () => {
  // Under a Turkish/Azeri locale, invariant `toLowerCase()` maps capital
  // dotted İ (U+0130) to 'i' + a combining dot above (U+0069 U+0307), not
  // plain 'i' -- so `'İstanbul'.toLowerCase()` never contains the substring
  // 'istanbul' a user actually types. `toLocaleLowerCase('tr')` folds it
  // correctly to plain 'istanbul'.
  const el = (await fixture(html`
    <lr-combobox locale="tr">
      <lr-option value="ist">İstanbul</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  await typeQuery(el, 'istanbul');
  const rows = el.shadowRoot!.querySelectorAll('[part="option"]');
  expect(rows.length).to.equal(1);
});

describe('size', () => {
  it('defaults to size="m" and reflects the attribute', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    expect(el.size).to.equal('m');
    expect(el.getAttribute('size')).to.equal('m');
  });

  it('applies size="2xs" with a 20px trigger min-height', async () => {
    const el = await fixture(html`<lr-combobox size="2xs" label="Tags"></lr-combobox>`);
    const trigger = el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
    expect(getComputedStyle(trigger).minBlockSize).to.equal('20px');
  });

  it('reflects size="2xs" as a host attribute', async () => {
    const el = (await fixture(html`<lr-combobox size="2xs"></lr-combobox>`)) as LyraCombobox;
    expect(el.size).to.equal('2xs');
    expect(el.getAttribute('size')).to.equal('2xs');
  });

  it('a non-default size changes the trigger min-block-size', async () => {
    const mEl = (await fixture(basic())) as LyraCombobox;
    const xsEl = (await fixture(html`
      <lr-combobox size="xs">
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    const mBox = mEl.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
    const xsBox = xsEl.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
    expect(parseFloat(getComputedStyle(xsBox).minHeight)).to.be.lessThan(
      parseFloat(getComputedStyle(mBox).minHeight),
    );
  });

  it('aligns input, select, combobox, and segmented at size="s" without part overrides', async () => {
    const root = await fixture(html`
      <div style="display:flex;align-items:center;">
        <lr-input size="s" aria-label="Input"></lr-input>
        <lr-select size="s" aria-label="Select"></lr-select>
        <lr-combobox size="s" aria-label="Combobox"><lr-option value="a">Apple</lr-option></lr-combobox>
        <lr-segmented
          size="s"
          value="a"
          .items=${[{ value: 'a', label: 'Alpha' }]}
        ></lr-segmented>
      </div>
    `);
    const input = root.querySelector('lr-input')!.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
    const select = root.querySelector('lr-select')!.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement;
    const combobox = root.querySelector('lr-combobox')!.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
    const segmented = root.querySelector('lr-segmented')!.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const heights = [input, select, combobox, segmented].map((element) => element.getBoundingClientRect().height);
    expect(new Set(heights).size, `control heights: ${heights.join(', ')}`).to.equal(1);

    const expand = root.querySelector('lr-combobox')!.shadowRoot!.querySelector('[part="expand-icon"]') as HTMLElement;
    expect(expand.getAttribute('aria-hidden')).to.equal('true');
    expect(expand.hasAttribute('tabindex')).to.be.false;
    expect(expand.getBoundingClientRect().height).to.be.at.most(combobox.getBoundingClientRect().height);
  });

  it('the "+N" overflow tag scales its font-size with size', async () => {
    const mEl = (await fixture(html`
      <lr-combobox multiple max-options-visible="0">
        <lr-option value="a" selected>Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    const xsEl = (await fixture(html`
      <lr-combobox multiple max-options-visible="0" size="xs">
        <lr-option value="a" selected>Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await mEl.updateComplete;
    await xsEl.updateComplete;
    const mTag = mEl.shadowRoot!.querySelector('[part="tag"]') as HTMLElement;
    const xsTag = xsEl.shadowRoot!.querySelector('[part="tag"]') as HTMLElement;
    expect(parseFloat(getComputedStyle(xsTag).fontSize)).to.be.lessThan(
      parseFloat(getComputedStyle(mTag).fontSize),
    );
  });
});

describe('native input surface', () => {
  it('forwards native editing-assistance attributes to the internal input', async () => {
    const el = (await fixture(html`
      <lr-combobox
        autocomplete="one-time-code"
        inputmode="search"
        enterkeyhint="done"
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
      ></lr-combobox>
    `)) as LyraCombobox;
    const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;

    expect(input.getAttribute('autocomplete')).to.equal('one-time-code');
    expect(input.getAttribute('inputmode')).to.equal('search');
    expect(input.getAttribute('enterkeyhint')).to.equal('done');
    expect(input.spellcheck).to.be.false;
    expect(input.getAttribute('autocapitalize')).to.equal('off');
    expect(input.getAttribute('autocorrect')).to.equal('off');
  });

  it('supports clearable while retaining with-clear as a compatibility alias', async () => {
    const clearable = (await fixture(html`
      <lr-combobox clearable>
        <lr-option value="a" selected>Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await clearable.updateComplete;
    expect(clearable.shadowRoot!.querySelector('[part="clear-button"]') !== null).to.be.true;

    const legacy = (await fixture(html`
      <lr-combobox with-clear>
        <lr-option value="a" selected>Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await legacy.updateComplete;
    expect(legacy.shadowRoot!.querySelector('[part="clear-button"]') !== null).to.be.true;
  });

  it('forwards focus, blur, selection, and range editing to the internal input', async () => {
    const el = (await fixture(html`<lr-combobox multiple></lr-combobox>`)) as LyraCombobox;
    const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;

    el.focus();
    expect(el.shadowRoot!.activeElement === input).to.be.true;

    input.value = 'hello world';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    el.setSelectionRange(6, 11, 'forward');
    expect(el.selectionStart).to.equal(6);
    expect(el.selectionEnd).to.equal(11);
    expect(el.selectionDirection).to.equal('forward');

    el.setRangeText('there', 6, 11, 'select');
    await el.updateComplete;
    expect(el.input?.value).to.equal('hello there');

    el.select();
    expect(el.selectionStart).to.equal(0);
    expect(el.selectionEnd).to.equal('hello there'.length);

    el.blur();
    expect(el.shadowRoot!.activeElement === null).to.be.true;
  });

  it('bridges native focus and blur as bubbling, composed host events', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;

    const focusPromise = oneEvent(el, 'focus');
    input.focus();
    const focusEvent = await focusPromise;
    expect(focusEvent.bubbles).to.be.true;
    expect(focusEvent.composed).to.be.true;

    const blurPromise = oneEvent(el, 'blur');
    input.blur();
    const blurEvent = await blurPromise;
    expect(blurEvent.bubbles).to.be.true;
    expect(blurEvent.composed).to.be.true;
  });
});

describe('lr-filter (live filter text)', () => {
  /** Collects every `lr-filter` detail value in dispatch order. */
  function trackFilter(el: LyraCombobox): { values: string[]; events: CustomEvent<ComboboxFilterDetail>[] } {
    const values: string[] = [];
    const events: CustomEvent<ComboboxFilterDetail>[] = [];
    el.addEventListener('lr-filter', (event) => {
      events.push(event);
      values.push(event.detail.value);
    });
    return { values, events };
  }

  it('emits one lr-filter per keystroke carrying the in-progress filter text', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    const { values, events } = trackFilter(el);

    await typeQuery(el, 'b');
    await typeQuery(el, 'ba');
    await typeQuery(el, 'ban');

    expect(values).to.deep.equal(['b', 'ba', 'ban']);
    expect(events.every((event) => event.bubbles && event.composed)).to.be.true;
    expect(events.every((event) => !event.cancelable)).to.be.true;
    expect(events.every((event) => (event.target as Element).localName === 'lr-combobox')).to.be.true;
  });

  it('emits lr-filter when the user clears the filter text back to empty', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    await typeQuery(el, 'ban');
    const { values } = trackFilter(el);

    await typeQuery(el, '');

    expect(values).to.deep.equal(['']);
  });

  it('does not emit lr-filter when a pointer selection commits and resets the query (single)', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.open = true;
    await el.updateComplete;
    await typeQuery(el, 'ban');
    const { values } = trackFilter(el);
    const changes: string[] = [];
    el.addEventListener('change', (event) => changes.push(event.type));

    (el.shadowRoot!.querySelectorAll('[part="option"]')[0] as HTMLElement).click();
    await el.updateComplete;

    expect(el.value).to.equal('b');
    expect(changes).to.deep.equal(['change']);
    expect(values).to.deep.equal([]);
  });

  it('does not emit lr-filter when a keyboard selection commits and resets the query (multiple)', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.multiple = true;
    const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
    input.focus();
    el.open = true;
    await el.updateComplete;
    await typeQuery(el, 'ban');
    const { values } = trackFilter(el);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await el.updateComplete;

    expect(el.value).to.deep.equal(['b']);
    expect(values).to.deep.equal([]);
  });

  it('does not emit lr-filter for a value write, form.reset(), or closing the listbox', async () => {
    const form = (await fixture(html`
      <form>
        <lr-combobox name="fruit" clearable>
          <lr-option value="a">Apple</lr-option>
          <lr-option value="b" selected>Banana</lr-option>
        </lr-combobox>
      </form>
    `)) as HTMLFormElement;
    const el = form.querySelector('lr-combobox') as LyraCombobox;
    await el.updateComplete;
    await typeQuery(el, 'app');
    const { values } = trackFilter(el);
    // The clear button IS a user-driven filter writer -- see the 'clear affordance on the filter
    // axis' suite below for its own lr-filter coverage.

    // Programmatic `value` assignment.
    el.value = 'a';
    await el.updateComplete;
    expect(values, 'value assignment must not emit lr-filter').to.deep.equal([]);

    // form.reset() -> formResetCallback() blanks the query.
    await typeQuery(el, 'che');
    values.length = 0;
    form.reset();
    await el.updateComplete;
    expect(values, 'form.reset() must not emit lr-filter').to.deep.equal([]);

    // Closing the listbox (single mode) abandons the in-progress query.
    await typeQuery(el, 'che');
    values.length = 0;
    el.open = false;
    await el.updateComplete;
    expect(values, 'closing the listbox must not emit lr-filter').to.deep.equal([]);
  });

  it('does not emit lr-filter for the programmatic setRangeText() editing API', async () => {
    const el = (await fixture(html`<lr-combobox multiple></lr-combobox>`)) as LyraCombobox;
    await typeQuery(el, 'hello world');
    const { values } = trackFilter(el);

    el.setSelectionRange(6, 11, 'forward');
    el.setRangeText('there', 6, 11, 'select');
    await el.updateComplete;

    expect(el.input?.value).to.equal('hello there');
    expect(values).to.deep.equal([]);
  });

  it('reports the filter text, never the committed selection (single)', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.open = true;
    await el.updateComplete;
    (el.shadowRoot!.querySelectorAll('[part="option"]')[0] as HTMLElement).click();
    await el.updateComplete;
    expect(el.value).to.equal('a');

    const { values } = trackFilter(el);
    await typeQuery(el, 'che');

    expect(values).to.deep.equal(['che']);
    expect(el.value).to.equal('a');
  });

  it('reports the filter text, never the committed selection (multiple)', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.multiple = true;
    el.open = true;
    await el.updateComplete;
    (el.shadowRoot!.querySelectorAll('[part="option"]')[0] as HTMLElement).click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(['a']);

    const { values } = trackFilter(el);
    await typeQuery(el, 'che');

    expect(values).to.deep.equal(['che']);
    expect(el.value).to.deep.equal(['a']);
  });
});

describe('exact-height escape hatch', () => {
  const combo = (el: LyraCombobox) => el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;

  it('keeps the per-size min-height floor when --lr-combobox-trigger-height is unset', async () => {
    const mEl = (await fixture(basic())) as LyraCombobox;
    const sEl = (await fixture(html`
      <lr-combobox size="s"><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    expect(getComputedStyle(combo(mEl)).minBlockSize).to.equal('40px');
    expect(getComputedStyle(combo(sEl)).minBlockSize).to.equal('30px');
  });

  it('pins an exact trigger height with no ::part() rule, at the default and non-default sizes', async () => {
    const mEl = (await fixture(basic())) as LyraCombobox;
    mEl.style.setProperty('--lr-combobox-trigger-height', '44px');
    await mEl.updateComplete;
    expect(getComputedStyle(combo(mEl)).blockSize).to.equal('44px');
    expect(getComputedStyle(combo(mEl)).minBlockSize).to.equal('44px');

    const sEl = (await fixture(html`
      <lr-combobox size="s"><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    sEl.style.setProperty('--lr-combobox-trigger-height', '44px');
    await sEl.updateComplete;
    expect(getComputedStyle(combo(sEl)).blockSize).to.equal('44px');
  });

  it('does not clip a wrapping multi-select tag row when a height is pinned', async () => {
    const el = (await fixture(html`
      <lr-combobox multiple max-options-visible="6" style="inline-size:9rem">
        <lr-option value="a" selected>Alphabet</lr-option>
        <lr-option value="b" selected>Buttercup</lr-option>
        <lr-option value="c" selected>Chrysanthemum</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    el.style.setProperty('--lr-combobox-trigger-height', '40px');
    await el.updateComplete;
    const box = combo(el);
    expect(getComputedStyle(box).blockSize).to.equal('40px');
    // Documented behaviour: the hatch is a single-row affordance. A tag row that wraps past the
    // pinned height overflows visibly rather than being clipped, so nothing becomes unreachable.
    expect(getComputedStyle(box).overflow).to.equal('visible');
    expect(box.scrollHeight).to.be.greaterThan(box.clientHeight);
  });

  it('renders lr-select, lr-combobox and lr-input at one exact toolbar height with no ::part() rule', async () => {
    const root = await fixture(html`
      <div style="display:flex;align-items:center;">
        <lr-input aria-label="Input" style="--lr-input-control-height:44px"></lr-input>
        <lr-select aria-label="Select" style="--lr-select-trigger-height:44px"></lr-select>
        <lr-combobox aria-label="Combobox" style="--lr-combobox-trigger-height:44px">
          <lr-option value="a">Apple</lr-option>
        </lr-combobox>
      </div>
    `);
    const parts = [
      root.querySelector('lr-input')!.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement,
      root.querySelector('lr-select')!.shadowRoot!.querySelector('[part="trigger"]') as HTMLElement,
      root.querySelector('lr-combobox')!.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement,
    ];
    const heights = parts.map((element) => element.getBoundingClientRect().height);
    expect(heights, `control heights: ${heights.join(', ')}`).to.deep.equal([44, 44, 44]);
  });
});

describe('start/end adornment slots', () => {
  const part = (el: LyraCombobox, name: string) =>
    el.shadowRoot!.querySelector(`[part="${name}"]`) as HTMLElement;

  it('renders a slotted glyph inside the trigger, before the field text, with no consumer padding', async () => {
    const el = (await fixture(html`
      <lr-combobox size="s" label="Fruit">
        <svg slot="start" width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5"></circle></svg>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    const start = part(el, 'start');
    expect(start.hasAttribute('hidden')).to.be.false;
    const startRect = start.getBoundingClientRect();
    const boxRect = part(el, 'combobox').getBoundingClientRect();
    const inputRect = part(el, 'combobox-input').getBoundingClientRect();
    expect(startRect.width).to.be.greaterThan(0);
    expect(startRect.left).to.be.at.least(boxRect.left);
    expect(startRect.right).to.be.at.most(inputRect.left + 1);
  });

  it('places the end adornment before the expand icon', async () => {
    const el = (await fixture(html`
      <lr-combobox label="Fruit">
        <kbd slot="end">K</kbd>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    const end = part(el, 'end');
    expect(end.hasAttribute('hidden')).to.be.false;
    expect(end.compareDocumentPosition(part(el, 'expand-icon')) & Node.DOCUMENT_POSITION_FOLLOWING).to.be.greaterThan(0);
    expect(end.getBoundingClientRect().right).to.be.at.most(
      part(el, 'expand-icon').getBoundingClientRect().left + 1,
    );
  });

  it('hides both wrappers when nothing is slotted', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    await el.updateComplete;
    expect(part(el, 'start').hasAttribute('hidden')).to.be.true;
    expect(part(el, 'end').hasAttribute('hidden')).to.be.true;
    expect(getComputedStyle(part(el, 'start')).display).to.equal('none');
    expect(getComputedStyle(part(el, 'end')).display).to.equal('none');
  });

  it('reveals the wrapper when an adornment is slotted in after first render', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    const glyph = document.createElement('span');
    glyph.slot = 'start';
    glyph.textContent = '⌕';
    el.append(glyph);
    await el.updateComplete;
    await el.updateComplete;
    expect(part(el, 'start').hasAttribute('hidden')).to.be.false;
  });

  it('places the start adornment on the inline-start under dir="rtl"', async () => {
    const root = await fixture(html`
      <div dir="rtl">
        <lr-combobox label="Fruit">
          <span slot="start">⌕</span>
          <lr-option value="a">Apple</lr-option>
        </lr-combobox>
      </div>
    `);
    const el = root.querySelector('lr-combobox') as LyraCombobox;
    await el.updateComplete;
    const startRect = part(el, 'start').getBoundingClientRect();
    const inputRect = part(el, 'combobox-input').getBoundingClientRect();
    expect(startRect.left).to.be.greaterThan(inputRect.left);
  });

  it('does not collect adornment content as an option', async () => {
    const el = (await fixture(html`
      <lr-combobox label="Fruit" open>
        <span slot="start">⌕</span>
        <kbd slot="end">K</kbd>
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(2);
  });

  it('is accessible with adornments slotted and the listbox open', async () => {
    const el = (await fixture(html`
      <lr-combobox label="Fruit" open>
        <span slot="start" aria-hidden="true">⌕</span>
        <kbd slot="end">K</kbd>
        <lr-option value="a">Apple</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(1);
    await expect(el).to.be.accessible();
  });
});

describe('clear affordance on the filter axis', () => {
  const clearButton = (el: LyraCombobox) =>
    el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement | null;
  const inputEl = (el: LyraCombobox) =>
    el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;

  it('renders the clear button for a query-only state and clearing it emits lr-filter with an empty value', async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await typeQuery(el, 'foo');
    expect(el.value).to.equal('');
    const button = clearButton(el);
    expect(button !== null, 'clear button should render for a query with no selection').to.be.true;

    const filtered = oneEvent(el, 'lr-filter');
    button!.click();
    const event = (await filtered) as CustomEvent<ComboboxFilterDetail>;
    expect(event.detail.value).to.equal('');
    await el.updateComplete;
    expect(inputEl(el).value).to.equal('');
    expect(clearButton(el) === null).to.be.true;
  });

  it('does not emit change/input/lr-clear for a query-only clear', async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit"><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    await typeQuery(el, 'foo');
    let changes = 0;
    let clears = 0;
    let inputs = 0;
    el.addEventListener('change', () => changes++);
    el.addEventListener('lr-clear', () => clears++);
    el.addEventListener('input', () => inputs++);

    clearButton(el)!.click();
    await el.updateComplete;
    expect(changes).to.equal(0);
    expect(clears).to.equal(0);
    expect(inputs).to.equal(0);
  });

  it('still emits change and lr-clear when a real selection is cleared', async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit"><lr-option value="a" selected>Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    let changes = 0;
    el.addEventListener('change', () => changes++);
    const cleared = oneEvent(el, 'lr-clear');
    clearButton(el)!.click();
    await cleared;
    await el.updateComplete;
    expect(changes).to.equal(1);
    expect(el.value).to.equal('');
  });

  it('announces both axes when a selection and a query are cleared together', async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b" selected>Banana</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    await typeQuery(el, 'app');
    const filters: string[] = [];
    let changes = 0;
    let clears = 0;
    el.addEventListener('lr-filter', (event) => filters.push((event as CustomEvent<ComboboxFilterDetail>).detail.value));
    el.addEventListener('change', () => changes++);
    el.addEventListener('lr-clear', () => clears++);

    clearButton(el)!.click();
    await el.updateComplete;
    expect(filters).to.deep.equal(['']);
    expect(changes).to.equal(1);
    expect(clears).to.equal(1);
    expect(el.value).to.equal('');
  });

  it('emits no lr-filter when a selection is cleared with an already-empty query', async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit"><lr-option value="a" selected>Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    let filters = 0;
    el.addEventListener('lr-filter', () => filters++);
    clearButton(el)!.click();
    await el.updateComplete;
    expect(filters).to.equal(0);
  });

  it('hides the clear button for a single-select query the user cannot see (listbox closed)', async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit"><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    await typeQuery(el, 'foo');
    expect(clearButton(el) !== null).to.be.true;
    // A direct `open = false` write bypasses hide()'s own query reset, which is exactly the state
    // where `displayValue` shows the selected label (here: nothing) rather than `query`.
    el.open = false;
    await el.updateComplete;
    expect(inputEl(el).value).to.equal('');
    expect(clearButton(el) === null).to.be.true;
  });

  it('keeps the clear button for a multi-select query while closed, where the query is still visible', async () => {
    const el = (await fixture(html`
      <lr-combobox clearable multiple label="Fruit"><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    await typeQuery(el, 'foo');
    el.open = false;
    await el.updateComplete;
    expect(inputEl(el).value).to.equal('foo');
    expect(clearButton(el) !== null).to.be.true;
  });

  it('leaves the clear button absent when neither a selection nor a query exists', async () => {
    const el = (await fixture(html`
      <lr-combobox clearable label="Fruit" open><lr-option value="a">Apple</lr-option></lr-combobox>
    `)) as LyraCombobox;
    await el.updateComplete;
    expect(clearButton(el) === null).to.be.true;
  });
});

/** Render the max-inline-size declared on `selector` (read off the element's own applied stylesheets)
 *  into the component's shadow scope with the viewport-clamp token pinned to a tiny value, returning
 *  its resolved computed value. Wired to --lr-popover-viewport-clamp the min() collapses to that
 *  pinned value; a leftover 92vw/90vw literal would resolve to something else. */
function renderedClamp(el: HTMLElement, selector: string): string {
  const normalize = (text: string) => text.replace(/"/g, "'");
  let declared = '';
  for (const sheet of el.shadowRoot!.adoptedStyleSheets) {
    for (const rule of sheet.cssRules) {
      if (
        rule instanceof CSSStyleRule &&
        normalize(rule.selectorText) === normalize(selector) &&
        rule.style.maxInlineSize
      ) {
        declared = rule.style.maxInlineSize;
      }
    }
  }
  const probe = document.createElement('span');
  probe.style.display = 'block';
  probe.style.setProperty('--lr-popover-viewport-clamp', '10px');
  probe.style.maxInlineSize = declared;
  el.shadowRoot!.appendChild(probe);
  const value = getComputedStyle(probe).maxInlineSize;
  probe.remove();
  return value;
}

it('clamps its floating surface width through the shared popover-viewport-clamp token', async () => {
  const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as HTMLElement;
  await (el as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
  expect(renderedClamp(el, "[part='listbox']")).to.equal('10px');
});

it("colors the combobox-input's placeholder text instead of leaving the UA default", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='combobox-input'\]::placeholder\s*\{[^}]*color:\s*var\(--lr-color-text-quiet\)/);
});

it("renders the combobox-input's ::placeholder in the shared quiet-text token's color (getComputedStyle, not just source text)", async () => {
  // The test above only proves the token string appears in the stylesheet source -- it can't
  // catch a rule that stops matching the real DOM (wrong selector, broken specificity, a
  // shadow-DOM part boundary issue). This reads the actual rendered pseudo-element instead.
  const el = (await fixture(
    html`<lr-combobox style="--lr-color-text-quiet: rgb(12, 34, 56)"></lr-combobox>`,
  )) as LyraCombobox;
  await el.updateComplete;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLInputElement;
  expect(getComputedStyle(input, '::placeholder').color).to.equal('rgb(12, 34, 56)');
});

// -- Hover states (mouse-modality parity with the focus ring) --------------

it('gives the clear button a :hover rule, matching its own :focus-visible affordance', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='clear-button'\]:hover/);
});

it("gives a selected tag's remove button a :hover rule, matching its own :focus-visible affordance", () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='tag__remove-button'\]:hover/);
});

// -- Per-component theming indirection --------------------------------------

describe('--lr-combobox-option-active-bg', () => {
  it('retints a hovered/active option row via the cssprop, not just the bare shared token', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.open = true;
    await el.updateComplete;
    el.style.setProperty('--lr-combobox-option-active-bg', 'rgb(10, 20, 30)');
    const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
    // [data-active] shares the same declaration as :hover in the stylesheet (comma-separated) --
    // real :hover can't be forced from test JS without an actual pointer move, so this exercises
    // the identical rule via its keyboard-active twin.
    row.setAttribute('data-active', '');
    expect(getComputedStyle(row).backgroundColor).to.equal('rgb(10, 20, 30)');
  });

  it('still falls back to the shared --lr-color-brand-quiet token when unset', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.open = true;
    await el.updateComplete;
    el.style.setProperty('--lr-color-brand-quiet', 'rgb(40, 50, 60)');
    const row = el.shadowRoot!.querySelector('[part="option"]') as HTMLElement;
    row.setAttribute('data-active', '');
    expect(getComputedStyle(row).backgroundColor).to.equal('rgb(40, 50, 60)');
  });
});

describe('selected-state theming tokens', () => {
  it('honours --lr-combobox-option-selected-color on the selected row', async () => {
    const el = (await fixture(html`
      <lr-combobox style="--lr-combobox-option-selected-color: rgb(1, 2, 3);">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    el.value = 'a';
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector('[part="option"][aria-selected="true"]') as HTMLElement;
    expect(getComputedStyle(selected).color).to.equal('rgb(1, 2, 3)');
  });

  it('honours --lr-combobox-option-selected-bg on the selected row', async () => {
    const el = (await fixture(html`
      <lr-combobox style="--lr-combobox-option-selected-bg: rgb(4, 5, 6);">
        <lr-option value="a">Apple</lr-option>
        <lr-option value="b">Banana</lr-option>
      </lr-combobox>
    `)) as LyraCombobox;
    el.value = 'a';
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector('[part="option"][aria-selected="true"]') as HTMLElement;
    expect(getComputedStyle(selected).backgroundColor).to.equal('rgb(4, 5, 6)');
  });

  it('leaves the selected row at the brand color when the token is unset (regression)', async () => {
    const el = (await fixture(basic())) as LyraCombobox;
    el.value = 'a';
    el.open = true;
    await el.updateComplete;
    const selected = el.shadowRoot!.querySelector('[part="option"][aria-selected="true"]') as HTMLElement;
    const brand = getComputedStyle(el).getPropertyValue('--lr-color-brand').trim();
    const probe = document.createElement('span');
    probe.style.color = brand;
    document.body.appendChild(probe);
    const expected = getComputedStyle(probe).color;
    document.body.removeChild(probe);
    expect(getComputedStyle(selected).color).to.equal(expected);
  });
});

// -- Host click() forwarding -------------------------------------------------

it('forwards host click() to opening the listbox and focusing the filter input', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  expect(el.open).to.be.false;

  el.click();
  await el.updateComplete;

  expect(el.open).to.be.true;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]');
  expect(el.shadowRoot!.activeElement === input).to.be.true;
});

it('does not open or steal focus when host click() is called while disabled', async () => {
  const el = (await fixture(html`
    <lr-combobox disabled>
      <lr-option value="a">Apple</lr-option>
    </lr-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;

  el.click();
  await el.updateComplete;

  expect(el.open).to.be.false;
});

// -- ElementInternals availability -------------------------------------------

describe('ElementInternals availability', () => {
  it('does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)', () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraCombobox | undefined;
      expect(() => {
        el = document.createElement('lr-combobox') as LyraCombobox;
      }).to.not.throw();
      // Confirm the fallback keeps the rest of the public surface usable rather than merely
      // swallowing the constructor error.
      expect(el!.checkValidity()).to.be.true;
      expect(el!.form === null).to.be.true;
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

// -- Lifecycle super calls ---------------------------------------------------

it('chains willUpdate() to super.willUpdate() so a mixin layered under LyraElement would still run', async () => {
  // No shared mixin actually overrides willUpdate() today, so the only way to prove the chain is
  // live (rather than grepping source text for the call) is to patch the base-class hook itself
  // -- the exact hook a future mixin would extend -- and confirm it actually fires.
  const hadOwn = Object.prototype.hasOwnProperty.call(LitElement.prototype, 'willUpdate');
  const original = (LitElement.prototype as unknown as { willUpdate?: (changed: PropertyValues) => void })
    .willUpdate;
  let called = false;
  (LitElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void }).willUpdate = function (
    this: LitElement,
    changed: PropertyValues,
  ) {
    called = true;
    original?.call(this, changed);
  };
  try {
    // Deliberately no slotted `<lr-option>` children: they're LyraElement subclasses too, and if
    // this used `basic()` a passing result couldn't distinguish "the combobox itself chained the
    // call" from "some sibling LyraElement in the fixture happened to trigger the patched hook".
    const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    if (hadOwn) {
      (LitElement.prototype as unknown as { willUpdate: unknown }).willUpdate = original;
    } else {
      delete (LitElement.prototype as unknown as { willUpdate?: unknown }).willUpdate;
    }
  }
});

it('chains updated() to super.updated() so a mixin layered under LyraElement would still run', async () => {
  const hadOwn = Object.prototype.hasOwnProperty.call(LitElement.prototype, 'updated');
  const original = (LitElement.prototype as unknown as { updated?: (changed: PropertyValues) => void }).updated;
  let called = false;
  (LitElement.prototype as unknown as { updated: (changed: PropertyValues) => void }).updated = function (
    this: LitElement,
    changed: PropertyValues,
  ) {
    called = true;
    original?.call(this, changed);
  };
  try {
    // Deliberately no slotted `<lr-option>` children -- see the identical note in the
    // willUpdate() version of this test above.
    const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    if (hadOwn) {
      (LitElement.prototype as unknown as { updated: unknown }).updated = original;
    } else {
      delete (LitElement.prototype as unknown as { updated?: unknown }).updated;
    }
  }
});

describe('source AbortSignal and configurable debounce', () => {
  it('passes an AbortSignal and aborts the prior request when a newer query supersedes it', async () => {
    const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
    const signals: AbortSignal[] = [];
    el.source = (_query: string, { signal }: { signal: AbortSignal }) => {
      signals.push(signal);
      return new Promise(() => {
        /* never resolves — kept in-flight so a newer query must abort it */
      });
    };
    el.open = true;
    await el.updateComplete;
    await aTimeout(250);

    await typeQuery(el, 'newer');
    await aTimeout(250);

    expect(signals.length).to.equal(2);
    expect(signals[0]!.aborted, 'the first request should be aborted by the second').to.equal(true);
    expect(signals[1]!.aborted, 'the current request should still be live').to.equal(false);
  });

  it('aborts the in-flight request on disconnect', async () => {
    const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
    let captured!: AbortSignal;
    el.source = (_query: string, { signal }: { signal: AbortSignal }) => {
      captured = signal;
      return new Promise(() => {});
    };
    el.open = true;
    await el.updateComplete;
    await aTimeout(250);
    expect(captured.aborted).to.equal(false);

    el.remove();
    await el.updateComplete;
    expect(captured.aborted).to.equal(true);
  });

  it('remains compatible with a legacy single-argument source', async () => {
    const el = (await fixture(html`<lr-combobox></lr-combobox>`)) as LyraCombobox;
    // A source that ignores the options bag (the pre-7.x signature) must still work.
    const legacy = ((query: string) =>
      Promise.resolve([{ value: 'x', label: `Result "${query}"` }])) as unknown as typeof el.source;
    el.source = legacy;
    el.open = true;
    await el.updateComplete;
    await aTimeout(250);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="option"] [part="option-label"]')!.textContent).to.contain(
      'Result ""',
    );
  });

  it('honours a custom sourceDelay (sanitized to a finite non-negative duration)', async () => {
    const el = (await fixture(html`<lr-combobox source-delay="0"></lr-combobox>`)) as LyraCombobox;
    await el.updateComplete;
    expect(el.sourceDelay).to.equal(0);
    el.sourceDelay = -50;
    expect(el.sourceDelay, 'negative clamps to 0').to.equal(0);
    el.sourceDelay = Number.NaN;
    expect(el.sourceDelay, 'NaN falls back to the default').to.equal(200);
  });
});
