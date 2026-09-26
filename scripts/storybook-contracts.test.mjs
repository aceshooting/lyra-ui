import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildStorybookDocsAuditPlan,
  findStoryOwnershipFailures,
  manifestTagNames,
  resolveStoryOwnerDocs,
  storyOwnerFromSource,
} from './storybook-contracts.mjs';
import { transformStoryTitle } from '../.storybook/story-title-plugin.js';
import { createGroupedStoryIndexer } from '../.storybook/story-indexer.js';

test('extracts the component owner only from the default Meta object', () => {
  const source = `
    const meta: Meta = {
      title: 'Forms/Checkbox',
      component: 'lr-checkbox',
      parameters: { docs: { description: { component: 'description' } } },
    };
    export default meta;
    export const Default = { render: () => html\`<lr-checkbox></lr-checkbox>\` };
  `;

  assert.deepEqual(storyOwnerFromSource(source, './checkbox.stories.ts'), {
    tag: 'lr-checkbox',
    importPath: './checkbox.stories.ts',
  });
});

test('reports a duplicate and a missing owner even when the totals are equal', () => {
  const failures = findStoryOwnershipFailures(
    ['lr-alpha', 'lr-beta'],
    [
      { tag: 'lr-alpha', importPath: './alpha-a.stories.ts' },
      { tag: 'lr-alpha', importPath: './alpha-b.stories.ts' },
    ]
  );

  assert.ok(failures.some((failure) => failure.includes('lr-beta') && failure.includes('missing')));
  assert.ok(
    failures.some((failure) => failure.includes('lr-alpha') && failure.includes('duplicate'))
  );
});

test('reads every declared custom-element tag from the manifest once', () => {
  assert.deepEqual(
    manifestTagNames({
      modules: [
        { declarations: [{ tagName: 'lr-beta' }, { kind: 'class' }] },
        { declarations: [{ tagName: 'lr-alpha' }, { tagName: 'lr-beta' }] },
      ],
    }),
    ['lr-alpha', 'lr-beta']
  );
});

test('resolves each owner to one exact Storybook docs import', () => {
  const owners = [{ tag: 'lr-alpha', importPath: './src/alpha.stories.ts' }];
  const entries = [
    { id: 'alpha--docs', type: 'docs', importPath: './src/alpha.stories.ts' },
    { id: 'guide--docs', type: 'docs', importPath: './src/guide.stories.ts' },
  ];

  assert.deepEqual(resolveStoryOwnerDocs(entries, owners), {
    docs: [{ entry: entries[0], expectedTag: 'lr-alpha' }],
    failures: [],
  });

  assert.match(
    resolveStoryOwnerDocs(entries, [{ tag: 'lr-alpha', importPath: './src/wrong.stories.ts' }])
      .failures[0],
    /exact docs import/i
  );
});

test('plans one docs navigation per owner while retaining every layout matrix', () => {
  const entries = [
    { entry: { id: 'alpha--docs' }, expectedTag: 'lr-alpha' },
    { entry: { id: 'beta--docs' }, expectedTag: 'lr-beta' },
  ];

  const plan = buildStorybookDocsAuditPlan(entries);

  assert.equal(plan.length, 2);
  assert.deepEqual(
    plan[0].matrices.map(({ name, width, direction }) => ({ name, width, direction })),
    [
      { name: 'desktop', width: 980, direction: 'ltr' },
      { name: 'narrow', width: 390, direction: 'ltr' },
      { name: 'narrow-rtl', width: 390, direction: 'rtl' },
    ]
  );
  assert.equal(
    plan.reduce((total, audit) => total + audit.matrices.length, 0),
    6
  );
});

test('groups inline and multiline story metadata while preserving the legacy meta id', async () => {
  const fileName = '/repo/src/components/viewers/notebook-viewer/notebook-viewer.stories.ts';
  const source = `export default { title: 'DocumentViewer/NotebookViewer', component: 'lr-notebook-viewer' };`;
  const multiline = `export default {\n  title: 'DocumentViewer/NotebookViewer',\n  component: 'lr-notebook-viewer',\n};`;
  const precededByData = `export const data = [{ title: 'Keep this title', value: 1 }];\nconst meta = { title: 'DocumentViewer/NotebookViewer', component: 'lr-notebook-viewer' };\nexport default meta;`;
  const expectedTitle = 'Viewers/DocumentViewer/NotebookViewer';
  const expectedId = 'documentviewer-notebookviewer';
  for (const fixture of [source, multiline, precededByData]) {
    const transformed = transformStoryTitle(fixture, fileName);
    const { default: metadata, data } = await import(`data:text/javascript,${encodeURIComponent(transformed)}`);
    assert.equal(metadata.title, expectedTitle);
    assert.equal(metadata.id, expectedId);
    if (data) assert.deepEqual(data, [{ title: 'Keep this title', value: 1 }]);
  }
  const [indexed] = await createGroupedStoryIndexer({
    test: /\.stories\.ts$/,
    async createIndex() {
      return [{ type: 'story', exportName: 'Default', title: 'DocumentViewer/NotebookViewer' }];
    },
  }).createIndex(fileName, { makeTitle: (title) => title });
  assert.equal(indexed.title, expectedTitle);
  assert.equal(indexed.metaId, expectedId);
});

test('guide pages link deployed files with a raw new-tab anchor, not a Markdown link', () => {
  // The docs addon renders every Markdown link through its own anchor. Unless the target is an
  // absolute http(s) URL or an in-page `#hash`, a left click is turned into manager navigation, so
  // a Markdown link to a deployed file such as `./llms/migration.md` never opens that file. Story
  // and guide links (`?path=...`) rely on exactly that navigation and stay Markdown links.
  const guidesDir = new URL('../.storybook/', import.meta.url);
  const intercepted = [];
  for (const name of readdirSync(guidesDir).filter((file) => file.endsWith('.mdx')).sort()) {
    const source = readFileSync(new URL(name, guidesDir), 'utf8');
    for (const [, target] of source.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(?:\?path=|#|https?:\/\/)/.test(target)) continue;
      intercepted.push(`${name}: ${target}`);
    }
  }
  assert.deepEqual(intercepted, []);
});
