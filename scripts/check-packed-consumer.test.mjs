import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const checkerSource = await readFile(
  new URL('check-packed-consumer.mjs', import.meta.url),
  'utf8',
);

test('models the raw core ceiling as the reviewed baseline plus the stable-root allowance', () => {
  const block = checkerSource.match(/const coreRawBudget = \{(?<body>[\s\S]*?)\n\};/u);
  assert.ok(block?.groups?.body, 'coreRawBudget must remain an auditable named budget model');

  const terms = Object.fromEntries(
    [...block.groups.body.matchAll(/^\s*(?<name>[A-Za-z][A-Za-z0-9]*):\s*(?<value>[\d_]+),$/gmu)]
      .map((match) => [match.groups.name, Number(match.groups.value.replaceAll('_', ''))]),
  );

  assert.deepEqual(terms, {
    reviewedBaselineBytes: 3_700_000,
    stableRootRegistrationAllowanceBytes: 200_000,
  });
  assert.equal(
    terms.reviewedBaselineBytes + terms.stableRootRegistrationAllowanceBytes,
    3_900_000,
  );
  assert.match(
    checkerSource,
    /maxRawBytes:\s*coreRawBudget\.reviewedBaselineBytes\s*\+\s*coreRawBudget\.stableRootRegistrationAllowanceBytes\s*,/u,
    'the core bundle entry must use both reviewed terms instead of a second unexplained ceiling',
  );
});
