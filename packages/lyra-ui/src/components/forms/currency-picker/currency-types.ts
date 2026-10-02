export interface LyraCurrencyEntry {
  readonly code: string;
  readonly label?: string;
  readonly symbol?: string;
  readonly disabled?: boolean;
}

export type LyraCurrencyCatalog = readonly string[] | readonly LyraCurrencyEntry[];
