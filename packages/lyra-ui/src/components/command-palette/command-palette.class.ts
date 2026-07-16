import { html, nothing, type TemplateResult } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { nextId } from '../../internal/a11y.js';
import { styles } from './command-palette.styles.js';

export interface LyraCommand { id: string; label: string; description?: string; group?: string; shortcut?: string; keywords?: string[]; disabled?: boolean; onSelect?: () => void; }
export interface LyraCommandPaletteEventMap { 'lyra-select': CustomEvent<{ command: LyraCommand }>; 'lyra-open': CustomEvent<undefined>; 'lyra-close': CustomEvent<undefined>; }

/** `<lyra-command-palette>` — searchable application command menu with keyboard navigation.
 * @customElement lyra-command-palette
 * @event lyra-select - A command was chosen; detail is `{ command }`.
 * @event lyra-open - The palette opened.
 * @event lyra-close - The palette closed.
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
  @query('input') private inputEl?: HTMLInputElement;
  private listId = nextId('command-list');

  connectedCallback(): void { super.connectedCallback(); window.addEventListener('keydown', this.onGlobalKeyDown); }
  disconnectedCallback(): void { window.removeEventListener('keydown', this.onGlobalKeyDown); super.disconnectedCallback(); }
  openPalette(): void { if (this.open) return; this.open = true; this.queryText = ''; this.activeIndex = 0; this.emit('lyra-open'); queueMicrotask(() => this.inputEl?.focus()); }
  close(): void { if (!this.open) return; this.open = false; this.emit('lyra-close'); }
  registerCommand(command: LyraCommand): () => void { this.commands = [...this.commands, command]; return () => { this.commands = this.commands.filter((item) => item !== command); }; }
  private matchesShortcut(event: KeyboardEvent): boolean { const parts = this.shortcut.toLowerCase().split('+'); return parts.includes('mod') ? event.key.toLowerCase() === parts.at(-1) && (navigator.platform.includes('Mac') ? event.metaKey : event.ctrlKey) : parts.includes(event.key.toLowerCase()) && parts.every((part) => !['shift','alt','ctrl'].includes(part) || event[`${part}Key` as 'shiftKey' | 'altKey' | 'ctrlKey']); }
  private onGlobalKeyDown = (event: KeyboardEvent): void => { if (this.matchesShortcut(event)) { event.preventDefault(); this.open ? this.close() : this.openPalette(); } };
  private get filtered(): LyraCommand[] { const q = this.queryText.trim().toLowerCase(); return this.commands.filter((command) => !q || [command.label, command.description ?? '', command.group ?? '', ...(command.keywords ?? [])].join(' ').toLowerCase().includes(q)); }
  private select(command: LyraCommand): void { if (command.disabled) return; this.emit('lyra-select', { command }); command.onSelect?.(); this.close(); }
  private onKeyDown = (event: KeyboardEvent): void => { const rows = this.filtered; if (event.key === 'Escape') { event.preventDefault(); this.close(); } else if (event.key === 'ArrowDown') { event.preventDefault(); this.activeIndex = Math.min(this.activeIndex + 1, Math.max(0, rows.length - 1)); } else if (event.key === 'ArrowUp') { event.preventDefault(); this.activeIndex = Math.max(0, this.activeIndex - 1); } else if (event.key === 'Enter' && rows[this.activeIndex]) { event.preventDefault(); this.select(rows[this.activeIndex]); } };
  private onInput = (event: Event): void => { this.queryText = (event.target as HTMLInputElement).value; this.activeIndex = 0; };
  render(): TemplateResult {
    if (!this.open) return html``;
    const rows = this.filtered;
    let previousGroup = '';
    return html`<div part="backdrop" @click=${(event: Event) => { if (event.target === event.currentTarget) this.close(); }}>
      <section part="dialog" role="dialog" aria-modal="true" aria-label=${this.accessibleLabel || this.localize('commandPaletteLabel')} @keydown=${this.onKeyDown}>
        <div part="search"><lyra-icon name="search" aria-hidden="true"></lyra-icon><input part="input" type="search" .value=${this.queryText} placeholder=${this.localize('commandPalettePlaceholder')} aria-controls=${this.listId} @input=${this.onInput} /></div>
        <div part="list" id=${this.listId} role="listbox" aria-label=${this.localize('commandPaletteResults')}>
          ${rows.length ? rows.map((command, index) => { const group = command.group ?? ''; const heading = group && group !== previousGroup ? (previousGroup = group, html`<div part="group">${group}</div>`) : nothing; return html`${heading}<button part="command" role="option" data-active=${index === this.activeIndex ? 'true' : 'false'} aria-selected=${index === this.activeIndex ? 'true' : 'false'} ?disabled=${command.disabled} @mouseenter=${() => { this.activeIndex = index; }} @click=${() => this.select(command)}><span>${command.label}</span><span part="description">${command.description ?? ''}</span>${command.shortcut ? html`<span part="shortcut">${command.shortcut}</span>` : nothing}</button>`; }) : html`<div part="empty">${this.localize('commandPaletteEmpty')}</div>`}
        </div>
      </section>
    </div>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-command-palette': LyraCommandPalette; } }
