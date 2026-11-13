import { expect, fixture, html } from '@open-wc/testing';
import type { LyraEvalDataset, EvalExample } from './eval-dataset.class.js';
import type { LyraTable } from '../../data/table/table.class.js';
import type { LyraChip } from '../../overlays/chip/chip.class.js';
import './eval-dataset.js';

const examples: EvalExample[] = [{ id: 'a', input: 'First', tags: ['topic'] }, { id: 'b', input: 'Second', tags: ['other'] }];
async function setup() {
  const host = await fixture<LyraEvalDataset>(html`<lr-eval-dataset .examples=${examples}></lr-eval-dataset>`);
  const table = host.shadowRoot!.querySelector<LyraTable<EvalExample>>('lr-table')!;
  await table.updateComplete;
  return { host, table };
}

for (const action of ['add', 'remove'] as const) {
  it(`suppresses the ${action} request when disabled during click capture and recovers`, async () => {
    const { host, table } = await setup();
    if (action === 'remove') {
      table.shadowRoot!.querySelector<HTMLElement>('tbody tr[part="row"]')!.click();
      await host.updateComplete;
    }
    const button = host.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${action}-button"]`)!;
    const requests: unknown[] = [];
    host.addEventListener(`lr-example-${action}-request`, event => requests.push((event as CustomEvent).detail));
    host.addEventListener('click', () => { host.disabled = true; }, { capture: true, once: true });
    expect(button.disabled).to.equal(false);
    button.click();
    expect(requests).to.deep.equal([]);
    await host.updateComplete;
    host.disabled = false;
    await host.updateComplete;
    button.click();
    expect(requests).to.deep.equal([action === 'add' ? null : { exampleId: 'a' }]);
    expect(host.examples).to.deep.equal(examples);
  });
}

it('suppresses a row activation when disabled during capture and permits a later selection', async () => {
  const { host, table } = await setup();
  const requests: unknown[] = [];
  host.addEventListener('lr-example-select', event => requests.push((event as CustomEvent).detail));
  host.addEventListener('lr-row-activate', () => { host.disabled = true; }, { capture: true, once: true });
  const row = (): HTMLElement => table.shadowRoot!.querySelector<HTMLElement>('tbody tr[part="row"]')!;
  row().click();
  expect(requests).to.deep.equal([]);
  await host.updateComplete;
  host.disabled = false;
  await host.updateComplete; await table.updateComplete;
  expect(host.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove-button"]')!.disabled).to.equal(true);
  row().click();
  expect(requests).to.deep.equal([{ exampleId: 'a' }]);
});

for (const format of ['csv', 'json'] as const) {
  it(`vetoes a composed ${format} download while disabled and resumes host export requests`, async () => {
    const { host } = await setup();
    const exporter = host.shadowRoot!.querySelector('lr-export-button')!;
    const requests: unknown[] = [];
    host.addEventListener('lr-export-request', event => requests.push((event as CustomEvent).detail));
    host.addEventListener('lr-export-request', () => { host.disabled = true; }, { capture: true, once: true });
    const dispatch = (): boolean => exporter.dispatchEvent(new CustomEvent('lr-export-request', {
      bubbles: true, composed: true, cancelable: true, detail: { format },
    }));
    expect(dispatch()).to.equal(false);
    expect(requests).to.deep.equal([]);
    await host.updateComplete;
    host.disabled = false;
    await host.updateComplete;
    expect(dispatch()).to.equal(false);
    expect(requests).to.deep.equal([{ format }]);
  });
}

it('keeps tag selection and filtered rows unchanged when disabled during the toggle request', async () => {
  const { host, table } = await setup();
  const chip = [...host.shadowRoot!.querySelectorAll<LyraChip>('lr-chip')].find(item => item.value === 'topic')!;
  await chip.updateComplete;
  const button = chip.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle-button"]')!;
  host.addEventListener('lr-chip-toggle-request', () => { host.disabled = true; }, { capture: true, once: true });
  button.click();
  await host.updateComplete; await chip.updateComplete;
  expect(chip.selected).to.equal(false);
  expect(table.rows.map(row => row.id)).to.deep.equal(['a', 'b']);
  host.disabled = false;
  await host.updateComplete; await chip.updateComplete;
  button.click();
  await host.updateComplete; await table.updateComplete;
  expect(chip.selected).to.equal(true);
  expect(table.rows.map(row => row.id)).to.deep.equal(['a']);
});

for (const selected of [false, true]) {
  it(`preserves ${selected ? 'selected' : 'unselected'} tag state and rows when the host vetoes the toggle`, async () => {
    const { host, table } = await setup();
    const chip = [...host.shadowRoot!.querySelectorAll<LyraChip>('lr-chip')].find(item => item.value === 'topic')!;
    await chip.updateComplete;
    const button = chip.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle-button"]')!;
    if (selected) { button.click(); await host.updateComplete; await chip.updateComplete; }
    host.addEventListener('lr-chip-toggle-request', event => event.preventDefault(), { capture: true, once: true });
    button.click();
    await host.updateComplete; await chip.updateComplete; await table.updateComplete;
    expect(chip.selected).to.equal(selected);
    expect(table.rows.map(row => row.id)).to.deep.equal(selected ? ['a'] : ['a', 'b']);
    button.click();
    await host.updateComplete; await chip.updateComplete; await table.updateComplete;
    expect(chip.selected).to.equal(!selected);
    expect(table.rows.map(row => row.id)).to.deep.equal(selected ? ['a', 'b'] : ['a']);
  });
}
