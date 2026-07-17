import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './stack-trace.js';

const meta: Meta = {
  title: 'StackTrace',
  component: 'lyra-stack-trace',
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
  render: () => html`<lyra-stack-trace style="max-width:40rem" .trace=${jsTrace}></lyra-stack-trace>`,
};

export const ChainedError: Story = {
  render: () => html`<lyra-stack-trace style="max-width:40rem" .trace=${chainedTrace}></lyra-stack-trace>`,
};

export const Python: Story = {
  render: () => html`<lyra-stack-trace style="max-width:40rem" .trace=${pythonTrace}></lyra-stack-trace>`,
};

export const ExpandedFrames: Story = {
  render: () => html`<lyra-stack-trace style="max-width:40rem" .trace=${jsTrace} .collapseInternal=${false}></lyra-stack-trace>`,
};

export const UnparseableFallback: Story = {
  render: () => html`<lyra-stack-trace style="max-width:40rem" trace="raw non-trace text from a weird tool"></lyra-stack-trace>`,
};

export const MaxHeight: Story = {
  render: () =>
    html`<lyra-stack-trace style="max-width:40rem" .trace=${jsTrace} .collapseInternal=${false} max-height="6rem"></lyra-stack-trace>`,
};

export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lyra-stack-trace .trace=${jsTrace}></lyra-stack-trace></div>`,
};
