---
'@aceshooting/lyra-ui': patch
---

- Retry a map engine import after a load failure and distinguish it from an incompatible engine in development diagnostics.
- Retry elevated scene rendering when the scene changes after a failed renderer import.
- Restore keyboard focus after moving native map controls or re-enabling a globe or terrain button.
- Ignore a nested drawing cancellation while delivering the completed drawing.
- Abort a remote map image request when its headers and body exceed the 15-second deadline.
- Handle a failed on-demand image runtime as a declined image for both supported map engines.
- Scale exported map credits to the canvas resolution, wrap them at word boundaries and align them with the map’s text direction.
- Use the attribution link’s hostname when its label is blank.
- Use the surface colour for a data label’s halo when only the halo width is specified.
- Cap map camera animations at 60 seconds.
- Preserve camera orientation when a very large bearing would lose precision in the map engine.
- Suspend canvas allocation polling while the drawing target is offscreen.
- Release a drawing drag's pan lease once if pointer capture fails during teardown.
