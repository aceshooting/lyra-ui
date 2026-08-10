import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { toast, type ToastSize, type ToastPlacement } from '../../../lyra.js';

const meta: Meta = {
  title: 'Toast',
  component: 'lr-toast',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Click a button to fire a toast via the `toast()` helper — the ergonomic entry point that lazily mounts one `<lr-toast>` region per placement on `document.body`.',
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
  play: async () => {
    await toast({
      message: 'Item deleted',
      variant: 'danger',
      duration: 0,
      action: { label: 'Undo', onClick: (item) => item.hide() },
    }).item;
  },
};

const sizes: ToastSize[] = ['2xs', 'xs', 's', 'm', 'l', 'xl'];

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

export const AliasSizes: Story = {
  parameters: {
    docs: {
      description: {
        story:
          '`toast()` and `LyraToast.create()` accept `small`, `medium`, and `large`; the created item normalizes them to canonical `s`, `m`, and `l` reads.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:var(--lr-space-s);">
      ${(['small', 'medium', 'large'] as const).map(
        (size) => html`<button @click=${() => toast({ message: `Size alias "${size}"`, size, duration: 0 })}>${size}</button>`,
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

export const WithIconAndAction: Story = {
  render: () => html`
    <button
      @click=${async () => {
        const { item } = toast({
          message: 'File deleted',
          variant: 'danger',
          duration: 0,
          withIcon: true,
          action: { label: 'Undo', onClick: (toastItem) => toastItem.hide() },
        });
        const toastItem = await item;
        const icon = document.createElement('span');
        icon.slot = 'icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = '!';
        toastItem.append(icon);
      }}
    >
      Danger + icon + action
    </button>
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

export const MappedStylingHooks: Story = {
  render: () => html`
    <style>
      .mapped-toast {
        --gap: var(--lr-space-l);
        --width: var(--lr-size-20rem);
      }
      .mapped-toast:state(visible)::part(stack) {
        outline: var(--lr-border-width-thin) solid var(--lr-color-brand);
        outline-offset: var(--lr-focus-ring-offset);
      }
    </style>
    <lr-toast class="mapped-toast" placement="top-center">
      <lr-toast-item duration="0">The region now matches :state(visible).</lr-toast-item>
      <lr-toast-item duration="0" variant="success">The mapped gap and width aliases style this stack.</lr-toast-item>
    </lr-toast>
  `,
};
