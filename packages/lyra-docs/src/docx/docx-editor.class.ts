import { nothing, type PropertyValues, type TemplateResult } from 'lit';
import { html, unsafeStatic } from 'lit/static-html.js';
import { property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '@aceshooting/lyra-ui/utilities/lyra-element.js';
import { resolveLyraScopedString } from '@aceshooting/lyra-ui/localization.js';
import { tag } from '@aceshooting/lyra-ui/utilities/prefix.js';
import { acquireAnnouncementSink, type AnnouncementSink } from '@aceshooting/lyra-ui/utilities/announcer.js';
import { createDocxSession } from './create-session.js';
import { internalDocxCharts, internalDocxSelectedImageElement, refreshInternalDocxTableLabels, setInternalDocxZoom } from './session.js';
import type { DocxChartPlacement } from './eigenpal-charts.js';
import { captureTableToolIntent, tableInsertDraft } from './table-tools.js';
import {
  captureImageToolIntent, imageDescriptionDraft, imageDimensionDraft,
  imageRatioPartner, imageResizeDraft, imageResizeUnchanged,
} from './image-tools.js';
import { captureImageInsertionIntent, imageInsertionDefaults, imageInsertionDraft } from './image-insertion-tools.js';
import { inspectDocxImage, withoutJpegApp1 } from './image-bytes.js';
import type {
  DocxCommand, DocxEdit, DocxRefusalCode, DocxResult, DocxRevision, DocxSaveReceipt,
  DocxSelectionLease, DocxSession, DocxSnapshot, DocxSource, DocxSearchResults, DocxTableAction,
  DocxImageAction, DocxImageDescription, DocxImageDirection, DocxImageSource, DocxInsertImageOptions, DocxCommandAvailability,
  DocxHighlight,
} from './types.js';
import { DOCX_EDITOR_STRINGS } from './strings.js';
import { styles } from './docx-editor.styles.js';

interface DocxEditorEvents {
  'lr-before-open': CustomEvent<{ kind: DocxSource['kind']; currentRevision: DocxRevision | null }>;
  'lr-ready': CustomEvent<{ revision: DocxRevision }>;
  'lr-change': CustomEvent<{ snapshot: Readonly<DocxSnapshot> | null }>;
  'lr-selection-change': CustomEvent<{ selection: DocxSnapshot['selection'] }>;
  'lr-error': CustomEvent<{ code: DocxRefusalCode }>;
  'lr-save': CustomEvent<{ receipt: DocxSaveReceipt }>;
}

const commandLabels = {
  bold: 'docxEditorBold',
  italic: 'docxEditorItalic',
  underline: 'docxEditorUnderline',
  strikethrough: 'docxEditorStrikethrough',
  superscript: 'docxEditorSuperscript',
  subscript: 'docxEditorSubscript',
  undo: 'docxEditorUndo',
  redo: 'docxEditorRedo',
} as const satisfies Record<DocxCommand, string>;
const toolIcons = {
  new: { path: 'M14 2H5v20h14V7z M14 2v6h5 M8 14h8 M12 10v8', label: 'docxEditorNew' },
  open: { path: 'M3 7V4h6l3 3h9v3 M3 7v13h16l3-10H7L3 20', label: 'docxEditorOpen' },
  save: { path: 'M3 3h15l3 3v15H3z M7 3v6h10V3 M7 21v-8h10v8', label: 'docxEditorSave' },
  'bold': { path: 'M6 4h7a4 4 0 0 1 0 8H6z M6 12h8a4 4 0 0 1 0 8H6z', label: 'docxEditorBold' },
  'italic': { path: 'M11 4h8 M5 20h8 M15 4 9 20', label: 'docxEditorItalic' },
  'underline': { path: 'M6 3v7a6 6 0 0 0 12 0V3 M4 21h16', label: 'docxEditorUnderline' },
  'undo': { path: 'M9 5 4 10l5 5 M4 10h10a6 6 0 0 1 6 6v3', label: 'docxEditorUndo' },
  'redo': { path: 'm15 5 5 5-5 5 M20 10H10a6 6 0 0 0-6 6v3', label: 'docxEditorRedo' },
  'strikethrough': { path: 'M4 12h16 M16 6.5C15 5 13.5 4 11.5 4 9 4 7 5.5 7 7.5c0 1.6 1 2.7 3 3.5 M8 17c1 2 2.6 3 4.8 3 2.5 0 4.2-1.4 4.2-3.4 0-1-.4-1.9-1.2-2.6', label: 'docxEditorStrikethrough' },
  'superscript': { path: 'M4 7l9 11 M13 7l-9 11 M16 4.5a2 2 0 1 1 3.6 1.2L16 10h4', label: 'docxEditorSuperscript' },
  'subscript': { path: 'M4 5l9 11 M13 5l-9 11 M16 14.5a2 2 0 1 1 3.6 1.2L16 20h4', label: 'docxEditorSubscript' },
  'clear-formatting': { path: 'M6 4h12 M12 4l-3 16 M15 13l6 6 M21 13l-6 6', label: 'docxEditorClearFormatting' },
  'text-color': { path: 'M6 16 12 3l6 13 M8.5 11h7', label: 'docxEditorTextColor' },
  'highlight': { path: 'M14 4l6 6-8 8H8v-4z M8 14l-4 4h5', label: 'docxEditorHighlight' },
  'indent-increase': { path: 'M3 5h18 M11 10h10 M11 14h10 M3 19h18 M3 9l4 3-4 3', label: 'docxEditorIndentIncrease' },
  'indent-decrease': { path: 'M3 5h18 M11 10h10 M11 14h10 M3 19h18 M7 9l-4 3 4 3', label: 'docxEditorIndentDecrease' },
  'line-spacing': { path: 'M11 6h10 M11 12h10 M11 18h10 M5 4v16 M2.5 6.5 5 4l2.5 2.5 M2.5 17.5 5 20l2.5-2.5', label: 'docxEditorLineSpacing' },
  'page-break': { path: 'M6 2v6h12V2 M6 22v-6h12v6 M2 12h3 M8 12h3 M13 12h3 M19 12h3', label: 'docxEditorPageBreak' },
  'alignment-left': { path: 'M4 5h16 M4 10h10 M4 15h16 M4 20h10', label: 'docxEditorAlignLeft' },
  'alignment-center': { path: 'M4 5h16 M7 10h10 M4 15h16 M7 20h10', label: 'docxEditorAlignCenter' },
  'alignment-right': { path: 'M4 5h16 M10 10h10 M4 15h16 M10 20h10', label: 'docxEditorAlignRight' },
  'alignment-justify': { path: 'M4 5h16 M4 10h16 M4 15h16 M4 20h16', label: 'docxEditorAlignJustify' },
  'list-bullet': { path: 'M9 6h12 M9 12h12 M9 18h12 M3 6h.01 M3 12h.01 M3 18h.01', label: 'docxEditorBullets' },
  'list-numbered': { path: 'M10 6h11 M10 12h11 M10 18h11 M3 3h1v6 M2 9h4 M2 14a2 2 0 1 1 4 0c0 1-4 3-4 5h4', label: 'docxEditorNumbering' },
  'link': { path: 'm10 13 4-4 M8 16l-2 2a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0 M14 8l2-2a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0', label: 'docxEditorLink' },
  'find': { path: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6', label: 'docxEditorFind' },
  'image-insert': { path: 'M3 3h18v18H3z M3 16l5-5 5 5 3-3 5 5 M16 7h.01', label: 'docxEditorInsertImage' },
  'table-insert': { path: 'M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18 M15 3v18', label: 'docxEditorInsertTable' },
  'image-previous': { path: 'M5 5h14v14H5z M5 15l4-4 5 5 M16 9h.01 M3 12H0 M2 10l-2 2 2 2', label: 'docxEditorPreviousImage' },
  'image-next': { path: 'M5 5h14v14H5z M5 15l4-4 5 5 M16 9h.01 M21 12h3 M22 10l2 2-2 2', label: 'docxEditorNextImage' },
  'image-resize': { path: 'M14 3h7v7 M10 21H3v-7 M21 3l-7 7 M3 21l7-7', label: 'docxEditorResizeImage' },
  'image-description': { path: 'M3 4h18v16H3z M7 9h10 M7 13h10 M7 17h6', label: 'docxEditorDescribeImage' },
  'image-delete': { path: 'M4 7h16 M9 7V4h6v3 M6 7l1 14h10l1-14 M10 11v6 M14 11v6', label: 'docxEditorDeleteImage' },
  'table-row-above': { path: 'M3 13h18v8H3z M12 3v7 M8.5 6.5h7', label: 'docxEditorTableRowAbove' },
  'table-row-below': { path: 'M3 3h18v8H3z M12 14v7 M8.5 17.5h7', label: 'docxEditorTableRowBelow' },
  'table-column-left': { path: 'M13 3h8v18h-8z M3 12h7 M6.5 8.5v7', label: 'docxEditorTableColumnLeft' },
  'table-column-right': { path: 'M3 3h8v18H3z M14 12h7 M17.5 8.5v7', label: 'docxEditorTableColumnRight' },
  'table-delete-row': { path: 'M3 8h18v8H3z M10 10l4 4 M14 10l-4 4', label: 'docxEditorTableDeleteRow' },
  'table-delete-column': { path: 'M8 3h8v18H8z M10 10l4 4 M14 10l-4 4', label: 'docxEditorTableDeleteColumn' },
  'table-delete-table': { path: 'M3 3h18v18H3z M3 9h18 M9 3v18 M13 13l6 6 M19 13l-6 6', label: 'docxEditorTableDelete' },
} as const;
/** Tools rendered only in a matching context own their tooltip next to the trigger. */
const contextualToolIcons = new Set<string>(['image-resize', 'image-description', 'image-delete', 'table-row-above',
  'table-row-below', 'table-column-left', 'table-column-right', 'table-delete-row', 'table-delete-column', 'table-delete-table']);
const imageHandles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type ImageHandle = typeof imageHandles[number];
interface ImageFrame { left: number; top: number; width: number; height: number }
interface ImageClip extends ImageFrame { frame: ImageFrame }
interface ChartLayer { clip: ImageFrame; charts: readonly { placement: DocxChartPlacement; frame: ImageFrame }[] }
const liteChartTag = unsafeStatic(tag('lite-chart'));
/** Office's default series colors, so document charts look as their author saw them in Word. */
const officeSeriesColors = ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'] as const;
interface ImageDrag {
  pointerId: number;
  handle: ImageHandle;
  x: number;
  y: number;
  start: ImageFrame;
  intent: NonNullable<ReturnType<typeof captureImageToolIntent>>;
}
type ToolIcon = keyof typeof toolIcons;
const commands: readonly DocxCommand[] = ['bold', 'italic', 'underline', 'strikethrough', 'superscript', 'subscript'];
/** Word's standard text colors; the hex values are the document's own `w:color` vocabulary. */
const textColors = [
  ['#C00000', 'DarkRed'], ['#FF0000', 'Red'], ['#FFC000', 'Orange'], ['#FFFF00', 'Yellow'], ['#92D050', 'LightGreen'],
  ['#00B050', 'Green'], ['#00B0F0', 'LightBlue'], ['#0070C0', 'Blue'], ['#002060', 'DarkBlue'], ['#7030A0', 'Purple'],
  ['#000000', 'Black'], ['#7F7F7F', 'Gray'],
] as const;
/** Word's highlight palette, keyed by its `w:highlight` names. */
const highlightColors = [
  ['yellow', '#FFFF00', 'Yellow'], ['green', '#00FF00', 'BrightGreen'], ['cyan', '#00FFFF', 'Turquoise'],
  ['magenta', '#FF00FF', 'Pink'], ['blue', '#0000FF', 'Blue'], ['red', '#FF0000', 'Red'], ['darkBlue', '#000080', 'DarkBlue'],
  ['darkCyan', '#008080', 'Teal'], ['darkGreen', '#008000', 'Green'], ['darkMagenta', '#800080', 'Violet'],
  ['darkRed', '#800000', 'DarkRed'], ['darkYellow', '#808000', 'DarkYellow'], ['darkGray', '#808080', 'DarkGray'],
  ['lightGray', '#C0C0C0', 'LightGray'], ['black', '#000000', 'Black'],
] as const satisfies readonly (readonly [Exclude<DocxHighlight, 'none'>, string, string])[];
const lineSpacings = [1, 1.15, 1.5, 2, 2.5, 3] as const;
const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
export type DocxEditorZoom = number | 'fit';
/** `fit` or a factor from 0.25 to 4; anything else falls back to 100%. */
const zoomConverter = {
  fromAttribute(value: string | null): DocxEditorZoom {
    if (value === 'fit') return 'fit';
    const factor = Number(value);
    return value !== null && Number.isFinite(factor) && factor >= 0.25 && factor <= 4 ? factor : 1;
  },
  toAttribute(value: DocxEditorZoom): string { return String(value); },
};
const swatchPickerTag = unsafeStatic(tag('swatch-picker'));
const iconTag = unsafeStatic(tag('icon'));
const tooltipTag = unsafeStatic(tag('tooltip'));
const buttonTag = unsafeStatic(tag('button'));
const selectTag = unsafeStatic(tag('select'));
const optionTag = unsafeStatic(tag('option'));
const comboboxTag = unsafeStatic(tag('combobox'));
const numberInputTag = unsafeStatic(tag('number-input'));
const colorPickerTag = unsafeStatic(tag('color-picker'));
const popoverTag = unsafeStatic(tag('popover'));
const inputTag = unsafeStatic(tag('input'));
const checkboxTag = unsafeStatic(tag('checkbox'));
const textareaTag = unsafeStatic(tag('textarea'));
const alignments = ['left', 'center', 'right', 'justify'] as const;
const listKinds = ['bullet', 'numbered'] as const;
const tableActions = [
  ['row-above', { type: 'insert-table-row', where: 'above' }, 'docxEditorTableRowAbove'],
  ['row-below', { type: 'insert-table-row', where: 'below' }, 'docxEditorTableRowBelow'],
  ['column-left', { type: 'insert-table-column', where: 'left' }, 'docxEditorTableColumnLeft'],
  ['column-right', { type: 'insert-table-column', where: 'right' }, 'docxEditorTableColumnRight'],
  ['delete-row', { type: 'delete-table-row' }, 'docxEditorTableDeleteRow'],
  ['delete-column', { type: 'delete-table-column' }, 'docxEditorTableDeleteColumn'],
  ['delete-table', { type: 'delete-table' }, 'docxEditorTableDelete'],
] as const;
const maxInputBytes = 16 * 1024 * 1024;
const maxImageBytes = 4 * 1024 * 1024;
type ImageInsertionPhase = 'idle' | 'reading' | 'draft' | 'dispatched';
const refused = <T>(code: DocxRefusalCode): DocxResult<T> => ({ ok: false, code });

/**
 * Experimental DOCX editing surface. The engine owns only the stable, empty light-DOM child
 * slotted into the document area. Import the companion's `docx/editor.css` separately for engine
 * content styling. A disconnect destroys the session, including undo history and selection;
 * callers reopen their own saved bytes after reconnect. Save returns bytes without persisting or
 * clearing dirty state; call `acknowledgeSaved()` after durable host persistence.
 *
 * @event lr-before-open - Cancelable when a document with unsaved content would be replaced; an untouched or emptied single blank page is replaced without asking.
 * @event lr-ready - A document finished opening.
 * @event lr-change - Session state or revision changed; no document bytes are included.
 * @event lr-selection-change - Selection kind or version changed.
 * @event lr-error - A normalized refusal code; no document contents are exposed.
 * @event lr-save - Explicit save completed; detail contains the save receipt and bytes.
 * @customElement lr-docx-editor
 * @slot document - Reserved for the component-owned, stable light-DOM engine mount.
 * @slot new-icon - Decorative icon for the new action; the editor retains its accessible name.
 * @slot open-icon - Decorative icon for the open action; the editor retains its accessible name.
 * @slot save-icon - Decorative icon for the save action; the editor retains its accessible name.
 * @slot bold-icon - Decorative icon for the bold action; the editor retains its accessible name.
 * @slot italic-icon - Decorative icon for the italic action; the editor retains its accessible name.
 * @slot underline-icon - Decorative icon for the underline action; the editor retains its accessible name.
 * @slot undo-icon - Decorative icon for the undo action; the editor retains its accessible name.
 * @slot redo-icon - Decorative icon for the redo action; the editor retains its accessible name.
 * @slot alignment-left-icon - Decorative icon for the alignment left action; the editor retains its accessible name.
 * @slot alignment-center-icon - Decorative icon for the alignment center action; the editor retains its accessible name.
 * @slot alignment-right-icon - Decorative icon for the alignment right action; the editor retains its accessible name.
 * @slot alignment-justify-icon - Decorative icon for the alignment justify action; the editor retains its accessible name.
 * @slot list-bullet-icon - Decorative icon for the list bullet action; the editor retains its accessible name.
 * @slot list-numbered-icon - Decorative icon for the list numbered action; the editor retains its accessible name.
 * @slot link-icon - Decorative icon for the link action; the editor retains its accessible name.
 * @slot find-icon - Decorative icon for the find action; the editor retains its accessible name.
 * @slot image-insert-icon - Decorative icon for the image insert action; the editor retains its accessible name.
 * @slot table-insert-icon - Decorative icon for the table insert action; the editor retains its accessible name.
 * @slot image-previous-icon - Decorative icon for the image previous action; the editor retains its accessible name.
 * @slot image-next-icon - Decorative icon for the image next action; the editor retains its accessible name.
 * @slot strikethrough-icon - Decorative icon for the strikethrough action; the editor retains its accessible name.
 * @slot superscript-icon - Decorative icon for the superscript action; the editor retains its accessible name.
 * @slot subscript-icon - Decorative icon for the subscript action; the editor retains its accessible name.
 * @slot clear-formatting-icon - Decorative icon for the clear formatting action; the editor retains its accessible name.
 * @slot text-color-icon - Decorative icon for the text color action; the editor retains its accessible name.
 * @slot highlight-icon - Decorative icon for the highlight action; the editor retains its accessible name.
 * @slot indent-increase-icon - Decorative icon for the indent increase action; the editor retains its accessible name.
 * @slot indent-decrease-icon - Decorative icon for the indent decrease action; the editor retains its accessible name.
 * @slot line-spacing-icon - Decorative icon for the line spacing action; the editor retains its accessible name.
 * @slot page-break-icon - Decorative icon for the page break action; the editor retains its accessible name.
 * @slot image-resize-icon - Decorative icon for the image resize action; the editor retains its accessible name.
 * @slot image-description-icon - Decorative icon for the image description action; the editor retains its accessible name.
 * @slot image-delete-icon - Decorative icon for the image delete action; the editor retains its accessible name.
 * @slot table-row-above-icon - Decorative icon for the table row above action; the editor retains its accessible name.
 * @slot table-row-below-icon - Decorative icon for the table row below action; the editor retains its accessible name.
 * @slot table-column-left-icon - Decorative icon for the table column left action; the editor retains its accessible name.
 * @slot table-column-right-icon - Decorative icon for the table column right action; the editor retains its accessible name.
 * @slot table-delete-row-icon - Decorative icon for the table delete row action; the editor retains its accessible name.
 * @slot table-delete-column-icon - Decorative icon for the table delete column action; the editor retains its accessible name.
 * @slot table-delete-table-icon - Decorative icon for the table delete table action; the editor retains its accessible name.
 * @cssprop --lr-docx-editor-document-max-block-size - Document scroll viewport maximum block size; defaults to 30rem. Set a valid length or none to let the document grow. At a fixed zoom, pages keep their scale and scroll horizontally in narrower allocations; zoom="fit" follows the width.
 * @csspart base - The root editor surface.
 * @csspart toolbar - File and formatting controls.
 * @csspart file-actions - New, Open and Save controls.
 * @csspart new-button - Creates a blank document.
 * @csspart open-button - Opens the local file picker.
 * @csspart save-button - Requests explicit serialization.
 * @csspart file-input - Native local DOCX file picker.
 * @csspart format-actions - Formatting and history controls.
 * @csspart format-button - One formatting or history control, identified by data-command.
 * @csspart editing-tools - Paragraph, alignment, list, font, color and link tools.
 * @csspart paragraph-style - Actual styles offered by the current document.
 * @csspart alignment-actions - Four paragraph alignment actions.
 * @csspart list-actions - Bullet and numbered list actions.
 * @csspart edit-button - One alignment, list, indent, clear-formatting or page-break action, identified by data-edit.
 * @csspart font-family - Font family picker with on-demand suggestions.
 * @csspart font-size - Font size field in points.
 * @csspart text-color - Opens the text color panel; its bar shows the last applied color, never an inferred current one.
 * @csspart text-color-popover - Text color panel.
 * @csspart text-color-swatches - Word's standard text colors; a click or Enter applies and closes.
 * @csspart text-color-custom - Inline custom color picker; each committed change applies.
 * @csspart color-auto - Applies automatic authored text color.
 * @csspart highlight - Opens the highlight panel; its bar shows the last applied highlight.
 * @csspart highlight-popover - Highlight panel.
 * @csspart highlight-swatches - Word's highlight palette; a click or Enter applies and closes.
 * @csspart highlight-none - Removes highlighting.
 * @csspart line-spacing - Opens the line spacing panel.
 * @csspart line-spacing-popover - Line spacing panel.
 * @csspart line-spacing-options - Line spacing choices.
 * @csspart line-spacing-option - One line spacing multiple, identified by data-value.
 * @csspart link-popover - URL and optional text editor.
 * @csspart link-trigger - Opens the link editor.
 * @csspart link-fields - Link form contents.
 * @csspart link-href - URL field.
 * @csspart link-text - Optional replacement text field.
 * @csspart link-actions - Apply, remove and cancel controls.
 * @csspart link-apply - Applies a validated link.
 * @csspart link-remove - Removes the current link.
 * @csspart link-cancel - Closes the link editor.
 * @csspart table-tools - Table insertion and contextual editing controls.
 * @csspart table-insert-popover - Table dimensions dialog.
 * @csspart table-insert-trigger - Opens the table insertion dialog.
 * @csspart table-fields - Table dimension fields and controls.
 * @csspart table-rows - Requested row count, from 1 to 20.
 * @csspart table-columns - Requested column count, from 1 to 20.
 * @csspart table-hint - Dimension limits or stale-selection guidance.
 * @csspart table-dialog-actions - Insert and cancel controls.
 * @csspart table-insert-apply - Inserts the requested rectangular table.
 * @csspart table-insert-cancel - Cancels table insertion.
 * @csspart table-context - Current table dimensions and available cell coordinates.
 * @csspart table-actions - Contextual row, column and whole-table actions.
 * @csspart table-button - A table action, identified by data-table-action.
 * @csspart image-tools - Image navigation and contextual existing inline-image controls.
 * @csspart image-previous - Selects the previous eligible body image, wrapping at the start.
 * @csspart image-next - Selects the next eligible body image, wrapping at the end.
 * @csspart image-navigation-status - Feedback when no eligible image is available.
 * @csspart chart - A bar, column, line or area chart painted from its document's cached values over the engine placeholder, identified by data-chart-type. Other chart kinds keep the placeholder.
 * @csspart image-frame - Selection frame painted over the selected editable image.
 * @csspart image-handle - One pointer resize handle, identified by data-handle (nw, n, ne, e, se, s, sw, w). Corners keep the aspect ratio; Shift inverts that.
 * @csspart image-size - Live dimensions shown while a resize handle is dragged.
 * @csspart image-resize-popover - Image dimensions dialog.
 * @csspart image-resize-trigger - Opens the image resize dialog; its name and tooltip include the selected dimensions.
 * @csspart image-resize-fields - Dimension fields, ratio option and controls.
 * @csspart image-width - Requested width in points.
 * @csspart image-height - Requested height in points.
 * @csspart image-ratio - Preserve the captured original aspect ratio.
 * @csspart image-resize-hint - Dimension limits or stale-selection guidance.
 * @csspart image-resize-actions - Resize Apply and Cancel controls.
 * @csspart image-resize-apply - Applies both image dimensions as one edit.
 * @csspart image-resize-cancel - Cancels resizing.
 * @csspart image-description-popover - Image title and description dialog.
 * @csspart image-description-trigger - Opens the image description dialog.
 * @csspart image-description-fields - Metadata fields and controls.
 * @csspart image-title - Bounded image title field.
 * @csspart image-description - Bounded multiline description field.
 * @csspart image-description-hint - Metadata guidance or stale-selection guidance.
 * @csspart image-description-actions - Metadata Apply and Cancel controls.
 * @csspart image-description-apply - Applies both metadata fields as one edit.
 * @csspart image-description-cancel - Cancels description editing.
 * @csspart image-delete - Deletes the originally selected image as one edit.
 * @csspart image-insert-trigger - Opens the local image picker at the original caret.
 * @csspart image-insert-dialog - Local image dimensions and description dialog.
 * @csspart image-insert-file - Native local image picker.
 * @csspart image-insert-fields - Local image draft and controls.
 * @csspart image-insert-width - Requested insertion width in points.
 * @csspart image-insert-height - Requested insertion height in points.
 * @csspart image-insert-ratio - Preserve the original encoded image ratio.
 * @csspart image-insert-title - Optional bounded title.
 * @csspart image-insert-description - Optional bounded multiline description.
 * @csspart image-insert-hint - Supported formats, size guidance or stale-intent feedback.
 * @csspart image-insert-actions - Insert and Cancel controls.
 * @csspart image-insert-apply - Inserts the original local image at the retained caret.
 * @csspart image-insert-cancel - Cancels picking, reading or editing a local image draft.
 * @csspart image-insert-status - Local image preparation or refusal feedback.
 * @csspart find - On-demand search and single-match replacement surface.
 * @csspart find-toggle - Opens and closes the find surface.
 * @csspart find-query - Search query field.
 * @csspart find-match-case - Case-sensitive option.
 * @csspart find-whole-word - Whole-word option.
 * @csspart find-submit - Runs a bounded search.
 * @csspart find-count - Match count and truncation notice.
 * @csspart find-previous - Selects the previous match.
 * @csspart find-next - Selects the next match.
 * @csspart find-replace - Replacement text field.
 * @csspart find-replace-button - Replaces one selected match.
 * @csspart confirm - Dirty document replacement confirmation.
 * @csspart discard-button - Confirms replacement of unsaved content.
 * @csspart keep-button - Cancels replacement of unsaved content.
 * @csspart document - Scrollable engine surface.
 * @csspart error - Localized load or save failure, naming size, external-content or unsupported-content refusals.
 * @csspart edit-error - Localized editing refusal.
 * @csspart status - Filename and current document state.
 * @csspart filename - The local file name or untitled fallback.
 * @csspart state - Current load, dirty or save state.
 * @csspart zoom - Page zoom select: Fit width or a percentage.
 */
export class LyraDocxEditor extends LyraElement<DocxEditorEvents> {
  static override styles = [LyraElement.styles, styles];

  /** Resolve the editor's private message slice through Lyra's public scoped resolver. */
  protected override localize(key: string, fallback?: string, values?: Record<string, string | number>): string {
    if (!Object.prototype.hasOwnProperty.call(DOCX_EDITOR_STRINGS, key)) return super.localize(key, fallback, values);
    // Register inherited-locale observation even though this slice lives outside Lyra UI's catalog.
    void this.effectiveLocale;
    return resolveLyraScopedString(this, key, DOCX_EDITOR_STRINGS, this.strings, fallback, values);
  }

  /** Applied when the next document is opened. The session fixes this value at creation. */
  @property({ type: Boolean, attribute: 'read-only', reflect: true }) readOnly = false;

  /** Page zoom: `fit` follows the available width, or a factor from 0.25 to 4. Presentation only. */
  @property({ reflect: true, converter: zoomConverter }) zoom: DocxEditorZoom = 1;
  private appliedZoom: { session: DocxSession; zoom: DocxEditorZoom } | null = null;

  @state() private currentSnapshot: Readonly<DocxSnapshot> | null = null;
  @state() private filename = '';
  @state() private localError: DocxRefusalCode | null = null;
  @state() private openingFile = false;
  @state() private wasDisconnected = false;
  @state() private pendingAction: 'new' | 'open' | null = null;
  @state() private toolbarKey = 'bold';
  @state() private paragraphStyleItems: readonly { id: string; label: string }[] = [];
  @state() private fontFamilyItems: readonly string[] = [];
  @state() private findOpen = false;
  @state() private searchResults: DocxSearchResults | null = null;
  @state() private searchIndex = -1;
  @state() private query = '';
  @state() private matchCase = false;
  @state() private wholeWord = false;
  @state() private replacement = '';
  @state() private linkHref = '';
  @state() private linkText = '';
  @state() private editError: DocxRefusalCode | null = null;
  /** Word-style split color tools remember the last applied value; the engine cannot report the current one. */
  @state() private lastTextColor = '#FF0000';
  @state() private lastHighlight: Exclude<DocxHighlight, 'none'> = 'yellow';
  /** The trigger whose panel is open; its tooltip stays quiet until the panel closes. */
  @state() private openPanelTrigger: string | null = null;
  @state() private tableRows = '2';
  @state() private tableColumns = '2';
  @state() private tableDialogOpen = false;
  private tableIntent: ReturnType<typeof captureTableToolIntent> = null;
  private tableDialogGeneration = 0;
  private cancelTableFocusReturn: (() => void) | null = null;
  private tableLabelState: { session: DocxSession; row: string; column: string } | null = null;
  @state() private imageDialog: 'resize' | 'description' | null = null;
  @state() private imageWidth = '';
  @state() private imageHeight = '';
  @state() private imageKeepRatio = true;
  @state() private imageTitle = '';
  @state() private imageDescriptionText = '';
  @state() private imageNavigationEmpty = false;
  private imageIntent: ReturnType<typeof captureImageToolIntent> = null;
  private imageDialogGeneration = 0;
  private cancelImageFocusReturn: (() => void) | null = null;
  @state() private insertionPhase: ImageInsertionPhase = 'idle';
  @state() private insertionWidth = '';
  @state() private insertionHeight = '';
  @state() private insertionKeepRatio = true;
  @state() private insertionTitle = '';
  @state() private insertionDescription = '';
  @state() private insertionError: DocxRefusalCode | null = null;
  private insertionIntent: ReturnType<typeof captureImageInsertionIntent> = null;
  private insertionDefaults: ReturnType<typeof imageInsertionDefaults> = null;
  private insertionBytes: Uint8Array | null = null;
  private insertionGeneration = 0;
  private insertionAwaitingPicker = false;
  private cancelInsertionFocusReturn: (() => void) | null = null;

  private mount: HTMLDivElement | null = null;
  private session: DocxSession | null = null;
  private unsubscribeSession: (() => void) | null = null;
  private toolbarSelection: DocxSelectionLease | null = null;
  @state() private openInProgress = false;
  private sourceReadSequence = 0;
  private politeSink: AnnouncementSink | null = null;
  private assertiveSink: AnnouncementSink | null = null;
  private announcementsArmed = false;
  private pickerFocusReturn = false;
  @state() private imageClip: ImageClip | null = null;
  @state() private imagePreview: (ImageFrame & { widthPoints: number; heightPoints: number }) | null = null;
  private imageDrag: ImageDrag | null = null;
  private imageFrameRequest = 0;
  private imageFrameObserver: ResizeObserver | null = null;
  private observedImage: HTMLElement | null = null;
  @state() private chartLayer: ChartLayer | null = null;
  private surfaceObserver: ResizeObserver | null = null;
  private observedSurface: Element | null = null;

  override connectedCallback(): void {
    super.connectedCallback();
    this.politeSink = acquireAnnouncementSink('polite', { document: this.ownerDocument, source: this });
    this.assertiveSink = acquireAnnouncementSink('assertive', { document: this.ownerDocument, source: this });
    if (!this.mount) {
      const mount = this.ownerDocument.createElement('div');
      mount.slot = 'document';
      mount.setAttribute('role', 'document');
      mount.setAttribute('aria-label', this.editorLabel());
      mount.setAttribute('aria-keyshortcuts', 'Alt+F10');
      mount.title = this.localize('docxEditorShortcut');
      this.mount = mount;
      this.append(mount);
    }
    this.addEventListener('keydown', this.onHostKeyDown, { capture: true });
    this.addEventListener('scroll', this.scheduleImageFrame, { capture: true, passive: true });
  }

  override disconnectedCallback(): void {
    this.sourceReadSequence++;
    this.removeEventListener('keydown', this.onHostKeyDown, { capture: true });
    this.removeEventListener('scroll', this.scheduleImageFrame, { capture: true });
    this.cancelImageDrag();
    this.ownerDocument.defaultView?.cancelAnimationFrame(this.imageFrameRequest);
    this.imageFrameRequest = 0;
    this.imageFrameObserver?.disconnect();
    this.imageFrameObserver = null;
    this.observedImage = null;
    this.imageClip = null;
    this.surfaceObserver?.disconnect();
    this.surfaceObserver = null;
    this.observedSurface = null;
    this.chartLayer = null;
    this.disposeSession();
    this.mount?.remove();
    this.mount = null;
    this.currentSnapshot = null;
    this.openInProgress = false;
    this.openingFile = false;
    this.localError = null;
    this.wasDisconnected = true;
    this.pendingAction = null;
    this.clearEditingDrafts();
    this.emit('lr-change', { snapshot: null });
    this.politeSink?.release();
    this.politeSink = null;
    this.assertiveSink?.release();
    this.assertiveSink = null;
    this.announcementsArmed = false;
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed);
    this.refreshTableLabels();
    this.applyZoom();
    const overlayOnly = [...(changed as Map<PropertyKey, unknown>).keys()].every(key => key === 'imageClip' || key === 'chartLayer');
    if (!overlayOnly) this.scheduleImageFrame();
    const enabled = this.enabledToolbarButtons();
    if (enabled.length && !enabled.some(button => button.getAttribute('data-tool-key') === this.toolbarKey))
      this.toolbarKey = enabled[0]!.getAttribute('data-tool-key') ?? 'bold';
    if (this.mount) {
      this.mount.setAttribute('aria-label', this.editorLabel());
      this.mount.title = this.localize('docxEditorShortcut');
    }
    if (!this.announcementsArmed && this.wasDisconnected)
      this.politeSink?.announce(this.localize('docxEditorDisconnected'));
    this.announcementsArmed = true;
  }

  /** Current immutable session state, or null before opening and after disconnect. */
  snapshot(): Readonly<DocxSnapshot> | null { return this.currentSnapshot; }

  private editorLabel(): string {
    return this.getAttribute('aria-label') ?? this.localize('docxEditorLabel');
  }

  private disposeSession(): void {
    this.cancelImageDrag();
    this.toolbarSelection?.release();
    this.toolbarSelection = null;
    this.unsubscribeSession?.();
    this.unsubscribeSession = null;
    this.session?.destroy();
    this.session = null;
    this.mount?.replaceChildren();
    this.clearEditingDrafts();
  }

  private clearEditingDrafts(): void {
    this.resetImageInsertion();
    this.imageDialogGeneration++;
    this.cancelImageFocusReturn?.();
    this.releaseImageIntent();
    this.imageDialog = null;
    this.imageWidth = '';
    this.imageHeight = '';
    this.imageKeepRatio = true;
    this.imageTitle = '';
    this.imageDescriptionText = '';
    this.imageNavigationEmpty = false;
    for (const kind of ['resize', 'description'] as const) void this.imagePopover(kind)?.hide({ focusTrigger: false });
    this.tableDialogGeneration++;
    this.cancelTableFocusReturn?.();
    this.releaseTableIntent();
    this.tableDialogOpen = false;
    this.tableRows = '2';
    this.tableColumns = '2';
    this.tableLabelState = null;
    void this.tablePopover()?.hide({ focusTrigger: false });
    this.pickerFocusReturn = false;
    this.paragraphStyleItems = [];
    this.fontFamilyItems = [];
    this.searchResults = null;
    this.searchIndex = -1;
    this.editError = null;
    this.findOpen = false;
    this.query = '';
    this.replacement = '';
    this.linkHref = '';
    this.linkText = '';
  }

  private syncSession(): void {
    const owner = this.session;
    if (!owner) return;
    const previous = this.currentSnapshot;
    const next = owner.snapshot();
    if (next === previous) return;
    if (next.selection.version !== previous?.selection.version ||
        next.revision?.documentId !== previous?.revision?.documentId || next.revision?.value !== previous?.revision?.value)
      this.releaseToolbarSelection();
    if (this.tableIntent && !this.tableIntent.valid(owner)) this.tableIntent.release();
    if (this.imageIntent && !this.imageIntent.valid(owner)) this.imageIntent.release();
    if (this.insertionIntent && !this.insertionIntent.valid(owner)) {
      if (this.insertionPhase === 'reading' || this.insertionPhase === 'idle') this.cancelImageInsertion(false);
      else this.insertionIntent.release();
    }
    if (!this.isConnected || this.session !== owner || this.currentSnapshot !== previous || owner.snapshot() !== next) return;
    this.currentSnapshot = next;
    const current = () => this.isConnected && this.session === owner && this.currentSnapshot === next && owner.snapshot() === next;
    if (next.image) this.imageNavigationEmpty = false;
    if (previous?.revision?.documentId !== next.revision?.documentId ||
        previous?.revision?.value !== next.revision?.value) {
      this.searchResults = null;
      this.searchIndex = -1;
    }
    this.emit('lr-change', { snapshot: next });
    if (!current()) return;
    if (this.announcementsArmed && next.status === 'opening' && previous?.status !== 'opening')
      this.politeSink?.announce(this.localize('docxEditorOpening'));
    if (this.announcementsArmed && next.activity === 'saving' && previous?.activity !== 'saving')
      this.politeSink?.announce(this.localize('docxEditorSaving'));
    if (this.announcementsArmed && next.activity === 'inserting-image' && previous?.activity !== 'inserting-image')
      this.politeSink?.announce(this.localize('docxEditorInsertingImage'));
    if (next.status === 'ready' && previous?.status !== 'ready' && next.revision) {
      this.emit('lr-ready', { revision: next.revision });
      if (!current()) return;
    }
    if (this.announcementsArmed && next.status === 'ready' && previous?.status !== 'ready')
      this.politeSink?.announce(this.localize('docxEditorReady'));
    if (this.announcementsArmed && next.dirty && !previous?.dirty && next.status === 'ready')
      this.politeSink?.announce(this.localize('docxEditorUnsaved'));
    if (next.selection.version !== previous?.selection.version || next.selection.kind !== previous?.selection.kind) {
      this.emit('lr-selection-change', { selection: next.selection });
      if (!current()) return;
    }
    if (next.status === 'error' && next.error?.code && (previous?.status !== 'error' || previous.error?.code !== next.error.code)) {
      this.emit('lr-error', { code: next.error.code });
      if (!current()) return;
    }
    if (this.announcementsArmed && next.status === 'error' && previous?.status !== 'error')
      this.assertiveSink?.announce(this.localize('docxEditorError'));
  }

  /** Explain the refusals a real file commonly hits; other failures keep the general message. */
  private errorMessageKey(): string {
    const code = this.localError ?? this.currentSnapshot?.error?.code;
    return code === 'resource-limit' ? 'docxEditorErrorTooLarge' : code === 'external-resource' ? 'docxEditorErrorExternal' :
      code === 'invalid-document' ? 'docxEditorErrorInvalid' : 'docxEditorError';
  }

  private reportError(code: DocxRefusalCode): void {
    this.localError = code;
    this.emit('lr-error', { code });
    if (this.announcementsArmed) this.assertiveSink?.announce(this.localize('docxEditorError'));
  }

  private async load(source: DocxSource, filename: string, signal?: AbortSignal): Promise<DocxResult<DocxRevision>> {
    if (this.openInProgress) return refused('busy');
    if (!this.isConnected || !this.mount) return refused('invalid-mount');
    if (signal?.aborted) return refused('aborted');
    if (source.kind === 'docx' && source.bytes.byteLength > maxInputBytes) {
      this.reportError('resource-limit');
      return refused('resource-limit');
    }
    if (this.hasUnsavedContent()) {
      const priorSession = this.session;
      const priorSnapshot = this.currentSnapshot;
      const priorMount = this.mount;
      const event = this.emit('lr-before-open', {
        kind: source.kind,
        currentRevision: this.currentSnapshot?.revision ?? null,
      }, { cancelable: true });
      if (event.defaultPrevented) return refused('aborted');
      if (!this.isConnected || this.mount !== priorMount) return refused('destroyed');
      if (this.session !== priorSession || this.currentSnapshot !== priorSnapshot || this.openInProgress)
        return refused('busy');
    }
    this.openInProgress = true;
    this.localError = null;
    this.wasDisconnected = false;
    this.pendingAction = null;
    this.disposeSession();
    this.currentSnapshot = null;
    this.filename = '';
    const created = createDocxSession({
      mount: this.mount,
      readOnly: this.readOnly,
      locale: this.effectiveLocale,
    });
    if (!created.ok) {
      this.openInProgress = false;
      this.reportError(created.code);
      return created;
    }
    const session = created.value;
    this.session = session;
    this.unsubscribeSession = session.subscribe(() => this.syncSession());
    this.syncSession();
    let result: DocxResult<DocxRevision>;
    try { result = await session.open(source, { signal }); }
    catch { result = refused('open-failed'); }
    if (this.session !== session) return refused('destroyed');
    this.openInProgress = false;
    this.syncSession();
    if (result.ok) this.filename = filename;
    else if (result.code === 'aborted') {
      this.disposeSession();
      this.currentSnapshot = null;
    } else if (this.snapshot()?.status !== 'error') this.reportError(result.code);
    return result;
  }

  /** Open caller-owned DOCX bytes or a local file. Replacing dirty content can be vetoed. */
  async open(input: Uint8Array | File, options: { signal?: AbortSignal; name?: string } = {}): Promise<DocxResult<DocxRevision>> {
    const sourceRead = ++this.sourceReadSequence;
    if (input instanceof Uint8Array) {
      this.openingFile = false;
      return this.load({ kind: 'docx', bytes: input }, options.name ?? '', options.signal);
    }
    if (!input || typeof input.arrayBuffer !== 'function') return refused('invalid-option');
    if (input.size > maxInputBytes) {
      this.reportError('resource-limit');
      return refused('resource-limit');
    }
    if (options.signal?.aborted) return refused('aborted');
    this.openingFile = true;
    try {
      const bytes = new Uint8Array(await input.arrayBuffer());
      if (options.signal?.aborted || sourceRead !== this.sourceReadSequence) return refused('aborted');
      return await this.load({ kind: 'docx', bytes }, options.name ?? input.name, options.signal);
    } catch {
      if (options.signal?.aborted || sourceRead !== this.sourceReadSequence) return refused('aborted');
      this.reportError('open-failed');
      return refused('open-failed');
    } finally {
      if (sourceRead === this.sourceReadSequence) this.openingFile = false;
    }
  }

  /** Create a blank document. Replacing dirty content can be vetoed. */
  newDocument(options: { signal?: AbortSignal } = {}): Promise<DocxResult<DocxRevision>> {
    this.sourceReadSequence++;
    this.openingFile = false;
    return this.load({ kind: 'blank' }, '', options.signal);
  }

  can(command: DocxCommand | DocxEdit) {
    return this.session?.can(command) ?? { enabled: false, reason: 'not-ready' as const };
  }

  /** Execute a supported formatting, editing or history command. */
  execute(command: DocxCommand | DocxEdit, options: { expectedRevision?: DocxRevision; selection?: DocxSelectionLease } = {}): DocxResult<DocxRevision> {
    if (!this.session) return refused('not-ready');
    const result = this.session.execute(command, options);
    this.syncSession();
    return result;
  }

  /** Inspect paragraph styles in the open document on demand. */
  paragraphStyles() { return this.session?.paragraphStyles() ?? refused('not-ready'); }

  /** Inspect candidate font families on demand; this does not load font assets. */
  fontFamilies() { return this.session?.fontFamilies() ?? refused('not-ready'); }

  /** Read complete bounded title and description from the settled image cache, without changing selection. */
  imageDescription(): DocxResult<Readonly<DocxImageDescription>> {
    return this.session?.imageDescription() ?? refused('not-ready');
  }

  /** Select an eligible body image in document order, wrapping without changing document content. */
  selectImage(direction: DocxImageDirection): DocxResult<void> {
    const result = this.session?.selectImage(direction) ?? refused<void>('not-ready');
    this.syncSession();
    return result;
  }

  /** Cached advisory caret availability; insertion verifies the package and exact original intent. */
  canInsertImage(): DocxCommandAvailability {
    return this.session?.canInsertImage() ?? { enabled: false, reason: 'not-ready' };
  }

  /** Insert owned raster bytes at the original plain body caret. A committed original result survives replacement. */
  async insertImage(source: DocxImageSource, options?: DocxInsertImageOptions): Promise<DocxResult<DocxRevision>> {
    const owner = this.session;
    if (!owner) return refused('not-ready');
    const result = await owner.insertImage(source, options);
    if (this.session === owner) this.syncSession();
    return result;
  }

  /** Search the current revision without changing document content. */
  find(query: string, options: { matchCase?: boolean; wholeWord?: boolean; limit?: number } = {}) {
    return this.session?.find(query, options) ?? refused('not-ready');
  }

  /** Navigate to a revision-stamped result of the latest search. */
  selectMatch(id: string, options: { expectedRevision?: DocxRevision } = {}) {
    if (!this.session) return refused<void>('not-ready');
    const result = this.session.selectMatch(id, options);
    this.syncSession();
    return result;
  }

  /** Replace one match, including deletion with an empty string. */
  replaceMatch(id: string, text: string, options: { expectedRevision?: DocxRevision } = {}) {
    if (!this.session) return refused<DocxRevision>('not-ready');
    const result = this.session.replaceMatch(id, text, options);
    this.syncSession();
    return result;
  }

  /** Serialize explicitly; persistence is owned by the caller. */
  async save(options: { signal?: AbortSignal; expectedRevision?: DocxRevision } = {}): Promise<DocxResult<DocxSaveReceipt>> {
    if (!this.session) return refused('not-ready');
    const session = this.session;
    const result = await session.save(options);
    if (this.session !== session) return refused('destroyed');
    this.syncSession();
    if (result.ok) {
      this.localError = null;
      this.emit('lr-save', { receipt: result.value });
    }
    else if (this.snapshot()?.status !== 'error' &&
      ['save-failed', 'engine-failed', 'resource-limit'].includes(result.code)) this.reportError(result.code);
    return result;
  }

  /** Mark a genuine save receipt persisted by the host. */
  acknowledgeSaved(receipt: DocxSaveReceipt): DocxResult<void> {
    if (!this.session) return refused('not-ready');
    const result = this.session.acknowledgeSaved(receipt);
    this.syncSession();
    return result;
  }

  /** Return keyboard focus to the editing surface. */
  focusEditor(): DocxResult<void> { return this.session?.focus() ?? refused('not-ready'); }

  /** Dirty content worth confirming: an edited single page with no text, picture or table has nothing to lose. */
  private hasUnsavedContent(): boolean {
    if (!this.currentSnapshot?.dirty) return false;
    const pages = this.mount?.querySelectorAll('.docx-page');
    if (pages?.length !== 1) return true;
    const page = pages[0]!;
    return Boolean(page.textContent?.trim()) || page.querySelector('img, svg, table, .docx-drawing, .docx-table') !== null;
  }

  private releaseToolbarSelection(): void {
    this.toolbarSelection?.release();
    this.toolbarSelection = null;
  }

  private retainToolbarSelection(): void {
    if (this.toolbarSelection) return;
    const result = this.session?.retainSelection();
    if (result?.ok) this.toolbarSelection = result.value;
  }

  private reportEditRefusal(code: DocxRefusalCode): void {
    this.editError = code;
    this.emit('lr-error', { code });
    if (this.announcementsArmed) this.assertiveSink?.announce(this.localize('docxEditorEditUnavailable'));
  }

  private runEdit(edit: DocxEdit, returnFocus = true): void {
    const lease = this.toolbarSelection;
    this.toolbarSelection = null;
    const result = this.execute(edit, lease ? { selection: lease } : {});
    lease?.release();
    if (result.ok) this.editError = null;
    else this.reportEditRefusal(result.code);
    if (returnFocus) this.focusEditor();
  }

  private loadParagraphStyles(): void {
    this.pickerFocusReturn = false;
    this.retainToolbarSelection();
    const result = this.paragraphStyles();
    if (result.ok) this.paragraphStyleItems = result.value.items;
    else this.reportEditRefusal(result.code);
  }

  private loadFontFamilies(): void {
    this.pickerFocusReturn = false;
    this.retainToolbarSelection();
    const result = this.fontFamilies();
    if (result.ok) this.fontFamilyItems = result.value.items;
    else this.reportEditRefusal(result.code);
  }

  private onParagraphStyleChange(event: CustomEvent<{ value: string | string[] }>): void {
    event.stopPropagation();
    if (typeof event.detail.value === 'string' && event.detail.value) {
      this.pickerFocusReturn = true;
      this.runEdit({ type: 'paragraph-style', styleId: event.detail.value }, false);
    }
  }

  private onFontFamilyChange(event: CustomEvent<{ value: string | string[] }>): void {
    event.stopPropagation();
    if (typeof event.detail.value === 'string' && event.detail.value) {
      this.pickerFocusReturn = true;
      this.runEdit({ type: 'font-family', family: event.detail.value }, false);
    }
  }

  private onFontSizeChange(event: CustomEvent<{ value: string }>): void {
    event.stopPropagation();
    const points = Number(event.detail.value);
    this.runEdit({ type: 'font-size', points });
  }

  private toolPanel(part: string) {
    return this.renderRoot.querySelector<HTMLElement & { hide(options?: { focusTrigger?: boolean }): Promise<void> }>(`[part="${part}"]`);
  }

  /** Apply a color tool's edit; palette picks close their popover and return to the document. */
  private applyPopoverEdit(edit: DocxEdit, close: string | null): void {
    this.pickerFocusReturn = close !== null;
    this.runEdit(edit, false);
    if (this.editError) return;
    if (edit.type === 'text-color' && edit.color !== 'auto') this.lastTextColor = edit.color;
    if (edit.type === 'highlight' && edit.color !== 'none') this.lastHighlight = edit.color;
    if (close) void this.toolPanel(close)?.hide({ focusTrigger: false });
  }

  /** Palette clicks and Enter/Space apply; arrow keys only move between swatches. */
  private onSwatchActivation(event: Event, apply: (value: string) => void): void {
    if (event instanceof KeyboardEvent && event.key !== 'Enter' && event.key !== ' ') return;
    const value = (event.currentTarget as HTMLElement & { value: string | null }).value;
    if (event instanceof KeyboardEvent) event.preventDefault();
    if (value) apply(value);
  }

  private onCustomColorChange(event: Event): void {
    event.stopPropagation();
    const color = (event.currentTarget as HTMLElement & { value: string }).value;
    if (/^#[0-9a-f]{6}$/i.test(color)) this.applyPopoverEdit({ type: 'text-color', color }, null);
  }

  private onPickerClosed(): void {
    this.releaseToolbarSelection();
    if (this.pickerFocusReturn) {
      this.pickerFocusReturn = false;
      queueMicrotask(() => { if (this.isConnected) this.focusEditor(); });
    }
  }

  private openLinkEditor(): void {
    this.retainToolbarSelection();
    this.linkHref = '';
    this.linkText = '';
  }

  private closeLinkEditor(returnFocus = true): void {
    const popover = this.renderRoot.querySelector<HTMLElement & { hide(options?: { focusTrigger?: boolean }): Promise<void> }>('[part="link-popover"]');
    void popover?.hide({ focusTrigger: false }).then(() => {
      this.releaseToolbarSelection();
      if (returnFocus) this.focusEditor();
    });
  }

  private applyLink(): void {
    this.runEdit(this.linkEdit(), false);
    if (this.editError === null) this.closeLinkEditor();
  }

  private linkEdit(): DocxEdit {
    const href = this.linkHref.trim();
    const text = this.linkText;
    return text ? { type: 'link', href, text } : { type: 'link', href };
  }

  private applyZoom(): void {
    const session = this.session;
    if (!session || this.currentSnapshot?.status !== 'ready') return;
    const zoom = zoomConverter.fromAttribute(String(this.zoom));
    if (this.appliedZoom?.session === session && this.appliedZoom.zoom === zoom) return;
    if (setInternalDocxZoom(session, zoom)) this.appliedZoom = { session, zoom };
  }

  private renderZoom(): TemplateResult {
    const ready = this.currentSnapshot?.status === 'ready';
    const percent = new Intl.NumberFormat(this.effectiveLocale, { style: 'percent' });
    return html`<${selectTag} part="zoom" size="s" aria-label=${this.localize('docxEditorZoom')} ?disabled=${!ready}
      .value=${String(this.zoom)}
      @lr-change=${(event: CustomEvent<{ value: string | string[] }>) => {
        event.stopPropagation();
        if (typeof event.detail.value === 'string') this.zoom = zoomConverter.fromAttribute(event.detail.value);
      }}>
      <${optionTag} value="fit">${this.localize('docxEditorZoomFit')}</${optionTag}>
      ${zoomLevels.map(level => html`<${optionTag} value=${String(level)}>${percent.format(level)}</${optionTag}>`)}
    </${selectTag}>`;
  }

  private refreshTableLabels(): void {
    const session = this.session;
    if (!session) return;
    const row = this.localize('docxEditorTableRowBelow');
    const column = this.localize('docxEditorTableColumnRight');
    const previous = this.tableLabelState;
    if (previous?.session === session && previous.row === row && previous.column === column) return;
    if (refreshInternalDocxTableLabels(session, { insertRowBelow: row, insertColumnRight: column }))
      this.tableLabelState = { session, row, column };
  }

  private tablePopover() {
    return this.renderRoot.querySelector<HTMLElement & { open: boolean; hide(options?: { focusTrigger?: boolean }): Promise<void> }>(
      '[part="table-insert-popover"]');
  }

  private releaseTableIntent(): void {
    this.tableIntent?.release();
    this.tableIntent = null;
  }

  private prepareTableIntent(): void {
    if (this.tableDialogOpen) return;
    this.releaseToolbarSelection();
    this.releaseTableIntent();
    this.tableIntent = captureTableToolIntent(this.session);
  }

  private onTableActivationKey(event: KeyboardEvent): void {
    if ((event.key === 'Enter' || event.key === ' ') && !event.isComposing && event.keyCode !== 229) this.prepareTableIntent();
  }

  private openTableDialog(event: Event): void {
    if (!this.tableIntent?.valid(this.session)) { event.preventDefault(); this.releaseTableIntent(); return; }
    this.tableDialogGeneration++;
    this.cancelTableFocusReturn?.();
    this.tableRows = '2';
    this.tableColumns = '2';
    this.tableDialogOpen = true;
    this.editError = null;
  }

  private onTableDialogHidden(): void {
    if (this.tablePopover()?.open) return;
    this.tableDialogOpen = false;
    this.releaseTableIntent();
  }

  private closeTableDialog(returnToEditor: boolean): void {
    this.cancelTableFocusReturn?.();
    const session = this.session;
    const generation = this.tableDialogGeneration;
    const selectionVersion = session?.snapshot().selection.version;
    const popover = this.tablePopover();
    if (!popover) return;
    const document = this.ownerDocument;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      document.removeEventListener('focusin', cancel, true);
      document.removeEventListener('pointerdown', cancel, true);
      if (this.cancelTableFocusReturn === cancel) this.cancelTableFocusReturn = null;
    };
    this.cancelTableFocusReturn = cancel;
    document.addEventListener('focusin', cancel, true);
    document.addEventListener('pointerdown', cancel, true);
    void popover.hide({ focusTrigger: false }).then(() => {
      const shouldFocus = !cancelled && this.isConnected && this.session === session && generation === this.tableDialogGeneration &&
        !popover.open && session?.snapshot().selection.version === selectionVersion;
      cancel();
      if (!shouldFocus) return;
      if (returnToEditor) this.focusEditor();
      else this.renderRoot.querySelector<HTMLElement>('[part="table-insert-trigger"]')?.focus();
    }, cancel);
  }

  private runTableEdit(action: DocxTableAction, fromDialog = false): void {
    const session = this.session;
    const intent = this.tableIntent;
    const result = intent?.execute(session, action) ?? refused<DocxRevision>('stale-selection');
    this.syncSession();
    if (result.ok) {
      this.editError = null;
      if (fromDialog) this.closeTableDialog(true);
      else if (this.isConnected && this.session === session) this.focusEditor();
    } else this.reportEditRefusal(result.code);
    if (!fromDialog) this.releaseTableIntent();
  }

  private insertTable(): void {
    const action = tableInsertDraft(this.tableRows, this.tableColumns);
    if (!action) return;
    this.runTableEdit(action, true);
  }

  private insertionPopover() {
    return this.renderRoot.querySelector<HTMLElement & { open: boolean; show(): Promise<void>; hide(options?: { focusTrigger?: boolean }): Promise<void> }>(
      '[part="image-insert-dialog"]');
  }

  private resetImageInsertion(hide = true): void {
    this.insertionGeneration++;
    this.cancelInsertionFocusReturn?.();
    this.insertionIntent?.release();
    this.insertionIntent = null;
    this.insertionBytes = null;
    this.insertionDefaults = null;
    this.insertionAwaitingPicker = false;
    this.insertionPhase = 'idle';
    this.insertionWidth = '';
    this.insertionHeight = '';
    this.insertionKeepRatio = true;
    this.insertionTitle = '';
    this.insertionDescription = '';
    this.insertionError = null;
    const input = this.renderRoot.querySelector<HTMLInputElement>('[part="image-insert-file"]');
    if (input) input.value = '';
    if (hide) void this.insertionPopover()?.hide({ focusTrigger: false });
  }

  private prepareImageInsertion(): void {
    if (this.insertionPhase !== 'idle') return;
    if (this.insertionIntent?.valid(this.session)) return;
    this.resetImageInsertion(false);
    this.releaseToolbarSelection();
    this.insertionIntent = captureImageInsertionIntent(this.session);
  }

  private onImageInsertionKey(event: KeyboardEvent): void {
    if ((event.key === 'Enter' || event.key === ' ') && !event.isComposing && event.keyCode !== 229)
      this.prepareImageInsertion();
  }

  private openImageInsertionPicker(): void {
    if (this.insertionPhase !== 'idle') return;
    this.prepareImageInsertion();
    if (!this.insertionIntent?.valid(this.session) || !this.canInsertImage().enabled) {
      this.cancelImageInsertion(false); return;
    }
    const input = this.renderRoot.querySelector<HTMLInputElement>('[part="image-insert-file"]');
    if (!input) { this.cancelImageInsertion(false); return; }
    input.value = '';
    this.insertionAwaitingPicker = true;
    this.insertionPhase = 'reading';
    input.click();
  }

  private cancelImageInsertion(returnFocus: boolean): void {
    if (this.insertionPhase === 'dispatched' || (!this.insertionIntent && this.insertionPhase === 'idle')) return;
    const owner = this.session, selectionVersion = owner?.snapshot().selection.version, popover = this.insertionPopover();
    this.resetImageInsertion(false);
    const generation = this.insertionGeneration;
    if (!returnFocus || !popover) { void popover?.hide({ focusTrigger: false }); return; }
    const document = this.ownerDocument;
    let cancelled = false;
    const cancel = () => {
      cancelled = true; document.removeEventListener('focusin', cancel, true); document.removeEventListener('pointerdown', cancel, true);
      if (this.cancelInsertionFocusReturn === cancel) this.cancelInsertionFocusReturn = null;
    };
    this.cancelInsertionFocusReturn = cancel;
    document.addEventListener('focusin', cancel, true); document.addEventListener('pointerdown', cancel, true);
    void popover.hide({ focusTrigger: false }).then(async () => {
      await this.updateComplete;
      if (cancelled || !this.isConnected || this.session !== owner || generation !== this.insertionGeneration || popover.open) {
        cancel(); return;
      }
      const trigger = this.renderRoot.querySelector<LyraElement>('[part="image-insert-trigger"]');
      await trigger?.updateComplete;
      const restore = !cancelled && this.isConnected && this.session === owner && generation === this.insertionGeneration &&
        !popover.open && trigger?.isConnected && this.renderRoot.contains(trigger) &&
        owner?.snapshot().activity === null && owner.snapshot().selection.version === selectionVersion;
      cancel();
      if (restore) trigger.focus();
    }).catch(cancel);
  }

  private onImageInsertionHide(event: Event): void {
    if (this.insertionPhase !== 'reading' && this.insertionPhase !== 'draft') return;
    event.preventDefault();
    const owner = this.session, popover = this.insertionPopover();
    this.resetImageInsertion(false);
    const generation = this.insertionGeneration;
    // End the current lifecycle request before closing with explicit focus ownership.
    queueMicrotask(() => {
      if (this.isConnected && this.session === owner && generation === this.insertionGeneration &&
          popover === this.insertionPopover() && popover?.open) void popover.hide({ focusTrigger: false });
    });
  }

  private handoffImageInsertion(event: Event): void {
    if (this.insertionPhase !== 'reading' && this.insertionPhase !== 'draft') return;
    const otherTool = event.composedPath().some(node => node instanceof HTMLElement && this.renderRoot.contains(node) &&
      node.hasAttribute('data-tool-key') && node.getAttribute('data-tool-key') !== 'image-insert');
    if (otherTool) this.cancelImageInsertion(false);
  }

  private insertionFeedback(code: DocxRefusalCode): string {
    return this.localize(code === 'resource-limit' ? 'docxEditorImageInsertLimit' :
      code === 'invalid-document' ? 'docxEditorImageInsertInvalid' : code === 'unsupported' ? 'docxEditorImageInsertUnsupported' :
        code === 'stale-selection' || code === 'stale-revision' ? 'docxEditorImageInsertStale' : 'docxEditorImageInsertRefused');
  }

  private refuseImageInsertion(code: DocxRefusalCode, owner: DocxSession | null, generation: number): void {
    if (!this.isConnected || this.session !== owner || this.insertionGeneration !== generation) return;
    this.cancelImageInsertion(false);
    if (!this.isConnected || this.session !== owner || this.insertionGeneration !== generation + 1) return;
    this.insertionError = code;
    if (this.announcementsArmed) this.assertiveSink?.announce(this.insertionFeedback(code));
  }

  private readImageInsertionFile = async (event: Event): Promise<void> => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.item(0);
    input.value = '';
    if (!this.insertionAwaitingPicker || this.insertionPhase !== 'reading') return;
    this.insertionAwaitingPicker = false;
    if (!file) { this.cancelImageInsertion(true); return; }
    const owner = this.session, intent = this.insertionIntent, generation = this.insertionGeneration;
    const valid = () => this.isConnected && this.session === owner && this.insertionIntent === intent &&
      this.insertionGeneration === generation && this.insertionPhase === 'reading' && Boolean(intent?.valid(owner));
    try {
      if (!valid()) { this.refuseImageInsertion('stale-selection', owner, generation); return; }
      if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > maxImageBytes) {
        this.refuseImageInsertion('resource-limit', owner, generation); return;
      }
      await this.updateComplete;
      if (!valid()) { this.refuseImageInsertion('stale-selection', owner, generation); return; }
      const popover = this.insertionPopover();
      if (!popover) { this.refuseImageInsertion('not-ready', owner, generation); return; }
      await popover.show();
      if (!valid()) { this.refuseImageInsertion('stale-selection', owner, generation); return; }
      if (!popover.open) { this.cancelImageInsertion(false); return; }
      const buffer = await file.arrayBuffer();
      if (!valid()) { this.refuseImageInsertion('stale-selection', owner, generation); return; }
      if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 1 || buffer.byteLength > maxImageBytes) {
        this.refuseImageInsertion('resource-limit', owner, generation); return;
      }
      let bytes: Uint8Array = new Uint8Array(buffer), inspected = inspectDocxImage(bytes);
      if (inspected.ok && inspected.value.hasJpegApp1) {
        // Phone and camera photos carry EXIF/XMP (often location); insert the picture without it.
        const stripped = withoutJpegApp1(bytes);
        if (stripped) { bytes = stripped; inspected = inspectDocxImage(bytes); }
      }
      if (!inspected.ok) { this.refuseImageInsertion(inspected.code, owner, generation); return; }
      if (inspected.value.hasJpegApp1) { this.refuseImageInsertion('unsupported', owner, generation); return; }
      const defaults = imageInsertionDefaults(inspected.value.pixelWidth, inspected.value.pixelHeight);
      if (!defaults) { this.refuseImageInsertion('invalid-document', owner, generation); return; }
      if (!valid()) { this.refuseImageInsertion('stale-selection', owner, generation); return; }
      this.insertionBytes = bytes;
      this.insertionDefaults = defaults;
      this.insertionWidth = defaults.width;
      this.insertionHeight = defaults.height;
      this.insertionKeepRatio = defaults.ratioAvailable;
      this.insertionTitle = '';
      this.insertionDescription = '';
      this.insertionPhase = 'draft';
      await this.updateComplete;
      const active = this.shadowRoot?.activeElement;
      if (this.isConnected && this.session === owner && generation === this.insertionGeneration && intent?.valid(owner) &&
          this.insertionPhase === 'draft' && popover.open && active?.closest('[part="image-insert-dialog"]') === popover)
        this.renderRoot.querySelector<HTMLElement>('[part="image-insert-width"]')?.focus();
    } catch {
      this.refuseImageInsertion('invalid-document', owner, generation);
    }
  };

  private changeInsertionDimension(event: CustomEvent<{ value: string }>, axis: 'width' | 'height'): void {
    event.stopPropagation();
    const value = event.detail.value;
    if (axis === 'width') this.insertionWidth = value;
    else this.insertionHeight = value;
    if (!this.insertionKeepRatio || !this.insertionDefaults?.ratioAvailable) return;
    const partner = imageRatioPartner(value, axis, this.insertionDefaults.original);
    if (axis === 'width') this.insertionHeight = partner ?? '';
    else this.insertionWidth = partner ?? '';
  }

  private dispatchImageInsertion(): void {
    const owner = this.session, intent = this.insertionIntent, generation = this.insertionGeneration;
    const source = this.insertionBytes && imageInsertionDraft(this.insertionBytes, this.insertionWidth,
      this.insertionHeight, this.insertionTitle, this.insertionDescription);
    if (this.insertionPhase !== 'draft' || !owner || !intent?.valid(owner) || !source || !this.canInsertImage().enabled) return;
    const popover = this.insertionPopover();
    this.insertionPhase = 'dispatched';
    this.insertionIntent = null;
    this.insertionBytes = null;
    this.insertionDefaults = null;
    this.insertionWidth = ''; this.insertionHeight = ''; this.insertionTitle = ''; this.insertionDescription = '';
    const document = this.ownerDocument;
    let focusCancelled = false;
    const cancelFocus = () => {
      focusCancelled = true;
      document.removeEventListener('focusin', cancelFocus, true);
      document.removeEventListener('pointerdown', cancelFocus, true);
      if (this.cancelInsertionFocusReturn === cancelFocus) this.cancelInsertionFocusReturn = null;
    };
    this.cancelInsertionFocusReturn = cancelFocus;
    document.addEventListener('focusin', cancelFocus, true);
    document.addEventListener('pointerdown', cancelFocus, true);
    const pending = intent.dispatch(source);
    void popover?.hide({ focusTrigger: false });
    const complete = (result: DocxResult<DocxRevision>) => {
      const restoreFocus = !focusCancelled;
      cancelFocus();
      if (!this.isConnected || this.session !== owner || this.insertionGeneration !== generation) return;
      this.insertionPhase = 'idle';
      this.insertionError = result.ok ? null : result.code;
      if (this.announcementsArmed) {
        if (result.ok) this.politeSink?.announce(this.localize('docxEditorImageInserted'));
        else this.assertiveSink?.announce(this.insertionFeedback(result.code));
      }
      if (result.ok && restoreFocus && this.isConnected && this.session === owner && this.insertionGeneration === generation) this.focusEditor();
    };
    void pending.then(complete, () => complete(refused('engine-failed')));
  }

  private imagePopover(kind: 'resize' | 'description') {
    return this.renderRoot.querySelector<HTMLElement & { open: boolean; hide(options?: { focusTrigger?: boolean }): Promise<void> }>(
      `[part="image-${kind}-popover"]`);
  }

  private navigateImage(direction: DocxImageDirection): void {
    const result = this.selectImage(direction);
    this.imageNavigationEmpty = !result.ok && result.code === 'no-selection';
    if (result.ok) this.editError = null;
    else if (result.code === 'no-selection') {
      if (this.announcementsArmed) this.politeSink?.announce(this.localize('docxEditorNoImage'));
    } else this.reportEditRefusal(result.code);
  }

  private releaseImageIntent(): void {
    this.imageIntent?.release();
    this.imageIntent = null;
  }

  private prepareImageIntent(): void {
    if (this.imageDialog) return;
    this.releaseToolbarSelection();
    this.releaseImageIntent();
    this.imageIntent = captureImageToolIntent(this.session);
  }

  private onImageActivationKey(event: KeyboardEvent): void {
    if ((event.key === 'Enter' || event.key === ' ') && !event.isComposing && event.keyCode !== 229) this.prepareImageIntent();
  }

  private openImageDialog(event: Event, kind: 'resize' | 'description'): void {
    const intent = this.imageIntent;
    if (!intent?.valid(this.session)) { event.preventDefault(); this.releaseImageIntent(); return; }
    if (kind === 'description') {
      const description = intent.description(this.session);
      if (!description.ok) {
        event.preventDefault(); this.releaseImageIntent(); this.reportEditRefusal(description.code); return;
      }
      this.imageTitle = description.value.title;
      this.imageDescriptionText = description.value.description;
    } else {
      this.imageWidth = imageDimensionDraft(intent.image.widthPoints);
      this.imageHeight = imageDimensionDraft(intent.image.heightPoints);
      this.imageKeepRatio = true;
    }
    this.imageDialogGeneration++;
    this.cancelImageFocusReturn?.();
    this.imageDialog = kind;
    this.editError = null;
  }

  private onImageFieldFocus(event: FocusEvent, insertion = false): void {
    const fields = event.currentTarget;
    const kind = insertion ? 'insert' : this.imageDialog;
    if (!event.isTrusted || !(fields instanceof HTMLElement) || !kind) return;
    const popover = kind === 'insert' ? this.insertionPopover() : this.imagePopover(kind);
    const generation = insertion ? this.insertionGeneration : this.imageDialogGeneration;
    const parts = ['image-width', 'image-height', 'image-ratio', 'image-title', 'image-description',
      'image-resize-apply', 'image-resize-cancel', 'image-description-apply', 'image-description-cancel',
      'image-insert-width', 'image-insert-height', 'image-insert-ratio', 'image-insert-title',
      'image-insert-description', 'image-insert-apply', 'image-insert-cancel'];
    const path = event.composedPath();
    const host = path.find(node => node instanceof HTMLElement && fields.contains(node) &&
      parts.includes(node.getAttribute('part') ?? '')) as HTMLElement | undefined;
    const native = path.find(node => node instanceof HTMLElement) as HTMLElement | undefined;
    const owned = () => {
      let active = this.shadowRoot?.activeElement;
      if (active !== host) return false;
      while (active instanceof HTMLElement && active.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      const current = insertion ? (this.insertionPhase === 'reading' || this.insertionPhase === 'draft') &&
        generation === this.insertionGeneration : this.imageDialog === kind && generation === this.imageDialogGeneration;
      return active === native && this.isConnected && current &&
        popover?.open && fields === popover.querySelector(`[part="image-${kind}-fields"]`);
    };
    if (!host || !native || !owned()) return;
    const content = popover?.shadowRoot?.querySelector<HTMLElement>('[part~="content"]');
    if (!content?.offsetHeight || !content.clientHeight) return;
    const clip = content.getBoundingClientRect();
    const scale = clip.height / content.offsetHeight;
    if (!Number.isFinite(scale) || scale <= 0) return;
    const top = Math.max(0, clip.top + content.clientTop * scale);
    const bottom = Math.min(this.ownerDocument.defaultView?.innerHeight ?? 0,
      clip.top + (content.clientTop + content.clientHeight) * scale);
    const box = host.getBoundingClientRect(), nativeBox = native.getBoundingClientRect();
    const target = box.height <= bottom - top ? box : nativeBox.height <= bottom - top ? nativeBox : null;
    // Oversized controls keep the browser's own caret scrolling.
    if (!target || bottom <= top) return;
    const delta = target.top < top ? target.top - top : target.bottom > bottom ? target.bottom - bottom : 0;
    const next = Math.min(Math.max(0, content.scrollTop + delta / scale), Math.max(0, content.scrollHeight - content.clientHeight));
    if (Number.isFinite(next) && next !== content.scrollTop && owned()) content.scrollTop = next;
  }

  private onImageDialogHidden(kind: 'resize' | 'description'): void {
    if (this.imagePopover(kind)?.open || this.imageDialog !== kind) return;
    this.imageDialog = null;
    this.releaseImageIntent();
  }

  private closeImageDialog(returnToEditor: boolean): void {
    const kind = this.imageDialog;
    if (!kind) return;
    this.cancelImageFocusReturn?.();
    const session = this.session;
    const generation = this.imageDialogGeneration;
    const selectionVersion = session?.snapshot().selection.version;
    const popover = this.imagePopover(kind);
    if (!popover) return;
    const document = this.ownerDocument;
    let cancelled = false;
    const cancel = () => {
      cancelled = true;
      document.removeEventListener('focusin', cancel, true);
      document.removeEventListener('pointerdown', cancel, true);
      if (this.cancelImageFocusReturn === cancel) this.cancelImageFocusReturn = null;
    };
    this.cancelImageFocusReturn = cancel;
    document.addEventListener('focusin', cancel, true);
    document.addEventListener('pointerdown', cancel, true);
    void popover.hide({ focusTrigger: false }).then(() => {
      const shouldFocus = !cancelled && this.isConnected && this.session === session && generation === this.imageDialogGeneration &&
        !popover.open && session?.snapshot().selection.version === selectionVersion;
      cancel();
      if (!shouldFocus) return;
      if (returnToEditor) this.focusEditor();
      else this.renderRoot.querySelector<HTMLElement>(`[part="image-${kind}-trigger"]`)?.focus();
    }, cancel);
  }

  private changeImageDimension(event: CustomEvent<{ value: string }>, axis: 'width' | 'height'): void {
    event.stopPropagation();
    const value = event.detail.value;
    if (axis === 'width') this.imageWidth = value;
    else this.imageHeight = value;
    if (!this.imageKeepRatio || !this.imageIntent) return;
    const partner = imageRatioPartner(value, axis, this.imageIntent.image);
    if (axis === 'width') this.imageHeight = partner ?? '';
    else this.imageWidth = partner ?? '';
  }

  private runImageEdit(action: DocxImageAction, fromDialog = false): void {
    const session = this.session;
    const result = this.imageIntent?.execute(session, action) ?? refused<DocxRevision>('stale-selection');
    this.syncSession();
    if (result.ok) {
      this.editError = null;
      if (fromDialog) this.closeImageDialog(true);
      else if (this.isConnected && this.session === session) this.focusEditor();
    } else this.reportEditRefusal(result.code);
    if (!fromDialog) this.releaseImageIntent();
  }

  private applyImageResize(): void {
    let action = imageResizeDraft(this.imageWidth, this.imageHeight);
    if (!action || !this.imageIntent) return;
    if (imageResizeUnchanged(action, this.imageIntent.image)) action = { type: 'resize-image', ...this.imageIntent.image };
    this.runImageEdit(action, true);
  }

  private applyImageDescription(): void {
    const action = imageDescriptionDraft(this.imageTitle, this.imageDescriptionText);
    if (action) this.runImageEdit(action, true);
  }

  private imageHandlesAvailable(): boolean {
    const snapshot = this.currentSnapshot;
    return Boolean(snapshot?.image) && snapshot?.status === 'ready' && !snapshot.readOnly && !snapshot.composing &&
      snapshot.activity === null && this.imageDialog === null && this.can({ type: 'delete-image' }).enabled;
  }

  private scheduleImageFrame = (): void => {
    const view = this.ownerDocument.defaultView;
    if (!view || this.imageFrameRequest) return;
    this.imageFrameRequest = view.requestAnimationFrame(() => {
      this.imageFrameRequest = 0;
      this.syncImageFrame();
      this.syncCharts();
    });
  };

  /** Track the painted selected image in document-part coordinates, clipped to the visible viewport. */
  private syncImageFrame(): void {
    if (!this.isConnected) return;
    const image = this.imageHandlesAvailable() || this.imageDrag ? internalDocxSelectedImageElement(this.session) : null;
    if (image !== this.observedImage) {
      this.imageFrameObserver?.disconnect();
      this.observedImage = image;
      const Observer = this.ownerDocument.defaultView?.ResizeObserver;
      if (image && Observer) {
        this.imageFrameObserver ??= new Observer(() => this.scheduleImageFrame());
        this.imageFrameObserver.observe(image);
        const documentPart = this.renderRoot.querySelector('[part="document"]');
        if (documentPart) this.imageFrameObserver.observe(documentPart);
      }
    }
    const documentPart = this.renderRoot.querySelector<HTMLElement>('[part="document"]');
    const viewport = this.mount?.querySelector<HTMLElement>('[data-lr-docx-viewport]');
    const next = (() => {
      if (!image || !documentPart || !viewport) return null;
      const box = image.getBoundingClientRect(), outer = documentPart.getBoundingClientRect(), view = viewport.getBoundingClientRect();
      if (!box.width || !box.height) return null;
      const originX = outer.left + documentPart.clientLeft - documentPart.scrollLeft;
      const originY = outer.top + documentPart.clientTop - documentPart.scrollTop;
      const clipLeft = view.left + viewport.clientLeft, clipTop = view.top + viewport.clientTop;
      const round = (value: number) => Math.round(value * 100) / 100;
      return {
        left: round(clipLeft - originX), top: round(clipTop - originY),
        width: round(viewport.clientWidth), height: round(viewport.clientHeight),
        frame: { left: round(box.left - clipLeft), top: round(box.top - clipTop), width: round(box.width), height: round(box.height) },
      };
    })();
    const previous = this.imageClip;
    if (next === previous || (next && previous && next.left === previous.left && next.top === previous.top &&
        next.width === previous.width && next.height === previous.height && next.frame.left === previous.frame.left &&
        next.frame.top === previous.frame.top && next.frame.width === previous.frame.width && next.frame.height === previous.frame.height)) return;
    this.imageClip = next;
    if (!next && this.imageDrag) this.cancelImageDrag();
  }

  /** The visible document viewport in document-part coordinates, plus its viewport-space origin. */
  private overlayClip(): (ImageFrame & { x: number; y: number }) | null {
    const documentPart = this.renderRoot.querySelector<HTMLElement>('[part="document"]');
    const viewport = this.mount?.querySelector<HTMLElement>('[data-lr-docx-viewport]');
    if (!documentPart || !viewport) return null;
    const outer = documentPart.getBoundingClientRect(), view = viewport.getBoundingClientRect();
    const x = view.left + viewport.clientLeft, y = view.top + viewport.clientTop;
    const round = (value: number) => Math.round(value * 100) / 100;
    return { x, y, left: round(x - outer.left - documentPart.clientLeft + documentPart.scrollLeft),
      top: round(y - outer.top - documentPart.clientTop + documentPart.scrollTop), width: round(viewport.clientWidth), height: round(viewport.clientHeight) };
  }

  /** Paint supported charts over the engine's chart placeholders, following scroll, zoom and reflow. */
  private syncCharts(): void {
    if (!this.isConnected) return;
    const placements = this.currentSnapshot?.status === 'ready' ? internalDocxCharts(this.session) : [];
    const surface = placements.length ? this.mount?.querySelector('[data-lr-docx-surface]') ?? null : null;
    if (surface !== this.observedSurface) {
      this.surfaceObserver?.disconnect();
      this.observedSurface = surface;
      const Observer = this.ownerDocument.defaultView?.ResizeObserver;
      if (surface && Observer) {
        this.surfaceObserver ??= new Observer(() => this.scheduleImageFrame());
        this.surfaceObserver.observe(surface);
      }
    }
    const clip = placements.length ? this.overlayClip() : null;
    let next: ChartLayer | null = null;
    if (clip && this.mount) {
      const painted = new Map<string, Element>();
      for (const node of this.mount.querySelectorAll('[data-drawing-node-id]')) painted.set(node.getAttribute('data-drawing-node-id')!, node);
      const round = (value: number) => Math.round(value * 100) / 100;
      const charts = placements.flatMap(placement => {
        const box = painted.get(placement.drawingId)?.getBoundingClientRect();
        return box?.width && box.height ? [{ placement, frame: { left: round(box.left - clip.x), top: round(box.top - clip.y),
          width: round(box.width), height: round(box.height) } }] : [];
      });
      if (charts.length) next = { clip: { left: clip.left, top: clip.top, width: clip.width, height: clip.height }, charts };
    }
    const previous = this.chartLayer;
    const same = (a: ImageFrame, b: ImageFrame) => a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;
    if (next === previous || (next && previous && same(next.clip, previous.clip) && next.charts.length === previous.charts.length &&
        next.charts.every((chart, index) => chart.placement === previous.charts[index]!.placement && same(chart.frame, previous.charts[index]!.frame)))) return;
    this.chartLayer = next;
  }

  private renderCharts(): TemplateResult | typeof nothing {
    const layer = this.chartLayer;
    if (!layer) return nothing;
    const px = (value: number) => `${value}px`;
    return html`<div class="overlay-layer" inert aria-hidden="true"
      style=${styleMap({ left: px(layer.clip.left), top: px(layer.clip.top), width: px(layer.clip.width), height: px(layer.clip.height) })}>
      ${layer.charts.map(({ placement: { model }, frame }) => html`<div part="chart" data-chart-type=${model.type}
        style=${styleMap({ left: px(frame.left), top: px(frame.top), width: px(frame.width), height: px(frame.height) })}>
        ${model.title ? html`<div class="chart-title">${model.title}</div>` : nothing}
        <${liteChartTag} type=${model.type} ?stacked=${model.stacked} ?with-legend=${model.series.length > 1}
          height=${px(Math.max(32, frame.height - (model.title ? 20 : 0) - (model.series.length > 1 ? 24 : 0)))}
          label=${model.title || this.localize('docxEditorChart')} .labels=${model.labels}
          .datasets=${model.series.map((series, index) => ({ ...series, color: officeSeriesColors[index % officeSeriesColors.length] }))}></${liteChartTag}>
      </div>`)}
    </div>`;
  }

  private startImageDrag(event: PointerEvent, handle: ImageHandle): void {
    if (event.button !== 0 || this.imageDrag || !event.isPrimary) return;
    event.preventDefault();
    event.stopPropagation();
    const frame = this.imageClip?.frame;
    if (!frame || !this.imageHandlesAvailable()) return;
    this.releaseToolbarSelection();
    const intent = captureImageToolIntent(this.session);
    if (!intent) return;
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture?.(event.pointerId);
    this.imageDrag = { pointerId: event.pointerId, handle, x: event.clientX, y: event.clientY, start: { ...frame }, intent };
    this.imagePreview = { ...frame, ...intent.image };
  }

  private moveImageDrag(event: PointerEvent): void {
    const drag = this.imageDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    if (!drag.intent.valid(this.session)) { this.cancelImageDrag(); return; }
    const { start, handle, intent } = drag;
    const scaleX = intent.image.widthPoints / start.width, scaleY = intent.image.heightPoints / start.height;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    const east = handle.includes('e'), west = handle.includes('w'), south = handle.includes('s'), north = handle.includes('n');
    let width = start.width + (east ? dx : west ? -dx : 0);
    let height = start.height + (south ? dy : north ? -dy : 0);
    // Corners keep the picture's proportions like word processors do; Shift inverts that choice.
    if ((handle.length === 2) !== event.shiftKey) {
      const ratio = start.height / start.width;
      if (handle === 'n' || handle === 's') width = height / ratio;
      else if (handle === 'e' || handle === 'w') height = width * ratio;
      else if (Math.abs(width / start.width - 1) >= Math.abs(height / start.height - 1)) height = width * ratio;
      else width = height / ratio;
      const lower = Math.max(1 / scaleX / width, 1 / scaleY / height), upper = Math.min(1440 / scaleX / width, 1440 / scaleY / height);
      const factor = Math.min(Math.max(1, lower), upper);
      width *= factor; height *= factor;
    } else {
      width = Math.min(Math.max(width, 1 / scaleX), 1440 / scaleX);
      height = Math.min(Math.max(height, 1 / scaleY), 1440 / scaleY);
    }
    const points = (value: number) => Math.min(1440, Math.max(1, Math.round(value * 100) / 100));
    this.imagePreview = {
      left: west ? start.left + start.width - width : start.left, top: north ? start.top + start.height - height : start.top,
      width, height, widthPoints: points(width * scaleX), heightPoints: points(height * scaleY),
    };
  }

  private endImageDrag(event: PointerEvent): void {
    const drag = this.imageDrag, preview = this.imagePreview;
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    this.imageDrag = null;
    this.imagePreview = null;
    if (!preview) { drag.intent.release(); return; }
    const action = { type: 'resize-image', widthPoints: preview.widthPoints, heightPoints: preview.heightPoints } as const;
    if (imageResizeUnchanged(action, drag.intent.image)) { drag.intent.release(); return; }
    const session = this.session;
    const result = drag.intent.execute(session, action);
    this.syncSession();
    if (result.ok) {
      this.editError = null;
      if (this.isConnected && this.session === session) this.focusEditor();
    } else this.reportEditRefusal(result.code);
  }

  private cancelImageDrag(): void {
    const drag = this.imageDrag;
    this.imageDrag = null;
    this.imagePreview = null;
    drag?.intent.release();
  }

  private renderImageHandles(): TemplateResult | typeof nothing {
    const clip = this.imageClip;
    if (!clip) return nothing;
    const box = this.imagePreview ?? clip.frame;
    const px = (value: number) => `${value}px`;
    const preview = this.imagePreview;
    const dimension = (value: number) => value.toLocaleString(this.effectiveLocale, { maximumFractionDigits: 1 });
    return html`<div class="image-layer" style=${styleMap({ left: px(clip.left), top: px(clip.top), width: px(clip.width), height: px(clip.height) })}>
      <div part="image-frame" data-dragging=${preview ? 'true' : 'false'}
        style=${styleMap({ left: px(box.left), top: px(box.top), width: px(box.width), height: px(box.height) })}>
        ${imageHandles.map(handle => html`<span part="image-handle" data-handle=${handle} aria-hidden="true"
          @pointerdown=${(event: PointerEvent) => this.startImageDrag(event, handle)}
          @pointermove=${(event: PointerEvent) => this.moveImageDrag(event)}
          @pointerup=${(event: PointerEvent) => this.endImageDrag(event)}
          @pointercancel=${() => this.cancelImageDrag()}
          @lostpointercapture=${() => { if (this.imageDrag) this.cancelImageDrag(); }}></span>`)}
        ${preview ? html`<span part="image-size" aria-hidden="true">${this.localize('docxEditorImageDimensions', undefined,
          { width: dimension(preview.widthPoints), height: dimension(preview.heightPoints) })}</span>` : nothing}
      </div>
    </div>`;
  }

  private runFind(): void {
    if (!this.findActionAvailable() || !this.query) return;
    const result = this.find(this.query, { matchCase: this.matchCase, wholeWord: this.wholeWord, limit: 100 });
    if (!result.ok) { this.reportEditRefusal(result.code); return; }
    this.editError = null;
    this.searchResults = result.value;
    this.searchIndex = -1;
    if (this.announcementsArmed) this.politeSink?.announce(this.localize('docxEditorFindCount', undefined,
      { count: result.value.matches.length }));
  }

  private navigateMatch(direction: -1 | 1): void {
    if (!this.findActionAvailable()) return;
    const results = this.searchResults;
    if (!results?.matches.length) return;
    const index = this.searchIndex < 0 && direction === -1 ? results.matches.length - 1 :
      (this.searchIndex + direction + results.matches.length) % results.matches.length;
    const match = results.matches[index];
    if (!match) return;
    const result = this.selectMatch(match.id, { expectedRevision: results.revision });
    if (result.ok) { this.searchIndex = index; this.editError = null; }
    else { this.searchResults = null; this.searchIndex = -1; this.reportEditRefusal(result.code); }
  }

  private replaceCurrentMatch(): void {
    if (!this.findActionAvailable(true)) return;
    const results = this.searchResults;
    const match = results?.matches[this.searchIndex];
    if (!match || !results) return;
    const result = this.replaceMatch(match.id, this.replacement, { expectedRevision: results.revision });
    if (result.ok) {
      this.searchResults = null;
      this.searchIndex = -1;
      this.editError = null;
      if (this.announcementsArmed) this.politeSink?.announce(this.localize('docxEditorReplaced'));
    } else this.reportEditRefusal(result.code);
  }

  private findActionAvailable(replacing = false): boolean {
    const snapshot = this.currentSnapshot;
    return snapshot?.status === 'ready' && !snapshot.composing && snapshot.activity === null &&
      (!replacing || !snapshot.readOnly);
  }

  private onHostKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.imageDrag) {
      event.preventDefault(); event.stopPropagation(); this.cancelImageDrag(); return;
    }
    if (event.key === 'Escape' && !event.isComposing && event.keyCode !== 229 && (this.insertionPhase === 'reading' || this.insertionPhase === 'draft') &&
        event.composedPath().some(node => node instanceof HTMLElement && node.getAttribute('part') === 'image-insert-dialog')) {
      event.preventDefault(); event.stopPropagation(); this.cancelImageInsertion(true); return;
    }
    if (event.key === 'Escape' && this.insertionPhase === 'idle' && this.insertionIntent) this.cancelImageInsertion(false);
    if ((event.key === 'Enter' || event.key === ' ') && !event.isComposing && event.keyCode !== 229) this.handoffImageInsertion(event);
    if (event.altKey && event.key === 'F10') {
      event.preventDefault();
      event.stopPropagation();
      this.retainToolbarSelection();
      const targets = this.enabledToolbarButtons();
      const first = targets.find(target => target.getAttribute('data-tool-key') === 'bold') ?? targets[0];
      (first ?? this.renderRoot.querySelector<HTMLElement>('[part="new-button"]'))?.focus();
      if (first) this.toolbarKey = first.getAttribute('data-tool-key') ?? 'bold';
      return;
    }
    if ((event.isComposing || event.keyCode === 229) && event.composedPath().some(node => node instanceof HTMLElement &&
      ['table-insert-popover', 'image-resize-popover', 'image-description-popover', 'image-insert-dialog'].includes(node.getAttribute('part') ?? ''))) return;
    if (event.key === 'Escape' && this.imageDialog && event.composedPath().some(node => node instanceof HTMLElement &&
      node.getAttribute('part') === `image-${this.imageDialog}-popover`)) {
      event.preventDefault(); event.stopPropagation(); this.closeImageDialog(false); return;
    }
    if (event.key === 'Escape' && this.tableDialogOpen && event.composedPath().some(node => node instanceof HTMLElement &&
      node.getAttribute('part') === 'table-insert-popover')) {
      event.preventDefault();
      event.stopPropagation();
      this.closeTableDialog(false);
      return;
    }
    if (event.key === 'Escape' && this.pendingAction) {
      event.preventDefault();
      this.pendingAction = null;
      this.focusEditor();
      return;
    }
    if (event.key === 'Escape' && event.composedPath().some(node => node instanceof HTMLElement &&
      node.getAttribute('part') === 'link-popover')) {
      event.preventDefault();
      this.closeLinkEditor();
      return;
    }
    if (event.key === 'Escape' && this.findOpen && event.composedPath().some(node => node instanceof HTMLElement &&
      node.getAttribute('part') === 'find')) {
      event.preventDefault();
      this.findOpen = false;
      this.focusEditor();
      return;
    }
    if (event.key === 'Escape' && event.composedPath().some(node => node instanceof HTMLElement &&
      ['paragraph-style', 'font-family'].includes(node.getAttribute('part') ?? '') &&
      Boolean((node as HTMLElement & { open?: boolean }).open))) {
      this.pickerFocusReturn = true;
      return;
    }
    // An open tool panel closes itself and returns focus to its trigger, even while its trigger keeps focus.
    if (event.key === 'Escape' && ['text-color-popover', 'highlight-popover', 'line-spacing-popover'].some(part =>
      Boolean(this.renderRoot.querySelector<HTMLElement & { open?: boolean }>(`[part="${part}"]`)?.open))) {
      this.pickerFocusReturn = false;
      return;
    }
    const toolbarTarget = event.composedPath().find(node => node instanceof HTMLElement &&
      node.hasAttribute('data-tool-key') && this.renderRoot.contains(node));
    if (toolbarTarget && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      const targets = this.enabledToolbarButtons();
      if (targets.length === 0) return;
      event.preventDefault();
      const current = Math.max(0, targets.indexOf(toolbarTarget as HTMLElement));
      const forward = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? targets.length - 1 :
        event.key === forward ? (current + 1) % targets.length : (current - 1 + targets.length) % targets.length;
      const target = targets[next];
      if (target) {
        this.toolbarKey = target.getAttribute('data-tool-key') ?? 'bold';
        target.focus();
      }
      return;
    }
    if (event.key === 'Escape' && this.shadowRoot?.activeElement?.closest('[part="toolbar"]')) {
      event.preventDefault();
      this.releaseToolbarSelection();
      this.focusEditor();
    }
  };

  /** A trigger's tooltip would otherwise cover its open panel and take Escape from it. */
  private onToolbarPanelShow = (event: Event): void => {
    const panel = event.target as Element | null;
    if (panel?.localName !== tag('popover') || event.defaultPrevented) return;
    this.openPanelTrigger = panel.querySelector(':scope > [slot="trigger"]')?.id ?? null;
    for (const tooltip of this.renderRoot.querySelectorAll<HTMLElement & { open: boolean; hide(): Promise<void> }>(tag('tooltip')))
      if (tooltip.open) void tooltip.hide();
  };

  private onToolbarPanelHidden = (event: Event): void => {
    const panel = event.target as Element | null;
    if (panel?.localName === tag('popover') && panel.querySelector(':scope > [slot="trigger"]')?.id === this.openPanelTrigger)
      this.openPanelTrigger = null;
  };

  private onToolbarFocusIn = (event: FocusEvent): void => {
    const target = event.composedPath().find(node => node instanceof HTMLElement &&
      node.hasAttribute('data-tool-key') && this.renderRoot.contains(node)) as HTMLElement | undefined;
    if (target) this.toolbarKey = target.getAttribute('data-tool-key') ?? 'bold';
  };

  private enabledToolbarButtons(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('[data-tool-key]')]
      .filter(button => !button.hasAttribute('disabled') && !button.hidden && !button.inert &&
        !button.closest('[inert]') && button.getAttribute('aria-hidden') !== 'true');
  }

  private runToolbarCommand(command: DocxCommand): void {
    const lease = this.toolbarSelection;
    this.toolbarSelection = null;
    const result = this.execute(command, lease ? { selection: lease } : {});
    lease?.release();
    if (!result.ok && result.code === 'engine-failed') this.reportError(result.code);
    this.focusEditor();
  }

  private openFilePicker(): void {
    this.renderRoot.querySelector<HTMLInputElement>('[part="file-input"]')?.click();
  }

  private requestToolbarAction(action: 'new' | 'open'): void {
    this.releaseToolbarSelection();
    if (this.hasUnsavedContent()) {
      this.pendingAction = action;
      void this.updateComplete.then(() => {
        if (this.pendingAction === action) this.renderRoot.querySelector<HTMLElement>('[part="keep-button"]')?.focus();
      });
      return;
    }
    if (action === 'new') {
      const sourceRead = this.sourceReadSequence + 1;
      const pending = this.newDocument();
      void pending.then(async result => {
        await this.updateComplete;
        if (!this.isConnected || sourceRead !== this.sourceReadSequence) return;
        if (result.ok) this.focusEditor();
        else this.renderRoot.querySelector<HTMLElement>('[part="new-button"]')?.focus();
      });
    } else this.openFilePicker();
  }

  private confirmToolbarAction(): void {
    const action = this.pendingAction;
    this.pendingAction = null;
    if (action === 'new') {
      const sourceRead = this.sourceReadSequence + 1;
      const pending = this.newDocument();
      void pending.then(async result => {
        await this.updateComplete;
        if (!this.isConnected || sourceRead !== this.sourceReadSequence) return;
        if (result.ok) this.focusEditor();
        else this.renderRoot.querySelector<HTMLElement>('[part="new-button"]')?.focus();
      });
    } else if (action === 'open') this.openFilePicker();
  }

  private onFileSelected = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.item(0);
    input.value = '';
    if (file) {
      const sourceRead = this.sourceReadSequence + 1;
      const pending = this.open(file);
      void pending.then(async result => {
        await this.updateComplete;
        if (!this.isConnected || sourceRead !== this.sourceReadSequence) return;
        if (result.ok) this.focusEditor();
        else this.renderRoot.querySelector<HTMLElement>('[part="open-button"]')?.focus();
      });
    }
  };

  private statusText(): string {
    const snapshot = this.currentSnapshot;
    if (this.openingFile || snapshot?.status === 'opening') return this.localize('docxEditorOpening');
    if (snapshot?.activity === 'inserting-image') return this.localize('docxEditorInsertingImage');
    if (snapshot?.activity === 'saving') return this.localize('docxEditorSaving');
    if (snapshot?.status === 'error' || this.localError) return this.localize('docxEditorError');
    if (snapshot?.dirty) return this.localize('docxEditorUnsaved');
    if (snapshot?.status === 'ready') return this.localize('docxEditorReady');
    if (this.wasDisconnected) return this.localize('docxEditorDisconnected');
    return this.localize('docxEditorIdle');
  }

  private renderToolIcon(name: ToolIcon): TemplateResult {
    return html`<span class="tool-icon" aria-hidden="true"><slot name=${`${name}-icon`}><${iconTag} .path=${toolIcons[name].path}></${iconTag}></slot></span>`;
  }

  private renderTooltip(name: ToolIcon, content = this.localize(toolIcons[name].label)): TemplateResult {
    return html`<${tooltipTag} for=${`tool-${name}`} content=${content} top-layer
      ?disabled=${this.openPanelTrigger === `tool-${name}`}></${tooltipTag}>`;
  }

  private renderTooltips(): TemplateResult {
    return html`<div class="tooltips">${(Object.keys(toolIcons) as ToolIcon[])
      .filter(name => !contextualToolIcons.has(name)).map(name => this.renderTooltip(name))}</div>`;
  }

  private renderCommand(command: DocxCommand): TemplateResult {
    const availability = this.currentSnapshot?.commands[command];
    const formatting = command !== 'undo' && command !== 'redo';
    const active = availability?.active;
    return html`<${buttonTag}
      part="format-button"
      id=${`tool-${command}`} aria-label=${this.localize(commandLabels[command])}
      data-command=${command}
      data-tool-key=${command}
      data-active=${active === true ? 'true' : 'false'}
      size="s"
      appearance=${active === true ? 'filled' : active === 'mixed' ? 'filled-outlined' : 'quiet'}
      ?disabled=${!availability?.enabled}
      tabindex=${availability?.enabled && this.toolbarKey === command ? '0' : '-1'}
      .pressed=${formatting ? active === 'mixed' ? 'mixed' : active === true : null}
      @pointerdown=${() => { if (formatting) this.retainToolbarSelection(); }}
      @click=${() => this.runToolbarCommand(command)}
    >${this.renderToolIcon(command)}</${buttonTag}>`;
  }

  private renderAlignment(value: typeof alignments[number]): TemplateResult {
    const edit: DocxEdit = { type: 'alignment', value };
    const active = this.currentSnapshot?.formatting.alignment === value;
    const key = `docxEditorAlign${value[0]!.toUpperCase()}${value.slice(1)}`;
    return html`<${buttonTag} part="edit-button" data-edit="alignment" data-value=${value}
      id=${`tool-alignment-${value}`} aria-label=${this.localize(key)}
      data-tool-key=${`alignment-${value}`}
      size="s" appearance=${active ? 'filled' : 'quiet'} .pressed=${active}
      ?disabled=${!this.can(edit).enabled}
      tabindex=${this.toolbarKey === `alignment-${value}` ? '0' : '-1'}
      @pointerdown=${() => this.retainToolbarSelection()}
      @click=${() => this.runEdit(edit)}>${this.renderToolIcon(`alignment-${value}`)}</${buttonTag}>`;
  }

  private renderList(kind: typeof listKinds[number]): TemplateResult {
    const edit: DocxEdit = { type: 'toggle-list', kind };
    const active = kind === 'bullet' ? this.currentSnapshot?.formatting.bulletList :
      this.currentSnapshot?.formatting.numberedList;
    return html`<${buttonTag} part="edit-button" data-edit="toggle-list" data-kind=${kind}
      id=${`tool-list-${kind}`} aria-label=${this.localize(toolIcons[`list-${kind}`].label)}
      data-tool-key=${`toggle-list-${kind}`}
      size="s" appearance=${active ? 'filled' : 'quiet'} .pressed=${Boolean(active)}
      ?disabled=${!this.can(edit).enabled}
      tabindex=${this.toolbarKey === `toggle-list-${kind}` ? '0' : '-1'}
      @pointerdown=${() => this.retainToolbarSelection()}
      @click=${() => this.runEdit(edit)}>${this.renderToolIcon(`list-${kind}`)}</${buttonTag}>`;
  }

  private renderEditingTools(): TemplateResult {
    const ready = this.currentSnapshot?.status === 'ready';
    const editable = ready && !this.currentSnapshot?.readOnly && !this.currentSnapshot?.composing &&
      this.currentSnapshot?.activity === null;
    const formatting = this.currentSnapshot?.formatting;
    return html`<div part="editing-tools" role="group" aria-label=${this.localize('docxEditorFormatting')}>
      <div class="font-tools">
      <${selectTag} part="paragraph-style" data-edit="paragraph-style" size="s"
        aria-label=${this.localize('docxEditorParagraphStyle')}
        placeholder=${this.localize('docxEditorParagraphStyle')}
        .value=${formatting?.paragraphStyleId ?? ''} ?disabled=${!editable}
        @pointerdown=${() => this.retainToolbarSelection()}
        @lr-show=${() => this.loadParagraphStyles()}
        @lr-after-hide=${() => this.onPickerClosed()}
        @lr-change=${(event: CustomEvent<{ value: string | string[] }>) => this.onParagraphStyleChange(event)}>
        ${formatting?.paragraphStyleId && !this.paragraphStyleItems.some(item => item.id === formatting.paragraphStyleId) ?
          html`<${optionTag} value=${formatting.paragraphStyleId}>${formatting.paragraphStyleId}</${optionTag}>` : nothing}
        ${this.paragraphStyleItems.map(item => html`<${optionTag} value=${item.id}>${item.label}</${optionTag}>`)}
      </${selectTag}>
      <${comboboxTag} part="font-family" data-edit="font-family" size="s" allow-custom-value
        aria-label=${this.localize('docxEditorFontFamily')}
        placeholder=${this.localize('docxEditorFontFamily')}
        .value=${formatting?.fontFamily ?? []} ?disabled=${!editable}
        @pointerdown=${() => this.retainToolbarSelection()}
        @lr-show=${() => this.loadFontFamilies()}
        @lr-after-hide=${() => this.onPickerClosed()}
        @lr-change=${(event: CustomEvent<{ value: string | string[] }>) => this.onFontFamilyChange(event)}>
        ${formatting?.fontFamily && !this.fontFamilyItems.includes(formatting.fontFamily) ?
          html`<${optionTag} value=${formatting.fontFamily}>${formatting.fontFamily}</${optionTag}>` : nothing}
        ${this.fontFamilyItems.map(family => html`<${optionTag} value=${family}>${family}</${optionTag}>`)}
      </${comboboxTag}>
      <${numberInputTag} part="font-size" data-edit="font-size" size="s"
        aria-label=${this.localize('docxEditorFontSize')}
        placeholder=${this.localize('docxEditorFontSize')}
        min="1" max="1638" step="0.5" inputmode="decimal"
        .value=${formatting?.fontSizePoints == null ? '' : String(formatting.fontSizePoints)}
        ?disabled=${!editable}
        @pointerdown=${() => this.retainToolbarSelection()}
        @lr-change=${(event: CustomEvent<{ value: string }>) => this.onFontSizeChange(event)}></${numberInputTag}>
      </div>
      <div part="format-actions">${commands.map(command => this.renderCommand(command))}
        ${this.renderEditButton({ type: 'clear-formatting' }, 'clear-formatting')}</div>
      <div part="alignment-actions" role="group" aria-label=${this.localize('docxEditorAlignment')}>
        ${alignments.map(value => this.renderAlignment(value))}
      </div>
      <div part="list-actions" role="group" aria-label=${this.localize('docxEditorLists')}>
        ${listKinds.map(kind => this.renderList(kind))}
        ${this.renderEditButton({ type: 'indent', direction: 'decrease' }, 'indent-decrease')}
        ${this.renderEditButton({ type: 'indent', direction: 'increase' }, 'indent-increase')}
        ${this.renderToolPopover('line-spacing', Boolean(editable) && this.can({ type: 'line-spacing', multiple: 1 }).enabled, html`
          <div part="line-spacing-options" role="group" aria-label=${this.localize('docxEditorLineSpacing')}>
            ${lineSpacings.map(multiple => html`<${buttonTag} part="line-spacing-option" data-value=${multiple} size="s" appearance="quiet"
              @click=${() => this.applyPopoverEdit({ type: 'line-spacing', multiple }, 'line-spacing-popover')}>${multiple.toLocaleString(this.effectiveLocale, { minimumFractionDigits: 1 })}</${buttonTag}>`)}
          </div>`)}
      </div>
      <div class="color-tools">
        ${this.renderToolPopover('text-color', Boolean(editable), html`
          <div part="text-color-fields" class="color-fields">
            <${swatchPickerTag} part="text-color-swatches" size="s" aria-label=${this.localize('docxEditorTextColor')}
              .items=${textColors.map(([color, name]) => ({ value: color, color, label: this.localize(`docxEditorColor${name}`) }))}
              .value=${this.lastTextColor} @lr-change=${(event: Event) => event.stopPropagation()}
              @click=${(event: Event) => this.onSwatchActivation(event, color => this.applyPopoverEdit({ type: 'text-color', color }, 'text-color-popover'))}
              @keydown=${(event: Event) => this.onSwatchActivation(event, color => this.applyPopoverEdit({ type: 'text-color', color }, 'text-color-popover'))}></${swatchPickerTag}>
            <${buttonTag} part="color-auto" data-edit="text-color-auto" size="s" appearance="quiet"
              ?disabled=${!this.can({ type: 'text-color', color: 'auto' }).enabled}
              @click=${() => this.applyPopoverEdit({ type: 'text-color', color: 'auto' }, 'text-color-popover')}>${this.localize('docxEditorAutomaticColor')}</${buttonTag}>
            <${colorPickerTag} part="text-color-custom" inline size="s" format="hex" without-format-toggle
              label=${this.localize('docxEditorCustomColor')} .value=${this.lastTextColor}
              @lr-input=${(event: Event) => event.stopPropagation()}
              @lr-change=${(event: Event) => this.onCustomColorChange(event)}></${colorPickerTag}>
          </div>`, this.lastTextColor)}
        ${this.renderToolPopover('highlight', Boolean(editable), html`
          <div part="highlight-fields" class="color-fields">
            <${swatchPickerTag} part="highlight-swatches" size="s" aria-label=${this.localize('docxEditorHighlight')}
              .items=${highlightColors.map(([value, color, name]) => ({ value, color, label: this.localize(`docxEditorColor${name}`) }))}
              .value=${this.lastHighlight} @lr-change=${(event: Event) => event.stopPropagation()}
              @click=${(event: Event) => this.onSwatchActivation(event, color => this.applyPopoverEdit({ type: 'highlight', color: color as DocxHighlight }, 'highlight-popover'))}
              @keydown=${(event: Event) => this.onSwatchActivation(event, color => this.applyPopoverEdit({ type: 'highlight', color: color as DocxHighlight }, 'highlight-popover'))}></${swatchPickerTag}>
            <${buttonTag} part="highlight-none" size="s" appearance="quiet"
              ?disabled=${!this.can({ type: 'highlight', color: 'none' }).enabled}
              @click=${() => this.applyPopoverEdit({ type: 'highlight', color: 'none' }, 'highlight-popover')}>${this.localize('docxEditorNoHighlight')}</${buttonTag}>
          </div>`, highlightColors.find(([value]) => value === this.lastHighlight)![1])}
      </div>
    </div>`;
  }

  /** One icon action that edits the current selection and returns to the document. */
  private renderEditButton(edit: DocxEdit, icon: ToolIcon): TemplateResult {
    return html`<${buttonTag} part="edit-button" id=${`tool-${icon}`} data-edit=${edit.type} data-tool-key=${icon}
      size="s" appearance="quiet" aria-label=${this.localize(toolIcons[icon].label)}
      ?disabled=${!this.can(edit).enabled} tabindex=${this.toolbarKey === icon ? '0' : '-1'}
      @pointerdown=${() => this.retainToolbarSelection()}
      @click=${() => this.runEdit(edit)}>${this.renderToolIcon(icon)}</${buttonTag}>`;
  }

  /** An icon trigger opening a small panel; the selection is leased before focus leaves the document. */
  private renderToolPopover(name: 'text-color' | 'highlight' | 'line-spacing', enabled: boolean, content: TemplateResult, swatch?: string): TemplateResult {
    return html`<${popoverTag} part=${`${name}-popover`} popup-role="dialog" placement="bottom-start" top-layer
      aria-label=${this.localize(toolIcons[name].label)} @lr-after-hide=${() => this.onPickerClosed()}>
      <${buttonTag} slot="trigger" part=${name} id=${`tool-${name}`} data-tool-key=${name} size="s" appearance="quiet"
        aria-label=${this.localize(toolIcons[name].label)} ?disabled=${!enabled}
        tabindex=${this.toolbarKey === name ? '0' : '-1'}
        @pointerdown=${() => this.retainToolbarSelection()}
        @keydown=${(event: KeyboardEvent) => { if (event.key === 'Enter' || event.key === ' ') this.retainToolbarSelection(); }}>
        <span class="tool-glyph" style=${swatch ? styleMap({ '--_tool-swatch': swatch }) : nothing}>${this.renderToolIcon(name)}</span>
      </${buttonTag}>
      ${content}
    </${popoverTag}>`;
  }

  private renderDocumentTools(): TemplateResult {
    const ready = this.currentSnapshot?.status === 'ready';
    const editable = ready && !this.currentSnapshot?.readOnly && !this.currentSnapshot?.composing &&
      this.currentSnapshot?.activity === null;
    return html`      <div class="insert-tools">
      ${this.renderLinkEditor(Boolean(editable))}
      <${buttonTag} part="find-toggle" id="tool-find" aria-label=${this.localize(toolIcons['find'].label)} data-tool-key="find" size="s" appearance=${this.findOpen ? 'filled' : 'quiet'}
        tabindex=${this.toolbarKey === 'find' ? '0' : '-1'}
        .pressed=${this.findOpen} ?disabled=${!ready}
        @click=${() => { this.findOpen = !this.findOpen; if (this.findOpen) void this.updateComplete.then(() =>
          this.renderRoot.querySelector<HTMLElement>('[part="find-query"]')?.focus()); }}>
        ${this.renderToolIcon('find')}
      </${buttonTag}>
      </div>
`;
  }

  private renderLinkEditor(editable: boolean): TemplateResult {
    return html`<${popoverTag} part="link-popover" data-edit="link" popup-role="dialog" top-layer
      aria-label=${this.localize('docxEditorLink')}
      @lr-show=${() => this.openLinkEditor()}
      @lr-after-hide=${() => this.releaseToolbarSelection()}>
      <${buttonTag} slot="trigger" part="link-trigger" id="tool-link" aria-label=${this.localize(toolIcons['link'].label)} data-tool-key="link" size="s" appearance="quiet"
        tabindex=${this.toolbarKey === 'link' ? '0' : '-1'}
        ?disabled=${!editable} @pointerdown=${() => this.retainToolbarSelection()}>
        ${this.renderToolIcon('link')}
      </${buttonTag}>
      <div part="link-fields">
        <${inputTag} part="link-href" type="text" inputmode="url" size="s" label=${this.localize('docxEditorLinkUrl')}
          hint=${this.localize('docxEditorLinkHint')}
          .value=${this.linkHref} @lr-input=${(event: CustomEvent<{ value: string }>) => { this.linkHref = event.detail.value; }}
          @lr-change=${(event: Event) => event.stopPropagation()}></${inputTag}>
        <${inputTag} part="link-text" size="s" label=${this.localize('docxEditorLinkText')}
          .value=${this.linkText} @lr-input=${(event: CustomEvent<{ value: string }>) => { this.linkText = event.detail.value; }}
          @lr-change=${(event: Event) => event.stopPropagation()}></${inputTag}>
        <div part="link-actions">
          <${buttonTag} part="link-apply" size="s" ?disabled=${!this.can(this.linkEdit()).enabled}
            @click=${() => this.applyLink()}>${this.localize('docxEditorApplyLink')}</${buttonTag}>
          <${buttonTag} part="link-remove" data-edit="remove-link" size="s" appearance="quiet"
            ?disabled=${!this.can({ type: 'remove-link' }).enabled}
            @click=${() => { this.runEdit({ type: 'remove-link' }, false); if (!this.editError) this.closeLinkEditor(); }}>
            ${this.localize('docxEditorRemoveLink')}
          </${buttonTag}>
          <${buttonTag} part="link-cancel" size="s" appearance="quiet"
            @click=${() => this.closeLinkEditor()}>${this.localize('docxEditorCancel')}</${buttonTag}>
        </div>
      </div>
    </${popoverTag}>`;
  }

  private renderImageInsertionTools(): TemplateResult {
    const intentValid = this.insertionIntent?.valid(this.session) ?? false;
    const available = this.canInsertImage().enabled;
    const reading = this.insertionPhase === 'reading';
    const draft = this.insertionPhase === 'draft';
    const fieldsDisabled = !draft || !intentValid || !available;
    const source = this.insertionBytes && imageInsertionDraft(this.insertionBytes, this.insertionWidth,
      this.insertionHeight, this.insertionTitle, this.insertionDescription);
    return html`<${popoverTag} part="image-insert-dialog" popup-role="dialog" trigger="manual"
      placement="bottom-start" top-layer aria-label=${this.localize('docxEditorInsertImage')}
      @lr-show=${(event: Event) => {
        if ((!reading && !draft) || !intentValid) event.preventDefault();
      }}
      @lr-hide=${(event: Event) => this.onImageInsertionHide(event)}>
      <${buttonTag} slot="trigger" part="image-insert-trigger" id="tool-image-insert" aria-label=${this.localize(toolIcons['image-insert'].label)} data-tool-key="image-insert" size="s" appearance="quiet" wrap
        tabindex=${this.toolbarKey === 'image-insert' ? '0' : '-1'}
        ?disabled=${!available || this.insertionPhase !== 'idle'}
        @pointerdown=${() => this.prepareImageInsertion()}
        @keydown=${(event: KeyboardEvent) => this.onImageInsertionKey(event)}
        @blur=${() => { if (this.insertionPhase === 'idle') this.cancelImageInsertion(false); }}
        @click=${() => this.openImageInsertionPicker()}>${this.renderToolIcon('image-insert')}</${buttonTag}>
      <div part="image-insert-fields" @focusin=${(event: FocusEvent) => this.onImageFieldFocus(event, true)}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && event.composedPath().some(node =>
            node instanceof HTMLElement && ['image-insert-width', 'image-insert-height', 'image-insert-title'].includes(node.getAttribute('part') ?? ''))) {
            event.preventDefault(); event.stopPropagation(); this.dispatchImageInsertion();
          }
        }}>
        ${reading ? html`<p part="image-insert-hint">${this.localize('docxEditorReadingImage')}</p>` : nothing}
        ${draft ? html`
          <${numberInputTag} part="image-insert-width" size="s" without-steppers label=${this.localize('docxEditorImageWidth')}
            min="1" max="1440" step="any" inputmode="decimal" .value=${this.insertionWidth} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => this.changeInsertionDimension(event, 'width')}
            @lr-change=${(event: Event) => event.stopPropagation()}></${numberInputTag}>
          <${numberInputTag} part="image-insert-height" size="s" without-steppers label=${this.localize('docxEditorImageHeight')}
            min="1" max="1440" step="any" inputmode="decimal" .value=${this.insertionHeight} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => this.changeInsertionDimension(event, 'height')}
            @lr-change=${(event: Event) => event.stopPropagation()}></${numberInputTag}>
          <${checkboxTag} part="image-insert-ratio" .checked=${this.insertionKeepRatio}
            ?disabled=${fieldsDisabled || !this.insertionDefaults?.ratioAvailable}
            @lr-change=${(event: Event) => {
              event.stopPropagation();
              this.insertionKeepRatio = (event.currentTarget as HTMLElement & { checked: boolean }).checked;
              if (this.insertionKeepRatio && this.insertionDefaults?.ratioAvailable)
                this.insertionHeight = imageRatioPartner(this.insertionWidth, 'width', this.insertionDefaults.original) ?? '';
            }}>${this.localize('docxEditorImageRatio')}</${checkboxTag}>
          <p part="image-insert-hint">${this.localize(!intentValid ? 'docxEditorImageInsertStale' :
            this.insertionDefaults?.ratioAvailable ? 'docxEditorImageInsertSizeHint' : 'docxEditorImageInsertRatioUnavailable')}</p>
          <${inputTag} part="image-insert-title" size="s" label=${this.localize('docxEditorImageTitle')}
            maxlength="256" .value=${this.insertionTitle} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => { event.stopPropagation(); this.insertionTitle = event.detail.value; }}
            @lr-change=${(event: Event) => event.stopPropagation()}></${inputTag}>
          <${textareaTag} part="image-insert-description" size="s" label=${this.localize('docxEditorImageDescription')}
            rows="4" resize="vertical" maxlength="2048" .value=${this.insertionDescription} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => { event.stopPropagation(); this.insertionDescription = event.detail.value; }}
            @lr-change=${(event: Event) => event.stopPropagation()}></${textareaTag}>
          <p part="image-insert-hint">${this.localize('docxEditorImageInsertMetadataHint')}</p>
          <p part="image-insert-hint">${this.localize('docxEditorImageInsertScopeHint')}</p>` : nothing}
        <div part="image-insert-actions">
          ${draft ? html`<${buttonTag} part="image-insert-apply" size="s" wrap ?disabled=${fieldsDisabled || !source}
            @click=${() => this.dispatchImageInsertion()}>${this.localize('docxEditorInsertImage')}</${buttonTag}>` : nothing}
          ${reading || draft ? html`<${buttonTag} part="image-insert-cancel" size="s" appearance="quiet" ?autofocus=${reading}
            @click=${() => this.cancelImageInsertion(true)}>${this.localize('docxEditorCancel')}</${buttonTag}>` : nothing}
        </div>
      </div>
    </${popoverTag}>
    <input part="image-insert-file" type="file" accept=".png,.jpg,.jpeg,.gif,image/png,image/jpeg,image/gif"
      tabindex="-1" aria-hidden="true" @change=${this.readImageInsertionFile}
      @cancel=${() => { if (this.insertionAwaitingPicker) this.cancelImageInsertion(true); }}>
    ${this.insertionError ? html`<p part="image-insert-status">${this.insertionFeedback(this.insertionError)}</p>` : nothing}`;
  }

  private renderTableTools(): TemplateResult {
    const draft = tableInsertDraft(this.tableRows, this.tableColumns);
    const intentValid = this.tableIntent?.valid(this.session) ?? false;
    const table = this.currentSnapshot?.table;
    const number = (value: number) => value.toLocaleString(this.effectiveLocale);
    const context = table ? this.localize('docxEditorTableDimensions', undefined,
      { rows: number(table.rows), columns: number(table.columns) }) : '';
    const cell = table?.rowIndex != null && table.columnIndex != null ? this.localize('docxEditorTableCell', undefined,
      { row: number(table.rowIndex + 1), column: number(table.columnIndex + 1) }) : '';
    return html`<div part="table-tools" role="group" aria-label=${this.localize('docxEditorTable')}>
      <${popoverTag} part="table-insert-popover" popup-role="dialog" placement="bottom-start" top-layer
        aria-label=${this.localize('docxEditorInsertTable')}
        @lr-show=${(event: Event) => this.openTableDialog(event)} @lr-after-hide=${() => this.onTableDialogHidden()}>
        <${buttonTag} slot="trigger" part="table-insert-trigger" id="tool-table-insert" aria-label=${this.localize(toolIcons['table-insert'].label)} data-tool-key="table-insert" size="s" appearance="quiet"
          tabindex=${this.toolbarKey === 'table-insert' ? '0' : '-1'}
          ?disabled=${!this.can({ type: 'insert-table', rows: 2, columns: 2 }).enabled}
          @pointerdown=${() => this.prepareTableIntent()} @focusin=${() => this.prepareTableIntent()}
          @keydown=${(event: KeyboardEvent) => this.onTableActivationKey(event)}>${this.renderToolIcon('table-insert')}</${buttonTag}>
        <div part="table-fields" @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && event.composedPath().some(node => node instanceof HTMLElement &&
              ['table-rows', 'table-columns'].includes(node.getAttribute('part') ?? ''))) {
            event.preventDefault(); event.stopPropagation(); this.insertTable();
          }
        }}>
          <${numberInputTag} part="table-rows" size="s" autofocus label=${this.localize('docxEditorTableRows')}
            min="1" max="20" step="1" .value=${this.tableRows}
            @lr-input=${(event: CustomEvent<{ value: string }>) => { event.stopPropagation(); this.tableRows = event.detail.value; }}
            @lr-change=${(event: Event) => event.stopPropagation()}></${numberInputTag}>
          <${numberInputTag} part="table-columns" size="s" label=${this.localize('docxEditorTableColumns')}
            min="1" max="20" step="1" .value=${this.tableColumns}
            @lr-input=${(event: CustomEvent<{ value: string }>) => { event.stopPropagation(); this.tableColumns = event.detail.value; }}
            @lr-change=${(event: Event) => event.stopPropagation()}></${numberInputTag}>
          <p part="table-hint">${this.localize(this.tableDialogOpen && !intentValid ? 'docxEditorTableStale' : 'docxEditorTableSizeHint')}</p>
          <div part="table-dialog-actions">
            <${buttonTag} part="table-insert-apply" size="s"
              ?disabled=${!intentValid || !draft || !this.can(draft).enabled}
              @click=${() => this.insertTable()}>${this.localize('docxEditorInsertTable')}</${buttonTag}>
            <${buttonTag} part="table-insert-cancel" size="s" appearance="quiet"
              @click=${() => this.closeTableDialog(false)}>${this.localize('docxEditorCancel')}</${buttonTag}>
          </div>
        </div>
      </${popoverTag}>
      ${table ? html`<span part="table-context"><bdi>${context}</bdi> <bdi>${cell}</bdi></span>
        <div part="table-actions">${tableActions.map(([key, action, label]) => html`
          <${buttonTag} part="table-button" id=${`tool-table-${key}`} data-table-action=${key} data-tool-key=${`table-${key}`} size="s" appearance="quiet"
            aria-label=${this.localize(label)}
            tabindex=${this.toolbarKey === `table-${key}` ? '0' : '-1'} ?disabled=${!this.can(action).enabled}
            @pointerdown=${() => this.prepareTableIntent()} @focusin=${() => this.prepareTableIntent()}
            @keydown=${(event: KeyboardEvent) => this.onTableActivationKey(event)}
            @click=${() => this.runTableEdit(action)}>${this.renderToolIcon(`table-${key}`)}</${buttonTag}>`)}
          <span class="tooltips">${tableActions.map(([key]) => this.renderTooltip(`table-${key}`))}</span></div>` : nothing}
    </div>`;
  }

  private renderImageTools(): TemplateResult {
    const image = this.currentSnapshot?.image;
    if (this.currentSnapshot?.status !== 'ready' && !this.imageDialog) return html``;
    const navigationDisabled = this.currentSnapshot?.status !== 'ready' || this.currentSnapshot.activity !== null || this.currentSnapshot.composing;
    const intentValid = this.imageIntent?.valid(this.session) ?? false;
    const available = this.can({ type: 'delete-image' }).enabled;
    const fieldsDisabled = !intentValid || !available;
    const resize = imageResizeDraft(this.imageWidth, this.imageHeight);
    const description = imageDescriptionDraft(this.imageTitle, this.imageDescriptionText);
    const dimension = (value: number) => value.toLocaleString(this.effectiveLocale, { maximumFractionDigits: 1 });
    const context = image ? this.localize('docxEditorImageDimensions', undefined,
      { width: dimension(image.widthPoints), height: dimension(image.heightPoints) }) : '';
    return html`<div part="image-tools" role="group" aria-label=${this.localize('docxEditorImage')}>
      <${buttonTag} part="image-previous" id="tool-image-previous" aria-label=${this.localize(toolIcons['image-previous'].label)} data-tool-key="image-previous" size="s" appearance="quiet" wrap
        tabindex=${this.toolbarKey === 'image-previous' ? '0' : '-1'} ?disabled=${navigationDisabled}
        @click=${() => this.navigateImage('previous')}>${this.renderToolIcon('image-previous')}</${buttonTag}>
      <${buttonTag} part="image-next" id="tool-image-next" aria-label=${this.localize(toolIcons['image-next'].label)} data-tool-key="image-next" size="s" appearance="quiet" wrap
        tabindex=${this.toolbarKey === 'image-next' ? '0' : '-1'} ?disabled=${navigationDisabled}
        @click=${() => this.navigateImage('next')}>${this.renderToolIcon('image-next')}</${buttonTag}>
      ${this.imageNavigationEmpty ? html`<span part="image-navigation-status">${this.localize('docxEditorNoImage')}</span>` : nothing}
      ${!image && !this.imageDialog ? nothing : html`
      <${popoverTag} part="image-resize-popover" popup-role="dialog" placement="bottom-start" top-layer
        aria-label=${this.localize('docxEditorResizeImage')}
        @lr-show=${(event: Event) => this.openImageDialog(event, 'resize')}
        @lr-after-hide=${() => this.onImageDialogHidden('resize')}>
        <${buttonTag} slot="trigger" part="image-resize-trigger" id="tool-image-resize" data-tool-key="image-resize" size="s" appearance="quiet"
          aria-label=${context ? `${this.localize('docxEditorResizeImage')}, ${context}` : this.localize('docxEditorResizeImage')} tabindex=${this.toolbarKey === 'image-resize' ? '0' : '-1'}
          ?disabled=${!available || this.imageDialog === 'description'}
          @pointerdown=${() => this.prepareImageIntent()} @focusin=${() => this.prepareImageIntent()}
          @keydown=${(event: KeyboardEvent) => this.onImageActivationKey(event)}>${this.renderToolIcon('image-resize')}</${buttonTag}>
        <div part="image-resize-fields" @focusin=${this.onImageFieldFocus} @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && event.composedPath().some(node =>
            node instanceof HTMLElement && ['image-width', 'image-height'].includes(node.getAttribute('part') ?? ''))) {
            event.preventDefault(); event.stopPropagation(); this.applyImageResize();
          }
        }}>
          <${numberInputTag} part="image-width" size="s" autofocus label=${this.localize('docxEditorImageWidth')}
            min="1" max="1440" step="any" inputmode="decimal" without-steppers .value=${this.imageWidth} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => this.changeImageDimension(event, 'width')}
            @lr-change=${(event: Event) => event.stopPropagation()}></${numberInputTag}>
          <${numberInputTag} part="image-height" size="s" label=${this.localize('docxEditorImageHeight')}
            min="1" max="1440" step="any" inputmode="decimal" without-steppers .value=${this.imageHeight} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => this.changeImageDimension(event, 'height')}
            @lr-change=${(event: Event) => event.stopPropagation()}></${numberInputTag}>
          <${checkboxTag} part="image-ratio" size="s" .checked=${this.imageKeepRatio} ?disabled=${fieldsDisabled}
            @lr-change=${(event: CustomEvent<{ checked: boolean }>) => {
              event.stopPropagation(); this.imageKeepRatio = event.detail.checked;
            }}>${this.localize('docxEditorImageRatio')}</${checkboxTag}>
          <p part="image-resize-hint">${this.localize(this.imageDialog === 'resize' && !intentValid ? 'docxEditorImageStale' : 'docxEditorImageSizeHint')}</p>
          <div part="image-resize-actions">
            <${buttonTag} part="image-resize-apply" size="s"
              ?disabled=${!intentValid || !resize || !this.can(resize).enabled}
              @click=${() => this.applyImageResize()}>${this.localize('docxEditorImageApply')}</${buttonTag}>
            <${buttonTag} part="image-resize-cancel" size="s" appearance="quiet"
              @click=${() => this.closeImageDialog(false)}>${this.localize('docxEditorCancel')}</${buttonTag}>
          </div>
        </div>
      </${popoverTag}>
      <${popoverTag} part="image-description-popover" popup-role="dialog" placement="bottom-start" top-layer
        aria-label=${this.localize('docxEditorDescribeImage')}
        @lr-show=${(event: Event) => this.openImageDialog(event, 'description')}
        @lr-after-hide=${() => this.onImageDialogHidden('description')}>
        <${buttonTag} slot="trigger" part="image-description-trigger" id="tool-image-description" data-tool-key="image-description" size="s" appearance="quiet"
          aria-label=${this.localize('docxEditorDescribeImage')} tabindex=${this.toolbarKey === 'image-description' ? '0' : '-1'}
          ?disabled=${!available || this.imageDialog === 'resize'}
          @pointerdown=${() => this.prepareImageIntent()} @focusin=${() => this.prepareImageIntent()}
          @keydown=${(event: KeyboardEvent) => this.onImageActivationKey(event)}>${this.renderToolIcon('image-description')}</${buttonTag}>
        <div part="image-description-fields" @focusin=${this.onImageFieldFocus} @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229 && event.composedPath().some(node =>
            node instanceof HTMLElement && node.getAttribute('part') === 'image-title')) {
            event.preventDefault(); event.stopPropagation(); this.applyImageDescription();
          }
        }}>
          <${inputTag} part="image-title" size="s" autofocus label=${this.localize('docxEditorImageTitle')}
            maxlength="256" .value=${this.imageTitle} ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => { event.stopPropagation(); this.imageTitle = event.detail.value; }}
            @lr-change=${(event: Event) => event.stopPropagation()}></${inputTag}>
          <${textareaTag} part="image-description" size="s" rows="4" resize="vertical" with-count
            label=${this.localize('docxEditorImageDescription')} maxlength="2048" .value=${this.imageDescriptionText}
            ?disabled=${fieldsDisabled}
            @lr-input=${(event: CustomEvent<{ value: string }>) => { event.stopPropagation(); this.imageDescriptionText = event.detail.value; }}
            @lr-change=${(event: Event) => event.stopPropagation()}></${textareaTag}>
          <p part="image-description-hint">${this.localize(this.imageDialog === 'description' && !intentValid ? 'docxEditorImageStale' : 'docxEditorImageDescriptionHint')}</p>
          <div part="image-description-actions">
            <${buttonTag} part="image-description-apply" size="s"
              ?disabled=${!intentValid || !description || !this.can(description).enabled}
              @click=${() => this.applyImageDescription()}>${this.localize('docxEditorImageApply')}</${buttonTag}>
            <${buttonTag} part="image-description-cancel" size="s" appearance="quiet"
              @click=${() => this.closeImageDialog(false)}>${this.localize('docxEditorCancel')}</${buttonTag}>
          </div>
        </div>
      </${popoverTag}>
      <${buttonTag} part="image-delete" id="tool-image-delete" data-tool-key="image-delete" size="s" appearance="quiet"
        aria-label=${this.localize('docxEditorDeleteImage')} tabindex=${this.toolbarKey === 'image-delete' ? '0' : '-1'} ?disabled=${!available || this.imageDialog !== null}
        @pointerdown=${() => this.prepareImageIntent()} @focusin=${() => this.prepareImageIntent()}
        @keydown=${(event: KeyboardEvent) => this.onImageActivationKey(event)}
        @click=${() => this.runImageEdit({ type: 'delete-image' })}>${this.renderToolIcon('image-delete')}</${buttonTag}>
      <span class="tooltips">${this.renderTooltip('image-resize', context ? `${this.localize('docxEditorResizeImage')} · ${context}` : undefined)}${this.renderTooltip('image-description')}${this.renderTooltip('image-delete')}</span>`}
    </div>`;
  }

  private renderFind(): TemplateResult {
    if (!this.findOpen) return html``;
    const results = this.searchResults;
    const count = results?.matches.length ?? 0;
    const available = this.findActionAvailable();
    const replaceAvailable = this.findActionAvailable(true);
    return html`<div part="find" role="search" aria-label=${this.localize('docxEditorFind')}>
      <${inputTag} part="find-query" type="search" size="s" label=${this.localize('docxEditorFindQuery')}
        .value=${this.query} @lr-input=${(event: CustomEvent<{ value: string }>) => {
          this.query = event.detail.value; this.searchResults = null; this.searchIndex = -1;
        }} @lr-change=${(event: Event) => event.stopPropagation()}
        @keydown=${(event: KeyboardEvent) => {
          if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); this.runFind(); }
        }}></${inputTag}>
      <${checkboxTag} part="find-match-case" size="s" .checked=${this.matchCase}
        @lr-change=${(event: CustomEvent<{ checked: boolean }>) => {
          event.stopPropagation(); this.matchCase = event.detail.checked; this.searchResults = null;
        }}>${this.localize('docxEditorMatchCase')}</${checkboxTag}>
      <${checkboxTag} part="find-whole-word" size="s" .checked=${this.wholeWord}
        @lr-change=${(event: CustomEvent<{ checked: boolean }>) => {
          event.stopPropagation(); this.wholeWord = event.detail.checked; this.searchResults = null;
        }}>${this.localize('docxEditorWholeWord')}</${checkboxTag}>
      <${buttonTag} part="find-submit" size="s" appearance="quiet"
        ?disabled=${!this.query || !available}
        @click=${() => this.runFind()}>${this.localize('docxEditorFindSubmit')}</${buttonTag}>
      <span part="find-count">${results ? this.localize('docxEditorFindCount', undefined, { count }) : nothing}
        ${results?.truncated ? this.localize('docxEditorFindTruncated') : nothing}</span>
      <${buttonTag} part="find-previous" size="s" appearance="quiet" ?disabled=${!count || !available}
        @click=${() => this.navigateMatch(-1)}>${this.localize('docxEditorPrevious')}</${buttonTag}>
      <${buttonTag} part="find-next" size="s" appearance="quiet" ?disabled=${!count || !available}
        @click=${() => this.navigateMatch(1)}>${this.localize('docxEditorNext')}</${buttonTag}>
      <${inputTag} part="find-replace" size="s" label=${this.localize('docxEditorReplacement')}
        hint=${count && this.searchIndex < 0 ? this.localize('docxEditorFindSelectMatch') : ''}
        .value=${this.replacement} ?disabled=${this.currentSnapshot?.readOnly || !count}
        @lr-input=${(event: CustomEvent<{ value: string }>) => { this.replacement = event.detail.value; }}
        @lr-change=${(event: Event) => event.stopPropagation()}></${inputTag}>
      <${buttonTag} part="find-replace-button" size="s" appearance="quiet"
        ?disabled=${!replaceAvailable || this.searchIndex < 0 || !count}
        @click=${() => this.replaceCurrentMatch()}>${this.localize('docxEditorReplace')}</${buttonTag}>
    </div>`;
  }

  override render(): TemplateResult {
    const status = this.statusText();
    const hasError = this.currentSnapshot?.status === 'error' || this.localError !== null;
    return html`
      <section part="base" aria-label=${this.editorLabel()}>
        <div part="toolbar" role="toolbar" aria-label=${this.editorLabel()}
          @focusin=${this.onToolbarFocusIn} @pointerdown=${(event: PointerEvent) => this.handoffImageInsertion(event)}
          @lr-show=${this.onToolbarPanelShow} @lr-after-hide=${this.onToolbarPanelHidden}>
          <div class="toolbar-row">
          <div part="file-actions">
            <${buttonTag} part="new-button" id="tool-new" aria-label=${this.localize(toolIcons.new.label)} size="s" appearance="quiet" ?disabled=${this.openInProgress || Boolean(this.currentSnapshot?.activity)}
              @click=${() => this.requestToolbarAction('new')}>${this.renderToolIcon('new')}</${buttonTag}>
            <${buttonTag} part="open-button" id="tool-open" aria-label=${this.localize(toolIcons.open.label)} size="s" appearance="quiet" ?disabled=${this.openInProgress || Boolean(this.currentSnapshot?.activity)}
              @click=${() => this.requestToolbarAction('open')}>${this.renderToolIcon('open')}</${buttonTag}>
            <${buttonTag} part="save-button" id="tool-save" aria-label=${this.localize(toolIcons.save.label)} size="s" appearance="quiet"
              ?disabled=${this.currentSnapshot?.status !== 'ready' || this.currentSnapshot.activity !== null}
              @click=${() => { this.releaseToolbarSelection(); void this.save(); }}>${this.renderToolIcon('save')}</${buttonTag}>
            <input part="file-input" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              tabindex="-1" aria-hidden="true" @change=${this.onFileSelected}>
          </div>
          <div part="format-actions" class="history-tools">${this.renderCommand('undo')}${this.renderCommand('redo')}</div>
          ${this.renderDocumentTools()}
          <div class="insert-tools">
            ${this.renderEditButton({ type: 'page-break' }, 'page-break')}
            ${this.renderImageInsertionTools()}
            ${this.renderTableTools()}
            ${this.renderImageTools()}
          </div>
          </div>
          ${this.renderEditingTools()}
          ${this.renderTooltips()}
        </div>
        ${this.pendingAction ? html`
          <div part="confirm" role="group" aria-label=${this.localize('docxEditorDiscardQuestion')}>
            <span>${this.localize('docxEditorDiscardQuestion')}</span>
            <${buttonTag} part="discard-button" size="s" variant="danger" appearance="quiet"
              @click=${this.confirmToolbarAction}>${this.localize('docxEditorDiscard')}</${buttonTag}>
            <${buttonTag} part="keep-button" size="s" appearance="quiet"
              @click=${() => { this.pendingAction = null; this.focusEditor(); }}>${this.localize('docxEditorKeep')}</${buttonTag}>
          </div>
        ` : nothing}
        ${this.renderFind()}
        <div part="document" role="region" tabindex="0" aria-label=${this.editorLabel()}><slot name="document"></slot>${this.renderCharts()}${this.renderImageHandles()}</div>
        ${hasError ? html`<p part="error">${this.localize(this.errorMessageKey())}</p>` : nothing}
        ${this.editError ? html`<p part="edit-error">${this.localize('docxEditorEditUnavailable')}</p>` : nothing}
        <div part="status">
          <span part="filename">${this.filename || this.localize('docxEditorUntitled')}</span>
          <span part="state">${status}</span>
          ${this.renderZoom()}
        </div>
      </section>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-docx-editor': LyraDocxEditor;
  }
}
