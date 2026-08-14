// Replaces the broad component/AI wildcard package exports with the exact supported public
// routes. Component registration/class entries and stable lr-* aliases come from the authoritative
// component inventory; the small helper list contains only deliberately documented public modules.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));

export const CURATED_COMPONENT_HELPER_MODULES = Object.freeze([
  'src/components/agent-tools/tool-result-view/registry.ts',
  'src/components/charts/chart/chart-colors.ts',
  'src/components/charts/chart/chart-preload.ts',
  'src/components/conversation/message-actions/toolbar-actions.ts',
  'src/components/conversation/widget-renderer/registry.ts',
  'src/components/media/attachment-chip/file-size.ts',
  'src/components/media/flag/flag-peer.ts',
  'src/components/media/flag/language-map.ts',
  'src/components/overlays/dialog/confirm.ts',
  'src/components/overlays/toast/toaster.ts',
  'src/components/utility/export-button/csv.ts',
  'src/components/utility/icon/icon-library.ts',
  'src/components/viewers/document-viewer/registry.ts',
]);

export const CURATED_UTILITY_MODULES = Object.freeze([
  'src/utilities/a11y.ts',
  'src/utilities/anchor-target.ts',
  'src/utilities/animation-registry.ts',
  'src/utilities/announcer.ts',
  'src/utilities/css-length.ts',
  'src/utilities/defined.ts',
  'src/utilities/form-associated.ts',
  'src/utilities/group-by-recency.ts',
  'src/utilities/icons.ts',
  'src/utilities/index.ts',
  'src/utilities/layered-layout.ts',
  'src/utilities/localization.ts',
  'src/utilities/lyra-element.ts',
  'src/utilities/overlay-manager.ts',
  'src/utilities/positioner.ts',
  'src/utilities/prefix.ts',
  'src/utilities/scroll-lock.ts',
  'src/utilities/theme.ts',
]);

function invariant(condition, message) {
  if (!condition) throw new Error(`Invalid explicit package export inventory: ${message}`);
}

function exportedModule(sourceModule) {
  invariant(
    /^src\/components\/[a-z0-9./-]+\.ts$/.test(sourceModule),
    `invalid component source module ${String(sourceModule)}`,
  );
  const relative = sourceModule.slice('src/'.length).replace(/\.ts$/, '.js');
  return [`./${relative}`, `./dist/${relative}`];
}

function assertSourceExists(packageDir, sourceModule) {
  if (!packageDir) return;
  invariant(existsSync(join(packageDir, sourceModule)), `public source module is missing: ${sourceModule}`);
}

function addRoute(routes, exportPath, target, owner) {
  const previous = routes.get(exportPath);
  invariant(!previous || previous.target === target, `${exportPath} is claimed by both ${previous?.owner} and ${owner}`);
  routes.set(exportPath, { target, owner });
}

export function deriveExplicitComponentExports(
  inventory,
  { packageDir, helperModules = CURATED_COMPONENT_HELPER_MODULES } = {},
) {
  invariant(inventory?.schemaVersion === 1, 'schemaVersion must be 1');
  invariant(Array.isArray(inventory.components), 'components must be an array');
  invariant(Array.isArray(helperModules), 'helperModules must be an array');

  const routes = new Map();
  const families = new Set();
  const tags = new Set();

  for (const component of inventory.components) {
    invariant(
      typeof component?.tag === 'string' && /^lr-[a-z][a-z0-9-]*$/.test(component.tag),
      'every component needs a valid lr-* tag',
    );
    invariant(!tags.has(component.tag), `duplicate tag ${component.tag}`);
    tags.add(component.tag);
    invariant(
      typeof component.family === 'string' && /^[a-z][a-z0-9-]*$/.test(component.family),
      `${component.tag}: invalid family`,
    );
    families.add(component.family);

    for (const [kind, sourceModule] of [
      ['class', component.classModule],
      ['registration', component.registrationModule],
    ]) {
      const [exportPath, target] = exportedModule(sourceModule);
      assertSourceExists(packageDir, sourceModule);
      addRoute(routes, exportPath, target, `${component.tag} ${kind} module`);
    }

    const aliasModule = `src/components/${component.tag}.ts`;
    assertSourceExists(packageDir, aliasModule);
    const [aliasExport, aliasTarget] = exportedModule(aliasModule);
    addRoute(routes, aliasExport, aliasTarget, `${component.tag} stable alias`);
  }

  for (const family of families) {
    const sourceModule = `src/components/${family}/index.ts`;
    assertSourceExists(packageDir, sourceModule);
    addRoute(
      routes,
      `./components/${family}`,
      `./dist/components/${family}/index.js`,
      `${family} family barrel`,
    );
  }

  for (const sourceModule of helperModules) {
    const [exportPath, target] = exportedModule(sourceModule);
    assertSourceExists(packageDir, sourceModule);
    addRoute(routes, exportPath, target, 'curated public helper');
  }

  return Object.fromEntries(
    [...routes.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([exportPath, value]) => [exportPath, value.target]),
  );
}

export function deriveExplicitUtilityExports(
  { packageDir, utilityModules = CURATED_UTILITY_MODULES } = {},
) {
  invariant(Array.isArray(utilityModules), 'utilityModules must be an array');
  const routes = new Map();
  for (const sourceModule of utilityModules) {
    invariant(
      /^src\/utilities\/[a-z0-9-]+\.ts$/.test(sourceModule),
      `invalid utility source module ${String(sourceModule)}`,
    );
    assertSourceExists(packageDir, sourceModule);
    const basename = sourceModule.slice('src/utilities/'.length).replace(/\.ts$/, '');
    const exportPath = basename === 'index' ? './utilities' : `./utilities/${basename}.js`;
    const target = `./dist/utilities/${basename}.js`;
    addRoute(routes, exportPath, target, 'curated public utility');
  }
  return Object.fromEntries(
    [...routes.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([exportPath, value]) => [exportPath, value.target]),
  );
}

/**
 * Retains every non-component export byte-for-byte at the JSON value level, removes the broad AI
 * wildcard, and replaces the complete component export region at its existing position. Keeping
 * `./ai` itself preserves the curated AI barrel while preventing private adapter/assertion modules
 * from becoming accidental public contracts.
 */
export function closeWildcardPackageExports(currentExports, componentExports, utilityExports = {}) {
  invariant(currentExports && typeof currentExports === 'object' && !Array.isArray(currentExports), 'package exports must be an object');
  const generatedEntries = Object.entries(componentExports);
  const generatedUtilityEntries = Object.entries(utilityExports);
  const result = {};
  let insertedComponents = false;
  let insertedUtilities = false;

  const insertComponents = () => {
    if (insertedComponents) return;
    for (const [key, value] of generatedEntries) result[key] = value;
    insertedComponents = true;
  };
  const insertUtilities = () => {
    if (insertedUtilities) return;
    for (const [key, value] of generatedUtilityEntries) result[key] = value;
    insertedUtilities = true;
  };

  for (const [key, value] of Object.entries(currentExports)) {
    if (key === './components/*' || key.startsWith('./components/')) {
      insertComponents();
      continue;
    }
    if (key === './utilities' || key === './utilities/*' || key.startsWith('./utilities/')) {
      insertUtilities();
      continue;
    }
    if (key === './ai/*') continue;
    result[key] = value;
  }
  insertComponents();
  insertUtilities();
  return result;
}

function expectedPackage(packageDir) {
  const packageJsonPath = join(packageDir, 'package.json');
  const inventoryPath = join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  const componentExports = deriveExplicitComponentExports(inventory, { packageDir });
  const utilityExports = deriveExplicitUtilityExports({ packageDir });
  return {
    packageJsonPath,
    pkg,
    componentExports,
    utilityExports,
    exports: closeWildcardPackageExports(pkg.exports, componentExports, utilityExports),
  };
}

export function checkPackageExports(packageDir = defaultPackageDir) {
  const expected = expectedPackage(packageDir);
  const current = expected.pkg.exports;
  const findings = [];
  if (Object.hasOwn(current, './components/*')) findings.push('package.json still exposes ./components/*');
  if (Object.hasOwn(current, './ai/*')) findings.push('package.json still exposes ./ai/*');
  if (Object.hasOwn(current, './utilities/*')) findings.push('package.json still exposes ./utilities/*');
  if (JSON.stringify(current) !== JSON.stringify(expected.exports)) {
    findings.push('package.json#exports is stale');
  }
  return { findings, ...expected };
}

export function generatePackageExports(packageDir = defaultPackageDir) {
  const expected = expectedPackage(packageDir);
  expected.pkg.exports = expected.exports;
  writeFileSync(expected.packageJsonPath, `${JSON.stringify(expected.pkg, null, 2)}\n`);
  return {
    componentRoutes: Object.keys(expected.componentExports),
    utilityRoutes: Object.keys(expected.utilityExports),
  };
}

function run(argv) {
  const unknown = argv.filter((argument) => argument !== '--check');
  if (unknown.length > 0) {
    console.error(`Unknown option(s): ${unknown.join(', ')}`);
    return 1;
  }
  if (argv.includes('--check')) {
    const result = checkPackageExports();
    if (result.findings.length > 0) {
      console.error(`${result.findings.join('\n')}\nRun \`pnpm registrations\` and commit the generated changes.`);
      return 1;
    }
    console.log(
      `explicit package exports are current: ${Object.keys(result.componentExports).length} component + ` +
        `${Object.keys(result.utilityExports).length} utility route(s)`,
    );
    return 0;
  }
  const routes = generatePackageExports();
  console.log(
    `explicit package exports regenerated: ${routes.componentRoutes.length} component + ` +
      `${routes.utilityRoutes.length} utility route(s)`,
  );
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}
