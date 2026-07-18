import type { OptionalPeerApi } from '../../internal/optional-peer-types.js';

export type SheetJsApi = OptionalPeerApi;
let cached: Promise<SheetJsApi | null> | undefined;

export async function loadSheetJs(
  importXlsx: () => Promise<SheetJsApi | { default: SheetJsApi }> = () => import('xlsx'),
): Promise<SheetJsApi | null> {
  try {
    const module = await importXlsx();
    const candidate = (module as { default?: SheetJsApi }).default;
    return candidate && typeof candidate.read === 'function' ? candidate : module as SheetJsApi;
  } catch (error) {
    console.warn('<lr-spreadsheet-viewer> needs the optional peer dependency `xlsx` to parse workbooks — install it with `pnpm add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`:', error);
    return null;
  }
}

export function loadSheetJsCached(): Promise<SheetJsApi | null> {
  if (!cached) cached = loadSheetJs();
  return cached;
}

export function clearSheetJsCache(): void { cached = undefined; }
