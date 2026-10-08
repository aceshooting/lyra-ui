import { assertOoxmlPartsWithinLimits, OFFICE_RELATIONSHIP } from '../document-viewer/ooxml-part-guard.js';

const DEFAULT_MAX_PPTX_ENTRIES = 4_000;
const DEFAULT_MAX_PPTX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024;
const DEFAULT_MAX_PPTX_XML_NODES = 1_000_000;
/** Relationship types whose targets the renderer parses as XML, whatever the target part is named. */
const PPTX_XML_PART_TYPES = new Set(
  [
    'officeDocument', 'slide', 'slideMaster', 'slideLayout', 'notesSlide', 'notesMaster', 'handoutMaster',
    'theme', 'chart', 'diagramData', 'diagramLayout', 'diagramQuickStyle', 'diagramColors', 'diagramDrawing',
    'tableStyles', 'presProps', 'viewProps', 'commentAuthors', 'comments',
  ].map((kind) => OFFICE_RELATIONSHIP + kind),
);

export interface PptxResourceGuardOptions {
  maxEntries?: number;
  maxUncompressedBytes?: number;
  maxXmlNodes?: number;
  signal?: AbortSignal;
}

/** Checks ZIP entry count, measured expansion and XML-node complexity before the PPTX renderer opens an archive. */
export function assertPptxArchiveWithinLimits(
  source: ArrayBuffer,
  options: PptxResourceGuardOptions = {},
): Promise<void> {
  return assertOoxmlPartsWithinLimits(source, {
    guardOptions: {
      description: 'PPTX',
      maxEntries: options.maxEntries ?? DEFAULT_MAX_PPTX_ENTRIES,
      maxUncompressedBytes: options.maxUncompressedBytes ?? DEFAULT_MAX_PPTX_UNCOMPRESSED_BYTES,
      signal: options.signal,
    },
    partName: /\.(?:xml|rels)$/i,
    isPartType: (type) => PPTX_XML_PART_TYPES.has(type),
    maxNodes: options.maxXmlNodes ?? DEFAULT_MAX_PPTX_XML_NODES,
  });
}
