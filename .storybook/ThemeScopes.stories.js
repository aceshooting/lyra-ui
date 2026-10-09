import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import '../packages/lyra-ui/src/theme.css';
import { adoptLyraTokens } from '../packages/lyra-ui/src/utilities/tokens.js';
import '../packages/lyra-ui/src/components/layout/card/card.js';
import '../packages/lyra-ui/src/components/forms/button/button.js';
import '../packages/lyra-ui/src/components/overlays/badge/badge.js';

export default {
  title: 'Theming/Theme scopes',
  tags: ['!autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'The shared --lr-* layer is declared once per document and re-derived only at theme scopes: mode scopes, style-axis boundaries and elements marked data-lr-theme-scope. A --lr-theme-* input on a plain wrapper no longer re-derives the components below it.',
      },
    },
  },
};

const sample = (label) => html`
  <lr-card>
    <span slot="header">${label}</span>
    <div style="display:flex;gap:var(--lr-space-s);align-items:center;flex-wrap:wrap">
      <lr-button variant="brand">Save</lr-button>
      <lr-badge variant="success">New</lr-badge>
    </div>
  </lr-card>`;

const grid = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr));gap:1rem';

/** Nested scopes: a dark region, a mode-neutral scope inside it, and a light island. */
export const NestedScopes = {
  render: () => html`
    <div style=${grid}>
      <section class="lr-dark" style="padding:1rem;display:grid;gap:1rem;background:var(--lr-color-surface)">
        ${sample('Dark region')}
        <div data-lr-theme-scope style="--lr-theme-space-m:1.25rem;display:grid;gap:1rem">
          ${sample('Mode-neutral scope inside it: still dark, roomier spacing')}
          <section class="lr-light" style="padding:1rem;background:var(--lr-color-surface)">
            ${sample('Light island, three scopes deep')}
          </section>
        </div>
      </section>
    </div>`,
};

/** The breaking change and its one-attribute fix, side by side. */
export const ScopedOverride = {
  render: () => html`
    <div style=${grid}>
      <div style="--lr-theme-color-brand-fill-loud:#7c3aed">
        ${sample('Input on a plain wrapper: no effect on components')}
      </div>
      <div data-lr-theme-scope style="--lr-theme-color-brand-fill-loud:#7c3aed">
        ${sample('Same input on a marked scope: re-derived')}
      </div>
    </div>`,
};

/** An application component's shadow root: the layer is adopted there on demand. */
export const ApplicationShadowRoot = {
  render: () => html`
    <div ${ref((host) => {
      if (!host || host.shadowRoot) return;
      const root = host.attachShadow({ mode: 'open' });
      // A scope exists before any Lyra element connects in this root, so adopt explicitly.
      adoptLyraTokens(root);
      root.innerHTML = `
        <style>:host{display:block}</style>
        <section class="lr-dark" style="padding:1rem;background:var(--lr-color-surface);color:var(--lr-color-text)">
          <p style="margin-top:0">Application element in a shadow root, reading --lr-color-text.</p>
          <lr-button variant="brand">Inside the application root</lr-button>
        </section>`;
    })}></div>`,
};
