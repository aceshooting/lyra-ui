import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import cemConfig, {
  ACCESSOR_RUNTIME_CONTRACTS,
  ACCESSOR_WRITE_TYPE_CONTRACTS,
} from '../custom-elements-manifest.config.js';
import {
  expandTypeText,
  htmlDataValues,
  readTypeAliases,
  webTypesValue,
} from './editor-type-values.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = cemConfig.plugins.find(({ name }) => name === 'lr-accessor-write-types');
const runtimePlugin = cemConfig.plugins.find(({ name }) => name === 'lr-accessor-runtime-contracts');

function syntheticManifest() {
  return {
    modules: [{
      path: 'src/components/synthetic.ts',
      declarations: [...ACCESSOR_WRITE_TYPE_CONTRACTS].map(([tagName, contract]) => ({
        kind: 'class',
        name: `Synthetic${tagName}`,
        customElement: true,
        tagName,
        members: Object.entries(contract).map(([name, metadata]) => ({
          kind: 'field',
          name,
          attribute: name,
          type: { text: metadata.readType },
        })),
        attributes: Object.entries(contract).map(([name, metadata]) => ({
          name,
          fieldName: name,
          type: { text: metadata.readType },
        })),
      })),
    }],
  };
}

const EXPECTED_VALUES = {
  'lr-badge': {
    variant: ['neutral', 'brand', 'success', 'warning', 'danger', 'primary'],
    size: ['2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large'],
  },
  'lr-tag': {
    variant: ['neutral', 'brand', 'success', 'warning', 'danger', 'primary', 'text'],
    size: ['2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large'],
  },
  'lr-rating': {
    size: ['2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large'],
  },
  'lr-toast-item': {
    size: ['2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large'],
  },
  'lr-breadcrumb-item': { href: undefined },
  'lr-icon': { name: undefined, src: undefined },
  'lr-icon-button': { name: undefined },
  'lr-input': {},
  'lr-split-panel': { snap: undefined },
  'lr-textarea': {},
};

const EXPECTED_BUCKET_B_WRITE_TYPES = {
  'lr-breadcrumb-item': { href: 'string | undefined' },
  'lr-icon': { name: 'string | undefined', src: 'string | undefined' },
  'lr-icon-button': { name: 'string | undefined' },
  'lr-split-panel': { snap: 'string | SnapFunction | undefined' },
};

const EXPECTED_BUCKET_B_RUNTIME_DEFAULTS = {
  'lr-badge': { size: "'m'", variant: "'neutral'" },
  'lr-breadcrumb-item': { href: "''" },
  'lr-icon': { name: "''", src: "''" },
  'lr-icon-button': { name: "''" },
  'lr-rating': { size: "'m'" },
  'lr-split-panel': { snap: "''" },
  'lr-tag': { size: "'m'", variant: "'neutral'" },
  'lr-toast-item': { size: "'m'" },
};

function syntheticRuntimeManifest() {
  return {
    modules: [{
      path: 'src/components/synthetic.ts',
      declarations: Object.keys(EXPECTED_BUCKET_B_RUNTIME_DEFAULTS).map((tagName) => {
        const contract = ACCESSOR_RUNTIME_CONTRACTS.get(tagName);
        return {
          kind: 'class',
          name: `Synthetic${tagName}`,
          customElement: true,
          tagName,
          members: Object.entries(contract).map(([name, metadata]) => ({
            kind: 'field',
            name,
            ...(metadata.attribute ? { attribute: metadata.attribute } : {}),
            type: { text: 'unknown' },
          })),
          attributes: Object.entries(contract).flatMap(([name, metadata]) =>
            metadata.attribute
              ? [{ name: metadata.attribute, fieldName: name, type: { text: 'unknown' } }]
              : [],
          ),
        };
      }),
    }],
  };
}

function unquote(member) {
  return /^(['"]).*\1$/.test(member) ? member.slice(1, -1) : member;
}

test('CEM projects exact asymmetric write unions and both editor formats expand every value', () => {
  assert.ok(plugin?.packageLinkPhase, 'the accessor write-type projection plugin is installed');
  const manifest = syntheticManifest();
  plugin.packageLinkPhase({ customElementsManifest: manifest });
  const once = structuredClone(manifest);
  plugin.packageLinkPhase({ customElementsManifest: manifest });
  assert.deepEqual(manifest, once, 'the projection is idempotent');

  const aliases = readTypeAliases(path.join(packageDir, 'src'));
  for (const declaration of manifest.modules[0].declarations) {
    for (const [name, expected] of Object.entries(EXPECTED_VALUES[declaration.tagName])) {
      const member = declaration.members.find((candidate) => candidate.name === name);
      const attribute = declaration.attributes.find((candidate) => candidate.name === name);
      const writeType = ACCESSOR_WRITE_TYPE_CONTRACTS.get(declaration.tagName)[name].writeType;
      assert.equal(member.type.text, writeType);
      assert.equal(attribute.type.text, writeType);
      assert.deepEqual(htmlDataValues(attribute.type.text, aliases)?.map(({ name: value }) => value), expected);
      assert.deepEqual(webTypesValue(attribute.type.text, aliases)?.type.map(unquote), expected);
    }
  }
});

test('CEM projects the exact optional write surfaces for accessor-backed string and callback APIs', () => {
  const manifest = syntheticManifest();
  plugin.packageLinkPhase({ customElementsManifest: manifest });

  for (const [tagName, members] of Object.entries(EXPECTED_BUCKET_B_WRITE_TYPES)) {
    const declaration = manifest.modules[0].declarations.find((candidate) => candidate.tagName === tagName);
    for (const [name, expectedWriteType] of Object.entries(members)) {
      assert.equal(ACCESSOR_WRITE_TYPE_CONTRACTS.get(tagName)[name].writeType, expectedWriteType);
      assert.equal(declaration.members.find((candidate) => candidate.name === name).type.text, expectedWriteType);
      assert.equal(declaration.attributes.find((candidate) => candidate.name === name).type.text, expectedWriteType);
    }
  }
});

test('CEM projects exact runtime defaults for accessor-backed parity surfaces', () => {
  assert.ok(runtimePlugin?.packageLinkPhase, 'the accessor runtime projection plugin is installed');
  const manifest = syntheticRuntimeManifest();
  runtimePlugin.packageLinkPhase({ customElementsManifest: manifest });
  const once = structuredClone(manifest);
  runtimePlugin.packageLinkPhase({ customElementsManifest: manifest });
  assert.deepEqual(manifest, once, 'the runtime projection is idempotent');

  for (const [tagName, members] of Object.entries(EXPECTED_BUCKET_B_RUNTIME_DEFAULTS)) {
    const declaration = manifest.modules[0].declarations.find((candidate) => candidate.tagName === tagName);
    for (const [name, expectedDefault] of Object.entries(members)) {
      const contract = ACCESSOR_RUNTIME_CONTRACTS.get(tagName)[name];
      assert.equal(contract.default, expectedDefault);
      assert.equal(declaration.members.find((candidate) => candidate.name === name).default, expectedDefault);
      assert.equal(
        declaration.attributes.find((candidate) => candidate.name === contract.attribute).default,
        expectedDefault,
      );
    }
  }
});

test('CEM projects both upstream autocorrect write vocabularies without inventing enum suggestions', () => {
  const manifest = syntheticManifest();
  plugin.packageLinkPhase({ customElementsManifest: manifest });

  for (const [tagName, writeType] of [
    ['lr-input', "boolean | 'off' | 'on'"],
    ['lr-textarea', 'boolean | string'],
  ]) {
    const declaration = manifest.modules[0].declarations.find((candidate) => candidate.tagName === tagName);
    const member = declaration.members.find((candidate) => candidate.name === 'autocorrect');
    const attribute = declaration.attributes.find((candidate) => candidate.name === 'autocorrect');
    assert.equal(member.type.text, writeType);
    assert.equal(attribute.type.text, writeType);
    assert.equal(htmlDataValues(attribute.type.text, { aliases: new Map(), ambiguous: new Set() }), undefined);
    assert.equal(webTypesValue(attribute.type.text, { aliases: new Map(), ambiguous: new Set() }), undefined);
  }
});

test('CEM projection fails closed when a configured member, attribute, or canonical type drifts', () => {
  const missing = syntheticManifest();
  missing.modules[0].declarations[0].attributes = [];
  assert.throws(
    () => plugin.packageLinkPhase({ customElementsManifest: missing }),
    /requires member and attribute metadata/,
  );

  const drifted = syntheticManifest();
  drifted.modules[0].declarations[0].members[0].type.text = 'string';
  assert.throws(
    () => plugin.packageLinkPhase({ customElementsManifest: drifted }),
    /must be canonical BadgeVariant before write projection/,
  );
});

test('recursive alias resolution rejects cycles, ambiguity, unknown members, and opaque syntax', () => {
  const registry = {
    aliases: new Map([
      ['Base', "'a' | 'b'"],
      ['Middle', 'Base'],
      ['Top', "Middle | 'c'"],
      ['CycleA', 'CycleB'],
      ['CycleB', 'CycleA'],
      ['Unknown', "Missing | 'guess'"],
      ['Ambiguous', "'first'"],
    ]),
    ambiguous: new Set(['Ambiguous']),
  };
  assert.equal(expandTypeText("Top | 'd'", registry), "'a' | 'b' | 'c' | 'd'");
  assert.equal(expandTypeText('CycleA', registry), undefined);
  assert.equal(expandTypeText('Ambiguous', registry), undefined);
  assert.equal(expandTypeText('Unknown', registry), undefined);
  assert.equal(expandTypeText("Array<'invented'>", registry), undefined);
  assert.equal(expandTypeText("'trailing' |", registry), undefined);
  assert.equal(htmlDataValues('CycleA', registry), undefined);
  assert.equal(webTypesValue("Unknown | 'guess'", registry), undefined);
});

test('source scanning marks conflicting or opaque duplicate alias declarations ambiguous', () => {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'lyra-editor-alias-'));
  try {
    mkdirSync(path.join(scratch, 'nested'));
    writeFileSync(
      path.join(scratch, 'a.ts'),
      [
        "export type Shared = 'a';",
        'export type Chain = Shared;',
        "export type SimpleFirst = 'suggested';",
        'export type OpaqueFirst = { actual: string };',
        '',
      ].join('\n'),
    );
    writeFileSync(
      path.join(scratch, 'nested', 'b.ts'),
      [
        "export type Shared = 'b';",
        'export type SimpleFirst = { actual: string };',
        "export type OpaqueFirst = 'suggested';",
        '',
      ].join('\n'),
    );
    const registry = readTypeAliases(scratch);
    assert.equal(registry.aliases.has('Shared'), false);
    assert.equal(registry.ambiguous.has('Shared'), true);
    assert.equal(expandTypeText('Chain', registry), undefined);
    for (const name of ['SimpleFirst', 'OpaqueFirst']) {
      assert.equal(registry.aliases.has(name), false);
      assert.equal(registry.ambiguous.has(name), true);
      assert.equal(htmlDataValues(name, registry), undefined);
      assert.deepEqual(webTypesValue(name, registry), { type: [name] });
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});
