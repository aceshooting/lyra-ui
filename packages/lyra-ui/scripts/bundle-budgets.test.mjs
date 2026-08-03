import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const budgets = JSON.parse(readFileSync(path.join(scriptsDir, 'bundle-budgets.json'), 'utf8'));
const checker = readFileSync(path.join(scriptsDir, 'check-bundle-size.mjs'), 'utf8');

assert.equal(budgets['dist/components/forms/button/button.js'], 30);
assert.equal(budgets['dist/autoloader.js'], 980);
assert.equal(budgets['dist/autoloader-cdn.js'], 981);
assert.equal(budgets['dist/ssr-loader.js'], 960);
assert.equal(budgets['dist/ssr/all.js'], 985);
assert.ok(
  budgets['dist/autoloader.js'] >= budgets['dist/all.js'],
  'the autoloader bundles the complete compatibility registration graph',
);
assert.ok(
  budgets['dist/autoloader-cdn.js'] > budgets['dist/autoloader.js'],
  'the CDN startup wrapper is a strict superset of the manual autoloader',
);
assert.ok(
  budgets['dist/ssr-loader.js'] >= budgets['dist/all.js'] + budgets['dist/hydration.js'],
  'the compatibility SSR loader bundles all registrations plus hydration support',
);
assert.ok(
  budgets['dist/ssr/all.js'] >= budgets['dist/all.js'],
  'the complete SSR inventory is a superset of the browser compatibility inventory',
);
assert.ok(budgets.$componentP95GzipKb <= 100);
assert.ok(budgets.$componentMaxGzipKb <= 200);
for (const entry of [
  'dist/hydration.js',
  'dist/ssr.js',
  'dist/ssr/all.js',
  'dist/ssr-loader.js',
  'dist/autoloader.js',
  'dist/autoloader-cdn.js',
  ...[
    'agent-tools', 'charts', 'conversation', 'data', 'forms', 'layout',
    'media', 'overlays', 'retrieval', 'utility', 'viewers',
  ].map((family) => `dist/components/${family}/index.js`),
]) {
  assert.ok(Number.isFinite(budgets[entry]), `${entry} needs a hard gzip budget`);
}
assert.doesNotMatch(checker, /--write-budgets/, 'the release checker must not offer a rebaseline switch');
assert.match(checker, /Unknown argument/, 'unknown bundle-checker arguments must fail closed');

console.log('hard bundle budget coverage tests passed.');
