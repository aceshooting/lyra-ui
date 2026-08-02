import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  ROOT_REGISTRATION_END,
  ROOT_REGISTRATION_START,
  checkRegistrationArtifacts,
  deriveRegistrationArtifacts,
  generateRegistrationArtifacts,
  updateRootBarrel,
} from './generate-registration-artifacts.mjs';
import { CURATED_PUBLIC_SIDE_EFFECT_ENTRIES } from './generate-side-effects.mjs';

const inventory = {
  schemaVersion: 1,
  components: [
    {
      tag: 'lr-beta',
      registrationModule: 'src/components/forms/alpha/beta-entry.ts',
      rootIncluded: true,
      rootExclusion: null,
      optionalPeers: [],
    },
    {
      tag: 'lr-alpha',
      registrationModule: 'src/components/forms/zeta/alpha-entry.ts',
      rootIncluded: true,
      rootExclusion: null,
      optionalPeers: [],
    },
    {
      tag: 'lr-optional',
      registrationModule: 'src/components/charts/optional/optional.ts',
      rootIncluded: false,
      rootExclusion: 'optional-peer-family',
      optionalPeers: ['chart.js'],
    },
  ],
};

const artifacts = deriveRegistrationArtifacts(inventory);
assert.deepEqual(artifacts.rootTags, ['lr-alpha', 'lr-beta']);
assert.deepEqual(artifacts.optionalTags, ['lr-optional']);
assert.deepEqual(
  artifacts.rootComponents.map((component) => component.specifier),
  [
    './components/forms/zeta/alpha-entry.js',
    './components/forms/alpha/beta-entry.js',
  ],
  'registration imports sort by inventory tag and use the exact inventory module',
);

for (const [description, mutate, expected] of [
  [
    'unknown schemas fail closed',
    (fixture) => {
      fixture.schemaVersion = 2;
    },
    /schemaVersion must be 1/,
  ],
  [
    'duplicate registration modules fail closed',
    (fixture) => {
      fixture.components[1].registrationModule = fixture.components[0].registrationModule;
    },
    /duplicate registrationModule/,
  ],
  [
    'included components cannot carry exclusion metadata',
    (fixture) => {
      fixture.components[0].rootExclusion = 'optional-peer-family';
    },
    /included component cannot have rootExclusion/,
  ],
  [
    'excluded components must name a peer',
    (fixture) => {
      fixture.components[2].optionalPeers = [];
    },
    /must name at least one peer/,
  ],
]) {
  const fixture = structuredClone(inventory);
  mutate(fixture);
  assert.throws(() => deriveRegistrationArtifacts(fixture), expected, description);
}

const legacy = [
  '// Side-effect imports register every component…',
  "import './components/forms/alpha/beta-entry.js';",
  "import './components/viewers/archive/archive-register.js';",
  "import './components/forms/zeta/alpha-entry.js';",
  "import './components/forms/alpha/beta-entry.js';",
  '',
  '// …and the barrel re-exports classes, helpers, and types.',
  "export { ManualExport } from './manual.js';",
  '',
].join('\n');
const migrated = updateRootBarrel(legacy, artifacts);
assert.ok(migrated.startsWith(ROOT_REGISTRATION_START));
assert.ok(migrated.includes(ROOT_REGISTRATION_END));
assert.match(migrated, /Curated companion registrations/);
assert.equal(
  migrated.slice(migrated.indexOf('// …and the barrel')),
  legacy.slice(legacy.indexOf('// …and the barrel')),
  'the curated named-export region is byte-for-byte stable',
);
assert.equal(updateRootBarrel(migrated, artifacts), migrated, 'marked regeneration is idempotent');
assert.throws(
  () =>
    updateRootBarrel(
      legacy.replace(
        "import './components/forms/alpha/beta-entry.js';",
        "import './components/manual/untracked.js';",
      ),
      artifacts,
    ),
  /non-inventory module/,
  'legacy migration refuses to discard an unclassified side-effect import',
);

const fixtureRoot = mkdtempSync(join(tmpdir(), 'lyra-registration-artifacts-'));
const write = (relativePath, contents) => {
  const target = join(fixtureRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
};

try {
  write('scripts/fixtures/component-inventory.json', `${JSON.stringify(inventory, null, 2)}\n`);
  for (const component of inventory.components) {
    write(component.registrationModule, 'defineElement();\n');
  }
  write('src/components/viewers/archive/archive-register.ts', 'registerRenderer();\n');
  write('src/translations/fr.ts', "registerLyraLocale('fr', {});\n");
  write('src/theme.css', ':root { --lr-test: 1; }\n');
  for (const entry of CURATED_PUBLIC_SIDE_EFFECT_ENTRIES) {
    write(entry.source, 'export {};\n');
  }
  write('src/lyra.ts', legacy);
  write('src/internal/root-registration-allowlist.ts', 'export const stale = true;\n');
  write(
    'package.json',
    `${JSON.stringify({
      name: 'registration-fixture',
      exports: Object.fromEntries(
        CURATED_PUBLIC_SIDE_EFFECT_ENTRIES.map((entry) => {
          const distTarget = `./dist/${entry.source.slice('src/'.length).replace(/\.ts$/, '.js')}`;
          return [entry.exportPath, {
            types: distTarget.replace(/\.js$/, '.d.ts'),
            default: distTarget,
          }];
        }),
      ),
      sideEffects: ['./stale.js'],
    }, null, 2)}\n`,
  );

  assert.deepEqual(
    checkRegistrationArtifacts(fixtureRoot).findings,
    [
      'src/lyra.ts generated registration block is stale',
      'src/internal/root-registration-allowlist.ts is stale',
      'package.json#sideEffects is stale',
    ],
  );

  generateRegistrationArtifacts(fixtureRoot);
  assert.deepEqual(checkRegistrationArtifacts(fixtureRoot).findings, []);

  const generatedRoot = readFileSync(join(fixtureRoot, 'src/lyra.ts'), 'utf8');
  assert.ok(generatedRoot.includes("import './components/forms/zeta/alpha-entry.js';"));
  assert.ok(generatedRoot.includes("import './components/forms/alpha/beta-entry.js';"));
  assert.ok(!generatedRoot.includes("import './components/charts/optional/optional.js';"));
  assert.ok(generatedRoot.includes("import './components/viewers/archive/archive-register.js';"));
  assert.equal(
    generatedRoot.slice(generatedRoot.indexOf('// …and the barrel')),
    legacy.slice(legacy.indexOf('// …and the barrel')),
  );

  const allowlist = readFileSync(
    join(fixtureRoot, 'src/internal/root-registration-allowlist.ts'),
    'utf8',
  );
  assert.match(allowlist, /ROOT_BARREL_TAGS = \[\n  'lr-alpha',\n  'lr-beta',/);
  assert.match(allowlist, /ROOT_BARREL_OPTIONAL_PEER_TAGS = \[\n  'lr-optional',/);

  const sideEffects = JSON.parse(readFileSync(join(fixtureRoot, 'package.json'), 'utf8')).sideEffects;
  assert.deepEqual(sideEffects, [...new Set(sideEffects)].sort());
  for (const entry of [
    './dist/autoloader-cdn.js',
    './dist/ssr-loader.js',
    './dist/components/charts/optional/optional.js',
    './dist/components/forms/alpha/beta-entry.js',
    './dist/components/forms/zeta/alpha-entry.js',
    './dist/components/viewers/archive/archive-register.js',
    './dist/lyra.js',
    './dist/theme.css',
    './dist/translations/fr.js',
    './src/components/charts/optional/optional.ts',
    './src/components/forms/alpha/beta-entry.ts',
    './src/components/forms/zeta/alpha-entry.ts',
    './src/components/viewers/archive/archive-register.ts',
    './src/autoloader-cdn.ts',
    './src/lyra.ts',
    './src/ssr-loader.ts',
    './src/theme.css',
    './src/translations/fr.ts',
  ]) {
    assert.ok(sideEffects.includes(entry), `missing generated side effect ${entry}`);
  }

  const before = new Map(
    [
      'src/lyra.ts',
      'src/internal/root-registration-allowlist.ts',
      'package.json',
    ].map((file) => [file, readFileSync(join(fixtureRoot, file), 'utf8')]),
  );
  generateRegistrationArtifacts(fixtureRoot);
  for (const [file, contents] of before) {
    assert.equal(readFileSync(join(fixtureRoot, file), 'utf8'), contents, `${file} must be idempotent`);
  }
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('registration artifact generation and determinism tests passed.');
