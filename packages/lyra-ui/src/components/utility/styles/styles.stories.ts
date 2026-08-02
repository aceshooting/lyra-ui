import type { Meta, StoryObj } from "@storybook/web-components-vite";
import { html } from "lit";

const nativeStyles = new URL("../../../styles/native.css", import.meta.url)
  .href;
const utilities = new URL("../../../styles/utilities.css", import.meta.url)
  .href;

const meta: Meta = {
  title: "Styles/Native and utilities",
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Two optional, independently importable light-DOM stylesheets. `native.css` normalizes only native descendants of an explicit `.lr-native` scope, while `utilities.css` provides exact, low-specificity `lr-*` layout and text classes. Both use Lyra tokens and the shared cascade-layer order.",
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
