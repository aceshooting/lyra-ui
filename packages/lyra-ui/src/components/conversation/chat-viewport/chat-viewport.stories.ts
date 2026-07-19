import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './chat-viewport.js';
import '../../layout/virtual-list/virtual-list.js';
import type { LyraChatViewport } from './chat-viewport.class.js';

const meta: Meta = {
  title: 'ChatViewport',
  component: 'lr-chat-viewport',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'The transcript scroll container: stick-to-bottom follow state, a jump-to-latest pill, and an unread divider. Renders no messages itself.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

function bubble(text: string): ReturnType<typeof html> {
  return html`<div
    style="padding:8px 12px;border-radius:8px;background:var(--lr-color-surface-raised);max-width:70%;"
  >
    ${text}
  </div>`;
}

export const SlottedMode: Story = {
  render: () => html`
    <div style="block-size:320px;border:1px solid var(--lr-color-border);">
      <lr-chat-viewport>
        ${bubble('Hello!')} ${bubble('How can I help today?')} ${bubble('Can you summarize the last deploy?')}
        ${bubble('Sure — three services restarted cleanly, error rates are back to baseline.')}
      </lr-chat-viewport>
    </div>
  `,
};

export const PoliteAnnouncements: Story = {
  render: () => html`
    <div style="block-size:220px;border:1px solid var(--lr-color-border);">
      <lr-chat-viewport live="polite">
        ${bubble('Messages added here are announced politely once complete.')}
        ${bubble('Leave live="off" for token-by-token streaming content.')}
      </lr-chat-viewport>
    </div>
  `,
};

export const WithUnreadDivider: Story = {
  render: () => html`
    <div style="block-size:200px;border:1px solid var(--lr-color-border);">
      <lr-chat-viewport unread-start-index="2" .follow=${false}>
        ${bubble('Earlier message 1')} ${bubble('Earlier message 2')} ${bubble('New message 1')}
        ${bubble('New message 2')}
      </lr-chat-viewport>
    </div>
  `,
};

export const StreamingFollow: Story = {
  name: 'Streaming (stick-to-bottom / follow release)',
  render: () => {
    const words = [
      'Sure',
      '—',
      'three',
      'services',
      'restarted',
      'cleanly,',
      'error',
      'rates',
      'are',
      'back',
      'to',
      'baseline,',
      'and',
      'the',
      'deploy',
      'log',
      'has',
      'no',
      'new',
      'warnings.',
    ];

    function wire(root: HTMLElement): void {
      const viewport = root.querySelector<LyraChatViewport>('lr-chat-viewport')!;
      if (viewport.hasAttribute('data-wired')) return;
      viewport.setAttribute('data-wired', '');
      const status = root.querySelector<HTMLElement>('[data-status]')!;
      let streaming: HTMLElement | null = null;
      let i = 0;
      const tick = (): void => {
        if (!streaming) return;
        if (i >= words.length) {
          streaming = null;
          status.textContent = 'Done. Scroll up, then click "Stream a reply" again to see the jump pill in action.';
          return;
        }
        streaming.textContent += (i > 0 ? ' ' : '') + words[i];
        i++;
        setTimeout(tick, 120);
      };
      root.querySelector('[data-start]')!.addEventListener('click', () => {
        const next = document.createElement('div');
        next.style.cssText =
          'padding:8px 12px;border-radius:8px;background:var(--lr-color-surface-raised);max-width:70%;';
        viewport.appendChild(next);
        streaming = next;
        i = 0;
        status.textContent = 'Streaming… try scrolling up to release follow, then use the pill to jump back down.';
        setTimeout(tick, 120);
      });
      viewport.addEventListener('lr-follow-change', (e) => {
        const following = (e as CustomEvent<{ following: boolean }>).detail.following;
        if (!following) status.textContent = 'Follow released — new content no longer auto-scrolls.';
        else if (!streaming) status.textContent = 'Following again.';
      });
    }
    return html`
      <div
        style="display:flex; flex-direction:column; gap:0.75rem; max-width:28rem;"
        @click=${(e: Event) => wire(e.currentTarget as HTMLElement)}
      >
        <div style="block-size:220px;border:1px solid var(--lr-color-border);">
          <lr-chat-viewport>
            ${bubble('Can you summarize the last deploy?')}
          </lr-chat-viewport>
        </div>
        <button
          data-start
          style="font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); background:var(--lr-color-surface); cursor:pointer; align-self:flex-start;"
        >
          Stream a reply
        </button>
        <p data-status style="font-size:0.8125rem; color:var(--lr-color-text-quiet); margin:0;">
          Click "Stream a reply" to start.
        </p>
      </div>
    `;
  },
};

export const VirtualMode: Story = {
  render: () => html`
    <div style="block-size:320px;border:1px solid var(--lr-color-border);">
      <lr-chat-viewport>
        <lr-virtual-list
          style="--lr-virtual-list-height:320px"
          row-height="48"
          .items=${Array.from({ length: 200 }, (_, i) => i)}
          .renderItem=${(item: unknown) => bubble(`Message ${item}`)}
          .keyFunction=${(item: unknown) => item as number}
        ></lr-virtual-list>
      </lr-chat-viewport>
    </div>
  `,
};

export const Narrow320px: Story = {
  name: 'Narrow (320px)',
  render: () => html`
    <div style="max-width:320px;block-size:200px;border:1px dashed var(--lr-color-border);">
      <lr-chat-viewport .follow=${false} unread-start-index="1">
        ${bubble('First message')} ${bubble('A somewhat longer second message to check wrapping behavior')}
      </lr-chat-viewport>
    </div>
  `,
};
