import { normalizeLabel } from '../../../internal/accessible-name.js';
import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import { styles } from './handoff-divider.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_handoffLabel } from '../../../internal/default-strings/conversation.generated.js';
import { LYRA_DEFAULT_handoffFromToAgent, LYRA_DEFAULT_handoffToAgent } from '../../../internal/default-strings/shared.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/**
 * `<lr-handoff-divider>` — a labeled semantic separator marking control transfer between agents
 * in a transcript ("Transferred to Research Agent"), with an optional agent avatar. Purely
 * presentational: no events, no interactivity, no restore semantics. It never announces itself:
 * like other transcript content it is silent on mount, so a live container (for example
 * `<lr-chat-viewport live="polite">`) announces a newly appended handoff.
 *
 * @customElement lr-handoff-divider
 * @slot avatar - The incoming agent's `<lr-avatar>` (or icon), at the start of the chip. Hidden
 *   entirely while empty.
 * @csspart base - The separator root (`role="separator"`).
 * @csspart line - Each of the two flanking rules.
 * @csspart chip - The visual (`aria-hidden`) chip wrapping the avatar and label.
 * @csspart avatar - Wrapper around the `avatar` slot. Only shown while the slot has content.
 * @csspart label - The computed label text.
 * @cssprop [--lr-handoff-divider-gap=var(--lr-space-s)] - Gap between items.
 * @cssprop [--lr-handoff-divider-bg=var(--lr-color-surface-raised)] - Resting background.
 * @cssprop [--lr-handoff-divider-color=var(--lr-color-text-quiet)] - Resting text color.
 * @cssprop [--lr-handoff-divider-border-color=var(--lr-color-border-subtle)] - Resting border color.
 * @cssprop [--lr-handoff-divider-radius=var(--lr-radius-pill)] - Corner radius.
 * @cssprop [--lr-handoff-divider-padding-inline=var(--lr-space-s)] - Inline padding.
 * @status stable
 * @since 4.0.0
 */
export class LyraHandoffDivider extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    handoffFromToAgent: LYRA_DEFAULT_handoffFromToAgent,
    handoffLabel: LYRA_DEFAULT_handoffLabel,
    handoffToAgent: LYRA_DEFAULT_handoffToAgent,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** The destination agent now in control. With nothing else set, renders
   *  `'Transferred to {agent}'`. */
  @property({ attribute: 'to-agent' }) toAgent = '';

  /** Optional source agent. With both `fromAgent` and `toAgent` set, renders `'Transferred from
   *  {from} to {to}'` — worded, not an arrow, so RTL needs no mirroring. */
  @property({ attribute: 'from-agent' }) fromAgent = '';

  /** Full override, rendered as-is. With nothing set at all, the generic `'Agent handoff'`
   *  fallback renders. */
  @property() label = '';

  private readonly slots = new SlotPresenceController(this);

  private get computedLabel(): string {
    const custom = normalizeLabel(this.label);
    if (custom) return custom;
    if (this.fromAgent && this.toAgent) {
      return this.localize('handoffFromToAgent', undefined, { from: this.fromAgent, to: this.toAgent });
    }
    if (this.toAgent) {
      return this.localize('handoffToAgent', undefined, { agent: this.toAgent });
    }
    return this.localize('handoffLabel');
  }

  override render(): TemplateResult {
    const label = this.computedLabel;
    const authored = this.getAttribute('aria-label');
    const ariaLabel = authored === '' ? '' : normalizeLabel(authored) ?? label;
    return html`
      <div part="base" role="separator" aria-orientation="horizontal" aria-label=${ariaLabel}>
        <span part="line" aria-hidden="true"></span>
        <span part="chip" aria-hidden="true" title=${label}>
          <span part="avatar" ?hidden=${!this.slots.has('avatar')}>
            <slot name="avatar"></slot>
          </span>
          <span part="label">${label}</span>
        </span>
        <span part="line" aria-hidden="true"></span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-handoff-divider': LyraHandoffDivider;
  }
}
