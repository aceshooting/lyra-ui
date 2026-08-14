import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { toast, type ToastSize, type ToastPlacement } from '../../../lyra.js';
import type { LyraToast, ToastOverflowDetail } from './toast.class.js';

const meta: Meta = {
  title: 'Toast',
  component: 'lr-toast',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Click a button to fire a toast via the `toast()` helper — the ergonomic entry point that lazily mounts one `<lr-toast>` region per owner document and placement. The shared `LyraToastOptions` supports safe icon payloads/factories, actions, and explicit owner-document routing. All six logical placements stay inside the usable safe-area rectangle.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-toast placement="top-center">
      <lr-toast-item duration="0" variant="success">Saved successfully.</lr-toast-item>
    </lr-toast>
  `,
};

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
          '`toast()` and `LyraToast.create()` accept `small`, `medium`, and `large`; the created item preserves those public spellings while privately mapping them to the same rendered sizes as `s`, `m`, and `l`.',
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
        @click=${() => toast({ message: 'Upload complete', variant: 'success', icon: '✓' })}
      >
        Success + icon
      </button>
    </div>
  `,
};

export const WithIconAndAction: Story = {
  render: () => html`
    <button
      @click=${() => {
        toast({
          message: 'File deleted',
          variant: 'danger',
          duration: 0,
          icon: (ownerDocument) => ownerDocument.createTextNode('!'),
          action: { label: 'Undo', onClick: (toastItem) => toastItem.hide() },
        });
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
  parameters: {
    docs: {
      description: {
        story:
          'Start/end follow the document direction. Center placements use the midpoint of the usable safe-area rectangle rather than the physical viewport midpoint.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; flex-wrap:wrap; gap:1rem;">
      ${placements.map(
        (placement) =>
          html`<button @click=${() => toast({ message: placement, placement })}>${placement}</button>`,
      )}
    </div>
  `,
};

export const BoundedBurst: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'A region shows three notifications, queues twenty in FIFO order, then coalesces any additional loss into one `lr-toast-overflow` event and one localized polite announcement.',
      },
    },
  },
  render: () => html`
    <div data-bounded-toast-story style="display:grid; gap:var(--lr-space-s);">
      <button
        @click=${(event: Event) => {
          const wrapper = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-bounded-toast-story]')!;
          const region = wrapper.querySelector('lr-toast') as LyraToast;
          for (let index = 1; index <= 26; index += 1) {
            void region.create(`إشعار طويل ${index}: اكتمل تحميل الملف بنجاح`, {
              duration: 0,
              variant: index % 5 === 0 ? 'success' : 'neutral',
            });
          }
        }}
      >
        Send 26 notifications
      </button>
      <output>Overflow event count: 0</output>
      <lr-toast
        dir="rtl"
        locale="ar"
        placement="top-end"
        .strings=${{ toastOverflow: 'الإشعارات التي لم تُعرض: {count}.' }}
        @lr-toast-overflow=${(event: CustomEvent<ToastOverflowDetail>) => {
          const wrapper = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-bounded-toast-story]')!;
          wrapper.querySelector('output')!.textContent = `Overflow event count: ${event.detail.count}`;
        }}
      ></lr-toast>
    </div>
  `,
};

function deeplyNestedMessage(): unknown {
  let content: unknown = 'Visible text beyond the accessibility traversal boundary';
  for (let depth = 0; depth < 260; depth += 1) content = html`<span>${content}</span>`;
  return content;
}

export const IncompleteAccessibleMessageFallback: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'When bounded accessible-text extraction cannot retain even a prefix, the announcement and contextual close name use the localized `toastContentIncomplete` fallback instead of becoming silent or implying that the content is complete.',
      },
    },
  },
  render: () => html`
    <lr-toast placement="top-center">
      <lr-toast-item
        duration="0"
        .strings=${{ toastContentIncomplete: 'Notification with incomplete content' }}
      >${deeplyNestedMessage()}</lr-toast-item>
    </lr-toast>
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
