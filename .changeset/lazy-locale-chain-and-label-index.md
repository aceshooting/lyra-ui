---
'@aceshooting/lyra-ui': patch
---

Lighter first paint for every component, and for form controls in particular. The full locale
fallback chain (regional fallbacks, likely-subtags ranking, parent catalogs) is now installed by the
first `registerLyraLocale()`/`registerLyraLocaleDelta()` call, so an application that renders only
the built-in English messages no longer ships it; plural selection and number formatting still use
the inherited locale, and an app that registers its catalogs before first render resolves exactly
as before. Form controls watch for external `<label>` association with a small lean observer and
load the indexed association observer only once a control has an associated label or a mutation
could give it one. A label present when a control connects is applied in that control's first
update, as before; label changes made before the observer chunk first loads are replayed with the
same targeting when it arrives.
