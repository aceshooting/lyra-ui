import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './svg-viewer.js';
import { storyColor } from '../../../../../../.storybook/story-theme.js';

const meta: Meta = { title: 'DocumentViewer/SvgViewer', component: 'lr-svg-viewer', tags: ['autodocs'] };
export default meta;
type Story = StoryObj;

const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 80"><rect width="160" height="80" rx="12" fill="LinkText"/><circle cx="45" cy="40" r="20" fill="Canvas"/><path d="M85 25h45v10H85zm0 20h30v10H85z" fill="Canvas"/></svg>';
const src = `data:image/svg+xml,${encodeURIComponent(source)}`;

export const Default: Story = { render: () => html`<lr-svg-viewer src=${src} name="Example illustration"></lr-svg-viewer>` };
export const Empty: Story = { render: () => html`<lr-svg-viewer></lr-svg-viewer>` };

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
          '`--lr-svg-viewer-active-border` recolors only the region highlight matching `active-highlight-id`; the resting highlights keep `--lr-color-brand`. Set it on the element or any ancestor — it is not declared on `:host`, so an ancestor value is never shadowed. Previously the active border resolved straight through library-wide `--lr-color-warning`.',
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
