import { toRgba } from '../../../../test/color-contrast.js';
import { expect, fixture, waitUntil } from '@open-wc/testing';
import { setViewport } from '@web/test-runner-commands';
import '../../lr-dialog.js';
import '../../lr-popover.js';
import type { LyraDialog } from '../../lr-dialog.js';
import type { LyraPopover } from '../../lr-popover.js';

const NO_MOTION = '--lr-duration-base: 0ms; --lr-duration-fast: 0ms; --show-duration: 0ms; --hide-duration: 0ms';
const TALL = Array.from({ length: 60 }, (_, index) => `Line ${index + 1}`).join('<br>');

const panelOf = (el: LyraDialog): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part~="panel"]')!;
const part = (el: LyraDialog, name: string): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>(`[part~="${name}"]`)!;

async function mount(attrs = '', style = '', body = 'Body'): Promise<LyraDialog> {
  const el = await fixture<LyraDialog>(
    `<lr-dialog open label="Sizing" ${attrs} data-lr-surface="solid" style="${NO_MOTION}; ${style}">${body}<button slot="footer">Done</button></lr-dialog>`,
  );
  await el.updateComplete;
  return el;
}

async function close(el: LyraDialog): Promise<void> {
  el.open = false;
  await el.updateComplete;
}

describe('lr-dialog sizing tokens', () => {
  it('caps the panel block size with --lr-dialog-max-height, viewport-capped while unset', async () => {
    const el = await mount('', '', TALL);
    const host = el.getBoundingClientRect();
    const unset = panelOf(el).getBoundingClientRect().height;
    el.style.setProperty('--lr-dialog-max-height', '200px');
    const capped = panelOf(el).getBoundingClientRect().height;
    el.style.setProperty('--lr-dialog-max-height', '200vh');
    const oversized = panelOf(el).getBoundingClientRect().height;
    await close(el);
    expect(Math.round(capped)).to.equal(200);
    expect(unset).to.be.greaterThan(200);
    expect(unset).to.be.at.most(host.height);
    expect(Math.round(oversized)).to.equal(Math.round(unset));
  });

  it('insets the panel from the viewport with --lr-dialog-viewport-inset', async () => {
    const el = await mount();
    const read = () => {
      const style = getComputedStyle(el);
      return [style.paddingBlockStart, style.paddingBlockEnd, style.paddingInlineStart, style.paddingInlineEnd];
    };
    const unset = read();
    el.style.setProperty('--lr-dialog-viewport-inset', 'var(--lr-space-l)');
    const explicitDefault = read();
    el.style.setProperty('--lr-dialog-viewport-inset', '4px');
    const custom = read();
    await close(el);
    expect(unset).to.deep.equal(explicitDefault);
    expect(custom).to.deep.equal(['4px', '4px', '4px', '4px']);
  });

  describe('fullscreen-narrow', () => {
    const original = { width: window.innerWidth, height: window.innerHeight };
    afterEach(async () => {
      await setViewport(original);
    });

    it('fills a narrow viewport edge to edge only when opted in', async () => {
      await setViewport({ width: 360, height: 640 });
      const plain = await mount('', '', TALL);
      const plainRect = panelOf(plain).getBoundingClientRect();
      await close(plain);

      const el = await mount('fullscreen-narrow', '', TALL);
      expect(el.fullscreenNarrow).to.equal(true);
      await waitUntil(
        () => Math.round(panelOf(el).getBoundingClientRect().width) === window.innerWidth,
        `panel fills the viewport: ${JSON.stringify([panelOf(el).getBoundingClientRect(), window.innerWidth, getComputedStyle(el).padding, getComputedStyle(panelOf(el)).transform])}`,
      );
      const rect = panelOf(el).getBoundingClientRect();
      const radius = getComputedStyle(panelOf(el)).borderStartStartRadius;
      await close(el);
      expect(plainRect.width).to.be.lessThan(window.innerWidth);
      expect([Math.round(rect.left), Math.round(rect.top)]).to.deep.equal([0, 0]);
      expect([Math.round(rect.width), Math.round(rect.height)]).to.deep.equal([window.innerWidth, window.innerHeight]);
      expect(radius).to.equal('0px');
    });

    it('follows a live viewport resize across the breakpoint and stops listening once removed', async () => {
      await setViewport({ width: 360, height: 640 });
      const el = await mount('fullscreen-narrow', '', TALL);
      await waitUntil(() => el.hasAttribute('data-fullscreen'), 'the narrow layout applies');
      await setViewport({ width: 1024, height: 768 });
      await waitUntil(() => !el.hasAttribute('data-fullscreen'), 'the wide layout returns');
      const wide = panelOf(el).getBoundingClientRect().width;
      el.fullscreenNarrow = false;
      await el.updateComplete;
      await setViewport({ width: 360, height: 640 });
      const optedOut = el.hasAttribute('data-fullscreen');
      el.fullscreenNarrow = true;
      await el.updateComplete;
      const optedIn = el.hasAttribute('data-fullscreen');
      el.remove();
      const removed = el.hasAttribute('data-fullscreen');
      expect(wide).to.be.lessThan(1024);
      expect([optedOut, optedIn, removed]).to.deep.equal([false, true, false]);
    });

    it('keeps the centered panel at wide viewports', async () => {
      await setViewport({ width: 1024, height: 768 });
      const el = await mount('fullscreen-narrow', '--lr-dialog-width: 300px', TALL);
      const rect = panelOf(el).getBoundingClientRect();
      await close(el);
      expect(Math.round(rect.width)).to.equal(300);
      expect(rect.top).to.be.greaterThan(0);
    });
  });

  it('paints --lr-dialog-panel-bg on the panel only, leaving nested popups on the overlay surface', async () => {
    const el = await mount('', '', `<lr-popover><button slot="trigger">More</button>Popup</lr-popover>`);
    const popover = el.querySelector<LyraPopover>('lr-popover')!;
    await popover.updateComplete;
    const popup = popover.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;
    el.style.setProperty('--lr-overlay-surface', 'rgb(4, 5, 6)');
    const sharedPanel = toRgba(getComputedStyle(panelOf(el)).backgroundColor).join();
    const sharedPopup = toRgba(getComputedStyle(popup).backgroundColor).join();
    el.style.setProperty('--lr-dialog-panel-bg', 'rgb(1, 2, 3)');
    const panel = toRgba(getComputedStyle(panelOf(el)).backgroundColor).join();
    el.style.removeProperty('--lr-overlay-surface');
    const popupAfter = toRgba(getComputedStyle(popup).backgroundColor).join();
    await close(el);
    expect([sharedPanel, sharedPopup]).to.deep.equal(['4,5,6,255', '4,5,6,255']);
    expect(panel).to.equal('1,2,3,255');
    expect(popupAfter).not.to.equal('1,2,3,255');
  });

  it('colours the header and footer dividers with --lr-dialog-divider-color, following --lr-overlay-border while unset', async () => {
    const el = await mount('', '--lr-overlay-border: rgb(7, 8, 9)');
    const read = () => [
      getComputedStyle(part(el, 'header')).borderBlockEndColor,
      getComputedStyle(part(el, 'footer')).borderBlockStartColor,
    ];
    const inherited = read();
    el.style.setProperty('--lr-dialog-divider-color', 'rgb(10, 11, 12)');
    const own = read();
    const panelEdge = getComputedStyle(panelOf(el)).borderBlockStartColor;
    await close(el);
    expect(inherited).to.deep.equal(['rgb(7, 8, 9)', 'rgb(7, 8, 9)']);
    expect(own).to.deep.equal(['rgb(10, 11, 12)', 'rgb(10, 11, 12)']);
    expect(panelEdge).to.equal('rgb(7, 8, 9)');
  });
});
