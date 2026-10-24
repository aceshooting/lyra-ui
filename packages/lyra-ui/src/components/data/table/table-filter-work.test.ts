import { fixture, expect, html } from '@open-wc/testing';
import './table.js';
import type { LyraTable } from './table.js';
import { installTableTestHooks } from '../../../../test/table.js';
import '../../../translations/tr/data.js';
import '../../../translations/tr/shared.js';
installTableTestHooks();

interface FilterRow {
  id: string;
  name: string;
  data?: unknown;
  toJSON?: () => unknown;
}

async function table(rows: FilterRow[]): Promise<LyraTable<FilterRow>> {
  const el = await fixture<LyraTable<FilterRow>>(html`<lr-table filterable></lr-table>`);
  el.columns = [{ key: 'name', label: 'Name', cell: row => row.name }];
  el.rowKey = row => row.id;
  el.rows = rows;
  await el.updateComplete;
  return el;
}

it('gives shared nested containers independent reference histories after successful and throwing rows', async () => {
  const shared = { text: 'needle', number: 17n };
  const cycle: Record<string, unknown> = { text: 'cyclic' };
  cycle['self'] = cycle;
  const hostile = { id: 'bad', name: 'Bad', data: shared, get failure(): never { throw new Error('unavailable'); } };
  const el = await table([hostile, { id: 'a', name: 'A', data: shared }, { id: 'b', name: 'B', data: shared },
    { id: 'cycle', name: 'Cycle', data: cycle }, { id: 'repeat', name: 'Repeat', data: { first: shared, again: shared } }]);
  el.filterText = 'needle';
  await el.updateComplete;
  expect(el.viewRows.map(row => row.id)).to.deep.equal(['a', 'b', 'repeat']);
  el.filterText = '[circular]';
  await el.updateComplete;
  expect(el.viewRows.map(row => row.id)).to.deep.equal(['cycle', 'repeat']);
  el.filterText = '17';
  await el.updateComplete;
  expect(el.pageRows.map(row => row.id)).to.deep.equal(['a', 'b', 'repeat']);
});

it('reads mutable records and stateful toJSON once per row for each changed query', async () => {
  let current = 'alpha', calls = 0;
  const mutable = { id: 'mutable', name: 'alpha' };
  const stateful = { id: 'stateful', name: 'Stateful', toJSON: () => { calls++; return { text: current }; } };
  const el = await table([mutable, stateful]);
  el.filterText = 'alpha';
  await el.updateComplete;
  expect(el.viewRows.map(row => row.id)).to.deep.equal(['mutable', 'stateful']);
  expect(calls).to.equal(1);
  mutable.name = 'beta'; current = 'beta';
  el.filterText = 'beta';
  await el.updateComplete;
  expect(el.pageRows.map(row => row.id)).to.deep.equal(['mutable', 'stateful']);
  expect(calls).to.equal(2);
  el.caption = 'Updated caption';
  await el.updateComplete;
  expect(calls).to.equal(2);
});

it('keeps reentrant default-filter reads isolated without retaining a previous row history', async () => {
  let el: LyraTable<FilterRow> | undefined, reading = false, reads = 0;
  const shared = { text: 'needle' };
  const first = { id: 'a', name: 'A', get data(): unknown {
    reads++;
    if (el && !reading) {
      reading = true;
      try { expect(el.viewRows.map(row => row.id)).to.deep.equal(['a', 'b']); }
      finally { reading = false; }
    }
    return shared;
  } };
  el = await table([first, { id: 'b', name: 'B', data: shared }]);
  el.filterText = 'needle';
  expect(el.viewRows.map(row => row.id)).to.deep.equal(['a', 'b']);
  expect(reads).to.equal(2);
  await el.updateComplete;
  expect(reads).to.equal(2);
});

it('keeps custom callback text, ordering and locale-sensitive default matching unchanged', async () => {
  const el = await table([{ id: 'a', name: 'I' }, { id: 'b', name: 'İ' }]);
  el.lang = 'tr'; el.filterText = 'ı';
  await el.updateComplete;
  expect(el.viewRows.map(row => row.id)).to.deep.equal(['a']);
  const calls: string[] = [];
  el.filter = (row, text) => { calls.push(`${row.id}:${text}`); return row.id === 'b'; };
  el.filterText = '  MiXeD  ';
  await el.updateComplete;
  expect(calls).to.deep.equal(['a:MiXeD', 'b:MiXeD']);
  expect(el.pageRows.map(row => row.id)).to.deep.equal(['b']);
});

describe('search text reuse by row mutability', () => {
  /** A row whose hidden `data` text is counted whenever the default filter reads it. */
  function counted(base: FilterRow, counter: { reads: number }): FilterRow {
    return new Proxy(base, {
      get(target, key, receiver) {
        if (key === 'data') counter.reads += 1;
        return Reflect.get(target, key, receiver);
      },
    });
  }
  class Entry implements FilterRow {
    constructor(readonly id: string, readonly name: string, readonly data: string) {}
  }

  it('serializes a frozen plain record once and again for every query on a mutable one', async () => {
    const frozen = { reads: 0 }, mutable = { reads: 0 };
    const el = await table([
      counted(Object.freeze({ id: 'f', name: 'Frozen', data: 'needle frozen' }), frozen),
      counted({ id: 'm', name: 'Mutable', data: 'needle mutable' }, mutable),
    ]);
    el.filterText = 'needle';
    await el.updateComplete;
    expect(el.viewRows.map(row => row.id)).to.deep.equal(['f', 'm']);
    const firstFrozen = frozen.reads, firstMutable = mutable.reads;
    expect([firstFrozen, firstMutable].every(count => count > 0)).to.equal(true);
    el.filterText = 'frozen';
    await el.updateComplete;
    expect(el.viewRows.map(row => row.id)).to.deep.equal(['f']);
    expect(frozen.reads, 'a frozen record keeps its serialized text').to.equal(firstFrozen);
    expect(mutable.reads, 'a mutable record is read again').to.be.greaterThan(firstMutable);
  });

  it('does not trust a frozen instance of a class, a record with toJSON or a record that cannot be inspected', async () => {
    const instance = { reads: 0 }, serialized = { reads: 0 }, opaque = { reads: 0 };
    const hidden = new Proxy(Object.freeze({ id: 'o', name: 'Opaque', data: 'needle opaque' }), {
      isExtensible() { throw new Error('unreadable'); },
      get(target, key, receiver) {
        if (key === 'data') opaque.reads += 1;
        return Reflect.get(target, key, receiver);
      },
    });
    const el = await table([
      counted(Object.freeze(new Entry('c', 'Instance', 'needle instance')), instance),
      counted(Object.freeze({ id: 't', name: 'Serialized', data: 'needle serialized', toJSON() { return { text: 'needle serialized' }; } }), serialized),
      hidden,
    ]);
    el.filterText = 'needle';
    await el.updateComplete;
    expect(el.viewRows.map(row => row.id)).to.deep.equal(['c', 't', 'o']);
    const before = { instance: instance.reads, opaque: opaque.reads };
    el.filterText = 'instance';
    await el.updateComplete;
    expect(el.viewRows.map(row => row.id)).to.deep.equal(['c']);
    expect(instance.reads, 'a frozen class instance is read again').to.be.greaterThan(before.instance);
    expect(opaque.reads, 'a record that cannot be inspected is read again').to.be.greaterThan(before.opaque);
  });
});
