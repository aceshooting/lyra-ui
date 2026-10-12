import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import './combobox.js';
import './option.js';
import type { ComboboxSourceRow, LyraCombobox } from './combobox.class.js';
import type { LyraOption } from './option.js';

async function settle(control: LyraCombobox): Promise<void> {
  await aTimeout(0);
  await control.updateComplete;
}

function catalog(size: number): LyraOption[] {
  return Array.from({ length: size }, (_, index) => {
    const option = document.createElement('lr-option');
    option.value = String(index);
    option.label = `Option ${index}`;
    option.data = { index };
    return option;
  });
}

/** Install only after the options' first Lit update, without touching shared prototypes. */
function trackDataReads(options: LyraOption[]): { reads: number[]; restore: () => void } {
  const reads = options.map(() => 0);
  for (const [index, option] of options.entries()) {
    const data = option.data;
    Object.defineProperty(option, 'data', {
      configurable: true,
      get: () => {
        reads[index] = reads[index]! + 1;
        return data;
      },
    });
  }
  return { reads, restore: () => {
    for (const option of options) Reflect.deleteProperty(option, 'data');
  } };
}

it('projects only requested selected rows beyond the suggestion cap and preserves their complete payload', async () => {
  const control = await fixture<LyraCombobox>(html`<lr-combobox label="Choice" max-render="1"></lr-combobox>`);
  const options = catalog(32);
  const target = options[31]!;
  target.sub = 'Secondary';
  target.title = 'Tooltip';
  target.group = 'Last';
  target.dotColor = 'red';
  target.disabled = true;
  const start = document.createElement('span');
  start.slot = 'start';
  start.textContent = 'Adornment';
  target.append(start);
  control.append(...options);
  await Promise.all(options.map((option) => option.updateComplete));
  await settle(control);
  let changes = 0;
  control.addEventListener('lr-change', () => changes++);
  const probe = trackDataReads(options);
  try {
    control.selectedRows = [{ value: '31', label: 'Caller display', data: 'Caller payload' }];
    expect(control.value, 'selection remains synchronous').to.equal('31');
    expect(probe.reads.slice(0, 31), 'unrequested options need no row snapshot').to.deep.equal(Array(31).fill(0));
    expect(probe.reads[31]).to.be.greaterThan(0);
    const row = control.selectedRows[0]!;
    expect([row.label, row.sub, row.title, row.group, row.dotColor, row.disabled])
      .to.deep.equal(['Option 31', 'Secondary', 'Tooltip', 'Last', 'red', true]);
    expect(row.data === target.data).to.equal(true);
    expect(Array.isArray(row.start)).to.equal(true);
    expect((row.start as Node[]).map((node) => node.textContent)).to.deep.equal(['Adornment']);
    expect(Reflect.set(row, 'label', 'Edited snapshot')).to.equal(true);
    expect(control.selectedRows[0]!.label).to.equal('Option 31');
    probe.reads.fill(0);
    control.selectedRows = [];
    expect(control.value).to.equal('');
    expect(control.selectedRows).to.deep.equal([]);
    expect(probe.reads, 'clearing needs no row snapshots').to.deep.equal(Array(32).fill(0));
    expect(changes).to.equal(0);
  } finally {
    probe.restore();
  }

  target.data = { index: 31, revision: 2 };
  target.label = 'Fresh label';
  target.sub = 'Fresh secondary';
  start.textContent = 'Fresh adornment';
  await target.updateComplete;
  await settle(control);
  control.selectedRows = [{ value: '31', label: 'Ignored' }];
  expect(control.selectedRows[0]!.label).to.equal('Fresh label');
  expect(control.selectedRows[0]!.sub).to.equal('Fresh secondary');
  expect(control.selectedRows[0]!.data === target.data).to.equal(true);
  expect((control.selectedRows[0]!.start as Node[]).map((node) => node.textContent)).to.deep.equal(['Fresh adornment']);
  (target.data as { revision: number }).revision = 3;
  expect((control.selectedRows[0]!.data as { revision: number }).revision).to.equal(3);
});

it('resolves selectedRows against first catalog occurrences independently of the current filter', async () => {
  const control = await fixture<LyraCombobox>(html`
    <lr-combobox label="Choice" multiple max-render="1">
      <lr-option value="same" .data=${{ occurrence: 1 }}>First</lr-option>
      <lr-option value="same" .data=${{ occurrence: 2 }}>Second</lr-option>
      <lr-option value="tail">Tail</lr-option>
    </lr-combobox>
  `);
  await settle(control);
  control.inputValue = 'Second';
  await settle(control);
  control.selectedRows = [
    { value: 'missing', label: 'Missing' },
    { value: 'same', label: 'Ignored' },
    { value: 'same', label: 'Repeated' },
    { value: 'tail', label: 'Ignored' },
  ];
  expect(control.value).to.deep.equal(['same', 'tail']);
  expect(control.selectedRows.map((row) => row.label)).to.deep.equal(['First', 'Tail']);
  expect(control.selectedRows[0]!.data).to.deep.equal({ occurrence: 1 });
});

it('lazily resolves a deferred local selectedRows assignment when options arrive', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`<div><lr-combobox label="Choice" max-render="1"></lr-combobox><div></div></div>`);
  const control = wrapper.querySelector<LyraCombobox>('lr-combobox')!;
  control.selectedRows = [{ value: '15', label: 'Pending display' }];
  const options = catalog(16);
  wrapper.lastElementChild!.append(...options);
  await Promise.all(options.map((option) => option.updateComplete));
  const probe = trackDataReads(options);
  try {
    control.append(...options);
    await settle(control);
    expect(control.value).to.equal('15');
    expect(control.selectedRows.map((row) => row.label)).to.deep.equal(['Option 15']);
    expect(probe.reads.slice(0, 15), 'deferred selection must not project unrelated payloads').to.deep.equal(Array(15).fill(0));
    expect(control.selectedRows[0]!.data === options[15]!.data).to.equal(true);
  } finally {
    probe.restore();
  }
});

it('preserves deferred async source selection and opaque payload references', async () => {
  const payload = { revision: 1 };
  const sourceRows: ComboboxSourceRow[] = [
    { value: 'other', label: 'Other' },
    { value: 'same', label: 'First', title: 'Title', sub: 'Secondary', group: 'Group', data: payload },
    { value: 'tail', label: 'Tail', data: { revision: 0 } },
  ];
  const control = await fixture<LyraCombobox>(html`<lr-combobox label="Choice" source-delay="0" max-render="1"></lr-combobox>`);
  control.source = async () => sourceRows;
  await control.updateComplete;
  control.selectedRows = [{ value: 'missing', label: 'Missing' }, { value: 'same', label: 'Caller display' }];
  await waitUntil(() => control.value === 'same');
  const row = control.selectedRows[0]!;
  expect([row.label, row.title, row.sub, row.group]).to.deep.equal(['First', 'Title', 'Secondary', 'Group']);
  expect(row.data === payload).to.equal(true);
  payload.revision = 2;
  expect((control.selectedRows[0]!.data as { revision: number }).revision).to.equal(2);
  expect(control.open).to.equal(false);
});
