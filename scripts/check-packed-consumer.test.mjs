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

test('models the raw core ceiling as the reviewed baseline plus the named allowances', () => {
  const block = checkerSource.match(/const coreRawBudget = \{(?<body>[\s\S]*?)\n\};/u);
  assert.ok(block?.groups?.body, 'coreRawBudget must remain an auditable named budget model');

  const terms = Object.fromEntries(
    [...block.groups.body.matchAll(/^\s*(?<name>[A-Za-z][A-Za-z0-9]*):\s*(?<value>[\d_]+),$/gmu)]
      .map((match) => [match.groups.name, Number(match.groups.value.replaceAll('_', ''))]),
  );

  assert.deepEqual(terms, {
    reviewedBaselineBytes: 3_700_000,
    stableRootRegistrationAllowanceBytes: 200_000,
    reviewedRemediationAllowanceBytes: 20_000,
  });
  assert.equal(
    terms.reviewedBaselineBytes +
      terms.stableRootRegistrationAllowanceBytes +
      terms.reviewedRemediationAllowanceBytes,
    3_920_000,
  );
  assert.match(
    checkerSource,
    /maxRawBytes:\s*coreRawBudget\.reviewedBaselineBytes\s*\+\s*coreRawBudget\.stableRootRegistrationAllowanceBytes\s*\+\s*coreRawBudget\.reviewedRemediationAllowanceBytes\s*,/u,
    'the core bundle entry must use every reviewed term instead of a second unexplained ceiling',
  );
});

test('keeps the packed button canary aligned with the reviewed granular hard budget', () => {
  const button = checkerSource.match(
    /button:\s*\{[\s\S]*?maxGzipBytes:\s*(?<kilobytes>\d+)\s*\*\s*1024,[\s\S]*?\n\s*\},/u,
  );
  assert.ok(button?.groups?.kilobytes, 'the packed button entry must keep an explicit KiB ceiling');
  assert.equal(
    Number(button.groups.kilobytes),
    bundleBudgets['dist/components/forms/button/button.js'],
  );
});
