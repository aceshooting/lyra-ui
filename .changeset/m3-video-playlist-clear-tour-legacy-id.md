---
'@aceshooting/lyra-ui': major
---

`lr-video-playlist`'s `lr-video-change` event now fires when the playlist goes from an active video to none (the last enabled video removed or made inert), with `detail.video` set to `null` and `detail.currentIndex` set to `-1`. `LyraVideoPlaylistChangeDetail.video`'s type widens from `LyraVideoPlaylistVideo` to `LyraVideoPlaylistVideo | null` to carry this. Every other `lr-video-change` emission is unchanged. Migration: add a null check before reading `detail.video.title`/`.poster`/`.sources`/`.tracks` in an `lr-video-change` listener, e.g. `if (event.detail.video === null) { /* playlist emptied */ }`.

`lr-tour` no longer accepts a step object's undocumented, pre-rename `id` field as a fallback for `stepId`. A step supplying only `id` (no `stepId`) is now dropped like any other malformed step, instead of silently being accepted. Migration: rename any tour step's `id` field to `stepId` (`const steps = oldSteps.map(({ id, ...rest }) => ({ stepId: id, ...rest }))`).
