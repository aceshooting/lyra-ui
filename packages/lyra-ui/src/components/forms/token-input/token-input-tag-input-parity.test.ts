import { fixture, expect, html } from '@open-wc/testing';
import '../../lr-token-input.js';
import type { LyraTokenInput } from '../../lr-token-input.js';

function field(el: LyraTokenInput): HTMLInputElement {
  return el.shadowRoot!.querySelector<HTMLInputElement>('#input')!;
}
function typeInto(el: LyraTokenInput, text: string): void {
  const input = field(el);
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
function press(el: LyraTokenInput, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...init });
  field(el).dispatchEvent(event);
  return event;
}
function paste(el: LyraTokenInput, text: string): ClipboardEvent {
  const data = new DataTransfer();
  data.setData('text/plain', text);
  const event = new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true, composed: true });
  field(el).dispatchEvent(event);
  return event;
}
/** Firefox drops `clipboardData` from a constructed ClipboardEvent, so paste tests skip there. */
function supportsSyntheticPaste(): boolean {
  const data = new DataTransfer();
  data.setData('text/plain', 'x');
  return new ClipboardEvent('paste', { clipboardData: data }).clipboardData?.getData('text/plain') === 'x';
}
const clearButton = (el: LyraTokenInput) => el.shadowRoot!.querySelector<HTMLButtonElement>('[part="clear-button"]');

describe('max-tags and min-tags', () => {
  it('blocks commits at the limit but keeps removal working', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input max-tags="2" .value=${['a', 'b']}></lr-token-input>`);
    typeInto(el, 'c');
    press(el, 'Enter');
    expect(el.value).to.deep.equal(['a', 'b']);
    expect(field(el).value, 'the blocked draft stays for correction').to.equal('c');
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="remove"]')!.click();
    expect(el.value).to.deep.equal(['b']);
    press(el, 'Enter');
    expect(el.value).to.deep.equal(['b', 'c']);
  });

  it('commits only what fits and keeps the rest of a paste in the draft', async function () {
    if (!supportsSyntheticPaste()) this.skip();
    const el = await fixture<LyraTokenInput>(html`<lr-token-input max-tags="2"></lr-token-input>`);
    paste(el, 'a,b,c,d');
    expect(el.value).to.deep.equal(['a', 'b']);
    expect(el.inputValue).to.equal('c,d');
  });

  it('reports rangeOverflow for a longer programmatic value with a localized message', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input max-tags="2"></lr-token-input>`);
    el.value = ['a', 'b', 'c'];
    await el.updateComplete;
    expect(el.checkValidity()).to.equal(false);
    expect(el.validity.rangeOverflow).to.equal(true);
    expect(el.validationMessage).to.contain('2');
    el.value = ['a'];
    expect(el.checkValidity()).to.equal(true);
  });

  it('enforces min-tags only once at least one token exists', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input min-tags="2"></lr-token-input>`);
    expect(el.checkValidity()).to.equal(true);
    el.value = ['a'];
    expect(el.checkValidity()).to.equal(false);
    expect(el.validity.rangeUnderflow).to.equal(true);
    expect(el.validationMessage).to.contain('2');
    el.value = ['a', 'b'];
    expect(el.checkValidity()).to.equal(true);
  });

  it('re-validates when the limits change, and honors the camelCase properties', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input .value=${['a', 'b', 'c']}></lr-token-input>`);
    expect(el.maxTags).to.equal(null);
    expect(el.minTags).to.equal(null);
    expect(el.checkValidity()).to.equal(true);
    el.maxTags = 2;
    await el.updateComplete;
    expect(el.checkValidity()).to.equal(false);
    el.maxTags = null;
    el.minTags = 5;
    await el.updateComplete;
    expect(el.validity.rangeUnderflow).to.equal(true);
  });

  it('changes nothing while both limits are unset or unusable', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input max-tags="" min-tags="abc"></lr-token-input>`);
    for (const token of ['a', 'b', 'c', 'd', 'e']) {
      typeInto(el, token);
      press(el, 'Enter');
    }
    expect(el.value).to.deep.equal(['a', 'b', 'c', 'd', 'e']);
    expect(el.checkValidity()).to.equal(true);
  });

  it('does not enforce the limits while disabled', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input disabled max-tags="1" .value=${['a', 'b']}></lr-token-input>`);
    expect(el.checkValidity()).to.equal(true);
  });
});

describe('with-clear and clearable', () => {
  it('renders no button by default or when there are no tokens', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input .value=${['a']}></lr-token-input>`);
    expect(clearButton(el) === null).to.equal(true);
    const empty = await fixture<LyraTokenInput>(html`<lr-token-input with-clear></lr-token-input>`);
    expect(clearButton(empty) === null).to.equal(true);
  });

  for (const attribute of ['with-clear', 'clearable']) {
    it(`${attribute} clears every token, focuses the input and emits lr-clear after change`, async () => {
      const el = await fixture<LyraTokenInput>(
        html`<lr-token-input ?with-clear=${attribute === 'with-clear'} ?clearable=${attribute === 'clearable'} .value=${['a', 'b']}></lr-token-input>`
      );
      const order: string[] = [];
      for (const name of ['input', 'change', 'lr-clear']) el.addEventListener(name, () => order.push(name));
      const button = clearButton(el)!;
      expect(button.getAttribute('aria-label')).to.equal('Clear');
      expect(button.matches('button')).to.equal(true);
      button.click();
      expect(el.value).to.deep.equal([]);
      expect(order).to.deep.equal(['input', 'change', 'lr-clear']);
      await el.updateComplete;
      expect(clearButton(el) === null).to.equal(true);
      expect(el.shadowRoot!.activeElement === field(el)).to.equal(true);
    });
  }

  it('exposes the clear-icon slot', async () => {
    const el = await fixture<LyraTokenInput>(
      html`<lr-token-input with-clear .value=${['a']}><span slot="clear-icon">x</span></lr-token-input>`
    );
    expect(clearButton(el)!.querySelector('slot[name="clear-icon"]')).to.not.equal(null);
  });

  it('hides the button while disabled or readonly', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input with-clear readonly .value=${['a']}></lr-token-input>`);
    expect(clearButton(el) === null).to.equal(true);
    el.readonly = false;
    await el.updateComplete;
    expect(clearButton(el)).to.not.equal(null);
    el.disabled = true;
    await el.updateComplete;
    expect(clearButton(el) === null).to.equal(true);
  });

  it('leaves a token a remove-request listener protects', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input with-clear .value=${['a', 'keep', 'b']}></lr-token-input>`);
    el.addEventListener('lr-token-remove-request', event => { if (event.detail.value === 'keep') event.preventDefault(); });
    clearButton(el)!.click();
    expect(el.value).to.deep.equal(['keep']);
  });

  it('clearing everything via a veto emits nothing', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input with-clear .value=${['a']}></lr-token-input>`);
    el.addEventListener('lr-token-remove-request', event => event.preventDefault());
    let cleared = 0;
    el.addEventListener('lr-clear', () => cleared++);
    clearButton(el)!.click();
    expect(el.value).to.deep.equal(['a']);
    expect(cleared).to.equal(0);
  });
});

describe('custom states', () => {
  it('tracks blank and readonly', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input></lr-token-input>`);
    expect(el.matches(':state(blank)')).to.equal(true);
    expect(el.matches(':state(readonly)')).to.equal(false);
    el.value = ['a'];
    el.readonly = true;
    expect(el.matches(':state(blank)')).to.equal(false);
    expect(el.matches(':state(readonly)')).to.equal(true);
  });
});

describe('delimiter characters', () => {
  it('commits on every delimiter character, not only the whole string', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input delimiter=";,"></lr-token-input>`);
    typeInto(el, 'a');
    expect(press(el, ';').defaultPrevented).to.equal(true);
    typeInto(el, 'b');
    press(el, ',');
    expect(el.value).to.deep.equal(['a', 'b']);
    typeInto(el, 'c');
    expect(press(el, '.').defaultPrevented).to.equal(false);
    expect(el.value).to.deep.equal(['a', 'b']);
  });

  it('splits a paste on every delimiter character', async function () {
    if (!supportsSyntheticPaste()) this.skip();
    const el = await fixture<LyraTokenInput>(html`<lr-token-input delimiter=";,"></lr-token-input>`);
    expect(paste(el, 'a;b, c').defaultPrevented).to.equal(true);
    expect(el.value).to.deep.equal(['a', 'b', 'c']);
    expect(el.inputValue).to.equal('');
  });

  it('leaves a paste without delimiter characters to the browser', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input></lr-token-input>`);
    expect(paste(el, 'plain text').defaultPrevented).to.equal(false);
    expect(el.value).to.deep.equal([]);
  });

  it('splits at the caret and keeps the existing draft around the paste', async function () {
    if (!supportsSyntheticPaste()) this.skip();
    const el = await fixture<LyraTokenInput>(html`<lr-token-input></lr-token-input>`);
    typeInto(el, 'xy');
    field(el).setSelectionRange(1, 1);
    paste(el, 'a,b');
    expect(el.value).to.deep.equal(['xa', 'by']);
  });

  it('keeps pasting inert while readonly or disabled', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input readonly></lr-token-input>`);
    expect(paste(el, 'a,b').defaultPrevented).to.equal(false);
    expect(el.value).to.deep.equal([]);
  });

  it('treats none and an empty delimiter as Enter-only, exactly as before', async () => {
    for (const delimiter of ['none', '']) {
      const el = await fixture<LyraTokenInput>(html`<lr-token-input delimiter=${delimiter}></lr-token-input>`);
      expect(el.delimiter).to.equal(null);
      typeInto(el, 'a,b');
      expect(press(el, ',').defaultPrevented).to.equal(false);
      press(el, 'Enter');
      expect(el.value).to.deep.equal(['a,b']);
    }
  });

  it('does not commit a delimiter keystroke inside an IME composition', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input></lr-token-input>`);
    typeInto(el, 'ni');
    press(el, ',', { isComposing: true });
    expect(el.value).to.deep.equal([]);
    expect(field(el).value).to.equal('ni');
  });

  it('honors delimiter characters under rtl', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input dir="rtl" delimiter="؛،"></lr-token-input>`);
    typeInto(el, 'ا');
    press(el, '،');
    typeInto(el, 'ب');
    press(el, '؛');
    expect(el.value).to.deep.equal(['ا', 'ب']);
  });
});

describe('string values and inputValue', () => {
  it('accepts a delimiter-separated string for value and defaultValue', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input delimiter=";"></lr-token-input>`);
    el.value = ' a; b ;;c ';
    expect(el.value).to.deep.equal(['a', 'b', 'c']);
    el.value = ['x', 'y'];
    expect(el.value).to.deep.equal(['x', 'y']);
    el.defaultValue = 'p;q';
    expect(el.defaultValue).to.deep.equal(['p', 'q']);
  });

  it('splits a string on a comma when no delimiter is set', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input delimiter="none"></lr-token-input>`);
    el.value = 'a,b';
    expect(el.value).to.deep.equal(['a', 'b']);
  });

  it('reads and writes the draft through inputValue', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input></lr-token-input>`);
    typeInto(el, 'draft');
    expect(el.inputValue).to.equal('draft');
    el.inputValue = 'next';
    await el.updateComplete;
    expect(field(el).value).to.equal('next');
    expect(el.value).to.deep.equal([]);
    press(el, 'Enter');
    expect(el.value).to.deep.equal(['next']);
  });
});

describe('lr-create', () => {
  it('is cancelable per candidate token and precedes the batch request', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input></lr-token-input>`);
    const seen: string[] = [];
    el.addEventListener('lr-create', event => {
      seen.push(`create:${event.detail.inputValue}`);
      if (event.detail.inputValue === 'no') event.preventDefault();
    });
    el.addEventListener('lr-token-add-request', event => seen.push(`add:${event.detail.values.join('|')}`));
    typeInto(el, 'a,no,b');
    press(el, 'Enter');
    expect(seen).to.deep.equal(['create:a', 'create:no', 'create:b', 'add:a|b']);
    expect(el.value).to.deep.equal(['a', 'b']);
  });

  it('keeps the draft when every candidate is rejected', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input></lr-token-input>`);
    el.addEventListener('lr-create', event => event.preventDefault());
    typeInto(el, 'a');
    press(el, 'Enter');
    expect(el.value).to.deep.equal([]);
    expect(el.inputValue).to.equal('a');
  });
});

describe('part aliases', () => {
  it('adds the upstream part names beside the existing ones', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input with-clear .value=${['a']}></lr-token-input>`);
    const root = el.shadowRoot!;
    expect(root.querySelector('[part~="input-wrapper"][part~="tag-input"]')).to.not.equal(null);
    expect(root.querySelector('[part="tags"] > [part~="token"][part~="tag"]')).to.not.equal(null);
    expect(root.querySelector('[part~="token"] > [part="tag__content"]')).to.not.equal(null);
    expect(root.querySelector('[part~="remove"][part~="tag__remove-button"][part~="tag__remove-button__button"]')).to.not.equal(null);
  });

  it('puts tag__content on the editable token label', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input editable .value=${['a']}></lr-token-input>`);
    expect(el.shadowRoot!.querySelector('[part~="token-label"][part~="tag__content"]')).to.not.equal(null);
  });

  it('keeps the tokens laid out as items of the row', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input .value=${['a']}></lr-token-input>`);
    const tags = el.shadowRoot!.querySelector<HTMLElement>('[part="tags"]')!;
    expect(getComputedStyle(tags).display).to.equal('contents');
  });
});

describe('form integration and accessibility', () => {
  it('restores the default value and the blank state on form reset', async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-token-input name="t" with-clear min-tags="2" .defaultValue=${['a', 'b']}></lr-token-input></form>`);
    const el = form.querySelector('lr-token-input') as LyraTokenInput;
    el.value = [];
    expect(el.matches(':state(blank)')).to.equal(true);
    form.reset();
    expect(el.value).to.deep.equal(['a', 'b']);
    expect(el.matches(':state(blank)')).to.equal(false);
    expect(el.checkValidity()).to.equal(true);
    expect(new FormData(form).getAll('t')).to.deep.equal(['a', 'b']);
  });

  it('is accessible with the clear button and limits set', async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input label="Tags" with-clear max-tags="5" min-tags="1" .value=${['a', 'b']}></lr-token-input>`);
    await expect(el).to.be.accessible();
  });
});
