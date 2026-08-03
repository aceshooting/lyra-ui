import { unwrapOptionalPeerDefault } from '../../../internal/optional-peer-capabilities.js';

export interface SheetJsWorkbook {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
}

export interface SheetJsApi {
  read(input: ArrayBuffer, options?: Record<string, unknown>): SheetJsWorkbook;
  utils: {
    sheet_to_json(sheet: unknown, options?: Record<string, unknown>): unknown;
  };
}
let cached: Promise<SheetJsApi | null> | undefined;

function isSheetJsApi(candidate: unknown): candidate is SheetJsApi {
  const api = candidate as {
    read?: unknown;
    utils?: { sheet_to_json?: unknown };
  } | null;
  return Boolean(
    api &&
    typeof api.read === 'function' &&
    typeof api.utils?.sheet_to_json === 'function'
  );
}

export async function loadSheetJs(
  importXlsx: () => Promise<unknown> = () => import('xlsx'),
): Promise<SheetJsApi | null> {
  try {
    const module = await importXlsx();
    if (isSheetJsApi(module)) return module;
    const candidate = unwrapOptionalPeerDefault(module);
    return isSheetJsApi(candidate) ? candidate : null;
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
