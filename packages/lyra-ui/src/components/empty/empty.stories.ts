import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Empty',
  component: 'lyra-empty',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-empty heading="No results" description="Try a different search.">
      <span slot="actions"><button>Reset</button></span>
    </lyra-empty>
  `,
};
