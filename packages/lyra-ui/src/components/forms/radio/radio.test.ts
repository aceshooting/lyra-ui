import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './radio.js';
import './radio-group.js';
import type { LyraRadio } from './radio.js';
import type { LyraRadioGroup } from './radio-group.js';

it('renders radio semantics and explicit false states', async () => {
  const el = (await fixture(html`<lr-radio>One</lr-radio>`)) as LyraRadio;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('radio');
  expect(base.getAttribute('aria-checked')).to.equal('false');
  expect(base.getAttribute('aria-disabled')).to.equal('false');
  expect(base.getAttribute('aria-required')).to.equal('false');
  await expect(el).to.be.accessible();
});

it('selects and emits native-style events', async () => {
  const el = (await fixture(html`<lr-radio value="a">A</lr-radio>`)) as LyraRadio;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const events: string[] = [];
  for (const name of ['input', 'change', 'lr-change']) el.addEventListener(name, () => events.push(name));
  base.click();
  expect(el.checked).to.be.true;
  expect(events).to.deep.equal(['input', 'change', 'lr-change']);
});

it('forwards a host-level click() to the internal base control, like lr-button', async () => {
  // A generic form-submit helper, test utility, or automation script that calls
  // `.click()` on the host element (rather than clicking rendered pixels inside
  // its shadow DOM) must still toggle selection.
  const el = (await fixture(html`<lr-radio value="a">A</lr-radio>`)) as LyraRadio;
  await el.updateComplete;

  el.click();

  expect(el.checked).to.be.true;
});

it('moves selection and DOM focus when arrow navigation is used', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  const firstBase = radios[0].shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const secondBase = radios[1].shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  radios[0].checked = true;
  firstBase.focus();
  const eventPromise = oneEvent(group, 'lr-change');
  firstBase.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
  const event = await eventPromise;
  expect(event.detail.value).to.equal('b');
  expect(radios[1].checked).to.be.true;
  expect(radios[1].shadowRoot!.activeElement === secondBase).to.be.true;
  await expect(group).to.be.accessible();
});

it('uses roving tabindex: only the checked (or first enabled) radio is a Tab stop', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  await group.updateComplete;
  const radios = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  const base = (r: LyraRadio) => r.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base(radios[0]).tabIndex).to.equal(0);
  expect(base(radios[1]).tabIndex).to.equal(-1);

  base(radios[1]).click();
  await group.updateComplete;
  expect(base(radios[0]).tabIndex).to.equal(-1);
  expect(base(radios[1]).tabIndex).to.equal(0);
});

it('exposes an accessible name for the radiogroup from its visible label', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const base = group.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const labelId = base.getAttribute('aria-labelledby');
  expect(labelId).to.be.ok;
  expect(group.shadowRoot!.getElementById(labelId!)?.textContent).to.contain('Choice');
});

it('restores the declarative default-checked state on form reset', async () => {
  const form = (await fixture(html`
    <form>
      <lr-radio name="choice" value="a" checked>A</lr-radio>
      <lr-radio name="choice" value="b">B</lr-radio>
    </form>
  `)) as HTMLFormElement;
  const [a, b] = [...form.querySelectorAll('lr-radio')] as LyraRadio[];
  expect(a.checked).to.be.true;

  b.checked = true;
  a.checked = false;
  expect(a.checked).to.be.false;
  expect(b.checked).to.be.true;

  form.reset();
  expect(a.checked, 'a restores its declarative checked default').to.be.true;
  expect(b.checked, 'b restores its (unchecked) declarative default').to.be.false;
});

it('exposes native form validity/focus APIs and restores serialized checked state', async () => {
  const form = (await fixture(html`
    <form><lr-radio name="choice" value="a" required>A</lr-radio></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-radio') as LyraRadio;

  expect(el.form).to.equal(form);
  expect(el.validity.valueMissing).to.be.true;
  expect(el.validationMessage).to.equal('Please select an option.');
  expect(el.willValidate).to.be.true;

  el.formStateRestoreCallback('checked', 'restore');
  await el.updateComplete;
  expect(el.checked).to.be.true;
  expect(el.validity.valid).to.be.true;
  expect(new FormData(form).get('choice')).to.equal('a');

  el.focus({ preventScroll: true });
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
  el.blur();
  expect(el.shadowRoot!.activeElement).to.equal(null);

  el.formStateRestoreCallback('unchecked', 'autocomplete');
  expect(el.checked).to.be.false;
});

it('temporarily disables a bare radio through an ancestor fieldset without overwriting the author disabled state', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-radio value="a">A</lr-radio>
        <lr-radio value="b" disabled>B</lr-radio>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const [a, b] = [...form.querySelectorAll('lr-radio')] as LyraRadio[];
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;

  expect(a.effectiveDisabled).to.be.false;
  expect(b.disabled).to.be.true;

  // No `await` before these assertions: `formDisabledCallback` fires
  // synchronously when the fieldset's `disabled` property is set.
  fieldset.disabled = true;
  expect(a.effectiveDisabled, 'an ancestor fieldset must reach a bare lr-radio').to.be.true;
  expect(a.disabled, 'fieldset state must never mutate the public disabled property').to.be.false;
  expect(a.hasAttribute('disabled'), 'the host attribute must not be mutated either').to.be.false;
  expect(b.disabled, 'an already-explicitly-disabled radio is unaffected').to.be.true;
  expect(b.effectiveDisabled).to.be.true;

  fieldset.disabled = false;
  expect(a.effectiveDisabled, 'must not be permanently stuck disabled once the fieldset re-enables').to.be.false;
  expect(a.disabled).to.be.false;
  expect(b.disabled, 'an explicit disabled state survives the fieldset cycle').to.be.true;
  expect(b.effectiveDisabled).to.be.true;

  await Promise.all([a.updateComplete, b.updateComplete]);
  const aBase = a.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(aBase.getAttribute('aria-disabled')).to.equal('false');
  expect(aBase.getAttribute('tabindex')).to.equal('0');
});

it('dims the base part via the :disabled pseudo-class when disabled only through an ancestor fieldset', async () => {
  // effectiveDisabled correctly gates the internal control's functional
  // disabling even when disabled purely by fieldset cascading (see the test
  // above), but that alone doesn't prove the *visual* treatment follows --
  // the base part's opacity/cursor styling is keyed off a CSS selector
  // (:host(:disabled)), not effectiveDisabled, so it needs its own
  // assertion. Mirrors lr-checkbox's identical fieldset/computed-style
  // coverage.
  const form = (await fixture(html`
    <form>
      <fieldset disabled>
        <lr-radio value="a">A</lr-radio>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-radio') as LyraRadio;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  expect(getComputedStyle(base).opacity).to.equal('0.5');
  expect(getComputedStyle(base).cursor).to.equal('not-allowed');
});

it('cascades fieldset-disabled state down to radios nested inside a lr-radio-group', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-radio-group label="Choice">
          <lr-radio value="a">A</lr-radio>
          <lr-radio value="b">B</lr-radio>
        </lr-radio-group>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const group = form.querySelector('lr-radio-group') as LyraRadioGroup;
  const [a, b] = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  await group.updateComplete;

  expect(a.effectiveDisabled).to.be.false;
  expect(b.effectiveDisabled).to.be.false;

  fieldset.disabled = true;
  expect(a.effectiveDisabled, 'fieldset state must reach radios nested inside a radio-group').to.be.true;
  expect(b.effectiveDisabled).to.be.true;
  expect(a.disabled, 'fieldset state must never mutate the public disabled property').to.be.false;

  fieldset.disabled = false;
  expect(a.effectiveDisabled).to.be.false;
  expect(b.effectiveDisabled).to.be.false;
});

it('wires hint/error text to aria-describedby on the radiogroup', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice">
      <lr-radio value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const base = group.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.hasAttribute('aria-describedby')).to.be.false;

  group.hint = 'Pick one';
  await group.updateComplete;
  const hintId = group.shadowRoot!.querySelector('[part="hint"]')!.id;
  expect(hintId).to.be.ok;
  expect(base.getAttribute('aria-describedby')).to.equal(hintId);

  group.errorText = 'Selection required';
  await group.updateComplete;
  const errorId = group.shadowRoot!.querySelector('[part="error"]')!.id;
  expect(errorId).to.be.ok;
  expect(base.getAttribute('aria-describedby')).to.equal(`${hintId} ${errorId}`);
});

it('renders a required-asterisk on the radiogroup label', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice" required>
      <lr-radio value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const label = group.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const after = getComputedStyle(label, '::after');
  expect(after.content).to.contain('*');
});

it('clears group-imposed disabled/required on every radio when turned back off', async () => {
  const group = (await fixture(html`
    <lr-radio-group label="Choice" disabled required>
      <lr-radio value="a">A</lr-radio>
      <lr-radio value="b">B</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  expect(radios[0].effectiveDisabled).to.be.true;
  expect(radios[0].effectiveRequired).to.be.true;

  group.disabled = false;
  group.required = false;
  await group.updateComplete;
  await new Promise((resolve) => queueMicrotask(resolve));
  expect(radios[0].effectiveDisabled).to.be.false;
  expect(radios[1].effectiveDisabled).to.be.false;
  expect(radios[0].effectiveRequired).to.be.false;
  expect(radios[1].effectiveRequired).to.be.false;
});

it('does not move or select from keyboard while the group or fieldset is disabled', async () => {
  const form = (await fixture(html`
    <form><fieldset>
      <lr-radio-group label="Choice">
        <lr-radio value="a" checked>A</lr-radio>
        <lr-radio value="b">B</lr-radio>
      </lr-radio-group>
    </fieldset></form>
  `)) as HTMLFormElement;
  const group = form.querySelector('lr-radio-group') as LyraRadioGroup;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  const [a, b] = [...group.querySelectorAll('lr-radio')] as LyraRadio[];
  a.checked = true;

  group.disabled = true;
  await group.updateComplete;
  a.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true }));
  expect(a.checked).to.be.true;
  expect(b.checked).to.be.false;

  group.disabled = false;
  fieldset.disabled = true;
  await group.updateComplete;
  a.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  expect(a.checked).to.be.true;
  expect(b.checked).to.be.false;
});

it('reconciles appended and removed radios and releases group-imposed state', async () => {
  const group = (await fixture(html`
    <lr-radio-group name="choice" required disabled>
      <lr-radio value="a">A</lr-radio>
    </lr-radio-group>
  `)) as LyraRadioGroup;
  group.name = 'choice';
  const removed = group.querySelector('lr-radio') as LyraRadio;
  const added = document.createElement('lr-radio') as LyraRadio;
  added.value = 'b';
  added.textContent = 'B';
  const slot = group.shadowRoot!.querySelector('slot:not([name])') as HTMLSlotElement;
  const appended = oneEvent(slot, 'slotchange');
  group.append(added);
  await appended;
  await added.updateComplete;
  await group.updateComplete;

  expect(group.querySelectorAll('lr-radio').length).to.equal(2);
  expect(group.name).to.equal('choice');
  expect(group.getAttribute('name')).to.equal('choice');
  expect(added.effectiveDisabled).to.be.true;
  expect(added.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-required')).to.equal('true');
  expect(added.shadowRoot!.querySelector('[part="base"]')!.getAttribute('tabindex')).to.equal('-1');

  const removedEvent = oneEvent(slot, 'slotchange');
  removed.remove();
  await removedEvent;
  await removed.updateComplete;
  await group.updateComplete;
  expect(removed.effectiveDisabled).to.be.false;
  expect(removed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-required')).to.equal('false');
  expect(removed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('tabindex')).to.equal('0');
});

it('floors the circle with min-* sizing instead of hard-sizing it, so the indicator can never overflow the tap target', async () => {
  const el = (await fixture(html`<lr-radio checked aria-label="One"></lr-radio>`)) as LyraRadio;
  await el.updateComplete;
  const circle = el.shadowRoot!.querySelector('[part="circle"]') as HTMLElement;

  // Default tokens: min(--lr-icon-button-size 2.5rem, --lr-size-1-75rem) === 1.75rem === 28px,
  // comfortably above the WCAG 2.2 SC 2.5.8 24x24 minimum. For a label-less radio the circle *is*
  // the whole tap target -- [part='base'] contributes no box of its own.
  const floored = circle.getBoundingClientRect();
  expect(floored.width).to.be.closeTo(28, 0.5);
  expect(floored.height).to.be.closeTo(28, 0.5);

  // A hard `inline-size`/`block-size` cannot grow for its own content: enlarging the dot would clip
  // it and leave the circle at 28px. `min-inline-size`/`min-block-size` (the form <lr-checkbox>'s
  // [part='box'] already uses) is a floor, so the circle grows to contain the indicator instead.
  el.style.setProperty('--lr-size-0-75rem', '3rem');
  const grown = circle.getBoundingClientRect();
  expect(grown.width).to.be.at.least(48);
  expect(grown.height).to.be.at.least(48);
});

it('publishes --lr-radio-label-indent and drives the real label offset from it', async () => {
  const el = (await fixture(html`<lr-radio value="a">A</lr-radio>`)) as LyraRadio;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;

  // Published, so a consumer aligning their own per-option hint text no longer has to re-derive
  // `min(--lr-icon-button-size, 1.75rem) + --lr-space-s` by reading the shadow styles.
  expect(getComputedStyle(el).getPropertyValue('--lr-radio-label-indent').trim()).to.not.equal('');

  // 1.75rem circle + 0.5rem gap === 2.25rem === 36px.
  expect(label.getBoundingClientRect().left - base.getBoundingClientRect().left).to.be.closeTo(36, 0.5);

  // The published value and the rendered geometry cannot drift: retuning it moves the label.
  el.style.setProperty('--lr-radio-label-indent', '4rem');
  expect(label.getBoundingClientRect().left - base.getBoundingClientRect().left).to.be.closeTo(64, 0.5);
});

it('is accessible as a label-less radio named only by aria-label', async () => {
  const el = (await fixture(html`<lr-radio checked aria-label="Only option"></lr-radio>`)) as LyraRadio;
  await expect(el).to.be.accessible();
});

describe('lifecycle: attachInternals guard', () => {
  it('degrades gracefully instead of throwing when ElementInternals is unavailable', async () => {
    const original = (globalThis as { ElementInternals?: unknown }).ElementInternals;
    // @ts-expect-error -- deliberately simulating an environment (e.g. happy-dom) with no
    // ElementInternals implementation at all.
    delete (globalThis as { ElementInternals?: unknown }).ElementInternals;
    try {
      expect(() => document.createElement('lr-radio')).to.not.throw();
      const el = (await fixture(html`<lr-radio value="a">A</lr-radio>`)) as LyraRadio;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(1);
      expect(() => el.click()).to.not.throw();
    } finally {
      (globalThis as { ElementInternals?: unknown }).ElementInternals = original;
    }
  });

  it('degrades gracefully instead of throwing when the native attachInternals() call itself throws', async () => {
    // Scoped to just this tag -- default lyra-radio fixtures render no other
    // form-associated shadow children, but scope defensively anyway.
    const original = HTMLElement.prototype.attachInternals;
    HTMLElement.prototype.attachInternals = function (this: HTMLElement) {
      if (this.tagName.toLowerCase() === 'lr-radio') {
        throw new DOMException('attachInternals is not supported', 'NotSupportedError');
      }
      return original.call(this);
    };
    try {
      expect(() => document.createElement('lr-radio')).to.not.throw();
      const el = (await fixture(html`<lr-radio value="a">A</lr-radio>`)) as LyraRadio;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelectorAll('[part="base"]').length).to.equal(1);
      expect(() => el.click()).to.not.throw();
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

describe('validationMessage localization', () => {
  it('defaults to the built-in English validationMessage for a required, unselected radio', async () => {
    const el = (await fixture(html`<lr-radio required value="a">A</lr-radio>`)) as LyraRadio;
    expect(el.validationMessage).to.equal('Please select an option.');
  });

  it('localizes the validationMessage via this.localize() when .strings overrides radioRequired', async () => {
    const el = (await fixture(html`
      <lr-radio required value="a" .strings=${{ radioRequired: 'Veuillez sélectionner une option.' }}
        >A</lr-radio
      >
    `)) as LyraRadio;
    expect(el.validationMessage).to.equal('Veuillez sélectionner une option.');

    el.checked = true;
    expect(el.validationMessage).to.equal('');
  });
});
