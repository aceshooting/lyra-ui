import { html, nothing, svg, type PropertyValues, type TemplateResult } from 'lit';
import { property, query } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
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

/** `<lr-icon>` — a tiny dependency-free SVG icon primitive using a named path set.
 * @customElement lr-icon
 * @slot - Optional custom SVG/path content when `name` is not supplied.
 * @csspart svg - The rendered SVG.
 * @cssprop [--lr-icon-size=var(--lr-size-1-25rem)] - Inline and block size of the icon box.
 */
export class LyraIcon extends LyraElement {
  static override styles = [LyraElement.styles, styles];
  @property() name = '';
  @property() path = '';
  @property() label = '';
  @query('svg') private svgEl?: SVGSVGElement;
  @query('slot') private customSlot?: HTMLSlotElement;

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    this.syncCustomNodes();
  }

  private onCustomSlotChange = (): void => {
    this.syncCustomNodes();
  };

  /**
   * SVG geometry distributed through a shadow-DOM slot does not paint reliably in Chromium when
   * the slot itself is inside an SVG. Keep the public custom-content slot, but clone its trusted
   * SVG nodes into the component-owned SVG so path/circle/group content has a real SVG parent.
   */
  private syncCustomNodes(): void {
    const svgEl = this.svgEl;
    if (!svgEl) return;
    svgEl.querySelectorAll('[data-lr-custom-copy]').forEach((node) => node.remove());

    const slot = this.customSlot;
    if (!slot) return;
    for (const node of slot.assignedNodes({ flatten: true })) {
      const copy = this.cloneSvgNode(node);
      if (!copy) continue;
      copy.setAttribute('data-lr-custom-copy', '');
      svgEl.append(copy);
    }
  }

  private cloneSvgNode(node: Node): SVGElement | null {
    if (!(node instanceof Element)) return null;
    // A hyphenated light-DOM child is a custom element, not an SVG primitive.
    // Creating it with the SVG namespace produces an inert node that can never
    // upgrade; skip it rather than silently changing its semantics.
    if (node.localName.includes('-')) return null;
    const copy = document.createElementNS('http://www.w3.org/2000/svg', node.localName);
    for (const attribute of node.attributes) {
      copy.setAttribute(attribute.name, attribute.value);
    }
    for (const child of node.childNodes) {
      const childCopy = this.cloneSvgNode(child);
      if (childCopy) copy.append(childCopy);
      else if (child.nodeType === Node.TEXT_NODE) copy.append(child.cloneNode(true));
    }
    return copy;
  }

  override render(): TemplateResult {
    const path = this.path || PATHS[this.name] || '';
    const hostLabel = this.getAttribute('aria-label');
    const accessibleLabel = hostLabel ?? this.label;
    return html`<svg part="svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden=${accessibleLabel ? 'false' : 'true'} aria-label=${accessibleLabel || nothing} focusable="false">${path ? svg`<path d=${path}></path>` : html`<slot @slotchange=${this.onCustomSlotChange}></slot>`}</svg>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-icon': LyraIcon; } }
