import { html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';
import { LyraElement } from '../../../internal/lyra-element.js';
import { tag } from '../../../internal/prefix.js';
import { styles } from './breadcrumb.styles.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: START
import type { LyraLocaleStrings } from '../../../internal/localization.js';
import { LYRA_DEFAULT_breadcrumb } from '../../../internal/default-strings.generated.js';
// GENERATED DEFAULT-STRING SLICE IMPORT: END

const DECORATIVE_SEPARATOR_CLONE_ATTRIBUTE =
  /^(?:aria-|form(?:action|enctype|method|novalidate|target)?$|(?:for|headers|id|list|name|required)$)/;

function sanitizeDecorativeSeparatorClone(clone: Element): void {
  for (const element of [clone, ...clone.querySelectorAll('*')]) {
    for (const attribute of element.getAttributeNames()) {
      if (DECORATIVE_SEPARATOR_CLONE_ATTRIBUTE.test(attribute)) {
        element.removeAttribute(attribute);
      }
    }
  }
}

/**
 * `<lr-breadcrumb>` — a responsive navigation trail.
 *
 * @customElement lr-breadcrumb
 * @slot - `<lr-breadcrumb-item>` children.
 * @slot separator - Decorative visual separator copied into each item that does not provide its own
 *   separator. Generated copies are inert and aria-hidden, with identifiers, ID references, form
 *   associations, and submission attributes removed; do not use this slot for interactive content or
 *   form controls.
 * @csspart base - Compatibility name for the navigation wrapper; use `breadcrumb`.
 * @csspart breadcrumb - The navigation wrapper. It is the same node as `base`.
 * @csspart list - The `role="list"` flex row wrapping the slotted items.
 * @status stable
 * @since 4.0.0
 */
export class LyraBreadcrumb extends LyraElement {
  // GENERATED DEFAULT-STRING SLICE: START
  /** @internal */
  protected static override readonly defaultStrings: Readonly<LyraLocaleStrings> = {
    ...super.defaultStrings,
    breadcrumb: LYRA_DEFAULT_breadcrumb,
  };
  // GENERATED DEFAULT-STRING SLICE: END

  static override styles = [LyraElement.styles, styles];
  /** Host-level `aria-label` override for the trail's accessible name --
   *  wins over the localized default ("Breadcrumb"). Set as a plain
   *  `aria-label` attribute on `<lr-breadcrumb>` itself, not a public JS
   *  property, since the `<nav>` landmark that owns the role lives in the
   *  shadow root and never inherits a host attribute automatically. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';

  /** Accessible name matching both pinned upstream breadcrumb contracts. A host `aria-label`
   * remains the highest-priority override. */
  @property() label = '';

  private generatedSeparators = new Map<Element, Element[]>();

  override connectedCallback(): void {
    super.connectedCallback();
    this.scheduleAfterUpdate(this.syncSeparators);
  }

  override disconnectedCallback(): void {
    this.clearGeneratedSeparators();
    super.disconnectedCallback();
  }

  private clearGeneratedSeparators(): void {
    for (const nodes of this.generatedSeparators.values()) nodes.forEach((node) => node.remove());
    this.generatedSeparators.clear();
  }

  private syncSeparators = (): void => {
    this.clearGeneratedSeparators();
    const separatorSlot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="separator"]');
    const sources = separatorSlot?.assignedElements({ flatten: true });
    if (!sources?.length) return;

    for (const item of this.children) {
      if (item.localName !== tag('breadcrumb-item')) continue;
      if (item.querySelector(':scope > [slot=separator]')) continue;
      const clones = sources.map((source) => {
        const clone = source.cloneNode(true) as Element;
        sanitizeDecorativeSeparatorClone(clone);
        clone.setAttribute('slot', 'separator');
        item.append(clone);
        return clone;
      });
      this.generatedSeparators.set(item, clones);
    }
  };

  override render(): TemplateResult {
    const hostLabel = this.getAttribute('aria-label');
    const label = hostLabel === null ? this.label || this.localize('breadcrumb') : hostLabel;
    return html`<nav part="base breadcrumb" aria-label=${label}>
      <div part="list" role="list"><slot @slotchange=${this.syncSeparators}></slot></div>
      <slot class="separator-source" name="separator" @slotchange=${this.syncSeparators}></slot>
    </nav>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-breadcrumb': LyraBreadcrumb; } }
