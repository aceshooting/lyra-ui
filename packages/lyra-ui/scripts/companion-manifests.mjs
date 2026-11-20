// The companion packages that register their own `lr-*` custom elements, and the helpers every
// manifest consumer (editor data, llms pages, coverage checks) shares to read them next to
// lyra-ui's own `custom-elements.json`.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packagesDir = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

/**
 * `status` and `since` are the maturity the companion's own package declares for the tag (the
 * centralized lyra-ui metadata does not cover other packages). `family` places a companion tag in the `llms/<family>.md` that documents it; `importPath` is the
 * module a consumer imports to register it; `classImportPath` exports the class without registering it. `sourceRoot` is where its class module and stylesheet live.
 */
export const COMPANION_MANIFESTS = Object.freeze([
  Object.freeze({
    directory: 'lyra-docs',
    package: '@aceshooting/lyra-docs',
    tags: Object.freeze(['lr-docx-editor']),
    family: 'viewers',
    status: 'experimental',
    since: '0.1.0',
    importPath: '@aceshooting/lyra-docs/docx/editor',
    classImportPath: '@aceshooting/lyra-docs/docx/editor.class',
  }),
  Object.freeze({
    directory: 'lyra-gen',
    package: '@aceshooting/lyra-gen',
    tags: Object.freeze(['lr-gen-view']),
    family: 'agent-tools',
    status: 'experimental',
    since: '0.1.0',
    importPath: '@aceshooting/lyra-gen/gen-view.js',
    classImportPath: '@aceshooting/lyra-gen/gen-view.class.js',
  }),
]);

/** Companion for a tag, when the tag belongs to one. */
export function companionForTag(tag) {
  return COMPANION_MANIFESTS.find((companion) => companion.tags.includes(tag));
}

/** Parsed manifests of every companion, each with the package directory it was read from. */
export function readCompanionManifests(baseDir = packagesDir) {
  return COMPANION_MANIFESTS.map((companion) => {
    const root = path.join(baseDir, companion.directory);
    const file = path.join(root, 'custom-elements.json');
    if (!existsSync(file)) {
      throw new Error(`${file} is missing; run \`pnpm --filter @aceshooting/lyra-ui manifest:companions\`.`);
    }
    return { ...companion, root, manifest: JSON.parse(readFileSync(file, 'utf8')) };
  });
}

/**
 * One manifest holding lyra-ui's modules followed by each companion's, with a companion module's
 * path prefixed by its package directory (`lyra-docs/src/docx/...`) so no two modules collide.
 */
export function mergeManifests(base, companions) {
  return {
    ...base,
    modules: [
      ...(base.modules ?? []),
      ...companions.flatMap(({ directory, manifest }) =>
        (manifest.modules ?? []).map((module) => ({ ...module, path: `${directory}/${module.path}` }))),
    ],
  };
}
