import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  MIGRATION_ATTRIBUTE_EXCLUSIONS,
  compareMappedSurfaces,
  emptyNormalizations,
  emptyRewrites,
  normalizeDeclaration,
  validateInventory,
  validateLocalMigrations,
  validateMappingNormalizations,
  validatePinnedManifests,
} from './component-inventory.mjs';
import {
  reviewedMappingNormalizations,
  reviewedWebAwesomeVideo,
  reviewedWebAwesomeVideoPlaylist,
  rootRegistrationMetadata,
} from './generate-component-inventory.mjs';
import cemConfig, {
  ACCESSOR_RUNTIME_CONTRACTS,
  EVENT_RUNTIME_CONTRACTS,
  INHERITED_PUBLIC_MEMBER_CONTRACTS,
} from '../custom-elements-manifest.config.js';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...segments) => JSON.parse(fs.readFileSync(path.join(packageDir, ...segments), 'utf8'));

test('the CEM FormAssociated projection is truthful, scoped, and idempotent', () => {
  const plugin = cemConfig.plugins.find(({ name }) => name === 'lr-form-associated-mixin-members');
  assert.ok(plugin?.packageLinkPhase, 'the FormAssociated projection plugin is installed');

  const synthetic = {
    modules: [
      {
        path: 'synthetic.ts',
        declarations: [
          {
            kind: 'class',
            name: 'FormControl',
            mixins: [{ name: 'FormAssociated' }],
          },
          {
            kind: 'class',
            name: 'DerivedFormControl',
            superclass: { name: 'FormControl', module: 'synthetic.ts' },
          },
          { kind: 'class', name: 'PlainElement' },
        ],
      },
    ],
  };
  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  const projected = synthetic.modules[0].declarations.find(({ name }) => name === 'FormControl');
  const derived = synthetic.modules[0].declarations.find(({ name }) => name === 'DerivedFormControl');
  const plain = synthetic.modules[0].declarations.find(({ name }) => name === 'PlainElement');
  const member = (name) => projected.members.find((candidate) => candidate.name === name);
  const attribute = (name) => projected.attributes.find((candidate) => candidate.name === name);

  assert.equal(member('defaultValue').default, "''");
  assert.equal(member('defaultValue').attribute, 'value');
  assert.equal(attribute('value').default, "''");
  assert.equal(attribute('value').fieldName, 'defaultValue');
  assert.equal(member('form').type.text, 'HTMLFormElement | null');
  assert.equal(member('form').attribute, 'form');
  assert.equal(member('form').default, 'null');
  assert.equal(attribute('form').fieldName, 'form');
  assert.equal(attribute('form').default, 'null');
  assert.match(member('customError').description, /consumer-supplied validation message/i);
  assert.match(attribute('custom-error').description, /consumer-supplied validation message/i);
  assert.match(member('getForm').description, /browser-resolved form owner/i);
  assert.match(member('setCustomValidity').description, /consumer-supplied validation message/i);
  assert.equal(
    derived.members.find(({ name }) => name === 'defaultValue')?.inheritedFrom?.name,
    'FormControl',
    'a subclass receives the mixin surface that CEM inheritance ran too early to copy',
  );
  assert.equal(
    derived.attributes.find(({ name }) => name === 'value')?.fieldName,
    'defaultValue',
  );
  assert.equal(plain.members, undefined, 'a class without the mixin receives no fabricated members');
  assert.equal(plain.attributes, undefined, 'a class without the mixin receives no fabricated attributes');

  const once = structuredClone(synthetic);
  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  assert.deepEqual(synthetic, once, 'running the projection twice is a no-op');

  const liveManifest = readJson('custom-elements.json');
  plugin.packageLinkPhase({ customElementsManifest: liveManifest });
  const controls = liveManifest.modules.flatMap((module) =>
    (module.declarations ?? []).filter((declaration) => (declaration.mixins ?? []).some((mixin) => mixin.name === 'FormAssociated')),
  );
  assert.deepEqual(
    controls.map(({ tagName }) => tagName).sort(),
    [
      'lr-chat-composer',
      'lr-code-editor',
      'lr-color-picker',
      'lr-date-input',
      'lr-emoji-picker',
      'lr-input',
      'lr-known-date',
      'lr-otp-input',
      'lr-phone-input',
      'lr-textarea',
      'lr-time-input',
    ],
    'every live FormAssociated consumer is covered explicitly',
  );
  for (const control of controls) {
    const fields = new Map(control.members.map((candidate) => [candidate.name, candidate]));
    const attributes = new Map(control.attributes.map((candidate) => [candidate.name, candidate]));
    assert.equal(fields.get('defaultValue')?.default, "''", `${control.tagName} defaultValue`);
    assert.equal(attributes.get('value')?.default, "''", `${control.tagName} value attribute`);
    assert.equal(fields.get('form')?.attribute, 'form', `${control.tagName} form field`);
    assert.equal(attributes.get('form')?.fieldName, 'form', `${control.tagName} form attribute`);
  }
});

test('the CEM default-value projection keeps the attribute public without publishing its reactive adapter', () => {
  const plugin = cemConfig.plugins.find(({ name }) => name === 'lr-default-value-attribute-alias');
  assert.ok(plugin?.packageLinkPhase, 'the default-value alias projection plugin is installed');

  const aliasMember = {
    kind: 'field',
    name: 'defaultValueAlias',
    type: { text: 'string' },
    attribute: 'default-value',
  };
  const aliasAttribute = {
    name: 'default-value',
    fieldName: 'defaultValueAlias',
    type: { text: 'string' },
  };
  const synthetic = {
    modules: [
      {
        path: 'synthetic.ts',
        declarations: [
          {
            kind: 'class',
            name: 'InputLike',
            members: [
              { kind: 'field', name: 'defaultValue', type: { text: 'string' }, default: "''" },
              structuredClone(aliasMember),
            ],
            attributes: [structuredClone(aliasAttribute)],
          },
          {
            kind: 'class',
            name: 'ColorPickerLike',
            tagName: 'lr-color-picker',
            members: [
              { kind: 'field', name: 'defaultValue', type: { text: 'string' }, inheritedFrom: { name: 'InputLike' } },
              { ...structuredClone(aliasMember), inheritedFrom: { name: 'InputLike' } },
            ],
            attributes: [{ ...structuredClone(aliasAttribute), inheritedFrom: { name: 'InputLike' } }],
          },
          {
            kind: 'class',
            name: 'RatingLike',
            tagName: 'lr-rating',
            members: [
              { kind: 'field', name: 'defaultValue', type: { text: 'number' }, default: '0' },
              { ...structuredClone(aliasMember), type: { text: 'number' } },
            ],
            attributes: [{ ...structuredClone(aliasAttribute), type: { text: 'number' } }],
          },
          {
            kind: 'class',
            name: 'Unrelated',
            attributes: [{ name: 'default-value', fieldName: 'meaningfulPublicProperty' }],
          },
        ],
      },
    ],
  };

  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  for (const name of ['InputLike', 'ColorPickerLike']) {
    const declaration = synthetic.modules[0].declarations.find((candidate) => candidate.name === name);
    const member = declaration.members.find((candidate) => candidate.name === 'defaultValueAlias');
    const attribute = declaration.attributes.find((candidate) => candidate.name === 'default-value');
    assert.equal(member.privacy, 'private', `${name} adapter is not public API`);
    assert.equal(attribute.fieldName, 'defaultValue', `${name} attribute maps to the supported IDL`);
    assert.equal(attribute.type.text, 'string');
    assert.equal(attribute.default, "''");
    assert.match(attribute.description, /reset value/i);
  }
  const rating = synthetic.modules[0].declarations.find((candidate) => candidate.name === 'RatingLike');
  const ratingMember = rating.members.find((candidate) => candidate.name === 'defaultValueAlias');
  const ratingAttribute = rating.attributes.find((candidate) => candidate.name === 'default-value');
  assert.equal(ratingMember.privacy, 'private', 'numeric adapter is not public API');
  assert.equal(ratingAttribute.fieldName, 'defaultValue', 'numeric attribute maps to the supported IDL');
  assert.equal(ratingAttribute.type.text, 'number', 'numeric canonical type is preserved');
  assert.equal(ratingAttribute.default, '0', 'numeric canonical default is preserved');
  assert.match(ratingAttribute.description, /reset value/i);
  assert.equal(
    synthetic.modules[0].declarations.find(({ name }) => name === 'Unrelated').attributes[0].fieldName,
    'meaningfulPublicProperty',
    'an unrelated default-value attribute is untouched',
  );

  const once = structuredClone(synthetic);
  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  assert.deepEqual(synthetic, once, 'running the alias projection twice is a no-op');

  const liveManifest = readJson('custom-elements.json');
  cemConfig.plugins
    .find(({ name }) => name === 'lr-form-associated-mixin-members')
    .packageLinkPhase({ customElementsManifest: liveManifest });
  plugin.packageLinkPhase({ customElementsManifest: liveManifest });
  for (const tagName of ['lr-input', 'lr-native-time-input', 'lr-number-input', 'lr-textarea']) {
    const declaration = liveManifest.modules
      .flatMap((module) => module.declarations ?? [])
      .find((candidate) => candidate.tagName === tagName);
    const member = declaration.members.find((candidate) => candidate.name === 'defaultValueAlias');
    const attribute = declaration.attributes.find((candidate) => candidate.name === 'default-value');
    assert.equal(member?.privacy, 'private', `${tagName} live adapter`);
    assert.equal(attribute?.fieldName, 'defaultValue', `${tagName} live attribute`);
  }
});

test('the CEM chart projection reports each runtime-locked subclass type default', () => {
  const plugin = cemConfig.plugins.find(({ name }) => name === 'lr-locked-chart-type-defaults');
  assert.ok(plugin?.packageLinkPhase, 'the locked chart type projection plugin is installed');

  const lockedTypes = new Map([
    ['lr-bar-chart', 'bar'],
    ['lr-bubble-chart', 'bubble'],
    ['lr-doughnut-chart', 'doughnut'],
    ['lr-line-chart', 'line'],
    ['lr-pie-chart', 'pie'],
    ['lr-polar-area-chart', 'polarArea'],
    ['lr-radar-chart', 'radar'],
    ['lr-scatter-chart', 'scatter'],
  ]);
  const declaration = (tagName) => ({
    kind: 'class',
    name: tagName,
    tagName,
    customElement: true,
    members: [{ kind: 'field', name: 'type', default: "'bar'", inheritedFrom: { name: 'LyraChart' } }],
    attributes: [{ name: 'type', fieldName: 'type', default: "'bar'" }],
  });
  const synthetic = {
    modules: [
      {
        path: 'synthetic.ts',
        declarations: [
          ...[...lockedTypes.keys()].map(declaration),
          declaration('lr-chart'),
          declaration('lr-lite-chart'),
        ],
      },
    ],
  };

  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  for (const [tagName, type] of lockedTypes) {
    const projected = synthetic.modules[0].declarations.find((candidate) => candidate.tagName === tagName);
    assert.equal(projected.members.find(({ name }) => name === 'type').default, `'${type}'`, `${tagName} member`);
    assert.equal(projected.attributes.find(({ name }) => name === 'type').default, `'${type}'`, `${tagName} attribute`);
  }
  for (const tagName of ['lr-chart', 'lr-lite-chart']) {
    const untouched = synthetic.modules[0].declarations.find((candidate) => candidate.tagName === tagName);
    assert.equal(untouched.members.find(({ name }) => name === 'type').default, "'bar'");
    assert.equal(untouched.attributes.find(({ name }) => name === 'type').default, "'bar'");
  }

  const once = structuredClone(synthetic);
  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  assert.deepEqual(synthetic, once, 'running the projection twice is a no-op');

  const liveManifest = readJson('custom-elements.json');
  plugin.packageLinkPhase({ customElementsManifest: liveManifest });
  for (const [tagName, type] of lockedTypes) {
    const projected = liveManifest.modules
      .flatMap((module) => module.declarations ?? [])
      .find((candidate) => candidate.tagName === tagName);
    assert.equal(projected.members.find(({ name }) => name === 'type').default, `'${type}'`, `${tagName} live member`);
    assert.equal(projected.attributes.find(({ name }) => name === 'type').default, `'${type}'`, `${tagName} live attribute`);
  }
});

test('the CEM accessor projection publishes only reviewed runtime defaults and reflection', () => {
  const plugin = cemConfig.plugins.find(({ name }) => name === 'lr-accessor-runtime-contracts');
  assert.ok(plugin?.packageLinkPhase, 'the accessor runtime projection plugin is installed');

  const field = (name, type = 'string') => ({ kind: 'field', name, type: { text: type } });
  const attribute = (name, fieldName) => ({ name, fieldName, type: { text: 'string' } });
  const synthetic = {
    modules: [{
      path: 'synthetic.ts',
      declarations: [
        ...[...ACCESSOR_RUNTIME_CONTRACTS].map(([tagName, contract]) => ({
          kind: 'class',
          name: tagName,
          tagName,
          members: Object.keys(contract).map((name) => field(name, name === 'dragging' ? 'boolean' : 'string')),
          attributes: Object.entries(contract)
            .filter(([, metadata]) => metadata.attribute && !metadata.createAttribute)
            .map(([name, metadata]) => attribute(metadata.attribute, name)),
        })),
        { kind: 'class', name: 'Unrelated', tagName: 'lr-unrelated', members: [field('disabled', 'boolean')] },
      ],
    }],
  };

  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  const declaration = (tagName) => synthetic.modules[0].declarations.find((entry) => entry.tagName === tagName);
  const member = (tagName, name) => declaration(tagName).members.find((entry) => entry.name === name);
  const projectedAttribute = (tagName, name) => declaration(tagName).attributes.find((entry) => entry.name === name);

  for (const [tagName, contract] of ACCESSOR_RUNTIME_CONTRACTS) {
    for (const [name, metadata] of Object.entries(contract)) {
      assert.equal(member(tagName, name).default, metadata.default, `${tagName}.${name} default`);
      if (metadata.attribute) {
        assert.equal(
          projectedAttribute(tagName, metadata.attribute).default,
          metadata.default,
          `${tagName}[${metadata.attribute}] default`,
        );
      }
    }
  }

  assert.equal(member('lr-combobox', 'inputValue').default, "''");
  assert.equal(member('lr-combobox', 'maxOptionsVisible').default, '3');
  assert.equal(member('lr-combobox', 'autocorrect').default, 'true');
  assert.equal(member('lr-input', 'autocorrect').default, 'true');
  assert.equal(member('lr-textarea', 'autocorrect').default, 'true');
  assert.equal(projectedAttribute('lr-date-input', 'mode').default, "'single'");
  assert.equal(member('lr-file-input', 'files').default, '[]');
  assert.equal(member('lr-file-input', 'name').default, 'null');
  assert.equal(projectedAttribute('lr-popover', 'for').default, "''");
  assert.equal(projectedAttribute('lr-tooltip', 'for').default, "''");
  assert.equal(member('lr-file-input', 'dragging').readonly, true);
  assert.equal(member('lr-file-input', 'dragging').reflects, true);
  assert.equal(member('lr-select', 'selectedOptions').readonly, false);
  assert.deepEqual(
    projectedAttribute('lr-file-input', 'dragging'),
    {
      name: 'dragging',
      fieldName: 'dragging',
      type: { text: 'boolean' },
      default: 'false',
    },
  );
  assert.equal(member('lr-unrelated', 'disabled').default, undefined, 'an unrelated accessor is untouched');

  const once = structuredClone(synthetic);
  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  assert.deepEqual(synthetic, once, 'running the accessor projection twice is a no-op');

  const malformed = structuredClone(synthetic);
  const malformedFile = malformed.modules[0].declarations.find(({ tagName }) => tagName === 'lr-file-input');
  malformedFile.members = malformedFile.members.filter(({ name }) => name !== 'files');
  assert.throws(
    () => plugin.packageLinkPhase({ customElementsManifest: malformed }),
    /lr-file-input: accessor projection requires public member files/,
    'a source rename cannot silently leave stale projected metadata behind',
  );
});

test('the CEM inherited-member projection repairs only reviewed runtime inheritance gaps', () => {
  const plugin = cemConfig.plugins.find(({ name }) => name === 'lr-inherited-public-member-contracts');
  assert.ok(plugin?.packageLinkPhase, 'the inherited public-member projection plugin is installed');
  assert.deepEqual(
    [...INHERITED_PUBLIC_MEMBER_CONTRACTS],
    [['lr-drawer', { sourceTag: 'lr-dialog', members: ['modal'] }]],
  );

  const synthetic = {
    modules: [
      {
        path: 'dialog.class.ts',
        declarations: [{
          kind: 'class',
          name: 'LyraDialog',
          tagName: 'lr-dialog',
          members: [{
            kind: 'field',
            name: 'modal',
            readonly: true,
            type: { text: 'LyraDialogModalController' },
          }],
        }],
      },
      {
        path: 'drawer.class.ts',
        declarations: [{ kind: 'class', name: 'LyraDrawer', tagName: 'lr-drawer', members: [] }],
      },
      {
        path: 'unrelated.ts',
        declarations: [{ kind: 'class', name: 'Unrelated', tagName: 'lr-unrelated', members: [] }],
      },
    ],
  };

  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  const drawer = synthetic.modules[1].declarations[0];
  assert.deepEqual(drawer.members[0], {
    kind: 'field',
    name: 'modal',
    readonly: true,
    type: { text: 'LyraDialogModalController' },
    inheritedFrom: { name: 'LyraDialog', module: 'dialog.class.ts' },
  });
  assert.deepEqual(synthetic.modules[2].declarations[0].members, []);

  const once = structuredClone(synthetic);
  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  assert.deepEqual(synthetic, once, 'running the inherited-member projection twice is a no-op');

  const malformed = structuredClone(synthetic);
  malformed.modules[0].declarations[0].members = [];
  malformed.modules[1].declarations[0].members = [];
  assert.throws(
    () => plugin.packageLinkPhase({ customElementsManifest: malformed }),
    /lr-drawer: inherited-member projection requires lr-dialog\.modal/,
  );
});

test('the CEM event projection preserves reviewed runtime constructors', () => {
  const plugin = cemConfig.plugins.find(({ name }) => name === 'lr-event-runtime-contracts');
  assert.ok(plugin?.packageLinkPhase, 'the event runtime projection plugin is installed');

  const synthetic = {
    modules: [{
      path: 'synthetic.ts',
      declarations: [
        ...[...EVENT_RUNTIME_CONTRACTS].map(([tagName, contract]) => ({
          kind: 'class',
          name: tagName,
          tagName,
          events: Object.keys(contract).map((name) => ({ name })),
        })),
        { kind: 'class', name: 'Unrelated', tagName: 'lr-unrelated', events: [{ name: 'change' }] },
      ],
    }],
  };

  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  for (const [tagName, contract] of EVENT_RUNTIME_CONTRACTS) {
    const declaration = synthetic.modules[0].declarations.find((entry) => entry.tagName === tagName);
    for (const [name, type] of Object.entries(contract)) {
      assert.equal(
        declaration.events.find((event) => event.name === name).type.text,
        type,
        `${tagName}#${name}`,
      );
    }
  }
  assert.equal(
    synthetic.modules[0].declarations.find(({ tagName }) => tagName === 'lr-unrelated').events[0].type,
    undefined,
    'an unrelated event is untouched',
  );

  const once = structuredClone(synthetic);
  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  assert.deepEqual(synthetic, once, 'running the event projection twice is a no-op');

  const malformed = structuredClone(synthetic);
  const malformedInput = malformed.modules[0].declarations.find(({ tagName }) => tagName === 'lr-input');
  malformedInput.events = malformedInput.events.filter(({ name }) => name !== 'input');
  assert.throws(
    () => plugin.packageLinkPhase({ customElementsManifest: malformed }),
    /lr-input: event projection requires public event input/,
    'a source event rename cannot silently leave stale projected metadata behind',
  );
});

test('root registration derives from reviewed peer policy without reading generated artifacts', () => {
  assert.deepEqual(
    rootRegistrationMetadata({ tag: 'lr-new', rootIncluded: false, rootExclusion: 'unreviewed' }, [], 'lr-new'),
    { rootIncluded: true, rootExclusion: null },
    'a newly discovered peer-free component is enrolled automatically',
  );
  assert.deepEqual(
    rootRegistrationMetadata({ rootIncluded: true, rootExclusion: null }, ['lazy-peer'], 'lr-lazy'),
    { rootIncluded: true, rootExclusion: null },
    'a reviewed lazy-peer component remains in the root barrel',
  );
  assert.deepEqual(
    rootRegistrationMetadata({ rootIncluded: false, rootExclusion: 'optional-peer-family' }, ['eager-peer'], 'lr-opt-in'),
    { rootIncluded: false, rootExclusion: 'optional-peer-family' },
    'a reviewed opt-in peer family remains excluded',
  );
  assert.deepEqual(
    rootRegistrationMetadata(undefined, ['new-peer'], 'lr-unreviewed-peer'),
    { rootIncluded: false, rootExclusion: 'unreviewed' },
    'new peer-bearing components fail closed pending an explicit policy decision',
  );
  assert.throws(
    () => rootRegistrationMetadata({ rootIncluded: false, rootExclusion: 'invented' }, [], 'lr-bad'),
    /unsupported root exclusion invented/,
  );
});

test('the manual wa-video review records the complete public contract independently of Lyra', () => {
  const reviewed = reviewedWebAwesomeVideo();
  assert.equal(reviewed.review.status, 'complete');
  assert.equal(reviewed.surface.properties.length, 16);
  assert.equal(reviewed.surface.slots.length, 10);
  assert.equal(reviewed.surface.methods.length, 11);
  assert.equal(reviewed.surface.events.length, 7);
  assert.equal(reviewed.surface.parts.length, 16);
  assert.equal(reviewed.surface.cssProperties.length, 3);
  assert.equal(
    reviewed.surface.methods.find(({ name }) => name === 'getState')?.overloads[0]?.returnType,
    'VideoState',
    'the upstream-compatible public alias remains the documented getState signature',
  );
  assert.deepEqual(
    reviewed.surface.properties.filter((property) => property.reflects).map((property) => property.name),
    ['controls', 'muted', 'playing'],
  );

  const compatibleLyra = structuredClone(reviewed.surface);
  compatibleLyra.attributes.push({
    name: 'locale',
    property: 'locale',
    type: 'string',
    reflects: true,
    inferred: false,
    deprecated: null,
    hasDefault: true,
    default: '',
  });
  compatibleLyra.properties.push({
    name: 'locale',
    attribute: 'locale',
    type: 'string',
    readonly: false,
    reflects: true,
    deprecated: null,
    hasDefault: true,
    default: '',
  });
  compatibleLyra.methods.push({
    name: 'load',
    overloads: [{ parameters: [], returnType: 'void' }],
  });
  compatibleLyra.native.delegatedMethods.push('load');
  assert.deepEqual(
    compareMappedSurfaces(reviewed.surface, compatibleLyra, {
      upstreamPrefix: 'wa-',
      rewrites: emptyRewrites(),
    }),
    [],
    'documented additive Lyra hardening does not fabricate a rewrite',
  );

  compatibleLyra.attributes.find((attribute) => attribute.name === 'controls').default = 'full';
  assert.match(
    JSON.stringify(
      compareMappedSurfaces(reviewed.surface, compatibleLyra, {
        upstreamPrefix: 'wa-',
        rewrites: emptyRewrites(),
      }),
    ),
    /default-mismatch/,
    'a later Lyra contract divergence still fails the public-doc comparison',
  );
});

test('the manual wa-video-playlist review is complete and comparison-driven', () => {
  const reviewed = reviewedWebAwesomeVideoPlaylist();
  assert.equal(reviewed.review.status, 'complete');
  assert.deepEqual(
    reviewed.surface.properties.map(({ name, default: defaultValue, reflects }) => ({
      name,
      default: defaultValue,
      reflects,
    })),
    [
      { name: 'controls', default: 'full', reflects: true },
      { name: 'iconLibrary', default: 'system', reflects: false },
    ],
  );
  assert.deepEqual(
    reviewed.surface.slots.map((slot) => slot.name),
    [''],
  );
  assert.deepEqual(
    reviewed.surface.methods.map((method) => method.name),
    ['goTo', 'next', 'previous'],
  );
  assert.deepEqual(reviewed.surface.parts.map((part) => part.name).sort(), [
    'base',
    'playlist',
    'playlist-duration',
    'playlist-item',
    'playlist-thumbnail',
    'playlist-title',
    'video-playlist',
  ]);
  assert.match(reviewed.surface.events[0].type, /previousIndex/);
  assert.match(reviewed.surface.events[0].type, /currentIndex/);
  assert.match(reviewed.surface.events[0].type, /title: string; poster: string; sources: unknown\[\]; tracks: unknown\[\]/);

  const inventory = readJson('scripts', 'fixtures', 'component-inventory.json');
  const target = inventory.components.find((component) => component.tag === 'lr-video-playlist').surface;
  const rewrites = emptyRewrites();
  rewrites.events.push({ from: 'wa-video-change', to: 'lr-video-change' });
  const normalizations = reviewedMappingNormalizations('wa-video-playlist');
  assert.deepEqual(
    compareMappedSurfaces(reviewed.surface, target, {
      upstreamPrefix: 'wa-',
      rewrites,
      normalizations,
    }),
    [],
    'the deterministic event-prefix rewrite covers the complete reviewed upstream surface',
  );

  const drifted = structuredClone(target);
  drifted.parts = drifted.parts.filter((part) => part.name !== 'playlist-title');
  assert.deepEqual(
    compareMappedSurfaces(reviewed.surface, drifted, {
      upstreamPrefix: 'wa-',
      rewrites,
      normalizations,
    }),
    [{ code: 'missing-part', section: 'parts', member: 'playlist-title' }],
    'a later source divergence fails comparison instead of preserving a forced classification',
  );
});

test('normalization keeps public contracts and rejects analyzer implementation detail', () => {
  const normalized = normalizeDeclaration(
    {
      tagName: 'wa-example',
      customElement: true,
      status: 'stable',
      since: '3.0',
      attributes: [
        {
          name: 'open',
          fieldName: 'open',
          type: { text: 'boolean' },
          default: 'false',
        },
      ],
      members: [
        {
          kind: 'field',
          name: 'open',
          attribute: 'open',
          type: { text: 'boolean' },
          default: 'false',
        },
        {
          kind: 'field',
          name: 'secret',
          privacy: 'private',
          type: { text: 'string' },
        },
        {
          kind: 'field',
          name: 'currentTime',
          type: { text: 'CSSNumberish' },
        },
        {
          kind: 'field',
          name: 'keyframes',
          type: { text: 'Keyframe[] | undefined' },
          default: 'undefined',
        },
        { kind: 'method', name: 'handleClick' },
        { kind: 'method', name: 'render' },
        {
          kind: 'method',
          name: 'addEventListener',
          inheritedFrom: {
            name: 'WebAwesomeElement',
            module: 'internal/webawesome-element.js',
          },
        },
        {
          kind: 'method',
          name: 'show',
          description: 'Shows the component.',
          return: { type: { text: 'Promise<void>' } },
        },
        {
          kind: 'method',
          name: 'hide',
          description: 'Hides the component without publishing a return contract.',
        },
        {
          kind: 'method',
          name: 'openSubmenu',
          inheritedFrom: { name: 'LyraDropdownItem', module: 'dropdown-item.class.js' },
          return: { type: { text: 'void' } },
        },
        {
          kind: 'method',
          name: 'closeSubmenu',
          inheritedFrom: { name: 'LyraDropdownItem', module: 'dropdown-item.class.js' },
          return: { type: { text: 'void' } },
        },
        {
          kind: 'method',
          name: 'setCustomValidity',
          parameters: [{ name: 'message', default: "''" }],
        },
      ],
      events: [
        {
          name: 'wa-before-open',
          description: 'Cancelable; preventDefault() keeps it closed.',
        },
        { name: 'wa-after-open', description: 'Emitted after opening.' },
        {
          name: 'wa-request',
          description: 'Not cancelable; preventDefault() has no effect.',
        },
        {
          name: 'wa-mixed',
          description: 'Cancelable for commits and non-cancelable for live feedback.',
        },
      ],
      slots: [{ name: '', description: 'Default content.' }],
      cssParts: [{ name: 'base' }],
      cssProperties: [{ name: '--duration', default: '200ms' }],
      cssStates: [{ name: 'open' }],
    },
    { ecosystem: 'webawesome' },
  );

  assert.deepEqual(
    normalized.attributes.map((entry) => entry.name),
    ['open'],
  );
  assert.deepEqual(
    normalized.methods.map((entry) => entry.name),
    ['closeSubmenu', 'hide', 'openSubmenu', 'setCustomValidity', 'show'],
    'reviewed public submenu controls survive inheritedFrom metadata while unreviewed internals do not',
  );
  assert.deepEqual(
    normalized.properties.map((entry) => entry.name),
    ['currentTime', 'keyframes', 'open'],
    'reviewed Web Animations property-only fields remain public without inventing attributes',
  );
  assert.equal(
    normalized.methods.find(({ name }) => name === 'hide').overloads[0].returnType,
    'unspecified-public-documentation',
    'an absent upstream return contract is a wildcard, not an invented unknown return type',
  );
  assert.equal(
    normalized.methods.find(({ name }) => name === 'show').overloads[0].returnType,
    'Promise<void>',
    'an explicit published return type remains structural comparison data',
  );
  assert.equal(
    normalized.methods.find(({ name }) => name === 'setCustomValidity').overloads[0].parameters[0].type,
    'unspecified-public-documentation',
    'an absent upstream parameter type stays an explicit wildcard rather than invented unknown',
  );
  assert.deepEqual(
    normalized.events.map(({ name, cancelable }) => ({ name, cancelable })),
    [
      { name: 'wa-after-open', cancelable: 'unspecified-public-documentation' },
      { name: 'wa-before-open', cancelable: 'always' },
      { name: 'wa-mixed', cancelable: 'conditional' },
      { name: 'wa-request', cancelable: 'never' },
    ],
  );
  assert.deepEqual(
    normalized.cssStates.map((entry) => entry.name),
    ['open'],
  );
  assert.equal(normalized.maturity.status, 'stable');
  assert.equal(normalized.maturity.since, '3.0');

  assert.throws(
    () =>
      normalizeDeclaration(
        { customElement: true, tagName: 'lr-malformed-css', cssProperties: [{}] },
        { ecosystem: 'lyra' },
      ),
    /lr-malformed-css: malformed CSS custom-property manifest entry/,
    'a malformed CEM annotation fails with its tag instead of crashing during an anonymous sort',
  );
});

test('surface comparison catches member, default, cancelability, and polarity drift', () => {
  const upstream = {
    attributes: [
      {
        name: 'with-summary',
        property: 'withSummary',
        type: 'boolean',
        hasDefault: true,
        default: true,
      },
      {
        name: 'placement',
        property: 'placement',
        type: 'string',
        hasDefault: true,
        default: 'top',
      },
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
      {
        name: 'hide-summary',
        property: 'hideSummary',
        type: 'boolean',
        hasDefault: true,
        default: true,
      },
      {
        name: 'placement',
        property: 'placement',
        type: 'string',
        hasDefault: true,
        default: 'bottom',
      },
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

  const drift = compareMappedSurfaces(upstream, target, {
    upstreamPrefix: 'wa-',
  });
  assert.ok(drift.some((entry) => entry.code === 'polarity-mismatch'));
  assert.ok(drift.some((entry) => entry.code === 'default-mismatch'));
  assert.ok(drift.some((entry) => entry.code === 'cancelability-mismatch'));
  assert.ok(drift.some((entry) => entry.code === 'missing-slot'));
  assert.ok(drift.some((entry) => entry.code === 'missing-method'));

  upstream.events[0].cancelable = 'unspecified-public-documentation';
  assert.ok(
    !compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' })
      .some((entry) => entry.code === 'cancelability-mismatch'),
    'silence in published upstream docs does not invent a non-cancelable contract',
  );
});

test('surface comparison catches normalized attribute and property contract drift', () => {
  const common = {
    slots: [],
    events: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    methods: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const upstream = {
    ...common,
    attributes: [
      {
        name: 'active',
        property: 'active',
        type: 'boolean',
        reflects: true,
        hasDefault: false,
      },
    ],
    properties: [
      {
        name: 'active',
        attribute: 'active',
        type: 'boolean',
        reflects: true,
        readonly: false,
        hasDefault: false,
      },
      {
        name: 'controller',
        attribute: null,
        type: 'WaController',
        reflects: true,
        readonly: false,
        hasDefault: false,
      },
    ],
  };
  const target = {
    ...common,
    attributes: [
      {
        name: 'active',
        property: 'active',
        type: 'string',
        reflects: false,
        hasDefault: false,
      },
    ],
    properties: [
      {
        name: 'active',
        attribute: 'active',
        type: 'string',
        reflects: false,
        readonly: false,
        hasDefault: false,
      },
      {
        name: 'controller',
        attribute: null,
        type: 'OtherController',
        reflects: false,
        readonly: true,
        hasDefault: false,
      },
    ],
  };

  const drift = compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' });
  assert.deepEqual(
    drift
      .filter(({ code }) => ['type-mismatch', 'reflection-mismatch', 'readonly-mismatch'].includes(code))
      .map(({ code, section, member }) => ({ code, section, member })),
    [
      { code: 'reflection-mismatch', section: 'attributes', member: 'active' },
      { code: 'type-mismatch', section: 'attributes', member: 'active' },
      { code: 'readonly-mismatch', section: 'properties', member: 'controller' },
      { code: 'reflection-mismatch', section: 'properties', member: 'controller' },
      { code: 'type-mismatch', section: 'properties', member: 'controller' },
    ],
  );

  const compatibleTarget = structuredClone(target);
  compatibleTarget.attributes[0].type = 'boolean | undefined';
  compatibleTarget.attributes[0].reflects = true;
  compatibleTarget.properties[0].type = 'boolean | undefined';
  compatibleTarget.properties[0].reflects = true;
  compatibleTarget.properties[1].type = 'LyraController | undefined';
  compatibleTarget.properties[1].reflects = true;
  compatibleTarget.properties[1].readonly = false;
  assert.deepEqual(
    compareMappedSurfaces(upstream, compatibleTarget, { upstreamPrefix: 'wa-' })
      .filter(({ code }) => ['type-mismatch', 'reflection-mismatch', 'readonly-mismatch'].includes(code)),
    [],
    'mapped names and a target-side union widening preserve the upstream contract',
  );

  const additiveTarget = structuredClone(upstream);
  additiveTarget.attributes[0].reflects = true;
  additiveTarget.properties[1].readonly = false;
  const additiveUpstream = structuredClone(upstream);
  additiveUpstream.attributes[0].reflects = false;
  additiveUpstream.properties[1].readonly = true;
  assert.deepEqual(
    compareMappedSurfaces(additiveUpstream, additiveTarget, { upstreamPrefix: 'wa-' })
      .filter(({ code }) => code === 'reflection-mismatch' || code === 'readonly-mismatch'),
    [],
    'target-side reflection and writability are additive compatibility, not losses',
  );

  const pairedReadonlyTarget = structuredClone(compatibleTarget);
  pairedReadonlyTarget.properties[0].readonly = true;
  assert.deepEqual(
    compareMappedSurfaces(upstream, pairedReadonlyTarget, { upstreamPrefix: 'wa-' })
      .filter(({ code, member }) => code === 'readonly-mismatch' && member === 'active')
      .map(({ section, member, expected, actual }) => ({ section, member, expected, actual })),
    [{ section: 'properties', member: 'active', expected: false, actual: true }],
    'an attribute-backed property retains its independent writable contract',
  );

  const reviewedTarget = structuredClone(target);
  const normalizations = emptyNormalizations();
  normalizations.typeEquivalences.push({
    memberKind: 'property',
    member: 'controller',
    upstream: 'WaController',
    target: 'OtherController',
  });
  assert.deepEqual(
    compareMappedSurfaces(upstream, reviewedTarget, { upstreamPrefix: 'wa-', normalizations })
      .filter(({ code, member }) => code === 'type-mismatch' && member === 'controller'),
    [],
    'an exact reviewed opaque-type equivalence suppresses only that member pair',
  );
  reviewedTarget.properties[1].type = 'DifferentController';
  assert.deepEqual(
    compareMappedSurfaces(upstream, reviewedTarget, { upstreamPrefix: 'wa-', normalizations })
      .filter(({ code, member }) => code === 'type-mismatch' && member === 'controller')
      .map(({ expected, actual }) => ({ expected, actual })),
    [{ expected: 'LyraController', actual: 'DifferentController' }],
    'a changed target type invalidates the exact reviewed pair',
  );

  const undocumentedTarget = structuredClone(compatibleTarget);
  delete undocumentedTarget.attributes[0].type;
  assert.deepEqual(
    compareMappedSurfaces(upstream, undocumentedTarget, { upstreamPrefix: 'wa-' })
      .filter(({ code, member }) => code === 'type-mismatch' && member === 'active')
      .map(({ expected, actual }) => ({ expected, actual })),
    [{ expected: 'boolean', actual: undefined }],
    'a target member with no published type reports drift instead of crashing comparison',
  );
});

test('surface comparison applies every reviewed member rewrite before reporting drift', () => {
  const emptySurface = {
    attributes: [],
    methods: [],
    cssStates: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const upstream = {
    ...emptySurface,
    properties: [{ name: 'upstreamProperty', hasDefault: false }],
    events: [{ name: 'sl-upstream-event', type: 'Event', cancelable: 'never' }],
    slots: [{ name: 'upstream-slot' }],
    parts: [{ name: 'upstream-part' }],
    cssProperties: [{ name: '--upstream-token' }],
  };
  const target = {
    ...emptySurface,
    properties: [{ name: 'lyraProperty', hasDefault: false }],
    events: [{ name: 'lr-lyra-event', type: 'Event', cancelable: 'never' }],
    slots: [{ name: 'lyra-slot' }],
    parts: [{ name: 'lyra-part' }],
    cssProperties: [{ name: '--lyra-token' }],
  };
  const rewrites = emptyRewrites();
  rewrites.properties.push({ from: 'upstreamProperty', to: 'lyraProperty' });
  rewrites.events.push({ from: 'sl-upstream-event', to: 'lr-lyra-event' });
  rewrites.slots.push({ from: 'upstream-slot', to: 'lyra-slot' });
  rewrites.parts.push({ from: 'upstream-part', to: 'lyra-part' });
  rewrites.cssProperties.push({ from: '--upstream-token', to: '--lyra-token' });

  assert.deepEqual(compareMappedSurfaces(upstream, target, { upstreamPrefix: 'sl-', rewrites }), []);
});

test('surface comparison validates complete rendered method overloads, including nested option keys', () => {
  const surface = {
    attributes: [],
    properties: [],
    slots: [],
    events: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const parameter = (name, type, optional = false) => ({
    name,
    type,
    optional,
    hasDefault: false,
  });
  const upstream = {
    ...surface,
    methods: [
      {
        name: 'copySelectedRows',
        overloads: [
          {
            parameters: [
              parameter(
                'options',
                "{ columnIds?: string[]; includeHeaders?: boolean; format?: 'tsv' | 'csv'; escapeFormulas?: boolean; }",
                true,
              ),
            ],
            returnType: 'unspecified-public-documentation',
          },
        ],
      },
      {
        name: 'pinColumn',
        overloads: [
          {
            parameters: [parameter('columnId', 'string'), parameter('side', "'left' | 'right' | false")],
            returnType: 'unspecified-public-documentation',
          },
        ],
      },
    ],
  };
  const target = {
    ...surface,
    methods: [
      {
        name: 'copySelectedRows',
        overloads: [
          {
            parameters: [
              parameter(
                'options',
                "{ columns?: string[]; includeHeaders?: boolean; format?: 'tsv' | 'csv'; escapeFormulas?: boolean; }",
                true,
              ),
            ],
            returnType: 'number',
          },
        ],
      },
      {
        name: 'pinColumn',
        overloads: [
          {
            parameters: [parameter('columnId', 'string'), parameter('side', "'left' | 'right' | null")],
            returnType: 'void',
          },
        ],
      },
    ],
  };

  assert.deepEqual(
    compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' }).map(({ code, member }) => ({ code, member })),
    [
      { code: 'method-signature-mismatch', member: 'copySelectedRows' },
      { code: 'method-signature-mismatch', member: 'pinColumn' },
    ],
  );

  target.methods[0].overloads[0].parameters = structuredClone(upstream.methods[0].overloads[0].parameters);
  target.methods[1].overloads[0].parameters = structuredClone(upstream.methods[1].overloads[0].parameters);
  assert.deepEqual(
    compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' }),
    [],
    'an unspecified public return type ignores richer implementation return data after arguments match',
  );

  target.methods[0].overloads[0].parameters[0].optional = false;
  assert.deepEqual(
    compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' }).map(({ code, member }) => ({ code, member })),
    [{ code: 'method-signature-mismatch', member: 'copySelectedRows' }],
    'optional/default shape remains part of the rendered method signature',
  );

  target.methods[0].overloads[0].parameters = [
    structuredClone(upstream.methods[0].overloads[0].parameters[0]),
    parameter('mode', "'restore' | 'autocomplete'", true),
  ];
  assert.deepEqual(
    compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' }),
    [],
    'an additional optional target parameter preserves the reviewed call shape',
  );

  target.methods[0].overloads[0].parameters[1].optional = false;
  assert.deepEqual(
    compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' }).map(({ code, member }) => ({ code, member })),
    [{ code: 'method-signature-mismatch', member: 'copySelectedRows' }],
    'an additional required target parameter changes the reviewed call shape',
  );

  upstream.methods.push({
    name: 'getChildrenItems',
    overloads: [{ parameters: [], returnType: 'WaTreeItem[]' }],
  });
  target.methods.push({
    name: 'getChildrenItems',
    overloads: [{ parameters: [], returnType: 'LyraTreeItem[]' }],
  });
  target.methods[0].overloads[0].parameters.pop();
  assert.deepEqual(
    compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' }),
    [],
    'the deterministic package class prefix maps WaTreeItem to LyraTreeItem in method types',
  );

  target.methods.at(-1).overloads[0].returnType = 'OtherTreeItem[]';
  assert.ok(
    compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' })
      .some(({ code, member }) => code === 'method-signature-mismatch' && member === 'getChildrenItems'),
    'an unrelated nominal return type still fails structural comparison',
  );

  target.methods.at(-1).overloads[0].returnType = 'LyraTreeItem[]';
  upstream.methods[0].overloads[0].parameters[0].type = 'unspecified-public-documentation';
  target.methods[0].overloads[0].parameters[0].type = 'string';
  assert.deepEqual(
    compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' }),
    [],
    'a published parameter with no type annotation does not invent an unknown-type incompatibility',
  );
});

test('reviewed unknown upstream method returns are comparison wildcards only for named methods', () => {
  const surface = {
    attributes: [],
    properties: [],
    slots: [],
    events: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const upstream = {
    ...surface,
    methods: [
      { name: 'getFormattedValue', overloads: [{ parameters: [], returnType: 'unknown' }] },
      { name: 'checkValidity', overloads: [{ parameters: [], returnType: 'unknown' }] },
    ],
  };
  const target = {
    ...surface,
    methods: [
      { name: 'getFormattedValue', overloads: [{ parameters: [], returnType: 'string' }] },
      { name: 'checkValidity', overloads: [{ parameters: [], returnType: 'boolean' }] },
    ],
  };
  const normalizations = {
    unknownMethodReturnTypes: [{ method: 'getFormattedValue' }],
  };

  assert.deepEqual(
    compareMappedSurfaces(upstream, target, { upstreamPrefix: 'sl-', normalizations })
      .map(({ code, member }) => ({ code, member })),
    [{ code: 'method-signature-mismatch', member: 'checkValidity' }],
    'the reviewed method accepts Lyra\'s concrete return while an unreviewed unknown stays drift',
  );
});

test('reviewed derived defaults preserve a dynamic target value without inventing a static default', () => {
  const surface = {
    properties: [],
    slots: [],
    events: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    methods: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const upstream = {
    ...surface,
    attributes: [{ name: 'rel', property: 'rel', hasDefault: true, default: 'noreferrer noopener' }],
  };
  const target = {
    ...surface,
    attributes: [{ name: 'rel', property: 'rel', hasDefault: false }],
  };
  const normalizations = {
    derivedDefaultEquivalences: [
      {
        memberKind: 'attribute',
        member: 'rel',
        upstream: 'noreferrer noopener',
        target: 'noopener noreferrer',
      },
    ],
  };

  assert.deepEqual(compareMappedSurfaces(upstream, target, { upstreamPrefix: 'sl-', normalizations }), []);
  assert.ok(
    compareMappedSurfaces(upstream, target, { upstreamPrefix: 'sl-' })
      .some(({ code, member }) => code === 'default-mismatch' && member === 'rel'),
    'the dynamic-value exception is never inferred without an explicit reviewed rule',
  );

  const mappingNormalizations = {
    typeEquivalences: [],
    defaultEquivalences: [],
    derivedDefaultEquivalences: normalizations.derivedDefaultEquivalences,
    inferredAttributeSuppressions: [],
    unknownMethodReturnTypes: [],
  };
  assert.deepEqual(
    validateMappingNormalizations(
      { upstreamTag: 'sl-button', normalizations: mappingNormalizations },
      { upstream, target },
    ),
    [],
  );
  const staleTarget = structuredClone(target);
  staleTarget.attributes[0].hasDefault = true;
  staleTarget.attributes[0].default = 'noopener noreferrer';
  assert.ok(
    validateMappingNormalizations(
      { upstreamTag: 'sl-button', normalizations: mappingNormalizations },
      { upstream, target: staleTarget },
    ).some((finding) => finding.includes('stale derived target default')),
  );
});

test('native event review compares constructors and propagation flags, not names alone', () => {
  const normalized = normalizeDeclaration(
    {
      customElement: true,
      tagName: 'lr-native-events',
      events: [
        {
          name: 'input',
          type: { text: 'InputEvent' },
          description: 'A bubbling, composed, non-cancelable native input event.',
        },
        {
          name: 'pause',
          type: { text: 'Event' },
          description: 'A non-bubbling and non-composed native media event.',
        },
      ],
    },
    { ecosystem: 'lyra' },
  );
  assert.deepEqual(normalized.events, [
    {
      name: 'input',
      type: 'InputEvent',
      cancelable: 'never',
      constructor: 'InputEvent',
      bubbles: true,
      composed: true,
    },
    {
      name: 'pause',
      type: 'Event',
      cancelable: 'never',
      constructor: 'Event',
      bubbles: false,
      composed: false,
    },
  ]);

  const base = {
    attributes: [],
    properties: [],
    slots: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    methods: [],
    native: { forwardedEvents: ['input'], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const upstream = {
    ...base,
    events: [
      {
        name: 'input',
        type: 'InputEvent',
        cancelable: 'never',
        constructor: 'InputEvent',
        bubbles: true,
        composed: true,
      },
    ],
  };
  const target = {
    ...base,
    events: [
      {
        name: 'input',
        type: 'CustomEvent<undefined>',
        cancelable: 'never',
        constructor: 'CustomEvent<undefined>',
        bubbles: false,
        composed: false,
      },
    ],
  };
  assert.deepEqual(
    compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' }).map(({ code }) => code),
    ['event-bubbles-mismatch', 'event-composed-mismatch', 'event-constructor-mismatch'],
  );

  const published = normalizeDeclaration(
    {
      customElement: true,
      tagName: 'wa-published-events',
      events: [
        {
          name: 'wa-detail',
          type: { text: '{ item: WaAccordionItem }' },
          description: 'Emitted with the affected item.',
        },
        {
          name: 'wa-input',
          type: { text: 'InputEvent' },
          description: 'A bubbling and composed input event.',
        },
        {
          name: 'wa-focus',
          type: { text: 'FocusEvent' },
          description: 'A bubbling and composed focus event.',
        },
        {
          name: 'wa-custom',
          type: { text: 'CustomEvent<{ value: string }>' },
          description: 'A cancelable custom event.',
        },
      ],
    },
    { ecosystem: 'webawesome' },
  );
  const publishedEvent = (name) => published.events.find((event) => event.name === name);
  assert.equal(
    Object.hasOwn(publishedEvent('wa-detail'), 'constructor'),
    false,
    'an event detail payload is not misclassified as a DOM event constructor',
  );
  assert.equal(publishedEvent('wa-detail').cancelable, 'unspecified-public-documentation');
  assert.equal(publishedEvent('wa-input').constructor, 'InputEvent');
  assert.equal(publishedEvent('wa-focus').constructor, 'FocusEvent');
  assert.equal(publishedEvent('wa-custom').constructor, 'CustomEvent');
  assert.equal(publishedEvent('wa-custom').cancelable, 'always');
});

test('reviewed comparison normalizations cover only exact default pairs and inferred analyzer attributes', () => {
  const upstream = {
    attributes: [
      {
        name: 'get-tag',
        property: 'getTag',
        inferred: true,
        hasDefault: false,
      },
      {
        name: 'size',
        property: 'size',
        inferred: false,
        hasDefault: true,
        default: 'medium',
      },
    ],
    properties: [
      { name: 'filter', attribute: null, hasDefault: true, default: null },
      { name: 'getTag', attribute: 'get-tag', hasDefault: false },
      { name: 'size', attribute: 'size', hasDefault: true, default: 'medium' },
    ],
    slots: [],
    events: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    methods: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const target = {
    attributes: [
      {
        name: 'size',
        property: 'size',
        inferred: false,
        hasDefault: true,
        default: 'm',
      },
    ],
    properties: [
      { name: 'filter', attribute: null, hasDefault: true, default: '' },
      { name: 'getTag', attribute: null, hasDefault: false },
      { name: 'size', attribute: 'size', hasDefault: true, default: 'm' },
    ],
    slots: [],
    events: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    methods: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const normalizations = emptyNormalizations();
  normalizations.defaultEquivalences.push(
    {
      memberKind: 'attribute',
      member: 'size',
      upstream: 'medium',
      target: 'm',
    },
    { memberKind: 'property', member: 'filter', upstream: null, target: '' },
  );
  normalizations.inferredAttributeSuppressions.push({
    attribute: 'get-tag',
    property: 'getTag',
  });

  const unnormalized = compareMappedSurfaces(upstream, target, {
    upstreamPrefix: 'sl-',
  });
  assert.ok(unnormalized.some(({ code, member }) => code === 'missing-attribute' && member === 'get-tag'));
  assert.equal(unnormalized.filter(({ code }) => code === 'default-mismatch').length, 2);
  assert.deepEqual(
    compareMappedSurfaces(upstream, target, {
      upstreamPrefix: 'sl-',
      normalizations,
    }),
    [],
  );

  const missingProperty = structuredClone(target);
  missingProperty.properties = missingProperty.properties.filter(({ name }) => name !== 'getTag');
  assert.deepEqual(
    compareMappedSurfaces(upstream, missingProperty, {
      upstreamPrefix: 'sl-',
      normalizations,
    }),
    [{ code: 'missing-property', section: 'properties', member: 'getTag' }],
    'suppressing analyzer-only attribute noise still requires the public target property',
  );

  const explicitAttribute = structuredClone(upstream);
  explicitAttribute.attributes.find(({ name }) => name === 'get-tag').inferred = false;
  assert.ok(
    compareMappedSurfaces(explicitAttribute, target, {
      upstreamPrefix: 'sl-',
      normalizations,
    }).some(({ code, member }) => code === 'missing-attribute' && member === 'get-tag'),
    'comparison never suppresses an explicit upstream attribute',
  );
});

test('reviewed form-owner normalizations stay explicit and modal remains a property-only controller', () => {
  for (const tag of ['sl-checkbox', 'sl-range', 'sl-switch']) {
    assert.ok(
      reviewedMappingNormalizations(tag).defaultEquivalences.some(
        (entry) => entry.memberKind === 'attribute' && entry.member === 'form' && entry.upstream === '' && entry.target === null,
      ),
      `${tag} reviews the equivalent unresolved form-owner defaults`,
    );
  }
  const shoelaceDialog = normalizeDeclaration(
    {
      customElement: true,
      tagName: 'sl-dialog',
      members: [{
        kind: 'field',
        name: 'modal',
        type: { text: 'Modal' },
        default: 'new Modal(this)',
      }],
    },
    { ecosystem: 'shoelace' },
  );
  assert.deepEqual(shoelaceDialog.attributes, []);
  assert.equal(shoelaceDialog.properties.find(({ name }) => name === 'modal')?.type, 'Modal');
  for (const tag of ['sl-dialog', 'sl-drawer']) {
    const modal = reviewedMappingNormalizations(tag).defaultEquivalences.find(
      (entry) => entry.memberKind === 'property' && entry.member === 'modal',
    );
    assert.equal(modal?.upstream, 'new Modal(this)');
    assert.match(modal?.target ?? '', /^\{ activateExternal:/);
  }
});

test('reviewed type equivalences stay exact per upstream tag and public member', () => {
  const hasTypeRule = (tag, memberKind, member, upstream, target) =>
    reviewedMappingNormalizations(tag).typeEquivalences.some(
      (entry) =>
        entry.memberKind === memberKind &&
        entry.member === member &&
        entry.upstream === upstream &&
        entry.target === target,
    );

  assert.ok(
    hasTypeRule('sl-button', 'attribute', 'form', 'string', 'HTMLFormElement | null'),
    'the CEM form-owner attribute/property projection is reviewed on the exact affected tag',
  );
  assert.ok(
    hasTypeRule('wa-page', 'attribute', 'view', "'mobile' | 'desktop'", 'PageView'),
    'a local opaque alias is recorded as its exact manifest pair',
  );
  assert.ok(
    hasTypeRule('wa-chart', 'attribute', 'type', 'ChartType', 'LyraChartType'),
    'the pinned Chart.js registry alias review is limited to the mirrored chart tags',
  );
  assert.ok(
    hasTypeRule(
      'wa-video-playlist',
      'attribute',
      'controls',
      "'none' | 'standard' | 'full'",
      'LyraVideoControls',
    ),
    'manual upstream snapshots use the same exact type-normalization contract',
  );
  for (const [tag, members] of [
    ['wa-button', ['name']],
    ['wa-checkbox', ['name', 'value']],
    ['wa-color-picker', ['name', 'value']],
    ['wa-combobox', ['name']],
    ['wa-date-input', ['name']],
    ['wa-input', ['name', 'value']],
    ['wa-known-date', ['name']],
    ['wa-number-input', ['name', 'value']],
    ['wa-otp-input', ['name', 'value']],
    ['wa-popover', ['for']],
    ['wa-radio', ['name']],
    ['wa-radio-group', ['name', 'value']],
    ['wa-rating', ['name']],
    ['wa-select', ['name']],
    ['wa-switch', ['name', 'value']],
    ['wa-textarea', ['name']],
    ['wa-time-input', ['name']],
    ['wa-tooltip', ['for']],
  ]) {
    for (const member of members) {
      assert.ok(
        hasTypeRule(tag, 'attribute', member, 'string | null', 'string'),
        `${tag}.${member} records its exact nullable-write/string-read representation`,
      );
    }
  }
  for (const [tag, memberKind, member, upstream, target] of [
    ['sl-badge', 'attribute', 'variant', "'primary' | 'success' | 'neutral' | 'warning' | 'danger'", "BadgeVariant | 'primary'"],
    ['sl-button', 'attribute', 'form-enctype', "'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'", 'ButtonFormEnctype'],
    ['sl-button', 'attribute', 'form-method', "'post' | 'get'", 'ButtonFormMethod'],
    ['sl-button', 'attribute', 'variant', "'default' | 'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text'", 'ButtonVariant'],
    ['sl-tag', 'attribute', 'variant', "'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text'", "BadgeVariant | 'primary' | 'text'"],
    ['wa-badge', 'attribute', 'variant', "'brand' | 'neutral' | 'success' | 'warning' | 'danger'", "BadgeVariant | 'primary'"],
    ['wa-button', 'attribute', 'variant', "'neutral' | 'brand' | 'success' | 'warning' | 'danger'", 'ButtonVariant'],
    ['wa-date-input', 'property', 'validators', 'Validator[]', 'LyraDateInputValidator[]'],
    ['wa-rating', 'attribute', 'size', "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", "LyraRatingSize | 'small' | 'medium' | 'large'"],
    ['wa-tag', 'attribute', 'size', "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", "BadgeSize | 'small' | 'medium' | 'large'"],
    ['wa-tag', 'attribute', 'variant', "'brand' | 'neutral' | 'success' | 'warning' | 'danger'", "BadgeVariant | 'primary' | 'text'"],
    ['wa-toast-item', 'attribute', 'size', "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", "ToastSize | 'small' | 'medium' | 'large'"],
  ]) {
    assert.ok(
      hasTypeRule(tag, memberKind, member, upstream, target),
      `${tag}.${member} records its exact public alias representation`,
    );
  }
  assert.equal(
    reviewedMappingNormalizations('wa-option').typeEquivalences.length,
    0,
    'an unrelated tag never inherits a global type alias exception',
  );
});

test('the checked-in sl-alert mapping carries the complete normalization schema', () => {
  const inventory = readJson('scripts', 'fixtures', 'component-inventory.json');
  const mapping = inventory.mappings.find(({ upstreamTag }) => upstreamTag === 'sl-alert');
  const upstream = inventory.upstreams.shoelace.components.find(({ tag }) => tag === 'sl-alert');
  const target = inventory.components.find(({ tag }) => tag === 'lr-alert');

  assert.ok(mapping);
  assert.deepEqual(
    Object.keys(mapping.normalizations).sort(),
    Object.keys(emptyNormalizations()).sort(),
    'every comparison-only normalization section is explicit in the persisted mapping',
  );
  assert.deepEqual(
    validateMappingNormalizations(mapping, {
      upstream: upstream.surface,
      target: target.surface,
    }),
    [],
  );
});

test('default insertion rewrites preserve an omitted upstream attribute without hiding stale values', () => {
  const emptySurface = {
    properties: [],
    slots: [],
    events: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    methods: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const upstream = {
    ...emptySurface,
    attributes: [{ name: 'variant', property: 'variant', hasDefault: true, default: 'brand' }],
  };
  const target = {
    ...emptySurface,
    attributes: [{ name: 'variant', property: 'variant', hasDefault: true, default: 'neutral' }],
  };
  const rewrites = emptyRewrites();
  rewrites.defaults.push({
    memberKind: 'attribute',
    member: 'variant',
    action: 'insert-if-absent',
    value: 'brand',
  });

  assert.deepEqual(compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-', rewrites }), []);
  rewrites.defaults[0].value = 'accent';
  assert.deepEqual(compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-', rewrites }), [
    {
      code: 'default-mismatch',
      section: 'attributes',
      member: 'variant',
      expected: 'brand',
      actual: 'neutral',
    },
  ]);
});

test('normalization validation rejects dangling, duplicate, stale, and explicit-attribute rules', () => {
  const upstream = {
    attributes: [
      {
        name: 'get-tag',
        property: 'getTag',
        inferred: true,
        hasDefault: false,
      },
      {
        name: 'size',
        property: 'size',
        inferred: false,
        type: "'small' | 'medium' | 'large'",
        hasDefault: true,
        default: 'medium',
      },
    ],
    properties: [
      { name: 'getTag', attribute: 'get-tag', hasDefault: false },
      {
        name: 'size',
        attribute: 'size',
        type: "'small' | 'medium' | 'large'",
        hasDefault: true,
        default: 'medium',
      },
    ],
    methods: [{ name: 'format', overloads: [{ parameters: [], returnType: 'unknown' }] }],
  };
  const target = {
    attributes: [
      {
        name: 'size',
        property: 'size',
        inferred: false,
        type: 'LyraSize',
        hasDefault: true,
        default: 'm',
      },
    ],
    properties: [
      { name: 'getTag', attribute: null, hasDefault: false },
      { name: 'size', attribute: 'size', type: 'LyraSize', hasDefault: true, default: 'm' },
    ],
    methods: [{ name: 'format', overloads: [{ parameters: [], returnType: 'string' }] }],
  };
  const mapping = {
    upstreamTag: 'sl-select',
    normalizations: {
      typeEquivalences: [
        {
          memberKind: 'attribute',
          member: 'size',
          upstream: "'small' | 'medium' | 'large'",
          target: 'LyraSize',
        },
      ],
      defaultEquivalences: [
        {
          memberKind: 'attribute',
          member: 'size',
          upstream: 'medium',
          target: 'm',
        },
      ],
      derivedDefaultEquivalences: [],
      inferredAttributeSuppressions: [{ attribute: 'get-tag', property: 'getTag' }],
      unknownMethodReturnTypes: [{ method: 'format' }],
    },
  };
  assert.deepEqual(validateMappingNormalizations(mapping, { upstream, target }), []);

  const duplicateType = structuredClone(mapping);
  duplicateType.normalizations.typeEquivalences.push(structuredClone(duplicateType.normalizations.typeEquivalences[0]));
  assert.ok(
    validateMappingNormalizations(duplicateType, { upstream, target }).some((finding) =>
      finding.includes('duplicate normalizations.typeEquivalences'),
    ),
  );

  const staleType = structuredClone(mapping);
  staleType.normalizations.typeEquivalences[0].target = 'OtherSize';
  assert.ok(
    validateMappingNormalizations(staleType, { upstream, target }).some((finding) =>
      finding.includes('stale target type normalization'),
    ),
  );

  const unreachableType = structuredClone(mapping);
  unreachableType.normalizations.typeEquivalences[0].memberKind = 'property';
  assert.ok(
    validateMappingNormalizations(unreachableType, { upstream, target }).some((finding) =>
      finding.includes('unreachable property type normalization property:size'),
    ),
    'a property rule cannot hide behind the attribute comparison that already owns that member',
  );

  const redundantType = structuredClone(mapping);
  const widenedTarget = structuredClone(target);
  widenedTarget.attributes[0].type = "'small' | 'medium' | 'large' | undefined";
  redundantType.normalizations.typeEquivalences[0].target = widenedTarget.attributes[0].type;
  assert.ok(
    validateMappingNormalizations(redundantType, { upstream, target: widenedTarget }).some((finding) =>
      finding.includes('stale compatible type normalization'),
    ),
    'a generic union widening must not retain an unnecessary reviewed exception',
  );

  const duplicate = structuredClone(mapping);
  duplicate.normalizations.defaultEquivalences.push(structuredClone(duplicate.normalizations.defaultEquivalences[0]));
  assert.ok(
    validateMappingNormalizations(duplicate, { upstream, target }).some((finding) =>
      finding.includes('duplicate normalizations.defaultEquivalences'),
    ),
  );

  const dangling = structuredClone(mapping);
  dangling.normalizations.defaultEquivalences[0].member = 'missing';
  const danglingFindings = validateMappingNormalizations(dangling, {
    upstream,
    target,
  });
  assert.ok(danglingFindings.some((finding) => finding.includes('dangling upstream normalization member')));
  assert.ok(danglingFindings.some((finding) => finding.includes('dangling target normalization member')));

  const stale = structuredClone(mapping);
  stale.normalizations.defaultEquivalences[0].upstream = 'small';
  stale.normalizations.defaultEquivalences[0].target = 'large';
  const staleFindings = validateMappingNormalizations(stale, {
    upstream,
    target,
  });
  assert.ok(staleFindings.some((finding) => finding.includes('stale upstream default normalization')));
  assert.ok(staleFindings.some((finding) => finding.includes('stale target default normalization')));

  const explicit = structuredClone(upstream);
  explicit.attributes.find(({ name }) => name === 'get-tag').inferred = false;
  assert.ok(
    validateMappingNormalizations(mapping, { upstream: explicit, target }).some((finding) =>
      finding.includes('cannot suppress explicit upstream attribute'),
    ),
  );

  const missingProperty = structuredClone(target);
  missingProperty.properties = missingProperty.properties.filter(({ name }) => name !== 'getTag');
  assert.ok(
    validateMappingNormalizations(mapping, {
      upstream,
      target: missingProperty,
    }).some((finding) => finding.includes('dangling inferred target property')),
  );

  const staleSuppression = structuredClone(target);
  staleSuppression.attributes.push({
    name: 'get-tag',
    property: 'getTag',
    inferred: false,
    hasDefault: false,
  });
  assert.ok(
    validateMappingNormalizations(mapping, {
      upstream,
      target: staleSuppression,
    }).some((finding) => finding.includes('stale inferred attribute suppression')),
  );

  const duplicateMethod = structuredClone(mapping);
  duplicateMethod.normalizations.unknownMethodReturnTypes.push({ method: 'format' });
  assert.ok(
    validateMappingNormalizations(duplicateMethod, { upstream, target }).some((finding) =>
      finding.includes('duplicate normalizations.unknownMethodReturnTypes'),
    ),
  );

  const staleMethod = structuredClone(upstream);
  staleMethod.methods[0].overloads[0].returnType = 'string';
  assert.ok(
    validateMappingNormalizations(mapping, { upstream: staleMethod, target }).some((finding) =>
      finding.includes('stale unknown-return normalization'),
    ),
  );

  const analyzerMissingReturn = structuredClone(upstream);
  analyzerMissingReturn.methods[0].overloads[0].returnType = 'unspecified-public-documentation';
  assert.deepEqual(
    validateMappingNormalizations(mapping, { upstream: analyzerMissingReturn, target }),
    [],
    'a manifest with no published return type is the already-normalized form of the same review',
  );

  const missingTargetMethod = structuredClone(target);
  missingTargetMethod.methods = [];
  assert.ok(
    validateMappingNormalizations(mapping, { upstream, target: missingTargetMethod }).some((finding) =>
      finding.includes('dangling unknown-return target method'),
    ),
  );

  const undocumentedTargetReturn = structuredClone(target);
  undocumentedTargetReturn.methods[0].overloads[0].returnType = 'unspecified-public-documentation';
  assert.ok(
    validateMappingNormalizations(mapping, { upstream, target: undocumentedTargetReturn }).some((finding) =>
      finding.includes('stale concrete target return normalization'),
    ),
    'the comparison-only exception must resolve an unknown upstream return to a concrete target API',
  );
});

test('surface comparison excludes only platform globals and the upstream hydration marker', () => {
  assert.deepEqual(MIGRATION_ATTRIBUTE_EXCLUSIONS, {
    dir: 'platform-global-passthrough',
    lang: 'platform-global-passthrough',
    role: 'platform-global-passthrough',
    tabindex: 'platform-global-passthrough',
    title: 'platform-global-passthrough',
    'did-ssr': 'upstream-hydration-marker',
  });
  const attributes = [
    { name: 'did-ssr', property: 'didSSR', hasDefault: false },
    { name: 'dir', property: 'dir', hasDefault: false },
    { name: 'lang', property: 'lang', hasDefault: false },
    { name: 'role', property: 'role', hasDefault: false },
    { name: 'tabindex', property: 'tabIndex', hasDefault: false },
    { name: 'title', property: 'title', hasDefault: false },
  ];
  const upstream = {
    attributes,
    properties: attributes.map((attribute) => ({
      name: attribute.property,
      hasDefault: false,
    })),
    slots: [],
    events: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    methods: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const target = {
    attributes: [],
    properties: [],
    slots: [],
    events: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    methods: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };

  assert.deepEqual(compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' }), []);
});

test('checked-in inventory covers every pinned tag and every Lyra declaration', () => {
  const inventory = readJson('scripts', 'fixtures', 'component-inventory.json');
  const upstreamTags = readJson('scripts', 'fixtures', 'upstream-tags.json');
  const manifest = readJson('custom-elements.json');
  const findings = validateInventory(inventory, {
    upstreamTags,
    lyraManifest: manifest,
  });

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
  for (const tag of ['sl-breadcrumb-item', 'wa-breadcrumb-item', 'sl-button', 'wa-button', 'sl-include', 'wa-include']) {
    assert.equal(
      inventory.mappings.find(({ upstreamTag }) => upstreamTag === tag)?.classification,
      'warning-required',
      `${tag} must keep its explicit security warning`,
    );
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
    rewrites: emptyRewrites(),
    drift: [],
  });
  inventory.mappings[0].targetTag = 'lr-fictional';
  inventory.mappings[0].classification = 'rewritten';
  inventory.mappings[0].rationale = 'Synthetic dangling-target regression.';
  inventory.mappings[0].rewrites.attributes = [{ from: 'with-label', to: 'no-label', guess: true }];
  inventory.mappings[0].rewrites.defaults.push({
    memberKind: 'attribute',
    member: 'placement',
    action: 'insert-if-absent',
  });
  const exactMapping = inventory.mappings.find((mapping) => mapping.classification === 'exact');
  assert.ok(exactMapping, 'fixture must contain an exact mapping');
  exactMapping.rewrites.events.push({
    from: 'sl-synthetic',
    to: 'lr-synthetic',
  });

  const componentWithDefault = inventory.components.find((component) =>
    component.surface.attributes.some((attribute) => attribute.hasDefault),
  );
  assert.ok(componentWithDefault, 'fixture must contain a defaulted attribute');
  const defaultedAttribute = componentWithDefault.surface.attributes.find((attribute) => attribute.hasDefault);
  defaultedAttribute.default = '__drifted__';

  const reviewedUpstream = inventory.upstreams.webawesome.components.find((component) => component.review.status === 'complete');
  assert.ok(reviewedUpstream, 'fixture must contain a reviewed upstream surface');
  reviewedUpstream.review = {
    status: 'tag-only',
    source: 'synthetic-test',
    unreviewedSections: ['methods'],
  };
  inventory.localMigrations[0].origin = 'lyra-v6';
  inventory.localMigrations[1].defaults.find((rule) => rule.member === 'without-arrow').value = false;
  inventory.localMigrations[2].unexpected = true;

  const findings = validateInventory(inventory, {
    upstreamTags,
    lyraManifest: manifest,
    strict: true,
  });
  assert.ok(findings.some((finding) => finding.includes('fictional upstream mapping')));
  assert.ok(findings.some((finding) => finding.includes('dangling target')));
  assert.ok(findings.some((finding) => finding.includes('inverts polarity')));
  assert.ok(findings.some((finding) => finding.includes('invalid rewrites.attributes rule')));
  assert.ok(findings.some((finding) => finding.includes('invalid rewrites.defaults rule')));
  assert.ok(findings.some((finding) => finding.includes('exact mappings cannot declare rewrite rules')));
  assert.ok(findings.some((finding) => finding.includes('normalized public surface drifted')));
  assert.ok(findings.some((finding) => finding.includes('public surface review is incomplete')));
  assert.ok(findings.some((finding) => finding.includes('unknown origin lyra-v6')));
  assert.ok(findings.some((finding) => finding.includes('false boolean insertion requires explicit converter evidence')));
  assert.ok(findings.some((finding) => finding.includes('unknown key(s) unexpected')));
});

test('local migration profiles reject duplicate, dangling, and non-insertion contracts', () => {
  const inventory = structuredClone(readJson('scripts', 'fixtures', 'component-inventory.json'));
  inventory.localMigrations.push(structuredClone(inventory.localMigrations[0]));
  inventory.localMigrations[1].tag = 'lr-missing';
  inventory.localMigrations[2].defaults[0].action = 'replace-value';
  inventory.localMigrations[2].defaults[1].memberKind = 'property';
  const findings = validateLocalMigrations(inventory);
  assert.ok(findings.some((finding) => finding.includes('duplicate local migration')));
  assert.ok(findings.some((finding) => finding.includes('target tag is not registered')));
  assert.ok(findings.some((finding) => finding.includes('only insert-if-absent')));
  assert.ok(findings.some((finding) => finding.includes('only attribute members')));
});

test('release completeness mode exposes staged reviews and unsupported mappings after maturity review', () => {
  const inventory = structuredClone(readJson('scripts', 'fixtures', 'component-inventory.json'));
  const upstreamTags = readJson('scripts', 'fixtures', 'upstream-tags.json');
  const manifest = readJson('custom-elements.json');
  const stagedReview = inventory.upstreams.webawesome.components.find(
    (component) => component.review.status === 'complete',
  );
  assert.ok(stagedReview, 'fixture must contain a complete upstream review to stage synthetically');
  stagedReview.review = {
    status: 'tag-only',
    source: 'synthetic-test',
    unreviewedSections: ['methods'],
  };
  const blockedMapping = inventory.mappings.find((mapping) => mapping.upstreamTag === stagedReview.tag);
  assert.ok(blockedMapping, 'the synthetically staged review must have a mapping');
  blockedMapping.classification = 'unsupported';
  blockedMapping.rationale = 'Synthetic release-blocker regression.';
  const findings = validateInventory(inventory, {
    upstreamTags,
    lyraManifest: manifest,
    strict: true,
  });

  assert.ok(!findings.some((finding) => finding.includes('maturity remains unclassified')));
  assert.ok(inventory.components.every((component) => /^(stable|experimental)$/.test(component.maturity.status)));
  assert.ok(findings.some((finding) => finding.includes('public surface review is incomplete')));
  assert.ok(findings.some((finding) => finding.includes('unsupported release blocker remains')));
});

test('pinned-manifest drift validation compares normalized public data, not raw analyzer output', () => {
  const declaration = {
    tagName: 'wa-example',
    customElement: true,
    members: [
      {
        kind: 'field',
        name: 'value',
        attribute: 'value',
        default: "'one'",
        type: { text: 'string' },
      },
      { kind: 'method', name: 'render' },
    ],
    attributes: [
      {
        name: 'value',
        fieldName: 'value',
        default: "'one'",
        type: { text: 'string' },
      },
    ],
  };
  const normalized = normalizeDeclaration(declaration, {
    ecosystem: 'webawesome',
  });
  const surface = Object.fromEntries(
    ['attributes', 'properties', 'slots', 'events', 'parts', 'cssProperties', 'cssStates', 'methods', 'form', 'native'].map((section) => [
      section,
      normalized[section],
    ]),
  );
  const inventory = {
    upstreams: {
      webawesome: {
        components: [
          {
            tag: 'wa-example',
            maturity: normalized.maturity,
            surface,
            review: {
              status: 'complete',
              source: 'published-manifest',
              unreviewedSections: [],
            },
          },
        ],
      },
      shoelace: { components: [] },
    },
  };
  const webawesomeManifest = {
    modules: [{ path: 'example.js', declarations: [declaration] }],
  };
  const shoelaceManifest = { modules: [] };

  assert.deepEqual(
    validatePinnedManifests(inventory, {
      webawesomeManifest,
      shoelaceManifest,
    }),
    [],
  );
  inventory.upstreams.webawesome.components[0].surface.attributes[0].default = 'two';
  assert.deepEqual(
    validatePinnedManifests(inventory, {
      webawesomeManifest,
      shoelaceManifest,
    }),
    ['wa-example: pinned public surface drifted'],
  );
});
