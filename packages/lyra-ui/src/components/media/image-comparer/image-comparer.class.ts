import { html, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { chevronIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { finiteRange } from '../../../internal/numbers.js';
import { styles } from './image-comparer.styles.js';

export type LyraImageComparerOrientation = 'horizontal' | 'vertical';

export interface LyraImageComparerEventMap {
  'lr-position-change': CustomEvent<{ position: number }>;
  change: Event;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}

/**
 * `<lr-image-comparer>` — compares two slotted surfaces with a keyboard-
 * accessible range divider.
 *
 * @customElement lr-image-comparer
 * @slot before - The before-state image or content.
 * @slot after - The after-state image or content.
 * @slot handle - Custom decorative content inside the draggable handle.
 * @event lr-position-change - Divider moved. `detail: { position }`, where position is 0–100.
 * @event {Event} change - Bubbling, composed native change event emitted when the range gesture
 *   commits a new position.
 * @event focus - Re-dispatched from the native range handle as a bubbling, composed event.
 * @event blur - Re-dispatched from the native range handle as a bubbling, composed event.
 * @csspart base - Compatibility name for the comparison viewport; use `comparison`.
 * @csspart comparison - The comparison viewport. It is the same node as `base`.
 * @csspart before - The clipped before-state layer.
 * @csspart after - The after-state layer.
 * @csspart divider - The visible divider line.
 * @csspart handle - Wrapper around the native range interaction surface and visible handle.
 * @csspart input - The transparent native range input.
 * @cssprop [--divider-width=var(--lr-size-1px)] - Width of the dividing line.
 * @cssprop [--handle-size=var(--lr-icon-button-size)] - Inline and block size of the visible
 *   compare handle.
 * @cssstate dragging - Present while a pointer gesture is active on the range input.
 * @status stable
 * @since 4.0.0
 */
export class LyraImageComparer extends LyraElement<LyraImageComparerEventMap> {
  static override styles = [LyraElement.styles, styles];

  private readonly internals = attachInternalsSafely(this);

  @property({ type: Number, reflect: true }) position = 50;
  @property({ reflect: true }) orientation: LyraImageComparerOrientation = 'horizontal';
  @property({ attribute: 'before-label' }) beforeLabel = '';
  @property({ attribute: 'after-label' }) afterLabel = '';
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @query('[part="input"]') private handleEl?: HTMLInputElement;

  private get normalizedPosition(): number {
    return finiteRange(this.position, 50, 0, 100);
  }

  private onInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    this.position = Number(input.value);
    this.emit('lr-position-change', { position: this.normalizedPosition });
  };

  private onChange = (event: Event): void => {
    this.position = Number((event.currentTarget as HTMLInputElement).value);
    relayNativeEvent(this, event);
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    setCustomState(this.internals, 'dragging', true);
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Synthetic events and partial DOM shims have no active pointer to capture. The state still
      // follows their explicit pointerup/pointercancel event, while real gestures gain a reliable
      // end event even when the pointer leaves the comparison bounds.
    }
  };

  private onPointerEnd = (): void => {
    setCustomState(this.internals, 'dragging', false);
  };

  private onFocus = (): void => {
    this.emit('focus');
  };

  private onBlur = (): void => {
    this.onPointerEnd();
    this.emit('blur');
  };

  override disconnectedCallback(): void {
    this.onPointerEnd();
    super.disconnectedCallback();
  }

  /** Focus the internal native range handle; a pre-render call is a no-op. */
  override focus(options?: FocusOptions): void {
    this.handleEl?.focus(options);
  }

  /** Blur the internal native range handle; a pre-render call is a no-op. */
  override blur(): void {
    this.handleEl?.blur();
  }

  /** Activate the internal native range handle; a pre-render call is a no-op. */
  override click(): void {
    this.handleEl?.click();
  }

  override render(): TemplateResult {
    const position = `${this.normalizedPosition}%`;
    const label = this.accessibleLabel || this.localize('imageComparerLabel');
    return html`<div
      part="base comparison"
      data-orientation=${this.orientation}
      style="--lr-comparer-position: ${position}"
      role="group"
      aria-label=${label}
    >
      <div part="after"><slot name="after">${this.afterLabel}</slot></div>
      <div part="before"><slot name="before">${this.beforeLabel}</slot></div>
      <div part="divider" aria-hidden="true"></div>
      <div part="handle">
        <input
          part="input"
          type="range"
          min="0"
          max="100"
          step="1"
          .value=${String(this.normalizedPosition)}
          aria-label=${label}
          aria-orientation=${this.orientation}
          @input=${this.onInput}
          @change=${this.onChange}
          @focus=${this.onFocus}
          @blur=${this.onBlur}
          @pointerdown=${this.onPointerDown}
          @pointerup=${this.onPointerEnd}
          @pointercancel=${this.onPointerEnd}
          @lostpointercapture=${this.onPointerEnd}
        />
        <span class="handle-visual" aria-hidden="true">
          <slot name="handle"
            ><span class="handle-fallback">${chevronIcon()}${chevronIcon()}</span></slot
          >
        </span>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-image-comparer': LyraImageComparer;
  }
}
