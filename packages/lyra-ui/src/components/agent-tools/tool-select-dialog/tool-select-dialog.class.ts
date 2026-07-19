import { html, nothing, type TemplateResult, type PropertyValues, type ComplexAttributeConverter } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { activateOverlay, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { lockScroll } from '../../../internal/scroll-lock.js';
import { nextId, srOnly } from '../../../internal/a11y.js';
import { styles } from './tool-select-dialog.styles.js';
import '../../forms/checkbox/checkbox.class.js';
import '../../forms/switch/switch.class.js';

/**
 * String-aware boolean attribute converter for `spellcheck`. Lit's built-in `type: Boolean`
 * converter is presence-based -- the attribute's mere presence (regardless of its string value)
 * maps to `true`, so a plain-markup consumer writing the literal `spellcheck="false"` would
 * actually get `true` (this property's default), the opposite of what that string reads as -- the
 * same bug class `<lr-textarea>`'s `spellcheckConverter` and `<lr-model-select>`'s identical
 * converter document and fix.
 */
const spellcheckConverter: ComplexAttributeConverter<boolean> = {
  fromAttribute(value): boolean {
    return value !== 'false';
  },
  toAttribute(value): string | null {
    // `true` is this property's default, so there's nothing worth reflecting for it; only the
    // non-default `false` needs an attribute at all.
    return value ? null : 'false';
  },
};

/** One selectable agent tool. `category` groups the row; tools with no
 *  `category` (or an empty one) fall into the trailing "Other" bucket. */
export interface ToolSelectDialogTool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  /** Literal icon hint (e.g. an emoji), rendered next to `name` -- same
   *  "opaque string, not a registry lookup" convention as `<lr-tool-call-chip>`'s `icon`. */
  icon?: string;
  /** Individually gates this tool regardless of `useDefaults`/`selected` -- e.g. a tool that
   *  requires admin approval before it can ever be enabled. */
  disabled?: boolean;
  /** Supporting text shown under a `disabled` row (e.g. "requires admin approval"). Ignored when `disabled` is falsy. */
  disabledReason?: string;
}

/** Predicate deciding whether `tool` matches a (already-trimmed, already-lowercased) `query`.
 *  Mirrors `<lr-combobox>`'s `OptionFilter` convention -- override `filter` to replace the
 *  built-in case-insensitive name/description substring match entirely. */
export type ToolSelectFilter = (tool: ToolSelectDialogTool, query: string) => boolean;

export interface ToolSelectionChangeDetail {
  selected: string[];
  useDefaults: boolean;
}

/**
 * Reason the dialog was dismissed, forwarded as the `lr-close` event detail
 * -- mirrors `<lr-dialog>`'s own `DialogCloseReason` shape. `'escape'`/
 * `'backdrop'` come from the dialog's own built-in dismiss triggers; any
 * other string is whatever a caller passes to `close()` directly (e.g. a
 * consumer's own footer Done button).
 */
export type ToolSelectDialogCloseReason = 'escape' | 'backdrop' | 'api' | (string & Record<never, never>);

export interface LyraToolSelectDialogEventMap {
  'lr-change': CustomEvent<ToolSelectionChangeDetail>;
  'lr-close': CustomEvent<ToolSelectDialogCloseReason>;
  blur: CustomEvent<undefined>;
  focus: CustomEvent<undefined>;
}

const OTHER_CATEGORY = 'Other';

/** Default `filter`: case-insensitive substring match against the tool's name and description. */
function defaultFilter(tool: ToolSelectDialogTool, query: string): boolean {
  return tool.name.toLowerCase().includes(query) || (tool.description ?? '').toLowerCase().includes(query);
}

interface ToolGroup {
  category: string;
  tools: ToolSelectDialogTool[];
}

/**
 * `<lr-tool-select-dialog>` — a category-grouped, filterable, searchable
 * tool-enablement dialog for picking which agent tools are available in a
 * conversation.
 *
 * This renders its own dialog panel rather than nesting a `<lr-dialog>` in
 * its shadow template. Shared overlay infrastructure coordinates stacking,
 * focus trapping, Escape/backdrop dismissal, and focus return with every
 * other overlay in the same document.
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
 * There is no built-in footer/close button — like `<lr-dialog>`, dismissal
 * happens via Escape, a backdrop click, or a consumer's own `footer`-slotted
 * action calling `close()`. This also means the search input is the very
 * first focusable element in the panel with no special-casing needed, so
 * it's what receives focus on open (see `updated()`).
 *
 * @customElement lr-tool-select-dialog
 * @slot footer - Optional action buttons (e.g. a "Done" button), rendered in a bottom row.
 * Changes already apply live via `lr-change`, so this is optional.
 * @event lr-change - The enabled-tool selection or the `useDefaults` toggle changed.
 * `detail: { selected: string[], useDefaults: boolean }`.
 * @event lr-close - `detail: ToolSelectDialogCloseReason`. Fired exactly once per dismissal,
 * via Escape, a backdrop click, or a `close()` call.
 * @csspart backdrop - The full-viewport scrim behind the panel.
 * @csspart panel - The dialog panel itself (`role="dialog"` while open).
 * @csspart header - The wrapper around the title/subtitle.
 * @csspart title - The dialog's heading.
 * @csspart subtitle - The "N of M tools enabled" summary line.
 * @csspart search-row - The wrapper around the search input.
 * @csspart search-input - The filter text input.
 * @csspart defaults-row - The wrapper around the use-defaults switch and its hint.
 * @csspart defaults-toggle - The built-in `<lr-switch>` bound to `useDefaults`.
 * @csspart defaults-hint - The "turn off to customize" hint, shown only while `useDefaults` is true.
 * @csspart body - The scrollable wrapper around the grouped tool list.
 * @csspart empty - The "no tools" / "no matches" message.
 * @csspart category - A single category's wrapper (`role="group"`).
 * @csspart category-heading - A category's heading.
 * @csspart category-count - The terse, `aria-hidden` tool count next to a category heading
 * (the heading's accessible name gets the full sentence from an sr-only sibling instead).
 * @csspart category-list - The `<ul>` of tool rows within a category.
 * @csspart tool-row - A single tool's `<li>` row.
 * @csspart tool-checkbox - A row's `<lr-checkbox>`.
 * @csspart tool-name - A row's name text (plus its `icon`, if set).
 * @csspart tool-icon - A row's leading icon glyph, when `icon` is set.
 * @csspart tool-description - A row's optional description text.
 * @csspart tool-disabled-reason - A disabled row's `disabledReason` text, slotted inside
 * `tool-checkbox` (alongside `tool-name`/`tool-description`) so it contributes to the
 * checkbox's accessible name/description instead of going unannounced.
 * @csspart footer - The wrapper around the `footer` slot.
 */
export class LyraToolSelectDialog extends LyraElement<LyraToolSelectDialogEventMap> {
  static styles = [LyraElement.styles, styles, srOnly];

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

  /** Overrides the dialog panel's accessible name, taking precedence over the visible `label`
   *  heading -- mirrors `<lr-dialog>`'s/`<lr-tool-result-dialog>`'s own host-`aria-label`
   *  override pattern. Fed only by a host `aria-label`. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  @property({ attribute: 'search-placeholder' }) searchPlaceholder = 'Search tools…';
  /** Native editing-assistance and virtual-keyboard hints forwarded to the search input. */
  @property() autocomplete = '';
  @property({ converter: spellcheckConverter }) spellcheck = true;
  @property() autocapitalize = '';
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  @property({ attribute: 'inputmode' }) inputMode = '';
  @property({ attribute: 'enterkeyhint' }) enterKeyHint = '';

  /** Overrides the built-in case-insensitive name/description substring match. */
  @property({ attribute: false }) filter: ToolSelectFilter | null = null;

  @state() private query = '';
  @state() private hasFooterSlot = false;

  private releaseScrollLock?: () => void;
  private overlay?: OverlayHandle;
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
        this.releaseScrollLock ??= lockScroll(this.ownerDocument);
        this.activateOverlay();
      } else {
        this.releaseScrollLock?.();
        this.releaseScrollLock = undefined;
        this.overlay?.deactivate();
        this.overlay = undefined;
        // Otherwise a long-lived instance reopens still showing whatever
        // search filter/collapsed-category state the previous session left
        // behind, rather than the fresh, unfiltered list a reopen implies.
        this.query = '';
      }
    }
  }

  // Runs after render (not willUpdate) so [part="panel"] and its contents
  // have already landed in the DOM before the focus call below can rely on
  // them -- mirrors lr-dialog's/lr-tool-result-dialog's identical
  // ordering rationale.
  protected updated(changed: PropertyValues): void {
    if (changed.has('open') && this.open) {
      this.overlay?.focusInitial();
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this.open) {
      this.releaseScrollLock ??= lockScroll(this.ownerDocument);
      this.activateOverlay();
      queueMicrotask(() => this.overlay?.focusInitial());
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlay?.suspend();
  }

  private activateOverlay(): void {
    if (this.overlay?.isActive()) {
      this.overlay.resume();
      return;
    }
    this.overlay = activateOverlay({
      host: this,
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="panel"]') ?? null,
      onEscape: () => this.close('escape'),
      onBackdrop: () => this.close('backdrop'),
    });
  }

  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  /**
   * Close the dialog and return focus to whatever had it before the dialog
   * opened. `reason` is forwarded as the `lr-close` detail — built-in
   * triggers pass `'escape'`/`'backdrop'`; a consumer's own close affordance
   * (e.g. a footer Done button) should call this directly with its own
   * reason string, so every dismissal path funnels through the same event
   * instead of the consumer having to also toggle `open` itself.
   */
  close(reason: ToolSelectDialogCloseReason = 'api'): void {
    if (!this.open) return;
    this.open = false;
    this.emit<ToolSelectDialogCloseReason>('lr-close', reason);
  }

  private onBackdropClick = (): void => {
    this.overlay?.dismissBackdrop();
  };

  private emitChange(): void {
    this.emit<ToolSelectionChangeDetail>('lr-change', {
      selected: [...this.selected],
      useDefaults: this.useDefaults,
    });
  }

  private onSearchInput = (e: Event): void => {
    this.query = (e.target as HTMLInputElement).value;
  };
  private onSearchFocus = (): void => { this.emit('focus'); };
  private onSearchBlur = (): void => { this.emit('blur'); };

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
        <lr-checkbox
          part="tool-checkbox"
          value=${tool.id}
          ?checked=${this.selected.includes(tool.id)}
          ?disabled=${rowDisabled}
          @lr-change=${(e: CustomEvent<{ checked: boolean }>) => this.onToolToggle(tool, e)}
        >
          <span part="tool-name">
            ${tool.icon ? html`<span part="tool-icon" aria-hidden="true">${tool.icon}</span>` : nothing}${tool.name}
          </span>
          ${tool.description ? html`<span part="tool-description">${tool.description}</span>` : nothing}
          ${tool.disabled && tool.disabledReason
            ? html`<span part="tool-disabled-reason">${tool.disabledReason}</span>`
            : nothing}
        </lr-checkbox>
      </li>
    `;
  }

  private renderCategory(group: ToolGroup): TemplateResult {
    const headingId = this.categoryId(group.category);
    return html`
      <div part="category" role="group" aria-labelledby=${headingId}>
        <h3 part="category-heading" id=${headingId}>
          ${group.category === OTHER_CATEGORY ? this.localize('otherCategory') : group.category}<span
            part="category-count"
            aria-hidden="true"
            >${group.tools.length}</span
          ><span class="sr-only"
            >${this.localize(group.tools.length === 1 ? 'toolCount' : 'toolCountPlural', undefined, {
              count: group.tools.length,
            })}</span
          >
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
    const label = this.localize('selectTools', this.label === 'Select tools' ? undefined : this.label);
    const searchPlaceholder = this.localize(
      'searchToolsPlaceholder',
      this.searchPlaceholder === 'Search tools…' ? undefined : this.searchPlaceholder,
    );
    return html`
      <div part="backdrop" @click=${this.onBackdropClick}></div>
      <div
        part="panel"
        role=${this.open ? 'dialog' : nothing}
        aria-modal=${this.open ? 'true' : nothing}
        aria-label=${this.accessibleLabel || nothing}
        aria-labelledby=${this.accessibleLabel ? nothing : this.titleId}
        tabindex="-1"
      >
        <div part="header">
          <h2 part="title" id=${this.titleId}>${label}</h2>
          <p
            part="subtitle"
            ?hidden=${!hasTools}
            >${this.localize('toolSelectSummary', undefined, {
              selected: this.selected.length,
              total: this.tools.length,
            })}</p
          >
        </div>
        <div part="search-row">
          <input
            part="search-input"
            type="search"
            .value=${this.query}
            placeholder=${searchPlaceholder}
            aria-label=${searchPlaceholder}
            autocomplete=${this.autocomplete || nothing}
            .spellcheck=${this.spellcheck}
            autocapitalize=${this.autocapitalize || nothing}
            autocorrect=${this.autoCorrect || nothing}
            inputmode=${this.inputMode || nothing}
            enterkeyhint=${this.enterKeyHint || nothing}
            @input=${this.onSearchInput}
            @focus=${this.onSearchFocus}
            @blur=${this.onSearchBlur}
          />
        </div>
        <div part="defaults-row">
          <lr-switch
            part="defaults-toggle"
            ?checked=${this.useDefaults}
            @lr-change=${this.onDefaultsToggle}
          >
            ${this.localize('useDefaultTools')}
          </lr-switch>
          ${this.useDefaults
            ? html`<p part="defaults-hint">${this.localize('toolSelectCustomizeHint')}</p>`
            : nothing}
        </div>
        <div part="body">
          ${groups.length === 0
            ? html`<p part="empty">
                ${hasTools
                  ? this.localize('noMatchesQuery', undefined, { query: this.query })
                  : this.localize('toolSelectNoneAvailable')}
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


declare global {
  interface HTMLElementTagNameMap {
    'lr-tool-select-dialog': LyraToolSelectDialog;
  }
}
