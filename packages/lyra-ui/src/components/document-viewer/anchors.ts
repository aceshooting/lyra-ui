/**
 * The shared addressing scheme every anchor-capable lyra-ui viewer (and every KG/RAG component
 * that points into one) uses to locate a passage inside a document, independent of that document's
 * format. A W3C Web-Annotation-inspired discriminated union: which fields are meaningful depends
 * entirely on `kind`.
 */
export type LyraAnchor =
  | { kind: 'page'; page: number } // pdf page, pptx slide
  | { kind: 'text-quote'; quote: string; prefix?: string; suffix?: string; page?: number }
  | { kind: 'fragment'; id: string } // heading/element id (markdown, html, docx)
  | { kind: 'line-range'; start: number; end?: number } // code, terminal, text
  | { kind: 'cell-range'; sheet?: string; range: string } // 'A1:C3' (spreadsheet, csv, dataset)
  | { kind: 'cfi'; cfi: string } // epub
  | { kind: 'time-range'; start: number; end?: number } // seconds (audio/video)
  | { kind: 'region'; page?: number; rect: { x: number; y: number; width: number; height: number } } // percent units
  | { kind: 'node-path'; path: (string | number)[] }; // json/xml tree

/** Every possible `LyraAnchor['kind']` value, e.g. for a viewer's `anchorKinds` capability list. */
export type LyraAnchorKind = LyraAnchor['kind'];

/** Token-mapped highlight color; `accent` is the default when a `LyraHighlight` omits `tone`. */
export type LyraHighlightTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

/** One host-supplied highlight: an anchor plus optional display metadata. */
export interface LyraHighlight {
  id: string;
  anchor: LyraAnchor;
  label?: string;
  /** Host-attached commentary. Carried by every anchor-capable viewer but never rendered by them --
   *  only a provenance-style surface (e.g. a future `lr-provenance-panel`) renders `note` text. */
  note?: string;
  tone?: LyraHighlightTone;
}

/** Characters of normalized context captured before/after a selection when building a `text-quote`
 *  anchor's `prefix`/`suffix` (see `internal/text-quote.ts`'s `buildQuoteAnchor`). */
export const TEXT_QUOTE_CONTEXT_CHARS = 32;

/** A renderer's/viewer's anchor-related capability declaration, so a host can feature-detect before
 *  relying on anchor/highlight/search/text-select support. */
export interface AnchorTargetCapabilities {
  anchors?: LyraAnchorKind[];
  /** Uniform in-document search (see the `search()`/`searchNext()`/`searchPrevious()`/
   *  `clearSearch()` contract implemented per-viewer) -- this flag lets a registry entry declare
   *  it once a given viewer supports it. */
  search?: boolean;
  /** Whether the viewer emits `lr-text-select` on selection end. */
  textSelect?: boolean;
}

/** `lr-highlight-activate` event detail. */
export interface HighlightActivateDetail {
  id: string;
}

/** `lr-text-select` event detail. `anchor` is `null` when the selection couldn't be anchored. */
export interface TextSelectDetail {
  text: string;
  anchor: LyraAnchor | null;
  rects: DOMRect[];
}

/** `lr-anchor-result` event detail. */
export interface AnchorResultDetail {
  found: boolean;
}
