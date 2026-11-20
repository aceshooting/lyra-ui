import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-condition-builder.js';
import type { LyraConditionBuilder } from '../../lr-condition-builder.js';

const fields = [{ name: 'name', type: 'string' as const }, { name: 'age', type: 'number' as const }];

async function builder(conditions: unknown[]): Promise<LyraConditionBuilder> {
  const el = await fixture<LyraConditionBuilder>(html`<lr-condition-builder
    .fields=${fields}
    .value=${{ combinator: 'and', conditions }}
  ></lr-condition-builder>`);
  await el.updateComplete;
  return el;
}

const live = () => document.querySelector('[data-lr-live-region="polite"]')?.textContent ?? '';

describe('lr-condition-builder row identity and feedback', () => {
  it('gives each row control a name that carries its row number', async () => {
    const el = await builder([
      { id: 'a', field: 'name', operator: 'eq', value: 'x' },
      { id: 'b', field: 'age', operator: 'eq', value: 1 },
    ]);
    const names = [...el.shadowRoot!.querySelectorAll('[part="condition"]')].map((row) =>
      [...row.querySelectorAll('[part="field-select"], [part="operator-select"], [part="value"]')]
        .map((control) => control.getAttribute('aria-label')),
    );
    expect(names).to.deep.equal([
      ['Field, condition 1', 'Operator, condition 1', 'Value, condition 1'],
      ['Field, condition 2', 'Operator, condition 2', 'Value, condition 2'],
    ]);
  });

  it('announces added and removed conditions', async () => {
    const el = await builder([{ id: 'a', field: 'name', operator: 'eq', value: 'x' }]);
    el.addCondition();
    await waitUntil(() => live().includes('Condition 2 added'), 'add was never announced');
    el.removeCondition('a');
    await waitUntil(() => live().includes('Condition removed. 1 remaining'), 'removal was never announced');
  });

  it('shows the validation issue on the control that owns it', async () => {
    const el = await builder([
      { id: 'a', field: 'missing', operator: 'eq', value: 'x' },
      { id: 'b', field: 'name', operator: 'gt', value: 'x' },
    ]);
    const rows = [...el.shadowRoot!.querySelectorAll('[part="condition"]')];
    expect(rows[0]!.querySelector('[part="field-select"]')!.getAttribute('error-text')).to.equal('Condition 1 is incomplete');
    expect(rows[1]!.querySelector('[part="operator-select"]')!.getAttribute('error-text')).to.equal('Condition 2 is incomplete');
    expect(rows[1]!.querySelector('[part="field-select"]')!.hasAttribute('error-text')).to.equal(false);
  });
});

it('wraps row controls instead of squeezing them below a readable width', async () => {
  const el = await fixture<LyraConditionBuilder>(html`<lr-condition-builder
    style="inline-size: 22rem"
    .fields=${fields}
    .value=${{ combinator: 'and', conditions: [{ id: 'a', field: 'name', operator: 'eq', value: 'x' }] }}
  ></lr-condition-builder>`);
  await el.updateComplete;
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  for (const part of ['field-select', 'operator-select', 'value']) {
    const width = el.shadowRoot!.querySelector(`[part="${part}"]`)!.getBoundingClientRect().width;
    expect(width >= 7.5 * root, part).to.equal(true);
  }
});
