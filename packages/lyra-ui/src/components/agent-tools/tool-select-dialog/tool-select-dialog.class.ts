import type { LyraEventDetailSnapshot } from '../../../internal/lyra-element.js';
import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { activateOverlay, type OverlayHandle } from '../../../internal/overlay-manager.js';
import { hostAriaLabel, nextId, srOnly } from '../../../internal/a11y.js';
import { styles } from './tool-select-dialog.styles.js';
import '../../forms/checkbox/checkbox.class.js';
import '../../forms/switch/switch.class.js';
import { trueDefaultSpellcheckConverter as spellcheckConverter } from '../../../internal/converters.js';
import { getNumberFormat, resolveIntlLocale } from '../../../internal/intl-cache.js';
import { firstByIdentity } from '../collection-identity.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_fieldRequired, LYRA_DEFAULT_loadMore, LYRA_DEFAULT_noMatchesQuery, LYRA_DEFAULT_otherCategory, LYRA_DEFAULT_searchToolsPlaceholder, LYRA_DEFAULT_selectTools, LYRA_DEFAULT_toolCount, LYRA_DEFAULT_toolSelectCustomizeHint, LYRA_DEFAULT_toolSelectLimit, LYRA_DEFAULT_toolSelectNoneAvailable, LYRA_DEFAULT_toolSelectSummary, LYRA_DEFAULT_useDefaultTools } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** One selectable agent tool. `id` is the stable, nonempty selection identity; empty ids are
 *  omitted and when the input collection repeats an id, its first occurrence wins before
 *  grouping, searching, counting, or rendering.
 *  `category` groups the row; tools with no `category` (or an empty one) fall into the trailing
 *  localized "Other" bucket. A literal caller category named "Other" remains a separate ordinary
 *  category. */
export interface ToolSelectDialogTool {
  id: string;
  name: string;
  description?: string;
  category?: string;
  /** Literal icon hint (e.g. an emoji), rendered next to `name` -- same
   *  "opaque string, not a registry lookup" convention as `<lr-tool-call-chip>`'s `icon`. */
  icon?: string;
  /** Individually gates this tool regardless of `useDefaults`/`selectedToolIds` -- e.g. a tool that
   *  requires admin approval before it can ever be enabled. */
  disabled?: boolean;
  /** Supporting text shown under a `disabled` row (e.g. "requires admin approval"). Ignored when `disabled` is falsy. */
  disabledReason?: string;
}

/** Predicate deciding whether `tool` matches a (already-trimmed, already-lowercased) `query`.
 *  Mirrors `<lr-combobox>`'s `OptionFilter` convention -- override `filter` to replace the
 *  built-in case-insensitive name/description substring match entirely. */
export type ToolSelectFilter = (tool: ToolSelectDialogTool, query: string) => boolean;

/** The proposed state carried by the cancelable `lr-change` event. */
export interface ToolSelectionChangeDetail {
  readonly selectedToolIds: readonly string[];
  readonly useDefaults: boolean;
}

/**
 * Reason the dialog was dismissed, forwarded as the `lr-close` event detail
 * -- mirrors `<lr-dialog>`'s own `DialogCloseReason` shape. `'escape'`/
 * `'backdrop'` come from the dialog's own built-in dismiss triggers (the latter only while
 * `lightDismiss` is enabled); any
 * other string is whatever a caller passes to `close()` directly (e.g. a
 * consumer's own footer Done button).
 */
export type ToolSelectDialogCloseReason = 'escape' | 'backdrop' | 'api' | (string & Record<never, never>);

export interface LyraToolSelectDialogEventMap {
  'lr-change': CustomEvent<LyraEventDetailSnapshot<ToolSelectionChangeDetail>>;
  'lr-close': CustomEvent<ToolSelectDialogCloseReason>;
  blur: CustomEvent<null>;
  focus: CustomEvent<null>;
}

const UNCATEGORIZED = null;
type ToolCategoryKey = string | null;
const MAX_RENDERED_TOOLS = 200;

/** Default `filter`: case-insensitive substring match against the tool's name and description. */
function defaultFilter(tool: ToolSelectDialogTool, query: string, locale: string): boolean {
  const intlLocale = resolveIntlLocale(locale);
  return (
    tool.name.toLocaleLowerCase(intlLocale).includes(query) ||
    (tool.description ?? '').toLocaleLowerCase(intlLocale).includes(query)
  );
}

interface ToolGroup {
  category: ToolCategoryKey;
  tools: ToolSelectDialogTool[];
}

interface ToolProjection {
  groups: ToolGroup[];
  renderedCount: number;
  totalMatches: number;
  truncated: boolean;
}

/**
 * `<lr-tool-select-dialog>` — a category-grouped, filterable, searchable
 * tool-enablement dialog for picking which agent tools are available in a
 * conversation.
 *
 * This renders its own dialog panel rather than nesting a `<lr-dialog>` in
 * its shadow template. Shared overlay infrastructure coordinates stacking,
 * focus trapping, Escape dismissal, optional backdrop dismissal, and focus
 * return with every other overlay in the same document.
 *
 * `useDefaults` is a single top-level switch: while `true`, every per-tool
 * checkbox below renders disabled (still reflecting whatever `selectedToolIds`
 * holds — a consumer should populate that with its own default tool set
 * whenever `useDefaults` is true) and a hint explains that turning the
 * switch off is how to customize. Turning it off is the "customize"
 * affordance — it's the only thing that both flips `useDefaults` to `false`
 * *and* unlocks the per-tool checkboxes for editing, so there's exactly one
 * control for that transition rather than a separate button duplicating it.
 *
 * There is no built-in footer/close button — like `<lr-dialog>`, dismissal
 * happens via Escape, an opted-in `lightDismiss` backdrop click, or a
 * consumer's own `footer`-slotted action calling `close()`. This also means the search input is the very
 * first focusable element in the panel with no special-casing needed, so
 * it's what receives focus on open (see `updated()`).
 *
 * Matching tools mount in user-driven batches of 200. Matching selected identities reserve batch
 * positions before ordinary input-order matches, so the checked rows behind the controlled
 * `selectedToolIds` summary remain available without first loading every preceding tool. When more
 * matches remain, a localized limit notice and Load more button make the bounded projection
 * explicit and provide a keyboard-reachable continuation; search can independently narrow the
 * complete catalog. `tools`, selection counts, and emitted ids retain the caller's complete catalog.
 *
 * Public collection properties take bounded, clone-owned readonly snapshots. Create a new
 * collection and reassign it after changes; mutating the assigned array does not update the view.
 * Native/prefixed input and change events from the composed checkbox and switch controls stop at
 * this dialog's boundary; consumers receive only the aggregate `lr-change` proposal above.
 *
 * @customElement lr-tool-select-dialog
 * @slot footer - Optional action buttons (e.g. a "Done" button), rendered in a bottom row.
 * Changes already apply live via `lr-change`, so this is optional.
 * @event lr-change - A proposed enabled-tool selection or `useDefaults` toggle.
 * `detail: { selectedToolIds: string[], useDefaults: boolean }`. Cancelable; preventing it preserves
 * both properties and restores the built-in checkbox or switch to its current checked state.
 * @event lr-close - `detail: ToolSelectDialogCloseReason`. Fired exactly once per dismissal,
 * via Escape, an opted-in backdrop click, or a `close()` call.
 * @event focus - Re-dispatched when the internal search input receives focus.
 * @event blur - Re-dispatched when the internal search input loses focus.
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
 * @csspart body - The keyboard-focusable scrollable wrapper around the grouped tool list.
 * @csspart empty - The "no tools" / "no matches" message.
 * @csspart limit - Localized notice shown while additional matching tools remain unmounted.
 * @csspart load-more - Button that mounts the next bounded batch of matching tools.
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
 * @cssprop [--lr-tool-select-dialog-overlay-color=var(--lr-color-overlay)] - Backdrop scrim color.
 * @status stable
 * @since 4.0.0
 */
export class LyraToolSelectDialog extends LyraElement<LyraToolSelectDialogEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    fieldRequired: LYRA_DEFAULT_fieldRequired,
    loadMore: LYRA_DEFAULT_loadMore,
    noMatchesQuery: LYRA_DEFAULT_noMatchesQuery,
    otherCategory: LYRA_DEFAULT_otherCategory,
    searchToolsPlaceholder: LYRA_DEFAULT_searchToolsPlaceholder,
    selectTools: LYRA_DEFAULT_selectTools,
    toolCount: LYRA_DEFAULT_toolCount,
    toolSelectCustomizeHint: LYRA_DEFAULT_toolSelectCustomizeHint,
    toolSelectLimit: LYRA_DEFAULT_toolSelectLimit,
    toolSelectNoneAvailable: LYRA_DEFAULT_toolSelectNoneAvailable,
    toolSelectSummary: LYRA_DEFAULT_toolSelectSummary,
    useDefaultTools: LYRA_DEFAULT_useDefaultTools,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  protected static override readonly ownedCollectionProperties = Object.freeze(['tools', 'selectedToolIds']);

  static override styles = [LyraElement.styles, styles, srOnly];
  protected static override readonly immutableEventDetails = Object.freeze([
    'lr-change',
  ]);

  /** Whether the dialog is open. Set this directly or use `show()`/`hide()`/`close()`. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Dismisses the dialog on a backdrop click. Opt-in and `false` by default, matching
   *  `<lr-dialog>`, `<lr-drawer>`, and `<lr-lightbox>`. */
  @property({ type: Boolean, attribute: 'light-dismiss' }) lightDismiss = false;

  /** The full set of tools a consumer offers, across all categories. Empty ids are omitted and
   *  duplicate ids use a deterministic first-wins projection. */
  @property({ attribute: false }) tools: readonly ToolSelectDialogTool[] = [];

  /** The currently-enabled tool ids. Empty ids are omitted and duplicates are treated as one
   *  selection. */
  @property({ attribute: false }) selectedToolIds: readonly string[] = [];

  /** Whether the conversation is using the default tool set (`true`) or a custom selection (`false`) — see the class doc for the exact interaction with `selectedToolIds`/per-tool editing. */
  @property({ type: Boolean, reflect: true, attribute: 'use-defaults' }) useDefaults = false;

  /** The dialog's visible heading and accessible name. Omission uses the localized default; any
   *  supplied string, including `"Select tools"` or an empty string, remains literal. */
  @property() label?: string;

  /** Accessible name for the component. When assigned directly as a property without a host
   *  attribute it names the dialog panel; a host `aria-label` remains on the host and the panel
   *  stays labelled by its visible heading to avoid cloning the same owner. */
  @property({ attribute: 'aria-label' }) accessibleLabel: string | null = null;

  /** Search placeholder. Omission uses the localized default; supplied text remains literal even
   *  when it matches the former English default or is empty. An empty/whitespace-only placeholder
   *  leaves the field visually empty while its accessible name falls back to the localized default. */
  @property({ attribute: 'search-placeholder' }) searchPlaceholder?: string;
  /** Native editing-assistance and virtual-keyboard hints forwarded to the search input. */
  @property() autocomplete = '';
  @property({ converter: spellcheckConverter }) override spellcheck = true;
  @property() override autocapitalize = '';
  @property({ attribute: 'autocorrect' }) autoCorrect = '';
  @property({ attribute: 'inputmode' }) override inputMode = '';
  @property({ attribute: 'enterkeyhint' }) override enterKeyHint = '';

  /** Overrides the built-in case-insensitive name/description substring match. */
  @property({ attribute: false }) filter: ToolSelectFilter | null = null;

  @state() private query = '';
  @state() private hasFooterSlot = false;
  @state() private renderedToolLimit = MAX_RENDERED_TOOLS;

  private overlay?: OverlayHandle;
  private readonly titleId = nextId('tool-select-dialog-title');
  // Stable per-category heading ids, keyed by category name (or the null
  // uncategorized sentinel) -- generated once (not regenerated every
  // render/keystroke) so a category's
  // aria-labelledby target keeps the same id across re-renders.
  private readonly categoryIds = new Map<ToolCategoryKey, string>();

  protected override willUpdate(changed: PropertyValues): void {
    super.willUpdate(changed);
    if (!this.hasUpdated) {
      this.hasFooterSlot = Array.from(this.children).some((el) => el.getAttribute('slot') === 'footer');
    }
    if (changed.has('tools') || changed.has('filter')) {
      this.renderedToolLimit = MAX_RENDERED_TOOLS;
    }
    if (changed.has('open')) {
      if (this.open) {
        this.activateOverlay();
      } else {
        this.overlay?.deactivate();
        this.overlay = undefined;
        // Otherwise a long-lived instance reopens still showing whatever
        // search filter/collapsed-category state the previous session left
        // behind, rather than the fresh, unfiltered list a reopen implies.
        this.query = '';
        this.renderedToolLimit = MAX_RENDERED_TOOLS;
      }
    }
  }

  // Runs after render (not willUpdate) so [part="panel"] and its contents
  // have already landed in the DOM before the focus call below can rely on
  // them -- mirrors lr-dialog's/lr-tool-result-dialog's identical
  // ordering rationale.
  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (changed.has('open') && this.open) {
      this.overlay?.focusInitial();
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated && this.open) {
      this.activateOverlay();
      queueMicrotask(() => this.overlay?.focusInitial());
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
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
      onBackdrop: () => {
        if (this.lightDismiss) this.close('backdrop');
      },
      lockScroll: true,
      suspendWhenUnrendered: true,
    });
  }

  private onFooterSlotChange = (e: Event): void => {
    this.hasFooterSlot = (e.target as HTMLSlotElement).assignedElements({ flatten: true }).length > 0;
  };

  /**
   * Close the dialog and return focus to whatever had it before the dialog
   * opened. `reason` is forwarded as the `lr-close` detail — built-in
   * triggers pass `'escape'`/`'backdrop'` (the latter only when `lightDismiss` is enabled); a
   * consumer's own close affordance (e.g. a footer Done button) should call this directly with its own
   * reason string, so every dismissal path funnels through the same event
   * instead of the consumer having to also toggle `open` itself.
   */
  close(reason: ToolSelectDialogCloseReason = 'api'): void {
    if (!this.open) return;
    this.open = false;
    this.emit('lr-close', reason);
  }

  /** Opens the dialog. No-op when already open. */
  show(): void {
    if (this.open) return;
    this.open = true;
  }

  /** Closes the dialog through the same reasoned lifecycle as `close()`. */
  hide(reason: ToolSelectDialogCloseReason = 'api'): void {
    this.close(reason);
  }

  private onBackdropClick = (): void => {
    this.overlay?.dismissBackdrop();
  };

  private emitChange(next: ToolSelectionChangeDetail): boolean {
    const event = this.emit(
      'lr-change',
      { selectedToolIds: [...next.selectedToolIds], useDefaults: next.useDefaults },
      { cancelable: true },
    );
    return !event.defaultPrevented;
  }

  private restoreChildChecked(event: Event, checked: boolean): void {
    // Both child controls update themselves before their lr-change event bubbles here. A veto keeps
    // the host property unchanged, so it cannot rely on a host re-render to reconcile the child.
    const control = event.currentTarget as { checked: boolean } | null;
    if (control) control.checked = checked;
  }

  private onSearchInput = (e: Event): void => {
    this.query = (e.target as HTMLInputElement).value;
    this.renderedToolLimit = MAX_RENDERED_TOOLS;
  };
  private onSearchFocus = (): void => { this.emit('focus'); };
  private onSearchBlur = (): void => { this.emit('blur'); };

  private stopNestedControlEvent = (event: Event): void => {
    event.stopPropagation();
  };

  private onDefaultsToggle = (e: CustomEvent<{ checked: boolean }>): void => {
    e.stopPropagation();
    const next: ToolSelectionChangeDetail = {
      selectedToolIds: this.uniqueSelectedToolIds,
      useDefaults: e.detail.checked,
    };
    if (this.emitChange(next)) {
      this.useDefaults = next.useDefaults;
      return;
    }
    this.restoreChildChecked(e, this.useDefaults);
  };

  private onToolToggle(tool: ToolSelectDialogTool, e: CustomEvent<{ checked: boolean }>): void {
    e.stopPropagation();
    if (tool.disabled || this.useDefaults) return;
    const set = new Set(this.selectedToolIds);
    e.detail.checked ? set.add(tool.id) : set.delete(tool.id);
    const next: ToolSelectionChangeDetail = {
      selectedToolIds: [...set],
      useDefaults: this.useDefaults,
    };
    if (this.emitChange(next)) {
      this.selectedToolIds = next.selectedToolIds;
      return;
    }
    this.restoreChildChecked(e, this.selectedToolIds.includes(tool.id));
  }

  private categoryId(category: ToolCategoryKey): string {
    let id = this.categoryIds.get(category);
    if (!id) {
      id = nextId('tool-select-dialog-category');
      this.categoryIds.set(category, id);
    }
    return id;
  }

  private get uniqueTools(): ToolSelectDialogTool[] {
    return firstByIdentity(
      Array.isArray(this.tools) ? this.tools : [],
      (tool) => tool.id,
    );
  }

  private get uniqueSelectedToolIds(): string[] {
    return [
      ...new Set(
        (this.selectedToolIds as readonly unknown[]).filter(
          (id): id is string => typeof id === 'string' && id.trim().length > 0
        )
      ),
    ];
  }

  /** Tools grouped by `category` (first-seen order), with an uncategorized
   *  bucket always last, then filtered by the active search query -- a
   *  category left with zero matches is dropped entirely rather than
   *  rendered as an empty heading. */
  private get projection(): ToolProjection {
    const order: ToolCategoryKey[] = [];
    const byCategory = new Map<ToolCategoryKey, ToolSelectDialogTool[]>();
    for (const tool of this.uniqueTools) {
      const category: ToolCategoryKey = tool.category?.trim() || UNCATEGORIZED;
      let bucket = byCategory.get(category);
      if (!bucket) {
        bucket = [];
        byCategory.set(category, bucket);
        if (category !== UNCATEGORIZED) order.push(category);
      }
      bucket.push(tool);
    }
    if (byCategory.has(UNCATEGORIZED)) order.push(UNCATEGORIZED);

    const q = this.query.trim().toLocaleLowerCase(this.effectiveLocale);
    const matches = q
      ? (tool: ToolSelectDialogTool) =>
          this.filter ? this.filter(tool, q) : defaultFilter(tool, q, this.effectiveLocale)
      : () => true;
    const matchingGroups = order
      .map((category) => ({ category, tools: byCategory.get(category)!.filter(matches) }))
      .filter((group) => group.tools.length > 0);
    const totalMatches = matchingGroups.reduce((total, group) => total + group.tools.length, 0);
    const selectedIds = new Set(this.uniqueSelectedToolIds);
    const chosenIds = new Set<string>();
    for (const group of matchingGroups) {
      for (const tool of group.tools) {
        if (chosenIds.size >= this.renderedToolLimit) break;
        if (selectedIds.has(tool.id)) chosenIds.add(tool.id);
      }
      if (chosenIds.size >= this.renderedToolLimit) break;
    }
    for (const group of matchingGroups) {
      for (const tool of group.tools) {
        if (chosenIds.size >= this.renderedToolLimit) break;
        chosenIds.add(tool.id);
      }
      if (chosenIds.size >= this.renderedToolLimit) break;
    }
    const groups = matchingGroups
      .map((group) => ({ category: group.category, tools: group.tools.filter((tool) => chosenIds.has(tool.id)) }))
      .filter((group) => group.tools.length > 0);
    const renderedCount = chosenIds.size;
    return {
      groups,
      renderedCount,
      totalMatches,
      truncated: renderedCount < totalMatches,
    };
  }

  private onLoadMore = (): void => {
    this.renderedToolLimit += MAX_RENDERED_TOOLS;
    void this.updateComplete.then(() => {
      if (!this.isConnected || !this.open) return;
      const nextTarget =
        this.shadowRoot?.querySelector<HTMLElement>('[part="load-more"]') ??
        this.shadowRoot?.querySelector<HTMLElement>('[part="body"]');
      nextTarget?.focus();
    });
  };

  private renderTool(tool: ToolSelectDialogTool): TemplateResult {
    const rowDisabled = Boolean(tool.disabled) || this.useDefaults;
    return html`
      <li part="tool-row" ?data-disabled=${rowDisabled}>
        <lr-checkbox
          part="tool-checkbox"
          value=${tool.id}
          ?checked=${this.selectedToolIds.includes(tool.id)}
          ?disabled=${rowDisabled}
          @input=${this.stopNestedControlEvent}
          @lr-input=${this.stopNestedControlEvent}
          @change=${this.stopNestedControlEvent}
          @lr-change=${(e: CustomEvent<{ checked: boolean }>) => this.onToolToggle(tool, e)}
        >
          <span part="tool-name">
            ${tool.icon ? html`<span part="tool-icon" aria-hidden="true">${tool.icon}</span>` : nothing}${tool.name}
          </span>
          ${tool.description ? html`<span slot="hint" part="tool-description">${tool.description}</span>` : nothing}
          ${tool.disabled && tool.disabledReason
            ? html`<span slot="hint" part="tool-disabled-reason">${tool.disabledReason}</span>`
            : nothing}
        </lr-checkbox>
      </li>
    `;
  }

  private renderCategory(group: ToolGroup): TemplateResult {
    const headingId = this.categoryId(group.category);
    const formattedCount = getNumberFormat(this.effectiveLocale).format(group.tools.length);
    return html`
      <div part="category" role="group" aria-labelledby=${headingId}>
        <h3 part="category-heading" id=${headingId}>
          ${group.category === UNCATEGORIZED ? this.localize('otherCategory') : group.category}<span
            part="category-count"
            aria-hidden="true"
            >${formattedCount}</span
          ><span class="sr-only"
            >${this.localize('toolCount', undefined, {
              count: formattedCount,
              pluralCount: group.tools.length,
            })}</span
          >
        </h3>
        <ul part="category-list">
          ${group.tools.map((tool) => this.renderTool(tool))}
        </ul>
      </div>
    `;
  }

  override render(): TemplateResult {
    const projection = this.projection;
    const groups = projection.groups;
    const uniqueTools = this.uniqueTools;
    const hasTools = uniqueTools.length > 0;
    const label = this.label === undefined ? this.localize('selectTools') : this.label;
    const searchPlaceholder = this.searchPlaceholder === undefined
      ? this.localize('searchToolsPlaceholder')
      : this.searchPlaceholder;
    const searchAccessibleName = searchPlaceholder.trim().length > 0
      ? searchPlaceholder
      : this.localize('searchToolsPlaceholder');
    const knownIds = new Set(uniqueTools.map((tool) => tool.id));
    const selectedCount = new Set(
      this.selectedToolIds.filter((id) => knownIds.has(id))
    ).size;
    const number = getNumberFormat(this.effectiveLocale);
    const panelLabel = hostAriaLabel(this) === null && this.accessibleLabel ? this.accessibleLabel : null;
    return html`
      <div part="backdrop" @click=${this.onBackdropClick}></div>
      <div
        part="panel"
        role=${this.open ? 'dialog' : nothing}
        aria-modal=${this.open ? 'true' : nothing}
        aria-label=${panelLabel ?? nothing}
        aria-labelledby=${panelLabel === null ? this.titleId : nothing}
        tabindex="-1"
      >
        <div part="header">
          <h2 part="title" id=${this.titleId}>${label}</h2>
          <p
            part="subtitle"
            ?hidden=${!hasTools}
            >${this.localize('toolSelectSummary', undefined, {
              selected: number.format(selectedCount),
              total: number.format(knownIds.size),
            })}</p
          >
        </div>
        <div part="search-row">
          <input
            part="search-input"
            type="search"
            .value=${this.query}
            placeholder=${searchPlaceholder}
            aria-label=${searchAccessibleName}
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
            @input=${this.stopNestedControlEvent}
            @lr-input=${this.stopNestedControlEvent}
            @change=${this.stopNestedControlEvent}
            @lr-change=${this.onDefaultsToggle}
          >
            ${this.localize('useDefaultTools')}
          </lr-switch>
          ${this.useDefaults
            ? html`<p part="defaults-hint">${this.localize('toolSelectCustomizeHint')}</p>`
            : nothing}
        </div>
        <div part="body" tabindex="0">
          ${groups.length === 0
            ? html`<p part="empty">
                ${hasTools
                  ? this.localize('noMatchesQuery', undefined, { query: this.query })
                  : this.localize('toolSelectNoneAvailable')}
              </p>`
            : groups.map((group) => this.renderCategory(group))}
          ${projection.truncated
            ? html`<div part="limit">
                <span>${this.localize('toolSelectLimit', undefined, {
                  count: number.format(projection.renderedCount),
                })}</span>
                <button part="load-more" type="button" @click=${this.onLoadMore}>
                  ${this.localize('loadMore')}
                </button>
              </div>`
            : nothing}
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
