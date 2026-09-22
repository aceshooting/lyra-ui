import type { LyraImageFit as LightboxImageFit } from '../src/components/lr-lightbox.js';
import type { LyraImageFit as PanZoomImageFit } from '../src/components/lr-pan-zoom.js';
import type { LyraImageFit as ImageViewerImageFit } from '../src/components/lr-image-viewer.js';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Assert<Value extends true> = Value;

type LightboxMatchesImageViewer = Assert<Equal<LightboxImageFit, ImageViewerImageFit>>;
type PanZoomMatchesImageViewer = Assert<Equal<PanZoomImageFit, ImageViewerImageFit>>;

const sharedFit: ImageViewerImageFit = 'contain';
const lightboxFit: LightboxImageFit = sharedFit;
const panZoomFit: PanZoomImageFit = lightboxFit;
// @ts-expect-error Fit values are limited to the shared public union.
const unsupportedFit: PanZoomImageFit = 'cover';

declare const samePublicContract: [LightboxMatchesImageViewer, PanZoomMatchesImageViewer];
void [sharedFit, lightboxFit, panZoomFit, unsupportedFit, samePublicContract];
