import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './thinking-panel.js';
import type { LyraThinkingPanel } from './thinking-panel.js';

const meta: Meta = {
  title: 'ThinkingPanel',
  component: 'lr-thinking-panel',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A collapsible panel for an AI agent\'s intermediate reasoning, distinct from its final response. `mode="live"` shows a pulsing "Thinking…" placeholder and auto-follows new content appended to the default slot while expanded (unless the reader has scrolled up); `mode="post-hoc"` is a static, non-auto-scrolling review of already-finished reasoning. Omit `label` to localize the header; any supplied string, including "Thinking" or an empty string, is a verbatim override.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lr-thinking-panel style="max-width: 32rem;">
      The user is asking about quarterly revenue trends. I should look at the last four quarters and
      identify any seasonal patterns before drawing a conclusion.
    </lr-thinking-panel>
  `,
};

export const PostHocExpanded: Story = {
  name: 'Post-hoc, expanded, with duration',
  render: () => html`
    <lr-thinking-panel mode="post-hoc" expanded duration-ms="4200" style="max-width: 32rem;">
      The user is asking about quarterly revenue trends. I should look at the last four quarters and
      identify any seasonal patterns before drawing a conclusion.
      <br /><br />
      Q1 was flat, Q2 and Q3 both grew roughly 8% quarter over quarter, and Q4 saw a seasonal bump typical
      of this business. Overall trend: steady growth with a predictable Q4 spike.
    </lr-thinking-panel>
  `,
};

export const LivePending: Story = {
  name: 'Live, expanded, still in progress (no duration yet)',
  render: () => html`
    <lr-thinking-panel mode="live" expanded label="Reasoning" style="max-width: 32rem;">
      Weighing a few possible approaches before committing to one…
    </lr-thinking-panel>
  `,
};

export const NarrowLongContent: Story = {
  name: 'Narrow (320px, unbroken content)',
  render: () => html`
    <div style="inline-size:320px;max-inline-size:100%">
      <lr-thinking-panel
        mode="live"
        expanded
        style="--lr-thinking-panel-pending-color: var(--lr-color-warning)"
      >reasoning-${'identifier'.repeat(24)}</lr-thinking-panel>
    </div>
  `,
};

export const Collapsed: Story = {
  render: () => html`
    <lr-thinking-panel mode="post-hoc" duration-ms="820" style="max-width: 32rem;">
      Short reasoning that starts out of view until the header is clicked.
    </lr-thinking-panel>
  `,
};

export const CancelableToggle: Story = {
  name: 'Cancelable toggle proposal',
  render: () => {
    function wire(root: HTMLElement): void {
      const panel = root.querySelector<LyraThinkingPanel>('lr-thinking-panel')!;
      const veto = root.querySelector<HTMLInputElement>('[data-veto]')!;
      const status = root.querySelector<HTMLElement>('[data-status]')!;
      if (panel.hasAttribute('data-wired')) return;
      panel.setAttribute('data-wired', '');
      panel.addEventListener('lr-toggle-request', (event) => {
        status.textContent = `Requested expanded=${event.detail.expanded}`;
        if (veto.checked) {
          event.preventDefault();
          status.textContent += ' (vetoed)';
        }
      });
      panel.addEventListener('lr-toggle', (event) => {
        status.textContent += `; committed expanded=${event.detail.expanded}`;
      });
    }
    return html`
      <div style="display:grid;gap:0.75rem;max-width:32rem" @click=${(event: Event) =>
        wire(event.currentTarget as HTMLElement)}>
        <label><input data-veto type="checkbox" /> Veto the next toggle request</label>
        <lr-thinking-panel>Only accepted proposals change this disclosure.</lr-thinking-panel>
        <p data-status style="margin:0;color:var(--lr-color-text-quiet)">Activate the panel header.</p>
      </div>
    `;
  },
};

export const DensityAndChrome: Story = {
  name: 'compact + frame="plain"',
  render: () => html`
    <div style="display:grid; gap:1rem; max-width:32rem;">
      <lr-thinking-panel expanded>
        Default card framing keeps this reasoning block visually distinct.
      </lr-thinking-panel>
      <lr-thinking-panel compact expanded>
        Compact keeps the card while tightening the header and transcript padding.
      </lr-thinking-panel>
      <div style="border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); padding:0.75rem;">
        <lr-thinking-panel frame="plain" expanded>
          Plain nests in existing message chrome without a second outer frame.
        </lr-thinking-panel>
      </div>
    </div>
  `,
  parameters: {
    docs: {
      description: {
        story:
          'Top to bottom: the default card, `compact` (tighter header/body spacing with chrome intact), and `frame="plain"` inside a container that already supplies the outer border. Plain keeps the panel’s internal disclosure divider.',
      },
    },
  },
};

export const CustomLabel: Story = {
  render: () => html`
    <lr-thinking-panel label="Reasoning" mode="post-hoc" duration-ms="61500" expanded style="max-width: 32rem;">
      A longer chain of reasoning that took over a minute, shown here to demonstrate the
      minutes-and-seconds-free "Xs" duration formatting (identical algorithm to
      lr-tool-call-chip's own duration text).
    </lr-thinking-panel>
  `,
};

export const LiveStreamingDemo: Story = {
  name: 'Live demo (streaming text + auto-scroll, then completes)',
  render: () => {
    const chunks = [
      'The user wants a summary of the incident timeline. ',
      'Let me walk through the log entries in order. ',
      'At 14:02 the first error spike appears in the payments service. ',
      'At 14:05 the on-call engineer was paged. ',
      'At 14:11 a rollback of the previous deploy was initiated. ',
      'At 14:18 error rates returned to baseline. ',
      'I should present this as a short timeline rather than a wall of log lines. ',
      'Drafting the final summary now.',
    ];

    function wire(root: HTMLElement): void {
      const panel = root.querySelector<LyraThinkingPanel>('lr-thinking-panel')!;
      const content = root.querySelector<HTMLElement>('[data-content]')!;
      const status = root.querySelector<HTMLElement>('[data-status]')!;
      if (panel.hasAttribute('data-wired')) return;
      panel.setAttribute('data-wired', '');

      const start = performance.now();
      let i = 0;
      const tick = (): void => {
        if (i >= chunks.length) {
          panel.mode = 'post-hoc';
          panel.durationMs = Math.round(performance.now() - start);
          status.textContent = 'Complete.';
          return;
        }
        content.append(chunks[i]!);
        i++;
        status.textContent = `Streaming… (${i}/${chunks.length})`;
        setTimeout(tick, 350);
      };

      root.querySelector('[data-start]')!.addEventListener('click', () => {
        content.textContent = '';
        // On a second (or later) run, `expanded` is already `true` (a no-op)
        // but `mode` genuinely transitions from 'post-hoc' back to 'live' --
        // that transition alone resets follow and jumps to the
        // latest content, so a reader who scrolled up during the previous
        // run doesn't silently stop auto-following this time.
        panel.mode = 'live';
        panel.durationMs = undefined;
        panel.expanded = true;
        i = 0;
        status.textContent = 'Streaming…';
        setTimeout(tick, 350);
      });
    }

    return html`
      <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:32rem;" @click=${(e: Event) =>
        wire(e.currentTarget as HTMLElement)}>
        <lr-thinking-panel mode="live">
          <span data-content></span>
        </lr-thinking-panel>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <button
            data-start
            style="font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); background:var(--lr-color-surface); cursor:pointer;"
          >
            Start streaming
          </button>
          <span data-status style="font-size:0.8125rem; color:var(--lr-color-text-quiet);"></span>
        </div>
        <p style="margin:0; font-size:0.8125rem; color:var(--lr-color-text-quiet);">
          While streaming, scroll the panel up to read earlier lines -- new chunks stop auto-scrolling
          until you scroll back near the bottom yourself.
        </p>
      </div>
    `;
  },
};
