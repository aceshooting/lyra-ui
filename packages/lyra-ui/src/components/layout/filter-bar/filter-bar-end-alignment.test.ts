import { expect, fixture, html } from '@open-wc/testing';
import './filter-bar.js';
import '../../forms/button/button.js';
import type { LyraFilterBar, LyraFilterBarFilterDefinition } from './filter-bar.class.js';

const filters: LyraFilterBarFilterDefinition[] = [
  { filterId: 'q', label: 'Query', type: 'text' },
];

const bottom = (node: Element): number => Math.round(node.getBoundingClientRect().bottom);

describe('filter-bar end actions', () => {
  it('aligns a slotted end button with Reset and the field frame', async () => {
    const el = await fixture<LyraFilterBar>(html`<lr-filter-bar .filters=${filters}>
      <lr-button slot="end" id="save">Save</lr-button>
    </lr-filter-bar>`);
    await el.updateComplete;
    const root = el.shadowRoot!;
    const save = el.querySelector('#save') as HTMLElement;
    const reset = root.querySelector('[part="reset-button"]') as HTMLElement;
    const field = root.querySelector('[part~="field"]') as HTMLElement;
    const spacer = field.querySelector('.validation-spacer') as HTMLElement;
    expect(bottom(save)).to.equal(bottom(reset));
    expect(bottom(save)).to.equal(Math.round(spacer.getBoundingClientRect().top));
  });

  it('wraps Reset and the end actions together at a narrow width', async () => {
    const el = await fixture<LyraFilterBar>(html`<div style="inline-size:16rem">
      <lr-filter-bar .filters=${filters}>
        <lr-button slot="end" id="save">Save search</lr-button>
      </lr-filter-bar>
    </div>`);
    const bar = el.querySelector('lr-filter-bar') as LyraFilterBar;
    await bar.updateComplete;
    const field = bar.shadowRoot!.querySelector('[part~="field"]') as HTMLElement;
    const reset = bar.shadowRoot!.querySelector('[part="reset-button"]') as HTMLElement;
    const save = bar.querySelector('#save') as HTMLElement;
    expect(reset.getBoundingClientRect().top, 'actions wrap below the field').to.be.greaterThan(
      field.getBoundingClientRect().bottom - 1
    );
    expect(bottom(save)).to.equal(bottom(reset));
  });
});
