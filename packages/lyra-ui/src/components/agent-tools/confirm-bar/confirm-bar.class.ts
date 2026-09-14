import { html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame, LyraVariant } from '../../../internal/variants.js';
import { hasRealContent, hostAriaLabel, nextId } from '../../../internal/a11y.js';
import {
  focusFirstAvailable,
  isComposedFocusAvailable,
  repairComposedFocus,
} from '../../../internal/focus-navigation.js';
import { devWarnOnce } from '../../../internal/dev-mode-attribute-warning.js';
import { markVetoGuardWrite, VetoWriteGuard } from '../../../internal/veto-write-guard.js';
import { resolveLocalizedParts } from '../../../internal/localization-runtime.js';
import '../../layout/details/details.class.js';
import '../../utility/json-viewer/json-viewer.class.js';
import '../../utility/live-region/live-region.class.js';
import '../../forms/button/button.class.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './confirm-bar.styles.js';
import {
  approvalAction,
  type ApprovalAction,
  type ApprovalDecision,
} from '../approval-state.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_approve, LYRA_DEFAULT_collapse, LYRA_DEFAULT_confirmApproved, LYRA_DEFAULT_confirmApprovedAnnounce, LYRA_DEFAULT_confirmDenied, LYRA_DEFAULT_confirmDeniedAnnounce, LYRA_DEFAULT_deny, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_map, LYRA_DEFAULT_navigation, LYRA_DEFAULT_open, LYRA_DEFAULT_popover, LYRA_DEFAULT_progress, LYRA_DEFAULT_restore, LYRA_DEFAULT_search, LYRA_DEFAULT_select, LYRA_DEFAULT_toolApprovalArgsLabel, LYRA_DEFAULT_toolApprovalGenericTool, LYRA_DEFAULT_toolApprovalHeading } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type ConfirmBarDecision = ApprovalDecision | null;

/** A genuine two-member subset of the shared `LyraVariant` vocabulary: a confirmation is either
 *  routine or destructive, and `brand`/`success`/`warning` have no meaning for a proposal awaiting
 *  a yes/no. Spelled as an `Extract` of the shared union rather than a re-declared literal pair so
 *  the two can never drift apart. */
export type ConfirmBarVariant = Extract<LyraVariant, 'neutral' | 'danger'>;

/**
 * Where the bar hands focus once a decision lands. An element, `null` for "no preference", or a
 * thunk resolved at that moment -- a host that swaps a focused control out for this bar often
 * re-creates that control on the way back, so the element it wants focus returned to does not
 * necessarily exist yet when the bar is mounted.
 */
export type ConfirmBarReturnFocusTarget = HTMLElement | null | (() => HTMLElement | null);

/**
 * The ExtendableEvent-style resolver carried by `lr-approve`/`lr-deny`'s detail. Calling it during
 * the dispatch holds the bar in its `pending` presentation until the promise settles: a resolution
 * finalizes the decision, a rejection restores the undecided state. Calling it more than once (from
 * one listener or several) waits for all of them.
 */
export type ConfirmBarWaitUntil = (promise: Promise<unknown>) => void;

export interface LyraConfirmBarEventMap {
  'lr-approve': CustomEvent<{ args: unknown; waitUntil: ConfirmBarWaitUntil }>;
  'lr-deny': CustomEvent<{ waitUntil: ConfirmBarWaitUntil }>;
  'lr-decision-settled': CustomEvent<{ decision: ApprovalDecision }>;
}

const ICON_VIEW_BOX = '0 0 24 24';
const ICON_STROKE_WIDTH = '1.75';

// Mirrors the shared icon set's viewBox/stroke conventions without adding approved/denied glyphs
// to that module, so these one-off icons still read as part of the same visual language as the
// rest of the library's inline icons.
function approvedIcon(): SVGTemplateResult {
  return svg`
    <svg width="1em" height="1em" viewBox=${ICON_VIEW_BOX} fill="none" stroke="currentColor" stroke-width=${ICON_STROKE_WIDTH} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9"></circle>
      <polyline points="8 12.5 11 15.5 16 9.5"></polyline>
    </svg>
  `;
}

function deniedIcon(): SVGTemplateResult {
  return svg`
    <svg width="1em" height="1em" viewBox=${ICON_VIEW_BOX} fill="none" stroke="currentColor" stroke-width=${ICON_STROKE_WIDTH} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9"></circle>
      <line x1="9" y1="9" x2="15" y2="15"></line>
      <line x1="15" y1="9" x2="9" y2="15"></line>
    </svg>
  `;
}

/**
 * `<lr-confirm-bar>` — an inline, non-modal approve/deny block for one proposed action: the
 * in-flow sibling of `<lr-tool-approval-dialog>` for confirmations that should sit in the
 * transcript instead of hijacking focus. Same `lr-approve`/`lr-deny` event shapes as the dialog,
 * and the same `toolApprovalHeading`/`toolApprovalArgsLabel`/`deny`/`approve` localization keys, so
 * the two always translate in lockstep.
 *
 * Non-modal by contract: no focus trap, no scroll lock, no Escape/backdrop semantics, and it never
 * steals focus when it appears in the transcript. DOM and tab order put Deny before Approve (the
 * dialog's safe-action-first rationale). On activation, focus moves synchronously to the first
 * available of `returnFocusTo` and `[part="status"]` (an always-rendered, `tabindex="-1"` element)
 * *before* the Deny/Approve buttons unmount, so focus never has a gap where it would otherwise fall
 * back to `<body>`. `returnFocusTo` is the opt-in half: unset, the handoff lands on `[part="status"]`
 * exactly as it always has, which keeps the decided status reachable but is a dead end for a host
 * that is about to unmount the bar. Set it to the control the bar replaced (or a thunk resolving to
 * it) and the same handoff returns focus there instead, falling back to `[part="status"]` whenever
 * the named element is missing, detached, `inert` or otherwise refuses focus -- an `inert` element
 * refuses `focus()` silently, so an unchecked handoff would strand the user on `<body>` at exactly
 * the moment a decision was announced.
 *
 * "Never steals focus" and "no Escape semantics" describe the bar's behavior when `autofocus` and
 * `escape-denies` are both left unset (the default). A host that swaps a focused control out for
 * this bar -- the case those two properties exist for -- can opt into either or both instead of
 * hand-rolling them: `autofocus` moves focus into the bar after its own first render (the Deny
 * control when it's present and enabled, matching the safe-action-first DOM order above, else the
 * always-present `[part="status"]`), and `escape-denies` maps Escape on `[part="base"]` to the same
 * outcome as clicking Deny. `<lr-memory-panel>` predates both and still implements this focus/Escape
 * handoff itself (`focusPendingConfirmation`/`onConfirmKeyDown`) rather than depending on them.
 * `escape-denies` is scoped to this element's own `[part="base"]`, never `document`: this bar is
 * inline and non-modal, not a member of the shared `activateOverlay()` Escape/stacking contract
 * (`src/internal/overlay-manager.ts`) that real overlays use, so it must not swallow Escape intended
 * for an unrelated enclosing dialog or popover. Neither property traps focus or locks scrolling.
 *
 * No argument editing (escalate to `<lr-tool-approval-dialog>`'s `editable` when edit-before-approve
 * matters); no blocking/modality guarantee (a user can scroll past); no decision persistence or
 * "remember choice" logic (the `footer` slot + host own that).
 *
 * Density and chrome are two knobs, not one: `compact` tightens the bar into a single dense inline
 * row and `frame="plain"` removes the card border/radius/background/padding, exactly as they do on
 * `<lr-agent-run>`, `<lr-commit-card>`, `<lr-result-card>`, `<lr-task-list>`, `<lr-terminal>` and
 * `<lr-thinking-panel>`. Before 9.0.0 `compact` alone did both; a bar that relied on that now
 * wants `compact frame="plain"`.
 *
 * Deny/Approve are `<lr-button>`s. Deny is `variant="neutral" appearance="outlined"` and Approve is
 * `variant="brand"` (`"danger"` under `variant="danger"`) at lr-button's default `appearance="accent"`,
 * so the destructive-or-primary action is the loud one and the safe action recedes. Both appearances
 * are stated rather than inherited: a bar whose look depends on another component's default changes
 * silently when that default does. Both are composed children rendered by this component, each
 * re-exporting `lr-button`'s own `base`/`label`/`start`/`end`/`spinner` parts under
 * `{deny,approve}-button-{base,label,start,end,spinner}` so `--lr-button-*` theming and a consumer's
 * existing `lr-button` style fragments reach them like every other button in an app.
 *
 * Async decisions have two entry points, and the declarative one is preferred. `lr-approve`/
 * `lr-deny`'s detail carries `waitUntil(promise)`, ExtendableEvent-style: calling it during the
 * dispatch puts the bar into `pending` (showing `loading` on the activated button and `disabled` on
 * the other) and the promise's settlement finalizes the decision or bounces it back for a retry, so
 * the component owns the whole state machine and no listener has to cast its `currentTarget`, write
 * `pending`, and remember to await `updateComplete` before unmounting. Several `waitUntil()` calls
 * from several listeners are awaited together. The imperative path it replaces still works and is
 * unchanged: `preventDefault()` alone sets `pending` to the action being persisted until the host
 * finalizes by setting `.decision` or bounces back by clearing `.pending` to `null`. A listener that
 * instead resolves the decision itself synchronously (setting `.decision` or `.pending` directly
 * during the dispatch) wins outright over both -- `decide()` only applies its own `pending`
 * bookkeeping, `waitUntil()`'s included, when the listener left both untouched, because `emit()` is
 * synchronous and a write that lands during it would otherwise be silently clobbered.
 *
 * `lr-decision-settled` fires after the decided status has rendered and been announced, on every
 * path that reaches a decision -- the bar's own, a `waitUntil()` settlement, and a host writing
 * `.decision` directly. It exists so a host can unmount the bar on that signal instead of guessing
 * whether the announcement has already happened.
 *
 * The host-writable `disabled` independently blocks both Deny and Approve and makes `decide()` a
 * no-op, without discarding any in-flight `decision`/`pending` state.
 *
 * @customElement lr-confirm-bar
 * @slot - Supplementary body content between the heading and the actions (e.g. a `lr-diff-view` of
 *   the proposed change).
 * @slot footer - Extra content at the start of the action row (e.g. a "remember this choice"
 *   checkbox), mirroring `lr-tool-approval-dialog`'s own `footer` slot.
 * @event lr-approve - `detail: { args, waitUntil }` — `args` is the `args` prop as-is (no editing in
 *   the bar), matching `lr-tool-approval-dialog`'s own `args` detail. Cancelable: a listener calling
 *   `preventDefault()` sets `pending` to `'approve'` instead of finalizing synchronously; set
 *   `.decision` (or clear `.pending` back to `null`) once your async work settles. `waitUntil(promise)`
 *   does the same thing declaratively and needs no `preventDefault()`: the bar stays pending until
 *   the promise settles, then finalizes on resolution or bounces back on rejection.
 * @event lr-deny - `detail: { waitUntil }`, the same resolver `lr-approve` carries and no other data,
 *   matching the dialog's detail-free `lr-deny`. Cancelable, same `pending` mechanism as `lr-approve`.
 * @event lr-decision-settled - `detail: { decision }`. Emitted after the decided `[part="status"]`
 *   has rendered and its live-region announcement has been made, on every path that reaches a
 *   decision, including a host writing `.decision` directly. Non-cancelable: the decision is already
 *   final. A host that replaces the bar with its own result UI can do it on this event without
 *   awaiting `updateComplete` itself.
 * @csspart base - The root (`role="group"`).
 * @csspart heading - The heading.
 * @csspart tool-name - The tool-name span within the heading. Only rendered when `heading` is unset.
 * @csspart body - The default-slot wrapper.
 * @csspart args - The `lr-details` + `lr-json-viewer` wrapper. Only rendered when `args` is
 *   defined.
 * @csspart footer - The action row.
 * @csspart deny-button - The built-in Deny `<lr-button>`. Named identically to the dialog's part.
 * @csspart deny-button-base - Forwarded from the internal Deny `<lr-button>`'s same-node `base`
 *   and `button` wrapper aliases.
 * @csspart deny-button-label - Forwarded from the internal Deny `<lr-button>`'s own `label` part.
 * @csspart deny-button-start - Forwarded from the internal Deny `<lr-button>`'s own `start` part.
 * @csspart deny-button-end - Forwarded from the internal Deny `<lr-button>`'s own `end` part.
 * @csspart deny-button-spinner - Forwarded from the internal Deny `<lr-button>`'s own `spinner`
 *   part, present only while `pending` is `'deny'`.
 * @csspart approve-button - The built-in Approve `<lr-button>`. Named identically to the dialog's
 *   part.
 * @csspart approve-button-base - Forwarded from the internal Approve `<lr-button>`'s same-node
 *   `base` and `button` wrapper aliases.
 * @csspart approve-button-label - Forwarded from the internal Approve `<lr-button>`'s own `label`
 *   part.
 * @csspart approve-button-start - Forwarded from the internal Approve `<lr-button>`'s own `start`
 *   part.
 * @csspart approve-button-end - Forwarded from the internal Approve `<lr-button>`'s own `end` part.
 * @csspart approve-button-spinner - Forwarded from the internal Approve `<lr-button>`'s own
 *   `spinner` part, present only while `pending` is `'approve'`.
 * @csspart status - The decided-state text. Always present in the DOM (`tabindex="-1"`) so focus has
 *   a stable, synchronous landing spot on activation.
 * @cssprop [--lr-confirm-bar-bg=var(--lr-color-surface)] - Resting background of `[part='base']`.
 * `frame="plain"` still paints transparent.
 * @cssprop [--lr-confirm-bar-compact-padding=var(--lr-space-s)] - Padding of `[part='base']` while
 * `compact`. Accepts any padding shorthand. Overridden entirely by `frame="plain"`.
 * @cssprop [--lr-confirm-bar-compact-gap=var(--lr-space-s)] - Gap between the row's items while
 * `compact`.
 * @cssprop [--lr-confirm-bar-approved-color=var(--lr-color-success)] - `[part='status']` text/icon
 * color once `decision` is `'approved'`.
 * @cssprop [--lr-confirm-bar-denied-color=var(--lr-color-danger)] - `[part='status']` text/icon
 * color once `decision` is `'denied'`.
 * @status stable
 * @since 4.0.0
 */
export class LyraConfirmBar extends LyraElement<LyraConfirmBarEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    approve: LYRA_DEFAULT_approve,
    collapse: LYRA_DEFAULT_collapse,
    confirmApproved: LYRA_DEFAULT_confirmApproved,
    confirmApprovedAnnounce: LYRA_DEFAULT_confirmApprovedAnnounce,
    confirmDenied: LYRA_DEFAULT_confirmDenied,
    confirmDeniedAnnounce: LYRA_DEFAULT_confirmDeniedAnnounce,
    deny: LYRA_DEFAULT_deny,
    details: LYRA_DEFAULT_details,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    map: LYRA_DEFAULT_map,
    navigation: LYRA_DEFAULT_navigation,
    open: LYRA_DEFAULT_open,
    popover: LYRA_DEFAULT_popover,
    progress: LYRA_DEFAULT_progress,
    restore: LYRA_DEFAULT_restore,
    search: LYRA_DEFAULT_search,
    select: LYRA_DEFAULT_select,
    toolApprovalArgsLabel: LYRA_DEFAULT_toolApprovalArgsLabel,
    toolApprovalGenericTool: LYRA_DEFAULT_toolApprovalGenericTool,
    toolApprovalHeading: LYRA_DEFAULT_toolApprovalHeading,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Drives the default heading through the existing dialog keys. */
  @property({ attribute: 'tool-name' }) toolName = '';

  /** Free-form heading override for non-tool proposals. Wins over `toolName` when set. */
  @property() heading = '';

  /** Shown read-only inside a collapsed `lr-details` + `lr-json-viewer` when defined. */
  @property({ attribute: false }) args: unknown = undefined;

  // `decision`/`pending` are accessor-backed rather than plain fields so `decide()` can tell "a
  // synchronous listener wrote here" apart from "nothing wrote here" -- see `dispatchWriteGuard`
  // below. Comparing before/after *values* cannot make that distinction: the guard in `decide()`
  // only reaches its check once both are already `null`, so a listener that writes `pending = null`
  // right back (bouncing out to an out-of-band resolution) is value-identical to a listener that
  // touched nothing at all.
  private _decision: ConfirmBarDecision = null;
  private _pending: ApprovalAction | null = null;

  /** Marked on every write to `decision`/`pending`, from any source. `decide()` opens it
   *  immediately before dispatching `lr-approve`/`lr-deny` and reads it back afterward: since the
   *  dispatch is synchronous, only a listener invoked during that same `emit()` call can have
   *  marked it in between. */
  private readonly dispatchWriteGuard = new VetoWriteGuard();

  /** Decided state. Set by the component on activation *and* host-writable (an externally-resolved
   *  decision -- timeout, another reviewer -- renders identically and emits no `lr-approve`/`lr-deny`
   *  of its own; the settled notification still fires, because the status really did render). */
  @property({ reflect: true })
  get decision(): ConfirmBarDecision { return this._decision; }
  set decision(value: ConfirmBarDecision) {
    const previous = this._decision;
    this._decision = value;
    markVetoGuardWrite(this.dispatchWriteGuard);
    this.requestUpdate('decision', previous);
  }

  /** Which action is awaiting host resolution, while an lr-approve/lr-deny listener has called
   *  preventDefault(). Host-writable: set back to null to bounce back to the undecided state (e.g.
   *  on failure, so the user can retry), or set `decision` to finalize. */
  @property({ reflect: true })
  get pending(): ApprovalAction | null { return this._pending; }
  set pending(value: ApprovalAction | null) {
    const previous = this._pending;
    this._pending = value;
    markVetoGuardWrite(this.dispatchWriteGuard);
    this.requestUpdate('pending', previous);
  }

  /** Disables both Deny and Approve and makes `decide()` a no-op, without discarding any
   *  in-flight `decision`/`pending` state. Distinct from `pending`: `pending` marks one specific
   *  action as awaiting the host while the other stays interactive, while `disabled` blocks both
   *  regardless of `pending`. Reflects as an attribute. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Token-mapped emphasis for destructive proposals. */
  @property({ reflect: true }) variant: ConfirmBarVariant = 'neutral';

  /** Collapses the bar from a stacked `display: block` card to a single tightly-padded inline row,
   *  for a confirmation that has to live inside an existing container -- a table cell, a card's
   *  action row, a toolbar. The host becomes `inline-flex`, and the narrow-allocation `@container`
   *  treatment is switched off (a compact bar is *expected* to be narrow, so stretching the buttons
   *  to fill would be exactly wrong). Purely a density/layout knob -- same convention as
   *  `<lr-agent-run>`'s `compact`: the border, corner radius and background stay, so use
   *  `frame="plain"` to drop the chrome. Retune the density through
   *  `--lr-confirm-bar-compact-padding`/`-gap`. Everything else -- the event shapes, the
   *  focus-to-`[part='status']`-before-unmount contract, `role="group"` and its heading label --
   *  is unchanged. */
  @property({ type: Boolean, reflect: true }) compact = false;

  /** Visual chrome, in the library's shared container-frame vocabulary. `'card'` (the default)
   *  keeps the bordered, filled, padded box. `'plain'` removes the border, background, padding and
   *  corner radius, so a bar nested inside a host container that already draws a border (a table
   *  cell, an `<lr-result-card>` action row) doesn't double it. `plain` wins over `compact` when
   *  both are set -- there is no padding left to tighten. The Deny/Approve `<lr-button>`s keep
   *  their own border/background either way, so a chrome-less bar still has a visible interactive
   *  affordance. */
  @property({ reflect: true }) frame: LyraFrame = 'card';

  /** Opt-in focus-on-mount: moves focus into the bar after its own first render, once this
   *  element and (when present) the Deny `<lr-button>` have both completed it. Named after the
   *  native global attribute it stands in for -- the platform's own `autofocus` algorithm only
   *  fires for an element already in the document when it finishes parsing, never for one a host
   *  swaps in afterward (this bar's primary use, per the class doc), so this implements the same
   *  intent explicitly instead. Defaults to `false`: nothing here steals focus from a host that
   *  doesn't ask for it. */
  @property({ type: Boolean, reflect: true }) override autofocus = false;

  /** Opt-in: maps Escape on `[part="base"]` to the same outcome as clicking Deny. See the class
   *  doc for why this is scoped to this element's own base rather than `document`. A no-op while
   *  `disabled`, already decided, or `pending`, exactly like clicking Deny itself. Defaults to
   *  `false` -- an unlabelled Escape denying a proposal is a real behavior change a host must
   *  choose explicitly. */
  @property({ type: Boolean, reflect: true, attribute: 'escape-denies' }) escapeDenies = false;

  /** Where focus goes once a decision lands, instead of parking on `[part="status"]`. Property-only
   *  (an element reference has no attribute form), and a thunk is accepted so the lookup happens at
   *  handoff time rather than at assignment time. The motivating case is the one the class doc
   *  opens with: a host swaps a focused control out for this bar, and once the decision is made
   *  focus belongs back on that control (or on whatever replaced it), not on a status line the host
   *  is about to unmount. Unset (`null`) keeps the shipped behavior exactly. A named target that is
   *  missing, detached, `inert` or otherwise refuses focus falls back to `[part="status"]` rather
   *  than to `<body>`. */
  @property({ attribute: false }) returnFocusTo: ConfirmBarReturnFocusTarget = null;

  @query('[part="status"]') private statusEl?: HTMLElement;
  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  // `[part='body']:empty` never matches because the part always contains a literal `<slot>`
  // child (CSS `:empty` only ignores text/comment nodes) -- same fix `lr-details`/`lr-empty`/
  // `lr-avatar`/`lr-stat` already established. Track real slot assignment in JS instead.
  @state() private hasBodySlot = false;

  private readonly headingId = nextId('confirm-bar-heading');

  /** Bumped by every `decide()` that starts awaiting a `waitUntil()` promise, so a settlement that
   *  arrives after a newer decision began (a bounce, then a second activation) is discarded instead
   *  of resolving the wrong one. */
  private deferralGeneration = 0;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      const defaultSlotNodes = Array.from(this.childNodes).filter(
        (node) => node.nodeType !== Node.ELEMENT_NODE || !(node as Element).getAttribute('slot'),
      );
      this.hasBodySlot = hasRealContent(defaultSlotNodes);
    }
    if (
      changed.has('decision') &&
      changed.get('decision') !== undefined &&
      this.decision != null &&
      this.pending != null
    ) {
      this.handOffDecidedFocus();
      this.pending = null;
    }
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    if (this.autofocus) this.focusInitial();
  }

  private onBodySlotChange = (e: Event): void => {
    this.hasBodySlot = hasRealContent(
      (e.target as HTMLSlotElement).assignedNodes({ flatten: true }),
    );
  };

  /**
   * `autofocus`'s implementation: the Deny control when it's present and actually focusable, else
   * `[part="status"]` -- the same fallback `decide()` itself already leans on when Deny is
   * unavailable. Awaits this element's own first update (already true by the time `firstUpdated()`
   * calls this, but `updateComplete` also resolves once any update it scheduled settles) and, when
   * a Deny `<lr-button>` exists, its own first update too: whenever a host mounts this bar in place
   * of a control it just removed (the motivating case in the class doc), that button is brand new
   * and has not necessarily rendered its own focusable internals yet.
   */
  private focusInitial(): void {
    void this.updateComplete.then(async () => {
      if (!this.isConnected) return;
      const deny = this.renderRoot.querySelector<HTMLElement & { updateComplete?: Promise<unknown> }>(
        '[part="deny-button"]',
      );
      await deny?.updateComplete;
      if (!this.isConnected) return;
      const target = deny && isComposedFocusAvailable(deny) ? deny : this.statusEl;
      target?.focus();
    });
  }

  /** `escape-denies`'s implementation, bound to `[part="base"]` -- see the class doc for why this
   *  is not routed through `activateOverlay()`. Stops propagation only when Escape actually denied
   *  something (mirroring `<lr-memory-panel>`'s own `onConfirmKeyDown`): `decide()` is a no-op
   *  while `disabled`, already decided, or `pending`, and swallowing Escape in that case would
   *  refuse to close an unrelated enclosing dialog for no reason. */
  private onBaseKeyDown = (event: KeyboardEvent): void => {
    if (!this.escapeDenies || event.key !== 'Escape') return;
    const decisionBefore = this.decision;
    const pendingBefore = this.pending;
    this.decide('denied');
    if (this.decision !== decisionBefore || this.pending !== pendingBefore) {
      event.stopPropagation();
    }
  };

  private decide(next: 'approved' | 'denied'): void {
    if (this.disabled || this.decision != null || this.pending != null) return;
    // ExtendableEvent's own rule, for the same reason: `waitUntil()` extends *this dispatch*, so it
    // is only meaningful while listeners are running. A reference captured and called later cannot
    // retroactively reopen a decision that already finalized, and silently pretending otherwise
    // would leave a bar stuck pending with nothing watching the promise.
    const deferrals: Promise<unknown>[] = [];
    let dispatching = true;
    const waitUntil: ConfirmBarWaitUntil = (promise) => {
      if (!dispatching) {
        devWarnOnce(
          'lyra-confirm-bar-wait-until-after-dispatch',
          '<lr-confirm-bar>: waitUntil() was called after its lr-approve/lr-deny dispatch had ' +
            'finished, so it did nothing. Call it synchronously from the listener; the promise it ' +
            'receives may settle whenever it likes.',
        );
        return;
      }
      // Promise.resolve() rather than the argument as-is: a plain JS caller can hand over a
      // thenable, or nothing at all, and neither may throw inside the component's own dispatch.
      deferrals.push(Promise.resolve(promise));
    };
    // The guard above proves both are null right up to this point -- but `emit()` below dispatches
    // synchronously, so a listener can still write either one from inside it (e.g. it calls
    // preventDefault() and resolves the decision itself out of band, or bounces `pending` back to
    // null immediately). A before/after *value* comparison can't detect that last case -- both are
    // already null, so a listener writing `pending = null` reads identically to a listener that
    // touched nothing. `dispatchWriteGuard` tracks the write itself, not its value: opened here,
    // then marked by the `decision`/`pending` setters if a listener assigns either one during the
    // synchronous `emit()` below. Only when it stays untouched did the listener leave both alone,
    // and the built-in "awaiting the host" pending state applies; otherwise it would silently
    // clobber whatever the listener just did. `waitUntil()` composes with that rule rather than
    // bypassing it: a listener that both defers and resolves the state itself has resolved it, and
    // the promise is then nobody's business but its own.
    this.dispatchWriteGuard.open();
    const event =
      next === 'approved'
        ? this.emit('lr-approve', { args: this.args, waitUntil }, { cancelable: true })
        : this.emit('lr-deny', { waitUntil }, { cancelable: true });
    dispatching = false;
    const listenerResolvedItself = this.dispatchWriteGuard.touched;
    // `waitUntil()` is a veto in its own right -- it says "not yet" as plainly as preventDefault()
    // does -- so it takes the same branch without the listener having to call both.
    if (deferrals.length > 0 || event.defaultPrevented) {
      // Same handoff as the synchronous path below, and for the same reason: `?loading` on the
      // just-activated button makes `lr-button`'s internal native `<button>` genuinely `disabled`,
      // and a browser blurs a focused element the instant it becomes disabled. Without moving
      // focus first, a keyboard user who activated Approve/Deny would be silently dropped to
      // <body> for the whole duration of the host's async work. Ordered before the `pending` write
      // so the button is still focusable when focus leaves it. `[part="status"]` and not
      // `returnFocusTo`: the decision is not settled yet, so this is not the return journey.
      this.statusEl?.focus();
      if (listenerResolvedItself) {
        // The listener resolved the decision itself, so its own promises are nobody's business but
        // its own -- but the bar did accept them, and an accepted promise with nothing attached
        // surfaces its rejection as an unhandled rejection in the host page. Absorb them rather
        // than acting on them: this branch deliberately applies no bookkeeping.
        for (const deferral of deferrals) void deferral.catch(() => undefined);
        return;
      }
      this.pending = approvalAction(next);
      if (deferrals.length > 0) this.awaitDeferredDecision(Promise.all(deferrals), next);
      return;
    }
    // Synchronous, before the property set below triggers the re-render that removes the
    // Deny/Approve buttons -- [part="status"] is always present in the DOM, so this never leaves a
    // gap where focus would otherwise fall back to <body>. Only reached on the synchronous
    // (non-pending) path -- an externally-set `decision` already skips this too, unchanged.
    this.handOffDecidedFocus();
    this.decision = next;
  }

  /**
   * The settlement half of `waitUntil()`. Every write it performs is re-checked against the state
   * it left behind rather than applied blind: the promise settles in a later task, and by then the
   * host may have finalized the decision out of band, bounced `pending` itself, or started a whole
   * new decision. `generation` covers that last case, which the property checks alone cannot -- a
   * second pending decision for the same action is state-identical to the first.
   */
  private awaitDeferredDecision(promise: Promise<unknown>, next: 'approved' | 'denied'): void {
    const action = approvalAction(next);
    this.deferralGeneration += 1;
    const generation = this.deferralGeneration;
    const stillOurs = (): boolean =>
      generation === this.deferralGeneration && this.decision == null && this.pending === action;
    void promise.then(
      () => {
        // `willUpdate()` owns the rest: it clears `pending` and performs the decided-state focus
        // handoff for every externally-finalized decision, this one included.
        if (stillOurs()) this.decision = next;
      },
      () => {
        if (!stillOurs()) return;
        this.pending = null;
        this.returnFocusAfterBounce(action);
      },
    );
  }

  /**
   * A rejection restores the bar, and focus is part of it: the handoff into the pending state
   * parked focus on `[part="status"]` because the activated button was about to become `disabled`,
   * so leaving it there would hand a retryable bar back to a keyboard user with focus on a static
   * line of text. `repairComposedFocus()` rather than an unconditional move: if focus has since
   * gone somewhere else entirely, it belongs to whatever the user is doing now. The button is only
   * focusable again once `loading`/`disabled` have actually come off it, hence the awaited update.
   */
  private returnFocusAfterBounce(action: ApprovalAction): void {
    void this.updateComplete.then(() => {
      if (!this.isConnected || this.decision != null || this.pending != null) return;
      repairComposedFocus(this, () =>
        this.renderRoot.querySelector<HTMLElement>(`[part="${action}-button"]`),
      );
    });
  }

  /** Resolves `returnFocusTo`, which may be a thunk, at the moment focus is actually handed over. */
  private resolvedReturnFocusTarget(): HTMLElement | null {
    const target = this.returnFocusTo;
    return typeof target === 'function' ? target() : target;
  }

  /**
   * The terminal focus handoff: the host's named return target when it names one that can really
   * take focus, else the always-present `[part="status"]`. Unconditional, exactly as the
   * `[part="status"]` move it replaces always was -- the control the user just activated is about
   * to unmount, so the handoff cannot wait to be sure that control held focus.
   */
  private handOffDecidedFocus(): void {
    focusFirstAvailable([this.resolvedReturnFocusTarget(), this.statusEl]);
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    const decision = this.decision;
    if (changed.has('decision') && changed.get('decision') !== undefined && decision != null) {
      const key = decision === 'approved' ? 'confirmApprovedAnnounce' : 'confirmDeniedAnnounce';
      this.liveRegion?.announce(this.localize(key), { force: true });
      // Ordered after the announcement, and in `updated()` so the decided `[part="status"]` is
      // already in the DOM: the whole point is that a host can unmount the bar on this signal
      // without first having to know that both of those already happened. The same
      // `changed.get('decision') !== undefined` guard the announcement uses keeps a decision
      // supplied in the initial markup silent -- nothing settled, it simply started decided.
      this.emit('lr-decision-settled', { decision });
    }
  }

  private renderHeading(): TemplateResult {
    if (this.heading) return html`${this.heading}`;
    const toolName = this.toolName || this.localize('toolApprovalGenericTool');
    const template = this.localize('toolApprovalHeading');
    const pieces = resolveLocalizedParts(template, (marker) =>
      this.localize('toolApprovalHeading', undefined, { tool: marker }),
    );
    return html`${pieces.map((piece, index) =>
      index < pieces.length - 1
        ? html`${piece}<span part="tool-name">${toolName}</span>`
        : piece,
    )}`;
  }

  private statusText(): string {
    return this.decision === 'approved' ? this.localize('confirmApproved') : this.localize('confirmDenied');
  }

  private stopNestedLifecycle(event: Event): void {
    event.stopPropagation();
  }

  override render(): TemplateResult {
    const decided = this.decision != null;
    const hostLabel = hostAriaLabel(this);
    return html`
      <div
        part="base"
        role="group"
        aria-label=${hostLabel ?? nothing}
        aria-labelledby=${hostLabel === null ? this.headingId : nothing}
        @keydown=${this.onBaseKeyDown}
      >
        <div part="heading" id=${this.headingId}>${this.renderHeading()}</div>
        <div part="body" ?hidden=${!this.hasBodySlot}><slot @slotchange=${this.onBodySlotChange}></slot></div>
        ${this.args !== undefined
          ? html`<lr-details part="args" summary=${this.localize('toolApprovalArgsLabel')}
              @lr-toggle=${this.stopNestedLifecycle}
              @lr-show=${this.stopNestedLifecycle}
              @lr-after-show=${this.stopNestedLifecycle}
              @lr-hide=${this.stopNestedLifecycle}
              @lr-after-hide=${this.stopNestedLifecycle}>
              <lr-json-viewer
                .data=${this.args}
                @lr-copy=${this.stopNestedLifecycle}
                @lr-error=${this.stopNestedLifecycle}
                @lr-copy-error=${this.stopNestedLifecycle}
                @lr-search-change=${this.stopNestedLifecycle}
              ></lr-json-viewer>
            </lr-details>`
          : nothing}
        <div part="footer">
          <slot name="footer"></slot>
          ${decided
            ? nothing
            : html`
                <lr-button
                  part="deny-button"
                  variant="neutral"
                  appearance="outlined"
                  type="button"
                  ?loading=${this.pending === 'deny'}
                  ?disabled=${this.disabled || this.pending === 'approve'}
                  exportparts="base:deny-button-base, button:deny-button-base, label:deny-button-label, start:deny-button-start, end:deny-button-end, spinner:deny-button-spinner"
                  @click=${() => this.decide('denied')}
                >${this.localize('deny')}</lr-button>
                <lr-button
                  part="approve-button"
                  variant=${this.variant === 'danger' ? 'danger' : 'brand'}
                  type="button"
                  ?loading=${this.pending === 'approve'}
                  ?disabled=${this.disabled || this.pending === 'deny'}
                  exportparts="base:approve-button-base, button:approve-button-base, label:approve-button-label, start:approve-button-start, end:approve-button-end, spinner:approve-button-spinner"
                  @click=${() => this.decide('approved')}
                >${this.localize('approve')}</lr-button>
              `}
        </div>
        <div part="status" tabindex="-1">
          ${decided
            ? html`${this.decision === 'approved' ? approvedIcon() : deniedIcon()}<span>${this.statusText()}</span>`
            : nothing}
        </div>
        <lr-live-region mode="polite"></lr-live-region>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-confirm-bar': LyraConfirmBar;
  }
}
