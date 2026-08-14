import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  MIGRATION_ATTRIBUTE_EXCLUSIONS,
  compareAccessibilityProfiles,
  compareMappedSurfaces,
  emptyNormalizations,
  emptyRewrites,
  normalizeDeclaration,
  normalizeManifest,
  validateAccessibilityContract,
  validateInventory,
  validateLocalMigrations,
  validateMappingNormalizations,
  validatePinnedManifests,
} from './component-inventory.mjs';
import {
  assertAccessibilityProfilesReferenced,
  accessibilityProfileCatalog,
  migrationParityMetadata,
  optionalPeersForComponent,
  reviewedAccessibilityMetadata,
  reviewedMigrationDecision,
  reviewedMappingNormalizations,
  reviewedWebAwesomeVideo,
  reviewedWebAwesomeVideoPlaylist,
  rootRegistrationMetadata,
  expandLyraInventoryManifest,
} from './generate-component-inventory.mjs';
import cemConfig, {
  ACCESSOR_RUNTIME_CONTRACTS,
  DOCUMENT_ANCHOR_TARGET_CONTRACT,
  DOCUMENT_ANCHOR_TARGET_TAGS,
  EVENT_RUNTIME_CONTRACTS,
  INHERITED_PUBLIC_MEMBER_CONTRACTS,
  INTERNAL_ATTRIBUTE_CONTRACTS,
} from '../custom-elements-manifest.config.js';
import { htmlDataValues, readTypeAliases, webTypesValue } from './editor-type-values.mjs';
import { cssPropertyDescription } from './editor-css-descriptions.mjs';
import { generateManifest } from './generate-manifest.mjs';
import { expandManifestInheritance } from './manifest-compact.mjs';
import { sourceEventTypeContracts } from './check-event-contracts.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (...segments) => JSON.parse(fs.readFileSync(path.join(packageDir, ...segments), 'utf8'));

test('accessibility profiles compare every structured behavior dimension', () => {
  const profiles = {
    source: {
      description: 'Synthetic source profile.',
      semantics: ['button'],
      naming: ['content-or-author-label'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['disabled'],
      announcements: [],
      motion: [],
    },
    equivalent: {
      description: 'Synthetic equivalent profile.',
      semantics: ['button'],
      naming: ['content-or-author-label'],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['disabled'],
      announcements: [],
      motion: [],
    },
    additive: {
      description: 'Synthetic additive profile.',
      semantics: ['button'],
      naming: ['content-or-author-label'],
      keyboard: ['native-activation'],
      focus: ['focus-return', 'native-focus'],
      states: ['disabled'],
      announcements: [],
      motion: [],
    },
    missing: {
      description: 'Synthetic incomplete profile.',
      semantics: ['button'],
      naming: [],
      keyboard: ['native-activation'],
      focus: ['native-focus'],
      states: ['disabled'],
      announcements: [],
      motion: [],
    },
    inert: {
      description: 'Synthetic profile with no tag-owned behavior.',
      semantics: [],
      naming: [],
      keyboard: [],
      focus: [],
      states: [],
      announcements: [],
      motion: [],
    },
  };

  assert.deepEqual(compareAccessibilityProfiles(profiles, 'source', 'equivalent'), {
    status: 'equivalent',
    missing: [],
    additions: [],
  });
  assert.deepEqual(compareAccessibilityProfiles(profiles, 'source', 'additive'), {
    status: 'target-additive',
    missing: [],
    additions: ['focus:focus-return'],
  });
  assert.deepEqual(compareAccessibilityProfiles(profiles, 'source', 'missing'), {
    status: 'warning-required',
    missing: ['naming:content-or-author-label'],
    additions: [],
  });
  assert.deepEqual(compareAccessibilityProfiles(profiles, 'inert', 'inert'), {
    status: 'not-applicable',
    missing: [],
    additions: [],
  });
  assert.throws(
    () => compareAccessibilityProfiles(profiles, 'source', 'absent'),
    /unknown target accessibility profile absent/,
  );
});

test('spinner accessibility review records non-live indeterminate progress semantics', () => {
  const profiles = accessibilityProfileCatalog();

  assert.equal(
    profiles['busy-status'],
    undefined,
    'the superseded live-status spinner profile is not retained as dead review metadata',
  );

  assert.deepEqual(profiles['indeterminate-progress'], {
    description: 'An indeterminate operation is exposed as progress without creating a live status announcement.',
    semantics: ['progressbar'],
    naming: [],
    keyboard: [],
    focus: [],
    states: ['busy'],
    announcements: [],
    motion: [],
  });
  assert.deepEqual(profiles['localized-indeterminate-progress'], {
    description: 'A non-live indeterminate progressbar has a localized or authored name and suppresses ambient motion.',
    semantics: ['progressbar'],
    naming: ['content-or-author-label', 'control-labels-localized'],
    keyboard: [],
    focus: [],
    states: ['busy'],
    announcements: [],
    motion: ['respects-reduced-motion', 'suppresses-animation'],
  });

  for (const upstreamTag of ['sl-spinner', 'wa-spinner']) {
    const metadata = reviewedAccessibilityMetadata(upstreamTag, 'lr-spinner');
    assert.equal(metadata.upstreamProfile, 'indeterminate-progress');
    assert.equal(metadata.targetProfile, 'localized-indeterminate-progress');
    assert.deepEqual(metadata.comparison, {
      status: 'target-additive',
      missing: [],
      additions: [
        'motion:respects-reduced-motion',
        'motion:suppresses-animation',
        'naming:content-or-author-label',
        'naming:control-labels-localized',
      ],
    });
  }

  const metadata = reviewedAccessibilityMetadata('wa-spinner', 'lr-spinner');
  profiles['localized-indeterminate-progress'].semantics = ['status'];
  const findings = validateAccessibilityContract(profiles, [{
    upstreamTag: 'wa-spinner',
    classification: 'exact',
    parity: { accessibility: metadata },
  }]);
  assert.ok(findings.some((finding) => finding.includes('stored accessibility comparison is stale')));
  assert.ok(findings.some((finding) => finding.includes('automatic mapping has missing accessibility behavior')));
});

test('accessibility profile assignments fail closed on unreferenced review profiles', () => {
  const profiles = {
    source: { description: 'Source profile.' },
    target: { description: 'Target profile.' },
  };
  const assignments = new Map([
    ['wa-example', { upstreamProfile: 'source', targetProfile: 'target' }],
  ]);

  assert.doesNotThrow(() => assertAccessibilityProfilesReferenced(profiles, assignments));
  assert.throws(
    () => assertAccessibilityProfilesReferenced(
      { ...profiles, stale: { description: 'No assignment reaches this profile.' } },
      assignments,
    ),
    /unreferenced accessibility profile stale/u,
  );
});

test('callout accessibility review records optional grouping and post-mount announcements as additions', () => {
  const profiles = accessibilityProfileCatalog();

  assert.deepEqual(profiles.callout, {
    description: 'A callout preserves the semantics and reading order of its authored content.',
    semantics: ['transparent-content'],
    naming: [],
    keyboard: [],
    focus: [],
    states: [],
    announcements: [],
    motion: [],
  });
  assert.deepEqual(profiles['reactive-callout'], {
    description: 'Callout content remains readable, gains an optional authored group name, and announces only post-mount content changes.',
    semantics: ['group', 'transparent-content'],
    naming: ['content-or-author-label'],
    keyboard: [],
    focus: [],
    states: [],
    announcements: ['content-change', 'live-alert', 'live-status'],
    motion: [],
  });

  const metadata = reviewedAccessibilityMetadata('wa-callout', 'lr-callout');
  assert.equal(metadata.upstreamProfile, 'callout');
  assert.equal(metadata.targetProfile, 'reactive-callout');
  assert.deepEqual(metadata.comparison, {
    status: 'target-additive',
    missing: [],
    additions: [
      'announcements:content-change',
      'announcements:live-alert',
      'announcements:live-status',
      'naming:content-or-author-label',
      'semantics:group',
    ],
  });

  profiles['reactive-callout'].announcements = [];
  const findings = validateAccessibilityContract(profiles, [{
    upstreamTag: 'wa-callout',
    classification: 'exact',
    parity: { accessibility: metadata },
  }]);
  assert.ok(findings.some((finding) => finding.includes('stored accessibility comparison is stale')));
});

test('checked-in accessibility profiles cover all 145 upstream mappings', () => {
  const inventory = readJson('scripts', 'fixtures', 'component-inventory.json');
  assert.equal(inventory.mappings.length, 145);
  assert.deepEqual(inventory.accessibilityProfiles, accessibilityProfileCatalog());
  assert.deepEqual(
    validateAccessibilityContract(inventory.accessibilityProfiles, inventory.mappings),
    [],
  );
  assert.equal(
    inventory.mappings.filter((mapping) => mapping.parity.accessibility.reviewStatus === 'complete').length,
    145,
  );
});

test('compact Lyra manifests expand inherited public surfaces before inventory normalization', () => {
  const compact = {
    modules: [
      {
        path: 'src/base.ts',
        declarations: [{
          kind: 'class',
          name: 'Base',
          members: [{ kind: 'field', name: 'locale', type: { text: 'string' } }],
          attributes: [{ name: 'locale', type: { text: 'string' } }],
        }],
      },
      {
        path: 'src/child.ts',
        declarations: [{
          kind: 'class',
          name: 'Child',
          tagName: 'lr-child',
          customElement: true,
          superclass: { name: 'Base', module: '/src/base.js' },
          members: [{ kind: 'field', name: 'value', type: { text: 'string' } }],
          attributes: [{ name: 'value', type: { text: 'string' } }],
        }],
      },
    ],
  };
  const expanded = expandLyraInventoryManifest(compact);
  const child = expanded.modules[1].declarations[0];
  assert.deepEqual(child.members.map(({ name }) => name), ['locale', 'value']);
  assert.deepEqual(child.attributes.map(({ name }) => name), ['locale', 'value']);
});

test('form association comes only from static/mixin truth and follows superclass inheritance', () => {
  const manifest = {
    modules: [
      {
        path: 'src/synthetic.ts',
        declarations: [
          {
            kind: 'class',
            name: 'StaticFace',
            tagName: 'lr-static-face',
            customElement: true,
            members: [{ kind: 'field', name: 'formAssociated', static: true, default: 'true' }],
          },
          {
            kind: 'class',
            name: 'InheritedFace',
            tagName: 'lr-inherited-face',
            customElement: true,
            superclass: { name: 'StaticFace', module: '/src/synthetic.js' },
          },
          {
            kind: 'class',
            name: 'MixinFace',
            tagName: 'lr-mixin-face',
            customElement: true,
            mixins: [{ name: 'FormAssociated', module: '/src/internal/form-associated.js' }],
          },
          {
            kind: 'class',
            name: 'DisabledMixinFace',
            tagName: 'lr-disabled-mixin-face',
            customElement: true,
            mixins: [{ name: 'FormAssociated', module: '/src/internal/form-associated.js' }],
            members: [
              {
                kind: 'field',
                name: 'formAssociated',
                static: true,
                default: 'false',
              },
            ],
          },
          {
            kind: 'class',
            name: 'MemberNamesOnly',
            tagName: 'lr-member-names-only',
            customElement: true,
            members: [
              { kind: 'field', name: 'form', type: { text: 'HTMLFormElement | null' } },
              { kind: 'field', name: 'value', type: { text: 'string' } },
              { kind: 'method', name: 'setCustomValidity' },
            ],
          },
        ],
      },
    ],
  };

  const byTag = new Map(
    normalizeManifest(manifest, { ecosystem: 'lyra' }).map((component) => [component.tag, component]),
  );
  assert.equal(byTag.get('lr-static-face').surface.form.associated, true);
  assert.equal(byTag.get('lr-inherited-face').surface.form.associated, true);
  assert.equal(byTag.get('lr-mixin-face').surface.form.associated, true);
  assert.equal(
    byTag.get('lr-disabled-mixin-face').surface.form.associated,
    false,
    'an own static false overrides inherited or mixin form association',
  );
  assert.equal(
    byTag.get('lr-member-names-only').surface.form.associated,
    false,
    'native-looking public member names do not make a custom element form-associated',
  );
});

test('the live manifest resolves to the exact 34 runtime FACE tags', () => {
  const associated = normalizeManifest(readJson('custom-elements.json'), { ecosystem: 'lyra' })
    .filter((component) => component.surface.form.associated)
    .map((component) => component.tag);
  assert.deepEqual(associated, [
    'lr-button',
    'lr-chat-composer',
    'lr-checkbox',
    'lr-checkbox-group',
    'lr-code-editor',
    'lr-color-picker',
    'lr-combobox',
    'lr-date-input',
    'lr-emoji-picker',
    'lr-file-input',
    'lr-graph-query-builder',
    'lr-icon-button',
    'lr-input',
    'lr-known-date',
    'lr-locale-picker',
    'lr-model-select',
    'lr-native-time-input',
    'lr-number-input',
    'lr-otp-input',
    'lr-phone-input',
    'lr-radio',
    'lr-radio-button',
    'lr-radio-group',
    'lr-rating',
    'lr-rubric-form',
    'lr-select',
    'lr-slider',
    'lr-switch',
    'lr-textarea',
    'lr-time-input',
    'lr-time-range',
    'lr-token-input',
    'lr-tool-param-form',
    'lr-voice-picker',
  ]);
});

test('the generated lean code-block CEM preserves the full code-block CSS custom-property surface', async () => {
  const manifest = expandManifestInheritance((await generateManifest({ write: false })).manifest);
  const cssPropertiesByTag = new Map(
    normalizeManifest(manifest, { ecosystem: 'lyra' })
      .filter(({ tag }) => tag === 'lr-code-block' || tag === 'lr-code-block-core')
      .map(({ tag, surface }) => [tag, surface.cssProperties]),
  );

  assert.ok(
    cssPropertiesByTag.has('lr-code-block'),
    'the full code-block is present in the generated CEM',
  );
  assert.ok(
    cssPropertiesByTag.has('lr-code-block-core'),
    'the lean code-block is present in the generated CEM',
  );
  assert.deepEqual(
    cssPropertiesByTag.get('lr-code-block-core'),
    cssPropertiesByTag.get('lr-code-block'),
    'the lean variant shares the full stylesheet, so its normalized CEM CSS custom-property surface must match',
  );
});

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

test('the CEM suppresses reviewed private transport attributes from the public surface', async () => {
  const plugin = cemConfig.plugins.find(({ name }) => name === 'lr-internal-implementation-attributes');
  assert.ok(plugin?.packageLinkPhase, 'the internal-attribute projection plugin is installed');
  assert.deepEqual(
    [...INTERNAL_ATTRIBUTE_CONTRACTS],
    [['lr-split', { 'data-lr-panel-count': { fieldName: 'panelCount' } }]],
  );

  const synthetic = {
    modules: [{
      path: 'split.class.ts',
      declarations: [{
        kind: 'class',
        name: 'LyraSplit',
        tagName: 'lr-split',
        members: [
          {
            kind: 'field',
            name: 'panelCount',
            privacy: 'private',
            attribute: 'data-lr-panel-count',
          },
          { kind: 'field', name: 'orientation', attribute: 'orientation' },
        ],
        attributes: [
          { name: 'data-lr-panel-count', fieldName: 'panelCount' },
          { name: 'orientation', fieldName: 'orientation' },
        ],
      }],
    }],
  };

  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  const split = synthetic.modules[0].declarations[0];
  assert.deepEqual(
    split.attributes,
    [{ name: 'orientation', fieldName: 'orientation' }],
    'the private hydration seed is omitted while real public attributes remain',
  );

  const once = structuredClone(synthetic);
  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  assert.deepEqual(synthetic, once, 'running the internal-attribute projection twice is a no-op');

  const malformed = structuredClone(synthetic);
  malformed.modules[0].declarations[0].members.find(({ name }) => name === 'panelCount').privacy = 'public';
  assert.throws(
    () => plugin.packageLinkPhase({ customElementsManifest: malformed }),
    /lr-split\[data-lr-panel-count\]: internal-attribute projection requires private field panelCount/,
    'a private transport becoming public requires an explicit contract decision',
  );

  const liveManifest = (await generateManifest({ write: false })).manifest;
  const liveSplit = liveManifest.modules
    .flatMap((module) => module.declarations ?? [])
    .find(({ tagName }) => tagName === 'lr-split');
  assert.ok(liveSplit, 'the live split declaration exists');
  assert.equal(
    liveSplit.attributes?.some(({ name }) => name === 'data-lr-panel-count') ?? false,
    false,
    'the private hydration seed does not enter the generated public CEM',
  );
});

test('the CEM default-value projection keeps the attribute public without publishing its reactive adapter', async () => {
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

  const liveManifest = expandManifestInheritance((await generateManifest({ write: false })).manifest);
  for (const tagName of ['lr-input', 'lr-native-time-input', 'lr-number-input', 'lr-textarea']) {
    const declaration = liveManifest.modules
      .flatMap((module) => module.declarations ?? [])
      .find((candidate) => candidate.tagName === tagName);
    const member = declaration.members.find((candidate) => candidate.name === 'defaultValueAlias');
    const attribute = declaration.attributes.find((candidate) => candidate.name === 'default-value');
    assert.equal(member, undefined, `${tagName} compact public manifest omits the private adapter`);
    assert.equal(attribute?.fieldName, 'defaultValue', `${tagName} live attribute`);
  }
});

test('the CEM chart projection reports each runtime-locked subclass literal type contract', async () => {
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
    members: [{
      kind: 'field',
      name: 'type',
      type: { text: 'LyraChartType' },
      default: "'bar'",
      inheritedFrom: { name: 'LyraChart' },
    }],
    attributes: [{ name: 'type', fieldName: 'type', type: { text: 'LyraChartType' }, default: "'bar'" }],
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
  const aliases = readTypeAliases(path.join(packageDir, 'src'));
  for (const [tagName, type] of lockedTypes) {
    const projected = synthetic.modules[0].declarations.find((candidate) => candidate.tagName === tagName);
    const member = projected.members.find(({ name }) => name === 'type');
    const attribute = projected.attributes.find(({ name }) => name === 'type');
    assert.equal(member.default, `'${type}'`, `${tagName} member default`);
    assert.equal(member.type.text, `'${type}'`, `${tagName} member type`);
    assert.equal(attribute.default, `'${type}'`, `${tagName} attribute default`);
    assert.equal(attribute.type.text, `'${type}'`, `${tagName} attribute type`);
    assert.deepEqual(htmlDataValues(attribute.type.text, aliases), [{ name: type }], `${tagName} HTML editor value`);
    assert.deepEqual(webTypesValue(attribute.type.text, aliases), { type: [`'${type}'`] }, `${tagName} web-types value`);
  }
  for (const tagName of ['lr-chart', 'lr-lite-chart']) {
    const untouched = synthetic.modules[0].declarations.find((candidate) => candidate.tagName === tagName);
    assert.equal(untouched.members.find(({ name }) => name === 'type').default, "'bar'");
    assert.equal(untouched.members.find(({ name }) => name === 'type').type.text, 'LyraChartType');
    assert.equal(untouched.attributes.find(({ name }) => name === 'type').default, "'bar'");
    assert.equal(untouched.attributes.find(({ name }) => name === 'type').type.text, 'LyraChartType');
  }

  const once = structuredClone(synthetic);
  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  assert.deepEqual(synthetic, once, 'running the projection twice is a no-op');

  const liveManifest = (await generateManifest({ write: false })).manifest;
  for (const [tagName, type] of lockedTypes) {
    const projected = liveManifest.modules
      .flatMap((module) => module.declarations ?? [])
      .find((candidate) => candidate.tagName === tagName);
    const member = projected.members.find(({ name }) => name === 'type');
    const attribute = projected.attributes.find(({ name }) => name === 'type');
    assert.equal(member.default, `'${type}'`, `${tagName} live member default`);
    assert.equal(member.type.text, `'${type}'`, `${tagName} live member type`);
    assert.equal(attribute.default, `'${type}'`, `${tagName} live attribute default`);
    assert.equal(attribute.type.text, `'${type}'`, `${tagName} live attribute type`);
  }
});

test('chart optional-peer attribution follows only reachable loader capabilities', () => {
  const packageJson = readJson('package.json');
  const peersFor = (registrationModule) => optionalPeersForComponent({ registrationModule }, packageJson);

  assert.deepEqual(
    peersFor('src/components/charts/chart/box-plot.ts'),
    ['@sgratzl/chartjs-chart-boxplot', 'chart.js'],
    'box plots load Chart.js core and their box-plot controller, not unrelated chart features',
  );
  assert.deepEqual(
    peersFor('src/components/charts/chart/chart.ts'),
    ['chart.js', 'chartjs-plugin-datalabels', 'chartjs-plugin-zoom'],
    'the configurable Chart.js wrapper retains its reachable feature peers',
  );
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
  assert.equal(member('lr-file-input', 'dragging').readonly, false);
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

test('the live CEM records the pinned Shoelace caret reflection contract', () => {
  const declaration = readJson('custom-elements.json').modules
    .flatMap((module) => module.declarations ?? [])
    .find(({ tagName }) => tagName === 'lr-button');
  const caret = declaration.members.find(({ name }) => name === 'caret');
  const attribute = declaration.attributes.find(({ name }) => name === 'caret');

  assert.equal(caret.reflects, true);
  assert.equal(attribute.fieldName, 'caret');
});

test('the CEM inherited-member projection repairs only reviewed runtime inheritance gaps', () => {
  const plugin = cemConfig.plugins.find(({ name }) => name === 'lr-inherited-public-member-contracts');
  assert.ok(plugin?.packageLinkPhase, 'the inherited public-member projection plugin is installed');
  assert.deepEqual(
    [...INHERITED_PUBLIC_MEMBER_CONTRACTS],
    [
      ['lr-drawer', { sourceTag: 'lr-dialog', members: ['modal'] }],
      [
        'lr-tag',
        {
          sourceTag: 'lr-badge',
          members: ['size', 'variant'],
          memberTypes: { variant: 'TagVariant' },
        },
      ],
    ],
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
        path: 'badge.class.ts',
        declarations: [{
          kind: 'class',
          name: 'LyraBadge',
          tagName: 'lr-badge',
          members: [
            { kind: 'field', name: 'size', type: { text: 'BadgeSize' }, attribute: 'size' },
            { kind: 'field', name: 'variant', type: { text: 'BadgeVariant' }, attribute: 'variant' },
          ],
          attributes: [
            { name: 'size', fieldName: 'size', type: { text: 'BadgeSize' } },
            { name: 'variant', fieldName: 'variant', type: { text: 'BadgeVariant' } },
          ],
        }],
      },
      {
        path: 'tag.class.ts',
        declarations: [{ kind: 'class', name: 'LyraTag', tagName: 'lr-tag', members: [], attributes: [] }],
      },
      {
        path: 'unrelated.ts',
        declarations: [{ kind: 'class', name: 'Unrelated', tagName: 'lr-unrelated', members: [] }],
      },
    ],
  };

  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  const drawer = synthetic.modules.find(({ path }) => path === 'drawer.class.ts').declarations[0];
  assert.deepEqual(drawer.members[0], {
    kind: 'field',
    name: 'modal',
    readonly: true,
    type: { text: 'LyraDialogModalController' },
    inheritedFrom: { name: 'LyraDialog', module: 'dialog.class.ts' },
  });
  const tag = synthetic.modules.find(({ path }) => path === 'tag.class.ts').declarations[0];
  assert.equal(tag.members.find(({ name }) => name === 'size').type.text, 'BadgeSize');
  assert.equal(tag.members.find(({ name }) => name === 'variant').type.text, 'TagVariant');
  assert.equal(tag.attributes.find(({ name }) => name === 'size').type.text, 'BadgeSize');
  assert.equal(tag.attributes.find(({ name }) => name === 'variant').type.text, 'TagVariant');
  assert.deepEqual(
    synthetic.modules.find(({ path }) => path === 'unrelated.ts').declarations[0].members,
    [],
  );

  const once = structuredClone(synthetic);
  plugin.packageLinkPhase({ customElementsManifest: synthetic });
  assert.deepEqual(synthetic, once, 'running the inherited-member projection twice is a no-op');

  const malformed = structuredClone(synthetic);
  malformed.modules.find(({ path }) => path === 'dialog.class.ts').declarations[0].members = [];
  malformed.modules.find(({ path }) => path === 'drawer.class.ts').declarations[0].members = [];
  assert.throws(
    () => plugin.packageLinkPhase({ customElementsManifest: malformed }),
    /lr-drawer: inherited-member projection requires lr-dialog\.modal/,
  );
});

test('the CEM event projection preserves every concrete source EventMap schema', async () => {
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

  const missingDeclaration = structuredClone(synthetic);
  missingDeclaration.modules[0].declarations = missingDeclaration.modules[0].declarations.filter(
    ({ tagName }) => tagName !== 'lr-input',
  );
  assert.throws(
    () => plugin.packageLinkPhase({ customElementsManifest: missingDeclaration }),
    /lr-input: event projection requires component declaration/,
    'a component rename or removal cannot silently leave stale projected metadata behind',
  );

  const liveManifest = expandManifestInheritance((await generateManifest({ write: false })).manifest);
  const sourceContracts = sourceEventTypeContracts(liveManifest, packageDir);
  const declarations = new Map(
    liveManifest.modules.flatMap((module) => module.declarations ?? [])
      .filter(({ tagName }) => tagName)
      .map((declaration) => [declaration.tagName, declaration]),
  );
  for (const [tagName, contract] of sourceContracts) {
    const declaration = declarations.get(tagName);
    for (const [name, type] of Object.entries(contract)) {
      assert.equal(
        declaration?.events?.find((event) => event.name === name)?.type?.text,
        type,
        `${tagName}#${name} live EventMap projection`,
      );
    }
  }

  const inventory = readJson('scripts', 'fixtures', 'component-inventory.json');
  const upstreamComponents = new Map(
    Object.values(inventory.upstreams)
      .flatMap(({ components }) => components)
      .map((component) => [component.tag, component]),
  );
  const liveTargets = new Map(
    normalizeManifest(liveManifest, { ecosystem: 'lyra' })
      .map((component) => [component.tag, component]),
  );
  const eventDrift = [];
  const reviewedEventDrift = [];
  for (const mapping of inventory.mappings) {
    const upstream = upstreamComponents.get(mapping.upstreamTag);
    const target = liveTargets.get(mapping.targetTag);
    assert.ok(upstream, `${mapping.upstreamTag} must have a pinned public surface`);
    assert.ok(target, `${mapping.upstreamTag} must resolve ${mapping.targetTag} in the live manifest`);
    const findings = compareMappedSurfaces(upstream.surface, target.surface, {
      upstreamPrefix: mapping.upstream === 'webawesome' ? 'wa-' : 'sl-',
      rewrites: mapping.rewrites,
      normalizations: reviewedMappingNormalizations(mapping.upstreamTag),
    }).filter(({ section }) => section === 'events');
    eventDrift.push(...findings.map((finding) => ({ upstreamTag: mapping.upstreamTag, ...finding })));
    reviewedEventDrift.push(
      ...(reviewedMigrationDecision(mapping.upstreamTag)?.expectedDrift ?? [])
        .filter(({ section }) => section === 'events')
        .map((finding) => ({ upstreamTag: mapping.upstreamTag, ...finding })),
    );
  }
  assert.deepEqual(
    eventDrift,
    reviewedEventDrift,
    'every live event schema must match its reviewed upstream mapping or exact warning-required drift',
  );
});

test('source EventMaps provide concrete event schemas for CEM and inventory projection', () => {
  const contracts = sourceEventTypeContracts(readJson('custom-elements.json'), packageDir);
  assert.equal(
    contracts.get('lr-accordion')?.['lr-collapse'],
    'CustomEvent<LyraAccordionEventDetail>',
  );
  assert.equal(
    contracts.get('lr-menu')?.['lr-menu-select'],
    'CustomEvent<MenuSelectDetail>',
  );
  for (const [tagName, contract] of contracts) {
    for (const [event, type] of Object.entries(contract)) {
      assert.doesNotMatch(type, /\bany\b/u, `${tagName}#${event}`);
      assert.doesNotMatch(type, /^(?:unknown|CustomEvent\s*<\s*unknown\s*>)$/u, `${tagName}#${event}`);
    }
  }
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
    'unspecified-public-documentation',
    'the rendered public table does not invent an undocumented getState return type',
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

test('the manual wa-video-playlist review is complete and comparison-driven', async () => {
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

  const liveManifest = expandLyraInventoryManifest((await generateManifest({ write: false })).manifest);
  const target = normalizeManifest(liveManifest, { ecosystem: 'lyra' })
    .find((component) => component.tag === 'lr-video-playlist').surface;
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

test('the reviewed QR base-part replacement closes the live generic-prose ambiguity exactly', async () => {
  const inventory = readJson('scripts', 'fixtures', 'component-inventory.json');
  const mapping = inventory.mappings.find(({ upstreamTag }) => upstreamTag === 'wa-qr-code');
  const upstream = inventory.upstreams.webawesome.components
    .find(({ tag }) => tag === 'wa-qr-code');
  assert.ok(mapping, 'wa-qr-code must have a pinned mapping');
  assert.ok(upstream, 'wa-qr-code must have a pinned public surface');

  const normalizations = reviewedMappingNormalizations('wa-qr-code');
  assert.deepEqual(normalizations.deprecationEquivalences, [{
    section: 'parts',
    member: 'base',
    upstreamDeprecated: true,
    upstreamReplacement: null,
    targetDeprecated: true,
    targetReplacement: 'qr-code',
  }]);

  const liveManifest = expandLyraInventoryManifest((await generateManifest({ write: false })).manifest);
  const target = normalizeManifest(liveManifest, { ecosystem: 'lyra' })
    .find(({ tag }) => tag === mapping.targetTag);
  assert.ok(target, `${mapping.targetTag} must exist in the live manifest`);
  assert.deepEqual(
    compareMappedSurfaces(upstream.surface, target.surface, {
      upstreamPrefix: 'wa-',
      rewrites: mapping.rewrites,
      normalizations,
    }).filter(({ section, member }) => section === 'parts' && member === 'base'),
    [],
  );
  assert.deepEqual(
    validateMappingNormalizations(
      { ...mapping, normalizations },
      { upstream: upstream.surface, target: target.surface },
    ).filter((finding) => finding.includes('deprecation normalization parts:base')),
    [],
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

test('reviewed cancelability normalizations neutralize widening only, never a lost veto', () => {
  const surface = {
    attributes: [],
    properties: [],
    slots: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    methods: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const compare = (upstreamCancelable, targetCancelable, normalizations) =>
    compareMappedSurfaces(
      { ...surface, events: [{ name: 'wa-invalid', type: 'Event', cancelable: upstreamCancelable }] },
      { ...surface, events: [{ name: 'lr-invalid', type: 'Event', cancelable: targetCancelable }] },
      { upstreamPrefix: 'wa-', ...(normalizations ? { normalizations } : {}) },
    ).filter((entry) => entry.code === 'cancelability-mismatch');

  const widening = emptyNormalizations();
  widening.cancelabilityEquivalences.push({ event: 'wa-invalid', upstream: 'never', target: 'always' });

  assert.deepEqual(
    compare('never', 'always', widening),
    [],
    'making a never-cancelable event cancelable is a superset no shipped consumer can depend against',
  );
  assert.deepEqual(
    compare('never', 'always').map(({ code, member }) => ({ code, member })),
    [{ code: 'cancelability-mismatch', member: 'wa-invalid' }],
    'the widening exception is never inferred without an explicit per-event reviewed rule',
  );
  assert.deepEqual(
    compare('never', 'conditional', widening).map(({ expected, actual }) => ({ expected, actual })),
    [{ expected: 'never', actual: 'conditional' }],
    'a reviewed rule pins both labels, so it stops applying the moment either side moves',
  );

  const narrowing = emptyNormalizations();
  narrowing.cancelabilityEquivalences.push({ event: 'wa-invalid', upstream: 'always', target: 'never' });
  narrowing.cancelabilityPathAdditions.push({
    event: 'wa-invalid',
    upstream: 'always',
    target: 'never',
    addedPath: 'a veto that silently stopped vetoing',
  });
  assert.deepEqual(
    compare('always', 'never', narrowing).map(({ expected, actual }) => ({ expected, actual })),
    [{ expected: 'always', actual: 'never' }],
    'losing cancelability stays a mismatch no matter which section a rule is written into',
  );
  assert.deepEqual(
    compare('conditional', 'never', narrowing).map(({ expected, actual }) => ({ expected, actual })),
    [{ expected: 'conditional', actual: 'never' }],
  );

  const pathAddition = emptyNormalizations();
  pathAddition.cancelabilityPathAdditions.push({
    event: 'wa-invalid',
    upstream: 'always',
    target: 'conditional',
    addedPath: 'a Lyra-only emission on disconnect that no veto could undo',
  });
  assert.deepEqual(
    compare('always', 'conditional', pathAddition),
    [],
    'a reviewed Lyra-only non-cancelable path keeps every upstream-documented veto working',
  );
  assert.deepEqual(
    compare('always', 'conditional', widening).map(({ expected, actual }) => ({ expected, actual })),
    [{ expected: 'always', actual: 'conditional' }],
    'the widening section cannot be used to wave through a narrowing',
  );
  assert.deepEqual(
    compare('always', 'never', pathAddition).map(({ expected, actual }) => ({ expected, actual })),
    [{ expected: 'always', actual: 'never' }],
  );
});

test('cancelability normalization validation rejects narrowing, unnamed paths, and stale labels', () => {
  const surface = { attributes: [], properties: [], methods: [] };
  const upstream = {
    ...surface,
    events: [
      { name: 'wa-invalid', type: 'Event', cancelable: 'never' },
      { name: 'wa-hide', type: 'Event', cancelable: 'always' },
    ],
  };
  const target = {
    ...surface,
    events: [
      { name: 'lr-invalid', type: 'Event', cancelable: 'always' },
      { name: 'lr-hide', type: 'Event', cancelable: 'conditional' },
    ],
  };
  const normalizations = emptyNormalizations();
  normalizations.cancelabilityEquivalences.push({
    event: 'wa-invalid',
    upstream: 'never',
    target: 'always',
  });
  normalizations.cancelabilityPathAdditions.push({
    event: 'wa-hide',
    upstream: 'always',
    target: 'conditional',
    addedPath: 'an already-removed element closing on disconnect',
  });
  const mapping = {
    upstreamTag: 'wa-dialog',
    rewrites: { events: [{ from: 'wa-invalid', to: 'lr-invalid' }, { from: 'wa-hide', to: 'lr-hide' }] },
    normalizations,
  };
  assert.deepEqual(validateMappingNormalizations(mapping, { upstream, target }), []);

  const narrowed = structuredClone(mapping);
  narrowed.normalizations.cancelabilityEquivalences[0] = {
    event: 'wa-hide',
    upstream: 'always',
    target: 'conditional',
  };
  assert.ok(
    validateMappingNormalizations(narrowed, { upstream, target }).some((finding) =>
      finding.includes('invalid normalizations.cancelabilityEquivalences rule'),
    ),
    'the widening section refuses any rule that hands listeners less veto power than upstream',
  );

  const lostVeto = structuredClone(mapping);
  lostVeto.normalizations.cancelabilityPathAdditions[0].target = 'never';
  assert.ok(
    validateMappingNormalizations(lostVeto, { upstream, target }).some((finding) =>
      finding.includes('invalid normalizations.cancelabilityPathAdditions rule'),
    ),
    'no review can authorize dropping an upstream-cancelable event to never',
  );

  const unnamedPath = structuredClone(mapping);
  unnamedPath.normalizations.cancelabilityPathAdditions[0].addedPath = '';
  assert.ok(
    validateMappingNormalizations(unnamedPath, { upstream, target }).some((finding) =>
      finding.includes('invalid normalizations.cancelabilityPathAdditions rule'),
    ),
    'the Lyra-only path has to be named, so the claim survives in the generated inventory',
  );

  const duplicate = structuredClone(mapping);
  duplicate.normalizations.cancelabilityEquivalences.push({
    event: 'wa-hide',
    upstream: 'never',
    target: 'always',
  });
  assert.ok(
    validateMappingNormalizations(duplicate, { upstream, target }).some((finding) =>
      finding.includes('duplicate cancelability normalization wa-hide'),
    ),
    'one event carries one reviewed cancelability decision, never one per section',
  );

  const stale = structuredClone(mapping);
  stale.normalizations.cancelabilityEquivalences[0].target = 'conditional';
  const staleFindings = validateMappingNormalizations(stale, { upstream, target });
  assert.ok(staleFindings.some((finding) => finding.includes('stale target cancelability normalization wa-invalid')));

  const staleUpstream = structuredClone(mapping);
  staleUpstream.normalizations.cancelabilityPathAdditions[0].event = 'wa-invalid';
  assert.ok(
    validateMappingNormalizations(staleUpstream, { upstream, target }).some((finding) =>
      finding.includes('stale upstream cancelability normalization wa-invalid'),
    ),
  );

  const dangling = structuredClone(mapping);
  dangling.normalizations.cancelabilityEquivalences[0].event = 'wa-missing';
  const danglingFindings = validateMappingNormalizations(dangling, { upstream, target });
  assert.ok(danglingFindings.some((finding) => finding.includes('dangling upstream cancelability normalization wa-missing')));
  assert.ok(danglingFindings.some((finding) => finding.includes('dangling target cancelability normalization wa-missing')));
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
      .filter(({ code }) => code === 'reflection-mismatch' || code === 'readonly-mismatch')
      .map(({ code, section, member, expected, actual }) => ({ code, section, member, expected, actual })),
    [{
      code: 'reflection-mismatch',
      section: 'attributes',
      member: 'active',
      expected: false,
      actual: true,
    }],
    'target-side writability is additive, but reflection remains observable serialization behavior',
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

  const anyTarget = structuredClone(compatibleTarget);
  anyTarget.attributes[0].type = 'any';
  anyTarget.properties[1].type = 'any';
  assert.deepEqual(
    compareMappedSurfaces(upstream, anyTarget, { upstreamPrefix: 'wa-' })
      .filter(({ code, member }) => code === 'type-mismatch' && ['active', 'controller'].includes(member))
      .map(({ section, member, expected, actual }) => ({ section, member, expected, actual })),
    [
      { section: 'attributes', member: 'active', expected: 'boolean', actual: 'any' },
      { section: 'properties', member: 'controller', expected: 'LyraController', actual: 'any' },
    ],
    '`any` is missing public type information, not a parity-compatible widening',
  );

  const anyUpstream = structuredClone(upstream);
  const sameAnyTarget = structuredClone(compatibleTarget);
  anyUpstream.attributes[0].type = 'any';
  sameAnyTarget.attributes[0].type = 'any';
  assert.deepEqual(
    compareMappedSurfaces(anyUpstream, sameAnyTarget, { upstreamPrefix: 'wa-' })
      .filter(({ code, member }) => code === 'type-mismatch' && member === 'active')
      .map(({ expected, actual }) => ({ expected, actual })),
    [{ expected: 'any', actual: 'any' }],
    'matching `any` labels still describe no compatible public contract',
  );

  const reviewedAny = emptyNormalizations();
  reviewedAny.typeEquivalences.push({
    memberKind: 'property',
    member: 'controller',
    upstream: 'WaController',
    target: 'any',
  });
  assert.deepEqual(
    compareMappedSurfaces(upstream, anyTarget, {
      upstreamPrefix: 'wa-',
      normalizations: reviewedAny,
    })
      .filter(({ code, member }) => code === 'type-mismatch' && member === 'controller')
      .map(({ expected, actual }) => ({ expected, actual })),
    [{ expected: 'LyraController', actual: 'any' }],
    'an explicit reviewed equivalence cannot turn `any` into a public contract',
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

test('mapped event detail schemas are compared and unknown or any cannot satisfy parity', () => {
  const base = {
    attributes: [],
    properties: [],
    slots: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    methods: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const upstream = {
    ...base,
    events: [{
      name: 'wa-select',
      type: '{ item: WaMenuItem; value: string | number }',
      cancelable: 'never',
    }],
  };
  const compatibleTarget = {
    ...base,
    events: [{
      name: 'lr-select',
      type: 'CustomEvent<{ item: LyraMenuItem, value: string | number }>',
      cancelable: 'never',
    }],
  };

  assert.deepEqual(
    compareMappedSurfaces(upstream, compatibleTarget, { upstreamPrefix: 'wa-' }),
    [],
    'an upstream detail-only schema matches the equivalent target CustomEvent detail schema',
  );

  for (const type of [
    'CustomEvent<{ item: LyraMenuItem; value: string }>',
    'CustomEvent<unknown>',
    'CustomEvent<any>',
    'unknown',
  ]) {
    const target = structuredClone(compatibleTarget);
    target.events[0].type = type;
    assert.deepEqual(
      compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' })
        .filter(({ code }) => code === 'event-type-mismatch')
        .map(({ member, expected, actual }) => ({ member, expected, actual })),
      [{
        member: 'wa-select',
        expected: '{ item: LyraMenuItem; value: string | number }',
        actual: type,
      }],
      `${type} must not erase or narrow the published event detail schema`,
    );
  }

  const unsafeUpstream = structuredClone(upstream);
  unsafeUpstream.events[0].type = 'CustomEvent<any>';
  const unsafeTarget = structuredClone(compatibleTarget);
  unsafeTarget.events[0].type = 'CustomEvent<any>';
  assert.equal(
    compareMappedSurfaces(unsafeUpstream, unsafeTarget, { upstreamPrefix: 'wa-' })
      .filter(({ code }) => code === 'event-type-mismatch').length,
    1,
    'matching any labels still do not constitute a reviewed event detail contract',
  );

  const reviewedAliasTarget = structuredClone(compatibleTarget);
  reviewedAliasTarget.events[0].type = 'CustomEvent<MenuSelectionDetail>';
  const reviewedAliasNormalizations = {
    ...emptyNormalizations(),
    typeEquivalences: [{
      memberKind: 'event',
      member: 'wa-select',
      upstream: '{ item: WaMenuItem; value: string | number }',
      target: 'CustomEvent<MenuSelectionDetail>',
    }],
  };
  assert.deepEqual(
    compareMappedSurfaces(upstream, reviewedAliasTarget, {
      upstreamPrefix: 'wa-',
      normalizations: reviewedAliasNormalizations,
    }),
    [],
    'an exact per-event review can relate an otherwise opaque concrete detail alias',
  );
  assert.deepEqual(
    validateMappingNormalizations(
      {
        upstreamTag: 'wa-select',
        rewrites: emptyRewrites(),
        normalizations: reviewedAliasNormalizations,
      },
      { upstream, target: reviewedAliasTarget },
    ),
    [],
    'event type reviews are validated against the mapped target event name and both exact types',
  );

  const unknownAliasTarget = structuredClone(compatibleTarget);
  unknownAliasTarget.events[0].type = 'CustomEvent<unknown>';
  const unknownAliasNormalizations = {
    ...emptyNormalizations(),
    typeEquivalences: [{
      memberKind: 'event',
      member: 'wa-select',
      upstream: upstream.events[0].type,
      target: unknownAliasTarget.events[0].type,
    }],
  };
  assert.equal(
    compareMappedSurfaces(upstream, unknownAliasTarget, {
      upstreamPrefix: 'wa-',
      normalizations: unknownAliasNormalizations,
    }).filter(({ code }) => code === 'event-type-mismatch').length,
    1,
    'an exact review cannot turn an unknown top-level event detail into a public schema',
  );
  assert.ok(
    validateMappingNormalizations(
      {
        upstreamTag: 'wa-select',
        rewrites: emptyRewrites(),
        normalizations: unknownAliasNormalizations,
      },
      { upstream, target: unknownAliasTarget },
    ).some((finding) => finding.includes('unsafe unknown event type normalization event:wa-select')),
  );

  reviewedAliasTarget.events[0].type = 'CustomEvent<OtherSelectionDetail>';
  assert.ok(
    validateMappingNormalizations(
      {
        upstreamTag: 'wa-select',
        rewrites: emptyRewrites(),
        normalizations: reviewedAliasNormalizations,
      },
      { upstream, target: reviewedAliasTarget },
    ).some((finding) => finding.includes('stale target type normalization event:wa-select')),
    'a changed target alias invalidates the event-specific review',
  );
});

test('target event details reject top-level unknown and implicit-any without blocking upstream bare-event reviews', () => {
  const base = {
    attributes: [],
    properties: [],
    slots: [],
    parts: [],
    cssProperties: [],
    cssStates: [],
    methods: [],
    native: { forwardedEvents: [], delegatedMethods: [] },
    form: { associated: false, properties: [], methods: [] },
  };
  const upstream = {
    ...base,
    events: [{
      name: 'wa-select',
      type: '{ item: WaMenuItem; value: string }',
      cancelable: 'never',
    }],
  };
  const target = {
    ...base,
    events: [{
      name: 'lr-select',
      type: 'CustomEvent<{ item: LyraMenuItem; value: string }>',
      cancelable: 'never',
    }],
  };

  for (const [unsafeTargetType, expectedFinding] of [
    [
      'CustomEvent<unknown | { item: LyraMenuItem; value: string }>',
      'unsafe unknown event type normalization event:wa-select',
    ],
    ['CustomEvent', 'unsafe any type normalization event:wa-select'],
  ]) {
    const unsafeTarget = structuredClone(target);
    unsafeTarget.events[0].type = unsafeTargetType;
    const normalizations = {
      ...emptyNormalizations(),
      typeEquivalences: [{
        memberKind: 'event',
        member: 'wa-select',
        upstream: upstream.events[0].type,
        target: unsafeTargetType,
      }],
    };
    assert.equal(
      compareMappedSurfaces(upstream, unsafeTarget, {
        upstreamPrefix: 'wa-',
        normalizations,
      }).filter(({ code }) => code === 'event-type-mismatch').length,
      1,
      `${unsafeTargetType} cannot become a target event schema through a reviewed equivalence`,
    );
    assert.ok(
      validateMappingNormalizations(
        {
          upstreamTag: 'wa-select',
          rewrites: emptyRewrites(),
          normalizations,
        },
        { upstream, target: unsafeTarget },
      ).some((finding) => finding.includes(expectedFinding)),
      `${unsafeTargetType} is diagnosed as an unsafe target event type`,
    );
  }

  const nestedUnknownUpstream = structuredClone(upstream);
  nestedUnknownUpstream.events[0].type = '{ error: unknown }';
  const nestedUnknownTarget = structuredClone(target);
  nestedUnknownTarget.events[0].type = 'CustomEvent<{ error: unknown }>';
  assert.deepEqual(
    compareMappedSurfaces(nestedUnknownUpstream, nestedUnknownTarget, { upstreamPrefix: 'wa-' }),
    [],
    'unknown nested in a named detail field remains a concrete event schema',
  );

  const bareUpstream = structuredClone(upstream);
  bareUpstream.events[0].type = 'CustomEvent';
  const bareTarget = structuredClone(target);
  bareTarget.events[0].type = 'CustomEvent';
  assert.equal(
    compareMappedSurfaces(bareUpstream, bareTarget, { upstreamPrefix: 'wa-' })
      .filter(({ code }) => code === 'event-type-mismatch').length,
    1,
    'a bare target CustomEvent is implicit any even when the upstream manifest is equally broad',
  );

  const reviewedBareUpstream = {
    ...emptyNormalizations(),
    typeEquivalences: [{
      memberKind: 'event',
      member: 'wa-select',
      upstream: 'CustomEvent',
      target: target.events[0].type,
    }],
  };
  assert.deepEqual(
    compareMappedSurfaces(bareUpstream, target, {
      upstreamPrefix: 'wa-',
      normalizations: reviewedBareUpstream,
    }),
    [],
    'a pinned upstream bare CustomEvent remains reviewable against a concrete target detail',
  );
  assert.deepEqual(
    validateMappingNormalizations(
      {
        upstreamTag: 'wa-select',
        rewrites: emptyRewrites(),
        normalizations: reviewedBareUpstream,
      },
      { upstream: bareUpstream, target },
    ),
    [],
  );

  const propertyNamedAnyUpstream = structuredClone(upstream);
  propertyNamedAnyUpstream.events[0].type = 'CustomEvent<{ any: string }>';
  const propertyNamedAnyTarget = structuredClone(target);
  propertyNamedAnyTarget.events[0].type = 'CustomEvent<{ any: string }>';
  assert.deepEqual(
    compareMappedSurfaces(propertyNamedAnyUpstream, propertyNamedAnyTarget, {
      upstreamPrefix: 'wa-',
    }),
    [],
    'an ordinary property named any is not mistaken for the any type keyword',
  );

  const actualAnyTarget = structuredClone(target);
  actualAnyTarget.events[0].type = 'CustomEvent<{ value: any }>';
  assert.equal(
    compareMappedSurfaces(upstream, actualAnyTarget, { upstreamPrefix: 'wa-' })
      .filter(({ code }) => code === 'event-type-mismatch').length,
    1,
    'any in an event detail type position still fails closed',
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

test('reviewed method-parameter aliases are exact and preserve every other signature check', () => {
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
  const copyOptions = "{ columnIds?: string[]; includeHeaders?: boolean; format?: 'tsv' | 'csv'; escapeFormulas?: boolean; }";
  const exportOptions = '{ fileName?: string; columnIds?: string[]; includeHeaders?: boolean; delimiter?: string; escapeFormulas?: boolean; }';
  const csvOptions = '{ columnIds?: string[]; includeHeaders?: boolean; delimiter?: string; escapeFormulas?: boolean; }';
  const scrollOptions = "{ align?: 'start' | 'center' | 'end' }";
  const upstream = {
    ...surface,
    methods: [
      {
        name: 'copySelectedRows',
        overloads: [{ parameters: [{ name: 'options', type: copyOptions, optional: true, hasDefault: false }], returnType: 'unspecified-public-documentation' }],
      },
      {
        name: 'exportDataAsCsv',
        overloads: [{ parameters: [{ name: 'options', type: exportOptions, optional: false, hasDefault: false }], returnType: 'unspecified-public-documentation' }],
      },
      {
        name: 'getDataAsCsv',
        overloads: [{ parameters: [{ name: 'options', type: csvOptions, optional: false, hasDefault: false }], returnType: 'unspecified-public-documentation' }],
      },
      {
        name: 'scrollToIndex',
        overloads: [{
          parameters: [
            { name: 'index', type: 'number', optional: false, hasDefault: false },
            { name: 'options', type: scrollOptions, optional: false, hasDefault: false },
          ],
          returnType: 'unspecified-public-documentation',
        }],
      },
    ],
  };
  const target = {
    ...surface,
    methods: [
      {
        name: 'copySelectedRows',
        overloads: [{
          parameters: [{ name: 'options', type: 'DataGridCopyOptions', optional: false, hasDefault: true, default: '{}' }],
          returnType: 'number',
        }],
      },
      {
        name: 'exportDataAsCsv',
        overloads: [{
          parameters: [{ name: 'options', type: 'DataGridExportOptions', optional: false, hasDefault: true, default: '{}' }],
          returnType: 'void',
        }],
      },
      {
        name: 'getDataAsCsv',
        overloads: [{
          parameters: [{ name: 'options', type: 'DataGridCsvOptions', optional: false, hasDefault: true, default: '{}' }],
          returnType: 'string',
        }],
      },
      {
        name: 'scrollToIndex',
        overloads: [{
          parameters: [
            { name: 'index', type: 'number', optional: false, hasDefault: false },
            { name: 'options', type: 'DataGridScrollOptions', optional: false, hasDefault: true, default: '{}' },
          ],
          returnType: 'void',
        }],
      },
    ],
  };
  const normalizations = {
    ...emptyNormalizations(),
    methodParameterTypeEquivalences: [
      { method: 'copySelectedRows', parameter: 'options', upstream: copyOptions, target: 'DataGridCopyOptions' },
      { method: 'exportDataAsCsv', parameter: 'options', upstream: exportOptions, target: 'DataGridExportOptions' },
      { method: 'getDataAsCsv', parameter: 'options', upstream: csvOptions, target: 'DataGridCsvOptions' },
      { method: 'scrollToIndex', parameter: 'options', upstream: scrollOptions, target: 'DataGridScrollOptions' },
    ],
  };
  const mapping = { upstreamTag: 'wa-data-grid', rewrites: emptyRewrites(), normalizations };

  assert.deepEqual(compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-', normalizations }), []);
  assert.deepEqual(validateMappingNormalizations(mapping, { upstream, target }), []);

  const rewrittenTarget = structuredClone(target);
  rewrittenTarget.methods[0].name = 'copyRows';
  const rewrittenMapping = {
    ...mapping,
    rewrites: {
      ...emptyRewrites(),
      methods: [{ from: 'copySelectedRows', to: 'copyRows' }],
    },
  };
  assert.deepEqual(
    compareMappedSurfaces(upstream, rewrittenTarget, {
      upstreamPrefix: 'wa-',
      rewrites: rewrittenMapping.rewrites,
      normalizations,
    }),
    [],
    'an exact rule remains keyed to the upstream name when the method itself has a deterministic rewrite',
  );
  assert.deepEqual(validateMappingNormalizations(rewrittenMapping, { upstream, target: rewrittenTarget }), []);

  const wrongType = structuredClone(target);
  wrongType.methods[0].overloads[0].parameters[0].type = 'OtherCopyOptions';
  assert.ok(
    compareMappedSurfaces(upstream, wrongType, { upstreamPrefix: 'wa-', normalizations })
      .some(({ code, member }) => code === 'method-signature-mismatch' && member === 'copySelectedRows'),
    'the exact target alias is required',
  );
  assert.ok(
    validateMappingNormalizations(mapping, { upstream, target: wrongType })
      .some((finding) => finding.includes('stale target method-parameter type normalization copySelectedRows:options')),
  );

  const wrongName = structuredClone(target);
  wrongName.methods[0].overloads[0].parameters[0].name = 'config';
  assert.ok(
    compareMappedSurfaces(upstream, wrongName, { upstreamPrefix: 'wa-', normalizations })
      .some(({ code, member }) => code === 'method-signature-mismatch' && member === 'copySelectedRows'),
    'an alias rule cannot hide a parameter rename',
  );
  assert.ok(
    validateMappingNormalizations(mapping, { upstream, target: wrongName })
      .some((finding) => finding.includes('dangling target method parameter normalization copySelectedRows:options')),
  );

  const staleUpstream = structuredClone(upstream);
  staleUpstream.methods[0].overloads[0].parameters[0].type = '{ columns?: string[] }';
  assert.ok(
    validateMappingNormalizations(mapping, { upstream: staleUpstream, target })
      .some((finding) => finding.includes('stale upstream method-parameter type normalization copySelectedRows:options')),
  );

  const dangling = structuredClone(normalizations);
  dangling.methodParameterTypeEquivalences[0].method = 'missingMethod';
  assert.ok(
    validateMappingNormalizations(
      { ...mapping, normalizations: dangling },
      { upstream, target },
    ).some((finding) => finding.includes('dangling upstream method-parameter type normalization missingMethod:options')),
  );

  const duplicate = structuredClone(normalizations);
  duplicate.methodParameterTypeEquivalences.push(
    structuredClone(duplicate.methodParameterTypeEquivalences[0]),
  );
  assert.ok(
    validateMappingNormalizations(
      { ...mapping, normalizations: duplicate },
      { upstream, target },
    ).some((finding) =>
      finding.includes('duplicate normalizations.methodParameterTypeEquivalences rule copySelectedRows:options'),
    ),
  );

  const missingDefault = structuredClone(target);
  delete missingDefault.methods[0].overloads[0].parameters[0].default;
  missingDefault.methods[0].overloads[0].parameters[0].hasDefault = false;
  assert.ok(
    compareMappedSurfaces(upstream, missingDefault, { upstreamPrefix: 'wa-', normalizations })
      .some(({ code, member }) => code === 'method-signature-mismatch' && member === 'copySelectedRows'),
    'an alias rule cannot hide the optional/default call contract',
  );

  const concreteReturnUpstream = structuredClone(upstream);
  concreteReturnUpstream.methods[3].overloads[0].returnType = 'void';
  const wrongReturn = structuredClone(target);
  wrongReturn.methods[3].overloads[0].returnType = 'Promise<void>';
  assert.ok(
    compareMappedSurfaces(concreteReturnUpstream, wrongReturn, { upstreamPrefix: 'wa-', normalizations })
      .some(({ code, member }) => code === 'method-signature-mismatch' && member === 'scrollToIndex'),
    'an alias rule cannot hide a concrete return mismatch',
  );

  const unsafe = structuredClone(normalizations);
  unsafe.methodParameterTypeEquivalences[0].target = 'any';
  const unsafeTarget = structuredClone(target);
  unsafeTarget.methods[0].overloads[0].parameters[0].type = 'any';
  assert.ok(
    validateMappingNormalizations(
      { ...mapping, normalizations: unsafe },
      { upstream, target: unsafeTarget },
    ).some((finding) => finding.includes('unsafe any method-parameter type normalization copySelectedRows:options')),
    'a reviewed alias cannot erase the method parameter contract with any',
  );

  for (const unsafeUnknownType of ['unknown | string', 'Array<unknown>', '{ value: unknown }']) {
    const unknown = structuredClone(normalizations);
    unknown.methodParameterTypeEquivalences[0].upstream = unsafeUnknownType;
    unknown.methodParameterTypeEquivalences[0].target = 'NarrowValue';
    const unknownUpstream = structuredClone(upstream);
    unknownUpstream.methods[0].overloads[0].parameters[0].type = unsafeUnknownType;
    const unknownTarget = structuredClone(target);
    unknownTarget.methods[0].overloads[0].parameters[0].type = 'NarrowValue';
    assert.ok(
      compareMappedSurfaces(unknownUpstream, unknownTarget, { upstreamPrefix: 'wa-', normalizations: unknown })
        .some(({ code, member }) => code === 'method-signature-mismatch' && member === 'copySelectedRows'),
      'an unknown-containing source parameter never authorizes a narrowing alias',
    );
    assert.ok(
      validateMappingNormalizations(
        { ...mapping, normalizations: unknown },
        { upstream: unknownUpstream, target: unknownTarget },
      ).some((finding) => finding.includes('unsafe unknown method-parameter type normalization copySelectedRows:options')),
    );
  }

  const unknownTargetRule = structuredClone(normalizations);
  unknownTargetRule.methodParameterTypeEquivalences[0].target = 'Array<unknown>';
  const unknownTarget = structuredClone(target);
  unknownTarget.methods[0].overloads[0].parameters[0].type = 'Array<unknown>';
  assert.ok(
    compareMappedSurfaces(upstream, unknownTarget, {
      upstreamPrefix: 'wa-',
      normalizations: unknownTargetRule,
    }).some(({ code, member }) => code === 'method-signature-mismatch' && member === 'copySelectedRows'),
    'an unknown-containing target parameter never authorizes an opaque alias',
  );
  assert.ok(
    validateMappingNormalizations(
      { ...mapping, normalizations: unknownTargetRule },
      { upstream, target: unknownTarget },
    ).some((finding) => finding.includes('unsafe unknown method-parameter type normalization copySelectedRows:options')),
  );

  for (const [side, unsafeTemplateType] of [
    ['upstream', '`${any}`'],
    ['target', '`prefix-${unknown}`'],
  ]) {
    const templateRule = structuredClone(normalizations);
    const templateUpstream = structuredClone(upstream);
    const templateTarget = structuredClone(target);
    if (side === 'upstream') {
      templateRule.methodParameterTypeEquivalences[0].upstream = unsafeTemplateType;
      templateRule.methodParameterTypeEquivalences[0].target = 'NarrowValue';
      templateUpstream.methods[0].overloads[0].parameters[0].type = unsafeTemplateType;
      templateTarget.methods[0].overloads[0].parameters[0].type = 'NarrowValue';
    } else {
      templateRule.methodParameterTypeEquivalences[0].target = unsafeTemplateType;
      templateTarget.methods[0].overloads[0].parameters[0].type = unsafeTemplateType;
    }
    assert.ok(
      compareMappedSurfaces(templateUpstream, templateTarget, {
        upstreamPrefix: 'wa-',
        normalizations: templateRule,
      }).some(({ code, member }) => code === 'method-signature-mismatch' && member === 'copySelectedRows'),
      'a template interpolation never authorizes an opaque method parameter alias',
    );
    assert.ok(
      validateMappingNormalizations(
        { ...mapping, normalizations: templateRule },
        { upstream: templateUpstream, target: templateTarget },
      ).some((finding) =>
        finding.includes('unsafe template interpolation method-parameter type normalization copySelectedRows:options'),
      ),
    );
  }

  const nonString = structuredClone(normalizations);
  nonString.methodParameterTypeEquivalences[0].upstream = 1;
  nonString.methodParameterTypeEquivalences[0].target = 2;
  const nonStringUpstream = structuredClone(upstream);
  nonStringUpstream.methods[0].overloads[0].parameters[0].type = 1;
  const nonStringTarget = structuredClone(target);
  nonStringTarget.methods[0].overloads[0].parameters[0].type = 2;
  assert.ok(
    compareMappedSurfaces(nonStringUpstream, nonStringTarget, {
      upstreamPrefix: 'wa-',
      normalizations: nonString,
    }).some(({ code, member }) => code === 'method-signature-mismatch' && member === 'copySelectedRows'),
    'a non-string rule cannot authorize a synthetic parameter type mismatch',
  );
  assert.ok(
    validateMappingNormalizations(
      { ...mapping, normalizations: nonString },
      { upstream: nonStringUpstream, target: nonStringTarget },
    ).some((finding) => finding.includes('invalid normalizations.methodParameterTypeEquivalences rule')),
  );

  for (const nameField of ['method', 'parameter']) {
    const whitespaceName = structuredClone(normalizations);
    whitespaceName.methodParameterTypeEquivalences[0][nameField] = '   ';
    assert.ok(
      validateMappingNormalizations(
        { ...mapping, normalizations: whitespaceName },
        { upstream, target },
      ).some((finding) => finding.includes('invalid normalizations.methodParameterTypeEquivalences rule')),
      `a whitespace-only ${nameField} cannot identify a reviewed method parameter alias`,
    );
  }
});

test('wa-data-grid pins only its five reviewed public method-parameter aliases', () => {
  assert.deepEqual(reviewedMappingNormalizations('wa-data-grid').methodParameterTypeEquivalences, [
    {
      // Parameter WIDENING, not an interface rename like the four below: `DataGridPinSide` is
      // `'left' | 'right' | 'start' | 'end' | false`, a strict superset of upstream's union, so
      // every call a `wa-data-grid` consumer can already write stays valid after the prefix
      // substitution. A narrowing here would not be reviewable this way.
      method: 'pinColumn',
      parameter: 'side',
      upstream: "'left' | 'right' | false",
      target: 'DataGridPinSide',
    },
    {
      method: 'copySelectedRows',
      parameter: 'options',
      upstream: "{ columnIds?: string[]; includeHeaders?: boolean; format?: 'tsv' | 'csv'; escapeFormulas?: boolean; }",
      target: 'DataGridCopyOptions',
    },
    {
      method: 'exportDataAsCsv',
      parameter: 'options',
      upstream: '{ fileName?: string; columnIds?: string[]; includeHeaders?: boolean; delimiter?: string; escapeFormulas?: boolean; }',
      target: 'DataGridExportOptions',
    },
    {
      method: 'getDataAsCsv',
      parameter: 'options',
      upstream: '{ columnIds?: string[]; includeHeaders?: boolean; delimiter?: string; escapeFormulas?: boolean; }',
      target: 'DataGridCsvOptions',
    },
    {
      method: 'scrollToIndex',
      parameter: 'options',
      upstream: "{ align?: 'start' | 'center' | 'end' }",
      target: 'DataGridScrollOptions',
    },
  ]);
  assert.deepEqual(
    reviewedMappingNormalizations('wa-option').methodParameterTypeEquivalences,
    [],
    'an unrelated mapping cannot inherit the data-grid alias review',
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
    ...emptyNormalizations(),
    derivedDefaultEquivalences: normalizations.derivedDefaultEquivalences,
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
        {
          name: 'change',
          type: { text: 'Event & { readonly detail: { value: string } }' },
          description: 'A bubbling, composed native change event with compatibility detail.',
        },
      ],
    },
    { ecosystem: 'lyra' },
  );
  assert.deepEqual(normalized.events, [
    {
      name: 'change',
      type: 'Event & { readonly detail: { value: string } }',
      cancelable: 'never',
      constructor: 'Event',
      bubbles: true,
      composed: true,
    },
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
    [
      'event-bubbles-mismatch',
      'event-composed-mismatch',
      'event-constructor-mismatch',
      'event-type-mismatch',
    ],
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
  for (const [upstreamTag, type] of [
    ['wa-bar-chart', 'bar'],
    ['wa-bubble-chart', 'bubble'],
    ['wa-doughnut-chart', 'doughnut'],
    ['wa-line-chart', 'line'],
    ['wa-pie-chart', 'pie'],
    ['wa-polar-area-chart', 'polarArea'],
    ['wa-radar-chart', 'radar'],
    ['wa-scatter-chart', 'scatter'],
  ]) {
    assert.ok(
      hasTypeRule(upstreamTag, 'attribute', 'type', 'ChartType', `'${type}'`),
      `${upstreamTag} maps Chart.js's controller union to its runtime-locked literal`,
    );
    assert.equal(
      hasTypeRule(upstreamTag, 'attribute', 'type', 'ChartType', 'LyraChartType'),
      false,
      `${upstreamTag} must not widen a locked chart type back to the full union`,
    );
  }
  assert.ok(
    hasTypeRule(
      'wa-chart',
      'property',
      'config',
      "ChartJS['config']",
      'LyraChartConfiguration | undefined',
    ),
    'the owned chart configuration capability is pinned to its exact current manifest spelling',
  );
  assert.ok(
    hasTypeRule(
      'wa-markdown',
      'property',
      'marked',
      'Marked',
      'LyraMarkedParser | undefined',
    ),
    'the owned Markdown parser capability is pinned to its exact current manifest spelling',
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
  assert.equal(
    hasTypeRule(
      'wa-accordion',
      'event',
      'wa-expand',
      '{ item: WaAccordionItem }',
      'CustomEvent<LyraAccordionEventDetail>',
    ),
    false,
    'an event-detail widening is a migration warning, not a type equivalence',
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
    ['sl-badge', 'attribute', 'variant', "'primary' | 'success' | 'neutral' | 'warning' | 'danger'", 'BadgeVariant'],
    ['sl-button', 'attribute', 'formenctype', "'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain'", 'ButtonFormEnctype | undefined'],
    ['sl-button', 'attribute', 'formmethod', "'post' | 'get'", 'ButtonFormMethod | undefined'],
    ['sl-button', 'attribute', 'variant', "'default' | 'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text'", 'ButtonVariant'],
    ['sl-tag', 'attribute', 'size', "'small' | 'medium' | 'large'", 'BadgeSize'],
    ['sl-tag', 'attribute', 'variant', "'primary' | 'success' | 'neutral' | 'warning' | 'danger' | 'text'", 'TagVariant'],
    ['wa-badge', 'attribute', 'variant', "'brand' | 'neutral' | 'success' | 'warning' | 'danger'", 'BadgeVariant'],
    ['wa-button', 'attribute', 'variant', "'neutral' | 'brand' | 'success' | 'warning' | 'danger'", 'ButtonVariant'],
    ['wa-date-input', 'property', 'validators', 'Validator[]', 'LyraDateInputValidator[]'],
    ['wa-rating', 'attribute', 'size', "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'LyraRatingSize'],
    ['wa-tag', 'attribute', 'size', "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'BadgeSize'],
    ['wa-tag', 'attribute', 'variant', "'brand' | 'neutral' | 'success' | 'warning' | 'danger'", 'TagVariant'],
    ['wa-toast-item', 'attribute', 'size', "'xs' | 's' | 'm' | 'l' | 'xl' | 'small' | 'medium' | 'large'", 'ToastSize'],
  ]) {
    assert.ok(
      hasTypeRule(tag, memberKind, member, upstream, target),
      `${tag}.${member} records its exact public alias representation`,
    );
  }
  assert.equal(
    reviewedMappingNormalizations('sl-button').typeEquivalences.some(
      ({ member }) => member === 'form-enctype' || member === 'form-method',
    ),
    false,
    'sl-button type equivalences use the published native attribute spellings, not stale aliases',
  );
  assert.equal(
    reviewedMappingNormalizations('wa-option').typeEquivalences.length,
    0,
    'an unrelated tag never inherits a global type alias exception',
  );
});

test('raw-token preserving aliases keep the six affected mappings release-safe', async () => {
  const inventory = readJson('scripts', 'fixtures', 'component-inventory.json');
  const upstreams = new Map(
    Object.values(inventory.upstreams)
      .flatMap(({ components }) => components)
      .map((component) => [component.tag, component.surface]),
  );
  const liveTargets = new Map(
    normalizeManifest(
      expandLyraInventoryManifest((await generateManifest({ write: false })).manifest),
      { ecosystem: 'lyra' },
    ).map((component) => [component.tag, component.surface]),
  );
  const expectedTargetTypes = new Map([
    ['sl-badge', new Map([['variant', 'BadgeVariant']])],
    ['sl-tag', new Map([['size', 'BadgeSize'], ['variant', 'TagVariant']])],
    ['wa-badge', new Map([['variant', 'BadgeVariant']])],
    ['wa-rating', new Map([['size', 'LyraRatingSize']])],
    ['wa-tag', new Map([['size', 'BadgeSize'], ['variant', 'TagVariant']])],
    ['wa-toast-item', new Map([['size', 'ToastSize']])],
  ]);

  for (const [upstreamTag, memberTypes] of expectedTargetTypes) {
    const mapping = inventory.mappings.find((entry) => entry.upstreamTag === upstreamTag);
    const upstream = upstreams.get(upstreamTag);
    const target = liveTargets.get(mapping?.targetTag);
    assert.ok(mapping, `${upstreamTag} must have a pinned mapping`);
    assert.ok(upstream, `${upstreamTag} must have a pinned public surface`);
    assert.ok(target, `${mapping.targetTag} must resolve in the fresh manifest`);
    assert.equal(mapping.decisionSource, 'derived', `${upstreamTag} must not retain a manual release blocker`);

    const normalizations = reviewedMappingNormalizations(upstreamTag);
    for (const [member, expectedType] of memberTypes) {
      assert.equal(
        target.attributes.find((attribute) => attribute.name === member)?.type,
        expectedType,
        `${mapping.targetTag}.${member} keeps the current raw-token alias`,
      );
      assert.equal(
        normalizations.typeEquivalences.find(
          (rule) => rule.memberKind === 'attribute' && rule.member === member,
        )?.target,
        expectedType,
        `${upstreamTag}.${member} reviews that exact live alias instead of a stale expanded union`,
      );
    }

    const currentMapping = { ...mapping, normalizations };
    assert.deepEqual(
      validateMappingNormalizations(currentMapping, { upstream, target }),
      [],
      `${upstreamTag} has no stale or dangling comparison normalization`,
    );
    assert.deepEqual(
      compareMappedSurfaces(upstream, target, {
        upstreamPrefix: mapping.upstream === 'webawesome' ? 'wa-' : 'sl-',
        rewrites: mapping.rewrites,
        normalizations,
      }),
      [],
      `${upstreamTag} regenerates as a supported rewritten mapping`,
    );
  }
});

test('combobox lifecycle cancelability reviews match the live connected and disconnect paths', () => {
  assert.deepEqual(
    reviewedMappingNormalizations('wa-combobox').cancelabilityEquivalences,
    [
      { event: 'wa-hide', upstream: 'never', target: 'conditional' },
      { event: 'wa-invalid', upstream: 'never', target: 'always' },
      { event: 'wa-show', upstream: 'never', target: 'always' },
    ],
  );
});

test('accordion and carousel event-detail widenings require explicit migration review', () => {
  const cases = [
    {
      upstreamTag: 'sl-carousel',
      targetTag: 'lr-carousel',
      event: 'sl-slide-change',
      flags: ['event-detail-slide-type-widening'],
      rationale: /arbitrary HTMLElement slides.*item-specific members/iu,
      drift: [{
        code: 'event-type-mismatch',
        section: 'events',
        member: 'sl-slide-change',
        expected: '{ index: number, slide: LyraCarouselItem }',
        actual: 'CustomEvent<{ index: number; slide: HTMLElement }>',
      }],
    },
    {
      upstreamTag: 'wa-carousel',
      targetTag: 'lr-carousel',
      event: 'wa-slide-change',
      flags: ['event-detail-slide-type-widening'],
      rationale: /arbitrary HTMLElement slides.*item-specific members/iu,
      drift: [{
        code: 'event-type-mismatch',
        section: 'events',
        member: 'wa-slide-change',
        expected: '{ index: number, slide: LyraCarouselItem }',
        actual: 'CustomEvent<{ index: number; slide: HTMLElement }>',
      }],
    },
    {
      upstreamTag: 'wa-accordion',
      targetTag: 'lr-accordion',
      event: 'wa-expand',
      flags: ['event-detail-item-type-widening', 'legacy-details-panels'],
      rationale: /legacy.*lr-details.*item-specific members/iu,
      drift: ['wa-after-collapse', 'wa-after-expand', 'wa-collapse', 'wa-expand'].map((member) => ({
        code: 'event-type-mismatch',
        section: 'events',
        member,
        expected: '{ item: LyraAccordionItem }',
        actual: 'CustomEvent<LyraAccordionEventDetail>',
      })),
    },
  ];

  for (const { upstreamTag, targetTag, event, flags, rationale, drift } of cases) {
    assert.equal(
      reviewedMappingNormalizations(upstreamTag).typeEquivalences.some(
        (entry) => entry.memberKind === 'event' && entry.member === event,
      ),
      false,
      `${upstreamTag} must not suppress the widened event detail as an equivalence`,
    );
    const decision = reviewedMigrationDecision(upstreamTag);
    assert.equal(decision?.classification, 'warning-required');
    assert.deepEqual(decision?.expectedDrift, drift);
    assert.match(decision?.rationale ?? '', rationale);

    const parity = migrationParityMetadata({
      upstream: {
        tag: upstreamTag,
        review: { status: 'complete' },
        surface: { slots: [{ name: '' }] },
      },
      target: { tag: targetTag, rootIncluded: true, optionalPeers: [] },
      classification: 'warning-required',
    });
    assert.deepEqual(parity.behaviorReviewFlags, flags);
  }
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

test('editor CSS descriptions keep differing defaults in separate component contexts', () => {
  assert.equal(
    cssPropertyDescription([
      { tag: 'lr-card', description: 'Corner radius.', default: 'var(--lr-radius)' },
      { tag: 'lr-panel', description: 'Corner radius.', default: 'var(--lr-radius)' },
      { tag: 'lr-skeleton', description: 'Corner radius.', default: '0' },
    ]),
    '**`<lr-card>`, `<lr-panel>`** (default: `var(--lr-radius)`) — Corner radius.\n\n' +
      '**`<lr-skeleton>`** (default: `0`) — Corner radius.',
  );

  const absentAndNull = [
    { tag: 'lr-absent', description: 'Shared paint.' },
    { tag: 'lr-null', description: 'Shared paint.', default: null },
  ];
  const expectedAbsentAndNull =
    '**`<lr-absent>`** — Shared paint.\n\n' +
    '**`<lr-null>`** (default: `null`) — Shared paint.';
  assert.equal(cssPropertyDescription(absentAndNull), expectedAbsentAndNull);
  assert.equal(
    cssPropertyDescription([...absentAndNull].reverse()),
    expectedAbsentAndNull.split('\n\n').reverse().join('\n\n'),
    'default presence remains distinct in either input order',
  );
});

test('editor closed-set resolution covers nested aliases, utilities, indexed access, and reviewed externals', () => {
  const registry = readTypeAliases(path.join(packageDir, 'src'));
  const values = (type) => htmlDataValues(type, registry)?.map(({ name }) => name);

  assert.deepEqual(values('ConfirmBarVariant'), ['neutral', 'danger']);
  assert.deepEqual(values('DataGridSize'), ['xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large']);
  assert.deepEqual(values("Extract<Placement, 'top' | 'bottom'>"), ['top', 'bottom']);
  assert.deepEqual(values("Exclude<PlaybackDirection, 'alternate-reverse'>"), [
    'alternate',
    'normal',
    'reverse',
  ]);
  assert.deepEqual(values("LyraNeighborRow['direction']"), ['in', 'out', 'both']);
  assert.deepEqual(values('FillMode'), ['auto', 'backwards', 'both', 'forwards', 'none']);
  assert.deepEqual(values('Placement'), [
    'top', 'top-start', 'top-end',
    'right', 'right-start', 'right-end',
    'bottom', 'bottom-start', 'bottom-end',
    'left', 'left-start', 'left-end',
  ]);
  assert.equal(values('string'), undefined, 'an open string vocabulary stays intentionally uncompleted');
});

test('every known live editor closed-set gap emits VS Code and WebStorm values', async () => {
  const registry = readTypeAliases(path.join(packageDir, 'src'));
  const liveManifest = expandManifestInheritance((await generateManifest({ write: false })).manifest);
  const declarations = new Map(
    liveManifest.modules
      .flatMap((module) => module.declarations ?? [])
      .filter(({ tagName }) => tagName)
      .map((declaration) => [declaration.tagName, declaration]),
  );
  const closedAttributes = [
    ['lr-confirm-bar', 'variant'],
    ...[
      'lr-chart',
      'lr-bar-chart',
      'lr-bubble-chart',
      'lr-doughnut-chart',
      'lr-histogram',
      'lr-line-chart',
      'lr-pie-chart',
      'lr-polar-area-chart',
      'lr-radar-chart',
      'lr-scatter-chart',
    ].map((tag) => [tag, 'legend-position']),
    ['lr-data-grid', 'size'],
    ['lr-color-picker', 'placement'],
    ['lr-select', 'placement'],
    ['lr-menu', 'placement'],
    ['lr-dropdown', 'placement'],
    ['lr-popover', 'placement'],
    ['lr-tooltip', 'placement'],
    ['lr-popup', 'placement'],
    ['lr-tour', 'placement'],
    ['lr-combobox', 'appearance'],
    ['lr-date-input', 'appearance'],
    ['lr-otp-input', 'appearance'],
    ['lr-accordion-item', 'appearance'],
    ['lr-accordion', 'appearance'],
    ['lr-details', 'appearance'],
    ['lr-animation', 'direction'],
    ['lr-animation', 'fill'],
    ['lr-alert', 'variant'],
    ['lr-retrieval-search', 'mode'],
    ['lr-known-date', 'appearance'],
    ['lr-app-rail', 'preferred-mode'],
  ];

  for (const [tag, name] of closedAttributes) {
    const attribute = declarations.get(tag)?.attributes?.find((entry) => entry.name === name);
    assert.ok(attribute, `${tag}[${name}] is present in the effective manifest`);
    const htmlValues = htmlDataValues(attribute.type?.text, registry);
    assert.ok(htmlValues?.length, `${tag}[${name}] emits VS Code values from ${attribute.type?.text}`);
    assert.deepEqual(
      webTypesValue(attribute.type?.text, registry),
      { type: htmlValues.map(({ name: value }) => `'${value}'`) },
      `${tag}[${name}] emits the same WebStorm values`,
    );
  }

  for (const type of ['string', 'number | "auto"', 'string | number', 'TimeZoneLike']) {
    assert.equal(htmlDataValues(type, registry), undefined, `${type} remains an open editor value`);
  }
});

test('effective CEM attributes use resolved field defaults and winning subclass contracts', async () => {
  const liveManifest = (await generateManifest({ write: false })).manifest;
  const declarations = liveManifest.modules.flatMap((module) => module.declarations ?? []);
  const declaration = (tag) => declarations.find((entry) => entry.tagName === tag);

  const settings = declaration('lr-model-settings-panel');
  assert.equal(settings.members.find(({ name }) => name === 'temperature').default, '1');
  assert.equal(settings.attributes.find(({ name }) => name === 'temperature').default, '1');

  const dropdown = declaration('lr-dropdown');
  assert.equal(dropdown.members.find(({ name }) => name === 'arrow').default, 'false');
  assert.equal(dropdown.attributes.find(({ name }) => name === 'arrow').default, 'false');
  assert.equal(dropdown.members.find(({ name }) => name === 'popupRole').default, "'menu'");
  assert.equal(dropdown.attributes.find(({ name }) => name === 'popup-role').default, "'menu'");

  for (const component of declarations.filter(({ tagName }) => tagName)) {
    for (const attribute of component.attributes ?? []) {
      const field = (component.members ?? []).find(
        (member) => member.kind === 'field' && member.name === attribute.fieldName,
      );
      if (!field) continue;
      assert.equal(attribute.fieldName, field.name, `${component.tagName}[${attribute.name}] field`);
      if (field.type?.text) assert.equal(attribute.type?.text, field.type.text, `${component.tagName}[${attribute.name}] type`);
      if (field.default !== undefined) {
        assert.equal(attribute.default, field.default, `${component.tagName}[${attribute.name}] default`);
      }
      assert.doesNotMatch(
        String(attribute.default ?? ''),
        /^[A-Z_$][A-Z0-9_$]*$/u,
        `${component.tagName}[${attribute.name}] must not publish an initializer identifier`,
      );
    }
  }
});

test('the raw CEM projects complete effective wrapper and source-only mixin surfaces', async () => {
  const liveManifest = (await generateManifest({ write: false })).manifest;
  const declarations = new Map(
    liveManifest.modules
      .flatMap((module) => module.declarations ?? [])
      .filter(({ tagName }) => tagName)
      .map((declaration) => [declaration.tagName, declaration]),
  );

  for (const module of liveManifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      if (!declaration.tagName) continue;
      const surface = normalizeDeclaration(declaration, { ecosystem: 'lyra' });
      const propertyNames = new Set(surface.properties.map(({ name }) => name));
      const methodNames = new Set(surface.methods.map(({ name }) => name));
      for (const attribute of declaration.attributes ?? []) {
        assert.ok(attribute.type?.text, `${declaration.tagName}[${attribute.name}] public type`);
      }
      for (const member of declaration.members ?? []) {
        if (member.inheritedFrom || member.static || ['private', 'protected'].includes(member.privacy)) continue;
        if (member.kind === 'field') {
          assert.ok(propertyNames.has(member.name), `${declaration.tagName}.${member.name} remains governed`);
          assert.ok(member.type?.text, `${declaration.tagName}.${member.name} public type`);
        } else if (member.kind === 'method') {
          assert.ok(methodNames.has(member.name), `${declaration.tagName}.${member.name}() remains governed`);
          assert.ok(member.return?.type?.text, `${declaration.tagName}.${member.name}() return type`);
          for (const parameter of member.parameters ?? []) {
            assert.ok(
              parameter.type?.text,
              `${declaration.tagName}.${member.name}(${parameter.name}) parameter type`,
            );
          }
        }
      }
    }
  }

  const effectiveManifest = expandManifestInheritance(liveManifest);
  for (const declaration of effectiveManifest.modules
    .flatMap((module) => module.declarations ?? [])
    .filter(({ tagName }) => tagName)) {
    for (const attribute of declaration.attributes ?? []) {
      assert.ok(attribute.type?.text, `${declaration.tagName}[${attribute.name}] effective public type`);
    }
    for (const member of declaration.members ?? []) {
      if (member.static || ['private', 'protected'].includes(member.privacy)) continue;
      if (member.kind === 'field') {
        assert.ok(member.type?.text, `${declaration.tagName}.${member.name} effective public type`);
      } else if (member.kind === 'method') {
        assert.ok(member.return?.type?.text, `${declaration.tagName}.${member.name}() effective return type`);
        for (const parameter of member.parameters ?? []) {
          assert.ok(
            parameter.type?.text,
            `${declaration.tagName}.${member.name}(${parameter.name}) effective parameter type`,
          );
        }
      }
    }
  }

  assert.equal(DOCUMENT_ANCHOR_TARGET_TAGS.length, 21);
  for (const tag of DOCUMENT_ANCHOR_TARGET_TAGS) {
    const declaration = declarations.get(tag);
    assert.ok(declaration, `${tag} is present`);
    for (const [name, contract] of Object.entries(DOCUMENT_ANCHOR_TARGET_CONTRACT.fields)) {
      const member = declaration.members?.find((entry) => entry.kind === 'field' && entry.name === name);
      if (name === 'anchorKinds') {
        assert.match(
          member?.type?.text ?? '',
          /^(?:readonly LyraAnchorKind\[\]|(?:readonly )?\[[^\]]*\])$/u,
          `${tag}.${name} effective type`,
        );
        assert.match(member?.default ?? '', /^\[[^\]]*\]$/u, `${tag}.${name} effective default`);
      } else {
        assert.equal(member?.type?.text, contract.type, `${tag}.${name} type`);
        assert.equal(member?.default, contract.default, `${tag}.${name} default`);
      }
      assert.ok(member?.description, `${tag}.${name} description`);
      if (contract.attribute) {
        const attribute = declaration.attributes?.find((entry) => entry.name === contract.attribute);
        assert.equal(attribute?.fieldName, name, `${tag}[${contract.attribute}] association`);
      }
    }
    for (const [name, contract] of Object.entries(DOCUMENT_ANCHOR_TARGET_CONTRACT.methods)) {
      const method = declaration.members?.find((entry) => entry.kind === 'method' && entry.name === name);
      assert.equal(method?.return?.type?.text, contract.returnType, `${tag}.${name} return`);
    }
    const eventNames = new Set((declaration.events ?? []).map((entry) => entry.name));
    assert.ok(eventNames.has('lr-anchor-result'), `${tag}#lr-anchor-result`);
  }

  for (const [tag, event] of [
    ['lr-archive-viewer', 'lr-highlight-activate'],
    ['lr-av-player', 'lr-text-select'],
    ['lr-calendar-viewer', 'lr-highlight-activate'],
    ['lr-contact-viewer', 'lr-highlight-activate'],
    ['lr-csv-viewer', 'lr-text-select'],
    ['lr-dataset-viewer', 'lr-text-select'],
    ['lr-email-viewer', 'lr-highlight-activate'],
    ['lr-geojson-view', 'lr-highlight-activate'],
    ['lr-html-viewer', 'lr-highlight-activate'],
    ['lr-image-viewer', 'lr-text-select'],
    ['lr-include', 'lr-highlight-activate'],
    ['lr-notebook-viewer', 'lr-highlight-activate'],
    ['lr-notebook-viewer', 'lr-text-select'],
    ['lr-pptx-viewer', 'lr-highlight-activate'],
    ['lr-spreadsheet-viewer', 'lr-text-select'],
    ['lr-svg-viewer', 'lr-text-select'],
    ['lr-xml-viewer', 'lr-text-select'],
  ]) {
    const declaration = declarations.get(tag);
    assert.ok(
      !(declaration.events ?? []).some((entry) => entry.name === event),
      `${tag} must not advertise non-emitted ${event}`,
    );
  }

  for (const [tag, event] of [
    ['lr-docx-viewer', 'lr-highlight-activate'],
    ['lr-docx-viewer', 'lr-text-select'],
    ['lr-ebook-viewer', 'lr-highlight-activate'],
    ['lr-ebook-viewer', 'lr-text-select'],
    ['lr-markdown', 'lr-highlight-activate'],
    ['lr-markdown', 'lr-text-select'],
    ['lr-markdown-core', 'lr-highlight-activate'],
    ['lr-markdown-core', 'lr-text-select'],
    ['lr-pdf-viewer', 'lr-highlight-activate'],
    ['lr-pdf-viewer', 'lr-text-select'],
  ]) {
    const declaration = declarations.get(tag);
    assert.ok(
      (declaration.events ?? []).some((entry) => entry.name === event),
      `${tag} preserves emitted ${event}`,
    );
  }

  const radio = declarations.get('lr-radio');
  const radioButton = declarations.get('lr-radio-button');
  for (const collection of ['members', 'attributes', 'events']) {
    const identity = (entry) => collection === 'members' ? `${entry.kind}:${entry.name}` : entry.name;
    const buttonSurface = new Map((radioButton[collection] ?? []).map((entry) => [identity(entry), entry]));
    const metadata = (entry) => {
      if (collection === 'members') {
        return {
          kind: entry.kind,
          type: entry.type?.text,
          hasDefault: Object.hasOwn(entry, 'default'),
          default: entry.default,
          hasAttribute: Object.hasOwn(entry, 'attribute'),
          attribute: entry.attribute,
          reflects: entry.reflects,
          readonly: entry.readonly,
          returnType: entry.return?.type?.text,
          parameters: entry.parameters?.map((parameter) => ({
            name: parameter.name,
            type: parameter.type?.text,
            default: parameter.default,
            rest: parameter.rest,
          })),
        };
      }
      if (collection === 'attributes') {
        return {
          type: entry.type?.text,
          hasDefault: Object.hasOwn(entry, 'default'),
          default: entry.default,
          fieldName: entry.fieldName,
        };
      }
      return { type: entry.type?.text };
    };
    for (const entry of radio[collection] ?? []) {
      const buttonEntry = buttonSurface.get(identity(entry));
      assert.ok(buttonEntry, `lr-radio-button ${collection} includes ${identity(entry)}`);
      assert.deepEqual(
        metadata(buttonEntry),
        metadata(entry),
        `lr-radio-button ${collection} preserves effective ${identity(entry)} metadata`,
      );
    }
  }

  const contextInspector = declarations.get('lr-context-inspector');
  for (const name of ['lr-error', 'lr-copy-error', 'lr-export-error', 'lr-show', 'lr-hide']) {
    assert.ok(contextInspector.events?.some((event) => event.name === name), `lr-context-inspector#${name}`);
  }

  const contextualCssDefaults = new Set(['lr-source-picker:--lr-source-picker-checked-bg']);
  for (const module of (liveManifest.modules ?? []).filter(({ path }) => path?.includes('/retrieval/'))) {
    for (const declaration of module.declarations ?? []) {
      if (!declaration.tagName) continue;
      for (const member of declaration.members ?? []) {
        if (member.inheritedFrom || member.static || ['private', 'protected'].includes(member.privacy)) continue;
        assert.ok(member.description?.trim(), `${declaration.tagName}.${member.name} source description`);
      }
      for (const property of declaration.cssProperties ?? []) {
        assert.ok(property.description?.trim(), `${declaration.tagName}.${property.name} CSS description`);
        if (!contextualCssDefaults.has(`${declaration.tagName}:${property.name}`)) {
          assert.ok(Object.hasOwn(property, 'default'), `${declaration.tagName}.${property.name} CSS default`);
        }
      }
    }
  }

  for (const [tag, names] of [
    ['lr-chat-message', ['status']],
    ['lr-map', ['center', 'zoom', 'mapStyle', 'legend', 'choropleth', 'markers']],
    ['lr-qr-code', ['generate']],
  ]) {
    const declaration = declarations.get(tag);
    for (const name of names) {
      const member = declaration?.members?.find((entry) => entry.name === name);
      assert.ok(member?.description?.trim(), `${tag}.${name} source description`);
    }
  }
});

test('authored docs enumerate the effective context-inspector and radio-button contracts', () => {
  const agentTools = fs.readFileSync(path.join(packageDir, 'llms', 'agent-tools.md'), 'utf8');
  const contextSection = agentTools.slice(
    agentTools.indexOf('## `lr-context-inspector`'),
    agentTools.indexOf('## `lr-eval-dataset`'),
  );
  for (const event of [
    'lr-error',
    'lr-copy-error',
    'lr-export-error',
    'lr-show',
    'lr-hide',
  ]) {
    assert.match(contextSection, new RegExp(`\\b${event}\\b`, 'u'), `context-inspector docs include ${event}`);
  }

  const forms = fs.readFileSync(path.join(packageDir, 'llms', 'forms.md'), 'utf8');
  const radioButtonSection = forms.slice(
    forms.indexOf('## `lr-radio-button`'),
    forms.indexOf('## `lr-otp-input`'),
  );
  for (const member of [
    'effectiveDisabled',
    'effectiveRequired',
    'form',
    'labels',
    'validity',
    'validationMessage',
    'willValidate',
    'getForm()',
    'checkValidity()',
    'reportValidity()',
    'setCustomValidity()',
    'resetValidity()',
  ]) {
    assert.ok(radioButtonSection.includes(member), `radio-button docs include ${member}`);
  }
});

test('direct Lyra nonprivate fields and methods remain normalized even when descriptions are blank', () => {
  const declaration = {
    kind: 'class',
    customElement: true,
    tagName: 'lr-example',
    members: [
      { kind: 'field', name: 'published', type: { text: 'string' }, default: "''" },
      { kind: 'field', name: '_underscoredButPublic', type: { text: 'string' }, default: "''" },
      { kind: 'field', name: 'privateState', privacy: 'private', type: { text: 'string' } },
      { kind: 'method', name: 'onActivate', return: { type: { text: 'void' } } },
      { kind: 'method', name: 'formResetCallback', return: { type: { text: 'void' } } },
      { kind: 'method', name: 'render', return: { type: { text: 'unknown' } } },
      { kind: 'method', name: 'privateHook', privacy: 'private', return: { type: { text: 'void' } } },
    ],
  };
  const surface = normalizeDeclaration(declaration, { ecosystem: 'lyra' });
  assert.deepEqual(surface.properties.map(({ name }) => name), ['_underscoredButPublic', 'published']);
  assert.ok(surface.properties.every(({ name }) => name !== 'privateState'));
  assert.deepEqual(surface.methods.map(({ name }) => name), ['formResetCallback', 'onActivate', 'render']);
});

test('mapped comparison gates attribute ownership, reflection, CSS defaults, and deprecations', () => {
  const base = {
    properties: [], slots: [], events: [], cssStates: [], methods: [],
    form: { associated: false, properties: [], methods: [] },
    native: { forwardedEvents: [], delegatedMethods: [] },
  };
  const upstream = {
    ...base,
    attributes: [{ name: 'value', property: 'value', type: 'string', reflects: false, hasDefault: false }],
    parts: [{ name: 'base', deprecated: 'Deprecated. Use the `control` part.' }],
    cssProperties: [{ name: '--gap', deprecated: null, hasDefault: true, default: '1rem' }],
  };
  const target = {
    ...base,
    attributes: [{ name: 'value', property: 'defaultValue', type: 'string', reflects: true, hasDefault: false }],
    parts: [{ name: 'base', deprecated: null }],
    cssProperties: [{ name: '--gap', deprecated: null, hasDefault: true, default: '16px' }],
  };
  const mismatch = compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-' });
  assert.deepEqual(mismatch.map(({ code }) => code).sort(), [
    'attribute-property-mismatch',
    'css-default-mismatch',
    'deprecation-mismatch',
    'reflection-mismatch',
  ]);

  const normalizations = emptyNormalizations();
  normalizations.attributePropertyEquivalences.push({
    attribute: 'value', upstream: 'value', target: 'defaultValue',
  });
  normalizations.reflectionEquivalences.push({
    memberKind: 'attribute', member: 'value', upstream: false, target: true,
  });
  normalizations.cssDefaultEquivalences.push({
    member: '--gap',
    upstreamHasDefault: true,
    upstream: '1rem',
    targetHasDefault: true,
    target: '16px',
  });
  normalizations.deprecationEquivalences.push({
    section: 'parts',
    member: 'base',
    upstreamDeprecated: true,
    upstreamReplacement: 'control',
    targetDeprecated: false,
    targetReplacement: null,
  });
  assert.deepEqual(
    compareMappedSurfaces(upstream, target, { upstreamPrefix: 'wa-', normalizations }),
    [],
  );
  assert.deepEqual(
    validateMappingNormalizations(
      { upstreamTag: 'wa-example', rewrites: emptyRewrites(), normalizations },
      { upstream, target },
    ),
    [],
  );

  const targetOnlyDefault = structuredClone(upstream);
  delete targetOnlyDefault.cssProperties[0].default;
  targetOnlyDefault.cssProperties[0].hasDefault = false;
  const additiveDefaultTarget = structuredClone(targetOnlyDefault);
  additiveDefaultTarget.cssProperties[0].hasDefault = true;
  additiveDefaultTarget.cssProperties[0].default = null;
  assert.deepEqual(
    compareMappedSurfaces(targetOnlyDefault, additiveDefaultTarget, { upstreamPrefix: 'wa-' })
      .filter(({ code }) => code === 'css-default-mismatch'),
    [{
      code: 'css-default-mismatch',
      section: 'cssProperties',
      member: '--gap',
      expectedHasDefault: false,
      expected: null,
      actualHasDefault: true,
      actual: null,
    }],
    'an explicit null target default remains distinct from an absent upstream default',
  );
  const presenceNormalization = emptyNormalizations();
  presenceNormalization.cssDefaultEquivalences.push({
    member: '--gap',
    upstreamHasDefault: false,
    targetHasDefault: true,
    target: null,
  });
  assert.deepEqual(
    compareMappedSurfaces(targetOnlyDefault, additiveDefaultTarget, {
      upstreamPrefix: 'wa-',
      normalizations: presenceNormalization,
    }),
    [],
  );
  assert.deepEqual(
    validateMappingNormalizations(
      { upstreamTag: 'wa-example', rewrites: emptyRewrites(), normalizations: presenceNormalization },
      { upstream: targetOnlyDefault, target: additiveDefaultTarget },
    ),
    [],
  );

  const generic = structuredClone(upstream);
  generic.parts[0].deprecated = 'Deprecated. Use the part named after the component.';
  const genericDrift = compareMappedSurfaces(generic, target, { upstreamPrefix: 'wa-' });
  assert.equal(genericDrift.find(({ section }) => section === 'parts').expected, true);

  const inventedReplacement = structuredClone(generic);
  inventedReplacement.parts[0].deprecated = 'Deprecated. Use `other`.';
  assert.deepEqual(
    compareMappedSurfaces(generic, inventedReplacement, { upstreamPrefix: 'wa-' })
      .filter(({ section }) => section === 'parts'),
    [{
      code: 'deprecation-replacement-mismatch',
      section: 'parts',
      member: 'base',
      expected: true,
      actual: 'other',
    }],
    'a target replacement cannot be invented when the upstream deprecation names none',
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
      ...emptyNormalizations(),
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

  const unsafeAnyType = structuredClone(mapping);
  unsafeAnyType.normalizations.typeEquivalences[0].target = 'any';
  const unsafeAnyTarget = structuredClone(target);
  unsafeAnyTarget.attributes[0].type = 'any';
  assert.ok(
    validateMappingNormalizations(unsafeAnyType, { upstream, target: unsafeAnyTarget }).some((finding) =>
      finding.includes('unsafe any type normalization attribute:size'),
    ),
    'a reviewed equivalence cannot name the TypeScript any keyword on either side',
  );

  const literalAnyType = structuredClone(mapping);
  const literalAnyUpstream = structuredClone(upstream);
  literalAnyUpstream.attributes[0].type = "'any' | 'small'";
  literalAnyType.normalizations.typeEquivalences[0].upstream = literalAnyUpstream.attributes[0].type;
  assert.ok(
    validateMappingNormalizations(literalAnyType, { upstream: literalAnyUpstream, target })
      .every((finding) => !finding.includes('unsafe any type normalization')),
    'the string-literal member `any` is not the TypeScript any keyword',
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

test('Random Content migration metadata names every behavior that requires manual review', () => {
  const parity = migrationParityMetadata({
    upstream: {
      tag: 'wa-random-content',
      review: { status: 'complete' },
      surface: { slots: [{ name: '' }] },
    },
    target: {
      tag: 'lr-random-content',
      rootIncluded: true,
      optionalPeers: [],
    },
    classification: 'warning-required',
  });

  assert.deepEqual(parity, {
    staticApi: 'reviewed',
    lightDom: 'warning-required',
    runtime: {
      registration: 'all',
      optionalPeers: [],
    },
    accessibility: reviewedAccessibilityMetadata('wa-random-content', 'lr-random-content'),
    behaviorReviewFlags: [
      'light-dom-candidate-model',
      'selection-semantics',
      'reduced-motion-autoplay',
      'visible-pause-control',
    ],
  });

  const decision = reviewedMigrationDecision('wa-random-content');
  assert.equal(decision.classification, 'warning-required');
  assert.match(decision.rationale, /reduced-motion autoplay/i);
  assert.match(decision.rationale, /visible pause\/resume control/i);
});

test('Zoomable Frame migration metadata requires review of sandbox and URL safety behavior', () => {
  const parity = migrationParityMetadata({
    upstream: {
      tag: 'wa-zoomable-frame',
      review: { status: 'complete' },
      surface: { slots: [{ name: '' }] },
    },
    target: {
      tag: 'lr-zoomable-frame',
      rootIncluded: true,
      optionalPeers: [],
    },
    classification: 'warning-required',
  });

  assert.deepEqual(parity.behaviorReviewFlags, ['sandbox-and-url-safety']);

  assert.deepEqual(reviewedMigrationDecision('wa-zoomable-frame'), {
    classification: 'warning-required',
    rationale:
      'Lyra always renders a sandbox with an `allow-same-origin` default, rejects active and non-embeddable URL schemes, and drops `allow-same-origin` when paired with `allow-scripts`; migration leaves the use unchanged and reports the security-sensitive difference.',
    expectedDrift: [],
  });
});

test('checked-in inventory covers every pinned tag and every Lyra declaration', () => {
  const inventory = readJson('scripts', 'fixtures', 'component-inventory.json');
  const upstreamTags = readJson('scripts', 'fixtures', 'upstream-tags.json');
  const manifest = expandLyraInventoryManifest(readJson('custom-elements.json'));
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
  assert.deepEqual(inventory.accessibilityProfiles, accessibilityProfileCatalog());

  for (const mapping of inventory.mappings) {
    assert.match(mapping.classification, /^(exact|rewritten|warning-required|conceptual-only|unsupported)$/);
    if (mapping.classification === 'exact') assert.equal(mapping.rationale, null);
    else assert.ok(mapping.rationale?.trim(), `${mapping.upstreamTag} must explain its non-exact classification`);
    assert.equal(mapping.parity.accessibility.reviewStatus, 'complete');
    assert.match(mapping.parity.accessibility.rationale, /\S/);
    assert.ok(inventory.accessibilityProfiles[mapping.parity.accessibility.upstreamProfile]);
    assert.ok(inventory.accessibilityProfiles[mapping.parity.accessibility.targetProfile]);
    assert.deepEqual(
      mapping.parity.accessibility.comparison,
      compareAccessibilityProfiles(
        inventory.accessibilityProfiles,
        mapping.parity.accessibility.upstreamProfile,
        mapping.parity.accessibility.targetProfile,
      ),
      `${mapping.upstreamTag} must store a current accessibility comparison`,
    );
  }
  // `sl-include`/`wa-include` keep their warning permanently: Lyra sanitizes the fetched document,
  // never grants `allow-scripts`, and defaults `mode` to `same-origin` rather than `cors`. Those are
  // deliberate refusals to migrate a use that would lose a security guarantee, not unfinished work.
  for (const tag of ['sl-include', 'wa-include']) {
    assert.equal(
      inventory.mappings.find(({ upstreamTag }) => upstreamTag === tag)?.classification,
      'warning-required',
      `${tag} must keep its explicit security warning`,
    );
  }
  // The button/breadcrumb-item pair used to sit alongside them, because Lyra exposed `rel` as a
  // read-only `target`-derived getter and so silently dropped an authored `nofollow`/`me`/`license`.
  // 9.0.0 made `rel` settable while keeping the guarantee non-negotiable -- author tokens are merged,
  // `opener` is always stripped, and `noopener noreferrer` is force-added whenever `target` is set --
  // so there is no longer a difference to warn about. The security floor is asserted directly on the
  // components (button.test.ts, breadcrumb-item.test.ts); what is pinned here is that the mapping
  // stopped needing a warning, since the whole point was unblocking the codemod for the library's
  // most-used tag.
  for (const tag of ['sl-breadcrumb-item', 'wa-breadcrumb-item', 'sl-button', 'wa-button']) {
    const classification = inventory.mappings.find(
      ({ upstreamTag }) => upstreamTag === tag,
    )?.classification;
    assert.ok(
      classification === 'exact' || classification === 'rewritten',
      `${tag} must migrate mechanically now that rel is settable-but-guarded (got ${classification})`,
    );
  }
});

test('inventory accessibility validation fails closed on missing reviews, unknown behavior, and stale comparison', () => {
  const inventory = structuredClone(readJson('scripts', 'fixtures', 'component-inventory.json'));
  const upstreamTags = readJson('scripts', 'fixtures', 'upstream-tags.json');
  const manifest = expandLyraInventoryManifest(readJson('custom-elements.json'));
  const [missingReview, unknownBehavior, staleComparison, automaticGap] = inventory.mappings;

  delete missingReview.parity.accessibility;
  inventory.accessibilityProfiles[unknownBehavior.parity.accessibility.targetProfile].keyboard.push('invented-key-contract');
  staleComparison.parity.accessibility.comparison.status = 'target-additive';
  automaticGap.parity.accessibility.targetProfile = 'no-tag-owned-behavior';
  automaticGap.parity.accessibility.comparison = compareAccessibilityProfiles(
    inventory.accessibilityProfiles,
    automaticGap.parity.accessibility.upstreamProfile,
    automaticGap.parity.accessibility.targetProfile,
  );

  const findings = validateInventory(inventory, { upstreamTags, lyraManifest: manifest });
  assert.ok(findings.some((finding) => finding.includes('missing accessibility parity review')));
  assert.ok(findings.some((finding) => finding.includes('unknown keyboard behavior invented-key-contract')));
  assert.ok(findings.some((finding) => finding.includes('stored accessibility comparison is stale')));
  assert.ok(findings.some((finding) => finding.includes('automatic mapping has missing accessibility behavior')));
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
