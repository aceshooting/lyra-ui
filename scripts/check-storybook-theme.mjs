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
assert.equal(LYRA_THEME_TOKENS.dark['--lr-theme-color-surface-raised'], '#161b22');
assert.equal(LYRA_THEME_TOKENS.light['--lr-theme-color-surface-default'], '#ffffff');
assert.equal(LYRA_THEME_TOKENS.light['--lr-theme-color-surface-raised'], '#f6f8fa');
assert.equal(LYRA_THEME_TOKENS['high-contrast']['--lr-theme-color-surface-raised'], 'Canvas');

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
assert.equal(appliedTokens['--lr-theme-color-surface-raised'], '#161b22');

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
// `&#10003;` (a check mark) is a numeric character reference, not a colour -- but `#10003` matches
// the hex-colour shape exactly, so the scan has to drop the references before it looks for colours.
// Left in, they land in the same bucket as a hand-picked hex and the only escape is to keep
// extending `ignoredDemoIds`, which would erode the rule this check exists to enforce.
const numericCharacterReference = /&#x?[0-9a-f]+;/gi;

function rawStoryColors(source) {
  const scannable = source.replace(numericCharacterReference, '');
  return [...scannable.matchAll(rawColor)].map((match) => match[0]).filter((match) => !ignoredDemoIds.has(match));
}

assert.deepEqual(rawStoryColors('<span aria-hidden="true">&#10003;</span>'), []);
assert.deepEqual(rawStoryColors('&#9888; &#8230; &#x2713;'), []);
assert.deepEqual(rawStoryColors('color: #3366ff'), ['#3366ff']);
assert.deepEqual(rawStoryColors('background: rgba(0, 0, 0, 0.5)'), ['rgba(']);
assert.deepEqual(rawStoryColors('PR #950 and #1999'), []);
// A reference and a real colour in the same file: dropping references must not swallow the colour.
assert.deepEqual(rawStoryColors('&#10003; then color: #abc'), ['#abc']);

const stories = storyFiles(join(root, 'packages/lyra-ui/src/components'));
// Every offender at once. Throwing on the first file hid the rest behind an edit-and-rerun loop,
// which is how a single CI run can only ever reveal one of them.
const offenders = stories
  .map((path) => ({ path, colors: rawStoryColors(readFileSync(path, 'utf8')) }))
  .filter((entry) => entry.colors.length);
if (offenders.length) {
  throw new Error(
    `raw story colors (use a design token, or the shipped palette data, instead):\n${offenders
      .map((entry) => `  ${entry.path}: ${entry.colors.join(', ')}`)
      .join('\n')}`,
  );
}

console.log(`Storybook theme configuration is valid; checked ${stories.length} story files.`);
