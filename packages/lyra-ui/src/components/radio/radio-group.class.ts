import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId } from '../../internal/a11y.js';
import { tag } from '../../internal/prefix.js';
import { groupStyles } from './radio-group.styles.js';
import type { LyraRadio } from './radio.class.js';

export interface LyraRadioGroupEventMap {
  'lyra-change': CustomEvent<{ value: string; radio: LyraRadio }>;
}

/**
 * `<lyra-radio-group>` — a labeled, keyboard-navigable group of radios.
 *
 * @customElement lyra-radio-group
 * @slot - Radio controls.
 * @slot label - Visible group label.
 * @slot hint - Supporting text.
 * @slot error - Validation text.
 * @event lyra-change - A radio was selected. `detail: { value, radio }`.
 * @csspart base - The radiogroup wrapper.
 * @csspart label - The group label.
 * @csspart hint - Supporting text.
 * @csspart error - Validation text.
 */
export class LyraRadioGroup extends LyraElement<LyraRadioGroupEventMap> {
  static styles = [LyraElement.styles, groupStyles];
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property() name = '';
  @property({ type: Boolean, reflect: true }) required = false;
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private hasLabelSlot = false;
  @state() private hasHintSlot = false;
  @state() private hasErrorSlot = false;
  private readonly labelId = nextId('radio-group-label');

  connectedCallback(): void {
    super.connectedCallback();
    this.syncRadios();
  }
  protected updated(): void { this.syncRadios(); }
  private radios(): LyraRadio[] {
    return [...this.querySelectorAll(tag('radio'))] as LyraRadio[];
  }
  private syncRadios(): void {
    const radios = this.radios();
    const enabled = radios.filter((radio) => !radio.disabled && !this.disabled);
    const checkedRadio = radios.find((radio) => radio.checked);
    for (const radio of radios) {
      if (this.name) radio.name = this.name;
      radio.setGroupRequired(this.required);
      radio.setGroupDisabled(this.disabled);
      radio.setGroupTabbable(checkedRadio ? radio === checkedRadio : radio === enabled[0]);
    }
  }
  /** @internal */
  selectRadio(radio: LyraRadio): void {
    for (const candidate of this.radios()) candidate.checked = candidate === radio;
    this.syncRadios();
    this.emit('lyra-change', { value: radio.value, radio });
  }
  private onKeyDown = (event: KeyboardEvent): void => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    const radios = this.radios().filter((radio) => !radio.disabled);
    const current = event.target as LyraRadio;
    const index = radios.indexOf(current);
    if (index < 0 || radios.length === 0) return;
    event.preventDefault();
    const rtl = this.effectiveDirection === 'rtl';
    const forward = event.key === 'ArrowDown' || (rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight');
    const backward = event.key === 'ArrowUp' || (rtl ? event.key === 'ArrowRight' : event.key === 'ArrowLeft');
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? radios.length - 1
      : forward ? (index + 1) % radios.length : backward ? (index - 1 + radios.length) % radios.length : index;
    const next = radios[nextIndex];
    next.focus();
    this.selectRadio(next);
  };
  private onSlotChange = (event: Event): void => {
    const slot = event.target as HTMLSlotElement;
    const elements = slot.assignedElements({ flatten: true });
    if (slot.name === 'label') this.hasLabelSlot = elements.length > 0;
    if (slot.name === 'hint') this.hasHintSlot = elements.length > 0;
    if (slot.name === 'error') this.hasErrorSlot = elements.length > 0;
  };
  render(): TemplateResult {
    const hasLabel = this.hasLabelSlot || Boolean(this.label);
    const hasHint = this.hasHintSlot || Boolean(this.hint);
    const hasError = this.hasErrorSlot || Boolean(this.errorText);
    return html`
      <div part="base" role="radiogroup"
        aria-label=${this.accessibleLabel || nothing}
        aria-labelledby=${!this.accessibleLabel && hasLabel ? this.labelId : nothing}
        @keydown=${this.onKeyDown}>
        <div part="label" id=${this.labelId} ?hidden=${!hasLabel}>${this.label}<slot name="label" @slotchange=${this.onSlotChange}></slot></div>
        <slot></slot>
        <div part="hint" ?hidden=${!hasHint}>${this.hint}<slot name="hint" @slotchange=${this.onSlotChange}></slot></div>
        <div part="error" ?hidden=${!hasError}>${this.errorText}<slot name="error" @slotchange=${this.onSlotChange}></slot></div>
      </div>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lyra-radio-group': LyraRadioGroup; } }
