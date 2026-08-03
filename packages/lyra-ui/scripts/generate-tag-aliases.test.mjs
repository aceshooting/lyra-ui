import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  deriveTagAliases,
  generateTagAliases,
  renderTagAlias,
} from './generate-tag-aliases.mjs';

const inventory = {
  schemaVersion: 1,
  components: [
    {
      tag: 'lr-table',
      registrationModule: 'src/components/data/table/table.ts',
    },
    {
      tag: 'lr-input',
      registrationModule: 'src/components/forms/input/input.ts',
    },
  ],
};

test('derives sorted tag-shaped aliases that re-export registration entries', () => {
  const aliases = deriveTagAliases(inventory);
  assert.deepEqual(aliases, [
    {
      tag: 'lr-input',
      registrationModule: 'src/components/forms/input/input.ts',
      specifier: './forms/input/input.js',
      sourceFile: 'src/components/lr-input.ts',
      exportPath: './components/lr-input.js',
      distFile: 'dist/components/lr-input.js',
    },
    {
      tag: 'lr-table',
      registrationModule: 'src/components/data/table/table.ts',
      specifier: './data/table/table.js',
      sourceFile: 'src/components/lr-table.ts',
      exportPath: './components/lr-table.js',
      distFile: 'dist/components/lr-table.js',
    },
  ]);
  assert.equal(
    renderTagAlias(aliases[0]),
    '// GENERATED FILE — stable tag-shaped component entry point.\n' +
      '// Run `node scripts/generate-tag-aliases.mjs` to refresh.\n' +
      "export * from './forms/input/input.js';\n",
  );
});

test('rejects duplicate tags and registration paths outside the component tree', () => {
  assert.throws(
    () => deriveTagAliases({ ...inventory, components: [...inventory.components, inventory.components[0]] }),
    /duplicate tag lr-table/,
  );
  assert.throws(
    () => deriveTagAliases({
      schemaVersion: 1,
      components: [{ tag: 'lr-bad', registrationModule: 'src/internal/bad.ts' }],
    }),
    /lr-bad: invalid registrationModule/,
  );
});

test('write and check modes detect missing, changed, and generator-owned stale aliases', (context) => {
  const packageDir = mkdtempSync(path.join(tmpdir(), 'lyra-tag-aliases-'));
  context.after(() => rmSync(packageDir, { recursive: true, force: true }));
  mkdirSync(path.join(packageDir, 'scripts', 'fixtures'), { recursive: true });
  mkdirSync(path.join(packageDir, 'src', 'components'), { recursive: true });
  writeFileSync(
    path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json'),
    JSON.stringify(inventory),
  );

  assert.deepEqual(
    generateTagAliases({ packageDir, check: true }).stale,
    ['src/components/lr-input.ts', 'src/components/lr-table.ts'],
  );
  assert.equal(generateTagAliases({ packageDir }).stale.length, 2);
  assert.deepEqual(generateTagAliases({ packageDir, check: true }).stale, []);

  const inputFile = path.join(packageDir, 'src', 'components', 'lr-input.ts');
  writeFileSync(inputFile, `${readFileSync(inputFile, 'utf8')}// drift\n`);
  assert.deepEqual(generateTagAliases({ packageDir, check: true }).stale, ['src/components/lr-input.ts']);

  const staleFile = path.join(packageDir, 'src', 'components', 'lr-old.ts');
  writeFileSync(staleFile, '// GENERATED FILE — stable tag-shaped component entry point.\n');
  generateTagAliases({ packageDir });
  assert.equal(readFileSync(inputFile, 'utf8'), renderTagAlias(deriveTagAliases(inventory)[0]));
  assert.throws(() => readFileSync(staleFile, 'utf8'), /ENOENT/);
});
