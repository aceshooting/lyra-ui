import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { basePlugin } from '../scripts/base-transform.mjs';
import { serializeJavaScript } from '../scripts/code-serialization.mjs';
import { completePlugin, src, virtual } from '../scripts/complete-transform.mjs';

const pathSegment = 'literal-"</script><script>alert(1)</script>\u2028\u2029';

test('serialized values execute as data with script delimiters, quotes and controls preserved', () => {
  const strings = [
    pathSegment,
    '</ScRiPt><!-- -->',
    '\'"`\\${globalThis.injected = true}',
    '");globalThis.injected = true;//',
    '\0\b\f\n\r\t\u2028\u2029',
    '\\u003c/script\\u003e',
    '🌐\ud800'
  ];
  for (const value of [...strings, strings, { [pathSegment]: strings }, null, true, 123]) {
    const literal = serializeJavaScript(value);
    assert.doesNotMatch(literal, /[<>\u2028\u2029]/);
    const context = {};
    const actual = runInNewContext(`(${literal})`, context);
    assert.equal(JSON.stringify(actual), JSON.stringify(value));
    assert.equal(context.injected, undefined);
  }
});

test('rejects values without a JSON representation', () => {
  for (const value of [undefined, () => {}, Symbol('value')]) {
    assert.throws(() => serializeJavaScript(value), /JSON-serializable value/);
  }
});

function assertEncodedModule(code) {
  assert.doesNotMatch(code, /<\/script>/i, 'module text cannot terminate an enclosing script element');
  assert.doesNotMatch(code, /[\u2028\u2029]/, 'line separators must be encoded in generated literals');
  assert.doesNotThrow(() => stripTypeScriptTypes(code, { mode: 'transform' }));
  const literals = [...code.matchAll(/"(?:[^"\\]|\\.)*"/g)].map(([literal]) => JSON.parse(literal));
  assert.ok(literals.some(value => value.includes(pathSegment)), 'encoding preserves the import path value');
}

for (const [file, name] of [
  ['style/create_style_layer.ts', 'CircleStyleLayer'],
  ['source/source.ts', 'GeoJSONSource']
]) {
  test(`encodes lazy registry import paths in ${file}`, async () => {
    const original = `import {${name}} from './${pathSegment}/module.ts';`;
    const result = await basePlugin.transform(original, join(src, file));
    assertEncodedModule(result.code);
  });
}

for (const file of ['webgl/draw/index.ts', 'shaders/shaders.ts', 'webgl/program/program_uniforms.ts']) {
  test(`encodes generated table import paths in ${file}`, async () => {
    const id = join(src, file);
    const original = await readFile(id, 'utf8');
    const modified = original.replaceAll("from './", `from './${pathSegment}/`);
    const before = new Map(virtual);
    try {
      const result = await completePlugin.transform(modified, id);
      const generated = [
        result.code,
        ...[...virtual].filter(([key, value]) => before.get(key) !== value).map(([, value]) => value)
      ];
      for (const code of generated) {
        // Uniform tables place their imports in the lazy modules, leaving only loaders in the entry.
        if (code.includes('literal-')) assertEncodedModule(code);
        else assert.doesNotThrow(() => stripTypeScriptTypes(code, { mode: 'transform' }));
      }
      assert.ok(generated.some(code => code.includes('literal-')), 'transformed imports retain their paths');
    } finally {
      virtual.clear();
      for (const [key, value] of before) virtual.set(key, value);
    }
  });
}

test('encodes projection loader import paths', async () => {
  const id = join(src, 'geo/projection/projection_factory.ts');
  const original = await readFile(id, 'utf8');
  const modified = original.replace(/from '(\.\/(?:globe|vertical_perspective))/, `from '$1${pathSegment}`);
  const result = await completePlugin.transform(modified, id);
  assertEncodedModule(result.code);
});
