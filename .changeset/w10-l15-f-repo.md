---
'@aceshooting/lyra-ui': major
'@aceshooting/lyra-map': patch
---

- **Breaking:** `lr-agent-workspace` stops the generic control-state events of its built-in children (native `input` and `change`, `lr-change`, `lr-invalid`, disclosure and show/hide events) at its boundary. Child intents such as `lr-load-more`, chunk, citation and tool activation, clipboard and export events keep bubbling out of the host.
  - Migration: listen on the workspace's own events, or read the composer's state through the workspace properties instead of a `change` listener above the host.
- **Breaking:** `lr-prompt-input` and `lr-model-settings-panel` keep their embedded pickers' request and popup events inside; `lr-prompt-input` also keeps the pickers' `lr-input` from reaching the host as its own.
  - Migration: an `lr-input` listener above `lr-prompt-input` now hears only the prompt's own input; observe the model or voice choice through the host's documented properties and events.
- **Breaking:** `lr-geojson-viewer` keeps every `lr-map-*` event of its internal map inside the viewer.
  - Migration: render `lr-map` directly when an application needs its map events.
- **Breaking:** `lr-markdown` routes only unmodified primary link activations.
  - Migration: listen for `click` directly to handle modified or previously canceled link clicks.
- **Breaking:** `lr-notebook-viewer` no longer loads remote images from markdown cells and keeps nested markdown link activations from reaching the host. No option restores remote image loading.
- **Breaking:** `lr-archive-viewer` no longer shows the "File"/"Folder" text beside every entry; it stays available to assistive technology through the new `entry-kind` part.
  - Migration: override the visually hidden `::part(entry-kind)` styles to show the text again.
- `lr-tree` and `lr-file-tree` with a `treeSource` let keys a row does not handle, such as Escape and application shortcuts, reach document and ancestor listeners, so an enclosing dialog or drawer closes on Escape.
- Editor data and the manifest list the defaults of accessor-backed attributes, such as `lr-chat-composer`'s `actions-layout` and `status`, `lr-audio-visualizer`'s `mode` and `state`, and every `autocorrect`.
- `@aceshooting/lyra-map`: update the style-spec dependency to 26.9.0; the third-party notices name the installed version.
