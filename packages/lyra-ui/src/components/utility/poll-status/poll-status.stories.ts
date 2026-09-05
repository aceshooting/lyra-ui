import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import './poll-status.js';
import type { LyraPollStatus } from './poll-status.js';

const meta: Meta = {
  title: 'PollStatus',
  component: 'lr-poll-status',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'A "next scheduled refresh" countdown with a built-in pause control. Set `next-in-ms` to (re)start a locale-formatted `M:SS` display counting down to the next scheduled action; it shows "Refreshing…" once it reaches zero and fires `lr-poll-due`. A built-in pause/resume button freezes the countdown and suppresses `lr-poll-due` while `paused`, firing `lr-pause-change` and announcing the transition through an internal live region. Setting `active="false"` shows a localized inactive state and disables the pause action.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

export const ShortCountdown: Story = {
  name: 'Short countdown (10s)',
  render: () => html`<lr-poll-status next-in-ms="10000"></lr-poll-status>`,
};

export const DueRefreshing: Story = {
  name: 'Due / refreshing state',
  render: () => html`<lr-poll-status next-in-ms="1"></lr-poll-status>`,
};

export const Inactive: Story = {
  render: () => html`<lr-poll-status next-in-ms="10000" active="false"></lr-poll-status>`,
};

export const PauseResume: Story = {
  name: 'Pause / resume',
  render: () => {
    let cleanup: (() => void) | undefined;
    let generation = 0;
    function wire(root?: Element): void {
      generation += 1;
      cleanup?.();
      cleanup = undefined;
      if (!(root instanceof HTMLElement)) return;
      const current = generation;
      queueMicrotask(() => {
        if (current !== generation || !root.isConnected) return;
        const status = root.querySelector<LyraPollStatus>('lr-poll-status')!;
        const log = root.querySelector<HTMLElement>('[data-log]')!;
        const line = (text: string): void => {
          const time = new Date().toLocaleTimeString(undefined, {
            hour12: false,
          });
          const el = root.ownerDocument.createElement('div');
          el.textContent = `${time} — ${text}`;
          log.prepend(el);
        };
        const onPause = (event: Event): void =>
          line(`lr-pause-change: ${(event as CustomEvent<{ paused: boolean }>).detail.paused}`);
        const onDue = (): void => line('lr-poll-due fired');
        const restart = root.querySelector<HTMLElement>('[data-restart]')!;
        const onRestart = (): void => {
          status.restart();
          line('restart() (same 8000ms delay)');
        };
        status.addEventListener('lr-pause-change', onPause);
        status.addEventListener('lr-poll-due', onDue);
        restart.addEventListener('click', onRestart);
        cleanup = () => {
          status.removeEventListener('lr-pause-change', onPause);
          status.removeEventListener('lr-poll-due', onDue);
          restart.removeEventListener('click', onRestart);
        };
      });
    }

    return html`
      <div ${ref(wire)} style="display:flex; flex-direction:column; gap:0.75rem; max-width:28rem;">
        <lr-poll-status next-in-ms="8000"></lr-poll-status>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button
            data-restart
            style="font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid var(--lr-color-border); border-radius:0.375rem; background:var(--lr-color-surface); cursor:pointer;"
          >
            Restart countdown
          </button>
        </div>
        <p style="margin:0; font-size:0.8125rem; color:var(--lr-color-text-quiet);">
          Click the built-in pause button on the countdown above to freeze it, and click again to resume.
        </p>
        <div
          data-log
          style="display:flex; flex-direction:column; gap:0.25rem; font-family:monospace; font-size:0.8125rem;"
        ></div>
      </div>
    `;
  },
};


export const NarrowLongLocalized: Story = {
  name: '320px long localized labels (LTR and RTL)',
  render: () => html`
    <div style="display: grid; gap: var(--lr-space-m);">
      ${(['ltr', 'rtl'] as const).map((direction) => html`
        <div dir=${direction} style="inline-size: 320px; max-inline-size: 100%;">
          <lr-poll-status .active=${false} .strings=${{
            pollInactive: 'Hintergrundaktualisierungsverfügbarkeitsüberprüfung',
          }}></lr-poll-status>
          <lr-poll-status next-in-ms="0" .strings=${{
            pollRefreshing: 'Hintergrundaktualisierungsverfügbarkeitsüberprüfung',
          }}></lr-poll-status>
        </div>
      `)}
    </div>
  `,
};
