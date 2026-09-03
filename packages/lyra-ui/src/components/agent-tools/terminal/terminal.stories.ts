import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './terminal.js';
import type { LyraTerminal } from './terminal.class.js';

const meta: Meta = {
  title: 'Terminal',
  component: 'lr-terminal',
};
export default meta;
type Story = StoryObj;

const SAMPLE = [
  '\x1b[32m✓\x1b[0m installed dependencies',
  '\x1b[1mBuilding…\x1b[0m',
  '\x1b[31merror\x1b[0m: TS2322 in src/app.ts:42:5',
  '\x1b[2mdim detail line\x1b[0m',
].join('\n');

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Streamed ANSI sequences may span writes; incomplete control-sequence carry is bounded and recovers cleanly.',
      },
    },
  },
  render: () =>
    html`<lr-terminal
      style="max-width:40rem"
      .content=${SAMPLE}
      copyable
      downloadable
    ></lr-terminal>`,
};

export const StreamingProgressBar: Story = {
  render: () => {
    const termRef = createRef<LyraTerminal>();
    setTimeout(() => {
      let pct = 0;
      const id = setInterval(() => {
        pct += 10;
        termRef.value?.write(`\rProgress: ${pct}%`);
        if (pct >= 100) {
          termRef.value?.write('\nDone.\n');
          clearInterval(id);
        }
      }, 200);
    }, 0);
    return html`<lr-terminal style="max-width:40rem" ${ref(termRef)}></lr-terminal>`;
  },
};

export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-terminal .content=${SAMPLE}></lr-terminal></div>`,
};

export const CompactInsideExistingChrome: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Nested inside a container that already draws a border: `frame="plain"` drops the terminal\'s own card chrome so the box is not doubled, and `compact` tightens the toolbar and line padding for a dense transcript row.',
      },
    },
  },
  render: () => html`
    <div
      style="max-width:40rem;border:1px solid var(--lr-color-border);border-radius:var(--lr-radius);background:var(--lr-color-surface);padding:var(--lr-space-s)"
    >
      <lr-terminal compact frame="plain" copyable downloadable .content=${SAMPLE}></lr-terminal>
    </div>
  `,
};

export const SurfaceAndInteractionTokens: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'The terminal surface also supplies inverse ANSI text with no explicit background. Hover and press the toolbar or a regular output line to inspect the independently inherited interaction hooks.',
      },
    },
  },
  render: () => html`
    <lr-terminal
      style="max-width:40rem;--lr-terminal-surface-color:var(--lr-color-surface);--lr-terminal-toolbar-button-hover-bg:var(--lr-color-success-quiet);--lr-terminal-toolbar-button-active-bg:var(--lr-color-success);--lr-terminal-line-hover-bg:var(--lr-color-warning-quiet);--lr-terminal-line-active-bg:var(--lr-color-warning)"
      .content=${'\x1b[7mInverse ANSI fallback uses the terminal surface.\x1b[0m\nHover or press this ordinary output line.'}
      copyable
      downloadable
    ></lr-terminal>
  `,
};
