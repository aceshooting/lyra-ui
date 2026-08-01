import { html, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { nextId } from '../../../internal/a11y.js';
import { tag } from '../../../internal/prefix.js';
import { sizes } from '../../../internal/sizes.styles.js';
import type { LyraSize } from '../../../internal/variants.js';
import { groupStyles } from './radio-group.styles.js';
import type { LyraRadio } from './radio.class.js';
import { dispatchNativeEvent } from '../../../internal/native-event-relay.js';

export interface LyraRadioGroupEventMap {
  input: Event;
  change: Event;
  'lr-input': CustomEvent<{ value: string; radio: LyraRadio }>;
  'lr-change': CustomEvent<{ value: string; radio: LyraRadio }>;
}

// The two tags a group manages. `<lr-radio-button>` is a `LyraRadio` subclass, so every group
// behaviour applies to it unchanged -- but discovery is by local name (an `instanceof` check would
// force this module to import the subclass, and with it the button chrome, into every app that only
// uses plain radios), so both names have to be listed. Computed rather than frozen at module scope
// so the prefix stays the single source of truth.
const RADIO_TAGS = (): string[] => [tag('radio'), tag('radio-button')];

/**
 * `<lr-radio-group>` — a labeled, keyboard-navigable group of radios.
 *
 * @customElement lr-radio-group
 * @slot - Radio controls.
 * @slot label - Visible group label.
 * @slot hint - Supporting text.
 * @slot error - Validation text.
 * @event input - Native event fired from the group when its selected value changes.
 * @event change - Native event fired after `input` for the same group selection.
 * @event lr-input - Prefixed alias for `input`; `detail: { value, radio }`.
 * @event lr-change - A radio was selected. `detail: { value, radio }`.
 * @csspart base - The radiogroup wrapper.
 * @csspart label - The group label.
 * @csspart hint - Supporting text.
 * @csspart error - Validation text.
 * @cssprop [--lr-radio-group-row-gap=calc(var(--lr-form-control-height) * 0.2)] - Vertical gap
 * between the group's label, options and messages, scaled by `size`.
 */
export class LyraRadioGroup extends LyraElement<LyraRadioGroupEventMap> {
  static override styles = [LyraElement.styles, sizes, groupStyles];
  /**
   * Size of the group's own chrome, on the library's shared ladder. Accepts both spellings of every
   * tier — `2xs`/`xs`/`s`/`m`/`l`/`xl` and Web Awesome's `small`/`medium`/`large` — so migrating
   * either way is a tag rename. Scales the group's label type size and the gaps around and between
   * its options off the same `--lr-form-control-*` values the controls themselves use. It does not
   * resize the `<lr-radio>`/`<lr-radio-button>` children: each carries its own `size`, so a group
   * can hold options at mixed sizes and an explicitly-sized option is never silently overridden by
   * its container. Set the same `size` on the children to scale the whole group.
   */
  @property({ reflect: true }) size: LyraSize = 'm';
  @property() label = '';
  @property() hint = '';
  @property({ attribute: 'error-text' }) errorText = '';
  @property({ reflect: true }) name = '';
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
  private authorNames = new Map<LyraRadio, string>();
  private syncingRadios = false;
  private membershipObserver?: MutationObserver;

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncRadios();
    this.membershipObserver = new MutationObserver(() => {
      queueMicrotask(() => {
        if (this.isConnected) this.syncRadios();
      });
    });
    this.membershipObserver.observe(this, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ['slot', 'checked', 'disabled'],
    });
  }
  override disconnectedCallback(): void {
    this.membershipObserver?.disconnect();
    this.membershipObserver = undefined;
    this.releaseRadios(this.managedRadios);
    this.managedRadios.clear();
    super.disconnectedCallback();
  }
  protected override updated(): void { this.syncRadios(); }

  private radioGroupOwner(element: Element): Element | null {
    const group = element.closest(tag('radio-group'));
    if (!group) return null;
    let topLevelChild = element;
    while (topLevelChild.parentElement && topLevelChild.parentElement !== group) {
      topLevelChild = topLevelChild.parentElement;
    }
    if (topLevelChild.parentElement !== group) return null;
    const slot = topLevelChild.getAttribute('slot');
    return slot === 'label' || slot === 'hint' || slot === 'error' ? null : group;
  }

  /** @internal Whether this group owns the radio through its default option slot. */
  ownsRadio(element: Element): element is LyraRadio {
    return RADIO_TAGS().includes(element.localName) && this.radioGroupOwner(element) === this;
  }

  private radios(): LyraRadio[] {
    return [...this.querySelectorAll(RADIO_TAGS().join(','))].filter((radio) => this.ownsRadio(radio)) as LyraRadio[];
  }
  private syncRadios(preferred?: LyraRadio): void {
    if (this.syncingRadios) return;
    this.syncingRadios = true;
    try {
      const radios = this.radios();
      const current = new Set(radios);
      this.releaseRadios([...this.managedRadios].filter((radio) => !current.has(radio)));
      for (const radio of radios) {
        radio.setGroupOwner(this);
        if (!this.managedRadios.has(radio)) {
          this.authorNames.set(radio, radio.name);
        }
      }
      this.managedRadios = current;
      for (const radio of radios) radio.setGroupDisabled(this.disabled);
      const enabled = radios.filter((radio) => !radio.effectiveDisabled);
      const checked = radios.filter((radio) => radio.checked);
      const checkedRadio = preferred?.checked && current.has(preferred)
        ? preferred
        : checked[checked.length - 1];
      for (const radio of checked) {
        if (radio !== checkedRadio) radio.checked = false;
      }
      const validityOwner = checkedRadio ?? enabled[0];
      for (const radio of radios) {
        radio.name = this.name || this.authorNames.get(radio) || '';
        radio.setGroupRequired(this.required && radio === validityOwner);
        radio.setGroupTabbable(checkedRadio ? radio === checkedRadio : radio === enabled[0]);
      }
    } finally {
      this.syncingRadios = false;
    }
  }
  private releaseRadios(radios: Iterable<LyraRadio>): void {
    for (const radio of radios) {
      const authorName = this.authorNames.get(radio) ?? radio.name;
      this.authorNames.delete(radio);
      radio.releaseGroupOwner(this, authorName);
    }
  }
  /** @internal Reconciles one radio's synchronous DOM reparenting before observer delivery. */
  reconcileRadio(radio: LyraRadio): boolean {
    if (!this.ownsRadio(radio)) return false;
    this.syncRadios(radio.checked ? radio : undefined);
    return true;
  }
  /** @internal Releases one radio before a previous group's observer sees its removal. */
  releaseRadio(radio: LyraRadio): void {
    if (!this.managedRadios.has(radio) && !this.authorNames.has(radio)) return;
    this.releaseRadios([radio]);
    this.managedRadios.delete(radio);
    this.syncRadios();
  }
  /** @internal Reconciles silent programmatic, reset, and restored checked-state changes. */
  radioCheckedChanged(radio: LyraRadio): void {
    if (this.syncingRadios || !this.ownsRadio(radio)) return;
    this.syncRadios(radio.checked ? radio : undefined);
  }
  /** @internal */
  selectRadio(radio: LyraRadio): boolean {
    if (this.disabled || radio.effectiveDisabled || !this.ownsRadio(radio)) return false;
    this.syncingRadios = true;
    try {
      for (const candidate of this.radios()) candidate.checked = candidate === radio;
    } finally {
      this.syncingRadios = false;
    }
    this.syncRadios();
    dispatchNativeEvent(this, 'input');
    this.emit('lr-input', { value: radio.value, radio });
    dispatchNativeEvent(this, 'change');
    this.emit('lr-change', { value: radio.value, radio });
    return true;
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
    // Route through the radio's own activation path, not selectRadio() directly: that path is
    // what emits `input`/`change`. Committing here instead would fire only the group's
    // `lr-change`, so a consumer bound to the native-mirroring events would miss every keyboard
    // selection while still receiving them for click and Space. Native <input type=radio> fires
    // both on arrow navigation.
    next.activateFromGroup();
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
        aria-required=${this.required ? 'true' : 'false'}
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
