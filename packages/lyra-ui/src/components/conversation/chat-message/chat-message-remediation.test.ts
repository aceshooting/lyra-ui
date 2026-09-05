import { fixture, expect, aTimeout } from '@open-wc/testing';
import { WithAvatarBadgesAndActions } from './chat-message.stories.js';

const text = 'Migrating the table component to the new pagination API touches four files; want me to open a PR?';

describe('chat message Copy example', () => {
  for (const outcome of ['fulfilled', 'rejected'] as const) {
    it(`reports only a ${outcome} clipboard operation correctly`, async () => {
      const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
      let fulfill!: () => void;
      let reject!: (reason: unknown) => void;
      const pending = new Promise<void>((resolve, fail) => { fulfill = resolve; reject = fail; });
      const writes: string[] = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText(value: string) { writes.push(value); return pending; },
      } });
      try {
        const host = await fixture<HTMLElement>(WithAvatarBadgesAndActions.render!({}, null as never));
        const details: unknown[] = [];
        host.addEventListener('lr-copy', (event) => details.push((event as CustomEvent).detail));
        const action = host.querySelector<HTMLElement>('[slot="actions"]')!;
        const button = action.shadowRoot?.querySelector<HTMLButtonElement>('button') ?? action;
        button.click();
        await aTimeout(0);
        expect(writes).to.deep.equal([text]);
        expect(details.length).to.equal(0);
        if (outcome === 'fulfilled') fulfill();
        else reject(new DOMException('Copy unavailable', 'NotAllowedError'));
        await aTimeout(0);
        expect(details).to.deep.equal(outcome === 'fulfilled' ? [{ ok: true, text }] : []);
        if (outcome === 'fulfilled') expect(Object.isFrozen(details[0])).to.equal(true);
      } finally {
        fulfill();
        if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
        else Reflect.deleteProperty(navigator, 'clipboard');
      }
    });
  }
});
