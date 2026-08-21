// Guards against silent bundle-weight regressions: a dependency that stops tree-shaking, a
// component that grows an eager import of a heavy module, or an optional-peer integration that
// accidentally becomes a hard static import all land in consumers' first-paint bundles long before
// anyone notices. This script bundles (esbuild: bundle + esm + minify) the published entry points a
// consumer would import, gzips the result, and compares against the budgets checked in at
// scripts/bundle-budgets.json. Run after `pnpm build` (it measures dist/, the actual published
// form). The checked-in ceilings are reviewed release limits, not generated snapshots.
// It doubles as the source of the size numbers this project publishes: the same pass measures every
// per-component entry and records the average, alongside the whole-barrel total, in
// scripts/bundle-stats.json, which the README badges and the lyra-ui.com hero render. Those are
// claims made to users, so the check fails when the live build no longer matches them.
// Optional peer packages (chart.js, pdfjs-dist, shiki, ...) are externalized for weight budgets:
// ever reaches them through dynamic `import()` in the src/internal loader modules, consumers
// install them opt-in, and their weight is not this library's to budget. The list is derived from
// package.json `peerDependencies` + `peerDependenciesMeta[*].optional` rather than hardcoded so a
// newly added optional peer is externalized automatically. Each peer is externalized both bare and
// as `<name>/*` because the loaders import subpaths too (`shiki/core`, `libphonenumber-js/min`,
// `mammoth/mammoth.browser.js`, `emoji-picker-element-data/en/...`). Hard dependencies (lit,
// @floating-ui/dom) stay bundled -- consumers pay for them, so the budget must include them. The
// separately inventoried exclusion claims selectively include the named peer and inspect esbuild's
// real metafile, preventing an externalized weight check from vacuously passing a lean-entry claim.
import {
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { positiveInitialMarginalGzipBytes } from "./bundle-metrics.mjs";

const packageDir = fileURLToPath(new URL("..", import.meta.url));
const budgetsPath = join(packageDir, "scripts", "bundle-budgets.json");
const initialBudgetsPath = join(
  packageDir,
  "scripts",
  "bundle-initial-budgets.json"
);
const exclusionClaimsPath = join(
  packageDir,
  "scripts",
  "bundle-exclusion-claims.json"
);
const statsPath = join(packageDir, "scripts", "bundle-stats.json");
const manifestPath = join(packageDir, "custom-elements.json");
const taxonomyPath = join(packageDir, "scripts", "component-taxonomy.json");
const arguments_ = process.argv.slice(2);
const unknownArguments = arguments_.filter(
  (argument) =>
    argument !== "--write-stats" &&
    argument !== "--exclusion-claims-only" &&
    !argument.startsWith("--emit=")
);
if (unknownArguments.length > 0)
  throw new Error(`Unknown argument: ${unknownArguments[0]}`);
const writeStats = arguments_.includes("--write-stats");
const exclusionClaimsOnly = arguments_.includes("--exclusion-claims-only");

// `--emit=<dir>` additionally writes the bundles this script already builds in memory. Nothing in
// the repo produces a bundled artifact otherwise -- `pnpm build` is plain `tsc`, so dist/ is ~800
// unbundled modules -- and Codecov bundle analysis needs real bundle output to report on. Opt-in
// so the normal budget check stays a pure read. See scripts/codecov-bundle.mjs.
const emitArguments = arguments_.filter((argument) =>
  argument.startsWith("--emit=")
);
if (emitArguments.length > 1)
  throw new Error("Only one --emit=<dir> argument is allowed");
const emitArg = emitArguments[0];
if (emitArg === "--emit=") throw new Error("--emit requires a directory");
const emitDir = emitArg
  ? resolve(packageDir, emitArg.slice("--emit=".length))
  : null;
if (emitDir) rmSync(emitDir, { recursive: true, force: true });

// esbuild is not a direct dependency of this package; it reaches the workspace through
// @web/dev-server-esbuild (the wtr pipeline). Under pnpm's strict node_modules layout it is only
// resolvable from that package, so resolve @web/dev-server-esbuild's entry file first and require
// esbuild from there. This intentionally adds zero new dependencies.
const requireFromPackage = createRequire(join(packageDir, "package.json"));
const requireFromLoaderHost = createRequire(
  requireFromPackage.resolve("@web/dev-server-esbuild")
);
const esbuild = requireFromLoaderHost("esbuild");

const budgets = JSON.parse(readFileSync(budgetsPath, "utf8"));
const initialBudgets = JSON.parse(readFileSync(initialBudgetsPath, "utf8"));
const initialBaselineEntries = initialBudgets.$baseline;
const initialMarginalBudgets = initialBudgets.$marginalGzipKb;
if (
  !Array.isArray(initialBaselineEntries) ||
  initialBaselineEntries.length === 0 ||
  initialBaselineEntries.some((entry) => typeof entry !== "string") ||
  typeof initialMarginalBudgets !== "object" ||
  initialMarginalBudgets === null ||
  Array.isArray(initialMarginalBudgets)
) {
  throw new TypeError(
    "scripts/bundle-initial-budgets.json must define a non-empty $baseline array and a $marginalGzipKb object"
  );
}
for (const [entry, budget] of Object.entries(initialMarginalBudgets)) {
  if (!Number.isSafeInteger(budget) || budget <= 0) {
    throw new TypeError(`${entry}: initial marginal budget must be a positive integer KiB ceiling`);
  }
}
const exclusionClaims = JSON.parse(readFileSync(exclusionClaimsPath, "utf8"));
const entries = Object.keys(budgets)
  .filter((entry) => !entry.startsWith("$"))
  .sort();
const requiredBudgetCategories = [
  "dist/hydration.js",
  "dist/ssr.js",
  "dist/ssr/all.js",
  "dist/ssr-loader.js",
  "dist/autoloader.js",
  "dist/autoloader-cdn.js",
  ...[
    "agent-tools",
    "charts",
    "conversation",
    "data",
    "forms",
    "layout",
    "media",
    "overlays",
    "retrieval",
    "utility",
    "viewers",
  ].map((family) => `dist/components/${family}/index.js`),
];
for (const entry of requiredBudgetCategories) {
  if (!Number.isFinite(budgets[entry]))
    throw new Error(`missing hard bundle budget for ${entry}`);
}
for (const aggregate of ["$componentP95GzipKb", "$componentMaxGzipKb"]) {
  if (!Number.isFinite(budgets[aggregate]))
    throw new Error(`missing hard bundle budget ${aggregate}`);
}

const pkg = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const taxonomy = JSON.parse(readFileSync(taxonomyPath, "utf8"));
const publicTags = new Set(
  manifest.modules
    .flatMap((module) => module.declarations ?? [])
    .flatMap((declaration) =>
      declaration.customElement && declaration.tagName
        ? [declaration.tagName]
        : []
    )
);
const aliasesAndPresets = [
  ...(taxonomy.aliases ?? []),
  ...(taxonomy.presets ?? []),
];
const duplicateTaxonomyTags = aliasesAndPresets.filter(
  (tag, index) => aliasesAndPresets.indexOf(tag) !== index
);
const missingTaxonomyTags = aliasesAndPresets.filter(
  (tag) => !publicTags.has(tag)
);
if (duplicateTaxonomyTags.length || missingTaxonomyTags.length) {
  throw new Error(
    [
      duplicateTaxonomyTags.length
        ? `duplicate taxonomy tags: ${[...new Set(duplicateTaxonomyTags)].join(
            ", "
          )}`
        : "",
      missingTaxonomyTags.length
        ? `unknown taxonomy tags: ${missingTaxonomyTags.join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join("; ")
  );
}
const publicTagCount = publicTags.size;
const aliasPresetCount = aliasesAndPresets.length;
const primaryBehaviorCount = publicTagCount - aliasPresetCount;
const optionalPeers = Object.keys(pkg.peerDependencies ?? {}).filter(
  (name) => pkg.peerDependenciesMeta?.[name]?.optional === true
);
const external = optionalPeers.flatMap((name) => [name, `${name}/*`]);

const exclusionClaimEntries = Object.keys(exclusionClaims)
  .filter((entry) => !entry.startsWith("$"))
  .sort();

const verifyBundleExclusionClaims = async () => {
  const claimErrors = [];
  for (const entry of exclusionClaimEntries) {
    const claim = exclusionClaims[entry];
    const includedOptionalPeers = claim?.includedOptionalPeers ?? [];
    const forbiddenInputs = claim?.forbiddenInputs ?? [];
    if (
      !Array.isArray(includedOptionalPeers) ||
      !Array.isArray(forbiddenInputs) ||
      forbiddenInputs.length === 0
    ) {
      claimErrors.push(`${entry}: invalid bundle-exclusion claim`);
      continue;
    }
    const unknownPeers = includedOptionalPeers.filter(
      (peer) => !optionalPeers.includes(peer)
    );
    if (unknownPeers.length > 0) {
      claimErrors.push(
        `${entry}: unknown included optional peer(s): ${unknownPeers.join(
          ", "
        )}`
      );
      continue;
    }
    if (!existsSync(join(packageDir, entry))) {
      claimErrors.push(`${entry}: not found -- run \`pnpm build\` first`);
      continue;
    }

    const claimExternal = optionalPeers
      .filter((peer) => !includedOptionalPeers.includes(peer))
      .flatMap((peer) => [peer, `${peer}/*`]);
    const result = await esbuild.build({
      entryPoints: [join(packageDir, entry)],
      bundle: true,
      format: "esm",
      write: false,
      metafile: true,
      external: claimExternal,
      absWorkingDir: packageDir,
      logLevel: "silent",
    });
    const inputs = Object.keys(result.metafile.inputs).map((input) =>
      input.replaceAll("\\", "/")
    );
    for (const forbiddenInput of forbiddenInputs) {
      const matches = inputs.filter((input) => input.includes(forbiddenInput));
      if (matches.length > 0) {
        claimErrors.push(
          `${entry}: documented exclusion "${forbiddenInput}" reached ${matches.length} input(s) ` +
            `(first: ${matches[0]})`
        );
      }
    }
    if (!claimErrors.some((error) => error.startsWith(`${entry}:`))) {
      const peerSummary = includedOptionalPeers.length > 0
        ? `${includedOptionalPeers.join(", ")} included`
        : "optional peers externalized";
      console.log(
        `${entry}: peer-inclusive exclusion graph verified (${inputs.length} inputs; ` +
          `${peerSummary})`
      );
    }
  }
  return claimErrors;
};

// splitting stays off, so relative dynamic imports (the archive/ebook lazy registrations) are
// inlined into the single output file and each entry's number is self-contained.
const bundleEntry = async (entry) => {
  const result = await esbuild.build({
    entryPoints: [join(packageDir, entry)],
    bundle: true,
    format: "esm",
    minify: true,
    write: false,
    external,
    absWorkingDir: packageDir,
    logLevel: "silent",
  });
  return result.outputFiles[0].contents;
};

// Measures only the entry chunk and its transitively static imports. A first-open dynamic import
// remains in the separately guarded no-splitting total above, but is deliberately absent from this
// initial-route number -- exactly how a production code-splitting consumer pays for it.
const bundleInitialRoute = async (name, imports) => {
  const sourceFile = `bundle-initial-${name}.js`;
  const result = await esbuild.build({
    stdin: {
      contents: imports.map((entry) => `import ${JSON.stringify(`./${entry}`)};`).join("\n"),
      resolveDir: packageDir,
      sourcefile: sourceFile,
    },
    bundle: true,
    splitting: true,
    format: "esm",
    minify: true,
    write: false,
    outdir: ".bundle-initial",
    metafile: true,
    external,
    absWorkingDir: packageDir,
    logLevel: "silent",
  });
  const entryOutput = Object.entries(result.metafile.outputs).find(
    ([, output]) => output.entryPoint === sourceFile
  )?.[0];
  if (!entryOutput) throw new Error(`${name}: splitting-aware bundle emitted no entry output`);

  const pending = [entryOutput];
  const initialOutputs = new Set();
  while (pending.length > 0) {
    const outputPath = pending.pop();
    if (!outputPath || initialOutputs.has(outputPath)) continue;
    initialOutputs.add(outputPath);
    const output = result.metafile.outputs[outputPath];
    if (!output) throw new Error(`${name}: missing metafile output ${outputPath}`);
    for (const imported of output.imports) {
      if (imported.external || imported.kind === "dynamic-import") continue;
      pending.push(imported.path);
    }
  }

  const filesByPath = new Map(
    result.outputFiles.map((file) => [resolve(file.path), file.contents])
  );
  let gzipBytes = 0;
  for (const outputPath of initialOutputs) {
    const contents = filesByPath.get(resolve(packageDir, outputPath));
    if (!contents) throw new Error(`${name}: no emitted bytes for ${outputPath}`);
    gzipBytes += gzipBytesOf(contents);
  }
  return { gzipBytes, outputCount: initialOutputs.size };
};

// Level 9 approximates the static-hosting gzip a consumer actually ships. zlib patch releases can
// vary these live counts slightly even when esbuild emits identical bytes, so reviewed ceilings
// intentionally use integer KiB rather than exact snapshots. Published aggregate stats below use a
// wider 5% drift band; exact per-component evidence is separately anchored to the emitted bundle
// SHA-256 by component-integration.mjs.
const gzipBytesOf = (contents) => gzipSync(contents, { level: 9 }).length;

const toKb = (bytes) => (bytes / 1024).toFixed(1);

const errors = [];
errors.push(...(await verifyBundleExclusionClaims()));

if (exclusionClaimsOnly) {
  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else {
    console.log(
      `bundle exclusion claims verified: ${exclusionClaimEntries.length} entries`
    );
  }
} else {
  const missingEntries = [...new Set([
    ...entries,
    ...initialBaselineEntries,
    ...Object.keys(initialMarginalBudgets),
  ])].filter(
    (entry) => !existsSync(join(packageDir, entry))
  );
  if (missingEntries.length) {
    console.error(
      missingEntries
        .map((entry) => `${entry}: not found -- run \`pnpm build\` first`)
        .join("\n")
    );
    process.exitCode = 1;
  } else {
    const initialBaseline = await bundleInitialRoute("baseline", initialBaselineEntries);
    const initialMeasurements = [];
    for (const entry of Object.keys(initialMarginalBudgets).sort()) {
      const route = await bundleInitialRoute(
        entry.replaceAll(/[^a-z0-9]+/giu, "-"),
        [...initialBaselineEntries, entry]
      );
      initialMeasurements.push({
        entry,
        baselineGzipBytes: initialBaseline.gzipBytes,
        routeGzipBytes: route.gzipBytes,
        marginalGzipBytes: positiveInitialMarginalGzipBytes(
          route.gzipBytes,
          initialBaseline.gzipBytes,
          entry
        ),
        outputCount: route.outputCount,
      });
    }
    const measured = [];
    for (const entry of entries) {
      const contents = await bundleEntry(entry);
      // Mirror the entry's path under the emit dir (minus the `dist/` prefix) rather than flattening
      // to a basename: keeps two same-named entries from colliding and gives Codecov asset names
      // that match what a consumer actually imports.
      if (emitDir) {
        const outPath = join(emitDir, entry.replace(/^dist\//, ""));
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, contents);
      }
      measured.push({
        entry,
        minBytes: contents.length,
        gzipBytes: gzipBytesOf(contents),
      });
    }

    // The README badge reports the average weight of a single-component import, so that figure has
    // to be measured rather than asserted: every published per-component entry is bundled exactly
    // like the budgeted ones above and the mean gzip size is recorded in scripts/bundle-stats.json.
    // Each measurement is self-contained -- lit and the shared LyraElement base are counted once per
    // component -- so the average is a conservative per-import figure, not the marginal cost of
    // adding one more component to an app that already imports others (with code splitting the
    // shared layers are paid once, and the marginal chunk is a couple of KB). The whole sweep is
    // ~200 esbuild passes and runs in a few seconds, so it stays in the normal check.
    const componentsDir = join(packageDir, "dist", "components");
    const componentEntries = existsSync(componentsDir)
      ? readdirSync(componentsDir, { withFileTypes: true })
          .filter((family) => family.isDirectory())
          .flatMap((family) =>
            readdirSync(join(componentsDir, family.name), {
              withFileTypes: true,
            })
              .filter((component) => component.isDirectory())
              .map(
                (component) =>
                  `dist/components/${family.name}/${component.name}/${component.name}.js`
              )
          )
          .filter((entry) => existsSync(join(packageDir, entry)))
          .sort()
      : [];
    const componentGzipBytes = [];
    for (const entry of componentEntries) {
      componentGzipBytes.push(gzipBytesOf(await bundleEntry(entry)));
    }
    const avgComponentGzipKb = componentGzipBytes.length
      ? Number(
          (
            componentGzipBytes.reduce((sum, bytes) => sum + bytes, 0) /
            componentGzipBytes.length /
            1024
          ).toFixed(1)
        )
      : 0;
    const sortedComponentBytes = [...componentGzipBytes].sort((a, b) => a - b);
    const p95ComponentGzipBytes =
      sortedComponentBytes[
        Math.max(0, Math.ceil(sortedComponentBytes.length * 0.95) - 1)
      ] ?? 0;
    const maxComponentGzipBytes = sortedComponentBytes.at(-1) ?? 0;
    // The second badge figure: the whole barrel, i.e. what a consumer pays who imports every
    // component at once. It is the upper bound the per-component average sits under. It reads
    // `dist/all.js` rather than the package root: the root stopped registering components in 8.0.0,
    // so its weight no longer answers "what does importing everything cost".
    const barrelGzipKb = Number(
      toKb(
        measured.find(({ entry }) => entry === "dist/all.js")?.gzipBytes ?? 0
      )
    );

    if (writeStats) {
      writeFileSync(
        statsPath,
        `${JSON.stringify(
          {
            $comment:
              "measured (not budgeted) gzip sizes, rendered by the README size badges and stamped into " +
              "the lyra-ui.com hero; each component is bundled standalone, so lit and the shared base are " +
              "counted once in every per-component figure and barrelGzipKb is what importing everything " +
              "costs -- measured from dist/all.js, the entry that registers the whole root-included set, " +
              "since the package root itself is registration-free. Regenerated by " +
              "scripts/check-bundle-size.mjs --write-stats; the normal check fails when the live build " +
              "drifts from these.",
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
          2
        )}\n`
      );
      console.log(
        `${componentEntries.length} component measurements written to scripts/bundle-stats.json; ` +
          `reviewed budgets were not changed`
      );
    }
    for (const entry of entries) {
      if (typeof budgets[entry] !== "number") {
        errors.push(`${entry}: no hard budget in scripts/bundle-budgets.json`);
      }
    }
    // A budget for an entry this script no longer measures is drift (typically an entry rename):
    // it looks covered but guards nothing.
    for (const key of Object.keys(budgets)) {
      if (!key.startsWith("$") && !entries.includes(key)) {
        errors.push(
          `scripts/bundle-budgets.json has a stale entry "${key}" that is no longer measured`
        );
      }
    }
    for (const { entry, minBytes, gzipBytes } of measured) {
      const budgetKb = budgets[entry];
      if (typeof budgetKb !== "number") continue;
      const line = `${entry}: min ${toKb(minBytes)} KB, gzip ${toKb(
        gzipBytes
      )} KB (budget ${budgetKb} KB)`;
      if (gzipBytes > budgetKb * 1024) {
        errors.push(
          `${line} -- OVER BUDGET by ${toKb(
            gzipBytes - budgetKb * 1024
          )} KB gzip`
        );
      } else {
        console.log(`${line} ok`);
      }
    }
    for (const measurement of initialMeasurements) {
      const budgetKb = initialMarginalBudgets[measurement.entry];
      const line =
        `${measurement.entry}: initial marginal gzip ${toKb(measurement.marginalGzipBytes)} KB ` +
        `(route ${toKb(measurement.routeGzipBytes)} KB - baseline ` +
        `${toKb(measurement.baselineGzipBytes)} KB; ${measurement.outputCount} initial chunk(s); ` +
        `budget ${budgetKb} KB)`;
      if (measurement.marginalGzipBytes > budgetKb * 1024) {
        errors.push(
          `${line} -- OVER BUDGET by ${toKb(
            measurement.marginalGzipBytes - budgetKb * 1024
          )} KB gzip`
        );
      } else {
        console.log(`${line} ok`);
      }
    }
    for (const [label, actualBytes, budgetKey] of [
      ["component p95", p95ComponentGzipBytes, "$componentP95GzipKb"],
      ["component max", maxComponentGzipBytes, "$componentMaxGzipKb"],
    ]) {
      const budgetKb = budgets[budgetKey];
      const line = `${label}: gzip ${toKb(
        actualBytes
      )} KB (budget ${budgetKb} KB)`;
      if (actualBytes > budgetKb * 1024) errors.push(`${line} -- OVER BUDGET`);
      else console.log(`${line} ok`);
    }

    // The README badges render scripts/bundle-stats.json straight from main, so a stale file is a
    // published false claim rather than a private inconsistency. The component count is checked
    // exactly (adding or removing a component changes the average by definition); the two sizes get
    // a 5% band so ordinary churn inside existing components does not demand a regeneration commit.
    if (!existsSync(statsPath)) {
      errors.push(
        "scripts/bundle-stats.json not found -- generate it with `node scripts/check-bundle-size.mjs --write-stats`"
      );
    } else {
      const stats = JSON.parse(readFileSync(statsPath, "utf8"));
      const drifted = (recorded, live) =>
        typeof recorded !== "number" ||
        Math.abs(live - recorded) > recorded * 0.05;
      if (stats.componentCount !== componentEntries.length) {
        errors.push(
          `scripts/bundle-stats.json records ${stats.componentCount} components but ${componentEntries.length} are published ` +
            "-- the README size badges are stale, regenerate with --write-stats"
        );
      }
      if (stats.measuredEntrypointCount !== componentEntries.length) {
        errors.push(
          `scripts/bundle-stats.json records ${stats.measuredEntrypointCount} measured entry points but ` +
            `${componentEntries.length} are published -- regenerate with --write-stats`
        );
      }
      if (stats.publicTagCount !== publicTagCount) {
        errors.push(
          `scripts/bundle-stats.json records ${stats.publicTagCount} public tags but the manifest contains ` +
            `${publicTagCount} -- regenerate with --write-stats`
        );
      }
      if (
        stats.aliasPresetCount !== aliasPresetCount ||
        stats.primaryBehaviorCount !== primaryBehaviorCount
      ) {
        errors.push(
          "scripts/bundle-stats.json taxonomy counts are stale -- update component-taxonomy.json if needed, " +
            "then regenerate with --write-stats"
        );
      }
      if (drifted(stats.avgComponentGzipKb, avgComponentGzipKb)) {
        errors.push(
          `scripts/bundle-stats.json records an average of ${stats.avgComponentGzipKb} KB gzip per component but the build ` +
            `measures ${avgComponentGzipKb} KB -- the README size badges are stale, regenerate with --write-stats`
        );
      }
      if (drifted(stats.barrelGzipKb, barrelGzipKb)) {
        errors.push(
          `scripts/bundle-stats.json records a ${stats.barrelGzipKb} KB gzip barrel but the build measures ${barrelGzipKb} KB ` +
            "-- the README size badges are stale, regenerate with --write-stats"
        );
      }
      if (!errors.length) {
        console.log(
          `bundle stats verified: ${componentEntries.length} components average ${avgComponentGzipKb} KB gzip, ` +
            `barrel ${barrelGzipKb} KB gzip (scripts/bundle-stats.json)`
        );
      }
    }

    if (errors.length) {
      console.error(errors.join("\n"));
      console.error(
        "Bundle growth must be reduced or receive an explicit reviewed budget change with rationale."
      );
      process.exitCode = 1;
    } else {
      console.log(
        `bundle-size budgets verified: ${measured.length} entries within scripts/bundle-budgets.json ` +
          `and ${initialMeasurements.length} splitting-aware initial routes ` +
          `(${optionalPeers.length} optional peers externalized)`
      );
    }
  }
}
