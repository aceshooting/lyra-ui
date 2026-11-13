---
'@aceshooting/lyra-ui': patch
---

Keep PDF document replacement and detached-state cleanup working when the PDF renderer throws or rejects while releasing a document.

The verified SSR coverage script registration and shared PDF cleanup add 224 published metadata, runtime, and declaration bytes. Update the measured unpacked package allowance to the next 64-byte boundary (22,552,704 bytes); retain the existing download and file-count limits.

The shared cleanup adds 17 gzip bytes to the PDF entry (74,116 bytes measured). Advance only its exceeded ceiling to 74,176 bytes, the next 64-byte boundary.

The installed all-components consumer measures 5,671,510 raw bytes across the same 64 files. Advance its exceeded raw ceiling to 5,671,552 bytes, the next 64-byte boundary; keep the separate optional-asset and import-splitting checks.
