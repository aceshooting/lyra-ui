import type { DocxAction, DocxResult, DocxTableAction, DocxImageAction } from './types.js';
import { isSafeDocxHyperlink } from './hyperlink-policy.js';
import { isDocxXmlText } from './xml-text.js';

export const DOCX_LIMITS = Object.freeze({
  styleId: 128, styleLabel: 128, styles: 256, fonts: 128, fontFamily: 64,
  href: 2048, text: 4096, query: 256, matches: 100, context: 48,
  imagePoints: 1440, imageTitle: 256, imageDescription: 2048,
  tableRows: 20, tableColumns: 20, tableCells: 400,
});
const invalid = Object.freeze({ ok: false, code: 'invalid-option' } as const);
const limited = Object.freeze({ ok: false, code: 'resource-limit' } as const);
const unsupported = Object.freeze({ ok: false, code: 'unsupported' } as const);
const FONT_FAMILY = /^[\p{L}\p{N}\p{M} \-.+_]{1,64}$/u;
const success = <T>(value: T): DocxResult<T> => Object.freeze({ ok: true, value });

/** Only own data properties cross the command boundary; caller getters are never invoked. */
function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const copy: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return null;
    copy[key] = descriptor.value;
  }
  return copy;
}
function keys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Reflect.ownKeys(value).every(key => typeof key === 'string' && allowed.includes(key));
}
function text(value: unknown, limit: number, empty = false): DocxResult<string> {
  if (typeof value !== 'string' || (!empty && !value.length)) return invalid;
  return value.length > limit ? limited : success(value);
}
function authoredText(value: unknown): DocxResult<string> {
  const bounded = text(value, DOCX_LIMITS.text, true);
  return bounded.ok && !isDocxXmlText(bounded.value) ? invalid : bounded;
}

/** Validate and copy a Lyra action before any engine capability or mutation call. */
export function normalizeDocxAction(value: unknown): DocxResult<DocxAction> {
  try {
    if (typeof value === 'string') {
      return value === 'bold' || value === 'italic' || value === 'underline' || value === 'undo' || value === 'redo'
        ? success(value) : unsupported;
    }
    const action = record(value);
    if (!action || typeof action.type !== 'string') return invalid;
    const type = action.type;
    switch (type) {
      case 'resize-image': {
        if (!keys(action, ['type', 'widthPoints', 'heightPoints'])) return invalid;
        for (const value of [action.widthPoints, action.heightPoints]) {
          if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) return invalid;
          if (value > DOCX_LIMITS.imagePoints) return limited;
        }
        return success(Object.freeze({ type, widthPoints: action.widthPoints as number, heightPoints: action.heightPoints as number }));
      }
      case 'image-description': {
        if (!keys(action, ['type', 'title', 'description'])) return invalid;
        const title = text(action.title, DOCX_LIMITS.imageTitle, true);
        if (!title.ok) return title;
        const description = text(action.description, DOCX_LIMITS.imageDescription, true);
        if (!description.ok) return description;
        if (!isDocxXmlText(title.value) || !isDocxXmlText(description.value)) return invalid;
        return success(Object.freeze({ type, title: title.value, description: description.value }));
      }
      case 'delete-image':
        return keys(action, ['type']) ? success(Object.freeze({ type })) : invalid;
      case 'insert-table': {
        if (!keys(action, ['type', 'rows', 'columns']) || typeof action.rows !== 'number' ||
          typeof action.columns !== 'number' || !Number.isSafeInteger(action.rows) ||
          !Number.isSafeInteger(action.columns) || action.rows < 1 || action.columns < 1) return invalid;
        if (action.rows > DOCX_LIMITS.tableRows || action.columns > DOCX_LIMITS.tableColumns ||
          action.rows * action.columns > DOCX_LIMITS.tableCells) return limited;
        return success(Object.freeze({ type, rows: action.rows, columns: action.columns }));
      }
      case 'insert-table-row':
        if (!keys(action, ['type', 'where']) || (action.where !== 'above' && action.where !== 'below')) return invalid;
        return success(Object.freeze({ type, where: action.where }));
      case 'insert-table-column':
        if (!keys(action, ['type', 'where']) || (action.where !== 'left' && action.where !== 'right')) return invalid;
        return success(Object.freeze({ type, where: action.where }));
      case 'delete-table-row':
      case 'delete-table-column':
      case 'delete-table':
        return keys(action, ['type']) ? success(Object.freeze({ type })) : invalid;
      case 'paragraph-style': {
        if (!keys(action, ['type', 'styleId'])) return invalid;
        const id = text(action.styleId, DOCX_LIMITS.styleId);
        return id.ok ? success(Object.freeze({ type, styleId: id.value })) : id;
      }
      case 'alignment':
        if (!keys(action, ['type', 'value']) ||
          (action.value !== 'left' && action.value !== 'center' && action.value !== 'right' && action.value !== 'justify')) return invalid;
        return success(Object.freeze({ type, value: action.value }));
      case 'toggle-list':
        if (!keys(action, ['type', 'kind']) || (action.kind !== 'bullet' && action.kind !== 'numbered')) return invalid;
        return success(Object.freeze({ type, kind: action.kind }));
      case 'font-family': {
        if (!keys(action, ['type', 'family']) || typeof action.family !== 'string') return invalid;
        // Each Unicode code point has at most two UTF-16 code units; bound allocation before counting.
        if (action.family.length > DOCX_LIMITS.fontFamily * 2 || [...action.family].length > DOCX_LIMITS.fontFamily) return limited;
        if (!FONT_FAMILY.test(action.family)) return invalid;
        return success(Object.freeze({ type, family: action.family }));
      }
      case 'font-size':
        if (!keys(action, ['type', 'points']) || typeof action.points !== 'number' ||
          !Number.isFinite(action.points) || action.points < 1 || action.points > 1638 || !Number.isInteger(action.points * 2)) return invalid;
        return success(Object.freeze({ type, points: action.points }));
      case 'text-color':
        if (!keys(action, ['type', 'color']) || typeof action.color !== 'string' ||
          (action.color !== 'auto' && !/^#[0-9a-f]{6}$/i.test(action.color))) return invalid;
        return success(Object.freeze({ type, color: action.color === 'auto' ? 'auto' : action.color.toUpperCase() }));
      case 'link': {
        if (!keys(action, ['type', 'href', 'text'])) return invalid;
        const href = text(action.href, DOCX_LIMITS.href);
        if (!href.ok) return href;
        if (!isSafeDocxHyperlink(href.value)) return invalid;
        if (action.text === undefined) return success(Object.freeze({ type, href: href.value }));
        const label = authoredText(action.text);
        return label.ok ? success(Object.freeze({ type, href: href.value, text: label.value })) : label;
      }
      case 'remove-link':
        return keys(action, ['type']) ? success(Object.freeze({ type })) : invalid;
      default:
        return unsupported;
    }
  } catch { return invalid; }
}

/** Validate a literal search without scanning or retaining document content. */
export function normalizeDocxSearch(query: unknown, options?: unknown): DocxResult<Readonly<{
  query: string; matchCase: boolean; wholeWord: boolean; limit: number;
}>> {
  try {
    const checked = text(query, DOCX_LIMITS.query);
    if (!checked.ok) return checked;
    const values = options === undefined ? Object.create(null) as Record<string, unknown> : record(options);
    if (!values || !keys(values, ['matchCase', 'wholeWord', 'limit'])) return invalid;
    const matchCase = values.matchCase === undefined ? false : values.matchCase;
    const wholeWord = values.wholeWord === undefined ? false : values.wholeWord;
    const limit = values.limit === undefined ? DOCX_LIMITS.matches : values.limit;
    if (typeof matchCase !== 'boolean' || typeof wholeWord !== 'boolean' || typeof limit !== 'number' ||
      !Number.isSafeInteger(limit) || limit < 1) return invalid;
    if (limit > DOCX_LIMITS.matches) return limited;
    return success(Object.freeze({ query: checked.value, matchCase, wholeWord, limit }));
  } catch { return invalid; }
}

/** Empty replacement is deliberate deletion; whitespace and authored Unicode are preserved. */
export function normalizeDocxReplacement(value: unknown): DocxResult<string> {
  return authoredText(value);
}

export function isDocxTableAction(action: DocxAction): action is DocxTableAction {
  return typeof action !== 'string' && (action.type === 'insert-table' || action.type === 'insert-table-row' ||
    action.type === 'insert-table-column' || action.type === 'delete-table-row' ||
    action.type === 'delete-table-column' || action.type === 'delete-table');
}

export function isDocxImageAction(action: DocxAction): action is DocxImageAction {
  return typeof action !== 'string' && (action.type === 'resize-image' || action.type === 'image-description' || action.type === 'delete-image');
}
