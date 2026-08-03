import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Build-time source for the "how do I import this?" line every component Docs page shows.
 *
 * The mapping is *read*, never reconstructed. `packages/lyra-ui/llms/components/<tag>.md` opens
 * with a `- **Import** \`import '…';\`` line, and
 * `packages/lyra-ui/scripts/check-llms-artifacts.mjs` already resolves every one of those
 * specifiers against a real source module on every lint run. Deriving the docs-site line from the
 * same text means a path can never be right in one place and stale in the other, and 283
 * hand-written import lines never exist to go stale in the first place.
 *
 * Guessing the path from the manifest instead (strip `.class`, prefix the family) would
 * reintroduce exactly the class of bug that gate exists to catch, so it is deliberately not done.
 */

/** Import specifier the preview bundle uses -- see `.storybook/docs-page.js`. */
const COMPONENT_IMPORTS_MODULE_ID = 'virtual:lyra-component-imports';

const RESOLVED_MODULE_ID = `\0${COMPONENT_IMPORTS_MODULE_ID}`;

const REFERENCE_DIR = fileURLToPath(
  new URL('../packages/lyra-ui/llms/components/', import.meta.url),
);

/**
 * The reference files are generated, so the leading `- **Import**` bullet is byte-stable. Anchored
 * to the line start and to the `@aceshooting/lyra-ui/components/` prefix so a prose mention of some
 * other specifier further down the same file can never be picked up instead.
 */
const IMPORT_LINE = /^- \*\*Import\*\* `import '(@aceshooting\/lyra-ui\/components\/[^']+)';`/m;

/** Pull the registration entry point out of one `llms/components/<tag>.md` file's text. */
function componentImportSpecifier(reference) {
  return reference.match(IMPORT_LINE)?.[1];
}

/** Build the `{ 'lr-tag': '@aceshooting/lyra-ui/components/lr-tag.js' }` map. */
function readComponentImports(directory = REFERENCE_DIR) {
  const imports = {};
  for (const file of readdirSync(directory).sort()) {
    if (!file.endsWith('.md')) continue;
    const specifier = componentImportSpecifier(readFileSync(join(directory, file), 'utf8'));
    if (specifier) imports[file.slice(0, -'.md'.length)] = specifier;
  }
  return imports;
}

/**
 * Serves the map to the preview bundle. A virtual module rather than an eager
 * `import.meta.glob(..., '?raw')` over the same files: those 283 reference files are ~1.6 MB of
 * markdown, and only one line of each is wanted, so parsing them here keeps the docs bundle to the
 * ~20 KB the map itself weighs.
 */
export function componentImportsPlugin({ directory = REFERENCE_DIR } = {}) {
  return {
    name: 'lyra-component-imports',
    resolveId(id) {
      return id === COMPONENT_IMPORTS_MODULE_ID ? RESOLVED_MODULE_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_MODULE_ID) return undefined;
      const imports = readComponentImports(directory);
      if (Object.keys(imports).length === 0) {
        // Failing loudly beats shipping every component page silently missing its import line.
        this.error(
          `No import paths found in ${directory}; run \`pnpm --filter @aceshooting/lyra-ui run llms\`.`,
        );
      }
      return `export default ${JSON.stringify(imports, undefined, 2)};\n`;
    },
  };
}
