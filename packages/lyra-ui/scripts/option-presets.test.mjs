import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildOptionPresetInterchange, readOptionPresetSources, renderOptionPresetModule, validateOptionPresetSource } from './generate-option-presets.mjs';
import { readStyleModel } from './style-axes-model.mjs';

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const { slotted } = readStyleModel(packageDir);

test('every optional preset uses valid inputs supported by the live runtime', () => {
  const sources = readOptionPresetSources(packageDir);
  assert.deepEqual(sources.map(source => source.kind), ['elevation', 'shape', 'typography']);
  for (const source of sources) validateOptionPresetSource(source, slotted);
  const interchange = buildOptionPresetInterchange(sources);
  for (const source of sources) assert.deepEqual(interchange.presets[source.kind], source.presets);
  assert.equal(JSON.stringify(buildOptionPresetInterchange([...sources].reverse())), JSON.stringify(interchange));
});

test('optional presets reject cross-category inputs, unsafe values and unsupported mode pairs', () => {
  const shape = { schemaVersion: 1, kind: 'shape', presets: { sample: { '--lr-theme-border-radius-m': '1rem' } } };
  assert.doesNotThrow(() => validateOptionPresetSource(shape, slotted));
  for (const tokens of [
    {},
    { '--lr-theme-color-focus': '#123456' },
    { '--lr-theme-border-radius-m': '1rem; color: red' },
    { '--lr-theme-border-radius-m': { light: '1rem', dark: '2rem' } },
    { '--lr-theme-border-radius-button': { light: null, dark: null } },
    { '--lr-theme-border-radius-m': 'var(--lr-theme-space-m)' },
  ]) {
    assert.throws(() => validateOptionPresetSource({ ...shape, presets: { sample: tokens } }, slotted));
  }
  assert.throws(() => validateOptionPresetSource({ ...shape, schemaVersion: 2 }, slotted));
  assert.throws(() => validateOptionPresetSource({ ...shape, unexpected: true }, slotted));
});

test('shape maps preserve circle and pill geometry and typography never requests remote fonts', () => {
  const sources = readOptionPresetSources(packageDir);
  const shape = sources.find(source => source.kind === 'shape');
  for (const tokens of Object.values(shape.presets)) {
    assert.equal(Object.hasOwn(tokens, '--lr-theme-border-radius-pill'), false);
    assert.ok(Object.hasOwn(tokens, '--lr-theme-border-radius-button'));
    assert.ok(Object.hasOwn(tokens, '--lr-theme-border-radius-container'));
  }
  const typography = sources.find(source => source.kind === 'typography');
  for (const tokens of Object.values(typography.presets)) {
    assert.match(tokens['--lr-theme-font-family-body'], /system-ui, sans-serif$/);
    assert.equal(Object.keys(tokens).some(name => name.includes('mono')), false, 'body typography leaves code fonts alone');
    assert.ok(Number(tokens['--lr-theme-line-height-normal']) >= 1.5);
  }
});

test('generated option modules have only erased type imports, never runtime or optional peer imports', () => {
  for (const source of readOptionPresetSources(packageDir)) {
    const output = renderOptionPresetModule(source);
    assert.deepEqual(output.match(/^import .+$/gm), ["import type { LyraThemeTokens } from '../theme.js';"]);
    assert.equal(output.includes('import('), false);
    assert.equal(output.includes('fetch('), false);
  }
});
