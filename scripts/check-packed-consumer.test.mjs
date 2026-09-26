import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { compactBuildCss } from '../packages/lyra-ui/scripts/compact-build-css.mjs';

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

test('models the raw core ceiling as the established baseline plus capability allowances', () => {
  const block = checkerSource.match(/const coreRawBudget = \{(?<body>[\s\S]*?)\n\};/u);
  assert.ok(block?.groups?.body, 'coreRawBudget must remain an inspectable named budget model');

  const terms = Object.fromEntries(
    [...block.groups.body.matchAll(/^\s*(?<name>[A-Za-z][A-Za-z0-9]*):\s*(?<value>[\d_]+),$/gmu)]
      .map((match) => [match.groups.name, Number(match.groups.value.replaceAll('_', ''))]),
  );

  assert.deepEqual(terms, {
    establishedBaselineBytes: 3_700_000,
    stableRootRegistrationAllowanceBytes: 200_000,
    crossComponentContractAllowanceBytes: 35_000,
    boundedDataResilienceAllowanceBytes: 10_000,
    interactionAccessibilityAllowanceBytes: 10_000,
    accessibilityStyleCorrectionAllowanceBytes: 25_000,
    featureCapabilityAllowanceBytes: 40_000,
    overlayHydrationContractAllowanceBytes: 25_000,
    crossFamilyRemediationSweepAllowanceBytes: 610_000,
    devModeDiagnosticsAllowanceBytes: 20_000,
    publicContractV10AllowanceBytes: 10_000,
    v10RemediationSweepAllowanceBytes: 0,
    shadcnV21ProgrammeAllowanceBytes: 120_000,
  });
  assert.equal(
      terms.establishedBaselineBytes +
      terms.stableRootRegistrationAllowanceBytes +
      terms.crossComponentContractAllowanceBytes +
      terms.boundedDataResilienceAllowanceBytes +
      terms.interactionAccessibilityAllowanceBytes +
      terms.accessibilityStyleCorrectionAllowanceBytes +
      terms.featureCapabilityAllowanceBytes +
      terms.overlayHydrationContractAllowanceBytes +
      terms.crossFamilyRemediationSweepAllowanceBytes +
      terms.devModeDiagnosticsAllowanceBytes +
      terms.publicContractV10AllowanceBytes +
      terms.v10RemediationSweepAllowanceBytes +
      terms.shadcnV21ProgrammeAllowanceBytes,
    4_805_000,
  );
  assert.match(
    checkerSource,
    /maxRawBytes:\s*coreRawBudget\.establishedBaselineBytes\s*\+\s*coreRawBudget\.stableRootRegistrationAllowanceBytes\s*\+\s*coreRawBudget\.crossComponentContractAllowanceBytes\s*\+\s*coreRawBudget\.boundedDataResilienceAllowanceBytes\s*\+\s*coreRawBudget\.interactionAccessibilityAllowanceBytes\s*\+\s*coreRawBudget\.accessibilityStyleCorrectionAllowanceBytes\s*\+\s*coreRawBudget\.featureCapabilityAllowanceBytes\s*\+\s*coreRawBudget\.overlayHydrationContractAllowanceBytes\s*\+\s*coreRawBudget\.crossFamilyRemediationSweepAllowanceBytes\s*\+\s*coreRawBudget\.devModeDiagnosticsAllowanceBytes\s*\+\s*coreRawBudget\.publicContractV10AllowanceBytes\s*\+\s*coreRawBudget\.v10RemediationSweepAllowanceBytes\s*\+\s*coreRawBudget\.shadcnV21ProgrammeAllowanceBytes\s*,/u,
    'the core bundle entry must use every named term instead of a second unexplained ceiling',
  );
});

test('keeps the packed button canary aligned with the authoritative granular hard budget', () => {
  const budgetPath = 'dist/components/forms/button/button.js';
  // Re-measured for the 21.0.0 release: 32,763 reviewed gzip bytes. The granular authority requires
  // a whole-KiB integer here, so this canary is 32 rather than the 2% headroom the other entries
  // take, and it stays the tightest standalone ceiling in the file.
  assert.equal(
    bundleBudgets[budgetPath],
    32,
    'the granular button entry must retain an explicit KiB ceiling',
  );
  assert.match(
    checkerSource,
    /const buttonGranularBudgetKilobytes = granularBundleBudgets\[BUTTON_GRANULAR_ENTRY\];/u,
    'the packed canary must read the granular entry instead of copying its value',
  );
  assert.match(
    checkerSource,
    /button:\s*\{[\s\S]*?maxGzipBytes:\s*buttonGranularBudgetKilobytes\s*\*\s*1024,[\s\S]*?\n\s*\},/u,
    'the packed button entry must derive its byte ceiling from the authoritative granular budget',
  );
  assert.doesNotMatch(
    checkerSource,
    /button:\s*\{[\s\S]*?maxGzipBytes:\s*\d+\s*\*\s*1024,[\s\S]*?\n\s*\},/u,
    'the packed canary must not reintroduce a second literal KiB ceiling',
  );
  assert.match(
    checkerSource,
    /if \(!Number\.isSafeInteger\(buttonGranularBudgetKilobytes\) \|\| buttonGranularBudgetKilobytes <= 0\) \{/u,
    'the packed canary must fail closed when its authoritative ceiling is missing or invalid',
  );
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

test('gates the shadcn preset canary on markers unique to each imported stylesheet', async () => {
  assert.match(
    checkerSource,
    /shadcnTheme: `import '@aceshooting\/lyra-ui\/themes\/shadcn\.css';\\nimport '@aceshooting\/lyra-ui\/theme\.css';/u,
    'the canary imports the preset first, then the base theme',
  );
  const branch = checkerSource.match(/if \(entry === 'shadcnTheme'\) \{(?<body>[\s\S]*?)\n {2}\}\n/u)?.groups?.body;
  assert.ok(branch, 'the shadcnTheme bundle assertion must remain inspectable');
  assert.match(branch, /SHADCN_THEME_RETENTION_MARKERS\.preset/u);
  assert.match(branch, /SHADCN_THEME_RETENTION_MARKERS\.baseTheme/u);
  // Present in BOTH files, so any one of them passes with the preset tree-shaken away.
  assert.doesNotMatch(branch, /--lr-theme-color-brand-fill-loud|'lr-theme-preset'/u);

  const markers = shadcnThemeRetentionMarkers();
  const packageDir = fileURLToPath(new URL('../packages/lyra-ui/', import.meta.url));
  const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//gu, '');
  const sources = {
    preset: stripComments(await readFile(join(packageDir, 'src', 'themes', 'shadcn.css'), 'utf8')),
    baseTheme: stripComments(await readFile(join(packageDir, 'src', 'theme.css'), 'utf8')),
  };
  // The tarball ships the build's minified copies, so check those forms too.
  const scratch = await mkdtemp(join(tmpdir(), 'lyra-packed-theme-markers-'));
  const minified = {};
  try {
    await copyFile(join(packageDir, 'src', 'themes', 'shadcn.css'), join(scratch, 'shadcn.css'));
    await copyFile(join(packageDir, 'src', 'theme.css'), join(scratch, 'theme.css'));
    await compactBuildCss(scratch);
    minified.preset = await readFile(join(scratch, 'shadcn.css'), 'utf8');
    minified.baseTheme = await readFile(join(scratch, 'theme.css'), 'utf8');
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }

  for (const [form, texts] of [['source', sources], ['minified', minified]]) {
    for (const [owner, other] of [['preset', 'baseTheme'], ['baseTheme', 'preset']]) {
      for (const marker of markers[owner]) {
        assert.match(texts[owner], marker, `${form} ${owner}: ${marker} must occur in the file it vouches for`);
        assert.doesNotMatch(texts[other], marker, `${form} ${other}: ${marker} must not occur in the other file`);
      }
    }
  }
});
