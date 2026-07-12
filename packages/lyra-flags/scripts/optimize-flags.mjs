#!/usr/bin/env node
/**
 * One-time/maintenance job: for every `flags/<code>.svg` whose raw size exceeds
 * `SIZE_THRESHOLD_BYTES`, preserves the pristine vendored original at
 * `flags/detailed/<code>.svg` and overwrites `flags/<code>.svg` with an SVGO-optimized
 * (icon-scale-appropriate) replacement.
 *
 * Why a size threshold rather than "optimize everything": 175 of 249 flags are already <= 10 KB
 * (median 2,572 bytes) — the package-wide problem is a minority of outliers whose source art
 * embeds full illustrative detail (a national coat of arms, seal, or emblem), not a uniform
 * "vector is big" baseline. 20 KB matches the threshold the consumer report that prompted this
 * job used to scope its own findings (65 of 249 flags exceed it).
 *
 * Why SVGO with this specific config, not the default preset: every flag's `viewBox="0 0 1000
 * 1000"` (1000 user-units for an icon typically rendered at 16-24px) means a rendered pixel spans
 * ~40 user-units, so `floatPrecision: 1` (0.1-unit coordinate rounding) is over 3 orders of
 * magnitude finer than anything visible at icon scale -- safe, not a visible simplification.
 * `mergePaths` combines same-style sibling `<path>` elements into one multi-subpath `d`, which is
 * a structural/encoding change, not a geometric one. Measured on the worst offender (`sv.svg`,
 * El Salvador, 1,533 paths): default SVGO preset alone only reaches -46% (759 KB -> 407 KB, still
 * far too large for an icon); this config reaches -75% (759 KB -> ~189 KB). That still isn't
 * "icon-ideal" (a simple 3-4-path flag like `fr.svg` is under 1 KB) -- reaching that would require
 * genuine path-geometry simplification (vertex/curve reduction), which risks visible artifacts per
 * flag and needs individual visual review, out of scope for this automated, zero-visual-risk pass.
 * The reduction here is still substantial and real (measured, not assumed) and ships with no
 * fidelity loss perceptible at the icon scale `<lyra-flag>` renders at.
 *
 * Run via `pnpm --filter @aceshooting/lyra-flags run optimize`. Idempotent: re-running is a no-op
 * for a code that already has a `flags/detailed/<code>.svg` (the compact `flags/<code>.svg` is
 * never re-derived from an already-optimized file, which would compound precision loss). Follow
 * with `pnpm run generate` to pick up the new `flags/detailed/` entries into the generated index.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { optimize } from 'svgo';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const flagsDir = path.join(scriptDir, '..', 'flags');
const detailedDir = path.join(flagsDir, 'detailed');

const SIZE_THRESHOLD_BYTES = 20_000;

// No removeViewBox override needed: every source flag declares only `viewBox` (no `width`/
// `height` attributes), and svgo's default `removeViewBox` only strips `viewBox` when it's
// redundant with present `width`/`height` -- a no-op here regardless, so preset-default's default
// is already safe.
const SVGO_CONFIG = {
  multipass: true,
  plugins: [
    'preset-default',
    { name: 'convertPathData', params: { floatPrecision: 1, transformPrecision: 2 } },
    'mergePaths',
  ],
};

function main() {
  const codes = readdirSync(flagsDir)
    .filter((name) => name.endsWith('.svg'))
    .map((name) => name.replace(/\.svg$/, ''))
    .sort((a, b) => a.localeCompare(b));

  mkdirSync(detailedDir, { recursive: true });

  const rows = [];
  for (const code of codes) {
    const svgPath = path.join(flagsDir, `${code}.svg`);
    const detailedPath = path.join(detailedDir, `${code}.svg`);

    // Idempotency guard: a code that already has a preserved detailed original was already
    // processed by a previous run -- flags/<code>.svg is already the optimized version, so
    // re-running SVGO on it (instead of the pristine original) would compound lossy precision
    // rounding on every re-run. Skip entirely rather than re-derive.
    if (existsSync(detailedPath)) continue;

    const beforeSize = statSync(svgPath).size;
    if (beforeSize <= SIZE_THRESHOLD_BYTES) continue;

    const original = readFileSync(svgPath, 'utf8');
    writeFileSync(detailedPath, original);

    const result = optimize(original, { path: svgPath, ...SVGO_CONFIG });
    writeFileSync(svgPath, result.data);
    const afterSize = Buffer.byteLength(result.data, 'utf8');

    rows.push({ code, beforeSize, afterSize });
  }

  if (rows.length === 0) {
    console.log('No flags exceeded the threshold (or all were already processed) -- nothing to do.');
    return;
  }

  const totalBefore = rows.reduce((sum, r) => sum + r.beforeSize, 0);
  const totalAfter = rows.reduce((sum, r) => sum + r.afterSize, 0);
  console.log(`code   before        after       reduction`);
  for (const { code, beforeSize, afterSize } of rows) {
    const reduction = (100 * (1 - afterSize / beforeSize)).toFixed(1);
    console.log(
      `${code.padEnd(6)} ${String(beforeSize).padStart(9)} B  ${String(afterSize).padStart(9)} B  -${reduction}%`,
    );
  }
  console.log(
    `\n${rows.length} flag(s) optimized. Total: ${totalBefore} B -> ${totalAfter} B ` +
      `(-${(100 * (1 - totalAfter / totalBefore)).toFixed(1)}%). ` +
      `Pristine originals preserved in flags/detailed/. Run \`pnpm run generate\` next.`,
  );
}

main();
