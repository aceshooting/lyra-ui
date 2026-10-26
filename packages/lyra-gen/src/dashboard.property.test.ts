import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { constrainDashboardLayout, dashboardPageWindow } from './dashboard.js';

test('pagination never exceeds the host limit or the number of remaining records', () => {
  fc.assert(fc.property(fc.nat({ max: 1_000_000 }), fc.integer({ min: 1, max: 1000 }), fc.integer({ min: 1, max: 500 }), fc.nat({ max: 1_000_000 }), (offset, limit, maximum, total) => {
    const result = dashboardPageWindow(offset, limit, maximum, total);
    assert.ok(result.offset >= 0 && result.offset <= Math.max(0, total - 1));
    assert.ok(result.limit >= 0 && result.limit <= maximum && result.limit <= limit);
    assert.ok(result.offset + result.limit <= total);
  }), propertyRuns());
});
test('a normalized panel remains inside allocation and normalizing again is idempotent', () => {
  fc.assert(fc.property(fc.integer({ min: 1, max: 64 }), fc.integer({ min: 1, max: 128 }), fc.tuple(fc.integer(), fc.integer(), fc.integer(), fc.integer()), (columns, maxRows, [column, row, width, height]) => {
    const constraints = { columns, maxRows, maxPanels: 1, collision: 'reject' } as const;
    const result = constrainDashboardLayout([{ id: 'panel', column, row, width, height }], constraints);
    const panel = result[0]!;
    assert.ok(panel.column >= 0 && panel.row >= 0 && panel.width >= 1 && panel.height >= 1);
    assert.ok(panel.column + panel.width <= columns && panel.row + panel.height <= maxRows);
    assert.deepEqual(constrainDashboardLayout(result, constraints), result);
  }), propertyRuns());
});
