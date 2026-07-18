import { fixture, expect, oneEvent, html, aTimeout } from '@open-wc/testing';
import './combobox.js';
import './option.js';
import type { LyraCombobox } from './combobox.js';
import { styles } from './combobox.styles.js';

const basic = () => html`
  <lyra-combobox>
    <lyra-option value="a">Apple</lyra-option>
    <lyra-option value="b">Banana</lyra-option>
    <lyra-option value="c">Cherry</lyra-option>
  </lyra-combobox>
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
  expect((inputEvents[0].target as Element).localName).to.equal('lyra-combobox');
  expect((inputEvents[0] as InputEvent).data).to.equal('ban');
  expect((inputEvents[0] as InputEvent).inputType).to.equal('insertText');
  expect((inputEvents[0] as InputEvent).isComposing).to.be.false;
  expect(changeCount).to.equal(0);
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
  expect(events.map((event) => event.constructor.name)).to.deep.equal(['Event', 'Event']);
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
  expect(events.map((event) => event.constructor.name)).to.deep.equal(['Event', 'Event']);
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
  expect(events.map((event) => event.constructor.name)).to.deep.equal(['Event', 'Event']);

  events.length = 0;
  await el.updateComplete;
  (el.shadowRoot!.querySelectorAll('[part="option"]')[0] as HTMLElement).click();
  expect(events.map((event) => event.type)).to.deep.equal(['input', 'change']);
  expect(events.map((event) => event.constructor.name)).to.deep.equal(['Event', 'Event']);
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
  expect(events.map((event) => event.constructor.name)).to.deep.equal(['Event', 'Event']);
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

it('emits one input/change pair and one lyra-clear event when cleared', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.withClear = true;
  el.value = 'a';
  await el.updateComplete;
  const events: Event[] = [];
  el.addEventListener('input', (event) => events.push(event));
  el.addEventListener('change', (event) => events.push(event));
  el.addEventListener('lyra-clear', (event) => events.push(event));

  (el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement).click();

  expect(events.map((event) => event.type)).to.deep.equal(['input', 'change', 'lyra-clear']);
  expect(events.slice(0, 2).map((event) => event.constructor.name)).to.deep.equal(['Event', 'Event']);
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
  await oneEvent(el, 'lyra-clear');
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

it('participates in a form (single + multiple)', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-combobox name="fruit">
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b">Banana</lyra-option>
      </lyra-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-combobox') as LyraCombobox;
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
  expect(el.shadowRoot!.querySelector('[part="tag__remove-button"]')).to.exist;
  expect(input.getAttribute('aria-activedescendant')).to.not.be.empty;
  await expect(el).to.be.accessible();
});

it('blocks a required, empty combobox from submitting the form', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-combobox name="fruit" required>
        <lyra-option value="a">Apple</lyra-option>
      </lyra-combobox>
    </form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;
});

it('focuses the inner input after direct and submit-driven validity reporting', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before combobox</button>
      <lyra-combobox name="fruit" required>
        <lyra-option value="a">Apple</lyra-option>
      </lyra-combobox>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector('button') as HTMLButtonElement;
  const el = form.querySelector('lyra-combobox') as LyraCombobox;
  let submitCount = 0;
  form.addEventListener('submit', (event) => {
    submitCount += 1;
    event.preventDefault();
  });

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lyra-combobox');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('combobox-input');

  sentinel.focus();
  form.requestSubmit();
  expect(submitCount).to.equal(0);
  expect(document.activeElement?.localName).to.equal('lyra-combobox');
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
      <lyra-combobox name="fruit">
        <lyra-option value="a">Apple</lyra-option>
      </lyra-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-combobox') as LyraCombobox;
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
    <form><lyra-combobox name="tags"></lyra-combobox></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-combobox') as LyraCombobox;
  el.value = ['a', 'b'];
  expect(new FormData(form).getAll('tags')).to.deep.equal(['a']);

  el.multiple = true;
  expect(el.hasAttribute('multiple')).to.be.true;
  expect(new FormData(form).getAll('tags')).to.deep.equal(['a', 'b']);

  el.multiple = false;
  expect(el.hasAttribute('multiple')).to.be.false;
  expect(new FormData(form).getAll('tags')).to.deep.equal(['a']);
});

it('seeds the initial selection from a declaratively-selected <lyra-option>', async () => {
  const el = (await fixture(html`
    <lyra-combobox>
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b" selected>Banana</lyra-option>
    </lyra-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  expect(el.value).to.equal('b');
});

it('restores the declared default selection on form.reset()', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-combobox name="fruit">
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b" selected>Banana</lyra-option>
      </lyra-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-combobox') as LyraCombobox;
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
      <lyra-combobox name="fruit">
        <lyra-option value="a">Apple</lyra-option>
        <lyra-option value="b">Banana</lyra-option>
      </lyra-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-combobox') as LyraCombobox;
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
  expect(expandIcon.querySelector('svg')).to.exist;
  expect(expandIcon.textContent?.trim()).to.equal('');

  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLElement;
  expect(clearBtn.querySelector('svg')).to.exist;
  expect(clearBtn.textContent?.trim()).to.equal('');

  const removeBtn = el.shadowRoot!.querySelector('[part="tag__remove-button"]') as HTMLElement;
  expect(removeBtn.querySelector('svg')).to.exist;
  expect(removeBtn.textContent?.trim()).to.equal('');

  // The chevron is rotated to a "down" glyph via its wrapping part, not the svg itself.
  expect(styles.cssText).to.include("[part='expand-icon'] svg");
});

it('transitions the listbox with the shared fast-transition token and respects reduced motion', () => {
  const css = styles.cssText;
  const listboxBlock = /\[part=['"]?listbox['"]?]\s*{([^}]*)}/.exec(css);
  expect(listboxBlock, 'expected a base [part="listbox"] rule').to.not.equal(null);
  expect(listboxBlock![1]).to.include('var(--lyra-transition-fast)');
  expect(css).to.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

it('uses the shared disabled-opacity token for the disabled host and disabled options', async () => {
  const el = (await fixture(html`
    <lyra-combobox open>
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b" disabled>Banana</lyra-option>
    </lyra-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;

  const css = styles.cssText;
  const disabledHostBlock = /:host\(:disabled\)\s*\[part=['"]?combobox['"]?]\s*{([^}]*)}/.exec(css);
  expect(disabledHostBlock, 'expected a :host(:disabled) [part="combobox"] rule').to.not.equal(null);
  expect(disabledHostBlock![1]).to.include('var(--lyra-opacity-disabled)');

  const disabledOptionBlock = /\[part=['"]?option['"]?]\[aria-disabled=['"]?true['"]?]\s*{([^}]*)}/.exec(css);
  expect(disabledOptionBlock, 'expected a [part="option"][aria-disabled="true"] rule').to.not.equal(null);
  expect(disabledOptionBlock![1]).to.include('var(--lyra-opacity-disabled)');

  const disabledOption = el.shadowRoot!.querySelectorAll('[part="option"]')[1] as HTMLElement;
  expect(getComputedStyle(disabledOption).opacity).to.equal('0.5');
});

it('gives the clear button and expand icon a real touch target instead of collapsing to bare glyph height', async () => {
  const css = styles.cssText;
  // [part='clear-button'] and [part='expand-icon'] used to share one rule for their sizing; they
  // now resolve independently ([[part='clear-button'] to the full --lyra-icon-button-size floor,
  // since it's a real independently-focusable button; [part='expand-icon'] to its smaller capped
  // box, since it's a decorative aria-hidden indicator with no click handler of its own) -- both
  // still reference the shared token.
  // Each part now has its own dedicated sizing rule (in addition to the shared base rule the two
  // still share for layout/color/cursor) -- there can be more than one block whose selector
  // matches either part, so scan every match and require at least one dedicated rule per part to
  // reference the shared token.
  const clearBlocks = [...css.matchAll(/\[part=['"]?clear-button['"]?]\s*{([^}]*)}/g)];
  expect(clearBlocks.length, 'expected at least one [part="clear-button"] rule').to.be.greaterThan(0);
  expect(clearBlocks.some((m) => m[1].includes('var(--lyra-icon-button-size)'))).to.be.true;
  const expandBlocks = [...css.matchAll(/\[part=['"]?expand-icon['"]?]\s*{([^}]*)}/g)];
  expect(expandBlocks.length, 'expected at least one [part="expand-icon"] rule').to.be.greaterThan(0);
  expect(expandBlocks.some((m) => m[1].includes('var(--lyra-icon-button-size)'))).to.be.true;

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
  // assigned/text content (same bug class fixed for lyra-stat).
  expect(getComputedStyle(errorPart).display).to.equal('none');
  expect(getComputedStyle(hintPart).display).to.equal('none');

  el.errorText = 'Selection required';
  el.hint = 'Pick a fruit';
  await el.updateComplete;
  expect(getComputedStyle(errorPart).display).to.not.equal('none');
  expect(getComputedStyle(hintPart).display).to.not.equal('none');
});

it('renders errorText in var(--lyra-color-danger), distinct from and alongside the hint', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.hint = 'Pick a fruit';
  el.errorText = 'Selection required';
  await el.updateComplete;

  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  expect(errorPart).to.exist;
  expect(errorPart.textContent).to.contain('Selection required');
  expect(hintPart.textContent).to.contain('Pick a fruit');
  expect(getComputedStyle(errorPart).color).to.not.equal(getComputedStyle(hintPart).color);
});

it('reflects an invalid state only after the field has been interacted with once', async () => {
  const el = (await fixture(html`
    <lyra-combobox required>
      <lyra-option value="a">Apple</lyra-option>
    </lyra-combobox>
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
    <lyra-combobox required>
      <lyra-option value="a">Apple</lyra-option>
    </lyra-combobox>
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
  expect(clearFocusBlock![1]).to.include('var(--lyra-focus-ring-width)');
  expect(clearFocusBlock![1]).to.include('var(--lyra-focus-ring-color)');
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
    <lyra-combobox>
      <lyra-option value="a" sub="Running" dot-color="green">Meter A</lyra-option>
    </lyra-combobox>
  `)) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('[part="option-sub"]')!.textContent).to.equal('Running');
  expect((el.shadowRoot!.querySelector('[part="option-dot"]') as HTMLElement).style.background).to.equal(
    'green',
  );
});

it('sanitizes maxOptionsVisible/maxRender to finite non-negative integers instead of poisoning the row cap/tag cap with NaN', async () => {
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;

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
  const opt = document.createElement('lyra-option');
  opt.value = '0';
  opt.textContent = 'Item 0';
  el.appendChild(opt);
  el.open = true;
  expect(async () => await el.updateComplete).to.not.throw();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="option"]').length).to.equal(0);
});

it('caps rendered rows at maxRender and shows an overflow indicator', async () => {
  const el = (await fixture(html`<lyra-combobox max-render="3"></lyra-combobox>`)) as LyraCombobox;
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement('lyra-option');
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
  const el = (await fixture(html`<lyra-combobox max-render="3"></lyra-combobox>`)) as LyraCombobox;
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement('lyra-option');
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
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;
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
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;
  let resolve!: (rows: { value: string; label: string }[]) => void;
  el.source = () => new Promise((r) => (resolve = r));
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('.loading')).to.exist;

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
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;
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

it('registers the click-outside listener and fires lyra-show/lyra-hide when `open` is set directly, bypassing show()/hide()', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  await el.updateComplete;

  setTimeout(() => {
    el.open = true;
  });
  await oneEvent(el, 'lyra-show');
  await el.updateComplete;
  expect(el.open).to.be.true;

  // A pointerdown anywhere outside the element must still dismiss it, even
  // though `show()` (which normally registers the listener) was never called.
  setTimeout(() => {
    document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, composed: true }));
  });
  await oneEvent(el, 'lyra-hide');
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
  const el = (await fixture(html`<lyra-combobox multiple></lyra-combobox>`)) as LyraCombobox;
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
  const el = (await fixture(html`<lyra-combobox with-clear></lyra-combobox>`)) as LyraCombobox;
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
  await oneEvent(el, 'lyra-clear');
  await aTimeout(250);
  await el.updateComplete;

  expect(calls).to.deep.equal(['', 'ban', '']);
});

it('seeds the selection from a <lyra-option selected> appended after the initial slotchange', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  await el.updateComplete;
  expect(el.value).to.equal('');

  const opt = document.createElement('lyra-option');
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
      <lyra-combobox multiple>
        <lyra-option value="a" selected>Apple</lyra-option>
      </lyra-combobox>
      <lyra-combobox multiple>
        <lyra-option value="b" selected>Banana</lyra-option>
      </lyra-combobox>
    </form>
  `)) as HTMLFormElement;
  const els = Array.from(form.querySelectorAll('lyra-combobox')) as LyraCombobox[];
  await Promise.all(els.map((e) => e.updateComplete));
  expect(els.map((e) => e.value)).to.deep.equal([['a'], ['b']]);

  expect(new FormData(form).getAll('value')).to.deep.equal([]);
});

it('clears the pending debounced source timer on disconnect so a detached element never invokes a stale fetch', async () => {
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;
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
    <lyra-combobox>
      <lyra-option value="a" group="Fruits">Apple</lyra-option>
      <lyra-option value="b" group="Fruits">Banana</lyra-option>
      <lyra-option value="c" group="Vegetables">Carrot</lyra-option>
    </lyra-combobox>
  `)) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  const groups = Array.from(el.shadowRoot!.querySelectorAll('.group-label')).map((n) => n.textContent);
  expect(groups).to.deep.equal(['Fruits', 'Vegetables']);
});

it('caps visible tags at maxOptionsVisible and shows a "+N" overflow tag', async () => {
  const el = (await fixture(html`
    <lyra-combobox multiple max-options-visible="2">
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b">Banana</lyra-option>
      <lyra-option value="c">Cherry</lyra-option>
      <lyra-option value="d">Date</lyra-option>
    </lyra-combobox>
  `)) as LyraCombobox;
  el.value = ['a', 'b', 'c', 'd'];
  await el.updateComplete;

  const tags = el.shadowRoot!.querySelectorAll('[part="tag"]');
  expect(tags.length).to.equal(3);
  expect(tags[2].textContent?.trim()).to.equal('+2');
});

it('shows the empty-state message with a custom emptyText when no rows match', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.emptyText = 'Nothing here';
  el.open = true;
  await el.updateComplete;

  await typeQuery(el, 'zzz');
  const empty = el.shadowRoot!.querySelector('.empty');
  expect(empty).to.exist;
  expect(empty!.textContent).to.equal('Nothing here');
});

// The loadingText/emptyText/overflowText props are passed to localize() as
// `this.xText || undefined`, so with the props unset the .strings/registry
// path must resolve each listbox message -- a set prop wins verbatim instead
// (covered by the emptyText test above).
it('resolves the loading message through .strings when loadingText is unset', async () => {
  const el = (await fixture(
    html`<lyra-combobox .strings=${{ loading: 'Chargement…' }}></lyra-combobox>`,
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
    html`<lyra-combobox .strings=${{ noMatches: 'Aucun résultat' }}></lyra-combobox>`,
  )) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('.empty')!.textContent).to.equal('Aucun résultat');
});

it('resolves the overflow indicator through .strings, interpolating {n}, when overflowText is unset', async () => {
  const el = (await fixture(
    html`<lyra-combobox max-render="3" .strings=${{ comboboxOverflow: '+{n} de plus' }}></lyra-combobox>`,
  )) as LyraCombobox;
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement('lyra-option');
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
        <lyra-combobox name="fruit">
          <lyra-option value="a">Apple</lyra-option>
        </lyra-combobox>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-combobox') as LyraCombobox;
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
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;
  el.source = () => new Promise(() => {});
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('.loading')).to.exist;
  await expect(el).to.be.accessible();
});

it('renders structured async-row adornments and preserves selected opaque data', async () => {
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;
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
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;
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
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;
  el.open = true;
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('.empty')).to.exist;
  await expect(el).to.be.accessible();
});

it('reflects required/invalid state onto the input as aria-required/aria-invalid', async () => {
  const el = (await fixture(html`
    <lyra-combobox required>
      <lyra-option value="a">Apple</lyra-option>
    </lyra-combobox>
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
    html`<lyra-combobox aria-label="Filter items" placeholder="Search…"></lyra-combobox>`,
  )) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLElement;
  expect(input.getAttribute('aria-label')).to.equal('Filter items');
});

it('falls back to placeholder when no host aria-label or label is set', async () => {
  const el = (await fixture(html`<lyra-combobox placeholder="Search…"></lyra-combobox>`)) as LyraCombobox;
  const input = el.shadowRoot!.querySelector('[part="combobox-input"]') as HTMLElement;
  expect(input.getAttribute('aria-label')).to.equal('Search…');
});

it('re-syncs the submitted FormData when `name` changes after a value is already set', async () => {
  const form = document.createElement('form');
  const el = (await fixture(html`
    <lyra-combobox name="a"><lyra-option value="x" selected></lyra-option></lyra-combobox>
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
      <lyra-combobox name="old" multiple .value=${['a', 'b']}></lyra-combobox>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-combobox') as LyraCombobox;

  el.name = 'next';
  const data = new FormData(form);

  expect(data.has('old')).to.be.false;
  expect(data.getAll('next')).to.deep.equal(['a', 'b']);
});

it('re-syncs FormData when switching between single and multiple mode', async () => {
  const form = document.createElement('form');
  const el = (await fixture(html`
    <lyra-combobox name="tags"><lyra-option value="x" selected></lyra-option></lyra-combobox>
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
    <lyra-combobox disabled multiple with-clear><lyra-option value="x" selected></lyra-option></lyra-combobox>
  `)) as LyraCombobox;
  await el.updateComplete;
  const clearBtn = el.shadowRoot!.querySelector('[part="clear-button"]') as HTMLButtonElement | null;
  const removeBtn = el.shadowRoot!.querySelector('[part="tag__remove-button"]') as HTMLButtonElement | null;
  expect(clearBtn?.disabled).to.be.true;
  expect(removeBtn?.disabled).to.be.true;
});

it('restores its own explicit `disabled` after an ancestor fieldset re-enables', async () => {
  const el = (await fixture(html`<lyra-combobox disabled></lyra-combobox>`)) as LyraCombobox;
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
  const el = (await fixture(html`<lyra-combobox open><lyra-option value="x"></lyra-option></lyra-combobox>`)) as LyraCombobox;
  await el.updateComplete;
  expect(el.open).to.be.true;

  const parent = el.parentElement!;
  el.remove();
  parent.appendChild(el);
  await el.updateComplete;
  expect(el.open).to.be.false;
});

it('re-renders when an already-slotted option mutates its own label', async () => {
  const el = (await fixture(html`<lyra-combobox><lyra-option value="x">Old label</lyra-option></lyra-combobox>`)) as LyraCombobox;
  // Open *before* mutating the option's label so the `lyra-option-change`
  // notification path (MutationObserver -> emit -> `onOptionChange()`
  // reassigning `options`) is the only thing that can update the
  // already-rendered row afterward -- opening *after* the mutation (the
  // previous version of this test) forces an ordinary first-render read of
  // live option data regardless of whether that path ever fired.
  el.open = true;
  await el.updateComplete;
  const row = () => el.shadowRoot!.querySelector('[part="option"]')!;
  expect(row().textContent).to.include('Old label');

  const option = el.querySelector('lyra-option')!;
  option.textContent = 'New label';
  // The MutationObserver callback (and the `lyra-option-change` ->
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
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;
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
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;
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
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;
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

it('resolves a programmatically-set value to its label from asyncRows in multi-select tag chips', async () => {
  const el = (await fixture(html`<lyra-combobox multiple></lyra-combobox>`)) as LyraCombobox;
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
  const el = (await fixture(html`<lyra-combobox multiple max-render="4"></lyra-combobox>`)) as LyraCombobox;
  for (const v of ['a0', 'a1', 'a2', 'a3', 'a4', 'a5']) {
    const opt = document.createElement('lyra-option');
    opt.value = v;
    opt.setAttribute('group', 'Fruits');
    opt.textContent = v;
    el.appendChild(opt);
  }
  for (const v of ['b0', 'b1', 'b2']) {
    const opt = document.createElement('lyra-option');
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
  const el = (await fixture(html`<lyra-combobox loading-text="Fetching…"></lyra-combobox>`)) as LyraCombobox;
  el.source = () => new Promise(() => {});
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  await el.updateComplete;

  expect(el.shadowRoot!.querySelector('.loading')!.textContent).to.equal('Fetching…');
});

it('uses a custom overflowText with a {n} token substitution instead of the hardcoded default', async () => {
  const el = (await fixture(
    html`<lyra-combobox max-render="3" overflow-text="Only 3 shown, {n} hidden"></lyra-combobox>`,
  )) as LyraCombobox;
  for (let i = 0; i < 10; i++) {
    const opt = document.createElement('lyra-option');
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
    <lyra-combobox>
      <lyra-option value="a">Apple</lyra-option>
      <lyra-option value="b">Banana</lyra-option>
      <lyra-option value="c" disabled>Cherry</lyra-option>
    </lyra-combobox>
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
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;
  for (let i = 0; i < 20; i++) {
    const opt = document.createElement('lyra-option');
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
  // lyra-mention-popover's identical listbox).
  for (let i = 0; i < 15; i++) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await el.updateComplete;
  }

  const activeRow = el.shadowRoot!.querySelector('[part="option"][data-active]') as HTMLElement;
  expect(activeRow).to.exist;
  const rowRect = activeRow.getBoundingClientRect();
  const boxRect = box.getBoundingClientRect();
  expect(rowRect.top >= boxRect.top - 1, 'active row top must be within the scrolled listbox viewport').to.be.true;
  expect(rowRect.bottom <= boxRect.bottom + 1, 'active row bottom must be within the scrolled listbox viewport').to
    .be.true;
});

it('prunes _selectedLabelCache back to the live selection instead of growing unboundedly', async () => {
  const el = (await fixture(html`<lyra-combobox></lyra-combobox>`)) as LyraCombobox;
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
    <lyra-combobox locale="tr">
      <lyra-option value="ist">İstanbul</lyra-option>
    </lyra-combobox>
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

  it('a non-default size changes the trigger min-block-size', async () => {
    const mEl = (await fixture(basic())) as LyraCombobox;
    const xsEl = (await fixture(html`
      <lyra-combobox size="xs">
        <lyra-option value="a">Apple</lyra-option>
      </lyra-combobox>
    `)) as LyraCombobox;
    const mBox = mEl.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
    const xsBox = xsEl.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
    expect(parseFloat(getComputedStyle(xsBox).minHeight)).to.be.lessThan(
      parseFloat(getComputedStyle(mBox).minHeight),
    );
  });

  it('the "+N" overflow tag scales its font-size with size', async () => {
    const mEl = (await fixture(html`
      <lyra-combobox multiple max-options-visible="0">
        <lyra-option value="a" selected>Apple</lyra-option>
      </lyra-combobox>
    `)) as LyraCombobox;
    const xsEl = (await fixture(html`
      <lyra-combobox multiple max-options-visible="0" size="xs">
        <lyra-option value="a" selected>Apple</lyra-option>
      </lyra-combobox>
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
      <lyra-combobox
        autocomplete="one-time-code"
        inputmode="search"
        enterkeyhint="done"
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
      ></lyra-combobox>
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
      <lyra-combobox clearable>
        <lyra-option value="a" selected>Apple</lyra-option>
      </lyra-combobox>
    `)) as LyraCombobox;
    await clearable.updateComplete;
    expect(clearable.shadowRoot!.querySelector('[part="clear-button"]')).to.exist;

    const legacy = (await fixture(html`
      <lyra-combobox with-clear>
        <lyra-option value="a" selected>Apple</lyra-option>
      </lyra-combobox>
    `)) as LyraCombobox;
    await legacy.updateComplete;
    expect(legacy.shadowRoot!.querySelector('[part="clear-button"]')).to.exist;
  });

  it('forwards focus, blur, selection, and range editing to the internal input', async () => {
    const el = (await fixture(html`<lyra-combobox multiple></lyra-combobox>`)) as LyraCombobox;
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
    expect(el.shadowRoot!.activeElement).to.equal(null);
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
