---
"@aceshooting/lyra-ui": patch
---

`LyraElement` no longer overrides `ReactiveElement.getPropertyDescriptor()`.

`@lit/reactive-element` 2.1.2 deprecates that hook and warns about it during `finalize()`, so every
consumer saw an unactionable dev-mode warning on every page load that mounted any `lr-*` element —
not silenceable without disabling Lit's dev warnings wholesale.

The more important half was invisible. That override was what implemented the documented
clone-owned/bounded/frozen collection contract on 182 enrolled property names across 87 modules
(`colorSteps`, `legendStops`, `annotations` and their equivalents): it wrapped every reactive setter
and routed owned values through the snapshot helpers. It works today only because the published dist
ships experimental decorators, which still call the hook. Lit states plainly that standard decorators
will not — so a migration, or a consumer build applying them, would have silently reverted every one
of those properties to storing the caller's live array by reference. No clone, no freeze, no error,
no warning, and no test would have caught it: a documented immutability guarantee would simply have
stopped holding.

The contract now rides a decorator-agnostic seam that re-defines the already-finished prototype
accessor. Legacy `@property`, standard `accessor`/setter decorators, a `static properties` block and
hand-written getter/setter pairs all end in a prototype accessor by finalization, so this walks the
finished accessor rather than the hook Lit refuses to call. It installs from the finalization trigger
Lit itself documents, which registration always reads, and registration strictly precedes every
instance — constructing an unregistered custom element throws — so no assignment can reach an
unwrapped setter.

`finalize()` was deliberately not hooked: that would add a static method to the class surface, which
the component inventory records per component and `check:pinned-upstream-manifests` grades. The
chosen seam changes no static surface at all.
