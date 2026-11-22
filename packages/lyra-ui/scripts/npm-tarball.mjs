// Dependency-free helpers shared by the pinned-upstream check and the upstream drift watch:
// bounded registry fetches, SHA-512 integrity checks and a read-only tar extractor. Nothing here
// invokes a package manager or runs package lifecycle scripts.
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

export const REGISTRY = 'https://registry.npmjs.org/';
export const MAX_METADATA_BYTES = 1024 * 1024;
export const MAX_TARBALL_BYTES = 32 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 64 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function sha512Integrity(value) {
  return `sha512-${createHash('sha512').update(value).digest('base64')}`;
}

export function expectedTarballUrl(name, version) {
  const basename = name.slice(name.lastIndexOf('/') + 1);
  return `${REGISTRY}${name}/-/${basename}-${version}.tgz`;
}

export function validateSha512Integrity(value, label) {
  invariant(typeof value === 'string' && value.startsWith('sha512-'), `${label}: tarballIntegrity must use SHA-512 SRI`);
  const decoded = Buffer.from(value.slice('sha512-'.length), 'base64');
  invariant(decoded.length === 64 && `sha512-${decoded.toString('base64')}` === value, `${label}: invalid SHA-512 integrity`);
}
function parseOctal(field, label) {
  const value = field.toString('ascii').split('\0', 1)[0].trim();
  invariant(/^[0-7]+$/u.test(value), `${label}: malformed tar octal field`);
  const parsed = Number.parseInt(value, 8);
  invariant(Number.isSafeInteger(parsed) && parsed >= 0, `${label}: tar number is out of range`);
  return parsed;
}

function tarPath(header) {
  const readField = (start, end) => header.subarray(start, end).toString('utf8').split('\0', 1)[0];
  const name = readField(0, 100);
  const prefix = readField(345, 500);
  return prefix ? `${prefix}/${name}` : name;
}

function validateTarChecksum(header, entryPath) {
  const expected = parseOctal(header.subarray(148, 156), entryPath || 'tar header');
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  invariant(actual === expected, `${entryPath || 'tar header'}: tar header checksum mismatch`);
}

export function extractTarEntries(tarball, requiredEntries) {
  invariant(Buffer.isBuffer(tarball), 'tarball must be a Buffer');
  invariant(tarball.length <= MAX_TARBALL_BYTES, `tarball exceeds ${MAX_TARBALL_BYTES} bytes`);
  const required = new Set(requiredEntries);
  invariant(required.size === requiredEntries.length && required.size > 0, 'required archive entries must be unique');
  for (const entry of required) {
    invariant(
      typeof entry === 'string' && entry.startsWith('package/') && !entry.split('/').includes('..'),
      `unsafe required archive entry: ${String(entry)}`,
    );
  }

  let archive;
  try {
    archive = gunzipSync(tarball, { maxOutputLength: MAX_UNPACKED_BYTES });
  } catch (error) {
    throw new Error(`invalid or oversized npm tarball: ${error instanceof Error ? error.message : String(error)}`);
  }

  const found = new Map();
  let offset = 0;
  let sawEndMarker = false;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      sawEndMarker = true;
      break;
    }
    const entryPath = tarPath(header);
    validateTarChecksum(header, entryPath);
    const size = parseOctal(header.subarray(124, 136), entryPath);
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    invariant(dataEnd <= archive.length, `${entryPath}: tar entry exceeds the archive boundary`);
    if (required.has(entryPath)) {
      const type = header[156];
      invariant(type === 0 || type === 0x30, `${entryPath}: required archive entry is not a regular file`);
      invariant(size <= MAX_ENTRY_BYTES, `${entryPath}: archive entry exceeds ${MAX_ENTRY_BYTES} bytes`);
      invariant(!found.has(entryPath), `${entryPath}: duplicate required archive entry`);
      found.set(entryPath, Buffer.from(archive.subarray(dataStart, dataEnd)));
    }
    offset = dataStart + Math.ceil(size / 512) * 512;
  }
  invariant(sawEndMarker, 'npm tarball has no end marker');
  for (const entry of required) invariant(found.has(entry), `missing required archive entry: ${entry}`);
  return found;
}

async function readResponseBuffer(response, { label, maxBytes }) {
  invariant(response && typeof response === 'object', `${label}: fetch returned no response`);
  invariant(response.ok, `${label}: HTTP ${String(response.status)}`);
  const declaredLength = Number(response.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength)) invariant(declaredLength <= maxBytes, `${label}: response exceeds ${maxBytes} bytes`);
  invariant(response.body, `${label}: response body is empty`);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    invariant(total <= maxBytes, `${label}: response exceeds ${maxBytes} bytes`);
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export function parseJsonBuffer(value, label) {
  let source;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(value);
  } catch (error) {
    throw new Error(`${label}: invalid UTF-8 (${error instanceof Error ? error.message : String(error)})`);
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new Error(`${label}: invalid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
}

export async function exactFetch(fetchImpl, url, { accept, label, maxBytes }) {
  let response;
  try {
    response = await fetchImpl(url, {
      cache: 'no-store',
      headers: { accept },
      redirect: 'error',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`${label}: request failed (${error instanceof Error ? error.message : String(error)})`);
  }
  return readResponseBuffer(response, { label, maxBytes });
}

export async function downloadPinnedManifest(pin, { fetchImpl = globalThis.fetch, registry = REGISTRY } = {}) {
  invariant(typeof fetchImpl === 'function', `${pin.name}: Fetch API is unavailable`);
  invariant(registry === REGISTRY, `${pin.name}: registry must be ${REGISTRY}`);
  validateSha512Integrity(pin.tarballIntegrity, pin.name);
  const metadataUrl = `${registry}${encodeURIComponent(pin.name)}/${pin.version}`;
  const metadataBytes = await exactFetch(fetchImpl, metadataUrl, {
    accept: 'application/json',
    label: `${pin.name}@${pin.version} metadata`,
    maxBytes: MAX_METADATA_BYTES,
  });
  const metadata = parseJsonBuffer(metadataBytes, `${pin.name}@${pin.version} metadata`);
  invariant(
    metadata.name === pin.name && metadata.version === pin.version,
    `${pin.name}@${pin.version}: registry metadata identity mismatch`,
  );
  invariant(
    metadata.dist?.integrity === pin.tarballIntegrity,
    `${pin.name}@${pin.version}: registry metadata integrity does not match the reviewed pin`,
  );
  invariant(
    metadata.dist?.tarball === pin.tarballUrl,
    `${pin.name}@${pin.version}: registry metadata tarball URL does not match the reviewed pin`,
  );

  const tarball = await exactFetch(fetchImpl, pin.tarballUrl, {
    accept: 'application/octet-stream',
    label: `${pin.name}@${pin.version} tarball`,
    maxBytes: MAX_TARBALL_BYTES,
  });
  const actualIntegrity = sha512Integrity(tarball);
  invariant(
    actualIntegrity === pin.tarballIntegrity,
    `${pin.name}@${pin.version}: tarball integrity does not match the reviewed pin`,
  );

  const entries = extractTarEntries(tarball, ['package/package.json', pin.manifestPath]);
  const packageJson = parseJsonBuffer(entries.get('package/package.json'), `${pin.name} package.json`);
  invariant(
    packageJson.name === pin.name && packageJson.version === pin.version,
    `${pin.name}@${pin.version}: embedded package identity mismatch`,
  );
  const manifestBytes = entries.get(pin.manifestPath);
  const actualManifestSha256 = sha256(manifestBytes);
  invariant(
    actualManifestSha256 === pin.manifestSha256,
    `${pin.name}@${pin.version}: manifest SHA-256 does not match the reviewed pin`,
  );
  const manifest = parseJsonBuffer(manifestBytes, `${pin.name} custom-elements.json`);
  invariant(manifest.schemaVersion === '1.0.0', `${pin.name}@${pin.version}: unsupported manifest schema`);
  invariant(Array.isArray(manifest.modules), `${pin.name}@${pin.version}: manifest modules are missing`);
  invariant(
    manifest.package?.name === pin.name && manifest.package?.version === pin.version,
    `${pin.name}@${pin.version}: manifest package identity mismatch`,
  );
  return {
    manifest,
    manifestSha256: actualManifestSha256,
    tarballIntegrity: actualIntegrity,
  };
}
