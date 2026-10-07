import { sinkTexts } from '../../../../test/announcements.js';
import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import './schema-viewer.js';
import type {
  JsonSchemaNode,
  LyraJsonSchemaViewer,
  SchemaValidationIssue,
} from './schema-viewer.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import { sendKeys } from '@web/test-runner-commands';
import { render } from 'lit';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

it('registers as lr-json-schema-viewer, freeing the generic lr-schema-viewer tag', async () => {
  const el = (await fixture(
    html`<lr-json-schema-viewer></lr-json-schema-viewer>`
  )) as LyraJsonSchemaViewer;
  expect(el.constructor.name).to.equal('LyraJsonSchemaViewer');
  expect(customElements.get('lr-schema-viewer')).to.be.undefined;
});

const schema = {
  type: 'object',
  title: 'Search arguments',
  required: ['query'],
  properties: {
    query: { type: 'string', description: 'Search query' },
    options: {
      type: 'object',
      properties: { limit: { type: 'integer', minimum: 1 } },
    },
  },
};

it('treats Swagger-style non-array required values as no required-property list', async () => {
  for (const required of [true, 'query']) {
    const el = await fixture<LyraJsonSchemaViewer>(html`
      <lr-json-schema-viewer
        .schema=${{
          type: 'object',
          required,
          properties: { query: { type: 'string' } },
        } as unknown as JsonSchemaNode}
      ></lr-json-schema-viewer>
    `);
    expect(el.shadowRoot!.querySelectorAll('[part="node"]')).to.have.lengthOf(
      2
    );
    expect(
      el.shadowRoot!.querySelectorAll('[part="required"]')
    ).to.have.lengthOf(0);
  }
});

it('renders nested JSON Schema structure, constraints, required state, and validation issues', async () => {
  const el = (await fixture(
    html`<lr-json-schema-viewer
      .schema=${schema}
      .issues=${[
        {
          path: '/properties/query',
          message: 'Query is required',
          severity: 'error',
        },
      ]}
    ></lr-json-schema-viewer>`
  )) as LyraJsonSchemaViewer;
  expect(
    el.shadowRoot!.querySelectorAll('[part~="node"]').length
  ).to.be.greaterThan(2);
  expect(el.shadowRoot!.textContent).to.contain('Search query');
  expect(el.shadowRoot!.textContent).to.contain('Required');
  expect(el.shadowRoot!.textContent).to.contain('Query is required');
  // The only other axe assertion in this file targets the malformed/circular-schema fallback --
  // this is the fully-populated nested-schema-with-required-fields-and-validation-issues state a
  // real consumer's schema viewer is in most of the time.
  await expect(el).shadowDom.to.be.accessible();
});

it('emits the selected JSON Pointer and record', async () => {
  const el = (await fixture(
    html`<lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>`
  )) as LyraJsonSchemaViewer;
  const pending = oneEvent(el, 'lr-schema-select');
  (
    el.shadowRoot!.querySelector(
      '[data-path="/properties/query"]'
    ) as HTMLButtonElement
  ).click();
  expect((await pending).detail).to.deep.equal({
    schemaPath: '/properties/query',
    schema: schema.properties.query,
  });
});

it('fails closed for malformed/circular input and is accessible', async () => {
  const circular: Record<string, unknown> = { type: 'object' };
  circular['properties'] = { self: circular };
  const el = (await fixture(
    html`<lr-json-schema-viewer .schema=${circular}></lr-json-schema-viewer>`
  )) as LyraJsonSchemaViewer;
  expect(el.shadowRoot!.textContent).to.contain('Circular');
  await expect(el).shadowDom.to.be.accessible();
});

it('normalizes a non-record schema assignment to the empty state', async () => {
  const el = (await fixture(html`
    <lr-json-schema-viewer
      .schema=${42 as unknown as JsonSchemaNode}
    ></lr-json-schema-viewer>
  `)) as LyraJsonSchemaViewer;
  expect(el.schema).to.equal(null);
  expect(el.shadowRoot!.querySelector('[part="empty"]')).to.exist;
});

it('takes a descriptor-safe, recursively detached schema snapshot without filling sparse indexes', () => {
  let getterCalls = 0;
  const source = Object.create(null) as Record<string, unknown>;
  const sourceProperties = Object.create(null) as Record<string, unknown>;
  const sourceNode = Object.create(null) as Record<string, unknown>;
  const sourceExample = Object.create(null) as Record<string, unknown>;
  const sourceNestedExample = Object.create(null) as Record<string, unknown>;
  const examples = new Array<unknown>(4);
  const items = new Array<JsonSchemaNode>(3);
  sourceNestedExample['value'] = 'before';
  sourceExample['answer'] = 'before';
  sourceExample['nested'] = sourceNestedExample;
  examples[1] = sourceExample;
  examples[3] = ['last'];
  sourceNode['type'] = 'string';
  sourceNode['examples'] = examples;
  sourceProperties['query'] = sourceNode;
  items[1] = sourceNode as JsonSchemaNode;
  source['type'] = 'object';
  source['properties'] = sourceProperties;
  source['items'] = items;
  source['default'] = source;
  Object.defineProperty(source, '__proto__', {
    configurable: true,
    enumerable: true,
    value: { type: 'number' },
    writable: true,
  });
  Object.defineProperty(source, 'unsafe', {
    configurable: true,
    enumerable: true,
    get: () => {
      getterCalls += 1;
      throw new Error('schema getter must stay unread');
    },
  });

  const el = document.createElement(
    'lr-json-schema-viewer'
  ) as LyraJsonSchemaViewer;
  let assignmentError: unknown;
  try {
    el.schema = source as JsonSchemaNode;
  } catch (error) {
    assignmentError = error;
  }
  expect(assignmentError === undefined).to.equal(true);

  const snapshot = el.schema as unknown as Record<string, unknown>;
  const properties = snapshot['properties'] as Record<string, unknown>;
  const query = properties['query'] as Record<string, unknown>;
  const snapshotExamples = query['examples'] as unknown[];
  const snapshotItems = snapshot['items'] as unknown[];
  const protoDescriptor = Object.getOwnPropertyDescriptor(
    snapshot,
    '__proto__'
  );

  expect(getterCalls).to.equal(0);
  expect(Object.getPrototypeOf(snapshot) === null).to.equal(true);
  expect(Object.getPrototypeOf(properties) === null).to.equal(true);
  expect(Object.getPrototypeOf(query) === null).to.equal(true);
  expect(Object.prototype.hasOwnProperty.call(snapshot, 'unsafe')).to.equal(
    false
  );
  expect(protoDescriptor !== undefined && 'value' in protoDescriptor).to.equal(
    true
  );
  expect(protoDescriptor?.value === source['__proto__']).to.equal(false);
  expect(snapshot['default'] === snapshot).to.equal(true);
  expect(snapshotExamples.length).to.equal(4);
  expect(0 in snapshotExamples).to.equal(false);
  expect(1 in snapshotExamples).to.equal(true);
  expect(2 in snapshotExamples).to.equal(false);
  expect(3 in snapshotExamples).to.equal(true);
  expect(snapshotExamples[1] === sourceExample).to.equal(false);
  expect(
    (snapshotExamples[1] as Record<string, unknown>)['nested'] ===
      sourceNestedExample
  ).to.equal(false);
  expect(snapshotItems.length).to.equal(3);
  expect(0 in snapshotItems).to.equal(false);
  expect(1 in snapshotItems).to.equal(true);
  expect(2 in snapshotItems).to.equal(false);
  expect(Object.isFrozen(snapshot)).to.equal(true);
  expect(Object.isFrozen(properties)).to.equal(true);
  expect(Object.isFrozen(query)).to.equal(true);
  expect(Object.isFrozen(snapshotExamples)).to.equal(true);
  expect(Object.isFrozen(snapshotExamples[1] as object)).to.equal(true);
  expect(
    Object.isFrozen(
      (snapshotExamples[1] as Record<string, unknown>)['nested'] as object
    )
  ).to.equal(true);
  expect(Object.isFrozen(snapshotItems)).to.equal(true);

  sourceNode['type'] = 'number';
  sourceExample['answer'] = 'after';
  sourceNestedExample['value'] = 'after';
  expect(query['type']).to.equal('string');
  expect((snapshotExamples[1] as Record<string, unknown>)['answer']).to.equal(
    'before'
  );
  expect(
    (
      (snapshotExamples[1] as Record<string, unknown>)['nested'] as Record<
        string,
        unknown
      >
    )['value']
  ).to.equal('before');
});

it('omits only unsafe descriptor, reflection, function, and custom-prototype branches', () => {
  let getterCalls = 0;
  const properties = Object.create(null) as Record<string, unknown>;
  const revocable = Proxy.revocable({ type: 'string' }, {});
  const reflectionFailure = new Proxy(
    { type: 'string' },
    {
      ownKeys: () => {
        throw new Error('schema proxy reflection must stay contained');
      },
    }
  );
  const customPrototype = Object.create({ inherited: true }) as Record<
    string,
    unknown
  >;
  customPrototype['type'] = 'boolean';
  Object.defineProperty(properties, 'getter', {
    configurable: true,
    enumerable: true,
    get: () => {
      getterCalls += 1;
      throw new Error('property getter must stay unread');
    },
  });
  properties['reflectionFailure'] = reflectionFailure;
  revocable.revoke();
  properties['revoked'] = revocable.proxy;
  properties['customPrototype'] = customPrototype;
  properties['function'] = () => 'unsupported';
  properties['valid'] = { type: 'number', default: { value: 1 } };

  const el = document.createElement(
    'lr-json-schema-viewer'
  ) as LyraJsonSchemaViewer;
  let assignmentError: unknown;
  try {
    el.schema = { type: 'object', properties } as JsonSchemaNode;
  } catch (error) {
    assignmentError = error;
  }
  expect(assignmentError === undefined).to.equal(true);

  const snapshotProperties = (el.schema!.properties ?? {}) as Record<
    string,
    unknown
  >;
  const valid = snapshotProperties['valid'] as Record<string, unknown>;
  expect(getterCalls).to.equal(0);
  expect(
    Object.prototype.hasOwnProperty.call(snapshotProperties, 'getter')
  ).to.equal(false);
  expect(
    Object.prototype.hasOwnProperty.call(
      snapshotProperties,
      'reflectionFailure'
    )
  ).to.equal(false);
  expect(
    Object.prototype.hasOwnProperty.call(snapshotProperties, 'revoked')
  ).to.equal(false);
  expect(
    Object.prototype.hasOwnProperty.call(snapshotProperties, 'customPrototype')
  ).to.equal(false);
  expect(
    Object.prototype.hasOwnProperty.call(snapshotProperties, 'function')
  ).to.equal(false);
  expect(
    Object.prototype.hasOwnProperty.call(snapshotProperties, 'valid')
  ).to.equal(true);
  expect(valid === properties['valid']).to.equal(false);
  expect(Object.isFrozen(valid)).to.equal(true);
  expect(Object.isFrozen(valid['default'] as object)).to.equal(true);
});

it('rolls back a rejected deep branch so later valid siblings reclaim its node budget and seen mappings', () => {
  let sharedType = 'string';
  const shared = new Proxy<JsonSchemaNode>(
    { type: 'string' },
    {
      getOwnPropertyDescriptor: (target, key) =>
        key === 'type'
          ? {
              configurable: true,
              enumerable: true,
              value: sharedType,
              writable: true,
            }
          : Reflect.getOwnPropertyDescriptor(target, key),
    }
  );
  const failingTarget = Object.create(null) as Record<string, JsonSchemaNode>;
  for (let index = 0; index < 49_997; index += 1) {
    failingTarget[`occupied-${index}`] =
      index === 0 ? shared : { type: 'string' };
  }
  failingTarget['unsafe'] = { type: 'string' };
  const failingProperties = new Proxy(failingTarget, {
    getOwnPropertyDescriptor: (target, key) => {
      if (key === 'unsafe') {
        sharedType = 'number';
        throw new Error('deep reflection failure');
      }
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const el = document.createElement(
    'lr-json-schema-viewer'
  ) as LyraJsonSchemaViewer;
  let assignmentError: unknown;
  try {
    el.schema = {
      type: 'object',
      properties: {
        failed: { type: 'object', properties: failingProperties },
        valid: shared,
        later: { type: 'boolean' },
      },
    };
  } catch (error) {
    assignmentError = error;
  }
  expect(assignmentError === undefined).to.equal(true);

  const snapshotProperties = el.schema!.properties!;
  expect(
    Object.prototype.hasOwnProperty.call(snapshotProperties, 'failed')
  ).to.equal(true);
  expect(
    Object.prototype.hasOwnProperty.call(snapshotProperties, 'valid')
  ).to.equal(true);
  expect(
    Object.prototype.hasOwnProperty.call(snapshotProperties, 'later')
  ).to.equal(true);
  expect(
    Object.prototype.hasOwnProperty.call(
      snapshotProperties['failed']!,
      'properties'
    )
  ).to.equal(false);
  expect(snapshotProperties['valid']!.type).to.equal('number');
  expect(Object.keys(snapshotProperties).length).to.equal(3);
});

it('bounds a pathological schema snapshot before it is ever mounted or rendered', () => {
  const el = document.createElement(
    'lr-json-schema-viewer'
  ) as LyraJsonSchemaViewer;
  const properties = Object.fromEntries(
    Array.from({ length: 50_001 }, (_, index) => [
      `property-${index}`,
      { type: 'string' },
    ])
  );
  el.schema = { type: 'object', properties };

  expect(Object.keys(el.schema!.properties!).length).to.equal(49_999);
  expect(Object.isFrozen(el.schema)).to.equal(true);
  expect(el.isConnected).to.equal(false);
});

it('bounds giant sparse positional arrays before rendering their admitted prefix', async () => {
  const tupleItems: JsonSchemaNode[] = [];
  tupleItems[0] = { type: 'string' };
  tupleItems[49_999] = { type: 'number' };
  tupleItems.length = 0xffff_ffff;
  tupleItems[0xffff_fffe] = { type: 'boolean' };

  const examples: unknown[] = [];
  examples[0] = 'first';
  examples[49_999] = 'last admitted';
  examples.length = 0xffff_ffff;
  examples[0xffff_fffe] = 'tail omitted';

  const source = {
    type: 'array',
    examples,
    items: tupleItems,
  } as unknown as JsonSchemaNode;
  const unmounted = document.createElement(
    'lr-json-schema-viewer'
  ) as LyraJsonSchemaViewer;
  unmounted.schema = source;

  const snapshotItems = unmounted.schema!.items;
  const snapshotExamples = unmounted.schema!.examples;
  expect(Array.isArray(snapshotItems)).to.equal(true);
  expect(Array.isArray(snapshotExamples)).to.equal(true);
  if (!Array.isArray(snapshotItems) || !Array.isArray(snapshotExamples))
    return;

  expect(snapshotItems.length).to.equal(50_000);
  expect(snapshotExamples.length).to.equal(50_000);
  expect(0 in snapshotItems).to.equal(true);
  expect(49_999 in snapshotItems).to.equal(true);
  expect(0xffff_fffe in snapshotItems).to.equal(false);
  expect(0 in snapshotExamples).to.equal(true);
  expect(49_999 in snapshotExamples).to.equal(true);
  expect(0xffff_fffe in snapshotExamples).to.equal(false);

  const el = await fixture<LyraJsonSchemaViewer>(html`
    <lr-json-schema-viewer .schema=${source}></lr-json-schema-viewer>
  `);
  const paths = Array.from(
    el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-path]'),
    (button) => button.dataset['path']
  );
  expect(paths).to.include.members(['/items/0', '/items/49999']);
  expect(paths).to.not.include('/items/4294967294');
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
    {
      path: '/items',
      message: 'Each item needs a name',
      severity: 'warning' as const,
    },
  ];
  const el = (await fixture(html`
    <lr-json-schema-viewer
      .schema=${composite}
      .issues=${issues}
    ></lr-json-schema-viewer>
  `)) as LyraJsonSchemaViewer;

  const paths = Array.from(
    el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-path]'),
    (button) => button.dataset['path']
  );
  expect(paths).to.include.members(['/allOf/0', '/anyOf/0', '/items']);
  expect(el.shadowRoot!.textContent).to.contain('enum: ["compact", "full"]');
  expect(el.shadowRoot!.textContent).to.contain('$ref: #/$defs/payload');
  expect(el.shadowRoot!.querySelectorAll('[part="issue"]').length).to.equal(1);
});

it('retains tuple indexes while leaving malformed tuple entries as owned-snapshot holes', async () => {
  const tupleSchema: JsonSchemaNode = {
    type: 'array',
    items: [
      { type: 'string', title: 'First' },
      null as unknown as JsonSchemaNode,
      { type: 'integer', title: 'Third' },
    ],
  };
  const el = await fixture<LyraJsonSchemaViewer>(html`
    <lr-json-schema-viewer .schema=${tupleSchema}></lr-json-schema-viewer>
  `);

  const paths = Array.from(
    el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[data-path]'),
    (button) => button.dataset['path']
  );
  expect(paths).to.include.members(['/items/0', '/items/2']);
  expect(paths).to.not.include('/items/1');
  expect(
    el.shadowRoot!.querySelector('[data-path="/items/0"]')!.textContent
  ).to.contain('Type: string');
  expect(
    el.shadowRoot!.querySelector('[data-path="/items/2"]')!.textContent
  ).to.contain('Type: integer');
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
    <lr-json-schema-viewer
      .schema=${schemaWithHostileValues}
    ></lr-json-schema-viewer>
  `);
  const text = el.shadowRoot!.textContent ?? '';
  expect(text).to.contain('const: 10n');
  expect(text).to.contain('default: {"self": [Circular]}');
  expect(text).to.contain('examples: [{"a": {"b": {"c": {…}}}}]');
});

it('bounds array and object constraint formatting across primitive and hostile value kinds', async () => {
  const manyValues: unknown[] = [
    null,
    'text',
    3,
    true,
    4n,
    undefined,
    Symbol('symbol'),
  ];
  manyValues.push(...Array.from({ length: 50 }, (_, index) => ({ index })));
  const manyEntries = Object.fromEntries(
    Array.from({ length: 52 }, (_, index) => [`key-${index}`, index])
  );
  const el = await fixture<LyraJsonSchemaViewer>(html`
    <lr-json-schema-viewer
      .schema=${{
        type: 'object',
        const: manyEntries,
        default: manyValues,
        examples: [[1, 2]],
        enum: Array.from({ length: 51 }, (_, index) => `choice-${index}`),
      }}
    ></lr-json-schema-viewer>
  `);

  const text = el.shadowRoot!.textContent ?? '';
  expect(text).to.contain('null');
  expect(text).to.contain('undefined');
  expect(text).to.contain('Symbol(symbol)');
  expect(text).to.contain('examples: [[1, 2]]');
  expect(text).to.contain('choice-49');
  expect(text).to.not.contain('choice-50');
  expect(text).to.contain('…');
  expect(text).to.not.contain('key-51');
});

it('ignores inherited schema properties while retaining own properties', async () => {
  const inheritedDescriptor = Object.getOwnPropertyDescriptor(
    Object.prototype,
    'schemaViewerInherited'
  );
  Object.defineProperty(Object.prototype, 'schemaViewerInherited', {
    configurable: true,
    enumerable: true,
    value: { type: 'number' },
    writable: true,
  });
  try {
    const properties = { own: { type: 'string' } } as Record<
      string,
      JsonSchemaNode
    >;
    const el = await fixture<LyraJsonSchemaViewer>(html`
      <lr-json-schema-viewer
        .schema=${{ type: 'object', properties }}
      ></lr-json-schema-viewer>
    `);

    expect(
      el.shadowRoot!.querySelectorAll('[data-path="/properties/own"]')
    ).to.have.length(1);
    expect(
      el.shadowRoot!.querySelectorAll(
        '[data-path="/properties/schemaViewerInherited"]'
      )
    ).to.have.length(0);
  } finally {
    if (inheritedDescriptor) {
      Object.defineProperty(
        Object.prototype,
        'schemaViewerInherited',
        inheritedDescriptor
      );
    } else {
      delete (Object.prototype as Record<string, unknown>)[
        'schemaViewerInherited'
      ];
    }
  }
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
  const rootButton = el.shadowRoot!.querySelector(
    '[data-path=""]'
  ) as HTMLButtonElement;
  expect(rootButton.querySelector('[part="type"]')!.textContent).to.equal(
    'Type: object'
  );

  const idButton = el.shadowRoot!.querySelector(
    '[data-path="/properties/id"]'
  ) as HTMLButtonElement;
  expect(idButton.querySelector('[part="type"]')!.textContent).to.equal(
    'Type: string | null'
  );

  const freeformButton = el.shadowRoot!.querySelector(
    '[data-path="/properties/freeform"]'
  ) as HTMLButtonElement;
  expect(freeformButton.querySelector('[part="type"]') === null).to.be.true;
});

it('distinguishes no selection from the empty JSON Pointer that selects the root', async () => {
  const el = await fixture<LyraJsonSchemaViewer>(html`
    <lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>
  `);
  expect(el.selectedPath).to.equal(null);
  expect(el.shadowRoot!.querySelector('[part~="node-selected"]') === null).to.be
    .true;

  el.selectedPath = '';
  await el.updateComplete;
  const selected = el.shadowRoot!.querySelector(
    '[part~="node-selected"]'
  ) as HTMLElement;
  expect(
    selected.querySelector('[data-path]')!.getAttribute('data-path')
  ).to.equal('');
});

it('applies per-instance localized strings', async () => {
  const el = (await fixture(html`<lr-json-schema-viewer
    .strings=${{ schemaViewerLabel: 'Localized schema browser' }}
  ></lr-json-schema-viewer>`)) as LyraJsonSchemaViewer;
  expect(
    el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')
  ).to.equal('Localized schema browser');
});

it('bounds broad schemas and exposes a localized truncation status', async () => {
  const properties = Object.fromEntries(
    Array.from({ length: 5_000 }, (_, index) => [
      `property-${index}`,
      { type: 'string' },
    ])
  );
  const el = (await fixture(html`<lr-json-schema-viewer
    .schema=${{ type: 'object', properties }}
  ></lr-json-schema-viewer>`)) as LyraJsonSchemaViewer;
  expect(el.shadowRoot!.querySelectorAll('[part~="node"]').length).to.equal(
    500
  );
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal(
    'Only the first 500 schema nodes are shown.'
  );
  expect(
    el.shadowRoot!.querySelector('[part="limit"]')?.getAttribute('role')
  ).to.equal(null);
  expect(
    sinkTexts(),
    'a schema that mounts already truncated is not a live change'
  ).to.deep.equal([]);
});

it('still renders a controlled selection outside the render cap as selected (regression)', async () => {
  const properties = Object.fromEntries(
    Array.from({ length: 5_000 }, (_, index) => [
      `property-${index}`,
      { type: 'string' },
    ])
  );
  const el = (await fixture(html`<lr-json-schema-viewer
    .schema=${{ type: 'object', properties }}
    selected-path="/properties/property-4999"
  ></lr-json-schema-viewer>`)) as LyraJsonSchemaViewer;
  const selected = el.shadowRoot!.querySelector('[part~="node-selected"]');
  expect(
    selected,
    'the selected node must render even past the first 500 DFS-visited nodes'
  ).to.not.equal(null);
  expect(
    selected!.querySelector('[data-path]')!.getAttribute('data-path')
  ).to.equal('/properties/property-4999');
  expect(
    selected!.querySelector('[part="node-trigger"]')!.getAttribute('aria-pressed')
  ).to.equal('true');
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal(
    'Only the first 500 schema nodes are shown.'
  );
});

it('marks the limit when nested composition exhausts the remaining render budget during traversal', async () => {
  const branches: JsonSchemaNode[] = Array.from({ length: 498 }, (_, index) =>
    index === 0
      ? { type: 'object', properties: { nested: { type: 'string' } } }
      : { type: 'string' }
  );
  const el = (await fixture(html`
    <lr-json-schema-viewer
      .schema=${{
        type: 'object',
        properties: { payload: { allOf: branches } },
      }}
    ></lr-json-schema-viewer>
  `)) as LyraJsonSchemaViewer;

  expect(el.shadowRoot!.querySelectorAll('[part~="node"]').length).to.equal(
    500
  );
  expect(el.shadowRoot!.querySelector('[part="limit"]')?.textContent).to.equal(
    'Only the first 500 schema nodes are shown.'
  );
});

it('indexes validation issues once and bounds their rendered work independently of the node ceiling', async () => {
  const properties = Object.fromEntries(
    Array.from({ length: 499 }, (_, index) => [
      `property-${index}`,
      { type: 'string' },
    ])
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
    <lr-json-schema-viewer
      .schema=${{ type: 'object', properties }}
      .issues=${issues}
    ></lr-json-schema-viewer>
  `)) as LyraJsonSchemaViewer;
  expect(el.shadowRoot!.querySelectorAll('[part="issue"]').length).to.equal(
    500
  );
  expect(filterCalls).to.be.at.most(1);
  expect(
    el.shadowRoot!.querySelector('[part="issue-limit"]')?.textContent
  ).to.equal('Only the first 500 validation issues are shown.');
  expect(
    el.shadowRoot!.querySelector('[part="issue-limit"]')?.getAttribute('role')
  ).to.equal(null);
});

it('announces newly reached node and issue ceilings through the shared light-DOM sink', async () => {
  const el = (await fixture(
    html`<lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>`
  )) as LyraJsonSchemaViewer;
  const properties = Object.fromEntries(
    Array.from({ length: 600 }, (_, index) => [
      `property-${index}`,
      { type: 'string' },
    ])
  );
  el.schema = { type: 'object', properties };
  await el.updateComplete;
  expect(sinkTexts()).to.deep.equal([
    'Only the first 500 schema nodes are shown.',
  ]);

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
  expect(
    document.querySelectorAll(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)
      .length
  ).to.equal(0);
});

it('reconnects an already-rendered tree without announcing resting limit content', async () => {
  const properties = Object.fromEntries(
    Array.from({ length: 600 }, (_, index) => [
      `property-${index}`,
      { type: 'string' },
    ])
  );
  const el = await fixture<LyraJsonSchemaViewer>(html`
    <lr-json-schema-viewer
      .schema=${{ type: 'object', properties }}
    ></lr-json-schema-viewer>
  `);
  const parent = el.parentElement!;

  el.remove();
  parent.append(el);
  await el.updateComplete;

  expect(el.shadowRoot!.querySelectorAll('[part~="node"]')).to.have.length(500);
  expect(sinkTexts()).to.deep.equal([]);
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
    <lr-json-schema-viewer
      max-depth="10000"
      .schema=${root}
    ></lr-json-schema-viewer>
  `)) as LyraJsonSchemaViewer;
  expect(el.shadowRoot!.querySelectorAll('[part~="node"]').length).to.equal(
    101
  );
});

it('renders an info-severity issue with its own styling, distinct from the danger default', async () => {
  const el = (await fixture(html`
    <lr-json-schema-viewer
      .schema=${schema}
      .issues=${[
        {
          path: '/properties/query',
          message: 'Defaults to the account locale',
          severity: 'info',
        },
        { path: '/properties/options', message: 'Query is required' },
      ]}
    ></lr-json-schema-viewer>
  `)) as LyraJsonSchemaViewer;
  const infoIssue = el.shadowRoot!.querySelector(
    '[part="issue"][data-severity="info"]'
  ) as HTMLElement;
  const errorIssue = el.shadowRoot!.querySelector(
    '[part="issue"][data-severity="error"]'
  ) as HTMLElement;
  expect(infoIssue != null).to.equal(true);
  expect(errorIssue != null).to.equal(true);
  expect(getComputedStyle(infoIssue).borderInlineStartColor).to.not.equal(
    getComputedStyle(errorIssue).borderInlineStartColor
  );
});

it('allows selected and issue states to be rethemed independently', async () => {
  const el = (await fixture(html`
    <lr-json-schema-viewer
      style="
        --lr-json-schema-viewer-selected-border: rgb(1, 2, 3);
        --lr-json-schema-viewer-error-border: rgb(4, 5, 6);
      "
      selected-path="/properties/query"
      .schema=${schema}
      .issues=${[{ path: '/properties/query', message: 'Required' }]}
    ></lr-json-schema-viewer>
  `)) as LyraJsonSchemaViewer;
  const selected = el.shadowRoot!.querySelector(
    '[part~="node-selected"]'
  ) as HTMLElement;
  const issue = el.shadowRoot!.querySelector('[part="issue"]') as HTMLElement;
  expect(getComputedStyle(selected).borderInlineStartColor).to.equal(
    'rgb(1, 2, 3)'
  );
  expect(getComputedStyle(issue).borderInlineStartColor).to.equal(
    'rgb(4, 5, 6)'
  );
});

it('uses break-word, not anywhere, on name/description/issue text', async () => {
  const el = (await fixture(
    html`<lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>`
  )) as LyraJsonSchemaViewer;
  await el.updateComplete;
  const name = el.shadowRoot!.querySelector('[part="name"]') as HTMLElement;
  expect(getComputedStyle(name).overflowWrap).to.equal('break-word');
});

describe('lr-json-schema-viewer namespaced custom properties and their deprecated --lr-schema-viewer-* aliases', () => {
  const deep = {
    type: 'object',
    properties: {
      a: { type: 'object', properties: { b: { type: 'object', properties: { c: { type: 'string' } } } } },
    },
  };
  const colourCases = [
    { name: 'selected-border', selector: '[part~="node-selected"]', read: 'borderInlineStartColor' },
    { name: 'error-border', selector: '[part="issue"][data-severity="error"]', read: 'borderInlineStartColor' },
    { name: 'error-bg', selector: '[part="issue"][data-severity="error"]', read: 'backgroundColor' },
    { name: 'warning-border', selector: '[part="issue"][data-severity="warning"]', read: 'borderInlineStartColor' },
    { name: 'warning-bg', selector: '[part="issue"][data-severity="warning"]', read: 'backgroundColor' },
    { name: 'info-border', selector: '[part="issue"][data-severity="info"]', read: 'borderInlineStartColor' },
    { name: 'info-bg', selector: '[part="issue"][data-severity="info"]', read: 'backgroundColor' },
  ] as const;
  const issues: SchemaValidationIssue[] = [
    { path: '/properties/query', message: 'Error', severity: 'error' },
    { path: '/properties/query', message: 'Warning', severity: 'warning' },
    { path: '/properties/query', message: 'Info', severity: 'info' },
  ];

  async function paint(style: string): Promise<LyraJsonSchemaViewer> {
    return fixture<LyraJsonSchemaViewer>(html`
      <lr-json-schema-viewer
        style=${style}
        selected-path="/properties/query"
        .schema=${schema}
        .issues=${issues}
      ></lr-json-schema-viewer>
    `);
  }

  for (const { name, selector, read } of colourCases) {
    it(`reads --lr-json-schema-viewer-${name}, falls back to --lr-schema-viewer-${name}, and lets the canonical name win`, async () => {
      const value = (el: LyraJsonSchemaViewer): string =>
        getComputedStyle(el.shadowRoot!.querySelector(selector) as HTMLElement)[read];
      const canonical = await paint(`--lr-json-schema-viewer-${name}: rgb(1, 2, 3)`);
      const alias = await paint(`--lr-schema-viewer-${name}: rgb(1, 2, 3)`);
      const both = await paint(`--lr-json-schema-viewer-${name}: rgb(4, 5, 6); --lr-schema-viewer-${name}: rgb(1, 2, 3)`);
      expect(value(canonical)).to.equal('rgb(1, 2, 3)');
      expect(value(alias)).to.not.equal('rgb(1, 2, 3)');
      expect(value(both)).to.equal('rgb(4, 5, 6)');
    });
  }

  it('reads --lr-json-schema-viewer-max-indent, falls back to --lr-schema-viewer-max-indent, and lets the canonical name win', async () => {
    const indent = (el: LyraJsonSchemaViewer): string => {
      const nodes = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('[part~="node"] > [part="node-trigger"]'));
      return getComputedStyle(nodes[nodes.length - 1]!).marginInlineStart;
    };
    const mount = (style: string) =>
      fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer style=${style} .schema=${deep}></lr-json-schema-viewer>`);
    const canonical = await mount('--lr-json-schema-viewer-max-indent: 3px');
    const alias = await mount('--lr-schema-viewer-max-indent: 3px');
    const both = await mount('--lr-json-schema-viewer-max-indent: 5px; --lr-schema-viewer-max-indent: 3px');
    const rtl = await fixture<LyraJsonSchemaViewer>(html`
      <lr-json-schema-viewer dir="rtl" style="--lr-json-schema-viewer-max-indent: 5px" .schema=${deep}></lr-json-schema-viewer>
    `);
    expect(indent(canonical)).to.equal('3px');
    expect(indent(alias)).to.not.equal('3px');
    expect(indent(both)).to.equal('5px');
    expect(indent(rtl)).to.equal('5px');
  });
});

it('omits branches whose enumeration fails while preserving later schema siblings', () => {
  const rejectedRecord = (): Record<string, JsonSchemaNode> => new Proxy({ visible: { type: 'string' } }, {
    ownKeys(): never { throw new Error('enumeration unavailable'); },
  });
  const rejectedArray = (): JsonSchemaNode[] => new Proxy([{}], {
    ownKeys(): never { throw new Error('array enumeration unavailable'); },
  });
  const el = document.createElement('lr-json-schema-viewer');
  el.schema = {
    type: 'object',
    default: rejectedRecord(),
    examples: rejectedArray(),
    properties: rejectedRecord(),
    items: rejectedArray(),
    allOf: [rejectedRecord() as JsonSchemaNode, { type: 'string' }],
    description: 'Still available',
  };
  const snapshot = el.schema as unknown as Record<string, unknown>;
  for (const key of ['default', 'examples', 'properties', 'items']) {
    expect(Object.hasOwn(snapshot, key), key).to.equal(false);
  }
  const composition = snapshot['allOf'] as readonly JsonSchemaNode[];
  expect(0 in composition).to.equal(false);
  expect(composition[1]!.type).to.equal('string');
  expect(snapshot['description']).to.equal('Still available');

  el.schema = rejectedRecord() as JsonSchemaNode;
  expect(el.schema === null).to.equal(true);
});

it('omits an array with an unreadable length and retains valid constraint siblings', () => {
  const unreadableLength = new Proxy([1], {
    getOwnPropertyDescriptor(target, key): PropertyDescriptor | undefined {
      if (key === 'length') throw new Error('length unavailable');
      return Reflect.getOwnPropertyDescriptor(target, key);
    },
  });
  const el = document.createElement('lr-json-schema-viewer');
  el.schema = { type: 'string', examples: unreadableLength, title: 'Valid title' };
  expect(Object.hasOwn(el.schema!, 'examples')).to.equal(false);
  expect(el.schema!.title).to.equal('Valid title');
});

it('truncates owned arrays at the admitted node prefix when the schema node budget is exhausted', () => {
  for (const keyword of ['examples', 'items']) {
    const el = document.createElement('lr-json-schema-viewer');
    const entries = Array.from({ length: 50_000 }, () => ({ type: 'string' }));
    el.schema = { type: 'array', [keyword]: entries };
    const snapshot = (el.schema as unknown as Record<string, unknown>)[keyword] as readonly JsonSchemaNode[];
    expect(snapshot.length).to.equal(keyword === 'examples' ? 49_998 : 49_999);
    expect(snapshot.at(-1)!.type).to.equal('string');
    expect(Object.isFrozen(snapshot)).to.equal(true);
    expect(entries.length).to.equal(50_000);
  }
});

it('owns non-index tuple metadata through the same descriptor-safe value boundary', () => {
  const items = [{ type: 'string' }] as JsonSchemaNode[] & { note?: { label: string } };
  items.note = { label: 'Tuple metadata' };
  const el = document.createElement('lr-json-schema-viewer');
  el.schema = { type: 'array', items };
  items.note.label = 'Changed by caller';
  const snapshot = el.schema!.items as JsonSchemaNode[] & { note: { label: string } };
  expect(snapshot.note.label).to.equal('Tuple metadata');
  expect(Object.isFrozen(snapshot.note)).to.equal(true);
});

it('is one tab stop whose node triggers step with ArrowUp/ArrowDown and Home/End', async () => {
  const el = await fixture<LyraJsonSchemaViewer>(html`<lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>`);
  const triggers = () => [...el.shadowRoot!.querySelectorAll<HTMLElement>('[part="node-trigger"]')];
  expect(triggers().length).to.equal(4);
  expect(triggers().filter((trigger) => trigger.tabIndex === 0).length).to.equal(1);
  await focusByKeyboard(triggers()[0]!);
  await sendKeys({ press: 'ArrowDown' });
  expect(el.shadowRoot!.activeElement === triggers()[1]).to.equal(true);
  await sendKeys({ press: 'End' });
  expect(el.shadowRoot!.activeElement === triggers()[3]).to.equal(true);
  await sendKeys({ press: 'ArrowDown' });
  expect(el.shadowRoot!.activeElement === triggers()[3], 'stops at the last node').to.equal(true);
  await sendKeys({ press: 'Home' });
  expect(el.shadowRoot!.activeElement === triggers()[0]).to.equal(true);
  await sendKeys({ press: 'ArrowDown' });
  expect(triggers().filter((trigger) => trigger.tabIndex === 0).map((trigger) => trigger.dataset['path'])).to.deep.equal(['/properties/query']);
});

it('keeps its schema snapshot on a same-reference rebind', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  try {
    const renderParent = (status: string): void => {
      render(html`<p>${status}</p><lr-json-schema-viewer .schema=${schema}></lr-json-schema-viewer>`, host);
    };
    renderParent('first');
    const el = host.querySelector('lr-json-schema-viewer') as LyraJsonSchemaViewer;
    await el.updateComplete;
    const snapshot = el.schema;
    renderParent('second');
    await el.updateComplete;
    expect(el.schema === snapshot, 'an unchanged binding keeps the snapshot').to.equal(true);
  } finally {
    render(html``, host);
    host.remove();
  }
});
