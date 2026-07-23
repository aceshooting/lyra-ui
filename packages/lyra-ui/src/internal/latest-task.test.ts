import { expect } from '@open-wc/testing';
import { LatestTask } from './latest-task.js';

it('accepts only the newest token and can invalidate outstanding work', () => {
  const task = new LatestTask();
  const first = task.next();
  const second = task.next();
  expect(task.isCurrent(first)).to.be.false;
  expect(task.isCurrent(second)).to.be.true;
  task.invalidate();
  expect(task.isCurrent(second)).to.be.false;
});

