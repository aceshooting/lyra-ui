import { html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraFrame, LyraVariant } from '../../../internal/variants.js';
import { hasRealContent, nextId } from '../../../internal/a11y.js';
import { resolveLocalizedParts } from '../../../internal/localization-runtime.js';
import '../../layout/details/details.class.js';
import '../../utility/json-viewer/json-viewer.class.js';
import '../../utility/live-region/live-region.class.js';
import '../../forms/button/button.class.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './confirm-bar.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_approve, LYRA_DEFAULT_collapse, LYRA_DEFAULT_confirmApproved, LYRA_DEFAULT_confirmApprovedAnnounce, LYRA_DEFAULT_confirmDenied, LYRA_DEFAULT_confirmDeniedAnnounce, LYRA_DEFAULT_deny, LYRA_DEFAULT_details, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_open, LYRA_DEFAULT_restore, LYRA_DEFAULT_toolApprovalArgsLabel, LYRA_DEFAULT_toolApprovalGenericTool, LYRA_DEFAULT_toolApprovalHeading } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type ConfirmBarDecision = 'approved' | 'denied' | null;

/** A genuine two-member subset of the shared `LyraVariant` vocabulary: a confirmation is either
 *  routine or destructive, and `brand`/`success`/`warning` have no meaning for a proposal awaiting
 *  a yes/no. Spelled as an `Extract` of the shared union rather than a re-declared literal pair so
 *  the two can never drift apart. */
export type ConfirmBarVariant = Extract<LyraVariant, 'neutral' | 'danger'>;

/** Retained name for the union above. */
export type ConfirmBarTone = ConfirmBarVariant;

export interface LyraConfirmBarEventMap {
  'lr-approve': CustomEvent<{ args: unknown }>;
  'lr-deny': CustomEvent<undefined>;
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
 * dialog's safe-action-first rationale). On activation, focus moves synchronously to `[part="status"]`
 * (an always-rendered, `tabindex="-1"` element) *before* the Deny/Approve buttons unmount, so focus
 * never has a gap where it would otherwise fall back to `<body>`.
 *
 * "Never steals focus" and "no Escape semantics" describe what *this element* does on its own. A
 * host that swaps a focused control out for this bar is expected to move focus into it and to bind
 * Escape to its own cancel path (`<lr-memory-panel>` does both), since otherwise focus would fall
 * to `<body>` when the control it replaced unmounts. That stays a host decision: nothing here traps
 * focus, locks scrolling, or handles Escape.
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
 * silently when that default does.
 * re-exporting `lr-button`'s own `base`/`label`/`start`/`end`/`spinner` parts under
 * `{deny,approve}-button-{base,label,start,end,spinner}` so `--lr-button-*` theming and a consumer's
 * existing `lr-button` style fragments reach them like every other button in an app. An
 * `lr-approve`/`lr-deny` listener can call `preventDefault()` to keep the decision open while its own
 * async work (e.g. a network call) is in flight: `pending` is set to the decision being made, showing
 * `loading` on that button and `disabled` on the other, until the host finalizes by setting `.decision`
 * or bounces back by clearing `.pending` to `null`.
 *
 * @customElement lr-confirm-bar
 * @slot - Supplementary body content between the heading and the actions (e.g. a `lr-diff-view` of
 *   the proposed change).
 * @slot footer - Extra content at the start of the action row (e.g. a "remember this choice"
 *   checkbox), mirroring `lr-tool-approval-dialog`'s own `footer` slot.
 * @event lr-approve - `detail: { args }` (the `args` prop as-is; no editing in the bar) — identical
 *   shape to `lr-tool-approval-dialog`. Cancelable: a listener calling `preventDefault()` sets
 *   `pending` to `'approved'` instead of finalizing synchronously; set `.decision` (or clear
 *   `.pending` back to `null`) once your async work settles.
 * @event lr-deny - No detail, identical to the dialog. Cancelable, same `pending` mechanism as
 *   `lr-approve`.
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
 *   part, present only while `pending` is `'denied'`.
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
 *   `spinner` part, present only while `pending` is `'approved'`.
 * @csspart status - The decided-state text. Always present in the DOM (`tabindex="-1"`) so focus has
 *   a stable, synchronous landing spot on activation.
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
    open: LYRA_DEFAULT_open,
    restore: LYRA_DEFAULT_restore,
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

  /** Decided state. Set by the component on activation *and* host-writable (an externally-resolved
   *  decision -- timeout, another reviewer -- renders identically but emits nothing). */
  @property({ reflect: true }) decision: ConfirmBarDecision = null;

  /** Which decision is awaiting host resolution, while an lr-approve/lr-deny listener has called
   *  preventDefault(). Host-writable: set back to null to bounce back to the undecided state (e.g.
   *  on failure, so the user can retry), or set `decision` to finalize. */
  @property({ reflect: true }) pending: ConfirmBarDecision = null;

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

  @query('[part="status"]') private statusEl?: HTMLElement;
  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  // `[part='body']:empty` never matches because the part always contains a literal `<slot>`
  // child (CSS `:empty` only ignores text/comment nodes) -- same fix `lr-details`/`lr-empty`/
  // `lr-avatar`/`lr-stat` already established. Track real slot assignment in JS instead.
  @state() private hasBodySlot = false;

  private readonly headingId = nextId('confirm-bar-heading');

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
      this.statusEl?.focus();
      this.pending = null;
    }
  }

  private onBodySlotChange = (e: Event): void => {
    this.hasBodySlot = hasRealContent(
      (e.target as HTMLSlotElement).assignedNodes({ flatten: true }),
    );
  };

  private decide(next: 'approved' | 'denied'): void {
    if (this.decision != null || this.pending != null) return;
    const eventName = next === 'approved' ? 'lr-approve' : 'lr-deny';
    const detail = next === 'approved' ? { args: this.args } : undefined;
    const event = this.emit(eventName, detail, { cancelable: true });
    if (event.defaultPrevented) {
      // Same handoff as the synchronous path below, and for the same reason: `?loading` on the
      // just-activated button makes `lr-button`'s internal native `<button>` genuinely `disabled`,
      // and a browser blurs a focused element the instant it becomes disabled. Without moving
      // focus first, a keyboard user who activated Approve/Deny would be silently dropped to
      // <body> for the whole duration of the host's async work. Ordered before the `pending` write
      // so the button is still focusable when focus leaves it.
      this.statusEl?.focus();
      this.pending = next;
      return;
    }
    // Synchronous, before the property set below triggers the re-render that removes the
    // Deny/Approve buttons -- [part="status"] is always present in the DOM, so this never leaves a
    // gap where focus would otherwise fall back to <body>. Only reached on the synchronous
    // (non-pending) path -- an externally-set `decision` already skips this too, unchanged.
    this.statusEl?.focus();
    this.decision = next;
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('decision') && changed.get('decision') !== undefined && this.decision != null) {
      const key = this.decision === 'approved' ? 'confirmApprovedAnnounce' : 'confirmDeniedAnnounce';
      this.liveRegion?.announce(this.localize(key), { force: true });
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

  override render(): TemplateResult {
    const decided = this.decision != null;
    return html`
      <div part="base" role="group" aria-label=${this.getAttribute('aria-label') || nothing} aria-labelledby=${this.getAttribute('aria-label') ? nothing : this.headingId}>
        <div part="heading" id=${this.headingId}>${this.renderHeading()}</div>
        <div part="body" ?hidden=${!this.hasBodySlot}><slot @slotchange=${this.onBodySlotChange}></slot></div>
        ${this.args !== undefined
          ? html`<lr-details part="args" summary=${this.localize('toolApprovalArgsLabel')}>
              <lr-json-viewer .data=${this.args}></lr-json-viewer>
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
                  ?loading=${this.pending === 'denied'}
                  ?disabled=${this.pending === 'approved'}
                  exportparts="base:deny-button-base, button:deny-button-base, label:deny-button-label, start:deny-button-start, end:deny-button-end, spinner:deny-button-spinner"
                  @click=${() => this.decide('denied')}
                >${this.localize('deny')}</lr-button>
                <lr-button
                  part="approve-button"
                  variant=${this.variant === 'danger' ? 'danger' : 'brand'}
                  type="button"
                  ?loading=${this.pending === 'approved'}
                  ?disabled=${this.pending === 'denied'}
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
