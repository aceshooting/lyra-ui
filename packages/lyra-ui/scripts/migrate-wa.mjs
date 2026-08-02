#!/usr/bin/env node

// Contract-aware Web Awesome / Shoelace migration. Automatic edits come only from the checked-in
// component inventory: exact mappings receive prefix/import edits, rewritten mappings additionally
// receive their declared member/default rules, and every other mapping remains unchanged with a
// location-aware warning. The README parser remains exported for the independent documentation
// coverage gate; it is not an input to migration decisions.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOCAL_MIGRATION_ORIGINS,
  compareMappedSurfaces,
  validateLocalMigrations,
  validateMappingNormalizations,
} from './component-inventory.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, '..');
const inventoryPath = path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');

export const MIGRATION_REPORT_SCHEMA_VERSION = 1;

const DEFAULT_EXTENSIONS = new Set([
  'html',
  'htm',
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
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

export function buildMigrationContract(inventory) {
  invariant(inventory?.schemaVersion === 1, 'schemaVersion must be 1');
  invariant(Array.isArray(inventory.components), 'components must be an array');
  invariant(Array.isArray(inventory.mappings), 'mappings must be an array');
  invariant(inventory.upstreams && typeof inventory.upstreams === 'object', 'upstreams must be an object');

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
      validateMemberRules(mapping, upstreamEntry.component, target, section);
    }
    validateDefaultRules(mapping, upstreamEntry.component, target);
    const normalizationFindings = validateMappingNormalizations(mapping, {
      upstream: upstreamEntry.component.surface,
      target: target?.surface,
    });
    invariant(normalizationFindings.length === 0, normalizationFindings.join('; '));
    invariant(Array.isArray(mapping.drift), `${mapping.upstreamTag}: drift must be an array`);
    if (extendedPackageSchema) {
      const parity = mapping.parity;
      invariant(parity && typeof parity === 'object' && !Array.isArray(parity), `${mapping.upstreamTag}: parity missing`);
      const parityKeys = Object.keys(parity).filter(
        (key) => !['staticApi', 'lightDom', 'runtime', 'behaviorReviewFlags'].includes(key),
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
      if (AUTO_CLASSIFICATIONS.has(mapping.classification)) {
        invariant(
          parity.lightDom !== 'warning-required' && parity.lightDom !== 'unreviewed',
          `${mapping.upstreamTag}: automatic mapping cannot require light-DOM review`,
        );
        invariant(
          parity.behaviorReviewFlags.length === 0,
          `${mapping.upstreamTag}: automatic mapping cannot carry behavior review flags`,
        );
      }
    }
    if (target && upstreamEntry.component.review?.status === 'complete') {
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
      invariant(mapping.drift.length === 0, `${mapping.upstreamTag}: exact mapping has surface drift`);
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
      invariant(
        mapping.drift.every((finding) => driftCovered(mapping, finding)),
        `${mapping.upstreamTag}: rewritten mapping contains drift without a deterministic rule`,
      );
    }

    mappings.set(mapping.upstreamTag, {
      ...mapping,
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
    packageIdentities,
    packagesByEcosystem,
  };
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

function reportEntry({ textStarts, file, offset, origin, upstreamTag, upstreamMember = null, action, target = null, warningCode: code = null, message }) {
  const location = locationAt(textStarts, offset);
  return {
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

function scanAllOpeningTags(text, ignoredRanges) {
  const tokens = [];
  const regex = /<(?<tag>[a-z][a-z0-9.-]*)(?=[\s/>])/gi;
  for (const match of text.matchAll(regex)) {
    if (insideRanges(match.index, ignoredRanges)) continue;
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

function scanApiTagReferences(text, ignoredRanges) {
  const references = [];
  const regex = /\b(?:customElements\.(?:get|whenDefined)|(?:document\.)?(?:createElement|querySelector(?:All)?))\s*(?:<[^>\n]+>)?\(\s*(['"])(?<tag>(?:wa|sl)-[a-z][a-z0-9-]*)\1/g;
  for (const match of text.matchAll(regex)) {
    if (insideRanges(match.index, ignoredRanges)) continue;
    const relative = match[0].lastIndexOf(match.groups.tag);
    const start = match.index + relative;
    references.push({ tag: match.groups.tag, start, end: start + match.groups.tag.length });
  }
  return references;
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
  let content = original;
  for (const edit of [...unique].sort((left, right) => right.start - left.start || right.end - left.end)) {
    content = content.slice(0, edit.start) + edit.replacement + content.slice(edit.end);
  }
  return content;
}

function mappingMessage(mapping) {
  if (!mapping) return 'No pinned inventory mapping exists for this upstream tag.';
  return mapping.rationale || `The ${mapping.classification} mapping requires manual review.`;
}

function localMigrationKey(origin, tag) {
  return `${origin}:${tag}`;
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
        'inserting v7 compatibility defaults.',
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
          `Insert ${rule.member} to preserve the Lyra v7 default.`,
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

export function migrateText(original, contract, options = {}) {
  if (options.origin) return migrateLocalText(original, contract, options);
  const file = options.file ?? '<memory>';
  const rewriteBarePackages = options.rewriteBarePackages ?? new Set();
  const rootRegistrationMappings = options.rootRegistrationMappings ?? new Map();
  const starts = lineStarts(original);
  const ignoredRanges = commentRanges(original);
  const markupTokens = scanMarkupTags(original, ignoredRanges);
  const allOpeningTokens = scanAllOpeningTags(original, ignoredRanges);
  const apiReferences = scanApiTagReferences(original, ignoredRanges);
  const aliasReviews = scanAliasedRewriteReviews(original, contract, ignoredRanges);
  const dynamicDefaultReviews = scanDynamicDefaultReviews(original, markupTokens, contract);
  const imports = scanImports(original, ignoredRanges, contract);
  const bareImportPackages = new Set(
    imports.filter((imported) => imported.sideEffect && !imported.subpath).map((imported) => imported.packageName),
  );
  const blockedMappings = new Set([
    ...(options.blockedMappings ?? []),
    ...aliasReviews.keys(),
    ...dynamicDefaultReviews.keys(),
  ]);
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
  const warn = (offset, upstreamTag, upstreamMember, code, target, message, origin = null) => {
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
        message,
      }),
    );
  };
  const noteAutomatic = (mapping, offset) => {
    automaticMappings.add(mapping.upstreamTag);
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
    (blockedMappings.has(mapping.upstreamTag) || blockedEcosystems.has(mapping.upstream));
  const isBlockedAutomatic = (mapping) =>
    AUTO_CLASSIFICATIONS.has(mapping?.classification) && isBlocked(mapping);
  const isAutomatic = (mapping) =>
    AUTO_CLASSIFICATIONS.has(mapping?.classification) && !isBlocked(mapping);
  const blockedMessage = (mapping) =>
    `${mapping.upstreamTag} remains unchanged because the scanned target set contains a use that requires manual member, default, or import review.`;

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

  const openingTokens = [];
  for (const token of markupTokens) {
    const mapping = contract.mappings.get(token.tag);
    const ecosystem = ecosystemForTag(token.tag);
    if (!isAutomatic(mapping)) {
      usage[ecosystem].manual += 1;
      warn(
        token.nameStart,
        token.tag,
        null,
        isBlockedAutomatic(mapping) ? 'MAPPING_REVIEW_BLOCKED' : warningCode(mapping),
        mapping?.targetTag ?? null,
        isBlockedAutomatic(mapping) ? blockedMessage(mapping) : mappingMessage(mapping),
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
    if (!token.closing) openingTokens.push({ token, mapping, attributes: parseTagAttributes(original, token) });
  }

  for (const reference of apiReferences) {
    const mapping = contract.mappings.get(reference.tag);
    const ecosystem = ecosystemForTag(reference.tag);
    if (!isAutomatic(mapping)) {
      usage[ecosystem].manual += 1;
      warn(
        reference.start,
        reference.tag,
        null,
        isBlockedAutomatic(mapping) ? 'MAPPING_REVIEW_BLOCKED' : warningCode(mapping),
        mapping?.targetTag ?? null,
        isBlockedAutomatic(mapping) ? blockedMessage(mapping) : mappingMessage(mapping),
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
      if (!AUTO_CLASSIFICATIONS.has(mapping.classification)) continue;
      const tagPattern = new RegExp(`(?<![a-z0-9-])${mapping.upstreamTag}(?![a-z0-9-])`, 'g');
      const selectorMatches = [...match.groups.selector.matchAll(tagPattern)].filter(
        (tagMatch) => !insideRanges(selectorStart + tagMatch.index, ignoredRanges),
      );
      if (!selectorMatches.length) continue;
      if (!isAutomatic(mapping)) {
        usage[mapping.upstream].manual += selectorMatches.length;
        for (const tagMatch of selectorMatches) {
          warn(
            selectorStart + tagMatch.index,
            mapping.upstreamTag,
            null,
            'MAPPING_REVIEW_BLOCKED',
            mapping.targetTag,
            blockedMessage(mapping),
          );
        }
        continue;
      }
      for (const tagMatch of selectorMatches) {
        const offset = selectorStart + tagMatch.index;
        noteAutomatic(mapping, offset);
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
    if (!upstreamTag || !isAutomatic(mapping)) {
      usage[ecosystem].manual += 1;
      warn(
        imported.start,
        upstreamTag,
        'module',
        isBlockedAutomatic(mapping)
          ? 'MAPPING_REVIEW_BLOCKED'
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
      );
      continue;
    }
    usage[ecosystem].automatic += 1;
    noteAutomatic(mapping, imported.start);
    const target = targetImport(mapping.target);
    addEdit(imported.start, imported.end, target, {
      upstreamTag,
      upstreamMember: 'module',
      action: 'rewrite-import',
      target,
      message: `Rewrite the ${upstreamTag} registration entry to its inventory module.`,
    });
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
  };
}

function reportPathName(file, cwd) {
  return (path.relative(cwd, file) || path.basename(file)).split(path.sep).join('/');
}

export function migrateFiles({
  files,
  inventory,
  dryRun = false,
  reportPath = null,
  cwd = process.cwd(),
  origin = null,
}) {
  const contract = buildMigrationContract(inventory);
  const originals = new Map(files.map((file) => [file, fs.readFileSync(file, 'utf8')]));
  if (origin !== null) {
    invariant(contract.localMigrations.has(origin), `unknown local migration origin ${String(origin)}`);
    const blockedLocalMigrations = new Set();
    for (const [file, original] of originals) {
      const analysis = migrateText(original, contract, {
        file: reportPathName(file, cwd),
        origin,
      });
      for (const key of analysis.blockedLocalMigrations) blockedLocalMigrations.add(key);
    }

    const changes = [];
    const warnings = [];
    let filesChanged = 0;
    for (const [file, original] of originals) {
      const result = migrateText(original, contract, {
        file: reportPathName(file, cwd),
        origin,
        blockedLocalMigrations,
      });
      changes.push(...result.changes);
      warnings.push(...result.warnings);
      if (result.content !== original) {
        filesChanged += 1;
        if (!dryRun) fs.writeFileSync(file, result.content, 'utf8');
      }
    }
    const sortEntries = (entries) => entries.sort((left, right) =>
      left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column ||
      left.action.localeCompare(right.action));
    sortEntries(changes);
    sortEntries(warnings);
    const report = {
      schemaVersion: MIGRATION_REPORT_SCHEMA_VERSION,
      origin,
      dryRun,
      filesScanned: files.length,
      filesChanged,
      changes,
      warnings,
      summary: { rewrites: changes.length, warnings: warnings.length },
    };
    if (reportPath) fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return report;
  }
  const blockedMappings = new Set();
  const blockedEcosystems = new Set();
  const bareImportPackages = new Set();
  const automaticMappings = new Set();
  const usage = {
    webawesome: { automatic: 0, manual: 0 },
    shoelace: { automatic: 0, manual: 0 },
  };
  for (const [file, original] of originals) {
    const analysis = migrateText(original, contract, {
      file: reportPathName(file, cwd),
      rewriteBarePackages: new Set(),
    });
    for (const ecosystem of Object.keys(usage)) {
      usage[ecosystem].automatic += analysis.usage[ecosystem].automatic;
      usage[ecosystem].manual += analysis.usage[ecosystem].manual;
    }
    for (const upstreamTag of analysis.blockedMappings) blockedMappings.add(upstreamTag);
    for (const ecosystem of analysis.blockedEcosystems) blockedEcosystems.add(ecosystem);
    for (const packageName of analysis.bareImportPackages) bareImportPackages.add(packageName);
    for (const upstreamTag of analysis.automaticMappings) automaticMappings.add(upstreamTag);
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
    });
    changes.push(...result.changes);
    warnings.push(...result.warnings);
    if (result.content !== original) {
      filesChanged += 1;
      if (!dryRun) fs.writeFileSync(file, result.content, 'utf8');
    }
  }
  const sortEntries = (entries) => entries.sort((left, right) =>
    left.file.localeCompare(right.file) || left.line - right.line || left.column - right.column ||
    left.action.localeCompare(right.action));
  sortEntries(changes);
  sortEntries(warnings);
  const report = {
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
  };
  if (reportPath) fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}

export function parseArgs(argv) {
  const options = {
    check: false,
    dryRun: false,
    help: false,
    extensions: DEFAULT_EXTENSIONS,
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
    } else if (!positional && argument.startsWith('--origin=')) {
      options.origin = argument.slice('--origin='.length);
      if (!options.origin) throw new Error('--origin requires a value');
      if (!LOCAL_MIGRATION_ORIGINS.includes(options.origin)) {
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
  console.log(`Usage: lyra-ui-migrate [--check] [--dry-run] [--origin=lyra-v7] [--report=path] [--ext=html,ts,...] targets...

Only exact and fully rewritten inventory mappings change automatically. Conceptual, unsafe,
unsupported, unknown, and unresolved deep-import uses remain unchanged with source-located
warnings. The optional JSON report has a stable schema for CI and review tooling.

Without --origin, only Web Awesome and Shoelace migrations run. --origin=lyra-v7 performs the
opt-in Lyra defaults migration and never rewrites tags or imports.

  --dry-run, -n     report changes without writing source files
  --check           exit nonzero when rewrites or warnings remain; never write source files
  --origin=lyra-v7  insert explicit attributes that preserve changed Lyra v7 defaults
  --report=path     write the stable JSON migration report
  --ext=a,b,c       extensions scanned for directory targets
  --help, -h        show this message`);
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
    const report = migrateFiles({
      files,
      inventory,
      dryRun: options.dryRun,
      origin: options.origin,
      reportPath: options.report ? path.resolve(options.report) : null,
    });
    for (const entry of report.changes) {
      console.log(`${entry.file}:${entry.line}:${entry.column}  ${entry.action}: ${entry.message}`);
    }
    for (const entry of report.warnings) {
      console.log(`${entry.file}:${entry.line}:${entry.column}  warning ${entry.warningCode}: ${entry.message}`);
    }
    console.log(
      `${report.filesScanned} file(s) scanned, ${report.filesChanged} changed, ` +
        `${report.summary.rewrites} rewrite(s), ${report.summary.warnings} warning(s).`,
    );
    if (options.dryRun && report.filesChanged) console.log('Dry run only -- no source files were written.');
    if (options.report) console.log(`JSON report written to ${options.report}.`);
    if (options.check) {
      const remaining = report.filesChanged > 0 || report.summary.warnings > 0;
      console.log(
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

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}
