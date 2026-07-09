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
 * format-choice menu. First-party invention; consolidates ad-hoc "export CSV"
 * buttons duplicated across surveyed repos.
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
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('open')) {
      this.cleanup?.();
      this.cleanup = undefined;
      if (this.open) {
        const anchor = this.renderRoot.querySelector('[part="trigger"]') as HTMLElement | null;
        const menu = this.renderRoot.querySelector('[part="menu"]') as HTMLElement | null;
        if (anchor && menu) this.cleanup = place(anchor, menu);
      }
    }
  }

  private doExport(format: ExportFormat): void {
    this.open = false;
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
    else this.open = !this.open;
  }

  render(): TemplateResult {
    return html`
      <button part="trigger" type="button" ?disabled=${this.disabled} @click=${() => this.onTriggerClick()}>
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
