import { isMainModule } from './is-main-module.mjs';

// Publishes the pre-paint no-flash theme bootstrap (`lyraThemeBootstrap`, `src/theme/theme.ts`) as
// its own static script asset, so an application under a Content-Security-Policy that forbids
// `unsafe-inline` -- and cannot mint a per-response nonce, e.g. a static HTML entry -- can
// reference it with `<script src="...">` instead of inlining it and hand-rolling a nonce/hash
// pipeline.
//
// The asset's bytes are copied *verbatim* from the already-built `dist/theme/theme.js` module's
// own `lyraThemeBootstrap` export -- never re-derived from source and never hand-kept -- so this
// is the exact string a consumer would otherwise inline, byte for byte: a CSP hash computed for
// one is valid for the other, and the two delivery mechanisms can never drift apart. Per decision
// 34, this deliberately does NOT add a hash-helper -- an application already has one CSP
// verification path (inline hash) and this asset gives it a second, complete one (external file);
// it does not need a third.
//
// Reading the *built* module (not the TypeScript source) is deliberate: `scripts/build.mjs` runs
// the published JavaScript through esbuild syntax minification, which can rename block-scoped
// locals that source-level tooling (this package's own wtr test transpile included) never
// touches. Only the built module's own evaluated export is the value that ever actually reaches a
// consumer, so it's the only value this script may treat as the source of truth.
//
// Called unconditionally from `scripts/build.mjs` immediately after JavaScript compaction, so
// every `pnpm build` leaves this asset current; `--check` lets CI verify that invariant without
// regenerating.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultPackageDir = fileURLToPath(new URL('..', import.meta.url));

function artifactPaths(packageDir) {
  return {
    builtModule: join(packageDir, 'dist', 'theme', 'theme.js'),
    asset: join(packageDir, 'dist', 'theme', 'theme-bootstrap.js'),
  };
}

/**
 * Reads `lyraThemeBootstrap` from the already-built `dist/theme/theme.js`. A fresh child-process
 * import per call is not required here (unlike this script's own CLI, which the test suite
 * exercises out-of-process for exactly that reason) since each caller reads the same on-disk file
 * within one process at most once.
 */
export async function readBuiltThemeBootstrap(packageDir = defaultPackageDir) {
  const { builtModule } = artifactPaths(packageDir);
  if (!existsSync(builtModule)) {
    throw new Error(`${builtModule} does not exist -- run \`pnpm run build\` first.`);
  }
  const moduleUrl = `${pathToFileURL(builtModule).href}?t=${Date.now()}_${Math.random()}`;
  const imported = await import(moduleUrl);
  const { lyraThemeBootstrap } = imported;
  if (typeof lyraThemeBootstrap !== 'string' || lyraThemeBootstrap.length === 0) {
    throw new Error(`${builtModule} did not export a non-empty lyraThemeBootstrap string.`);
  }
  return lyraThemeBootstrap;
}

export async function checkThemeBootstrapAsset(packageDir = defaultPackageDir) {
  const { asset } = artifactPaths(packageDir);
  const expected = await readBuiltThemeBootstrap(packageDir);
  const findings = [];
  if (!existsSync(asset) || readFileSync(asset, 'utf8') !== expected) {
    findings.push('dist/theme/theme-bootstrap.js is stale or missing relative to dist/theme/theme.js');
  }
  return { findings, expected };
}

export async function generateThemeBootstrapAsset(packageDir = defaultPackageDir) {
  const { asset } = artifactPaths(packageDir);
  const expected = await readBuiltThemeBootstrap(packageDir);
  writeFileSync(asset, expected);
  return expected;
}

async function run(argv) {
  const unknown = argv.filter((argument) => argument !== '--check');
  if (unknown.length > 0) {
    console.error(`Unknown option(s): ${unknown.join(', ')}`);
    return 1;
  }
  if (argv.includes('--check')) {
    const result = await checkThemeBootstrapAsset();
    if (result.findings.length > 0) {
      console.error(`${result.findings.join('\n')}\nRun \`pnpm run theme-bootstrap\` (or \`pnpm run build\`) and commit the generated file.`);
      return 1;
    }
    console.log(`theme-bootstrap.js is current: ${result.expected.length} bytes.`);
    return 0;
  }
  const expected = await generateThemeBootstrapAsset();
  console.log(`theme-bootstrap.js generated: ${expected.length} bytes.`);
  return 0;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = await run(process.argv.slice(2));
}
