import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assembleTranslationReviews,
  readTranslationReviewSources,
  readTranslationReviews,
  renderTranslationReviews,
  writeTranslationReviews,
} from './translation-review-source.mjs';
import { readTranslationCatalogInventory } from './check-translations.mjs';
import { validateTranslationReviews } from './translation-review.mjs';

const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const legacyPath = path.join(packageDir, 'scripts/fixtures/translation-reviews.json');

async function validationContext() {
  const inventory = await readTranslationCatalogInventory({ packageDir });
  const upstream = JSON.parse(await readFile(path.join(packageDir, 'scripts/fixtures/upstream-tags.json'), 'utf8'));
  return {
    englishEntries: inventory.englishEntries,
    catalogs: inventory.catalogs,
    upstreamPins: { webawesome: upstream.webawesome, shoelace: upstream.shoelace },
  };
}

async function temporaryPackage() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'lyra-review-source-'));
  const target = path.join(root, 'scripts/fixtures/translation-reviews');
  await mkdir(path.join(target, 'locales'), { recursive: true });
  return { root, target };
}

async function writeFixture(target, header, records) {
  await writeFile(path.join(target, 'index.json'), `${JSON.stringify(header, null, 2)}\n`);
  for (const record of records) {
    await writeFile(path.join(target, 'locales', `${record.locale}.json`), `${JSON.stringify(record, null, 2)}\n`);
  }
}

test('locale-owned sources assemble byte-for-byte to the schema-2 aggregate', async () => {
  const legacyBytes = await readFile(legacyPath, 'utf8');
  const fixture = JSON.parse(legacyBytes);
  const sources = await readTranslationReviewSources({ packageDir });
  const assembled = assembleTranslationReviews(sources);

  assert.equal(fixture.catalogs.length, 66);
  assert.deepEqual(assembled, fixture);
  assert.equal(renderTranslationReviews(assembled), legacyBytes);
  assert.deepEqual(assembled.catalogs.map(({ locale }) => locale), [...assembled.catalogs.map(({ locale }) => locale)].sort());
  assert.equal(assembled.catalogs.find(({ locale }) => locale === 'tl').locale, 'tl');
  assert.equal(assembled.catalogs.find(({ locale }) => locale === 'pnb').locale, 'pnb');
  assert.deepEqual(await readTranslationReviews({ packageDir }), fixture);
});

test('source reader rejects missing, unknown, duplicate, and mismatched locale slices', async (t) => {
  const original = await readTranslationReviewSources({ packageDir });
  const header = original.header;
  const fa = original.records.find(({ locale }) => locale === 'fa');

  await t.test('missing index', async () => {
    const { root } = await temporaryPackage();
    try {
      await assert.rejects(readTranslationReviewSources({ packageDir: root }), /index\.json.*missing/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('unknown source file', async () => {
    const { root, target } = await temporaryPackage();
    try {
      await writeFixture(target, header, [fa]);
      await writeFile(path.join(target, 'locales', 'unknown.json'), '{"locale":"unknown"}\n');
      await assert.rejects(readTranslationReviewSources({ packageDir: root }), /unknown=\[unknown\]/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('unknown source directory entry', async () => {
    const { root, target } = await temporaryPackage();
    try {
      await writeFixture(target, header, [fa]);
      await writeFile(path.join(target, 'README.md'), 'unowned file\n');
      await assert.rejects(readTranslationReviewSources({ packageDir: root }), /contain only index\.json and locales/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('missing locale source file', async () => {
    const { root, target } = await temporaryPackage();
    try {
      await writeFixture(target, header, [fa]);
      await assert.rejects(readTranslationReviewSources({ packageDir: root }), /missing=\[[^\]]+\]/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('file identity must match record identity', async () => {
    const { root, target } = await temporaryPackage();
    try {
      await writeFile(path.join(target, 'index.json'), `${JSON.stringify(header, null, 2)}\n`);
      await writeFile(path.join(target, 'locales', 'fa.json'), `${JSON.stringify({ ...fa, locale: 'fil' })}\n`);
      await assert.rejects(readTranslationReviewSources({ packageDir: root }), /record locale fil.*does not match source ID fa/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('locale source symlinks are rejected', async () => {
    const { root, target } = await temporaryPackage();
    try {
      await writeFile(path.join(target, 'index.json'), `${JSON.stringify(header, null, 2)}\n`);
      const outside = path.join(root, 'outside.json');
      await writeFile(outside, `${JSON.stringify(fa)}\n`);
      await symlink(outside, path.join(target, 'locales', 'fa.json'));
      await assert.rejects(readTranslationReviewSources({ packageDir: root }), /symlinks forbidden/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('duplicate nested JSON keys are rejected, including escaped duplicate names', async () => {
    const { root, target } = await temporaryPackage();
    try {
      await writeFixture(target, header, original.records);
      await writeFile(path.join(target, 'locales', 'fa.json'), '{"locale":"fa","reviewer":{"status":"approved","status":"pending-independent-review"}}\n');
      await assert.rejects(readTranslationReviewSources({ packageDir: root }), /duplicate JSON key.*status/u);
      await writeFile(path.join(target, 'locales', 'fa.json'), '{"locale":"fa","\\u006cocale":"different"}\n');
      await assert.rejects(readTranslationReviewSources({ packageDir: root }), /duplicate JSON key.*locale/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('source path rejects symlinked ancestors', async () => {
    const { root } = await temporaryPackage();
    const outside = path.join(root, 'outside');
    try {
      await mkdir(path.join(outside, 'fixtures', 'translation-reviews', 'locales'), { recursive: true });
      await writeFixture(path.join(outside, 'fixtures', 'translation-reviews'), header, original.records);
      await rm(path.join(root, 'scripts'), { recursive: true, force: true });
      await symlink(outside, path.join(root, 'scripts'));
      await assert.rejects(readTranslationReviewSources({ packageDir: root }), /symlink/u);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

test('assembler and aggregate reader reject malformed source data and stale aggregate bytes', async (t) => {
  const original = await readTranslationReviewSources({ packageDir });
  const fa = original.records.find(({ locale }) => locale === 'fa');

  assert.throws(
    () => assembleTranslationReviews({ ...original, records: [...original.records, fa] }),
    /duplicate locale source ID fa/u,
  );
  assert.throws(
    () => assembleTranslationReviews({ ...original, header: { ...original.header, schemaVersion: 3 } }),
    /schemaVersion must be 2/u,
  );
  assert.throws(
    () => assembleTranslationReviews({ ...original, records: original.records.slice(1) }),
    /do not match index localeIds/u,
  );

  const { root, target } = await temporaryPackage();
  try {
    await writeFixture(target, original.header, original.records);
    const aggregate = assembleTranslationReviews(original);
    await writeFile(path.join(target, '..', 'translation-reviews.json'), `${JSON.stringify(aggregate, null, 2)}\n`);
    const loaded = await readTranslationReviews({ packageDir: root });
    assert.deepEqual(loaded, aggregate);
    const changedRecord = structuredClone(fa);
    changedRecord.translator.evidence = `${changedRecord.translator.evidence} changed`;
    await writeFile(path.join(target, 'locales', 'fa.json'), `${JSON.stringify(changedRecord, null, 2)}\n`);
    await assert.rejects(readTranslationReviews({ packageDir: root }), /translation-reviews\.json is stale/u);
    await writeFile(path.join(target, '..', 'translation-reviews.json'), '{}\n');
    await assert.rejects(readTranslationReviews({ packageDir: root }), /translation-reviews\.json is stale/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('source records preserve locale IDs instead of deduplicating canonical aliases', async () => {
  const sources = await readTranslationReviewSources({ packageDir });
  const fixture = assembleTranslationReviews(sources);
  assert.deepEqual(
    fixture.catalogs.filter(({ locale }) => locale === 'tl' || locale === 'pnb').map(({ locale }) => locale),
    ['pnb', 'tl'],
  );
});

test('assembler rejects canonical identity collisions without rewriting source IDs', async () => {
  const original = await readTranslationReviewSources({ packageDir });
  const fil = { ...structuredClone(original.records.find(({ locale }) => locale === 'tl')), locale: 'fil' };
  const records = [...original.records, fil];
  const localeIds = [...original.header.localeIds, 'fil'].sort();
  assert.throws(
    () => assembleTranslationReviews({ header: { ...original.header, localeIds }, records }),
    /both canonicalize to fil/u,
  );
});

test('writer validates review evidence before mutation and safely replaces only a regular aggregate', async (t) => {
  const sources = await readTranslationReviewSources({ packageDir });
  const aggregate = assembleTranslationReviews(sources);
  const context = await validationContext();

  await t.test('valid sources write the exact aggregate', async () => {
    const { root, target } = await temporaryPackage();
    try {
      await writeFixture(target, sources.header, sources.records);
      const written = await writeTranslationReviews({ packageDir: root, validationContext: context });
      assert.deepEqual(written, aggregate);
      assert.equal(await readFile(path.join(target, '..', 'translation-reviews.json'), 'utf8'), renderTranslationReviews(aggregate));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('stale catalog hash leaves existing aggregate untouched', async () => {
    const { root, target } = await temporaryPackage();
    try {
      const changed = structuredClone(sources.records);
      changed.find(({ locale }) => locale === 'fa').catalog.sha256 = `sha256:${'0'.repeat(64)}`;
      await writeFixture(target, sources.header, changed);
      const aggregatePath = path.join(target, '..', 'translation-reviews.json');
      const original = renderTranslationReviews(aggregate);
      await writeFile(aggregatePath, original);
      await assert.rejects(
        writeTranslationReviews({ packageDir: root, validationContext: context }),
        /catalog\.sha256 is stale/u,
      );
      assert.equal(await readFile(aggregatePath, 'utf8'), original);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('fabricated native evidence leaves existing aggregate untouched', async () => {
    const { root, target } = await temporaryPackage();
    try {
      const changed = structuredClone(sources.records);
      const native = changed.find(({ locale }) => locale === 'fa');
      native.reviewTier = 'native-speaker';
      await writeFixture(target, sources.header, changed);
      const aggregatePath = path.join(target, '..', 'translation-reviews.json');
      const original = renderTranslationReviews(aggregate);
      await writeFile(aggregatePath, original);
      await assert.rejects(
        writeTranslationReviews({ packageDir: root, validationContext: context }),
        /reviewer\.(identity|catalogSha256|evidenceUrl)/u,
      );
      assert.equal(await readFile(aggregatePath, 'utf8'), original);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('output symlink cannot redirect aggregate replacement', async () => {
    const { root, target } = await temporaryPackage();
    const outside = path.join(root, 'outside.json');
    try {
      await writeFixture(target, sources.header, sources.records);
      const sentinel = 'leave me alone\n';
      await writeFile(outside, sentinel);
      await symlink(outside, path.join(target, '..', 'translation-reviews.json'));
      await assert.rejects(
        writeTranslationReviews({ packageDir: root, validationContext: context }),
        /symlink/u,
      );
      assert.equal(await readFile(outside, 'utf8'), sentinel);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  await t.test('output path rejects symlinked ancestors', async () => {
    const { root } = await temporaryPackage();
    const actual = path.join(root, 'actual');
    try {
      await mkdir(path.join(actual, 'fixtures', 'translation-reviews', 'locales'), { recursive: true });
      await writeFixture(path.join(actual, 'fixtures', 'translation-reviews'), sources.header, sources.records);
      await rm(path.join(root, 'scripts'), { recursive: true, force: true });
      await symlink(actual, path.join(root, 'scripts'));
      await assert.rejects(
        writeTranslationReviews({ packageDir: root, validationContext: context }),
        /symlink/u,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
