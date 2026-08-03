#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildComponentIntegration,
  componentDependencyGraph,
  renderIntegrationCards,
  validateComponentIntegration,
} from './component-integration.mjs';
import {
  buildQualificationLedger,
  renderQualificationDashboard,
  validateQualificationLedger,
  validateVisualQualificationManifest,
} from './qualification-ledger.mjs';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.dirname(scriptsDir);
const repoRoot = path.resolve(packageDir, '..', '..');

export const QUALITY_PATHS = Object.freeze({
  inventory: path.join(scriptsDir, 'fixtures', 'component-inventory.json'),
  qualification: path.join(scriptsDir, 'fixtures', 'component-qualification.json'),
  integration: path.join(scriptsDir, 'fixtures', 'component-integration.json'),
  exemptions: path.join(scriptsDir, 'qualification-exemptions.json'),
  visual: path.join(packageDir, 'visual-baselines', 'manifest.json'),
  ssr: path.join(packageDir, 'src', 'ssr.ts'),
  packageJson: path.join(packageDir, 'package.json'),
  qualityDocs: path.join(repoRoot, 'docs', 'component-quality.md'),
  integrationDocs: path.join(repoRoot, 'docs', 'component-integration.md'),
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readOptionalJson(file) {
  return fs.existsSync(file) ? readJson(file) : null;
}

function serializeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function qualificationMetadata(record) {
  return {
    status: record?.qualification?.status ?? 'pending-generation',
    humanReview: record?.qualification?.humanReview ?? 'pending',
    reviewer: record?.qualification?.reviewer ?? null,
    reviewedAt: record?.qualification?.reviewedAt ?? null,
    accessibility: record?.dimensions?.accessibility?.status ?? 'not-recorded',
    ledger: 'scripts/fixtures/component-qualification.json',
  };
}

function dependencyMetadata(record) {
  return {
    direct: [...(record?.dependencies?.direct ?? [])],
    transitive: [...(record?.dependencies?.transitive ?? [])],
    ledger: 'scripts/fixtures/component-integration.json',
  };
}

/** Adds compact, orthogonal pointers while retaining the detailed evidence in dedicated ledgers. */
export function projectQualityMetadata(inventory, qualification, integration) {
  const qualificationByTag = new Map((qualification?.components ?? []).map((entry) => [entry.tag, entry]));
  const integrationByTag = new Map((integration?.components ?? []).map((entry) => [entry.tag, entry]));
  return {
    ...inventory,
    components: inventory.components.map((component) => ({
      ...component,
      qualification: qualificationMetadata(qualificationByTag.get(component.tag)),
      dependencies: dependencyMetadata(integrationByTag.get(component.tag)),
    })),
  };
}

export async function buildQualityArtifacts({
  paths = QUALITY_PATHS,
  packageRoot = packageDir,
  measureGzip = false,
} = {}) {
  const inventory = readJson(paths.inventory);
  const exemptions = readJson(paths.exemptions);
  const visualManifest = readOptionalJson(paths.visual);
  const packageJson = readJson(paths.packageJson);
  const previousIntegration = readOptionalJson(paths.integration);
  const ssrSource = fs.readFileSync(paths.ssr, 'utf8');
  if (inventory?.schemaVersion !== 1 || !Array.isArray(inventory.components)) {
    throw new Error('Component quality requires component inventory schemaVersion 1 with components[].');
  }
  if (!visualManifest) throw new Error('Component quality requires visual-baselines/manifest.json.');
  const visualFindings = validateVisualQualificationManifest(visualManifest, inventory);
  if (visualFindings.length > 0) throw new Error(`Visual qualification manifest failed:\n- ${visualFindings.join('\n- ')}`);
  const graph = componentDependencyGraph({ packageDir: packageRoot, inventory });
  if (graph.findings.length > 0) throw new Error(`Component dependency graph failed:\n- ${graph.findings.join('\n- ')}`);

  const qualification = buildQualificationLedger({
    packageDir: packageRoot,
    inventory,
    exemptions,
    visualManifest,
    ssrSource,
  });
  const integration = await buildComponentIntegration({
    packageDir: packageRoot,
    inventory,
    packageJson,
    previous: previousIntegration,
    measureGzip,
    graph,
  });
  const qualificationFindings = validateQualificationLedger(qualification, inventory);
  const integrationFindings = validateComponentIntegration(integration, inventory, graph);
  const findings = [...qualificationFindings, ...integrationFindings];
  if (findings.length > 0) throw new Error(`Component quality validation failed:\n- ${findings.join('\n- ')}`);

  const projectedInventory = projectQualityMetadata(inventory, qualification, integration);
  return {
    inventory: projectedInventory,
    qualification,
    integration,
    qualityDocs: renderQualificationDashboard(qualification),
    integrationDocs: renderIntegrationCards(integration),
  };
}

function expectedFiles(artifacts, paths) {
  return new Map([
    [paths.inventory, serializeJson(artifacts.inventory)],
    [paths.qualification, serializeJson(artifacts.qualification)],
    [paths.integration, serializeJson(artifacts.integration)],
    [paths.qualityDocs, artifacts.qualityDocs],
    [paths.integrationDocs, artifacts.integrationDocs],
  ]);
}

export function qualityArtifactFindings(artifacts, paths = QUALITY_PATHS) {
  const findings = [];
  for (const [file, expected] of expectedFiles(artifacts, paths)) {
    const actual = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (actual !== expected) findings.push(`${path.relative(repoRoot, file).replaceAll('\\', '/')}: stale or missing`);
  }
  return findings;
}

function parseArguments(argv) {
  const options = { check: argv.length === 0, write: false, measureGzip: false };
  for (const argument of argv) {
    if (argument === '--check') options.check = true;
    else if (argument === '--write') options.write = true;
    else if (argument === '--measure-gzip') options.measureGzip = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.check && options.write) throw new Error('--check and --write are mutually exclusive');
  if (!options.check && !options.write) options.check = true;
  return options;
}

export async function run(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const artifacts = await buildQualityArtifacts({ measureGzip: options.measureGzip });
  if (options.write) {
    for (const [file, contents] of expectedFiles(artifacts, QUALITY_PATHS)) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, contents);
    }
  } else {
    const findings = qualityArtifactFindings(artifacts);
    if (findings.length > 0) {
      throw new Error(`Component quality artifacts are stale:\n- ${findings.join('\n- ')}\nRun component-quality:generate after source artifacts stabilize.`);
    }
  }
  console.log(
    `Component quality covers ${artifacts.qualification.summary.componentCount} tags; ` +
      `${artifacts.integration.summary.measuredGzipCount} standalone gzip entries are measured.`,
  );
}

if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
