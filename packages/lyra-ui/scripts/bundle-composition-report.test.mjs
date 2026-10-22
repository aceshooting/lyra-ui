import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeMetafile, describeModule, kibibytes, renderMarkdown, sharedFloor } from './bundle-composition-report.mjs';

test('names the group a module belongs to and tidies package-manager paths', () => {
  assert.deepEqual(describeModule('dist/internal/lyra-element.js'), { path: 'dist/internal/lyra-element.js', group: 'internal' });
  assert.deepEqual(describeModule('dist/components/forms/button/button.class.js'), {
    path: 'dist/components/forms/button/button.class.js', group: 'components/forms',
  });
  assert.deepEqual(describeModule('dist/theme/theme.js').group, 'theme');
  assert.deepEqual(describeModule('dist/lyra.js').group, 'root');
  assert.deepEqual(describeModule('../../node_modules/.pnpm/lit-html@3.3.3/node_modules/lit-html/lit-html.js'), {
    path: 'node_modules/lit-html/lit-html.js', group: 'npm:lit-html',
  });
  assert.equal(describeModule('../../node_modules/.pnpm/@lit+reactive-element@2.1.2/node_modules/@lit/reactive-element/reactive-element.js').group, 'npm:@lit/reactive-element');
});

const metafile = (inputs) => ({
  inputs: Object.fromEntries(Object.keys(inputs).map((path) => [path, { bytes: 1 }])),
  outputs: { 'out.js': { inputs: Object.fromEntries(Object.entries(inputs).map(([path, bytesInOutput]) => [path, { bytesInOutput }])) } },
});

test('attributes the bundle to its modules and groups, largest first, ignoring empty modules', () => {
  const analysis = analyzeMetafile(metafile({
    'dist/internal/a.js': 3000,
    'dist/components/forms/button/button.class.js': 9000,
    '../../node_modules/.pnpm/lit-html@3.3.3/node_modules/lit-html/lit-html.js': 7000,
    'dist/internal/b.js': 2000,
    'dist/internal/empty.js': 0,
  }), { entry: 'dist/components/lr-button.js', minifiedBytes: 21000, gzipBytes: 6000 });
  assert.deepEqual(analysis.modules.map((module) => module.path), [
    'dist/components/forms/button/button.class.js', 'node_modules/lit-html/lit-html.js', 'dist/internal/a.js', 'dist/internal/b.js',
  ]);
  assert.deepEqual(analysis.groups, [
    { group: 'components/forms', bytes: 9000 }, { group: 'npm:lit-html', bytes: 7000 }, { group: 'internal', bytes: 5000 },
  ]);
  assert.equal(analysis.inputs, 5);
});

test('finds the modules nearly every entry bundles', () => {
  const entry = (name, inputs) => analyzeMetafile(metafile(inputs), { entry: name, minifiedBytes: 1, gzipBytes: 1 });
  const analyses = [
    entry('dist/components/lr-a.js', { 'dist/internal/shared.js': 5000, 'dist/internal/rare.js': 100, 'dist/a.js': 10 }),
    entry('dist/components/lr-b.js', { 'dist/internal/shared.js': 5200, 'dist/b.js': 10 }),
    entry('dist/components/lr-c.js', { 'dist/internal/shared.js': 5100, 'dist/internal/rare.js': 100, 'dist/c.js': 10 }),
  ];
  assert.deepEqual(sharedFloor(analyses, 1).map(({ path, entries, bytes }) => [path, entries, bytes]), [['dist/internal/shared.js', 3, 5200]]);
  assert.deepEqual(sharedFloor(analyses, 0.6).map((module) => module.path), ['dist/internal/shared.js', 'dist/internal/rare.js']);
});

test('renders the table with budgets where the repo has one, and escapes cell separators', () => {
  const analyses = [analyzeMetafile(metafile({ 'dist/internal/a|b.js': 4096 }), { entry: 'dist/lyra.js', minifiedBytes: 8192, gzipBytes: 2048 })];
  const markdown = renderMarkdown({ analyses, floor: [], budgets: { 'dist/lyra.js': 141.875 } });
  assert.match(markdown, /\| `dist\/lyra\.js` \| 8 \| 2 \| 141\.875 \| 1 \| a\\\|b\.js \(4\) \|/u);
  assert.match(markdown, /No component entries were analysed\./u);
  assert.equal(kibibytes(1536), 1.5);
});
