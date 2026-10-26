import assert from 'node:assert/strict';
import test from 'node:test';
import { agentOpsCatalog, catalogPresetNames, catalogPresetRoles, catalogPresets, chatCatalog, createCatalog, dataCatalog, formsCatalog, initialCatalog, retrievalCatalog, selectCatalogPreset } from '../catalog.js';
import { buildCatalogPrompt } from '../prompts.js';
import { validateView } from '../runtime.js';
import type { LyraGenCatalogPresetName } from './presets.js';

const view = (catalog: typeof initialCatalog, type: string) => ({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'preset-test', revision: 0, root: { id: 'root', type, text: 'Example' } });

test('five named request presets contain only supported roles and complete child dependencies', () => {
  assert.deepEqual(catalogPresetNames, ['chat', 'forms', 'data', 'retrieval', 'agent-ops']);
  assert.ok(Object.isFrozen(catalogPresetNames));
  assert.deepEqual([catalogPresets.chat, catalogPresets.forms, catalogPresets.data, catalogPresets.retrieval, catalogPresets['agent-ops']], [chatCatalog, formsCatalog, dataCatalog, retrievalCatalog, agentOpsCatalog]);
  for (const name of catalogPresetNames) {
    const catalog = catalogPresets[name];
    assert.ok(Object.isFrozen(catalog));
    assert.ok(Object.isFrozen(catalogPresetRoles[name]));
    assert.equal(catalog.id, `${initialCatalog.id}/${name}`);
    assert.equal(catalog.version, initialCatalog.version);
    assert.deepEqual(Object.keys(catalog.components), catalogPresetRoles[name]);
    assert.equal(new Set(catalogPresetRoles[name]).size, catalogPresetRoles[name].length);
    for (const [role, component] of Object.entries(catalog.components)) {
      assert.equal(component, initialCatalog.components[role]);
      if (Array.isArray(component.children)) for (const child of component.children) assert.ok(Object.hasOwn(catalog.components, child), `${name}:${role} missing ${child}`);
      for (const example of component.examples ?? []) {
        const result = validateView({ version: '1', catalog: { id: catalog.id, version: catalog.version }, surfaceId: 'preset-example', revision: 0, root: example }, catalog);
        assert.ok(result.ok, `${name}:${role}: ${JSON.stringify(result.diagnostics)}`);
      }
    }
    assert.equal(Object.keys(catalog.actions ?? {}).length, 0);
    assert.ok(buildCatalogPrompt(catalog).length < buildCatalogPrompt(initialCatalog).length);
  }
});

test('presets reject unavailable roles instead of accepting the broader source catalog', () => {
  assert.ok(!validateView(view(dataCatalog, 'chat-message'), dataCatalog).ok);
  assert.ok(!validateView(view(retrievalCatalog, 'table'), retrievalCatalog).ok);
  assert.ok(!selectCatalogPreset('not-a-preset' as LyraGenCatalogPresetName).ok);
  const small = createCatalog({ id: 'small', version: '1', components: { text: initialCatalog.components['text']! } });
  assert.ok(!selectCatalogPreset('forms', small).ok);
  assert.ok(!validateView({ ...view(chatCatalog, 'text'), catalog: { id: dataCatalog.id, version: dataCatalog.version } }, chatCatalog).ok);
});

test('action selection stays empty by default and requires explicit declared host names', () => {
  const host = createCatalog({ ...initialCatalog, id: 'host', actions: {
    save: { payload: { type: 'null' } },
    remove: { payload: { type: 'null' }, confirm: true },
  } });
  const closed = selectCatalogPreset('agent-ops', host);
  assert.ok(closed.ok);
  assert.deepEqual(Object.keys(closed.value.actions ?? {}), []);
  const selected = selectCatalogPreset('agent-ops', host, ['save']);
  assert.ok(selected.ok);
  assert.deepEqual(Object.keys(selected.value.actions ?? {}), ['save']);
  assert.ok(!selectCatalogPreset('agent-ops', host, ['unknown']).ok);
  const actionView = { version: '1', catalog: { id: closed.value.id, version: closed.value.version }, surfaceId: 'action-test', revision: 0, root: { id: 'save', type: 'button', text: 'Save', action: { name: 'save', payload: null } } };
  assert.ok(!validateView(actionView, closed.value).ok);
  assert.ok(validateView(actionView, selected.value).ok);
  assert.equal(selected.value.actions?.['remove'], undefined);
});
