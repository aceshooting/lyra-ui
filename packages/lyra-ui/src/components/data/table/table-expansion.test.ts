import { expect, fixture, html, oneEvent } from '@open-wc/testing';
import { nothing } from 'lit';
import { sendKeys } from '@web/test-runner-commands';
import './table.js';
import type { LyraTable, LyraTableEventMap, TableColumn } from './table.js';

interface Row {
  id: string;
  name: string;
}

interface NumericRow {
  id: number;
  name: string;
}

const rows: Row[] = [
  { id: 'a', name: 'Alpha' },
  { id: 'b', name: 'Beta' },
  { id: 'c', name: 'Gamma' },
];

const columns: TableColumn<Row>[] = [
  { key: 'name', label: 'Name', cell: (row) => row.name },
  { key: 'id', label: 'Id', cell: (row) => row.id },
];

const rowKey = (row: Row) => row.id;
const expandedContent = (row: Row) => html`<p class="panel">${row.name} details</p>`;

/** Omits `expansion-mode` entirely when `mode` is left out, so the default-mode assertions read an
 *  element that was never configured rather than one pinned to the default. */
async function expandable(
  mode?: 'none' | 'single' | 'multiple',
): Promise<LyraTable<Row>> {
  const element = await fixture<LyraTable<Row>>(html`<lr-table
    caption="Names"
    expansion-mode=${mode ?? nothing}
    .rows=${rows}
    .columns=${columns}
    .rowKey=${rowKey}
    .expandedContent=${expandedContent}
  ></lr-table>`);
  await element.updateComplete;
  return element;
}

function toggleButtons(element: LyraTable<Row>): HTMLButtonElement[] {
  return [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="row-expand-toggle"]')];
}

function expandedPanelTexts(element: LyraTable<Row>): string[] {
  return [...element.shadowRoot!.querySelectorAll('[part="expanded-cell"] .panel')].map(
    (node) => node.textContent ?? '',
  );
}

describe('lr-table self-managed expansion', () => {
  it('leaves expandedRowKeys controlled and emits no request event in the default none mode', async () => {
    const element = await expandable();
    let requests = 0;
    element.addEventListener('lr-row-expand-request', () => (requests += 1));
    const toggled = oneEvent(element, 'lr-row-expand-toggle');
    toggleButtons(element)[0]!.click();
    const event = await toggled;

    expect(element.expansionMode).to.equal('none');
    expect(requests).to.equal(0);
    expect(event.detail.rowKey).to.equal('a');
    expect(event.detail.expanded).to.equal(true);
    expect([...element.expandedRowKeys]).to.deep.equal([]);
    await element.updateComplete;
    expect(expandedPanelTexts(element)).to.deep.equal([]);
  });

  it('falls back to the controlled behaviour for an unrecognized expansion-mode value', async () => {
    const element = await expandable();
    element.setAttribute('expansion-mode', 'sometimes');
    await element.updateComplete;
    let requests = 0;
    element.addEventListener('lr-row-expand-request', () => (requests += 1));

    const toggled = oneEvent(element, 'lr-row-expand-toggle');
    toggleButtons(element)[0]!.click();
    await toggled;
    await element.updateComplete;

    expect(requests).to.equal(0);
    expect([...element.expandedRowKeys]).to.deep.equal([]);
  });

  it('updates expandedRowKeys itself in multiple mode with no host-side handler', async () => {
    const element = await expandable('multiple');
    toggleButtons(element)[0]!.click();
    await element.updateComplete;
    toggleButtons(element)[2]!.click();
    await element.updateComplete;

    expect([...element.expandedRowKeys]).to.deep.equal(['a', 'c']);
    expect(expandedPanelTexts(element)).to.deep.equal(['Alpha details', 'Gamma details']);
    expect(toggleButtons(element)[0]!.getAttribute('aria-expanded')).to.equal('true');
    expect(toggleButtons(element)[1]!.getAttribute('aria-expanded')).to.equal('false');

    toggleButtons(element)[0]!.click();
    await element.updateComplete;
    expect([...element.expandedRowKeys]).to.deep.equal(['c']);
  });

  it('keeps at most one expanded row in single mode', async () => {
    const element = await expandable('single');
    toggleButtons(element)[0]!.click();
    await element.updateComplete;
    toggleButtons(element)[1]!.click();
    await element.updateComplete;

    expect([...element.expandedRowKeys]).to.deep.equal(['b']);
    expect(expandedPanelTexts(element)).to.deep.equal(['Beta details']);
  });

  it('reports the row single mode displaced with its own collapse toggle, before the accepted one', async () => {
    const element = await expandable('single');
    toggleButtons(element)[0]!.click();
    await element.updateComplete;
    expect([...element.expandedRowKeys]).to.deep.equal(['a']);

    // `lr-row-expand-toggle` is the only per-row expansion event there is, so a host mirroring
    // open rows from it alone has to hear about the row that was closed to make room -- reading
    // the already-settled set from both dispatches.
    const seen: string[] = [];
    element.addEventListener('lr-row-expand-toggle', (event) => {
      seen.push(
        `${String(event.detail.rowKey)}:${String(event.detail.expanded)}:${[
          ...element.expandedRowKeys,
        ].join(',')}`,
      );
    });
    toggleButtons(element)[1]!.click();
    await element.updateComplete;

    expect(seen).to.deep.equal(['a:false:b', 'b:true:b']);
    expect([...element.expandedRowKeys]).to.deep.equal(['b']);
  });

  it('emits no displaced toggle when single mode closes the only open row', async () => {
    const element = await expandable('single');
    toggleButtons(element)[0]!.click();
    await element.updateComplete;

    const seen: string[] = [];
    element.addEventListener('lr-row-expand-toggle', (event) => {
      seen.push(`${String(event.detail.rowKey)}:${String(event.detail.expanded)}`);
    });
    toggleButtons(element)[0]!.click();
    await element.updateComplete;

    expect(seen).to.deep.equal(['a:false']);
    expect([...element.expandedRowKeys]).to.deep.equal([]);
  });

  it('leaves a displaced off-view row to expandedRowKeys, having no row object to report', async () => {
    const element = await expandable('single');
    toggleButtons(element)[0]!.click();
    await element.updateComplete;
    element.filterText = 'Beta';
    await element.updateComplete;
    expect([...element.expandedRowKeys]).to.deep.equal(['a']);

    const seen: string[] = [];
    element.addEventListener('lr-row-expand-toggle', (event) => {
      seen.push(`${String(event.detail.rowKey)}:${String(event.detail.expanded)}`);
    });
    toggleButtons(element)[0]!.click();
    await element.updateComplete;

    // Documented boundary: 'a' is filtered out, so there is no `row` for a detail to carry.
    expect(seen).to.deep.equal(['b:true']);
    expect([...element.expandedRowKeys]).to.deep.equal(['b']);
  });

  it('emits no displaced toggle in multiple mode, where nothing is displaced', async () => {
    const element = await expandable('multiple');
    toggleButtons(element)[0]!.click();
    await element.updateComplete;

    const seen: string[] = [];
    element.addEventListener('lr-row-expand-toggle', (event) => {
      seen.push(`${String(event.detail.rowKey)}:${String(event.detail.expanded)}`);
    });
    toggleButtons(element)[1]!.click();
    await element.updateComplete;

    expect(seen).to.deep.equal(['b:true']);
    expect([...element.expandedRowKeys]).to.deep.equal(['a', 'b']);
  });

  it('coerces an over-large expandedRowKeys down to one key when expansionMode becomes single', async () => {
    const element = await expandable('multiple');
    element.expandedRowKeys = new Set(['a', 'b']);
    await element.updateComplete;
    expect([...element.expandedRowKeys]).to.deep.equal(['a', 'b']);

    element.expansionMode = 'single';
    await element.updateComplete;
    expect([...element.expandedRowKeys]).to.deep.equal(['a']);
    expect(expandedPanelTexts(element)).to.deep.equal(['Alpha details']);
  });

  it('leaves expandedRowKeys untouched and emits no toggle when the request is prevented', async () => {
    const element = await expandable('multiple');
    element.addEventListener('lr-row-expand-request', (event) => event.preventDefault());
    let toggles = 0;
    element.addEventListener('lr-row-expand-toggle', () => (toggles += 1));

    const requested = oneEvent(element, 'lr-row-expand-request');
    toggleButtons(element)[0]!.click();
    const request = await requested;
    await element.updateComplete;

    expect(request.cancelable).to.equal(true);
    expect(request.detail.rowKey).to.equal('a');
    expect(request.detail.expanded).to.equal(true);
    expect(toggles).to.equal(0);
    expect([...element.expandedRowKeys]).to.deep.equal([]);
    expect(expandedPanelTexts(element)).to.deep.equal([]);
  });

  it('emits the request before the toggle and writes expandedRowKeys between them', async () => {
    const element = await expandable('multiple');
    const order: string[] = [];
    element.addEventListener('lr-row-expand-request', () => {
      order.push(`request:${[...element.expandedRowKeys].join(',')}`);
    });
    element.addEventListener('lr-row-expand-toggle', () => {
      order.push(`toggle:${[...element.expandedRowKeys].join(',')}`);
    });
    toggleButtons(element)[1]!.click();
    await element.updateComplete;

    expect(order).to.deep.equal(['request:', 'toggle:b']);
  });

  it('expands from a keyboard activation on the focused toggle', async () => {
    const element = await expandable('multiple');
    toggleButtons(element)[1]!.focus();
    await sendKeys({ press: 'Enter' });
    await element.updateComplete;

    expect([...element.expandedRowKeys]).to.deep.equal(['b']);
    expect(expandedPanelTexts(element)).to.deep.equal(['Beta details']);
  });

  it('self-manages identically under dir="rtl"', async () => {
    const element = await fixture<LyraTable<Row>>(html`<lr-table
      dir="rtl"
      caption="Names"
      expansion-mode="single"
      .rows=${rows}
      .columns=${columns}
      .rowKey=${rowKey}
      .expandedContent=${expandedContent}
    ></lr-table>`);
    await element.updateComplete;
    toggleButtons(element)[2]!.click();
    await element.updateComplete;

    expect([...element.expandedRowKeys]).to.deep.equal(['c']);
    expect(expandedPanelTexts(element)).to.deep.equal(['Gamma details']);
  });

  it('retains an off-view expanded key across a filter round trip', async () => {
    const element = await expandable('multiple');
    toggleButtons(element)[0]!.click();
    await element.updateComplete;
    expect([...element.expandedRowKeys]).to.deep.equal(['a']);

    element.filterText = 'Beta';
    await element.updateComplete;
    expect(expandedPanelTexts(element)).to.deep.equal([]);
    expect([...element.expandedRowKeys]).to.deep.equal(['a']);

    element.filterText = '';
    await element.updateComplete;
    expect(expandedPanelTexts(element)).to.deep.equal(['Alpha details']);
  });

  it('passes an axe check with a self-managed row expanded', async () => {
    const element = await expandable('multiple');
    toggleButtons(element)[0]!.click();
    await element.updateComplete;
    await expect(element).to.be.accessible();
  });

  it('types every rowKey-carrying event detail with the key type parameter', async () => {
    const numericRows: NumericRow[] = [{ id: 1, name: 'One' }];
    const element = await fixture<LyraTable<NumericRow, number>>(html`<lr-table
      caption="Numbers"
      expansion-mode="multiple"
      .rows=${numericRows}
      .columns=${[{ key: 'name', label: 'Name', cell: (row: NumericRow) => row.name }]}
      .rowKey=${(row: NumericRow) => row.id}
      .expandedContent=${(row: NumericRow) => html`<p class="panel">${row.name}</p>`}
    ></lr-table>`);
    await element.updateComplete;

    let seen: number | undefined;
    element.addEventListener('lr-row-expand-toggle', (event) => {
      const detail: LyraTableEventMap<NumericRow, number>['lr-row-expand-toggle']['detail'] =
        event.detail;
      seen = detail.rowKey;
    });
    (element.shadowRoot!.querySelector('[part="row-expand-toggle"]') as HTMLButtonElement).click();
    await element.updateComplete;

    expect(seen).to.equal(1);
    expect([...element.expandedRowKeys]).to.deep.equal([1]);
  });
});

describe('lr-table row and cell lookup', () => {
  it('resolves a rendered row and cell from their documented data-key attributes', async () => {
    const element = await expandable();
    const row = element.rowElement('b');
    const cell = element.cellElement('b', 'name');

    expect(row !== null, 'rowElement("b") resolved a row').to.equal(true);
    expect(row!.localName).to.equal('tr');
    expect(row!.dataset['rowKey']).to.equal('string:b');
    expect(cell !== null, 'cellElement("b", "name") resolved a cell').to.equal(true);
    expect(cell!.localName).to.equal('td');
    expect(cell!.dataset['colKey']).to.equal('name');
    expect(cell!.textContent!.trim()).to.equal('Beta');
  });

  it('distinguishes a numeric key from the string that stringifies the same way', async () => {
    const mixedRows = [
      { id: 1, name: 'Numeric' },
      { id: '1', name: 'Textual' },
    ];
    const element = await fixture<LyraTable<{ id: string | number; name: string }>>(html`<lr-table
      caption="Mixed"
      .rows=${mixedRows}
      .columns=${[{ key: 'name', label: 'Name', cell: (row: { name: string }) => row.name }]}
      .rowKey=${(row: { id: string | number }) => row.id}
    ></lr-table>`);
    await element.updateComplete;

    expect(element.cellElement(1, 'name')?.textContent?.trim()).to.equal('Numeric');
    expect(element.cellElement('1', 'name')?.textContent?.trim()).to.equal('Textual');
  });

  it('returns null for a dangling key, an unknown column, and a row filtered out of view', async () => {
    const element = await expandable();
    expect(element.rowElement('missing') === null, 'unknown row key resolves to null').to.equal(true);
    expect(element.cellElement('a', 'missing') === null, 'unknown column key resolves to null').to.equal(
      true,
    );

    element.filterText = 'Beta';
    await element.updateComplete;
    expect(element.rowElement('a') === null, 'a filtered-out row resolves to null').to.equal(true);
    expect(element.rowElement('b') !== null, 'the matching row still resolves').to.equal(true);
  });

  it('reaches a node expandedContent rendered, which rowElement deliberately cannot', async () => {
    const element = await expandable('multiple');
    toggleButtons(element)[1]!.click();
    await element.updateComplete;

    const panel = element.expandedContentElement('b');
    expect(panel !== null, 'expandedContentElement("b") resolved a panel cell').to.equal(true);
    expect(panel!.localName).to.equal('td');
    expect(panel!.getAttribute('part')).to.equal('expanded-cell');
    // The capability the three documents promise: reach the consumer-rendered descendant that
    // `::part(expanded-cell) .panel` can never select, because only pseudo-classes may follow a
    // part selector.
    expect(panel!.querySelector('.panel')?.textContent?.trim()).to.equal('Beta details');

    // The panel is a sibling <tr> of the data row, not a descendant, so the row lookup cannot see
    // it -- which is exactly why this third method exists rather than a `rowElement()` query.
    const row = element.rowElement('b');
    expect(row !== null, 'rowElement("b") still resolved the data row').to.equal(true);
    expect(row!.dataset['rowKey']).to.equal('string:b');
    expect(row!.querySelector('.panel') === null, 'the data row holds no panel content').to.equal(
      true,
    );
    expect(row!.hasAttribute('data-expanded-row-key'), 'the data row carries no panel key').to.equal(
      false,
    );
  });

  it('returns null for a collapsed row, a dangling key, and a table with no expandedContent', async () => {
    const element = await expandable('multiple');
    expect(
      element.expandedContentElement('a') === null,
      'a collapsed row resolves to null',
    ).to.equal(true);

    toggleButtons(element)[0]!.click();
    await element.updateComplete;
    expect(
      element.expandedContentElement('missing') === null,
      'an unknown row key resolves to null',
    ).to.equal(true);

    const plain = await fixture<LyraTable<Row>>(html`<lr-table
      caption="Names"
      .rows=${rows}
      .columns=${columns}
      .rowKey=${rowKey}
    ></lr-table>`);
    await plain.updateComplete;
    expect(
      plain.expandedContentElement('a') === null,
      'a table with no expandedContent resolves to null',
    ).to.equal(true);
  });

  it('keeps a numeric panel key distinct from the string that stringifies the same way', async () => {
    const mixedRows = [
      { id: 1, name: 'Numeric' },
      { id: '1', name: 'Textual' },
    ];
    const element = await fixture<LyraTable<{ id: string | number; name: string }>>(html`<lr-table
      caption="Mixed"
      expansion-mode="multiple"
      .rows=${mixedRows}
      .columns=${[{ key: 'name', label: 'Name', cell: (row: { name: string }) => row.name }]}
      .rowKey=${(row: { id: string | number }) => row.id}
      .expandedContent=${(row: { name: string }) => html`<p class="panel">${row.name} details</p>`}
    ></lr-table>`);
    await element.updateComplete;
    [...element.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="row-expand-toggle"]')].forEach(
      (button) => button.click(),
    );
    await element.updateComplete;

    expect(element.expandedContentElement(1)?.textContent?.trim()).to.equal('Numeric details');
    expect(element.expandedContentElement('1')?.textContent?.trim()).to.equal('Textual details');
  });

  it('drops and re-resolves the panel across a pagination round trip', async () => {
    const element = await expandable('multiple');
    element.expandedRowKeys = new Set(['c']);
    element.pageSize = 1;
    await element.updateComplete;
    expect(
      element.expandedContentElement('c') === null,
      'an off-page panel resolves to null',
    ).to.equal(true);

    element.page = 3;
    await element.updateComplete;
    expect(element.expandedContentElement('c')?.textContent?.trim()).to.equal('Gamma details');
  });

  it('resolves the row a page later once updateComplete has settled', async () => {
    const element = await expandable();
    element.pageSize = 1;
    await element.updateComplete;
    expect(element.rowElement('c') === null, 'an off-page row resolves to null').to.equal(true);

    element.page = 3;
    await element.updateComplete;
    expect(element.rowElement('c') !== null, 'the paged-in row resolves').to.equal(true);
    expect(element.cellElement('c', 'name')?.textContent?.trim()).to.equal('Gamma');
  });
});
