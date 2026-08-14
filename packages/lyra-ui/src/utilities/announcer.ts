/**
 * The throttling/coalescing ARIA live-region engine behind `<lr-live-region>`.
 *
 * Part of the curated `@aceshooting/lyra-ui/utilities/*` surface: these re-exports are the
 * supported entry points, and they are covered by semver. The `internal/` modules they forward to
 * are not — that tree is free to move.
 */
export {
  acquireAnnouncementSink,
  ANNOUNCEMENT_SINK_ATTRIBUTE,
  Announcer,
} from '../internal/announcer.js';
export type {
  AnnounceOptions,
  AnnouncementPoliteness,
  AnnouncementSink,
  AnnouncementSinkOptions,
  AnnouncerOptions,
  AnnouncerTimerHost,
} from '../internal/announcer.js';
