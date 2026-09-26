import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import type { LyraMultiSplit } from './multi-split.class.js';
import './multi-split.js';

const nextFrame = (): Promise<void> => new Promise((resolve) => requestAnimationFrame(() => resolve()));

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
  return {
    host,
    split,
    trigger,
    alternate,
    panel: split.children[0] as HTMLElement,
    mainAction: split.children[1]!.querySelector('button')!,
  };
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

it('returns focus to a launcher the application re-shows after the close', async () => {
  const { split, trigger } = await setup();
  split.trigger = trigger;
  split.expandPane();
  await split.updateComplete;
  trigger.style.visibility = 'hidden';
  split.addEventListener('lr-toggle', () => {
    requestAnimationFrame(() => {
      trigger.style.visibility = '';
    });
  }, { once: true });
  await sendKeys({ press: 'Escape' });
  await split.updateComplete;
  expect(split.open).to.equal(false);
  await waitUntil(() => document.activeElement === trigger, 'focus reached the re-shown launcher');
});

it('keeps focus the application moves into the surviving pane after the close update', async () => {
  const { split, trigger, mainAction } = await setup();
  split.trigger = trigger;
  split.expandPane();
  await split.updateComplete;
  split.collapsePane();
  await split.updateComplete;
  expect(split.open).to.equal(false);
  mainAction.focus();
  expect(document.activeElement === mainAction).to.equal(true);
  await nextFrame();
  await nextFrame();
  expect(document.activeElement === mainAction, 'focus stayed in the surviving pane').to.equal(true);
});

it('keeps focus an lr-toggle frame callback moves into the surviving pane', async () => {
  const { split, trigger, mainAction } = await setup();
  split.for = trigger.id;
  split.expandPane();
  await split.updateComplete;
  split.addEventListener('lr-toggle', () => {
    requestAnimationFrame(() => mainAction.focus());
  }, { once: true });
  await sendKeys({ press: 'Escape' });
  await split.updateComplete;
  expect(split.open).to.equal(false);
  await waitUntil(() => document.activeElement === mainAction, 'the frame callback focused the pane');
  await nextFrame();
  await nextFrame();
  expect(document.activeElement === mainAction, 'focus stayed in the surviving pane').to.equal(true);
});

it('returns focus to the launcher rather than the opener after a backdrop close', async () => {
  const { split, trigger, alternate } = await setup();
  split.trigger = trigger;
  alternate.focus();
  split.expandPane();
  await split.updateComplete;
  const rect = split.getBoundingClientRect();
  try {
    await sendMouse({
      type: 'click',
      position: [Math.floor(rect.right - 4), Math.floor(rect.top + rect.height / 2)],
    });
    await split.updateComplete;
    expect(split.open).to.equal(false);
    await waitUntil(() => document.activeElement === trigger, 'focus returned to the launcher');
  } finally {
    await resetMouse();
  }
});

it('moves a generated panel id when the collapsing pane changes and never removes an authored one', async () => {
  const { split, trigger, panel } = await setup();
  const main = split.children[1] as HTMLElement;
  main.id = 'main-pane';
  split.for = trigger.id;
  await split.updateComplete;
  const generated = panel.id;
  expect(generated.length).to.be.greaterThan(0);
  expect(trigger.getAttribute('aria-controls')).to.equal(generated);

  split.collapse = 'end';
  await split.updateComplete;
  expect(panel.hasAttribute('id')).to.equal(false);
  expect(trigger.getAttribute('aria-controls')).to.equal('main-pane');

  split.collapse = 'start';
  await split.updateComplete;
  expect(main.id).to.equal('main-pane');
  expect(panel.id.length).to.be.greaterThan(0);
  expect(trigger.getAttribute('aria-controls')).to.equal(panel.id);
});

it('re-targets the association when an appended panel becomes the collapsing pane', async () => {
  const { split, trigger } = await setup();
  split.collapse = 'end';
  split.for = trigger.id;
  await split.updateComplete;
  const previous = split.children[1] as HTMLElement;
  expect(previous.id.length).to.be.greaterThan(0);
  expect(trigger.getAttribute('aria-controls')).to.equal(previous.id);

  const appended = document.createElement('section');
  appended.textContent = 'Details';
  split.append(appended);
  await waitUntil(
    () => appended.id.length > 0 && trigger.getAttribute('aria-controls') === appended.id,
    'the appended collapsing pane is associated',
  );
  expect(previous.hasAttribute('id')).to.equal(false);
});

it('restores author launcher ARIA when the split disconnects', async () => {
  const { split, trigger, panel } = await setup();
  trigger.setAttribute('aria-controls', 'split-alternate');
  split.for = trigger.id;
  await split.updateComplete;
  expect(trigger.getAttribute('aria-expanded')).to.equal('false');
  expect(trigger.getAttribute('aria-controls')!.split(' ')).to.include(panel.id);

  split.remove();
  expect(trigger.getAttribute('aria-expanded')).to.equal('mixed');
  expect(trigger.getAttribute('aria-controls')).to.equal('split-alternate');
  expect(panel.hasAttribute('id')).to.equal(false);
});

it('wires a for launcher inserted after the split rendered on the next requested update', async () => {
  const { host, split, panel } = await setup();
  split.for = 'late-launcher';
  await split.updateComplete;
  const late = document.createElement('button');
  late.id = 'late-launcher';
  late.textContent = 'Late navigation';
  host.prepend(late);
  split.requestUpdate();
  await split.updateComplete;
  expect(late.getAttribute('aria-expanded')).to.equal('false');
  expect(panel.id.length).to.be.greaterThan(0);
  expect(late.getAttribute('aria-controls')).to.equal(panel.id);
});
