import type { LyraIndexedView, LyraSourceRecord, LyraSourceRevision } from '../../../data-sources.js';

/** One image in the set `<lr-lightbox>` browses. `alt`/`caption` are caller-supplied data
 *  (like a filename), not routed through `localize()` -- only the component's own chrome
 *  strings are. */
export interface LyraLightboxImage {
  /** Full-resolution URL. Passed straight through to the embedded `<lr-pan-zoom>`'s own
   *  `src`, which already runs it through `safeMediaSrc()` -- no separate validation needed here. */
  readonly src: string;
  /** Accessible alt text. Defaults to `''` (decorative) when omitted; consumers should supply
   *  real alt text for meaningful images. */
  readonly alt?: string;
  /** Optional visible caption for this image, rendered in `part="caption"` below the stage. */
  readonly caption?: string;
}

/** Host-owned access to the complete ordered image collection. */
export interface LyraLightboxSource {
  readonly revision: LyraSourceRevision;
  readonly images: LyraIndexedView<LyraSourceRecord<LyraLightboxImage>>;
}
