import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { collectSsrCoverage, convertSsrModule, readSsrCoverage } from './ssr-coverage.mjs';
import { COVERAGE_SHARD_TOTAL, coverageShardDirectory, mergeCoverageReports } from './coverage-shard-runner.mjs';
import { shardTestFiles } from './full-engine-shard.mjs';

const require = createRequire(import.meta.url);
const { transform } = createRequire(require.resolve('@web/dev-server-esbuild'))('esbuild');
const hash = value => createHash('sha256').update(value).digest('hex');
const original = 'export function choose(value?: string) { return value ?? "fallback"; }\nexport const unused = () => "never";\n';

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'lyra-ssr-coverage-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packageDirectory = join(root, 'packages/lyra-ui');
  const coverageDirectory = join(packageDirectory, 'coverage/ssr');
  for (const directory of ['src', 'dist', 'scripts']) await mkdir(join(packageDirectory, directory), { recursive: true });
  await writeFile(join(root, '.nvmrc'), process.versions.node);
  await writeFile(join(root, 'pnpm-lock.yaml'), 'fixture lockfile\n');
  await writeFile(join(root, 'pnpm-workspace.yaml'), 'packages: [packages/*]\n');
  await writeFile(join(packageDirectory, 'package.json'), '{"type":"module"}\n');
  await writeFile(join(packageDirectory, 'tsconfig.json'), '{"compilerOptions":{"experimentalDecorators":true,"useDefineForClassFields":false}}\n');
  await writeFile(join(packageDirectory, 'src/example.ts'), original);
  await writeFile(join(packageDirectory, 'src/types.ts'), 'export interface Value { text: string }\n');
  await writeFile(join(packageDirectory, 'dist/example.js'), 'throw new Error("The coverage loader must execute the mapped source");\n');
  await writeFile(join(packageDirectory, 'dist/types.js'), 'export {};\n');
  await writeFile(join(packageDirectory, 'scripts/check-ssr.mjs'), [
    'import assert from "node:assert/strict";',
    'import { spawnSync } from "node:child_process";',
    'import { choose } from "../dist/example.js";',
    'await import("../dist/types.js");',
    'assert.equal(typeof window, "undefined");',
    'assert.equal(typeof document, "undefined");',
    'assert.equal(choose("authored"), "authored");',
    'const child = spawnSync(process.execPath, ["--input-type=module", "--eval",',
    '  "import assert from \'node:assert/strict\'; import { choose } from \'./dist/example.js\'; assert.equal(choose(\'child\'), \'child\');"],',
    '  { cwd: new URL("..", import.meta.url), encoding: "utf8" });',
    'assert.equal(child.status, 0, child.stderr);',
  ].join('\n'));
  return { root, packageDirectory, coverageDirectory };
}

test('SSR coverage captures both modes and isolated child imports without crediting unused branches', async t => {
  const options = await fixture(t);
  await collectSsrCoverage(options);
  const coverage = readSsrCoverage(options);
  const path = join(options.packageDirectory, 'src/example.ts');
  assert.deepEqual(Object.keys(coverage), [path], 'type-only modules add no executable source');
  const file = coverage[path];
  const choose = Object.entries(file.fnMap).find(([, fn]) => fn.name === 'choose');
  assert.equal(file.f[choose[0]], 4, 'both parent and child execute in both import conditions');
  const unused = Object.entries(file.fnMap).find(([, fn]) => fn.name === 'unused');
  assert.equal(file.f[unused[0]], 0);
  const fallback = Object.entries(file.branchMap).filter(([, branch]) => branch.loc.start.line === 1 && branch.loc.start.column > 0);
  assert.ok(fallback.some(([id]) => file.b[id][0] === 0), 'the unchosen nullish arm stays uncovered');

  const coverageDirectory = join(options.packageDirectory, 'coverage');
  const tests = Array.from({ length: COVERAGE_SHARD_TOTAL }, (_, index) => `src/example-${index}.test.ts`);
  for (let shardIndex = 1; shardIndex <= COVERAGE_SHARD_TOTAL; shardIndex++) {
    const directory = coverageShardDirectory(coverageDirectory, shardIndex);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'test-files.json'), JSON.stringify({ schemaVersion: 1, shardIndex,
      shardTotal: COVERAGE_SHARD_TOTAL, testFiles: shardTestFiles(tests, shardIndex, COVERAGE_SHARD_TOTAL) }));
    const idle = structuredClone(file);
    for (const id of Object.keys(idle.f)) idle.f[id] = 0;
    for (const id of Object.keys(idle.s)) idle.s[id] = 0;
    for (const id of Object.keys(idle.b)) idle.b[id] = idle.b[id].map(() => 0);
    await writeFile(join(directory, 'coverage-final.json'), JSON.stringify({ [path]: idle }));
    await writeFile(join(directory, 'junit.xml'), '<testsuites><testsuite tests="1" failures="0" /></testsuites>');
  }
  mergeCoverageReports(tests, { coverageDirectory, repositoryRoot: options.root });
  const lcov = await readFile(join(coverageDirectory, 'lcov.info'), 'utf8');
  assert.match(lcov, /FNDA:4,choose/u, 'the complete aggregate includes the validated SSR execution');
  assert.match(lcov, /FNDA:0,unused/u);

  const relocated = await fixture(t);
  await mkdir(relocated.coverageDirectory, { recursive: true });
  for (const name of ['coverage-final.json', 'provenance.json']) {
    await writeFile(join(relocated.coverageDirectory, name), await readFile(join(options.coverageDirectory, name)));
  }
  assert.deepEqual(Object.keys(readSsrCoverage(relocated)), [join(relocated.packageDirectory, 'src/example.ts')]);

  const sourcePath = join(options.packageDirectory, 'src/example.ts');
  await writeFile(sourcePath, `${original}// changed after capture\n`);
  assert.throws(() => readSsrCoverage(options), /(?:source|input).*changed|(?:source|input).*digest/iu);
  await writeFile(sourcePath, original);
  const runnerPath = join(options.packageDirectory, 'scripts/check-ssr.mjs');
  const runner = await readFile(runnerPath, 'utf8');
  await writeFile(runnerPath, `${runner}\n// changed assertion\n`);
  assert.throws(() => readSsrCoverage(options), /input.*changed|input.*digest/iu);
  await writeFile(runnerPath, runner);

  const reportPath = join(options.coverageDirectory, 'coverage-final.json');
  const report = await readFile(reportPath, 'utf8');
  await writeFile(reportPath, '{}');
  assert.throws(() => readSsrCoverage(options), /report.*digest/iu);
  await rm(reportPath);
  assert.throws(() => readSsrCoverage(options), /ENOENT|missing/iu);
  await writeFile(reportPath, report);

  const provenancePath = join(options.coverageDirectory, 'provenance.json');
  const provenance = JSON.parse(await readFile(provenancePath, 'utf8'));
  const escaped = JSON.stringify({ '../outside.ts': { ...file, path: '../outside.ts' } });
  await writeFile(reportPath, escaped);
  await writeFile(provenancePath, JSON.stringify({ ...provenance, reportSha256: hash(escaped), sources: { '../outside.ts': hash(original) } }));
  assert.throws(() => readSsrCoverage(options), /source.*path|outside/iu);
});

test('a failing SSR assertion cannot publish a partial or previous report', async t => {
  const options = await fixture(t);
  await mkdir(options.coverageDirectory, { recursive: true });
  await writeFile(join(options.coverageDirectory, 'coverage-final.json'), 'stale report');
  await writeFile(join(options.packageDirectory, 'scripts/check-ssr.mjs'), 'process.exitCode = 3;\n');
  await assert.rejects(collectSsrCoverage(options), /SSR coverage default failed/iu);
  await assert.rejects(readFile(join(options.coverageDirectory, 'coverage-final.json')), /ENOENT/u);
});

test('SSR conversion rejects stale maps, unmapped executable output and invalid native offsets', async t => {
  const { packageDirectory } = await fixture(t);
  const source = join(packageDirectory, 'src/example.ts');
  const { code } = await transform(original, { loader: 'ts', target: 'es2022', sourcefile: source, sourcemap: 'inline',
    tsconfigRaw: await readFile(join(packageDirectory, 'tsconfig.json'), 'utf8') });
  const cached = { sourcePath: 'src/example.ts', sourceSha256: hash(original), code };
  const entry = { url: pathToFileURL(join(packageDirectory, 'dist/example.js')).href,
    functions: [{ functionName: '', isBlockCoverage: true, ranges: [{ startOffset: 0, endOffset: code.length, count: 1 }] }] };
  await assert.rejects(convertSsrModule(entry, { ...cached, sourceSha256: '0'.repeat(64) }, packageDirectory), /source.*digest/iu);
  await assert.rejects(convertSsrModule(entry, { ...cached, code: code.replace('return value', 'return false') }, packageDirectory), /transformed source digest/iu);
  const marker = code.lastIndexOf('//# sourceMappingURL=');
  const staleMap = JSON.parse(Buffer.from(code.slice(marker).split('base64,')[1].trim(), 'base64'));
  staleMap.sourcesContent[0] = 'different source';
  const staleCode = `${code.slice(0, marker)}//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(staleMap)).toString('base64')}\n`;
  await assert.rejects(convertSsrModule(entry, { ...cached, code: staleCode }, packageDirectory), /source.*map/iu);
  const unmapped = `globalThis.sideEffect = true;\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify({ version: 3, sources: [], sourcesContent: [], names: [], mappings: '' })).toString('base64')}\n`;
  await assert.rejects(convertSsrModule(entry, { ...cached, code: unmapped }, packageDirectory), /unmapped executable/iu);
  const invalid = structuredClone(entry);
  invalid.functions[0].ranges[0].endOffset = code.length + 1;
  await assert.rejects(convertSsrModule(invalid, cached, packageDirectory), /native.*range/iu);
});
