import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';

import {
  parseCreateComponentArgs,
  scaffoldComponent,
} from './create-component.mjs';

const temporaryDirectories = [];

function write(file, source) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, source);
}

function fixturePackage() {
  const packageDir = mkdtempSync(join(tmpdir(), 'lyra-create-component-'));
  temporaryDirectories.push(packageDir);
  write(
    join(packageDir, 'scripts/component-families.json'),
    `${JSON.stringify(
      {
        families: [{ key: 'utility', label: 'Utility' }],
        directories: { existing: 'utility' },
      },
      null,
      2,
    )}\n`,
  );
  write(join(packageDir, 'src/components/utility/index.ts'), "export * from './existing/existing.js';\n");
  write(join(packageDir, 'llms/utility.md'), '## `lr-existing`\n\nExisting docs.\n');
  write(
    join(packageDir, 'scripts/fixtures/component-inventory.json'),
    `${JSON.stringify(
      {
        $comment: 'test fixture',
        schemaVersion: 1,
        pins: {},
        components: [],
        localMigrations: [],
        upstreams: {},
        mappings: [],
      },
      null,
      2,
    )}\n`,
  );
  write(
    join(packageDir, 'scripts/fixtures/component-metadata.json'),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        profiles: {
          'new-component-experimental': {
            status: 'experimental',
            rationale:
              'This newly scaffolded component is an unreleased public-surface candidate whose API is still under maintainer review.',
            graduationCriteria:
              'Graduate to stable only after its documented API, populated accessibility state, three-engine behavior, and compatibility contract pass review and a release qualification.',
          },
        },
        assignments: { 'new-component-experimental': [] },
      },
      null,
      2,
    )}\n`,
  );
  write(join(packageDir, 'custom-elements.json'), '{\n  "schemaVersion": "1.0.0",\n  "modules": []\n}\n');
  write(join(packageDir, 'src/lyra.ts'), '// generated fixture\n');
  write(join(packageDir, 'src/internal/root-registration-allowlist.ts'), '// generated fixture\n');
  write(join(packageDir, 'package.json'), '{"name":"@aceshooting/lyra-ui","version":"8.0.0"}\n');
  return packageDir;
}

function manifestFor({ family, name, className }) {
  return {
    schemaVersion: '1.0.0',
    modules: [
      {
        kind: 'javascript-module',
        path: `src/components/${family}/${name}/${name}.class.ts`,
        declarations: [
          {
            kind: 'class',
            name: className,
            customElement: true,
            tagName: `lr-${name}`,
            slots: [{ name: '', description: 'Main content.' }],
            cssParts: [{ name: 'base', description: 'The content container.' }],
            members: [],
          },
        ],
      },
    ],
  };
}

function successfulRunner(packageDir, steps) {
  return (step) => {
    steps.push(step);
    if (step.id === 'manifest') {
      writeFileSync(
        join(packageDir, 'custom-elements.json'),
        `${JSON.stringify(
          manifestFor({ family: 'utility', name: 'status-panel', className: 'LyraStatusPanel' }),
          null,
          2,
        )}\n`,
      );
    }
    if (step.id === 'component-metadata') {
      const path = join(packageDir, 'scripts/fixtures/component-inventory.json');
      const inventory = JSON.parse(readFileSync(path, 'utf8'));
      const entry = inventory.components.find((component) => component.tag === 'lr-status-panel');
      entry.maturity = {
        status: 'experimental',
        since: '8.0.0',
        deprecated: null,
        profile: 'new-component-experimental',
        rationale:
          'This newly scaffolded component is an unreleased public-surface candidate whose API is still under maintainer review.',
        graduationCriteria:
          'Graduate to stable only after its documented API, populated accessibility state, three-engine behavior, and compatibility contract pass review and a release qualification.',
        deprecations: [],
      };
      writeFileSync(path, `${JSON.stringify(inventory, null, 2)}\n`);
    }
  };
}

test.after(() => {
  for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true });
});

test('parses the documented --family/--name interface and rejects ambiguous arguments', () => {
  assert.deepEqual(parseCreateComponentArgs(['--family', 'utility', '--name=status-panel']), {
    family: 'utility',
    name: 'status-panel',
  });
  assert.throws(() => parseCreateComponentArgs(['--family', 'utility']), /--name/);
  assert.throws(
    () => parseCreateComponentArgs(['--family', 'utility', '--name', 'status-panel', '--wat']),
    /Unknown argument: --wat/,
  );
  assert.throws(
    () => parseCreateComponentArgs(['--family', 'utility', '--family', 'forms', '--name', 'status-panel']),
    /--family was provided more than once/,
  );
});

test('creates a complete populated component scaffold and runs focused three-engine verification', async () => {
  const packageDir = fixturePackage();
  const steps = [];

  const result = await scaffoldComponent({
    packageDir,
    family: 'utility',
    name: 'status-panel',
    runStep: successfulRunner(packageDir, steps),
  });

  assert.deepEqual(result, {
    tag: 'lr-status-panel',
    className: 'LyraStatusPanel',
    componentDirectory: join(packageDir, 'src/components/utility/status-panel'),
  });

  const componentDir = result.componentDirectory;
  const expectedFiles = [
    'status-panel.class.ts',
    'status-panel.ts',
    'status-panel.styles.ts',
    'status-panel.test.ts',
    'status-panel.stories.ts',
  ];
  for (const file of expectedFiles) assert.ok(existsSync(join(componentDir, file)), `${file} was created`);

  const classSource = readFileSync(join(componentDir, 'status-panel.class.ts'), 'utf8');
  assert.match(classSource, /export class LyraStatusPanel extends LyraElement/);
  assert.match(classSource, /@customElement lr-status-panel/);
  assert.match(classSource, /part="base"/);
  const registrationSource = readFileSync(join(componentDir, 'status-panel.ts'), 'utf8');
  assert.match(registrationSource, /defineElement\('status-panel', LyraStatusPanel\)/);

  const testSource = readFileSync(join(componentDir, 'status-panel.test.ts'), 'utf8');
  assert.match(testSource, /Populated Status Panel content/);
  assert.match(testSource, /assignedElements/);
  assert.match(testSource, /to\.be\.accessible/);
  const storySource = readFileSync(join(componentDir, 'status-panel.stories.ts'), 'utf8');
  assert.match(storySource, /<lr-status-panel>/);
  assert.match(storySource, /Populated Status Panel content/);

  assert.match(
    readFileSync(join(packageDir, 'src/components/utility/index.ts'), 'utf8'),
    /\.\/status-panel\/status-panel\.js/,
  );
  assert.match(readFileSync(join(packageDir, 'llms/utility.md'), 'utf8'), /## `lr-status-panel`/);
  const families = JSON.parse(readFileSync(join(packageDir, 'scripts/component-families.json'), 'utf8'));
  assert.equal(families.directories['status-panel'], 'utility');

  const inventory = JSON.parse(
    readFileSync(join(packageDir, 'scripts/fixtures/component-inventory.json'), 'utf8'),
  );
  const entry = inventory.components.find((component) => component.tag === 'lr-status-panel');
  assert.deepEqual(entry.maturity, {
    status: 'experimental',
    since: '8.0.0',
    deprecated: null,
    profile: 'new-component-experimental',
    rationale:
      'This newly scaffolded component is an unreleased public-surface candidate whose API is still under maintainer review.',
    graduationCriteria:
      'Graduate to stable only after its documented API, populated accessibility state, three-engine behavior, and compatibility contract pass review and a release qualification.',
    deprecations: [],
  });
  assert.equal(entry.family, 'utility');
  assert.equal(entry.rootIncluded, true);
  assert.deepEqual(entry.surface.slots, [{ name: '', deprecated: null }]);
  assert.deepEqual(entry.surface.parts, [{ name: 'base', deprecated: null }]);

  assert.deepEqual(
    steps.map((step) => step.id),
    [
      'manifest',
      'component-metadata',
      'registrations',
      'component-families',
      'component-inventory',
      'registration-check',
      'coverage-check',
      'test-chromium',
      'test-firefox',
      'test-webkit',
    ],
  );
  assert.deepEqual(
    steps.filter((step) => step.id.startsWith('test-')).map((step) => step.env.WTR_BROWSER),
    ['chromium', 'firefox', 'webkit'],
  );
});

test('rejects invalid, traversal, and already-prefixed names before writing', async () => {
  const invalidRequests = [
    { family: '../utility', name: 'status-panel', pattern: /Invalid family/ },
    { family: 'unknown', name: 'status-panel', pattern: /Unknown component family/ },
    { family: 'utility', name: '../status-panel', pattern: /Invalid component name/ },
    { family: 'utility', name: 'StatusPanel', pattern: /Invalid component name/ },
    { family: 'utility', name: 'status_panel', pattern: /Invalid component name/ },
    { family: 'utility', name: 'lr-video', pattern: /unprefixed component name/ },
    { family: 'utility', name: 'wa-video', pattern: /unprefixed component name/ },
    { family: 'utility', name: 'sl-video', pattern: /unprefixed component name/ },
  ];

  for (const request of invalidRequests) {
    const packageDir = fixturePackage();
    await assert.rejects(
      scaffoldComponent({ packageDir, ...request, runStep: () => assert.fail('runner must not execute') }),
      request.pattern,
    );
    assert.equal(existsSync(join(packageDir, 'src/components/utility/status-panel')), false);
  }
});

test('detects directory, inventory, catalog, barrel, docs, and manifest collisions', async (t) => {
  const cases = [
    {
      name: 'directory',
      mutate(packageDir) {
        mkdirSync(join(packageDir, 'src/components/utility/status-panel'));
      },
    },
    {
      name: 'inventory',
      mutate(packageDir) {
        const path = join(packageDir, 'scripts/fixtures/component-inventory.json');
        const inventory = JSON.parse(readFileSync(path, 'utf8'));
        inventory.components.push({ tag: 'lr-status-panel' });
        writeFileSync(path, `${JSON.stringify(inventory, null, 2)}\n`);
      },
    },
    {
      name: 'catalog',
      mutate(packageDir) {
        const path = join(packageDir, 'scripts/component-families.json');
        const catalog = JSON.parse(readFileSync(path, 'utf8'));
        catalog.directories['status-panel'] = 'utility';
        writeFileSync(path, `${JSON.stringify(catalog, null, 2)}\n`);
      },
    },
    {
      name: 'barrel',
      mutate(packageDir) {
        writeFileSync(
          join(packageDir, 'src/components/utility/index.ts'),
          "export * from './status-panel/status-panel.js';\n",
        );
      },
    },
    {
      name: 'docs',
      mutate(packageDir) {
        writeFileSync(join(packageDir, 'llms/utility.md'), '## `lr-status-panel`\n');
      },
    },
    {
      name: 'manifest',
      mutate(packageDir) {
        writeFileSync(
          join(packageDir, 'custom-elements.json'),
          `${JSON.stringify(
            manifestFor({ family: 'utility', name: 'status-panel', className: 'LyraStatusPanel' }),
            null,
            2,
          )}\n`,
        );
      },
    },
  ];

  for (const collision of cases) {
    await t.test(collision.name, async () => {
      const packageDir = fixturePackage();
      collision.mutate(packageDir);
      await assert.rejects(
        scaffoldComponent({
          packageDir,
          family: 'utility',
          name: 'status-panel',
          runStep: () => assert.fail('runner must not execute'),
        }),
        /collision/i,
      );
    });
  }
});

test('rolls back every authored file when focused regeneration fails', async () => {
  const packageDir = fixturePackage();
  const before = {
    index: readFileSync(join(packageDir, 'src/components/utility/index.ts'), 'utf8'),
    docs: readFileSync(join(packageDir, 'llms/utility.md'), 'utf8'),
    families: readFileSync(join(packageDir, 'scripts/component-families.json'), 'utf8'),
    inventory: readFileSync(join(packageDir, 'scripts/fixtures/component-inventory.json'), 'utf8'),
    metadata: readFileSync(join(packageDir, 'scripts/fixtures/component-metadata.json'), 'utf8'),
    manifest: readFileSync(join(packageDir, 'custom-elements.json'), 'utf8'),
  };

  await assert.rejects(
    scaffoldComponent({
      packageDir,
      family: 'utility',
      name: 'status-panel',
      runStep(step) {
        if (step.id === 'manifest') {
          writeFileSync(
            join(packageDir, 'custom-elements.json'),
            `${JSON.stringify(
              manifestFor({ family: 'utility', name: 'status-panel', className: 'LyraStatusPanel' }),
              null,
              2,
            )}\n`,
          );
          return;
        }
        throw new Error('simulated registration failure');
      },
    }),
    /simulated registration failure/,
  );

  assert.equal(existsSync(join(packageDir, 'src/components/utility/status-panel')), false);
  assert.equal(readFileSync(join(packageDir, 'src/components/utility/index.ts'), 'utf8'), before.index);
  assert.equal(readFileSync(join(packageDir, 'llms/utility.md'), 'utf8'), before.docs);
  assert.equal(readFileSync(join(packageDir, 'scripts/component-families.json'), 'utf8'), before.families);
  assert.equal(
    readFileSync(join(packageDir, 'scripts/fixtures/component-inventory.json'), 'utf8'),
    before.inventory,
  );
  assert.equal(
    readFileSync(join(packageDir, 'scripts/fixtures/component-metadata.json'), 'utf8'),
    before.metadata,
  );
  assert.equal(readFileSync(join(packageDir, 'custom-elements.json'), 'utf8'), before.manifest);
});
