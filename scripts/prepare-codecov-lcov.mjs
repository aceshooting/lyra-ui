// Codecov receives repository-relative source names, so identical package-local paths such as
// scripts/check-package.mjs cannot be assigned to a different package by path guessing.
import { readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from '../packages/lyra-ui/scripts/is-main-module.mjs';

export const CODECOV_PACKAGES = Object.freeze([
  'lyra-ui', 'lyra-3d', 'lyra-map', 'lyra-docs', 'lyra-flags', 'lyra-ide', 'lyra-translations',
]);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inside = (root, file) => {
  const suffix = relative(root, file);
  return suffix !== '' && suffix !== '..' && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix);
};

/** Change only SF records; validate line coverage before upload. */
export function normalizeLcov(source, { packageName, repositoryRoot = ROOT }) {
  if (!CODECOV_PACKAGES.includes(packageName)) throw new Error(`Unknown coverage package: ${packageName}.`);
  const root = realpathSync(repositoryRoot);
  const expectedRoot = resolve(root, 'packages', packageName);
  const packageRoot = realpathSync(expectedRoot);
  if (packageRoot !== expectedRoot) throw new Error('Coverage package must have its own canonical repository path.');
  const seen = new Set();
  let current = null;
  let records = 0;
  let measuredLines = 0;
  const normalized = source.split('\n').map((raw) => {
    const line = raw.replace(/\r$/u, '');
    if (line.startsWith('SF:')) {
      if (current) throw new Error('LCOV source record is missing end_of_record.');
      const name = line.slice(3);
      if (!name || /[\0\\]/u.test(name) || name.split('/').includes('..')) {
        throw new Error(`Invalid LCOV source path: ${name}.`);
      }
      const candidate = isAbsolute(name) ? name
        : name.startsWith('packages/') ? resolve(root, name) : resolve(packageRoot, name);
      if (!inside(packageRoot, candidate)) throw new Error(`LCOV source is outside ${packageName}: ${name}.`);
      const file = realpathSync(candidate);
      if (!inside(packageRoot, file) || !statSync(file).isFile()) {
        throw new Error(`LCOV source is not a regular file inside ${packageName}: ${name}.`);
      }
      const canonical = `packages/${packageName}/${relative(packageRoot, file).split(sep).join('/')}`;
      if (seen.has(canonical)) throw new Error(`Duplicate LCOV source: ${canonical}.`);
      seen.add(canonical);
      current = { LF: null, LH: null, lines: new Set(), hitLines: 0 };
      return `SF:${canonical}${raw.endsWith('\r') ? '\r' : ''}`;
    }
    if (line.startsWith('DA')) {
      const entry = /^DA:([1-9]\d*),(\d+)(?:,([^,\r\n]+))?$/u.exec(line);
      if (!current || !entry || !Number.isSafeInteger(Number(entry[1]))
        || !Number.isSafeInteger(Number(entry[2])) || current.lines.has(Number(entry[1]))) {
        throw new Error(`Invalid or duplicate LCOV line data: ${line}.`);
      }
      current.lines.add(Number(entry[1]));
      if (Number(entry[2]) > 0) current.hitLines += 1;
    }
    const counter = /^(LF|LH):(.*)$/u.exec(line);
    if (counter) {
      const [, key, value] = counter;
      if (!current || current[key] !== null || !/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new Error(`Invalid LCOV line counter: ${line}.`);
      }
      current[key] = Number(value);
    }
    if (line === 'end_of_record') {
      if (!current || current.LF === null || current.LH === null || current.lines.size === 0
        || current.LF !== current.lines.size || current.LH !== current.hitLines) {
        throw new Error('LCOV record has missing or inconsistent line counters.');
      }
      measuredLines += current.LF;
      records += 1;
      current = null;
    }
    return raw;
  }).join('\n');
  if (current || records === 0 || measuredLines === 0 || !Number.isSafeInteger(measuredLines)) {
    throw new Error('LCOV report is incomplete, empty or has invalid total line counts.');
  }
  return normalized;
}

/** Prepare a separate upload file; local coverage inputs and their counters remain untouched. */
export function prepareCodecovReport(packageName, { repositoryRoot = ROOT } = {}) {
  // Validate packageName before resolving or reading a caller-selected path.
  if (!CODECOV_PACKAGES.includes(packageName)) throw new Error(`Unknown coverage package: ${packageName}.`);
  const directory = resolve(repositoryRoot, 'packages', packageName, 'coverage');
  const input = resolve(directory, 'lcov.info');
  const output = resolve(directory, 'codecov.lcov');
  const result = normalizeLcov(readFileSync(input, 'utf8'), { packageName, repositoryRoot });
  writeFileSync(output, result);
  return output;
}

if (isMainModule(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Usage: prepare-codecov-lcov.mjs <package-name>.');
  console.log(prepareCodecovReport(process.argv[2]));
}
