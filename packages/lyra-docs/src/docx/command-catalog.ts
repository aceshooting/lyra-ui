import type { DocxAction } from './types.js';

export type DocxCommandIntent = 'new' | 'open' | 'save' | 'find' | 'outline' | 'checks' | 'review';
export type DocxCommandGroup = 'document' | 'format' | 'insert' | 'navigate';
/** Engine-neutral discovery metadata. Labels and descriptions are localization keys.
 * Actions use the normal session validation and selection contracts; intents are host actions. */
export interface DocxCommandDescriptor {
  readonly id: string;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly group: DocxCommandGroup;
  readonly shortcut?: string;
  readonly action?: DocxAction;
  readonly intent?: DocxCommandIntent;
}
const edit = (id: string, label: string, action: DocxAction, group: DocxCommandGroup = 'format'): DocxCommandDescriptor =>
  Object.freeze({ id, labelKey: `docxEditor${label}`, descriptionKey: `docxEditorCommand${label}`, group,
    action: typeof action === 'string' ? action : Object.freeze(action) });
const intent = (id: DocxCommandIntent, label: string, shortcut?: string): DocxCommandDescriptor =>
  Object.freeze({ id, intent: id, labelKey: `docxEditor${label}`, descriptionKey: `docxEditorCommand${label}`,
    group: ['find', 'outline', 'checks', 'review'].includes(id) ? 'navigate' : 'document', ...(shortcut ? { shortcut } : {}) });
/** Fixed, bounded discovery inventory. Edits needing entered values remain in their existing tool panels. */
export const DOCX_COMMAND_CATALOG: readonly DocxCommandDescriptor[] = Object.freeze([
  intent('new', 'New'), intent('open', 'Open'), intent('save', 'Save', 'Mod+S'),
  edit('undo', 'Undo', 'undo'), edit('redo', 'Redo', 'redo'),
  edit('bold', 'Bold', 'bold'), edit('italic', 'Italic', 'italic'), edit('underline', 'Underline', 'underline'),
  edit('strikethrough', 'Strikethrough', 'strikethrough'), edit('superscript', 'Superscript', 'superscript'),
  edit('subscript', 'Subscript', 'subscript'), edit('clear-formatting', 'ClearFormatting', { type: 'clear-formatting' }),
  edit('align-left', 'AlignLeft', { type: 'alignment', value: 'left' }),
  edit('align-center', 'AlignCenter', { type: 'alignment', value: 'center' }),
  edit('align-right', 'AlignRight', { type: 'alignment', value: 'right' }),
  edit('align-justify', 'AlignJustify', { type: 'alignment', value: 'justify' }),
  edit('bullets', 'Bullets', { type: 'toggle-list', kind: 'bullet' }),
  edit('numbering', 'Numbering', { type: 'toggle-list', kind: 'numbered' }),
  edit('indent-increase', 'IndentIncrease', { type: 'indent', direction: 'increase' }),
  edit('indent-decrease', 'IndentDecrease', { type: 'indent', direction: 'decrease' }),
  edit('remove-link', 'RemoveLink', { type: 'remove-link' }),
  edit('page-break', 'PageBreak', { type: 'page-break' }, 'insert'),
  intent('find', 'Find', 'Mod+F'), intent('outline', 'Outline'), intent('checks', 'Checks'), intent('review', 'Review'),
]);
/** Return a fresh immutable object action for a known identity, or null for a host intent/unknown id. */
export function buildDocxCommandAction(id: string): DocxAction | null {
  if (typeof id !== 'string') return null;
  const action = DOCX_COMMAND_CATALOG.find(item => item.id === id)?.action;
  return action === undefined ? null : typeof action === 'string' ? action : Object.freeze({ ...action });
}
