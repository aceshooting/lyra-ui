import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';

const meta: Meta = {
  title: 'QR Code',
  component: 'lr-qr-code',
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`<lr-qr-code value="https://example.com"></lr-qr-code>`,
};

export const LargerWithRoundedModules: Story = {
  name: 'Larger, rounded modules',
  render: () => html`<lr-qr-code value="https://example.com/rounded" size="220" radius="0.35"></lr-qr-code>`,
};

export const LowErrorCorrection: Story = {
  name: 'Low error correction (denser symbol for long values)',
  render: () => html`
    <lr-qr-code
      value="https://example.com/a/very/long/url/that/needs/more/modules/to/encode/at/a/higher/error/correction/level"
      error-correction="L"
      size="180"
    ></lr-qr-code>
  `,
};

export const CustomColors: Story = {
  name: 'Custom fill/background colors',
  render: () => html`
    <lr-qr-code
      value="https://example.com/branded"
      style="--lr-qr-code-fill: var(--lr-color-brand); --lr-qr-code-background: var(--lr-color-brand-quiet);"
    ></lr-qr-code>
  `,
};

export const EmptyLoadingAndError: Story = {
  name: 'Empty, loading, and error states',
  parameters: {
    docs: {
      description: {
        story:
          'The empty state renders with no `value`. The loading and error states normally only appear while the optional `qrcode` peer is first fetched, or when it fails to load/encode -- shown here directly for reference.',
      },
    },
  },
  render: () => html`
    <div style="display: flex; gap: 1rem; align-items: flex-start;">
      <lr-qr-code></lr-qr-code>
    </div>
  `,
};

/** Narrow-allocation evidence: the default 128px size fits comfortably inside a 320px-wide panel. */
export const NarrowContainer: Story = {
  name: 'Narrow (320px) container',
  render: () => html`
    <div style="inline-size: 320px; max-inline-size: 100%; border: 1px dashed var(--lr-color-border); padding: 1rem;">
      <lr-qr-code value="https://example.com"></lr-qr-code>
    </div>
  `,
};
