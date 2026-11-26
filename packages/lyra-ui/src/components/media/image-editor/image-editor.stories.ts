import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-image-editor.js';

const meta: Meta = {
  title: 'Media & Files/Image Editor',
  component: 'lr-image-editor',
  tags: ['autodocs'],
};

export default meta;

function downloadEdit(event: CustomEvent<{ blob: Blob }>): void {
  const url = URL.createObjectURL(event.detail.blob);
  const link = document.createElement('a');
  link.download = 'mountain-river.png';
  link.href = url;
  try {
    link.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

const source = new URL('../../../../../../.storybook/story-image.svg', import.meta.url).href;

export const Default: StoryObj = {
  render: () => html`<lr-image-editor src=${source} alt="Mountain river"
    @lr-export=${downloadEdit}></lr-image-editor>`,
};
