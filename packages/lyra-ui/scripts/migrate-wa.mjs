#!/usr/bin/env node

// Contract-aware Web Awesome / Shoelace migration. Automatic edits come only from the checked-in
// component inventory: exact mappings receive prefix/import edits, rewritten mappings additionally
// receive their declared member/default rules and any scoped behavior-review diagnostics, and every
// other mapping remains unchanged with a location-aware warning. The README parser remains exported
// for the independent documentation coverage gate; it is not an input to migration decisions.

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
  compareVersions,
  createRenameProfiles,
  emptyRenameProjection,
  projectRenameLedger,
  validateRenameLedgerShape,
} from './lyra-rename-ledger.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const packagedInventoryPath = path.join(scriptDir, 'migration-contract.json');
const packagedRuntime = fs.existsSync(packagedInventoryPath);
const inventoryPath = packagedRuntime
  ? packagedInventoryPath
  : path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');
const renameLedgerPath = path.join(packageDir, 'scripts', 'fixtures', 'lyra-renames.json');

export const MIGRATION_REPORT_SCHEMA_VERSION = 1;
export const MIGRATION_RUNTIME_SCHEMA_VERSION = 2;

/** Every accepted `--origin` value: the opt-in Lyra defaults profiles plus the rename profiles. */
export const MIGRATION_ORIGINS = Object.freeze([...LOCAL_MIGRATION_ORIGINS, ...LYRA_RENAME_ORIGINS]);

const DEFAULT_EXTENSIONS = new Set([
  'html',
  'htm',
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'css',
  'vue',
  'svelte',
  'mdx',
  'md',
]);
const IGNORE_DIR_NAMES = new Set(['node_modules', 'dist', 'build', 'coverage', '.turbo', '.cache']);
const AUTO_CLASSIFICATIONS = new Set(['exact', 'rewritten']);
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

/**
 * Tags whose migrated Lyra target intentionally diverges from upstream at the *runtime default*
 * level in a way no static surface/member diff can see: `<lr-animation>`/`<lr-animated-image>`
 * respect prefers-reduced-motion by default and therefore freeze/snap their animation whenever
 * the OS/browser reports `prefers-reduced-motion: reduce`, while the mirrored upstream component
 * does not add that behavior. The divergence applies to every migrated instance unconditionally
 * (it does not depend on the markup's attributes the way `wa-random-content`'s multi-flag review
 * does), so this is a flat tag set rather than a contextual scanner, and it is intentionally kept
 * independent of `CONDITIONAL_BEHAVIOR_REVIEW_TAGS`/the inventory's `parity.behaviorReviewFlags`
 * gate -- see `reducedMotionReviewMessage()`.
 */
const REDUCED_MOTION_REVIEW_TAGS = new Set([
  'wa-animation',
  'sl-animation',
  'wa-animated-image',
  'sl-animated-image',
]);

const ICON_VOCABULARY_REVIEW_TAGS = new Set([
  'wa-icon',
  'sl-icon',
  'sl-icon-button',
]);

function reducedMotionReviewMessage(upstreamTag) {
  return (
    `${upstreamTag} does not freeze or snap its animation under prefers-reduced-motion: reduce. ` +
    'The migrated Lyra target respects prefers-reduced-motion by default and does exactly that ' +
    'automatically. Review whether the migrated element should keep animating for users who asked ' +
    'for less motion, or set ignore-reduced-motion to preserve upstream playback under ' +
    'that preference.'
  );
}

function iconVocabularyReviewMessage(upstreamTag) {
  return (
    `${upstreamTag}'s icon-name vocabulary is not bundled with Lyra. The default library includes ` +
    'only add, check, close, search, menu, chevron-left, chevron-right, chevron-down, calendar, ' +
    'command, and trash; any other migrated name renders no glyph. Register the required ' +
    `vocabulary with registerIconLibrary('default', { resolver }) or replace each name explicitly.`
  );
}

function invariant(condition, message) {
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
export function buildMigrationContract(inventory, { renameLedger = null, lyraVersion = null } = {}) {
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
        ? projectRenameLedger(renameLedger, inventory)
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
export function createMigrationRuntimeInventory(inventory, { renameLedger } = {}) {
  invariant(
    !Object.hasOwn(inventory ?? {}, 'migrationRuntimeSchemaVersion'),
    'cannot project an already-packaged migration runtime inventory',
  );
  invariant(renameLedger && typeof renameLedger === 'object', 'createMigrationRuntimeInventory needs the rename ledger');
  buildMigrationContract(inventory, { renameLedger });

  const targetTags = new Set(inventory.mappings.map((mapping) => mapping.targetTag).filter(Boolean));
  for (const profile of inventory.localMigrations) targetTags.add(profile.tag);

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
          attributes: structuredClone(component.surface?.attributes ?? []),
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
    lyraRenames: projectRenameLedger(renameLedger, inventory),
  };
}

/** Reads the authored rename ledger from a repository checkout. */
export function readRenameLedger(file = renameLedgerPath) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
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

function warningCode(mapping) {
  if (!mapping) return 'UNKNOWN_UPSTREAM_TAG';
  if (mapping.classification === 'warning-required') return 'WARNING_REQUIRED';
  if (mapping.classification === 'conceptual-only') return 'CONCEPTUAL_MAPPING';
  return 'UNSUPPORTED_MAPPING';
}

function ecosystemForTag(tag) {
  return tag.startsWith('wa-') ? 'webawesome' : 'shoelace';
}

function lineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) if (text[index] === '\n') starts.push(index + 1);
  return starts;
}

function locationAt(starts, offset) {
  let low = 0;
  let high = starts.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] <= offset) low = middle;
    else high = middle;
  }
  return { line: low + 1, column: offset - starts[low] + 1 };
}

function reportEntry({
  textStarts,
  file,
  offset,
  origin,
  upstreamTag,
  upstreamMember = null,
  action,
  target = null,
  warningCode: code = null,
  behaviorReviewFlags = null,
  message,
}) {
  const location = locationAt(textStarts, offset);
  const entry = {
    file,
    line: location.line,
    column: location.column,
    origin,
    upstreamTag,
    upstreamMember,
    action,
    target,
    warningCode: code,
    message,
  };
  if (behaviorReviewFlags?.length) {
    entry.behaviorReviewFlags = Object.freeze([...behaviorReviewFlags]);
  }
  return entry;
}

function commentRanges(text) {
  const ranges = [];
  let index = 0;
  while (index < text.length) {
    if (text.startsWith('<!--', index)) {
      const end = text.indexOf('-->', index + 4);
      const finish = end < 0 ? text.length : end + 3;
      ranges.push([index, finish]);
      index = finish;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      const finish = end < 0 ? text.length : end + 2;
      ranges.push([index, finish]);
      index = finish;
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      const finish = end < 0 ? text.length : end;
      ranges.push([index, finish]);
      index = finish;
      continue;
    }
    if (text[index] === '"' || text[index] === "'" || text[index] === '`') {
      const quote = text[index++];
      while (index < text.length) {
        if (text[index] === '\\') index += 2;
        else if (text[index] === quote) {
          index += 1;
          break;
        } else index += 1;
      }
      continue;
    }
    index += 1;
  }
  return ranges;
}

function insideRanges(offset, ranges) {
  return ranges.some(([start, end]) => offset >= start && offset < end);
}

function quotedRangeContaining(text, offset) {
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character !== '"' && character !== "'" && character !== '`') {
      index += 1;
      continue;
    }
    const start = index;
    const quote = character;
    index += 1;
    while (index < text.length) {
      if (text[index] === '\\') index += 2;
      else if (text[index] === quote) {
        index += 1;
        break;
      } else index += 1;
    }
    if (offset >= start && offset < index) return [start, index];
  }
  return null;
}

function htmlTemplateStyleRanges(text) {
  const ranges = [];
  for (const match of text.matchAll(/<style(?:\s[^>]*)?>(?<body>[\s\S]*?)<\/style\s*>/gi)) {
    const quoted = quotedRangeContaining(text, match.index);
    if (!quoted || text[quoted[0]] !== '`') continue;
    if (!/\bhtml\s*$/.test(text.slice(0, quoted[0]))) continue;
    if (insideTemplateExpression(text, quoted[0], match.index)) continue;
    const bodyStart = match.index + match[0].indexOf(match.groups.body);
    ranges.push([bodyStart, bodyStart + match.groups.body.length]);
  }
  return ranges;
}

function insideTemplateExpression(text, templateStart, offset) {
  let expressionDepth = 0;
  for (let index = templateStart + 1; index < offset; index += 1) {
    if (text[index] === '\\') {
      index += 1;
      continue;
    }
    if (expressionDepth === 0) {
      if (text.startsWith('${', index)) {
        expressionDepth = 1;
        index += 1;
      } else if (text[index] === '`') {
        return false;
      }
      continue;
    }
    if (text[index] === '"' || text[index] === "'") {
      const quote = text[index];
      index += 1;
      while (index < offset && text[index] !== quote) {
        if (text[index] === '\\') index += 1;
        index += 1;
      }
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      index = end < 0 || end >= offset ? offset : end;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 || end >= offset ? offset : end + 1;
      continue;
    }
    if (text[index] === '{') expressionDepth += 1;
    else if (text[index] === '}') expressionDepth = Math.max(0, expressionDepth - 1);
  }
  return expressionDepth > 0;
}

function findTagEnd(text, start) {
  let quote = null;
  let braces = 0;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') braces += 1;
    else if (character === '}') braces = Math.max(0, braces - 1);
    else if (character === '>' && braces === 0) return index;
  }
  return -1;
}

function scanMarkupTags(text, ignoredRanges) {
  const tokens = [];
  const regex = /<(?<closing>\/)?(?<tag>(?:wa|sl)-[a-z][a-z0-9-]*)(?=[\s/>])/g;
  for (const match of text.matchAll(regex)) {
    if (insideRanges(match.index, ignoredRanges)) continue;
    const closing = Boolean(match.groups.closing);
    const nameStart = match.index + 1 + (closing ? 1 : 0);
    const end = findTagEnd(text, match.index + match[0].length);
    if (end < 0) continue;
    tokens.push({
      tag: match.groups.tag,
      start: match.index,
      nameStart,
      nameEnd: nameStart + match.groups.tag.length,
      end,
      closing,
      selfClosing: !closing && /\/\s*>$/.test(text.slice(match.index, end + 1)),
    });
  }
  return tokens;
}

function scanAllOpeningTags(text, ignoredRanges, inside = (offset) => insideRanges(offset, ignoredRanges)) {
  const tokens = [];
  const regex = /<(?<tag>[a-z][a-z0-9.-]*)(?=[\s/>])/gi;
  for (const match of text.matchAll(regex)) {
    if (inside(match.index)) continue;
    const end = findTagEnd(text, match.index + match[0].length);
    if (end < 0) continue;
    const nameStart = match.index + 1;
    tokens.push({
      tag: match.groups.tag,
      start: match.index,
      nameStart,
      nameEnd: nameStart + match.groups.tag.length,
      end,
      closing: false,
      selfClosing: /\/\s*>$/.test(text.slice(match.index, end + 1)),
    });
  }
  return tokens;
}

const DOM_FACTORY_CONSTRUCTION = 'construction';
const DOM_FACTORY_LOOKUP = 'lookup';
const JS_IDENTIFIER = '[$A-Z_a-z][$\\w]*';

function normalizedMemberExpression(value) {
  let expression = value.trim();
  while (expression.startsWith('(') && skipBalanced(expression, 0, '(', ')') === expression.length) {
    expression = expression.slice(1, -1).trim();
  }
  return expression
    .replace(/\?\.\s*\[\s*(['"])([$A-Z_a-z][$\w]*)\1\s*\]/g, '.$2')
    .replace(/\[\s*(['"])([$A-Z_a-z][$\w]*)\1\s*\]/g, '.$2')
    .replace(/\s*(?:\?\.|\.)\s*/g, '.');
}

function memberExpressionPattern(expression) {
  const [root, ...members] = expression.split('.');
  const wrapped = (pattern) =>
    `(?:${pattern}\\s*!?|\\(\\s*${pattern}\\s+as\\s+[^;\\n]+?\\)\\s*!?)`;
  return members.reduce((pattern, member) => {
    const escaped = regexEscape(member);
    return wrapped(
      `${pattern}(?:\\s*(?:\\.|\\?\\.)\\s*${escaped}` +
      `|\\s*(?:\\?\\.)?\\s*\\[\\s*(?:'${escaped}'|"${escaped}"|\\x60${escaped}\\x60)\\s*\\])`,
    );
  }, wrapped(regexEscape(root)));
}

function canonicalFactoryExpression(value, callees) {
  const normalized = normalizedMemberExpression(value);
  if (callees.has(normalized)) return normalized;
  const source = value.trim();
  for (const candidate of callees.keys()) {
    if (new RegExp(`^(?:${memberExpressionPattern(candidate)})$`).test(source)) return candidate;
  }
  return normalized;
}

function classifyFactoryExpression(
  value,
  bindings,
  documentReferences,
  registryReferences,
  bareCreateElementAvailable = true,
) {
  let expression = normalizedMemberExpression(value);
  const bound = expression.match(/^(?<target>.+)\.bind\s*\([^()]*\)$/s);
  if (bound) expression = normalizedMemberExpression(bound.groups.target);
  if (bindings.has(expression)) return bindings.get(expression);
  if (expression === 'createElement' && bareCreateElementAvailable) {
    return DOM_FACTORY_CONSTRUCTION;
  }
  for (const reference of documentReferences) {
    if (expression === `${reference}.createElement`) return DOM_FACTORY_CONSTRUCTION;
  }
  for (const reference of registryReferences) {
    if (expression === `${reference}.get` || expression === `${reference}.whenDefined`) {
      return DOM_FACTORY_LOOKUP;
    }
  }
  return null;
}

function classifyFactoryInitializer(
  value,
  bindings,
  documentReferences,
  registryReferences,
  bareCreateElementAvailable = true,
) {
  const direct = classifyFactoryExpression(
    value,
    bindings,
    documentReferences,
    registryReferences,
    bareCreateElementAvailable,
  );
  if (direct) return direct;
  const arrow = value.match(
    new RegExp(
      `^(?:async\\s+)?(?:\\(\\s*(?<parameter>${JS_IDENTIFIER})[^)]*\\)|(?<bare>${JS_IDENTIFIER}))\\s*=>\\s*(?<body>.+)$`,
      's',
    ),
  );
  if (!arrow) return null;
  const parameter = arrow.groups.parameter ?? arrow.groups.bare;
  const body = arrow.groups.body.trim().replace(/^\{\s*return\s+/, '').replace(/\s*\}$/, '').trim();
  const call = body.match(
    new RegExp(
      `^(?<factory>${JS_IDENTIFIER}(?:\\s*\\.\\s*${JS_IDENTIFIER})*)\\s*` +
        `\\(\\s*${regexEscape(parameter)}\\s*\\)$`,
    ),
  );
  return call
    ? classifyFactoryExpression(
        call.groups.factory,
        bindings,
        documentReferences,
        registryReferences,
        bareCreateElementAvailable,
      )
    : null;
}

function parseDestructuredBindings(source) {
  const bindings = [];
  for (const rawEntry of source.split(',')) {
    const entry = rawEntry.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n\r]*/g, '').trim();
    if (!entry || entry.startsWith('...')) continue;
    const match = entry.match(
      new RegExp(`^(?<property>${JS_IDENTIFIER})(?:\\s*:\\s*(?<local>${JS_IDENTIFIER}))?(?:\\s*=.*)?$`),
    );
    if (match) bindings.push({ property: match.groups.property, local: match.groups.local ?? match.groups.property });
  }
  return bindings;
}

function codeBraceRanges(text) {
  const stack = [];
  const ranges = [];
  for (let index = 0; index < text.length; index += 1) {
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      index = end < 0 ? text.length : end;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    const character = text[index];
    if (character === '"' || character === "'" || character === '`') {
      const quote = character;
      index += 1;
      while (index < text.length) {
        if (text[index] === '\\') index += 2;
        else if (text[index] === quote) break;
        else index += 1;
      }
      continue;
    }
    if (character === '{') stack.push(index);
    else if (character === '}' && stack.length > 0) {
      ranges.push([stack.pop(), index + 1]);
    }
  }
  return ranges;
}

function identifierAppears(source, name) {
  return new RegExp(`(?<![$\\w])${regexEscape(name)}(?![$\\w])`).test(source);
}

function enclosingBraceRange(braceRanges, offset, textLength) {
  let enclosing = null;
  for (const range of braceRanges) {
    if (range[0] >= offset || range[1] <= offset) continue;
    if (!enclosing || range[1] - range[0] < enclosing[1] - enclosing[0]) enclosing = range;
  }
  return enclosing ?? [0, textLength];
}

function topLevelIndex(source, wanted) {
  const pairs = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  let quote = null;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (Object.hasOwn(pairs, character)) stack.push(pairs[character]);
    else if (stack.at(-1) === character) stack.pop();
    else if (stack.length === 0 && character === wanted) return index;
  }
  return -1;
}

function parameterListBindsName(parameters, name) {
  let rest = parameters;
  while (rest) {
    const comma = topLevelIndex(rest, ',');
    const parameter = (comma < 0 ? rest : rest.slice(0, comma)).trim();
    const equals = topLevelIndex(parameter, '=');
    const binding = (equals < 0 ? parameter : parameter.slice(0, equals)).trim();
    const restBinding = binding.replace(/^\.\.\.\s*/, '');
    if (
      new RegExp(
        `^(?:(?:public|private|protected|readonly|override)\\s+)*(?:\\.\\.\\.\\s*)?` +
          `${regexEscape(name)}(?=\\s*(?:[?:]|$))`,
      ).test(binding) ||
      ((restBinding.startsWith('{') || restBinding.startsWith('[')) && identifierAppears(restBinding, name))
    ) {
      return true;
    }
    if (comma < 0) break;
    rest = rest.slice(comma + 1);
  }
  return false;
}

function nextCodeIndex(text, start) {
  let index = start;
  while (index < text.length) {
    if (/\s/.test(text[index])) {
      index += 1;
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 ? text.length : end + 2;
      continue;
    }
    break;
  }
  return index;
}

function matchingTypeParameterEnd(text, start) {
  let depth = 0;
  let quote = null;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      index = end < 0 ? text.length : end;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (character === '<') depth += 1;
    else if (character === '>' && text[index - 1] !== '=') {
      depth -= 1;
      if (depth === 0) return index;
      if (depth < 0) return -1;
    }
  }
  return -1;
}

function stripTrailingTypeParameters(text) {
  const value = text.trimEnd();
  if (!value.endsWith('>')) return value;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== '<' || quotedRangeContaining(value, index)) continue;
    if (matchingTypeParameterEnd(value, index) === value.length - 1) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value;
}

function scanCallableScopes(text, ignoredRanges, braceRanges) {
  const scopes = [];
  const remember = (parameters, body, parameterRange) => {
    if (!body) return;
    const key = `${body[0]}:${body[1]}:${parameters}`;
    if (!scopes.some((scope) => scope.key === key)) {
      scopes.push({ key, parameters, parameterRange, body });
    }
  };

  for (let open = text.indexOf('('); open >= 0; open = text.indexOf('(', open + 1)) {
    if (insideRanges(open, ignoredRanges) || quotedRangeContaining(text, open)) continue;
    const closeAfter = skipBalanced(text, open, '(', ')');
    if (closeAfter <= open + 1 || closeAfter > text.length) continue;
    const close = closeAfter - 1;
    const prefix = text.slice(Math.max(0, open - 200), open);
    const callablePrefix = stripTrailingTypeParameters(prefix);
    const functionLike = /\bfunction(?:\s*\*)?(?:\s+[$A-Z_a-z][$\w]*)?\s*$/s.test(callablePrefix);
    const methodMatch = callablePrefix.match(
      /(?:^|[;{}\n])\s*(?:(?:public|private|protected|static|abstract|async|override|get|set)\s+)*(?:\*\s*)?(?<name>[$A-Z_a-z][$\w]*|constructor|\[['"][^'"\n]+['"]\])\s*$/s,
    );
    const methodLike = Boolean(
      methodMatch && !new Set(['catch', 'for', 'if', 'switch', 'while', 'with']).has(methodMatch.groups.name),
    );
    const suffix = text.slice(closeAfter, Math.min(text.length, closeAfter + 500));
    const arrow = suffix.match(/^\s*(?::[\s\S]*?)?=>/);
    let body = null;
    if (arrow) {
      const bodyStart = nextCodeIndex(text, closeAfter + arrow[0].length);
      body = text[bodyStart] === '{'
        ? braceRanges.find(([start]) => start === bodyStart) ?? null
        : [bodyStart, simpleStatementEnd(text, bodyStart)];
    } else if (functionLike || methodLike) {
      const bodyStart = nextCodeIndex(text, closeAfter);
      const openingBrace = text[bodyStart] === '{'
        ? bodyStart
        : text.indexOf('{', bodyStart);
      const boundary = text.slice(bodyStart, openingBrace < 0 ? text.length : openingBrace);
      if (openingBrace >= 0 && !/[;=]/.test(boundary)) {
        body = braceRanges.find(([start]) => start === openingBrace) ?? null;
      }
    }
    remember(text.slice(open + 1, close), body, [open + 1, close]);
    open = close;
  }

  const bareArrow = new RegExp(`(?<![$\\w])(?<parameter>${JS_IDENTIFIER})\\s*=>`, 'g');
  for (const match of text.matchAll(bareArrow)) {
    if (insideRanges(match.index, ignoredRanges) || quotedRangeContaining(text, match.index)) continue;
    const bodyStart = nextCodeIndex(text, match.index + match[0].length);
    const body = text[bodyStart] === '{'
      ? braceRanges.find(([start]) => start === bodyStart) ?? null
      : [bodyStart, simpleStatementEnd(text, bodyStart)];
    remember(
      match.groups.parameter,
      body,
      [match.index, match.index + match.groups.parameter.length],
    );
  }
  return scopes;
}

function enclosingFunctionRange(callableScopes, offset, textLength) {
  let enclosing = null;
  for (const { body } of callableScopes) {
    if (body[0] >= offset || body[1] <= offset) continue;
    if (!enclosing || body[1] - body[0] < enclosing[1] - enclosing[0]) enclosing = body;
  }
  return enclosing ?? [0, textLength];
}

function sameRange(left, right) {
  return Boolean(left && right && left[0] === right[0] && left[1] === right[1]);
}

function identifierShadowRanges(text, name, ignoredRanges, braceRanges, callableScopes) {
  const ranges = [];
  const escaped = regexEscape(name);
  const addBodyRange = (match, bodyStart) => {
    if (insideRanges(match.index, ignoredRanges) || quotedRangeContaining(text, match.index)) return;
    const body = braceRanges.find(([start]) => start === bodyStart);
    if (body) ranges.push(body);
  };

  const declarationPattern = new RegExp(
    `\\b(?<kind>const|let|var|function|class)\\s+${escaped}(?![$\\w])`,
    'g',
  );
  for (const match of text.matchAll(declarationPattern)) {
    if (insideRanges(match.index, ignoredRanges) || quotedRangeContaining(text, match.index)) continue;
    // Treat block function declarations as function-scoped too. Modules use lexical block
    // semantics, while sloppy scripts may apply Annex B hoisting; the wider range fails closed in
    // both inputs instead of rewriting a possibly shadowed DOM global.
    ranges.push(match.groups.kind === 'var' || match.groups.kind === 'function'
      ? enclosingFunctionRange(callableScopes, match.index, text.length)
      : enclosingBraceRange(braceRanges, match.index, text.length));
  }
  const destructuringPattern = /\b(?<kind>const|let|var)\s*\{(?<bindings>[^{}\n]+)\}/g;
  for (const match of text.matchAll(destructuringPattern)) {
    if (insideRanges(match.index, ignoredRanges) || quotedRangeContaining(text, match.index)) continue;
    if (!parseDestructuredBindings(match.groups.bindings).some(({ local }) => local === name)) continue;
    ranges.push(match.groups.kind === 'var'
      ? enclosingFunctionRange(callableScopes, match.index, text.length)
      : enclosingBraceRange(braceRanges, match.index, text.length));
  }
  const importPattern = /\bimport\s+(?<clause>[^'";\n]+?)\s+from\s*['"]/g;
  for (const match of text.matchAll(importPattern)) {
    if (insideRanges(match.index, ignoredRanges) || quotedRangeContaining(text, match.index)) continue;
    const clause = match.groups.clause.trim().replace(/^type\s+/, '');
    const locals = [];
    const defaultBinding = clause.match(new RegExp(`^(?<local>${JS_IDENTIFIER})(?:\\s*,|$)`));
    if (defaultBinding) locals.push(defaultBinding.groups.local);
    const namespaceBinding = clause.match(new RegExp(`\\*\\s+as\\s+(?<local>${JS_IDENTIFIER})`));
    if (namespaceBinding) locals.push(namespaceBinding.groups.local);
    const namedBindings = clause.match(/\{(?<bindings>[\s\S]*?)\}/)?.groups.bindings;
    if (namedBindings) locals.push(...parseNamedModuleBindings(namedBindings).map(({ local }) => local));
    if (locals.includes(name)) ranges.push([0, text.length]);
  }

  for (const callable of callableScopes) {
    if (parameterListBindsName(callable.parameters, name)) {
      ranges.push(callable.parameterRange, callable.body);
    }
  }

  const catchPattern = /\bcatch\s*\(/g;
  for (const match of text.matchAll(catchPattern)) {
    if (insideRanges(match.index, ignoredRanges) || quotedRangeContaining(text, match.index)) continue;
    const open = match.index + match[0].lastIndexOf('(');
    const closeAfter = skipBalanced(text, open, '(', ')');
    if (closeAfter <= open + 1 || closeAfter > text.length) continue;
    const binding = text.slice(open + 1, closeAfter - 1);
    if (!parameterListBindsName(binding, name)) continue;
    const bodyStart = nextCodeIndex(text, closeAfter);
    if (text[bodyStart] === '{') addBodyRange(match, bodyStart);
  }
  return ranges;
}

function identifierIsShadowedAt(shadowRanges, name, offset) {
  return (shadowRanges.get(name) ?? []).some(([start, end]) => offset >= start && offset < end);
}

function innermostShadowRange(shadowRanges, name, offset) {
  let innermost = null;
  for (const range of shadowRanges.get(name) ?? []) {
    if (offset < range[0] || offset >= range[1]) continue;
    if (!innermost || range[1] - range[0] < innermost[1] - innermost[0]) innermost = range;
  }
  return innermost;
}

function visibleReferencesAt(references, referenceScopes, shadowRanges, offset) {
  return new Set(
    [...references].filter((reference) => {
      const root = reference.split('.')[0];
      const shadow = innermostShadowRange(shadowRanges, root, offset);
      return (referenceScopes.get(reference) ?? []).some((record) =>
        offset >= record.scope[0] && offset < record.scope[1] &&
        (record.global ? !shadow : sameRange(record.scope, shadow)));
    }),
  );
}

function declarationScope(kind, offset, braceRanges, callableScopes, textLength) {
  return kind === 'var'
    ? enclosingFunctionRange(callableScopes, offset, textLength)
    : enclosingBraceRange(braceRanges, offset, textLength);
}

function addScopedRecord(table, name, record) {
  const records = table.get(name) ?? [];
  if (records.some((candidate) =>
    candidate.kind === record.kind &&
    candidate.declarationIndex === record.declarationIndex &&
    sameRange(candidate.scope, record.scope))) {
    return false;
  }
  records.push(record);
  table.set(name, records);
  return true;
}

function visibleBindingRecord(factoryAnalysis, name, offset) {
  const shadow = innermostShadowRange(factoryAnalysis.shadowRanges, name.split('.')[0], offset);
  return (factoryAnalysis.bindingScopes.get(name) ?? [])
    .filter((record) =>
      offset >= record.scope[0] && offset < record.scope[1] &&
      (record.global ? !shadow : sameRange(record.scope, shadow)))
    .sort((left, right) =>
      left.scope[1] - left.scope[0] - (right.scope[1] - right.scope[0]) ||
      right.declarationIndex - left.declarationIndex)[0]
    ?? null;
}

function visibleBindingsAt(bindings, bindingScopes, shadowRanges, offset) {
  const analysis = { bindingScopes, shadowRanges };
  return new Map(
    [...bindings].filter(([name]) => visibleBindingRecord(analysis, name, offset)),
  );
}

function scanLocalDomFactoryBindings(text, ignoredRanges, seededBindings = new Map()) {
  const bindings = new Map(seededBindings);
  const bindingScopes = new Map();
  const documentReferences = new Set(['document', 'window.document', 'globalThis.document']);
  const registryReferences = new Set(['customElements', 'window.customElements', 'globalThis.customElements']);
  const documentReferenceScopes = new Map();
  const registryReferenceScopes = new Map();
  const moduleScope = [0, text.length];
  for (const reference of documentReferences) {
    addScopedRecord(documentReferenceScopes, reference, {
      scope: moduleScope,
      declarationIndex: -1,
      global: true,
    });
  }
  for (const reference of registryReferences) {
    addScopedRecord(registryReferenceScopes, reference, {
      scope: moduleScope,
      declarationIndex: -1,
      global: true,
    });
  }
  const braceRanges = codeBraceRanges(text);
  const callableScopes = scanCallableScopes(text, ignoredRanges, braceRanges);
  const declarationPattern = new RegExp(
    `\\b(?<declarationKind>const|let|var)\\s+(?<name>${JS_IDENTIFIER})` +
      `(?:\\s*:[^=;\\n]+)?\\s*=\\s*(?<rhs>[^;\\n]+)`,
    'g',
  );
  const declarations = [...text.matchAll(declarationPattern)].filter(
    (match) => !insideRanges(match.index, ignoredRanges) && !quotedRangeContaining(text, match.index),
  );
  const destructuringPattern = /\b(?<declarationKind>const|let|var)\s*\{(?<bindings>[^{}\n]+)\}\s*=\s*(?<source>[$A-Z_a-z][$\w]*(?:\s*\.\s*[$A-Z_a-z][$\w]*)*)/g;
  const destructurings = [...text.matchAll(destructuringPattern)].filter(
    (match) => !insideRanges(match.index, ignoredRanges) && !quotedRangeContaining(text, match.index),
  );
  const functionPattern = new RegExp(
    `\\bfunction\\s+(?<name>${JS_IDENTIFIER})\\s*\\(\\s*(?<parameter>${JS_IDENTIFIER})[^)]*\\)\\s*\\{\\s*return\\s+(?<factory>${JS_IDENTIFIER}(?:\\s*\\.\\s*${JS_IDENTIFIER})*)\\s*\\(\\s*\\k<parameter>\\s*\\)\\s*;?\\s*\\}`,
    'g',
  );
  const functions = [...text.matchAll(functionPattern)].filter(
    (match) => !insideRanges(match.index, ignoredRanges) && !quotedRangeContaining(text, match.index),
  );

  const candidateNames = new Set([
    'createElement',
    'customElements',
    'document',
    'globalThis',
    'querySelector',
    'querySelectorAll',
    'window',
    ...[...seededBindings.keys()].map((name) => name.split('.')[0]),
    ...declarations.map((match) => match.groups.name),
    ...destructurings.flatMap((match) =>
      parseDestructuredBindings(match.groups.bindings).map(({ local }) => local)),
    ...functions.map((match) => match.groups.name),
  ]);
  const shadowRanges = new Map(
    [...candidateNames].map((name) => [
      name,
      identifierShadowRanges(text, name, ignoredRanges, braceRanges, callableScopes),
    ]),
  );
  for (const [name, kind] of seededBindings) {
    addScopedRecord(bindingScopes, name, {
      kind,
      scope: moduleScope,
      declarationIndex: -1,
      declarationEnd: 0,
      declarationKind: 'import',
    });
  }

  const bindingPasses = Math.max(2, declarations.length + destructurings.length + functions.length + 1);
  for (let pass = 0; pass < bindingPasses; pass += 1) {
    let changed = false;
    for (const declaration of declarations) {
      const name = declaration.groups.name;
      const rhs = normalizedMemberExpression(declaration.groups.rhs);
      const scope = declarationScope(
        declaration.groups.declarationKind,
        declaration.index,
        braceRanges,
        callableScopes,
        text.length,
      );
      const visibleDocuments = visibleReferencesAt(
        documentReferences,
        documentReferenceScopes,
        shadowRanges,
        declaration.index,
      );
      const visibleRegistries = visibleReferencesAt(
        registryReferences,
        registryReferenceScopes,
        shadowRanges,
        declaration.index,
      );
      if (visibleDocuments.has(rhs)) {
        documentReferences.add(name);
        changed = addScopedRecord(documentReferenceScopes, name, {
          scope,
          declarationIndex: declaration.index,
        }) || changed;
      }
      if (visibleRegistries.has(rhs)) {
        registryReferences.add(name);
        changed = addScopedRecord(registryReferenceScopes, name, {
          scope,
          declarationIndex: declaration.index,
        }) || changed;
      }
      const visibleBindings = visibleBindingsAt(
        bindings,
        bindingScopes,
        shadowRanges,
        declaration.index,
      );
      const kind = classifyFactoryInitializer(
        rhs,
        visibleBindings,
        visibleDocuments,
        visibleRegistries,
        !identifierIsShadowedAt(shadowRanges, 'createElement', declaration.index),
      );
      if (kind) {
        bindings.set(name, kind);
        changed = addScopedRecord(bindingScopes, name, {
          kind,
          scope,
          declarationIndex: declaration.index,
          declarationEnd: declaration.index + declaration[0].length,
          declarationKind: declaration.groups.declarationKind,
        }) || changed;
      }

    }

    for (const destructuring of destructurings) {
      const source = normalizedMemberExpression(destructuring.groups.source);
      const scope = declarationScope(
        destructuring.groups.declarationKind,
        destructuring.index,
        braceRanges,
        callableScopes,
        text.length,
      );
      const fromDocument = visibleReferencesAt(
        documentReferences,
        documentReferenceScopes,
        shadowRanges,
        destructuring.index,
      ).has(source);
      const fromRegistry = visibleReferencesAt(
        registryReferences,
        registryReferenceScopes,
        shadowRanges,
        destructuring.index,
      ).has(source);
      if (!fromDocument && !fromRegistry) continue;
      for (const binding of parseDestructuredBindings(destructuring.groups.bindings)) {
        const kind = fromDocument && binding.property === 'createElement'
          ? DOM_FACTORY_CONSTRUCTION
          : fromRegistry && (binding.property === 'get' || binding.property === 'whenDefined')
            ? DOM_FACTORY_LOOKUP
            : null;
        if (kind) {
          bindings.set(binding.local, kind);
          changed = addScopedRecord(bindingScopes, binding.local, {
            kind,
            scope,
            declarationIndex: destructuring.index,
            declarationEnd: destructuring.index + destructuring[0].length,
            declarationKind: destructuring.groups.declarationKind,
          }) || changed;
        }
      }
    }

    for (const match of functions) {
      const visibleDocuments = visibleReferencesAt(
        documentReferences,
        documentReferenceScopes,
        shadowRanges,
        match.index,
      );
      const visibleRegistries = visibleReferencesAt(
        registryReferences,
        registryReferenceScopes,
        shadowRanges,
        match.index,
      );
      const kind = classifyFactoryExpression(
        match.groups.factory,
        visibleBindingsAt(bindings, bindingScopes, shadowRanges, match.index),
        visibleDocuments,
        visibleRegistries,
        !identifierIsShadowedAt(shadowRanges, 'createElement', match.index),
      );
      if (kind) {
        const scope = enclosingFunctionRange(callableScopes, match.index, text.length);
        bindings.set(match.groups.name, kind);
        changed = addScopedRecord(bindingScopes, match.groups.name, {
          kind,
          scope,
          declarationIndex: match.index,
          declarationEnd: match.index + match[0].length,
          declarationKind: 'function',
        }) || changed;
      }
    }
    if (!changed) break;
  }
  const moduleBindings = new Map();
  for (const [name, records] of bindingScopes) {
    const record = records.find(({ scope }) => sameRange(scope, moduleScope));
    if (record) moduleBindings.set(name, record.kind);
  }
  return {
    bindings,
    bindingScopes,
    moduleBindings,
    documentReferences,
    documentReferenceScopes,
    registryReferences,
    registryReferenceScopes,
    shadowRanges,
  };
}

function assignedConstructionAlias(text, callStart) {
  const boundary = Math.max(
    text.lastIndexOf(';', callStart - 1),
    text.lastIndexOf('{', callStart - 1),
    text.lastIndexOf('}', callStart - 1),
  );
  const prefix = text.slice(boundary + 1, callStart);
  const match = prefix.match(
    new RegExp(`\\b(?:export\\s+)?(?:const|let|var)\\s+(?<alias>${JS_IDENTIFIER})(?:\\s*:[^=]+)?\\s*=\\s*$`, 's'),
  );
  return match?.groups.alias ?? null;
}

function bindingIsStableBefore(text, name, callStart, expectedKind, factoryAnalysis) {
  const record = visibleBindingRecord(factoryAnalysis, name, callStart);
  if (!record || record.kind !== expectedKind) return false;
  if (!new Set(['const', 'function', 'import']).has(record.declarationKind)) return false;
  if (record.declarationKind === 'const' && callStart < record.declarationEnd) return false;
  const start = Math.max(record.declarationEnd ?? 0, record.scope[0]);
  const intervening = text.slice(start, callStart);
  const pattern = new RegExp(`(?<![$\\w.])${regexEscape(name)}\\s*=(?!=|>)`, 'g');
  const comments = commentRanges(intervening);
  return ![...intervening.matchAll(pattern)].some((match) =>
    !insideRanges(match.index, comments) &&
    !quotedRangeContaining(intervening, match.index) &&
    sameRange(
      record.scope,
      innermostShadowRange(factoryAnalysis.shadowRanges, name.split('.')[0], start + match.index),
    ));
}

function scanFactoryTagReferences(text, ignoredRanges, factoryAnalysis) {
  const callees = new Map(factoryAnalysis.bindings);
  callees.set('createElement', DOM_FACTORY_CONSTRUCTION);
  for (const reference of factoryAnalysis.documentReferences) {
    callees.set(`${reference}.createElement`, DOM_FACTORY_CONSTRUCTION);
  }
  for (const reference of factoryAnalysis.registryReferences) {
    callees.set(`${reference}.get`, DOM_FACTORY_LOOKUP);
    callees.set(`${reference}.whenDefined`, DOM_FACTORY_LOOKUP);
  }
  const alternatives = [...callees.keys()]
    .sort((left, right) => right.length - left.length)
    .map(memberExpressionPattern)
    .join('|');
  if (!alternatives) return [];
  const pattern = new RegExp(
    `(?<![$\\w./])(?<api>(?:\\(\\s*(?:${alternatives})\\s*\\)|(?:${alternatives})))(?![$\\w])` +
      `(?:\\s*\\.\\s*bind\\s*\\([^()]*\\))?\\s*(?:<[^>\\n]+>)?\\s*` +
      `(?:(?:\\?\\.)?\\s*\\(\\s*|\\.\\s*call\\s*\\(\\s*[^,()]+\\s*,\\s*)` +
      `(?<quote>['"\\x60])(?<tag>(?:wa|sl)-[a-z][a-z0-9-]*)\\k<quote>`,
    'g',
  );
  const references = [];
  for (const match of text.matchAll(pattern)) {
    const relative = match[0].lastIndexOf(match.groups.tag);
    const start = match.index + relative;
    if (insideRanges(match.index, ignoredRanges) || insideRanges(start, ignoredRanges)) continue;
    const tagQuote = quotedRangeContaining(text, start);
    const calleeQuote = quotedRangeContaining(text, match.index);
    if (
      tagQuote && calleeQuote &&
      tagQuote[0] === calleeQuote[0] && tagQuote[1] === calleeQuote[1] &&
      (text[tagQuote[0]] !== '`' || !insideTemplateExpression(text, tagQuote[0], match.index))
    ) {
      continue;
    }
    const api = canonicalFactoryExpression(match.groups.api, callees);
    if (factoryAnalysis.bindings.has(api)) {
      if (!bindingIsStableBefore(text, api, match.index, callees.get(api), factoryAnalysis)) continue;
    } else if (api === 'createElement') {
      if (identifierIsShadowedAt(factoryAnalysis.shadowRanges, api, match.index)) continue;
    } else if (api.endsWith('.createElement')) {
      const reference = api.slice(0, -'.createElement'.length);
      const visibleDocuments = visibleReferencesAt(
        factoryAnalysis.documentReferences,
        factoryAnalysis.documentReferenceScopes,
        factoryAnalysis.shadowRanges,
        match.index,
      );
      if (!visibleDocuments.has(reference)) continue;
    } else if (api.endsWith('.get') || api.endsWith('.whenDefined')) {
      const suffix = api.endsWith('.get') ? '.get' : '.whenDefined';
      const reference = api.slice(0, -suffix.length);
      const visibleRegistries = visibleReferencesAt(
        factoryAnalysis.registryReferences,
        factoryAnalysis.registryReferenceScopes,
        factoryAnalysis.shadowRanges,
        match.index,
      );
      if (!visibleRegistries.has(reference)) continue;
    }
    const open = match.index + match[0].lastIndexOf('(', relative);
    const callEnd = skipBalanced(text, open, '(', ')');
    references.push({
      tag: match.groups.tag,
      start,
      end: start + match.groups.tag.length,
      callStart: match.index,
      callEnd: callEnd ?? match.index + match[0].length,
      resultAlias: assignedConstructionAlias(text, match.index),
      kind: callees.get(api),
    });
  }
  return references;
}

function scanApiTagReferences(text, ignoredRanges, suppliedFactoryBindings = null) {
  const factoryAnalysis = scanLocalDomFactoryBindings(
    text,
    ignoredRanges,
    suppliedFactoryBindings ?? new Map(),
  );
  const references = scanFactoryTagReferences(text, ignoredRanges, factoryAnalysis);
  const lookupPattern = /(?<![$\w.])(?<api>(?:(?:window|globalThis)\.)?document\.querySelector(?:All)?|querySelector(?:All)?)\s*(?:<[^>\n]+>)?\(\s*(?<quote>['"])(?<tag>(?:wa|sl)-[a-z][a-z0-9-]*)\k<quote>/g;
  for (const match of text.matchAll(lookupPattern)) {
    if (insideRanges(match.index, ignoredRanges)) continue;
    if (match.groups.api.includes('document.')) {
      const reference = match.groups.api.replace(/\.querySelector(?:All)?$/, '');
      const visibleDocuments = visibleReferencesAt(
        factoryAnalysis.documentReferences,
        factoryAnalysis.documentReferenceScopes,
        factoryAnalysis.shadowRanges,
        match.index,
      );
      if (!visibleDocuments.has(reference)) continue;
    } else if (
      identifierIsShadowedAt(factoryAnalysis.shadowRanges, match.groups.api, match.index)
    ) {
      continue;
    }
    const relative = match[0].lastIndexOf(match.groups.tag);
    const start = match.index + relative;
    references.push({
      tag: match.groups.tag,
      start,
      end: start + match.groups.tag.length,
      callStart: match.index,
      callEnd: match.index + match[0].length,
      resultAlias: null,
      kind: DOM_FACTORY_LOOKUP,
    });
  }
  const unique = new Map();
  for (const reference of references) {
    unique.set(`${reference.start}:${reference.end}:${reference.kind}`, reference);
  }
  return [...unique.values()].sort((left, right) => left.start - right.start || left.end - right.end);
}

function scanAliasedRewriteReviews(text, contract, ignoredRanges) {
  const reviews = new Map();
  const addUse = (mapping, tagStart, alias, offset, upstreamMember, target, message) => {
    const record = reviews.get(mapping.upstreamTag) ?? { mapping, aliases: [], uses: [] };
    if (!reviews.has(mapping.upstreamTag)) reviews.set(mapping.upstreamTag, record);
    if (!record.aliases.some((entry) => entry.tagStart === tagStart)) {
      record.aliases.push({ tagStart, alias });
    }
    const key = `${offset}:${upstreamMember}:${target}`;
    if (!record.uses.some((entry) => entry.key === key)) {
      record.uses.push({ key, offset, alias, upstreamMember, target, message });
    }
  };

  for (const mapping of contract.mappings.values()) {
    if (!AUTO_CLASSIFICATIONS.has(mapping.classification)) continue;
    const escapedTag = mapping.upstreamTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const declaration = new RegExp(
      `\\b(?:const|let|var)\\s+(?<alias>[$A-Z_a-z][$\\w]*)\\s*=\\s*` +
        `(?:document\\.)?querySelector(?:<[^>\\n]+>)?\\(\\s*(['"])${escapedTag}\\2\\s*\\)`,
      'g',
    );
    for (const match of text.matchAll(declaration)) {
      if (insideRanges(match.index, ignoredRanges)) continue;
      const alias = match.groups.alias;
      const tagStart = match.index + match[0].lastIndexOf(mapping.upstreamTag);
      const afterDeclaration = match.index + match[0].length;
      const escapedAlias = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const owner = `(?<![$\\w])${escapedAlias}\\s*(?:\\?\\.|!\\s*\\.|\\.)\\s*`;

      for (const [section, suffix] of [
        ['methods', '(?=\\s*\\()'],
        ['properties', '(?=\\s*(?:=|\\.|\\?|;|$))'],
      ]) {
        for (const rule of mapping.rewrites[section]) {
          const member = rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`${owner}(?<member>${member})${suffix}`, 'g');
          regex.lastIndex = afterDeclaration;
          for (let use = regex.exec(text); use; use = regex.exec(text)) {
            const offset = use.index + use[0].lastIndexOf(use.groups.member);
            if (insideRanges(offset, ignoredRanges)) continue;
            addUse(
              mapping,
              tagStart,
              alias,
              offset,
              rule.from,
              rule.to,
              `Aliased ${section} member ${alias}.${rule.from} must be migrated with its selector.`,
            );
          }
        }
      }

      for (const rule of mapping.rewrites.events) {
        const member = rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(
          `${owner}(?:add|remove)EventListener\\(\\s*(['"])(?<member>${member})\\1`,
          'g',
        );
        regex.lastIndex = afterDeclaration;
        for (let use = regex.exec(text); use; use = regex.exec(text)) {
          const offset = use.index + use[0].lastIndexOf(use.groups.member);
          if (insideRanges(offset, ignoredRanges)) continue;
          addUse(
            mapping,
            tagStart,
            alias,
            offset,
            rule.from,
            rule.to,
            `Aliased event ${alias}.${rule.from} must be migrated with its selector.`,
          );
        }
      }

      for (const rule of mapping.rewrites.attributes) {
        const member = rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(
          `${owner}(?:get|set|has|toggle|remove)Attribute\\(\\s*(['"])(?<member>${member})\\1`,
          'g',
        );
        regex.lastIndex = afterDeclaration;
        for (let use = regex.exec(text); use; use = regex.exec(text)) {
          const offset = use.index + use[0].lastIndexOf(use.groups.member);
          if (insideRanges(offset, ignoredRanges)) continue;
          addUse(
            mapping,
            tagStart,
            alias,
            offset,
            rule.from,
            rule.to,
            `Aliased attribute ${alias}.${rule.from} must be migrated with its selector.`,
          );
        }
      }
    }
  }
  return reviews;
}

function skipBalanced(text, start, open, close) {
  let depth = 0;
  let quote = null;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') quote = character;
    else if (character === open) depth += 1;
    else if (character === close && --depth === 0) return index + 1;
  }
  return text.length;
}

function constructionStatementEnd(text, callEnd) {
  const lineEnd = text.indexOf('\n', callEnd);
  const semicolon = text.indexOf(';', callEnd);
  const end = semicolon >= 0 && (lineEnd < 0 || semicolon < lineEnd)
    ? semicolon
    : lineEnd < 0
      ? text.length
      : lineEnd;
  const suffix = text.slice(callEnd, end).trim();
  if (suffix && !/^(?:!|as\s+[^;\n]+|satisfies\s+[^;\n]+)$/.test(suffix)) return null;
  return end < text.length ? end + 1 : end;
}

function skipMigrationTrivia(text, start) {
  let index = start;
  while (index < text.length) {
    if (/\s/.test(text[index]) || text[index] === ';') {
      index += 1;
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 ? text.length : end + 2;
      continue;
    }
    break;
  }
  return index;
}

function containsIdentifierCode(text, name) {
  const pattern = new RegExp(`(?<![$\\w])${regexEscape(name)}(?![$\\w])`, 'y');
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (character === '"' || character === "'" || character === '`') {
      const quote = character;
      index += 1;
      while (index < text.length) {
        if (text[index] === '\\') index += 2;
        else if (text[index] === quote) {
          index += 1;
          break;
        } else index += 1;
      }
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 ? text.length : end + 2;
      continue;
    }
    pattern.lastIndex = index;
    if (pattern.exec(text)) return true;
    index += 1;
  }
  return false;
}

function simpleStatementEnd(text, start) {
  const depths = { '(': 0, '[': 0, '{': 0 };
  const closes = { ')': '(', ']': '[', '}': '{' };
  let quote = null;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      continue;
    }
    if (text.startsWith('//', index)) {
      const end = text.indexOf('\n', index + 2);
      return end < 0 ? text.length : end + 1;
    }
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      index = end < 0 ? text.length : end + 1;
      continue;
    }
    if (character === '"' || character === "'" || character === '`') {
      quote = character;
      continue;
    }
    if (Object.hasOwn(depths, character)) depths[character] += 1;
    else if (Object.hasOwn(closes, character)) {
      const opening = closes[character];
      depths[opening] = Math.max(0, depths[opening] - 1);
    } else if (
      (character === ';' || character === '\n') &&
      depths['('] === 0 && depths['['] === 0 && depths['{'] === 0
    ) {
      return index + 1;
    }
  }
  return text.length;
}

function scanImmediateAliasWrite(text, start, alias) {
  const escapedAlias = regexEscape(alias);
  const source = text.slice(start);
  const attribute = source.match(
    new RegExp(
      `^${escapedAlias}\\s*\\.\\s*setAttribute\\s*\\(\\s*` +
        `(?<quote>['"])(?<member>[A-Za-z_:][-.A-Za-z0-9_:]*)\\k<quote>\\s*,`,
    ),
  );
  if (attribute) {
    const open = start + attribute[0].indexOf('(');
    const callEnd = skipBalanced(text, open, '(', ')');
    if (containsIdentifierCode(text.slice(open + 1, callEnd - 1), alias)) return null;
    const next = simpleStatementEnd(text, callEnd);
    if (text.slice(callEnd, next).replace(/[;\s]/g, '')) return null;
    return { member: attribute.groups.member, kind: 'attribute', next };
  }

  const dotProperty = source.match(
    new RegExp(`^${escapedAlias}\\s*\\.\\s*(?<member>${JS_IDENTIFIER})\\s*=(?!=|>)`),
  );
  const bracketProperty = dotProperty
    ? null
    : source.match(
      new RegExp(
        `^${escapedAlias}\\s*\\[\\s*(?<quote>['"])(?<member>[^'"]+)\\k<quote>\\s*\\]\\s*=(?!=|>)`,
      ),
    );
  const property = dotProperty ?? bracketProperty;
  if (!property) return null;
  const next = simpleStatementEnd(text, start + property[0].length);
  const rightHandSide = text.slice(start + property[0].length, next);
  if (containsIdentifierCode(rightHandSide, alias)) return null;
  return { member: property.groups.member, kind: 'property', next };
}

function defaultWriteMatches(rule, write) {
  const variants = new Set([rule.member, kebabCase(rule.member), camelCase(rule.member)]);
  if (write.kind === 'attribute') {
    const name = write.member.toLowerCase();
    return [...variants].some((variant) => variant.toLowerCase() === name);
  }
  return variants.has(write.member);
}

function assessImperativeDefaults(text, reference, defaults) {
  if (!reference.resultAlias) return { safe: false, missing: defaults };
  let cursor = constructionStatementEnd(text, reference.callEnd);
  if (cursor === null) return { safe: false, missing: defaults };
  const missing = new Set(defaults);
  for (let writes = 0; writes < 64 && missing.size > 0; writes += 1) {
    cursor = skipMigrationTrivia(text, cursor);
    const write = scanImmediateAliasWrite(text, cursor, reference.resultAlias);
    if (!write) break;
    for (const rule of missing) {
      if (defaultWriteMatches(rule, write)) missing.delete(rule);
    }
    cursor = write.next;
  }
  return { safe: missing.size === 0, missing: [...missing] };
}

function parseTagAttributes(text, token) {
  const records = [];
  let index = token.nameEnd;
  while (index < token.end) {
    while (/\s/.test(text[index] ?? '')) index += 1;
    if (index >= token.end || text[index] === '/') break;
    if (text[index] === '{') {
      index = skipBalanced(text, index, '{', '}');
      continue;
    }
    const nameStart = index;
    while (index < token.end && !/[\s=/>]/.test(text[index])) index += 1;
    const nameEnd = index;
    if (nameEnd === nameStart) {
      index += 1;
      continue;
    }
    while (/\s/.test(text[index] ?? '')) index += 1;
    let valueKind = 'boolean';
    let valueStart = null;
    let valueEnd = null;
    if (text[index] === '=') {
      index += 1;
      while (/\s/.test(text[index] ?? '')) index += 1;
      if (text[index] === '"' || text[index] === "'") {
        const quote = text[index++];
        valueKind = 'literal';
        valueStart = index;
        while (index < token.end && text[index] !== quote) {
          if (text[index] === '\\') index += 1;
          index += 1;
        }
        valueEnd = index;
        if (text[index] === quote) index += 1;
      } else if (text[index] === '{') {
        valueKind = 'expression';
        valueStart = index;
        index = skipBalanced(text, index, '{', '}');
        valueEnd = index;
      } else {
        valueKind = 'literal';
        valueStart = index;
        while (index < token.end && !/[\s>]/.test(text[index])) index += 1;
        valueEnd = index;
      }
    }
    records.push({
      rawName: text.slice(nameStart, nameEnd),
      nameStart,
      nameEnd,
      valueKind,
      valueStart,
      valueEnd,
      value: valueStart === null ? null : text.slice(valueStart, valueEnd),
    });
  }
  return records;
}

function kebabCase(name) {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replaceAll('_', '-').toLowerCase();
}

function camelCase(name) {
  return name.replace(/-([a-z0-9])/g, (_match, letter) => letter.toUpperCase());
}

function pascalCase(name) {
  const camel = camelCase(name);
  return camel[0]?.toUpperCase() + camel.slice(1);
}

function memberStyle(source, target) {
  if (source === source.toLowerCase()) return kebabCase(target);
  return camelCase(target);
}

function namedRule(rawName, mapping) {
  const candidates = [];
  const addCandidate = (section, prefix, name, suffix = '') => candidates.push({ section, prefix, name, suffix });
  if (rawName.startsWith('v-on:')) addCandidate('events', 'v-on:', rawName.slice(5));
  else if (rawName.startsWith('on:')) addCandidate('events', 'on:', rawName.slice(3));
  else if (rawName.startsWith('@')) addCandidate('events', '@', rawName.slice(1));
  else if (/^on[A-Z]/.test(rawName)) addCandidate('events', 'on', rawName.slice(2), 'jsx-event');
  else if (rawName.startsWith('v-bind:')) addCandidate('properties', 'v-bind:', rawName.slice(7));
  else if (rawName.startsWith('bind:')) addCandidate('properties', 'bind:', rawName.slice(5));
  else if (rawName.startsWith(':')) addCandidate('properties', ':', rawName.slice(1));
  else if (rawName.startsWith('.')) addCandidate('properties', '.', rawName.slice(1));
  else if (rawName.startsWith('?')) addCandidate('attributes', '?', rawName.slice(1));
  else {
    addCandidate('attributes', '', rawName);
    addCandidate('properties', '', rawName);
  }

  for (const candidate of candidates) {
    for (const rule of mapping.rewrites[candidate.section]) {
      const matches = candidate.suffix === 'jsx-event'
        ? candidate.name === pascalCase(rule.from)
        : new Set([rule.from, kebabCase(rule.from), camelCase(rule.from)]).has(candidate.name);
      if (!matches) continue;
      const targetName = candidate.suffix === 'jsx-event'
        ? pascalCase(rule.to)
        : memberStyle(candidate.name, rule.to);
      return {
        section: candidate.section,
        from: rule.from,
        to: rule.to,
        replacement: `${candidate.prefix}${targetName}`,
      };
    }
  }
  return null;
}

function isDynamicAttribute(attribute) {
  return (
    attribute.valueKind === 'expression' ||
    /^(?:[.?:]|v-bind:|bind:)/.test(attribute.rawName)
  );
}

function scanDynamicDefaultReviews(text, markupTokens, contract) {
  const reviews = new Map();
  for (const token of markupTokens) {
    if (token.closing) continue;
    const mapping = contract.mappings.get(token.tag);
    if (!AUTO_CLASSIFICATIONS.has(mapping?.classification)) continue;
    const attributes = parseTagAttributes(text, token);
    for (const rule of mapping.rewrites.defaults) {
      if (rule.action !== 'replace-value') continue;
      const variants = new Set([rule.member, kebabCase(rule.member), camelCase(rule.member)]);
      const attribute = attributes.find((entry) =>
        variants.has(entry.rawName.replace(/^[.?:]/, '')),
      );
      if (!attribute || attribute.valueKind === 'boolean' || !isDynamicAttribute(attribute)) continue;
      const record = reviews.get(mapping.upstreamTag) ?? { mapping, uses: [] };
      if (!reviews.has(mapping.upstreamTag)) reviews.set(mapping.upstreamTag, record);
      record.uses.push({
        offset: attribute.valueStart,
        upstreamMember: rule.member,
        target: String(rule.to),
        message:
          `The ${rule.member} value is dynamic; migrate ${String(rule.from)} to ${String(rule.to)} ` +
          'at its source before changing this component mapping.',
      });
    }
  }
  return reviews;
}

const VOID_HTML_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const RANDOM_CONTENT_BEHAVIOR_MESSAGES = Object.freeze({
  'host-layout':
    'Web Awesome uses display: contents while Lyra uses a block host with a shadow base; review inline placement and host-authored layout CSS.',
  'multi-item-layout':
    'Lyra owns the simultaneous-item flex/wrap/gap context inside its shadow base instead of leaving it on the host.',
  'unique-retry-bound':
    'Web Awesome promises non-repeating unique selection while Lyra uses a bounded retry and can eventually repeat.',
  'forwarded-slot-candidates':
    'Lyra flattens a direct forwarding slot into projected candidates while Web Awesome treats only its direct element child as the candidate.',
  'autoplay-semantics':
    'Lyra stops autoplay for reduced motion, keeps timer ticks silent, does not pause on hover, and exposes a localized paused control/state/event absent upstream.',
});

function pairedMarkupTokens(tokens) {
  const stack = [];
  const pairs = new Map();
  for (const token of tokens) {
    if (!token.closing && !token.selfClosing) {
      stack.push(token);
      continue;
    }
    if (!token.closing) continue;
    for (let index = stack.length - 1; index >= 0; index -= 1) {
      if (stack[index].tag !== token.tag) continue;
      const [opening] = stack.splice(index, 1);
      pairs.set(opening.start, token);
      break;
    }
  }
  return pairs;
}

function scanDirectElementChildren(text, start, end, ignoredRanges) {
  const directTags = [];
  const stack = [];
  let cursor = start;
  let dynamicDirectContent = false;
  const tagPattern = /<(?<closing>\/)?(?<tag>[a-z][a-z0-9.:-]*)(?=[\s/>])/gi;
  tagPattern.lastIndex = start;

  const noteGap = (gapStart, gapEnd) => {
    if (stack.length === 0 && /\$\{|\{\{|<%/.test(text.slice(gapStart, gapEnd))) {
      dynamicDirectContent = true;
    }
  };

  for (let match = tagPattern.exec(text); match && match.index < end; match = tagPattern.exec(text)) {
    if (insideRanges(match.index, ignoredRanges)) continue;
    noteGap(cursor, match.index);
    const tokenEnd = findTagEnd(text, match.index + match[0].length);
    if (tokenEnd < 0 || tokenEnd >= end) break;
    const tagName = match.groups.tag.toLowerCase();
    if (match.groups.closing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index] !== tagName) continue;
        stack.splice(index, 1);
        break;
      }
    } else {
      if (stack.length === 0) directTags.push(tagName);
      const selfClosing = /\/\s*>$/.test(text.slice(match.index, tokenEnd + 1));
      if (!selfClosing && !VOID_HTML_TAGS.has(tagName)) stack.push(tagName);
    }
    cursor = tokenEnd + 1;
    tagPattern.lastIndex = cursor;
  }
  noteGap(cursor, end);
  return { directTags, dynamicDirectContent };
}

function normalizedAttributeName(attribute) {
  return attribute.rawName.replace(/^(?:v-bind:|bind:|[.?:])/, '').toLowerCase();
}

function scanConditionalBehaviorReviews(text, markupTokens, ignoredRanges, contract) {
  const reviews = new Map();
  const pairs = pairedMarkupTokens(markupTokens);
  for (const opening of markupTokens) {
    if (opening.closing || opening.tag !== 'wa-random-content') continue;
    const mapping = contract.mappings.get(opening.tag);
    if (!AUTO_CLASSIFICATIONS.has(mapping?.classification) || !mapping.parity.behaviorReviewFlags.length) continue;

    const attributes = parseTagAttributes(text, opening);
    const attribute = (name) => attributes.find((candidate) => normalizedAttributeName(candidate) === name);
    const closing = pairs.get(opening.start);
    const children = closing
      ? scanDirectElementChildren(text, opening.end + 1, closing.start, ignoredRanges)
      : { directTags: [], dynamicDirectContent: !opening.selfClosing };
    const flags = [];
    const hasCandidates = children.directTags.length > 0 || children.dynamicDirectContent;
    if (hasCandidates) flags.push('host-layout');

    const items = attribute('items');
    const dynamicItems = items ? isDynamicAttribute(items) : false;
    const itemCount = !items || items.value === null ? 1 : Number(items.value);
    if (dynamicItems || (Number.isFinite(itemCount) && itemCount > 1)) {
      flags.push('multi-item-layout');
    }

    const mode = attribute('mode');
    const dynamicMode = mode ? isDynamicAttribute(mode) : false;
    const effectiveItems = Number.isFinite(itemCount) ? Math.max(1, Math.trunc(itemCount)) : 1;
    const uniqueMode = !mode || dynamicMode || mode.value === 'unique';
    if (
      uniqueMode &&
      (dynamicMode || children.dynamicDirectContent || children.directTags.length > effectiveItems)
    ) {
      flags.push('unique-retry-bound');
    }
    if (children.directTags.includes('slot') || children.dynamicDirectContent) {
      flags.push('forwarded-slot-candidates');
    }
    if (attribute('autoplay')) flags.push('autoplay-semantics');

    const uniqueFlags = flags.filter(
      (flag, index) =>
        mapping.parity.behaviorReviewFlags.includes(flag) && flags.indexOf(flag) === index,
    );
    if (!uniqueFlags.length) continue;
    reviews.set(opening.start, {
      flags: uniqueFlags,
      message:
        `Review ${mapping.upstreamTag} before relying on the migrated behavior: ` +
        uniqueFlags.map((flag) => `${flag}: ${RANDOM_CONTENT_BEHAVIOR_MESSAGES[flag]}`).join(' '),
    });
  }
  return reviews;
}

function memberAction(section) {
  const singular = {
    attributes: 'attribute',
    properties: 'property',
    events: 'event',
    slots: 'slot',
    parts: 'part',
    cssProperties: 'css-property',
    methods: 'method',
  };
  return `rewrite-${singular[section]}`;
}

function targetImport(component) {
  return `@aceshooting/lyra-ui/${component.registrationModule
    .replace(/^src\//, '')
    .replace(/\.ts$/, '.js')}`;
}

function registrationClosure(contract, upstreamTags) {
  const targets = new Map();
  for (const upstreamTag of upstreamTags ?? []) {
    const mapping = contract.mappings.get(upstreamTag);
    if (!mapping || !AUTO_CLASSIFICATIONS.has(mapping.classification) || !mapping.target) continue;
    targets.set(mapping.targetTag, mapping.target);
  }
  const rootIncluded = [...targets.values()].some((component) => component.rootIncluded !== false);
  const granular = [...targets.values()]
    .filter((component) => component.rootIncluded === false)
    .map(targetImport)
    .sort();
  return [...(rootIncluded ? ['@aceshooting/lyra-ui/all.js'] : []), ...granular];
}

function deepImportTag(specifier, ecosystem) {
  const match = specifier.match(/\/components\/([a-z0-9-]+)\/(?:\1(?:\.component)?|index)\.(?:js|mjs)$/);
  return match ? `${ecosystem === 'webawesome' ? 'wa' : 'sl'}-${match[1]}` : null;
}

function packageProvidesMapping(imported, mapping) {
  return Boolean(
    mapping &&
    (!mapping.source?.tier || imported.tiers.has(mapping.source.tier)),
  );
}

function stripTrailingModuleTrivia(text) {
  let value = text;
  while (true) {
    const next = value
      .replace(/\s+$/, '')
      .replace(/\/\*[\s\S]*?\*\/$/, '')
      .replace(/\/\/[^\n\r]*$/, '');
    if (next === value) return value;
    value = next;
  }
}

function moduleSpecifierContext(text, quoteStart) {
  const prefix = stripTrailingModuleTrivia(text.slice(0, quoteStart));
  if (/\bimport\s*\($/.test(prefix)) return { sideEffect: false, kind: 'dynamic-import' };
  if (/\brequire\s*\($/.test(prefix)) return { sideEffect: false, kind: 'require' };
  if (/\bfrom$/.test(prefix)) return { sideEffect: false, kind: 'binding' };
  if (/\bimport$/.test(prefix)) return { sideEffect: true, kind: 'import' };
  return null;
}

function regexEscape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scanImports(text, ignoredRanges, contract) {
  const packageAlternatives = [...contract.packageIdentities.keys()]
    .sort((left, right) => right.length - left.length)
    .map(regexEscape)
    .join('|');
  const packagePattern = new RegExp(
    `(['"])(?<specifier>${packageAlternatives})(?<subpath>\\/[^'"\\s]*)?\\1`,
    'g',
  );
  const imports = [];
  for (const match of text.matchAll(packagePattern)) {
    if (insideRanges(match.index, ignoredRanges)) continue;
    const quoteStart = match.index;
    const context = moduleSpecifierContext(text, quoteStart);
    if (!context) continue;
    const specifier = `${match.groups.specifier}${match.groups.subpath ?? ''}`;
    const identity = contract.packageIdentities.get(match.groups.specifier);
    invariant(identity, `unrecognized package identity ${match.groups.specifier}`);
    const closingQuoteEnd = quoteStart + match[0].length;
    const lineBreak = text.indexOf('\n', closingQuoteEnd);
    const lineEnd = lineBreak === -1 ? text.length : lineBreak;
    const semicolon = text.indexOf(';', closingQuoteEnd);
    const statementEnd = semicolon !== -1 && semicolon < lineEnd ? semicolon + 1 : lineEnd;
    imports.push({
      ...context,
      ecosystem: identity.ecosystem,
      tiers: identity.tiers,
      packageName: match.groups.specifier,
      specifier,
      subpath: match.groups.subpath ?? '',
      quote: match[1],
      start: quoteStart + 1,
      end: quoteStart + 1 + specifier.length,
      statementEnd,
    });
  }
  return imports;
}

function parseNamedModuleBindings(source) {
  const bindings = [];
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n\r]*/g, '');
  for (const rawEntry of withoutComments.split(',')) {
    const entry = rawEntry.trim().replace(/^type\s+/, '');
    if (!entry) continue;
    const match = entry.match(
      new RegExp(`^(?<imported>${JS_IDENTIFIER})(?:\\s+as\\s+(?<local>${JS_IDENTIFIER}))?$`),
    );
    if (match) {
      bindings.push({ imported: match.groups.imported, local: match.groups.local ?? match.groups.imported });
    }
  }
  return bindings;
}

function scanModuleFactoryLinks(text, ignoredRanges) {
  const imports = [];
  const localExports = [];
  const reexports = [];
  const starExports = [];
  const addMatches = (pattern, visit) => {
    for (const match of text.matchAll(pattern)) {
      if (!insideRanges(match.index, ignoredRanges) && !quotedRangeContaining(text, match.index)) {
        visit(match);
      }
    }
  };

  addMatches(
    /\bimport\s+(?!type\b)\{(?<bindings>[\s\S]*?)\}\s*from\s*(?<quote>['"])(?<source>[^'"]+)\k<quote>/g,
    (match) => {
      for (const binding of parseNamedModuleBindings(match.groups.bindings)) {
        imports.push({ source: match.groups.source, imported: binding.imported, local: binding.local });
      }
    },
  );
  addMatches(
    new RegExp(
      `\\bimport\\s+(?!type\\b)(?<local>${JS_IDENTIFIER})` +
        `(?:\\s*,\\s*(?:\\{[\\s\\S]*?\\}|\\*\\s+as\\s+${JS_IDENTIFIER}))?` +
        `\\s+from\\s*(?<quote>['"])(?<source>[^'"]+)\\k<quote>`,
      'g',
    ),
    (match) => imports.push({ source: match.groups.source, imported: 'default', local: match.groups.local }),
  );
  addMatches(
    new RegExp(
      `\\bimport\\s+\\*\\s+as\\s+(?<local>${JS_IDENTIFIER})\\s+from\\s*` +
        `(?<quote>['"])(?<source>[^'"]+)\\k<quote>`,
      'g',
    ),
    (match) => imports.push({ source: match.groups.source, imported: '*', local: match.groups.local }),
  );

  addMatches(
    /\bexport\s*\{(?<bindings>[\s\S]*?)\}\s*from\s*(?<quote>['"])(?<source>[^'"]+)\k<quote>/g,
    (match) => {
      for (const binding of parseNamedModuleBindings(match.groups.bindings)) {
        reexports.push({
          source: match.groups.source,
          imported: binding.imported,
          exported: binding.local,
        });
      }
    },
  );
  addMatches(
    /\bexport\s*\*\s*from\s*(?<quote>['"])(?<source>[^'"]+)\k<quote>/g,
    (match) => starExports.push(match.groups.source),
  );
  addMatches(
    /\bexport\s*\{(?<bindings>[\s\S]*?)\}(?!\s*from\b)/g,
    (match) => {
      for (const binding of parseNamedModuleBindings(match.groups.bindings)) {
        localExports.push({ local: binding.imported, exported: binding.local });
      }
    },
  );
  addMatches(
    new RegExp(`\\bexport\\s+(?:const|let|var|function)\\s+(?<name>${JS_IDENTIFIER})`, 'g'),
    (match) => localExports.push({ local: match.groups.name, exported: match.groups.name }),
  );
  addMatches(
    new RegExp(`\\bexport\\s+default\\s+(?<name>${JS_IDENTIFIER})(?![$\\w])`, 'g'),
    (match) => localExports.push({ local: match.groups.name, exported: 'default' }),
  );
  return { imports, localExports, reexports, starExports };
}

const MODULE_SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

function resolveScannedModule(fromFile, specifier, scannedFiles) {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), specifier);
  const extension = path.extname(base);
  const candidates = [base];
  if (extension) {
    const stem = base.slice(0, -extension.length);
    for (const candidateExtension of MODULE_SOURCE_EXTENSIONS) candidates.push(`${stem}${candidateExtension}`);
  } else {
    for (const candidateExtension of MODULE_SOURCE_EXTENSIONS) candidates.push(`${base}${candidateExtension}`);
  }
  for (const candidateExtension of MODULE_SOURCE_EXTENSIONS) {
    candidates.push(path.join(base, `index${candidateExtension}`));
  }
  return candidates.find((candidate) => scannedFiles.has(candidate)) ?? null;
}

function factoryMapEqual(left, right) {
  return left.size === right.size && [...left].every(([name, kind]) => right.get(name) === kind);
}

function buildProjectDomFactoryBindings(originals) {
  const modules = new Map();
  for (const [file, text] of originals) {
    const resolvedFile = path.resolve(file);
    const ignoredRanges = commentRanges(text);
    modules.set(resolvedFile, {
      text,
      ignoredRanges,
      links: scanModuleFactoryLinks(text, ignoredRanges),
    });
  }
  const scannedFiles = new Set(modules.keys());
  const exportedBindings = new Map([...scannedFiles].map((file) => [file, new Map()]));
  const importedBindings = new Map([...scannedFiles].map((file) => [file, new Map()]));

  for (let pass = 0; pass < Math.max(4, modules.size * 4); pass += 1) {
    let changed = false;
    for (const [file, module] of modules) {
      const seeds = new Map();
      for (const imported of module.links.imports) {
        const target = resolveScannedModule(file, imported.source, scannedFiles);
        if (!target) continue;
        const targetExports = exportedBindings.get(target);
        if (imported.imported === '*') {
          for (const [name, kind] of targetExports) seeds.set(`${imported.local}.${name}`, kind);
        } else {
          const kind = targetExports.get(imported.imported);
          if (kind) seeds.set(imported.local, kind);
        }
      }
      const analysis = scanLocalDomFactoryBindings(module.text, module.ignoredRanges, seeds);
      if (!factoryMapEqual(importedBindings.get(file), seeds)) {
        importedBindings.set(file, seeds);
        changed = true;
      }

      const nextExports = new Map();
      for (const exported of module.links.localExports) {
        const kind = analysis.moduleBindings.get(exported.local);
        if (kind) nextExports.set(exported.exported, kind);
      }
      for (const reexported of module.links.reexports) {
        const target = resolveScannedModule(file, reexported.source, scannedFiles);
        const kind = target ? exportedBindings.get(target).get(reexported.imported) : null;
        if (kind) nextExports.set(reexported.exported, kind);
      }
      for (const source of module.links.starExports) {
        const target = resolveScannedModule(file, source, scannedFiles);
        if (!target) continue;
        for (const [name, kind] of exportedBindings.get(target)) {
          if (name !== 'default') nextExports.set(name, kind);
        }
      }
      if (!factoryMapEqual(exportedBindings.get(file), nextExports)) {
        exportedBindings.set(file, nextExports);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return importedBindings;
}

function finalizeEdits(original, edits) {
  const unique = [];
  const seen = new Set();
  for (const edit of edits) {
    const key = `${edit.start}:${edit.end}:${edit.replacement}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(edit);
  }
  unique.sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 1; index < unique.length; index += 1) {
    if (unique[index].start < unique[index - 1].end) {
      throw new Error(`Migration rewrite conflict at offsets ${unique[index - 1].start} and ${unique[index].start}`);
    }
  }
  // Assembled from the end in one pass, exactly as applying each edit to the whole string in
  // descending order would, but linear in the text size instead of in size times edit count.
  const parts = [];
  let cursor = original.length;
  for (const edit of [...unique].sort((left, right) => right.start - left.start || right.end - left.end)) {
    parts.push(original.slice(edit.end, cursor), edit.replacement);
    cursor = edit.start;
  }
  parts.push(original.slice(0, cursor));
  return parts.reverse().join('');
}

function mappingMessage(mapping) {
  if (!mapping) return 'No pinned inventory mapping exists for this upstream tag.';
  return mapping.rationale || `The ${mapping.classification} mapping requires manual review.`;
}

function localMigrationKey(origin, tag) {
  return `${origin}:${tag}`;
}

/** `lyra-v7` -> `v7`, the short release label used in migration messages. */
function originLabel(origin) {
  return String(origin).replace(/^lyra-/, '');
}

function localAttributeName(rawName) {
  return rawName.replace(/^(?:v-bind:|bind:|[.?:])/, '').toLowerCase();
}

function serializeLocalDefault(rule) {
  if (rule.value === true) return rule.member;
  const value = String(rule.value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  return `${rule.member}="${value}"`;
}

function scanLocalMigrationHazards(text, profiles, ignoredRanges, openingTokens) {
  const uses = [];
  const blocked = new Set();
  const tags = new Set(profiles.keys());
  const apiPattern = /\b(?:(?:[$A-Z_a-z][$\w]*)\s*(?:\?\.|\.)\s*(?:createElement|querySelector(?:All)?)|(?:createElement|querySelector(?:All)?)|customElements\.(?:get|whenDefined))\s*(?:<[^>\n]+>)?\(\s*(['"])(?<tag>lr-[a-z][a-z0-9-]*)\1/g;
  for (const match of text.matchAll(apiPattern)) {
    if (insideRanges(match.index, ignoredRanges) || !tags.has(match.groups.tag)) continue;
    const offset = match.index + match[0].lastIndexOf(match.groups.tag);
    const key = localMigrationKey(profiles.get(match.groups.tag).origin, match.groups.tag);
    blocked.add(key);
    uses.push({
      key,
      tag: match.groups.tag,
      offset,
      warningCode: 'ALIASED_MEMBER_REVIEW',
      message:
        `${match.groups.tag} is accessed through a DOM alias; review property assignments before ` +
        `inserting ${originLabel(profiles.get(match.groups.tag).origin)} compatibility defaults.`,
    });
  }

  for (const token of openingTokens) {
    const profile = profiles.get(token.tag);
    if (!profile) continue;
    const opening = text.slice(token.nameEnd, token.end);
    const patterns = [
      /\{\s*\.\.\.[^}]+\}/g,
      /\bv-bind\s*=\s*(?:"[^"]*"|'[^']*'|\{[^}]*\})/g,
    ];
    for (const pattern of patterns) {
      for (const match of opening.matchAll(pattern)) {
        const offset = token.nameEnd + match.index;
        const key = localMigrationKey(profile.origin, token.tag);
        blocked.add(key);
        uses.push({
          key,
          tag: token.tag,
          offset,
          warningCode: 'DYNAMIC_VALUE_REVIEW',
          message:
            `${token.tag} has an opaque attribute spread that may already provide a migrated default; ` +
            'expand or review it before running this profile.',
        });
      }
    }
  }
  return { uses, blocked };
}

function migrateLocalText(original, contract, options) {
  const file = options.file ?? '<memory>';
  const origin = options.origin;
  const profiles = contract.localMigrations.get(origin);
  invariant(profiles, `unknown local migration origin ${String(origin)}`);
  const starts = lineStarts(original);
  const ignoredRanges = commentRanges(original);
  const openingTokens = scanAllOpeningTags(original, ignoredRanges).filter((token) => profiles.has(token.tag));
  const hazards = scanLocalMigrationHazards(original, profiles, ignoredRanges, openingTokens);
  const blocked = new Set([...(options.blockedLocalMigrations ?? []), ...hazards.blocked]);
  const edits = [];
  const changes = [];
  const warnings = [];
  const entry = (offset, tag, action, target, message, warningCode = null, upstreamMember = null) =>
    reportEntry({
      textStarts: starts,
      file,
      offset,
      origin,
      upstreamTag: tag,
      upstreamMember,
      action,
      target,
      warningCode,
      message,
    });

  for (const use of hazards.uses) {
    warnings.push(entry(use.offset, use.tag, 'manual-review', use.tag, use.message, use.warningCode));
  }
  for (const token of openingTokens) {
    const profile = profiles.get(token.tag);
    const key = localMigrationKey(origin, token.tag);
    if (blocked.has(key)) {
      warnings.push(
        entry(
          token.nameStart,
          token.tag,
          'manual-review',
          token.tag,
          `${token.tag} remains unchanged because the scanned target set contains an aliased or dynamic value requiring review.`,
          'MAPPING_REVIEW_BLOCKED',
        ),
      );
      continue;
    }
    const attributes = parseTagAttributes(original, token);
    const present = new Set(attributes.map((attribute) => localAttributeName(attribute.rawName)));
    const insertions = [];
    for (const rule of profile.defaults) {
      if (present.has(rule.member.toLowerCase())) continue;
      insertions.push(serializeLocalDefault(rule));
      changes.push(
        entry(
          token.end,
          token.tag,
          'insert-default',
          `${rule.member}=${String(rule.value)}`,
          `Insert ${rule.member} to preserve the Lyra ${originLabel(origin)} default.`,
          null,
          rule.member,
        ),
      );
    }
    if (insertions.length > 0) {
      const insertionOffset = original[token.end - 1] === '/' ? token.end - 1 : token.end;
      edits.push({ start: insertionOffset, end: insertionOffset, replacement: ` ${insertions.join(' ')}` });
    }
  }

  changes.sort((left, right) => left.line - right.line || left.column - right.column || left.action.localeCompare(right.action));
  warnings.sort((left, right) => left.line - right.line || left.column - right.column || left.warningCode.localeCompare(right.warningCode));
  return {
    content: finalizeEdits(original, edits),
    changes,
    warnings,
    usage: {
      webawesome: { automatic: 0, manual: 0 },
      shoelace: { automatic: 0, manual: 0 },
    },
    blockedMappings: new Set(),
    blockedEcosystems: new Set(),
    bareImportEcosystems: new Set(),
    blockedLocalMigrations: blocked,
  };
}

// ---------------------------------------------------------------------------------------------
// Lyra-to-Lyra rename profiles (`--origin=lyra-v21`).
//
// Lyra-only names are short and shared: `open`, `base`, `lr-close` and many `--lr-*` properties
// each belong to several components, so a rewrite must never change what a site reaches.
//
// - Attributes, properties and slots are rewritten on a proven owner: the element carrying the
//   binding, the type selector in front of `[attr]`, or a `querySelector('lr-*')`-rooted call.
// - `::part()` is rewritten only when its compound selector names the owning component; a part
//   reached through a class, a foreign element or an `exportparts` forward is reported.
// - Events bubble and custom properties inherit, so ownership alone does not bound their reach.
//   A listener moves to the new name only when no other component already dispatches it, and an
//   unowned listener or any custom-property occurrence only when, in addition, every component
//   exposing the old name renamed it to that one target.
// - A boolean replaced by its inverse is rewritten only from a static attribute that reaches the
//   element as an attribute (HTML files and Lit templates); frameworks that assign properties
//   would receive the string.
//
// Everything else is reported with a location. During the alias window an old name keeps working,
// so a report is always safe and a wrong rewrite never is. A report is acknowledged in place with a
// `lyra-migrate-reviewed: CODE:name` comment, which keeps `--check` usable as a CI gate.
// ---------------------------------------------------------------------------------------------

const RENAME_REVIEW = 'RENAME_REVIEW';
const RENAME_TARGET_SHARED_REVIEW = 'RENAME_TARGET_SHARED_REVIEW';
const NAME_GAINED_OWNER_REVIEW = 'NAME_GAINED_OWNER_REVIEW';
const POLARITY_REVIEW = 'POLARITY_REVIEW';
const DETAIL_SHAPE_REVIEW = 'DETAIL_SHAPE_REVIEW';
const DEPRECATED_MEMBER_REVIEW = 'DEPRECATED_MEMBER_REVIEW';
const DEPRECATED_CONTENT_REVIEW = 'DEPRECATED_CONTENT_REVIEW';
const RENAME_CONFLICT_REVIEW = 'RENAME_CONFLICT_REVIEW';
const UNUSED_ACKNOWLEDGEMENT = 'UNUSED_ACKNOWLEDGEMENT';
const REVIEW_ACKNOWLEDGEMENT = /lyra-migrate-reviewed:\s*([^\n]*)/g;
const ACKNOWLEDGEMENT_TOKEN = /^([A-Z][A-Z0-9_]*):(\S+)$/;
const DEFAULT_SLOT_LABEL = '#default';
const LISTENER_CALL_BEFORE = /(?:\b(?:add|remove)EventListener|\bHostListener)\s*\(\s*$/;
// The receiver of `receiver.addEventListener(` / `removeEventListener(`: a member chain whose
// segments may be calls with flat arguments (`document.querySelector('lr-x')`, `this.#card!`).
const LISTENER_RECEIVER_BEFORE =
  /([A-Za-z_$][\w$]*(?:\s*(?:\?\.|\.)\s*#?[A-Za-z_$][\w$]*|\s*\([^()\n]*\)|\s*!(?!=))*)\s*(?:\?\.|\.)\s*(?:add|remove)EventListener\s*\(\s*$/;
// A handler argument that is a plain reference. A function expression creates a new function on
// every call, so only a reference can make two registrations the same listener.
const LISTENER_HANDLER_AFTER = /^\s*,\s*([A-Za-z_$][\w$]*(?:\s*(?:\?\.|\.)\s*#?[A-Za-z_$][\w$]*)*)\s*[,)]/;
// An application that constructs a Lyra event itself (tests, adapters, re-dispatch) keeps sending
// the name it wrote; moving that name's listeners anywhere in the scanned set would disconnect them.
const EVENT_CONSTRUCTION = /\bnew\s+(?:CustomEvent|Event)\s*(?:<[^>\n]+>)?\(\s*(['"`])(lr-[a-z0-9]+(?:-[a-z0-9]+)*)\1/g;
const TAG_API_CALL_BEFORE =
  /(?:\b(?:createElement|querySelector(?:All)?|closest|matches|unsafeStatic|literal)|\bcustomElements\s*\.\s*(?:get|whenDefined|define))\s*(?:<[^>\n]+>)?\(\s*$/;
const ANCHORED_MEMBER =
  /\b(?:querySelector|closest|createElement)\s*(?:<[^>\n]+>)?\(\s*(['"`])(lr-[a-z0-9]+(?:-[a-z0-9]+)*)\1\s*\)\s*!?\s*(?:\?\.|\.)\s*([A-Za-z_$][\w$]*)/g;
const ATTRIBUTE_METHODS = new Set(['setAttribute', 'getAttribute', 'hasAttribute', 'removeAttribute', 'toggleAttribute']);
const LISTENER_METHODS = new Set(['addEventListener', 'removeEventListener']);
const STYLESHEET_FILE = /\.(?:css|scss|sass|less|pcss|styl)$/i;
const MARKUP_FILE = /\.(?:html?|xhtml|md|markdown|vue|svelte)$/i;
// Static attribute strings reach the element as attributes only in plain HTML (including Angular
// templates and Markdown) and in Lit `html` templates. React 19, Vue and Svelte assign a string to
// a same-named property, where "false" is truthy.
const ATTRIBUTE_SEMANTICS_FILE = /\.(?:html?|xhtml|md|markdown)$/i;
const LIT_TEMPLATE_FILE = /\.(?:[cm]?[jt]s)$/i;
const SELECTOR_LOOKBEHIND = 256;

const ackName = (member) => (member === '' ? DEFAULT_SLOT_LABEL : String(member));

function mergeRanges(ranges) {
  const merged = [];
  for (const [start, end] of [...ranges].sort((left, right) => left[0] - right[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

/** A logarithmic membership test over merged, sorted ranges. */
function rangeTester(merged) {
  return (offset) => {
    let low = 0;
    let high = merged.length - 1;
    while (low <= high) {
      const middle = (low + high) >> 1;
      if (merged[middle][1] <= offset) low = middle + 1;
      else if (merged[middle][0] > offset) high = middle - 1;
      else return true;
    }
    return false;
  };
}

/** Index just past the template literal whose opening backtick is at `open`, including nested `${}`. */
function templateLiteralEnd(text, open) {
  let index = open + 1;
  while (index < text.length) {
    const character = text[index];
    if (character === '\\') index += 2;
    else if (character === '`') return index + 1;
    else if (character === '$' && text[index + 1] === '{') index = templateExpressionEnd(text, index + 2);
    else index += 1;
  }
  return text.length;
}

function templateExpressionEnd(text, index) {
  let depth = 1;
  while (index < text.length) {
    const character = text[index];
    if (character === '`') {
      index = templateLiteralEnd(text, index);
      continue;
    }
    if (character === '"' || character === "'") {
      index += 1;
      while (index < text.length && text[index] !== character && text[index] !== '\n') index += text[index] === '\\' ? 2 : 1;
      index += 1;
      continue;
    }
    if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) return index + 1;
    index += 1;
  }
  return text.length;
}

/** Top-level template literals in a script, skipping comments and quoted strings. */
function templateLiteralRanges(text, inComment) {
  const ranges = [];
  let index = 0;
  while (index < text.length) {
    const character = text[index];
    if (inComment(index)) index += 1;
    else if (character === '`') {
      const end = templateLiteralEnd(text, index);
      ranges.push([index, end]);
      index = end;
    } else if (character === '"' || character === "'") {
      index += 1;
      while (index < text.length && text[index] !== character && text[index] !== '\n') index += text[index] === '\\' ? 2 : 1;
      index += 1;
    } else index += 1;
  }
  return ranges;
}

/** [start, end] of every `tag`-tagged template literal body (Lit `html`, `svg` or `css`). */
function taggedTemplateRanges(text, tags, inComment) {
  const ranges = [];
  for (const match of text.matchAll(new RegExp(`\\b(?:${tags.join('|')})\\s*\``, 'g'))) {
    if (inComment(match.index)) continue;
    const open = match.index + match[0].length - 1;
    ranges.push([open, templateLiteralEnd(text, open)]);
  }
  return mergeRanges(ranges);
}

/**
 * Comment ranges for the rename profile: the shared scanner's, plus HTML comments it cannot see --
 * every `<!-- -->` in a markup file, and those inside template literals (Lit `html` templates,
 * inline Angular templates) in a script. Names inside them are never rewritten, and they can carry
 * acknowledgements.
 */
function renameIgnoredRanges(text, file) {
  const base = mergeRanges(commentRanges(text));
  const inBase = rangeTester(base);
  const extra = [];
  const addHtmlComments = (start, end) => {
    let index = text.indexOf('<!--', start);
    while (index >= 0 && index < end) {
      const close = text.indexOf('-->', index + 4);
      const finish = close < 0 || close + 3 > end ? end : close + 3;
      if (!inBase(index)) extra.push([index, finish]);
      index = text.indexOf('<!--', finish);
    }
  };
  if (MARKUP_FILE.test(file)) addHtmlComments(0, text.length);
  else if (!STYLESHEET_FILE.test(file)) for (const [start, end] of templateLiteralRanges(text, inBase)) addHtmlComments(start, end);
  return mergeRanges([...base, ...extra]);
}

/**
 * Acknowledgement comments. A `lyra-migrate-reviewed: CODE:name` token covers the comment's own
 * lines; a comment alone on its line (a JSX `{/* ... *\/}` counts) also covers the next line; and a
 * comment followed only by whitespace and an opening tag covers every line of that tag, so a
 * reviewed element whose attributes wrap still takes a single comment.
 */
function scanReviewAcknowledgements(text, ignoredRanges, starts, openingTokens) {
  const tokenAt = new Map(openingTokens.map((token) => [token.start, token]));
  const records = [];
  const byLine = new Map();
  const cover = (line, record) => {
    const list = byLine.get(line) ?? [];
    if (!list.includes(record)) list.push(record);
    byLine.set(line, list);
  };
  for (const [start, end] of ignoredRanges) {
    const body = text.slice(start, end);
    if (!body.includes('lyra-migrate-reviewed:')) continue;
    const firstLine = locationAt(starts, start).line;
    const lastLine = locationAt(starts, Math.max(start, end - 1)).line;
    let next = end;
    while (next < text.length && /[\s}]/.test(text[next])) next += 1;
    const followingTag = tokenAt.get(next);
    const standalone = /^\s*\{?\s*$/.test(text.slice(starts[firstLine - 1], start));
    for (const match of body.matchAll(REVIEW_ACKNOWLEDGEMENT)) {
      const tokens = match[1].replace(/(?:\*\/|-->|\*\/\s*\})[\s\S]*$/, '').split(/[\s,]+/).filter(Boolean);
      const record = {
        offset: start + match.index,
        entries: tokens.map((token) => {
          const parsed = ACKNOWLEDGEMENT_TOKEN.exec(token);
          return { token, code: parsed?.[1] ?? null, name: parsed?.[2] ?? null, used: false };
        }),
      };
      records.push(record);
      for (let line = firstLine; line <= lastLine; line += 1) cover(line, record);
      if (standalone) cover(lastLine + 1, record);
      if (followingTag) {
        const tagLast = locationAt(starts, followingTag.end).line;
        for (let line = locationAt(starts, followingTag.start).line; line <= tagLast; line += 1) cover(line, record);
      }
    }
  }
  return {
    consume(line, code, member) {
      const name = ackName(member);
      for (const record of byLine.get(line) ?? []) {
        const entry = record.entries.find((candidate) => candidate.code === code && candidate.name === name);
        if (entry) {
          entry.used = true;
          return true;
        }
      }
      return false;
    },
    unused: () => records.flatMap((record) => record.entries.filter((entry) => !entry.used).map((entry) => ({ offset: record.offset, entry }))),
  };
}

/** Single- and double-quoted string literals outside comments; template literals stay opaque. */
function quotedStringRanges(text, inComment) {
  const ranges = [];
  let index = 0;
  while (index < text.length) {
    const quote = text[index];
    if (inComment(index) || (quote !== '"' && quote !== "'" && quote !== '`')) {
      index += 1;
      continue;
    }
    const start = index;
    index += 1;
    while (index < text.length && text[index] !== quote && (quote === '`' || text[index] !== '\n')) {
      if (text[index] === '\\') index += 1;
      index += 1;
    }
    index += 1;
    if (quote !== '`') ranges.push([start, index]);
  }
  return ranges;
}

function stylesheetRanges(text, file, inComment) {
  if (STYLESHEET_FILE.test(file)) return [[0, text.length]];
  const ranges = [];
  for (const match of text.matchAll(/<style(?:\s[^>]*)?>[\s\S]*?<\/style\s*>/gi)) {
    ranges.push([match.index, match.index + match[0].length]);
  }
  return mergeRanges([...ranges, ...taggedTemplateRanges(text, ['css'], inComment)]);
}

/** The type selector of the compound selector that ends at `index`, lowercased, or null. */
function compoundTypeBefore(text, index) {
  let start = index;
  let brackets = 0;
  let parens = 0;
  const limit = Math.max(0, index - SELECTOR_LOOKBEHIND);
  while (start > limit) {
    const character = text[start - 1];
    if (character === ']') brackets += 1;
    else if (character === '[') {
      if (brackets === 0) break;
      brackets -= 1;
    } else if (character === ')') parens += 1;
    else if (character === '(') {
      if (parens === 0) break;
      parens -= 1;
    } else if (brackets === 0 && parens === 0 && /[\s,>+~{};'"`]/.test(character)) break;
    start -= 1;
  }
  if (start === limit && limit > 0) return null;
  const compound = text.slice(start, index);
  // Svelte scopes a component selector as `:global(lr-x)::part(y)`.
  return (/^:global\(\s*([A-Za-z][\w-]*)\s*\)$/.exec(compound) ?? /^([A-Za-z][\w-]*)/.exec(compound))?.[1].toLowerCase() ?? null;
}

function mentionedTags(text, tags, inComment) {
  const found = new Set();
  for (const tag of tags) {
    for (const match of text.matchAll(new RegExp(`(?<![\\w-])${tag}(?![\\w-])`, 'g'))) {
      if (!inComment(match.index)) {
        found.add(tag);
        break;
      }
    }
  }
  return found;
}

function elementPairs(text, tag, inComment) {
  const pairs = [];
  const stack = [];
  for (const match of text.matchAll(new RegExp(`<(/)?${tag}(?=[\\s/>])`, 'g'))) {
    if (inComment(match.index)) continue;
    const end = findTagEnd(text, match.index + match[0].length);
    if (end < 0) continue;
    if (match[1]) {
      const opening = stack.pop();
      if (opening) pairs.push({ opening, closingStart: match.index });
    } else if (!/\/\s*>$/.test(text.slice(match.index, end + 1))) {
      stack.push({ start: match.index, end });
    }
  }
  return pairs;
}

function directChildTokens(text, start, end, inComment) {
  const children = [];
  const stack = [];
  const pattern = /<(\/)?([A-Za-z][\w.:-]*)(?=[\s/>])/g;
  pattern.lastIndex = start;
  for (let match = pattern.exec(text); match && match.index < end; match = pattern.exec(text)) {
    if (inComment(match.index)) continue;
    const tokenEnd = findTagEnd(text, match.index + match[0].length);
    if (tokenEnd < 0 || tokenEnd >= end) break;
    const name = match[2].toLowerCase();
    if (match[1]) {
      const index = stack.lastIndexOf(name);
      if (index >= 0) stack.length = index;
    } else {
      const nameStart = match.index + 1;
      if (stack.length === 0) children.push({ tag: name, start: match.index, nameStart, nameEnd: nameStart + match[2].length, end: tokenEnd });
      const selfClosing = /\/\s*>$/.test(text.slice(match.index, tokenEnd + 1));
      if (!selfClosing && !VOID_HTML_TAGS.has(name)) stack.push(name);
    }
    pattern.lastIndex = tokenEnd + 1;
  }
  return children;
}

/** `{...}` groups at attribute-name position in an opening tag: JSX/Svelte spreads and Svelte shorthands. */
function openingTagBraceGroups(text, token) {
  const groups = [];
  let index = token.nameEnd;
  let quote = null;
  while (index < token.end) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = null;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    else if (character === '{') {
      const end = skipBalanced(text, index, '{', '}');
      if (!/=\s*$/.test(text.slice(token.nameEnd, index)) && text[index - 1] !== '$') {
        groups.push({ start: index, end, body: text.slice(index + 1, end - 1).trim() });
      }
      index = end;
      continue;
    }
    index += 1;
  }
  return groups;
}

/** An event listener binding in any supported template syntax, or null. */
function markupEventName(rawName) {
  if (/^\(lr-[a-z0-9-]+\)$/.test(rawName)) return { name: rawName.slice(1, -1), offset: 1 };
  if (/^onlr-/.test(rawName)) return { name: rawName.slice(2).replace(/Capture$/, ''), offset: 2 };
  for (const [prefix, separator] of [['@', '.'], ['v-on:', '.'], ['on:', '|']]) {
    if (rawName.startsWith(prefix)) return { name: rawName.slice(prefix.length).split(separator)[0], offset: prefix.length };
  }
  return null;
}

/**
 * An attribute or property binding: `form` is `attribute`, `property`, or `member` (Vue's `:x`,
 * which binds a property when the element has one and an attribute otherwise).
 */
function markupMemberBinding(attribute) {
  const raw = attribute.rawName;
  let match;
  if (raw.startsWith('?')) return { form: 'attribute', offset: 1, name: raw.slice(1), dynamic: true };
  if ((match = /^\[attr\.([^\]]+)\]$/.exec(raw))) return { form: 'attribute', offset: 6, name: match[1], dynamic: true };
  if ((match = /^\[([A-Za-z_$][\w$]*)\]$/.exec(raw))) return { form: 'property', offset: 1, name: match[1], dynamic: true };
  if (raw.startsWith('.')) return { form: 'property', offset: 1, name: raw.slice(1), dynamic: true };
  if (raw.startsWith('bind:')) return { form: 'property', offset: 5, name: raw.slice(5).split('|')[0], dynamic: true };
  for (const prefix of ['v-bind:', ':']) {
    if (raw.startsWith(prefix)) return { form: 'member', offset: prefix.length, name: raw.slice(prefix.length).split('.')[0], dynamic: true };
  }
  if (!/^[A-Za-z][\w-]*$/.test(raw) || /^onlr-/.test(raw)) return null;
  const dynamic = attribute.valueKind === 'expression' || /\$\{|\{\{/.test(attribute.value ?? '');
  return { form: /[A-Z]/.test(raw) ? 'property' : 'attribute', offset: 0, name: raw, dynamic };
}

function attributeEnd(text, attribute) {
  if (attribute.valueEnd === null) return attribute.nameEnd;
  const quote = text[attribute.valueStart - 1];
  return (quote === '"' || quote === "'") && text[attribute.valueEnd] === quote ? attribute.valueEnd + 1 : attribute.valueEnd;
}

function boundMemberNames(attributes) {
  const names = new Set();
  for (const attribute of attributes) {
    const binding = markupMemberBinding(attribute);
    if (binding) names.add(kebabCase(binding.name));
  }
  return names;
}

function sortReportEntries(entries, codeKey) {
  return entries.sort((left, right) =>
    left.line - right.line || left.column - right.column || String(left[codeKey]).localeCompare(String(right[codeKey])));
}

function migrateRenameText(original, contract, options) {
  const file = options.file ?? '<memory>';
  const origin = options.origin;
  const profile = contract.renameProfiles.get(origin);
  invariant(profile, `unknown migration origin ${String(origin)}`);
  const result = {
    content: original,
    changes: [],
    warnings: [],
    acknowledged: 0,
    usage: {
      webawesome: { automatic: 0, manual: 0 },
      shoelace: { automatic: 0, manual: 0 },
    },
    blockedMappings: new Set(),
    blockedEcosystems: new Set(),
    bareImportEcosystems: new Set(),
    blockedLocalMigrations: new Set(),
    constructedEvents: new Set(),
  };
  if (profile.isEmpty) return result;

  const starts = lineStarts(original);
  const ignoredRanges = renameIgnoredRanges(original, file);
  const inComment = rangeTester(ignoredRanges);
  const openingTokens = scanAllOpeningTags(original, ignoredRanges, inComment);
  const acknowledgements = scanReviewAcknowledgements(original, ignoredRanges, starts, openingTokens);
  const litTemplates = LIT_TEMPLATE_FILE.test(file) ? rangeTester(taggedTemplateRanges(original, ['html', 'svg'], inComment)) : () => false;
  const attributeSemantics = (offset) => ATTRIBUTE_SEMANTICS_FILE.test(file) || litTemplates(offset);
  const release = `Lyra ${profile.toMajor}`;
  const removal = `${profile.aliasRemovalMajor}.0.0`;
  for (const match of original.matchAll(EVENT_CONSTRUCTION)) {
    if (!inComment(match.index) && profile.renamesNamed('event', match[2]).length) result.constructedEvents.add(match[2]);
  }
  const constructedEvents = new Set([...(options.constructedEvents ?? []), ...result.constructedEvents]);
  // Listener calls by receiver and handler text. One handler added for both an old name and its
  // new name on one receiver runs twice per activation while both names fire; renamed, the DOM
  // keeps only one of the two identical registrations and the handler would silently run once.
  const listenerIdentity = (quote, name) => {
    const receiver = LISTENER_RECEIVER_BEFORE.exec(original.slice(Math.max(0, quote - 200), quote))?.[1];
    const handler = LISTENER_HANDLER_AFTER.exec(original.slice(quote + name.length + 2, quote + name.length + 202))?.[1];
    return receiver && handler ? `${receiver.replace(/\s+/g, '')}\u0000${handler.replace(/\s+/g, '')}` : null;
  };
  const listenedNames = new Map();
  if (profile.data.renames.some((entry) => entry.kind === 'event')) {
    for (const match of original.matchAll(/(['"`])(lr-[a-z0-9]+(?:-[a-z0-9]+)*)\1/g)) {
      if (inComment(match.index) || !LISTENER_CALL_BEFORE.test(original.slice(Math.max(0, match.index - 120), match.index))) continue;
      const identity = listenerIdentity(match.index, match[2]);
      if (identity) listenedNames.set(identity, new Set([...(listenedNames.get(identity) ?? []), match[2]]));
    }
  }
  /** Whether this listener call's receiver already adds or removes the same handler for a new name of `name`. */
  const sameHandlerListens = (quote, name) => {
    if (!listenedNames.size) return false;
    const names = listenedNames.get(listenerIdentity(quote, name));
    return Boolean(names) && profile.renamesNamed('event', name).some((entry) => names.has(entry.to));
  };
  const edits = [];
  const seenWarnings = new Set();
  const handledStrings = new Set();
  const handledMembers = new Set();
  const unique = (values) => [...new Set(values)];
  const list = (values) => unique(values).join(', ');
  const soleTag = (entries) => (unique(entries.map((entry) => entry.tag)).length === 1 ? entries[0].tag : null);
  const hint = (code, member) => `After review, mark the site with a "lyra-migrate-reviewed: ${code}:${ackName(member)}" comment.`;

  const rewrite = (start, end, replacement, { tag, member, action, target, message }) => {
    edits.push({ start, end, replacement });
    result.changes.push(reportEntry({
      textStarts: starts,
      file,
      offset: start,
      origin,
      upstreamTag: tag,
      upstreamMember: member,
      action,
      target,
      message,
    }));
  };
  const warn = (offset, { tag = null, member, code, target = null, message }) => {
    const key = `${offset}:${code}:${member}`;
    if (seenWarnings.has(key)) return;
    seenWarnings.add(key);
    if (acknowledgements.consume(locationAt(starts, offset).line, code, member)) {
      result.acknowledged += 1;
      return;
    }
    result.warnings.push(reportEntry({
      textStarts: starts,
      file,
      offset,
      origin,
      upstreamTag: tag,
      upstreamMember: member,
      action: 'manual-review',
      target,
      warningCode: code,
      message: `${message} ${hint(code, member)}`,
    }));
  };
  const reviewMessage = (review) => {
    const subject = review.kind === 'component'
      ? `<${review.tag}>`
      : review.kind === 'slot' && review.name === ''
        ? `Content in the default slot of ${review.tag}`
        : `The ${review.tag} ${review.kind} ${review.name}`;
    return `${subject} is deprecated and scheduled for removal in ${review.removalNotBefore}; migrate to ${review.replacement} by hand.`;
  };
  const reportReview = (offset, review) =>
    warn(offset, { tag: review.tag, member: review.name, code: DEPRECATED_MEMBER_REVIEW, target: review.replacement, message: reviewMessage(review) });
  const unownedReviews = (kind, name, offset, owner) => {
    const own = owner ? profile.reviewFor(owner, kind, name) : null;
    if (own) reportReview(offset, own);
    else if (!profile.exposes(kind, name, owner)) {
      for (const review of profile.reviewsNamed(kind, name)) reportReview(offset, review);
    }
  };
  const label = (kind) => (kind === 'css-property' ? 'custom property' : kind);
  const detailNote = (name) => {
    const details = profile.detailsNamed(name);
    return details.length ? ` Its ${release} detail also changed: ${details.map((entry) => `${entry.tag}: ${entry.summary}`).join(' ')}` : '';
  };

  /**
   * An old name at a site that does not bound its reach: an unowned listener, a listener on an
   * element that does not dispatch it, or any custom-property occurrence. Rewrites only a global
   * rename; otherwise reports which components moved and which did not.
   */
  const unownedMove = ({ kind, name, start, context, rewritable, action }) => {
    const renames = profile.renamesNamed(kind, name);
    const targets = unique(renames.map((entry) => entry.to));
    const constructed = kind === 'event' && constructedEvents.has(name);
    if (rewritable && !constructed && profile.isGlobal(kind, name)) {
      rewrite(start, start + name.length, targets[0], {
        tag: soleTag(renames),
        member: name,
        action,
        target: targets[0],
        message: `Rename ${name} to ${targets[0]}; every component exposing it renamed it, and no other component uses ${targets[0]}.`,
      });
      return targets[0];
    }
    const sourceKeepers = unique(targets.flatMap((to) => profile.sourceKeepers(kind, name, to)))
      .filter((tag) => !renames.some((entry) => entry.tag === tag));
    const targetKeepers = unique(targets.flatMap((to) => profile.targetKeepers(kind, name, to)));
    const shared = targets.length === 1 && !sourceKeepers.length && targetKeepers.length > 0 && !renames.some((entry) => entry.polarity);
    warn(start, {
      tag: soleTag(renames),
      member: name,
      code: shared ? RENAME_TARGET_SHARED_REVIEW : RENAME_REVIEW,
      target: targets.join(' | '),
      message:
        (kind === 'css-property'
          ? 'Custom properties inherit into nested components. '
          : context === 'listener'
            ? 'This listener does not prove which element it listens to. '
            : 'This string may name an event of any component. ') +
        `${list(renames.map((entry) => entry.tag))} renamed the ${label(kind)} ${name} to ${targets.join(' or ')}` +
        (sourceKeepers.length ? `, while ${list(sourceKeepers)} still ${sourceKeepers.length === 1 ? 'uses' : 'use'} ${name}` : '') +
        (targetKeepers.length ? `; ${list(targetKeepers)} already ${targetKeepers.length === 1 ? 'uses' : 'use'} ${targets.join(' and ')}, which this site would start reaching` : '') +
        (constructed ? `; the scanned code also dispatches ${name} itself, so its listeners and dispatches must move together` : '') +
        `. Update it by hand for the components it is meant for; ${name} keeps working until ${removal}.` +
        (kind === 'event' ? detailNote(targets[0]) : ''),
    });
    return null;
  };

  /** What an event listener on `owner` (or an unowned listener) would be rewritten to, without side effects. */
  const eventMove = (name, owner, rewritable = true) => {
    if (constructedEvents.has(name)) return null;
    const own = owner ? profile.renameFor(owner, 'event', name) : null;
    if (own) return profile.targetKeepers('event', name, own.to).length ? null : own.to;
    if (!rewritable || !profile.renamesNamed('event', name).length || profile.exposes('event', name, owner)) return null;
    return profile.isGlobal('event', name) ? profile.renamesNamed('event', name)[0].to : null;
  };

  /**
   * `conflict` is true when the element binds the new name too, and `'same-handler'` when the
   * listener call's receiver already adds or removes this same handler for the new name.
   */
  const conflictMessage = (conflict, subject, to) =>
    conflict === 'same-handler'
      ? `${subject} already listens to ${to} with this same handler; renamed, the two identical registrations would ` +
        `collapse into one, so the handler would run once per activation instead of twice. Rename or remove this ` +
        `call, and its add or remove counterpart, together by hand.`
      : `${subject} already listens to ${to}; merge the two handlers by hand.`;

  const eventSite = ({ name, start, owner, context, rewritable = true, conflict = false }) => {
    const own = owner ? profile.renameFor(owner, 'event', name) : null;
    let current = name;
    if (own) {
      const keepers = profile.targetKeepers('event', name, own.to);
      if (constructedEvents.has(name)) {
        warn(start, {
          tag: owner,
          member: name,
          code: RENAME_REVIEW,
          target: own.to,
          message:
            `Not renamed: the scanned code dispatches ${name} itself, so this listener would stop hearing it. Rename the ` +
            `dispatch and its listeners to ${own.to} together; ${name} keeps working until ${removal}.${detailNote(own.to)}`,
        });
      } else if (keepers.length) {
        warn(start, {
          tag: owner,
          member: name,
          code: RENAME_TARGET_SHARED_REVIEW,
          target: own.to,
          message:
            `Not renamed: ${list(keepers)} also ${keepers.length === 1 ? 'dispatches' : 'dispatch'} ${own.to}, so this listener would ` +
            `start receiving their events when they are nested inside this ${owner}. Rename it by hand and ignore events whose ` +
            `target is not this ${owner}; ${name} keeps working until ${removal}.${detailNote(own.to)}`,
        });
      } else if (conflict) {
        warn(start, {
          tag: owner,
          member: name,
          code: RENAME_CONFLICT_REVIEW,
          target: own.to,
          message: `${conflictMessage(conflict, `This ${owner}`, own.to)} ${name} keeps working until ${removal}.`,
        });
      } else {
        const narrowed = profile.sourceKeepers('event', name, own.to).filter((tag) => tag !== owner);
        rewrite(start, start + name.length, own.to, {
          tag: owner,
          member: name,
          action: 'rewrite-event',
          target: own.to,
          message:
            `Rename the ${owner} event ${name} to ${own.to}.` +
            (narrowed.length
              ? ` ${list(narrowed)} still ${narrowed.length === 1 ? 'dispatches' : 'dispatch'} ${name}; this listener stops hearing theirs from nested elements.`
              : ''),
        });
        current = own.to;
      }
    } else if (profile.renamesNamed('event', name).length && !profile.exposes('event', name, owner)) {
      if (conflict) {
        warn(start, {
          tag: soleTag(profile.renamesNamed('event', name)),
          member: name,
          code: RENAME_CONFLICT_REVIEW,
          target: profile.renamesNamed('event', name)[0].to,
          message: conflictMessage(conflict, conflict === 'same-handler' ? 'This receiver' : 'This element', profile.renamesNamed('event', name)[0].to),
        });
      } else {
        current = unownedMove({ kind: 'event', name, start, context, rewritable, action: 'rewrite-event' }) ?? name;
      }
    }
    const details = profile.detailsNamed(current);
    const ownDetail = owner ? profile.detailFor(owner, current) : null;
    if (ownDetail || (details.length && !profile.exposes('event', current, owner))) {
      const affected = ownDetail ? [ownDetail] : details;
      warn(start, {
        tag: ownDetail ? owner : soleTag(affected),
        member: current,
        code: DETAIL_SHAPE_REVIEW,
        target: current,
        message:
          `The ${current} event detail changed in ${release} and cannot be aliased: ` +
          affected.map((entry) => `${entry.tag}: ${entry.summary}`).join(' ') +
          ` Update this handler if it reads the detail of ${ownDetail ? `the ${owner} event` : 'one of these components'}.`,
      });
    }
    const gained = current === name ? profile.gainedOwners('event', name) : [];
    if (gained.length && !profile.exposes('event', name, owner)) {
      warn(start, {
        tag: soleTag(gained.map((tag) => ({ tag }))),
        member: name,
        code: NAME_GAINED_OWNER_REVIEW,
        target: name,
        message:
          `In ${release}, ${list(gained)} also ${gained.length === 1 ? 'dispatches' : 'dispatch'} ${name}. This ${context} does not prove ` +
          'which element it listens to, so it may start receiving those events; ignore them by event target if it should not.',
      });
    }
    unownedReviews('event', name, start, owner);
  };

  const memberSite = ({ owner, kind, name, start, forms, dynamic, removal: removalRange }) => {
    const review = forms.map(([candidateKind, candidate]) => profile.reviewFor(owner, candidateKind, candidate)).find(Boolean);
    if (review) reportReview(start, review);
    const rule = forms.map(([candidateKind, candidate]) => profile.renameFor(owner, candidateKind, candidate)).find(Boolean);
    if (!rule) return null;
    if (rule.polarity === 'inverted' && (dynamic || !removalRange)) {
      const target = kind === 'binding' ? memberStyle(name, rule.to) : rule.to;
      warn(start, {
        tag: owner,
        member: rule.from,
        code: POLARITY_REVIEW,
        target: rule.to,
        message:
          `${target} is the inverse of ${name} on ${owner}, and this ${kind === 'binding' ? 'binding' : kind === 'property' ? 'property access' : 'attribute binding'} ` +
          'is not a static attribute. ' +
          `Bind the negated value to ${target} by hand; ${name} keeps working until ${removal}.`,
      });
      return null;
    }
    return rule;
  };
  const renamedMembers = (owner) => unique([
    ...profile.data.renames.filter((entry) => entry.tag === owner && ['attribute', 'property', 'event'].includes(entry.kind)).map((entry) => entry.from),
    ...profile.data.reviews.filter((entry) => entry.tag === owner && ['attribute', 'property', 'event'].includes(entry.kind)).map((entry) => entry.name),
  ]);

  // --- Markup: event listeners on any element; attributes, properties, spreads and exportparts on the owner.
  const defaultTokens = [];
  for (const token of openingTokens) {
    const owner = token.tag.toLowerCase();
    const attributes = parseTagAttributes(original, token);
    const lyraOwner = profile.tags.has(owner);
    const bound = lyraOwner ? boundMemberNames(attributes) : null;

    // Plan first: a rename that binds one name twice on an element breaks the template (Lit throws
    // on duplicate bindings, Vue and Svelte refuse to compile, TSX reports a duplicate prop).
    const finalNames = new Map();
    const planned = attributes.map((attribute) => {
      const event = markupEventName(attribute.rawName);
      let finalRaw = attribute.rawName;
      if (event && /^lr-/.test(event.name)) {
        const to = eventMove(event.name, owner);
        if (to) finalRaw = attribute.rawName.slice(0, event.offset) + to + attribute.rawName.slice(event.offset + event.name.length);
      } else if (lyraOwner) {
        const binding = markupMemberBinding(attribute);
        const rule = binding && !binding.form.startsWith('member') && profile.renameFor(owner, binding.form, binding.name);
        if (rule && !rule.polarity) finalRaw = attribute.rawName.slice(0, binding.offset) + rule.to + attribute.rawName.slice(binding.offset + binding.name.length);
      }
      const key = finalRaw.toLowerCase();
      finalNames.set(key, (finalNames.get(key) ?? 0) + 1);
      return { attribute, event, key, renamed: finalRaw !== attribute.rawName };
    });

    if (lyraOwner && renamedMembers(owner).length) {
      for (const group of openingTagBraceGroups(original, token)) {
        const shorthand = /^[A-Za-z_$][\w$]*$/.exec(group.body)?.[0];
        if (!shorthand) {
          warn(group.start, {
            tag: owner,
            member: owner,
            code: 'DYNAMIC_VALUE_REVIEW',
            target: null,
            message: `This spread on ${owner} may carry renamed or deprecated members (${list(renamedMembers(owner))}); rename them where the object is built.`,
          });
          continue;
        }
        const forms = [['property', camelCase(shorthand)], ['attribute', kebabCase(shorthand)]];
        const review = forms.map(([kind, name]) => profile.reviewFor(owner, kind, name)).find(Boolean);
        if (review) reportReview(group.start + 1, review);
        const rule = forms.map(([kind, name]) => profile.renameFor(owner, kind, name)).find(Boolean);
        if (rule) {
          warn(group.start + 1, {
            tag: owner,
            member: rule.from,
            code: rule.polarity ? POLARITY_REVIEW : RENAME_REVIEW,
            target: rule.to,
            message: `The shorthand {${shorthand}} binds the deprecated ${owner} ${rule.kind} ${rule.from}; write ${memberStyle(shorthand, rule.to)}={${rule.polarity ? `!${shorthand}` : shorthand}} by hand.`,
          });
        }
      }
    }

    for (const { attribute, event, key, renamed } of planned) {
      if (event) {
        if (/^lr-/.test(event.name)) {
          eventSite({
            name: event.name,
            start: attribute.nameStart + event.offset,
            owner,
            context: 'listener',
            conflict: renamed && finalNames.get(key) > 1,
          });
        }
        continue;
      }
      if (!lyraOwner) continue;
      // A Lit element binding other than ref() may be a spread directive that sets members.
      if (/^v-(?:bind|on)$/.test(attribute.rawName) || (attribute.rawName.startsWith('${') && !/^\$\{\s*ref\s*\(/.test(attribute.rawName))) {
        if (renamedMembers(owner).length) {
          warn(attribute.nameStart, {
            tag: owner,
            member: owner,
            code: 'DYNAMIC_VALUE_REVIEW',
            target: null,
            message: `This object binding on ${owner} may carry renamed or deprecated members (${list(renamedMembers(owner))}); rename them where the object is built.`,
          });
        }
        continue;
      }
      if (attribute.rawName === 'exportparts') {
        if (attribute.valueKind !== 'literal' || /\$\{|\{\{/.test(attribute.value ?? '')) continue;
        for (const match of (attribute.value ?? '').matchAll(/([^,\s:]+)(\s*:\s*[^,\s]+)?/g)) {
          const inner = match[1];
          const start = attribute.valueStart + match.index;
          const review = profile.reviewFor(owner, 'part', inner);
          if (review) reportReview(start, review);
          const rule = profile.renameFor(owner, 'part', inner);
          if (!rule) continue;
          rewrite(start, start + inner.length, match[2] ? rule.to : `${rule.to}:${inner}`, {
            tag: owner,
            member: inner,
            action: 'rewrite-part',
            target: rule.to,
            message: match[2]
              ? `Forward the renamed ${owner} part ${rule.to} under the same exported name.`
              : `Forward the renamed ${owner} part ${rule.to} under its previous exported name ${inner}.`,
          });
        }
        continue;
      }
      const binding = markupMemberBinding(attribute);
      if (!binding) continue;
      const forms = binding.form === 'member'
        ? [['property', camelCase(binding.name)], ['attribute', kebabCase(binding.name)]]
        : [[binding.form, binding.name]];
      const start = attribute.nameStart + binding.offset;
      const staticAttribute = binding.form === 'attribute' && binding.offset === 0 && !binding.dynamic;
      const rule = memberSite({
        owner,
        kind: binding.form === 'member' ? 'binding' : binding.form,
        name: binding.name,
        start,
        forms,
        dynamic: binding.dynamic,
        removal: staticAttribute,
      });
      if (!rule) continue;
      if (bound.has(kebabCase(rule.to)) || (renamed && finalNames.get(key) > 1)) {
        warn(start, {
          tag: owner,
          member: rule.from,
          code: RENAME_CONFLICT_REVIEW,
          target: rule.to,
          message: `This ${owner} already binds ${rule.to}; remove the deprecated ${rule.from} binding by hand.`,
        });
        continue;
      }
      if (rule.polarity === 'inverted') {
        if (!attributeSemantics(token.start)) {
          warn(start, {
            tag: owner,
            member: rule.from,
            code: POLARITY_REVIEW,
            target: rule.to,
            message:
              `${rule.to} is the inverse of ${rule.from}. In this template syntax a static value may be assigned to the ` +
              `${camelCase(rule.from)} property as a string, where "false" is truthy, so set ${rule.to} by hand.`,
          });
          continue;
        }
        if (profile.defaultsFor(owner).some((entry) => entry.attribute === rule.to && entry.value === true)) {
          warn(start, {
            tag: owner,
            member: rule.from,
            code: POLARITY_REVIEW,
            target: rule.to,
            message:
              `${rule.from} has a preserved absent default, so removing an explicit attribute would let a later run insert ${rule.to}. ` +
              `Review this value using the old converter (a presence boolean treats even "false" as true), then migrate it by hand ` +
              'after the default migration is complete.',
          });
          continue;
        }
        // The true-defaulting converter recognizes only the exact literal 'false'. Trimming or
        // folding case here would invert values that the component still treats as true.
        const value = attribute.value ?? '';
        const end = attributeEnd(original, attribute);
        if (value === '' || value === 'true' || value === rule.from) {
          let removeFrom = attribute.nameStart;
          while (removeFrom > 0 && /\s/.test(original[removeFrom - 1])) removeFrom -= 1;
          rewrite(removeFrom, end, '', {
            tag: owner,
            member: rule.from,
            action: 'remove-attribute',
            target: rule.to,
            message: `Remove ${rule.from}: it restated the ${owner} default, and ${rule.to} is off by default.`,
          });
        } else if (value === 'false') {
          rewrite(attribute.nameStart, end, rule.to, {
            tag: owner,
            member: rule.from,
            action: 'rewrite-attribute',
            target: rule.to,
            message: `Replace ${rule.from}="false" with the presence of ${rule.to}.`,
          });
        } else {
          warn(start, {
            tag: owner,
            member: rule.from,
            code: POLARITY_REVIEW,
            target: rule.to,
            message: `${rule.from}="${attribute.value}" is not a boolean literal; set ${rule.to} to its inverse by hand.`,
          });
        }
        continue;
      }
      const target = binding.form === 'member' ? memberStyle(binding.name, rule.to) : rule.to;
      rewrite(start, start + binding.name.length, target, {
        tag: owner,
        member: rule.from,
        action: `rewrite-${rule.kind}`,
        target: rule.to,
        message: `Rename the ${owner} ${rule.kind} ${rule.from} to ${rule.to}.`,
      });
    }
    if (lyraOwner && profile.defaultsFor(owner).length) defaultTokens.push({ token, owner, bound });
  }

  // --- Slots: named-slot renames and reviews, default-slot reviews and deprecated slot content,
  // on the direct children of the owning element.
  const slotTags = [...profile.tags].filter((tag) =>
    profile.slotContentFor(tag).length ||
    [...profile.data.renames, ...profile.data.reviews].some((entry) => entry.tag === tag && entry.kind === 'slot'));
  for (const tag of slotTags) {
    for (const pair of elementPairs(original, tag, inComment)) {
      for (const child of directChildTokens(original, pair.opening.end + 1, pair.closingStart, inComment)) {
        let slot = '';
        let start = child.nameStart;
        for (const attribute of parseTagAttributes(original, child)) {
          if (attribute.rawName === 'slot') {
            slot = attribute.valueKind === 'literal' ? attribute.value ?? '' : null;
            start = attribute.valueStart ?? attribute.nameStart;
          } else if (attribute.rawName === 'v-slot') {
            slot = '';
          } else {
            const prefix = ['v-slot:', '#'].find((candidate) => attribute.rawName.startsWith(candidate));
            if (prefix) {
              slot = attribute.rawName.slice(prefix.length);
              start = attribute.nameStart + prefix.length;
              if (slot === 'default') slot = '';
            }
          }
        }
        if (slot === null) continue;
        const review = profile.reviewFor(tag, 'slot', slot);
        if (review) reportReview(start, review);
        const rule = slot === '' ? null : profile.renameFor(tag, 'slot', slot);
        if (rule) {
          rewrite(start, start + slot.length, rule.to, {
            tag,
            member: slot,
            action: 'rewrite-slot',
            target: rule.to,
            message: `Rename the ${tag} slot ${slot} to ${rule.to}.`,
          });
        }
        if (child.tag === 'template') continue;
        for (const content of profile.slotContentFor(tag)) {
          if (content.slot !== slot) continue;
          const listed = (content.report ?? content.allow).includes(child.tag);
          if (content.report ? !listed : listed) continue;
          warn(child.nameStart, {
            tag,
            member: child.tag,
            code: DEPRECATED_CONTENT_REVIEW,
            target: null,
            message: `<${child.tag}> in ${slot === '' ? 'the default slot' : `the ${slot} slot`} of ${tag}: ${content.summary}`,
          });
        }
      }
    }
  }

  // --- Stylesheets: `::part()`, custom properties, attribute selectors and custom states.
  for (const match of original.matchAll(/::part\(([^)]*)\)/g)) {
    if (inComment(match.index)) continue;
    const owner = compoundTypeBefore(original, match.index);
    const listStart = match.index + '::part('.length;
    for (const nameMatch of match[1].matchAll(/\S+/g)) {
      const name = nameMatch[0];
      const start = listStart + nameMatch.index;
      const own = owner ? profile.renameFor(owner, 'part', name) : null;
      if (own) {
        rewrite(start, start + name.length, own.to, {
          tag: owner,
          member: name,
          action: 'rewrite-part',
          target: own.to,
          message: `Rename the ${owner} part ${name} to ${own.to}.`,
        });
      } else if (profile.renamesNamed('part', name).length && !profile.exposes('part', name, owner)) {
        const renames = profile.renamesNamed('part', name);
        const keepers = profile.exposers('part', name).filter((tag) => !renames.some((entry) => entry.tag === tag));
        warn(start, {
          tag: soleTag(renames),
          member: name,
          code: RENAME_REVIEW,
          target: list(renames.map((entry) => entry.to)),
          message:
            `This ::part() selector does not name the component that owns the part. ${list(renames.map((entry) => entry.tag))} ` +
            `renamed the part ${name} to ${list(renames.map((entry) => entry.to))}` +
            (keepers.length ? `, while ${list(keepers)} still ${keepers.length === 1 ? 'exposes' : 'expose'} ${name}` : '') +
            '. Rename it where the selector reaches a renamed component directly; a part forwarded through exportparts keeps its exported name.',
        });
      } else if (profile.gainedOwners('part', name).length && !owner?.startsWith('lr-')) {
        const gained = profile.gainedOwners('part', name);
        warn(start, {
          tag: soleTag(gained.map((tag) => ({ tag }))),
          member: name,
          code: NAME_GAINED_OWNER_REVIEW,
          target: name,
          message: `In ${release}, ${list(gained)} also ${gained.length === 1 ? 'exposes' : 'expose'} the part ${name}, so this selector may start matching it.`,
        });
      }
      unownedReviews('part', name, start, owner);
    }
  }

  const cssNames = new Set([
    ...profile.data.renames.filter((entry) => entry.kind === 'css-property').flatMap((entry) => [entry.from, entry.to]),
    ...profile.data.reviews.filter((entry) => entry.kind === 'css-property').map((entry) => entry.name),
  ]);
  if (cssNames.size) {
    for (const match of original.matchAll(/(?<![\w-])--[A-Za-z0-9_-]+/g)) {
      const name = match[0];
      if (!cssNames.has(name) || inComment(match.index)) continue;
      if (profile.renamesNamed('css-property', name).length) {
        unownedMove({ kind: 'css-property', name, start: match.index, context: 'custom property', rewritable: true, action: 'rewrite-css-property' });
      }
      const declaration = /^\s*['"]?\s*:/.test(original.slice(match.index + name.length, match.index + name.length + 16)) ||
        /setProperty\s*\(\s*['"`]$/.test(original.slice(Math.max(0, match.index - 24), match.index));
      const gained = profile.gainedOwners('css-property', name);
      if (declaration && gained.length) {
        warn(match.index, {
          tag: soleTag(gained.map((tag) => ({ tag }))),
          member: name,
          code: NAME_GAINED_OWNER_REVIEW,
          target: name,
          message: `In ${release}, ${list(gained)} also ${gained.length === 1 ? 'reads' : 'read'} ${name}, so this declaration now reaches them when they are nested below it.`,
        });
      }
      for (const review of profile.reviewsNamed('css-property', name)) reportReview(match.index, review);
    }
  }

  for (const match of original.matchAll(/\[\s*([A-Za-z_][\w-]*)(?=\s*(?:[~|^$*]?=|\]))/g)) {
    if (inComment(match.index)) continue;
    const owner = compoundTypeBefore(original, match.index);
    if (!owner || !profile.tags.has(owner)) continue;
    const name = match[1];
    const start = match.index + match[0].length - name.length;
    const review = profile.reviewFor(owner, 'attribute', name);
    if (review) reportReview(start, review);
    const rule = profile.renameFor(owner, 'attribute', name);
    if (!rule) continue;
    if (rule.polarity === 'inverted') {
      warn(start, {
        tag: owner,
        member: name,
        code: POLARITY_REVIEW,
        target: rule.to,
        message: `${rule.to} is the inverse of ${name}; rewrite this ${owner} selector to test the opposite state (for example :not([${rule.to}])).`,
      });
      continue;
    }
    if (!rule.reflects) {
      warn(start, {
        tag: owner,
        member: name,
        code: RENAME_REVIEW,
        target: rule.to,
        message:
          `${owner} does not reflect ${rule.to}, so [${rule.to}] matches only where markup sets it. Rename this selector once every ` +
          `place that sets ${name} (markup, setAttribute) sets ${rule.to} instead.`,
      });
      continue;
    }
    rewrite(start, start + name.length, rule.to, {
      tag: owner,
      member: name,
      action: 'rewrite-attribute',
      target: rule.to,
      message: `Rename the ${owner} attribute selector [${name}] to [${rule.to}]; ${owner} reflects ${rule.to}.`,
    });
  }

  for (const match of original.matchAll(/:state\(\s*([a-z][a-z0-9-]*)\s*\)/g)) {
    if (inComment(match.index)) continue;
    const owner = compoundTypeBefore(original, match.index);
    const review = owner ? profile.reviewFor(owner, 'css-state', match[1]) : null;
    if (review) reportReview(match.index + match[0].indexOf(match[1]), review);
  }

  for (const review of profile.data.reviews.filter((entry) => entry.kind === 'component')) {
    for (const match of original.matchAll(new RegExp(`(?<![\\w-])${review.tag}(?![\\w-])`, 'g'))) {
      if (inComment(match.index) || original.slice(match.index - 2, match.index) === '</') continue;
      reportReview(match.index, review);
    }
  }

  // --- Scripts: calls rooted at querySelector/closest/createElement('lr-*') prove their element.
  for (const match of original.matchAll(ANCHORED_MEMBER)) {
    if (inComment(match.index)) continue;
    const owner = match[2];
    const member = match[3];
    const start = match.index + match[0].length - member.length;
    const after = start + member.length;
    handledMembers.add(start);
    if (LISTENER_METHODS.has(member) || ATTRIBUTE_METHODS.has(member)) {
      const call = /^\s*\(\s*(['"`])([^'"`\n]+)\1/.exec(original.slice(after, after + 200));
      if (!call) continue;
      const valueStart = after + call[0].length - 1 - call[2].length;
      handledStrings.add(valueStart - 1);
      if (LISTENER_METHODS.has(member)) {
        eventSite({ name: call[2], start: valueStart, owner, context: 'listener', conflict: sameHandlerListens(valueStart - 1, call[2]) && 'same-handler' });
        continue;
      }
      const rule = memberSite({ owner, kind: 'attribute', name: call[2], start: valueStart, forms: [['attribute', call[2]]], dynamic: true });
      if (rule) {
        rewrite(valueStart, valueStart + call[2].length, rule.to, {
          tag: owner,
          member: rule.from,
          action: 'rewrite-attribute',
          target: rule.to,
          message: `Rename the ${owner} attribute ${rule.from} to ${rule.to}.`,
        });
      }
      continue;
    }
    if (!profile.tags.has(owner)) continue;
    if (/^\s*\(/.test(original.slice(after, after + 64))) {
      const review = profile.reviewFor(owner, 'method', member);
      if (review) reportReview(start, review);
      continue;
    }
    const rule = memberSite({ owner, kind: 'property', name: member, start, forms: [['property', member]], dynamic: true });
    if (rule) {
      rewrite(start, after, rule.to, {
        tag: owner,
        member: rule.from,
        action: 'rewrite-property',
        target: rule.to,
        message: `Rename the ${owner} property ${rule.from} to ${rule.to}.`,
      });
    }
  }

  // Event names held in string literals outside an anchored call. A listener call on an unproven
  // receiver -- including Angular's `@HostListener('document:lr-…')` -- may be rewritten globally;
  // any other string (a constant, an event map key) is only reported, because the same text can
  // be a tag name passed to a DOM API.
  const eventNameMatters = (name) =>
    profile.renamesNamed('event', name).length || profile.detailsNamed(name).length ||
    profile.reviewsNamed('event', name).length || profile.gainedOwners('event', name).length;
  for (const match of original.matchAll(/(['"`])(?:(window|document|body):)?(lr-[a-z0-9]+(?:-[a-z0-9]+)*)\1/g)) {
    const name = match[3];
    if (handledStrings.has(match.index) || inComment(match.index) || !eventNameMatters(name)) continue;
    const before = original.slice(Math.max(0, match.index - 120), match.index);
    if (!match[2] && TAG_API_CALL_BEFORE.test(before)) continue;
    const listener = LISTENER_CALL_BEFORE.test(before);
    eventSite({
      name,
      start: match.index + 1 + (match[2] ? match[2].length + 1 : 0),
      owner: null,
      context: listener ? 'listener' : 'event name string',
      rewritable: listener,
      conflict: listener && !match[2] && sameHandlerListens(match.index, name) && 'same-handler',
    });
  }

  // Member access on an unproven receiver, only in files that use a component renaming it.
  const mentioned = mentionedTags(original, profile.tags, inComment);
  const accessRules = new Map();
  const addAccess = (name, candidate) => accessRules.set(name, [...(accessRules.get(name) ?? []), candidate]);
  for (const entry of profile.data.renames) {
    if (entry.kind === 'property' && mentioned.has(entry.tag)) addAccess(entry.from, { tag: entry.tag, rule: entry, call: false });
  }
  for (const entry of profile.data.reviews) {
    if ((entry.kind === 'property' || entry.kind === 'method') && mentioned.has(entry.tag)) {
      addAccess(entry.name, { tag: entry.tag, review: entry, call: entry.kind === 'method' });
    }
  }
  if (accessRules.size) {
    const inString = rangeTester(mergeRanges(quotedStringRanges(original, inComment)));
    const inStylesheet = rangeTester(stylesheetRanges(original, file, inComment));
    const inToken = rangeTester(mergeRanges(openingTokens.map((token) => [token.start + 1, token.end])));
    for (const match of original.matchAll(/(?<=[\w$)\]])\s*(?:\?\.|!?\.)\s*([A-Za-z_$][\w$]*)/g)) {
      const name = match[1];
      const candidates = accessRules.get(name);
      if (!candidates) continue;
      const start = match.index + match[0].length - name.length;
      if (handledMembers.has(start) || inComment(start) || inString(start) || inStylesheet(start) || inToken(start)) continue;
      const call = /^\s*\(/.test(original.slice(start + name.length, start + name.length + 64));
      for (const candidate of candidates) {
        if (candidate.call !== call) continue;
        if (candidate.review) {
          reportReview(start, candidate.review);
          continue;
        }
        const { rule } = candidate;
        warn(start, {
          tag: rule.tag,
          member: name,
          code: rule.polarity ? POLARITY_REVIEW : RENAME_REVIEW,
          target: rule.to,
          message:
            `If this reads or writes an ${rule.tag}, ${rule.polarity ? `use the inverse property .${rule.to}` : `rename .${name} to .${rule.to}`}; ` +
            `.${name} keeps working until ${removal}.`,
        });
      }
    }
  }

  for (const match of original.matchAll(/\.\s*(?:set|get|has|remove|toggle)Attribute\s*\(\s*(['"`])([a-z][a-z0-9-]*)\1/g)) {
    const name = match[2];
    const start = match.index + match[0].length - 1 - name.length;
    if (handledStrings.has(start - 1) || inComment(match.index)) continue;
    for (const tag of mentioned) {
      const review = profile.reviewFor(tag, 'attribute', name);
      if (review) reportReview(start, review);
      const rule = profile.renameFor(tag, 'attribute', name);
      if (!rule) continue;
      warn(start, {
        tag,
        member: name,
        code: rule.polarity ? POLARITY_REVIEW : RENAME_REVIEW,
        target: rule.to,
        message:
          `If this element is an ${tag}, ${rule.polarity ? `use the inverse attribute ${rule.to}` : `rename ${name} to ${rule.to}`}; ` +
          `${name} keeps working until ${removal}.`,
      });
    }
  }

  // --- Defaults that changed in the target release: insert the previous value when absent,
  // exactly as the Lyra 7 profile does, blocked by the same alias and spread hazards.
  if (profile.data.defaults.length) {
    const defaultProfiles = new Map(
      [...new Set(profile.data.defaults.map((entry) => entry.tag))].map((tag) => [
        tag,
        {
          origin,
          tag,
          defaults: profile.defaultsFor(tag).map((entry) => ({ member: entry.attribute, value: entry.value })),
        },
      ]),
    );
    const hazards = scanLocalMigrationHazards(
      original,
      defaultProfiles,
      ignoredRanges,
      defaultTokens.map(({ token }) => ({ ...token, tag: token.tag.toLowerCase() })),
    );
    const blocked = new Set([...(options.blockedLocalMigrations ?? []), ...hazards.blocked]);
    result.blockedLocalMigrations = hazards.blocked;
    for (const use of hazards.uses) {
      warn(use.offset, { tag: use.tag, member: use.tag, code: use.warningCode, target: use.tag, message: use.message });
    }
    for (const { token, owner, bound } of defaultTokens) {
      const renamedAttributes = profile.data.renames.filter((entry) => entry.tag === owner && entry.kind === 'attribute');
      const missing = profile.defaultsFor(owner).filter((entry) => {
        const aliases = new Set([entry.attribute]);
        for (const rename of renamedAttributes) {
          if (rename.from === entry.attribute) aliases.add(rename.to);
          if (rename.to === entry.attribute) aliases.add(rename.from);
        }
        return ![...aliases].some((name) => bound.has(name));
      });
      if (!missing.length) continue;
      if (blocked.has(localMigrationKey(origin, owner))) {
        warn(token.nameStart, {
          tag: owner,
          member: owner,
          code: 'MAPPING_REVIEW_BLOCKED',
          target: owner,
          message:
            `${owner} did not receive its Lyra ${profile.fromMajor} defaults ` +
            `(${missing.map((entry) => `${entry.attribute}=${String(entry.value)}`).join(', ')}) because the scanned target set ` +
            'accesses it through a DOM alias or an opaque attribute spread. Add them by hand where the previous default matters.',
        });
        continue;
      }
      const insertions = [];
      for (const entry of missing) {
        insertions.push(serializeLocalDefault({ member: entry.attribute, value: entry.value }));
        result.changes.push(reportEntry({
          textStarts: starts,
          file,
          offset: token.end,
          origin,
          upstreamTag: owner,
          upstreamMember: entry.attribute,
          action: 'insert-default',
          target: `${entry.attribute}=${String(entry.value)}`,
          message: `Insert ${entry.attribute} to preserve the Lyra ${profile.fromMajor} default.`,
        }));
      }
      if (insertions.length) {
        const insertionOffset = original[token.end - 1] === '/' ? token.end - 1 : token.end;
        // `<lr-x a={b} />` gains `a={b} size="s" />`, not a doubled space before the slash.
        const replacement = /\s/.test(original[insertionOffset - 1])
          ? `${insertions.join(' ')} `
          : ` ${insertions.join(' ')}`;
        edits.push({ start: insertionOffset, end: insertionOffset, replacement });
      }
    }
  }

  // An acknowledgement that matches nothing is stale or malformed; report it so it cannot hide a
  // later report of a different kind. Entries withheld for an older installed release would make
  // their acknowledgements look stale, so that run skips the check.
  if (!profile.skipped.length) {
    for (const { offset, entry } of acknowledgements.unused()) {
      const key = `${offset}:${UNUSED_ACKNOWLEDGEMENT}:${entry.token}`;
      if (seenWarnings.has(key)) continue;
      seenWarnings.add(key);
      result.warnings.push(reportEntry({
        textStarts: starts,
        file,
        offset,
        origin,
        upstreamTag: null,
        upstreamMember: entry.token,
        action: 'manual-review',
        target: null,
        warningCode: UNUSED_ACKNOWLEDGEMENT,
        message: entry.code
          ? `The acknowledgement ${entry.token} matches no report on the lines it covers; remove it.`
          : `The acknowledgement ${entry.token} is not of the form CODE:name, for example DETAIL_SHAPE_REVIEW:lr-close.`,
      }));
    }
  }

  result.content = finalizeEdits(original, edits);
  sortReportEntries(result.changes, 'action');
  sortReportEntries(result.warnings, 'warningCode');
  return result;
}

/**
 * Finds `wa-*`/`sl-*` references in the four places `migrateText()` deliberately does not rewrite,
 * so they can at least be reported. See the call site for why each one is dangerous when silent.
 *
 * Scoped narrowly on purpose: every pattern here targets a context the tag rewriter provably skips
 * (CSS-in-JS template bodies, `::slotted()`, a selector string reached through a receiver, and
 * custom-property names), so a reference is never both rewritten and warned about.
 */
export function scanUnrewrittenUpstreamReferences(text) {
  const found = [];
  const seen = new Set();
  const push = (offset, upstreamTag, member, code, target, message) => {
    const key = `${offset}:${code}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ offset, upstreamTag, member, code, target, message });
  };
  const TAG = /(?<![\w-])(?<tag>(?:wa|sl)-[a-z][a-z0-9-]*)(?![\w-])/g;

  // 1. Tag selectors inside a `css` tagged template. Lit is this library's own idiom, so
  //    `static styles = css\`\`` is exactly where a migrating consumer's tag selectors live --
  //    "standalone CSS is in scope but CSS-in-JS is not" inverts the likelihood.
  for (const block of text.matchAll(/\bcss`/g)) {
    const bodyStart = block.index + block[0].length;
    const bodyEnd = text.indexOf('`', bodyStart);
    if (bodyEnd === -1) continue;
    const body = text.slice(bodyStart, bodyEnd);
    for (const match of body.matchAll(TAG)) {
      const tag = match.groups.tag;
      push(
        bodyStart + match.index,
        tag,
        'css-template',
        'CSS_IN_JS_SELECTOR_REVIEW',
        tag,
        `\`${tag}\` appears in a css\`\` template and was NOT rewritten. A rule keyed on a tag that no longer exists matches nothing, silently. Rename the selector by hand.`,
      );
    }
  }

  // 2. ::slotted(wa-*) anywhere, including standalone CSS.
  for (const match of text.matchAll(/::slotted\(\s*([^)]*)\)/g)) {
    for (const inner of match[1].matchAll(TAG)) {
      const tag = inner.groups.tag;
      push(
        match.index + match[0].indexOf(inner.groups.tag),
        tag,
        '::slotted',
        'SLOTTED_SELECTOR_REVIEW',
        tag,
        `\`::slotted(${tag})\` was NOT rewritten and will match nothing after the migration. Rename it by hand.`,
      );
    }
  }

  // 3. Selector strings reached through a `this`-rooted receiver. The rewriter anchors on a bare or
  //    `document.`-prefixed call, so `this.querySelectorAll('wa-option')` and
  //    `this.shadowRoot?.querySelector('wa-card')` -- the two commonest forms inside a component --
  //    slipped through and would start returning null.
  //
  //    Deliberately restricted to `this`, `this.shadowRoot` and `this.renderRoot` rather than any
  //    receiver. The rewriter refuses a SHADOWED `document`/`querySelector` binding on purpose (a
  //    local named `document` is provably not a DOM query), and warning there would be a false
  //    positive on correct code. `this` is the one receiver that can never be a local binding, so
  //    a query through it is always a real DOM query.
  const CALL = /\bthis(?:\s*\??\.\s*(?:shadowRoot|renderRoot))?\s*\??\.\s*(?:querySelector|querySelectorAll|closest|matches)\s*(?:<[^>\n]+>)?\(\s*(['"`])(?<selector>[^'"`]*)\1/g;
  for (const match of text.matchAll(CALL)) {
    const selectorOffset = match.index + match[0].lastIndexOf(match.groups.selector);
    for (const inner of match.groups.selector.matchAll(TAG)) {
      const tag = inner.groups.tag;
      push(
        selectorOffset + inner.index,
        tag,
        'selector-string',
        'SELECTOR_STRING_REVIEW',
        tag,
        `\`${tag}\` appears in a DOM selector string that was NOT rewritten. The query will return null after the migration rather than throwing. Rename it by hand.`,
      );
    }
  }

  // 4. Upstream custom properties. Never auto-rewritten -- see the call site.
  //    A name the file also DECLARES is the consumer's own property that merely happens to share
  //    the prefix, not an upstream token they are consuming; warning on it would be a false
  //    positive. Same "reads but never declares" discriminator check-manifest-coverage.mjs uses.
  const declaredHere = new Set(
    [...text.matchAll(/(--(?:wa|sl)-[a-z0-9-]+)\s*:/g)].map((match) => match[1]),
  );
  for (const match of text.matchAll(/--(?<ecosystem>wa|sl)-[a-z0-9-]+/g)) {
    const token = match[0];
    if (declaredHere.has(token)) continue;
    push(
      match.index,
      `${match.groups.ecosystem}-tokens`,
      'custom-property',
      'UPSTREAM_TOKEN_REVIEW',
      token,
      `\`${token}\` is an upstream design token with no automatic Lyra equivalent, and was left as-is. A var() naming a token that no longer exists falls back to its second argument, or to nothing -- silently. Map it by hand against llms/tokens.md; note the spacing scales are offset by one step, so renaming by name alone tightens every gap.`,
    );
  }

  return found;
}

export function migrateText(original, contract, options = {}) {
  if (options.origin && contract.renameProfiles?.has(options.origin)) return migrateRenameText(original, contract, options);
  if (options.origin) return migrateLocalText(original, contract, options);
  const file = options.file ?? '<memory>';
  const rewriteBarePackages = options.rewriteBarePackages ?? new Set();
  const rootRegistrationMappings = options.rootRegistrationMappings ?? new Map();
  const starts = lineStarts(original);
  const ignoredRanges = commentRanges(original);
  const htmlStyleRanges = htmlTemplateStyleRanges(original);
  const markupTokens = scanMarkupTags(original, ignoredRanges);
  const allOpeningTokens = scanAllOpeningTags(original, ignoredRanges);
  const apiReferences = scanApiTagReferences(original, ignoredRanges, options.domFactoryBindings);
  const aliasReviews = scanAliasedRewriteReviews(original, contract, ignoredRanges);
  const dynamicDefaultReviews = scanDynamicDefaultReviews(original, markupTokens, contract);
  const conditionalBehaviorReviews = scanConditionalBehaviorReviews(
    original,
    markupTokens,
    ignoredRanges,
    contract,
  );
  const imports = scanImports(original, ignoredRanges, contract);
  const bareImportPackages = new Set(
    imports.filter((imported) => imported.sideEffect && !imported.subpath).map((imported) => imported.packageName),
  );
  const blockedMappings = new Set([
    ...(options.blockedMappings ?? []),
    ...aliasReviews.keys(),
    ...dynamicDefaultReviews.keys(),
  ]);
  const imperativeDefaultReviews = apiReferences.flatMap((reference) => {
    if (reference.kind !== 'construction') return [];
    const mapping = contract.mappings.get(reference.tag);
    const defaults = mapping?.rewrites.defaults.filter((rule) => rule.action === 'insert-if-absent') ?? [];
    if (!mapping || !AUTO_CLASSIFICATIONS.has(mapping.classification) || defaults.length === 0) return [];
    const assessment = assessImperativeDefaults(original, reference, defaults);
    if (assessment.safe) return [];
    blockedMappings.add(mapping.upstreamTag);
    return [{ reference, mapping, defaults, missing: assessment.missing }];
  });
  const registrationBlockedMappings = new Set(options.registrationBlockedMappings ?? []);
  const blockedEcosystems = new Set(options.blockedEcosystems ?? []);
  for (const imported of imports) {
    if (imported.sideEffect) continue;
    const upstreamTag = imported.subpath
      ? deepImportTag(imported.specifier, imported.ecosystem)
      : null;
    const mapping = upstreamTag ? contract.mappings.get(upstreamTag) : null;
    if (mapping && AUTO_CLASSIFICATIONS.has(mapping.classification)) {
      blockedMappings.add(mapping.upstreamTag);
    } else if (!imported.subpath) {
      blockedEcosystems.add(imported.ecosystem);
    }
  }
  const edits = [];
  const changes = [];
  const warnings = [];
  const usage = {
    webawesome: { automatic: 0, manual: 0 },
    shoelace: { automatic: 0, manual: 0 },
  };
  const automaticMappings = new Set();
  const deepRegistrationMappings = new Set();
  const reportedOptionalPeers = new Set();

  const reportOrigin = (upstreamTag, origin) =>
    origin ?? (upstreamTag?.startsWith('wa-') ? 'webawesome' : upstreamTag?.startsWith('sl-') ? 'shoelace' : null);
  const change = (offset, upstreamTag, upstreamMember, action, target, message, origin = null) => {
    changes.push(reportEntry({
      textStarts: starts,
      file,
      offset,
      origin: reportOrigin(upstreamTag, origin),
      upstreamTag,
      upstreamMember,
      action,
      target,
      message,
    }));
  };
  const warn = (
    offset,
    upstreamTag,
    upstreamMember,
    code,
    target,
    message,
    origin = null,
    behaviorReviewFlags = null,
  ) => {
    warnings.push(
      reportEntry({
        textStarts: starts,
        file,
        offset,
        origin: reportOrigin(upstreamTag, origin),
        upstreamTag,
        upstreamMember,
        action: 'manual-review',
        target,
        warningCode: code,
        behaviorReviewFlags,
        message,
      }),
    );
  };
  const noteRuntimeRequirements = (mapping, offset) => {
    for (const peer of mapping.target?.optionalPeers ?? []) {
      const key = `${mapping.targetTag}:${peer}`;
      if (reportedOptionalPeers.has(key)) continue;
      reportedOptionalPeers.add(key);
      warn(
        offset,
        mapping.upstreamTag,
        'runtime',
        'OPTIONAL_PEER_REQUIRED',
        peer,
        `${mapping.targetTag} requires the optional peer package ${peer}; install a compatible version before relying on the migrated component.`,
      );
    }
  };
  const noteAutomatic = (mapping, offset) => {
    automaticMappings.add(mapping.upstreamTag);
    noteRuntimeRequirements(mapping, offset);
  };
  const addEdit = (start, end, replacement, details) => {
    edits.push({ start, end, replacement });
    change(
      start,
      details.upstreamTag,
      details.upstreamMember,
      details.action,
      details.target,
      details.message,
      details.origin,
    );
  };
  const isBlocked = (mapping) =>
    Boolean(mapping) &&
    (blockedMappings.has(mapping.upstreamTag) ||
      registrationBlockedMappings.has(mapping.upstreamTag) ||
      blockedEcosystems.has(mapping.upstream));
  const isBlockedAutomatic = (mapping) =>
    AUTO_CLASSIFICATIONS.has(mapping?.classification) && isBlocked(mapping);
  const isAutomatic = (mapping) =>
    AUTO_CLASSIFICATIONS.has(mapping?.classification) && !isBlocked(mapping);
  const blockedMessage = (mapping) => {
    if (registrationBlockedMappings.has(mapping.upstreamTag)) {
      return (
        `${mapping.upstreamTag} remains unchanged because the scanned target set does not prove ` +
        `registration for ${mapping.targetTag}. Include ${targetImport(mapping.target)} in the scan ` +
        'or migrate the file that owns its supported root registration import.'
      );
    }
    return `${mapping.upstreamTag} remains unchanged because the scanned target set contains a use that requires manual member, default, or import review.`;
  };
  const blockedWarningCode = (mapping) =>
    registrationBlockedMappings.has(mapping.upstreamTag)
      ? 'REGISTRATION_CLOSURE_REQUIRED'
      : 'MAPPING_REVIEW_BLOCKED';

  for (const { mapping, uses } of aliasReviews.values()) {
    for (const use of uses) {
      warn(
        use.offset,
        mapping.upstreamTag,
        use.upstreamMember,
        'ALIASED_MEMBER_REVIEW',
        use.target,
        use.message,
      );
    }
  }
  for (const { mapping, uses } of dynamicDefaultReviews.values()) {
    for (const use of uses) {
      warn(
        use.offset,
        mapping.upstreamTag,
        use.upstreamMember,
        'DYNAMIC_VALUE_REVIEW',
        use.target,
        use.message,
      );
    }
  }
  for (const { reference, mapping, defaults, missing } of imperativeDefaultReviews) {
    warn(
      reference.start,
      mapping.upstreamTag,
      null,
      'IMPERATIVE_DEFAULT_REVIEW',
      mapping.targetTag,
      `${mapping.upstreamTag} is constructed imperatively and requires explicit migrated defaults ` +
        `(${defaults.map((rule) => `${rule.member}=${String(rule.value)}`).join(', ')}); review the ` +
        `created element before renaming this mapping. No unconditional immediate assignment was ` +
        `proven for ${missing.map((rule) => rule.member).join(', ')}.`,
    );
  }

  const openingTokens = [];
  const manualOpeningTags = new Set();
  for (const token of markupTokens) {
    const mapping = contract.mappings.get(token.tag);
    const ecosystem = ecosystemForTag(token.tag);
    if (!isAutomatic(mapping)) {
      if (mapping) noteRuntimeRequirements(mapping, token.nameStart);
      if (token.closing && manualOpeningTags.has(token.tag)) continue;
      if (!token.closing) manualOpeningTags.add(token.tag);
      usage[ecosystem].manual += 1;
      warn(
        token.nameStart,
        token.tag,
        null,
        isBlockedAutomatic(mapping) ? blockedWarningCode(mapping) : warningCode(mapping),
        mapping?.targetTag ?? null,
        isBlockedAutomatic(mapping) ? blockedMessage(mapping) : mappingMessage(mapping),
        null,
        mapping?.parity?.behaviorReviewFlags,
      );
      continue;
    }
    usage[ecosystem].automatic += 1;
    noteAutomatic(mapping, token.nameStart);
    addEdit(token.nameStart, token.nameEnd, mapping.targetTag, {
      upstreamTag: token.tag,
      upstreamMember: null,
      action: 'rewrite-tag',
      target: mapping.targetTag,
      message: `Rename ${token.tag} to ${mapping.targetTag}.`,
    });
    const behaviorReview = conditionalBehaviorReviews.get(token.start);
    if (behaviorReview) {
      warn(
        token.nameStart,
        mapping.upstreamTag,
        null,
        'BEHAVIOR_REVIEW_REQUIRED',
        mapping.targetTag,
        behaviorReview.message,
        null,
        behaviorReview.flags,
      );
    }
    if (!token.closing && REDUCED_MOTION_REVIEW_TAGS.has(token.tag)) {
      warn(
        token.nameStart,
        mapping.upstreamTag,
        null,
        'BEHAVIOR_REVIEW_REQUIRED',
        mapping.targetTag,
        reducedMotionReviewMessage(mapping.upstreamTag),
        null,
        ['reduced-motion-default'],
      );
    }
    if (!token.closing && ICON_VOCABULARY_REVIEW_TAGS.has(token.tag)) {
      warn(
        token.nameStart,
        mapping.upstreamTag,
        null,
        'BEHAVIOR_REVIEW_REQUIRED',
        mapping.targetTag,
        iconVocabularyReviewMessage(mapping.upstreamTag),
        null,
        ['icon-name-vocabulary'],
      );
    }
    if (!token.closing) openingTokens.push({ token, mapping, attributes: parseTagAttributes(original, token) });
  }

  for (const reference of apiReferences) {
    const mapping = contract.mappings.get(reference.tag);
    const ecosystem = ecosystemForTag(reference.tag);
    if (!isAutomatic(mapping)) {
      if (mapping) noteRuntimeRequirements(mapping, reference.start);
      usage[ecosystem].manual += 1;
      warn(
        reference.start,
        reference.tag,
        null,
        isBlockedAutomatic(mapping) ? blockedWarningCode(mapping) : warningCode(mapping),
        mapping?.targetTag ?? null,
        isBlockedAutomatic(mapping) ? blockedMessage(mapping) : mappingMessage(mapping),
        null,
        mapping?.parity?.behaviorReviewFlags,
      );
      continue;
    }
    usage[ecosystem].automatic += 1;
    noteAutomatic(mapping, reference.start);
    addEdit(reference.start, reference.end, mapping.targetTag, {
      upstreamTag: reference.tag,
      upstreamMember: null,
      action: 'rewrite-tag',
      target: mapping.targetTag,
      message: `Rename ${reference.tag} to ${mapping.targetTag}.`,
    });
    if (REDUCED_MOTION_REVIEW_TAGS.has(reference.tag)) {
      warn(
        reference.start,
        mapping.upstreamTag,
        null,
        'BEHAVIOR_REVIEW_REQUIRED',
        mapping.targetTag,
        reducedMotionReviewMessage(mapping.upstreamTag),
        null,
        ['reduced-motion-default'],
      );
    }
    if (ICON_VOCABULARY_REVIEW_TAGS.has(reference.tag)) {
      warn(
        reference.start,
        mapping.upstreamTag,
        null,
        'BEHAVIOR_REVIEW_REQUIRED',
        mapping.targetTag,
        iconVocabularyReviewMessage(mapping.upstreamTag),
        null,
        ['icon-name-vocabulary'],
      );
    }
  }

  for (const { token, mapping, attributes } of openingTokens) {
    for (const attribute of attributes) {
      const rule = namedRule(attribute.rawName, mapping);
      if (!rule) continue;
      addEdit(attribute.nameStart, attribute.nameEnd, rule.replacement, {
        upstreamTag: mapping.upstreamTag,
        upstreamMember: rule.from,
        action: memberAction(rule.section),
        target: rule.to,
        message: `Rewrite ${rule.section} member ${rule.from} to ${rule.to}.`,
      });
    }

    const insertions = [];
    for (const rule of mapping.rewrites.defaults) {
      const variants = new Set([rule.member, kebabCase(rule.member), camelCase(rule.member)]);
      const attribute = attributes.find((entry) => variants.has(entry.rawName.replace(/^[.?:]/, '')));
      if (rule.action === 'insert-if-absent') {
        if (attribute) continue;
        insertions.push(`${kebabCase(rule.member)}="${String(rule.value).replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"`);
        change(
          token.end,
          mapping.upstreamTag,
          rule.member,
          'insert-default',
          `${rule.member}=${String(rule.value)}`,
          `Insert ${rule.member} to preserve the upstream default.`,
        );
        continue;
      }
      if (!attribute || attribute.valueKind === 'boolean') continue;
      if (isDynamicAttribute(attribute)) {
        usage[mapping.upstream].manual += 1;
        warn(
          attribute.valueStart,
          mapping.upstreamTag,
          rule.member,
          'DYNAMIC_VALUE_REVIEW',
          String(rule.to),
          `The ${rule.member} value is dynamic; replace ${String(rule.from)} with ${String(rule.to)} at its source.`,
        );
      } else if (attribute.value === String(rule.from)) {
        addEdit(attribute.valueStart, attribute.valueEnd, String(rule.to), {
          upstreamTag: mapping.upstreamTag,
          upstreamMember: rule.member,
          action: 'replace-default',
          target: String(rule.to),
          message: `Replace ${rule.member} value ${String(rule.from)} with ${String(rule.to)}.`,
        });
      }
    }
    if (insertions.length) {
      const insertionOffset = original[token.end - 1] === '/' ? token.end - 1 : token.end;
      edits.push({ start: insertionOffset, end: insertionOffset, replacement: ` ${insertions.join(' ')}` });
    }
  }

  // Pair matching upstream elements so named slot rewrites stay scoped to the component that owns
  // the slot instead of changing an unrelated `slot="..."` elsewhere in the file.
  const stack = [];
  const pairs = [];
  for (const token of markupTokens) {
    if (!token.closing && !token.selfClosing) stack.push(token);
    else if (token.closing) {
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        if (stack[index].tag !== token.tag) continue;
        const [opening] = stack.splice(index, 1);
        pairs.push({ opening, closing: token });
        break;
      }
    }
  }
  for (const { opening, closing } of pairs) {
    const mapping = contract.mappings.get(opening.tag);
    if (!isAutomatic(mapping) || !mapping.rewrites.slots.length) continue;
    for (const descendant of allOpeningTokens) {
      if (descendant.start <= opening.end || descendant.end >= closing.start) continue;
      for (const attribute of parseTagAttributes(original, descendant)) {
        if (attribute.rawName === 'slot' && attribute.valueKind === 'literal') {
          const rule = mapping.rewrites.slots.find((entry) => entry.from === attribute.value);
          if (rule) {
            addEdit(attribute.valueStart, attribute.valueEnd, rule.to, {
              upstreamTag: mapping.upstreamTag,
              upstreamMember: rule.from,
              action: 'rewrite-slot',
              target: rule.to,
              message: `Rewrite slot ${rule.from} to ${rule.to}.`,
            });
          }
        } else {
          const prefix = attribute.rawName.startsWith('v-slot:') ? 'v-slot:' : attribute.rawName.startsWith('#') ? '#' : null;
          if (!prefix) continue;
          const name = attribute.rawName.slice(prefix.length);
          const rule = mapping.rewrites.slots.find((entry) => entry.from === name);
          if (rule) {
            addEdit(attribute.nameStart, attribute.nameEnd, `${prefix}${rule.to}`, {
              upstreamTag: mapping.upstreamTag,
              upstreamMember: rule.from,
              action: 'rewrite-slot',
              target: rule.to,
              message: `Rewrite slot ${rule.from} to ${rule.to}.`,
            });
          }
        }
      }
    }
  }

  // CSS changes are limited to rules whose selector names the mapped upstream component.
  const cssRule = /(?<selector>[^{}]+)\{(?<body>[^{}]*)\}/g;
  for (const match of original.matchAll(cssRule)) {
    if (insideRanges(match.index, ignoredRanges)) continue;
    const selectorStart = match.index;
    const bodyStart = match.index + match[0].indexOf(match.groups.body);
    for (const mapping of contract.mappings.values()) {
      const tagPattern = new RegExp(`(?<![a-z0-9-])${mapping.upstreamTag}(?![a-z0-9-])`, 'g');
      const selectorMatches = [...match.groups.selector.matchAll(tagPattern)].filter(
        (tagMatch) => {
          const offset = selectorStart + tagMatch.index;
          if (insideRanges(offset, ignoredRanges)) return false;
          const quoted = quotedRangeContaining(original, offset);
          if (!quoted) return true;
          return insideRanges(offset, htmlStyleRanges)
            && !insideTemplateExpression(original, quoted[0], offset);
        },
      );
      if (!selectorMatches.length) continue;
      if (!isAutomatic(mapping)) {
        usage[mapping.upstream].manual += selectorMatches.length;
        for (const tagMatch of selectorMatches) {
          const offset = selectorStart + tagMatch.index;
          noteRuntimeRequirements(mapping, offset);
          warn(
            offset,
            mapping.upstreamTag,
            null,
            isBlockedAutomatic(mapping) ? blockedWarningCode(mapping) : warningCode(mapping),
            mapping.targetTag,
            isBlockedAutomatic(mapping) ? blockedMessage(mapping) : mappingMessage(mapping),
            null,
            mapping?.parity?.behaviorReviewFlags,
          );
        }
        continue;
      }
      for (const tagMatch of selectorMatches) {
        const offset = selectorStart + tagMatch.index;
        noteAutomatic(mapping, offset);
        if (mapping.upstreamTag === 'wa-random-content') {
          const flags = ['host-layout', 'multi-item-layout'];
          warn(
            offset,
            mapping.upstreamTag,
            'selector',
            'BEHAVIOR_REVIEW_REQUIRED',
            mapping.targetTag,
            'Review this selector after migration: Web Awesome lays candidates out through the host, while Lyra uses a block host and owns simultaneous-item flex layout inside its shadow base.',
            null,
            flags,
          );
        }
        addEdit(offset, offset + mapping.upstreamTag.length, mapping.targetTag, {
          upstreamTag: mapping.upstreamTag,
          upstreamMember: null,
          action: 'rewrite-tag',
          target: mapping.targetTag,
          message: `Rename ${mapping.upstreamTag} selector to ${mapping.targetTag}.`,
        });
      }
      for (const rule of mapping.rewrites.parts) {
        const pattern = new RegExp(`(?<=::part\\()${rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\))`, 'g');
        for (const partMatch of match.groups.selector.matchAll(pattern)) {
          const offset = selectorStart + partMatch.index;
          if (insideRanges(offset, ignoredRanges)) continue;
          addEdit(offset, offset + rule.from.length, rule.to, {
            upstreamTag: mapping.upstreamTag,
            upstreamMember: rule.from,
            action: 'rewrite-part',
            target: rule.to,
            message: `Rewrite CSS part ${rule.from} to ${rule.to}.`,
          });
        }
      }
      for (const rule of mapping.rewrites.cssProperties) {
        const pattern = new RegExp(`${rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9-])`, 'g');
        for (const propertyMatch of match.groups.body.matchAll(pattern)) {
          const offset = bodyStart + propertyMatch.index;
          if (insideRanges(offset, ignoredRanges)) continue;
          addEdit(offset, offset + rule.from.length, rule.to, {
            upstreamTag: mapping.upstreamTag,
            upstreamMember: rule.from,
            action: 'rewrite-css-property',
            target: rule.to,
            message: `Rewrite CSS custom property ${rule.from} to ${rule.to}.`,
          });
        }
      }
    }
  }

  // Method/property/event changes in scripts require an exact querySelector(tag) ownership anchor.
  // Aliased values are deliberately left alone: without data-flow analysis their component type is
  // not knowable, and an over-broad member rename is worse than a visible manual action.
  for (const mapping of contract.mappings.values()) {
    if (!isAutomatic(mapping)) continue;
    const tag = mapping.upstreamTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const owner = `(?:document\\.)?querySelector(?:<[^>\\n]+>)?\\(\\s*(['"])${tag}\\1\\s*\\)`;
    for (const [section, suffix] of [
      ['methods', '(?=\\s*\\()'],
      ['properties', '(?=\\s*(?:=|\\.|\\?|;|$))'],
    ]) {
      for (const rule of mapping.rewrites[section]) {
        const escaped = rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`${owner}\\s*(?:\\?\\.|!\\s*\\.|\\.)\\s*(?<member>${escaped})${suffix}`, 'g');
        for (const memberMatch of original.matchAll(regex)) {
          if (insideRanges(memberMatch.index, ignoredRanges)) continue;
          const relative = memberMatch[0].lastIndexOf(memberMatch.groups.member);
          const offset = memberMatch.index + relative;
          addEdit(offset, offset + rule.from.length, rule.to, {
            upstreamTag: mapping.upstreamTag,
            upstreamMember: rule.from,
            action: memberAction(section),
            target: rule.to,
            message: `Rewrite ${section} member ${rule.from} to ${rule.to}.`,
          });
        }
      }
    }
    for (const rule of mapping.rewrites.events) {
      const escaped = rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`${owner}\\s*(?:\\?\\.|!\\s*\\.|\\.)\\s*(?:add|remove)EventListener\\(\\s*(['"])(?<member>${escaped})\\2`, 'g');
      for (const eventMatch of original.matchAll(regex)) {
        if (insideRanges(eventMatch.index, ignoredRanges)) continue;
        const relative = eventMatch[0].lastIndexOf(eventMatch.groups.member);
        const offset = eventMatch.index + relative;
        addEdit(offset, offset + rule.from.length, rule.to, {
          upstreamTag: mapping.upstreamTag,
          upstreamMember: rule.from,
          action: 'rewrite-event',
          target: rule.to,
          message: `Rewrite event ${rule.from} to ${rule.to}.`,
        });
      }
    }
  }

  for (const imported of imports) {
    const { ecosystem } = imported;
    if (!imported.sideEffect) {
      usage[ecosystem].manual += 1;
      warn(
        imported.start,
        imported.subpath ? deepImportTag(imported.specifier, ecosystem) : null,
        'module',
        'IMPORT_BINDING_REVIEW_REQUIRED',
        null,
        `The ${imported.kind} import has runtime/type bindings whose exported names cannot be inferred safely.`,
        ecosystem,
      );
      continue;
    }
    if (!imported.subpath) {
      const canRewrite = rewriteBarePackages.has(ecosystem) || rewriteBarePackages.has(imported.packageName);
      const registeredMappings =
        rootRegistrationMappings.get(imported.packageName) ?? rootRegistrationMappings.get(ecosystem) ?? new Set();
      const closure = registrationClosure(contract, registeredMappings);
      if (canRewrite && closure.length > 0) {
        addEdit(imported.start, imported.end, closure[0], {
          upstreamTag: null,
          origin: ecosystem,
          upstreamMember: 'module',
          action: 'rewrite-import',
          target: closure[0],
          message: `Rewrite ${imported.packageName} root registration import to its proven Lyra registration closure.`,
        });
        const lineEnding = original.includes('\r\n') ? '\r\n' : '\n';
        for (const specifier of closure.slice(1)) {
          edits.push({
            start: imported.statementEnd,
            end: imported.statementEnd,
            replacement: `${lineEnding}import ${imported.quote}${specifier}${imported.quote};`,
          });
          change(
            imported.start,
            null,
            'module',
            'insert-registration',
            specifier,
            `Insert granular registration for a root-excluded Lyra target.`,
            ecosystem,
          );
        }
      } else {
        warn(
          imported.start,
          null,
          'module',
          'PACKAGE_IMPORT_BLOCKED',
          '@aceshooting/lyra-ui/all.js',
          `The ${ecosystem} package import remains because this scan contains manual uses or no proven registration closure.`,
          ecosystem,
        );
      }
      continue;
    }

    const upstreamTag = deepImportTag(imported.specifier, ecosystem);
    const mapping = upstreamTag ? contract.mappings.get(upstreamTag) : null;
    if (mapping && !packageProvidesMapping(imported, mapping)) {
      usage[ecosystem].manual += 1;
      noteRuntimeRequirements(mapping, imported.start);
      warn(
        imported.start,
        upstreamTag,
        'module',
        'PACKAGE_TIER_MISMATCH',
        mapping.targetTag,
        `${imported.packageName} does not provide the ${mapping.source.tier} ${upstreamTag} registration entry; use a package identity that provides that tier before migrating it.`,
        ecosystem,
      );
      continue;
    }
    if (!upstreamTag || !isAutomatic(mapping)) {
      usage[ecosystem].manual += 1;
      if (mapping) noteRuntimeRequirements(mapping, imported.start);
      warn(
        imported.start,
        upstreamTag,
        'module',
        isBlockedAutomatic(mapping)
          ? blockedWarningCode(mapping)
          : mapping
            ? warningCode(mapping)
            : 'UNRESOLVED_DEEP_IMPORT',
        mapping?.targetTag ?? null,
        isBlockedAutomatic(mapping)
          ? blockedMessage(mapping)
          : upstreamTag
            ? mappingMessage(mapping)
            : `No component registration entry can be derived from ${imported.specifier}.`,
        ecosystem,
        mapping?.parity?.behaviorReviewFlags,
      );
      continue;
    }
    usage[ecosystem].automatic += 1;
    noteAutomatic(mapping, imported.start);
    deepRegistrationMappings.add(mapping.upstreamTag);
    const target = targetImport(mapping.target);
    addEdit(imported.start, imported.end, target, {
      upstreamTag,
      upstreamMember: 'module',
      action: 'rewrite-import',
      target,
      message: `Rewrite the ${upstreamTag} registration entry to its inventory module.`,
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Reference classes this codemod does NOT rewrite. Each one fails SILENTLY at runtime after a
  // migration: a CSS rule keyed on a tag that no longer exists simply matches nothing, ::slotted()
  // likewise, querySelector returns null, and a var() naming a removed token falls back to whatever
  // literal is in its second argument -- or to nothing. None of it throws, none of it fails a build,
  // and a typechecker cannot see inside a template literal. Leaving them unwarned meant `--check`
  // reported a clean migration over visibly broken styling, which is the actual defect: the tool is
  // documented as a CI gate, so silence there is certification.
  //
  // These are warnings, never rewrites. For tokens that is a deliberate refusal rather than
  // laziness: the two spacing scales are offset by one step (Web Awesome `m` is 1rem, Lyra `m` is
  // 0.75rem), so a blind --wa-X -> --lr-X rename silently tightens every gap, while mapping by
  // value has no target for 1.5rem or 2.5rem. Naming each occurrence is worth more than a guess.
  //
  // Filtered against the rewrite ranges this pass actually produced, so a reference the inventory
  // DOES map (a `--wa-old-color` with a declared `--lr-*` target, say) is never both rewritten and
  // warned about. Deriving that from the edits rather than from a second copy of the inventory
  // keeps it correct for free as the inventory grows.
  const rewrittenRanges = edits.map((edit) => [edit.start, edit.end]);
  const wasRewritten = (offset) =>
    rewrittenRanges.some(([start, end]) => offset >= start && offset < end);
  for (const scan of scanUnrewrittenUpstreamReferences(original)) {
    if (wasRewritten(scan.offset)) continue;
    warn(
      scan.offset,
      scan.upstreamTag,
      scan.member,
      scan.code,
      scan.target,
      scan.message,
    );
  }

  const content = finalizeEdits(original, edits);
  changes.sort((left, right) => left.line - right.line || left.column - right.column || left.action.localeCompare(right.action));
  warnings.sort((left, right) => left.line - right.line || left.column - right.column || left.warningCode.localeCompare(right.warningCode));
  return {
    content,
    changes,
    warnings,
    usage,
    blockedMappings,
    blockedEcosystems,
    bareImportPackages,
    automaticMappings,
    deepRegistrationMappings,
  };
}

// ---------------------------------------------------------------------------------------------
// Unified diff output for `--diff`.
// ---------------------------------------------------------------------------------------------

function diffLines(text) {
  const lines = text.split('\n');
  const eol = lines.at(-1) === '';
  if (eol) lines.pop();
  // The final line's terminator is part of its identity, so adding or removing the newline at the
  // end of a file is a change rather than an invisible no-op.
  return lines.map((line, index) => {
    const terminated = index < lines.length - 1 || eol;
    return { line, eol: terminated, key: terminated ? line : `${line}\u0000` };
  });
}

/**
 * Myers' O(ND) line diff. Each step's frontier holds only the diagonals that step can reach, so
 * the retained trace is O(D^2) in the number of changed lines rather than O(D * file length).
 */
function diffOperations(before, after) {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix].key === after[prefix].key) prefix += 1;
  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before[before.length - 1 - suffix].key === after[after.length - 1 - suffix].key
  ) {
    suffix += 1;
  }
  const a = before.slice(prefix, before.length - suffix);
  const b = after.slice(prefix, after.length - suffix);
  const goesDown = (frontier, diagonal, depth) =>
    diagonal === -depth || (diagonal !== depth && frontier.get(diagonal - 1) < frontier.get(diagonal + 1));

  const trace = [];
  let frontier = new Map([[1, 0]]);
  search: for (let depth = 0; depth <= a.length + b.length; depth += 1) {
    trace.push(frontier);
    const next = new Map();
    for (let diagonal = -depth; diagonal <= depth; diagonal += 2) {
      let x = goesDown(frontier, diagonal, depth) ? frontier.get(diagonal + 1) : frontier.get(diagonal - 1) + 1;
      let y = x - diagonal;
      while (x < a.length && y < b.length && a[x].key === b[y].key) {
        x += 1;
        y += 1;
      }
      next.set(diagonal, x);
      if (x >= a.length && y >= b.length) break search;
    }
    frontier = next;
  }

  const middle = [];
  let x = a.length;
  let y = b.length;
  for (let depth = trace.length - 1; depth >= 0; depth -= 1) {
    const previous = trace[depth];
    const diagonal = x - y;
    const previousDiagonal = goesDown(previous, diagonal, depth) ? diagonal + 1 : diagonal - 1;
    const previousX = previous.get(previousDiagonal);
    const previousY = previousX - previousDiagonal;
    while (x > previousX && y > previousY) {
      x -= 1;
      y -= 1;
      middle.push({ type: ' ', before: prefix + x, after: prefix + y });
    }
    if (depth > 0) {
      if (x === previousX) middle.push({ type: '+', after: prefix + y - 1 });
      else middle.push({ type: '-', before: prefix + x - 1 });
    }
    x = previousX;
    y = previousY;
  }
  middle.reverse();
  const operations = [];
  for (let index = 0; index < prefix; index += 1) operations.push({ type: ' ', before: index, after: index });
  operations.push(...middle);
  for (let index = suffix; index > 0; index -= 1) {
    operations.push({ type: ' ', before: before.length - index, after: after.length - index });
  }
  return operations;
}

function quoteDiffPath(file) {
  if (/^[\x21-\x7e]+$/.test(file) && !/["\\]/.test(file)) return file;
  // Git's quoted paths use byte-wise C escapes, including octal UTF-8 bytes.
  let quoted = '"';
  for (const byte of Buffer.from(file, 'utf8')) {
    if (byte === 0x22 || byte === 0x5c) quoted += `\\${String.fromCharCode(byte)}`;
    else if (byte >= 0x20 && byte <= 0x7e) quoted += String.fromCharCode(byte);
    else quoted += `\\${byte.toString(8).padStart(3, '0')}`;
  }
  return `${quoted}"`;
}

/** A `git apply`-compatible unified diff of one file, with three lines of context. */
export function unifiedDiff(file, original, content, context = 3) {
  if (original === content) return '';
  const before = diffLines(original);
  const after = diffLines(content);
  const operations = diffOperations(before, after);
  const beforeSeen = [0];
  const afterSeen = [0];
  for (const operation of operations) {
    beforeSeen.push(beforeSeen.at(-1) + (operation.type === '+' ? 0 : 1));
    afterSeen.push(afterSeen.at(-1) + (operation.type === '-' ? 0 : 1));
  }
  const hunks = [];
  operations.forEach((operation, index) => {
    if (operation.type === ' ') return;
    const last = hunks.at(-1);
    if (last && index - last.end <= context * 2 + 1) last.end = index;
    else hunks.push({ start: index, end: index });
  });
  const output = [`--- ${quoteDiffPath(`a/${file}`)}\n`, `+++ ${quoteDiffPath(`b/${file}`)}\n`];
  for (const hunk of hunks) {
    const start = Math.max(0, hunk.start - context);
    const end = Math.min(operations.length, hunk.end + context + 1);
    const beforeCount = beforeSeen[end] - beforeSeen[start];
    const afterCount = afterSeen[end] - afterSeen[start];
    const beforeStart = beforeSeen[start] + (beforeCount ? 1 : 0);
    const afterStart = afterSeen[start] + (afterCount ? 1 : 0);
    output.push(`@@ -${beforeStart},${beforeCount} +${afterStart},${afterCount} @@\n`);
    for (const operation of operations.slice(start, end)) {
      const record = operation.type === '+' ? after[operation.after] : before[operation.before];
      output.push(`${operation.type}${record.line}\n`);
      if (!record.eol) output.push('\\ No newline at end of file\n');
    }
  }
  return output.join('');
}

function reportPathName(file, cwd) {
  return (path.relative(cwd, file) || path.basename(file)).split(path.sep).join('/');
}

/**
 * Migrates `files` in place (unless `dryRun`) and returns the stable JSON report. `renameLedger`
 * is the authored ledger for a repository inventory; `lyraVersion` is the installed
 * @aceshooting/lyra-ui version, when known. With `collectDiff`, the returned object also carries a
 * unified `diff` of every changed file; the written report never includes it.
 */
export function migrateFiles({
  files,
  inventory,
  dryRun = false,
  reportPath = null,
  cwd = process.cwd(),
  origin = null,
  renameLedger = null,
  lyraVersion = null,
  collectDiff = false,
}) {
  if (collectDiff) {
    // `git apply` rejects `a/../x`, so a patch is only produced for files below the working
    // directory, whose relative paths it can apply (with --directory from a repository root).
    const outside = files.filter((file) => {
      const relative = path.relative(cwd, file);
      return relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
    });
    if (outside.length) {
      throw new Error(`--diff needs every target inside the working directory; run it from a common parent of ${outside.join(', ')}.`);
    }
  }
  const contract = buildMigrationContract(inventory, { renameLedger, lyraVersion });
  const originals = new Map(files.map((file) => [file, fs.readFileSync(file, 'utf8')]));
  const diffs = [];
  const noteDiff = (file, original, content) => {
    if (collectDiff && content !== original) diffs.push(unifiedDiff(reportPathName(file, cwd), original, content));
  };
  const finish = (report) => {
    if (reportPath) fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return collectDiff ? { ...report, diff: diffs.join('') } : report;
  };
  if (origin !== null) {
    const renameProfile = contract.renameProfiles.has(origin);
    invariant(
      contract.localMigrations.has(origin) || renameProfile,
      `unknown local migration origin ${String(origin)}`,
    );
    const blockedLocalMigrations = new Set();
    const constructedEvents = new Set();
    for (const [file, original] of originals) {
      const analysis = migrateText(original, contract, {
        file: reportPathName(file, cwd),
        origin,
      });
      for (const key of analysis.blockedLocalMigrations) blockedLocalMigrations.add(key);
      for (const name of analysis.constructedEvents ?? []) constructedEvents.add(name);
    }

    const changes = [];
    const warnings = [];
    let filesChanged = 0;
    let acknowledged = 0;
    for (const [file, original] of originals) {
      const result = migrateText(original, contract, {
        file: reportPathName(file, cwd),
        origin,
        blockedLocalMigrations,
        constructedEvents,
      });
      changes.push(...result.changes);
      warnings.push(...result.warnings);
      acknowledged += result.acknowledged ?? 0;
      if (result.content !== original) {
        filesChanged += 1;
        noteDiff(file, original, result.content);
        if (!dryRun) fs.writeFileSync(file, result.content, 'utf8');
      }
    }
    const sortEntries = (entries) => entries.sort((left, right) =>
      left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column ||
      left.action.localeCompare(right.action));
    sortEntries(changes);
    sortEntries(warnings);
    const summary = { rewrites: changes.length, warnings: warnings.length };
    if (renameProfile) {
      summary.acknowledged = acknowledged;
      if (lyraVersion !== null) summary.skipped = contract.renameProfiles.get(origin).skipped.length;
    }
    return finish({
      schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION,
      origin,
      dryRun,
      filesScanned: files.length,
      filesChanged,
      changes,
      warnings,
      summary,
    });
  }
  const domFactoryBindings = buildProjectDomFactoryBindings(originals);
  const blockedMappings = new Set();
  const blockedEcosystems = new Set();
  const bareImportPackages = new Set();
  const automaticMappings = new Set();
  const deepRegistrationMappings = new Set();
  const usage = {
    webawesome: { automatic: 0, manual: 0 },
    shoelace: { automatic: 0, manual: 0 },
  };
  for (const [file, original] of originals) {
    const analysis = migrateText(original, contract, {
      file: reportPathName(file, cwd),
      rewriteBarePackages: new Set(),
      domFactoryBindings: domFactoryBindings.get(path.resolve(file)),
    });
    for (const ecosystem of Object.keys(usage)) {
      usage[ecosystem].automatic += analysis.usage[ecosystem].automatic;
      usage[ecosystem].manual += analysis.usage[ecosystem].manual;
    }
    for (const upstreamTag of analysis.blockedMappings) blockedMappings.add(upstreamTag);
    for (const ecosystem of analysis.blockedEcosystems) blockedEcosystems.add(ecosystem);
    for (const packageName of analysis.bareImportPackages) bareImportPackages.add(packageName);
    for (const upstreamTag of analysis.automaticMappings) automaticMappings.add(upstreamTag);
    for (const upstreamTag of analysis.deepRegistrationMappings) deepRegistrationMappings.add(upstreamTag);
  }
  for (const packageName of bareImportPackages) {
    const identity = contract.packageIdentities.get(packageName);
    if (identity && usage[identity.ecosystem].manual > 0) blockedEcosystems.add(identity.ecosystem);
  }
  const rewriteBarePackages = new Set(
    [...bareImportPackages].filter((packageName) => {
      const identity = contract.packageIdentities.get(packageName);
      if (!identity) return false;
      const counts = usage[identity.ecosystem];
      return counts.automatic > 0 && counts.manual === 0 && !blockedEcosystems.has(identity.ecosystem);
    }),
  );
  const rootRegistrationMappings = new Map(
    [...bareImportPackages].map((packageName) => {
      const identity = contract.packageIdentities.get(packageName);
      const relevant = new Set(
        [...automaticMappings].filter((upstreamTag) => {
          const mapping = contract.mappings.get(upstreamTag);
          return Boolean(
            identity &&
            mapping?.upstream === identity.ecosystem &&
            (!mapping.source?.tier || identity.tiers.has(mapping.source.tier)),
          );
        }),
      );
      return [packageName, relevant];
    }),
  );
  const provenRegistrationMappings = new Set(deepRegistrationMappings);
  for (const packageName of rewriteBarePackages) {
    for (const upstreamTag of rootRegistrationMappings.get(packageName) ?? []) {
      provenRegistrationMappings.add(upstreamTag);
    }
  }
  const registrationBlockedMappings = new Set(
    [...automaticMappings].filter((upstreamTag) => !provenRegistrationMappings.has(upstreamTag)),
  );

  const changes = [];
  const warnings = [];
  let filesChanged = 0;
  for (const [file, original] of originals) {
    const result = migrateText(original, contract, {
      file: reportPathName(file, cwd),
      rewriteBarePackages,
      rootRegistrationMappings,
      blockedMappings,
      blockedEcosystems,
      registrationBlockedMappings,
      domFactoryBindings: domFactoryBindings.get(path.resolve(file)),
    });
    changes.push(...result.changes);
    warnings.push(...result.warnings);
    if (result.content !== original) {
      filesChanged += 1;
      noteDiff(file, original, result.content);
      if (!dryRun) fs.writeFileSync(file, result.content, 'utf8');
    }
  }
  const sortEntries = (entries) => entries.sort((left, right) =>
    left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column ||
    left.action.localeCompare(right.action));
  sortEntries(changes);
  sortEntries(warnings);
  return finish({
    schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION,
    origin: null,
    dryRun,
    filesScanned: files.length,
    filesChanged,
    changes,
    warnings,
    summary: {
      rewrites: changes.length,
      warnings: warnings.length,
    },
  });
}

export function parseArgs(argv) {
  const options = {
    check: false,
    diff: false,
    dryRun: false,
    help: false,
    extensions: DEFAULT_EXTENSIONS,
    lyraVersion: null,
    origin: null,
    report: null,
    targets: [],
  };
  let positional = false;
  for (const argument of argv) {
    if (!positional && argument === '--') {
      positional = true;
    } else if (!positional && (argument === '--dry-run' || argument === '-n')) {
      options.dryRun = true;
    } else if (!positional && argument === '--check') {
      options.check = true;
      options.dryRun = true;
    } else if (!positional && argument === '--diff') {
      options.diff = true;
      options.dryRun = true;
    } else if (!positional && (argument === '--help' || argument === '-h')) {
      options.help = true;
    } else if (!positional && argument.startsWith('--ext=')) {
      options.extensions = new Set(
        argument
          .slice('--ext='.length)
          .split(',')
          .map((extension) => extension.trim().replace(/^\./, '').toLowerCase())
          .filter(Boolean),
      );
    } else if (!positional && argument.startsWith('--report=')) {
      options.report = argument.slice('--report='.length);
      if (!options.report) throw new Error('--report requires a path');
    } else if (!positional && argument.startsWith('--lyra-version=')) {
      options.lyraVersion = argument.slice('--lyra-version='.length);
      if (compareVersions(options.lyraVersion, options.lyraVersion) !== 0) {
        throw new Error(`--lyra-version needs a version such as 22.0.0, got ${options.lyraVersion || 'nothing'}`);
      }
    } else if (!positional && argument.startsWith('--origin=')) {
      options.origin = argument.slice('--origin='.length);
      if (!options.origin) throw new Error('--origin requires a value');
      if (!MIGRATION_ORIGINS.includes(options.origin)) {
        throw new Error(`Unknown migration origin: ${options.origin}`);
      }
    } else if (!positional && argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      options.targets.push(argument);
    }
  }
  return options;
}

function printUsage() {
  console.log(`Usage: lyra-ui-migrate [--check] [--dry-run] [--diff] [--origin=${MIGRATION_ORIGINS.join('|')}] [--lyra-version=x.y.z] [--report=path] [--ext=html,ts,...] targets...

Only exact and fully rewritten inventory mappings change automatically. Conceptual, unsafe,
unsupported, unknown, and unresolved deep-import uses remain unchanged with source-located
warnings. The optional JSON report has a stable schema for CI and review tooling.

Without --origin, only Web Awesome and Shoelace migrations run. --origin=lyra-v7 performs the
opt-in Lyra defaults migration. --origin=lyra-v21 migrates deprecated Lyra 21 member names
(attributes, properties, events, parts, custom properties and slots) where the rewrite cannot
change what a site reaches, preserves changed defaults, and reports everything else, including
listeners of events whose detail changed. Neither profile rewrites tags or imports. Run a Lyra
profile with the CLI of the installed release, after upgrading.

  --dry-run, -n        report changes without writing source files
  --check              exit nonzero when rewrites or warnings remain; never write source files
  --diff               print a unified diff of the changes instead of writing source files
  --origin=lyra-v7     insert explicit attributes that preserve changed Lyra v7 defaults
  --origin=lyra-v21    migrate names and defaults that change from Lyra 21 to Lyra 22
  --lyra-version=x.y.z apply only rename entries available in this release (default: the
                       @aceshooting/lyra-ui installed under the working directory, when found)
  --report=path        write the stable JSON migration report
  --ext=a,b,c          extensions scanned for directory targets
  --help, -h           show this message

A reviewed rename-profile warning is acknowledged by a "lyra-migrate-reviewed: CODE:name" comment
(for example DETAIL_SHAPE_REVIEW:lr-close) on the reported line, alone on the line above it, or
directly before the reported element's opening tag.`);
}

/** The version of the @aceshooting/lyra-ui installed at or above `directory`, or null. */
export function detectInstalledLyraVersion(directory = process.cwd()) {
  let current = path.resolve(directory);
  for (;;) {
    const manifest = path.join(current, 'node_modules', '@aceshooting', 'lyra-ui', 'package.json');
    if (fs.existsSync(manifest)) {
      try {
        const version = JSON.parse(fs.readFileSync(manifest, 'utf8')).version;
        return compareVersions(version, version) === 0 ? version : null;
      } catch {
        return null;
      }
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function walkDir(directory, filter) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIR_NAMES.has(entry.name)) files.push(...walkDir(target, filter));
    } else if (entry.isFile() && filter(target, entry.name)) files.push(target);
  }
  return files;
}

function globToRegExp(segments) {
  let source = '^';
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === '**') source += '(?:.*/)?';
    else {
      source += segment
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]');
      if (index < segments.length - 1) source += '/';
    }
  }
  return new RegExp(`${source}$`);
}

function expandGlob(pattern) {
  const segments = pattern.split(path.sep).join('/').split('/');
  let split = 0;
  while (split < segments.length && !/[*?]/.test(segments[split])) split += 1;
  const base = path.resolve(segments.slice(0, split).join('/') || '.');
  if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) return [];
  const regex = globToRegExp(segments.slice(split));
  return walkDir(base, () => true).filter((file) => regex.test(path.relative(base, file).split(path.sep).join('/')));
}

export function collectFiles(targets, extensions) {
  const files = new Set();
  for (const target of targets) {
    if (/[*?]/.test(target)) {
      for (const file of expandGlob(target)) files.add(file);
      continue;
    }
    const resolved = path.resolve(target);
    if (!fs.existsSync(resolved)) {
      console.error(`warning: path not found, skipping: ${target}`);
      continue;
    }
    if (fs.statSync(resolved).isDirectory()) {
      for (const file of walkDir(resolved, (_file, name) => extensions.has(path.extname(name).slice(1).toLowerCase()))) {
        files.add(file);
      }
    } else files.add(resolved);
  }
  return [...files].sort();
}

export function run(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
  if (options.help || !options.targets.length) {
    printUsage();
    return options.help ? 0 : 1;
  }
  const files = collectFiles(options.targets, options.extensions);
  if (!files.length) {
    console.error('No files matched the given path(s)/pattern(s).');
    return 1;
  }
  try {
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
    const renameOrigin = LYRA_RENAME_ORIGINS.includes(options.origin);
    const lyraVersion = renameOrigin ? options.lyraVersion ?? detectInstalledLyraVersion() : null;
    const report = migrateFiles({
      files,
      inventory,
      dryRun: options.dryRun,
      origin: options.origin,
      renameLedger: packagedRuntime ? null : readRenameLedger(),
      lyraVersion,
      reportPath: options.report ? path.resolve(options.report) : null,
      collectDiff: options.diff,
    });
    // With --diff, stdout carries only the patch so it can be redirected into a file or `git apply`.
    const log = options.diff ? console.error : console.log;
    if (options.diff) process.stdout.write(report.diff);
    if (renameOrigin) {
      log(
        lyraVersion === null
          ? 'No installed @aceshooting/lyra-ui found under the working directory; applying every entry of the profile.'
          : `Applying entries available in @aceshooting/lyra-ui ${lyraVersion}` +
            (report.summary.skipped ? `; ${report.summary.skipped} entr${report.summary.skipped === 1 ? 'y needs' : 'ies need'} a later release.` : '.'),
      );
    }
    for (const entry of report.changes) {
      log(`${entry.file}:${entry.line}:${entry.column}  ${entry.action}: ${entry.message}`);
    }
    for (const entry of report.warnings) {
      log(`${entry.file}:${entry.line}:${entry.column}  warning ${entry.warningCode}: ${entry.message}`);
    }
    log(
      `${report.filesScanned} file(s) scanned, ${report.filesChanged} changed, ` +
        `${report.summary.rewrites} rewrite(s), ${report.summary.warnings} warning(s)` +
        (Object.hasOwn(report.summary, 'acknowledged') ? `, ${report.summary.acknowledged} acknowledged.` : '.'),
    );
    if (options.dryRun && report.filesChanged) log('Dry run only -- no source files were written.');
    if (options.report) log(`JSON report written to ${options.report}.`);
    if (options.check) {
      const remaining = report.filesChanged > 0 || report.summary.warnings > 0;
      log(
        remaining
          ? `Migration check failed: ${report.filesChanged} file(s) need changes and ${report.summary.warnings} warning(s) require review.`
          : 'Migration check passed: no rewrites or warnings remain.',
      );
      return remaining ? 1 : 0;
    }
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}

/**
 * Whether this module was invoked as the CLI rather than imported as a library.
 *
 * Compares REALPATHS. Under pnpm, `node_modules/.bin/lyra-ui-migrate` resolves into a package
 * directory that is a symlink into the virtual store, so the path the shim passes as `argv[1]`
 * (`<cwd>/node_modules/@aceshooting/lyra-ui/dist/cli/migrate-wa.mjs`) and this module's own
 * `import.meta.url` (`<cwd>/node_modules/.pnpm/@aceshooting+lyra-ui@<version>_<peer-suffix>/...`)
 * never match literally. The former raw comparison therefore evaluated false on every pnpm install:
 * `run()` never executed, so the CLI printed nothing, rewrote nothing, wrote no report -- and exited
 * 0. That made the documented `--check` CI gate pass unconditionally, which is worse than having no
 * gate, because it is trusted. npm and yarn were unaffected, which is how it survived.
 *
 * Falls back to the literal comparison only if a realpath cannot be taken (a deleted or
 * permission-denied entry), which keeps the import-as-a-library case correct either way.
 */
function invokedAsCli() {
  const invoked = process.argv[1];
  if (!invoked) return false;
  const here = fileURLToPath(import.meta.url);
  try {
    return fs.realpathSync(invoked) === fs.realpathSync(here);
  } catch {
    return path.resolve(invoked) === here;
  }
}

if (invokedAsCli()) {
  process.exitCode = run(process.argv.slice(2));
}
