import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './tool-select-dialog.styles.js';
import '../checkbox/checkbox.js';
import '../switch/switch.js';

/** One selectable agent tool. `category` groups the row; tools with no
 *  `category` (or an empty one) fall into the trailing "Other" bucket. */
export interface ToolSelectDialogTool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  /** Literal icon hint (e.g. an emoji), rendered next to `name` -- same
   *  "opaque string, not a registry lookup" convention as `<lyra-tool-call-chip>`'s `icon`. */
  icon?: string;
  /** Individually gates this tool regardless of `useDefaults`/`selected` -- e.g. a tool that
   *  requires admin approval before it can ever be enabled. */
  disabled?: boolean;
  /** Supporting text shown under a `disabled` row (e.g. "requires admin approval"). Ignored when `disabled` is falsy. */
  disabledReason?: string;
}

/** Predicate deciding whether `tool` matches a (already-trimmed, already-lowercased) `query`.
 *  Mirrors `<lyra-combobox>`'s `OptionFilter` convention -- override `filter` to replace the
 *  built-in case-insensitive name/description substring match entirely. */
export type ToolSelectFilter = (tool: ToolSelectDialogTool, query: string) => boolean;

export interface ToolSelectionChangeDetail {
  selected: string[];
  useDefaults: boolean;
}

/**
 * Reason the dialog was dismissed, forwarded as the `lyra-close` event detail
 * -- mirrors `<lyra-dialog>`'s own `DialogCloseReason` shape. `'escape'`/
 * `'backdrop'` come from the dialog's own built-in dismiss triggers; any
 * other string is whatever a caller passes to `close()` directly (e.g. a
 * consumer's own footer Done button).
 */
export type ToolSelectDialogCloseReason = 'escape' | 'backdrop' | 'api' | string;

const OTHER_CATEGORY = 'Other';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shadow-piercing so both a slotted custom element's real focusable target
// (footer content) and a directly-rendered one (the search input, the
// use-defaults <lyra-switch>, each row's <lyra-checkbox> -- all live in this
// component's own shadow tree, not projected via <slot>) are found even
// though the tag itself doesn't match FOCUSABLE_SELECTOR. Deliberately
// duplicated from lyra-dialog's/lyra-tool-result-dialog's identical helper
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
 *  lyra-dialog's/lyra-tool-result-dialog's identical helper. */
function isRendered(el: HTMLElement): boolean {
  return el.checkVisibility ? el.checkVisibility() : el.getClientRects().length > 0;
}

/** Default `filter`: case-insensitive substring match against the tool's name and description. */
function defaultFilter(tool: ToolSelectDialogTool, query: string): boolean {
  return tool.name.toLowerCase().includes(query) || (tool.description ?? '').toLowerCase().includes(query);
}

interface ToolGroup {
  category: string;
  tools: ToolSelectDialogTool[];
}

/**
 * `<lyra-tool-select-dialog>` — a category-grouped, filterable, searchable
 * tool-enablement dialog for picking which agent tools are available in a
 * conversation.
 *
 * This is its own standalone overlay implementation (`role="dialog"`,
 * focus-trapped, Escape/backdrop-dismissible, scroll-locking) rather than
 * nesting a `<lyra-dialog>` in its shadow template — see `<lyra-dialog>`'s
 * own header comment for why a new overlay component in this library
 * duplicates that pattern locally instead of composing the previous one.
 *
 * `useDefaults` is a single top-level switch: while `true`, every per-tool
 * checkbox below renders disabled (still reflecting whatever `selected`
 * holds — a consumer should populate that with its own default tool set
 * whenever `useDefaults` is true) and a hint explains that turning the
 * switch off is how to customize. Turning it off is the "customize"
 * affordance — it's the only thing that both flips `useDefaults` to `false`
 * *and* unlocks the per-tool checkboxes for editing, so there's exactly one
 * control for that transition rather than a separate button duplicating it.
 *
 * There is no built-in footer/close button — like `<lyra-dialog>`, dismissal
 * happens via Escape, a backdrop click, or a consumer's own `footer`-slotted
 * action calling `close()`. This also means the search input is the very
 * first focusable element in the panel with no special-casing needed, so
 * it's what receives focus on open (see `updated()`).
 *
 * @customElement lyra-tool-select-dialog
 * @slot footer - Optional action buttons (e.g. a "Done" button), rendered in a bottom row.
 * Changes already apply live via `lyra-change`, so this is optional.
 * @event lyra-change - The enabled-tool selection or the `useDefaults` toggle changed.
 * `detail: { selected: string[], useDefaults: boolean }`.
 * @event lyra-close - `detail: ToolSelectDialogCloseReason`. Fired exactly once per dismissal,
 * via Escape, a backdrop click, or a `close()` call.
 * @csspart backdrop - The full-viewport scrim behind the panel.
 * @csspart panel - The dialog panel itself (`role="dialog"` while open).
 * @csspart header - The wrapper around the title/subtitle.
 * @csspart title - The dialog's heading.
 * @csspart subtitle - The "N of M tools enabled" summary line.
 * @csspart search-row - The wrapper around the search input.
 * @csspart search-input - The filter text input.
 * @csspart defaults-row - The wrapper around the use-defaults switch and its hint.
 * @csspart defaults-toggle - The built-in `<lyra-switch>` bound to `useDefaults`.
 * @csspart defaults-hint - The "turn off to customize" hint, shown only while `useDefaults` is true.
 * @csspart body - The scrollable wrapper around the grouped tool list.
 * @csspart empty - The "no tools" / "no matches" message.
 * @csspart category - A single category's wrapper (`role="group"`).
 * @csspart category-heading - A category's heading.
 * @csspart category-count - The visible tool count next to a category heading.
 * @csspart category-list - The `<ul>` of tool rows within a category.
 * @csspart tool-row - A single tool's `<li>` row.
 * @csspart tool-checkbox - A row's `<lyra-checkbox>`.
 * @csspart tool-name - A row's name text (plus its `icon`, if set).
 * @csspart tool-icon - A row's leading icon glyph, when `icon` is set.
 * @csspart tool-description - A row's optional description text.
 * @csspart tool-disabled-reason - A disabled row's `disabledReason` text.
 * @csspart footer - The wrapper around the `footer` slot.
 */
export class LyraToolSelectDialog extends LyraElement {
  static styles = [LyraElement.styles, styles];

  /** Whether the dialog is open. Set this (or call `close()`) — there is no separate `show()`/`hide()` pair. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** The full set of tools a consumer offers, across all categories. */
  @property({ attribute: false }) tools: ToolSelectDialogTool[] = [];

  /** The currently-enabled tool ids. */
  @property({ attribute: false }) selected: string[] = [];

  /** Whether the conversation is using the default tool set (`true`) or a custom selection (`false`) — see the class doc for the exact interaction with `selected`/per-tool editing. */
  @property({ type: Boolean, reflect: true, attribute: 'use-defaults' }) useDefaults = false;

  /** The dialog's visible heading and accessible name. */
  @property() label = 'Select tools';

  @property({ attribute: 'search-placeholder' }) searchPlaceholder = 'Search tools…';

  /** Overrides the built-in case-insensitive name/description substring match. */
  @property({ attribute: false }) filter: ToolSelectFilter | null = null;

  @state() private query = '';
  @state() private hasFooterSlot = false;

  private releaseScrollLock?: () => void;
  private lastTrigger?: HTMLElement;
  private readonly titleId = nextId('tool-select-dialog-title');
  // Stable per-category heading ids, keyed by category name -- generated
  // once (not regenerated every render/keystroke) so a category's
  // aria-labelledby target keeps the same id across re-renders.
  private readonly categoryIds = new Map<string, string>();

  protected willUpdate(changed: PropertyValues): void {
    if (!this.hasUpdated) {
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
    }
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
      } else {
        this.releaseScrollLock?.();
        this.releaseScrollLock = undefined;
        document.removeEventListener('keydown', this.onDocKeyDown);
      }
    }
  }

  // Runs after render (not willUpdate) so [part="panel"] and its contents
  // have already landed in the DOM before the focus call below can rely on
  // them -- mirrors lyra-dialog's/lyra-tool-result-dialog's identical
  // ordering rationale.
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

  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  /**
   * Close the dialog and return focus to whatever had it before the dialog
   * opened. `reason` is forwarded as the `lyra-close` detail — built-in
   * triggers pass `'escape'`/`'backdrop'`; a consumer's own close affordance
   * (e.g. a footer Done button) should call this directly with its own
   * reason string, so every dismissal path funnels through the same event
   * instead of the consumer having to also toggle `open` itself.
   */
  close(reason: ToolSelectDialogCloseReason = 'api'): void {
    if (!this.open) return;
    this.open = false;
    this.emit<ToolSelectDialogCloseReason>('lyra-close', reason);
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

  // Bounds Tab/Shift+Tab to the panel while open. Order follows the search
  // input, then the use-defaults switch, then each visible tool row's
  // checkbox, then the footer slot -- the same order the flattened tree
  // already tabs through (mirrors lyra-tool-result-dialog's identical
  // header-buttons-then-body-then-footer ordering rationale).
  private getFocusableElements(): HTMLElement[] {
    const root = this.shadowRoot;
    if (!root) return [];
    const searchInput = root.querySelector<HTMLElement>('[part="search-input"]');
    const defaultsToggle = root.querySelector<HTMLElement>('[part="defaults-toggle"]');
    const checkboxes = Array.from(root.querySelectorAll<HTMLElement>('[part="tool-checkbox"]'));
    const fromSlot = (selector: string): HTMLElement[] => {
      const slot = root.querySelector<HTMLSlotElement>(selector);
      return slot ? slot.assignedElements({ flatten: true }).flatMap(collectFocusable) : [];
    };
    return [
      ...(searchInput ? collectFocusable(searchInput) : []),
      ...(defaultsToggle ? collectFocusable(defaultsToggle) : []),
      ...checkboxes.flatMap(collectFocusable),
      ...fromSlot('slot[name="footer"]'),
    ].filter(isRendered);
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

  private emitChange(): void {
    this.emit<ToolSelectionChangeDetail>('lyra-change', {
      selected: [...this.selected],
      useDefaults: this.useDefaults,
    });
  }

  private onSearchInput = (e: Event): void => {
    this.query = (e.target as HTMLInputElement).value;
  };

  private onDefaultsToggle = (e: CustomEvent<{ checked: boolean }>): void => {
    this.useDefaults = e.detail.checked;
    this.emitChange();
  };

  private onToolToggle(tool: ToolSelectDialogTool, e: CustomEvent<{ checked: boolean }>): void {
    const set = new Set(this.selected);
    e.detail.checked ? set.add(tool.id) : set.delete(tool.id);
    this.selected = [...set];
    this.emitChange();
  }

  private categoryId(category: string): string {
    let id = this.categoryIds.get(category);
    if (!id) {
      id = nextId('tool-select-dialog-category');
      this.categoryIds.set(category, id);
    }
    return id;
  }

  /** Tools grouped by `category` (first-seen order), with an uncategorized
   *  bucket always last, then filtered by the active search query -- a
   *  category left with zero matches is dropped entirely rather than
   *  rendered as an empty heading. */
  private get groups(): ToolGroup[] {
    const order: string[] = [];
    const byCategory = new Map<string, ToolSelectDialogTool[]>();
    for (const tool of this.tools) {
      const category = tool.category?.trim() || OTHER_CATEGORY;
      let bucket = byCategory.get(category);
      if (!bucket) {
        bucket = [];
        byCategory.set(category, bucket);
        if (category !== OTHER_CATEGORY) order.push(category);
      }
      bucket.push(tool);
    }
    if (byCategory.has(OTHER_CATEGORY)) order.push(OTHER_CATEGORY);

    const q = this.query.trim().toLowerCase();
    const matches = q ? (tool: ToolSelectDialogTool) => (this.filter ?? defaultFilter)(tool, q) : () => true;
    return order
      .map((category) => ({ category, tools: byCategory.get(category)!.filter(matches) }))
      .filter((group) => group.tools.length > 0);
  }

  private renderTool(tool: ToolSelectDialogTool): TemplateResult {
    const rowDisabled = Boolean(tool.disabled) || this.useDefaults;
    return html`
      <li part="tool-row" ?data-disabled=${rowDisabled}>
        <lyra-checkbox
          part="tool-checkbox"
          value=${tool.id}
          ?checked=${this.selected.includes(tool.id)}
          ?disabled=${rowDisabled}
          @lyra-change=${(e: CustomEvent<{ checked: boolean }>) => this.onToolToggle(tool, e)}
        >
          <span part="tool-name">
            ${tool.icon ? html`<span part="tool-icon" aria-hidden="true">${tool.icon}</span>` : nothing}${tool.name}
          </span>
          ${tool.description ? html`<span part="tool-description">${tool.description}</span>` : nothing}
        </lyra-checkbox>
        ${tool.disabled && tool.disabledReason
          ? html`<p part="tool-disabled-reason">${tool.disabledReason}</p>`
          : nothing}
      </li>
    `;
  }

  private renderCategory(group: ToolGroup): TemplateResult {
    const headingId = this.categoryId(group.category);
    return html`
      <div part="category" role="group" aria-labelledby=${headingId}>
        <h3 part="category-heading" id=${headingId}>
          ${group.category}<span part="category-count">${group.tools.length}</span>
        </h3>
        <ul part="category-list">
          ${group.tools.map((tool) => this.renderTool(tool))}
        </ul>
      </div>
    `;
  }

  render(): TemplateResult {
    const groups = this.groups;
    const hasTools = this.tools.length > 0;
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
          <h2 part="title" id=${this.titleId}>${this.label}</h2>
          <p part="subtitle" ?hidden=${!hasTools}>${this.selected.length} of ${this.tools.length} tools enabled</p>
        </div>
        <div part="search-row">
          <input
            part="search-input"
            type="search"
            .value=${this.query}
            placeholder=${this.searchPlaceholder}
            aria-label=${this.searchPlaceholder}
            @input=${this.onSearchInput}
          />
        </div>
        <div part="defaults-row">
          <lyra-switch
            part="defaults-toggle"
            ?checked=${this.useDefaults}
            @lyra-change=${this.onDefaultsToggle}
          >
            Use default tools
          </lyra-switch>
          ${this.useDefaults
            ? html`<p part="defaults-hint">Turn off to choose individual tools.</p>`
            : nothing}
        </div>
        <div part="body">
          ${groups.length === 0
            ? html`<p part="empty">
                ${hasTools ? html`No tools match "${this.query}".` : 'No tools available.'}
              </p>`
            : groups.map((group) => this.renderCategory(group))}
        </div>
        <div part="footer" ?hidden=${!this.hasFooterSlot}>
          <slot name="footer" @slotchange=${this.onFooterSlotChange}></slot>
        </div>
      </div>
    `;
  }
}

defineElement('tool-select-dialog', LyraToolSelectDialog);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-tool-select-dialog': LyraToolSelectDialog;
  }
}
