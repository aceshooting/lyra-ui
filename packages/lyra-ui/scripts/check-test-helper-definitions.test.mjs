import assert from 'node:assert/strict';
import test from 'node:test';
import { localHelperDefinitions } from './check-test-helper-definitions.mjs';

test('identifies new local copies of shared test helpers', () => {
  const source = 'function sinkTexts() {}\nasync function nextFrame() {}\nfunction fixture() {}';
  assert.deepEqual(localHelperDefinitions(source, 'src/example.test.ts'), [
    'src/example.test.ts:sinkTexts', 'src/example.test.ts:nextFrame',
  ]);
});
