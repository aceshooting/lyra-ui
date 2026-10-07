import { fixture, expect, html } from '@open-wc/testing';
import './transcript-feed.js';
import { expectDevWarning } from '../../../../test/expected-dev-warnings.js';
import { collectionTruncationWarningKey } from '../../../internal/collection-snapshot.js';
import type { LyraTranscriptFeed } from './transcript-feed.js';

describe('jump action focus destination', () => {
  for (const moveOutside of [false, true]) {
    it(moveOutside ? 'preserves focus moved outside by a follow listener' : 'moves the removed focused jump action to the scroll base', async () => {
      const wrapper = await fixture<HTMLDivElement>(html`<div>
        <lr-transcript-feed .follow=${false} .entries=${[{ id: 'one', text: 'Latest words' }]}></lr-transcript-feed>
        <button id="outside">Other work</button>
      </div>`);
      const feed = wrapper.querySelector<LyraTranscriptFeed>('lr-transcript-feed')!;
      const outside = wrapper.querySelector<HTMLButtonElement>('#outside')!;
      const base = feed.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
      const jump = feed.shadowRoot!.querySelector<HTMLButtonElement>('[part="jump-button"]')!;
      let follows = 0;
      feed.addEventListener('lr-follow-change', () => {
        follows++;
        if (moveOutside) outside.focus();
      });
      jump.focus();
      jump.click();
      await feed.updateComplete;
      await Promise.resolve();
      expect(feed.follow).to.be.true;
      expect(follows).to.equal(1);
      expect(feed.shadowRoot!.querySelector('[part="jump-button"]') === null).to.be.true;
      expect(moveOutside ? document.activeElement === outside : feed.shadowRoot!.activeElement === base).to.be.true;
    });
  }
});

it('keeps the newest entries past the collection limit', () => {
  expectDevWarning(collectionTruncationWarningKey('lr-transcript-feed', 'entries'));
  const feed = document.createElement('lr-transcript-feed') as LyraTranscriptFeed;
  feed.entries = Array.from({ length: 10_005 }, (_, i) => ({ id: String(i), text: `line ${i}` }));
  expect(feed.entries.at(-1)?.id).to.equal('10004');
});

it('renders only string speakers', async () => {
  const branded = { _$litType$: 1, strings: ['x'], values: [] } as unknown as string;
  const feed = await fixture<LyraTranscriptFeed>(html`<lr-transcript-feed
    .entries=${[{ id: 'a', text: 'Hi', speaker: branded }, { id: 'b', text: 'Hello', speaker: 'Ada' }]}
  ></lr-transcript-feed>`);
  expect([...feed.shadowRoot!.querySelectorAll('[part="speaker"]')].map((node) => node.textContent)).to.deep.equal(['Ada']);
});

it('does not format timestamps it does not show', async () => {
  let calls = 0;
  const feed = await fixture<LyraTranscriptFeed>(html`<lr-transcript-feed
    .formatTimestamp=${() => String(++calls)}
    .entries=${[{ id: 'a', text: 'Hi', timestamp: 0 }]}
  ></lr-transcript-feed>`);
  feed.entries = [{ id: 'a', text: 'Hi again', timestamp: 0 }];
  await feed.updateComplete;
  expect(calls).to.equal(0);
});
