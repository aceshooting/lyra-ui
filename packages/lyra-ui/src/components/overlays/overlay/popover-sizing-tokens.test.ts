import { expect, fixture, waitUntil } from '@open-wc/testing';
import '../../lr-popover.js';
import '../../lr-dropdown.js';
import '../../lr-dropdown-item.js';
import type { LyraPopover } from '../../lr-popover.js';
import type { LyraDropdown } from '../../lr-dropdown.js';

const NO_MOTION = '--lr-duration-base: 0ms; --lr-duration-fast: 0ms; --lr-transition-fast: 0ms; --show-duration: 0ms; --hide-duration: 0ms';

const popupOf = (el: LyraPopover): HTMLElement => el.shadowRoot!.querySelector<HTMLElement>('[part~="popup"]')!;

async function openPopover(tag: 'lr-popover' | 'lr-dropdown', attrs = '', style = ''): Promise<LyraPopover> {
  const body = tag === 'lr-dropdown' ? '<lr-dropdown-item>One</lr-dropdown-item>' : '<span>Hi</span>';
  const wrapper = await fixture<HTMLDivElement>(
    `<div style="padding: 40px"><${tag} ${attrs} style="${NO_MOTION}; ${style}"><button slot="trigger">Open</button>${body}</${tag}></div>`,
  );
  const el = wrapper.querySelector<LyraPopover>(tag)!;
  await el.updateComplete;
  await el.show();
  await waitUntil(() => popupOf(el).getBoundingClientRect().width > 0 && popupOf(el).style.left !== '', 'the popup is placed');
  return el;
}

async function close(el: LyraPopover): Promise<void> {
  await el.hide({ focusTrigger: false });
}

describe('lr-popover sizing tokens', () => {
  it('pads the content with --lr-overlay-content-padding, var(--lr-space-m) while unset', async () => {
    const el = await openPopover('lr-popover');
    const content = el.shadowRoot!.querySelector<HTMLElement>('[part~="content"]')!;
    const unset = getComputedStyle(content).paddingInlineStart;
    el.style.setProperty('--lr-overlay-content-padding', 'var(--lr-space-m)');
    const explicitDefault = getComputedStyle(content).paddingInlineStart;
    el.style.setProperty('--lr-overlay-content-padding', '3px 5px');
    const custom = [getComputedStyle(content).paddingBlockStart, getComputedStyle(content).paddingInlineStart];
    await close(el);
    expect(unset).to.equal(explicitDefault);
    expect(custom).to.deep.equal(['3px', '5px']);
  });

  for (const tag of ['lr-popover', 'lr-dropdown'] as const) {
    it(`${tag}: sizes the popup with --lr-overlay-inline-size and floors it with --lr-overlay-min-inline-size`, async () => {
      const el = await openPopover(tag);
      const natural = popupOf(el).getBoundingClientRect().width;
      el.style.setProperty('--lr-overlay-min-inline-size', '300px');
      const floored = popupOf(el).getBoundingClientRect().width;
      el.style.removeProperty('--lr-overlay-min-inline-size');
      el.style.setProperty('--lr-overlay-inline-size', '250px');
      const sized = popupOf(el).getBoundingClientRect().width;
      await close(el);
      expect(natural).to.be.lessThan(250);
      expect(Math.round(floored)).to.equal(300);
      expect(Math.round(sized)).to.equal(250);
    });
  }

  it('lr-dropdown top-layer popup honours --lr-overlay-inline-size too', async () => {
    const el = await openPopover('lr-dropdown', 'top-layer', '--lr-overlay-inline-size: 250px');
    const width = popupOf(el).getBoundingClientRect().width;
    await close(el);
    expect(Math.round(width)).to.equal(250);
  });

  it('caps the min-inline-size floor at the available viewport space', async () => {
    const el = await openPopover('lr-popover', '', '--lr-overlay-min-inline-size: 5000px');
    const width = popupOf(el).getBoundingClientRect().width;
    await close(el);
    expect(width).to.be.at.most(window.innerWidth);
  });

  for (const tag of ['lr-popover', 'lr-dropdown'] as const) {
    it(`${tag}: full-width-trigger stretches the host, the trigger wrapper and the slotted trigger`, async () => {
      const wrapper = await fixture<HTMLDivElement>(
        `<div style="inline-size: 400px"><${tag} style="${NO_MOTION}"><button slot="trigger">Open</button><span>Hi</span></${tag}><${tag} full-width-trigger style="${NO_MOTION}"><button slot="trigger">Open</button><span>Hi</span></${tag}></div>`,
      );
      const [plain, full] = [...wrapper.querySelectorAll<LyraPopover | LyraDropdown>(tag)];
      await Promise.all([plain!.updateComplete, full!.updateComplete]);
      const width = (node: Element) => Math.round(node.getBoundingClientRect().width);
      const trigger = full!.shadowRoot!.querySelector('[part="trigger"]')!;
      expect(plain!.fullWidthTrigger).to.equal(false);
      expect(full!.fullWidthTrigger).to.equal(true);
      expect(width(plain!)).to.be.lessThan(400);
      expect([width(full!), width(trigger), width(full!.querySelector('button')!)]).to.deep.equal([400, 400, 400]);
    });
  }
});
