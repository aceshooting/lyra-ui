import { fixture, expect, html, oneEvent, aTimeout } from '@open-wc/testing';
import './compare-panel.js';
import type { LyraComparePanel } from './compare-panel.js';
import { styles } from './compare-panel.styles.js';

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

  it('hides the tie/both-bad buttons when hide-tie/hide-both-bad are set', async () => {
    const el = (await fixture(html`<lr-compare-panel hide-tie hide-both-bad></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelectorAll('[part="vote-button"]').length).to.equal(2);
  });

  it('resets vote to null when itemId changes', async () => {
    const el = (await fixture(html`<lr-compare-panel item-id="pair-1" vote="a"></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.vote).to.equal('a');
    el.itemId = 'pair-2';
    await el.updateComplete;
    expect(el.vote).to.be.null;
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

  it('falls back to the built-in English panel label and lets a host aria-label win', async () => {
    const el = (await fixture(html`<lr-compare-panel></lr-compare-panel>`)) as LyraComparePanel;
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Comparison');

    const withHostLabel = (await fixture(
      html`<lr-compare-panel aria-label="Eval pair 12"></lr-compare-panel>`,
    )) as LyraComparePanel;
    await withHostLabel.updateComplete;
    expect(withHostLabel.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Eval pair 12',
    );
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

  it('gives vote-button a hover state', () => {
    const css = styles.cssText.replace(/\s+/g, ' ');
    expect(css).to.match(/\[part='vote-button'\]:hover/);
  });
});
