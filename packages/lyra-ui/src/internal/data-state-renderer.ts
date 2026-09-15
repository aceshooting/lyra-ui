import { html, nothing } from 'lit';
import { assertPartPrefix } from './data-state-renderer.styles.js';
import type { LyraHeadingLevel } from './heading-level.js';
import type { LyraElement } from './lyra-element.js';
import { requestThenCommit } from './request-commit.js';

/**
 * The single tier of the shared loading/error/empty ladder that currently applies, or `null` when
 * the host has real content to show.
 *
 * The order is fixed library-wide and is not a per-component decision: `loading` beats `error`
 * beats `empty`. It exists because the three states overlap constantly in real hosts — the load
 * that would have supplied the rows is the one that rejected, so `rows` is *also* still empty —
 * and every component that grew its own ladder picked a slightly different resolution. A loading
 * host must never flash a stale failure, and a failed host must never fall through to "no results"
 * copy that hides the retry affordance underneath it.
 */
export type LyraDataStatePrecedence = 'loading' | 'error' | 'empty';

/**
 * Which part name each tier's built-in markup publishes.
 *
 * A bare string is used verbatim for whichever tier wins, for a host that renders each tier in a
 * different DOM position and therefore calls {@link renderDataState} once per position (this is
 * `lr-table`'s shape: the loading spinner replaces the whole component, the failure row lives
 * inside `<tbody>`, and the empty state replaces the `<table>`). A record names each tier
 * separately for the commoner host that renders all three in one position and calls the renderer
 * once. A tier the record omits — and the record `{}` — falls back to the tier's own name, which
 * is the library convention this module documents.
 */
export type LyraDataStatePartPrefix =
  | string
  | Partial<Record<LyraDataStatePrecedence, string>>;

/** The per-tier content a host substitutes for the built-in copy. */
interface DataStateSlots {
  loading?: unknown;
  error?: unknown;
  empty?: unknown;
}

export interface DataStateConfig {
  loading: boolean;
  error: boolean;
  /** True when there is no data to show, independent of loading/error. */
  empty: boolean;
  /**
   * Loading copy override. Omitted (or `undefined`) localizes `loading`; any supplied string,
   * including an empty one, renders verbatim. A host with its own more specific catalog key
   * (`lr-table` localizes `tableLoading`) resolves that key itself and passes the result here, so
   * adopting this renderer never changes a component's shipped copy.
   */
  loadingLabel?: string;
  /** Failed-load heading override. Omitted localizes `tableLoadFailed`. */
  errorHeading?: string;
  /** Failed-load supporting copy. Caller-supplied content, never localized here. */
  errorDescription?: string;
  /** No-data heading override. Omitted localizes `noData`. */
  emptyHeading?: string;
  /** No-data supporting copy. Caller-supplied content, never localized here. */
  emptyDescription?: string;
  /** The built-in state's `compact` rendering. The host resolves its own per-position default. */
  compact?: boolean;
  /**
   * Semantic level of the built-in heading, forwarded to `<lr-empty heading-level>`.
   *
   * Omitted, the error and empty tiers keep `lr-empty`'s own level-3 default — the level
   * `lr-table`'s shipped states already render — while the LOADING tier renders `none`. A transient
   * busy state is not a section of the host's document outline, and it is routinely rendered
   * somewhere a heading is actively wrong: inside the `<td>` of a grid's state row, or inside a
   * `listbox` whose only permitted children are options. Pass `none` explicitly when the host
   * renders its settled states in such a position too.
   */
  headingLevel?: LyraHeadingLevel;
  /** Renders instead of the built-in copy for the given branch. */
  slots?: DataStateSlots;
  /**
   * The retry event's default action, run only when no listener called `preventDefault()`. The
   * helper deliberately does not know which property to clear — `lr-table` clears its own `error`,
   * `lr-combobox` re-runs `refresh()` — so the host passes its own closure.
   */
  onRetry?: () => void;
  /**
   * Optional dispatch adapter, used in place of the `retryEventName` argument when supplied. Write
   * it in exactly this shape, `init` annotation included:
   *
   * ```ts
   * emitRetry: (detail, init: { cancelable: true }) => this.emit('lr-retry', detail, init),
   * ```
   *
   * Worth the second spelling because the literal `this.emit('<name>', ...)` then stays inside the
   * host class, where the event's name and cancelability remain statically resolvable to the
   * contract checks that read them out of a component's own call sites — the same reason
   * `requestThenCommit()` takes an adapter rather than a host and a name. The inline `init`
   * annotation is load-bearing for the same checks and is not made redundant by the contextual
   * type this interface already supplies; `RequestCommitOptions.emitRequest` states why in full.
   */
  emitRetry?: (detail: null, init: { cancelable: true }) => CustomEvent;
  /**
   * Overrides the name of the `<slot>` a branch is wrapped in. Each branch defaults to its own
   * name (`loading`/`error`/`empty`), which is the library convention and what `lr-table` ships.
   *
   * It exists because `error` is ALSO the shared form-control slot name: every form-associated
   * control in this library already publishes `<slot name="error">` for its validation message. A
   * form control adopting this ladder -- `lr-combobox` is the first -- would render a second
   * `slot[name="error"]`, and slot assignment goes to the FIRST such slot in tree order, so the
   * data-state slot would silently swallow the field's own error content. Renaming that one branch
   * (`{ error: 'source-error' }`) is the only way to publish both, and it has to be the adopting
   * component's decision because the name becomes its permanent public API.
   */
  slotNames?: Partial<Record<LyraDataStatePrecedence, string>>;
}

/**
 * The host, as this module needs to name it.
 *
 * `LyraElement<any>`, not the generic-defaulted `LyraElement`: a component calls this from inside
 * its own class body, where `this` is `LyraElement<Events>` for whatever event map that component
 * declares — and that is NOT assignable to a fixed `LyraElement<LyraEventMap>` parameter, because
 * `emit()`'s event-name parameter is contravariant in the map. `lyra-element.ts` names its own
 * host-hook parameters the same way and for the same reason.
 */
type DataStateHost = LyraElement<any>;

/**
 * `LyraElement.localize()` and `LyraElement.emit()` are `protected`, which a public structural
 * parameter type cannot express (TypeScript rejects a protected member as an implementation of a
 * public one). The host is therefore narrowed here, once, rather than at every call site. Written
 * as a member call so the default-string tooling still sees the literal keys below: both
 * `check-default-strings.mjs` and the per-component slice generator collect `<expr>.localize('k')`
 * across a component's whole authored import graph, so a component adopting this renderer picks up
 * `tableLoadFailed`/`retry`/`noData`/`loading` in its generated English slice automatically.
 */
interface DataStateHostApi {
  localize(
    key: string,
    fallback?: string,
    values?: Record<string, string | number>
  ): string;
  emit(
    name: string,
    detail: unknown,
    options?: { cancelable?: boolean }
  ): CustomEvent;
}

const hostApi = (host: DataStateHost): DataStateHostApi =>
  host as unknown as DataStateHostApi;

/**
 * Resolves which single branch currently applies — the ONE precedence rule.
 *
 * Pure: it reads nothing but the config, so a host can call it to decide *where* to render (a
 * full-component replacement versus a single row) before calling {@link renderDataState}.
 */
export function resolveDataState(
  config: DataStateConfig
): LyraDataStatePrecedence | null {
  if (config.loading) return 'loading';
  if (config.error) return 'error';
  if (config.empty) return 'empty';
  return null;
}

/**
 * The `aria-busy` value the host binds on its OWN container while the ladder is resolving:
 * `aria-busy=${dataStateAriaBusy(config)}` on `part="base"`, the spelling `lr-table` and every
 * component in the viewers family already ship.
 *
 * Returns a string, never a boolean, because a stateful ARIA attribute renders both `'true'` and
 * `'false'`: a `?aria-busy=` directive removes the attribute on settle, which reads as "unknown"
 * rather than "finished".
 *
 * {@link renderDataState} cannot write it itself. `aria-busy` belongs on the element that owns the
 * region the assistive technology is waiting on, which is the host's own container — outside the
 * fragment this module returns — and setting a host attribute from inside a render function would
 * fight the host's own bindings on the next update.
 */
export function dataStateAriaBusy(config: DataStateConfig): 'true' | 'false' {
  return config.loading ? 'true' : 'false';
}

function prefixFor(
  partPrefix: LyraDataStatePartPrefix,
  branch: LyraDataStatePrecedence
): string {
  const named =
    typeof partPrefix === 'string' ? partPrefix : partPrefix[branch];
  const trimmed = (named ?? '').trim();
  const prefix = trimmed === '' ? branch : trimmed;
  // Same validation, same rejects, as the stylesheet partial that paints the part this names.
  assertPartPrefix(prefix, 'renderDataState');
  return prefix;
}

/**
 * The `exportparts` mapping every adopting host publishes, in `lr-table`'s shipped order and
 * spelling. Forwarding is mandatory rather than on-demand here: `::part()` pierces exactly one
 * shadow boundary, so without it the composed `<lr-empty>`'s heading, description and icon are
 * unreachable from the host's own consumers, and the state a host renders *is* the primary surface
 * its consumers style.
 */
function exportPartsFor(prefix: string): string {
  return [
    `base:${prefix}-base`,
    `icon:${prefix}-icon`,
    `heading:${prefix}-heading`,
    `description:${prefix}-description`,
    `actions:${prefix}-actions`,
  ].join(', ');
}

/**
 * Renders the resolved branch's `<lr-empty>`-based markup with the host's own part prefix, wrapped
 * in a named slot so a consumer can replace that one branch wholesale, and wires a cancelable
 * `retryEventName` on the built-in retry action through `requestThenCommit()` — so the retry veto
 * behaves exactly like every other request/commit pair in the library.
 *
 * Returns Lit's `nothing` when no branch applies, so a host can interpolate the call
 * unconditionally.
 *
 * The slot name is the branch name (`loading`/`error`/`empty`) — the names `lr-table` already
 * ships. A `config.slots` entry replaces that branch's built-in copy *inside* its own slot and
 * touches no sibling branch: overriding the failure copy must not also silence the no-data copy
 * that renders once the retry succeeds.
 *
 * The host's registration entry must register `lr-empty`
 * (`import '<...>/components/overlays/empty/empty.js'`), the same way `lr-table`'s already does;
 * `check-component-dependencies.mjs` attributes this module's rendered tag to every entry whose
 * class module reaches it.
 *
 * ## The loading tier is NOT self-announcing — two things the host still owns
 *
 * All three tiers render the same `<lr-empty>` shape, so the error and empty tiers reproduce
 * `lr-table`'s shipped state markup value for value. The loading tier deliberately does not:
 * `lr-table` replaces its whole component with an `aria-busy` container wrapping an `lr-spinner`,
 * which is a host-level layout decision, not a tier. What this renderer emits for `loading` is
 * heading text with `heading-level="none"` — visible, but silent to assistive technology on its
 * own. Neither missing piece can be supplied from inside a render function, so an adopting host
 * must:
 *
 * - bind {@link dataStateAriaBusy} on its own container — the attribute belongs on the element
 *   that owns the waited-on region, which is outside the fragment returned here; and
 * - announce the transition from its own `updated()` through `acquireAnnouncementSink()`, the way
 *   `lr-table` announces its loading copy when `loading` turns on. A live region may not live in a
 *   shadow root, and a render function has no lifecycle hook on which to acquire and release the
 *   sink, so this module deliberately does neither.
 *
 * A host that wants a spinner rather than heading text passes one as `slots.loading`; that is the
 * supported route back to `lr-table`'s current loading appearance.
 */
export function renderDataState(
  host: DataStateHost,
  config: DataStateConfig,
  partPrefix: LyraDataStatePartPrefix,
  retryEventName: string
): unknown {
  const branch = resolveDataState(config);
  if (branch === null) return nothing;
  const override = config.slots?.[branch];
  const slotName = config.slotNames?.[branch] ?? branch;
  return html`<slot name=${slotName}
    >${override === undefined
      ? builtInState(host, config, prefixFor(partPrefix, branch), retryEventName, branch)
      : override}</slot
  >`;
}

function builtInState(
  host: DataStateHost,
  config: DataStateConfig,
  prefix: string,
  retryEventName: string,
  branch: LyraDataStatePrecedence
): unknown {
  const api = hostApi(host);
  const compact = config.compact ?? false;
  const exportParts = exportPartsFor(prefix);
  // A settled state is a section of the host's outline and keeps lr-empty's level-3 default; a
  // transient busy state is not one, and the loading tier therefore opts out unless the host says
  // otherwise. See DataStateConfig.headingLevel.
  const headingLevel =
    config.headingLevel ?? (branch === 'loading' ? 'none' : '3');
  if (branch === 'loading') {
    return html`<lr-empty
      part=${prefix}
      exportparts=${exportParts}
      ?compact=${compact}
      heading-level=${headingLevel}
      heading=${config.loadingLabel ?? api.localize('loading')}
      description=""
    ></lr-empty>`;
  }
  if (branch === 'empty') {
    return html`<lr-empty
      part=${prefix}
      exportparts=${exportParts}
      ?compact=${compact}
      heading-level=${headingLevel}
      heading=${config.emptyHeading ?? api.localize('noData')}
      description=${config.emptyDescription ?? ''}
    ></lr-empty>`;
  }
  // Propose, then commit, through the library's one request/commit helper: the event is the veto
  // point, and the host-supplied default action runs only when nobody prevented it. A listener that
  // wants to keep the failure visible until it has confirmed a fresh load actually started calls
  // preventDefault().
  const onRetry = (): void => {
    requestThenCommit<null, CustomEvent>({
      requestDetail: null,
      emitRequest:
        config.emitRetry ??
        ((detail: null, init: { cancelable: true }) =>
          api.emit(retryEventName, detail, init)),
      commit: () => config.onRetry?.(),
    });
  };
  return html`<lr-empty
    part=${prefix}
    exportparts=${exportParts}
    ?compact=${compact}
    heading-level=${headingLevel}
    heading=${config.errorHeading ?? api.localize('tableLoadFailed')}
    description=${config.errorDescription ?? ''}
  >
    <button type="button" slot="actions" part="retry-button" @click=${onRetry}>
      ${api.localize('retry')}
    </button>
  </lr-empty>`;
}
