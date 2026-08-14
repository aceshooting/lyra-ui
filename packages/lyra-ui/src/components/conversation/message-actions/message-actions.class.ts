import { html, nothing, svg, type PropertyValues, type SVGTemplateResult, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { composedParentElement } from '../../../internal/active-element.js';
import '../../utility/copy-button/copy-button.class.js';
import '../message-feedback/message-feedback.class.js';

import { styles } from './message-actions.styles.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  collectComposedFocusTargets,
  isActionableElement,
  isSemanticActionElement,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { composedContains } from '../../../internal/overlay-manager.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_editMessage, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_messageActionsLabel, LYRA_DEFAULT_regenerateResponse } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export type MessageActionControl = 'copy' | 'regenerate' | 'edit' | 'feedback';

export interface LyraMessageActionsEventMap {
  'lr-regenerate': CustomEvent<undefined>;
  'lr-edit': CustomEvent<undefined>;
  'lr-copy': CustomEvent<{ text: string }>;
  'lr-change': CustomEvent<{ value: 'up' | 'down' | null }>;
  'lr-submit': CustomEvent<{ value: 'up' | 'down'; reasonIds: string[]; comment: string }>;
}

// Mirrors the shared icon set's viewBox/stroke conventions (internal/icons.ts's
// chevronIcon()/closeIcon()/etc.) without adding regenerate/edit glyphs to that module -- it's off
// limits here -- so these one-off icons still read as part of the same visual language as the rest of
// the library's inline icons. Same approach lr-chat-message's/lr-chat-composer's/
// lr-conversation-item's own local glyphs take for the identical reason.
function regenerateIcon(): SVGTemplateResult {
  return svg`
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <polyline points="23 4 23 10 17 10"></polyline>
      <polyline points="1 20 1 14 7 14"></polyline>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
    </svg>
  `;
}

function editIcon(): SVGTemplateResult {
  return svg`
    <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 20h9"></path>
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path>
    </svg>
  `;
}

/**
 * `<lr-message-actions>` — the per-message action toolbar for `<lr-chat-message>`'s `actions`
 * slot: opt-in built-ins (copy / regenerate / edit / feedback) that emit intent events, plus a
 * default slot for custom controls (e.g. a slotted `<lr-branch-picker>`). It performs nothing
 * itself except the copy.
 *
 * `[part="base"]` is `role="toolbar"` with the WAI-ARIA APG roving-tabindex pattern applied to the
 * plain `<button>` elements this component renders itself (`regenerate`/`edit`); ArrowLeft/ArrowRight
 * (swapped under `effectiveDirection === 'rtl'`) plus Home/End move focus across *every actual
 * action* -- built-ins and slotted controls alike. Open shadow roots and slots are traversed in
 * composed order, so both feedback thumbs and both enabled branch-picker buttons are independent
 * stops rather than one custom-element placeholder. Composite children are reconciled after their
 * own Lit updates so the toolbar retains exactly one sequential Tab stop. Disabled, hidden,
 * `aria-hidden`, and inert controls (including a control beneath an unavailable composed ancestor)
 * are excluded before choosing that stop, because inert targets silently refuse `.focus()` and
 * would otherwise strand arrow navigation. Availability, actionability, and `tabindex` mutations
 * are reconciled live. A former stop is cleared, and if it held focus, focus moves to the nearest
 * survivor or the stable toolbar without overriding a newer external focus move.
 *
 * @customElement lr-message-actions
 * @slot - Additional controls (e.g. `lr-copy-button`, `lr-icon-button`, `lr-branch-picker`)
 *   appended after the built-ins; they participate in the toolbar's arrow-key navigation.
 * @event lr-regenerate - The regenerate built-in was activated. No detail.
 * @event lr-edit - The edit built-in was activated: a *request* to edit; the host swaps the message
 *   body for its own editor.
 * @event lr-copy - `detail: { text }`, surfaced by the embedded `lr-copy-button` (bubbles +
 *   composed already; not re-emitted, so exactly one event reaches a host listener).
 * @event lr-change - Bubbles unchanged from the embedded, thumbs-only `lr-message-feedback`.
 *   `detail: { value }`.
 * @event lr-submit - Only arises from a slotted, fully-configured `lr-message-feedback` (the
 *   built-in is thumbs-only and never opens a panel) -- also bubbles unchanged.
 * @csspart base - The toolbar (`role="toolbar"`).
 * @csspart copy-button - The embedded `lr-copy-button`.
 * @csspart regenerate-button - The built-in regenerate icon button.
 * @csspart edit-button - The built-in edit icon button.
 * @csspart feedback - The embedded `lr-message-feedback`.
 * @status stable
 * @since 4.0.0
 */
export class LyraMessageActions extends LyraElement<LyraMessageActionsEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    editMessage: LYRA_DEFAULT_editMessage,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    messageActionsLabel: LYRA_DEFAULT_messageActionsLabel,
    regenerateResponse: LYRA_DEFAULT_regenerateResponse,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  /** Which built-ins render, in display order. */
  @property({ attribute: false }) controls: MessageActionControl[] = [];

  /** What the `copy` built-in copies. Required for it to render at all -- this component never
   *  interprets the slotted message body itself. */
  @property({ attribute: 'copy-text' }) copyText = '';

  /** Forwarded to the embedded `lr-message-feedback` when the `feedback` built-in is enabled. The
   *  built-in stays thumbs-only: `reasons`/`commentable`/`detailFor` are never forwarded, so its
   *  detail panel never opens. */
  @property({ attribute: 'feedback-value' }) feedbackValue: 'up' | 'down' | null = null;

  /** Visually hides the bar until the enclosing message is hovered or any control inside has focus. */
  @property({ type: Boolean, reflect: true, attribute: 'reveal-on-hover' }) revealOnHover = false;

  /** Accessible name for the toolbar. Defaults to the localized `messageActionsLabel`. */
  @property() label = '';

  /** Overrides the toolbar's computed accessible name. Wins over `label` and the localized
   *  default. Attribute-reflects from a host-level `aria-label` so a plain-markup consumer gets
   *  ARIA-name forwarding without setting a JS property. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @state() private activeStopIndex = 0;
  /** Drives the `data-revealed` host attribute (toggled imperatively in `updated()`, not via a Lit
   *  template binding -- `lr-graph`'s `data-hovered` attribute is the precedent for this exact
   *  technique) while `revealOnHover` is active. CSS alone cannot key `:host`'s own opacity off the
   *  ancestor `lr-chat-message`'s hover state from inside this component's own shadow DOM, so the
   *  reveal state is tracked in JS instead (see `bindHoverTarget()`). */
  @state() private revealed = false;

  private hoverTarget: HTMLElement | null = null;
  private stopSyncGeneration = 0;
  private stopObserver?: MutationObserver;
  private managedStops = new Set<HTMLElement>();
  private authoredTabIndex = new WeakMap<HTMLElement, string | null>();
  private focusedStop?: {
    index: number;
    repair: ComposedFocusRepairSnapshot;
    stop: HTMLElement;
  };

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('focusin', this.onFocusIn);
    this.addEventListener('focusout', this.onFocusOut);
    if (this.revealOnHover) this.bindHoverTarget();
    if (this.hasUpdated) void this.reconcileStopsAfterChildren();
  }

  override disconnectedCallback(): void {
    this.stopSyncGeneration++;
    this.stopObserver?.disconnect();
    this.stopObserver = undefined;
    this.focusedStop = undefined;
    this.unbindHoverTarget();
    this.removeEventListener('focusin', this.onFocusIn);
    this.removeEventListener('focusout', this.onFocusOut);
    super.disconnectedCallback();
  }

  adoptedCallback(): void {
    this.stopSyncGeneration++;
    this.stopObserver?.disconnect();
    this.stopObserver = undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('revealOnHover')) {
      if (this.revealOnHover) this.bindHoverTarget();
      else this.unbindHoverTarget();
    }
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.setActiveStop(this.focusableStops(), 0);
    void this.reconcileStopsAfterChildren();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('controls')) {
      const stops = this.focusableStops();
      this.setActiveStop(stops, Math.min(this.activeStopIndex, Math.max(0, stops.length - 1)));
      void this.reconcileStopsAfterChildren();
    }
    if (changed.has('revealed')) {
      // Toggled on the host itself (not a shadow-internal part) so the stylesheet's `:host(...)`
      // rules can key off it directly -- same imperative-attribute-toggle technique lr-graph's
      // `data-hovered` attribute already establishes for hover-driven presentation state.
      this.toggleAttribute('data-revealed', this.revealed);
    }
  }

  private bindHoverTarget(): void {
    this.unbindHoverTarget();
    const target = (this.closest('lr-chat-message') as HTMLElement | null) ?? this.parentElement;
    if (!target) return;
    this.hoverTarget = target;
    target.addEventListener('pointerenter', this.onHoverTargetEnter);
    target.addEventListener('pointerleave', this.onHoverTargetLeave);
  }

  private unbindHoverTarget(): void {
    this.hoverTarget?.removeEventListener('pointerenter', this.onHoverTargetEnter);
    this.hoverTarget?.removeEventListener('pointerleave', this.onHoverTargetLeave);
    this.hoverTarget = null;
    this.revealed = false;
  }

  private onHoverTargetEnter = (): void => {
    this.revealed = true;
  };

  private onHoverTargetLeave = (): void => {
    if (!this.matches(':focus-within')) this.revealed = false;
  };

  private onFocusIn = (event: Event): void => {
    this.revealed = true;
    const stops = this.focusableStops();
    const path = event.composedPath();
    const index = stops.findIndex((stop) => path.includes(stop));
    if (index >= 0) {
      const origin = path[0] as Partial<HTMLElement> | undefined;
      const focused = origin?.nodeType === 1 && typeof origin.focus === 'function'
        ? origin as HTMLElement
        : undefined;
      this.setActiveStop(stops, index, focused);
      const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
      const stop = focused && stops.includes(focused) ? focused : stops[index];
      const repair = stop && base ? captureComposedFocusRepair(stop, base) : null;
      this.focusedStop = stop && repair ? { index, repair, stop } : undefined;
    } else {
      this.focusedStop = undefined;
    }
  };

  private onFocusOut = (event: Event): void => {
    if (!this.hoverTarget?.matches(':hover')) this.revealed = false;
    const destination = (event as FocusEvent).relatedTarget;
    if (
      destination
      && (destination as Node).nodeType === 1
      && !composedContains(this, destination as Element)
    ) {
      this.focusedStop = undefined;
    }
  };

  private focusableStops(): HTMLElement[] {
    const base = this.renderRoot.querySelector('[part="base"]');
    if (!base) return [];
    return collectComposedFocusTargets(base, {
      mode: 'programmatic',
      includeRoot: false,
    }).elements.filter((stop) =>
      Boolean(isSemanticActionElement(stop))
      || (this.authoredTabIndex.has(stop)
        ? this.authoredTabIndex.get(stop) !== null
        : stop.hasAttribute('tabindex')));
  }

  /** Immediate rendered children plus flattened slotted roots whose Lit updates can create the
   * actual nested actions returned by `focusableStops()`. */
  private actionRoots(): Element[] {
    const base = this.renderRoot.querySelector('[part="base"]');
    if (!base) return [];
    const direct = [...base.children].filter((element) => element.localName !== 'slot');
    const slot = base.querySelector<HTMLSlotElement>('slot');
    return [...direct, ...(slot?.assignedElements({ flatten: true }) ?? [])];
  }

  private setActiveStop(stops: HTMLElement[], index: number, preferred?: HTMLElement): void {
    this.stopObserver?.disconnect();
    for (const stop of stops) {
      if (!this.authoredTabIndex.has(stop)) {
        this.authoredTabIndex.set(stop, stop.getAttribute('tabindex'));
      }
    }
    for (const previous of this.managedStops) {
      if (!stops.includes(previous) && (previous.hasAttribute('tabindex') || Boolean(isActionableElement(previous)))) {
        previous.tabIndex = -1;
      }
    }
    const preferredIndex = preferred ? stops.indexOf(preferred) : -1;
    this.activeStopIndex = stops.length === 0
      ? 0
      : preferredIndex >= 0
        ? preferredIndex
        : Math.min(Math.max(0, index), stops.length - 1);
    stops.forEach((stop, stopIndex) => {
      stop.tabIndex = stopIndex === this.activeStopIndex ? 0 : -1;
    });
    this.managedStops = new Set(stops);
    this.observeStopChanges(stops);
  }

  private observeStopChanges(stops: HTMLElement[]): void {
    this.stopObserver?.disconnect();
    const Observer = this.ownerDocument.defaultView?.MutationObserver;
    const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
    if (!Observer || !base || !this.isConnected) {
      this.stopObserver = undefined;
      return;
    }
    const observer = new Observer(this.onStopMutations);
    const roots = new Set<Node>([base, ...this.actionRoots()]);
    for (const stop of stops) {
      let current: Element | null = stop;
      while (current && current !== this) {
        const root = current.getRootNode();
        if (root.nodeType === 11 && 'host' in root) roots.add(root);
        current = composedParentElement(current);
      }
    }
    const options: MutationObserverInit = {
      attributes: true,
      attributeOldValue: true,
      attributeFilter: [
        'aria-disabled',
        'aria-hidden',
        'contenteditable',
        'controls',
        'disabled',
        'hidden',
        'href',
        'inert',
        'open',
        'role',
        'tabindex',
        'type',
      ],
      childList: true,
      subtree: true,
    };
    for (const root of roots) observer.observe(root, options);
    this.stopObserver = observer;
  }

  private onStopMutations = (records: MutationRecord[]): void => {
    for (const record of records) {
      if (record.type !== 'attributes' || record.attributeName !== 'tabindex') continue;
      const target = record.target as HTMLElement;
      if (this.authoredTabIndex.has(target)) {
        this.authoredTabIndex.set(target, target.getAttribute('tabindex'));
      }
    }
    void this.reconcileStopsAfterChildren();
  };

  private async reconcileStopsAfterChildren(): Promise<void> {
    const generation = ++this.stopSyncGeneration;
    const pending = this.actionRoots()
      .map((root) => (root as Element & { updateComplete?: Promise<unknown> }).updateComplete)
      .filter(
        (value): value is Promise<unknown> =>
          value !== undefined && typeof (value as PromiseLike<unknown>).then === 'function',
      );
    await Promise.all(pending);
    await Promise.resolve();
    if (generation !== this.stopSyncGeneration || !this.isConnected) return;
    const stops = this.focusableStops();
    const focused = this.focusedStop;
    const retainedIndex = focused ? stops.indexOf(focused.stop) : -1;
    const targetIndex = retainedIndex >= 0
      ? retainedIndex
      : focused
        ? Math.min(Math.max(0, focused.index), Math.max(0, stops.length - 1))
        : Math.min(this.activeStopIndex, Math.max(0, stops.length - 1));
    this.setActiveStop(stops, targetIndex);
    if (focused && retainedIndex < 0) {
      const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
      applyComposedFocusRepair(focused.repair, stops[targetIndex] ?? base ?? null);
      if (this.focusedStop === focused) this.focusedStop = undefined;
    }
  }

  private onSlotChange = (): void => {
    const stops = this.focusableStops();
    this.setActiveStop(stops, Math.min(this.activeStopIndex, Math.max(0, stops.length - 1)));
    void this.reconcileStopsAfterChildren();
  };

  private onToolbarKeyDown = (e: KeyboardEvent): void => {
    const stops = this.focusableStops();
    if (stops.length === 0) return;
    const originIndex = stops.findIndex((stop) => e.composedPath().includes(stop));
    const currentIndex = originIndex >= 0 ? originIndex : this.activeStopIndex;
    const forwardKey = this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey = this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let target: number;
    if (e.key === forwardKey) target = (currentIndex + 1) % stops.length;
    else if (e.key === backwardKey) target = (currentIndex - 1 + stops.length) % stops.length;
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = stops.length - 1;
    else return;
    e.preventDefault();
    this.setActiveStop(stops, target);
    stops[target]?.focus();
  };

  private onRegenerateClick = (): void => {
    this.emit('lr-regenerate');
  };

  private onEditClick = (): void => {
    this.emit('lr-edit');
  };

  private renderControl(type: MessageActionControl) {
    switch (type) {
      case 'copy':
        return this.copyText
          ? html`<lr-copy-button part="copy-button" .value=${this.copyText}></lr-copy-button>`
          : nothing;
      case 'regenerate':
        return html`<button
          part="regenerate-button"
          type="button"
          aria-label=${this.localize('regenerateResponse')}
          @click=${this.onRegenerateClick}
        >
          ${regenerateIcon()}
        </button>`;
      case 'edit':
        return html`<button
          part="edit-button"
          type="button"
          aria-label=${this.localize('editMessage')}
          @click=${this.onEditClick}
        >
          ${editIcon()}
        </button>`;
      case 'feedback':
        return html`<lr-message-feedback part="feedback" .value=${this.feedbackValue}></lr-message-feedback>`;
      default:
        return nothing;
    }
  }

  override render(): TemplateResult {
    const label = this.accessibleLabel || this.label || this.localize('messageActionsLabel');
    return html`
      <div part="base" role="toolbar" aria-label=${label} tabindex="-1" @keydown=${this.onToolbarKeyDown}>
        ${this.controls.map((type) => this.renderControl(type))}
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-message-actions': LyraMessageActions;
  }
}
