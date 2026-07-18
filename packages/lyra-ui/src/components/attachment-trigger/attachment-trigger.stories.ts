import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './attachment-trigger.js';
import type { AttachmentPickDetail } from './attachment-trigger.js';
import '../chat-composer/chat-composer.js';
import '../attachment-chip/attachment-chip.js';

const meta: Meta = {
  title: 'AttachmentTrigger',
  component: 'lr-attachment-trigger',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A compact attach affordance for a chat composer\'s leading slot. Renders a single plain icon button when only one `capabilities` entry is configured, or a small anchored menu when more than one. `files`/`image` open a hidden native file input and re-emit the selection as `lr-pick`; `camera` only fires `lr-camera-request` — this component never implements capture UI itself, that\'s entirely a host concern.',
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
    out.textContent = `lr-pick: capability="${e.detail.capability}", files=[${names}]`;
  };
}

function logCameraRequest(logId: string) {
  return () => {
    const out = document.getElementById(logId);
    if (out) out.textContent = 'lr-camera-request fired — the host now owns capture UI.';
  };
}

/** The default single-capability shape: `capabilities` defaults to
 *  `['files']`, so this renders a plain button with no menu at all. */
export const SingleCapability: Story = {
  render: () => html`
    <div>
      <lr-attachment-trigger @lr-pick=${logPick('single-log')}></lr-attachment-trigger>
      <p id="single-log" style="margin-top:0.5rem; font: 0.8125rem monospace;">
        lr-pick: (none yet)
      </p>
    </div>
  `,
};

/** A single `image` capability swaps the icon and defaults the hidden
 *  input's `accept` to `'image/*'` — no explicit `accept` prop needed. */
export const SingleImageCapability: Story = {
  render: () => html`
    <lr-attachment-trigger
      .capabilities=${['image']}
      @lr-pick=${logPick('image-log')}
    ></lr-attachment-trigger>
    <p id="image-log" style="margin-top:0.5rem; font: 0.8125rem monospace;">lr-pick: (none yet)</p>
  `,
};

/** More than one capability renders `<lr-menu>`/`<lr-menu-item>` instead
 *  of a plain button — click the paperclip to see the menu. */
export const MultiCapabilityMenu: Story = {
  render: () => html`
    <div>
      <lr-attachment-trigger
        .capabilities=${['files', 'image', 'camera']}
        @lr-pick=${logPick('multi-log')}
        @lr-camera-request=${logCameraRequest('multi-log')}
      ></lr-attachment-trigger>
      <p id="multi-log" style="margin-top:0.5rem; font: 0.8125rem monospace;">(no event yet)</p>
    </div>
  `,
};

/** `camera` never implements capture UI itself — activating it only fires
 *  `lr-camera-request`, which the host handles however it wants
 *  (`getUserMedia`, a mobile `<input capture>`, a native bridge, etc.). */
export const CameraOnly: Story = {
  render: () => html`
    <div>
      <lr-attachment-trigger
        .capabilities=${['camera']}
        @lr-camera-request=${logCameraRequest('camera-log')}
      ></lr-attachment-trigger>
      <p id="camera-log" style="margin-top:0.5rem; font: 0.8125rem monospace;">(no event yet)</p>
    </div>
  `,
};

/** `audio` follows the exact same request-only pattern as `camera` —
 *  activating it only fires `lr-audio-request`, which the host handles
 *  however it wants (typically opening `<lr-push-to-talk>` in a popover). */
export const AudioCapability: Story = {
  render: () => html`<lr-attachment-trigger .capabilities=${['audio']}></lr-attachment-trigger>`,
};

export const AllCapabilities: Story = {
  render: () =>
    html`<lr-attachment-trigger .capabilities=${['files', 'image', 'camera', 'audio']}></lr-attachment-trigger>`,
};

export const Disabled: Story = {
  render: () => html`
    <div style="display:flex; gap:1rem; align-items:center;">
      <lr-attachment-trigger disabled></lr-attachment-trigger>
      <lr-attachment-trigger disabled .capabilities=${['files', 'image', 'camera']}></lr-attachment-trigger>
    </div>
  `,
};

/** The intended real-world placement: dropped into `<lr-chat-composer>`'s
 *  `leading` slot, feeding picked files straight into an attachment tray of
 *  `<lr-attachment-chip>` rows in the composer's `chips` slot. */
export const InChatComposer: Story = {
  render: () => {
    const onPick = (e: CustomEvent<AttachmentPickDetail>) => {
      const composer = document.getElementById('composer-demo');
      if (!composer) return;
      for (const file of Array.from(e.detail.files)) {
        const chip = document.createElement('lr-attachment-chip');
        chip.setAttribute('slot', 'chips');
        chip.file = file;
        chip.addEventListener('lr-remove', () => chip.remove());
        composer.appendChild(chip);
      }
    };
    return html`
      <lr-chat-composer
        id="composer-demo"
        placeholder="Message the assistant…"
        style="max-width: 32rem; display: block;"
      >
        <lr-attachment-trigger
          slot="leading"
          .capabilities=${['files', 'image', 'camera']}
          @lr-pick=${onPick}
          @lr-camera-request=${logCameraRequest('composer-log')}
        ></lr-attachment-trigger>
      </lr-chat-composer>
      <p id="composer-log" style="margin-top:0.5rem; font: 0.8125rem monospace;"></p>
    `;
  },
};
