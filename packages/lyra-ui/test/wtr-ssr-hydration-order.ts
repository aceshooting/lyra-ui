// Evaluated before Lit's hydration support (see test/wtr-ssr-fixture.ts). LitElement installs
// hydration only if `litElementHydrateSupport` exists when lit-element itself is evaluated, so a
// test that imports `lit` or `@open-wc/testing` ahead of the fixture helper would silently
// client-render over the server markup. Record that ordering mistake so the fixture can name it.
export const litElementLoadedBeforeHydrationSupport =
  (globalThis as { litElementVersions?: unknown }).litElementVersions !== undefined;
