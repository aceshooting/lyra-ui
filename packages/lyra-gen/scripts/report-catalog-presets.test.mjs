import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { catalogPresets, initialCatalog } from '../dist/catalog.js';
import { buildCatalogPrompt, exportCatalogJsonSchema } from '../dist/prompts.js';

const script = fileURLToPath(new URL('report-catalog-presets.mjs', import.meta.url));
const hash = value => createHash('sha256').update(value, 'utf8').digest('hex');
test('catalog context report measures exact prompt/schema content without estimating provider tokens', () => {
  const report = JSON.parse(execFileSync(process.execPath, [script], { encoding: 'utf8' }));
  assert.deepEqual(report.providerUsage, { measuredTokens: null, measuredModelErrorRate: null, modelCalls: 0 });
  for (const [name, catalog] of [['full', initialCatalog], ...Object.entries(catalogPresets)]) {
    const prompt = buildCatalogPrompt(catalog);
    const schema = JSON.stringify(exportCatalogJsonSchema(catalog));
    const measured = report.measurements[name];
    assert.equal(measured.promptSha256, hash(prompt));
    assert.equal(measured.utf8Bytes, Buffer.byteLength(prompt, 'utf8'));
    assert.equal(measured.schemaSha256, hash(schema));
    assert.equal(measured.schemaUtf8Bytes, Buffer.byteLength(schema, 'utf8'));
    assert.equal(measured.promptAndSchemaUtf8Bytes, Buffer.byteLength(prompt, 'utf8') + Buffer.byteLength(schema, 'utf8'));
    assert.deepEqual(measured.actionNames, []);
  }
});

test('the checked catalog context report matches the current emitted artifacts', () => {
  execFileSync(process.execPath, [script, '--check'], { stdio: 'pipe' });
});
