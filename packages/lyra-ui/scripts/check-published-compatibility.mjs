import { readFileSync } from 'node:fs';
import { assembleCompatibilityContext, compatibilityExportCandidates, policyKey } from './published-compatibility.mjs';
import { readComponentMetadataSources, assembleComponentMetadata } from './component-metadata-source.mjs';
import { compareVersions, inspectExportContract } from './component-metadata.mjs';
import { checkPublishedFieldHistorySync } from './published-field-compatibility-io.mjs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPublishedCaptureSync, sha256, decodeEvidence, verifyPolicyWitnesses } from './published-compatibility-io.mjs';
import { isMainModule } from './is-main-module.mjs';
import { memoizedHistoryVerification } from './published-history-memo.mjs';
import { readSourceSnapshot } from './source-fixture-io.mjs';

export function checkPublishedCompatibilitySync(directory = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/compatibility-history')) {
  directory = resolve(directory);
  return memoizedHistoryVerification('published-compatibility', directory, () => verifyPublishedCompatibility(directory));
}

function verifyPublishedCompatibility(directory) {
  const snapshots = new Map();
  const readBytes = file => {
    if (!snapshots.has(file)) snapshots.set(file, readSourceSnapshot(directory, relative(directory, file), { binary: true }));
    return snapshots.get(file).original;
  };
  const index = JSON.parse(readBytes(join(directory, 'index.json')).toString('utf8'));
  if (index.schemaVersion !== 1 || !Array.isArray(index.captures) || index.captures.length === 0 || !Array.isArray(index.retirements)) throw new Error('Unsupported compatibility index');
  const releases = new Set(); const captures = [];
  for (const entry of index.captures) {
    if (!/^\d+\.\d+\.\d+$/u.test(entry.directory) || releases.has(entry.directory)) throw new Error('Invalid or duplicate capture directory');
    releases.add(entry.directory);
    const root = join(directory, entry.directory);
    if (sha256(readBytes(join(root, 'capture.json'))) !== entry.captureSha256) throw new Error('Capture descriptor differs from reviewed index pin');
    const verified = readPublishedCaptureSync(root, { readBytes });
    if (verified.capture.sourceVersion !== entry.directory) throw new Error('Capture directory identity mismatch');
    captures.push(verified);
  }
  if (index.policyWitnesses?.file !== 'policy-witnesses.json.gz' || !Array.isArray(index.guidanceTransitions)) throw new Error('Missing policy publication witnesses');
  const witnessBytes = readBytes(join(directory, index.policyWitnesses.file));
  if (sha256(witnessBytes) !== index.policyWitnesses.sha256) throw new Error('Policy witness archive differs from reviewed pin');
  const observedPublication = verifyPolicyWitnesses(decodeEvidence(witnessBytes), captures, index.guidanceTransitions);
  const classAliases = [];
  for (const { capture, facts, publishedManifest } of captures) {
    const byTag = new Map();
    for (const module of publishedManifest.modules ?? []) for (const declaration of module.declarations ?? []) {
      if (declaration.kind !== 'class' || !declaration.customElement || !declaration.tagName) continue;
      if (byTag.has(declaration.tagName)) throw new Error('Ambiguous published component declaration');
      byTag.set(declaration.tagName, { module: module.path, name: declaration.name, tag: declaration.tagName });
    }
    for (const { key, policy } of facts.records) {
      if (key.scope !== 'member' || policy.kind !== 'component' || policy.replacement?.kind !== 'component') continue;
      const source = byTag.get(policy.tag); const replacement = byTag.get(policy.replacement.name);
      if (!source || !replacement || policy.name !== policy.tag) throw new Error('Published component alias has no exact declaration identity');
      classAliases.push({ sourceRelease: capture.sourceRelease, policy: structuredClone(policy), source, replacement });
    }
  }
  return { captures, retirements: index.retirements, observedPublication, classAliases, snapshots: [...snapshots.values()] };
}

/** Bind historical facts to actual current package source, never an arbitrary target version. */
export function readCurrentCompatibilityContextSync(packageDir = join(dirname(fileURLToPath(import.meta.url)), '..'), currentInventory = null) {
  const metadata = assembleComponentMetadata(readComponentMetadataSources(packageDir));
  const packageJson = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  const inventory = currentInventory ?? JSON.parse(readFileSync(join(packageDir, 'scripts/fixtures/component-inventory.json'), 'utf8'));
  const verified = checkPublishedCompatibilitySync(join(packageDir, 'scripts/fixtures/compatibility-history'));
  if (compareVersions(packageJson.version, '24.0.0') >= 0) {
    checkPublishedFieldHistorySync(join(packageDir, 'scripts/fixtures/compatibility-history'), {
      captures: verified.captures,
    });
  }
  const candidates = compatibilityExportCandidates(metadata, verified.captures.map(entry => entry.facts));
  const sourceCache = new Map();
  const readSource = path => {
    if (!sourceCache.has(path)) sourceCache.set(path, readFileSync(join(packageDir, path), 'utf8'));
    return sourceCache.get(path);
  };
  const currentExportSurface = [];
  for (const entry of candidates) {
    const fact = inspectExportContract(entry, { packageJson, readSource, exportDeprecations: metadata.exportDeprecations });
    if (fact.status === 'invalid') throw new Error(`Cannot inspect ${entry.name}: ${fact.findings.join('; ')}`);
    if (fact.status === 'present') currentExportSurface.push({ key: policyKey(entry, 'export'), ...fact });
  }
  // The migration CLI emits this exact installed package route, not the implementation path
  // named by component-inventory.json. The map is derived from the checked current version's
  // actual exports and is intentionally absent for older package snapshots that did not publish
  // a stable tag-shaped alias.
  const componentRegistrationRoutes = Object.create(null);
  for (const component of inventory.components) {
    const route = `./components/${component.tag}.js`;
    const exportEntry = packageJson.exports?.[route];
    const defaultTarget = typeof exportEntry === 'string' ? exportEntry : exportEntry?.default;
    if (defaultTarget === `./dist/components/${component.tag}.js`) {
      componentRegistrationRoutes[component.tag] = route;
    }
  }
  return assembleCompatibilityContext({ packageVersion: packageJson.version, currentInventory: inventory,
    currentExportDeprecations: metadata.exportDeprecations, currentExportSurface,
    componentRegistrationRoutes,
    captures: verified.captures.map(entry => entry.facts), retirementIndex: verified.retirements });
}

export async function checkPublishedCompatibility(directory) { return checkPublishedCompatibilitySync(directory); }
export async function readCurrentCompatibilityContext(packageDir, inventory) { return readCurrentCompatibilityContextSync(packageDir, inventory); }

if (isMainModule(import.meta.url)) {
  const context = await readCurrentCompatibilityContext();
  console.log(`Verified immutable published compatibility and ${Object.keys(context.records).length} current/retired policy records.`);
}
