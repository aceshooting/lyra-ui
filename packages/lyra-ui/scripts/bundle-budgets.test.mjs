import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const budgets = JSON.parse(
  readFileSync(path.join(scriptsDir, 'bundle-budgets.json'), 'utf8'),
);
const exclusions = JSON.parse(
  readFileSync(path.join(scriptsDir, 'bundle-exclusion-claims.json'), 'utf8'),
);
const checker = readFileSync(
  path.join(scriptsDir, 'check-bundle-size.mjs'),
  'utf8',
);

assert.equal(typeof budgets.$comment, 'string');
const reviewedCeilings = { ...budgets };
delete reviewedCeilings.$comment;
assert.deepEqual(reviewedCeilings, {
  $componentP95GzipKb: 116,
  $componentMaxGzipKb: 226,
  'dist/autoloader-cdn.js': 1250,
  'dist/autoloader.js': 1250,
  'dist/hydration.js': 7,
  'dist/ssr.js': 5,
  'dist/ssr/all.js': 1248,
  'dist/ssr-loader.js': 1253,
  'dist/localization.js': 19,
  'dist/lyra.js': 1217,
  'dist/all.js': 1248,
  'dist/components/agent-tools/index.js': 386,
  'dist/components/charts/index.js': 77,
  'dist/components/conversation/index.js': 362,
  'dist/components/data/index.js': 309,
  'dist/components/forms/index.js': 261,
  'dist/components/layout/index.js': 323,
  'dist/components/media/index.js': 199,
  'dist/components/overlays/index.js': 132,
  'dist/components/retrieval/index.js': 319,
  'dist/components/utility/index.js': 120,
  'dist/components/viewers/index.js': 237,
  'dist/components/forms/button/button.js': 44,
  'dist/components/forms/select/select.js': 67,
  'dist/components/data/gauge/gauge.js': 39,
  'dist/components/viewers/pdf-viewer/pdf-viewer.js': 71,
  'dist/components/data/flow-canvas/flow-canvas.js': 60,
});
assert.ok(
  budgets['dist/autoloader.js'] >= budgets['dist/all.js'],
  'the autoloader bundles the complete compatibility registration graph',
);
assert.ok(
  budgets['dist/autoloader-cdn.js'] >= budgets['dist/autoloader.js'],
  'the CDN startup wrapper includes the complete manual-autoloader graph',
);
assert.ok(
  budgets['dist/ssr-loader.js'] >=
    budgets['dist/all.js'] + budgets['dist/hydration.js'] - 2,
  'the compatibility SSR loader budget accounts for all registrations plus hydration support, allowing two KiB of independent ceiling rounding',
);
assert.ok(
  budgets['dist/ssr/all.js'] >= budgets['dist/all.js'],
  'the complete SSR inventory is a superset of the browser compatibility inventory',
);
for (const entry of [
  'dist/hydration.js',
  'dist/ssr.js',
  'dist/ssr/all.js',
  'dist/ssr-loader.js',
  'dist/autoloader.js',
  'dist/autoloader-cdn.js',
  ...[
    'agent-tools',
    'charts',
    'conversation',
    'data',
    'forms',
    'layout',
    'media',
    'overlays',
    'retrieval',
    'utility',
    'viewers',
  ].map((family) => `dist/components/${family}/index.js`),
]) {
  assert.ok(
    Number.isFinite(budgets[entry]),
    `${entry} needs a hard gzip budget`,
  );
}
assert.doesNotMatch(
  checker,
  /--write-budgets/,
  'the release checker must not offer a rebaseline switch',
);
assert.match(
  checker,
  /Unknown argument/,
  'unknown bundle-checker arguments must fail closed',
);
assert.match(
  checker,
  /bundle-exclusion-claims\.json/,
  'documented lean-entry exclusions need a peer-inclusive metafile gate',
);
assert.match(
  checker,
  /metafile:\s*true/,
  'bundle exclusion claims must inspect a real esbuild dependency graph',
);
const widgetRendererLean =
  exclusions['dist/components/conversation/widget-renderer/widget-renderer.class.js'];
assert.ok(
  widgetRendererLean,
  'the documented lean widget-renderer route needs an inventoried graph claim',
);
assert.ok(
  widgetRendererLean.forbiddenInputs.includes(
    'components/conversation/widget-renderer/default-registry.js',
  ),
  'the lean widget-renderer route must exclude the eager default registry',
);
assert.equal(
  widgetRendererLean.forbiddenInputs.length,
  9,
  'the lean route excludes the default registry plus all eight mapped class modules',
);

console.log('hard bundle budget coverage tests passed.');
