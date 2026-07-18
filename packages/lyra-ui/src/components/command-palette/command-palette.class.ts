import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId } from '../../internal/a11y.js';
import { activateOverlay, type OverlayHandle } from '../../internal/overlay-manager.js';
import { lockScroll } from '../../internal/scroll-lock.js';
import { styles } from './command-palette.styles.js';

export interface LyraCommand { id: string; label: string; description?: string; group?: string; shortcut?: string; keywords?: string[]; disabled?: boolean; onSelect?: () => void; }
export interface LyraCommandPaletteEventMap { 'lr-select': CustomEvent<{ command: LyraCommand }>; 'lr-open': CustomEvent<undefined>; 'lr-close': CustomEvent<undefined>; }

/** `<lr-command-palette>` — searchable application command menu with keyboard navigation.
 * Shared overlay infrastructure (the same one `<lr-dialog>` uses) coordinates focus-trapping
 * Tab, Escape dismissal, and document scroll-locking for as long as the palette is open.
 * @customElement lr-command-palette
 * @event lr-select - A command was chosen; detail is `{ command }`.
 * @event lr-open - The palette opened.
 * @event lr-close - The palette closed.
 * @csspart backdrop - Modal backdrop.
 * @csspart dialog - Palette dialog.
 * @csspart input - Search input.
 * @csspart list - Command list.
 * @csspart command - A command button.
 */
export class LyraCommandPalette extends LyraElement<LyraCommandPaletteEventMap> {
  static styles = [LyraElement.styles, styles];
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ attribute: false }) commands: LyraCommand[] = [];
  @property() shortcut = 'mod+k';
  @property({ attribute: 'aria-label' }) accessibleLabel = '';
  @state() private queryText = '';
  @state() private activeIndex = 0;
  private listId = nextId('command-list');
  private releaseScrollLock?: () => void;
  private overlay?: OverlayHandle;
  /** The `commands` array `haystacks` was built from -- reference-keyed memo, since `commands`
   *  only ever changes by reassignment (it's `attribute: false`; in-place mutation wouldn't
   *  trigger a re-render either). */
  private haystacksFor?: LyraCommand[];
  private haystacks: string[] = [];

  /** One lowercased searchable string per command, index-aligned with `commands`. `filtered`
   *  runs on every keystroke (and every ArrowUp/ArrowDown/Enter), so re-joining and lowercasing
   *  every row per call would scale with palette size for a result that only changes when the
   *  command list itself does. */
  private get searchHaystacks(): string[] {
    if (this.haystacksFor !== this.commands) {
      this.haystacksFor = this.commands;
      this.haystacks = this.commands.map((command) =>
        [command.label, command.description ?? '', command.group ?? '', ...(command.keywords ?? [])].join(' ').toLowerCase(),
      );
    }
    return this.haystacks;
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('open')) {
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
  }

  // Runs after render so the manager can resolve the rendered [part="dialog"] panel -- mirrors
  // lr-dialog's/lr-tool-select-dialog's identical ordering rationale.
  protected updated(changed: PropertyValues): void {
    if (changed.has('open') && this.open) {
      this.overlay?.focusInitial();
    }
    // The list is a fixed-height, scrollable box -- without this, arrowing past its visible rows
    // moves activeIndex/aria-activedescendant correctly but leaves the highlighted row scrolled
    // out of view. Mirrors lr-combobox's identical fix for the same shape of listbox.
    if (changed.has('activeIndex')) {
      this.renderRoot.querySelector<HTMLElement>('[part="command"][data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    }
  }

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this.onGlobalKeyDown);
    if (this.hasUpdated && this.open) {
      this.releaseScrollLock ??= lockScroll(this.ownerDocument);
      this.activateOverlay();
      queueMicrotask(() => this.overlay?.focusInitial());
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onGlobalKeyDown);
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
      panel: () => this.shadowRoot?.querySelector<HTMLElement>('[part="dialog"]') ?? null,
      onEscape: () => this.close(),
      onBackdrop: () => this.close(),
    });
  }

  openPalette(): void { if (this.open) return; this.open = true; this.queryText = ''; this.activeIndex = Math.max(0, this.seekEnabled(this.filtered, 0, 1)); this.emit('lr-open'); }
  close(): void { if (!this.open) return; this.open = false; this.emit('lr-close'); }
  registerCommand(command: LyraCommand): () => void { this.commands = [...this.commands, command]; return () => { this.commands = this.commands.filter((item) => item !== command); }; }
  private matchesShortcut(event: KeyboardEvent): boolean {
    const parts = this.shortcut.toLowerCase().split('+');
    if (event.key.toLowerCase() !== parts.at(-1)) return false;
    if (event.shiftKey !== parts.includes('shift') || event.altKey !== parts.includes('alt')) return false;
    if (parts.includes('mod')) return navigator.platform.includes('Mac') ? event.metaKey : event.ctrlKey;
    return event.ctrlKey === parts.includes('ctrl');
  }
  private onGlobalKeyDown = (event: KeyboardEvent): void => { if (this.matchesShortcut(event)) { event.preventDefault(); this.open ? this.close() : this.openPalette(); } };
  private get filtered(): LyraCommand[] { const q = this.queryText.trim().toLowerCase(); if (!q) return this.commands; const haystacks = this.searchHaystacks; return this.commands.filter((_, index) => haystacks[index]!.includes(q)); }
  private select(command: LyraCommand): void { if (command.disabled) return; this.emit('lr-select', { command }); command.onSelect?.(); this.close(); }
  /** First enabled index at or past `from`, walking in `step` direction; -1 when every row that
   *  way is disabled (callers then keep the current index, preserving clamp-at-the-ends arrow
   *  behavior). Keeps the active option off disabled rows so Enter always has a live target. */
  private seekEnabled(rows: LyraCommand[], from: number, step: 1 | -1): number {
    for (let index = from; index >= 0 && index < rows.length; index += step) if (!rows[index]!.disabled) return index;
    return -1;
  }
  private onKeyDown = (event: KeyboardEvent): void => { const rows = this.filtered; if (event.key === 'ArrowDown') { event.preventDefault(); const next = this.seekEnabled(rows, this.activeIndex + 1, 1); if (next !== -1) this.activeIndex = next; } else if (event.key === 'ArrowUp') { event.preventDefault(); const previous = this.seekEnabled(rows, this.activeIndex - 1, -1); if (previous !== -1) this.activeIndex = previous; } else if (event.key === 'Enter' && rows[this.activeIndex]) { event.preventDefault(); this.select(rows[this.activeIndex]); } };
  private onInput = (event: Event): void => { this.queryText = (event.target as HTMLInputElement).value; this.activeIndex = Math.max(0, this.seekEnabled(this.filtered, 0, 1)); };
  render(): TemplateResult {
    if (!this.open) return html``;
    const rows = this.filtered;
    const activeId = rows.length ? `${this.listId}-opt-${this.activeIndex}` : nothing;
    let previousGroup = '';
    return html`<div part="backdrop" @click=${(event: Event) => { if (event.target === event.currentTarget) this.overlay?.dismissBackdrop(); }}>
      <section part="dialog" role="dialog" aria-modal="true" aria-label=${this.accessibleLabel || this.localize('commandPaletteLabel')} tabindex="-1" @keydown=${this.onKeyDown}>
        <div part="search"><lr-icon name="search" aria-hidden="true"></lr-icon><input part="input" type="search" .value=${this.queryText} placeholder=${this.localize('commandPalettePlaceholder')} aria-controls=${this.listId} aria-activedescendant=${activeId} @input=${this.onInput} /></div>
        <div part="list" id=${this.listId} role="listbox" aria-label=${this.localize('commandPaletteResults')}>
          ${rows.length ? rows.map((command, index) => { const group = command.group ?? ''; const heading = group && group !== previousGroup ? (previousGroup = group, html`<div part="group">${group}</div>`) : nothing; return html`${heading}<button id=${`${this.listId}-opt-${index}`} part="command" role="option" data-active=${index === this.activeIndex ? 'true' : 'false'} aria-selected=${index === this.activeIndex ? 'true' : 'false'} aria-disabled=${command.disabled ? 'true' : 'false'} ?disabled=${command.disabled} @mouseenter=${() => { if (!command.disabled) this.activeIndex = index; }} @click=${() => this.select(command)}><span>${command.label}</span><span part="description">${command.description ?? ''}</span>${command.shortcut ? html`<span part="shortcut">${command.shortcut}</span>` : nothing}</button>`; }) : html`<div part="empty">${this.localize('commandPaletteEmpty')}</div>`}
        </div>
      </section>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-command-palette': LyraCommandPalette; } }
