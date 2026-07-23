import { html, nothing, type TemplateResult, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { nextId } from "../../../internal/a11y.js";
import {
  activateOverlay,
  type OverlayHandle,
} from "../../../internal/overlay-manager.js";
import { lockScroll } from "../../../internal/scroll-lock.js";
import { styles } from "./command-palette.styles.js";

const COMMAND_ROW_HEIGHT = 48;
const GROUP_ROW_HEIGHT = 32;
const RESULT_OVERSCAN_ROWS = 6;

interface CommandResultRow {
  command: LyraCommand;
  index: number;
  top: number;
  groupIndex: number;
}

interface CommandResultGroup {
  index: number;
  label: string;
  headingTop?: number;
  rows: CommandResultRow[];
}

interface CommandResultModel {
  rows: CommandResultRow[];
  groups: CommandResultGroup[];
  totalHeight: number;
}

export interface LyraCommand {
  id: string;
  label: string;
  description?: string;
  group?: string;
  shortcut?: string;
  keywords?: string[];
  disabled?: boolean;
  /** Optional leading TemplateResult glyph, rendered before `label` (`PaletteItem.icon`/
   *  `SegmentedItem.icon` precedent -- not restricted to a square icon-only shape). */
  icon?: unknown;
  onSelect?: () => void;
}
export interface LyraCommandPaletteEventMap {
  "lr-select": CustomEvent<{ command: LyraCommand }>;
  "lr-open": CustomEvent<undefined>;
  "lr-close": CustomEvent<undefined>;
}

/** `<lr-command-palette>` — searchable application command menu with keyboard navigation.
 * Shared overlay infrastructure (the same one `<lr-dialog>` uses) coordinates focus-trapping
 * Tab, Escape dismissal, and document scroll-locking for as long as the palette is open.
 * @customElement lr-command-palette
 * @event lr-select - A command was chosen; detail is `{ command }`.
 * @event lr-open - The palette opened.
 * @event lr-close - The palette closed.
 * @csspart backdrop - Modal backdrop.
 * @csspart dialog - Palette dialog.
 * @csspart search - The search row wrapping the leading icon and the `input`.
 * @csspart input - Search input.
 * @csspart list - Command list.
 * @csspart list-spacer - Virtual result extent inside the scrolling list.
 * @csspart command-group - A labeled ARIA group containing visible command options.
 * @csspart group - A group heading, rendered before the first command of each `group`.
 * @csspart command - A command button.
 * @csspart icon - A command's leading icon glyph. Only rendered when the command has an `icon`.
 * @csspart label - A command's visible label.
 * @csspart description - A command's secondary description text. Rendered for every command; empty
 *   when the command has no `description`.
 * @csspart shortcut - A command's trailing shortcut hint. Only rendered when the command has a
 *   `shortcut`.
 * @csspart empty - The "no results" message. Only rendered when the filter matches no command.
 * @cssprop [--lr-command-palette-z-index=var(--lr-overlay-stack-index, var(--lr-layer-modal))] - Stacking index of the backdrop.
 * @cssprop [--lr-command-palette-max-inline-size=var(--lr-size-48rem)] - Maximum dialog width.
 * @cssprop [--lr-command-palette-max-block-size=70vh] - Maximum dialog height.
 * @cssprop [--lr-command-palette-list-max-block-size=50vh] - Maximum height of the scrolling command list.
 * @cssprop [--lr-command-palette-offset-block-start=12vh] - Gap between the viewport top and the dialog.
 * @cssprop [--lr-command-palette-row-height=var(--lr-size-3rem)] - Virtual command-row height.
 * @cssprop [--lr-command-palette-group-height=var(--lr-size-2rem)] - Virtual group-heading height.
 * @cssprop [--lr-command-palette-active-bg=var(--lr-color-brand-quiet)] - Background of the active
 *   (keyboard-highlighted, `data-active="true"`) command row. Declared as an inline `var()` fallback
 *   (never on `:host`), so setting it on the element or an ancestor recolors only the active row
 *   without hijacking the library-wide `--lr-color-brand-quiet` token.
 */
export class LyraCommandPalette extends LyraElement<LyraCommandPaletteEventMap> {
  static override styles = [LyraElement.styles, styles];
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ attribute: false }) commands: LyraCommand[] = [];
  @property() shortcut = "mod+k";
  @property({ attribute: "aria-label" }) accessibleLabel = "";
  @state() private queryText = "";
  @state() private activeIndex = 0;
  @state() private listScrollTop = 0;
  @state() private listViewportHeight = COMMAND_ROW_HEIGHT * 10;
  private listId = nextId("command-list");
  private releaseScrollLock?: () => void;
  private overlay?: OverlayHandle;
  private activeCommand?: LyraCommand;
  private listResizeObserver?: ResizeObserver;
  private observedList?: HTMLElement;
  private listScrollFrame?: number;
  /** The `commands` array `haystacks` was built from -- reference-keyed memo, since `commands`
   *  only ever changes by reassignment (it's `attribute: false`; in-place mutation wouldn't
   *  trigger a re-render either). */
  private haystacksFor?: LyraCommand[];
  private haystacksLocale = "";
  private haystacks: string[] = [];
  private filteredForCommands?: LyraCommand[];
  private filteredForQuery = "";
  private filteredForLocale = "";
  private filteredRows: LyraCommand[] = [];
  private resultModelFor?: LyraCommand[];
  private resultModelCache?: CommandResultModel;

  /** One lowercased searchable string per command, index-aligned with `commands`. `filtered`
   *  runs on every keystroke (and every ArrowUp/ArrowDown/Enter), so re-joining and lowercasing
   *  every row per call would scale with palette size for a result that only changes when the
   *  command list itself does. */
  private get searchHaystacks(): string[] {
    const locale = this.effectiveLocale;
    if (
      this.haystacksFor !== this.commands ||
      this.haystacksLocale !== locale
    ) {
      this.haystacksFor = this.commands;
      this.haystacksLocale = locale;
      this.haystacks = this.commands.map((command) =>
        [
          command.label,
          command.description ?? "",
          command.group ?? "",
          ...(command.keywords ?? []),
        ]
          .join(" ")
          .toLocaleLowerCase(locale)
      );
    }
    return this.haystacks;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("open")) {
      if (this.open) {
        this.releaseScrollLock ??= lockScroll(this.ownerDocument);
        this.activateOverlay();
      } else {
        this.releaseScrollLock?.();
        this.releaseScrollLock = undefined;
        this.overlay?.deactivate();
        this.overlay = undefined;
      }
    }
    const rows = this.filtered;
    let nextIndex = this.activeCommand ? rows.indexOf(this.activeCommand) : -1;
    if (nextIndex < 0 || rows[nextIndex]?.disabled) {
      const start = Math.min(
        Math.max(this.activeIndex, 0),
        Math.max(0, rows.length - 1)
      );
      nextIndex = this.seekEnabled(rows, start, 1);
      if (nextIndex === -1) nextIndex = this.seekEnabled(rows, start - 1, -1);
    }
    this.activeIndex = nextIndex;
    this.activeCommand = nextIndex >= 0 ? rows[nextIndex] : undefined;
  }

  // Runs after render so the manager can resolve the rendered [part="dialog"] panel -- mirrors
  // lr-dialog's/lr-tool-select-dialog's identical ordering rationale.
  protected override updated(changed: PropertyValues): void {
    if (changed.has("open") && this.open) {
      this.overlay?.focusInitial();
    }
    // The list is a fixed-height, scrollable box -- without this, arrowing past its visible rows
    // moves activeIndex/aria-activedescendant correctly but leaves the highlighted row scrolled
    // out of view. Mirrors lr-combobox's identical fix for the same shape of listbox.
    if (changed.has("activeIndex")) {
      const active = this.renderRoot.querySelector<HTMLElement>(
        '[part="command"][data-active="true"]'
      );
      active?.scrollIntoView({ block: "nearest" });
      this.scrollActiveIntoView();
    }
    const list = this.renderRoot.querySelector<HTMLElement>('[part="list"]');
    if (list !== this.observedList) {
      if (this.observedList)
        this.listResizeObserver?.unobserve(this.observedList);
      this.observedList = list ?? undefined;
      if (list) this.listResizeObserver?.observe(list);
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener("keydown", this.onGlobalKeyDown);
    this.listResizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const height =
        entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
      if (height > 0 && this.listViewportHeight !== height)
        this.listViewportHeight = height;
    });
    if (this.hasUpdated && this.open) {
      this.releaseScrollLock ??= lockScroll(this.ownerDocument);
      this.activateOverlay();
      queueMicrotask(() => this.overlay?.focusInitial());
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.onGlobalKeyDown);
    this.releaseScrollLock?.();
    this.releaseScrollLock = undefined;
    this.overlay?.suspend();
    this.listResizeObserver?.disconnect();
    this.listResizeObserver = undefined;
    this.observedList = undefined;
    if (this.listScrollFrame !== undefined) {
      cancelAnimationFrame(this.listScrollFrame);
      this.listScrollFrame = undefined;
    }
  }

  private activateOverlay(): void {
    if (this.overlay?.isActive()) {
      this.overlay.resume();
      return;
    }
    this.overlay = activateOverlay({
      host: this,
      panel: () =>
        this.shadowRoot?.querySelector<HTMLElement>('[part="dialog"]') ?? null,
      onEscape: () => this.close(),
      onBackdrop: () => this.close(),
    });
  }

  openPalette(): void {
    if (this.open) return;
    this.open = true;
    this.queryText = "";
    this.listScrollTop = 0;
    const rows = this.filtered;
    this.setActiveIndex(rows, this.seekEnabled(rows, 0, 1));
    this.emit("lr-open");
  }

  close(): void {
    if (!this.open) return;
    this.open = false;
    this.emit("lr-close");
  }

  registerCommand(command: LyraCommand): () => void {
    this.commands = [...this.commands, command];
    return () => {
      this.commands = this.commands.filter((item) => item !== command);
    };
  }
  private matchesShortcut(event: KeyboardEvent): boolean {
    const parts = this.shortcut.toLowerCase().split("+");
    if (event.key.toLowerCase() !== parts.at(-1)) return false;
    if (
      event.shiftKey !== parts.includes("shift") ||
      event.altKey !== parts.includes("alt")
    )
      return false;
    if (parts.includes("mod"))
      return navigator.platform.includes("Mac") ? event.metaKey : event.ctrlKey;
    return event.ctrlKey === parts.includes("ctrl");
  }
  private onGlobalKeyDown = (event: KeyboardEvent): void => {
    if (this.matchesShortcut(event)) {
      event.preventDefault();
      this.open ? this.close() : this.openPalette();
    }
  };

  private get filtered(): LyraCommand[] {
    const locale = this.effectiveLocale;
    const query = this.queryText.trim().toLocaleLowerCase(locale);
    if (
      this.filteredForCommands !== this.commands ||
      this.filteredForQuery !== query ||
      this.filteredForLocale !== locale
    ) {
      this.filteredForCommands = this.commands;
      this.filteredForQuery = query;
      this.filteredForLocale = locale;
      if (!query) {
        this.filteredRows = this.commands;
      } else {
        const haystacks = this.searchHaystacks;
        this.filteredRows = this.commands.filter((_, index) =>
          haystacks[index]!.includes(query)
        );
      }
    }
    return this.filteredRows;
  }

  private select(command: LyraCommand): void {
    if (command.disabled) return;
    this.emit("lr-select", { command });
    command.onSelect?.();
    this.close();
  }
  /** First enabled index at or past `from`, walking in `step` direction; -1 when every row that
   *  way is disabled (callers then keep the current index, preserving clamp-at-the-ends arrow
   *  behavior). Keeps the active option off disabled rows so Enter always has a live target. */
  private seekEnabled(rows: LyraCommand[], from: number, step: 1 | -1): number {
    for (let index = from; index >= 0 && index < rows.length; index += step)
      if (!rows[index]!.disabled) return index;
    return -1;
  }

  private setActiveIndex(rows: LyraCommand[], index: number): void {
    this.activeIndex = index;
    this.activeCommand = index >= 0 ? rows[index] : undefined;
  }

  private onKeyDown = (event: KeyboardEvent): void => {
    const rows = this.filtered;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = this.seekEnabled(rows, this.activeIndex + 1, 1);
      if (next !== -1) this.setActiveIndex(rows, next);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const previous = this.seekEnabled(rows, this.activeIndex - 1, -1);
      if (previous !== -1) this.setActiveIndex(rows, previous);
    } else if (event.key === "Enter") {
      const active = rows[this.activeIndex];
      if (active) {
        event.preventDefault();
        this.select(active);
      }
    }
  };

  private onInput = (event: Event): void => {
    this.queryText = (event.target as HTMLInputElement).value;
    this.listScrollTop = 0;
    const list = this.renderRoot.querySelector<HTMLElement>('[part="list"]');
    if (list) list.scrollTop = 0;
    const rows = this.filtered;
    this.setActiveIndex(rows, this.seekEnabled(rows, 0, 1));
  };

  private get resultModel(): CommandResultModel {
    const rows = this.filtered;
    if (this.resultModelFor === rows && this.resultModelCache)
      return this.resultModelCache;
    const resultRows: CommandResultRow[] = [];
    const groups: CommandResultGroup[] = [];
    let top = 0;
    let previousGroup: string | undefined;
    let group: CommandResultGroup | undefined;
    for (let index = 0; index < rows.length; index++) {
      const command = rows[index]!;
      const label = command.group ?? "";
      if (!group || label !== previousGroup) {
        group = {
          index: groups.length,
          label,
          headingTop: label ? top : undefined,
          rows: [],
        };
        groups.push(group);
        previousGroup = label;
        if (label) top += GROUP_ROW_HEIGHT;
      }
      const row = { command, index, top, groupIndex: group.index };
      group.rows.push(row);
      resultRows.push(row);
      top += COMMAND_ROW_HEIGHT;
    }
    this.resultModelFor = rows;
    this.resultModelCache = { rows: resultRows, groups, totalHeight: top };
    return this.resultModelCache;
  }

  private visibleGroups(model: CommandResultModel): CommandResultGroup[] {
    if (model.rows.length === 0) return [];
    const minimum = Math.max(
      0,
      this.listScrollTop - COMMAND_ROW_HEIGHT * RESULT_OVERSCAN_ROWS
    );
    const maximum =
      this.listScrollTop +
      this.listViewportHeight +
      COMMAND_ROW_HEIGHT * RESULT_OVERSCAN_ROWS;
    let low = 0;
    let high = model.rows.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (model.rows[middle]!.top + COMMAND_ROW_HEIGHT < minimum)
        low = middle + 1;
      else high = middle;
    }
    const visibleIndexes = new Set<number>();
    for (let index = low; index < model.rows.length; index++) {
      const row = model.rows[index]!;
      if (row.top > maximum) break;
      visibleIndexes.add(index);
    }
    if (this.activeIndex >= 0) visibleIndexes.add(this.activeIndex);
    return model.groups
      .map((entry) => ({
        ...entry,
        rows: entry.rows.filter((row) => visibleIndexes.has(row.index)),
      }))
      .filter((entry) => entry.rows.length > 0);
  }

  private optionId(index: number): string {
    return `${this.listId}-opt-${index}`;
  }

  private scrollActiveIntoView(): void {
    if (this.activeIndex < 0) return;
    const list = this.renderRoot.querySelector<HTMLElement>('[part="list"]');
    const row = this.resultModel.rows[this.activeIndex];
    if (!list || !row) return;
    const top = row.top;
    const bottom = top + COMMAND_ROW_HEIGHT;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = Math.max(0, bottom - list.clientHeight);
    }
  }

  private onListScroll = (event: Event): void => {
    const list = event.currentTarget as HTMLElement;
    if (this.listScrollFrame !== undefined) return;
    this.listScrollFrame = requestAnimationFrame(() => {
      this.listScrollFrame = undefined;
      this.listScrollTop = list.scrollTop;
    });
  };

  private renderCommand(row: CommandResultRow, total: number): TemplateResult {
    const command = row.command;
    const active = row.index === this.activeIndex;
    return html`<button
      id=${this.optionId(row.index)}
      part="command"
      role="option"
      style=${`transform:translateY(${row.top}px)`}
      data-active=${active ? "true" : "false"}
      aria-selected=${active ? "true" : "false"}
      aria-disabled=${command.disabled ? "true" : "false"}
      aria-setsize=${total}
      aria-posinset=${row.index + 1}
      ?disabled=${command.disabled}
      @mouseenter=${() => {
        if (!command.disabled) this.setActiveIndex(this.filtered, row.index);
      }}
      @click=${() => this.select(command)}
    >
      ${command.icon
        ? html`<span part="icon" aria-hidden="true"
            >${command.icon as TemplateResult}</span
          >`
        : nothing}<span part="label">${command.label}</span
      ><span part="description">${command.description ?? ""}</span
      >${command.shortcut
        ? html`<span part="shortcut">${command.shortcut}</span>`
        : nothing}
    </button>`;
  }

  override render(): TemplateResult {
    if (!this.open) return html``;
    const rows = this.filtered;
    const model = this.resultModel;
    const visibleGroups = this.visibleGroups(model);
    const activeId =
      this.activeIndex >= 0 ? this.optionId(this.activeIndex) : nothing;
    return html`<div
      part="backdrop"
      @click=${(event: Event) => {
        if (event.target === event.currentTarget)
          this.overlay?.dismissBackdrop();
      }}
    >
      <section
        part="dialog"
        role="dialog"
        aria-modal="true"
        aria-label=${this.accessibleLabel ||
        this.localize("commandPaletteLabel")}
        tabindex="-1"
        @keydown=${this.onKeyDown}
      >
        <div part="search">
          <lr-icon name="search" aria-hidden="true"></lr-icon
          ><input
            part="input"
            type="search"
            .value=${this.queryText}
            placeholder=${this.localize("commandPalettePlaceholder")}
            aria-controls=${this.listId}
            aria-activedescendant=${activeId}
            @input=${this.onInput}
          />
        </div>
        <div
          part="list"
          id=${this.listId}
          role="listbox"
          aria-label=${this.localize("commandPaletteResults")}
          @scroll=${this.onListScroll}
        >
          ${rows.length
            ? html`<div
                part="list-spacer"
                role="presentation"
                style=${`block-size:${model.totalHeight}px`}
              >
                ${visibleGroups.map((group) => {
                  const headingId = `${this.listId}-group-${group.index}`;
                  return html`<div
                    part="command-group"
                    role=${group.label ? "group" : "presentation"}
                    aria-labelledby=${group.label ? headingId : nothing}
                  >
                    ${group.label
                      ? html`<div
                          id=${headingId}
                          part="group"
                          style=${`transform:translateY(${
                            group.headingTop ?? 0
                          }px)`}
                        >
                          ${group.label}
                        </div>`
                      : nothing}
                    ${group.rows.map((row) =>
                      this.renderCommand(row, rows.length)
                    )}
                  </div>`;
                })}
              </div>`
            : html`<div part="empty">
                ${this.localize("commandPaletteEmpty")}
              </div>`}
        </div>
      </section>
    </div>`;
  }
}
declare global {
  interface HTMLElementTagNameMap {
    "lr-command-palette": LyraCommandPalette;
  }
}
