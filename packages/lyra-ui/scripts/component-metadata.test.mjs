import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  annotateComponentSource,
  applyComponentMetadataToManifest,
  applyMaturityToInventory,
  compareVersions,
  componentMetadataByTag,
  deriveSinceByTag,
  manifestComponentTags,
  parseVersion,
  validateComponentMetadata,
  validateManifestMetadataProjection,
} from './component-metadata.mjs';
import cemConfig from '../custom-elements-manifest.config.js';
import {
  buildComponentMetadataIndex,
  componentMetadataPresentation,
} from '../../../.storybook/component-metadata.js';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(packageDir, relativePath), 'utf8'));
}

function fixture() {
  const rawManifest = fs.readFileSync(path.join(packageDir, 'custom-elements.json'), 'utf8');
  return {
    metadata: readJson('scripts/fixtures/component-metadata.json'),
    inventory: readJson('scripts/fixtures/component-inventory.json'),
    manifest: JSON.parse(rawManifest),
    packageJson: readJson('package.json'),
    rawManifest,
  };
}

test('checked-in metadata covers the current manifest and inventory', () => {
  const state = fixture();
  assert.deepEqual(validateComponentMetadata(state.metadata, state), []);
  assert.equal(state.metadata.assignments['published-stable'].length, 264);
  assert.equal(state.metadata.assignments['published-experimental'].length, 2);
  assert.equal(state.metadata.assignments['mapped-experimental'].length, 1);
  assert.equal(state.metadata.assignments['compatibility-stable'].length, 1);
  assert.equal(state.metadata.assignments['introduced-stable'].length, 15);
  assert.equal(state.metadata.deprecations.length, 9);
});

test('exact tag history derives the earliest release and leaves renamed prefixes distinct', () => {
  const history = {
    releases: [
      { version: '3.9.0', manifestPresent: true, tags: ['lyra-example'] },
      { version: '4.0.0', manifestPresent: true, tags: ['lr-example'] },
      { version: '4.1.0', manifestPresent: true, tags: ['lr-example', 'lr-later'] },
      { version: '5.0.0', manifestPresent: true, tags: ['lr-later'] },
    ],
    current: { version: '8.0.0', tags: ['lr-current', 'lr-example', 'lr-later'] },
  };

  assert.deepEqual(Object.fromEntries(deriveSinceByTag(history)), {
    'lyra-example': '3.9.0',
    'lr-example': '4.0.0',
    'lr-later': '4.1.0',
    'lr-current': '8.0.0',
  });
});

test('history provenance rejects malformed commit, blob, and digest evidence', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  const release = metadata.history.releases.find((entry) => entry.manifestPresent);
  release.sourceCommit = 'not-a-commit';
  release.manifestBlob = 'not-a-blob';
  release.manifestSha256 = 'not-a-digest';

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(findings.includes(`${release.tag}: missing or invalid source commit provenance`));
  assert.ok(findings.includes(`${release.tag}: manifest blob must be a Git object id`));
  assert.ok(findings.includes(`${release.tag}: manifest digest must be SHA-256`));
});

test('version comparison is numeric and rejects malformed versions', () => {
  assert.ok(compareVersions('4.10.0', '4.9.0') > 0);
  assert.ok(compareVersions('8.0.0-beta.1', '8.0.0') < 0);
  assert.deepEqual(parseVersion('10.2.3'), {
    major: 10,
    minor: 2,
    patch: 3,
    prerelease: null,
  });
  assert.equal(parseVersion('v8'), null);
});

test('manifest tag discovery ignores non-elements and sorts exact public tags', () => {
  const manifest = {
    modules: [{ declarations: [
      { customElement: true, tagName: 'lr-z' },
      { customElement: false, tagName: 'lr-hidden' },
      { customElement: true, tagName: 'lr-a' },
      { kind: 'class', name: 'Helper' },
    ] }],
  };
  assert.deepEqual(manifestComponentTags(manifest), ['lr-a', 'lr-z']);
});

test('validation fails closed on missing assignments and experimental semver exemptions', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  metadata.assignments['published-stable'].splice(
    metadata.assignments['published-stable'].indexOf('lr-graph'),
    1,
  );
  metadata.policy.semverCoverage.experimental = 'best-effort';

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(findings.some((finding) => finding.includes('lr-graph: no authored maturity assignment')));
  assert.ok(findings.some((finding) => finding.includes('experimental APIs must both retain full semver coverage')));
});

test('validation rejects a removal in the immediately following major and a missing replacement', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  const icon = metadata.deprecations.find((entry) => entry.tag === 'lr-icon');
  icon.removalNotBefore = '9.0.0';
  icon.replacement.name = 'missingCanvas';

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(findings.some((finding) => finding.includes('complete subsequent major release')));
  assert.ok(findings.some((finding) => finding.includes('replacement property missingCanvas does not exist')));
});

test('validation rejects unsorted, pre-introduction, and future deprecation records', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  metadata.deprecations.reverse();
  const icon = metadata.deprecations.find((entry) => entry.tag === 'lr-icon');
  icon.since = '3.0.0';
  const dateInput = metadata.deprecations.find((entry) =>
    entry.tag === 'lr-date-input' && entry.name === 'label');
  dateInput.since = '9.0.0';
  dateInput.removalNotBefore = '11.0.0';

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(findings.includes('deprecations must be sorted by tag, kind, and name'));
  assert.ok(findings.some((finding) =>
    finding.includes("lr-icon:property:autoWidth: deprecation cannot predate the component's 4.0.0 introduction")));
  assert.ok(findings.some((finding) =>
    finding.includes('lr-date-input:part:label: deprecation cannot start after the current package version')));
});

test('validation covers prose-only event, part, and CSS-property deprecations', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  metadata.deprecations = metadata.deprecations.filter((entry) =>
    !['lr-tool-call-chip', 'lr-sparkline', 'lr-flow-canvas'].includes(entry.tag));

  const findings = validateComponentMetadata(metadata, { ...state, metadata });
  assert.ok(findings.includes('lr-tool-call-chip:event:lr-tool-chip-select: manifest deprecation has no policy record'));
  assert.ok(findings.includes('lr-sparkline:part:base: manifest deprecation has no policy record'));
  assert.ok(findings.includes(
    'lr-flow-canvas:css-property:--lr-flow-canvas-node-current-outline-color: manifest deprecation has no policy record',
  ));
});

test('applying metadata changes only maturity records and remains deterministic', () => {
  const state = fixture();
  const stripped = structuredClone(state.inventory);
  for (const component of stripped.components) {
    component.maturity = { status: 'unclassified', since: null, deprecated: null };
  }
  const applied = applyMaturityToInventory(state.metadata, stripped);
  const second = applyMaturityToInventory(state.metadata, applied);
  assert.deepEqual(second, applied);
  assert.equal(applied.components.find((entry) => entry.tag === 'lr-graph').maturity.since, '4.0.0');
  assert.equal(applied.components.find((entry) => entry.tag === 'lr-page').maturity.since, '8.0.0');
  assert.equal(applied.components.find((entry) => entry.tag === 'lr-icon').maturity.deprecations.length, 1);
});

test('CEM projection surfaces status, since, policy, and structured member deprecation metadata', () => {
  const state = fixture();
  const manifest = structuredClone(state.manifest);
  applyComponentMetadataToManifest(state.metadata, manifest, {
    packageVersion: state.packageJson.version,
  });

  const declarations = manifest.modules.flatMap((module) => module.declarations ?? []);
  const graph = declarations.find((entry) => entry.tagName === 'lr-graph');
  assert.equal(graph.status, 'stable');
  assert.equal(graph.since, '4.0.0');
  assert.equal(graph.maturity.profile, 'published-stable');
  assert.match(graph.maturity.graduationCriteria, /Already stable/);

  const icon = declarations.find((entry) => entry.tagName === 'lr-icon');
  const autoWidth = icon.members.find((entry) => entry.kind === 'field' && entry.name === 'autoWidth');
  const autoWidthAttribute = icon.attributes.find((entry) => entry.name === 'auto-width');
  assert.equal(icon.deprecations.length, 1);
  assert.equal(autoWidth.deprecation.since, '8.0.0');
  assert.deepEqual(autoWidth.deprecation.replacement, {
    kind: 'property',
    name: 'canvas',
    usage: 'canvas="auto"',
  });
  assert.equal(autoWidth.deprecation.removalNotBefore, '10.0.0');
  assert.deepEqual(autoWidthAttribute.deprecation, autoWidth.deprecation);

  const dateInput = declarations.find((entry) => entry.tagName === 'lr-date-input');
  const basePart = dateInput.cssParts.find((entry) => entry.name === 'base');
  const labelPart = dateInput.cssParts.find((entry) => entry.name === 'label');
  assert.equal(basePart.deprecation.since, '8.0.0');
  assert.deepEqual(basePart.deprecation.replacement, {
    kind: 'part',
    name: 'date-input',
    usage: '::part(date-input)',
  });
  assert.equal(labelPart.deprecation.removalNotBefore, '10.0.0');

  const knownDate = declarations.find((entry) => entry.tagName === 'lr-known-date');
  const knownDateLabelPart = knownDate.cssParts.find((entry) => entry.name === 'label');
  assert.deepEqual(knownDateLabelPart.deprecation.replacement, {
    kind: 'part',
    name: 'form-control-label',
    usage: '::part(form-control-label)',
  });
  assert.equal(knownDateLabelPart.deprecation.removalNotBefore, '10.0.0');
  assert.deepEqual(validateManifestMetadataProjection(state.metadata, manifest, {
    packageVersion: state.packageJson.version,
  }), []);
});

test('Storybook presentation exposes central maturity and structured deprecations', () => {
  const state = fixture();
  const manifest = structuredClone(state.manifest);
  applyComponentMetadataToManifest(state.metadata, manifest, {
    packageVersion: state.packageJson.version,
  });
  const index = buildComponentMetadataIndex(manifest);
  const presentation = componentMetadataPresentation(index.get('lr-date-input'));

  assert.equal(presentation.status, 'experimental');
  assert.equal(presentation.since, '4.0.0');
  assert.match(presentation.rationale, /remains experimental under full semver protection/);
  assert.match(presentation.graduationCriteria, /demonstrate sustained reliability/);
  assert.deepEqual(presentation.deprecations.map((entry) => ({
    subject: entry.subject,
    since: entry.since,
    replacement: entry.replacement,
    removalNotBefore: entry.removalNotBefore,
  })), [
    {
      subject: 'part base',
      since: '8.0.0',
      replacement: '::part(date-input)',
      removalNotBefore: '10.0.0',
    },
    {
      subject: 'part label',
      since: '8.0.0',
      replacement: '::part(form-control-label)',
      removalNotBefore: '10.0.0',
    },
  ]);
  assert.equal(componentMetadataPresentation({ status: 'stable' }), null);
});

test('CEM projection reports drift and gives a new assigned tag the current package version', () => {
  const state = fixture();
  const metadata = structuredClone(state.metadata);
  metadata.assignments['new-component-experimental'].push('lr-new-component');
  const resolved = componentMetadataByTag(metadata, {
    tags: ['lr-new-component'],
    packageVersion: state.packageJson.version,
  });
  assert.equal(resolved.get('lr-new-component').status, 'experimental');
  assert.equal(resolved.get('lr-new-component').since, '8.0.0');

  const manifest = structuredClone(state.manifest);
  applyComponentMetadataToManifest(state.metadata, manifest, {
    packageVersion: state.packageJson.version,
  });
  const graph = manifest.modules
    .flatMap((module) => module.declarations ?? [])
    .find((entry) => entry.tagName === 'lr-graph');
  graph.since = '8.0.0';
  assert.deepEqual(validateManifestMetadataProjection(state.metadata, manifest, {
    packageVersion: state.packageJson.version,
  }), ['lr-graph: manifest maturity/deprecation projection drifted']);
});

test('the final analyzer plugin projects central metadata into generated CEM', () => {
  const plugin = cemConfig.plugins.find((entry) => entry.name === 'lr-component-maturity-metadata');
  assert.ok(plugin);
  const manifest = {
    modules: [{
      declarations: [{
        kind: 'class',
        name: 'LyraGraph',
        customElement: true,
        tagName: 'lr-graph',
      }],
    }],
  };
  plugin.packageLinkPhase({ customElementsManifest: manifest });
  assert.equal(manifest.modules[0].declarations[0].status, 'stable');
  assert.equal(manifest.modules[0].declarations[0].since, '4.0.0');
});

test('source annotations replace stale tags on the exact component JSDoc idempotently', () => {
  const source = `/** Helper documentation. */
export class Helper {}

/**
 * Component documentation.
 * @customElement lr-example
 * @status experimental
 * @since 3.8
 */
export class LyraExample {}
`;
  const expected = `/** Helper documentation. */
export class Helper {}

/**
 * Component documentation.
 * @customElement lr-example
 * @status stable
 * @since 4.0.0
 */
export class LyraExample {}
`;
  const annotated = annotateComponentSource(source, {
    tag: 'lr-example',
    status: 'stable',
    since: '4.0.0',
  });
  assert.equal(annotated, expected);
  assert.equal(annotateComponentSource(annotated, {
    tag: 'lr-example',
    status: 'stable',
    since: '4.0.0',
  }), expected);
});

test('source annotation fails closed when the component JSDoc is detached', () => {
  assert.throws(() => annotateComponentSource(`/**
 * @customElement lr-example
 */
const detached = true;
export class LyraExample {}
`, {
    tag: 'lr-example',
    status: 'stable',
    since: '4.0.0',
  }), /directly above/);
});
