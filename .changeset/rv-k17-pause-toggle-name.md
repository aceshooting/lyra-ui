---
"@aceshooting/lyra-ui": major
---
lr-poll-status and lr-random-content: the pause button is named by its action (`Pause`/`Resume`) alone and no longer carries `aria-pressed`, so screen readers stop announcing "Resume, pressed". Migration: stop reading `aria-pressed` on the pause button; read the `paused` property instead.
