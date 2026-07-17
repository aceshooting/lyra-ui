import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './terminal.js';
import type { LyraTerminal } from './terminal.class.js';

const meta: Meta = {
  title: 'Terminal',
  component: 'lyra-terminal',
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
  render: () =>
    html`<lyra-terminal
      style="max-width:40rem"
      .content=${SAMPLE}
      copyable
      downloadable
    ></lyra-terminal>`,
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
    return html`<lyra-terminal style="max-width:40rem" ${ref(termRef)}></lyra-terminal>`;
  },
};

export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lyra-terminal .content=${SAMPLE}></lyra-terminal></div>`,
};
