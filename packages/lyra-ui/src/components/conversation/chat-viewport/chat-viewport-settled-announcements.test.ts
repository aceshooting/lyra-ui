import { aTimeout, expect, fixture, html, waitUntil } from '@open-wc/testing';
import '../../lr-chat-viewport.js';
import '../../lr-chat-message.js';
import '../../lr-streaming-text.js';
import type { LyraChatViewport } from '../../lr-chat-viewport.js';
import type { LyraChatMessage } from '../chat-message/chat-message.class.js';
import type { LyraStreamingText } from '../streaming-text/streaming-text.class.js';
import { sinkTexts } from '../../../../test/announcements.js';

const SETTLE = 60;

async function stream(target: { textContent: string | null }, words: number, everyMs = 20): Promise<string> {
  let text = '';
  for (let index = 0; index < words; index++) {
    text += `word${index} `;
    target.textContent = text;
    await aTimeout(everyMs);
  }
  return text.trim();
}

describe('lr-chat-viewport live-settle', () => {
  it('defaults to null and keeps append-time announcements when unset', async () => {
    const viewport = await fixture<LyraChatViewport>(html`<lr-chat-viewport live="polite"></lr-chat-viewport>`);
    expect(viewport.liveSettle).to.equal(null);
    const row = document.createElement('div');
    row.textContent = 'first token';
    viewport.append(row);
    await waitUntil(() => sinkTexts('polite').includes('first token'), 'append-time text is announced');
    row.textContent = 'first token and the rest';
    await aTimeout(SETTLE * 3);
    expect(sinkTexts('polite')).to.deep.equal(['first token']);
  });

  it('announces a streamed child once, with its final text, after it stops changing', async () => {
    const viewport = await fixture<LyraChatViewport>(
      html`<lr-chat-viewport live="polite" live-settle=${SETTLE}></lr-chat-viewport>`,
    );
    expect(viewport.liveSettle).to.equal(SETTLE);
    const row = document.createElement('div');
    viewport.append(row);
    const final = await stream(row, 8);
    expect(sinkTexts('polite')).to.deep.equal([]);
    await waitUntil(() => sinkTexts('polite').length > 0, 'the settled text is announced', { timeout: 3000 });
    expect(sinkTexts('polite')).to.deep.equal([final]);
    await aTimeout(SETTLE * 3);
    expect(sinkTexts('polite')).to.deep.equal([final]);
  });

  it('holds a message while it reports streaming, then announces its complete content', async () => {
    const viewport = await fixture<LyraChatViewport>(
      html`<lr-chat-viewport live="polite" live-settle=${SETTLE}></lr-chat-viewport>`,
    );
    const message = document.createElement('lr-chat-message') as LyraChatMessage;
    message.messageRole = 'assistant';
    message.status = 'streaming';
    message.textContent = 'Partial';
    viewport.append(message);
    await aTimeout(SETTLE * 5);
    expect(sinkTexts('polite').some((text) => text.includes('Partial'))).to.equal(false);
    message.textContent = 'Partial answer, now complete.';
    message.status = 'sent';
    await waitUntil(
      () => sinkTexts('polite').some((text) => text.includes('Partial answer, now complete.')),
      'the completed reply is announced',
      { timeout: 3000 },
    );
    expect(sinkTexts('polite').filter((text) => text.includes('Partial'))).to.have.length(1);
  });

  it('treats aria-busy and a streaming descendant as unsettled and follows shadow-rendered text', async () => {
    const viewport = await fixture<LyraChatViewport>(
      html`<lr-chat-viewport live="polite" live-settle=${SETTLE}></lr-chat-viewport>`,
    );
    const busy = document.createElement('div');
    busy.setAttribute('aria-busy', 'true');
    busy.textContent = 'Busy reply';
    const wrapper = document.createElement('div');
    const streaming = document.createElement('lr-streaming-text') as LyraStreamingText;
    streaming.streaming = true;
    streaming.content = 'Shadow';
    wrapper.append(streaming);
    viewport.append(busy, wrapper);
    await aTimeout(SETTLE * 5);
    expect(sinkTexts('polite')).to.deep.equal([]);
    busy.removeAttribute('aria-busy');
    await waitUntil(() => sinkTexts('polite').includes('Busy reply'), 'the no-longer-busy child is announced');
    streaming.content = 'Shadow rendered reply';
    streaming.streaming = false;
    await waitUntil(
      () => sinkTexts('polite').some((text) => text.includes('Shadow rendered reply')),
      'the shadow-rendered final text is announced',
      { timeout: 3000 },
    );
    expect(sinkTexts('polite')).to.have.length(2);
  });

  it('announces a message whose markup claims to be busy forever after a bounded wait', async () => {
    const viewport = await fixture<LyraChatViewport>(
      html`<lr-chat-viewport live="polite" live-settle="50"></lr-chat-viewport>`,
    );
    const stuck = document.createElement('div');
    stuck.setAttribute('aria-busy', 'true');
    stuck.textContent = 'Never settles';
    viewport.append(stuck);
    await waitUntil(() => sinkTexts('polite').includes('Never settles'), 'the stuck-busy child is announced', {
      timeout: 9000,
    });
  }).timeout(12000);

  it('drops pending announcements for removed children, live="off", and disconnect', async () => {
    const viewport = await fixture<LyraChatViewport>(
      html`<lr-chat-viewport live="polite" live-settle=${SETTLE}></lr-chat-viewport>`,
    );
    const removed = document.createElement('div');
    removed.textContent = 'Removed';
    viewport.append(removed);
    removed.remove();
    const silenced = document.createElement('div');
    silenced.textContent = 'Silenced';
    viewport.append(silenced);
    await aTimeout(0);
    viewport.live = 'off';
    await viewport.updateComplete;
    viewport.live = 'polite';
    await viewport.updateComplete;
    const detached = document.createElement('div');
    detached.textContent = 'Detached';
    viewport.append(detached);
    await aTimeout(0);
    const parent = viewport.parentNode!;
    viewport.remove();
    await aTimeout(SETTLE * 5);
    parent.append(viewport);
    await aTimeout(SETTLE * 5);
    expect(sinkTexts('polite')).to.deep.equal([]);
  });

  it('never announces a child that stays empty, and announces once text arrives', async () => {
    const viewport = await fixture<LyraChatViewport>(
      html`<lr-chat-viewport live="polite" live-settle=${SETTLE}></lr-chat-viewport>`,
    );
    const row = document.createElement('div');
    viewport.append(row);
    await aTimeout(SETTLE * 5);
    expect(sinkTexts('polite')).to.deep.equal([]);
    row.textContent = 'Late first token';
    await waitUntil(() => sinkTexts('polite').includes('Late first token'), 'late text is announced');
  });

  it('normalizes a non-finite or tiny settle delay instead of disabling the mode', async () => {
    const viewport = await fixture<LyraChatViewport>(
      html`<lr-chat-viewport live="polite" live-settle="soon"></lr-chat-viewport>`,
    );
    expect(Number.isNaN(viewport.liveSettle)).to.equal(true);
    viewport.liveSettle = -5;
    await viewport.updateComplete;
    const row = document.createElement('div');
    row.textContent = 'Clamped';
    viewport.append(row);
    await aTimeout(0);
    expect(sinkTexts('polite')).to.deep.equal([]);
    await waitUntil(() => sinkTexts('polite').includes('Clamped'), 'the clamped delay still settles');
    viewport.removeAttribute('live-settle');
    await viewport.updateComplete;
    expect(viewport.liveSettle).to.equal(null);
  });
});
