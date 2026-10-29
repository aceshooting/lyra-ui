import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { types } from 'node:util';

const scriptNames = ['build', 'complete-transform', 'base-transform', 'worker-transform', 'metadata-transform',
  'sprite-key-transform', 'prepared-mutations', 'feature-requirements', 'preparation-runtime',
  'code-serialization', 'native-terrain-contract'];
const sceneNames = ['index', 'bridge', 'bridge-glyph', 'frame', 'geographic', 'geometry-chart', 'gl-state',
  'lifetime', 'native-terrain-authority', 'projection', 'resource-ledger', 'terrain-native', 'terrain-points'];
const optionalConfig = ['.npmrc', '.pnpmfile.cjs', '.pnpmfile.mjs'];
const manifestFields = ['name', 'type', 'imports', 'exports', 'main', 'module', 'browser', 'sideEffects',
  'dependencies', 'optionalDependencies', 'peerDependencies', 'packageManager', 'engines'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const order = (left, right) => left < right ? -1 : left > right ? 1 : 0;

class CaptureRefusal extends Error {
  constructor(reason) { super('Native terrain input capture is unavailable.'); this.reason = reason; }
}
const refuse = (reason = 'unsafe-input') => { throw new CaptureRefusal(reason); };
const plain = value => value !== null && typeof value === 'object' && !types.isProxy(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value));

function own(value, key, reason = 'unsafe-input') {
  if (!plain(value)) refuse(reason);
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (!descriptor || !Object.hasOwn(descriptor, 'value')) refuse(reason);
  return descriptor.value;
}

function checkedCompilerOptions(options, packageRoot) {
  if (!plain(options) || !Object.isFrozen(options)) refuse('compiler-config');
  const keys = Reflect.ownKeys(options);
  if (keys.length !== 2 || !keys.includes('cwd') || !keys.includes('tsconfig') || 'resolve' in options)
    refuse('compiler-config');
  const cwd = own(options, 'cwd', 'compiler-config');
  if (!Object.getOwnPropertyDescriptor(options, 'cwd').enumerable ||
      !Object.getOwnPropertyDescriptor(options, 'tsconfig')?.enumerable) refuse('compiler-config');
  if (typeof cwd !== 'string' || !isAbsolute(cwd) || resolve(cwd) !== packageRoot ||
      own(options, 'tsconfig', 'compiler-config') !== false) refuse('compiler-config');
  return { cwd: 'packages/lyra-map', tsconfig: false };
}

function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') { if (!Number.isFinite(value)) refuse(); return value; }
  if (Array.isArray(value)) return value.map(canonical);
  if (!plain(value)) refuse();
  return Object.fromEntries(Object.keys(value).sort(order).map(key => [key, canonical(value[key])]));
}

function projectManifest(bytes) {
  const manifest = JSON.parse(bytes.toString('utf8'));
  if (!plain(manifest)) refuse();
  const field = (value, key) => Object.hasOwn(value, key)
    ? { present: true, value: value[key] } : { present: false, value: null };
  const scripts = manifest.scripts ?? {}, devDependencies = manifest.devDependencies ?? {};
  if (!plain(scripts) || !plain(devDependencies)) refuse();
  function resolverField(key) {
    const projected = field(manifest, key);
    if (projected.present && (key === 'imports' || key === 'exports')) {
      canonical(projected.value);
      // Conditional resolution uses entry order throughout these subtrees.
      return { present: true, orderedJson: JSON.stringify(projected.value) };
    }
    return projected;
  }
  return canonical({
    fields: Object.fromEntries(manifestFields.map(key => [key, resolverField(key)])),
    build: field(scripts, 'build'),
    compiler: Object.fromEntries(['rolldown', 'typescript'].map(key => [key, field(devDependencies, key)]))
  });
}

// Accept the scalar patch mapping used by this workspace; ambiguous YAML is not guessed.
function patchPaths(bytes) {
  const lines = bytes.toString('utf8').split(/\r?\n/u);
  const headers = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (line.includes('\t') || /^\s*(?:<<\s*:|\?\s|---\s*$|\.\.\.\s*$)/u.test(line) ||
        /(?:^|\s)[&*!][A-Za-z0-9_]/u.test(line)) refuse();
    if (/^(?:patchedDependencies|'patchedDependencies'|"patchedDependencies")\s*:/u.test(line)) headers.push(index);
  }
  if (headers.length !== 1 || !/^patchedDependencies: *(?:#.*)?$/u.test(lines[headers[0]])) refuse();
  const paths = [], keys = new Set();
  for (let index = headers[0] + 1; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!line.startsWith(' ')) break;
    const match = /^ {2}(?:'([^']+)'|"([^"\\]+)"|([A-Za-z0-9@/_.+-]+)): +([^\s#]+) *(?:#.*)?$/u.exec(line);
    if (!match) refuse();
    const key = match[1] ?? match[2] ?? match[3], path = match[4];
    if (keys.has(key) || !/^patches\/[A-Za-z0-9@/_.+-]+\.patch$/u.test(path) || path.split('/').includes('..')) refuse();
    keys.add(key); paths.push(path);
  }
  if (!paths.length) refuse();
  return [...new Set(paths)].sort(order);
}

async function checkedPath(workspaceRoot, file, optional = false) {
  if (typeof file !== 'string' || file.includes('\\') || file.split('/').some(part => !part || part === '.' || part === '..')) refuse();
  const target = resolve(workspaceRoot, file), inside = relative(workspaceRoot, target);
  if (!inside || isAbsolute(inside) || inside === '..' || inside.startsWith(`..${sep}`)) refuse();
  let path = workspaceRoot, metadata;
  const parts = inside.split(sep);
  for (let index = 0; index < parts.length; index++) {
    path = join(path, parts[index]);
    try { metadata = await lstat(path); }
    catch (error) {
      if (optional && error.code === 'ENOENT' && index === parts.length - 1) return undefined;
      throw error;
    }
    if (metadata.isSymbolicLink() || (index === parts.length - 1 ? !metadata.isFile() : !metadata.isDirectory())) refuse();
  }
  if (await realpath(target) !== target) refuse();
  return { path: target, metadata };
}

function sameFile(left, right) {
  return left.dev === right.dev && left.ino === right.ino && left.size === right.size &&
    left.mtimeMs === right.mtimeMs && left.ctimeMs === right.ctimeMs;
}

async function readInput(workspaceRoot, file, optional = false) {
  const checked = await checkedPath(workspaceRoot, file, optional);
  if (!checked) return undefined;
  const handle = await open(checked.path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await handle.stat();
    if (!before.isFile() || !sameFile(before, checked.metadata)) refuse();
    const bytes = await handle.readFile();
    const after = await handle.stat(), current = await checkedPath(workspaceRoot, file);
    if (!sameFile(before, after) || !sameFile(after, current.metadata)) refuse();
    return bytes;
  } finally { await handle.close(); }
}

async function checkSceneInventory(workspaceRoot) {
  const directory = join(workspaceRoot, 'packages/lyra-map/src/scene');
  if (await realpath(directory) !== directory) refuse();
  const actual = await readdir(directory);
  const expected = sceneNames.map(name => `${name}.mjs`).sort(order);
  if (actual.length !== expected.length || actual.sort(order).some((name, index) => name !== expected[index])) refuse();
}

/** Captures authored inputs only; it does not load a compiler or grant native terrain authority. */
export async function captureNativeTerrainBuildInputs(request) {
  try {
    const suppliedRoot = own(request, 'packageRoot');
    const sourceTreeSha256 = own(request, 'verifiedSourceTreeSha256');
    if (typeof suppliedRoot !== 'string' || !isAbsolute(suppliedRoot) ||
        typeof sourceTreeSha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(sourceTreeSha256)) refuse();
    const packageRoot = resolve(suppliedRoot), workspaceRoot = resolve(packageRoot, '../..');
    if (packageRoot !== join(workspaceRoot, 'packages/lyra-map') || await realpath(workspaceRoot) !== workspaceRoot ||
        await realpath(packageRoot) !== packageRoot) refuse();
    const compilerOptions = checkedCompilerOptions(own(request, 'compilerOptions', 'compiler-config'), packageRoot);
    const records = new Map(), capturedBytes = new Map();
    function record(file, bytes) {
      if (records.has(file)) refuse();
      records.set(file, Object.freeze({ file, bytes: bytes.length, sha256: hash(bytes) }));
    }
    const jsonRecord = (file, value) => record(file, Buffer.from(JSON.stringify(canonical(value))));
    async function read(file, optional = false) {
      const bytes = await readInput(workspaceRoot, file, optional);
      capturedBytes.set(file, bytes);
      return bytes;
    }
    for (const file of ['.nvmrc', 'pnpm-lock.yaml', 'pnpm-workspace.yaml']) record(file, await read(file));
    for (const file of ['package.json', 'packages/lyra-map/package.json'])
      jsonRecord(`@manifest/${file}`, projectManifest(await read(file)));
    for (const file of optionalConfig) {
      const bytes = await read(file, true);
      jsonRecord(`@presence/${file}`, bytes !== undefined);
      if (bytes !== undefined) record(file, bytes);
    }
    for (const file of patchPaths(capturedBytes.get('pnpm-workspace.yaml'))) record(file, await read(file));
    for (const file of [...scriptNames.map(name => `packages/lyra-map/scripts/${name}.mjs`),
      ...sceneNames.map(name => `packages/lyra-map/src/scene/${name}.mjs`)]) record(file, await read(file));
    await checkSceneInventory(workspaceRoot);
    jsonRecord('@compiler-options', compilerOptions);
    for (const [file, before] of capturedBytes) {
      const after = await readInput(workspaceRoot, file, optionalConfig.includes(file));
      if (before === undefined ? after !== undefined : after === undefined || !before.equals(after)) refuse();
    }
    await checkSceneInventory(workspaceRoot);
    return Object.freeze({ status: 'captured', sourceTreeSha256,
      records: Object.freeze([...records.values()].sort((left, right) => order(left.file, right.file))) });
  } catch (error) {
    const reason = error instanceof CaptureRefusal ? error.reason : error?.code === 'ENOENT' ? 'missing-input' : 'unsafe-input';
    return Object.freeze({ status: 'disabled', reason });
  }
}
