import assert from 'node:assert/strict';
import { join } from 'node:path';
import { addPreparedFeatures } from '../scripts/prepared-mutations.mjs';
import { snapshotFeatureRequirements } from '../scripts/feature-requirements.mjs';
import { createPreparationRuntime } from '../scripts/preparation-runtime.mjs';
import { src, virtual } from '../scripts/complete-transform.mjs';

const authored = { addPreparedFeatures, snapshotFeatureRequirements, createPreparationRuntime };
const result = '\nreturn {snapshotStyle,prepareReplacement,prepareMapFeatures,beginPreparation,prepareTransaction,prepareStyle};';
const executable = code => code
  .replace(/import\s*\{[^}]*\}\s*from\s*(?:'[^']*'|"[^"]*");/gu, '')
  .replace(/\bexport\s+/gu, '');

// Execute emitted wiring with live functions so instrumentation keeps its module scope. The
// complete emitted body is syntax-checked here; the packed browser suite executes its declarations.
export function createPreparationWiring(dependencies, code = virtual.get(join(src, 'modular', 'prepare.ts'))) {
  assert.equal(typeof code, 'string');
  new Function(...Object.keys(dependencies), executable(code) + result);
  for (const [name, implementation] of Object.entries(authored)) {
    const declaration = `\n${name === 'addPreparedFeatures' ? 'export ' : ''}${implementation.toString()}\n`;
    assert.equal(code.split(declaration).length, 2, `Expected one emitted ${name} declaration`);
    code = code.replace(declaration, '\n');
  }
  const injected = { ...dependencies, ...authored };
  return new Function(...Object.keys(injected), executable(code) + result)(...Object.values(injected));
}
