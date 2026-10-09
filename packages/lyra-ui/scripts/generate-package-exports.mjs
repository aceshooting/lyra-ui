import { isMainModule } from './is-main-module.mjs';
import { checkPublishedCompatibilitySync } from './check-published-compatibility.mjs';
import { compatibilityKey } from './published-compatibility.mjs';
import { compareVersions, parseVersion } from './component-metadata.mjs';

// Replaces the broad component/AI wildcard package exports with the exact supported public
// routes. Component registration/class entries and stable lr-* aliases come from the authoritative
// component inventory; the small helper list contains only deliberately documented public modules.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));

export const CURATED_COMPONENT_HELPER_MODULES = Object.freeze([
  'src/components/agent-tools/agent-status-presentation.ts',
  'src/components/agent-tools/approval-state.ts',
  'src/components/agent-tools/eval-result/eval-result-register.ts',
  'src/components/agent-tools/stack-trace/stack-trace-parse.ts',
  'src/components/agent-tools/tool-result-view/registry.ts',
  'src/components/agent-tools/trace-tree/span.ts',
  'src/components/charts/chart/chart-colors.ts',
  'src/components/charts/chart/chart-core-loader.ts',
  'src/components/charts/chart/chart-feature-loader.ts',
  'src/components/charts/chart/chart-preload.ts',
  'src/components/conversation/agent-workspace/agent-workspace-register.ts',
  'src/components/conversation/code-block/code-loader.ts',
  'src/components/conversation/markdown/markdown-loader.ts',
  'src/components/conversation/message-actions/toolbar-actions.ts',
  'src/components/conversation/prompt-input/prompt-input-register.ts',
  'src/components/conversation/widget-renderer/default-registry.ts',
  'src/components/conversation/widget-renderer/resolve.ts',
  'src/components/conversation/widget-renderer/registry.ts',
  // Curated for the same reason `pptx-loader.ts` below is: the docs already PROMISE this exact
  // specifier. `llms/data.md` and the generated `llms/components/lr-flow-canvas.md` both show
  // `import { ... } from '@aceshooting/lyra-ui/components/data/flow-canvas/flow-types.js'`, and an
  // exports map blocks everything it does not list, so following the documented example was a hard
  // build error. (The types are also re-exported by `flow-canvas.class.js`, so this adds no new
  // surface -- only the route the docs already name.) Found by `check:doc-specifiers`.
  'src/components/data/condition-builder/condition-builder-register.ts',
  'src/components/data/flow-canvas/flow-types.ts',
  // The lean `<lr-icon-button>` registration entry. `./icon-button.js` eagerly imports `<lr-icon>`
  // so an `icon` attribute paints synchronously; a slot-only consumer then ships that icon code in
  // the entry chunk plus an unreachable dompurify chunk. This is their documented opt-out, so it
  // needs a real route -- an exports map blocks everything it does not list.
  'src/components/forms/country-picker/country-picker-register.ts',
  'src/components/forms/currency-picker/currency-picker-register.ts',
  'src/components/forms/icon-button/icon-button-register.ts',
  'src/components/forms/time-zone-picker/time-zone-picker-register.ts',
  'src/components/forms/unit-picker/unit-picker-register.ts',
  // The lean `<lr-filter-bar>` registration entry. `./filter-bar.js` eagerly imports every
  // composed control the bar could possibly render (select/combobox/checkbox-menu's
  // dropdown+dropdown-item/date-input/input/chip/chip-group/button/spinner) because `filters` is a
  // runtime value it cannot inspect ahead of time; a bar that only ever declares `'select'`/`'text'`
  // filters still pays for `<lr-combobox>` and `<lr-date-input>` through that entry (a measured
  // ~+69.5 kB gzip). This is their documented opt-out -- import it plus each composed control's own
  // registration entry for the filter `type`s actually declared (see this file's own header
  // comment) -- so it needs a real route, exactly like `icon-button-register.ts` above.
  'src/components/layout/dashboard-grid/dashboard-grid-register.ts',
  'src/components/layout/filter-bar/filter-bar-register.ts',
  'src/components/media/attachment-chip/file-size.ts',
  'src/components/media/flag/flag-peer.ts',
  'src/components/media/flag/flag-peer-bulk.ts',
  'src/components/media/flag/flag-peer-bulk-standard.ts',
  'src/components/media/flag/language-map.ts',
  'src/components/media/map/map-loader.ts',
  'src/components/overlays/dialog/confirm.ts',
  'src/components/overlays/toast/toaster.ts',
  'src/components/retrieval/graph/graph-loader.ts',
  'src/components/utility/export-button/csv.ts',
  'src/components/utility/icon/icon-library.ts',
  'src/components/viewers/archive-viewer/archive-viewer-register.ts',
  'src/components/viewers/calendar-viewer/calendar-viewer-register.ts',
  'src/components/viewers/contact-viewer/contact-viewer-register.ts',
  'src/components/viewers/csv-viewer/csv-viewer-register.ts',
  'src/components/viewers/dataset-viewer/dataset-viewer-register.ts',
  'src/components/viewers/document-viewer/document-viewer-kinds.ts',
  'src/components/viewers/document-viewer/registry.ts',
  'src/components/viewers/docx-viewer/docx-viewer-register.ts',
  'src/components/viewers/ebook-viewer/ebook-viewer-register.ts',
  'src/components/viewers/email-viewer/email-viewer-register.ts',
  'src/components/viewers/html-viewer/html-viewer-register.ts',
  'src/components/viewers/notebook-viewer/notebook-viewer-register.ts',
  'src/components/viewers/pdf-viewer/pdf-viewer-register.ts',
  'src/components/viewers/pptx-viewer/pptx-viewer-register.ts',
  'src/components/viewers/spreadsheet-viewer/spreadsheet-viewer-register.ts',
  'src/components/viewers/svg-viewer/svg-viewer-register.ts',
  'src/components/viewers/xml-viewer/xml-viewer-register.ts',
  // `PptxViewerAdapter`/`PptxViewerAdapterEvent`/`PptxTextSearchResult`/`PptxSearchHighlightHandle`/
  // `PptxThumbnailHandle` are imported (type-only) by pptx-viewer.class.ts but never re-exported --
  // neither by pptx-viewer.ts's registration barrel nor by the `./components/viewers` family
  // barrel -- so, exactly like the other granular loaders above, this is the only route that
  // reaches them. llms/viewers.md:823 documents this module as their public source.
  'src/components/viewers/pptx-viewer/pptx-loader.ts',
]);

// Deliberately internal despite matching the naming convention `findUnclassifiedHelperModules`
// derives from the file tree (see below). Each group states why it stays out of the curated list
// above instead of silently vanishing from consideration.
export const ACKNOWLEDGED_INTERNAL_HELPER_MODULES = Object.freeze([
  // The box-plot class re-exports the loader's public compatibility function; callers use the
  // existing class route, so a second granular helper route would be redundant.
  'src/components/charts/chart/box-plot-loader.ts',
  // Already reachable without a dedicated route: each viewer's registration module (which already
  // has its own package export via the component inventory, and is re-exported again by the
  // `./components/viewers` family barrel) does `export * from './<name>-loader.js'` wholesale, so
  // a second granular route here would just be a redundant alias for an already-public surface.
  'src/components/viewers/calendar-viewer/calendar-loader.ts',
  'src/components/viewers/docx-viewer/docx-loader.ts',
  'src/components/viewers/email-viewer/email-loader.ts',
  'src/components/viewers/spreadsheet-viewer/spreadsheet-loader.ts',

  // Simple internal optional-peer loaders: a load()/get()/clear-cache() trio plus at most one
  // structural "Api" type, consumed only inside their own component file. Nothing re-exports them,
  // no llms/ text promises a granular import path for them, and `check-packed-consumer.mjs` does
  // not smoke-test them -- unlike the curated loaders above (chart-core/-feature, code, markdown,
  // map, graph, pptx), which the docs and that smoke test both name explicitly. There is no public
  // contract here today.
  'src/components/conversation/markdown/katex-loader.ts',
  'src/components/forms/emoji-picker/emoji-data-loader.ts',
  'src/components/media/qr-code/qr-code-loader.ts',
  'src/components/utility/icon/dompurify-loader.ts',
  'src/components/viewers/html-viewer/dompurify-loader.ts',
  'src/components/viewers/notebook-viewer/dompurify-loader.ts',
  'src/components/viewers/svg-viewer/dompurify-loader.ts',

  // Structurally these two look like the pptx-loader.ts case above: a real adapter-shaped "Api"
  // type surface (PdfJsApi/PdfDocumentApi/PdfPageApi/... and EpubBook/EpubRendition/...) imported
  // type-only by their viewer class and never re-exported by anything that already has a package
  // route, so the types are equally unreachable.
  //
  // DECIDED 2026-08-19: internal, deliberately -- this is the settled answer, not a deferral.
  // The distinction from pptx-loader.ts is the whole point. pptx was curated because
  // `llms/viewers.md` already PROMISED those types were "exported from the granular PPTX loader
  // module", so the export fixed a broken promise a consumer could act on. Nothing promises these
  // two, and no consumer has asked: this repo's intake shows consumers do file when a granular
  // type is genuinely unreachable (LyraNodeTypeStyle, the filter-bar parts, pptx itself), so
  // silence here is evidence, not oversight.
  // Curating them speculatively would add a permanent public route with no JSDoc, test, story or
  // llms entry behind it -- the exact over-widening this list exists to prevent, and irreversible
  // in a way the opposite mistake is not: internal -> public is a minor, public -> internal is a
  // major. If a consumer ever needs them, export them THEN, together with the docs that justify it.
  'src/components/viewers/pdf-viewer/pdf-loader.ts',
  'src/components/viewers/ebook-viewer/ebook-loader.ts',
]);

export const CURATED_UTILITY_MODULES = Object.freeze([
  'src/utilities/a11y.ts',
  'src/utilities/anchor-target.ts',
  'src/utilities/animation-registry.ts',
  'src/utilities/announcer.ts',
  'src/utilities/catalog.ts',
  'src/utilities/css-length.ts',
  'src/utilities/deprecated-aliases.ts',
  'src/utilities/defined.ts',
  'src/utilities/form-associated.ts',
  'src/utilities/format.ts',
  'src/utilities/group-by-recency.ts',
  'src/utilities/icons.ts',
  'src/utilities/index.ts',
  'src/utilities/layered-layout.ts',
  'src/utilities/lyra-element.ts',
  'src/utilities/overlay-manager.ts',
  'src/utilities/positioner.ts',
  'src/utilities/prefix.ts',
  'src/utilities/scroll-lock.ts',
  'src/utilities/scoped-registry.ts',
  'src/utilities/scoped-registry-loader.ts',
  'src/utilities/theme.ts',
]);

// Shared document admission is used by both the viewer and the editor companion. Its consumer
// route is intentionally exact; the remaining internal modules have no public deep-import path.
export const CURATED_ADMISSION_MODULES = Object.freeze([
  { source: 'src/internal/docx-zip-admission.ts', route: './utils/docx-zip-admission.js' },
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

// The naming convention shared by every helper module classified above, public or acknowledged
// internal: a `*-loader.ts` (an optional-peer/heavy-dependency loader), `*-peer.ts` (an
// optional-peer installer), `*-register.ts` (a side-effect-only renderer registration), or a
// module literally named `registry.ts`. This mirrors `generate-side-effects.mjs`'s
// `deriveSideEffects()`, which walks the same file tree for its own `-register`/`-peer` suffixes
// instead of hand-copying names forward from a previous artifact.
// The trailing `(?:-[a-z0-9]+)*` matters as much as the suffixes themselves. `flag-peer-bulk.ts`
// shipped in 11.2.0 as the release's headline <lr-flag> entry point, was named by its own docs and
// `.d.ts` as the specifier to import, and reached no consumer at all: it had no package-export
// route, and this derivation -- whose entire job is to stop exactly that -- skipped it because a
// QUALIFIED suffix (`-peer-bulk`) is not the bare suffix (`-peer`). A qualified variant is a helper
// module by every criterion that makes the bare form one, so it must be classified too.
function matchesPublicHelperNamingConvention(basename) {
  return basename === 'registry.ts' || basename === 'document-viewer-kinds.ts' || /-(?:loader|peer|register)(?:-[a-z0-9]+)*\.ts$/.test(basename);
}

function walkFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(entryPath));
    else files.push(entryPath);
  }
  return files;
}

/**
 * Derives every helper-module *candidate* from the file tree (not from either hand-maintained
 * list), so a newly added file matching the naming convention cannot silently avoid
 * classification -- the failure mode that stranded `pptx-loader.ts` outside
 * `CURATED_COMPONENT_HELPER_MODULES` with no route and no warning. This function does NOT decide
 * public vs. internal: no automatic rule reliably distinguishes a module whose real API is
 * reachable only through it (curated) from one that is a private implementation detail or already
 * reachable transitively through an already-exported sibling (acknowledged internal) -- see the
 * comments on both lists above for the evidence behind each entry. Instead this closes the gap the
 * achievable way: every candidate MUST appear in exactly one of the two lists, or this returns it
 * as unclassified so `checkPackageExports` fails loudly and a human classifies it deliberately.
 */
export function findUnclassifiedHelperModules(
  packageDir = defaultPackageDir,
  {
    curatedModules = CURATED_COMPONENT_HELPER_MODULES,
    internalModules = ACKNOWLEDGED_INTERNAL_HELPER_MODULES,
    skipExistenceCheck = false,
  } = {},
) {
  const componentsRoot = join(packageDir, 'src', 'components');
  const curated = new Set(curatedModules);
  const acknowledgedInternal = new Set(internalModules);
  for (const module of acknowledgedInternal) {
    invariant(!curated.has(module), `${module} is listed as both a curated public helper and acknowledged internal`);
  }

  const unclassified = [];
  for (const file of walkFiles(componentsRoot)) {
    if (!file.endsWith('.ts') || file.endsWith('.test.ts') || file.endsWith('.d.ts')) continue;
    const relPath = relative(packageDir, file).replaceAll('\\', '/');
    const basename = relPath.slice(relPath.lastIndexOf('/') + 1);
    if (!matchesPublicHelperNamingConvention(basename)) continue;
    if (curated.has(relPath) || acknowledgedInternal.has(relPath)) continue;
    unclassified.push(relPath);
  }

  // Stale entries in the acknowledged-internal list (renamed/removed files) are just as much a
  // silent gap as an unclassified new file: the classification they recorded no longer applies to
  // anything, and a real replacement file could pass the check unnoticed if it were left believing
  // its neighbor was already accounted for. Fail the same way a missing curated source module does.
  if (!skipExistenceCheck) {
    for (const module of acknowledgedInternal) {
      invariant(existsSync(join(packageDir, module)), `acknowledged-internal helper module is missing: ${module}`);
    }
  }

  return unclassified.sort();
}

export function deriveExplicitComponentExports(
  inventory,
  { packageDir, helperModules = CURATED_COMPONENT_HELPER_MODULES, exportDeprecations = [] } = {},
) {
  invariant(inventory?.schemaVersion === 1, 'schemaVersion must be 1');
  invariant(Array.isArray(inventory.components), 'components must be an array');
  invariant(Array.isArray(helperModules), 'helperModules must be an array');

  // Only historical duplicate routes receive compatibility exports. Newly introduced components
  // expose their stable tag registration and class module without creating a new deprecated route.
  const compatibilityRoutes = new Set(
    exportDeprecations.filter((entry) => entry.kind === 'entry-point').map((entry) => entry.name),
  );
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
      if (kind === 'class' || compatibilityRoutes.has(exportPath)) {
        addRoute(routes, exportPath, target, `${component.tag} ${kind} module`);
      }
    }

    const aliasModule = `src/components/${component.tag}.ts`;
    assertSourceExists(packageDir, aliasModule);
    const [aliasExport, aliasTarget] = exportedModule(aliasModule);
    addRoute(routes, aliasExport, {
      types: `./${component.registrationModule.replace(/^src\//, 'dist/').replace(/\.ts$/, '.d.ts')}`,
      default: aliasTarget,
    }, `${component.tag} stable alias`);
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
  // A documented, closed door: `null` is Node's documented way to declare a subpath pattern while
  // explicitly blocking resolution through it. This keeps `./utilities/*` present in the exports
  // map (so `src/package-entrypoints.test.ts` can assert the boundary is documented) without
  // actually reopening deep-import access to anything under src/utilities/ beyond the curated
  // routes above.
  addRoute(routes, './utilities/*', null, 'documented closed utility subpath boundary');
  return Object.fromEntries(
    [...routes.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([exportPath, value]) => [exportPath, value.target]),
  );
}

/**
 * Retains unrelated export targets, regenerates exact component and locale routes, removes the broad AI
 * wildcard, and replaces the complete component export region at its existing position. Keeping
 * `./ai` itself preserves the curated AI barrel while preventing private adapter/assertion modules
 * from becoming accidental public contracts.
 */
function wildcardMatches(pattern, exportPath) {
  const marker = pattern.indexOf('*');
  return marker >= 0 && exportPath.startsWith(pattern.slice(0, marker)) &&
    exportPath.endsWith(pattern.slice(marker + 1));
}

/** Internal test seam; production callers supply only the verifier's detached result. */
export function deriveRetiredExportIdentitiesFromVerifiedHistory(verified, packageVersion) {
  if (!Array.isArray(verified?.captures) || !Array.isArray(verified?.retirements)) {
    throw new TypeError('verified compatibility history must include capture and retirement arrays');
  }
  const publishedPolicies = new Map();
  for (const { capture, facts } of verified.captures) {
    for (const record of facts.records) {
      const id = compatibilityKey(record.key);
      const existing = publishedPolicies.get(id);
      if (existing && JSON.stringify(existing.policy) !== JSON.stringify(record.policy)) {
        throw new Error(`Conflicting published policy for retired export identity ${id}`);
      }
      publishedPolicies.set(id, {
        key: record.key,
        policy: record.policy,
        sourceReleases: new Set([...(existing?.sourceReleases ?? []), capture.sourceRelease]),
      });
    }
  }

  const retired = [];
  const seen = new Set();
  for (const retirement of verified.retirements) {
    const id = compatibilityKey(retirement.key);
    if (seen.has(id)) throw new Error(`Duplicate compatibility retirement ${id}`);
    seen.add(id);
    const record = publishedPolicies.get(id);
    if (!record || !record.sourceReleases.has(retirement.sourceRelease)) {
      throw new Error(`Retirement has no exact published source record: ${id}`);
    }
    const { policy } = record;
    const since = parseVersion(policy.since);
    const floor = parseVersion(policy.removalNotBefore);
    // `compareVersions` is the shared stable version parser used by compatibility policy.
    if (!since || !floor || !retirement.sourceRelease.startsWith('lyra-ui@')) {
      throw new Error(`Retirement has an invalid published notice window: ${id}`);
    }
    compareVersions(retirement.removedIn, policy.removalNotBefore);
    if (compareVersions(retirement.removedIn, policy.removalNotBefore) < 0 ||
        floor.major < since.major + 2 ||
        compareVersions(packageVersion, retirement.removedIn) < 0) {
      throw new Error(`Retirement is outside its published removal window: ${id}`);
    }
    if (retirement.key.scope === 'export' &&
        ['entry-point', 'stylesheet'].includes(retirement.key.kind)) {
      if (policy.kind !== retirement.key.kind) {
        throw new Error(`Retirement kind disagrees with its published notice: ${id}`);
      }
      retired.push(retirement.key);
    }
  }
  return retired;
}

function deriveRetiredExportIdentities(packageDir, packageVersion) {
  const historyDir = join(packageDir, 'scripts', 'fixtures', 'compatibility-history');
  return deriveRetiredExportIdentitiesFromVerifiedHistory(
    checkPublishedCompatibilitySync(historyDir),
    packageVersion,
  );
}

export function closeWildcardPackageExports(
  currentExports,
  componentExports,
  utilityExports = {},
  localeExports = {},
  retiredExportIdentities = [],
  admissionExports = {},
) {
  invariant(currentExports && typeof currentExports === 'object' && !Array.isArray(currentExports), 'package exports must be an object');
  invariant(Array.isArray(retiredExportIdentities), 'retired export identities must be an array');
  const retiredPaths = new Set();
  for (const key of retiredExportIdentities) {
    invariant(key?.scope === 'export' && ['entry-point', 'stylesheet'].includes(key.kind),
      'only exact retired entry-point and stylesheet identities may close package routes');
    compatibilityKey(key);
    retiredPaths.add(key.name);
  }
  const generatedEntries = Object.entries(componentExports);
  const generatedUtilityEntries = Object.entries(utilityExports);
  const generatedPaths = new Set([
    ...generatedEntries.map(([key]) => key),
    ...generatedUtilityEntries.map(([key]) => key),
    ...Object.keys(admissionExports),
  ]);
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
    // Export-map keys are consumer-visible specifiers, while `./dist/...` belongs only on the
    // target side. Drop a seeded literal dist key instead of preserving an accidental deep-import
    // contract forever.
    if (key === './dist' || key.startsWith('./dist/')) continue;
    if (key === './components/*' || key.startsWith('./components/')) {
      insertComponents();
      continue;
    }
    if (key === './utilities' || key === './utilities/*' || key.startsWith('./utilities/')) {
      insertUtilities();
      continue;
    }
    if (key === './ai/*') continue;
    // Real catalogs ship in @aceshooting/lyra-translations; only the pseudo-locales (which need
    // private runtime helpers) stay routed here.
    if (key.startsWith('./translations/') && !key.startsWith('./translations/pseudo/')) continue;
    if (retiredPaths.has(key)) continue;
    result[key] = value;
  }
  // An exact null blocks only a retired path that would otherwise continue resolving through a
  // retained wildcard. This preserves useful wildcard routes while refusing source-absence
  // heuristics and blanket wildcard shutdowns.
  for (const exportPath of retiredPaths) {
    if (generatedPaths.has(exportPath) || Object.hasOwn(result, exportPath)) continue;
    if (Object.entries(result).some(([pattern, target]) =>
      target !== null && pattern.includes('*') && wildcardMatches(pattern, exportPath)
    )) result[exportPath] = null;
  }
  insertComponents();
  insertUtilities();
  Object.assign(result, admissionExports);
  Object.assign(result, localeExports);
  return result;
}

function expectedPackage(packageDir) {
  const packageJsonPath = join(packageDir, 'package.json');
  const inventoryPath = join(packageDir, 'scripts', 'fixtures', 'component-inventory.json');
  const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8'));
  const metadata = JSON.parse(readFileSync(join(packageDir, 'scripts', 'fixtures', 'component-metadata.json'), 'utf8'));
  const componentExports = deriveExplicitComponentExports(inventory, {
    packageDir, exportDeprecations: metadata.exportDeprecations,
  });
  const utilityExports = deriveExplicitUtilityExports({ packageDir });
  const admissionExports = Object.fromEntries(CURATED_ADMISSION_MODULES.map(({ source, route }) => {
    assertSourceExists(packageDir, source);
    const compiled = `./${source.replace(/^src\//, 'dist/').replace(/\.ts$/, '.js')}`;
    return [route, { types: compiled.replace(/\.js$/, '.d.ts'), default: compiled }];
  }));
  const historyIndexPath = join(packageDir, 'scripts', 'fixtures', 'compatibility-history', 'index.json');
  // Small synthetic package fixtures have no publication history and explicitly get an empty
  // retirement set. A real history directory with a missing index is not treated as empty.
  const retiredExportIdentities = existsSync(historyIndexPath)
    ? deriveRetiredExportIdentities(packageDir, pkg.version)
    : [];
  return {
    packageJsonPath,
    pkg,
    componentExports,
    utilityExports,
    exports: closeWildcardPackageExports(
      pkg.exports,
      componentExports,
      utilityExports,
      {},
      retiredExportIdentities,
      admissionExports,
    ),
  };
}

export function checkPackageExports(packageDir = defaultPackageDir) {
  const expected = expectedPackage(packageDir);
  const current = expected.pkg.exports;
  const findings = [];
  if (Object.hasOwn(current, './components/*')) findings.push('package.json still exposes ./components/*');
  if (Object.hasOwn(current, './ai/*')) findings.push('package.json still exposes ./ai/*');
  for (const key of Object.keys(current)) {
    if (key === './custom-elements.json' || (key.startsWith('./translations/') && !key.startsWith('./translations/pseudo/'))) {
      findings.push(`package.json still exposes ${key}, which ships in a companion package`);
    }
  }
  // A `null` target is the documented closed door (see deriveExplicitUtilityExports) -- only a
  // real, resolvable target here means the wildcard subpath was reopened.
  if (Object.hasOwn(current, './utilities/*') && current['./utilities/*'] !== null) {
    findings.push('package.json still exposes ./utilities/*');
  }
  for (const key of Object.keys(current)) {
    if (key === './dist' || key.startsWith('./dist/')) {
      findings.push(`package.json exposes forbidden literal dist key ${key}`);
    }
  }
  if (JSON.stringify(current) !== JSON.stringify(expected.exports)) {
    findings.push('package.json#exports is stale');
  }
  for (const module of findUnclassifiedHelperModules(packageDir)) {
    findings.push(
      `${module} matches the public-helper naming convention (*-loader.ts / *-peer.ts / *-register.ts / ` +
        'registry.ts) but is classified in neither CURATED_COMPONENT_HELPER_MODULES nor ' +
        'ACKNOWLEDGED_INTERNAL_HELPER_MODULES in scripts/generate-package-exports.mjs. Add it to the former ' +
        'if its API is public and not otherwise reachable, or the latter (with a reason) if it is ' +
        'deliberately internal.',
    );
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

if (isMainModule(import.meta.url)) {
  process.exitCode = run(process.argv.slice(2));
}
