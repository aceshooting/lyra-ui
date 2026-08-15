import path from 'node:path';

export const INVENTORY_SCHEMA_VERSION = 1;

export const SURFACE_SECTIONS = [
  'attributes',
  'properties',
  'slots',
  'events',
  'parts',
  'cssProperties',
  'cssStates',
  'methods',
  'staticProperties',
  'staticMethods',
  'moduleExports',
  'form',
  'native',
];

export const MAPPING_CLASSIFICATIONS = ['exact', 'rewritten', 'warning-required', 'conceptual-only', 'unsupported'];

export const ACCESSIBILITY_PROFILE_SECTIONS = [
  'semantics',
  'naming',
  'keyboard',
  'focus',
  'states',
  'announcements',
  'motion',
];

export const ACCESSIBILITY_BEHAVIOR_VOCABULARY = Object.freeze({
  semantics: Object.freeze([
    'alert',
    'article',
    'button',
    'checkbox',
    'combobox',
    'composition-primitive',
    'dialog',
    'document',
    'grid',
    'group',
    'iframe',
    'img',
    'link',
    'list',
    'listbox',
    'menu',
    'menuitem',
    'navigation',
    'option',
    'presentation',
    'progressbar',
    'radio',
    'radiogroup',
    'region',
    'separator',
    'slider',
    'spinbutton',
    'status',
    'switch',
    'tab',
    'table',
    'tablist',
    'tabpanel',
    'text-content',
    'textbox',
    'tooltip',
    'transparent-content',
    'tree',
    'treeitem',
    'video',
  ]),
  naming: Object.freeze([
    'alternative-text',
    'author-label-required',
    'content-derived',
    'content-or-author-label',
    'control-labels-localized',
    'current-page',
    'frame-title',
    'heading-level',
    'value-text',
    'visible-or-author-label',
  ]),
  keyboard: Object.freeze([
    'arrow-navigation',
    'data-point-navigation',
    'escape-dismiss',
    'home-end-navigation',
    'media-controls',
    'native-activation',
    'native-editing',
    'page-navigation',
    'range-adjustment',
    'spatial-adjustment',
    'tab-cycle',
    'typeahead',
  ]),
  focus: Object.freeze([
    'focus-follows-selection',
    'focus-preserved',
    'focus-return',
    'focus-trap',
    'focus-visible-on-reveal',
    'frame-focus-gated',
    'initial-focus',
    'native-focus',
    'roving-focus',
  ]),
  states: Object.freeze([
    'busy',
    'checked',
    'current',
    'disabled',
    'expanded',
    'invalid',
    'modal',
    'multiselectable',
    'orientation',
    'paused',
    'pressed',
    'readonly',
    'required',
    'selected',
    'sort',
    'value-range',
  ]),
  announcements: Object.freeze([
    'autoplay-content-change',
    'character-count',
    'content-change',
    'copy-result',
    'live-alert',
    'live-status',
    'page-change',
    'playback-state',
    'progress-value',
    'selection-change',
    'validation-message',
  ]),
  motion: Object.freeze([
    'respects-reduced-motion',
    'stops-autoplay',
    'suppresses-animation',
    'user-pause-control',
  ]),
});

export const ACCESSIBILITY_COMPARISON_STATUSES = [
  'equivalent',
  'target-additive',
  'not-applicable',
  'warning-required',
];

const ACCESSIBILITY_EVIDENCE = Object.freeze({
  upstream: 'pinned-public-contract',
  target: 'lyra-authored-contract-and-automated-tests',
});

export const REWRITE_RULE_SECTIONS = ['attributes', 'properties', 'events', 'slots', 'parts', 'cssProperties', 'methods', 'defaults'];

// Normalizations describe reviewed analyzer/public-surface equivalences. Unlike rewrites, these
// rules never authorize a source transformation in migrate-wa.
export const NORMALIZATION_SECTIONS = [
  'typeEquivalences',
  'structuralTypeAliases',
  'methodParameterTypeEquivalences',
  'defaultEquivalences',
  'derivedDefaultEquivalences',
  'inferredAttributeSuppressions',
  'unknownMethodReturnTypes',
  'cancelabilityEquivalences',
  'cancelabilityPathAdditions',
  'attributePropertyEquivalences',
  'reflectionEquivalences',
  'cssDefaultEquivalences',
  'deprecationEquivalences',
];

// Cancelability is a summary label over every path that emits an event, ordered by how much veto
// power it hands a listener. A rename may only ever move an event *up* this ladder: widening is a
// superset, because `preventDefault()` on an event that was never cancelable is a silent no-op that
// no shipped consumer can be depending on, while narrowing silently turns a working veto into that
// same no-op.
const CANCELABILITY_RANK = new Map([
  ['never', 0],
  ['conditional', 1],
  ['always', 2],
]);

export const LOCAL_MIGRATION_ORIGINS = ['lyra-v7'];

export const LOCAL_MIGRATION_PROFILES = [
  {
    origin: 'lyra-v7',
    tag: 'lr-popup',
    defaults: [
      {
        memberKind: 'attribute',
        member: 'strategy',
        action: 'insert-if-absent',
        value: 'fixed',
      },
      {
        memberKind: 'attribute',
        member: 'placement',
        action: 'insert-if-absent',
        value: 'bottom-start',
      },
      {
        memberKind: 'attribute',
        member: 'distance',
        action: 'insert-if-absent',
        value: 4,
      },
      {
        memberKind: 'attribute',
        member: 'flip',
        action: 'insert-if-absent',
        value: true,
      },
      {
        memberKind: 'attribute',
        member: 'shift',
        action: 'insert-if-absent',
        value: true,
      },
    ],
  },
  {
    origin: 'lyra-v7',
    tag: 'lr-popover',
    defaults: [
      {
        memberKind: 'attribute',
        member: 'placement',
        action: 'insert-if-absent',
        value: 'bottom-start',
      },
      {
        memberKind: 'attribute',
        member: 'distance',
        action: 'insert-if-absent',
        value: 4,
      },
      {
        memberKind: 'attribute',
        member: 'without-arrow',
        action: 'insert-if-absent',
        value: true,
      },
    ],
  },
  {
    origin: 'lyra-v7',
    tag: 'lr-tooltip',
    defaults: [
      {
        memberKind: 'attribute',
        member: 'distance',
        action: 'insert-if-absent',
        value: 6,
      },
      {
        memberKind: 'attribute',
        member: 'without-arrow',
        action: 'insert-if-absent',
        value: true,
      },
    ],
  },
];

// These manifest attributes do not represent component-specific migration work. `dir`, `lang`,
// `role`, `tabindex`, and `title` are HTMLElement-wide passthrough attributes in both libraries;
// `did-ssr` is Web Awesome's own hydration marker and is not an authored Lyra component member to
// preserve or rename.
export const MIGRATION_ATTRIBUTE_EXCLUSIONS = Object.freeze({
  dir: 'platform-global-passthrough',
  lang: 'platform-global-passthrough',
  role: 'platform-global-passthrough',
  tabindex: 'platform-global-passthrough',
  title: 'platform-global-passthrough',
  'did-ssr': 'upstream-hydration-marker',
});

export function emptyRewrites() {
  return Object.fromEntries(REWRITE_RULE_SECTIONS.map((section) => [section, []]));
}

export function emptyNormalizations() {
  return Object.fromEntries(NORMALIZATION_SECTIONS.map((section) => [section, []]));
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function accessibilityBehaviorSet(profile) {
  return new Set(
    ACCESSIBILITY_PROFILE_SECTIONS.flatMap((section) =>
      (profile?.[section] ?? []).map((behavior) => `${section}:${behavior}`),
    ),
  );
}

export function compareAccessibilityProfiles(profiles, upstreamProfile, targetProfile) {
  const upstream = profiles?.[upstreamProfile];
  const target = profiles?.[targetProfile];
  if (!upstream) throw new Error(`unknown upstream accessibility profile ${String(upstreamProfile)}`);
  if (!target) throw new Error(`unknown target accessibility profile ${String(targetProfile)}`);
  const upstreamBehaviors = accessibilityBehaviorSet(upstream);
  const targetBehaviors = accessibilityBehaviorSet(target);
  const missing = [...upstreamBehaviors].filter((behavior) => !targetBehaviors.has(behavior)).sort();
  const additions = [...targetBehaviors].filter((behavior) => !upstreamBehaviors.has(behavior)).sort();
  const status =
    upstreamBehaviors.size === 0 && targetBehaviors.size === 0
      ? 'not-applicable'
      : missing.length > 0
        ? 'warning-required'
        : additions.length > 0
          ? 'target-additive'
          : 'equivalent';
  return { status, missing, additions };
}

/** A parity review is complete only when the normalized source was actually compared with a
 * concrete target. A complete upstream snapshot by itself is evidence input, not a comparison. */
export function deriveStaticApiReviewStatus({ upstreamReviewStatus, targetPresent, comparisonPerformed }) {
  if (upstreamReviewStatus === 'tag-only') return 'tag-only';
  return upstreamReviewStatus === 'complete' && targetPresent === true && comparisonPerformed === true
    ? 'reviewed'
    : 'unreviewed';
}

function validateAccessibilityProfiles(profiles, findings) {
  if (!isPlainObject(profiles) || Object.keys(profiles).length === 0) {
    findings.push('accessibilityProfiles must be a non-empty object');
    return;
  }
  for (const [profileName, profile] of Object.entries(profiles)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(profileName)) {
      findings.push(`accessibility profile ${profileName}: invalid profile name`);
    }
    if (!isPlainObject(profile)) {
      findings.push(`accessibility profile ${profileName}: profile must be an object`);
      continue;
    }
    const allowedKeys = new Set(['description', ...ACCESSIBILITY_PROFILE_SECTIONS]);
    const unknownKeys = Object.keys(profile).filter((key) => !allowedKeys.has(key));
    if (unknownKeys.length > 0) {
      findings.push(`accessibility profile ${profileName}: unknown key(s) ${unknownKeys.join(', ')}`);
    }
    if (typeof profile.description !== 'string' || !profile.description.trim()) {
      findings.push(`accessibility profile ${profileName}: description must be non-empty`);
    }
    for (const section of ACCESSIBILITY_PROFILE_SECTIONS) {
      const behaviors = profile[section];
      if (!Array.isArray(behaviors)) {
        findings.push(`accessibility profile ${profileName}: ${section} must be an array`);
        continue;
      }
      if (new Set(behaviors).size !== behaviors.length) {
        findings.push(`accessibility profile ${profileName}: duplicate ${section} behavior`);
      }
      if (JSON.stringify(behaviors) !== JSON.stringify([...behaviors].sort())) {
        findings.push(`accessibility profile ${profileName}: ${section} behaviors must be sorted`);
      }
      const allowed = new Set(ACCESSIBILITY_BEHAVIOR_VOCABULARY[section]);
      for (const behavior of behaviors) {
        if (!allowed.has(behavior)) {
          findings.push(`accessibility profile ${profileName}: unknown ${section} behavior ${String(behavior)}`);
        }
      }
    }
  }
}

function validateAccessibilityParity(mapping, profiles, findings) {
  const accessibility = mapping.parity?.accessibility;
  if (!isPlainObject(accessibility)) {
    findings.push(`${mapping.upstreamTag}: missing accessibility parity review`);
    return;
  }
  const allowedKeys = new Set([
    'reviewStatus',
    'upstreamProfile',
    'targetProfile',
    'evidence',
    'comparison',
    'rationale',
  ]);
  const unknownKeys = Object.keys(accessibility).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    findings.push(`${mapping.upstreamTag}: accessibility parity has unknown key(s) ${unknownKeys.join(', ')}`);
  }
  if (accessibility.reviewStatus !== 'complete') {
    findings.push(`${mapping.upstreamTag}: accessibility parity review is incomplete`);
  }
  if (!isPlainObject(accessibility.evidence) ||
      accessibility.evidence.upstream !== ACCESSIBILITY_EVIDENCE.upstream ||
      accessibility.evidence.target !== ACCESSIBILITY_EVIDENCE.target ||
      Object.keys(accessibility.evidence ?? {}).some((key) => key !== 'upstream' && key !== 'target')) {
    findings.push(`${mapping.upstreamTag}: accessibility parity evidence is invalid`);
  }
  if (typeof accessibility.rationale !== 'string' || !accessibility.rationale.trim()) {
    findings.push(`${mapping.upstreamTag}: accessibility parity rationale must be non-empty`);
  }
  let expected;
  try {
    expected = compareAccessibilityProfiles(
      profiles,
      accessibility.upstreamProfile,
      accessibility.targetProfile,
    );
  } catch (error) {
    findings.push(`${mapping.upstreamTag}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  if (!isPlainObject(accessibility.comparison) || !sameJson(accessibility.comparison, expected)) {
    findings.push(`${mapping.upstreamTag}: stored accessibility comparison is stale`);
  }
  const hasScopedConditionalReview =
    mapping.parity?.lightDom === 'warning-required' &&
    Array.isArray(mapping.parity?.behaviorReviewFlags) &&
    mapping.parity.behaviorReviewFlags.length > 0;
  if (
    (mapping.classification === 'exact' || mapping.classification === 'rewritten') &&
    expected.status === 'warning-required' &&
    !hasScopedConditionalReview
  ) {
    findings.push(`${mapping.upstreamTag}: automatic mapping has missing accessibility behavior`);
  }
}

export function validateAccessibilityContract(profiles, mappings) {
  const findings = [];
  validateAccessibilityProfiles(profiles, findings);
  if (!Array.isArray(mappings)) {
    findings.push('accessibility mappings must be an array');
  } else {
    for (const mapping of mappings) validateAccessibilityParity(mapping, profiles, findings);
  }
  return findings.sort();
}

const INTERNAL_METHOD_NAMES = new Set([
  'constructor',
  'render',
  'update',
  'performUpdate',
  'requestUpdate',
  'shouldUpdate',
  'willUpdate',
  'updated',
  'firstUpdated',
  'createRenderRoot',
  'connectedCallback',
  'disconnectedCallback',
  'adoptedCallback',
  'attributeChangedCallback',
  'addEventListener',
  'removeEventListener',
  'emit',
  'localize',
  'scheduleAfterUpdate',
  'beginAbortableLoad',
  'setCustomStates',
  'setValue',
  'updateValidity',
]);

const PUBLIC_METHOD_NAMES = new Set([
  'focus',
  'blur',
  'click',
  'select',
  'show',
  'hide',
  'open',
  'close',
  'openSubmenu',
  'closeSubmenu',
  'toggle',
  'checkValidity',
  'reportValidity',
  'setCustomValidity',
  'resetValidity',
  'formStateRestoreCallback',
  'getForm',
  'setSelectionRange',
  'setRangeText',
  'showPicker',
  'stepUp',
  'stepDown',
  'play',
  'pause',
  'load',
  'clearSearch',
  'getHeadingTree',
  'renderChart',
  'renderMarkdown',
  'search',
  'searchNext',
  'searchPrevious',
  'handleColumnsChange',
  'handlePageChange',
  'handleSearchTermChange',
]);

const FORM_PROPERTIES = new Set([
  'form',
  'name',
  'type',
  'value',
  'defaultValue',
  'checked',
  'defaultChecked',
  'disabled',
  'required',
  'validity',
  'validationMessage',
  'willValidate',
  'labels',
]);

const FORM_METHODS = new Set(['checkValidity', 'reportValidity', 'setCustomValidity', 'getForm']);

const NATIVE_METHODS = new Set([
  'focus',
  'blur',
  'click',
  'select',
  'setSelectionRange',
  'setRangeText',
  'showPicker',
  'stepUp',
  'stepDown',
  'play',
  'pause',
  'load',
]);

const NATIVE_EVENTS = new Set([
  'beforeinput',
  'input',
  'change',
  'focus',
  'blur',
  'invalid',
  'load',
  'error',
  'play',
  'pause',
  'ended',
  'loadedmetadata',
  'timeupdate',
  'volumechange',
]);

const UNDOCUMENTED_PUBLIC_FIELDS = new Set(['title']);
const UNSPECIFIED_PUBLIC_DOCUMENTATION = 'unspecified-public-documentation';
const FRAMEWORK_CONTROLLER_FIELDS = new Set(['localize']);
const PROPERTY_ONLY_FIELDS = new Set([
  'config',
  'chart',
  'currentTime',
  'filter',
  'files',
  'keyframes',
  'languages',
  'marked',
  'modal',
  'selectedItems',
  'selectedOptions',
  'valueAsDate',
  'valueAsNumber',
  'validationMessage',
  'validity',
  'willValidate',
]);

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const textOf = (type) => type?.text?.replace(/\s+/g, ' ').trim() || 'unknown';
const sortByName = (entries) => [...entries].sort((a, b) => a.name.localeCompare(b.name));
const unique = (entries) => [...new Set(entries)].sort();

function canonicalDefault(raw) {
  if (raw === undefined) return undefined;
  if (raw === null || typeof raw === 'boolean' || typeof raw === 'number') return raw;
  const value = String(raw).trim();
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (value === 'undefined') return 'undefined';
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return Number(value);
  if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
    return value.slice(1, -1).replace(/\\(['"\\])/g, '$1');
  }
  return value.replace(/\s+/g, ' ');
}

function kebabCase(name) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replaceAll('_', '-')
    .toLowerCase();
}

function isInternalMethod(member, ecosystem) {
  if (member.kind !== 'method' || member.static || member.privacy === 'private' || member.privacy === 'protected') {
    return true;
  }
  // As with fields, a directly-authored Lyra method is public TypeScript API unless its source
  // explicitly says otherwise. Naming heuristics (`on*`, `*Callback`, lifecycle names) must not
  // silently erase a callable member from effective governance; implementation hooks belong
  // behind `private`/`protected` in source.
  if (ecosystem === 'lyra' && !member.inheritedFrom) return false;
  if (INTERNAL_METHOD_NAMES.has(member.name)) return true;
  if (/^(?:handle|on|_)[A-Z_]/.test(member.name) && !PUBLIC_METHOD_NAMES.has(member.name)) return true;
  if (/Callback$/.test(member.name) && !PUBLIC_METHOD_NAMES.has(member.name)) return true;
  if (member.inheritedFrom && !PUBLIC_METHOD_NAMES.has(member.name) && !FORM_METHODS.has(member.name)) return true;
  if (ecosystem !== 'lyra' && !member.description && !PUBLIC_METHOD_NAMES.has(member.name) && !FORM_METHODS.has(member.name)) {
    return true;
  }
  return false;
}

function isPublicField(member, attributeNames, ecosystem) {
  if (member.kind !== 'field' || member.static || member.privacy === 'private' || member.privacy === 'protected') return false;
  // TypeScript visibility, not a naming convention or analyzer-description accident, owns Lyra's
  // directly-authored API boundary. Underscore/framework-controller fields must be declared
  // private/protected in source if they are implementation detail.
  if (ecosystem === 'lyra' && !member.inheritedFrom) return true;
  if (/^_/.test(member.name)) return false;
  if (
    FRAMEWORK_CONTROLLER_FIELDS.has(member.name) &&
    !member.attribute &&
    !attributeNames.has(member.name) &&
    !member.description
  ) {
    return false;
  }
  if (attributeNames.has(member.name) || member.attribute) return true;
  if (FORM_PROPERTIES.has(member.name) || PROPERTY_ONLY_FIELDS.has(member.name)) return true;
  if (member.inheritedFrom) return FORM_PROPERTIES.has(member.name) || PROPERTY_ONLY_FIELDS.has(member.name);
  if (ecosystem === 'shoelace') {
    return Boolean(member.description) || FORM_PROPERTIES.has(member.name) || UNDOCUMENTED_PUBLIC_FIELDS.has(member.name);
  }
  return member.privacy === 'public' || Boolean(member.description) || Boolean(member.readonly);
}

// CEM includes several framework configuration hooks on the constructor even though neither
// upstream documents them as consumer API. Keep that reviewed implementation vocabulary narrow;
// every other directly-authored Lyra static is public by TypeScript visibility, while published
// upstream statics require either public documentation or an explicit `public` marker. This keeps
// callable statics such as preload(), getMarked(), updateAll(), and validators without turning
// Lit's style/finalization machinery into migration obligations.
const FRAMEWORK_STATIC_FIELDS = new Set([
  'css',
  'dependencies',
  'elementProperties',
  'formAssociated',
  'observeSlots',
  'shadowRootOptions',
  'styles',
]);

function isPublicStaticField(member, ecosystem) {
  if (
    member.kind !== 'field' ||
    member.static !== true ||
    member.privacy === 'private' ||
    member.privacy === 'protected' ||
    FRAMEWORK_STATIC_FIELDS.has(member.name)
  ) {
    return false;
  }
  if (ecosystem === 'lyra' && !member.inheritedFrom) return true;
  return member.privacy === 'public' || Boolean(member.description) || Boolean(member.readonly);
}

function isPublicStaticMethod(member, ecosystem) {
  if (
    member.kind !== 'method' ||
    member.static !== true ||
    member.privacy === 'private' ||
    member.privacy === 'protected'
  ) {
    return false;
  }
  if (ecosystem === 'lyra' && !member.inheritedFrom) {
    if (INTERNAL_METHOD_NAMES.has(member.name)) return false;
    if (/^(?:handle|on|_)[A-Z_]/u.test(member.name) && !PUBLIC_METHOD_NAMES.has(member.name)) return false;
    if (/Callback$/u.test(member.name) && !PUBLIC_METHOD_NAMES.has(member.name)) return false;
    return true;
  }
  return member.privacy === 'public' || Boolean(member.description);
}

function normalizeParameter(parameter, ecosystem) {
  const normalized = {
    name: parameter.name,
    type:
      ecosystem !== 'lyra' && !parameter.type
        ? UNSPECIFIED_PUBLIC_DOCUMENTATION
        : textOf(parameter.type),
    optional: parameter.optional === true,
  };
  if (hasOwn(parameter, 'default')) {
    normalized.hasDefault = true;
    normalized.default = canonicalDefault(parameter.default);
  } else {
    normalized.hasDefault = false;
  }
  return normalized;
}

export function eventCancelabilityFromDescription(description = '', ecosystem = 'lyra', eventName) {
  const text = description.toLowerCase().replace(
    /\b(?:conditionally\s+|non[- ]?|not\s+|never\s+)?cancell?able\s+`(lr-[a-z0-9-]+)`/gu,
    (phrase, referencedEvent) => referencedEvent === eventName ? phrase : '',
  );
  const conditionalPattern = /\bconditionally\s+cancell?able\b/gu;
  const negativePattern = /\b(?:non[- ]?|not\s+|never\s+)cancell?able\b/gu;
  const conditional = conditionalPattern.exec(text);
  const negative = negativePattern.exec(text);
  const withoutQualifiedMarkers = text
    .replace(conditionalPattern, (phrase) => ' '.repeat(phrase.length))
    .replace(negativePattern, (phrase) => ' '.repeat(phrase.length));
  const markers = [
    { kind: 'conditional', match: conditional },
    { kind: 'never', match: negative },
    { kind: 'always', match: /\bcancell?able\b/u.exec(withoutQualifiedMarkers) },
    { kind: 'implicit-always', match: /preventdefault\(\)|\bcancel(?:ing|ling) this event\b/u.exec(text) },
  ].filter(({ match }) => match);
  markers.sort((left, right) => left.match.index - right.match.index);
  const first = markers[0];
  if (!first) return ecosystem === 'lyra' ? 'never' : UNSPECIFIED_PUBLIC_DOCUMENTATION;
  if (first.kind === 'conditional') return 'conditional';
  const kinds = new Set(markers.map(({ kind }) => kind));
  if (kinds.has('always') && kinds.has('never')) return 'conditional';
  if (first.kind === 'always' && /\b(?:except|unless|single\s+exception)\b/u.test(text)) {
    return 'conditional';
  }
  return first.kind === 'implicit-always' ? 'always' : first.kind;
}

function normalizeAttributes(declaration, publicFields, ecosystem) {
  const fields = new Map(publicFields.map((member) => [member.name, member]));
  const declared = declaration.attributes ?? [];
  const source = declared.length
    ? declared
    : publicFields
        .filter((member) => !member.readonly && !PROPERTY_ONLY_FIELDS.has(member.name))
        .map((member) => ({
          name: member.attribute || kebabCase(member.name),
          fieldName: member.name,
          type: member.type,
          ...(hasOwn(member, 'default') ? { default: member.default } : {}),
          inferred: true,
        }));

  return sortByName(
    source.map((attribute) => {
      const field = fields.get(attribute.fieldName || attribute.name) ?? publicFields.find((member) => member.attribute === attribute.name);
      const normalized = {
        name: attribute.name,
        property: attribute.fieldName || field?.name || attribute.name,
        type: textOf(attribute.parsedType || attribute.type || field?.type),
        reflects: field?.reflects === true,
        inferred: attribute.inferred === true || (ecosystem === 'shoelace' && declared.length === 0),
        deprecated: attribute.deprecation || attribute.deprecated || field?.deprecation || field?.deprecated || null,
        hasDefault: hasOwn(attribute, 'default') || Boolean(field && hasOwn(field, 'default')),
      };
      if (normalized.hasDefault) normalized.default = canonicalDefault(hasOwn(attribute, 'default') ? attribute.default : field.default);
      return normalized;
    }),
  );
}

function normalizeProperties(publicFields) {
  return sortByName(
    publicFields.map((member) => {
      const normalized = {
        name: member.name,
        attribute: typeof member.attribute === 'string' ? member.attribute : null,
        type: textOf(member.parsedType || member.type),
        readonly: member.readonly === true,
        reflects: member.reflects === true,
        deprecated: member.deprecation || member.deprecated || null,
        hasDefault: hasOwn(member, 'default'),
      };
      if (normalized.hasDefault) normalized.default = canonicalDefault(member.default);
      return normalized;
    }),
  );
}

function normalizeMethodEntries(members, ecosystem) {
  const grouped = new Map();
  for (const member of members) {
    const overload = {
      parameters: (member.parameters ?? []).map((parameter) => normalizeParameter(parameter, ecosystem)),
      returnType:
        ecosystem !== 'lyra' && !member.return?.type
          ? UNSPECIFIED_PUBLIC_DOCUMENTATION
          : textOf(member.return?.type),
    };
    const key = JSON.stringify(overload);
    const current = grouped.get(member.name) ?? new Map();
    current.set(key, overload);
    grouped.set(member.name, current);
  }
  return [...grouped]
    .map(([name, overloads]) => {
      const declaration = members.find((member) => member.kind === 'method' && member.name === name);
      const deprecated = declaration?.deprecation || declaration?.deprecated || null;
      return {
        name,
        overloads: [...overloads.values()],
        ...(deprecated ? { deprecated } : {}),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeMethods(members, ecosystem) {
  return normalizeMethodEntries(
    members.filter((member) => !isInternalMethod(member, ecosystem)),
    ecosystem,
  );
}

function normalizeStaticProperties(members, ecosystem) {
  return sortByName(
    members
      .filter((member) => isPublicStaticField(member, ecosystem))
      .map((member) => {
        return {
          name: member.name,
          type: textOf(member.parsedType || member.type),
          readonly: member.readonly === true,
          deprecated: member.deprecation || member.deprecated || null,
        };
      }),
  );
}

function normalizeStaticMethods(members, ecosystem) {
  return normalizeMethodEntries(
    members.filter((member) => isPublicStaticMethod(member, ecosystem)),
    ecosystem,
  );
}

function normalizedModulePath(modulePath) {
  if (typeof modulePath !== 'string' || !modulePath) return null;
  return path.posix.normalize(modulePath.replaceAll('\\', '/').replace(/^\/+/, ''));
}

function moduleLookupPath(modulePath) {
  return normalizedModulePath(modulePath)?.replace(/\.(?:[cm]?js|ts)$/u, '') ?? null;
}

function resolvedExportDeclarationPath(exportingModule, declarationModule) {
  const exportingPath = normalizedModulePath(exportingModule);
  const declaredPath = normalizedModulePath(declarationModule);
  if (!exportingPath || !declaredPath) return null;
  return declarationModule.startsWith('.')
    ? path.posix.normalize(path.posix.join(path.posix.dirname(exportingPath), declarationModule))
    : declaredPath;
}

function moduleDeclarationIndex(manifest) {
  const index = new Map();
  for (const module of manifest.modules ?? []) {
    const modulePath = moduleLookupPath(module.path);
    if (!modulePath) continue;
    for (const declaration of module.declarations ?? []) {
      if (!declaration?.name) continue;
      const key = `${modulePath}\0${declaration.name}`;
      const declarations = index.get(key) ?? [];
      declarations.push(declaration);
      index.set(key, declarations);
    }
  }
  return index;
}

function moduleExportDeclaration(index, module, entry) {
  const exportingPath = moduleLookupPath(module.path);
  const declarationName = entry.declaration?.name ?? entry.name;
  const declaredPath = entry.declaration?.module
    ? moduleLookupPath(resolvedExportDeclarationPath(module.path, entry.declaration.module))
    : exportingPath;
  return (
    index.get(`${declaredPath}\0${declarationName}`) ??
    index.get(`${exportingPath}\0${declarationName}`) ??
    []
  );
}

/**
 * Normalizes named runtime exports from the declaring component module and explicitly reviewed
 * sibling modules. Component packages use sibling modules for public catalogs and enumerators, so
 * looking only at the class declaration silently loses callable API. The exporting module path
 * remains on every entry as identity/evidence while mapped comparison requires the public name,
 * kind, and signature.
 */
export function normalizeComponentModuleExports(
  manifest,
  componentModulePath,
  { ecosystem, additionalModules = [] },
) {
  const componentPath = normalizedModulePath(componentModulePath);
  if (!componentPath) return [];
  const scopedModules = new Set([
    componentPath,
    ...additionalModules.map((modulePath) => normalizedModulePath(modulePath)).filter(Boolean),
  ]);
  const declarationIndex = moduleDeclarationIndex(manifest);
  const normalized = [];

  for (const module of manifest.modules ?? []) {
    const modulePath = normalizedModulePath(module.path);
    if (!modulePath || !scopedModules.has(modulePath)) continue;
    const explicitlyScoped = modulePath !== componentPath;
    for (const entry of module.exports ?? []) {
      if (entry.kind !== 'js' || !entry.name || entry.name === 'default' || entry.name === '*') continue;
      const declarations = moduleExportDeclaration(declarationIndex, module, entry);
      const functions = declarations.filter(
        (declaration) =>
          declaration.kind === 'function' &&
          declaration.privacy !== 'private' &&
          declaration.privacy !== 'protected' &&
          (ecosystem === 'lyra' || declaration.privacy === 'public' || Boolean(declaration.description)),
      );
      const variable = declarations.find(
        (declaration) =>
          declaration.kind === 'variable' &&
          declaration.privacy !== 'private' &&
          declaration.privacy !== 'protected' &&
          (ecosystem === 'lyra' || declaration.privacy === 'public' || Boolean(declaration.description)),
      );
      if (functions.length > 0) {
        const callable = normalizeMethodEntries(
          functions.map((declaration) => ({ ...declaration, kind: 'method' })),
          ecosystem,
        )[0];
        normalized.push({
          module: modulePath,
          name: entry.name,
          kind: 'function',
          overloads: callable?.overloads ?? [],
          ...(callable?.deprecated ? { deprecated: callable.deprecated } : {}),
        });
      } else if (variable) {
        normalized.push({
          module: modulePath,
          name: entry.name,
          kind: 'variable',
          type:
            ecosystem !== 'lyra' && !variable.type
              ? UNSPECIFIED_PUBLIC_DOCUMENTATION
              : textOf(variable.type),
          readonly: variable.readonly === true,
          deprecated: variable.deprecation || variable.deprecated || null,
        });
      } else if (declarations.length === 0 && explicitlyScoped) {
        // Published CEMs occasionally retain a real JS export while omitting its variable
        // declaration. Preserve the identity and fail only on absence; no type is invented.
        normalized.push({
          module: modulePath,
          name: entry.name,
          kind: 'unknown',
          type: UNSPECIFIED_PUBLIC_DOCUMENTATION,
          deprecated: null,
        });
      }
    }
  }

  return normalized.sort((left, right) =>
    `${left.module}:${left.name}:${left.kind}`.localeCompare(`${right.module}:${right.name}:${right.kind}`),
  );
}

const REVIEWED_COMPONENT_MODULE_EXPORT_SCOPES = new Map([
  // WA publishes its animation catalogs/enumerators from a sibling component module rather than
  // the custom-element module. This association is explicit so an arbitrary exported helper in a
  // component directory is never silently promoted into the tag's migration surface.
  ['webawesome:wa-animation', ['components/animation/animations.js']],
]);

function normalizeNamed(entries) {
  return sortByName(
    (entries ?? []).map((entry) => ({
      name: entry.name ?? '',
      deprecated: entry.deprecation || entry.deprecated || null,
    })),
  );
}

function normalizeCssProperties(entries, tagName = 'custom element') {
  return sortByName(
    (entries ?? []).map((entry) => {
      if (typeof entry?.name !== 'string' || !entry.name) {
        throw new Error(`${tagName}: malformed CSS custom-property manifest entry`);
      }
      const normalized = {
        name: entry.name,
        deprecated: entry.deprecation || entry.deprecated || null,
        hasDefault: hasOwn(entry, 'default'),
      };
      if (normalized.hasDefault) normalized.default = canonicalDefault(entry.default);
      return normalized;
    }),
  );
}

function eventFlag(description, positive, negative) {
  const text = String(description ?? '').toLowerCase();
  if (negative.test(text)) return false;
  if (positive.test(text)) return true;
  return undefined;
}

const EVENT_CONSTRUCTORS = [
  'AnimationEvent',
  'BeforeUnloadEvent',
  'ClipboardEvent',
  'CloseEvent',
  'CompositionEvent',
  'CustomEvent',
  'DeviceMotionEvent',
  'DeviceOrientationEvent',
  'DragEvent',
  'ErrorEvent',
  'Event',
  'FocusEvent',
  'GamepadEvent',
  'HashChangeEvent',
  'InputEvent',
  'KeyboardEvent',
  'MessageEvent',
  'MouseEvent',
  'PageTransitionEvent',
  'PointerEvent',
  'PopStateEvent',
  'ProgressEvent',
  'PromiseRejectionEvent',
  'SecurityPolicyViolationEvent',
  'StorageEvent',
  'SubmitEvent',
  'ToggleEvent',
  'TouchEvent',
  'TrackEvent',
  'TransitionEvent',
  'UIEvent',
  'WheelEvent',
];
const EVENT_CONSTRUCTOR_PATTERN = EVENT_CONSTRUCTORS.join('|');
const SINGLE_EVENT_TYPE = new RegExp(`^(${EVENT_CONSTRUCTOR_PATTERN})(?:<.*>)?$`, 'u');
const EVENT_UNION_TYPE = new RegExp(
  `^(?:${EVENT_CONSTRUCTOR_PATTERN})(?:<.*>)?(?:\\s*\\|\\s*(?:${EVENT_CONSTRUCTOR_PATTERN})(?:<.*>)?)+$`,
  'u',
);
const EVENT_WITH_COMPATIBILITY_DETAIL = new RegExp(
  `^(${EVENT_CONSTRUCTOR_PATTERN})(?:<.*>)?\\s*&\\s*\\{[^]*\\bdetail\\s*:`,
  'u',
);

function eventConstructor(type) {
  const text = textOf(type);
  const single = SINGLE_EVENT_TYPE.exec(text);
  if (single) return single[1];
  const withCompatibilityDetail = EVENT_WITH_COMPATIBILITY_DETAIL.exec(text);
  if (withCompatibilityDetail) return withCompatibilityDetail[1];
  return EVENT_UNION_TYPE.test(text) ? text : undefined;
}

function normalizeEvents(entries, ecosystem) {
  return sortByName(
    (entries ?? []).map((entry) => {
      const deprecated = entry.deprecation || entry.deprecated || null;
      const normalized = {
        name: entry.name,
        type: textOf(entry.type),
        cancelable: eventCancelabilityFromDescription(entry.description, ecosystem, entry.name),
        ...(deprecated ? { deprecated } : {}),
      };
      const constructor = eventConstructor(entry.type);
      const bubbles = eventFlag(
        entry.description,
        /\b(?:bubbling|bubbles)\b/,
        /\b(?:non[- ]?bubbling|does not bubble|doesn't bubble)\b/,
      );
      const composed = eventFlag(
        entry.description,
        /\bcomposed\b/,
        /\b(?:non[- ]?composed|not composed)\b/,
      );
      if (constructor !== undefined) normalized.constructor = constructor;
      if (bubbles !== undefined) normalized.bubbles = bubbles;
      if (composed !== undefined) normalized.composed = composed;
      return normalized;
    }),
  );
}

function declaredFormAssociation(declaration) {
  if (typeof declaration.formAssociated === 'boolean') return declaration.formAssociated;
  const ownStatic = (declaration.members ?? []).find(
    (member) =>
      member.kind === 'field' &&
      member.name === 'formAssociated' &&
      member.static === true &&
      !member.inheritedFrom,
  );
  if (ownStatic) {
    return ownStatic.default === true || String(ownStatic.default).trim() === 'true';
  }
  if ((declaration.mixins ?? []).some((mixin) => mixin.name === 'FormAssociated')) return true;
  return undefined;
}

function canonicalModulePath(modulePath) {
  return typeof modulePath === 'string'
    ? modulePath.replace(/^\/+/, '').replace(/\.js$/u, '.ts')
    : null;
}

/**
 * Resolves the runtime `static formAssociated` value for every declaration in a manifest.
 *
 * Public members such as `form`, `value`, and `setCustomValidity()` are deliberately irrelevant:
 * charts and filter controls can expose those words for unrelated APIs. FACE status comes only from
 * an own static declaration, the shared `FormAssociated` mixin, or JavaScript static inheritance.
 */
function manifestFormAssociations(manifest) {
  const declarations = [];
  const byModuleAndName = new Map();
  const byName = new Map();
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (!declaration?.name) continue;
      declarations.push(declaration);
      const modulePath = canonicalModulePath(module.path);
      if (modulePath) byModuleAndName.set(`${modulePath}\0${declaration.name}`, declaration);
      const named = byName.get(declaration.name) ?? [];
      named.push(declaration);
      byName.set(declaration.name, named);
    }
  }

  const resolved = new Map();
  const resolving = new Set();
  const resolve = (declaration) => {
    if (resolved.has(declaration)) return resolved.get(declaration);
    if (resolving.has(declaration)) return false;
    resolving.add(declaration);
    const declared = declaredFormAssociation(declaration);
    let associated = declared;
    if (associated === undefined && declaration.superclass?.name) {
      const modulePath = canonicalModulePath(declaration.superclass.module);
      const exact = modulePath
        ? byModuleAndName.get(`${modulePath}\0${declaration.superclass.name}`)
        : undefined;
      const named = byName.get(declaration.superclass.name) ?? [];
      const superclass = exact ?? (named.length === 1 ? named[0] : undefined);
      if (superclass) associated = resolve(superclass);
    }
    if (associated === undefined) {
      // Some analyzers materialize an inherited static field but omit the intermediate base class.
      associated = (declaration.members ?? []).some(
        (member) =>
          member.kind === 'field' &&
          member.name === 'formAssociated' &&
          member.static === true &&
          Boolean(member.inheritedFrom) &&
          (member.default === true || String(member.default).trim() === 'true'),
      );
    }
    resolving.delete(declaration);
    resolved.set(declaration, associated === true);
    return associated === true;
  };
  for (const declaration of declarations) resolve(declaration);
  return resolved;
}

export function normalizeDeclaration(declaration, { ecosystem, formAssociated }) {
  const attributeFieldNames = new Set(
    (declaration.attributes ?? []).flatMap((attribute) => [attribute.fieldName, attribute.name]).filter(Boolean),
  );
  const publicFields = (declaration.members ?? []).filter((member) => isPublicField(member, attributeFieldNames, ecosystem));
  const properties = normalizeProperties(publicFields);
  const methods = normalizeMethods(declaration.members ?? [], ecosystem);
  const staticProperties = normalizeStaticProperties(declaration.members ?? [], ecosystem);
  const staticMethods = normalizeStaticMethods(declaration.members ?? [], ecosystem);
  const events = normalizeEvents(declaration.events, ecosystem);
  const formProperties = properties.filter((entry) => FORM_PROPERTIES.has(entry.name)).map((entry) => entry.name);
  const formMethods = methods.filter((entry) => FORM_METHODS.has(entry.name)).map((entry) => entry.name);
  const delegatedMethods = methods.filter((entry) => NATIVE_METHODS.has(entry.name)).map((entry) => entry.name);
  const forwardedEvents = events.filter((entry) => NATIVE_EVENTS.has(entry.name)).map((entry) => entry.name);
  const associated = formAssociated ?? declaredFormAssociation(declaration) === true;

  return {
    attributes: normalizeAttributes(declaration, publicFields, ecosystem),
    properties,
    slots: normalizeNamed(declaration.slots),
    events,
    parts: normalizeNamed(declaration.cssParts),
    cssProperties: normalizeCssProperties(declaration.cssProperties, declaration.tagName),
    cssStates: normalizeNamed(declaration.cssStates),
    methods,
    staticProperties,
    staticMethods,
    moduleExports: [],
    form: {
      associated,
      properties: unique(formProperties),
      methods: unique(formMethods),
    },
    native: {
      forwardedEvents: unique(forwardedEvents),
      delegatedMethods: unique(delegatedMethods),
    },
    maturity: {
      status: declaration.status || 'unclassified',
      since: declaration.since || null,
      deprecated: declaration.deprecated || null,
    },
  };
}

export function normalizeManifest(manifest, { ecosystem, tierByTag = new Map() }) {
  const components = [];
  const formAssociations = manifestFormAssociations(manifest);
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (!declaration.customElement || !declaration.tagName) continue;
      const normalized = normalizeDeclaration(declaration, {
        ecosystem,
        formAssociated: formAssociations.get(declaration),
      });
      normalized.moduleExports = normalizeComponentModuleExports(manifest, module.path, {
        ecosystem,
        additionalModules:
          REVIEWED_COMPONENT_MODULE_EXPORT_SCOPES.get(`${ecosystem}:${declaration.tagName}`) ?? [],
      });
      components.push({
        tag: declaration.tagName,
        module: module.path || declaration.modulePath || declaration.definitionPath || null,
        tier: tierByTag.get(declaration.tagName) || null,
        maturity: normalized.maturity,
        surface: Object.fromEntries(SURFACE_SECTIONS.map((section) => [section, normalized[section]])),
        review: {
          status: 'complete',
          source: 'published-manifest',
          unreviewedSections: [],
        },
      });
    }
  }
  return components.sort((a, b) => a.tag.localeCompare(b.tag));
}

const UPSTREAM_RUNTIME_PACKAGES = Object.freeze({
  webawesome: '@awesome.me/webawesome',
  shoelace: '@shoelace-style/shoelace',
});

function runtimeEvidenceInvariant(condition, message) {
  if (!condition) throw new Error(message);
}

function exactObjectKeys(value, expected) {
  return value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...expected].sort().join('\0');
}

/**
 * Applies behavior observed from an exact reviewed upstream package only where its published
 * manifest is silent. Evidence is deliberately artifact-bound and path-enumerated: a package
 * update, a newly documented event contract, or a partial observation invalidates the record
 * instead of letting an old runtime assumption survive regeneration.
 */
export function applyRuntimeEventCancelabilityEvidence(
  components,
  evidence,
  { ecosystem, version } = {},
) {
  runtimeEvidenceInvariant(Array.isArray(components), 'runtime cancelability evidence needs normalized components');
  const augmented = structuredClone(components);
  if (evidence === undefined || evidence === null) return augmented;

  runtimeEvidenceInvariant(
    exactObjectKeys(evidence, ['source', 'coverage', 'events']),
    `${String(ecosystem)}: malformed runtime cancelability evidence envelope`,
  );
  runtimeEvidenceInvariant(
    exactObjectKeys(evidence.source, ['package', 'version', 'tarballIntegrity']),
    `${String(ecosystem)}: malformed runtime cancelability evidence source`,
  );
  const expectedPackage = UPSTREAM_RUNTIME_PACKAGES[ecosystem];
  runtimeEvidenceInvariant(
    typeof expectedPackage === 'string' && evidence.source.package === expectedPackage,
    `${String(ecosystem)}: runtime evidence package ${String(evidence.source.package)} does not match ${String(expectedPackage)}`,
  );
  runtimeEvidenceInvariant(
    evidence.source.version === version,
    `${String(ecosystem)}: runtime evidence version ${String(evidence.source.version)} does not match pin ${String(version)}`,
  );
  runtimeEvidenceInvariant(
    typeof evidence.source.tarballIntegrity === 'string' && evidence.source.tarballIntegrity.startsWith('sha512-'),
    `${String(ecosystem)}: runtime evidence needs a SHA-512 package integrity`,
  );
  runtimeEvidenceInvariant(
    evidence.coverage === 'all-public-transition-paths',
    `${String(ecosystem)}: runtime cancelability evidence must cover all public transition paths`,
  );
  runtimeEvidenceInvariant(
    Array.isArray(evidence.events) && evidence.events.length > 0,
    `${String(ecosystem)}: runtime cancelability evidence needs events`,
  );

  const byTag = new Map(augmented.map((component) => [component.tag, component]));
  const seen = new Set();
  for (const observation of evidence.events) {
    runtimeEvidenceInvariant(
      exactObjectKeys(observation, ['tag', 'event', 'cancelable', 'paths']),
      `${String(observation?.tag)}#${String(observation?.event)}: malformed runtime cancelability evidence`,
    );
    const key = `${observation.tag}#${observation.event}`;
    runtimeEvidenceInvariant(!seen.has(key), `duplicate runtime cancelability evidence ${key}`);
    seen.add(key);
    runtimeEvidenceInvariant(
      ['always', 'never', 'conditional'].includes(observation.cancelable),
      `${key}: runtime cancelability evidence has an invalid result`,
    );
    runtimeEvidenceInvariant(
      Array.isArray(observation.paths) &&
        observation.paths.length > 0 &&
        observation.paths.every((path) => typeof path === 'string' && Boolean(path.trim())) &&
        new Set(observation.paths).size === observation.paths.length,
      `${key}: runtime cancelability evidence needs reviewed public paths`,
    );

    const component = byTag.get(observation.tag);
    const event = component?.surface?.events?.find((entry) => entry.name === observation.event);
    runtimeEvidenceInvariant(event, `${key}: runtime cancelability evidence targets an unknown event`);
    runtimeEvidenceInvariant(
      event.cancelable === UNSPECIFIED_PUBLIC_DOCUMENTATION && !event.cancelabilityEvidence,
      `${key}: pinned runtime evidence is stale because the manifest now documents cancelability`,
    );
    event.cancelable = observation.cancelable;
    event.cancelabilityEvidence = 'pinned-runtime';
  }
  return augmented;
}

const METHOD_EDGE_MEASUREMENT_BASES = new Set([
  'ambient-page-viewport',
]);

const METHOD_EDGE_PARITY_EVIDENCE = Object.freeze({
  upstream: 'pinned-package-black-box',
  target: 'lyra-authored-contract-and-automated-tests',
});

const METHOD_EDGE_DIVERGENCE_FLAG =
  'method-edge-return-sentinel-divergence';

function validMethodEdgeOutcome(outcome) {
  if (!outcome || typeof outcome !== 'object' || Array.isArray(outcome)) {
    return false;
  }
  if (outcome.kind === 'sentinel') {
    return (
      exactObjectKeys(outcome, ['kind', 'value']) &&
      (outcome.value === null ||
        typeof outcome.value === 'string' ||
        typeof outcome.value === 'boolean' ||
        (typeof outcome.value === 'number' && Number.isFinite(outcome.value)))
    );
  }
  return (
    outcome.kind === 'measurement' &&
    exactObjectKeys(outcome, ['kind', 'basis']) &&
    METHOD_EDGE_MEASUREMENT_BASES.has(outcome.basis)
  );
}

/**
 * Attaches exact-package black-box method-edge observations where the published manifest exposes
 * the callable shape but omits its return contract. Cases stay symbolic and declarative: they
 * record only public inputs and outcomes, never upstream implementation details. A documented
 * return, changed package pin, duplicate case, or renamed method invalidates the evidence.
 */
export function applyRuntimeMethodEdgeSemanticsEvidence(
  components,
  evidence,
  { ecosystem, version } = {},
) {
  runtimeEvidenceInvariant(
    Array.isArray(components),
    'runtime method-edge evidence needs normalized components',
  );
  const augmented = structuredClone(components);
  if (evidence === undefined || evidence === null) return augmented;

  runtimeEvidenceInvariant(
    exactObjectKeys(evidence, ['source', 'methods']),
    `${String(ecosystem)}: malformed runtime method-edge evidence envelope`,
  );
  runtimeEvidenceInvariant(
    exactObjectKeys(evidence.source, ['package', 'version', 'tarballIntegrity']),
    `${String(ecosystem)}: malformed runtime method-edge evidence source`,
  );
  const expectedPackage = UPSTREAM_RUNTIME_PACKAGES[ecosystem];
  runtimeEvidenceInvariant(
    typeof expectedPackage === 'string' &&
      evidence.source.package === expectedPackage,
    `${String(ecosystem)}: runtime method-edge evidence package ${String(
      evidence.source.package,
    )} does not match ${String(expectedPackage)}`,
  );
  runtimeEvidenceInvariant(
    evidence.source.version === version,
    `${String(ecosystem)}: runtime method-edge evidence version ${String(
      evidence.source.version,
    )} does not match pin ${String(version)}`,
  );
  runtimeEvidenceInvariant(
    typeof evidence.source.tarballIntegrity === 'string' &&
      evidence.source.tarballIntegrity.startsWith('sha512-'),
    `${String(ecosystem)}: runtime method-edge evidence needs a SHA-512 package integrity`,
  );
  runtimeEvidenceInvariant(
    Array.isArray(evidence.methods) && evidence.methods.length > 0,
    `${String(ecosystem)}: runtime method-edge evidence needs methods`,
  );

  const byTag = new Map(
    augmented.map((component) => [component.tag, component]),
  );
  const seenMethods = new Set();
  for (const observation of evidence.methods) {
    runtimeEvidenceInvariant(
      exactObjectKeys(observation, ['tag', 'method', 'cases']),
      `${String(observation?.tag)}#${String(
        observation?.method,
      )}: malformed runtime method-edge evidence`,
    );
    const key = `${observation.tag}#${observation.method}`;
    runtimeEvidenceInvariant(
      !seenMethods.has(key),
      `duplicate runtime method-edge evidence ${key}`,
    );
    seenMethods.add(key);

    const component = byTag.get(observation.tag);
    const method = component?.surface?.methods?.find(
      (entry) => entry.name === observation.method,
    );
    runtimeEvidenceInvariant(
      method,
      `${key}: runtime method-edge evidence targets an unknown method`,
    );
    runtimeEvidenceInvariant(
      (method.overloads ?? []).length > 0 &&
        (method.overloads ?? []).every(
          (overload) =>
            overload.returnType === UNSPECIFIED_PUBLIC_DOCUMENTATION,
        ) &&
        !method.edgeSemantics,
      `${key}: pinned method-edge evidence is stale because the manifest now documents its return`,
    );

    const caseNames = new Set();
    runtimeEvidenceInvariant(
      Array.isArray(observation.cases) &&
        observation.cases.length > 0 &&
        observation.cases.every((entry) => {
          if (
            !exactObjectKeys(entry, ['case', 'arguments', 'outcome']) ||
            typeof entry.case !== 'string' ||
            !entry.case.trim() ||
            caseNames.has(entry.case) ||
            !Array.isArray(entry.arguments) ||
            !entry.arguments.every(
              (argument) =>
                typeof argument === 'string' && Boolean(argument.trim()),
            ) ||
            !(method.overloads ?? []).some(
              (overload) =>
                (overload.parameters ?? []).length === entry.arguments.length,
            ) ||
            !validMethodEdgeOutcome(entry.outcome)
          ) {
            return false;
          }
          caseNames.add(entry.case);
          return true;
        }),
      `${key}: runtime method-edge evidence must cover unique named cases`,
    );
    method.edgeSemantics = {
      evidence: 'pinned-runtime',
      cases: structuredClone(observation.cases),
    };
  }
  return augmented;
}

/** Validates the migration-facing adjudication of artifact-bound method-edge observations. The
 * compact runtime contract no longer carries analyzer surfaces, so callers can omit `upstream`
 * and `target` to retain the schema/classification checks while the authored inventory performs
 * the additional evidence-to-surface comparison. */
export function validateMethodEdgeParity(
  mapping,
  { upstream, target } = {},
) {
  const findings = [];
  const label = mapping?.upstreamTag ?? '<unknown>';
  const methods = mapping?.parity?.methodEdges;
  const observed = (upstream?.methods ?? []).filter(
    (method) => method.edgeSemantics,
  );
  const observedByName = new Map(
    observed.map((method) => [method.name, method]),
  );
  const behaviorFlags = mapping?.parity?.behaviorReviewFlags;
  const hasDivergenceFlag =
    Array.isArray(behaviorFlags) &&
    behaviorFlags.includes(METHOD_EDGE_DIVERGENCE_FLAG);

  if (methods === undefined) {
    if (observed.length > 0) {
      findings.push(`${label}: missing method-edge parity review`);
    }
    if (hasDivergenceFlag) {
      findings.push(`${label}: stale method-edge divergence behavior flag`);
    }
    return findings;
  }
  if (!Array.isArray(methods) || methods.length === 0) {
    findings.push(`${label}: parity.methodEdges must be a non-empty array`);
    if (hasDivergenceFlag) {
      findings.push(`${label}: stale method-edge divergence behavior flag`);
    }
    return findings;
  }

  const seenMethods = new Set();
  let hasDifferentCase = false;
  for (const method of methods) {
    const validMethod =
      exactObjectKeys(method, [
        'method',
        'evidence',
        'cases',
        'rationale',
      ]) &&
      typeof method.method === 'string' &&
      Boolean(method.method.trim()) &&
      exactObjectKeys(method.evidence, ['upstream', 'target']) &&
      method.evidence.upstream === METHOD_EDGE_PARITY_EVIDENCE.upstream &&
      method.evidence.target === METHOD_EDGE_PARITY_EVIDENCE.target &&
      Array.isArray(method.cases) &&
      method.cases.length > 0 &&
      typeof method.rationale === 'string' &&
      Boolean(method.rationale.trim());
    if (!validMethod) {
      findings.push(`${label}: malformed method-edge parity review`);
      continue;
    }
    if (seenMethods.has(method.method)) {
      findings.push(
        `${label}: duplicate method-edge parity review ${method.method}`,
      );
    }
    seenMethods.add(method.method);

    const observedMethod = observedByName.get(method.method);
    if (upstream !== undefined && !observedMethod) {
      findings.push(
        `${label}#${method.method}: stale method-edge parity review`,
      );
    }
    if (
      target !== undefined &&
      !(target.methods ?? []).some((entry) => entry.name === method.method)
    ) {
      findings.push(
        `${label}#${method.method}: dangling method-edge parity target`,
      );
    }

    const observedCases = new Map(
      (observedMethod?.edgeSemantics?.cases ?? []).map((entry) => [
        entry.case,
        entry,
      ]),
    );
    const seenCases = new Set();
    for (const edgeCase of method.cases) {
      const validCase =
        exactObjectKeys(edgeCase, [
          'case',
          'arguments',
          'upstream',
          'target',
          'status',
        ]) &&
        typeof edgeCase.case === 'string' &&
        Boolean(edgeCase.case.trim()) &&
        Array.isArray(edgeCase.arguments) &&
        edgeCase.arguments.every(
          (argument) =>
            typeof argument === 'string' && Boolean(argument.trim()),
        ) &&
        validMethodEdgeOutcome(edgeCase.upstream) &&
        validMethodEdgeOutcome(edgeCase.target) &&
        (edgeCase.status === 'equivalent' ||
          edgeCase.status === 'different');
      if (!validCase) {
        findings.push(
          `${label}#${method.method}: malformed method-edge parity case`,
        );
        continue;
      }
      if (seenCases.has(edgeCase.case)) {
        findings.push(
          `${label}#${method.method}: duplicate method-edge parity case ${edgeCase.case}`,
        );
      }
      seenCases.add(edgeCase.case);
      const expectedStatus = sameJson(edgeCase.upstream, edgeCase.target)
        ? 'equivalent'
        : 'different';
      if (edgeCase.status !== expectedStatus) {
        findings.push(
          `${label}#${method.method}:${edgeCase.case}: stale method-edge parity status`,
        );
      }
      if (expectedStatus === 'different') hasDifferentCase = true;

      if (observedMethod) {
        const observedCase = observedCases.get(edgeCase.case);
        if (
          !observedCase ||
          !sameJson(observedCase.arguments, edgeCase.arguments) ||
          !sameJson(observedCase.outcome, edgeCase.upstream)
        ) {
          findings.push(
            `${label}#${method.method}:${edgeCase.case}: stored upstream method-edge observation is stale`,
          );
        }
      }
    }
    if (observedMethod) {
      for (const observedCase of observedMethod.edgeSemantics.cases ?? []) {
        if (!seenCases.has(observedCase.case)) {
          findings.push(
            `${label}#${method.method}:${observedCase.case}: missing method-edge parity case`,
          );
        }
      }
    }
  }
  if (upstream !== undefined) {
    for (const method of observed) {
      if (!seenMethods.has(method.name)) {
        findings.push(
          `${label}#${method.name}: missing method-edge parity review`,
        );
      }
    }
  }

  if (hasDifferentCase) {
    if (mapping.classification !== 'warning-required') {
      findings.push(
        `${label}: method-edge divergence requires warning-required classification`,
      );
    }
    if (!hasDivergenceFlag) {
      findings.push(
        `${label}: missing ${METHOD_EDGE_DIVERGENCE_FLAG} behavior flag`,
      );
    }
    const missingRationale = methods.some(
      (method) =>
        typeof mapping.rationale !== 'string' ||
        typeof method?.rationale !== 'string' ||
        !mapping.rationale.includes(method.rationale),
    );
    if (missingRationale) {
      findings.push(`${label}: mapping rationale omits method-edge divergence`);
    }
  } else if (hasDivergenceFlag) {
    findings.push(`${label}: stale method-edge divergence behavior flag`);
  }
  return findings;
}

function mappedEventName(name, upstreamPrefix) {
  return name.startsWith(upstreamPrefix) ? `lr-${name.slice(upstreamPrefix.length)}` : name;
}

function polarity(name) {
  if (/^(?:no|not|without|hide|disable)-/.test(name)) return -1;
  if (/^(?:with|show|enable)-/.test(name)) return 1;
  return 0;
}

function polarityStem(name) {
  return name.replace(/^(?:no|not|without|hide|disable|with|show|enable)-/, '');
}

function pushMissing(drift, code, section, name) {
  drift.push({ code, section, member: name });
}

function normalizationKey(memberKind, member) {
  return `${memberKind}:${member}`;
}

function normalizedExpectedDefault(normalizations, memberKind, member, upstreamDefault) {
  const rule = (normalizations.defaultEquivalences ?? []).find(
    (entry) => entry.memberKind === memberKind && entry.member === member && entry.upstream === upstreamDefault,
  );
  return rule ? rule.target : upstreamDefault;
}

function reviewedAttributeProperty(normalizations, attribute, upstreamProperty, targetProperty) {
  return (normalizations.attributePropertyEquivalences ?? []).some(
    (entry) =>
      entry.attribute === attribute &&
      entry.upstream === upstreamProperty &&
      entry.target === targetProperty,
  );
}

function reviewedReflection(normalizations, memberKind, member, upstreamReflects, targetReflects) {
  return (normalizations.reflectionEquivalences ?? []).some(
    (entry) =>
      entry.memberKind === memberKind &&
      entry.member === member &&
      entry.upstream === upstreamReflects &&
      entry.target === targetReflects,
  );
}

function reviewedCssDefault(normalizations, member, upstreamEntry, targetEntry) {
  return (normalizations.cssDefaultEquivalences ?? []).some(
    (entry) =>
      entry.member === member &&
      entry.upstreamHasDefault === upstreamEntry.hasDefault &&
      (!entry.upstreamHasDefault || entry.upstream === upstreamEntry.default) &&
      entry.targetHasDefault === targetEntry.hasDefault &&
      (!entry.targetHasDefault || entry.target === targetEntry.default),
  );
}

function deprecationReplacement(value) {
  if (value && typeof value === 'object') {
    const replacement = value.replacement;
    if (!replacement || typeof replacement !== 'object') return null;
    // A replacement can carry a required value as well as a member name (`canvas="auto"`).
    // Preserve that executable spelling when it is a direct attribute/property usage, while
    // host-CSS and selector examples normalize to the public replacement member itself.
    const usage = typeof replacement.usage === 'string' ? replacement.usage.trim() : '';
    const assignment = /^([a-z][a-z0-9-]*)\s*=\s*["'][^"']+["']$/iu.exec(usage);
    if (assignment?.[1] === replacement.name) return usage.replace(/\s+/gu, '');
    return typeof replacement.name === 'string' && replacement.name ? replacement.name : null;
  }
  if (typeof value !== 'string') return null;
  return /\buse\s+(?:the\s+)?`([^`]+)`/iu.exec(value)?.[1] ??
    // The negative lookahead prevents generic prose such as "use the part named after the
    // component" from being misread as a replacement literally named `the`.
    /\buse\s+(?:the\s+)?(?!the\b)([a-z][a-z0-9-]*)\s+(?:part|property|attribute|slot|method)\b/iu.exec(value)?.[1] ??
    null;
}

function reviewedDeprecation(
  normalizations,
  section,
  member,
  upstreamDeprecated,
  upstreamReplacement,
  targetDeprecated,
  targetReplacement,
) {
  return (normalizations.deprecationEquivalences ?? []).some(
    (entry) =>
      entry.section === section &&
      entry.member === member &&
      entry.upstreamDeprecated === upstreamDeprecated &&
      entry.upstreamReplacement === upstreamReplacement &&
      entry.targetDeprecated === targetDeprecated &&
      entry.targetReplacement === targetReplacement,
  );
}

function rewriteDeprecationReplacement(replacement, rewrites) {
  if (replacement === null) return null;
  const assignment = /^([a-z][a-z0-9-]*)(=.*)$/iu.exec(replacement);
  if (assignment) return `${rewrites.get(assignment[1]) || assignment[1]}${assignment[2]}`;
  return rewrites.get(replacement) || replacement;
}

function reviewedDerivedDefault(normalizations, memberKind, member, upstreamDefault, candidate) {
  if (candidate.hasDefault) return false;
  return (normalizations.derivedDefaultEquivalences ?? []).some(
    (entry) =>
      entry.memberKind === memberKind &&
      entry.member === member &&
      entry.upstream === upstreamDefault,
  );
}

function containsTypePositionKeyword(type, keyword) {
  if (typeof type !== 'string') return false;
  let quote = null;
  for (let index = 0; index < type.length;) {
    const character = type[index];
    if (quote) {
      if (character === '\\') {
        index += 2;
        continue;
      }
      if (character === quote) quote = null;
      index++;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      index++;
      continue;
    }
    if (/[A-Za-z_$]/u.test(character)) {
      let end = index + 1;
      while (end < type.length && /[A-Za-z0-9_$]/u.test(type[end])) end++;
      if (type.slice(index, end) === keyword) {
        let next = end;
        while (next < type.length && /\s/u.test(type[next])) next++;
        if (type[next] === '?') {
          next++;
          while (next < type.length && /\s/u.test(type[next])) next++;
        }
        // A keyword is an ordinary identifier when it names a property/method in a type literal.
        // It is unsafe only in a type position (`value: unknown`, `Array<unknown>`, `unknown[]`,
        // unions, and so on).
        if (type[next] !== ':' && type[next] !== '(') return true;
      }
      index = end;
      continue;
    }
    index++;
  }
  return false;
}

function containsAnyTypeKeyword(type) {
  return containsTypePositionKeyword(type, 'any');
}

function containsUnknownTypeKeyword(type) {
  return containsTypePositionKeyword(type, 'unknown');
}

function containsTemplateInterpolation(type) {
  return typeof type === 'string' && type.includes('$' + '{');
}

function structuralTypeAliasMap(normalizations) {
  return new Map(
    (normalizations?.structuralTypeAliases ?? [])
      .filter(
        (entry) =>
          typeof entry?.name === 'string' &&
          typeof entry.target === 'string',
      )
      .map((entry) => [entry.name, entry.target]),
  );
}

function typeContainsIdentifier(type, identifier) {
  if (typeof type !== 'string') return false;
  return new RegExp(
    `(^|[^A-Za-z0-9_$])${identifier.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}([^A-Za-z0-9_$]|$)`,
    'u',
  ).test(type);
}

function expandStructuralTypeAliases(type, normalizations, resolving = new Set()) {
  if (typeof type !== 'string') return type;
  const aliases = structuralTypeAliasMap(normalizations);
  if (aliases.size === 0) return type;
  let expanded = '';
  let quote = null;
  for (let index = 0; index < type.length;) {
    const character = type[index];
    if (quote) {
      expanded += character;
      if (character === '\\' && index + 1 < type.length) {
        expanded += type[index + 1];
        index += 2;
        continue;
      }
      if (character === quote) quote = null;
      index += 1;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      expanded += character;
      index += 1;
      continue;
    }
    if (/[A-Za-z_$]/u.test(character)) {
      let end = index + 1;
      while (end < type.length && /[A-Za-z0-9_$]/u.test(type[end])) end += 1;
      const identifier = type.slice(index, end);
      const target = aliases.get(identifier);
      if (typeof target === 'string' && !resolving.has(identifier)) {
        expanded += expandStructuralTypeAliases(
          target,
          normalizations,
          new Set([...resolving, identifier]),
        );
      } else {
        expanded += identifier;
      }
      index = end;
      continue;
    }
    expanded += character;
    index += 1;
  }
  return expanded;
}

function reviewedTypeEquivalent(normalizations, memberKind, member, upstreamType, targetType) {
  // `any` is absence of a public contract, never an opaque-but-reviewed equivalent. Quoted
  // literal values such as `'any'` remain ordinary string-literal members.
  if (containsAnyTypeKeyword(upstreamType) || containsAnyTypeKeyword(targetType)) return false;
  if (memberKind === 'event') {
    // Published upstream manifests sometimes expose an unparameterized CustomEvent. That
    // incomplete source-side label may be related to Lyra's concrete EventMap projection by an
    // exact review, but a target-side bare CustomEvent is implicit `any` and cannot be blessed.
    if (
      isUnknownEventType(upstreamType) ||
      isUnknownEventType(targetType) ||
      isBareCustomEventType(targetType)
    ) {
      return false;
    }
  }
  return (normalizations.typeEquivalences ?? []).some(
    (entry) =>
      entry.memberKind === memberKind &&
      entry.member === member &&
      entry.upstream === upstreamType &&
      entry.target === targetType,
  );
}

function reviewedMethodParameterTypeEquivalent(
  normalizations,
  method,
  parameter,
  upstreamType,
  targetType,
) {
  // A method parameter can use a public named structural interface without changing which
  // upstream object literals callers may pass. This still needs an exact per-method review: a
  // generic alias rule would make a changed parameter contract invisible to migration checks.
  if (
    typeof upstreamType !== 'string' ||
    typeof targetType !== 'string' ||
    containsAnyTypeKeyword(upstreamType) ||
    containsAnyTypeKeyword(targetType) ||
    containsUnknownTypeKeyword(upstreamType) ||
    containsUnknownTypeKeyword(targetType) ||
    containsTemplateInterpolation(upstreamType) ||
    containsTemplateInterpolation(targetType)
  ) {
    return false;
  }
  return (normalizations.methodParameterTypeEquivalences ?? []).some(
    (entry) =>
      entry.method === method &&
      entry.parameter === parameter &&
      entry.upstream === upstreamType &&
      entry.target === targetType,
  );
}

// Both cancelability reviews are keyed on the upstream event name and pin both observed labels, so
// a rule stops matching the moment either side moves and `validateMappingNormalizations` reports it
// as stale rather than letting it keep suppressing a difference nobody reviewed. The direction test
// lives here as well as in that validator on purpose: a hand-written rule pointing the wrong way is
// a finding, not a suppression, so the drift it names has to survive the comparison too.
function reviewedCancelability(normalizations, event, upstreamCancelable, targetCancelable) {
  const upstreamRank = CANCELABILITY_RANK.get(upstreamCancelable);
  const targetRank = CANCELABILITY_RANK.get(targetCancelable);
  if (upstreamRank === undefined || targetRank === undefined) return false;
  const matches = (entry) =>
    entry.event === event && entry.upstream === upstreamCancelable && entry.target === targetCancelable;
  if (targetRank > upstreamRank) return (normalizations.cancelabilityEquivalences ?? []).some(matches);
  // The single reviewable narrowing is a Lyra-only emission path that announces itself
  // non-cancelable while every upstream-documented path stays vetoable. A target that drops to
  // `never` has given up the veto outright and is reviewable by nobody.
  return (
    upstreamCancelable === 'always' &&
    targetCancelable === 'conditional' &&
    (normalizations.cancelabilityPathAdditions ?? []).some(matches)
  );
}

function insertionPreservesDefault(rewrites, memberKind, member, upstreamDefault) {
  return (rewrites.defaults ?? []).some(
    (rule) =>
      rule.action === 'insert-if-absent' &&
      rule.memberKind === memberKind &&
      rule.member === member &&
      rule.value === upstreamDefault,
  );
}

function mappedPublicType(type, upstreamPrefix) {
  if (typeof type !== 'string') return type;
  const sourcePrefix = upstreamPrefix === 'wa-' ? 'Wa' : upstreamPrefix === 'sl-' ? 'Sl' : null;
  return sourcePrefix
    ? type.replace(new RegExp(`\\b${sourcePrefix}([A-Z][A-Za-z0-9_$]*)\\b`, 'gu'), 'Lyra$1')
    : type;
}

function hasPublishedType(type) {
  return Boolean(type) && type !== 'unknown' && type !== UNSPECIFIED_PUBLIC_DOCUMENTATION;
}

function splitTopLevelUnion(type) {
  const tokens = [];
  let start = 0;
  let depth = 0;
  let quote = null;
  for (let index = 0; index < type.length; index += 1) {
    const character = type[index];
    if (quote) {
      if (character === quote && type[index - 1] !== '\\') quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if ('([{<'.includes(character)) depth += 1;
    else if ([')', ']', '}', '>'].includes(character)) depth = Math.max(0, depth - 1);
    else if (character === '|' && depth === 0) {
      const token = type.slice(start, index).trim();
      if (token) tokens.push(token);
      start = index + 1;
    }
  }
  const token = type.slice(start).trim();
  if (token) tokens.push(token);
  return tokens;
}

function normalizedTypeTokens(type) {
  if (typeof type !== 'string') return [];
  return splitTopLevelUnion(type.replace(/^\s*\|\s*/u, '').replace(/\s+/gu, ' ').trim());
}

function literalPrimitive(token) {
  if (/^(?:'[^']*'|"[^"]*"|`[^`]*`)$/u.test(token)) return 'string';
  if (/^-?(?:\d+(?:\.\d*)?|\.\d+)$/u.test(token)) return 'number';
  if (token === 'true' || token === 'false') return 'boolean';
  return null;
}

function publicTypeCompatible(expected, actual) {
  if (containsAnyTypeKeyword(expected) || containsAnyTypeKeyword(actual)) return false;
  const expectedTokens = normalizedTypeTokens(expected);
  const actualTokens = normalizedTypeTokens(actual);
  if (expectedTokens.length === actualTokens.length) {
    const actualSet = new Set(actualTokens);
    if (expectedTokens.every((token) => actualSet.has(token))) return true;
  }

  const actualSet = new Set(actualTokens);
  return expectedTokens.every((token) => {
    if (actualSet.has(token)) return true;
    const primitive = literalPrimitive(token);
    if (primitive && actualSet.has(primitive)) return true;
    if (token === 'array' && actualTokens.some((candidate) => /(?:\[\]|Array<.+>)$/u.test(candidate))) return true;
    return false;
  });
}

function canonicalEventType(type) {
  if (typeof type !== 'string') return undefined;
  const trimmed = type.trim();
  const customEvent = /^CustomEvent\s*</u.test(trimmed) && trimmed.endsWith('>');
  const detail = customEvent
    ? trimmed.slice(trimmed.indexOf('<') + 1, -1).trim()
    : trimmed;
  let canonical = '';
  let quote = null;
  let escaped = false;
  let curlyDepth = 0;
  let angleDepth = 0;
  let squareDepth = 0;
  let parenDepth = 0;
  for (const character of detail) {
    if (quote) {
      canonical += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      canonical += character;
      continue;
    }
    if (/\s/u.test(character)) continue;
    if (character === '{') curlyDepth += 1;
    else if (character === '}') curlyDepth = Math.max(0, curlyDepth - 1);
    else if (character === '<') angleDepth += 1;
    else if (character === '>') angleDepth = Math.max(0, angleDepth - 1);
    else if (character === '[') squareDepth += 1;
    else if (character === ']') squareDepth = Math.max(0, squareDepth - 1);
    else if (character === '(') parenDepth += 1;
    else if (character === ')') parenDepth = Math.max(0, parenDepth - 1);
    if (
      character === ',' &&
      curlyDepth > 0 &&
      angleDepth === 0 &&
      squareDepth === 0 &&
      parenDepth === 0
    ) {
      canonical += ';';
    } else {
      canonical += character;
    }
  }
  return canonical.replace(/\bvoid\b/gu, 'undefined').replace(/;\}/gu, '}');
}

function stripBalancedOuterParentheses(type) {
  let text = type.trim();
  while (text.startsWith('(') && text.endsWith(')')) {
    let depth = 0;
    let quote = null;
    let closesAtEnd = false;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (quote) {
        if (character === quote && text[index - 1] !== '\\') quote = null;
        continue;
      }
      if (character === "'" || character === '"' || character === '`') {
        quote = character;
        continue;
      }
      if (character === '(') depth += 1;
      else if (character === ')') {
        depth -= 1;
        if (depth === 0) {
          closesAtEnd = index === text.length - 1;
          break;
        }
      }
    }
    if (!closesAtEnd) break;
    text = text.slice(1, -1).trim();
  }
  return text;
}

function customEventDetailType(type) {
  const text = type.trim();
  const opening = /^CustomEvent\s*</u.exec(text);
  if (!opening) return undefined;
  const start = opening[0].lastIndexOf('<');
  let depth = 0;
  let quote = null;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === quote && text[index - 1] !== '\\') quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '<') depth += 1;
    else if (character === '>') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(index + 1).trim() === ''
          ? text.slice(start + 1, index).trim()
          : undefined;
      }
    }
  }
  return undefined;
}

function hasTopLevelUnknown(type) {
  return splitTopLevelUnion(stripBalancedOuterParentheses(type)).includes('unknown');
}

function isUnknownEventType(type) {
  if (typeof type !== 'string') return false;
  const trimmed = stripBalancedOuterParentheses(type);
  if (hasTopLevelUnknown(trimmed)) return true;
  const detail = customEventDetailType(trimmed);
  return detail !== undefined && hasTopLevelUnknown(detail);
}

function isBareCustomEventType(type) {
  return typeof type === 'string' && /^CustomEvent\s*$/u.test(type.trim());
}

function eventTypeCompatible(expected, actual, normalizations = {}) {
  actual = expandStructuralTypeAliases(actual, normalizations);
  if (
    !hasPublishedType(expected) ||
    !hasPublishedType(actual) ||
    containsAnyTypeKeyword(expected) ||
    containsAnyTypeKeyword(actual) ||
    isUnknownEventType(expected) ||
    isUnknownEventType(actual) ||
    isBareCustomEventType(actual)
  ) {
    return false;
  }
  const expectedCustom = /^CustomEvent\s*</u.test(expected.trim());
  const actualCustom = /^CustomEvent\s*</u.test(actual.trim());
  if (expectedCustom !== actualCustom) {
    const unwrappedSide = expectedCustom ? actual : expected;
    if (eventConstructor(unwrappedSide) !== undefined) return false;
  }
  return canonicalEventType(expected) === canonicalEventType(actual);
}

function parametersMatch(expected, actual, upstreamPrefix, method, normalizations) {
  const expectedParameters = expected ?? [];
  const actualParameters = actual ?? [];
  if (actualParameters.length < expectedParameters.length) return false;
  const reviewedPrefixMatches = expectedParameters.every((parameter, index) => {
    const candidate = actualParameters[index];
    if (
      !candidate ||
      parameter.name !== candidate.name ||
      (
        parameter.type !== UNSPECIFIED_PUBLIC_DOCUMENTATION &&
        mappedPublicType(parameter.type, upstreamPrefix) !== candidate.type &&
        !reviewedMethodParameterTypeEquivalent(
          normalizations,
          method,
          parameter.name,
          parameter.type,
          candidate.type,
        )
      )
    ) {
      return false;
    }
    // A target default is an additive way to accept an omitted argument. It satisfies a reviewed
    // optional parameter even when the analyzer represents `x = value` as defaulted rather than
    // `x?`, and it does not break a source contract that required the argument. A documented
    // upstream default, however, must remain the same value.
    if ((parameter.optional || parameter.hasDefault) && !(candidate.optional || candidate.hasDefault)) return false;
    return !parameter.hasDefault || (candidate.hasDefault && parameter.default === candidate.default);
  });
  if (!reviewedPrefixMatches) return false;

  // Additional target parameters preserve the reviewed call shape only when callers may omit
  // them. This covers platform callbacks whose implementation exposes an optional browser-supplied
  // mode while still rejecting target APIs that introduce a new required argument.
  return actualParameters
    .slice(expectedParameters.length)
    .every((parameter) => parameter.optional || parameter.hasDefault);
}

function overloadMatches(
  method,
  expected,
  actual,
  upstreamPrefix,
  normalizations,
  unknownReturnTypeIsUnspecified = false,
) {
  return (
    parametersMatch(expected.parameters, actual.parameters, upstreamPrefix, method, normalizations) &&
    (
      expected.returnType === UNSPECIFIED_PUBLIC_DOCUMENTATION ||
      (unknownReturnTypeIsUnspecified && expected.returnType === 'unknown') ||
      mappedPublicType(expected.returnType, upstreamPrefix) === actual.returnType
    )
  );
}

function methodOverloadsMatch(
  method,
  expected,
  actual,
  upstreamPrefix,
  normalizations,
  unknownReturnTypeIsUnspecified = false,
) {
  return (expected ?? []).every((overload) =>
    (actual ?? []).some((candidate) =>
      overloadMatches(
        method,
        overload,
        candidate,
        upstreamPrefix,
        normalizations,
        unknownReturnTypeIsUnspecified,
      ),
    ),
  );
}

export function compareMappedSurfaces(upstream, target, { upstreamPrefix, rewrites = {}, normalizations = {} } = {}) {
  const drift = [];
  const attributeRewrites = new Map((rewrites.attributes ?? []).map((entry) => [entry.from, entry.to]));
  const propertyRewrites = new Map((rewrites.properties ?? []).map((entry) => [entry.from, entry.to]));
  const eventRewrites = new Map((rewrites.events ?? []).map((entry) => [entry.from, entry.to]));
  const methodRewrites = new Map((rewrites.methods ?? []).map((entry) => [entry.from, entry.to]));
  const sectionDeprecationRewrites = new Map([
    ['attributes', attributeRewrites],
    ['properties', propertyRewrites],
    ['events', eventRewrites],
    ['methods', methodRewrites],
    ['staticProperties', new Map()],
    ['staticMethods', new Map()],
    ['moduleExports', new Map()],
    ...['slots', 'parts', 'cssProperties', 'cssStates'].map((section) => [
      section,
      new Map((rewrites[section] ?? []).map((entry) => [entry.from, entry.to])),
    ]),
  ]);
  const unknownMethodReturnTypes = new Set(
    (normalizations.unknownMethodReturnTypes ?? []).map((entry) => entry.method),
  );
  const inferredAttributeSuppressions = new Map(
    (normalizations.inferredAttributeSuppressions ?? []).map((entry) => [entry.attribute, entry]),
  );
  const suppressionRequiredProperties = new Set();
  const excludedAttributeProperties = new Set(
    (upstream.attributes ?? [])
      .filter((attribute) => Object.hasOwn(MIGRATION_ATTRIBUTE_EXCLUSIONS, attribute.name))
      .map((attribute) => attribute.property)
      .filter(Boolean),
  );
  const compareDeprecation = (section, upstreamMember, targetMember) => {
    const upstreamDeprecated = Boolean(upstreamMember.deprecated);
    const targetDeprecated = Boolean(targetMember.deprecated);
    const upstreamReplacement = deprecationReplacement(upstreamMember.deprecated);
    const targetReplacement = deprecationReplacement(targetMember.deprecated);
    const expectedReplacement = rewriteDeprecationReplacement(
      upstreamReplacement,
      sectionDeprecationRewrites.get(section) ?? new Map(),
    );
    const mismatch = upstreamDeprecated !== targetDeprecated ||
      (upstreamDeprecated && targetDeprecated && expectedReplacement !== targetReplacement);
    if (
      mismatch &&
      !reviewedDeprecation(
        normalizations,
        section,
        upstreamMember.name,
        upstreamDeprecated,
        upstreamReplacement,
        targetDeprecated,
        targetReplacement,
      )
    ) {
      drift.push({
        code: upstreamDeprecated === targetDeprecated
          ? 'deprecation-replacement-mismatch'
          : 'deprecation-mismatch',
        section,
        member: upstreamMember.name,
        expected: upstreamDeprecated ? expectedReplacement ?? true : false,
        actual: targetDeprecated ? targetReplacement ?? true : false,
      });
    }
  };

  for (const attribute of upstream.attributes ?? []) {
    if (Object.hasOwn(MIGRATION_ATTRIBUTE_EXCLUSIONS, attribute.name)) continue;
    const suppression = inferredAttributeSuppressions.get(attribute.name);
    const requiredProperty = suppression?.property;
    if (requiredProperty && (attribute.inferred === true || suppression.explicit === true)) {
      suppressionRequiredProperties.add(requiredProperty);
      if (!(target.properties ?? []).some((property) => property.name === requiredProperty)) {
        pushMissing(drift, 'missing-property', 'properties', requiredProperty);
      }
      continue;
    }
    const expectedName = attributeRewrites.get(attribute.name) || attribute.name;
    const candidate = (target.attributes ?? []).find((entry) => entry.name === expectedName);
    if (!candidate) {
      const opposite = (target.attributes ?? []).find(
        (entry) => polarityStem(entry.name) === polarityStem(expectedName) && polarity(entry.name) !== polarity(expectedName),
      );
      if (opposite) {
        drift.push({
          code: 'polarity-mismatch',
          section: 'attributes',
          member: attribute.name,
          expected: expectedName,
          actual: opposite.name,
        });
      } else {
        pushMissing(drift, 'missing-attribute', 'attributes', attribute.name);
      }
      continue;
    }
    const expectedType = mappedPublicType(attribute.type, upstreamPrefix);
    if (
      hasPublishedType(attribute.type) &&
      !publicTypeCompatible(expectedType, candidate.type) &&
      !reviewedTypeEquivalent(normalizations, 'attribute', attribute.name, attribute.type, candidate.type)
    ) {
      drift.push({
        code: 'type-mismatch',
        section: 'attributes',
        member: attribute.name,
        expected: expectedType,
        actual: candidate.type,
      });
    }
    const expectedProperty = propertyRewrites.get(attribute.property) || attribute.property;
    if (
      expectedProperty !== candidate.property &&
      !reviewedAttributeProperty(
        normalizations,
        attribute.name,
        attribute.property,
        candidate.property,
      )
    ) {
      drift.push({
        code: 'attribute-property-mismatch',
        section: 'attributes',
        member: attribute.name,
        expected: expectedProperty,
        actual: candidate.property,
      });
    }
    if (
      attribute.reflects !== candidate.reflects &&
      !reviewedReflection(
        normalizations,
        'attribute',
        attribute.name,
        attribute.reflects,
        candidate.reflects,
      )
    ) {
      drift.push({
        code: 'reflection-mismatch',
        section: 'attributes',
        member: attribute.name,
        expected: attribute.reflects,
        actual: hasOwn(candidate, 'reflects') ? candidate.reflects : null,
      });
    }
    const expectedDefault = normalizedExpectedDefault(normalizations, 'attribute', attribute.name, attribute.default);
    if (
      attribute.hasDefault &&
      (!candidate.hasDefault || candidate.default !== expectedDefault) &&
      !reviewedDerivedDefault(normalizations, 'attribute', attribute.name, attribute.default, candidate) &&
      !insertionPreservesDefault(rewrites, 'attribute', attribute.name, expectedDefault)
    ) {
      drift.push({
        code: 'default-mismatch',
        section: 'attributes',
        member: attribute.name,
        expected: expectedDefault,
        actual: candidate.hasDefault ? candidate.default : null,
      });
    }
    compareDeprecation('attributes', attribute, candidate);
  }

  for (const property of upstream.properties ?? []) {
    if (excludedAttributeProperties.has(property.name)) continue;
    const expectedName = propertyRewrites.get(property.name) || property.name;
    const candidate = (target.properties ?? []).find((entry) => entry.name === expectedName);
    if (!candidate && suppressionRequiredProperties.has(expectedName)) continue;
    if ((upstream.attributes ?? []).some((attribute) => attribute.property === property.name)) {
      // Attribute comparison already owns this member's type, reflection, and default. The
      // corresponding JavaScript property remains a separate public contract for existence and
      // writability, so deduplication must not erase a writable-to-readonly loss.
      if (!candidate) pushMissing(drift, 'missing-property', 'properties', property.name);
      else if (property.readonly === false && candidate.readonly !== false) {
        drift.push({
          code: 'readonly-mismatch',
          section: 'properties',
          member: property.name,
          expected: property.readonly,
          actual: hasOwn(candidate, 'readonly') ? candidate.readonly : null,
        });
      }
      if (candidate) compareDeprecation('properties', property, candidate);
      continue;
    }
    if (!candidate) pushMissing(drift, 'missing-property', 'properties', property.name);
    else {
      const expectedType = mappedPublicType(property.type, upstreamPrefix);
      if (
        hasPublishedType(property.type) &&
        !publicTypeCompatible(expectedType, candidate.type) &&
        !reviewedTypeEquivalent(normalizations, 'property', property.name, property.type, candidate.type)
      ) {
        drift.push({
          code: 'type-mismatch',
          section: 'properties',
          member: property.name,
          expected: expectedType,
          actual: candidate.type,
        });
      }
      if (
        property.reflects !== candidate.reflects &&
        !reviewedReflection(
          normalizations,
          'property',
          property.name,
          property.reflects,
          candidate.reflects,
        )
      ) {
        drift.push({
          code: 'reflection-mismatch',
          section: 'properties',
          member: property.name,
          expected: property.reflects,
          actual: hasOwn(candidate, 'reflects') ? candidate.reflects : null,
        });
      }
      if (property.readonly === false && candidate.readonly !== false) {
        drift.push({
          code: 'readonly-mismatch',
          section: 'properties',
          member: property.name,
          expected: property.readonly,
          actual: hasOwn(candidate, 'readonly') ? candidate.readonly : null,
        });
      }
      const expectedDefault = normalizedExpectedDefault(normalizations, 'property', property.name, property.default);
      compareDeprecation('properties', property, candidate);
      if (
        !property.hasDefault ||
        (candidate.hasDefault && candidate.default === expectedDefault) ||
        reviewedDerivedDefault(normalizations, 'property', property.name, property.default, candidate) ||
        insertionPreservesDefault(rewrites, 'property', property.name, expectedDefault)
      ) continue;
      drift.push({
        code: 'default-mismatch',
        section: 'properties',
        member: property.name,
        expected: expectedDefault,
        actual: candidate.hasDefault ? candidate.default : null,
      });
    }
  }

  for (const property of upstream.staticProperties ?? []) {
    const candidate = (target.staticProperties ?? []).find((entry) => entry.name === property.name);
    if (!candidate) {
      pushMissing(drift, 'missing-static-property', 'staticProperties', property.name);
      continue;
    }
    const expectedType = mappedPublicType(property.type, upstreamPrefix);
    if (
      hasPublishedType(property.type) &&
      !publicTypeCompatible(expectedType, candidate.type) &&
      !reviewedTypeEquivalent(
        normalizations,
        'staticProperty',
        property.name,
        property.type,
        candidate.type,
      )
    ) {
      drift.push({
        code: 'static-property-type-mismatch',
        section: 'staticProperties',
        member: property.name,
        expected: expectedType,
        actual: candidate.type,
      });
    }
    if (property.readonly === false && candidate.readonly !== false) {
      drift.push({
        code: 'static-property-readonly-mismatch',
        section: 'staticProperties',
        member: property.name,
        expected: false,
        actual: hasOwn(candidate, 'readonly') ? candidate.readonly : null,
      });
    }
    compareDeprecation('staticProperties', property, candidate);
  }

  for (const [section, code] of [
    ['slots', 'missing-slot'],
    ['parts', 'missing-part'],
    ['cssProperties', 'missing-css-property'],
    ['cssStates', 'missing-css-state'],
  ]) {
    const targetEntries = new Map((target[section] ?? []).map((entry) => [entry.name, entry]));
    const sectionRewrites = new Map((rewrites[section] ?? []).map((entry) => [entry.from, entry.to]));
    for (const entry of upstream[section] ?? []) {
      const expectedName = sectionRewrites.get(entry.name) || entry.name;
      const candidate = targetEntries.get(expectedName);
      if (!candidate) {
        pushMissing(drift, code, section, entry.name);
        continue;
      }
      if (section === 'cssProperties') {
        const defaultsMatch =
          entry.hasDefault === candidate.hasDefault &&
          (!entry.hasDefault || entry.default === candidate.default);
        if (
          !defaultsMatch &&
          !reviewedCssDefault(normalizations, entry.name, entry, candidate)
        ) {
          drift.push({
            code: 'css-default-mismatch',
            section,
            member: entry.name,
            expectedHasDefault: entry.hasDefault,
            expected: entry.hasDefault ? entry.default : null,
            actualHasDefault: candidate.hasDefault,
            actual: candidate.hasDefault ? candidate.default : null,
          });
        }
      }
      compareDeprecation(section, entry, candidate);
    }
  }

  for (const method of upstream.methods ?? []) {
    const expectedName = methodRewrites.get(method.name) || method.name;
    const candidate = (target.methods ?? []).find((entry) => entry.name === expectedName);
    if (!candidate) {
      pushMissing(drift, 'missing-method', 'methods', method.name);
    } else if (
      !methodOverloadsMatch(
        method.name,
        method.overloads,
        candidate.overloads,
        upstreamPrefix,
        normalizations,
        unknownMethodReturnTypes.has(method.name),
      )
    ) {
      drift.push({
        code: 'method-signature-mismatch',
        section: 'methods',
        member: method.name,
        expected: method.overloads,
        actual: candidate.overloads,
      });
    }
    if (candidate) compareDeprecation('methods', method, candidate);
  }

  for (const method of upstream.staticMethods ?? []) {
    const candidate = (target.staticMethods ?? []).find((entry) => entry.name === method.name);
    if (!candidate) {
      pushMissing(drift, 'missing-static-method', 'staticMethods', method.name);
    } else if (
      !methodOverloadsMatch(
        method.name,
        method.overloads,
        candidate.overloads,
        upstreamPrefix,
        normalizations,
      )
    ) {
      drift.push({
        code: 'static-method-signature-mismatch',
        section: 'staticMethods',
        member: method.name,
        expected: method.overloads,
        actual: candidate.overloads,
      });
    }
    if (candidate) compareDeprecation('staticMethods', method, candidate);
  }

  for (const exported of upstream.moduleExports ?? []) {
    const candidates = (target.moduleExports ?? []).filter((entry) => entry.name === exported.name);
    if (candidates.length === 0) {
      drift.push({
        code: 'missing-module-export',
        section: 'moduleExports',
        member: exported.name,
        module: exported.module,
      });
      continue;
    }
    if (exported.kind === 'unknown') continue;
    const sameKind = candidates.filter((entry) => entry.kind === exported.kind);
    if (sameKind.length === 0) {
      drift.push({
        code: 'module-export-kind-mismatch',
        section: 'moduleExports',
        member: exported.name,
        module: exported.module,
        expected: exported.kind,
        actual: unique(candidates.map((entry) => entry.kind)),
      });
      continue;
    }
    if (exported.kind === 'function') {
      const compatible = sameKind.some((candidate) =>
        methodOverloadsMatch(
          exported.name,
          exported.overloads,
          candidate.overloads,
          upstreamPrefix,
          normalizations,
        ),
      );
      if (!compatible) {
        drift.push({
          code: 'module-export-signature-mismatch',
          section: 'moduleExports',
          member: exported.name,
          module: exported.module,
          expected: exported.overloads,
          actual: sameKind.map((candidate) => candidate.overloads),
        });
      }
    } else if (
      hasPublishedType(exported.type) &&
      !sameKind.some((candidate) =>
        publicTypeCompatible(mappedPublicType(exported.type, upstreamPrefix), candidate.type) ||
        reviewedTypeEquivalent(
          normalizations,
          'moduleExport',
          exported.name,
          exported.type,
          candidate.type,
        ),
      )
    ) {
      drift.push({
        code: 'module-export-type-mismatch',
        section: 'moduleExports',
        member: exported.name,
        module: exported.module,
        expected: mappedPublicType(exported.type, upstreamPrefix),
        actual: unique(sameKind.map((candidate) => candidate.type)),
      });
    }
  }

  for (const event of upstream.events ?? []) {
    const expectedName = eventRewrites.get(event.name) || mappedEventName(event.name, upstreamPrefix);
    const candidate = (target.events ?? []).find((entry) => entry.name === expectedName);
    if (!candidate) {
      pushMissing(drift, 'missing-event', 'events', event.name);
    } else {
      const expectedType = mappedPublicType(event.type, upstreamPrefix);
      if (
        hasPublishedType(event.type) &&
        !eventTypeCompatible(expectedType, candidate.type, normalizations) &&
        !reviewedTypeEquivalent(
          normalizations,
          'event',
          event.name,
          event.type,
          candidate.type,
        )
      ) {
        drift.push({
          code: 'event-type-mismatch',
          section: 'events',
          member: event.name,
          expected: expectedType,
          actual: candidate.type,
        });
      }
      if (
        event.cancelable !== UNSPECIFIED_PUBLIC_DOCUMENTATION &&
        candidate.cancelable !== event.cancelable &&
        !reviewedCancelability(normalizations, event.name, event.cancelable, candidate.cancelable)
      ) {
        drift.push({
          code: 'cancelability-mismatch',
          section: 'events',
          member: event.name,
          expected: event.cancelable,
          actual: candidate.cancelable,
        });
      }
      for (const [field, code] of [
        ['constructor', 'event-constructor-mismatch'],
        ['bubbles', 'event-bubbles-mismatch'],
        ['composed', 'event-composed-mismatch'],
      ]) {
        if (!hasOwn(event, field) || candidate[field] === event[field]) continue;
        drift.push({
          code,
          section: 'events',
          member: event.name,
          expected: event[field],
          actual: hasOwn(candidate, field) ? candidate[field] : null,
        });
      }
      compareDeprecation('events', event, candidate);
    }
  }

  if (upstream.form?.associated && !target.form?.associated) {
    drift.push({
      code: 'form-association-mismatch',
      section: 'form',
      member: 'associated',
    });
  }
  for (const property of upstream.form?.properties ?? []) {
    if (!(target.form?.properties ?? []).includes(property)) pushMissing(drift, 'missing-form-property', 'form', property);
  }
  for (const method of upstream.form?.methods ?? []) {
    if (!(target.form?.methods ?? []).includes(method)) pushMissing(drift, 'missing-form-method', 'form', method);
  }
  for (const event of upstream.native?.forwardedEvents ?? []) {
    if (!(target.native?.forwardedEvents ?? []).includes(event)) pushMissing(drift, 'missing-native-event', 'native', event);
  }
  for (const method of upstream.native?.delegatedMethods ?? []) {
    if (!(target.native?.delegatedMethods ?? []).includes(method)) pushMissing(drift, 'missing-native-method', 'native', method);
  }

  return drift.sort((a, b) => `${a.section}:${a.member}:${a.code}`.localeCompare(`${b.section}:${b.member}:${b.code}`));
}

function validateSurface(surface, label, findings) {
  if (!surface || typeof surface !== 'object') {
    findings.push(`${label}: missing normalized surface`);
    return;
  }
  for (const section of SURFACE_SECTIONS) {
    if (section === 'form' || section === 'native') {
      if (!surface[section] || typeof surface[section] !== 'object') findings.push(`${label}: missing ${section} contract`);
    } else if (!Array.isArray(surface[section])) {
      findings.push(`${label}: ${section} must be an array`);
    }
  }
  for (const event of surface.events ?? []) {
    if (!['always', 'never', 'conditional', UNSPECIFIED_PUBLIC_DOCUMENTATION].includes(event.cancelable)) {
      findings.push(`${label}: event ${event.name} has unreviewed cancelability`);
    }
    if (hasOwn(event, 'cancelabilityEvidence')) {
      const valid = event.cancelable !== UNSPECIFIED_PUBLIC_DOCUMENTATION &&
        event.cancelabilityEvidence === 'pinned-runtime';
      if (!valid) findings.push(`${label}: event ${event.name} has malformed cancelability evidence`);
    }
  }
  for (const method of surface.methods ?? []) {
    if (!hasOwn(method, 'edgeSemantics')) continue;
    const edgeSemantics = method.edgeSemantics;
    const caseNames = new Set();
    const valid =
      exactObjectKeys(edgeSemantics, ['evidence', 'cases']) &&
      edgeSemantics.evidence === 'pinned-runtime' &&
      Array.isArray(edgeSemantics.cases) &&
      edgeSemantics.cases.length > 0 &&
      edgeSemantics.cases.every((entry) => {
        if (
          !exactObjectKeys(entry, ['case', 'arguments', 'outcome']) ||
          typeof entry.case !== 'string' ||
          !entry.case.trim() ||
          caseNames.has(entry.case) ||
          !Array.isArray(entry.arguments) ||
          !entry.arguments.every(
            (argument) =>
              typeof argument === 'string' && Boolean(argument.trim()),
          ) ||
          !validMethodEdgeOutcome(entry.outcome)
        ) {
          return false;
        }
        caseNames.add(entry.case);
        return true;
      });
    if (!valid) {
      findings.push(
        `${label}: method ${method.name} has malformed edge-semantics evidence`,
      );
    }
  }
}

function validateRewrites(mapping, findings) {
  if (!mapping.rewrites || typeof mapping.rewrites !== 'object') {
    findings.push(`${mapping.upstreamTag}: missing deterministic rewrite contract`);
    return;
  }
  for (const section of REWRITE_RULE_SECTIONS) {
    if (!Array.isArray(mapping.rewrites[section])) {
      findings.push(`${mapping.upstreamTag}: rewrites.${section} must be an array`);
    }
  }
  for (const section of Object.keys(mapping.rewrites)) {
    if (!REWRITE_RULE_SECTIONS.includes(section)) {
      findings.push(`${mapping.upstreamTag}: unknown rewrite section ${section}`);
    }
  }
  for (const section of REWRITE_RULE_SECTIONS.filter((name) => name !== 'defaults')) {
    const seen = new Set();
    for (const rule of mapping.rewrites[section] ?? []) {
      const keys = rule && typeof rule === 'object' ? Object.keys(rule) : [];
      if (
        !rule ||
        typeof rule.from !== 'string' ||
        !rule.from ||
        typeof rule.to !== 'string' ||
        !rule.to ||
        keys.some((key) => key !== 'from' && key !== 'to')
      ) {
        findings.push(`${mapping.upstreamTag}: invalid rewrites.${section} rule`);
        continue;
      }
      if (rule.from === rule.to) findings.push(`${mapping.upstreamTag}: identity rewrites.${section} rule`);
      if (seen.has(rule.from)) findings.push(`${mapping.upstreamTag}: duplicate rewrites.${section} source ${rule.from}`);
      seen.add(rule.from);
    }
  }
  const seenDefaults = new Set();
  for (const rule of mapping.rewrites.defaults ?? []) {
    const action = rule?.action;
    const allowedKeys =
      action === 'insert-if-absent'
        ? new Set(['memberKind', 'member', 'action', 'value'])
        : action === 'replace-value'
        ? new Set(['memberKind', 'member', 'action', 'from', 'to'])
        : new Set();
    const keys = rule && typeof rule === 'object' ? Object.keys(rule) : [];
    const valid =
      (rule?.memberKind === 'attribute' || rule?.memberKind === 'property') &&
      typeof rule.member === 'string' &&
      Boolean(rule.member) &&
      allowedKeys.size > 0 &&
      keys.every((key) => allowedKeys.has(key)) &&
      (action === 'insert-if-absent'
        ? rule.memberKind === 'attribute' &&
          Object.hasOwn(rule, 'value') &&
          (rule.value === null ||
            ['string', 'boolean'].includes(typeof rule.value) ||
            (typeof rule.value === 'number' && Number.isFinite(rule.value)))
        : Object.hasOwn(rule, 'from') &&
          Object.hasOwn(rule, 'to') &&
          rule.from !== rule.to &&
          [rule.from, rule.to].every(
            (value) =>
              value === null || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value)),
          ));
    if (!valid) {
      findings.push(`${mapping.upstreamTag}: invalid rewrites.defaults rule`);
      continue;
    }
    const key = `${rule.memberKind}:${rule.member}:${action}`;
    if (seenDefaults.has(key)) findings.push(`${mapping.upstreamTag}: duplicate rewrites.defaults rule ${key}`);
    seenDefaults.add(key);
  }
}

function validateDefaultRewriteSemantics(mapping, { upstream, target } = {}) {
  const findings = [];
  for (const rule of mapping.rewrites?.defaults ?? []) {
    if (rule?.action !== 'insert-if-absent') continue;
    const section = rule.memberKind === 'attribute' ? 'attributes' : 'properties';
    const sourceMember = (upstream?.[section] ?? []).find((entry) => entry.name === rule.member);
    const targetMember = (target?.[section] ?? []).find((entry) => entry.name === rule.member);
    if (!sourceMember) {
      findings.push(`${mapping.upstreamTag}: dangling upstream default rewrite ${rule.memberKind}:${rule.member}`);
    } else if (!sourceMember.hasDefault || sourceMember.default !== rule.value) {
      findings.push(`${mapping.upstreamTag}: stale upstream default rewrite ${rule.memberKind}:${rule.member}`);
    }
    if (!targetMember) {
      findings.push(`${mapping.upstreamTag}: dangling target default rewrite ${rule.memberKind}:${rule.member}`);
    } else if (targetMember.hasDefault && targetMember.default === rule.value) {
      findings.push(`${mapping.upstreamTag}: stale target default rewrite ${rule.memberKind}:${rule.member}`);
    }
  }
  return findings;
}

function isReviewedScalar(value) {
  return value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
}

export function validateMappingNormalizations(mapping, { upstream, target } = {}) {
  const findings = [];
  const normalizations = mapping.normalizations;
  // Older generated inventories can omit the comparison-only contract. The generator writes an
  // explicit empty contract for fresh mappings; omission itself does not authorize a suppression.
  if (normalizations === undefined) return findings;
  if (!normalizations || typeof normalizations !== 'object' || Array.isArray(normalizations)) {
    return [`${mapping.upstreamTag}: normalizations must be an object`];
  }
  for (const section of NORMALIZATION_SECTIONS) {
    if (!Array.isArray(normalizations[section])) {
      findings.push(`${mapping.upstreamTag}: normalizations.${section} must be an array`);
    }
  }
  for (const section of Object.keys(normalizations)) {
    if (!NORMALIZATION_SECTIONS.includes(section)) {
      findings.push(`${mapping.upstreamTag}: unknown normalization section ${section}`);
    }
  }

  const attributeRewrites = new Map((mapping.rewrites?.attributes ?? []).map((entry) => [entry.from, entry.to]));
  const propertyRewrites = new Map((mapping.rewrites?.properties ?? []).map((entry) => [entry.from, entry.to]));
  const seenAttributeProperties = new Set();
  for (const rule of normalizations.attributePropertyEquivalences ?? []) {
    const valid =
      typeof rule?.attribute === 'string' && Boolean(rule.attribute) &&
      typeof rule.upstream === 'string' && Boolean(rule.upstream) &&
      typeof rule.target === 'string' && Boolean(rule.target) &&
      Object.keys(rule).length === 3;
    if (!valid) {
      findings.push(`${mapping.upstreamTag}: invalid normalizations.attributePropertyEquivalences rule`);
      continue;
    }
    if (seenAttributeProperties.has(rule.attribute)) {
      findings.push(`${mapping.upstreamTag}: duplicate attribute-property normalization ${rule.attribute}`);
    }
    seenAttributeProperties.add(rule.attribute);
    const source = (upstream?.attributes ?? []).find((entry) => entry.name === rule.attribute);
    const targetName = attributeRewrites.get(rule.attribute) || rule.attribute;
    const candidate = (target?.attributes ?? []).find((entry) => entry.name === targetName);
    if (!source) findings.push(`${mapping.upstreamTag}: dangling upstream attribute-property normalization ${rule.attribute}`);
    else if (source.property !== rule.upstream) findings.push(`${mapping.upstreamTag}: stale upstream attribute-property normalization ${rule.attribute}`);
    if (!candidate) findings.push(`${mapping.upstreamTag}: dangling target attribute-property normalization ${rule.attribute}`);
    else if (candidate.property !== rule.target) findings.push(`${mapping.upstreamTag}: stale target attribute-property normalization ${rule.attribute}`);
    else if ((propertyRewrites.get(rule.upstream) || rule.upstream) === rule.target) {
      findings.push(`${mapping.upstreamTag}: stale equivalent attribute-property normalization ${rule.attribute}`);
    }
  }

  const seenReflections = new Set();
  for (const rule of normalizations.reflectionEquivalences ?? []) {
    const valid =
      ['attribute', 'property'].includes(rule?.memberKind) &&
      typeof rule.member === 'string' && Boolean(rule.member) &&
      typeof rule.upstream === 'boolean' && typeof rule.target === 'boolean' &&
      rule.upstream !== rule.target && Object.keys(rule).length === 4;
    if (!valid) {
      findings.push(`${mapping.upstreamTag}: invalid normalizations.reflectionEquivalences rule`);
      continue;
    }
    const key = `${rule.memberKind}:${rule.member}`;
    if (seenReflections.has(key)) findings.push(`${mapping.upstreamTag}: duplicate reflection normalization ${key}`);
    seenReflections.add(key);
    const section = rule.memberKind === 'attribute' ? 'attributes' : 'properties';
    const rewrites = rule.memberKind === 'attribute' ? attributeRewrites : propertyRewrites;
    const source = (upstream?.[section] ?? []).find((entry) => entry.name === rule.member);
    const candidate = (target?.[section] ?? []).find((entry) => entry.name === (rewrites.get(rule.member) || rule.member));
    if (!source) findings.push(`${mapping.upstreamTag}: dangling upstream reflection normalization ${key}`);
    else if (source.reflects !== rule.upstream) findings.push(`${mapping.upstreamTag}: stale upstream reflection normalization ${key}`);
    if (!candidate) findings.push(`${mapping.upstreamTag}: dangling target reflection normalization ${key}`);
    else if (candidate.reflects !== rule.target) findings.push(`${mapping.upstreamTag}: stale target reflection normalization ${key}`);
  }

  const seenCssDefaults = new Set();
  for (const rule of normalizations.cssDefaultEquivalences ?? []) {
    const expectedKeys = new Set(['member', 'upstreamHasDefault', 'targetHasDefault']);
    if (rule?.upstreamHasDefault === true) expectedKeys.add('upstream');
    if (rule?.targetHasDefault === true) expectedKeys.add('target');
    const keys = rule && typeof rule === 'object' ? Object.keys(rule) : [];
    const valid = typeof rule?.member === 'string' && Boolean(rule.member) &&
      typeof rule.upstreamHasDefault === 'boolean' &&
      typeof rule.targetHasDefault === 'boolean' &&
      (rule.upstreamHasDefault !== true || isReviewedScalar(rule.upstream)) &&
      (rule.targetHasDefault !== true || isReviewedScalar(rule.target)) &&
      keys.length === expectedKeys.size && keys.every((key) => expectedKeys.has(key)) &&
      (rule.upstreamHasDefault !== rule.targetHasDefault ||
        (rule.upstreamHasDefault && rule.upstream !== rule.target));
    if (!valid) {
      findings.push(`${mapping.upstreamTag}: invalid normalizations.cssDefaultEquivalences rule`);
      continue;
    }
    if (seenCssDefaults.has(rule.member)) findings.push(`${mapping.upstreamTag}: duplicate CSS-default normalization ${rule.member}`);
    seenCssDefaults.add(rule.member);
    const source = (upstream?.cssProperties ?? []).find((entry) => entry.name === rule.member);
    const targetName = new Map((mapping.rewrites?.cssProperties ?? []).map((entry) => [entry.from, entry.to])).get(rule.member) || rule.member;
    const candidate = (target?.cssProperties ?? []).find((entry) => entry.name === targetName);
    if (!source) findings.push(`${mapping.upstreamTag}: dangling upstream CSS-default normalization ${rule.member}`);
    else if (source.hasDefault !== rule.upstreamHasDefault ||
      (rule.upstreamHasDefault && source.default !== rule.upstream)) {
      findings.push(`${mapping.upstreamTag}: stale upstream CSS-default normalization ${rule.member}`);
    }
    if (!candidate) findings.push(`${mapping.upstreamTag}: dangling target CSS-default normalization ${rule.member}`);
    else if (candidate.hasDefault !== rule.targetHasDefault ||
      (rule.targetHasDefault && candidate.default !== rule.target)) {
      findings.push(`${mapping.upstreamTag}: stale target CSS-default normalization ${rule.member}`);
    }
  }

  const seenDeprecations = new Set();
  for (const rule of normalizations.deprecationEquivalences ?? []) {
    const valid = [
      'attributes',
      'properties',
      'slots',
      'events',
      'parts',
      'cssProperties',
      'cssStates',
      'methods',
      'staticProperties',
      'staticMethods',
      'moduleExports',
    ].includes(rule?.section) &&
      typeof rule.member === 'string' && Boolean(rule.member) &&
      typeof rule.upstreamDeprecated === 'boolean' &&
      (rule.upstreamReplacement === null || typeof rule.upstreamReplacement === 'string') &&
      typeof rule.targetDeprecated === 'boolean' &&
      (rule.targetReplacement === null || typeof rule.targetReplacement === 'string') &&
      Object.keys(rule).length === 6;
    if (!valid) {
      findings.push(`${mapping.upstreamTag}: invalid normalizations.deprecationEquivalences rule`);
      continue;
    }
    const key = `${rule.section}:${rule.member}`;
    if (seenDeprecations.has(key)) findings.push(`${mapping.upstreamTag}: duplicate deprecation normalization ${key}`);
    seenDeprecations.add(key);
    const sectionRewrites = new Map((mapping.rewrites?.[rule.section] ?? []).map((entry) => [entry.from, entry.to]));
    const targetName = sectionRewrites.get(rule.member) || rule.member;
    const source = (upstream?.[rule.section] ?? []).find((entry) => entry.name === rule.member);
    const candidate = (target?.[rule.section] ?? []).find((entry) => entry.name === targetName);
    if (!source) {
      findings.push(`${mapping.upstreamTag}: dangling upstream deprecation normalization ${key}`);
      continue;
    }
    if (!candidate) {
      findings.push(`${mapping.upstreamTag}: dangling target deprecation normalization ${key}`);
      continue;
    }
    const sourceDeprecated = Boolean(source.deprecated);
    const sourceReplacement = deprecationReplacement(source.deprecated);
    const targetDeprecated = Boolean(candidate.deprecated);
    const targetReplacement = deprecationReplacement(candidate.deprecated);
    if (
      sourceDeprecated !== rule.upstreamDeprecated ||
      sourceReplacement !== rule.upstreamReplacement
    ) findings.push(`${mapping.upstreamTag}: stale upstream deprecation normalization ${key}`);
    if (
      targetDeprecated !== rule.targetDeprecated ||
      targetReplacement !== rule.targetReplacement
    ) findings.push(`${mapping.upstreamTag}: stale target deprecation normalization ${key}`);
    const expectedReplacement = rewriteDeprecationReplacement(sourceReplacement, sectionRewrites);
    if (
      sourceDeprecated === targetDeprecated &&
      expectedReplacement === targetReplacement
    ) findings.push(`${mapping.upstreamTag}: stale equivalent deprecation normalization ${key}`);
  }

  const seenStructuralAliases = new Set();
  const structuralAliasRules = new Map();
  for (const rule of normalizations.structuralTypeAliases ?? []) {
    const keys = rule && typeof rule === 'object' ? Object.keys(rule) : [];
    const valid =
      typeof rule?.name === 'string' &&
      /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(rule.name) &&
      typeof rule.target === 'string' &&
      Boolean(rule.target.trim()) &&
      !containsAnyTypeKeyword(rule.target) &&
      !containsUnknownTypeKeyword(rule.target) &&
      !containsTemplateInterpolation(rule.target) &&
      keys.length === 2 &&
      keys.every((key) => key === 'name' || key === 'target');
    if (!valid) {
      findings.push(
        `${mapping.upstreamTag}: invalid normalizations.structuralTypeAliases rule`,
      );
      continue;
    }
    if (seenStructuralAliases.has(rule.name)) {
      findings.push(
        `${mapping.upstreamTag}: duplicate structural type alias ${rule.name}`,
      );
    }
    seenStructuralAliases.add(rule.name);
    structuralAliasRules.set(rule.name, rule.target);
  }
  const reachableStructuralAliases = new Set();
  const visitStructuralAlias = (name, trail = new Set()) => {
    if (trail.has(name)) {
      findings.push(`${mapping.upstreamTag}: cyclic structural type alias ${name}`);
      return;
    }
    if (reachableStructuralAliases.has(name)) return;
    const targetType = structuralAliasRules.get(name);
    if (targetType === undefined) return;
    reachableStructuralAliases.add(name);
    const nextTrail = new Set([...trail, name]);
    for (const candidate of structuralAliasRules.keys()) {
      if (typeContainsIdentifier(targetType, candidate)) {
        visitStructuralAlias(candidate, nextTrail);
      }
    }
  };
  for (const event of target?.events ?? []) {
    for (const name of structuralAliasRules.keys()) {
      if (typeContainsIdentifier(event.type, name)) visitStructuralAlias(name);
    }
  }
  for (const name of structuralAliasRules.keys()) {
    if (!reachableStructuralAliases.has(name)) {
      findings.push(
        `${mapping.upstreamTag}: stale structural type alias ${name}`,
      );
    }
  }

  const seenTypes = new Set();
  for (const rule of normalizations.typeEquivalences ?? []) {
    const keys = rule && typeof rule === 'object' ? Object.keys(rule) : [];
    const valid =
      (rule?.memberKind === 'attribute' ||
        rule?.memberKind === 'property' ||
        rule?.memberKind === 'event' ||
        rule?.memberKind === 'staticProperty' ||
        rule?.memberKind === 'moduleExport') &&
      typeof rule.member === 'string' &&
      Boolean(rule.member) &&
      typeof rule.upstream === 'string' &&
      Boolean(rule.upstream) &&
      typeof rule.target === 'string' &&
      Boolean(rule.target) &&
      rule.upstream !== rule.target &&
      keys.length === 4 &&
      keys.every((key) => ['memberKind', 'member', 'upstream', 'target'].includes(key));
    if (!valid) {
      findings.push(`${mapping.upstreamTag}: invalid normalizations.typeEquivalences rule`);
      continue;
    }
    const key = normalizationKey(rule.memberKind, rule.member);
    if (
      containsAnyTypeKeyword(rule.upstream) ||
      containsAnyTypeKeyword(rule.target) ||
      (rule.memberKind === 'event' && isBareCustomEventType(rule.target))
    ) {
      findings.push(`${mapping.upstreamTag}: unsafe any type normalization ${key}`);
    }
    if (
      rule.memberKind === 'event' &&
      (isUnknownEventType(rule.upstream) || isUnknownEventType(rule.target))
    ) {
      findings.push(`${mapping.upstreamTag}: unsafe unknown event type normalization ${key}`);
    }
    if (seenTypes.has(key)) {
      findings.push(`${mapping.upstreamTag}: duplicate normalizations.typeEquivalences rule ${key}`);
    }
    seenTypes.add(key);

    const section =
      rule.memberKind === 'attribute'
        ? 'attributes'
        : rule.memberKind === 'property'
          ? 'properties'
          : rule.memberKind === 'event'
            ? 'events'
            : rule.memberKind === 'staticProperty'
              ? 'staticProperties'
              : 'moduleExports';
    const rewrites = new Map((mapping.rewrites?.[section] ?? []).map((entry) => [entry.from, entry.to]));
    const upstreamPrefix = mapping.upstreamTag?.startsWith('wa-') ? 'wa-' : 'sl-';
    const targetName =
      rewrites.get(rule.member) ||
      (rule.memberKind === 'event'
        ? mappedEventName(rule.member, upstreamPrefix)
        : rule.member);
    const upstreamMember = (upstream?.[section] ?? []).find((entry) => entry.name === rule.member);
    const targetMember = (target?.[section] ?? []).find((entry) => entry.name === targetName);
    if (
      rule.memberKind === 'property' &&
      (upstream?.attributes ?? []).some((attribute) => attribute.property === rule.member)
    ) {
      findings.push(`${mapping.upstreamTag}: unreachable property type normalization ${key}`);
    }
    if (!upstreamMember) {
      findings.push(`${mapping.upstreamTag}: dangling upstream type normalization ${key}`);
    } else if (!hasPublishedType(upstreamMember.type) || upstreamMember.type !== rule.upstream) {
      findings.push(`${mapping.upstreamTag}: stale upstream type normalization ${key}`);
    }
    if (!targetMember) {
      findings.push(`${mapping.upstreamTag}: dangling target type normalization ${key}`);
    } else if (targetMember.type !== rule.target) {
      findings.push(`${mapping.upstreamTag}: stale target type normalization ${key}`);
    } else if (
      upstreamMember &&
      hasPublishedType(upstreamMember.type) &&
      (rule.memberKind === 'event'
        ? eventTypeCompatible(
            mappedPublicType(upstreamMember.type, upstreamPrefix),
            targetMember.type,
            normalizations,
          )
        : publicTypeCompatible(
            mappedPublicType(upstreamMember.type, upstreamPrefix),
            targetMember.type,
          ))
    ) {
      findings.push(`${mapping.upstreamTag}: stale compatible type normalization ${key}`);
    }
  }

  const methodRewrites = new Map((mapping.rewrites?.methods ?? []).map((entry) => [entry.from, entry.to]));
  const seenMethodParameters = new Set();
  for (const rule of normalizations.methodParameterTypeEquivalences ?? []) {
    const keys = rule && typeof rule === 'object' ? Object.keys(rule) : [];
    const valid =
      typeof rule?.method === 'string' &&
      Boolean(rule.method.trim()) &&
      typeof rule.parameter === 'string' &&
      Boolean(rule.parameter.trim()) &&
      typeof rule.upstream === 'string' &&
      Boolean(rule.upstream.trim()) &&
      rule.upstream !== UNSPECIFIED_PUBLIC_DOCUMENTATION &&
      typeof rule.target === 'string' &&
      Boolean(rule.target.trim()) &&
      rule.target !== UNSPECIFIED_PUBLIC_DOCUMENTATION &&
      rule.upstream !== rule.target &&
      keys.length === 4 &&
      keys.every((key) => ['method', 'parameter', 'upstream', 'target'].includes(key));
    if (!valid) {
      findings.push(`${mapping.upstreamTag}: invalid normalizations.methodParameterTypeEquivalences rule`);
      continue;
    }
    const key = `${rule.method}:${rule.parameter}`;
    if (seenMethodParameters.has(key)) {
      findings.push(`${mapping.upstreamTag}: duplicate normalizations.methodParameterTypeEquivalences rule ${key}`);
    }
    seenMethodParameters.add(key);
    if (containsAnyTypeKeyword(rule.upstream) || containsAnyTypeKeyword(rule.target)) {
      findings.push(`${mapping.upstreamTag}: unsafe any method-parameter type normalization ${key}`);
    }
    if (containsUnknownTypeKeyword(rule.upstream) || containsUnknownTypeKeyword(rule.target)) {
      findings.push(`${mapping.upstreamTag}: unsafe unknown method-parameter type normalization ${key}`);
    }
    if (containsTemplateInterpolation(rule.upstream) || containsTemplateInterpolation(rule.target)) {
      findings.push(`${mapping.upstreamTag}: unsafe template interpolation method-parameter type normalization ${key}`);
    }

    const upstreamMethod = (upstream?.methods ?? []).find((entry) => entry.name === rule.method);
    const targetMethodName = methodRewrites.get(rule.method) || rule.method;
    const targetMethod = (target?.methods ?? []).find((entry) => entry.name === targetMethodName);
    const upstreamParameters = (upstreamMethod?.overloads ?? []).flatMap((overload) => overload.parameters ?? []);
    const targetParameters = (targetMethod?.overloads ?? []).flatMap((overload) => overload.parameters ?? []);
    const upstreamParameter = upstreamParameters.find((entry) => entry.name === rule.parameter);
    const targetParameter = targetParameters.find((entry) => entry.name === rule.parameter);

    if (!upstreamMethod) {
      findings.push(`${mapping.upstreamTag}: dangling upstream method-parameter type normalization ${key}`);
    } else if (!upstreamParameter) {
      findings.push(`${mapping.upstreamTag}: dangling upstream method parameter normalization ${key}`);
    } else if (upstreamParameter.type !== rule.upstream) {
      findings.push(`${mapping.upstreamTag}: stale upstream method-parameter type normalization ${key}`);
    }

    if (!targetMethod) {
      findings.push(`${mapping.upstreamTag}: dangling target method-parameter type normalization ${key}`);
    } else if (!targetParameter) {
      findings.push(`${mapping.upstreamTag}: dangling target method parameter normalization ${key}`);
    } else if (targetParameter.type !== rule.target) {
      findings.push(`${mapping.upstreamTag}: stale target method-parameter type normalization ${key}`);
    } else if (mappedPublicType(rule.upstream, mapping.upstreamTag?.startsWith('wa-') ? 'wa-' : 'sl-') === targetParameter.type) {
      findings.push(`${mapping.upstreamTag}: stale compatible method-parameter type normalization ${key}`);
    }
  }

  const seenDefaults = new Set();
  for (const rule of normalizations.defaultEquivalences ?? []) {
    const keys = rule && typeof rule === 'object' ? Object.keys(rule) : [];
    const valid =
      (rule?.memberKind === 'attribute' || rule?.memberKind === 'property') &&
      typeof rule.member === 'string' &&
      Boolean(rule.member) &&
      Object.hasOwn(rule, 'upstream') &&
      Object.hasOwn(rule, 'target') &&
      isReviewedScalar(rule.upstream) &&
      isReviewedScalar(rule.target) &&
      rule.upstream !== rule.target &&
      keys.length === 4 &&
      keys.every((key) => ['memberKind', 'member', 'upstream', 'target'].includes(key));
    if (!valid) {
      findings.push(`${mapping.upstreamTag}: invalid normalizations.defaultEquivalences rule`);
      continue;
    }
    const key = normalizationKey(rule.memberKind, rule.member);
    if (seenDefaults.has(key)) {
      findings.push(`${mapping.upstreamTag}: duplicate normalizations.defaultEquivalences rule ${key}`);
    }
    seenDefaults.add(key);

    const section = rule.memberKind === 'attribute' ? 'attributes' : 'properties';
    const upstreamMember = (upstream?.[section] ?? []).find((entry) => entry.name === rule.member);
    const targetMember = (target?.[section] ?? []).find((entry) => entry.name === rule.member);
    if (!upstreamMember) {
      findings.push(`${mapping.upstreamTag}: dangling upstream normalization member ${key}`);
    } else if (!upstreamMember.hasDefault || upstreamMember.default !== rule.upstream) {
      findings.push(`${mapping.upstreamTag}: stale upstream default normalization ${key}`);
    }
    if (!targetMember) {
      findings.push(`${mapping.upstreamTag}: dangling target normalization member ${key}`);
    } else if (!targetMember.hasDefault || targetMember.default !== rule.target) {
      findings.push(`${mapping.upstreamTag}: stale target default normalization ${key}`);
    }
  }

  const seenAttributes = new Set();
  const seenProperties = new Set();
  for (const rule of normalizations.inferredAttributeSuppressions ?? []) {
    const keys = rule && typeof rule === 'object' ? Object.keys(rule) : [];
    const valid =
      typeof rule?.attribute === 'string' &&
      Boolean(rule.attribute) &&
      typeof rule.property === 'string' &&
      Boolean(rule.property) &&
      (rule.explicit === undefined || rule.explicit === true) &&
      keys.every((key) => key === 'attribute' || key === 'property' || key === 'explicit');
    if (!valid) {
      findings.push(`${mapping.upstreamTag}: invalid normalizations.inferredAttributeSuppressions rule`);
      continue;
    }
    if (seenAttributes.has(rule.attribute) || seenProperties.has(rule.property)) {
      findings.push(
        `${mapping.upstreamTag}: duplicate normalizations.inferredAttributeSuppressions rule ` + `${rule.attribute}:${rule.property}`,
      );
    }
    seenAttributes.add(rule.attribute);
    seenProperties.add(rule.property);

    const upstreamAttribute = (upstream?.attributes ?? []).find((entry) => entry.name === rule.attribute);
    const upstreamProperty = (upstream?.properties ?? []).find((entry) => entry.name === rule.property);
    const targetAttribute = (target?.attributes ?? []).find((entry) => entry.name === rule.attribute);
    const targetProperty = (target?.properties ?? []).find((entry) => entry.name === rule.property);
    if (!upstreamAttribute) {
      findings.push(`${mapping.upstreamTag}: dangling inferred upstream attribute ${rule.attribute}`);
    } else {
      if (upstreamAttribute.inferred !== true && rule.explicit !== true) {
        findings.push(`${mapping.upstreamTag}: cannot suppress explicit upstream attribute ${rule.attribute}`);
      }
      if (upstreamAttribute.inferred === true && rule.explicit === true) {
        findings.push(`${mapping.upstreamTag}: stale explicit attribute suppression ${rule.attribute}`);
      }
      if (upstreamAttribute.property !== rule.property) {
        findings.push(`${mapping.upstreamTag}: stale inferred attribute property ${rule.attribute}:${rule.property}`);
      }
    }
    if (!upstreamProperty) {
      findings.push(`${mapping.upstreamTag}: dangling inferred upstream property ${rule.property}`);
    }
    if (!targetProperty) {
      findings.push(`${mapping.upstreamTag}: dangling inferred target property ${rule.property}`);
    }
    if (targetAttribute) {
      findings.push(`${mapping.upstreamTag}: stale inferred attribute suppression ${rule.attribute}`);
    }
  }

  const seenDerivedDefaults = new Set();
  for (const rule of normalizations.derivedDefaultEquivalences ?? []) {
    const keys = rule && typeof rule === 'object' ? Object.keys(rule) : [];
    const valid =
      (rule?.memberKind === 'attribute' || rule?.memberKind === 'property') &&
      typeof rule.member === 'string' &&
      Boolean(rule.member) &&
      Object.hasOwn(rule, 'upstream') &&
      Object.hasOwn(rule, 'target') &&
      isReviewedScalar(rule.upstream) &&
      isReviewedScalar(rule.target) &&
      keys.length === 4 &&
      keys.every((key) => ['memberKind', 'member', 'upstream', 'target'].includes(key));
    if (!valid) {
      findings.push(`${mapping.upstreamTag}: invalid normalizations.derivedDefaultEquivalences rule`);
      continue;
    }
    const key = normalizationKey(rule.memberKind, rule.member);
    if (seenDerivedDefaults.has(key)) {
      findings.push(`${mapping.upstreamTag}: duplicate normalizations.derivedDefaultEquivalences rule ${key}`);
    }
    seenDerivedDefaults.add(key);

    const section = rule.memberKind === 'attribute' ? 'attributes' : 'properties';
    const upstreamMember = (upstream?.[section] ?? []).find((entry) => entry.name === rule.member);
    const targetMember = (target?.[section] ?? []).find((entry) => entry.name === rule.member);
    if (!upstreamMember) {
      findings.push(`${mapping.upstreamTag}: dangling derived-default upstream member ${key}`);
    } else if (!upstreamMember.hasDefault || upstreamMember.default !== rule.upstream) {
      findings.push(`${mapping.upstreamTag}: stale derived upstream default ${key}`);
    }
    if (!targetMember) {
      findings.push(`${mapping.upstreamTag}: dangling derived-default target member ${key}`);
    } else if (targetMember.hasDefault) {
      findings.push(`${mapping.upstreamTag}: stale derived target default ${key}`);
    }
  }

  const seenMethods = new Set();
  for (const rule of normalizations.unknownMethodReturnTypes ?? []) {
    const keys = rule && typeof rule === 'object' ? Object.keys(rule) : [];
    const valid =
      typeof rule?.method === 'string' &&
      Boolean(rule.method) &&
      keys.length === 1 &&
      keys[0] === 'method';
    if (!valid) {
      findings.push(`${mapping.upstreamTag}: invalid normalizations.unknownMethodReturnTypes rule`);
      continue;
    }
    if (seenMethods.has(rule.method)) {
      findings.push(`${mapping.upstreamTag}: duplicate normalizations.unknownMethodReturnTypes rule ${rule.method}`);
    }
    seenMethods.add(rule.method);

    const upstreamMethod = (upstream?.methods ?? []).find((entry) => entry.name === rule.method);
    const targetMethod = (target?.methods ?? []).find((entry) => entry.name === rule.method);
    if (!upstreamMethod) {
      findings.push(`${mapping.upstreamTag}: dangling unknown-return upstream method ${rule.method}`);
    } else if (
      !(upstreamMethod.overloads ?? []).some(
        (overload) =>
          overload.returnType === 'unknown' ||
          overload.returnType === UNSPECIFIED_PUBLIC_DOCUMENTATION,
      )
    ) {
      findings.push(`${mapping.upstreamTag}: stale unknown-return normalization ${rule.method}`);
    }
    if (!targetMethod) {
      findings.push(`${mapping.upstreamTag}: dangling unknown-return target method ${rule.method}`);
    } else if (
      (targetMethod.overloads ?? []).every(
        (overload) =>
          overload.returnType === 'unknown' ||
          overload.returnType === UNSPECIFIED_PUBLIC_DOCUMENTATION,
      )
    ) {
      findings.push(`${mapping.upstreamTag}: stale concrete target return normalization ${rule.method}`);
    }
  }

  // Two shapes of reviewed cancelability difference, kept apart so the safe one can be checked
  // mechanically. `cancelabilityEquivalences` only ever widens (the target hands listeners strictly
  // more veto power than upstream documents), which is a superset no shipped consumer can be
  // relying against. `cancelabilityPathAdditions` covers the one reviewable narrowing: the target
  // stays cancelable on every path upstream documents and adds its own path — named in `addedPath`
  // — that announces itself non-cancelable, so no documented veto is lost. Everything else,
  // above all any target that drops to `never`, keeps reporting cancelability-mismatch.
  const seenCancelabilities = new Set();
  const cancelabilityPrefix = mapping.upstreamTag?.startsWith('sl-') ? 'sl-' : 'wa-';
  const cancelabilityEventRewrites = new Map(
    (mapping.rewrites?.events ?? []).map((entry) => [entry.from, entry.to]),
  );
  for (const [section, allowedKeys] of [
    ['cancelabilityEquivalences', ['event', 'upstream', 'target']],
    ['cancelabilityPathAdditions', ['event', 'upstream', 'target', 'addedPath']],
  ]) {
    for (const rule of normalizations[section] ?? []) {
      const keys = rule && typeof rule === 'object' ? Object.keys(rule) : [];
      const valid =
        typeof rule?.event === 'string' &&
        Boolean(rule.event) &&
        CANCELABILITY_RANK.has(rule.upstream) &&
        CANCELABILITY_RANK.has(rule.target) &&
        keys.length === allowedKeys.length &&
        keys.every((key) => allowedKeys.includes(key)) &&
        (section === 'cancelabilityEquivalences'
          ? CANCELABILITY_RANK.get(rule.target) > CANCELABILITY_RANK.get(rule.upstream)
          : rule.upstream === 'always' &&
            rule.target === 'conditional' &&
            typeof rule.addedPath === 'string' &&
            Boolean(rule.addedPath));
      if (!valid) {
        findings.push(`${mapping.upstreamTag}: invalid normalizations.${section} rule`);
        continue;
      }
      if (seenCancelabilities.has(rule.event)) {
        findings.push(`${mapping.upstreamTag}: duplicate cancelability normalization ${rule.event}`);
      }
      seenCancelabilities.add(rule.event);

      const upstreamEvent = (upstream?.events ?? []).find((entry) => entry.name === rule.event);
      const targetName =
        cancelabilityEventRewrites.get(rule.event) || mappedEventName(rule.event, cancelabilityPrefix);
      const targetEvent = (target?.events ?? []).find((entry) => entry.name === targetName);
      if (!upstreamEvent) {
        findings.push(`${mapping.upstreamTag}: dangling upstream cancelability normalization ${rule.event}`);
      } else if (upstreamEvent.cancelable !== rule.upstream) {
        findings.push(`${mapping.upstreamTag}: stale upstream cancelability normalization ${rule.event}`);
      }
      if (!targetEvent) {
        findings.push(`${mapping.upstreamTag}: dangling target cancelability normalization ${rule.event}`);
      } else if (targetEvent.cancelable !== rule.target) {
        findings.push(`${mapping.upstreamTag}: stale target cancelability normalization ${rule.event}`);
      }
    }
  }

  return findings.sort();
}

function manifestDeclarations(manifest) {
  return (manifest.modules ?? [])
    .flatMap((module) =>
      (module.declarations ?? [])
        .filter((declaration) => declaration.customElement && declaration.tagName)
        .map((declaration) => ({ module, declaration })),
    )
    .sort((a, b) => a.declaration.tagName.localeCompare(b.declaration.tagName));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function validateLocalMigrations(inventory) {
  const findings = [];
  if (!Array.isArray(inventory?.localMigrations)) {
    return ['localMigrations must be an array'];
  }
  const allowedOrigins = new Set(LOCAL_MIGRATION_ORIGINS);
  const components = new Map((inventory.components ?? []).map((component) => [component.tag, component]));
  const seenProfiles = new Set();

  for (const profile of inventory.localMigrations) {
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      findings.push('localMigrations entries must be objects');
      continue;
    }
    const unknownProfileKeys = Object.keys(profile).filter((key) => key !== 'origin' && key !== 'tag' && key !== 'defaults');
    if (unknownProfileKeys.length) {
      findings.push(`local migration has unknown key(s) ${unknownProfileKeys.join(', ')}`);
    }
    if (!allowedOrigins.has(profile.origin)) {
      findings.push(`local migration has unknown origin ${String(profile.origin)}`);
    }
    if (typeof profile.tag !== 'string' || !profile.tag.startsWith('lr-')) {
      findings.push(`local migration needs a valid lr-* tag, got ${String(profile.tag)}`);
    }
    const key = `${String(profile.origin)}:${String(profile.tag)}`;
    if (seenProfiles.has(key)) findings.push(`duplicate local migration ${key}`);
    seenProfiles.add(key);
    const component = components.get(profile.tag);
    if (!component) findings.push(`${key}: target tag is not registered`);
    if (!Array.isArray(profile.defaults) || profile.defaults.length === 0) {
      findings.push(`${key}: defaults must be a non-empty array`);
      continue;
    }
    const attributes = new Map((component?.surface?.attributes ?? []).map((attribute) => [attribute.name, attribute]));
    const seenDefaults = new Set();
    for (const rule of profile.defaults) {
      if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
        findings.push(`${key}: default rules must be objects`);
        continue;
      }
      const unknownRuleKeys = Object.keys(rule).filter((name) => !['memberKind', 'member', 'action', 'value'].includes(name));
      if (unknownRuleKeys.length) {
        findings.push(`${key}: default rule has unknown key(s) ${unknownRuleKeys.join(', ')}`);
      }
      if (rule.memberKind !== 'attribute') {
        findings.push(`${key}: local defaults support only attribute members`);
      }
      if (rule.action !== 'insert-if-absent') {
        findings.push(`${key}: local defaults support only insert-if-absent`);
      }
      if (typeof rule.member !== 'string' || !rule.member) {
        findings.push(`${key}: default rule needs a member`);
        continue;
      }
      if (seenDefaults.has(rule.member)) findings.push(`${key}: duplicate default member ${rule.member}`);
      seenDefaults.add(rule.member);
      const attribute = attributes.get(rule.member);
      if (!attribute) findings.push(`${key}: unknown target attribute ${rule.member}`);
      if (!Object.hasOwn(rule, 'value')) {
        findings.push(`${key}: ${rule.member} needs a value`);
      } else if (
        typeof rule.value !== 'string' &&
        typeof rule.value !== 'boolean' &&
        !(typeof rule.value === 'number' && Number.isFinite(rule.value))
      ) {
        findings.push(`${key}: ${rule.member} value must be a finite string, number, or boolean`);
      } else if (rule.value === false) {
        findings.push(`${key}: false boolean insertion requires explicit converter evidence`);
      } else if (rule.value === true && !String(attribute?.type).includes('boolean')) {
        findings.push(`${key}: true presence insertion requires a boolean target attribute ${rule.member}`);
      }
    }
  }
  return findings;
}

export function validateInventory(inventory, { upstreamTags, lyraManifest, strict = false } = {}) {
  const findings = [];
  if (inventory.schemaVersion !== INVENTORY_SCHEMA_VERSION) {
    findings.push(`schemaVersion must be ${INVENTORY_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(inventory.components)) findings.push('components must be an array');
  if (!Array.isArray(inventory.mappings)) findings.push('mappings must be an array');
  if (findings.length) return findings;

  const lyraByTag = new Map(inventory.components.map((component) => [component.tag, component]));
  validateAccessibilityProfiles(inventory.accessibilityProfiles, findings);
  findings.push(...validateLocalMigrations(inventory));
  if (lyraByTag.size !== inventory.components.length) findings.push('components contain duplicate Lyra tags');
  const expectedLyra = manifestDeclarations(lyraManifest);
  const normalizedLyraByTag = new Map(
    normalizeManifest(lyraManifest, { ecosystem: 'lyra' }).map((component) => [component.tag, component]),
  );
  const expectedLyraTags = expectedLyra.map(({ declaration }) => declaration.tagName);
  const actualLyraTags = [...lyraByTag.keys()].sort();
  if (!sameJson(actualLyraTags, expectedLyraTags)) findings.push('Lyra tag inventory drifted from custom-elements.json');

  for (const { declaration } of expectedLyra) {
    const component = lyraByTag.get(declaration.tagName);
    if (!component) continue;
    validateSurface(component.surface, component.tag, findings);
    const expectedSurface = normalizedLyraByTag.get(declaration.tagName)?.surface;
    if (!sameJson(component.surface, expectedSurface)) findings.push(`${component.tag}: normalized public surface drifted`);
    if (!component.family || !component.classModule || !component.registrationModule) {
      findings.push(`${component.tag}: incomplete registration metadata`);
    }
    if (!Array.isArray(component.optionalPeers) || !Array.isArray(component.counterparts)) {
      findings.push(`${component.tag}: peers/counterparts must be arrays`);
    }
    if (!component.maturity?.status) findings.push(`${component.tag}: missing maturity classification`);
    if (strict && component.maturity.status === 'unclassified') findings.push(`${component.tag}: maturity remains unclassified`);
  }

  const catalogs = {
    webawesome: [...upstreamTags.webawesome.free, ...upstreamTags.webawesome.pro].sort(),
    shoelace: [...upstreamTags.shoelace.tags].sort(),
  };
  const upstreamByTag = new Map();
  for (const ecosystem of ['webawesome', 'shoelace']) {
    const upstream = inventory.upstreams?.[ecosystem];
    if (!upstream) {
      findings.push(`missing ${ecosystem} inventory`);
      continue;
    }
    const expectedPin = upstreamTags[ecosystem];
    if (upstream.version !== expectedPin.version || upstream.commit !== expectedPin.commit) {
      findings.push(`${ecosystem}: pin drifted from upstream-tags.json`);
    }
    const tags = (upstream.components ?? []).map((component) => component.tag).sort();
    if (!sameJson(tags, catalogs[ecosystem])) findings.push(`${ecosystem}: tag catalog drifted from upstream-tags.json`);
    for (const component of upstream.components ?? []) {
      if (upstreamByTag.has(component.tag)) findings.push(`${component.tag}: duplicate upstream tag`);
      upstreamByTag.set(component.tag, { ecosystem, component });
      validateSurface(component.surface, component.tag, findings);
      if (!component.review?.status || !Array.isArray(component.review.unreviewedSections)) {
        findings.push(`${component.tag}: missing surface review metadata`);
      }
      if (strict && component.review.status !== 'complete') findings.push(`${component.tag}: public surface review is incomplete`);
    }
    const expectedRuntimeEvidence = new Set();
    for (const observation of expectedPin.runtimeEventCancelability?.events ?? []) {
      const key = `${observation.tag}#${observation.event}`;
      if (expectedRuntimeEvidence.has(key)) {
        findings.push(`${ecosystem}: duplicate runtime cancelability evidence ${key}`);
        continue;
      }
      expectedRuntimeEvidence.add(key);
      const component = (upstream.components ?? []).find((entry) => entry.tag === observation.tag);
      const event = component?.surface?.events?.find((entry) => entry.name === observation.event);
      if (event?.cancelable !== observation.cancelable || event?.cancelabilityEvidence !== 'pinned-runtime') {
        findings.push(`${key}: stored runtime cancelability evidence drifted from upstream-tags.json`);
      }
    }
    for (const component of upstream.components ?? []) {
      for (const event of component.surface?.events ?? []) {
        if (event.cancelabilityEvidence && !expectedRuntimeEvidence.has(`${component.tag}#${event.name}`)) {
          findings.push(`${component.tag}#${event.name}: stored runtime cancelability evidence is stale`);
        }
      }
    }
    const expectedMethodEdgeEvidence = new Set();
    for (const observation of
      expectedPin.runtimeMethodEdgeSemantics?.methods ?? []) {
      const key = `${observation.tag}#${observation.method}`;
      if (expectedMethodEdgeEvidence.has(key)) {
        findings.push(`${ecosystem}: duplicate runtime method-edge evidence ${key}`);
        continue;
      }
      expectedMethodEdgeEvidence.add(key);
      const component = (upstream.components ?? []).find(
        (entry) => entry.tag === observation.tag,
      );
      const method = component?.surface?.methods?.find(
        (entry) => entry.name === observation.method,
      );
      if (
        !sameJson(method?.edgeSemantics, {
          evidence: 'pinned-runtime',
          cases: observation.cases,
        })
      ) {
        findings.push(
          `${key}: stored runtime method-edge evidence drifted from upstream-tags.json`,
        );
      }
    }
    for (const component of upstream.components ?? []) {
      for (const method of component.surface?.methods ?? []) {
        if (
          method.edgeSemantics &&
          !expectedMethodEdgeEvidence.has(`${component.tag}#${method.name}`)
        ) {
          findings.push(
            `${component.tag}#${method.name}: stored runtime method-edge evidence is stale`,
          );
        }
      }
    }
  }

  const mappingByTag = new Map();
  for (const mapping of inventory.mappings) {
    if (mappingByTag.has(mapping.upstreamTag)) findings.push(`${mapping.upstreamTag}: duplicate mapping`);
    mappingByTag.set(mapping.upstreamTag, mapping);
    if (!upstreamByTag.has(mapping.upstreamTag)) findings.push(`${mapping.upstreamTag}: fictional upstream mapping`);
    if (!MAPPING_CLASSIFICATIONS.includes(mapping.classification)) {
      findings.push(`${mapping.upstreamTag}: invalid mapping classification`);
    }
    validateAccessibilityParity(mapping, inventory.accessibilityProfiles, findings);
    validateRewrites(mapping, findings);
    if (mapping.classification === 'exact' && mapping.rationale !== null) {
      findings.push(`${mapping.upstreamTag}: exact mappings must not carry a rationale`);
    }
    if (mapping.classification === 'exact' && REWRITE_RULE_SECTIONS.some((section) => mapping.rewrites?.[section]?.length)) {
      findings.push(`${mapping.upstreamTag}: exact mappings cannot declare rewrite rules`);
    }
    if (mapping.classification === 'rewritten' && !REWRITE_RULE_SECTIONS.some((section) => mapping.rewrites?.[section]?.length)) {
      findings.push(`${mapping.upstreamTag}: rewritten mappings need a deterministic rule`);
    }
    if (mapping.classification !== 'exact' && !mapping.rationale?.trim()) {
      findings.push(`${mapping.upstreamTag}: non-exact mapping needs a rationale`);
    }
    if (mapping.targetTag && !lyraByTag.has(mapping.targetTag) && mapping.classification !== 'unsupported') {
      findings.push(`${mapping.upstreamTag} -> ${mapping.targetTag}: dangling target`);
    }
    for (const rewrite of mapping.rewrites?.attributes ?? []) {
      const from = polarity(rewrite.from);
      const to = polarity(rewrite.to);
      if (from !== to && (from === -1 || to === -1)) {
        findings.push(`${mapping.upstreamTag}: ${rewrite.from} -> ${rewrite.to} inverts polarity`);
      }
    }

    const upstreamEntry = upstreamByTag.get(mapping.upstreamTag)?.component;
    const target = lyraByTag.get(mapping.targetTag);
    findings.push(
      ...validateMethodEdgeParity(mapping, {
        upstream: upstreamEntry?.surface,
        target: target?.surface,
      }),
    );
    findings.push(
      ...validateDefaultRewriteSemantics(mapping, {
        upstream: upstreamEntry?.surface,
        target: target?.surface,
      }),
    );
    findings.push(
      ...validateMappingNormalizations(mapping, {
        upstream: upstreamEntry?.surface,
        target: target?.surface,
      }),
    );
    if (upstreamEntry?.review.status === 'complete' && target) {
      const expectedDrift = compareMappedSurfaces(upstreamEntry.surface, target.surface, {
        upstreamPrefix: mapping.upstream === 'webawesome' ? 'wa-' : 'sl-',
        rewrites: mapping.rewrites,
        normalizations: mapping.normalizations,
      });
      if (!sameJson(mapping.drift, expectedDrift)) findings.push(`${mapping.upstreamTag}: stored surface drift is stale`);
      if (mapping.classification === 'exact' && expectedDrift.length) {
        findings.push(`${mapping.upstreamTag}: exact mapping has ${expectedDrift.length} surface difference(s)`);
      }
    }
    const expectedStaticApiReview = deriveStaticApiReviewStatus({
      upstreamReviewStatus: upstreamEntry?.review.status,
      targetPresent: Boolean(target),
      comparisonPerformed: upstreamEntry?.review.status === 'complete' && Boolean(target),
    });
    if (mapping.parity?.staticApi !== expectedStaticApiReview) {
      findings.push(
        `${mapping.upstreamTag}: static API review status is stale; expected ${expectedStaticApiReview}`,
      );
    }
    if (strict && mapping.classification === 'unsupported') findings.push(`${mapping.upstreamTag}: unsupported release blocker remains`);
  }
  if (mappingByTag.size !== upstreamByTag.size) findings.push('not every upstream tag has exactly one mapping decision');
  for (const tag of upstreamByTag.keys()) if (!mappingByTag.has(tag)) findings.push(`${tag}: no mapping decision`);

  return findings.sort();
}

export function validatePinnedManifests(inventory, { webawesomeManifest, shoelaceManifest, upstreamTags }) {
  const findings = [];
  const manifests = {
    webawesome: { manifest: webawesomeManifest, prefix: 'wa-' },
    shoelace: { manifest: shoelaceManifest, prefix: 'sl-' },
  };
  for (const [ecosystem, { manifest, prefix }] of Object.entries(manifests)) {
    const checked = new Map(
      applyRuntimeMethodEdgeSemanticsEvidence(
        applyRuntimeEventCancelabilityEvidence(
          normalizeManifest(manifest, { ecosystem }),
          upstreamTags?.[ecosystem]?.runtimeEventCancelability,
          {
            ecosystem,
            version:
              upstreamTags?.[ecosystem]?.version ??
              inventory.upstreams[ecosystem].version,
          },
        ),
        upstreamTags?.[ecosystem]?.runtimeMethodEdgeSemantics,
        {
          ecosystem,
          version:
            upstreamTags?.[ecosystem]?.version ??
            inventory.upstreams[ecosystem].version,
        },
      )
        .filter((entry) => entry.tag.startsWith(prefix))
        .map((entry) => [entry.tag, entry]),
    );
    const stored = new Map(inventory.upstreams[ecosystem].components.map((entry) => [entry.tag, entry]));
    for (const [tag, entry] of checked) {
      const snapshot = stored.get(tag);
      if (!snapshot) {
        findings.push(`${tag}: pinned manifest tag is absent from the inventory`);
        continue;
      }
      if (!sameJson(snapshot.surface, entry.surface)) findings.push(`${tag}: pinned public surface drifted`);
      if (!sameJson(snapshot.maturity, entry.maturity)) findings.push(`${tag}: pinned maturity metadata drifted`);
      if (snapshot.review.status !== 'complete') findings.push(`${tag}: pinned manifest surface is marked unreviewed`);
    }
    for (const [tag, snapshot] of stored) {
      if (snapshot.review.source === 'published-manifest' && !checked.has(tag)) {
        findings.push(`${tag}: stored published-manifest surface is fictional or stale`);
      }
    }
  }
  return findings.sort();
}

export function emptySurface() {
  return {
    attributes: [],
    properties: [],
    slots: [],
    events: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    methods: [],
    staticProperties: [],
    staticMethods: [],
    moduleExports: [],
    form: { associated: false, properties: [], methods: [] },
    native: { forwardedEvents: [], delegatedMethods: [] },
  };
}

export function familyFromModule(modulePath) {
  const segments = modulePath.split(path.posix.sep);
  return segments[2] || null;
}
