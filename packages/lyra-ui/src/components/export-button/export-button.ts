import { html, nothing, type TemplateResult, type PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { defineElement } from '../../internal/prefix.js';
import { place } from '../../internal/positioner.js';
import { buildCsv, downloadBlob, type CsvColumn } from './csv.js';
import { styles } from './export-button.styles.js';

export type ExportFormat = 'csv' | 'json';

/**
 * `<lyra-export-button>` — a CSV/JSON download button, single-format or a
 * format-choice menu. First-party invention; consolidates the ad-hoc
 * "export CSV" button pattern common across dashboard UIs.
 *
 * @customElement lyra-export-button
 * @event lyra-export - `detail: { format }`, cancelable — call `preventDefault()`
 *   to substitute the built-in client-side download with a server-generated one.
 * @event lyra-export-complete - Fired after a non-cancelled download completes.
 * @csspart trigger, menu, menu-item
 */
export class LyraExportButton extends LyraElement {
  static styles = [LyraElement.styles, styles];

  @property({ attribute: false }) rows: Record<string, unknown>[] = [];
  @property({ attribute: false }) columns: CsvColumn[] = [];
  @property() filename = 'export';
  @property({ attribute: false }) formats: ExportFormat[] = ['csv'];
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property() label = 'Export';
  @property({ type: Boolean, reflect: true }) open = false;

  private cleanup?: () => void;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.cleanup?.();
    document.removeEventListener('pointerdown', this.onDocPointer);
  }

  private onDocPointer = (e: PointerEvent): void => {
    if (!e.composedPath().includes(this)) this.closeMenu();
  };

  private openMenu(): void {
    if (this.open) return;
    this.open = true;
  }

  private closeMenu(): void {
    if (!this.open) return;
    this.open = false;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.open) {
      e.preventDefault();
      this.closeMenu();
      (this.renderRoot.querySelector('[part="trigger"]') as HTMLElement | null)?.focus();
    }
  };

  protected firstUpdated(): void {
    // Single delegated listener catches Escape from the trigger button or
    // any menu-item inside this shadow root.
    this.renderRoot.addEventListener('keydown', this.onKeyDown as EventListener);
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('open')) {
      this.cleanup?.();
      this.cleanup = undefined;
      // Reacting to the `open` property itself (not just inside
      // openMenu()) means this fires however `open` became true -- via
      // openMenu()'s own click path, or a consumer/test setting
      // `el.open = true` directly (valid API on a `reflect: true`
      // property), which bypasses openMenu() entirely.
      document.removeEventListener('pointerdown', this.onDocPointer);
      if (this.open) {
        const anchor = this.renderRoot.querySelector('[part="trigger"]') as HTMLElement | null;
        const menu = this.renderRoot.querySelector('[part="menu"]') as HTMLElement | null;
        if (anchor && menu) this.cleanup = place(anchor, menu);
        document.addEventListener('pointerdown', this.onDocPointer);
      }
    }
  }

  private doExport(format: ExportFormat): void {
    this.closeMenu();
    const ev = this.emit('lyra-export', { format });
    if (ev.defaultPrevented) return;

    if (format === 'csv') {
      downloadBlob(buildCsv(this.rows, this.columns), `${this.filename}.csv`, 'text/csv;charset=utf-8;');
    } else {
      downloadBlob(JSON.stringify(this.rows, null, 2), `${this.filename}.json`, 'application/json');
    }
    this.emit('lyra-export-complete', { format });
  }

  private onTriggerClick(): void {
    if (this.disabled) return;
    if (this.formats.length <= 1) this.doExport(this.formats[0] ?? 'csv');
    else this.open ? this.closeMenu() : this.openMenu();
  }

  render(): TemplateResult {
    return html`
      <button
        part="trigger"
        type="button"
        ?disabled=${this.disabled}
        aria-haspopup=${this.formats.length > 1 ? 'menu' : nothing}
        aria-expanded=${this.formats.length > 1 ? (this.open ? 'true' : 'false') : nothing}
        @click=${() => this.onTriggerClick()}
      >
        ${this.label}
      </button>
      ${this.formats.length > 1
        ? html`<div part="menu" role="menu">
            ${this.formats.map(
              (f) =>
                html`<button
                  part="menu-item"
                  role="menuitem"
                  type="button"
                  @click=${() => this.doExport(f)}
                >
                  ${f.toUpperCase()}
                </button>`,
            )}
          </div>`
        : nothing}
    `;
  }
}

defineElement('export-button', LyraExportButton);

declare global {
  interface HTMLElementTagNameMap {
    'lyra-export-button': LyraExportButton;
  }
}
