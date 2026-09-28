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

test('serves cacheable bundles with their byte length before Chromium starts caching them', async (t) => {
  const { createServer } = await import('node:http');
  const { mkdtemp, mkdir, writeFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { serve } = await import('./check-storybook.mjs');
  const directory = await mkdtemp(join(tmpdir(), 'lyra-storybook-response-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'assets'));
  const body = 'globalThis.componentLabel = "é";';
  await writeFile(join(directory, 'assets', 'components.js'), body);
  const server = createServer((request, response) => serve(request, response, directory));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/assets/components.js`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-length'), String(Buffer.byteLength(body)));
  assert.equal(response.headers.get('transfer-encoding'), null);
  assert.equal(response.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(await response.text(), body);
});

test('keeps failed bundle diagnostics when the docs wrapper never mounts', async (t) => {
  const { createServer } = await import('node:http');
  const { chromium } = await import('playwright');
  const { auditComponentDocs } = await import('./check-storybook.mjs');
  const server = createServer((request, response) => {
    if (request.url.startsWith('/iframe.html')) {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<script type="module" src="/missing-components.js"></script>');
    } else {
      response.writeHead(404).end('Missing bundle');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext();
  await assert.rejects(
    auditComponentDocs(context, `http://127.0.0.1:${server.address().port}`, [
      { entry: { id: 'broken--docs' }, expectedTag: 'lr-example' },
    ]),
    (error) => {
      assert.match(error.message, /docs iframe did not mount/);
      assert.match(error.message, /missing-components\.js/);
      assert.match(error.message, /404/);
      return true;
    },
  );
});
