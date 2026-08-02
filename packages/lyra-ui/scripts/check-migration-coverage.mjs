// Gates the migration relationship between pinned Web Awesome/Shoelace catalogs, the component
// inventory, README documentation, and registered Lyra targets. The inventory is authoritative:
// every upstream tag has exactly one exact/rewritten/warning/conceptual/unsupported decision, and
// only the first two classifications are automatic migration inputs. README mirror rows remain
// documentation relationships and must agree with that inventory; they are not a rename allowlist.
//
// Run: node scripts/check-migration-coverage.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMigrationContract, buildMirrorMap } from './migrate-wa.mjs';

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

function manifestTags(manifest) {
  return new Set(
    (manifest.modules ?? [])
      .flatMap((module) => module.declarations ?? [])
      .filter((declaration) => declaration.customElement && declaration.tagName)
      .map((declaration) => declaration.tagName),
  );
}

function polarity(name) {
  return NEGATING.test(name) ? -1 : ASSERTING.test(name) ? 1 : 0;
}

function hasInvertedPolarity(fromName, toName) {
  const from = polarity(fromName);
  const to = polarity(toName);
  return from !== to && (from === -1 || to === -1);
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
export function analyzeMigrationCoverage({ inventory, upstreamTags, lyraManifest, readme }) {
  const errors = [];
  const expected = catalog(upstreamTags);
  const knownUpstream = new Set(expected.map((entry) => entry.tag));
  const lyraTags = manifestTags(lyraManifest);
  const inventoryMappings = Array.isArray(inventory?.mappings) ? inventory.mappings : [];
  const mappingByTag = new Map();

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
      if (hasInvertedPolarity(rewrite.from, rewrite.to)) {
        errors.push(`${mapping.upstreamTag}: ${rewrite.from} -> ${rewrite.to} inverts attribute polarity`);
      }
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
    if (hasInvertedPolarity(rename.from, rename.to)) {
      errors.push(`${rename.component} ${rename.from} -> ${rename.to}: rename inverts attribute polarity`);
    }
  }

  const classificationCounts = Object.fromEntries(
    CLASSIFICATIONS.map((classification) => [
      classification,
      inventoryMappings.filter((mapping) => mapping.classification === classification).length,
    ]),
  );
  return {
    errors: [...new Set(errors)].sort(),
    summary: {
      webawesome: expected.filter((entry) => entry.ecosystem === 'webawesome').length,
      shoelace: expected.filter((entry) => entry.ecosystem === 'shoelace').length,
      relationships: readmeRelationships.size,
      classifications: classificationCounts,
      automatic: classificationCounts.exact + classificationCounts.rewritten,
      manual:
        classificationCounts['warning-required'] +
        classificationCounts['conceptual-only'] +
        classificationCounts.unsupported,
    },
  };
}

export function formatMigrationCoverageSummary(summary, upstreamTags) {
  return (
    `Migration coverage contract passed: Web Awesome ${summary.webawesome}/${summary.webawesome} ` +
    `(${upstreamTags.webawesome.version}) and Shoelace ${summary.shoelace}/${summary.shoelace} ` +
    `(${upstreamTags.shoelace.version}) tags classified; ${summary.automatic} automatic, ` +
    `${summary.manual} manual, ${summary.relationships} README relationships.`
  );
}

function run() {
  const readJson = (...segments) =>
    JSON.parse(fs.readFileSync(path.join(packageDir, ...segments), 'utf8'));
  const upstreamTags = readJson('scripts', 'fixtures', 'upstream-tags.json');
  const result = analyzeMigrationCoverage({
    inventory: readJson('scripts', 'fixtures', 'component-inventory.json'),
    upstreamTags,
    lyraManifest: readJson('custom-elements.json'),
    readme: fs.readFileSync(path.join(packageDir, 'README.md'), 'utf8'),
  });

  if (result.errors.length) {
    console.error(`Migration coverage contract failed with ${result.errors.length} finding(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(formatMigrationCoverageSummary(result.summary, upstreamTags));
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run();
}
