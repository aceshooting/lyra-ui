import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'WordCloud',
  component: 'lyra-word-cloud',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const WORDS = [
  { text: 'JavaScript', weight: 90 },
  { text: 'TypeScript', weight: 75 },
  { text: 'Lit', weight: 60 },
  { text: 'Web Components', weight: 55 },
  { text: 'HTML', weight: 40 },
  { text: 'CSS', weight: 38 },
  { text: 'Shadow DOM', weight: 25 },
  { text: 'Custom Elements', weight: 22 },
  { text: 'Accessibility', weight: 18 },
  { text: 'SVG', weight: 15 },
  { text: 'Design Tokens', weight: 12 },
  { text: 'Testing', weight: 10 },
];

export const Default: Story = {
  render: () => html`<lyra-word-cloud .words=${WORDS} style="height: 20rem"></lyra-word-cloud>`,
};

export const SqrtScale: Story = {
  render: () =>
    html`<lyra-word-cloud .words=${WORDS} scale="sqrt" style="height: 20rem"></lyra-word-cloud>`,
};

export const MixedOrientation: Story = {
  render: () =>
    html`<lyra-word-cloud .words=${WORDS} orientations="mixed" style="height: 20rem"></lyra-word-cloud>`,
};

export const GroupedColors: Story = {
  render: () =>
    html`<lyra-word-cloud
      style="height: 20rem"
      .words=${[
        { text: 'React', weight: 80, group: 'framework' },
        { text: 'Vue', weight: 60, group: 'framework' },
        { text: 'Svelte', weight: 40, group: 'framework' },
        { text: 'Jest', weight: 55, group: 'testing' },
        { text: 'Playwright', weight: 45, group: 'testing' },
        { text: 'Vitest', weight: 30, group: 'testing' },
        { text: 'Vite', weight: 50, group: 'tooling' },
        { text: 'esbuild', weight: 20, group: 'tooling' },
      ]}
    ></lyra-word-cloud>`,
};

export const CustomPalette: Story = {
  render: () =>
    html`<lyra-word-cloud
      style="height: 20rem"
      .words=${WORDS}
      .palette=${['#e63946', '#f1a208', '#2a9d8f', '#264653']}
    ></lyra-word-cloud>`,
};

export const Empty: Story = {
  render: () => html`<lyra-word-cloud style="height: 10rem"></lyra-word-cloud>`,
};
