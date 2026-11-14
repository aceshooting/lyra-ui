import { expect, fixture, html } from '@open-wc/testing';
import { columns, dataCells, dataGrid, rows, type Person } from '../../../../test/data-grid.js';
import { LyraDataGrid } from './data-grid.js';

describe('data-grid controlled collection assignment order', () => {
  const cases = [
    { property: 'data', old: [rows[0]!], next: [rows[1]!], descriptor: true },
    { property: 'columns', old: [{ field: 'team' }], next: [{ field: 'name' }], descriptor: true },
    { property: 'columnOrder', old: ['team'], next: ['score', 'name', 'team'], descriptor: false },
    { property: 'groupBy', old: ['name'], next: ['team'], descriptor: false },
    { property: 'pageSizeOptions', old: [10], next: [1, 2], descriptor: false },
    { property: 'expandedRowKeys', old: [1], next: [2], descriptor: false },
    { property: 'selectedRowKeys', old: [1], next: [2], descriptor: false },
    { property: 'selectedRows', old: [rows[0]!], next: [rows[1]!], descriptor: false },
  ] as const;

  for (const entry of cases) {
    for (const reaffirm of [false, true]) {
      it(`preserves ${reaffirm ? 'a reaffirmed' : 'a newer'} ${entry.property} while reading an older collection`, async () => {
        const element = await dataGrid(html`<lr-data-grid label="People" row-key="id" selectable="multiple" .columns=${columns} .data=${rows}></lr-data-grid>`);
        if (reaffirm) Reflect.set(element, entry.property, entry.next);
        await element.updateComplete;
        const held = Reflect.get(element, entry.property) as unknown;
        let reentered = false;
        const replace = () => {
          if (reentered) return;
          reentered = true;
          Reflect.set(element, entry.property, reaffirm ? held : entry.next);
        };
        const source = new Proxy([...entry.old], entry.descriptor ? {
          getOwnPropertyDescriptor(target, name) {
            if (name === '0') replace();
            return Reflect.getOwnPropertyDescriptor(target, name);
          },
        } : {
          get(target, name, receiver) {
            if (name === '0') replace();
            return Reflect.get(target, name, receiver);
          },
        });
        Reflect.set(element, entry.property, source);
        expect(reentered).to.equal(true);
        expect(Reflect.get(element, entry.property)).to.deep.equal(entry.next);
        if (reaffirm && entry.property !== 'selectedRows')
          expect(Reflect.get(element, entry.property) === held).to.equal(true);
        expect(Object.isFrozen(Reflect.get(element, entry.property))).to.equal(true);
        await element.updateComplete;
        expect(Reflect.get(element, entry.property)).to.deep.equal(entry.next);
        if (entry.property === 'data' || entry.property === 'columns') {
          expect(dataCells(element).filter(cell => cell.dataset['columnId'] === 'name').map(cell => cell.textContent!.trim()))
            .to.deep.equal(entry.property === 'data' ? ['Lin'] : ['Ada', 'Lin', 'Grace']);
        }
        if (entry.property === 'selectedRows' || entry.property === 'selectedRowKeys') {
          expect(element.selectedRows.map(row => row.name)).to.deep.equal(['Lin']);
          expect(element.selectedKeys).to.deep.equal([2]);
        }
      });
    }
  }

  for (const property of ['selectedKeys', 'selectedRowKeys'] as const) {
    it(`preserves newer ${property} assigned while selectedRows is being read`, async () => {
      const element = await dataGrid(html`<lr-data-grid label="People" row-key="id" selectable="multiple" .columns=${columns} .data=${rows}></lr-data-grid>`);
      const source = [rows[0]!];
      Object.defineProperty(source, '0', { get() { element[property] = [2]; return rows[0]; } });
      element.selectedRows = source;
      await element.updateComplete;
      expect(element.selectedKeys).to.deep.equal([2]);
      expect(element.selectedRows.map(row => row.name)).to.deep.equal(['Lin']);
    });

    it(`preserves newer selectedRows assigned while ${property} is being read`, async () => {
      const element = await dataGrid(html`<lr-data-grid label="People" row-key="id" selectable="multiple" .columns=${columns} .data=${rows}></lr-data-grid>`);
      const source = [1];
      source[Symbol.iterator] = function* () {
        element.selectedRows = [rows[1]!];
        yield 1;
        return undefined;
      };
      element[property] = source;
      await element.updateComplete;
      expect(element.selectedKeys).to.deep.equal([2]);
      expect(element.selectedRows.map(row => row.name)).to.deep.equal(['Lin']);
    });

    it(`lets an initial ${property} binding supersede pending selectedRows`, async () => {
      const element = new LyraDataGrid<Person>();
      element.label = 'People';
      element.rowKey = 'id';
      element.selectedRows = [rows[0]!];
      element[property] = [2];
      element.data = rows;
      element.columns = columns;
      await fixture(html`${element}`);
      expect(element.selectedKeys).to.deep.equal([2]);
      expect(element.selectedRows.map(row => row.name)).to.deep.equal(['Lin']);
    });
  }

  it('retains a repeated initial selectedRows binding until later data has settled', async () => {
    const element = new LyraDataGrid<Person>();
    element.label = 'People';
    const selection = [rows[1]!];
    element.rowKey = 'id';
    element.selectedRows = selection;
    element.selectedRows = selection;
    element.data = rows;
    element.columns = columns;
    await fixture(html`${element}`);
    expect(element.selectedKeys).to.deep.equal([2]);
    expect(element.selectedRows.map(row => row.name)).to.deep.equal(['Lin']);
  });

  it('retains the newer row limit and complete-data state when an older descriptor throws', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" row-key="id" .columns=${columns}></lr-data-grid>`);
    element.maxRows = 1;
    const next = rows.slice(0, 2);
    element.data = new Proxy([...rows], {
      getOwnPropertyDescriptor(target, name) {
        if (name === '0') {
          element.maxRows = 2;
          element.data = next;
          throw new Error('Obsolete row source');
        }
        return Reflect.getOwnPropertyDescriptor(target, name);
      },
    });
    const held = element.data;
    element.data = next;
    expect(element.data === held).to.equal(true);
    await element.updateComplete;
    expect(element.data.map(row => row.name)).to.deep.equal(['Ada', 'Lin']);
    expect(element.shadowRoot!.querySelector('[part="row-limit"]') === null).to.equal(true);
  });

  it('allows a data descriptor to update a separate collection without losing either assignment', async () => {
    const element = await dataGrid(html`<lr-data-grid label="People" .columns=${columns}></lr-data-grid>`);
    element.data = new Proxy([rows[1]!], {
      getOwnPropertyDescriptor(target, name) {
        if (name === '0') element.columns = [{ field: 'name' }];
        return Reflect.getOwnPropertyDescriptor(target, name);
      },
    });
    await element.updateComplete;
    expect(element.data.map(row => row.name)).to.deep.equal(['Lin']);
    expect(element.columns).to.deep.equal([{ field: 'name' }]);
    expect(dataCells(element).map(cell => cell.textContent!.trim())).to.deep.equal(['Lin']);
  });
});
