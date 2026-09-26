import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import type { LyraMultiSplit } from './multi-split.class.js';
import './multi-split.js';

async function setup() {
  const host = await fixture<HTMLDivElement>(html`<div>
    <button id="split-launcher" aria-expanded="mixed">Toggle navigation</button>
    <button id="split-alternate">Alternate</button>
    <lr-multi-split collapse="start" style="inline-size:300px;block-size:150px">
      <section aria-label="Navigation"><button>Home</button></section>
      <section><button>Main action</button></section>
    </lr-multi-split>
  </div>`);
  const split = host.querySelector<LyraMultiSplit>('lr-multi-split')!;
  const trigger = host.querySelector<HTMLButtonElement>('#split-launcher')!;
  const alternate = host.querySelector<HTMLButtonElement>('#split-alternate')!;
  await split.updateComplete;
  await waitUntil(() => split.collapseState === 'floating');
  return { host, split, trigger, alternate, panel: split.children[0] as HTMLElement };
}

it('leaves unrelated launcher ARIA and panel identity unchanged without an association', async () => {
  const { split, trigger, panel } = await setup();
  split.expandPane();
  await split.updateComplete;
  expect(trigger.getAttribute('aria-expanded')).to.equal('mixed');
  expect(trigger.hasAttribute('aria-controls')).to.equal(false);
  expect(panel.id).to.equal('');
});

it('associates a for launcher with the actual panel across all three collapse states', async () => {
  const { split, trigger, panel } = await setup();
  split.for = trigger.id;
  await split.updateComplete;
  expect(trigger.getAttribute('aria-expanded')).to.equal('false');
  expect(panel.id.length).to.be.greaterThan(0);
  expect(trigger.getAttribute('aria-controls')).to.equal(panel.id);
  split.expandPane();
  await split.updateComplete;
  expect(trigger.getAttribute('aria-expanded')).to.equal('true');
  split.collapsePane();
  await split.updateComplete;
  expect(trigger.getAttribute('aria-expanded')).to.equal('false');
  split.style.inlineSize = '800px';
  await waitUntil(() => trigger.getAttribute('aria-expanded') === 'true');
  split.collapsePane();
  await split.updateComplete;
  expect(split.collapseState).to.equal('rail');
  expect(trigger.getAttribute('aria-expanded')).to.equal('false');
});

it('prefers a direct trigger and restores author ARIA and panel identity on release', async () => {
  const { split, trigger, alternate, panel } = await setup();
  split.for = trigger.id;
  await split.updateComplete;
  split.trigger = alternate;
  await split.updateComplete;
  expect(trigger.getAttribute('aria-expanded')).to.equal('mixed');
  expect(trigger.hasAttribute('aria-controls')).to.equal(false);
  expect(alternate.getAttribute('aria-controls')).to.equal(panel.id);
  split.remove();
  expect(alternate.hasAttribute('aria-expanded')).to.equal(false);
  expect(alternate.hasAttribute('aria-controls')).to.equal(false);
  expect(panel.id).to.equal('');
});

it('preserves authored panel identity and releases launcher ownership when collapse is disabled', async () => {
  const { split, trigger, panel } = await setup();
  panel.id = 'authored-panel';
  split.trigger = trigger;
  await split.updateComplete;
  expect(trigger.getAttribute('aria-controls')).to.equal('authored-panel');
  split.collapse = 'none';
  await split.updateComplete;
  expect(trigger.getAttribute('aria-expanded')).to.equal('mixed');
  expect(trigger.hasAttribute('aria-controls')).to.equal(false);
  expect(panel.id).to.equal('authored-panel');
});

it('returns focus to the external launcher on Escape after programmatic opening', async () => {
  const { split, trigger } = await setup();
  split.trigger = trigger;
  split.expandPane();
  await split.updateComplete;
  await sendKeys({ press: 'Escape' });
  await split.updateComplete;
  await waitUntil(() => document.activeElement === trigger);
  expect(split.open).to.equal(false);
});

it('reacquires an external launcher after reconnecting', async () => {
  const { host, split, trigger } = await setup();
  split.for = trigger.id;
  await split.updateComplete;
  split.remove();
  expect(trigger.getAttribute('aria-expanded')).to.equal('mixed');
  host.append(split);
  await split.updateComplete;
  await waitUntil(() => trigger.getAttribute('aria-expanded') === 'false');
});
