import { measureArrayMembership } from '../../../../test/array-membership-cost.js';
import { expect, fixture, html } from '@open-wc/testing';
import './tool-param-form.js';
import type { LyraToolParamForm, FlatToolParamSchema } from './tool-param-form.js';

const keys = Array.from({ length: 100 }, (_, index) => `membership-${index}`);
const properties = Object.fromEntries(keys.map((key) => [key, { type: 'string' as const }]));

it('shares required membership across all admitted fields and refreshes schema replacement', async () => {
  const form = await fixture<LyraToolParamForm>(html`<lr-tool-param-form></lr-tool-param-form>`);
  form.schema = { type: 'object', properties, required: [...keys].reverse() };
  const comparisons = measureArrayMembership('membership-', () => form.render()).comparisons;
  await form.updateComplete;
  expect(form.shadowRoot!.querySelectorAll('[part="field"][data-required]').length).to.equal(100);
  expect(form.shadowRoot!.querySelectorAll('input[aria-required="true"]').length).to.equal(100);
  expect(form.checkValidity()).to.equal(false);
  expect(comparisons).to.be.at.most(200);
  form.schema = { type: 'object', properties, required: ['membership-99'] };
  await form.updateComplete;
  expect(form.shadowRoot!.querySelectorAll('[part="field"][data-required]').length).to.equal(1);
  expect(form.shadowRoot!.querySelector('[part="field"][data-required]')?.getAttribute('data-key')).to.equal('membership-99');
});

it('finds no field anchor with linear work when required keys have no rendered properties', async () => {
  const schema: FlatToolParamSchema = {
    type: 'object', properties,
    required: keys.map((key) => `${key}-missing`),
  };
  const form = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${schema}></lr-tool-param-form>`);
  const fields = [...form.shadowRoot!.querySelectorAll<HTMLElement>('[part="field"]')];
  let keyReads = 0;
  for (const field of fields) {
    const key = field.dataset['key'];
    Object.defineProperty(field, 'dataset', {
      configurable: true,
      get: () => ({ get key() { keyReads++; return key; } }),
    });
  }
  let anchor: HTMLElement | undefined;
  try {
    anchor = (form as unknown as { firstInvalidField(): HTMLElement | undefined }).firstInvalidField();
  } finally {
    for (const field of fields) Reflect.deleteProperty(field, 'dataset');
  }
  expect(anchor === undefined).to.equal(true);
  expect(keyReads).to.be.at.most(fields.length * 2);
  expect(form.reportValidity()).to.equal(false);
  await form.updateComplete;
  await Promise.resolve();
  expect(form.shadowRoot!.activeElement?.getAttribute('data-key')).to.equal('membership-0-missing');
});

it('preserves error-key priority and empty keys when resolving native field anchors', async () => {
  const form = await fixture<LyraToolParamForm>(html`<lr-tool-param-form .schema=${{
    type: 'object', properties: { first: { type: 'string' }, '': { type: 'string' }, last: { type: 'string' } },
  }}></lr-tool-param-form>`);
  const internals = form as unknown as {
    _errors: Record<string, string>;
    firstInvalidField(): HTMLElement | undefined;
  };
  internals._errors = { unknown: 'Absent', last: 'Last first', '': 'Empty second', first: 'First last' };
  expect(internals.firstInvalidField()?.getAttribute('data-key')).to.equal('last');
  internals._errors = { '': 'Empty first', first: 'First second' };
  expect(internals.firstInvalidField()?.getAttribute('data-key')).to.equal('');
});
