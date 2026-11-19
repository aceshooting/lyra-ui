import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './filter-bar.js';
import type { LyraFilterBar, LyraFilterBarFilterDefinition } from './filter-bar.class.js';

const filters = [
  { filterId: 'status', label: 'Status', type: 'select', defaultValue: 'open', options: [{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }] },
  { filterId: 'q', label: 'Query', type: 'text' },
] as LyraFilterBarFilterDefinition[];
const resetButton = (el: LyraFilterBar): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part="reset-button"]')!;

describe('filter-bar loading status', () => {
  it('lines the spinner up with the reset button, above the trailing spacer', async () => {
    const el = await fixture<LyraFilterBar>(html`<lr-filter-bar loading .filters=${filters}></lr-filter-bar>`);
    await el.updateComplete;
    const spinner = el.shadowRoot!.querySelector('[part="status"]')!.getBoundingClientRect();
    const reset = resetButton(el).getBoundingClientRect();
    expect(Math.abs(spinner.bottom - reset.bottom)).to.be.lessThan(reset.height);
    expect(spinner.bottom).to.be.at.most(reset.bottom + 1);
  });
});

describe('filter-bar labels and events', () => {
  it('treats a whitespace-only aria-label as absent', async () => {
    const el = await fixture<LyraFilterBar>(html`<lr-filter-bar aria-label="  " .filters=${filters}></lr-filter-bar>`);
    expect(el.shadowRoot!.querySelector('[part="base"]')!.hasAttribute('aria-label')).to.equal(false);
  });

  it('contains composed control lifecycle events', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div><lr-filter-bar .filters=${filters}></lr-filter-bar></div>`);
    const el = wrapper.querySelector('lr-filter-bar') as LyraFilterBar;
    await el.updateComplete;
    const seen: string[] = [];
    for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-clear', 'lr-invalid']) wrapper.addEventListener(name, () => seen.push(name));
    const control = el.shadowRoot!.querySelector('lr-select')!;
    for (const name of ['lr-show', 'lr-after-show', 'lr-hide', 'lr-clear', 'lr-invalid'])
      control.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
    expect(seen).to.deep.equal([]);
  });
});

it('keeps a picker selection request inside the bar and emits the complete filter value', async () => {
  const el = await fixture<LyraFilterBar>(html`<lr-filter-bar .filters=${filters}>
    <button slot="end">More</button>
  </lr-filter-bar>`);
  const picker = el.shadowRoot!.querySelector('lr-select')!;
  const requests: EventTarget[] = [];
  const updates: unknown[] = [];
  el.addEventListener('lr-change-request', event => requests.push(event.composedPath()[0]!));
  el.addEventListener('lr-input', event => updates.push(event.detail.value));
  let pickerRequests = 0;
  picker.addEventListener('lr-change-request', () => { pickerRequests++; });
  await picker.show();
  picker.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"]')[1]!.click();
  await el.updateComplete;
  expect(pickerRequests).to.equal(1);
  expect(updates).to.deep.equal([{ status: 'closed' }]);
  expect(requests.length).to.equal(0);
  const slotted = el.querySelector('button')!;
  slotted.dispatchEvent(new CustomEvent('lr-change-request', { bubbles: true, composed: true }));
  expect(requests.length).to.equal(1);
  expect(requests[0] === slotted).to.equal(true);
});

it('isolates the label and value of a mixed-direction active chip', async () => {
  const el = await fixture<LyraFilterBar>(html`<lr-filter-bar dir="rtl"
    .filters=${[{ filterId: 'q', type: 'text', label: 'بحث' }]} .value=${{ q: 'ABC-123' }}></lr-filter-bar>`);
  const runs = el.shadowRoot!.querySelectorAll('[part="chip"] bdi[dir="auto"]');
  expect(Array.from(runs, run => run.textContent)).to.deep.equal(['بحث', 'ABC-123']);
});

it('moves keyboard focus to a surviving field when resetting the last change', async () => {
  const el = await fixture<LyraFilterBar>(html`<lr-filter-bar .filters=${[{ filterId: 'q', label: 'Query', type: 'text' }]}
    .value=${{ q: 'text' }}></lr-filter-bar>`);
  const reset = resetButton(el).shadowRoot!.querySelector<HTMLButtonElement>('button')!;
  await focusByKeyboard(reset);
  reset.click();
  await waitUntil(() => reset.disabled);
  await waitUntil(() => el.shadowRoot!.querySelector('lr-input')!.matches(':focus-within'), 'focus returns to the field');
});

it('omits controls whose schema label is whitespace only', async () => {
  const el = await fixture<LyraFilterBar>(html`<lr-filter-bar .filters=${[
    { filterId: 'blank', type: 'checkbox-menu', label: '  ', options: [] },
    { filterId: 'valid', type: 'text', label: 'Query' },
  ]}></lr-filter-bar>`);
  expect(Array.from(el.shadowRoot!.querySelectorAll('[data-filter-id]'), field => field.getAttribute('data-filter-id'))).to.deep.equal(['valid']);
});

it('restores a cleared default even when the chip row is empty', async () => {
  const el = await fixture<LyraFilterBar>(html`<lr-filter-bar .filters=${filters}></lr-filter-bar>`);
  el.value = {};
  await el.updateComplete;
  expect(el.hasActiveFilters).to.equal(false);
  expect(resetButton(el).hasAttribute('disabled')).to.equal(false);
  resetButton(el).click();
  await el.updateComplete;
  expect(el.value).to.deep.equal({ status: 'open' });
  expect(resetButton(el).hasAttribute('disabled')).to.equal(true);
});

it('keeps focus in a chip-only bar when reset removes its last action', async () => {
  const el = await fixture<LyraFilterBar>(html`<lr-filter-bar label="Filters"
    .filters=${[{ filterId: 'q', label: 'Query', type: 'chip' }]} .value=${{ q: 'text' }}></lr-filter-bar>`);
  const reset = resetButton(el).shadowRoot!.querySelector<HTMLButtonElement>('button')!;
  await focusByKeyboard(reset);
  reset.click();
  await waitUntil(() => reset.disabled);
  await waitUntil(() => el.shadowRoot!.activeElement?.getAttribute('part') === 'base', 'focus returns to the filter group');
});

it('leaves focus outside when a validity listener removes the bar during reset', async () => {
  const el = await fixture<LyraFilterBar>(html`<lr-filter-bar
    .filters=${[{ filterId: 'q', label: 'Query', type: 'text', required: true }]}
    .value=${{ q: 'text' }}></lr-filter-bar>`);
  const reset = resetButton(el).shadowRoot!.querySelector<HTMLButtonElement>('button')!;
  await focusByKeyboard(reset);
  el.addEventListener('lr-validity-change', () => el.remove(), { once: true });
  reset.click();
  await el.updateComplete;
  await nextFrame();
  expect(el.isConnected).to.equal(false);
  expect(document.activeElement === document.body).to.equal(true);
});
