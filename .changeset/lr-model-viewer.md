---
'@aceshooting/lyra-ui': minor
---

Add `<lr-model-viewer>`, a bounded static preview for glTF, GLB, STL, OBJ, PLY, XYZ and PCD files that renders with the optional `@aceshooting/lyra-3d/model` engine.

- The companion loads lazily and only for a nonempty, supported source. A persistent text alternative and a guarded download link stay visible when the source, the companion or WebGL is unavailable.
- Sources pass the shared URL policy and are read through a bounded reader with a fixed 64 MiB ceiling; model files cannot load external resources or run code.
- The camera surface has keyboard orbit, zoom and fit (mirrored under RTL) and native toolbar buttons. `camera` is a copied, finite-checked property; user movement emits `lr-camera-change`.
- `<lr-document-viewer>` opens model attachments in place through the new `kind: 'model'` payload and `model-viewer-register.js`. The registry also accepts lazy payload adapters (`rendererKind: 'adapted'`).

The viewers-family gzip budget includes the new component with the reviewed 2% allowance. Package ceilings follow the measured model-viewer code, editor metadata and 13 translated controls, rounded to 64-byte boundaries; the UI archive retains its existing companion-pack allowance. The packed core registration graph retains 60 bytes of regression headroom above its measured non-asset size, with the required binary measured separately. The look-composition documentation route ceiling follows its measured UTF-8 size.
