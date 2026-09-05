import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './condition-builder.js';
import type { LyraConditionBuilder, ConditionBuilderValue } from './condition-builder.js';
import type { LyraSelect } from '../../forms/select/select.class.js';

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
