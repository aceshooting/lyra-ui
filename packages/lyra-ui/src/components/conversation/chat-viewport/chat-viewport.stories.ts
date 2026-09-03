import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
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

    const viewportRef = createRef<LyraChatViewport>();
    const statusRef = createRef<HTMLElement>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let streaming: HTMLElement | null = null;
    let i = 0;
    const tick = (): void => {
      const status = statusRef.value;
      if (!streaming || !status) {
        timer = undefined;
        return;
      }
      if (i >= words.length) {
        streaming = null;
        status.textContent = 'Done. Scroll up, then click "Stream a reply" again to see the jump pill in action.';
        timer = undefined;
        return;
      }
      streaming.textContent += (i > 0 ? ' ' : '') + words[i];
      i++;
      timer = setTimeout(tick, 120);
    };
    const startStreaming = (): void => {
      const viewport = viewportRef.value;
      const status = statusRef.value;
      if (!viewport || !status) return;
      if (timer !== undefined) clearTimeout(timer);
      const next = viewport.ownerDocument.createElement('div');
      next.style.cssText =
        'padding:8px 12px;border-radius:8px;background:var(--lr-color-surface-raised);max-width:70%;';
      viewport.appendChild(next);
      streaming = next;
      i = 0;
      status.textContent = 'Streaming… try scrolling up to release follow, then use the pill to jump back down.';
      timer = setTimeout(tick, 120);
    };
    const onFollowChange = (event: Event): void => {
      const status = statusRef.value;
      if (!status) return;
      const following = (event as CustomEvent<{ following: boolean }>).detail.following;
      if (!following) status.textContent = 'Follow released — new content no longer auto-scrolls.';
      else if (!streaming) status.textContent = 'Following again.';
    };
    return html`
      <div style="display:flex; flex-direction:column; gap:0.75rem; max-width:28rem;">
        <div style="block-size:220px;border:1px solid var(--lr-color-border);">
          <lr-chat-viewport ${ref(viewportRef)} @lr-follow-change=${onFollowChange}>
            ${bubble('Can you summarize the last deploy?')}
          </lr-chat-viewport>
        </div>
        <button
          data-start
          @click=${startStreaming}
          style="font:inherit; font-size:0.8125rem; padding:0.3rem 0.7rem; border:1px solid var(--lr-color-border); border-radius:var(--lr-radius); background:var(--lr-color-surface); cursor:pointer; align-self:flex-start;"
        >
          Stream a reply
        </button>
        <p ${ref(statusRef)} data-status style="font-size:0.8125rem; color:var(--lr-color-text-quiet); margin:0;">
          Click "Stream a reply" to start.
        </p>
      </div>
    `;
  },
};

/** No `--lr-virtual-list-height` override on the slotted list: in virtual mode the viewport sizes
 *  it to its own bounded height, so the list scrolls over the full 320px pane. A consumer's own
 *  rule or inline style on the list still wins over that. */
export const VirtualMode: Story = {
  render: () => html`
    <div style="block-size:320px;border:1px solid var(--lr-color-border);">
      <lr-chat-viewport>
        <lr-virtual-list
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
