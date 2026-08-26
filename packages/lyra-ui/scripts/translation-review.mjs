import { createHash } from 'node:crypto';

const TRANSLATION_REVIEW_SCHEMA_VERSION = 1;
const TRANSLATION_REVIEW_SCHEMA_PATH = './translation-reviews.schema.json';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function canonicalEntries(entries) {
  return JSON.stringify(
    entries.map(([key, message]) => [key, message]),
  );
}

/** A content-addressed snapshot of an ordered locale message map. */
export function messageSnapshot(entries) {
  return {
    keyCount: entries.length,
    sha256: `sha256:${createHash('sha256').update(canonicalEntries(entries)).digest('hex')}`,
  };
}

function sameArray(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sortedUniqueStrings(value) {
  return (
    Array.isArray(value) &&
    value.every((entry) => typeof entry === 'string' && entry.length > 0) &&
    new Set(value).size === value.length &&
    sameArray(value, [...value].sort())
  );
}

function validDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function englishIdenticalMessagePaths(englishEntries, translatedEntries) {
  const english = new Map(englishEntries);
  const identical = [];

  for (const [key, translated] of translatedEntries) {
    const source = english.get(key);
    if (source === undefined) continue;
    const sourceValues = new Set(typeof source === 'string' ? [source] : Object.values(source));
    if (typeof translated === 'string') {
      if (sourceValues.has(translated)) identical.push(key);
      continue;
    }
    for (const [category, text] of Object.entries(translated)) {
      if (sourceValues.has(text)) identical.push(`${key}.${category}`);
    }
  }

  return identical.sort();
}

function validateSnapshot(actual, recorded, label, errors) {
  if (!recorded || typeof recorded !== 'object' || Array.isArray(recorded)) {
    errors.push(`${label} must be a { keyCount, sha256 } snapshot`);
    return;
  }
  if (recorded.keyCount !== actual.keyCount) {
    errors.push(`${label}.keyCount is ${String(recorded.keyCount)}; current value is ${actual.keyCount}`);
  }
  if (recorded.sha256 !== actual.sha256) {
    errors.push(`${label}.sha256 is stale; current value is ${actual.sha256}`);
  }
}

/**
 * Validate the release-review ledger against the exact English source and translated catalogs.
 * The JSON Schema documents the persistent format; this function enforces the cross-file facts a
 * structural schema cannot express (pin agreement, locale partitioning, hashes, and review state).
 */
export function validateTranslationReviews(
  fixture,
  { englishEntries, catalogs, upstreamPins, requireApproved = true },
) {
  const errors = [];
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) {
    return ['translation review fixture must be a JSON object'];
  }
  if (fixture.$schema !== TRANSLATION_REVIEW_SCHEMA_PATH) {
    errors.push(`$schema must be "${TRANSLATION_REVIEW_SCHEMA_PATH}"`);
  }
  if (fixture.schemaVersion !== TRANSLATION_REVIEW_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${TRANSLATION_REVIEW_SCHEMA_VERSION}`);
  }

  const currentSource = messageSnapshot(englishEntries);
  validateSnapshot(currentSource, fixture.source, 'source', errors);
  if (fixture.source?.path !== 'src/internal/localization.ts#DEFAULT_STRINGS') {
    errors.push('source.path must identify src/internal/localization.ts#DEFAULT_STRINGS');
  }

  const breadth = fixture.upstreamLocaleBreadth;
  if (!breadth || typeof breadth !== 'object' || Array.isArray(breadth)) {
    errors.push('upstreamLocaleBreadth must be an object');
  } else {
    for (const [fixtureKey, pinKey] of [
      ['webAwesome', 'webawesome'],
      ['shoelace', 'shoelace'],
    ]) {
      const recorded = breadth[fixtureKey];
      const pin = upstreamPins?.[pinKey];
      if (!recorded || typeof recorded !== 'object' || Array.isArray(recorded)) {
        errors.push(`upstreamLocaleBreadth.${fixtureKey} must be an object`);
        continue;
      }
      if (recorded.version !== pin?.version || recorded.commit !== pin?.commit) {
        errors.push(
          `upstreamLocaleBreadth.${fixtureKey} pin must match the authoritative component inventory ` +
            `(${String(pin?.version)} at ${String(pin?.commit)})`,
        );
      }
      if (!sortedUniqueStrings(recorded.locales)) {
        errors.push(`upstreamLocaleBreadth.${fixtureKey}.locales must be sorted, unique locale tags`);
      }
    }

    const expectedUnion = [
      ...new Set([
        ...(Array.isArray(breadth.webAwesome?.locales) ? breadth.webAwesome.locales : []),
        ...(Array.isArray(breadth.shoelace?.locales) ? breadth.shoelace.locales : []),
      ]),
    ].sort();
    if (!sameArray(breadth.normalizedUnion, expectedUnion)) {
      errors.push('upstreamLocaleBreadth.normalizedUnion must be the sorted union of both pinned locale lists');
    }
  }

  const plan = fixture.releasePlan;
  const union = Array.isArray(breadth?.normalizedUnion) ? breadth.normalizedUnion : [];
  const planKeys = ['builtIn', 'shippedBeforeV8', 'v8ReleaseExpansion', 'deferred'];
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    errors.push('releasePlan must be an object');
  } else {
    for (const key of planKeys) {
      if (!sortedUniqueStrings(plan[key])) {
        errors.push(`releasePlan.${key} must be sorted, unique locale tags`);
      }
    }
    if (!sortedUniqueStrings(plan.regionalExtensions)) {
      errors.push('releasePlan.regionalExtensions must be sorted, unique locale tags');
    }
    if (!Array.isArray(plan.selectionRationale) || plan.selectionRationale.length === 0 || plan.selectionRationale.some((item) => typeof item !== 'string' || item.length < 12)) {
      errors.push('releasePlan.selectionRationale must contain substantive strings');
    }
    const partition = planKeys.flatMap((key) => (Array.isArray(plan[key]) ? plan[key] : []));
    if (new Set(partition).size !== partition.length) {
      errors.push('releasePlan locale groups must not overlap');
    }
    if (!sameArray([...partition].sort(), [...union].sort())) {
      errors.push('releasePlan builtIn/shippedBeforeV8/v8ReleaseExpansion/deferred must partition the pinned union');
    }
  }

  if (!Array.isArray(fixture.catalogs)) {
    errors.push('catalogs must be an array');
    return errors;
  }
  const records = fixture.catalogs;
  const recordLocales = records.map((record) => record?.locale);
  if (!sameArray(recordLocales, [...recordLocales].sort()) || new Set(recordLocales).size !== recordLocales.length) {
    errors.push('catalogs must be sorted by locale with no duplicates');
  }
  if (!sameArray(recordLocales, plan?.v8ReleaseExpansion)) {
    errors.push('catalogs must contain exactly the v8ReleaseExpansion locales');
  }

  for (const record of records) {
    const locale = record?.locale;
    const label = `catalogs[${String(locale)}]`;
    if (typeof locale !== 'string' || locale.length === 0) {
      errors.push(`${label}.locale must be a non-empty locale tag`);
      continue;
    }
    if (record.direction !== 'ltr' && record.direction !== 'rtl') {
      errors.push(`${label}.direction must be "ltr" or "rtl"`);
    }

    validateSnapshot(currentSource, record.source, `${label}.source`, errors);

    const translatedEntries = catalogs.get(locale);
    if (!translatedEntries) {
      errors.push(`${label} has no matching src/translations/${locale}.ts catalog`);
    } else {
      validateSnapshot(messageSnapshot(translatedEntries), record.catalog, `${label}.catalog`, errors);
    }

    const translator = record.translator;
    if (translator?.status !== 'complete-original') {
      errors.push(`${label}.translator.status must be "complete-original"`);
    }
    if (translator?.role !== 'project localization contributor') {
      errors.push(`${label}.translator.role must honestly identify the project localization contributor role`);
    }
    if (!validDate(translator?.completedAt)) {
      errors.push(`${label}.translator.completedAt must be a real YYYY-MM-DD date`);
    }
    if (typeof translator?.evidence !== 'string' || translator.evidence.length < 24) {
      errors.push(`${label}.translator.evidence must describe the original-translation method`);
    }

    const reviewer = record.reviewer;
    if (reviewer?.role !== 'independent localization reviewer') {
      errors.push(`${label}.reviewer.role must identify the independent localization reviewer role`);
    }
    if (reviewer?.status !== 'pending-independent-review' && reviewer?.status !== 'approved') {
      errors.push(`${label}.reviewer.status must be "pending-independent-review" or "approved"`);
    } else if (reviewer.status === 'pending-independent-review') {
      if (reviewer.reviewedAt !== null || reviewer.evidence !== null) {
        errors.push(`${label}.reviewer pending state must have null reviewedAt and evidence`);
      }
      if (requireApproved) {
        errors.push(`${label} is pending independent review; release catalogs must be approved`);
      }
    } else {
      if (!validDate(reviewer.reviewedAt)) {
        errors.push(`${label}.reviewer.reviewedAt must be a real YYYY-MM-DD date after approval`);
      }
      if (typeof reviewer.evidence !== 'string' || reviewer.evidence.length < 24) {
        errors.push(`${label}.reviewer.evidence must describe the independent review performed`);
      }
    }

    if (!Array.isArray(record.englishIdenticalAllowlist)) {
      errors.push(`${label}.englishIdenticalAllowlist must be an array`);
      continue;
    }
    const allowlistPaths = [];
    for (const entry of record.englishIdenticalAllowlist) {
      if (typeof entry?.messagePath !== 'string' || entry.messagePath.length === 0) {
        errors.push(`${label}.englishIdenticalAllowlist entries need a messagePath`);
        continue;
      }
      allowlistPaths.push(entry.messagePath);
      if (typeof entry.rationale !== 'string' || entry.rationale.length < 16) {
        errors.push(`${label}.englishIdenticalAllowlist[${entry.messagePath}] needs a substantive rationale`);
      }
    }
    if (!sameArray(allowlistPaths, [...allowlistPaths].sort()) || new Set(allowlistPaths).size !== allowlistPaths.length) {
      errors.push(`${label}.englishIdenticalAllowlist must be sorted by messagePath with no duplicates`);
    }
    if (translatedEntries) {
      const actualIdentical = englishIdenticalMessagePaths(englishEntries, translatedEntries);
      const allowlisted = [...allowlistPaths].sort();
      const missing = actualIdentical.filter((path) => !allowlisted.includes(path));
      const stale = allowlisted.filter((path) => !actualIdentical.includes(path));
      if (missing.length > 0) {
        errors.push(
          `${label} leaves English text without an explicit technical/proper-name rationale: ${missing.join(', ')}`,
        );
      }
      if (stale.length > 0) {
        errors.push(`${label} has stale English-identical allowlist entries: ${stale.join(', ')}`);
      }
    }
  }

  return errors;
}
