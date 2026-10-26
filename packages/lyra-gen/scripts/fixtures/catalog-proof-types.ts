import type { LyraSelect } from '../../../lyra-ui/src/components/forms/select/select.class.js';
import type { LyraTable, TableColumn } from '../../../lyra-ui/src/components/data/table/table.class.js';

/** Concrete host choices made by the reviewed catalog, not arbitrary consumer generics. */
export type CatalogSelectValue = LyraSelect<false>['value'];
export type CatalogColumnKey = `c${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15}`;
export type CatalogTableRow = Partial<Record<CatalogColumnKey, string | number | boolean | null>>;
export type CatalogTableRows = LyraTable<CatalogTableRow>['rows'];
export type CatalogTableColumns = LyraTable<CatalogTableRow>['columns'];
export type CatalogSerializedColumns = readonly Omit<TableColumn<CatalogTableRow>, 'cell'>[];
export type CatalogPreparedColumns = readonly {
  key: CatalogColumnKey;
  label: string;
  sortable?: boolean;
  cell: (row: unknown) => string;
}[];
