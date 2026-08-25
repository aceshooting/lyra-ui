#!/usr/bin/env node
// Orthogonal component qualification gate. Semver maturity says whether a public API is covered by
// compatibility policy; this gate independently records what evidence exists for that component.
// Every public tag, stable or experimental, must own a populated/open axe assertion against the
// exact instance mounted in the same test case, or a narrow reviewed exemption.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  AXE_ASSERTION,
  QUALIFICATION_DIMENSIONS,
  axeEvidenceForTag,
  mountsTag,
  normalizeExemptions,
  readComponentTestFiles,
  readComponentTests,
} from './qualification-core.mjs';
import { buildQualityArtifacts, qualityArtifactFindings } from './generate-component-quality.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.dirname(scriptsDir);
const inventoryPath = path.join(scriptsDir, 'fixtures', 'component-inventory.json');
const exemptionsPath = path.join(scriptsDir, 'qualification-exemptions.json');

export { AXE_ASSERTION, mountsTag, normalizeExemptions, readComponentTests };

// Only accessibility is a blocking source assertion. The remaining dimensions are materialized in
// component-qualification.json with honest `not-recorded`, `not-enrolled`, or `not-verified`
// statuses when evidence does not exist; they must never be inferred into a pass from a substring.
export const DIMENSIONS = Object.freeze(
  QUALIFICATION_DIMENSIONS.map((key) => ({
    key,
    label: key === 'accessibility' ? 'same-instance populated/open axe assertion' : `${key} qualification record`,
    blocking: key === 'accessibility',
  })),
);

function relativeEvidence(evidence) {
  return {
    ...evidence,
    file: path.relative(packageDir, evidence.file).replaceAll('\\', '/'),
  };
}

export function accessibilityEvidence(component, testFiles) {
  return testFiles
    .flatMap(({ file, source }) => axeEvidenceForTag({ file, source, tag: component.tag }))
    .map(relativeEvidence)
    .sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.test.localeCompare(b.test));
}

export function evaluateQualification({ components, exemptions, loadTestFiles, loadTests }) {
  const { byKey, problems } = normalizeExemptions(exemptions);
  const failures = [...problems];
  const stale = [];
  const used = new Set();
  const evidenceByTag = new Map();

  for (const component of components) {
    const testFiles = loadTestFiles
      ? loadTestFiles(component)
      : [{ file: path.join(packageDir, path.dirname(component.classModule), '<synthetic>.test.ts'), source: loadTests?.(path.join(packageDir, path.dirname(component.classModule))) ?? '' }];
    const evidence = accessibilityEvidence(component, testFiles);
    evidenceByTag.set(component.tag, evidence);
    const populated = evidence.filter((entry) => entry.state === 'populated' || entry.state === 'open');
    const key = `${component.tag}\0accessibility`;
    const exemption = byKey.get(key);
    if (populated.length > 0) {
      if (exemption) stale.push(`${component.tag} (accessibility): populated/open evidence has landed -- delete this exemption`);
      continue;
    }
    if (exemption) {
      used.add(key);
      if (evidence.length === 0) {
        failures.push(`${component.tag}: the reviewed state-model exemption does not replace baseline same-instance axe evidence.`);
      }
      continue;
    }
    const defaultOnly = evidence.length > 0
      ? `; ${evidence.length} same-instance axe assertion(s) cover only the empty/default state`
      : '';
    failures.push(
      `${component.tag}: no same-test, same-instance populated/open axe evidence${defaultOnly}, and no reviewed exemption.`,
    );
  }

  const tags = new Set(components.map((component) => component.tag));
  for (const [key, entry] of byKey) {
    if (!tags.has(entry.tag)) stale.push(`${entry.tag} (${entry.dimension}): no such component -- delete this exemption`);
    else if (entry.dimension !== 'accessibility') {
      // Non-blocking dimensions use explicit pending/not-applicable records in the qualification
      // ledger. An exemption would hide that status and is therefore never consumed here.
      stale.push(`${entry.tag} (${entry.dimension}): this dimension is tracked in the ledger, not exempted here`);
    } else if (!used.has(key) && !stale.some((message) => message.startsWith(`${entry.tag} (${entry.dimension})`))) {
      stale.push(`${entry.tag} (${entry.dimension}): exemption was not needed -- delete it`);
    }
  }

  return { failures, stale, exemptionCount: byKey.size, evidenceByTag };
}

async function main() {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  if (inventory.schemaVersion !== 1 || !Array.isArray(inventory.components)) {
    throw new Error('component-inventory.json uses an unsupported schema; expected schemaVersion 1 with components[]');
  }
  const exemptions = fs.existsSync(exemptionsPath)
    ? JSON.parse(fs.readFileSync(exemptionsPath, 'utf8'))
    : { schemaVersion: 2, exemptions: [] };

  const result = evaluateQualification({
    components: inventory.components,
    exemptions,
    loadTestFiles: (component) => readComponentTestFiles(path.join(packageDir, path.dirname(component.classModule))),
  });
  const summary =
    `qualification: ${inventory.components.length} public component(s), ` +
    `${result.exemptionCount} reviewed exemption(s), ${DIMENSIONS.length} tracked dimension(s)`;

  if (result.failures.length === 0 && result.stale.length === 0) {
    const artifacts = await buildQualityArtifacts();
    for (const finding of qualityArtifactFindings(artifacts)) {
      result.failures.push(`generated quality artifact ${finding}`);
    }
  }

  if (result.failures.length > 0 || result.stale.length > 0) {
    for (const failure of result.failures) console.error(`  ${failure}`);
    for (const entry of result.stale) console.error(`  stale exemption -- ${entry}`);
    console.error(
      `${summary}\nSee docs/agents/component-qualification.md. Add exact evidence, or record a narrow reviewed exemption.`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`${summary} — populated/open axe evidence is exact for every tag or narrowly reviewed`);
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
