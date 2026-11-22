// Downloads the exact public npm artifacts pinned in upstream-package-pins.json, without invoking
// a package manager or any lifecycle scripts. Only the embedded package identity and published
// custom-elements manifest are read after the complete tarball passes its pinned SHA-512 digest.
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateInventory, validatePinnedManifests } from './component-inventory.mjs';
import {
  expandLyraInventoryManifest,
  generateInventory,
} from './generate-component-inventory.mjs';
import { isMainModule } from './is-main-module.mjs';
import {
  REGISTRY,
  downloadPinnedManifest,
  expectedTarballUrl,
  extractTarEntries,
  invariant,
  validateSha512Integrity,
} from './npm-tarball.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PIN_FIXTURE = path.join(packageDir, 'scripts', 'fixtures', 'upstream-package-pins.json');
const INVENTORY_FIXTURE = path.join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');
const UPSTREAM_TAGS_FIXTURE = path.join(packageDir, 'scripts', 'fixtures', 'upstream-tags.json');
const LYRA_MANIFEST = path.join(packageDir, 'custom-elements.json');

export { downloadPinnedManifest, extractTarEntries };

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
    for (const [field, evidenceLabel] of [
      ['runtimeEventCancelability', 'runtime evidence'],
      ['runtimeMethodEdgeSemantics', 'runtime method-edge evidence'],
    ]) {
      const runtimeEvidenceSource = upstreamTags?.[ecosystem]?.[field]?.source;
      if (!runtimeEvidenceSource) continue;
      invariant(
        runtimeEvidenceSource.package === pin.name &&
          runtimeEvidenceSource.version === pin.version,
        `${label}: ${evidenceLabel} package identity does not match the reviewed artifact`,
      );
      invariant(
        runtimeEvidenceSource.tarballIntegrity === pin.tarballIntegrity,
        `${label}: ${evidenceLabel} integrity does not match the reviewed artifact`,
      );
    }
  }
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

if (isMainModule(import.meta.url)) await main();
