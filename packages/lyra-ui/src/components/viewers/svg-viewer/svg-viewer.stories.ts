import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './svg-viewer.js';
import { storyColor } from '../../../../../../.storybook/theme-contract.js';

const meta: Meta = { title: 'DocumentViewer/SvgViewer', component: 'lr-svg-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80"><rect width="160" height="80" rx="12" fill="LinkText"/><circle cx="45" cy="40" r="20" fill="Canvas"/><path d="M85 25h45v10H85zm0 20h30v10H85z" fill="Canvas"/></svg>';
const src = `data:image/svg+xml,${encodeURIComponent(source)}`;

export const Default: Story = { render: () => html`<lr-svg-viewer src=${src} name="Example illustration"></lr-svg-viewer>` };
export const Empty: Story = { render: () => html`<lr-svg-viewer></lr-svg-viewer>` };
export const ErrorState: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Idle, loading, and error content use a region rather than an image leaf so visible state text remains in the accessibility tree.',
      },
    },
  },
  render: () => html`<lr-svg-viewer src="javascript:alert(1)" name="Unsafe diagram"></lr-svg-viewer>`,
};

export const Zoomable: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The opt-in `zoomable` property wraps the sanitized SVG in `<lr-pan-zoom>` and forwards its controls through the `frame-*` parts.',
      },
    },
  },
  render: () => html`<lr-svg-viewer src=${src} name="Zoomable illustration" zoomable></lr-svg-viewer>`,
};

/** Baseline narrow-allocation coverage with long metadata and multiple region actions. */
export const Narrow320: Story = {
  render: () => html`
    <div style="max-inline-size:320px">
      <lr-svg-viewer
        src=${src}
        name="International quarterly analytical-engine research diagram.svg"
        .highlights=${[
          { id: 'h1', anchor: { kind: 'region', rect: { x: 8, y: 20, width: 4, height: 8 } }, label: 'First analytical-engine result' },
          { id: 'h2', anchor: { kind: 'region', rect: { x: 13, y: 20, width: 4, height: 8 } }, label: 'Second analytical-engine result' },
        ]}
      ></lr-svg-viewer>
    </div>
  `,
};

export const ThemedActiveRegion: Story = {
  name: 'Themed active region (cssprop)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-svg-viewer-active-border` recolors only the region matching `active-highlight-id`. Painting retains at most 100 valid regions from a 1,000-entry candidate window, and the active region is retained from anywhere in the bounded host snapshot and painted first. Set the token on the element or an ancestor; resting highlights keep `--lr-color-brand`.',
      },
    },
  },
  render: () => html`
    <lr-svg-viewer
      style="--lr-svg-viewer-active-border: ${storyColor('success')};"
      src=${src}
      name="Example illustration"
      .highlights=${[
        { id: 'h1', anchor: { kind: 'region', rect: { x: 8, y: 20, width: 30, height: 55 } }, label: 'Active region' },
        { id: 'h2', anchor: { kind: 'region', rect: { x: 52, y: 25, width: 34, height: 22 } }, label: 'Resting region' },
      ]}
      active-highlight-id="h1"
    ></lr-svg-viewer>
  `,
};


export const CappedTallSvg: Story = {
  parameters: { docs: { description: { story: 'The capped nonzoomable SVG begins at the reachable scroll origin, keeping its start and end available. Fitting content stays centered.' } } },
  render: () => {
    const markup = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="1000"><rect width="200" height="1000" fill="LinkText"/><text x="24" y="36" fill="Canvas">Start</text><text x="24" y="972" fill="Canvas">End</text></svg>';
    return html`<lr-svg-viewer style="inline-size:320px" max-height="160px" src=${`data:image/svg+xml,${encodeURIComponent(markup)}`} name="Tall diagram"></lr-svg-viewer>`;
  },
};
