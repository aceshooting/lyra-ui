import { measureArrayMembership } from '../../../../test/array-membership-cost.js';
import { expect, fixture, html } from '@open-wc/testing';
import './schema-viewer.js';
import type { JsonSchemaNode, LyraJsonSchemaViewer } from './schema-viewer.js';

const keys = Array.from({ length: 100 }, (_, index) => `membership-${index}`);
const properties = Object.fromEntries(keys.map((key) => [key, { type: 'string' }]));

it('shares required membership across sibling schema nodes without retaining stale requirements', async () => {
  const viewer = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer></lr-json-schema-viewer>`);
  viewer.schema = { type: 'object', properties, required: [...keys].reverse() };
  const comparisons = measureArrayMembership('membership-', () => viewer.render()).comparisons;
  await viewer.updateComplete;
  expect(viewer.shadowRoot!.querySelectorAll('[part="required"]').length).to.equal(100);
  expect(comparisons).to.be.at.most(200);
  viewer.schema = {
    type: 'object', required: ['membership-99'],
    properties: { ...properties, nested: { type: 'object', required: ['child'], properties: { child: { type: 'number' } } } },
  };
  await viewer.updateComplete;
  expect(viewer.shadowRoot!.querySelectorAll('[part="required"]').length).to.equal(2);
  expect(viewer.shadowRoot!.querySelector('[data-path="/properties/membership-99"] [part="required"]') !== null).to.equal(true);
  expect(viewer.shadowRoot!.querySelector('[data-path="/properties/nested/properties/child"] [part="required"]') !== null).to.equal(true);
});

it('does not index a required list for depth-limited or single-child nodes', async () => {
  const viewer = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer></lr-json-schema-viewer>`);
  viewer.schema = { type: 'object', properties: { 'membership-only': { type: 'string' } }, required: ['membership-only', ...keys] };
  const canonical = viewer.schema!.required;
  const NativeSet = globalThis.Set;
  let indexed = 0;
  globalThis.Set = class extends NativeSet {
    constructor(values?: Iterable<unknown> | null) {
      if (values === canonical) indexed++;
      super(values == null ? undefined : Array.from(values));
    }
  } as SetConstructor;
  try {
    viewer.render();
    viewer.maxDepth = 0;
    viewer.render();
  } finally { globalThis.Set = NativeSet; }
  expect(indexed).to.equal(0);
  await viewer.updateComplete;
  expect(viewer.shadowRoot!.querySelectorAll('[part="required"]').length).to.equal(0);
});

it('keeps the selected required child reachable beyond the ordinary render budget', async () => {
  const names = Array.from({ length: 700 }, (_, index) => `membership-${index}`);
  const schema: JsonSchemaNode = {
    type: 'object', required: ['membership-699'],
    properties: Object.fromEntries(names.map((key) => [key, { type: 'string' }])),
  };
  const viewer = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer
    .schema=${schema} selected-path="/properties/membership-699"
  ></lr-json-schema-viewer>`);
  const selected = viewer.shadowRoot!.querySelector('[data-path="/properties/membership-699"]');
  expect(selected?.querySelector('[part="required"]') != null).to.equal(true);
  expect(viewer.shadowRoot!.querySelectorAll('[data-path]').length).to.be.at.most(500);
  expect(viewer.shadowRoot!.querySelector('[part="limit"]') !== null).to.equal(true);
  expect(schema.required).to.deep.equal(['membership-699']);
});
