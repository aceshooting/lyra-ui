// Freshness gate for every generated colour artifact. The base semantic palette is generated end
// to end; specialist fallbacks and Chart's JS fallback/options carry generated marker blocks.
// theme.css belongs to the style model and is checked without rewriting it. A hand edit
// to a generated block could survive indefinitely -- and, because the generators enforce contrast
// and CVD-separation floors, that is a silent accessibility regression.
// Deliberately a content round-trip rather than `git diff --exit-code`: comparing against the
// working tree catches a hand edit that was already committed, and it cannot fail spuriously
// because of unrelated uncommitted work in the same files. Generators run on an isolated snapshot,
// so concurrent source readers never see truncated or temporarily regenerated artifacts.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isMainModule } from './is-main-module.mjs';
import { readStyleModel } from './style-axes-model.mjs';
import { renderThemeCss } from './theme-document-layer.mjs';

const packageDir = fileURLToPath(new URL('..', import.meta.url));

export const PALETTE_GENERATORS = Object.freeze([
  'scripts/generate-palette.mjs',
  'scripts/generate-chart-palette.mjs',
  'scripts/generate-terminal-palette.mjs',
]);

export const PALETTE_ARTIFACTS = Object.freeze([
  'src/internal/tokens/palette.styles.ts',
  'src/theme.css',
  'src/internal/specialist-tokens.styles.ts',
  'src/components/charts/chart/chart-colors.ts',
  'src/theme/options/charts.ts',
]);

const PALETTE_SUPPORT = [
  'scripts/palette-canonical.mjs',
  'scripts/style-axes-model.mjs',
  'scripts/theme-token-grammar.mjs',
  'scripts/fixtures/theme-token-grammar.json',
];

export function checkPaletteFreshness(dir = packageDir) {
  const before = PALETTE_ARTIFACTS.map((relativePath) => readFileSync(join(dir, relativePath)));
  const scratch = mkdtempSync(join(tmpdir(), 'lyra-palette-freshness-'));
  try {
    for (const input of ['tokens', 'src/theme/gemstones-data.ts', ...PALETTE_GENERATORS,
      ...PALETTE_SUPPORT.filter(relativePath => existsSync(join(dir, relativePath)))]) {
      const destination = join(scratch, input);
      mkdirSync(dirname(destination), { recursive: true });
      cpSync(join(dir, input), destination, { recursive: true, dereference: true });
    }
    PALETTE_ARTIFACTS.forEach((relativePath, index) => {
      const destination = join(scratch, relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, before[index]);
    });
    for (const generator of PALETTE_GENERATORS) {
      execFileSync(process.execPath, [join(scratch, generator)], { cwd: scratch, stdio: 'pipe' });
    }
    const expectedTheme = Buffer.from(renderThemeCss(readStyleModel(scratch)));
    return PALETTE_ARTIFACTS.filter((relativePath, index) => {
      const actual = readFileSync(join(scratch, relativePath));
      return !actual.equals(before[index]) || (relativePath === 'src/theme.css' && !actual.equals(expectedTheme));
    });
  } catch (error) {
    throw new Error(`${error.stderr?.toString().trim() || error.message}`);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (isMainModule(import.meta.url)) {
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
        `Regenerate and commit them:\n${PALETTE_GENERATORS.map((generator) => `  node ${generator}`).join('\n')}\n  pnpm run style-axes`,
    );
    process.exitCode = 1;
  } else if (stale) {
    console.log(
      `palette freshness verified: ${PALETTE_ARTIFACTS.length} generated artifacts round-trip byte-identically ` +
        `through ${PALETTE_GENERATORS.length} generators`,
    );
  }
}
