import { html, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { hostAriaLabel } from '../../../internal/a11y.js';
import { composedParentElement } from '../../../internal/active-element.js';
import { setCustomState } from '../../../internal/custom-states.js';
import { isHtmlElement } from '../../../internal/dom-guards.js';
import { attachInternalsSafely } from '../../../internal/element-internals.js';
import {
  composedContains,
  deepActiveElement,
} from '../../../internal/nonmodal-overlay-manager.js';
import { tag } from '../../../internal/prefix.js';
import type { LyraSize } from '../../../internal/variants.js';
import type { MenuItemSelectDetail } from '../../layout/menu/menu.class.js';
import type { LyraDropdown } from '../overlay/dropdown.class.js';
import { styles } from './context-menu.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_menuLabel } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

/** Press duration, in milliseconds, after which a touch or pen press-and-hold opens the menu. */
const LONG_PRESS_DELAY_MS = 500;
/** Finger drift, in CSS pixels, a press-and-hold tolerates before it stops counting. */
const LONG_PRESS_TOLERANCE_PX = 10;
/** How long a decided keyboard or press-and-hold gesture absorbs the platform's follow-up event. */
const GESTURE_WINDOW_MS = 1000;
/** Main-axis gap between the anchor point and the popup, so the pointer never starts over it. */
const POINTER_GAP_PX = 2;
/** Anchor movement tolerated on a scroll or resize before a point-anchored menu closes. */
const ANCHOR_MOVE_TOLERANCE_PX = 2;

/** How an open request arrived. */
export type LyraContextMenuSource = 'pointer' | 'long-press' | 'keyboard' | 'programmatic';

/** The `lr-show` detail of `<lr-context-menu>`. */
export interface LyraContextMenuShowDetail {
  /** How the request arrived. A native `contextmenu` whose `pointerType` is `'touch'` reports
   *  `'long-press'`; a native `contextmenu` whose point falls outside its target is treated as
   *  element-anchored and reports `'keyboard'`. */
  readonly source: LyraContextMenuSource;
  /** Innermost element the gesture started on: the first element of the event's composed path, so
   *  it pierces open shadow roots, while a closed shadow root yields its host. `showAt()` reports
   *  `point.contextElement ?? null`. Because it can sit inside a component's shadow root,
   *  `target.closest()` may stop at that boundary; use `path` instead. */
  readonly target: Element | null;
  /** The elements of the gesture's composed path, innermost first, from `target` up to and
   *  including the region element (the host's child assigned to `slot="trigger"`). Crosses open
   *  shadow roots and slots, so `path.find((el) => el.matches('[data-id]'))` finds a light-DOM row
   *  even when `target` is inside a component's shadow root. Frozen. For `showAt()` it runs from
   *  `contextElement` to the region element when `contextElement` lies in this region, is
   *  `[contextElement]` when it lies elsewhere, and is empty without one. */
  readonly path: readonly Element[];
  /** Viewport (client) x coordinate, in CSS pixels, of the point the menu is anchored to. */
  readonly clientX: number;
  /** Viewport (client) y coordinate, in CSS pixels, of the point the menu is anchored to. */
  readonly clientY: number;
  /** The native event: the `contextmenu` event, the Shift+F10 or ContextMenu `keydown`, or the
   *  `pointerdown` that started a press-and-hold; `null` for `showAt()`. */
  readonly originalEvent: Event | null;
}

/** A viewport point for `showAt()`, optionally tied to an element for scroll and removal tracking. */
export interface LyraContextMenuPoint {
  x: number;
  y: number;
  contextElement?: Element;
}

export interface LyraContextMenuEventMap {
  'lr-show': CustomEvent<LyraContextMenuShowDetail>;
  'lr-after-show': CustomEvent<null>;
  'lr-hide': CustomEvent<null>;
  'lr-after-hide': CustomEvent<null>;
  'lr-select': CustomEvent<MenuItemSelectDetail>;
}

interface PendingPress {
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly target: Element;
  readonly path: readonly Element[];
  readonly down: PointerEvent;
  readonly selectionWasCollapsed: boolean;
  readonly editableTarget: boolean;
  timer?: number;
  view?: Window;
  decided?: 'open' | 'vetoed';
  release?: () => void;
}

interface RecentGesture {
  readonly kind: 'keyboard' | 'long-press';
  readonly vetoed: boolean;
  readonly until: number;
}

interface OpenRequest {
  readonly source: LyraContextMenuSource;
  readonly target: Element | null;
  readonly path: readonly Element[];
  readonly x: number;
  readonly y: number;
  readonly anchor?: Element;
  readonly originalEvent: Event | null;
  readonly returnFocusTo?: HTMLElement;
}

/** Claims shared by every instance in this realm, so one gesture never opens two menus. */
const claimed = new WeakSet<Event>();

const now = (): number => Date.now();

function isElementNode(value: unknown): value is Element {
  return typeof value === 'object' && value !== null && (value as Node).nodeType === 1;
}

function firstElement(path: readonly EventTarget[]): Element | null {
  for (const entry of path) if (isElementNode(entry)) return entry;
  return null;
}

function isEditableTarget(element: Element | null): boolean {
  if (!element) return false;
  if (element.localName === 'input' || element.localName === 'textarea') return true;
  return isHtmlElement(element) && element.isContentEditable;
}

function isContextMenuKey(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.altKey || event.metaKey) return false;
  return (event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu';
}

/**
 * `<lr-context-menu>` — turns any slotted region into a context-menu target. A platform
 * `contextmenu` (right-click, or Ctrl+click on macOS), a touch or pen press-and-hold, or Shift+F10
 * or the ContextMenu key while focus is inside the region opens the library's menu engine beside
 * the pointer, or below the focused element, and flips it at the viewport edges. The default slot
 * takes exactly what `<lr-dropdown>` takes: `lr-menu-item`/`lr-dropdown-item` rows (including
 * checkbox and radio rows, `details` shortcut text and submenus), `lr-menu-label`, `<hr>`
 * separators, or one consumer `<lr-menu>`. Rows must be direct children of the host (or of that
 * consumer menu); a wrapper element around rows removes them from keyboard navigation.
 *
 * `lr-show` is a real veto: preventing it keeps the menu closed and leaves the native event
 * un-prevented, so the platform's own menu appears. The one exception is iOS, where the region's
 * static `-webkit-touch-callout: none` has already suppressed link and image callouts; restore it
 * on specific elements with `-webkit-touch-callout: default` and veto `lr-show` for them. With
 * nested regions the innermost enabled region wins, and a gesture that starts inside an open menu,
 * dropdown or popover surface never opens a second menu. A context menu needs a point, so `open`
 * is read-only and there is no argument-less `show()`; use `showAt()` to open it programmatically.
 *
 * Escape, activating an item, an outside pointer and `hide()` close it and return focus to the
 * element focused inside the region when the gesture arrived (or to `showAt()`'s
 * `returnFocusTo`). Tabbing out of the menu closes it without moving focus back, which differs
 * from `lr-dropdown`. Scrolling or resizing that moves the anchor, or removing it, closes the menu
 * too; focus then returns, without scrolling, only if it was inside the menu. The popup is
 * positioned with a fixed strategy and does not read the cascading `--lr-positioning-strategy`.
 * The region itself gets no role or ARIA: make sure it contains a focusable element so Shift+F10
 * can reach it, and offer every critical action through another visible path too.
 *
 * @customElement lr-context-menu
 * @slot trigger - The region: any number of elements. Every gesture that starts inside them,
 *   including inside their open shadow roots, is considered.
 * @slot - `<lr-menu-item>`/`<lr-dropdown-item>` rows, `<lr-menu-label>`, `<hr>`, or one
 *   consumer-supplied `<lr-menu>`.
 * @csspart popup - The positioned menu surface.
 * @csspart content - The surface's padding wrapper.
 * @cssstate open - Present while the menu is open.
 * @event lr-show - The menu is about to open. `detail: LyraContextMenuShowDetail`. Cancelable;
 *   preventing it keeps the menu closed and leaves the platform menu in place.
 * @event lr-after-show - The menu is open and its transition has finished.
 * @event lr-hide - The menu is about to close. Cancelable; preventing it keeps the menu open.
 * @event lr-after-hide - The menu is closed and its transition has finished. Not delivered for a
 *   close that a new gesture interrupts before its transition settles.
 * @event lr-select - A menu item was activated. `detail: { item }`. Cancelable; preventing the
 *   event keeps the menu open. This is the menu's own event bubbling through.
 * @cssprop [--max-width=var(--lr-overlay-max-inline-size,var(--lr-size-20rem))] - Maximum inline
 *   size of the popup.
 * @cssprop [--show-duration=var(--lr-transition-fast)] - Opening transition duration.
 * @cssprop [--hide-duration=var(--lr-transition-fast)] - Closing transition duration.
 * @cssprop [--lr-overlay-surface=var(--lr-color-surface-overlay)] - Shared floating-surface fill.
 * @cssprop [--lr-overlay-border=var(--lr-color-border-subtle)] - Shared floating-surface edge
 *   colour.
 * @cssprop [--lr-overlay-radius=var(--lr-radius)] - Shared floating-surface corner radius.
 * @cssprop [--lr-overlay-shadow-anchored=var(--lr-shadow-m)] - Elevation of the anchored popup.
 * @cssprop [--lr-overlay-max-inline-size=var(--lr-size-20rem)] - Maximum inline size fallback of
 *   the popup.
 * @status experimental
 * @since unreleased
 */
export class LyraContextMenu extends LyraElement<LyraContextMenuEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    menuLabel: LYRA_DEFAULT_menuLabel,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];

  protected static override readonly immutableEventDetails = Object.freeze(['lr-show']);

  protected static override readonly identityEventDetailProperties = Object.freeze({
    'lr-show': Object.freeze(['target', 'originalEvent']),
  });

  protected static override readonly identityEventDetailCollectionItems = Object.freeze({
    'lr-show': Object.freeze(['path']),
  });

  /** Accessible name of the generated menu. A consumer `<lr-menu>`'s own name wins, then a host
   *  `aria-label`, then this, then the localized "Menu". An empty value behaves like unset. */
  @property() label?: string;

  /** Stops every gesture from opening the menu and leaves native events alone. Becoming disabled
   *  while open closes the menu.
   *  @default false */
  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Density propagated to the directly owned rows. */
  @property({ reflect: true }) size: LyraSize = 'm';

  @query('.shell') private shell?: LyraDropdown;

  private readonly contextMenuInternals = attachInternalsSafely(this);
  private press?: PendingPress;
  private gesture?: RecentGesture;
  private swallowClickUntil = 0;
  private returnFocusTo?: HTMLElement;
  private anchorElement?: Element;
  private anchorRect?: DOMRect;
  private watchCleanup?: () => void;
  private expectingInnerShow = false;
  private silentClose = false;
  private closingForMove = false;

  /** Whether the menu is open. Read-only: open it with a gesture or `showAt()`. It stays `true`
   *  inside `lr-hide` handlers, until the close commits. */
  get open(): boolean {
    return this.shell?.open ?? false;
  }

  /**
   * Opens the menu at a viewport point, for example from a canvas's or map's own event handler.
   * Emits a cancelable `lr-show` with `source: 'programmatic'`. Focus returns to
   * `options.returnFocusTo` when supplied, otherwise to the element focused at call time only if
   * it lies inside this region or inside `point.contextElement`; pass `returnFocusTo` when opening
   * from a control outside the region. `contextElement` is watched so scrolling it away or
   * removing it closes the menu. While open, the call silently re-anchors the menu with no
   * lifecycle events and keeps the original return target unless a new one is supplied.
   * Non-finite coordinates, a disabled instance and a disconnected host are ignored.
   */
  showAt(point: LyraContextMenuPoint, options?: { returnFocusTo?: HTMLElement }): void {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    if (this.disabled || !this.isConnected) return;
    const contextElement = point.contextElement;
    if (this.open) {
      if (options?.returnFocusTo) this.returnFocusTo = options.returnFocusTo;
      this.shell?.showAt(
        { x: point.x, y: point.y, contextElement },
        { returnFocusTo: this.returnFocusTo },
      );
      if (contextElement) this.startWatching(contextElement);
      else this.stopWatching();
      return;
    }
    this.requestOpen({
      source: 'programmatic',
      target: contextElement ?? null,
      path: contextElement ? this.contextElementPath(contextElement) : [],
      x: point.x,
      y: point.y,
      anchor: contextElement,
      originalEvent: null,
      returnFocusTo: options?.returnFocusTo,
    });
  }

  /** Closes the menu and resolves after `lr-after-hide`, or once a new open supersedes the close.
   *  Focus returns to the captured target unless `focusTrigger` is `false`. No-op when closed. */
  hide(options?: { focusTrigger?: boolean }): Promise<void> {
    return this.shell?.hide(options) ?? Promise.resolve();
  }

  private get resolvedLabel(): string {
    return hostAriaLabel(this) || this.label || this.localize('menuLabel');
  }

  override disconnectedCallback(): void {
    this.cancelPress();
    this.gesture = undefined;
    this.swallowClickUntil = 0;
    this.stopWatching();
    const shell = this.shell;
    if (shell?.open) {
      // Deliberately not cleared on reconnect: after a same-task reparent the inner after-hide
      // still arrives, and it must stay silent. The inner after-hide or the next open clears it.
      this.silentClose = true;
      void shell.hide({ focusTrigger: false });
    }
    setCustomState(this.contextMenuInternals, 'open', false);
    this.returnFocusTo = undefined;
    this.anchorElement = undefined;
    this.anchorRect = undefined;
    this.expectingInnerShow = false;
    this.closingForMove = false;
    super.disconnectedCallback();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('disabled') && this.disabled) this.cancelPress();
  }

  // ---- gesture arbitration -------------------------------------------------------------------

  /** True when the event started inside an open popover or dropdown surface placed in the region
   *  (as opposed to on its slotted trigger). Tag names, not classes, so two library copies agree. */
  private inForeignOpenSurface(event: Event): boolean {
    const path = event.composedPath();
    const surfaceTags = new Set([tag('popover'), tag('dropdown')]);
    for (let index = 0; index < path.length; index += 1) {
      const entry = path[index];
      if (entry === this) break;
      if (!isElementNode(entry) || !surfaceTags.has(entry.localName)) continue;
      if ((entry as Element & { open?: unknown }).open !== true) continue;
      const child = path
        .slice(0, index)
        .find((node): node is Element => isElementNode(node) && node.parentElement === entry);
      if (!child || child.getAttribute('slot') !== 'trigger') return true;
    }
    return false;
  }

  /** The event's composed path, innermost first, up to and including the region element. */
  private regionPath(path: readonly EventTarget[]): Element[] {
    const elements: Element[] = [];
    for (const entry of path) {
      if (!isElementNode(entry)) continue;
      elements.push(entry);
      if (entry.parentElement === this) break;
    }
    return elements;
  }

  private contextElementPath(contextElement: Element): Element[] {
    const elements: Element[] = [];
    let current: Element | null = contextElement;
    while (current) {
      elements.push(current);
      if (current.parentElement === this && current.getAttribute('slot') === 'trigger') {
        return elements;
      }
      if (current === this) break;
      current = composedParentElement(current);
    }
    return [contextElement];
  }

  private onRegionContextMenu = (event: MouseEvent): void => {
    if (claimed.has(event) || event.defaultPrevented || this.disabled) return;
    if (this.inForeignOpenSurface(event)) return;
    claimed.add(event);
    if (this.open) {
      event.preventDefault();
      return;
    }
    const gesture = this.gesture;
    if (gesture && now() < gesture.until && gesture.vetoed) {
      this.gesture = undefined;
      return;
    }
    if (this.press?.decided === 'vetoed') return;
    if (this.press && !this.press.decided) {
      this.press.decided = 'open';
      this.cancelPress();
    }
    const path = event.composedPath();
    const target = firstElement(path);
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const pointInside =
      event.clientX >= rect.left - 1 &&
      event.clientX <= rect.right + 1 &&
      event.clientY >= rect.top - 1 &&
      event.clientY <= rect.bottom + 1;
    let source: LyraContextMenuSource;
    let x = event.clientX;
    let y = event.clientY;
    if (pointInside) {
      source = (event as Partial<PointerEvent>).pointerType === 'touch' ? 'long-press' : 'pointer';
    } else {
      source = 'keyboard';
      [x, y] = this.elementPoint(target);
    }
    const opened = this.requestOpen({
      source,
      target,
      path: this.regionPath(path),
      x,
      y,
      anchor: target,
      originalEvent: event,
    });
    if (opened) event.preventDefault();
  };

  private onRegionKeyDown = (event: KeyboardEvent): void => {
    this.gesture = undefined;
    if (claimed.has(event) || event.defaultPrevented || event.isComposing) return;
    if (this.inForeignOpenSurface(event)) return;
    if (!isContextMenuKey(event) || this.disabled) return;
    claimed.add(event);
    const path = event.composedPath();
    const anchor = firstElement(path);
    if (!anchor) return;
    const [x, y] = this.elementPoint(anchor);
    if (this.open) {
      event.preventDefault();
      this.shell?.showAt({ x, y, contextElement: anchor }, { returnFocusTo: this.returnFocusTo });
      this.startWatching(anchor);
      this.gesture = { kind: 'keyboard', vetoed: false, until: now() + GESTURE_WINDOW_MS };
      return;
    }
    const opened = this.requestOpen({
      source: 'keyboard',
      target: anchor,
      path: this.regionPath(path),
      x,
      y,
      anchor,
      originalEvent: event,
    });
    if (opened) event.preventDefault();
    this.gesture = { kind: 'keyboard', vetoed: !opened, until: now() + GESTURE_WINDOW_MS };
  };

  private onRegionPointerDown = (event: PointerEvent): void => {
    this.gesture = undefined;
    this.swallowClickUntil = 0;
    if (this.press) this.cancelPress();
    if (claimed.has(event) || this.disabled || this.inForeignOpenSurface(event)) return;
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    if (!event.isPrimary || event.button !== 0) return;
    claimed.add(event);
    const path = event.composedPath();
    const target = firstElement(path);
    const ownerDocument = this.ownerDocument;
    const view = ownerDocument.defaultView;
    if (!target || !view) return;
    const selection = ownerDocument.getSelection();
    const press: PendingPress = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      target,
      path: this.regionPath(path),
      down: event,
      selectionWasCollapsed: !selection || selection.rangeCount === 0 || selection.isCollapsed,
      editableTarget: isEditableTarget(target),
      view,
    };
    const onMove = (move: PointerEvent): void => {
      if (move.pointerId !== press.pointerId) return;
      const distance = Math.hypot(move.clientX - press.startX, move.clientY - press.startY);
      if (distance > LONG_PRESS_TOLERANCE_PX) this.endPress(press);
    };
    const onEnd = (end: PointerEvent): void => {
      if (end.pointerId === press.pointerId) this.endPress(press);
    };
    const onScroll = (): void => this.endPress(press);
    const listen = { capture: true, passive: true } as const;
    ownerDocument.addEventListener('pointermove', onMove, listen);
    ownerDocument.addEventListener('pointerup', onEnd, listen);
    ownerDocument.addEventListener('pointercancel', onEnd, listen);
    ownerDocument.addEventListener('scroll', onScroll, listen);
    press.release = () => {
      ownerDocument.removeEventListener('pointermove', onMove, listen);
      ownerDocument.removeEventListener('pointerup', onEnd, listen);
      ownerDocument.removeEventListener('pointercancel', onEnd, listen);
      ownerDocument.removeEventListener('scroll', onScroll, listen);
    };
    press.timer = view.setTimeout(() => this.onPressTimer(press), LONG_PRESS_DELAY_MS);
    this.press = press;
  };

  private onPressTimer(press: PendingPress): void {
    if (this.press !== press) return;
    press.timer = undefined;
    if (this.open) {
      press.decided = 'open';
      this.endPress(press);
      return;
    }
    const opened = this.requestOpen({
      source: 'long-press',
      target: press.target,
      path: press.path,
      x: press.startX,
      y: press.startY,
      anchor: press.target,
      originalEvent: press.down,
    });
    press.decided = opened ? 'open' : 'vetoed';
    if (opened) {
      this.clearPressSelection(press);
      this.swallowClickUntil = now() + GESTURE_WINDOW_MS;
    } else {
      this.gesture = { kind: 'long-press', vetoed: true, until: now() + GESTURE_WINDOW_MS };
    }
  }

  /** Removes a selection the press itself created in the region; pre-existing and editable
   *  selections are left alone. */
  private clearPressSelection(press: PendingPress): void {
    if (!press.selectionWasCollapsed || press.editableTarget) return;
    const selection = this.ownerDocument.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const anchorNode = selection.anchorNode;
    const anchorElement = isElementNode(anchorNode) ? anchorNode : anchorNode?.parentElement ?? null;
    if (anchorElement && composedContains(this, anchorElement)) selection.removeAllRanges();
  }

  /** Stops listening for the press; a decided press stays recorded for deduplication until the
   *  next pointerdown or keydown. */
  private endPress(press: PendingPress): void {
    if (press.timer !== undefined) press.view?.clearTimeout(press.timer);
    press.timer = undefined;
    press.release?.();
    press.release = undefined;
    if (this.press === press && !press.decided) this.press = undefined;
  }

  private cancelPress(): void {
    const press = this.press;
    if (!press) return;
    this.endPress(press);
    this.press = undefined;
  }

  private onRegionClick = (event: MouseEvent): void => {
    if (now() >= this.swallowClickUntil) return;
    this.swallowClickUntil = 0;
    event.preventDefault();
    event.stopPropagation();
  };

  // ---- surface claims ------------------------------------------------------------------------

  private onSurfacePointerDown = (event: PointerEvent): void => {
    claimed.add(event);
  };

  private onSurfaceKeyDown = (event: KeyboardEvent): void => {
    claimed.add(event);
    if (isContextMenuKey(event)) event.preventDefault();
  };

  private onSurfaceContextMenu = (event: MouseEvent): void => {
    claimed.add(event);
    if (!isEditableTarget(firstElement(event.composedPath()))) event.preventDefault();
  };

  private onSurfaceFocusOut = (event: FocusEvent): void => {
    const shell = this.shell;
    const next = event.relatedTarget;
    if (!shell || !this.open || !isElementNode(next)) return;
    if (composedContains(shell, next)) return;
    void this.hide({ focusTrigger: false });
  };

  // ---- opening -------------------------------------------------------------------------------

  private requestOpen(request: OpenRequest): boolean {
    const shell = this.shell;
    if (this.disabled || !this.isConnected || this.open || !shell) return false;
    this.silentClose = false;
    const returnFocusTo = request.returnFocusTo ?? this.relatedFocusTarget(request);
    const event = this.emit('lr-show', {
      source: request.source,
      target: request.target,
      path: Object.freeze([...request.path]),
      clientX: request.x,
      clientY: request.y,
      originalEvent: request.originalEvent,
    }, { cancelable: true });
    if (event.defaultPrevented) return false;
    if (this.disabled || !this.isConnected) return false;
    this.expectingInnerShow = true;
    try {
      shell.showAt(
        { x: request.x, y: request.y, contextElement: request.anchor },
        { returnFocusTo },
      );
    } finally {
      this.expectingInnerShow = false;
    }
    if (!shell.open) return false;
    this.returnFocusTo = returnFocusTo;
    setCustomState(this.contextMenuInternals, 'open', true);
    if (request.anchor) this.startWatching(request.anchor);
    else this.stopWatching();
    return true;
  }

  /** The element focused when the request arrived, kept only when it is related to the gesture:
   *  inside this region, or inside `showAt()`'s context element. */
  private relatedFocusTarget(request: OpenRequest): HTMLElement | undefined {
    const ownerDocument = this.ownerDocument;
    const active = deepActiveElement(ownerDocument);
    if (!isHtmlElement(active) || active === ownerDocument.body) return undefined;
    if (active.ownerDocument !== ownerDocument) return undefined;
    if (composedContains(this, active)) return active;
    if (
      request.source === 'programmatic' &&
      request.anchor &&
      composedContains(request.anchor, active)
    ) {
      return active;
    }
    return undefined;
  }

  /** The inline-start/bottom corner of the element's visible rect, clamped to the viewport. */
  private elementPoint(anchor: Element): [number, number] {
    const rect = anchor.getBoundingClientRect();
    const root = this.ownerDocument.documentElement;
    const width = root.clientWidth;
    const height = root.clientHeight;
    let left = Math.max(rect.left, 0);
    let right = Math.min(rect.right, width);
    let top = Math.max(rect.top, 0);
    let bottom = Math.min(rect.bottom, height);
    if (left > right || top > bottom) {
      left = Math.min(Math.max(rect.left, 0), width);
      right = Math.min(Math.max(rect.right, 0), width);
      top = Math.min(Math.max(rect.top, 0), height);
      bottom = Math.min(Math.max(rect.bottom, 0), height);
    }
    const x = this.effectiveDirection === 'rtl' ? right : left;
    return [x, bottom];
  }

  // ---- lifecycle forwarding ------------------------------------------------------------------

  private onInnerShow = (event: Event): void => {
    if (event.target !== this.shell) return;
    event.stopPropagation();
    if (!this.expectingInnerShow) event.preventDefault();
  };

  private onInnerAfterShow = (event: Event): void => {
    if (event.target !== this.shell) return;
    event.stopPropagation();
    if (!this.silentClose) this.emit('lr-after-show');
  };

  private onInnerHide = (event: Event): void => {
    if (event.target !== this.shell) return;
    event.stopPropagation();
    if (this.silentClose) return;
    const hide = this.emit('lr-hide', null, { cancelable: true });
    if (hide.defaultPrevented) {
      event.preventDefault();
      if (this.closingForMove) this.stopWatching();
      return;
    }
    setCustomState(this.contextMenuInternals, 'open', false);
    this.stopWatching();
  };

  private onInnerAfterHide = (event: Event): void => {
    if (event.target !== this.shell) return;
    event.stopPropagation();
    if (this.silentClose) this.silentClose = false;
    else this.emit('lr-after-hide');
    this.returnFocusTo = undefined;
    this.anchorElement = undefined;
    this.anchorRect = undefined;
  };

  // ---- anchor watcher ------------------------------------------------------------------------

  /** Watches only what can strand a point-anchored menu: scrolling, viewport resize and removal.
   *  Layout shift and the anchor's own size or transform changes are deliberately ignored. */
  private startWatching(anchor: Element): void {
    this.stopWatching();
    const ownerDocument = anchor.ownerDocument;
    const view = ownerDocument.defaultView;
    this.anchorElement = anchor;
    this.anchorRect = anchor.getBoundingClientRect();
    const roots = new Set<Document | ShadowRoot>([ownerDocument]);
    for (let current: Element | null = anchor; current; current = composedParentElement(current)) {
      const root = current.getRootNode();
      if (root !== ownerDocument && (root as ShadowRoot).host) roots.add(root as ShadowRoot);
    }
    const onScroll = (event: Event): void => {
      const target = event.target;
      const qualifies =
        (target as Node | null)?.nodeType === 9 ||
        (isElementNode(target) && composedContains(target, anchor));
      if (qualifies) this.checkAnchor(anchor);
    };
    const onResize = (): void => this.checkAnchor(anchor);
    const listen = { capture: true, passive: true } as const;
    for (const root of roots) root.addEventListener('scroll', onScroll, listen);
    view?.addEventListener('resize', onResize, { passive: true });
    const visualViewport = view?.visualViewport;
    visualViewport?.addEventListener('resize', onResize, { passive: true });
    const ResizeObserverCtor = view?.ResizeObserver;
    const observer = ResizeObserverCtor
      ? new ResizeObserverCtor(() => {
          if (!anchor.isConnected) this.checkAnchor(anchor);
        })
      : undefined;
    observer?.observe(anchor);
    this.watchCleanup = () => {
      for (const root of roots) root.removeEventListener('scroll', onScroll, listen);
      view?.removeEventListener('resize', onResize);
      visualViewport?.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }

  private stopWatching(): void {
    const cleanup = this.watchCleanup;
    this.watchCleanup = undefined;
    cleanup?.();
  }

  private checkAnchor(anchor: Element): void {
    if (!this.open || this.anchorElement !== anchor) return;
    if (anchor.isConnected) {
      const baseline = this.anchorRect;
      const current = anchor.getBoundingClientRect();
      if (
        baseline &&
        Math.abs(current.left - baseline.left) <= ANCHOR_MOVE_TOLERANCE_PX &&
        Math.abs(current.top - baseline.top) <= ANCHOR_MOVE_TOLERANCE_PX
      ) {
        return;
      }
    }
    this.closeForMove();
  }

  private closeForMove(): void {
    const shell = this.shell;
    if (!shell) return;
    const focusWasInMenu = composedContains(shell, deepActiveElement(this.ownerDocument));
    const returnFocusTo = this.returnFocusTo;
    this.closingForMove = true;
    try {
      void shell.hide({ focusTrigger: false });
    } finally {
      this.closingForMove = false;
    }
    if (!shell.open && focusWasInMenu && returnFocusTo?.isConnected) {
      returnFocusTo.focus({ preventScroll: true });
    }
  }

  override render(): TemplateResult {
    return html`
      <span
        class="trigger"
        @contextmenu=${this.onRegionContextMenu}
        @keydown=${this.onRegionKeyDown}
        @pointerdown=${this.onRegionPointerDown}
        @click=${{ handleEvent: this.onRegionClick, capture: true }}
        ><slot name="trigger"></slot
      ></span>
      <lr-dropdown
        class="shell"
        exportparts="popup, content"
        trigger="manual"
        placement="right-start"
        positioning-strategy="fixed"
        .distance=${POINTER_GAP_PX}
        .size=${this.size}
        .disabled=${this.disabled}
        .accessibleLabel=${this.resolvedLabel}
        @lr-show=${this.onInnerShow}
        @lr-after-show=${this.onInnerAfterShow}
        @lr-hide=${this.onInnerHide}
        @lr-after-hide=${this.onInnerAfterHide}
        @pointerdown=${this.onSurfacePointerDown}
        @keydown=${this.onSurfaceKeyDown}
        @contextmenu=${this.onSurfaceContextMenu}
        @focusout=${this.onSurfaceFocusOut}
        ><slot></slot
      ></lr-dropdown>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'lr-context-menu': LyraContextMenu;
  }
}
