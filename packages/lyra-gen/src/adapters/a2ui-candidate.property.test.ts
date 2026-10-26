import assert from 'node:assert/strict';
import test from 'node:test';
import fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import type { JsonObject, JsonValue, LyraGenCatalog, LyraGenComponent } from '../types.js';
import { exportA2uiCandidateCatalog } from './a2ui-candidate.js';

const catalog = (components: LyraGenCatalog['components']): LyraGenCatalog => ({ id: 'candidate-properties', version: '1', components });
const component: LyraGenComponent = { tag: 'div', properties: {} };
const letters = fc.array(fc.constantFrom('a', 'b', 'c', 'x', 'y', 'z'), { minLength: 1, maxLength: 10 }).map(chars => chars.join(''));
const rolePairs = [
  ['chat-message', 'chat_message'], ['child-view', 'child_view'], ['__proto__', '__proto__'],
  ['constructor', 'constructor'], ['toString', 'toString'], ['café', 'café'],
  ['Δείγμα', 'Δείγμα'], ['变量', '变量'], ['a\u0301', 'a\u0301'],
] as const;
const role = fc.oneof(fc.constantFrom(...rolePairs), letters.map(name => [`role-${name}`, `role_${name}`] as const));
const graph = fc.tuple(
  fc.uniqueArray(role, { minLength: 1, maxLength: 8, selector: pair => pair[1] }),
  fc.array(fc.record({ mode: fc.integer({ min: 0, max: 2 }), children: fc.array(fc.nat(31), { maxLength: 6 }), required: fc.boolean() }), { minLength: 8, maxLength: 8 }),
  fc.constantFrom('label', 'toString', 'hasOwnProperty', 'café', '变量'),
);

function object(value: JsonValue | undefined): JsonObject {
  assert.ok(value !== null && typeof value === 'object' && !Array.isArray(value));
  return value as JsonObject;
}

function freeze(value: object): void {
  for (const child of Object.values(value)) if (child !== null && typeof child === 'object') freeze(child);
  Object.freeze(value);
}

test('candidate graphs preserve declared child targets, literal identities and frozen input', () => {
  fc.assert(fc.property(graph, ([roles, settings, property]) => {
    const components = Object.fromEntries(roles.map(([name], index) => {
      const setting = settings[index]!;
      return [name, { ...component, properties: { [property]: { type: 'string' } },
        ...(setting.required ? { required: [property] } : {}),
        ...(setting.mode === 1 ? { children: true } : setting.mode === 2 ? { children: setting.children.map(child => roles[child % roles.length]![0]!) } : {}),
      } satisfies LyraGenComponent];
    }));
    const input = catalog(components);
    const before = JSON.stringify(input);
    freeze(input);
    const exported = exportA2uiCandidateCatalog(input);
    const wire = object(exported['components']);
    assert.deepEqual(Object.keys(wire).sort(), roles.map(pair => pair[1]).sort());
    const names = new Map<string, string>(roles.map(([name, identifier]) => [name, identifier]));
    for (const [name, identifier] of roles) {
      const schema = object(wire[identifier]);
      const properties = object(schema['properties']);
      assert.deepEqual(properties['component'], { const: identifier });
      assert.deepEqual(properties[property], components[name]!.properties[property]);
      assert.deepEqual(schema['required'], ['id', 'component', ...(components[name]!.required ?? [])]);
      const children = components[name]!.children;
      if (children === true) assert.equal(Object.hasOwn(schema, 'allowedChildren'), false);
      else assert.deepEqual(schema['allowedChildren'], children ? children.map(child => names.get(child)) : []);
    }
    const alternatives = object(object(exported['$defs'])['anyComponent'])['oneOf'];
    assert.ok(Array.isArray(alternatives));
    const referenced = alternatives.map(value => {
      const reference = object(value)['$ref'];
      assert.ok(typeof reference === 'string');
      assert.ok(reference.startsWith('#/components/'));
      const target = reference.slice('#/components/'.length);
      assert.ok(Object.hasOwn(wire, target));
      return target;
    });
    assert.deepEqual(referenced.sort(), Object.keys(wire).sort());
    assert.deepEqual(exportA2uiCandidateCatalog(input), exported);
    assert.equal(JSON.stringify(input), before);
  }), propertyRuns());
});

test('direct candidate export rejects prototype-related properties without changing its input', () => {
  fc.assert(fc.property(fc.constantFrom('__proto__', 'constructor', 'prototype', '__PROTO__', 'Constructor', 'PROTOTYPE'), fc.constantFrom('string', 'number', 'boolean'), (key, type) => {
    const input = catalog({ item: { ...component, properties: Object.fromEntries([[key, { type }]]) } });
    const before = JSON.stringify(input);
    freeze(input);
    assert.throws(() => exportA2uiCandidateCatalog(input), /unsafe catalog property/i);
    assert.equal(JSON.stringify(input), before);
  }), propertyRuns());
});

test('distinct roles that would share a wire identity are rejected', () => {
  fc.assert(fc.property(letters, letters, (left, right) => {
    const input = catalog(Object.fromEntries([[`${left}-${right}`, component], [`${left}_${right}`, component]]));
    assert.equal(Object.keys(input.components).length, 2);
    const before = JSON.stringify(input);
    assert.throws(() => exportA2uiCandidateCatalog(input), /collision/i);
    assert.equal(JSON.stringify(input), before);
  }), propertyRuns());
});

test('invalid identifiers and reserved protocol properties are rejected', () => {
  fc.assert(fc.property(letters, fc.constantFrom('role', 'property'), fc.constantFrom('.', '/', ' ', '😀'), fc.constantFrom('id', 'component', 'children', 'action', 'checks'), (name, target, separator, reserved) => {
    const invalid = `${name}${separator}${name}`;
    const input = target === 'role' ? catalog(Object.fromEntries([[invalid, component]]))
      : catalog({ item: { ...component, properties: Object.fromEntries([[invalid, { type: 'string' }]]) } });
    assert.throws(() => exportA2uiCandidateCatalog(input), /identifier/i);
    assert.throws(() => exportA2uiCandidateCatalog(catalog({ item: { ...component, properties: { [reserved]: { type: 'string' } } } })), /protocol vocabulary/i);
    assert.throws(() => exportA2uiCandidateCatalog(catalog({ [`1${name}`]: component })), /identifier/i);
    assert.throws(() => exportA2uiCandidateCatalog(catalog({ Surface: component })), /reserved/i);
  }), propertyRuns());
});

test('restricted children cannot refer outside the exported catalog', () => {
  fc.assert(fc.property(letters, fc.array(fc.constantFrom('parent', 'child'), { maxLength: 6 }), (suffix, extra) => {
    const missing = `missing-${suffix}`;
    const input = catalog({ parent: { ...component, children: ['child', ...extra, missing] }, child: component });
    assert.equal(Object.hasOwn(input.components, missing), false);
    assert.throws(() => exportA2uiCandidateCatalog(input), /unknown child/i);
  }), propertyRuns());
});
