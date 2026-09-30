import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './schema-viewer.js';
import type { JsonSchemaNode, LyraJsonSchemaViewer } from './schema-viewer.js';

it('retains a selected leaf through every composition and item kind after the ordinary render budget is spent', async () => {
  const leaf = { type: 'string', description: 'Selected tuple descendant' };
  const path = '/allOf/0/anyOf/0/oneOf/0/items/1/items/properties/leaf~1~0';
  const schema: JsonSchemaNode = {
    properties: Object.fromEntries(Array.from({ length: 600 }, (_, i) => [`noise-${i}`, { type: 'number' }])),
    allOf: [{ anyOf: [{ oneOf: [{ items: [{ type: 'boolean' }, { items: { properties: { 'leaf/~': leaf } } }] }] }] }],
  };
  const element = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer .schema=${schema} .selectedPath=${path}></lr-json-schema-viewer>`);
  const selected = element.shadowRoot!.querySelector<HTMLButtonElement>('[aria-pressed="true"]');
  expect(selected?.dataset['path']).to.equal(path);
  expect(selected?.getBoundingClientRect().height).to.be.greaterThan(0);
  expect(element.shadowRoot!.querySelectorAll('[part~="node"]').length).to.equal(500);
  expect(element.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.contain('500');
  const pending = oneEvent(element, 'lr-schema-select');
  selected!.click();
  const event = await pending;
  expect(event.detail.schemaPath).to.equal(path);
  expect(event.detail.schema.description).to.equal(leaf.description);
  expect(Object.isFrozen(event.detail.schema)).to.equal(true);
});

it('does not manufacture selection for missing composition entries, tuple holes, cycles or a depth-limited descendant', async () => {
  const cyclic: { type: string; items?: JsonSchemaNode } = { type: 'array' };
  cyclic.items = cyclic;
  const tuple = new Array<JsonSchemaNode>(2);
  tuple[1] = { items: { type: 'string' } };
  const schema: JsonSchemaNode = { allOf: [{ items: tuple }], anyOf: [{ type: 'number' }], oneOf: [{ type: 'boolean' }], items: cyclic };
  const element = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>`);
  for (const path of ['/allOf', '/allOf/no', '/allOf/8', '/anyOf/8', '/oneOf/8', '/allOf/0/items', '/allOf/0/items/0', '/allOf/0/items/8', '/items/items']) {
    element.selectedPath = path;
    await element.updateComplete;
    expect(element.shadowRoot!.querySelectorAll('[aria-pressed="true"]').length, path).to.equal(0);
  }
  element.maxDepth = 1;
  element.selectedPath = '/allOf/0/items/1/items';
  await element.updateComplete;
  expect(element.shadowRoot!.querySelectorAll('[aria-pressed="true"]').length).to.equal(0);
  expect(element.shadowRoot!.querySelector('[data-path="/allOf/0"]')?.getAttribute('aria-pressed')).to.equal('false');
});

it('contains reflection failures in ordinary keyword values and composition arrays while preserving later valid properties', async () => {
  const brokenRecord = new Proxy({ secret: 'not rendered' }, { ownKeys() { throw new Error('reflection unavailable'); } });
  const brokenArray = new Proxy([{ type: 'string' }], { getOwnPropertyDescriptor() { throw new Error('descriptor unavailable'); } });
  const revokedArray = Proxy.revocable([], {});
  revokedArray.revoke();
  const element = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer .schema=${{
    type: 'object', default: brokenRecord, enum: brokenArray, allOf: brokenArray,
    anyOf: revokedArray.proxy, properties: { good: { type: 'string', description: 'Safe neighbor' } },
  } as JsonSchemaNode}></lr-json-schema-viewer>`);
  expect(element.schema?.default).to.equal(undefined);
  expect(element.schema?.enum).to.equal(undefined);
  expect(element.schema?.allOf).to.equal(undefined);
  expect(element.schema?.anyOf).to.equal(undefined);
  expect(element.shadowRoot!.textContent).to.contain('Safe neighbor');
  expect(element.shadowRoot!.textContent).not.to.contain('not rendered');
});

it('rolls back schema branches whose own descriptors become unreadable during enumeration', async () => {
  function unstable<T extends object>(value: T, key: string): T {
    let reads = 0;
    return new Proxy(value, {
      getOwnPropertyDescriptor(target, property) {
        if (property === key && ++reads === 2) throw new Error('descriptor changed while being projected');
        return Reflect.getOwnPropertyDescriptor(target, property);
      },
    });
  }
  const element = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer .schema=${{
    default: unstable({ value: 'discarded' }, 'value'),
    examples: unstable(['discarded'], '0'),
    allOf: unstable([{ type: 'string' }], '0'),
    anyOf: [{ properties: unstable({ missing: { type: 'number' } }, 'missing') }],
    properties: { rejected: unstable({ type: 'number' }, 'type'), safe: { description: 'Later usable sibling' } },
  }}></lr-json-schema-viewer>`);
  expect(element.schema?.default).to.equal(undefined);
  expect(element.schema?.examples).to.equal(undefined);
  expect(element.schema?.allOf).to.equal(undefined);
  expect(element.schema?.anyOf?.[0]?.properties).to.equal(undefined);
  expect(element.schema?.properties?.['rejected']).to.equal(undefined);
  expect(element.shadowRoot!.textContent).to.contain('Later usable sibling');
  expect(element.shadowRoot!.textContent).not.to.contain('discarded');
});

it('omits unsupported nested keyword values while preserving sparse positions and ordinary siblings', async () => {
  const untrustedPrototype = Object.create(null) as Record<string, unknown>;
  untrustedPrototype['constructor'] = 'not a constructor';
  const malformed = Object.create(untrustedPrototype) as JsonSchemaNode;
  const element = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer .schema=${{
    default: { rejected: () => 'not serializable', kept: 3 },
    examples: [() => 'not serializable', 'safe example'],
    properties: { rejected: malformed, safe: { type: 'string' } },
    anyOf: [{ properties: 12 }],
  }}></lr-json-schema-viewer>`);
  expect(element.schema?.default).to.deep.equal({ kept: 3 });
  expect(Object.hasOwn(element.schema?.examples ?? [], '0')).to.equal(false);
  expect(element.schema?.examples?.[1]).to.equal('safe example');
  expect(element.schema?.properties?.['rejected']).to.equal(undefined);
  expect(element.schema?.properties?.['safe']?.type).to.equal('string');
  expect(element.schema?.anyOf?.[0]?.properties).to.equal(undefined);
});
