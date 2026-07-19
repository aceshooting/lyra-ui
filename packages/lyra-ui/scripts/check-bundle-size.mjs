// Guards against silent bundle-weight regressions: a dependency that stops tree-shaking, a
// component that grows an eager import of a heavy module, or an optional-peer integration that
// accidentally becomes a hard static import all land in consumers' first-paint bundles long before
// anyone notices. This script bundles (esbuild: bundle + esm + minify) the published entry points a
// consumer would import, gzips the result, and compares against the budgets checked in at
// scripts/bundle-budgets.json. Run after `pnpm build` (it measures dist/, the actual published
// form). Regenerate the budgets deliberately with `--write-budgets` (~10% headroom over the
// current build, rounded up to the KB).
//
// The optional peer packages (chart.js, pdfjs-dist, shiki, ...) are externalized: the library only
// ever reaches them through dynamic `import()` in the src/internal loader modules, consumers
// install them opt-in, and their weight is not this library's to budget. The list is derived from
// package.json `peerDependencies` + `peerDependenciesMeta[*].optional` rather than hardcoded so a
// newly added optional peer is externalized automatically. Each peer is externalized both bare and
// as `<name>/*` because the loaders import subpaths too (`shiki/core`, `libphonenumber-js/min`,
// `mammoth/mammoth.browser.js`, `emoji-picker-element-data/en/...`). Hard dependencies (lit,
// @floating-ui/dom) stay bundled -- consumers pay for them, so the budget must include them.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const packageDir = fileURLToPath(new URL('..', import.meta.url));
const budgetsPath = join(packageDir, 'scripts', 'bundle-budgets.json');
const writeBudgets = process.argv.includes('--write-budgets');

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
const optionalPeers = Object.keys(pkg.peerDependencies ?? {}).filter(
  (name) => pkg.peerDependenciesMeta?.[name]?.optional === true,
);
const external = optionalPeers.flatMap((name) => [name, `${name}/*`]);

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
    // splitting stays off, so relative dynamic imports (the archive/ebook lazy registrations) are
    // inlined into the single output file and each entry's number is self-contained.
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
    const contents = result.outputFiles[0].contents;
    // level 9 approximates the static-hosting gzip a consumer actually ships.
    measured.push({ entry, minBytes: contents.length, gzipBytes: gzipSync(contents, { level: 9 }).length });
  }

  const toKb = (bytes) => (bytes / 1024).toFixed(1);

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
    console.log(`bundle-size budgets written for ${measured.length} entries to scripts/bundle-budgets.json`);
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
