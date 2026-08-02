import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
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
  const stylesDir = join(fixtureRoot, 'src', 'styles');
  const translationsDir = join(fixtureRoot, 'src', 'translations');
  mkdirSync(fixtureScripts, { recursive: true });
  mkdirSync(fixtureInventory, { recursive: true });
  mkdirSync(componentDir, { recursive: true });
  mkdirSync(stylesDir, { recursive: true });
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
  writeFileSync(join(fixtureRoot, 'src', 'autoloader.ts'), 'export function discover() {}\n');
  writeFileSync(join(fixtureRoot, 'src', 'autoloader-cdn.ts'), "start(document);\n");
  writeFileSync(join(fixtureRoot, 'src', 'ssr-loader.ts'), "installHydrationSupport();\n");
  writeFileSync(join(stylesDir, 'native.css'), '.lr-native button { color: var(--lr-color-text); }\n');
  writeFileSync(join(stylesDir, 'utilities.css'), '.lr-stack { display: flex; }\n');
  writeFileSync(join(fixtureRoot, 'src', 'theme.css'), ':root { --lr-test: 1; }\n');
  writeFileSync(join(translationsDir, 'fr.ts'), "registerLyraLocale('fr', {});\n");
  writeFileSync(
    join(fixtureRoot, 'package.json'),
    `${JSON.stringify(
      {
        name: 'side-effects-fixture',
        exports: {
          './autoloader-cdn.js': {
            types: './dist/autoloader-cdn.d.ts',
            default: './dist/autoloader-cdn.js',
          },
          './ssr-loader.js': {
            types: './dist/ssr-loader.d.ts',
            default: './dist/ssr-loader.js',
          },
        },
        sideEffects: ['./stale.js'],
      },
      null,
      2,
    )}\n`,
  );

  execFileSync(process.execPath, [join(fixtureScripts, 'generate-side-effects.mjs')], {
    cwd: fixtureRoot,
    stdio: 'pipe',
  });

  const first = readFileSync(join(fixtureRoot, 'package.json'), 'utf8');
  const generated = JSON.parse(first).sideEffects;
  assert.deepEqual(generated, [...generated].sort(), 'generated entries must be deterministic and sorted');
  assert.deepEqual(generated, [
    './dist/autoloader-cdn.js',
    './dist/components/forms/index.js',
    './dist/components/forms/test-control/test-control.js',
    './dist/lyra.js',
    './dist/ssr-loader.js',
    './dist/styles/native.css',
    './dist/styles/utilities.css',
    './dist/theme.css',
    './dist/translations/fr.js',
    './src/autoloader-cdn.ts',
    './src/components/forms/index.ts',
    './src/components/forms/test-control/test-control.ts',
    './src/lyra.ts',
    './src/ssr-loader.ts',
    './src/styles/native.css',
    './src/styles/utilities.css',
    './src/theme.css',
    './src/translations/fr.ts',
  ]);
  assert.equal(generated.includes('./src/autoloader.ts'), false, 'manual autoloader must stay tree-shakeable');
  assert.equal(generated.includes('./dist/autoloader.js'), false, 'compiled manual autoloader must stay tree-shakeable');

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

  writeFileSync(
    join(fixtureInventory, 'component-inventory.json'),
    `${JSON.stringify({ schemaVersion: 1, components: [] }, null, 2)}\n`,
  );
  unlinkSync(join(fixtureRoot, 'src', 'autoloader-cdn.ts'));
  assert.throws(
    () =>
      execFileSync(process.execPath, [join(fixtureScripts, 'generate-side-effects.mjs')], {
        cwd: fixtureRoot,
        stdio: 'pipe',
      }),
    /Command failed/,
    'deleting a curated side-effect source must fail closed',
  );
  writeFileSync(join(fixtureRoot, 'src', 'autoloader-cdn.ts'), "start(document);\n");

  const stalePackage = JSON.parse(readFileSync(join(fixtureRoot, 'package.json'), 'utf8'));
  delete stalePackage.exports['./ssr-loader.js'];
  writeFileSync(join(fixtureRoot, 'package.json'), `${JSON.stringify(stalePackage, null, 2)}\n`);
  assert.throws(
    () =>
      execFileSync(process.execPath, [join(fixtureScripts, 'generate-side-effects.mjs')], {
        cwd: fixtureRoot,
        stdio: 'pipe',
      }),
    /Command failed/,
    'a curated side-effect source without its matching public export must fail closed',
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('sideEffects generator retention and determinism tests passed.');
