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
  });
  assert.equal(
      terms.establishedBaselineBytes +
      terms.stableRootRegistrationAllowanceBytes +
      terms.crossComponentContractAllowanceBytes +
      terms.boundedDataResilienceAllowanceBytes +
      terms.interactionAccessibilityAllowanceBytes +
      terms.accessibilityStyleCorrectionAllowanceBytes +
      terms.featureCapabilityAllowanceBytes +
      terms.overlayHydrationContractAllowanceBytes,
    4_045_000,
  );
  assert.match(
    checkerSource,
    /maxRawBytes:\s*coreRawBudget\.establishedBaselineBytes\s*\+\s*coreRawBudget\.stableRootRegistrationAllowanceBytes\s*\+\s*coreRawBudget\.crossComponentContractAllowanceBytes\s*\+\s*coreRawBudget\.boundedDataResilienceAllowanceBytes\s*\+\s*coreRawBudget\.interactionAccessibilityAllowanceBytes\s*\+\s*coreRawBudget\.accessibilityStyleCorrectionAllowanceBytes\s*\+\s*coreRawBudget\.featureCapabilityAllowanceBytes\s*\+\s*coreRawBudget\.overlayHydrationContractAllowanceBytes\s*,/u,
    'the core bundle entry must use every named term instead of a second unexplained ceiling',
  );
});

test('keeps the packed button canary aligned with the authoritative granular hard budget', () => {
  const budgetPath = 'dist/components/forms/button/button.js';
  assert.equal(
    bundleBudgets[budgetPath],
    33,
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
