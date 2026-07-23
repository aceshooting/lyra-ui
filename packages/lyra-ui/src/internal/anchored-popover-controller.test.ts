import { expect } from '@open-wc/testing';
import { AnchoredPopoverController } from './anchored-popover-controller.js';

it('replaces active positioning cleanup and disconnects idempotently', () => {
  let started = 0;
  let stopped = 0;
  const controller = new AnchoredPopoverController(() => {
    started++;
    return () => { stopped++; };
  });
  const anchor = document.createElement('button');
  const popup = document.createElement('div');
  controller.reposition(anchor, popup);
  controller.reposition(anchor, popup);
  expect(started).to.equal(2);
  expect(stopped).to.equal(1);
  controller.disconnect();
  controller.disconnect();
  expect(stopped).to.equal(2);
});

