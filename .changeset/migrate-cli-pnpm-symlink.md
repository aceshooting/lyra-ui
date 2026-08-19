---
"@aceshooting/lyra-ui": patch
---

The `lyra-ui-migrate` CLI no longer silently does nothing when launched through a package manager's
bin shim. Its entry guard compared `process.argv[1]` to `import.meta.url` as raw paths; under pnpm
the package directory is a symlink into the virtual store, so the two never matched and `run()`
never executed. The process printed nothing — not even `--help` — rewrote nothing, wrote no report,
and exited 0.

The serious half is that `--check` is documented as a CI gate that "exits nonzero while rewrites or
warnings remain". A silent exit 0 is indistinguishable from success, so on every pnpm project the
gate passed unconditionally — worse than having no gate, because it is trusted. npm and yarn were
unaffected, which is why it survived. The guard now compares realpaths, and a regression test
invokes the CLI through a symlink that mimics the pnpm layout.
