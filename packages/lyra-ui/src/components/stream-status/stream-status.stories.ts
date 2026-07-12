import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './stream-status.js';
import type { LyraStreamStatus } from './stream-status.js';

const meta: Meta = {
  title: 'StreamStatus',
  component: 'lyra-stream-status',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A streaming-connection status indicator with heartbeat-aware stall detection. The host drives `phase` for `idle`/`connecting`/`streaming`, and calls `recordActivity()` on every real content chunk (never on a transport keep-alive ping) while streaming — go too long without a call and this component declares itself `stalled` on its own, firing `lyra-stall`; a later `recordActivity()` call (or a direct host reassignment) recovers it, firing `lyra-recover`.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

const buttonStyle =
  'font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid #ccc; border-radius:0.375rem; background:#fff; cursor:pointer;';

export const Phases: Story = {
  render: () => html`
    <div style="display:flex; flex-wrap:wrap; gap:1.5rem; align-items:flex-start;">
      <div>
        <p style="margin:0 0 0.375rem; font-size:0.8125rem; color:var(--lyra-color-text-quiet, #6b7280);">idle</p>
        <lyra-stream-status phase="idle"></lyra-stream-status>
      </div>
      <div>
        <p style="margin:0 0 0.375rem; font-size:0.8125rem; color:var(--lyra-color-text-quiet, #6b7280);">
          connecting
        </p>
        <lyra-stream-status phase="connecting"></lyra-stream-status>
      </div>
      <div>
        <p style="margin:0 0 0.375rem; font-size:0.8125rem; color:var(--lyra-color-text-quiet, #6b7280);">
          streaming
        </p>
        <lyra-stream-status phase="streaming"></lyra-stream-status>
      </div>
      <div>
        <p style="margin:0 0 0.375rem; font-size:0.8125rem; color:var(--lyra-color-text-quiet, #6b7280);">stalled</p>
        <lyra-stream-status phase="stalled">
          <button slot="actions" style=${buttonStyle}>Retry</button>
        </lyra-stream-status>
      </div>
    </div>
  `,
};

export const LiveDemo: Story = {
  name: 'Live demo (connect → stream → stall → recover)',
  render: () => {
    function wire(root: HTMLElement): void {
      const status = root.querySelector<LyraStreamStatus>('lyra-stream-status')!;
      const log = root.querySelector<HTMLElement>('[data-log]')!;
      if (status.hasAttribute('data-wired')) return;
      status.setAttribute('data-wired', '');

      const line = (text: string): void => {
        const time = new Date().toLocaleTimeString(undefined, { hour12: false });
        const el = document.createElement('div');
        el.textContent = `${time} — ${text}`;
        log.prepend(el);
      };
      status.addEventListener('lyra-stall', () => line('lyra-stall fired'));
      status.addEventListener('lyra-recover', () => line('lyra-recover fired'));

      root.querySelector('[data-connect]')!.addEventListener('click', () => {
        status.phase = 'connecting';
        line('phase = "connecting"');
        setTimeout(() => {
          status.phase = 'streaming';
          line('phase = "streaming"');
        }, 600);
      });
      root.querySelector('[data-activity]')!.addEventListener('click', () => {
        status.recordActivity();
        line('recordActivity() called');
      });
      root.querySelector('[data-stop]')!.addEventListener('click', () => {
        status.phase = 'idle';
        line('phase = "idle" (host stopped the stream)');
      });
    }

    return html`
      <div
        style="display:flex; flex-direction:column; gap:0.75rem; max-width:28rem;"
        @click=${(e: Event) => wire(e.currentTarget as HTMLElement)}
      >
        <lyra-stream-status stall-threshold-ms="2000">
          <button slot="actions" style=${buttonStyle} data-stop>Stop</button>
        </lyra-stream-status>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button style=${buttonStyle} data-connect>Connect</button>
          <button style=${buttonStyle} data-activity>Record activity</button>
        </div>
        <p style="margin:0; font-size:0.8125rem; color:var(--lyra-color-text-quiet, #6b7280);">
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
    <lyra-stream-status phase="stalled">
      Taking longer than usual — the model may be thinking through a complex request.
      <button slot="actions" style=${buttonStyle}>Cancel</button>
      <button slot="actions" style=${buttonStyle}>Retry</button>
    </lyra-stream-status>
  `,
};

export const DefaultStalledMessage: Story = {
  name: 'Default stalled message (nothing slotted)',
  render: () => html`
    <lyra-stream-status phase="stalled">
      <button slot="actions" style=${buttonStyle}>Retry</button>
    </lyra-stream-status>
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
  render: () => html`<lyra-stream-status phase="streaming"></lyra-stream-status>`,
};
