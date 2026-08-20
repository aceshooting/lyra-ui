---
"@aceshooting/lyra-ui": major
---

**Breaking:** `LyraElement` no longer declares the static `getPropertyDescriptor()`, so that member
is gone from every element's public surface in `custom-elements.json`.

This is the release's only substantive breaking change, and in practice nothing consumer-callable
was removed: `getPropertyDescriptor()` is Lit's own finalization hook, called *by* `ReactiveElement`
during `finalize()` and never by application code. It appeared on all 285 tags purely because this
library overrode it, and the manifest projects an inherited static onto every subclass. Only code
that subclassed an `lr-*` element and overrode the hook itself is affected — a path Lit has already
deprecated and states will not be called under standard decorators.

The major is nonetheless correct rather than pedantic. By this package's own definition of public
surface, a public static was removed from every element, and the reachable-declaration set of every
export shrank as a result. The semver gate reports that honestly, and the alternative — shipping it
as a minor behind a blanket exception — would have meant weakening the gate to let one change past
it.

`@lit/reactive-element` 2.1.2 deprecates that hook and warns during `finalize()`, so every consumer
saw an unactionable dev-mode warning on every page load that mounted any `lr-*` element, not
silenceable without disabling Lit's dev warnings wholesale.

The more important half was invisible. That override was what implemented the documented
clone-owned/bounded/frozen collection contract on 182 enrolled property names across 87 modules
(`colorSteps`, `legendStops`, `annotations` and their equivalents): it wrapped every reactive setter
and routed owned values through the snapshot helpers. It worked only because the published dist
ships experimental decorators, which still call the hook. Lit states plainly that standard
decorators will not — so a migration, or a consumer build applying them, would have silently
reverted every one of those properties to storing the caller's live array by reference. No clone, no
freeze, no error, no warning, and no test would have caught it.

The contract now rides a decorator-agnostic seam that re-defines the already-finished prototype
accessor. Legacy `@property`, standard `accessor`/setter decorators, a `static properties` block and
hand-written getter/setter pairs all end in a prototype accessor by finalization, so this walks the
finished accessor rather than the hook Lit refuses to call. It installs from the finalization
trigger Lit itself documents, and registration strictly precedes every instance — constructing an
unregistered custom element throws — so no assignment can reach an unwrapped setter.

`finalize()` was deliberately not hooked: that would add a static method to the class surface, which
the component inventory records per component and a pinned-manifest gate grades. The chosen seam
changes no static surface at all.

**No migration is expected.** If you do not override `getPropertyDescriptor()` on an `lr-*`
subclass, there is nothing to do.
