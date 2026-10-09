// Gates the migration relationship between pinned Web Awesome/Shoelace catalogs, the component
// inventory, README documentation, and registered Lyra targets. The inventory is authoritative:
// every upstream tag has exactly one exact/rewritten/warning/conceptual/unsupported decision, and
// only the first two classifications are automatic migration inputs. README mirror rows remain
// documentation relationships and must agree with that inventory; they are not a rename allowlist.
// It also gates the Lyra-to-Lyra rename ledger (scripts/fixtures/lyra-renames.json): every entry
// must match an implemented, deprecated alias and its policy record, every deprecation removed in
// a profile's alias-removal major must have an entry, and a rename that flips a boolean's meaning
// must say so.
// Run: node scripts/check-migration-coverage.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandManifestInheritance } from './manifest-compact.mjs';
import { isMainModule } from './is-main-module.mjs';
import { buildMigrationContract, buildMirrorMap, readRenameLedger } from './migrate-wa.mjs';
import { readCurrentCompatibilityContext } from './check-published-compatibility.mjs';
import { readComponentMetadataSources, assembleComponentMetadata } from './component-metadata-source.mjs';
import { compareVersions, validateRenameLedger } from './lyra-rename-ledger.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLASSIFICATIONS = [
  'exact',
  'rewritten',
  'warning-required',
  'conceptual-only',
  'unsupported',
];
const NEGATING = /^(?:no|not|without|hide|disable)-/;
const ASSERTING = /^(?:with|show|enable)-/;

function manifestDeclarations(manifest) {
  return (manifest.modules ?? [])
    .flatMap((module) => module.declarations ?? [])
    .filter((declaration) => declaration.customElement && declaration.tagName);
}

function manifestTags(manifest) {
  return new Set(manifestDeclarations(manifest).map((declaration) => declaration.tagName));
}

/** tag -> the set of event names custom-elements.json says that tag dispatches. */
function manifestEvents(manifest) {
  const events = new Map();
  for (const declaration of manifestDeclarations(manifest)) {
    const names = events.get(declaration.tagName) ?? new Set();
    for (const event of declaration.events ?? []) if (event.name) names.add(event.name);
    events.set(declaration.tagName, names);
  }
  return events;
}

/**
 * The Lyra event name a migrated listener for `name` ends up on: an explicit inventory rewrite
 * when one exists, otherwise the mechanical prefix swap the codemod performs. A native
 * (unprefixed) upstream event keeps its name on both sides.
 */
function migratedEventName(name, ecosystem, eventRewrites) {
  const rewritten = eventRewrites.get(name);
  if (rewritten) return rewritten;
  const prefix = ecosystem === 'webawesome' ? 'wa-' : 'sl-';
  return name.startsWith(prefix) ? `lr-${name.slice(prefix.length)}` : name;
}

function eventExemptionKey(upstreamTag, event) {
  return `${upstreamTag} ${event}`;
}

function polarity(name) {
  return NEGATING.test(name) ? -1 : ASSERTING.test(name) ? 1 : 0;
}

export function hasInvertedPolarity(fromName, toName) {
  const from = polarity(fromName);
  const to = polarity(toName);
  return from !== to && (from === -1 || to === -1);
}

/**
 * A rename pair this check can actually render a verdict on: the two names must differ (an identity
 * entry is not a rename) and at least one side must carry a polarity prefix (comparing two
 * polarity-neutral names can never produce a finding).
 *
 * This exists because the polarity gate had silently become vacuous. The fixture's
 * `attributeRenames` list held ten entries, nine of which were identity mappings (`from === to`)
 * that `generate-component-inventory.mjs` already filters out downstream, and the tenth was a
 * case normalization (`submenuOpen` -> `submenu-open`) with no polarity on either side. So the
 * loop ran, reported success, and had literally nothing it was capable of failing on -- which
 * reads as coverage in CI while catching nothing. An inverted rename is the worst parity break in
 * this library (`light-dismiss` -> `no-light-dismiss`: the migrated markup still parses, nothing
 * warns, and the component quietly behaves the other way round), so a gate that cannot see one is
 * worse than no gate.
 */
export function isPolarityCheckable({ from, to }) {
  return from !== to && (polarity(from) !== 0 || polarity(to) !== 0);
}

/**
 * The same attribute name with its polarity flipped, or `null` when the name carries no polarity.
 * `without-legend` <-> `with-legend`, `no-header` <-> `with-header`, `hide-x` <-> `show-x`.
 */
export function invertedName(name) {
  const flip = [
    [/^without-/, 'with-'],
    [/^no-/, 'with-'],
    [/^not-/, 'with-'],
    [/^hide-/, 'show-'],
    [/^disable-/, 'enable-'],
    [/^with-/, 'without-'],
    [/^show-/, 'hide-'],
    [/^enable-/, 'disable-'],
  ];
  for (const [pattern, replacement] of flip) {
    if (pattern.test(name)) return name.replace(pattern, replacement);
  }
  return null;
}

function kebabName(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

/** Released policy evidence stays separate from the current manifest after an alias is removed. */
export function analyzeRetiredEventHistory(renameLedger, history) {
  const errors = [];
  const version = /^lyra-ui@(\d+\.\d+\.\d+)$/.exec(history?.sourceRelease ?? '')?.[1];
  if (history?.schemaVersion !== 1 || !version || !/^[a-f0-9]{64}$/.test(history?.sourceMetadataSha256 ?? '') ||
      !Array.isArray(history?.deprecations) || !history.deprecations.length) {
    return ['retired event history needs a release tag, metadata SHA-256 and nonempty published policy records'];
  }
  const profiles = Array.isArray(renameLedger?.profiles) ? renameLedger.profiles : [];
  const profile = profiles.find((entry) => entry.fromMajor === Number(version.split('.')[0]));
  if (!profile) return [`retired event history has no migration profile for ${history.sourceRelease}`];
  const records = new Map();
  for (const record of history.deprecations) {
    const key = `${record?.tag} ${record?.name}`;
    if (records.has(key)) errors.push(`retired event history duplicates ${key}`);
    records.set(key, record);
    const introduced = compareVersions(record?.since, version);
    const eligible = compareVersions(record?.removalNotBefore, `${profile.toMajor}.0.0`);
    if (record?.kind !== 'event' || record?.replacement?.kind !== 'event' || introduced === null || introduced > 0 ||
        eligible === null || eligible > 0 || Number(record.removalNotBefore.split('.')[0]) < Number(record.since.split('.')[0]) + 2) {
      errors.push(`retired event history ${key} is not eligible for retirement in ${profile.toMajor}.0.0`);
    }
    const matches = (profile.retiredEvents ?? []).filter((entry) => entry.tag === record?.tag && entry.event === record?.name);
    if (matches.length !== 1) errors.push(`retired event history ${key} needs exactly one ${profile.origin} retiredEvents entry`);
    else if (matches[0].replacement !== record.replacement?.name) errors.push(`retired event history ${key} replacement differs from published policy`);
  }
  for (const candidate of profiles) {
    for (const entry of candidate.retiredEvents ?? []) {
      if (candidate !== profile || !records.has(`${entry.tag} ${entry.event}`)) {
        errors.push(`${candidate.origin}: retired event ${entry.tag} ${entry.event} has no published policy evidence`);
      }
    }
  }
  return errors;
}

/**
 * Ledger findings -- including completeness: every Lyra-only deprecation scheduled for a profile's
 * alias-removal major needs an entry -- plus the prefix polarity rule for Lyra-only renames. A
 * `with-`/`without-` rename is how v22 retires true-defaulting booleans, and it is only safe because
 * the codemod knows to invert the value; an undeclared inversion would be rewritten as a plain
 * rename and silently flip every migrated element. A negating prefix against an asserting prefix
 * or against none (`arrow` -> `without-arrow`) must be declared; a declared inversion between two
 * prefixed names that agree is the opposite mistake. Unprefixed pairs (`editable` -> `readonly`)
 * are judged by the ledger's default check instead: a boolean defaulting to true that becomes one
 * defaulting to false must be declared inverted or keep its default through a `defaults` entry.
 */
export function analyzeRenameLedger(renameLedger, inventory, { sharedTokens = null, exportDeprecations = [], retiredEventHistory = null, compatibilityContext = null } = {}) {
  const errors = validateRenameLedger(renameLedger, { inventory, exportDeprecations, requireCoverage: true, sharedTokens, compatibilityContext });
  if (retiredEventHistory) errors.push(...analyzeRetiredEventHistory(renameLedger, retiredEventHistory));
  const summary = {};
  for (const profile of Array.isArray(renameLedger?.profiles) ? renameLedger.profiles : []) {
    summary[profile.origin] = {
      renames: profile.renames?.length ?? 0,
      defaults: profile.defaults?.length ?? 0,
      detailChanges: profile.detailChanges?.length ?? 0,
      propertyChanges: profile.propertyChanges?.length ?? 0,
      retiredEvents: profile.retiredEvents?.length ?? 0,
      reviews: profile.reviews?.length ?? 0,
      slotContent: profile.slotContent?.length ?? 0,
      moduleReviews: profile.moduleReviews?.length ?? 0,
      ...(Array.isArray(profile.globals) ? { globals: profile.globals.length } : {}),
      ...(Array.isArray(profile.rules) ? { rules: profile.rules.length } : {}),
    };
    for (const entry of profile.renames ?? []) {
      if (entry?.kind !== 'attribute' && entry?.kind !== 'property') continue;
      const from = kebabName(String(entry.from));
      const to = kebabName(String(entry.to));
      const inverted = hasInvertedPolarity(from, to);
      if (inverted && entry.polarity !== 'inverted') {
        errors.push(
          `${profile.origin}: ${entry.tag} ${entry.kind} ${entry.from} -> ${entry.to} inverts its meaning; declare "polarity": "inverted"`,
        );
      } else if (!inverted && entry.polarity === 'inverted' && polarity(from) !== 0 && polarity(to) !== 0) {
        errors.push(
          `${profile.origin}: ${entry.tag} ${entry.kind} ${entry.from} -> ${entry.to} is declared inverted but both names carry the same polarity`,
        );
      }
    }
  }
  return { errors, summary };
}

/** tag -> the set of attribute names custom-elements.json says that tag accepts. */
function manifestAttributes(manifest) {
  const attributes = new Map();
  for (const declaration of manifestDeclarations(manifest)) {
    const names = attributes.get(declaration.tagName) ?? new Set();
    for (const attribute of declaration.attributes ?? []) if (attribute.name) names.add(attribute.name);
    attributes.set(declaration.tagName, names);
  }
  return attributes;
}

function catalog(upstreamTags) {
  return [
    ...(upstreamTags.webawesome?.free ?? []).map((tag) => ({
      tag,
      ecosystem: 'webawesome',
      source: 'wa',
    })),
    ...(upstreamTags.webawesome?.pro ?? []).map((tag) => ({
      tag,
      ecosystem: 'webawesome',
      source: 'wa',
    })),
    ...(upstreamTags.shoelace?.tags ?? []).map((tag) => ({
      tag,
      ecosystem: 'shoelace',
      source: 'sl',
    })),
  ];
}

function namedReadmeUpstream(readme) {
  return new Set([
    ...[...readme.matchAll(/`(wa-[a-z0-9-]+\*?)`/g)].map((match) => match[1]),
    ...[...readme.matchAll(/<(sl-[a-z0-9-]+)>/g)].map((match) => match[1]),
    ...[...readme.matchAll(/`(sl-[a-z0-9-]+)`/g)].map((match) => match[1]),
  ]);
}

/**
 * Returns every migration-coverage defect without mutating its inputs. This is exported so the
 * safety assertions can be exercised with synthetic fixtures rather than by rewriting repo files.
 */
/**
 * Profile `globals` against the real public surface (RFC 0003): a `module` entry's old subpath must
 * be gone from the package exports and its replacement present in the target package's exports, an
 * `export` entry's old name must be absent from the root barrel and its replacement exported, and
 * a `locale-key` entry's old key must be gone from the default strings with its replacement present.
 * `surface` is `{ exports, packages: { [name]: exports }, rootBarrel, stringKeys }`.
 */
export function analyzeGlobalsSurface(renameLedger, surface) {
  const errors = [];
  const patternMatches = (exportsMap, subpath) => Object.hasOwn(exportsMap, subpath) || Object.keys(exportsMap).some((key) => {
    const star = key.indexOf('*');
    return star !== -1 && subpath.startsWith(key.slice(0, star)) && subpath.endsWith(key.slice(star + 1));
  });
  const resolve = (specifier, sample) => {
    const [, scope, name, rest = ''] = /^(@[^/]+)\/([^/]+)(\/.*)?$/.exec(specifier) ?? [];
    return { packageName: `${scope}/${name}`, subpath: `.${rest}${sample}` };
  };
  const hasName = (text, name) => new RegExp(`(?<![$\\w])${name}(?![$\\w])`).test(text);
  for (const profile of Array.isArray(renameLedger?.profiles) ? renameLedger.profiles : []) {
    for (const entry of profile.globals ?? []) {
      const label = `${profile.origin}: global ${entry.kind} ${entry.from}`;
      if (entry.kind === 'module') {
        const sample = entry.prefix ? 'x.js' : '';
        const from = resolve(entry.from, sample);
        const to = resolve(entry.to, sample);
        if (patternMatches(surface.exports, from.subpath)) errors.push(`${label}: ${from.subpath} is still exported by ${from.packageName}`);
        const target = surface.packages[to.packageName];
        if (!target) errors.push(`${label}: ${to.packageName} is not a workspace package`);
        else if (!patternMatches(target, to.subpath)) errors.push(`${label}: ${to.packageName} does not export ${to.subpath}`);
        for (const prefix of entry.except ?? []) {
          const kept = resolve(prefix, '');
          if (!Object.keys(surface.exports).some((key) => key.startsWith(kept.subpath))) errors.push(`${label}: excepted prefix ${prefix} is not exported by ${kept.packageName}`);
        }
      } else if (entry.kind === 'export') {
        if (hasName(surface.rootBarrel, entry.from)) errors.push(`${label}: ${entry.from} is still exported by the package root`);
        if (!hasName(surface.rootBarrel, entry.to)) errors.push(`${label}: ${entry.to} is not exported by the package root`);
      } else if (entry.kind === 'locale-key') {
        if (surface.stringKeys.has(entry.from)) errors.push(`${label}: the key still exists in the default strings`);
        if (!surface.stringKeys.has(entry.to)) errors.push(`${label}: ${entry.to} is not a default string key`);
      }
    }
  }
  return errors;
}

export function analyzeMigrationCoverage({ inventory, upstreamTags, lyraManifest, readme, renameLedger = null, sharedTokens = null, exportDeprecations = [], retiredEventHistory = null, compatibilityContext = null, globalsSurface = null }) {
  const errors = [];
  const polarityCheckablePairs = [];
  const expected = catalog(upstreamTags);
  const knownUpstream = new Set(expected.map((entry) => entry.tag));
  const expandedLyraManifest = expandManifestInheritance(lyraManifest);
  const lyraTags = manifestTags(expandedLyraManifest);
  const lyraEvents = manifestEvents(expandedLyraManifest);
  const lyraAttributeNames = manifestAttributes(expandedLyraManifest);
  const inventoryMappings = Array.isArray(inventory?.mappings) ? inventory.mappings : [];
  const mappingByTag = new Map();
  const upstreamSurfaces = new Map(
    ['webawesome', 'shoelace'].flatMap((ecosystem) =>
      (inventory?.upstreams?.[ecosystem]?.components ?? []).map((component) => [
        component.tag,
        { ecosystem, component },
      ]),
    ),
  );
  const eventExemptions = upstreamTags.unaliasedEvents ?? {};
  const usedEventExemptions = new Set();

  try {
    buildMigrationContract(inventory);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  if (inventory?.schemaVersion !== 1) errors.push('component inventory must use schema version 1');
  for (const ecosystem of ['webawesome', 'shoelace']) {
    const expectedPin = upstreamTags[ecosystem];
    const stored = inventory?.upstreams?.[ecosystem];
    if (!stored) {
      errors.push(`${ecosystem}: component inventory is missing its pinned catalog`);
      continue;
    }
    if (stored.version !== expectedPin.version || stored.commit !== expectedPin.commit) {
      errors.push(`${ecosystem}: component inventory pin drifted from upstream-tags.json`);
    }
    const expectedTags = expected
      .filter((entry) => entry.ecosystem === ecosystem)
      .map((entry) => entry.tag)
      .sort();
    const storedTags = (stored.components ?? []).map((component) => component.tag).sort();
    if (JSON.stringify(storedTags) !== JSON.stringify(expectedTags)) {
      errors.push(`${ecosystem}: inventory catalog does not match every pinned upstream tag`);
    }
  }

  for (const mapping of inventoryMappings) {
    if (mappingByTag.has(mapping.upstreamTag)) {
      errors.push(`${mapping.upstreamTag}: duplicate inventory mapping`);
      continue;
    }
    mappingByTag.set(mapping.upstreamTag, mapping);
    if (!knownUpstream.has(mapping.upstreamTag)) {
      errors.push(`${mapping.upstreamTag}: fictional upstream inventory mapping`);
    }
    if (!CLASSIFICATIONS.includes(mapping.classification)) {
      errors.push(`${mapping.upstreamTag}: invalid migration classification ${String(mapping.classification)}`);
    }
    if ((mapping.classification === 'exact' || mapping.classification === 'rewritten') &&
        !lyraTags.has(mapping.targetTag)) {
      errors.push(`${mapping.upstreamTag} -> ${mapping.targetTag}: automatic target is not a registered Lyra tag`);
    }
    for (const rewrite of mapping.rewrites?.attributes ?? []) {
      if (isPolarityCheckable(rewrite)) polarityCheckablePairs.push(`${mapping.upstreamTag}: ${rewrite.from} -> ${rewrite.to}`);
      if (hasInvertedPolarity(rewrite.from, rewrite.to)) {
        errors.push(`${mapping.upstreamTag}: ${rewrite.from} -> ${rewrite.to} inverts attribute polarity`);
      }
    }

    // Every event a mirrored upstream tag dispatches has to land on an event the Lyra target
    // actually dispatches. A renamed mirrored event is the quietest possible parity break: the
    // migrated markup parses, the codemod reports success, and the consumer's listener simply
    // never fires again. Silence is the defect, so an event Lyra genuinely does not mirror takes
    // a documented `unaliasedEvents` reason instead of just being absent.
    const surface = upstreamSurfaces.get(mapping.upstreamTag);
    if (surface && mapping.classification !== 'unsupported' && lyraTags.has(mapping.targetTag)) {
      const eventRewrites = new Map(
        (mapping.rewrites?.events ?? []).map((rewrite) => [rewrite.from, rewrite.to]),
      );
      const targetEvents = lyraEvents.get(mapping.targetTag) ?? new Set();
      for (const event of surface.component.surface?.events ?? []) {
        const migrated = migratedEventName(event.name, surface.ecosystem, eventRewrites);
        const key = eventExemptionKey(mapping.upstreamTag, event.name);
        const reason = eventExemptions[key];
        if (typeof reason === 'string') usedEventExemptions.add(key);
        if (targetEvents.has(migrated)) {
          if (typeof reason === 'string') {
            errors.push(
              `${key}: unaliasedEvents exemption is stale -- ${mapping.targetTag} now dispatches ${migrated}`,
            );
          }
          continue;
        }
        if (typeof reason === 'string' && reason.trim()) continue;
        errors.push(
          `${mapping.upstreamTag}: ${event.name} migrates to ${migrated}, which ${mapping.targetTag} does not dispatch; ` +
            'alias the event or document it in upstream-tags.json unaliasedEvents',
        );
      }
    }
  }
  for (const key of Object.keys(eventExemptions)) {
    if (!usedEventExemptions.has(key)) {
      errors.push(`${key}: unaliasedEvents exemption no longer applies to any pinned upstream event`);
    }
  }
  for (const { tag } of expected) {
    if (!mappingByTag.has(tag)) errors.push(`${tag}: no inventory migration classification`);
  }
  if (mappingByTag.size !== expected.length) {
    errors.push(`inventory has ${mappingByTag.size} mapping decision(s), expected ${expected.length}`);
  }

  const { map: readmeRelationships, conflicts } = buildMirrorMap(readme);
  for (const conflict of conflicts) errors.push(`ambiguous README mirror entry -- ${conflict}`);

  // README names stay pinned to real upstream tags. Wildcard names are accepted only when at least
  // one pinned component matches the prefix.
  for (const name of [...namedReadmeUpstream(readme)].sort()) {
    if (name.endsWith('*')) {
      const prefix = name.slice(0, -1);
      if (![...knownUpstream].some((tag) => tag.startsWith(prefix))) {
        errors.push(`${name}: README wildcard matches no pinned upstream tag`);
      }
    } else if (!knownUpstream.has(name)) {
      errors.push(`${name}: named in README but no pinned upstream release ships it`);
    }
  }

  // A README mirror row documents a relationship; it must point at the same candidate recorded in
  // the inventory and at a currently registered tag. Omitted rows need an explicit unsupported
  // reason, preserving the old coverage gate without pretending every relationship is automatic.
  for (const [from, to] of readmeRelationships) {
    const mapping = mappingByTag.get(from);
    if (!mapping) {
      errors.push(`${from}: README relationship has no inventory mapping`);
      continue;
    }
    if (mapping.targetTag !== to) {
      errors.push(`${from}: README relationship targets ${to}, inventory targets ${mapping.targetTag ?? 'nothing'}`);
    }
    if (!lyraTags.has(to)) {
      errors.push(`${from} -> ${to}: README relationship target is not a registered Lyra tag`);
    }
  }
  for (const { tag } of expected) {
    if (readmeRelationships.has(tag)) continue;
    const reason = upstreamTags.noCounterpart?.[tag];
    const mapping = mappingByTag.get(tag);
    if (typeof reason !== 'string' || !reason.trim()) {
      errors.push(`${tag}: no README relationship and no documented unsupported reason`);
    } else if (mapping?.classification !== 'unsupported') {
      errors.push(`${tag}: noCounterpart may exempt only an unsupported inventory mapping`);
    }
  }

  // Preserve the explicit v7-to-v8 attribute-rename safety fixture. These are local migration
  // rewrites rather than upstream mappings, so they remain a separate polarity input.
  for (const rename of upstreamTags.attributeRenames ?? []) {
    if (isPolarityCheckable(rename)) polarityCheckablePairs.push(`${rename.component} ${rename.from} -> ${rename.to}`);
    if (hasInvertedPolarity(rename.from, rename.to)) {
      errors.push(`${rename.component} ${rename.from} -> ${rename.to}: rename inverts attribute polarity`);
    }
  }

  // The two loops above only ever saw the hand-maintained rename lists, which between them
  // contained zero polarity-bearing pairs -- so the gate ran green while being structurally
  // incapable of rejecting anything. This loop gives it real work: every polarity-bearing
  // attribute an upstream tag actually declares is checked against what the mirrored Lyra tag
  // actually declares, so an inversion is caught from the shipped surfaces rather than from a
  // list someone has to remember to update.
  //
  // An inverted rename is the quietest parity break in this library: `light-dismiss` ->
  // `no-light-dismiss` still parses as valid markup, nothing warns, and the component behaves the
  // other way round.
  for (const [upstreamTag, { component }] of upstreamSurfaces) {
    const mapping = mappingByTag.get(upstreamTag);
    if (!mapping || mapping.classification === 'unsupported') continue;
    const lyraAttributes = lyraAttributeNames.get(mapping.targetTag);
    if (!lyraAttributes) continue;
    const rewrites = new Map(
      (mapping.rewrites?.attributes ?? []).map((rewrite) => [rewrite.from, rewrite.to]),
    );
    for (const attribute of component.surface?.attributes ?? []) {
      const from = attribute.name;
      if (!from || polarity(from) === 0) continue;
      const to = rewrites.get(from) ?? from;
      polarityCheckablePairs.push(`${upstreamTag}.${from}`);
      if (hasInvertedPolarity(from, to)) {
        errors.push(`${upstreamTag} -> ${mapping.targetTag}: ${from} -> ${to} inverts attribute polarity`);
        continue;
      }
      // The declared migration target is absent from the Lyra tag while its polarity-inverted
      // twin is present: an undeclared inversion. The codemod rewrites markup to `to`, which
      // matches no attribute, so the consumer silently gets the default while the opposite-meaning
      // attribute sits there unused.
      const opposite = invertedName(to);
      if (!lyraAttributes.has(to) && opposite && lyraAttributes.has(opposite)) {
        errors.push(
          `${upstreamTag} -> ${mapping.targetTag}: upstream '${from}' migrates to '${to}', which ` +
            `${mapping.targetTag} does not declare, while it does declare the inverted '${opposite}'`,
        );
      }
    }
  }

  // The three loops above are this gate's ENTIRE ability to catch an inverted rename -- the exact
  // defect that made it vacuous once already (see isPolarityCheckable's doc comment): they ran
  // over fixtures that held zero polarity-bearing pairs, reported success, and could not have
  // rejected anything. Surfacing the combined count on `summary` (and printing it) is necessary
  // but not sufficient on its own -- a silent read of a JSON field a human never opens is exactly
  // as easy to stop noticing as the pass/fail line already was. So the count is also asserted here,
  // in the same function that already fails closed on every other structural gap: zero examined
  // pairs is itself a defect to report, not a clean run.
  if (polarityCheckablePairs.length === 0) {
    errors.push(
      'attribute-polarity check examined zero pairs across rewrites/attributeRenames/upstream ' +
        'surfaces -- the gate cannot detect a polarity flip this way; see isPolarityCheckable',
    );
  }

  const classificationCounts = Object.fromEntries(
    CLASSIFICATIONS.map((classification) => [
      classification,
      inventoryMappings.filter((mapping) => mapping.classification === classification).length,
    ]),
  );
  const renameAnalysis = renameLedger ? analyzeRenameLedger(renameLedger, inventory, { sharedTokens, exportDeprecations, retiredEventHistory, compatibilityContext }) : null;
  if (renameAnalysis) errors.push(...renameAnalysis.errors);
  if (renameLedger && globalsSurface) errors.push(...analyzeGlobalsSurface(renameLedger, globalsSurface));
  return {
    errors: [...new Set(errors)].sort(),
    summary: {
      ...(renameAnalysis ? { lyraRenames: renameAnalysis.summary } : {}),
      webawesome: expected.filter((entry) => entry.ecosystem === 'webawesome').length,
      shoelace: expected.filter((entry) => entry.ecosystem === 'shoelace').length,
      relationships: readmeRelationships.size,
      classifications: classificationCounts,
      automatic: classificationCounts.exact + classificationCounts.rewritten,
      manual:
        classificationCounts['warning-required'] +
        classificationCounts['conceptual-only'] +
        classificationCounts.unsupported,
      polarityCheckable: polarityCheckablePairs.length,
    },
  };
}

export function formatMigrationCoverageSummary(summary, upstreamTags) {
  return (
    `Migration coverage contract passed: Web Awesome ${summary.webawesome}/${summary.webawesome} ` +
    `(${upstreamTags.webawesome.version}) and Shoelace ${summary.shoelace}/${summary.shoelace} ` +
    `(${upstreamTags.shoelace.version}) tags classified; ${summary.automatic} automatic, ` +
    `${summary.manual} manual, ${summary.relationships} README relationships, ` +
    `${summary.polarityCheckable} polarity-checkable pair(s) examined.` +
    Object.entries(summary.lyraRenames ?? {})
      .map(
        ([origin, counts]) =>
          ` Lyra rename ledger ${origin}: ${counts.renames} rename(s), ${counts.defaults} default(s), ` +
          `${counts.retiredEvents} retired event review(s), ${counts.detailChanges} detail change(s), ${counts.propertyChanges} property change(s), ${counts.reviews} review(s), ${counts.slotContent} slot-content review(s), ${counts.moduleReviews} module review(s)${counts.globals === undefined ? '' : `, ${counts.globals} global(s), ${counts.rules ?? 0} rule(s)`}.`,
      )
      .join('')
  );
}

/** The public surface `globals` entries are checked against, read from the sibling workspace packages. */
function readGlobalsSurface() {
  const readJsonFile = (...segments) => JSON.parse(fs.readFileSync(path.join(...segments), 'utf8'));
  const workspace = path.dirname(packageDir);
  const packages = {};
  for (const directory of fs.readdirSync(workspace)) {
    const manifestPath = path.join(workspace, directory, 'package.json');
    if (!fs.existsSync(manifestPath)) continue;
    const manifest = readJsonFile(manifestPath);
    packages[manifest.name] = manifest.exports ?? {};
  }
  const strings = fs.readFileSync(path.join(packageDir, 'src', 'internal', 'localization.ts'), 'utf8');
  return {
    exports: packages['@aceshooting/lyra-ui'] ?? {},
    packages,
    rootBarrel: fs.readFileSync(path.join(packageDir, 'src', 'lyra.ts'), 'utf8'),
    stringKeys: new Set([...strings.matchAll(/^  ([A-Za-z0-9_$]+):/gm)].map((match) => match[1])),
  };
}

async function run() {
  const readJson = (...segments) =>
    JSON.parse(fs.readFileSync(path.join(packageDir, ...segments), 'utf8'));
  const upstreamTags = readJson('scripts', 'fixtures', 'upstream-tags.json');
  const inventory = readJson('scripts', 'fixtures', 'component-inventory.json');
  const compatibilityContext = await readCurrentCompatibilityContext(packageDir, inventory);
  const result = analyzeMigrationCoverage({
    inventory,
    compatibilityContext,
    upstreamTags,
    lyraManifest: readJson('custom-elements.json'),
    readme: fs.readFileSync(path.join(packageDir, 'README.md'), 'utf8'),
    renameLedger: readRenameLedger(),
    retiredEventHistory: readJson('scripts', 'fixtures', 'retired-event-history.json'),
    exportDeprecations: assembleComponentMetadata(readComponentMetadataSources(packageDir)).exportDeprecations,
    sharedTokens: new Set(Object.keys(readJson('tokens', 'canonical-tokens.json').tokens)),
    globalsSurface: readGlobalsSurface(),
  });

  if (result.errors.length) {
    console.error(`Migration coverage contract failed with ${result.errors.length} finding(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(formatMigrationCoverageSummary(result.summary, upstreamTags));
  return 0;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = await run();
}
