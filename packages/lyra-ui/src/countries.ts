import { getDisplayNames } from './internal/intl-cache.js';
import { snapshotSelectionCatalog, type SelectionCatalogRow } from './internal/selection-catalog.js';

// ISO 3166-1 alpha-2 codes from IANA tzdb 2026e iso3166.tab (public domain).
// https://data.iana.org/time-zones/tzdb-2026e/iso3166.tab
// SHA-256: 837c80785080c8433fd9d4ea87e78f161ac7a40389301c5153d4f90198baeb2a
const countryCodes = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT',
  'AU', 'AW', 'AX', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI',
  'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS', 'BT', 'BV', 'BW', 'BY',
  'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM',
  'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK',
  'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL',
  'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR',
  'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN',
  'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS',
  'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW',
  'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP',
  'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM',
  'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM',
  'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF',
  'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT', 'TV', 'TW',
  'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW',
] as const;

/** A country or territory code in the library's pinned ISO catalog. */
export type LyraCountryCode = typeof countryCodes[number];
/** Frozen ISO alpha-2 catalog; display names are resolved separately for the chosen locale. */
export const COUNTRY_CODES: readonly LyraCountryCode[] = Object.freeze(countryCodes);

export interface LyraCountryEntry {
  readonly code: string;
  readonly label?: string;
  readonly group?: string;
  readonly disabled?: boolean;
}
export type LyraCountryCatalog = readonly string[] | readonly LyraCountryEntry[];

/** Display-only localization; explicit caller names and ordering remain authoritative. */
export function resolveCountryNames(countries: LyraCountryCatalog, locale: string): readonly SelectionCatalogRow[] {
  const entries = snapshotSelectionCatalog(countries, (code) => code.trim().toUpperCase(), (code) => /^[A-Z]{2}$/.test(code)) ?? [];
  return Object.freeze(entries.map((entry) => {
    let name = entry.code;
    try { name = getDisplayNames(locale, { type: 'region', fallback: 'code' }).of(entry.code) ?? entry.code; }
    catch { /* Unsupported custom codes retain their identifier. */ }
    const label = entry.label ?? name;
    return Object.freeze({ ...entry, label, searchText: [entry.code, name, label].join(' ') });
  }));
}
