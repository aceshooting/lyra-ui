import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'FileInput',
  component: 'lr-file-input',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Form-associated file selection with writable `files`, `fileCount`, and `dragging` state. Real file and drag interactions resynchronize the published count and drag state.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-file-input multiple accept=".csv,.xlsx"></lr-file-input>`,
};

export const FormAssociatedSurface: Story = {
  render: () => html`
    <form style="display:grid; gap:var(--lr-space-s); max-inline-size:32rem;">
      <lr-file-input
        name="documents"
        label="Supporting documents"
        hint="PDF or image files, up to the configured upload limit."
        accept="application/pdf,image/*"
        capture="environment"
        multiple
        required
      >
        <span slot="dropzone">Drop documents here or choose files</span>
      </lr-file-input>
      <lr-button type="reset">Reset files</lr-button>
    </form>
  `,
  parameters: {
    docs: {
      description: {
        story:
          'Complete form-associated surface with label/hint chrome, a named `dropzone` slot, required validity, repeated file submission, capture forwarding, reset support, and a writable `validationTarget` for custom validity anchoring.',
      },
    },
  },
};

export const ErrorChrome: Story = {
  render: () => html`
    <lr-file-input
      label="Supporting documents"
      hint="PDF or image files only."
      error-text="Choose at least one supported document."
      required
    ></lr-file-input>
  `,
  parameters: {
    docs: {
      description: {
        story:
          'Owned validation chrome: `error-text` is associated with the semantic dropzone. Rich application error content can use the named `error` slot instead.',
      },
    },
  },
};

export const SlottedErrorSsr: Story = {
  render: () => html`
    <lr-file-input with-error label="Supporting documents" hint="PDF or image files only.">
      <strong slot="error">Choose at least one supported document.</strong>
    </lr-file-input>
  `,
  parameters: {
    docs: {
      description: {
        story:
          '`with-error` preserves initially populated rich `error` slot content through declarative-shadow-DOM SSR before hydration can observe slot assignment.',
      },
    },
  },
};

export const CustomSlotContent: Story = {
  render: () =>
    html`<lr-file-input multiple accept=".csv,.xlsx" label="Upload spreadsheets">
      <strong>Drag spreadsheets here</strong>
      <span>or click to browse (.csv, .xlsx)</span>
    </lr-file-input>`,
};

export const AccessibleNameOverride: Story = {
  render: () => html`
    <lr-file-input aria-label="Upload supporting documents" multiple>
      <strong aria-hidden="true">＋</strong>
    </lr-file-input>
  `,
};

export const Disabled: Story = {
  render: () => html`<lr-file-input disabled accept=".csv,.xlsx"></lr-file-input>`,
};

export const Compact: Story = {
  render: () => html`
    <div style="display:grid; gap:1rem; max-width:32rem;">
      <lr-file-input multiple accept=".csv,.xlsx"></lr-file-input>
      <div style="display:flex; align-items:center; gap:0.5rem;">
        <span style="font-size:0.8125rem; color:var(--lr-color-text-quiet);">Attachments</span>
        <lr-file-input compact multiple accept=".csv,.xlsx" label="Add files" style="flex:1;"></lr-file-input>
      </div>
    </div>
  `,
  parameters: {
    docs: {
      description: {
        story:
          'Default dropzone above, then `compact` inline in a toolbar row where the full `--lr-space-l` dropzone would not fit.',
      },
    },
  },
};
