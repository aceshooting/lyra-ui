import { expect, fixture, html } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../test/wtr-focus.js';
import '../components/agent-tools/tool-param-form/tool-param-form.js';
import '../components/agent-tools/eval-dataset/eval-dataset.js';
import '../components/utility/known-date/known-date.js';
import type { LyraToolParamForm } from '../components/agent-tools/tool-param-form/tool-param-form.class.js';
import type { LyraEvalDataset } from '../components/agent-tools/eval-dataset/eval-dataset.class.js';
import type { LyraKnownDate } from '../components/utility/known-date/known-date.class.js';

it('relays one native focus and blur with relatedTarget from a generated text field', async () => {
  const form = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${{
    type: 'object', properties: { name: { type: 'string' } },
  }}></lr-tool-param-form>`);
  const input = form.shadowRoot!.querySelector<HTMLInputElement>('input')!;
  const events: FocusEvent[] = [];
  form.addEventListener('focus', (event) => events.push(event));
  form.addEventListener('blur', (event) => events.push(event));
  await focusByKeyboard(input);
  expect(events.length).to.equal(1);
  expect(events[0] instanceof FocusEvent).to.equal(true);
  expect(events[0]!.relatedTarget instanceof HTMLButtonElement).to.equal(true);
  const leaving = form.ownerDocument.createElement('button');
  leaving.textContent = 'Outside';
  form.after(leaving);
  try {
    await focusByKeyboard(leaving);
    expect(events.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
    expect(events.every((event) => event instanceof FocusEvent && event.bubbles && event.composed && event.target === form)).to.equal(true);
    expect(events[1]!.relatedTarget instanceof HTMLButtonElement).to.equal(true);
  } finally {
    leaving.remove();
  }
});

it('relays the dataset search focus using native fields', async () => {
  const dataset = await fixture<LyraEvalDataset>(html`<lr-eval-dataset searchable></lr-eval-dataset>`);
  const input = dataset.shadowRoot!.querySelector<HTMLInputElement>('[part="search-input"]')!;
  const events: FocusEvent[] = [];
  dataset.addEventListener('focus', (event) => events.push(event));
  await focusByKeyboard(input);
  expect(events.length).to.equal(1);
  expect(events[0] instanceof FocusEvent).to.equal(true);
  expect(events[0]!.relatedTarget instanceof HTMLButtonElement).to.equal(true);
});

it('retains known-date internal-field blur suppression while relaying native focus', async () => {
  const date = await fixture<LyraKnownDate>(html`<lr-known-date label="Date"></lr-known-date>`);
  const fields = [...date.shadowRoot!.querySelectorAll<HTMLInputElement>('[part="field-input"]')];
  const events: FocusEvent[] = [];
  date.addEventListener('focus', (event) => events.push(event));
  let blurs = 0;
  date.addEventListener('blur', () => blurs++);
  await focusByKeyboard(fields[0]!);
  expect(events.length).to.equal(1);
  expect(events[0] instanceof FocusEvent).to.equal(true);
  expect(events[0]!.relatedTarget instanceof HTMLButtonElement).to.equal(true);
  await sendKeys({ press: 'Tab' });
  expect(date.shadowRoot!.activeElement === fields[1]).to.equal(true);
  expect(events.length).to.equal(2);
  expect(events[1] instanceof FocusEvent).to.equal(true);
  expect(events[1]!.relatedTarget).to.equal(null);
  expect(events[1]!.target === date).to.equal(true);
  expect(blurs).to.equal(0);
  const leaving = document.createElement('button');
  leaving.textContent = 'Outside';
  date.after(leaving);
  try {
    await focusByKeyboard(leaving);
    expect(blurs).to.equal(1);
  } finally {
    leaving.remove();
  }
});
