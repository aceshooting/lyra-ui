import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  checkPackageExports,
  closeWildcardPackageExports,
  CURATED_UTILITY_MODULES,
  deriveExplicitComponentExports,
  deriveExplicitUtilityExports,
  generatePackageExports,
} from './generate-package-exports.mjs';

const inventory = {
  schemaVersion: 1,
  components: [
    {
      tag: 'lr-alpha',
      family: 'forms',
      classModule: 'src/components/forms/alpha/alpha.class.ts',
      registrationModule: 'src/components/forms/alpha/alpha.ts',
    },
    {
      tag: 'lr-beta',
      family: 'charts',
      classModule: 'src/components/charts/beta/beta.class.ts',
      registrationModule: 'src/components/charts/beta/beta.ts',
    },
  ],
};

const helperModules = ['src/components/charts/beta/public-helper.ts'];
assert(
  CURATED_UTILITY_MODULES.includes('src/utilities/css-length.ts'),
  'the documented public css-length helper must retain its granular package route',
);
const derived = deriveExplicitComponentExports(inventory, { helperModules });
assert.deepEqual(Object.keys(derived), [...Object.keys(derived)].sort());
assert.equal(derived['./components/forms/alpha/alpha.class.js'], './dist/components/forms/alpha/alpha.class.js');
assert.equal(derived['./components/forms/alpha/alpha.js'], './dist/components/forms/alpha/alpha.js');
assert.equal(derived['./components/lr-alpha.js'], './dist/components/lr-alpha.js');
assert.equal(derived['./components/forms'], './dist/components/forms/index.js');
assert.equal(derived['./components/charts/beta/public-helper.js'], './dist/components/charts/beta/public-helper.js');
assert.equal(derived['./components/forms/alpha/alpha.styles.js'], undefined);

const closed = closeWildcardPackageExports(
  {
    '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' },
    './components/*': './dist/components/*',
    './components/forms': './dist/components/forms/index.js',
    './localization.js': './dist/localization.js',
    './ai': './dist/ai/index.js',
    './ai/*': './dist/ai/*',
    './utilities': './dist/utilities/index.js',
    './utilities/*': './dist/utilities/*',
  },
  derived,
  deriveExplicitUtilityExports({ utilityModules: ['src/utilities/index.ts', 'src/utilities/defined.ts'] }),
);
assert.equal(closed['./components/*'], undefined);
assert.equal(closed['./ai/*'], undefined);
assert.equal(closed['./ai'], './dist/ai/index.js');
assert.equal(closed['./utilities/*'], undefined);
assert.equal(closed['./utilities'], './dist/utilities/index.js');
assert.equal(closed['./utilities/defined.js'], './dist/utilities/defined.js');
assert.equal(closed['./localization.js'], './dist/localization.js');
assert.equal(closed['./components/lr-beta.js'], './dist/components/lr-beta.js');

assert.throws(
  () => deriveExplicitComponentExports({ ...inventory, schemaVersion: 2 }, { helperModules }),
  /schemaVersion must be 1/,
);
assert.throws(
  () => deriveExplicitComponentExports({ ...inventory, components: [...inventory.components, inventory.components[0]] }, { helperModules }),
  /duplicate tag lr-alpha/,
);

const fixtureRoot = mkdtempSync(join(tmpdir(), 'lyra-package-exports-'));
const write = (relativePath, contents = 'export {};\n') => {
  const target = join(fixtureRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
};

try {
  write('scripts/fixtures/component-inventory.json', `${JSON.stringify(inventory, null, 2)}\n`);
  for (const component of inventory.components) {
    write(component.classModule);
    write(component.registrationModule);
    write(`src/components/${component.tag}.ts`);
    write(`src/components/${component.family}/index.ts`);
  }
  for (const helper of helperModules) write(helper);
  write(
    'package.json',
    `${JSON.stringify({
      name: 'package-export-fixture',
      exports: {
        '.': './dist/lyra.js',
        './components/*': './dist/components/*',
        './ai': './dist/ai/index.js',
        './ai/*': './dist/ai/*',
        './utilities': './dist/utilities/index.js',
        './utilities/*': './dist/utilities/*',
      },
    }, null, 2)}\n`,
  );

  // The filesystem-backed entry uses the production curated helper list. Supply matching fixture
  // helper modules temporarily by deriving the expectation directly, then exercise generation via
  // a fixture copy of the production list's paths.
  const productionModule = await import('./generate-package-exports.mjs');
  for (const helper of productionModule.CURATED_COMPONENT_HELPER_MODULES) write(helper);
  for (const utility of CURATED_UTILITY_MODULES) write(utility);

  assert.deepEqual(checkPackageExports(fixtureRoot).findings, [
    'package.json still exposes ./components/*',
    'package.json still exposes ./ai/*',
    'package.json still exposes ./utilities/*',
    'package.json#exports is stale',
  ]);
  const routes = generatePackageExports(fixtureRoot);
  assert.ok(routes.componentRoutes.includes('./components/lr-alpha.js'));
  assert.ok(routes.utilityRoutes.includes('./utilities/localization.js'));
  assert.deepEqual(checkPackageExports(fixtureRoot).findings, []);

  const first = readFileSync(join(fixtureRoot, 'package.json'), 'utf8');
  generatePackageExports(fixtureRoot);
  assert.equal(readFileSync(join(fixtureRoot, 'package.json'), 'utf8'), first, 'generation must be idempotent');

  const pkg = JSON.parse(first);
  assert.equal(pkg.exports['./components/*'], undefined);
  assert.equal(pkg.exports['./ai/*'], undefined);
  assert.equal(pkg.exports['./utilities/*'], undefined);
  assert.equal(pkg.exports['./utilities/localization.js'], './dist/utilities/localization.js');
  assert.equal(pkg.exports['./ai'], './dist/ai/index.js');
  assert.equal(pkg.exports['./components/forms/alpha/alpha.class.js'], './dist/components/forms/alpha/alpha.class.js');
  assert.equal(pkg.exports['./components/charts/beta/public-helper.js'], undefined, 'only the production curated helper list is packaged');
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('explicit package export generation and determinism tests passed.');
