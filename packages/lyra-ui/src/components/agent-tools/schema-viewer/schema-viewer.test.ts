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

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-schema-viewer
    .strings=${{ schemaViewerLabel: 'Localized schema browser' }}
  ></lr-schema-viewer>`)) as LyraSchemaViewer;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Localized schema browser');
});

it('bounds broad schemas and exposes a localized truncation status', async () => {
  const properties = Object.fromEntries(
    Array.from({ length: 5_000 }, (_, index) => [`property-${index}`, { type: 'string' }]),
  );
  const el = (await fixture(html`<lr-schema-viewer
    .schema=${{ type: 'object', properties }}
  ></lr-schema-viewer>`)) as LyraSchemaViewer;
  expect(el.shadowRoot!.querySelectorAll('[part~="node"]').length).to.equal(500);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal(
    'Only the first 500 schema nodes are shown.',
  );
});

it('clamps a hostile maxDepth request so deeply nested schemas stay stack-safe', async () => {
  const root: Record<string, unknown> = { type: 'object', properties: {} };
  let current = root;
  for (let index = 0; index < 1_000; index++) {
    const child: Record<string, unknown> = { type: 'object', properties: {} };
    current['properties'] = { child };
    current = child;
  }
  const el = (await fixture(html`
    <lr-schema-viewer max-depth="10000" .schema=${root}></lr-schema-viewer>
  `)) as LyraSchemaViewer;
  expect(el.shadowRoot!.querySelectorAll('[part~="node"]').length).to.equal(101);
});

it('allows selected and issue states to be rethemed independently', async () => {
  const el = (await fixture(html`
    <lr-schema-viewer
      style="
        --lr-schema-viewer-selected-border: rgb(1, 2, 3);
        --lr-schema-viewer-error-border: rgb(4, 5, 6);
      "
      selected-path="/properties/query"
      .schema=${schema}
      .issues=${[{ path: '/properties/query', message: 'Required' }]}
    ></lr-schema-viewer>
  `)) as LyraSchemaViewer;
  const selected = el.shadowRoot!.querySelector('[part~="node-selected"]') as HTMLElement;
  const issue = el.shadowRoot!.querySelector('[part="issue"]') as HTMLElement;
  expect(getComputedStyle(selected).borderInlineStartColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(issue).borderInlineStartColor).to.equal('rgb(4, 5, 6)');
});
