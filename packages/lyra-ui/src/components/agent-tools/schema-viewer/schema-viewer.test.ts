import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './schema-viewer.js';
import type { LyraSchemaViewer } from './schema-viewer.js';

const schema = {
  type: 'object',
  title: 'Search arguments',
  required: ['query'],
  properties: {
    query: { type: 'string', description: 'Search query' },
    options: { type: 'object', properties: { limit: { type: 'integer', minimum: 1 } } },
  },
};

it('renders nested JSON Schema structure, constraints, required state, and validation issues', async () => {
  const el = (await fixture(
    html`<lr-schema-viewer
      .schema=${schema}
      .issues=${[{ path: '/properties/query', message: 'Query is required', severity: 'error' }]}
    ></lr-schema-viewer>`,
  )) as LyraSchemaViewer;
  expect(el.shadowRoot!.querySelectorAll('[part~="node"]').length).to.be.greaterThan(2);
  expect(el.shadowRoot!.textContent).to.contain('Search query');
  expect(el.shadowRoot!.textContent).to.contain('Required');
  expect(el.shadowRoot!.textContent).to.contain('Query is required');
});

it('emits the selected JSON Pointer and record', async () => {
  const el = (await fixture(html`<lr-schema-viewer .schema=${schema}></lr-schema-viewer>`)) as LyraSchemaViewer;
  const pending = oneEvent(el, 'lr-schema-select');
  (el.shadowRoot!.querySelector('[data-path="/properties/query"]') as HTMLButtonElement).click();
  expect((await pending).detail).to.deep.equal({ path: '/properties/query', schema: schema.properties.query });
});

it('fails closed for malformed/circular input and is accessible', async () => {
  const circular: Record<string, unknown> = { type: 'object' };
  circular['properties'] = { self: circular };
  const el = (await fixture(html`<lr-schema-viewer .schema=${circular}></lr-schema-viewer>`)) as LyraSchemaViewer;
  expect(el.shadowRoot!.textContent).to.contain('Circular');
  await expect(el).shadowDom.to.be.accessible();
});

