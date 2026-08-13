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

const unsafeLocationTrace = [
  'Error: untrusted stack location',
  '    at safe (/app/safe.js:1:1)',
  '    at overflow (/app/overflow.js:9007199254740992:1)',
  '    at malformed (/app/malformed.js:line:column)',
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

export const UnsafeLocations: Story = {
  name: 'Unsafe locations remain raw',
  render: () => html`<lr-stack-trace style="max-width:40rem" .trace=${unsafeLocationTrace} .collapseInternal=${false}></lr-stack-trace>`,
  parameters: {
    docs: {
      description: {
        story: 'Malformed and non-safe-integer locations remain visible but cannot be selected as source-navigation targets.',
      },
    },
  },
};

export const MaxHeight: Story = {
  render: () =>
    html`<lr-stack-trace style="max-width:40rem" .trace=${jsTrace} .collapseInternal=${false} max-height="6rem"></lr-stack-trace>`,
};

export const Narrow320: Story = {
  render: () => html`<div style="max-width:320px"><lr-stack-trace .trace=${jsTrace}></lr-stack-trace></div>`,
};

export const ScopedStateColors: Story = {
  name: 'Scoped state colors',
  render: () => html`
    <lr-stack-trace
      style="
        max-width:40rem;
        --lr-stack-trace-internal-frame-color: var(--lr-color-warning);
        --lr-stack-trace-interactive-color: var(--lr-color-success);
      "
      .trace=${jsTrace}
    ></lr-stack-trace>
  `,
};

export const Compact: Story = {
  name: 'compact (dense error row)',
  render: () => html`
    <div style="max-width:40rem; display:grid; gap:0.75rem;">
      <lr-stack-trace .trace=${jsTrace}></lr-stack-trace>
      <lr-stack-trace compact .trace=${jsTrace}></lr-stack-trace>
    </div>
  `,
  parameters: {
    docs: {
      description: {
        story:
          '`compact` tightens the root padding and between-group spacing for dense contexts. It is a density knob only — the card border, radius and background stay; reach for `frame="plain"` to drop the chrome.',
      },
    },
  },
};

export const PlainInsideCard: Story = {
  name: 'frame="plain" (nested in a bordered host)',
  render: () => html`
    <div
      style="max-width:40rem; border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); background:var(--lr-color-surface); padding:0.75rem;"
    >
      <div style="font-weight:600; margin-block-end:0.5rem;">Tool error</div>
      <lr-stack-trace frame="plain" .trace=${jsTrace}></lr-stack-trace>
    </div>
  `,
  parameters: {
    docs: {
      description: {
        story:
          'With `frame="plain"` the trace drops its own border/background so it doesn\'t double the frame of the `lr-result-card`/`lr-agent-run` it is nested in.',
      },
    },
  },
};
