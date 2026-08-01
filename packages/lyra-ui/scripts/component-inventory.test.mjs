import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  compareMappedSurfaces,
  normalizeDeclaration,
  validateInventory,
  validatePinnedManifests,
} from './component-inventory.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...segments) => JSON.parse(fs.readFileSync(path.join(packageDir, ...segments), 'utf8'));

test('normalization keeps public contracts and rejects analyzer implementation detail', () => {
  const normalized = normalizeDeclaration(
    {
      tagName: 'wa-example',
      customElement: true,
      status: 'stable',
      since: '3.0',
      attributes: [
        { name: 'open', fieldName: 'open', type: { text: 'boolean' }, default: 'false' },
      ],
      members: [
        { kind: 'field', name: 'open', attribute: 'open', type: { text: 'boolean' }, default: 'false' },
        { kind: 'field', name: 'secret', privacy: 'private', type: { text: 'string' } },
        { kind: 'method', name: 'handleClick' },
        { kind: 'method', name: 'render' },
        {
          kind: 'method',
          name: 'addEventListener',
          inheritedFrom: { name: 'WebAwesomeElement', module: 'internal/webawesome-element.js' },
        },
        {
          kind: 'method',
          name: 'show',
          description: 'Shows the component.',
          return: { type: { text: 'Promise<void>' } },
        },
      ],
      events: [
        { name: 'wa-before-open', description: 'Cancelable; preventDefault() keeps it closed.' },
        { name: 'wa-after-open', description: 'Emitted after opening.' },
        { name: 'wa-request', description: 'Not cancelable; preventDefault() has no effect.' },
        { name: 'wa-mixed', description: 'Cancelable for commits and non-cancelable for live feedback.' },
      ],
      slots: [{ name: '', description: 'Default content.' }],
      cssParts: [{ name: 'base' }],
      cssProperties: [{ name: '--duration', default: '200ms' }],
      cssStates: [{ name: 'open' }],
    },
    { ecosystem: 'webawesome' },
  );

  assert.deepEqual(normalized.attributes.map((entry) => entry.name), ['open']);
  assert.deepEqual(normalized.methods.map((entry) => entry.name), ['show']);
  assert.deepEqual(normalized.events.map(({ name, cancelable }) => ({ name, cancelable })), [
    { name: 'wa-after-open', cancelable: 'never' },
    { name: 'wa-before-open', cancelable: 'always' },
    { name: 'wa-mixed', cancelable: 'conditional' },
    { name: 'wa-request', cancelable: 'never' },
  ]);
  assert.deepEqual(normalized.cssStates.map((entry) => entry.name), ['open']);
  assert.equal(normalized.maturity.status, 'stable');
  assert.equal(normalized.maturity.since, '3.0');
});

test('surface comparison catches member, default, cancelability, and polarity drift', () => {
  const upstream = {
    attributes: [
      { name: 'with-summary', property: 'withSummary', type: 'boolean', hasDefault: true, default: true },
      { name: 'placement', property: 'placement', type: 'string', hasDefault: true, default: 'top' },
    ],
    properties: [],
    slots: [{ name: 'label' }],
    events: [{ name: 'wa-change', type: 'Event', cancelable: 'always' }],
    parts: [{ name: 'base' }],
    cssProperties: [{ name: '--duration', hasDefault: true, default: '200ms' }],
    cssStates: [{ name: 'open' }],
    methods: [{ name: 'show', overloads: [] }],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const target = {
    attributes: [
      { name: 'hide-summary', property: 'hideSummary', type: 'boolean', hasDefault: true, default: true },
      { name: 'placement', property: 'placement', type: 'string', hasDefault: true, default: 'bottom' },
    ],
    properties: [],
    slots: [],
    events: [{ name: 'lr-change', type: 'Event', cancelable: 'never' }],
    parts: [],
    cssProperties: [],
    cssStates: [],
    methods: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };

  const drift = compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' });
  assert.ok(drift.some((entry) => entry.code === 'polarity-mismatch'));
  assert.ok(drift.some((entry) => entry.code === 'default-mismatch'));
  assert.ok(drift.some((entry) => entry.code === 'cancelability-mismatch'));
  assert.ok(drift.some((entry) => entry.code === 'missing-slot'));
  assert.ok(drift.some((entry) => entry.code === 'missing-method'));
});

test('checked-in inventory covers every pinned tag and every Lyra declaration', () => {
  const inventory = readJson('scripts', 'fixtures', 'component-inventory.json');
  const upstreamTags = readJson('scripts', 'fixtures', 'upstream-tags.json');
  const manifest = readJson('custom-elements.json');
  const findings = validateInventory(inventory, { upstreamTags, lyraManifest: manifest });

  assert.deepEqual(findings, []);
  const declaredTags = manifest.modules
    .flatMap((module) => module.declarations ?? [])
    .filter((declaration) => declaration.customElement && declaration.tagName);
  assert.equal(inventory.components.length, declaredTags.length);
  assert.equal(inventory.upstreams.webawesome.components.length, 87);
  assert.equal(inventory.upstreams.shoelace.components.length, 58);
  assert.equal(inventory.mappings.length, 145);

  for (const mapping of inventory.mappings) {
    assert.match(mapping.classification, /^(exact|rewritten|warning-required|conceptual-only|unsupported)$/);
    if (mapping.classification === 'exact') assert.equal(mapping.rationale, null);
    else assert.ok(mapping.rationale?.trim(), `${mapping.upstreamTag} must explain its non-exact classification`);
  }
});

test('inventory validation fails closed on fictional, dangling, default, polarity, and review drift', () => {
  const inventory = structuredClone(readJson('scripts', 'fixtures', 'component-inventory.json'));
  const upstreamTags = readJson('scripts', 'fixtures', 'upstream-tags.json');
  const manifest = readJson('custom-elements.json');

  inventory.mappings.push({
    upstream: 'webawesome',
    upstreamTag: 'wa-fictional',
    upstreamTier: 'free',
    targetTag: 'lr-fictional',
    classification: 'exact',
    rationale: null,
    decisionSource: 'derived',
    rewrites: { attributes: [] },
    drift: [],
  });
  inventory.mappings[0].targetTag = 'lr-fictional';
  inventory.mappings[0].classification = 'rewritten';
  inventory.mappings[0].rationale = 'Synthetic dangling-target regression.';
  inventory.mappings[0].rewrites.attributes = [{ from: 'with-label', to: 'no-label' }];

  const componentWithDefault = inventory.components.find((component) =>
    component.surface.attributes.some((attribute) => attribute.hasDefault),
  );
  assert.ok(componentWithDefault, 'fixture must contain a defaulted attribute');
  const defaultedAttribute = componentWithDefault.surface.attributes.find((attribute) => attribute.hasDefault);
  defaultedAttribute.default = '__drifted__';

  const reviewedUpstream = inventory.upstreams.webawesome.components.find(
    (component) => component.review.status === 'complete',
  );
  assert.ok(reviewedUpstream, 'fixture must contain a reviewed upstream surface');
  reviewedUpstream.review = {
    status: 'tag-only',
    source: 'synthetic-test',
    unreviewedSections: ['methods'],
  };

  const findings = validateInventory(inventory, { upstreamTags, lyraManifest: manifest, strict: true });
  assert.ok(findings.some((finding) => finding.includes('fictional upstream mapping')));
  assert.ok(findings.some((finding) => finding.includes('dangling target')));
  assert.ok(findings.some((finding) => finding.includes('inverts polarity')));
  assert.ok(findings.some((finding) => finding.includes('normalized public surface drifted')));
  assert.ok(findings.some((finding) => finding.includes('public surface review is incomplete')));
});

test('release completeness mode exposes staged reviews and unsupported mappings', () => {
  const inventory = readJson('scripts', 'fixtures', 'component-inventory.json');
  const upstreamTags = readJson('scripts', 'fixtures', 'upstream-tags.json');
  const manifest = readJson('custom-elements.json');
  const findings = validateInventory(inventory, { upstreamTags, lyraManifest: manifest, strict: true });

  assert.ok(findings.some((finding) => finding.includes('maturity remains unclassified')));
  assert.ok(findings.some((finding) => finding.includes('public surface review is incomplete')));
  assert.ok(findings.some((finding) => finding.includes('unsupported release blocker remains')));
});

test('pinned-manifest drift validation compares normalized public data, not raw analyzer output', () => {
  const declaration = {
    tagName: 'wa-example',
    customElement: true,
    members: [
      { kind: 'field', name: 'value', attribute: 'value', default: "'one'", type: { text: 'string' } },
      { kind: 'method', name: 'render' },
    ],
    attributes: [{ name: 'value', fieldName: 'value', default: "'one'", type: { text: 'string' } }],
  };
  const normalized = normalizeDeclaration(declaration, { ecosystem: 'webawesome' });
  const surface = Object.fromEntries(
    ['attributes', 'properties', 'slots', 'events', 'parts', 'cssProperties', 'cssStates', 'methods', 'form', 'native'].map(
      (section) => [section, normalized[section]],
    ),
  );
  const inventory = {
    upstreams: {
      webawesome: {
        components: [
          {
            tag: 'wa-example',
            maturity: normalized.maturity,
            surface,
            review: { status: 'complete', source: 'published-manifest', unreviewedSections: [] },
          },
        ],
      },
      shoelace: { components: [] },
    },
  };
  const webawesomeManifest = { modules: [{ path: 'example.js', declarations: [declaration] }] };
  const shoelaceManifest = { modules: [] };

  assert.deepEqual(validatePinnedManifests(inventory, { webawesomeManifest, shoelaceManifest }), []);
  inventory.upstreams.webawesome.components[0].surface.attributes[0].default = 'two';
  assert.deepEqual(validatePinnedManifests(inventory, { webawesomeManifest, shoelaceManifest }), [
    'wa-example: pinned public surface drifted',
  ]);
});
