import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './tool-approval-dialog.styles.js';
import '../json-viewer/json-viewer.js';

/**
 * Reason the dialog was dismissed, forwarded as the `lyra-close` event detail
 * -- mirrors `<lyra-dialog>`'s own `DialogCloseReason` shape. `'escape'`/
 * `'backdrop'` come from the dialog's own built-in dismiss triggers,
 * `'approve'`/`'deny'` from the built-in action buttons (fired in addition
 * to, and immediately after, their own dedicated `lyra-approve`/`lyra-deny`
 * event -- see the class doc), and any other string is whatever a caller
 * passes to `close()` directly.
 */
export type ToolApprovalDialogCloseReason = 'escape' | 'backdrop' | 'approve' | 'deny' | 'api' | string;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shadow-piercing so a slotted custom element's real focusable target, and
// this component's own directly-rendered <lyra-json-viewer>'s internal
// toggle/copy buttons, are found even though neither the slotted host tag
// nor <lyra-json-viewer> itself matches FOCUSABLE_SELECTOR. Deliberately
// duplicated from lyra-dialog's/lyra-tool-select-dialog's identical helper
// rather than imported/shared -- this component is its own standalone
// overlay and must not depend on either (see this file's class doc).
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
 *  lyra-dialog's/lyra-tool-select-dialog's identical helper. */
function isRendered(el: HTMLElement): boolean {
  return el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0;
}

/**
 * `<lyra-tool-approval-dialog>` — a human-in-the-loop gate: presents one
 * proposed tool/function call (`toolName` + `args`) and blocks an agent from
 * executing it until a person explicitly approves or denies it, with an
 * optional inline "edit the arguments before approving" step.
 *
 * This is its own standalone overlay implementation (`role="dialog"`,
 * focus-trapped, Escape/backdrop-dismissible, scroll-locking) rather than
 * nesting a `<lyra-dialog>` in its shadow template — see `<lyra-dialog>`'s
 * own header comment for why a new overlay component in this library
 * duplicates that pattern locally instead of composing the previous one.
 *
 * Approve/Deny/Edit are built-in chrome (not a `footer` slot a consumer must
 * assemble) — this component's interaction shape is fixed enough (there is
 * exactly one correct set of actions for "approve this call") that requiring
 * every consumer to re-build it would just be boilerplate. A `footer` slot is
 * still offered for *supplementary* content a consumer wants alongside those
 * buttons (e.g. a "remember this choice for this tool" checkbox) — its
 * content renders to the start of the action row, before Deny/Edit/Approve.
 *
 * Editing: while `editable`, an Edit button swaps the read-only
 * `<lyra-json-viewer>` for a plain `<textarea>` pre-filled with
 * `JSON.stringify(args, null, 2)`. Every keystroke is re-validated with
 * `JSON.parse` — the Approve button is `disabled` for as long as the current
 * textarea content fails to parse, so a malformed edit can never be silently
 * approved as either the broken text or a stale copy of the original args.
 * The same button relabels to "Cancel" while editing; clicking it discards
 * the draft entirely and returns to the read-only view of the *original*
 * `args` — there is no separate "save" step independent of Approve itself.
 * Both `editing` and any in-progress draft reset back to the read-only view
 * every time the dialog transitions from closed to open, so a reused
 * instance never leaks one proposal's half-finished edit into the next.
 *
 * Initial focus deliberately does *not* land on Approve (see `updated()`):
 * approving a tool call is a consequential, potentially irreversible action,
 * so a user who opens this dialog and reflexively presses Enter/Space before
 * reading anything should deny, not approve. Deny gets the initial focus
 * instead — the same "focus the safe action" convention a native destructive-
 * confirmation dialog (delete, discard, etc.) typically follows for its own
 * Cancel button — rather than the inert dialog panel, which would need an
 * extra Tab press before *any* action is reachable at all.
 *
 * @customElement lyra-tool-approval-dialog
 * @slot footer - Optional supplementary content (e.g. a "remember this
 * choice" checkbox), rendered before the built-in Deny/Edit/Approve buttons.
 * @event lyra-approve - The call was approved. `detail: { args }` — the
 * current, already-parsed arguments object: the original `args` prop, or (if
 * an edit was in progress) the user's edited-and-validated version. Always
 * followed by `lyra-close` with reason `'approve'`.
 * @event lyra-deny - The call was denied (no detail). Always followed by
 * `lyra-close` with reason `'deny'`.
 * @event lyra-close - `detail: ToolApprovalDialogCloseReason`. Fired exactly
 * once per dismissal — via Escape, a backdrop click, the Approve/Deny
 * buttons, or a `close()` call — so there is one consistent "this dialog is
 * now closed" signal regardless of which path triggered it.
 * @csspart backdrop - The full-viewport scrim behind the panel.
 * @csspart panel - The dialog panel itself (`role="dialog"` while open).
 * @csspart header - The wrapper around the heading.
 * @csspart tool-name - The `toolName` text within the heading.
 * @csspart body - The wrapper around the args view/editor.
 * @csspart args-view - The read-only `<lyra-json-viewer>` shown while not editing.
 * @csspart args-editor - The raw-JSON `<textarea>` shown while editing.
 * @csspart error - The inline "invalid JSON" message, shown only while editing with unparseable content.
 * @csspart footer - The action row wrapping the `footer` slot and the built-in buttons.
 * @csspart deny-button - The built-in Deny button.
 * @csspart edit-button - The built-in Edit/Cancel toggle button (only rendered while `editable`).
 * @csspart approve-button - The built-in Approve button — `disabled` while an in-progress edit is invalid JSON.
 */
export class LyraToolApprovalDialog extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Whether the dialog is open. Set this (or call `close()`) — there is no separate `show()`/`hide()` pair. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** The proposed tool/function's name, e.g. `web_search`. Drives the heading and the dialog's accessible name. */
  @property({ attribute: 'tool-name' }) toolName = '';

  /** The proposed call's arguments — any JSON-serializable value, rendered via `<lyra-json-viewer>` (or, while editing, stringified into the textarea). */
  @property({ attribute: false }) args: unknown = {};

  /** Whether an "Edit" affordance is offered at all. When `false`, `args` is always shown read-only and can never be changed before approval. */
  @property({ type: Boolean, reflect: true }) editable = true;

  @state() private editing = false;
  /** The textarea's current raw text while editing — deliberately independent of `args` until Approve is pressed, so a malformed in-progress edit never overwrites it. */
  @state() private draftText = '';
  /** `JSON.parse` failure message for `draftText`, or `''` while it parses cleanly. Empty string (not `undefined`) so it can drive `?hidden` directly. */
  @state() private draftError = '';

  private releaseScrollLock?: () => void;
  private lastTrigger?: HTMLElement;
  private readonly titleId = nextId('tool-approval-dialog-title');
  private readonly errorId = nextId('tool-approval-dialog-error');

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('open')) {
      if (this.open) {
        // Captured here (before render) rather than from a click event on
        // some specific internal control -- like lyra-dialog, a trigger
        // typically lives *outside* this component entirely, so "whatever
        // had focus right before open" is the only generally correct
        // definition of "the trigger".
        const active = this.getActiveElement();
        this.lastTrigger = active instanceof HTMLElement ? active : undefined;
        this.releaseScrollLock = lockScroll();
        document.addEventListener('keydown', this.onDocKeyDown);
        // Every open starts fresh in the read-only view -- a reused instance
        // must never carry a half-finished edit (or its error state) over
        // from whatever the previous proposal was.
        this.editing = false;
        this.draftText = '';
        this.draftError = '';
      } else {
        this.releaseScrollLock?.();
        this.releaseScrollLock = undefined;
        document.removeEventListener('keydown', this.onDocKeyDown);
      }
    }
    // A consumer flipping editable off mid-edit (e.g. a policy change
    // pushed while this dialog happens to be open) must not leave an
    // unreachable edit UI on screen with no Edit/Cancel button left to
    // dismiss it.
    if (changed.has('editable') && !this.editable && this.editing) {
      this.editing = false;
      this.draftText = '';
      this.draftError = '';
    }
  }

  // Runs after render (not willUpdate) so [part="panel"]/[part="deny-button"]
  // have already landed in the DOM before the focus calls below can rely on
  // them -- mirrors lyra-dialog's identical ordering rationale.
  protected updated(changed: PropertyValues): void {
    if (changed.has('open') && this.open) {
      // Deliberately the Deny button, not "the first focusable element" --
      // see the class doc's focus-management paragraph.
      const deny = this.shadowRoot?.querySelector<HTMLElement>('[part="deny-button"]');
      if (deny) {
        deny.focus();
      } else {
        this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]')?.focus();
      }
      return;
    }
    if (changed.has('editing') && this.editing) {
      // Entering edit mode is a deliberate request to start typing --
      // steering focus into the textarea beats leaving it on the Edit
      // button the click already left it on.
      this.shadowRoot?.querySelector<HTMLTextAreaElement>('[part="args-editor"]')?.focus();
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

  /**
   * Close the dialog and return focus to whatever had it before the dialog
   * opened. `reason` is forwarded as the `lyra-close` detail — built-in
   * triggers pass `'escape'`/`'backdrop'`/`'approve'`/`'deny'`; a consumer's
   * own close affordance (e.g. a footer-slotted button) should call this
   * directly with its own reason string, so every dismissal path funnels
   * through the same event instead of the consumer having to also toggle
   * `open` itself.
   */
  close(reason: ToolApprovalDialogCloseReason = 'api'): void {
    if (!this.open) return;
    this.open = false;
    this.emit<ToolApprovalDialogCloseReason>('lyra-close', reason);
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

  // Bounds Tab/Shift+Tab to the panel while open. Order follows the body
  // (the json-viewer's own toggle/copy buttons, or the textarea, depending
  // on `editing`), then the footer row (the footer slot, then Deny/Edit/
  // Approve) -- the same order the flattened tree already tabs through.
  // collectFocusable()'s own FOCUSABLE_SELECTOR check excludes the Approve
  // button for free while it's `disabled`, so an invalid in-progress edit
  // can't be Tab-trapped into.
  private getFocusableElements(): HTMLElement[] {
    const root = this.shadowRoot;
    if (!root) return [];
    const body = root.querySelector<HTMLElement>('[part="body"]');
    const footer = root.querySelector<HTMLElement>('[part="footer"]');
    return [...(body ? collectFocusable(body) : []), ...(footer ? collectFocusable(footer) : [])].filter(
      isRendered,
    );
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

  private stringifyArgs(): string {
    try {
      // JSON.stringify(undefined, ...) returns the *value* undefined, not a
      // string -- the ?? covers that alongside the try/catch's circular-
      // reference case, so the textarea always opens with real text.
      return JSON.stringify(this.args, null, 2) ?? 'null';
    } catch {
      return 'null';
    }
  }

  private toggleEdit = (): void => {
    if (this.editing) {
      this.editing = false;
      this.draftText = '';
      this.draftError = '';
    } else {
      this.editing = true;
      this.draftText = this.stringifyArgs();
      this.draftError = '';
    }
  };

  private onDraftInput = (e: Event): void => {
    const value = (e.target as HTMLTextAreaElement).value;
    this.draftText = value;
    try {
      JSON.parse(value);
      this.draftError = '';
    } catch (err) {
      this.draftError = err instanceof Error ? err.message : 'Invalid JSON.';
    }
  };

  private onApprove = (): void => {
    let currentArgs: unknown = this.args;
    if (this.editing) {
      // The Approve button is disabled whenever draftError is non-empty, so
      // this should always succeed -- the try/catch is defense-in-depth
      // against a state desync rather than an expected path.
      try {
        currentArgs = JSON.parse(this.draftText);
      } catch {
        return;
      }
    }
    this.emit<{ args: unknown }>('lyra-approve', { args: currentArgs });
    this.close('approve');
  };

  private onDeny = (): void => {
    this.emit('lyra-deny');
    this.close('deny');
  };

  render(): TemplateResult {
    const hasError = this.editing && this.draftError.length > 0;
    return html`
      <div part="backdrop" @click=${this.onBackdropClick}></div>
      <div
        part="panel"
        role=${this.open ? 'dialog' : nothing}
        aria-modal=${this.open ? 'true' : nothing}
        aria-labelledby=${this.titleId}
        tabindex="-1"
      >
        <div part="header">
          <h2 id=${this.titleId}>Approve <span part="tool-name">${this.toolName || 'tool'}</span> call?</h2>
        </div>
        <div part="body">
          ${this.editing
            ? html`
                <textarea
                  part="args-editor"
                  spellcheck="false"
                  autocomplete="off"
                  aria-label="Tool call arguments (JSON)"
                  aria-invalid=${hasError ? 'true' : 'false'}
                  aria-describedby=${hasError ? this.errorId : nothing}
                  .value=${this.draftText}
                  @input=${this.onDraftInput}
                ></textarea>
                <p part="error" id=${this.errorId} role="alert" ?hidden=${!hasError}>${this.draftError}</p>
              `
            : html`<lyra-json-viewer part="args-view" .data=${this.args}></lyra-json-viewer>`}
        </div>
        <div part="footer">
          <slot name="footer"></slot>
          <button part="deny-button" type="button" @click=${this.onDeny}>Deny</button>
          ${this.editable
            ? html`<button part="edit-button" type="button" @click=${this.toggleEdit}>
                ${this.editing ? 'Cancel' : 'Edit'}
              </button>`
            : nothing}
          <button part="approve-button" type="button" ?disabled=${hasError} @click=${this.onApprove}>
            Approve
          </button>
        </div>
      </div>
    `;
  }
}

defineElement('tool-approval-dialog', LyraToolApprovalDialog);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-tool-approval-dialog': LyraToolApprovalDialog;
  }
}
