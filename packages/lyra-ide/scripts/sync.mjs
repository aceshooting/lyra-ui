// Copies the editor data lyra-ui generates (`pnpm generate-editor-data`, `pnpm manifest`) into this
// package so the published tarball carries exactly what the same commit's lyra-ui build produced.
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
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

export function syncIdeData({ from = uiDir, to = packageDir } = {}) {
  const version = JSON.parse(readFileSync(join(to, 'package.json'), 'utf8')).version;
  for (const file of IDE_DATA_FILES) {
    if (!existsSync(join(from, file))) {
      throw new Error(`${join(from, file)} is missing; run \`pnpm manifest\` and \`pnpm --filter @aceshooting/lyra-ui generate-editor-data\`.`);
    }
  }
  const webTypes = JSON.parse(readFileSync(join(from, 'web-types.json'), 'utf8'));
  if (webTypes.version !== version) {
    throw new Error(`web-types.json describes lyra-ui ${webTypes.version}, but this package is ${version}; regenerate the editor data.`);
  }
  for (const file of IDE_DATA_FILES) copyFileSync(join(from, file), join(to, file));
  return IDE_DATA_FILES.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`Editor data copied from lyra-ui: ${syncIdeData()} files.`);
}
