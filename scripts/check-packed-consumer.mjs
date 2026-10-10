import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { attwCommandArguments, parsePackedConsumerArguments } from './packed-attw.mjs';
import { PACKED_TARBALL_ENVIRONMENT, packedManifest, suppliedPackedTarball } from './packed-tarball-input.mjs';
import { checkPublishedCompatibilitySync, readCurrentCompatibilityContext } from '../packages/lyra-ui/scripts/check-published-compatibility.mjs';
import { checkPublishedFieldHistorySync } from '../packages/lyra-ui/scripts/published-field-compatibility-io.mjs';
import { preservePackedTarball, verifyPackedMigrationConsumers, writeResolvedMigrationEntry, verifyResolvedMigrationBrowser } from './packed-migration-consumer.mjs';
import {
  parsePerformanceQualificationOptions,
  runPackedHydrationSmoke,
  runPackedPerformanceQualification,
} from './packed-performance.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const uiPackage = join(root, 'packages', 'lyra-ui');
const flagsPackage = join(root, 'packages', 'lyra-flags');
const docsPackage = join(root, 'packages', 'lyra-docs');
const translationsPackage = join(root, 'packages', 'lyra-translations');
const idePackage = join(root, 'packages', 'lyra-ide');
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const binName = (name) => (process.platform === 'win32' ? `${name}.cmd` : name);

const uiPackageJson = JSON.parse(await readFile(join(uiPackage, 'package.json'), 'utf8'));
const granularBundleBudgets = JSON.parse(
  await readFile(join(uiPackage, 'scripts', 'bundle-budgets.json'), 'utf8'),
);
if (
  typeof granularBundleBudgets !== 'object' ||
  granularBundleBudgets === null ||
  Array.isArray(granularBundleBudgets)
) {
  throw new TypeError('The granular bundle-budget authority must be a JSON object.');
}
const BUTTON_GRANULAR_ENTRY = 'dist/components/forms/button/button.js';
const buttonGranularBudgetKilobytes = granularBundleBudgets[BUTTON_GRANULAR_ENTRY];
const buttonGranularBudgetBytes = buttonGranularBudgetKilobytes * 1024;
if (typeof buttonGranularBudgetKilobytes !== 'number' || !Number.isSafeInteger(buttonGranularBudgetBytes) || buttonGranularBudgetBytes <= 0) {
  throw new TypeError(
    `The granular bundle-budget authority must define ${BUTTON_GRANULAR_ENTRY} as a KiB ceiling resolving to a positive safe integer byte count.`,
  );
}
const optionalPeers = Object.keys(uiPackageJson.peerDependencies ?? {})
  .filter((name) => uiPackageJson.peerDependenciesMeta?.[name]?.optional === true)
  .sort();

/**
 * Optional peers the npm `--strict-peer-deps` fixture actually installs, so their declared ranges
 * are resolved against the real registry and verified with `npm ls` rather than merely being
 * syntactically valid in `package.json`.
 *
 * An optional-peer range can be perfectly well-formed and still operationally unusable: it can
 * conflict with an otherwise-unused installed major, or name a version the public registry does
 * not carry. Only a real install proves otherwise, and previously exactly one peer
 * (`maplibre-gl`) got that treatment while the other 28 were taken on faith.
 */
const FIXTURE_OPTIONAL_PEERS = Object.freeze({
  '@sgratzl/chartjs-chart-boxplot': '^4.4.5',
  'chart.js': '^4.5.1',
  'chartjs-plugin-zoom': '^2.2.0',
  'd3-drag': '^3.0.0',
  'd3-force': '^3.0.0',
  'd3-selection': '^3.0.0',
  'd3-zoom': '^3.0.0',
  dompurify: '^3.4.12',
  marked: '^18.0.6',
  shiki: '^4.3.1',
});

/**
 * Optional peers deliberately NOT installed by the fixture, each with the reason. Anything absent
 * from both this map and `FIXTURE_OPTIONAL_PEERS` fails the coverage assertion below, so adding a
 * new optional peer forces an explicit decision instead of silently landing uncovered.
 */
const OPTIONAL_PEER_COVERAGE_EXEMPTIONS = Object.freeze({
  '@aceshooting/lyra-flags': 'installed from the packed workspace tarball, not the registry',
  '@aceshooting/lyra-translations': 'installed from the packed workspace tarball, not the registry',
  xlsx: 'the supported >=0.20.3 range is published only on the SheetJS CDN, not the public npm registry',
  'maplibre-gl': 'installed with an explicit version by the dedicated v5/v6 fixtures below',
  react: 'framework declaration peer; type-only, exercised by the packed type-consumer checks',
  svelte: 'framework declaration peer; type-only, exercised by the packed type-consumer checks',
  vue: 'framework declaration peer; type-only, exercised by the packed type-consumer checks',
  '@aiden0z/pptx-renderer': 'heavy viewer peer; range verified by resolution, not installed in CI',
  epubjs: 'heavy viewer peer; range verified by resolution, not installed in CI',
  'ical.js': 'heavy viewer peer; range verified by resolution, not installed in CI',
  katex: 'heavy render peer; range verified by resolution, not installed in CI',
  mammoth: 'heavy viewer peer; range verified by resolution, not installed in CI',
  'pdfjs-dist': 'heavy viewer peer; range verified by resolution, not installed in CI',
  papaparse: 'parser peer; range verified by resolution, not installed in CI',
  'postal-mime': 'parser peer; range verified by resolution, not installed in CI',
  qrcode: 'generator peer; range verified by resolution, not installed in CI',
  'libphonenumber-js': 'data peer; range verified by resolution, not installed in CI',
  'emoji-picker-element-data': 'data peer; range verified by resolution, not installed in CI',
  'chartjs-plugin-annotation': 'chart plugin peer; range verified by resolution, not installed in CI',
  'chartjs-plugin-datalabels': 'chart plugin peer; range verified by resolution, not installed in CI',
});

{
  const covered = new Set([
    ...Object.keys(FIXTURE_OPTIONAL_PEERS),
    ...Object.keys(OPTIONAL_PEER_COVERAGE_EXEMPTIONS),
  ]);
  const uncovered = optionalPeers.filter((name) => !covered.has(name));
  if (uncovered.length > 0) {
    throw new Error(
      `Optional peers with no install coverage and no documented exemption: ${uncovered.join(', ')}. ` +
        'Add each to FIXTURE_OPTIONAL_PEERS so its range is really installed and verified, or to ' +
        'OPTIONAL_PEER_COVERAGE_EXEMPTIONS with the reason it cannot be.',
    );
  }
  const stale = Object.keys(OPTIONAL_PEER_COVERAGE_EXEMPTIONS).filter(
    (name) => !optionalPeers.includes(name),
  );
  if (stale.length > 0) {
    throw new Error(
      `OPTIONAL_PEER_COVERAGE_EXEMPTIONS names peers that are no longer optional peers: ${stale.join(', ')}.`,
    );
  }
}

// The authoritative registration inventory, so the packed contract fixture below asserts against
// the same source `src/all.ts` and `src/ssr/all.ts` are generated from rather than a hand-kept list
// that would rot on the next `pnpm create:component`.
const componentInventory = JSON.parse(
  await readFile(join(uiPackage, 'scripts', 'fixtures', 'component-inventory.json'), 'utf8'),
);
const rootIncludedTags = componentInventory.components
  .filter((component) => component.rootIncluded)
  .map((component) => component.tag)
  .sort();
const optionalPeerFamilyTags = componentInventory.components
  .filter((component) => !component.rootIncluded)
  .map((component) => component.tag)
  .sort();

// A direct Node import and a production tree-shaken import must agree: the package root defines no
// tags. Imperative helpers register the exact elements they need only when the helper is invoked.
const rootHelperRegisteredTags = [];

// Packed core/all.js measures 4,977,154 raw bytes and 1,220,933 gzip bytes across
// all 49 emitted files, including signature-pad and shared accessibility, data ownership,
// tree-focus, and document resource guards. The same Vite 8.1.5 measurement of published
// 25.5.0 is 4,897,936 raw bytes; the prior reviewed measurement was 4,897,862 bytes.
// Retain the existing 16,000-byte regression headroom (less than 0.5%); only the core
// raw baseline changes. Peer exclusions, other profiles, and the complete file sum stay fixed.
// Prior reviewed baseline and allowance:
// https://github.com/aceshooting/lyra-ui/blob/7859878f724ef4237ee93a5414fa6b54f204313a/scripts/check-packed-consumer.mjs
const coreRawBudget = {
  reviewedCoreMeasurementBytes: 4_977_154,
  selectedRegressionHeadroomBytes: 16_000,
};

/**
 * Content required by the shadcnTheme canary alongside exact installed module provenance.
 * The base theme includes the default Shadcn look, so content alone cannot prove that the
 * explicitly imported optional look survived. Patterns tolerate consumer minifier whitespace.
 */
const SHADCN_THEME_RETENTION_MARKERS = Object.freeze({
  preset: Object.freeze([
    // The portable look's scoped layer and installation marker must survive bundling.
    /@layer\s+lr-theme-preset\.look\s*\{/u,
    /\[data-lr-look=['"]?shadcn['"]?\]/u,
    /--_lr-look-installed\s*:\s*shadcn-1\s*[;}]/u,
  ]),
  baseTheme: Object.freeze([
    // The base installs the independent style-axis resolver and motion inputs; the look does not.
    /--_lr-style-resolver\s*:\s*1\s*[;}]/u,
    // Shared motion inputs belong to the base rather than the fixed look.
    /--lr-theme-duration-fast\s*:/u,
  ]),
});

const bundleEntries = {
  core: {
    fixture: 'core',
    // Measures the entire non-optional registration graph from `all.js`; the bare package root
    // has its separate tree-shaking canary below. The reviewed raw sum includes every emitted file.
    maxRawBytes:
      coreRawBudget.reviewedCoreMeasurementBytes +
      coreRawBudget.selectedRegressionHeadroomBytes,
  },
  // The other half of the registration split, and the reason the `core` budget above could move to
  // `all.js` without losing coverage: a bare `import '@aceshooting/lyra-ui'` must still collapse to
  // essentially nothing under a production tree-shaker. Measured at 0 B raw in a single output file
  // -- rolldown walks 743 modules and emits none of them -- so any regression that makes the root
  // side-effectful again (a registration import creeping back into `src/lyra.ts`, or `./dist/lyra.js`
  // reappearing in package.json#sideEffects) shows up here as a multi-megabyte bundle rather than
  // as silence. The ceiling is deliberately tiny; `runBundle` additionally rejects any custom
  // element definition surviving in the output.
  rootBarrel: {
    fixture: 'core',
    maxRawBytes: 8_192,
  },
  // Single-component regression canary: catches a PR silently dragging something heavy into the
  // eager import graph (e.g. a `*-loader.ts`'s dynamic `import()` accidentally hoisted to a
  // top-level static import, pulling an optional peer like chart.js/maplibre-gl/shiki/d3-* in
  // eagerly) that the `core` budget above is too loose to notice -- `core` legitimately grows every
  // time a component is added, so it carries deliberate headroom, while `<lr-button>` alone
  // should only ever pull in Lit, LyraElement's token layer, and its own small class/styles, so its
  // footprint should stay essentially flat release over release. Gated on gzip rather than raw
  // bytes because that's what a consumer's browser actually pays for over the wire, and gzip is
  // more sensitive to a foreign dependency's low-entropy-relative-to-its-size bytes landing in an
  // otherwise tiny, highly-compressible bundle.
  //
  // This is the release target backed by per-component English catalog slices and the lean base
  // token sheet. Raised from 30 KiB after adding two real
  // button contracts: composed-click cancellation for submit/reset default actions and the
  // minimum-target/long-content containment styles. The packed graph still reports zero eager or
  // bundled optional peers, and this now agrees with the independently enforced granular hard
  // budget in packages/lyra-ui/scripts/bundle-budgets.json instead of maintaining a contradictory
  // second ceiling. It is intentionally not a measured-current-plus-headroom rebaseline.
  button: {
    fixture: 'core',
    maxGzipBytes: buttonGranularBudgetBytes,
  },
  // Production retention canary for the opt-in form-label bridge. This entry is deliberately a
  // non-overlay form control: its graph must retain the label installer without inheriting modal
  // stack, inerting, focus-trap, rendered-state, or scroll-lock infrastructure.
  formControlLabel: {
    fixture: 'core',
  },
  // Splitting-aware packed canaries: the component shell stays in the initial graph while the
  // shared Floating UI runtime remains a real first-open chunk. Both graphs must use the lean
  // nonmodal stack adapter and never retain modal inerting/scroll-lock machinery.
  anchoredPopover: {
    fixture: 'core',
  },
  anchoredCombobox: {
    fixture: 'core',
  },
  // A performance-sensitive shell can render a native disclosure before JavaScript and import the
  // richer enhancer only on first interaction. These canaries prove that adoption shape adds zero
  // Lyra modules to the initial graph; the reviewed 3.7 KiB shell ceiling remains available in full.
  firstInteractionPopover: {
    fixture: 'core',
    maxInitialGzipBytes: 3_700,
    includeStaticFallback: true,
  },
  firstInteractionCombobox: {
    fixture: 'core',
    maxInitialGzipBytes: 3_700,
    includeStaticFallback: true,
  },
  // Retention canaries rather than size budgets: these entries are imported only for side effects,
  // so the assertions in runBundle prove a production tree-shaker kept the shipped CSS asset and
  // locale registration module from the packed tarball.
  theme: {
    fixture: 'core',
  },
  // The opt-in look preset is a bare CSS import as well, and only meaningful alongside theme.css.
  // Imported preset-first, so the canary also proves the preset's own layer survives bundling.
  shadcnTheme: {
    fixture: 'core',
  },
  nativeStyles: {
    fixture: 'core',
  },
  reservationStyles: {
    fixture: 'core',
  },
  utilitiesStyles: {
    fixture: 'core',
  },
  locale: {
    fixture: 'core',
  },
  // A bare import of the manual loader is removable, while the dedicated CDN entry is retained
  // for its documented auto-start side effect. These canaries exercise the packed sideEffects
  // metadata with the same production tree-shaker consumers use.
  autoloaderTreeShaken: {
    fixture: 'core',
  },
  autoloaderCdn: {
    fixture: 'core',
  },
  ssrHydration: {
    fixture: 'core',
  },
  flag: {
    fixture: 'optional',
    maxRawBytes: 30_000,
  },
  codeBlock: {
    fixture: 'core',
    maxRawBytes: 600_000,
  },
  chart: {
    fixture: 'optional',
    maxRawBytes: 1_000_000,
  },
  map: {
    fixture: 'optional',
    maxRawBytes: 2_500_000,
  },
  graph: {
    fixture: 'optional',
    maxRawBytes: 400_000,
  },
};

function run(command, args, cwd, label) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, CI: 'true' },
      stdio: 'inherit',
    });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveRun();
      } else {
        rejectRun(new Error(`${label} failed${signal ? ` (${signal})` : ` with exit code ${code}`}`));
      }
    });
  });
}

async function pack(packageDir, destination) {
  const before = new Set((await readdir(destination)).filter((entry) => entry.endsWith('.tgz')));
  await run(pnpm, ['pack', '--pack-destination', destination], packageDir, `packing ${packageDir}`);
  const packed = (await readdir(destination)).filter(
    (entry) => entry.endsWith('.tgz') && !before.has(entry),
  );
  if (packed.length !== 1) {
    throw new Error(`Expected one new package tarball from ${packageDir}, found ${packed.join(', ') || 'none'}`);
  }
  return join(destination, packed[0]);
}

/** lyra-docs as consumers install it: publint, ATTW, no workspace: leak, the packed lyra-ui accepted, entries load without the engine. */
async function verifyPackedDocsPackage({ workspace, uiTarball, docsTarball }) {
  const manifest = packedManifest(docsTarball);
  const ranges = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    .flatMap((section) => Object.values(manifest[section] ?? {}));
  assert.deepEqual(ranges.filter((range) => String(range).startsWith('workspace:')), [], 'lyra-docs leaks workspace: ranges');
  const uiVersion = packedManifest(uiTarball).version;
  const uiRange = manifest.dependencies?.['@aceshooting/lyra-ui'] ?? manifest.peerDependencies?.['@aceshooting/lyra-ui'];
  assert.ok([uiVersion, `^${uiVersion}`].includes(uiRange), `lyra-docs requires @aceshooting/lyra-ui ${uiRange}, packed beside ${uiVersion}`);
  await run(pnpm, ['exec', 'publint', 'run', '--strict', '--pack=false', docsTarball], root, 'lyra-docs publint package check');
  const typed = Object.keys(manifest.exports).filter((entry) => !entry.endsWith('.css') && entry !== './package.json');
  await run(pnpm, attwCommandArguments(typed, docsTarball), root, 'lyra-docs Are The Types Wrong check');

  // The optional engine is not installed here, so any eager engine import fails these loads.
  const fixtureDir = join(workspace, 'docs-consumer');
  await mkdir(fixtureDir, { recursive: true });
  const uiSpecifier = `file:${relative(fixtureDir, uiTarball)}`;
  await writeFile(join(fixtureDir, 'package.json'), JSON.stringify({
    name: 'lr-packed-docs-consumer', private: true, type: 'module',
    dependencies: { '@aceshooting/lyra-docs': `file:${relative(fixtureDir, docsTarball)}`, '@aceshooting/lyra-ui': uiSpecifier },
    pnpm: { overrides: { '@aceshooting/lyra-ui': uiSpecifier } },
  }));
  await writeFile(join(fixtureDir, 'load.mjs'), `globalThis.customElements = { get: () => undefined, define: () => { throw new Error('Unexpected registration'); } };
const { createDocxSession } = await import('@aceshooting/lyra-docs/docx');
const { LyraDocxEditor } = await import('@aceshooting/lyra-docs/docx/editor.class');
if (typeof createDocxSession !== 'function' || typeof LyraDocxEditor !== 'function') throw new Error('Missing lyra-docs export');
await import('@aceshooting/lyra-docs');
import.meta.resolve('@aceshooting/lyra-docs/docx/editor');
`);
  await run(pnpm, ['install', '--ignore-scripts', '--config.auto-install-peers=false'], fixtureDir, 'lyra-docs fixture install');
  await run(process.execPath, ['load.mjs'], fixtureDir, 'lyra-docs entry load check');
}

/** Shared companion checks: no workspace: leak, and a lyra-ui peer range that accepts the lyra-ui packed beside it. */
function verifyPackedCompanionManifest({ label, manifest, uiTarball }) {
  const ranges = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    .flatMap((section) => Object.values(manifest[section] ?? {}));
  assert.deepEqual(ranges.filter((range) => String(range).startsWith('workspace:')), [], `${label} leaks workspace: ranges`);
  const uiVersion = packedManifest(uiTarball).version;
  const uiRange = manifest.peerDependencies?.['@aceshooting/lyra-ui'];
  assert.equal(uiRange, `^${uiVersion}`, `${label} requires @aceshooting/lyra-ui ${uiRange}, packed beside ${uiVersion}`);
  assert.equal(manifest.version, uiVersion, `${label} must be versioned with the lyra-ui packed beside it`);
  return uiVersion;
}

/** lyra-translations as consumers install it: catalogs register through the installed lyra-ui, and the lazy loader reaches them. */
async function verifyPackedTranslationsPackage({ workspace, uiTarball, translationsTarball }) {
  verifyPackedCompanionManifest({ label: 'lyra-translations', manifest: packedManifest(translationsTarball), uiTarball });
  await run(pnpm, ['exec', 'publint', 'run', '--strict', '--pack=false', translationsTarball], root, 'lyra-translations publint package check');
  const fixtureDir = join(workspace, 'translations-consumer');
  await mkdir(fixtureDir, { recursive: true });
  const uiSpecifier = `file:${relative(fixtureDir, uiTarball)}`;
  await writeFile(join(fixtureDir, 'package.json'), JSON.stringify({
    name: 'lr-packed-translations-consumer', private: true, type: 'module',
    dependencies: { '@aceshooting/lyra-translations': `file:${relative(fixtureDir, translationsTarball)}`, '@aceshooting/lyra-ui': uiSpecifier },
    pnpm: { overrides: { '@aceshooting/lyra-ui': uiSpecifier } },
  }));
  await writeFile(join(fixtureDir, 'load.mjs'), `import '@aceshooting/lyra-translations/fr.js';
import '@aceshooting/lyra-translations/ar/forms.js';
import { getRegisteredLyraLocales } from '@aceshooting/lyra-ui/localization.js';
import { loadLyraLocale } from '@aceshooting/lyra-ui/locale-loader.js';
await loadLyraLocale('de');
const registered = getRegisteredLyraLocales();
for (const locale of ['fr', 'ar', 'de']) {
  if (!registered.includes(locale)) throw new Error('the packed ' + locale + ' catalog did not register through lyra-ui');
}
// Assembled so the export-reachability lint reads these deliberately absent subpaths as non-literals.
for (const specifier of ['translations/fr.js', 'custom-elements.json'].map((subpath) => '@aceshooting/lyra-ui/' + subpath)) {
  let resolved;
  try { resolved = import.meta.resolve(specifier); } catch { resolved = undefined; }
  if (resolved) throw new Error(specifier + ' must not resolve from lyra-ui');
}
`);
  await run(pnpm, ['install', '--ignore-scripts', '--config.auto-install-peers=false'], fixtureDir, 'lyra-translations fixture install');
  await run(process.execPath, ['load.mjs'], fixtureDir, 'lyra-translations load check');
}

/** lyra-ide as consumers install it: every data file resolves through its export, and the manifest field points at the manifest. */
async function verifyPackedIdePackage({ workspace, uiTarball, ideTarball }) {
  const manifest = packedManifest(ideTarball);
  const uiVersion = verifyPackedCompanionManifest({ label: 'lyra-ide', manifest, uiTarball });
  await run(pnpm, ['exec', 'publint', 'run', '--strict', '--pack=false', ideTarball], root, 'lyra-ide publint package check');
  const fixtureDir = join(workspace, 'ide-consumer');
  await mkdir(fixtureDir, { recursive: true });
  const uiSpecifier = `file:${relative(fixtureDir, uiTarball)}`;
  await writeFile(join(fixtureDir, 'package.json'), JSON.stringify({
    name: 'lr-packed-ide-consumer', private: true, type: 'module',
    dependencies: { '@aceshooting/lyra-ide': `file:${relative(fixtureDir, ideTarball)}`, '@aceshooting/lyra-ui': uiSpecifier },
    pnpm: { overrides: { '@aceshooting/lyra-ui': uiSpecifier } },
  }));
  await writeFile(join(fixtureDir, 'load.mjs'), `import { readFile } from 'node:fs/promises';
const read = async (specifier) => JSON.parse(await readFile(new URL(import.meta.resolve(specifier)), 'utf8'));
const cem = await read('@aceshooting/lyra-ide/custom-elements.json');
if (!Array.isArray(cem.modules) || cem.modules.length === 0) throw new Error('the packed Custom Elements Manifest has no modules');
const webTypes = await read('@aceshooting/lyra-ide/web-types.json');
if (webTypes.version !== ${JSON.stringify(uiVersion)}) throw new Error('web-types describes ' + webTypes.version);
if (!(await read('@aceshooting/lyra-ide/vscode-html-data.json')).tags?.length) throw new Error('vscode-html-data has no tags');
if (!(await read('@aceshooting/lyra-ide/vscode-css-data.json')).properties?.length) throw new Error('vscode-css-data has no properties');
`);
  await run(pnpm, ['install', '--ignore-scripts', '--config.auto-install-peers=false'], fixtureDir, 'lyra-ide fixture install');
  await run(process.execPath, ['load.mjs'], fixtureDir, 'lyra-ide data load check');
}

// pnpm substitutes every workspace: specifier for a real semver range when `pnpm pack` runs, so
// this has never actually leaked -- but nothing asserted that, and a future pnpm/config change or
// a hand-edited fixture could silently break it for real npm/yarn consumers, who cannot resolve
// the workspace: protocol at all. Reads the fixture's own installed copy (already `pnpm pack`'d
// and `pnpm install`'d by the time this runs), not the monorepo source package.json.
async function verifyNoWorkspaceProtocolLeaked(fixtureDir) {
  const packageRoot = join(fixtureDir, 'node_modules', '@aceshooting', 'lyra-ui');
  const packedPackageJson = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
  const leaked = [];
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, range] of Object.entries(packedPackageJson[section] ?? {})) {
      if (typeof range === 'string' && range.startsWith('workspace:')) {
        leaked.push(`${section}.${name}: ${range}`);
      }
    }
  }
  if (leaked.length > 0) {
    throw new Error(
      `Packed package.json must not retain the pnpm-only workspace: protocol -- real npm/yarn ` +
        `consumers cannot resolve it: ${leaked.join(', ')}`,
    );
  }
}

async function verifyPackedMigrationCli(fixtureDir) {
  const packageRoot = join(fixtureDir, 'node_modules', '@aceshooting', 'lyra-ui');
  const cliFiles = (await readdir(join(packageRoot, 'dist', 'cli'))).sort();
  const expectedCliFiles = [
    'agent-registry.mjs',
    'component-inventory.mjs',
    'css-declarations.mjs',
    'html-comments.mjs',
    'init-agents.mjs',
    'is-main-module.mjs',
    'lyra-rename-ledger.mjs',
    'lyra-ui.mjs',
    'migrate-wa.mjs',
    'migration-analysis.mjs',
    'migration-contract.json',
    'migration-contract.mjs',
    'migration-renames.mjs',
    'migration-theme-scopes.mjs',
    'migration-transforms.mjs',
    'theme-scope-vocabulary.generated.mjs',
  ];
  if (JSON.stringify(cliFiles) !== JSON.stringify(expectedCliFiles)) {
    throw new Error(
      `Packed migration runtime must contain only ${expectedCliFiles.join(', ')}; found ${cliFiles.join(', ') || 'none'}`,
    );
  }

  const migrationFixture = join(fixtureDir, 'migration-cli');
  await mkdir(migrationFixture, { recursive: true });
  const registration = join(migrationFixture, 'registration.ts');
  const markup = join(migrationFixture, 'component.html');
  const stylesheet = join(migrationFixture, 'component.css');
  await Promise.all([
    writeFile(
      registration,
      "import '@awesome.me/webawesome/dist/components/accordion-item/accordion-item.js';\n",
    ),
    writeFile(markup, '<wa-accordion-item>Panel</wa-accordion-item>\n'),
    writeFile(stylesheet, 'wa-accordion-item::part(base) { color: currentColor; }\n'),
  ]);

  const executable = join(fixtureDir, 'node_modules', '.bin', binName('lyra-ui-migrate'));
  await run(executable, [migrationFixture], fixtureDir, 'packed migration CLI apply check');
  await run(executable, ['--check', migrationFixture], fixtureDir, 'packed migration CLI idempotence check');
  // The Lyra rename profile must load from the packed projection alone; the migrated fixture uses
  // only current names, so it has nothing to rewrite or report.
  await run(
    executable,
    ['--origin=lyra-v21', '--check', migrationFixture],
    fixtureDir,
    'packed migration CLI Lyra rename profile check',
  );

  const migrated = await Promise.all([
    readFile(registration, 'utf8'),
    readFile(markup, 'utf8'),
    readFile(stylesheet, 'utf8'),
  ]);
  const expected = [
    "import '@aceshooting/lyra-ui/components/lr-accordion-item.js';\n",
    '<lr-accordion-item>Panel</lr-accordion-item>\n',
    'lr-accordion-item::part(base) { color: currentColor; }\n',
  ];
  if (JSON.stringify(migrated) !== JSON.stringify(expected)) {
    throw new Error(`Packed migration CLI produced unexpected output:\n${migrated.join('\n')}`);
  }
}

async function verifyPackedInitAgents(fixtureDir) {
  const projectDir = join(fixtureDir, 'init-agents-project');
  await mkdir(projectDir, { recursive: true });
  const executable = join(fixtureDir, 'node_modules', '.bin', binName('lyra-ui'));
  const packageRoot = join(fixtureDir, 'node_modules', '@aceshooting', 'lyra-ui');
  for (const skill of ['lyra-ui', 'compose-lyra-interfaces']) {
    await stat(join(packageRoot, 'skills', skill, 'SKILL.md'));
  }
  await stat(join(packageRoot, 'skills', 'lyra-ui', 'commands', 'review.md'));
  // The bundled references must resolve inside the installed package, not the plugin.
  const skillText = await readFile(join(packageRoot, 'skills', 'lyra-ui', 'SKILL.md'), 'utf8');
  if (!skillText.includes('node_modules/@aceshooting/lyra-ui/llms/components/') && !skillText.includes('node_modules/@aceshooting/lyra-ui/llms/index.md')) {
    throw new Error('Bundled lyra-ui skill does not point at the package llms/ directory.');
  }
  await stat(join(packageRoot, 'llms', 'index.md'));
  await run(executable, ['init-agents', '--yes', '--dir', projectDir], fixtureDir, 'packed init-agents apply');
  for (const skill of ['lyra-ui', 'compose-lyra-interfaces']) {
    await stat(join(projectDir, '.agents', 'skills', skill, 'SKILL.md'));
  }
  const agents = await readFile(join(projectDir, 'AGENTS.md'), 'utf8');
  if (!agents.includes('<!-- lyra-ui:start -->') || !agents.includes('node_modules/@aceshooting/lyra-ui/llms.txt')) {
    throw new Error('Packed init-agents did not write its AGENTS.md block.');
  }
  await run(executable, ['init-agents', '--yes', '--dir', projectDir], fixtureDir, 'packed init-agents idempotence');
  if ((await readFile(join(projectDir, 'AGENTS.md'), 'utf8')) !== agents) {
    throw new Error('Packed init-agents is not idempotent for AGENTS.md.');
  }
}

async function writeFixture(
  fixtureDir,
  packageTarball,
  flagsTarball,
  withOptionalPeers,
  maplibreVersion = '^6.0.0',
  performanceBaselineTarball,
  translationsTarball,
) {
  const dependencies = {
    '@aceshooting/lyra-ui': `file:${relative(fixtureDir, packageTarball)}`,
    '@aceshooting/lyra-translations': `file:${relative(fixtureDir, translationsTarball)}`,
    lit: uiPackageJson.dependencies.lit,
  };
  if (performanceBaselineTarball) {
    dependencies['lyra-ui-v23'] = `file:${relative(fixtureDir, performanceBaselineTarball)}`;
  }
  if (withOptionalPeers) dependencies['@aceshooting/lyra-flags'] = `file:${relative(fixtureDir, flagsTarball)}`;

  const devDependencies = {
    // These fixtures intentionally use npm as well as pnpm. Floating either edge can make npm
    // resolve a newly-published, mutually-incompatible Vite/TypeScript pair before any Lyra
    // declaration or bundle assertion runs, turning this contract test into an upstream
    // resolver lottery. Pin the exact toolchain already exercised by this repository's lockfile.
    typescript: '7.0.2',
    vite: '8.1.5',
  };
  if (withOptionalPeers) {
    Object.assign(devDependencies, {
      ...FIXTURE_OPTIONAL_PEERS,
      'maplibre-gl': maplibreVersion,
    });
  }

  await writeFile(
    join(fixtureDir, 'package.json'),
    `${JSON.stringify(
      {
        name: withOptionalPeers
          ? `lr-packed-consumer-with-maplibre-${maplibreVersion.startsWith('^5') ? 'v5' : 'v6'}`
          : 'lr-packed-consumer-core',
        private: true,
        type: 'module',
        dependencies,
        devDependencies,
        // Rolldown's optional WASI binding currently permits @napi-rs/wasm-runtime ^1.1.6, but
        // 1.2 switched its @emnapi peers to the incompatible 2.x alpha line while the binding
        // still installs @emnapi 1.11.1. npm --strict-peer-deps rejects that optional fallback
        // before reaching any Lyra assertion, even on platforms that use a native binding.
        overrides: {
          '@napi-rs/wasm-runtime': '1.1.6',
        },
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(join(fixtureDir, '.npmrc'), 'auto-install-peers=false\n');

  await writeFile(
    join(fixtureDir, 'src', 'node-imports.mjs'),
    `if (typeof document !== 'undefined') {
  throw new Error('plain Node unexpectedly exposes a document before the package import');
}
const root = await import('@aceshooting/lyra-ui');
const ssr = await import('@aceshooting/lyra-ui/ssr.js');
const hydration = await import('@aceshooting/lyra-ui/hydration.js');
let retiredSsrRouteError;
try {
  // Keep this retired-route probe computed so check-script-paths continues treating it as a
  // runtime-negative assertion instead of a consumer dependency on an unexported subpath.
  const retiredSsrSpecifier = ['@aceshooting/lyra-ui', 'ssr-loader.js'].join('/');
  await import(retiredSsrSpecifier);
} catch (error) {
  retiredSsrRouteError = error;
}
const granularClass = await import('@aceshooting/lyra-ui/components/overlays/empty/empty.class.js');
const emptyRegistration = await import('@aceshooting/lyra-ui/components/lr-empty.js');
await import('@aceshooting/lyra-ui/components/conversation/code-block/code-loader.js');
await import('@aceshooting/lyra-ui/components/media/map/map-loader.js');
await import('@aceshooting/lyra-ui/components/conversation/markdown/markdown-loader.js');
await import('@aceshooting/lyra-ui/components/retrieval/graph/graph-loader.js');
await import('@aceshooting/lyra-ui/components/lr-chart.js');
await import('@aceshooting/lyra-ui/components/lr-code-block.js');
await import('@aceshooting/lyra-ui/components/lr-graph.js');
await import('@aceshooting/lyra-ui/components/lr-map.js');
// The curated './utilities/*' subpath, not './internal/*': 'internal/' is deliberately absent
// from the package's "exports" map (only 'utilities/' is semver-covered), so importing it here
// would assert a contract the package does not offer -- and Node fails it with
// ERR_PACKAGE_PATH_NOT_EXPORTED.
const prefix = await import('@aceshooting/lyra-ui/utilities/prefix.js');

if ('LyraEmpty' in root || typeof granularClass.LyraEmpty !== 'function') {
  throw new Error('the root exposed a retired constructor or the canonical class import failed');
}
if (
  prefix.tag('empty') !== 'lr-empty' ||
  emptyRegistration.LyraEmpty !== granularClass.LyraEmpty ||
  customElements.get('lr-empty') !== granularClass.LyraEmpty
) {
  throw new Error('canonical registration, class, and prefix imports did not expose the expected contract');
}
if (typeof document !== 'undefined') {
  throw new Error('the package imports created a browser document in plain Node');
}
if (
  typeof ssr.LyraSsrFallbackRenderer !== 'function' ||
  typeof ssr.lyraSsrElementRenderers !== 'function' ||
  typeof ssr.getLyraSsrMode !== 'function' ||
  typeof ssr.diagnoseLyraHydration !== 'function' ||
  ssr.LYRA_SSR_SUPPORT_MATRIX.imports.root !== 'server-safe' ||
  ssr.getLyraSsrMode('lr-page') !== 'render-and-hydrate' ||
  typeof hydration !== 'object'
) {
  throw new Error('the explicit SSR diagnostics and browser hydration entries did not expose their contracts');
}
if (retiredSsrRouteError?.code !== 'ERR_PACKAGE_PATH_NOT_EXPORTED') {
  throw new Error('the deprecated SSR loader route remained importable from the packed package');
}
if ((await ssr.diagnoseLyraHydration()).length !== 0) {
  throw new Error('SSR diagnostics should be an empty result without browser globals');
}
console.log('Node ESM package imports passed.');
`,
  );
  // The 8.0.0 registration split's whole contract, asserted in ONE fresh module registry so the
  // three stages are ordered rather than independently true: the root must not register the
  // library, a granular entry must register exactly one tag, and `all.js` must register the whole
  // root-included set and nothing from an optional-peer family. Split across processes each stage
  // would still pass with the other two broken. Registered-tag counts come from the same inventory
  // `src/all.ts` is generated from, so a new component is covered the day it is scaffolded.
  await writeFile(
    join(fixtureDir, 'src', 'node-registration-contract.mjs'),
    `const ROOT_EXPECTED_TAGS = ${JSON.stringify(rootHelperRegisteredTags)};
const ROOT_INCLUDED_TAGS = ${JSON.stringify(rootIncludedTags)};
const OPTIONAL_PEER_TAGS = ${JSON.stringify(optionalPeerFamilyTags)};
const EVERY_TAG = [...ROOT_INCLUDED_TAGS, ...OPTIONAL_PEER_TAGS];
const definedAmong = (tags) => tags.filter((tag) => customElements.get(tag) !== undefined);

// 1. The root entry carries the curated helper/type surface without component constructors or registrations.
const root = await import('@aceshooting/lyra-ui');
if ('LyraEmpty' in root || typeof root.LyraElement !== 'function') {
  throw new Error('the package root exposed a component constructor or lost the LyraElement utility');
}
const afterRoot = definedAmong(EVERY_TAG).join(',');
if (afterRoot !== ROOT_EXPECTED_TAGS.join(',')) {
  throw new Error(
    'importing the package root registered an unexpected component set.\\n' +
      '  expected: ' + (ROOT_EXPECTED_TAGS.join(',') || '(none)') + '\\n' +
      '  actual: ' + (afterRoot || '(none)'),
  );
}

// 2. The canonical tag-shaped registration entry registers exactly its tag and the nested class module.
const emptyClass = await import('@aceshooting/lyra-ui/components/overlays/empty/empty.class.js');
const emptyRegistration = await import('@aceshooting/lyra-ui/components/lr-empty.js');
if (customElements.get('lr-empty') !== emptyClass.LyraEmpty || emptyRegistration.LyraEmpty !== emptyClass.LyraEmpty) {
  throw new Error('the canonical registration and class routes did not preserve constructor identity');
}
const afterGranular = definedAmong(EVERY_TAG).join(',');
const expectedAfterGranular = [...ROOT_EXPECTED_TAGS, 'lr-empty'].sort().join(',');
if (afterGranular !== expectedAfterGranular) {
  throw new Error(
    'a granular registration entry registered more than its own tag.\\n' +
      '  expected: ' + expectedAfterGranular + '\\n' +
      '  actual:   ' + afterGranular,
  );
}

// 3. all.js is the compatibility path: every root-included tag, and no optional-peer family.
await import('@aceshooting/lyra-ui/all.js');
const unregistered = ROOT_INCLUDED_TAGS.filter((tag) => customElements.get(tag) === undefined);
if (unregistered.length > 0) {
  throw new Error(
    'all.js left ' + unregistered.length + ' of ' + ROOT_INCLUDED_TAGS.length +
      ' root-included tag(s) unregistered: ' + unregistered.slice(0, 10).join(','),
  );
}
const leaked = definedAmong(OPTIONAL_PEER_TAGS);
if (leaked.length > 0) {
  throw new Error('all.js registered optional-peer-family tag(s): ' + leaked.join(','));
}
console.log(
  'Registration-split contract passed (root registers no tags; all.js registers ' +
    ROOT_INCLUDED_TAGS.length + ').',
);
`,
  );

  await writeFile(
    join(fixtureDir, 'src', 'node-localization-import.mjs'),
    `const localization = await import('@aceshooting/lyra-ui/localization.js');
if (typeof document !== 'undefined') {
  throw new Error('plain Node unexpectedly exposes a document before the localization import');
}
if (
  typeof localization.registerLyraLocale !== 'function' ||
  typeof localization.setLyraLocale !== 'function' ||
  typeof localization.resolveLyraString !== 'function' ||
  typeof localization.bridgeLyraLocale !== 'function' ||
  typeof localization.subscribeLyraLocale !== 'function' ||
  typeof localization.resolveLyraScopedString !== 'function' ||
  'LyraElement' in localization
) {
  throw new Error('the side-effect-free localization entry exposed the wrong surface');
}
localization.registerLyraLocale('packed-consumer', { close: 'Close packed consumer' });
if (!localization.getRegisteredLyraLocales().includes('packed-consumer')) {
  throw new Error('the public localization registry did not retain a registered locale');
}
console.log('Side-effect-free localization import passed.');
`,
  );

  await writeFile(
    join(fixtureDir, 'src', 'node-autoloader-import.mjs'),
    `const hadDocument = typeof document !== 'undefined';
const hadRegistry = typeof customElements !== 'undefined';
const autoloader = await import('@aceshooting/lyra-ui/autoloader.js');
const defined = await import('@aceshooting/lyra-ui/utilities/defined.js');
if (hadDocument || hadRegistry || typeof document !== 'undefined' || typeof customElements !== 'undefined') {
  throw new Error('the side-effect-free autoloader entries created browser globals in plain Node');
}
if (
  typeof autoloader.discover !== 'function' ||
  typeof autoloader.start !== 'function' ||
  typeof autoloader.stop !== 'function' ||
  typeof defined.allDefined !== 'function'
) {
  throw new Error('the packed autoloader entries did not expose their public functions');
}
if ((await autoloader.discover()).length !== 0 || (await autoloader.start()).length !== 0) {
  throw new Error('browser-guarded autoloader functions must resolve inertly in plain Node');
}
autoloader.stop();
await defined.allDefined();
console.log('Server-safe autoloader package imports passed.');
`,
  );

  await writeFile(
    join(fixtureDir, 'src', 'node-gemstones-data-import.mjs'),
    `const palette = await import('@aceshooting/lyra-ui/theme/gemstones-data.js');
if (typeof document !== 'undefined') {
  throw new Error('plain Node unexpectedly exposes a document before the palette import');
}
if (palette.DEFAULT_GEMSTONE !== 'emerald' || palette.GEMSTONE_KEYS.length !== 9) {
  throw new Error('the Lit-free gemstone data entry did not expose the expected palette');
}
console.log('Lit-free gemstone data import passed.');
`,
  );

  await writeFile(
    join(fixtureDir, 'src', 'typecheck.ts'),
    `import {
  defineElement,
  tag,
} from '@aceshooting/lyra-ui';
import { LyraEmpty } from '@aceshooting/lyra-ui/components/overlays/empty/empty.class.js';
import { LyraDialog } from '@aceshooting/lyra-ui/components/overlays/dialog/dialog.class.js';
import { LyraTable } from '@aceshooting/lyra-ui/components/data/table/table.class.js';
import { loadChartAndZoom } from '@aceshooting/lyra-ui/components/charts/chart/chart-feature-loader.js';
import { loadMaplibre } from '@aceshooting/lyra-ui/components/media/map/map-loader.js';
import { loadMarkdownAndSanitizer } from '@aceshooting/lyra-ui/components/conversation/markdown/markdown-loader.js';
import { loadShikiHighlighter } from '@aceshooting/lyra-ui/components/conversation/code-block/code-loader.js';
import { loadD3 } from '@aceshooting/lyra-ui/components/retrieval/graph/graph-loader.js';
import { seriesPalette } from '@aceshooting/lyra-ui/components/charts/chart/chart.class.js';
import { createLyraThemeBootstrap } from '@aceshooting/lyra-ui/theme.js';
import {
  getRegisteredLyraLocales,
  registerLyraLocale,
  type LyraLocaleStrings,
  type LyraMessageKey,
} from '@aceshooting/lyra-ui/localization.js';
import {
  DEFAULT_GEMSTONE,
  GEMSTONE_KEYS,
  GEMSTONES,
} from '@aceshooting/lyra-ui/theme/gemstones-data.js';
import {
  LYRA_SSR_CLIENT_RENDER_TAGS,
  LYRA_SSR_RENDER_AND_HYDRATE_TAGS,
  LYRA_SSR_SUPPORT_MATRIX,
  LyraSsrFallbackRenderer,
  diagnoseLyraHydration,
  getLyraSsrMode,
  lyraSsrElementRenderers,
  type LyraHydrationDiagnostic,
  type LyraSsrMode,
} from '@aceshooting/lyra-ui/ssr.js';
import {
  AUTOLOADER_PENDING_ATTRIBUTE,
  discover,
  start,
  stop,
  type AutoloadableTagName,
  type AutoloaderErrorEventDetail,
  type AutoloaderEventDetail,
  type AutoloaderEventMap,
  type AutoloaderOptions,
  type AutoloaderTraversalErrorEventDetail,
} from '@aceshooting/lyra-ui/autoloader.js';
import { allDefined, type AllDefinedOptions } from '@aceshooting/lyra-ui/utilities/defined.js';
import type {
  LyraChartEventMap,
  LyraGlobalEventMap,
  LyraGraphEventMap,
  LyraMarkedParser,
  LyraMapEventMap,
  LyraSize,
  MarkdownHeadingItem,
  MessageFeedbackRating,
  MessageFeedbackValue,
  ShikiLanguageInput,
} from '@aceshooting/lyra-ui';
import type {
  LyraMarkedParser as GranularMarkedParser,
  MarkdownHeadingItem as GranularHeadingItem,
  ShikiLanguageInput as GranularLanguageInput,
} from '@aceshooting/lyra-ui/components/lr-markdown.js';
import type { LyraImageFit as LightboxImageFit } from '@aceshooting/lyra-ui/components/lr-lightbox.js';
import type { LyraImageFit as PanZoomImageFit } from '@aceshooting/lyra-ui/components/lr-pan-zoom.js';
import type { LyraImageFit as ImageViewerImageFit } from '@aceshooting/lyra-ui/components/lr-image-viewer.js';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Assert<Value extends true> = Value;
type LightboxFitMatchesImageViewer = Assert<Equal<LightboxImageFit, ImageViewerImageFit>>;
type PanZoomFitMatchesImageViewer = Assert<Equal<PanZoomImageFit, ImageViewerImageFit>>;

const name: string = tag('empty');
const Empty = LyraEmpty;
const dialog = new LyraDialog();
const table = new LyraTable();
const events: [LyraChartEventMap, LyraGraphEventMap, LyraMapEventMap] | undefined = undefined;
const conversationTypes: [
  LyraMarkedParser,
  LyraSize,
  MarkdownHeadingItem,
  MessageFeedbackRating,
  MessageFeedbackValue,
  ShikiLanguageInput,
  GranularMarkedParser,
  GranularHeadingItem,
  GranularLanguageInput,
] | undefined = undefined;
const localeStrings: LyraLocaleStrings = { close: 'Close' };
const localeKey: LyraMessageKey = 'close';
const mediaFit: ImageViewerImageFit = 'contain';
const lightboxFit: LightboxImageFit = mediaFit;
const panZoomFit: PanZoomImageFit = lightboxFit;
// @ts-expect-error The packed image-fit type exposes only the supported fit modes.
const unsupportedMediaFit: PanZoomImageFit = 'cover';
declare const sharedMediaFitContract: [LightboxFitMatchesImageViewer, PanZoomFitMatchesImageViewer];
registerLyraLocale('packed-typecheck', localeStrings);
defineElement('consumer-empty', Empty);
void conversationTypes;

class PackedLitElementRenderer {
  static matchesClass(
    _constructor: CustomElementConstructor,
    _tagName: string,
    _attributes: Map<string, string>,
  ): boolean {
    return true;
  }

  constructor(_tagName: string) {}
}

const ssrRenderers = lyraSsrElementRenderers(PackedLitElementRenderer);
const fallbackRenderer: typeof LyraSsrFallbackRenderer = ssrRenderers[0];
const ssrMode: LyraSsrMode | undefined = getLyraSsrMode('lr-page');
const hydrationDiagnostics: Promise<readonly LyraHydrationDiagnostic[]> = diagnoseLyraHydration();
const ssrImports: 'server-safe' = LYRA_SSR_SUPPORT_MATRIX.imports.root;
const ssrHydratedTag: string | undefined = LYRA_SSR_RENDER_AND_HYDRATE_TAGS[0];
const ssrFallbackTag: string | undefined = LYRA_SSR_CLIENT_RENDER_TAGS[0];
const autoloaderOptions: AutoloaderOptions = {
  optionalPeers: ['dompurify'],
  events: true,
  maxElements: 10_000,
  maxRoots: 2_000,
  maxDepth: 256,
  maxWork: 100_000,
  maxConcurrency: 16,
};
const autoloadedTags: Promise<readonly AutoloadableTagName[]> = discover(document, autoloaderOptions);
const autoloaderStarted: Promise<readonly AutoloadableTagName[]> = start(document);
const allDefinedOptions: AllDefinedOptions = {
  maxElements: 10_000,
  maxRoots: 2_000,
  maxDepth: 256,
  maxWork: 100_000,
  maxPasses: 100,
};
const allDefinitions: Promise<void> = allDefined(document, allDefinedOptions);
const autoloaderDetail: AutoloaderEventDetail = { tag: 'lr-button', optionalPeers: [] };
const autoloaderErrorDetail: AutoloaderErrorEventDetail = {
  ...autoloaderDetail,
  error: new Error('packed type fixture'),
};
const autoloaderErrorEvent: AutoloaderEventMap['lr-autoload-error'] = new CustomEvent(
  'lr-autoload-error',
  { detail: autoloaderErrorDetail },
);
const traversalErrorDetail: AutoloaderTraversalErrorEventDetail = {
  limit: 'maxElements',
  maximum: 10_000,
  error: new Error('packed traversal fixture'),
};
const traversalErrorEvent: LyraGlobalEventMap['lr-autoload-traversal-error'] = new CustomEvent(
  'lr-autoload-traversal-error',
  { detail: traversalErrorDetail },
);
document.addEventListener('lr-autoload-traversal-error', (event) => {
  const maximum: number = event.detail.maximum;
  void maximum;
});
const autoloaderMarker: string = AUTOLOADER_PENDING_ATTRIBUTE;
stop();
void [
  name,
  dialog,
  table,
  events,
  loadChartAndZoom,
  loadMaplibre,
  loadMarkdownAndSanitizer,
  loadShikiHighlighter,
  loadD3,
  seriesPalette,
  createLyraThemeBootstrap,
  getRegisteredLyraLocales,
  localeKey,
  mediaFit,
  lightboxFit,
  panZoomFit,
  unsupportedMediaFit,
  sharedMediaFitContract,
  DEFAULT_GEMSTONE,
  GEMSTONE_KEYS,
  GEMSTONES,
  fallbackRenderer,
  ssrMode,
  hydrationDiagnostics,
  ssrImports,
  ssrHydratedTag,
  ssrFallbackTag,
  autoloadedTags,
  autoloaderStarted,
  allDefinitions,
  allDefinedOptions,
  autoloaderDetail,
  autoloaderErrorDetail,
  autoloaderErrorEvent,
  traversalErrorDetail,
  traversalErrorEvent,
  autoloaderMarker,
];
`,
  );
  await writeFile(
    join(fixtureDir, 'tsconfig.json'),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          lib: ['ES2022', 'DOM'],
          strict: true,
          skipLibCheck: false,
          noEmit: true,
        },
        include: ['src/typecheck.ts'],
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(
    join(fixtureDir, 'vite.config.mjs'),
    `import { defineConfig } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const optionalPeers = ${JSON.stringify(optionalPeers)};
const noOptionalPeers = process.env.LYRA_NO_OPTIONAL_PEERS === '1';
const entry = process.env.LYRA_BUNDLE_ENTRY;
const hasStaticFallback = entry.startsWith('firstInteraction');

export default defineConfig({
  plugins: [
    {
      // Write diagnostics beside (not inside) the measured output. Module edges distinguish an
      // allowed lazy peer import from an eager one; emitted chunk modules independently catch a
      // peer that bypassed externalization and was physically bundled.
      name: 'packed-consumer-graph',
      writeBundle(_options, bundle) {
        const chunks = Object.values(bundle)
          .filter((output) => output.type === 'chunk')
          .map((chunk) => ({
            fileName: chunk.fileName,
            isEntry: chunk.isEntry,
            imports: chunk.imports,
            dynamicImports: chunk.dynamicImports,
            modules: Object.keys(chunk.modules),
          }));
        const modules = [...this.getModuleIds()].map((id) => {
          const info = this.getModuleInfo(id);
          return {
            id,
            isEntry: info?.isEntry === true,
            importedIds: info?.importedIds ?? [],
            dynamicallyImportedIds: info?.dynamicallyImportedIds ?? [],
          };
        });
        writeFileSync(
          resolve(process.cwd(), \`.packed-consumer-\${entry}-graph.json\`),
          JSON.stringify({ chunks, modules }),
        );
      },
    },
  ],
  build: {
    outDir: resolve(process.cwd(), 'bundle', entry),
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(process.cwd(), 'src', \`bundle-\${entry}.\${hasStaticFallback ? 'html' : 'ts'}\`),
      external: noOptionalPeers
        ? (id) =>
            // The locale entry measures the catalogs themselves, so they bundle into one registry.
            !(entry === 'locale' && id.startsWith('@aceshooting/lyra-translations')) &&
            optionalPeers.some((peer) => id === peer || id.startsWith(\`\${peer}/\`))
        : [],
      output: {
        entryFileNames: 'index.js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
`,
  );

  const bundleSources = {
    core: `import '@aceshooting/lyra-ui/all.js';\nexport const loaded = true;\n`,
    rootBarrel: `import '@aceshooting/lyra-ui';\nexport const loaded = true;\n`,
    button: `import '@aceshooting/lyra-ui/components/lr-button.js';\nexport const loaded = true;\n`,
    formControlLabel: `import '@aceshooting/lyra-ui/components/lr-input.js';\nexport const loaded = true;\n`,
    anchoredPopover: `import '@aceshooting/lyra-ui/components/lr-popover.js';\nexport const loaded = true;\n`,
    anchoredCombobox: `import '@aceshooting/lyra-ui/components/lr-combobox.js';\nexport const loaded = true;\n`,
    theme: `import '@aceshooting/lyra-ui/theme.css';\nexport const loaded = true;\n`,
    shadcnTheme: `import '@aceshooting/lyra-ui/looks/shadcn.css';\nimport '@aceshooting/lyra-ui/theme.css';\nexport const loaded = true;\n`,
    nativeStyles: `import '@aceshooting/lyra-ui/native.css';\nexport const loaded = true;\n`,
    utilitiesStyles: `import '@aceshooting/lyra-ui/utilities.css';\nexport const loaded = true;\n`,
    reservationStyles: `import '@aceshooting/lyra-ui/reservations.css';\nexport const loaded = true;\n`,
    locale: `import '@aceshooting/lyra-translations/fa.js';
import '@aceshooting/lyra-translations/fr.js';
import '@aceshooting/lyra-translations/he.js';
import { getRegisteredLyraLocales } from '@aceshooting/lyra-ui/localization.js';
const registered = getRegisteredLyraLocales();
for (const locale of ['fa', 'fr', 'he']) {
  if (!registered.includes(locale)) {
    throw new Error(\`the packed \${locale} locale side effect was tree-shaken\`);
  }
}
export const loaded = true;
`,
    autoloaderTreeShaken: `import '@aceshooting/lyra-ui/autoloader.js';
export const loaded = true;
`,
    autoloaderCdn: `import '@aceshooting/lyra-ui/autoloader-cdn.js';
export const loaded = true;
`,
    ssrHydration: `import '@aceshooting/lyra-ui/hydration.js';
export const loaded = true;
`,
    flag: `import flagUrl from '@aceshooting/lyra-flags/flags/fr.svg';\nexport { flagUrl };\n`,
    codeBlock: `import '@aceshooting/lyra-ui/components/lr-code-block.js';\nexport const loaded = true;\n`,
    chart: `import '@aceshooting/lyra-ui/components/lr-chart.js';\nexport const loaded = true;\n`,
    map: maplibreVersion.startsWith('^5')
      ? `import '@aceshooting/lyra-ui/components/lr-map.js';
import 'maplibre-gl/dist/maplibre-gl.css';
export const loaded = true;
`
      : `import '@aceshooting/lyra-ui/components/lr-map.js';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
setWorkerUrl(workerUrl);
export const loaded = true;
`,
    graph: `import '@aceshooting/lyra-ui/components/lr-graph.js';\nexport const loaded = true;\n`,
  };
  await Promise.all(
    Object.entries(bundleSources).map(([name, source]) => writeFile(join(fixtureDir, 'src', `bundle-${name}.ts`), source)),
  );
  const firstInteractionSources = {
    firstInteractionPopover: `<!doctype html>
<meta charset="utf-8">
<details id="fallback-popover">
  <summary>Account</summary>
  <nav aria-label="Account"><a href="/profile">Profile</a></nav>
</details>
<lr-popover id="enhanced-popover" popup-role="none" hidden>
  <button slot="trigger" type="button">Account</button>
  <nav aria-label="Account"><a href="/profile">Profile</a></nav>
</lr-popover>
<script type="module">
  const fallback = document.querySelector('#fallback-popover');
  const enhanced = document.querySelector('#enhanced-popover');
  let registration;
  fallback.addEventListener('toggle', async () => {
    if (!fallback.open || !enhanced.hidden) return;
    registration ??= import('@aceshooting/lyra-ui/components/lr-popover.js')
      .catch((error) => { registration = undefined; throw error; });
    await registration;
    await customElements.whenDefined('lr-popover');
    fallback.hidden = true;
    enhanced.hidden = false;
    await enhanced.show();
  });
</script>
`,
    firstInteractionCombobox: `<!doctype html>
<meta charset="utf-8">
<div id="fallback-combobox">
  <label for="fallback-country">Country</label>
  <input id="fallback-country" name="country" list="country-options">
  <datalist id="country-options"><option value="France"></option></datalist>
</div>
<lr-combobox id="enhanced-combobox" name="country" label="Country" hidden>
  <lr-option value="France">France</lr-option>
</lr-combobox>
<script type="module">
  const fallback = document.querySelector('#fallback-combobox');
  const input = document.querySelector('#fallback-country');
  const enhanced = document.querySelector('#enhanced-combobox');
  let registration;
  input.addEventListener('focus', async () => {
    if (!enhanced.hidden) return;
    registration ??= import('@aceshooting/lyra-ui/components/lr-combobox.js')
      .catch((error) => { registration = undefined; throw error; });
    await registration;
    await customElements.whenDefined('lr-combobox');
    enhanced.value = input.value;
    fallback.hidden = true;
    enhanced.hidden = false;
    enhanced.focus();
  });
</script>
`,
  };
  await Promise.all(
    Object.entries(firstInteractionSources).map(([name, source]) =>
      writeFile(join(fixtureDir, 'src', `bundle-${name}.html`), source),
    ),
  );
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectFiles(path)));
    else files.push(path);
  }
  return files;
}

async function bundleSize(directory) {
  const files = await collectFiles(directory);
  const rawBytes = (await Promise.all(files.map(async (file) => (await stat(file)).size))).reduce(
    (total, size) => total + size,
    0,
  );
  const gzipBytes = (await Promise.all(files.map(async (file) => gzipSync(await readFile(file)).byteLength))).reduce(
    (total, size) => total + size,
    0,
  );
  return { rawBytes, gzipBytes, files };
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

function matchesOptionalPeer(specifier, peer) {
  return specifier === peer || specifier.startsWith(`${peer}/`);
}

function optionalPeerForModuleId(moduleId) {
  const normalizedId = moduleId.replaceAll('\\', '/');
  return optionalPeers.find(
    (peer) => matchesOptionalPeer(moduleId, peer) || normalizedId.includes(`/node_modules/${peer}/`),
  );
}

function inspectOptionalPeerGraph(graph) {
  const modules = new Map(graph.modules.map((module) => [module.id, module]));
  const pending = graph.modules.filter((module) => module.isEntry).map((module) => module.id);
  const staticallyReachableModules = new Set();
  const eagerPeers = new Set();

  while (pending.length > 0) {
    const moduleId = pending.pop();
    if (staticallyReachableModules.has(moduleId)) continue;
    staticallyReachableModules.add(moduleId);
    const module = modules.get(moduleId);
    if (module == null) continue;
    for (const imported of module.importedIds) {
      const peer = optionalPeerForModuleId(imported);
      if (peer != null) {
        eagerPeers.add(peer);
      } else if (modules.has(imported)) {
        pending.push(imported);
      }
    }
  }

  const bundledPeers = new Set();
  const lazyPeers = new Set();
  for (const module of graph.modules) {
    for (const imported of module.dynamicallyImportedIds) {
      const peer = optionalPeerForModuleId(imported);
      if (peer != null) lazyPeers.add(peer);
    }
  }
  for (const chunk of graph.chunks) {
    for (const moduleId of chunk.modules) {
      const peer = optionalPeerForModuleId(moduleId);
      if (peer != null) bundledPeers.add(peer);
    }
  }

  return {
    bundledPeers: [...bundledPeers].sort(),
    eagerPeers: [...eagerPeers].sort(),
    lazyPeers: [...lazyPeers].sort(),
    staticallyReachableModuleCount: staticallyReachableModules.size,
  };
}

async function runBundle(fixtureDir, entry, config, noOptionalPeers, maplibreMajor = 6) {
  const env = {
    ...process.env,
    CI: 'true',
    LYRA_BUNDLE_ENTRY: entry,
    LYRA_NO_OPTIONAL_PEERS: noOptionalPeers ? '1' : '0',
  };
  await new Promise((resolveRun, rejectRun) => {
    const child = spawn(join(fixtureDir, 'node_modules', '.bin', binName('vite')), ['build', '--config', 'vite.config.mjs'], {
      cwd: fixtureDir,
      env,
      stdio: 'inherit',
    });
    child.once('error', rejectRun);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`Vite ${entry} bundle failed${signal ? ` (${signal})` : ` with exit code ${code}`}`));
    });
  });
  const output = await bundleSize(join(fixtureDir, 'bundle', entry));
  const graph = JSON.parse(
    await readFile(join(fixtureDir, `.packed-consumer-${entry}-graph.json`), 'utf8'),
  );
  const peerGraph = inspectOptionalPeerGraph(graph);
  const violations = [];
  const javascriptFiles = output.files.filter((file) => file.endsWith('.js'));
  const javascript = (await Promise.all(javascriptFiles.map((file) => readFile(file, 'utf8')))).join('\n');
  const bundledModuleIds = graph.chunks.flatMap((chunk) =>
    chunk.modules.map((moduleId) => moduleId.replaceAll('\\\\', '/')),
  );
  const chunksByName = new Map(graph.chunks.map((chunk) => [chunk.fileName, chunk]));
  const pendingInitialChunks = graph.chunks.filter((chunk) => chunk.isEntry).map((chunk) => chunk.fileName);
  const initialChunkNames = new Set();
  while (pendingInitialChunks.length > 0) {
    const fileName = pendingInitialChunks.pop();
    if (initialChunkNames.has(fileName)) continue;
    initialChunkNames.add(fileName);
    const chunk = chunksByName.get(fileName);
    if (chunk) pendingInitialChunks.push(...chunk.imports);
  }
  const initialModuleIds = graph.chunks
    .filter((chunk) => initialChunkNames.has(chunk.fileName))
    .flatMap((chunk) => chunk.modules.map((moduleId) => moduleId.replaceAll('\\\\', '/')));
  const bundleDir = join(fixtureDir, 'bundle', entry);
  const initialFiles = output.files.filter((file) =>
    initialChunkNames.has(relative(bundleDir, file).replaceAll('\\\\', '/')) ||
      (config.includeStaticFallback === true && file.endsWith('.html')),
  );
  const initialGzipBytes = (await Promise.all(
    initialFiles.map(async (file) => gzipSync(await readFile(file)).byteLength),
  )).reduce((total, size) => total + size, 0);
  if (entry === 'autoloaderTreeShaken') {
    if (javascriptFiles.length !== 1 || javascript.includes('data-lr-autoload-pending')) {
      violations.push('the side-effect-free manual autoloader import was not tree-shaken');
    }
  }
  if (entry === 'autoloaderCdn' && !javascript.includes('data-lr-autoload-pending')) {
    violations.push('the bare CDN autoloader import lost its auto-start implementation');
  }
  if (entry === 'ssrHydration' && !javascript.includes('defer-hydration')) {
    violations.push('the packed hydration entry lost its transitive Lit hydration hook');
  }
  if (entry === 'button' && javascript.includes('data-lr-autoload-pending')) {
    violations.push('a granular component import unexpectedly pulled in the optional autoloader');
  }
  if (entry === 'formControlLabel') {
    if (!bundledModuleIds.some((id) => id.endsWith('/internal/form-control-labels.js'))) {
      violations.push('the packed form-control label installer was tree-shaken');
    }
    const forbiddenModules = [
      '/internal/overlay-manager.js',
      '/internal/overlay-stack.js',
      '/internal/nonmodal-overlay-manager.js',
      '/internal/rendered-state.js',
      '/internal/scroll-lock.js',
    ];
    const retainedForbidden = forbiddenModules.filter((suffix) =>
      bundledModuleIds.some((id) => id.endsWith(suffix)),
    );
    if (retainedForbidden.length > 0) {
      violations.push(
        `the form-control label graph retained modal overlay modules: ${retainedForbidden.join(', ')}`,
      );
    }
  }
  if (entry === 'anchoredPopover' || entry === 'anchoredCombobox') {
    const componentName = entry === 'anchoredPopover' ? 'popover' : 'combobox';
    const requiredInitialModules = [
      '/internal/anchored-overlay-runtime.js',
      '/internal/nonmodal-overlay-manager.js',
      '/internal/overlay-stack.js',
    ];
    const missingInitial = requiredInitialModules.filter((suffix) =>
      !initialModuleIds.some((id) => id.endsWith(suffix)),
    );
    if (missingInitial.length > 0) {
      violations.push(
        `the ${componentName} initial graph lost its deferred nonmodal shell: ${missingInitial.join(', ')}`,
      );
    }
    if (
      initialModuleIds.some((id) =>
        id.endsWith('/internal/positioner.js') || id.includes('/node_modules/@floating-ui/'),
      )
    ) {
      violations.push(`the ${componentName} initial graph eagerly retained the positioning runtime`);
    }
    if (!bundledModuleIds.some((id) => id.endsWith('/internal/positioner.js'))) {
      violations.push(`the ${componentName} bundle lost its first-open positioning chunk`);
    }
    const forbiddenModalModules = [
      '/internal/overlay-manager.js',
      '/internal/rendered-state.js',
      '/internal/scroll-lock.js',
    ];
    const retainedModal = forbiddenModalModules.filter((suffix) =>
      bundledModuleIds.some((id) => id.endsWith(suffix)),
    );
    if (retainedModal.length > 0) {
      violations.push(
        `the ${componentName} graph retained modal overlay modules: ${retainedModal.join(', ')}`,
      );
    }
    if (!graph.chunks.some((chunk) => chunk.dynamicImports.length > 0)) {
      violations.push(`the ${componentName} graph emitted no dynamic first-open chunk edge`);
    }
  }
  if (entry === 'firstInteractionPopover' || entry === 'firstInteractionCombobox') {
    const componentName = entry === 'firstInteractionPopover' ? 'popover' : 'combobox';
    const htmlFiles = output.files.filter((file) => file.endsWith('.html'));
    const html = (await Promise.all(htmlFiles.map((file) => readFile(file, 'utf8')))).join('\n');
    const hasFallback = componentName === 'popover'
      ? html.includes('<details') && html.includes('<summary>Account</summary>')
      : html.includes('<input') && html.includes('list="country-options"') && html.includes('<datalist');
    if (!hasFallback) {
      violations.push(
        `the first-interaction ${componentName} entry lost its functional native fallback markup`,
      );
    }
    if (initialModuleIds.some((id) => id.includes('/node_modules/@aceshooting/lyra-ui/'))) {
      violations.push(
        `the first-interaction ${componentName} entry pulled Lyra into the initial shell`,
      );
    }
    const registrationSuffix = componentName === 'popover'
      ? '/components/lr-popover.js'
      : '/components/lr-combobox.js';
    if (!bundledModuleIds.some((id) => id.endsWith(registrationSuffix))) {
      violations.push(
        `the first-interaction ${componentName} entry lost its deferred registration`,
      );
    }
    if (!graph.chunks.some((chunk) => chunk.dynamicImports.length > 0)) {
      violations.push(
        `the first-interaction ${componentName} entry emitted no dynamic registration edge`,
      );
    }
  }
  if (entry === 'rootBarrel' && /customElements\s*\.\s*define/.test(javascript)) {
    violations.push(
      'the registration-free package root defined a custom element in a bare, otherwise-unused import',
    );
  }
  if (entry === 'theme') {
    const cssFiles = output.files.filter((file) => file.endsWith('.css'));
    const css = (await Promise.all(cssFiles.map((file) => readFile(file, 'utf8')))).join('\n');
    if (cssFiles.length === 0 || !css.includes('--lr-theme-color-brand-fill-loud')) {
      violations.push('the bare theme.css import emitted no retained Lyra theme asset');
    }
  }
  if (entry === 'shadcnTheme') {
    const installedDist = join(fixtureDir, 'node_modules', '@aceshooting', 'lyra-ui', 'dist');
    const [presetModule, baseThemeModule] = await Promise.all([
      realpath(join(installedDist, 'looks', 'shadcn.css')),
      realpath(join(installedDist, 'theme.css')),
    ]);
    const modules = new Set(bundledModuleIds.map((id) => id.replaceAll('\\', '/')));
    const retainedPreset = modules.has(presetModule.replaceAll('\\', '/'));
    const retainedBaseTheme = modules.has(baseThemeModule.replaceAll('\\', '/'));
    const cssFiles = output.files.filter((file) => file.endsWith('.css'));
    const css = (await Promise.all(cssFiles.map((file) => readFile(file, 'utf8')))).join('\n');
    const missing = (markers) => markers.filter((marker) => !marker.test(css)).map(String);
    const missingPreset = missing(SHADCN_THEME_RETENTION_MARKERS.preset);
    const missingBaseTheme = missing(SHADCN_THEME_RETENTION_MARKERS.baseTheme);
    if (!retainedPreset || cssFiles.length === 0 || missingPreset.length > 0) {
      violations.push(
        `the bare looks/shadcn.css import emitted no retained look (missing ${!retainedPreset ? 'installed module' : missingPreset.join(', ') || 'CSS output'})`,
      );
    }
    if (!retainedBaseTheme || cssFiles.length === 0 || missingBaseTheme.length > 0) {
      violations.push(
        `the theme.css imported beside the preset emitted no retained base theme (missing ${!retainedBaseTheme ? 'installed module' : missingBaseTheme.join(', ') || 'CSS output'})`,
      );
    }
  }
  if (entry === 'nativeStyles' || entry === 'utilitiesStyles' || entry === 'reservationStyles') {
    const cssFiles = output.files.filter((file) => file.endsWith('.css'));
    const css = (await Promise.all(cssFiles.map((file) => readFile(file, 'utf8')))).join('\n');
    const expectedByEntry = {
      nativeStyles: ['.lr-native', '--lr-native-control-min-block-size'],
      utilitiesStyles: ['.lr-stack', '--lr-layout-gap', '.lr-typography', '--lr-heading-letter-spacing'],
      // Reservations only ever style `:not(:defined)` inside their own cascade layer, so those two
      // markers are what prove the sheet survived bundling rather than being tree-shaken to
      // nothing.
      reservationStyles: ['lr-reservations', ':not(:defined)'],
    };
    const expected = expectedByEntry[entry] ?? [];
    if (cssFiles.length === 0 || expected.some((marker) => !css.includes(marker))) {
      violations.push(`the bare ${entry} import emitted no retained Lyra styles`);
    }
  }
  if (config.maxRawBytes != null && output.rawBytes > config.maxRawBytes) {
    violations.push(`raw ${formatBytes(output.rawBytes)} exceeds budget ${formatBytes(config.maxRawBytes)}`);
  }
  if (config.maxGzipBytes != null && output.gzipBytes > config.maxGzipBytes) {
    violations.push(`gzip ${formatBytes(output.gzipBytes)} exceeds budget ${formatBytes(config.maxGzipBytes)}`);
  }
  if (config.maxInitialGzipBytes != null && initialGzipBytes > config.maxInitialGzipBytes) {
    violations.push(
      `initial gzip ${formatBytes(initialGzipBytes)} exceeds budget ${formatBytes(config.maxInitialGzipBytes)}`,
    );
  }
  if (peerGraph.staticallyReachableModuleCount === 0) {
    violations.push('the Vite graph diagnostic recorded no entry module');
  }
  // The locale entry imports the catalogs on purpose: the companion package is what it measures.
  const unexpectedEagerPeers = peerGraph.eagerPeers.filter(
    (peer) => !(entry === 'locale' && peer === '@aceshooting/lyra-translations'),
  );
  if (noOptionalPeers && unexpectedEagerPeers.length > 0) {
    violations.push(`optional peer(s) are statically reachable: ${unexpectedEagerPeers.join(', ')}`);
  }
  const unexpectedBundledPeers = peerGraph.bundledPeers.filter(
    (peer) => !(entry === 'locale' && peer === '@aceshooting/lyra-translations'),
  );
  if (noOptionalPeers && unexpectedBundledPeers.length > 0) {
    violations.push(`optional peer(s) were physically bundled: ${unexpectedBundledPeers.join(', ')}`);
  }
  if (
    entry === 'map' &&
    maplibreMajor === 6 &&
    !output.files.some((file) => /maplibre-gl-worker/.test(file))
  ) {
    violations.push('the Vite consumer did not emit MapLibre v6’s module worker');
  }
  if (violations.length > 0) {
    console.error(JSON.stringify({
      entry,
      emittedFileCount: output.files.length,
      rawBytes: output.rawBytes,
      gzipBytes: output.gzipBytes,
      initialGzipBytes,
    }));
    throw new Error(
      `${entry} bundle is out of budget across ${output.files.length} files: ${violations.join('; ')}`,
    );
  }
  if (entry === 'locale') {
    await run(
      process.execPath,
      [join(fixtureDir, 'bundle', entry, 'index.js')],
      fixtureDir,
      'packed locale side-effect execution check',
    );
  }
  console.log(
    `${entry} bundle: ${formatBytes(output.rawBytes)} raw, ${formatBytes(output.gzipBytes)} gzip ` +
      `(initial ${formatBytes(initialGzipBytes)} gzip; ` +
      `${output.files.length} files; ${peerGraph.staticallyReachableModuleCount} eager modules; ` +
      `${peerGraph.eagerPeers.length} eager/${peerGraph.lazyPeers.length} lazy/` +
      `${peerGraph.bundledPeers.length} bundled optional peers)`,
  );
}

async function main() {
  const { runAttw } = parsePackedConsumerArguments(process.argv.slice(2));
  const fieldMode = process.env.LYRA_PACKED_FIELD_MODE ?? 'retirement';
  assert.ok(['retirement', 'pre-removal'].includes(fieldMode), 'Invalid installed field proof mode');
  const performanceOptions = parsePerformanceQualificationOptions(process.env);
  let performanceBaselineSha256;
  if (performanceOptions) {
    assert.ok(
      process.execArgv.includes('--experimental-import-meta-resolve'),
      'opt-in packed production performance requires --experimental-import-meta-resolve',
    );
    performanceBaselineSha256 = createHash('sha256')
      .update(await readFile(performanceOptions.baselineTarballPath))
      .digest('hex');
    assert.equal(
      performanceBaselineSha256,
      'b2d8e4155e9d4265a95e28357c1ad3402505d150205203251d9f16a1a4bd88da',
      'the baseline must be the exact archived public @aceshooting/lyra-ui@23.0.0 tarball',
    );
  }
  const migrationArtifactsDir = process.env.LYRA_PACKED_MIGRATION_ARTIFACTS
    ? resolve(process.env.LYRA_PACKED_MIGRATION_ARTIFACTS)
    : undefined;
  const workspace = await mkdtemp(join(tmpdir(), 'lr-packed-consumer-'));
  try {
    const tarballDir = join(workspace, 'packages');
    const coreFixture = join(workspace, 'core');
    const optionalFixture = join(workspace, 'optional');
    const maplibreV5Fixture = join(workspace, 'maplibre-v5');
    await Promise.all([
      writeFile(join(workspace, '.keep'), ''),
      mkdir(tarballDir, { recursive: true }),
      mkdir(join(coreFixture, 'src'), { recursive: true }),
      mkdir(join(optionalFixture, 'src'), { recursive: true }),
      mkdir(join(maplibreV5Fixture, 'src'), { recursive: true }),
    ]);

    const uiTarball = (await suppliedPackedTarball(PACKED_TARBALL_ENVIRONMENT.ui, {
      packageDir: uiPackage,
      destination: tarballDir,
      compareExports: true,
    })) ?? await pack(uiPackage, tarballDir);
    if (migrationArtifactsDir) await preservePackedTarball({ tarballPath: uiTarball, artifactsDir: join(migrationArtifactsDir, 'packages') });
    const candidateTarballSha256 = performanceOptions
      ? createHash('sha256').update(await readFile(uiTarball)).digest('hex')
      : undefined;
    const flagsTarball = (await suppliedPackedTarball(PACKED_TARBALL_ENVIRONMENT.flags, {
      packageDir: flagsPackage,
      destination: tarballDir,
    })) ?? await pack(flagsPackage, tarballDir);
    if (migrationArtifactsDir) await preservePackedTarball({ tarballPath: flagsTarball, artifactsDir: join(migrationArtifactsDir, 'packages') });
    const docsTarball = (await suppliedPackedTarball(PACKED_TARBALL_ENVIRONMENT.docs, {
      packageDir: docsPackage,
      destination: tarballDir,
      compareExports: true,
    })) ?? await pack(docsPackage, tarballDir);
    const translationsTarball = (await suppliedPackedTarball(PACKED_TARBALL_ENVIRONMENT.translations, {
      packageDir: translationsPackage,
      destination: tarballDir,
      compareExports: true,
    })) ?? await pack(translationsPackage, tarballDir);
    const ideTarball = (await suppliedPackedTarball(PACKED_TARBALL_ENVIRONMENT.ide, {
      packageDir: idePackage,
      destination: tarballDir,
      compareExports: true,
    })) ?? await pack(idePackage, tarballDir);

    await run(
      pnpm,
      ['exec', 'publint', 'run', '--strict', '--pack=false', uiTarball],
      root,
      'publint package check',
    );
    if (runAttw) {
      await run(
        process.execPath,
        [join(root, 'scripts', 'check-packed-attw.mjs'), '--tarball', uiTarball],
        root,
        'Are The Types Wrong package check',
      );
    } else {
      console.log('Skipping only ATTW; packed install, runtime, declaration, and bundle contracts remain enabled.');
    }
    await verifyPackedDocsPackage({ workspace, uiTarball, docsTarball });
    await verifyPackedTranslationsPackage({ workspace, uiTarball, translationsTarball });
    await verifyPackedIdePackage({ workspace, uiTarball, ideTarball });

    await writeFixture(
      coreFixture,
      uiTarball,
      flagsTarball,
      false,
      '^6.0.0',
      performanceOptions?.baselineTarballPath,
      translationsTarball,
    );
    await writeFixture(optionalFixture, uiTarball, flagsTarball, true, '^6.0.0', undefined, translationsTarball);
    await writeFixture(maplibreV5Fixture, uiTarball, flagsTarball, true, '^5.24.0', undefined, translationsTarball);
    await run(pnpm, ['install', '--ignore-scripts', '--config.auto-install-peers=false'], coreFixture, 'core fixture install');
    await run(
      pnpm,
      ['install', '--ignore-scripts', '--config.auto-install-peers=false'],
      optionalFixture,
      'optional-peer fixture install',
    );
    await run(
      npm,
      ['install', '--ignore-scripts', '--strict-peer-deps'],
      maplibreV5Fixture,
      'MapLibre v5 npm fixture install',
    );
    await run(
      npm,
      ['ls', 'maplibre-gl', '--all'],
      maplibreV5Fixture,
      'MapLibre v5 peer tree check',
    );

    // Every optional peer the strict fixture installs gets its own resolved-tree check, not just
    // MapLibre. `npm install --strict-peer-deps` above already fails on an unsatisfiable range;
    // `npm ls <name>` additionally proves the package resolved to a real tree entry rather than
    // being quietly skipped, which is the failure mode an optional peer is most prone to.
    for (const peer of Object.keys(FIXTURE_OPTIONAL_PEERS)) {
      await run(npm, ['ls', peer, '--all'], maplibreV5Fixture, `${peer} peer tree check`);
    }

    await verifyNoWorkspaceProtocolLeaked(coreFixture);
    await verifyNoWorkspaceProtocolLeaked(maplibreV5Fixture);

    await verifyPackedMigrationCli(coreFixture);
    await verifyPackedInitAgents(coreFixture);
    const compatibilityHistoryDirectory = join(uiPackage, 'scripts/fixtures/compatibility-history');
    const publishedHistory = checkPublishedCompatibilitySync(compatibilityHistoryDirectory);
    const migrationProof = await verifyPackedMigrationConsumers({
      fixtureDir: coreFixture,
      compatibilityContext: await readCurrentCompatibilityContext(uiPackage),
      fieldAuthority: checkPublishedFieldHistorySync(compatibilityHistoryDirectory, { captures: publishedHistory.captures }),
      fieldMode,
      tarballPath: uiTarball,
      artifactsDir: migrationArtifactsDir ? join(migrationArtifactsDir, 'cli') : undefined,
    });
    await writeResolvedMigrationEntry({ fixtureDir: optionalFixture, proof: migrationProof });

    await run(
      process.execPath,
      ['src/node-autoloader-import.mjs'],
      coreFixture,
      'server-safe autoloader import check',
    );
    await run(
      process.execPath,
      ['src/node-localization-import.mjs'],
      coreFixture,
      'side-effect-free localization import check',
    );
    await run(
      process.execPath,
      ['src/node-gemstones-data-import.mjs'],
      coreFixture,
      'Lit-free gemstone data import check',
    );
    await run(process.execPath, ['src/node-imports.mjs'], coreFixture, 'Node ESM import check');
    // Its own process: the three stages need a module registry no earlier check has warmed.
    await run(
      process.execPath,
      ['src/node-registration-contract.mjs'],
      coreFixture,
      'packed registration-split contract check',
    );
    await run(
      join(coreFixture, 'node_modules', '.bin', binName('tsc')),
      ['--noEmit', '--skipLibCheck', 'false', '-p', 'tsconfig.json'],
      coreFixture,
      'consumer declaration check',
    );
    await run(
      join(maplibreV5Fixture, 'node_modules', '.bin', binName('tsc')),
      ['--noEmit', '--skipLibCheck', 'false', '-p', 'tsconfig.json'],
      maplibreV5Fixture,
      'MapLibre v5 consumer declaration check',
    );

    for (const [entry, config] of Object.entries(bundleEntries)) {
      await runBundle(
        config.fixture === 'core' ? coreFixture : optionalFixture,
        entry,
        config,
        config.fixture === 'core',
      );
    }
    await runBundle(maplibreV5Fixture, 'map', bundleEntries.map, false, 5);
    await runBundle(optionalFixture, 'migratedX', { fixture: 'optional' }, false);
    await verifyResolvedMigrationBrowser({
      bundleDir: join(optionalFixture, 'bundle', 'migratedX'),
      proof: migrationProof,
      artifactsDir: migrationArtifactsDir ? join(migrationArtifactsDir, 'browser') : undefined,
    });

    if (performanceOptions) {
      const installedPackages = [
          {
            key: 'baseline',
            role: 'baseline',
            installPath: 'lyra-ui-v23',
            expectedVersion: '23.0.0',
            tarballPath: performanceOptions.baselineTarballPath,
            tarballSha256: performanceBaselineSha256,
          },
          {
            key: 'candidate',
            role: 'candidate',
            installPath: '@aceshooting/lyra-ui',
            expectedVersion: uiPackageJson.version,
            tarballPath: uiTarball,
            tarballSha256: candidateTarballSha256,
          },
        ];
      if (performanceOptions.mode === 'hydration-smoke') {
        await runPackedHydrationSmoke({
          fixtureDir: coreFixture,
          packages: installedPackages,
          artifactsPath: join(performanceOptions.artifactsDir, 'packed-hydration-smoke.json'),
        });
      } else {
        await runPackedPerformanceQualification({
          fixtureDir: coreFixture,
          packages: installedPackages,
          artifactsDir: join(performanceOptions.artifactsDir, 'packed-performance.json'),
        });
      }
    }

    console.log('Packed-consumer checks passed.');
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
