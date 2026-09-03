import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
import { generateManifest } from './generate-manifest.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const plugin = cemConfig.plugins.find(({ name }) => name === 'lr-accessor-write-types');
const runtimePlugin = cemConfig.plugins.find(({ name }) => name === 'lr-accessor-runtime-contracts');

async function generateManifestFromIsolatedCaller() {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'lyra-manifest-caller-'));
  const callerPackage = path.join(scratch, 'package.json');
  const sentinel = `${JSON.stringify({
    private: true,
    customElements: 'sentinel/custom-elements.json',
  }, null, 2)}\n`;
  const originalCwd = process.cwd();
  writeFileSync(callerPackage, sentinel);
  try {
    process.chdir(scratch);
    const result = await generateManifest({ write: false });
    assert.equal(
      readFileSync(callerPackage, 'utf8'),
      sentinel,
      'no-write manifest generation must not rewrite the caller package.json',
    );
    return result;
  } finally {
    process.chdir(originalCwd);
    rmSync(scratch, { recursive: true, force: true });
  }
}

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
        attributes: Object.entries(contract).flatMap(([name, metadata]) =>
          metadata.attribute === false
            ? []
            : [{ name, fieldName: name, type: { text: metadata.readType } }],
        ),
      })),
    }],
  };
}

const EXPECTED_VALUES = {
  'lr-breadcrumb-item': { href: undefined },
  'lr-icon': { name: undefined, src: undefined },
  'lr-icon-button': { name: undefined },
  'lr-filter-bar': {},
  'lr-input': {},
  'lr-split-panel': { snap: undefined },
  'lr-textarea': {},
};

const EXPECTED_BUCKET_B_WRITE_TYPES = {
  'lr-breadcrumb-item': { href: 'string | undefined' },
  'lr-icon': { name: 'string | undefined', src: 'string | undefined' },
  'lr-icon-button': { name: 'string | undefined' },
  'lr-split-panel': { snap: 'string | LyraSplitPanelSnapFunction | undefined' },
};

const EXPECTED_BUCKET_B_RUNTIME_DEFAULTS = {
  'lr-breadcrumb-item': { href: "''" },
  'lr-icon': { name: "''", src: "''" },
  'lr-icon-button': { name: "''" },
  'lr-random-content': { mode: "'unique'" },
  'lr-split-panel': { snap: "''" },
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
      assert.equal(member.lyraReadType.text, ACCESSOR_WRITE_TYPE_CONTRACTS.get(declaration.tagName)[name].readType);
      if (attribute) {
        assert.equal(attribute.type.text, writeType);
        assert.deepEqual(htmlDataValues(attribute.type.text, aliases)?.map(({ name: value }) => value), expected);
        assert.deepEqual(webTypesValue(attribute.type.text, aliases)?.type.map(unquote), expected);
      }
    }
  }
});

test('CEM projects property-only FilterBar write unions without inventing attributes', () => {
  const manifest = syntheticManifest();
  plugin.packageLinkPhase({ customElementsManifest: manifest });
  const declaration = manifest.modules[0].declarations.find(
    ({ tagName }) => tagName === 'lr-filter-bar',
  );

  assert.deepEqual(ACCESSOR_WRITE_TYPE_CONTRACTS.get('lr-filter-bar'), {
    filters: {
      readType: 'readonly LyraFilterBarFilterDefinition[]',
      writeType: 'readonly LyraFilterBarFilterDefinition[] | null | undefined',
      attribute: false,
    },
    value: {
      readType: 'LyraFilterBarValue',
      writeType: 'LyraFilterBarValue | null | undefined',
      attribute: false,
    },
  });
  assert.equal(declaration.attributes.length, 0);
  assert.equal(
    declaration.members.find(({ name }) => name === 'filters').lyraReadType.text,
    'readonly LyraFilterBarFilterDefinition[]',
  );
  assert.equal(
    declaration.members.find(({ name }) => name === 'value').lyraReadType.text,
    'LyraFilterBarValue',
  );
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
  drifted.modules[0].declarations[0].members[0].type.text = 'number';
  assert.throws(
    () => plugin.packageLinkPhase({ customElementsManifest: drifted }),
    /must be canonical string before write projection/,
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

test('multiline Extract matches equivalent string literals without opening opaque operands', () => {
  const registry = {
    aliases: new Map([
      ['Appearance', "'accent' | 'filled' | 'outlined' | 'filled-outlined' | 'plain'"],
    ]),
    ambiguous: new Set(),
  };
  const multilineExtract = `Extract<
    Appearance,
    "filled" | "outlined" | "filled-outlined"
  >`;

  assert.equal(
    expandTypeText(multilineExtract, registry),
    "'filled' | 'outlined' | 'filled-outlined'",
  );
  assert.deepEqual(
    htmlDataValues(multilineExtract, registry)?.map(({ name }) => name),
    ['filled', 'outlined', 'filled-outlined'],
  );
  assert.deepEqual(webTypesValue(multilineExtract, registry), {
    type: ["'filled'", "'outlined'", "'filled-outlined'"],
  });
  assert.equal(expandTypeText('Extract<string, "filled">', registry), undefined);
  assert.equal(
    expandTypeText('Extract<Appearance | { custom: string }, "filled">', registry),
    undefined,
  );
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

test('fresh no-write CEM retains reviewed runtime and public-document subclass contracts', async () => {
  const { manifest } = await generateManifestFromIsolatedCaller();
  const declarations = manifest.modules.flatMap((module) => module.declarations ?? []);
  const declaration = (tagName) => declarations.find((candidate) => candidate.tagName === tagName);
  const member = (tagName, name, kind = 'field') => declaration(tagName)?.members?.find(
    (candidate) => candidate.kind === kind && candidate.name === name,
  );
  const attribute = (tagName, name) => declaration(tagName)?.attributes?.find(
    (candidate) => candidate.name === name,
  );

  for (const tagName of ['lr-checkbox', 'lr-radio-group', 'lr-select', 'lr-slider', 'lr-switch']) {
    assert.equal(member(tagName, 'form')?.reflects, true, `${tagName}.form reflects`);
  }
  const formOwners = declarations.filter((candidate) =>
    candidate.members?.some((entry) => entry.kind === 'field' && entry.name === 'form'),
  );
  assert.ok(formOwners.length > 0, 'the package has form-owner declarations to govern');
  for (const owner of formOwners) {
    const form = owner.members.find((entry) => entry.kind === 'field' && entry.name === 'form');
    const formAttribute = owner.attributes?.find((entry) => entry.name === 'form');
    assert.equal(form.type?.text, 'HTMLFormElement | string | null', `${owner.tagName}.form write type`);
    assert.equal(form.lyraReadType?.text, 'HTMLFormElement | null', `${owner.tagName}.form read type`);
    assert.equal(formAttribute?.type?.text, 'HTMLFormElement | string | null', `${owner.tagName}[form] type`);
    assert.equal(formAttribute?.fieldName, 'form', `${owner.tagName}[form] field link`);
  }
  for (const tagName of ['lr-checkbox', 'lr-switch']) {
    assert.equal(member(tagName, 'defaultChecked')?.default, 'false', `${tagName}.defaultChecked default`);
  }
  assert.equal(member('lr-radio-group', 'defaultValue')?.default, "''");
  assert.equal(attribute('lr-select', 'value')?.default, "''");

  assert.equal(member('lr-dropdown', 'placement')?.default, "'bottom-start'");
  assert.equal(member('lr-dropdown', 'distance')?.default, '0');
  for (const [tagName, type] of [
    ['lr-bar-chart', 'bar'],
    ['lr-bubble-chart', 'bubble'],
    ['lr-doughnut-chart', 'doughnut'],
    ['lr-line-chart', 'line'],
    ['lr-pie-chart', 'pie'],
    ['lr-polar-area-chart', 'polarArea'],
    ['lr-radar-chart', 'radar'],
    ['lr-scatter-chart', 'scatter'],
  ]) {
    assert.equal(member(tagName, 'type')?.default, `'${type}'`, `${tagName}.type default`);
  }
  assert.equal(member('lr-chart', 'plugins')?.default, '[]', 'lr-chart.plugins default');
  assert.equal(attribute('lr-chart', 'plugins')?.default, '[]', 'lr-chart[plugins] default');
  for (const [tagName, name, type, expected] of [
    ['lr-badge', 'variant', 'BadgeVariant', ['neutral', 'brand', 'success', 'warning', 'danger', 'primary']],
    ['lr-badge', 'size', 'BadgeSize', ['2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large']],
    ['lr-tag', 'variant', 'TagVariant', ['neutral', 'brand', 'success', 'warning', 'danger', 'primary', 'text']],
    ['lr-rating', 'size', 'LyraRatingSize', ['2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large']],
    ['lr-toast-item', 'size', 'LyraToastSize', ['2xs', 'xs', 's', 'm', 'l', 'xl', 'small', 'medium', 'large']],
  ]) {
    assert.equal(member(tagName, name)?.type?.text, type, `${tagName}.${name} raw public type`);
    assert.equal(attribute(tagName, name)?.type?.text, type, `${tagName}[${name}] raw attribute type`);
    assert.deepEqual(
      htmlDataValues(type, readTypeAliases(path.join(packageDir, 'src')))?.map(({ name: value }) => value),
      expected,
      `${tagName}.${name} editor values`,
    );
  }
  assert.equal(member('lr-option', 'disabled')?.reflects, true);
  assert.equal(member('lr-dropdown-item', 'submenuOpen')?.reflects, true);
  assert.equal(member('lr-dropdown-item', 'submenuOpen')?.default, 'false');
  assert.equal(member('lr-number-input', 'inputMode')?.default, "'numeric'");
  assert.equal(member('lr-number-input', 'step')?.default, '1');

  const drawerHide = declaration('lr-drawer')?.events?.find(({ name }) => name === 'lr-hide');
  assert.equal(drawerHide?.type?.text, 'CustomEvent<LyraDialogHideDetail>');
  assert.match(drawerHide?.description ?? '', /\bCancelable\b/);
  assert.doesNotMatch(drawerHide?.description ?? '', /non[- ]?cancelable/i);

  for (const tagName of ['lr-combobox', 'lr-file-input']) {
    const restore = member(tagName, 'formStateRestoreCallback', 'method');
    assert.equal(restore?.parameters?.[1]?.name, 'reason', `${tagName} restore reason name`);
    assert.equal(restore?.parameters?.[1]?.optional, undefined, `${tagName} restore reason is required`);
    assert.equal(
      restore?.parameters?.[1]?.type?.text.replaceAll('"', "'"),
      "'autocomplete' | 'restore'",
    );
  }
  for (const [tagName, name] of [['lr-data-grid', 'selectedRows']]) {
    const projectedMember = member(tagName, name);
    assert.ok(projectedMember, `${tagName}.${name} is public`);
    assert.notEqual(projectedMember.readonly, true, `${tagName}.${name} is writable`);
  }
  for (const [tagName, name] of [
    ['lr-file-input', 'dragging'],
    ['lr-file-input', 'fileCount'],
  ]) {
    const projectedMember = member(tagName, name);
    assert.ok(projectedMember, `${tagName}.${name} is public`);
    assert.equal(projectedMember.readonly, true, `${tagName}.${name} is readonly`);
  }
  assert.equal(member('lr-split-panel', 'snap')?.reflects, true);
  assert.ok(
    declaration('lr-image-comparer')?.events?.some(({ name }) => name === 'change'),
    'lr-image-comparer publishes native change',
  );
  assert.equal(attribute('lr-video', 'currentTime')?.fieldName, 'currentTime');
});
