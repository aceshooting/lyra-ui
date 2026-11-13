import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mergeCoverageMaps } from './coverage-map.mjs';
import { isMainModule } from './is-main-module.mjs';
import { transformSsrSource } from './ssr-coverage-source.mjs';

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const runnerRequire = createRequire(require.resolve('@web/test-runner-playwright'));
const convert = createRequire(runnerRequire.resolve('@web/test-runner-coverage-v8'))('v8-to-istanbul');
const modes = ['default', 'development'];
const hash = value => createHash('sha256').update(value).digest('hex');
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const verifiedTransforms = new Map();

function sourceFile(packageDirectory, name) {
  if (typeof name !== 'string' || !name.startsWith('src/') || !name.endsWith('.ts') || /[\0\\]/u.test(name)) {
    throw new Error('Invalid SSR coverage source path.');
  }
  const file = resolve(packageDirectory, name);
  if (relative(packageDirectory, file).split(sep).join('/') !== name ||
      realpathSync(file) !== file || !statSync(file).isFile()) throw new Error('SSR coverage source path is outside its package or is not canonical.');
  return file;
}

function inputDigest(packageDirectory) {
  const root = resolve(packageDirectory, '../..');
  const files = [join(root, '.nvmrc'), join(root, 'pnpm-lock.yaml'), join(root, 'pnpm-workspace.yaml'),
    join(packageDirectory, 'package.json'), join(packageDirectory, 'tsconfig.json')];
  const visit = directory => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const file = join(directory, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') visit(file);
      else if (entry.isFile() && /\.(?:mjs|json|ts|css|html)$/u.test(entry.name)) files.push(file);
    }
  };
  visit(join(packageDirectory, 'scripts'));
  visit(join(packageDirectory, 'src'));
  return hash(JSON.stringify(files.sort().map(file => [relative(root, file).split(sep).join('/'), hash(readFileSync(file))])));
}

/** Convert exact captured bytes; never infer hits from importing a module or from statements. */
export async function convertSsrModule(entry, cached, packageDirectory) {
  if (!plainObject(cached) || typeof cached.code !== 'string') throw new Error('Missing SSR transformed source.');
  const sourcePath = sourceFile(packageDirectory, cached.sourcePath);
  const source = readFileSync(sourcePath, 'utf8');
  if (cached.sourceSha256 !== hash(source)) throw new Error('SSR source digest changed after capture.');
  const expectedUrl = pathToFileURL(join(packageDirectory, 'dist', cached.sourcePath.slice(4).replace(/\.ts$/u, '.js'))).href;
  if (entry.url !== expectedUrl) throw new Error('SSR source map does not match its native module URL.');
  const match = cached.code.match(/\n?\/\/# sourceMappingURL=data:application\/json;base64,([^\s]+)\s*$/u);
  if (!match) throw new Error('Missing SSR source map.');
  const map = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
  const empty = map.sources?.length === 0;
  if (empty) {
    const executable = cached.code.slice(0, match.index).trim();
    if (!/^(?:"use strict";\s*)?(?:export\s*\{\s*\};\s*)?$/u.test(executable)) {
      throw new Error('SSR coverage encountered unmapped executable output.');
    }
  }
  if (!empty && (map.version !== 3 || map.sources?.length !== 1 || map.sources[0] !== sourcePath ||
      map.sourcesContent?.length !== 1 || map.sourcesContent[0] !== source)) throw new Error('SSR source map does not match current source.');
  const tsconfigRaw = readFileSync(join(packageDirectory, 'tsconfig.json'), 'utf8');
  const transformKey = JSON.stringify([sourcePath, hash(source), hash(tsconfigRaw)]);
  let transformedHash = verifiedTransforms.get(transformKey);
  if (transformedHash === undefined) {
    transformedHash = hash(await transformSsrSource(source, sourcePath, tsconfigRaw));
    verifiedTransforms.set(transformKey, transformedHash);
  }
  if (hash(cached.code) !== transformedHash) throw new Error('SSR transformed source digest does not match the compiler output.');
  if (!Array.isArray(entry.functions) || !entry.functions.length) throw new Error('Missing SSR native functions.');
  for (const block of entry.functions) {
    if (typeof block.functionName !== 'string' || typeof block.isBlockCoverage !== 'boolean' ||
        !Array.isArray(block.ranges) || !block.ranges.length) throw new Error('Invalid SSR native function range.');
    const outer = block.ranges[0];
    for (const range of block.ranges) {
      if (![range.startOffset, range.endOffset, range.count].every(Number.isSafeInteger) ||
          range.startOffset < 0 || range.endOffset <= range.startOffset || range.endOffset > cached.code.length ||
          range.count < 0 || range.startOffset < outer.startOffset || range.endOffset > outer.endOffset) {
        throw new Error('Invalid SSR native coverage range.');
      }
    }
  }
  if (empty) return {};
  const converter = convert(fileURLToPath(entry.url), 0, { source: cached.code });
  await converter.load();
  // Match the browser converter: anonymous callbacks own their branches, the script body does not.
  converter.applyCoverage(entry.functions.map(block => {
    const range = block.ranges[0];
    return block.functionName || range.startOffset === 0 && range.endOffset === cached.code.length
      ? block : { ...block, functionName: '(anonymous)' };
  }));
  const result = converter.toIstanbul();
  if (Object.keys(result).length !== 1 || !result[sourcePath] || result[sourcePath].path !== sourcePath) {
    throw new Error('SSR source map produced an unexpected source path.');
  }
  return result;
}

/** Capture the full document-less SSR matrix without changing published-artifact qualification. */
export async function collectSsrCoverage({ packageDirectory = packageDir,
  coverageDirectory = join(packageDirectory, 'coverage/ssr') } = {}) {
  const pinnedNode = readFileSync(join(packageDirectory, '../../.nvmrc'), 'utf8').trim();
  if (process.versions.node !== pinnedNode) throw new Error(`SSR coverage requires Node ${pinnedNode}.`);
  const inputsSha256 = inputDigest(packageDirectory);
  mkdirSync(coverageDirectory, { recursive: true });
  for (const name of ['coverage-final.json', 'provenance.json', '.capture']) {
    rmSync(join(coverageDirectory, name), { recursive: true, force: true });
  }
  const capture = join(coverageDirectory, '.capture');
  const rawDirectory = join(capture, 'raw'), cacheDirectory = join(capture, 'transformed');
  mkdirSync(rawDirectory, { recursive: true });
  const register = new URL('./ssr-coverage-register.mjs', import.meta.url).href;
  for (const mode of modes) {
    const result = spawnSync(process.execPath, ['scripts/check-ssr.mjs'], {
      cwd: packageDirectory, stdio: 'inherit', timeout: 5 * 60_000,
      env: { ...process.env, NODE_OPTIONS: `--import=${register}${mode === 'development' ? ' --conditions=development' : ''}`,
        NODE_V8_COVERAGE: rawDirectory, LYRA_SSR_COVERAGE_PACKAGE_ROOT: packageDirectory,
        LYRA_SSR_COVERAGE_CACHE: cacheDirectory },
    });
    if (result.error) throw result.error;
    if (result.status !== 0 || result.signal) throw new Error(`SSR coverage ${mode} failed (${result.signal ?? result.status}).`);
  }
  const sessions = new Map(), sourceDigests = new Map();
  for (const name of readdirSync(rawDirectory).sort()) {
    if (!name.endsWith('.json')) continue;
    const raw = JSON.parse(readFileSync(join(rawDirectory, name), 'utf8'));
    if (!Array.isArray(raw.result)) throw new Error('Invalid SSR native coverage report.');
    for (const entry of raw.result) {
      if (!entry.url.startsWith('file:') || !entry.url.endsWith('.js')) continue;
      const modulePath = relative(join(packageDirectory, 'dist'), fileURLToPath(entry.url));
      if (isAbsolute(modulePath) || modulePath.startsWith(`..${sep}`) || modulePath === '..') continue;
      // Build-generated modules without TypeScript counterparts keep their normal loader path.
      if (!existsSync(join(packageDirectory, 'src', modulePath.replace(/\.js$/u, '.ts')))) continue;
      const cached = JSON.parse(readFileSync(join(cacheDirectory, `${modulePath}.json`), 'utf8'));
      const report = await convertSsrModule(entry, cached, packageDirectory);
      for (const [path, file] of Object.entries(report)) {
        const previousDigest = sourceDigests.get(path);
        if (previousDigest !== undefined && previousDigest !== cached.sourceSha256) throw new Error('SSR source digest changed between observations.');
        sourceDigests.set(path, cached.sourceSha256);
        let observations = sessions.get(path);
        if (!observations) sessions.set(path, observations = []);
        observations.push({ [path]: file });
      }
    }
  }
  const report = {}, sources = {};
  for (const path of [...sessions.keys()].sort()) {
    const name = relative(packageDirectory, path).split(sep).join('/');
    const file = mergeCoverageMaps(sessions.get(path)).fileCoverageFor(path).toJSON();
    report[name] = { ...file, path: name };
    sources[name] = sourceDigests.get(path);
    if (hash(readFileSync(path)) !== sources[name]) throw new Error('SSR source digest changed before reporting.');
    sessions.delete(path);
  }
  if (!Object.keys(report).length) throw new Error('SSR coverage captured no mapped source.');
  if (inputDigest(packageDirectory) !== inputsSha256) throw new Error('SSR coverage inputs changed during capture.');
  const contents = JSON.stringify(report);
  writeFileSync(join(coverageDirectory, 'coverage-final.json'), contents);
  writeFileSync(join(coverageDirectory, 'provenance.json'), JSON.stringify({ schemaVersion: 1,
    node: process.versions.node, modes, inputsSha256, reportSha256: hash(contents), sources }));
  // Validate the same portable artifact that a separate CI runner will consume.
  readSsrCoverage({ packageDirectory, coverageDirectory });
  rmSync(capture, { recursive: true, force: true });
  console.log(`SSR native coverage: ${Object.keys(report).length} verified source files, both import conditions.`);
}

/** Reject absent, stale or mismatched SSR evidence before merging it with browser reports. */
export function readSsrCoverage({ packageDirectory = packageDir,
  coverageDirectory = join(packageDirectory, 'coverage/ssr') } = {}) {
  const provenance = JSON.parse(readFileSync(join(coverageDirectory, 'provenance.json'), 'utf8'));
  if (provenance.schemaVersion !== 1 || provenance.node !== process.versions.node ||
      JSON.stringify(provenance.modes) !== JSON.stringify(modes) || !plainObject(provenance.sources)) {
    throw new Error('Invalid SSR coverage provenance.');
  }
  if (inputDigest(packageDirectory) !== provenance.inputsSha256) throw new Error('SSR coverage input digest changed.');
  const contents = readFileSync(join(coverageDirectory, 'coverage-final.json'), 'utf8');
  if (hash(contents) !== provenance.reportSha256) throw new Error('SSR coverage report digest does not match.');
  const portable = JSON.parse(contents);
  if (!plainObject(portable) || !Object.keys(portable).length ||
      JSON.stringify(Object.keys(portable).sort()) !== JSON.stringify(Object.keys(provenance.sources).sort())) {
    throw new Error('SSR coverage source inventory does not match.');
  }
  const report = {};
  for (const [name, file] of Object.entries(portable)) {
    const path = sourceFile(packageDirectory, name);
    if (file.path !== name) throw new Error('SSR coverage source path does not match its key.');
    if (hash(readFileSync(path)) !== provenance.sources[name]) throw new Error('SSR coverage source digest changed.');
    report[path] = { ...file, path };
  }
  return report;
}

if (isMainModule(import.meta.url)) await collectSsrCoverage();
