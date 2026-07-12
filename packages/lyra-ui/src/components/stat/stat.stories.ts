import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Stat',
  component: 'lyra-stat',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Gallery: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem; flex-wrap:wrap;">
      <lyra-stat label="Revenue" value="12.4" unit="k€" trend="3.2" variant="success"></lyra-stat>
      <lyra-stat label="Errors" value="128" trend="-5.1" variant="danger"></lyra-stat>
      <lyra-stat label="Sessions" value="9,204"></lyra-stat>
    </div>
  `,
};
