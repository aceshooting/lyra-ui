import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './copy-button.js';

const meta: Meta = {
  title: 'CopyButton',
  component: 'lr-copy-button',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A standalone icon-only copy-to-clipboard affordance for a plain text `value`, with no positioning opinion of its own -- the consumer places it (e.g. absolutely positioned in the corner of a textarea or read-only output field). Swaps its icon to a checkmark for ~1.5s once the clipboard write resolves, or to a failure glyph (plus `lr-copy-error`) when the write is refused.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-copy-button value="npm install @aceshooting/lyra-ui"></lr-copy-button>`,
};

export const CustomAccessibleLabel: Story = {
  render: () => html`
    <lr-copy-button
      aria-label="Copy installation command"
      value="npm install @aceshooting/lyra-ui"
      feedback-duration="3000"
    ></lr-copy-button>
  `,
};

export const Disabled: Story = {
  render: () => html`<lr-copy-button disabled value="Unavailable"></lr-copy-button>`,
};

export const InACornerOverlay: Story = {
  name: 'In a corner overlay',
  render: () => html`
    <div
      style="position: relative; inline-size: 20rem; padding: 1rem; border: 1px solid var(--lr-color-border); border-radius: 0.5rem;"
    >
      <pre style="margin: 0; white-space: pre-wrap;">npm install @aceshooting/lyra-ui</pre>
      <div style="position: absolute; top: 0.5rem; inset-inline-end: 0.5rem;">
        <lr-copy-button value="npm install @aceshooting/lyra-ui"></lr-copy-button>
      </div>
    </div>
  `,
};

export const Interactive: Story = {
  render: () => html`
    <lr-copy-button
      value="hello world"
      @lr-copy=${(e: CustomEvent<{ text: string }>) => {
        const out = document.getElementById('copy-button-log');
        if (out) out.textContent = `lr-copy: ${e.detail.text}`;
      }}
      @lr-copy-error=${(e: CustomEvent<{ text: string; reason: string }>) => {
        const out = document.getElementById('copy-button-log');
        if (out) out.textContent = `lr-copy-error: ${e.detail.reason}`;
      }}
    ></lr-copy-button>
    <p id="copy-button-log" style="font-family: monospace; margin-top: 0.5rem;">(no event yet)</p>
  `,
};

export const CopyFailure: Story = {
  name: 'Clipboard write refused',
  parameters: {
    docs: {
      description: {
        story:
          'A clipboard write can be refused — an insecure origin with no Clipboard API at all (`reason: "unsupported"`), a denied permission or an unfocused document (`reason: "denied"`), or any other platform failure (`reason: "failed"`). The button then shows its failure glyph instead of the checkmark, announces the outcome through a visually hidden `role="status"` region, and emits `lr-copy-error`. This story swaps in a clipboard that always rejects so the state is reachable in the docs.',
      },
    },
  },
  render: () => html`
    <lr-copy-button
      value="this write will be refused"
      feedback-duration="4000"
      @pointerdown=${() => {
        // Installed on pointerdown (before the button's own click handler reads it) and put back
        // on the next macrotask, so the rest of the docs page keeps the real clipboard.
        const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) },
          configurable: true,
        });
        setTimeout(() => {
          if (original) Object.defineProperty(navigator, 'clipboard', original);
        }, 0);
      }}
      @lr-copy-error=${(e: CustomEvent<{ reason: string }>) => {
        const out = document.getElementById('copy-button-error-log');
        if (out) out.textContent = `lr-copy-error: ${e.detail.reason}`;
      }}
    ></lr-copy-button>
    <p id="copy-button-error-log" style="font-family: monospace; margin-top: 0.5rem;">(no event yet)</p>
  `,
};
