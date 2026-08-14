import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';
import './live-region.js';
import type { LyraLiveRegion } from './live-region.js';

const meta: Meta = {
  title: 'LiveRegion',
  component: 'lr-live-region',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          "`<lr-live-region>` is invisible by design (screen-reader only) and throttles/coalesces announcements instead of relaying every `announce()` call verbatim. Announcements land in a shared, visually hidden region in the page's light DOM (a live region inside a shadow root is not reliably announced); these stories mirror that region into a visible log so the throttling/coalescing behavior is observable without a screen reader running.",
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** Wires a MutationObserver over the shared light-DOM region the announcements really land in,
 *  mirroring each addition into a visible log -- purely for these demos; a real consumer has no
 *  need for this, it just calls `announce()`. */
function wireLog(root: HTMLElement): (() => void) | undefined {
  const region = root.querySelector<LyraLiveRegion>('lr-live-region');
  const log = root.querySelector<HTMLElement>('[data-log]');
  if (!region || !log || region.hasAttribute('data-observed')) return undefined;
  region.setAttribute('data-observed', '');
  const owner = root.ownerDocument;
  const sink = owner.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="${region.mode}"]`);
  const MutationObserverCtor = owner.defaultView?.MutationObserver;
  if (!sink || !MutationObserverCtor) {
    region.removeAttribute('data-observed');
    return undefined;
  }
  const observer = new MutationObserverCtor((records) => {
    for (const record of records) {
      for (const added of record.addedNodes) {
        const text = added.textContent ?? '';
        if (!text) continue;
        const line = owner.createElement('div');
        const time = new Date().toLocaleTimeString(undefined, {
          hour12: false,
        });
        line.textContent = `${time} — "${text}"`;
        log.prepend(line);
      }
    }
  });
  observer.observe(sink, { childList: true });
  return () => {
    observer.disconnect();
    region.removeAttribute('data-observed');
  };
}

function logRef(): (root?: Element) => void {
  let cleanup: (() => void) | undefined;
  let generation = 0;
  return (root?: Element) => {
    generation += 1;
    cleanup?.();
    cleanup = undefined;
    if (!(root instanceof HTMLElement)) return;
    const current = generation;
    queueMicrotask(() => {
      if (current === generation && root.isConnected) cleanup = wireLog(root);
    });
  };
}

export const Basic: Story = {
  render: () => {
    const connectLog = logRef();
    return html`
      <div ${ref(connectLog)} style="display:flex; flex-direction:column; gap:0.75rem; max-width:28rem;">
        <lr-live-region mode="polite"></lr-live-region>
        <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
          <button
            @click=${(e: Event) =>
              (e.currentTarget as HTMLElement)
                .closest('div')!
                .querySelector<LyraLiveRegion>('lr-live-region')!
                .announce('3 new messages')}
          >
            Announce "3 new messages"
          </button>
          <button
            @click=${(e: Event) =>
              (e.currentTarget as HTMLElement)
                .closest('div')!
                .querySelector<LyraLiveRegion>('lr-live-region')!
                .announce('3 new messages')}
          >
            Announce the same text again
          </button>
        </div>
        <p style="margin:0; font-size:0.8125rem; color:var(--lr-color-text-quiet);">
          The region itself is screen-reader-only; this log mirrors every real (post-throttle) announcement so the "same
          text twice announces twice" behavior is visible even without a screen reader.
        </p>
        <div
          data-log
          style="display:flex; flex-direction:column; gap:0.25rem; font-family:monospace; font-size:0.8125rem;"
        ></div>
      </div>
    `;
  },
};

export const ThrottledStream: Story = {
  render: () => {
    const connectLog = logRef();
    return html`
      <div ${ref(connectLog)} style="display:flex; flex-direction:column; gap:0.75rem; max-width:28rem;">
        <lr-live-region mode="polite" throttle-ms="400"></lr-live-region>
        <button
          @click=${(e: Event) => {
            const wrap = (e.currentTarget as HTMLElement).closest('div')!;
            const region = wrap.querySelector<LyraLiveRegion>('lr-live-region')!;
            const words = 'Here is a response streaming in one word at a time from the model'.split(' ');
            let text = '';
            words.forEach((word, i) => {
              setTimeout(() => {
                text += (text ? ' ' : '') + word;
                // Every chunk calls announce() -- exactly the naive, spammy
                // pattern this component exists to absorb.
                region.announce(text);
                if (i === words.length - 1) {
                  // The final chunk always lands even mid-throttle-window.
                  region.announce(`${text} (response complete)`, {
                    force: true,
                  });
                }
              }, i * 90);
            });
          }}
        >
          Simulate a streaming response
          (${'Here is a response streaming in one word at a time from the model'.split(' ').length} chunks, 90ms apart)
        </button>
        <p style="margin:0; font-size:0.8125rem; color:var(--lr-color-text-quiet);">
          Every word above calls <code>announce()</code>, but at a 400ms throttle only a handful of coalesced flushes
          actually reach the log — ending with a forced, always-delivered "response complete".
        </p>
        <div
          data-log
          style="display:flex; flex-direction:column; gap:0.25rem; font-family:monospace; font-size:0.8125rem;"
        ></div>
      </div>
    `;
  },
};

export const AssertiveMode: Story = {
  render: () => {
    const connectLog = logRef();
    return html`
      <div ${ref(connectLog)} style="display:flex; flex-direction:column; gap:0.75rem; max-width:28rem;">
        <lr-live-region mode="assertive"></lr-live-region>
        <button
          @click=${(e: Event) =>
            (e.currentTarget as HTMLElement)
              .closest('div')!
              .querySelector<LyraLiveRegion>('lr-live-region')!
              .announce('Connection lost — retrying…', { force: true })}
        >
          Announce an urgent error (role="alert")
        </button>
        <div
          data-log
          style="display:flex; flex-direction:column; gap:0.25rem; font-family:monospace; font-size:0.8125rem;"
        ></div>
      </div>
    `;
  },
};
