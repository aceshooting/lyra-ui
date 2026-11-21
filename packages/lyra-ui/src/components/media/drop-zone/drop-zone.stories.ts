import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import '../../lr-drop-zone.js';
import type { LyraDropZoneFilesDetail } from '../../lr-drop-zone.js';

const meta: Meta = {
  title: 'DropZone',
  component: 'lr-drop-zone',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A drag-and-drop region wrapper with no file input of its own. Wraps an arbitrary region -- a chat composer, a whole conversation viewport, any panel larger than a single control -- and makes the entire region a file-drop target: it owns the drag-session state, renders a themeable drag-over overlay, applies accept/size/count limits, and emits the same `lr-files` event shape `lr-file-input` does. Set `for` (an id) or `target` (an element) to attach to an existing region instead of wrapping it.',
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
/** `for` attaches the zone to a region that already exists in the page instead of wrapping it:
 *  the static markup keeps its own layout tree, the zone adds no box of its own, and the overlay is
 *  laid over the region while a drag is over it. `target` does the same with an element reference. */
export const TargetingAnExistingRegion: Story = {
  name: 'for: attach to an existing region',
  render: () => html`
    <div>
      <section
        id="drop-zone-story-region"
        style="border: 1px solid var(--lr-color-border); border-radius: var(--lr-radius); padding: 1.5rem; min-block-size: 8rem; max-inline-size: 32rem;"
      >
        <p style="margin-block-start:0;">Server-rendered chat area. Drop files anywhere in it.</p>
      </section>
      <lr-drop-zone for="drop-zone-story-region" style="--lr-drop-zone-overlay-z-index: var(--lr-layer-dropdown);" multiple @lr-files=${logFiles('target-log')}></lr-drop-zone>
      <p id="target-log" style="font: 0.8125rem monospace;">(no drop yet)</p>
    </div>
  `,
};

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
 *  `lr-file-input`'s own `size` -- so a drop-zone can match a neighboring small-tier
 *  `lr-file-input` in the same dense layout. Drag a file over each panel to see the overlay at that tier. */
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

export const MultipleFiles: Story = {
  render: () => html`<lr-drop-zone multiple @lr-files=${logFiles('multiple-log')}>
    <p>Drop several files or a folder here.</p>
  </lr-drop-zone><output id="multiple-log"></output>`,
};

export const WithoutRejectionList: Story = {
  render: () => html`<lr-drop-zone without-rejection-list accept=".csv" @lr-files=${logFiles('without-list-log')}>
    <p>Drop a non-CSV file: the application renders the rejection from the event detail.</p>
  </lr-drop-zone><output id="without-list-log"></output>`,
};

export const NarrowRTL: Story = {
  name: 'Narrow 320px (LTR and RTL)',
  parameters: {
    docs: {
      description: {
        story:
          'Exact 320px drop regions in both directions. Drop a non-image file to see the rejection list: a long file name wraps inside the allocation, and under RTL the list indents from the right edge.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-l);">
      ${(['ltr', 'rtl'] as const).map(
        (dir) => html`
          <div dir=${dir} lang=${dir === 'rtl' ? 'ar' : 'en'} style="inline-size: 320px; max-inline-size: 100%;">
            <lr-drop-zone accept="image/*" @lr-files=${logFiles(`narrow-${dir}-log`)}>
              <div style="border: 1px solid var(--lr-color-border); border-radius: var(--lr-radius); padding: var(--lr-space-m); min-block-size: 6rem;">
                ${dir === 'rtl' ? 'أفلت الصور هنا.' : 'Drop images here.'}
              </div>
            </lr-drop-zone>
            <p id=${`narrow-${dir}-log`} style="margin-top:0.5rem; font: 0.8125rem monospace; overflow-wrap: anywhere;">accepted=[] rejected=[]</p>
          </div>
        `
      )}
    </div>
  `,
};
