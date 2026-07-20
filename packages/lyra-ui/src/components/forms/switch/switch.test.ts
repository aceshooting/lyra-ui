import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import type { PropertyValues } from 'lit';
import './switch.js';
import type { LyraSwitch } from './switch.js';
import { styles } from './switch.styles.js';
import { LyraElement } from '../../../internal/lyra-element.js';

it('exposes namespaced geometry custom properties', () => {
  expect(styles.cssText).to.include('--lr-switch-track-inline-size');
  expect(styles.cssText).to.include('--lr-switch-track-block-size');
  expect(styles.cssText).to.include('--lr-switch-thumb-offset');
  expect(styles.cssText).to.not.include('--track-inline-size');
  expect(styles.cssText).to.not.include('--track-block-size');
  expect(styles.cssText).to.not.include('--thumb-offset');
});

it('gives the switch control hover feedback matching the keyboard focus-visible cue', () => {
  const css = styles.cssText.replace(/\s+/g, ' ');
  expect(css).to.match(/\[part='base'\]:hover\s*\{[^}]*filter:/);
});

it('forwards host click() to the internal control, toggling checked', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  expect(el.checked).to.be.false;

  const event = oneEvent(el, 'lr-change');
  el.click();
  const result = await event;
  expect(result.detail.checked).to.be.true;
  expect(el.checked).to.be.true;
});

it('does not toggle on host click() while disabled', async () => {
  const el = (await fixture(html`<lr-switch disabled>Label</lr-switch>`)) as LyraSwitch;
  el.click();
  expect(el.checked).to.be.false;
});

describe('ElementInternals availability', () => {
  it('does not throw when constructed in an environment without a real ElementInternals implementation (e.g. a downstream Vitest + happy-dom suite)', () => {
    const original = HTMLElement.prototype.attachInternals;
    // @ts-expect-error -- simulating an environment that lacks ElementInternals entirely
    delete HTMLElement.prototype.attachInternals;
    try {
      let el: LyraSwitch | undefined;
      expect(() => {
        el = document.createElement('lr-switch') as LyraSwitch;
      }).to.not.throw();
      // Confirm the fallback keeps the rest of the public surface usable rather than merely
      // swallowing the constructor error.
      expect(el!.checkValidity()).to.be.true;
      expect(el!.form).to.equal(null);
    } finally {
      HTMLElement.prototype.attachInternals = original;
    }
  });
});

it('calls super.willUpdate so a future LyraElement/mixin lifecycle hook stays wired in', async () => {
  // Monkey-patch LyraElement.prototype.willUpdate (the established pattern, e.g. checkbox.test.ts)
  // to prove LyraSwitch's own willUpdate() override actually calls super.willUpdate(...) rather
  // than shadowing it silently.
  const proto = LyraElement.prototype as unknown as { willUpdate: (changed: PropertyValues) => void };
  const original = proto.willUpdate;
  let called = false;
  proto.willUpdate = function (this: LyraElement, changed: PropertyValues): void {
    called = true;
    original.call(this, changed);
  };
  try {
    const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
    await el.updateComplete;
    expect(called).to.be.true;
  } finally {
    proto.willUpdate = original;
  }
});

it('defaults to unchecked with role="switch" and aria-checked="false"', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(el.checked).to.be.false;
  expect(base.getAttribute('role')).to.equal('switch');
  expect(base.getAttribute('aria-checked')).to.equal('false');
});

it('reflects checked to the attribute and to aria-checked', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  el.checked = true;
  await el.updateComplete;
  expect(el.hasAttribute('checked')).to.be.true;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-checked')).to.equal('true');
});

it('toggles and emits lr-change with detail.checked on click', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  setTimeout(() => base.click());
  let ev = await oneEvent(el, 'lr-change');
  expect(ev.detail.checked).to.be.true;
  expect(el.checked).to.be.true;

  setTimeout(() => base.click());
  ev = await oneEvent(el, 'lr-change');
  expect(ev.detail.checked).to.be.false;
  expect(el.checked).to.be.false;
});

it('toggles on Space and Enter keydown', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  setTimeout(() =>
    base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })),
  );
  let ev = await oneEvent(el, 'lr-change');
  expect(ev.detail.checked).to.be.true;

  setTimeout(() =>
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
  );
  ev = await oneEvent(el, 'lr-change');
  expect(ev.detail.checked).to.be.false;
});

it('preventDefault()s the Space keydown so the page does not scroll', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  base.dispatchEvent(ev);
  expect(ev.defaultPrevented).to.be.true;
});

it('ignores click and keydown activation while disabled, and is not focusable', async () => {
  const el = (await fixture(html`<lr-switch disabled>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('tabindex')).to.equal('-1');
  expect(base.getAttribute('aria-disabled')).to.equal('true');

  let fired = false;
  el.addEventListener('lr-change', () => (fired = true));
  base.click();
  base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  expect(fired).to.be.false;
  expect(el.checked).to.be.false;
});

it('is focusable (tabindex 0) when enabled', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('tabindex')).to.equal('0');
});

it('exposes explicit false aria-required/aria-disabled states by default', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-required')).to.equal('false');
  expect(base.getAttribute('aria-disabled')).to.equal('false');
});

it('sets aria-required when required', async () => {
  const el = (await fixture(html`<lr-switch required>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-required')).to.equal('true');
});

it('forwards focus() and blur() to the internal switch control', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  el.focus();
  expect(el.shadowRoot!.activeElement === base).to.be.true;
  el.blur();
  expect(el.shadowRoot!.activeElement).to.equal(null);
});

it('re-dispatches the internal control focus/blur as bubbling, composed host-level events', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;

  const focusPromise = oneEvent(el, 'focus');
  el.focus();
  const focusEvent = await focusPromise;
  expect(focusEvent.bubbles).to.be.true;
  expect(focusEvent.composed).to.be.true;
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');

  const blurPromise = oneEvent(el, 'blur');
  el.blur();
  const blurEvent = await blurPromise;
  expect(blurEvent.bubbles).to.be.true;
  expect(blurEvent.composed).to.be.true;
  expect(el.shadowRoot!.activeElement).to.equal(null);
});

it('reflects aria-invalid on the inner switch only after the field has been interacted with once', async () => {
  const el = (await fixture(html`<lr-switch required>Label</lr-switch>`)) as LyraSwitch;
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-invalid')).to.equal('false');

  base.dispatchEvent(new FocusEvent('blur'));
  await el.updateComplete;
  expect(base.getAttribute('aria-invalid')).to.equal('true');

  el.checked = true;
  await el.updateComplete;
  expect(base.getAttribute('aria-invalid')).to.equal('false');
});

it('hides the label part when the default slot has no real content', async () => {
  const el = (await fixture(html`<lr-switch></lr-switch>`)) as LyraSwitch;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.true;
});

it('shows the label part for plain slotted text (a text node, not an element)', async () => {
  const el = (await fixture(html`<lr-switch>Enable notifications</lr-switch>`)) as LyraSwitch;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.false;
});

it('forwards a host aria-label onto the inner role="switch" element', async () => {
  const el = (await fixture(
    html`<lr-switch aria-label="Enable notifications"></lr-switch>`,
  )) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Enable notifications');
});

it('does not set an empty aria-label on the inner element when the host has none', async () => {
  const el = (await fixture(html`<lr-switch>Label</lr-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.hasAttribute('aria-label')).to.be.false;
});

it('participates in a form: submits value under name only when checked', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify" value="yes">Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;

  expect(new FormData(form).get('notify')).to.equal(null);

  el.checked = true;
  await el.updateComplete;
  expect(new FormData(form).get('notify')).to.equal('yes');

  el.checked = false;
  await el.updateComplete;
  expect(new FormData(form).get('notify')).to.equal(null);
});

it('updates form value and validity synchronously when checked changes', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify" value="yes" required>Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;

  expect(el.checkValidity()).to.be.false;

  el.checked = true;
  expect(new FormData(form).get('notify')).to.equal('yes');
  expect(el.checkValidity()).to.be.true;

  el.checked = false;
  expect(new FormData(form).get('notify')).to.equal(null);
  expect(el.checkValidity()).to.be.false;
});

it('updates the submitted value synchronously when value changes', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify" value="yes" checked>Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;

  el.value = 'updated';
  expect(new FormData(form).get('notify')).to.equal('updated');
});

it('updates validity synchronously when required changes', async () => {
  const el = (await fixture(html`
    <lr-switch name="terms">Agree</lr-switch>
  `)) as LyraSwitch;

  expect(el.checkValidity()).to.be.true;
  el.required = true;
  expect(el.checkValidity()).to.be.false;
  el.required = false;
  expect(el.checkValidity()).to.be.true;
});

describe('validationMessage localization', () => {
  it('defaults to the built-in English validationMessage for a required, unchecked control', async () => {
    const el = (await fixture(html`<lr-switch required>Agree</lr-switch>`)) as LyraSwitch;
    expect(el.validationMessage).to.equal('Please turn this on.');
  });

  it('localizes the validationMessage via this.localize() when .strings overrides switchRequired', async () => {
    const el = (await fixture(html`
      <lr-switch required .strings=${{ switchRequired: 'Veuillez activer ceci.' }}>Agree</lr-switch>
    `)) as LyraSwitch;
    expect(el.validationMessage).to.equal('Veuillez activer ceci.');

    el.checked = true;
    expect(el.validationMessage).to.equal('');
  });
});

it('submits under a programmatically assigned name in the same tick', async () => {
  const form = (await fixture(html`
    <form><lr-switch value="yes" checked>Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;

  el.name = 'first';
  expect(el.getAttribute('name')).to.equal('first');
  expect(new FormData(form).get('first')).to.equal('yes');

  el.name = 'second';
  const renamed = new FormData(form);
  expect(renamed.has('first')).to.be.false;
  expect(renamed.get('second')).to.equal('yes');

  el.name = '';
  expect(el.hasAttribute('name')).to.be.false;
  expect(el.name).to.equal('');
  expect(new FormData(form).has('second')).to.be.false;

  el.setAttribute('name', 'from-attribute');
  expect(el.name).to.equal('from-attribute');
  expect(new FormData(form).get('from-attribute')).to.equal('yes');
  el.removeAttribute('name');
  expect(el.name).to.equal('');
  expect(new FormData(form).has('from-attribute')).to.be.false;
});

it('uses "on" as the default form value', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify" checked>Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  expect(new FormData(form).get('notify')).to.equal('on');
});

it('blocks a required, unchecked switch from submitting the form', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="terms" required>Agree</lr-switch></form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;

  const el = form.querySelector('lr-switch') as LyraSwitch;
  el.checked = true;
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it('focuses the inner switch after direct and submit-driven validity reporting', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before switch</button>
      <lr-switch name="terms" required>Agree</lr-switch>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector('button') as HTMLButtonElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;
  let submitCount = 0;
  form.addEventListener('submit', (event) => {
    submitCount += 1;
    event.preventDefault();
  });

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lr-switch');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');

  sentinel.focus();
  form.requestSubmit();
  expect(submitCount).to.equal(0);
  expect(document.activeElement?.localName).to.equal('lr-switch');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
});

it('applies and removes explicit disabled form state synchronously', async () => {
  const form = (await fixture(html`
    <form>
      <lr-switch id="submitted" name="notify" value="yes" checked>Notify me</lr-switch>
      <lr-switch id="invalid" name="terms" required>Agree</lr-switch>
    </form>
  `)) as HTMLFormElement;
  const submitted = form.querySelector('#submitted') as LyraSwitch;
  const invalid = form.querySelector('#invalid') as LyraSwitch;

  expect(new FormData(form).get('notify')).to.equal('yes');
  expect(invalid.checkValidity()).to.be.false;

  submitted.disabled = true;
  invalid.disabled = true;
  expect(submitted.hasAttribute('disabled')).to.be.true;
  expect(invalid.hasAttribute('disabled')).to.be.true;
  expect(new FormData(form).has('notify')).to.be.false;
  expect(invalid.checkValidity()).to.be.true;

  submitted.disabled = false;
  invalid.disabled = false;
  expect(submitted.hasAttribute('disabled')).to.be.false;
  expect(invalid.hasAttribute('disabled')).to.be.false;
  expect(new FormData(form).get('notify')).to.equal('yes');
  expect(invalid.checkValidity()).to.be.false;
});

it('restores the declared default checked state on form.reset()', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify" value="yes" checked required>Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;
  expect(el.checked).to.be.true;

  el.checked = false;
  await el.updateComplete;
  expect(el.checked).to.be.false;
  expect(new FormData(form).get('notify')).to.equal(null);
  expect(el.checkValidity()).to.be.false;

  form.reset();
  expect(el.checked, 'reset must restore the declared default, not blank/false').to.be.true;
  expect(new FormData(form).get('notify')).to.equal('yes');
  expect(el.checkValidity()).to.be.true;
});

it('resets to unchecked via form.reset() when no default was declared', async () => {
  const form = (await fixture(html`
    <form><lr-switch name="notify">Notify me</lr-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;
  el.checked = true;
  await el.updateComplete;
  expect(new FormData(form).get('notify')).to.equal('on');

  form.reset();
  expect(el.checked).to.be.false;
  expect(new FormData(form).get('notify')).to.equal(null);
});

it('does not turn a pre-connect checked property assignment into the reset default', async () => {
  const form = document.createElement('form');
  const el = document.createElement('lr-switch') as LyraSwitch;
  el.checked = true;
  form.append(el);
  document.body.append(form);
  await el.updateComplete;

  form.reset();
  expect(el.checked).to.be.false;
  form.remove();
});

it('temporarily disables through a fieldset without overwriting the author disabled state', async () => {
  const form = (await fixture(html`
    <form>
      <fieldset>
        <lr-switch name="notify" value="yes" checked>Notify me</lr-switch>
        <lr-switch name="always-disabled" value="yes" checked disabled>Always disabled</lr-switch>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lr-switch') as LyraSwitch;
  const explicitlyDisabled = form.querySelector('[name="always-disabled"]') as LyraSwitch;
  const fieldset = form.querySelector('fieldset') as HTMLFieldSetElement;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(new FormData(form).get('notify')).to.equal('yes');

  fieldset.disabled = true;
  await Promise.all([el.updateComplete, explicitlyDisabled.updateComplete]);
  expect(el.disabled, 'fieldset state must not mutate the public property').to.be.false;
  expect(el.hasAttribute('disabled')).to.be.false;
  expect(el.effectiveDisabled).to.be.true;
  expect(base.getAttribute('tabindex')).to.equal('-1');
  expect(base.getAttribute('aria-disabled')).to.equal('true');
  expect(getComputedStyle(base).cursor).to.equal('not-allowed');
  expect(new FormData(form).get('notify')).to.equal(null);

  base.click();
  expect(el.checked, 'inherited disabled state blocks activation').to.be.true;

  fieldset.disabled = false;
  await Promise.all([el.updateComplete, explicitlyDisabled.updateComplete]);
  expect(el.disabled).to.be.false;
  expect(el.effectiveDisabled).to.be.false;
  expect(base.getAttribute('tabindex')).to.equal('0');
  expect(base.getAttribute('aria-disabled')).to.equal('false');
  expect(new FormData(form).get('notify')).to.equal('yes');

  expect(explicitlyDisabled.disabled, 'an explicit disabled state survives the fieldset cycle').to.be.true;
  expect(explicitlyDisabled.effectiveDisabled).to.be.true;
  expect(new FormData(form).get('always-disabled')).to.equal(null);
});

it('is accessible in the default (unchecked, unlabeled) state', async () => {
  const el = (await fixture(html`<lr-switch aria-label="Enable notifications"></lr-switch>`)) as LyraSwitch;
  await expect(el).to.be.accessible();
});

it('is accessible in a checked, labeled, required state', async () => {
  const el = (await fixture(
    html`<lr-switch checked required>Enable notifications</lr-switch>`,
  )) as LyraSwitch;
  await expect(el).to.be.accessible();
});

describe('hint/error chrome', () => {
  it('renders no hint/error chrome when hint/errorText are unset (today\'s exact bare output)', async () => {
    const el = (await fixture(html`<lr-switch>Enable notifications</lr-switch>`)) as LyraSwitch;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.true;
    expect(error.hidden).to.be.true;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.hasAttribute('aria-describedby')).to.be.false;
  });

  it('renders hint/errorText text and un-hides the matching parts', async () => {
    const el = (await fixture(
      html`<lr-switch hint="You can change this later" error-text="Required">Enable notifications</lr-switch>`,
    )) as LyraSwitch;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    expect(hint.hidden).to.be.false;
    expect(hint.textContent).to.contain('You can change this later');
    expect(error.hidden).to.be.false;
    expect(error.textContent).to.contain('Required');
  });

  it('wires aria-describedby on the inner switch to the rendered error/hint ids', async () => {
    const el = (await fixture(
      html`<lr-switch hint="Hint text" error-text="Err text">Enable notifications</lr-switch>`,
    )) as LyraSwitch;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-describedby')).to.equal('switch-error switch-hint');
  });

  it('supports slotted hint/error content in place of the text props, without disturbing the default-slot label', async () => {
    const el = (await fixture(html`
      <lr-switch>
        Enable notifications
        <span slot="hint">Slotted hint</span>
        <span slot="error">Slotted error</span>
      </lr-switch>
    `)) as LyraSwitch;
    const hint = el.shadowRoot!.querySelector('[part="hint"]') as HTMLElement;
    const error = el.shadowRoot!.querySelector('[part="error"]') as HTMLElement;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    expect(hint.hidden).to.be.false;
    expect(error.hidden).to.be.false;
    expect(label.hidden).to.be.false;
  });

  it('does not treat a slotted hint/error-only switch (no default-slot text) as having a label', async () => {
    const el = (await fixture(html`
      <lr-switch>
        <span slot="hint">Slotted hint</span>
      </lr-switch>
    `)) as LyraSwitch;
    const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
    expect(label.hidden).to.be.true;
  });
});
