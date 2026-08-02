#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  messageSnapshot,
  validateTranslationReviews,
} from './translation-review.mjs';

const englishEntries = [
  ['noData', 'No data'],
  ['fileSizeUnitKb', 'KB'],
  ['toolCount', { one: '{count} tool', other: '{count} tools' }],
];
const persianEntries = [
  ['noData', 'داده‌ای موجود نیست'],
  ['fileSizeUnitKb', 'KB'],
  ['toolCount', { one: '{count} ابزار', other: '{count} ابزار' }],
];
const catalogs = new Map([['fa', persianEntries]]);
const upstreamPins = {
  webawesome: { version: '3.11.0', commit: '1d05f1a4468336de35d2c61282a953ef07da3bdf' },
  shoelace: { version: '2.20.1', commit: '25bd8ec776609670a932f21390be59a495df497d' },
};

function fixture() {
  const source = messageSnapshot(englishEntries);
  return {
    $schema: './translation-reviews.schema.json',
    schemaVersion: 1,
    source: {
      path: 'src/internal/localization.ts#DEFAULT_STRINGS',
      ...source,
    },
    upstreamLocaleBreadth: {
      webAwesome: { ...upstreamPins.webawesome, locales: ['en', 'fa'] },
      shoelace: { ...upstreamPins.shoelace, locales: ['en', 'fa'] },
      normalizedUnion: ['en', 'fa'],
    },
    releasePlan: {
      builtIn: ['en'],
      shippedBeforeV8: [],
      v8ReleaseExpansion: ['fa'],
      deferred: [],
      regionalExtensions: [],
      selectionRationale: ['Persian supplies requested right-to-left coverage.'],
    },
    catalogs: [
      {
        locale: 'fa',
        direction: 'rtl',
        source,
        catalog: messageSnapshot(persianEntries),
        translator: {
          status: 'complete-original',
          role: 'project localization contributor',
          completedAt: '2026-08-02',
          evidence: 'Authored from the English meanings; generated text supplied structure only.',
        },
        reviewer: {
          status: 'pending-independent-review',
          role: 'independent localization reviewer',
          reviewedAt: null,
          evidence: null,
        },
        englishIdenticalAllowlist: [
          {
            messagePath: 'fileSizeUnitKb',
            rationale: 'KB is the internationally recognized binary-size unit abbreviation.',
          },
        ],
      },
    ],
  };
}

const pending = fixture();
assert.deepEqual(
  validateTranslationReviews(pending, {
    englishEntries,
    catalogs,
    upstreamPins,
    requireApproved: false,
  }),
  [],
  'a structurally complete pending review must be valid during authoring',
);

assert.match(
  validateTranslationReviews(pending, {
    englishEntries,
    catalogs,
    upstreamPins,
  }).join('\n'),
  /pending independent review/,
  'the release gate must fail closed until an independent reviewer approves the catalog',
);

const approved = fixture();
approved.catalogs[0].reviewer = {
  status: 'approved',
  role: 'independent localization reviewer',
  reviewedAt: '2026-08-03',
  evidence: 'Checked every message, placeholder, plural form, direction, and technical term.',
};
assert.deepEqual(
  validateTranslationReviews(approved, { englishEntries, catalogs, upstreamPins }),
  [],
  'an independently reviewed catalog tied to current hashes must pass',
);

const staleSource = fixture();
staleSource.source.keyCount -= 1;
assert.match(
  validateTranslationReviews(staleSource, {
    englishEntries,
    catalogs,
    upstreamPins,
    requireApproved: false,
  }).join('\n'),
  /source\.keyCount/,
  'a source-key addition must invalidate the recorded review snapshot',
);

const staleCatalog = fixture();
staleCatalog.catalogs[0].catalog.sha256 = `sha256:${'0'.repeat(64)}`;
assert.match(
  validateTranslationReviews(staleCatalog, {
    englishEntries,
    catalogs,
    upstreamPins,
    requireApproved: false,
  }).join('\n'),
  /catalog.*sha256 is stale/,
  'translation edits must invalidate the reviewed catalog hash',
);

const missingAllowlist = fixture();
missingAllowlist.catalogs[0].englishIdenticalAllowlist = [];
assert.match(
  validateTranslationReviews(missingAllowlist, {
    englishEntries,
    catalogs,
    upstreamPins,
    requireApproved: false,
  }).join('\n'),
  /fileSizeUnitKb/,
  'English-identical technical text must be explicitly justified',
);

const pluralLeak = fixture();
const pluralLeakEntries = structuredClone(persianEntries);
pluralLeakEntries[2][1].one = englishEntries[2][1].one;
pluralLeak.catalogs[0].catalog = messageSnapshot(pluralLeakEntries);
assert.match(
  validateTranslationReviews(pluralLeak, {
    englishEntries,
    catalogs: new Map([['fa', pluralLeakEntries]]),
    upstreamPins,
    requireApproved: false,
  }).join('\n'),
  /toolCount\.one/,
  'an English-identical plural branch must be reviewed independently of its sibling branches',
);

const staleAllowlist = fixture();
staleAllowlist.catalogs[0].englishIdenticalAllowlist.push({
  messagePath: 'noData',
  rationale: 'This rationale is intentionally stale for the checker test.',
});
assert.match(
  validateTranslationReviews(staleAllowlist, {
    englishEntries,
    catalogs,
    upstreamPins,
    requireApproved: false,
  }).join('\n'),
  /stale English-identical allowlist entries: noData/,
  'allowlist entries may not outlive the identical source text they justified',
);

const brokenUnion = fixture();
brokenUnion.upstreamLocaleBreadth.normalizedUnion = ['en'];
assert.match(
  validateTranslationReviews(brokenUnion, {
    englishEntries,
    catalogs,
    upstreamPins,
    requireApproved: false,
  }).join('\n'),
  /sorted union/,
  'the documented locale breadth must remain the exact union of both pins',
);

const schemaPath = fileURLToPath(new URL('./fixtures/translation-reviews.schema.json', import.meta.url));
const schema = JSON.parse(readFileSync(schemaPath, 'utf8'));
assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
assert.equal(schema.properties.schemaVersion.const, 1);
assert.ok(schema.$defs.catalogReview.properties.reviewer);
assert.ok(schema.$defs.catalogReview.properties.englishIdenticalAllowlist);

console.log('translation review schema, freshness, allowlist, and approval tests passed.');
