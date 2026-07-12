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
  input.dispatchEvent(new Event('input'));
  await el.updateComplete;
  return input;
}

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
  const disabledHostBlock = /:host\(\[disabled\]\)\s*\[part=['"]?combobox['"]?]\s*{([^}]*)}/.exec(css);
  expect(disabledHostBlock, 'expected a :host([disabled]) [part="combobox"] rule').to.not.equal(null);
  expect(disabledHostBlock![1]).to.include('var(--lyra-opacity-disabled)');

  const disabledOptionBlock = /\[part=['"]?option['"]?]\[aria-disabled=['"]?true['"]?]\s*{([^}]*)}/.exec(css);
  expect(disabledOptionBlock, 'expected a [part="option"][aria-disabled="true"] rule').to.not.equal(null);
  expect(disabledOptionBlock![1]).to.include('var(--lyra-opacity-disabled)');

  const disabledOption = el.shadowRoot!.querySelectorAll('[part="option"]')[1] as HTMLElement;
  expect(getComputedStyle(disabledOption).opacity).to.equal('0.5');
});

it('gives the clear button and expand icon a real touch target instead of collapsing to bare glyph height', async () => {
  const css = styles.cssText;
  const btnBlock = /\[part=['"]?clear-button['"]?],\s*\[part=['"]?expand-icon['"]?]\s*{([^}]*)}/.exec(css);
  expect(btnBlock, 'expected a shared [part="clear-button"], [part="expand-icon"] rule').to.not.equal(null);
  expect(btnBlock![1]).to.include('var(--lyra-icon-button-size)');

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

it('ignores a mousedown on the combobox container while disabled', async () => {
  const el = (await fixture(basic())) as LyraCombobox;
  el.disabled = true;
  await el.updateComplete;

  const container = el.shadowRoot!.querySelector('[part="combobox"]') as HTMLElement;
  container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  await el.updateComplete;

  expect(el.open).to.be.false;
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
  el.source = (() => {
    throw new Error('synchronous failure');
  }) as unknown as (query: string) => Promise<import('./combobox.js').ComboboxSourceRow[]>;
  el.open = true;
  await el.updateComplete;
  await aTimeout(250);
  expect((el as unknown as { loading: boolean }).loading).to.be.false;
});
