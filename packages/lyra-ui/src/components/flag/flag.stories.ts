import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Flag',
  component: 'lyra-flag',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Gallery: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem; align-items:center;">
      <lyra-flag country="fr" label="France" style="height: 1.5rem"></lyra-flag>
      <lyra-flag language="en" label="English" style="height: 1.5rem"></lyra-flag>
      <lyra-flag language="de" label="German" round style="height: 1.5rem"></lyra-flag>
      <lyra-flag country="jp" label="Japan" round style="height: 1.5rem"></lyra-flag>
    </div>
  `,
};

export const FidelityTiers: Story = {
  name: 'Fidelity tiers (compact / standard / detailed)',
  render: () => html`
    <div style="display:flex; gap:2rem; align-items:flex-end;">
      <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
        <lyra-flag country="es" variant="compact" label="Spain (compact)" style="height: 6rem"></lyra-flag>
        <span><code>variant="compact"</code><br />~2 KB WebP · for icons</span>
      </div>
      <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
        <lyra-flag country="es" label="Spain (standard)" style="height: 6rem"></lyra-flag>
        <span>default (standard)<br />~48 KB vector · for cards</span>
      </div>
      <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
        <lyra-flag country="es" variant="detailed" label="Spain (detailed)" style="height: 6rem"></lyra-flag>
        <span><code>variant="detailed"</code><br />full vector · for hero display</span>
      </div>
    </div>
  `,
};

export const LanguageSelector: Story = {
  name: 'Compact flags as menu icons',
  render: () => html`
    <ul style="list-style:none; margin:0; padding:0.5rem 0; width:14rem; border:1px solid #ccc; border-radius:0.5rem; font-family:system-ui;">
      ${[
        ['es', 'Español'],
        ['fr', 'Français'],
        ['pt', 'Português'],
        ['hr', 'Hrvatski'],
        ['rs', 'Српски'],
      ].map(
        ([code, label]) => html`
          <li style="display:flex; align-items:center; gap:0.6rem; padding:0.4rem 0.9rem; cursor:pointer;">
            <lyra-flag country=${code} variant="compact" label=${label} style="height: 1.1rem"></lyra-flag>
            <span>${label}</span>
          </li>
        `,
      )}
    </ul>
  `,
};
