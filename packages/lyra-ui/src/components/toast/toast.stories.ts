import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { toast } from '../../lyra.js';

const meta: Meta = {
  title: 'Toast',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Click a button to fire a toast via the `toast()` helper — the ergonomic entry point that lazily mounts a single `<lyra-toast>` region on `document.body`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Triggers: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem;">
      <button @click=${() => toast('Just so you know')}>Neutral</button>
      <button @click=${() => toast({ message: 'Saved!', variant: 'success' })}>Success</button>
      <button
        @click=${() =>
          toast({
            message: 'Item deleted',
            variant: 'danger',
            duration: 0,
            action: { label: 'Undo', onClick: (item) => item.hide() },
          })}
      >
        Danger + action
      </button>
    </div>
  `,
};
