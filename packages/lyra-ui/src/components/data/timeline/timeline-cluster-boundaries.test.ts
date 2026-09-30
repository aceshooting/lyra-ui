import { expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './timeline.js';
import './timeline-item.js';
import type { LyraTimeline } from './timeline.js';
import type { LyraTimelineItem } from './timeline-item.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

it('keeps focus on a surviving cluster representative when new members join and restores its managed hidden marker', async () => {
  const element = await fixture<LyraTimeline>(html`<lr-timeline scale="time" collision="cluster" .rangeStart=${0} .rangeEnd=${1000}>
    <lr-timeline-item id="first" .timestamp=${0}>First</lr-timeline-item>
    <lr-timeline-item id="second" .timestamp=${0}>Second</lr-timeline-item>
    <lr-timeline-item id="last" .timestamp=${1000}>Last</lr-timeline-item>
  </lr-timeline>`);
  const first = element.querySelector<LyraTimelineItem>('#first')!;
  const second = element.querySelector<LyraTimelineItem>('#second')!;
  const last = element.querySelector<LyraTimelineItem>('#last')!;
  await waitUntil(() => first.shadowRoot!.querySelector('[part="cluster"]') !== null);
  const action = first.shadowRoot!.querySelector<HTMLButtonElement>('[part="cluster"]')!;
  await focusByKeyboard(action);
  second.removeAttribute('data-lr-timeline-cluster-hidden');
  last.timestamp = 900;
  await waitUntil(() => second.hasAttribute('data-lr-timeline-cluster-hidden'));
  const added = document.createElement('lr-timeline-item') as LyraTimelineItem;
  added.id = 'added';
  added.timestamp = 0;
  added.textContent = 'Added';
  element.append(added);
  await waitUntil(() => action.textContent!.trim() === '3');
  expect(first.shadowRoot!.activeElement === action).to.equal(true);
  expect(action.matches(':focus-visible')).to.equal(true);
  const pending = oneEvent(element, 'lr-cluster-activate');
  await sendKeys({ press: 'Enter' });
  const event = await pending;
  expect(event.detail.items.map((item: LyraTimelineItem) => item.id)).to.deep.equal(['first', 'second', 'added']);
  expect(Object.isFrozen(event.detail.items)).to.equal(true);
  expect(getComputedStyle(second).display).to.equal('none');
});
