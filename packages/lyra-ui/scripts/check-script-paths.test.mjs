import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  collectLiteralScriptPaths,
  extractPackageSpecifiers,
  resolvePackageExport,
  validatePackedConsumerSpecifiers,
} from './check-script-paths.mjs';

assert.deepEqual(
  collectLiteralScriptPaths({
    platform: 'wtr src/real.test.ts src/missing.test.ts',
    generated: "node scripts/check.mjs --glob='src/**/*.test.ts'",
  }),
  [
    { script: 'platform', path: 'src/real.test.ts' },
    { script: 'platform', path: 'src/missing.test.ts' },
    { script: 'generated', path: 'scripts/check.mjs' },
  ],
);

const pkg = {
  name: '@aceshooting/lyra-ui',
  exports: {
    '.': { types: './dist/lyra.d.ts', default: './dist/lyra.js' },
    './components/*': './dist/components/*',
    './localization.js': './dist/localization.js',
  },
};
assert.equal(resolvePackageExport('@aceshooting/lyra-ui', pkg), './dist/lyra.js');
assert.equal(
  resolvePackageExport('@aceshooting/lyra-ui/components/forms/input/input.js', pkg),
  './dist/components/forms/input/input.js',
);
assert.equal(resolvePackageExport('@aceshooting/lyra-ui/private.js', pkg), null);
assert.deepEqual(
  extractPackageSpecifiers(
    `
      import '@aceshooting/lyra-ui/components/forms/input/input.js';
      await import("@aceshooting/lyra-ui/localization.js");
      // @aceshooting/lyra-ui/private.js is prose, not a quoted fixture specifier.
    `,
    pkg.name,
  ),
  [
    '@aceshooting/lyra-ui/components/forms/input/input.js',
    '@aceshooting/lyra-ui/localization.js',
  ],
);

const fixtureRoot = mkdtempSync(join(tmpdir(), 'lyra-script-specifiers-'));
const write = (relativePath) => {
  const target = join(fixtureRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, 'export {};\n');
};
try {
  write('src/lyra.ts');
  write('src/components/forms/input/input.ts');
  write('src/localization.ts');
  const result = validatePackedConsumerSpecifiers({
    sources: [
      {
        file: 'packed.mjs',
        source: [
          "import '@aceshooting/lyra-ui';",
          "import '@aceshooting/lyra-ui/components/forms/input/input.js';",
          "import '@aceshooting/lyra-ui/localization.js';",
          "import '@aceshooting/lyra-ui/private.js';",
        ].join('\n'),
      },
    ],
    pkg,
    packageDir: fixtureRoot,
  });
  assert.deepEqual(result.errors, [
    'packed.mjs: "@aceshooting/lyra-ui/private.js" is not reachable through package.json#exports',
  ]);

  rmSync(join(fixtureRoot, 'src', 'localization.ts'));
  const missing = validatePackedConsumerSpecifiers({
    sources: [{ file: 'packed.mjs', source: "import '@aceshooting/lyra-ui/localization.js';" }],
    pkg,
    packageDir: fixtureRoot,
  });
  assert.deepEqual(missing.errors, [
    'packed.mjs: "@aceshooting/lyra-ui/localization.js" resolves to missing target ./dist/localization.js',
  ]);
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('package script path and packed-consumer specifier tests passed.');
