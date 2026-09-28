import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import '../packages/lyra-ui/src/theme.css';
import '../packages/lyra-ui/src/preferences.css';
import '../packages/lyra-ui/src/looks/material.css';
import '../packages/lyra-ui/src/looks/shadcn.css';
import { applyLyraStyleScope } from '../packages/lyra-ui/src/theme/theme.js';
import '../packages/lyra-ui/src/components/layout/card/card.js';
import '../packages/lyra-ui/src/components/forms/input/input.js';
import '../packages/lyra-ui/src/components/forms/button/button.js';
import '../packages/lyra-ui/src/components/overlays/spinner/spinner.js';

export default {
  title: 'Theming/Accessibility preferences',
  tags: ['!autodocs'],
  parameters: { docs: { description: { component: 'Scoped contrast and motion choices inherit independently of mode, look, surface, density and accent. System scopes resume the OS preference; an OS reduction remains active.' } } },
};

export const AcrossLooks = {
  args: { contrast: 'more', motion: 'reduce' },
  argTypes: {
    contrast: { control: 'select', options: ['system', 'more'] },
    motion: { control: 'select', options: ['system', 'reduce'] },
  },
  render: ({ contrast, motion }) => html`
    <div data-lr-contrast=${contrast} data-lr-motion=${motion}
      style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,22rem),1fr));gap:1rem">
      ${['lyra', 'material', 'shadcn'].flatMap(look => ['light', 'dark'].map(mode => html`
        <section ${ref(element => {
          if (element) queueMicrotask(() => applyLyraStyleScope(element, { look, mode }));
        })} style="padding:1rem;display:grid;gap:1rem;min-inline-size:0;background:var(--lr-theme-color-surface-default);color:var(--lr-theme-color-text-normal)">
          <h2 style="margin:0">${look} · ${mode}</h2>
          <lr-card>
            <span slot="header">Inherited preferences</span>
            <lr-input label="Workspace name" hint="Quiet text follows the contrast choice."></lr-input>
            <div slot="footer" style="display:flex;align-items:center;gap:1rem">
              <lr-button>Save</lr-button><lr-spinner label-placement="after">Loading</lr-spinner>
            </div>
          </lr-card>
          <div data-lr-contrast="system" data-lr-motion="system">
            <lr-card>
              <span slot="header">Local system scope</span>
              <lr-input label="Workspace name" hint="This branch follows the operating system."></lr-input>
              <div slot="footer" style="display:flex;align-items:center;gap:1rem">
                <lr-button>Save</lr-button><lr-spinner label-placement="after">Loading</lr-spinner>
              </div>
            </lr-card>
          </div>
        </section>
      `))}
    </div>`,
};
