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
