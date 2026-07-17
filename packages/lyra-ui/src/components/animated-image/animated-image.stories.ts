import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './animated-image.js';

const meta: Meta = {
  title: 'AnimatedImage',
  component: 'lyra-animated-image',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Displays an animated GIF/APNG/WebP with a play/pause control. Defaults to a frozen first frame, both at rest and automatically under `prefers-reduced-motion: reduce` -- set `respect-reduced-motion="false"` to opt a specific instance back into ignoring that OS-level preference.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const SAMPLE_GIF = 'https://upload.wikimedia.org/wikipedia/commons/d/d3/Newtons_cradle_animation_book_2.gif';
const BROKEN_SRC = './does-not-exist-lyra-animated-image.gif';

export const Default: Story = {
  render: () => html`
    <lyra-animated-image
      src=${SAMPLE_GIF}
      alt="A Newton's cradle swinging"
      style="max-inline-size: 20rem;"
    ></lyra-animated-image>
  `,
};

export const AutoPlaying: Story = {
  name: 'play attribute set initially',
  render: () => html`
    <lyra-animated-image
      play
      src=${SAMPLE_GIF}
      alt="A Newton's cradle swinging"
      style="max-inline-size: 20rem;"
    ></lyra-animated-image>
  `,
};

export const RespectReducedMotionOverride: Story = {
  name: 'respect-reduced-motion="false"',
  parameters: {
    docs: {
      description: {
        story:
          'By default, an OS-level `prefers-reduced-motion: reduce` preference keeps this component frozen and disables the play button even if `play` is set. Setting `respect-reduced-motion="false"` is a deliberate, page-author-level override that lets `play` take effect regardless -- it never appears as an end-user-facing control.',
      },
    },
  },
  render: () => html`
    <lyra-animated-image
      play
      respect-reduced-motion="false"
      src=${SAMPLE_GIF}
      alt="A Newton's cradle swinging"
      style="max-inline-size: 20rem;"
    ></lyra-animated-image>
  `,
};

export const AccessibleLabelOverride: Story = {
  name: 'Accessible action-name override',
  render: () => html`
    <lyra-animated-image
      aria-label="Toggle the hero animation"
      src=${SAMPLE_GIF}
      alt="A Newton's cradle swinging"
      style="max-inline-size: 20rem;"
    ></lyra-animated-image>
  `,
};

export const CustomIcons: Story = {
  name: 'Custom play/pause icons via slots',
  render: () => html`
    <lyra-animated-image src=${SAMPLE_GIF} alt="A Newton's cradle swinging" style="max-inline-size: 20rem;">
      <span slot="play-icon">▶</span>
      <span slot="pause-icon">⏸</span>
    </lyra-animated-image>
  `,
};

export const LoadFailure: Story = {
  name: 'lyra-error -- broken src',
  render: () => html`<lyra-animated-image src=${BROKEN_SRC} alt="A missing animation"></lyra-animated-image>`,
};

export const RightToLeft: Story = {
  name: 'Right-to-left',
  parameters: {
    docs: {
      description: {
        story:
          'Under `dir="rtl"`, `[part="control-box"]` uses logical inset properties, so it mirrors to the top-start (visually top-left) corner with zero JS.',
      },
    },
  },
  render: () => html`
    <lyra-animated-image
      dir="rtl"
      src=${SAMPLE_GIF}
      alt="صورة متحركة"
      style="max-inline-size: 20rem;"
    ></lyra-animated-image>
  `,
};

export const NarrowAllocation: Story = {
  name: 'Narrow allocation (320px)',
  parameters: {
    docs: {
      description: {
        story: 'At a 320px allocation, the media and its overlay control-box stay within bounds with no overflow.',
      },
    },
  },
  render: () => html`
    <lyra-animated-image
      src=${SAMPLE_GIF}
      alt="A Newton's cradle swinging"
      style="inline-size: 320px; max-inline-size: 100%;"
    ></lyra-animated-image>
  `,
};
