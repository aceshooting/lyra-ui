import { aTimeout, expect, fixture, html } from '@open-wc/testing';
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

/** A `'text'` filter's live native `<input>`, reached through its composed `<lr-input>`. */
async function nativeInput(element: LyraFilterBar, filterId: string): Promise<HTMLInputElement> {
  const composed = element.shadowRoot!.querySelector(
    `[data-filter-id="${filterId}"]`,
  ) as HTMLElement & { updateComplete: Promise<unknown> };
  await composed.updateComplete;
  return composed.shadowRoot!.querySelector('input') as HTMLInputElement;
}

/** How many debounce controllers the bar is holding. The map is private because it is pure
 *  bookkeeping, but its *size* is the only observable proof that a settled edit released its
 *  controller rather than retaining one keyed on a filter id a later schema may drop. */
function controllerCount(element: LyraFilterBar): number {
  return (element as unknown as { debounceControllers: Map<string, unknown> }).debounceControllers.size;
}

describe('filter-bar debounce controller lifecycle', () => {
  const filters: LyraFilterBarFilterDefinition[] = [
    { filterId: 'q', label: 'Search', type: 'text', debounce: 40 },
  ];

  it('releases a text filter controller once its edit settles naturally', async () => {
    const element = await fixture<LyraFilterBar>(html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`);
    const native = await nativeInput(element, 'q');
    native.value = 'tim';
    native.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    expect(controllerCount(element), 'an in-flight edit holds exactly one controller').to.equal(1);
    await aTimeout(200);
    expect(element.value).to.deep.equal({ q: 'tim' });
    expect(controllerCount(element), 'a settled edit leaves no controller behind').to.equal(0);
  });

  it('releases a text filter controller when its edit is flushed by the control own change', async () => {
    const element = await fixture<LyraFilterBar>(html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`);
    const native = await nativeInput(element, 'q');
    native.value = 'flush';
    native.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    expect(controllerCount(element)).to.equal(1);
    native.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    expect(element.value).to.deep.equal({ q: 'flush' });
    expect(controllerCount(element), 'a flushed edit leaves no controller behind either').to.equal(0);
  });

  it('strands no controller on a filter id a schema replacement removed after a settled edit', async () => {
    const element = await fixture<LyraFilterBar>(html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`);
    const native = await nativeInput(element, 'q');
    native.value = 'gone';
    native.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await aTimeout(200);
    element.filters = [{ filterId: 'other', label: 'Other', type: 'text', debounce: 40 }];
    await element.updateComplete;
    expect(controllerCount(element), 'the removed id keeps nothing alive').to.equal(0);
  });
});
