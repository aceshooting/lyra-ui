import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './token-input.js';
import type { LyraTokenInput } from './token-input.js';
import { styles } from './token-input.styles.js';
import { LyraElement } from '../../../internal/lyra-element.js';

const RULE = 'Bash(git status:*)';

function tokenLabels(el: LyraTokenInput): HTMLElement[] {
  return Array.from(el.shadowRoot!.querySelectorAll('[part="token-label"]')) as HTMLElement[];
}
function editor(el: LyraTokenInput): HTMLInputElement | null {
  return el.shadowRoot!.querySelector('[part="token-editor"]') as HTMLInputElement | null;
}
function typeInto(field: HTMLInputElement, next: string): void {
  field.value = next;
  field.dispatchEvent(new Event('input', { bubbles: true }));
}
function press(target: HTMLElement, key: string): KeyboardEvent {
  // `composed: true` matches a real key event: without it nothing dispatched inside the shadow root
  // could ever reach a document listener, which would make the Escape-containment test vacuous.
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true });
  target.dispatchEvent(event);
  return event;
}

it('adds and removes tokens with the keyboard', async () => {
  const el = (await fixture(html`<lr-token-input></lr-token-input>`)) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = 'alpha'; input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  await el.updateComplete;
  expect(el.value).to.deep.equal(['alpha']);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }));
  expect(el.value).to.deep.equal([]);
});

it('skips a draft token that duplicates an existing one unless allowDuplicates is set', async () => {
  const el = (await fixture(html`<lr-token-input .value=${['alpha']}></lr-token-input>`)) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector('#input') as HTMLInputElement;
  let added = 0;
  el.addEventListener('lr-add', () => added++);
  typeInto(input, 'alpha');
  press(input, 'Enter');
  await el.updateComplete;
  expect(el.value, 'the duplicate draft must be skipped, not appended').to.deep.equal(['alpha']);
  expect(added, 'no lr-add for a skipped duplicate').to.equal(0);

  el.allowDuplicates = true;
  await el.updateComplete;
  typeInto(input, 'alpha');
  press(input, 'Enter');
  await el.updateComplete;
  expect(el.value, 'allowDuplicates lets the same token in twice').to.deep.equal(['alpha', 'alpha']);
  expect(added).to.equal(1);
});

it('ignores keystrokes on the draft input while disabled, leaving the draft uncommitted', async () => {
  const el = (await fixture(html`<lr-token-input disabled></lr-token-input>`)) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector('#input') as HTMLInputElement;
  typeInto(input, 'alpha');
  press(input, 'Enter');
  await el.updateComplete;
  expect(el.value, 'a disabled control must not commit a draft on Enter').to.deep.equal([]);
});

it('discards an uncommitted draft on blur while disabled instead of adding it', async () => {
  const el = (await fixture(html`<lr-token-input disabled></lr-token-input>`)) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector('#input') as HTMLInputElement;
  typeInto(input, 'alpha');
  const blurred = oneEvent(el, 'blur');
  input.dispatchEvent(new Event('blur'));
  await blurred;
  await el.updateComplete;
  expect(el.value, 'a disabled control must not commit a draft on blur either').to.deep.equal([]);
});

it('is form-associated and validates required values', async () => {
  const el = (await fixture(html`<lr-token-input required></lr-token-input>`)) as LyraTokenInput;
  expect(el.checkValidity()).to.be.false;
  el.value = ['ready'];
  await el.updateComplete;
  expect(el.checkValidity()).to.be.true;
});

it('is accessible', async () => {
  const el = await fixture(html`<lr-token-input label="Recipients"></lr-token-input>`);
  await expect(el).to.be.accessible();
});

it('interpolates the remove button accessible name with the token label', async () => {
  const el = (await fixture(html`<lr-token-input .value=${['alpha']}></lr-token-input>`)) as LyraTokenInput;
  const removeBtn = el.shadowRoot!.querySelector('[part="remove"]') as HTMLButtonElement;
  expect(removeBtn.getAttribute('aria-label')).to.equal('Remove alpha');
});

it('localizes the remove button accessible name via .strings', async () => {
  const el = (await fixture(
    html`<lr-token-input .value=${['alpha']} .strings=${{ removeWithContext: 'Retirer {label}' }}></lr-token-input>`,
  )) as LyraTokenInput;
  const removeBtn = el.shadowRoot!.querySelector('[part="remove"]') as HTMLButtonElement;
  expect(removeBtn.getAttribute('aria-label')).to.equal('Retirer alpha');
});

it('fires lr-remove as cancelable and removes the token when not prevented', async () => {
  const el = (await fixture(html`<lr-token-input .value=${['alpha', 'beta']}></lr-token-input>`)) as LyraTokenInput;
  const listener = oneEvent(el, 'lr-remove');
  (el.shadowRoot!.querySelector('[part="remove"]') as HTMLButtonElement).click();
  const event = await listener;
  expect(event.cancelable).to.be.true;
  expect(event.detail).to.deep.equal({ value: 'alpha', index: 0 });
  expect(el.value).to.deep.equal(['beta']);
});

it('keeps the token in place when a host calls preventDefault() on lr-remove', async () => {
  const el = (await fixture(html`<lr-token-input .value=${['alpha', 'beta']}></lr-token-input>`)) as LyraTokenInput;
  el.addEventListener('lr-remove', (e) => e.preventDefault());
  (el.shadowRoot!.querySelector('[part="remove"]') as HTMLButtonElement).click();
  await el.updateComplete;
  expect(el.value).to.deep.equal(['alpha', 'beta']);
});

it('defaults to size "m" and reflects a size attribute', async () => {
  const defaultEl = (await fixture(html`<lr-token-input></lr-token-input>`)) as LyraTokenInput;
  expect(defaultEl.size).to.equal('m');
  const el = (await fixture(html`<lr-token-input size="s"></lr-token-input>`)) as LyraTokenInput;
  expect(el.getAttribute('size')).to.equal('s');
  expect(el.size).to.equal('s');
});

it("matches lr-input's own row height at every shared size tier when empty", async () => {
  const expected: Record<string, string> = {
    '2xs': '20px',
    xs: '24px',
    s: '30px',
    m: '40px',
    l: '48px',
    xl: '56px',
  };
  for (const [size, px] of Object.entries(expected)) {
    const el = await fixture(html`<lr-token-input size=${size}></lr-token-input>`);
    const wrapper = el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
    expect(getComputedStyle(wrapper).minBlockSize, `size=${size}`).to.equal(px);
  }
});

it('scales token-chip padding with the token-input size tier', async () => {
  const small = (await fixture(
    html`<lr-token-input size="2xs" .value=${['alpha']}></lr-token-input>`,
  )) as LyraTokenInput;
  const large = (await fixture(
    html`<lr-token-input size="xl" .value=${['alpha']}></lr-token-input>`,
  )) as LyraTokenInput;
  const smallToken = small.shadowRoot!.querySelector('[part="token"]') as HTMLElement;
  const largeToken = large.shadowRoot!.querySelector('[part="token"]') as HTMLElement;
  expect(parseFloat(getComputedStyle(largeToken).paddingInlineStart)).to.be.greaterThan(
    parseFloat(getComputedStyle(smallToken).paddingInlineStart),
  );
});

it('keeps the remove-button hit-area fixed across every size tier', async () => {
  const sizes = ['2xs', 'xs', 's', 'm', 'l', 'xl'];
  for (const size of sizes) {
    const el = (await fixture(
      html`<lr-token-input size=${size} .value=${['alpha']}></lr-token-input>`,
    )) as LyraTokenInput;
    const remove = el.shadowRoot!.querySelector('[part="remove"]') as HTMLElement;
    expect(getComputedStyle(remove).minBlockSize, `size=${size}`).to.equal('40px');
  }
});

it('gives the per-token remove button the shared minimum hit area', async () => {
  const el = (await fixture(html`<lr-token-input .value=${['alpha']}></lr-token-input>`)) as LyraTokenInput;
  const removeBtn = el.shadowRoot!.querySelector('[part="remove"]') as HTMLElement;
  expect(getComputedStyle(removeBtn).minInlineSize).to.equal('40px');
  expect(getComputedStyle(removeBtn).minBlockSize).to.equal('40px');
});

it('renders label/hint/error content passed through named slots', async () => {
  const el = (await fixture(html`
    <lr-token-input>
      <span slot="label">Recipients</span>
      <span slot="hint">Press enter to add</span>
      <span slot="error">Required</span>
    </lr-token-input>
  `)) as LyraTokenInput;
  const labelPart = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  const hintPart = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
  const errorPart = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
  expect(labelPart.hidden).to.be.false;
  expect(hintPart.hidden).to.be.false;
  expect(errorPart.hidden).to.be.false;
  const labelSlot = labelPart.querySelector('slot[name="label"]') as HTMLSlotElement;
  const hintSlot = hintPart.querySelector('slot[name="hint"]') as HTMLSlotElement;
  const errorSlot = errorPart.querySelector('slot[name="error"]') as HTMLSlotElement;
  expect((labelSlot.assignedElements()[0] as HTMLElement).textContent).to.equal('Recipients');
  expect((hintSlot.assignedElements()[0] as HTMLElement).textContent).to.equal('Press enter to add');
  expect((errorSlot.assignedElements()[0] as HTMLElement).textContent).to.equal('Required');
});

it('lets an explicit aria-label win over the computed aria-labelledby', async () => {
  const el = (await fixture(
    html`<lr-token-input label="Recipients" aria-label="Choose recipients"></lr-token-input>`,
  )) as LyraTokenInput;
  const wrapper = el.shadowRoot!.querySelector('[part="input-wrapper"]') as HTMLElement;
  expect(wrapper.getAttribute('aria-label')).to.equal('Choose recipients');
  expect(
    wrapper.hasAttribute('aria-labelledby'),
    'an explicit aria-label must suppress the computed labelledby id',
  ).to.be.false;
});

it('applies the host name and field descriptions to the actual draft textbox', async () => {
  const el = (await fixture(html`
    <lr-token-input aria-label="Choose recipients" hint="Separate names with commas"
      error-text="At least one recipient is required"></lr-token-input>
  `)) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector('#input') as HTMLInputElement;
  expect(input.getAttribute('aria-label')).to.equal('Choose recipients');
  const described = input.getAttribute('aria-describedby')!.split(' ');
  expect(described).to.include(el.shadowRoot!.querySelector('[part="hint"]')!.id);
  expect(described).to.include(el.shadowRoot!.querySelector('[part="error"]')!.id);
});

it('closes positional edit state rather than transferring it to a reordered replacement', async () => {
  const el = (await fixture(html`
    <lr-token-input editable .value=${['alpha', 'beta']}></lr-token-input>
  `)) as LyraTokenInput;
  (el.shadowRoot!.querySelectorAll('[part="token-label"]')[0] as HTMLElement).click();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="token-editor"]').length).to.equal(1);

  el.value = ['beta', 'alpha'];
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll('[part="token-editor"]').length).to.equal(0);
});

it('contains a single unbroken token inside a 320px allocation', async () => {
  const el = (await fixture(html`
    <lr-token-input style="inline-size:320px" .value=${['x'.repeat(120)]}></lr-token-input>
  `)) as LyraTokenInput;
  const token = el.shadowRoot!.querySelector('[part="token"]') as HTMLElement;
  expect(token.scrollWidth).to.be.at.most(token.clientWidth);
  expect(el.scrollWidth).to.be.at.most(320);
});

it('marks the draft input aria-invalid once touched with a validation failure, and clears it once valid', async () => {
  const el = (await fixture(html`<lr-token-input required></lr-token-input>`)) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector('#input') as HTMLInputElement;
  expect(input.getAttribute('aria-invalid'), 'untouched so far').to.equal('false');
  input.dispatchEvent(new Event('blur'));
  await el.updateComplete;
  expect(input.getAttribute('aria-invalid'), 'touched and still empty/invalid').to.equal('true');
  el.value = ['alpha'];
  await el.updateComplete;
  expect(input.getAttribute('aria-invalid'), 'touched but now valid').to.equal('false');
});

it('applies the label styling to the actual rendered form-control-label part', async () => {
  const el = (await fixture(html`<lr-token-input label="Recipients"></lr-token-input>`)) as LyraTokenInput;
  const label = el.shadowRoot!.querySelector('[part="form-control-label"]') as HTMLElement;
  expect(getComputedStyle(label).fontWeight).to.equal('600');
});

it('cascades disabled state from an ancestor fieldset without mutating the disabled property', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-token-input></lr-token-input>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-token-input') as LyraTokenInput;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  await el.updateComplete;
  expect(el.effectiveDisabled).to.be.false;
  expect(getComputedStyle(el).opacity, 'not yet fieldset-disabled').to.equal('1');

  fieldset.disabled = true;
  await el.updateComplete;
  expect(el.disabled, 'fieldset state must not mutate the public property').to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  expect(input.disabled).to.be.true;
  // `:host(:disabled)` (the native FACE pseudo-class), not `:host([disabled])`, must dim the host
  // purely from the fieldset cascade even though the component's own `disabled` attribute/property
  // was never touched -- otherwise the control looks fully active while every internal control is
  // functionally inert.
  expect(getComputedStyle(el).opacity, 'fieldset-only disabled must still dim the host').to.equal('0.5');

  fieldset.disabled = false;
  await el.updateComplete;
  expect(el.effectiveDisabled).to.be.false;
  expect(input.disabled).to.be.false;
  expect(getComputedStyle(el).opacity).to.equal('1');
});

it('gives the editable token-label a hover state matching its focus-visible ring and pointer cursor', async () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='token-label'\]:hover\s*\{[^}]*background:/);
});

it('focuses the draft input on host click(), mirroring lr-combobox\'s click forwarding', async () => {
  const el = (await fixture(html`<lr-token-input></lr-token-input>`)) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector('#input') as HTMLInputElement;
  expect(el.shadowRoot!.activeElement, 'nothing focused yet').to.equal(null);
  el.click();
  expect(el.shadowRoot!.activeElement!.id, 'host click() must forward focus to the draft input').to.equal(
    input.id,
  );
});

it('does not focus the draft input on host click() while disabled', async () => {
  const el = (await fixture(html`<lr-token-input disabled></lr-token-input>`)) as LyraTokenInput;
  el.click();
  expect(el.shadowRoot!.activeElement).to.equal(null);
});

describe('ElementInternals availability', () => {
  it('does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)', () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraTokenInput | undefined;
      expect(() => {
        el = document.createElement('lr-token-input') as LyraTokenInput;
      }).to.not.throw();
      expect(el!.checkValidity()).to.be.true;
      expect(el!.form).to.equal(null);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });

  it('falls back to no-op internals when attachInternals() throws (e.g. already attached)', () => {
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function attachInternals(): ElementInternals {
      throw new DOMException('ElementInternals for the specified element was already attached', 'InvalidStateError');
    };
    try {
      let el: LyraTokenInput | undefined;
      expect(() => {
        el = document.createElement('lr-token-input') as LyraTokenInput;
      }).to.not.throw();
      expect(el!.checkValidity()).to.be.true;
      expect(el!.reportValidity()).to.be.true;
      expect(el!.form).to.equal(null);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

it('calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
  const proto = LyraElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void };
  const original = proto.willUpdate;
  let called = false;
  proto.willUpdate = function (this: LyraElement, changed: PropertyValues): void {
    called = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-token-input></lr-token-input>`)) as LyraTokenInput;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    proto.willUpdate = original;
  }
});

it('calls super.updated so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
  const proto = LyraElement.prototype as unknown as { updated: (changed: PropertyValues) => void };
  const original = proto.updated;
  let called = false;
  proto.updated = function (this: LyraElement, changed: PropertyValues): void {
    called = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-token-input></lr-token-input>`)) as LyraTokenInput;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    proto.updated = original;
  }
});

it('submits under a programmatically assigned name in the same tick', async () => {
  const form = (await fixture(html`
    <form><lr-token-input .value=${['alpha', 'beta']}></lr-token-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-token-input') as LyraTokenInput;

  el.name = 'tags';
  expect(el.getAttribute('name')).to.equal('tags');
  expect(new FormData(form).getAll('tags')).to.deep.equal(['alpha', 'beta']);

  el.name = 'labels';
  const renamed = new FormData(form);
  expect(renamed.has('tags'), 'the old name must not still hold entries').to.be.false;
  expect(renamed.getAll('labels')).to.deep.equal(['alpha', 'beta']);

  el.name = '';
  expect(el.hasAttribute('name')).to.be.false;
  expect(el.name).to.equal('');
  expect(new FormData(form).has('labels')).to.be.false;

  el.setAttribute('name', 'from-attribute');
  expect(el.name).to.equal('from-attribute');
  expect(new FormData(form).getAll('from-attribute')).to.deep.equal(['alpha', 'beta']);
  el.removeAttribute('name');
  expect(el.name).to.equal('');
  expect(new FormData(form).has('from-attribute')).to.be.false;
});

it('updates validity synchronously when required changes, with no await', async () => {
  const el = (await fixture(html`<lr-token-input></lr-token-input>`)) as LyraTokenInput;
  expect(el.checkValidity()).to.be.true;

  el.required = true;
  expect(el.hasAttribute('required')).to.be.true;
  expect(el.checkValidity()).to.be.false;

  el.value = ['ready'];
  expect(el.checkValidity()).to.be.true;

  el.value = [];
  el.required = false;
  expect(el.checkValidity()).to.be.true;
});

it('applies and removes explicit disabled form state synchronously, with no await', async () => {
  const form = (await fixture(html`
    <form><lr-token-input name="tags" .value=${['alpha']}></lr-token-input></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-token-input') as LyraTokenInput;
  expect(new FormData(form).getAll('tags')).to.deep.equal(['alpha']);

  el.disabled = true;
  expect(el.hasAttribute('disabled'), 'the host attribute must be set synchronously').to.be.true;
  expect(el.effectiveDisabled).to.be.true;
  expect(new FormData(form).has('tags'), 'a disabled control must be omitted from FormData').to.be.false;

  el.disabled = false;
  expect(el.hasAttribute('disabled')).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(new FormData(form).getAll('tags')).to.deep.equal(['alpha']);
});

it('commits the draft on Tab without trapping focus for an extra keystroke', async () => {
  const el = (await fixture(html`<lr-token-input></lr-token-input>`)) as LyraTokenInput;
  const input = el.shadowRoot!.querySelector('input') as HTMLInputElement;
  input.value = 'alpha';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
  input.dispatchEvent(event);
  await el.updateComplete;
  expect(el.value).to.deep.equal(['alpha']);
  expect(event.defaultPrevented, 'Tab must not be prevented so native focus-advance still happens').to.be.false;
});

describe('editable tokens', () => {
  it('renders byte-identical token markup while editable is unset', async () => {
    const el = (await fixture(html`<lr-token-input .value=${['alpha']}></lr-token-input>`)) as LyraTokenInput;
    expect(el.editable, 'editable must default to false').to.be.false;
    const token = el.shadowRoot!.querySelector('[part="token"]') as HTMLElement;
    // Today's markup: <span part="token"><span>alpha</span><button part="remove" …></button></span>
    expect(token.getAttributeNames()).to.deep.equal(['part']);
    const label = token.querySelector('span') as HTMLElement;
    expect(label.getAttributeNames(), 'the plain label span must gain no attributes').to.deep.equal([]);
    expect(label.textContent).to.equal('alpha');
    expect(tokenLabels(el).length, 'token-label is an editable-only part').to.equal(0);
    expect(editor(el), 'token-editor is an editable-only part').to.equal(null);
    expect(
      el.shadowRoot!.querySelector('[part="input-wrapper"]')!.getAttribute('role'),
      'the row role is unchanged',
    ).to.equal('group');
  });

  it('opens a focused editor holding the full token when a token is clicked', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${[RULE]}></lr-token-input>`,
    )) as LyraTokenInput;
    const [label] = tokenLabels(el);
    expect(label.textContent).to.equal(RULE);
    label.click();
    await el.updateComplete;
    const field = editor(el)!;
    expect(field, 'clicking a token opens its editor').to.exist;
    expect(field.value, 'the editor holds the whole token, not a delimiter-split fragment').to.equal(RULE);
    expect(el.shadowRoot!.activeElement!.getAttribute('part')).to.equal('token-editor');
  });

  it('opens the editor from the keyboard with Enter, Space, and F2', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha']}></lr-token-input>`,
    )) as LyraTokenInput;
    for (const key of ['Enter', ' ', 'F2']) {
      const event = press(tokenLabels(el)[0], key);
      await el.updateComplete;
      expect(editor(el), `${key} must open the editor`).to.exist;
      expect(event.defaultPrevented, `${key} must not also scroll or submit`).to.be.true;
      press(editor(el)!, 'Escape');
      await el.updateComplete;
    }
  });

  it('commits an edit on Enter and reports the previous value', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${[RULE, 'other']}></lr-token-input>`,
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    const field = editor(el)!;
    typeInto(field, 'Bash(git diff:*)');
    const edited = oneEvent(el, 'lr-token-edit');
    press(field, 'Enter');
    const event = await edited;
    expect(event.detail).to.deep.equal({ value: 'Bash(git diff:*)', previousValue: RULE, index: 0 });
    await el.updateComplete;
    expect(el.value).to.deep.equal(['Bash(git diff:*)', 'other']);
    expect(editor(el), 'the editor closes on commit').to.equal(null);
    expect(el.shadowRoot!.activeElement!.getAttribute('part'), 'focus returns to the token').to.equal(
      'token-label',
    );
  });

  it('emits exactly one change for a committed edit, even though the editor blurs in the same tick', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha']}></lr-token-input>`,
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    const field = editor(el)!;
    let changes = 0;
    let inputs = 0;
    el.addEventListener('change', () => changes++);
    el.addEventListener('input', () => inputs++);
    typeInto(field, 'beta');
    press(field, 'Enter');
    // The editor is torn down while focused; a late blur must not commit a second time.
    field.dispatchEvent(new Event('blur'));
    await el.updateComplete;
    expect(el.value).to.deep.equal(['beta']);
    expect(changes, 'one commit is one change').to.equal(1);
    expect(inputs).to.equal(1);
  });

  it('commits the main draft and opens the editor without doubling change events', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha']}></lr-token-input>`,
    )) as LyraTokenInput;
    const main = el.shadowRoot!.querySelector('#input') as HTMLInputElement;
    let changes = 0;
    el.addEventListener('change', () => changes++);
    typeInto(main, 'gamma');
    main.dispatchEvent(new Event('blur'));
    tokenLabels(el)[0].click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(['alpha', 'gamma']);
    expect(changes, 'only the draft commit emitted change; opening an editor emits nothing').to.equal(1);
    expect(editor(el)).to.exist;
  });

  it('reverts on Escape without emitting', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha']}></lr-token-input>`,
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    const field = editor(el)!;
    let emitted = 0;
    for (const name of ['input', 'change', 'lr-token-edit']) el.addEventListener(name, () => emitted++);
    typeInto(field, 'beta');
    const event = press(field, 'Escape');
    await el.updateComplete;
    expect(el.value).to.deep.equal(['alpha']);
    expect(emitted, 'a reverted edit emits nothing').to.equal(0);
    expect(editor(el)).to.equal(null);
    expect(event.defaultPrevented).to.be.true;
    expect(el.shadowRoot!.activeElement!.getAttribute('part')).to.equal('token-label');
  });

  it('keeps Escape inside an open editor from reaching an enclosing dismissible layer', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha']}></lr-token-input>`,
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    let outer = 0;
    const onKeyDown = (): void => void outer++;
    document.addEventListener('keydown', onKeyDown);
    try {
      press(editor(el)!, 'Escape');
    } finally {
      document.removeEventListener('keydown', onKeyDown);
    }
    expect(outer, 'the editor consumes its own Escape').to.equal(0);
  });

  it('discards an edit that would duplicate an existing token unless allowDuplicates is set', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha', 'beta']}></lr-token-input>`,
    )) as LyraTokenInput;
    tokenLabels(el)[1].click();
    await el.updateComplete;
    let emitted = 0;
    for (const name of ['input', 'change', 'lr-token-edit']) el.addEventListener(name, () => emitted++);
    typeInto(editor(el)!, 'alpha');
    press(editor(el)!, 'Enter');
    await el.updateComplete;
    expect(el.value, 'the colliding edit is discarded, like a duplicate draft').to.deep.equal(['alpha', 'beta']);
    expect(emitted).to.equal(0);
    expect(editor(el), 'the editor still closes').to.equal(null);

    el.allowDuplicates = true;
    await el.updateComplete;
    tokenLabels(el)[1].click();
    await el.updateComplete;
    typeInto(editor(el)!, 'alpha');
    press(editor(el)!, 'Enter');
    await el.updateComplete;
    expect(el.value).to.deep.equal(['alpha', 'alpha']);
  });

  it('treats an emptied editor as a cancel rather than a removal', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha']}></lr-token-input>`,
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    typeInto(editor(el)!, '   ');
    press(editor(el)!, 'Enter');
    await el.updateComplete;
    expect(el.value).to.deep.equal(['alpha']);
    expect(editor(el)).to.equal(null);
  });

  it('gives the token row a roving tabindex that clamps when the token list shrinks', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['a', 'b', 'c']}></lr-token-input>`,
    )) as LyraTokenInput;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([0, -1, -1]);

    press(tokenLabels(el)[0], 'ArrowRight');
    await el.updateComplete;
    press(tokenLabels(el)[1], 'ArrowRight');
    await el.updateComplete;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([-1, -1, 0]);
    expect(el.shadowRoot!.activeElement!.textContent).to.equal('c');

    el.value = ['a'];
    await el.updateComplete;
    expect(
      tokenLabels(el).map((label) => label.tabIndex),
      'the roving index must clamp instead of leaving no tab stop',
    ).to.deep.equal([0]);
  });

  it('swaps the roving arrow keys under dir="rtl"', async () => {
    const wrapper = await fixture(html`
      <div dir="rtl"><lr-token-input editable .value=${['a', 'b']}></lr-token-input></div>
    `);
    const el = wrapper.querySelector('lr-token-input') as LyraTokenInput;
    await el.updateComplete;
    press(tokenLabels(el)[0], 'ArrowLeft');
    await el.updateComplete;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([-1, 0]);
    press(tokenLabels(el)[1], 'ArrowRight');
    await el.updateComplete;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([0, -1]);
  });

  it('navigates back with plain ArrowLeft, and jumps with Home/End, outside rtl', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['a', 'b', 'c']}></lr-token-input>`,
    )) as LyraTokenInput;
    press(tokenLabels(el)[0], 'ArrowRight');
    await el.updateComplete;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([-1, 0, -1]);

    const back = press(tokenLabels(el)[1], 'ArrowLeft');
    await el.updateComplete;
    expect(back.defaultPrevented).to.be.true;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([0, -1, -1]);
    expect(el.shadowRoot!.activeElement!.textContent).to.equal('a');

    const end = press(tokenLabels(el)[0], 'End');
    await el.updateComplete;
    expect(end.defaultPrevented).to.be.true;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([-1, -1, 0]);
    expect(el.shadowRoot!.activeElement!.textContent).to.equal('c');

    const home = press(tokenLabels(el)[2], 'Home');
    await el.updateComplete;
    expect(home.defaultPrevented).to.be.true;
    expect(tokenLabels(el).map((label) => label.tabIndex)).to.deep.equal([0, -1, -1]);
    expect(el.shadowRoot!.activeElement!.textContent).to.equal('a');
  });

  it('ignores token-row key navigation while disabled', async () => {
    const el = (await fixture(
      html`<lr-token-input editable disabled .value=${['alpha', 'beta']}></lr-token-input>`,
    )) as LyraTokenInput;
    press(tokenLabels(el)[0], 'Enter');
    await el.updateComplete;
    expect(editor(el), 'Enter must not open an editor while disabled').to.equal(null);
    press(tokenLabels(el)[0], 'ArrowRight');
    await el.updateComplete;
    expect(
      tokenLabels(el).map((label) => label.tabIndex),
      'roving focus must not move while disabled',
    ).to.deep.equal([0, -1]);
  });

  it('closes an open editor and discards its draft when a different token is removed out from under it', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha', 'beta', 'gamma']}></lr-token-input>`,
    )) as LyraTokenInput;
    tokenLabels(el)[1].click(); // open the editor on 'beta'
    await el.updateComplete;
    typeInto(editor(el)!, 'uncommitted-edit');
    const removeButtons = el.shadowRoot!.querySelectorAll('[part="remove"]');
    (removeButtons[0] as HTMLButtonElement).click(); // remove 'alpha' while 'beta' is mid-edit
    await el.updateComplete;
    expect(
      el.value,
      "alpha is removed and beta's uncommitted edit is discarded rather than committed against a stale index",
    ).to.deep.equal(['beta', 'gamma']);
    expect(editor(el), 'the editor must close rather than keep editing a reindexed token').to.equal(null);
  });

  it('is a no-op when Escape is pressed twice on the same already-closing editor', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha']}></lr-token-input>`,
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    const field = editor(el)!;
    press(field, 'Escape'); // closes the editor (state updates synchronously; DOM not yet re-rendered)
    const second = press(field, 'Escape'); // same stale node; cancelEdit() is already a no-op
    await el.updateComplete;
    expect(second.defaultPrevented, 'Escape is still consumed even once the editor state is already closed').to.be
      .true;
    expect(el.value).to.deep.equal(['alpha']);
    expect(editor(el)).to.equal(null);
    expect(el.shadowRoot!.activeElement!.getAttribute('part')).to.equal('token-label');
  });

  it('ignores a stale click on a token label whose index no longer exists after a synchronous removal', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha']}></lr-token-input>`,
    )) as LyraTokenInput;
    const label = tokenLabels(el)[0];
    const removeBtn = el.shadowRoot!.querySelector('[part="remove"]') as HTMLButtonElement;
    removeBtn.click(); // synchronously empties `value`; Lit has not yet re-rendered the stale `label` out
    label.click(); // stale DOM node still bound to index 0, now out of range
    await el.updateComplete;
    expect(el.value, 'the token stays removed').to.deep.equal([]);
    expect(editor(el), 'an out-of-range stale click must not open an editor').to.equal(null);
  });

  it('ignores a stale arrow-key press on a token label removed via a synchronous update', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha']}></lr-token-input>`,
    )) as LyraTokenInput;
    const label = tokenLabels(el)[0];
    el.value = []; // synchronous mutation; the stale `label` node is still live in the shadow DOM
    press(label, 'ArrowRight'); // must not throw or resurrect a roving index into an empty list
    await el.updateComplete;
    expect(el.value).to.deep.equal([]);
    expect(tokenLabels(el).length, 'no tokens left to roam').to.equal(0);
  });

  it('does not remove the last token when Backspace is pressed inside an open editor', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha', 'beta']}></lr-token-input>`,
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    typeInto(editor(el)!, '');
    press(editor(el)!, 'Backspace');
    await el.updateComplete;
    expect(el.value).to.deep.equal(['alpha', 'beta']);
  });

  it('keeps focus() and the validity anchor on the main input while an editor is open', async () => {
    const el = (await fixture(
      html`<lr-token-input editable required .value=${['alpha']}></lr-token-input>`,
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    expect(editor(el)).to.exist;
    typeInto(editor(el)!, 'beta');
    el.focus();
    expect(el.shadowRoot!.activeElement!.id, 'focus() must reach the main input, not the editor').to.equal(
      'input',
    );
    await el.updateComplete;
    // A blur commit applies the edit but must not pull focus back onto the token.
    expect(el.value).to.deep.equal(['beta']);
    expect(el.shadowRoot!.activeElement!.id).to.equal('input');
  });

  it('does not open an editor while disabled', async () => {
    const el = (await fixture(
      html`<lr-token-input editable disabled .value=${['alpha']}></lr-token-input>`,
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    expect(editor(el)).to.equal(null);
  });

  it('localizes the token edit accessible name via .strings', async () => {
    const el = (await fixture(
      html`<lr-token-input editable .value=${['alpha']}></lr-token-input>`,
    )) as LyraTokenInput;
    expect(tokenLabels(el)[0].getAttribute('aria-label')).to.equal('Edit alpha');
    el.strings = { tokenInputEditWithContext: 'Modifier {label}' };
    await el.updateComplete;
    expect(tokenLabels(el)[0].getAttribute('aria-label')).to.equal('Modifier alpha');
  });

  it('is accessible with an open token editor', async () => {
    const el = (await fixture(
      html`<lr-token-input editable label="Permissions" .value=${[RULE, 'other']}></lr-token-input>`,
    )) as LyraTokenInput;
    tokenLabels(el)[0].click();
    await el.updateComplete;
    expect(editor(el), 'the axe run must cover the open-editor state').to.exist;
    await expect(el).to.be.accessible();
  });
});

describe('delimiter', () => {
  it('inserts a literal comma instead of committing when delimiter is null', async () => {
    const el = (await fixture(
      html`<lr-token-input .delimiter=${null}></lr-token-input>`,
    )) as LyraTokenInput;
    const main = el.shadowRoot!.querySelector('#input') as HTMLInputElement;
    typeInto(main, 'a,b');
    const comma = press(main, ',');
    expect(comma.defaultPrevented, 'a comma is just a character when delimiter is null').to.be.false;
    expect(el.value).to.deep.equal([]);
    press(main, 'Enter');
    await el.updateComplete;
    expect(el.value, 'a null delimiter must not split the draft').to.deep.equal(['a,b']);
  });

  it('maps delimiter="none" and delimiter="" to a null delimiter from an attribute', async () => {
    const el = (await fixture(html`<lr-token-input delimiter="none"></lr-token-input>`)) as LyraTokenInput;
    expect(el.delimiter).to.equal(null);
    const main = el.shadowRoot!.querySelector('#input') as HTMLInputElement;
    typeInto(main, 'a,b');
    press(main, 'Enter');
    await el.updateComplete;
    expect(el.value).to.deep.equal(['a,b']);

    el.setAttribute('delimiter', '');
    expect(el.delimiter, 'an empty delimiter must not explode the draft into characters').to.equal(null);
    el.setAttribute('delimiter', ';');
    expect(el.delimiter).to.equal(';');
    el.removeAttribute('delimiter');
    expect(el.delimiter, 'removing the attribute restores the default').to.equal(',');
  });
});

it('colors placeholder text on both editable fields and gives the remove button hover/focus', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='input'\]::placeholder\s*\{[^}]*color:\s*var\(--lr-color-text-quiet\)/);
  expect(css).to.match(/\[part='token-editor'\]::placeholder\s*\{[^}]*color:\s*var\(--lr-color-text-quiet\)/);
  expect(css).to.match(/\[part='remove'\]:hover\s*\{[^}]*background:/);
  expect(css).to.match(/\[part='remove'\]:focus-visible\s*\{[^}]*outline:/);
});
