import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalog, initialCatalog, subsetCatalog } from './catalog.js';
import { buildCatalogPrompt, exportCatalogArtifact, exportCatalogJsonSchema } from './prompts.js';
import { validateView } from './runtime.js';
import { validateSchema } from './schema.js';

test('reviewed catalog exposes only frozen schemas and explicit lazy component loaders', () => {
  assert.ok(Object.keys(initialCatalog.components).length >= 25);
  assert.ok(Object.isFrozen(initialCatalog));
  for (const component of Object.values(initialCatalog.components)) {
    assert.ok(Object.isFrozen(component.properties));
    for (const property of Object.values(component.properties)) assert.equal(validateSchema(property.default ?? null, property).diagnostics.some(item => item.code === 'schema.invalid'), false);
    if (component.tag.includes('-')) assert.equal(typeof component.load, 'function');
    if (component.interactive) assert.equal(component.accessibleName?.required, true);
  }
});

test('subset selection refuses unknown roles, action names, and missing child dependencies', () => {
  assert.equal(subsetCatalog(initialCatalog, ['made-up']).ok, false);
  assert.equal(subsetCatalog(initialCatalog, ['select']).ok, false);
  assert.equal(subsetCatalog(initialCatalog, ['button'], ['made-up']).ok, false);
  const selected = subsetCatalog(initialCatalog, ['select', 'option']);
  assert.equal(selected.ok, true);
  if (selected.ok) assert.deepEqual(Object.keys(selected.value.components).sort(), ['option', 'select']);
});

test('host catalogs refuse unsafe property names and dangling binding targets', () => {
  assert.throws(() => createCatalog({ id: 'x', version: '1', components: { bad: { tag: 'div', properties: { innerHTML: { type: 'string' } } } } }));
  assert.throws(() => createCatalog({ id: 'x', version: '1', components: { bad: { tag: 'div', properties: {}, bindings: { value: { event: 'input', property: 'value' } } } } }));
});

test('prompts and portable schema exports are deterministic and exclude loaders', () => {
  const selected = subsetCatalog(initialCatalog, ['stack', 'text', 'button']);
  assert.ok(selected.ok);
  const catalog = selected.value;
  const prompt = buildCatalogPrompt(catalog);
  assert.equal(buildCatalogPrompt(catalog), prompt);
  assert.throws(() => buildCatalogPrompt(catalog, { maxCharacters: 5 }), RangeError);
  const artifact = JSON.stringify(exportCatalogArtifact(catalog));
  assert.ok(!artifact.includes('\"load\":'));
  assert.ok(!artifact.includes('import('));
  const schema = exportCatalogJsonSchema(catalog);
  assert.equal(schema['$schema'], 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(JSON.stringify(exportCatalogJsonSchema(catalog)), JSON.stringify(schema));
  assert.ok(JSON.stringify(schema).includes('additionalProperties'));
});

test('trusted table adapter displays primitive cells as text including false and zero', () => {
  const component = initialCatalog.components['table']!;
  const prepare = component.prepareProperties;
  assert.ok(prepare);
  const props = prepare({ caption: 'Values', columns: [{ key: 'c0', label: 'Value' }], rows: [{ c0: false }] });
  const columns = props['columns'] as readonly { cell: (row: unknown) => string }[];
  assert.equal(columns[0]!.cell({ c0: false }), 'false');
  assert.equal(columns[0]!.cell({ c0: 0 }), '0');
  assert.equal(columns[0]!.cell({ c0: '<script>plain text</script>' }), '<script>plain text</script>');
  assert.equal(columns[0]!.cell({ c0: null }), '');
  let calls = 0;
  assert.equal(columns[0]!.cell({ get c0() { calls++; return 'unsafe'; } }), '');
  assert.equal(calls, 0);
  assert.ok(!JSON.stringify(exportCatalogArtifact(initialCatalog)).includes('prepareProperties'));
});

test('optional child roles may be left out of a subset and are then no longer allowed under their parent', () => {
  for (const [parent, props] of [['alert', {}], ['empty', { heading: 'Nothing here' }]] as const) {
    const selected = subsetCatalog(initialCatalog, ['stack', 'text', parent]);
    assert.equal(selected.ok, true, parent);
    if (!selected.ok) continue;
    assert.equal(Object.hasOwn(selected.value.components, 'button'), false);
    assert.equal((selected.value.components[parent]!.children as readonly string[]).includes('button'), false);
    const plain = { version: '1', catalog: { id: selected.value.id, version: selected.value.version }, surfaceId: 's', revision: 0, root: { id: 'a', type: parent, props, ...(parent === 'alert' ? { text: 'Heads up' } : {}) } };
    assert.equal(validateView(plain, selected.value).ok, true, parent);
    const withButton = { ...plain, root: { ...plain.root, children: [{ id: 'b', type: 'button', text: 'Go' }] } };
    const rejected = validateView(withButton, selected.value);
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.ok(rejected.diagnostics.some(item => item.path.endsWith('/children/0') && /not allowed here|does not accept children/.test(item.message)), parent);
  }
  const withButton = subsetCatalog(initialCatalog, ['alert', 'button']);
  assert.ok(withButton.ok && (withButton.value.components['alert']!.children as readonly string[]).includes('button'));
  assert.equal(initialCatalog.components['alert']!.optionalChildren?.includes('button'), true);
});

test('required child roles still fail the subset with catalog.dependency, optional ones do not', () => {
  const missing = subsetCatalog(initialCatalog, ['select']);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.deepEqual(missing.diagnostics.map(item => item.code), ['catalog.dependency']);
  const host = createCatalog({ id: 'h', version: '1', components: { box: { tag: 'div', properties: {}, children: ['item', 'extra'], optionalChildren: ['extra'] }, item: { tag: 'span', properties: {}, text: true }, extra: { tag: 'b', properties: {}, text: true } } });
  assert.equal(subsetCatalog(host, ['box']).ok, false);
  const ok = subsetCatalog(host, ['box', 'item']);
  assert.ok(ok.ok && (ok.value.components['box']!.children as readonly string[]).join() === 'item' && ok.value.components['box']!.optionalChildren?.length === 0);
  assert.throws(() => createCatalog({ id: 'h', version: '1', components: { box: { tag: 'div', properties: {}, children: ['item'], optionalChildren: ['other'] }, item: { tag: 'span', properties: {}, text: true } } }), TypeError);
});
