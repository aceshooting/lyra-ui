import { fixture, expect } from '@open-wc/testing';
import { MicrophoneIconAliases, HitFloorWithCustomIcon } from './push-to-talk.stories.js';
import type { LyraPushToTalk } from './push-to-talk.js';

describe('push-to-talk purpose icon examples', () => {
  for (const [name, story] of Object.entries({ MicrophoneIconAliases, HitFloorWithCustomIcon })) {
    it(`${name} renders every supplied idle icon through microphone-icon`, async () => {
      const root = await fixture<HTMLElement>(story.render!({}, null as never));
      const hosts = root.matches('lr-push-to-talk') ? [root] : Array.from(root.querySelectorAll('lr-push-to-talk'));
      for (const host of hosts as LyraPushToTalk[]) {
        await host.updateComplete;
        const icon = host.querySelector<HTMLElement>('[slot]')!;
        expect(icon.assignedSlot?.name).to.equal('microphone-icon');
        expect(icon.getClientRects().length).to.be.greaterThan(0);
        const trigger = host.shadowRoot!.querySelector<HTMLElement>('[part="trigger"]')!;
        expect(trigger.getBoundingClientRect().width).to.be.at.least(24);
        expect(trigger.getBoundingClientRect().height).to.be.at.least(24);
      }
    });
  }
});
