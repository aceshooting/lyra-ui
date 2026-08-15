import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './callout.js';
const meta: Meta = {
  title: 'Feedback/Callout',
  component: 'lr-callout',
  tags: ['autodocs'],
  parameters: { docs: { description: { component: 'Unsupported closed-set values normalize consistently from markup and untyped property writes: `variant="brand"`, `size="m"`, `heading-level="3"`, and an omitted `appearance`.' } } },
};
export default meta;
export const Default: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          'Initial content and initially distributed slots render with `aria-live="off"`. Once that staging settles, later content is announced politely (`assertive` for `variant="danger"`); reconnecting stages the existing content again.',
      },
    },
  },
  render: () => html`<lr-callout heading="Update available" heading-level="2"
    >A new release is ready to install.</lr-callout
  >`,
};
export const Dismissible: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          '`open` defaults to true and reflects as a presence attribute. An accepted close sets it to false, removes the semantic region, and hides the host; plain `open="false"` markup is accepted too.',
      },
    },
  },
  render: () => html`<lr-callout variant="warning" heading="Attention" closable
    >Review the pending changes before continuing.</lr-callout
  >`,
};
export const InlineError: StoryObj = {
  name: 'Inline error',
  render: () => html`<lr-callout inline variant="danger"><span slot="icon" aria-hidden="true">!</span>Unable to save changes.</lr-callout>`,
};
export const Appearances: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          '`appearance` controls how much of the active semantic palette is used for fill, border, and text. Leaving it unset preserves the established quiet-fill/loud-edge treatment. An unset `variant` consumes inherited contextual slots, with brand as its standalone fallback.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:0.5rem;">
      <lr-callout>unset appearance — inherited palette or standalone brand fallback</lr-callout>
      ${(['accent', 'filled', 'outlined', 'plain', 'filled-outlined'] as const).map(
        (appearance) => html`
          <lr-callout appearance=${appearance}>
            ${appearance}
          </lr-callout>
        `,
      )}
    </div>
  `,
};
export const Sizes: StoryObj = {
  parameters: {
    docs: {
      description: {
        story:
          "`size` runs the library's shared ladder. Both Web Awesome spellings of a tier work (`s`/`small`, `m`/`medium`, `l`/`large`) with no attribute rewrite.",
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
export const ContextAndHostCss: StoryObj = {
  name: 'Context inheritance and host CSS',
  parameters: {
    docs: {
      description: {
        story:
          'An unset inner callout inherits the danger/xl context for both presentation and update urgency: later text changes use the assertive sink. An explicit attribute or property write — even the same-default `brand`/`m` pair — pins a local mapping; removing it resumes inheritance. Explicit `neutral` maps the neutral palette. The final sibling demonstrates that ordinary host CSS owns the chrome while `base` stays a transparent semantic grid.',
      },
    },
  },
  render: () => html`
    <div style="display:flex; flex-direction:column; gap:var(--lr-space-m);">
      <lr-callout variant="danger" size="xl" heading="Outer context">
        <lr-callout closable>Unset nested callout inherits this semantic tone and density.</lr-callout>
        <lr-callout variant="brand" size="m">Explicit brand/m pins the local defaults.</lr-callout>
        <lr-callout variant="neutral" size="m">Explicit neutral uses the neutral palette.</lr-callout>
      </lr-callout>
      <lr-callout
        style="
          background:var(--lr-color-surface-raised);
          border:var(--lr-border-width-medium) solid var(--lr-color-brand);
          border-radius:var(--lr-radius);
          color:var(--lr-color-text);
          padding:var(--lr-space-l);
        "
      >Ordinary host CSS owns this surface.</lr-callout>
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

export const LocalizedAnnouncementTemplate: StoryObj = {
  name: 'Localized announcement order',
  parameters: {
    docs: {
      description: {
        story:
          'A labeled callout announces later updates through the complete `calloutAnnouncementWithContext` message. This deliberately reversed override proves locales can reorder `{context}` and `{content}` and choose their own punctuation.',
      },
    },
  },
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-s); justify-items: start;">
      <lr-callout
        aria-label="Storage warning"
        .strings=${{ calloutAnnouncementWithContext: '{content} ← {context}' }}
      ><span data-callout-message>Initial storage status</span></lr-callout>
      <button
        @click=${(event: Event) => {
          const message = (event.currentTarget as HTMLElement)
            .parentElement!
            .querySelector<HTMLElement>('[data-callout-message]')!;
          message.textContent = 'Disk is nearly full';
        }}
      >Announce updated storage status</button>
    </div>
  `,
};
