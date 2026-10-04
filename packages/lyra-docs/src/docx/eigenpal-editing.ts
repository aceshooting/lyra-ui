import type { DocxEditorInstance, EditorCommand } from '@docx-editor.dev/core';
import { DOCX_LIMITS, normalizeDocxAction } from './commands.js';
import type { DocxAction, DocxTableAction, DocxImageAction, DocxCommandAvailability, DocxFormatting, DocxParagraphStyles, DocxResult } from './types.js';
import type { DocxEngineSearchOptions } from './engine-port.js';

/** Clip display context without dividing a UTF-16 surrogate pair. */
function clip(value: string, limit: number, tail = false): string {
  if (value.length <= limit) return value;
  if (tail) {
    let start = value.length - limit;
    if (value.charCodeAt(start) >= 0xdc00 && value.charCodeAt(start) <= 0xdfff) start++;
    return value.slice(start);
  }
  let end = limit;
  if (value.charCodeAt(end - 1) >= 0xd800 && value.charCodeAt(end - 1) <= 0xdbff) end--;
  return value.slice(0, end);
}

export function eigenpalCommand(action: Exclude<DocxAction, DocxTableAction | DocxImageAction>): EditorCommand {
  if (typeof action === 'string') return action === 'undo' || action === 'redo' ? { type: action } : { type: 'toggleMark', mark: action };
  switch (action.type) {
    case 'paragraph-style': return { type: 'setParagraphStyle', styleId: action.styleId };
    case 'alignment': return { type: 'setAlignment', align: action.value };
    case 'toggle-list': return { type: 'toggleList', kind: action.kind === 'numbered' ? 'ordered' : 'bullet' };
    case 'font-family': return { type: 'setMarkAttr', mark: 'fontFamily', attr: 'family', value: action.family };
    case 'font-size': return { type: 'setMarkAttr', mark: 'fontSize', attr: 'val', value: action.points * 2 };
    case 'text-color': return { type: 'setMarkAttr', mark: 'color', attr: 'val', value: action.color === 'auto' ? 'auto' : action.color.slice(1) };
    case 'link': return { type: 'insertHyperlink', href: action.href, ...(action.text === undefined ? {} : { text: action.text }) };
    case 'remove-link': return { type: 'removeHyperlink' };
  }
}

/** Public core reads and commands; no parser, layout or model internals cross this seam. */
export function createEigenpalEditing(
  current: () => DocxEditorInstance,
  navigate: (action: () => DocxResult<void>) => DocxResult<void>,
  mutationGate: () => DocxResult<void>,
) {
  let styles: DocxParagraphStyles | null = null;
  let styleIds = new Set<string>();
  let previousFormatting: Readonly<DocxFormatting> | null = null;
  type Match = Parameters<DocxEditorInstance['selectMatch']>[0];
  let matches = new WeakMap<object, Match>();
  const result = (ok: boolean): DocxResult<void> => ok ? { ok: true, value: undefined } : { ok: false, code: 'unsupported' };
  const missing = (): DocxResult<void> => ({ ok: false, code: 'stale-search' });
  function paragraphStyles(): DocxParagraphStyles {
    if (styles) return styles;
    const candidates = current().getDocumentStyles().filter(style => style.type === 'paragraph');
    const valid = candidates.filter(style => style.styleId.length > 0 && style.styleId.length <= DOCX_LIMITS.styleId);
    styleIds = new Set(valid.map(style => style.styleId));
    styles = Object.freeze({ items: Object.freeze(valid.slice(0, DOCX_LIMITS.styles).map(style =>
      Object.freeze({ id: style.styleId, label: clip(style.name, DOCX_LIMITS.styleLabel) }))),
    truncated: valid.length > DOCX_LIMITS.styles || candidates.length !== valid.length });
    return styles;
  }
  return {
    invalidateSearch() { matches = new WeakMap(); },
    dispose() { matches = new WeakMap(); styles = null; styleIds.clear(); previousFormatting = null; },
    formatting(): Readonly<DocxFormatting> {
      const editor = current();
      const value = editor.getSelectionFormatting();
      const alignment = value?.alignment === 'both' ? 'justify' : value?.alignment;
      const next: DocxFormatting = {
        paragraphStyleId: value?.styleId && value.styleId.length <= DOCX_LIMITS.styleId ? value.styleId : null,
        alignment: alignment === 'left' || alignment === 'right' || alignment === 'center' || alignment === 'justify' ? alignment : null,
        fontFamily: value?.fontFamily && normalizeDocxAction({ type: 'font-family', family: value.fontFamily }).ok ? value.fontFamily : null,
        fontSizePoints: Number.isInteger(value?.fontSizeHalfPoints) && value!.fontSizeHalfPoints! >= 2 && value!.fontSizeHalfPoints! <= 3276 ? value!.fontSizeHalfPoints! / 2 : null,
        // The public selection-formatting reader does not expose authored run color.
        color: null,
        bulletList: editor.isActive({ type: 'toggleList', kind: 'bullet' }),
        numberedList: editor.isActive({ type: 'toggleList', kind: 'ordered' }),
      };
      if (previousFormatting && (Object.keys(next) as (keyof DocxFormatting)[]).every(key => previousFormatting![key] === next[key])) return previousFormatting;
      previousFormatting = Object.freeze(next);
      return previousFormatting;
    },
    paragraphStyles,
    fontFamilies() {
      const choices = current().getAvailableFonts();
      const valid = choices.filter(family => normalizeDocxAction({ type: 'font-family', family }).ok);
      return Object.freeze({ items: Object.freeze(valid.slice(0, DOCX_LIMITS.fonts)), truncated: valid.length > DOCX_LIMITS.fonts || valid.length !== choices.length });
    },
    can(action: Exclude<DocxAction, DocxTableAction | DocxImageAction>): DocxCommandAvailability {
      if (typeof action !== 'string' && action.type === 'paragraph-style') {
        paragraphStyles();
        if (!styleIds.has(action.styleId)) return { enabled: false, reason: 'invalid-option' };
      }
      const editor = current();
      const command = eigenpalCommand(action);
      if (!editor.can(command).ok) return { enabled: false, reason: 'unsupported' };
      if (typeof action !== 'string' && action.type === 'paragraph-style') {
        return { enabled: true, active: editor.getSelectionFormatting()?.styleId === action.styleId };
      }
      const active = typeof action === 'string' ? action !== 'undo' && action !== 'redo' :
        action.type === 'alignment' || action.type === 'toggle-list';
      return { enabled: true, ...(active ? { active: editor.isActive(command) } : {}) };
    },
    find(query: string, options: DocxEngineSearchOptions) {
      matches = new WeakMap();
      const found = current().findMatches(query, { matchCase: options.matchCase, wholeWord: options.wholeWord });
      return { matches: found.slice(0, options.limit).map(match => {
        const token = {};
        matches.set(token, match);
        return { token, text: match.text, before: clip(match.contextBefore ?? '', DOCX_LIMITS.context, true), after: clip(match.contextAfter ?? '', DOCX_LIMITS.context) };
      }), truncated: found.length > options.limit || found.length >= 2000 };
    },
    selectMatch(token: object): DocxResult<void> {
      const match = matches.get(token);
      return match ? navigate(() => result(current().selectMatch(match).ok)) : missing();
    },
    replaceMatch(token: object, text: string): DocxResult<void> {
      const match = matches.get(token);
      if (!match) return missing();
      const selected = navigate(() => result(current().selectMatch(match).ok));
      if (!selected.ok) return selected;
      const afterSelection = mutationGate();
      if (!afterSelection.ok) return afterSelection;
      if (!matches.has(token)) return missing();
      const command: EditorCommand = { type: 'insertText', text };
      if (!current().can(command).ok) return result(false);
      const afterCapability = mutationGate();
      if (!afterCapability.ok) return afterCapability;
      if (!matches.has(token)) return missing();
      return result(current().exec(command).ok);
    },
  };
}
