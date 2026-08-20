import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { renderInertPresentation } from '../../../internal/inert-presentation.js';
import {
  activateOverlay,
  collectFocusableElements,
  deepActiveElement,
  type OverlayHandle,
} from '../../../internal/overlay-manager.js';
import {
  readPersistedState,
  writePersistedState,
} from '../../../internal/persisted-state.js';
import { nextId } from '../../../internal/a11y.js';
import {
  bindAccessibleTextObserver,
  composedAccessibilityText,
} from '../../../internal/accessibility-visibility.js';
import { observeScrollOverflow } from '../../../internal/scroll-overflow.js';
import { chevronIcon, closeIcon, expandIcon } from '../../../internal/icons.js';
import { styles } from './widget.styles.js';
import { sanitizeCssInset } from '../../../internal/safe-css.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_widgetCollapse, LYRA_DEFAULT_widgetExitFullscreen, LYRA_DEFAULT_widgetExpand, LYRA_DEFAULT_widgetExpandToFullscreen, LYRA_DEFAULT_widgetFullscreenPanel, LYRA_DEFAULT_widgetViewGroup } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


export interface LyraWidgetView {
  /** Stable, unique business identity for this view. */
  viewId: string;
  /** Visible label text. Optional so a toggle can be icon-only (`icon` set, `label` omitted) --
   *  set `ariaLabel` too in that case so the button keeps a real accessible name; see `ariaLabel`'s
   *  own doc for what happens if both are left unset. */
  label?: string;
  /** Optional decorative leading visual rendered before the label. This is intentionally general
   *  content, not a square-icon-only field: SVG icons, flag glyphs, badges, and other
   *  natural-aspect-ratio Lit content are supported, matching `LyraSegmentedItem`/`LyraStepItem`'s
   *  own `icon` field. It is rendered in inert, aria-hidden chrome, so it cannot provide an
   *  independent action or accessible name. */
  icon?: unknown;
  /** Accessible name for the toggle button, used only when `label` is omitted -- ignored otherwise,
   *  since the visible label text already supplies the accessible name. If both `label` and
   *  `ariaLabel` are omitted, the button falls back to its own `viewId` as a last-resort accessible name:
   *  not silently unlabeled, but not a good name either, so set one of the two for any icon-only view. */
  ariaLabel?: string;
}

const MAX_WIDGET_VIEWS = 256;

/** Duplicate view IDs cannot identify distinct slots or public active states. Keep the first
 * occurrence so the rendered controls and body expose one deterministic target per view ID.
 *
 * `icon` is deliberately preserved by reference, never deep-cloned. It commonly carries a Lit
 * `TemplateResult` (see `LyraWidgetView.icon`'s own doc), whose `strings` is the exact array the
 * JS engine attaches to a tagged-template-literal call, including its non-enumerable `raw`
 * field. A generic recursive collection snapshot (as `LyraElement`'s `ownedCollectionProperties`
 * machinery applies) would rebuild that array as an ordinary `Array`, silently dropping `raw` --
 * lit-html's `trustFromTemplateString` then rejects the clone as a faked template-strings array.
 * Shallow-copying each view record here, the same way `LyraSegmentedItem`/`LyraStepItem` handle
 * their own `icon` field, keeps `viewId`/`label`/`ariaLabel` bounded and frozen while passing
 * `icon` through untouched. */
function snapshotWidgetViews(value: unknown): readonly Readonly<LyraWidgetView>[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  const seen = new Set<string>();
  const normalized: Readonly<LyraWidgetView>[] = [];
  for (const candidate of value.slice(0, MAX_WIDGET_VIEWS)) {
    try {
      if (!candidate || typeof candidate !== 'object') continue;
      const record = candidate as Record<string, unknown>;
      const viewId = record['viewId'];
      if (
        typeof viewId !== 'string' ||
        viewId.length === 0 ||
        viewId !== viewId.trim() ||
        seen.has(viewId)
      ) {
        continue;
      }
      const label = record['label'];
      const ariaLabel = record['ariaLabel'];
      const icon = record['icon'];
      if (label !== undefined && typeof label !== 'string') continue;
      if (ariaLabel !== undefined && typeof ariaLabel !== 'string') continue;
      seen.add(viewId);
      normalized.push(
        Object.freeze({
          viewId,
          ...(label !== undefined ? { label } : {}),
          ...(icon !== undefined ? { icon } : {}),
          ...(ariaLabel !== undefined ? { ariaLabel } : {}),
        })
      );
    } catch {
      // Hostile accessors are malformed input, not an update failure.
    }
  }
  return Object.freeze(normalized);
}

export interface LyraWidgetEventMap {
  'lr-collapse-request': CustomEvent<{ collapsed: boolean }>;
  'lr-collapse-change': CustomEvent<{ collapsed: boolean }>;
  'lr-fullscreen-request': CustomEvent<{ fullscreen: boolean }>;
  'lr-fullscreen-change': CustomEvent<{ fullscreen: boolean }>;
  'lr-view-request': CustomEvent<{ viewId: string }>;
  'lr-view-change': CustomEvent<{ viewId: string }>;
}
/**
 * `<lr-widget>` — a titled panel shell with an optional collapse toggle and
 * an optional fullscreen-expand toggle. Fullscreen promotes the same host
 * element in place (a CSS state, not a clone/portal), so slotted content
 * (a chart, a running simulation, scroll position) survives the transition.
 *
 * @customElement lr-widget
 * @slot - The panel body.
 * @slot icon - Optional decorative leading icon in the title row. Its flattened subtree is inert
 *   and hidden from assistive technology.
 * @slot label - Rich label content (overrides the `label` attribute).
 * @slot sublabel - Rich sublabel content (overrides the `sublabel` attribute).
 * @slot actions - Header action controls, rendered before the collapse/expand buttons.
 * @slot collapse-icon - Overrides the built-in chevron glyph inside the collapse/expand toggle
 *   button entirely, via the platform's own slot-fallback-content mechanism (same convention as
 *   `<lr-tool-call-chip>`'s `icon` slot): whatever is assigned wins, otherwise the default chevron
 *   renders. Assigned content is decorative, inert, and aria-hidden so the outer toggle remains the
 *   sole action. Only meaningful while `collapsible`.
 * @slot fullscreen-icon - Overrides the built-in expand/close glyph inside the fullscreen toggle
 *   button entirely, using the same mechanism -- the override replaces *both* the "expand" and
 *   "exit fullscreen" default icons, so a consumer supplying one is responsible for its own
 *   expand/exit distinction (e.g. by reading the `fullscreen` attribute). Assigned content is
 *   decorative, inert, and aria-hidden so the outer toggle remains the sole action. Only meaningful
 *   while `expandable`.
 * @slot view-{viewId} - Content for the view whose `LyraWidgetView.viewId` matches `{viewId}`, rendered when
 *   `views` is non-empty.
 * @event lr-collapse-request - A cancelable proposed `collapsed` state from the built-in collapse
 *   toggle. Call `preventDefault()` to keep `collapsed` and persistence unchanged. Not fired when
 *   a consumer sets `collapsed` directly. `detail: { collapsed }`.
 * @event lr-collapse-change - Non-cancelable post-commit notification from the built-in collapse
 *   toggle. Not fired when a consumer sets `collapsed` directly. `detail: { collapsed }` (the new
 *   `collapsed` state).
 * @event lr-fullscreen-request - A cancelable proposed `fullscreen` state from the fullscreen
 *   toggle, Escape, or a backdrop click. Call `preventDefault()` to leave `fullscreen` unchanged.
 *   Not fired when a consumer sets `fullscreen` directly. `detail: { fullscreen }`.
 * @event lr-fullscreen-change - Non-cancelable post-commit notification, fired after the
 *   fullscreen toggle, Escape, or a backdrop click accepts the change. Not fired when a consumer
 *   sets `fullscreen` directly. `detail: { fullscreen }` (the new `fullscreen` state).
 * @event lr-view-request - A cancelable proposed `activeViewId` from a header view-toggle click.
 *   Call `preventDefault()` to leave `activeViewId` unchanged. Not fired when a consumer sets
 *   `activeViewId` directly. `detail: { viewId }`.
 * @event lr-view-change - Non-cancelable post-commit notification, fired after a header
 *   view-toggle click accepts the change. Not fired when a consumer sets `activeViewId` directly.
 *   `detail: { viewId }`.
 * @csspart base - The panel root (dialog role + backdrop when fullscreen).
 * @csspart header - The header row containing the title, actions, and toggle buttons.
 * @csspart title - The wrapper around the label/sublabel.
 * @csspart icon - Wrapper around the `icon` slot. Hidden entirely when empty.
 * @csspart label-group - Wrapper around the label and sublabel.
 * @csspart label - The panel title text.
 * @csspart sublabel - The panel subtitle text.
 * @csspart actions - The wrapper around the `actions` slot.
 * @csspart view-toggles - The header toggle-button group, only rendered when `views` is non-empty.
 * @csspart view-toggle - A single view toggle button.
 * @csspart view-icon - Decorative icon content inside a view toggle; its subtree is inert and
 *   hidden from assistive technology.
 * @csspart view-label - Visible label text inside a view toggle.
 * @csspart collapse-button - The collapse/expand toggle button.
 * @csspart fullscreen-button - The fullscreen toggle button.
 * @csspart body - The wrapper around the default slot (the panel body).
 * @csspart backdrop - The fullscreen scrim behind the panel.
 * @cssprop [--lr-widget-overlay-color=var(--lr-color-overlay)] - The fullscreen scrim's color,
 *   applied to `[part="backdrop"]`.
 * @cssprop [--lr-widget-view-toggle-active-bg=var(--lr-color-brand-quiet)] - Background of the
 *   pressed (`aria-pressed="true"`) view toggle. Declared as an inline `var()` fallback (never on
 *   `:host`), so setting it on the element or an ancestor recolors only the active toggle without
 *   hijacking the library-wide `--lr-color-brand-quiet` token.
 * @cssprop [--lr-widget-view-toggle-hover-bg=var(--lr-color-brand-quiet)] - Background of a hovered
 *   `[part="view-toggle"]`.
 * @cssprop [--lr-widget-view-toggle-hover-color=var(--lr-color-text)] - Text color of a hovered
 *   `[part="view-toggle"]`.
 * @cssprop [--lr-widget-view-toggle-active-color=var(--lr-color-brand)] - Text color of the pressed
 *   view toggle.
 * @cssprop [--lr-widget-view-toggle-active-border-color=transparent] - Border color of the pressed
 *   view toggle. Like the active background and text hooks, it is an inline inherited fallback.
 * @cssprop [--lr-widget-fullscreen-inset=max(var(--lr-space-l), var(--lr-safe-area-top)) max(var(--lr-space-l), var(--lr-safe-area-inline-end)) max(var(--lr-space-l), var(--lr-safe-area-bottom)) max(var(--lr-space-l), var(--lr-safe-area-inline-start))] - The `inset` applied to `[part="base"]` while `fullscreen`. Also set inline from the `fullscreen-inset` attribute.
 * @cssprop [--lr-widget-backdrop-inset=0] - The `inset` applied to
 *   `[part="backdrop"]`, so the scrim can be pulled back independently of the panel. Also set
 *   inline from the `backdrop-inset` attribute.
 * @cssprop [--lr-scroll-fade-size=2rem] - Width of the fade at each horizontal scroll edge of the
 *   `actions`/`view-toggles` header rows. The fade is applied only while a row actually overflows,
 *   so a row that fits is never dimmed.
 *
 * `fullscreen-inset` overrides the safe-area panel inset while the viewport-filling backdrop stays
 * at zero by default. `compact` tightens header/body padding — same convention as `lr-empty`.
 * @status stable
 * @since 4.0.0
 */
export class LyraWidget extends LyraElement<LyraWidgetEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    widgetCollapse: LYRA_DEFAULT_widgetCollapse,
    widgetExitFullscreen: LYRA_DEFAULT_widgetExitFullscreen,
    widgetExpand: LYRA_DEFAULT_widgetExpand,
    widgetExpandToFullscreen: LYRA_DEFAULT_widgetExpandToFullscreen,
    widgetFullscreenPanel: LYRA_DEFAULT_widgetFullscreenPanel,
    widgetViewGroup: LYRA_DEFAULT_widgetViewGroup,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  // Two independent observers: either header row can overflow on its own, and each one gates its
  // own edge fade -- the same measurement-gated affordance lr-segmented/lr-stepper/lr-tab-group
  // already use for their scrolling control rows. Without it a narrow widget clips the row with
  // no visual hint that more actions or view toggles exist off-screen. Stored (rather than a bare
  // statement-expression call) so `updated()` can register each row's own content on the
  // controller's own `ResizeObserver` via `observeExtra()` -- a slotted action's label growing (or
  // a view toggle's label growing) can grow scrollWidth without the row's own border box changing
  // at all.
  private actionsScrollOverflow = observeScrollOverflow(this, () =>
    this.renderRoot.querySelector('[part="actions"]')
  );
  private viewTogglesScrollOverflow = observeScrollOverflow(this, () =>
    this.renderRoot.querySelector('[part="view-toggles"]')
  );

  @property() label = '';
  /** Overrides the fullscreen dialog's accessible name, taking precedence over both `label` and a
   *  slotted `label`. An explicitly empty value remains an explicit name; fallbacks apply only when
   *  the value is absent. Fed only by a host `aria-label`, matching `lr-scroller`'s/`lr-carousel`'s
   *  own host-override pattern. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;
  @property() sublabel = '';
  @property({ type: Boolean, reflect: true }) collapsible = false;
  @property({ type: Boolean, reflect: true }) collapsed = false;
  /** Persists `collapsed` to `localStorage` across reloads when set. Namespaced as
   *  `lr-widget:${storageKey}` -- mirrors `lr-app-rail`'s/`lr-table`'s identical `storage-key`
   *  pattern. Unset (the default) touches storage not at all. */
  @property({ attribute: 'storage-key' }) storageKey?: string;
  @property({ type: Boolean, reflect: true }) expandable = false;
  @property({ type: Boolean, reflect: true }) fullscreen = false;
  /** CSS `inset` shorthand applied to the fullscreen panel instead of its safe-area default.
   * The backdrop remains viewport-filling unless `backdropInset` is also set. */
  @property({ attribute: 'fullscreen-inset' }) fullscreenInset = '';
  /** Overrides the fullscreen backdrop's viewport-filling inset independently of
   * `fullscreenInset`. Invalid values retain the default `0`. */
  @property({ attribute: 'backdrop-inset' }) backdropInset = '';
  /** Tighter header/body padding for constrained spaces. */
  @property({ type: Boolean, reflect: true }) compact = false;
  private effectiveViews: readonly Readonly<LyraWidgetView>[] = Object.freeze([]);

  /** Named alternate views for the panel body. Assignment takes a bounded, recursively frozen
   *  snapshot (except `icon`, preserved by reference -- see `snapshotWidgetViews`'s doc); mutate a
   *  copy and reassign it to update. For example, a chart/table toggle inside the same card
   *  chrome. Each entry gets a header toggle button and a `<slot name="view-${viewId}">`. Empty (the
   *  default) renders today's single unnamed default slot as the sole view, unchanged. An entry's
   *  `label` is optional -- see `LyraWidgetView`'s own doc for the icon-only (`ariaLabel`) case. */
  @property({ attribute: false })
  get views(): readonly LyraWidgetView[] {
    return this.effectiveViews;
  }
  set views(value: readonly LyraWidgetView[]) {
    const previous = this.effectiveViews;
    this.effectiveViews = snapshotWidgetViews(value);
    this.requestUpdate('views', previous);
  }

  /** The currently active view's `viewId` -- defaults to the first entry of `views` (or `''` when
   *  `views` is empty). Settable directly by a consumer wanting to control the active view
   *  externally; also updated internally when a view toggle is clicked. */
  @property({ attribute: false }) activeViewId = '';

  /**
   * Deprecated alias for `activeViewId`, which seeds it.
   *
   * `activeView` was this property's original public name. It was renamed to `activeViewId` with
   * no changelog entry, no alias and no deprecation record, which broke shipped consumers
   * silently: a Lit `.activeView=${id}` binding on a custom element is untyped, so it did not
   * error -- it became a dead expando, and the widget quietly fell back to its first view.
   *
   * This seeds `activeViewId` rather than being read alongside it, because unlike a boolean flag
   * this property is one the component itself writes (a view-toggle click, and the fallback when
   * `views` no longer contains the active id). Seeding on change keeps a single source of truth:
   * a later interactive change is not undone by the stale alias on the next update.
   *
   * @deprecated Use `activeViewId`.
   */
  @property({ attribute: false }) activeView = '';

  @state() private hasActionsSlot = false;
  @state() private hasIconSlot = false;
  @state() private hasLabelSlot = false;
  /** Text content of a slotted `label`, so the fullscreen dialog's accessible name can see rich
   *  slotted label content the same way it already sees the plain `label` property. */
  @state() private labelSlotText?: string;
  @state() private hasSublabelSlot = false;

  private overlayHandle?: OverlayHandle;
  private explicitTrigger?: HTMLElement;
  private labelSlotObserver?: MutationObserver;
  private labelSlotObserverDocument?: Document;
  private labelSlotObserverGeneration = 0;
  private ownerRealmGeneration = 0;
  private readonly bodyId = nextId('widget-body');
  private focusedViewIdBeforeUpdate?: string;

  private get storageFullKey(): string | undefined {
    return this.storageKey ? `lr-widget:${this.storageKey}` : undefined;
  }

  /** Skips the very first `updated()` pass so mounting never writes to storage -- `willUpdate()`
   *  restored `collapsed` on that first pass, and Lit has already flipped `hasUpdated` to true by
   *  the time `updated()` runs, so a dedicated flag is needed. Mirrors `lr-table`'s/`lr-app-rail`'s
   *  `persistReady`. */
  private persistReady = false;

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasActionsSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'actions'
      );
      this.hasIconSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'icon'
      );
      const labelChildren = Array.from(this.children).filter(
        (el) => el.getAttribute('slot') === 'label'
      );
      this.hasLabelSlot = labelChildren.length > 0;
      this.labelSlotText = this.readLabelSlotText(labelChildren);
      this.hasSublabelSlot = Array.from(this.children).some(
        (el) => el.getAttribute('slot') === 'sublabel'
      );
      // Restore a persisted `collapsed` preference once, before the first render, so the restored
      // value folds into the first paint with no follow-up update -- doing this in firstUpdated()
      // (after the first render) would schedule a second update and trip Lit's dev warning. Mirrors
      // lr-table's/lr-app-rail's restore in their own willUpdate(). The `persistReady` gate in
      // updated() keeps this restored value from being written straight back.
      const parsed = readPersistedState(
        this.storageFullKey,
        (v): v is { collapsed?: unknown } => typeof v === 'object' && v !== null
      );
      if (parsed && typeof parsed.collapsed === 'boolean')
        this.collapsed = parsed.collapsed;
    }
    if (changed.has('fullscreen')) {
      if (this.fullscreen) {
        this.activateFullscreenOverlay();
      } else {
        this.deactivateFullscreenOverlay();
      }
    }
    // Seed from the deprecated alias BEFORE the normalization below, so the seeded id is what gets
    // validated against `views` rather than being overwritten by the first-view fallback.
    if (changed.has('activeView') && this.activeView !== '') {
      this.activeViewId = this.activeView;
    }
    if (changed.has('views') || changed.has('activeViewId') || changed.has('activeView')) {
      const focused = this.renderRoot?.querySelector<HTMLElement>(
        '[part="view-toggle"]:focus'
      );
      this.focusedViewIdBeforeUpdate = focused?.dataset['viewId'];
      const views = this.views;
      if (!views.some((view) => view.viewId === this.activeViewId)) {
        this.activeViewId = views[0]?.viewId ?? '';
      }
    }
  }

  // Runs after render (not willUpdate) so `[part="base"]`'s fullscreen-only
  // tabindex has already landed in the DOM before the fallback .focus() call
  // below can rely on it. WAI-ARIA APG's dialog pattern requires opening a
  // modal to move focus inside it; without this it only happened to work
  // because a mouse click natively focuses the button that triggered it --
  // not true for a directly-set `fullscreen` property, and not guaranteed
  // for every input method/browser even in the click case.
  //
  // The `collapsed` branch covers the same modal-focus-trap requirement for
  // a second case: collapsing the body while fullscreen hides (display:none)
  // whatever was focused inside it, which the browser resolves by silently
  // moving focus outside the panel. The shared manager then reclaims it while
  // preserving focus that is still on one of the visible header controls.
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    // Each row's own content can alter scroll reachability without that row's own border box
    // changing at all -- the primary observers above only watch each row container itself, so
    // every current slotted action / rendered view-toggle rides along on its own controller's
    // single ResizeObserver instance instead of a second one of its own. The actions row is real
    // slotted (author) content, read via the live assigned-elements list rather than a
    // `[part="action"]` selector, which doesn't exist -- author markup owns its own parts.
    const actionsSlot = this.renderRoot.querySelector<HTMLSlotElement>(
      'slot[name="actions"]'
    );
    this.actionsScrollOverflow.observeExtra(
      actionsSlot ? actionsSlot.assignedElements({ flatten: true }) : []
    );
    this.viewTogglesScrollOverflow.observeExtra(
      this.renderRoot.querySelectorAll('[part="view-toggle"]')
    );
    // Persist `collapsed` whenever it changes, but never on the initial update -- willUpdate()
    // restored it on that pass, so writing it back would be redundant, and with no `storage-key`
    // set `writePersistedState(undefined, ...)` is a silent no-op regardless.
    if (this.persistReady && changed.has('collapsed')) {
      writePersistedState(this.storageFullKey, { collapsed: this.collapsed });
    }
    this.persistReady = true;
    if (changed.has('fullscreen') && this.fullscreen) {
      this.overlayHandle?.focusInitial();
    } else if (changed.has('collapsed') && this.fullscreen) {
      const panel =
        this.shadowRoot?.querySelector<HTMLElement>('[part="base"]');
      const active = deepActiveElement(this.ownerDocument);
      if (
        panel &&
        !collectFocusableElements(panel).includes(active as HTMLElement)
      ) {
        if (active && typeof (active as HTMLElement).blur === 'function')
          (active as HTMLElement).blur();
        this.overlayHandle?.focusInitial();
      }
    }
    if (changed.has('views') || changed.has('activeViewId')) {
      const focusedId = this.focusedViewIdBeforeUpdate;
      this.focusedViewIdBeforeUpdate = undefined;
      if (
        focusedId &&
        !this.views.some((view) => view.viewId === focusedId)
      ) {
        Array.from(
          this.renderRoot.querySelectorAll<HTMLElement>('[part="view-toggle"]')
        )
          .find((toggle) => toggle.dataset['viewId'] === this.activeViewId)
          ?.focus();
      }
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent that keeps this same
    // element instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns
    // to notice `fullscreen` is still true. Restore the shared overlay
    // registration and scroll lock it dropped.
    if (this.hasUpdated && this.fullscreen) {
      if (this.overlayHandle?.isActive()) {
        this.overlayHandle.resume();
      } else {
        this.activateFullscreenOverlay();
      }
      this.queueOwnerMicrotask(() => this.overlayHandle?.focusInitial());
    }
    if (this.hasUpdated) {
      this.queueOwnerMicrotask(() => {
        const slot =
          this.shadowRoot?.querySelector<HTMLSlotElement>('slot[name="label"]');
        if (slot) this.syncLabelSlot(slot.assignedElements({ flatten: true }));
      });
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.overlayHandle?.suspend();
    this.resetOwnerRealmWork();
  }

  override adoptedCallback(): void {
    super.adoptedCallback();
    this.resetOwnerRealmWork();
  }

  private resetOwnerRealmWork(): void {
    this.ownerRealmGeneration += 1;
    this.resetLabelSlotObserver();
  }

  private queueOwnerMicrotask(callback: VoidFunction): void {
    const ownerDocument = this.ownerDocument;
    const ownerWindow = ownerDocument.defaultView;
    if (!ownerWindow || !this.isConnected) return;
    const generation = this.ownerRealmGeneration;
    ownerWindow.queueMicrotask(() => {
      if (
        this.ownerRealmGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      callback();
    });
  }

  private activateFullscreenOverlay(): void {
    this.overlayHandle = activateOverlay({
      host: this,
      panel: () =>
        this.shadowRoot?.querySelector<HTMLElement>('[part="base"]') ?? null,
      onEscape: this.dismissFullscreen,
      onBackdrop: this.dismissFullscreen,
      restoreFocusTo: this.explicitTrigger,
      lockScroll: true,
      suspendWhenUnrendered: true,
    });
    this.explicitTrigger = undefined;
  }

  private deactivateFullscreenOverlay(): void {
    this.overlayHandle?.deactivate();
    this.overlayHandle = undefined;
  }

  private onActionsSlotChange = (e: Event): void => {
    this.hasActionsSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private onIconSlotChange = (e: Event): void => {
    this.hasIconSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private onLabelSlotChange = (e: Event): void => {
    const assigned = (e.target as HTMLSlotElement).assignedElements({
      flatten: true,
    });
    this.syncLabelSlot(assigned);
  };

  private syncLabelSlot(assigned: Element[]): void {
    this.hasLabelSlot = assigned.length > 0;
    this.labelSlotText = this.readLabelSlotText(assigned);
    this.resetLabelSlotObserver();
    if (assigned.length === 0 || !this.isConnected) return;
    const ownerDocument = this.ownerDocument;
    const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverCtor) return;
    const generation = this.labelSlotObserverGeneration;
    const observer = new MutationObserverCtor(() => {
      if (
        this.labelSlotObserver !== observer ||
        this.labelSlotObserverDocument !== ownerDocument ||
        this.labelSlotObserverGeneration !== generation ||
        !this.isConnected ||
        this.ownerDocument !== ownerDocument
      ) {
        return;
      }
      this.labelSlotText = this.readLabelSlotText(assigned);
    });
    this.labelSlotObserver = observer;
    this.labelSlotObserverDocument = ownerDocument;
    bindAccessibleTextObserver(observer, this, ['alt', 'aria-labelledby', 'slot']);
    for (const element of assigned) {
      observer.observe(element, {
        attributes: true,
        attributeFilter: ['alt', 'aria-hidden', 'aria-label', 'aria-labelledby', 'class', 'hidden', 'inert', 'style'],
        childList: true,
        characterData: true,
        subtree: true,
      });
    }
  }

  private readLabelSlotText(assigned: readonly Element[]): string | undefined {
    return (
      composedAccessibilityText(assigned).replace(/\s+/g, ' ').trim() || undefined
    );
  }

  private resetLabelSlotObserver(): void {
    this.labelSlotObserverGeneration += 1;
    this.labelSlotObserver?.disconnect();
    this.labelSlotObserver = undefined;
    this.labelSlotObserverDocument = undefined;
  }

  private onSublabelSlotChange = (e: Event): void => {
    this.hasSublabelSlot =
      (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length >
      0;
  };

  private setActiveView = (viewId: string): void => {
    if (viewId === this.activeViewId) return;
    const request = this.emit('lr-view-request', { viewId }, { cancelable: true });
    if (request.defaultPrevented) return;
    this.activeViewId = viewId;
    this.emit('lr-view-change', { viewId });
  };

  /** Emits the cancelable interaction proposal before touching the persisted
   *  property, while retaining lr-collapse-change as the existing post-commit
   *  notification. */
  private requestCollapse(next: boolean): void {
    const request = this.emit(
      'lr-collapse-request',
      { collapsed: next },
      { cancelable: true }
    );
    if (request.defaultPrevented) return;
    this.collapsed = next;
    this.emit('lr-collapse-change', { collapsed: next });
  }

  private toggleCollapsed = (): void => {
    this.requestCollapse(!this.collapsed);
  };

  /** Emits the cancelable lr-fullscreen-request proposal before touching the persisted property,
   *  while retaining lr-fullscreen-change as the existing post-commit notification. Returns
   *  whether the change was accepted, mirroring requestCollapse() above. */
  private requestFullscreenChange(next: boolean): boolean {
    const request = this.emit('lr-fullscreen-request', { fullscreen: next }, { cancelable: true });
    if (request.defaultPrevented) return false;
    this.fullscreen = next;
    this.emit('lr-fullscreen-change', { fullscreen: next });
    return true;
  }

  private toggleFullscreen = (e: MouseEvent): void => {
    const next = !this.fullscreen;
    const trigger = e.currentTarget as HTMLElement;
    if (!this.requestFullscreenChange(next)) return;
    if (next) this.explicitTrigger = trigger;
  };

  private dismissFullscreen = (): void => {
    if (!this.fullscreen) return;
    this.requestFullscreenChange(false);
  };

  private onBackdropClick = (): void => {
    this.overlayHandle?.dismissBackdrop();
  };

  override render(): TemplateResult {
    const hasLabel = this.label.length > 0;
    const hasSublabel = this.sublabel.length > 0;
    const views = this.views;
    const fullscreenInset = sanitizeCssInset(this.fullscreenInset);
    const backdropInset = sanitizeCssInset(this.backdropInset);
    return html`
      ${this.fullscreen
        ? html`<div
            part="backdrop"
            style=${backdropInset
              ? styleMap({ '--lr-widget-backdrop-inset': backdropInset })
              : nothing}
            @click=${this.onBackdropClick}
          ></div>`
        : nothing}
      <div
        part="base"
        role=${this.fullscreen ? 'dialog' : nothing}
        aria-modal=${this.fullscreen ? 'true' : nothing}
        aria-label=${this.fullscreen
          ? this.accessibleLabel ??
            (this.label ||
              this.labelSlotText ||
              this.localize('widgetFullscreenPanel'))
          : nothing}
        tabindex=${this.fullscreen ? '-1' : nothing}
        style=${fullscreenInset
          ? styleMap({ '--lr-widget-fullscreen-inset': fullscreenInset })
          : nothing}
      >
        <div part="header">
          <div part="title">
            ${renderInertPresentation(
              html`<slot name="icon" @slotchange=${this.onIconSlotChange}></slot>`,
              { part: 'icon', hidden: !this.hasIconSlot },
            )}
            <div part="label-group">
              <span part="label" ?hidden=${!hasLabel && !this.hasLabelSlot}
                ><slot name="label" @slotchange=${this.onLabelSlotChange}
                  >${this.label}</slot
                ></span
              >
              <span
                part="sublabel"
                ?hidden=${!hasSublabel && !this.hasSublabelSlot}
                ><slot name="sublabel" @slotchange=${this.onSublabelSlotChange}
                  >${this.sublabel}</slot
                ></span
              >
            </div>
          </div>
          <div part="actions" ?hidden=${!this.hasActionsSlot}>
            <slot name="actions" @slotchange=${this.onActionsSlotChange}></slot>
          </div>
          ${views.length > 0
            ? html`<div
                part="view-toggles"
                role="group"
                aria-label=${this.localize('widgetViewGroup')}
              >
                ${repeat(views, (view) => view.viewId, (view) => {
                  // `label` supplies the accessible name via its own visible text, same as
                  // before -- aria-label is only ever added for an icon-only toggle (`label`
                  // omitted), where `ariaLabel` is the intended name and `viewId` is the last-resort
                  // fallback if even that's missing (see LyraWidgetView's doc).
                  const hasLabel = !!view.label;
                  return html`<button
                    part="view-toggle"
                    type="button"
                    data-view-id=${view.viewId}
                    aria-pressed=${view.viewId === this.activeViewId ? 'true' : 'false'}
                    aria-label=${hasLabel ? nothing : view.ariaLabel || view.viewId}
                    @click=${() => this.setActiveView(view.viewId)}
                  >
                    ${view.icon
                      ? renderInertPresentation(view.icon, { part: 'view-icon' })
                      : nothing}${view.label
                      ? html`<span part="view-label">${view.label}</span>`
                      : nothing}
                  </button>`;
                })}
              </div>`
            : nothing}
          ${this.collapsible
            ? html`<button
                part="collapse-button"
                type="button"
                aria-expanded=${this.collapsed ? 'false' : 'true'}
                aria-label=${this.collapsed
                  ? this.localize('widgetExpand')
                  : this.localize('widgetCollapse')}
                aria-controls=${this.bodyId}
                @click=${this.toggleCollapsed}
              >
                ${renderInertPresentation(
                  html`<slot name="collapse-icon">${chevronIcon()}</slot>`,
                )}
              </button>`
            : nothing}
          ${this.expandable
            ? html`<button
                part="fullscreen-button"
                type="button"
                aria-pressed=${this.fullscreen ? 'true' : 'false'}
                aria-label=${this.fullscreen
                  ? this.localize('widgetExitFullscreen')
                  : this.localize('widgetExpandToFullscreen')}
                @click=${this.toggleFullscreen}
              >
                ${renderInertPresentation(html`
                  <slot name="fullscreen-icon"
                    >${this.fullscreen ? closeIcon() : expandIcon()}</slot
                  >
                `)}
              </button>`
            : nothing}
        </div>
        <div part="body" id=${this.bodyId} ?hidden=${this.collapsed}>
          ${views.length === 0
            ? html`<slot></slot>`
            : repeat(
                views,
                (view) => view.viewId,
                (view) =>
                  html`<div
                    data-view-id=${view.viewId}
                    ?hidden=${view.viewId !== this.activeViewId}
                  >
                    <slot name="view-${view.viewId}"></slot>
                  </div>`
              )}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-widget': LyraWidget;
  }
}
