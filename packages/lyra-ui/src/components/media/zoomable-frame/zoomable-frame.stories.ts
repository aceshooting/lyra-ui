import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './zoomable-frame.js';

const meta: Meta = {
  title: 'Media/Zoomable Frame',
  component: 'lr-zoomable-frame',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

const previewDocument = `<!doctype html>
<html><body style="font-family:system-ui;margin:2rem">
  <h1>Responsive component preview</h1>
  <p>This document stays inside a sandboxed iframe while the outer controls scale it.</p>
</body></html>`;

const rtlPreviewDocument = `<!doctype html>
<html dir="rtl" lang="ar"><body style="font-family:system-ui;margin:2rem">
  <h1>معاينة مكوّن قابلة للتكبير</h1>
  <p>يبقى هذا المستند الطويل داخل إطار معزول بينما تبقى عناصر التحكّم في الموضع المنطقي المناسب للواجهة.</p>
</body></html>`;

export const InlineDocument: Story = {
  render: () => html`<lr-zoomable-frame
    aria-label="Inline component preview"
    .srcdoc=${previewDocument}
    zoom="0.75"
    with-theme-sync
  ></lr-zoomable-frame>`,
};

export const DecorativeIconSlots: Story = {
  name: 'Decorative zoom icon slots',
  parameters: {
    docs: {
      description: {
        story:
          'The icon slots are decorative visual overrides. Their flattened content is inert and hidden from assistive technology, so use an SVG or glyph rather than a second interactive control; the native zoom buttons remain the only focus and click targets.',
      },
    },
  },
  render: () => html`<lr-zoomable-frame aria-label="Icon slot preview" .srcdoc=${previewDocument}>
    <span slot="zoom-in-icon">＋</span>
    <span slot="zoom-out-icon">−</span>
  </lr-zoomable-frame>`,
};

export const ControlHoverTheme: Story = {
  render: () => html`<lr-zoomable-frame
    aria-label="Themed zoom preview"
    style="--lr-zoomable-frame-control-hover-background: var(--lr-color-success-quiet)"
    .srcdoc=${previewDocument}
  ></lr-zoomable-frame>`,
};

export const Narrow320Rtl: Story = {
  name: '320px RTL zoom preview',
  render: () => html`<div dir="rtl" lang="ar" style="inline-size: 320px;">
    <lr-zoomable-frame
      aria-label="معاينة قابلة للتكبير"
      .srcdoc=${rtlPreviewDocument}
      zoom="0.75"
    >
      <span slot="zoom-in-icon">＋</span>
      <span slot="zoom-out-icon">−</span>
    </lr-zoomable-frame>
  </div>`,
};

export const NonInteractive: Story = {
  render: () => html`<lr-zoomable-frame
    aria-label="Non-interactive preview"
    .srcdoc=${previewDocument}
    without-interaction
    without-controls
  ></lr-zoomable-frame>`,
};
