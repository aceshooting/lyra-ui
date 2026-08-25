#!/usr/bin/env node
// Emitted-artifact gate: `dist/` must contain no source maps and no map references.
// package.json#files publishes `dist` and NOT `src`, so every `.js.map` / `.d.ts.map` tsc used to
// emit pointed at a `../../../../src/**/*.ts` path that does not exist in an install and carried no
// `sourcesContent`. That was 2070 files and ~13 MB of the tarball (32M -> 19M `dist`) which no
// consumer could ever use, and `declarationMap` was actively harmful: it routes an editor's
// Go-to-Definition at the missing `.ts` and fails there instead of falling back to the readable
// `.d.ts` beside it.
// `tsconfig.build.json` turns both flags off, but a config file is easy to lose: a future
// `extends` reshuffle, a `--sourceMap` on some other build path, or `scripts/build.mjs` reverting
// to `tsconfig.json` would silently regrow all of it, and nothing else in the repository looks at
// what tsc actually emitted. This does, on the emitted bytes rather than on the config that
// produced them, so the assertion survives any change in how the build is spelled.
// Two independent signals, because either can appear without the other: a stray `*.map` file
// (emit turned back on), and a `sourceMappingURL` comment inside an emitted file (a map that was
// referenced but pruned afterwards, which leaves consumers' devtools chasing a 404).
// Runs as the second half of `pnpm run build` — the only point where `dist/` is guaranteed to be
// both present and current — which also covers `prepack` and therefore every published tarball.
// Run it standalone with `pnpm run check:build-artifacts` after any build.
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Emitted text files worth reading; anything else in `dist` is a copied asset. */
const TEXT_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.css'];

/** Both comment spellings tsc emits (`//# ...` for JS/d.ts, `/*# ... *\/` for CSS). */
const MAP_REFERENCE = /(?:\/\/|\/\*)#\s*sourceMappingURL=/;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

/**
 * @param {string[]} files absolute paths of every emitted file
 * @param {(file: string) => string} read
 * @returns {string[]} findings, one per offending file
 */
export function findMapArtifacts(files, read) {
  const findings = [];
  for (const file of files.slice().sort()) {
    if (file.endsWith('.map')) {
      findings.push(`${file}: source map emitted into dist -- package.json#files ships dist without src, so its \`sources\` paths do not exist in an install`);
      continue;
    }
    if (!TEXT_EXTENSIONS.includes(path.extname(file))) continue;
    if (MAP_REFERENCE.test(read(file))) {
      findings.push(`${file}: carries a sourceMappingURL comment -- the referenced map is not published, so a consumer's devtools 404s on it`);
    }
  }
  return findings;
}

function run() {
  const distDir = path.join(packageDir, 'dist');
  let stats;
  try {
    stats = statSync(distDir);
  } catch {
    stats = undefined;
  }
  if (!stats?.isDirectory()) {
    console.error('No dist/ directory. Run `pnpm run build` first -- this gate reads what the build emitted.');
    process.exitCode = 1;
    return;
  }

  const files = walk(distDir);
  const findings = findMapArtifacts(files, (file) => readFileSync(file, 'utf8')).map((finding) =>
    finding.replace(`${packageDir}${path.sep}`, ''),
  );

  if (findings.length > 0) {
    console.error(`Build artifacts failed with ${findings.length} finding(s):`);
    for (const finding of findings) console.error(`- ${finding}`);
    console.error(
      'Source maps are turned off for the published emit in tsconfig.build.json; restore `sourceMap: false` / `declarationMap: false` there rather than deleting the files by hand.',
    );
    process.exitCode = 1;
    return;
  }

  const bytes = files.reduce((total, file) => total + statSync(file).size, 0);
  console.log(
    `Build artifacts passed: ${files.length} emitted file(s), ${(bytes / 1024 / 1024).toFixed(1)} MiB, no source maps or map references.`,
  );
}

const isMain = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isMain) run();

export { run };

