import { expect, fixture, html } from '@open-wc/testing';
import '../components/forms/date-picker/date-input.js';
import '../components/forms/time-range/time-range.js';
import '../components/forms/checkbox-group/checkbox-group.js';
import '../components/forms/checkbox/checkbox.js';
import '../components/agent-tools/tool-param-form/tool-param-form.js';
import '../components/data/data-grid/data-grid.js';
import type { LyraDateInput } from '../components/forms/date-picker/date-input.class.js';
import type { LyraToolParamForm } from '../components/agent-tools/tool-param-form/tool-param-form.class.js';
import type { LyraDataGrid } from '../components/data/data-grid/data-grid.class.js';

function collect(host: HTMLElement): Event[] {
  const events: Event[] = [];
  for (const name of ['input', 'lr-input', 'change', 'lr-change']) {
    host.addEventListener(name, (event) => events.push(event));
  }
  return events;
}

it('publishes native events and typed date values without changing clear ordering', async () => {
  const control = await fixture<LyraDateInput>(html`<lr-date-input value="2025-01-02"></lr-date-input>`);
  const events = collect(control);
  control.clear();
  expect(events.map((event) => event.type)).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
  expect(events[0] instanceof InputEvent).to.equal(true);
  expect((events[0] as InputEvent).inputType).to.equal('deleteContentBackward');
  expect(events[2] instanceof CustomEvent).to.equal(false);
  expect((events[1] as CustomEvent).detail).to.deep.equal({ value: '' });
  expect((events[3] as CustomEvent).detail).to.deep.equal({ value: '' });
  control.value = '2025-02-03';
  await control.updateComplete;
  expect(events.length).to.equal(4);
});

it('contains child events and emits native checkbox-group events without custom detail', async () => {
  const control = await fixture<HTMLElement>(html`<lr-checkbox-group><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>`);
  const events = collect(control);
  control.querySelector('lr-checkbox')!.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!.click();
  expect(events.map((event) => event.type)).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
  expect(events.every((event) => event.target === control && event.bubbles && event.composed)).to.equal(true);
  expect(events.filter((event) => !event.type.startsWith('lr-')).every((event) => !(event instanceof CustomEvent))).to.equal(true);
  expect((events[1] as CustomEvent).detail.value).to.deep.equal(['a']);
  expect(Object.isFrozen((events[3] as CustomEvent).detail.value)).to.equal(true);
});

it('separates aggregate live edits from commits while keeping schema defaults', async () => {
  const control = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${{
    type: 'object', properties: { city: { type: 'string' }, days: { type: 'integer', default: 3 } },
  }}></lr-tool-param-form>`);
  const events = collect(control);
  const input = control.shadowRoot!.querySelector<HTMLInputElement>('input.control')!;
  input.value = 'Paris';
  input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, data: 's' }));
  expect(events.map((event) => event.type)).to.deep.equal(['input', 'lr-input']);
  input.dispatchEvent(new Event('change', { bubbles: true }));
  expect(events.map((event) => event.type)).to.deep.equal(['input', 'lr-input', 'change', 'lr-change']);
  expect(events.every((event) => event.target === control)).to.equal(true);
  expect((events[3] as CustomEvent).detail.value).to.deep.equal({ city: 'Paris', days: 3 });
  expect(Object.isFrozen((events[3] as CustomEvent).detail.value)).to.equal(true);
});

it('publishes canonical and legacy grid requests with the same live abort signal', async () => {
  const grid = await fixture<LyraDataGrid>(html`<lr-data-grid label="Results" .dataSource=${async () => ({ rows: [], total: 0 })}></lr-data-grid>`);
  const events: CustomEvent[] = [];
  grid.addEventListener('lr-request', (event) => events.push(event));
  grid.addEventListener('request', (event) => events.push(event));
  await grid.reload();
  expect(events.map((event) => event.type)).to.deep.equal(['lr-request', 'request']);
  expect(events[0]!.detail).to.deep.equal(events[1]!.detail);
  expect(events[0]!.detail.signal === events[1]!.detail.signal).to.equal(true);
  expect(Object.isFrozen(events[0]!.detail)).to.equal(true);
});

it('keeps the triggering date value when native listeners replace the control value', async () => {
  const control = await fixture<LyraDateInput>(html`<lr-date-input value="2025-01-02"></lr-date-input>`);
  const events = collect(control);
  control.addEventListener('input', () => { control.value = '2025-04-05'; });
  control.addEventListener('change', () => { control.value = '2025-06-07'; });
  control.clear();
  expect((events[1] as CustomEvent).detail.value).to.equal('');
  expect((events[3] as CustomEvent).detail.value).to.equal('');
  expect(control.value).to.equal('2025-06-07');
});

it('keeps one checkbox selection snapshot across native listener writes', async () => {
  const control = await fixture<HTMLElement & { value: string[] }>(html`<lr-checkbox-group><lr-checkbox value="a">A</lr-checkbox></lr-checkbox-group>`);
  const events = collect(control);
  control.addEventListener('input', () => { control.value = ['replacement']; });
  control.querySelector('lr-checkbox')!.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!.click();
  expect((events[1] as CustomEvent).detail.value).to.deep.equal(['a']);
  expect((events[3] as CustomEvent).detail.value).to.deep.equal(['a']);
});

it('keeps a discrete range preset snapshot across native listener writes', async () => {
  const control = await fixture<HTMLElement & { start: number; end: number }>(html`
    <lr-time-range max="360" .presets=${[{ label: 'Morning', start: 60, end: 120 }]}></lr-time-range>
  `);
  const events = collect(control);
  control.addEventListener('input', () => { control.start = 240; control.end = 300; });
  control.shadowRoot!.querySelector<HTMLButtonElement>('[part="preset-button"]')!.click();
  expect((events[1] as CustomEvent).detail.value).to.deep.equal({ start: 60, end: 120 });
  expect((events[3] as CustomEvent).detail.value).to.deep.equal({ start: 60, end: 120 });
  expect({ start: control.start, end: control.end }).to.deep.equal({ start: 240, end: 300 });
});
