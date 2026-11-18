import { createDocxSession, type DocxSession, type DocxSnapshot, type DocxAction, type DocxEdit, type DocxCommand, type DocxFormatting, type DocxImageDirection, type DocxImageAction, type DocxImageContext, type DocxImageDescription, type DocxTableAction, type DocxTableContext, type DocxParagraphStyles, type DocxFontFamilies, type DocxSearchOptions, type DocxSearchResults, type DocxSearchMatch } from '@aceshooting/lyra-docs/docx';
import type { DocxDocumentToolsPlacement, DocxToolbarPlacement, DocxToolbarLayout, DocxToolbarDensity, DocxFileRequestDetail, LyraDocxEditor } from '@aceshooting/lyra-docs/docx/editor.class';
import type { DocxImageSource, DocxInsertImageOptions, DocxRevision, DocxResult, DocxTableBorderStyle, DocxTableBorderTarget } from '@aceshooting/lyra-docs/docx';
import { DOCX_REMOTE_LIMITS, fetchDocxBytes, type DocxFetchOptions } from '@aceshooting/lyra-docs/docx';
import { DOCX_BATCH_LIMITS, DOCX_FRAGMENT_LIMITS, type DocxBatchEdit, type DocxBatchOptions, type DocxBatchResult, type DocxBatchStep,
  type DocxFragment, type DocxPaintDetail, type DocxFragmentBlock, type DocxFragmentBlockKind, type DocxFragmentRequest, type DocxParagraphEdit } from '@aceshooting/lyra-docs/docx';
import { DOCX_COMMAND_CATALOG, buildDocxCommandAction, type DocxCommandDescriptor, type DocxOutline,
  type DocxDocumentInspection, type DocxReviewReport } from '@aceshooting/lyra-docs/docx';
import type { DocxSelectionBlock, DocxSerializationOptions, DocxMoveBlocksEdit } from '@aceshooting/lyra-docs/docx';
// @ts-expect-error DOCX-specific contracts belong to the format subpath.
import type { DocxSession as RootSession } from '@aceshooting/lyra-docs';
// @ts-expect-error The internal factory is not public.
import { createInternalDocxSession } from '@aceshooting/lyra-docs/docx';
// @ts-expect-error Internal engine injection is not an export.
import type { DocxSessionPort } from '@aceshooting/lyra-docs/docx/engine-port';

export type ExportWitness = [DocxSession, DocxSnapshot, RootSession, DocxSessionPort, LyraDocxEditor];
void createInternalDocxSession;
void createDocxSession;

// @ts-expect-error Engine command representations are not public.
import type { EditorCommand } from '@aceshooting/lyra-docs/docx';
// @ts-expect-error Validation helpers are internal implementation details.
import { normalizeDocxAction } from '@aceshooting/lyra-docs/docx';

export type EditingExportWitness = [DocxImageAction, DocxImageContext, DocxImageDescription, DocxTableAction, DocxTableBorderStyle, DocxTableBorderTarget, DocxTableContext, DocxAction, DocxEdit, DocxCommand, DocxFormatting, DocxParagraphStyles,
  DocxFontFamilies, DocxSearchOptions, DocxSearchResults, DocxSearchMatch, EditorCommand];
void normalizeDocxAction;

function editingContracts(session: DocxSession): void {
  const catalog: readonly DocxCommandDescriptor[] = DOCX_COMMAND_CATALOG;
  const command = buildDocxCommandAction(catalog[0]!.id);
  if (command) session.can(command);
  const outline: DocxResult<DocxOutline> = session.outline();
  const inspection: DocxResult<DocxDocumentInspection> = session.inspectDocument();
  const review: DocxResult<DocxReviewReport> = session.review();
  void outline; void inspection; void review;
  session.selectOutlineItem('opaque'); session.selectDiagnostic('opaque'); session.selectReviewItem('opaque');
  session.execute({ type: 'add-comment', text: 'Review this', author: 'Editor' });
  session.execute({ type: 'reply-comment', id: 'opaque', text: 'Done', author: 'Editor' });
  session.execute({ type: 'review-decision', id: 'opaque', decision: 'accept' });
  session.execute({ type: 'track-changes', enabled: true, author: 'Editor' });
  // @ts-expect-error Review mutations require an explicit author.
  session.execute({ type: 'add-comment', text: 'Review this' });
  const replacement: Promise<DocxResult<DocxRevision>> = session.replaceImage(new Uint8Array());
  void replacement; session.canReplaceImage();
  const imageSource: DocxImageSource = { bytes: new Uint8Array(), widthPoints: 48, heightPoints: 24 };
  const imageOptions: DocxInsertImageOptions = { signal: new AbortController().signal };
  const insertion: Promise<DocxResult<DocxRevision>> = session.insertImage(imageSource, imageOptions);
  void insertion; session.canInsertImage();
  // @ts-expect-error Insertion requires both authored dimensions.
  session.insertImage({ bytes: new Uint8Array(), widthPoints: 48 });
  // @ts-expect-error Byte insertion is not a synchronous editing command.
  session.execute({ type: 'insert-image', ...imageSource });
  const legacy: DocxCommand = 'bold';
  session.execute(legacy);
  const table: DocxEdit = { type: 'insert-table', rows: 2, columns: 3 };
  session.execute(table);
  session.can({ type: 'delete-table' });
  const borderTarget: DocxTableBorderTarget = 'outside';
  const borderStyle: DocxTableBorderStyle = 'single';
  session.execute({ type: 'table-header-row', enabled: true });
  session.execute({ type: 'table-cell-alignment', value: 'center' });
  session.execute({ type: 'table-cell-shading', color: null });
  session.execute({ type: 'table-width', widthPoints: 300 });
  session.execute({ type: 'table-cell-borders', target: borderTarget, style: borderStyle, widthPoints: 1, color: 'auto' });
  session.execute({ type: 'table-cell-borders', target: borderTarget, style: 'none' });
  // @ts-expect-error Clearing a border carries no authored border spec.
  session.execute({ type: 'table-cell-borders', target: borderTarget, style: 'none', widthPoints: 1 });
  // @ts-expect-error A concrete border requires both width and color.
  session.execute({ type: 'table-cell-borders', target: borderTarget, style: borderStyle, color: 'auto' });
  // @ts-expect-error Table cell vertical alignment has an exact vocabulary.
  session.execute({ type: 'table-cell-alignment', value: 'middle' });
  // @ts-expect-error Only row insertion directions are accepted.
  session.execute({ type: 'insert-table-row', where: 'left' });
  // @ts-expect-error Engine column naming is not public.
  session.execute({ type: 'insert-table', rows: 2, cols: 3 });
  session.can({ type: 'font-size', points: 14 });
  session.execute({ type: 'alignment', value: 'justify' });
  session.execute({ type: 'toggle-list', kind: 'numbered' });
  session.execute({ type: 'resize-image', widthPoints: 120, heightPoints: 60 });
  session.execute({ type: 'image-description', title: '', description: '' });
  session.execute({ type: 'delete-image' });
  session.imageDescription();
  // @ts-expect-error Both image axes are required.
  session.execute({ type: 'resize-image', widthPoints: 120 });
  // @ts-expect-error Engine drawing identities do not leak.
  session.snapshot().image?.id;
  // @ts-expect-error Image contexts are immutable.
  session.snapshot().image!.widthPoints = 1;
  session.paragraphStyles();
  session.fontFamilies();
  session.find('literal', { matchCase: true, wholeWord: true, limit: 10 });
  session.selectMatch('opaque');
  const direction: DocxImageDirection = 'next';
  session.selectImage(direction);
  session.selectImage('previous');
  // @ts-expect-error Only the exact navigation directions are public.
  session.selectImage('first');
  session.replaceMatch('opaque', '');
  const snapshot = session.snapshot();
  if (snapshot.table) {
    // @ts-expect-error Table context is immutable.
    snapshot.table.rows = 7;
    // @ts-expect-error Canonical engine identity is private.
    snapshot.table.tableId;
  }
  // @ts-expect-error Snapshot formatting is immutable.
  snapshot.formatting.fontFamily = 'Arial';
  // @ts-expect-error Engine alignment vocabulary does not leak.
  session.execute({ type: 'alignment', value: 'both' });
  // @ts-expect-error Engine numbered-list spelling does not leak.
  session.execute({ type: 'toggle-list', kind: 'ordered' });
  // @ts-expect-error Raw engine mark commands are not public.
  session.execute({ type: 'setMarkAttr', mark: 'fontSize', attr: 'val', value: 28 });
  const found = session.find('literal');
  if (found.ok) {
    // @ts-expect-error Search matches are immutable.
    found.value.matches.push({ id: 'forged', text: '', before: '', after: '' });
    // @ts-expect-error Engine location addresses do not leak.
    found.value.matches[0]?.blockId;
  }
}
void editingContracts;

async function outlineEditingContracts(session: DocxSession, editor: LyraDocxEditor): Promise<void> {
  const options: DocxSerializationOptions = { signal: new AbortController().signal };
  const bytes: DocxResult<Uint8Array> = await session.exportBytes(options);
  await editor.exportBytes(options);
  if (bytes.ok) {
    bytes.value.fill(0);
    // @ts-expect-error Exported bytes are not a persistence receipt.
    session.acknowledgeSaved(bytes.value);
  }
  const selection: DocxResult<DocxSelectionBlock> = session.selectionBlock();
  if (selection.ok) {
    const index: number | null = selection.value.index;
    void index;
    editor.selectionBlock({ expectedRevision: selection.value.revision });
    // @ts-expect-error Selection reports are immutable.
    selection.value.index = 0;
  }
  const outline = editor.outline();
  if (outline.ok) {
    const index: number | undefined = outline.value.items[0]?.blockIndex;
    void index;
  }
  const styles = session.paragraphStyles();
  if (styles.ok) {
    const level: number | null | undefined = styles.value.items[0]?.outlineLevel;
    void level;
    // @ts-expect-error Style metadata is immutable.
    styles.value.items[0]!.outlineLevel = 1;
  }
  const fragment = editor.readFragment({ maxBlocks: 4 });
  if (fragment.ok) {
    const edit: DocxMoveBlocksEdit = { type: 'move-blocks', start: 0, end: 1, before: 2 };
    await session.applyEdits([{ edit }], { expectedRevision: fragment.value.revision });
    await editor.applyEdits([{ edit }], { expectedRevision: fragment.value.revision });
    // @ts-expect-error A body move cannot target a paragraph selection.
    const targeted: DocxBatchStep = { edit, target: 'opaque' };
    void targeted;
  }
}
void outlineEditingContracts;

function toolbarLayoutContracts(editor: HTMLElementTagNameMap['lr-docx-editor']): void {
  const previousToolbar: DocxToolbarPlacement = editor.toolbarPlacement;
  const previousTools: DocxDocumentToolsPlacement = editor.documentToolsPlacement;
  editor.toolbarPlacement = 'layout';
  editor.documentToolsPlacement = 'first-row';
  const previousLayout: DocxToolbarLayout = editor.toolbarLayout;
  const previousDensity: DocxToolbarDensity = editor.density;
  editor.toolbarLayout = 'single-row';
  editor.density = 'compact';
  editor.fileActions = 'open save';
  editor.toolbarLayout = previousLayout;
  editor.density = previousDensity;
  for (const type of ['lr-new-request', 'lr-open-request'] as const) {
    editor.addEventListener(type, event => {
      const detail: DocxFileRequestDetail = event.detail;
      const source: 'toolbar' | 'command-palette' = detail.source;
      const revision: DocxRevision | null = detail.currentRevision;
      void source; void revision;
      event.preventDefault();
    });
  }
  // @ts-expect-error Layout accepts only the documented row policies.
  editor.toolbarLayout = 'nowrap';
  // @ts-expect-error Density is distinct from a generic component size.
  editor.density = 'small';
  editor.toolbarPlacement = previousToolbar;
  editor.documentToolsPlacement = previousTools;
  // @ts-expect-error The first-row option belongs to documentToolsPlacement.
  editor.toolbarPlacement = 'first-row';
}
void toolbarLayoutContracts;

async function remoteContracts(editor: LyraDocxEditor): Promise<void> {
  const fetched: DocxResult<Uint8Array> = await fetchDocxBytes('/files/report.docx', { signal: new AbortController().signal, baseUrl: 'https://example.test/' });
  const limits: { readonly bytes: number; readonly chunks: number } = DOCX_REMOTE_LIMITS;
  const options: DocxFetchOptions = { fetch: globalThis.fetch };
  void fetched; void limits; void options;
  const opened: DocxResult<DocxRevision> = await editor.openUrl('report.docx', { name: 'Report.docx' });
  void opened;
  // @ts-expect-error Remote loading takes a URL string, not a Request.
  await editor.openUrl(new Request('https://example.test/report.docx'));
  // @ts-expect-error Credentials and request options stay with the host's own fetch.
  await fetchDocxBytes('report.docx', { credentials: 'include' });
}
void remoteContracts;

async function operationContracts(session: DocxSession, editor: LyraDocxEditor): Promise<void> {
  editor.addEventListener('lr-paint', event => {
    const detail: DocxPaintDetail = event.detail;
    const pages: readonly number[] = detail.pageIndexes;
    const revision: DocxRevision = detail.revision;
    void pages; void revision;
  });
  const fragment: DocxResult<DocxFragment> = session.readFragment({ start: 0, maxBlocks: 8, maxText: 2048 });
  editor.readFragment({ outlineItemId: 'opaque' });
  if (fragment.ok) {
    const block: DocxFragmentBlock | undefined = fragment.value.blocks[0];
    const kind: DocxFragmentBlockKind | undefined = block?.kind;
    void kind;
    // @ts-expect-error Fragments are immutable.
    fragment.value.blocks.push(block!);
    // @ts-expect-error Engine node identities do not leak.
    void block?.paragraphId;
    if (block?.id) {
      session.selectFragmentBlock(block.id, { expectedRevision: fragment.value.revision });
      const steps: DocxBatchStep[] = [{ edit: { type: 'paragraph-style', styleId: 'Heading1' }, target: block.id }, { edit: 'bold' },
        { edit: { type: 'font-size', points: 14 } }];
      const result: DocxBatchResult = await session.applyEdits(steps, { expectedRevision: fragment.value.revision });
      if (!result.ok) { const step: number | null = result.step; void step; }
      await editor.applyEdits(steps, { expectedRevision: fragment.value.revision });
      // @ts-expect-error A targeted step accepts only paragraph edits.
      const targetedRun: DocxBatchStep = { edit: 'bold', target: block.id };
      // @ts-expect-error History commands are not batch edits.
      const history: DocxBatchStep = { edit: 'undo' };
      const paragraph: DocxParagraphEdit = { type: 'alignment', value: 'center' };
      const edit: DocxBatchEdit = paragraph;
      void targetedRun; void history; void edit;
      // @ts-expect-error The revision guard is required.
      await session.applyEdits(steps, {});
    }
  }
  const limits: number[] = [DOCX_FRAGMENT_LIMITS.blocks, DOCX_FRAGMENT_LIMITS.text, DOCX_BATCH_LIMITS.steps];
  const request: DocxFragmentRequest = { maxBlocks: 4 };
  const options: DocxBatchOptions = { expectedRevision: { documentId: 'opaque', value: 0 } };
  void limits; void request; void options;
}
void operationContracts;
