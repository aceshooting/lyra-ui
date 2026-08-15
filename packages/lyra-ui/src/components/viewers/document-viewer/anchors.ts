/**
 * The shared addressing scheme every anchor-capable lyra-ui viewer (and every KG/RAG component
 * that points into one) uses to locate a passage inside a document, independent of that document's
 * format. A W3C Web-Annotation-inspired discriminated union: which fields are meaningful depends
 * entirely on `kind`.
 */
export type LyraAnchor =
  | { readonly kind: 'page'; readonly page: number } // pdf page, pptx slide
  | {
      readonly kind: 'text-quote';
      readonly quote: string;
      readonly prefix?: string;
      readonly suffix?: string;
      readonly page?: number;
    }
  | { readonly kind: 'fragment'; readonly id: string } // heading/element id (markdown, html, docx)
  | { readonly kind: 'line-range'; readonly start: number; readonly end?: number } // code, terminal, text
  | { readonly kind: 'cell-range'; readonly sheet?: string; readonly range: string } // 'A1:C3' (spreadsheet, csv, dataset)
  | { readonly kind: 'cfi'; readonly cfi: string } // epub
  | { readonly kind: 'time-range'; readonly start: number; readonly end?: number } // seconds (audio/video)
  | {
      readonly kind: 'region';
      readonly page?: number;
      readonly rect: Readonly<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    } // percent units
  | { readonly kind: 'node-path'; readonly path: readonly (string | number)[] }; // json/xml tree

/** Every possible `LyraAnchor['kind']` value, e.g. for a viewer's `anchorKinds` capability list. */
export type LyraAnchorKind = LyraAnchor['kind'];

/** Token-mapped highlight color; `accent` is the default when a `LyraHighlight` omits `tone`. */
export type LyraHighlightTone = 'accent' | 'success' | 'warning' | 'danger' | 'neutral';

/** One host-supplied highlight: an anchor plus optional display metadata.
 *
 * Highlight collections use a nonempty `id` as their business identity. Consumers trim IDs,
 * retain the first occurrence, and ignore blank or later duplicate records.
 */
export interface LyraHighlight {
  readonly id: string;
  readonly anchor: LyraAnchor;
  readonly label?: string;
  /** Host-attached commentary. Carried by every anchor-capable viewer but never rendered by them --
   *  only a provenance-style surface (e.g. a future `lr-provenance-panel`) renders `note` text. */
  readonly note?: string;
  readonly tone?: LyraHighlightTone;
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
  highlightId: string;
}

/** One detached, finite selection rectangle in an `lr-text-select` event. */
export interface TextSelectRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** `lr-text-select` event detail. `anchor` is `null` when the selection couldn't be anchored. */
export interface TextSelectDetail {
  readonly text: string;
  readonly anchor: LyraAnchor | null;
  readonly rects: readonly TextSelectRect[];
}

/** `lr-anchor-result` event detail. */
export interface AnchorResultDetail {
  found: boolean;
}
