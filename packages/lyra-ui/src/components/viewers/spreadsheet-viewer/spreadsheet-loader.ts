import { createOptionalPeerLoader } from '../../../internal/optional-peer-capabilities.js';

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

const sheetJs = /* @__PURE__ */ createOptionalPeerLoader<SheetJsApi>({
  load: () => import('xlsx'),
  isCapability: isSheetJsApi,
  warningKey: SPREADSHEET_WARNING_KEY,
  warning: SPREADSHEET_WARNING,
});

export function loadSheetJs(importXlsx?: () => Promise<unknown>): Promise<SheetJsApi | null> {
  return sheetJs.loadWith(importXlsx);
}

export function loadSheetJsCached(): Promise<SheetJsApi | null> {
  return sheetJs.get();
}

export function clearSheetJsCache(): void { sheetJs.clear(); }
