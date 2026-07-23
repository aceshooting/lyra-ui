import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { tag } from '../../../internal/prefix.js';
import { groupStyles } from './radio-group.styles.js';
import type { LyraRadio } from './radio.class.js';

export interface LyraRadioGroupEventMap {
  'lr-change': CustomEvent<{ value: string; radio: LyraRadio }>;
}

/**
 * `<lr-radio-group>` — a labeled, keyboard-navigable group of radios.
 *
 * @customElement lr-radio-group
 * @slot - Radio controls.
 * @slot label - Visible group label.
 * @slot hint - Supporting text.
 * @slot error - Validation text.
 * @event lr-change - A radio was selected. `detail: { value, radio }`.
 * @csspart base - The radiogroup wrapper.
 * @csspart label - The group label.
 * @csspart hint - Supporting text.
 * @csspart error - Validation text.
 */
export class LyraRadioGroup extends LyraElement<LyraRadioGroupEventMap> {
  static override styles = [LyraElement.styles, groupStyles];
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
  private readonly hintId = nextId('radio-group-hint');
  private readonly errorId = nextId('radio-group-error');
  private managedRadios = new Set<LyraRadio>();
  private membershipObserver?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncRadios();
    this.membershipObserver = new MutationObserver(() => {
      queueMicrotask(() => {
        if (this.isConnected) this.syncRadios();
      });
    });
    this.membershipObserver.observe(this, { childList: true, subtree: true });
  }
  override disconnectedCallback(): void {
    this.membershipObserver?.disconnect();
    this.membershipObserver = undefined;
    this.releaseRadios(this.managedRadios);
    this.managedRadios.clear();
    super.disconnectedCallback();
  }
  protected override updated(): void { this.syncRadios(); }
  private radios(): LyraRadio[] {
    return [...this.querySelectorAll(tag('radio'))] as LyraRadio[];
  }
  private syncRadios(): void {
    const radios = this.radios();
    const current = new Set(radios);
    this.releaseRadios([...this.managedRadios].filter((radio) => !current.has(radio)));
    this.managedRadios = current;
    const enabled = radios.filter((radio) => !radio.effectiveDisabled && !this.disabled);
    const checkedRadio = radios.find((radio) => radio.checked);
    const groupName = this.name || this.getAttribute('name') || '';
    for (const radio of radios) {
      if (groupName) radio.name = groupName;
      radio.setGroupRequired(this.required);
      radio.setGroupDisabled(this.disabled);
      radio.setGroupTabbable(checkedRadio ? radio === checkedRadio : radio === enabled[0]);
    }
  }
  private releaseRadios(radios: Iterable<LyraRadio>): void {
    for (const radio of radios) {
      radio.setGroupRequired(false);
      radio.setGroupDisabled(false);
      radio.setGroupTabbable(true);
    }
  }
  /** @internal */
  selectRadio(radio: LyraRadio): void {
    if (this.disabled || radio.effectiveDisabled || !this.managedRadios.has(radio)) return;
    for (const candidate of this.radios()) candidate.checked = candidate === radio;
    this.syncRadios();
    this.emit('lr-change', { value: radio.value, radio });
  }
  private onKeyDown = (event: KeyboardEvent): void => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    if (this.disabled) return;
    const radios = this.radios().filter((radio) => !radio.effectiveDisabled);
    const current = event.target as LyraRadio;
    if (current.effectiveDisabled) return;
    const index = radios.indexOf(current);
    if (index < 0 || radios.length === 0) return;
    event.preventDefault();
    const rtl = this.effectiveDirection === 'rtl';
    const forward = event.key === 'ArrowDown' || (rtl ? event.key === 'ArrowLeft' : event.key === 'ArrowRight');
    const backward = event.key === 'ArrowUp' || (rtl ? event.key === 'ArrowRight' : event.key === 'ArrowLeft');
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? radios.length - 1
      : forward ? (index + 1) % radios.length : backward ? (index - 1 + radios.length) % radios.length : index;
    // safe: radios is non-empty (guarded above) and nextIndex is a modulo/clamp into range.
    const next = radios[nextIndex]!;
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
  private onRadioSlotChange = (): void => {
    this.syncRadios();
    queueMicrotask(() => {
      if (this.isConnected) this.syncRadios();
    });
  };
  override render(): TemplateResult {
    const hasLabel = this.hasLabelSlot || Boolean(this.label);
    const hasHint = this.hasHintSlot || Boolean(this.hint);
    const hasError = this.hasErrorSlot || Boolean(this.errorText);
    const described = [hasHint ? this.hintId : '', hasError ? this.errorId : ''].filter(Boolean).join(' ') || nothing;
    return html`
      <div part="base" role="radiogroup"
        aria-label=${this.accessibleLabel || nothing}
        aria-labelledby=${!this.accessibleLabel && hasLabel ? this.labelId : nothing}
        aria-describedby=${described}
        @keydown=${this.onKeyDown}>
        <div part="label" id=${this.labelId} ?hidden=${!hasLabel}>${this.label}<slot name="label" @slotchange=${this.onSlotChange}></slot></div>
        <slot @slotchange=${this.onRadioSlotChange}></slot>
        <div part="hint" id=${this.hintId} ?hidden=${!hasHint}>${this.hint}<slot name="hint" @slotchange=${this.onSlotChange}></slot></div>
        <div part="error" id=${this.errorId} ?hidden=${!hasError}>${this.errorText}<slot name="error" @slotchange=${this.onSlotChange}></slot></div>
      </div>
    `;
  }
}

declare global { interface HTMLElementTagNameMap { 'lr-radio-group': LyraRadioGroup; } }
