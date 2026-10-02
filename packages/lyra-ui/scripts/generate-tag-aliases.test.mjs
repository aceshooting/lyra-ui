import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { create, ts } from '@custom-elements-manifest/analyzer';
import { PACKAGE_GENERATORS } from '../../../scripts/release-prepare.mjs';
import { compactManifest } from './manifest-compact.mjs';

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

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const packageScripts = JSON.parse(readFileSync(path.join(repoRoot, 'packages/lyra-ui/package.json'), 'utf8')).scripts;
const regenerationSequences = [
  ['repository regeneration', readFileSync(path.join(repoRoot, 'scripts/regen.sh'), 'utf8')
    .split('\n').map(line => /^pnpm (?:--filter @aceshooting\/lyra-ui )?(?:run )?([\w:-]+)$/u.exec(line)?.[1]).filter(Boolean)],
  ['package regeneration', packageScripts.regen.split(' && ').map(command => /^pnpm run ([\w:-]+)$/u.exec(command)?.[1]).filter(Boolean)],
  ['release preparation', PACKAGE_GENERATORS],
];

for (const [label, steps] of regenerationSequences) {
  test(`${label} analyzes added and removed tag aliases before publishing its final manifest`, (context) => {
    const packageDir = mkdtempSync(path.join(tmpdir(), 'lyra-manifest-alias-order-'));
    context.after(() => rmSync(packageDir, { recursive: true, force: true }));
    const componentDir = path.join(packageDir, 'src/components');
    const inventoryFile = path.join(packageDir, 'scripts/fixtures/component-inventory.json');
    mkdirSync(path.dirname(inventoryFile), { recursive: true });
    mkdirSync(path.join(componentDir, 'utility/widget'), { recursive: true });
    writeFileSync(path.join(componentDir, 'utility/widget/widget.ts'),
      "export class LyraWidget extends HTMLElement {}\ncustomElements.define('lr-widget', LyraWidget);\n");

    // The checkout has a removed tag's generated alias, while the newly authored tag has none.
    const previousInventory = { schemaVersion: 1, components: [
      { tag: 'lr-removed', registrationModule: 'src/components/utility/removed/removed.ts' },
    ] };
    const currentInventory = { schemaVersion: 1, components: [
      { tag: 'lr-widget', registrationModule: 'src/components/utility/widget/widget.ts' },
    ] };
    writeFileSync(inventoryFile, JSON.stringify(previousInventory));
    generateTagAliases({ packageDir });

    const analyze = () => compactManifest(create({
      modules: readdirSync(componentDir, { recursive: true })
        .filter(file => file.endsWith('.ts')).sort()
        .map(file => ts.createSourceFile(
          `src/components/${file.replaceAll(path.sep, '/')}`,
          readFileSync(path.join(componentDir, file), 'utf8'), ts.ScriptTarget.ES2015, true,
        )),
    }));
    let writtenManifest;
    let manifestWrites = 0;
    for (const step of steps) {
      if (step === 'component-inventory') writeFileSync(inventoryFile, JSON.stringify(currentInventory));
      if (step === 'registrations' || step === 'tag-aliases') generateTagAliases({ packageDir });
      if (step === 'manifest') {
        writtenManifest = analyze();
        manifestWrites += 1;
      }
    }

    assert.ok(manifestWrites >= 2, 'bootstrap analysis precedes final analysis');
    assert.deepEqual(writtenManifest, analyze(), 'a check after regeneration must see exactly the final written manifest');
    assert.deepEqual(generateTagAliases({ packageDir, check: true }).stale, []);
    const modules = new Map(writtenManifest.modules.map(module => [module.path, module]));
    assert.equal(modules.has('src/components/lr-removed.ts'), false, 'removed generated aliases leave the manifest');
    assert.ok(modules.has('src/components/lr-widget.ts'), 'new generated aliases enter the manifest');
    assert.deepEqual(modules.get('src/components/lr-widget.ts').exports, [{
      kind: 'js', name: '*',
      declaration: { name: '*', module: 'src/components/utility/widget/widget.js' },
    }], 'the stable alias retains its public registration re-export');
  });
}
