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

export const DetailedVariant: Story = {
  render: () => html`
    <div style="display:flex; gap:2rem; align-items:center;">
      <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
        <lyra-flag country="es" label="Spain (default, icon-optimized)" style="height: 6rem"></lyra-flag>
        <span>default</span>
      </div>
      <div style="display:flex; flex-direction:column; align-items:center; gap:0.5rem;">
        <lyra-flag country="es" detailed label="Spain (detailed)" style="height: 6rem"></lyra-flag>
        <span>detailed</span>
      </div>
    </div>
  `,
};
