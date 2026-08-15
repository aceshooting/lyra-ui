import { html, svg, type SVGTemplateResult, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { attachInternalsSafely } from '../../../internal/form-associated.js';
import { SlotPresenceController } from '../../../internal/slot-presence-controller.js';
import {
  composedParentElement,
  isAccessibilitySubtreeExcluded,
  isAccessibilityVisibilityHidden,
} from '../../../internal/a11y.js';
import { composedAccessibilityText } from '../../../internal/accessibility-visibility.js';
import {
  markOptionSelectedDirty,
  RESET_OPTION_SELECTED_FROM_OWNER,
  SET_OPTION_SELECTED_FROM_OWNER,
} from '../../../internal/option-selection.js';
import { styles } from './option.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


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
  'lr-option-change': CustomEvent<null>;
}

/**
 * `<lr-option>` — a selectable option for `<lr-combobox>` and `<lr-select>`.
 * Mirrors `<wa-option>` and `<sl-option>`. It acts as the data source for Lyra's
 * built-in pickers, which render their interactive rows in their own shadow roots.
 *
 * The effective `label` is an explicit non-empty `label` property/attribute when supplied,
 * otherwise `defaultLabel`, the normalized accessible text of the flattened default slot. Hidden
 * subtrees are excluded, visible nested `aria-label` values replace their descendants, and named
 * adornment slots never leak into either `defaultLabel` or Shoelace's `getTextLabel()` method.
 *
 * Selection follows the native live/default split. The `selected` attribute initializes
 * `defaultSelected`, which parent controls use as their `form.reset()` baseline; property writes
 * to `defaultSelected` intentionally do not reflect. `selected` is independent property-only live
 * state, so a user pick never rewrites the declarative default. A later default change updates a
 * pristine live option, but never clobbers a live selection that has already become dirty.
 * In a constrained option row the default label ellipsizes, while each `start`/`end` adornment is
 * capped at 40% of the row so unbroken consumer content cannot widen the owning listbox.
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
 * @cssprop [--lr-option-hover-bg=var(--lr-color-brand-quiet)] - Hover background.
 * @cssprop [--lr-option-active-bg=color-mix(in oklab, var(--lr-option-hover-bg, var(--lr-color-brand-quiet)), var(--lr-color-mix-partner) var(--lr-color-mix-active))] - Pressed background.
 * @cssprop [--lr-option-current-bg=var(--lr-color-brand-quiet)] - Keyboard-current background.
 * @cssprop [--lr-option-current-color=var(--current-text-color, var(--lr-color-text))] -
 * Keyboard-current text color; the upstream `--current-text-color` remains its fallback.
 * @cssprop [--lr-option-selected-font-weight=var(--lr-font-weight-semibold)] - Selected label weight.
 * @cssprop [--lr-option-checked-icon-color=var(--lr-color-brand)] - Selected checkmark color.
 * @method getTextLabel - Returns the normalized accessibility-visible text of the default slot.
 * @status stable
 * @since 4.0.0
 */
export class LyraOption extends LyraElement<LyraOptionEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
  };
  // GENERATED DEFAULT-STRING SLICE: END

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
  @property({ type: Boolean, reflect: true }) disabled = false;

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

  /** Accessible text generated from flattened default-slot content, excluding named adornments. */
  get defaultLabel(): string {
    if (!('childNodes' in this)) return '';
    const roots = Array.from(this.childNodes ?? []).filter((node) => this.isDefaultLabelNode(node));
    // Pickers deliberately project option hosts through a hidden data-source slot. Direct roots
    // remain readable there; composed exposure begins only when a forwarding slot crosses into
    // consumer-owned content.
    return composedAccessibilityText(roots, {
      requireRendered: false,
      shouldPruneNode: (node) => !this.contains(node) && !this.isSourceLabelVisible(node),
      skipRootAncestorValidation: true,
    })
      .replace(/\s+/g, ' ')
      .trim();
  }

  private labelObserver?: MutationObserver;
  private observedDefaultLabel = '';

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
    const next = this.defaultLabel;
    this.requestUpdate();
    if (next === this.observedDefaultLabel) return;
    this.observedDefaultLabel = next;
    this.emit('lr-option-change');
  };

  private isDefaultLabelNode(node: Node): boolean {
    if (node.nodeType !== 1) return true;
    const slotName = (node as Element).getAttribute('slot');
    return slotName === null || slotName === '';
  }

  private labelForwardingSlots(): HTMLSlotElement[] {
    return Array.from(this.querySelectorAll<HTMLSlotElement>('slot')).filter((slot) => {
      let top: Node = slot;
      while (top.parentNode && top.parentNode !== this) top = top.parentNode;
      return top.parentNode === this && this.isDefaultLabelNode(top);
    });
  }

  private observeLabelNode(node: Node): void {
    if (!this.labelObserver) return;
    if (node.nodeType === 3) {
      this.labelObserver.observe(node, { characterData: true });
      return;
    }
    if (node.nodeType !== 1) return;
    this.labelObserver.observe(node, {
      attributes: true,
      attributeFilter: [
        'aria-hidden',
        'aria-label',
        'aria-labelledby',
        'alt',
        'class',
        'hidden',
        'inert',
        'id',
        'open',
        'slot',
        'style',
      ],
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  private composedParentForLabelNode(node: Node): Element | null {
    const assignedSlot = (node as Node & { assignedSlot?: HTMLSlotElement | null }).assignedSlot;
    if (assignedSlot) return assignedSlot;
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode() as Document | ShadowRoot;
    return 'host' in root && root.host.nodeType === 1 ? root.host : null;
  }

  /** The consumer-owned ancestry where forwarded content was authored. Unlike the composed parent
   * walk used to bind observers, this deliberately ignores `assignedSlot`: a picker projects its
   * option through an internal `<slot hidden>` as a data source, and that implementation detail
   * must not erase the option's label. */
  private sourceParentForLabelNode(node: Node): Element | null {
    if (node.parentElement) return node.parentElement;
    const root = node.getRootNode() as Document | ShadowRoot;
    return 'host' in root && root.host.nodeType === 1 ? root.host : null;
  }

  private isClosedSourceDetailsBranch(details: Element, branch: Element | null): boolean {
    if (details.localName !== 'details' || details.hasAttribute('open') || branch === null) {
      return false;
    }
    const summary = Array.from(details.children).find((child) => child.localName === 'summary');
    return branch !== summary;
  }

  /** Whether a forwarded root is exposed in its authored/source tree. Computed visibility on the
   * root already includes inherited `visibility` (and any descendant restoration); hard-hidden
   * ancestors and closed-details branches are then walked without following picker-owned slots. */
  private isSourceLabelVisible(node: Node): boolean {
    const target = node.nodeType === 1 ? (node as Element) : this.sourceParentForLabelNode(node);
    if (!target?.isConnected) return false;
    if (
      isAccessibilitySubtreeExcluded(target) ||
      isAccessibilityVisibilityHidden(target)
    ) {
      return false;
    }

    let branch: Element | null = target;
    let ancestor = this.sourceParentForLabelNode(target);
    while (ancestor) {
      if (
        isAccessibilitySubtreeExcluded(ancestor) ||
        this.isClosedSourceDetailsBranch(ancestor, branch)
      ) {
        return false;
      }
      branch = ancestor;
      ancestor = this.sourceParentForLabelNode(ancestor);
    }
    return true;
  }

  private observeLabelAncestors(node: Node): void {
    const observer = this.labelObserver;
    if (!observer) return;
    let ancestor = this.composedParentForLabelNode(node);
    while (ancestor) {
      // `this` and its light-DOM descendants already have one full-subtree registration. Calling
      // observe() again with attribute-only options would replace that registration rather than
      // augment it. Consumer-owned composed ancestors still need their own registration because
      // a wrapper class/style can change an assigned root through `::slotted()` CSS.
      if (ancestor !== this && !this.contains(ancestor)) {
        observer.observe(ancestor, {
          attributes: true,
          attributeFilter: ['aria-hidden', 'class', 'hidden', 'inert', 'open', 'style'],
        });
      }
      ancestor = composedParentElement(ancestor);
    }
  }

  private bindLabelObserverTargets(): void {
    if (!this.labelObserver) return;
    this.labelObserver.disconnect();
    this.observeLabelNode(this);
    for (const slot of this.labelForwardingSlots()) {
      if (slot.assignedNodes().length === 0) continue;
      for (const assigned of slot.assignedNodes({ flatten: true })) {
        this.observeLabelNode(assigned);
        this.observeLabelAncestors(assigned);
      }
    }
  }

  private handleLabelSlotChange = (event: Event): void => {
    const target = event.target as Element | null;
    if (target?.nodeType !== 1 || target.localName !== 'slot') return;
    if (
      target.getRootNode() !== this.renderRoot &&
      !this.labelForwardingSlots().includes(target as HTMLSlotElement)
    ) return;
    this.bindLabelObserverTargets();
    this.handleLabelMutation();
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
    const MutationObserverCtor = this.ownerDocument.defaultView?.MutationObserver;
    this.labelObserver = MutationObserverCtor
      ? new MutationObserverCtor(() => {
          this.bindLabelObserverTargets();
          this.handleLabelMutation();
        })
      : undefined;
    this.addEventListener('slotchange', this.handleLabelSlotChange);
    this.bindLabelObserverTargets();
    this.observedDefaultLabel = this.defaultLabel;
  }

  override disconnectedCallback(): void {
    this.removeEventListener('pointerenter', this.handlePointerEnter);
    this.removeEventListener('pointerleave', this.handlePointerLeave);
    this.removeEventListener('focusin', this.handleFocusIn);
    this.removeEventListener('focusout', this.handleFocusOut);
    this.removeEventListener('slotchange', this.handleLabelSlotChange);
    this.labelObserver?.disconnect();
    this.labelObserver = undefined;
    this.hasHover = false;
    this.hasCurrent = false;
    this.syncOptionState();
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
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

  /** Returns an accessibility-visible label generated from flattened default-slot content. */
  getTextLabel(): string {
    return this.defaultLabel;
  }

  override render(): TemplateResult {
    const hasStart = this.slotPresence.has('start') || this.slotPresence.has('prefix');
    const hasEnd = this.slotPresence.has('end') || this.slotPresence.has('suffix');
    return html`
      <div part="base">
        <span part="checked-icon" aria-hidden="true" inert ?hidden=${!this.selected}>
          ${checkmarkGlyph()}
        </span>
        <span part="start prefix" aria-hidden="true" inert ?hidden=${!hasStart}>
          <slot name="start"></slot><slot name="prefix"></slot>
        </span>
        <span part="label"><slot @slotchange=${this.handleLabelSlotChange}></slot></span>
        <span part="end suffix" aria-hidden="true" inert ?hidden=${!hasEnd}>
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
