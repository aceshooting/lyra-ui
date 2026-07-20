import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { LitElement, html as litHtml } from 'lit';
import './avatar-group.js';
import '../avatar/avatar.js';
import type { LyraAvatarGroup } from './avatar-group.js';

// A minimal host that re-projects its own light-DOM children into a
// `<lr-avatar-group>` living in its shadow DOM via a forwarding `<slot>` --
// this is the "slot forwarding" scenario `firstUpdated()`'s fallback
// reconciliation exists for: `this.children` (the forwarding `<slot>` itself,
// one element) under-counts what the group's own default slot actually
// flattens to (the real projected `<lr-avatar>`s).
class AvatarGroupForwarder extends LitElement {
  protected createRenderRoot() {
    return this.attachShadow({ mode: 'open' });
  }
  protected render() {
    return litHtml`<lr-avatar-group max="2"><slot></slot></lr-avatar-group>`;
  }
}
customElements.define('avatar-group-forwarder-test', AvatarGroupForwarder);

function fiveAvatars() {
  return html`
    <lr-avatar-group max="3">
      <lr-avatar initials="AB"></lr-avatar>
      <lr-avatar initials="CD"></lr-avatar>
      <lr-avatar initials="EF"></lr-avatar>
      <lr-avatar initials="GH"></lr-avatar>
      <lr-avatar initials="IJ"></lr-avatar>
    </lr-avatar-group>
  `;
}

it('sanitizes a NaN/negative max to a finite non-negative integer instead of poisoning overflow math with NaN', async () => {
  const el = (await fixture(fiveAvatars())) as LyraAvatarGroup;

  el.max = NaN;
  expect(el.max).to.equal(0); // finiteCount's own fallback of 0 for a NaN input
  await el.updateComplete;
  const avatars = Array.from(el.querySelectorAll('lr-avatar')) as HTMLElement[];
  expect(avatars.every((a) => a.hidden)).to.be.true; // 0 visible, all 5 collapse behind the badge
  expect(el.shadowRoot!.querySelector('[part="overflow-badge"]')).to.exist;

  el.max = -5;
  expect(el.max).to.equal(0); // clamped to the non-negative floor

  el.max = undefined;
  expect(el.max).to.be.undefined; // explicitly unsetting still means "no limit"
});

it('defaults max to undefined, size to md, shape to circle, tone to neutral -- no overflow badge, every avatar visible', async () => {
  const el = (await fixture(html`
    <lr-avatar-group>
      <lr-avatar initials="AB"></lr-avatar>
      <lr-avatar initials="CD"></lr-avatar>
    </lr-avatar-group>
  `)) as LyraAvatarGroup;
  expect(el.max).to.be.undefined;
  expect(el.size).to.equal('md');
  expect(el.shape).to.equal('circle');
  expect(el.tone).to.equal('neutral');
  expect(el.shadowRoot!.querySelector('[part="overflow-badge"]')).to.not.exist;
  const avatars = Array.from(el.querySelectorAll('lr-avatar')) as HTMLElement[];
  expect(avatars.every((a) => !a.hidden)).to.be.true;
});

it('reflects size/shape/tone as attributes for CSS selectors', async () => {
  const el = (await fixture(html`
    <lr-avatar-group size="lg" shape="square" tone="brand">
      <lr-avatar></lr-avatar>
    </lr-avatar-group>
  `)) as LyraAvatarGroup;
  expect(el.getAttribute('size')).to.equal('lg');
  expect(el.getAttribute('shape')).to.equal('square');
  expect(el.getAttribute('tone')).to.equal('brand');
});

it('shows every avatar with no badge when max is greater than or equal to the child count', async () => {
  const el = (await fixture(html`
    <lr-avatar-group max="5">
      <lr-avatar initials="AB"></lr-avatar>
      <lr-avatar initials="CD"></lr-avatar>
    </lr-avatar-group>
  `)) as LyraAvatarGroup;
  expect(el.shadowRoot!.querySelector('[part="overflow-badge"]')).to.not.exist;
  const avatars = Array.from(el.querySelectorAll('lr-avatar')) as HTMLElement[];
  expect(avatars.every((a) => !a.hidden)).to.be.true;
});

describe('overflow behavior', () => {
  it('hides avatars beyond max and renders a "+N" overflow badge', async () => {
    const el = (await fixture(fiveAvatars())) as LyraAvatarGroup;
    const avatars = Array.from(el.querySelectorAll('lr-avatar')) as HTMLElement[];
    expect(avatars.map((a) => a.hidden)).to.deep.equal([false, false, false, true, true]);

    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLElement;
    expect(badge).to.exist;
    expect(badge.textContent!.trim()).to.equal('+2');
    // The ordinary (not-sole-visible) case keeps the normal overlap margin --
    // contrasted against the max=0 regression test below.
    expect(getComputedStyle(badge).marginInlineStart).to.equal('-6px');
  });

  it('hides every avatar and shows a "+{childCount}" badge with zero own margin when max=0', async () => {
    const el = (await fixture(html`
      <lr-avatar-group max="0">
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD"></lr-avatar>
        <lr-avatar initials="EF"></lr-avatar>
      </lr-avatar-group>
    `)) as LyraAvatarGroup;
    const avatars = Array.from(el.querySelectorAll('lr-avatar')) as HTMLElement[];
    expect(avatars.every((a) => a.hidden)).to.be.true;

    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLElement;
    expect(badge).to.exist;
    expect(badge.textContent!.trim()).to.equal('+3');
    // The badge is the first *visible* thing in the row here (every avatar is
    // hidden), so its own margin-inline-start must be zeroed rather than
    // carrying the normal overlap value.
    expect(getComputedStyle(badge).marginInlineStart).to.equal('0px');
  });
});

describe('dynamic children', () => {
  it('recomputes overflow when an avatar is appended after first render', async () => {
    const el = (await fixture(html`
      <lr-avatar-group max="2">
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD"></lr-avatar>
      </lr-avatar-group>
    `)) as LyraAvatarGroup;
    expect(el.shadowRoot!.querySelector('[part="overflow-badge"]')).to.not.exist;

    const extra = document.createElement('lr-avatar');
    extra.setAttribute('initials', 'EF');
    el.appendChild(extra);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await el.updateComplete;

    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLElement;
    expect(badge).to.exist;
    expect(badge.textContent!.trim()).to.equal('+1');
    expect((extra as HTMLElement).hidden).to.be.true;
  });

  it('recomputes overflow when an avatar is removed after first render', async () => {
    const el = (await fixture(fiveAvatars())) as LyraAvatarGroup;
    expect(el.shadowRoot!.querySelector('[part="overflow-badge"]')).to.exist;

    const avatars = Array.from(el.querySelectorAll('lr-avatar'));
    avatars.slice(2).forEach((a) => el.removeChild(a));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('[part="overflow-badge"]')).to.not.exist;
    const remaining = Array.from(el.querySelectorAll('lr-avatar')) as HTMLElement[];
    expect(remaining.every((a) => !a.hidden)).to.be.true;
  });
});

it('reconciles childCount correctly through a forwarding <slot> (children.length under-counts), without a redundant explicit resync alongside it', async () => {
  // Reset Lit's own dedupe set first so this doesn't silently pass just
  // because an earlier test already tripped (and thus suppressed) the exact
  // same warning string -- same guard `<lr-chip-group>`'s equivalent test
  // uses.
  const globalWarnings = (globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings;
  if (globalWarnings) {
    [...globalWarnings].filter((w) => w.includes('scheduled an update')).forEach((w) => globalWarnings.delete(w));
  }

  const originalWarn = console.warn;
  const calls: unknown[][] = [];
  console.warn = (...args: unknown[]) => calls.push(args);
  let host: AvatarGroupForwarder;
  try {
    host = (await fixture(html`
      <avatar-group-forwarder-test>
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD"></lr-avatar>
        <lr-avatar initials="EF"></lr-avatar>
      </avatar-group-forwarder-test>
    `)) as AvatarGroupForwarder;
    await host.updateComplete;
    const group = host.shadowRoot!.querySelector('lr-avatar-group') as LyraAvatarGroup;
    // The childCount correction inside firstUpdated() schedules a second,
    // separate update cycle (that's the whole warning this test is about) --
    // a single `await updateComplete` only guarantees the *current* cycle
    // finished, so loop until nothing more is pending.
    while (!(await group.updateComplete)) {
      /* keep draining until settled */
    }

    const badge = group.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLElement;
    expect(badge).to.exist;
    expect(badge.textContent!.trim()).to.equal('+1');
    const forwardedAvatars = Array.from(host.querySelectorAll('lr-avatar')) as HTMLElement[];
    expect(forwardedAvatars.map((avatar) => avatar.hidden)).to.deep.equal([false, false, true]);
  } finally {
    console.warn = originalWarn;
  }

  const messages = calls.flat().map(String);
  expect(messages.some((m) => m.includes('scheduled an update'))).to.be.true;
});

describe('overflow badge activation', () => {
  it('fires lr-overflow-click with the correct hiddenCount/hiddenAvatars on click', async () => {
    const el = (await fixture(fiveAvatars())) as LyraAvatarGroup;
    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLButtonElement;

    // oneEvent() listener set up before the synchronous click, not after.
    setTimeout(() => badge.click());
    const ev = await oneEvent(el, 'lr-overflow-click');

    expect(ev.detail.hiddenCount).to.equal(2);
    // Deliberately avoid deep-equality against the raw element array (chai/loupe's
    // DOM-diff formatting can hang the whole test file) -- compare length and a
    // cheap per-element projection instead.
    expect(ev.detail.hiddenAvatars.length).to.equal(2);
    expect(ev.detail.hiddenAvatars.map((a: HTMLElement) => a.getAttribute('initials'))).to.deep.equal(['GH', 'IJ']);
  });

  it('is a plain, natively-focusable <button type="button"> with no explicit tabindex -- Enter/Space activation needs no custom keydown handler', async () => {
    const el = (await fixture(fiveAvatars())) as LyraAvatarGroup;
    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLButtonElement;
    expect(badge.tagName).to.equal('BUTTON');
    expect(badge.getAttribute('type')).to.equal('button');
    expect(badge.hasAttribute('tabindex')).to.be.false;
  });

  it('does not unhide avatars or change its own text/aria-label on click (non-toggle behavior)', async () => {
    const el = (await fixture(fiveAvatars())) as LyraAvatarGroup;
    const badge = () => el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLButtonElement;
    const textBefore = badge().textContent!.trim();
    const labelBefore = badge().getAttribute('aria-label');

    setTimeout(() => badge().click());
    await oneEvent(el, 'lr-overflow-click');
    await el.updateComplete;

    const avatars = Array.from(el.querySelectorAll('lr-avatar')) as HTMLElement[];
    expect(avatars.map((a) => a.hidden)).to.deep.equal([false, false, false, true, true]);
    expect(badge().textContent!.trim()).to.equal(textBefore);
    expect(badge().getAttribute('aria-label')).to.equal(labelBefore);
  });

  it('never renders aria-expanded on the overflow badge, in any state -- regression guard against copying lr-chip-group by rote', async () => {
    const el = (await fixture(fiveAvatars())) as LyraAvatarGroup;
    const badge = () => el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLButtonElement;
    expect(badge().hasAttribute('aria-expanded')).to.be.false;

    setTimeout(() => badge().click());
    await oneEvent(el, 'lr-overflow-click');
    await el.updateComplete;

    expect(badge().hasAttribute('aria-expanded')).to.be.false;
  });
});

describe('accessible name (label / host aria-label precedence)', () => {
  it('sets role="group" and aria-label from the label prop', async () => {
    const el = (await fixture(html`
      <lr-avatar-group label="Team members"><lr-avatar initials="AB"></lr-avatar></lr-avatar-group>
    `)) as LyraAvatarGroup;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('role')).to.equal('group');
    expect(base.getAttribute('aria-label')).to.equal('Team members');
  });

  it('prefers a host aria-label over the label prop when both are set (regression)', async () => {
    const el = (await fixture(html`
      <lr-avatar-group label="Team members" aria-label="Something else">
        <lr-avatar initials="AB"></lr-avatar>
      </lr-avatar-group>
    `)) as LyraAvatarGroup;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Something else');
  });

  it('falls back to a host aria-label when label is unset', async () => {
    const el = (await fixture(html`
      <lr-avatar-group aria-label="Team members"><lr-avatar initials="AB"></lr-avatar></lr-avatar-group>
    `)) as LyraAvatarGroup;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.getAttribute('aria-label')).to.equal('Team members');
  });

  it('renders no aria-label at all when neither label nor host aria-label is set', async () => {
    const el = (await fixture(html`
      <lr-avatar-group><lr-avatar initials="AB"></lr-avatar></lr-avatar-group>
    `)) as LyraAvatarGroup;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.hasAttribute('aria-label')).to.be.false;
  });
});

describe('localization', () => {
  it('defaults to a plain "+N" when no strings override is set', async () => {
    const el = (await fixture(html`
      <lr-avatar-group max="1">
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD"></lr-avatar>
        <lr-avatar initials="EF"></lr-avatar>
      </lr-avatar-group>
    `)) as LyraAvatarGroup;
    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLButtonElement;
    expect(badge.textContent!.trim()).to.equal('+2');
  });

  it('defaults to English "Show N more" for the aria-label when no strings override is set', async () => {
    const el = (await fixture(html`
      <lr-avatar-group max="1">
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD"></lr-avatar>
        <lr-avatar initials="EF"></lr-avatar>
      </lr-avatar-group>
    `)) as LyraAvatarGroup;
    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLButtonElement;
    expect(badge.getAttribute('aria-label')).to.equal('Show 2 more');
  });

  it('localizes the collapsed overflow-badge visible text via this.localize(), not a hardcoded "+N"', async () => {
    const el = (await fixture(html`
      <lr-avatar-group max="1" .strings=${{ showMoreCollapsed: '{count} de plus' }}>
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD"></lr-avatar>
        <lr-avatar initials="EF"></lr-avatar>
      </lr-avatar-group>
    `)) as LyraAvatarGroup;
    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLButtonElement;
    expect(badge.textContent!.trim()).to.equal('2 de plus');
  });

  it('localizes the overflow-badge aria-label via this.localize(), not hardcoded English', async () => {
    const el = (await fixture(html`
      <lr-avatar-group max="1" .strings=${{ showMoreCount: '{count} de plus' }}>
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD"></lr-avatar>
        <lr-avatar initials="EF"></lr-avatar>
      </lr-avatar-group>
    `)) as LyraAvatarGroup;
    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLButtonElement;
    expect(badge.getAttribute('aria-label')).to.equal('2 de plus');
  });
});

it('flips the resolved overlap margin under dir="rtl" (Chromium resolves logical properties to physical margin-left/margin-right)', async () => {
  const ltrEl = (await fixture(html`
    <lr-avatar-group dir="ltr">
      <lr-avatar initials="AB"></lr-avatar>
      <lr-avatar initials="CD"></lr-avatar>
    </lr-avatar-group>
  `)) as LyraAvatarGroup;
  const ltrSecond = ltrEl.querySelectorAll('lr-avatar')[1] as HTMLElement;
  const ltrStyle = getComputedStyle(ltrSecond);
  expect(ltrStyle.marginLeft).to.equal('-6px');
  expect(ltrStyle.marginRight).to.equal('0px');

  // dir="rtl" is set on the fixture markup itself (not mutated after
  // connection) so the RTL computed style is this element's very first style
  // resolution.
  const rtlEl = (await fixture(html`
    <lr-avatar-group dir="rtl">
      <lr-avatar initials="AB"></lr-avatar>
      <lr-avatar initials="CD"></lr-avatar>
    </lr-avatar-group>
  `)) as LyraAvatarGroup;
  const rtlSecond = rtlEl.querySelectorAll('lr-avatar')[1] as HTMLElement;
  const rtlStyle = getComputedStyle(rtlSecond);
  expect(rtlStyle.marginRight).to.equal('-6px');
  expect(rtlStyle.marginLeft).to.equal('0px');
});

describe('design tokens reach rendered CSS', () => {
  it('resolves --lr-avatar-group-avatar-size/-overlap through the size token chain (lg tier)', async () => {
    const el = (await fixture(html`
      <lr-avatar-group size="lg"><lr-avatar></lr-avatar></lr-avatar-group>
    `)) as LyraAvatarGroup;
    const hostStyle = getComputedStyle(el);
    expect(hostStyle.getPropertyValue('--lr-avatar-group-avatar-size').trim()).to.equal('2.5rem');
    expect(hostStyle.getPropertyValue('--lr-avatar-group-overlap').trim()).to.equal('-8px');
  });

  it('resolves --lr-avatar-group-badge-bg/-color through the tone token chain and applies them to the rendered badge (brand tier)', async () => {
    const el = (await fixture(html`
      <lr-avatar-group max="0" tone="brand"><lr-avatar initials="AB"></lr-avatar></lr-avatar-group>
    `)) as LyraAvatarGroup;
    const hostStyle = getComputedStyle(el);
    expect(hostStyle.getPropertyValue('--lr-avatar-group-badge-bg').trim()).to.equal('#ddf4ff');
    expect(hostStyle.getPropertyValue('--lr-avatar-group-badge-color').trim()).to.equal('#0969da');

    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLElement;
    expect(getComputedStyle(badge).backgroundColor).to.equal('rgb(221, 244, 255)');
    expect(getComputedStyle(badge).color).to.equal('rgb(9, 105, 218)');
  });
});

it('can shrink to a 320px allocation with several overflowing avatars', async () => {
  const wrapper = await fixture(html`
    <div style="display: flex; inline-size: 320px;">
      <lr-avatar-group max="4">
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD"></lr-avatar>
        <lr-avatar initials="EF"></lr-avatar>
        <lr-avatar initials="GH"></lr-avatar>
        <lr-avatar initials="IJ"></lr-avatar>
        <lr-avatar initials="KL"></lr-avatar>
        <lr-avatar initials="MN"></lr-avatar>
      </lr-avatar-group>
    </div>
  `);
  const el = wrapper.querySelector('lr-avatar-group') as LyraAvatarGroup;
  await el.updateComplete;
  expect(el.getBoundingClientRect().width).to.be.at.most(320);
});

it('is accessible', async () => {
  const el = (await fixture(html`
    <lr-avatar-group label="Team members">
      <lr-avatar initials="AB"></lr-avatar>
      <lr-avatar initials="CD" tone="brand"></lr-avatar>
    </lr-avatar-group>
  `)) as LyraAvatarGroup;
  await expect(el).to.be.accessible();
});

it('is accessible in an overflowing state', async () => {
  const el = (await fixture(html`
    <lr-avatar-group max="2" label="Team members">
      <lr-avatar initials="AB"></lr-avatar>
      <lr-avatar initials="CD"></lr-avatar>
      <lr-avatar initials="EF"></lr-avatar>
    </lr-avatar-group>
  `)) as LyraAvatarGroup;
  await expect(el).to.be.accessible();
});

describe('per-size overflow-badge font-size', () => {
  const renderedBadgeFontSize = async (size?: string): Promise<number> => {
    const el = (await fixture(
      size == null
        ? html`<lr-avatar-group max="1"
            ><lr-avatar initials="AB"></lr-avatar><lr-avatar initials="CD"></lr-avatar
          ></lr-avatar-group>`
        : html`<lr-avatar-group size=${size} max="1"
            ><lr-avatar initials="AB"></lr-avatar><lr-avatar initials="CD"></lr-avatar
          ></lr-avatar-group>`,
    )) as LyraAvatarGroup;
    await el.updateComplete;
    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLElement;
    return Number.parseFloat(getComputedStyle(badge).fontSize);
  };

  it('scales the rendered "+N" badge font-size with size', async () => {
    const [sm, md, lg] = [
      await renderedBadgeFontSize('sm'),
      await renderedBadgeFontSize('md'),
      await renderedBadgeFontSize('lg'),
    ];
    expect(sm, 'sm < md').to.be.lessThan(md);
    expect(lg, 'lg > md').to.be.greaterThan(md);
  });

  it('leaves the default (md) tier byte-identical to today', async () => {
    expect(await renderedBadgeFontSize()).to.equal(13);
    expect(await renderedBadgeFontSize('md')).to.equal(13);
  });

  it('lets a consumer override --lr-avatar-group-badge-font-size at any tier', async () => {
    const el = (await fixture(html`
      <lr-avatar-group size="sm" max="1" label="Team">
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD"></lr-avatar>
      </lr-avatar-group>
    `)) as LyraAvatarGroup;
    el.style.setProperty('--lr-avatar-group-badge-font-size', '19px');
    await el.updateComplete;
    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLElement;
    expect(getComputedStyle(badge).fontSize).to.equal('19px');
    await expect(el).to.be.accessible();
  });
});
