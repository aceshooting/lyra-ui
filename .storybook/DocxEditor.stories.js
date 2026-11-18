import { storyMeta, stories } from '../packages/lyra-docs/test/editor.stories.js';

export default { ...storyMeta, title: 'Companions/DOCX editor' };
export const CommandsOutlineAndChecks = { ...stories.CommandsOutlineAndChecks };
export const CommentsAndTrackedText = { ...stories.CommentsAndTrackedText };
export const TableFormatting = { ...stories.TableFormatting };
export const ImageReplacement = { ...stories.ImageReplacement };
export const PaintedParagraphs = { ...stories.PaintedParagraphs };
export const NarrowEditor = { ...stories.NarrowEditor };
export const DocumentToolsFirstRow = { ...stories.DocumentToolsFirstRow };
export const PageWideToolbar = { ...stories.PageWideToolbar };

export const CompactToolbar = { ...stories.CompactToolbar };
export const HostManagedNew = { ...stories.HostManagedNew };
export const HostOutlineAndExport = { ...stories.HostOutlineAndExport };
