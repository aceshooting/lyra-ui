import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = mkdtempSync(join(tmpdir(), 'lyra-side-effects-'));

try {
  const fixtureScripts = join(fixtureRoot, 'scripts');
  const fixtureInventory = join(fixtureScripts, 'fixtures');
  const componentDir = join(fixtureRoot, 'src', 'components', 'forms', 'test-control');
  const familyDir = join(fixtureRoot, 'src', 'components', 'forms');
  const translationsDir = join(fixtureRoot, 'src', 'translations');
  mkdirSync(fixtureScripts, { recursive: true });
  mkdirSync(fixtureInventory, { recursive: true });
  mkdirSync(componentDir, { recursive: true });
  mkdirSync(translationsDir, { recursive: true });

  writeFileSync(
    join(fixtureScripts, 'generate-side-effects.mjs'),
    readFileSync(join(scriptDir, 'generate-side-effects.mjs'), 'utf8'),
  );
  writeFileSync(join(componentDir, 'test-control.class.ts'), 'export class TestControl {}\n');
  writeFileSync(join(componentDir, 'test-control.ts'), 'defineElement();\n');
  writeFileSync(
    join(fixtureInventory, 'component-inventory.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        components: [
          {
            tag: 'lr-test-control',
            classModule: 'src/components/forms/test-control/test-control.class.ts',
            registrationModule: 'src/components/forms/test-control/test-control.ts',
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(familyDir, 'index.ts'), "export * from './test-control/test-control.js';\n");
  writeFileSync(join(fixtureRoot, 'src', 'lyra.ts'), "import './components/forms/index.js';\n");
  writeFileSync(join(fixtureRoot, 'src', 'theme.css'), ':root { --lr-test: 1; }\n');
  writeFileSync(join(translationsDir, 'fr.ts'), "registerLyraLocale('fr', {});\n");
  writeFileSync(
    join(fixtureRoot, 'package.json'),
    `${JSON.stringify({ name: 'side-effects-fixture', sideEffects: ['./stale.js'] }, null, 2)}\n`,
  );

  execFileSync(process.execPath, [join(fixtureScripts, 'generate-side-effects.mjs')], {
    cwd: fixtureRoot,
    stdio: 'pipe',
  });

  const first = readFileSync(join(fixtureRoot, 'package.json'), 'utf8');
  const generated = JSON.parse(first).sideEffects;
  assert.deepEqual(generated, [...generated].sort(), 'generated entries must be deterministic and sorted');
  assert.deepEqual(generated, [
    './dist/components/forms/index.js',
    './dist/components/forms/test-control/test-control.js',
    './dist/lyra.js',
    './dist/theme.css',
    './dist/translations/fr.js',
    './src/components/forms/index.ts',
    './src/components/forms/test-control/test-control.ts',
    './src/lyra.ts',
    './src/theme.css',
    './src/translations/fr.ts',
  ]);

  execFileSync(process.execPath, [join(fixtureScripts, 'generate-side-effects.mjs')], {
    cwd: fixtureRoot,
    stdio: 'pipe',
  });
  assert.equal(
    readFileSync(join(fixtureRoot, 'package.json'), 'utf8'),
    first,
    'regeneration must be byte-for-byte idempotent',
  );

  writeFileSync(
    join(fixtureInventory, 'component-inventory.json'),
    `${JSON.stringify({ schemaVersion: 999, components: [] }, null, 2)}\n`,
  );
  assert.throws(
    () =>
      execFileSync(process.execPath, [join(fixtureScripts, 'generate-side-effects.mjs')], {
        cwd: fixtureRoot,
        stdio: 'pipe',
      }),
    /Command failed/,
    'an unknown inventory schema must fail closed instead of deleting component side effects',
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('sideEffects generator retention and determinism tests passed.');
