import { createDocxSession, type DocxSession, type DocxSnapshot, type DocxAction, type DocxEdit, type DocxCommand, type DocxFormatting, type DocxImageDirection, type DocxImageAction, type DocxImageContext, type DocxImageDescription, type DocxTableAction, type DocxTableContext, type DocxParagraphStyles, type DocxFontFamilies, type DocxSearchOptions, type DocxSearchResults, type DocxSearchMatch } from '@aceshooting/lyra-docs/docx';
import type { LyraDocxEditor } from '@aceshooting/lyra-docs/docx/editor.class';
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

export type EditingExportWitness = [DocxImageAction, DocxImageContext, DocxImageDescription, DocxTableAction, DocxTableContext, DocxAction, DocxEdit, DocxCommand, DocxFormatting, DocxParagraphStyles,
  DocxFontFamilies, DocxSearchOptions, DocxSearchResults, DocxSearchMatch, EditorCommand];
void normalizeDocxAction;

function editingContracts(session: DocxSession): void {
  const legacy: DocxCommand = 'bold';
  session.execute(legacy);
  const table: DocxEdit = { type: 'insert-table', rows: 2, columns: 3 };
  session.execute(table);
  session.can({ type: 'delete-table' });
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
