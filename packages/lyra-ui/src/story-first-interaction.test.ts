import { expect, fixture, waitUntil } from '@open-wc/testing';
import type { LyraActivityFeed } from './components/agent-tools/activity-feed/activity-feed.class.js';
import type { LyraAgentRun } from './components/agent-tools/agent-run/agent-run.class.js';
import type { LyraThinkingPanel } from './components/agent-tools/thinking-panel/thinking-panel.class.js';
import type { LyraChatViewport } from './components/conversation/chat-viewport/chat-viewport.class.js';
import type { LyraTranscriptFeed } from './components/conversation/transcript-feed/transcript-feed.class.js';

function firstBubblingClick(target: HTMLElement): void {
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
}

it('observes the first bubbling click in the activity-feed live story', async () => {
  const { LiveStreamingDemo } = await import('./components/agent-tools/activity-feed/activity-feed.stories.js');
  const root = (await fixture(LiveStreamingDemo.render!({}, null as never))) as HTMLElement;
  const feed = root.querySelector<LyraActivityFeed>('lr-activity-feed')!;

  firstBubblingClick(root.querySelector<HTMLButtonElement>('[data-start]')!);
  await feed.updateComplete;
  expect(feed.expanded).to.equal(true);
  expect(feed.mode).to.equal('live');
});

it('observes the first bubbling click in the agent-run live story', async () => {
  const { Live } = await import('./components/agent-tools/agent-run/agent-run.stories.js');
  const root = (await fixture(Live.render!({}, null as never))) as HTMLElement;
  const run = root.querySelector<LyraAgentRun>('lr-agent-run')!;
  await run.updateComplete;

  firstBubblingClick(run.shadowRoot!.querySelector<HTMLButtonElement>('[part="retry-button"]')!);
  expect(root.querySelector('[data-log]')!.textContent!.trim()).to.equal('lr-run-retry fired, attempt 1');
});

it('observes the first bubbling click in the cancelable thinking-panel story', async () => {
  const { CancelableToggle } = await import('./components/agent-tools/thinking-panel/thinking-panel.stories.js');
  const root = (await fixture(CancelableToggle.render!({}, null as never))) as HTMLElement;
  const panel = root.querySelector<LyraThinkingPanel>('lr-thinking-panel')!;
  await panel.updateComplete;

  firstBubblingClick(panel.shadowRoot!.querySelector<HTMLButtonElement>('[part="header"]')!);
  await panel.updateComplete;
  expect(panel.expanded).to.equal(true);
  expect(root.querySelector('[data-status]')!.textContent!.trim()).to.equal(
    'Requested expanded=true; committed expanded=true',
  );
});

it('observes the first bubbling click in the streaming thinking-panel story', async () => {
  const { LiveStreamingDemo } = await import('./components/agent-tools/thinking-panel/thinking-panel.stories.js');
  const root = (await fixture(LiveStreamingDemo.render!({}, null as never))) as HTMLElement;
  const panel = root.querySelector<LyraThinkingPanel>('lr-thinking-panel')!;

  firstBubblingClick(root.querySelector<HTMLButtonElement>('[data-start]')!);
  await panel.updateComplete;
  expect(panel.expanded).to.equal(true);
  expect(root.querySelector('[data-status]')!.textContent!.trim()).to.equal('Streaming…');
});

it('observes the first bubbling click in the chat-viewport streaming story', async () => {
  const { StreamingFollow } = await import('./components/conversation/chat-viewport/chat-viewport.stories.js');
  const root = (await fixture(StreamingFollow.render!({}, null as never))) as HTMLElement;
  const viewport = root.querySelector<LyraChatViewport>('lr-chat-viewport')!;
  const initialChildren = viewport.children.length;

  firstBubblingClick(root.querySelector<HTMLButtonElement>('[data-start]')!);
  expect(viewport.children.length).to.equal(initialChildren + 1);
  expect(root.querySelector('[data-status]')!.textContent!.trim()).to.contain('Streaming…');
});

it('observes the first bubbling click in the transcript-feed live story', async () => {
  const { LiveInterimTranscription } = await import('./components/conversation/transcript-feed/transcript-feed.stories.js');
  const root = (await fixture(LiveInterimTranscription.render!({}, null as never))) as HTMLElement;
  const feed = root.querySelector<LyraTranscriptFeed>('lr-transcript-feed')!;

  firstBubblingClick(root.querySelector<HTMLButtonElement>('[data-start]')!);
  await waitUntil(
    () => feed.entries.some((entry) => entry.id === 'live-0' && entry.text === 'Tomorrow' && entry.interim === true),
    'the first live caption was not observed',
    { timeout: 2000 },
  );
});
