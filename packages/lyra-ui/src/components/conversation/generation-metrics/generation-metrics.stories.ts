import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import './generation-metrics.js';
import type { LyraGenerationMetrics } from './generation-metrics.js';

const meta: Meta = {
  title: 'GenerationMetrics',
  component: 'lr-generation-metrics',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A compact, ticking status readout shown alongside an in-progress AI response — elapsed time, token count, and token-throughput, plus a built-in Stop button. Complementary to (and independent of) `<lr-stream-status>`, which covers connection-health/stall-detection rather than this user-facing metrics readout.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Static: Story = {
  name: 'Static (host-supplied figures)',
  render: () => html`
    <lr-generation-metrics
      status="running"
      started-at=${Date.now() - 12300}
      token-count="340"
      tokens-per-second="27"
    ></lr-generation-metrics>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px), long localized metrics',
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%;">
      <lr-generation-metrics
        style="inline-size:100%"
        status="running"
        started-at=${Date.now() - 83000}
        token-count="999999999999"
        tokens-per-second="999999.9"
        .strings=${{
          generationStatusTokensCount:
            'AnExtremelyLongLocalizedTokenDescriptionWithoutNaturalBreaks {count}',
          generationStatusThroughput:
            'AnExtremelyLongLocalizedThroughputDescriptionWithoutNaturalBreaks {rate}',
        }}
      ></lr-generation-metrics>
    </div>
  `,
};

export const ElapsedOnly: Story = {
  name: 'Elapsed only (no token data available yet)',
  render: () => html`<lr-generation-metrics status="running" started-at=${Date.now()}></lr-generation-metrics>`,
};

export const TokensWithoutThroughput: Story = {
  name: 'Tokens set, throughput not yet derivable (< 1s elapsed)',
  render: () =>
    html`<lr-generation-metrics status="running" started-at=${Date.now()} token-count="6"></lr-generation-metrics>`,
};

export const OverAMinute: Story = {
  name: 'Elapsed time at/beyond a minute ("Xm Ys")',
  render: () =>
    html`<lr-generation-metrics
      status="running"
      started-at=${Date.now() - 83000}
      token-count="1024"
      tokens-per-second="12"
    ></lr-generation-metrics>`,
};

/**
 * `showStop` demonstrated here via a `.showStop` property binding rather
 * than a `show-stop="false"` attribute string, matching this repo's
 * established convention for this exact class of bug (see
 * `<lr-line-chart>`'s `WithoutBeginAtZero` story): a boolean property that
 * defaults to `true` needs more than Lit's presence-based `type: Boolean`
 * attribute handling to ever be turned off via a plain attribute string --
 * the attribute's mere *presence*, not its string value, is what that
 * default handling reads, so `show-stop="false"` would otherwise still
 * render the button. `showStop` also has its own string-aware converter
 * (see this component's source) so `show-stop="false"` works correctly too,
 * for a plain-HTML/non-Lit consumer with no way to write a property
 * binding -- but the `.showStop` binding shown here is the form guaranteed
 * to work for *any* boolean property, converter or not, so it stays the
 * convention for this story.
 */
export const NoStopButton: Story = {
  name: 'No stop button (show-stop off)',
  render: () => html`
    <lr-generation-metrics
      status="running"
      started-at=${Date.now() - 4200}
      token-count="88"
      tokens-per-second="21"
      .showStop=${false}
    ></lr-generation-metrics>
  `,
};

export const LiveDerivedThroughput: Story = {
  name: 'Live demo — derived throughput, no host-supplied rate',
  render: () => {
    let status: LyraGenerationMetrics | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const retireTimer = (): void => {
      if (timer !== undefined) clearInterval(timer);
      timer = undefined;
    };
    const start = (): void => {
      retireTimer();
      const current = status;
      if (!current?.isConnected) return;
      current.tokenCount = 0;
      current.startedAt = Date.now();
      current.status = 'running';
      // The host supplies only the token count; throughput is derived by the component.
      timer = setInterval(() => {
        if (!current.isConnected || current.status !== 'running') {
          retireTimer();
          return;
        }
        current.tokenCount = (current.tokenCount ?? 0) + 6;
      }, 1000);
    };
    const attach = (element?: Element): void => {
      retireTimer();
      status = element as LyraGenerationMetrics | undefined;
      if (element) queueMicrotask(() => { if (status === element) start(); });
    };
    const stop = (): void => {
      retireTimer();
      if (status) status.status = 'complete';
    };

    return html`
      <div
        style="display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start;"
      >
        <lr-generation-metrics ${ref(attach)} status="running" @lr-stop=${stop}></lr-generation-metrics>
        <button
          data-restart
          @click=${start}
          style="font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid var(--lr-color-border); border-radius:0.375rem; background:var(--lr-color-surface); cursor:pointer;"
        >
          Restart
        </button>
        <p style="margin:0; font-size:0.8125rem; color:var(--lr-color-text-quiet); max-width:28rem;">
          Clicking the built-in Stop button here completes and freezes the readout (sets
          <code>status = 'complete'</code>) — a
          real host would also cancel its in-flight request. Clicking "Restart" begins a fresh run and retires the previous token timer. Token updates begin as soon as this example mounts.
        </p>
      </div>
    `;
  },
};
