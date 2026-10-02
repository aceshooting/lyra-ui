export interface LyraCurrencyEntry {
  readonly code: string;
  readonly label?: string;
  readonly symbol?: string;
  readonly disabled?: boolean;
  readonly group?: string;
}

export type LyraCurrencyCatalog = readonly string[] | readonly LyraCurrencyEntry[];

/** Localized display data for one currency; caller labels and symbols take precedence. */
export interface LyraCurrencyDisplayEntry {
  readonly code: string;
  readonly label: string;
  readonly symbol: string;
  readonly narrowSymbol: string;
  readonly disabled: boolean;
  readonly group?: string;
}
