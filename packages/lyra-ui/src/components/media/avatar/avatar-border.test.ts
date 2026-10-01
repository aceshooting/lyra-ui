import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './avatar.js';
import '../avatar-group/avatar-group.js';
import type { LyraAvatar, LyraAvatarShape } from './avatar.js';
import { setForcedColors } from '../../../../test/wtr-media.js';

const IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="2" height="2"%3E%3Crect width="2" height="2" fill="green"/%3E%3C/svg%3E';

function base(avatar: LyraAvatar): HTMLElement {
  return avatar.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
}

describe('lr-avatar border token', () => {
  it('keeps the unset normal border and appearance across every size tier', async () => {
    const avatar = await fixture<LyraAvatar>(html`<lr-avatar initials="AB"></lr-avatar>`);
    for (const size of ['2xs', 'xs', 's', 'm', 'l', 'xl'] as const) {
      avatar.size = size;
      await avatar.updateComplete;
      const before = getComputedStyle(base(avatar));
      const diameter = base(avatar).getBoundingClientRect().width;
      const background = before.backgroundColor;
      const color = before.color;
      expect(before.borderTopStyle).to.equal('none');
      expect(before.borderTopWidth).to.equal('0px');
      avatar.style.setProperty('--lr-avatar-border', '3px solid rgb(12, 34, 56)');
      const bordered = getComputedStyle(base(avatar));
      expect(bordered.borderTopWidth).to.equal('3px');
      expect(bordered.backgroundColor).to.equal(background);
      expect(bordered.color).to.equal(color);
      expect(base(avatar).getBoundingClientRect().width).to.equal(diameter);
      expect(base(avatar).getBoundingClientRect().height).to.equal(diameter);
      avatar.style.removeProperty('--lr-avatar-border');
      expect(getComputedStyle(base(avatar)).borderTopStyle).to.equal('none');
    }
  });

  for (const shape of ['circle', 'rounded', 'square'] satisfies LyraAvatarShape[]) {
    it(`inherits and overrides the border for every ${shape} content tier`, async () => {
      const wrapper = await fixture<HTMLDivElement>(html`
        <div style="--lr-avatar-border: 3px dashed rgb(12, 34, 56); --lr-avatar-size: 56px">
          <lr-avatar shape=${shape} initials="AB" label="Initials"></lr-avatar>
          <lr-avatar shape=${shape} label="Glyph"><span slot="icon">★</span></lr-avatar>
          <lr-avatar shape=${shape} image=${IMAGE} label="Photo"></lr-avatar>
        </div>
      `);
      const avatars = Array.from(wrapper.querySelectorAll<LyraAvatar>('lr-avatar'));
      await Promise.all(avatars.map((avatar) => avatar.updateComplete));
      const image = avatars[2]!.shadowRoot!.querySelector<HTMLImageElement>('[part="image"]')!;
      await waitUntil(() => image.complete && image.naturalWidth > 0, 'avatar image loads');
      expect(avatars[0]!.shadowRoot!.querySelector('[part="initials"]')!.textContent).to.equal('AB');
      expect(avatars[1]!.shadowRoot!.querySelector('[part="icon"]')!.hasAttribute('hidden')).to.equal(false);
      for (const avatar of avatars) {
        const surface = base(avatar);
        const inherited = getComputedStyle(surface);
        const radius = inherited.borderTopLeftRadius;
        expect(inherited.borderTopWidth).to.equal('3px');
        expect(inherited.borderTopStyle).to.equal('dashed');
        expect(inherited.borderTopColor).to.equal('rgb(12, 34, 56)');
        expect(surface.getBoundingClientRect().width).to.equal(56);
        expect(surface.getBoundingClientRect().height).to.equal(56);
        avatar.style.setProperty('--lr-avatar-border', '5px double rgb(65, 43, 21)');
        const direct = getComputedStyle(surface);
        expect(direct.borderTopWidth).to.equal('5px');
        expect(direct.borderTopStyle).to.equal('double');
        expect(direct.borderTopColor).to.equal('rgb(65, 43, 21)');
        expect(direct.borderTopLeftRadius).to.equal(radius);
        expect(surface.getBoundingClientRect().width).to.equal(56);
        expect(surface.getBoundingClientRect().height).to.equal(56);
      }
      expect(getComputedStyle(image).objectFit).to.equal('cover');
      expect(image.getBoundingClientRect().width).to.equal(46);
      expect(image.getBoundingClientRect().height).to.equal(46);
    });
  }

  it('preserves upstream diameter precedence, custom radius and base part styling', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`
      <div>
        <style>
          .part-border::part(base) { border: 7px dotted rgb(76, 54, 32); }
        </style>
        <lr-avatar initials="AB" shape="square"
          style="--size: 60px; --lr-avatar-size: 56px; --lr-avatar-radius: 9px; --lr-avatar-border: 4px solid red"
        ></lr-avatar>
      </div>
    `);
    const avatar = wrapper.querySelector<LyraAvatar>('lr-avatar')!;
    await avatar.updateComplete;
    expect(base(avatar).getBoundingClientRect().width).to.equal(60);
    expect(getComputedStyle(base(avatar)).borderTopLeftRadius).to.equal('9px');
    avatar.classList.add('part-border');
    expect(getComputedStyle(base(avatar)).borderTopWidth).to.equal('7px');
    expect(getComputedStyle(base(avatar)).borderTopStyle).to.equal('dotted');
    expect(getComputedStyle(base(avatar)).borderTopColor).to.equal('rgb(76, 54, 32)');
    expect(base(avatar).getBoundingClientRect().width).to.equal(60);
    expect(base(avatar).getBoundingClientRect().height).to.equal(60);
  });

  it('keeps group overlap, ring and outer geometry when children inherit a border', async () => {
    const group = await fixture<HTMLElement>(html`
      <lr-avatar-group style="--lr-avatar-size: 52px">
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD"></lr-avatar>
      </lr-avatar-group>
    `);
    const avatars = Array.from(group.querySelectorAll<LyraAvatar>('lr-avatar'));
    await Promise.all(avatars.map((avatar) => avatar.updateComplete));
    const width = group.getBoundingClientRect().width;
    const overlap = getComputedStyle(avatars[1]!).marginInlineStart;
    const ring = getComputedStyle(avatars[1]!).boxShadow;
    expect(ring).to.not.equal('none');
    group.style.setProperty('--lr-avatar-border', '4px solid rgb(12, 34, 56)');
    expect(group.getBoundingClientRect().width).to.equal(width);
    expect(getComputedStyle(avatars[1]!).marginInlineStart).to.equal(overlap);
    expect(getComputedStyle(avatars[1]!).boxShadow).to.equal(ring);
    for (const avatar of avatars) {
      expect(getComputedStyle(base(avatar)).borderTopWidth).to.equal('4px');
      expect(base(avatar).getBoundingClientRect().width).to.equal(52);
    }
  });

  it('preserves the system boundary and diameter in forced colors', async function () {
    await setForcedColors('active');
    try {
      if (!matchMedia('(forced-colors: active)').matches) this.skip();
      const wrapper = await fixture<HTMLDivElement>(html`
        <div>
          <span style="color: CanvasText">System color</span>
          <lr-avatar initials="AB" style="--size: 56px; --lr-avatar-border: 7px dashed red"></lr-avatar>
          <lr-avatar initials="CD" style="--size: 56px"></lr-avatar>
        </div>
      `);
      const avatars = Array.from(wrapper.querySelectorAll<LyraAvatar>('lr-avatar'));
      await Promise.all(avatars.map((avatar) => avatar.updateComplete));
      const systemColor = getComputedStyle(wrapper.querySelector('span')!).color;
      for (const avatar of avatars) {
        const style = getComputedStyle(base(avatar));
        expect(style.borderTopStyle).to.equal('solid');
        expect(style.borderTopWidth).to.equal(getComputedStyle(avatar).getPropertyValue('--lr-border-width-thin').trim());
        expect(style.borderTopColor).to.equal(systemColor);
        expect(base(avatar).getBoundingClientRect().width).to.equal(56);
        expect(base(avatar).getBoundingClientRect().height).to.equal(56);
      }
    } finally {
      await setForcedColors('none');
    }
  });
});
