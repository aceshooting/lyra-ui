import { unwrapOptionalPeerDefault } from '../../../internal/optional-peer-capabilities.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';

const SPREADSHEET_WARNING_KEY = 'lyra-spreadsheet-viewer-xlsx-unavailable';
const SPREADSHEET_WARNING = '<lr-spreadsheet-viewer> could not load its optional xlsx peer.';

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
  } catch {
    devWarnOnce(SPREADSHEET_WARNING_KEY, SPREADSHEET_WARNING);
    return null;
  }
}

export function loadSheetJsCached(): Promise<SheetJsApi | null> {
  if (!cached) cached = loadSheetJs();
  return cached;
}

export function clearSheetJsCache(): void { cached = undefined; }
