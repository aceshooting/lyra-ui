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
  ALL_REGISTRATION_END,
  ALL_REGISTRATION_START,
  SSR_ALL_REGISTRATION_END,
  SSR_ALL_REGISTRATION_START,
  checkRegistrationArtifacts,
  deriveRegistrationArtifacts,
  generateRegistrationArtifacts,
  updateAllBarrel,
  updateSsrAllBarrel,
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
assert.deepEqual(artifacts.allTags, ['lr-alpha', 'lr-beta', 'lr-optional']);
assert.deepEqual(artifacts.optionalTags, ['lr-optional']);
assert.deepEqual(
  artifacts.rootComponents.map((component) => component.specifier),
  [
    './components/forms/zeta/alpha-entry.js',
    './components/forms/alpha/beta-entry.js',
  ],
  'all.js registration imports sort by inventory tag and use the exact inventory module',
);
assert.deepEqual(
  artifacts.allComponents.map((component) => component.ssrSpecifier),
  [
    '../components/forms/zeta/alpha-entry.js',
    '../components/forms/alpha/beta-entry.js',
    '../components/charts/optional/optional.js',
  ],
  'ssr/all.js registration imports cover the optional-peer families the browser entry omits',
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

const allBarrel = [
  ALL_REGISTRATION_START,
  "import './components/stale/stale.js';",
  ALL_REGISTRATION_END,
  '',
  "import './components/viewers/archive/archive-register.js';",
  '',
  "export * from './lyra.js';",
  '',
].join('\n');
const generatedAllBarrel = updateAllBarrel(allBarrel, artifacts);
assert.ok(generatedAllBarrel.startsWith(ALL_REGISTRATION_START));
assert.ok(generatedAllBarrel.includes("import './components/forms/zeta/alpha-entry.js';"));
assert.ok(generatedAllBarrel.includes("import './components/forms/alpha/beta-entry.js';"));
assert.ok(
  !generatedAllBarrel.includes("import './components/charts/optional/optional.js';"),
  'optional-peer families stay out of the browser compatibility entry',
);
assert.ok(!generatedAllBarrel.includes("import './components/stale/stale.js';"));
assert.equal(
  generatedAllBarrel.slice(generatedAllBarrel.indexOf("import './components/viewers/archive")),
  allBarrel.slice(allBarrel.indexOf("import './components/viewers/archive")),
  'the curated region below the generated block is byte-for-byte stable',
);
assert.equal(updateAllBarrel(generatedAllBarrel, artifacts), generatedAllBarrel, 'regeneration is idempotent');

assert.throws(
  () => updateAllBarrel(allBarrel.replace(ALL_REGISTRATION_END, ''), artifacts),
  /src\/all\.ts is missing its generated registration block/,
  'a lost marker pair reports what to restore instead of silently rewriting the file',
);
assert.throws(
  () => updateAllBarrel(`${allBarrel}\n${ALL_REGISTRATION_START}\n${ALL_REGISTRATION_END}\n`, artifacts),
  /duplicate generated registration markers/,
  'duplicate marker pairs fail closed',
);
assert.throws(
  () =>
    updateAllBarrel(
      allBarrel.replace(
        "import './components/viewers/archive/archive-register.js';",
        "import './components/manual/untracked.js';",
      ),
      artifacts,
    ),
  /non-inventory side-effect import/,
  'regeneration refuses to strand an unclassified side-effect import outside the block',
);

const ssrAllBarrel = [
  SSR_ALL_REGISTRATION_START,
  SSR_ALL_REGISTRATION_END,
  '',
  "export * from '../lyra.js';",
  '',
].join('\n');
const generatedSsrAllBarrel = updateSsrAllBarrel(ssrAllBarrel, artifacts);
assert.ok(generatedSsrAllBarrel.includes("import '../components/charts/optional/optional.js';"));
assert.equal(
  updateSsrAllBarrel(generatedSsrAllBarrel, artifacts),
  generatedSsrAllBarrel,
  'ssr regeneration is idempotent',
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
  write('src/lyra.ts', "export { Manual } from './manual.js';\n");
  write('src/all.ts', allBarrel);
  write('src/ssr/all.ts', ssrAllBarrel);
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
      'src/all.ts generated registration block is stale',
      'src/ssr/all.ts generated registration block is stale',
      'src/internal/root-registration-allowlist.ts is stale',
      'package.json#sideEffects is stale',
    ],
  );

  generateRegistrationArtifacts(fixtureRoot);
  assert.deepEqual(checkRegistrationArtifacts(fixtureRoot).findings, []);

  const generatedAll = readFileSync(join(fixtureRoot, 'src/all.ts'), 'utf8');
  assert.ok(generatedAll.includes("import './components/forms/zeta/alpha-entry.js';"));
  assert.ok(generatedAll.includes("import './components/forms/alpha/beta-entry.js';"));
  assert.ok(!generatedAll.includes("import './components/charts/optional/optional.js';"));
  assert.ok(generatedAll.includes("import './components/viewers/archive/archive-register.js';"));

  const generatedSsrAll = readFileSync(join(fixtureRoot, 'src/ssr/all.ts'), 'utf8');
  assert.ok(generatedSsrAll.includes("import '../components/charts/optional/optional.js';"));

  assert.equal(
    readFileSync(join(fixtureRoot, 'src/lyra.ts'), 'utf8'),
    "export { Manual } from './manual.js';\n",
    'the registration-free package root is never written by the generator',
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
    './dist/all.js',
    './dist/autoloader-cdn.js',
    './dist/ssr-loader.js',
    './dist/ssr/all.js',
    './dist/components/charts/optional/optional.js',
    './dist/components/forms/alpha/beta-entry.js',
    './dist/components/forms/zeta/alpha-entry.js',
    './dist/components/viewers/archive/archive-register.js',
    './dist/theme.css',
    './dist/translations/fr.js',
    './src/all.ts',
    './src/autoloader-cdn.ts',
    './src/ssr-loader.ts',
    './src/ssr/all.ts',
    './src/components/charts/optional/optional.ts',
    './src/components/forms/alpha/beta-entry.ts',
    './src/components/forms/zeta/alpha-entry.ts',
    './src/components/viewers/archive/archive-register.ts',
    './src/theme.css',
    './src/translations/fr.ts',
  ]) {
    assert.ok(sideEffects.includes(entry), `missing generated side effect ${entry}`);
  }
  for (const entry of ['./src/lyra.ts', './dist/lyra.js']) {
    assert.ok(
      !sideEffects.includes(entry),
      `${entry} must stay out of sideEffects: the registration-free root has to remain tree-shakeable`,
    );
  }

  const before = new Map(
    [
      'src/all.ts',
      'src/ssr/all.ts',
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
