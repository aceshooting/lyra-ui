import { html, svg, type SVGTemplateResult, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import {
  markOptionSelectedDirty,
  RESET_OPTION_SELECTED_FROM_OWNER,
  SET_OPTION_SELECTED_FROM_OWNER,
} from '../../../internal/option-selection.js';
import { styles } from './option.styles.js';

const GLYPH_VIEW_BOX = '0 0 24 24';
const GLYPH_STROKE_WIDTH = '1.75';

function checkmarkGlyph(): SVGTemplateResult {
  return svg`
    <svg
      width="1em"
      height="1em"
      viewBox=${GLYPH_VIEW_BOX}
      fill="none"
      stroke="currentColor"
      stroke-width=${GLYPH_STROKE_WIDTH}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    ><polyline points="5 12.5 10 17.5 19 6.5"></polyline></svg>
  `;
}

export interface LyraOptionEventMap {
  'lr-option-change': CustomEvent<undefined>;
}

/**
 * `<lr-option>` — a selectable option for `<lr-combobox>` and `<lr-select>`.
 * Mirrors `<wa-option>` and `<sl-option>`. It acts as the data source for Lyra's
 * built-in pickers, which render their interactive rows in their own shadow roots.
 *
 * The effective `label` is an explicit non-empty `label` property/attribute when supplied,
 * otherwise `defaultLabel`, the normalized plain text of the default slot. Named adornment slots
 * never leak into either `defaultLabel` or Shoelace's `getTextLabel()` compatibility method.
 *
 * Selection follows the native live/default split. The `selected` attribute initializes
 * `defaultSelected`, which parent controls use as their `form.reset()` baseline; property writes
 * to `defaultSelected` intentionally do not reflect. `selected` is independent property-only live
 * state, so a user pick never rewrites the declarative default. A later default change updates a
 * pristine live option, but never clobbers a live selection that has already become dirty.
 *
 * @customElement lr-option
 * @slot - The option's visible label.
 * @slot start - WA-compatible leading adornment.
 * @slot end - WA-compatible trailing adornment.
 * @slot prefix - Shoelace-compatible alias for `start`.
 * @slot suffix - Shoelace-compatible alias for `end`.
 * @event lr-option-change - The option's label or selectable data changed. The parent combobox
 *   or select consumes this bubbling event to refresh its normalized option rows.
 * @csspart base - The option's outer visual wrapper.
 * @csspart checked-icon - The decorative checkmark shown while selected.
 * @csspart label - The default-slot label wrapper.
 * @csspart start - The WA-compatible leading-adornment wrapper; the same node as `prefix`.
 * @csspart end - The WA-compatible trailing-adornment wrapper; the same node as `suffix`.
 * @csspart prefix - The Shoelace-compatible leading-adornment wrapper; the same node as `start`.
 * @csspart suffix - The Shoelace-compatible trailing-adornment wrapper; the same node as `end`.
 * @cssstate current - The option is the roving-focus target (the keyboard-highlighted option).
 * @cssstate selected - The option's live `selected` property is true.
 * @cssstate disabled - The option is disabled.
 * @cssstate hover - The pointer is over the option, including pointer-drag sessions.
 * @cssprop [--current-text-color=var(--lr-color-text)] - Text color while the option is `current`.
 * @method getTextLabel - Returns the normalized plain text of the default-slot content.
 * @status stable
 * @since 4.0.0
 */
export class LyraOption extends LyraElement<LyraOptionEventMap> {
  static override styles = [LyraElement.styles, styles];

  private readonly slotPresence = new SlotPresenceController(this);
  private readonly optionInternals = attachInternalsSafely(this);
  private hasHover = false;
  private hasCurrent = false;
  private _label = '';
  private selectedValue = false;
  private defaultSelectedValue = false;
  private selectedDirty = false;

  /** The selection key submitted with the form. */
  @property({ reflect: true }) value = '';

  /** Disable selecting this option. */
  @property({ type: Boolean }) disabled = false;

  /** Whether this option is currently selected. Parent controls write this live, property-only
   * state without changing `defaultSelected` or the declarative reset attribute.
   * @default false */
  @property({ type: Boolean, attribute: false })
  get selected(): boolean {
    return this.selectedValue;
  }
  set selected(next: boolean) {
    this.setLiveSelected(next, true);
  }

  /** Declarative/reset selection default supplied by the `selected` attribute. Property writes
   * intentionally do not reflect. A write updates the live state only until `selected` has been
   * written independently, and notifies the parent to update its `form.reset()` baseline.
   * @default false */
  @property({ type: Boolean, attribute: 'selected' })
  get defaultSelected(): boolean {
    return this.defaultSelectedValue;
  }
  set defaultSelected(next: boolean) {
    const normalized = Boolean(next);
    const old = this.defaultSelectedValue;
    if (old === normalized) return;
    this.defaultSelectedValue = normalized;
    if (!this.selectedDirty) this.setLiveSelected(normalized, false);
    this.requestUpdate('defaultSelected', old);
  }

  private setLiveSelected(next: boolean, dirty: boolean): void {
    if (dirty) {
      this.selectedDirty = true;
      markOptionSelectedDirty(this, true);
    }
    const normalized = Boolean(next);
    const old = this.selectedValue;
    if (old === normalized) return;
    this.selectedValue = normalized;
    this.requestUpdate('selected', old);
  }

  /** Lets an owning picker synchronize live selectedness without turning that synchronization
   * into a consumer `selected` IDL write. @internal */
  [SET_OPTION_SELECTED_FROM_OWNER](next: boolean): void {
    this.setLiveSelected(next, false);
  }

  /** Clears selectedness dirtyness at form reset and restores the owner's reset selection.
   * @internal */
  [RESET_OPTION_SELECTED_FROM_OWNER](next: boolean): void {
    this.selectedDirty = false;
    markOptionSelectedDirty(this, false);
    this.setLiveSelected(next, false);
  }

  /** Optional section header this option belongs under. */
  @property() group = '';

  /** Extra text the filter should match beyond the label. */
  @property({ attribute: 'search-text' }) searchText = '';

  /** Optional secondary line rendered under the label (e.g. a status/date summary). */
  @property() sub = '';

  /** Optional color for a small leading status dot (any valid CSS color). */
  @property({ attribute: 'dot-color' }) dotColor = '';

  /**
   * The option's effective plain-text label. An explicit non-empty property/attribute wins;
   * otherwise this resolves to {@link defaultLabel}. Property writes intentionally do not reflect.
   */
  @property()
  get label(): string {
    return this._label.trim() || this.defaultLabel;
  }
  set label(next: string) {
    const normalized = String(next ?? '');
    const old = this._label;
    if (old === normalized) return;
    this._label = normalized;
    this.requestUpdate('label', old);
  }

  /** Plain-text label generated from default-slot content, excluding every named adornment slot. */
  get defaultLabel(): string {
    if (typeof Node === 'undefined' || !('childNodes' in this)) return '';
    return Array.from(this.childNodes)
      .filter((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return true;
        return !(node as Element).getAttribute('slot');
      })
      .map((node) => node.textContent ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private labelObserver?: MutationObserver;

  private readonly handlePointerEnter = (): void => {
    this.hasHover = true;
    this.syncOptionState();
  };

  private readonly handlePointerLeave = (): void => {
    this.hasHover = false;
    this.syncOptionState();
  };

  private readonly handleFocusIn = (): void => {
    this.hasCurrent = true;
    this.syncOptionState();
  };

  private readonly handleFocusOut = (): void => {
    this.hasCurrent = false;
    this.syncOptionState();
  };

  private readonly handleLabelMutation = (): void => {
    // `slotchange` does not fire when an already-assigned node mutates its own text. This update
    // lets the slot-presence controller recompute empty adornment wrappers in that case too.
    this.requestUpdate();
    this.emit('lr-option-change');
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('pointerenter', this.handlePointerEnter);
    this.addEventListener('pointerleave', this.handlePointerLeave);
    this.addEventListener('focusin', this.handleFocusIn);
    this.addEventListener('focusout', this.handleFocusOut);
    this.syncOptionState();
    // `defaultLabel` derives from light-DOM content, so direct text mutations need their own
    // observer to notify a parent combobox/select that its cached row data is stale.
    this.labelObserver = new MutationObserver(this.handleLabelMutation);
    this.labelObserver.observe(this, {
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('pointerenter', this.handlePointerEnter);
    this.removeEventListener('pointerleave', this.handlePointerLeave);
    this.removeEventListener('focusin', this.handleFocusIn);
    this.removeEventListener('focusout', this.handleFocusOut);
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    this.hasHover = false;
    this.hasCurrent = false;
    this.syncOptionState();
  }

  protected override updated(changed: PropertyValues): void {
    if (changed.has('disabled') && this.disabled) this.hasCurrent = false;
    this.syncOptionState();
    // `selected` is deliberately excluded -- the parent combobox/select
    // already sets `selected` itself as *part of* rendering the current
    // selection, so echoing that back as a `lr-option-change` notification
    // would trigger a redundant re-render on every selection change, rather
    // than signal a genuine "this option's own data changed externally".
    if (
      changed.has('value') ||
      changed.has('disabled') ||
      changed.has('group') ||
      changed.has('searchText') ||
      changed.has('sub') ||
      changed.has('dotColor') ||
      changed.has('label') ||
      changed.has('defaultSelected')
    ) {
      this.emit('lr-option-change');
    }
  }

  private syncOptionState(): void {
    // ElementInternals supplies default semantics without taking ownership of consumer-authored
    // role/ARIA content attributes, which remain able to override these values.
    this.optionInternals.role = 'option';
    this.optionInternals.ariaSelected = this.selected ? 'true' : 'false';
    this.optionInternals.ariaDisabled = this.disabled ? 'true' : 'false';
    setCustomState(this.optionInternals, 'current', this.hasCurrent && !this.disabled);
    setCustomState(this.optionInternals, 'selected', this.selected);
    setCustomState(this.optionInternals, 'disabled', this.disabled);
    setCustomState(this.optionInternals, 'hover', this.hasHover && !this.disabled);
  }

  /** Returns a plain-text label generated from the default-slot content. */
  getTextLabel(): string {
    return this.defaultLabel;
  }

  override render(): TemplateResult {
    const hasStart = this.slotPresence.has('start') || this.slotPresence.has('prefix');
    const hasEnd = this.slotPresence.has('end') || this.slotPresence.has('suffix');
    return html`
      <div part="base">
        <span part="checked-icon" aria-hidden="true" ?hidden=${!this.selected}>
          ${checkmarkGlyph()}
        </span>
        <span part="start prefix" aria-hidden="true" ?hidden=${!hasStart}>
          <slot name="start"></slot><slot name="prefix"></slot>
        </span>
        <span part="label"><slot></slot></span>
        <span part="end suffix" aria-hidden="true" ?hidden=${!hasEnd}>
          <slot name="end"></slot><slot name="suffix"></slot>
        </span>
      </div>
    `;
  }
}


declare global {
  interface HTMLElementTagNameMap {
    'lr-option': LyraOption;
  }
}
