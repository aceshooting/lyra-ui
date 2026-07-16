#!/usr/bin/env node
/**
 * Maintenance job: for every `flags/<code>.svg` whose source art is large enough to warrant it,
 * preserves the pristine vendored original at `flags/detailed/<code>.svg` and (re)derives the
 * `standard`-tier `flags/<code>.svg` from that original with an aggressive-but-geometry-lossless
 * SVGO pass. The `standard` tier is what `<lyra-flag>` renders by default and targets card/row
 * sizes (~28-96px); the pristine `flags/detailed/<code>.svg` backs `variant="detailed"` (hero
 * scale), and a separate WebP raster (`scripts/build-compact.mjs`) backs `variant="compact"`
 * (icon scale).
 *
 * Why a size threshold rather than "optimize everything": 175 of 249 flags are already <= 10 KB
 * (median 2,572 bytes) — the package-wide problem is a minority of outliers whose source art
 * embeds full illustrative detail (a national coat of arms, seal, or emblem), not a uniform
 * "vector is big" baseline. 20 KB scopes the job to those ~65 outliers.
 *
 * Why this SVGO config: every flag's `viewBox="0 0 1000 1000"` means one user-unit is 1/1000 of
 * the flag width, so `floatPrecision: 0` (integer, 1-unit coordinate rounding) is still sub-pixel
 * (<0.1px) at the ~96px top of the standard band -- and <0.2px even at 200px -- so it is an
 * encoding change, not a visible geometric simplification. `mergePaths: { force: true }` merges
 * sibling `<path>`s into one multi-subpath `d`; also structural, not geometric. No vertex/curve
 * *count* reduction is done (that would risk visible artifacts and need per-flag review). Measured
 * across all 65 outliers: this brings every one under 80 KB with no fidelity loss perceptible at
 * the sizes the standard tier renders at -- worst cases `sv` (El Salvador) 741 KB pristine -> 75
 * KB, `ec` 654 -> 67, `rs` 474 -> 66. Anyone needing crispness past ~96px uses `detailed`.
 *
 * Run via `pnpm --filter @aceshooting/lyra-flags run optimize`. Re-runnable: for a code that
 * already has a `flags/detailed/<code>.svg`, the standard flag is re-derived *from that pristine
 * original* (never from the already-optimized file, which would compound precision loss), so
 * changing the SVGO config here and re-running cleanly re-optimizes rather than being a no-op.
 * Follow with `pnpm run build-compact` (compact rasters) then `pnpm run generate` (index).
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
    {
      name: 'preset-default',
      params: {
        overrides: {
          convertPathData: { floatPrecision: 0, transformPrecision: 1 },
          cleanupNumericValues: { floatPrecision: 0 },
          mergePaths: { force: true, floatPrecision: 0 },
        },
      },
    },
    // A second, standalone pass after the preset squeezes a little more: `applyTransforms` flattens
    // any residual transforms into path data at precision 0, and a forced `mergePaths` re-coalesces
    // paths the preset left separate. Both are still encoding-only (no vertex/curve count change).
    { name: 'convertPathData', params: { floatPrecision: 0, transformPrecision: 1, applyTransforms: true } },
    { name: 'mergePaths', params: { force: true, floatPrecision: 0 } },
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

    // Pick the pristine source to optimize FROM. A code that already has a preserved detailed
    // original is re-derived from THAT (never from the already-optimized flags/<code>.svg, which
    // would compound lossy precision rounding on every re-run), so re-running with a changed SVGO
    // config cleanly re-optimizes. A code with no preserved original is only touched if it is
    // large enough to be worth optimizing, and its pristine art is preserved first.
    const beforeSize = statSync(svgPath).size;
    let source;
    if (existsSync(detailedPath)) {
      source = readFileSync(detailedPath, 'utf8');
    } else {
      if (beforeSize <= SIZE_THRESHOLD_BYTES) continue;
      source = readFileSync(svgPath, 'utf8');
      writeFileSync(detailedPath, source);
    }

    const result = optimize(source, { path: svgPath, ...SVGO_CONFIG });
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
  const largest = rows.reduce((m, r) => (r.afterSize > m.afterSize ? r : m), rows[0]);
  console.log(
    `\n${rows.length} flag(s) optimized. Total: ${totalBefore} B -> ${totalAfter} B ` +
      `(-${(100 * (1 - totalAfter / totalBefore)).toFixed(1)}%). ` +
      `Largest standard flag: ${largest.code} at ${largest.afterSize} B. ` +
      `Pristine originals preserved in flags/detailed/. ` +
      'Run `pnpm run build-compact` then `pnpm run generate` next.',
  );

  // Budget guard: the standard tier targets card/row sizes and must stay lightweight. Warn loudly
  // (rather than silently ship) if a source bump ever pushes an optimized flag back over 80 KB --
  // scripts/test.mjs asserts the same budget as a hard failure.
  const STANDARD_BUDGET_BYTES = 80_000;
  const over = rows.filter((r) => r.afterSize > STANDARD_BUDGET_BYTES);
  if (over.length > 0) {
    console.warn(
      `\nWARNING: ${over.length} flag(s) still exceed the ${STANDARD_BUDGET_BYTES} B standard-tier ` +
        `budget: ${over.map((r) => `${r.code} (${r.afterSize} B)`).join(', ')}. Consider tuning the ` +
        'SVGO config or, as a last resort, genuine geometry simplification for these.',
    );
  }
}

main();
