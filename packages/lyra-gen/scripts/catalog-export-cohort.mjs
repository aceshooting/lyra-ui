import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { initialCatalog } from '../dist/catalog.js';
import { createA2uiCatalog, exportA2uiCatalog } from '../dist/adapters/a2ui.js';
import { exportA2uiCandidateCatalog } from '../dist/adapters/a2ui-candidate.js';

export const referenceRevision = '409ded29ccac3eebc541979ae5320771703248e8';
const fixtureRoot = new URL('../test/fixtures/a2ui/', import.meta.url);

async function pinnedSchema(version, name) {
  const provenance = JSON.parse(await readFile(new URL(`${version}/provenance.json`, fixtureRoot), 'utf8'));
  assert.equal(provenance.revision, referenceRevision);
  const entry = provenance.files.find(file => file.file === name);
  assert.ok(entry, `${version}/${name}: missing source pin`);
  const bytes = await readFile(new URL(`${version}/${name}`, fixtureRoot));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, `${version}/${name}: source pin changed`);
  return JSON.parse(bytes);
}

/** Both artifacts remain distinct. Candidate acceptance covers literal catalog schemas only. */
export async function catalogExportCohort() {
  const stable = exportA2uiCatalog(createA2uiCatalog(initialCatalog));
  const candidate = exportA2uiCandidateCatalog(initialCatalog);
  const [stableCommon, candidateCommon, candidateDefinition] = await Promise.all([
    pinnedSchema('v0.9.1', 'common_types.json'), pinnedSchema('v1.0-candidate', 'common_types.json'),
    pinnedSchema('v1.0-candidate', 'catalog_definition.json'),
  ]);
  // Format annotations are not asserted; all structural and value constraints remain enabled.
  const meta = new Ajv2020({ strict: false, validateFormats: false });
  assert.equal(meta.validateSchema(stable), true, JSON.stringify(meta.errors));
  meta.addSchema(candidateCommon);
  const validateCandidate = meta.compile(candidateDefinition);
  assert.equal(validateCandidate(candidate), true, JSON.stringify(validateCandidate.errors));
  const cases = [];
  for (const [version, catalog, common] of [['v0.9.1', stable, stableCommon], ['v1.0-candidate', candidate, candidateCommon]]) {
    // Catalog documents have been checked above. This validator resolves their component fragments.
    const ajv = new Ajv2020({ strict: false, validateFormats: false, validateSchema: false });
    // The common-types vocabulary resolves catalog.json against the host-selected catalog.
    ajv.addSchema(common).addSchema(catalog, new URL('catalog.json', common.$id).href);
    for (const [role, component] of Object.entries(initialCatalog.components)) {
      const wireRole = version === 'v0.9.1' ? role : role.replaceAll('-', '_');
      const example = component.examples[0];
      const value = { id: example.id, component: wireRole, ...example.props,
        ...(example.text === undefined ? {} : { text: example.text }),
        ...(example.children ? { children: example.children.map(child => child.id) } : {}),
      };
      const ref = `${catalog.$id}#/components/${wireRole.replaceAll('~', '~0').replaceAll('/', '~1')}`;
      const validate = ajv.getSchema(ref);
      assert.ok(validate, `${version}/${role}: component schema must compile`);
      assert.equal(validate(value), true, `${version}/${role}: ${JSON.stringify(validate.errors)}`);
      cases.push({ version, role: wireRole, name: 'authored-example', value, accepted: true });
      assert.equal(validate({ ...value, undeclared: true }), false, `${version}/${role}: undeclared property`);
      cases.push({ version, role: wireRole, name: 'undeclared-property', value: { ...value, undeclared: true }, accepted: false });
      for (const key of component.required ?? []) {
        const missing = { ...value }; delete missing[key];
        assert.equal(validate(missing), false, `${version}/${role}: missing required ${key}`);
        cases.push({ version, role: wireRole, name: `missing-${key}`, value: missing, accepted: false });
      }
    }
    const input = ajv.getSchema(`${catalog.$id}#/components/input`);
    const binding = { id: 'query', component: 'input', label: 'Query', value: { path: '/query' } };
    assert.equal(input(binding), version === 'v0.9.1', `${version}: dynamic binding profile`);
    cases.push({ version, role: 'input', name: 'binding', value: binding, accepted: version === 'v0.9.1' });
    const wrong = { id: 'query', component: 'select', label: 'Query', value: ['multi'] };
    assert.equal(ajv.getSchema(`${catalog.$id}#/components/select`)(wrong), false, `${version}: scalar select`);
    cases.push({ version, role: 'select', name: 'array-value', value: wrong, accepted: false });
  }
  assert.notEqual(stable.catalogId, candidate.catalogId);
  return { stable, candidate, cases };
}
