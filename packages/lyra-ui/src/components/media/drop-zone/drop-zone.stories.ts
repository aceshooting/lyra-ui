import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './drop-zone.js';
import type { LyraDropZoneFilesDetail } from './drop-zone.js';

const meta: Meta = {
  title: 'DropZone',
  component: 'lr-drop-zone',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A drag-and-drop region wrapper with no file input of its own. Wraps an arbitrary region -- a chat composer, a whole conversation viewport, any panel larger than a single control -- and makes the entire region a file-drop target: it owns the drag-session state, renders a themeable drag-over overlay, applies accept/size/count limits, and emits the same `lr-files` event shape `lr-file-input` does.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function logFiles(logId: string) {
  return (e: CustomEvent<LyraDropZoneFilesDetail>) => {
    const out = document.getElementById(logId);
    if (!out) return;
    const accepted = e.detail.files.map((f) => f.name).join(', ') || '(none)';
    const rejected = e.detail.rejected.map((r) => `${r.file.name} (${r.reason})`).join(', ') || '(none)';
    out.textContent = `accepted=[${accepted}] rejected=[${rejected}]`;
  };
}

/** Wraps an arbitrary panel -- here a stand-in "chat surface" -- with no file input anywhere in
 *  the tree. Drop any file onto the panel. */
export const RegionWrapper: Story = {
  render: () => html`
    <lr-drop-zone @lr-files=${logFiles('region-log')} style="display:block; max-inline-size: 32rem;">
      <div style="border: 1px solid var(--lr-color-border); border-radius: var(--lr-radius); padding: 1.5rem; min-block-size: 10rem;">
        <p style="margin-block-start:0;">Chat surface stand-in. Drop files anywhere in this panel.</p>
        <textarea placeholder="Message…" style="inline-size:100%; box-sizing:border-box;"></textarea>
      </div>
    </lr-drop-zone>
    <p id="region-log" style="margin-top:0.5rem; font: 0.8125rem monospace;">accepted=[] rejected=[]</p>
  `,
};

/** `accept`, `max-files`, and `max-total-size` mirror `lr-file-input`'s own limits and reuse its
 *  localized rejection-UI shape. */
export const WithLimits: Story = {
  render: () => html`
    <lr-drop-zone
      accept="image/*"
      max-files="3"
      max-total-size="2000000"
      @lr-files=${logFiles('limits-log')}
      style="display:block; max-inline-size: 24rem;"
    >
      <div style="border: 1px solid var(--lr-color-border); border-radius: var(--lr-radius); padding: 1.5rem;">
        Drop up to 3 images, 2 MB total.
      </div>
    </lr-drop-zone>
    <p id="limits-log" style="margin-top:0.5rem; font: 0.8125rem monospace;">accepted=[] rejected=[]</p>
  `,
};

/** Composing `lr-file-input` inside the wrapped region gives that region both a click-to-browse
 *  picker and a drop target that covers the whole surrounding panel. */
export const WrappingFileInput: Story = {
  render: () => html`
    <lr-drop-zone @lr-files=${logFiles('composed-log')} style="display:block; max-inline-size: 28rem;">
      <div style="border: 1px solid var(--lr-color-border); border-radius: var(--lr-radius); padding: 1.5rem;">
        <p style="margin-block-start:0;">Drop anywhere in this panel, or use the picker below.</p>
        <lr-file-input></lr-file-input>
      </div>
    </lr-drop-zone>
    <p id="composed-log" style="margin-top:0.5rem; font: 0.8125rem monospace;">accepted=[] rejected=[]</p>
  `,
};

/** `size` scales the overlay's padding, icon and instructional text -- identical scale to
 *  `lr-file-input`'s own `size` -- so a drop-zone can match a neighboring compact `lr-file-input`
 *  in the same dense layout. Drag a file over each panel to see the overlay at that tier. */
export const SizeLadder: Story = {
  render: () => html`
    <div style="display:grid; gap:1rem; max-width:32rem;">
      ${(['s', 'm', 'l'] as const).map(
        (size) => html`<lr-drop-zone size=${size} style="display:block;">
          <div style="border: 1px solid var(--lr-color-border); border-radius: var(--lr-radius); padding: 1rem;">
            size="${size}"
          </div>
        </lr-drop-zone>`,
      )}
    </div>
  `,
};

/** `disabled` suppresses drag/drop handling entirely; the wrapped content keeps its own
 *  interactivity. */
export const Disabled: Story = {
  render: () => html`
    <lr-drop-zone disabled @lr-files=${logFiles('disabled-log')} style="display:block; max-inline-size: 24rem;">
      <div style="border: 1px solid var(--lr-color-border); border-radius: var(--lr-radius); padding: 1.5rem;">
        Dropping here does nothing while disabled.
      </div>
    </lr-drop-zone>
    <p id="disabled-log" style="margin-top:0.5rem; font: 0.8125rem monospace;">accepted=[] rejected=[]</p>
  `,
};
