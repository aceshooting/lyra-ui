import { html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import '../../layout/details/details.class.js';
import '../../utility/json-viewer/json-viewer.class.js';
import '../../utility/live-region/live-region.class.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import { styles } from './confirm-bar.styles.js';

export type ConfirmBarDecision = 'approved' | 'denied' | null;
export type ConfirmBarTone = 'neutral' | 'danger';

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
 * No argument editing (escalate to `<lr-tool-approval-dialog>`'s `editable` when edit-before-approve
 * matters); no blocking/modality guarantee (a user can scroll past); no decision persistence or
 * "remember choice" logic (the `footer` slot + host own that).
 *
 * @customElement lr-confirm-bar
 * @slot - Supplementary body content between the heading and the actions (e.g. a `lr-diff-view` of
 *   the proposed change).
 * @slot footer - Extra content at the start of the action row (e.g. a "remember this choice"
 *   checkbox), mirroring `lr-tool-approval-dialog`'s own `footer` slot.
 * @event lr-approve - `detail: { args }` (the `args` prop as-is; no editing in the bar) — identical
 *   shape to `lr-tool-approval-dialog`.
 * @event lr-deny - No detail, identical to the dialog.
 * @csspart base - The root (`role="group"`).
 * @csspart heading - The heading.
 * @csspart tool-name - The tool-name span within the heading. Only rendered when `heading` is unset.
 * @csspart body - The default-slot wrapper.
 * @csspart args - The `lr-details` + `lr-json-viewer` wrapper. Only rendered when `args` is
 *   defined.
 * @csspart footer - The action row.
 * @csspart deny-button - Named identically to the dialog's part.
 * @csspart approve-button - Named identically to the dialog's part.
 * @csspart status - The decided-state text. Always present in the DOM (`tabindex="-1"`) so focus has
 *   a stable, synchronous landing spot on activation.
 */
export class LyraConfirmBar extends LyraElement<LyraConfirmBarEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Drives the default heading through the existing dialog keys. */
  @property({ attribute: 'tool-name' }) toolName = '';

  /** Free-form heading override for non-tool proposals. Wins over `toolName` when set. */
  @property() heading = '';

  /** Shown read-only inside a collapsed `lr-details` + `lr-json-viewer` when defined. */
  @property({ attribute: false }) args: unknown = undefined;

  /** Decided state. Set by the component on activation *and* host-writable (an externally-resolved
   *  decision -- timeout, another reviewer -- renders identically but emits nothing). */
  @property({ reflect: true }) decision: ConfirmBarDecision = null;

  /** Token-mapped emphasis for destructive proposals. */
  @property({ reflect: true }) tone: ConfirmBarTone = 'neutral';

  @query('[part="status"]') private statusEl?: HTMLElement;
  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  // `[part='body']:empty` never matches because the part always contains a literal `<slot>`
  // child (CSS `:empty` only ignores text/comment nodes) -- same fix `lr-details`/`lr-empty`/
  // `lr-avatar`/`lr-stat` already established. Track real slot assignment in JS instead.
  @state() private hasBodySlot = false;

  private readonly headingId = nextId('confirm-bar-heading');

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasBodySlot = Array.from(this.children).some((el) => !el.hasAttribute('slot'));
    }
    void changed;
  }

  private onBodySlotChange = (e: Event): void => {
    this.hasBodySlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private decide(next: 'approved' | 'denied'): void {
    if (this.decision != null) return;
    // Synchronous, before the emit/property-set below trigger the re-render that removes the
    // Deny/Approve buttons -- [part="status"] is always present in the DOM, so this never leaves a
    // gap where focus would otherwise fall back to <body>.
    this.statusEl?.focus();
    if (next === 'approved') {
      this.emit<{ args: unknown }>('lr-approve', { args: this.args });
    } else {
      this.emit('lr-deny');
    }
    this.decision = next;
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('decision') && this.decision != null) {
      const key = this.decision === 'approved' ? 'confirmApprovedAnnounce' : 'confirmDeniedAnnounce';
      this.liveRegion?.announce(this.localize(key), { force: true });
    }
  }

  private renderHeading(): TemplateResult {
    if (this.heading) return html`${this.heading}`;
    const toolName = this.toolName || this.localize('toolApprovalGenericTool');
    const [before, after] = this.localize('toolApprovalHeading').split('{tool}');
    return html`${before}<span part="tool-name">${toolName}</span>${after ?? ''}`;
  }

  private statusText(): string {
    return this.decision === 'approved' ? this.localize('confirmApproved') : this.localize('confirmDenied');
  }

  render(): TemplateResult {
    const decided = this.decision != null;
    return html`
      <div part="base" role="group" aria-labelledby=${this.headingId}>
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
                <button part="deny-button" type="button" @click=${() => this.decide('denied')}>
                  ${this.localize('deny')}
                </button>
                <button part="approve-button" type="button" @click=${() => this.decide('approved')}>
                  ${this.localize('approve')}
                </button>
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
