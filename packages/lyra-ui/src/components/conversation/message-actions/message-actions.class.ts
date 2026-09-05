import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import {
  html,
  nothing,
  svg,
  type PropertyValues,
  type SVGTemplateResult,
  type TemplateResult,
} from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import {
  getOwnDataDescriptor,
  MISSING_OWN_DATA_DESCRIPTOR,
  UNSAFE_OWN_DATA_DESCRIPTOR,
} from '../../../internal/data-descriptors.js';
import '../../utility/copy-button/copy-button.class.js';
import '../message-feedback/message-feedback.class.js';

import { styles } from './message-actions.styles.js';
import {
  applyComposedFocusRepair,
  captureComposedFocusRepair,
  isComposedFocusAvailable,
  isSemanticActionElement,
  type ComposedFocusRepairSnapshot,
} from '../../../internal/focus-navigation.js';
import { composedContains } from '../../../internal/overlay-manager.js';
import type {
  LyraClipboardWriteFailure,
  LyraClipboardWriteSuccess,
} from '../../../internal/clipboard.js';
import {
  isLyraToolbarActionProvider,
  type LyraToolbarAction,
  type LyraToolbarActionProvider,
} from './toolbar-actions.js';
import type {
  LyraMessageFeedback,
  MessageFeedbackSubmitDetail,
  MessageFeedbackValue,
} from '../message-feedback/message-feedback.class.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_editMessage, LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_messageActionsLabel, LYRA_DEFAULT_regenerateResponse } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

export type MessageActionControl = 'copy' | 'regenerate' | 'edit' | 'feedback';

const MESSAGE_ACTION_CONTROLS: readonly MessageActionControl[] = [
  'copy',
  'regenerate',
  'edit',
  'feedback',
];

interface ManagedToolbarAction {
  owner: Element;
  action: LyraToolbarAction;
  /** Opaque source identity used only to detect a provider action replacement. */
  source: object;
}

interface ProjectedToolbarAction {
  readonly action: LyraToolbarAction;
  readonly source: object;
}

interface DirectToolbarAction extends LyraToolbarAction {
  hasAuthoredTabIndex(): boolean;
}

interface DisabledProjection {
  readonly valid: boolean;
  readonly disabled: boolean;
}

const MAX_TOOLBAR_ACTIONS = 100;
const MAX_DESCRIPTOR_PROTOTYPES = 100;

function isObjectValue(value: unknown): value is object {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

/** Resolves an own/inherited descriptor without invoking an accessor. An encountered accessor
 * deliberately shadows farther prototypes, matching ordinary property lookup while failing closed. */
function inheritedDescriptor(
  value: object,
  key: PropertyKey,
): PropertyDescriptor | undefined {
  let current: object | null = value;
  for (let depth = 0; current && depth < MAX_DESCRIPTOR_PROTOTYPES; depth += 1) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(current, key);
    } catch {
      return undefined;
    }
    if (descriptor) return descriptor;
    try {
      current = Object.getPrototypeOf(current) as object | null;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function dataCallable(value: object, key: PropertyKey): Function | undefined {
  const descriptor = inheritedDescriptor(value, key);
  return descriptor && 'value' in descriptor && typeof descriptor.value === 'function'
    ? descriptor.value
    : undefined;
}

function dataValue(value: object, key: PropertyKey): unknown {
  const descriptor = inheritedDescriptor(value, key);
  return descriptor && 'value' in descriptor ? descriptor.value : undefined;
}

function projectDisabled(value: object): DisabledProjection {
  const descriptor = inheritedDescriptor(value, 'disabled');
  if (!descriptor) return { valid: true, disabled: false };
  if ('value' in descriptor) {
    return { valid: true, disabled: descriptor.value === true };
  }
  if (typeof descriptor.get !== 'function') return { valid: false, disabled: true };
  try {
    return {
      valid: true,
      disabled: Reflect.apply(descriptor.get, value, []) === true,
    };
  } catch {
    return { valid: false, disabled: true };
  }
}

function projectToolbarAction(value: unknown): ProjectedToolbarAction | undefined {
  if (!isObjectValue(value)) return undefined;
  const id = dataValue(value, 'id');
  const focus = dataCallable(value, 'focus');
  const setTabIndex = dataCallable(value, 'setTabIndex');
  const matchesEventPath = dataCallable(value, 'matchesEventPath');
  const releaseTabIndex = dataCallable(value, 'releaseTabIndex');
  const disabled = projectDisabled(value);
  if (
    typeof id !== 'string' ||
    id.trim().length === 0 ||
    !focus ||
    !setTabIndex ||
    !matchesEventPath ||
    !disabled.valid
  )
    return undefined;
  const action: LyraToolbarAction = {
    id,
    disabled: disabled.disabled,
    focus(options) {
      try {
        Reflect.apply(focus, value, [options]);
      } catch {
        // A hostile provider action cannot strand later controls.
      }
    },
    setTabIndex(tabIndex) {
      try {
        Reflect.apply(setTabIndex, value, [tabIndex]);
      } catch {
        // A hostile provider action cannot strand later controls.
      }
    },
    ...(releaseTabIndex
      ? {
          releaseTabIndex() {
            try {
              Reflect.apply(releaseTabIndex, value, []);
            } catch {
              // One failed optional release cannot strand a later action.
            }
          },
        }
      : {}),
    matchesEventPath(path) {
      try {
        return Reflect.apply(matchesEventPath, value, [path]) === true;
      } catch {
        return false;
      }
    },
  };
  return { source: value, action };
}

export interface LyraMessageActionsEventMap {
  'lr-regenerate': CustomEvent<null>;
  'lr-edit': CustomEvent<null>;
  'lr-copy': CustomEvent<LyraClipboardWriteSuccess>;
  'lr-error': CustomEvent<null>;
  'lr-copy-error': CustomEvent<LyraClipboardWriteFailure>;
  'lr-feedback-change': CustomEvent<{ rating: MessageFeedbackValue }>;
  'lr-feedback-submit': CustomEvent<LyraEventDetailSnapshot<MessageFeedbackSubmitDetail>>;
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
 * (swapped under `effectiveDirection === 'rtl'`) plus Home/End move focus across every logical
 * action. Plain light-DOM actions are flattened directly. Composite controls opt into the exported
 * `LyraToolbarActionProvider` protocol, which keeps implementation nodes private while exposing
 * ordered focus/tab-stop operations and stable action IDs. Both feedback thumbs and both branch
 * controls therefore remain independent arrow-key stops without parent shadow-root inspection.
 * When a managed action leaves the toolbar, its optional `releaseTabIndex()` restores an untouched
 * authored tab stop; a consumer change made after toolbar management always remains authoritative.
 * Providers notify availability/order changes with `lr-toolbar-actions-change`; plain authored
 * actions are observed in light DOM. A former stop is cleared, and if it held focus, focus moves to
 * the nearest survivor or the stable toolbar without overriding a newer external focus move.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 * Built-in control names normalize first-wins before rendering, focus navigation, or intent
 * events, so each built-in can occur at most once. Provider action ids must be nonblank and unique
 * within that provider; invalid actions and later duplicates are omitted.
 *
 * ArrowLeft/ArrowRight/Home/End from a slotted feedback comment editor remain native editing keys. Roving navigation still operates on the actual toolbar and thumb actions.
 *
 * @customElement lr-message-actions
 * @slot - Additional controls (e.g. `lr-copy-button`, `lr-icon-button`, `lr-branch-picker`)
 *   appended after the built-ins; they participate in the toolbar's arrow-key navigation.
 * @event lr-regenerate - The regenerate built-in was activated. No detail.
 * @event lr-edit - The edit built-in was activated: a *request* to edit; the host swaps the message
 *   body for its own editor.
 * @event lr-copy - Clipboard writing fulfilled. Frozen `detail: { ok: true, text }`, surfaced by
 *   the embedded `lr-copy-button` (bubbles + composed already; not re-emitted, so exactly one event
 *   reaches a host listener).
 * @event lr-error - Clipboard writing failed; generic `detail: null` signal from the embedded
 *   copy button.
 * @event lr-copy-error - Clipboard writing failed. Frozen
 *   `detail: { ok: false, text, reason, error }` from the embedded copy button.
 * @event lr-feedback-change - Bubbles unchanged from the embedded, thumbs-only
 *   `lr-message-feedback`. `detail: { rating }`. A colliding event from a slotted custom child is
 *   contained at the slot boundary and remains observable directly on that child.
 * @event lr-feedback-submit - The built-in feedback control's terminal cancelable persistence
 *   request, including thumbs-only choices. Its frozen detail includes a nonblank `submissionId`;
 *   when prevented, pass that exact ID to `finalizePendingSubmit()` or
 *   `revertPendingSubmit()` on this wrapper. Slotted collisions are contained at the slot boundary.
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

  protected static override readonly ownedCollectionProperties = Object.freeze(['controls']);

  static override styles = [LyraElement.styles, styles];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-feedback-submit',
  ]);

  /** Which built-ins render, in display order. Duplicate names normalize first-wins. */
  @property({ attribute: false }) controls: readonly MessageActionControl[] = [];

  private get effectiveControls(): readonly MessageActionControl[] {
    const seen = new Set<MessageActionControl>();
    const controls: MessageActionControl[] = [];
    for (const value of this.controls as readonly unknown[]) {
      if (
        typeof value !== 'string' ||
        !MESSAGE_ACTION_CONTROLS.includes(value as MessageActionControl) ||
        seen.has(value as MessageActionControl)
      ) {
        continue;
      }
      const control = value as MessageActionControl;
      seen.add(control);
      controls.push(control);
    }
    return controls;
  }

  /** What the `copy` built-in copies. Required for it to render at all -- this component never
   *  interprets the slotted message body itself. */
  @property({ attribute: 'copy-text' }) copyText = '';

  /** Forwarded to the embedded thumbs-only `lr-message-feedback` when enabled. */
  @property({ attribute: 'feedback-rating' })
  feedbackRating: MessageFeedbackValue = null;

  /** Whether this component's current built-in feedback child is awaiting a persistence settle.
   *  This is a nonreflecting read-through; no `feedback-pending` attribute or change event exists. */
  get feedbackPending(): boolean {
    return this.currentBuiltInFeedback()?.pending === true;
  }

  /** Settles only the currently rendered built-in feedback transaction identified by `submissionId`.
   *  A removed, replaced, stale, or mismatched child fails closed. */
  finalizePendingSubmit(submissionId: string): boolean {
    const feedback = this.currentBuiltInFeedback();
    return (
      typeof submissionId === 'string' &&
      submissionId.trim().length > 0 &&
      feedback !== undefined
        ? feedback.finalizePendingSubmit(submissionId)
        : false
    );
  }

  /** Reverts only the currently rendered built-in feedback transaction identified by `submissionId`.
   *  A removed, replaced, stale, or mismatched child fails closed. */
  revertPendingSubmit(submissionId: string): boolean {
    const feedback = this.currentBuiltInFeedback();
    return (
      typeof submissionId === 'string' &&
      submissionId.trim().length > 0 &&
      feedback !== undefined
        ? feedback.revertPendingSubmit(submissionId)
        : false
    );
  }

  /** Visually hides the bar until the enclosing message is hovered or any control inside has focus. */
  @property({
    type: Boolean,
    reflect: true,
    attribute: 'reveal-on-interaction',
  })
  revealOnInteraction = false;

  /** Accessible name for the toolbar. Defaults to the localized `messageActionsLabel`. */
  @property() label = '';

  /** Overrides the toolbar's computed accessible name. Wins over `label` and the localized
   *  default. Attribute-reflects from a host-level `aria-label` so a plain-markup consumer gets
   *  ARIA-name forwarding without setting a JS property. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  private activeStopIndex = 0;
  /** Drives the `data-revealed` host attribute (toggled imperatively in `updated()`, not via a Lit
   *  template binding -- `lr-graph`'s `data-hovered` attribute is the precedent for this exact
   *  technique) while `revealOnInteraction` is active. CSS alone cannot key `:host`'s own opacity off the
   *  ancestor `lr-chat-message`'s hover state from inside this component's own shadow DOM, so the
   *  reveal state is tracked in JS instead (see `bindHoverTarget()`). */
  @state() private revealed = false;

  private hoverTarget: HTMLElement | null = null;
  private stopSyncGeneration = 0;
  private stopObserver?: MutationObserver;
  private managedStops: ManagedToolbarAction[] = [];
  private directActions = new WeakMap<Element, DirectToolbarAction>();
  private nextDirectActionId = 0;
  private focusedStop?: {
    index: number;
    owner: Element;
    id: string;
    source: object;
    repair: ComposedFocusRepairSnapshot;
  };

  private currentBuiltInFeedback(): LyraMessageFeedback | undefined {
    const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
    const feedback = base?.querySelector<LyraMessageFeedback>(
      'lr-message-feedback[part~="feedback"]',
    );
    return feedback &&
      feedback.parentElement === base &&
      feedback.getRootNode() === this.renderRoot &&
      feedback.isConnected
      ? feedback
      : undefined;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('focusin', this.onFocusIn);
    this.addEventListener('focusout', this.onFocusOut);
    if (this.revealOnInteraction) this.bindHoverTarget();
    if (this.hasUpdated) void this.reconcileStopsAfterChildren();
  }

  override disconnectedCallback(): void {
    this.stopSyncGeneration++;
    this.stopObserver?.disconnect();
    this.stopObserver = undefined;
    this.releaseManagedStops();
    this.focusedStop = undefined;
    this.unbindHoverTarget();
    this.removeEventListener('focusin', this.onFocusIn);
    this.removeEventListener('focusout', this.onFocusOut);
    super.disconnectedCallback();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.stopSyncGeneration++;
    this.stopObserver?.disconnect();
    this.stopObserver = undefined;
    this.releaseManagedStops();
  }

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (changed.has('revealOnInteraction')) {
      if (this.revealOnInteraction) this.bindHoverTarget();
      else this.unbindHoverTarget();
    }
  }

  protected override firstUpdated(changed: PropertyValues): void {
    super.firstUpdated(changed);
    this.setActiveStop(this.logicalActions(), 0);
    void this.reconcileStopsAfterChildren();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('controls')) {
      const stops = this.logicalActions();
      this.setActiveStop(
        stops,
        Math.min(this.activeStopIndex, Math.max(0, stops.length - 1))
      );
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
    const target =
      (this.closest('lr-chat-message') as HTMLElement | null) ??
      this.parentElement;
    if (!target) return;
    this.hoverTarget = target;
    target.addEventListener('pointerenter', this.onHoverTargetEnter);
    target.addEventListener('pointerleave', this.onHoverTargetLeave);
  }

  private unbindHoverTarget(): void {
    this.hoverTarget?.removeEventListener(
      'pointerenter',
      this.onHoverTargetEnter
    );
    this.hoverTarget?.removeEventListener(
      'pointerleave',
      this.onHoverTargetLeave
    );
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
    const stops = this.logicalActions();
    const path = event.composedPath();
    const index = stops.findIndex(({ action }) =>
      action.matchesEventPath(path)
    );
    if (index >= 0) {
      this.setActiveStop(stops, index, stops[index]);
      const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
      const repair = base ? captureComposedFocusRepair(this, base) : null;
      const stop = stops[index];
      this.focusedStop =
        stop && repair
          ? {
              index,
              owner: stop.owner,
              id: stop.action.id,
              source: stop.source,
              repair,
            }
          : undefined;
    } else {
      this.focusedStop = undefined;
    }
  };

  private onFocusOut = (event: Event): void => {
    if (!this.hoverTarget?.matches(':hover')) this.revealed = false;
    const destination = (event as FocusEvent).relatedTarget;
    if (
      destination &&
      (destination as Node).nodeType === 1 &&
      !composedContains(this, destination as Element)
    ) {
      this.focusedStop = undefined;
    }
  };

  /** Immediate rendered children plus flattened slotted roots that own logical actions. */
  private actionRoots(): Element[] {
    const base = this.renderRoot.querySelector('[part="base"]');
    if (!base) return [];
    const direct = [...base.children].filter(
      (element) => element.localName !== 'slot'
    );
    const slot = base.querySelector<HTMLSlotElement>('slot');
    return [...direct, ...(slot?.assignedElements({ flatten: true }) ?? [])];
  }

  private sameAction(
    left: ManagedToolbarAction,
    right: ManagedToolbarAction
  ): boolean {
    return (
      left.owner === right.owner &&
      left.source === right.source &&
      left.action.id === right.action.id
    );
  }

  private isAvailable(action: LyraToolbarAction): boolean {
    try {
      return action.disabled !== true;
    } catch {
      return false;
    }
  }

  private directActionFor(element: Element): DirectToolbarAction {
    let action = this.directActions.get(element);
    if (action) return action;
    const target = element as HTMLElement;
    const id = `direct-${++this.nextDirectActionId}`;
    let leasedTarget: HTMLElement | undefined;
    let leasedAuthoredTabIndex: string | null = null;
    let lastManagedTabIndex: string | null = null;
    let consumerOwnsTabIndex = false;
    const releaseTabIndex = (): void => {
      const leased = leasedTarget;
      if (leased && leased.getAttribute('tabindex') === lastManagedTabIndex) {
        if (leasedAuthoredTabIndex === null) leased.removeAttribute('tabindex');
        else leased.setAttribute('tabindex', leasedAuthoredTabIndex);
      }
      leasedTarget = undefined;
      leasedAuthoredTabIndex = null;
      lastManagedTabIndex = null;
      consumerOwnsTabIndex = false;
    };
    action = {
      id,
      get disabled() {
        return !isComposedFocusAvailable(element);
      },
      focus(options) {
        target.focus(options);
      },
      setTabIndex(tabIndex) {
        if (leasedTarget !== target) {
          releaseTabIndex();
          leasedTarget = target;
          leasedAuthoredTabIndex = target.getAttribute('tabindex');
        }
        if (
          consumerOwnsTabIndex ||
          (lastManagedTabIndex !== null &&
            target.getAttribute('tabindex') !== lastManagedTabIndex)
        ) {
          consumerOwnsTabIndex = true;
          return;
        }
        target.tabIndex = tabIndex;
        lastManagedTabIndex = target.getAttribute('tabindex');
      },
      releaseTabIndex,
      hasAuthoredTabIndex() {
        if (leasedTarget !== target) return target.hasAttribute('tabindex');
        if (
          lastManagedTabIndex !== null &&
          target.getAttribute('tabindex') === lastManagedTabIndex
        ) {
          return leasedAuthoredTabIndex !== null;
        }
        return target.hasAttribute('tabindex');
      },
      matchesEventPath(path) {
        return path.includes(element);
      },
    };
    this.directActions.set(element, action);
    return action;
  }

  private logicalActions(): ManagedToolbarAction[] {
    const actions: ManagedToolbarAction[] = [];
    const addProvider = (
      owner: Element,
      provider: LyraToolbarActionProvider
    ): void => {
      const getToolbarActions = dataCallable(provider, 'getToolbarActions');
      if (!getToolbarActions) return;
      let provided: unknown;
      try {
        provided = Reflect.apply(getToolbarActions, provider, []);
      } catch {
        return;
      }
      let isArray = false;
      try {
        isArray = Array.isArray(provided);
      } catch {
        return;
      }
      if (!isArray) return;
      const length = getOwnDataDescriptor(provided as object, 'length');
      if (
        length === MISSING_OWN_DATA_DESCRIPTOR ||
        length === UNSAFE_OWN_DATA_DESCRIPTOR ||
        typeof length.value !== 'number' ||
        !Number.isSafeInteger(length.value) ||
        length.value < 0
      )
        return;
      const seen = new Set<string>();
      const inspected = Math.min(length.value, MAX_TOOLBAR_ACTIONS);
      for (let index = 0; index < inspected; index += 1) {
        const candidate = getOwnDataDescriptor(provided as object, String(index));
        if (
          candidate === MISSING_OWN_DATA_DESCRIPTOR ||
          candidate === UNSAFE_OWN_DATA_DESCRIPTOR
        )
          continue;
        const projected = projectToolbarAction(candidate.value);
        if (!projected || seen.has(projected.action.id)) continue;
        seen.add(projected.action.id);
        if (this.isAvailable(projected.action)) {
          actions.push({ owner, ...projected });
        }
      }
    };
    const visit = (element: Element): void => {
      if (isLyraToolbarActionProvider(element)) {
        addProvider(element, element);
        return;
      }
      const knownAction = this.directActions.get(element);
      if (
        isSemanticActionElement(element) ||
        (knownAction?.hasAuthoredTabIndex() ?? element.hasAttribute('tabindex'))
      ) {
        const action = this.directActionFor(element);
        if (this.isAvailable(action)) {
          actions.push({ owner: element, action, source: action });
        }
        return;
      }
      for (const child of element.children) visit(child);
    };
    for (const root of this.actionRoots()) visit(root);
    return actions;
  }

  private setActiveStop(
    stops: ManagedToolbarAction[],
    index: number,
    preferred?: ManagedToolbarAction
  ): void {
    this.stopObserver?.disconnect();
    for (const previous of this.managedStops) {
      if (!stops.some((stop) => this.sameAction(stop, previous)))
        this.releaseManagedStop(previous);
    }
    const preferredIndex = preferred
      ? stops.findIndex((stop) => this.sameAction(stop, preferred))
      : -1;
    this.activeStopIndex =
      stops.length === 0
        ? 0
        : preferredIndex >= 0
        ? preferredIndex
        : Math.min(Math.max(0, index), stops.length - 1);
    stops.forEach(({ action }, stopIndex) => {
      try {
        action.setTabIndex(stopIndex === this.activeStopIndex ? 0 : -1);
      } catch {
        // A third-party action may still throw despite its descriptor-safe projection.
      }
    });
    this.managedStops = stops;
    this.observeStopChanges();
  }

  private releaseManagedStop(stop: ManagedToolbarAction): void {
    try {
      stop.action.releaseTabIndex?.();
    } catch {
      // A throwing optional release cannot strand another managed stop.
    }
    if (this.directActions.get(stop.owner) === stop.action) {
      this.directActions.delete(stop.owner);
    }
  }

  private releaseManagedStops(): void {
    for (const stop of this.managedStops) this.releaseManagedStop(stop);
    this.managedStops = [];
  }

  private observeStopChanges(): void {
    this.stopObserver?.disconnect();
    const Observer = this.ownerDocument.defaultView?.MutationObserver;
    const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
    if (!Observer || !base || !this.isConnected) {
      this.stopObserver = undefined;
      return;
    }
    const observer = new Observer(this.onStopMutations);
    const roots = new Set<Node>([base, ...this.actionRoots()]);
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
    void records;
    void this.reconcileStopsAfterChildren();
  };

  private async reconcileStopsAfterChildren(): Promise<void> {
    const generation = ++this.stopSyncGeneration;
    const pending = this.actionRoots()
      .map(
        (root) =>
          (root as Element & { updateComplete?: Promise<unknown> })
            .updateComplete
      )
      .filter(
        (value): value is Promise<unknown> =>
          value !== undefined &&
          typeof (value as PromiseLike<unknown>).then === 'function'
      );
    await Promise.all(pending);
    await Promise.resolve();
    if (generation !== this.stopSyncGeneration || !this.isConnected) return;
    const stops = this.logicalActions();
    const focused = this.focusedStop;
    const retainedIndex = focused
      ? stops.findIndex(
          (stop) =>
            stop.owner === focused.owner &&
            stop.source === focused.source &&
            stop.action.id === focused.id
        )
      : -1;
    const targetIndex =
      retainedIndex >= 0
        ? retainedIndex
        : focused
        ? Math.min(Math.max(0, focused.index), Math.max(0, stops.length - 1))
        : Math.min(this.activeStopIndex, Math.max(0, stops.length - 1));
    this.setActiveStop(stops, targetIndex);
    if (focused && retainedIndex < 0) {
      const base = this.renderRoot.querySelector<HTMLElement>('[part="base"]');
      if (base && applyComposedFocusRepair(focused.repair, base)) {
        stops[targetIndex]?.action.focus();
      }
      if (this.focusedStop === focused) this.focusedStop = undefined;
    }
  }

  private onSlotChange = (): void => {
    const stops = this.logicalActions();
    this.setActiveStop(
      stops,
      Math.min(this.activeStopIndex, Math.max(0, stops.length - 1))
    );
    void this.reconcileStopsAfterChildren();
  };

  private onToolbarActionsChange = (event: Event): void => {
    event.stopPropagation();
    void this.reconcileStopsAfterChildren();
  };

  private containSlottedFeedbackEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private onToolbarKeyDown = (e: KeyboardEvent): void => {
    const stops = this.logicalActions();
    if (stops.length === 0) return;
    const path = e.composedPath();
    const originIndex = stops.findIndex(({ action }) =>
      action.matchesEventPath(path)
    );
    if (originIndex < 0 && path[0] !== e.currentTarget) return;
    const currentIndex = originIndex >= 0 ? originIndex : this.activeStopIndex;
    const forwardKey =
      this.effectiveDirection === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const backwardKey =
      this.effectiveDirection === 'rtl' ? 'ArrowRight' : 'ArrowLeft';
    let target: number;
    if (e.key === forwardKey) target = (currentIndex + 1) % stops.length;
    else if (e.key === backwardKey)
      target = (currentIndex - 1 + stops.length) % stops.length;
    else if (e.key === 'Home') target = 0;
    else if (e.key === 'End') target = stops.length - 1;
    else return;
    e.preventDefault();
    this.setActiveStop(stops, target);
    stops[target]?.action.focus();
  };

  private onRegenerateClick = (): void => {
    this.emit('lr-regenerate', null);
  };

  private onEditClick = (): void => {
    this.emit('lr-edit', null);
  };

  private renderControl(type: MessageActionControl) {
    switch (type) {
      case 'copy':
        return this.copyText
          ? html`<lr-copy-button
              part="copy-button"
              .value=${this.copyText}
            ></lr-copy-button>`
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
        return html`<lr-message-feedback
          part="feedback"
          .rating=${this.feedbackRating}
          @lr-toolbar-actions-change=${this.onToolbarActionsChange}
        ></lr-message-feedback>`;
      default:
        return nothing;
    }
  }

  override render(): TemplateResult {
    const label =
      this.accessibleLabel ??
      (this.label || this.localize('messageActionsLabel'));
    return html`
      <div
        part="base"
        role="toolbar"
        aria-label=${label}
        tabindex="-1"
        @keydown=${this.onToolbarKeyDown}
      >
        ${repeat(
          this.effectiveControls,
          (type) => type,
          (type) => this.renderControl(type)
        )}
        <slot
          @slotchange=${this.onSlotChange}
          @lr-toolbar-actions-change=${this.onToolbarActionsChange}
          @lr-feedback-change=${this.containSlottedFeedbackEvent}
          @lr-feedback-submit=${this.containSlottedFeedbackEvent}
        ></slot>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-message-actions': LyraMessageActions;
  }
}
