import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './typing-indicator.js';

const meta: Meta = {
  title: 'TypingIndicator',
  component: 'lyra-typing-indicator',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A purely presentational "assistant is responding" presence cue — three visual variants, no events, no interactivity. Mount it while a response is being generated and remove it once real content arrives.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Variants: Story = {
  render: () => html`
    <div style="display:flex; gap:2rem; align-items:center;">
      <lyra-typing-indicator variant="dots"></lyra-typing-indicator>
      <lyra-typing-indicator variant="pulse"></lyra-typing-indicator>
      <lyra-typing-indicator variant="cursor"></lyra-typing-indicator>
    </div>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display:flex; gap:2rem; align-items:center;">
      <lyra-typing-indicator size="sm"></lyra-typing-indicator>
      <lyra-typing-indicator size="md"></lyra-typing-indicator>
    </div>
  `,
};

export const CustomLabel: Story = {
  render: () => html`<lyra-typing-indicator label="Generating response…"></lyra-typing-indicator>`,
};

export const InlineWithStreamedText: Story = {
  name: 'Inline with streamed text (cursor variant)',
  render: () => html`
    <p style="font-family: system-ui, sans-serif; max-width: 32rem;">
      The quick brown fox jumps over the lazy dog, and then keeps going
      <lyra-typing-indicator variant="cursor" label="Response is still streaming"></lyra-typing-indicator>
    </p>
  `,
};

export const ReducedMotion: Story = {
  name: 'Reduced motion (static)',
  parameters: {
    docs: {
      description: {
        story:
          'With `prefers-reduced-motion: reduce` set at the OS/browser level, every variant renders its plain resting frame instead of animating.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:2rem; align-items:center;">
      <lyra-typing-indicator variant="dots"></lyra-typing-indicator>
      <lyra-typing-indicator variant="pulse"></lyra-typing-indicator>
      <lyra-typing-indicator variant="cursor"></lyra-typing-indicator>
    </div>
  `,
};
