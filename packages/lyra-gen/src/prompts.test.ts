import assert from 'node:assert/strict';
import test from 'node:test';
import { createCatalog, initialCatalog, subsetCatalog } from './catalog.js';
import { exportCatalogSchemaForProfile } from './prompts.js';

test('closed JSON profile exports a single simple leaf without references or composition', () => {
  const selected = subsetCatalog(initialCatalog, ['heading']);
  assert.ok(selected.ok);
  const result = exportCatalogSchemaForProfile(selected.value, 'closed-json-v1');
  assert.ok(result.ok);
  const encoded = JSON.stringify(result.value);
  assert.ok(!encoded.includes('"anyOf"'));
  assert.ok(!encoded.includes('"allOf"'));
  assert.ok(!encoded.includes('"$ref"'));
  assert.ok(encoded.includes('"text"'));
  assert.equal(exportCatalogSchemaForProfile(initialCatalog, 'closed-json-v1').ok, false);
});

test('closed JSON profile diagnoses unsupported schema unions and naming alternatives', () => {
  const button = subsetCatalog(initialCatalog, ['button']);
  assert.ok(button.ok);
  const named = exportCatalogSchemaForProfile(button.value, 'closed-json-v1');
  assert.ok(!named.ok);
  assert.ok(named.diagnostics.some(item => item.path.endsWith('/accessibleName')));
  const nullable = createCatalog({ id: 'nullable', version: '1', components: { text: { tag: 'p', properties: { data: { anyOf: [{ type: 'string' }, { type: 'null' }] } }, text: true } } });
  const result = exportCatalogSchemaForProfile(nullable, 'closed-json-v1');
  assert.ok(!result.ok);
  assert.ok(result.diagnostics.some(item => item.code === 'schema.profile.unsupported'));
});

test('simple object property schemas remain closed when additionalProperties is implicit', () => {
  const catalog = createCatalog({ id: 'object', version: '1', components: { text: { tag: 'p', properties: { data: { type: 'object', properties: { title: { type: 'string' } } } }, text: true } } });
  const result = exportCatalogSchemaForProfile(catalog, 'closed-json-v1');
  assert.ok(result.ok);
  const root = result.value['properties'] as Record<string, unknown>;
  const node = root['root'] as Record<string, unknown>;
  const nodeProperties = node['properties'] as Record<string, unknown>;
  const props = nodeProperties['props'] as Record<string, unknown>;
  const properties = props['properties'] as Record<string, unknown>;
  assert.equal((properties['data'] as Record<string, unknown>)['additionalProperties'], false);
});

import { answerBlocksCatalog, liveDashboardCatalog } from './catalog.js';
import { buildCatalogPrompt, buildRefinementPrompt, exportCatalogArtifact, exportCatalogJsonSchema } from './prompts.js';
import type { JsonObject, JsonValue, LyraGenView } from './types.js';

const HOISTED = /^#\/\$defs\/(_\d+)$/;
function expandHoisted(schema: JsonObject): JsonObject {
  const defs = schema['$defs'] as Record<string, JsonValue>;
  const expand = (value: JsonValue): JsonValue => {
    if (Array.isArray(value)) return value.map(expand);
    if (!value || typeof value !== 'object') return value;
    const record = value as Record<string, JsonValue>;
    const match = typeof record['$ref'] === 'string' ? HOISTED.exec(record['$ref']) : null;
    if (match) return expand(defs[match[1]!]!);
    return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, expand(child)]));
  };
  const kept = Object.fromEntries(Object.entries(defs).filter(([key]) => !/^_\d+$/.test(key)));
  return expand({ ...schema, $defs: kept }) as JsonObject;
}

test('the default prompt omits renderer-only metadata and implicit bounds but keeps every model-facing bound', () => {
  const prompt = buildCatalogPrompt(liveDashboardCatalog, { maxCharacters: 1e6 });
  for (const omitted of ['"documentation"', '"tag":"lr-', '"minimumBlockSize"', '"optionalChildren"', '"additionalProperties":false', '1000000000000']) assert.equal(prompt.includes(omitted), false, omitted);
  const artifact = JSON.stringify(exportCatalogArtifact(liveDashboardCatalog));
  for (const kept of ['"documentation"', '"tag":"lr-', '"additionalProperties":false', '1000000000000']) assert.ok(artifact.includes(kept), kept);
  assert.ok(prompt.length < artifact.length * 0.9);
  assert.match(prompt, /-1e12\.\.1e12/);
  assert.match(prompt, /only their listed properties/);
  // Bounds a model must respect stay: lengths, item counts, enums, required members, names and bindings.
  for (const kept of ['"maxItems":8', '"minLength":1', '"maxLength":256', '"enum":["radial","ring","linear"]', '"required":["label","value"]', '"accessibleName"', '"bindings"', '"useWhen"', '"examples"', '"maxProperties":12']) assert.ok(prompt.includes(kept), kept);
  const custom = createCatalog({ id: 'b', version: '1', components: { meter: { tag: 'x-meter', properties: { level: { type: 'number', minimum: 0, maximum: 1e12 }, ratio: { type: 'number', minimum: -1e12, maximum: 5 } } } } });
  const compact = buildCatalogPrompt(custom);
  assert.ok(compact.includes('"level":{"minimum":0,"type":"number"}'));
  assert.ok(compact.includes('"ratio":{"maximum":5,"type":"number"}'));
});

test('the JSON Schema hoists repeated sub-schemas into $defs and expands to the inline schema', () => {
  for (const catalog of [initialCatalog, liveDashboardCatalog, answerBlocksCatalog()]) {
    const inline = exportCatalogJsonSchema(catalog, { inline: true });
    const hoisted = exportCatalogJsonSchema(catalog);
    const encoded = JSON.stringify(hoisted);
    assert.ok(encoded.includes('"$ref":"#/$defs/_0"'));
    assert.doesNotMatch(JSON.stringify(inline), /"#\/\$defs\/_\d/);
    assert.ok(encoded.length < JSON.stringify(inline).length * 0.5, catalog.id);
    assert.deepEqual(expandHoisted(hoisted), inline, catalog.id);
    assert.equal(JSON.stringify(exportCatalogJsonSchema(catalog)), encoded);
  }
  // Non-schema positions (property maps, const, enum, required) are never replaced by references.
  const defs = exportCatalogJsonSchema(initialCatalog)['$defs'] as Record<string, { properties: Record<string, JsonValue> }>;
  for (const definition of Object.values(defs)) if (definition.properties) assert.equal(Object.hasOwn(definition.properties, '$ref'), false);
  const closed = exportCatalogSchemaForProfile(subsetCatalog(initialCatalog, ['heading']).ok ? (subsetCatalog(initialCatalog, ['heading']) as { value: typeof initialCatalog }).value : initialCatalog, 'closed-json-v1');
  assert.ok(closed.ok && !JSON.stringify(closed.value).includes('$ref'));
});

test('the signature profile writes one line per role with a legend and keeps every bound', () => {
  const prompt = buildCatalogPrompt(liveDashboardCatalog, { profile: 'signature', maxCharacters: 1e6 });
  assert.equal(buildCatalogPrompt(liveDashboardCatalog, { profile: 'signature', maxCharacters: 1e6 }), prompt);
  assert.match(prompt, /^Notation: /m);
  assert.match(prompt, /^catalog lyra-reviewed\+dashboard\/live@1$/m);
  const lines = prompt.split('\n');
  for (const role of Object.keys(liveDashboardCatalog.components)) assert.equal(lines.filter(line => line.startsWith(`${role}(`)).length, 1, role);
  const gauge = lines.find(line => line.startsWith('gauge('))!;
  assert.ok(gauge.includes('label!@:str(1..256)'), gauge);
  assert.ok(gauge.includes('value!:num,') || gauge.includes('value!:num)'), gauge);
  assert.match(gauge, /thresholds:\{at:num, variant:(E\d+|neutral\|brand\|success\|warning\|danger)\}\[\.\.8\]/);
  assert.match(gauge, / -- Show one measured value/);
  const filter = lines.find(line => line.startsWith('filter-bar('))!;
  assert.ok(filter.includes('value~:{[key str(..128) x..12]:str(..256)}'), filter);
  assert.ok(!prompt.includes('"examples"'));
  assert.ok(prompt.length < buildCatalogPrompt(liveDashboardCatalog, { maxCharacters: 1e6 }).length * 0.5);
  const withExamples = buildCatalogPrompt(liveDashboardCatalog, { profile: 'signature', examples: true, maxCharacters: 1e6 });
  assert.match(withExamples, /^Examples:$/m);
  assert.ok(withExamples.includes('"type":"gauge"'));
  assert.throws(() => buildCatalogPrompt(liveDashboardCatalog, { profile: 'signature', maxCharacters: 100 }), RangeError);
  const custom = createCatalog({ id: 'c', version: '1', components: { pick: { tag: 'x-pick', properties: { mode: { type: 'string', enum: ['1', 'a b', 'ok'] }, count: { type: 'integer', minimum: 2, maximum: 9 }, maybe: { anyOf: [{ type: 'string', maxLength: 4 }, { type: 'null' }] } }, text: true, accessibleName: { required: true, text: true } } } });
  const line = buildCatalogPrompt(custom, { profile: 'signature' }).split('\n').find(entry => entry.startsWith('pick('))!;
  assert.equal(line, 'pick(count:int(2..9), maybe:str(..4) | null, mode:"1"|"a b"|ok) text@');
});

test('the Markup format describes Lyra Markup output and renders examples as Markup', () => {
  const prompt = buildCatalogPrompt(liveDashboardCatalog, { format: 'markup', maxCharacters: 1e6 });
  assert.match(prompt, /^Return one restricted Lyra Markup root\./);
  assert.ok(!prompt.includes('"examples"'));
  assert.match(prompt, /^gauge: <gauge id="utilisation" /m);
  const signature = buildCatalogPrompt(liveDashboardCatalog, { format: 'markup', profile: 'signature', examples: true, maxCharacters: 1e6 });
  assert.match(signature, /^gauge: <gauge id="utilisation" /m);
});

test('refinement prompts request a scoped patch and send only the addressed panel and its roles', () => {
  const view: LyraGenView = { version: '1', catalog: { id: liveDashboardCatalog.id, version: liveDashboardCatalog.version }, surfaceId: 'ops', revision: 4, root: { id: 'root', type: 'stack', children: [
    { id: 'cpu', type: 'gauge', props: { label: 'CPU', value: 40 } },
    { id: 'panel', type: 'card', children: [{ id: 'title', type: 'heading', text: 'Memory' }, { id: 'mem', type: 'stat', props: { label: 'Memory', value: 3 } }] },
  ] } };
  const whole = buildRefinementPrompt(liveDashboardCatalog, view, 'Add a disk gauge.', { maxCharacters: 1e6 });
  assert.match(whole, /LyraGenPatch/);
  assert.ok(whole.includes('"surfaceId":"ops"') && whole.includes('"expectedRevision":4'));
  for (const op of ['"replace"', '"remove"', '"insert"']) assert.ok(whole.includes(op), op);
  assert.ok(whole.includes('"id":"cpu"'));
  assert.ok(whole.includes('"Add a disk gauge."'));
  const scoped = buildRefinementPrompt(liveDashboardCatalog, view, 'Show memory in GiB.', { nodeId: 'panel', maxCharacters: 1e6 });
  assert.ok(!scoped.includes('"id":"cpu"'));
  assert.ok(scoped.includes('"id":"mem"'));
  assert.ok(scoped.includes('"panel"'));
  assert.ok(scoped.includes('"stat"') && scoped.includes('"heading"'));
  assert.ok(!scoped.includes('"gauge"'));
  assert.ok(scoped.length < whole.length / 3);
  const signature = buildRefinementPrompt(liveDashboardCatalog, view, 'Tighten copy.', { nodeId: 'panel', profile: 'signature' });
  assert.match(signature, /^stat\(/m);
  assert.throws(() => buildRefinementPrompt(liveDashboardCatalog, view, 'x', { nodeId: 'missing' }), RangeError);
  assert.throws(() => buildRefinementPrompt(liveDashboardCatalog, view, '  '), RangeError);
});
