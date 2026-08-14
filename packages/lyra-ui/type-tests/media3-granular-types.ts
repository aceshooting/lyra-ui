import type {
  LyraMapChoroplethLayer,
  LyraMapGeoJsonDataLayer,
  LyraMapLegendEntry,
  LyraMapLegendPattern,
  LyraMapLegendProjection,
  LyraMapMarker,
} from '../src/components/media/map/map.js';
import type {
  LyraFrame,
  LyraMediaCardKind,
  LyraMediaCardOpenDetail,
} from '../src/components/media/media-card/media-card.js';
import type { LyraZoomableFrameLoading } from '../src/components/media/zoomable-frame/zoomable-frame.js';
import type { VideoState } from '../src/components/media/video/video.js';

declare const canonicalMediaTypes: [
  LyraMapChoroplethLayer,
  LyraMapGeoJsonDataLayer,
  LyraMapLegendEntry,
  LyraMapLegendPattern,
  LyraMapLegendProjection,
  LyraMapMarker,
  LyraFrame,
  LyraMediaCardKind,
  LyraMediaCardOpenDetail,
  LyraZoomableFrameLoading,
  VideoState
];
void canonicalMediaTypes;

// @ts-expect-error LegendEntry was removed in favor of LyraMapLegendEntry.
import type { LegendEntry } from '../src/components/media/map/map.js';
// @ts-expect-error ChoroplethLayer was removed in favor of LyraMapChoroplethLayer.
import type { ChoroplethLayer } from '../src/components/media/map/map.js';
// @ts-expect-error GeoJsonDataLayer was removed in favor of LyraMapGeoJsonDataLayer.
import type { GeoJsonDataLayer } from '../src/components/media/map/map.js';
// @ts-expect-error MapMarker was removed in favor of LyraMapMarker.
import type { MapMarker } from '../src/components/media/map/map.js';
// @ts-expect-error MediaCardKind was removed in favor of LyraMediaCardKind.
import type { MediaCardKind } from '../src/components/media/media-card/media-card.js';
// @ts-expect-error MediaCardFrame was removed in favor of the shared LyraFrame.
import type { MediaCardFrame } from '../src/components/media/media-card/media-card.js';
// @ts-expect-error MediaCardOpenDetail was removed in favor of LyraMediaCardOpenDetail.
import type { MediaCardOpenDetail } from '../src/components/media/media-card/media-card.js';
// @ts-expect-error ZoomableFrameLoading was removed in favor of LyraZoomableFrameLoading.
import type { ZoomableFrameLoading } from '../src/components/media/zoomable-frame/zoomable-frame.js';
// @ts-expect-error LyraVideoState was removed in favor of the mirrored VideoState.
import type { LyraVideoState } from '../src/components/media/video/video.js';
// @ts-expect-error safeMediaSrc is an internal implementation detail of lr-media-card.
import { safeMediaSrc as removedSafeMediaSrc } from '../src/components/media/media-card/media-card.js';
// @ts-expect-error safeLinkHref is an internal implementation detail of lr-media-card.
import { safeLinkHref as removedSafeLinkHref } from '../src/components/media/media-card/media-card.js';
// @ts-expect-error Zoom-level defaults are private implementation details.
import { DEFAULT_ZOOM_LEVELS } from '../src/components/media/zoomable-frame/zoomable-frame.class.js';
// @ts-expect-error Sandbox defaults are private implementation details.
import { DEFAULT_IFRAME_SANDBOX } from '../src/components/media/zoomable-frame/zoomable-frame.class.js';
// @ts-expect-error Iframe URL policy is private to the component sink.
import { safeZoomableFrameSrc } from '../src/components/media/zoomable-frame/zoomable-frame.class.js';
// @ts-expect-error Iframe sandbox policy is private to the component sink.
import { safeZoomableFrameSandbox } from '../src/components/media/zoomable-frame/zoomable-frame.class.js';

declare const removedMediaTypes: [
  LegendEntry,
  ChoroplethLayer,
  GeoJsonDataLayer,
  MapMarker,
  MediaCardKind,
  MediaCardFrame,
  MediaCardOpenDetail,
  ZoomableFrameLoading,
  LyraVideoState
];
void removedMediaTypes;
void removedSafeMediaSrc;
void removedSafeLinkHref;
void DEFAULT_ZOOM_LEVELS;
void DEFAULT_IFRAME_SANDBOX;
void safeZoomableFrameSrc;
void safeZoomableFrameSandbox;
