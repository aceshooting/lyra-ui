import { aTimeout, expect, fixture, html } from '@open-wc/testing';
import './select.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.js';
import type { LyraOption } from '../combobox/option.js';

async function settle(control: LyraSelect): Promise<void> {
  await aTimeout(0);
  await control.updateComplete;
}

for (const assignment of ['value', 'selectedOptions'] as const) {
  it(`resolves large multiple ${assignment} assignments with linear catalog work`, async () => {
    const form = await fixture<HTMLFormElement>(html`<form><lr-select label="Choice" name="pick" multiple></lr-select><div></div></form>`);
    const control = form.querySelector<LyraSelect>('lr-select')!;
    const options = Array.from({ length: 64 }, (_, index) => {
      const option = document.createElement('lr-option');
      option.value = String(index);
      option.label = `Option ${index}`;
      option.data = { index };
      return option;
    });
    control.append(...options);
    await Promise.all(options.map((option) => option.updateComplete));
    await settle(control);
    const foreign = document.createElement('lr-option');
    foreign.value = 'foreign';
    form.lastElementChild!.append(foreign);
    const detached = document.createElement('lr-option');
    detached.value = 'detached';
    const values = options.map((option) => option.value);
    const candidates = [...options, options[0]!, foreign, detached];
    const catalog = (control as unknown as { options: LyraOption[] }).options;
    const includes = catalog.includes;
    const indexOf = candidates.indexOf;
    let valueReads = 0;
    let membershipCalls = 0;
    let candidateSearches = 0;
    let changes = 0;
    control.addEventListener('lr-change', () => changes++);
    for (const option of options) {
      const value = option.value;
      Object.defineProperty(option, 'value', { configurable: true, get: () => {
        valueReads++;
        return value;
      } });
    }
    Object.defineProperty(catalog, 'includes', { configurable: true, value: (option: LyraOption, from?: number): boolean => {
      membershipCalls++;
      return includes.call(catalog, option, from);
    } });
    Object.defineProperty(candidates, 'indexOf', { configurable: true, value: (option: LyraOption, from?: number): number => {
      candidateSearches++;
      return indexOf.call(candidates, option, from);
    } });
    try {
      if (assignment === 'value') control.value = values;
      else control.selectedOptions = candidates;
      expect(control.value).to.deep.equal(values);
      expect(control.selectedOptions.every((option, index) => option === options[index])).to.equal(true);
      expect(control.selectedOptions.length).to.equal(options.length);
      expect(control.selectedData.every((data, index) => data === options[index]!.data)).to.equal(true);
      expect(new FormData(form).getAll('pick')).to.deep.equal(values);
      expect(valueReads, `${assignment} should not search from the catalog start per value`).to.be.lessThan(options.length * 12);
      expect(membershipCalls, `${assignment} should share catalog membership work`).to.be.lessThan(4);
      expect(candidateSearches, 'candidate deduplication must not search the input repeatedly').to.equal(0);
      expect(changes).to.equal(0);
    } finally {
      for (const option of options) Reflect.deleteProperty(option, 'value');
      Reflect.deleteProperty(catalog, 'includes');
      Reflect.deleteProperty(candidates, 'indexOf');
    }
  });
}

it('resolves an early single selection without reading the rest of the catalog', async () => {
  const control = await fixture<LyraSelect>(html`<lr-select label="Choice"></lr-select>`);
  const options = Array.from({ length: 32 }, (_, index) => {
    const option = document.createElement('lr-option');
    option.value = String(index);
    option.label = `Option ${index}`;
    return option;
  });
  control.append(...options);
  await Promise.all(options.map((option) => option.updateComplete));
  await settle(control);
  const reads = options.map(() => 0);
  for (const [index, option] of options.entries()) {
    const value = option.value;
    Object.defineProperty(option, 'value', { configurable: true, get: () => {
      reads[index] = reads[index]! + 1;
      return value;
    } });
  }
  try {
    control.value = '0';
    expect(control.value).to.equal('0');
    expect(control.selectedOptions[0] === options[0]).to.equal(true);
    expect(reads[0]).to.be.greaterThan(0);
    expect(reads.slice(1)).to.deep.equal(Array(31).fill(0));
    reads.fill(0);
    control.selectedOptions = [options[0]!];
    expect(control.value).to.equal('0');
    expect(reads.slice(1)).to.deep.equal(Array(31).fill(0));
    reads.fill(0);
    control.value = [];
    expect(control.value).to.equal('');
    expect(reads).to.deep.equal(Array(32).fill(0));
  } finally {
    for (const option of options) Reflect.deleteProperty(option, 'value');
  }
});

it('keeps preferred duplicate identities and unknown gaps when a preferred option leaves the catalog', async () => {
  const wrapper = await fixture<HTMLDivElement>(html`
    <div><lr-select label="Choice" multiple>
      <lr-option value="same" .data=${'first'}>First</lr-option>
      <lr-option value="same" .data=${'second'}>Second</lr-option>
      <lr-option value="same" .data=${'third'}>Third</lr-option>
    </lr-select></div>
  `);
  const control = wrapper.querySelector<LyraSelect>('lr-select')!;
  await settle(control);
  const [first, second, third] = Array.from(control.querySelectorAll<LyraOption>('lr-option'));
  if (!first || !second || !third) throw new Error('Expected three options');
  control.value = ['missing'];
  second.selected = true;
  third.selected = true;
  expect(control.value).to.deep.equal(['missing', 'same', 'same']);
  expect(control.selectedData).to.deep.equal([undefined, 'second', 'third']);
  second.remove();
  await settle(control);
  expect(control.selectedData, 'an invalid first unaligned hint falls back to source order').to.deep.equal([undefined, 'first', 'third']);
  control.selectedOptions = [third, first, third, second];
  expect(control.selectedData).to.deep.equal(['third', 'first']);
  expect(control.value).to.deep.equal(['same', 'same']);

  first.value = 'renamed';
  await first.updateComplete;
  await settle(control);
  control.value = ['renamed', 'missing', 'same', 'same'];
  expect(control.selectedData).to.deep.equal(['first', undefined, 'third', undefined]);
  control.prepend(second);
  await settle(control);
  control.value = ['same', 'renamed', 'same'];
  expect(control.selectedData).to.deep.equal(['second', 'first', 'third']);
  control.remove();
  wrapper.append(control);
  await settle(control);
  control.value = ['same', 'same', 'renamed'];
  expect(control.selectedData).to.deep.equal(['second', 'third', 'first']);
});

it('retains duplicate reset occurrences and resolves replacements with fresh indexes', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-select label="Choice" name="pick" multiple>
      <lr-option value="" selected .data=${'empty'}>Empty</lr-option>
      <lr-option value="same" selected .data=${'first'}>First</lr-option>
      <lr-option value="same" selected .data=${'second'}>Second</lr-option>
    </lr-select></form>
  `);
  const control = form.querySelector<LyraSelect>('lr-select')!;
  await settle(control);
  const [empty, first, second] = Array.from(control.querySelectorAll<LyraOption>('lr-option'));
  if (!empty || !first || !second) throw new Error('Expected three options');
  control.selectedOptions = [second, empty];
  expect(control.selectedData).to.deep.equal(['second', 'empty']);
  form.reset();
  expect(control.value).to.deep.equal(['', 'same', 'same']);
  expect(control.selectedData).to.deep.equal(['empty', 'first', 'second']);
  expect(new FormData(form).getAll('pick')).to.deep.equal(['', 'same', 'same']);
  const replacement = document.createElement('lr-option');
  replacement.value = 'same';
  replacement.label = 'Replacement';
  replacement.data = 'replacement';
  first.replaceWith(replacement);
  await settle(control);
  control.value = ['same', 'same', ''];
  expect(control.selectedData).to.deep.equal(['replacement', 'second', 'empty']);
  control.defaultValue = ['same', 'same'];
  control.selectedOptions = [empty];
  form.reset();
  expect(control.selectedData).to.deep.equal(['replacement', 'second']);
});
