import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { twoFrames } from '../../../../test/frames.js';
import { observeOverlayStack } from '../../../internal/overlay-stack.js';
import type { LyraDialog } from '../../overlays/dialog/dialog.js';
import type { LyraMultiSplit } from './multi-split.js';
import '../../overlays/dialog/dialog.js';
import './multi-split.js';

function inlineStyles(element: HTMLElement): Record<string, readonly string[]> {
  return Object.fromEntries(Array.from(element.style)
    .filter(property => property !== '--lr-overlay-stack-index')
    .map(property => [property, [element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]]));
}

it('paints a newer allocation-relative floating drawer above an older sibling dialog', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div>
    <lr-dialog label="Older dialog" style="--lr-dialog-width:95vw;--lr-dialog-height:90vh"><button>Dialog action</button></lr-dialog>
    <lr-multi-split collapse="start" style="position:fixed;left:10vw;top:20vh;inline-size:300px;block-size:200px">
      <div id="drawer"><button>Drawer action</button></div><div>Content</div>
    </lr-multi-split>
  </div>`);
  const dialog = wrapper.querySelector<LyraDialog>('lr-dialog')!;
  const split = wrapper.querySelector<LyraMultiSplit>('lr-multi-split')!;
  let top: HTMLElement | undefined;
  const release = observeOverlayStack(document, ({ entries }) => { top = entries.filter(entry => entry.modal).at(-1)?.host; });
  try {
    await waitUntil(() => split.collapseState === 'floating');
    await dialog.show();
    split.open = true;
    await split.updateComplete;
    await waitUntil(() => top === split, 'the floating drawer becomes the logical top modal');
    await twoFrames();
    const drawer = split.querySelector<HTMLElement>('#drawer')!;
    const box = drawer.getBoundingClientRect();
    const dialogBox = dialog.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    expect(box.width > 0 && box.height > 0).to.equal(true);
    expect(x > 0 && x < innerWidth && y > 0 && y < innerHeight).to.equal(true);
    expect(x > dialogBox.left && x < dialogBox.right && y > dialogBox.top && y < dialogBox.bottom,
      'both modal surfaces overlap at the probe').to.equal(true);
    const inert = dialog.inert;
    let hitDrawer = false;
    try {
      dialog.inert = false;
      const hit = document.elementFromPoint(x, y);
      hitDrawer = hit !== null && (hit === split || split.contains(hit));
    } finally {
      dialog.inert = inert;
    }
    expect(hitDrawer, 'the newer floating drawer owns the overlapping painted surface').to.equal(true);
  } finally {
    wrapper.remove();
    release();
  }
});

it('preserves an intrinsic host allocation while a floating pane is promoted', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div style="inline-size:360px">
    <lr-multi-split collapse="start" style="block-size:auto">
      <div>Drawer content</div>
      <div><div style="block-size:180px">Content establishes the split height</div></div>
    </lr-multi-split>
    <div id="following">Following content</div>
  </div>`);
  const split = wrapper.querySelector<LyraMultiSplit>('lr-multi-split')!;
  await waitUntil(() => split.collapseState === 'floating');
  const before = split.getBoundingClientRect();
  const followingTop = wrapper.querySelector('#following')!.getBoundingClientRect().top;
  expect(before.height, 'the ordinary split has an intrinsic block allocation').to.be.at.least(180);
  split.open = true;
  await split.updateComplete;
  await twoFrames();
  const after = split.getBoundingClientRect();
  expect(after.width).to.be.closeTo(before.width, 1);
  expect(after.height).to.be.closeTo(before.height, 1);
  expect(wrapper.querySelector('#following')!.getBoundingClientRect().top).to.be.closeTo(followingTop, 1);
  const base = split.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  expect(base.matches(':popover-open')).to.equal(true);
  split.open = false;
  await split.updateComplete;
  expect(split.getBoundingClientRect().height).to.be.closeTo(before.height, 1);
});

it('keeps promoted floating geometry relative to its allocation through resize and scroll', async () => {
  const scroller = await fixture<HTMLElement>(html`<div style="inline-size:500px;block-size:360px;overflow:auto">
    <div style="block-size:100px"></div>
    <lr-multi-split collapse="start" style="margin-inline-start:50px;inline-size:300px;block-size:200px">
      <div>Drawer content</div><div>Content</div>
    </lr-multi-split>
    <div style="block-size:600px"></div>
  </div>`);
  const split = scroller.querySelector<LyraMultiSplit>('lr-multi-split')!;
  await waitUntil(() => split.collapseState === 'floating');
  const base = split.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const originalStyle = inlineStyles(base);
  const assertAllocation = (): void => {
    const host = split.getBoundingClientRect();
    const frame = base.getBoundingClientRect();
    for (const key of ['left', 'top', 'width', 'height'] as const) {
      expect(frame[key], `promoted frame ${key} follows the split allocation`).to.be.closeTo(host[key], 1);
    }
    const drawer = split.children[0]!.getBoundingClientRect();
    expect(drawer.left).to.be.closeTo(host.left, 1);
    expect(drawer.top).to.be.closeTo(host.top, 1);
    expect(drawer.height).to.be.closeTo(host.height, 1);
    expect(drawer.width).to.be.lessThan(host.width);
  };
  split.open = true;
  await split.updateComplete;
  await twoFrames();
  assertAllocation();
  split.style.inlineSize = '260px';
  split.style.blockSize = '160px';
  await twoFrames();
  assertAllocation();
  scroller.scrollTop = 80;
  await twoFrames();
  assertAllocation();
  expect(base.matches(':popover-open')).to.equal(true);
  split.open = false;
  await split.updateComplete;
  expect(inlineStyles(base), 'temporary frame geometry is released').to.deep.equal(originalStyle);
});

it('preserves host padding, border, and pane percentages inside the promoted allocation frame', async () => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split collapse="start"
    style="inline-size:300px;block-size:200px;padding:16px;border:4px solid black">
    <div>Drawer content</div><div>Content</div>
  </lr-multi-split>`);
  await waitUntil(() => split.collapseState === 'floating');
  const base = split.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const before = base.getBoundingClientRect();
  const authoredStyle = inlineStyles(split);
  split.open = true;
  await split.updateComplete;
  await twoFrames();
  const frame = base.getBoundingClientRect();
  for (const key of ['left', 'top', 'width', 'height'] as const) {
    expect(frame[key], `host chrome does not change frame ${key}`).to.be.closeTo(before[key], 1);
  }
  const drawer = split.children[0]!.getBoundingClientRect();
  expect(drawer.width).to.be.closeTo(before.width * split.sizes[0]! / 100, 1);
  expect(drawer.left).to.be.closeTo(before.left, 1);
  expect(drawer.height).to.be.closeTo(before.height, 1);
  expect(inlineStyles(split)).to.deep.equal(authoredStyle);
  split.open = false;
  await split.updateComplete;
  expect(inlineStyles(split)).to.deep.equal(authoredStyle);
});

it('follows a shrinking definite parent instead of retaining the opening frame height', async () => {
  const allocation = await fixture<HTMLElement>(html`<div style="inline-size:360px;block-size:240px">
    <lr-multi-split collapse="start"><div>Drawer content</div><div>Content</div></lr-multi-split>
  </div>`);
  const split = allocation.querySelector<LyraMultiSplit>('lr-multi-split')!;
  await waitUntil(() => split.collapseState === 'floating');
  split.open = true;
  await split.updateComplete;
  await twoFrames();
  allocation.style.blockSize = '160px';
  allocation.style.inlineSize = '280px';
  await twoFrames();
  const host = split.getBoundingClientRect();
  const frame = split.shadowRoot!.querySelector('[part="base"]')!.getBoundingClientRect();
  expect(host.height).to.be.closeTo(160, 1);
  expect(frame.height).to.be.closeTo(160, 1);
  expect(frame.width).to.be.closeTo(280, 1);
  expect(split.children[0]!.getBoundingClientRect().height).to.be.closeTo(160, 1);
});
