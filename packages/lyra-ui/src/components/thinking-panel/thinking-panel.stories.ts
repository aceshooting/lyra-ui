import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './thinking-panel.js';
import type { LyraThinkingPanel } from './thinking-panel.js';

const meta: Meta = {
  title: 'ThinkingPanel',
  component: 'lyra-thinking-panel',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A collapsible panel for an AI agent\'s intermediate reasoning, distinct from its final response. `mode="live"` shows a pulsing "Thinking…" placeholder and auto-follows new content appended to the default slot while expanded (unless the reader has scrolled up); `mode="post-hoc"` is a static, non-auto-scrolling review of already-finished reasoning.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => html`
    <lyra-thinking-panel style="max-width: 32rem;">
      The user is asking about quarterly revenue trends. I should look at the last four quarters and
      identify any seasonal patterns before drawing a conclusion.
    </lyra-thinking-panel>
  `,
};

export const PostHocExpanded: Story = {
  name: 'Post-hoc, expanded, with duration',
  render: () => html`
    <lyra-thinking-panel mode="post-hoc" expanded duration-ms="4200" style="max-width: 32rem;">
      The user is asking about quarterly revenue trends. I should look at the last four quarters and
      identify any seasonal patterns before drawing a conclusion.
      <br /><br />
      Q1 was flat, Q2 and Q3 both grew roughly 8% quarter over quarter, and Q4 saw a seasonal bump typical
      of this business. Overall trend: steady growth with a predictable Q4 spike.
    </lyra-thinking-panel>
  `,
};

export const LivePending: Story = {
  name: 'Live, expanded, still in progress (no duration yet)',
  render: () => html`
    <lyra-thinking-panel mode="live" expanded label="Reasoning" style="max-width: 32rem;">
      Weighing a few possible approaches before committing to one…
    </lyra-thinking-panel>
  `,
};

export const Collapsed: Story = {
  render: () => html`
    <lyra-thinking-panel mode="post-hoc" duration-ms="820" style="max-width: 32rem;">
      Short reasoning that starts out of view until the header is clicked.
    </lyra-thinking-panel>
  `,
};

export const CustomLabel: Story = {
  render: () => html`
    <lyra-thinking-panel label="Reasoning" mode="post-hoc" duration-ms="61500" expanded style="max-width: 32rem;">
      A longer chain of reasoning that took over a minute, shown here to demonstrate the
      minutes-and-seconds-free "Xs" duration formatting (identical algorithm to
      lyra-tool-call-chip's own duration text).
    </lyra-thinking-panel>
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
      const panel = root.querySelector<LyraThinkingPanel>('lyra-thinking-panel')!;
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
        // that transition alone resets stick-to-bottom and jumps to the
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
        <lyra-thinking-panel mode="live">
          <span data-content></span>
        </lyra-thinking-panel>
        <div style="display:flex; align-items:center; gap:0.5rem;">
          <button
            data-start
            style="font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid var(--lyra-color-border); border-radius:var(--lyra-radius); background:var(--lyra-color-surface); cursor:pointer;"
          >
            Start streaming
          </button>
          <span data-status style="font-size:0.8125rem; color:var(--lyra-color-text-quiet);"></span>
        </div>
        <p style="margin:0; font-size:0.8125rem; color:var(--lyra-color-text-quiet);">
          While streaming, scroll the panel up to read earlier lines -- new chunks stop auto-scrolling
          until you scroll back near the bottom yourself.
        </p>
      </div>
    `;
  },
};
