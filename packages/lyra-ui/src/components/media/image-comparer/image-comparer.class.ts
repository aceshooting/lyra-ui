import { html, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { chevronIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { relayNativeEvent } from '../../../internal/native-event-relay.js';
import { finiteRange } from '../../../internal/numbers.js';
import { styles } from './image-comparer.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_imageComparerLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraImageComparerOrientation = 'horizontal' | 'vertical';

export interface LyraImageComparerEventMap {
  input: Event;
  change: Event;
  'lr-position-change': CustomEvent<{ position: number }>;
  'lr-change': CustomEvent<undefined>;
  blur: FocusEvent;
  focus: FocusEvent;
  'lr-blur': CustomEvent<undefined>;
  'lr-focus': CustomEvent<undefined>;
}

/**
 * `<lr-image-comparer>` — compares two slotted surfaces with a keyboard-
 * accessible range divider.
 *
 * @customElement lr-image-comparer
 * @slot before - The before-state image or content.
 * @slot after - The after-state image or content.
 * @slot handle - Custom decorative content inside the draggable handle. The flattened slot
 *   subtree is inert and hidden from assistive technology; the native range remains the only
 *   interaction target.
 * @event {Event} input - Bubbling, composed native input event emitted after the divider's
 *   live position has been committed.
 * @event {Event} change - Bubbling, composed native change event emitted when the range gesture
 *   commits a new position.
 * @event lr-position-change - Prefixed live-position alias. `detail: { position }`, where position
 *   is 0–100.
 * @event lr-change - Prefixed compatibility alias for `change`.
 * @event {FocusEvent} focus - Relayed once from the native range handle as a bubbling, composed
 *   native event.
 * @event {FocusEvent} blur - Relayed once from the native range handle as a bubbling, composed
 *   native event.
 * @event lr-focus - Prefixed compatibility alias for `focus`.
 * @event lr-blur - Prefixed compatibility alias for `blur`.
 * @csspart base - Compatibility name for the comparison viewport; use `comparison`.
 * @csspart comparison - The comparison viewport. It is the same node as `base`.
 * @csspart before - The clipped before-state layer.
 * @csspart after - The after-state layer.
 * @csspart divider - The visible divider line.
 * @csspart handle - Wrapper around the native range interaction surface and visible handle.
 * @csspart input - The transparent native range input.
 * @cssprop [--lr-image-comparer-divider-width=var(--divider-width, var(--lr-size-1px))] - Width of
 *   the dividing line. The canonical, namespaced override; prefer it over the bare compat name,
 *   which inherits and so retunes every element in the subtree reading that generic name.
 * @cssprop [--lr-image-comparer-handle-size=var(--handle-size, var(--lr-icon-button-size))] - Inline
 *   and block size of the visible compare handle. Canonical, namespaced override.
 * @cssprop [--divider-width=var(--lr-size-1px)] - Retained Shoelace-compat source for
 *   `--lr-image-comparer-divider-width`.
 * @cssprop [--handle-size=var(--lr-icon-button-size)] - Retained Shoelace-compat source for
 *   `--lr-image-comparer-handle-size`.
 * @cssstate dragging - Present while a pointer gesture is active on the range input.
 * @status stable
 * @since 4.0.0
 */
export class LyraImageComparer extends LyraElement<LyraImageComparerEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    imageComparerLabel: LYRA_DEFAULT_imageComparerLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

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
    relayNativeEvent(this, event);
    this.emit('lr-position-change', { position: this.normalizedPosition });
  };

  private onChange = (event: Event): void => {
    this.position = Number((event.currentTarget as HTMLInputElement).value);
    relayNativeEvent(this, event);
    this.emit('lr-change');
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

  private onFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
    this.emit('lr-focus');
  };

  private onBlur = (event: FocusEvent): void => {
    this.onPointerEnd();
    relayNativeEvent(this, event);
    this.emit('lr-blur');
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
    const label = this.accessibleLabel ?? this.localize('imageComparerLabel');
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
        <span class="handle-visual" aria-hidden="true" inert>
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
