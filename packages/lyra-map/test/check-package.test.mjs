import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { appendFile, cp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test, { after, before } from 'node:test';
import { createScratchPackage } from '../scripts/scratch-package.mjs';

// Uncaught assertion failures name the failing line of the script, so a refusal can be tied to it.
const scriptLines = (await readFile(new URL('../scripts/check-package.mjs', import.meta.url), 'utf8')).split('\n');
function failsAt(snippet) {
  const line = scriptLines.findIndex((text) => text.includes(snippet)) + 1;
  assert.ok(line > 0, `check-package.mjs contains ${snippet}`);
  return new RegExp(`check-package\\.mjs:${line}:`, 'u');
}

let built;
before(async () => {
  built = await createScratchPackage();
  const result = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: built.directory, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
});
after(() => built?.remove());

const provenanceFile = 'dist/provenance.json';
async function editProvenance(directory, edit) {
  const file = join(directory, provenanceFile);
  const record = JSON.parse(await readFile(file, 'utf8'));
  edit(record);
  await writeFile(file, JSON.stringify(record));
}

/** Runs the package check against a copy of the good build after `tamper` changed it. */
async function check(tamper = async () => {}) {
  const scratch = await createScratchPackage();
  try {
    await cp(join(built.directory, 'dist'), join(scratch.directory, 'dist'), { recursive: true });
    await tamper(scratch.directory);
    return spawnSync(process.execPath, ['scripts/check-package.mjs'], { cwd: scratch.directory, encoding: 'utf8' });
  } finally {
    await scratch.remove();
  }
}

const firstModule = async (directory) => JSON.parse(await readFile(join(directory, provenanceFile), 'utf8')).modules[0].file;

test('accepts a complete build', async () => {
  const result = await check();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, 'Map package exports, provenance, and generated module checks passed.\n');
});

const refusals = [
  ['a provenance version other than the reviewed one', (directory) => editProvenance(directory, (record) => { record.version = '6.14.0'; }), /6\.14\.0[\s\S]*6\.15\.0/u],
  ['a changed-source list that lost a reviewed file', (directory) => editProvenance(directory, (record) => { record.changedSourceFiles.pop(); }), /strictly deep-equal[\s\S]*render_to_texture/u],
  ['a changed-source list that lost the terrain transform', (directory) => editProvenance(directory, (record) => {
    record.changedSourceFiles = record.changedSourceFiles.filter((file) => file !== 'webgl/draw/draw_terrain.ts');
  }), /strictly deep-equal[\s\S]*draw_terrain/u],
  ['a changed-source list with an unreviewed file', (directory) => editProvenance(directory, (record) => { record.changedSourceFiles.push('util/unreviewed.ts'); }), /strictly deep-equal[\s\S]*unreviewed/u],
  ['a module graph of 700 files or more', (directory) => editProvenance(directory, (record) => {
    while (record.modules.length < 700) record.modules.push(structuredClone(record.modules[0]));
  }), /modules\.length < 700/u],
  ['a module path inside node_modules', (directory) => editProvenance(directory, (record) => { record.modules[0].file = 'modules/node_modules/engine.mjs'; }), /includes\('node_modules'\)/u],
  ['a module path that leaves the distribution', (directory) => editProvenance(directory, (record) => { record.modules[0].file = '../engine.mjs'; }), /includes\('\.\.'\)/u],
  ['a module with a source map reference', async (directory) => {
    await appendFile(join(directory, 'dist', await firstModule(directory)), '\n//# sourceMappingURL=engine.mjs.map\n');
  }, /sourceMappingURL=/u],
  ['a module with a workspace path', async (directory) => {
    await appendFile(join(directory, 'dist', await firstModule(directory)), "\nconst origin = '/home/example/project';\n");
  }, /Generated modules must not contain workspace paths/u],
  ['a missing module listed in the provenance', async (directory) => {
    await rm(join(directory, 'dist', await firstModule(directory)));
  }, /ENOENT/u],
  ['a missing runtime export target', (directory) => rm(join(directory, 'dist/controls/scale.mjs')), /ENOENT[\s\S]*scale\.mjs/u],
  ['a missing declaration export target', (directory) => rm(join(directory, 'dist/controls/scale.d.ts')), /ENOENT[\s\S]*scale\.d\.ts/u],
  ['a missing stylesheet', (directory) => rm(join(directory, 'dist/map.css')), /ENOENT[\s\S]*map\.css/u],
  ['a root entry that lost upstream runtime exports', (directory) => writeFile(join(directory, 'dist/index.mjs'), 'export {};\n'), /Missing upstream runtime export \w+/u],
  ['a root entry whose map cannot prepare features', (directory) => writeFile(join(directory, 'dist/index.mjs'), "export * from 'maplibre-gl';\n"), failsAt('typeof actual.Map.prototype.prepareFeatures')],
  ['a root entry whose map cannot add prepared features', (directory) => writeFile(join(directory, 'dist/index.mjs'),
    "export * from 'maplibre-gl';\nexport class Map { prepareFeatures() {} }\n"), failsAt('typeof actual.Map.prototype.addPreparedFeatures')],
  ['a root entry without the global style preparation', (directory) => writeFile(join(directory, 'dist/index.mjs'),
    "export * from 'maplibre-gl';\nexport class Map { prepareFeatures() {} addPreparedFeatures() {} }\n"), failsAt('typeof actual.prepareStyle')],
];
for (const [name, tamper, message] of refusals) {
  test(`refuses ${name}`, async () => {
    const result = await check(tamper);
    assert.notEqual(result.status, 0, 'the check must fail');
    assert.match(result.stderr, message);
    assert.equal(result.stdout, '', 'no success line is printed');
  });
}
