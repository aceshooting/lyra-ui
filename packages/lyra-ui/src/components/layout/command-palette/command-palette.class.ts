import { html, nothing, type TemplateResult, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { LyraElement } from "../../../internal/lyra-element.js";
import { nextId } from "../../../internal/a11y.js";
import {
  activateOverlay,
  type OverlayHandle,
} from "../../../internal/overlay-manager.js";
import { styles } from "./command-palette.styles.js";
import { resolveCssLength } from "../../../internal/css-length.js";
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_commandPaletteEmpty, LYRA_DEFAULT_commandPaletteLabel, LYRA_DEFAULT_commandPalettePlaceholder, LYRA_DEFAULT_commandPaletteResults } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END


/** Fallbacks only. The rendered heights come from `--lr-command-palette-row-height` /
 *  `-group-height`, which default to `3rem`/`2rem` -- equal to these numbers at a 16px root font
 *  and *unequal* at any other, including a user's raised browser font size. Rows are absolutely
 *  positioned at this pitch, so a stale value overlaps them; the live values are resolved in
 *  `measureRowPitch()`. */
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

/** Last-connected matching palette owns a global chord in each browsing context. */
const hotkeyOwners = new WeakMap<Window, LyraCommandPalette[]>();

function registerHotkeyOwner(view: Window, palette: LyraCommandPalette): void {
  const owners = hotkeyOwners.get(view) ?? [];
  hotkeyOwners.set(view, [...owners.filter((candidate) => candidate !== palette), palette]);
}

function unregisterHotkeyOwner(view: Window, palette: LyraCommandPalette): void {
  const owners = hotkeyOwners.get(view)?.filter((candidate) => candidate !== palette) ?? [];
  if (owners.length) hotkeyOwners.set(view, owners);
  else hotkeyOwners.delete(view);
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
  "lr-open": CustomEvent<null>;
  "lr-close": CustomEvent<null>;
}

/** `<lr-command-palette>` — searchable application command menu with keyboard navigation.
 * Shared overlay infrastructure (the same one `<lr-dialog>` uses) coordinates focus-trapping
 * Tab, Escape dismissal, and document scroll-locking for as long as the palette is open.
 * @customElement lr-command-palette
 * @event lr-select - A command was chosen; detail is `{ command }`.
 * @event lr-open - Emitted before the palette opens. Cancelable: `preventDefault()` keeps it
 * closed.
 * @event lr-close - Emitted before the palette closes. Cancelable: `preventDefault()` keeps it
 * open.
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
 * @cssprop [--lr-command-palette-row-height=var(--lr-size-3rem)] - Virtual command-row height;
 *   live changes rebuild row transforms, scrolling coordinates, and the result extent.
 * @cssprop [--lr-command-palette-group-height=var(--lr-size-2rem)] - Virtual group-heading height;
 *   live changes rebuild heading/row transforms and the result extent.
 * @cssprop [--lr-command-palette-active-bg=var(--lr-color-brand-quiet)] - Background of the active
 *   (keyboard-highlighted, `data-active="true"`) command row. Declared as an inline `var()` fallback
 *   (never on `:host`), so setting it on the element or an ancestor recolors only the active row
 *   without hijacking the library-wide `--lr-color-brand-quiet` token.
 * @status stable
 * @since 4.0.0
 */
export class LyraCommandPalette extends LyraElement<LyraCommandPaletteEventMap> {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    commandPaletteEmpty: LYRA_DEFAULT_commandPaletteEmpty,
    commandPaletteLabel: LYRA_DEFAULT_commandPaletteLabel,
    commandPalettePlaceholder: LYRA_DEFAULT_commandPalettePlaceholder,
    commandPaletteResults: LYRA_DEFAULT_commandPaletteResults,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  private _open = false;
  /** Whether the palette is open. Post-mount IDL and attribute writes use the same synchronous,
   * cancelable lifecycle as `openPalette()` and `close()`; initial markup stays silent. */
  @property({ type: Boolean, reflect: true })
  get open(): boolean {
    return this._open;
  }
  set open(next: boolean) {
    const normalized = Boolean(next);
    if (normalized === this._open) return;
    if (!this.hasUpdated) {
      this.commitOpen(normalized);
      return;
    }
    this.requestOpen(normalized);
  }
  @property({ attribute: false }) commands: LyraCommand[] = [];
  /** Exact global activation chord. `mod` resolves to Command on macOS and Control elsewhere. */
  @property() hotkey = "mod+k";
  @property({ attribute: "aria-label" }) accessibleLabel = "";
  @state() private queryText = "";
  @state() private activeIndex = 0;
  @state() private listScrollTop = 0;
  @state() private listViewportHeight = COMMAND_ROW_HEIGHT * 10;
  @state() private rowPitch = COMMAND_ROW_HEIGHT;
  @state() private groupPitch = GROUP_ROW_HEIGHT;
  private listId = nextId("command-list");
  private overlay?: OverlayHandle;
  private activeCommand?: LyraCommand;
  private listResizeObserver?: ResizeObserver;
  private observedList?: HTMLElement;
  private observedRow?: HTMLElement;
  private observedGroup?: HTMLElement;
  private rowPitchFrame?: number;
  private listScrollFrame?: number;
  /** Window that owns listeners, observers, and animation frames for the current connection. */
  private runtimeWindow?: Window;
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
  private resultModelRowPitch?: number;
  private resultModelGroupPitch?: number;
  private resultModelCache?: CommandResultModel;
  private openRequestTarget?: boolean;

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
    super.willUpdate(changed);
    if (changed.has("open")) {
      if (this.open) {
        this.activateOverlay();
      } else {
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
    super.updated(changed);
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
    this.observeList(list ?? undefined);
  }

  private observeList(list: HTMLElement | undefined): void {
    if (list !== this.observedList) {
      if (this.observedList)
        this.listResizeObserver?.unobserve(this.observedList);
      this.clearPitchSentinels();
      this.observedList = list;
      if (list) {
        this.listResizeObserver?.observe(list);
        // Measure up front as a fast path for browsers that delay the first ResizeObserver
        // callback. Queued, not synchronous: this runs inside Lit's updated() lifecycle, and a
        // reactive write from there logs "scheduled an update after an update completed" (the
        // same reason <lr-virtual-list> defers its own initial container measurement). The
        // observer stays responsible for every later measurement.
        queueMicrotask(() => {
          if (this.isConnected && this.observedList === list) this.measureRowPitch();
        });
      }
    }
    this.observePitchSentinels();
  }

  private observePitchSentinels(): void {
    const row =
      this.renderRoot.querySelector<HTMLElement>('[part="command"]') ??
      undefined;
    const group =
      this.renderRoot.querySelector<HTMLElement>('[part="group"]') ??
      undefined;
    if (row !== this.observedRow) {
      if (this.observedRow)
        this.listResizeObserver?.unobserve(this.observedRow);
      this.observedRow = row;
      if (row) this.listResizeObserver?.observe(row);
    }
    if (group !== this.observedGroup) {
      if (this.observedGroup)
        this.listResizeObserver?.unobserve(this.observedGroup);
      this.observedGroup = group;
      if (group) this.listResizeObserver?.observe(group);
    }
  }

  private clearPitchSentinels(): void {
    if (this.observedRow) this.listResizeObserver?.unobserve(this.observedRow);
    if (this.observedGroup) this.listResizeObserver?.unobserve(this.observedGroup);
    this.observedRow = undefined;
    this.observedGroup = undefined;
  }


  /** Resolves the two row pitches from their custom properties so the absolutely-positioned rows
   *  stay aligned with their painted heights. Hardcoding 48/32 matched only at a 16px root font;
   *  at a browser "large text" setting the rows grew but the pitch did not, overlapping every row
   *  and putting keyboard scrolling in the wrong coordinate space. */
  private measureRowPitch(): void {
    const style = this.ownerDocument.defaultView?.getComputedStyle(this);
    if (!style) return;
    const row = resolveCssLength(
      style.getPropertyValue("--lr-command-palette-row-height").trim(),
      { host: this }
    );
    const group = resolveCssLength(
      style.getPropertyValue("--lr-command-palette-group-height").trim(),
      { host: this }
    );
    if (row !== undefined && row > 0 && row !== this.rowPitch) this.rowPitch = row;
    if (group !== undefined && group > 0 && group !== this.groupPitch) this.groupPitch = group;
  }

  private scheduleRowPitchMeasurement(): void {
    if (this.rowPitchFrame !== undefined) return;
    const view = this.runtimeWindow ?? this.ownerDocument.defaultView;
    if (!view) {
      this.measureRowPitch();
      return;
    }
    this.rowPitchFrame = view.requestAnimationFrame(() => {
      this.rowPitchFrame = undefined;
      if (this.isConnected) this.measureRowPitch();
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    const view = this.ownerDocument.defaultView;
    this.runtimeWindow = view ?? undefined;
    if (view) {
      registerHotkeyOwner(view, this);
      view.addEventListener("keydown", this.onGlobalKeyDown);
    }
    const ResizeObserverCtor = view?.ResizeObserver;
    if (ResizeObserverCtor && view) {
      let observer: ResizeObserver;
      observer = new ResizeObserverCtor((entries) => {
        if (this.listResizeObserver !== observer || this.runtimeWindow !== view)
          return;
        this.scheduleRowPitchMeasurement();
        const entry = entries.find(
          (candidate) => candidate.target === this.observedList
        );
        if (!entry) return;
        const height =
          entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (height > 0 && this.listViewportHeight !== height)
          this.listViewportHeight = height;
      });
      this.listResizeObserver = observer;
    } else {
      this.listResizeObserver = undefined;
    }
    if (this.hasUpdated) {
      this.observeList(
        this.renderRoot.querySelector<HTMLElement>('[part="list"]') ?? undefined
      );
    }
    if (this.hasUpdated && this.open) {
      this.activateOverlay();
      queueMicrotask(() => this.overlay?.focusInitial());
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    const view = this.runtimeWindow;
    if (view) {
      unregisterHotkeyOwner(view, this);
      view.removeEventListener("keydown", this.onGlobalKeyDown);
    }
    this.overlay?.suspend();
    this.listResizeObserver?.disconnect();
    this.listResizeObserver = undefined;
    this.observedList = undefined;
    this.observedRow = undefined;
    this.observedGroup = undefined;
    if (this.listScrollFrame !== undefined) {
      view?.cancelAnimationFrame(this.listScrollFrame);
      this.listScrollFrame = undefined;
    }
    if (this.rowPitchFrame !== undefined) {
      view?.cancelAnimationFrame(this.rowPitchFrame);
      this.rowPitchFrame = undefined;
    }
    this.runtimeWindow = undefined;
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
      lockScroll: true,
      suspendWhenUnrendered: true,
    });
  }

  openPalette(): void {
    this.requestOpen(true);
  }

  close(): void {
    this.requestOpen(false);
  }

  private requestOpen(next: boolean): boolean {
    if (next === this._open || this.openRequestTarget === next) return false;
    this.openRequestTarget = next;
    const prevented = this.emit(next ? "lr-open" : "lr-close", null, {
      cancelable: true,
    }).defaultPrevented;
    this.openRequestTarget = undefined;
    if (prevented) {
      this.toggleAttribute("open", this._open);
      return false;
    }
    if (next) this.resetOpeningState();
    this.commitOpen(next);
    return true;
  }

  private resetOpeningState(): void {
    this.queryText = "";
    this.listScrollTop = 0;
    const rows = this.filtered;
    this.setActiveIndex(rows, this.seekEnabled(rows, 0, 1));
  }

  private commitOpen(next: boolean): void {
    if (next === this._open) return;
    const old = this._open;
    this._open = next;
    this.requestUpdate("open", old);
  }

  registerCommand(command: LyraCommand): () => void {
    this.commands = [...this.commands, command];
    return () => {
      this.commands = this.commands.filter((item) => item !== command);
    };
  }
  private matchesShortcut(event: KeyboardEvent): boolean {
    const parts = this.hotkey.toLowerCase().split("+").map((part) => part.trim());
    const key = parts.pop();
    if (!key || event.key.toLowerCase() !== key) return false;
    const modifiers = new Set(parts);
    if (
      modifiers.size !== parts.length ||
      [...modifiers].some((part) => !["alt", "ctrl", "meta", "mod", "shift"].includes(part)) ||
      (modifiers.has("mod") && (modifiers.has("ctrl") || modifiers.has("meta")))
    ) return false;
    const isMac = (this.runtimeWindow ?? this.ownerDocument.defaultView)?.navigator.platform.includes("Mac") ?? false;
    const expectedCtrl = modifiers.has("ctrl") || (modifiers.has("mod") && !isMac);
    const expectedMeta = modifiers.has("meta") || (modifiers.has("mod") && isMac);
    return event.ctrlKey === expectedCtrl &&
      event.metaKey === expectedMeta &&
      event.shiftKey === modifiers.has("shift") &&
      event.altKey === modifiers.has("alt");
  }
  private onGlobalKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat || event.isComposing || event.keyCode === 229) return;
    const view = this.runtimeWindow;
    if (!view || !this.matchesShortcut(event)) return;
    const owners = hotkeyOwners.get(view) ?? [];
    let owner: LyraCommandPalette | undefined;
    for (let index = owners.length - 1; index >= 0; index -= 1) {
      const candidate = owners[index]!;
      if (candidate.isConnected && candidate.matchesShortcut(event)) {
        owner = candidate;
        break;
      }
    }
    if (owner !== this) return;
    event.preventDefault();
    this.openPalette();
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
    if (event.isComposing || event.keyCode === 229) return;
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
    event.stopPropagation();
    this.queryText = (event.target as HTMLInputElement).value;
    this.listScrollTop = 0;
    const list = this.renderRoot.querySelector<HTMLElement>('[part="list"]');
    if (list) list.scrollTop = 0;
    const rows = this.filtered;
    this.setActiveIndex(rows, this.seekEnabled(rows, 0, 1));
  };

  private get resultModel(): CommandResultModel {
    const rows = this.filtered;
    if (
      this.resultModelFor === rows &&
      this.resultModelRowPitch === this.rowPitch &&
      this.resultModelGroupPitch === this.groupPitch &&
      this.resultModelCache
    )
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
        if (label) top += this.groupPitch;
      }
      const row = { command, index, top, groupIndex: group.index };
      group.rows.push(row);
      resultRows.push(row);
      top += this.rowPitch;
    }
    this.resultModelFor = rows;
    this.resultModelRowPitch = this.rowPitch;
    this.resultModelGroupPitch = this.groupPitch;
    this.resultModelCache = { rows: resultRows, groups, totalHeight: top };
    return this.resultModelCache;
  }

  private visibleGroups(model: CommandResultModel): CommandResultGroup[] {
    if (model.rows.length === 0) return [];
    const minimum = Math.max(
      0,
      this.listScrollTop - this.rowPitch * RESULT_OVERSCAN_ROWS
    );
    const maximum =
      this.listScrollTop +
      this.listViewportHeight +
      this.rowPitch * RESULT_OVERSCAN_ROWS;
    let low = 0;
    let high = model.rows.length - 1;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (model.rows[middle]!.top + this.rowPitch < minimum)
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
    const bottom = top + this.rowPitch;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = Math.max(0, bottom - list.clientHeight);
    }
  }

  private onListScroll = (event: Event): void => {
    const list = event.currentTarget as HTMLElement;
    if (this.listScrollFrame !== undefined) return;
    const view = this.runtimeWindow ?? this.ownerDocument.defaultView;
    if (!view) {
      this.listScrollTop = list.scrollTop;
      return;
    }
    this.listScrollFrame = view.requestAnimationFrame(() => {
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
      tabindex="-1"
      ?disabled=${command.disabled}
      @mouseenter=${() => {
        if (!command.disabled) this.setActiveIndex(this.filtered, row.index);
      }}
      @click=${() => this.select(command)}
    >
      ${command.icon
        ? html`<span part="icon" aria-hidden="true" inert
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
