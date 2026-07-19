import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'Empty',
  component: 'lr-empty',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-empty heading="No results" description="Try a different search.">
      <span slot="actions"><button>Reset</button></span>
    </lr-empty>
  `,
};

export const WithIcon: Story = {
  render: () => html`
    <lr-empty heading="No results" description="Try a different search.">
      <svg slot="" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="11" cy="11" r="7" stroke-width="2"></circle>
        <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"></path>
      </svg>
      <span slot="actions"><button>Reset</button></span>
    </lr-empty>
  `,
};

export const Compact: Story = {
  render: () => html`
    <div style="max-width: 16rem; border: 1px solid var(--lr-color-border);">
      <lr-empty compact heading="No results" description="Try a different search.">
        <span slot="actions"><button>Reset</button></span>
      </lr-empty>
    </div>
  `,
};

export const CompactCentered: Story = {
  name: 'Compact with centered content',
  parameters: {
    docs: {
      description: {
        story:
          'Compact mode stays dense while `--lr-empty-compact-align: center` centers its heading, description, and actions.',
      },
    },
  },
  render: () => html`
    <div style="max-width: 16rem; border: 1px solid var(--lr-color-border);">
      <lr-empty
        compact
        heading="No results"
        description="Try a different search."
        style="--lr-empty-compact-align: center;"
      >
        <span slot="actions"><button>Reset</button></span>
      </lr-empty>
    </div>
  `,
};
