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

it('moves selection and emits a group change when arrow navigation is used', async () => {
  const group = (await fixture(html`
    <lyra-radio-group label="Choice">
      <lyra-radio value="a">A</lyra-radio>
      <lyra-radio value="b">B</lyra-radio>
    </lyra-radio-group>
  `)) as LyraRadioGroup;
  const radios = [...group.querySelectorAll('lyra-radio')] as LyraRadio[];
  const firstBase = radios[0].shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  radios[0].checked = true;
  const eventPromise = oneEvent(group, 'lyra-change');
  firstBase.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
  const event = await eventPromise;
  expect(event.detail.value).to.equal('b');
  expect(radios[1].checked).to.be.true;
  await expect(group).to.be.accessible();
});
