import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSync } from 'oxc-parser';

import { expandManifestInheritance, expandManifestDeprecations } from './manifest-compact.mjs';

// 2 added the required top-level `exportDeprecations` ledger for package entry points and types.
const COMPONENT_METADATA_SCHEMA_VERSION = 2;
const COMPONENT_STATUSES = Object.freeze(['stable', 'experimental']);
export const UNRELEASED_VERSION = 'unreleased';
/** Host declarations a consumer can write on the tag itself instead of a deprecated member. */
const HOST_CSS_REPLACEMENTS = Object.freeze(['background', 'color', 'inline-size']);
const NAMED_EXPORT_KINDS = Object.freeze(['type', 'function', 'constant', 'class']);
const MODULE_CONTRACT_KINDS = Object.freeze(['window-event', 'root-attribute']);
const EXPORT_DEPRECATION_KINDS = Object.freeze([
  'entry-point', 'stylesheet', ...NAMED_EXPORT_KINDS, ...MODULE_CONTRACT_KINDS,
]);
const ELEMENT_NAME_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/;
const GIT_OBJECT_ID_PATTERN = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function compareText(left, right) {
  return String(left).localeCompare(String(right));
}

export function parseVersion(version) {
  const match = SEMVER_PATTERN.exec(version);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ?? null,
  };
}

export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) throw new TypeError(`Cannot compare invalid versions ${String(left)} and ${String(right)}`);
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] - b[key];
  }
  if (a.prerelease === b.prerelease) return 0;
  if (a.prerelease === null) return 1;
  if (b.prerelease === null) return -1;
  return compareText(a.prerelease, b.prerelease);
}

export function manifestComponentTags(manifest) {
  return [...new Set(
    (manifest?.modules ?? [])
      .flatMap((module) => module.declarations ?? [])
      .filter((declaration) => declaration.customElement && text(declaration.tagName))
      .map((declaration) => declaration.tagName),
  )].sort(compareText);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function releaseTagVersion(tag) {
  if (tag.startsWith('lyra-ui@')) return tag.slice('lyra-ui@'.length);
  return parseVersion(tag) ? tag : null;
}

// `trim` must stay false for any call reading multi-line file content (e.g. `git show
// <tag>:<path>`) that gets hashed downstream -- trimming silently drops a real trailing
// newline and produces a manifestSha256 that can never match history.current.manifestSha256,
// which is always hashed from the untrimmed file bytes. Single-token commands (rev-parse,
// rev-list, tag --list) legitimately want the trailing newline stripped.
function git(repoRoot, args, { allowFailure = false, trim = true } = {}) {
  try {
    const output = execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', allowFailure ? 'ignore' : 'pipe'],
    });
    return trim ? output.trim() : output;
  } catch (error) {
    if (allowFailure) return null;
    throw error;
  }
}

function hasCompleteGitHistory(repoRoot) {
  return git(repoRoot, ['rev-parse', '--is-shallow-repository'], { allowFailure: true }) === 'false';
}

export function requireCompleteGitHistory(repoRoot) {
  if (!hasCompleteGitHistory(repoRoot)) {
    throw new Error(
      'Component metadata requires a non-shallow clone with release tags; fetch full history and tags before writing or checking it.',
    );
  }
}

/**
 * Captures the exact public-tag inputs used for `since` derivation. Release commit/blob ids make
 * the evidence auditable while the checked-in tag lists keep validation available in shallow CI.
 */
export function buildReleaseHistory(repoRoot, manifestPath = 'packages/lyra-ui/custom-elements.json') {
  if (!hasCompleteGitHistory(repoRoot)) {
    throw new Error('Refreshing component history requires a non-shallow clone with release tags.');
  }
  const releaseTags = (git(repoRoot, ['tag', '--list']) ?? '')
    .split('\n')
    .filter(Boolean)
    .map((tag) => ({ tag, version: releaseTagVersion(tag) }))
    .filter((entry) => parseVersion(entry.version))
    .sort((left, right) => compareVersions(left.version, right.version));

  return releaseTags.map(({ tag, version }) => {
    const sourceCommit = git(repoRoot, ['rev-list', '-n', '1', tag]);
    const rawManifest = git(repoRoot, ['show', `${tag}:${manifestPath}`], {
      allowFailure: true,
      trim: false,
    });
    if (rawManifest === null) {
      return {
        tag,
        version,
        sourceCommit,
        manifestPresent: false,
        manifestBlob: null,
        manifestSha256: null,
        tags: [],
      };
    }
    const manifest = JSON.parse(rawManifest);
    return {
      tag,
      version,
      sourceCommit,
      manifestPresent: true,
      manifestBlob: git(repoRoot, ['rev-parse', `${tag}:${manifestPath}`]),
      manifestSha256: sha256(rawManifest),
      tags: manifestComponentTags(manifest),
    };
  });
}

export function currentHistoryRecord(packageVersion, rawManifest, manifest) {
  return {
    version: packageVersion,
    sourceCommit: null,
    manifestSha256: sha256(rawManifest),
    tags: manifestComponentTags(manifest),
  };
}

function taggedCurrentReleaseFindings(current, release) {
  const findings = [];
  const expectedTag = `lyra-ui@${current?.version}`;
  if (release?.tag !== expectedTag || release?.version !== current?.version) {
    findings.push(`expected exact tag ${expectedTag}`);
  }
  if (!GIT_OBJECT_ID_PATTERN.test(release?.sourceCommit ?? '')) {
    findings.push('source commit provenance is missing or invalid');
  }
  if (release?.manifestPresent !== true) {
    findings.push('the tagged release has no component manifest');
  }
  if (!GIT_OBJECT_ID_PATTERN.test(release?.manifestBlob ?? '')) {
    findings.push('manifest blob provenance is missing or invalid');
  }
  if (!SHA256_PATTERN.test(release?.manifestSha256 ?? '')) {
    findings.push('manifest digest provenance is missing or invalid');
  }
  if (!Array.isArray(release?.tags)) findings.push('tagged manifest tags are missing');
  return findings;
}

/**
 * Keeps the exact current-version tag outside `history.releases` as an immutable
 * `history.taggedCurrent` snapshot. Mutable worktree `history.current` can then evolve at the same
 * package version without rewriting what the tag actually shipped.
 */
export function partitionReleaseHistoryAtCurrent(
  reproducedReleases,
  current,
  { taggedCurrent = null } = {},
) {
  const expectedTag = `lyra-ui@${current?.version}`;
  const candidates = (reproducedReleases ?? []).filter(
    (release) => release.tag === expectedTag && release.version === current?.version,
  );
  if (candidates.length === 0) {
    if (taggedCurrent !== null) {
      throw new Error(`Recorded tagged-current snapshot ${taggedCurrent.tag} is missing from Git history.`);
    }
    return { releases: reproducedReleases, taggedCurrent: null, currentRelease: null };
  }
  if (candidates.length !== 1) {
    throw new Error(
      `Release history has ${candidates.length} tags for current version ${current?.version}; expected at most one.`,
    );
  }
  const currentRelease = candidates[0];
  const sameVersionOthers = (reproducedReleases ?? []).filter(
    (release) => release !== currentRelease && release.version === current?.version,
  );
  if (sameVersionOthers.length) {
    throw new Error(
      `Release history has another tag for current version ${current?.version}: ${sameVersionOthers.map((release) => release.tag).join(', ')}.`,
    );
  }
  const findings = taggedCurrentReleaseFindings(current, currentRelease);
  if (findings.length) {
    throw new Error(`Tagged current release is invalid: ${findings.join('; ')}.`);
  }
  if (taggedCurrent !== null && !sameJson(taggedCurrent, currentRelease)) {
    throw new Error(
      `Recorded tagged-current snapshot ${expectedTag} differs from immutable Git tag evidence.`,
    );
  }
  return {
    releases: reproducedReleases.filter((release) => release !== currentRelease),
    taggedCurrent: currentRelease,
    currentRelease,
  };
}

/**
 * Reconciles the immutable current-version tag independently from mutable worktree current. On the
 * next version write, `rolloverCurrent` moves that exact snapshot into the prior-release list.
 * Every unrelated Git/fixture difference remains a hard stale-history failure.
 */
export function reconcileCurrentReleaseHistory(
  history,
  reproducedReleases,
  { rolloverCurrent = false, requirePersistedTaggedCurrent = false } = {},
) {
  const recordedReleases = history?.releases ?? [];
  const recordedTaggedCurrent = history?.taggedCurrent ?? null;
  if (recordedTaggedCurrent === null && sameJson(reproducedReleases, recordedReleases)) {
    return { releases: recordedReleases, taggedCurrent: null, currentRelease: null };
  }
  const partitioned = partitionReleaseHistoryAtCurrent(reproducedReleases, history?.current, {
    taggedCurrent: recordedTaggedCurrent,
  });
  if (!partitioned.currentRelease || !sameJson(partitioned.releases, recordedReleases)) {
    throw new Error('Checked-in component release history is stale; run component-metadata:history.');
  }
  if (requirePersistedTaggedCurrent && recordedTaggedCurrent === null &&
      (partitioned.currentRelease.manifestSha256 !== history?.current?.manifestSha256 ||
       !sameJson(partitioned.currentRelease.tags, history?.current?.tags))) {
    throw new Error(
      'history.taggedCurrent must persist the immutable release snapshot before same-version current metadata can evolve.',
    );
  }
  return {
    releases: rolloverCurrent ? reproducedReleases : recordedReleases,
    taggedCurrent: rolloverCurrent ? null : partitioned.taggedCurrent,
    currentRelease: partitioned.currentRelease,
  };
}

export function deriveSinceByTag(history) {
  const sinceByTag = new Map();
  const releases = [...(history?.releases ?? [])].sort((left, right) =>
    compareVersions(left.version, right.version));
  for (const release of releases) {
    if (!release.manifestPresent) continue;
    for (const tag of release.tags ?? []) {
      if (!sinceByTag.has(tag)) sinceByTag.set(tag, release.version);
    }
  }
  for (const tag of history?.taggedCurrent?.tags ?? []) {
    if (!sinceByTag.has(tag)) sinceByTag.set(tag, history.taggedCurrent.version);
  }
  if (!history?.taggedCurrent) {
    for (const tag of history?.current?.tags ?? []) {
      if (!sinceByTag.has(tag)) sinceByTag.set(tag, history.current.version);
    }
  }
  return sinceByTag;
}

function assignmentProfiles(metadata, findings) {
  const byTag = new Map();
  const profiles = metadata?.profiles;
  const assignments = metadata?.assignments;
  if (!profiles || typeof profiles !== 'object' || Array.isArray(profiles)) {
    findings.push('profiles must be an object');
    return byTag;
  }
  if (!assignments || typeof assignments !== 'object' || Array.isArray(assignments)) {
    findings.push('assignments must be an object');
    return byTag;
  }

  for (const [name, profile] of Object.entries(profiles)) {
    if (!COMPONENT_STATUSES.includes(profile?.status)) {
      findings.push(`${name}: profile status must be stable or experimental`);
    }
    if (text(profile?.rationale).length < 24) {
      findings.push(`${name}: profile needs a maintainer-readable rationale`);
    }
    if (text(profile?.graduationCriteria).length < 24) {
      findings.push(`${name}: profile needs maintainer-readable graduation criteria`);
    }
    if (!Object.hasOwn(assignments, name)) findings.push(`${name}: profile has no explicit assignment list`);
  }
  for (const [name, tags] of Object.entries(assignments)) {
    if (!Object.hasOwn(profiles, name)) findings.push(`${name}: assignment references an unknown profile`);
    if (!Array.isArray(tags)) {
      findings.push(`${name}: assignments must be an array`);
      continue;
    }
    const sorted = [...tags].sort(compareText);
    if (!sameJson(tags, sorted)) findings.push(`${name}: assignments must be sorted`);
    if (new Set(tags).size !== tags.length) findings.push(`${name}: assignments contain duplicate tags`);
    for (const tag of tags) {
      if (byTag.has(tag)) findings.push(`${tag}: assigned to more than one maturity profile`);
      else byTag.set(tag, name);
    }
  }
  return byTag;
}

function manifestDeclarationsByTag(manifest) {
  return new Map(
    (manifest?.modules ?? [])
      .flatMap((module) => module.declarations ?? [])
      .filter((declaration) => declaration.customElement && text(declaration.tagName))
      .map((declaration) => [declaration.tagName, declaration]),
  );
}

function manifestMember(declaration, kind, name) {
  const collections = {
    attribute: declaration?.attributes,
    event: declaration?.events,
    slot: declaration?.slots,
    part: declaration?.cssParts,
    'css-property': declaration?.cssProperties,
    'css-state': declaration?.cssStates,
  };
  if (kind === 'property') {
    return (declaration?.members ?? []).find((entry) => entry.kind === 'field' && entry.name === name);
  }
  if (kind === 'method') {
    return (declaration?.members ?? []).find((entry) => entry.kind === 'method' && entry.name === name);
  }
  return (collections[kind] ?? []).find((entry) => entry.name === name);
}

function isDeprecatedEntry(entry) {
  return Boolean(entry?.deprecated) || /^\s*deprecated\b/i.test(entry?.description ?? '');
}

function deprecatedManifestEntries(tag, declaration) {
  const entries = [];
  if (declaration?.deprecated) entries.push({ tag, kind: 'component', name: tag });
  for (const [collection, kind] of [
    ['attributes', 'attribute'],
    ['events', 'event'],
    ['slots', 'slot'],
    ['cssParts', 'part'],
    ['cssProperties', 'css-property'],
    ['cssStates', 'css-state'],
  ]) {
    for (const entry of declaration?.[collection] ?? []) {
      if (isDeprecatedEntry(entry)) entries.push({ tag, kind, name: entry.name });
    }
  }
  for (const entry of declaration?.members ?? []) {
    const kind = entry.kind === 'field' ? 'property' : entry.kind === 'method' ? 'method' : null;
    if (kind && isDeprecatedEntry(entry)) entries.push({ tag, kind, name: entry.name });
  }
  return entries;
}

/** Whether a record names a replacement at all; the shape itself is reported once, below. */
function namesReplacement(replacement) {
  return Boolean(replacement) && typeof replacement === 'object' && Boolean(text(replacement.name));
}

/**
 * The version-window, rationale, and replacement rules every deprecation record shares, whether it
 * names a component member or a package export.
 *
 * `since: 'unreleased'` marks a deprecation that lands after the current release tag and ships in
 * the next release. It is only meaningful while `history.taggedCurrent` records that tag (the same
 * condition under which a post-tag component resolves to `unreleased`), and its removal floor is
 * measured from the current major: the lowest major the next release can have. The version
 * rollover in `generate-component-metadata.mjs --write` stamps the released version in place of
 * `unreleased`, and this same check then fails closed if that release turned out to be a major the
 * recorded floor no longer clears.
 */
function validateDeprecationWindow(label, entry, context, findings) {
  const { currentVersion, minimumFullMajors, taggedCurrent, introducedIn = null } = context;
  const unreleased = entry?.since === UNRELEASED_VERSION;
  const since = unreleased ? null : parseVersion(entry?.since);
  const removal = parseVersion(entry?.removalNotBefore);
  if (unreleased) {
    if (!taggedCurrent) {
      findings.push(
        `${label}: an unreleased deprecation is only valid while history.taggedCurrent records the current release`,
      );
    }
  } else if (!since) {
    findings.push(`${label}: deprecation needs a valid since version`);
  }
  if (!removal) findings.push(`${label}: deprecation needs a valid removalNotBefore version`);
  if (since && introducedIn && compareVersions(entry.since, introducedIn) < 0) {
    findings.push(`${label}: deprecation cannot predate the component's ${introducedIn} introduction`);
  }
  if (since && parseVersion(currentVersion) && compareVersions(entry.since, currentVersion) > 0) {
    findings.push(`${label}: deprecation cannot start after the current package version`);
  }
  const floorMajor = unreleased ? parseVersion(currentVersion)?.major : since?.major;
  if (Number.isInteger(floorMajor) && removal && Number.isInteger(minimumFullMajors)) {
    const earliestRemovalMajor = floorMajor + minimumFullMajors + 1;
    if (removal.major < earliestRemovalMajor) {
      findings.push(
        `${label}: removalNotBefore must preserve the API through ${minimumFullMajors} complete subsequent major release(s)`,
      );
    }
  }
  if (text(entry?.rationale).length < 24) findings.push(`${label}: deprecation needs a rationale`);
  if (!namesReplacement(entry?.replacement)) {
    findings.push(`${label}: deprecation must name a replacement`);
  }
}

/**
 * A `slot-content` record deprecates a kind of content inside a slot that itself survives -- for
 * example non-item children of a menu's default slot. The slot therefore must exist and must NOT be
 * marked deprecated (that would be a `slot` record, and for a mirrored tag a false deprecation
 * mismatch against upstream); its description carries the authored marker instead, saying which
 * content is deprecated without starting with "Deprecated".
 */
function validateSlotContentRecord(key, entry, declaration, componentsByTag, findings) {
  const slot = manifestMember(declaration, 'slot', entry.name);
  if (!slot) {
    findings.push(`${key}: ${entry.name ? `slot ${entry.name}` : 'the default slot'} does not exist`);
  } else if (isDeprecatedEntry(slot)) {
    findings.push(`${key}: the slot itself is deprecated; record a slot deprecation instead`);
  } else if (!/\bdeprecated\b/i.test(slot.description ?? '')) {
    findings.push(`${key}: the slot description must say which content is deprecated`);
  }
  if (entry.permittedContent === undefined) return;
  const permitted = entry.permittedContent;
  if (!Array.isArray(permitted) || permitted.length === 0) {
    findings.push(`${key}: permittedContent must be a non-empty array when present`);
    return;
  }
  if (!sameJson(permitted, [...new Set(permitted)].sort(compareText))) {
    findings.push(`${key}: permittedContent must be sorted and unique`);
  }
  for (const name of permitted) {
    if (typeof name !== 'string' || !ELEMENT_NAME_PATTERN.test(name)) {
      findings.push(`${key}: permitted content ${String(name)} is not an element name`);
    } else if (name.includes('-') && !componentsByTag.has(name)) {
      findings.push(`${key}: permitted content ${name} is not a known component`);
    }
  }
}

function validateDeprecations(metadata, componentsByTag, manifest, findings) {
  const deprecations = metadata?.deprecations;
  if (!Array.isArray(deprecations)) {
    findings.push('deprecations must be an array');
    return;
  }
  const covered = new Set();
  const seen = new Set();
  const declarationsByTag = manifestDeclarationsByTag(manifest);
  // A subclass tag records its own copy of an alias it inherits, so each record is checked against
  // the tag's full public surface. The compact manifest omits inherited members from a subclass,
  // so the per-record lookups read the inheritance-expanded view; the closing coverage loop keeps
  // the compact view, where each deprecated member appears only on its declaring tag.
  const expandedDeclarationsByTag = manifestDeclarationsByTag(expandManifestInheritance(manifest));
  const componentSinceByTag = deriveSinceByTag(metadata?.history);
  const currentVersion = metadata?.history?.current?.version;
  const taggedCurrent = metadata?.history?.taggedCurrent ?? null;
  const minimumFullMajors = metadata?.policy?.deprecation?.minimumFullMajorsAfterDeprecation;
  if (!Number.isInteger(minimumFullMajors) || minimumFullMajors < 1) {
    findings.push('policy.deprecation.minimumFullMajorsAfterDeprecation must be at least 1');
  }
  const deprecationKeys = deprecations.map((entry) =>
    `${entry?.tag}:${entry?.kind}:${entry?.name}`);
  if (!sameJson(deprecationKeys, [...deprecationKeys].sort(compareText))) {
    findings.push('deprecations must be sorted by tag, kind, and name');
  }

  for (const entry of deprecations) {
    const key = `${entry?.tag}:${entry?.kind}:${entry?.name}`;
    if (seen.has(key)) findings.push(`${key}: duplicate deprecation record`);
    seen.add(key);
    const component = componentsByTag.get(entry?.tag);
    const declaration = expandedDeclarationsByTag.get(entry?.tag);
    if (!component) {
      findings.push(`${key}: deprecation references an unknown component`);
      continue;
    }
    validateDeprecationWindow(key, entry, {
      currentVersion,
      minimumFullMajors,
      taggedCurrent,
      introducedIn: componentSinceByTag.get(entry.tag) ?? null,
    }, findings);
    const replacement = entry.replacement;
    const hasReplacement = namesReplacement(replacement);

    if (entry.kind === 'component') {
      if (entry.name !== entry.tag) findings.push(`${key}: component deprecation name must equal its tag`);
      covered.add(`${entry.tag}:component:${entry.tag}`);
      if (replacement?.kind === 'component' && !componentsByTag.has(replacement.name)) {
        findings.push(`${key}: replacement component ${replacement.name} does not exist`);
      }
      continue;
    }
    if (entry.kind === 'slot-content') {
      validateSlotContentRecord(key, entry, declaration, componentsByTag, findings);
    } else {
      const member = manifestMember(declaration, entry.kind, entry.name);
      if (!member) findings.push(`${key}: deprecated public member does not exist`);
      else if (!isDeprecatedEntry(member)) findings.push(`${key}: public member is not marked deprecated in the manifest`);
      covered.add(`${entry.tag}:${entry.kind}:${entry.name}`);
    }

    if (entry.kind === 'property' && entry.attribute) {
      const attribute = manifestMember(declaration, 'attribute', entry.attribute);
      if (!isDeprecatedEntry(attribute)) findings.push(`${key}: paired attribute ${entry.attribute} is not deprecated`);
      covered.add(`${entry.tag}:attribute:${entry.attribute}`);
    }
    if (!hasReplacement) continue;
    if (
      replacement.kind === 'host-css-property' &&
      !HOST_CSS_REPLACEMENTS.includes(replacement.name)
    ) {
      findings.push(`${key}: unsupported host CSS replacement ${replacement.name}`);
    } else if (
      replacement.kind !== 'component' &&
      replacement.kind !== 'host-css-property' &&
      !manifestMember(declaration, replacement.kind, replacement.name)
    ) {
      findings.push(`${key}: replacement ${replacement.kind} ${replacement.name} does not exist`);
    }
    if (replacement.kind === 'component' && !componentsByTag.has(replacement.name)) {
      findings.push(`${key}: replacement component ${replacement.name} does not exist`);
    }
  }

  for (const [tag, declaration] of declarationsByTag) {
    for (const entry of deprecatedManifestEntries(tag, declaration)) {
      const key = `${entry.tag}:${entry.kind}:${entry.name}`;
      if (!covered.has(key)) findings.push(`${key}: manifest deprecation has no policy record`);
    }
  }
}

function defaultReadSource(relativePath) {
  try {
    return fs.readFileSync(path.join(packageDir, relativePath), 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function exportDeprecationKey(entry) {
  return `${entry?.kind}:${entry?.module ?? ''}:${entry?.name}`;
}

function exportDeprecationLabel(entry) {
  return [...NAMED_EXPORT_KINDS, ...MODULE_CONTRACT_KINDS].includes(entry?.kind)
    ? `exportDeprecations ${entry.kind} ${entry?.module}#${entry?.name}`
    : `exportDeprecations ${entry?.kind} ${entry?.name}`;
}

/** The runtime target a package export resolves to, preferring the import/default condition. */
function exportTarget(value) {
  if (value === null) return null;
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    if (Object.hasOwn(value, 'import')) return exportTarget(value.import);
    if (Object.hasOwn(value, 'default')) return exportTarget(value.default);
  }
  return undefined;
}

function resolveExportMapping(exportsMap, specifier) {
  if (Object.hasOwn(exportsMap, specifier)) return { value: exportsMap[specifier], capture: null };
  // A more-specific null target blocks broader patterns too.
  const patterns = Object.keys(exportsMap).filter(key => key.includes('*')).sort((a, b) =>
    b.indexOf('*') - a.indexOf('*') || b.length - a.length);
  for (const pattern of patterns) {
    const [prefix, suffix] = pattern.split('*');
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix) || specifier.length < prefix.length + suffix.length) continue;
    const capture = specifier.slice(prefix.length, suffix ? -suffix.length : undefined);
    return { value: exportsMap[pattern], capture };
  }
  return null;
}

function resolveExportTarget(exportsMap, specifier) {
  const mapping = resolveExportMapping(exportsMap, specifier);
  const target = mapping && exportTarget(mapping.value);
  return target && mapping.capture !== null ? target.replaceAll('*', mapping.capture) : target;
}

/**
 * Resolves one exact `package.json#exports` specifier to its TypeScript source (`./dist/X.js` is
 * built from `src/X.ts`), reporting why it cannot be a deprecation subject or replacement.
 */
function exportSource(label, specifier, subject, { exportsMap, readSource }, findings, stylesheet = false) {
  if (typeof specifier !== 'string' || (specifier !== '.' && !specifier.startsWith('./')) || specifier.split('/').some(part => part === '..')) {
    findings.push(`${label}: ${subject} is not a package export`);
    return null;
  }
  if (specifier.includes('*')) {
    findings.push(`${label}: ${subject} must name one exact export, not a pattern`);
    return null;
  }
  const target = resolveExportTarget(exportsMap, specifier);
  if (!target) {
    findings.push(`${label}: ${subject} is not a package export`);
    return null;
  }
  const match = (stylesheet ? /^\.\/dist\/(.+)\.css$/ : /^\.\/dist\/(.+)\.js$/).exec(target);
  if (!match) {
    findings.push(`${label}: ${subject} does not resolve to a built ${stylesheet ? 'CSS stylesheet' : 'JavaScript module'}`);
    return null;
  }
  const sourcePath = `src/${match[1]}.${stylesheet ? 'css' : 'ts'}`;
  const source = readSource(sourcePath);
  if (typeof source !== 'string') {
    findings.push(`${label}: ${subject} has no ${stylesheet ? 'CSS' : 'TypeScript'} source at ${sourcePath}`);
    return null;
  }
  return { sourcePath, source };
}

/** The JSDoc block that ends immediately (whitespace only) before `position`, if any. */
function leadingJsDoc(comments, source, position) {
  const comment = comments.findLast((candidate) => candidate.end <= position);
  if (!comment || !/^\s*$/.test(source.slice(comment.end, position))) return null;
  return comment.value;
}

/**
 * Maps each name a module exports to whether it is type-only and whether a `@deprecated` JSDoc sits
 * directly above it -- above the individual re-export specifier, or else above the statement.
 */
function moduleExportsByName({ sourcePath, source }) {
  const result = parseSync(sourcePath, source);
  if (result.errors.length) return null;
  const comments = result.comments.filter((comment) =>
    comment.type === 'Block' && comment.value.startsWith('*'));
  const byName = new Map();
  for (const statement of result.module.staticExports) {
    for (const entry of statement.entries) {
      const name = entry.exportName?.name;
      if (!name) continue;
      const doc = leadingJsDoc(comments, source, entry.start) ??
        leadingJsDoc(comments, source, statement.start) ?? '';
      byName.set(name, { isType: entry.isType === true, deprecated: /@deprecated\b/.test(doc) });
    }
  }
  return byName;
}

function moduleExportsOrFinding(label, resolved, subject, findings) {
  const exportsByName = moduleExportsByName(resolved);
  if (!exportsByName) findings.push(`${label}: ${subject} source ${resolved.sourcePath} does not parse`);
  return exportsByName;
}

function moduleContainsContract(resolved, name) {
  const parsed = parseSync(resolved.sourcePath, resolved.source);
  if (parsed.errors.length) return null;
  let found = false;
  const visit = node => {
    if (!node || typeof node !== 'object' || found) return;
    if ((node.type === 'Literal' || node.type === 'StringLiteral') && node.value === name) found = true;
    else for (const [key, value] of Object.entries(node)) {
      if (key === 'comments') continue;
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(parsed.program);
  return found;
}

/**
 * Inspect a current package contract using the same resolver as deprecation validation.
 * Missing mapped source or malformed syntax is invalid, never proof that an API was removed.
 * Entry-point and global-contract notices live in policy; named notices also live in JSDoc.
 */
export function inspectExportContract(entry, { packageJson, readSource = defaultReadSource, exportDeprecations = [] }) {
  const result = { status: 'invalid', sourcePath: null, isType: null, deprecated: null, findings: [] };
  const label = exportDeprecationLabel(entry);
  if (!EXPORT_DEPRECATION_KINDS.includes(entry?.kind)) {
    result.findings.push(`${label}: unsupported export kind`);
    return result;
  }
  const route = entry.kind === 'entry-point' || entry.kind === 'stylesheet';
  const specifier = route ? entry.name : entry.module;
  if (typeof specifier !== 'string' || (specifier !== '.' && !specifier.startsWith('./')) || specifier.includes('*') || specifier.split('/').some(part => part === '..')) {
    result.findings.push(`${label}: must name one exact package export`);
    return result;
  }
  if (typeof entry.name !== 'string' || !entry.name) {
    result.findings.push(`${label}: contract name is required`);
    return result;
  }
  const global = MODULE_CONTRACT_KINDS.includes(entry.kind);
  if (global && !(entry.kind === 'window-event' ? /^lr-[a-z0-9]+(?:-[a-z0-9]+)*$/ : /^data-lr-[a-z0-9]+(?:-[a-z0-9]+)*$/).test(entry.name)) {
    result.findings.push(`${label}: invalid ${entry.kind} name`);
    return result;
  }
  const exportsMap = packageJson?.exports;
  if (!exportsMap || typeof exportsMap !== 'object' || Array.isArray(exportsMap)) {
    result.findings.push(`${label}: a current package exports map is required`);
    return result;
  }
  const mapping = resolveExportMapping(exportsMap, specifier);
  const target = mapping && resolveExportTarget(exportsMap, specifier);
  if (!mapping || target === null) return { ...result, status: 'absent' };
  if (typeof target !== 'string' || !target) {
    result.findings.push(`${label}: package export conditions cannot be resolved`);
    return result;
  }
  const resolved = exportSource(label, specifier, specifier, { exportsMap, readSource }, result.findings, entry.kind === 'stylesheet');
  if (!resolved) return result;
  result.sourcePath = resolved.sourcePath;
  const policyNotice = exportDeprecations.some(record => record.kind === entry.kind && record.name === entry.name && (record.module ?? null) === (entry.module ?? null));
  if (entry.kind === 'stylesheet') return { ...result, status: 'present', deprecated: policyNotice };
  if (global) {
    const present = moduleContainsContract(resolved, entry.name);
    if (present === null) result.findings.push(`${label}: source ${resolved.sourcePath} does not parse`);
    else return { ...result, status: present ? 'present' : 'absent', deprecated: present ? policyNotice : null };
    return result;
  }
  const exportsByName = moduleExportsOrFinding(label, resolved, specifier, result.findings);
  if (!exportsByName) return result;
  if (route) return { ...result, status: 'present', deprecated: policyNotice };
  const own = exportsByName.get(entry.name);
  return own ? { ...result, status: 'present', isType: own.isType, deprecated: own.deprecated || policyNotice } : { ...result, status: 'absent' };
}

function validateEntryPointDeprecation(label, entry, deprecatedEntryPoints, resolveContext, findings) {
  exportSource(label, entry.name, entry.name, resolveContext, findings, entry.kind === 'stylesheet');
  const replacement = entry.replacement;
  if (!namesReplacement(replacement)) return;
  if (replacement.kind !== entry.kind) {
    findings.push(`${label}: replacement must be another ${entry.kind === 'stylesheet' ? 'stylesheet' : 'entry point'}`);
  } else if (deprecatedEntryPoints.has(replacement.name)) {
    findings.push(`${label}: replacement ${replacement.name} is itself deprecated`);
  } else {
    exportSource(label, replacement.name, `replacement ${entry.kind === 'stylesheet' ? 'stylesheet' : 'entry point'} ${replacement.name}`, resolveContext, findings, entry.kind === 'stylesheet');
  }
}

/** Global DOM contracts must occur as syntax in their owning module, never only in prose. */
function validateModuleContractDeprecation(label, entry, resolveContext, findings) {
  const verify = (contract, subject) => {
    const pattern = contract.kind === 'window-event' ? /^lr-[a-z0-9]+(?:-[a-z0-9]+)*$/ : /^data-lr-[a-z0-9]+(?:-[a-z0-9]+)*$/;
    if (!pattern.test(contract.name ?? '')) {
      findings.push(`${label}: ${subject} has an invalid ${contract.kind} name`);
      return;
    }
    const resolved = exportSource(label, contract.module, subject, resolveContext, findings);
    if (!resolved) return;
    const found = moduleContainsContract(resolved, contract.name);
    if (found === null) {
      findings.push(`${label}: ${subject} source ${resolved.sourcePath} does not parse`);
      return;
    }
    if (!found) findings.push(`${label}: ${subject} is not declared or used in ${contract.module}`);
  };
  verify(entry, entry.name);
  if (!namesReplacement(entry.replacement)) return;
  if (entry.replacement.kind !== entry.kind) findings.push(`${label}: replacement must be another ${entry.kind}`);
  else verify({ ...entry.replacement, module: entry.replacement.module ?? entry.module }, `replacement ${entry.replacement.name}`);
}

function validateNamedExportDeprecation(label, entry, resolveContext, findings) {
  const resolved = exportSource(label, entry.module, entry.module, resolveContext, findings);
  if (!resolved) return;
  const exportsByName = moduleExportsOrFinding(label, resolved, entry.module, findings);
  if (!exportsByName) return;
  const own = exportsByName.get(entry.name);
  if (!own) findings.push(`${label}: ${entry.module} does not export ${entry.name}`);
  else if (entry.kind === 'type' && !own.isType) findings.push(`${label}: ${entry.name} is not a type-only export`);
  else if (entry.kind !== 'type' && own.isType) findings.push(`${label}: ${entry.name} is not a runtime value export`);
  else if (!own.deprecated) {
    findings.push(`${label}: ${entry.name} has no @deprecated JSDoc directly above its export`);
  }

  const replacement = entry.replacement;
  if (!namesReplacement(replacement)) return;
  if (!NAMED_EXPORT_KINDS.includes(replacement.kind)) {
    findings.push(`${label}: replacement must name a type, function, constant or class export`);
    return;
  }
  const replacementModule = replacement.module ?? entry.module;
  let replacementExports = exportsByName;
  if (replacementModule !== entry.module) {
    const replacementSource = exportSource(
      label,
      replacementModule,
      `replacement module ${replacementModule}`,
      resolveContext,
      findings,
    );
    if (!replacementSource) return;
    replacementExports = moduleExportsOrFinding(label, replacementSource, replacementModule, findings);
    if (!replacementExports) return;
  }
  const target = replacementExports.get(replacement.name);
  if (!target) {
    findings.push(`${label}: replacement ${entry.kind} ${replacement.name} is not exported by ${replacementModule}`);
  } else if (target.deprecated) {
    findings.push(`${label}: replacement ${entry.kind} ${replacement.name} is itself deprecated`);
  } else if (replacement.kind === 'type' ? !target.isType : target.isType) {
    findings.push(`${label}: replacement ${replacement.name} is not a ${replacement.kind === 'type' ? 'type-only' : 'runtime value'} export`);
  }
}

/**
 * Validates `exportDeprecations`: package-level deprecations that no component declaration can
 * carry. An `entry-point` record deprecates one exact `package.json#exports` specifier (every
 * import of that path) in favour of another; a `type` record deprecates one type-only export of an
 * exact specifier; `function`, `constant` and `class` records cover named runtime exports. Exact specifiers
 * may resolve through package patterns. Stylesheets and global DOM contracts share this ledger.
 * Named exports carry `@deprecated` directly above the export for editor diagnostics. All kinds
 * share the tag-scoped ledger's window and rationale rules.
 */
function validateExportDeprecations(metadata, { packageJson, readSource }, findings) {
  const records = metadata?.exportDeprecations;
  if (!Array.isArray(records)) {
    findings.push('exportDeprecations must be an array');
    return;
  }
  const keys = records.map(exportDeprecationKey);
  if (!sameJson(keys, [...keys].sort(compareText))) {
    findings.push('exportDeprecations must be sorted by kind, module, and name');
  }
  const context = {
    currentVersion: metadata?.history?.current?.version,
    minimumFullMajors: metadata?.policy?.deprecation?.minimumFullMajorsAfterDeprecation,
    taggedCurrent: metadata?.history?.taggedCurrent ?? null,
  };
  const resolveContext = {
    exportsMap: packageJson?.exports && typeof packageJson.exports === 'object' ? packageJson.exports : {},
    readSource,
  };
  const deprecatedEntryPoints = new Set(records
    .filter((entry) => entry?.kind === 'entry-point' || entry?.kind === 'stylesheet')
    .map((entry) => entry.name));
  const seen = new Set();
  for (const entry of records) {
    const label = exportDeprecationLabel(entry);
    const key = exportDeprecationKey(entry);
    if (seen.has(key)) {
      findings.push(`${label}: duplicate deprecation record`);
      continue;
    }
    seen.add(key);
    if (!EXPORT_DEPRECATION_KINDS.includes(entry?.kind)) {
      findings.push(`${label}: kind must be ${EXPORT_DEPRECATION_KINDS.join(', ')}`);
      continue;
    }
    validateDeprecationWindow(label, entry, context, findings);
    if (entry.kind === 'entry-point' || entry.kind === 'stylesheet') {
      validateEntryPointDeprecation(label, entry, deprecatedEntryPoints, resolveContext, findings);
    } else if (MODULE_CONTRACT_KINDS.includes(entry.kind)) {
      validateModuleContractDeprecation(label, entry, resolveContext, findings);
      const replacement = entry.replacement;
      if (replacement && records.some(record => record.kind === replacement.kind &&
          record.module === (replacement.module ?? entry.module) && record.name === replacement.name)) {
        findings.push(`${label}: replacement ${replacement.name} is itself deprecated`);
      }
    } else {
      validateNamedExportDeprecation(label, entry, resolveContext, findings);
    }
  }
}

/**
 * Replaces every `since: 'unreleased'` deprecation (tag-scoped and export-level) with the version
 * being released. `generate-component-metadata.mjs --write` applies it on the version rollover,
 * before validation, so a record never ships reading `unreleased`, and a record whose removal floor
 * was set against a lower major fails validation instead of silently shipping one major short.
 */
export function stampUnreleasedDeprecations(metadata, version) {
  if (!parseVersion(version)) {
    throw new Error(`Cannot stamp unreleased deprecations with ${String(version)}; expected a released version.`);
  }
  const stamp = (entries) => entries.map((entry) =>
    entry?.since === UNRELEASED_VERSION ? { ...entry, since: version } : entry);
  const stamped = { ...metadata };
  if (Array.isArray(metadata?.deprecations)) stamped.deprecations = stamp(metadata.deprecations);
  if (Array.isArray(metadata?.exportDeprecations)) {
    stamped.exportDeprecations = stamp(metadata.exportDeprecations);
  }
  return stamped;
}

/**
 * The Markdown subject of one tag-scoped deprecation record, shared by the generated component
 * references and editor data: the default slot has no name to quote, and a `slot-content` record
 * names the content it covers rather than a member.
 */
export function formatDeprecationSubject(entry, tagName) {
  if (entry?.kind === 'component') return `\`${tagName}\``;
  if (entry?.kind === 'slot' && !entry.name) return 'default slot';
  if (entry?.kind === 'slot-content') {
    const subject = entry.name ? `\`${entry.name}\`-slot content` : 'default-slot content';
    const permitted = Array.isArray(entry.permittedContent) ? entry.permittedContent : [];
    return permitted.length
      ? `${subject} other than ${permitted.map((name) => `\`<${name}>\``).join(', ')}`
      : subject;
  }
  return `\`${entry?.name}\`${entry?.attribute ? ` / \`${entry.attribute}\`` : ''}`;
}

function expectedMaturity(metadata, inventory) {
  return componentMetadataByTag(metadata, {
    tags: (inventory.components ?? []).map((component) => component.tag),
    packageVersion: metadata?.history?.current?.version,
  });
}

/**
 * Resolves the authored profile, history-derived introduction version, and structured
 * deprecations for an exact set of public tags. A just-scaffolded tag is allowed to fall back to
 * the current package version: the scaffold adds its explicit profile assignment before CEM runs,
 * then refreshes the current-history record immediately afterwards.
 */
export function componentMetadataByTag(
  metadata,
  { tags = null, packageVersion = metadata?.history?.current?.version } = {},
) {
  const findings = [];
  const profileByTag = assignmentProfiles(metadata, findings);
  if (findings.length) throw new Error(findings.join('\n'));
  const sinceByTag = deriveSinceByTag(metadata.history);
  const deprecationsByTag = new Map();
  for (const entry of metadata.deprecations ?? []) {
    const entries = deprecationsByTag.get(entry.tag) ?? [];
    entries.push(entry);
    deprecationsByTag.set(entry.tag, entries);
  }
  const requestedTags = tags === null ? [...profileByTag.keys()] : [...tags];
  return new Map(requestedTags.sort(compareText).map((tag) => {
    const profileName = profileByTag.get(tag);
    if (!profileName) throw new Error(`${tag}: no authored maturity assignment`);
    const profile = metadata.profiles[profileName];
    const since = sinceByTag.get(tag) ??
      (metadata.history?.taggedCurrent ? UNRELEASED_VERSION : packageVersion ?? null);
    if (since !== UNRELEASED_VERSION && !parseVersion(since)) {
      throw new Error(`${tag}: history does not derive a valid since version`);
    }
    return [tag, {
      status: profile.status,
      since,
      deprecated: null,
      profile: profileName,
      rationale: profile.rationale,
      graduationCriteria: profile.graduationCriteria,
      deprecations: (deprecationsByTag.get(tag) ?? []).sort((left, right) =>
        compareText(`${left.kind}:${left.name}`, `${right.kind}:${right.name}`)),
    }];
  }));
}

/**
 * Materializes the two source-level JSDoc tags that catalog tools and maintainers expect directly
 * above a component class. The exact `@customElement` marker selects the right JSDoc even when a
 * class module also exports helpers; existing status/since lines are replaced idempotently.
 */
export function annotateComponentSource(source, { tag, status, since }) {
  if (!COMPONENT_STATUSES.includes(status)) throw new Error(`${tag}: invalid source annotation status`);
  if (since !== UNRELEASED_VERSION && !parseVersion(since)) {
    throw new Error(`${tag}: invalid source annotation since version`);
  }
  const marker = `@customElement ${tag}`;
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0 || source.indexOf(marker, markerIndex + marker.length) >= 0) {
    throw new Error(`${tag}: source must contain exactly one ${marker}`);
  }
  const open = source.lastIndexOf('/**', markerIndex);
  const close = source.indexOf('*/', markerIndex);
  if (open < 0 || close < 0) throw new Error(`${tag}: @customElement must be inside a JSDoc block`);
  const after = source.slice(close + 2);
  if (!/^\s*export\s+(?:abstract\s+)?class\s+/.test(after)) {
    throw new Error(`${tag}: component JSDoc must sit directly above its exported class`);
  }

  const lines = source.slice(open, close + 2).split('\n')
    .filter((line) => !/^\s*\*\s+@(?:status|since)\b/.test(line));
  const closingIndex = lines.findIndex((line) => /^\s*\*\/\s*$/.test(line));
  if (closingIndex < 0) throw new Error(`${tag}: component JSDoc has no closing line`);
  const indentation = lines[closingIndex].match(/^(\s*)\*\//)?.[1] ?? '';
  lines.splice(
    closingIndex,
    0,
    `${indentation}* @status ${status}`,
    `${indentation}* @since ${since}`,
  );
  return source.slice(0, open) + lines.join('\n') + source.slice(close + 2);
}

function clearManifestMetadataProjection(manifest) {
  for (const module of manifest?.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (!declaration.customElement || !declaration.tagName) continue;
      delete declaration.status;
      delete declaration.since;
      delete declaration.maturity;
      delete declaration.deprecation;
      delete declaration.deprecations;
      for (const collection of [
        declaration.attributes,
        declaration.events,
        declaration.slots,
        declaration.cssParts,
        declaration.cssProperties,
        declaration.cssStates,
        declaration.members,
      ]) {
        for (const entry of collection ?? []) delete entry.deprecation;
      }
    }
  }
}

/**
 * Projects the central component policy into Custom Elements Manifest declarations. `status` and
 * `since` stay easy for generic catalog consumers to read; `maturity` and structured deprecation
 * records retain the reviewed rationale, graduation, replacement, and removal-window details.
 */
export function applyComponentMetadataToManifest(metadata, manifest, { packageVersion } = {}) {
  const declarations = manifestDeclarationsByTag(manifest);
  // A compact manifest omits inherited members from a subclass. A subclass record for an inherited
  // member then stays only in `declaration.deprecations`; the member itself is marked on the tag
  // that declares it.
  let inheritedDeclarations;
  const inheritedMember = (tag, kind, name) => {
    inheritedDeclarations ??= manifestDeclarationsByTag(expandManifestInheritance(manifest));
    return manifestMember(inheritedDeclarations.get(tag), kind, name);
  };
  const metadataByTag = componentMetadataByTag(metadata, {
    tags: [...declarations.keys()],
    packageVersion,
  });

  for (const [tag, declaration] of declarations) {
    const maturity = metadataByTag.get(tag);
    declaration.status = maturity.status;
    declaration.since = maturity.since;
    declaration.maturity = {
      status: maturity.status,
      profile: maturity.profile,
      rationale: maturity.rationale,
      graduationCriteria: maturity.graduationCriteria,
    };
    declaration.deprecations = structuredClone(maturity.deprecations);

    for (const entry of maturity.deprecations) {
      if (entry.kind === 'component') {
        declaration.deprecation = structuredClone(entry);
        declaration.deprecated ??= entry.rationale;
        continue;
      }
      if (entry.kind === 'slot-content') {
        // The slot survives, so the record lives only in `declaration.deprecations`: marking the
        // slot entry itself would publish a slot deprecation that does not exist.
        if (!manifestMember(declaration, 'slot', entry.name)) {
          throw new Error(`${tag}:slot-content:${entry.name}: the slot whose content is deprecated does not exist`);
        }
        continue;
      }
      const member = manifestMember(declaration, entry.kind, entry.name);
      if (member) {
        member.deprecation = structuredClone(entry);
      } else if (!inheritedMember(tag, entry.kind, entry.name)) {
        throw new Error(`${tag}:${entry.kind}:${entry.name}: deprecated public member does not exist`);
      }
      if (entry.kind === 'property' && entry.attribute) {
        const attribute = manifestMember(declaration, 'attribute', entry.attribute);
        if (attribute) {
          attribute.deprecation = structuredClone(entry);
        } else if (!inheritedMember(tag, 'attribute', entry.attribute)) {
          throw new Error(`${tag}:attribute:${entry.attribute}: paired deprecated attribute does not exist`);
        }
      }
    }
  }
  return manifest;
}

function manifestMetadataProjection(manifest) {
  return [...manifestDeclarationsByTag(manifest)]
    .sort(([left], [right]) => compareText(left, right))
    .map(([tag, declaration]) => {
      const entries = [];
      for (const [collection, kind] of [
        ['attributes', 'attribute'],
        ['events', 'event'],
        ['slots', 'slot'],
        ['cssParts', 'part'],
        ['cssProperties', 'css-property'],
        ['cssStates', 'css-state'],
      ]) {
        for (const entry of declaration[collection] ?? []) {
          if (entry.deprecation !== undefined) entries.push({ kind, name: entry.name, deprecation: entry.deprecation });
        }
      }
      for (const entry of declaration.members ?? []) {
        if (entry.deprecation === undefined) continue;
        const kind = entry.kind === 'field' ? 'property' : entry.kind === 'method' ? 'method' : entry.kind;
        entries.push({ kind, name: entry.name, deprecation: entry.deprecation });
      }
      entries.sort((left, right) => compareText(`${left.kind}:${left.name}`, `${right.kind}:${right.name}`));
      return {
        tag,
        status: declaration.status ?? null,
        since: declaration.since ?? null,
        maturity: declaration.maturity ?? null,
        deprecation: declaration.deprecation ?? null,
        deprecations: declaration.deprecations ?? null,
        entries,
      };
    });
}

/** Returns exact tag-level findings when a checked-in CEM no longer matches central metadata. */
export function validateManifestMetadataProjection(metadata, manifest, { packageVersion } = {}) {
  const expandedManifest = expandManifestDeprecations(manifest);
  const expectedManifest = structuredClone(expandedManifest);
  clearManifestMetadataProjection(expectedManifest);
  applyComponentMetadataToManifest(metadata, expectedManifest, { packageVersion });
  const expected = manifestMetadataProjection(expectedManifest);
  const actual = manifestMetadataProjection(expandedManifest);
  const actualByTag = new Map(actual.map((entry) => [entry.tag, entry]));
  return expected
    .filter((entry) => !sameJson(entry, actualByTag.get(entry.tag)))
    .map((entry) => `${entry.tag}: manifest maturity/deprecation projection drifted`);
}

/**
 * `readSource(relativePath)` returns a package-relative source file's text, or `null` when it does
 * not exist; it defaults to the package checkout and is injectable so export deprecations can be
 * validated against fixture sources.
 */
export function validateComponentMetadata(
  metadata,
  { inventory, manifest, packageJson, rawManifest, readSource = defaultReadSource },
) {
  const findings = [];
  if (metadata?.schemaVersion !== COMPONENT_METADATA_SCHEMA_VERSION) {
    findings.push(`schemaVersion must be ${COMPONENT_METADATA_SCHEMA_VERSION}`);
  }
  if (metadata?.history?.source !== 'git-release-manifests') {
    findings.push('history.source must be git-release-manifests');
  }
  if (metadata?.history?.manifestPath !== 'packages/lyra-ui/custom-elements.json') {
    findings.push('history.manifestPath must name the package manifest');
  }
  const current = metadata?.history?.current;
  if (!current || current.version !== packageJson.version) {
    findings.push('history.current.version must match package.json');
  }
  const manifestTags = manifestComponentTags(manifest);
  const inventoryTags = (inventory?.components ?? []).map((component) => component.tag).sort(compareText);
  if (!sameJson(manifestTags, inventoryTags)) findings.push('current manifest and component inventory tags differ');
  if (!sameJson(current?.tags, manifestTags)) findings.push('history.current.tags drifted from the current manifest');
  if (rawManifest && current?.manifestSha256 !== sha256(rawManifest)) {
    findings.push('history.current.manifestSha256 drifted from the current manifest');
  }
  if (!SHA256_PATTERN.test(current?.manifestSha256 ?? '')) {
    findings.push('history.current.manifestSha256 must be a SHA-256 digest');
  }

  const releases = metadata?.history?.releases;
  if (!Array.isArray(releases)) {
    findings.push('history.releases must be an array');
  } else {
    if (releases.some((release) => release.version === current?.version)) {
      findings.push('history.current.version must remain outside history.releases');
    }
    const sorted = [...releases].sort((left, right) => compareVersions(left.version, right.version));
    if (!sameJson(releases, sorted)) findings.push('history.releases must be version-sorted');
    const seenTags = new Set();
    const seenVersions = new Set();
    for (const release of releases) {
      if (seenTags.has(release.tag)) findings.push(`${release.tag}: duplicate release history record`);
      seenTags.add(release.tag);
      if (seenVersions.has(release.version)) findings.push(`${release.version}: duplicate release version record`);
      seenVersions.add(release.version);
      if (releaseTagVersion(release.tag) !== release.version || !parseVersion(release.version)) {
        findings.push(`${String(release.tag)}: release tag/version mismatch`);
      }
      if (!GIT_OBJECT_ID_PATTERN.test(release.sourceCommit ?? '')) {
        findings.push(`${release.tag}: missing or invalid source commit provenance`);
      }
      if (typeof release.manifestPresent !== 'boolean') findings.push(`${release.tag}: missing manifest presence evidence`);
      if (!Array.isArray(release.tags)) findings.push(`${release.tag}: tags must be an array`);
      else {
        const sortedTags = [...release.tags].sort(compareText);
        if (!sameJson(release.tags, sortedTags)) findings.push(`${release.tag}: manifest tags must be sorted`);
        if (new Set(release.tags).size !== release.tags.length) findings.push(`${release.tag}: duplicate manifest tags`);
      }
      if (release.manifestPresent && (!text(release.manifestBlob) || !text(release.manifestSha256))) {
        findings.push(`${release.tag}: present manifest needs blob and digest provenance`);
      }
      if (release.manifestPresent && !GIT_OBJECT_ID_PATTERN.test(release.manifestBlob ?? '')) {
        findings.push(`${release.tag}: manifest blob must be a Git object id`);
      }
      if (release.manifestPresent && !SHA256_PATTERN.test(release.manifestSha256 ?? '')) {
        findings.push(`${release.tag}: manifest digest must be SHA-256`);
      }
      if (!release.manifestPresent &&
          (release.manifestBlob !== null || release.manifestSha256 !== null || release.tags?.length)) {
        findings.push(`${release.tag}: absent manifest cannot carry blob, digest, or tags`);
      }
    }
  }

  const taggedCurrent = metadata?.history?.taggedCurrent;
  if (taggedCurrent !== undefined && taggedCurrent !== null) {
    const prefix = `history.taggedCurrent (${String(taggedCurrent.tag)})`;
    if (taggedCurrent.tag !== `lyra-ui@${current?.version}` ||
        taggedCurrent.version !== current?.version) {
      findings.push(`${prefix}: tag and version must match history.current.version`);
    }
    if (!GIT_OBJECT_ID_PATTERN.test(taggedCurrent.sourceCommit ?? '')) {
      findings.push(`${prefix}: missing or invalid source commit provenance`);
    }
    if (taggedCurrent.manifestPresent !== true) {
      findings.push(`${prefix}: tagged current release must contain the component manifest`);
    }
    if (!GIT_OBJECT_ID_PATTERN.test(taggedCurrent.manifestBlob ?? '')) {
      findings.push(`${prefix}: manifest blob must be a Git object id`);
    }
    if (!SHA256_PATTERN.test(taggedCurrent.manifestSha256 ?? '')) {
      findings.push(`${prefix}: manifest digest must be SHA-256`);
    }
    if (!Array.isArray(taggedCurrent.tags)) {
      findings.push(`${prefix}: tags must be an array`);
    } else {
      const sortedTags = [...taggedCurrent.tags].sort(compareText);
      if (!sameJson(taggedCurrent.tags, sortedTags)) {
        findings.push(`${prefix}: manifest tags must be sorted`);
      }
      if (new Set(taggedCurrent.tags).size !== taggedCurrent.tags.length) {
        findings.push(`${prefix}: duplicate manifest tags`);
      }
    }
    if ((releases ?? []).some((release) =>
      release.tag === taggedCurrent.tag || release.version === taggedCurrent.version)) {
      findings.push(`${prefix}: snapshot must remain outside history.releases until version rollover`);
    }
  }

  if (inventory?.pins?.lyraVersion !== packageJson.version) {
    findings.push('inventory.pins.lyraVersion must match package.json');
  }

  if (metadata?.policy?.semverCoverage?.stable !== 'full' ||
      metadata?.policy?.semverCoverage?.experimental !== 'full') {
    findings.push('stable and experimental APIs must both retain full semver coverage');
  }
  const profileByTag = assignmentProfiles(metadata, findings);
  for (const tag of manifestTags) {
    if (!profileByTag.has(tag)) findings.push(`${tag}: no authored maturity assignment`);
  }
  for (const tag of profileByTag.keys()) {
    if (!manifestTags.includes(tag)) findings.push(`${tag}: maturity assignment is dangling`);
  }
  const sinceByTag = deriveSinceByTag(metadata?.history);
  for (const tag of manifestTags) {
    const since = sinceByTag.get(tag);
    if (!since) {
      if (!metadata?.history?.taggedCurrent) {
        findings.push(`${tag}: history does not derive a since version`);
      }
      continue;
    }
    if (compareVersions(since, packageJson.version) > 0) {
      findings.push(`${tag}: since is newer than package.json`);
    }
  }

  try {
    findings.push(...validateManifestMetadataProjection(metadata, manifest, {
      packageVersion: packageJson.version,
    }));
  } catch (error) {
    findings.push(`manifest maturity/deprecation projection failed: ${error.message}`);
  }

  const componentsByTag = new Map((inventory?.components ?? []).map((component) => [component.tag, component]));
  validateDeprecations(metadata, componentsByTag, manifest, findings);
  validateExportDeprecations(metadata, { packageJson, readSource }, findings);
  if (findings.length === 0) {
    const expected = expectedMaturity(metadata, inventory);
    for (const component of inventory.components) {
      if (!sameJson(component.maturity, expected.get(component.tag))) {
        findings.push(`${component.tag}: inventory maturity metadata drifted`);
      }
    }
  }
  return findings.sort(compareText);
}

export function applyMaturityToInventory(
  metadata,
  inventory,
  { packageVersion = metadata?.history?.current?.version } = {},
) {
  if (!parseVersion(packageVersion)) {
    throw new Error(`Cannot project component inventory for invalid package version ${String(packageVersion)}`);
  }
  const expected = expectedMaturity(metadata, inventory);
  return {
    ...inventory,
    pins: {
      ...inventory.pins,
      lyraVersion: packageVersion,
    },
    components: inventory.components.map((component) => ({
      ...component,
      maturity: expected.get(component.tag),
    })),
  };
}
