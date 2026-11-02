---
'@aceshooting/lyra-ui': minor
---

Add `createMapCameraSession()` at `@aceshooting/lyra-ui/map-camera-session.js` and the root barrel. A session owns a ready `lr-map` camera to capture and restore saved viewpoints, run keyframe camera tours sampled from a shared simulation clock, and follow an accepted scene marker or model as the application moves it. Reduced motion turns transitions into jumps, holds tour keyframes and keeps following still after its first centring. Failures throw `MapCameraSessionError` with a typed code and leave the running action unchanged.

`lr-map` emits the noncancelable `lr-map-camera-interrupt` event, with `detail: { reason }`, when a user gesture, another camera command or `center`/`zoom` assignment, a style change or context loss ends a session action. Maps without a session never emit it.
