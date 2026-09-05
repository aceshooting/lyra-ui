import { expect, fixture, html } from '@open-wc/testing';
import './filter-bar.js';
import type { LyraFilterBar, LyraFilterBarCustomControlContext, LyraFilterBarFilterDefinition } from './filter-bar.class.js';

for (const type of ['select', 'combobox'] as const) {
  it(`keeps valid ${type} options and sibling filters around malformed entries`, async () => {
    const element = await fixture<LyraFilterBar>(html`<lr-filter-bar></lr-filter-bar>`);
    let getterReads = 0;
    const hostile = Object.defineProperty({}, 'value', { enumerable: true, get() { getterReads++; throw new Error('getter'); } });
    element.filters = [
      { filterId: 'choice', label: 'Choice', type, options: [null, undefined, 1, hostile, { value: 'a', label: 'Alpha' }, { value: '', label: 'Empty' }, { value: 'b', label: 'Beta' }] },
      { filterId: 'text', label: 'Text', type: 'text' },
    ] as unknown as LyraFilterBarFilterDefinition[];
    await element.updateComplete;
    expect(getterReads).to.equal(0);
    expect(element.shadowRoot!.querySelectorAll('[part="filter-control"]').length).to.equal(2);
    expect([...element.shadowRoot!.querySelectorAll('lr-option')].map(option => option.getAttribute('value'))).to.deep.equal(['a', '', 'b']);
    expect(Object.isFrozen(element.filters)).to.equal(true);
    element.value = { choice: 'a' };
    await element.updateComplete;
    expect(element.shadowRoot!.textContent).to.contain('Alpha');
  });
}

it('omits missing/noncallable custom renderers before reserving identities and retains callable context', async () => {
  const element = await fixture<LyraFilterBar>(html`<lr-filter-bar></lr-filter-bar>`);
  let context: LyraFilterBarCustomControlContext | undefined;
  const render = (value: LyraFilterBarCustomControlContext) => { context = value; return html`<span id="custom">Custom</span>`; };
  const adapter = { valueFromEvent: () => 'a', clearValue: '' };
  element.filters = [
    { filterId: 'custom', label: 'Bad', type: 'custom', custom: { adapter } },
    { filterId: 'other', label: 'Bad', type: 'custom', custom: { adapter, render: 1 } },
    { filterId: 'custom', label: 'Good', type: 'custom', custom: { adapter, render } },
    { filterId: 'sibling', label: 'Sibling', type: 'text' },
  ] as unknown as LyraFilterBarFilterDefinition[];
  await element.updateComplete;
  expect(element.filters.map(definition => definition.filterId)).to.deep.equal(['custom', 'sibling']);
  expect(element.shadowRoot!.querySelector('#custom')?.textContent).to.equal('Custom');
  expect(context?.definition === element.filters[0]).to.equal(true);
  expect(context?.signal.aborted).to.equal(false);
  expect((element.filters[0] as { custom: { render: unknown } }).custom.render === render).to.equal(true);
});

it('does not swallow an admitted trusted renderer exception', () => {
  const element = document.createElement('lr-filter-bar');
  element.filters = [{ filterId: 'custom', label: 'Custom', type: 'custom', custom: {
    adapter: { valueFromEvent: () => '', clearValue: '' }, render() { throw new Error('trusted renderer'); },
  } }];
  expect(() => element.render()).to.throw('trusted renderer');
});
