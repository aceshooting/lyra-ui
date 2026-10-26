import assert from 'node:assert/strict';
import test from 'node:test';
import { findGenArtifactFindings } from './check-build-artifacts.mjs';

const manifest = { sideEffects: ['./dist/gen-view.js', './dist/dashboard-binding.js'] };
const fixture = () => ({
  'dist/index.js': "export * from './runtime.js';",
  'dist/index.d.ts': '', 'dist/runtime.js': 'export const value = 1;', 'dist/runtime.d.ts': '',
  'dist/gen-view.js': "import '@aceshooting/lyra-ui/utilities/prefix.js';", 'dist/gen-view.d.ts': '',
  'dist/dashboard-binding.js': "import './gen-view.js';", 'dist/dashboard-binding.d.ts': '',
});
const check = (files, metadata = manifest) => findGenArtifactFindings(Object.keys(files), file => files[file], metadata);
test('pure roots may declare lazy catalog loaders without eagerly registering components', () => {
  const files = fixture();
  files['dist/runtime.js'] += "\nexport const load = () => import('@aceshooting/lyra-ui/components/lr-button.js');";
  assert.deepEqual(check(files), []);
});
test('root registration reachability, hidden private imports and incomplete emissions fail', () => {
  for (const mutate of [
    files => { files['dist/runtime.js'] = "export * from './gen-view.js';"; },
    files => { files['dist/runtime.js'] = "import '@aceshooting/lyra-ui/components/lr-button.js';"; },
    files => { files['dist/runtime.js'] = "export const load = () => import('@aceshooting/lyra-ui/internal/x.js');"; },
    files => { files['dist/runtime.js'] += '\n//# sourceMappingURL=runtime.js.map'; },
    files => { files['dist/fixture.test.js'] = ''; },
    files => { delete files['dist/runtime.d.ts']; },
    files => { files['dist/runtime.js'] = "export * from './missing.js';"; },
  ]) { const files = fixture(); mutate(files); assert.ok(check(files).length > 0); }
  assert.ok(check(fixture(), { sideEffects: false }).length > 0);
});
