import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { API } from 'typescript/unstable/sync';
import { initialCatalog } from '../dist/catalog.js';
import { createCatalogPropertyProof, createSchemaTypeProof } from './catalog-type-proof.mjs';

test('concrete source types verify single-select and table contracts and reject schema drift', () => {
  const config = fileURLToPath(new URL('./fixtures/tsconfig.catalog-proof.json', import.meta.url));
  const api = new API();
  const snapshot = api.updateSnapshot({ openProjects: [config] });
  try {
    const project = snapshot.getProject(config);
    assert.ok(project);
    const source = project.program.getSourceFile(fileURLToPath(new URL('./fixtures/catalog-proof-types.ts', import.meta.url)));
    assert.ok(source);
    const proof = createCatalogPropertyProof(project, source);
    for (const property of ['select.value', 'table.rows', 'table.columns']) {
      const [role, key] = property.split('.');
      const schema = initialCatalog.components[role].properties[key];
      assert.equal(proof(property, schema).status, 'verified', property);
    }
    assert.notEqual(proof('select.value', { type: 'array', items: { type: 'string' } }).status, 'verified');
    const rows = structuredClone(initialCatalog.components.table.properties.rows);
    rows.items.properties.c0 = { type: 'object', properties: {} };
    assert.notEqual(proof('table.rows', rows).status, 'verified', 'Nested cells cannot hide behind unknown rows.');
    const columns = structuredClone(initialCatalog.components.table.properties.columns);
    columns.items.properties.sortable = { type: 'string' };
    assert.notEqual(proof('table.columns', columns).status, 'verified', 'Adapter metadata cannot waive an incompatible real column property.');
    columns.items.properties.sortable = { type: 'boolean' };
    columns.items.properties.unknownMember = { type: 'string' };
    assert.notEqual(proof('table.columns', columns).status, 'verified', 'Unknown column members fail.');
    delete columns.items.properties.unknownMember;
    columns.items.required = ['key'];
    assert.notEqual(proof('table.columns', columns).status, 'verified', 'A required component label cannot become optional.');
    const rowsAlias = source.statements.find(node => node.name?.text === 'CatalogTableRows');
    const { assignment } = createSchemaTypeProof(project);
    assert.notEqual(assignment({ type: 'string' }, project.checker.getTypeAtLocation(rowsAlias), source).status, 'verified');
  } finally { snapshot.dispose(); api.close(); }
});
