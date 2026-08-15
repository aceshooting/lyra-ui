import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';
import { narrowStoryFrames } from '../../../../../../.storybook/narrow-story.js';

const meta: Meta = {
  title: 'WordCloud',
  component: 'lr-word-cloud',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Words, palette colors, and explicit legend entries are copied into frozen bounded snapshots (10,000, 64, and 100 outer entries respectively, plus text budgets). Reassign a collection after changing it.',
      },
    },
  },
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
  render: () => html`<lr-word-cloud .words=${WORDS} style="height: 20rem"></lr-word-cloud>`,
};

export const SqrtScale: Story = {
  render: () => html`<lr-word-cloud .words=${WORDS} scale="sqrt" style="height: 20rem"></lr-word-cloud>`,
};

export const MixedOrientation: Story = {
  render: () => html`<lr-word-cloud .words=${WORDS} word-rotation="mixed" style="height: 20rem"></lr-word-cloud>`,
};

export const GroupedColors: Story = {
  render: () =>
    html`<lr-word-cloud
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
    ></lr-word-cloud>`,
};

export const GroupedColorsWithLegend: Story = {
  render: () => html`<lr-word-cloud
    show-legend
    style="height: 20rem"
    .words=${[
      { text: 'React', weight: 80, group: 'framework' },
      { text: 'Playwright', weight: 55, group: 'testing' },
      { text: 'Vite', weight: 45, group: 'tooling' },
    ]}
    .legend=${[
      { label: 'Framework', color: storyColor('brand') },
      { label: 'Testing', color: storyColor('success') },
      { label: 'Tooling', color: storyColor('warning') },
    ]}
  ></lr-word-cloud>`,
};

export const CustomPalette: Story = {
  render: () =>
    html`<lr-word-cloud
      style="height: 20rem"
      .words=${WORDS}
      .palette=${[storyColor('danger'), storyColor('warning'), storyColor('success'), storyColor('brand')]}
    ></lr-word-cloud>`,
};

export const AncestorPalette: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The default palette hooks inherit from a theme wrapper; use the palette property when colors come from data instead.',
      },
    },
  },
  render: () => html`
    <div
      style="--lr-word-cloud-color-1: var(--lr-color-danger); --lr-word-cloud-color-2: var(--lr-color-warning); --lr-word-cloud-color-3: var(--lr-color-success); --lr-word-cloud-color-4: var(--lr-color-brand)"
    >
      <lr-word-cloud .words=${WORDS} style="height: var(--lr-size-20rem)"></lr-word-cloud>
    </div>
  `,
};

export const NarrowLegend: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Paired LTR/RTL allocations at the default 20rem (320px) contract combine mixed word rotation with long localized legend labels.',
      },
    },
  },
  render: () =>
    narrowStoryFrames((direction) => {
      const rtl = direction === 'rtl';
      return html`
        <lr-word-cloud
          show-legend
          word-rotation="mixed"
          style="block-size: var(--lr-size-20rem)"
          .words=${[
            { text: rtl ? 'إمكانية الوصول' : 'Barrierefreiheit', weight: 90, group: 'quality' },
            { text: rtl ? 'مكونات الويب' : 'Webkomponenten', weight: 70, group: 'platform' },
            { text: rtl ? 'التدويل' : 'Internationalisierung', weight: 55, group: 'quality' },
            { text: rtl ? 'اختبار' : 'Tests', weight: 40, group: 'platform' },
          ]}
          .legend=${[
            {
              label: rtl ? 'فئةجودةطويلةجداًوغيرقابلةللالتفاف' : 'SehrLangeNichtUmbrechbareQualitätskategorie',
              color: storyColor('brand'),
            },
            {
              label: rtl ? 'منصة المكونات المشتركة' : 'Gemeinsame Komponentenplattform',
              color: storyColor('success'),
            },
          ]}
        ></lr-word-cloud>
      `;
    }),
};

export const Empty: Story = {
  render: () => html`<lr-word-cloud style="height: 10rem"></lr-word-cloud>`,
};
