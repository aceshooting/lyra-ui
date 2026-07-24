import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('..', import.meta.url));
const preview = readFileSync(join(root, '.storybook/preview.js'), 'utf8');
const manager = readFileSync(join(root, '.storybook/manager.js'), 'utf8');
const main = readFileSync(join(root, '.storybook/main.js'), 'utf8');
const landing = readFileSync(join(root, '.storybook/landing.css'), 'utf8');

const [
  { applyLyraTheme, LYRA_STORYBOOK_THEMES, LYRA_THEME_TOKENS, normalizeStoryThemeName },
  { publicStorybookManifest },
  { FAMILY_LABELS, createGroupedStoryIndexer, groupedStoryTitle },
  { transformStoryTitle },
] = await Promise.all([
  import('../.storybook/story-theme.js'),
  import('../.storybook/storybook-manifest.js'),
  import('../.storybook/story-indexer.js'),
  import('../.storybook/story-title-plugin.js'),
]);

for (const required of [
  "globalTypes: {",
  "theme: {",
  "initialGlobals: {",
  "theme: 'dark'",
  "title: 'Theme'",
  'dynamicTitle: true',
  "{ value: 'light', title: 'Light' }",
  "{ value: 'dark', title: 'Dark' }",
  "{ value: 'high-contrast', title: 'High contrast' }",
  'decorators: [withLyraTheme]',
  'container: LyraDocsContainer',
]) {
  if (!preview.includes(required)) {
    throw new Error(`Storybook theme configuration is missing ${required}`);
  }
}

if (preview.includes('backgrounds:')) {
  throw new Error('Storybook must use the semantic theme toolbar instead of a canvas-only background switch');
}

for (const required of [
  "addons.register('lyra-theme-sync'",
  'api.setOptions({ theme:',
]) {
  if (!manager.includes(required)) {
    throw new Error(`Storybook manager theme synchronization is missing ${required}`);
  }
}

if (!main.includes('createGroupedStoryIndexer')) {
  throw new Error('Storybook must group story index entries by source family');
}

for (const selector of [
  ":root[data-lyra-theme='light']",
  ":root[data-lyra-theme='high-contrast']",
]) {
  if (!landing.includes(selector)) {
    throw new Error(`Storybook landing page is missing ${selector}`);
  }
}

assert.equal(normalizeStoryThemeName('light'), 'light');
assert.equal(normalizeStoryThemeName('dark'), 'dark');
assert.equal(normalizeStoryThemeName('high-contrast'), 'high-contrast');
assert.equal(normalizeStoryThemeName('unknown'), 'dark');
assert.equal(LYRA_STORYBOOK_THEMES.dark.base, 'dark');
assert.equal(LYRA_STORYBOOK_THEMES.light.base, 'light');
assert.equal(LYRA_STORYBOOK_THEMES['high-contrast'].base, 'light');
assert.equal(LYRA_THEME_TOKENS.dark['--lr-theme-color-surface-default'], '#0d1117');
assert.equal(LYRA_THEME_TOKENS.light['--lr-theme-color-surface-default'], '#ffffff');

const appliedTokens = {};
const themedDocument = {
  documentElement: {
    dataset: {},
    style: {
      setProperty(property, value) {
        appliedTokens[property] = value;
      },
    },
  },
  body: { dataset: {}, style: {} },
};
applyLyraTheme('dark', themedDocument);
assert.equal(themedDocument.documentElement.dataset.lyraTheme, 'dark');
assert.equal(themedDocument.documentElement.style.colorScheme, 'dark');
assert.equal(themedDocument.body.dataset.lyraTheme, 'dark');
assert.equal(appliedTokens['--lr-theme-color-surface-default'], '#0d1117');

const sampleManifest = {
  modules: [{
    declarations: [{
      members: [
        { name: 'value', privacy: 'public' },
        { name: '_value', privacy: 'private' },
        { name: 'effectiveLocale', privacy: 'protected' },
        { name: 'labels' },
      ],
    }],
  }],
};
const filteredManifest = publicStorybookManifest(sampleManifest);
assert.deepEqual(
  filteredManifest.modules[0].declarations[0].members.map(({ name }) => name),
  ['value', 'labels'],
);
assert.equal(sampleManifest.modules[0].declarations[0].members.length, 4);

assert.equal(
  groupedStoryTitle('/repo/src/components/forms/checkbox/checkbox.stories.ts', 'Checkbox'),
  'Forms/Checkbox',
);
assert.equal(
  groupedStoryTitle('/repo/src/components/charts/chart/bar-chart.stories.ts', 'Charts/Bar'),
  'Charts/Bar',
);
assert.equal(
  groupedStoryTitle('/repo/.storybook/Introduction.mdx', 'Introduction'),
  'Introduction',
);
assert.equal(Object.keys(FAMILY_LABELS).length, 11);

const groupedIndexer = createGroupedStoryIndexer({
  test: /\.stories\.ts$/,
  async createIndex() {
    return [{ type: 'story', exportName: 'Default', title: 'Checkbox' }];
  },
});
const [groupedInput] = await groupedIndexer.createIndex(
  '/repo/src/components/forms/checkbox/checkbox.stories.ts',
  { makeTitle: (title) => title },
);
assert.equal(groupedInput.title, 'Forms/Checkbox');
assert.equal(groupedInput.metaId, 'checkbox');

const transformedStory = transformStoryTitle(
  "const meta = {\n  title: 'Checkbox',\n  component: 'lr-checkbox',\n};",
  '/repo/src/components/forms/checkbox/checkbox.stories.ts',
);
assert.match(transformedStory, /title: 'Forms\/Checkbox',\n  id: 'checkbox',/);
assert.equal(
  transformStoryTitle(
    "const meta = {\n  title: 'Charts/LiteChart',\n};",
    '/repo/src/components/charts/chart/lite-chart.stories.ts',
  ),
  "const meta = {\n  title: 'Charts/LiteChart',\n};",
);

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
