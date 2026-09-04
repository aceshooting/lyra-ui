import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
      terms.v10RemediationSweepAllowanceBytes,
    4_685_000,
  );
  assert.match(
    checkerSource,
    /maxRawBytes:\s*coreRawBudget\.establishedBaselineBytes\s*\+\s*coreRawBudget\.stableRootRegistrationAllowanceBytes\s*\+\s*coreRawBudget\.crossComponentContractAllowanceBytes\s*\+\s*coreRawBudget\.boundedDataResilienceAllowanceBytes\s*\+\s*coreRawBudget\.interactionAccessibilityAllowanceBytes\s*\+\s*coreRawBudget\.accessibilityStyleCorrectionAllowanceBytes\s*\+\s*coreRawBudget\.featureCapabilityAllowanceBytes\s*\+\s*coreRawBudget\.overlayHydrationContractAllowanceBytes\s*\+\s*coreRawBudget\.crossFamilyRemediationSweepAllowanceBytes\s*\+\s*coreRawBudget\.devModeDiagnosticsAllowanceBytes\s*\+\s*coreRawBudget\.publicContractV10AllowanceBytes\s*\+\s*coreRawBudget\.v10RemediationSweepAllowanceBytes\s*,/u,
    'the core bundle entry must use every named term instead of a second unexplained ceiling',
  );
});

test('keeps the packed button canary aligned with the authoritative granular hard budget', () => {
  const budgetPath = 'dist/components/forms/button/button.js';
  // 31 KiB since the base class gained its cross-document render-root fallback (shared by every
  // bundle); still the tightest standalone canary.
  assert.equal(
    bundleBudgets[budgetPath],
    31,
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
