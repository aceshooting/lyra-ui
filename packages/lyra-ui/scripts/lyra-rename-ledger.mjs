// Declarative ledger of Lyra-only public names that change across a major release, and the narrow
// projection the published migration CLI reads for its `--origin=lyra-v<major>` profiles.
//
// The authored source is scripts/fixtures/lyra-renames.json. It never stands alone: every rename
// and review entry must match a deprecation record in scripts/fixtures/component-metadata.json
// (reached here through the inventory's `maturity.deprecations` projection), and -- checked by
// check-migration-coverage.mjs only, so an incomplete ledger fails lint rather than every build --
// every deprecation scheduled for removal in the profile's alias-removal major must be named by
// exactly one entry (a rename or review entry for a member, a slotContent entry for a
// `slot-content` record). That pairing keeps the codemod, the deprecated alias metadata and the
// generated migration reference from drifting apart.
//
// This module is copied beside migrate-wa.mjs into dist/cli, so it stays dependency-free and never
// reads the filesystem itself.

const LYRA_RENAME_LEDGER_SCHEMA_VERSION = 1;

/**
 * The `since` of a deprecation record that lands after the current release tag
 * (component-metadata.mjs). The version bump stamps the released version in its place before the
 * build, so only a build made between two releases projects it, and a published CLI never does.
 */
const UNRELEASED_VERSION = 'unreleased';

/** Every supported Lyra-to-Lyra rename profile. The ledger must contain exactly these, in order. */
const LYRA_RENAME_PROFILES = Object.freeze([
  Object.freeze({ origin: 'lyra-v21', fromMajor: 21, toMajor: 22, aliasRemovalMajor: 23 }),
]);

export const LYRA_RENAME_ORIGINS = Object.freeze(LYRA_RENAME_PROFILES.map((profile) => profile.origin));

/** Member kinds a rename entry can rewrite mechanically. */
const RENAME_KINDS = Object.freeze(['attribute', 'property', 'event', 'part', 'css-property', 'slot']);

/** Deprecation kinds a review entry can report (every kind component-metadata.json records). */
const REVIEW_KINDS = Object.freeze([
  'component',
  'attribute',
  'property',
  'event',
  'slot',
  'part',
  'css-property',
  'css-state',
  'method',
]);

/**
 * Names that are not owned by a single element. An event bubbles to listeners on any ancestor, a
 * `::part()` selector can reach an element through a class or an `exportparts` forward, and a
 * custom property inherits into every nested component. For these kinds the projection records
 * every component exposing each ledger name -- old names AND new names -- so the codemod can tell
 * a rename that keeps a listener's or declaration's reach from one that widens or narrows it.
 */
const EXPOSURE_KINDS = Object.freeze(['event', 'part', 'css-property']);

const SURFACE_SECTIONS = Object.freeze({
  attribute: 'attributes',
  property: 'properties',
  event: 'events',
  part: 'parts',
  'css-property': 'cssProperties',
  slot: 'slots',
  'css-state': 'cssStates',
  method: 'methods',
});

const TAG_PATTERN = /^lr-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ELEMENT_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const JS_IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/;
const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/;
const NAME_PATTERNS = Object.freeze({
  component: TAG_PATTERN,
  attribute: /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
  property: JS_IDENTIFIER_PATTERN,
  method: JS_IDENTIFIER_PATTERN,
  event: /^lr-[a-z0-9]+(?:-[a-z0-9]+)*$/,
  part: /^[A-Za-z0-9_-]+$/,
  // The empty name is the default slot. It may be reviewed (every unslotted child is reported)
  // but never renamed, because moving unslotted content needs a person to pick what moves.
  slot: /^(?:[A-Za-z0-9_-]+)?$/,
  'css-property': /^--[A-Za-z0-9_-]+$/,
  'css-state': /^[a-z][a-z0-9-]*$/,
});

const PROFILE_LIST_KEYS = ['renames', 'defaults', 'detailChanges', 'reviews', 'slotContent'];
const AUTHORED_PROFILE_KEYS = ['origin', 'fromMajor', 'toMajor', 'aliasRemovalMajor', ...PROFILE_LIST_KEYS];
const PROJECTED_PROFILE_KEYS = [...AUTHORED_PROFILE_KEYS, 'exposure'];

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unknownKeys(value, allowed) {
  return Object.keys(value).filter((key) => !allowed.includes(key));
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseVersion(version) {
  const match = VERSION_PATTERN.exec(String(version ?? ''));
  return match ? match.slice(1, 4).map(Number) : null;
}

/** Numeric comparison of `x.y.z` versions (pre-release suffixes ignored); null when unparseable. */
export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) return null;
  for (let index = 0; index < 3; index += 1) if (a[index] !== b[index]) return a[index] - b[index];
  return 0;
}

function majorOf(version) {
  return parseVersion(version)?.[0] ?? null;
}

/** A ledger with every supported profile and no entries. */
export function emptyRenameLedger() {
  return {
    schemaVersion: LYRA_RENAME_LEDGER_SCHEMA_VERSION,
    profiles: LYRA_RENAME_PROFILES.map((header) => ({
      ...header,
      ...Object.fromEntries(PROFILE_LIST_KEYS.map((list) => [list, []])),
    })),
  };
}

/** The packaged projection of {@link emptyRenameLedger}. */
export function emptyRenameProjection() {
  return {
    schemaVersion: LYRA_RENAME_LEDGER_SCHEMA_VERSION,
    profiles: emptyRenameLedger().profiles.map((profile) => ({
      ...profile,
      exposure: Object.fromEntries(EXPOSURE_KINDS.map((kind) => [kind, {}])),
    })),
  };
}

function entryLabel(origin, list, entry) {
  if (list === 'renames') return `${origin}: rename ${entry?.tag} ${entry?.kind} ${entry?.from}`;
  if (list === 'defaults') return `${origin}: default ${entry?.tag} ${entry?.attribute}`;
  if (list === 'detailChanges') return `${origin}: detail change ${entry?.tag} ${entry?.event}`;
  if (list === 'slotContent') return `${origin}: slot content ${entry?.tag} ${JSON.stringify(entry?.slot ?? null)}`;
  return `${origin}: review ${entry?.tag} ${entry?.kind} ${JSON.stringify(entry?.name ?? null)}`;
}

function sortKey(list, entry) {
  if (list === 'renames') return [entry.tag, entry.kind, entry.from].join('\u0000');
  if (list === 'defaults') return [entry.tag, entry.attribute].join('\u0000');
  if (list === 'detailChanges') return [entry.tag, entry.event].join('\u0000');
  if (list === 'slotContent') return [entry.tag, entry.slot].join('\u0000');
  return [entry.tag, entry.kind, entry.name].join('\u0000');
}

function validateName(findings, label, kind, field, value) {
  if (typeof value !== 'string' || !NAME_PATTERNS[kind]?.test(value)) {
    findings.push(`${label}: ${field} must be a valid ${kind} name, got ${JSON.stringify(value)}`);
    return false;
  }
  return true;
}

function validateProjectedSince(findings, label, entry, projected) {
  if (projected && entry.since !== UNRELEASED_VERSION && !parseVersion(entry.since)) {
    findings.push(`${label}: since must be a version or ${JSON.stringify(UNRELEASED_VERSION)}`);
  }
}

function validateRenameEntry(findings, label, entry, projected) {
  const allowed = ['tag', 'kind', 'from', 'to', 'polarity', ...(projected ? ['since', 'reflects'] : [])];
  const unknown = unknownKeys(entry, allowed);
  if (unknown.length) findings.push(`${label}: unknown key(s) ${unknown.join(', ')}`);
  if (!RENAME_KINDS.includes(entry.kind)) {
    findings.push(`${label}: kind must be one of ${RENAME_KINDS.join(', ')}`);
    return;
  }
  const validFrom = validateName(findings, label, entry.kind, 'from', entry.from);
  const validTo = validateName(findings, label, entry.kind, 'to', entry.to);
  if (validFrom && validTo && entry.from === entry.to) findings.push(`${label}: from and to must differ`);
  if (entry.kind === 'slot' && (entry.from === '' || entry.to === '')) {
    findings.push(`${label}: the default slot can be reviewed but not renamed`);
  }
  if (Object.hasOwn(entry, 'polarity')) {
    if (entry.polarity !== 'inverted') findings.push(`${label}: polarity may only be "inverted"`);
    if (entry.kind !== 'attribute' && entry.kind !== 'property') {
      findings.push(`${label}: only attribute and property renames can invert polarity`);
    }
  }
  validateProjectedSince(findings, label, entry, projected);
  if (projected && Object.hasOwn(entry, 'reflects') !== (entry.kind === 'attribute')) {
    findings.push(`${label}: reflects is recorded for attribute renames only`);
  }
  if (projected && entry.kind === 'attribute' && typeof entry.reflects !== 'boolean') {
    findings.push(`${label}: reflects must be a boolean`);
  }
}

function validateDefaultEntry(findings, label, entry, projected) {
  const unknown = unknownKeys(entry, ['tag', 'attribute', 'value', ...(projected ? ['since'] : [])]);
  if (unknown.length) findings.push(`${label}: unknown key(s) ${unknown.join(', ')}`);
  validateName(findings, label, 'attribute', 'attribute', entry.attribute);
  if (!Object.hasOwn(entry, 'value')) {
    findings.push(`${label}: needs a value`);
  } else if (
    typeof entry.value !== 'string' &&
    entry.value !== true &&
    !(typeof entry.value === 'number' && Number.isFinite(entry.value))
  ) {
    findings.push(`${label}: value must be a string, a finite number, or true (presence)`);
  }
  validateProjectedSince(findings, label, entry, projected);
}

function validateSummary(findings, label, summary) {
  if (typeof summary !== 'string' || summary.trim().length < 16 || /\n/.test(summary)) {
    findings.push(`${label}: summary must be a single-line description of the change`);
  }
}

function validateDetailEntry(findings, label, entry, projected) {
  const unknown = unknownKeys(entry, ['tag', 'event', 'summary', ...(projected ? ['since'] : [])]);
  if (unknown.length) findings.push(`${label}: unknown key(s) ${unknown.join(', ')}`);
  validateName(findings, label, 'event', 'event', entry.event);
  validateSummary(findings, label, entry.summary);
  validateProjectedSince(findings, label, entry, projected);
}

function validateSlotContentEntry(findings, label, entry, projected) {
  const unknown = unknownKeys(entry, ['tag', 'slot', 'report', 'allow', 'summary', ...(projected ? ['since'] : [])]);
  if (unknown.length) findings.push(`${label}: unknown key(s) ${unknown.join(', ')}`);
  validateName(findings, label, 'slot', 'slot', entry.slot);
  const lists = ['report', 'allow'].filter((key) => Object.hasOwn(entry, key));
  if (lists.length !== 1) {
    findings.push(`${label}: needs exactly one of report (elements to report) or allow (the only elements kept)`);
  } else {
    const elements = entry[lists[0]];
    if (
      !Array.isArray(elements) ||
      !elements.length ||
      !elements.every((element) => typeof element === 'string' && ELEMENT_PATTERN.test(element)) ||
      JSON.stringify(elements) !== JSON.stringify([...new Set(elements)].sort(compareText))
    ) {
      findings.push(`${label}: ${lists[0]} must be a sorted, unique list of lowercase element names`);
    }
  }
  validateSummary(findings, label, entry.summary);
  validateProjectedSince(findings, label, entry, projected);
}

function validateReviewEntry(findings, label, entry, projected) {
  const allowed = projected ? ['tag', 'kind', 'name', 'replacement', 'removalNotBefore', 'since'] : ['tag', 'kind', 'name'];
  const unknown = unknownKeys(entry, allowed);
  if (unknown.length) findings.push(`${label}: unknown key(s) ${unknown.join(', ')}`);
  if (!REVIEW_KINDS.includes(entry.kind)) {
    findings.push(`${label}: kind must be one of ${REVIEW_KINDS.join(', ')}`);
    return;
  }
  if (validateName(findings, label, entry.kind, 'name', entry.name) && entry.kind === 'component' && entry.name !== entry.tag) {
    findings.push(`${label}: a component review must name its own tag`);
  }
  if (projected) {
    if (typeof entry.replacement !== 'string' || !entry.replacement) findings.push(`${label}: replacement text missing`);
    if (majorOf(entry.removalNotBefore) === null) findings.push(`${label}: removalNotBefore must be a version`);
  }
  validateProjectedSince(findings, label, entry, projected);
}

/** kind -> name -> tags the projection must record as exposing that name. */
function requiredExposure(profile) {
  const required = new Map(EXPOSURE_KINDS.map((kind) => [kind, new Map()]));
  const need = (kind, name, tag) => {
    if (!required.has(kind)) return;
    const tags = required.get(kind).get(name) ?? new Set();
    if (tag) tags.add(tag);
    required.get(kind).set(name, tags);
  };
  for (const entry of profile.renames ?? []) {
    need(entry.kind, entry.from, entry.tag);
    need(entry.kind, entry.to, entry.tag);
  }
  for (const entry of profile.reviews ?? []) need(entry.kind, entry.name, entry.tag);
  for (const entry of profile.detailChanges ?? []) need('event', entry.event, entry.tag);
  return required;
}

function validateExposure(findings, profile) {
  const origin = profile.origin;
  if (!isPlainObject(profile.exposure)) {
    findings.push(`${origin}: exposure must be an object`);
    return;
  }
  const unknown = unknownKeys(profile.exposure, EXPOSURE_KINDS);
  if (unknown.length) findings.push(`${origin}: exposure has unknown kind(s) ${unknown.join(', ')}`);
  const required = requiredExposure(profile);
  for (const kind of EXPOSURE_KINDS) {
    const recorded = profile.exposure[kind];
    if (!isPlainObject(recorded)) {
      findings.push(`${origin}: exposure.${kind} must be an object`);
      continue;
    }
    for (const [name, tags] of Object.entries(recorded)) {
      if (!required.get(kind).has(name)) findings.push(`${origin}: exposure.${kind} records unreferenced name ${name}`);
      if (
        !Array.isArray(tags) ||
        !tags.every((tag) => typeof tag === 'string' && TAG_PATTERN.test(tag)) ||
        JSON.stringify(tags) !== JSON.stringify([...new Set(tags)].sort(compareText))
      ) {
        findings.push(`${origin}: exposure.${kind}.${name} must be a sorted, unique tag list`);
      }
    }
    for (const [name, tags] of required.get(kind)) {
      if (!Object.hasOwn(recorded, name)) {
        findings.push(`${origin}: exposure.${kind}.${name} is missing`);
        continue;
      }
      const recordedTags = new Set(recorded[name] ?? []);
      for (const tag of tags) {
        if (!recordedTags.has(tag)) findings.push(`${origin}: exposure.${kind}.${name} must include ${tag}`);
      }
    }
  }
}

/**
 * Schema validation shared by the authored ledger and its packaged projection. It needs no
 * inventory, so the published CLI can fail closed on a malformed projection.
 */
export function validateRenameLedgerShape(ledger, { projected = false } = {}) {
  const findings = [];
  if (!isPlainObject(ledger)) return ['rename ledger must be an object'];
  const topKeys = projected ? ['schemaVersion', 'profiles'] : ['$comment', 'schemaVersion', 'profiles'];
  const unknownTop = unknownKeys(ledger, topKeys);
  if (unknownTop.length) findings.push(`rename ledger has unknown key(s) ${unknownTop.join(', ')}`);
  if (ledger.schemaVersion !== LYRA_RENAME_LEDGER_SCHEMA_VERSION) {
    findings.push(`rename ledger schemaVersion must be ${LYRA_RENAME_LEDGER_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(ledger.profiles)) return [...findings, 'rename ledger profiles must be an array'];
  const origins = ledger.profiles.map((profile) => profile?.origin);
  if (JSON.stringify(origins) !== JSON.stringify(LYRA_RENAME_ORIGINS)) {
    findings.push(`rename ledger profiles must be exactly ${LYRA_RENAME_ORIGINS.join(', ')} in that order`);
  }

  for (const profile of ledger.profiles) {
    if (!isPlainObject(profile)) {
      findings.push('rename ledger profiles must be objects');
      continue;
    }
    const origin = String(profile.origin);
    const unknown = unknownKeys(profile, projected ? PROJECTED_PROFILE_KEYS : AUTHORED_PROFILE_KEYS);
    if (unknown.length) findings.push(`${origin}: unknown key(s) ${unknown.join(', ')}`);
    const header = LYRA_RENAME_PROFILES.find((candidate) => candidate.origin === profile.origin);
    if (header) {
      for (const field of ['fromMajor', 'toMajor', 'aliasRemovalMajor']) {
        if (profile[field] !== header[field]) findings.push(`${origin}: ${field} must be ${header[field]}`);
      }
    }
    for (const list of PROFILE_LIST_KEYS) {
      if (!Array.isArray(profile[list])) {
        findings.push(`${origin}: ${list} must be an array`);
        continue;
      }
      const seen = new Set();
      const keys = [];
      for (const entry of profile[list]) {
        const label = entryLabel(origin, list, entry);
        if (!isPlainObject(entry)) {
          findings.push(`${origin}: ${list} entries must be objects`);
          continue;
        }
        if (typeof entry.tag !== 'string' || !TAG_PATTERN.test(entry.tag)) {
          findings.push(`${label}: tag must be an lr-* element name`);
        }
        if (list === 'renames') validateRenameEntry(findings, label, entry, projected);
        else if (list === 'defaults') validateDefaultEntry(findings, label, entry, projected);
        else if (list === 'detailChanges') validateDetailEntry(findings, label, entry, projected);
        else if (list === 'slotContent') validateSlotContentEntry(findings, label, entry, projected);
        else validateReviewEntry(findings, label, entry, projected);
        const key = sortKey(list, entry);
        if (seen.has(key)) findings.push(`${label}: duplicate entry`);
        seen.add(key);
        keys.push(key);
      }
      if (JSON.stringify(keys) !== JSON.stringify([...keys].sort(compareText))) {
        findings.push(`${origin}: ${list} must be sorted by tag and name`);
      }
    }
    if (!Array.isArray(profile.renames) || !Array.isArray(profile.reviews)) continue;

    // A rename target that is itself renamed would make a second run rewrite the first run's
    // output. Unowned contexts (bubbling listeners, inherited custom properties) are tag-agnostic,
    // so the chain check spans every tag of the same kind.
    const sources = new Map();
    for (const entry of profile.renames) {
      const names = sources.get(entry.kind) ?? new Set();
      names.add(entry.from);
      sources.set(entry.kind, names);
    }
    for (const entry of profile.renames) {
      if (sources.get(entry.kind)?.has(entry.to)) {
        findings.push(`${entryLabel(origin, 'renames', entry)}: target ${entry.to} is itself renamed; rename directly to the final name`);
      }
    }
    const renamed = new Set(profile.renames.map((entry) => `${entry.tag}\u0000${entry.kind}\u0000${entry.from}`));
    for (const entry of profile.reviews) {
      if (renamed.has(`${entry.tag}\u0000${entry.kind}\u0000${entry.name}`)) {
        findings.push(`${entryLabel(origin, 'reviews', entry)}: a member is either renamed or reviewed, not both`);
      }
    }
    if (projected) validateExposure(findings, profile);
  }
  return findings;
}

function componentMap(inventory) {
  return new Map((inventory?.components ?? []).map((component) => [component.tag, component]));
}

function surfaceEntry(component, kind, name) {
  return (component?.surface?.[SURFACE_SECTIONS[kind]] ?? []).find((entry) => entry.name === name) ?? null;
}

function deprecationRecords(component) {
  const records = [...(component?.maturity?.deprecations ?? [])];
  const componentRecord = component?.maturity?.deprecated;
  if (isPlainObject(componentRecord) && !records.some((record) => record.kind === 'component')) {
    records.push(componentRecord);
  }
  return records;
}

/** The deprecation record that retires `name`, including an attribute paired with a property record. */
export function deprecationRecordFor(component, kind, name) {
  const records = deprecationRecords(component);
  if (kind === 'component') return records.find((record) => record.kind === 'component') ?? null;
  const direct = records.find((record) => record.kind === kind && record.name === name);
  if (direct || kind !== 'attribute') return direct ?? null;
  return records.find((record) => record.kind === 'property' && record.attribute === name) ?? null;
}

function replacementMatches(component, kind, record, to) {
  const replacement = record?.replacement;
  if (!isPlainObject(replacement)) return false;
  if (replacement.kind === kind && replacement.name === to) return true;
  if (kind === 'attribute' && replacement.kind === 'property') {
    return surfaceEntry(component, 'property', replacement.name)?.attribute === to;
  }
  return false;
}

function isBooleanMember(entry) {
  return String(entry?.type ?? '').split('|').map((part) => part.trim()).includes('boolean');
}

function exposingTags(inventory, kind, name) {
  return (inventory?.components ?? [])
    .filter((component) => surfaceEntry(component, kind, name))
    .map((component) => component.tag)
    .sort(compareText);
}

const UNMIRRORED_CLASSIFICATIONS = new Set(['conceptual-only', 'unsupported']);

/**
 * `${tag}\0${kind}\0${name}` -> the Web Awesome or Shoelace tag a Lyra member mirrors. A member is
 * mirrored when a counterpart mapping keeps its upstream name or rewrites an upstream member onto
 * it. Mirrored names and their defaults never change, so no ledger entry may name one.
 */
export function mirroredMembers(inventory) {
  const upstreamComponents = new Map();
  for (const ecosystem of Object.values(inventory?.upstreams ?? {})) {
    for (const component of ecosystem?.components ?? []) upstreamComponents.set(component.tag, component);
  }
  const mirrored = new Map();
  for (const mapping of inventory?.mappings ?? []) {
    if (!mapping?.targetTag || UNMIRRORED_CLASSIFICATIONS.has(mapping.classification)) continue;
    const upstream = upstreamComponents.get(mapping.upstreamTag);
    for (const [kind, section] of Object.entries(SURFACE_SECTIONS)) {
      const rewrites = mapping.rewrites?.[section] ?? [];
      const renamedAway = new Set(rewrites.map((rule) => rule?.from));
      const names = [
        ...rewrites.map((rule) => rule?.to).filter((name) => typeof name === 'string'),
        ...(upstream?.surface?.[section] ?? []).map((entry) => entry.name).filter((name) => !renamedAway.has(name)),
      ];
      for (const name of names) {
        const key = `${mapping.targetTag}\u0000${kind}\u0000${name}`;
        if (!mirrored.has(key)) mirrored.set(key, mapping.upstreamTag);
      }
    }
  }
  return mirrored;
}

/**
 * Cross-checks the authored ledger against the component inventory: every entry names a real,
 * deprecated, Lyra-only member whose policy record agrees with it. With `requireCoverage`, every
 * Lyra-only deprecation scheduled for the profile's alias-removal major must also be named by a
 * rename or review entry; check-migration-coverage.mjs asks for that, the build and CLI do not,
 * so an incomplete ledger fails lint without breaking every build. `sharedTokens` (the canonical
 * token names) keeps document-wide design tokens out of the per-component ledger.
 */
export function validateRenameLedger(ledger, { inventory, requireCoverage = false, sharedTokens = null }) {
  const findings = validateRenameLedgerShape(ledger);
  if (findings.length) return findings;
  const components = componentMap(inventory);
  const mirrored = mirroredMembers(inventory);
  const mirrorOf = (tag, kind, name) => mirrored.get(`${tag}\u0000${kind}\u0000${name}`) ?? null;

  for (const profile of ledger.profiles) {
    const origin = profile.origin;
    const covered = new Set();
    const release = `${profile.toMajor}.0.0`;
    const removalMajorMatches = (record) => majorOf(record?.removalNotBefore) === profile.aliasRemovalMajor;
    const checkRecordWindow = (label, record) => {
      if (!removalMajorMatches(record)) {
        findings.push(`${label}: its deprecation record must set removalNotBefore to ${profile.aliasRemovalMajor}.0.0`);
      }
      // An unreleased record ships in the next release. component-metadata.mjs accepts one only
      // while the current release is tagged, and only with a removal floor two majors above the
      // current major; a removal in aliasRemovalMajor (toMajor + 1) therefore leaves that next
      // release no later than toMajor.0.0. The version bump stamps the released version, which
      // the comparison below then checks.
      if (record?.since === UNRELEASED_VERSION) return;
      const since = compareVersions(record?.since, release);
      if (since === null || since > 0) {
        findings.push(`${label}: its deprecation record must start no later than ${release} (since ${JSON.stringify(record?.since)})`);
      }
    };
    const checkLyraOnly = (label, tag, kind, name) => {
      const upstream = mirrorOf(tag, kind, name);
      if (upstream) findings.push(`${label}: ${name} mirrors ${upstream}; mirrored names never change`);
    };
    const checkSharedToken = (label, kind, name) => {
      if (kind === 'css-property' && sharedTokens?.has(name)) {
        findings.push(`${label}: ${name} is a canonical design token, not a component-owned custom property`);
      }
    };
    const presenceDefaults = new Set(
      profile.defaults.filter((entry) => entry.value === true).map((entry) => `${entry.tag}\u0000${entry.attribute}`),
    );
    // A presence default that completes an inverted rename preserves the retired name's default,
    // not the target's, so the target may be a mirrored name whose own default never changes.
    const inversionCompanions = new Set();

    for (const entry of profile.renames) {
      const label = entryLabel(origin, 'renames', entry);
      const component = components.get(entry.tag);
      if (!component) {
        findings.push(`${label}: component is not in the inventory`);
        continue;
      }
      covered.add(`${entry.tag}\u0000${entry.kind}\u0000${entry.from}`);
      checkLyraOnly(label, entry.tag, entry.kind, entry.from);
      checkSharedToken(label, entry.kind, entry.from);
      checkSharedToken(label, entry.kind, entry.to);
      const from = surfaceEntry(component, entry.kind, entry.from);
      const to = surfaceEntry(component, entry.kind, entry.to);
      if (!from) findings.push(`${label}: the deprecated alias ${entry.from} is not on the public surface`);
      else if (!from.deprecated) findings.push(`${label}: the alias ${entry.from} is not marked deprecated in the manifest`);
      if (!to) findings.push(`${label}: the canonical name ${entry.to} is not on the public surface`);
      else if (to.deprecated) findings.push(`${label}: the canonical name ${entry.to} is itself deprecated`);
      const record = deprecationRecordFor(component, entry.kind, entry.from);
      if (!record) {
        findings.push(`${label}: no deprecation record retires ${entry.from}`);
      } else {
        checkRecordWindow(label, record);
        if (!replacementMatches(component, entry.kind, record, entry.to)) {
          findings.push(`${label}: its deprecation record names a different replacement than ${entry.to}`);
        }
      }
      if ((entry.kind === 'attribute' || entry.kind === 'property') && from && to && isBooleanMember(from) && isBooleanMember(to)) {
        const toAttribute = entry.kind === 'attribute' ? entry.to : to.attribute;
        const preservesPresence = Boolean(toAttribute) && presenceDefaults.has(`${entry.tag}\u0000${toAttribute}`);
        if (entry.polarity === 'inverted') {
          // Absent must keep meaning what it meant: `from` defaulting to true matches `to`
          // defaulting to false; `from` defaulting to false needs `to` inserted where absent.
          if (to.default === true) findings.push(`${label}: an inverted rename must target a boolean that defaults to false`);
          if (from.default !== true && toAttribute) inversionCompanions.add(`${entry.tag}\u0000${toAttribute}`);
          if (from.default !== true && !preservesPresence) {
            findings.push(
              `${label}: ${entry.from} defaults to false, so the inverted rename needs a defaults entry inserting ${toAttribute ?? entry.to} where both are absent`,
            );
          }
        } else if (from.default === true && to.default !== true && !preservesPresence) {
          findings.push(
            `${label}: ${entry.from} defaults to true and ${entry.to} to false; declare "polarity": "inverted" or preserve the default with a defaults entry`,
          );
        }
      } else if (entry.polarity === 'inverted' && from && to) {
        findings.push(`${label}: an inverted rename must retire a boolean for a boolean`);
      }
    }

    for (const entry of profile.reviews) {
      const label = entryLabel(origin, 'reviews', entry);
      const component = components.get(entry.tag);
      if (!component) {
        findings.push(`${label}: component is not in the inventory`);
        continue;
      }
      covered.add(`${entry.tag}\u0000${entry.kind}\u0000${entry.name}`);
      if (entry.kind !== 'component') checkLyraOnly(label, entry.tag, entry.kind, entry.name);
      checkSharedToken(label, entry.kind, entry.name);
      const record = deprecationRecordFor(component, entry.kind, entry.name);
      if (!record) findings.push(`${label}: no deprecation record retires ${JSON.stringify(entry.name)}`);
      else checkRecordWindow(label, record);
    }

    for (const entry of profile.detailChanges) {
      const label = entryLabel(origin, 'detailChanges', entry);
      const component = components.get(entry.tag);
      if (!component) findings.push(`${label}: component is not in the inventory`);
      else if (!surfaceEntry(component, 'event', entry.event)) findings.push(`${label}: the event is not dispatched by ${entry.tag}`);
      else checkLyraOnly(label, entry.tag, 'event', entry.event);
    }

    for (const entry of profile.slotContent) {
      const label = entryLabel(origin, 'slotContent', entry);
      const component = components.get(entry.tag);
      if (!component) {
        findings.push(`${label}: component is not in the inventory`);
        continue;
      }
      if (!surfaceEntry(component, 'slot', entry.slot)) findings.push(`${label}: the slot is not on the public surface`);
      // A `slot-content` deprecation record is migrated by this entry. When the record lists the
      // content that stays, the codemod must keep exactly that list, or its reports would disagree
      // with the documented deprecation.
      const record = deprecationRecordFor(component, 'slot-content', entry.slot);
      if (!record) continue;
      covered.add(`${entry.tag}\u0000slot-content\u0000${entry.slot}`);
      if (Array.isArray(record.permittedContent) && JSON.stringify(entry.allow ?? null) !== JSON.stringify(record.permittedContent)) {
        findings.push(`${label}: its deprecation record permits ${record.permittedContent.join(', ')}; allow must list exactly those elements`);
      }
    }

    for (const entry of profile.defaults) {
      const label = entryLabel(origin, 'defaults', entry);
      const component = components.get(entry.tag);
      if (!component) {
        findings.push(`${label}: component is not in the inventory`);
        continue;
      }
      const attribute = surfaceEntry(component, 'attribute', entry.attribute);
      if (!attribute) {
        findings.push(`${label}: the attribute is not on the public surface`);
        continue;
      }
      if (!inversionCompanions.has(`${entry.tag}\u0000${entry.attribute}`)) checkLyraOnly(label, entry.tag, 'attribute', entry.attribute);
      if (entry.value === true && !isBooleanMember(attribute)) {
        findings.push(`${label}: presence insertion requires a boolean attribute`);
      }
      if (attribute.hasDefault && String(attribute.default) === String(entry.value)) {
        findings.push(`${label}: the value equals the current default, so there is nothing to preserve`);
      }
    }

    if (!requireCoverage) continue;
    // Converse direction: a Lyra-only alias scheduled for removal with this profile must be
    // migrated or reported, never silently left for the removal release to break. A mirrored
    // deprecation follows its upstream and is removed only when upstream's is.
    for (const component of inventory?.components ?? []) {
      for (const record of deprecationRecords(component)) {
        if (!removalMajorMatches(record)) continue;
        const keys = [[record.kind, record.kind === 'component' ? component.tag : record.name]];
        if (record.kind === 'property' && record.attribute) keys.push(['attribute', record.attribute]);
        for (const [kind, name] of keys) {
          if (kind !== 'component' && mirrorOf(component.tag, kind, name)) continue;
          if (!covered.has(`${component.tag}\u0000${kind}\u0000${name}`)) {
            findings.push(
              `${origin}: ${component.tag} ${kind} ${JSON.stringify(name)} is removed in ${profile.aliasRemovalMajor}.0.0 ` +
                `but has no ${kind === 'slot-content' ? 'slotContent' : 'rename or review'} entry`,
            );
          }
        }
      }
    }
  }
  return [...new Set(findings)];
}

/**
 * The validated, inventory-derived data the published CLI needs: the authored entries, the version
 * each entry starts in, review replacement text taken from the deprecation records, whether a
 * renamed attribute reflects, and which components expose each shared old and new name. The
 * multi-megabyte inventory itself never ships.
 */
export function projectRenameLedger(ledger, inventory) {
  const findings = validateRenameLedger(ledger, { inventory });
  if (findings.length) throw new Error(`Invalid Lyra rename ledger: ${findings.join('; ')}`);
  const components = componentMap(inventory);
  const projection = {
    schemaVersion: LYRA_RENAME_LEDGER_SCHEMA_VERSION,
    profiles: ledger.profiles.map((profile) => {
      const release = `${profile.toMajor}.0.0`;
      const exposure = Object.fromEntries(EXPOSURE_KINDS.map((kind) => [kind, {}]));
      for (const [kind, names] of requiredExposure(profile)) {
        for (const name of [...names.keys()].sort(compareText)) exposure[kind][name] = exposingTags(inventory, kind, name);
      }
      const recordFor = (entry, kind, name) => deprecationRecordFor(components.get(entry.tag), kind, name);
      return {
        origin: profile.origin,
        fromMajor: profile.fromMajor,
        toMajor: profile.toMajor,
        aliasRemovalMajor: profile.aliasRemovalMajor,
        renames: profile.renames.map((entry) => {
          const target = surfaceEntry(components.get(entry.tag), entry.kind, entry.to);
          const attribute = entry.kind === 'attribute' ? entry.to : target?.attribute;
          const preservesDefault = entry.polarity === 'inverted' && profile.defaults.some(
            (rule) => rule.tag === entry.tag && rule.attribute === attribute,
          );
          // The alias can ship before the default changes. Removing it before the companion
          // default applies would change the meaning of an explicitly set boolean in that release.
          // An unreleased record ships no later than `release` (see checkRecordWindow).
          const since = recordFor(entry, entry.kind, entry.from).since;
          const beforeRelease = since === UNRELEASED_VERSION || compareVersions(since, release) < 0;
          return {
            ...structuredClone(entry),
            since: preservesDefault && beforeRelease ? release : since,
            ...(entry.kind === 'attribute' ? { reflects: Boolean(target?.reflects) } : {}),
          };
        }),
        defaults: profile.defaults.map((entry) => ({ ...structuredClone(entry), since: release })),
        detailChanges: profile.detailChanges.map((entry) => ({ ...structuredClone(entry), since: release })),
        reviews: profile.reviews.map((entry) => {
          const record = recordFor(entry, entry.kind, entry.name);
          return {
            ...structuredClone(entry),
            replacement: String(record.replacement?.usage || record.replacement?.name),
            removalNotBefore: record.removalNotBefore,
            since: record.since,
          };
        }),
        slotContent: profile.slotContent.map((entry) => ({ ...structuredClone(entry), since: release })),
        exposure,
      };
    }),
  };
  const shapeFindings = validateRenameLedgerShape(projection, { projected: true });
  if (shapeFindings.length) throw new Error(`Invalid Lyra rename projection: ${shapeFindings.join('; ')}`);
  return projection;
}

function indexBy(entries, keyOf) {
  const index = new Map();
  for (const entry of entries) {
    const key = keyOf(entry);
    const list = index.get(key) ?? [];
    list.push(entry);
    index.set(key, list);
  }
  return index;
}

const ownerKey = (tag, kind, name) => `${tag}\u0000${kind}\u0000${name}`;
const nameKey = (kind, name) => `${kind}\u0000${name}`;

/**
 * Builds the lookup structure the codemod queries from a validated projection. Every question the
 * text rewriter asks -- "does this element rename this member?", "does renaming this listener
 * keep the set of events it hears?" -- is answered here, from data, so the scanner never
 * hard-codes a component.
 *
 * `lyraVersion`, when known, is the installed @aceshooting/lyra-ui version: entries that start in
 * a later release are left out (and listed in `skipped`), so a newer CLI never rewrites code
 * toward names the installed package does not have yet.
 */
export function createRenameProfiles(projection, { lyraVersion = null } = {}) {
  const findings = validateRenameLedgerShape(projection, { projected: true });
  if (findings.length) throw new Error(`Invalid Lyra rename projection: ${findings.join('; ')}`);
  if (lyraVersion !== null && !parseVersion(lyraVersion)) throw new Error(`Invalid Lyra version: ${lyraVersion}`);
  const profiles = new Map();
  for (const full of projection.profiles) {
    const skipped = [];
    // An unreleased entry exists only in a build made after the last release tag, and a known
    // installed version cannot show whether that build is the one installed, so it is withheld
    // like any entry from a later release. Only an unknown version applies it.
    const available = (list) =>
      full[list].filter((entry) => {
        if (lyraVersion === null) return true;
        if (entry.since !== UNRELEASED_VERSION && compareVersions(entry.since, lyraVersion) <= 0) return true;
        skipped.push({ list, ...entry });
        return false;
      });
    const data = { ...full, ...Object.fromEntries(PROFILE_LIST_KEYS.map((list) => [list, available(list)])) };
    const renamesByOwner = new Map(data.renames.map((entry) => [ownerKey(entry.tag, entry.kind, entry.from), entry]));
    const renamesByName = indexBy(data.renames, (entry) => nameKey(entry.kind, entry.from));
    const renamesByTarget = indexBy(data.renames, (entry) => nameKey(entry.kind, entry.to));
    const reviewsByOwner = new Map(data.reviews.map((entry) => [ownerKey(entry.tag, entry.kind, entry.name), entry]));
    const reviewsByName = indexBy(data.reviews, (entry) => nameKey(entry.kind, entry.name));
    const detailsByOwner = new Map(data.detailChanges.map((entry) => [ownerKey(entry.tag, 'event', entry.event), entry]));
    const detailsByName = indexBy(data.detailChanges, (entry) => entry.event);
    const exposure = new Map(
      EXPOSURE_KINDS.map((kind) => [kind, new Map(Object.entries(data.exposure[kind]).map(([name, tags]) => [name, new Set(tags)]))]),
    );
    const defaultsByTag = indexBy(data.defaults, (entry) => entry.tag);
    const slotContentByTag = indexBy(data.slotContent, (entry) => entry.tag);
    const tags = new Set(
      [...data.renames, ...data.reviews, ...data.detailChanges, ...data.defaults, ...data.slotContent].map((entry) => entry.tag),
    );
    const renamesNamed = (kind, name) => renamesByName.get(nameKey(kind, name)) ?? [];
    const exposersOf = (kind, name) => exposure.get(kind)?.get(name) ?? new Set();
    /** Tags that rename `from` to `to` for this kind: the components whose events keep reaching a rewritten listener. */
    const movers = (kind, from, to) =>
      new Set(renamesNamed(kind, from).filter((entry) => entry.to === to && !entry.polarity).map((entry) => entry.tag));
    const subset = (left, right) => [...left].every((tag) => right.has(tag));
    profiles.set(data.origin, {
      origin: data.origin,
      fromMajor: data.fromMajor,
      toMajor: data.toMajor,
      aliasRemovalMajor: data.aliasRemovalMajor,
      data,
      skipped,
      tags,
      isEmpty: tags.size === 0,
      renameFor: (tag, kind, name) => renamesByOwner.get(ownerKey(tag, kind, name)) ?? null,
      renamesNamed,
      renamesOnto: (kind, name) => renamesByTarget.get(nameKey(kind, name)) ?? [],
      reviewFor: (tag, kind, name) => reviewsByOwner.get(ownerKey(tag, kind, name)) ?? null,
      reviewsNamed: (kind, name) => reviewsByName.get(nameKey(kind, name)) ?? [],
      detailFor: (tag, event) => detailsByOwner.get(ownerKey(tag, 'event', event)) ?? null,
      detailsNamed: (event) => detailsByName.get(event) ?? [],
      defaultsFor: (tag) => defaultsByTag.get(tag) ?? [],
      slotContentFor: (tag) => slotContentByTag.get(tag) ?? [],
      exposes: (kind, name, tag) => Boolean(tag) && exposersOf(kind, name).has(tag),
      exposers: (kind, name) => [...exposersOf(kind, name)],
      /**
       * Components that expose `to` without having renamed `from` onto it. A listener, selector or
       * declaration moved from `from` to `to` would start reaching them, so it is never rewritten.
       */
      targetKeepers(kind, from, to) {
        const moving = movers(kind, from, to);
        return [...exposersOf(kind, to)].filter((tag) => !moving.has(tag));
      },
      /**
       * Components that still expose `from` under that name. An unowned site moved to `to` would
       * stop reaching them.
       */
      sourceKeepers(kind, from, to) {
        const moving = movers(kind, from, to);
        return [...exposersOf(kind, from)].filter((tag) => !moving.has(tag));
      },
      /**
       * True only when an unowned site can move from `from` to `to` without changing what it
       * reaches: every component exposing `from` renamed it to that one target without a polarity
       * flip, and no other component already exposes the target.
       */
      isGlobal(kind, from) {
        const entries = renamesNamed(kind, from);
        if (!entries.length || entries.some((entry) => entry.polarity)) return false;
        const targets = new Set(entries.map((entry) => entry.to));
        if (targets.size !== 1) return false;
        const [to] = targets;
        const moving = movers(kind, from, to);
        return exposersOf(kind, from).size > 0 && subset(exposersOf(kind, from), moving) && subset(exposersOf(kind, to), moving);
      },
      /**
       * For a name that some components newly expose because they renamed onto it: those
       * components, provided another component already exposed the name before. An existing
       * listener or declaration of that name starts reaching them in the target release.
       */
      gainedOwners(kind, name) {
        const onto = (renamesByTarget.get(nameKey(kind, name)) ?? []).filter((entry) => !entry.polarity);
        if (!onto.length) return [];
        const gained = new Set(onto.map((entry) => entry.tag));
        const previous = [...exposersOf(kind, name)].filter((tag) => !gained.has(tag));
        return previous.length ? [...gained].sort(compareText) : [];
      },
    });
  }
  return profiles;
}
