import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { diffDashboardDefinitions, validateDashboardDefinition } from './persistence.js';
import { migrateDashboard } from './migrations.js';
import type { DashboardDefinition } from './persistence.js';
import type { LyraGenCatalog } from './types.js';

const catalog: LyraGenCatalog = { id: 'test', version: '1', components: { text: { tag: 'p', text: true, properties: {} } } };
function document(title: string): DashboardDefinition {
  return { format: 'lyra-dashboard', version: 1, title, view: { version: '1', catalog: { id: 'test', version: '1' }, surfaceId: 'surface', revision: 0, root: { id: 'root', type: 'text', text: 'Content' } }, dataSources: [] };
}

test('portable definitions round trip without host authority and preserve escaped titles', () => {
  fc.assert(fc.property(fc.string({ maxLength: 512 }), title => {
    const input = document(title);
    const admitted = validateDashboardDefinition(JSON.parse(JSON.stringify(input)), catalog);
    assert.deepEqual(admitted, input);
    assert.deepEqual(diffDashboardDefinitions(admitted, admitted), []);
    const changed = diffDashboardDefinitions(admitted, document(`${title.slice(0, 510)}x`));
    assert.ok(changed.every(item => item.path === '/title'));
  }), propertyRuns());
});

test('unknown future versions never become current merely by restoring them', () => {
  fc.assert(fc.property(fc.integer({ min: 2, max: 1_000_000 }), version => {
    const input = { ...document('Saved'), version };
    assert.throws(() => validateDashboardDefinition(input, catalog));
    assert.throws(() => migrateDashboard(input, catalog));
    assert.equal(input.version, version);
  }), propertyRuns());
});
