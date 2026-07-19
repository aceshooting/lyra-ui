import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Cross-checks the root README's tag-count/version prose against the ground truth
// (custom-elements.json and packages/lyra-ui/package.json), so the drift this
// script exists to catch -- a stale count or version left behind after a release --
// fails CI instead of silently sitting in the README until the next audit.

const root = fileURLToPath(new URL('..', import.meta.url));
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const pkgReadmePath = join(root, 'packages/lyra-ui/README.md');
const pkgReadme = readFileSync(pkgReadmePath, 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'packages/lyra-ui/custom-elements.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(root, 'packages/lyra-ui/package.json'), 'utf8'));

const manifestTags = new Set(
  (manifest.modules ?? [])
    .flatMap((mod) => mod.declarations ?? [])
    .map((decl) => decl.tagName)
    .filter(Boolean),
);
const tagCount = manifestTags.size;

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

const errors = [];

const catalogMatch = readme.match(/(\d+) custom elements across (\w+) component families/);
if (!catalogMatch) {
  errors.push('README.md: could not find the "<N> custom elements across <M> component families" line to check');
} else {
  if (Number(catalogMatch[1]) !== tagCount) {
    errors.push(
      `README.md claims ${catalogMatch[1]} custom elements, but custom-elements.json currently has ${tagCount} — update the "## Components" section`,
    );
  }
  const familyTableMatch = readme.match(/\| Family \| Highlights \|\n\|---\|---\|\n((?:\|.+\|\n?)+)/);
  const familyRowCount = familyTableMatch ? familyTableMatch[1].trim().split('\n').length : 0;
  if (!familyTableMatch) {
    errors.push('README.md: could not find the "| Family | Highlights |" table under "## Components" to check');
  }
  const claimedFamilyCount = NUMBER_WORDS.indexOf(catalogMatch[2].toLowerCase());
  if (claimedFamilyCount === -1) {
    errors.push(`README.md: "${catalogMatch[2]} component families" is not a recognized number word — update check-readme-freshness.mjs's NUMBER_WORDS list or fix the README`);
  } else if (claimedFamilyCount !== familyRowCount) {
    errors.push(
      `README.md claims ${catalogMatch[2]} component families, but the "## Components" family table has ${familyRowCount} rows — update one to match the other`,
    );
  }
}

const versionMatch = readme.match(/`@aceshooting\/lyra-ui` is published at `([^`]+)`/);
if (!versionMatch) {
  errors.push('README.md: could not find the "`@aceshooting/lyra-ui` is published at `X.Y.Z`" line to check');
} else if (versionMatch[1] !== pkg.version) {
  errors.push(`README.md claims lyra-ui is published at ${versionMatch[1]}, but package.json says ${pkg.version} — update the "## Status" section`);
}

// Per-tag catalog coverage: packages/lyra-ui/README.md is the one README with an actual per-tag
// table (the root README is a family-level summary by design, already checked above via its
// aggregate count + family-table row count, not a per-tag catalog). A tag present in the manifest
// but never mentioned here is a real, silent documentation gap -- catch it precisely, by tag,
// rather than only via an aggregate count that a combined multi-tag row (e.g. `<lr-combobox>` +
// `<lr-option>` sharing one row) could keep matching by coincidence even if a *different* tag
// silently dropped out.
const mentionedTags = new Set(
  [...pkgReadme.matchAll(/`<(lr-[a-z0-9-]+)>`/g)].map((m) => m[1]),
);
const missingFromPkgReadme = [...manifestTags].filter((t) => !mentionedTags.has(t)).sort();
if (missingFromPkgReadme.length) {
  errors.push(
    `packages/lyra-ui/README.md: ${missingFromPkgReadme.length} manifest tag(s) have no \`<tag>\` mention anywhere in the component tables: ${missingFromPkgReadme.join(', ')}`,
  );
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`README freshness check passed (${tagCount} tags, v${pkg.version}, per-tag coverage in packages/lyra-ui/README.md verified).`);
}
