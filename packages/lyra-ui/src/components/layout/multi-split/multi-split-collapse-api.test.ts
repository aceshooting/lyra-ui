import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './multi-split.js';
import type { LyraMultiSplit } from './multi-split.class.js';

/** Two frames: one for the `ResizeObserver` delivery, one for the render it schedules. */
const settleLayout = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

interface DecorationSample {
  state: string;
  /** `HTMLElement.hidden` is `boolean | 'until-found'` in the current DOM lib, and this samples
   *  the live value rather than narrowing it. */
  hidden: boolean | string;
  panelState: string | null;
  hostState: string | null;
  flex: string;
}

it('decorates the collapsing panel before it announces lr-multi-split-collapse-change', async () => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
    collapse="start"
    style="inline-size:800px;block-size:120px"
  >
    <div id="a">A</div>
    <div id="b">B</div>
  </lr-multi-split>`);
  await waitUntil(() => split.collapseState === 'wide');
  await settleLayout();
  const panel = split.children[0] as HTMLElement;
  const seen: DecorationSample[] = [];
  split.addEventListener('lr-multi-split-collapse-change', (event) => {
    seen.push({
      state: (event as CustomEvent<{ state: string }>).detail.state,
      hidden: panel.hidden,
      panelState: panel.getAttribute('data-collapse-state'),
      hostState: split.getAttribute('data-collapse-state'),
      flex: panel.style.flex,
    });
  });

  split.style.inlineSize = '500px';
  await waitUntil(() => split.collapseState === 'rail');
  split.style.inlineSize = '300px';
  await waitUntil(() => split.collapseState === 'floating');

  expect(seen.map((sample) => sample.state)).to.eql(['rail', 'floating']);
  expect(seen[0]!.panelState, 'rail marker applied before the event').to.equal('rail');
  expect(seen[0]!.hostState, 'host marker applied before the event').to.equal('rail');
  expect(seen[0]!.flex, 'rail sizing applied before the event').to.equal('0 0 3.5rem');
  expect(seen[0]!.hidden, 'a railed pane is clamped, not hidden').to.equal(false);
  expect(seen[1]!.panelState, 'floating marker applied before the event').to.equal('floating');
  expect(seen[1]!.hidden, 'the closed drawer is hidden before the event').to.equal(true);
});

it('picks the wide/rail pin as the expand mechanism above the floating band', async () => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
    collapse="end"
    style="inline-size:800px;block-size:120px"
  >
    <div>A</div>
    <div>B</div>
  </lr-multi-split>`);
  await waitUntil(() => split.collapseState === 'wide');

  split.collapsePane();
  await split.updateComplete;
  expect(split.collapseState, 'collapsePane() pins the rail band').to.equal('rail');
  expect(split.open, 'the drawer is untouched above the floating band').to.equal(false);

  split.togglePane();
  await split.updateComplete;
  expect(split.collapseState, 'togglePane() expands a railed pane').to.equal('wide');

  split.togglePane();
  await split.updateComplete;
  expect(split.collapseState, 'togglePane() collapses an expanded pane').to.equal('rail');

  split.expandPane();
  await split.updateComplete;
  expect(split.collapseState, 'expandPane() pins the wide band').to.equal('wide');
});

it('picks the floating drawer as the expand mechanism inside the floating band', async () => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
    collapse="start"
    style="inline-size:300px;block-size:120px"
  >
    <div aria-label="Details">A</div>
    <div>B</div>
  </lr-multi-split>`);
  await waitUntil(() => split.collapseState === 'floating');
  const panel = split.children[0] as HTMLElement;

  split.expandPane();
  await split.updateComplete;
  expect(split.open, 'expandPane() opens the drawer').to.equal(true);
  expect(panel.hidden, 'the opened drawer renders').to.equal(false);
  await expect(split).to.be.accessible();

  split.collapsePane();
  await split.updateComplete;
  expect(split.open, 'collapsePane() closes the drawer').to.equal(false);
  expect(panel.hidden, 'the closed drawer is hidden again').to.equal(true);

  split.togglePane();
  await split.updateComplete;
  expect(split.open, 'togglePane() reopens the drawer').to.equal(true);
});

it('opens the floating drawer when toggling a rail-banded pin inside the floating band', async () => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
    collapse="start"
    style="inline-size:800px;block-size:120px"
  >
    <div>A</div>
    <div>B</div>
  </lr-multi-split>`);
  await waitUntil(() => split.collapseState === 'wide');
  split.collapseState = 'rail';
  await split.updateComplete;

  split.style.inlineSize = '300px';
  await settleLayout();
  expect(split.collapseState, 'the pin survives the band change by default').to.equal('rail');

  split.togglePane();
  await split.updateComplete;
  expect(split.collapseState, 'the floating band owns the expand mechanism').to.equal('floating');
  expect(split.open, 'the overlay is opened, not a no-op').to.equal(true);

  // The cancelled rail pin is RELEASED, not replaced by a floating one: the band already
  // produces `'floating'`, so pinning it there would switch automatic tracking off for a state
  // the measurement was producing anyway, and widening back would strand the overlay drawer in
  // an 800px container forever.
  split.style.inlineSize = '800px';
  await settleLayout();
  expect(split.collapseState, 'automatic tracking resumed, so no pin was left behind').to.equal(
    'wide',
  );
});

it('never converts an unpinned split into a pinned one from a stale-state expand', async () => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
    collapse="start"
    style="inline-size:800px;block-size:120px"
  >
    <div>A</div>
    <div>B</div>
  </lr-multi-split>`);
  await waitUntil(() => split.collapseState === 'wide');

  // Narrow and act in the SAME task: the band is read live off `[part="base"]`, but
  // `collapseState` still reflects the last `ResizeObserver` delivery, so this lands in the
  // floating branch with a `'wide'` state and no pin at all.
  split.style.inlineSize = '300px';
  split.expandPane();
  await split.updateComplete;
  expect(split.collapseState, 'the live band owns the mechanism').to.equal('floating');
  expect(split.open, 'the drawer opened').to.equal(true);

  split.style.inlineSize = '800px';
  await settleLayout();
  expect(split.collapseState, 'a split with no pin still has none afterwards').to.equal('wide');
});

it('leaves expandPane/collapsePane/togglePane inert while responsive collapse is not opted into', async () => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
    style="inline-size:300px;block-size:120px"
  >
    <div>A</div>
    <div>B</div>
  </lr-multi-split>`);
  await split.updateComplete;

  split.collapsePane();
  split.togglePane();
  split.expandPane();
  await split.updateComplete;

  expect(split.collapseState, 'no collapsing pane exists').to.equal('wide');
  expect(split.open, 'no drawer exists to open').to.equal(false);
  expect(split.hasAttribute('data-collapse-state')).to.equal(false);
});

it('keeps a pin across a band change unless releasePinOnBreakpoint is opted into', async () => {
  const pinned = await fixture<LyraMultiSplit>(html`<lr-multi-split
    collapse="start"
    style="inline-size:800px;block-size:120px"
  >
    <div>A</div>
    <div>B</div>
  </lr-multi-split>`);
  await waitUntil(() => pinned.collapseState === 'wide');
  pinned.collapseState = 'rail';
  await pinned.updateComplete;
  pinned.style.inlineSize = '300px';
  await settleLayout();
  expect(pinned.collapseState, 'today: the pin leaks into the next band').to.equal('rail');

  const releasing = await fixture<LyraMultiSplit>(html`<lr-multi-split
    collapse="start"
    release-pin-on-breakpoint
    style="inline-size:800px;block-size:120px"
  >
    <div>A</div>
    <div>B</div>
  </lr-multi-split>`);
  await waitUntil(() => releasing.collapseState === 'wide');
  releasing.collapseState = 'rail';
  await releasing.updateComplete;
  expect(releasing.collapseState, 'the pin still applies inside its own band').to.equal('rail');

  releasing.style.inlineSize = '300px';
  await waitUntil(() => releasing.collapseState === 'floating');
  releasing.style.inlineSize = '800px';
  await waitUntil(() => releasing.collapseState === 'wide');
});

it('releases a pin on an effective orientation change when releasePinOnBreakpoint is set', async () => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
    collapse="start"
    release-pin-on-breakpoint
    orientation-breakpoint="700"
    style="inline-size:800px;block-size:120px"
  >
    <div>A</div>
    <div>B</div>
  </lr-multi-split>`);
  await waitUntil(() => split.collapseState === 'wide');
  split.collapseState = 'floating';
  await split.updateComplete;
  expect(split.collapseState).to.equal('floating');

  // 660px stays inside the same 'wide' collapse band (>= the 640 rail breakpoint), so only the
  // effective orientation crosses -- the pin must still be released by it.
  split.style.inlineSize = '660px';
  await waitUntil(() => split.effectiveOrientation === 'vertical');
  await settleLayout();
  expect(split.collapseState, 'the orientation change released the pin').to.equal('wide');
});

it('announces and repairs focus for a pin released by a runtime orientation-breakpoint write', async () => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
    collapse="start"
    release-pin-on-breakpoint
    style="inline-size:500px;block-size:120px"
  >
    <div><button type="button" id="inside">Inside</button></div>
    <div>B</div>
  </lr-multi-split>`);
  await waitUntil(() => split.collapseState === 'rail');
  await settleLayout();
  split.collapseState = 'wide';
  await split.updateComplete;
  const panel = split.children[0] as HTMLElement;
  panel.querySelector<HTMLButtonElement>('#inside')!.focus();
  expect(panel.contains(document.activeElement), 'focus starts inside the pane').to.equal(true);

  const states: string[] = [];
  split.addEventListener('lr-multi-split-collapse-change', (event) => {
    states.push((event as CustomEvent<{ state: string }>).detail.state);
  });

  // Default `container` basis, so the ORIENTATION event itself is deferred to the observer's
  // next fresh read -- but the pin release it performs is already final (the observer re-reads
  // an axis that now matches and returns early), so the collapse transition must announce here.
  split.orientationBreakpoint = 700;
  await split.updateComplete;

  expect(split.effectiveOrientation, 'the effective axis crossed').to.equal('vertical');
  expect(split.collapseState, 'the pin was released and the state re-derived').to.equal('rail');
  expect(states, 'the released pin announced its real transition').to.eql(['rail']);
  expect(panel.contains(document.activeElement), 'focus left the collapsing pane').to.equal(false);
  expect(
    split.shadowRoot!.activeElement?.getAttribute('part'),
    'focus was relocated, not merely dropped to the body',
  ).to.equal('divider');
});

for (const direction of ['ltr', 'rtl'] as const) {
  it(`moves focus out of a pane collapsing to the rail band (${direction})`, async () => {
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
      collapse="start"
      dir=${direction}
      style="inline-size:800px;block-size:120px"
    >
      <div><button type="button" id="inside">Inside</button></div>
      <div>B</div>
    </lr-multi-split>`);
    await waitUntil(() => split.collapseState === 'wide');
    const panel = split.children[0] as HTMLElement;
    const button = panel.querySelector<HTMLButtonElement>('#inside')!;
    button.focus();
    expect(panel.contains(document.activeElement), 'focus starts inside the pane').to.equal(true);

    split.style.inlineSize = '500px';
    await waitUntil(() => split.collapseState === 'rail');
    await settleLayout();

    expect(panel.contains(document.activeElement), 'focus left the collapsing pane').to.equal(false);
    expect(
      split.shadowRoot!.activeElement?.getAttribute('part'),
      'focus landed on the split’s own divider',
    ).to.equal('divider');
  });
}

it('moves focus out of a pane collapsing into the closed floating drawer', async () => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
    collapse="end"
    style="inline-size:800px;block-size:120px"
  >
    <div>A</div>
    <div><button type="button" id="inside">Inside</button></div>
  </lr-multi-split>`);
  await waitUntil(() => split.collapseState === 'wide');
  const panel = split.children[1] as HTMLElement;
  panel.querySelector<HTMLButtonElement>('#inside')!.focus();
  expect(panel.contains(document.activeElement)).to.equal(true);

  split.style.inlineSize = '300px';
  await waitUntil(() => split.collapseState === 'floating');
  await settleLayout();

  expect(panel.hidden, 'the drawer closed').to.equal(true);
  expect(panel.contains(document.activeElement), 'focus left the hidden drawer').to.equal(false);
  // The only divider is adjacent to the collapsed pane and is removed from layout. Focus moves
  // to the surviving pane as a programmatic-only stop instead of being lost to the body.
  expect(
    document.activeElement === split.children[0],
    'focus was relocated to the surviving pane',
  ).to.be.true;
  expect((split.children[0] as HTMLElement).getAttribute('tabindex')).to.equal('-1');
});

it('leaves focus outside the collapsing pane strictly alone', async () => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
    collapse="start"
    style="inline-size:800px;block-size:120px"
  >
    <div>A</div>
    <div><button type="button" id="outside">Outside</button></div>
  </lr-multi-split>`);
  await waitUntil(() => split.collapseState === 'wide');
  const survivor = split.children[1] as HTMLElement;
  const button = survivor.querySelector<HTMLButtonElement>('#outside')!;
  button.focus();

  split.style.inlineSize = '500px';
  await waitUntil(() => split.collapseState === 'rail');
  await settleLayout();

  expect(survivor.contains(document.activeElement), 'the surviving pane keeps focus').to.equal(true);
  expect(document.activeElement === split ? '' : (document.activeElement as HTMLElement).id).to.equal(
    'outside',
  );
});

it('insets the floating drawer through --lr-multi-split-floating-panel-inset', async () => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
    collapse="start"
    open
    style="inline-size:300px;block-size:200px;--lr-multi-split-floating-panel-inset:12px"
  >
    <div>A</div>
    <div>B</div>
  </lr-multi-split>`);
  await waitUntil(() => split.collapseState === 'floating');
  await settleLayout();
  const base = split.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const panel = split.children[0] as HTMLElement;
  const baseRect = base.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();

  expect(panelRect.top - baseRect.top, 'block-start inset').to.be.closeTo(12, 0.5);
  expect(baseRect.bottom - panelRect.bottom, 'block-end inset').to.be.closeTo(12, 0.5);
  expect(panelRect.left - baseRect.left, 'inline-start inset').to.be.closeTo(12, 0.5);
});

it('leaves the floating drawer flush with its container when the inset is unset', async () => {
  const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
    collapse="start"
    open
    style="inline-size:300px;block-size:200px"
  >
    <div>A</div>
    <div>B</div>
  </lr-multi-split>`);
  await waitUntil(() => split.collapseState === 'floating');
  await settleLayout();
  const base = split.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const panel = split.children[0] as HTMLElement;
  const baseRect = base.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();

  expect(panelRect.top - baseRect.top, 'unset stays flush').to.be.closeTo(0, 0.5);
  expect(panelRect.left - baseRect.left, 'unset stays flush').to.be.closeTo(0, 0.5);
});

it('keeps a releasable pin across a disconnect and reconnect at the same band', async () => {
  const split = document.createElement('lr-multi-split') as LyraMultiSplit;
  split.setAttribute('collapse', 'start');
  split.releasePinOnBreakpoint = true;
  split.style.cssText = 'inline-size:800px;block-size:120px';
  split.append(document.createElement('div'), document.createElement('div'));
  document.body.append(split);
  try {
    await waitUntil(() => split.collapseState === 'wide');
    split.collapseState = 'rail';
    await split.updateComplete;

    split.remove();
    await settleLayout();
    document.body.append(split);
    await settleLayout();

    expect(split.collapseState, 'a reconnect at the same band is not a band change').to.equal(
      'rail',
    );
    split.style.inlineSize = '300px';
    await waitUntil(() => split.collapseState === 'floating');
  } finally {
    split.remove();
  }
});
