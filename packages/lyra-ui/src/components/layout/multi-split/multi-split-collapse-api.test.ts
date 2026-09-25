import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './multi-split.js';
import type { LyraMultiSplit } from './multi-split.class.js';

/** Two frames: one for the `ResizeObserver` delivery, one for the render it schedules. */
const settleLayout = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

const dividersOf = (split: LyraMultiSplit): HTMLElement[] => [
  ...split.shadowRoot!.querySelectorAll<HTMLElement>('[part="divider"]'),
];

/** Index of the focused divider inside the split's shadow root, or -1. Compared as a number so a
 *  failing assertion never carries a DOM node. */
const focusedDividerIndex = (split: LyraMultiSplit): number =>
  dividersOf(split).indexOf(split.shadowRoot!.activeElement as HTMLElement);

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
  // Hiding the pane drops focus to the body on its own; the relocation is what puts it back on a
  // real, reachable control, so assert the destination rather than merely the departure.
  expect(
    split.shadowRoot!.activeElement?.getAttribute('part'),
    'focus was relocated, not merely dropped to the body',
  ).to.equal('divider');
  // The two-panel split's only divider is the one beside the drawer: it releases its gutter while
  // floating, yet stays the focus target of last resort rather than dropping focus to the body.
  expect(focusedDividerIndex(split), 'the only divider holds focus').to.equal(0);
  expect(
    dividersOf(split)[0]!.getBoundingClientRect().width,
    'the focused divider takes no track beside the floating pane',
  ).to.be.closeTo(0, 0.5);
  await settleLayout();
  expect(focusedDividerIndex(split), 'focus stays on the zero-track divider').to.equal(0);
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

describe('the divider beside a floating pane', () => {
  const baseOf = (split: LyraMultiSplit): HTMLElement =>
    split.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
  const lineContent = (divider: HTMLElement): string =>
    getComputedStyle(divider, '::before').content;
  const inlineSizeOf = (element: Element): number => element.getBoundingClientRect().width;
  const blockSizeOf = (element: Element): number => element.getBoundingClientRect().height;

  /** The resolved divider target size, measured from a divider in a split that is not collapsing. */
  const resolvedTargetSize = async (): Promise<number> => {
    const probe = await fixture<LyraMultiSplit>(html`<lr-multi-split
      style="inline-size:800px;block-size:120px"
    >
      <div>A</div>
      <div>B</div>
    </lr-multi-split>`);
    await settleLayout();
    return inlineSizeOf(dividersOf(probe)[0]!);
  };

  for (const collapse of ['start', 'end'] as const) {
    for (const direction of ['ltr', 'rtl'] as const) {
      it(`releases its track and hairline while the drawer is closed (${collapse}, ${direction})`, async () => {
        const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
          collapse=${collapse}
          dir=${direction}
          style="inline-size:300px;block-size:200px"
        >
          <div>A</div>
          <div>B</div>
        </lr-multi-split>`);
        await waitUntil(() => split.collapseState === 'floating');
        await settleLayout();
        const survivor = split.children[collapse === 'start' ? 1 : 0] as HTMLElement;
        const divider = dividersOf(split)[0]!;

        expect(divider.getAttribute('aria-disabled')).to.equal('true');
        expect(inlineSizeOf(survivor), 'the survivor fills the split').to.be.closeTo(
          inlineSizeOf(baseOf(split)),
          0.5,
        );
        expect(inlineSizeOf(divider), 'no gutter beside the floating pane').to.be.closeTo(0, 0.5);
        expect(lineContent(divider), 'no hairline beside the floating pane').to.equal('none');
      });

      it(`keeps the track released while the drawer is open (${collapse}, ${direction})`, async () => {
        const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
          collapse=${collapse}
          dir=${direction}
          style="inline-size:300px;block-size:200px"
        >
          <div>A</div>
          <div>B</div>
        </lr-multi-split>`);
        await waitUntil(() => split.collapseState === 'floating');
        await settleLayout();
        const drawer = split.children[collapse === 'start' ? 0 : 1] as HTMLElement;
        const survivor = split.children[collapse === 'start' ? 1 : 0] as HTMLElement;
        const closedWidth = inlineSizeOf(survivor);

        split.open = true;
        await split.updateComplete;
        await settleLayout();

        const baseRect = baseOf(split).getBoundingClientRect();
        const drawerRect = drawer.getBoundingClientRect();
        expect(inlineSizeOf(survivor), 'opening does not reflow the survivor').to.be.closeTo(
          closedWidth,
          0.5,
        );
        expect(inlineSizeOf(survivor), 'the survivor fills the split').to.be.closeTo(
          baseRect.width,
          0.5,
        );
        expect(getComputedStyle(drawer).position, 'the drawer stays an overlay').to.equal(
          'absolute',
        );
        const anchoredLeft = (collapse === 'start') === (direction === 'ltr');
        expect(
          anchoredLeft ? drawerRect.left - baseRect.left : baseRect.right - drawerRect.right,
          'the drawer is flush with its anchor edge',
        ).to.be.closeTo(0, 0.5);
        expect(inlineSizeOf(dividersOf(split)[0]!), 'no gutter under the open drawer').to.be.closeTo(
          0,
          0.5,
        );
      });
    }
  }

  it('keeps the enabled divider of a three-panel split at its full target size', async () => {
    const target = await resolvedTargetSize();
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
      collapse="end"
      style="inline-size:300px;block-size:200px"
    >
      <div>A</div>
      <div>B</div>
      <div>C</div>
    </lr-multi-split>`);
    await waitUntil(() => split.collapseState === 'floating');
    await settleLayout();
    const [enabled, disabled] = dividersOf(split);

    expect(enabled!.getAttribute('aria-disabled')).to.equal('false');
    expect(inlineSizeOf(enabled!), 'the enabled divider keeps its gutter').to.be.closeTo(
      target,
      0.5,
    );
    expect(lineContent(enabled!), 'the enabled divider keeps its hairline').to.not.equal('none');
    expect(disabled!.getAttribute('aria-disabled')).to.equal('true');
    expect(inlineSizeOf(disabled!)).to.be.closeTo(0, 0.5);
    expect(
      inlineSizeOf(split.children[0]!) + inlineSizeOf(split.children[1]!) + inlineSizeOf(enabled!),
      'the survivors and the enabled divider fill the split',
    ).to.be.closeTo(inlineSizeOf(baseOf(split)), 0.5);
  });

  it('releases the block-axis track under an authored vertical orientation', async () => {
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
      collapse="end"
      orientation="vertical"
      style="inline-size:300px;block-size:200px"
    >
      <div>A</div>
      <div>B</div>
    </lr-multi-split>`);
    await waitUntil(() => split.collapseState === 'floating');
    await settleLayout();

    expect(blockSizeOf(dividersOf(split)[0]!), 'no block-axis gutter').to.be.closeTo(0, 0.5);
    expect(blockSizeOf(split.children[0]!), 'the survivor fills the block axis').to.be.closeTo(
      blockSizeOf(baseOf(split)),
      0.5,
    );
    expect(lineContent(dividersOf(split)[0]!)).to.equal('none');
  });

  it('releases the block-axis track under an effective vertical orientation', async () => {
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
      collapse="end"
      orientation-breakpoint="600"
      style="inline-size:300px;block-size:200px"
    >
      <div>A</div>
      <div>B</div>
    </lr-multi-split>`);
    await waitUntil(
      () =>
        split.collapseState === 'floating' &&
        split.getAttribute('data-effective-orientation') === 'vertical',
    );
    await settleLayout();

    expect(blockSizeOf(dividersOf(split)[0]!), 'no block-axis gutter').to.be.closeTo(0, 0.5);
    expect(blockSizeOf(split.children[0]!), 'the survivor fills the block axis').to.be.closeTo(
      blockSizeOf(baseOf(split)),
      0.5,
    );
  });

  it('releases the inline-axis minimum when an authored vertical split flips horizontal', async () => {
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
      collapse="end"
      orientation="vertical"
      orientation-breakpoint="600"
      narrow-orientation="horizontal"
      style="inline-size:300px;block-size:200px"
    >
      <div>A</div>
      <div>B</div>
    </lr-multi-split>`);
    await waitUntil(
      () =>
        split.collapseState === 'floating' &&
        split.getAttribute('data-effective-orientation') === 'horizontal',
    );
    await settleLayout();
    const divider = dividersOf(split)[0]!;

    expect(getComputedStyle(divider).minInlineSize, 'the main-axis minimum is reset').to.equal(
      '0px',
    );
    expect(inlineSizeOf(divider), 'no inline-axis gutter').to.be.closeTo(0, 0.5);
    expect(inlineSizeOf(split.children[0]!), 'the survivor fills the inline axis').to.be.closeTo(
      inlineSizeOf(baseOf(split)),
      0.5,
    );
  });

  it('releases the track for a pinned floating state and restores it on auto', async () => {
    const target = await resolvedTargetSize();
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
      collapse="end"
      style="inline-size:800px;block-size:200px"
    >
      <div>A</div>
      <div>B</div>
    </lr-multi-split>`);
    await waitUntil(() => split.collapseState === 'wide');

    split.collapseState = 'floating';
    await split.updateComplete;
    await settleLayout();
    expect(inlineSizeOf(dividersOf(split)[0]!), 'pinned floating releases the gutter').to.be.closeTo(
      0,
      0.5,
    );

    split.collapseState = 'auto';
    await waitUntil(() => split.collapseState === 'wide');
    await settleLayout();
    const divider = dividersOf(split)[0]!;
    expect(inlineSizeOf(divider), 'auto restores the gutter').to.be.closeTo(target, 0.5);
    expect(lineContent(divider), 'auto restores the hairline').to.not.equal('none');
  });

  it('keeps the divider beside a rail-collapsed pane', async () => {
    const target = await resolvedTargetSize();
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
      collapse="end"
      style="inline-size:500px;block-size:200px"
    >
      <div>A</div>
      <div>B</div>
    </lr-multi-split>`);
    await waitUntil(() => split.collapseState === 'rail');
    await settleLayout();
    const divider = dividersOf(split)[0]!;

    expect(divider.getAttribute('aria-disabled')).to.equal('true');
    expect(inlineSizeOf(divider), 'the rail keeps its gutter').to.be.closeTo(target, 0.5);
    expect(lineContent(divider), 'the rail keeps its hairline').to.not.equal('none');
    expect(inlineSizeOf(split.children[0]!), 'survivor = base - rail - divider').to.be.closeTo(
      inlineSizeOf(baseOf(split)) - inlineSizeOf(split.children[1]!) - target,
      0.5,
    );
  });

  it('re-inflates the divider each time the state leaves floating', async () => {
    const target = await resolvedTargetSize();
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
      collapse="end"
      style="inline-size:800px;block-size:200px"
    >
      <div>A</div>
      <div>B</div>
      <div>C</div>
    </lr-multi-split>`);
    await waitUntil(() => split.collapseState === 'wide');
    const sizes = (): number[] => dividersOf(split).map((divider) => inlineSizeOf(divider));
    const painted = (): boolean[] =>
      dividersOf(split).map((divider) => lineContent(divider) !== 'none');

    split.style.inlineSize = '300px';
    await waitUntil(() => split.collapseState === 'floating');
    await settleLayout();
    expect(sizes()[1], 'floating releases the gutter').to.be.closeTo(0, 0.5);

    split.style.inlineSize = '500px';
    await waitUntil(() => split.collapseState === 'rail');
    await settleLayout();
    expect(sizes()[1], 'rail restores the gutter').to.be.closeTo(target, 0.5);
    expect(painted(), 'rail restores the hairline').to.eql([true, true]);

    split.style.inlineSize = '800px';
    await waitUntil(() => split.collapseState === 'wide');
    await settleLayout();
    expect(sizes()[1], 'wide keeps the gutter').to.be.closeTo(target, 0.5);

    split.style.inlineSize = '300px';
    await waitUntil(() => split.collapseState === 'floating');
    await settleLayout();
    expect(sizes()[1]).to.be.closeTo(0, 0.5);

    split.collapse = 'none';
    await waitUntil(() => split.collapseState === 'wide');
    await settleLayout();
    for (const size of sizes()) {
      expect(size, 'collapse="none" restores every gutter').to.be.closeTo(target, 0.5);
    }
    expect(painted(), 'collapse="none" restores every hairline').to.eql([true, true]);
  });

  it('does not bring the gutter back through --lr-multi-split-divider-target-size', async () => {
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
      collapse="end"
      style="inline-size:300px;block-size:200px;--lr-multi-split-divider-target-size:24px"
    >
      <div>A</div>
      <div>B</div>
    </lr-multi-split>`);
    await waitUntil(() => split.collapseState === 'floating');
    await settleLayout();

    expect(inlineSizeOf(dividersOf(split)[0]!)).to.be.closeTo(0, 0.5);
    expect(inlineSizeOf(split.children[0]!)).to.be.closeTo(inlineSizeOf(baseOf(split)), 0.5);
  });

  for (const [width, state] of [
    ['300px', 'floating'],
    ['500px', 'rail'],
  ] as const) {
    it(`relocates focus onto a divider that stays enabled (collapse="start", ${state})`, async () => {
      const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
        collapse="start"
        style="inline-size:800px;block-size:120px"
      >
        <div><button type="button" id="inside">Inside</button></div>
        <div>B</div>
        <div>C</div>
      </lr-multi-split>`);
      await waitUntil(() => split.collapseState === 'wide');
      await settleLayout();
      const wideWidth = inlineSizeOf(dividersOf(split)[1]!);
      split.querySelector<HTMLButtonElement>('#inside')!.focus();

      split.style.inlineSize = width;
      await waitUntil(() => split.collapseState === state);
      await settleLayout();

      const index = focusedDividerIndex(split);
      expect(index, 'focus prefers the divider that stays enabled').to.equal(1);
      expect(dividersOf(split)[index]?.getAttribute('aria-disabled')).to.equal('false');
      expect(inlineSizeOf(dividersOf(split)[1]!), 'the focused divider keeps its gutter').to.be.closeTo(
        wideWidth,
        0.5,
      );
    });

    it(`relocates focus onto a divider that stays enabled (collapse="end", ${state})`, async () => {
      const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
        collapse="end"
        style="inline-size:800px;block-size:120px"
      >
        <div>A</div>
        <div>B</div>
        <div><button type="button" id="inside">Inside</button></div>
      </lr-multi-split>`);
      await waitUntil(() => split.collapseState === 'wide');
      split.querySelector<HTMLButtonElement>('#inside')!.focus();

      split.style.inlineSize = width;
      await waitUntil(() => split.collapseState === state);
      await settleLayout();

      const index = focusedDividerIndex(split);
      expect(index, 'focus prefers the divider that stays enabled').to.equal(0);
      expect(dividersOf(split)[index]?.getAttribute('aria-disabled')).to.equal('false');
    });
  }

  it('stays accessible while floating, closed and open', async () => {
    const split = await fixture<LyraMultiSplit>(html`<lr-multi-split
      collapse="end"
      style="inline-size:300px;block-size:200px"
    >
      <div>A</div>
      <div aria-label="Details">B</div>
    </lr-multi-split>`);
    await waitUntil(() => split.collapseState === 'floating');
    await settleLayout();
    await expect(split).to.be.accessible();

    split.open = true;
    await split.updateComplete;
    await settleLayout();
    await expect(split).to.be.accessible();
  });
});
