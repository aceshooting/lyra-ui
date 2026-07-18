import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state, query } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { place } from '../../internal/positioner.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './entity-chip.styles.js';

export interface LyraEntityChipEventMap {
  'lyra-entity-activate': CustomEvent<{ id: string }>;
  'lyra-entity-open': CustomEvent<{ id: string }>;
}

const HIDE_DELAY_MS = 200;

/** A node counts as real preview content if it's an element not assigned to some other named
 *  slot, or non-whitespace text -- mirrors `lyra-citation-badge`'s identical `isRealPreviewNode`. */
function isRealPreviewNode(n: Node): boolean {
  return n.nodeType === Node.ELEMENT_NODE ? !(n as Element).hasAttribute('slot') : (n.textContent ?? '').trim().length > 0;
}

/**
 * `<lyra-entity-chip>` — an inline `@entity` mention for agent prose: flow content,
 * keyboard-focusable, with a hover/focus preview popover. The knowledge-graph sibling of
 * `lyra-citation-badge`, reusing its interaction contract wholesale. Carries ids through events
 * only -- no entity data resolution, no navigation.
 *
 * @customElement lyra-entity-chip
 * @slot - Rich preview content (typically a compact `lyra-entity-card`), shown in a floating
 * popover on hover/focus. No content -> no popover and no hover affordance at all.
 * @event lyra-entity-activate - Click, or Enter while focused. `detail: { id }`.
 * @event lyra-entity-open - Dblclick, or Space while focused. `detail: { id }`.
 * @csspart base - The clickable chip (`<button>`).
 * @csspart label - The chip's visible label text.
 * @csspart popover - The floating preview panel.
 * @cssprop [--lyra-entity-chip-color=var(--lyra-color-brand)] - Text/accent color. Reflected `type`
 * lets a host theme per type from CSS, e.g. `lyra-entity-chip[type='person'] { --lyra-entity-chip-color: ... }`.
 * @cssprop [--lyra-entity-chip-bg=var(--lyra-color-brand-quiet)] - Background color.
 */
export class LyraEntityChip extends LyraElement<LyraEntityChipEventMap> {
  static styles = [LyraElement.styles, styles];

  /** Echoed verbatim in both events, never validated -- the citation-badge `source-id` contract. */
  @property({ attribute: 'entity-id' }) entityId = '';
  /** The visible chip text (unlike citation-badge, the chip renders its label, not `[n]`). */
  @property() label = '';
  /** The entity's `lyra-graph` `nodeTypes` id; reflected so hosts theme per type from CSS. */
  @property({ reflect: true }) type = '';
  /** Resolved display label for `type`; when set, the accessible name speaks it instead of the raw
   *  type id. */
  @property({ attribute: 'type-label' }) typeLabel?: string;

  @state() private hasPreviewSlot = false;
  @state() private popoverOpen = false;

  @query('[part="base"]') private buttonEl?: HTMLButtonElement;
  @query('[part="popover"]') private popoverEl?: HTMLElement;

  private readonly popoverId = nextId('entity-chip-popover');
  private cleanupPositioner?: () => void;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private hovering = false;
  private focused = false;

  protected willUpdate(): void {
    if (!this.hasUpdated) {
      this.hasPreviewSlot = Array.from(this.childNodes).some(isRealPreviewNode);
    }
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('popoverOpen')) {
      this.cleanupPositioner?.();
      this.cleanupPositioner = undefined;
      if (this.popoverOpen && this.buttonEl && this.popoverEl) {
        this.cleanupPositioner = place(this.buttonEl, this.popoverEl, { placement: 'top-start' });
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanupPositioner?.();
    clearTimeout(this.hideTimer);
  }

  private get accessibleLabel(): string {
    if (!this.type) return this.label;
    const typeText = this.typeLabel || this.type;
    return this.localize('entityChipWithType', undefined, { label: this.label, type: typeText });
  }

  private onSlotChange = (e: Event): void => {
    this.hasPreviewSlot = (e.target as HTMLSlotElement).assignedNodes({ flatten: true }).some(isRealPreviewNode);
    if (!this.hasPreviewSlot) this.hidePreviewNow();
  };

  private showPreview(): void {
    if (!this.hasPreviewSlot) return;
    clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
    if (this.popoverOpen) return;
    this.popoverOpen = true;
  }

  private scheduleHidePreview(): void {
    if (!this.popoverOpen || this.hovering || this.focused) return;
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      this.hideTimer = undefined;
      this.popoverOpen = false;
    }, HIDE_DELAY_MS);
  }

  private hidePreviewNow(): void {
    clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
    if (this.popoverOpen) this.popoverOpen = false;
  }

  private onPointerEnter = (): void => {
    this.hovering = true;
    this.showPreview();
  };
  private onPointerLeave = (): void => {
    this.hovering = false;
    this.scheduleHidePreview();
  };
  private onFocusIn = (): void => {
    this.focused = true;
    this.showPreview();
  };
  private onFocusOut = (): void => {
    this.focused = false;
    if (this.hovering) return;
    this.hidePreviewNow();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.popoverOpen) {
      e.stopPropagation();
      this.hidePreviewNow();
      return;
    }
    if (e.key === ' ' && !e.repeat && e.target === this.buttonEl) {
      e.preventDefault();
      this.emitOpen();
    }
  };

  private onClick = (): void => {
    this.emit('lyra-entity-activate', { id: this.entityId });
  };

  private onDblClick = (): void => {
    this.emitOpen();
  };

  private emitOpen(): void {
    this.emit('lyra-entity-open', { id: this.entityId });
  }

  render(): TemplateResult {
    return html`
      <span
        class="wrapper"
        @pointerenter=${this.onPointerEnter}
        @pointerleave=${this.onPointerLeave}
        @focusin=${this.onFocusIn}
        @focusout=${this.onFocusOut}
        @keydown=${this.onKeyDown}
      >
        <button
          part="base"
          type="button"
          aria-label=${this.getAttribute('aria-label') || this.accessibleLabel}
          aria-describedby=${this.hasPreviewSlot ? this.popoverId : nothing}
          @click=${this.onClick}
          @dblclick=${this.onDblClick}
        >
          <span part="label">${this.label}</span>
        </button>
        <div part="popover" id=${this.popoverId} role="tooltip" ?hidden=${!this.popoverOpen}>
          <slot @slotchange=${this.onSlotChange}></slot>
        </div>
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lyra-entity-chip': LyraEntityChip;
  }
}
