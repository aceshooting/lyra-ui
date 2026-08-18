import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './schema-viewer.js';
import type { JsonSchemaNode, LyraJsonSchemaViewer, SchemaValidationIssue } from './schema-viewer.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

it('registers as lr-json-schema-viewer, freeing the generic lr-schema-viewer tag', async () => {
  const el = (await fixture(html`<lr-json-schema-viewer></lr-json-schema-viewer>`)) as LyraJsonSchemaViewer;
  expect(el.constructor.name).to.equal('LyraJsonSchemaViewer');
  expect(customElements.get('lr-schema-viewer')).to.be.undefined;
});

function sinkTexts(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"] > div`),
    (node) => node.textContent ?? '',
  );
}

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
    html`<lr-json-schema-viewer
      .schema=${schema}
      .issues=${[{ path: '/properties/query', message: 'Query is required', severity: 'error' }]}
    ></lr-json-schema-viewer>`,
  )) as LyraJsonSchemaViewer;
  expect(el.shadowRoot!.querySelectorAll('[part~="node"]').length).to.be.greaterThan(2);
  expect(el.shadowRoot!.textContent).to.contain('Search query');
  expect(el.shadowRoot!.textContent).to.contain('Required');
  expect(el.shadowRoot!.textContent).to.contain('Query is required');
});

it('emits the selected JSON Pointer and record', async () => {
  const el = (await fixture(html`<lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>`)) as LyraJsonSchemaViewer;
  const pending = oneEvent(el, 'lr-schema-select');
  (el.shadowRoot!.querySelector('[data-path="/properties/query"]') as HTMLButtonElement).click();
  expect((await pending).detail).to.deep.equal({ schemaPath: '/properties/query', schema: schema.properties.query });
});

it('fails closed for malformed/circular input and is accessible', async () => {
  const circular: Record<string, unknown> = { type: 'object' };
  circular['properties'] = { self: circular };
  const el = (await fixture(html`<lr-json-schema-viewer .schema=${circular}></lr-json-schema-viewer>`)) as LyraJsonSchemaViewer;
  expect(el.shadowRoot!.textContent).to.contain('Circular');
  await expect(el).shadowDom.to.be.accessible();
});

it('renders supported composition and item branches while safely ignoring malformed caller entries', async () => {
  const composite: JsonSchemaNode = {
    type: 'array',
    title: 'Payload',
    allOf: [{ type: 'object', properties: { stable: { type: 'string' } } }],
    anyOf: [{ type: 'number' }],
    oneOf: [undefined as unknown as JsonSchemaNode],
    items: { type: 'string' },
    enum: ['compact', 'full'],
    $ref: '#/$defs/payload',
  };
  const issues = [
    undefined as unknown as SchemaValidationIssue,
    { path: '/items', message: 'Each item needs a name', severity: 'warning' as const },
  ];
  const el = (await fixture(html`
    <lr-json-schema-viewer .schema=${composite} .issues=${issues}></lr-json-schema-viewer>
  `)) as LyraJsonSchemaViewer;

  const paths = Array.from(
    el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-path]'),
    (button) => button.dataset['path'],
  );
  expect(paths).to.include.members(['/allOf/0', '/anyOf/0', '/items']);
  expect(el.shadowRoot!.textContent).to.contain('enum: ["compact", "full"]');
  expect(el.shadowRoot!.textContent).to.contain('$ref: #/$defs/payload');
  expect(el.shadowRoot!.querySelectorAll('[part="issue"]').length).to.equal(1);
});

it('formats const/default/examples constraint values, including nested objects and bounded truncation', async () => {
  const withValues: JsonSchemaNode = {
    type: 'string',
    const: 'locked-value',
    default: { nested: { a: 1 } },
    examples: ['one', 'two', 'three', 'four'],
  };
  const el = await fixture<LyraJsonSchemaViewer>(html`
    <lr-json-schema-viewer .schema=${withValues}></lr-json-schema-viewer>
  `);
  const text = el.shadowRoot!.textContent ?? '';
  expect(text).to.contain('const: "locked-value"');
  expect(text).to.contain('default: {"nested": {"a": 1}}');
  expect(text).to.contain('examples: ["one", "two", "three", "four"]');

  const manyExamples: JsonSchemaNode = {
    type: 'string',
    examples: Array.from({ length: 52 }, (_, index) => `ex${index}`),
  };
  const truncated = await fixture<LyraJsonSchemaViewer>(html`
    <lr-json-schema-viewer .schema=${manyExamples}></lr-json-schema-viewer>
  `);
  const truncatedText = truncated.shadowRoot!.textContent ?? '';
  expect(truncatedText).to.contain('"ex49"');
  expect(truncatedText).to.not.contain('"ex50"');
  expect(truncatedText).to.contain(', …]');
});

it('renders [Circular] for a self-referencing constraint value and collapses an object nested past depth 3', async () => {
  const circularDefault: Record<string, unknown> = {};
  circularDefault['self'] = circularDefault;
  const deep = { a: { b: { c: { d: 'too-deep' } } } };
  const schemaWithHostileValues: JsonSchemaNode = {
    type: 'object',
    const: 10n as unknown,
    default: circularDefault,
    examples: [deep],
  };
  const el = await fixture<LyraJsonSchemaViewer>(html`
    <lr-json-schema-viewer .schema=${schemaWithHostileValues}></lr-json-schema-viewer>
  `);
  const text = el.shadowRoot!.textContent ?? '';
  expect(text).to.contain('const: 10n');
  expect(text).to.contain('default: {"self": [Circular]}');
  expect(text).to.contain('examples: [{"a": {"b": {"c": {…}}}}]');
});

it('infers an implicit object type badge from properties, joins a multi-type array badge, and omits the badge entirely for a typeless leaf', async () => {
  const multiType: JsonSchemaNode = {
    properties: {
      id: { type: ['string', 'null'] },
      freeform: {},
    },
  };
  const el = await fixture<LyraJsonSchemaViewer>(html`
    <lr-json-schema-viewer .schema=${multiType}></lr-json-schema-viewer>
  `);
  const rootButton = el.shadowRoot!.querySelector('[data-path=""]') as HTMLButtonElement;
  expect(rootButton.querySelector('[part="type"]')!.textContent).to.equal('Type: object');

  const idButton = el.shadowRoot!.querySelector('[data-path="/properties/id"]') as HTMLButtonElement;
  expect(idButton.querySelector('[part="type"]')!.textContent).to.equal('Type: string | null');

  const freeformButton = el.shadowRoot!.querySelector('[data-path="/properties/freeform"]') as HTMLButtonElement;
  expect(freeformButton.querySelector('[part="type"]') === null).to.be.true;
});

it('distinguishes no selection from the empty JSON Pointer that selects the root', async () => {
  const el = await fixture<LyraJsonSchemaViewer>(html`
    <lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>
  `);
  expect(el.selectedPath).to.equal(null);
  expect(el.shadowRoot!.querySelector('[part~="node-selected"]') === null).to.be.true;

  el.selectedPath = '';
  await el.updateComplete;
  const selected = el.shadowRoot!.querySelector('[part~="node-selected"]') as HTMLElement;
  expect(selected.querySelector('[data-path]')!.getAttribute('data-path')).to.equal('');
});

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-json-schema-viewer
    .strings=${{ schemaViewerLabel: 'Localized schema browser' }}
  ></lr-json-schema-viewer>`)) as LyraJsonSchemaViewer;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Localized schema browser');
});

it('bounds broad schemas and exposes a localized truncation status', async () => {
  const properties = Object.fromEntries(
    Array.from({ length: 5_000 }, (_, index) => [`property-${index}`, { type: 'string' }]),
  );
  const el = (await fixture(html`<lr-json-schema-viewer
    .schema=${{ type: 'object', properties }}
  ></lr-json-schema-viewer>`)) as LyraJsonSchemaViewer;
  expect(el.shadowRoot!.querySelectorAll('[part~="node"]').length).to.equal(500);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal(
    'Only the first 500 schema nodes are shown.',
  );
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.getAttribute('role')).to.equal(null);
  expect(sinkTexts(), 'a schema that mounts already truncated is not a live change').to.deep.equal([]);
});

it('marks the limit when nested composition exhausts the remaining render budget during traversal', async () => {
  const branches: JsonSchemaNode[] = Array.from({ length: 498 }, (_, index) =>
    index === 0 ? { type: 'object', properties: { nested: { type: 'string' } } } : { type: 'string' },
  );
  const el = (await fixture(html`
    <lr-json-schema-viewer .schema=${{ type: 'object', properties: { payload: { allOf: branches } } }}></lr-json-schema-viewer>
  `)) as LyraJsonSchemaViewer;

  expect(el.shadowRoot!.querySelectorAll('[part~="node"]').length).to.equal(500);
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal(
    'Only the first 500 schema nodes are shown.',
  );
});

it('indexes validation issues once and bounds their rendered work independently of the node ceiling', async () => {
  const properties = Object.fromEntries(
    Array.from({ length: 499 }, (_, index) => [`property-${index}`, { type: 'string' }]),
  );
  const issues = Array.from({ length: 2_000 }, (_, index) => ({
    path: `/properties/property-${index % 499}`,
    message: `Issue ${index}`,
  }));
  let filterCalls = 0;
  const nativeFilter = issues.filter;
  issues.filter = function (...args: Parameters<typeof nativeFilter>) {
    filterCalls++;
    return nativeFilter.apply(this, args);
  };
  const el = (await fixture(html`
    <lr-json-schema-viewer .schema=${{ type: 'object', properties }} .issues=${issues}></lr-json-schema-viewer>
  `)) as LyraJsonSchemaViewer;
  expect(el.shadowRoot!.querySelectorAll('[part="issue"]').length).to.equal(500);
  expect(filterCalls).to.be.at.most(1);
  expect(el.shadowRoot!.querySelector('[part="issue-limit"]')?.textContent).to.equal(
    'Only the first 500 validation issues are shown.',
  );
  expect(el.shadowRoot!.querySelector('[part="issue-limit"]')?.getAttribute('role')).to.equal(null);
});

it('announces newly reached node and issue ceilings through the shared light-DOM sink', async () => {
  const el = (await fixture(html`<lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>`)) as LyraJsonSchemaViewer;
  const properties = Object.fromEntries(
    Array.from({ length: 600 }, (_, index) => [`property-${index}`, { type: 'string' }]),
  );
  el.schema = { type: 'object', properties };
  await el.updateComplete;
  expect(sinkTexts()).to.deep.equal(['Only the first 500 schema nodes are shown.']);

  el.issues = Array.from({ length: 501 }, (_, index) => ({
    path: `/properties/property-${index % 499}`,
    message: `Issue ${index}`,
  }));
  await el.updateComplete;
  expect(sinkTexts()).to.deep.equal([
    'Only the first 500 schema nodes are shown.',
    'Only the first 500 validation issues are shown.',
  ]);

  el.remove();
  expect(document.querySelectorAll(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`).length).to.equal(0);
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
    <lr-json-schema-viewer max-depth="10000" .schema=${root}></lr-json-schema-viewer>
  `)) as LyraJsonSchemaViewer;
  expect(el.shadowRoot!.querySelectorAll('[part~="node"]').length).to.equal(101);
});

it('renders an info-severity issue with its own styling, distinct from the danger default', async () => {
  const el = (await fixture(html`
    <lr-json-schema-viewer
      .schema=${schema}
      .issues=${[
        { path: '/properties/query', message: 'Defaults to the account locale', severity: 'info' },
        { path: '/properties/options', message: 'Query is required' },
      ]}
    ></lr-json-schema-viewer>
  `)) as LyraJsonSchemaViewer;
  const infoIssue = el.shadowRoot!.querySelector('[part="issue"][data-severity="info"]') as HTMLElement;
  const errorIssue = el.shadowRoot!.querySelector('[part="issue"][data-severity="error"]') as HTMLElement;
  expect((infoIssue) != null).to.equal(true);
  expect((errorIssue) != null).to.equal(true);
  expect(getComputedStyle(infoIssue).borderInlineStartColor).to.not.equal(
    getComputedStyle(errorIssue).borderInlineStartColor,
  );
});

it('allows selected and issue states to be rethemed independently', async () => {
  const el = (await fixture(html`
    <lr-json-schema-viewer
      style="
        --lr-schema-viewer-selected-border: rgb(1, 2, 3);
        --lr-schema-viewer-error-border: rgb(4, 5, 6);
      "
      selected-path="/properties/query"
      .schema=${schema}
      .issues=${[{ path: '/properties/query', message: 'Required' }]}
    ></lr-json-schema-viewer>
  `)) as LyraJsonSchemaViewer;
  const selected = el.shadowRoot!.querySelector('[part~="node-selected"]') as HTMLElement;
  const issue = el.shadowRoot!.querySelector('[part="issue"]') as HTMLElement;
  expect(getComputedStyle(selected).borderInlineStartColor).to.equal('rgb(1, 2, 3)');
  expect(getComputedStyle(issue).borderInlineStartColor).to.equal('rgb(4, 5, 6)');
});

it('uses break-word, not anywhere, on name/description/issue text', async () => {
  const el = (await fixture(
    html`<lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>`,
  )) as LyraJsonSchemaViewer;
  await el.updateComplete;
  const name = el.shadowRoot!.querySelector('[part="name"]') as HTMLElement;
  expect(getComputedStyle(name).overflowWrap).to.equal('break-word');
});
