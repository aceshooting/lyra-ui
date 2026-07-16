import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './radio.js';
import './radio-group.js';
import type { LyraRadio } from './radio.js';
import type { LyraRadioGroup } from './radio-group.js';

it('renders radio semantics and explicit false states', async () => {
  const el = (await fixture(html`<lyra-radio>One</lyra-radio>`)) as LyraRadio;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.getAttribute('role')).to.equal('radio');
  expect(base.getAttribute('aria-checked')).to.equal('false');
  expect(base.getAttribute('aria-disabled')).to.equal('false');
  expect(base.getAttribute('aria-required')).to.equal('false');
  await expect(el).to.be.accessible();
});

it('selects and emits native-style events', async () => {
  const el = (await fixture(html`<lyra-radio value="a">A</lyra-radio>`)) as LyraRadio;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const events: string[] = [];
  for (const name of ['input', 'change', 'lyra-change']) el.addEventListener(name, () => events.push(name));
  base.click();
  expect(el.checked).to.be.true;
  expect(events).to.deep.equal(['input', 'change', 'lyra-change']);
});

it('moves selection and DOM focus when arrow navigation is used', async () => {
  const group = (await fixture(html`
    <lyra-radio-group label="Choice">
      <lyra-radio value="a">A</lyra-radio>
      <lyra-radio value="b">B</lyra-radio>
    </lyra-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll('lyra-radio')] as LyraRadio[];
  const firstBase = radios[0].shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const secondBase = radios[1].shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  radios[0].checked = true;
  firstBase.focus();
  const eventPromise = oneEvent(group, 'lyra-change');
  firstBase.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
  const event = await eventPromise;
  expect(event.detail.value).to.equal('b');
  expect(radios[1].checked).to.be.true;
  expect(radios[1].shadowRoot!.activeElement === secondBase).to.be.true;
  await expect(group).to.be.accessible();
});

it('uses roving tabindex: only the checked (or first enabled) radio is a Tab stop', async () => {
  const group = (await fixture(html`
    <lyra-radio-group label="Choice">
      <lyra-radio value="a">A</lyra-radio>
      <lyra-radio value="b">B</lyra-radio>
    </lyra-radio-group>
  `)) as LyraRadioGroup;
  await group.updateComplete;
  const radios = [...group.querySelectorAll('lyra-radio')] as LyraRadio[];
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
    <lyra-radio-group label="Choice">
      <lyra-radio value="a">A</lyra-radio>
    </lyra-radio-group>
  `)) as LyraRadioGroup;
  const base = group.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  const labelId = base.getAttribute('aria-labelledby');
  expect(labelId).to.be.ok;
  expect(group.shadowRoot!.getElementById(labelId!)?.textContent).to.contain('Choice');
});

it('restores the declarative default-checked state on form reset', async () => {
  const form = (await fixture(html`
    <form>
      <lyra-radio name="choice" value="a" checked>A</lyra-radio>
      <lyra-radio name="choice" value="b">B</lyra-radio>
    </form>
  `)) as HTMLFormElement;
  const [a, b] = [...form.querySelectorAll('lyra-radio')] as LyraRadio[];
  expect(a.checked).to.be.true;

  b.checked = true;
  a.checked = false;
  expect(a.checked).to.be.false;
  expect(b.checked).to.be.true;

  form.reset();
  expect(a.checked, 'a restores its declarative checked default').to.be.true;
  expect(b.checked, 'b restores its (unchecked) declarative default').to.be.false;
});

it('wires hint/error text to aria-describedby on the radiogroup', async () => {
  const group = (await fixture(html`
    <lyra-radio-group label="Choice">
      <lyra-radio value="a">A</lyra-radio>
    </lyra-radio-group>
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
    <lyra-radio-group label="Choice" required>
      <lyra-radio value="a">A</lyra-radio>
    </lyra-radio-group>
  `)) as LyraRadioGroup;
  const label = group.shadowRoot!.querySelector('[part="label"]') as HTMLElement;
  const after = getComputedStyle(label, '::after');
  expect(after.content).to.contain('*');
});

it('clears group-imposed disabled/required on every radio when turned back off', async () => {
  const group = (await fixture(html`
    <lyra-radio-group label="Choice" disabled required>
      <lyra-radio value="a">A</lyra-radio>
      <lyra-radio value="b">B</lyra-radio>
    </lyra-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll('lyra-radio')] as LyraRadio[];
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
