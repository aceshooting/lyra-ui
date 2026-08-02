import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = mkdtempSync(join(tmpdir(), 'lyra-autoloader-manifest-'));

function writeInventory(components, schemaVersion = 1) {
  writeFileSync(
    join(fixtureRoot, 'scripts', 'fixtures', 'component-inventory.json'),
    `${JSON.stringify({ schemaVersion, components }, null, 2)}\n`,
  );
}

const alpha = {
  tag: 'lr-alpha',
  classModule: 'src/components/utility/alpha/alpha.class.ts',
  registrationModule: 'src/components/utility/alpha/alpha.ts',
  optionalPeers: [],
};
const beta = {
  tag: 'lr-beta',
  classModule: 'src/components/viewers/beta/beta.class.ts',
  registrationModule: 'src/components/viewers/beta/beta.ts',
  optionalPeers: ['peer-z', 'peer-a'],
};

try {
  mkdirSync(join(fixtureRoot, 'scripts', 'fixtures'), { recursive: true });
  mkdirSync(join(fixtureRoot, 'src', 'internal'), { recursive: true });
  for (const [component, className] of [[alpha, 'LyraAlpha'], [beta, 'LyraBeta']]) {
    const directory = dirname(join(fixtureRoot, component.classModule));
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(fixtureRoot, component.classModule), `export class ${className} extends HTMLElement {}\n`);
    writeFileSync(
      join(fixtureRoot, component.registrationModule),
      `import { ${className} } from './${component.tag.slice(3)}.class.js';\ndefineElement('${component.tag.slice(3)}', ${className});\n`,
    );
  }
  writeFileSync(
    join(fixtureRoot, 'scripts', 'generate-autoloader-manifest.mjs'),
    readFileSync(join(scriptDir, 'generate-autoloader-manifest.mjs'), 'utf8'),
  );
  writeInventory([beta, alpha]);

  const script = join(fixtureRoot, 'scripts', 'generate-autoloader-manifest.mjs');
  execFileSync(process.execPath, [script], { cwd: fixtureRoot, stdio: 'pipe' });
  const tags = readFileSync(join(fixtureRoot, 'src', 'internal', 'autoloader-tags.ts'), 'utf8');
  const manifest = readFileSync(join(fixtureRoot, 'src', 'internal', 'autoloader-manifest.ts'), 'utf8');
  assert.ok(tags.indexOf("'lr-alpha'") < tags.indexOf("'lr-beta'"), 'tags must sort deterministically');
  assert.match(manifest, /import\('\.\.\/components\/utility\/alpha\/alpha\.class\.js'\)/);
  assert.match(manifest, /module\.LyraAlpha/);
  assert.match(manifest, /optionalPeers: \['peer-a', 'peer-z'\]/);
  assert.doesNotMatch(manifest, /alpha\.ts/);

  execFileSync(process.execPath, [script, '--check'], { cwd: fixtureRoot, stdio: 'pipe' });
  const firstTags = tags;
  const firstManifest = manifest;
  execFileSync(process.execPath, [script], { cwd: fixtureRoot, stdio: 'pipe' });
  assert.equal(readFileSync(join(fixtureRoot, 'src', 'internal', 'autoloader-tags.ts'), 'utf8'), firstTags);
  assert.equal(readFileSync(join(fixtureRoot, 'src', 'internal', 'autoloader-manifest.ts'), 'utf8'), firstManifest);

  writeFileSync(join(fixtureRoot, 'src', 'internal', 'autoloader-tags.ts'), '// stale\n');
  assert.throws(
    () => execFileSync(process.execPath, [script, '--check'], { cwd: fixtureRoot, stdio: 'pipe' }),
    /Command failed/,
    'check mode must reject stale generated output',
  );

  writeInventory([alpha, { ...alpha }]);
  assert.throws(
    () => execFileSync(process.execPath, [script], { cwd: fixtureRoot, stdio: 'pipe' }),
    /Command failed/,
    'duplicate tags and modules must fail closed',
  );

  writeInventory([alpha], 999);
  assert.throws(
    () => execFileSync(process.execPath, [script], { cwd: fixtureRoot, stdio: 'pipe' }),
    /Command failed/,
    'unknown inventory schemas must fail closed',
  );

  writeInventory([{ ...alpha, optionalPeers: [''] }]);
  assert.throws(
    () => execFileSync(process.execPath, [script], { cwd: fixtureRoot, stdio: 'pipe' }),
    /Command failed/,
    'invalid optional-peer metadata must fail closed',
  );

  writeInventory([{ ...alpha, tag: 'lr-wrong' }]);
  assert.throws(
    () => execFileSync(process.execPath, [script], { cwd: fixtureRoot, stdio: 'pipe' }),
    /Command failed/,
    'registration drift must fail closed',
  );
} finally {
  rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log('autoloader manifest generation, freshness, and validation tests passed.');
