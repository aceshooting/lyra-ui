// Guards against silent bundle-weight regressions: a dependency that stops tree-shaking, a
// component that grows an eager import of a heavy module, or an optional-peer integration that
// accidentally becomes a hard static import all land in consumers' first-paint bundles long before
// anyone notices. This script bundles (esbuild: bundle + esm + minify) the published entry points a
// consumer would import, gzips the result, and compares against the budgets checked in at
// scripts/bundle-budgets.json. Run after `pnpm build` (it measures dist/, the actual published
// form). Regenerate the budgets deliberately with `--write-budgets` (~10% headroom over the
// current build, rounded up to the KB).
//
// It doubles as the source of the size numbers this project publishes: the same pass measures every
// per-component entry and records the average, alongside the whole-barrel total, in
// scripts/bundle-stats.json, which the README badges and the lyra-ui.com hero render. Those are
// claims made to users, so the check fails when the live build no longer matches them.
//
// The optional peer packages (chart.js, pdfjs-dist, shiki, ...) are externalized: the library only
// ever reaches them through dynamic `import()` in the src/internal loader modules, consumers
// install them opt-in, and their weight is not this library's to budget. The list is derived from
// package.json `peerDependencies` + `peerDependenciesMeta[*].optional` rather than hardcoded so a
// newly added optional peer is externalized automatically. Each peer is externalized both bare and
// as `<name>/*` because the loaders import subpaths too (`shiki/core`, `libphonenumber-js/min`,
// `mammoth/mammoth.browser.js`, `emoji-picker-element-data/en/...`). Hard dependencies (lit,
// @floating-ui/dom) stay bundled -- consumers pay for them, so the budget must include them.
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const budgetsPath = join(packageDir, 'scripts', 'bundle-budgets.json');
const statsPath = join(packageDir, 'scripts', 'bundle-stats.json');
const manifestPath = join(packageDir, 'custom-elements.json');
const taxonomyPath = join(packageDir, 'scripts', 'component-taxonomy.json');
const writeBudgets = process.argv.includes('--write-budgets');

// `--emit=<dir>` additionally writes the bundles this script already builds in memory. Nothing in
// the repo produces a bundled artifact otherwise -- `pnpm build` is plain `tsc`, so dist/ is ~800
// unbundled modules -- and Codecov bundle analysis needs real bundle output to report on. Opt-in
// so the normal budget check stays a pure read. See scripts/codecov-bundle.mjs.
const emitArg = process.argv.find((arg) => arg.startsWith('--emit='));
const emitDir = emitArg ? resolve(packageDir, emitArg.slice('--emit='.length)) : null;
if (emitDir) rmSync(emitDir, { recursive: true, force: true });

// esbuild is not a direct dependency of this package; it reaches the workspace through
// @web/dev-server-esbuild (the wtr pipeline). Under pnpm's strict node_modules layout it is only
// resolvable from that package, so resolve @web/dev-server-esbuild's entry file first and require
// esbuild from there. This intentionally adds zero new dependencies.
const requireFromPackage = createRequire(join(packageDir, 'package.json'));
const requireFromLoaderHost = createRequire(requireFromPackage.resolve('@web/dev-server-esbuild'));
const esbuild = requireFromLoaderHost('esbuild');

// The barrel plus five single-component entries spanning the size range: a primitive (button), a
// form control with overlay machinery (select), a canvas/SVG visualization (gauge), a
// document-viewer shell around an optional peer (pdf-viewer), and the largest interactive family
// (flow-canvas). Budgeting representatives keeps the check fast while still catching a regression
// in any of the shared layers (LyraElement base, form internals, overlay stack, viewer chrome).
const entries = [
  'dist/lyra.js',
  'dist/components/forms/button/button.js',
  'dist/components/forms/select/select.js',
  'dist/components/data/gauge/gauge.js',
  'dist/components/viewers/pdf-viewer/pdf-viewer.js',
  'dist/components/data/flow-canvas/flow-canvas.js',
];

const pkg = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const taxonomy = JSON.parse(readFileSync(taxonomyPath, 'utf8'));
const publicTags = new Set(
  manifest.modules
    .flatMap((module) => module.declarations ?? [])
    .flatMap((declaration) => declaration.customElement && declaration.tagName ? [declaration.tagName] : []),
);
const aliasesAndPresets = [...(taxonomy.aliases ?? []), ...(taxonomy.presets ?? [])];
const duplicateTaxonomyTags = aliasesAndPresets.filter((tag, index) => aliasesAndPresets.indexOf(tag) !== index);
const missingTaxonomyTags = aliasesAndPresets.filter((tag) => !publicTags.has(tag));
if (duplicateTaxonomyTags.length || missingTaxonomyTags.length) {
  throw new Error(
    [
      duplicateTaxonomyTags.length ? `duplicate taxonomy tags: ${[...new Set(duplicateTaxonomyTags)].join(', ')}` : '',
      missingTaxonomyTags.length ? `unknown taxonomy tags: ${missingTaxonomyTags.join(', ')}` : '',
    ].filter(Boolean).join('; '),
  );
}
const publicTagCount = publicTags.size;
const aliasPresetCount = aliasesAndPresets.length;
const primaryBehaviorCount = publicTagCount - aliasPresetCount;
const optionalPeers = Object.keys(pkg.peerDependencies ?? {}).filter(
  (name) => pkg.peerDependenciesMeta?.[name]?.optional === true,
);
const external = optionalPeers.flatMap((name) => [name, `${name}/*`]);

// splitting stays off, so relative dynamic imports (the archive/ebook lazy registrations) are
// inlined into the single output file and each entry's number is self-contained.
const bundleEntry = async (entry) => {
  const result = await esbuild.build({
    entryPoints: [join(packageDir, entry)],
    bundle: true,
    format: 'esm',
    minify: true,
    write: false,
    external,
    absWorkingDir: packageDir,
    logLevel: 'silent',
  });
  return result.outputFiles[0].contents;
};

// level 9 approximates the static-hosting gzip a consumer actually ships.
const gzipBytesOf = (contents) => gzipSync(contents, { level: 9 }).length;

const toKb = (bytes) => (bytes / 1024).toFixed(1);

const errors = [];

const missingEntries = entries.filter((entry) => !existsSync(join(packageDir, entry)));
if (missingEntries.length) {
  console.error(
    missingEntries.map((entry) => `${entry}: not found -- run \`pnpm build\` first`).join('\n'),
  );
  process.exitCode = 1;
} else {
  const measured = [];
  for (const entry of entries) {
    const contents = await bundleEntry(entry);
    // Mirror the entry's path under the emit dir (minus the `dist/` prefix) rather than flattening
    // to a basename: keeps two same-named entries from colliding and gives Codecov asset names
    // that match what a consumer actually imports.
    if (emitDir) {
      const outPath = join(emitDir, entry.replace(/^dist\//, ''));
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, contents);
    }
    measured.push({ entry, minBytes: contents.length, gzipBytes: gzipBytesOf(contents) });
  }

  // The README badge reports the average weight of a single-component import, so that figure has
  // to be measured rather than asserted: every published per-component entry is bundled exactly
  // like the budgeted ones above and the mean gzip size is recorded in scripts/bundle-stats.json.
  // Each measurement is self-contained -- lit and the shared LyraElement base are counted once per
  // component -- so the average is a conservative per-import figure, not the marginal cost of
  // adding one more component to an app that already imports others (with code splitting the
  // shared layers are paid once, and the marginal chunk is a couple of KB). The whole sweep is
  // ~200 esbuild passes and runs in a few seconds, so it stays in the normal check.
  const componentsDir = join(packageDir, 'dist', 'components');
  const componentEntries = existsSync(componentsDir)
    ? readdirSync(componentsDir, { withFileTypes: true })
        .filter((family) => family.isDirectory())
        .flatMap((family) =>
          readdirSync(join(componentsDir, family.name), { withFileTypes: true })
            .filter((component) => component.isDirectory())
            .map(
              (component) => `dist/components/${family.name}/${component.name}/${component.name}.js`,
            ),
        )
        .filter((entry) => existsSync(join(packageDir, entry)))
        .sort()
    : [];
  const componentGzipBytes = [];
  for (const entry of componentEntries) {
    componentGzipBytes.push(gzipBytesOf(await bundleEntry(entry)));
  }
  const avgComponentGzipKb = componentGzipBytes.length
    ? Number((componentGzipBytes.reduce((sum, bytes) => sum + bytes, 0) / componentGzipBytes.length / 1024).toFixed(1))
    : 0;
  // The second badge figure: the whole barrel, i.e. what a consumer pays who imports every
  // component at once. It is the upper bound the per-component average sits under.
  const barrelGzipKb = Number(toKb(measured.find(({ entry }) => entry === 'dist/lyra.js')?.gzipBytes ?? 0));

  if (writeBudgets) {
    const budgets = {};
    for (const { entry, gzipBytes } of measured) {
      budgets[entry] = Math.ceil((gzipBytes * 1.1) / 1024);
    }
    writeFileSync(
      budgetsPath,
      `${JSON.stringify(
        {
          $comment:
            'gzip budgets in KB (1024 bytes) for bundled+minified esm entries, optional peers externalized; ' +
            'checked by scripts/check-bundle-size.mjs, regenerated via --write-budgets (~10% headroom)',
          ...budgets,
        },
        null,
        2,
      )}\n`,
    );
    for (const { entry, minBytes, gzipBytes } of measured) {
      console.log(`${entry}: min ${toKb(minBytes)} KB, gzip ${toKb(gzipBytes)} KB -> budget ${budgets[entry]} KB`);
    }
    writeFileSync(
      statsPath,
      `${JSON.stringify(
        {
          $comment:
            'measured (not budgeted) gzip sizes, rendered by the README size badges and stamped into ' +
            'the lyra-ui.com hero; each component is bundled standalone, so lit and the shared base are ' +
            'counted once in every per-component figure and barrelGzipKb is what importing everything ' +
            'costs. Regenerated by scripts/check-bundle-size.mjs --write-budgets; the normal check ' +
            'fails when the live build drifts from these.',
          // Kept for consumers of the pre-6.3 stats schema.
          componentCount: componentEntries.length,
          measuredEntrypointCount: componentEntries.length,
          publicTagCount,
          aliasPresetCount,
          primaryBehaviorCount,
          avgComponentGzipKb,
          barrelGzipKb,
        },
        null,
        2,
      )}\n`,
    );
    console.log(
      `bundle-size budgets written for ${measured.length} entries to scripts/bundle-budgets.json; ` +
        `${componentEntries.length} components average ${avgComponentGzipKb} KB gzip -> scripts/bundle-stats.json`,
    );
  } else if (!existsSync(budgetsPath)) {
    console.error('scripts/bundle-budgets.json not found -- generate it with `node scripts/check-bundle-size.mjs --write-budgets`');
    process.exitCode = 1;
  } else {
    const budgets = JSON.parse(readFileSync(budgetsPath, 'utf8'));
    for (const entry of entries) {
      if (typeof budgets[entry] !== 'number') {
        errors.push(`${entry}: no budget in scripts/bundle-budgets.json -- regenerate with --write-budgets`);
      }
    }
    // A budget for an entry this script no longer measures is drift (typically an entry rename):
    // it looks covered but guards nothing.
    for (const key of Object.keys(budgets)) {
      if (key !== '$comment' && !entries.includes(key)) {
        errors.push(`scripts/bundle-budgets.json has a stale entry "${key}" that is no longer measured`);
      }
    }
    for (const { entry, minBytes, gzipBytes } of measured) {
      const budgetKb = budgets[entry];
      if (typeof budgetKb !== 'number') continue;
      const line = `${entry}: min ${toKb(minBytes)} KB, gzip ${toKb(gzipBytes)} KB (budget ${budgetKb} KB)`;
      if (gzipBytes > budgetKb * 1024) {
        errors.push(`${line} -- OVER BUDGET by ${toKb(gzipBytes - budgetKb * 1024)} KB gzip`);
      } else {
        console.log(`${line} ok`);
      }
    }

    // The README badges render scripts/bundle-stats.json straight from main, so a stale file is a
    // published false claim rather than a private inconsistency. The component count is checked
    // exactly (adding or removing a component changes the average by definition); the two sizes get
    // a 5% band so ordinary churn inside existing components does not demand a regeneration commit.
    if (!existsSync(statsPath)) {
      errors.push('scripts/bundle-stats.json not found -- generate it with `node scripts/check-bundle-size.mjs --write-budgets`');
    } else {
      const stats = JSON.parse(readFileSync(statsPath, 'utf8'));
      const drifted = (recorded, live) => typeof recorded !== 'number' || Math.abs(live - recorded) > recorded * 0.05;
      if (stats.componentCount !== componentEntries.length) {
        errors.push(
          `scripts/bundle-stats.json records ${stats.componentCount} components but ${componentEntries.length} are published ` +
            '-- the README size badges are stale, regenerate with --write-budgets',
        );
      }
      if (stats.measuredEntrypointCount !== componentEntries.length) {
        errors.push(
          `scripts/bundle-stats.json records ${stats.measuredEntrypointCount} measured entry points but ` +
            `${componentEntries.length} are published -- regenerate with --write-budgets`,
        );
      }
      if (stats.publicTagCount !== publicTagCount) {
        errors.push(
          `scripts/bundle-stats.json records ${stats.publicTagCount} public tags but the manifest contains ` +
            `${publicTagCount} -- regenerate with --write-budgets`,
        );
      }
      if (stats.aliasPresetCount !== aliasPresetCount || stats.primaryBehaviorCount !== primaryBehaviorCount) {
        errors.push(
          'scripts/bundle-stats.json taxonomy counts are stale -- update component-taxonomy.json if needed, ' +
            'then regenerate with --write-budgets',
        );
      }
      if (drifted(stats.avgComponentGzipKb, avgComponentGzipKb)) {
        errors.push(
          `scripts/bundle-stats.json records an average of ${stats.avgComponentGzipKb} KB gzip per component but the build ` +
            `measures ${avgComponentGzipKb} KB -- the README size badges are stale, regenerate with --write-budgets`,
        );
      }
      if (drifted(stats.barrelGzipKb, barrelGzipKb)) {
        errors.push(
          `scripts/bundle-stats.json records a ${stats.barrelGzipKb} KB gzip barrel but the build measures ${barrelGzipKb} KB ` +
            '-- the README size badges are stale, regenerate with --write-budgets',
        );
      }
      if (!errors.length) {
        console.log(
          `bundle stats verified: ${componentEntries.length} components average ${avgComponentGzipKb} KB gzip, ` +
            `barrel ${barrelGzipKb} KB gzip (scripts/bundle-stats.json)`,
        );
      }
    }

    if (errors.length) {
      console.error(errors.join('\n'));
      console.error(
        'If the growth is intentional, raise the affected budget in scripts/bundle-budgets.json ' +
          '(or rerun with --write-budgets) and justify the increase in the PR description.',
      );
      process.exitCode = 1;
    } else {
      console.log(
        `bundle-size budgets verified: ${measured.length} entries within scripts/bundle-budgets.json ` +
          `(${optionalPeers.length} optional peers externalized)`,
      );
    }
  }
}
