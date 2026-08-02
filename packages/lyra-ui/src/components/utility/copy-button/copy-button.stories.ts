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
          'A standalone copy-to-clipboard affordance for a plain text `value` or an element named by `from`, with no positioning opinion of its own. The built-in icon button supports localized feedback labels, three tooltip modes, icon slots, and success/error theme hooks; a default-slot trigger can replace it. A resolved write emits `lr-copy`; source and clipboard failures emit `lr-error` plus the retained detailed `lr-copy-error` alias.',
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

export const FromSourceAndTooltip: Story = {
  name: 'From source, labels, and tooltip',
  render: () => html`
    <div style="display: inline-flex; align-items: center; gap: var(--lr-space-xs);">
      <code id="copy-button-source">npm install @aceshooting/lyra-ui</code>
      <lr-copy-button
        from="copy-button-source"
        copy-label="Copy install command"
        success-label="Install command copied"
        error-label="Could not copy install command"
        tooltip-placement="right"
        hoist
        style="--success-color: var(--lr-color-success); --error-color: var(--lr-color-danger);"
      >
        <span slot="copy-icon">⧉</span>
        <span slot="success-icon">✓</span>
        <span slot="error-icon">!</span>
      </lr-copy-button>
    </div>
  `,
};

export const CustomTrigger: Story = {
  render: () => html`
    <lr-copy-button
      value="Text copied by a custom trigger"
      tooltip="copy"
      success-label="Custom value copied"
    >
      <button type="button">Copy with custom trigger</button>
    </lr-copy-button>
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
      @lr-error=${() => {
        const out = document.getElementById('copy-button-log');
        if (out) out.textContent = 'lr-error';
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
          'A clipboard write can be refused — an insecure origin with no Clipboard API at all (`reason: "unsupported"`), a denied permission or an unfocused document (`reason: "denied"`), or any other platform failure (`reason: "failed"`). The button then shows its failure glyph instead of the checkmark, announces the outcome through a visually hidden `role="status"` region, and emits `lr-error` plus the detailed `lr-copy-error` alias. This story swaps in a clipboard that always rejects so the state is reachable in the docs.',
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
