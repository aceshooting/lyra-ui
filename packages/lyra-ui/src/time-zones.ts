export interface LyraTimeZoneEntry {
  readonly code: string;
  readonly label?: string;
  readonly group?: string;
  readonly disabled?: boolean;
}
export type LyraTimeZoneCatalog = readonly string[] | readonly LyraTimeZoneEntry[];

/**
 * UTC followed by the runtime's sorted primary IANA time-zone identifiers.
 * Uses ECMA-402 Intl.supportedValuesOf; an older runtime without it offers UTC.
 * This list depends on the runtime's time-zone data, not the user's current zone.
 * Pass the same explicit catalog on server and client for a fixed SSR inventory.
 */
export function getTimeZoneCodes(): readonly string[] {
  let codes: string[] = [];
  try { codes = Intl.supportedValuesOf('timeZone'); }
  catch { /* UTC is always available independently of the optional catalog API. */ }
  return Object.freeze(['UTC', ...new Set(codes.filter((code) => code !== 'UTC'))].slice(0, 1024));
}
