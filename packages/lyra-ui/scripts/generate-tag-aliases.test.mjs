import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { create, ts } from '@custom-elements-manifest/analyzer';
import { PACKAGE_GENERATORS } from '../../../scripts/release-prepare.mjs';
import { compactManifest } from './manifest-compact.mjs';
import { applyComponentMetadataToManifest, currentHistoryRecord, sha256 } from './component-metadata.mjs';
import { nextWriteMetadata } from './generate-component-metadata.mjs';

import {
  deriveTagAliases,
  generateTagAliases,
  registersTag,
} from './generate-tag-aliases.mjs';

const inventory = {
  schemaVersion: 1,
  components: [
    { tag: 'lr-table', registrationModule: 'src/components/lr-table.ts' },
    { tag: 'lr-input', registrationModule: 'src/components/lr-input.ts' },
  ],
};

const registration = (tag, className) =>
  `export * from './fixture/${tag}.class.js';\n` +
  `import { ${className} } from './fixture/${tag}.class.js';\n` +
  "import { defineElement } from '../internal/prefix.js';\n" +
  `defineElement('${tag.slice(3)}', ${className});\n`;

test('derives sorted tag-shaped registration entries', () => {
  assert.deepEqual(deriveTagAliases(inventory), [
    {
      tag: 'lr-input',
      registrationModule: 'src/components/lr-input.ts',
      sourceFile: 'src/components/lr-input.ts',
      exportPath: './components/lr-input.js',
      distFile: 'dist/components/lr-input.js',
    },
    {
      tag: 'lr-table',
      registrationModule: 'src/components/lr-table.ts',
      sourceFile: 'src/components/lr-table.ts',
      exportPath: './components/lr-table.js',
      distFile: 'dist/components/lr-table.js',
    },
  ]);
  assert.equal(registersTag(registration('lr-input', 'LyraInput'), 'lr-input'), true);
  assert.equal(registersTag(registration('lr-input', 'LyraInput'), 'lr-input-group'), false);
});

test('rejects duplicate tags and registration modules other than the tag-shaped entry', () => {
  assert.throws(
    () => deriveTagAliases({ ...inventory, components: [...inventory.components, inventory.components[0]] }),
    /duplicate tag lr-table/,
  );
  assert.throws(
    () => deriveTagAliases({
      schemaVersion: 1,
      components: [{ tag: 'lr-table', registrationModule: 'src/components/data/table/table.ts' }],
    }),
    /lr-table: invalid registrationModule \(expected src\/components\/lr-table\.ts\)/,
  );
});

test('reports missing, non-registering and orphaned entries without writing', (context) => {
  const packageDir = mkdtempSync(path.join(tmpdir(), 'lyra-tag-aliases-'));
  context.after(() => rmSync(packageDir, { recursive: true, force: true }));
  mkdirSync(path.join(packageDir, 'scripts', 'fixtures'), { recursive: true });
  mkdirSync(path.join(packageDir, 'src', 'components'), { recursive: true });
  writeFileSync(
    path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json'),
    JSON.stringify(inventory),
  );

  assert.deepEqual(generateTagAliases({ packageDir }).stale, ['src/components/lr-input.ts', 'src/components/lr-table.ts']);
  assert.deepEqual(readdirSync(path.join(packageDir, 'src', 'components')), [], 'verification never authors entries');

  const inputFile = path.join(packageDir, 'src', 'components', 'lr-input.ts');
  writeFileSync(inputFile, registration('lr-input', 'LyraInput'));
  writeFileSync(path.join(packageDir, 'src', 'components', 'lr-table.ts'), registration('lr-table', 'LyraTable'));
  assert.deepEqual(generateTagAliases({ packageDir }).stale, []);

  writeFileSync(inputFile, "export * from './fixture/lr-input.class.js';\n");
  assert.deepEqual(generateTagAliases({ packageDir }).stale, ['src/components/lr-input.ts']);
  writeFileSync(inputFile, registration('lr-input', 'LyraInput'));

  const orphan = path.join(packageDir, 'src', 'components', 'lr-old.ts');
  writeFileSync(orphan, registration('lr-old', 'LyraOld'));
  assert.deepEqual(generateTagAliases({ packageDir }).stale, ['src/components/lr-old.ts']);
  assert.equal(readFileSync(orphan, 'utf8'), registration('lr-old', 'LyraOld'), 'an orphan is reported, never deleted');
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
  test(`${label} records the final manifest hash with tag-shaped registration entries`, (context) => {
    const packageDir = mkdtempSync(path.join(tmpdir(), 'lyra-manifest-alias-order-'));
    context.after(() => rmSync(packageDir, { recursive: true, force: true }));
    const componentDir = path.join(packageDir, 'src/components');
    const inventoryFile = path.join(packageDir, 'scripts/fixtures/component-inventory.json');
    mkdirSync(path.dirname(inventoryFile), { recursive: true });
    mkdirSync(path.join(componentDir, 'utility/widget'), { recursive: true });
    writeFileSync(path.join(componentDir, 'utility/widget/widget.class.ts'),
      'export class LyraWidget extends HTMLElement {}\n');
    // The tag-shaped entry is the authored registration module; the inventory names it.
    writeFileSync(path.join(componentDir, 'lr-widget.ts'),
      "export * from './utility/widget/widget.class.js';\nimport { LyraWidget } from './utility/widget/widget.class.js';\n" +
      "import { defineElement } from '../internal/prefix.js';\ndefineElement('widget', LyraWidget);\n");
    const previousInventory = { schemaVersion: 1, components: [] };
    const currentInventory = { schemaVersion: 1, components: [
      { tag: 'lr-widget', registrationModule: 'src/components/lr-widget.ts' },
    ] };
    writeFileSync(inventoryFile, JSON.stringify(previousInventory));

    const version = '1.0.0';
    const renderManifest = manifest => `${JSON.stringify(manifest)}\n`;
    const emptyManifest = { schemaVersion: '1.0.0', modules: [] };
    const taggedCurrent = {
      ...currentHistoryRecord(version, renderManifest(emptyManifest), emptyManifest),
      tag: 'lyra-ui@1.0.0', manifestPresent: true,
    };
    let metadata = {
      profiles: { fixture: {
        status: 'experimental', rationale: 'An explicit fixture component profile.',
        graduationCriteria: 'Verify the generated public contract before release.',
      } },
      assignments: { fixture: ['lr-widget'] }, deprecations: [], exportDeprecations: [],
      history: { releases: [], taggedCurrent, current: currentHistoryRecord(version, renderManifest(emptyManifest), emptyManifest) },
    };
    const immutableHistory = structuredClone({ releases: metadata.history.releases, taggedCurrent });
    const analyze = () => {
      const manifest = create({
        modules: readdirSync(componentDir, { recursive: true })
          .filter(file => file.endsWith('.ts')).sort()
          .map(file => ts.createSourceFile(
            `src/components/${file.replaceAll(path.sep, '/')}`,
            readFileSync(path.join(componentDir, file), 'utf8'), ts.ScriptTarget.ES2015, true,
          )),
      });
      applyComponentMetadataToManifest(metadata, manifest, { packageVersion: version });
      return compactManifest(manifest);
    };
    let writtenManifest;
    let manifestWrites = 0;
    let metadataWrites = 0;
    for (const step of steps) {
      if (step === 'component-inventory') writeFileSync(inventoryFile, JSON.stringify(currentInventory));
      if (step === 'tag-aliases') assert.deepEqual(generateTagAliases({ packageDir }).stale, [], 'entries verify against the refreshed inventory');
      if (step === 'registrations') {
        assert.equal(metadataWrites, 1, 'package exports consume the refreshed metadata aggregate');
        assert.deepEqual(generateTagAliases({ packageDir }).stale, [], 'full registration generation sees complete entries');
      }
      if (step === 'component-metadata' || step === 'component-metadata:history') {
        metadata = nextWriteMetadata(metadata, {
          releases: metadata.history.releases, taggedCurrent: metadata.history.taggedCurrent,
          current: currentHistoryRecord(version, renderManifest(writtenManifest), writtenManifest),
          rolloverCurrent: false, packageVersion: version,
        });
        const projected = structuredClone(writtenManifest);
        applyComponentMetadataToManifest(metadata, projected, { packageVersion: version });
        const predicted = compactManifest(projected);
        metadata.history.current = currentHistoryRecord(version, renderManifest(predicted), predicted);
        metadataWrites += 1;
      }
      if (step === 'manifest') {
        writtenManifest = analyze();
        manifestWrites += 1;
      }
    }

    assert.equal(manifestWrites, 3, 'bootstrap, inventory-refreshed, and final annotated analysis each run once');
    assert.equal(metadataWrites, 1, 'metadata records the complete input without repeated reconciliation');
    assert.deepEqual(writtenManifest, analyze(), 'a check after regeneration must see exactly the final written manifest');
    assert.equal(metadata.history.current.manifestSha256, sha256(renderManifest(writtenManifest)),
      'metadata predicts the exact final bytes, including the trailing newline and entry modules');
    assert.deepEqual({ releases: metadata.history.releases, taggedCurrent: metadata.history.taggedCurrent }, immutableHistory);
    assert.deepEqual(generateTagAliases({ packageDir }).stale, []);
    const modules = new Map(writtenManifest.modules.map(module => [module.path, module]));
    assert.ok(modules.has('src/components/lr-widget.ts'), 'the tag-shaped entry is a manifest module');
    assert.deepEqual(modules.get('src/components/lr-widget.ts').exports?.[0], {
      kind: 'js', name: '*',
      declaration: { name: '*', module: 'src/components/utility/widget/widget.class.js' },
    }, 'the tag-shaped entry re-exports its class module');
  });
}
