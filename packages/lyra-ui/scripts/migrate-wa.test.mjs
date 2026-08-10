#!/usr/bin/env node

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  MIGRATION_REPORT_SCHEMA_VERSION,
  buildMigrationContract,
  collectFiles,
  createMigrationRuntimeInventory,
  migrateFiles,
  migrateText,
  parseArgs,
} from './migrate-wa.mjs';
import {
  analyzeMigrationCoverage,
  formatMigrationCoverageSummary,
} from './check-migration-coverage.mjs';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migratePath = path.join(scriptDir, 'migrate-wa.mjs');
const fixtureDir = path.join(scriptDir, 'fixtures', 'migrate-wa');
const inventory = JSON.parse(fs.readFileSync(path.join(fixtureDir, 'inventory.json'), 'utf8'));
const contract = buildMigrationContract(inventory);
const checkedInventory = JSON.parse(
  fs.readFileSync(path.join(scriptDir, 'fixtures', 'component-inventory.json'), 'utf8'),
);
const checkedUpstreamTags = JSON.parse(
  fs.readFileSync(path.join(scriptDir, 'fixtures', 'upstream-tags.json'), 'utf8'),
);
const extensions = ['html', 'js', 'ts', 'jsx', 'vue', 'svelte'];

function fixture(name) {
  return fs.readFileSync(path.join(fixtureDir, name), 'utf8');
}

function migrationCoverageFixture() {
  const coverageInventory = structuredClone(inventory);
  coverageInventory.upstreams.webawesome.version = '8.0.0-test';
  coverageInventory.upstreams.webawesome.commit = 'wa-test';
  coverageInventory.upstreams.shoelace.version = '2.0.0-test';
  coverageInventory.upstreams.shoelace.commit = 'sl-test';
  const upstreamTags = {
    webawesome: {
      version: '8.0.0-test',
      commit: 'wa-test',
      free: ['wa-widget', 'wa-data-grid', 'wa-include', 'wa-deferred'],
      pro: [],
    },
    shoelace: {
      version: '2.0.0-test',
      commit: 'sl-test',
      tags: ['sl-resize-observer', 'sl-static'],
    },
    noCounterpart: {
      'wa-deferred': 'The target has not shipped.',
    },
    unaliasedEvents: {},
    attributeRenames: [
      { component: 'lr-dialog', from: 'light-dismiss', to: 'light-dismiss' },
    ],
  };
  const lyraManifest = {
    modules: [
      {
        path: 'synthetic.ts',
        // Events are part of the synthetic manifest because the coverage gate measures every
        // upstream event against the events the Lyra target actually dispatches.
        declarations: coverageInventory.components.map((component) => ({
          customElement: true,
          tagName: component.tag,
          events: (component.surface.events ?? []).map((event) => ({ name: event.name })),
        })),
      },
    ],
  };
  const readme = [
    '| Component | Mirrors | Notes |',
    '|---|---|---|',
    '| `<lr-widget>` | `wa-widget` | rewritten |',
    '| `<lr-table>` | `wa-data-grid` | conceptual |',
    '| `<lr-include>` | `wa-include` | warning |',
    '| `<lr-resize-observer>` | `sl-resize-observer` | rewritten |',
    '| `<lr-static>` | `sl-static` | exact |',
    '',
  ].join('\n');
  return { inventory: coverageInventory, upstreamTags, lyraManifest, readme };
}

test('the migration contract validates every reserved rewrite rule array', () => {
  assert.equal(contract.mappings.size, 6);
  assert.equal(contract.mappings.get('sl-static').classification, 'exact');
  assert.equal(contract.mappings.get('sl-resize-observer').classification, 'rewritten');
  assert.equal(contract.mappings.get('wa-widget').classification, 'rewritten');

  for (const mutate of [
    (copy) => {
      copy.schemaVersion = 2;
    },
    (copy) => {
      delete copy.mappings[0].rewrites.methods;
    },
    (copy) => {
      copy.mappings[1].rewrites.attributes.push({ from: 'unknown', to: 'new-attribute' });
    },
    (copy) => {
      copy.mappings[1].rewrites.defaults.push({
        memberKind: 'attribute',
        member: 'mode',
        action: 'replace-value',
        from: 'compact',
      });
    },
    (copy) => {
      copy.mappings.find((mapping) => mapping.upstreamTag === 'wa-widget').rewrites.attributes[0].guess = true;
    },
    (copy) => {
      copy.mappings.find((mapping) => mapping.upstreamTag === 'wa-widget').rewrites.defaults[0].to = 'extra';
    },
    (copy) => {
      copy.mappings.find((mapping) => mapping.upstreamTag === 'wa-widget').rewrites.defaults[0].value = {
        unsafe: true,
      };
    },
    (copy) => {
      copy.mappings.find((mapping) => mapping.upstreamTag === 'sl-static').rewrites.events.push({
        from: 'sl-change',
        to: 'lr-change',
      });
    },
    (copy) => {
      copy.mappings.find((mapping) => mapping.upstreamTag === 'sl-static').classification = 'rewritten';
    },
    (copy) => {
      copy.mappings.find((mapping) => mapping.upstreamTag === 'sl-static').normalizations = {
        defaultEquivalences: [
          { memberKind: 'attribute', member: 'missing', upstream: 'medium', target: 'm' },
        ],
        inferredAttributeSuppressions: [],
      };
    },
    (copy) => {
      copy.mappings.find((mapping) => mapping.upstreamTag === 'sl-static').drift.push({
        code: 'missing-attribute',
        section: 'attributes',
        member: 'fabricated',
      });
    },
    (copy) => {
      delete copy.mappings.find((mapping) => mapping.upstreamTag === 'sl-static').parity.staticApi;
    },
    (copy) => {
      copy.mappings.find((mapping) => mapping.upstreamTag === 'sl-static').parity.runtime.registration = 'granular';
    },
    (copy) => {
      copy.upstreams.webawesome.packages[1].name = '@awesome.me/webawesome';
    },
  ]) {
    const copy = structuredClone(inventory);
    mutate(copy);
    assert.throws(() => buildMigrationContract(copy));
  }
});

test('the migration contract fails closed on accessibility profile drift', () => {
  const missingReview = structuredClone(inventory);
  delete missingReview.mappings[0].parity.accessibility;
  assert.throws(() => buildMigrationContract(missingReview), /missing accessibility parity review/);

  const unknownBehavior = structuredClone(inventory);
  unknownBehavior.accessibilityProfiles.synthetic.keyboard.push('invented-key-contract');
  assert.throws(() => buildMigrationContract(unknownBehavior), /unknown keyboard behavior invented-key-contract/);

  const staleComparison = structuredClone(inventory);
  staleComparison.mappings[0].parity.accessibility.comparison.status = 'target-additive';
  assert.throws(() => buildMigrationContract(staleComparison), /stored accessibility comparison is stale/);

  const runtime = createMigrationRuntimeInventory(inventory);
  assert.deepEqual(runtime.accessibilityProfiles, inventory.accessibilityProfiles);
  assert.deepEqual(
    runtime.mappings.map((mapping) => mapping.parity.accessibility),
    inventory.mappings.map((mapping) => mapping.parity.accessibility),
  );
  assert.equal(buildMigrationContract(runtime).mappings.size, inventory.mappings.length);
});

test('free and Pro package identities share the Web Awesome ecosystem without conflating tiers', () => {
  assert.deepEqual(
    contract.packageIdentities.get('@awesome.me/webawesome'),
    { ecosystem: 'webawesome', tiers: new Set(['free']) },
  );
  assert.deepEqual(
    contract.packageIdentities.get('@awesome.me/webawesome-pro'),
    { ecosystem: 'webawesome', tiers: new Set(['free', 'pro']) },
  );
  assert.deepEqual(
    contract.packageIdentities.get('@shoelace-style/shoelace'),
    { ecosystem: 'shoelace', tiers: new Set(['free']) },
  );
});

test('the packaged runtime projection stays narrow, complete, and fail-closed', () => {
  const runtimeInventory = createMigrationRuntimeInventory(checkedInventory);
  const runtimeContract = buildMigrationContract(runtimeInventory);
  assert.equal(runtimeInventory.migrationRuntimeSchemaVersion, 1);
  assert.equal(runtimeContract.mappings.size, checkedInventory.mappings.length);
  assert.deepEqual(
    runtimeContract.packageIdentities.get('@awesome.me/webawesome-pro'),
    { ecosystem: 'webawesome', tiers: new Set(['free', 'pro']) },
  );
  assert.ok(
    JSON.stringify(runtimeInventory).length < 400_000,
    'the CLI must not republish the multi-megabyte public-surface inventory',
  );

  const malformed = structuredClone(runtimeInventory);
  malformed.mappings[0].rewrites.attributes.push({ from: 'old', to: 'new', guess: true });
  assert.throws(() => buildMigrationContract(malformed), /unknown key/);
});

test('the packaged runtime executes from its adjacent projected contract', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-packaged-runtime-v8-'));
  try {
    const cliDir = path.join(scratch, 'cli');
    const sourceDir = path.join(scratch, 'consumer');
    fs.mkdirSync(cliDir);
    fs.mkdirSync(sourceDir);
    fs.copyFileSync(migratePath, path.join(cliDir, 'migrate-wa.mjs'));
    fs.copyFileSync(
      path.join(scriptDir, 'component-inventory.mjs'),
      path.join(cliDir, 'component-inventory.mjs'),
    );
    fs.writeFileSync(
      path.join(cliDir, 'migration-contract.json'),
      `${JSON.stringify(createMigrationRuntimeInventory(checkedInventory))}\n`,
    );

    const source = path.join(sourceDir, 'component.ts');
    fs.writeFileSync(
      source,
      [
        "import '@awesome.me/webawesome/dist/components/accordion-item/accordion-item.js';",
        "document.body.innerHTML = '<wa-accordion-item>Panel</wa-accordion-item>';",
        '',
      ].join('\n'),
    );
    const result = spawnSync(process.execPath, [path.join(cliDir, 'migrate-wa.mjs'), sourceDir], {
      cwd: scratch,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      fs.readFileSync(source, 'utf8'),
      [
        "import '@aceshooting/lyra-ui/components/layout/details/accordion-item.js';",
        "document.body.innerHTML = '<lr-accordion-item>Panel</lr-accordion-item>';",
        '',
      ].join('\n'),
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('inventory-v1 migration coverage classifies every pinned tag without claiming blanket renames', () => {
  const inputs = migrationCoverageFixture();
  const result = analyzeMigrationCoverage(inputs);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.summary.classifications, {
    exact: 1,
    rewritten: 2,
    'warning-required': 1,
    'conceptual-only': 1,
    unsupported: 1,
  });
  assert.equal(result.summary.automatic, 3);
  assert.equal(result.summary.manual, 3);
  assert.equal(result.summary.relationships, 5);
  assert.match(
    formatMigrationCoverageSummary(result.summary, inputs.upstreamTags),
    /3 automatic, 3 manual, 5 README relationships\./,
  );
});

test('migration coverage reads inherited events from a compact Lyra manifest', () => {
  const inputs = migrationCoverageFixture();
  const widget = inputs.lyraManifest.modules[0].declarations.find(
    (declaration) => declaration.tagName === 'lr-widget',
  );
  const inheritedEvents = widget.events;
  widget.name = 'LyraWidget';
  widget.superclass = { name: 'LyraWidgetBase', module: '/synthetic-base.js' };
  delete widget.events;
  inputs.lyraManifest.modules.unshift({
    path: 'synthetic-base.ts',
    declarations: [{ kind: 'class', name: 'LyraWidgetBase', events: inheritedEvents }],
  });

  assert.deepEqual(
    analyzeMigrationCoverage(inputs).errors,
    [],
    'a migrated listener remains covered when its event is declared on a resolvable base class',
  );
});

test('migration coverage fails closed on relationship, fiction, dangling, polarity, and schema drift', () => {
  const cases = [
    {
      expected: 'no inventory migration classification',
      mutate(inputs) {
        inputs.inventory.mappings = inputs.inventory.mappings.filter(
          (mapping) => mapping.upstreamTag !== 'sl-static',
        );
      },
    },
    {
      expected: 'fictional upstream inventory mapping',
      mutate(inputs) {
        inputs.inventory.mappings.push({
          ...structuredClone(inputs.inventory.mappings[0]),
          upstreamTag: 'wa-fictional',
        });
      },
    },
    {
      expected: 'README relationship targets lr-table, inventory targets lr-widget',
      mutate(inputs) {
        inputs.readme = inputs.readme.replace(
          '| `<lr-widget>` | `wa-widget` |',
          '| `<lr-table>` | `wa-widget` |',
        );
      },
    },
    {
      expected: 'README relationship target is not a registered Lyra tag',
      mutate(inputs) {
        inputs.readme = inputs.readme.replace(
          '| `<lr-widget>` | `wa-widget` |',
          '| `<lr-missing>` | `wa-widget` |',
        );
      },
    },
    {
      expected: 'named in README but no pinned upstream release ships it',
      mutate(inputs) {
        inputs.readme += '\n`wa-fictional`\n';
      },
    },
    {
      expected: 'ambiguous README mirror entry',
      mutate(inputs) {
        inputs.readme = inputs.readme.replace(
          '| `<lr-table>` | `wa-data-grid` | conceptual |',
          '| `<lr-table>` | `wa-data-grid` | conceptual |\n| `<lr-table>` | `wa-widget` | duplicate |',
        );
      },
    },
    {
      expected: 'inverts attribute polarity',
      mutate(inputs) {
        inputs.upstreamTags.attributeRenames[0] = {
          component: 'lr-dialog',
          from: 'light-dismiss',
          to: 'no-light-dismiss',
        };
      },
    },
    {
      expected: 'inverts attribute polarity',
      mutate(inputs) {
        const mapping = inputs.inventory.mappings.find(
          (entry) => entry.upstreamTag === 'wa-widget',
        );
        mapping.rewrites.attributes[0].to = 'no-new-attribute';
      },
    },
    {
      expected: 'rewrites.methods must be an array',
      mutate(inputs) {
        delete inputs.inventory.mappings[0].rewrites.methods;
      },
    },
    {
      // A mirrored event that survives under a different name is the quietest parity break
      // there is: the migrated markup parses and the listener silently never fires again.
      expected: 'wa-old-event migrates to lr-new-event, which lr-widget does not dispatch',
      mutate(inputs) {
        const widget = inputs.lyraManifest.modules[0].declarations.find(
          (declaration) => declaration.tagName === 'lr-widget',
        );
        widget.events = [];
      },
    },
    {
      // Dropping the explicit rewrite falls back to the mechanical prefix swap, which lands on a
      // name nothing dispatches -- the gate must not accept the codemod's own guess as coverage.
      expected: 'wa-old-event migrates to lr-old-event, which lr-widget does not dispatch',
      mutate(inputs) {
        inputs.inventory.mappings.find(
          (mapping) => mapping.upstreamTag === 'wa-widget',
        ).rewrites.events = [];
      },
    },
    {
      expected: 'unaliasedEvents exemption is stale',
      mutate(inputs) {
        inputs.upstreamTags.unaliasedEvents['wa-widget wa-old-event'] = 'Synthetic exemption.';
      },
    },
    {
      expected: 'unaliasedEvents exemption no longer applies to any pinned upstream event',
      mutate(inputs) {
        inputs.upstreamTags.unaliasedEvents['wa-widget wa-fictional'] = 'Synthetic exemption.';
      },
    },
    {
      expected: 'noCounterpart may exempt only an unsupported inventory mapping',
      mutate(inputs) {
        inputs.readme = inputs.readme.replace('| `<lr-static>` | `sl-static` | exact |\n', '');
        inputs.upstreamTags.noCounterpart['sl-static'] = 'Synthetic exemption.';
      },
    },
  ];

  for (const { expected, mutate } of cases) {
    const inputs = migrationCoverageFixture();
    mutate(inputs);
    const result = analyzeMigrationCoverage(inputs);
    assert.ok(
      result.errors.some((error) => error.includes(expected)),
      `${expected}:\n${result.errors.join('\n')}`,
    );
  }
});

test('a documented unaliasedEvents reason is the only way an unmirrored upstream event passes', () => {
  const inputs = migrationCoverageFixture();
  inputs.lyraManifest.modules[0].declarations.find(
    (declaration) => declaration.tagName === 'lr-widget',
  ).events = [];

  const undocumented = analyzeMigrationCoverage(structuredClone(inputs));
  assert.ok(undocumented.errors.some((error) => error.includes('lr-widget does not dispatch')));

  const blank = structuredClone(inputs);
  blank.upstreamTags.unaliasedEvents['wa-widget wa-old-event'] = '   ';
  assert.ok(
    analyzeMigrationCoverage(blank).errors.some((error) => error.includes('lr-widget does not dispatch')),
    'a whitespace-only reason is not a reason',
  );

  const documented = structuredClone(inputs);
  documented.upstreamTags.unaliasedEvents['wa-widget wa-old-event'] =
    'Synthetic: the widget deliberately has no equivalent notification.';
  assert.deepEqual(analyzeMigrationCoverage(documented).errors, []);
});

test('the checked-in inventory is executable and carries its explicit event-prefix rewrite', () => {
  const checkedContract = buildMigrationContract(checkedInventory);
  const input = [
    "import '@shoelace-style/shoelace/dist/components/resize-observer/resize-observer.js';",
    '<sl-resize-observer @sl-resize="onResize"></sl-resize-observer>',
    '',
  ].join('\n');
  const result = migrateText(input, checkedContract, {
    file: 'real.html',
    rewriteBarePackages: new Set(['shoelace']),
  });
  assert.equal(
    result.content,
    [
      "import '@aceshooting/lyra-ui/components/utility/resize-observer/resize-observer.js';",
      '<lr-resize-observer @lr-resize="onResize"></lr-resize-observer>',
      '',
    ].join('\n'),
  );
  assert.deepEqual(result.warnings, []);
});

test('shipped Page and Video mappings are exact and cannot retain stale no-counterpart exemptions', () => {
  for (const upstreamTag of ['wa-page', 'wa-video']) {
    const mapping = checkedInventory.mappings.find((entry) => entry.upstreamTag === upstreamTag);
    assert.equal(mapping?.classification, 'exact');
    assert.deepEqual(mapping?.drift, []);
    assert.ok(!Object.hasOwn(checkedUpstreamTags.noCounterpart, upstreamTag));
  }
});

for (const extension of extensions) {
  test(`${extension} fixture applies only inventory-declared transforms`, () => {
    const input = fixture(`component.input.${extension}`);
    const expected = fixture(`component.expected.${extension}`);
    const result = migrateText(input, contract, {
      file: `component.${extension}`,
      rewriteBarePackages: new Set(['webawesome', 'shoelace']),
    });

    assert.equal(result.content, expected);
    assert.ok(result.changes.length > 0);
    assert.deepEqual(result.warnings, []);

    const rerun = migrateText(result.content, contract, {
      file: `component.${extension}`,
      rewriteBarePackages: new Set(['webawesome', 'shoelace']),
    });
    assert.equal(rerun.content, expected, 'migration must be byte-idempotent');
    assert.deepEqual(rerun.changes, []);
    assert.deepEqual(rerun.warnings, []);
  });
}

test('the full rewrite vocabulary is represented in fixture findings', () => {
  const result = migrateText(fixture('component.input.html'), contract, {
    file: 'component.html',
    rewriteBarePackages: new Set(['webawesome']),
  });
  const actions = new Set(result.changes.map((entry) => entry.action));
  for (const action of [
    'rewrite-tag',
    'rewrite-attribute',
    'rewrite-event',
    'rewrite-slot',
    'rewrite-part',
    'rewrite-css-property',
    'insert-default',
    'replace-default',
  ]) {
    assert.ok(actions.has(action), `missing ${action} fixture coverage`);
  }

  const scriptResult = migrateText(fixture('component.input.js'), contract, {
    file: 'component.js',
    rewriteBarePackages: new Set(['webawesome']),
  });
  assert.ok(scriptResult.changes.some((entry) => entry.action === 'rewrite-method'));
  assert.ok(scriptResult.changes.some((entry) => entry.action === 'rewrite-property'));
  assert.ok(scriptResult.changes.some((entry) => entry.action === 'rewrite-import'));
});

test('conceptual, warning-required, unsupported, and unknown tags remain unchanged with precise warnings', () => {
  const input = fixture('mixed.input.html');
  const result = migrateText(input, contract, {
    file: 'mixed.html',
    rewriteBarePackages: new Set(),
  });

  assert.equal(result.content, input);
  assert.deepEqual(
    new Set(result.warnings.map((entry) => entry.warningCode)),
    new Set([
      'CONCEPTUAL_MAPPING',
      'WARNING_REQUIRED',
      'UNSUPPORTED_MAPPING',
      'UNKNOWN_UPSTREAM_TAG',
      'PACKAGE_IMPORT_BLOCKED',
    ]),
  );
  for (const warning of result.warnings) {
    assert.equal(warning.file, 'mixed.html');
    assert.ok(warning.line >= 1);
    assert.ok(warning.column >= 1);
    assert.equal(warning.action, 'manual-review');
  }
});

test('supported registration deep imports follow inventory modules; bindings and unknown subpaths warn', () => {
  const input = [
    "import '@awesome.me/webawesome/dist/components/widget/widget.js';",
    "import { WaDataGrid } from '@awesome.me/webawesome/dist/components/data-grid/data-grid.js';",
    "import '@awesome.me/webawesome/dist/components/mystery/mystery.js';",
    '',
  ].join('\n');
  const result = migrateText(input, contract, {
    file: 'imports.ts',
    rewriteBarePackages: new Set(['webawesome']),
  });

  assert.match(result.content, /@aceshooting\/lyra-ui\/components\/forms\/widget\/widget\.js/);
  assert.match(result.content, /import \{ WaDataGrid \} from '@awesome\.me\/webawesome/);
  assert.deepEqual(
    result.warnings.map((entry) => entry.warningCode),
    ['IMPORT_BINDING_REVIEW_REQUIRED', 'UNRESOLVED_DEEP_IMPORT'],
  );
});

test('Web Awesome Pro deep imports use the same proven granular registration mapping', () => {
  const input = "import '@awesome.me/webawesome-pro/dist/components/widget/widget.js';\n";
  const result = migrateText(input, contract, { file: 'pro-registration.ts' });

  assert.equal(
    result.content,
    "import '@aceshooting/lyra-ui/components/forms/widget/widget.js';\n",
  );
  assert.deepEqual(result.warnings, []);
});

test('multiline and commented import syntax cannot bypass binding-import safety', () => {
  const bindingInput = [
    'import {',
    '  WaWidget,',
    '} from',
    "  '@awesome.me/webawesome/dist/components/widget/widget.js';",
    '<wa-widget></wa-widget>',
    '',
  ].join('\n');
  const bindingResult = migrateText(bindingInput, contract, { file: 'binding.ts' });
  assert.equal(bindingResult.content, bindingInput);
  assert.deepEqual(
    new Set(bindingResult.warnings.map((entry) => entry.warningCode)),
    new Set(['IMPORT_BINDING_REVIEW_REQUIRED', 'MAPPING_REVIEW_BLOCKED']),
  );

  const sideEffectInput =
    "import /* registration metadata */ '@awesome.me/webawesome/dist/components/widget/widget.js';\n";
  const sideEffectResult = migrateText(sideEffectInput, contract, { file: 'registration.ts' });
  assert.equal(
    sideEffectResult.content,
    "import /* registration metadata */ '@aceshooting/lyra-ui/components/forms/widget/widget.js';\n",
  );
  assert.deepEqual(sideEffectResult.warnings, []);

  const dynamicInput = [
    'const registration = import(',
    '  /* chunk metadata */',
    "  '@awesome.me/webawesome/dist/components/widget/widget.js',",
    ');',
    '',
  ].join('\n');
  const dynamicResult = migrateText(dynamicInput, contract, { file: 'dynamic.ts' });
  assert.equal(dynamicResult.content, dynamicInput);
  assert.deepEqual(
    dynamicResult.warnings.map((entry) => entry.warningCode),
    ['IMPORT_BINDING_REVIEW_REQUIRED'],
  );
});

test('aliased member rewrites block their mapping across the scanned target set with persistent warnings', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-alias-v8-'));
  try {
    const script = path.join(scratch, 'alias.ts');
    const markup = path.join(scratch, 'view.html');
    const scriptInput = [
      "const widget = document.querySelector<HTMLElement>('wa-widget');",
      "widget?.addEventListener('wa-old-event', onChange);",
      '',
    ].join('\n');
    const markupInput = [
      "import '@awesome.me/webawesome/dist/components/widget/widget.js';",
      '<wa-widget></wa-widget>',
      '',
    ].join('\n');
    fs.writeFileSync(script, scriptInput);
    fs.writeFileSync(markup, markupInput);

    const first = migrateFiles({ files: [script, markup], inventory, cwd: scratch });
    assert.equal(first.filesChanged, 0);
    assert.equal(fs.readFileSync(script, 'utf8'), scriptInput);
    assert.equal(fs.readFileSync(markup, 'utf8'), markupInput);
    assert.ok(first.warnings.length >= 4);
    assert.deepEqual(
      new Set(first.warnings.map((entry) => entry.warningCode)),
      new Set(['ALIASED_MEMBER_REVIEW', 'MAPPING_REVIEW_BLOCKED']),
    );
    assert.ok(
      first.warnings.some(
        (entry) => entry.upstreamMember === 'wa-old-event' && entry.target === 'lr-new-event',
      ),
    );

    const rerun = migrateFiles({ files: [script, markup], inventory, cwd: scratch });
    assert.deepEqual(rerun, first);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('dynamic default values block partial tag and import rewrites across the scanned target set', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-dynamic-v8-'));
  try {
    const dynamic = path.join(scratch, 'dynamic.vue');
    const registration = path.join(scratch, 'registration.ts');
    const dynamicInput = '<wa-widget :mode="mode"></wa-widget>\n';
    const registrationInput =
      "import '@awesome.me/webawesome/dist/components/widget/widget.js';\n";
    fs.writeFileSync(dynamic, dynamicInput);
    fs.writeFileSync(registration, registrationInput);

    const report = migrateFiles({ files: [dynamic, registration], inventory, cwd: scratch });
    assert.equal(report.filesChanged, 0);
    assert.equal(fs.readFileSync(dynamic, 'utf8'), dynamicInput);
    assert.equal(fs.readFileSync(registration, 'utf8'), registrationInput);
    assert.ok(
      report.warnings.some(
        (entry) => entry.warningCode === 'DYNAMIC_VALUE_REVIEW' && entry.upstreamMember === 'mode',
      ),
    );
    assert.ok(report.warnings.some((entry) => entry.warningCode === 'MAPPING_REVIEW_BLOCKED'));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('a retained root registration import blocks automatic mappings in a mixed-safe ecosystem', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-root-v8-'));
  try {
    const source = path.join(scratch, 'mixed.html');
    const input = [
      "import '@awesome.me/webawesome';",
      '<wa-widget></wa-widget>',
      '<wa-data-grid></wa-data-grid>',
      '',
    ].join('\n');
    fs.writeFileSync(source, input);

    const report = migrateFiles({ files: [source], inventory, cwd: scratch });
    assert.equal(report.filesChanged, 0);
    assert.equal(fs.readFileSync(source, 'utf8'), input);
    assert.deepEqual(
      new Set(report.warnings.map((entry) => entry.warningCode)),
      new Set(['REGISTRATION_CLOSURE_REQUIRED', 'CONCEPTUAL_MAPPING', 'PACKAGE_IMPORT_BLOCKED']),
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('a root registration import rewrites to the explicit all-components entry when every target is root-included', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-root-safe-v8-'));
  try {
    const source = path.join(scratch, 'safe.html');
    const input = [
      "import '@awesome.me/webawesome';",
      '<wa-widget></wa-widget>',
      '',
    ].join('\n');
    fs.writeFileSync(source, input);

    const report = migrateFiles({ files: [source], inventory, cwd: scratch });
    assert.equal(report.filesChanged, 1);
    assert.equal(
      fs.readFileSync(source, 'utf8'),
      [
        "import '@aceshooting/lyra-ui/all.js';",
        '<lr-widget placement="start"></lr-widget>',
        '',
      ].join('\n'),
    );
    assert.deepEqual(report.warnings, []);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('a root package import receives granular registration for root-excluded targets and peer requirements', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-root-closure-v8-'));
  try {
    const source = path.join(scratch, 'safe.ts');
    const input = [
      "import '@awesome.me/webawesome-pro';",
      "document.body.innerHTML = '<wa-widget></wa-widget><wa-data-grid></wa-data-grid>';",
      '',
    ].join('\n');
    fs.writeFileSync(source, input);

    const rootExcludedInventory = structuredClone(inventory);
    const widget = rootExcludedInventory.components.find((component) => component.tag === 'lr-widget');
    widget.rootIncluded = false;
    widget.optionalPeers = ['widget-runtime'];
    const widgetMapping = rootExcludedInventory.mappings.find((mapping) => mapping.upstreamTag === 'wa-widget');
    widgetMapping.parity.runtime = {
      registration: 'granular',
      optionalPeers: ['widget-runtime'],
    };
    const dataGrid = rootExcludedInventory.mappings.find((mapping) => mapping.upstreamTag === 'wa-data-grid');
    dataGrid.classification = 'exact';
    dataGrid.rationale = null;
    dataGrid.parity.lightDom = 'surface-only';
    dataGrid.parity.behaviorReviewFlags = [];

    const report = migrateFiles({ files: [source], inventory: rootExcludedInventory, cwd: scratch });
    assert.equal(report.filesChanged, 1);
    assert.equal(
      fs.readFileSync(source, 'utf8'),
      [
        "import '@aceshooting/lyra-ui/all.js';",
        "import '@aceshooting/lyra-ui/components/forms/widget/widget.js';",
        "document.body.innerHTML = '<lr-widget placement=\"start\"></lr-widget><lr-table></lr-table>';",
        '',
      ].join('\n'),
    );
    assert.deepEqual(
      report.warnings.map((entry) => [entry.warningCode, entry.target]),
      [['OPTIONAL_PEER_REQUIRED', 'widget-runtime']],
    );
    assert.ok(report.changes.some((entry) => entry.action === 'insert-registration'));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('automatic markup stays unchanged until the scanned target set proves registration closure', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-registration-proof-v8-'));
  try {
    const importFree = path.join(scratch, 'import-free.html');
    const cdnOnly = path.join(scratch, 'cdn-only.html');
    const importFreeInput = '<wa-widget></wa-widget>\n';
    const cdnOnlyInput = [
      '<script type="module" src="https://cdn.example.test/webawesome.js"></script>',
      '<wa-widget></wa-widget>',
      '',
    ].join('\n');
    fs.writeFileSync(importFree, importFreeInput);
    fs.writeFileSync(cdnOnly, cdnOnlyInput);

    const report = migrateFiles({ files: [importFree, cdnOnly], inventory, cwd: scratch });
    assert.equal(report.filesChanged, 0);
    assert.equal(fs.readFileSync(importFree, 'utf8'), importFreeInput);
    assert.equal(fs.readFileSync(cdnOnly, 'utf8'), cdnOnlyInput);
    assert.equal(
      report.warnings.filter((entry) => entry.warningCode === 'REGISTRATION_CLOSURE_REQUIRED').length,
      2,
    );
    assert.ok(
      report.warnings.every(
        (entry) =>
          entry.warningCode !== 'REGISTRATION_CLOSURE_REQUIRED' ||
          entry.message.includes('@aceshooting/lyra-ui/components/forms/widget/widget.js'),
      ),
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('a free package root cannot authorize a Pro-only tag rewrite', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-tier-proof-v8-'));
  try {
    const source = path.join(scratch, 'pro.ts');
    const input = [
      "import '@awesome.me/webawesome';",
      "document.body.innerHTML = '<wa-data-grid></wa-data-grid>';",
      '',
    ].join('\n');
    fs.writeFileSync(source, input);

    const proInventory = structuredClone(inventory);
    const dataGrid = proInventory.mappings.find((mapping) => mapping.upstreamTag === 'wa-data-grid');
    dataGrid.classification = 'exact';
    dataGrid.rationale = null;
    dataGrid.parity.lightDom = 'surface-only';
    dataGrid.parity.behaviorReviewFlags = [];

    const report = migrateFiles({ files: [source], inventory: proInventory, cwd: scratch });
    assert.equal(report.filesChanged, 0);
    assert.equal(fs.readFileSync(source, 'utf8'), input);
    assert.deepEqual(
      new Set(report.warnings.map((entry) => entry.warningCode)),
      new Set(['PACKAGE_IMPORT_BLOCKED', 'REGISTRATION_CLOSURE_REQUIRED']),
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('a free package deep import cannot masquerade as a Pro registration entry', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-deep-tier-proof-v8-'));
  try {
    const source = path.join(scratch, 'pro.ts');
    const input = [
      "import '@awesome.me/webawesome/dist/components/data-grid/data-grid.js';",
      "document.body.innerHTML = '<wa-data-grid></wa-data-grid>';",
      '',
    ].join('\n');
    fs.writeFileSync(source, input);

    const proInventory = structuredClone(inventory);
    const dataGrid = proInventory.mappings.find((mapping) => mapping.upstreamTag === 'wa-data-grid');
    dataGrid.classification = 'exact';
    dataGrid.rationale = null;
    dataGrid.parity.lightDom = 'surface-only';
    dataGrid.parity.behaviorReviewFlags = [];

    const report = migrateFiles({ files: [source], inventory: proInventory, cwd: scratch });
    assert.equal(report.filesChanged, 0);
    assert.equal(fs.readFileSync(source, 'utf8'), input);
    assert.deepEqual(
      new Set(report.warnings.map((entry) => entry.warningCode)),
      new Set(['PACKAGE_TIER_MISMATCH', 'REGISTRATION_CLOSURE_REQUIRED']),
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('a different component deep import does not prove registration for a rewritten tag', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-mismatched-registration-v8-'));
  try {
    const source = path.join(scratch, 'mismatch.ts');
    const input = [
      "import '@awesome.me/webawesome/dist/components/widget/widget.js';",
      "document.body.innerHTML = '<wa-data-grid></wa-data-grid>';",
      '',
    ].join('\n');
    fs.writeFileSync(source, input);

    const proInventory = structuredClone(inventory);
    const dataGrid = proInventory.mappings.find((mapping) => mapping.upstreamTag === 'wa-data-grid');
    dataGrid.classification = 'exact';
    dataGrid.rationale = null;
    dataGrid.parity.lightDom = 'surface-only';
    dataGrid.parity.behaviorReviewFlags = [];

    const report = migrateFiles({ files: [source], inventory: proInventory, cwd: scratch });
    assert.equal(report.filesChanged, 1, 'the independently safe widget registration still migrates');
    assert.equal(
      fs.readFileSync(source, 'utf8'),
      [
        "import '@aceshooting/lyra-ui/components/forms/widget/widget.js';",
        "document.body.innerHTML = '<wa-data-grid></wa-data-grid>';",
        '',
      ].join('\n'),
    );
    assert.ok(report.warnings.some((entry) => entry.warningCode === 'REGISTRATION_CLOSURE_REQUIRED'));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('comments, prose, class names, unrelated packages, and partial strings are false-positive safe', () => {
  const input = fixture('no-false-positives.input.ts');
  const result = migrateText(input, contract, {
    file: 'no-false-positives.ts',
    rewriteBarePackages: new Set(['webawesome', 'shoelace']),
  });
  assert.equal(result.content, input);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.warnings, []);
});

test('CSS rewrites never alter comments inside an otherwise migrated component rule', () => {
  const input = [
    'wa-widget {',
    '  /* Keep --wa-old-color in this migration note. */',
    '  color: var(--wa-old-color);',
    '}',
    '',
  ].join('\n');
  const result = migrateText(input, contract, { file: 'comments.css' });
  assert.equal(
    result.content,
    [
      'lr-widget {',
      '  /* Keep --wa-old-color in this migration note. */',
      '  color: var(--lr-new-color);',
      '}',
      '',
    ].join('\n'),
  );

  const commentOnlySelector = [
    '.unrelated /* wa-widget */ {',
    '  color: var(--wa-old-color);',
    '}',
    '',
  ].join('\n');
  const untouched = migrateText(commentOnlySelector, contract, { file: 'selector-comment.css' });
  assert.equal(untouched.content, commentOnlySelector);
  assert.deepEqual(untouched.changes, []);
});

test('directory targets include standalone CSS in the default scan set', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-css-directory-v8-'));
  try {
    const stylesheet = path.join(scratch, 'component.css');
    const source = path.join(scratch, 'registration.ts');
    fs.writeFileSync(stylesheet, 'wa-widget { color: var(--wa-old-color); }\n');
    fs.writeFileSync(source, "import '@awesome.me/webawesome/dist/components/widget/widget.js';\n");
    fs.writeFileSync(path.join(scratch, 'ignored.txt'), 'wa-widget {}\n');

    const files = collectFiles([scratch], parseArgs([scratch]).extensions);
    assert.deepEqual(files, [stylesheet, source].sort());
    const report = migrateFiles({ files, inventory, cwd: scratch });
    assert.equal(report.filesChanged, 2);
    assert.equal(fs.readFileSync(stylesheet, 'utf8'), 'lr-widget { color: var(--lr-new-color); }\n');
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('manual mappings report one tag warning and every optional peer requirement', () => {
  const markdown = checkedInventory.mappings.find((mapping) => mapping.upstreamTag === 'wa-markdown');
  assert.ok(markdown?.parity.runtime.optionalPeers.length > 0);
  const result = migrateText('<wa-markdown></wa-markdown>\n', buildMigrationContract(checkedInventory), {
    file: 'manual.html',
  });
  assert.equal(
    result.warnings.filter((entry) => entry.warningCode === 'WARNING_REQUIRED').length,
    1,
  );
  assert.deepEqual(
    result.warnings
      .filter((entry) => entry.warningCode === 'OPTIONAL_PEER_REQUIRED')
      .map((entry) => entry.target)
      .sort(),
    [...markdown.parity.runtime.optionalPeers].sort(),
  );
});

test('the checked-in inventory rewrites free-tier icon imports from both ecosystems with their dompurify peer requirement', () => {
  const checkedContract = buildMigrationContract(checkedInventory);

  const waInput = [
    "import '@awesome.me/webawesome/dist/components/icon/icon.js';",
    '<wa-icon></wa-icon>',
    '',
  ].join('\n');
  const waResult = migrateText(waInput, checkedContract, { file: 'wa-icon.html' });
  assert.equal(
    waResult.content,
    [
      "import '@aceshooting/lyra-ui/components/utility/icon/icon.js';",
      '<lr-icon></lr-icon>',
      '',
    ].join('\n'),
  );
  assert.deepEqual(
    waResult.warnings.map((entry) => [entry.warningCode, entry.target]),
    [['OPTIONAL_PEER_REQUIRED', 'dompurify']],
  );

  const slInput = [
    "import '@shoelace-style/shoelace/dist/components/icon/icon.js';",
    '<sl-icon></sl-icon>',
    '',
  ].join('\n');
  const slResult = migrateText(slInput, checkedContract, { file: 'sl-icon.html' });
  assert.equal(
    slResult.content,
    [
      "import '@aceshooting/lyra-ui/components/utility/icon/icon.js';",
      '<lr-icon></lr-icon>',
      '',
    ].join('\n'),
  );
  assert.deepEqual(
    slResult.warnings.map((entry) => [entry.warningCode, entry.target]),
    [['OPTIONAL_PEER_REQUIRED', 'dompurify']],
  );
});

test('the checked-in inventory rewrites the free-tier icon-button deep import with no peer requirement', () => {
  const checkedContract = buildMigrationContract(checkedInventory);
  const input = [
    "import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';",
    '<sl-icon-button></sl-icon-button>',
    '',
  ].join('\n');
  const result = migrateText(input, checkedContract, { file: 'icon-button.html' });
  assert.equal(
    result.content,
    [
      "import '@aceshooting/lyra-ui/components/forms/icon-button/icon-button.js';",
      '<lr-icon-button></lr-icon-button>',
      '',
    ].join('\n'),
  );
  assert.deepEqual(result.warnings, []);
});

test('the checked-in inventory rewrites the Pro-tier date-picker deep import with no peer requirement', () => {
  const checkedContract = buildMigrationContract(checkedInventory);
  const input = [
    "import '@awesome.me/webawesome-pro/dist/components/date-picker/date-picker.js';",
    '<wa-date-picker></wa-date-picker>',
    '',
  ].join('\n');
  const result = migrateText(input, checkedContract, { file: 'date-picker.html' });
  assert.equal(
    result.content,
    [
      "import '@aceshooting/lyra-ui/components/forms/date-picker/date-picker.js';",
      '<lr-date-picker></lr-date-picker>',
      '',
    ].join('\n'),
  );
  assert.deepEqual(result.warnings, []);
});

test('the checked-in inventory rewrites free-tier QR code imports from both ecosystems with their qrcode peer requirement', () => {
  const checkedContract = buildMigrationContract(checkedInventory);

  const slInput = [
    "import '@shoelace-style/shoelace/dist/components/qr-code/qr-code.js';",
    '<sl-qr-code></sl-qr-code>',
    '',
  ].join('\n');
  const slResult = migrateText(slInput, checkedContract, { file: 'sl-qr-code.html' });
  assert.equal(
    slResult.content,
    [
      "import '@aceshooting/lyra-ui/components/media/qr-code/qr-code.js';",
      '<lr-qr-code background="white" fill="black"></lr-qr-code>',
      '',
    ].join('\n'),
  );
  assert.deepEqual(
    slResult.warnings.map((entry) => [entry.warningCode, entry.target]),
    [['OPTIONAL_PEER_REQUIRED', 'qrcode']],
  );

  const waInput = [
    "import '@awesome.me/webawesome/dist/components/qr-code/qr-code.js';",
    '<wa-qr-code></wa-qr-code>',
    '',
  ].join('\n');
  const waResult = migrateText(waInput, checkedContract, { file: 'wa-qr-code.html' });
  assert.equal(
    waResult.content,
    [
      "import '@aceshooting/lyra-ui/components/media/qr-code/qr-code.js';",
      '<lr-qr-code></lr-qr-code>',
      '',
    ].join('\n'),
  );
  assert.deepEqual(
    waResult.warnings.map((entry) => [entry.warningCode, entry.target]),
    [['OPTIONAL_PEER_REQUIRED', 'qrcode']],
  );
});

test('the checked-in inventory reports a warning-required tag and no peer requirements for random-content', () => {
  const randomContent = checkedInventory.mappings.find(
    (mapping) => mapping.upstreamTag === 'wa-random-content',
  );
  assert.deepEqual(randomContent?.parity.runtime.optionalPeers, []);
  const input = '<wa-random-content></wa-random-content>\n';
  const result = migrateText(input, buildMigrationContract(checkedInventory), {
    file: 'random-content.html',
  });
  assert.equal(result.content, input);
  assert.equal(
    result.warnings.filter((entry) => entry.warningCode === 'WARNING_REQUIRED').length,
    1,
  );
  assert.deepEqual(
    result.warnings.filter((entry) => entry.warningCode === 'OPTIONAL_PEER_REQUIRED'),
    [],
  );
});

test('the checked-in inventory rewrites data-grid tags with named method option types', () => {
  const dataGrid = checkedInventory.mappings.find((mapping) => mapping.upstreamTag === 'wa-data-grid');
  assert.equal(dataGrid?.classification, 'rewritten');
  assert.deepEqual(dataGrid?.drift, []);

  const input = '<wa-data-grid></wa-data-grid>\n';
  const result = migrateText(input, buildMigrationContract(checkedInventory), {
    file: 'data-grid.html',
  });

  assert.equal(result.content, '<lr-data-grid></lr-data-grid>\n');
  assert.deepEqual(result.warnings, []);
  assert.ok(result.changes.some((entry) => entry.action === 'rewrite-tag'));
});

test('the checked-in inventory leaves reflection-sensitive Shoelace checkbox usage unchanged with a warning', () => {
  const input = [
    '<style>sl-checkbox[checked] { color: rebeccapurple; }</style>',
    '<sl-checkbox checked>Updates</sl-checkbox>',
    '<script>',
    "const checkbox = document.querySelector('sl-checkbox');",
    'checkbox.checked = false;',
    '</script>',
    '',
  ].join('\n');
  const result = migrateText(input, buildMigrationContract(checkedInventory), {
    file: 'checkbox.html',
  });

  assert.equal(result.content, input);
  assert.deepEqual(result.changes, []);
  assert.ok(result.warnings.length > 0);
  assert.ok(
    result.warnings.every(
      (entry) =>
        entry.warningCode === 'WARNING_REQUIRED' &&
        entry.upstreamTag === 'sl-checkbox' &&
        entry.target === 'lr-checkbox',
    ),
  );
});

test('the checked-in inventory warns for a reflection-sensitive Shoelace checkbox CSS selector', () => {
  const input = 'sl-checkbox[checked] { color: rebeccapurple; }\n';
  const result = migrateText(input, buildMigrationContract(checkedInventory), {
    file: 'checkbox.css',
  });

  assert.equal(result.content, input);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(
    result.warnings.map(({ action, column, file, line, target, upstreamTag, warningCode }) => ({
      action,
      column,
      file,
      line,
      target,
      upstreamTag,
      warningCode,
    })),
    [
      {
        action: 'manual-review',
        column: 1,
        file: 'checkbox.css',
        line: 1,
        target: 'lr-checkbox',
        upstreamTag: 'sl-checkbox',
        warningCode: 'WARNING_REQUIRED',
      },
    ],
  );
});

test('the checked-in inventory rewrites a Pro chart deep import with its granular registration and peer requirements', () => {
  const checkedContract = buildMigrationContract(checkedInventory);
  const input = [
    "import '@awesome.me/webawesome-pro/dist/components/line-chart/line-chart.js';",
    '<wa-line-chart></wa-line-chart>',
    '',
  ].join('\n');
  const result = migrateText(input, checkedContract, { file: 'line-chart.html' });
  assert.equal(
    result.content,
    [
      "import '@aceshooting/lyra-ui/components/charts/chart/line-chart.js';",
      '<lr-line-chart></lr-line-chart>',
      '',
    ].join('\n'),
  );
  assert.deepEqual(
    new Set(result.warnings.map((entry) => `${entry.warningCode}|${entry.target}`)),
    new Set([
      'OPTIONAL_PEER_REQUIRED|chart.js',
      'OPTIONAL_PEER_REQUIRED|chartjs-plugin-datalabels',
      'OPTIONAL_PEER_REQUIRED|chartjs-plugin-zoom',
    ]),
  );
});

test('the checked-in inventory grants a Pro chart target its granular registration closure alongside a rootIncluded free target', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-chart-closure-v8-'));
  try {
    const source = path.join(scratch, 'charts.ts');
    const input = [
      "import '@awesome.me/webawesome-pro';",
      "document.body.innerHTML = '<wa-icon></wa-icon><wa-bar-chart></wa-bar-chart>';",
      '',
    ].join('\n');
    fs.writeFileSync(source, input);

    const report = migrateFiles({ files: [source], inventory: checkedInventory, cwd: scratch });
    assert.equal(report.filesChanged, 1);
    assert.equal(
      fs.readFileSync(source, 'utf8'),
      [
        "import '@aceshooting/lyra-ui/all.js';",
        "import '@aceshooting/lyra-ui/components/charts/chart/bar-chart.js';",
        "document.body.innerHTML = '<lr-icon></lr-icon><lr-bar-chart></lr-bar-chart>';",
        '',
      ].join('\n'),
    );
    assert.deepEqual(
      new Set(report.warnings.map((entry) => `${entry.warningCode}|${entry.target}`)),
      new Set([
        'OPTIONAL_PEER_REQUIRED|dompurify',
        'OPTIONAL_PEER_REQUIRED|chart.js',
        'OPTIONAL_PEER_REQUIRED|chartjs-plugin-datalabels',
        'OPTIONAL_PEER_REQUIRED|chartjs-plugin-zoom',
      ]),
    );
    assert.ok(report.changes.some((entry) => entry.action === 'insert-registration'));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('the lyra-v7 profile inserts only absent defaults with canonical boolean presence syntax', () => {
  const checkedContract = buildMigrationContract(checkedInventory);
  const input = [
    '<lr-popup></lr-popup>',
    '<lr-popover></lr-popover>',
    '<lr-tooltip></lr-tooltip>',
    '<lr-popup strategy="absolute" placement="top" distance="9" flip shift></lr-popup>',
    '<lr-popover placement="top" distance="9" without-arrow></lr-popover>',
    '<lr-tooltip distance="9" without-arrow></lr-tooltip>',
    '',
  ].join('\n');
  const expected = [
    '<lr-popup strategy="fixed" placement="bottom-start" distance="4" flip shift></lr-popup>',
    '<lr-popover placement="bottom-start" distance="4" without-arrow></lr-popover>',
    '<lr-tooltip distance="6" without-arrow></lr-tooltip>',
    '<lr-popup strategy="absolute" placement="top" distance="9" flip shift></lr-popup>',
    '<lr-popover placement="top" distance="9" without-arrow></lr-popover>',
    '<lr-tooltip distance="9" without-arrow></lr-tooltip>',
    '',
  ].join('\n');
  const result = migrateText(input, checkedContract, { file: 'local.html', origin: 'lyra-v7' });
  assert.equal(result.content, expected);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.changes.length > 0);
  assert.deepEqual(new Set(result.changes.map((entry) => entry.origin)), new Set(['lyra-v7']));
  assert.deepEqual(new Set(result.changes.map((entry) => entry.action)), new Set(['insert-default']));
  assert.ok(!result.content.includes('="true"'));
  assert.ok(!result.content.includes('arrow="false"'));

  const rerun = migrateText(result.content, checkedContract, { file: 'local.html', origin: 'lyra-v7' });
  assert.equal(rerun.content, expected);
  assert.deepEqual(rerun.changes, []);
  assert.deepEqual(rerun.warnings, []);
});

test('the default migration mode never scans or warns about existing lr-* markup', () => {
  const checkedContract = buildMigrationContract(checkedInventory);
  const input = [
    "import '@aceshooting/lyra-ui/components/overlays/popup/popup.js';",
    '<lr-popup></lr-popup>',
    '<lr-popover></lr-popover>',
    '<lr-tooltip></lr-tooltip>',
    '',
  ].join('\n');
  const result = migrateText(input, checkedContract, { file: 'already-lyra.html' });
  assert.equal(result.content, input);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.warnings, []);
});

test('aliased elements and opaque attribute spreads block local defaults across all files', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-local-blocked-v8-'));
  try {
    const alias = path.join(scratch, 'alias.ts');
    const dynamic = path.join(scratch, 'dynamic.vue');
    const markup = path.join(scratch, 'view.html');
    const aliasInput = "const popup = shadowRoot.querySelector('lr-popup');\n";
    const dynamicInput = '<lr-popover v-bind="attrs"></lr-popover>\n';
    const markupInput = '<lr-popup></lr-popup>\n<lr-popover></lr-popover>\n';
    fs.writeFileSync(alias, aliasInput);
    fs.writeFileSync(dynamic, dynamicInput);
    fs.writeFileSync(markup, markupInput);

    const first = migrateFiles({
      files: [alias, dynamic, markup],
      inventory: checkedInventory,
      origin: 'lyra-v7',
      cwd: scratch,
    });
    assert.equal(first.origin, 'lyra-v7');
    assert.equal(first.filesChanged, 0);
    assert.equal(fs.readFileSync(alias, 'utf8'), aliasInput);
    assert.equal(fs.readFileSync(dynamic, 'utf8'), dynamicInput);
    assert.equal(fs.readFileSync(markup, 'utf8'), markupInput);
    assert.deepEqual(
      new Set(first.warnings.map((entry) => entry.warningCode)),
      new Set(['ALIASED_MEMBER_REVIEW', 'DYNAMIC_VALUE_REVIEW', 'MAPPING_REVIEW_BLOCKED']),
    );
    assert.deepEqual(first.changes, []);
    assert.deepEqual(
      first.warnings.map((entry) => entry.origin),
      first.warnings.map(() => 'lyra-v7'),
    );

    const rerun = migrateFiles({
      files: [alias, dynamic, markup],
      inventory: checkedInventory,
      origin: 'lyra-v7',
      cwd: scratch,
    });
    assert.deepEqual(rerun, first);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('CLI argument parsing includes check mode, dry-run, and a stable report target', () => {
  assert.deepEqual(parseArgs(['--check', '--origin=lyra-v7', '--report=out/report.json', '--ext=.ts,vue', '--', 'src']), {
    check: true,
    dryRun: true,
    help: false,
    extensions: new Set(['ts', 'vue']),
    origin: 'lyra-v7',
    report: 'out/report.json',
    targets: ['src'],
  });
  assert.throws(() => parseArgs(['--origin=lyra-v6', 'src']), /Unknown migration origin/);
});

test('CLI --check is non-mutating and exits nonzero until the migration is clean', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-check-v8-'));
  try {
    const source = path.join(scratch, 'component.ts');
    const input = [
      "import '@shoelace-style/shoelace/dist/components/resize-observer/resize-observer.js';",
      "document.body.innerHTML = '<sl-resize-observer></sl-resize-observer>';",
      '',
    ].join('\n');
    fs.writeFileSync(source, input);
    const invoke = (...args) =>
      spawnSync(process.execPath, [migratePath, ...args], { cwd: scratch, encoding: 'utf8' });

    const pending = invoke('--check', source);
    assert.equal(pending.status, 1, pending.stderr);
    assert.equal(fs.readFileSync(source, 'utf8'), input);
    assert.match(pending.stdout, /Migration check failed:/);

    const applied = invoke(source);
    assert.equal(applied.status, 0, applied.stderr);
    const clean = invoke('--check', source);
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(clean.stdout, /Migration check passed:/);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('CLI --check remains nonzero when registration closure is unresolved', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-check-registration-v8-'));
  try {
    const source = path.join(scratch, 'component.html');
    const input = '<wa-accordion-item>Panel</wa-accordion-item>\n';
    fs.writeFileSync(source, input);
    const result = spawnSync(process.execPath, [migratePath, '--check', source], {
      cwd: scratch,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1, result.stderr);
    assert.equal(fs.readFileSync(source, 'utf8'), input);
    assert.match(result.stdout, /REGISTRATION_CLOSURE_REQUIRED/);
    assert.match(result.stdout, /Migration check failed:/);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('migrateFiles writes a stable location-aware JSON report and honors dry-run', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-v8-'));
  try {
    const source = path.join(scratch, 'component.html');
    const registration = path.join(scratch, 'registration.ts');
    const reportPath = path.join(scratch, 'report.json');
    const input = fixture('component.input.html');
    const expected = fixture('component.expected.html');
    fs.writeFileSync(source, input);
    fs.writeFileSync(
      registration,
      "import '@awesome.me/webawesome/dist/components/widget/widget.js';\n",
    );

    const dryReport = migrateFiles({
      files: [source, registration],
      inventory,
      dryRun: true,
      reportPath,
      cwd: scratch,
    });
    assert.equal(fs.readFileSync(source, 'utf8'), input);
    assert.equal(dryReport.schemaVersion, MIGRATION_REPORT_SCHEMA_VERSION);
    assert.equal(dryReport.origin, null);
    assert.equal(dryReport.dryRun, true);
    assert.equal(dryReport.filesScanned, 2);
    assert.equal(dryReport.filesChanged, 2);
    assert.ok(dryReport.changes.length > 0);
    assert.equal(dryReport.warnings.length, 0);
    assert.deepEqual(Object.keys(dryReport.changes[0]), [
      'file',
      'line',
      'column',
      'origin',
      'upstreamTag',
      'upstreamMember',
      'action',
      'target',
      'warningCode',
      'message',
    ]);
    assert.deepEqual(JSON.parse(fs.readFileSync(reportPath, 'utf8')), dryReport);

    const applied = migrateFiles({ files: [source, registration], inventory, dryRun: false, cwd: scratch });
    assert.equal(fs.readFileSync(source, 'utf8'), expected);
    assert.equal(applied.filesChanged, 2);

    const rerun = migrateFiles({ files: [source, registration], inventory, dryRun: false, cwd: scratch });
    assert.equal(rerun.filesChanged, 0);
    assert.deepEqual(rerun.changes, []);
    assert.deepEqual(rerun.warnings, []);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('the public CLI dry-runs, reports, applies, and remains idempotent', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-cli-v8-'));
  try {
    const source = path.join(scratch, 'component.ts');
    const reportPath = path.join(scratch, 'report.json');
    const input = [
      "import '@shoelace-style/shoelace/dist/components/resize-observer/resize-observer.js';",
      "document.body.innerHTML = '<sl-resize-observer></sl-resize-observer>';",
      '',
    ].join('\n');
    const expected = [
      "import '@aceshooting/lyra-ui/components/utility/resize-observer/resize-observer.js';",
      "document.body.innerHTML = '<lr-resize-observer></lr-resize-observer>';",
      '',
    ].join('\n');
    fs.writeFileSync(source, input);

    const invoke = (...args) =>
      spawnSync(process.execPath, [migratePath, ...args], {
        cwd: scratch,
        encoding: 'utf8',
      });
    const dry = invoke('--dry-run', `--report=${reportPath}`, source);
    assert.equal(dry.status, 0, dry.stderr);
    assert.match(dry.stdout, /1 file\(s\) scanned, 1 changed, 3 rewrite\(s\), 0 warning\(s\)\./);
    assert.match(dry.stdout, /Dry run only -- no source files were written\./);
    assert.equal(fs.readFileSync(source, 'utf8'), input);
    const dryReport = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(dryReport.dryRun, true);
    assert.equal(dryReport.filesChanged, 1);

    const applied = invoke(source);
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(fs.readFileSync(source, 'utf8'), expected);

    const rerun = invoke(source);
    assert.equal(rerun.status, 0, rerun.stderr);
    assert.match(rerun.stdout, /1 file\(s\) scanned, 0 changed, 0 rewrite\(s\), 0 warning\(s\)\./);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test('the public CLI requires an explicit supported origin for local defaults', () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-migrate-local-cli-v8-'));
  try {
    const source = path.join(scratch, 'local.html');
    const reportPath = path.join(scratch, 'report.json');
    const input = '<lr-tooltip></lr-tooltip>\n';
    const expected = '<lr-tooltip distance="6" without-arrow></lr-tooltip>\n';
    fs.writeFileSync(source, input);
    const invoke = (...args) =>
      spawnSync(process.execPath, [migratePath, ...args], { cwd: scratch, encoding: 'utf8' });

    const defaultRun = invoke(source);
    assert.equal(defaultRun.status, 0, defaultRun.stderr);
    assert.equal(fs.readFileSync(source, 'utf8'), input, 'default mode must leave Lyra markup alone');

    const dry = invoke('--origin=lyra-v7', '--dry-run', `--report=${reportPath}`, source);
    assert.equal(dry.status, 0, dry.stderr);
    assert.equal(fs.readFileSync(source, 'utf8'), input);
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    assert.equal(report.origin, 'lyra-v7');
    assert.deepEqual(new Set(report.changes.map((entry) => entry.action)), new Set(['insert-default']));
    assert.ok(report.changes.every((entry) => entry.origin === 'lyra-v7'));
    assert.ok(report.changes.every((entry) => !['rewrite-tag', 'rewrite-import'].includes(entry.action)));

    const applied = invoke('--origin=lyra-v7', source);
    assert.equal(applied.status, 0, applied.stderr);
    assert.equal(fs.readFileSync(source, 'utf8'), expected);
    const rerun = invoke('--origin=lyra-v7', source);
    assert.equal(rerun.status, 0, rerun.stderr);
    assert.match(rerun.stdout, /0 changed, 0 rewrite\(s\), 0 warning\(s\)/);

    const unknown = invoke('--origin=lyra-v6', source);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /Unknown migration origin: lyra-v6/);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
