import { expect } from '@open-wc/testing';
import { collectInitialSlotAssignment } from './initial-slot-collection.js';

it('calls the collector with the slot when a slot is given', () => {
  const slot = document.createElement('slot');
  let received: HTMLSlotElement | undefined;
  collectInitialSlotAssignment(slot, (s) => {
    received = s;
  });
  expect(received).to.equal(slot);
});

it('is a no-op for a null or undefined slot', () => {
  let calls = 0;
  collectInitialSlotAssignment(null, () => calls++);
  collectInitialSlotAssignment(undefined, () => calls++);
  expect(calls).to.equal(0);
});
