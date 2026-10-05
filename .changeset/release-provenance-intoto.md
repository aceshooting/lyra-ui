---
'@aceshooting/lyra-ui': minor
---

Release provenance is now also attached to each GitHub Release as `<tarball>.intoto.jsonl`, next to the existing `<tarball>.sigstore.json`. Both files hold the same Sigstore bundle, so `gh attestation verify --bundle` accepts either one, and tools that discover provenance by file name now find it.
