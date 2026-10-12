import { expect, fixture, html } from '@open-wc/testing';
import './checkbox-group.js';
import '../checkbox/checkbox.js';
import type { LyraCheckboxGroup } from './checkbox-group.js';
import type { LyraCheckbox } from '../checkbox/checkbox.js';

it('matches a reversed bulk selection with linear matching work and preserves form order', async () => {
  const values = Array.from({ length: 128 }, (_, index) => `selection-cost-${index}`);
  const form = await fixture<HTMLFormElement>(html`<form>
    <lr-checkbox-group name="choices" label="Choices">
      ${values.map((value) => html`<lr-checkbox value=${value}>${value}</lr-checkbox>`)}
    </lr-checkbox-group>
  </form>`);
  const group = form.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
  const boxes = [...group.querySelectorAll('lr-checkbox')] as LyraCheckbox[];
  await Promise.all(boxes.map((box) => box.updateComplete));
  await group.updateComplete;
  let changes = 0;
  group.addEventListener('change', () => changes++);
  group.addEventListener('lr-change', () => changes++);

  let comparisons = 0;
  const original = Array.prototype.indexOf;
  Array.prototype.indexOf = function (this: unknown[], searchElement: unknown, fromIndex?: number): number {
    const result = original.call(this, searchElement, fromIndex);
    // Only count the uniquely named fixture's selection arrays, during its synchronous setter.
    if (typeof this[0] === 'string' && this[0].startsWith('selection-cost-')) {
      comparisons += result < 0 ? this.length : result + 1;
    }
    return result;
  };
  try {
    group.value = [...values].reverse();
  } finally {
    Array.prototype.indexOf = original;
  }
  await group.updateComplete;

  expect(boxes.map((box) => box.checked)).to.deep.equal(values.map(() => true));
  expect(group.value).to.deep.equal(values);
  expect(new FormData(form).getAll('choices')).to.deep.equal(values);
  expect(changes).to.equal(0);
  expect(comparisons).to.be.at.most(values.length * 2);
});

it('consumes repeated and empty requested values one child at a time', async () => {
  const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
  const warningKey = 'lyra-checkbox-group-duplicate-child-values';
  const wasSeeded = runtime.litIssuedWarnings?.has(warningKey);
  runtime.litIssuedWarnings?.add(warningKey);
  try {
    const form = await fixture<HTMLFormElement>(html`<form>
      <lr-checkbox-group name="choices" label="Choices">
        <lr-checkbox value="same">First</lr-checkbox>
        <lr-checkbox value="">Empty</lr-checkbox>
        <lr-checkbox value="same">Second</lr-checkbox>
        <lr-checkbox value="same">Third</lr-checkbox>
        <lr-checkbox value="other" checked>Other</lr-checkbox>
      </lr-checkbox-group>
    </form>`);
    const group = form.querySelector('lr-checkbox-group') as LyraCheckboxGroup;
    const boxes = [...group.querySelectorAll('lr-checkbox')] as LyraCheckbox[];
    const requested = ['same', 'unknown', '', 'same'];
    group.value = requested;
    await Promise.all(boxes.map((box) => box.updateComplete));
    await group.updateComplete;

    expect(boxes.map((box) => box.checked)).to.deep.equal([true, true, true, false, false]);
    expect(group.value).to.deep.equal(['same', '', 'same']);
    expect(new FormData(form).getAll('choices')).to.deep.equal(['same', '', 'same']);
    expect(requested).to.deep.equal(['same', 'unknown', '', 'same']);
  } finally {
    if (!wasSeeded) runtime.litIssuedWarnings?.delete(warningKey);
  }
});
