import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import type { LyraAnimation } from './animation.class.js';
import { setAnimation } from '../../../utilities/animation-registry.js';
import './animation.js';

const meta: Meta = {
  title: 'Animation',
  component: 'lr-animation',
  tags: ['autodocs'],
  parameters: {
    docs: {
      source: { type: 'code' },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  parameters: {
    docs: {
      source: {
        code: `<lr-animation name="fade-in" play iterations="1">
  <p>Content animated with a named preset.</p>
</lr-animation>`,
      },
    },
  },
  render: () => html`
    <lr-animation name="fade-in" play iterations="1">
      <p>Content animated with a named preset.</p>
    </lr-animation>
  `,
};

export const Presets: Story = {
  parameters: {
    docs: {
      source: {
        code: `<div style="display: grid; gap: var(--lr-space-s);">
  <lr-animation name="slide-in-start" play iterations="1"><span>Slide in from the start</span></lr-animation>
  <lr-animation name="zoom-in" play iterations="1"><span>Zoom in</span></lr-animation>
  <lr-animation name="bounce" play iterations="1"><span>Bounce</span></lr-animation>
</div>`,
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s);">
      <lr-animation name="slide-in-start" play iterations="1"><span>Slide in from the start</span></lr-animation>
      <lr-animation name="zoom-in" play iterations="1"><span>Zoom in</span></lr-animation>
      <lr-animation name="bounce" play iterations="1"><span>Bounce</span></lr-animation>
    </div>
  `,
};

export const RegistryOverride: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'This story installs an RTL-aware per-element `animation.slide-in-start` override, rebuilds the paused native animation, then releases the registration before playing. The already-built animation keeps the selected frames while the registry immediately returns to its previous state.',
      },
      source: {
        code: `<div dir="rtl">
  <lr-animation name="slide-in-start" duration="400" iterations="1">
    <span style="display: inline-block; padding: var(--lr-space-s);">Registry override</span>
  </lr-animation>
</div>`,
      },
    },
  },
  render: () => html`
    <div dir="rtl">
      <lr-animation name="slide-in-start" duration="400" iterations="1">
        <span style="display: inline-block; padding: var(--lr-space-s);">Registry override</span>
      </lr-animation>
    </div>
  `,
  play: async ({ canvasElement }) => {
    const animation = canvasElement.querySelector('lr-animation') as LyraAnimation | null;
    if (!animation) return;
    const release = setAnimation(animation, 'animation.slide-in-start', {
      keyframes: [
        { opacity: 0, transform: 'translateX(calc(-1 * var(--lr-size-2rem)))' },
        { opacity: 1, transform: 'translateX(0)' },
      ],
      rtlKeyframes: [
        { opacity: 0, transform: 'translateX(var(--lr-size-2rem))' },
        { opacity: 1, transform: 'translateX(0)' },
      ],
    });
    animation.duration += 1;
    await animation.updateComplete;
    release();
    animation.start();
  },
};

export const RegisteredCustomName: Story = {
  name: 'Arbitrary registered name',
  parameters: {
    docs: {
      description: {
        story:
          '`name` is a string, not only the built-in `LyraAnimationPreset` union. This story resolves the consumer-defined `animation.custom-lift` registry key.',
      },
      source: {
        code: `<lr-animation name="custom-lift" duration="400" iterations="1">
  <span style="display: inline-block; padding: var(--lr-space-s);">Custom registry name</span>
</lr-animation>`,
      },
    },
  },
  render: () => html`
    <lr-animation name="custom-lift" duration="400" iterations="1">
      <span style="display: inline-block; padding: var(--lr-space-s);">Custom registry name</span>
    </lr-animation>
  `,
  play: async ({ canvasElement }) => {
    const animation = canvasElement.querySelector('lr-animation') as LyraAnimation | null;
    if (!animation) return;
    const release = setAnimation(animation, 'animation.custom-lift', {
      keyframes: [
        { opacity: 0, transform: 'translateY(var(--lr-size-1rem))' },
        { opacity: 1, transform: 'translateY(0)' },
      ],
    });
    animation.duration += 1;
    await animation.updateComplete;
    release();
    animation.start();
  },
};
