// Copies the editor data lyra-ui generates (`pnpm generate-editor-data`, `pnpm manifest`) into this
// package so the published tarball carries exactly what the same commit's lyra-ui build produced.
import { copyFileSync, existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const IDE_DATA_FILES = Object.freeze([
  'custom-elements.json',
  'web-types.json',
  'vscode-html-data.json',
  'vscode-css-data.json',
]);

const packageDir = dirname(dirname(fileURLToPath(import.meta.url)));
const uiDir = join(packageDir, '..', 'lyra-ui');

/** Companion packages whose elements are listed in the published manifest next to lyra-ui's. */
export const IDE_COMPANION_PACKAGES = Object.freeze(['lyra-docs', 'lyra-gen']);

/** Attribute descriptions at least this long that repeat their backing field's text are shipped once. */
const MIN_SHARED_DESCRIPTION = 40;

/**
 * An attribute entry names its backing property in `fieldName`, and the property's member already
 * carries the same long description; keeping both doubles the largest part of the manifest. The
 * attribute's description is dropped only when it is byte-identical to that member's, so a reader
 * resolves it through `fieldName` and nothing is lost.
 */
export function omitSharedAttributeDescriptions(manifest) {
  for (const module of manifest.modules ?? []) {
    for (const declaration of module.declarations ?? []) {
      const members = new Map((declaration.members ?? []).map((member) => [member.name, member]));
      for (const attribute of declaration.attributes ?? []) {
        const text = attribute.description;
        if (typeof text === 'string' && text.length >= MIN_SHARED_DESCRIPTION && members.get(attribute.fieldName)?.description === text) {
          delete attribute.description;
        }
      }
    }
  }
  return manifest;
}

export function syncIdeData({ from = uiDir, to = packageDir } = {}) {
  const version = JSON.parse(readFileSync(join(to, 'package.json'), 'utf8')).version;
  for (const file of IDE_DATA_FILES) {
    if (!existsSync(join(from, file))) {
      throw new Error(`${join(from, file)} is missing; run \`pnpm manifest\` and \`pnpm --filter @aceshooting/lyra-ui generate-editor-data\`.`);
    }
  }
  const companionFiles = IDE_COMPANION_PACKAGES.map((name) => join(from, '..', name, 'custom-elements.json'));
  for (const file of companionFiles) {
    if (!existsSync(file)) {
      throw new Error(`${file} is missing; run \`pnpm --filter @aceshooting/lyra-ui manifest:companions\`.`);
    }
  }
  const webTypes = JSON.parse(readFileSync(join(from, 'web-types.json'), 'utf8'));
  if (webTypes.version !== version) {
    throw new Error(`web-types.json describes lyra-ui ${webTypes.version}, but this package is ${version}; regenerate the editor data.`);
  }
  for (const file of IDE_DATA_FILES) copyFileSync(join(from, file), join(to, file));
  // The published manifest also lists the companion elements; their module paths carry the package
  // directory so no two modules collide.
  const merged = JSON.parse(readFileSync(join(from, 'custom-elements.json'), 'utf8'));
  IDE_COMPANION_PACKAGES.forEach((name, index) => {
    const companion = JSON.parse(readFileSync(companionFiles[index], 'utf8'));
    for (const module of companion.modules ?? []) merged.modules.push({ ...module, path: `${name}/${module.path}` });
  });
  writeFileSync(join(to, 'custom-elements.json'), `${JSON.stringify(omitSharedAttributeDescriptions(merged))}\n`);
  return IDE_DATA_FILES.length;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  console.log(`Editor data copied from lyra-ui: ${syncIdeData()} files.`);
}
