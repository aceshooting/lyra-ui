import { fixture, html, waitUntil } from '@open-wc/testing';
import { hoverUntilMatched, resetMouse, sendMouse } from './wtr-mouse.js';
import '../src/components/data/data-grid/data-grid.js';
import type { LyraDataGrid } from '../src/components/data/data-grid/data-grid.js';
import type { DataGridColumn } from '../src/components/data/data-grid/data-grid-types.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../src/internal/announcer.js';


export interface Person {
  id: number;
  name: string;
  team: string;
  score: number;
  tags?: string[];
  children?: Person[];
}

export const columns: DataGridColumn<Person>[] = [
  { field: "name", label: "Name" },
  { field: "team", label: "Team", filterable: true },
  { field: "score", label: "Score" },
];

export const rows: Person[] = [
  { id: 1, name: "Ada", team: "Compiler", score: 7 },
  { id: 2, name: "Lin", team: "Runtime", score: 10 },
  { id: 3, name: "Grace", team: "Compiler", score: 9 },
];

export async function dataGrid<Row = Person>(
  template = html`<lr-data-grid label="People"></lr-data-grid>`
): Promise<LyraDataGrid<Row>> {
  const element = (await fixture(template)) as unknown as LyraDataGrid<Row>;
  await element.updateComplete;
  return element;
}

export interface DataGridTestAccess {
  setColumnWidth(
    id: string,
    width: number,
    emit: boolean,
    finished?: boolean
  ): void;
  pinOffset(id: string, side: 'left' | 'right'): number;
}

export function access<Row>(element: LyraDataGrid<Row>): DataGridTestAccess {
  return element as unknown as DataGridTestAccess;
}

export interface DataGridMeasurementTestAccess {
  measuredItemHeights: Map<string, number>;
  measuredItemOffsetsDirty: boolean;
  measurementLocale: string;
  measurementDisplaySignature: string;
  measurementRowHeight?: number;
  lastMeasurementAnchor?: {
    readonly itemKey: string;
    readonly offset: number;
  };
  pendingMeasurementAnchor?: {
    readonly itemKey: string;
    readonly offset: number;
  };
  pendingVirtualScroll?: {
    readonly itemKey: string;
    readonly align: 'start' | 'center' | 'end' | 'nearest';
  };
  measurementUpdateQueued: boolean;
  reconcileRowMeasurementCache(changed: Map<PropertyKey, unknown>): void;
  correctMeasurementAnchor(): void;
  alignPendingVirtualScroll(): void;
  recordMeasuredBodyWidth(width: unknown): boolean;
  measureRenderedItems(): void;
}

export function measurementAccess<Row>(
  element: LyraDataGrid<Row>
): DataGridMeasurementTestAccess {
  return element as unknown as DataGridMeasurementTestAccess;
}

export const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export function sinkElement(
  politeness: "polite" | "assertive",
  doc: Document = document
): HTMLElement | null {
  return doc.querySelector<HTMLElement>(
    `[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${politeness}"]`
  );
}

export function sinkTexts(
  politeness: "polite" | "assertive",
  doc: Document = document
): string[] {
  const element = sinkElement(politeness, doc);
  return element
    ? Array.from(element.children).map((child) => child.textContent ?? "")
    : [];
}

export function header<Row>(element: LyraDataGrid<Row>, id: string): HTMLElement {
  const result = element.shadowRoot!.querySelector<HTMLElement>(
    `[part~="header-cell"][data-column-id="${id}"]`
  );
  if (!result) throw new Error(`Missing ${id} header`);
  return result;
}

export function dataCells<Row>(element: LyraDataGrid<Row>): HTMLElement[] {
  return [
    ...element.shadowRoot!.querySelectorAll<HTMLElement>(
      '[part~="cell"][data-row-position]'
    ),
  ];
}

export interface CellValueRow {
  id: number;
  value: unknown;
}

export async function valueGrid(
  data: CellValueRow[]
): Promise<LyraDataGrid<CellValueRow>> {
  const valueColumns: DataGridColumn<CellValueRow>[] = [
    { field: "value", label: "Value" },
  ];
  const element = (await fixture(html`
    <lr-data-grid
      label="Values"
      .columns=${valueColumns}
      .data=${data}
    ></lr-data-grid>
  `)) as LyraDataGrid<CellValueRow>;
  await element.updateComplete;
  return element;
}

export async function expectInteractionTokens(style: string, retired = false): Promise<void> {
  const element = await dataGrid(html`
    <lr-data-grid
      label="Interaction tokens"
      paginate
      resizable
      style=${style}
      .columns=${columns}
      .data=${rows}
    ></lr-data-grid>
  `);
  const row = element.shadowRoot!.querySelector<HTMLElement>('[part~="row"]')!;
  const handle = element.shadowRoot!.querySelector<HTMLElement>(
    '[part="resize-handle"]'
  )!;
  const sortableHeader = element.shadowRoot!.querySelector<HTMLElement>(
    '[part~="header-cell"][data-sortable]'
  )!;
  const pageSize = element.shadowRoot!.querySelector<HTMLElement>(
    '[part="page-size"]'
  )!;

  try {
    await hoverUntilMatched(row, 'the data row never registered :hover');
    await waitUntil(() => getComputedStyle(row).backgroundColor === 'rgb(1, 2, 3)');
    await sendMouse({ type: 'down' });
    await waitUntil(() => row.matches(':active'));
    await waitUntil(() => (getComputedStyle(row).backgroundColor === 'rgb(4, 5, 6)') !== retired);
    await sendMouse({ type: 'up' });

    await hoverUntilMatched(handle, 'the resize control never registered :hover');
    await waitUntil(() => (getComputedStyle(handle).backgroundColor === 'rgb(7, 8, 9)') !== retired);
    await sendMouse({ type: 'down' });
    await waitUntil(() => handle.matches(':active'));
    await waitUntil(() => (getComputedStyle(handle).backgroundColor === 'rgb(10, 11, 12)') !== retired);
    await sendMouse({ type: 'up' });

    await hoverUntilMatched(sortableHeader, 'the sortable header never registered :hover');
    await waitUntil(() => (getComputedStyle(sortableHeader).backgroundColor === 'rgb(13, 14, 15)') !== retired);
    await sendMouse({ type: 'down' });
    await waitUntil(() => sortableHeader.matches(':active'));
    await waitUntil(() => (getComputedStyle(sortableHeader).backgroundColor === 'rgb(16, 17, 18)') !== retired);
    await sendMouse({ type: 'up' });

    await hoverUntilMatched(pageSize, 'the page-size control never registered :hover');
    await waitUntil(() => (getComputedStyle(pageSize).backgroundColor === 'rgb(7, 8, 9)') !== retired);
    await sendMouse({ type: 'down' });
    await waitUntil(() => pageSize.matches(':active'));
    await waitUntil(() => (getComputedStyle(pageSize).backgroundColor === 'rgb(19, 20, 21)') !== retired);
  } finally {
    await sendMouse({ type: 'up' });
    await resetMouse();
  }
}
