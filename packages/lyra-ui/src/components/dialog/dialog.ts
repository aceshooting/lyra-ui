import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { nextId, srOnly } from '../../internal/a11y.js';
import { styles } from './dialog.styles.js';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6, [role="heading"]';

// Shadow-piercing so a slotted custom element's real focusable target (e.g.
// an <input> inside its own shadow root) is found even though the host tag
// itself doesn't match FOCUSABLE_SELECTOR. Deliberately duplicated from
// lyra-widget's identical helper rather than imported/shared -- widget's
// fullscreen mode is a separate feature and this component must not depend
// on it (see the module doc in dialog.ts's authoring notes).
function collectFocusable(el: Element): HTMLElement[] {
  const result: HTMLElement[] = [];
  if (el.matches(FOCUSABLE_SELECTOR)) {
    result.push(el as HTMLElement);
  }
  if (el instanceof HTMLSlotElement) {
    for (const assigned of el.assignedElements({ flatten: true })) {
      result.push(...collectFocusable(assigned));
    }
    return result;
  }
  const container: Element | ShadowRoot = el.shadowRoot ?? el;
  for (const child of Array.from(container.children)) {
    result.push(...collectFocusable(child));
  }
  return result;
}

/** Whether `el` is actually laid out/paintable -- `checkVisibility()` (falling
 *  back to `getClientRects().length` where unsupported) correctly follows
 *  flattened-tree/slot assignment, unlike `offsetParent`. Mirrors
 *  lyra-widget's identical helper. */
function isRendered(el: HTMLElement): boolean {
  return el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0;
}

/**
 * Reason a dialog was dismissed, forwarded as the `lyra-dialog-close` event
 * detail. `'escape'` and `'backdrop'` are emitted by the dialog's own built-in
 * dismiss triggers; any other string is whatever a caller passes to
 * `close()` (e.g. a consumer's own footer close button, or confirm.ts's
 * `'confirm'`/`'cancel'`).
 */
export type DialogCloseReason = 'escape' | 'backdrop' | 'api' | string;

/**
 * `<lyra-dialog>` — a general-purpose modal/overlay. `role="dialog"`,
 * focus-trapped while open, dismissible via Escape or a backdrop click, and
 * scroll-locks the document for as long as it's open. Chrome stays minimal —
 * no built-in title bar or close button; a consumer supplies a heading and
 * any close affordance itself via the default/`footer` slots.
 *
 * Accessible name: if a heading element (`h1`–`h6` or `[role="heading"]`) is
 * a *direct child* (not inside `slot="footer"`), its text content becomes
 * `aria-label` on the panel. Otherwise, when `label` is set, an invisible
 * (`.sr-only`, exposed as the `label` part) element carrying that text is
 * rendered inside the panel and `aria-labelledby` points at it instead.
 * Either way `label` itself never renders visible chrome — a slotted heading
 * is what a sighted user sees; `::part(label)` can be restyled to make the
 * sr-only text visible too, if a consumer wants that instead of slotting a
 * heading.
 *
 * The heading case deliberately uses `aria-label` (a copied string) rather
 * than `aria-labelledby` pointing at the heading's `id`: the heading is
 * *light-DOM* content while `[part="panel"]` lives in this element's
 * *shadow* tree, and an ID-reference attribute can't resolve across that
 * boundary (verified against axe's `aria-dialog-name` rule) — unlike the
 * `label`-prop case above, where the sr-only element is rendered inside the
 * same shadow root it labels, so `aria-labelledby` there is safe.
 *
 * @customElement lyra-dialog
 * @slot - The dialog body.
 * @slot footer - Action buttons, rendered in a bottom row.
 * @event lyra-dialog-close - `detail: DialogCloseReason`. Fired whenever the
 *   dialog is dismissed via Escape, a backdrop click, or a `close()` call.
 * @csspart backdrop - The full-viewport scrim behind the panel.
 * @csspart panel - The dialog panel itself (`role="dialog"` while open).
 * @csspart label - The invisible `label`-text element used for
 *   `aria-labelledby` when no heading is slotted.
 * @csspart body - The wrapper around the default slot.
 * @csspart footer - The wrapper around the `footer` slot.
 */
export class LyraDialog extends LyraElement {
  static styles = [LyraElement.styles, srOnly, styles];

  /** Whether the dialog is open. Set this (or call `close()`) — there is no separate `show()`/`hide()` pair. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Accessible name used when no heading is slotted — see the class doc for the full fallback order. */
  @property() label = '';

  @state() private hasFooterSlot = false;
  @state() private headingText?: string;

  private releaseScrollLock?: () => void;
  private lastTrigger?: HTMLElement;
  private readonly srLabelId = nextId('dialog-label');

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
      this.detectHeading();
    }
    if (changed.has('open')) {
      if (this.open) {
        // Captured here (before render) rather than from a click event on
        // some specific internal control -- unlike lyra-widget's fullscreen
        // toggle, a dialog's trigger typically lives *outside* the
        // component entirely, so "whatever had focus right before open"
        // is the only generally correct definition of "the trigger".
        const active = this.getActiveElement();
        this.lastTrigger = active instanceof HTMLElement ? active : undefined;
        this.releaseScrollLock = lockScroll();
        document.addEventListener('keydown', this.onDocKeyDown);
      } else {
        this.releaseScrollLock?.();
        this.releaseScrollLock = undefined;
        document.removeEventListener('keydown', this.onDocKeyDown);
      }
    }
  }

  // Runs after render (not willUpdate) so [part="panel"] has already landed
  // in the DOM before the fallback .focus() call below can rely on it --
  // mirrors lyra-widget's identical ordering rationale for its fullscreen mode.
  protected updated(changed: PropertyValues): void {
    if (changed.has('open') && this.open) {
      const first = this.getFocusableElements()[0];
      if (first) {
        first.focus();
      } else {
        this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]')?.focus();
      }
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    // A reconnect (e.g. a drag-and-drop reparent keeping this same element
    // instance) fires disconnectedCallback then connectedCallback
    // synchronously with no update in between, so willUpdate never reruns to
    // notice `open` is still true -- restore the scroll lock/trap it dropped.
    if (this.hasUpdated && this.open && !this.releaseScrollLock) {
      this.releaseScrollLock = lockScroll();
      document.addEventListener('keydown', this.onDocKeyDown);
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    document.removeEventListener('keydown', this.onDocKeyDown);
  }

  private onDefaultSlotChange = (): void => {
    this.detectHeading();
  };

  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  // Only direct children are scanned -- a heading nested several layers deep
  // (or inside a slotted custom element's own shadow root) is left to the
  // consumer to label explicitly via `label` instead. Same depth limit
  // lyra-widget applies to its own actions-slot presence check. Recomputed
  // only on slot assignment changes, not on every render -- a consumer that
  // mutates an already-slotted heading's textContent in place (rather than
  // replacing the node) won't retroactively update aria-label; set `label`
  // instead for a title that needs to change live.
  private detectHeading(): void {
    const heading = Array.from(this.children).find(
      (el) => el.getAttribute('slot') !== 'footer' && el.matches(HEADING_SELECTOR),
    ) as HTMLElement | undefined;
    this.headingText = heading?.textContent?.trim() || undefined;
  }

  /**
   * Close the dialog and return focus to whatever had it before the dialog
   * opened. `reason` is forwarded as the `lyra-dialog-close` detail --
   * built-in triggers pass `'escape'`/`'backdrop'`; a consumer's own close
   * affordance (e.g. a footer Cancel button) should call this directly with
   * its own reason string, so every dismissal path funnels through the same
   * event instead of the consumer having to also toggle `open` itself.
   */
  close(reason: DialogCloseReason = 'api'): void {
    if (!this.open) return;
    this.open = false;
    this.emit<DialogCloseReason>('lyra-dialog-close', reason);
    this.lastTrigger?.focus();
  }

  private onBackdropClick = (): void => {
    this.close('backdrop');
  };

  private onDocKeyDown = (e: KeyboardEvent): void => {
    if (!this.open) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close('escape');
      return;
    }
    if (e.key !== 'Tab') return;
    const focusable = this.getFocusableElements();
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = this.getActiveElement();
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Bounds Tab/Shift+Tab to the panel while open. Order follows the default
  // (body) slot, then the footer slot -- the same order the flattened tree
  // already tabs through.
  private getFocusableElements(): HTMLElement[] {
    const root = this.shadowRoot;
    if (!root) return [];
    const fromSlot = (selector: string): HTMLElement[] => {
      const slot = root.querySelector<HTMLSlotElement>(selector);
      return slot ? slot.assignedElements({ flatten: true }).flatMap(collectFocusable) : [];
    };
    return [...fromSlot('slot:not([name])'), ...fromSlot('slot[name="footer"]')].filter(isRendered);
  }

  private getActiveElement(): Element | null {
    let active: Element | null = document.activeElement;
    while (active) {
      const inner: Element | null = active.shadowRoot?.activeElement ?? null;
      if (!inner) break;
      active = inner;
    }
    return active;
  }

  render(): TemplateResult {
    const useSrLabel = !this.headingText && this.label.length > 0;
    return html`
      <div part="backdrop" @click=${this.onBackdropClick}></div>
      <div
        part="panel"
        role=${this.open ? 'dialog' : nothing}
        aria-modal=${this.open ? 'true' : nothing}
        aria-label=${this.headingText ?? nothing}
        aria-labelledby=${useSrLabel ? this.srLabelId : nothing}
        tabindex="-1"
      >
        ${useSrLabel
          ? html`<span id=${this.srLabelId} part="label" class="sr-only">${this.label}</span>`
          : nothing}
        <div part="body">
          <slot @slotchange=${this.onDefaultSlotChange}></slot>
        </div>
        <div part="footer" ?hidden=${!this.hasFooterSlot}>
          <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

defineElement('dialog', LyraDialog);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-dialog': LyraDialog;
  }
}
