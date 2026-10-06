import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compactBuildCss } from '../packages/lyra-ui/scripts/compact-build-css.mjs';
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { suppliedPackedTarball } from './packed-tarball-input.mjs';

const checkerSource = await readFile(
  new URL('check-packed-consumer.mjs', import.meta.url),
  'utf8',
);
const bundleBudgets = JSON.parse(
  await readFile(
    new URL('../packages/lyra-ui/scripts/bundle-budgets.json', import.meta.url),
    'utf8',
  ),
);

test('caps the packed core raw sum at the reviewed core measurement plus unchanged headroom', () => {
  const block = checkerSource.match(/const coreRawBudget = \{(?<body>[\s\S]*?)\n\};/u);
  assert.ok(block?.groups?.body, 'coreRawBudget must remain an inspectable measured budget');

  const terms = Object.fromEntries(
    [...block.groups.body.matchAll(/^\s*(?<name>[A-Za-z][A-Za-z0-9]*):\s*(?<value>[\d_]+),$/gmu)]
      .map((match) => [match.groups.name, Number(match.groups.value.replaceAll('_', ''))]),
  );
  assert.deepEqual(terms, {
    reviewedCoreMeasurementBytes: 4_897_862,
    selectedRegressionHeadroomBytes: 16_000,
  });
  const ceiling = terms.reviewedCoreMeasurementBytes + terms.selectedRegressionHeadroomBytes;
  assert.equal(ceiling, 4_913_862);
  assert.ok(terms.selectedRegressionHeadroomBytes / terms.reviewedCoreMeasurementBytes < 0.005,
    'the existing raw regression headroom must remain below 0.5%');
  assert.match(
    checkerSource,
    /maxRawBytes:\s*coreRawBudget\.reviewedCoreMeasurementBytes\s*\+\s*coreRawBudget\.selectedRegressionHeadroomBytes\s*,/u,
    'the core bundle entry must use the exact reviewed measurement and selected headroom',
  );
  const overageGate = checkerSource.match(/if \(config\.maxRawBytes != null && output\.rawBytes > config\.maxRawBytes\) \{[\s\S]*?\n  \}/u)?.[0];
  assert.ok(overageGate, 'the packed raw-byte gate must remain inspectable');
  const inspectOverage = new Function('output', 'config', 'formatBytes', `const violations = []; ${overageGate}\nreturn violations;`);
  assert.deepEqual(inspectOverage({ rawBytes: ceiling }, { maxRawBytes: ceiling }, String), []);
  const overage = inspectOverage({ rawBytes: ceiling + 1 }, { maxRawBytes: ceiling }, String);
  assert.equal(overage.length, 1, 'one byte above the reviewed raw ceiling must fail');
  assert.match(overage[0], /exceeds budget/u);
});

test('keeps the packed button canary aligned with the authoritative granular hard budget', () => {
  const budgetPath = 'dist/components/forms/button/button.js';
  const ceilingBytes = bundleBudgets[budgetPath] * 1024;
  assert.ok(Number.isSafeInteger(ceilingBytes) && ceilingBytes > 0,
    'the granular button entry must retain an exact positive byte ceiling');
  assert.ok(ceilingBytes >= bundleBudgets.$reviewedGzipBytes[budgetPath],
    'the reviewed button measurement remains within the authoritative ceiling');
  assert.match(
    checkerSource,
    /const buttonGranularBudgetKilobytes = granularBundleBudgets\[BUTTON_GRANULAR_ENTRY\];/u,
    'the packed canary must read the granular entry instead of copying its value',
  );
  assert.match(
    checkerSource,
    /button:\s*\{[\s\S]*?maxGzipBytes:\s*buttonGranularBudgetBytes,[\s\S]*?\n\s*\},/u,
    'the packed button entry must derive its byte ceiling from the authoritative granular budget',
  );
  assert.doesNotMatch(
    checkerSource,
    /button:\s*\{[\s\S]*?maxGzipBytes:\s*\d+\s*\*\s*1024,[\s\S]*?\n\s*\},/u,
    'the packed canary must not reintroduce a second literal KiB ceiling',
  );
  const guard = checkerSource.match(/const buttonGranularBudgetKilobytes = [\s\S]*?(?=const optionalPeers)/u)?.[0];
  assert.ok(guard, 'the authority validation must remain inspectable');
  const validate = new Function('granularBundleBudgets', 'BUTTON_GRANULAR_ENTRY', `${guard}\nreturn buttonGranularBudgetBytes;`);
  assert.equal(validate(bundleBudgets, budgetPath), ceilingBytes);
  for (const invalid of [undefined, null, '30', NaN, Infinity, 0, -1, 30 + 0.5 / 1024]) {
    assert.throws(() => validate({ [budgetPath]: invalid }, budgetPath), TypeError,
      `invalid authority ${String(invalid)} must fail closed`);
  }
  const overageGate = checkerSource.match(/if \(config\.maxGzipBytes != null && output\.gzipBytes > config\.maxGzipBytes\) \{[\s\S]*?\n  \}/u)?.[0];
  assert.ok(overageGate, 'the actual packed-byte gate must remain inspectable');
  const inspectOverage = new Function('output', 'config', 'formatBytes', `const violations = []; ${overageGate}\nreturn violations;`);
  assert.deepEqual(inspectOverage({ gzipBytes: ceilingBytes }, { maxGzipBytes: ceilingBytes }, String), []);
  const overage = inspectOverage({ gzipBytes: ceilingBytes + 1 }, { maxGzipBytes: ceilingBytes }, String);
  assert.equal(overage.length, 1, 'one byte over the authoritative ceiling must fail');
  assert.match(overage[0], /exceeds budget/u);
});

test('gates packed form-label retention without modal overlay infrastructure', () => {
  assert.match(
    checkerSource,
    /formControlLabel:\s*\{\s*fixture:\s*'core',\s*\}/u,
    'a dedicated packed form-label graph must be built',
  );
  assert.match(
    checkerSource,
    /the packed form-control label installer was tree-shaken/u,
    'the packed graph must fail if the installer disappears',
  );
  assert.match(
    checkerSource,
    /the form-control label graph retained modal overlay modules/u,
    'the packed graph must reject modal overlay dependencies',
  );
});

test('gates packed anchored surfaces on a lean initial graph and a real first-open chunk', () => {
  for (const entry of ['anchoredPopover', 'anchoredCombobox']) {
    assert.match(
      checkerSource,
      new RegExp(`${entry}:\\s*\\{\\s*fixture:\\s*'core',\\s*\\}`, 'u'),
      `${entry} must have a dedicated packed graph`,
    );
  }
  assert.match(
    checkerSource,
    /initial graph eagerly retained the positioning runtime/u,
    'the packed graph must reject Floating UI in an anchored surface entry closure',
  );
  assert.match(
    checkerSource,
    /bundle lost its first-open positioning chunk/u,
    'the packed graph must require the deferred runtime chunk to remain reachable',
  );
  assert.match(
    checkerSource,
    /graph retained modal overlay modules/u,
    'the packed anchored graph must reject modal machinery',
  );
});

test('gates first-interaction registration without charging Lyra to the static shell', () => {
  for (const entry of ['firstInteractionPopover', 'firstInteractionCombobox']) {
    assert.match(
      checkerSource,
      new RegExp(`${entry}:\\s*\\{[\\s\\S]*?maxInitialGzipBytes:\\s*3_700,`, 'u'),
      `${entry} must preserve the reviewed 3.7 KiB shell ceiling`,
    );
  }
  assert.match(
    checkerSource,
    /pulled Lyra into the initial shell/u,
    'the packed graph must reject any eager Lyra module in this adoption shape',
  );
  assert.match(
    checkerSource,
    /lost its deferred registration/u,
    'the packed graph must still contain the requested component registration',
  );
  assert.match(
    checkerSource,
    /emitted no dynamic registration edge/u,
    'the packed graph must prove the registration stays behind first interaction',
  );
  assert.match(
    checkerSource,
    /lost its functional native fallback markup/u,
    'the packed fixture must retain a real pre-JavaScript disclosure or form control',
  );
  assert.match(
    checkerSource,
    /<details id="fallback-popover">/u,
    'the popover fixture must use a native disclosure fallback',
  );
  assert.match(
    checkerSource,
    /<datalist id="country-options">/u,
    'the combobox fixture must use a native datalist fallback',
  );
});

/** The checker's shadcnTheme marker table, evaluated from its source (importing it runs the gate). */
function shadcnThemeRetentionMarkers() {
  const declaration = checkerSource.match(
    /const SHADCN_THEME_RETENTION_MARKERS = (?<body>Object\.freeze\(\{[\s\S]*?\n\}\));/u,
  );
  assert.ok(declaration?.groups?.body, 'SHADCN_THEME_RETENTION_MARKERS must remain an inspectable top-level table');
  const markers = new Function(`return ${declaration.groups.body};`)();
  assert.ok(markers.preset.length > 0 && markers.baseTheme.length > 0, 'both marker lists must be non-empty');
  for (const marker of [...markers.preset, ...markers.baseTheme]) assert.ok(marker instanceof RegExp);
  return markers;
}

test('gates the shadcn look canary on exact installed stylesheet provenance and retained content', async () => {
  assert.match(
    checkerSource,
    /shadcnTheme: `import '@aceshooting\/lyra-ui\/looks\/shadcn\.css';\\nimport '@aceshooting\/lyra-ui\/theme\.css';/u,
    'the canary imports the look first, then the base theme',
  );
  const branch = checkerSource.match(/if \(entry === 'shadcnTheme'\) \{(?<body>[\s\S]*?)\n {2}\}\n/u)?.groups?.body;
  assert.ok(branch, 'the shadcnTheme bundle assertion must remain inspectable');
  assert.match(branch, /SHADCN_THEME_RETENTION_MARKERS\.preset/u);
  assert.match(branch, /SHADCN_THEME_RETENTION_MARKERS\.baseTheme/u);
  assert.match(branch, /bundledModuleIds/u, 'the shared default look requires emitted module provenance');
  assert.match(branch, /realpath/u, 'stylesheet identity must resolve the installed package path');

  const markers = shadcnThemeRetentionMarkers();
  const packageDir = fileURLToPath(new URL('../packages/lyra-ui/', import.meta.url));
  const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '');
  const sources = {
    preset: stripComments(await readFile(join(packageDir, 'src', 'looks', 'shadcn.css'), 'utf8')),
    baseTheme: stripComments(await readFile(join(packageDir, 'src', 'theme.css'), 'utf8')),
  };
  // The tarball ships the build's minified copies, so check those forms too.
  const scratch = await mkdtemp(join(tmpdir(), 'lyra-packed-theme-markers-'));
  const minified = {};
  try {
    await copyFile(join(packageDir, 'src', 'looks', 'shadcn.css'), join(scratch, 'shadcn.css'));
    await copyFile(join(packageDir, 'src', 'theme.css'), join(scratch, 'theme.css'));
    await compactBuildCss(scratch);
    minified.preset = await readFile(join(scratch, 'shadcn.css'), 'utf8');
    minified.baseTheme = await readFile(join(scratch, 'theme.css'), 'utf8');
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }

  const inspect = new Function('output', 'readFile', 'SHADCN_THEME_RETENTION_MARKERS', 'bundledModuleIds', 'fixtureDir', 'join', 'realpath', `
    return (async () => {
      const violations = [];
      ${branch}
      return violations;
    })();
  `);
  for (const [form, texts] of [['source', sources], ['minified', minified]]) {
    const installed = '/consumer/node_modules/@aceshooting/lyra-ui/dist';
    const inspectFiles = (files, moduleIds = files.map(file => `${installed}/${file === 'preset.css' ? 'looks/shadcn.css' : 'theme.css'}`)) => inspect(
      { files },
      async (file) => texts[file === 'preset.css' ? 'preset' : 'baseTheme'],
      markers,
      moduleIds,
      '/consumer',
      join,
      async path => path,
    );
    assert.deepEqual(await inspectFiles(['preset.css', 'base.css']), [], `${form}: both stylesheets retained`);
    const withoutPreset = await inspectFiles(['base.css']);
    assert.equal(withoutPreset.length, 1, `${form}: missing preset fails independently`);
    assert.match(withoutPreset[0], /no retained look/u);
    const withoutBase = await inspectFiles(['preset.css']);
    assert.equal(withoutBase.length, 1, `${form}: missing base fails independently`);
    assert.match(withoutBase[0], /no retained base theme/u);
    assert.equal((await inspectFiles([])).length, 2, `${form}: neither stylesheet retained`);
    assert.equal((await inspectFiles(['preset.css', 'base.css'], [`${installed}/theme.css`])).length, 1,
      `${form}: combined default content cannot substitute for the explicit look module`);
    assert.equal((await inspectFiles(['preset.css', 'base.css'], [`${installed}/looks/shadcn.css`])).length, 1,
      `${form}: both content streams cannot substitute for the explicit base module`);
    assert.equal((await inspectFiles(['preset.css', 'base.css'], [
      `/foreign${installed}/looks/shadcn.css`, `${installed}/theme.css`,
    ])).length, 1, `${form}: a matching foreign path suffix cannot substitute for the installed look`);
    assert.equal((await inspect(
      { files: ['combined.css'] }, async () => '', markers,
      [`${installed}/looks/shadcn.css`, `${installed}/theme.css`], '/consumer', join, async path => path,
    )).length, 2, `${form}: module provenance cannot substitute for emitted stylesheet content`);
    for (const owner of ['preset', 'baseTheme']) {
      for (const marker of markers[owner]) {
        assert.match(texts[owner], marker, `${form} ${owner}: ${marker} must occur in the file it vouches for`);
      }
    }
  }
});


test('packed migration inventory requires the complete split runtime and rejects additions or omissions', async () => {
  const preflight = checkerSource.match(
    /async function verifyPackedMigrationCli\(fixtureDir\) \{(?<body>[\s\S]*?)\n  const migrationFixture =/u,
  )?.groups?.body;
  assert.ok(preflight, 'the real CLI inventory preflight must be exercised');
  const inspect = new Function('fixtureDir', 'readdir', 'join', `return (async () => {${preflight}})();`);
  const files = [
    'component-inventory.mjs', 'html-comments.mjs', 'lyra-rename-ledger.mjs', 'migrate-wa.mjs',
    'migration-analysis.mjs', 'migration-contract.json', 'migration-contract.mjs',
    'migration-renames.mjs', 'migration-transforms.mjs',
  ];
  const check = (entries) => inspect('/fixture', async () => [...entries], join);
  await check([...files].reverse());
  for (const missing of files) {
    await assert.rejects(check(files.filter((file) => file !== missing)), /Packed migration runtime must contain only/u, missing);
  }
  for (const extra of ['unexpected.mjs', 'fixtures', 'migrate-wa.mjs']) {
    await assert.rejects(check([...files, extra]), /Packed migration runtime must contain only/u, extra);
  }
});

test('declares Lit directly for consumer-authored migration templates', () => {
  assert.match(checkerSource, /lit:\s*uiPackageJson\.dependencies\.lit/u);
  assert.match(checkerSource, /const uiTarball = \(await suppliedPackedTarball\(PACKED_TARBALL_ENVIRONMENT\.ui, \{[^}]*\}\)\) \?\? await pack\(uiPackage, tarballDir\);\s*if \(migrationArtifactsDir\) await preservePackedTarball/u);
  assert.match(checkerSource, /const flagsTarball = \(await suppliedPackedTarball\(PACKED_TARBALL_ENVIRONMENT\.flags, \{[^}]*\}\)\) \?\? await pack\(flagsPackage, tarballDir\);\s*if \(migrationArtifactsDir\) await preservePackedTarball/u);
});

test('a supplied tarball must be this checkout\'s package before any check uses it', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'lyra-supplied-tarball-'));
  try {
    const packageDir = join(directory, 'workspace');
    const destination = join(directory, 'destination');
    await mkdir(join(directory, 'stage', 'package'), { recursive: true });
    await mkdir(packageDir, { recursive: true });
    await mkdir(destination, { recursive: true });
    const workspace = { name: '@example/ui', version: '1.2.3', exports: { '.': './index.js' } };
    await writeFile(join(packageDir, 'package.json'), JSON.stringify(workspace));
    const pack = async (manifest, name) => {
      await writeFile(join(directory, 'stage', 'package', 'package.json'), JSON.stringify(manifest));
      const tarball = join(directory, name);
      execFileSync('tar', ['-czf', tarball, '-C', join(directory, 'stage'), 'package']);
      return tarball;
    };
    const environment = (tarball) => ({ LYRA_PACKED_UI_TARBALL: tarball });
    const options = { packageDir, destination, compareExports: true };

    assert.equal(await suppliedPackedTarball('LYRA_PACKED_UI_TARBALL', { ...options, environment: {} }), undefined);
    const good = await pack(workspace, 'good.tgz');
    const used = await suppliedPackedTarball('LYRA_PACKED_UI_TARBALL', { ...options, environment: environment(good) });
    assert.equal(used, join(destination, 'good.tgz'));
    assert.deepEqual(await readFile(used), await readFile(good));
    for (const [manifest, pattern] of [
      [{ ...workspace, version: '1.2.4' }, /version/u],
      [{ ...workspace, name: '@example/other' }, /name/u],
      [{ ...workspace, exports: { '.': './other.js' } }, /exports/u],
    ]) {
      const foreign = await pack(manifest, 'foreign.tgz');
      await assert.rejects(
        suppliedPackedTarball('LYRA_PACKED_UI_TARBALL', { ...options, environment: environment(foreign) }),
        pattern,
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
