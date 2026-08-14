import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './pan-zoom.js';

const meta: Meta = {
  title: 'Media/Pan Zoom',
  component: 'lr-pan-zoom',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Scrollable pan-and-zoom surface for slotted content or an image source. Viewport focus transitions relay exactly one native `FocusEvent` plus the `lr-focus`/`lr-blur` alias.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const longLtrCurrentZoom = `${'CurrentZoomReading'.repeat(18)} {percent}`;
const longRtlCurrentZoom = `${'مستوىالتكبيرالحالي'.repeat(18)} {percent}`;

export const SlottedContent: Story = {
  render: () => html`<lr-pan-zoom aria-label="Diagram preview">
    <div style="inline-size: 32rem; block-size: 16rem; display: grid; place-items: center; background: var(--lr-color-brand-quiet);">
      Zoomable diagram
    </div>
  </lr-pan-zoom>`,
};

export const ImageSource: Story = {
  render: () => html`<lr-pan-zoom
    src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="
    alt="Preview"
    aria-label="Image preview"
  ></lr-pan-zoom>`,
};

export const Narrow320LocalizedReset: Story = {
  name: 'Narrow 320px localized reset label (LTR and RTL)',
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-l)">
      <div dir="ltr" lang="en" style="inline-size: 320px; max-inline-size: 100%">
        <lr-pan-zoom
          aria-label="Diagram preview"
          .strings=${{ pdfViewerCurrentZoom: longLtrCurrentZoom }}
        ></lr-pan-zoom>
      </div>
      <div dir="rtl" lang="ar" style="inline-size: 320px; max-inline-size: 100%">
        <lr-pan-zoom
          aria-label="معاينة الرسم"
          .strings=${{ pdfViewerCurrentZoom: longRtlCurrentZoom }}
        ></lr-pan-zoom>
      </div>
    </div>
  `,
};
