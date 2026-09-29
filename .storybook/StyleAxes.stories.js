import { html } from 'lit';
import '../packages/lyra-ui/src/theme.css';
import '../packages/lyra-ui/src/looks/shadcn.css';
import '../packages/lyra-ui/src/looks/material.css';
import '../packages/lyra-ui/src/looks/data.css';
import '../packages/lyra-ui/src/looks/terminal.css';
import '../packages/lyra-ui/src/looks/high-contrast.css';
import '../packages/lyra-ui/src/density.css';
import '../packages/lyra-ui/src/accents.css';
import '../packages/lyra-ui/src/surfaces/glass.css';
import { applyLyraStyleScope } from '../packages/lyra-ui/src/theme/theme.js';
import '../packages/lyra-ui/src/components/forms/button/button.js';
import '../packages/lyra-ui/src/components/forms/input/input.js';
import '../packages/lyra-ui/src/components/layout/card/card.js';
import '../packages/lyra-ui/src/components/layout/menu/menu.js';
import '../packages/lyra-ui/src/components/layout/menu/menu-item.js';

export default {
  title: 'Theming/Composable styles',
  tags: ['!autodocs'],
  globals: { look: 'lyra' },
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'One look combines with an independent surface, density, mode and accent. The optional stylesheets are imported explicitly; selecting an id does not load its stylesheet.' } },
  },
};

const panelStyle = 'padding:var(--lr-theme-space-l,1rem);display:grid;gap:var(--lr-theme-space-m,1rem);align-content:start;background:var(--lr-theme-color-surface-default);color:var(--lr-theme-color-text-normal);font-family:var(--lr-theme-font-family-body);min-inline-size:0';
const rowStyle = 'display:flex;flex-wrap:wrap;gap:var(--lr-theme-space-s,0.5rem);align-items:center';
const axisOptions = {
  look: ['lyra', 'shadcn', 'material', 'data', 'terminal', 'high-contrast'],
  surface: ['solid', 'glass'],
  density: ['compact', 'comfortable', 'touch'],
  mode: ['light', 'dark', 'system'],
  accent: ['none', 'emerald', 'ruby', 'amethyst', 'sapphire'],
};
const defaults = { look: 'shadcn', surface: 'glass', density: 'comfortable', mode: 'light', accent: 'none' };

function applyControls(event) {
  const scope = event.currentTarget.closest('[data-style-demo]');
  const choices = Object.fromEntries(Object.keys(axisOptions).map(name => [name, scope.querySelector(`[name="${name}"]`).value]));
  applyLyraStyleScope(scope, { ...choices, accent: choices.accent === 'none' ? null : choices.accent });
}

function controls() {
  return html`<form @change=${applyControls} style=${rowStyle} aria-label="Preview style choices">
    ${Object.entries(axisOptions).map(([axis, options]) => html`<label style="display:grid;gap:0.25rem">
      <span>${axis.charAt(0).toUpperCase() + axis.slice(1)}</span>
      <select name=${axis} style="font:inherit;min-block-size:2rem;color:inherit;background:var(--lr-theme-color-surface-raised)">
        ${options.map(option => html`<option value=${option} ?selected=${option === defaults[axis]}>${option}</option>`)}
      </select>
    </label>`)}
  </form>`;
}

function sample() {
  return html`
    <div style=${rowStyle}>
      <lr-button variant="brand">Save changes</lr-button>
      <lr-button appearance="outlined">Cancel</lr-button>
      <lr-button appearance="plain" variant="brand">Preview</lr-button>
      <lr-button appearance="link" variant="brand">View details</lr-button>
    </div>
    <lr-input label="Project name" value="Research workspace" hint="Shared with your team"></lr-input>
    <lr-card>
      <strong>Content stays solid</strong>
      <p style="color:var(--lr-theme-color-text-quiet)">Glass affects supported navigation and floating controls; it does not make content cards translucent.</p>
    </lr-card>
    <div style="padding:var(--lr-theme-space-l,1rem);background:linear-gradient(120deg,var(--lr-theme-color-brand-fill-loud),var(--lr-theme-color-surface-default),var(--lr-theme-color-brand-fill-quiet))">
      <lr-menu label="Project actions">
        <lr-menu-item>Open project</lr-menu-item>
        <lr-menu-item>Share with team</lr-menu-item>
        <lr-menu-item disabled>Archive project</lr-menu-item>
      </lr-menu>
    </div>
    <section data-lr-density="compact" data-lr-surface="solid" style="display:grid;gap:var(--lr-theme-space-s,0.5rem)">
      <strong>Compact, solid island</strong>
      <lr-input label="Filter projects" placeholder="Type to filter"></lr-input>
    </section>
  `;
}

export const Playground = {
  render: () => html`<section data-style-demo data-lr-look="shadcn" data-lr-surface="glass" data-lr-density="comfortable" data-lr-mode="light" data-lr-accent="none" style=${panelStyle}>
    <h1 style="margin:0">Compose a style</h1>
    <a href="?path=/story/theming-theme-builder--editor">Open the full theme builder</a>
    <p>Change one choice at a time. The controls and content keep the same markup.</p>
    ${controls()}
    ${sample()}
  </section>`,
};

export const LookGallery = {
  render: () => html`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,20rem),1fr));gap:1rem;padding:1rem">
    ${axisOptions.look.flatMap(look => ['light', 'dark'].map(mode => html`<section data-lr-look=${look} data-lr-mode=${mode} data-lr-surface="solid" data-lr-density="comfortable" data-lr-accent="none" style=${panelStyle}>
      <h2 style="margin:0">${look} / ${mode}</h2>
      ${sample()}
    </section>`))}
  </div>`,
};
