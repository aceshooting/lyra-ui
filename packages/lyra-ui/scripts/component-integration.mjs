import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { analyzeComponentDependencies, collectSources } from './check-component-dependencies.mjs';

const COMPONENT_INTEGRATION_SCHEMA_VERSION = 1;

function packageImport(module) {
  return `@aceshooting/lyra-ui/${module.replace(/^src\//, '').replace(/\.ts$/, '.js')}`;
}

function distEntry(packageDir, module) {
  return path.join(packageDir, module.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js'));
}

function esbuildForPackage(packageDir) {
  const requireFromPackage = createRequire(path.join(packageDir, 'package.json'));
  const requireFromLoaderHost = createRequire(requireFromPackage.resolve('@web/dev-server-esbuild'));
  return requireFromLoaderHost('esbuild');
}

function optionalPeerExternals(packageJson) {
  return Object.keys(packageJson.peerDependencies ?? {})
    .filter((name) => packageJson.peerDependenciesMeta?.[name]?.optional === true)
    .flatMap((name) => [name, `${name}/*`]);
}

async function measureOne({ component, packageDir, esbuild, external }) {
  const entry = distEntry(packageDir, component.registrationModule);
  if (!fs.existsSync(entry)) {
    return {
      status: 'not-measured',
      bytes: null,
      kib: null,
      bundleSha256: null,
      limitation: 'Built registration entry is absent; run pnpm build before the measured quality generation pass.',
    };
  }
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'esm',
    minify: true,
    write: false,
    external,
    absWorkingDir: packageDir,
    logLevel: 'silent',
  });
  const contents = result.outputFiles[0].contents;
  const bytes = gzipSync(contents, { level: 9 }).length;
  return {
    status: 'measured',
    bytes,
    kib: Number((bytes / 1024).toFixed(1)),
    bundleSha256: createHash('sha256').update(contents).digest('hex'),
    limitation: 'Self-contained standalone entry; shared Lit/Lyra layers are counted again for every component and optional peers are externalized.',
  };
}

function isValidMeasuredGzipEvidence(evidence) {
  return evidence?.status === 'measured' &&
    Number.isInteger(evidence.bytes) &&
    evidence.bytes > 0 &&
    evidence.kib === Number((evidence.bytes / 1024).toFixed(1)) &&
    /^[0-9a-f]{64}$/.test(evidence.bundleSha256 ?? '');
}

/**
 * Keeps gzip evidence stable across Node builds that emit byte-identical bundles but link a
 * different zlib patch. The uncompressed bundle digest remains the fail-closed authority: any
 * emitted-byte change adopts the live measurement and therefore makes the generated ledger stale.
 */
export function canonicalizeGzipEvidence(measured, previous) {
  if (
    isValidMeasuredGzipEvidence(measured) &&
    isValidMeasuredGzipEvidence(previous) &&
    measured.bundleSha256 === previous.bundleSha256
  ) {
    return { ...measured, bytes: previous.bytes, kib: previous.kib };
  }
  return measured;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export function componentDependencyGraph({ packageDir, inventory }) {
  const files = collectSources(path.join(packageDir, 'src'), new Map());
  const components = inventory.components.map(({ tag, classModule, registrationModule }) => ({
    tag,
    classModule,
    registrationModule,
  }));
  return analyzeComponentDependencies({ components, files });
}

export async function buildComponentIntegration({
  packageDir,
  inventory,
  packageJson,
  previous = null,
  measureGzip = false,
  graph: suppliedGraph,
}) {
  const analysis = suppliedGraph ?? componentDependencyGraph({ packageDir, inventory });
  if (analysis.findings.length > 0) throw new Error(analysis.findings.join('\n'));
  const graphByTag = new Map(analysis.graph.map((entry) => [entry.tag, entry]));
  const previousByTag = new Map((previous?.components ?? []).map((entry) => [entry.tag, entry]));
  let measured = new Map();
  if (measureGzip) {
    const esbuild = esbuildForPackage(packageDir);
    const external = optionalPeerExternals(packageJson);
    const values = await mapLimit(inventory.components, 8, (component) =>
      measureOne({ component, packageDir, esbuild, external }));
    measured = new Map(inventory.components.map((component, index) => [component.tag, values[index]]));
  }

  const components = inventory.components.map((component) => {
    const graph = graphByTag.get(component.tag);
    const previousGzip = previousByTag.get(component.tag)?.gzip;
    const liveGzip = measured.get(component.tag);
    const gzip = liveGzip
      ? canonicalizeGzipEvidence(liveGzip, previousGzip)
      : previousGzip ?? {
      status: 'not-measured',
      bytes: null,
      kib: null,
      bundleSha256: null,
      limitation: 'Per-tag gzip data has not been generated from built dist output.',
      };
    return {
      tag: component.tag,
      family: component.family,
      imports: {
        registration: packageImport(component.registrationModule),
        class: packageImport(component.classModule),
      },
      peers: [...(component.optionalPeers ?? [])].sort(),
      dependencies: {
        direct: [...(graph?.directComponents ?? [])],
        transitive: [...(graph?.transitiveComponents ?? [])],
      },
      gzip,
    };
  }).sort((a, b) => a.tag.localeCompare(b.tag));

  const measuredComponents = components.filter((component) => component.gzip.status === 'measured');
  return {
    $comment: 'Generated integration cards for every public tag. Dependency edges are component-registration edges; gzip is a standalone bundled registration import with optional peers externalized.',
    schemaVersion: COMPONENT_INTEGRATION_SCHEMA_VERSION,
    methodology: {
      dependencies: 'Direct edges are exact rendered-component or direct registration imports; transitive edges are the remaining reachable registrations.',
      gzip: 'esbuild bundle=true format=esm minify=true, then gzip level 9; optional peer packages and subpaths externalized. A byte-identical bundle SHA-256 retains its canonical gzip count across zlib patch versions.',
    },
    summary: {
      componentCount: components.length,
      measuredGzipCount: measuredComponents.length,
      missingGzipCount: components.length - measuredComponents.length,
      averageGzipKib: measuredComponents.length > 0
        ? Number((measuredComponents.reduce((sum, component) => sum + component.gzip.bytes, 0) / measuredComponents.length / 1024).toFixed(1))
        : null,
    },
    components,
  };
}

export function validateComponentIntegration(ledger, inventory, analysis) {
  const findings = [];
  if (ledger?.schemaVersion !== COMPONENT_INTEGRATION_SCHEMA_VERSION) findings.push('unsupported component integration schema');
  const components = Array.isArray(ledger?.components) ? ledger.components : [];
  const expectedTags = inventory.components.map((component) => component.tag).sort();
  const actualTags = components.map((component) => component.tag).sort();
  if (JSON.stringify(actualTags) !== JSON.stringify(expectedTags)) findings.push('component integration tags do not exactly match inventory');
  const inventoryByTag = new Map(inventory.components.map((component) => [component.tag, component]));
  const graphByTag = new Map((analysis?.graph ?? []).map((entry) => [entry.tag, entry]));
  for (const component of components) {
    const inventoryEntry = inventoryByTag.get(component.tag);
    if (!inventoryEntry) continue;
    const expectedRegistration = packageImport(inventoryEntry.registrationModule);
    const expectedClass = packageImport(inventoryEntry.classModule);
    if (component.imports?.registration !== expectedRegistration) findings.push(`${component.tag}: stale registration import`);
    if (component.imports?.class !== expectedClass) findings.push(`${component.tag}: stale class import`);
    if (JSON.stringify(component.peers) !== JSON.stringify([...(inventoryEntry.optionalPeers ?? [])].sort())) findings.push(`${component.tag}: stale peer list`);
    const graph = graphByTag.get(component.tag);
    if (graph && JSON.stringify(component.dependencies?.direct) !== JSON.stringify(graph.directComponents)) findings.push(`${component.tag}: stale direct dependencies`);
    if (graph && JSON.stringify(component.dependencies?.transitive) !== JSON.stringify(graph.transitiveComponents)) findings.push(`${component.tag}: stale transitive dependencies`);
    if (!['measured', 'not-measured'].includes(component.gzip?.status)) findings.push(`${component.tag}: invalid gzip status`);
    if (component.gzip?.status === 'measured') {
      const expectedKib = Number((component.gzip.bytes / 1024).toFixed(1));
      if (
        !Number.isInteger(component.gzip.bytes) ||
        component.gzip.bytes <= 0 ||
        component.gzip.kib !== expectedKib ||
        !/^[0-9a-f]{64}$/.test(component.gzip.bundleSha256 ?? '')
      ) {
        findings.push(`${component.tag}: invalid measured gzip evidence`);
      }
    } else if (
      component.gzip?.status === 'not-measured' &&
      [component.gzip.bytes, component.gzip.kib, component.gzip.bundleSha256].some((value) => value !== null)
    ) {
      findings.push(`${component.tag}: not-measured gzip evidence must use null bytes, KiB, and digest`);
    }
  }
  const measured = components.filter((component) => component.gzip?.status === 'measured');
  const expectedSummary = {
    componentCount: components.length,
    measuredGzipCount: measured.length,
    missingGzipCount: components.length - measured.length,
    averageGzipKib: measured.length > 0
      ? Number((measured.reduce((sum, component) => sum + component.gzip.bytes, 0) / measured.length / 1024).toFixed(1))
      : null,
  };
  if (JSON.stringify(ledger?.summary) !== JSON.stringify(expectedSummary)) {
    findings.push('stale integration summary');
  }
  return findings;
}

export function renderIntegrationCards(ledger) {
  const lines = [
    '<!-- GENERATED by scripts/generate-component-quality.mjs — do not edit. -->',
    '',
    '# Component integration cards',
    '',
    'Every public tag has one card covering its stable registration and class imports, optional peers,',
    'direct and transitive Lyra component dependencies, and standalone gzip measurement. “None” is an',
    'actual empty set; “not measured” is an explicit evidence gap, not a zero-byte claim.',
    '',
    `Coverage: **${ledger.summary.componentCount} tags**, **${ledger.summary.measuredGzipCount} measured gzip entries**, ` +
      `**${ledger.summary.missingGzipCount} not measured**.`,
    '',
    'Dependency meaning: direct edges are tags rendered by this component or registration entries it',
    'imports directly. Transitive edges are other registrations reachable through those direct edges.',
    '',
  ];
  for (const component of ledger.components) {
    const list = (values) => values.length > 0 ? values.map((value) => `\`${value}\``).join(', ') : 'none';
    const gzip = component.gzip.status === 'measured'
      ? `${component.gzip.kib} KiB (${component.gzip.bytes} bytes; bundle SHA-256 \`${component.gzip.bundleSha256}\`)`
      : `not measured — ${component.gzip.limitation}`;
    lines.push(
      `<details id="${component.tag}">`,
      `<summary><code>${component.tag}</code> — ${component.family}</summary>`,
      '',
      `- Registration import: \`import '${component.imports.registration}';\``,
      `- Side-effect-free class import: \`import { … } from '${component.imports.class}';\``,
      `- Optional peers: ${list(component.peers)}`,
      `- Direct Lyra dependencies: ${list(component.dependencies.direct)}`,
      `- Transitive Lyra dependencies: ${list(component.dependencies.transitive)}`,
      `- Standalone gzip: ${gzip}`,
      '',
      '</details>',
      '',
    );
  }
  return `${lines.join('\n').trimEnd()}\n`;
}
