import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
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
    function wire(root: HTMLElement): void {
      const status = root.querySelector<LyraPollStatus>('lr-poll-status')!;
      if (status.hasAttribute('data-wired')) return;
      status.setAttribute('data-wired', '');

      const log = root.querySelector<HTMLElement>('[data-log]')!;
      const line = (text: string): void => {
        const time = new Date().toLocaleTimeString(undefined, { hour12: false });
        const el = document.createElement('div');
        el.textContent = `${time} — ${text}`;
        log.prepend(el);
      };
      status.addEventListener('lr-pause-change', (e) => line(`lr-pause-change: ${(e as CustomEvent).detail}`));
      status.addEventListener('lr-poll-due', () => line('lr-poll-due fired'));

      root.querySelector('[data-restart]')!.addEventListener('click', () => {
        status.nextInMs = 8000;
        line('nextInMs = 8000 (restarted)');
      });
    }

    return html`
      <div
        style="display:flex; flex-direction:column; gap:0.75rem; max-width:28rem;"
        @click=${(e: Event) => wire(e.currentTarget as HTMLElement)}
      >
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
