import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './qr-code.js';
import { LyraQrCode } from './qr-code.js';

const meta: Meta = {
  title: 'QR Code',
  component: 'lr-qr-code',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Paints modules across the full canvas with a fixed 2× backing store at ordinary sizes. Host color and background-color control paint; the permanent upstream `fill` and `background` properties remain the highest-precedence paint inputs. Add CSS padding when output needs a quiet zone.',
      },
    },
  },
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
  name: 'Host color/background colors',
  render: () => html`
    <lr-qr-code
      value="https://example.com/branded"
      style="color: var(--lr-color-brand); background-color: var(--lr-color-brand-quiet);"
    ></lr-qr-code>
  `,
};

export const CssColorAliases: Story = {
  name: 'CSS color aliases',
  render: () => html`
    <lr-qr-code
      value="https://example.com/aliases"
      style="--lr-qr-code-fill: var(--lr-color-success); --lr-qr-code-background: var(--lr-color-success-quiet);"
    ></lr-qr-code>
  `,
};

export const Preloaded: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'LyraQrCode.preload(): Promise<boolean> primes the shared optional peer before the element connects; generation still begins from the element value.',
      },
    },
  },
  render: () => {
    void LyraQrCode.preload();
    return html`<lr-qr-code value="https://example.com/preloaded"></lr-qr-code>`;
  },
};

export const EmbeddedImage: Story = {
  render: () => html`
    <lr-qr-code
      value="https://example.com/branded"
      image="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect width='64' height='64' rx='12' fill='%230969da'/%3E%3C/svg%3E"
      image-background="white"
      image-coverage="0.35"
      image-padding="4"
      size="180"
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
