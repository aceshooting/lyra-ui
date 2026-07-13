import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './switch.js';
import type { LyraSwitch } from './switch.js';
import { styles } from './switch.styles.js';

it('exposes namespaced geometry custom properties', () => {
  expect(styles.cssText).to.include('--lyra-switch-track-inline-size');
  expect(styles.cssText).to.include('--lyra-switch-track-block-size');
  expect(styles.cssText).to.include('--lyra-switch-thumb-offset');
  expect(styles.cssText).to.not.include('--track-inline-size');
  expect(styles.cssText).to.not.include('--track-block-size');
  expect(styles.cssText).to.not.include('--thumb-offset');
});

it('defaults to unchecked with role="switch" and aria-checked="false"', async () => {
  const el = (await fixture(html`<lyra-switch>Label</lyra-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(el.checked).to.be.false;
  expect(base.getAttribute('role')).to.equal('switch');
  expect(base.getAttribute('aria-checked')).to.equal('false');
});

it('reflects checked to the attribute and to aria-checked', async () => {
  const el = (await fixture(html`<lyra-switch>Label</lyra-switch>`)) as LyraSwitch;
  el.checked = true;
  await el.updateComplete;
  expect(el.hasAttribute('checked')).to.be.true;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-checked')).to.equal('true');
});

it('toggles and emits lyra-change with detail.checked on click', async () => {
  const el = (await fixture(html`<lyra-switch>Label</lyra-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  setTimeout(() => base.click());
  let ev = await oneEvent(el, 'lyra-change');
  expect(ev.detail.checked).to.be.true;
  expect(el.checked).to.be.true;

  setTimeout(() => base.click());
  ev = await oneEvent(el, 'lyra-change');
  expect(ev.detail.checked).to.be.false;
  expect(el.checked).to.be.false;
});

it('toggles on Space and Enter keydown', async () => {
  const el = (await fixture(html`<lyra-switch>Label</lyra-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

  setTimeout(() =>
    base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })),
  );
  let ev = await oneEvent(el, 'lyra-change');
  expect(ev.detail.checked).to.be.true;

  setTimeout(() =>
    base.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })),
  );
  ev = await oneEvent(el, 'lyra-change');
  expect(ev.detail.checked).to.be.false;
});

it('preventDefault()s the Space keydown so the page does not scroll', async () => {
  const el = (await fixture(html`<lyra-switch>Label</lyra-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const ev = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  base.dispatchEvent(ev);
  expect(ev.defaultPrevented).to.be.true;
});

it('ignores click and keydown activation while disabled, and is not focusable', async () => {
  const el = (await fixture(html`<lyra-switch disabled>Label</lyra-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('tabindex')).to.equal('-1');
  expect(base.getAttribute('aria-disabled')).to.equal('true');

  let fired = false;
  el.addEventListener('lyra-change', () => (fired = true));
  base.click();
  base.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
  expect(fired).to.be.false;
  expect(el.checked).to.be.false;
});

it('is focusable (tabindex 0) when enabled', async () => {
  const el = (await fixture(html`<lyra-switch>Label</lyra-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('tabindex')).to.equal('0');
});

it('has no aria-required/aria-disabled attributes in the default state', async () => {
  const el = (await fixture(html`<lyra-switch>Label</lyra-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.hasAttribute('aria-required')).to.be.false;
  expect(base.hasAttribute('aria-disabled')).to.be.false;
});

it('sets aria-required when required', async () => {
  const el = (await fixture(html`<lyra-switch required>Label</lyra-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-required')).to.equal('true');
});

it('hides the label part when the default slot has no real content', async () => {
  const el = (await fixture(html`<lyra-switch></lyra-switch>`)) as LyraSwitch;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.true;
});

it('shows the label part for plain slotted text (a text node, not an element)', async () => {
  const el = (await fixture(html`<lyra-switch>Enable notifications</lyra-switch>`)) as LyraSwitch;
  const label = el.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  expect(label.hidden).to.be.false;
});

it('forwards a host aria-label onto the inner role="switch" element', async () => {
  const el = (await fixture(
    html`<lyra-switch aria-label="Enable notifications"></lyra-switch>`,
  )) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('aria-label')).to.equal('Enable notifications');
});

it('does not set an empty aria-label on the inner element when the host has none', async () => {
  const el = (await fixture(html`<lyra-switch>Label</lyra-switch>`)) as LyraSwitch;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.hasAttribute('aria-label')).to.be.false;
});

it('participates in a form: submits value under name only when checked', async () => {
  const form = (await fixture(html`
    <form><lyra-switch name="notify" value="yes">Notify me</lyra-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-switch') as LyraSwitch;

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
    <form><lyra-switch name="notify" value="yes" required>Notify me</lyra-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-switch') as LyraSwitch;

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
    <form><lyra-switch name="notify" value="yes" checked>Notify me</lyra-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-switch') as LyraSwitch;

  el.value = 'updated';
  expect(new FormData(form).get('notify')).to.equal('updated');
});

it('updates validity synchronously when required changes', async () => {
  const el = (await fixture(html`
    <lyra-switch name="terms">Agree</lyra-switch>
  `)) as LyraSwitch;

  expect(el.checkValidity()).to.be.true;
  el.required = true;
  expect(el.checkValidity()).to.be.false;
  el.required = false;
  expect(el.checkValidity()).to.be.true;
});

describe('validationMessage localization', () => {
  it('defaults to the built-in English validationMessage for a required, unchecked control', async () => {
    const el = (await fixture(html`<lyra-switch required>Agree</lyra-switch>`)) as LyraSwitch;
    expect(el.validationMessage).to.equal('Please turn this on.');
  });

  it('localizes the validationMessage via this.localize() when .strings overrides switchRequired', async () => {
    const el = (await fixture(html`
      <lyra-switch required .strings=${{ switchRequired: 'Veuillez activer ceci.' }}>Agree</lyra-switch>
    `)) as LyraSwitch;
    expect(el.validationMessage).to.equal('Veuillez activer ceci.');

    el.checked = true;
    expect(el.validationMessage).to.equal('');
  });
});

it('submits under a programmatically assigned name in the same tick', async () => {
  const form = (await fixture(html`
    <form><lyra-switch value="yes" checked>Notify me</lyra-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-switch') as LyraSwitch;

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
    <form><lyra-switch name="notify" checked>Notify me</lyra-switch></form>
  `)) as HTMLFormElement;
  expect(new FormData(form).get('notify')).to.equal('on');
});

it('blocks a required, unchecked switch from submitting the form', async () => {
  const form = (await fixture(html`
    <form><lyra-switch name="terms" required>Agree</lyra-switch></form>
  `)) as HTMLFormElement;
  expect(form.reportValidity()).to.be.false;

  const el = form.querySelector('lyra-switch') as LyraSwitch;
  el.checked = true;
  await el.updateComplete;
  expect(form.reportValidity()).to.be.true;
});

it('focuses the inner switch after direct and submit-driven validity reporting', async () => {
  const form = (await fixture(html`
    <form>
      <button type="button">Before switch</button>
      <lyra-switch name="terms" required>Agree</lyra-switch>
    </form>
  `)) as HTMLFormElement;
  const sentinel = form.querySelector('button') as HTMLButtonElement;
  const el = form.querySelector('lyra-switch') as LyraSwitch;
  let submitCount = 0;
  form.addEventListener('submit', (event) => {
    submitCount += 1;
    event.preventDefault();
  });

  sentinel.focus();
  expect(el.reportValidity()).to.be.false;
  expect(document.activeElement?.localName).to.equal('lyra-switch');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');

  sentinel.focus();
  form.requestSubmit();
  expect(submitCount).to.equal(0);
  expect(document.activeElement?.localName).to.equal('lyra-switch');
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('base');
});

it('applies and removes explicit disabled form state synchronously', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-switch id="submitted" name="notify" value="yes" checked>Notify me</lyra-switch>
      <lyra-switch id="invalid" name="terms" required>Agree</lyra-switch>
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
    <form><lyra-switch name="notify" value="yes" checked required>Notify me</lyra-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-switch') as LyraSwitch;
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
    <form><lyra-switch name="notify">Notify me</lyra-switch></form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-switch') as LyraSwitch;
  el.checked = true;
  await el.updateComplete;
  expect(new FormData(form).get('notify')).to.equal('on');

  form.reset();
  expect(el.checked).to.be.false;
  expect(new FormData(form).get('notify')).to.equal(null);
});

it('does not turn a pre-connect checked property assignment into the reset default', async () => {
  const form = document.createElement('form');
  const el = document.createElement('lyra-switch') as LyraSwitch;
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
        <lyra-switch name="notify" value="yes" checked>Notify me</lyra-switch>
        <lyra-switch name="always-disabled" value="yes" checked disabled>Always disabled</lyra-switch>
      </fieldset>
    </form>
  `)) as HTMLFormElement;
  const el = form.querySelector('lyra-switch') as LyraSwitch;
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
  expect(base.hasAttribute('aria-disabled')).to.be.false;
  expect(new FormData(form).get('notify')).to.equal('yes');

  expect(explicitlyDisabled.disabled, 'an explicit disabled state survives the fieldset cycle').to.be.true;
  expect(explicitlyDisabled.effectiveDisabled).to.be.true;
  expect(new FormData(form).get('always-disabled')).to.equal(null);
});

it('is accessible in the default (unchecked, unlabeled) state', async () => {
  const el = (await fixture(html`<lyra-switch aria-label="Enable notifications"></lyra-switch>`)) as LyraSwitch;
  await expect(el).to.be.accessible();
});

it('is accessible in a checked, labeled, required state', async () => {
  const el = (await fixture(
    html`<lyra-switch checked required>Enable notifications</lyra-switch>`,
  )) as LyraSwitch;
  await expect(el).to.be.accessible();
});
