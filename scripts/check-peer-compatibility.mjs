import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants, realpathSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  basename,
  dirname,
  isAbsolute,
  join,
  posix as pathPosix,
  relative,
  resolve,
  sep,
  win32 as pathWin32,
} from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { parseNvmrcVersion } from './check-node-version.mjs';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const packageRoot = join(repositoryRoot, 'packages', 'lyra-ui');
const authorityPath = join(repositoryRoot, 'scripts', 'peer-compatibility-profiles.json');
const packageManifestPath = join(packageRoot, 'package.json');
const lockfilePath = join(repositoryRoot, 'pnpm-lock.yaml');
function resolveWindowsExecutable(name) {
  const pathValue = process.env.Path ?? process.env.PATH;
  if (!pathValue) throw new Error(`Cannot resolve ${name} without Windows PATH.`);
  for (const directory of pathValue.split(';')) {
    if (!directory || /[\u0000\r\n]/u.test(directory)) continue;
    const candidate = pathWin32.resolve(directory, name);
    try {
      if (statSync(candidate).isFile()) return realpathSync(candidate);
    } catch {
      // Continue through the finite PATH authority.
    }
  }
  throw new Error(`Cannot resolve required Windows executable ${name}.`);
}

const pnpmCommand = process.platform === 'win32' ? resolveWindowsExecutable('pnpm.cmd') : 'pnpm';
const npmCommand = process.platform === 'win32' ? resolveWindowsExecutable('npm.cmd') : 'npm';
const binName = (name, platform = process.platform) => (platform === 'win32' ? `${name}.cmd` : name);

export const CANONICAL_MANAGED_PEER_RANGES = Object.freeze({
  '@sgratzl/chartjs-chart-boxplot': '^4.0.0',
  'chart.js': '^4.0.1',
  'chartjs-plugin-annotation': '^3.0.0',
  'chartjs-plugin-datalabels': '^2.2.0',
  'chartjs-plugin-zoom': '^2.0.0',
  dompurify: '^3.4.14',
  katex: '^0.18.4',
  mammoth: '^1.12.1',
  marked: '^18.0.11',
  'pdfjs-dist': '^6.3.289',
});

const CANONICAL_PROFILE_FLOOR_PEERS = Object.freeze({
  'chart-floor': Object.freeze([
    '@sgratzl/chartjs-chart-boxplot',
    'chart.js',
    'chartjs-plugin-annotation',
    'chartjs-plugin-datalabels',
    'chartjs-plugin-zoom',
  ]),
  'markdown-math-floor': Object.freeze(['dompurify', 'katex', 'marked']),
  'docx-floor': Object.freeze(['dompurify', 'mammoth', 'pdfjs-dist']),
  'current-all': Object.freeze([]),
});

const MANAGED_PEER_NAMES = Object.freeze(Object.keys(CANONICAL_MANAGED_PEER_RANGES));
const PROFILE_IDS = Object.freeze(Object.keys(CANONICAL_PROFILE_FLOOR_PEERS));
const CHART_PLUGIN_PEERS = new Set([
  '@sgratzl/chartjs-chart-boxplot',
  'chartjs-plugin-annotation',
  'chartjs-plugin-datalabels',
  'chartjs-plugin-zoom',
]);
const REVIEWED_CHART_PACKAGE_PEER_RANGES = Object.freeze({
  '@sgratzl/chartjs-chart-boxplot': Object.freeze({
    '4.0.0': '^4.0.1',
    '4.4.5': '^4.1.1',
  }),
  'chartjs-plugin-annotation': Object.freeze({
    '3.0.0': '>=4.0.0',
    '3.1.0': '>=4.0.0',
  }),
  'chartjs-plugin-datalabels': Object.freeze({ '2.2.0': '>=3.0.0' }),
  'chartjs-plugin-zoom': Object.freeze({
    '2.0.0': '>=3.2.0',
    '2.2.0': '>=3.2.0',
  }),
});
const STABLE_VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
const SHA512_INTEGRITY_PATTERN = /^sha512-([A-Za-z0-9+/]+={0,2})$/u;
const DEFAULT_TARBALL_LIMITS = Object.freeze({
  maxArchiveBytes: 256 * 1024 * 1024,
  maxCompressedBytes: 64 * 1024 * 1024,
  maxEntries: 20_000,
  maxEntryBytes: 64 * 1024 * 1024,
  maxManifestBytes: 1024 * 1024,
});
const DEFAULT_COMMAND_OUTPUT_BYTES = 2 * 1024 * 1024;
const stagedTarballPrivate = new WeakMap();
const COMMAND_TIMEOUTS = Object.freeze({
  browser: 120_000,
  build: 180_000,
  install: 600_000,
  list: 120_000,
  node: 120_000,
  pack: 180_000,
  toolchain: 15_000,
  typescript: 180_000,
});
const BROWSER_CONTRACT_DEADLINE_MS = 90_000;
const PROCESS_KILL_GRACE_MS = 1_000;
const DOCX_BASE64 = 'UEsDBAoAAAAAAIqV71wxpqS4OgIAADoCAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPFR5cGVzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L2NvbnRlbnQtdHlwZXMiPgogIDxEZWZhdWx0IEV4dGVuc2lvbj0icmVscyIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1wYWNrYWdlLnJlbGF0aW9uc2hpcHMreG1sIi8+CiAgPERlZmF1bHQgRXh0ZW5zaW9uPSJ4bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi94bWwiLz4KICA8T3ZlcnJpZGUgUGFydE5hbWU9Ii93b3JkL2RvY3VtZW50LnhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3ZuZC5vcGVueG1sZm9ybWF0cy1vZmZpY2Vkb2N1bWVudC53b3JkcHJvY2Vzc2luZ21sLmRvY3VtZW50Lm1haW4reG1sIi8+CiAgPE92ZXJyaWRlIFBhcnROYW1lPSIvd29yZC9zdHlsZXMueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LndvcmRwcm9jZXNzaW5nbWwuc3R5bGVzK3htbCIvPgo8L1R5cGVzPlBLAwQKAAAAAACKle9cAAAAAAAAAAAAAAAABgAAAF9yZWxzL1BLAwQKAAAAAACKle9cIBuG6i4BAAAuAQAACwAAAF9yZWxzLy5yZWxzPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pgo8UmVsYXRpb25zaGlwcyB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3BhY2thZ2UvMjAwNi9yZWxhdGlvbnNoaXBzIj4KICA8UmVsYXRpb25zaGlwIElkPSJySWQxIiBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL29mZmljZURvY3VtZW50IiBUYXJnZXQ9IndvcmQvZG9jdW1lbnQueG1sIi8+CjwvUmVsYXRpb25zaGlwcz5QSwMECgAAAAAAipXvXAAAAAAAAAAAAAAAAAUAAAB3b3JkL1BLAwQKAAAAAACKle9cFAIcjIgBAACIAQAAEQAAAHdvcmQvZG9jdW1lbnQueG1sPD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9InllcyI/Pgo8dzpkb2N1bWVudCB4bWxuczp3PSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvd29yZHByb2Nlc3NpbmdtbC8yMDA2L21haW4iPgogIDx3OmJvZHk+CiAgICA8dzpwPjx3OnBQcj48dzpwU3R5bGUgdzp2YWw9IkhlYWRpbmcxIi8+PC93OnBQcj48dzpyPjx3OnQ+THlyYSBVSSBUZXN0IEZpeHR1cmU8L3c6dD48L3c6cj48L3c6cD4KICAgIDx3OnA+PHc6cj48dzp0PlRoaXMgaXMgYSB0aW55IGZpeHR1cmUgZG9jdW1lbnQgdXNlZCBieSB0aGUgdGVzdCBzdWl0ZSBhbmQgU3Rvcnlib29rIHN0b3JpZXMuPC93OnQ+PC93OnI+PC93OnA+CiAgPC93OmJvZHk+Cjwvdzpkb2N1bWVudD5QSwMECgAAAAAAipXvXAAAAAAAAAAAAAAAAAsAAAB3b3JkL19yZWxzL1BLAwQKAAAAAACKle9cg0lQnx8BAAAfAQAAHAAAAHdvcmQvX3JlbHMvZG9jdW1lbnQueG1sLnJlbHM8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCIgc3RhbmRhbG9uZT0ieWVzIj8+CjxSZWxhdGlvbnNoaXBzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMiPgogIDxSZWxhdGlvbnNoaXAgSWQ9InJJZDEiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvc3R5bGVzIiBUYXJnZXQ9InN0eWxlcy54bWwiLz4KPC9SZWxhdGlvbnNoaXBzPlBLAwQKAAAAAACKle9c09qe1u4AAADuAAAADwAAAHdvcmQvc3R5bGVzLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPHc6c3R5bGVzIHhtbG5zOnc9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy93b3JkcHJvY2Vzc2luZ21sLzIwMDYvbWFpbiI+CiAgPHc6c3R5bGUgdzp0eXBlPSJwYXJhZ3JhcGgiIHc6c3R5bGVJZD0iSGVhZGluZzEiPjx3Om5hbWUgdzp2YWw9ImhlYWRpbmcgMSIvPjwvdzpzdHlsZT4KPC93OnN0eWxlcz5QSwECFAAKAAAAAACKle9cMaakuDoCAAA6AgAAEwAAAAAAAAAAAAAAAAAAAAAAW0NvbnRlbnRfVHlwZXNdLnhtbFBLAQIUAAoAAAAAAIqV71wAAAAAAAAAAAAAAAAGAAAAAAAAAAAAEAAAAGsCAABfcmVscy9QSwECFAAKAAAAAACKle9cIBuG6i4BAAAuAQAACwAAAAAAAAAAAAAAAACPAgAAX3JlbHMvLnJlbHNQSwECFAAKAAAAAACKle9cAAAAAAAAAAAAAAAABQAAAAAAAAAAABAAAADmAwAAd29yZC9QSwECFAAKAAAAAACKle9cFAIcjIgBAACIAQAAEQAAAAAAAAAAAAAAAAAJBAAAd29yZC9kb2N1bWVudC54bWxQSwECFAAKAAAAAACKle9cAAAAAAAAAAAAAAAACwAAAAAAAAAAABAAAADABQAAd29yZC9fcmVscy9QSwECFAAKAAAAAACKle9cg0lQnx8BAAAfAQAAHAAAAAAAAAAAAAAAAADpBQAAd29yZC9fcmVscy9kb2N1bWVudC54bWwucmVsc1BLAQIUAAoAAAAAAIqV71zT2p7W7gAAAO4AAAAPAAAAAAAAAAAAAAAAAEIHAAB3b3JkL3N0eWxlcy54bWxQSwUGAAAAAAgACADgAQAAXQgAAAAA';

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stableVersion(value, label) {
  if (typeof value !== 'string' || !STABLE_VERSION_PATTERN.test(value)) {
    throw new TypeError(`${label} must be a stable x.y.z version; found ${JSON.stringify(value)}.`);
  }
  return value;
}

function versionParts(value, label) {
  return stableVersion(value, label).split('.').map(Number);
}

function compareVersions(left, right) {
  const leftParts = versionParts(left, 'version');
  const rightParts = versionParts(right, 'version');
  for (let index = 0; index < leftParts.length; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function floorFromRange(range, name) {
  if (typeof range !== 'string' || !range.startsWith('^')) {
    throw new TypeError(`Managed peer range for ${name} must be one caret range.`);
  }
  return stableVersion(range.slice(1), `managed peer floor for ${name}`);
}

function versionSatisfiesCaret(version, range, name) {
  const floor = floorFromRange(range, name);
  const [major, minor] = versionParts(version, `profile version for ${name}`);
  const [floorMajor, floorMinor] = versionParts(floor, `managed peer floor for ${name}`);
  if (compareVersions(version, floor) < 0) return false;
  if (floorMajor > 0) return major === floorMajor;
  if (floorMinor > 0) return major === 0 && minor === floorMinor;
  return version === floor;
}

function exactRecordEntries(label, value, expected) {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object.`);
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = Object.keys(expected).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(
      `${label} keys drifted; expected ${expectedKeys.join(', ')}, found ${actualKeys.join(', ') || 'none'}.`,
    );
  }
  for (const name of expectedKeys) {
    if (value[name] !== expected[name]) {
      throw new Error(
        `${label} drift for ${name}: expected ${JSON.stringify(expected[name])}, found ${JSON.stringify(value[name])}.`,
      );
    }
  }
}

function validateAuthorityShape(authority) {
  if (!isRecord(authority)) throw new TypeError('Peer compatibility authority must be an object.');
  const authorityKeys = Object.keys(authority).sort();
  const expectedAuthorityKeys = [
    'currentVersions',
    'importer',
    'managedPeerRanges',
    'packageManagers',
    'packageName',
    'profiles',
    'schemaVersion',
    'toolchain',
  ];
  if (JSON.stringify(authorityKeys) !== JSON.stringify(expectedAuthorityKeys)) {
    throw new Error('Peer compatibility authority top-level keys drifted.');
  }
  if (authority.schemaVersion !== 1) {
    throw new Error(`Peer compatibility schemaVersion must be 1; found ${JSON.stringify(authority.schemaVersion)}.`);
  }
  if (authority.packageName !== '@aceshooting/lyra-ui') {
    throw new Error(`Peer compatibility packageName must be "@aceshooting/lyra-ui".`);
  }
  if (authority.importer !== 'packages/lyra-ui') {
    throw new Error(`Peer compatibility importer must be "packages/lyra-ui".`);
  }
  exactRecordEntries(
    'managed peer range authority',
    authority.managedPeerRanges,
    CANONICAL_MANAGED_PEER_RANGES,
  );

  if (!isRecord(authority.currentVersions)) {
    throw new TypeError('Peer compatibility currentVersions must be an object.');
  }
  const currentNames = Object.keys(authority.currentVersions).sort();
  const managedNames = [...MANAGED_PEER_NAMES].sort();
  if (JSON.stringify(currentNames) !== JSON.stringify(managedNames)) {
    throw new Error(
      `Current-version peer inventory drifted; expected ${managedNames.join(', ')}, found ${currentNames.join(', ') || 'none'}.`,
    );
  }
  for (const name of MANAGED_PEER_NAMES) {
    stableVersion(authority.currentVersions[name], `current version for ${name}`);
  }

  if (!isRecord(authority.toolchain)) {
    throw new TypeError('Peer compatibility toolchain must be an object.');
  }
  const toolNames = Object.keys(authority.toolchain).sort();
  const expectedTools = ['playwright', 'typescript', 'vite'];
  if (JSON.stringify(toolNames) !== JSON.stringify(expectedTools)) {
    throw new Error(
      `Peer compatibility toolchain keys drifted; expected ${expectedTools.join(', ')}, found ${toolNames.join(', ') || 'none'}.`,
    );
  }
  for (const name of expectedTools) stableVersion(authority.toolchain[name], `${name} toolchain version`);

  if (!isRecord(authority.packageManagers)) {
    throw new TypeError('Peer compatibility packageManagers must be an object.');
  }
  const packageManagerNames = Object.keys(authority.packageManagers).sort();
  const expectedPackageManagers = ['npm', 'pnpm'];
  if (JSON.stringify(packageManagerNames) !== JSON.stringify(expectedPackageManagers)) {
    throw new Error(
      `Peer compatibility packageManagers keys drifted; expected ${expectedPackageManagers.join(', ')}, found ${packageManagerNames.join(', ') || 'none'}.`,
    );
  }
  for (const name of expectedPackageManagers) {
    stableVersion(authority.packageManagers[name], `${name} package-manager authority`);
  }

  if (!Array.isArray(authority.profiles) || authority.profiles.length !== PROFILE_IDS.length) {
    throw new Error(
      `Peer profile topology drift: expected exactly ${PROFILE_IDS.length} profiles in canonical order.`,
    );
  }
  for (let index = 0; index < PROFILE_IDS.length; index += 1) {
    const expectedId = PROFILE_IDS[index];
    const profile = authority.profiles[index];
    if (!isRecord(profile) || profile.id !== expectedId || !Array.isArray(profile.floorPeers)) {
      throw new Error(`Peer profile topology drift for ${expectedId}.`);
    }
    if (JSON.stringify(Object.keys(profile).sort()) !== JSON.stringify(['floorPeers', 'id'])) {
      throw new Error(`Peer profile topology drift for ${expectedId}: unexpected fields.`);
    }
    const expectedFloorPeers = CANONICAL_PROFILE_FLOOR_PEERS[expectedId];
    if (JSON.stringify(profile.floorPeers) !== JSON.stringify(expectedFloorPeers)) {
      throw new Error(`Peer profile topology drift for ${expectedId}: floorPeers changed.`);
    }
  }
  return authority;
}

export function resolvePeerProfiles(authority) {
  validateAuthorityShape(authority);
  return authority.profiles.map(({ id, floorPeers }) => {
    const floorPeerSet = new Set(floorPeers);
    const versions = Object.fromEntries(
      MANAGED_PEER_NAMES.map((name) => [
        name,
        floorPeerSet.has(name)
          ? floorFromRange(authority.managedPeerRanges[name], name)
          : authority.currentVersions[name],
      ]),
    );
    for (const name of MANAGED_PEER_NAMES) {
      const version = versions[name];
      const range = authority.managedPeerRanges[name];
      if (!versionSatisfiesCaret(version, range, name)) {
        const floor = floorFromRange(range, name);
        const relation = compareVersions(version, floor) < 0 ? 'below managed floor' : 'outside managed range';
        throw new Error(
          `profile pin ${relation}: ${id} ${name} ${version}; managed floor is ${floor}.`,
        );
      }
    }
    return Object.freeze({ id, versions: Object.freeze(versions) });
  });
}

function unquoteYamlScalar(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith("'")) {
    if (!trimmed.endsWith("'") || trimmed.length < 2) {
      throw new Error(`Invalid single-quoted YAML scalar ${trimmed}.`);
    }
    const body = trimmed.slice(1, -1);
    if (body.replaceAll("''", '').includes("'")) {
      throw new Error(`Invalid single-quoted YAML scalar ${trimmed}.`);
    }
    return body.replaceAll("''", "'");
  }
  if (trimmed.startsWith('"')) {
    if (!trimmed.endsWith('"') || trimmed.length < 2) {
      throw new Error(`Invalid double-quoted YAML scalar ${trimmed}.`);
    }
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed !== 'string') throw new Error('not a string');
      return parsed;
    } catch {
      throw new Error(`Invalid quoted YAML scalar ${trimmed}.`);
    }
  }
  return trimmed;
}

function yamlMappingSeparator(source) {
  let quote;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quote === "'") {
      if (character === "'" && source[index + 1] === "'") {
        index += 1;
      } else if (character === "'") {
        quote = undefined;
      }
      continue;
    }
    if (quote === '"') {
      if (character === '\\') index += 1;
      else if (character === '"') quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === ':' && (index + 1 === source.length || /\s/u.test(source[index + 1]))) {
      return index;
    }
  }
  if (quote) throw new Error(`Unterminated YAML quote in ${source}.`);
  return -1;
}

function yamlEntry(line, lineNumber = 0) {
  if (line.includes('\t')) throw new Error(`pnpm lockfile line ${lineNumber} contains a tab.`);
  const indent = /^ */u.exec(line)[0].length;
  if (indent % 2 !== 0) {
    throw new Error(`pnpm lockfile line ${lineNumber} has noncanonical odd indentation.`);
  }
  const source = line.slice(indent);
  if (source === '' || source.startsWith('#') || source.startsWith('- ')) return undefined;
  const separator = yamlMappingSeparator(source);
  if (separator < 1) return undefined;
  const rawKey = source.slice(0, separator).trim();
  const rawValue = source.slice(separator + 1).trimStart();
  return {
    indent,
    key: unquoteYamlScalar(rawKey),
    lineNumber,
    rawKey,
    rawValue,
    value: rawValue === '' ? undefined : unquoteYamlScalar(rawValue),
  };
}

function lockfileLines(lockfileText) {
  if (typeof lockfileText !== 'string') throw new TypeError('pnpm lockfile fixture must be text.');
  if (Buffer.byteLength(lockfileText, 'utf8') > 64 * 1024 * 1024) {
    throw new Error('pnpm lockfile exceeds the 64 MiB parser limit.');
  }
  if (lockfileText.includes('\t')) throw new Error('pnpm lockfile must not contain tab indentation.');
  if (lockfileText.includes('\r') && !lockfileText.includes('\r\n')) {
    throw new Error('pnpm lockfile contains a noncanonical carriage return.');
  }
  const lines = lockfileText.replaceAll('\r\n', '\n').split('\n');
  if (lines.length > 2_000_000) throw new Error('pnpm lockfile exceeds the parser line limit.');
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('- ')) continue;
    if (!yamlEntry(lines[index], index + 1)) {
      throw new Error(`pnpm lockfile line ${index + 1} is outside the admitted mapping grammar.`);
    }
  }
  return lines;
}

function topLevelLockEntries(lines) {
  const entries = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    const entry = yamlEntry(lines[index], index + 1);
    if (!entry || entry.indent !== 0) continue;
    if (entries.has(entry.key)) throw new Error(`pnpm lockfile has duplicate top-level ${entry.key}.`);
    entries.set(entry.key, { ...entry, index });
  }
  return entries;
}

function sectionEnd(lines, start) {
  for (let index = start + 1; index < lines.length; index += 1) {
    const entry = yamlEntry(lines[index], index + 1);
    if (entry?.indent === 0) return index;
  }
  return lines.length;
}

function directSectionEntries(lines, start, end, indent, label) {
  const entries = new Map();
  for (let index = start + 1; index < end; index += 1) {
    const entry = yamlEntry(lines[index], index + 1);
    if (!entry || entry.indent !== indent) continue;
    if (entries.has(entry.key)) throw new Error(`pnpm lockfile has duplicate ${entry.key} ${label}.`);
    entries.set(entry.key, { ...entry, index });
  }
  return entries;
}

function entryEnd(lines, start, boundary, indent) {
  for (let index = start + 1; index < boundary; index += 1) {
    const entry = yamlEntry(lines[index], index + 1);
    if (entry && entry.indent <= indent) return index;
    const rawIndent = /^ */u.exec(lines[index])[0].length;
    if (lines[index].trim() && rawIndent <= indent && lines[index].trim().startsWith('- ')) {
      return index;
    }
  }
  return boundary;
}

function assertCanonicalStructuralKey(entry, expected, label) {
  if (entry.rawKey !== expected) {
    throw new Error(`${label} must use the canonical unquoted ${expected} structural key.`);
  }
}

function canonicalPnpmDataKey(value) {
  return value.startsWith('@') ? `'${value.replaceAll("'", "''")}'` : value;
}

function assertCanonicalPnpmDataKey(entry, expected, label) {
  if (entry.rawKey !== canonicalPnpmDataKey(expected)) {
    throw new Error(`${label} must use the canonical pnpm key spelling for ${expected}.`);
  }
}

function assertNoSequenceNodes(lines, start, end, label) {
  for (let index = start + 1; index < end; index += 1) {
    if (lines[index].trimStart().startsWith('- ')) {
      throw new Error(`${label} contains sequence structure outside the admitted mapping grammar.`);
    }
  }
}

function assertScalarLeaf(lines, field, fieldEnd, label) {
  if (field.value === undefined) throw new Error(`${label} must be a scalar.`);
  for (let index = field.index + 1; index < fieldEnd; index += 1) {
    if (lines[index].trim()) throw new Error(`${label} has unexpected nested structure.`);
  }
}

function parseImporterDependencies(lines, importerName, importer, importerEnd) {
  assertNoSequenceNodes(lines, importer.index, importerEnd, `pnpm lockfile importer ${importerName}`);
  const importerFields = directSectionEntries(
    lines,
    importer.index,
    importerEnd,
    4,
    `field in ${importerName} importer`,
  );
  const devDependencies = importerFields.get('devDependencies');
  if (!devDependencies) {
    throw new Error(`pnpm lockfile importer ${importerName} has no devDependencies section.`);
  }
  assertCanonicalStructuralKey(
    devDependencies,
    'devDependencies',
    `pnpm lockfile importer ${importerName}`,
  );
  if (devDependencies.value !== undefined) {
    throw new Error(`pnpm lockfile importer ${importerName} devDependencies must be a block map.`);
  }

  let dependenciesEnd = importerEnd;
  for (let index = devDependencies.index + 1; index < importerEnd; index += 1) {
    const entry = yamlEntry(lines[index]);
    if (entry && entry.indent <= 4) {
      dependenciesEnd = index;
      break;
    }
  }
  const dependencyEntries = directSectionEntries(
    lines,
    devDependencies.index,
    dependenciesEnd,
    6,
    `devDependencies entry in ${importerName} importer`,
  );
  const dependencies = {};
  for (const [name, dependency] of dependencyEntries) {
    let dependencyEnd = dependenciesEnd;
    for (let index = dependency.index + 1; index < dependenciesEnd; index += 1) {
      const entry = yamlEntry(lines[index]);
      if (entry && entry.indent <= 6) {
        dependencyEnd = index;
        break;
      }
    }
    const fields = directSectionEntries(
      lines,
      dependency.index,
      dependencyEnd,
      8,
      `field for ${name} in ${importerName} devDependencies`,
    );
    if (MANAGED_PEER_NAMES.includes(name)) {
      assertCanonicalPnpmDataKey(
        dependency,
        name,
        `pnpm lockfile managed ${name} devDependencies entry`,
      );
      if (dependency.value !== undefined) {
        throw new Error(`pnpm lockfile managed ${name} devDependencies entry must be a block map.`);
      }
      const unknown = [...fields.keys()].filter((field) => field !== 'specifier' && field !== 'version');
      if (unknown.length > 0) {
        throw new Error(
          `pnpm lockfile managed ${name} devDependencies entry has unexpected field ${unknown.join(', ')}.`,
        );
      }
      for (const fieldName of ['specifier', 'version']) {
        const field = fields.get(fieldName);
        if (!field) throw new Error(`pnpm lockfile managed ${name} has no ${fieldName}.`);
        assertCanonicalStructuralKey(field, fieldName, `pnpm lockfile managed ${name}`);
        assertScalarLeaf(
          lines,
          field,
          entryEnd(lines, field.index, dependencyEnd, field.indent),
          `pnpm lockfile managed ${name} ${fieldName}`,
        );
      }
    }
    dependencies[name] = Object.fromEntries(
      ['specifier', 'version']
        .filter((field) => fields.has(field))
        .map((field) => [field, fields.get(field).value]),
    );
  }
  return dependencies;
}

function splitFlowEntries(source, label) {
  const entries = [];
  let quote;
  let start = 0;
  for (let index = 0; index <= source.length; index += 1) {
    const character = source[index];
    if (quote === "'") {
      if (character === "'" && source[index + 1] === "'") index += 1;
      else if (character === "'") quote = undefined;
      continue;
    }
    if (quote === '"') {
      if (character === '\\') index += 1;
      else if (character === '"') quote = undefined;
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === '{' || character === '}') {
      throw new Error(`${label} contains nested flow structure.`);
    }
    if (character === ',' || index === source.length) {
      const item = source.slice(start, index).trim();
      if (!item) throw new Error(`${label} contains an empty flow-map entry.`);
      entries.push(item);
      start = index + 1;
    }
  }
  if (quote) throw new Error(`${label} has an unterminated quoted value.`);
  return entries;
}

function parseStrictFlowMap(rawValue, label) {
  if (!rawValue.startsWith('{') || !rawValue.endsWith('}')) {
    throw new Error(`${label} must be one canonical inline flow map.`);
  }
  const body = rawValue.slice(1, -1).trim();
  if (!body) return new Map();
  const result = new Map();
  for (const item of splitFlowEntries(body, label)) {
    const separator = yamlMappingSeparator(item);
    if (separator < 1) throw new Error(`${label} has a malformed flow-map entry.`);
    const rawKey = item.slice(0, separator).trim();
    const rawScalar = item.slice(separator + 1).trim();
    const key = unquoteYamlScalar(rawKey);
    if (result.has(key)) throw new Error(`${label} has duplicate ${key}.`);
    if (!rawScalar) throw new Error(`${label} ${key} is empty.`);
    result.set(key, { rawKey, rawScalar, value: unquoteYamlScalar(rawScalar) });
  }
  return result;
}

function reviewedChartPackagePeerRange(packageName, version) {
  const reviewedRanges = REVIEWED_CHART_PACKAGE_PEER_RANGES[packageName];
  if (!reviewedRanges) return undefined;
  const expected = reviewedRanges[version];
  if (expected === undefined) {
    throw new Error(
      `No reviewed chart.js package peer range is recorded for ${packageName}@${version}.`,
    );
  }
  return expected;
}

function packageIntegrity(lockState, packageKey, packageName, packageVersion) {
  const packageEntry = lockState.packageEntries.get(packageKey);
  if (!packageEntry) return undefined;
  if (packageEntry.value !== undefined) {
    throw new Error(`pnpm lockfile package resolution ${packageKey} must be a block map.`);
  }
  assertCanonicalPnpmDataKey(packageEntry, packageKey, `pnpm lockfile package ${packageKey}`);
  const packageEnd = entryEnd(
    lockState.lines,
    packageEntry.index,
    lockState.packagesEnd,
    packageEntry.indent,
  );
  assertNoSequenceNodes(
    lockState.lines,
    packageEntry.index,
    packageEnd,
    `pnpm lockfile package ${packageKey}`,
  );
  const fields = directSectionEntries(
    lockState.lines,
    packageEntry.index,
    packageEnd,
    4,
    `field for package ${packageKey}`,
  );
  const resolution = fields.get('resolution');
  if (!resolution) return undefined;
  assertCanonicalStructuralKey(resolution, 'resolution', `pnpm lockfile package ${packageKey}`);
  const resolutionEnd = entryEnd(
    lockState.lines,
    resolution.index,
    packageEnd,
    resolution.indent,
  );
  assertScalarLeaf(
    lockState.lines,
    resolution,
    resolutionEnd,
    `pnpm lockfile package ${packageKey} resolution`,
  );
  const resolutionFields = parseStrictFlowMap(
    resolution.rawValue,
    `pnpm lockfile package ${packageKey} resolution`,
  );
  if (resolutionFields.size !== 1 || !resolutionFields.has('integrity')) {
    throw new Error(
      `pnpm lockfile package resolution ${packageKey} must contain exactly one direct integrity field.`,
    );
  }
  const integrity = resolutionFields.get('integrity');
  if (integrity.rawKey !== 'integrity' || integrity.rawScalar !== integrity.value) {
    throw new Error(`pnpm lockfile package ${packageKey} integrity key must be canonical.`);
  }
  const expectedChartPeer = reviewedChartPackagePeerRange(packageName, packageVersion);
  if (expectedChartPeer !== undefined) {
    const peerDependencies = fields.get('peerDependencies');
    if (!peerDependencies) {
      throw new Error(`pnpm lockfile package ${packageKey} has no direct peerDependencies map.`);
    }
    assertCanonicalStructuralKey(
      peerDependencies,
      'peerDependencies',
      `pnpm lockfile package ${packageKey}`,
    );
    if (peerDependencies.value !== undefined) {
      throw new Error(`pnpm lockfile package ${packageKey} peerDependencies must be a block map.`);
    }
    const peerDependenciesEnd = entryEnd(
      lockState.lines,
      peerDependencies.index,
      packageEnd,
      peerDependencies.indent,
    );
    const peerEntries = directSectionEntries(
      lockState.lines,
      peerDependencies.index,
      peerDependenciesEnd,
      6,
      `peerDependencies entry for package ${packageKey}`,
    );
    const chartPeer = peerEntries.get('chart.js');
    if (peerEntries.size !== 1 || chartPeer?.value !== expectedChartPeer) {
      throw new Error(
        `pnpm lockfile package ${packageKey} peerDependencies must contain exactly chart.js: ${expectedChartPeer}; found ${JSON.stringify(chartPeer?.value)}.`,
      );
    }
    if (chartPeer.rawKey !== 'chart.js') {
      throw new Error(`pnpm lockfile package ${packageKey} chart.js peer key must be canonical.`);
    }
    assertScalarLeaf(
      lockState.lines,
      chartPeer,
      entryEnd(lockState.lines, chartPeer.index, peerDependenciesEnd, chartPeer.indent),
      `pnpm lockfile package ${packageKey} chart.js peerDependencies edge`,
    );
  }
  return integrity.value;
}

function validateSnapshotPeerEdge(lockState, name, resolution, expectedChartVersion, label) {
  if (!CHART_PLUGIN_PEERS.has(name)) return;
  const snapshotKey = `${name}@${resolution}`;
  const snapshotEntry = lockState.snapshotEntries.get(snapshotKey);
  if (!snapshotEntry) return;
  if (snapshotEntry.value !== undefined) {
    throw new Error(`${label} snapshot ${snapshotKey} has no direct dependencies map.`);
  }
  assertCanonicalPnpmDataKey(snapshotEntry, snapshotKey, `${label} snapshot ${snapshotKey}`);
  const snapshotEnd = entryEnd(
    lockState.lines,
    snapshotEntry.index,
    lockState.snapshotsEnd,
    snapshotEntry.indent,
  );
  assertNoSequenceNodes(lockState.lines, snapshotEntry.index, snapshotEnd, `${label} snapshot ${snapshotKey}`);
  const fields = directSectionEntries(
    lockState.lines,
    snapshotEntry.index,
    snapshotEnd,
    4,
    `field for snapshot ${snapshotKey}`,
  );
  const dependencies = fields.get('dependencies');
  if (!dependencies) {
    throw new Error(`${label} snapshot ${snapshotKey} has no direct dependencies map.`);
  }
  assertCanonicalStructuralKey(dependencies, 'dependencies', `pnpm lockfile snapshot ${snapshotKey}`);
  if (dependencies.value !== undefined) {
    throw new Error(`${label} snapshot ${snapshotKey} dependencies must be a block map.`);
  }
  const dependenciesEnd = entryEnd(
    lockState.lines,
    dependencies.index,
    snapshotEnd,
    dependencies.indent,
  );
  const edges = directSectionEntries(
    lockState.lines,
    dependencies.index,
    dependenciesEnd,
    6,
    `dependency in snapshot ${snapshotKey}`,
  );
  const chartEdge = edges.get('chart.js');
  if (!chartEdge || chartEdge.value !== expectedChartVersion) {
    throw new Error(
      `${label} snapshot ${snapshotKey} must have direct chart.js edge ${expectedChartVersion}; found ${JSON.stringify(chartEdge?.value)}.`,
    );
  }
  if (chartEdge.rawKey !== 'chart.js') {
    throw new Error(`${label} snapshot ${snapshotKey} chart.js edge must use its canonical key.`);
  }
  assertScalarLeaf(
    lockState.lines,
    chartEdge,
    entryEnd(lockState.lines, chartEdge.index, dependenciesEnd, chartEdge.indent),
    `${label} snapshot ${snapshotKey} chart.js edge`,
  );
}

export function parsePnpmLockState(lockfileText, importerName) {
  if (typeof importerName !== 'string' || importerName.length === 0) {
    throw new TypeError('pnpm lockfile importer name must be nonempty.');
  }
  const lines = lockfileLines(lockfileText);
  const topLevel = topLevelLockEntries(lines);
  const lockfileVersion = topLevel.get('lockfileVersion');
  if (lockfileVersion?.value !== '9.0' || lockfileVersion.rawValue !== "'9.0'") {
    throw new Error('pnpm lockfile must use canonical lockfileVersion 9.0.');
  }
  assertCanonicalStructuralKey(lockfileVersion, 'lockfileVersion', 'pnpm lockfile');
  assertScalarLeaf(
    lines,
    lockfileVersion,
    entryEnd(lines, lockfileVersion.index, lines.length, lockfileVersion.indent),
    'pnpm lockfile lockfileVersion',
  );
  for (const sectionName of ['importers', 'packages', 'snapshots']) {
    if (!topLevel.has(sectionName)) throw new Error(`pnpm lockfile has no ${sectionName} section.`);
    assertCanonicalStructuralKey(topLevel.get(sectionName), sectionName, 'pnpm lockfile');
    if (topLevel.get(sectionName).value !== undefined) {
      throw new Error(`pnpm lockfile ${sectionName} must be a block map.`);
    }
  }

  const importers = topLevel.get('importers');
  const importersEnd = sectionEnd(lines, importers.index);
  const importerEntries = directSectionEntries(lines, importers.index, importersEnd, 2, 'importer');
  const importer = importerEntries.get(importerName);
  if (!importer) throw new Error(`pnpm lockfile has no ${importerName} importer.`);
  assertCanonicalPnpmDataKey(importer, importerName, `pnpm lockfile importer ${importerName}`);
  if (importer.value !== undefined) {
    throw new Error(`pnpm lockfile importer ${importerName} must be a canonical block map.`);
  }
  let importerEnd = importersEnd;
  for (let index = importer.index + 1; index < importersEnd; index += 1) {
    const entry = yamlEntry(lines[index]);
    if (entry && entry.indent <= 2) {
      importerEnd = index;
      break;
    }
  }

  const packages = topLevel.get('packages');
  const packagesEnd = sectionEnd(lines, packages.index);
  const packageEntries = directSectionEntries(lines, packages.index, packagesEnd, 2, 'package entry');
  const snapshots = topLevel.get('snapshots');
  const snapshotsEnd = sectionEnd(lines, snapshots.index);
  const snapshotEntries = directSectionEntries(lines, snapshots.index, snapshotsEnd, 2, 'snapshot entry');
  const state = {
    importer: parseImporterDependencies(lines, importerName, importer, importerEnd),
    lines,
    packageEntries,
    packagesEnd,
    snapshotEntries,
    snapshotsEnd,
    snapshots: new Set(snapshotEntries.keys()),
  };
  return Object.freeze(state);
}

export function parsePnpmLockImporter(lockfileText, importerName) {
  return parsePnpmLockState(lockfileText, importerName).importer;
}

function lockResolutionVersion(value, name) {
  if (typeof value !== 'string') throw new Error(`Current lock entry for ${name} has no version.`);
  const match = STABLE_VERSION_PATTERN.exec(value) ?? /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/u.exec(value);
  if (!match) throw new Error(`Current lock entry for ${name} has unsupported version ${JSON.stringify(value)}.`);
  return `${match[1]}.${match[2]}.${match[3]}`;
}

function expectedLockResolution(name, version, currentVersions) {
  return CHART_PLUGIN_PEERS.has(name)
    ? `${version}(chart.js@${currentVersions['chart.js']})`
    : version;
}

function validateCanonicalSha512Integrity(value, label) {
  const match = SHA512_INTEGRITY_PATTERN.exec(String(value ?? ''));
  if (!match) {
    throw new Error(`${label} has no canonical SHA-512 integrity.`);
  }
  const digest = Buffer.from(match[1], 'base64');
  if (digest.length !== 64 || digest.toString('base64') !== match[1]) {
    throw new Error(`${label} has malformed SHA-512 integrity.`);
  }
  return value;
}

function validateSha512Integrity(value, packageKey) {
  return validateCanonicalSha512Integrity(
    value,
    `pnpm lockfile package resolution ${packageKey}`,
  );
}

function validateLockReference(lockState, name, version, resolution, label) {
  const snapshotKey = `${name}@${resolution}`;
  const snapshotEntry = lockState.snapshotEntries.get(snapshotKey);
  if (!snapshotEntry) {
    throw new Error(`${label} snapshot ${snapshotKey} is missing.`);
  }
  assertCanonicalPnpmDataKey(
    snapshotEntry,
    snapshotKey,
    `${label} snapshot ${snapshotKey}`,
  );
  if (snapshotEntry.value !== undefined && snapshotEntry.rawValue !== '{}') {
    throw new Error(`${label} snapshot ${snapshotKey} must be a block map or exact empty map.`);
  }
  if (snapshotEntry.value === undefined) {
    const snapshotEnd = entryEnd(
      lockState.lines,
      snapshotEntry.index,
      lockState.snapshotsEnd,
      snapshotEntry.indent,
    );
    assertNoSequenceNodes(
      lockState.lines,
      snapshotEntry.index,
      snapshotEnd,
      `${label} snapshot ${snapshotKey}`,
    );
  }
  const chartContext = /\(chart\.js@((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\)$/u.exec(
    resolution,
  )?.[1];
  if (CHART_PLUGIN_PEERS.has(name) && !chartContext) {
    throw new Error(`${label} snapshot ${snapshotKey} has no exact chart.js peer context.`);
  }
  validateSnapshotPeerEdge(lockState, name, resolution, chartContext, label);
  const packageKey = `${name}@${version}`;
  if (!lockState.packageEntries.has(packageKey)) {
    throw new Error(`${label} package resolution ${packageKey} is missing.`);
  }
  validateSha512Integrity(packageIntegrity(lockState, packageKey, name, version), packageKey);
}

function validatePackagePeerManifest(authority, packageManifest) {
  if (!isRecord(packageManifest) || packageManifest.name !== authority.packageName) {
    throw new Error(`Peer compatibility package manifest must name ${authority.packageName}.`);
  }
  if (!isRecord(packageManifest.peerDependencies)) {
    throw new Error('Peer compatibility package manifest has no peerDependencies object.');
  }
  for (const name of MANAGED_PEER_NAMES) {
    const expected = authority.managedPeerRanges[name];
    const actual = packageManifest.peerDependencies[name];
    if (actual !== expected) {
      throw new Error(
        `Package manifest peer range drift for ${name}: expected ${expected}, found ${JSON.stringify(actual)}.`,
      );
    }
    if (packageManifest.peerDependenciesMeta?.[name]?.optional !== true) {
      throw new Error(`Package manifest optional-peer metadata drift for ${name}.`);
    }
  }
}

function devRangeBase(range, name) {
  if (typeof range !== 'string' || !range.startsWith('^')) {
    throw new Error(`Dev-range base mismatch for ${name}: expected one caret version, found ${JSON.stringify(range)}.`);
  }
  return stableVersion(range.slice(1), `dev-range base for ${name}`);
}

export function validatePeerCompatibilityDocuments({ authority, packageManifest, lockfileText }) {
  const profiles = resolvePeerProfiles(authority);
  validatePackagePeerManifest(authority, packageManifest);
  if (!isRecord(packageManifest.devDependencies)) {
    throw new Error('Peer compatibility package manifest has no devDependencies object.');
  }
  const lockState = parsePnpmLockState(lockfileText, authority.importer);
  const lockImporter = lockState.importer;
  for (const name of MANAGED_PEER_NAMES) {
    const current = authority.currentVersions[name];
    const devRange = packageManifest.devDependencies[name];
    const base = devRangeBase(devRange, name);
    if (base !== current) {
      throw new Error(
        `dev-range base mismatch for ${name}: current profile requires ${current}, found ${base}.`,
      );
    }
    const lockEntry = lockImporter[name];
    if (!isRecord(lockEntry)) throw new Error(`current lock mismatch for ${name}: entry is missing.`);
    if (lockEntry.specifier !== devRange) {
      throw new Error(
        `current lock specifier mismatch for ${name}: expected ${devRange}, found ${JSON.stringify(lockEntry.specifier)}.`,
      );
    }
    const locked = lockResolutionVersion(lockEntry.version, name);
    if (locked !== current) {
      throw new Error(
        `current lock mismatch for ${name}: expected ${current}, found ${locked}.`,
      );
    }
    const expectedResolution = expectedLockResolution(name, current, authority.currentVersions);
    if (lockEntry.version !== expectedResolution) {
      throw new Error(
        `current lock mismatch for ${name}: expected resolution ${expectedResolution}, found ${JSON.stringify(lockEntry.version)}.`,
      );
    }
    validateLockReference(lockState, name, current, expectedResolution, `current lock for ${name}`);
  }
  return Object.freeze({ authority, lockImporter, packageManifest, profiles });
}

export function assertNoManagedPeerRangeRewrites({
  authority,
  beforeManifest,
  afterManifest,
}) {
  validateAuthorityShape(authority);
  validatePackagePeerManifest(authority, beforeManifest);
  if (!isRecord(afterManifest?.peerDependencies)) {
    throw new Error('After-upgrade package manifest has no peerDependencies object.');
  }
  for (const name of MANAGED_PEER_NAMES) {
    const before = beforeManifest.peerDependencies[name];
    const after = afterManifest.peerDependencies[name];
    if (after !== before) {
      throw new Error(
        `authority-managed peer range rewrite for ${name}: ${before} became ${JSON.stringify(after)}. ` +
          'Dependency upgrades may update dev pins, but these reviewed peer floors are immutable.',
      );
    }
  }
}

function deriveCurrentVersions({ authority, packageManifest, lockfileText }) {
  validateAuthorityShape(authority);
  validatePackagePeerManifest(authority, packageManifest);
  const lockState = parsePnpmLockState(lockfileText, authority.importer);
  const lockImporter = lockState.importer;
  const currentVersions = {};
  for (const name of MANAGED_PEER_NAMES) {
    const devRange = packageManifest.devDependencies?.[name];
    const base = devRangeBase(devRange, name);
    if (!versionSatisfiesCaret(base, authority.managedPeerRanges[name], name)) {
      throw new Error(
        `Updated dev pin for ${name} (${base}) is outside managed range ${authority.managedPeerRanges[name]}.`,
      );
    }
    if (compareVersions(base, authority.currentVersions[name]) < 0) {
      throw new Error(
        `Current-version downgrade for ${name}: reviewed current ${authority.currentVersions[name]} would become ${base}.`,
      );
    }
    currentVersions[name] = base;
  }
  for (const name of MANAGED_PEER_NAMES) {
    const devRange = packageManifest.devDependencies[name];
    const base = currentVersions[name];
    const lockEntry = lockImporter[name];
    if (!isRecord(lockEntry) || lockEntry.specifier !== devRange) {
      throw new Error(`Updated lock specifier for ${name} does not match ${devRange}.`);
    }
    const locked = lockResolutionVersion(lockEntry.version, name);
    if (locked !== base) {
      throw new Error(`Updated lock version for ${name} is ${locked}; dev-range base is ${base}.`);
    }
    const expectedResolution = expectedLockResolution(name, base, currentVersions);
    if (lockEntry.version !== expectedResolution) {
      throw new Error(
        `Updated lock resolution for ${name} must be ${expectedResolution}; found ${JSON.stringify(lockEntry.version)}.`,
      );
    }
    validateLockReference(lockState, name, base, expectedResolution, `updated lock for ${name}`);
  }
  return currentVersions;
}

export function synchronizeAuthorityCurrentVersions({ authority, packageManifest, lockfileText }) {
  const synchronized = structuredClone(authority);
  synchronized.currentVersions = deriveCurrentVersions({ authority, packageManifest, lockfileText });
  resolvePeerProfiles(synchronized);
  return synchronized;
}

function preserveCleanupFailure(primaryError, cleanupError) {
  if (
    primaryError &&
    (typeof primaryError === 'object' || typeof primaryError === 'function') &&
    Object.isExtensible(primaryError)
  ) {
    const existingCleanupError = primaryError.cleanupError;
    Object.defineProperty(primaryError, 'cleanupError', {
      configurable: true,
      enumerable: false,
      value: existingCleanupError === undefined
        ? cleanupError
        : new AggregateError(
            [existingCleanupError, cleanupError],
            'Multiple bounded-cleanup operations failed.',
          ),
    });
  }
}

const authorityTransactionTails = new Map();

async function serializeAuthorityTransaction(targetPath, transaction) {
  const transactionKey = join(await realpath(dirname(targetPath)), basename(targetPath));
  const preceding = authorityTransactionTails.get(transactionKey) ?? Promise.resolve();
  let release;
  const current = new Promise((resolveRelease) => {
    release = resolveRelease;
  });
  authorityTransactionTails.set(transactionKey, current);
  await preceding;
  try {
    return await transaction();
  } finally {
    release();
    if (authorityTransactionTails.get(transactionKey) === current) {
      authorityTransactionTails.delete(transactionKey);
    }
  }
}

async function syncAuthorityDurabilityPath(durablePath, targetPath, openImpl) {
  let handle;
  let durableError;
  try {
    const flags = durablePath === targetPath
      ? fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0)
      : 'r';
    handle = await openImpl(durablePath, flags);
    await handle.sync();
  } catch (error) {
    if (!(process.platform === 'win32' && durablePath === dirname(targetPath) &&
      ['EINVAL', 'ENOTSUP', 'EPERM'].includes(error?.code))) {
      durableError = error;
    }
  } finally {
    try {
      await handle?.close();
    } catch (closeError) {
      if (!durableError) durableError = closeError;
      else preserveCleanupFailure(durableError, closeError);
    }
  }
  if (durableError) throw durableError;
}

function authorityParentIdentity(metadata) {
  return { dev: metadata.dev, ino: metadata.ino };
}

function sameAuthorityParentIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

async function bindAuthorityParent(targetPath) {
  const parentPath = dirname(targetPath);
  const metadata = await lstat(parentPath, { bigint: true });
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error('Peer-compatibility authority parent must be one real directory, not a symbolic link.');
  }
  const canonicalParent = await realpath(parentPath);
  const requestedParent = resolve(parentPath);
  const samePath = process.platform === 'win32'
    ? pathWin32.normalize(canonicalParent).toLowerCase() === pathWin32.normalize(requestedParent).toLowerCase()
    : canonicalParent === requestedParent;
  if (!samePath) {
    throw new Error('Peer-compatibility authority parent path must not traverse symbolic links.');
  }
  return authorityParentIdentity(metadata);
}

async function assertAuthorityParentIdentity(targetPath, expected) {
  const metadata = await lstat(dirname(targetPath), { bigint: true });
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    !sameAuthorityParentIdentity(authorityParentIdentity(metadata), expected)
  ) {
    throw new Error('Peer-compatibility authority parent changed identity during synchronization.');
  }
}

function authorityTargetIdentity(metadata) {
  return {
    ctimeNs: metadata.ctimeNs,
    dev: metadata.dev,
    ino: metadata.ino,
    mode: metadata.mode,
    mtimeNs: metadata.mtimeNs,
    nlink: metadata.nlink,
    size: metadata.size,
  };
}

function sameAuthorityTargetIdentity(left, right) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

function authorityFileCustodyIdentity(metadata) {
  return { dev: metadata.dev, ino: metadata.ino };
}

function sameAuthorityFileCustodyIdentity(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

function authorityCommittedFileIdentity(metadata) {
  return {
    dev: metadata.dev,
    ino: metadata.ino,
    mode: metadata.mode,
    nlink: metadata.nlink,
    size: metadata.size,
  };
}

function sameAuthorityCommittedFileIdentity(left, right) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

async function bindAuthorityTarget(targetPath) {
  const metadata = await lstat(targetPath, { bigint: true });
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink !== 1n) {
    throw new Error(
      'Peer-compatibility authority must be one regular, singly-linked file, not a symbolic link or special file.',
    );
  }
  return authorityTargetIdentity(metadata);
}

async function assertAuthorityTargetIdentity(targetPath, expected) {
  const metadata = await lstat(targetPath, { bigint: true });
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    !sameAuthorityTargetIdentity(authorityTargetIdentity(metadata), expected)
  ) {
    throw new Error('Peer-compatibility authority changed identity during synchronization.');
  }
}

async function readBoundAuthorityText(
  path,
  label,
  {
    expectedIdentity,
    lstatImpl = lstat,
    openImpl = open,
  } = {},
) {
  const pathMetadata = await lstatImpl(path, { bigint: true });
  if (!pathMetadata.isFile() || pathMetadata.isSymbolicLink() || pathMetadata.nlink !== 1n) {
    throw new Error(`${label} must remain one regular, singly-linked file without symbolic links.`);
  }
  const pathIdentity = authorityTargetIdentity(pathMetadata);
  if (expectedIdentity && !sameAuthorityTargetIdentity(pathIdentity, expectedIdentity)) {
    throw new Error(`${label} changed identity during synchronization.`);
  }
  const handle = await openImpl(path, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0));
  let primaryError;
  try {
    const openedMetadata = await handle.stat({ bigint: true });
    const openedIdentity = authorityTargetIdentity(openedMetadata);
    if (
      !openedMetadata.isFile() ||
      openedMetadata.nlink !== 1n ||
      !sameAuthorityTargetIdentity(pathIdentity, openedIdentity)
    ) {
      throw new Error(`${label} changed inode before its bytes could be bound.`);
    }
    const bytes = await readExactHandle(handle, openedMetadata.size, label);
    const afterReadIdentity = authorityTargetIdentity(await handle.stat({ bigint: true }));
    if (!sameAuthorityTargetIdentity(openedIdentity, afterReadIdentity)) {
      throw new Error(`${label} changed while its bytes were being read.`);
    }
    const finalPathMetadata = await lstatImpl(path, { bigint: true });
    if (
      !finalPathMetadata.isFile() ||
      finalPathMetadata.isSymbolicLink() ||
      !sameAuthorityTargetIdentity(openedIdentity, authorityTargetIdentity(finalPathMetadata))
    ) {
      throw new Error(`${label} changed path identity while its bytes were being bound.`);
    }
    let text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (error) {
      throw new Error(`${label} is not valid UTF-8: ${error instanceof Error ? error.message : error}.`);
    }
    return { identity: openedIdentity, text };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await handle.close();
    } catch (closeError) {
      if (primaryError) preserveCleanupFailure(primaryError, closeError);
      else throw closeError;
    }
  }
}

export async function writeSynchronizedAuthority(
  { authority, authorityPath: targetPath, authorityText, packageManifest, lockfileText },
  {
    openImpl = open,
    removeImpl = rm,
    renameImpl = rename,
  } = {},
) {
  if (!isAbsolute(targetPath)) throw new Error('Peer-compatibility authority path must be absolute.');
  return serializeAuthorityTransaction(targetPath, async () => {
    const parentIdentity = await bindAuthorityParent(targetPath);
    const synchronized = synchronizeAuthorityCurrentVersions({ authority, packageManifest, lockfileText });
    validatePeerCompatibilityDocuments({ authority: synchronized, packageManifest, lockfileText });
    const output = `${JSON.stringify(synchronized, null, 2)}\n`;
    const initialLive = await readBoundAuthorityText(
      targetPath,
      'Peer-compatibility live authority',
      { openImpl },
    );
    const targetIdentity = initialLive.identity;
    await assertAuthorityParentIdentity(targetPath, parentIdentity);
    if (initialLive.text !== authorityText) {
      throw new Error('Peer-compatibility live authority changed; the supplied source is stale.');
    }

    if (output === authorityText) {
      const confirmedLive = await readBoundAuthorityText(
        targetPath,
        'Peer-compatibility no-op authority',
        { expectedIdentity: targetIdentity, openImpl },
      );
      await assertAuthorityParentIdentity(targetPath, parentIdentity);
      if (confirmedLive.text !== authorityText) {
        throw new Error('Peer-compatibility authority changed during its no-op synchronization check.');
      }
      return synchronized;
    }

    const transactionId = `${process.pid}-${randomUUID()}`;
    const temporaryPath = `${targetPath}.tmp-${transactionId}`;
    let primaryError;
    let temporaryHandle;
    let temporaryCustodyIdentity;
    let temporaryIdentity;
    let temporaryPresent = false;
    try {
      temporaryHandle = await openImpl(temporaryPath, 'wx', 0o644);
      temporaryPresent = true;
      const openedTemporaryMetadata = await temporaryHandle.stat({ bigint: true });
      if (!openedTemporaryMetadata.isFile() || openedTemporaryMetadata.nlink !== 1n) {
        throw new Error('Peer-compatibility staged authority must open as one regular, singly-linked file.');
      }
      temporaryCustodyIdentity = authorityFileCustodyIdentity(openedTemporaryMetadata);
      await temporaryHandle.writeFile(output, { encoding: 'utf8' });
      await temporaryHandle.sync();
      const temporaryMetadata = await temporaryHandle.stat({ bigint: true });
      if (!temporaryMetadata.isFile() || temporaryMetadata.nlink !== 1n) {
        throw new Error('Peer-compatibility staged authority must be one regular, singly-linked file.');
      }
      temporaryIdentity = authorityTargetIdentity(temporaryMetadata);
      await temporaryHandle.close();
      temporaryHandle = undefined;
      await assertAuthorityParentIdentity(targetPath, parentIdentity);

      const precommit = await readBoundAuthorityText(
        targetPath,
        'Peer-compatibility precommit authority',
        { expectedIdentity: targetIdentity, openImpl },
      );
      await assertAuthorityParentIdentity(targetPath, parentIdentity);
      if (precommit.text !== authorityText) {
        throw new Error(
          'Peer-compatibility authority changed before its atomic replacement could commit.',
        );
      }
      const staged = await readBoundAuthorityText(
        temporaryPath,
        'Peer-compatibility staged authority',
        { expectedIdentity: temporaryIdentity, openImpl },
      );
      if (staged.text !== output) {
        throw new Error('Peer-compatibility staged authority bytes changed before atomic replacement.');
      }
      const finalPrecommit = await readBoundAuthorityText(
        targetPath,
        'Peer-compatibility final precommit authority',
        { expectedIdentity: targetIdentity, openImpl },
      );
      if (finalPrecommit.text !== authorityText) {
        throw new Error(
          'Peer-compatibility authority changed during staged verification; atomic replacement was refused.',
        );
      }
      await assertAuthorityParentIdentity(targetPath, parentIdentity);
      await assertAuthorityTargetIdentity(targetPath, targetIdentity);
      await assertAuthorityTargetIdentity(temporaryPath, temporaryIdentity);
      await renameImpl(temporaryPath, targetPath);
      temporaryPresent = false;
      await assertAuthorityParentIdentity(targetPath, parentIdentity);
      const committed = await readBoundAuthorityText(
        targetPath,
        'Peer-compatibility committed authority',
        { openImpl },
      );
      if (
        !sameAuthorityCommittedFileIdentity(
          authorityCommittedFileIdentity(committed.identity),
          authorityCommittedFileIdentity(temporaryIdentity),
        )
      ) {
        throw new Error(
          'Peer-compatibility atomic replacement committed an unexpected staged inode; durability is uncertain.',
        );
      }
      if (committed.text !== output) {
        throw new Error('Peer-compatibility atomic replacement did not commit the staged bytes.');
      }
      await syncAuthorityDurabilityPath(targetPath, targetPath, openImpl);
      await syncAuthorityDurabilityPath(dirname(targetPath), targetPath, openImpl);
      const durable = await readBoundAuthorityText(
        targetPath,
        'Peer-compatibility durable authority',
        { expectedIdentity: committed.identity, openImpl },
      );
      await assertAuthorityParentIdentity(targetPath, parentIdentity);
      if (durable.text !== output) {
        throw new Error(
          'Peer-compatibility authority changed before its durable atomic replacement completed.',
        );
      }
      return synchronized;
    } catch (error) {
      primaryError = error;
      try {
        await temporaryHandle?.close();
      } catch (cleanupError) {
        preserveCleanupFailure(primaryError, cleanupError);
      }
      if (temporaryPresent) {
        let parentStillBound = false;
        try {
          await assertAuthorityParentIdentity(targetPath, parentIdentity);
          parentStillBound = true;
        } catch (cleanupError) {
          preserveCleanupFailure(primaryError, cleanupError);
        }
        if (parentStillBound) {
          try {
            const cleanupMetadata = await lstat(temporaryPath, { bigint: true });
            if (
              !cleanupMetadata.isFile() ||
              cleanupMetadata.isSymbolicLink() ||
              cleanupMetadata.nlink !== 1n ||
              !temporaryCustodyIdentity ||
              !sameAuthorityFileCustodyIdentity(
                authorityFileCustodyIdentity(cleanupMetadata),
                temporaryCustodyIdentity,
              )
            ) {
              throw new Error(
                'Peer-compatibility staged authority changed identity; refusing unsafe path cleanup.',
              );
            }
            await removeImpl(temporaryPath, { force: true });
            temporaryPresent = false;
            await syncAuthorityDurabilityPath(dirname(targetPath), targetPath, openImpl);
          } catch (cleanupError) {
            preserveCleanupFailure(primaryError, cleanupError);
          }
        }
      }
      throw primaryError;
    }
  });
}

function consumerTypeContractSource() {
  return `import {
  preloadCharts,
  type LyraChartPreloadOptions,
  type LyraChartPreloadResult,
} from '@aceshooting/lyra-ui/components/charts/chart/chart-preload.js';
import {
  loadChartJsWithAnnotationResult,
  loadChartJsWithDataLabelsResult,
  loadChartJsWithZoomResult,
  type ChartFeatureLoadResult,
  type ChartPluginCapability,
} from '@aceshooting/lyra-ui/components/charts/chart/chart-feature-loader.js';
import {
  loadMarkdownAndSanitizer,
  type MarkdownDeps,
} from '@aceshooting/lyra-ui/components/conversation/markdown/markdown-loader.js';
import { LyraMarkdown } from '@aceshooting/lyra-ui/components/conversation/markdown/markdown.class.js';
import { LyraDocxViewer } from '@aceshooting/lyra-ui/components/viewers/docx-viewer/docx-viewer.class.js';

const options = {
  boxPlot: true,
  dataLabels: true,
  zoom: true,
} satisfies LyraChartPreloadOptions;
const preload: Promise<LyraChartPreloadResult> = preloadCharts(options);
const features: Array<Promise<ChartFeatureLoadResult<ChartPluginCapability>>> = [
  loadChartJsWithAnnotationResult(),
  loadChartJsWithDataLabelsResult(),
  loadChartJsWithZoomResult(),
];
const markdown: Promise<MarkdownDeps> = loadMarkdownAndSanitizer();
const markdownElement = new LyraMarkdown();
markdownElement.content = '$x^2$';
markdownElement.math = true;
const docxElement = new LyraDocxViewer();
docxElement.src = 'https://example.test/minimal.docx';
void [preload, features, markdown, markdownElement, docxElement];
`;
}

function consumerNodeContractSource() {
  return `import { Buffer } from 'node:buffer';
import { MINIMAL_DOCX_BASE64 } from './fixtures.mjs';
import { loadChartModule } from '@aceshooting/lyra-ui/components/charts/chart/chart-core-loader.js';
import { preloadCharts } from '@aceshooting/lyra-ui/components/charts/chart/chart-preload.js';

function requireCapability(condition, message) {
  if (!condition) throw new Error(message);
}

function unwrapDefault(module) {
  return module && typeof module === 'object' && 'default' in module ? module.default : module;
}

const chartModule = await loadChartModule();
requireCapability(chartModule && typeof chartModule.Chart === 'function', 'Lyra did not resolve Chart.js in Node.');
const boxPlotPreload = await preloadCharts({ boxPlot: true });
requireCapability(boxPlotPreload.core && boxPlotPreload.boxPlot, 'Public box-plot preload failed in Node.');
const featureLoader = await import('@aceshooting/lyra-ui/components/charts/chart/chart-feature-loader.js');
requireCapability(typeof featureLoader.loadChartJsWithZoomResult === 'function', 'Chart feature loader is not server-importable.');
const markdownLoader = await import('@aceshooting/lyra-ui/components/conversation/markdown/markdown-loader.js');
requireCapability(typeof markdownLoader.loadMarkdownAndSanitizer === 'function', 'Markdown loader is not server-importable.');
const docxClass = await import('@aceshooting/lyra-ui/components/viewers/docx-viewer/docx-viewer.class.js');
requireCapability(typeof docxClass.LyraDocxViewer === 'function', 'DOCX class route is not server-importable.');

const katex = unwrapDefault(await import('katex'));
requireCapability(typeof katex?.renderToString === 'function', 'KaTeX renderToString is unavailable.');
const math = katex.renderToString('x^2', { output: 'mathml', throwOnError: true });
requireCapability(math.includes('<math'), 'KaTeX did not produce MathML in Node.');

const markedModule = await import('marked');
requireCapability(typeof markedModule.Marked === 'function', 'Marked constructor is unavailable.');
const parsedMarkdown = await new markedModule.Marked().parse('# Peer profile');
requireCapability(parsedMarkdown.includes('<h1'), 'Marked did not parse Markdown in Node.');

const mammoth = unwrapDefault(await import('mammoth/mammoth.browser.js'));
requireCapability(typeof mammoth?.convertToHtml === 'function', 'Mammoth convertToHtml is unavailable.');
const bytes = Buffer.from(MINIMAL_DOCX_BASE64, 'base64');
const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const converted = await mammoth.convertToHtml({ arrayBuffer });
requireCapability(converted.value.includes('<h1>'), 'Mammoth did not convert the consumer-owned DOCX heading.');
requireCapability(converted.value.includes('<p>'), 'Mammoth did not convert the consumer-owned DOCX paragraph.');
requireCapability(Array.isArray(converted.messages) && converted.messages.length === 0, 'Mammoth emitted unexpected DOCX diagnostics.');

console.log('Node peer capabilities passed.');
`;
}

function consumerBrowserSource() {
  return `import { preloadCharts } from '@aceshooting/lyra-ui/components/charts/chart/chart-preload.js';
import { loadChartJs } from '@aceshooting/lyra-ui/components/charts/chart/chart-core-loader.js';
import { BoxPlotController, BoxAndWiskers } from '@sgratzl/chartjs-chart-boxplot';
import {
  loadChartJsWithAnnotationResult,
  loadChartJsWithDataLabelsResult,
  loadChartJsWithZoomResult,
} from '@aceshooting/lyra-ui/components/charts/chart/chart-feature-loader.js';
import { loadMarkdownAndSanitizer } from '@aceshooting/lyra-ui/components/conversation/markdown/markdown-loader.js';
import '@aceshooting/lyra-ui/components/conversation/markdown/markdown.js';
import '@aceshooting/lyra-ui/components/viewers/docx-viewer/docx-viewer.js';
import { MINIMAL_DOCX_BASE64 } from './fixtures.mjs';

declare global {
  interface Window {
    __LYRA_PEER_COMPATIBILITY__?: { status: 'running' | 'passed' | 'failed'; error?: string };
  }
}

function requireCapability(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function waitFor(predicate: () => boolean, message: string, timeout = 20_000): Promise<void> {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
  throw new Error(message);
}

function base64Bytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function checkCharts(): Promise<void> {
  const preload = await preloadCharts({
    boxPlot: true,
    dataLabels: true,
    zoom: true,
  });
  requireCapability(preload.core, 'Chart.js core preload failed.');
  requireCapability(preload.boxPlot, 'Box-plot preload failed.');
  requireCapability(preload.dataLabels, 'Data-label preload failed.');
  requireCapability(preload.zoom, 'Zoom preload failed.');

  const [core, annotation, dataLabels, zoom] = await Promise.all([
    loadChartJs(),
    loadChartJsWithAnnotationResult(),
    loadChartJsWithDataLabelsResult(),
    loadChartJsWithZoomResult(),
  ]);
  requireCapability(core, 'Chart.js core loader returned null.');
  requireCapability(annotation.kind === 'available' && annotation.plugin.id === 'annotation', 'Annotation capability has the wrong plugin identity.');
  requireCapability(dataLabels.kind === 'available' && dataLabels.plugin.id === 'datalabels', 'Data-label capability has the wrong plugin identity.');
  requireCapability(zoom.kind === 'available' && zoom.plugin.id === 'zoom', 'Zoom capability has the wrong plugin identity.');
  requireCapability(core.Chart.registry.getPlugin(annotation.plugin.id) === annotation.plugin, 'Annotation registration did not retain the exact loaded plugin.');
  requireCapability(core.Chart.registry.getPlugin(zoom.plugin.id) === zoom.plugin, 'Zoom registration did not retain the exact loaded plugin.');

  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 180;
  document.body.append(canvas);
  const dataLabelSentinel = '__lyra_peer_datalabel__';
  let formatterCalls = 0;
  const chart = new core.Chart(canvas, {
    type: 'bar',
    data: {
      labels: ['A', 'B'],
      datasets: [{ label: 'Values', data: [1, 3] }],
    },
    plugins: [dataLabels.plugin],
    options: {
      animation: false,
      responsive: false,
      plugins: {
        annotation: {
          annotations: {
            reviewedFloor: { type: 'line', yMin: 2, yMax: 2 },
          },
        },
        datalabels: {
          display: true,
          formatter: () => {
            formatterCalls += 1;
            return dataLabelSentinel;
          },
        },
        zoom: {
          pan: { enabled: false },
          zoom: { mode: 'x', wheel: { enabled: false } },
        },
      },
    },
  }) as unknown as {
    config: { plugins?: unknown[] };
    destroy(): void;
    draw(): void;
    isPluginEnabled(id: string): boolean;
    update(): void;
  };
  try {
    requireCapability(
      Array.isArray(chart.config.plugins) &&
        chart.config.plugins.length === 1 &&
        chart.config.plugins[0] === dataLabels.plugin,
      'Chart config did not retain the exact per-instance data-label plugin.',
    );
    requireCapability(chart.isPluginEnabled('datalabels'), 'Data-label plugin is not enabled on the live chart.');
    chart.update();
    requireCapability(formatterCalls > 0, 'Data-label formatter hook did not run during dataset update.');
    await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
    const context = canvas.getContext('2d');
    requireCapability(context, 'Chart.js did not expose a 2D rendering context.');
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    requireCapability(pixels.some((channel, index) => index % 4 === 3 && channel > 0), 'Chart.js produced a blank canvas.');
    const originalFillText = context.fillText;
    let labelDraws = 0;
    context.fillText = (text, x, y, maxWidth) => {
      if (text === dataLabelSentinel) labelDraws += 1;
      if (maxWidth === undefined) originalFillText.call(context, text, x, y);
      else originalFillText.call(context, text, x, y, maxWidth);
    };
    try {
      chart.draw();
      requireCapability(labelDraws > 0, 'Data-label afterDatasetsDraw hook did not render its sentinel.');
    } finally {
      context.fillText = originalFillText;
    }
  } finally {
    chart.destroy();
    canvas.remove();
  }

  const boxCanvas = document.createElement('canvas');
  boxCanvas.width = 320;
  boxCanvas.height = 180;
  document.body.append(boxCanvas);
  const summary = { min: 1, q1: 2, median: 3, q3: 4, max: 5 };
  requireCapability(
    core.Chart.registry.getController('boxplot') === BoxPlotController,
    'Box-plot registry did not retain the exact controller.',
  );
  requireCapability(
    core.Chart.registry.getElement('boxandwhiskers') === BoxAndWiskers,
    'Box-plot registry did not retain the exact element.',
  );
  const BoxChart = core.Chart as unknown as new (
    item: HTMLCanvasElement,
    config: unknown,
  ) => {
    destroy(): void;
    draw(): void;
    getDatasetMeta(index: number): {
      controller: { constructor: unknown; getParsed(index: number): Record<string, number> };
      data: Array<{
        constructor: unknown;
        draw(context: CanvasRenderingContext2D): void;
        height: number;
        inRange(x: number, y: number, useFinalPosition: boolean): boolean;
        width: number;
        x: number;
        y: number;
      }>;
    };
    update(mode?: string): void;
  };
  const boxChart = new BoxChart(boxCanvas, {
    type: 'boxplot',
    data: {
      labels: ['Reviewed'],
      datasets: [{ label: 'Distribution', data: [summary] }],
    },
    options: { animation: false, responsive: false },
  });
  try {
    boxChart.update('none');
    await new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame)));
    const meta = boxChart.getDatasetMeta(0);
    const controller = meta.controller;
    const element = meta.data[0];
    requireCapability(element, 'Box-plot chart produced no data element.');
    requireCapability(
      (BoxPlotController as unknown as { id: string }).id === 'boxplot',
      'Box-plot controller has the wrong registered id.',
    );
    requireCapability(
      (BoxAndWiskers as unknown as { id: string }).id === 'boxandwhiskers',
      'Box-plot element has the wrong registered id.',
    );
    requireCapability(controller.constructor === BoxPlotController, 'Box-plot chart used the wrong controller constructor.');
    requireCapability(element.constructor === BoxAndWiskers, 'Box-plot chart used the wrong element constructor.');
    const parsed = controller.getParsed(0);
    for (const [key, value] of Object.entries(summary)) {
      requireCapability(parsed[key] === value, 'Box-plot parsed value mismatch for ' + key + '.');
    }
    requireCapability(
      [element.x, element.y, element.width, element.height].every(Number.isFinite) &&
        element.width > 0 && element.height > 0,
      'Box-plot element has invalid geometry.',
    );
    requireCapability(element.inRange(element.x, element.y, true), 'Box-plot center did not hit its element.');
    let boxPlotDrawCalls = 0;
    const originalDraw = element.draw.bind(element);
    element.draw = (context) => {
      boxPlotDrawCalls += 1;
      originalDraw(context);
    };
    boxChart.draw();
    requireCapability(boxPlotDrawCalls > 0, 'Box-plot chart.draw() did not invoke the real element draw().');
  } finally {
    boxChart.destroy();
    boxCanvas.remove();
  }
}

async function checkMarkdownMathAndSanitization(): Promise<void> {
  const dependencies = await loadMarkdownAndSanitizer();
  requireCapability(dependencies.marked, 'Lyra did not resolve Marked in Chromium.');
  requireCapability(dependencies.DOMPurify, 'Lyra did not resolve DOMPurify in Chromium.');
  const parser = new dependencies.marked.Marked();
  const hostileSource = '# Safe\\n\\n<script>globalThis.__peerXss = true</script><img src="x" onerror="globalThis.__peerXss = true"><a href="javascript:alert(1)">bad</a>';
  const dirty = await parser.parse(hostileSource);
  const sanitized = dependencies.DOMPurify.sanitize(dirty);
  requireCapability(typeof sanitized === 'string', 'DOMPurify did not return sanitized text.');
  const clean = sanitized;
  requireCapability(clean.includes('<h1'), 'Sanitized Markdown lost its safe heading.');
  requireCapability(!/<script|onerror|javascript:/iu.test(clean), 'DOMPurify retained executable Markdown markup.');

  const hostileMarkdown = document.createElement('lr-markdown') as HTMLElement & {
    content: string;
    highlightCode: boolean;
    shadowRoot: ShadowRoot;
  };
  hostileMarkdown.content = hostileSource;
  hostileMarkdown.highlightCode = false;
  document.body.append(hostileMarkdown);
  await waitFor(
    () => hostileMarkdown.shadowRoot?.querySelector('[part="heading"]') !== null,
    'Lyra Markdown never rendered sanitized content.',
  );
  const hostileContent = hostileMarkdown.shadowRoot.querySelector('[part="content"]');
  requireCapability(
    !hostileContent?.querySelector('script, [onerror], a[href^="javascript:"]'),
    'Lyra Markdown retained executable markup after sanitization.',
  );
  await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  requireCapability(
    (globalThis as typeof globalThis & { __peerXss?: boolean }).__peerXss !== true,
    'Executable Markdown markup ran in Chromium.',
  );
  hostileMarkdown.remove();

  const markdown = document.createElement('lr-markdown') as HTMLElement & {
    content: string;
    highlightCode: boolean;
    math: boolean;
    shadowRoot: ShadowRoot;
  };
  markdown.content = '$x^2$';
  markdown.highlightCode = false;
  markdown.math = true;
  document.body.append(markdown);
  await waitFor(
    () => markdown.shadowRoot?.querySelector('[part="math"] math') !== null,
    'Lyra Markdown never rendered real KaTeX MathML.',
  );
  const math = markdown.shadowRoot.querySelector('[part="math"] math');
  requireCapability(math?.namespaceURI === 'http://www.w3.org/1998/Math/MathML', 'Rendered math is not MathML.');
  markdown.remove();
}

async function checkDocx(): Promise<void> {
  const bytes = base64Bytes(MINIMAL_DOCX_BASE64);
  const url = URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }));
  const viewer = document.createElement('lr-docx-viewer') as HTMLElement & {
    shadowRoot: ShadowRoot;
    src: string;
  };
  try {
    document.body.append(viewer);
    viewer.src = url;
    await waitFor(
      () =>
        viewer.shadowRoot?.querySelector('[part~="content"] h1') !== null ||
        viewer.shadowRoot?.querySelector('[part~="error"]') !== null,
      'Lyra DOCX viewer never settled.',
    );
    const error = viewer.shadowRoot.querySelector('[part~="error"]');
    requireCapability(!error, 'Lyra DOCX viewer failed: ' + (error?.textContent?.trim() ?? 'unknown error'));
    const content = viewer.shadowRoot.querySelector('[part~="content"]');
    requireCapability(content?.querySelector('h1')?.textContent?.includes('Lyra UI Test Fixture'), 'DOCX heading was not rendered.');
    requireCapability(content?.querySelector('p')?.textContent?.includes('tiny fixture document'), 'DOCX paragraph was not rendered.');
    requireCapability(!content?.querySelector('script, [onerror], [onclick]'), 'DOCX sanitization retained executable markup.');
  } finally {
    viewer.remove();
    URL.revokeObjectURL(url);
  }
}

async function run(): Promise<void> {
  await checkCharts();
  await checkMarkdownMathAndSanitization();
  await checkDocx();
}

window.__LYRA_PEER_COMPATIBILITY__ = { status: 'running' };
void run().then(
  () => {
    if (window.__LYRA_PEER_COMPATIBILITY__?.status === 'running') {
      window.__LYRA_PEER_COMPATIBILITY__ = { status: 'passed' };
    }
  },
  (error: unknown) => {
    window.__LYRA_PEER_COMPATIBILITY__ = {
      status: 'failed',
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    };
  },
);
`;
}

function browserRunnerSource() {
  return `import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, relative, resolve } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { chromium } from 'playwright';

const root = resolve('dist');
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.woff2', 'font/woff2'],
]);
const contractDeadline = Date.now() + ${BROWSER_CONTRACT_DEADLINE_MS};
function remainingContractTime(label) {
  const remaining = contractDeadline - Date.now();
  if (remaining <= 0) throw new Error('Chromium contract deadline expired before ' + label + '.');
  return remaining;
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname);
    const file = resolve(root, '.' + pathname);
    const fromRoot = relative(root, file);
    if (fromRoot.startsWith('..') || fromRoot.includes('..\\\\') || fromRoot === '') {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const metadata = await stat(file);
    if (!metadata.isFile()) throw new Error('Not a file');
    response.writeHead(200, {
      'cache-control': 'no-store',
      'content-type': contentTypes.get(extname(file)) ?? 'application/octet-stream',
    });
    await pipeline(createReadStream(file), response);
  } catch (error) {
    if (!response.headersSent) response.writeHead(404).end('Not found');
    else response.destroy(error instanceof Error ? error : new Error(String(error)));
  }
});

await new Promise((resolveListen, rejectListen) => {
  const onError = (error) => {
    server.off('listening', onListening);
    rejectListen(error);
  };
  const onListening = () => {
    server.off('error', onError);
    resolveListen();
  };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(0, '127.0.0.1');
});
const address = server.address();
if (!address || typeof address === 'string') throw new Error('Static server did not expose a TCP port.');

const sockets = new Set();
server.on('connection', (socket) => {
  sockets.add(socket);
  socket.once('close', () => sockets.delete(socket));
});
function retainCleanupError(primary, cleanup) {
  if (primary && typeof primary === 'object' && Object.isExtensible(primary)) {
    const prior = primary.cleanupError;
    Object.defineProperty(primary, 'cleanupError', {
      configurable: true,
      value: prior === undefined
        ? cleanup
        : new AggregateError([prior, cleanup], 'Multiple browser-runner cleanup operations failed.'),
    });
  }
}
function describeFailure(value) {
  const detail = value instanceof Error ? value.stack ?? value.message : String(value);
  const aggregate = value instanceof AggregateError
    ? value.errors.map((error) => describeFailure(error)).join('\\n')
    : '';
  const cleanup = value && typeof value === 'object' ? value.cleanupError : undefined;
  return [detail, aggregate, cleanup === undefined ? '' : 'Cleanup failure:\\n' + describeFailure(cleanup)]
    .filter(Boolean)
    .join('\\n');
}
async function bounded(label, operation, timeout = 10_000) {
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, rejectTimeout) => {
        timer = setTimeout(() => rejectTimeout(new Error(label + ' timed out.')), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

let browserServer;
let browser;
let primaryError;
try {
  browserServer = await chromium.launchServer({
    headless: true,
    timeout: remainingContractTime('browser launch'),
  });
  browser = await chromium.connect(browserServer.wsEndpoint(), {
    timeout: remainingContractTime('browser connection'),
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(remainingContractTime('page setup'));
  page.on('console', (message) => console.log('[chromium ' + message.type() + '] ' + message.text()));
  page.on('pageerror', (error) => console.error('[chromium pageerror] ' + error.message));
  await page.goto('http://127.0.0.1:' + address.port + '/', {
    timeout: remainingContractTime('page navigation'),
    waitUntil: 'load',
  });
  await page.waitForFunction(
    () => {
      const result = globalThis.__LYRA_PEER_COMPATIBILITY__;
      return result != null && result.status !== 'running';
    },
    undefined,
    { timeout: remainingContractTime('capability settlement') },
  );
  const result = await page.evaluate(() => globalThis.__LYRA_PEER_COMPATIBILITY__);
  if (!result || result.status !== 'passed') {
    throw new Error('Chromium peer-capability check failed: ' + (result?.error ?? 'no result'));
  }
  console.log('Chromium peer capabilities passed.');
} catch (error) {
  primaryError = error;
} finally {
  let forceBrowserServer = false;
  if (browser) {
    try {
      await bounded('Chromium close', browser.close());
    } catch (cleanupError) {
      forceBrowserServer = true;
      if (!primaryError) primaryError = cleanupError;
      else retainCleanupError(primaryError, cleanupError);
    }
  }
  if (browserServer) {
    if (!forceBrowserServer) {
      try {
        await bounded('Chromium server close', browserServer.close());
      } catch (cleanupError) {
        forceBrowserServer = true;
        if (!primaryError) primaryError = cleanupError;
        else retainCleanupError(primaryError, cleanupError);
      }
    }
    if (forceBrowserServer) {
      console.error(
        'Browser runner failure before forced cleanup:\\n' + describeFailure(primaryError),
      );
      try {
        // This final owner-aware kill deliberately has no inner race. The outer
        // command deadline will terminate the still-live runner and its tree if
        // Playwright cannot settle its own cross-platform process cleanup.
        await browserServer.kill();
      } catch (cleanupError) {
        if (!primaryError) primaryError = cleanupError;
        else retainCleanupError(primaryError, cleanupError);
        console.error(describeFailure(primaryError));
        await new Promise(() => {});
      }
    }
  }
  try {
    const closePromise = new Promise((resolveClose, rejectClose) =>
      server.close((error) => (error ? rejectClose(error) : resolveClose())),
    );
    try {
      await bounded('Static server close', closePromise, 5_000);
    } catch (error) {
      server.closeAllConnections?.();
      for (const socket of sockets) socket.destroy();
      await Promise.race([closePromise.catch(() => {}), new Promise((resolveWait) => setTimeout(resolveWait, 100))]);
      throw error;
    }
  } catch (cleanupError) {
    if (!primaryError) primaryError = cleanupError;
    else retainCleanupError(primaryError, cleanupError);
  } finally {
    server.closeAllConnections?.();
    for (const socket of sockets) socket.destroy();
  }
}
if (primaryError) throw primaryError;
`;
}

function consumerPackageJson({ authority, packageManager, profile, tarballSpecifier }) {
  const dependencies = {
    '@aceshooting/lyra-ui': tarballSpecifier,
    ...profile.versions,
  };
  return {
    name: `lyra-peer-compatibility-${profile.id}-${packageManager}`,
    version: '0.0.0',
    private: true,
    type: 'module',
    engines: { node: '>=22.13.0 <23' },
    dependencies,
    devDependencies: {
      playwright: authority.toolchain.playwright,
      typescript: authority.toolchain.typescript,
      vite: authority.toolchain.vite,
    },
    overrides: {
      '@napi-rs/wasm-runtime': '1.1.6',
    },
  };
}

export function createConsumerFileMap({
  authority,
  packageManager,
  profile,
  tarballSpecifier,
}) {
  const canonicalProfile = resolvePeerProfiles(authority).find(({ id }) => id === profile?.id);
  if (!canonicalProfile || JSON.stringify(canonicalProfile.versions) !== JSON.stringify(profile.versions)) {
    throw new Error(`Consumer profile ${JSON.stringify(profile?.id)} is not the resolved authority profile.`);
  }
  if (packageManager !== 'pnpm' && packageManager !== 'npm') {
    throw new Error(`Consumer package manager must be pnpm or npm; found ${JSON.stringify(packageManager)}.`);
  }
  let tarballUrl;
  try {
    tarballUrl = new URL(tarballSpecifier);
  } catch {
    throw new Error('Consumer tarball specifier must be one validated loopback HTTP URL.');
  }
  if (
    tarballUrl.protocol !== 'http:' ||
    tarballUrl.hostname !== '127.0.0.1' ||
    tarballUrl.username ||
    tarballUrl.password ||
    tarballUrl.search ||
    tarballUrl.hash ||
    !/^\/lyra-[a-f0-9-]+-[a-f0-9]{64}\.tgz$/u.test(tarballUrl.pathname)
  ) {
    throw new Error('Consumer tarball specifier must be one tokenized content-addressed loopback HTTP URL.');
  }

  const files = new Map([
    [
      '.npmrc',
      'audit=false\nauto-install-peers=false\nforce=false\nfund=false\nignore-scripts=true\nlegacy-peer-deps=false\nstrict-peer-dependencies=true\nstrict-peer-deps=true\n',
    ],
    [
      'index.html',
      '<!doctype html>\n<html lang="en"><head><meta charset="UTF-8"><title>Lyra peer compatibility</title></head><body><script>window.__LYRA_PEER_COMPATIBILITY__={status:"running"};window.addEventListener("error",function(event){window.__LYRA_PEER_COMPATIBILITY__={status:"failed",error:String(event.error&&event.error.stack||event.message)}});window.addEventListener("unhandledrejection",function(event){var reason=event.reason;window.__LYRA_PEER_COMPATIBILITY__={status:"failed",error:String(reason&&reason.stack||reason)}});</script><script type="module" src="/src/browser.ts"></script></body></html>\n',
    ],
    [
      'package.json',
      `${JSON.stringify(consumerPackageJson({ authority, packageManager, profile, tarballSpecifier }), null, 2)}\n`,
    ],
    ['scripts/run-browser.mjs', browserRunnerSource()],
    ['src/browser.ts', consumerBrowserSource()],
    ['src/fixtures.mjs', `export const MINIMAL_DOCX_BASE64 = ${JSON.stringify(DOCX_BASE64)};\n`],
    ['src/node-contract.mjs', consumerNodeContractSource()],
    ['src/type-contract.ts', consumerTypeContractSource()],
    [
      'tsconfig.json',
      `${JSON.stringify(
        {
          compilerOptions: {
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            moduleResolution: 'Bundler',
            noEmit: true,
            skipLibCheck: false,
            strict: true,
            target: 'ES2022',
          },
          include: ['src/type-contract.ts'],
        },
        null,
        2,
      )}\n`,
    ],
    [
      'vite.config.mjs',
      `import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: 'dist',
    target: 'es2022',
  },
});
`,
    ],
  ]);
  return new Map([...files.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function delay(milliseconds) {
  return new Promise((resolveWait) => setTimeout(resolveWait, milliseconds));
}

function observeChildClose(child) {
  let closed = false;
  let closeValue;
  let resolveClose;
  const promise = new Promise((resolveWait) => {
    resolveClose = resolveWait;
  });
  const onClose = (code, signal) => {
    closed = true;
    closeValue = { code, signal };
    resolveClose(closeValue);
  };
  child.once('close', onClose);
  return {
    dispose() {
      child.off('close', onClose);
    },
    get closed() {
      return closed;
    },
    get value() {
      return closeValue;
    },
    promise,
  };
}

async function waitBounded(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolveTimeout) => {
        timer = setTimeout(() => resolveTimeout(undefined), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function safeWindowsSystemRoot(systemRoot) {
  if (
    typeof systemRoot !== 'string' ||
    !pathWin32.isAbsolute(systemRoot) ||
    /[\u0000\r\n"%!^&|<>()]/u.test(systemRoot)
  ) {
    throw new Error('Windows process cleanup requires one safe absolute SystemRoot.');
  }
  return systemRoot.replace(/[\\/]+$/u, '');
}

function processGroupExists(pid, killImpl) {
  try {
    killImpl(-pid, 0);
    return true;
  } catch (error) {
    if (error?.code === 'ESRCH') return false;
    throw error;
  }
}

async function waitForProcessGroupGone(pid, killImpl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (processGroupExists(pid, killImpl)) {
    if (Date.now() >= deadline) return false;
    await delay(Math.min(20, Math.max(1, deadline - Date.now())));
  }
  return true;
}

export async function terminateProcessTree(
  child,
  graceMs = PROCESS_KILL_GRACE_MS,
  {
    closeObserver: suppliedCloseObserver,
    killImpl = process.kill,
    platform = process.platform,
    spawnImpl = spawn,
    systemRoot = process.env.SystemRoot,
  } = {},
) {
  if (!Number.isSafeInteger(graceMs) || graceMs <= 0) {
    throw new Error('Process-tree termination grace must be a positive integer.');
  }
  if (!child?.pid) return;
  const closeObserver = suppliedCloseObserver ?? observeChildClose(child);
  const ownsObserver = suppliedCloseObserver === undefined;
  try {
    if (platform === 'win32') {
      const taskkill = pathWin32.join(safeWindowsSystemRoot(systemRoot), 'System32', 'taskkill.exe');
      let killer;
      try {
        killer = spawnImpl(taskkill, ['/pid', String(child.pid), '/t', '/f'], {
          detached: false,
          stdio: 'ignore',
          windowsHide: true,
        });
      } catch (spawnError) {
        let targetKillError;
        try {
          if (child.kill('SIGKILL') === false) {
            targetKillError = new Error('Windows target process refused SIGKILL fallback.');
          }
        } catch (error) {
          targetKillError = error;
        }
        const targetResult = await waitBounded(closeObserver.promise, graceMs);
        const error = new Error(`Windows taskkill helper could not start for process ${child.pid}.`);
        preserveCleanupFailure(error, spawnError);
        if (!targetResult) {
          preserveCleanupFailure(
            error,
            targetKillError ?? new Error('Windows target did not close after taskkill spawn failure.'),
          );
        } else if (targetKillError) {
          preserveCleanupFailure(error, targetKillError);
        }
        throw error;
      }
      const killerClose = observeChildClose(killer);
      let killerError;
      const onKillerError = (error) => {
        killerError = error;
      };
      killer.once('error', onKillerError);
      let killerResult;
      try {
        killerResult = await waitBounded(killerClose.promise, graceMs);
        if (!killerResult) {
          let killed;
          try {
            killed = killer.kill('SIGKILL');
          } catch (error) {
            killerError = error;
          }
          if (killed === false && !killerError) {
            killerError = new Error('Windows taskkill helper refused SIGKILL cleanup.');
          }
          killerResult = await waitBounded(killerClose.promise, graceMs);
          if (!killerResult) {
            killerError ??= new Error('Windows taskkill helper remained open after SIGKILL.');
            try {
              killer.unref?.();
            } catch (unrefError) {
              killerError = new AggregateError(
                [killerError, unrefError],
                'Windows taskkill helper cleanup and handle release both failed.',
              );
            }
          }
        }
      } finally {
        killer.off('error', onKillerError);
        killerClose.dispose();
      }

      let targetResult = await waitBounded(closeObserver.promise, graceMs);
      if (!targetResult) {
        try {
          if (child.kill('SIGKILL') === false) {
            killerError ??= new Error('Windows target process refused SIGKILL fallback.');
          }
        } catch (error) {
          killerError ??= error;
        }
        targetResult = await waitBounded(closeObserver.promise, graceMs);
      }
      if (!targetResult) {
        const error = new Error('Windows process tree did not close after bounded taskkill and SIGKILL fallback.');
        if (killerError) preserveCleanupFailure(error, killerError);
        throw error;
      }
      const helperSucceeded = !killerError && killerResult?.code === 0;
      if (!helperSucceeded) {
        const helperFailure = new Error(
          `Windows taskkill helper did not complete successfully for process ${child.pid}.`,
        );
        if (killerError) preserveCleanupFailure(helperFailure, killerError);
        throw helperFailure;
      }
      return;
    }

    try {
      killImpl(-child.pid, 'SIGTERM');
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error;
    }
    await waitBounded(closeObserver.promise, graceMs);
    if (processGroupExists(child.pid, killImpl)) {
      try {
        killImpl(-child.pid, 'SIGKILL');
      } catch (error) {
        if (error?.code !== 'ESRCH') throw error;
      }
    }
    if (!(await waitForProcessGroupGone(child.pid, killImpl, graceMs))) {
      throw new Error(`POSIX process group ${child.pid} survived bounded SIGKILL cleanup.`);
    }
    if (!closeObserver.closed && !(await waitBounded(closeObserver.promise, graceMs))) {
      throw new Error(`Process ${child.pid} did not emit close after its process group exited.`);
    }
  } catch (error) {
    if (!closeObserver.closed) {
      try {
        child.unref?.();
      } catch (unrefError) {
        preserveCleanupFailure(error, unrefError);
      }
    }
    throw error;
  } finally {
    if (ownsObserver) closeObserver.dispose();
  }
}

const UNSAFE_CMD_TOKEN = /[\u0000\r\n"%!^&|<>()]/u;

export function createPortableSpawnPlan(
  command,
  args,
  {
    comspec = process.env.ComSpec,
    platform = process.platform,
  } = {},
) {
  if (platform !== 'win32' || !/\.(?:cmd|bat)$/iu.test(command)) {
    return Object.freeze({
      args: Object.freeze([...args]),
      command,
      windowsVerbatimArguments: false,
    });
  }
  if (!pathWin32.isAbsolute(command) || UNSAFE_CMD_TOKEN.test(command)) {
    throw new Error(`Unsafe Windows cmd shim path ${JSON.stringify(command)}.`);
  }
  if (
    typeof comspec !== 'string' ||
    !pathWin32.isAbsolute(comspec) ||
    pathWin32.basename(comspec).toLowerCase() !== 'cmd.exe' ||
    UNSAFE_CMD_TOKEN.test(comspec)
  ) {
    throw new Error(`Unsafe Windows ComSpec ${JSON.stringify(comspec)}.`);
  }
  for (const argument of args) {
    if (argument.length === 0 || argument.endsWith('\\') || UNSAFE_CMD_TOKEN.test(argument)) {
      throw new Error(`Unsafe Windows cmd argument contains a metacharacter: ${JSON.stringify(argument)}.`);
    }
  }
  const commandLine = `""${command}"${args.length ? ` ${args.map((argument) => `"${argument}"`).join(' ')}` : ''}"`;
  return Object.freeze({
    args: Object.freeze(['/d', '/s', '/v:off', '/c', commandLine]),
    command: comspec,
    windowsVerbatimArguments: true,
  });
}

function commandFailureMessage(label, detail, stdout, stderr) {
  const evidence = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
  return `${label} ${detail}.${evidence ? `\nBounded command output:\n${evidence}` : ''}`;
}

export function runBoundedCommand(
  {
    args = [],
    capture = false,
    command,
    cwd,
    env,
    label,
    maxOutputBytes = DEFAULT_COMMAND_OUTPUT_BYTES,
    signal,
    timeoutMs,
  },
  { spawnImpl = spawn, terminateTreeImpl = terminateProcessTree } = {},
) {
  if (typeof command !== 'string' || command.length === 0) throw new TypeError('Bounded command is required.');
  if (!Array.isArray(args) || args.some((argument) => typeof argument !== 'string')) {
    throw new TypeError('Bounded command arguments must be strings.');
  }
  if (!isAbsolute(cwd)) throw new Error(`Bounded command cwd must be absolute: ${cwd}.`);
  if (typeof label !== 'string' || label.length === 0) throw new TypeError('Bounded command label is required.');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error(`${label} timeout must be positive.`);
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0) {
    throw new Error(`${label} output limit must be positive.`);
  }
  if (signal !== undefined && !(signal instanceof AbortSignal)) {
    throw new TypeError(`${label} signal must be an AbortSignal.`);
  }
  if (signal?.aborted) {
    return Promise.reject(new Error(`${label} aborted before spawn.`, { cause: signal.reason }));
  }

  return new Promise((resolveRun, rejectRun) => {
    let settled = false;
    let stoppingError;
    let stopPromise;
    let deadline;
    let outputBytes = 0;
    const outputChunks = [];
    const errorChunks = [];
    const invocation = createPortableSpawnPlan(command, args, {
      comspec: env?.ComSpec,
      platform: process.platform,
    });
    let child;
    try {
      child = spawnImpl(invocation.command, invocation.args, {
        cwd,
        detached: process.platform !== 'win32',
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        windowsVerbatimArguments: invocation.windowsVerbatimArguments,
      });
    } catch (error) {
      rejectRun(error);
      return;
    }
    const closeObserver = observeChildClose(child);

    const outputText = () => Buffer.concat(outputChunks).toString('utf8');
    const errorText = () => Buffer.concat(errorChunks).toString('utf8');
    let onStreamError;
    const dispose = () => {
      clearTimeout(deadline);
      signal?.removeEventListener('abort', onAbort);
      child.off('error', onChildError);
      closeObserver.dispose();
      child.stdout?.off('data', onStdoutData);
      child.stderr?.off('data', onStderrData);
      child.stdout?.off('error', onStreamError);
      child.stderr?.off('error', onStreamError);
      child.stdout?.destroy();
      child.stderr?.destroy();
    };
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      dispose();
      if (error) rejectRun(error);
      else resolveRun(value);
    };
    const stop = (error) => {
      if (stopPromise) return stopPromise;
      stoppingError = error;
      stopPromise = Promise.resolve()
        .then(() =>
          terminateTreeImpl(child, PROCESS_KILL_GRACE_MS, { closeObserver }),
        )
        .catch((terminationError) => {
          preserveCleanupFailure(stoppingError, terminationError);
        })
        .then(() => finish(stoppingError));
      return stopPromise;
    };
    const collect = (target, chunk) => {
      if (stoppingError) return;
      const bytes = Buffer.from(chunk);
      const remaining = Math.max(0, maxOutputBytes - outputBytes);
      if (remaining > 0) target.push(Buffer.from(bytes.subarray(0, remaining)));
      outputBytes += bytes.length;
      if (outputBytes > maxOutputBytes) {
        stop(
          new Error(
            commandFailureMessage(
              label,
              `exceeded bounded output limit ${maxOutputBytes} bytes`,
              outputText(),
              errorText(),
            ),
          ),
        );
        return;
      }
    };
    const onStdoutData = (chunk) => collect(outputChunks, chunk);
    const onStderrData = (chunk) => collect(errorChunks, chunk);
    const onChildError = (error) => {
      if (!stoppingError) stop(error);
    };
    onStreamError = (error) => {
      if (!stoppingError) stop(error);
    };
    const onClose = ({ code, signal: closeSignal }) => {
      if (stoppingError) return;
      const stdout = outputText();
      const stderr = errorText();
      if (code !== 0) {
        void stop(
          new Error(
            commandFailureMessage(
              label,
              closeSignal ? `failed from signal ${closeSignal}` : `failed with exit code ${code}`,
              stdout,
              stderr,
            ),
          ),
        );
        return;
      }
      const finishSuccess = () => {
        if (!capture) {
          try {
            if (stdout) process.stdout.write(stdout);
            if (stderr) process.stderr.write(stderr);
          } catch (writeError) {
            finish(writeError);
            return;
          }
        }
        finish(undefined, capture ? stdout.trim() : undefined);
      };
      if (process.platform !== 'win32') {
        clearTimeout(deadline);
        stopPromise = Promise.resolve()
          .then(() => delay(Math.min(50, PROCESS_KILL_GRACE_MS)))
          .then(() => terminateTreeImpl(child, PROCESS_KILL_GRACE_MS, { closeObserver }))
          .then(finishSuccess, (cleanupError) => finish(cleanupError));
        return;
      }
      finishSuccess();
    };
    const onAbort = () => {
      stop(new Error(`${label} aborted.`, { cause: signal.reason }));
    };
    child.stdout?.on('error', onStreamError);
    child.stderr?.on('error', onStreamError);
    child.stdout?.on('data', onStdoutData);
    child.stderr?.on('data', onStderrData);
    child.once('error', onChildError);
    void closeObserver.promise.then(onClose);
    signal?.addEventListener('abort', onAbort, { once: true });
    deadline = setTimeout(() => {
      stop(
        new Error(
          commandFailureMessage(
            label,
            `timed out after ${timeoutMs} ms`,
            outputText(),
            errorText(),
          ),
        ),
      );
    }, timeoutMs);
    if (signal?.aborted) onAbort();
  });
}

function runCommand(command, args, cwd, label, options = {}) {
  return runBoundedCommand({
    command,
    args,
    cwd,
    env: options.env ?? { ...process.env, CI: 'true' },
    label,
    maxOutputBytes: options.maxOutputBytes ?? DEFAULT_COMMAND_OUTPUT_BYTES,
    timeoutMs: options.timeoutMs ?? COMMAND_TIMEOUTS.node,
  });
}

function captureCommand(command, args, cwd, label, options = {}) {
  return runBoundedCommand({
    command,
    args,
    capture: true,
    cwd,
    env: options.env ?? { ...process.env, CI: 'true' },
    label,
    maxOutputBytes: options.maxOutputBytes ?? 64 * 1024,
    timeoutMs: options.timeoutMs ?? COMMAND_TIMEOUTS.toolchain,
  });
}

async function validateTemporaryWorkspace(workspace) {
  if (!isAbsolute(workspace)) throw new Error('Peer-compatibility workspace must be absolute.');
  const [canonicalTmp, canonicalWorkspace] = await Promise.all([realpath(tmpdir()), realpath(workspace)]);
  const fromTmp = relative(canonicalTmp, canonicalWorkspace);
  if (
    fromTmp.length === 0 ||
    fromTmp.startsWith('..') ||
    isAbsolute(fromTmp) ||
    fromTmp.includes(sep) ||
    !fromTmp.startsWith('lyra-peer-compatibility-')
  ) {
    throw new Error(
      `Refusing unsafe peer-compatibility workspace ${canonicalWorkspace}; expected one direct lyra-peer-compatibility-* child of ${canonicalTmp}.`,
    );
  }
  if (!(await stat(canonicalWorkspace)).isDirectory()) {
    throw new Error(`Peer-compatibility workspace is not a directory: ${canonicalWorkspace}.`);
  }
  return canonicalWorkspace;
}

export async function withTemporaryPeerWorkspace(
  operation,
  {
    createWorkspace = async () => mkdtemp(join(await realpath(tmpdir()), 'lyra-peer-compatibility-')),
    removeWorkspace = (workspace) => rm(workspace, { recursive: true, force: true }),
  } = {},
) {
  if (typeof operation !== 'function') throw new TypeError('Temporary workspace operation is required.');
  const createdWorkspace = await createWorkspace();
  let workspace;
  try {
    workspace = await validateTemporaryWorkspace(createdWorkspace);
  } catch (primaryError) {
    try {
      const canonicalTmp = await realpath(tmpdir());
      const cleanupCandidate = resolve(createdWorkspace);
      const fromTmp = relative(canonicalTmp, cleanupCandidate);
      if (
        !isAbsolute(createdWorkspace) ||
        fromTmp.length === 0 ||
        fromTmp.startsWith('..') ||
        isAbsolute(fromTmp) ||
        fromTmp.includes(sep) ||
        !fromTmp.startsWith('lyra-peer-compatibility-')
      ) {
        throw new Error(`Refusing to clean unvalidated temporary path ${JSON.stringify(createdWorkspace)}.`);
      }
      await removeWorkspace(cleanupCandidate);
    } catch (cleanupError) {
      preserveCleanupFailure(primaryError, cleanupError);
    }
    throw primaryError;
  }
  let primaryError;
  let result;
  try {
    result = await operation(workspace);
  } catch (error) {
    primaryError = error;
  }
  try {
    await removeWorkspace(workspace);
  } catch (cleanupError) {
    if (!primaryError) throw cleanupError;
    preserveCleanupFailure(primaryError, cleanupError);
  }
  if (primaryError) throw primaryError;
  return result;
}

function fixtureTarget(root, relativePath) {
  if (
    typeof relativePath !== 'string' ||
    relativePath.length === 0 ||
    isAbsolute(relativePath) ||
    relativePath.split(/[\\/]/u).includes('..')
  ) {
    throw new Error(`Unsafe embedded consumer path ${JSON.stringify(relativePath)}.`);
  }
  const target = resolve(root, relativePath);
  const fromRoot = relative(root, target);
  if (fromRoot.startsWith('..') || isAbsolute(fromRoot)) {
    throw new Error(`Embedded consumer path escaped its root: ${relativePath}.`);
  }
  return target;
}

async function writeConsumerFiles(consumerRoot, files) {
  await mkdir(consumerRoot, { recursive: true });
  for (const [relativePath, contents] of files) {
    if (typeof contents !== 'string') {
      throw new TypeError(`Embedded consumer file ${relativePath} must contain text.`);
    }
    const target = fixtureTarget(consumerRoot, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, contents);
  }
}

function tarField(header, start, end, label) {
  const field = header.subarray(start, end);
  const nul = field.indexOf(0);
  if (nul >= 0 && !field.subarray(nul + 1).every((byte) => byte === 0)) {
    throw new Error(`${label}: tar field contains nonzero bytes after its NUL terminator.`);
  }
  const bytes = nul < 0 ? field : field.subarray(0, nul);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new Error(`${label}: tar field is not valid UTF-8 (${error instanceof Error ? error.message : error}).`);
  }
}

function tarOctal(field, label) {
  if (field.some((byte) => byte > 0x7f)) {
    throw new Error(label + ': tar octal field uses unsupported binary encoding.');
  }
  const nul = field.indexOf(0);
  if (
    nul >= 0 &&
    !field.subarray(nul + 1).every((byte) => byte === 0 || byte === 0x20)
  ) {
    throw new Error(label + ': tar octal field contains data after its terminator.');
  }
  const value = (nul < 0 ? field : field.subarray(0, nul)).toString('ascii').trim();
  if (!/^[0-7]+$/u.test(value)) throw new Error(`${label}: malformed tar octal field.`);
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${label}: tar number is out of range.`);
  return parsed;
}

function tarOptionalOctal(field, label) {
  if (field.every((byte) => byte === 0 || byte === 0x20)) return undefined;
  return tarOctal(field, label);
}

function tarEntryPath(header) {
  const name = tarField(header, 0, 100, 'tar name');
  const prefix = tarField(header, 345, 500, 'tar prefix');
  return prefix ? `${prefix}/${name}` : name;
}

function validateTarHeaderChecksum(header, entryPath) {
  const expected = tarOctal(header.subarray(148, 156), entryPath || 'tar header');
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  if (actual !== expected) throw new Error(`${entryPath || 'tar header'}: tar header checksum mismatch.`);
}

function validateArchivePath(entryPath, type) {
  if (
    entryPath.includes('\\') ||
    entryPath.startsWith('/') ||
    /^[A-Za-z]:/u.test(entryPath) ||
    !entryPath.startsWith('package/')
  ) {
    throw new Error(`Unsafe tar archive path ${JSON.stringify(entryPath)}.`);
  }
  if (entryPath === 'package/') {
    if (type !== '5') throw new Error('Unsafe tar archive root must be a directory.');
    return 'package';
  }
  if ((type === '5') !== entryPath.endsWith('/')) {
    throw new Error(`Unsafe tar archive path/type mismatch ${JSON.stringify(entryPath)}.`);
  }
  const canonicalPath = type === '5' ? entryPath.slice(0, -1) : entryPath;
  if (canonicalPath !== canonicalPath.normalize('NFC')) {
    throw new Error(`Unsafe non-NFC portable tar archive path ${JSON.stringify(entryPath)}.`);
  }
  const parts = canonicalPath.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..')) {
    throw new Error(`Unsafe tar archive path ${JSON.stringify(entryPath)}.`);
  }
  for (const part of parts) {
    if (
      /[\u0000-\u001f\u007f<>:"|?*]/u.test(part) ||
      /[. ]$/u.test(part) ||
      /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(part)
    ) {
      throw new Error(`Unsafe nonportable tar archive path segment ${JSON.stringify(part)}.`);
    }
  }
  return canonicalPath.toLowerCase();
}

function assertNoPortableArchiveCollision(entries, key, entryPath, type) {
  const existing = entries.get(key);
  if (existing) {
    throw new Error(
      `Portable tar archive path collision between ${JSON.stringify(existing.path)} and ${JSON.stringify(entryPath)}.`,
    );
  }
  const segments = key.split('/');
  for (let count = 1; count < segments.length; count += 1) {
    const ancestor = entries.get(segments.slice(0, count).join('/'));
    if (ancestor?.type === '0') {
      throw new Error(
        `Portable tar archive file/descendant collision between ${JSON.stringify(ancestor.path)} and ${JSON.stringify(entryPath)}.`,
      );
    }
  }
  if (type === '0') {
    for (const [existingKey, value] of entries) {
      if (existingKey.startsWith(`${key}/`)) {
        throw new Error(
          `Portable tar archive file/descendant collision between ${JSON.stringify(entryPath)} and ${JSON.stringify(value.path)}.`,
        );
      }
    }
  }
  entries.set(key, { path: entryPath, type });
}

function contentDigest(files) {
  const digest = createHash('sha256');
  for (const file of files) {
    digest.update(`${Buffer.byteLength(file.path)}:${file.path}:${file.size}:`);
    digest.update(file.sha256);
    digest.update('\n');
  }
  return digest.digest('hex');
}

function resolvedTarballLimits(overrides = {}) {
  if (!isRecord(overrides)) throw new TypeError('Tarball limits must be an object.');
  const unknown = Object.keys(overrides).filter((key) => !(key in DEFAULT_TARBALL_LIMITS));
  if (unknown.length > 0) throw new Error(`Unknown tarball limit ${unknown.join(', ')}.`);
  const limits = { ...DEFAULT_TARBALL_LIMITS, ...overrides };
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`Tarball limit ${name} must be a positive safe integer.`);
    }
  }
  return limits;
}

export function inspectPeerTarballArchive(compressed, { expectedPackage, limits: overrides } = {}) {
  if (!Buffer.isBuffer(compressed) && !(compressed instanceof Uint8Array)) {
    throw new TypeError('Peer-compatibility tarball bytes must be a Buffer or Uint8Array.');
  }
  if (!isRecord(expectedPackage)) throw new TypeError('Expected tarball package identity is required.');
  stableVersion(expectedPackage.version, 'expected tarball package version');
  if (expectedPackage.name !== '@aceshooting/lyra-ui') {
    throw new Error('Expected tarball package name must be @aceshooting/lyra-ui.');
  }
  const limits = resolvedTarballLimits(overrides);
  const bytes = Buffer.from(compressed);
  if (bytes.length > limits.maxCompressedBytes) {
    throw new Error(`Peer tarball exceeds compressed size limit ${limits.maxCompressedBytes}.`);
  }
  let archive;
  try {
    archive = gunzipSync(bytes, { maxOutputLength: limits.maxArchiveBytes });
  } catch (error) {
    throw new Error(`Invalid or oversized peer tarball: ${error instanceof Error ? error.message : error}.`);
  }
  if (archive.length % 512 !== 0) {
    throw new Error('Peer tarball archive length is not aligned to a complete 512-byte block.');
  }

  let manifestBytes;
  let offset = 0;
  let entryCount = 0;
  let sawEndMarker = false;
  const archiveEntries = new Map();
  const files = [];
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      const secondEnd = archive.subarray(offset + 512, offset + 1_024);
      if (secondEnd.length !== 512 || !secondEnd.every((byte) => byte === 0)) {
        throw new Error('Peer tarball has only one end marker.');
      }
      if (!archive.subarray(offset + 1_024).every((byte) => byte === 0)) {
        throw new Error('Peer tarball has nonzero data after its end markers.');
      }
      sawEndMarker = true;
      break;
    }

    const entryPath = tarEntryPath(header);
    validateTarHeaderChecksum(header, entryPath);
    if (tarField(header, 257, 263, `${entryPath} magic`) !== 'ustar') {
      throw new Error(`${entryPath}: tar header must use canonical ustar magic.`);
    }
    if (tarField(header, 263, 265, `${entryPath} version`) !== '00') {
      throw new Error(`${entryPath}: tar header must use canonical ustar version 00.`);
    }
    tarOctal(header.subarray(108, 116), `${entryPath} uid`);
    tarOctal(header.subarray(116, 124), `${entryPath} gid`);
    tarOctal(header.subarray(136, 148), `${entryPath} mtime`);
    tarField(header, 265, 297, `${entryPath} owner name`);
    tarField(header, 297, 329, `${entryPath} group name`);
    tarOptionalOctal(header.subarray(329, 337), `${entryPath} device major`);
    tarOptionalOctal(header.subarray(337, 345), `${entryPath} device minor`);
    if (!header.subarray(500, 512).every((byte) => byte === 0)) {
      throw new Error(`${entryPath}: tar header reserved bytes must be zero.`);
    }
    const typeByte = header[156];
    const type = typeByte === 0 ? '0' : String.fromCharCode(typeByte);
    if (type !== '0' && type !== '5') {
      throw new Error(`Unsafe archive entry type ${JSON.stringify(type)} for ${entryPath}; links and special files are forbidden.`);
    }
    const linkName = tarField(header, 157, 257, `${entryPath} link name`);
    if (linkName !== '') throw new Error(`Unsafe archive link target on ${entryPath}.`);
    const portableKey = validateArchivePath(entryPath, type);
    assertNoPortableArchiveCollision(archiveEntries, portableKey, entryPath, type);
    entryCount += 1;
    if (entryCount > limits.maxEntries) {
      throw new Error(`Peer tarball exceeds archive entry limit ${limits.maxEntries}.`);
    }

    const mode = tarOctal(header.subarray(100, 108), `${entryPath} mode`);
    if ((mode & 0o7000) !== 0 || mode > 0o7777) {
      throw new Error(`${entryPath}: unsafe tar mode ${mode.toString(8)}.`);
    }
    const size = tarOctal(header.subarray(124, 136), entryPath);
    if (size > limits.maxEntryBytes) {
      throw new Error(`${entryPath}: archive entry exceeds size limit ${limits.maxEntryBytes}.`);
    }
    if (type === '5' && size !== 0) throw new Error(`${entryPath}: archive directory has nonzero size.`);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > archive.length) throw new Error(`${entryPath}: tar entry exceeds the archive boundary.`);
    const paddedEnd = dataStart + Math.ceil(size / 512) * 512;
    if (paddedEnd > archive.length) throw new Error(`${entryPath}: tar entry padding exceeds the archive boundary.`);
    if (!archive.subarray(dataEnd, paddedEnd).every((byte) => byte === 0)) {
      throw new Error(`${entryPath}: tar entry has nonzero padding bytes.`);
    }
    if (entryPath === 'package/package.json') {
      if (type !== '0') throw new Error('Tarball package.json must be a regular file.');
      if (size > limits.maxManifestBytes) {
        throw new Error(`Tarball package.json exceeds size limit ${limits.maxManifestBytes}.`);
      }
      manifestBytes = Buffer.from(archive.subarray(dataStart, dataEnd));
    }
    if (type === '0') {
      const fileBytes = archive.subarray(dataStart, dataEnd);
      files.push(
        Object.freeze({
          path: entryPath.slice('package/'.length),
          sha256: createHash('sha256').update(fileBytes).digest('hex'),
          size,
        }),
      );
    }
    offset = paddedEnd;
  }
  if (!sawEndMarker) throw new Error('Peer tarball has no complete end marker.');
  if (!manifestBytes) throw new Error('Peer tarball is missing package/package.json.');

  let manifest;
  try {
    manifest = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(manifestBytes));
  } catch (error) {
    throw new Error(`Peer tarball package.json is invalid: ${error instanceof Error ? error.message : error}.`);
  }
  if (manifest?.name !== expectedPackage.name) {
    throw new Error(
      `Tarball package name is ${JSON.stringify(manifest?.name)}; expected ${expectedPackage.name}.`,
    );
  }
  if (manifest?.version !== expectedPackage.version) {
    throw new Error(
      `Tarball package version is ${JSON.stringify(manifest?.version)}; expected ${expectedPackage.version}.`,
    );
  }
  const packagePeerDependencies = isRecord(manifest.peerDependencies)
    ? Object.freeze(Object.fromEntries(Object.entries(manifest.peerDependencies)))
    : undefined;
  const packagePeerDependenciesMeta = isRecord(manifest.peerDependenciesMeta)
    ? Object.freeze(
        Object.fromEntries(
          Object.entries(manifest.peerDependenciesMeta).map(([name, metadata]) => [
            name,
            isRecord(metadata) ? Object.freeze({ ...metadata }) : metadata,
          ]),
        ),
      )
    : undefined;
  files.sort(({ path: left }, { path: right }) => left.localeCompare(right));
  const frozenFiles = Object.freeze(files);
  return Object.freeze({
    contentSha256: contentDigest(frozenFiles),
    entries: entryCount,
    files: frozenFiles,
    integrity: `sha512-${createHash('sha512').update(bytes).digest('base64')}`,
    name: manifest.name,
    packagePeerDependencies,
    packagePeerDependenciesMeta,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size: bytes.length,
    version: manifest.version,
  });
}

function statIdentity(metadata) {
  return Object.freeze({
    ctimeNs: metadata.ctimeNs,
    dev: metadata.dev,
    ino: metadata.ino,
    mode: metadata.mode,
    mtimeNs: metadata.mtimeNs,
    nlink: metadata.nlink,
    size: metadata.size,
  });
}

function sameStatIdentity(left, right) {
  return Object.keys(left).every((key) => left[key] === right[key]);
}

async function readExactHandle(handle, size, label) {
  const length = Number(size);
  if (!Number.isSafeInteger(length) || length < 0 || length > DEFAULT_TARBALL_LIMITS.maxCompressedBytes) {
    throw new Error(`${label} has an unsafe compressed size.`);
  }
  const bytes = Buffer.allocUnsafe(length);
  let offset = 0;
  while (offset < length) {
    const { bytesRead } = await handle.read(bytes, offset, length - offset, offset);
    if (bytesRead === 0) throw new Error(`${label} changed or ended while being read.`);
    offset += bytesRead;
  }
  const extra = Buffer.allocUnsafe(1);
  const { bytesRead: extraBytes } = await handle.read(extra, 0, 1, length);
  if (extraBytes !== 0) throw new Error(`${label} changed or grew while being read.`);
  return bytes;
}

async function readBoundRegularFile(
  path,
  label,
  {
    lstatImpl = lstat,
    openImpl = open,
  } = {},
) {
  const pathMetadata = await lstatImpl(path, { bigint: true });
  if (!pathMetadata.isFile() || pathMetadata.isSymbolicLink()) {
    throw new Error(`${label} must be one regular file, not a symbolic link or special file.`);
  }
  const pathIdentity = statIdentity(pathMetadata);
  const noFollow = fsConstants.O_NOFOLLOW ?? 0;
  const handle = await openImpl(path, fsConstants.O_RDONLY | noFollow);
  let primaryError;
  try {
    const openedMetadata = await handle.stat({ bigint: true });
    const openedIdentity = statIdentity(openedMetadata);
    if (!openedMetadata.isFile() || !sameStatIdentity(pathIdentity, openedIdentity)) {
      throw new Error(`${label} changed identity or inode before its bytes could be bound.`);
    }
    const bytes = await readExactHandle(handle, openedMetadata.size, label);
    const afterIdentity = statIdentity(await handle.stat({ bigint: true }));
    if (!sameStatIdentity(openedIdentity, afterIdentity)) {
      throw new Error(`${label} changed identity while being read.`);
    }
    return { bytes, identity: openedIdentity };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await handle.close();
    } catch (cleanupError) {
      if (!primaryError) throw cleanupError;
      preserveCleanupFailure(primaryError, cleanupError);
    }
  }
}

export async function assertStagedTarballIntegrity(
  staged,
  dependencies = {},
) {
  if (!isRecord(staged) || !isAbsolute(staged.path) || !/^[a-f0-9]{64}$/u.test(staged.sha256)) {
    throw new Error('Invalid staged tarball identity.');
  }
  const bound = await readBoundRegularFile(staged.path, 'Staged tarball', dependencies);
  if (bound.bytes.length !== staged.size) throw new Error('Staged tarball SHA-256 mismatch: size changed.');
  const privateState = stagedTarballPrivate.get(staged);
  if (privateState?.stagedIdentity && !sameStatIdentity(privateState.stagedIdentity, bound.identity)) {
    throw new Error('Staged tarball changed identity or inode after validation.');
  }
  const bytes = bound.bytes;
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== staged.sha256) {
    throw new Error(`Staged tarball SHA-256 mismatch: expected ${staged.sha256}, found ${actual}.`);
  }
  return staged.path;
}

export async function stagePeerTarball(
  { sourcePath, workspace, expectedPackage },
  dependencies = {},
) {
  if (!isAbsolute(workspace)) throw new Error('Tarball staging workspace must be absolute.');
  const requestedPath = resolve(sourcePath);
  const sourceMetadata = await (dependencies.lstatImpl ?? lstat)(requestedPath, { bigint: true });
  if (!sourceMetadata.isFile() || sourceMetadata.isSymbolicLink() || !requestedPath.endsWith('.tgz')) {
    throw new Error(`Peer-compatibility tarball must be one regular .tgz file: ${requestedPath}.`);
  }
  if (sourceMetadata.size > BigInt(DEFAULT_TARBALL_LIMITS.maxCompressedBytes)) {
    throw new Error(`Peer tarball exceeds compressed size limit ${DEFAULT_TARBALL_LIMITS.maxCompressedBytes}.`);
  }
  const { bytes } = await readBoundRegularFile(requestedPath, 'Peer tarball', dependencies);
  const inspected = inspectPeerTarballArchive(bytes, { expectedPackage });
  const artifactDirectory = fixtureTarget(workspace, 'validated-packages');
  await mkdir(artifactDirectory, { recursive: true, mode: 0o700 });
  const stagedPath = fixtureTarget(
    artifactDirectory,
    `aceshooting-lyra-ui-${inspected.version}-${inspected.sha256.slice(0, 16)}.tgz`,
  );
  await writeFile(stagedPath, bytes, { flag: 'wx', mode: 0o400 });
  await chmod(stagedPath, 0o400);
  const staged = Object.freeze({
    contentSha256: inspected.contentSha256,
    files: inspected.files,
    integrity: inspected.integrity,
    name: inspected.name,
    packagePeerDependencies: inspected.packagePeerDependencies,
    packagePeerDependenciesMeta: inspected.packagePeerDependenciesMeta,
    path: stagedPath,
    sha256: inspected.sha256,
    size: inspected.size,
    version: inspected.version,
  });
  const stagedMetadata = await lstat(stagedPath, { bigint: true });
  stagedTarballPrivate.set(staged, {
    bytes: Buffer.from(bytes),
    stagedIdentity: statIdentity(stagedMetadata),
  });
  await assertStagedTarballIntegrity(staged);
  return staged;
}

async function closeHttpServer(server, sockets, timeoutMs = 2_000) {
  let timer;
  const closePromise = new Promise((resolveClose, rejectClose) => {
    server.close((error) => (error ? rejectClose(error) : resolveClose()));
  });
  try {
    await Promise.race([
      closePromise,
      new Promise((_, rejectTimeout) => {
        timer = setTimeout(
          () => rejectTimeout(new Error(`Peer tarball HTTP server did not close within ${timeoutMs} ms.`)),
          timeoutMs,
        );
      }),
    ]);
  } catch (error) {
    server.closeAllConnections?.();
    for (const socket of sockets) socket.destroy();
    await Promise.race([
      closePromise.catch(() => {}),
      new Promise((resolveWait) => setTimeout(resolveWait, 100)),
    ]);
    throw error;
  } finally {
    clearTimeout(timer);
    server.closeAllConnections?.();
    for (const socket of sockets) socket.destroy();
  }
}

export async function withPeerTarballServer(staged, operation) {
  if (typeof operation !== 'function') throw new TypeError('Peer tarball server operation is required.');
  const privateState = stagedTarballPrivate.get(staged);
  if (!privateState || staged.name !== '@aceshooting/lyra-ui') {
    throw new Error('Peer tarball server requires an internally validated staged tarball.');
  }
  const bytes = Buffer.from(privateState.bytes);
  const actualSha256 = createHash('sha256').update(bytes).digest('hex');
  if (actualSha256 !== staged.sha256 || bytes.length !== staged.size) {
    throw new Error('Peer tarball private byte identity no longer matches its staged authority.');
  }
  const routes = new Map();
  const sockets = new Set();
  const server = createServer((request, response) => {
    const route = [...routes.values()].find(({ path }) => request.url === path);
    if (!route) {
      response.writeHead(404, { connection: 'close', 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not found');
      return;
    }
    if (request.headers.range !== undefined) {
      response.writeHead(416, { connection: 'close', 'content-type': 'text/plain; charset=utf-8' });
      response.end('Ranges are not supported');
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, {
        allow: 'GET, HEAD',
        connection: 'close',
        'content-type': 'text/plain; charset=utf-8',
      });
      response.end('Method not allowed');
      return;
    }
    response.writeHead(200, {
      'cache-control': 'no-store',
      connection: 'close',
      'content-length': String(bytes.length),
      'content-type': 'application/gzip',
      digest: `sha-256=${Buffer.from(staged.sha256, 'hex').toString('base64')}`,
      etag: `"sha256-${staged.sha256}"`,
    });
    if (request.method === 'HEAD') {
      response.end();
      return;
    }
    response.once('finish', () => {
      route.completedGets += 1;
    });
    response.end(bytes);
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });

  await new Promise((resolveListen, rejectListen) => {
    const onError = (error) => {
      server.off('listening', onListening);
      rejectListen(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolveListen();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(0, '127.0.0.1');
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    await closeHttpServer(server, sockets);
    throw new Error('Peer tarball HTTP server did not expose a loopback TCP port.');
  }
  const transport = Object.freeze({
    assertConsumed(label) {
      const route = routes.get(label);
      if (!route || route.completedGets < 1) {
        throw new Error(`Peer tarball route ${JSON.stringify(label)} was not consumed by a completed GET.`);
      }
    },
    specifierFor(label) {
      if (typeof label !== 'string' || !/^[a-z0-9][a-z0-9./-]{0,127}$/u.test(label)) {
        throw new Error(`Unsafe peer tarball route label ${JSON.stringify(label)}.`);
      }
      let route = routes.get(label);
      if (!route) {
        route = {
          completedGets: 0,
          path: `/lyra-${randomUUID()}-${staged.sha256}.tgz`,
        };
        routes.set(label, route);
      }
      return `http://127.0.0.1:${address.port}${route.path}`;
    },
  });

  let primaryError;
  let result;
  try {
    result = await operation(transport);
  } catch (error) {
    primaryError = error;
  }
  try {
    await closeHttpServer(server, sockets);
  } catch (cleanupError) {
    if (!primaryError) throw cleanupError;
    preserveCleanupFailure(primaryError, cleanupError);
  }
  if (primaryError) throw primaryError;
  return result;
}

async function collectInstalledFiles(root, current = root, files = []) {
  const entries = await readdir(current, { withFileTypes: true });
  entries.sort(({ name: left }, { name: right }) => left.localeCompare(right));
  for (const entry of entries) {
    const target = join(current, entry.name);
    const metadata = await lstat(target, { bigint: true });
    if (metadata.isSymbolicLink()) {
      throw new Error(`Installed Lyra file inventory contains an internal symbolic link: ${target}.`);
    }
    if (metadata.isDirectory()) {
      // A published tarball never carries `node_modules`; one inside the installed root is the
      // package manager's own bookkeeping (pnpm's bin shims for the package and its peers).
      if (entry.name === 'node_modules') continue;
      await collectInstalledFiles(root, target, files);
      continue;
    }
    if (!metadata.isFile()) {
      throw new Error(`Installed Lyra file inventory contains a special file: ${target}.`);
    }
    const { bytes } = await readBoundRegularFile(target, 'Installed Lyra package file');
    files.push(
      Object.freeze({
        path: relative(root, target).replaceAll('\\', '/'),
        sha256: createHash('sha256').update(bytes).digest('hex'),
        size: bytes.length,
      }),
    );
  }
  return files;
}

/** Names the first differing entries so a remote failure is diagnosable from its log alone. */
function describeInventoryDrift(expectedFiles, actualFiles, limit = 12) {
  const expectedByPath = new Map(expectedFiles.map((file) => [file.path, file]));
  const actualByPath = new Map(actualFiles.map((file) => [file.path, file]));
  const lines = [];
  for (const [path, expected] of expectedByPath) {
    const actual = actualByPath.get(path);
    if (!actual) lines.push(`missing after install: ${path}`);
    else if (actual.sha256 !== expected.sha256 || actual.size !== expected.size) {
      lines.push(
        `content differs: ${path} (tarball ${expected.size} bytes ${expected.sha256.slice(0, 12)}, ` +
          `installed ${actual.size} bytes ${actual.sha256.slice(0, 12)})`,
      );
    }
  }
  for (const path of actualByPath.keys()) {
    if (!expectedByPath.has(path)) lines.push(`unexpected after install: ${path}`);
  }
  if (lines.length === 0) return ' (entries match; ordering differs)';
  const shown = lines.slice(0, limit).map((line) => `\n  - ${line}`).join('');
  const more = lines.length > limit ? `\n  ... ${lines.length - limit} more` : '';
  return ` ${lines.length} difference(s):${shown}${more}`;
}

export async function verifyInstalledPeerInstallation(installedRoot, staged) {
  if (!isAbsolute(installedRoot) || !Array.isArray(staged?.files)) {
    throw new Error('Installed peer verification requires an absolute root and staged file authority.');
  }
  const canonicalRoot = await realpath(installedRoot);
  const rootMetadata = await lstat(canonicalRoot);
  if (!rootMetadata.isDirectory()) throw new Error('Installed Lyra package root is not a directory.');
  const files = await collectInstalledFiles(canonicalRoot);
  files.sort(({ path: left }, { path: right }) => left.localeCompare(right));
  const expectedFiles = staged.files.map(({ path, sha256, size }) => ({ path, sha256, size }));
  const actualFiles = files.map(({ path, sha256, size }) => ({ path, sha256, size }));
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
    throw new Error(
      'Installed Lyra file inventory/content digest does not match the validated tarball.' +
        describeInventoryDrift(expectedFiles, actualFiles),
    );
  }
  const actualContentSha256 = contentDigest(files);
  if (actualContentSha256 !== staged.contentSha256) {
    throw new Error(
      `Installed Lyra content digest is ${actualContentSha256}; expected ${staged.contentSha256}.`,
    );
  }
  const manifest = JSON.parse(await readFile(join(canonicalRoot, 'package.json'), 'utf8'));
  if (manifest.name !== staged.name || manifest.version !== staged.version) {
    throw new Error(
      `Installed Lyra identity is ${JSON.stringify(manifest.name)}@${JSON.stringify(manifest.version)}; ` +
        `expected ${staged.name}@${staged.version}.`,
    );
  }
}

async function packLyraUi(destination) {
  await mkdir(destination, { recursive: true });
  const before = new Set((await readdir(destination)).filter((entry) => entry.endsWith('.tgz')));
  await runCommand(
    pnpmCommand,
    ['pack', '--pack-destination', destination],
    packageRoot,
    'Lyra UI peer-compatibility pack',
    { timeoutMs: COMMAND_TIMEOUTS.pack },
  );
  const created = (await readdir(destination)).filter(
    (entry) => entry.endsWith('.tgz') && !before.has(entry),
  );
  if (created.length !== 1) {
    throw new Error(
      `Peer-compatibility pack must create exactly one tarball; found ${created.join(', ') || 'none'}.`,
    );
  }
  return join(destination, created[0]);
}

async function verifyInstalledVersions(consumerRoot, versions) {
  for (const [name, expected] of Object.entries(versions)) {
    const manifestPath = join(consumerRoot, 'node_modules', ...name.split('/'), 'package.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (manifest.name !== name || manifest.version !== expected) {
      throw new Error(
        `Resolved ${name} as ${JSON.stringify(manifest.version)}; profile requires exact ${expected}.`,
      );
    }
  }
  const lyraManifest = JSON.parse(
    await readFile(join(consumerRoot, 'node_modules', '@aceshooting', 'lyra-ui', 'package.json'), 'utf8'),
  );
  if (lyraManifest.name !== '@aceshooting/lyra-ui') {
    throw new Error('Actual tarball did not install as @aceshooting/lyra-ui.');
  }
}

function isolatedPackageManagerEnvironment({
  baseEnvironment,
  packageManager,
  platform,
  profileId,
  workspace,
}) {
  const pathApi = platform === 'win32' ? pathWin32 : pathPosix;
  const isolationRoot = pathApi.join(workspace, 'package-manager', profileId, packageManager);
  const allowedNames = [
    'ALL_PROXY',
    'ComSpec',
    'HOME',
    'HTTPS_PROXY',
    'HTTP_PROXY',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'NODE_EXTRA_CA_CERTS',
    'NO_PROXY',
    'PATH',
    'PATHEXT',
    'PLAYWRIGHT_BROWSERS_PATH',
    'SSL_CERT_DIR',
    'SSL_CERT_FILE',
    'SystemRoot',
    'TZ',
    'USERPROFILE',
    'WINDIR',
    'XDG_CACHE_HOME',
    'all_proxy',
    'https_proxy',
    'http_proxy',
    'no_proxy',
  ];
  const env = {};
  const sourceEntries = Object.entries(baseEnvironment).filter(([, value]) => typeof value === 'string');
  const caseInsensitive = platform === 'win32';
  const seenAllowedNames = new Set();
  for (const canonicalName of allowedNames) {
    const normalizedAllowedName = caseInsensitive ? canonicalName.toLowerCase() : canonicalName;
    if (seenAllowedNames.has(normalizedAllowedName)) continue;
    seenAllowedNames.add(normalizedAllowedName);
    const matches = sourceEntries.filter(([name]) =>
      caseInsensitive ? name.toLowerCase() === canonicalName.toLowerCase() : name === canonicalName,
    );
    if (matches.length > 1) {
      throw new Error(`Ambiguous case-insensitive environment aliases for ${canonicalName}.`);
    }
    if (matches.length === 1) env[canonicalName] = matches[0][1];
  }
  for (const pathName of ['PLAYWRIGHT_BROWSERS_PATH', 'XDG_CACHE_HOME']) {
    if (
      env[pathName] !== undefined &&
      (!pathApi.isAbsolute(env[pathName]) || /[\u0000\r\n]/u.test(env[pathName]))
    ) {
      throw new Error(`${pathName} must be one safe absolute path when provided.`);
    }
  }
  const temporaryDirectory = pathApi.join(isolationRoot, 'tmp');
  const noProxy = [env.NO_PROXY, env.no_proxy, '127.0.0.1', 'localhost']
    .filter(Boolean)
    .join(',');
  const proxyBypass = caseInsensitive
    ? { NO_PROXY: noProxy }
    : { NO_PROXY: noProxy, no_proxy: noProxy };
  return {
    env: Object.freeze({
      ...env,
      CI: 'true',
      NPM_CONFIG_CACHE: pathApi.join(isolationRoot, 'cache'),
      NPM_CONFIG_GLOBALCONFIG: pathApi.join(isolationRoot, 'global.npmrc'),
      NPM_CONFIG_PREFIX: pathApi.join(isolationRoot, 'prefix'),
      NPM_CONFIG_USERCONFIG: pathApi.join(isolationRoot, 'user.npmrc'),
      ...proxyBypass,
      TEMP: temporaryDirectory,
      TMP: temporaryDirectory,
      TMPDIR: temporaryDirectory,
      XDG_CONFIG_HOME: pathApi.join(isolationRoot, 'xdg-config'),
      XDG_DATA_HOME: pathApi.join(isolationRoot, 'xdg-data'),
      XDG_STATE_HOME: pathApi.join(isolationRoot, 'xdg-state'),
      npm_config_audit: 'false',
      npm_config_auto_install_peers: 'false',
      npm_config_force: 'false',
      npm_config_fund: 'false',
      npm_config_ignore_scripts: 'true',
      npm_config_legacy_peer_deps: 'false',
      npm_config_strict_peer_dependencies: 'true',
      npm_config_strict_peer_deps: 'true',
      npm_config_update_notifier: 'false',
    }),
    isolationRoot,
    storeDirectory: pathApi.join(isolationRoot, 'pnpm-store'),
  };
}

export function createConsumerCommandPlan({
  authority,
  baseEnvironment = process.env,
  consumerRoot,
  packageManagerCommands = Object.freeze({ npm: npmCommand, pnpm: pnpmCommand }),
  packageManager,
  platform = process.platform,
  profileId,
  workspace,
}) {
  validateAuthorityShape(authority);
  if (packageManager !== 'pnpm' && packageManager !== 'npm') {
    throw new Error(`Consumer package manager must be pnpm or npm; found ${JSON.stringify(packageManager)}.`);
  }
  const pathApi = platform === 'win32' ? pathWin32 : pathPosix;
  if (!pathApi.isAbsolute(consumerRoot) || !pathApi.isAbsolute(workspace)) {
    throw new Error('Consumer command-plan paths must be absolute.');
  }
  if (!PROFILE_IDS.includes(profileId)) throw new Error(`Unknown peer profile ${JSON.stringify(profileId)}.`);
  const { env, isolationRoot, storeDirectory } = isolatedPackageManagerEnvironment({
    baseEnvironment,
    packageManager,
    platform,
    profileId,
    workspace,
  });
  const label = `${profileId}/${packageManager}`;
  const command = packageManagerCommands[packageManager];
  if (typeof command !== 'string' || command.length === 0) {
    throw new Error(`Consumer command plan has no ${packageManager} executable.`);
  }
  if (
    platform === 'win32' &&
    (!pathWin32.isAbsolute(command) || !/\.(?:cmd|bat)$/iu.test(command))
  ) {
    throw new Error(`Windows consumer command plan requires an absolute cmd shim for ${packageManager}.`);
  }
  const installArgs = packageManager === 'pnpm'
    ? [
        'install',
        '--ignore-scripts',
        '--strict-peer-dependencies',
        '--config.auto-install-peers=false',
        '--config.force=false',
        '--config.strict-peer-dependencies=true',
        '--store-dir',
        storeDirectory,
      ]
    : [
        'install',
        '--ignore-scripts',
        '--strict-peer-deps',
        '--legacy-peer-deps=false',
        '--force=false',
        '--no-audit',
        '--no-fund',
      ];
  // `pnpm list` reads the consumer's own node_modules and lockfile; install-only options such as
  // `--store-dir` are rejected as unknown by the list command.
  const listArgs = packageManager === 'pnpm'
    ? [
        'list',
        '--depth',
        '0',
        '--config.auto-install-peers=false',
        '--config.force=false',
      ]
    : ['ls', '--depth=0', '--strict-peer-deps', '--legacy-peer-deps=false', '--force=false'];
  const stage = (id, stageCommand, args, timeoutMs) => Object.freeze({
    args: Object.freeze(args),
    command: stageCommand,
    cwd: consumerRoot,
    env,
    id,
    isolationRoot,
    label: `${label} ${id}`,
    maxOutputBytes: DEFAULT_COMMAND_OUTPUT_BYTES,
    packageManager,
    timeoutMs,
  });
  return Object.freeze([
    stage('install', command, installArgs, COMMAND_TIMEOUTS.install),
    stage('dependency tree', command, listArgs, COMMAND_TIMEOUTS.list),
    stage(
      'TypeScript contract',
      pathApi.join(consumerRoot, 'node_modules', '.bin', binName('tsc', platform)),
      ['--noEmit', '--skipLibCheck', 'false', '-p', 'tsconfig.json'],
      COMMAND_TIMEOUTS.typescript,
    ),
    stage(
      'Vite production build',
      pathApi.join(consumerRoot, 'node_modules', '.bin', binName('vite', platform)),
      ['build', '--config', 'vite.config.mjs'],
      COMMAND_TIMEOUTS.build,
    ),
    stage('Node capability contract', process.execPath, ['src/node-contract.mjs'], COMMAND_TIMEOUTS.node),
    stage(
      'Chromium capability/security contract',
      process.execPath,
      ['scripts/run-browser.mjs'],
      COMMAND_TIMEOUTS.browser,
    ),
  ]);
}

async function materializePackageManagerIsolation(plan) {
  const install = plan.find(({ id }) => id === 'install');
  await mkdir(install.isolationRoot, { recursive: true, mode: 0o700 });
  await Promise.all([
    mkdir(install.env.NPM_CONFIG_CACHE, { recursive: true, mode: 0o700 }),
    mkdir(install.env.NPM_CONFIG_PREFIX, { recursive: true, mode: 0o700 }),
    mkdir(install.env.TMPDIR, { recursive: true, mode: 0o700 }),
    mkdir(install.env.XDG_CONFIG_HOME, { recursive: true, mode: 0o700 }),
    mkdir(install.env.XDG_DATA_HOME, { recursive: true, mode: 0o700 }),
    mkdir(install.env.XDG_STATE_HOME, { recursive: true, mode: 0o700 }),
    mkdir(join(install.isolationRoot, 'pnpm-store'), { recursive: true, mode: 0o700 }),
    writeFile(install.env.NPM_CONFIG_USERCONFIG, '', { flag: 'wx', mode: 0o600 }),
    writeFile(install.env.NPM_CONFIG_GLOBALCONFIG, '', { flag: 'wx', mode: 0o600 }),
  ]);
}

function requiredDirectEntry(entries, key, label) {
  const entry = entries.get(key);
  if (!entry) throw new Error(`${label} has no exact ${key} entry.`);
  return entry;
}

function expectedConsumerPnpmResolution(tarballUrl, profileVersions) {
  if (!isRecord(profileVersions)) throw new Error('Consumer pnpm profile versions must be an object.');
  const unknown = Object.keys(profileVersions).filter((name) => !MANAGED_PEER_NAMES.includes(name));
  if (unknown.length > 0) {
    throw new Error(`Consumer pnpm profile has unknown peer versions: ${unknown.join(', ')}.`);
  }
  return `${tarballUrl}${MANAGED_PEER_NAMES
    .filter((name) => Object.hasOwn(profileVersions, name))
    .map((name) => {
      const version = stableVersion(profileVersions[name], `consumer pnpm ${name} profile version`);
      return `(${name}@${expectedLockResolution(name, version, profileVersions)})`;
    })
    .join('')}`;
}

function consumerPnpmBlockScalarEntries(lines, field, boundary, indent, label) {
  assertCanonicalStructuralKey(field, field.key, label);
  if (field.value !== undefined) throw new Error(`${label} must be a block map.`);
  const fieldEnd = entryEnd(lines, field.index, boundary, field.indent);
  const entries = directSectionEntries(lines, field.index, fieldEnd, indent, `${label} entry`);
  for (const [name, entry] of entries) {
    assertCanonicalPnpmDataKey(entry, name, `${label} ${name}`);
    assertScalarLeaf(
      lines,
      entry,
      entryEnd(lines, entry.index, fieldEnd, entry.indent),
      `${label} ${name}`,
    );
    if (!entry.value) throw new Error(`${label} ${name} must be a nonempty scalar.`);
  }
  return { entries, fieldEnd };
}

function validateConsumerPnpmImporterDependency(
  lines,
  dependencyEntries,
  dependenciesEnd,
  name,
  expectedSpecifier,
  expectedVersion,
) {
  const label = `Consumer pnpm importer dependency ${name}`;
  const dependency = requiredDirectEntry(dependencyEntries, name, 'Consumer pnpm importer dependencies');
  assertCanonicalPnpmDataKey(dependency, name, label);
  if (dependency.value !== undefined) throw new Error(`${label} must be a block map.`);
  const dependencyEnd = entryEnd(
    lines,
    dependency.index,
    dependenciesEnd,
    dependency.indent,
  );
  const fields = directSectionEntries(
    lines,
    dependency.index,
    dependencyEnd,
    8,
    `${label} field`,
  );
  if (fields.size !== 2 || !fields.has('specifier') || !fields.has('version')) {
    throw new Error(`${label} must contain exactly specifier and version.`);
  }
  for (const [fieldName, expectedValue] of [
    ['specifier', expectedSpecifier],
    ['version', expectedVersion],
  ]) {
    const field = requiredDirectEntry(fields, fieldName, label);
    assertCanonicalStructuralKey(field, fieldName, label);
    assertScalarLeaf(
      lines,
      field,
      entryEnd(lines, field.index, dependencyEnd, field.indent),
      `${label} ${fieldName}`,
    );
    if (field.value !== expectedValue || field.rawValue !== expectedValue) {
      throw new Error(
        `${label} ${fieldName} is ${JSON.stringify(field.value)}; expected canonical ${expectedValue}.`,
      );
    }
  }
}

function validateConsumerPnpmPackageMetadata(
  lines,
  packageFields,
  packageEnd,
  authority,
  staged,
) {
  const allowedFields = new Set([
    'engines',
    'hasBin',
    'peerDependencies',
    'peerDependenciesMeta',
    'resolution',
    'version',
  ]);
  const unknown = [...packageFields.keys()].filter((name) => !allowedFields.has(name));
  if (unknown.length > 0) {
    throw new Error(`Consumer pnpm Lyra package has unexpected package field ${unknown.join(', ')}.`);
  }

  const engines = packageFields.get('engines');
  if (engines) {
    assertCanonicalStructuralKey(engines, 'engines', 'Consumer pnpm Lyra package');
    assertScalarLeaf(
      lines,
      engines,
      entryEnd(lines, engines.index, packageEnd, engines.indent),
      'Consumer pnpm Lyra package engines',
    );
    const engineFields = parseStrictFlowMap(engines.rawValue, 'Consumer pnpm Lyra package engines');
    if (
      engineFields.size !== 1 ||
      engineFields.get('node')?.rawKey !== 'node' ||
      !engineFields.get('node')?.value
    ) {
      throw new Error('Consumer pnpm Lyra package engines must contain exactly one nonempty node range.');
    }
  }

  const hasBin = packageFields.get('hasBin');
  if (hasBin) {
    assertCanonicalStructuralKey(hasBin, 'hasBin', 'Consumer pnpm Lyra package');
    assertScalarLeaf(
      lines,
      hasBin,
      entryEnd(lines, hasBin.index, packageEnd, hasBin.indent),
      'Consumer pnpm Lyra package hasBin',
    );
    if (hasBin.value !== 'true') throw new Error('Consumer pnpm Lyra package hasBin must be true.');
  }

  const peerDependencies = packageFields.get('peerDependencies');
  let peerEntries = new Map();
  if (peerDependencies) {
    assertCanonicalStructuralKey(peerDependencies, 'peerDependencies', 'Consumer pnpm Lyra package');
    ({ entries: peerEntries } = consumerPnpmBlockScalarEntries(
      lines,
      peerDependencies,
      packageEnd,
      6,
      'Consumer pnpm Lyra package peerDependencies',
    ));
  }

  const peerDependenciesMeta = packageFields.get('peerDependenciesMeta');
  let metaEntries = new Map();
  if (peerDependenciesMeta) {
    assertCanonicalStructuralKey(peerDependenciesMeta, 'peerDependenciesMeta', 'Consumer pnpm Lyra package');
    if (peerDependenciesMeta.value !== undefined) {
      throw new Error('Consumer pnpm Lyra package peerDependenciesMeta must be a block map.');
    }
    const metaEnd = entryEnd(lines, peerDependenciesMeta.index, packageEnd, peerDependenciesMeta.indent);
    metaEntries = directSectionEntries(
      lines,
      peerDependenciesMeta.index,
      metaEnd,
      6,
      'Consumer pnpm Lyra package peerDependenciesMeta entry',
    );
    for (const [name, meta] of metaEntries) {
      assertCanonicalPnpmDataKey(meta, name, `Consumer pnpm Lyra peer metadata ${name}`);
      if (meta.value !== undefined) {
        throw new Error(`Consumer pnpm Lyra peer metadata ${name} must be a block map.`);
      }
      const peerMetaEnd = entryEnd(lines, meta.index, metaEnd, meta.indent);
      const fields = directSectionEntries(
        lines,
        meta.index,
        peerMetaEnd,
        8,
        `Consumer pnpm Lyra peer metadata ${name} field`,
      );
      const optional = fields.get('optional');
      if (fields.size !== 1 || optional?.rawKey !== 'optional' || optional?.value !== 'true') {
        throw new Error(`Consumer pnpm Lyra peer metadata ${name} must contain exactly optional: true.`);
      }
      assertScalarLeaf(
        lines,
        optional,
        entryEnd(lines, optional.index, peerMetaEnd, optional.indent),
        `Consumer pnpm Lyra peer metadata ${name} optional`,
      );
    }
  }

  if (authority !== undefined) {
    if (!isRecord(authority?.managedPeerRanges)) {
      throw new Error('Consumer pnpm lock verification requires managed peer-range authority.');
    }
    for (const [name, expectedRange] of Object.entries(authority.managedPeerRanges)) {
      if (peerEntries.get(name)?.value !== expectedRange) {
        throw new Error(
          `Consumer pnpm Lyra package peerDependencies ${name} must be ${expectedRange}; found ${JSON.stringify(peerEntries.get(name)?.value)}.`,
        );
      }
      if (!metaEntries.has(name)) {
        throw new Error(`Consumer pnpm Lyra package peerDependenciesMeta is missing optional ${name}.`);
      }
    }
  }

  if (isRecord(staged?.packagePeerDependencies)) {
    const expectedNames = Object.keys(staged.packagePeerDependencies);
    if (peerEntries.size !== expectedNames.length) {
      throw new Error('Consumer pnpm Lyra package peerDependencies do not match the packed manifest.');
    }
    for (const name of expectedNames) {
      if (peerEntries.get(name)?.value !== staged.packagePeerDependencies[name]) {
        throw new Error(
          `Consumer pnpm Lyra package peerDependencies ${name} drifted from the packed manifest.`,
        );
      }
    }
  }
  if (isRecord(staged?.packagePeerDependenciesMeta)) {
    const expectedNames = Object.keys(staged.packagePeerDependenciesMeta);
    if (metaEntries.size !== expectedNames.length) {
      throw new Error('Consumer pnpm Lyra package peerDependenciesMeta do not match the packed manifest.');
    }
    for (const name of expectedNames) {
      const expectedMetadata = staged.packagePeerDependenciesMeta[name];
      if (!isRecord(expectedMetadata) || expectedMetadata.optional !== true) {
        throw new Error(`Packed Lyra peer metadata ${name} is not the reviewed optional shape.`);
      }
      if (!metaEntries.has(name)) {
        throw new Error(`Consumer pnpm Lyra package peer metadata ${name} is missing.`);
      }
    }
  }
}

export function verifyPnpmConsumerTarballLock(
  lockfileText,
  tarballUrl,
  staged,
  { authority, profile } = {},
) {
  const profileVersions = profile?.versions ?? {};
  const expectedResolution = expectedConsumerPnpmResolution(tarballUrl, profileVersions);
  const lines = lockfileLines(lockfileText);
  const topLevel = topLevelLockEntries(lines);
  const lockfileVersion = topLevel.get('lockfileVersion');
  if (lockfileVersion?.value !== '9.0' || lockfileVersion.rawValue !== "'9.0'") {
    throw new Error('Consumer pnpm lockfile must use lockfileVersion 9.0.');
  }
  assertCanonicalStructuralKey(lockfileVersion, 'lockfileVersion', 'Consumer pnpm lockfile');
  assertScalarLeaf(
    lines,
    lockfileVersion,
    entryEnd(lines, lockfileVersion.index, lines.length, lockfileVersion.indent),
    'Consumer pnpm lockfileVersion',
  );
  const importers = requiredDirectEntry(topLevel, 'importers', 'Consumer pnpm lockfile');
  assertCanonicalStructuralKey(importers, 'importers', 'Consumer pnpm lockfile');
  if (importers.value !== undefined) throw new Error('Consumer pnpm importers must be a block map.');
  const importersEnd = sectionEnd(lines, importers.index);
  const importerEntries = directSectionEntries(lines, importers.index, importersEnd, 2, 'consumer importer');
  const importer = requiredDirectEntry(importerEntries, '.', 'Consumer pnpm lockfile importers');
  assertCanonicalPnpmDataKey(importer, '.', 'Consumer pnpm importer');
  if (importer.value !== undefined) throw new Error('Consumer pnpm importer must be a block map.');
  const importerEnd = entryEnd(lines, importer.index, importersEnd, importer.indent);
  assertNoSequenceNodes(lines, importer.index, importerEnd, 'Consumer pnpm importer');
  const importerFields = directSectionEntries(lines, importer.index, importerEnd, 4, 'consumer importer field');
  const dependencies = requiredDirectEntry(importerFields, 'dependencies', 'Consumer pnpm importer');
  assertCanonicalStructuralKey(dependencies, 'dependencies', 'Consumer pnpm importer');
  if (dependencies.value !== undefined) throw new Error('Consumer pnpm dependencies must be a block map.');
  const dependenciesEnd = entryEnd(lines, dependencies.index, importerEnd, dependencies.indent);
  const dependencyEntries = directSectionEntries(
    lines,
    dependencies.index,
    dependenciesEnd,
    6,
    'consumer dependency',
  );
  const lyra = requiredDirectEntry(
    dependencyEntries,
    '@aceshooting/lyra-ui',
    'Consumer pnpm importer dependencies',
  );
  assertCanonicalPnpmDataKey(lyra, '@aceshooting/lyra-ui', 'Consumer pnpm Lyra dependency');
  if (lyra.value !== undefined) throw new Error('Consumer pnpm Lyra dependency must be a block map.');
  const lyraEnd = entryEnd(lines, lyra.index, dependenciesEnd, lyra.indent);
  const lyraFields = directSectionEntries(lines, lyra.index, lyraEnd, 8, 'consumer Lyra dependency field');
  if (
    lyraFields.size !== 2 ||
    !lyraFields.has('specifier') ||
    !lyraFields.has('version')
  ) {
    throw new Error('Consumer pnpm Lyra dependency must contain exactly specifier and version.');
  }
  for (const fieldName of ['specifier', 'version']) {
    const field = requiredDirectEntry(lyraFields, fieldName, 'Consumer pnpm Lyra dependency');
    assertCanonicalStructuralKey(field, fieldName, 'Consumer pnpm Lyra dependency');
    assertScalarLeaf(
      lines,
      field,
      entryEnd(lines, field.index, lyraEnd, field.indent),
      `Consumer pnpm Lyra ${fieldName}`,
    );
    const expectedValue = fieldName === 'specifier' ? tarballUrl : expectedResolution;
    if (field.value !== expectedValue || field.rawValue !== expectedValue) {
      throw new Error(`Consumer pnpm Lyra ${fieldName} is ${JSON.stringify(field.value)}; expected ${expectedValue}.`);
    }
  }

  const packageKey = `@aceshooting/lyra-ui@${tarballUrl}`;
  const packages = requiredDirectEntry(topLevel, 'packages', 'Consumer pnpm lockfile');
  assertCanonicalStructuralKey(packages, 'packages', 'Consumer pnpm lockfile');
  if (packages.value !== undefined) throw new Error('Consumer pnpm packages must be a block map.');
  const packagesEnd = sectionEnd(lines, packages.index);
  const packageEntries = directSectionEntries(lines, packages.index, packagesEnd, 2, 'consumer package');
  const packageEntry = requiredDirectEntry(packageEntries, packageKey, 'Consumer pnpm packages');
  assertCanonicalPnpmDataKey(packageEntry, packageKey, 'Consumer pnpm Lyra package');
  if (packageEntry.value !== undefined) throw new Error('Consumer pnpm Lyra package must be a block map.');
  const packageEnd = entryEnd(lines, packageEntry.index, packagesEnd, packageEntry.indent);
  assertNoSequenceNodes(lines, packageEntry.index, packageEnd, 'Consumer pnpm Lyra package');
  const packageFields = directSectionEntries(lines, packageEntry.index, packageEnd, 4, 'consumer package field');
  if (!packageFields.has('resolution') || !packageFields.has('version')) {
    throw new Error('Consumer pnpm Lyra package must contain direct resolution and version fields.');
  }
  validateConsumerPnpmPackageMetadata(lines, packageFields, packageEnd, authority, staged);
  const packageVersion = requiredDirectEntry(packageFields, 'version', 'Consumer pnpm Lyra package');
  assertCanonicalStructuralKey(packageVersion, 'version', 'Consumer pnpm Lyra package');
  assertScalarLeaf(
    lines,
    packageVersion,
    entryEnd(lines, packageVersion.index, packageEnd, packageVersion.indent),
    'Consumer pnpm Lyra package version',
  );
  if (packageVersion.value !== staged.version) {
    throw new Error('Consumer pnpm Lyra package version does not match the staged tarball.');
  }
  const resolution = requiredDirectEntry(packageFields, 'resolution', 'Consumer pnpm Lyra package');
  assertCanonicalStructuralKey(resolution, 'resolution', 'Consumer pnpm Lyra package');
  assertScalarLeaf(
    lines,
    resolution,
    entryEnd(lines, resolution.index, packageEnd, resolution.indent),
    'Consumer pnpm Lyra package resolution',
  );
  const resolutionFields = parseStrictFlowMap(
    resolution.rawValue,
    'Consumer pnpm Lyra package resolution',
  );
  if (
    resolutionFields.size !== 2 ||
    resolutionFields.get('integrity')?.rawKey !== 'integrity' ||
    resolutionFields.get('integrity')?.rawScalar !== resolutionFields.get('integrity')?.value ||
    resolutionFields.get('integrity')?.value !== staged.integrity ||
    resolutionFields.get('tarball')?.rawKey !== 'tarball' ||
    resolutionFields.get('tarball')?.rawScalar !== resolutionFields.get('tarball')?.value ||
    resolutionFields.get('tarball')?.value !== tarballUrl
  ) {
    throw new Error('Consumer pnpm Lyra resolution does not bind the exact tarball URL and SHA-512 integrity.');
  }

  const snapshots = requiredDirectEntry(topLevel, 'snapshots', 'Consumer pnpm lockfile');
  assertCanonicalStructuralKey(snapshots, 'snapshots', 'Consumer pnpm lockfile');
  if (snapshots.value !== undefined) throw new Error('Consumer pnpm snapshots must be a block map.');
  const snapshotsEnd = sectionEnd(lines, snapshots.index);
  const snapshotEntries = directSectionEntries(lines, snapshots.index, snapshotsEnd, 2, 'consumer snapshot');
  const snapshotKey = `@aceshooting/lyra-ui@${expectedResolution}`;
  const snapshot = requiredDirectEntry(snapshotEntries, snapshotKey, 'Consumer pnpm snapshots');
  assertCanonicalPnpmDataKey(snapshot, snapshotKey, 'Consumer pnpm Lyra snapshot');
  if (snapshot.value !== undefined && snapshot.rawValue !== '{}') {
    throw new Error('Consumer pnpm Lyra snapshot must be a block map or one empty inline map.');
  }
  if (snapshot.value === undefined) {
    const snapshotEnd = entryEnd(lines, snapshot.index, snapshotsEnd, snapshot.indent);
    assertNoSequenceNodes(lines, snapshot.index, snapshotEnd, 'Consumer pnpm Lyra snapshot');
    const snapshotFields = directSectionEntries(
      lines,
      snapshot.index,
      snapshotEnd,
      4,
      'Consumer pnpm Lyra snapshot field',
    );
    const unknownSnapshotFields = [...snapshotFields.keys()].filter(
      (name) => name !== 'dependencies' && name !== 'optionalDependencies',
    );
    if (unknownSnapshotFields.length > 0) {
      throw new Error(
        `Consumer pnpm Lyra snapshot has unexpected field ${unknownSnapshotFields.join(', ')}.`,
      );
    }
    const optionalDependencies = snapshotFields.get('optionalDependencies');
    if (Object.keys(profileVersions).length > 0 && !optionalDependencies) {
      throw new Error('Consumer pnpm Lyra snapshot has no exact optionalDependencies profile map.');
    }
    if (optionalDependencies) {
      assertCanonicalStructuralKey(
        optionalDependencies,
        'optionalDependencies',
        'Consumer pnpm Lyra snapshot',
      );
      const { entries: optionalEntries } = consumerPnpmBlockScalarEntries(
        lines,
        optionalDependencies,
        snapshotEnd,
        6,
        'Consumer pnpm Lyra snapshot optionalDependencies',
      );
      const expectedNames = MANAGED_PEER_NAMES.filter((name) =>
        Object.hasOwn(profileVersions, name));
      if (optionalEntries.size !== expectedNames.length) {
        throw new Error('Consumer pnpm Lyra snapshot optionalDependencies do not exactly match the profile.');
      }
      for (const name of expectedNames) {
        const expectedPeerResolution = expectedLockResolution(name, profileVersions[name], profileVersions);
        if (
          optionalEntries.get(name)?.value !== expectedPeerResolution ||
          optionalEntries.get(name)?.rawValue !== expectedPeerResolution
        ) {
          throw new Error(
            `Consumer pnpm Lyra snapshot optional dependency ${name} must be ${expectedPeerResolution}.`,
          );
        }
      }
    }
  }

  if (profile !== undefined) {
    const profileNames = Object.keys(profileVersions).sort();
    const expectedProfileNames = [...MANAGED_PEER_NAMES].sort();
    if (JSON.stringify(profileNames) !== JSON.stringify(expectedProfileNames)) {
      throw new Error(
        `Consumer pnpm profile peer set must contain exactly ${expectedProfileNames.join(', ')}.`,
      );
    }
    const actualDependencyNames = [...dependencyEntries.keys()].sort();
    const expectedDependencyNames = ['@aceshooting/lyra-ui', ...MANAGED_PEER_NAMES].sort();
    if (JSON.stringify(actualDependencyNames) !== JSON.stringify(expectedDependencyNames)) {
      throw new Error(
        'Consumer pnpm importer dependencies must contain exactly Lyra and the ten authority peers.',
      );
    }
    const consumerLockState = {
      lines,
      packageEntries,
      packagesEnd,
      snapshotEntries,
      snapshotsEnd,
      snapshots: new Set(snapshotEntries.keys()),
    };
    for (const name of MANAGED_PEER_NAMES) {
      const version = stableVersion(
        profileVersions[name],
        `consumer pnpm profile version for ${name}`,
      );
      const peerResolution = expectedLockResolution(name, version, profileVersions);
      validateConsumerPnpmImporterDependency(
        lines,
        dependencyEntries,
        dependenciesEnd,
        name,
        version,
        peerResolution,
      );
      validateLockReference(
        consumerLockState,
        name,
        version,
        peerResolution,
        `Consumer pnpm profile peer ${name}`,
      );
    }
  }
}

function parseJsonRejectingDuplicateKeys(source, label) {
  let index = 0;
  const skipWhitespace = () => {
    while (/\s/u.test(source[index] ?? '')) index += 1;
  };
  const parseString = () => {
    if (source[index] !== '"') throw new Error(`${label} has invalid JSON at byte ${index}.`);
    const start = index;
    index += 1;
    while (index < source.length) {
      const character = source[index];
      if (character === '\\') {
        index += 2;
        continue;
      }
      if (character === '"') {
        index += 1;
        try {
          return JSON.parse(source.slice(start, index));
        } catch {
          throw new Error(`${label} has an invalid JSON string at byte ${start}.`);
        }
      }
      if (character.charCodeAt(0) < 0x20) {
        throw new Error(`${label} has an invalid control byte in a JSON string.`);
      }
      index += 1;
    }
    throw new Error(`${label} has an unterminated JSON string.`);
  };
  const parseValue = (depth) => {
    if (depth > 128) throw new Error(`${label} exceeds the maximum JSON nesting depth.`);
    skipWhitespace();
    if (source[index] === '{') {
      index += 1;
      skipWhitespace();
      const keys = new Set();
      if (source[index] === '}') {
        index += 1;
        return;
      }
      while (index < source.length) {
        const key = parseString();
        if (keys.has(key)) throw new Error(`${label} has duplicate JSON object key ${JSON.stringify(key)}.`);
        keys.add(key);
        skipWhitespace();
        if (source[index] !== ':') throw new Error(`${label} has a JSON object key without a value.`);
        index += 1;
        parseValue(depth + 1);
        skipWhitespace();
        if (source[index] === '}') {
          index += 1;
          return;
        }
        if (source[index] !== ',') throw new Error(`${label} has an invalid JSON object separator.`);
        index += 1;
        skipWhitespace();
      }
      throw new Error(`${label} has an unterminated JSON object.`);
    }
    if (source[index] === '[') {
      index += 1;
      skipWhitespace();
      if (source[index] === ']') {
        index += 1;
        return;
      }
      while (index < source.length) {
        parseValue(depth + 1);
        skipWhitespace();
        if (source[index] === ']') {
          index += 1;
          return;
        }
        if (source[index] !== ',') throw new Error(`${label} has an invalid JSON array separator.`);
        index += 1;
      }
      throw new Error(`${label} has an unterminated JSON array.`);
    }
    if (source[index] === '"') {
      parseString();
      return;
    }
    for (const literal of ['true', 'false', 'null']) {
      if (source.startsWith(literal, index)) {
        index += literal.length;
        return;
      }
    }
    const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(source.slice(index));
    if (!number) throw new Error(`${label} has an invalid JSON value at byte ${index}.`);
    index += number[0].length;
  };
  parseValue(0);
  skipWhitespace();
  if (index !== source.length) throw new Error(`${label} has trailing data after its JSON value.`);
  return JSON.parse(source);
}

function canonicalNpmRegistryTarballUrl(name, version) {
  const packageBasename = name.slice(name.lastIndexOf('/') + 1);
  return `https://registry.npmjs.org/${name}/-/${packageBasename}-${version}.tgz`;
}

function assertExactObjectKeys(value, expectedKeys, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label} must contain exactly ${expected.join(', ')}; found ${actual.join(', ') || 'none'}.`,
    );
  }
}

function validateNpmProfilePeerPackage(lockPackages, name, version) {
  const packagePath = `node_modules/${name}`;
  const installed = lockPackages?.[packagePath];
  if (!isRecord(installed)) {
    throw new Error(`Consumer npm lock has no exact installed package entry for ${name}@${version}.`);
  }
  if (installed.name !== undefined && installed.name !== name) {
    throw new Error(`Consumer npm lock package ${name} has mismatched name ${JSON.stringify(installed.name)}.`);
  }
  const expectedResolved = canonicalNpmRegistryTarballUrl(name, version);
  if (installed.version !== version || installed.resolved !== expectedResolved) {
    throw new Error(
      `Consumer npm lock package ${name} must bind version ${version} to ${expectedResolved}.`,
    );
  }
  validateCanonicalSha512Integrity(
    installed.integrity,
    `Consumer npm lock package ${name}@${version}`,
  );
  const expectedChartPeer = reviewedChartPackagePeerRange(name, version);
  if (expectedChartPeer !== undefined) {
    assertExactObjectKeys(
      installed.peerDependencies,
      ['chart.js'],
      `Consumer npm lock package ${name} peerDependencies`,
    );
    if (installed.peerDependencies['chart.js'] !== expectedChartPeer) {
      throw new Error(
        `Consumer npm lock package ${name} chart.js peer range must be ${expectedChartPeer}.`,
      );
    }
  }
}

export async function verifyConsumerTarballLock(
  consumerRoot,
  packageManager,
  tarballUrl,
  staged,
  { authority, profile } = {},
) {
  if (packageManager === 'npm') {
    const lockSource = await readFile(join(consumerRoot, 'package-lock.json'), 'utf8');
    const lock = parseJsonRejectingDuplicateKeys(lockSource, 'Consumer npm package-lock');
    const root = lock?.packages?.[''];
    const installed = lock?.packages?.['node_modules/@aceshooting/lyra-ui'];
    if (
      lock?.lockfileVersion !== 3 ||
      root?.dependencies?.['@aceshooting/lyra-ui'] !== tarballUrl ||
      installed?.name !== undefined && installed.name !== '@aceshooting/lyra-ui' ||
      installed?.version !== staged.version ||
      installed?.resolved !== tarballUrl ||
      installed?.integrity !== undefined && installed.integrity !== staged.integrity
    ) {
      throw new Error(
        'Consumer npm lock does not bind the exact Lyra tarball URL/version and any recorded SHA-512 integrity.',
      );
    }
    if (isRecord(staged.packagePeerDependencies)) {
      exactRecordEntries(
        'Consumer npm Lyra peerDependencies from packed manifest',
        installed.peerDependencies,
        staged.packagePeerDependencies,
      );
    }
    if (isRecord(staged.packagePeerDependenciesMeta)) {
      assertExactObjectKeys(
        installed.peerDependenciesMeta,
        Object.keys(staged.packagePeerDependenciesMeta),
        'Consumer npm Lyra peerDependenciesMeta from packed manifest',
      );
      for (const [name, expectedMetadata] of Object.entries(staged.packagePeerDependenciesMeta)) {
        if (
          !isRecord(expectedMetadata) ||
          JSON.stringify(installed.peerDependenciesMeta[name]) !== JSON.stringify(expectedMetadata)
        ) {
          throw new Error(
            `Consumer npm Lyra peerDependenciesMeta ${name} drifted from the packed manifest.`,
          );
        }
      }
    }
    if (authority !== undefined) {
      if (!isRecord(installed.peerDependencies) || !isRecord(installed.peerDependenciesMeta)) {
        throw new Error('Consumer npm Lyra package has no peer dependency metadata.');
      }
      for (const name of MANAGED_PEER_NAMES) {
        const expectedRange = authority.managedPeerRanges?.[name];
        if (installed.peerDependencies[name] !== expectedRange) {
          throw new Error(
            `Consumer npm Lyra peerDependencies ${name} must be ${expectedRange}.`,
          );
        }
        if (installed.peerDependenciesMeta[name]?.optional !== true) {
          throw new Error(`Consumer npm Lyra peerDependenciesMeta ${name} must be optional.`);
        }
      }
    }
    if (profile !== undefined) {
      const profileVersions = profile.versions ?? {};
      assertExactObjectKeys(
        profileVersions,
        MANAGED_PEER_NAMES,
        'Consumer npm profile versions',
      );
      assertExactObjectKeys(
        root.dependencies,
        ['@aceshooting/lyra-ui', ...MANAGED_PEER_NAMES],
        'Consumer npm root dependencies',
      );
      for (const name of MANAGED_PEER_NAMES) {
        const expectedVersion = stableVersion(
          profileVersions[name],
          `consumer npm profile version for ${name}`,
        );
        if (root.dependencies[name] !== expectedVersion) {
          throw new Error(`Consumer npm lock does not bind profile peer ${name} to ${expectedVersion}.`);
        }
        validateNpmProfilePeerPackage(lock.packages, name, expectedVersion);
      }
    }
    return;
  }
  if (packageManager !== 'pnpm') throw new Error(`Unknown consumer package manager ${packageManager}.`);
  verifyPnpmConsumerTarballLock(
    await readFile(join(consumerRoot, 'pnpm-lock.yaml'), 'utf8'),
    tarballUrl,
    staged,
    { authority, profile },
  );
}

async function runConsumer({ authority, packageManager, profile, stagedTarball, transport, workspace }) {
  const consumerRoot = join(workspace, 'consumers', profile.id, packageManager);
  const label = `${profile.id}/${packageManager}`;
  const tarballUrl = transport.specifierFor(label);
  const files = createConsumerFileMap({
    authority,
    packageManager,
    profile,
    tarballSpecifier: tarballUrl,
  });
  await writeConsumerFiles(consumerRoot, files);
  const plan = createConsumerCommandPlan({
    authority,
    consumerRoot,
    packageManager,
    profileId: profile.id,
    workspace,
  });
  await materializePackageManagerIsolation(plan);
  for (const stage of plan) {
    await runBoundedCommand(stage);
    if (stage.id === 'install') {
      transport.assertConsumed(label);
      await verifyConsumerTarballLock(
        consumerRoot,
        packageManager,
        tarballUrl,
        stagedTarball,
        { authority, profile },
      );
      await verifyInstalledPeerInstallation(
        join(consumerRoot, 'node_modules', '@aceshooting', 'lyra-ui'),
        stagedTarball,
      );
    } else if (stage.id === 'dependency tree') {
      await verifyInstalledVersions(consumerRoot, profile.versions);
    }
  }
  console.log(`Peer compatibility profile passed: ${label}.`);
}

export async function assertExecutionToolchain({
  actualNodeVersion = process.versions.node,
  authority,
  captureVersion = (command, label) =>
    captureCommand(command, ['--version'], repositoryRoot, label, {
      timeoutMs: COMMAND_TIMEOUTS.toolchain,
    }),
  nvmrcText,
  rootManifest,
}) {
  validateAuthorityShape(authority);
  const source = nvmrcText ?? await readFile(join(repositoryRoot, '.nvmrc'), 'utf8');
  const nvmrc = parseNvmrcVersion(source);
  stableVersion(nvmrc, '.nvmrc Node authority');
  if (actualNodeVersion !== nvmrc) {
    throw new Error(
      `Peer compatibility must run with exact .nvmrc Node ${nvmrc}; active Node is ${actualNodeVersion}.`,
    );
  }
  const expectedPnpm = authority.packageManagers.pnpm;
  if (rootManifest?.packageManager !== `pnpm@${expectedPnpm}`) {
    throw new Error(
      `Root packageManager must match authority pnpm@${expectedPnpm}; found ${JSON.stringify(rootManifest?.packageManager)}.`,
    );
  }
  const [actualPnpm, actualNpm] = await Promise.all([
    captureVersion(pnpmCommand, 'pnpm version check'),
    captureVersion(npmCommand, 'npm version check'),
  ]);
  if (actualPnpm !== expectedPnpm) {
    throw new Error(`Peer compatibility requires pnpm ${expectedPnpm}; active pnpm is ${actualPnpm}.`);
  }
  const expectedNpm = authority.packageManagers.npm;
  if (actualNpm !== expectedNpm) {
    throw new Error(`Peer compatibility requires npm ${expectedNpm}; active npm is ${actualNpm}.`);
  }
}

async function runAllProfiles({ authority, packageManifest, profiles, tarball: suppliedTarball }) {
  await withTemporaryPeerWorkspace(async (workspace) => {
    const sourceTarball = suppliedTarball
      ? resolve(suppliedTarball)
      : await packLyraUi(join(workspace, 'packages'));
    const stagedTarball = await stagePeerTarball({
      expectedPackage: {
        name: packageManifest.name,
        version: packageManifest.version,
      },
      sourcePath: sourceTarball,
      workspace,
    });
    await withPeerTarballServer(stagedTarball, async (transport) => {
      for (const profile of profiles) {
        for (const packageManager of ['pnpm', 'npm']) {
          await runConsumer({
            authority,
            packageManager,
            profile,
            stagedTarball,
            transport,
            workspace,
          });
        }
      }
    });
    console.log('All four peer-compatibility profiles passed through strict pnpm and npm consumers.');
  });
}

export function parsePeerCompatibilityArguments(args) {
  const parsed = { mode: 'run', tarball: undefined, beforeManifest: undefined };
  const seen = new Set();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (seen.has(argument)) throw new Error(`Peer-compatibility argument ${argument} may appear only once.`);
    seen.add(argument);
    if (argument === '--tarball') {
      const value = args[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--tarball requires one path.');
      parsed.tarball = value;
      index += 1;
      continue;
    }
    if (argument === '--check-authority') {
      if (parsed.mode !== 'run') throw new Error('Peer-compatibility modes are mutually exclusive.');
      parsed.mode = 'check';
      continue;
    }
    if (argument === '--write-current-versions') {
      if (parsed.mode !== 'run') throw new Error('Peer-compatibility modes are mutually exclusive.');
      parsed.mode = 'write-current';
      continue;
    }
    if (argument === '--check-managed-peer-rewrites') {
      if (parsed.mode !== 'run') throw new Error('Peer-compatibility modes are mutually exclusive.');
      const value = args[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--check-managed-peer-rewrites requires the before-upgrade package.json path.');
      }
      parsed.mode = 'check-rewrites';
      parsed.beforeManifest = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown peer-compatibility argument ${argument}.`);
  }
  if (parsed.tarball && parsed.mode !== 'run') {
    throw new Error('--tarball is valid only for an actual profile run.');
  }
  return parsed;
}

async function readRepositoryDocuments() {
  const [authorityText, packageManifestText, lockfileText, rootManifestText] = await Promise.all([
    readFile(authorityPath, 'utf8'),
    readFile(packageManifestPath, 'utf8'),
    readFile(lockfilePath, 'utf8'),
    readFile(join(repositoryRoot, 'package.json'), 'utf8'),
  ]);
  return {
    authority: JSON.parse(authorityText),
    authorityText,
    lockfileText,
    packageManifest: JSON.parse(packageManifestText),
    rootManifest: JSON.parse(rootManifestText),
  };
}

async function main() {
  const options = parsePeerCompatibilityArguments(process.argv.slice(2));
  const documents = await readRepositoryDocuments();
  if (options.mode === 'check-rewrites') {
    const beforeManifest = JSON.parse(await readFile(resolve(options.beforeManifest), 'utf8'));
    assertNoManagedPeerRangeRewrites({
      authority: documents.authority,
      beforeManifest,
      afterManifest: documents.packageManifest,
    });
    console.log('Authority-managed peer ranges were not rewritten; dev-pin changes are permitted.');
    return;
  }
  if (options.mode === 'write-current') {
    await writeSynchronizedAuthority({
      authority: documents.authority,
      authorityPath,
      authorityText: documents.authorityText,
      lockfileText: documents.lockfileText,
      packageManifest: documents.packageManifest,
    });
    console.log('Peer-compatibility current versions now match dev-range bases and lock resolutions.');
    return;
  }

  const validated = validatePeerCompatibilityDocuments(documents);
  if (options.mode === 'check') {
    console.log('Peer-compatibility authority matches package metadata and the current lock.');
    return;
  }
  await assertExecutionToolchain({
    authority: documents.authority,
    rootManifest: documents.rootManifest,
  });
  await runAllProfiles({
    authority: validated.authority,
    packageManifest: validated.packageManifest,
    profiles: validated.profiles,
    tarball: options.tarball,
  });
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
