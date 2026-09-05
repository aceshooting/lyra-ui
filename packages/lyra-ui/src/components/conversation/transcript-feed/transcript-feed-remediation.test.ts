import { fixture, expect, html } from '@open-wc/testing';
import './transcript-feed.js';
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
