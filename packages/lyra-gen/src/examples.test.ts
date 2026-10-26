import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogPresetNames, catalogPresets, createCatalog, dataCatalog, initialCatalog, selectCatalogPreset, subsetCatalog } from './catalog.js';
import { createExampleAblation, exampleLibrary, selectExamples } from './examples.js';
import { validateView } from './runtime.js';

test('task examples are deterministic versioned portable data within the active catalog', () => {
  const selected = selectExamples(initialCatalog, 'data');
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.deepEqual(selectExamples(initialCatalog, 'data'), selected);
  assert.equal(selected.value.artifact.format, 'lyra-gen-examples');
  assert.equal(selected.value.artifact.version, '1');
  assert.equal(selected.value.artifact.libraryVersion, exampleLibrary.version);
  assert.equal(selected.value.bytes, new TextEncoder().encode(selected.value.source).byteLength);
  assert.deepEqual(JSON.parse(selected.value.source), selected.value.artifact);
  assert.equal(selected.value.artifact.examples.length, 2);
  for (const example of selected.value.artifact.examples) {
    assert.equal(example.task, 'data');
    assert.equal(validateView(example.view, initialCatalog).ok, true);
  }
});

test('missing roles and action permissions are never silently added for a few-shot example', () => {
  const subset = subsetCatalog(initialCatalog, ['text']);
  assert.equal(subset.ok, true);
  if (!subset.ok) return;
  const selected = selectExamples(subset.value, 'summary');
  assert.equal(selected.ok, true);
  if (!selected.ok) return;
  assert.equal(selected.value.artifact.examples.length, 1);
  assert.equal(selected.value.artifact.examples[0]?.view.root.type, 'text');
  const data = selectExamples(subset.value, 'data');
  assert.equal(data.ok, true);
  if (data.ok) assert.equal(data.value.artifact.examples.length, 0);
  assert.equal(Object.keys(subset.value.components).length, 1);
  assert.equal(subset.value.actions && Object.keys(subset.value.actions).length, 0);
  for (const example of exampleLibrary.examples) {
    const inspect = (node: typeof example.root): void => {
      assert.equal(node.action, undefined);
      assert.equal(node.bindings, undefined);
      for (const value of Object.values(node.props ?? {})) assert.ok(!JSON.stringify(value).includes('"$ref"'));
      node.children?.forEach(inspect);
    };
    inspect(example.root);
  }
});

test('example selection enforces byte/count ceilings and catalog identity without mutation', () => {
  const baseline = JSON.stringify(exampleLibrary);
  const bounded = selectExamples(initialCatalog, 'data', { maxExamples: 1, maxBytes: 2_048 });
  assert.equal(bounded.ok, true);
  if (bounded.ok) {
    assert.equal(bounded.value.artifact.examples.length, 1);
    assert.ok(bounded.value.bytes <= 2_048);
    assert.ok(Object.isFrozen(bounded.value.artifact.examples[0]?.view.root));
  }
  const none = selectExamples(initialCatalog, 'summary', { maxExamples: 0 });
  assert.equal(none.ok, true);
  if (none.ok) assert.equal(none.value.artifact.examples.length, 0);
  assert.equal(selectExamples(initialCatalog, 'data', { maxBytes: 1 }).ok, false);
  assert.equal(selectExamples(initialCatalog, 'data', { maxExamples: Infinity }).ok, false);
  assert.equal(selectExamples(initialCatalog, 'data', { maxBytes: Number.NaN }).ok, false);
  assert.equal(selectExamples({ ...initialCatalog, version: 'future' }, 'data').ok, false);
  assert.equal(JSON.stringify(exampleLibrary), baseline);
});

test('few-shot ablation configuration is paired data with no model or paid execution', () => {
  assert.equal(createExampleAblation(initialCatalog, []).ok, false);
  const result = createExampleAblation(initialCatalog, ['summary', 'data', 'summary']);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.format, 'lyra-gen-example-ablation');
  assert.equal(result.value.measured, false);
  assert.deepEqual(result.value.cases.map(item => item.task), ['data', 'summary']);
  for (const entry of result.value.cases) {
    assert.equal(entry.withoutExamples.examples.length, 0);
    assert.ok(entry.withExamples.examples.length > 0);
    assert.deepEqual(entry.withoutExamples.catalog, entry.withExamples.catalog);
  }
  assert.equal(JSON.stringify(result).includes('apiKey'), false);
  assert.deepEqual(createExampleAblation(initialCatalog, ['data', 'summary']), result);
});

test('built-in preset compatibility uses exact reviewed references and the selected role schemas', () => {
  for (const name of catalogPresetNames) {
    const catalog = catalogPresets[name];
    const selected = selectExamples(catalog, 'summary');
    assert.ok(selected.ok);
    assert.deepEqual(selected.value.artifact.catalog, { id: catalog.id, version: catalog.version });
    assert.equal(selected.value.artifact.examples.length, 2);
    for (const example of selected.value.artifact.examples) assert.ok(validateView(example.view, catalog).ok);
  }
  const data = selectExamples(dataCatalog, 'data');
  assert.ok(data.ok);
  assert.equal(data.value.artifact.examples.length, 2);
  const missing = selectExamples(catalogPresets.chat, 'data');
  assert.ok(missing.ok);
  assert.equal(missing.value.artifact.examples.length, 0);
  const narrowed = createCatalog({ ...dataCatalog, components: { text: dataCatalog.components['text']! } });
  const filtered = selectExamples(narrowed, 'data');
  assert.ok(filtered.ok);
  assert.equal(filtered.value.artifact.examples.length, 0);
  assert.ok(createExampleAblation(dataCatalog, ['data']).ok);
});

test('preset example compatibility never trusts an ID prefix or an unrelated host catalog', () => {
  assert.ok(!selectExamples({ ...dataCatalog, id: 'lyra-reviewed/data-extra' }, 'data').ok);
  assert.ok(!selectExamples({ ...dataCatalog, id: 'lyra-reviewed/unknown' }, 'data').ok);
  assert.ok(!selectExamples({ ...dataCatalog, version: 'future' }, 'data').ok);
  const host = selectCatalogPreset('data', { ...initialCatalog, id: 'host-reviewed' });
  assert.ok(host.ok);
  assert.ok(!selectExamples(host.value, 'data').ok);
});
