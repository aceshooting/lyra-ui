import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const preview = readFileSync(join(root, '.storybook/preview.js'), 'utf8');

for (const required of [
  "globalTypes: {",
  "theme: {",
  "{ value: 'light', title: 'Light' }",
  "{ value: 'dark', title: 'Dark' }",
  "{ value: 'high-contrast', title: 'High contrast' }",
  'decorators: [withLyraTheme]',
  'colorScheme',
  "'--lyra-theme-color-surface-default'",
  "'--lyra-theme-color-text-normal'",
  "'--lyra-theme-color-surface-border'",
]) {
  if (!preview.includes(required)) {
    throw new Error(`Storybook theme configuration is missing ${required}`);
  }
}

if (preview.includes('backgrounds:')) {
  throw new Error('Storybook must use the semantic theme toolbar instead of a canvas-only background switch');
}

function storyFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...storyFiles(path));
    else if (entry.name.endsWith('.stories.ts')) files.push(path);
  }
  return files;
}

const rawColor = /#[0-9a-f]{3,8}\b|rgba?\(/gi;
const ignoredDemoIds = new Set(['#950', '#1999']);
const stories = storyFiles(join(root, 'packages/lyra-ui/src/components'));
for (const path of stories) {
  const source = readFileSync(path, 'utf8');
  const matches = [...source.matchAll(rawColor)].map((match) => match[0]);
  const colors = matches.filter((match) => !ignoredDemoIds.has(match));
  if (colors.length) {
    throw new Error(`${path} contains raw story colors: ${colors.join(', ')}`);
  }
}

console.log(`Storybook theme configuration is valid; checked ${stories.length} story files.`);
