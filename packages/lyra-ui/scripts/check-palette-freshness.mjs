// Freshness gate for every generated colour artifact. The base semantic palette is generated end
// to end; specialist fallbacks and Chart's JS fallback/options carry generated marker blocks.
// theme.css belongs to the style model and is checked without rewriting it. A hand edit
// to a generated block could survive indefinitely -- and, because the generators enforce contrast
// and CVD-separation floors, that is a silent accessibility regression.
// Deliberately a content round-trip rather than `git diff --exit-code`: comparing against the
// working tree catches a hand edit that was already committed, and it cannot fail spuriously
// because of unrelated uncommitted work in the same files. The originals are restored on failure,
// so the check never mutates the tree it is auditing.
// The generators rewrite the artifacts in place, so two concurrent rounds over the same tree (the
// gate and its unit test run in different parallel lint shards) would read each other's partial
// writes. Each round therefore holds an exclusive per-tree lock.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
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

const LOCK_TIMEOUT_MS = 300_000;
const LOCK_POLL_MS = 50;

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function acquireTreeLock(dir) {
  const key = createHash('sha256').update(resolve(dir)).digest('hex').slice(0, 16);
  const lock = join(tmpdir(), `lyra-palette-freshness-${key}.lock`);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, 'pid'), String(process.pid));
      return () => rmSync(lock, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner = Number.NaN;
      try {
        owner = Number(readFileSync(join(lock, 'pid'), 'utf8'));
      } catch {
        // The owner has created the directory but not yet recorded its pid.
      }
      if (Number.isInteger(owner) && owner > 0 && !processAlive(owner)) {
        rmSync(lock, { recursive: true, force: true });
        continue;
      }
      if (Date.now() > deadline) throw new Error(`timed out waiting for the palette freshness lock ${lock}`);
      Atomics.wait(sleeper, 0, 0, LOCK_POLL_MS);
    }
  }
}

export function checkPaletteFreshness(dir = packageDir) {
  const release = acquireTreeLock(dir);
  try {
    return checkPaletteFreshnessLocked(dir);
  } finally {
    release();
  }
}

function checkPaletteFreshnessLocked(dir) {
  const before = PALETTE_ARTIFACTS.map((relativePath) => readFileSync(join(dir, relativePath)));
  try {
    for (const generator of PALETTE_GENERATORS) {
      execFileSync(process.execPath, [join(dir, generator)], { cwd: dir, stdio: 'pipe' });
    }
    const expectedTheme = Buffer.from(renderThemeCss(readStyleModel(dir)));
    return PALETTE_ARTIFACTS.filter((relativePath, index) => {
      const actual = readFileSync(join(dir, relativePath));
      return !actual.equals(before[index]) || (relativePath === 'src/theme.css' && !actual.equals(expectedTheme));
    });
  } catch (error) {
    throw new Error(`${error.stderr?.toString().trim() || error.message}`);
  } finally {
    PALETTE_ARTIFACTS.forEach((relativePath, index) => {
      const file = join(dir, relativePath);
      if (!existsSync(file) || !readFileSync(file).equals(before[index])) writeFileSync(file, before[index]);
    });
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
