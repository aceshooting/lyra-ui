import { expect, fixture, html } from '@open-wc/testing';
import './csv-viewer.js';
import '../dataset-viewer/dataset-viewer.js';
import '../spreadsheet-viewer/spreadsheet-viewer.js';

type InputViewer = HTMLElement & {
  updateComplete: Promise<boolean>;
  search(query: string): Promise<number>;
  scrollToAnchor(anchor: { kind: 'cell-range'; range: string }): Promise<boolean>;
  rows?: unknown[][];
  table?: { fields: string[]; rows: Record<string, string>[] };
  workbook?: { sheets: { name: string; rows: unknown[][] }[] };
  maxRows: number;
  maxColumns: number;
  maxBytes: number;
};

for (const name of ['csv', 'dataset', 'spreadsheet'] as const) {
  describe(`${name} viewer in-memory input`, () => {
    const setup = async (): Promise<InputViewer> => await fixture<InputViewer>(
      name === 'csv' ? html`<lr-csv-viewer></lr-csv-viewer>`
        : name === 'dataset' ? html`<lr-dataset-viewer></lr-dataset-viewer>`
          : html`<lr-spreadsheet-viewer></lr-spreadsheet-viewer>`
    );
    const assign = (el: InputViewer, values: string[]): void => {
      if (name === 'csv') el.rows = values.map(value => [value]);
      else if (name === 'dataset') el.table = { fields: ['Value'], rows: values.map(Value => ({ Value })) };
      else el.workbook = { sheets: [{ name: 'Data', rows: values.map(value => [value]) }] };
    };
    it('admits raised row limits without fetching or parsing', async () => {
      const el = await setup();
      expect(el.maxRows).to.equal(10000);
      expect(el.maxColumns).to.equal(1000);
      expect(el.maxBytes).to.equal(26214400);
      el.maxRows = 10001;
      assign(el, Array.from({ length: 10001 }, (_, index) => `Value ${index}`));
      await el.updateComplete;
      await el.updateComplete;
      const table = el.shadowRoot!.querySelector('[role="table"]');
      expect(table?.getAttribute('aria-rowcount')).to.equal(name === 'dataset' ? '10002' : '10001');
      expect(await el.scrollToAnchor({ kind: 'cell-range', range: name === 'dataset' ? 'A10002' : 'A10001' })).to.equal(true);
    });
    it('owns input values and does not invoke cell accessors', async () => {
      const el = await setup();
      const grid: unknown[][] = [['Header'], ['Owned']];
      const records = [{ Value: 'Owned' }];
      if (name === 'csv') el.rows = grid;
      else if (name === 'dataset') el.table = { fields: ['Value'], rows: records };
      else el.workbook = { sheets: [{ name: 'Data', rows: grid }] };
      grid[1]![0] = 'Changed';
      records[0]!.Value = 'Changed';
      await el.updateComplete;
      await el.updateComplete;
      expect(await el.search('Owned')).to.equal(1);
      expect(await el.search('Changed')).to.equal(0);
      let reads = 0;
      let errors = 0;
      el.addEventListener('lr-render-error', () => errors++);
      const row = [''];
      Object.defineProperty(row, '0', { get: () => { reads++; return 'Accessor'; } });
      if (name === 'csv') el.rows = [row];
      else if (name === 'dataset') {
        const record = {};
        Object.defineProperty(record, 'Value', { get: () => { reads++; return 'Accessor'; } });
        el.table = { fields: ['Value'], rows: [record] };
      } else el.workbook = { sheets: [{ name: 'Data', rows: [row] }] };
      await el.updateComplete;
      await el.updateComplete;
      expect(reads).to.equal(0);
      expect(errors).to.equal(1);
    });
    it('enforces UTF-8 input bytes and normalizes non-finite limits', async () => {
      const el = await setup();
      el.maxRows = Number.POSITIVE_INFINITY;
      el.maxColumns = Number.NaN;
      el.maxBytes = 2;
      assign(el, ['€']);
      await el.updateComplete;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
      el.maxBytes = Number.NaN;
      assign(el, ['Valid']);
      await el.updateComplete;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[role="table"]')).to.exist;
    });
    it('renders admitted inputs and rejects inputs above the configured ceiling', async () => {
      const el = await setup();
      el.maxRows = 2;
      assign(el, ['Header', 'Value']);
      await el.updateComplete;
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('[role="table"]')).to.exist;
      let errors = 0;
      el.addEventListener('lr-render-error', () => errors++);
      assign(el, ['Header', 'Value', 'Overflow']);
      await el.updateComplete;
      await el.updateComplete;
      expect(errors).to.equal(1);
      expect(el.shadowRoot!.querySelector('[part="error"]')).to.exist;
    });
  });
}
