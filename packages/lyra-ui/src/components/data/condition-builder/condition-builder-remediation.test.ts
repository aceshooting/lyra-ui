import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './condition-builder.js';
import type { LyraConditionBuilder, ConditionBuilderValue } from './condition-builder.js';
import type { LyraSelect } from '../../forms/select/select.class.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

const CHILD_EVENTS = ['input', 'change', 'lr-input', 'lr-change', 'lr-activate', 'lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide', 'lr-clear', 'lr-filter', 'lr-invalid'];

async function everyKindBuilder(): Promise<{ el: LyraConditionBuilder; leaked: string[] }> {
  const el = await fixture<LyraConditionBuilder>(html`<lr-condition-builder
    style="--lr-transition-fast:0ms"
    .fields=${[
      { name: 'name', type: 'string' }, { name: 'age', type: 'number' }, { name: 'active', type: 'boolean' },
      { name: 'on', type: 'date' }, { name: 'status', type: 'enum', options: [{ value: 'open' }, { value: 'closed' }] },
    ]}
    .value=${{ combinator: 'and', conditions: [
      { id: 'string', field: 'name', operator: 'eq', value: '' }, { id: 'number', field: 'age', operator: 'eq' },
      { id: 'date', field: 'on', operator: 'eq', value: '' }, { id: 'multi', field: 'status', operator: 'in', value: [] },
      { id: 'boolean', field: 'active', operator: 'eq', value: true }, { id: 'enum', field: 'status', operator: 'eq', value: 'open' },
    ] }}
  ></lr-condition-builder>`);
  const leaked: string[] = [];
  for (const type of CHILD_EVENTS) {
    el.addEventListener(type, (event) => { if (event.composedPath()[0] !== el) leaked.push(type); });
  }
  return { el, leaked };
}

const valueControl = (el: LyraConditionBuilder, id: string) =>
  el.shadowRoot!.querySelector<HTMLElement>(`[data-id="${id}"] [part="value"]`)!;

for (const [id, typed, expected] of [['string', '1', '1'], ['number', '1', 1], ['date', '1', ''], ['multi', 'c', undefined]] as const) {
  it(`contains every child event while typing in the ${id} value control`, async () => {
    const { el, leaked } = await everyKindBuilder();
    await focusByKeyboard(valueControl(el, id).shadowRoot!.querySelector('input')!);
    await sendKeys({ type: typed });
    await sendKeys({ press: id === 'multi' ? 'ArrowDown' : 'Tab' });
    if (id === 'multi') await sendKeys({ press: 'Enter' });
    await el.updateComplete;
    expect(leaked).to.deep.equal([]);
    if (expected !== undefined) expect(el.value.conditions.find((c) => c.id === id)!.value).to.equal(expected);
  });
}

for (const [id, expected] of [['combinator', 'or'], ['boolean', false], ['enum', 'closed']] as const) {
  it(`contains every child event for a real ${id} select choice`, async () => {
    const { el, leaked } = await everyKindBuilder();
    const select = (id === 'combinator'
      ? el.shadowRoot!.querySelector('[part="combinator"]')
      : valueControl(el, id)) as LyraSelect;
    const trigger = select.shadowRoot!.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    const shown = oneEvent(select, 'lr-after-show');
    await focusByKeyboard(trigger);
    trigger.click();
    await shown;
    await sendKeys({ press: 'End' });
    const hidden = oneEvent(select, 'lr-after-hide');
    await sendKeys({ press: 'Enter' });
    await hidden;
    await el.updateComplete;
    expect(leaked).to.deep.equal([]);
    expect(id === 'combinator' ? el.value.combinator : el.value.conditions.find((c) => c.id === id)!.value).to.equal(expected);
  });
}

for (const part of ['field-select', 'operator-select']) {
  it(`contains every child select alias for one real ${part} choice`, async () => {
    const initial: ConditionBuilderValue = {
      combinator: 'and', conditions: [{ id: 'c1', field: 'name', operator: 'eq', value: 'Ada' }],
    };
    const el = await fixture<LyraConditionBuilder>(html`<lr-condition-builder
      style="--lr-transition-fast:0ms"
      .fields=${[{ name: 'name', type: 'string' }, { name: 'age', type: 'number' }]}
      .value=${initial}
    ></lr-condition-builder>`);
    const events: Array<{ type: string; hostOwned: boolean; detail: unknown }> = [];
    for (const type of ['input', 'change', 'lr-input', 'lr-change', 'lr-show', 'lr-after-show', 'lr-hide', 'lr-after-hide']) {
      el.addEventListener(type, (event) => events.push({
        type, hostOwned: event.composedPath()[0] === el, detail: (event as CustomEvent).detail,
      }));
    }
    const select = el.shadowRoot!.querySelector<LyraSelect>(`[part="${part}"]`)!;
    const trigger = select.shadowRoot!.querySelector<HTMLButtonElement>('[role="combobox"]')!;
    const shown = oneEvent(select, 'lr-after-show');
    trigger.focus();
    trigger.click();
    await shown;
    await sendKeys({ press: 'End' });
    const hidden = oneEvent(select, 'lr-after-hide');
    await sendKeys({ press: 'Enter' });
    await hidden;
    await el.updateComplete;

    expect(events.map((event) => event.type)).to.deep.equal(['lr-input']);
    expect(events[0]!.hostOwned).to.equal(true);
    expect(events[0]!.detail).to.deep.equal({ value: el.value });
    expect(Object.isFrozen(events[0]!.detail)).to.equal(true);
    expect(el.value.conditions[0]![part === 'field-select' ? 'field' : 'operator']).to.equal(
      part === 'field-select' ? 'age' : 'isNotEmpty',
    );
    el.value = initial;
    await el.updateComplete;
    expect(events.length, 'programmatic assignments stay silent').to.equal(1);
  });
}

it('treats re-assigning the same fields or value object as no change', async () => {
  const fields = [{ name: 'name', type: 'string' as const }];
  const value: ConditionBuilderValue = { combinator: 'and', conditions: [{ id: 'c1', field: 'name', operator: 'eq', value: 'Ada' }] };
  const el = await fixture<LyraConditionBuilder>(html`<lr-condition-builder .fields=${fields} .value=${value}></lr-condition-builder>`);
  el.fields = fields;
  el.value = value;
  el.value = el.value;
  expect(el.isUpdatePending).to.equal(false);
});

it('keeps the focused control on its own condition when the host drops an earlier row', async () => {
  const fields = [{ name: 'name', type: 'string' as const }];
  const el = await fixture<LyraConditionBuilder>(html`<lr-condition-builder .fields=${fields} .value=${{ combinator: 'and', conditions: [
    { id: 'a', field: 'name', operator: 'eq', value: '' }, { id: 'b', field: 'name', operator: 'eq', value: 'keep' },
  ] }}></lr-condition-builder>`);
  const control = el.shadowRoot!.querySelector<HTMLElement>('[data-id="b"] [part="value"]')!;
  await focusByKeyboard(control.shadowRoot!.querySelector('input')!);
  el.value = { combinator: 'and', conditions: [el.value.conditions[1]!] };
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === control && control.isConnected).to.equal(true);
});
