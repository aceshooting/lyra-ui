import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './chat-viewport.js';
import '../../layout/virtual-list/virtual-list.js';
import type { LyraChatViewport } from './chat-viewport.class.js';
import type { LyraVirtualList } from '../../layout/virtual-list/virtual-list.class.js';

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

export const LayoutTokens: Story = {
  render: () => html`
    <div style="block-size:260px;border:1px solid var(--lr-color-border);">
      <lr-chat-viewport
        style="--lr-chat-viewport-padding:var(--lr-space-l);--lr-chat-viewport-gap:var(--lr-space-s);--lr-chat-viewport-content-max-inline-size:28rem"
      >
        ${bubble('Padding, gap and a readable column width come from three tokens.')}
        ${bubble('The column is centred once it is narrower than the viewport.')}
        ${bubble('No ::part() overrides needed.')}
      </lr-chat-viewport>
    </div>
  `,
};

export const SettledStreamingAnnouncements: Story = {
  render: () => {
    const viewport = createRef<LyraChatViewport>();
    const streamReply = (): void => {
      const host = viewport.value;
      if (!host) return;
      const reply = document.createElement('div');
      reply.setAttribute('aria-busy', 'true');
      reply.style.cssText = 'padding:8px 12px;border-radius:8px;background:var(--lr-color-surface-raised);max-width:70%;';
      host.append(reply);
      const words = 'This reply streams in word by word and is announced once, complete.'.split(' ');
      let index = 0;
      const timer = setInterval(() => {
        reply.textContent = words.slice(0, ++index).join(' ');
        if (index >= words.length) {
          clearInterval(timer);
          reply.removeAttribute('aria-busy');
        }
      }, 150);
    };
    return html`
      <div style="block-size:220px;border:1px solid var(--lr-color-border);">
        <lr-chat-viewport ${ref(viewport)} live="polite" live-settle="800">
          ${bubble('Streamed replies are announced with their final text once they settle.')}
        </lr-chat-viewport>
      </div>
      <button type="button" @click=${streamReply}>Stream a reply</button>
    `;
  },
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

export const IconOnlyJump: Story = {
  render: () => html`
    <div style="block-size:200px;max-inline-size:28rem;border:var(--lr-border-width-thin) solid var(--lr-color-border);">
      <lr-chat-viewport
        follow="false"
        jump-icon-only
        style="
          --lr-chat-viewport-jump-bg:var(--lr-color-surface-raised);
          --lr-chat-viewport-jump-border:var(--lr-border-width-thin) solid var(--lr-color-border-subtle);
          --lr-chat-viewport-jump-shadow:var(--lr-shadow-s);
        "
      >
        ${Array.from({ length: 12 }, (_, index) => bubble(`Message ${index + 1}`))}
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

/** The indexed source allocates only the visible message window. */
export const MillionMessageGrowth: Story = {
  render: () => {
    const viewport = createRef<LyraChatViewport>();
    const source = { count: 1_000_000, itemAt: (index: number) => index, keyAt: (index: number) => index };
    return html`
      <button @click=${() => {
        source.count += 1000;
        viewport.value?.querySelector<LyraVirtualList>('lr-virtual-list')?.requestUpdate();
      }}>Append 1,000 messages</button>
      <div style="block-size:320px;border:1px solid var(--lr-color-border)">
        <lr-chat-viewport ${ref(viewport)} unread-start-index="1000000">
          <lr-virtual-list row-height="48" .source=${source}
            .renderItem=${(item: unknown) => bubble(`Message ${Number(item) + 1}`)}
          ></lr-virtual-list>
        </lr-chat-viewport>
      </div>
    `;
  },
};
