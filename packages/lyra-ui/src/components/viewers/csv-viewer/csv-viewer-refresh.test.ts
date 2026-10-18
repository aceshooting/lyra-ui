import { expect, fixture, html } from '@open-wc/testing';
import './csv-viewer.js';
import '../dataset-viewer/dataset-viewer.js';
import '../spreadsheet-viewer/spreadsheet-viewer.js';

type Viewer = HTMLElement & { updateComplete: Promise<boolean>; search(query: string): Promise<number> };
type Controller = { activeRowKey: number | ''; showColumn(...args: unknown[]): Promise<void> };
type Seam = { table: Controller; tableController: Controller; jumpToCell(...args: number[]): Promise<boolean> };

for (const name of ['csv', 'dataset', 'spreadsheet'] as const) {
  const setup = async (): Promise<Viewer> => fixture<Viewer>(name === 'csv' ? html`<lr-csv-viewer></lr-csv-viewer>` : name === 'dataset' ? html`<lr-dataset-viewer></lr-dataset-viewer>` : html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`);
  const property = name === 'csv' ? 'rows' : name === 'dataset' ? 'table' : 'workbook';
  const input = (cell = 'Match'): unknown => name === 'csv' ? [['Header'], [cell]] : name === 'dataset' ? { fields: ['Value'], rows: [{ Value: cell }] } : { sheets: [{ name: 'Data', rows: [['Header'], [cell]] }] };
  const settle = async (el: Viewer): Promise<void> => { await el.updateComplete; await el.updateComplete; };
  it(`${name} preserves owned snapshot and search on same-source and getter-snapshot rebind`, async () => {
    const el = await setup();
    const source = input();
    Reflect.set(el, property, source);
    await settle(el);
    expect(await el.search('Match')).to.equal(1);
    const snapshot = Reflect.get(el, property);
    let changes = 0;
    el.addEventListener('lr-search-change', () => changes++);
    const descriptor = Object.getOwnPropertyDescriptor;
    let admissions = 0;
    Object.getOwnPropertyDescriptor = (target, key) => {
      if (target === source || target === snapshot) admissions++;
      return descriptor(target, key);
    };
    try {
      Reflect.set(el, property, source);
      await settle(el);
      expect(Reflect.get(el, property) === snapshot).to.equal(true);
      Reflect.set(el, property, snapshot);
      await settle(el);
      expect(Reflect.get(el, property) === snapshot).to.equal(true);
      expect(changes).to.equal(0);
      expect(admissions).to.equal(0);
    } finally { Object.getOwnPropertyDescriptor = descriptor; }
  });
  for (const row of [1, 2]) it(`${name} cancels an obsolete row ${row} jump after column revelation`, async () => {
    const el = await setup();
    Reflect.set(el, property, input());
    await settle(el);
    const seam = el as unknown as Seam;
    const controller = name === 'dataset' ? seam.tableController : seam.table;
    const original = controller.showColumn;
    let release!: () => void;
    controller.showColumn = () => new Promise<void>(resolve => { release = resolve; });
    try {
      const pending = name === 'spreadsheet' ? seam.jumpToCell(0, row, 0) : seam.jumpToCell(row, 0);
      await Promise.resolve();
      await Promise.resolve();
      Reflect.set(el, property, input('Replacement'));
      await settle(el);
      release();
      expect(await pending).to.equal(false);
      expect(controller.activeRowKey).to.equal('');
    } finally { controller.showColumn = original; }
  });
}
