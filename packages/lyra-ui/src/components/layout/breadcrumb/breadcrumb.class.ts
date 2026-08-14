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

function decorativeSeparatorClone(source: Element): Element {
  const clone = source.cloneNode(true) as Element;
  sanitizeDecorativeSeparatorClone(clone);
  clone.setAttribute('slot', 'separator');
  return clone;
}

/** Patch a generated decorative tree without replacing identity-compatible custom elements. */
function patchDecorativeSeparator(source: Element, clone: Element): void {
  const desired = decorativeSeparatorClone(source);
  const patch = (next: Node, current: Node): void => {
    if (next.nodeType === 3 && current.nodeType === 3) {
      if (current.textContent !== next.textContent) current.textContent = next.textContent;
      return;
    }
    if (next.nodeType !== 1 || current.nodeType !== 1) return;
    const nextElement = next as Element;
    const currentElement = current as Element;
    for (const name of currentElement.getAttributeNames()) {
      if (!nextElement.hasAttribute(name)) currentElement.removeAttribute(name);
    }
    for (const name of nextElement.getAttributeNames()) {
      const value = nextElement.getAttribute(name)!;
      if (currentElement.getAttribute(name) !== value) currentElement.setAttribute(name, value);
    }
    const nextChildren = [...nextElement.childNodes];
    for (let index = 0; index < nextChildren.length; index += 1) {
      const nextChild = nextChildren[index];
      const currentChild = currentElement.childNodes[index];
      if (!nextChild) continue;
      if (!currentChild) {
        currentElement.append(nextChild.cloneNode(true));
        continue;
      }
      const compatible = nextChild.nodeType === currentChild.nodeType &&
        (nextChild.nodeType !== 1 ||
          (currentChild.nodeType === 1 &&
            (nextChild as Element).localName === (currentChild as Element).localName &&
            (nextChild as Element).namespaceURI === (currentChild as Element).namespaceURI));
      if (compatible) patch(nextChild, currentChild);
      else currentChild.replaceWith(nextChild.cloneNode(true));
    }
    while (currentElement.childNodes.length > nextChildren.length) {
      currentElement.lastChild?.remove();
    }
  };
  patch(desired, clone);
}

/**
 * `<lr-breadcrumb>` — a responsive navigation trail.
 *
 * @customElement lr-breadcrumb
 * @slot - `<lr-breadcrumb-item>` children.
 * @slot separator - Decorative visual separator copied into each item that does not provide its own
 *   separator. Generated copies are inert and aria-hidden, with identifiers, ID references, form
 *   associations, and submission attributes removed. Source mutations patch identity-compatible
 *   copies in place; do not use this slot for interactive content or form controls.
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
  /** Accessible-name override for the trail, mapped to the host's `aria-label` attribute the same
   *  way every other Lyra component spells this member. The `<nav>` landmark that owns the role
   *  lives in the shadow root and never inherits a host attribute automatically, so the value is
   *  copied onto it. Both spellings work: an `aria-label` attribute on `<lr-breadcrumb>` (which the
   *  attribute mapping also surfaces here) and a plain property assignment
   *  (`el.accessibleLabel = 'Docs trail'`). Wins over `label` and over the localized default
   *  ("Breadcrumb"); an explicitly empty `aria-label` attribute stays empty. */
  @property({ attribute: 'aria-label' }) accessibleLabel = '';

  /** Accessible name matching both pinned upstream breadcrumb contracts. A host `aria-label`
   * remains the highest-priority override. */
  @property() label = '';

  private generatedSeparators = new Map<Element, Array<{ source: Element; clone: Element }>>();
  private separatorObserver?: MutationObserver;
  private separatorObserverDocument?: Document;
  private firstItem?: Element;

  override connectedCallback(): void {
    super.connectedCallback();
    this.scheduleAfterUpdate(this.syncSeparators);
  }

  override disconnectedCallback(): void {
    this.clearGeneratedSeparators();
    this.separatorObserver?.disconnect();
    this.separatorObserver = undefined;
    this.separatorObserverDocument = undefined;
    this.setFirstItem(undefined);
    super.disconnectedCallback();
  }

  private clearGeneratedSeparators(): void {
    for (const records of this.generatedSeparators.values()) {
      records.forEach(({ clone }) => clone.remove());
    }
    this.generatedSeparators.clear();
  }

  private setFirstItem(item: Element | undefined): void {
    if (this.firstItem === item) return;
    this.firstItem?.removeAttribute('data-lr-breadcrumb-first');
    this.firstItem = item;
    item?.setAttribute('data-lr-breadcrumb-first', '');
  }

  private observeSeparatorSources(sources: Element[]): void {
    const ownerDocument = this.ownerDocument;
    if (!this.separatorObserver || this.separatorObserverDocument !== ownerDocument) {
      this.separatorObserver?.disconnect();
      const MutationObserverCtor = ownerDocument.defaultView?.MutationObserver;
      if (!MutationObserverCtor) return;
      this.separatorObserver = new MutationObserverCtor(this.syncSeparators);
      this.separatorObserverDocument = ownerDocument;
    } else {
      this.separatorObserver.disconnect();
    }
    for (const source of sources) {
      this.separatorObserver.observe(source, {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
  }

  private syncSeparators = (): void => {
    const separatorSlot = this.renderRoot.querySelector<HTMLSlotElement>('slot[name="separator"]');
    const sources = separatorSlot?.assignedElements({ flatten: true }) ?? [];
    this.observeSeparatorSources(sources);
    const items = [...this.children].filter((item) => item.localName === tag('breadcrumb-item'));
    this.setFirstItem(items[0]);
    const owned = new Set(items);

    for (const [item, records] of this.generatedSeparators) {
      if (owned.has(item)) continue;
      records.forEach(({ clone }) => clone.remove());
      this.generatedSeparators.delete(item);
    }

    for (const item of items) {
      const existing = this.generatedSeparators.get(item) ?? [];
      const generated = new Set(existing.map(({ clone }) => clone));
      const hasAuthoredSeparator = [...item.children].some(
        (child) => child.getAttribute('slot') === 'separator' && !generated.has(child),
      );
      if (hasAuthoredSeparator || sources.length === 0) {
        existing.forEach(({ clone }) => clone.remove());
        this.generatedSeparators.delete(item);
        continue;
      }
      const next = sources.map((source, index) => {
        const record = existing[index];
        if (record?.source === source) {
          patchDecorativeSeparator(source, record.clone);
          return record;
        }
        record?.clone.remove();
        const clone = decorativeSeparatorClone(source);
        item.append(clone);
        return { source, clone };
      });
      for (const record of existing.slice(sources.length)) record.clone.remove();
      this.generatedSeparators.set(item, next);
    }
  };

  override render(): TemplateResult {
    // Attribute presence first, so an explicitly empty `aria-label=""` stays empty. When the
    // attribute is absent the property is still consulted: a JS-only assignment never writes an
    // attribute back (this property does not reflect), so reading the attribute alone would make
    // `el.accessibleLabel = 'Docs trail'` silently inert.
    const hostLabel = this.getAttribute('aria-label');
    const label =
      hostLabel === null
        ? this.accessibleLabel || this.label || this.localize('breadcrumb')
        : hostLabel;
    return html`<nav part="base breadcrumb" aria-label=${label}>
      <div part="list" role="list"><slot @slotchange=${this.syncSeparators}></slot></div>
      <slot class="separator-source" name="separator" @slotchange=${this.syncSeparators}></slot>
    </nav>`;
  }
}
declare global { interface HTMLElementTagNameMap { 'lr-breadcrumb': LyraBreadcrumb; } }
