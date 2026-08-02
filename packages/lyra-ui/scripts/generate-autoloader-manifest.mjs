// Generates the autoloader's tag metadata and literal dynamic-import map from the authoritative
// component inventory. Keeping the import specifiers literal lets bundlers split one chunk per
// component while ordinary granular imports remain unaffected.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));

function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid autoloader inventory: ${message}`);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function exportedClassName(packageDir, component) {
  const classPath = join(packageDir, component.classModule);
  invariant(existsSync(classPath), `${component.tag}: classModule does not exist: ${component.classModule}`);
  const source = readFileSync(classPath, 'utf8');
  const names = [...source.matchAll(/\bexport\s+class\s+([A-Za-z_$][\w$]*)/g)].map((match) => match[1]);
  invariant(names.length === 1, `${component.tag}: classModule must export exactly one class declaration`);
  return names[0];
}

function validateRegistration(packageDir, component, className) {
  const registrationPath = join(packageDir, component.registrationModule);
  invariant(
    existsSync(registrationPath),
    `${component.tag}: registrationModule does not exist: ${component.registrationModule}`,
  );
  const source = readFileSync(registrationPath, 'utf8');
  const localName = component.tag.slice('lr-'.length);
  const call = new RegExp(
    `\\bdefineElement\\(\\s*['"]${escapeRegExp(localName)}['"]\\s*,\\s*${escapeRegExp(className)}\\s*\\)`,
  );
  invariant(
    call.test(source),
    `${component.tag}: registrationModule must register ${className} with defineElement('${localName}', ...)`,
  );
}

function classSpecifier(classModule) {
  return `../${classModule.slice('src/'.length).replace(/\.ts$/, '.js')}`;
}

export function deriveAutoloaderManifest(inventory, packageDir = defaultPackageDir) {
  invariant(inventory?.schemaVersion === 1, 'schemaVersion must be 1');
  invariant(Array.isArray(inventory.components), 'components must be an array');

  const seenTags = new Set();
  const seenClassModules = new Set();
  const seenRegistrationModules = new Set();
  const entries = [];

  for (const component of inventory.components) {
    invariant(
      typeof component?.tag === 'string' && /^lr-[a-z][a-z0-9-]*$/.test(component.tag),
      'every component needs a valid lr-* tag',
    );
    invariant(!seenTags.has(component.tag), `duplicate tag ${component.tag}`);
    seenTags.add(component.tag);
    invariant(
      typeof component.classModule === 'string' &&
        /^src\/components\/[a-z0-9-/]+\.class\.ts$/.test(component.classModule),
      `${component.tag}: invalid classModule`,
    );
    invariant(!seenClassModules.has(component.classModule), `duplicate classModule ${component.classModule}`);
    seenClassModules.add(component.classModule);
    invariant(
      typeof component.registrationModule === 'string' &&
        /^src\/components\/[a-z0-9-/]+\.ts$/.test(component.registrationModule),
      `${component.tag}: invalid registrationModule`,
    );
    invariant(
      !seenRegistrationModules.has(component.registrationModule),
      `duplicate registrationModule ${component.registrationModule}`,
    );
    seenRegistrationModules.add(component.registrationModule);
    invariant(Array.isArray(component.optionalPeers), `${component.tag}: optionalPeers must be an array`);
    invariant(
      component.optionalPeers.every(
        (peer) => typeof peer === 'string' && peer.length > 0 && peer === peer.trim(),
      ),
      `${component.tag}: optionalPeers must contain non-empty package names`,
    );
    invariant(
      new Set(component.optionalPeers).size === component.optionalPeers.length,
      `${component.tag}: optionalPeers contains duplicates`,
    );

    const className = exportedClassName(packageDir, component);
    validateRegistration(packageDir, component, className);
    entries.push({
      tag: component.tag,
      className,
      classModule: component.classModule,
      specifier: classSpecifier(component.classModule),
      optionalPeers: [...component.optionalPeers].sort(),
    });
  }

  entries.sort((left, right) => left.tag.localeCompare(right.tag));
  return entries;
}

function renderStringArray(values) {
  if (values.length === 0) return '[]';
  return `[${values.map((value) => `'${value}'`).join(', ')}]`;
}

export function renderAutoloaderTags(entries) {
  return [
    '// Generated from scripts/fixtures/component-inventory.json by generate-autoloader-manifest.mjs.',
    '// Do not edit by hand.',
    '',
    'export const AUTOLOADER_TAGS = [',
    ...entries.map((entry) => `  '${entry.tag}',`),
    '] as const;',
    '',
    'export type AutoloadableTagName = (typeof AUTOLOADER_TAGS)[number];',
    '',
    'export const AUTOLOADER_TAG_SET: ReadonlySet<string> = new Set(AUTOLOADER_TAGS);',
    '',
  ].join('\n');
}

export function renderAutoloaderManifest(entries) {
  return [
    '// Generated from scripts/fixtures/component-inventory.json by generate-autoloader-manifest.mjs.',
    '// Literal imports are intentional: they preserve per-component code splitting. Do not edit by hand.',
    '',
    "import type { AutoloadableTagName } from './autoloader-tags.js';",
    '',
    'export interface AutoloaderManifestEntry {',
    '  readonly optionalPeers: readonly string[];',
    '  readonly load: () => Promise<CustomElementConstructor>;',
    '}',
    '',
    'export const AUTOLOADER_MANIFEST: Readonly<Record<AutoloadableTagName, AutoloaderManifestEntry>> = {',
    ...entries.flatMap((entry) => [
      `  '${entry.tag}': {`,
      `    optionalPeers: ${renderStringArray(entry.optionalPeers)},`,
      `    load: () => import('${entry.specifier}').then((module) => module.${entry.className}),`,
      '  },',
    ]),
    '};',
    '',
  ].join('\n');
}

function artifactPaths(packageDir) {
  return {
    inventory: join(packageDir, 'scripts', 'fixtures', 'component-inventory.json'),
    tags: join(packageDir, 'src', 'internal', 'autoloader-tags.ts'),
    manifest: join(packageDir, 'src', 'internal', 'autoloader-manifest.ts'),
  };
}

function expectedArtifacts(packageDir) {
  const paths = artifactPaths(packageDir);
  const inventory = JSON.parse(readFileSync(paths.inventory, 'utf8'));
  const entries = deriveAutoloaderManifest(inventory, packageDir);
  return {
    paths,
    entries,
    tags: renderAutoloaderTags(entries),
    manifest: renderAutoloaderManifest(entries),
  };
}

export function checkAutoloaderManifest(packageDir = defaultPackageDir) {
  const expected = expectedArtifacts(packageDir);
  const findings = [];
  if (!existsSync(expected.paths.tags) || readFileSync(expected.paths.tags, 'utf8') !== expected.tags) {
    findings.push('src/internal/autoloader-tags.ts is stale');
  }
  if (!existsSync(expected.paths.manifest) || readFileSync(expected.paths.manifest, 'utf8') !== expected.manifest) {
    findings.push('src/internal/autoloader-manifest.ts is stale');
  }
  return { findings, ...expected };
}

export function generateAutoloaderManifest(packageDir = defaultPackageDir) {
  const expected = expectedArtifacts(packageDir);
  writeFileSync(expected.paths.tags, expected.tags);
  writeFileSync(expected.paths.manifest, expected.manifest);
  return expected.entries;
}

function run(argv) {
  const unknown = argv.filter((argument) => argument !== '--check');
  if (unknown.length > 0) {
    console.error(`Unknown option(s): ${unknown.join(', ')}`);
    return 1;
  }
  if (argv.includes('--check')) {
    const result = checkAutoloaderManifest();
    if (result.findings.length > 0) {
      console.error(`${result.findings.join('\n')}\nRun \`pnpm autoloader-manifest\` and commit the generated files.`);
      return 1;
    }
    console.log(`Autoloader manifest is current: ${result.entries.length} tags.`);
    return 0;
  }
  const entries = generateAutoloaderManifest();
  console.log(`Autoloader manifest generated: ${entries.length} tags.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}
