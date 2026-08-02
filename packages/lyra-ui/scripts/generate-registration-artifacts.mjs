// Generates the root component-registration imports, the root-registration allowlist, and
// package.json#sideEffects from the authoritative component inventory. The named exports below
// the generated block in src/lyra.ts remain curated by hand.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSideEffects, generateSideEffects } from './generate-side-effects.mjs';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));
const ROOT_EXPORTS_SENTINEL = '// …and the barrel re-exports classes, helpers, and types.';
const LEGACY_ROOT_IMPORTS_HEADER = '// Side-effect imports register every component…';

export const ROOT_REGISTRATION_START = '// <generated:root-component-registrations>';
export const ROOT_REGISTRATION_END = '// </generated:root-component-registrations>';

function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid component registration inventory: ${message}`);
}

function registrationSpecifier(registrationModule) {
  return `./${registrationModule.slice('src/'.length).replace(/\.ts$/, '.js')}`;
}

export function deriveRegistrationArtifacts(inventory) {
  invariant(inventory?.schemaVersion === 1, 'schemaVersion must be 1');
  invariant(Array.isArray(inventory.components), 'components must be an array');

  const seenTags = new Set();
  const seenModules = new Set();
  const rootComponents = [];
  const optionalTags = [];

  for (const component of inventory.components) {
    invariant(
      typeof component?.tag === 'string' && /^lr-[a-z][a-z0-9-]*$/.test(component.tag),
      'every component needs a valid lr-* tag',
    );
    invariant(!seenTags.has(component.tag), `duplicate tag ${component.tag}`);
    seenTags.add(component.tag);
    invariant(
      typeof component.registrationModule === 'string' &&
        /^src\/components\/[a-z0-9-/]+\.ts$/.test(component.registrationModule),
      `${component.tag}: invalid registrationModule`,
    );
    invariant(
      !seenModules.has(component.registrationModule),
      `duplicate registrationModule ${component.registrationModule}`,
    );
    seenModules.add(component.registrationModule);
    invariant(
      typeof component.rootIncluded === 'boolean',
      `${component.tag}: rootIncluded must be a boolean`,
    );
    invariant(Array.isArray(component.optionalPeers), `${component.tag}: optionalPeers must be an array`);

    if (component.rootIncluded) {
      invariant(component.rootExclusion === null, `${component.tag}: included component cannot have rootExclusion`);
      rootComponents.push({
        tag: component.tag,
        registrationModule: component.registrationModule,
        specifier: registrationSpecifier(component.registrationModule),
      });
    } else {
      invariant(
        component.rootExclusion === 'optional-peer-family',
        `${component.tag}: unsupported rootExclusion ${String(component.rootExclusion)}`,
      );
      invariant(
        component.optionalPeers.length > 0,
        `${component.tag}: optional-peer-family exclusion must name at least one peer`,
      );
      optionalTags.push(component.tag);
    }
  }

  rootComponents.sort((left, right) => left.tag.localeCompare(right.tag));
  optionalTags.sort();
  return {
    rootComponents,
    rootTags: rootComponents.map((component) => component.tag),
    optionalTags,
  };
}

export function renderRootRegistrationBlock(artifacts) {
  return [
    ROOT_REGISTRATION_START,
    '// Generated from scripts/fixtures/component-inventory.json. Run `pnpm registrations` to refresh.',
    '// Side-effect imports register every component whose inventory row is rootIncluded.',
    ...artifacts.rootComponents.map((component) => `import '${component.specifier}';`),
    ROOT_REGISTRATION_END,
    '',
  ].join('\n');
}

function markerRange(source) {
  const start = source.indexOf(ROOT_REGISTRATION_START);
  const end = source.indexOf(ROOT_REGISTRATION_END);
  if (start < 0 && end < 0) return null;
  invariant(start >= 0 && end > start, 'src/lyra.ts has an incomplete generated registration block');
  invariant(
    source.indexOf(ROOT_REGISTRATION_START, start + ROOT_REGISTRATION_START.length) < 0 &&
      source.indexOf(ROOT_REGISTRATION_END, end + ROOT_REGISTRATION_END.length) < 0,
    'src/lyra.ts has duplicate generated registration markers',
  );
  const lineEnd = source.indexOf('\n', end + ROOT_REGISTRATION_END.length);
  return { start, end: lineEnd < 0 ? source.length : lineEnd + 1 };
}

function legacyCompanionBlock(source, start, end, artifacts) {
  const legacyBlock = source.slice(start, end);
  const expected = new Set(artifacts.rootComponents.map((component) => component.specifier));
  const imports = [...legacyBlock.matchAll(/^import '([^']+)';$/gm)].map((match) => match[1]);
  const companions = [...new Set(imports.filter((specifier) => /-register\.js$/.test(specifier)))].sort();
  const unknown = [...new Set(imports.filter((specifier) => !expected.has(specifier) && !companions.includes(specifier)))];
  invariant(
    unknown.length === 0,
    `legacy src/lyra.ts import block contains non-inventory module(s): ${unknown.join(', ')}`,
  );
  if (companions.length === 0) return '';
  return [
    '// Curated companion registrations have no custom-element inventory row.',
    ...companions.map((specifier) => `import '${specifier}';`),
    '',
  ].join('\n');
}

export function updateRootBarrel(source, artifacts) {
  const generated = renderRootRegistrationBlock(artifacts);
  const range = markerRange(source);
  if (range) return source.slice(0, range.start) + generated + source.slice(range.end);

  const start = source.indexOf(LEGACY_ROOT_IMPORTS_HEADER);
  const exportsStart = source.indexOf(ROOT_EXPORTS_SENTINEL);
  invariant(start >= 0, 'src/lyra.ts is missing the legacy registration header and generated markers');
  invariant(exportsStart > start, 'src/lyra.ts is missing the curated-export sentinel');
  const companions = legacyCompanionBlock(source, start, exportsStart, artifacts);
  return source.slice(0, start) + generated + companions + source.slice(exportsStart);
}

function renderTagArray(name, tags) {
  return [
    `export const ${name} = [`,
    ...tags.map((tag) => `  '${tag}',`),
    '] as const;',
  ].join('\n');
}

export function renderRootRegistrationAllowlist(artifacts) {
  return [
    '/**',
    ' * Generated from the authoritative component inventory. Root-excluded optional-peer families',
    ' * stay separate so importing the all-components barrel cannot load their eager dependencies.',
    ' * Run `pnpm registrations` after changing registration metadata; do not edit these arrays.',
    ' */',
    renderTagArray('ROOT_BARREL_TAGS', artifacts.rootTags),
    '',
    renderTagArray('ROOT_BARREL_OPTIONAL_PEER_TAGS', artifacts.optionalTags),
    '',
  ].join('\n');
}

function artifactPaths(packageDir) {
  return {
    inventory: join(packageDir, 'scripts', 'fixtures', 'component-inventory.json'),
    rootBarrel: join(packageDir, 'src', 'lyra.ts'),
    allowlist: join(packageDir, 'src', 'internal', 'root-registration-allowlist.ts'),
    packageJson: join(packageDir, 'package.json'),
  };
}

function expectedArtifacts(packageDir) {
  const paths = artifactPaths(packageDir);
  const inventory = JSON.parse(readFileSync(paths.inventory, 'utf8'));
  const artifacts = deriveRegistrationArtifacts(inventory);
  return {
    paths,
    rootBarrel: updateRootBarrel(readFileSync(paths.rootBarrel, 'utf8'), artifacts),
    allowlist: renderRootRegistrationAllowlist(artifacts),
    sideEffects: deriveSideEffects(packageDir),
    artifacts,
  };
}

export function checkRegistrationArtifacts(packageDir = defaultPackageDir) {
  const expected = expectedArtifacts(packageDir);
  const findings = [];
  if (readFileSync(expected.paths.rootBarrel, 'utf8') !== expected.rootBarrel) {
    findings.push('src/lyra.ts generated registration block is stale');
  }
  if (!existsSync(expected.paths.allowlist) || readFileSync(expected.paths.allowlist, 'utf8') !== expected.allowlist) {
    findings.push('src/internal/root-registration-allowlist.ts is stale');
  }
  const pkg = JSON.parse(readFileSync(expected.paths.packageJson, 'utf8'));
  if (JSON.stringify(pkg.sideEffects) !== JSON.stringify(expected.sideEffects)) {
    findings.push('package.json#sideEffects is stale');
  }
  return { findings, ...expected };
}

export function generateRegistrationArtifacts(packageDir = defaultPackageDir) {
  const expected = expectedArtifacts(packageDir);
  writeFileSync(expected.paths.rootBarrel, expected.rootBarrel);
  writeFileSync(expected.paths.allowlist, expected.allowlist);
  generateSideEffects(packageDir);
  return expected.artifacts;
}

function run(argv) {
  const unknown = argv.filter((argument) => argument !== '--check');
  if (unknown.length > 0) {
    console.error(`Unknown option(s): ${unknown.join(', ')}`);
    return 1;
  }
  if (argv.includes('--check')) {
    const result = checkRegistrationArtifacts();
    if (result.findings.length > 0) {
      console.error(`${result.findings.join('\n')}\nRun \`pnpm registrations\` and commit the generated changes.`);
      return 1;
    }
    console.log(
      `registration artifacts are current: ${result.artifacts.rootTags.length} root + ` +
        `${result.artifacts.optionalTags.length} optional-peer tags`,
    );
    return 0;
  }

  const artifacts = generateRegistrationArtifacts();
  console.log(
    `registration artifacts regenerated: ${artifacts.rootTags.length} root + ` +
      `${artifacts.optionalTags.length} optional-peer tags`,
  );
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}
