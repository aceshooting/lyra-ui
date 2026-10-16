import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFile, readdir, realpath } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Accept only the complete pnpm audit report, including an internally consistent total. */
export function parseAudit(stdout, status) {
  if (status !== 0 && status !== 1) throw new Error('Dependency audit command failed');
  let report;
  try { report = JSON.parse(stdout); } catch { throw new Error('Dependency audit returned invalid JSON'); }
  if (!object(report) || report.error || report.message || !object(report.advisories) ||
      !object(report.metadata?.vulnerabilities)) throw new Error('Dependency audit returned an invalid report');
  const counts = report.metadata.vulnerabilities;
  const levels = ['info', 'low', 'moderate', 'high', 'critical'];
  if (Object.keys(counts).some((key) => !levels.includes(key)) ||
      levels.some((key) => !Number.isSafeInteger(counts[key]) || counts[key] < 0)) {
    throw new Error('Dependency audit returned invalid vulnerability counts');
  }
  const advisories = Object.values(report.advisories);
  if (levels.reduce((total, level) => total + counts[level], 0) !== advisories.length ||
      (status === 0) !== (advisories.length === 0)) throw new Error('Dependency audit report is inconsistent');
  for (const advisory of advisories) {
    if (!object(advisory) || typeof advisory.github_advisory_id !== 'string' ||
        typeof advisory.module_name !== 'string' || !levels.includes(advisory.severity) ||
        !Array.isArray(advisory.findings) || advisory.findings.length === 0 ||
        advisory.findings.some((finding) => !object(finding) || typeof finding.version !== 'string' ||
          !Array.isArray(finding.paths) || finding.paths.length === 0 ||
          finding.paths.some((path) => typeof path !== 'string' || !path))) {
      throw new Error('Dependency audit returned an invalid advisory');
    }
  }
  return advisories;
}

/** Evidence is collected independently from the installed dependency graph and reviewed patch files. */
export function validateMitigations(advisories, mitigations, evidence) {
  for (const mitigation of mitigations) {
    const proof = evidence.find((entry) => entry.advisory === mitigation.advisory);
    if (!proof || proof.registration !== mitigation.patch || proof.patchSha256 !== mitigation.patchSha256) {
      throw new Error(`Missing or changed patch: ${mitigation.advisory}`);
    }
    if (!Array.isArray(proof.installed) || proof.installed.length === 0) {
      throw new Error(`Patched dependency is not installed: ${mitigation.package}`);
    }
    for (const installed of proof.installed) {
      if (installed.version !== mitigation.version || Object.entries(mitigation.files).some(
        ([file, digest]) => installed.files[file] !== digest)) {
        throw new Error(`Unverified installed dependency: ${mitigation.package}`);
      }
    }
    if (!proof.scannerCorrespondence) throw new Error(`Missing scanner patch reference: ${mitigation.advisory}`);
  }
  for (const advisory of advisories) {
    const mitigation = mitigations.find((entry) => entry.advisory === advisory.github_advisory_id &&
      entry.package === advisory.module_name);
    if (!mitigation || advisory.findings.some((finding) => finding.version !== mitigation.version)) {
      throw new Error(`Unmitigated advisory: ${advisory.github_advisory_id} (${advisory.module_name})`);
    }
  }
  return { unmitigated: 0, patched: advisories.length };
}

// Only top-level entries of this narrowly scoped YAML mapping are accepted; no general YAML evaluation.
export function patchRegistrations(workspace) {
  const section = workspace.match(/^patchedDependencies:\s*\n((?:[ \t]+[^\n]*\n|\n)*)/m)?.[1];
  if (!section) throw new Error('Missing patchedDependencies registration');
  return Object.fromEntries(section.split('\n').filter((line) => line.trim()).map((line) => {
    const match = line.match(/^  ['"]?([^'"\s]+)['"]?: ['"]?([^'"\s]+)['"]?\s*$/);
    if (!match) throw new Error('Unsupported patchedDependencies registration');
    return [match[1], match[2]];
  }));
}

async function installedPackages(root, names) {
  const queue = [join(root, 'node_modules')];
  for (const entry of await readdir(join(root, 'packages'), { withFileTypes: true })) {
    if (entry.isDirectory()) queue.push(join(root, 'packages', entry.name, 'node_modules'));
  }
  const seenDirectories = new Set();
  const seenPackages = new Set();
  const found = [];
  while (queue.length) {
    const directory = queue.pop();
    let canonical;
    try { canonical = await realpath(directory); } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (seenDirectories.has(canonical)) continue;
    seenDirectories.add(canonical);
    const entries = await readdir(canonical, { withFileTypes: true });
    const paths = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name.startsWith('@') && entry.isDirectory()) {
        for (const scoped of await readdir(join(canonical, entry.name))) paths.push(join(canonical, entry.name, scoped));
      } else if (entry.isDirectory() || entry.isSymbolicLink()) paths.push(join(canonical, entry.name));
    }
    for (const path of paths) {
      const packageRoot = await realpath(path);
      if (seenPackages.has(packageRoot)) continue;
      seenPackages.add(packageRoot);
      const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
      if (names.has(manifest.name)) found.push({ root: packageRoot, name: manifest.name, version: manifest.version });
      queue.push(join(packageRoot, 'node_modules'));
      // pnpm places a package's dependencies beside that package in its virtual-store node_modules.
      const parent = dirname(packageRoot);
      if (parent.includes(`${join('node_modules', '.pnpm')}/`)) {
        queue.push(manifest.name.startsWith('@') ? dirname(parent) : parent);
      }
    }
  }
  return found;
}

export async function collectEvidence(root, mitigations) {
  const registrations = patchRegistrations(await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8'));
  const scanner = await readFile(join(root, 'osv-scanner.toml'), 'utf8');
  const packages = await installedPackages(root, new Set(mitigations.map((entry) => entry.package)));
  return Promise.all(mitigations.map(async (entry) => ({
    advisory: entry.advisory,
    registration: registrations[`${entry.package}@${entry.version}`],
    patchSha256: sha256(await readFile(join(root, entry.patch))),
    scannerCorrespondence: scanner.split('[[IgnoredVulns]]').some((block) =>
      block.includes(`id = "${entry.advisory}"`) && block.includes(entry.patch)),
    installed: await Promise.all(packages.filter((pkg) => pkg.name === entry.package).map(async (pkg) => ({
      version: pkg.version,
      files: Object.fromEntries(await Promise.all(Object.keys(entry.files).map(async (file) =>
        [file, sha256(await readFile(join(pkg.root, file)))]))),
    }))),
  })));
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const mitigations = JSON.parse(await readFile(join(root, 'scripts/fixtures/dependency-security.json'), 'utf8'));
  const evidence = await collectEvidence(root, mitigations);
  const audit = spawnSync('pnpm', ['audit', '--json'], {
    cwd: root, encoding: 'utf8', timeout: 120_000, maxBuffer: 32 * 1024 * 1024,
  });
  if (audit.error || audit.signal) throw new Error('Dependency audit command did not complete');
  const advisories = parseAudit(audit.stdout, audit.status);
  const result = validateMitigations(advisories, mitigations, evidence);
  console.log(`Dependency security: ${result.unmitigated} unmitigated advisories; ${result.patched} verified locally patched advisories (registry reports retained).`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
