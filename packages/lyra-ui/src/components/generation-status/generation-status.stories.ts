import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './generation-status.js';
import type { LyraGenerationStatus } from './generation-status.js';

const meta: Meta = {
  title: 'GenerationStatus',
  component: 'lyra-generation-status',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A compact, ticking status readout shown alongside an in-progress AI response — elapsed time, token count, and token-throughput, plus a built-in Stop button. Complementary to (and independent of) `<lyra-stream-status>`, which covers connection-health/stall-detection rather than this user-facing metrics readout.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const Static: Story = {
  name: 'Static (host-supplied figures)',
  render: () => html`
    <lyra-generation-status
      active
      started-at=${Date.now() - 12300}
      token-count="340"
      tokens-per-second="27"
    ></lyra-generation-status>
  `,
};

export const ElapsedOnly: Story = {
  name: 'Elapsed only (no token data available yet)',
  render: () => html`<lyra-generation-status active started-at=${Date.now()}></lyra-generation-status>`,
};

export const TokensWithoutThroughput: Story = {
  name: 'Tokens set, throughput not yet derivable (< 1s elapsed)',
  render: () =>
    html`<lyra-generation-status active started-at=${Date.now()} token-count="6"></lyra-generation-status>`,
};

export const OverAMinute: Story = {
  name: 'Elapsed time at/beyond a minute ("Xm Ys")',
  render: () =>
    html`<lyra-generation-status
      active
      started-at=${Date.now() - 83000}
      token-count="1024"
      tokens-per-second="12"
    ></lyra-generation-status>`,
};

export const NoStopButton: Story = {
  name: 'show-stop="false"',
  render: () => html`
    <lyra-generation-status
      active
      started-at=${Date.now() - 4200}
      token-count="88"
      tokens-per-second="21"
      show-stop="false"
    ></lyra-generation-status>
  `,
};

export const LiveDerivedThroughput: Story = {
  name: 'Live demo — derived throughput, no host-supplied rate',
  render: () => {
    function wire(root: HTMLElement): void {
      const status = root.querySelector<LyraGenerationStatus>('lyra-generation-status')!;
      if (status.hasAttribute('data-wired')) return;
      status.setAttribute('data-wired', '');

      status.addEventListener('lyra-stop', () => {
        status.active = false;
      });

      // Simulates a host streaming ~6 tokens/sec, feeding only `token-count`
      // and letting this component derive `tokens-per-second` itself once
      // enough elapsed time has accumulated (see the class doc).
      let tokens = 0;
      const timer = setInterval(() => {
        if (!status.active) {
          clearInterval(timer);
          return;
        }
        tokens += 6;
        status.tokenCount = tokens;
      }, 1000);

      root.querySelector('[data-restart]')!.addEventListener('click', () => {
        tokens = 0;
        status.tokenCount = 0;
        status.startedAt = undefined;
        status.active = false;
        requestAnimationFrame(() => {
          status.active = true;
        });
      });
    }

    return html`
      <div
        style="display:flex; flex-direction:column; gap:0.75rem; align-items:flex-start;"
        @click=${(e: Event) => wire(e.currentTarget as HTMLElement)}
      >
        <lyra-generation-status active></lyra-generation-status>
        <button
          data-restart
          style="font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid #ccc; border-radius:0.375rem; background:#fff; cursor:pointer;"
        >
          Restart
        </button>
        <p style="margin:0; font-size:0.8125rem; color:var(--lyra-color-text-quiet, #6b7280); max-width:28rem;">
          Clicking the built-in Stop button here just pauses the readout (sets <code>active = false</code>) — a
          real host would also cancel its in-flight request. Clicking "Restart" begins a fresh run.
        </p>
      </div>
    `;
  },
};
