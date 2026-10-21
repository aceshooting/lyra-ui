import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LYRA_3D_CONTRACT } from '../dist/core/index.js';

// Lyra UI validates engines structurally and never imports this package, so the two sides of the
// contract are compared here, from source, whenever either changes.
const read = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const loader = read('../../lyra-ui/src/internal/engine-3d-loader.ts');
const contract = read('../src/core/contract.ts');

function interfaceMembers(source, name) {
  const start = source.indexOf(`export interface ${name}`);
  assert.notEqual(start, -1, `${name} not found`);
  const body = source.slice(source.indexOf('{', start) + 1, source.indexOf('\n}', start));
  const members = new Map();
  for (const match of body.matchAll(/^ {2}(?:readonly )?([A-Za-z]+)(\?)?[(:]/gmu)) members.set(match[1], match[2] === '?');
  return members;
}

const methodList = (name) => {
  const match = new RegExp(`const ${name} = \\[([^\\]]*)\\]`, 'u').exec(loader);
  assert.ok(match, `${name} not found in the Lyra UI loader`);
  return [...match[1].matchAll(/'([A-Za-z]+)'/gu)].map((entry) => entry[1]).sort();
};

test('Lyra UI expects this package\'s contract version', () => {
  assert.equal(Number(/export const ENGINE_3D_CONTRACT = (\d+);/u.exec(loader)?.[1]), LYRA_3D_CONTRACT);
});

test('Lyra UI validates exactly the engine methods this contract declares', () => {
  const members = interfaceMembers(contract, 'Lyra3dEngine');
  members.delete('contract');
  const required = [...members].filter(([, optional]) => !optional).map(([name]) => name).sort();
  const optional = [...members].filter(([, isOptional]) => isOptional).map(([name]) => name).sort();
  assert.deepEqual(methodList('REQUIRED_METHODS'), required);
  assert.deepEqual(methodList('OPTIONAL_METHODS'), optional);
});

test('the host callbacks match on both sides', () => {
  assert.deepEqual([...interfaceMembers(loader, 'Engine3dHost')], [...interfaceMembers(contract, 'Lyra3dHost')]);
});
