// Upstream and local migration transformations driven by validated contracts.

import { AUTO_CLASSIFICATIONS, invariant } from './migration-contract.mjs';
import {
  assessImperativeDefaults,
  camelCase,
  commentRanges,
  ecosystemForTag,
  finalizeEdits,
  htmlTemplateStyleRanges,
  insideRanges,
  insideTemplateExpression,
  isDynamicAttribute,
  kebabCase,
  lineStarts,
  localMigrationKey,
  namedRule,
  normalizedAttributeName,
  originLabel,
  pairedMarkupTokens,
  parseTagAttributes,
  quotedRangeContaining,
  reportEntry,
  scanAllOpeningTags,
  scanApiTagReferences,
  scanDirectElementChildren,
  scanImports,
  scanLocalMigrationHazards,
  scanMarkupTags,
  serializeLocalDefault,
} from './migration-analysis.mjs';
import { migrateRenameText } from './migration-renames.mjs';


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

function warningCode(mapping) {
  if (!mapping) return 'UNKNOWN_UPSTREAM_TAG';
  if (mapping.classification === 'warning-required') return 'WARNING_REQUIRED';
  if (mapping.classification === 'conceptual-only') return 'CONCEPTUAL_MAPPING';
  return 'UNSUPPORTED_MAPPING';
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

function mappingMessage(mapping) {
  if (!mapping) return 'No pinned inventory mapping exists for this upstream tag.';
  return mapping.rationale || `The ${mapping.classification} mapping requires manual review.`;
}

function localAttributeName(rawName) {
  return rawName.replace(/^(?:v-bind:|bind:|[.?:])/, '').toLowerCase();
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
