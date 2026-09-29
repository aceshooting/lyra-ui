// Migration contract validation, projection, and adjacent runtime data discovery.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCAL_MIGRATION_ORIGINS,
  compareMappedSurfaces,
  validateAccessibilityContract,
  validateLocalMigrations,
  validateMappingNormalizations,
  validateMethodEdgeParity,
} from './component-inventory.mjs';
import {
  LYRA_RENAME_ORIGINS,
  createRenameProfiles,
  emptyRenameProjection,
  projectRenameLedger,
  validateRenameLedgerShape,
} from './lyra-rename-ledger.mjs';


const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const packagedInventoryPath = path.join(scriptDir, 'migration-contract.json');
export const packagedRuntime = fs.existsSync(packagedInventoryPath);
export const inventoryPath = packagedRuntime
  ? packagedInventoryPath
  : path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');
const renameLedgerPath = path.join(packageDir, 'scripts', 'fixtures', 'lyra-renames.json');
export const MIGRATION_RUNTIME_SCHEMA_VERSION = 3;

/** Every accepted `--origin` value: the opt-in Lyra defaults profiles plus the rename profiles. */
export const MIGRATION_ORIGINS = Object.freeze([...LOCAL_MIGRATION_ORIGINS, ...LYRA_RENAME_ORIGINS]);
export const AUTO_CLASSIFICATIONS = new Set(['exact', 'rewritten']);
const CLASSIFICATIONS = new Set([
  'exact',
  'rewritten',
  'warning-required',
  'conceptual-only',
  'unsupported',
]);
const MEMBER_RULE_SECTIONS = [
  'attributes',
  'properties',
  'events',
  'slots',
  'parts',
  'cssProperties',
  'methods',
];
const REWRITE_RULE_SECTIONS = [...MEMBER_RULE_SECTIONS, 'defaults'];
const ECOSYSTEMS = ['webawesome', 'shoelace'];
const PACKAGE_TIERS = new Set(['free', 'pro']);
const STATIC_API_STATUSES = new Set(['reviewed', 'tag-only', 'unreviewed']);
const LIGHT_DOM_STATUSES = new Set(['not-applicable', 'surface-only', 'warning-required', 'unreviewed']);
const REGISTRATION_STATUSES = new Set(['all', 'granular', 'unavailable']);
const CONDITIONAL_BEHAVIOR_REVIEW_TAGS = new Set(['wa-random-content']);

export function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid component inventory migration contract: ${message}`);
}

function surfaceNames(component, section) {
  return new Set((component?.surface?.[section] ?? []).map((entry) => entry.name));
}

function isScalar(value) {
  return value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value));
}

function validateMemberRules(mapping, source, target, section) {
  const rules = mapping.rewrites[section];
  invariant(Array.isArray(rules), `${mapping.upstreamTag}: rewrites.${section} must be an array`);
  const sourceNames = surfaceNames(source, section);
  const targetNames = surfaceNames(target, section);
  const seen = new Set();
  for (const rule of rules) {
    invariant(
      rule && typeof rule.from === 'string' && rule.from && typeof rule.to === 'string' && rule.to,
      `${mapping.upstreamTag}: every rewrites.${section} rule needs non-empty from/to`,
    );
    const unknownKeys = Object.keys(rule).filter((key) => key !== 'from' && key !== 'to');
    invariant(
      unknownKeys.length === 0,
      `${mapping.upstreamTag}: rewrites.${section} rule has unknown key(s) ${unknownKeys.join(', ')}`,
    );
    invariant(rule.from !== rule.to, `${mapping.upstreamTag}: rewrites.${section} cannot map a member to itself`);
    invariant(!seen.has(rule.from), `${mapping.upstreamTag}: duplicate rewrites.${section} source ${rule.from}`);
    seen.add(rule.from);
    invariant(sourceNames.has(rule.from), `${mapping.upstreamTag}: unknown ${section} source ${rule.from}`);
    invariant(targetNames.has(rule.to), `${mapping.upstreamTag}: unknown target ${section} member ${rule.to}`);
  }
}

function validateDefaultRules(mapping, source, target) {
  const rules = mapping.rewrites.defaults;
  invariant(Array.isArray(rules), `${mapping.upstreamTag}: rewrites.defaults must be an array`);
  const seen = new Set();
  for (const rule of rules) {
    invariant(
      rule?.memberKind === 'attribute' || rule?.memberKind === 'property',
      `${mapping.upstreamTag}: default memberKind must be attribute or property`,
    );
    invariant(typeof rule.member === 'string' && rule.member, `${mapping.upstreamTag}: default rule needs member`);
    invariant(
      rule.action === 'insert-if-absent' || rule.action === 'replace-value',
      `${mapping.upstreamTag}: unsupported default action ${String(rule.action)}`,
    );
    const allowedKeys = rule.action === 'insert-if-absent'
      ? new Set(['memberKind', 'member', 'action', 'value'])
      : new Set(['memberKind', 'member', 'action', 'from', 'to']);
    const unknownKeys = Object.keys(rule).filter((key) => !allowedKeys.has(key));
    invariant(
      unknownKeys.length === 0,
      `${mapping.upstreamTag}: default rule has unknown key(s) ${unknownKeys.join(', ')}`,
    );
    const key = `${rule.memberKind}:${rule.member}:${rule.action}`;
    invariant(!seen.has(key), `${mapping.upstreamTag}: duplicate default rule ${key}`);
    seen.add(key);
    const section = rule.memberKind === 'attribute' ? 'attributes' : 'properties';
    invariant(surfaceNames(target, section).has(rule.member), `${mapping.upstreamTag}: unknown target ${key}`);
    if (rule.action === 'insert-if-absent') {
      invariant(
        rule.memberKind === 'attribute',
        `${mapping.upstreamTag}: insert-if-absent is only deterministic for attributes`,
      );
      invariant(Object.hasOwn(rule, 'value'), `${mapping.upstreamTag}: ${key} needs value`);
      invariant(isScalar(rule.value), `${mapping.upstreamTag}: ${key} value must be a scalar`);
      invariant(!Object.hasOwn(rule, 'from') && !Object.hasOwn(rule, 'to'), `${mapping.upstreamTag}: ${key} cannot use from/to`);
    } else {
      invariant(surfaceNames(source, section).has(rule.member), `${mapping.upstreamTag}: unknown source ${key}`);
      invariant(Object.hasOwn(rule, 'from') && Object.hasOwn(rule, 'to'), `${mapping.upstreamTag}: ${key} needs from/to`);
      invariant(isScalar(rule.from) && isScalar(rule.to), `${mapping.upstreamTag}: ${key} from/to must be scalars`);
      invariant(rule.from !== rule.to, `${mapping.upstreamTag}: ${key} cannot replace a value with itself`);
      invariant(!Object.hasOwn(rule, 'value'), `${mapping.upstreamTag}: ${key} cannot use value`);
    }
  }
}

function driftCovered(mapping, finding) {
  const codeToSection = {
    'missing-attribute': 'attributes',
    'polarity-mismatch': 'attributes',
    'missing-property': 'properties',
    'missing-event': 'events',
    'missing-slot': 'slots',
    'missing-part': 'parts',
    'missing-css-property': 'cssProperties',
    'missing-method': 'methods',
  };
  if (finding.code === 'default-mismatch') {
    return mapping.rewrites.defaults.some((rule) => rule.member === finding.member);
  }
  const section = codeToSection[finding.code];
  return Boolean(section && mapping.rewrites[section].some((rule) => rule.from === finding.member));
}

function runtimeMemberSurfaces(mapping, section) {
  const rules = Array.isArray(mapping.rewrites?.[section]) ? mapping.rewrites[section] : [];
  return {
    source: { surface: { [section]: rules.map((rule) => ({ name: rule?.from })) } },
    target: { surface: { [section]: rules.map((rule) => ({ name: rule?.to })) } },
  };
}

function runtimeDefaultSurfaces(mapping) {
  const source = { surface: { attributes: [], properties: [] } };
  const target = { surface: { attributes: [], properties: [] } };
  const rules = Array.isArray(mapping.rewrites?.defaults) ? mapping.rewrites.defaults : [];
  for (const rule of rules) {
    const section = rule?.memberKind === 'attribute' ? 'attributes' : 'properties';
    target.surface[section].push({ name: rule?.member });
    if (rule?.action === 'replace-value') source.surface[section].push({ name: rule?.member });
  }
  return { source, target };
}

/**
 * Validates an inventory (the repository inventory or the packaged runtime projection) into the
 * lookup structure every migration mode reads. `renameLedger` supplies the authored
 * Lyra-to-Lyra rename ledger for a repository inventory; a packaged runtime inventory carries its
 * own validated projection instead. Omitting it yields rename profiles with no entries.
 * `lyraVersion`, the installed @aceshooting/lyra-ui version when known, withholds rename-profile
 * entries that start in a later release.
 */
export function buildMigrationContract(inventory, { renameLedger = null, exportDeprecations = [], lyraVersion = null, compatibilityContext = null } = {}) {
  invariant(inventory?.schemaVersion === 1, 'schemaVersion must be 1');
  const runtimeInventory = Object.hasOwn(inventory, 'migrationRuntimeSchemaVersion');
  if (runtimeInventory) {
    invariant(
      inventory.migrationRuntimeSchemaVersion === MIGRATION_RUNTIME_SCHEMA_VERSION,
      `migrationRuntimeSchemaVersion must be ${MIGRATION_RUNTIME_SCHEMA_VERSION}`,
    );
    invariant(renameLedger === null, 'a packaged runtime inventory carries its own rename projection');
    const renameFindings = validateRenameLedgerShape(inventory.lyraRenames, { projected: true });
    invariant(renameFindings.length === 0, renameFindings.join('; '));
  }
  // Without a ledger there is nothing to cross-check, so the profiles are simply empty; the
  // repository CLI, the build and check-migration-coverage.mjs always pass the authored ledger.
  // Ledger completeness (every scheduled removal has an entry) is a lint concern and is not
  // re-checked here, so an incomplete ledger never stops a build or a Web Awesome migration.
  const renameProfiles = createRenameProfiles(
    runtimeInventory
      ? inventory.lyraRenames
      : renameLedger
        ? projectRenameLedger(renameLedger, inventory, { exportDeprecations, compatibilityContext })
        : emptyRenameProjection(),
    { lyraVersion },
  );
  invariant(Array.isArray(inventory.components), 'components must be an array');
  invariant(Array.isArray(inventory.mappings), 'mappings must be an array');
  invariant(inventory.upstreams && typeof inventory.upstreams === 'object', 'upstreams must be an object');
  const accessibilityFindings = validateAccessibilityContract(
    inventory.accessibilityProfiles,
    inventory.mappings,
  );
  invariant(accessibilityFindings.length === 0, accessibilityFindings.join('; '));

  const components = new Map();
  for (const component of inventory.components) {
    invariant(typeof component.tag === 'string' && component.tag, 'every Lyra component needs a tag');
    invariant(!components.has(component.tag), `duplicate Lyra component ${component.tag}`);
    invariant(
      typeof component.registrationModule === 'string' && component.registrationModule.endsWith('.ts'),
      `${component.tag}: registrationModule must end in .ts`,
    );
    if (Object.hasOwn(component, 'rootIncluded')) {
      invariant(typeof component.rootIncluded === 'boolean', `${component.tag}: rootIncluded must be boolean`);
    }
    if (Object.hasOwn(component, 'optionalPeers')) {
      invariant(Array.isArray(component.optionalPeers), `${component.tag}: optionalPeers must be an array`);
      invariant(
        component.optionalPeers.every((peer) => typeof peer === 'string' && peer),
        `${component.tag}: optionalPeers entries must be non-empty package names`,
      );
    }
    components.set(component.tag, component);
  }

  const localMigrationFindings = validateLocalMigrations(inventory);
  invariant(localMigrationFindings.length === 0, localMigrationFindings.join('; '));
  const localMigrations = new Map(LOCAL_MIGRATION_ORIGINS.map((origin) => [origin, new Map()]));
  for (const profile of inventory.localMigrations) {
    localMigrations.get(profile.origin).set(profile.tag, profile);
  }

  const upstreamComponents = new Map();
  const packageIdentities = new Map();
  const packagesByEcosystem = new Map(ECOSYSTEMS.map((ecosystem) => [ecosystem, []]));
  let extendedPackageSchema = false;
  for (const ecosystem of ECOSYSTEMS) {
    const upstream = inventory.upstreams[ecosystem];
    const entries = upstream?.components;
    invariant(Array.isArray(entries), `${ecosystem}: upstream components must be an array`);
    const identities = Array.isArray(upstream?.packages)
      ? upstream.packages
      : typeof upstream?.package === 'string' && upstream.package
        ? [{ name: upstream.package, tiers: ['free', 'pro'] }]
        : [];
    if (Array.isArray(upstream?.packages)) extendedPackageSchema = true;
    invariant(identities.length > 0, `${ecosystem}: packages must contain at least one identity`);
    for (const identity of identities) {
      invariant(
        identity && typeof identity.name === 'string' && identity.name,
        `${ecosystem}: package identity needs a non-empty name`,
      );
      invariant(!packageIdentities.has(identity.name), `duplicate package identity ${identity.name}`);
      invariant(
        Array.isArray(identity.tiers) && identity.tiers.length > 0,
        `${identity.name}: tiers must be a non-empty array`,
      );
      invariant(
        identity.tiers.every((tier) => PACKAGE_TIERS.has(tier)),
        `${identity.name}: tiers contain an unsupported value`,
      );
      invariant(new Set(identity.tiers).size === identity.tiers.length, `${identity.name}: tiers contain duplicates`);
      const normalized = { ecosystem, tiers: new Set(identity.tiers) };
      packageIdentities.set(identity.name, normalized);
      packagesByEcosystem.get(ecosystem).push({ name: identity.name, tiers: normalized.tiers });
    }
    for (const component of entries) {
      invariant(!upstreamComponents.has(component.tag), `duplicate upstream component ${component.tag}`);
      if (Object.hasOwn(component, 'tier')) {
        invariant(PACKAGE_TIERS.has(component.tier), `${component.tag}: unsupported package tier`);
        invariant(
          packagesByEcosystem.get(ecosystem).some((identity) => identity.tiers.has(component.tier)),
          `${component.tag}: no ${ecosystem} package identity provides tier ${component.tier}`,
        );
      }
      upstreamComponents.set(component.tag, { ecosystem, component });
    }
  }

  const mappings = new Map();
  for (const mapping of inventory.mappings) {
    invariant(typeof mapping.upstreamTag === 'string' && mapping.upstreamTag, 'every mapping needs upstreamTag');
    invariant(!mappings.has(mapping.upstreamTag), `duplicate mapping ${mapping.upstreamTag}`);
    invariant(CLASSIFICATIONS.has(mapping.classification), `${mapping.upstreamTag}: invalid classification`);
    invariant(
      mapping.upstream === 'webawesome' || mapping.upstream === 'shoelace',
      `${mapping.upstreamTag}: invalid upstream`,
    );
    const upstreamEntry = upstreamComponents.get(mapping.upstreamTag);
    invariant(upstreamEntry?.ecosystem === mapping.upstream, `${mapping.upstreamTag}: missing upstream surface`);
    const target = components.get(mapping.targetTag);
    if (AUTO_CLASSIFICATIONS.has(mapping.classification)) {
      invariant(target, `${mapping.upstreamTag}: automatic mapping needs a registered target`);
    }
    invariant(mapping.rewrites && typeof mapping.rewrites === 'object', `${mapping.upstreamTag}: rewrites missing`);
    const unknownRewriteKeys = Object.keys(mapping.rewrites).filter(
      (key) => !REWRITE_RULE_SECTIONS.includes(key),
    );
    invariant(
      unknownRewriteKeys.length === 0,
      `${mapping.upstreamTag}: unknown rewrite section(s) ${unknownRewriteKeys.join(', ')}`,
    );
    for (const section of MEMBER_RULE_SECTIONS) {
      if (runtimeInventory) {
        const surfaces = runtimeMemberSurfaces(mapping, section);
        validateMemberRules(mapping, surfaces.source, surfaces.target, section);
      } else {
        validateMemberRules(mapping, upstreamEntry.component, target, section);
      }
    }
    if (runtimeInventory) {
      const surfaces = runtimeDefaultSurfaces(mapping);
      validateDefaultRules(mapping, surfaces.source, surfaces.target);
      invariant(
        !Object.hasOwn(mapping, 'normalizations') && !Object.hasOwn(mapping, 'drift'),
        `${mapping.upstreamTag}: packaged runtime mappings cannot carry analyzer-only data`,
      );
    } else {
      validateDefaultRules(mapping, upstreamEntry.component, target);
      const normalizationFindings = validateMappingNormalizations(mapping, {
        upstream: upstreamEntry.component.surface,
        target: target?.surface,
      });
      invariant(normalizationFindings.length === 0, normalizationFindings.join('; '));
      invariant(Array.isArray(mapping.drift), `${mapping.upstreamTag}: drift must be an array`);
    }
    if (extendedPackageSchema) {
      const parity = mapping.parity;
      invariant(parity && typeof parity === 'object' && !Array.isArray(parity), `${mapping.upstreamTag}: parity missing`);
      const parityKeys = Object.keys(parity).filter(
        (key) => !['staticApi', 'lightDom', 'runtime', 'behaviorReviewFlags', 'accessibility', 'methodEdges'].includes(key),
      );
      invariant(parityKeys.length === 0, `${mapping.upstreamTag}: parity has unknown key(s) ${parityKeys.join(', ')}`);
      invariant(STATIC_API_STATUSES.has(parity.staticApi), `${mapping.upstreamTag}: invalid parity.staticApi`);
      invariant(LIGHT_DOM_STATUSES.has(parity.lightDom), `${mapping.upstreamTag}: invalid parity.lightDom`);
      invariant(
        Array.isArray(parity.behaviorReviewFlags) &&
          parity.behaviorReviewFlags.every((flag) => typeof flag === 'string' && flag) &&
          new Set(parity.behaviorReviewFlags).size === parity.behaviorReviewFlags.length,
        `${mapping.upstreamTag}: parity.behaviorReviewFlags must contain unique non-empty strings`,
      );
      invariant(
        parity.runtime && typeof parity.runtime === 'object' && !Array.isArray(parity.runtime),
        `${mapping.upstreamTag}: parity.runtime missing`,
      );
      invariant(
        Object.keys(parity.runtime).every((key) => key === 'registration' || key === 'optionalPeers'),
        `${mapping.upstreamTag}: parity.runtime has unknown keys`,
      );
      invariant(
        REGISTRATION_STATUSES.has(parity.runtime.registration),
        `${mapping.upstreamTag}: invalid parity.runtime.registration`,
      );
      invariant(Array.isArray(parity.runtime.optionalPeers), `${mapping.upstreamTag}: parity.runtime.optionalPeers must be an array`);
      const expectedRegistration = !target ? 'unavailable' : target.rootIncluded === false ? 'granular' : 'all';
      invariant(
        parity.runtime.registration === expectedRegistration,
        `${mapping.upstreamTag}: parity runtime registration is stale`,
      );
      const expectedPeers = [...(target?.optionalPeers ?? [])].sort();
      invariant(
        JSON.stringify([...parity.runtime.optionalPeers].sort()) === JSON.stringify(expectedPeers),
        `${mapping.upstreamTag}: parity runtime optional peers are stale`,
      );
      const methodEdgeFindings = validateMethodEdgeParity(
        mapping,
        runtimeInventory
          ? {}
          : {
              upstream: upstreamEntry.component.surface,
              target: target?.surface,
            },
      );
      invariant(methodEdgeFindings.length === 0, methodEdgeFindings.join('; '));
      if (AUTO_CLASSIFICATIONS.has(mapping.classification)) {
        const hasConditionalReview = parity.behaviorReviewFlags.length > 0;
        if (hasConditionalReview) {
          invariant(
            mapping.classification === 'rewritten' &&
              CONDITIONAL_BEHAVIOR_REVIEW_TAGS.has(mapping.upstreamTag) &&
              parity.lightDom === 'warning-required',
            `${mapping.upstreamTag}: automatic behavior review lacks a registered conditional scanner`,
          );
        } else {
          invariant(
            parity.lightDom !== 'warning-required' && parity.lightDom !== 'unreviewed',
            `${mapping.upstreamTag}: automatic mapping cannot require unscoped light-DOM review`,
          );
        }
      }
    }
    if (!runtimeInventory && target && upstreamEntry.component.review?.status === 'complete') {
      const expectedDrift = compareMappedSurfaces(upstreamEntry.component.surface, target.surface, {
        upstreamPrefix: mapping.upstream === 'webawesome' ? 'wa-' : 'sl-',
        rewrites: mapping.rewrites,
        normalizations: mapping.normalizations,
      });
      invariant(
        JSON.stringify(mapping.drift) === JSON.stringify(expectedDrift),
        `${mapping.upstreamTag}: stored surface drift is stale`,
      );
    }
    if (mapping.classification === 'exact') {
      if (!runtimeInventory) {
        invariant(mapping.drift.length === 0, `${mapping.upstreamTag}: exact mapping has surface drift`);
      }
      invariant(
        REWRITE_RULE_SECTIONS.every((section) => mapping.rewrites[section].length === 0),
        `${mapping.upstreamTag}: exact mapping cannot declare rewrite rules`,
      );
    }
    if (mapping.classification === 'rewritten') {
      invariant(
        REWRITE_RULE_SECTIONS.some((section) => mapping.rewrites[section].length > 0),
        `${mapping.upstreamTag}: rewritten mapping needs at least one deterministic rule`,
      );
      if (!runtimeInventory) {
        invariant(
          mapping.drift.every((finding) => driftCovered(mapping, finding)),
          `${mapping.upstreamTag}: rewritten mapping contains drift without a deterministic rule`,
        );
      }
    }

    mappings.set(mapping.upstreamTag, {
      ...mapping,
      drift: mapping.drift ?? [],
      source: upstreamEntry.component,
      target,
    });
  }

  invariant(mappings.size === upstreamComponents.size, 'every upstream tag must have exactly one mapping');
  for (const tag of upstreamComponents.keys()) invariant(mappings.has(tag), `${tag}: missing mapping`);
  return {
    inventory,
    components,
    mappings,
    upstreamComponents,
    localMigrations,
    renameProfiles,
    packageIdentities,
    packagesByEcosystem,
  };
}

/**
 * Produces the validated, migration-only data shipped beside the public CLI. Static analyzer
 * surfaces stay in the repository inventory; the package contains only registration metadata,
 * deterministic rewrite rules, parity/runtime requirements, the opt-in local defaults, and the
 * projected Lyra rename ledger. The ledger is a required argument so a build can never silently
 * publish a CLI whose rename profiles are empty.
 */
export function createMigrationRuntimeInventory(inventory, { renameLedger, exportDeprecations = [], compatibilityContext = null } = {}) {
  invariant(
    !Object.hasOwn(inventory ?? {}, 'migrationRuntimeSchemaVersion'),
    'cannot project an already-packaged migration runtime inventory',
  );
  invariant(renameLedger && typeof renameLedger === 'object', 'createMigrationRuntimeInventory needs the rename ledger');
  buildMigrationContract(inventory, { renameLedger, exportDeprecations, compatibilityContext });

  const targetTags = new Set(inventory.mappings.map((mapping) => mapping.targetTag).filter(Boolean));
  const localAttributes = new Map();
  for (const profile of inventory.localMigrations) {
    targetTags.add(profile.tag);
    const names = localAttributes.get(profile.tag) ?? new Set();
    for (const rule of profile.defaults) names.add(rule.member);
    localAttributes.set(profile.tag, names);
  }

  return {
    schemaVersion: 1,
    migrationRuntimeSchemaVersion: MIGRATION_RUNTIME_SCHEMA_VERSION,
    accessibilityProfiles: structuredClone(inventory.accessibilityProfiles),
    components: inventory.components
      .filter((component) => targetTags.has(component.tag))
      .map((component) => ({
        tag: component.tag,
        registrationModule: component.registrationModule,
        rootIncluded: component.rootIncluded,
        optionalPeers: structuredClone(component.optionalPeers ?? []),
        surface: {
          attributes: (component.surface?.attributes ?? [])
            .filter((attribute) => localAttributes.get(component.tag)?.has(attribute.name))
            .map((attribute) => ({ name: attribute.name, type: attribute.type })),
        },
      })),
    localMigrations: structuredClone(inventory.localMigrations),
    upstreams: Object.fromEntries(
      ECOSYSTEMS.map((ecosystem) => {
        const upstream = inventory.upstreams[ecosystem];
        return [
          ecosystem,
          {
            packages: structuredClone(upstream.packages),
            components: upstream.components.map((component) => ({
              tag: component.tag,
              tier: component.tier,
            })),
          },
        ];
      }),
    ),
    mappings: inventory.mappings.map((mapping) => ({
      upstream: mapping.upstream,
      upstreamTag: mapping.upstreamTag,
      targetTag: mapping.targetTag,
      classification: mapping.classification,
      rationale: mapping.rationale,
      parity: structuredClone(mapping.parity),
      rewrites: structuredClone(mapping.rewrites),
    })),
    lyraRenames: projectRenameLedger(renameLedger, inventory, { exportDeprecations, compatibilityContext }),
  };
}

/** Reads the authored rename ledger from a repository checkout. */
export function readRenameLedger(file = renameLedgerPath) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Canonical module deprecations stay in source; only their validated reviews are packaged. */
export function readExportDeprecations(file = path.join(packageDir, 'scripts', 'fixtures', 'component-metadata.json')) {
  const records = JSON.parse(fs.readFileSync(file, 'utf8')).exportDeprecations;
  invariant(Array.isArray(records), 'component metadata must contain exportDeprecations');
  return records;
}

// README mirror-table parsing is retained for documentation drift checks and inventory generation.
// Migration itself never consults this map.
export function buildMirrorMap(readmeText) {
  const map = new Map();
  const conflicts = [];
  let mode = null;

  const setMapping = (from, to) => {
    if (map.has(from) && map.get(from) !== to) {
      conflicts.push(`${from}: already mapped to ${map.get(from)}, also saw ${to}`);
    } else {
      map.set(from, to);
    }
  };

  for (const rawLine of readmeText.split('\n')) {
    const line = rawLine.trim();
    if (/^\|\s*Component\s*\|\s*Mirrors\s*\|\s*Notes\s*\|$/.test(line)) {
      mode = 'wa';
      continue;
    }
    if (/^\|\s*Shoelace\s*\|\s*Lyra\s*\|\s*Migration note\s*\|$/.test(line)) {
      mode = 'sl';
      continue;
    }
    if (!line.startsWith('|')) {
      mode = null;
      continue;
    }
    if (!mode) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 2) continue;

    if (mode === 'sl') {
      const source = [...cells[0].matchAll(/<sl-([a-z0-9-]+)>/g)].map((match) => match[1]);
      const targets = new Set([...cells[1].matchAll(/<lr-([a-z0-9-]+)>/g)].map((match) => match[1]));
      for (const suffix of source) if (targets.has(suffix)) setMapping(`sl-${suffix}`, `lr-${suffix}`);
      continue;
    }

    const targets = [...cells[0].matchAll(/<lr-([a-z0-9-]+)>/g)].map((match) => match[1]);
    const sources = [...cells[1].matchAll(/`((?:wa|sl)-[a-z0-9-]+\*?)`/g)].map((match) => match[1]);
    if (!targets.length || !sources.length) continue;
    const consumed = new Set();
    for (const suffix of targets) {
      for (const prefix of ['wa', 'sl']) {
        const expected = `${prefix}-${suffix}`;
        if (sources.includes(expected)) {
          setMapping(expected, `lr-${suffix}`);
          consumed.add(expected);
        } else {
          const wildcard = sources.find((source) => source.endsWith('*') && expected.startsWith(source.slice(0, -1)));
          if (wildcard) {
            setMapping(expected, `lr-${suffix}`);
            consumed.add(wildcard);
          }
        }
      }
    }
    if (targets.length === 1) {
      for (const source of sources) {
        if (!consumed.has(source) && !source.endsWith('*')) setMapping(source, `lr-${targets[0]}`);
      }
    }
  }
  return { map, conflicts };
}
