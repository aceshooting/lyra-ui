import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './audio-visualizer.js';

const meta: Meta = {
  title: 'Audio Visualizer',
  component: 'lyra-audio-visualizer',
};
export default meta;
type Story = StoryObj;

export const Idle: Story = {
  render: () => html`<lyra-audio-visualizer state="idle"></lyra-audio-visualizer>`,
};

export const Listening: Story = {
  render: () => html`<lyra-audio-visualizer state="listening"></lyra-audio-visualizer>`,
};

export const Thinking: Story = {
  render: () => html`<lyra-audio-visualizer state="thinking"></lyra-audio-visualizer>`,
};

export const Speaking: Story = {
  render: () => html`<lyra-audio-visualizer state="speaking"></lyra-audio-visualizer>`,
};

export const WaveformWithLevel: Story = {
  render: () => html`<lyra-audio-visualizer variant="waveform" level="0.6" state="speaking"></lyra-audio-visualizer>`,
};

export const Narrow320: Story = {
  render: () => html`
    <div style="max-inline-size: 320px; border: 1px dashed #ccc; padding: 8px;">
      <lyra-audio-visualizer state="listening" bar-count="8"></lyra-audio-visualizer>
    </div>
  `,
};

export const ReducedMotion: Story = {
  name: 'Reduced motion (ambient states only)',
  parameters: {
    docs: {
      description: {
        story:
          'With `prefers-reduced-motion: reduce` set at the OS/browser level, the signal-less ambient animation collapses to a static frame (a quiet flat idle, a steady mid-height pulse for listening/speaking, and a flat mid-height bar for thinking instead of a moving sweep). A real `stream` or `level` signal keeps animating regardless — that is live feedback, not decorative motion.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; gap:2rem; align-items:center;">
      <lyra-audio-visualizer state="idle"></lyra-audio-visualizer>
      <lyra-audio-visualizer state="listening"></lyra-audio-visualizer>
      <lyra-audio-visualizer state="thinking"></lyra-audio-visualizer>
      <lyra-audio-visualizer state="speaking"></lyra-audio-visualizer>
    </div>
  `,
};
