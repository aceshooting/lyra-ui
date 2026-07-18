import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './typing-indicator.js';

const meta: Meta = {
  title: 'TypingIndicator',
  component: 'lr-typing-indicator',
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
      <lr-typing-indicator variant="dots"></lr-typing-indicator>
      <lr-typing-indicator variant="pulse"></lr-typing-indicator>
      <lr-typing-indicator variant="cursor"></lr-typing-indicator>
    </div>
  `,
};

export const Sizes: Story = {
  render: () => html`
    <div style="display:flex; gap:2rem; align-items:center;">
      <lr-typing-indicator size="sm"></lr-typing-indicator>
      <lr-typing-indicator size="md"></lr-typing-indicator>
    </div>
  `,
};

export const CustomLabel: Story = {
  render: () => html`<lr-typing-indicator label="Generating response…"></lr-typing-indicator>`,
};

export const RetimedDots: Story = {
  name: 'Retimed dots with proportional stagger',
  parameters: {
    docs: {
      description: {
        story:
          'When retiming the compound `--lr-transition-ambient` animation token, set the two stagger delays alongside it to preserve the intended one-third/two-thirds phasing.',
      },
    },
  },
  render: () => html`
    <lr-typing-indicator
      label="Generating quickly…"
      style="--lr-transition-ambient: 900ms ease-in-out; --lr-typing-dot-stagger-1: 300ms; --lr-typing-dot-stagger-2: 600ms;"
    ></lr-typing-indicator>
  `,
};

export const InlineWithStreamedText: Story = {
  name: 'Inline with streamed text (cursor variant)',
  render: () => html`
    <p style="font-family: system-ui, sans-serif; max-width: 32rem;">
      The quick brown fox jumps over the lazy dog, and then keeps going
      <lr-typing-indicator variant="cursor" label="Response is still streaming"></lr-typing-indicator>
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
      <lr-typing-indicator variant="dots"></lr-typing-indicator>
      <lr-typing-indicator variant="pulse"></lr-typing-indicator>
      <lr-typing-indicator variant="cursor"></lr-typing-indicator>
    </div>
  `,
};
