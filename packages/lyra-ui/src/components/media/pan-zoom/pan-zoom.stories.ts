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
          'Scrollable pan-and-zoom surface for slotted content or a safe image source. Scaling participates in layout so the entire painted footprint remains reachable; rejected sources fall back to the slot. Reset returns to exact 100% independently of the relative zoom step. The labelled control group keeps each native button in the Tab sequence. Viewport focus transitions relay exactly one native `FocusEvent`.',
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

/** The 2× surface expands native scroll geometry rather than painting beyond its reachable layout
 * box. Switch this story to RTL to inspect the opposite logical edge. */
export const ScaledFootprint: Story = {
  render: () => html`<div style="inline-size: 320px; max-inline-size: 100%;">
    <lr-pan-zoom zoom="2" aria-label="Scaled diagram">
      <div style="inline-size: 36rem; block-size: 14rem; background: var(--lr-color-brand-quiet);">
        Both ends remain scrollable at 2×
      </div>
    </lr-pan-zoom>
  </div>`,
};

/** An unsafe/rejected image source is absent; it never replaces useful fallback content with an
 * empty broken image. */
export const RejectedImageFallsBackToSlot: Story = {
  render: () => html`<lr-pan-zoom src="javascript:alert(1)" aria-label="Fallback preview">
    <div>Safe slotted fallback</div>
  </lr-pan-zoom>`,
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
