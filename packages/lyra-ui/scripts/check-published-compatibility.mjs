import { readFileSync } from 'node:fs';
import { assembleCompatibilityContext, compatibilityKey, policyKey } from './published-compatibility.mjs';
import { readComponentMetadataSources, assembleComponentMetadata } from './component-metadata-source.mjs';
import { inspectExportContract } from './component-metadata.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPublishedCaptureSync, sha256, decodeEvidence, verifyPolicyWitnesses } from './published-compatibility-io.mjs';
import { isMainModule } from './is-main-module.mjs';

export function checkPublishedCompatibilitySync(directory = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/compatibility-history')) {
  const index = JSON.parse(readFileSync(join(directory, 'index.json'), 'utf8'));
  if (index.schemaVersion !== 1 || !Array.isArray(index.captures) || index.captures.length === 0 || !Array.isArray(index.retirements)) throw new Error('Unsupported compatibility index');
  const releases = new Set(); const captures = [];
  for (const entry of index.captures) {
    if (!/^\d+\.\d+\.\d+$/u.test(entry.directory) || releases.has(entry.directory)) throw new Error('Invalid or duplicate capture directory');
    releases.add(entry.directory);
    const root = join(directory, entry.directory);
    if (sha256(readFileSync(join(root, 'capture.json'))) !== entry.captureSha256) throw new Error('Capture descriptor differs from reviewed index pin');
    const verified = readPublishedCaptureSync(root);
    if (verified.capture.sourceVersion !== entry.directory) throw new Error('Capture directory identity mismatch');
    captures.push(verified);
  }
  if (index.policyWitnesses?.file !== 'policy-witnesses.json.gz' || !Array.isArray(index.guidanceTransitions)) throw new Error('Missing policy publication witnesses');
  const witnessBytes = readFileSync(join(directory, index.policyWitnesses.file));
  if (sha256(witnessBytes) !== index.policyWitnesses.sha256) throw new Error('Policy witness archive differs from reviewed pin');
  const observedPublication = verifyPolicyWitnesses(decodeEvidence(witnessBytes), captures, index.guidanceTransitions);
  return { captures, retirements: index.retirements, observedPublication };
}

/** Bind historical facts to actual current package source, never an arbitrary target version. */
export function readCurrentCompatibilityContextSync(packageDir = join(dirname(fileURLToPath(import.meta.url)), '..'), currentInventory = null) {
  const metadata = assembleComponentMetadata(readComponentMetadataSources(packageDir));
  const packageJson = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
  const inventory = currentInventory ?? JSON.parse(readFileSync(join(packageDir, 'scripts/fixtures/component-inventory.json'), 'utf8'));
  const verified = checkPublishedCompatibilitySync(join(packageDir, 'scripts/fixtures/compatibility-history'));
  const candidates = new Map();
  const add = entry => candidates.set(compatibilityKey(policyKey(entry, 'export')), entry);
  const currentExportKeys = new Set(metadata.exportDeprecations.map(entry => compatibilityKey(policyKey(entry, 'export'))));
  for (const entry of metadata.exportDeprecations) add(entry);
  for (const capture of verified.captures) for (const entry of capture.facts.records) {
    if (entry.key.scope !== 'export' || currentExportKeys.has(compatibilityKey(entry.key))) continue;
    add(entry.policy);
    add({ ...entry.policy.replacement, module: entry.policy.replacement.module ?? entry.policy.module });
  }
  const sourceCache = new Map();
  const readSource = path => {
    if (!sourceCache.has(path)) sourceCache.set(path, readFileSync(join(packageDir, path), 'utf8'));
    return sourceCache.get(path);
  };
  const currentExportSurface = [];
  for (const entry of candidates.values()) {
    const fact = inspectExportContract(entry, { packageJson, readSource, exportDeprecations: metadata.exportDeprecations });
    if (fact.status === 'invalid') throw new Error(`Cannot inspect ${entry.name}: ${fact.findings.join('; ')}`);
    if (fact.status === 'present') currentExportSurface.push({ key: policyKey(entry, 'export'), ...fact });
  }
  return assembleCompatibilityContext({ packageVersion: packageJson.version, currentInventory: inventory,
    currentExportDeprecations: metadata.exportDeprecations, currentExportSurface,
    captures: verified.captures.map(entry => entry.facts), retirementIndex: verified.retirements });
}

export async function checkPublishedCompatibility(directory) { return checkPublishedCompatibilitySync(directory); }
export async function readCurrentCompatibilityContext(packageDir, inventory) { return readCurrentCompatibilityContextSync(packageDir, inventory); }

if (isMainModule(import.meta.url)) {
  const context = await readCurrentCompatibilityContext();
  console.log(`Verified immutable published compatibility and ${Object.keys(context.records).length} current/retired policy records.`);
}
