---
"@aceshooting/lyra-ui": major
---

**Version note: this major carries no known breaking change for consumers.**

Everything in this release is additive or a bug fix — no public member was removed, renamed, or
had its behaviour or default altered. The major bump is taken because the public-API semver gate
(`check:public-api`) classifies 328 changes as breaking, and every one of them is fingerprint or
generated-type churn rather than a real break:

- 248 `:dependencies` and 39 `:contract` hash changes — a symbol's transitive-dependency
  fingerprint moves whenever a widely-composed base class gains a member, so adding one property to
  `LyraChart` rewrites the hash of every chart subclass and every subpath that re-exports it.
- 39 generated React/Vue/Svelte props **type strings**, widened by the newly added props. The
  differ compares the printed type text, which cannot distinguish an additive union widening from a
  removal.
- 2 `lr-popover` `popup-role` default entries moving `null → 'dialog'`. The default did not change;
  this release simply documents it with `@default` for the first time, so the manifest records a
  value where it previously recorded none.

Consumers upgrading from 10.x should not need code changes. If you use the generated framework
prop types, the unions gained members but lost none.
