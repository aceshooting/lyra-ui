import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { render } from 'lit';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './select.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
import type { LyraOption } from '../combobox/option.js';

async function control(): Promise<LyraSelect> {
  return fixture<LyraSelect>(html`<lr-select label="Fruit" with-clear name="fruit" required>
    <lr-option value="a" selected>Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </lr-select>`);
}

async function rows(el: LyraSelect): Promise<HTMLElement[]> {
  await el.show();
  await el.updateComplete;
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]')];
}

function notifications(el: LyraSelect): string[] {
  const events: string[] = [];
  for (const type of ['input', 'lr-input', 'change', 'lr-change', 'lr-activate', 'lr-clear']) {
    el.addEventListener(type, () => events.push(type));
  }
  return events;
}

it('requests before pointer selection and preserves selection, validity, and popup on veto', async () => {
  const el = await control();
  const options = [...el.querySelectorAll<LyraOption>('lr-option')];
  const payload = { id: 'banana' };
  options[1]!.data = payload;
  const rendered = await rows(el);
  const after = notifications(el);
  let requests = 0;
  el.addEventListener('lr-change-request', (event) => {
    requests++;
    expect(event.cancelable && event.bubbles && event.composed).to.equal(true);
    expect(el.value).to.equal('a');
    expect(el.selectedOptions[0] === options[0]).to.equal(true);
    expect(event.detail.value).to.equal('b');
    expect(event.detail.previousValue).to.equal('a');
    expect(event.detail.data[0] === payload).to.equal(true);
    expect(Object.isFrozen(event.detail)).to.equal(true);
    expect(Object.isFrozen(event.detail.data)).to.equal(true);
    event.preventDefault();
  });
  rendered[1]!.click();
  await el.updateComplete;
  expect(requests).to.equal(1);
  expect(el.value).to.equal('a');
  expect(options.map((option) => option.selected)).to.deep.equal([true, false, false]);
  expect(el.validity.valueMissing).to.equal(false);
  expect(el.defaultValue).to.equal('a');
  expect(el.open).to.equal(true);
  expect(after).to.deep.equal([]);
});

it('vetoes Enter and closed-list type-ahead through the same proposal', async () => {
  for (const mode of ['enter', 'typeahead']) {
    const el = await control();
    const trigger = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!;
    await focusByKeyboard(trigger);
    if (mode === 'enter') {
      await sendKeys({ press: 'ArrowDown' });
      await el.updateComplete;
      await sendKeys({ press: 'ArrowDown' });
    }
    let requests = 0;
    const after = notifications(el);
    el.addEventListener('lr-change-request', (event) => { requests++; event.preventDefault(); });
    await sendKeys({ press: mode === 'enter' ? 'Enter' : 'b' });
    await el.updateComplete;
    expect(requests, mode).to.equal(1);
    expect(el.value, mode).to.equal('a');
    expect(after, mode).to.deep.equal([]);
  }
});

it('keeps duplicate-valued proposal data aligned with exact option occurrences and unmatched values', async () => {
  const left = { id: 'left' };
  const right = { id: 'right' };
  const el = await fixture<LyraSelect>(html`<lr-select multiple label="Duplicates">
    <lr-option value="same" .data=${left}>Left</lr-option>
    <lr-option value="same" .data=${right}>Right</lr-option>
  </lr-select>`);
  el.value = ['missing', 'same'];
  const rendered = await rows(el);
  const requests: unknown[] = [];
  el.addEventListener('lr-change-request', (event) => {
    requests.push(event.detail.value);
    expect(event.detail.previousValue).to.deep.equal(['missing', 'same']);
    expect(event.detail.data.length).to.equal(3);
    expect(event.detail.data[0]).to.equal(undefined);
    expect(event.detail.data[1] === left).to.equal(true);
    expect(event.detail.data[2] === right).to.equal(true);
    expect(Object.isFrozen(event.detail.value)).to.equal(true);
  }, { once: true });
  rendered[1]!.click();
  expect(requests).to.deep.equal([['missing', 'same', 'same']]);
  expect(el.value).to.deep.equal(['missing', 'same', 'same']);
  expect(el.selectedOptions.map((option) => option.textContent!.trim())).to.deep.equal(['Left', 'Right']);
});

it('lets same-value writes, same-option writes, mode changes and nested gestures supersede a proposal', async () => {
  for (const action of ['value', 'selectedOptions', 'optionSelected', 'multiple', 'nested']) {
    const el = await control();
    const rendered = await rows(el);
    const after = notifications(el);
    let count = 0;
    el.addEventListener('lr-change-request', (event) => {
      count++;
      if (action === 'value') el.value = 'a';
      if (action === 'selectedOptions') el.selectedOptions = el.selectedOptions;
      if (action === 'optionSelected') el.selectedOptions[0]!.selected = true;
      if (action === 'multiple') el.multiple = true;
      if (action === 'nested') { rendered[2]!.click(); event.preventDefault(); }
    });
    rendered[1]!.click();
    expect(count, action).to.equal(1);
    expect(el.value, action).to.deep.equal(action === 'multiple' ? ['a'] : 'a');
    expect(after, action).to.deep.equal([]);
  }
});

it('does not commit an option removed or disabled during the request', async () => {
  for (const action of ['remove', 'disable', 'value', 'reslot', 'disconnect']) {
    const el = await control();
    const rendered = await rows(el);
    const option = el.querySelectorAll<LyraOption>('lr-option')[1]!;
    const after = notifications(el);
    el.addEventListener('lr-change-request', () => {
      if (action === 'remove') option.remove();
      if (action === 'disable') option.disabled = true;
      if (action === 'value') option.value = 'changed';
      if (action === 'reslot') option.slot = 'end';
      if (action === 'disconnect') el.remove();
    });
    rendered[1]!.click();
    expect(el.value, action).to.equal('a');
    expect(after, action).to.deep.equal([]);
  }
});

it('vetoes clear and chip removal without corrupting the reset baseline or submitted value', async () => {
  const form = await fixture<HTMLFormElement>(html`<form><lr-select multiple with-clear required name="fruit" label="Fruit">
    <lr-option value="a" selected>Apple</lr-option>
    <lr-option value="b" selected>Banana</lr-option>
  </lr-select></form>`);
  const el = form.querySelector<LyraSelect>('lr-select')!;
  await el.updateComplete;
  const after = notifications(el);
  const proposed: unknown[] = [];
  el.addEventListener('lr-change-request', (event) => { proposed.push(event.detail.value); event.preventDefault(); });
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="clear-button"]')!.click();
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part~="tag__remove-button"]')!.click();
  expect(proposed).to.deep.equal([[], ['b']]);
  expect(new FormData(form).getAll('fruit')).to.deep.equal(['a', 'b']);
  expect(el.validity.valueMissing).to.equal(false);
  el.value = ['b'];
  form.reset();
  expect(el.value).to.deep.equal(['a', 'b']);
  expect(proposed.length).to.equal(2);
  expect(after).to.deep.equal([]);
});

it('keeps accepted event snapshots stable under a native listener write and leaves re-picks request-free', async () => {
  const el = await control();
  const rendered = await rows(el);
  const order: string[] = [];
  const values: unknown[] = [];
  el.addEventListener('lr-change-request', () => order.push('request'));
  el.addEventListener('input', () => { order.push('input'); el.value = 'c'; });
  el.addEventListener('lr-input', (event) => { order.push('lr-input'); values.push(event.detail.value); });
  el.addEventListener('change', () => order.push('change'));
  el.addEventListener('lr-change', (event) => { order.push('lr-change'); values.push(event.detail.value); });
  el.addEventListener('lr-activate', () => order.push('activate'));
  rendered[1]!.click();
  expect(order).to.deep.equal(['request', 'input', 'lr-input', 'change', 'lr-change', 'activate']);
  expect(values).to.deep.equal(['b', 'b']);
  expect(el.value).to.equal('c');
  order.length = 0;
  (await rows(el))[2]!.click();
  expect(order).to.deep.equal(['activate']);
});

it('requests a same-valued occurrence change and preserves the original occurrence on veto', async () => {
  const firstData = { id: 'first' };
  const secondData = { id: 'second' };
  const el = await fixture<LyraSelect>(html`<lr-select label="Occurrence">
    <lr-option value="same" selected .data=${firstData}>First</lr-option>
    <lr-option value="same" .data=${secondData}>Second</lr-option>
  </lr-select>`);
  const first = el.selectedOptions[0];
  const rendered = await rows(el);
  let requests = 0;
  el.addEventListener('lr-change-request', (event) => {
    requests++;
    expect(event.detail.value).to.equal('same');
    expect(event.detail.previousValue).to.equal('same');
    expect(event.detail.data[0] === secondData).to.equal(true);
    event.preventDefault();
  });
  rendered[1]!.click();
  expect(requests).to.equal(1);
  expect(el.selectedOptions[0] === first).to.equal(true);
  expect(el.selectedData[0] === firstData).to.equal(true);
});

it('requests the auto-single gesture while programmatic selection and restoration stay silent', async () => {
  const el = await fixture<LyraSelect>(html`<lr-select label="Only choice" auto-commit-single-option>
    <lr-option value="one">One</lr-option>
  </lr-select>`);
  let requests = 0;
  const after = notifications(el);
  el.addEventListener('lr-change-request', (event) => { requests++; event.preventDefault(); });
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="trigger"]')!.click();
  expect(requests).to.equal(1);
  expect(el.value).to.equal('');
  expect(el.open).to.equal(false);
  el.value = 'one';
  el.formStateRestoreCallback('one', 'restore');
  el.formResetCallback();
  expect(requests).to.equal(1);
  expect(after).to.deep.equal([]);
});


it('accepts an unchanged NaN option payload and retains it in both event snapshots', async () => {
  const el = await control();
  el.querySelectorAll<LyraOption>('lr-option')[1]!.data = Number.NaN;
  const rendered = await rows(el);
  const observed: boolean[] = [];
  el.addEventListener('lr-change-request', (event) => observed.push(Number.isNaN(event.detail.data[0])));
  el.addEventListener('lr-change', (event) => observed.push(Number.isNaN(event.detail.data[0])));
  rendered[1]!.click();
  await el.updateComplete;
  expect(el.value).to.equal('b');
  expect(observed).to.deep.equal([true, true]);
});


it('accepts and vetoes proposals for options forwarded through a default slot', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div>
    <lr-option value="a" selected>Apple</lr-option>
    <lr-option value="b">Banana</lr-option>
    <lr-option value="c">Cherry</lr-option>
  </div>`);
  const shadow = wrapper.attachShadow({ mode: 'open' });
  render(html`<lr-select label="Fruit"><slot></slot></lr-select>`, shadow);
  const el = shadow.querySelector<LyraSelect>('lr-select')!;
  await el.updateComplete;
  const proposed: unknown[] = [];
  el.addEventListener('lr-change-request', (event) => {
    proposed.push(event.detail.value);
    if (event.detail.value === 'c') event.preventDefault();
  });
  (await rows(el))[1]!.click();
  expect(el.value).to.equal('b');
  expect(el.selectedOptions[0] === wrapper.children[1]).to.equal(true);
  (await rows(el))[2]!.click();
  expect(el.value).to.equal('b');
  expect(el.selectedOptions[0] === wrapper.children[1]).to.equal(true);
  expect(proposed).to.deep.equal(['b', 'c']);
  expect(el.open).to.equal(true);
});

it('abandons a proposal when a listener adopts the select into another document', async () => {
  const root = await fixture<HTMLDivElement>(html`<div>
    <lr-select label="Fruit"><lr-option value="a" selected>Apple</lr-option>
      <lr-option value="b">Banana</lr-option></lr-select>
    <iframe title="Adoption target"></iframe>
  </div>`);
  const el = root.querySelector<LyraSelect>('lr-select')!;
  const frame = root.querySelector('iframe')!;
  await waitUntil(() => Boolean(frame.contentDocument?.body), 'the adoption document is ready');
  const target = frame.contentDocument!;
  const rendered = await rows(el);
  const after = notifications(el);
  el.addEventListener('lr-change-request', () => target.body.append(target.adoptNode(el)));
  rendered[1]!.click();
  expect(el.ownerDocument === target).to.equal(true);
  expect(el.value).to.equal('a');
  expect(after).to.deep.equal([]);
});
