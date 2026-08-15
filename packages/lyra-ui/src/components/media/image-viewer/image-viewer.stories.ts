import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './image-viewer.js';
import { IMAGE_VIEWER_HIGHLIGHT_LIMIT } from './image-viewer.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = {
  title: 'DocumentViewer/ImageViewer',
  component: 'lr-image-viewer',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Full pan/zoom raster-image viewer with labeled region highlights whose activation emits `{ highlightId }`, plus opt-in region annotation. Malformed, empty, blank, and later duplicate highlight IDs are omitted first-wins before focus, active state, and events.' } } },
};
export default meta;
type Story = StoryObj;

const SRC = '/fixtures/story-image.svg';
const longLtrFitLabel = 'FitImageWithinTheAvailableViewingArea'.repeat(8);
const longRtlFitLabel = 'احتواءالصورةضمنمساحةالعرض'.repeat(12);
const longLtrFitStrings = {
  imageViewerFitLabel: 'Image fit mode',
  imageViewerFitContain: `${longLtrFitLabel}Contain`,
  imageViewerFitWidth: `${longLtrFitLabel}Width`,
  imageViewerFitActual: `${longLtrFitLabel}Actual`,
};
const longRtlFitStrings = {
  imageViewerFitLabel: 'وضع ملاءمة الصورة',
  imageViewerFitContain: `${longRtlFitLabel}احتواء`,
  imageViewerFitWidth: `${longRtlFitLabel}عرض`,
  imageViewerFitActual: `${longRtlFitLabel}فعلي`,
};

export const Default: Story = {
  render: () => html`<lr-image-viewer src=${SRC} name="Mountain river"></lr-image-viewer>`,
};

export const NoSrc: Story = {
  render: () => html`<lr-image-viewer></lr-image-viewer>`,
};

export const WithHighlights: Story = {
  render: () => html`<lr-image-viewer
    src=${SRC}
    name="Mountain river"
    .highlights=${[
      { id: 'h1', anchor: { kind: 'region', rect: { x: 10, y: 10, width: 25, height: 20 } }, label: 'Ridge line' },
      { id: 'h2', anchor: { kind: 'region', rect: { x: 55, y: 45, width: 20, height: 15 } }, tone: 'warning' },
    ]}
    active-highlight-id="h1"
  ></lr-image-viewer>`,
};

/** Large highlight sets retain one roving keyboard stop and project at most the documented
 * ceiling. The active tail item remains reachable by replacing the final item in the leading
 * window. */
export const BoundedHighlightProjection: Story = {
  render: () => {
    const count = IMAGE_VIEWER_HIGHLIGHT_LIMIT + 25;
    return html`<lr-image-viewer
      src=${SRC}
      name="Mountain river"
      .highlights=${Array.from({ length: count }, (_, index) => ({
        id: `region-${index}`,
        anchor: {
          kind: 'region' as const,
          rect: { x: index % 90, y: (index * 3) % 90, width: 5, height: 5 },
        },
        label: `Region ${index + 1}`,
      }))}
      active-highlight-id=${`region-${count - 1}`}
    ></lr-image-viewer>`;
  },
};

/** The rotated wrapper owns an axis-swapped layout footprint, so actual-size media remains
 * reachable instead of painting beyond the pan/zoom scroll extent. */
export const RotatedActualSize: Story = {
  render: () => html`
    <lr-image-viewer
      src=${SRC}
      name="Mountain river"
      fit="actual"
      rotation="90"
      style="inline-size: 20rem; max-inline-size: 100%"
    ></lr-image-viewer>
  `,
};

/** Outer consumers can style the embedded pan/zoom surface through the collision-resistant
 * `frame-viewport`, `frame-content`, and `frame-controls` part aliases. */
export const ForwardedFrameParts: Story = {
  render: () => html`
    <style>
      lr-image-viewer.forwarded-frame-parts::part(frame-viewport) {
        outline: var(--lr-border-width-thick) dashed var(--lr-color-brand);
        outline-offset: calc(var(--lr-border-width-thick) * -1);
      }
    </style>
    <lr-image-viewer
      class="forwarded-frame-parts"
      src=${SRC}
      name="Mountain river"
    ></lr-image-viewer>
  `,
};

export const AnnotatableMode: Story = {
  render: () => html`<lr-image-viewer src=${SRC} name="Mountain river" annotatable></lr-image-viewer>`,
};

export const RtlPhysicalAnnotation: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Annotation geometry follows physical image coordinates under RTL: after Enter creates a draft box, ArrowLeft/ArrowRight move along smaller/larger x and Shift+ArrowLeft/ArrowRight resize its width.',
      },
    },
  },
  render: () => html`
    <lr-image-viewer dir="rtl" src=${SRC} name="نهر جبلي" annotatable></lr-image-viewer>
  `,
};

export const FitWidth: Story = {
  render: () => html`<lr-image-viewer src=${SRC} name="Mountain river" fit="width"></lr-image-viewer>`,
};

export const Narrow320: Story = {
  name: 'Narrow 320px localized fit labels (LTR and RTL)',
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-l)">
      <div dir="ltr" style="inline-size: 320px; max-inline-size: 100%">
        <lr-image-viewer
          src=${SRC}
          name="Mountain river"
          .strings=${longLtrFitStrings}
        ></lr-image-viewer>
      </div>
      <div dir="rtl" lang="ar" style="inline-size: 320px; max-inline-size: 100%">
        <lr-image-viewer
          src=${SRC}
          name="نهر جبلي"
          .strings=${longRtlFitStrings}
        ></lr-image-viewer>
      </div>
    </div>
  `,
};

export const ThemedActiveStates: Story = {
  name: 'Themed active states (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-image-viewer-annotate-active-bg`/`--lr-image-viewer-annotate-active-border` retint the pressed annotation toggle. `--lr-image-viewer-highlight-active-color`, `--lr-image-viewer-highlight-active-border-width`, `--lr-image-viewer-highlight-active-outline-width`, and `--lr-image-viewer-highlight-active-outline-offset` tune the active highlight independently of its tone. None is declared on `:host`, so a value set on any ancestor is never shadowed. The toggle carries its own glyph in `--lr-color-text`, so keep 4.5:1 against the background you choose.',
      },
    },
  },
  render: () => html`
    <lr-image-viewer
      style="--lr-image-viewer-annotate-active-bg: ${storyColor('warningQuiet')}; --lr-image-viewer-annotate-active-border: ${storyColor('warning')}; --lr-image-viewer-highlight-active-color: ${storyColor('success')}; --lr-image-viewer-highlight-active-border-width: var(--lr-border-width-thin); --lr-image-viewer-highlight-active-outline-width: var(--lr-border-width-thick); --lr-image-viewer-highlight-active-outline-offset: var(--lr-border-width-thick);"
      src=${SRC}
      name="Mountain river"
      annotatable
      .highlights=${[
        { id: 'h1', anchor: { kind: 'region', rect: { x: 12, y: 18, width: 28, height: 26 } }, label: 'Active' },
        { id: 'h2', anchor: { kind: 'region', rect: { x: 55, y: 50, width: 22, height: 20 } }, label: 'Resting' },
      ]}
      active-highlight-id="h1"
    ></lr-image-viewer>
  `,
};
