import { expect, fixture, fixtureSync, html, waitUntil } from '@open-wc/testing';
import './select.js';
import '../combobox/option.js';
import type { LyraSelect } from './select.class.js';
import type { LyraOption } from '../combobox/option.class.js';

describe('select initial occurrence binding', () => {
  for (const multiple of [false, true]) {
    it(`retains a pre-render selectedOptions binding in ${multiple ? 'multiple' : 'single'} mode`, async () => {
      const form = fixtureSync<HTMLFormElement>(html`
        <form><lr-select label="Choice" name="choice" .multiple=${multiple}>
          <lr-option value="same" selected>First occurrence</lr-option>
          <lr-option value="same">Second occurrence</lr-option>
          <lr-option value="other">Other choice</lr-option>
        </lr-select></form>
      `);
      const el = form.querySelector<LyraSelect>('lr-select')!;
      const options = [...el.querySelectorAll<LyraOption>('lr-option')];
      const requested = multiple ? [options[1]!, options[2]!] : [options[1]!];
      const events: string[] = [];
      for (const name of ['input', 'change', 'lr-input', 'lr-change']) el.addEventListener(name, () => events.push(name));
      expect(el.hasUpdated).to.equal(false);
      el.selectedOptions = requested;
      await el.updateComplete;
      await waitUntil(() => el.selectedOptions.length === requested.length &&
        el.selectedOptions.every((option, index) => option === requested[index]), 'initial option identity survives slot reconciliation');
      expect(options.map(option => option.selected)).to.deep.equal(multiple ? [false, true, true] : [false, true, false]);
      expect(el.value).to.deep.equal(multiple ? ['same', 'other'] : 'same');
      expect(new FormData(form).getAll('choice')).to.deep.equal(multiple ? ['same', 'other'] : ['same']);
      expect(events).to.deep.equal([]);
    });
  }
});

function initialChoices(multiple: boolean): { form: HTMLFormElement; el: LyraSelect; options: LyraOption[] } {
  const form = fixtureSync<HTMLFormElement>(html`
    <form><lr-select label="Choice" name="choice" .multiple=${multiple}>
      <lr-option value="default" selected>Default choice</lr-option>
      <lr-option value="requested">Requested choice</lr-option>
      <lr-option value="later">Later choice</lr-option>
    </lr-select></form>
  `);
  const el = form.querySelector<LyraSelect>('lr-select')!;
  return { form, el, options: [...el.querySelectorAll<LyraOption>('lr-option')] };
}

describe('initial select write precedence and reset', () => {
  for (const multiple of [false, true]) {
    it(`lets a later value write supersede the initial ${multiple ? 'multiple' : 'single'} occurrence request`, async () => {
      const { form, el, options } = initialChoices(multiple);
      let changes = 0;
      el.addEventListener('lr-change', () => { changes++; });
      el.selectedOptions = [options[1]!];
      el.value = multiple ? ['later'] : 'later';
      await el.updateComplete;
      await waitUntil(() => el.selectedOptions[0] === options[2]);
      expect(new FormData(form).getAll('choice')).to.deep.equal(['later']);
      expect(el.defaultValue).to.deep.equal(multiple ? ['default'] : 'default');
      form.reset();
      await el.updateComplete;
      expect(el.selectedOptions[0] === options[0]).to.equal(true);
      expect(new FormData(form).getAll('choice')).to.deep.equal(['default']);
      expect(changes).to.equal(0);
    });

    it(`snapshots a later initial ${multiple ? 'multiple' : 'single'} occurrence request instead of replaying an older value`, async () => {
      const { form, el, options } = initialChoices(multiple);
      el.value = multiple ? ['later'] : 'later';
      const requested = [options[1]!];
      el.selectedOptions = requested;
      requested[0] = options[2]!;
      await el.updateComplete;
      await waitUntil(() => el.selectedOptions[0] === options[1]);
      expect(new FormData(form).getAll('choice')).to.deep.equal(['requested']);
      form.reset();
      await el.updateComplete;
      expect(el.selectedOptions[0] === options[0]).to.equal(true);
      expect(new FormData(form).getAll('choice')).to.deep.equal(['default']);
    });

    it(`preserves an explicit initial empty ${multiple ? 'multiple' : 'single'} selection without changing the reset default`, async () => {
      const { form, el, options } = initialChoices(multiple);
      el.selectedOptions = [];
      await el.updateComplete;
      expect(el.selectedOptions.length).to.equal(0);
      expect(el.value).to.deep.equal(multiple ? [] : '');
      expect(new FormData(form).getAll('choice')).to.deep.equal(multiple ? [] : ['']);
      expect(el.defaultValue).to.deep.equal(multiple ? ['default'] : 'default');
      form.reset();
      await el.updateComplete;
      expect(el.selectedOptions[0] === options[0]).to.equal(true);
      expect(new FormData(form).getAll('choice')).to.deep.equal(['default']);
    });

    it(`lets a native reset cancel a pending initial ${multiple ? 'multiple' : 'single'} occurrence request`, async () => {
      const { form, el, options } = initialChoices(multiple);
      el.selectedOptions = [options[1]!];
      form.reset();
      await el.updateComplete;
      await waitUntil(() => el.selectedOptions[0] === options[0]);
      expect(el.value).to.deep.equal(multiple ? ['default'] : 'default');
      expect(new FormData(form).getAll('choice')).to.deep.equal(['default']);
    });
  }

  it('does not promote an initially foreign option into the retained request when it is inserted later that turn', async () => {
    const { form, el, options } = initialChoices(true);
    const foreign = document.createElement('lr-option');
    foreign.value = 'foreign';
    foreign.textContent = 'Foreign choice';
    el.selectedOptions = [options[1]!, foreign];
    el.append(foreign);
    await el.updateComplete;
    await waitUntil(() => el.selectedOptions.length === 1 && el.selectedOptions[0] === options[1]);
    expect(foreign.selected).to.equal(false);
    expect(new FormData(form).getAll('choice')).to.deep.equal(['requested']);
  });
});

it('reconciles multiple unavailable values as their public synthetic rows are removed and replaced', async () => {
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-select label="Saved choices" name="choice" multiple with-unknown-option
      .value=${['missing-a', 'missing-b']} style="--lr-duration-base: 0ms">
      <lr-option value="known">Known choice</lr-option>
    </lr-select></form>
  `);
  const el = form.querySelector<LyraSelect>('lr-select')!;
  const unknownRows = () => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="option"][data-unknown-value]')];
  let changes = 0;
  el.addEventListener('lr-change', () => { changes++; });
  try {
    await el.show();
    expect(unknownRows().map(row => row.dataset['value'])).to.deep.equal(['missing-a', 'missing-b']);
    unknownRows()[0]!.click();
    await el.updateComplete;
    expect(el.value).to.deep.equal(['missing-b']);
    expect(new FormData(form).getAll('choice')).to.deep.equal(['missing-b']);
    expect(unknownRows().map(row => row.dataset['value'])).to.deep.equal(['missing-b']);
    expect(changes).to.equal(1);
    expect(el.open).to.equal(true);
    el.value = ['missing-b', 'missing-c'];
    await el.updateComplete;
    expect(unknownRows().map(row => row.dataset['value'])).to.deep.equal(['missing-b', 'missing-c']);
    expect(el.selectedOptions.length).to.equal(0);
    expect(new FormData(form).getAll('choice')).to.deep.equal(['missing-b', 'missing-c']);
    expect(changes).to.equal(1);
    await expect(el).to.be.accessible();
  } finally {
    await el.hide();
  }
});
