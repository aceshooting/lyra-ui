import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertRegularSourcePath,
  commitSourceWritePlan,
  parseSourceJson,
  readSourceSnapshot,
} from './source-fixture-io.mjs';
import { validateTranslationReviews } from './translation-review.mjs';

const SCHEMA_VERSION = 2;
const SCHEMA_PATH = './translation-reviews.schema.json';
const INDEX_KEYS = ['$schema', 'schemaVersion', 'source', 'upstreamLocaleBreadth', 'releasePlan', 'localeIds'];
const AGGREGATE_HEADER_KEYS = INDEX_KEYS.slice(0, -1);
const LOCALE_ID_RE = /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/u;

const defaultPackageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateLocaleId(locale, label) {
  if (typeof locale !== 'string' || !LOCALE_ID_RE.test(locale)) {
    throw new Error(`${label} must be a safe BCP 47 source locale ID`);
  }
  try {
    Intl.getCanonicalLocales(locale);
  } catch {
    throw new Error(`${label} is not a valid BCP 47 source locale ID`);
  }
}

function validateHeader(header) {
  if (!plainObject(header)) throw new Error('translation review index must be a JSON object');
  if (JSON.stringify(Object.keys(header)) !== JSON.stringify(INDEX_KEYS)) {
    throw new Error(`translation review index keys must be exactly ${INDEX_KEYS.join(', ')}`);
  }
  if (header.$schema !== SCHEMA_PATH) throw new Error(`translation review index $schema must be ${SCHEMA_PATH}`);
  if (header.schemaVersion !== SCHEMA_VERSION) throw new Error(`translation review index schemaVersion must be ${SCHEMA_VERSION}`);
  if (!plainObject(header.source) || !plainObject(header.upstreamLocaleBreadth) || !plainObject(header.releasePlan)) {
    throw new Error('translation review index source, upstreamLocaleBreadth, and releasePlan must be objects');
  }
  if (!Array.isArray(header.localeIds) || header.localeIds.length === 0) {
    throw new Error('translation review index localeIds must be a non-empty sorted locale ID list');
  }
  const canonicalIds = new Map();
  for (const locale of header.localeIds) {
    validateLocaleId(locale, 'translation review index locale ID');
    const [canonical] = Intl.getCanonicalLocales(locale);
    const prior = canonicalIds.get(canonical);
    if (prior) throw new Error(`locale source IDs ${prior} and ${locale} both canonicalize to ${canonical}`);
    canonicalIds.set(canonical, locale);
  }
  if (new Set(header.localeIds).size !== header.localeIds.length ||
      JSON.stringify(header.localeIds) !== JSON.stringify([...header.localeIds].sort())) {
    throw new Error('translation review index localeIds must be sorted and unique');
  }
}

function readJsonObject(source, label) {
  let value;
  try {
    value = parseSourceJson(source, label);
  } catch (error) {
    throw new Error(`${label} could not be read as JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!plainObject(value)) throw new Error(`${label} must be a JSON object`);
  return value;
}

function reviewSourceRoot(packageDir) {
  return path.join(packageDir, 'scripts/fixtures/translation-reviews');
}

/** Read the authored shared index and one complete record for each source locale ID. */
export async function readTranslationReviewSources({ packageDir = defaultPackageDir } = {}) {
  const sourceRoot = reviewSourceRoot(packageDir);
  assertRegularSourcePath(packageDir, sourceRoot, { directory: true });
  const rootEntries = (await readdir(sourceRoot)).sort();
  if (!rootEntries.includes('index.json')) throw new Error('translation review index.json is missing');
  if (!rootEntries.includes('locales')) throw new Error('translation review locales directory is missing');
  if (JSON.stringify(rootEntries) !== JSON.stringify(['index.json', 'locales'])) {
    throw new Error('translation review source directory must contain only index.json and locales/');
  }
  const indexSnapshot = readSourceSnapshot(packageDir, 'scripts/fixtures/translation-reviews/index.json');
  const header = readJsonObject(indexSnapshot.original, 'translation review index.json');
  validateHeader(header);

  const localesDir = path.join(sourceRoot, 'locales');
  assertRegularSourcePath(packageDir, localesDir, { directory: true });

  const names = await readdir(localesDir);
  if (names.length === 0) throw new Error('translation review source has no locale records');
  const records = [];
  const snapshots = [indexSnapshot];
  const seen = new Set();
  for (const name of names.sort()) {
    if (!name.endsWith('.json')) throw new Error(`unknown locale source file ${name}`);
    const sourceId = name.slice(0, -'.json'.length);
    validateLocaleId(sourceId, `locale source filename ${name}`);
    if (seen.has(sourceId)) throw new Error(`duplicate locale source ID ${sourceId}`);
    seen.add(sourceId);
    const recordSnapshot = readSourceSnapshot(
      packageDir,
      `scripts/fixtures/translation-reviews/locales/${name}`,
    );
    const record = readJsonObject(recordSnapshot.original, `locale source ${name}`);
    if (record.locale !== sourceId) {
      throw new Error(`record locale ${String(record.locale)} does not match source ID ${sourceId}`);
    }
    records.push(record);
    snapshots.push(recordSnapshot);
  }

  records.sort((left, right) => left.locale < right.locale ? -1 : left.locale > right.locale ? 1 : 0);
  if (JSON.stringify(records.map(({ locale }) => locale)) !== JSON.stringify(header.localeIds)) {
    const actual = records.map(({ locale }) => locale);
    const missing = header.localeIds.filter((locale) => !actual.includes(locale));
    const unknown = actual.filter((locale) => !header.localeIds.includes(locale));
    throw new Error(
      `translation review locale source index does not match files; missing=[${missing.join(', ')}], unknown=[${unknown.join(', ')}]`,
    );
  }

  return { header, records, snapshots };
}

/** Assemble authored sources into the long-standing schema-2 aggregate shape. */
export function assembleTranslationReviews(sources) {
  if (!plainObject(sources)) throw new Error('translation review sources must be an object');
  const { header, records } = sources;
  validateHeader(header);
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error('translation review sources must contain locale records');
  }

  const byLocale = new Map();
  for (const record of records) {
    if (!plainObject(record)) throw new Error('translation review locale record must be an object');
    validateLocaleId(record.locale, 'translation review record locale');
    if (byLocale.has(record.locale)) throw new Error(`duplicate locale source ID ${record.locale}`);
    byLocale.set(record.locale, record);
  }
  const sortedLocales = [...byLocale.keys()].sort();
  if (JSON.stringify(sortedLocales) !== JSON.stringify(header.localeIds)) {
    throw new Error('translation review records do not match index localeIds');
  }

  return {
    ...structuredClone(Object.fromEntries(AGGREGATE_HEADER_KEYS.map((key) => [key, header[key]]))),
    catalogs: sortedLocales.map((locale) => structuredClone(byLocale.get(locale))),
  };
}

export function renderTranslationReviews(fixture) {
  return `${JSON.stringify(fixture, null, 2)}\n`;
}

/** Read sources and fail if the checked-in aggregate is not their exact deterministic rendering. */
export async function readTranslationReviews({ packageDir = defaultPackageDir } = {}) {
  const sources = await readTranslationReviewSources({ packageDir });
  const fixture = assembleTranslationReviews(sources);
  const expected = renderTranslationReviews(fixture);
  const aggregate = readSourceSnapshot(packageDir, 'scripts/fixtures/translation-reviews.json');
  const actual = aggregate.original;
  if (actual !== expected) throw new Error('scripts/fixtures/translation-reviews.json is stale; regenerate it from translation review sources');
  commitSourceWritePlan({
    root: packageDir,
    entries: [
      ...sources.snapshots.map((snapshot) => ({ ...snapshot, expected: snapshot.original })),
      { ...aggregate, expected: aggregate.original },
    ],
  });
  return fixture;
}

/** Write only the generated schema-2 aggregate from already validated source slices. */
export async function writeTranslationReviews({ packageDir = defaultPackageDir, validationContext } = {}) {
  const sources = await readTranslationReviewSources({ packageDir });
  const fixture = assembleTranslationReviews(sources);
  if (!plainObject(validationContext)) throw new Error('translation review writer requires validationContext');
  const errors = validateTranslationReviews(fixture, validationContext);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  const { file, original } = readSourceSnapshot(
    packageDir,
    'scripts/fixtures/translation-reviews.json',
    { missing: true },
  );
  commitSourceWritePlan({
    root: packageDir,
    entries: [
      ...sources.snapshots.map((snapshot) => ({ ...snapshot, expected: snapshot.original })),
      { file, original, expected: renderTranslationReviews(fixture) },
    ],
  });
  return fixture;
}
