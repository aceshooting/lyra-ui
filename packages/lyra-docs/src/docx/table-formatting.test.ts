import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeDocxAction, isDocxTableAction } from './commands.js';

const invalid = { ok: false, code: 'invalid-option' };
const limited = { ok: false, code: 'resource-limit' };

test('table formatting copies exact bounded values and normalizes explicit colors', () => {
  for (const action of [
    { type: 'table-header-row', enabled: true }, { type: 'table-header-row', enabled: false },
    { type: 'table-cell-alignment', value: 'top' }, { type: 'table-cell-alignment', value: 'center' }, { type: 'table-cell-alignment', value: 'bottom' },
    { type: 'table-cell-shading', color: null }, { type: 'table-cell-shading', color: '#ABCDEF' },
    { type: 'table-cell-borders', target: 'all', style: 'none' },
    ...['all', 'outside', 'inside', 'top', 'bottom', 'left', 'right'].map(target => ({ type: 'table-cell-borders', target, style: 'single', widthPoints: 0.25, color: 'auto' })),
    ...['single', 'dashed', 'dotted', 'double', 'triple', 'thick'].map(style => ({ type: 'table-cell-borders', target: 'outside', style, widthPoints: 12, color: '#012345' })),
    { type: 'table-width', widthPoints: 15 }, { type: 'table-width', widthPoints: 1440 }, { type: 'table-width', widthPoints: 400.05 },
  ]) {
    const result = normalizeDocxAction(action);
    assert.deepEqual(result, { ok: true, value: action });
    if (result.ok) { assert.equal(isDocxTableAction(result.value), true); assert.equal(Object.isFrozen(result.value), true); assert.notEqual(result.value, action); }
  }
  assert.deepEqual(normalizeDocxAction({ type: 'table-cell-shading', color: '#aBcDef' }),
    { ok: true, value: { type: 'table-cell-shading', color: '#ABCDEF' } });
  assert.deepEqual(normalizeDocxAction({ type: 'table-cell-borders', target: 'top', style: 'single', widthPoints: 1, color: '#aBcDef' }),
    { ok: true, value: { type: 'table-cell-borders', target: 'top', style: 'single', widthPoints: 1, color: '#ABCDEF' } });
});

test('table formatting refuses coercion, unknown values and hidden or accessor fields', () => {
  let reads = 0;
  for (const action of [
    { type: 'table-header-row', enabled: 'true' }, { type: 'table-header-row', enabled: 1 }, { type: 'table-header-row' },
    { type: 'table-cell-alignment', value: 'middle' }, { type: 'table-cell-shading', color: 'auto' },
    ...['red', '#fff', 'ABCDEF', 'var(--color)', undefined].map(color => ({ type: 'table-cell-shading', color })),
    { type: 'table-cell-borders', target: 'diagonal', style: 'none' },
    { type: 'table-cell-borders', target: 'all', style: 'none', color: 'auto' },
    { type: 'table-cell-borders', target: 'all', style: 'none', widthPoints: 1 },
    { type: 'table-cell-borders', target: 'all', style: 'wave', widthPoints: 1, color: 'auto' },
    ...[0, 0.125, 0.3, NaN, Infinity, '1', null].map(widthPoints => ({ type: 'table-cell-borders', target: 'all', style: 'single', widthPoints, color: 'auto' })),
    { type: 'table-cell-borders', target: 'all', style: 'single', widthPoints: 1, color: null },
    ...[0, 14.95, 20.01, NaN, Infinity, '20', null].map(widthPoints => ({ type: 'table-width', widthPoints })),
    { type: 'table-cell-alignment', get value() { reads++; return 'top'; } },
    Object.defineProperty({ type: 'table-header-row', enabled: true }, 'extra', { value: true }),
  ]) assert.deepEqual(normalizeDocxAction(action), invalid);
  assert.equal(reads, 0);
  assert.deepEqual(normalizeDocxAction({ type: 'table-width', widthPoints: 1440.05 }), limited);
  assert.deepEqual(normalizeDocxAction({ type: 'table-cell-borders', target: 'all', style: 'single', widthPoints: 12.125, color: 'auto' }), limited);
});
