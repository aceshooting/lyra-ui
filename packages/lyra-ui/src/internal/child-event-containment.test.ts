import { expect, fixture, html } from '@open-wc/testing';
import {
  BUILDER_CHILD_EVENTS,
  OWNED_CONTROL_EVENTS,
  containShadowChildEvents,
} from './child-event-containment.js';

describe('child event containment', () => {
  const setup = async () => {
    const outer = await fixture<HTMLElement>(html`<div></div>`);
    const root = outer.attachShadow({ mode: 'open' });
    const child = document.createElement('button');
    root.append(child);
    const seen: string[] = [];
    for (const type of ['lr-change-request', 'lr-after-show', 'lr-other']) {
      outer.addEventListener(type, () => seen.push(type));
    }
    const fire = (type: string): void => {
      child.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true }));
    };
    return { root, seen, fire };
  };

  it('keeps contained child events inside the shadow root and lets others through', async () => {
    const { root, seen, fire } = await setup();
    containShadowChildEvents(root, [...BUILDER_CHILD_EVENTS, ...OWNED_CONTROL_EVENTS]);
    fire('lr-change-request');
    fire('lr-after-show');
    fire('lr-other');
    expect(seen.join(',')).to.equal('lr-other');
  });

  it('stops containing once the returned release runs', async () => {
    const { root, seen, fire } = await setup();
    const release = containShadowChildEvents(root, OWNED_CONTROL_EVENTS);
    release();
    fire('lr-change-request');
    expect(seen.join(',')).to.equal('lr-change-request');
  });
});
