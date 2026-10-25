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

The model entry loads format parsers on demand. In three paired Chromium cold-document runs against published @aceshooting/lyra-3d 1.0.0, XYZ requested no Three format loaders; OBJ requested only OBJLoader, and subsequent GLB loading added GLTFLoader. Rendered pixels and public positions matched exactly. Initial requested JavaScript, including shared chunks, decreased from 700,186 to 651,041 bytes (7.0%); summed per-chunk gzip estimates decreased from 181,525 to 170,847 bytes (5.9%). After XYZ, OBJ and GLB had all loaded, cumulative JavaScript was 708,388 bytes versus 700,186 (gzip estimate 188,615 versus 181,525).

This reduces initial bytes, but does not establish faster startup or loading. Median engine readiness increased 138.8 → 163.2 ms; load-to-progress times increased 11.0 → 14.9 ms for XYZ, 5.2 → 11.8 ms for OBJ and 12.5 → 25.4 ms for GLB. GLB progress-to-framebuffer-capture increased 22.1 → 32.3 ms. Median navigation-to-ready was 207.6 → 221.9 ms. These three-trial browser wall times include module loading, application scheduling and rendering work; the complete candidate also includes admission and preparation changes, so the differences do not isolate parser CPU or lazy-loading overhead. Fresh documents shared the browser process and OS caches; gzip sizes are artifact estimates, and no p95 or allocation improvement is claimed.

The asynchronous model-loading campaign passed 42 browser cases using hardware rendering: XYZ, binary PLY and OBJ at 100k and 1M source vertices, using workers and the main-thread fallback, plus trusted cancellation tests. Observed output counts, bounds, coordinate samples, rendering and picks passed. All six cancellations rejected before commit and preserved the prior scene.

For 100k XYZ cancellation, median browser event-to-handler delay was 0.7ms with workers and 6.7ms with fallback; abort-to-rejection was 0.3ms in both modes. These are three descriptive samples per mode, exclude automation transport overhead and are not latency guarantees.

Responsiveness still has limits: 8 of 18 successful 100k loads had main-thread tasks of 51–74ms overlapping commit. Worker-mode examples occurred after the worker returned its result; the trace does not establish their parser cause. At 1M, XYZ/PLY tasks reached 253–283ms. These results do not establish an entirely jank-free loading path or a blanket performance improvement.

Heap observations cover sampled, instrumented main-realm JavaScript memory; worker, GPU and whole-process peaks are not measured. Disposal observations likewise do not prove complete native-resource reclamation.
