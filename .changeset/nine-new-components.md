---
"@aceshooting/lyra-ui": minor
---

Nine new components:

- `lyra-animated-image` — a still/animated-GIF-style image that pauses on `prefers-reduced-motion`
  and exposes a play/pause toggle.
- `lyra-animation` — declarative Web Animations API wrapper for a slotted target, with named
  timing presets, `prefers-reduced-motion` handling, and `lyra-start`/`lyra-finish`/`lyra-cancel`
  events.
- `lyra-avatar-group` — a stacked, overlapping set of avatars with a "+N" overflow indicator.
- `lyra-include` — fetches and renders external HTML/Markdown/plain-text content client-side, with
  URL validation and DOMPurify sanitization.
- `lyra-known-date` — a form-associated day/month/year input for approximate or partial dates
  (e.g. a birth date where only the year is known).
- `lyra-lightbox` — a full-screen, modal, click-to-enlarge image viewer with prev/next navigation
  across an ordered set of images, built on the same shared overlay infrastructure as
  `lyra-dialog`/`lyra-command-palette`.
- `lyra-qr-code` — renders a QR code from text/URL data, via the optional `qrcode` peer dependency
  (same optional-peer pattern as the chart/map bundles).
- `lyra-random-content` — displays a randomly (or sequentially) chosen subset of its slotted
  children, with optional autoplay.
- `lyra-timeline`/`lyra-timeline-item` — a vertical event timeline with per-item status/icon
  markers.
- `lyra-tour` — a guided, multi-step product-tour overlay that highlights target elements in
  sequence.
