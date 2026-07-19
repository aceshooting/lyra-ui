import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './stack-trace.js';

const meta: Meta = {
  title: 'StackTrace',
  component: 'lr-stack-trace',
};
export default meta;
type Story = StoryObj;

const jsTrace = [
  "TypeError: Cannot read properties of undefined (reading 'map')",
  '    at renderList (/app/src/list.js:22:18)',
  '    at Object.doThing (/app/src/util.js:10:5)',
  '    at Module._compile (node:internal/modules/cjs/loader:1105:14)',
  '    at Module._extensions..js (node:internal/modules/cjs/loader:1179:10)',
].join('\n');

const chainedTrace = [
  'Error: request failed',
  '    at fetchData (/app/src/api.js:14:11)',
  'Caused by: TypeError: NetworkError when attempting to fetch resource',
  '    at doFetch (/app/src/network.js:8:3)',
].join('\n');

const pythonTrace = [
  'Traceback (most recent call last):',
  '  File "/app/main.py", line 10, in <module>',
  '    run()',
  '  File "/app/main.py", line 4, in run',
  '    raise ValueError("bad")',
  'ValueError: bad',
].join('\n');

export const JavaScript: Story = {
  render: () => html`<lr-stack-trace style="max-width:40rem" .trace=${jsTrace}></lr-stack-trace>`,
};

export const ChainedError: Story = {
  render: () => html`<lr-stack-trace style="max-width:40rem" .trace=${chainedTrace}></lr-stack-trace>`,
};

export const Python: Story = {
  render: () => html`<lr-stack-trace style="max-width:40rem" .trace=${pythonTrace}></lr-stack-trace>`,
};

export const ExpandedFrames: Story = {
  render: () => html`<lr-stack-trace style="max-width:40rem" .trace=${jsTrace} .collapseInternal=${false}></lr-stack-trace>`,
};

export const UnparseableFallback: Story = {
  render: () => html`<lr-stack-trace style="max-width:40rem" trace="raw non-trace text from a weird tool"></lr-stack-trace>`,
};

export const MaxHeight: Story = {
  render: () =>
    html`<lr-stack-trace style="max-width:40rem" .trace=${jsTrace} .collapseInternal=${false} max-height="6rem"></lr-stack-trace>`,
};

export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-stack-trace .trace=${jsTrace}></lr-stack-trace></div>`,
};
