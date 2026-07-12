import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { toast, type ToastSize, type ToastPlacement } from '../../lyra.js';

const meta: Meta = {
  title: 'Toast',
  component: 'lyra-toast',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Click a button to fire a toast via the `toast()` helper — the ergonomic entry point that lazily mounts one `<lyra-toast>` region per placement on `document.body`.',
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

const sizes: ToastSize[] = ['xs', 's', 'm', 'l', 'xl'];

export const Sizes: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem;">
      ${sizes.map(
        (size) =>
          html`<button @click=${() => toast({ message: `Size "${size}"`, size })}>${size}</button>`,
      )}
    </div>
  `,
};

export const WithIcon: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem;">
      <button
        @click=${() =>
          toast({ message: 'Upload complete', variant: 'success', withIcon: true }).item.then((item) => {
            const icon = document.createElement('span');
            icon.slot = 'icon';
            icon.textContent = '✓';
            item.appendChild(icon);
          })}
      >
        Success + icon
      </button>
    </div>
  `,
};

const placements: ToastPlacement[] = [
  'top-start',
  'top-center',
  'top-end',
  'bottom-start',
  'bottom-center',
  'bottom-end',
];

export const Placements: Story = {
  render: () => html`
    <div style="display:flex; flex-wrap:wrap; gap:1rem;">
      ${placements.map(
        (placement) =>
          html`<button @click=${() => toast({ message: placement, placement })}>${placement}</button>`,
      )}
    </div>
  `,
};
