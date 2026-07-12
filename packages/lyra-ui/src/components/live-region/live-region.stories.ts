import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { html } from 'lit';
import './live-region.js';
import type { LyraLiveRegion } from './live-region.js';

const meta: Meta = {
  title: 'LiveRegion',
  component: 'lyra-live-region',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '`<lyra-live-region>` is invisible by design (screen-reader only) and throttles/coalesces announcements instead of relaying every `announce()` call verbatim. These stories mirror what actually lands in its shadow DOM into a visible log so the throttling/coalescing behavior is observable without a screen reader running.',
      },
    },
  },
};
export default meta;
type Story = StoryObj;

/** Wires a MutationObserver that mirrors a region's real (coalesced) writes into a visible log,
 *  purely for these demos -- a real consumer has no need for this, it just calls `announce()`. */
function wireLog(root: HTMLElement): void {
  const region = root.querySelector<LyraLiveRegion>('lyra-live-region');
  const log = root.querySelector<HTMLElement>('[data-log]');
  if (!region || !log || region.hasAttribute('data-observed')) return;
  region.setAttribute('data-observed', '');
  const shadow = region.shadowRoot;
  if (!shadow) return;
  const observer = new MutationObserver(() => {
    const text = shadow.textContent ?? '';
    if (!text) return;
    const line = document.createElement('div');
    const time = new Date().toLocaleTimeString(undefined, { hour12: false });
    line.textContent = `${time} — "${text}"`;
    log.prepend(line);
  });
  observer.observe(shadow, { subtree: true, characterData: true, childList: true });
}

export const Basic: Story = {
  render: () => html`
    <div
      style="display:flex; flex-direction:column; gap:0.75rem; max-width:28rem;"
      @click=${(e: Event) => wireLog(e.currentTarget as HTMLElement)}
    >
      <lyra-live-region mode="polite"></lyra-live-region>
      <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
        <button
          @click=${(e: Event) =>
            (e.currentTarget as HTMLElement)
              .closest('div')!
              .querySelector<LyraLiveRegion>('lyra-live-region')!
              .announce('3 new messages')}
        >
          Announce "3 new messages"
        </button>
        <button
          @click=${(e: Event) =>
            (e.currentTarget as HTMLElement)
              .closest('div')!
              .querySelector<LyraLiveRegion>('lyra-live-region')!
              .announce('3 new messages')}
        >
          Announce the same text again
        </button>
      </div>
      <p style="margin:0; font-size:0.8125rem; color:var(--lyra-color-text-quiet, #6b7280);">
        The region itself is screen-reader-only; this log mirrors its real (post-throttle) text so
        the "same text twice" clear-then-reset trick is visible even without a screen reader.
      </p>
      <div data-log style="display:flex; flex-direction:column; gap:0.25rem; font-family:monospace; font-size:0.8125rem;"></div>
    </div>
  `,
};

export const ThrottledStream: Story = {
  render: () => html`
    <div
      style="display:flex; flex-direction:column; gap:0.75rem; max-width:28rem;"
      @click=${(e: Event) => wireLog(e.currentTarget as HTMLElement)}
    >
      <lyra-live-region mode="polite" throttle-ms="400"></lyra-live-region>
      <button
        @click=${(e: Event) => {
          const wrap = (e.currentTarget as HTMLElement).closest('div')!;
          const region = wrap.querySelector<LyraLiveRegion>('lyra-live-region')!;
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
                region.announce(`${text} (response complete)`, { force: true });
              }
            }, i * 90);
          });
        }}
      >
        Simulate a streaming response (${'Here is a response streaming in one word at a time from the model'.split(' ').length} chunks, 90ms apart)
      </button>
      <p style="margin:0; font-size:0.8125rem; color:var(--lyra-color-text-quiet, #6b7280);">
        Every word above calls <code>announce()</code>, but at a 400ms throttle only a handful of
        coalesced flushes actually reach the log — ending with a forced, always-delivered
        "response complete".
      </p>
      <div data-log style="display:flex; flex-direction:column; gap:0.25rem; font-family:monospace; font-size:0.8125rem;"></div>
    </div>
  `,
};

export const AssertiveMode: Story = {
  render: () => html`
    <div
      style="display:flex; flex-direction:column; gap:0.75rem; max-width:28rem;"
      @click=${(e: Event) => wireLog(e.currentTarget as HTMLElement)}
    >
      <lyra-live-region mode="assertive"></lyra-live-region>
      <button
        @click=${(e: Event) =>
          (e.currentTarget as HTMLElement)
            .closest('div')!
            .querySelector<LyraLiveRegion>('lyra-live-region')!
            .announce('Connection lost — retrying…', { force: true })}
      >
        Announce an urgent error (role="alert")
      </button>
      <div data-log style="display:flex; flex-direction:column; gap:0.25rem; font-family:monospace; font-size:0.8125rem;"></div>
    </div>
  `,
};
