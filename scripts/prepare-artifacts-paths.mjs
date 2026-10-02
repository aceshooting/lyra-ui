import assert from 'node:assert/strict';
import { parseSourceContractRequest } from './source-contract-request.mjs';

const hiddenGenerated = new Set([
  '.storybook/token-preview.generated.js', '.storybook/sitemap.xml',
  '.claude-plugin/marketplace.json',
  'plugins/lyra-ui/.claude-plugin/plugin.json', 'plugins/lyra-ui/.codex-plugin/plugin.json',
]);

export function assertPreparationInputs(mode = 'source', publication = '', sourceContracts = '') {
  assert.ok(['source', 'release'].includes(mode), `Unknown preparation mode ${mode}`);
  assert.ok(mode !== 'release' || publication === '',
    'Release preparation cannot capture a publication; capture and commit it in source mode first');
  parseSourceContractRequest(sourceContracts, mode);
}

export function assertGeneratedAddition(file) {
  // Authored additions must already be committed before preparing source projections.
  assert.ok(hiddenGenerated.has(file) || /^(?:packages\/lyra-ui\/(?:src|llms|scripts\/fixtures)\/|plugins\/lyra-ui\/skills\/(?:lyra-ui|compose-lyra-interfaces)\/|docs\/changelog\/v\d+\.md$|skills\/[^/]+\.skill$)/u.test(file),
    `Unexpected generated addition ${file}`);
}

export function assertSourcePath(file, { mode = 'source', tracked, deleted = false } = {}) {
  const parts = file.split('/');
  assert.ok(!parts.some(part => part === '' || part === '.' || part === '..'), `Non-source path ${file}`);
  // Only release:prepare consumes tracked pending changesets. Other hidden changes remain blocked.
  const consumedChangeset = mode === 'release' && deleted &&
    tracked?.kind === 'blob' && ['100644', '100755'].includes(tracked.mode) &&
    /^\.changeset\/[^./][^/]*\.md$/u.test(file) && file !== '.changeset/README.md';
  assert.ok(hiddenGenerated.has(file) || consumedChangeset ||
    !parts.some(part => part.startsWith('.') || ['node_modules', 'dist'].includes(part)),
    `Non-source path ${file}`);
  assert.ok(!/(?:^|\/)(?:[^/]*\.log|[^/]*\.pem|[^/]*\.key)$/u.test(file), `Non-source path ${file}`);
}
