// This entry must be evaluated before any module that imports `lit`. It is intentionally kept
// separate from registrations and diagnostics so an application can install Lit hydration once,
// then import only the component registrations it actually uses.
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';

export {};
