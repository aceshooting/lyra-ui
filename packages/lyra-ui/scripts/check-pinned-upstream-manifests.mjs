// Downloads the exact public npm artifacts pinned in upstream-package-pins.json, without invoking
// a package manager or any lifecycle scripts. Only the embedded package identity and published
// custom-elements manifest are read after the complete tarball passes its pinned SHA-512 digest.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { validateInventory, validatePinnedManifests } from './component-inventory.mjs';
import {
  expandLyraInventoryManifest,
  generateInventory,
} from './generate-component-inventory.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIN_FIXTURE = path.join(packageDir, 'scripts', 'fixtures', 'upstream-package-pins.json');
const INVENTORY_FIXTURE = path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');
const UPSTREAM_TAGS_FIXTURE = path.join(packageDir, 'scripts', 'fixtures', 'upstream-tags.json');
const LYRA_MANIFEST = path.join(packageDir, 'custom-elements.json');

const REGISTRY = 'https://registry.npmjs.org/';
const MAX_METADATA_BYTES = 1024 * 1024;
const MAX_TARBALL_BYTES = 32 * 1024 * 1024;
const MAX_UNPACKED_BYTES = 64 * 1024 * 1024;
const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;
const REQUIRED_PACKAGES = Object.freeze({
  webawesome: '@awesome.me/webawesome',
  shoelace: '@shoelace-style/shoelace',
});
const ECOSYSTEM_LABELS = Object.freeze({
  webawesome: 'Web Awesome',
  shoelace: 'Shoelace',
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha512Integrity(value) {
  return `sha512-${createHash('sha512').update(value).digest('base64')}`;
}

function expectedTarballUrl(name, version) {
  const basename = name.slice(name.lastIndexOf('/') + 1);
  return `${REGISTRY}${name}/-/${basename}-${version}.tgz`;
}

function validateSha512Integrity(value, label) {
  invariant(typeof value === 'string' && value.startsWith('sha512-'), `${label}: tarballIntegrity must use SHA-512 SRI`);
  const decoded = Buffer.from(value.slice('sha512-'.length), 'base64');
  invariant(decoded.length === 64 && `sha512-${decoded.toString('base64')}` === value, `${label}: invalid SHA-512 integrity`);
}

export function validatePinConfiguration(pins, { inventory, upstreamTags }) {
  invariant(pins?.schemaVersion === 1, 'upstream package pins use an unsupported schema');
  invariant(pins.registry === REGISTRY, `upstream package registry must be ${REGISTRY}`);
  invariant(pins.packages && typeof pins.packages === 'object', 'upstream package pins are missing packages');
  const ecosystems = Object.keys(pins.packages).sort();
  invariant(
    JSON.stringify(ecosystems) === JSON.stringify(Object.keys(REQUIRED_PACKAGES).sort()),
    'upstream package pins must contain exactly Web Awesome and Shoelace',
  );

  for (const [ecosystem, expectedName] of Object.entries(REQUIRED_PACKAGES)) {
    const label = ECOSYSTEM_LABELS[ecosystem];
    const pin = pins.packages[ecosystem];
    invariant(pin.name === expectedName, `${label}: package identity must be ${expectedName}`);
    invariant(/^\d+\.\d+\.\d+$/u.test(pin.version), `${label}: version must be an exact stable semver`);
    invariant(
      upstreamTags?.[ecosystem]?.version === pin.version,
      `${label}: upstream-tags pin ${String(upstreamTags?.[ecosystem]?.version)} does not match artifact ${pin.version}`,
    );
    invariant(
      inventory?.pins?.[ecosystem]?.version === pin.version,
      `${label}: component inventory pin ${String(inventory?.pins?.[ecosystem]?.version)} does not match artifact ${pin.version}`,
    );
    invariant(
      inventory?.upstreams?.[ecosystem]?.version === pin.version,
      `${label}: component inventory snapshot ${String(inventory?.upstreams?.[ecosystem]?.version)} does not match artifact ${pin.version}`,
    );
    invariant(
      pin.tarballUrl === expectedTarballUrl(pin.name, pin.version),
      `${label}: tarball URL is not the canonical exact-version npm artifact`,
    );
    validateSha512Integrity(pin.tarballIntegrity, label);
    invariant(
      pin.manifestPath === 'package/dist/custom-elements.json',
      `${label}: manifest path must be package/dist/custom-elements.json`,
    );
    invariant(/^[a-f0-9]{64}$/u.test(pin.manifestSha256), `${label}: manifestSha256 must be a lowercase SHA-256 digest`);
    const runtimeEvidenceSource = upstreamTags?.[ecosystem]?.runtimeEventCancelability?.source;
    if (runtimeEvidenceSource) {
      invariant(
        runtimeEvidenceSource.package === pin.name && runtimeEvidenceSource.version === pin.version,
        `${label}: runtime evidence package identity does not match the reviewed artifact`,
      );
      invariant(
        runtimeEvidenceSource.tarballIntegrity === pin.tarballIntegrity,
        `${label}: runtime evidence integrity does not match the reviewed artifact`,
      );
    }
  }
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

function parseJsonBuffer(value, label) {
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

async function exactFetch(fetchImpl, url, { accept, label, maxBytes }) {
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

export function validatePinnedUpstreamContract(
  { inventory, upstreamTags, lyraManifest, manifests },
  {
    expandLyraManifestImpl = expandLyraInventoryManifest,
    validateInventoryImpl = validateInventory,
    validatePinnedManifestsImpl = validatePinnedManifests,
  } = {},
) {
  const findings = validateInventoryImpl(inventory, {
    upstreamTags,
    lyraManifest: expandLyraManifestImpl(lyraManifest),
    strict: true,
  });
  findings.push(
    ...validatePinnedManifestsImpl(inventory, {
      webawesomeManifest: manifests.webawesome,
      shoelaceManifest: manifests.shoelace,
      upstreamTags,
    }),
  );
  return [...new Set(findings)].sort();
}

/** Regenerates the inventory from already verified public manifests without retaining tarballs or
 * unpacked package contents. The generator accepts paths so a short-lived private directory is the
 * only place the downloaded manifest JSON crosses into the inventory pipeline. */
export function writeInventoryFromVerifiedManifests(
  manifests,
  { output = INVENTORY_FIXTURE, generateInventoryImpl = generateInventory } = {},
) {
  const manifestDirectory = fs.mkdtempSync(path.join(tmpdir(), 'lyra-upstream-manifests-'));
  try {
    const webawesomeManifest = path.join(manifestDirectory, 'webawesome-custom-elements.json');
    const shoelaceManifest = path.join(manifestDirectory, 'shoelace-custom-elements.json');
    fs.writeFileSync(webawesomeManifest, `${JSON.stringify(manifests.webawesome)}\n`);
    fs.writeFileSync(shoelaceManifest, `${JSON.stringify(manifests.shoelace)}\n`);
    const inventory = generateInventoryImpl({
      output,
      webawesomeManifest,
      shoelaceManifest,
    });
    fs.writeFileSync(output, `${JSON.stringify(inventory, null, 2)}\n`);
    return inventory;
  } finally {
    fs.rmSync(manifestDirectory, { force: true, recursive: true });
  }
}

async function runPinnedUpstreamCheck({ fetchImpl = globalThis.fetch, writeInventory = false } = {}) {
  const pins = readJson(PIN_FIXTURE);
  let inventory = readJson(INVENTORY_FIXTURE);
  const upstreamTags = readJson(UPSTREAM_TAGS_FIXTURE);
  const lyraManifest = readJson(LYRA_MANIFEST);
  validatePinConfiguration(pins, { inventory, upstreamTags });
  const downloads = Object.fromEntries(
    await Promise.all(
      Object.entries(pins.packages).map(async ([ecosystem, pin]) => [
        ecosystem,
        await downloadPinnedManifest(pin, { fetchImpl, registry: pins.registry }),
      ]),
    ),
  );
  const manifests = Object.fromEntries(
    Object.entries(downloads).map(([ecosystem, result]) => [ecosystem, result.manifest]),
  );
  if (writeInventory) inventory = writeInventoryFromVerifiedManifests(manifests);
  const findings = validatePinnedUpstreamContract({ inventory, upstreamTags, lyraManifest, manifests });
  return { downloads, findings, inventory, pins };
}

async function main() {
  try {
    const arguments_ = process.argv.slice(2);
    const unknown = arguments_.filter((argument) => argument !== '--write-inventory');
    if (unknown.length > 0) throw new Error(`Unknown argument: ${unknown[0]}`);
    const writeInventory = arguments_.includes('--write-inventory');
    const { downloads, findings, inventory, pins } = await runPinnedUpstreamCheck({ writeInventory });
    if (findings.length) {
      console.error(`Pinned upstream manifest contract failed with ${findings.length} finding(s):`);
      for (const finding of findings) console.error(`- ${finding}`);
      process.exitCode = 1;
      return;
    }
    const evidence = Object.entries(downloads)
      .map(([ecosystem, result]) => {
        const pin = pins.packages[ecosystem];
        return `${pin.name}@${pin.version} manifest-sha256=${result.manifestSha256}`;
      })
      .join('; ');
    console.log(
      `Pinned upstream manifest contract passed for ${inventory.upstreams.webawesome.components.length} Web Awesome ` +
        `and ${inventory.upstreams.shoelace.components.length} Shoelace surfaces (${evidence}).`,
    );
    if (writeInventory) console.log('component-inventory.json regenerated from those verified manifests.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
