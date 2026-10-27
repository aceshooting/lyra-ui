import assert from 'node:assert/strict';
import { test } from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../test/property-options.js';
import { isolationCatalog as catalog } from '../test/fixtures/isolation/catalog.js';
import { validateView } from './runtime.js';
import type { JsonValue, LyraGenNode, LyraGenView } from './types.js';

const faults: readonly (() => JsonValue)[] = [
  () => ({ type: 'nope' }), () => ({ type: 'text', props: { tone: 5 } }), () => ({ type: 'text', props: { zzz: 1 } }), () => ({ type: 'card' }),
  () => ({ type: 'text', slot: 'aside' }), () => ({ type: 'text', props: { href: 'x' } }), () => ({ type: 'button', action: { name: 'nope' } }),
  () => ({ type: 'input', props: { value: 'v' }, bindings: { value: '/p' } })
];
const leaf = fc.record({ fault: fc.option(fc.nat({ max: faults.length - 1 }), { nil: undefined }), dupe: fc.boolean() });
const ids = (node: LyraGenNode): string[] => [node.id, ...(node.children ?? []).flatMap(ids)];

test("'isolate' never accepts what strict rejects for a boundary reason and never renames identities", () => {
  fc.assert(fc.property(fc.array(leaf, { minLength: 1, maxLength: 12 }), fc.constantFrom('flat', 'nested'), (specs, shape) => {
    const nodes = specs.map((spec, index) => ({ id: spec.dupe && index > 0 ? 'n0' : `n${index}`, type: 'text', text: 't', ...(spec.fault === undefined ? {} : faults[spec.fault]!() as object) })) as unknown as LyraGenNode[];
    const root = shape === 'flat' ? { id: 'root', type: 'row', children: nodes } : { id: 'root', type: 'row', children: [{ id: 'wrap', type: 'card', props: { title: 't' }, children: nodes }] };
    const view = { version: '1', catalog: { id: 'iso', version: '1' }, surfaceId: 's', revision: 0, root } as unknown as LyraGenView;
    const strict = validateView(view, catalog);
    const isolate = validateView(view, catalog, { recovery: 'isolate' });
    if (strict.ok) { assert.deepEqual(isolate, strict); return; }
    const boundary = strict.diagnostics.some(diagnostic => !['catalog.component', 'props.unknown', 'props.required', 'schema.type', 'schema.enum', 'node.slot', 'node.text', 'a11y.name'].includes(diagnostic.code));
    if (boundary) { assert.equal(isolate.ok, false); assert.deepEqual(isolate.diagnostics, strict.diagnostics); return; }
    assert.equal(isolate.ok, true); if (!isolate.ok) return;
    // Output identities are an in-order subsequence of the input's: nothing renamed, reordered or invented.
    const input = ids(view.root);
    let cursor = 0;
    for (const id of ids(isolate.value.root)) { cursor = input.indexOf(id, cursor); assert.ok(cursor >= 0, `${id} renamed`); cursor++; }
    assert.ok(isolate.isolated!.length > 0);
  }), propertyRuns());
});
