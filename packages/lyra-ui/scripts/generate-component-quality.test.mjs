import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { buildQualityArtifacts, projectQualityMetadata, qualityArtifactFindings } from './generate-component-quality.mjs';
import { retainedComponentQualityMetadata } from './generate-component-inventory.mjs';
import { partitionVisualManifest } from './visual-manifest-source.mjs';

const inventory = {
  schemaVersion: 1,
  components: [
    { tag: 'lr-a', maturity: { status: 'stable' }, surface: { form: { associated: true } } },
    { tag: 'lr-b', maturity: { status: 'experimental' }, surface: { form: { associated: false } } },
  ],
};

const qualification = {
  components: [
    {
      tag: 'lr-a',
      qualification: { status: 'incomplete', humanReview: 'pending' },
      dimensions: { accessibility: { status: 'automated' } },
    },
    {
      tag: 'lr-b',
      qualification: { status: 'pending-human-review', humanReview: 'pending' },
      dimensions: { accessibility: { status: 'reviewed-exemption' } },
    },
  ],
};

const integration = {
  components: [
    { tag: 'lr-a', dependencies: { direct: ['lr-b'], transitive: [] } },
    { tag: 'lr-b', dependencies: { direct: [], transitive: [] } },
  ],
};

test('projects compact qualification and dependency metadata without changing maturity or FACE truth', () => {
  const projected = projectQualityMetadata(inventory, qualification, integration);
  assert.equal(projected.components[0].maturity.status, 'stable');
  assert.equal(projected.components[1].maturity.status, 'experimental');
  assert.equal(projected.components[0].surface.form.associated, true);
  assert.deepEqual(projected.components[0].qualification, {
    status: 'incomplete',
    humanReview: 'pending',
    reviewer: null,
    reviewedAt: null,
    accessibility: 'automated',
    ledger: 'scripts/fixtures/component-qualification.json',
  });
  assert.deepEqual(projected.components[0].dependencies, {
    direct: ['lr-b'],
    transitive: [],
    ledger: 'scripts/fixtures/component-integration.json',
  });
});

test('new inventory entries fail visibly as pending instead of inheriting another tag’s evidence', () => {
  const projected = projectQualityMetadata(
    { schemaVersion: 1, components: [...inventory.components, { tag: 'lr-new', maturity: { status: 'experimental' } }] },
    qualification,
    integration,
  );
  assert.deepEqual(projected.components[2].qualification, {
    status: 'pending-generation',
    humanReview: 'pending',
    reviewer: null,
    reviewedAt: null,
    accessibility: 'not-recorded',
    ledger: 'scripts/fixtures/component-qualification.json',
  });
  assert.deepEqual(projected.components[2].dependencies.direct, []);
});

test('component inventory regeneration retains quality metadata and defaults new tags to pending', () => {
  const retained = retainedComponentQualityMetadata({
    qualification: inventory.components[0].qualification ?? qualification.components[0].qualification,
    dependencies: integration.components[0].dependencies,
  });
  assert.equal(retained.qualification.status, 'incomplete');
  assert.deepEqual(retained.dependencies.direct, ['lr-b']);
  const pending = retainedComponentQualityMetadata(null);
  assert.equal(pending.qualification.status, 'pending-generation');
  assert.equal(pending.qualification.humanReview, 'pending');
  assert.deepEqual(pending.dependencies.direct, []);
});

test('artifact freshness compares every generated ledger, dashboard, and projected inventory', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-quality-artifacts-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const paths = Object.fromEntries(
    ['inventory', 'qualification', 'integration', 'qualityDocs', 'integrationDocs']
      .map((name) => [name, path.join(directory, `${name}.txt`)]),
  );
  const artifacts = {
    inventory: { schemaVersion: 1 },
    qualification: { schemaVersion: 1 },
    integration: { schemaVersion: 1 },
    qualityDocs: '# quality\n',
    integrationDocs: '# integration\n',
  };
  fs.writeFileSync(paths.inventory, `${JSON.stringify(artifacts.inventory, null, 2)}\n`);
  fs.writeFileSync(paths.qualification, `${JSON.stringify(artifacts.qualification, null, 2)}\n`);
  fs.writeFileSync(paths.integration, `${JSON.stringify(artifacts.integration, null, 2)}\n`);
  fs.writeFileSync(paths.qualityDocs, artifacts.qualityDocs);
  fs.writeFileSync(paths.integrationDocs, artifacts.integrationDocs);
  assert.deepEqual(qualityArtifactFindings(artifacts, paths), []);
  fs.writeFileSync(paths.qualityDocs, '# stale\n');
  assert.equal(qualityArtifactFindings(artifacts, paths).length, 1);
});

test('quality generation uses current dependencies before qualification and is write-check stable', async (t) => {
  const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lyra-quality-dependencies-'));
  t.after(() => fs.rmSync(packageRoot, { recursive: true, force: true }));
  const write = (relative, contents) => {
    const file = path.join(packageRoot, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, contents);
    return file;
  };
  const json = (relative, value) => write(relative, `${JSON.stringify(value, null, 2)}\n`);
  const fixtureInventory = {
    schemaVersion: 1,
    components: ['control', 'wrapper', 'outer', 'passive'].map((name) => ({
      tag: `lr-${name}`,
      family: 'utility',
      classModule: `src/components/utility/${name}/${name}.class.ts`,
      registrationModule: `src/components/utility/${name}/${name}.ts`,
      optionalPeers: [],
      maturity: { status: 'experimental' },
    })),
  };
  fixtureInventory.components.find(({ tag }) => tag === 'lr-outer').dependencies = {
    direct: [], transitive: [],
  };
  fixtureInventory.components.find(({ tag }) => tag === 'lr-passive').dependencies = {
    direct: ['lr-wrapper'], transitive: ['lr-control'],
  };
  for (const component of fixtureInventory.components) {
    const name = component.tag.slice('lr-'.length);
    const dependency = name === 'wrapper' ? 'control' : name === 'outer' ? 'wrapper' : null;
    const markup = name === 'control' ? '<button>Choose</button>'
      : dependency ? `<lr-${dependency}></lr-${dependency}>` : '<span>Read only</span>';
    write(component.classModule, `export class Fixture { render() { return html\`${markup}\`; } }\n`);
    write(component.registrationModule,
      `import { Fixture } from './${name}.class.js';\n` +
      (dependency ? `import '../${dependency}/${dependency}.js';\n` : '') +
      `defineElement('${name}', Fixture);\n`);
    write(`src/components/utility/${name}/${name}.test.ts`, `
      it('is accessible when populated', async () => {
        const el = await fixture(html\`<${component.tag} .items=\${[1]}></${component.tag}>\`);
        await expect(el).to.be.accessible();
      });
    `);
  }
  const visualManifest = {
    schemaVersion: 1,
    axes: [{ name: 'light', artifactPolicy: 'evidence-only' }],
    coverageProfiles: { standard: { axes: ['light'] } },
    stories: fixtureInventory.components.map(({ tag }) => ({ id: `${tag}--default`, profile: 'standard' })),
    tagCoverage: Object.fromEntries(fixtureInventory.components.map(({ tag }) => [tag, [`${tag}--default`]])),
    untaggedStories: {},
    provenance: { humanVisualReview: false },
    baselineReview: { status: 'pending-human-review', reviewer: null, reviewedAt: null },
  };
  json('scripts/component-families.json', { families: [{ key: 'utility' }] });
  const paths = {
    inventory: json('scripts/fixtures/component-inventory.json', fixtureInventory),
    qualification: path.join(packageRoot, 'scripts/fixtures/component-qualification.json'),
    integration: path.join(packageRoot, 'scripts/fixtures/component-integration.json'),
    exemptions: json('scripts/qualification-exemptions.json', { schemaVersion: 2, exemptions: [] }),
    visual: json('visual-baselines/manifest.json', visualManifest),
    ssr: write('src/ssr.ts', 'export const matrix = {};\n'),
    packageJson: json('package.json', {}),
    qualityDocs: path.join(packageRoot, 'docs/component-quality.md'),
    integrationDocs: path.join(packageRoot, 'docs/component-integration.md'),
  };
  const visualSources = partitionVisualManifest(visualManifest, {
    familyNames: ['utility'],
    familyByTag: Object.fromEntries(fixtureInventory.components.map(({ tag }) => [tag, 'utility'])),
    storyOwners: Object.fromEntries(visualManifest.stories.map(({ id }) => [id, 'utility'])),
  });
  for (const [relative, contents] of Object.entries(visualSources)) write(relative, contents);

  const first = await buildQualityArtifacts({ paths, packageRoot });
  for (const tag of ['lr-wrapper', 'lr-outer']) {
    const record = first.qualification.components.find((component) => component.tag === tag);
    assert.equal(record.dimensions.keyboard.applicability, 'applicable', `${tag} uses current composed interaction`);
    assert.equal(record.dimensions.keyboard.status, 'not-recorded', `${tag} has no invented keyboard test evidence`);
  }
  assert.equal(first.qualification.components.find(({ tag }) => tag === 'lr-passive')
    .dimensions.keyboard.applicability, 'not-applicable', 'stale dependency edges do not invent interaction');
  assert.deepEqual(first.inventory.components.find(({ tag }) => tag === 'lr-wrapper').dependencies.direct, ['lr-control']);
  assert.deepEqual(first.inventory.components.find(({ tag }) => tag === 'lr-outer').dependencies, {
    direct: ['lr-wrapper'], transitive: ['lr-control'], ledger: 'scripts/fixtures/component-integration.json',
  });
  assert.deepEqual(first.inventory.components.find(({ tag }) => tag === 'lr-passive').dependencies.direct, []);

  for (const name of ['inventory', 'qualification', 'integration', 'qualityDocs', 'integrationDocs']) {
    const file = paths[name];
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, typeof first[name] === 'string' ? first[name] : `${JSON.stringify(first[name], null, 2)}\n`);
  }
  const second = await buildQualityArtifacts({ paths, packageRoot });
  assert.deepEqual(qualityArtifactFindings(second, paths), []);
  assert.deepEqual(second, first);
});
