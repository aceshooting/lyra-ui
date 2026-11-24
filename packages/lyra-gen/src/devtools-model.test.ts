import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createCatalog } from './catalog.js';
import { DevtoolsEventLog, catalogRoles, flattenTree, nodeById, redactJson, sensitivePointers, summarizeDetail } from './devtools-model.js';
import type { LyraGenNode } from './types.js';

const tree: LyraGenNode = {
  id: 'root', type: 'stack', children: [
    { id: 'a', type: 'text', text: 'A' },
    { id: 'b', type: 'row', children: [{ id: 'b1', type: 'text' }, { id: 'b2', type: 'text' }] },
  ],
};

describe('devtools tree flattening', () => {
  it('lists only expanded descendants with tree positions', () => {
    const collapsed = flattenTree(tree, new Set());
    assert.deepEqual(collapsed.map(row => row.id), ['root']);
    assert.deepEqual({ ...collapsed[0], node: undefined }, { id: 'root', type: 'stack', level: 1, position: 1, setSize: 1, hasChildren: true, expanded: false, parentId: undefined, node: undefined });
    const open = flattenTree(tree, new Set(['root', 'b']));
    assert.deepEqual(open.map(row => [row.id, row.level, row.position, row.setSize, row.parentId]), [
      ['root', 1, 1, 1, undefined], ['a', 2, 1, 2, 'root'], ['b', 2, 2, 2, 'root'], ['b1', 3, 1, 2, 'b'], ['b2', 3, 2, 2, 'b'],
    ]);
    assert.equal(open[1]!.hasChildren, false);
  });

  it('stops at a bounded row count and finds nodes by id', () => {
    const wide: LyraGenNode = { id: 'w', type: 'stack', children: Array.from({ length: 50 }, (_, index) => ({ id: `c${index}`, type: 'text' })) };
    assert.equal(flattenTree(wide, new Set(['w']), 10).length, 10);
    assert.equal(nodeById(tree, 'b2')?.type, 'text');
    assert.equal(nodeById(tree, 'missing'), undefined);
  });
});

describe('devtools event log', () => {
  it('keeps the newest entries within its capacity, oldest first', () => {
    const log = new DevtoolsEventLog(3);
    for (let index = 0; index < 5; index++) log.push({ type: 'lr-gen-ready', time: index, summary: String(index) });
    assert.equal(log.size, 3);
    assert.deepEqual(log.entries().map(entry => [entry.sequence, entry.summary]), [[3, '2'], [4, '3'], [5, '4']]);
    log.clear();
    assert.equal(log.size, 0);
    assert.deepEqual(log.entries(), []);
  });

  it('rejects a non-positive or non-finite capacity by using the default', () => {
    assert.equal(new DevtoolsEventLog(Number.NaN).capacity, 200);
    assert.equal(new DevtoolsEventLog(0).capacity, 200);
    assert.equal(new DevtoolsEventLog(7.9).capacity, 7);
  });
});

describe('devtools redaction', () => {
  const catalog = createCatalog({
    id: 'redaction', version: '1', components: {
      secret: { tag: 'input', properties: { value: { type: 'string' } }, fieldPurpose: 'secret', bindings: { value: { event: 'input', property: 'value' } } },
      field: { tag: 'input', properties: { value: { type: 'string' }, type: { type: 'string' }, autocomplete: { type: 'string' } }, fieldPurpose: 'general', bindings: { value: { event: 'input', property: 'value' } } },
      stack: { tag: 'div', properties: {}, children: true },
    },
  });
  const root: LyraGenNode = {
    id: 'form', type: 'stack', children: [
      { id: 'token', type: 'secret', bindings: { value: '/token' } },
      { id: 'pin', type: 'field', props: { autocomplete: 'one-time-code' }, bindings: { value: '/otp' } },
      { id: 'pw', type: 'field', props: { type: 'password' }, bindings: { value: '/account/password' } },
      { id: 'name', type: 'field', bindings: { value: '/name' } },
    ],
  };

  it('collects state paths owned by sensitive field purposes and native hints', () => {
    assert.deepEqual([...sensitivePointers(root, catalog)].sort(), ['/account/password', '/otp', '/token']);
  });

  it('masks sensitive paths and their descendants without touching the source value', () => {
    const state = { token: 'abc', otp: '123456', account: { password: 'hunter2', user: 'ada' }, name: 'Ada' };
    const masked = redactJson(state, sensitivePointers(root, catalog), '***');
    assert.deepEqual(masked, { token: '***', otp: '***', account: { password: '***', user: 'ada' }, name: 'Ada' });
    assert.equal(state.token, 'abc');
    assert.deepEqual(redactJson({ secretTree: { deep: 'x' } }, new Set(['/secretTree']), '***'), { secretTree: '***' });
    assert.equal(redactJson('whole', new Set(['']), '***'), '***');
  });

  it('masks copies of sensitive values elsewhere in an event detail', () => {
    const pointers = sensitivePointers(root, catalog);
    const state = { token: 'abc', name: 'Ada' };
    const detail = { surfaceId: 's', name: 'save', payload: { copied: 'abc', other: 'Ada' } };
    const summary = summarizeDetail(detail, state, pointers, '***');
    assert.ok(!summary.includes('abc'));
    assert.ok(summary.includes('Ada'));
  });
});

describe('devtools catalog roles', () => {
  it('lists roles sorted with their tag and purpose, and actions', () => {
    const catalog = createCatalog({ id: 'roles', version: '2', components: { zeta: { tag: 'p', properties: {}, text: true }, alpha: { tag: 'input', properties: { value: { type: 'string' } }, fieldPurpose: 'general', bindings: { value: { event: 'input', property: 'value' } } } }, actions: { save: { payload: { type: 'null' }, confirm: true } } });
    const roles = catalogRoles(catalog);
    assert.deepEqual(roles.components.map(role => [role.name, role.tag, role.fieldPurpose]), [['alpha', 'input', 'general'], ['zeta', 'p', undefined]]);
    assert.deepEqual(roles.actions, [{ name: 'save', confirm: true }]);
  });
});
