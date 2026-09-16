import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './data-grid.js';
import '../../forms/button/button.js';
import type { LyraDataGrid, DataGridColumn } from './data-grid.js';
import type { LyraButton } from '../../forms/button/button.js';

type Row = { id: string; value: string };
const row: Row = { id: 'first', value: 'One' };

describe('data-grid canonical output and interaction', () => {
  it('keeps the first root occurrence in rows, pages, facets and CSV', async () => {
    const second: Row = { id: 'second', value: 'Two' };
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      .rowKey=${'id'} .columns=${[{ field: 'value', label: 'Value' }]}
      .data=${[row, row, { ...row }, second]} paginate .pageSize=${1}
    ></lr-data-grid>`);
    expect(element.getProcessedRows().map((entry) => entry.id)).to.deep.equal(['first', 'second']);
    expect(element.getProcessedRows()[0] === row).to.equal(true);
    expect(element.getColumnFacets('value').uniqueValues.get('One')).to.equal(1);
    expect(element.getDataAsCsv()).to.equal('Value\r\nOne\r\nTwo');
    expect(element.getVisibleRows().map((entry) => entry.id)).to.deep.equal(['first']);
    element.page = 1;
    await element.updateComplete;
    expect(element.getVisibleRows().map((entry) => entry.id)).to.deep.equal(['second']);
    expect(element.shadowRoot!.querySelector('[role="gridcell"]')?.textContent?.trim()).to.equal('Two');
    expect(element.shadowRoot!.querySelector('[role="grid"]')?.getAttribute('aria-rowcount')).to.equal('2');
  });

  for (const flex of [0, -1]) {
    for (const selection of ['none', 'multiple'] as const) {
      it(`reserves visible effective fixed widths with flex=${flex} and selection=${selection}`, async () => {
        const columns: DataGridColumn<Row>[] = [
          { id: 'fixed', field: 'value', label: 'Fixed', width: 100, flex },
          { id: 'hidden', field: 'value', label: 'Hidden', width: 500, flex: 0, hidden: true },
          { id: 'flexible', field: 'value', label: 'Flexible', flex: 1 },
        ];
        const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
          style="inline-size: 320px" .rowKey=${'id'} .columns=${columns}
          .data=${[row]} .selectable=${selection}
        ></lr-data-grid>`);
        const body = element.shadowRoot!.querySelector<HTMLElement>('[part="body"]')!;
        const header = (id: string) => element.shadowRoot!.querySelector<HTMLElement>(`[role="columnheader"][data-column-id="${id}"]`)!;
        await waitUntil(() => header('fixed').getBoundingClientRect().width > 0);
        const fixedWidth = header('fixed').getBoundingClientRect().width;
        const selectionWidth = selection === 'none' ? 0 : element.shadowRoot!.querySelector<HTMLElement>('[role="columnheader"]')!.getBoundingClientRect().width;
        element.sizeColumnsToFit();
        await element.updateComplete;
        expect(header('fixed').getBoundingClientRect().width).to.be.closeTo(fixedWidth, 0.1);
        expect(header('flexible').getBoundingClientRect().width).to.be.closeTo(body.clientWidth - fixedWidth - selectionWidth, 1);
        expect(element.getState().widths?.['fixed']).to.equal(undefined);
        expect(element.getState().widths?.['hidden']).to.equal(undefined);
      });
    }
  }

  it('reserves clamped, minimum-only and resized fixed widths without changing them', async () => {
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid style="inline-size: 640px"
      .rowKey=${'id'} .data=${[row]} .columns=${[
        { id: 'minimum', field: 'value', label: 'Minimum', minWidth: 80, flex: 0 },
        { id: 'bounded', field: 'value', label: 'Bounded', width: 200, maxWidth: 120, flex: 0 },
        { id: 'resized', field: 'value', label: 'Resized', width: 100, flex: 0 },
        { id: 'flexible', field: 'value', label: 'Flexible', flex: 1 },
      ]}
    ></lr-data-grid>`);
    element.setState({ widths: { resized: 160 } });
    await element.updateComplete;
    element.sizeColumnsToFit();
    await element.updateComplete;
    const headers = [...element.shadowRoot!.querySelectorAll<HTMLElement>('[role="columnheader"][data-column-id]')];
    expect(headers.map((header) => header.getBoundingClientRect().width)).to.deep.equal([80, 120, 160, 278]);
    expect(element.getState().widths).to.deep.equal({ resized: 160, flexible: 278 });
  });

  it('lets a real shadow-native button own activation while passive cells still emit', async () => {
    let actions = 0;
    const columns: DataGridColumn<Row>[] = [{
      field: 'value', label: 'Action', formatter: () => html`<lr-button @click=${() => actions++}>Run</lr-button><span>Passive</span>`,
    }];
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid .rowKey=${'id'} .columns=${columns} .data=${[row]}></lr-data-grid>`);
    const events: string[] = [];
    element.addEventListener('lr-cell-click', (event) => events.push((event as CustomEvent<{ rowKey: string }>).detail.rowKey));
    const button = element.shadowRoot!.querySelector<LyraButton>('lr-button')!;
    await button.updateComplete;
    button.shadowRoot!.querySelector<HTMLButtonElement>('button')!.click();
    expect(actions).to.equal(1);
    expect(events).to.deep.equal([]);
    element.parentElement!.tabIndex = 0;
    element.shadowRoot!.querySelector<HTMLElement>('[role="gridcell"] span')!.click();
    expect(events).to.deep.equal(['first']);
  });

  it('accepts selectionMode/selection-mode as an alias for selectable, mirroring lr-table\'s naming', async () => {
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      .rowKey=${'id'} .columns=${[{ field: 'value', label: 'Value' }]}
      .data=${[row]} selection-mode="multiple"
    ></lr-data-grid>`);
    expect(element.selectable).to.equal('multiple');
    expect(element.selectionMode).to.equal('multiple');
    element.selectionMode = 'single';
    await element.updateComplete;
    expect(element.selectable).to.equal('single');
    element.selectable = 'none';
    await element.updateComplete;
    expect(element.selectionMode).to.equal('none');
  });

  it('renders a per-cell title from column.cellTitle, mirroring lr-table', async () => {
    const columns: DataGridColumn<Row>[] = [{
      field: 'value', label: 'Value', cellTitle: (r) => `full: ${r.value}`,
    }];
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      .rowKey=${'id'} .columns=${columns} .data=${[row]}
    ></lr-data-grid>`);
    const cell = element.shadowRoot!.querySelector<HTMLElement>('[role="gridcell"][data-column-id]')!;
    expect(cell.getAttribute('title')).to.equal('full: One');
  });
});

// `error` mirrors `<lr-table>`'s own contract (decision 40): a built-in failed-load state that
// keeps the header/toolbar/pager mounted, `error` beating every empty/no-columns/no-results
// branch, and a cancelable `lr-retry` whose default action clears `error`.
describe('error state', () => {
  const errorColumns: DataGridColumn<Row>[] = [{ field: 'value', label: 'Value' }];

  it('renders the error row in the body while keeping the header mounted', async () => {
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      label="People" .rowKey=${'id'} .columns=${errorColumns} .data=${[row]} error
    ></lr-data-grid>`);
    await element.updateComplete;

    expect(element.shadowRoot!.querySelector('[role="columnheader"]')).to.exist;
    const errorRows = element.shadowRoot!.querySelectorAll('[part="error-row"]');
    expect(errorRows.length).to.equal(1);
    const cell = errorRows[0]!.querySelector('[part="error-cell"]')!;
    expect(cell.querySelector('lr-empty[part="error"]')).to.exist;
    expect(cell.querySelector('[part="retry-button"]')).to.exist;
  });

  it('lets `error` take precedence over the no-columns and no-rows empty branches', async () => {
    const noColumns = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      label="People" .rowKey=${'id'} .columns=${[]} .data=${[]} error
    ></lr-data-grid>`);
    await noColumns.updateComplete;
    expect(noColumns.shadowRoot!.querySelector('[part="error-row"]')).to.exist;
    expect(noColumns.shadowRoot!.querySelector('lr-empty[part="empty"]') === null).to.equal(true);

    const noRows = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      label="People" .rowKey=${'id'} .columns=${errorColumns} .data=${[]} error
    ></lr-data-grid>`);
    await noRows.updateComplete;
    expect(noRows.shadowRoot!.querySelector('[part="error-row"]')).to.exist;
    expect(noRows.shadowRoot!.querySelector('lr-empty[part="empty"]') === null).to.equal(true);
  });

  it('lets `loading` take precedence over `error`', async () => {
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      label="People" .rowKey=${'id'} .columns=${errorColumns} .data=${[row]} error loading
    ></lr-data-grid>`);
    await element.updateComplete;

    expect(element.shadowRoot!.querySelector('[part="loading-overlay"]')).to.exist;
    expect(element.shadowRoot!.querySelector('[part="error-row"]') === null).to.equal(true);
  });

  it('lets errorHeading/errorDescription override the built-in copy verbatim', async () => {
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      label="People" .rowKey=${'id'} .columns=${errorColumns} .data=${[row]} error
      error-heading="Network unavailable" error-description="Check your connection and retry."
    ></lr-data-grid>`);
    await element.updateComplete;

    const empty = element.shadowRoot!.querySelector('lr-empty[part="error"]')!;
    expect(empty.getAttribute('heading')).to.equal('Network unavailable');
    expect(empty.getAttribute('description')).to.equal('Check your connection and retry.');
  });

  it('emits a cancelable lr-retry and only clears `error` when the default action runs', async () => {
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      label="People" .rowKey=${'id'} .columns=${errorColumns} .data=${[row]} error
    ></lr-data-grid>`);
    await element.updateComplete;
    const retryButton = element.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!;

    let received: CustomEvent | undefined;
    const vetoListener = (event: Event): void => {
      received = event as CustomEvent;
      event.preventDefault();
    };
    element.addEventListener('lr-retry', vetoListener);
    retryButton.click();
    expect(received?.cancelable).to.equal(true);
    expect(received?.defaultPrevented).to.equal(true);
    expect(element.error, 'a vetoed retry must not clear error').to.equal(true);
    element.removeEventListener('lr-retry', vetoListener);

    retryButton.click();
    expect(element.error, 'the default action clears error').to.equal(false);
  });

  it('lets the error slot override the built-in failed-load content', async () => {
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      label="People" .rowKey=${'id'} .columns=${errorColumns} .data=${[row]} error
    ><div slot="error">Custom failure UI</div></lr-data-grid>`);
    await element.updateComplete;

    const slot = element.shadowRoot!.querySelector('slot[name="error"]') as HTMLSlotElement;
    expect(slot != null, 'expected an `error` slot while `error` is set').to.equal(true);
    expect(slot.assignedElements().map((node) => node.textContent)).to.deep.equal(['Custom failure UI']);
    const builtIn = element.shadowRoot!.querySelector('[part~="error"]') as HTMLElement;
    expect(builtIn.getClientRects().length).to.equal(0);
  });

  it("forwards the error lr-empty's inner parts through error-prefixed exportparts", async () => {
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      label="People" .rowKey=${'id'} .columns=${errorColumns} .data=${[row]} error
    ></lr-data-grid>`);
    await element.updateComplete;

    const exported = element.shadowRoot!.querySelector('[part~="error"]')!.getAttribute('exportparts') ?? '';
    expect(exported).to.contain('base:error-base');
    expect(exported).to.contain('icon:error-icon');
    expect(exported).to.contain('heading:error-heading');
    expect(exported).to.contain('description:error-description');
    expect(exported).to.contain('actions:error-actions');
  });

  it('does not set `error` itself when the internal dataSource request rejects, keeping prior rows rendered', async () => {
    const failure = new Error('offline');
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      label="People" server .rowKey=${'id'} .columns=${errorColumns} .data=${[row]}
      .dataSource=${async () => { throw failure; }}
    ></lr-data-grid>`);
    const errorEvent = new Promise<CustomEvent>((resolve) => {
      element.addEventListener('lr-data-error', (event) => resolve(event as CustomEvent), { once: true });
    });
    await element.reload();
    await errorEvent;
    expect(element.error, 'lr-data-error alone must not flip the built-in error state').to.equal(false);
    expect(element.data).to.deep.equal([row]);
  });

  it('is accessible in the error state', async () => {
    const element = await fixture<LyraDataGrid<Row>>(html`<lr-data-grid
      label="People" .rowKey=${'id'} .columns=${errorColumns} .data=${[row]} error
    ></lr-data-grid>`);
    await element.updateComplete;
    await expect(element).to.be.accessible();
  });
});
