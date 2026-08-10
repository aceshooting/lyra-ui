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
  'methodParameterTypeEquivalences',
  'defaultEquivalences',
  'derivedDefaultEquivalences',
  'inferredAttributeSuppressions',
  'unknownMethodReturnTypes',
  'cancelabilityEquivalences',
  'cancelabilityPathAdditions',
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
  if ((mapping.classification === 'exact' || mapping.classification === 'rewritten') && expected.status === 'warning-required') {
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
  'currentTime',
  'filter',
  'files',
  'keyframes',
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
        deprecated: attribute.deprecated || field?.deprecated || null,
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
        deprecated: member.deprecated || null,
        hasDefault: hasOwn(member, 'default'),
      };
      if (normalized.hasDefault) normalized.default = canonicalDefault(member.default);
      return normalized;
    }),
  );
}

function normalizeMethods(members, ecosystem) {
  const grouped = new Map();
  for (const member of members) {
    if (isInternalMethod(member, ecosystem)) continue;
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
    .map(([name, overloads]) => ({ name, overloads: [...overloads.values()] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeNamed(entries) {
  return sortByName(
    (entries ?? []).map((entry) => ({
      name: entry.name ?? '',
      deprecated: entry.deprecated || null,
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
        deprecated: entry.deprecated || null,
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
      const normalized = {
        name: entry.name,
        type: textOf(entry.type),
        cancelable: eventCancelabilityFromDescription(entry.description, ecosystem, entry.name),
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

function eventTypeCompatible(expected, actual) {
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
    if (attribute.reflects === true && candidate.reflects !== true) {
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
      if (property.reflects === true && candidate.reflects !== true) {
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

  for (const [section, code] of [
    ['slots', 'missing-slot'],
    ['parts', 'missing-part'],
    ['cssProperties', 'missing-css-property'],
    ['cssStates', 'missing-css-state'],
  ]) {
    const targetNames = new Set((target[section] ?? []).map((entry) => entry.name));
    const sectionRewrites = new Map((rewrites[section] ?? []).map((entry) => [entry.from, entry.to]));
    for (const entry of upstream[section] ?? []) {
      const expectedName = sectionRewrites.get(entry.name) || entry.name;
      if (!targetNames.has(expectedName)) pushMissing(drift, code, section, entry.name);
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
        !eventTypeCompatible(expectedType, candidate.type) &&
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

  const seenTypes = new Set();
  for (const rule of normalizations.typeEquivalences ?? []) {
    const keys = rule && typeof rule === 'object' ? Object.keys(rule) : [];
    const valid =
      (rule?.memberKind === 'attribute' ||
        rule?.memberKind === 'property' ||
        rule?.memberKind === 'event') &&
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
          : 'events';
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
  const lyraFormAssociations = manifestFormAssociations(lyraManifest);
  const expectedLyraTags = expectedLyra.map(({ declaration }) => declaration.tagName);
  const actualLyraTags = [...lyraByTag.keys()].sort();
  if (!sameJson(actualLyraTags, expectedLyraTags)) findings.push('Lyra tag inventory drifted from custom-elements.json');

  for (const { declaration } of expectedLyra) {
    const component = lyraByTag.get(declaration.tagName);
    if (!component) continue;
    validateSurface(component.surface, component.tag, findings);
    const normalized = normalizeDeclaration(declaration, {
      ecosystem: 'lyra',
      formAssociated: lyraFormAssociations.get(declaration),
    });
    const expectedSurface = Object.fromEntries(SURFACE_SECTIONS.map((section) => [section, normalized[section]]));
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
    if (strict && mapping.classification === 'unsupported') findings.push(`${mapping.upstreamTag}: unsupported release blocker remains`);
  }
  if (mappingByTag.size !== upstreamByTag.size) findings.push('not every upstream tag has exactly one mapping decision');
  for (const tag of upstreamByTag.keys()) if (!mappingByTag.has(tag)) findings.push(`${tag}: no mapping decision`);

  return findings.sort();
}

export function validatePinnedManifests(inventory, { webawesomeManifest, shoelaceManifest }) {
  const findings = [];
  const manifests = {
    webawesome: { manifest: webawesomeManifest, prefix: 'wa-' },
    shoelace: { manifest: shoelaceManifest, prefix: 'sl-' },
  };
  for (const [ecosystem, { manifest, prefix }] of Object.entries(manifests)) {
    const checked = new Map(
      normalizeManifest(manifest, { ecosystem })
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
    form: { associated: false, properties: [], methods: [] },
    native: { forwardedEvents: [], delegatedMethods: [] },
  };
}

export function familyFromModule(modulePath) {
  const segments = modulePath.split(path.posix.sep);
  return segments[2] || null;
}
