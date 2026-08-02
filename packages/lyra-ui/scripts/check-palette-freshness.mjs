// Freshness gate for the three generated colour artifacts. `src/internal/tokens/palette.styles.ts`
// is generated end to end; `src/theme.css` and `src/internal/tokens.styles.ts` carry generated
// marker blocks inside otherwise hand-authored files. Nothing re-ran or diffed any of them, so a
// hand edit to a generated block survived indefinitely -- and, because the generators enforce the
// contrast and CVD-separation floors, a hand-edited ramp is a silent accessibility regression.
//
// Deliberately a content round-trip rather than `git diff --exit-code`: comparing against the
// working tree catches a hand edit that was already committed, and it cannot fail spuriously
// because of unrelated uncommitted work in the same files. The originals are restored on failure,
// so the check never mutates the tree it is auditing.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageDir = fileURLToPath(new URL('..', import.meta.url));

export const PALETTE_GENERATORS = Object.freeze([
  'scripts/generate-palette.mjs',
  'scripts/generate-chart-palette.mjs',
  'scripts/generate-terminal-palette.mjs',
]);

export const PALETTE_ARTIFACTS = Object.freeze([
  'src/internal/tokens/palette.styles.ts',
  'src/theme.css',
  'src/internal/tokens.styles.ts',
]);

export function checkPaletteFreshness(dir = packageDir) {
  const before = PALETTE_ARTIFACTS.map((relativePath) => readFileSync(join(dir, relativePath)));
  try {
    for (const generator of PALETTE_GENERATORS) {
      execFileSync(process.execPath, [join(dir, generator)], { cwd: dir, stdio: 'pipe' });
    }
  } catch (error) {
    PALETTE_ARTIFACTS.forEach((relativePath, index) => writeFileSync(join(dir, relativePath), before[index]));
    throw new Error(`${error.stderr?.toString().trim() || error.message}`);
  }
  const stale = PALETTE_ARTIFACTS.filter(
    (relativePath, index) => !readFileSync(join(dir, relativePath)).equals(before[index]),
  );
  if (stale.length > 0) {
    PALETTE_ARTIFACTS.forEach((relativePath, index) => writeFileSync(join(dir, relativePath), before[index]));
  }
  return stale;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let stale;
  try {
    stale = checkPaletteFreshness();
  } catch (error) {
    console.error(`palette generators could not run:\n${error.message}`);
    process.exitCode = 1;
    stale = null;
  }
  if (stale?.length) {
    console.error(
      `generated palette artifacts are stale (hand-edited?):\n${stale.map((path) => `  ${path}`).join('\n')}\n` +
        `Regenerate and commit them:\n${PALETTE_GENERATORS.map((generator) => `  node ${generator}`).join('\n')}`,
    );
    process.exitCode = 1;
  } else if (stale) {
    console.log(
      `palette freshness verified: ${PALETTE_ARTIFACTS.length} generated artifacts round-trip byte-identically ` +
        `through ${PALETTE_GENERATORS.length} generators`,
    );
  }
}
