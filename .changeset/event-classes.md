---
'@aceshooting/lyra-ui': minor
---

New `@aceshooting/lyra-ui/event-classes` subpath exports one class per event (`LyraChangeEvent`,
`LyraStepChangeEvent`, ...) plus the `LyraEvent` base, so `event instanceof LyraChangeEvent` narrows
`detail` and the instances components dispatch really are those classes. Components now dispatch a
`LyraEvent` (still a bubbling, composed `CustomEvent`; cancelable semantics and detail unchanged) and
never import the per-event classes, so the module is side-effect free and tree-shakable.
