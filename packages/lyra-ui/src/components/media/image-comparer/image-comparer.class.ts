import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { finiteRange } from '../../../internal/numbers.js';
import { styles } from './image-comparer.styles.js';

export type LyraImageComparerOrientation = 'horizontal' | 'vertical';

export interface LyraImageComparerEventMap {
  'lr-position-change': CustomEvent<{ position: number }>;
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
 * @event lr-position-change - Divider moved. `detail: { position }`, where position is 0–100.
 * @csspart base - The comparison viewport.
 * @csspart before - The clipped before-state layer.
 * @csspart after - The after-state layer.
 * @csspart divider - The visible divider line.
 * @csspart handle - The native range interaction surface.
 */
export class LyraImageComparer extends LyraElement<LyraImageComparerEventMap> {
  static override styles = [LyraElement.styles, styles];

  @property({ type: Number, reflect: true }) position = 50;
  @property({ reflect: true }) orientation: LyraImageComparerOrientation = 'horizontal';
  @property({ attribute: 'before-label' }) beforeLabel = '';
  @property({ attribute: 'after-label' }) afterLabel = '';
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private get normalizedPosition(): number {
    return finiteRange(this.position, 50, 0, 100);
  }

  private onInput = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    this.position = Number(input.value);
    this.emit('lr-position-change', { position: this.normalizedPosition });
  };

  private onFocus = (): void => {
    this.emit('focus');
  };

  private onBlur = (): void => {
    this.emit('blur');
  };

  override render(): TemplateResult {
    const position = `${this.normalizedPosition}%`;
    const label = this.accessibleLabel || this.localize('imageComparerLabel');
    return html`<div
      part="base"
      data-orientation=${this.orientation}
      style="--lr-comparer-position: ${position}"
      role="group"
      aria-label=${label}
    >
      <div part="after"><slot name="after">${this.afterLabel}</slot></div>
      <div part="before"><slot name="before">${this.beforeLabel}</slot></div>
      <div part="divider" aria-hidden="true"></div>
      <input
        part="handle"
        type="range"
        min="0"
        max="100"
        step="1"
        .value=${String(this.normalizedPosition)}
        aria-label=${label}
        @input=${this.onInput}
        @focus=${this.onFocus}
        @blur=${this.onBlur}
      />
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-image-comparer': LyraImageComparer;
  }
}
