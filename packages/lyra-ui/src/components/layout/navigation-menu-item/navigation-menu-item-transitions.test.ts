import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';
import { setAnimation } from '../../../utilities/animation-registry.js';
import type { LyraNavigationMenuItem, LyraNavigationMenuToggleDetail } from './navigation-menu-item.class.js';
import '../navigation-menu/navigation-menu.js';

function base(item: LyraNavigationMenuItem): HTMLElement {
  return item.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
}

function panel(item: LyraNavigationMenuItem): HTMLElement {
  return item.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
}

async function placed(item: LyraNavigationMenuItem): Promise<void> {
  await waitUntil(() => item.open && !panel(item).hidden && panel(item).style.position !== '');
  await nextFrame();
}

async function click(target: HTMLElement): Promise<void> {
  const rect = target.getBoundingClientRect();
  await sendMouse({ type: 'click', position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)] });
}

afterEach(async () => {
  await resetMouse();
  await setReducedMotion('no-preference');
});

it('switches equal-sized disclosures in both directions without constraining their natural size', async () => {
  await setReducedMotion('no-preference');
  const menu = await fixture<HTMLElement>(html`<lr-navigation-menu>
    <lr-navigation-menu-item id="first">First<div slot="panel" style="inline-size:14rem;block-size:5rem"><button>First action</button></div></lr-navigation-menu-item>
    <lr-navigation-menu-item id="second">Second<div slot="panel" style="inline-size:14rem;block-size:5rem"><button>Second action</button></div></lr-navigation-menu-item>
  </lr-navigation-menu>`);
  const first = menu.querySelector<LyraNavigationMenuItem>('#first')!;
  const second = menu.querySelector<LyraNavigationMenuItem>('#second')!;
  await focusByKeyboard(base(first));
  await sendKeys({ press: 'Enter' });
  await placed(first);
  const initial = panel(first).getBoundingClientRect();

  for (const [previous, next] of [[first, second], [second, first]] as const) {
    await click(base(next));
    await placed(next);
    expect(previous.open).to.equal(false);
    expect(panel(previous).hidden).to.equal(true);
    expect(base(next).getAttribute('aria-expanded')).to.equal('true');
    expect(panel(next).style.inlineSize).to.equal('');
    expect(panel(next).style.blockSize).to.equal('');
    expect(panel(next).hasAttribute('data-morphing')).to.equal(false);
    const current = panel(next).getBoundingClientRect();
    expect(current.width).to.be.closeTo(initial.width, 1);
    expect(current.height).to.be.closeTo(initial.height, 1);
  }
});

it('settles a disabled hide animation, then allows the same disclosure to open again', async () => {
  const menu = await fixture<HTMLElement>(html`<lr-navigation-menu>
    <lr-navigation-menu-item>Products<div slot="panel"><button>Product action</button></div></lr-navigation-menu-item>
  </lr-navigation-menu>`);
  const item = menu.querySelector<LyraNavigationMenuItem>('lr-navigation-menu-item')!;
  const release = setAnimation(menu, 'navigation-menu.hide', null);
  const events: LyraNavigationMenuToggleDetail[] = [];
  item.addEventListener('lr-toggle', event => events.push((event as CustomEvent<LyraNavigationMenuToggleDetail>).detail));
  try {
    await focusByKeyboard(base(item));
    await sendKeys({ press: 'Enter' });
    await placed(item);
    await sendKeys({ press: 'Escape' });
    await waitUntil(() => !item.open && panel(item).hidden);
    expect(base(item).getAttribute('aria-expanded')).to.equal('false');

    await sendKeys({ press: 'Enter' });
    await placed(item);
    expect(base(item).getAttribute('aria-expanded')).to.equal('true');
    expect(events.map(event => event.expanded)).to.deep.equal([true, false, true]);
    await expect(menu).to.be.accessible();
  } finally {
    release();
  }
});

it('keeps a reopened disclosure visible when its cancelled exit animation settles', async () => {
  await setReducedMotion('no-preference');
  await nextFrame();
  const menu = await fixture<HTMLElement>(html`<lr-navigation-menu style="--lr-navigation-menu-hide-duration:400ms">
    <lr-navigation-menu-item>Products<div slot="panel"><button>Product action</button></div></lr-navigation-menu-item>
  </lr-navigation-menu>`);
  const item = menu.querySelector<LyraNavigationMenuItem>('lr-navigation-menu-item')!;
  item.open = true;
  await placed(item);
  item.open = false;
  await item.updateComplete;
  const liveExits = (): Animation[] => panel(item).getAnimations().filter(animation =>
    animation.id === 'navigation-menu.hide' && (animation.pending || animation.playState === 'running'));
  await waitUntil(() => liveExits().length > 0, 'the panel never started its exit animation');
  const exits = liveExits();
  expect(exits.length, 'a real exit must be interrupted').to.be.greaterThan(0);
  expect(panel(item).hidden, 'the closing panel remains visible during its exit').to.equal(false);
  const settledExits = Promise.allSettled(exits.map(animation => animation.finished));
  item.open = true;
  await placed(item);
  const settlements = await settledExits;
  expect(settlements.every(result => result.status === 'rejected'), 'reopening cancels the live exit').to.equal(true);
  await nextFrame();
  expect(item.open).to.equal(true);
  expect(panel(item).hidden).to.equal(false);
  expect(base(item).getAttribute('aria-expanded')).to.equal('true');
  expect(panel(item).style.inlineSize).to.equal('');
});
