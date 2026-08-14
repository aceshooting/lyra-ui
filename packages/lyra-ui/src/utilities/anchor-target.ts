/** Public structural contracts for components that expose Lyra's shared document-anchor surface.
 * The implementation mixin remains internal; consumers can implement or feature-detect this
 * interface without importing an unsupported source path. */
export type {
  LyraAnchorTarget,
  LyraAnchorTargetEventMap,
} from '../internal/anchor-target.js';
