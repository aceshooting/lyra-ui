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

export const MAPPING_CLASSIFICATIONS = [
  'exact',
  'rewritten',
  'warning-required',
  'conceptual-only',
  'unsupported',
];

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
  'resetValidity',
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
  'toggle',
  'checkValidity',
  'reportValidity',
  'setCustomValidity',
  'getForm',
  'setSelectionRange',
  'setRangeText',
  'showPicker',
  'stepUp',
  'stepDown',
  'play',
  'pause',
  'load',
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
const PROPERTY_ONLY_FIELDS = new Set([
  'files',
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
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replaceAll('_', '-').toLowerCase();
}

function isInternalMethod(member, ecosystem) {
  if (member.kind !== 'method' || member.static || member.privacy === 'private' || member.privacy === 'protected') {
    return true;
  }
  if (INTERNAL_METHOD_NAMES.has(member.name)) return true;
  if (/^(?:handle|on|_)[A-Z_]/.test(member.name) || /Callback$/.test(member.name)) return true;
  if (member.inheritedFrom && !PUBLIC_METHOD_NAMES.has(member.name) && !FORM_METHODS.has(member.name)) return true;
  if (ecosystem !== 'lyra' && !member.description && !PUBLIC_METHOD_NAMES.has(member.name) && !FORM_METHODS.has(member.name)) {
    return true;
  }
  return false;
}

function isPublicField(member, attributeNames, ecosystem) {
  if (member.kind !== 'field' || member.static || member.privacy === 'private' || member.privacy === 'protected') return false;
  if (/^_/.test(member.name)) return false;
  if (attributeNames.has(member.name) || member.attribute) return true;
  if (member.inheritedFrom) return FORM_PROPERTIES.has(member.name);
  if (ecosystem === 'shoelace') {
    return Boolean(member.description) || FORM_PROPERTIES.has(member.name) || UNDOCUMENTED_PUBLIC_FIELDS.has(member.name);
  }
  return member.privacy === 'public' || Boolean(member.description) || Boolean(member.readonly);
}

function normalizeParameter(parameter) {
  const normalized = {
    name: parameter.name,
    type: textOf(parameter.type),
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

function cancelabilityOf(description = '') {
  const text = description.toLowerCase();
  const negativePattern = /\b(?:non[- ]?|not\s+)cancell?able\b/g;
  let negative = false;
  const withoutNegativePhrases = text.replace(negativePattern, () => {
    negative = true;
    return '';
  });
  const explicitPositive = /\bcancell?able\b/.test(withoutNegativePhrases);
  const preventDefaultPositive = !negative && /preventdefault\(\)|\bcancel(?:ing|ling) this event\b/.test(text);
  const positive = explicitPositive || preventDefaultPositive;
  if (explicitPositive && negative) return 'conditional';
  return positive ? 'always' : 'never';
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
      const field = fields.get(attribute.fieldName || attribute.name) ??
        publicFields.find((member) => member.attribute === attribute.name);
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
      parameters: (member.parameters ?? []).map(normalizeParameter),
      returnType: textOf(member.return?.type),
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

function normalizeCssProperties(entries) {
  return sortByName(
    (entries ?? []).map((entry) => {
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

function normalizeEvents(entries) {
  return sortByName(
    (entries ?? []).map((entry) => ({
      name: entry.name,
      type: textOf(entry.type),
      cancelable: cancelabilityOf(entry.description),
    })),
  );
}

export function normalizeDeclaration(declaration, { ecosystem }) {
  const attributeFieldNames = new Set(
    (declaration.attributes ?? []).flatMap((attribute) => [attribute.fieldName, attribute.name]).filter(Boolean),
  );
  const publicFields = (declaration.members ?? []).filter((member) =>
    isPublicField(member, attributeFieldNames, ecosystem),
  );
  const properties = normalizeProperties(publicFields);
  const methods = normalizeMethods(declaration.members ?? [], ecosystem);
  const events = normalizeEvents(declaration.events);
  const formProperties = properties.filter((entry) => FORM_PROPERTIES.has(entry.name)).map((entry) => entry.name);
  const formMethods = methods.filter((entry) => FORM_METHODS.has(entry.name)).map((entry) => entry.name);
  const delegatedMethods = methods.filter((entry) => NATIVE_METHODS.has(entry.name)).map((entry) => entry.name);
  const forwardedEvents = events.filter((entry) => NATIVE_EVENTS.has(entry.name)).map((entry) => entry.name);
  const formAssociated =
    formProperties.some((name) => ['form', 'validity', 'validationMessage', 'willValidate', 'labels'].includes(name)) ||
    formMethods.some((name) => name !== 'getForm');

  return {
    attributes: normalizeAttributes(declaration, publicFields, ecosystem),
    properties,
    slots: normalizeNamed(declaration.slots),
    events,
    parts: normalizeNamed(declaration.cssParts),
    cssProperties: normalizeCssProperties(declaration.cssProperties),
    cssStates: normalizeNamed(declaration.cssStates),
    methods,
    form: {
      associated: formAssociated,
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
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (!declaration.customElement || !declaration.tagName) continue;
      const normalized = normalizeDeclaration(declaration, { ecosystem });
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

export function compareMappedSurfaces(upstream, target, { upstreamPrefix, rewrites = {} } = {}) {
  const drift = [];
  const attributeRewrites = new Map((rewrites.attributes ?? []).map((entry) => [entry.from, entry.to]));

  for (const attribute of upstream.attributes ?? []) {
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
    if (attribute.hasDefault && (!candidate.hasDefault || candidate.default !== attribute.default)) {
      drift.push({
        code: 'default-mismatch',
        section: 'attributes',
        member: attribute.name,
        expected: attribute.default,
        actual: candidate.hasDefault ? candidate.default : null,
      });
    }
  }

  for (const property of upstream.properties ?? []) {
    if ((upstream.attributes ?? []).some((attribute) => attribute.property === property.name)) continue;
    const candidate = (target.properties ?? []).find((entry) => entry.name === property.name);
    if (!candidate) pushMissing(drift, 'missing-property', 'properties', property.name);
    else if (property.hasDefault && (!candidate.hasDefault || candidate.default !== property.default)) {
      drift.push({
        code: 'default-mismatch',
        section: 'properties',
        member: property.name,
        expected: property.default,
        actual: candidate.hasDefault ? candidate.default : null,
      });
    }
  }

  for (const [section, code] of [
    ['slots', 'missing-slot'],
    ['parts', 'missing-part'],
    ['cssProperties', 'missing-css-property'],
    ['cssStates', 'missing-css-state'],
    ['methods', 'missing-method'],
  ]) {
    const targetNames = new Set((target[section] ?? []).map((entry) => entry.name));
    for (const entry of upstream[section] ?? []) {
      if (!targetNames.has(entry.name)) pushMissing(drift, code, section, entry.name);
    }
  }

  for (const event of upstream.events ?? []) {
    const expectedName = mappedEventName(event.name, upstreamPrefix);
    const candidate = (target.events ?? []).find((entry) => entry.name === expectedName);
    if (!candidate) {
      pushMissing(drift, 'missing-event', 'events', event.name);
    } else if (candidate.cancelable !== event.cancelable) {
      drift.push({
        code: 'cancelability-mismatch',
        section: 'events',
        member: event.name,
        expected: event.cancelable,
        actual: candidate.cancelable,
      });
    }
  }

  if (upstream.form?.associated && !target.form?.associated) {
    drift.push({ code: 'form-association-mismatch', section: 'form', member: 'associated' });
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

  return drift.sort((a, b) =>
    `${a.section}:${a.member}:${a.code}`.localeCompare(`${b.section}:${b.member}:${b.code}`),
  );
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
    if (!['always', 'never', 'conditional'].includes(event.cancelable)) {
      findings.push(`${label}: event ${event.name} has unreviewed cancelability`);
    }
  }
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

export function validateInventory(inventory, { upstreamTags, lyraManifest, strict = false } = {}) {
  const findings = [];
  if (inventory.schemaVersion !== INVENTORY_SCHEMA_VERSION) {
    findings.push(`schemaVersion must be ${INVENTORY_SCHEMA_VERSION}`);
  }
  if (!Array.isArray(inventory.components)) findings.push('components must be an array');
  if (!Array.isArray(inventory.mappings)) findings.push('mappings must be an array');
  if (findings.length) return findings;

  const lyraByTag = new Map(inventory.components.map((component) => [component.tag, component]));
  if (lyraByTag.size !== inventory.components.length) findings.push('components contain duplicate Lyra tags');
  const expectedLyra = manifestDeclarations(lyraManifest);
  const expectedLyraTags = expectedLyra.map(({ declaration }) => declaration.tagName);
  const actualLyraTags = [...lyraByTag.keys()].sort();
  if (!sameJson(actualLyraTags, expectedLyraTags)) findings.push('Lyra tag inventory drifted from custom-elements.json');

  for (const { declaration } of expectedLyra) {
    const component = lyraByTag.get(declaration.tagName);
    if (!component) continue;
    validateSurface(component.surface, component.tag, findings);
    const normalized = normalizeDeclaration(declaration, { ecosystem: 'lyra' });
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
    if (mapping.classification === 'exact' && mapping.rationale !== null) {
      findings.push(`${mapping.upstreamTag}: exact mappings must not carry a rationale`);
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
    if (upstreamEntry?.review.status === 'complete' && target) {
      const expectedDrift = compareMappedSurfaces(upstreamEntry.surface, target.surface, {
        upstreamPrefix: mapping.upstream === 'webawesome' ? 'wa-' : 'sl-',
        rewrites: mapping.rewrites,
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
