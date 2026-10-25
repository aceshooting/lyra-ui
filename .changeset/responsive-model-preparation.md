---
'@aceshooting/lyra-3d': minor
---

Add cancellable asynchronous model loading with owned input snapshots, bounded preparation, worker fallback, and atomic scene replacement. Keep synchronous model loading available and load format-specific parsers on demand.

Update point and graph visual state through affected attribute ranges, make fallback graph layout resumable within an iteration, and reduce temporary XYZ parsing allocations while preserving rendering and deterministic layout results.

Reuse resolved style-color conversions within each paint. Convert admitted double-precision mesh attributes to finite GPU-compatible storage before installation, preserving cancellation and the previously installed model on failure.

Asynchronous preparation improves scheduling and cancellation opportunities, not necessarily total throughput. The large-GLB synchronous admission comparison measured medians of 44–49 ms versus about 12 ms in 1.0.0. A control reproduced comparable slow calls without receipt storage, and profiling associated slower calls with major garbage collection; the complete cost has not been isolated. Shared resumable validation and owned snapshots preserve the same refusal and ownership contracts, with this measured synchronous throughput limitation.

The optional 3D companion now ships 165 files, including separate preparation, worker, and format-decoder modules. Update its file ceiling to that exact inventory and its exceeded packed and unpacked byte ceilings to the next 64-byte boundary. Runtime sources, tests, source maps, and fixtures remain excluded from the archive.

Sparse hover and focus changes now update only affected point and graph paint rows, without rewriting geometry. In three runs of 200 changes on a 1M-point scene, median per-run state CPU p50/p95 improved from 120.9/124.7 ms to 0.1/0.2 ms; uploaded attribute data fell from 3.2 GB to 4.8 KB per run. Pixel and buffer output matched the published release exactly.

Dense updates retain additional linear state-comparison and exact change-tracking work to support sparse uploads and unchanged-state no-ops. Median synchronous select-all control costs were 26.6→34.5 ms for 100k points, and 27.4→38.3 ms (spatial), 36.7→46.7 ms (translucent), 27.8→37.8 ms (labels), and 27.8→36.0 ms (stationary particles) for graphs with 10k nodes and 30k edges. The labeled-graph style control measured 38.4→49.1 ms. Dense control timings include the same caller array/set construction in both versions; they are not isolated engine-only or GPU durations. These are medians of three control observations, with exact output parity preserved.
