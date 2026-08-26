import { html, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { chevronIcon } from '../../../internal/icons.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { dispatchNativeEvent, relayNativeEvent } from '../../../internal/native-event-relay.js';
import { finiteRange, isSliderKey } from '../../../internal/numbers.js';
import type { LyraOrientation } from '../../../internal/shared-unions.js';
import { styles } from './image-comparer.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_imageComparerLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type LyraImageComparerOrientation = LyraOrientation;

export interface LyraImageComparerEventMap {
  input: Event;
  change: Event;
  blur: FocusEvent;
  focus: FocusEvent;
}

const IMAGE_COMPARER_ORIENTATIONS = new Set<LyraImageComparerOrientation>([
  'horizontal',
  'vertical',
]);

function normalizeOrientation(value: unknown): LyraImageComparerOrientation {
  return IMAGE_COMPARER_ORIENTATIONS.has(value as LyraImageComparerOrientation)
    ? (value as LyraImageComparerOrientation)
    : 'horizontal';
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
 * @event {FocusEvent} focus - Relayed once from the native range handle as a bubbling, composed
 *   native event.
 * @event {FocusEvent} blur - Relayed once from the native range handle as a bubbling, composed
 *   native event.
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

  private _position = 50;
  @property({ type: Number, reflect: true })
  get position(): number {
    return this._position;
  }
  set position(value: number) {
    const old = this._position;
    this._position = finiteRange(value, 50, 0, 100);
    this.requestUpdate('position', old);
  }

  private _orientation: LyraImageComparerOrientation = 'horizontal';
  @property({ reflect: true })
  get orientation(): LyraImageComparerOrientation {
    return this._orientation;
  }
  set orientation(value: LyraImageComparerOrientation) {
    const old = this._orientation;
    this._orientation = normalizeOrientation(value);
    this.requestUpdate('orientation', old);
  }
  @property({ attribute: 'before-label' }) beforeLabel = '';
  @property({ attribute: 'after-label' }) afterLabel = '';
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @query('[part="input"]') private handleEl?: HTMLInputElement;
  private activePointerId?: number;
  private keyboardDirty = false;

  private get normalizedPosition(): number {
    return finiteRange(this.position, 50, 0, 100);
  }

  private onInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    this.position = Number(input.value);
    relayNativeEvent(this, event);
  };

  private onChange = (event: Event): void => {
    this.position = Number((event.currentTarget as HTMLInputElement).value);
    relayNativeEvent(this, event);
  };

  private onPointerDown = (event: PointerEvent): void => {
    if (!event.isPrimary || event.button !== 0 || this.activePointerId !== undefined) return;
    this.activePointerId = event.pointerId;
    setCustomState(this.internals, 'dragging', true);
    try {
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    } catch {
      // Synthetic events and partial DOM shims have no active pointer to capture. The state still
      // follows their explicit pointerup/pointercancel event, while real gestures gain a reliable
      // end event even when the pointer leaves the comparison bounds.
    }
  };

  private onPointerEnd = (event?: PointerEvent): void => {
    if (
      event
      && this.activePointerId !== undefined
      && event.pointerId !== this.activePointerId
    ) return;
    this.activePointerId = undefined;
    setCustomState(this.internals, 'dragging', false);
  };

  private keyboardPosition(key: string): number | undefined {
    if (key === 'Home') return 0;
    if (key === 'End') return 100;
    if (key === 'PageUp') return this.normalizedPosition + 10;
    if (key === 'PageDown') return this.normalizedPosition - 10;
    const rtl = this.effectiveDirection === 'rtl';
    if (this.orientation === 'vertical') {
      if (key === 'ArrowUp' || key === 'ArrowLeft') return this.normalizedPosition - 1;
      if (key === 'ArrowDown' || key === 'ArrowRight') return this.normalizedPosition + 1;
      return undefined;
    }
    if (key === 'ArrowLeft') return this.normalizedPosition + (rtl ? 1 : -1);
    if (key === 'ArrowRight') return this.normalizedPosition + (rtl ? -1 : 1);
    if (key === 'ArrowUp') return this.normalizedPosition + 1;
    if (key === 'ArrowDown') return this.normalizedPosition - 1;
    return undefined;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    if (!isSliderKey(event.key)) return;
    const next = this.keyboardPosition(event.key);
    if (next === undefined) return;
    event.preventDefault();
    const normalized = finiteRange(next, this.normalizedPosition, 0, 100);
    if (normalized === this.normalizedPosition) return;
    this.position = normalized;
    this.keyboardDirty = true;
    dispatchNativeEvent(this, 'input');
  };

  private onKeyUp = (event: KeyboardEvent): void => {
    if (!isSliderKey(event.key) || !this.keyboardDirty) return;
    event.preventDefault();
    this.keyboardDirty = false;
    dispatchNativeEvent(this, 'change');
  };

  private onFocus = (event: FocusEvent): void => {
    relayNativeEvent(this, event);
  };

  private onBlur = (event: FocusEvent): void => {
    this.onPointerEnd();
    if (this.keyboardDirty) {
      this.keyboardDirty = false;
      dispatchNativeEvent(this, 'change');
    }
    relayNativeEvent(this, event);
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
          @keydown=${this.onKeyDown}
          @keyup=${this.onKeyUp}
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
