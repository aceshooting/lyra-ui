import { expect, html } from '@open-wc/testing';
import { columns, dataCells, dataGrid, rows } from '../../../../test/data-grid.js';
import type { DataGridFilter, DataGridSort } from './data-grid-types.js';

describe('data-grid controlled query assignment order', () => {
  for (const property of ['filters', 'sort'] as const) {
    const fields = property === 'filters' ? ['id', 'value', 'value iterator'] : ['id', 'desc'];
    for (const field of fields) {
      for (const throws of [false, true]) {
        it(`retains newer ${property} when an older ${field} ${throws ? 'getter throws after reentry' : 'getter reenters'}`, async () => {
          const element = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
          if (property === 'filters') element.filters = [{ id: 'team', value: 'Compiler' }];
          else element.sort = [{ id: 'score', desc: false }];
          await element.updateComplete;
          const nextFilters: DataGridFilter[] = [{ id: 'team', value: 'Runtime' }];
          const nextSort: DataGridSort[] = [{ id: 'score', desc: true }];
          let superseded = false;
          const replace = () => {
            if (superseded) return;
            superseded = true;
            if (property === 'filters') element.filters = nextFilters;
            else element.sort = nextSort;
            if (throws) throw new Error('Older query record is no longer available');
          };
          if (property === 'filters') {
            const old: { id: string; value: unknown } = { id: 'name', value: 'Ada' };
            if (field === 'value iterator') {
              const values = ['Ada'];
              values[Symbol.iterator] = function* () { replace(); yield 'Ada'; return undefined; };
              old.value = values;
            } else {
              const value = field === 'id' ? 'name' : 'Ada';
              Object.defineProperty(old, field, { get() { replace(); return value; } });
            }
            element.filters = [old];
          } else {
            const old: DataGridSort = { id: 'name', desc: false };
            const value = field === 'id' ? 'name' : false;
            Object.defineProperty(old, field, { get() { replace(); return value; } });
            element.sort = [old];
          }
          expect(superseded).to.equal(true);
          expect(element[property]).to.deep.equal(property === 'filters' ? nextFilters : nextSort);
          expect(Object.isFrozen(element[property])).to.equal(true);
          expect(Object.isFrozen(element[property][0])).to.equal(true);
          await element.updateComplete;
          const names = property === 'filters' ? ['Lin'] : ['Lin', 'Grace', 'Ada'];
          expect(element.getProcessedRows().map(row => row.name)).to.deep.equal(names);
          expect(dataCells(element).filter(cell => cell.dataset['columnId'] === 'name').map(cell => cell.textContent!.trim()))
            .to.deep.equal(names);
        });
      }
    }

    it(`retains an unchanged latest ${property} assignment while older input is still being read`, async () => {
      const element = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
      const held = element[property];
      const old = Object.defineProperty({ value: 'Ada', desc: true }, 'id', {
        get() {
          if (property === 'filters') element.filters = [];
          else element.sort = [];
          return 'name';
        },
      });
      Reflect.set(element, property, [old]);
      expect(element[property] === held).to.equal(true);
      await element.updateComplete;
      expect(element.getProcessedRows().map(row => row.name)).to.deep.equal(['Ada', 'Lin', 'Grace']);
    });

    it(`retains newer ${property} assigned by the older collection iterator`, async () => {
      const element = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
      const old = [{ id: 'name', value: 'Ada', desc: false }];
      old[Symbol.iterator] = function* () {
        if (property === 'filters') element.filters = [{ id: 'team', value: 'Runtime' }];
        else element.sort = [{ id: 'score', desc: true }];
        yield { id: 'name', value: 'Ada', desc: false };
        return undefined;
      };
      Reflect.set(element, property, old);
      await element.updateComplete;
      expect(element.getProcessedRows().map(row => row.name))
        .to.deep.equal(property === 'filters' ? ['Lin'] : ['Lin', 'Grace', 'Ada']);
    });

    it(`ignores malformed ${property} records and retains valid neighbors`, async () => {
      const element = await dataGrid(html`<lr-data-grid label="People" .columns=${columns} .data=${rows}></lr-data-grid>`);
      const valid = property === 'filters' ? { id: 'team', value: 'Runtime' } : { id: 'score', desc: true };
      Reflect.set(element, property, [null, false, 17, {}, { id: 12 }, valid]);
      expect(element[property]).to.deep.equal([valid]);
      await element.updateComplete;
      expect(element.getProcessedRows().map(row => row.name))
        .to.deep.equal(property === 'filters' ? ['Lin'] : ['Lin', 'Grace', 'Ada']);
      Reflect.set(element, property, []);
      await element.updateComplete;
      expect(element.getProcessedRows().map(row => row.name)).to.deep.equal(['Ada', 'Lin', 'Grace']);
    });
  }
});
