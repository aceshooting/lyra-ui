import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { LYRA_CHART_PALETTES } from '../../../theme/options/charts.js';
import '../../lr-pan-zoom.js';

const meta: Meta = {
  title: 'Media/Pan Zoom',
  component: 'lr-pan-zoom',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A property-only accessibleLabel names the viewport and updates reactively; host aria-label retains its separate naming ownership. Scrollable pan-and-zoom surface for slotted content or a safe image source. Scaling participates in layout so the entire painted footprint remains reachable; rejected sources fall back to the slot. Reset returns to exact 100% independently of the relative zoom step. The labelled control group keeps each native button in the Tab sequence. Viewport focus transitions relay exactly one native `FocusEvent`.',
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
    style="--lr-pan-zoom-control-hover-bg: var(--lr-color-success-quiet)"
  ></lr-pan-zoom>`,
};

const { sequential: [sky, mountain, foreground], diverging: [sun] } = LYRA_CHART_PALETTES.lyra.dark;
const portrait = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="720">' +
  `<path fill="${sky}" d="M0 0h480v720H0z"/><circle fill="${sun}" cx="340" cy="180" r="60"/>` +
  `<path fill="${mountain}" d="M0 500l140-250 180 230 100-150 60 125v265H0z"/>` +
  `<path fill="${foreground}" d="M0 580l160-90 220 70 100-65v225H0z"/></svg>`,
)}`;

export const BoundedPortrait: Story = {
  render: () => html`<lr-pan-zoom
    fit="contain"
    src=${portrait}
    alt="Illustration of a mountain landscape"
    aria-label="Portrait image preview"
    style="inline-size: 32rem; max-inline-size: 100%; block-size: min(65dvh, 28rem)"
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

export const UnreadableImage: Story = {
  render: () => html`<lr-pan-zoom src="data:image/png;base64,AA=="></lr-pan-zoom>`,
};
