import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './attachment-trigger.js';
import type { AttachmentPickDetail } from './attachment-trigger.js';
import '../chat-composer/chat-composer.js';
import '../attachment-chip/attachment-chip.js';

const meta: Meta = {
  title: 'AttachmentTrigger',
  component: 'lyra-attachment-trigger',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A compact attach affordance for a chat composer\'s leading slot. Renders a single plain icon button when only one `capabilities` entry is configured, or a small anchored menu when more than one. `files`/`image` open a hidden native file input and re-emit the selection as `lyra-pick`; `camera` only fires `lyra-camera-request` — this component never implements capture UI itself, that\'s entirely a host concern.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function logPick(logId: string) {
  return (e: CustomEvent<AttachmentPickDetail>) => {
    const out = document.getElementById(logId);
    if (!out) return;
    const names = Array.from(e.detail.files)
      .map((f) => f.name)
      .join(', ');
    out.textContent = `lyra-pick: capability="${e.detail.capability}", files=[${names}]`;
  };
}

function logCameraRequest(logId: string) {
  return () => {
    const out = document.getElementById(logId);
    if (out) out.textContent = 'lyra-camera-request fired — the host now owns capture UI.';
  };
}

/** The default single-capability shape: `capabilities` defaults to
 *  `['files']`, so this renders a plain button with no menu at all. */
export const SingleCapability: Story = {
  render: () => html`
    <div>
      <lyra-attachment-trigger @lyra-pick=${logPick('single-log')}></lyra-attachment-trigger>
      <p id="single-log" style="margin-top:0.5rem; font: 0.8125rem monospace;">
        lyra-pick: (none yet)
      </p>
    </div>
  `,
};

/** A single `image` capability swaps the icon and defaults the hidden
 *  input's `accept` to `'image/*'` — no explicit `accept` prop needed. */
export const SingleImageCapability: Story = {
  render: () => html`
    <lyra-attachment-trigger
      .capabilities=${['image']}
      @lyra-pick=${logPick('image-log')}
    ></lyra-attachment-trigger>
    <p id="image-log" style="margin-top:0.5rem; font: 0.8125rem monospace;">lyra-pick: (none yet)</p>
  `,
};

/** More than one capability renders `<lyra-menu>`/`<lyra-menu-item>` instead
 *  of a plain button — click the paperclip to see the menu. */
export const MultiCapabilityMenu: Story = {
  render: () => html`
    <div>
      <lyra-attachment-trigger
        .capabilities=${['files', 'image', 'camera']}
        @lyra-pick=${logPick('multi-log')}
        @lyra-camera-request=${logCameraRequest('multi-log')}
      ></lyra-attachment-trigger>
      <p id="multi-log" style="margin-top:0.5rem; font: 0.8125rem monospace;">(no event yet)</p>
    </div>
  `,
};

/** `camera` never implements capture UI itself — activating it only fires
 *  `lyra-camera-request`, which the host handles however it wants
 *  (`getUserMedia`, a mobile `<input capture>`, a native bridge, etc.). */
export const CameraOnly: Story = {
  render: () => html`
    <div>
      <lyra-attachment-trigger
        .capabilities=${['camera']}
        @lyra-camera-request=${logCameraRequest('camera-log')}
      ></lyra-attachment-trigger>
      <p id="camera-log" style="margin-top:0.5rem; font: 0.8125rem monospace;">(no event yet)</p>
    </div>
  `,
};

export const Disabled: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem; align-items:center;">
      <lyra-attachment-trigger disabled></lyra-attachment-trigger>
      <lyra-attachment-trigger disabled .capabilities=${['files', 'image', 'camera']}></lyra-attachment-trigger>
    </div>
  `,
};

/** The intended real-world placement: dropped into `<lyra-chat-composer>`'s
 *  `leading` slot, feeding picked files straight into an attachment tray of
 *  `<lyra-attachment-chip>` rows in the composer's `chips` slot. */
export const InChatComposer: Story = {
  render: () => {
    const onPick = (e: CustomEvent<AttachmentPickDetail>) => {
      const composer = document.getElementById('composer-demo');
      if (!composer) return;
      for (const file of Array.from(e.detail.files)) {
        const chip = document.createElement('lyra-attachment-chip');
        chip.setAttribute('slot', 'chips');
        chip.file = file;
        chip.addEventListener('lyra-remove', () => chip.remove());
        composer.appendChild(chip);
      }
    };
    return html`
      <lyra-chat-composer
        id="composer-demo"
        placeholder="Message the assistant…"
        style="max-width: 32rem; display: block;"
      >
        <lyra-attachment-trigger
          slot="leading"
          .capabilities=${['files', 'image', 'camera']}
          @lyra-pick=${onPick}
          @lyra-camera-request=${logCameraRequest('composer-log')}
        ></lyra-attachment-trigger>
      </lyra-chat-composer>
      <p id="composer-log" style="margin-top:0.5rem; font: 0.8125rem monospace;"></p>
    `;
  },
};
