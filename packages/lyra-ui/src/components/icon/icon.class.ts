import { html, svg, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../internal/lyra-element.js';
import { styles } from './icon.styles.js';

const PATHS: Record<string, string> = {
  add: 'M12 5v14M5 12h14',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M18 6 6 18',
  search: 'm21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  'chevron-left': 'm15 18-6-6 6-6',
  'chevron-right': 'm9 18 6-6-6-6',
  'chevron-down': 'm6 9 6 6 6-6',
  calendar: 'M6 3v3M18 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Z',
  command: 'M6 6h4v4H6zM14 6h4v4h-4zM6 14h4v4H6zM14 14h4v4h-4z',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3',
};

/** `<lyra-icon>` — a tiny dependency-free SVG icon primitive using a named path set.
 * @customElement lyra-icon
 * @slot - Optional custom SVG/path content when `name` is not supplied.
 * @csspart svg - The rendered SVG.
 */
export class LyraIcon extends LyraElement {
  static styles = [LyraElement.styles, styles];
  @property() name = '';
  @property() path = '';
  @property() label = '';
  render(): TemplateResult {
    const path = this.path || PATHS[this.name] || '';
    return html`<svg part="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden=${this.label ? 'false' : 'true'} aria-label=${this.label || undefined} focusable="false">${path ? svg`<path d=${path}></path>` : html`<slot></slot>`}</svg>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lyra-icon': LyraIcon; } }
