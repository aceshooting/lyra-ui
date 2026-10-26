import { test } from 'node:test';
import fc from 'fast-check';
import type { LyraGenView } from './types.js';
import { propertyRuns } from '../test/property-options.js';
import { slotCatalog, routeIds } from '../test/fixtures/input-routes.js';
import type { PositiveRouteFixture } from '../test/fixtures/input-routes.js';
import { assertPositiveRoute } from '../test/input-routes.js';

const text = fc.array(fc.constantFrom('a', 'é', 'e\u0301', '🚀', 'مرحبا', '&amp;', '<tag>', '"', "'", '\n'), { maxLength: 6 }).map(parts => parts.join(''));
const scalar = fc.oneof(fc.integer({ min: -50, max: 50 }), fc.boolean(), fc.constant(null));
const rows = fc.array(fc.record({ label: text, values: fc.array(scalar, { maxLength: 4 }) }, { noNullPrototype: true }), { maxLength: 4 });
const escapeLiteral = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

test('bounded composite semantics and dirty ownership agree with an independent oracle across input routes', () => {
  fc.assert(fc.property(text, fc.boolean(), fc.integer({ min: -50, max: 50 }), rows,
    fc.array(fc.integer({ min: 1, max: 17 }), { minLength: 1, maxLength: 12 }), (value, enabled, count, data, widths) => {
      const expectedView: LyraGenView = { version: '1', catalog: { id: 'route-slots', version: '1' }, surfaceId: 'property-view', revision: 5,
        root: { id: 'root', type: 'stack', children: [
          { id: 'empty', type: 'text', text: '', slot: '' },
          { id: 'caption', type: 'text', text: value, slot: 'label' },
          { id: 'typed', type: 'typed', props: { enabled, count, note: null, data } },
          { id: 'field', type: 'input', props: { label: 'Field', value: '' }, bindings: { value: '/a~1b/~0key' } },
        ] } };
      const input = { root: { children: [
        { slot: '', text: '', type: 'text', id: 'empty' },
        { slot: 'label', text: value, type: 'text', id: 'caption' },
        { props: { data, note: null, count, enabled }, type: 'typed', id: 'typed' },
        { bindings: { value: '/a~1b/~0key' }, props: { value: '', label: 'Field' }, type: 'input', id: 'field' },
      ], type: 'stack', id: 'root' }, revision: 5, surfaceId: 'property-view', catalog: { version: '1', id: 'route-slots' }, version: '1' };
      const owners = { '/a~1b/~0key': { nodeId: 'field', property: 'value', type: 'input' } };
      const fixture: PositiveRouteFixture = {
        id: 'property-composite', catalog: slotCatalog, surfaceId: 'property-view', revision: 5,
        jsonSource: JSON.stringify(input),
        markupSource: `<stack id="root"><text id="empty" text="" slot=""/><text id="caption" text="${escapeLiteral(value)}" slot="label"/><typed id="typed" enabled={${enabled}} count={${count}} note={null} data={${JSON.stringify(data)}}/><input id="field" label="Field" value="" bindings={{"value":"/a~1b/~0key"}}/></stack>`,
        expectedView, initialValues: { 'a/b': { '~key': 'Initial' }, ignored: true },
        edits: [{ pointer: '/a~1b/~0key', value }],
        expectedInitialState: { surfaceId: 'property-view', revision: 5, values: { 'a/b': { '~key': 'Initial' } }, dirty: [], owners },
        expectedSnapshot: { version: '1', view: expectedView, state: { surfaceId: 'property-view', revision: 5,
          values: { 'a/b': { '~key': value } }, dirty: ['/a~1b/~0key'], owners } },
      };
      for (const route of routeIds) assertPositiveRoute(fixture, route, widths);
    }), propertyRuns());
});
