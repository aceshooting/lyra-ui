import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components';
import './button-group.js';
import '../../forms/button/button.js';

const meta: Meta = {
  title: 'Primitives/Button Group',
  component: 'lr-button-group',
  parameters: {
    docs: {
      description: {
        component:
          '`orientation` uses the package-wide `LyraOrientation` type; the former identical component-local alias is not retained.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-button-group label="Document actions">
    <lr-button variant="brand">Save</lr-button>
    <lr-button>Preview</lr-button>
    <lr-button>Share</lr-button>
  </lr-button-group>`,
};

export const Vertical: Story = {
  render: () => html`<lr-button-group orientation="vertical" label="Account actions">
    <lr-button>Profile</lr-button>
    <lr-button>Preferences</lr-button>
    <lr-button>Sign out</lr-button>
  </lr-button-group>`,
};

export const NarrowAllocation: Story = {
  name: 'Narrow RTL long content (320px)',
  parameters: {
    docs: {
      description: {
        story:
          "At an explicit 320px RTL allocation with long localized labels, the group's own container query (not the viewport) drives the @container rule that stretches and wraps the button row. :host is an inline-flex, shrink-to-fit box with container-type: inline-size always on, so the group needs its own explicit inline-size or it settles at its intrinsic fallback.",
      },
    },
  },
  render: () => html`
    <div
      dir="rtl"
      style="inline-size: 320px; max-inline-size: 100%; border: var(--lr-border-width-thin) dashed var(--lr-color-border); padding: var(--lr-space-s);"
    >
      <lr-button-group label="إجراءات المستند" style="inline-size: 320px; max-inline-size: 100%;">
        <lr-button variant="brand">حفظ-المستند-بالتفاصيل-الكاملة</lr-button>
        <lr-button>معاينة-الإصدار-قبل-النشر</lr-button>
        <lr-button>مشاركة-النتيجة-مع-فريق-العمل</lr-button>
      </lr-button-group>
    </div>
  `,
};
