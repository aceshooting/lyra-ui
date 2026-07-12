#!/usr/bin/env node
/**
 * Maintenance job: renders each pristine `flags/detailed/<code>.svg` original to a small WebP
 * raster at `flags/compact/<code>.webp` — the `compact` tier `<lyra-flag variant="compact">` and
 * `flagUrl(code, { variant: 'compact' })` serve for icon-scale use (menu items, language
 * selectors, dense lists; ~12-28px). See
 * docs/superpowers/specs/2026-07-12-flag-icon-tiers-design.md.
 *
 * Why a raster, not more vector optimization: the ~65 flags with a detailed original embed a
 * national coat of arms / seal / emblem drawn as hundreds of tiny paths (e.g. `es` is 615 paths).
 * At a 16-28px icon that emblem is a ~10px smudge, so the paths buy zero visible fidelity while
 * costing tens of KB even after the aggressive `standard`-tier SVGO pass. A downscaled raster is
 * both smaller (~1-3 KB) AND crisper at that size than hundreds of sub-pixel paths that alias into
 * mush, and paints far faster when 50 are on screen at once. Vector scalability isn't needed here —
 * that's exactly what the `standard` (card scale) and `detailed` (hero scale) tiers are for.
 * The simple stripe/block flags are NOT rasterized: they have no detailed original, are already
 * tiny+crisp+scalable vectors, and `flagUrl(..., { variant: 'compact' })` falls back to them.
 *
 * Rendered FROM the pristine `detailed/` original (the best downscale input), at the source's
 * square 1000x1000 framing -> `SIZE`x`SIZE`, so it drops into `<lyra-flag>`'s CSS-driven
 * `object-fit: cover` box pixel-identically to how the vector renders. `SIZE` = 128 covers icon
 * use up to ~28px at 3x device-pixel-ratio with headroom; `QUALITY` 80 is visually lossless at
 * that scale (verified) while staying ~1-3 KB. Both are constants — bump them if a busy emblem
 * ever reads poorly. `@resvg/resvg-js` (SVG -> PNG, faithful linear/radial gradient support) and
 * `sharp` (PNG -> WebP) are devDependencies only; they never ship in the published tarball.
 *
 * Run via `pnpm --filter @aceshooting/lyra-flags run build-compact`. Idempotent (re-run overwrites
 * each `.webp`). Follow with `pnpm run generate` to pick up new `flags/compact/` entries into the
 * generated index. Maintenance order after a source-art change: optimize -> build-compact ->
 * generate.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const flagsDir = path.join(scriptDir, '..', 'flags');
const detailedDir = path.join(flagsDir, 'detailed');
const compactDir = path.join(flagsDir, 'compact');

const SIZE = 128; // px, square (matches the source viewBox); covers ~28px icons at 3x DPR
const QUALITY = 80; // WebP quality; visually lossless at icon scale, ~1-3 KB
const COMPACT_BUDGET_BYTES = 12_000; // sanity ceiling; a compact raster far above this is suspect

async function toWebp(svg) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: SIZE } }).render().asPng();
  return sharp(png).webp({ quality: QUALITY }).toBuffer();
}

async function main() {
  const codes = readdirSync(detailedDir)
    .filter((name) => name.endsWith('.svg'))
    .map((name) => name.replace(/\.svg$/, ''))
    .sort((a, b) => a.localeCompare(b));

  if (codes.length === 0) {
    console.log('No flags/detailed/*.svg originals found — nothing to rasterize.');
    return;
  }

  mkdirSync(compactDir, { recursive: true });

  const rows = [];
  for (const code of codes) {
    const svg = readFileSync(path.join(detailedDir, `${code}.svg`));
    const webp = await toWebp(svg);
    writeFileSync(path.join(compactDir, `${code}.webp`), webp);
    rows.push({ code, size: webp.length });
  }

  rows.sort((a, b) => b.size - a.size);
  const total = rows.reduce((sum, r) => sum + r.size, 0);
  const largest = rows[0];
  console.log(
    `Rasterized ${rows.length} compact flag(s) to flags/compact/*.webp at ${SIZE}px, q${QUALITY}. ` +
      `Total ${(total / 1024).toFixed(1)} KB, avg ${Math.round(total / rows.length)} B, ` +
      `largest ${largest.code} at ${largest.size} B. Run \`pnpm run generate\` next.`,
  );

  const over = rows.filter((r) => r.size > COMPACT_BUDGET_BYTES);
  if (over.length > 0) {
    console.warn(
      `\nWARNING: ${over.length} compact raster(s) exceed the ${COMPACT_BUDGET_BYTES} B sanity ceiling: ` +
        `${over.map((r) => `${r.code} (${r.size} B)`).join(', ')}. Check the source art or lower QUALITY.`,
    );
  }
}

main();
