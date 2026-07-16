import type { LitElement, PropertyValues } from 'lit';

type Constructor<T> = new (...args: any[]) => T;

/**
 * Mixin for a component whose own `title` reactive property is rendered
 * somewhere inside its shadow tree (e.g. a truncating heading that carries
 * its own scoped native `title` attribute for a disclosure tooltip). Once
 * Lit has synced a host-level `title` attribute into that property, the
 * host's own `title` attribute is stripped -- otherwise the browser's
 * global tooltip attribute would still be present on the host itself,
 * making the whole element show a native tooltip that repeats the same text
 * the shadow-tree element already shows on its own.
 *
 * Removing an observed attribute fires `attributeChangedCallback`
 * synchronously just like setting one does; a re-entrancy guard
 * (`stripHostTitleAttr`) prevents that from being mistaken for a fresh
 * (empty) attribute value, which would otherwise reset the `title` property
 * right back to `null`, losing the value it just finished syncing in.
 *
 * The explicit return-type annotation is required so TypeScript can emit a
 * declaration file for the (otherwise anonymous) mixin class (avoids TS4094).
 */
export function StripHostTitleAttribute<T extends Constructor<LitElement>>(Base: T): T {
  class StripHostTitleAttributeElement extends Base {
    private stripHostTitleAttr = false;

    attributeChangedCallback(name: string, old: string | null, value: string | null): void {
      if (name === 'title' && this.stripHostTitleAttr) return;
      super.attributeChangedCallback(name, old, value);
    }

    protected updated(changed: PropertyValues): void {
      super.updated(changed);
      if (changed.has('title') && this.hasAttribute('title')) {
        // The attribute has already been converted into the `title` property
        // by this point (that's how it got here), so the DOM attribute itself
        // is now redundant -- and, left in place, would make the whole host
        // show a native tooltip repeating the title text on hover.
        this.stripHostTitleAttr = true;
        this.removeAttribute('title');
        this.stripHostTitleAttr = false;
      }
    }
  }
  return StripHostTitleAttributeElement;
}
