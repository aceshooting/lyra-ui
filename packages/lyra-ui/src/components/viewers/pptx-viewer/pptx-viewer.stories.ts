import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './pptx-viewer.js';

const meta: Meta = {
  title: 'PptxViewer',
  component: 'lr-pptx-viewer',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: 'Best-effort, client-side PPTX rendering with a persistent notice about unsupported advanced PowerPoint features.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const fixtureUrl = new URL('./fixtures/table-stale-frame.pptx', import.meta.url).href;

export const RealFixture: Story = {
  name: 'Real PPTX fixture',
  render: () => html`<lr-pptx-viewer style="display:block; min-height:24rem;" src=${fixtureUrl} name="Table fixture"></lr-pptx-viewer>`,
};

export const MissingSource: Story = {
  name: 'No source',
  render: () => html`<lr-pptx-viewer></lr-pptx-viewer>`,
};

export const UnsafeSource: Story = {
  name: 'Unsafe source',
  render: () => html`<lr-pptx-viewer .src=${'javascript:alert(1)'}></lr-pptx-viewer>`,
};
