import { fixture, expect, html, oneEvent, aTimeout, waitUntil } from '@open-wc/testing';
import './compare-panel.js';
import type { LyraComparePanel } from './compare-panel.js';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';

describe('lr-compare-panel', () => {
  it('renders labelA/labelB, falling back to the localized defaults when unset', async () => {
    const el = (await fixture(html`<lr-compare-panel></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="pane-a"]')!.getAttribute('aria-label')).to.equal('Response A');
    expect(el.shadowRoot!.querySelector('[part="pane-b"]')!.getAttribute('aria-label')).to.equal('Response B');
  });

  it('renders slotted a/b/prompt content', async () => {
    const el = (await fixture(html`
      <lr-compare-panel>
        <span slot="prompt">The prompt</span>
        <span slot="a">Answer A</span>
        <span slot="b">Answer B</span>
      </lr-compare-panel>
    `)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.textContent).to.include('Answer A');
    expect(el.textContent).to.include('Answer B');
    expect(el.textContent).to.include('The prompt');
  });

  it('emits lr-vote and reflects vote on the chosen button', async () => {
    const el = (await fixture(html`<lr-compare-panel item-id="pair-1"></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('[part="vote-button"]');
    setTimeout(() => (buttons[0] as HTMLElement).click());
    const ev = await oneEvent(el, 'lr-vote');
    expect(ev.detail).to.deep.equal({ choice: 'a', itemId: 'pair-1' });
    await el.updateComplete;
    expect(el.vote).to.equal('a');
    expect((buttons[0] as HTMLElement).getAttribute('aria-pressed')).to.equal('true');
  });

  it('emits the cancelable vote before mutation and honors a veto', async () => {
    const el = (await fixture(html`<lr-compare-panel item-id="pair-1"></lr-compare-panel>`)) as LyraComparePanel;
    let voteDuringEvent: unknown = 'unset';
    el.addEventListener('lr-vote', (event) => {
      voteDuringEvent = el.vote;
      event.preventDefault();
    });
    (el.shadowRoot!.querySelector('[part="vote-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(voteDuringEvent).to.equal(null);
    expect(el.vote).to.equal(null);
  });

  it('announces the voted pair snapshot when a listener synchronously advances the item', async () => {
    const el = (await fixture(html`
      <lr-compare-panel item-id="pair-1" label-a="Original A" label-b="Original B"></lr-compare-panel>
    `)) as LyraComparePanel;
    el.addEventListener('lr-vote', () => {
      el.itemId = 'pair-2';
      el.labelA = 'Next A';
      el.labelB = 'Next B';
    });
    (el.shadowRoot!.querySelector('[part="vote-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const live = el.shadowRoot!.querySelector('lr-live-region')!;
    expect(live.shadowRoot!.querySelector('[part="region"]')!.textContent).to.include('Original A');
  });

  it('skips the vote write when a listener re-entrantly advances itemId mid-cast', async () => {
    const el = (await fixture(html`<lr-compare-panel item-id="pair-1"></lr-compare-panel>`)) as LyraComparePanel;
    el.addEventListener('lr-vote', () => {
      el.itemId = 'pair-2';
    });
    (el.shadowRoot!.querySelector('[part="vote-button"]') as HTMLButtonElement).click();
    await el.updateComplete;
    // itemId's own setter already nulled the vote when it changed; the unconditional
    // `this.vote = choice` write that used to follow the event would clobber that reset and
    // stamp the *new* pair as voted before the user ever saw it.
    expect(el.vote).to.equal(null);
    expect(el.itemId).to.equal('pair-2');
  });

  it('emits lr-vote for the B pane and marks the B button pressed', async () => {
    const el = (await fixture(html`<lr-compare-panel item-id="pair-2"></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    const buttons = el.shadowRoot!.querySelectorAll('[part="vote-button"]');
    setTimeout(() => (buttons[1] as HTMLElement).click());
    const ev = await oneEvent(el, 'lr-vote');
    expect(ev.detail).to.deep.equal({ choice: 'b', itemId: 'pair-2' });
    await el.updateComplete;
    expect(el.vote).to.equal('b');
    expect((buttons[1] as HTMLElement).getAttribute('aria-pressed')).to.equal('true');
  });

  it('emits lr-vote for a tie and marks the tie button pressed', async () => {
    const el = (await fixture(html`<lr-compare-panel item-id="pair-3"></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    // Button order: A, B, tie, both-bad.
    const tieButton = el.shadowRoot!.querySelectorAll('[part="vote-button"]')[2] as HTMLElement;
    setTimeout(() => tieButton.click());
    const ev = await oneEvent(el, 'lr-vote');
    expect(ev.detail).to.deep.equal({ choice: 'tie', itemId: 'pair-3' });
    await el.updateComplete;
    expect(el.vote).to.equal('tie');
    expect(tieButton.getAttribute('aria-pressed')).to.equal('true');
  });

  it('emits lr-vote for both-bad and marks that button pressed', async () => {
    const el = (await fixture(html`<lr-compare-panel item-id="pair-4"></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    const bothBadButton = el.shadowRoot!.querySelectorAll('[part="vote-button"]')[3] as HTMLElement;
    setTimeout(() => bothBadButton.click());
    const ev = await oneEvent(el, 'lr-vote');
    expect(ev.detail).to.deep.equal({ choice: 'both-bad', itemId: 'pair-4' });
    await el.updateComplete;
    expect(el.vote).to.equal('both-bad');
    expect(bothBadButton.getAttribute('aria-pressed')).to.equal('true');
  });

  it('synchronizes the paired pane scroll position when sync-scroll is enabled and content overflows', async () => {
    const el = (await fixture(html`
      <lr-compare-panel sync-scroll style="--lr-compare-panel-max-height: 50px">
        <div slot="a" style="block-size: 500px;">Tall A content</div>
        <div slot="b" style="block-size: 500px;">Tall B content</div>
      </lr-compare-panel>
    `)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.syncScroll).to.be.true;
    const paneA = el.shadowRoot!.querySelector('[part="pane-a"]') as HTMLElement;
    const paneB = el.shadowRoot!.querySelector('[part="pane-b"]') as HTMLElement;
    expect(paneA.scrollHeight).to.be.greaterThan(paneA.clientHeight);

    paneA.scrollTop = paneA.scrollHeight - paneA.clientHeight; // scroll to the very bottom
    paneA.dispatchEvent(new Event('scroll'));
    await aTimeout(50);

    expect(paneB.scrollTop).to.be.greaterThan(0);
  });

  it('owns scroll-sync frames in the adopted window and clears suppression on cleanup', async () => {
    const el = (await fixture(html`<lr-compare-panel></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    el.remove();
    const iframe = (await fixture(html`<iframe></iframe>`)) as HTMLIFrameElement;
    const frameDocument = iframe.contentDocument!;
    const frameWindow = iframe.contentWindow!;
    const originalMainRequest = window.requestAnimationFrame;
    const originalMainCancel = window.cancelAnimationFrame;
    const originalFrameRequest = frameWindow.requestAnimationFrame;
    const originalFrameCancel = frameWindow.cancelAnimationFrame;
    const mainFrames = new Map<number, FrameRequestCallback>();
    const frameFrames = new Map<number, FrameRequestCallback>();
    const frameCancellations: number[] = [];
    let mainHandle = 6200;
    let frameHandle = 7200;

    window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const handle = ++mainHandle;
      mainFrames.set(handle, callback);
      return handle;
    }) as typeof window.requestAnimationFrame;
    window.cancelAnimationFrame = ((handle: number) => {
      mainFrames.delete(handle);
    }) as typeof window.cancelAnimationFrame;
    frameWindow.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const handle = ++frameHandle;
      frameFrames.set(handle, callback);
      return handle;
    }) as typeof frameWindow.requestAnimationFrame;
    frameWindow.cancelAnimationFrame = ((handle: number) => {
      frameCancellations.push(handle);
      frameFrames.delete(handle);
    }) as typeof frameWindow.cancelAnimationFrame;

    try {
      frameDocument.adoptNode(el);
      expect(frameFrames.size, 'detached adoption never arms scroll synchronization').to.equal(0);
      frameDocument.body.append(el);
      el.syncScroll = true;
      await el.updateComplete;

      const paneA = el.shadowRoot!.querySelector('[part="pane-a"]') as HTMLElement;
      const paneB = el.shadowRoot!.querySelector('[part="pane-b"]') as HTMLElement;
      let sourceTop = 50;
      let destinationTop = 0;
      Object.defineProperties(paneA, {
        scrollHeight: { configurable: true, value: 200 },
        clientHeight: { configurable: true, value: 100 },
        scrollTop: {
          configurable: true,
          get: () => sourceTop,
          set: (value: number) => {
            sourceTop = value;
          },
        },
      });
      Object.defineProperties(paneB, {
        scrollHeight: { configurable: true, value: 200 },
        clientHeight: { configurable: true, value: 100 },
        scrollTop: {
          configurable: true,
          get: () => destinationTop,
          set: (value: number) => {
            destinationTop = value;
          },
        },
      });

      paneA.dispatchEvent(new Event('scroll'));
      expect(destinationTop).to.equal(50);
      expect(mainFrames.size, 'the parent window must not own an iframe sync frame').to.equal(0);
      expect(frameFrames.size).to.equal(1);
      const [oldHandle, staleFrame] = Array.from(frameFrames.entries())[0]!;

      document.adoptNode(el);
      expect(frameCancellations, 'adoption cancels through the retained source owner').to.include(oldHandle);
      expect(mainFrames.size, 'detached adoption does not re-arm scroll sync').to.equal(0);
      document.body.append(el);

      sourceTop = 25;
      destinationTop = 0;
      paneA.dispatchEvent(new Event('scroll'));
      expect(destinationTop, 'cleanup releases suppression before reconnect').to.equal(25);
      expect(mainFrames.size).to.equal(1);

      staleFrame(0);
      sourceTop = 75;
      paneA.dispatchEvent(new Event('scroll'));
      expect(mainFrames.size, 'a stale frame cannot release the current sync guard').to.equal(1);
      expect(destinationTop).to.equal(25);
    } finally {
      el.remove();
      window.requestAnimationFrame = originalMainRequest;
      window.cancelAnimationFrame = originalMainCancel;
      frameWindow.requestAnimationFrame = originalFrameRequest;
      frameWindow.cancelAnimationFrame = originalFrameCancel;
      iframe.remove();
    }
  });

  it('does not sync scroll between panes when sync-scroll is unset (the default)', async () => {
    const el = (await fixture(html`
      <lr-compare-panel style="--lr-compare-panel-max-height: 50px">
        <div slot="a" style="block-size: 500px;">Tall A content</div>
        <div slot="b" style="block-size: 500px;">Tall B content</div>
      </lr-compare-panel>
    `)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.syncScroll).to.be.false;
    const paneA = el.shadowRoot!.querySelector('[part="pane-a"]') as HTMLElement;
    const paneB = el.shadowRoot!.querySelector('[part="pane-b"]') as HTMLElement;

    paneA.scrollTop = paneA.scrollHeight - paneA.clientHeight;
    paneA.dispatchEvent(new Event('scroll'));
    await aTimeout(50);

    expect(paneB.scrollTop).to.equal(0);
  });

  it('renders all votes by default and accepts a positive allowedVotes subset', async () => {
    const el = (await fixture(html`<lr-compare-panel></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="vote-button"]').length).to.equal(4);

    el.allowedVotes = ['a', 'b'];
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="vote-button"]').length).to.equal(2);
    expect(Array.from(el.shadowRoot!.querySelectorAll('[part="vote-button"]')).map((button) => button.textContent?.trim()))
      .to.deep.equal(['Response A is better', 'Response B is better']);
  });

  it('resets vote to null when itemId changes', async () => {
    const el = (await fixture(html`<lr-compare-panel item-id="pair-1" vote="a"></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.vote).to.equal('a');
    el.itemId = 'pair-2';
    await el.updateComplete;
    expect(el.vote).to.be.null;
  });

  it('preserves an explicitly committed vote regardless of coupled assignment order', async () => {
    const voteFirst = await fixture<LyraComparePanel>(html`
      <lr-compare-panel item-id="old-a" vote="b"></lr-compare-panel>
    `);
    voteFirst.vote = 'a';
    voteFirst.itemId = 'new-a';
    await voteFirst.updateComplete;
    expect(voteFirst.itemId).to.equal('new-a');
    expect(voteFirst.vote).to.equal('a');

    const itemFirst = await fixture<LyraComparePanel>(html`
      <lr-compare-panel item-id="old-b" vote="b"></lr-compare-panel>
    `);
    itemFirst.itemId = 'new-b';
    itemFirst.vote = 'a';
    await itemFirst.updateComplete;
    expect(itemFirst.vote).to.equal('a');

    const sameVote = await fixture<LyraComparePanel>(html`
      <lr-compare-panel item-id="old-c" vote="a"></lr-compare-panel>
    `);
    sameVote.vote = 'a';
    sameVote.itemId = 'new-c';
    await sameVote.updateComplete;
    expect(sameVote.vote, 'an explicit same-value vote assignment is still intentional').to.equal('a');
  });

  it('disables the vote bar when disabled is set', async () => {
    const el = (await fixture(html`<lr-compare-panel disabled></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="vote-button"]') as HTMLButtonElement;
    expect(button.disabled).to.be.true;
  });

  it('stacks panes below 640px container width', async () => {
    const wrap = await fixture(html`
      <div style="inline-size:320px;">
        <lr-compare-panel></lr-compare-panel>
      </div>
    `);
    const narrow = wrap.querySelector('lr-compare-panel') as LyraComparePanel;
    await narrow.updateComplete;
    const panes = narrow.shadowRoot!.querySelector('[part="panes"]') as HTMLElement;
    expect(getComputedStyle(panes).flexDirection).to.equal('column');

    // Control: the same part at the default (wide) allocation stays a row.
    const wide = (await fixture(html`<lr-compare-panel></lr-compare-panel>`)) as LyraComparePanel;
    await wide.updateComplete;
    const widePanes = wide.shadowRoot!.querySelector('[part="panes"]') as HTMLElement;
    expect(getComputedStyle(widePanes).flexDirection).to.equal('row');
  });

  it('falls back to the built-in English vote label and honors a strings override', async () => {
    const el = (await fixture(html`<lr-compare-panel></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="vote-bar"]')!.getAttribute('aria-label')).to.equal('Vote');
    el.strings = { compareVoteLabel: 'Voter' };
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="vote-bar"]')!.getAttribute('aria-label')).to.equal('Voter');
  });

  it('falls back to the built-in label without duplicating a non-empty host semantic owner', async () => {
    const el = (await fixture(html`<lr-compare-panel></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Comparison');

    const withHostLabel = (await fixture(
      html`<lr-compare-panel aria-label="Eval pair 12"></lr-compare-panel>`,
    )) as LyraComparePanel;
    await withHostLabel.updateComplete;
    const namedBase = withHostLabel.shadowRoot!.querySelector('[part="base"]')!;
    expect(withHostLabel.getAttribute('aria-label')).to.equal('Eval pair 12');
    expect(namedBase.hasAttribute('role')).to.equal(false);
    expect(namedBase.hasAttribute('aria-label')).to.equal(false);

    const decorative = (await fixture(
      html`<lr-compare-panel aria-label=""></lr-compare-panel>`,
    )) as LyraComparePanel;
    const decorativeBase = decorative.shadowRoot!.querySelector('[part="base"]')!;
    expect(decorativeBase.getAttribute('role')).to.equal('group');
    expect(decorativeBase.getAttribute('aria-label')).to.equal('');
  });

  it('dims a disabled vote button through the shared disabled-opacity token', async () => {
    const wrapper = (await fixture(
      html`<div style="--lr-theme-opacity-disabled: 0.25"><lr-compare-panel disabled></lr-compare-panel></div>`,
    )) as HTMLElement;
    const el = wrapper.querySelector('lr-compare-panel') as LyraComparePanel;
    await el.updateComplete;
    const button = el.shadowRoot!.querySelector('[part="vote-button"]') as HTMLButtonElement;
    expect(button.disabled).to.be.true;
    expect(getComputedStyle(button).opacity).to.equal('0.25');
  });

  it('exposes component-scoped hooks for the selected vote state', async () => {
    const el = (await fixture(html`
      <lr-compare-panel
        vote="a"
        style="
          --lr-compare-panel-selected-background: rgb(1, 2, 3);
          --lr-compare-panel-selected-border-color: rgb(4, 5, 6);
          --lr-compare-panel-selected-color: rgb(7, 8, 9);
          --lr-compare-panel-selected-font-weight: 700;
        "
      ></lr-compare-panel>
    `)) as LyraComparePanel;
    const selected = el.shadowRoot!.querySelector('[part="vote-button"][data-selected]') as HTMLButtonElement;
    const unselected = el.shadowRoot!.querySelector('[part="vote-button"]:not([data-selected])') as HTMLButtonElement;
    const computed = getComputedStyle(selected);
    expect(computed.backgroundColor).to.equal('rgb(1, 2, 3)');
    expect(computed.borderColor).to.equal('rgb(4, 5, 6)');
    expect(computed.color).to.equal('rgb(7, 8, 9)');
    expect(computed.fontWeight).to.equal('700');
    expect(getComputedStyle(unselected).fontWeight).to.not.equal('700');
  });

  it('contains long public labels at 320px while panes keep their vertical scroll ownership', async () => {
    const token = 'unbroken'.repeat(80);
    const wrapper = (await fixture(html`
      <div style="inline-size: 320px; max-inline-size: 320px;">
        <lr-compare-panel
          label-a=${token}
          label-b=${token}
          vote="a"
          style="--lr-compare-panel-max-height: 48px"
        >
          <div slot="a" style="block-size: 320px">A</div>
          <div slot="b" style="block-size: 320px">B</div>
        </lr-compare-panel>
      </div>
    `)) as HTMLElement;
    const el = wrapper.querySelector('lr-compare-panel') as LyraComparePanel;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const panes = el.shadowRoot!.querySelector('[part="panes"]') as HTMLElement;
    const paneA = el.shadowRoot!.querySelector('[part="pane-a"]') as HTMLElement;
    const paneHeader = el.shadowRoot!.querySelector('[part="pane-header"]') as HTMLElement;
    const voteButton = el.shadowRoot!.querySelector('[part="vote-button"]') as HTMLElement;
    expect(base.scrollWidth).to.be.at.most(Math.ceil(base.getBoundingClientRect().width) + 1);
    expect(panes.scrollWidth).to.be.at.most(Math.ceil(panes.getBoundingClientRect().width) + 1);
    expect(paneA.scrollWidth).to.be.at.most(paneA.clientWidth + 1);
    expect(paneHeader.scrollWidth).to.be.at.most(Math.ceil(paneHeader.getBoundingClientRect().width) + 1);
    expect(voteButton.scrollWidth).to.be.at.most(Math.ceil(voteButton.getBoundingClientRect().width) + 1);
    expect(getComputedStyle(paneA).overflowX).to.equal('hidden');
    expect(getComputedStyle(paneA).overflowY).to.equal('auto');
    expect(paneA.scrollHeight).to.be.greaterThan(paneA.clientHeight);
  });

  it('is accessible', async () => {
    const el = (await fixture(html`
      <lr-compare-panel label-a="Model A" label-b="Model B">
        <span slot="a">Answer A</span>
        <span slot="b">Answer B</span>
      </lr-compare-panel>
    `)) as LyraComparePanel;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('paints a real vote-button hover state', async () => {
    const el = await fixture<LyraComparePanel>(html`
      <lr-compare-panel style="--lr-transition-fast: 0ms"></lr-compare-panel>
    `);
    const button = el.shadowRoot!.querySelector('[part="vote-button"]') as HTMLButtonElement;
    const rest = getComputedStyle(button).backgroundColor;
    const rect = button.getBoundingClientRect();
    try {
      await sendMouse({
        type: 'move',
        position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
      });
      await waitUntil(() => getComputedStyle(button).backgroundColor !== rest);
      expect(getComputedStyle(button).backgroundColor).to.not.equal(rest);
    } finally {
      await resetMouse();
    }
  });
});

describe('selected vote-button pointer feedback', () => {
  /** Resolves what a `declaration` computes to *inside this component's shadow root*, where the
   *  `--lr-*` design tokens live. */
  function resolvedInShadow(el: LyraComparePanel, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    el.shadowRoot!.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  async function themed(): Promise<LyraComparePanel> {
    const el = (await fixture(html`
      <lr-compare-panel
        vote="a"
        style="--lr-transition-fast: 0s; --lr-compare-panel-selected-background: rgb(0, 51, 102);"
      ></lr-compare-panel>
    `)) as LyraComparePanel;
    await el.updateComplete;
    return el;
  }

  async function moveMouseTo(target: HTMLElement): Promise<void> {
    target.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = target.getBoundingClientRect();
    await sendMouse({
      type: 'move',
      position: [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)],
    });
  }

  it('keeps the selected fill under the pointer instead of reverting to the generic hover tint', async function () {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
    const el = await themed();
    const selected = el.shadowRoot!.querySelector('[part="vote-button"][data-selected]') as HTMLElement;
    expect(selected != null, 'expected a selected vote button').to.equal(true);
    expect(getComputedStyle(selected).backgroundColor).to.equal('rgb(0, 51, 102)');

    try {
      await resetMouse();
      await moveMouseTo(selected);
      // Poll rather than assert immediately: a hover repaint that DOES happen needs a frame to
      // land, so an instant assertion would pass for the wrong reason.
      await waitUntil(
        () => getComputedStyle(selected).borderTopColor !== '',
        'the hovered vote button never resolved a computed style'
      );
      expect(getComputedStyle(selected).backgroundColor).to.equal('rgb(0, 51, 102)');
    } finally {
      await resetMouse();
    }
  });

  it('deepens the SELECTED vote button while it is held', async function () {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
    const el = await themed();
    const selected = el.shadowRoot!.querySelector('[part="vote-button"][data-selected]') as HTMLElement;
    const held = resolvedInShadow(
      el,
      'background: color-mix(in oklab, rgb(0, 51, 102), var(--lr-color-mix-partner) var(--lr-color-mix-active))',
      'background-color'
    );
    expect(held).to.not.equal('rgb(0, 51, 102)');

    try {
      await resetMouse();
      await moveMouseTo(selected);
      await sendMouse({ type: 'down' });
      await waitUntil(
        () => getComputedStyle(selected).backgroundColor === held,
        'the held selected vote button never painted a pressed step off its selected fill'
      );
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });

  it('deepens an UNSELECTED vote button while it is held -- the contrast case', async function () {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
    const el = await themed();
    const unselected = el.shadowRoot!.querySelector(
      '[part="vote-button"]:not([data-selected])'
    ) as HTMLElement;
    const hovered = resolvedInShadow(el, 'background: var(--lr-color-brand-quiet)', 'background-color');
    const held = resolvedInShadow(
      el,
      'background: color-mix(in oklab, var(--lr-color-brand-quiet), var(--lr-color-mix-partner) var(--lr-color-mix-active))',
      'background-color'
    );

    try {
      await resetMouse();
      await moveMouseTo(unselected);
      await waitUntil(
        () => getComputedStyle(unselected).backgroundColor === hovered,
        'the hovered unselected vote button never painted the brand-quiet tint'
      );
      await sendMouse({ type: 'down' });
      await waitUntil(
        () => getComputedStyle(unselected).backgroundColor === held,
        'the held unselected vote button never painted the pressed tint'
      );
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
  });

  it("restores the selected fill once the pointer is released", async function () {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches) this.skip();
    const el = await themed();
    const selected = el.shadowRoot!.querySelector('[part="vote-button"][data-selected]') as HTMLElement;
    try {
      await resetMouse();
      await moveMouseTo(selected);
      await sendMouse({ type: 'down' });
      await waitUntil(
        () => getComputedStyle(selected).backgroundColor !== 'rgb(0, 51, 102)',
        'the held selected vote button kept its resting fill'
      );
    } finally {
      await sendMouse({ type: 'up' });
      await resetMouse();
    }
    await waitUntil(
      () => getComputedStyle(selected).backgroundColor === 'rgb(0, 51, 102)',
      'the released selected vote button never returned to its selected fill'
    );
  });
});
