import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './stream-status.js';
import type { LyraStreamStatus } from './stream-status.js';

const meta: Meta = {
  title: 'StreamStatus',
  component: 'lr-stream-status',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A streaming-connection status indicator with heartbeat-aware stall detection. The host drives `phase` for `idle`/`connecting`/`streaming`, and calls `recordActivity()` on every real content chunk (never on a transport keep-alive ping) while streaming — go too long without a call and this component declares itself `stalled` on its own, firing `lr-stall`; a later `recordActivity()` call (or a direct host reassignment) recovers it, firing `lr-recover`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const buttonStyle =
  'font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid var(--lr-color-border); border-radius:0.375rem; background:var(--lr-color-surface); cursor:pointer;';

export const Phases: Story = {
  render: () => html`
    <div style="display:flex; flex-wrap:wrap; gap:1.5rem; align-items:flex-start;">
      <div>
        <p style="margin:0 0 0.375rem; font-size:0.8125rem; color:var(--lr-color-text-quiet);">idle</p>
        <lr-stream-status phase="idle"></lr-stream-status>
      </div>
      <div>
        <p style="margin:0 0 0.375rem; font-size:0.8125rem; color:var(--lr-color-text-quiet);">
          connecting
        </p>
        <lr-stream-status phase="connecting"></lr-stream-status>
      </div>
      <div>
        <p style="margin:0 0 0.375rem; font-size:0.8125rem; color:var(--lr-color-text-quiet);">
          streaming
        </p>
        <lr-stream-status phase="streaming"></lr-stream-status>
      </div>
      <div>
        <p style="margin:0 0 0.375rem; font-size:0.8125rem; color:var(--lr-color-text-quiet);">stalled</p>
        <lr-stream-status phase="stalled">
          <button slot="actions" style=${buttonStyle}>Retry</button>
        </lr-stream-status>
      </div>
    </div>
  `,
};

export const ThemedPhaseDots: Story = {
  name: 'Themed phase dots (cssprops)',
  parameters: {
    docs: {
      description: {
        story:
          '`--lr-stream-status-dot-color` and `--lr-stream-status-dot-opacity` can be set on an ancestor for a scoped status treatment; direct values on an element take precedence. The unset per-phase defaults remain brand for connecting/streaming and warning for stalled.',
      },
    },
  },
  render: () => html`
    <div
      style="display:flex; flex-wrap:wrap; gap:1.5rem; --lr-stream-status-dot-color:var(--lr-color-success); --lr-stream-status-dot-opacity:0.75;"
    >
      <lr-stream-status phase="connecting"></lr-stream-status>
      <lr-stream-status phase="streaming"></lr-stream-status>
      <lr-stream-status phase="stalled">
        <button slot="actions" style=${buttonStyle}>Retry</button>
      </lr-stream-status>
      <lr-stream-status
        phase="stalled"
        style="--lr-stream-status-dot-color:var(--lr-color-danger); --lr-stream-status-dot-opacity:1;"
      >
        <button slot="actions" style=${buttonStyle}>Direct override</button>
      </lr-stream-status>
    </div>
  `,
};

export const Narrow320: Story = {
  name: 'Narrow (320px), long stalled message and actions',
  render: () => html`
    <div style="inline-size:320px; max-inline-size:100%; box-sizing:border-box; border:1px dashed var(--lr-color-border); padding:8px;">
      <lr-stream-status phase="stalled" style="inline-size:100%;">
        ConnectionRecoveryExplanationWithoutNaturalBreaksConnectionRecoveryExplanationWithoutNaturalBreaks
        <button slot="actions" style=${buttonStyle}>Cancel</button>
        <button slot="actions" style=${buttonStyle}>Retry</button>
      </lr-stream-status>
    </div>
  `,
};

export const LiveDemo: Story = {
  name: 'Live demo (connect → stream → stall → recover)',
  render: () => {
    let connectGeneration = 0;
    const rootFor = (event: Event): HTMLElement =>
      (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-live-demo]')!;
    const line = (root: HTMLElement, text: string): void => {
      const log = root.querySelector<HTMLElement>('[data-log]')!;
      const time = new Date().toLocaleTimeString(undefined, { hour12: false });
      const entry = document.createElement('div');
      entry.textContent = `${time} — ${text}`;
      log.prepend(entry);
    };
    const onConnect = (event: Event): void => {
      const root = rootFor(event);
      const status = root.querySelector<LyraStreamStatus>('lr-stream-status')!;
      const generation = ++connectGeneration;
      status.phase = 'connecting';
      line(root, 'phase = "connecting"');
      setTimeout(() => {
        if (!status.isConnected || generation !== connectGeneration) return;
        status.phase = 'streaming';
        line(root, 'phase = "streaming"');
      }, 600);
    };
    const onActivity = (event: Event): void => {
      const root = rootFor(event);
      root.querySelector<LyraStreamStatus>('lr-stream-status')!.recordActivity();
      line(root, 'recordActivity() called');
    };
    const onStop = (event: Event): void => {
      const root = rootFor(event);
      connectGeneration += 1;
      root.querySelector<LyraStreamStatus>('lr-stream-status')!.phase = 'idle';
      line(root, 'phase = "idle" (host stopped the stream)');
    };

    return html`
      <div
        data-live-demo
        style="display:flex; flex-direction:column; gap:0.75rem; max-width:28rem;"
      >
        <lr-stream-status
          stall-threshold-ms="2000"
          @lr-stall=${(event: Event) => line(rootFor(event), 'lr-stall fired')}
          @lr-recover=${(event: Event) => line(rootFor(event), 'lr-recover fired')}
        >
          <button slot="actions" style=${buttonStyle} data-stop @click=${onStop}>Stop</button>
        </lr-stream-status>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button style=${buttonStyle} data-connect @click=${onConnect}>Connect</button>
          <button style=${buttonStyle} data-activity @click=${onActivity}>Record activity</button>
        </div>
        <p style="margin:0; font-size:0.8125rem; color:var(--lr-color-text-quiet);">
          <code>stall-threshold-ms="2000"</code> here (vs. the real default of 10000) so the demo doesn't
          require a long wait — click Connect, then either keep clicking "Record activity" within 2s of
          each other to stay streaming, or stop clicking and watch it stall on its own.
        </p>
        <div
          data-log
          style="display:flex; flex-direction:column; gap:0.25rem; font-family:monospace; font-size:0.8125rem;"
        ></div>
      </div>
    `;
  },
};

export const CustomStalledMessage: Story = {
  render: () => html`
    <lr-stream-status phase="stalled">
      Taking longer than usual — the model may be thinking through a complex request.
      <button slot="actions" style=${buttonStyle}>Cancel</button>
      <button slot="actions" style=${buttonStyle}>Retry</button>
    </lr-stream-status>
  `,
};

export const DefaultStalledMessage: Story = {
  name: 'Default stalled message (nothing slotted)',
  render: () => html`
    <lr-stream-status phase="stalled">
      <button slot="actions" style=${buttonStyle}>Retry</button>
    </lr-stream-status>
  `,
};

export const ReducedMotion: Story = {
  name: 'Reduced motion (static)',
  parameters: {
    docs: {
      description: {
        story:
          'With `prefers-reduced-motion: reduce` set at the OS/browser level, the `streaming` dot renders its plain resting frame instead of pulsing.',
      },
    },
  },
  render: () => html`<lr-stream-status phase="streaming"></lr-stream-status>`,
};
