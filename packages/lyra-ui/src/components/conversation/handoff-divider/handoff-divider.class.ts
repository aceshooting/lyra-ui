import { html, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import type { LyraLiveRegion } from '../../utility/live-region/live-region.class.js';
import '../../utility/live-region/live-region.js';
import { styles } from './handoff-divider.styles.js';

/**
 * `<lr-handoff-divider>` — a labeled semantic separator marking control transfer between agents
 * in a transcript ("Transferred to Research Agent"), with an optional agent avatar. Purely
 * presentational: no events, no interactivity, no restore semantics.
 *
 * The computed label is announced once, on first connect, through an internal
 * `<lr-live-region>` — a single mount-time announcement is enough since a handoff lands
 * mid-stream and there is only ever one thing to say. Later property changes re-render the
 * visible/accessible label but never re-announce.
 *
 * @customElement lr-handoff-divider
 * @slot avatar - The incoming agent's `<lr-avatar>` (or icon), at the start of the chip. Hidden
 *   entirely while empty.
 * @csspart base - The separator root (`role="separator"`).
 * @csspart line - Each of the two flanking rules.
 * @csspart chip - The visual (`aria-hidden`) chip wrapping the avatar and label.
 * @csspart avatar - Wrapper around the `avatar` slot. Only shown while the slot has content.
 * @csspart label - The computed label text.
 */
export class LyraHandoffDivider extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** The agent now in control. With nothing else set, renders `'Transferred to {agent}'`. */
  @property() agent = '';

  /** Optional source agent. With both `fromAgent` and `agent` set, renders `'Transferred from
   *  {from} to {to}'` — worded, not an arrow, so RTL needs no mirroring. */
  @property({ attribute: 'from-agent' }) fromAgent = '';

  /** Full override, rendered as-is. With nothing set at all, the generic `'Agent handoff'`
   *  fallback renders. */
  @property() label = '';

  @state() private hasAvatarSlot = false;

  @query('lr-live-region') private liveRegion?: LyraLiveRegion;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasAvatarSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'avatar');
    }
  }

  firstUpdated(): void {
    this.liveRegion?.announce(this.computedLabel, { force: true });
  }

  private onAvatarSlotChange = (e: Event): void => {
    this.hasAvatarSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  private get computedLabel(): string {
    if (this.label) return this.label;
    if (this.fromAgent && this.agent) {
      return this.localize('handoffFromToAgent', undefined, { from: this.fromAgent, to: this.agent });
    }
    if (this.agent) {
      return this.localize('handoffToAgent', undefined, { agent: this.agent });
    }
    return this.localize('handoffLabel');
  }

  render(): TemplateResult {
    const label = this.computedLabel;
    const ariaLabel = this.getAttribute('aria-label') || label;
    return html`
      <div part="base" role="separator" aria-orientation="horizontal" aria-label=${ariaLabel}>
        <span part="line" aria-hidden="true"></span>
        <span part="chip" aria-hidden="true" title=${label}>
          <span part="avatar" ?hidden=${!this.hasAvatarSlot}>
            <slot name="avatar" @slotchange=${this.onAvatarSlotChange}></slot>
          </span>
          <span part="label">${label}</span>
        </span>
        <span part="line" aria-hidden="true"></span>
      </div>
      <lr-live-region></lr-live-region>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-handoff-divider': LyraHandoffDivider;
  }
}
