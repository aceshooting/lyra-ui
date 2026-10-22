// Checksum-pinned release binaries for the repository checks that are not npm packages
// (zizmor, typos, lychee, shellcheck). `pinnedToolPath()` returns an executable whose version
// matches its pin: an installed copy when `<tool> --version` reports the pinned version, otherwise
// the pinned release archive, downloaded once into a per-user cache, verified against its SHA-256
// and unpacked. Nothing from the archive runs before the checksum matches.
//
// To bump a tool: change its version, URL and SHA-256 together. GitHub shows the SHA-256 of every
// release asset; `sha256sum` of the downloaded archive must agree with it. Only the Linux x86_64
// build is pinned (CI and the contributor workstation); on another platform install the pinned
// version yourself, as scripts/check-workflows.sh requires for actionlint.

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';

/** tool -> { version, url, sha256 (of the archive), member (path of the executable inside it) }. */
export const PINNED_TOOLS = Object.freeze({
  // GitHub Actions security audit: `pnpm check:workflow-security`.
  zizmor: {
    version: '1.31.1',
    url: 'https://github.com/zizmorcore/zizmor/releases/download/v1.31.1/zizmor-x86_64-unknown-linux-gnu.tar.gz',
    sha256: 'd185f726bdaf92df78273217dfdd24ebcd6b0ef48cf3ce776ff5762b6e138c99',
    member: 'zizmor',
  },
  // Source spell checker: `pnpm check:spelling`.
  typos: {
    version: '1.51.1',
    url: 'https://github.com/crate-ci/typos/releases/download/v1.51.1/typos-v1.51.1-x86_64-unknown-linux-musl.tar.gz',
    sha256: '93c301fd4120ff076e2cc2a6d6a61cab4a4bdb81899287c0938b452e56d1f454',
    member: 'typos',
  },
  // Markdown link checker: `pnpm check:links`.
  lychee: {
    version: '0.24.2',
    url: 'https://github.com/lycheeverse/lychee/releases/download/lychee-v0.24.2/lychee-x86_64-unknown-linux-musl.tar.gz',
    sha256: '73657a111819a30c47c08352896796f23d64e4eb2b3ed39b6d32149241566fc5',
    member: 'lychee-x86_64-unknown-linux-musl/lychee',
  },
  // Shell script analysis: `pnpm check:shell`.
  shellcheck: {
    version: '0.11.0',
    url: 'https://github.com/koalaman/shellcheck/releases/download/v0.11.0/shellcheck-v0.11.0.linux.x86_64.tar.gz',
    sha256: 'b7af85e41cc99489dcc21d66c6d5f3685138f06d34651e6d34b42ec6d54fe6f6',
    member: 'shellcheck-v0.11.0/shellcheck',
  },
});

const DOWNLOAD_ATTEMPTS = 3;
const DOWNLOAD_TIMEOUT_MS = 120_000;

/** Entries of an uncompressed tar archive: { name, type, body } (ustar, GNU long names, pax paths). */
export function* tarEntries(archive) {
  let offset = 0;
  let longName = null;
  let paxPath = null;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) return;
    const field = (start, length) => header.toString('utf8', start, start + length).replace(/\0[\s\S]*$/u, '');
    const size = Number.parseInt(field(124, 12).trim() || '0', 8);
    if (!Number.isSafeInteger(size) || size < 0) throw new Error('Corrupt tar header: invalid entry size.');
    const type = field(156, 1) || '0';
    let name = field(0, 100);
    if (field(257, 5) === 'ustar' && field(345, 155)) name = `${field(345, 155)}/${name}`;
    const body = archive.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
    if (type === 'L') longName = body.toString('utf8').replace(/\0[\s\S]*$/u, '');
    else if (type === 'x') paxPath = /(?:^|\n)\d+ path=([^\n]*)\n/u.exec(body.toString('utf8'))?.[1] ?? null;
    else if (type !== 'g') {
      yield { name: longName ?? paxPath ?? name, type, body };
      longName = null;
      paxPath = null;
    }
  }
}

/** The regular file `member` from a .tar.gz buffer. */
export function extractMember(tarGz, member) {
  const wanted = member.replace(/^\.\//u, '');
  for (const entry of tarEntries(gunzipSync(tarGz))) {
    if (entry.type === '0' && entry.name.replace(/^\.\//u, '') === wanted) return entry.body;
  }
  throw new Error(`The release archive does not contain ${member}.`);
}

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

async function download(url, fetchImpl) {
  let lastError;
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < DOWNLOAD_ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  throw new Error(`Could not download ${url}: ${lastError?.message ?? lastError}`);
}

function installedVersionOutput(command) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8', timeout: 15_000 });
  return result.status === 0 ? `${result.stdout}${result.stderr}` : null;
}

function defaultCacheDirectory(env = process.env) {
  return env.LYRA_TOOLS_CACHE || join(env.XDG_CACHE_HOME || join(homedir(), '.cache'), 'lyra-ui-tools');
}

/**
 * Path of an executable for the pinned `name`.
 * @param {string} name
 * @param {object} [options] Injection points for tests.
 */
export async function pinnedToolPath(name, {
  pins = PINNED_TOOLS,
  cacheDir = defaultCacheDirectory(),
  platform = process.platform,
  arch = process.arch,
  fetchImpl = fetch,
  probe = installedVersionOutput,
} = {}) {
  const pin = pins[name];
  if (!pin) throw new Error(`No pinned release is defined for ${name}.`);

  // An installed copy of exactly the pinned version needs no download ("1.31.10" is not "1.31.1").
  const exactVersion = new RegExp(`(?<![\\d.])${pin.version.replaceAll('.', '\\.')}(?![\\d.])`, 'u');
  if (exactVersion.test(probe(name) ?? '')) return name;

  const target = join(cacheDir, `${name}-${pin.version}`, basename(pin.member));
  if (existsSync(target)) return target;

  if (platform !== 'linux' || arch !== 'x64') {
    throw new Error(
      `${name} ${pin.version} is not on PATH, and its pinned build is only downloaded on Linux x86_64. ` +
        `Install ${name} ${pin.version} yourself and put it on PATH.`,
    );
  }
  const archive = await download(pin.url, fetchImpl);
  const actual = sha256(archive);
  if (actual !== pin.sha256) {
    throw new Error(`Checksum mismatch for ${pin.url}: expected ${pin.sha256}, got ${actual}. Nothing was unpacked.`);
  }
  const executable = extractMember(archive, pin.member);
  mkdirSync(dirname(target), { recursive: true });
  const partial = `${target}.${process.pid}.partial`;
  try {
    writeFileSync(partial, executable);
    chmodSync(partial, 0o755);
    renameSync(partial, target);
  } finally {
    rmSync(partial, { force: true });
  }
  return target;
}

async function resolveBinary(name, options) {
  try {
    return { binary: await pinnedToolPath(name, options) };
  } catch (error) {
    return { failure: error };
  }
}

/** Run the pinned `name` with `args`, returning its exit status (a failure to start counts as 1). */
export async function runPinnedTool(name, args, { cwd, input, options } = {}) {
  const { binary, failure } = await resolveBinary(name, options);
  if (failure) {
    console.error(failure.message);
    return 1;
  }
  const result = spawnSync(binary, args, {
    cwd,
    input,
    stdio: [input === undefined ? 'inherit' : 'pipe', 'inherit', 'inherit'],
  });
  if (result.error) {
    console.error(`Could not run ${binary}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

/** Run the pinned `name` with `args`, returning `{ status, stdout }` (stderr still reaches the console). */
export async function capturePinnedTool(name, args, { cwd, options } = {}) {
  const { binary, failure } = await resolveBinary(name, options);
  if (failure) {
    console.error(failure.message);
    return { status: 1, stdout: '' };
  }
  const result = spawnSync(binary, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  if (result.error) {
    console.error(`Could not run ${binary}: ${result.error.message}`);
    return { status: 1, stdout: '' };
  }
  return { status: result.status ?? 1, stdout: result.stdout };
}
