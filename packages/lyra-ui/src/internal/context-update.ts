/** The `changedProperties` key of a library-driven render: a host `aria-label`/`aria-describedby`/
 *  `lang`/`dir` change, an inherited locale or direction change, a slot-presence change or the
 *  post-hydration correction. Keeping these named leaves the argument-less `requestUpdate()` as
 *  the consumer's explicit refresh, which provider-backed components answer with a new request. */
export const LYRA_CONTEXT_UPDATE = 'lyraContextUpdate';

/** Differs from the never-assigned `host[LYRA_CONTEXT_UPDATE]`, so Lit's default change check
 *  schedules the render even through an override that forwards only `(name, oldValue)`. */
const CONTEXT_CHANGED = Object.freeze({});

type NamedUpdateHost = { requestUpdate(name?: PropertyKey, oldValue?: unknown): unknown };

/** Schedules a render for a library-internal reason without signalling an explicit refresh. */
export function requestContextUpdate(host: { requestUpdate(): unknown }): void {
  (host as NamedUpdateHost).requestUpdate(LYRA_CONTEXT_UPDATE, CONTEXT_CHANGED);
}
