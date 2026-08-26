import { isMainModule } from './is-main-module.mjs';

// Generates the component-registration imports for the two compatibility entries
// (`src/all.ts`, `src/ssr/all.ts`), the root-registration allowlist, and package.json#sideEffects
// from the authoritative component inventory. The package root (`src/lyra.ts`) is deliberately
// registration-free and is not written by this script: its named exports stay curated by hand.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveSideEffects, generateSideEffects } from './generate-side-effects.mjs';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));

export const ALL_REGISTRATION_START = '// <generated:all-component-registrations>';
export const ALL_REGISTRATION_END = '// </generated:all-component-registrations>';
export const SSR_ALL_REGISTRATION_START = '// <generated:ssr-all-component-registrations>';
export const SSR_ALL_REGISTRATION_END = '// </generated:ssr-all-component-registrations>';

function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid component registration inventory: ${message}`);
}

function registrationSpecifier(registrationModule, prefix) {
  return `${prefix}${registrationModule.slice('src/'.length).replace(/\.ts$/, '.js')}`;
}

export function deriveRegistrationArtifacts(inventory) {
  invariant(inventory?.schemaVersion === 1, 'schemaVersion must be 1');
  invariant(Array.isArray(inventory.components), 'components must be an array');

  const seenTags = new Set();
  const seenModules = new Set();
  const rootComponents = [];
  const allComponents = [];
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

    const entry = {
      tag: component.tag,
      registrationModule: component.registrationModule,
      specifier: registrationSpecifier(component.registrationModule, './'),
      ssrSpecifier: registrationSpecifier(component.registrationModule, '../'),
    };
    allComponents.push(entry);

    if (component.rootIncluded) {
      invariant(component.rootExclusion === null, `${component.tag}: included component cannot have rootExclusion`);
      rootComponents.push(entry);
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

  const byTag = (left, right) => left.tag.localeCompare(right.tag);
  rootComponents.sort(byTag);
  allComponents.sort(byTag);
  optionalTags.sort();
  return {
    rootComponents,
    allComponents,
    rootTags: rootComponents.map((component) => component.tag),
    allTags: allComponents.map((component) => component.tag),
    optionalTags,
  };
}

export function renderAllRegistrationBlock(artifacts) {
  return [
    ALL_REGISTRATION_START,
    '// Generated from scripts/fixtures/component-inventory.json. Run `pnpm registrations` to refresh.',
    '// The compatibility entry registers every root-included component; optional-peer families remain',
    '// granular so importing all.js preserves the package\'s optional-peer isolation contract.',
    ...artifacts.rootComponents.map((component) => `import '${component.specifier}';`),
    ALL_REGISTRATION_END,
    '',
  ].join('\n');
}

export function renderSsrAllRegistrationBlock(artifacts) {
  return [
    SSR_ALL_REGISTRATION_START,
    '// Generated from scripts/fixtures/component-inventory.json. Run `pnpm registrations` to refresh.',
    '// The server-only convenience entry registers the complete inventory, including components whose',
    '// optional-peer families are intentionally excluded from the browser all.js compatibility entry.',
    ...artifacts.allComponents.map((component) => `import '${component.ssrSpecifier}';`),
    SSR_ALL_REGISTRATION_END,
    '',
  ].join('\n');
}

function markerRange(source, label, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  invariant(
    start >= 0 && end > start,
    `${label} is missing its generated registration block; restore the ` +
      `\`${startMarker}\` … \`${endMarker}\` marker pair and rerun \`pnpm registrations\``,
  );
  invariant(
    source.indexOf(startMarker, start + startMarker.length) < 0 &&
      source.indexOf(endMarker, end + endMarker.length) < 0,
    `${label} has duplicate generated registration markers`,
  );
  const lineEnd = source.indexOf('\n', end + endMarker.length);
  return { start, end: lineEnd < 0 ? source.length : lineEnd + 1 };
}

/**
 * Bare side-effect imports outside the generated block are curated companion registrations
 * (`*-register.js`, which register a document-viewer renderer rather than a custom element and so
 * have no inventory row). Anything else outside the block would be silently stranded by the next
 * regeneration, so it fails closed here instead.
 */
function assertCuratedOutsideImports(source, range, label) {
  const outside = source.slice(0, range.start) + source.slice(range.end);
  const unknown = [...outside.matchAll(/^import '([^']+)';$/gm)]
    .map((match) => match[1])
    .filter((specifier) => !/-register\.js$/.test(specifier));
  invariant(
    unknown.length === 0,
    `${label} has non-inventory side-effect import(s) outside the generated block: ${unknown.join(', ')}`,
  );
}

function updateBarrel(source, generated, label, startMarker, endMarker) {
  const range = markerRange(source, label, startMarker, endMarker);
  assertCuratedOutsideImports(source, range, label);
  return source.slice(0, range.start) + generated + source.slice(range.end);
}

export function updateAllBarrel(source, artifacts) {
  return updateBarrel(
    source,
    renderAllRegistrationBlock(artifacts),
    'src/all.ts',
    ALL_REGISTRATION_START,
    ALL_REGISTRATION_END,
  );
}

export function updateSsrAllBarrel(source, artifacts) {
  return updateBarrel(
    source,
    renderSsrAllRegistrationBlock(artifacts),
    'src/ssr/all.ts',
    SSR_ALL_REGISTRATION_START,
    SSR_ALL_REGISTRATION_END,
  );
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
    allBarrel: join(packageDir, 'src', 'all.ts'),
    ssrAllBarrel: join(packageDir, 'src', 'ssr', 'all.ts'),
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
    allBarrel: updateAllBarrel(readFileSync(paths.allBarrel, 'utf8'), artifacts),
    ssrAllBarrel: updateSsrAllBarrel(readFileSync(paths.ssrAllBarrel, 'utf8'), artifacts),
    allowlist: renderRootRegistrationAllowlist(artifacts),
    sideEffects: deriveSideEffects(packageDir),
    artifacts,
  };
}

export function checkRegistrationArtifacts(packageDir = defaultPackageDir) {
  const expected = expectedArtifacts(packageDir);
  const findings = [];
  if (readFileSync(expected.paths.allBarrel, 'utf8') !== expected.allBarrel) {
    findings.push('src/all.ts generated registration block is stale');
  }
  if (readFileSync(expected.paths.ssrAllBarrel, 'utf8') !== expected.ssrAllBarrel) {
    findings.push('src/ssr/all.ts generated registration block is stale');
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
  writeFileSync(expected.paths.allBarrel, expected.allBarrel);
  writeFileSync(expected.paths.ssrAllBarrel, expected.ssrAllBarrel);
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
      `registration artifacts are current: ${result.artifacts.rootTags.length} all.js + ` +
        `${result.artifacts.allTags.length} ssr/all.js tags ` +
        `(${result.artifacts.optionalTags.length} optional-peer)`,
    );
    return 0;
  }

  const artifacts = generateRegistrationArtifacts();
  console.log(
    `registration artifacts regenerated: ${artifacts.rootTags.length} all.js + ` +
      `${artifacts.allTags.length} ssr/all.js tags (${artifacts.optionalTags.length} optional-peer)`,
  );
  return 0;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}
