import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './details.js';

const meta: Meta = { title: 'Disclosure/Details', component: 'lr-details', tags: ['autodocs'] };
export default meta;
export const Default: StoryObj = { render: () => html`<lr-details summary="More information">Additional details.</lr-details>` };

export const Sizes: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          "`size` runs the library's shared ladder. Both spellings of a tier work (`s`/`small`, `m`/`medium`, `l`/`large`), so markup migrated from Web Awesome or Shoelace needs no attribute rewrite.",
      },
    },
  },
  render: () => html`
    <div style="inline-size:24rem">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) =>
          html`<lr-details size=${size} summary=${`Size "${size}"`}
            >The panel and its summary both take the tier's rhythm.</lr-details
          >`,
      )}
    </div>
  `,
};

export const Lifecycle: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'Opening emits `lr-show` (cancelable), then `lr-toggle`, then `lr-after-show`; closing mirrors it. Because the native `<details>` toggle is intercepted, a vetoed `lr-show` cannot leave the panel visually expanded.',
      },
    },
  },
  render: () => html`
    <lr-details
      summary="Vetoes the first open attempt"
      @lr-show=${(event: Event) => {
        const el = event.currentTarget as HTMLElement & { dataset: DOMStringMap };
        if (el.dataset['refused']) return;
        el.dataset['refused'] = 'yes';
        event.preventDefault();
      }}
    >
      The first click is refused by an <code>lr-show</code> listener; the second one opens the panel.
    </lr-details>
  `,
};
