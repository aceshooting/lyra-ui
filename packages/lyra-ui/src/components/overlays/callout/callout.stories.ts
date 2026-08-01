import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './callout.js';
const meta: Meta = { title: 'Feedback/Callout', component: 'lr-callout', tags: ['autodocs'] };
export default meta;
export const Dismissible: StoryObj = { render: () => html`<lr-callout variant="warning" heading="Attention" closable>Review the pending changes before continuing.</lr-callout>` };
export const InlineError: StoryObj = {
  name: 'Inline error',
  render: () => html`<lr-callout inline variant="danger"><span slot="icon" aria-hidden="true">!</span>Unable to save changes.</lr-callout>`,
};
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
    <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:start;">
      ${(['2xs', 'xs', 's', 'm', 'l', 'xl'] as const).map(
        (size) =>
          html`<lr-callout size=${size} variant="brand" closable
            ><span slot="icon" aria-hidden="true">i</span>Size "${size}"</lr-callout
          >`,
      )}
    </div>
  `,
};
export const NarrowLongContent: StoryObj = {
  render: () => html`
    <div style="inline-size:20rem">
      <lr-callout
        variant="warning"
        heading="A deliberately long warning heading that must wrap inside a narrow allocation"
        closable
      >
        ThisIsAnUnbrokenDiagnosticTokenThatMustNotPushTheMessageOrCloseControlOutsideTheCallout
      </lr-callout>
    </div>
  `,
};
