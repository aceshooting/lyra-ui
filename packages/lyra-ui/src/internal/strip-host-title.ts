import type { LitElement } from 'lit';

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
 * Normalization lives in `attributeChangedCallback`, not Lit's later update hook: assigning the
 * same title value twice does not schedule a second reactive update, but it still must not leave a
 * native tooltip on the host. Removing an observed attribute fires the callback synchronously just
 * like setting one does; a re-entrancy guard prevents that removal from resetting the property.
 *
 * The explicit return-type annotation is required so TypeScript can emit a
 * declaration file for the (otherwise anonymous) mixin class (avoids TS4094).
 */
export function StripHostTitleAttribute<T extends Constructor<LitElement>>(Base: T): T {
  class StripHostTitleAttributeElement extends Base {
    private stripHostTitleAttr = false;

    override attributeChangedCallback(name: string, old: string | null, value: string | null): void {
      if (name === 'title' && this.stripHostTitleAttr) return;
      super.attributeChangedCallback(name, old, value);
      if (name === 'title' && value !== null && this.hasAttribute('title')) {
        // The base callback synchronously converted the attribute into the public property. Strip
        // only the redundant host attribute; the guarded removal callback must not clear the value
        // that was just stored. This also runs during late upgrade/hydration.
        this.stripHostTitleAttr = true;
        try {
          this.removeAttribute('title');
        } finally {
          this.stripHostTitleAttr = false;
        }
      }
    }
  }
  return StripHostTitleAttributeElement;
}
