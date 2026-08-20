import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

const nativeStyles = new URL("../../../styles/native.css", import.meta.url)
  .href;
const utilities = new URL("../../../styles/utilities.css", import.meta.url)
  .href;
const tokensRoot = new URL("../../../styles/tokens-root.css", import.meta.url)
  .href;

// A stand-in for an application's OWN custom element: it has a shadow root, and it is not a
// descendant of any lr-* shadow root, so it is exactly the case the resolved --lr-* layer never
// reached before tokens-root.css existed. The inherited custom properties do cross into its shadow
// root, so importing the stylesheet is the whole fix.
const demoPanelTag = 'app-token-panel';

if (typeof customElements !== 'undefined' && !customElements.get(demoPanelTag)) {
  customElements.define(
    demoPanelTag,
    class extends HTMLElement {
      connectedCallback(): void {
        if (this.shadowRoot) return;
        const root = this.attachShadow({ mode: 'open' });
        root.innerHTML = `
          <style>
            :host {
              display: block;
              padding: var(--lr-space-l);
              border: var(--lr-border-width-thin) solid var(--lr-color-border);
              border-radius: var(--lr-radius);
              background: var(--lr-color-surface-raised);
              box-shadow: var(--lr-shadow-s);
              color: var(--lr-color-text);
              font-family: var(--lr-font);
              font-size: var(--lr-font-size-m);
            }
            p {
              margin-block: 0 var(--lr-space-s);
              color: var(--lr-color-text-quiet);
              font-size: var(--lr-font-size-sm);
            }
            .tag {
              display: inline-block;
              padding: var(--lr-space-2xs) var(--lr-space-s);
              border-radius: var(--lr-radius-pill);
              background: var(--lr-color-success-fill-quiet);
              color: var(--lr-color-success-on-quiet);
              font-size: var(--lr-font-size-xs);
              font-weight: var(--lr-font-weight-semibold);
            }
            button {
              margin-block-start: var(--lr-space-m);
              padding: var(--lr-space-xs) var(--lr-space-m);
              border: var(--lr-border-width-thin) solid var(--lr-color-brand-border-loud);
              border-radius: var(--lr-radius);
              background: var(--lr-color-brand);
              color: var(--lr-color-on-brand);
              font: inherit;
              cursor: pointer;
              transition: opacity var(--lr-transition-fast);
            }
            button:hover {
              opacity: var(--lr-opacity-muted);
            }
            button:focus-visible {
              outline: var(--lr-focus-ring);
              outline-offset: var(--lr-focus-ring-offset);
            }
          </style>
          <slot name="heading"></slot>
          <p>Not an lr-* element. Every value above is a curated --lr-* token read at :root.</p>
          <span class="tag">In sync</span>
          <button type="button">Application control</button>
        `;
      }
    },
  );
}

const meta: Meta = {
  title: "Styles/Native and utilities",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Three optional, independently importable light-DOM stylesheets. `native.css` normalizes only native descendants of an explicit `.lr-native` scope, `utilities.css` provides exact, low-specificity `lr-*` layout and text classes, and `tokens-root.css` declares the curated resolved `--lr-*` tokens at `:root` so an application's own elements can read them. All three use Lyra tokens and the shared cascade-layer order.",
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const LayoutAndProse: Story = {
  name: "Layout, prose, and native controls",
  render: () => html`
    <link rel="stylesheet" href=${nativeStyles} />
    <link rel="stylesheet" href=${utilities} />
    <style>
      .styles-demo {
        box-sizing: border-box;
        padding: var(--lr-space-2xl);
        border: var(--lr-border-width-thin) solid var(--lr-color-border);
        border-radius: var(--lr-radius);
        background: var(--lr-color-surface);
        color: var(--lr-color-text);
        font-family: var(--lr-font);
      }

      .styles-demo__panel {
        min-inline-size: 0;
        padding: var(--lr-space-l);
        border: var(--lr-border-width-thin) solid var(--lr-color-border);
        border-radius: var(--lr-radius);
        background: var(--lr-color-surface-raised);
      }

      .styles-demo__field {
        inline-size: 100%;
      }
    </style>

    <main
      class="lr-native lr-stack lr-center styles-demo"
      style="--lr-layout-gap: var(--lr-space-2xl); --lr-grid-min-inline-size: var(--lr-size-14rem)"
      aria-labelledby="styles-demo-heading"
    >
      <header class="lr-stack lr-gap-s">
        <p class="lr-text-sm lr-text-quiet">Optional light-DOM styles</p>
        <h1 id="styles-demo-heading" class="lr-text-balance">
          Native elements and utilities, one token system
        </h1>
        <p class="lr-max-inline-prose">
          Import either stylesheet independently. Native normalization stays
          inside this explicit scope, while exact utility classes compose into
          allocation-friendly layouts.
        </p>
      </header>

      <section class="lr-grid-auto" aria-label="Style examples">
        <article class="lr-prose styles-demo__panel">
          <h2>Readable prose</h2>
          <p>
            Long content wraps without escaping its allocation, including
            InternationalQuarterlyAnalyticalEngineResearch.
          </p>
          <blockquote>
            Logical borders and spacing follow the document direction
            automatically.
          </blockquote>
          <p><a href="#native-form">Continue to the form example</a></p>
        </article>

        <form id="native-form" class="lr-stack lr-gap-m styles-demo__panel">
          <h2>Scoped native controls</h2>
          <div class="lr-stack lr-gap-xs">
            <label for="style-demo-name">Display name</label>
            <input
              class="lr-inline-full styles-demo__field"
              id="style-demo-name"
              value="Ada Lovelace"
            />
          </div>
          <div class="lr-stack lr-gap-xs">
            <label for="style-demo-role">Workspace role</label>
            <select
              class="lr-inline-full styles-demo__field"
              id="style-demo-role"
            >
              <option>Editor</option>
              <option>Reviewer</option>
            </select>
          </div>
          <div class="lr-cluster lr-gap-s">
            <button type="submit">Save profile</button>
            <button type="button" disabled>Publishing</button>
          </div>
          <span class="lr-visually-hidden" aria-live="polite"
            >No unsaved changes</span
          >
        </form>
      </section>
    </main>
  `,
};

export const ResolvedTokensAtRoot: Story = {
  name: "Resolved tokens for your own components",
  parameters: {
    docs: {
      description: {
        story:
          "`tokens-root.css` is opt-in and declares a curated subset of the resolved `--lr-*` layer at `:root`, so an application's own custom elements can read the same surfaces, spacing, radii, elevation, typography and focus ring the kit uses. The panel on the left is a plain custom element with its own shadow root — not an `lr-*` element — and it stays in step with the `lr-card` beside it, including inside the pinned dark scope below.",
      },
    },
  },
  render: () => html`
    <link rel="stylesheet" href=${tokensRoot} />
    <style>
      .tokens-demo {
        display: grid;
        gap: var(--lr-space-l);
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
        padding: var(--lr-space-l);
        border-radius: var(--lr-radius);
        background: var(--lr-color-surface);
        color: var(--lr-color-text);
        font-family: var(--lr-font);
      }

      .tokens-demo__section {
        display: grid;
        gap: var(--lr-space-s);
      }
    </style>

    <div class="tokens-demo">
      <div class="tokens-demo__section">
        <app-token-panel>
          <h3 slot="heading">Application panel</h3>
        </app-token-panel>
      </div>
      <div class="tokens-demo__section">
        <lr-card>
          <h3 slot="header">Library card</h3>
          <p>An lr-* component, resolving the identical tokens on its own host.</p>
          <lr-button slot="footer" variant="brand">Library control</lr-button>
        </lr-card>
      </div>
    </div>

    <div class="tokens-demo lr-dark" data-lr-theme="dark">
      <div class="tokens-demo__section">
        <app-token-panel>
          <h3 slot="heading">Application panel, dark scope</h3>
        </app-token-panel>
      </div>
      <div class="tokens-demo__section">
        <lr-card data-lr-theme="dark">
          <h3 slot="header">Library card, dark scope</h3>
          <p>Both sides follow the same scope switch.</p>
          <lr-button slot="footer" variant="brand" data-lr-theme="dark"
            >Library control</lr-button
          >
        </lr-card>
      </div>
    </div>
  `,
};
