import assert from 'node:assert/strict';
import test from 'node:test';
import { initialCatalog } from '../catalog.js';
import { validateView } from '../runtime.js';
import type { LyraGenNode } from '../types.js';

const slider = initialCatalog.components['slider']!;
const view = (props: Record<string, unknown>) => ({ version: '1', catalog: { id: initialCatalog.id, version: initialCatalog.version }, surfaceId: 'slider', revision: 0, root: { id: 'limit', type: 'slider', props: { label: 'Limit', min: 0, max: 500, value: 200, ...props } } as LyraGenNode });

test('generated sliders can show their value with a declarative, locale-bound format', () => {
  assert.equal(validateView(view({ withValue: true, withTooltip: true, tooltipPlacement: 'bottom', format: { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 } }), initialCatalog).ok, true);
  for (const bad of [{ format: { style: 'scientific' } }, { format: { style: 'unit', unit: 'parsec' } }, { format: { style: 'decimal', pattern: '#' } }, { tooltipPlacement: 'center' }, { valueFormatter: 'x' }]) assert.equal(validateView(view(bad), initialCatalog).ok, false, JSON.stringify(bad));
  const euro = slider.prepareProperties!({ label: 'Limit', format: { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 } }, { locale: 'de-DE' });
  assert.equal(Object.hasOwn(euro, 'format'), false);
  assert.equal((euro['valueFormatter'] as (value: number) => string)(200).replace(/\s/gu, ' '), '200 €');
  const share = slider.prepareProperties!({ label: 'Threshold', format: { style: 'unit', unit: 'percent' } }, { locale: 'en' });
  assert.equal((share['valueFormatter'] as (value: number) => string)(80), '80%');
  assert.throws(() => slider.prepareProperties!({ label: 'Limit', format: { style: 'unit' } }, { locale: 'en' }));
  assert.deepEqual(slider.prepareProperties!({ label: 'Plain', value: 3 }, { locale: 'en' }), { label: 'Plain', value: 3 });
});
