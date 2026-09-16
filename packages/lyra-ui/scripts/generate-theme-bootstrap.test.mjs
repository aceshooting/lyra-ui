import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

import {
  checkThemeBootstrapAsset,
  generateThemeBootstrapAsset,
  readBuiltThemeBootstrap,
} from './generate-theme-bootstrap.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = mkdtempSync(join(tmpdir(), 'lyra-theme-bootstrap-'));

function writeBuiltModule(bootstrap) {
  writeFileSync(
    join(fixtureRoot, 'dist', 'theme', 'theme.js'),
    `export const lyraThemeBootstrap = ${JSON.stringify(bootstrap)};\nexport const other = 1;\n`,
  );
}

// A close approximation of the real shape: a self-invoking IIFE, single-line, exactly what
// `dist/theme/theme.js`'s own `lyraThemeBootstrap` looks like after esbuild syntax minification --
// this is the fixture, not a re-derivation of the real algorithm (which lives only in theme.ts).
const FIRST_BOOTSTRAP = "(function(k,a){try{localStorage.getItem(k)}catch{}})(\"lyra-theme\",[\"data-lr-theme\",\"data-theme\"]);";
const SECOND_BOOTSTRAP = "(function(k,a){try{localStorage.getItem(k)}catch{}})(\"custom-key\",[\"data-lr-theme\",\"data-theme\"]);";

// A fixture carrying a faithful (but hand-kept, not re-imported) mirror of
// `applyStoredThemeBeforePaint`'s config-resolution prelude from `src/theme/theme.ts` -- same
// validation rules, deliberately not the real ramp-derivation algorithm (which lives only in
// theme.ts and is exercised by theme.test.ts). It records what it resolved onto the document
// element instead of touching localStorage, so this test can assert the resolution result
// directly. Used below to prove the generator's byte-for-byte copy of a prelude-bearing bootstrap
// is itself an executable asset that resolves script-tag configuration correctly once written to
// disk and read back -- i.e. this test executes the GENERATED file, not a re-derivation of the
// source function.
const CONFIG_BOOTSTRAP = "(function(k,a){try{"
  + "var s=document.currentScript;"
  + "if(s){"
  + "var rk=s.getAttribute('data-lr-theme-storage-key');"
  + "if(rk!==null&&rk.length>0&&rk.length<=200)k=rk;"
  + "var ra=s.getAttribute('data-lr-theme-attributes');"
  + "if(ra!==null){"
  + "var parsed=ra.trim().length>0?ra.trim().split(/\\s+/):[];"
  + "var pattern=/^data-[a-z0-9]+(?:-[a-z0-9]+)*$/;"
  + "var ok=parsed.length>0&&parsed.length<=8;"
  + "var seen={};"
  + "for(var i=0;ok&&i<parsed.length;i++){"
  + "var name=parsed[i];"
  + "if(!pattern.test(name)||name.length>64||seen[name])ok=false;"
  + "seen[name]=true;"
  + "}"
  + "if(ok)a=parsed;"
  + "}"
  + "}"
  + "document.documentElement.setAttribute('data-resolved-key',k);"
  + "document.documentElement.setAttribute('data-resolved-attributes',a.join(' '));"
  + "}catch(e){}})(\"lyra-theme\",[\"data-lr-theme\",\"data-theme\"]);";

/** A minimal `document.currentScript`-shaped fake carrying only the attributes given. */
function fakeCurrentScript(attributes) {
  return { getAttribute: (name) => (Object.prototype.hasOwnProperty.call(attributes, name) ? attributes[name] : null) };
}

/**
 * Executes real generated JavaScript source in a fresh Node vm context against a minimal fake
 * `document`, and returns the attributes the bootstrap resolved onto `documentElement`. This is
 * the file's bytes actually running, not a call into the TypeScript source.
 */
function runGeneratedBootstrap(source, currentScript) {
  const attributes = {};
  const documentElement = {
    getAttribute: (name) => (name in attributes ? attributes[name] : null),
    setAttribute: (name, value) => {
      attributes[name] = String(value);
    },
  };
  const sandbox = { document: { currentScript, documentElement } };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return attributes;
}

try {
  mkdirSync(join(fixtureRoot, 'dist', 'theme'), { recursive: true });
  mkdirSync(join(fixtureRoot, 'scripts'), { recursive: true });
  writeFileSync(
    join(fixtureRoot, 'scripts', 'generate-theme-bootstrap.mjs'),
    readFileSync(join(scriptDir, 'generate-theme-bootstrap.mjs'), 'utf8'),
  );
  writeFileSync(
    join(fixtureRoot, 'scripts', 'is-main-module.mjs'),
    readFileSync(join(scriptDir, 'is-main-module.mjs'), 'utf8'),
  );

  // 1. Missing built module fails closed (never emits a wrong/empty asset).
  await assert.rejects(
    () => readBuiltThemeBootstrap(fixtureRoot),
    /does not exist/,
    'a missing dist/theme/theme.js must fail closed',
  );

  // 2. Generation copies the built module's export verbatim -- byte for byte, not re-derived.
  writeBuiltModule(FIRST_BOOTSTRAP);
  const generated = await generateThemeBootstrapAsset(fixtureRoot);
  assert.equal(generated, FIRST_BOOTSTRAP);
  const assetPath = join(fixtureRoot, 'dist', 'theme', 'theme-bootstrap.js');
  assert.equal(readFileSync(assetPath, 'utf8'), FIRST_BOOTSTRAP, 'asset bytes must equal the built export exactly');

  // 3. --check passes immediately after generation.
  const freshCheck = await checkThemeBootstrapAsset(fixtureRoot);
  assert.deepEqual(freshCheck.findings, []);

  // 4. A rebuild that changes the exported string (simulating an edit to theme.ts followed by
  // `pnpm build`, but not yet by asset regeneration) must be caught by --check.
  writeBuiltModule(SECOND_BOOTSTRAP);
  const staleCheck = await checkThemeBootstrapAsset(fixtureRoot);
  assert.deepEqual(staleCheck.findings, ['dist/theme/theme-bootstrap.js is stale or missing relative to dist/theme/theme.js']);

  // 5. Regenerating resolves the staleness.
  await generateThemeBootstrapAsset(fixtureRoot);
  assert.equal(readFileSync(assetPath, 'utf8'), SECOND_BOOTSTRAP);
  const resolvedCheck = await checkThemeBootstrapAsset(fixtureRoot);
  assert.deepEqual(resolvedCheck.findings, []);

  // 6. The CLI wiring itself: `--check` and generation exit with the expected codes out of
  // process, exactly like every other generated-artifact script in this repo.
  const script = join(fixtureRoot, 'scripts', 'generate-theme-bootstrap.mjs');
  execFileSync(process.execPath, [script, '--check'], { cwd: fixtureRoot, stdio: 'pipe' });

  writeBuiltModule(FIRST_BOOTSTRAP);
  assert.throws(
    () => execFileSync(process.execPath, [script, '--check'], { cwd: fixtureRoot, stdio: 'pipe' }),
    /Command failed/,
    '--check must reject a stale asset over the CLI too',
  );
  execFileSync(process.execPath, [script], { cwd: fixtureRoot, stdio: 'pipe' });
  assert.equal(readFileSync(assetPath, 'utf8'), FIRST_BOOTSTRAP);
  execFileSync(process.execPath, [script, '--check'], { cwd: fixtureRoot, stdio: 'pipe' });

  assert.throws(
    () => execFileSync(process.execPath, [script, '--bogus'], { cwd: fixtureRoot, stdio: 'pipe' }),
    /Command failed/,
    'an unknown flag must fail closed',
  );

  // 7. The generated asset resolves script-tag configuration correctly once written to disk and
  // read back -- executing the GENERATED file, not the in-process source function.
  writeBuiltModule(CONFIG_BOOTSTRAP);
  await generateThemeBootstrapAsset(fixtureRoot);
  const generatedSource = readFileSync(assetPath, 'utf8');
  assert.equal(generatedSource, CONFIG_BOOTSTRAP, 'the config-bearing fixture must also copy verbatim');

  // No attributes: identical to today's baked-in defaults.
  assert.deepEqual(runGeneratedBootstrap(generatedSource, fakeCurrentScript({})), {
    'data-resolved-key': 'lyra-theme',
    'data-resolved-attributes': 'data-lr-theme data-theme',
  });

  // null currentScript (module/async misuse): falls back to the defaults, never throws.
  assert.doesNotThrow(() => runGeneratedBootstrap(generatedSource, null));
  assert.deepEqual(runGeneratedBootstrap(generatedSource, null), {
    'data-resolved-key': 'lyra-theme',
    'data-resolved-attributes': 'data-lr-theme data-theme',
  });

  // A custom storage key is honored.
  assert.equal(
    runGeneratedBootstrap(generatedSource, fakeCurrentScript({ 'data-lr-theme-storage-key': 'custom-key' }))['data-resolved-key'],
    'custom-key',
  );

  // A custom attribute list replaces the default list.
  assert.equal(
    runGeneratedBootstrap(generatedSource, fakeCurrentScript({ 'data-lr-theme-attributes': 'data-app-mode' }))['data-resolved-attributes'],
    'data-app-mode',
  );

  // Each rejected attribute-name class falls back to the default attribute list.
  for (const rejected of ['onload', 'style', 'class', 'id', 'x y', 'data-x"y', 'data-x=y', 'data-lr-theme data-lr-theme', '']) {
    assert.equal(
      runGeneratedBootstrap(generatedSource, fakeCurrentScript({ 'data-lr-theme-attributes': rejected }))['data-resolved-attributes'],
      'data-lr-theme data-theme',
      `rejected attribute list ${JSON.stringify(rejected)} must fall back to the defaults`,
    );
  }

  // An oversized key falls back to the default.
  assert.equal(
    runGeneratedBootstrap(generatedSource, fakeCurrentScript({ 'data-lr-theme-storage-key': 'a'.repeat(201) }))['data-resolved-key'],
    'lyra-theme',
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('theme bootstrap asset generation and freshness tests passed.');
