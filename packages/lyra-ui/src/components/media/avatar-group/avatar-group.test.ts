import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import { LitElement, html as litHtml } from 'lit';
import './avatar-group.js';
import '../avatar/avatar.js';
import type { LyraAvatarGroup } from './avatar-group.js';

const isGroupHidden = (avatar: Element): boolean =>
  avatar.hasAttribute('data-lr-avatar-group-hidden');

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
  expect(avatars.every(isGroupHidden)).to.be.true; // 0 visible, all 5 collapse behind the badge
  expect(el.shadowRoot!.querySelector('[part="overflow-badge"]')).to.exist;

  el.max = -5;
  expect(el.max).to.equal(0); // clamped to the non-negative floor

  el.max = undefined;
  expect(el.max).to.be.undefined; // explicitly unsetting still means "no limit"
});

it('defaults max to undefined, size to medium, shape to circle, variant to neutral -- no overflow badge, every avatar visible', async () => {
  const el = (await fixture(html`
    <lr-avatar-group>
      <lr-avatar initials="AB"></lr-avatar>
      <lr-avatar initials="CD"></lr-avatar>
    </lr-avatar-group>
  `)) as LyraAvatarGroup;
  expect(el.max).to.be.undefined;
  expect(el.size).to.equal('medium');
  expect(el.shape).to.equal('circle');
  expect(el.variant).to.equal('neutral');
  expect((el.shadowRoot!.querySelector('[part="overflow-badge"]')) == null).to.be.true;
  const avatars = Array.from(el.querySelectorAll('lr-avatar')) as HTMLElement[];
  expect(avatars.every((a) => !isGroupHidden(a))).to.be.true;
});

it('spells its default size the same way lr-avatar does, and renders the same diameter', async () => {
  // The two components used to default to different spellings of the same tier ('md' here,
  // 'medium' on lr-avatar). They read as two vocabularies, and a consumer reasoning from one
  // default to the other got the wrong answer -- so assert the *rendered* diameter as well as the
  // spelling, since only the former is what the stack actually looks like.
  const group = (await fixture(html`
    <lr-avatar-group><lr-avatar initials="AB"></lr-avatar></lr-avatar-group>
  `)) as LyraAvatarGroup;
  const standalone = (await fixture(html`<lr-avatar initials="AB"></lr-avatar>`)) as HTMLElement;
  await group.updateComplete;

  const grouped = group.querySelector('lr-avatar') as HTMLElement;
  const diameterOf = (avatar: HTMLElement): string =>
    getComputedStyle((avatar as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot.querySelector('[part="base"]') as HTMLElement)
      .inlineSize;

  expect(group.size, 'the group defaults to the canonical medium spelling').to.equal('medium');
  expect(diameterOf(grouped), 'a default avatar inside a default group matches a standalone one').to.equal(
    diameterOf(standalone),
  );
  // ...and the group's own badge box tracks that same tier, so a "+N" circle can't be a
  // different size from the avatars it caps.
  expect(diameterOf(grouped)).to.equal('48px');
});

it('reflects size/shape/variant as attributes for CSS selectors', async () => {
  const el = (await fixture(html`
    <lr-avatar-group size="large" shape="square" variant="brand">
      <lr-avatar></lr-avatar>
    </lr-avatar-group>
  `)) as LyraAvatarGroup;
  expect(el.getAttribute('size')).to.equal('large');
  expect(el.getAttribute('shape')).to.equal('square');
  expect(el.getAttribute('variant')).to.equal('brand');
});

it('exposes no `tone` property at all — `variant` replaced it outright, with no alias', async () => {
  const el = (await fixture(html`<lr-avatar-group><lr-avatar></lr-avatar></lr-avatar-group>`)) as LyraAvatarGroup;
  expect('tone' in el, 'tone is gone from the instance').to.be.false;
});

it('shows every avatar with no badge when max is greater than or equal to the child count', async () => {
  const el = (await fixture(html`
    <lr-avatar-group max="5">
      <lr-avatar initials="AB"></lr-avatar>
      <lr-avatar initials="CD"></lr-avatar>
    </lr-avatar-group>
  `)) as LyraAvatarGroup;
  expect((el.shadowRoot!.querySelector('[part="overflow-badge"]')) == null).to.be.true;
  const avatars = Array.from(el.querySelectorAll('lr-avatar')) as HTMLElement[];
  expect(avatars.every((a) => !isGroupHidden(a))).to.be.true;
});

describe('overflow behavior', () => {
  it('hides avatars beyond max and renders a "+N" overflow badge', async () => {
    const el = (await fixture(fiveAvatars())) as LyraAvatarGroup;
    const avatars = Array.from(el.querySelectorAll('lr-avatar')) as HTMLElement[];
    expect(avatars.map(isGroupHidden)).to.deep.equal([false, false, false, true, true]);

    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLElement;
    expect((badge) != null).to.equal(true);
    expect(badge.textContent!.trim()).to.equal('+2');
    // The ordinary (not-sole-visible) case keeps the normal overlap margin --
    // contrasted against the max=0 regression test below.
    const visual = badge.querySelector('[part="overflow-badge-visual"]') as HTMLElement;
    expect(getComputedStyle(visual).marginInlineStart).to.equal('-6px');
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
    expect(avatars.every(isGroupHidden)).to.be.true;

    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLElement;
    expect((badge) != null).to.equal(true);
    expect(badge.textContent!.trim()).to.equal('+3');
    // The badge is the first *visible* thing in the row here (every avatar is
    // hidden), so its own margin-inline-start must be zeroed rather than
    // carrying the normal overlap value.
    const visual = badge.querySelector('[part="overflow-badge-visual"]') as HTMLElement;
    expect(getComputedStyle(visual).marginInlineStart).to.equal('0px');
  });

  it('restores each child’s author-owned hidden state when overflow ownership ends or the group disconnects', async () => {
    const el = (await fixture(html`
      <lr-avatar-group max="1">
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD" hidden></lr-avatar>
        <lr-avatar initials="EF"></lr-avatar>
      </lr-avatar-group>
    `)) as LyraAvatarGroup;
    const avatars = [...el.querySelectorAll('lr-avatar')] as HTMLElement[];
    expect(avatars.map(isGroupHidden)).to.deep.equal([false, false, true]);
    expect(avatars.map((avatar) => avatar.hidden)).to.deep.equal([false, true, false]);

    el.max = undefined;
    await el.updateComplete;
    expect(avatars.every((avatar) => !isGroupHidden(avatar))).to.be.true;
    expect(avatars.map((avatar) => avatar.hidden)).to.deep.equal([false, true, false]);

    el.max = 1;
    await el.updateComplete;
    el.remove();
    expect(avatars.map((avatar) => avatar.hidden)).to.deep.equal([false, true, false]);
  });

  it('formats the visible and accessible overflow count with the effective locale', async () => {
    const el = (await fixture(html`
      <lr-avatar-group lang="ar-EG" max="1">
        <lr-avatar></lr-avatar><lr-avatar></lr-avatar><lr-avatar></lr-avatar>
      </lr-avatar-group>
    `)) as LyraAvatarGroup;
    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]')!;
    expect(badge.textContent).to.contain('٢');
    expect(badge.getAttribute('aria-label')).to.contain('٢');
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
    expect((el.shadowRoot!.querySelector('[part="overflow-badge"]')) == null).to.be.true;

    const extra = document.createElement('lr-avatar');
    extra.setAttribute('initials', 'EF');
    el.appendChild(extra);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await el.updateComplete;

    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLElement;
    expect((badge) != null).to.equal(true);
    expect(badge.textContent!.trim()).to.equal('+1');
    expect(isGroupHidden(extra)).to.be.true;
  });

  it('recomputes overflow when an avatar is removed after first render', async () => {
    const el = (await fixture(fiveAvatars())) as LyraAvatarGroup;
    expect(el.shadowRoot!.querySelector('[part="overflow-badge"]')).to.exist;

    const avatars = Array.from(el.querySelectorAll('lr-avatar'));
    avatars.slice(2).forEach((a) => el.removeChild(a));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await el.updateComplete;

    expect((el.shadowRoot!.querySelector('[part="overflow-badge"]')) == null).to.be.true;
    const remaining = Array.from(el.querySelectorAll('lr-avatar')) as HTMLElement[];
    expect(remaining.every((a) => !isGroupHidden(a))).to.be.true;
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
    expect((badge) != null).to.equal(true);
    expect(badge.textContent!.trim()).to.equal('+1');
    const forwardedAvatars = Array.from(host.querySelectorAll('lr-avatar')) as HTMLElement[];
    expect(forwardedAvatars.map(isGroupHidden)).to.deep.equal([false, false, true]);
  } finally {
    console.warn = originalWarn;
  }

  const messages = calls.flat().map(String);
  expect(messages.some((m) => m.includes('scheduled an update'))).to.be.false;
});

describe('overflow badge activation', () => {
  it('fires lr-overflow-click with the correct hiddenCount/hiddenAvatars on click', async () => {
    const el = (await fixture(fiveAvatars())) as LyraAvatarGroup;
    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLButtonElement;

    // oneEvent() listener set up before the synchronous click, not after.
    setTimeout(() => badge.click());
    const ev = await oneEvent(el, 'lr-overflow-click');

    expect(ev.detail.hiddenCount).to.equal(2);
    expect(Object.isFrozen(ev.detail)).to.equal(true);
    expect(Object.isFrozen(ev.detail.hiddenAvatars)).to.equal(true);
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
    expect(avatars.map(isGroupHidden)).to.deep.equal([false, false, false, true, true]);
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
    <lr-avatar-group size="large"><lr-avatar></lr-avatar></lr-avatar-group>
    `)) as LyraAvatarGroup;
    const hostStyle = getComputedStyle(el);
    const avatar = el.querySelector('lr-avatar') as HTMLElement;
    const base = avatar.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(getComputedStyle(base).inlineSize).to.equal('64px');
    expect(getComputedStyle(avatar).marginInlineStart).to.equal('0px');
  });

  // Resolve a declaration through the component's own shadow scope and read back the *used* value
  // (`rgb(...)`), the same throwaway-probe dance `<lr-file-input>`'s token tests use. Palette
  // colours come from a generated OKLCH ramp, so a test that restates their hexes asserts the
  // palette, not the component, and breaks on every legitimate regeneration.
  function resolvedIn(root: ShadowRoot, declaration: string, property: string): string {
    const probe = document.createElement('span');
    probe.setAttribute('style', declaration);
    root.appendChild(probe);
    const value = getComputedStyle(probe).getPropertyValue(property);
    probe.remove();
    return value;
  }

  it('resolves --lr-avatar-group-badge-bg/-color through the variant token chain and applies them to the rendered badge (brand tier)', async () => {
    const el = (await fixture(html`
      <lr-avatar-group max="0" variant="brand"><lr-avatar initials="AB"></lr-avatar></lr-avatar-group>
    `)) as LyraAvatarGroup;
    const hostStyle = getComputedStyle(el);

    // The chain under test is `--lr-avatar-group-badge-bg` -> `--lr-color-brand-quiet` and
    // `--lr-avatar-group-badge-color` -> `--lr-color-brand`; the variant tokens are read live so
    // the expectation follows the palette instead of pinning one generation of it.
    const brandQuiet = hostStyle.getPropertyValue('--lr-color-brand-quiet').trim();
    const brand = hostStyle.getPropertyValue('--lr-color-brand').trim();
    expect(brandQuiet, '--lr-color-brand-quiet resolves to a real colour').to.match(/^(#|rgb|color\()/);
    expect(brand, '--lr-color-brand resolves to a real colour').to.match(/^(#|rgb|color\()/);
    // Public hooks remain unset unless authored, so ancestor themes are not shadowed by host
    // defaults. The private defaults are verified through rendered output below.
    expect(hostStyle.getPropertyValue('--lr-avatar-group-badge-bg').trim()).to.equal('');
    expect(hostStyle.getPropertyValue('--lr-avatar-group-badge-color').trim()).to.equal('');

    const neutral = (await fixture(html`
      <lr-avatar-group max="0"><lr-avatar initials="AB"></lr-avatar></lr-avatar-group>
    `)) as LyraAvatarGroup;
    const neutralBadge = neutral.shadowRoot!.querySelector('[part="overflow-badge-visual"]') as HTMLElement;
    // A stale `tone="brand"` must no longer reach the badge at all -- the rename is not aliased.
    const stale = (await fixture(html`
      <lr-avatar-group max="0" tone="brand"><lr-avatar initials="AB"></lr-avatar></lr-avatar-group>
    `)) as LyraAvatarGroup;
    const staleBadge = stale.shadowRoot!.querySelector('[part="overflow-badge-visual"]') as HTMLElement;

    const badge = el.shadowRoot!.querySelector('[part="overflow-badge-visual"]') as HTMLElement;
    expect(getComputedStyle(badge).backgroundColor).to.equal(
      resolvedIn(el.shadowRoot!, 'background-color: var(--lr-color-brand-quiet)', 'background-color'),
    );
    expect(getComputedStyle(badge).color).to.equal(resolvedIn(el.shadowRoot!, 'color: var(--lr-color-brand)', 'color'));
    expect(getComputedStyle(badge).backgroundColor).to.not.equal(getComputedStyle(neutralBadge).backgroundColor);
    expect(getComputedStyle(staleBadge).backgroundColor).to.equal(getComputedStyle(neutralBadge).backgroundColor);
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
      <lr-avatar initials="CD" variant="brand"></lr-avatar>
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
    const badge = el.shadowRoot!.querySelector('[part="overflow-badge-visual"]') as HTMLElement;
    return Number.parseFloat(getComputedStyle(badge).fontSize);
  };

  it('scales the rendered "+N" badge font-size with size', async () => {
    const [sm, md, lg] = [
      await renderedBadgeFontSize('small'),
      await renderedBadgeFontSize('medium'),
      await renderedBadgeFontSize('large'),
    ];
    expect(sm, 'sm < md').to.be.lessThan(md);
    expect(lg, 'lg > md').to.be.greaterThan(md);
  });

  it('uses the same font size for unset, medium and m', async () => {
    expect(await renderedBadgeFontSize()).to.equal(await renderedBadgeFontSize('medium'));
    expect(await renderedBadgeFontSize('m')).to.equal(await renderedBadgeFontSize('medium'));
  });

  it('lets a consumer override --lr-avatar-group-badge-font-size at any tier', async () => {
    const el = (await fixture(html`
      <lr-avatar-group size="small" max="1" label="Team">
        <lr-avatar initials="AB"></lr-avatar>
        <lr-avatar initials="CD"></lr-avatar>
      </lr-avatar-group>
    `)) as LyraAvatarGroup;
    el.style.setProperty('--lr-avatar-group-badge-font-size', '19px');
    await el.updateComplete;
    const badge = el.shadowRoot!.querySelector('[part="overflow-badge-visual"]') as HTMLElement;
    expect(getComputedStyle(badge).fontSize).to.equal('19px');
    await expect(el).to.be.accessible();
  });
});

it('keeps the interactive overflow badge at least 40px in both axes at sm and md tiers', async () => {
  for (const size of ['2xs', 'xs', 'small', undefined] as const) {
    const el = (await fixture(
      size
        ? html`<lr-avatar-group size=${size} max="1">
            <lr-avatar initials="AB"></lr-avatar>
            <lr-avatar initials="CD"></lr-avatar>
          </lr-avatar-group>`
        : html`<lr-avatar-group max="1">
            <lr-avatar initials="AB"></lr-avatar>
            <lr-avatar initials="CD"></lr-avatar>
          </lr-avatar-group>`,
    )) as LyraAvatarGroup;
    const badge = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLButtonElement;
    const rect = badge.getBoundingClientRect();
    expect(rect.width, size ?? 'default md').to.be.at.least(40);
    expect(rect.height, size ?? 'default md').to.be.at.least(40);
  }
});

it('reapplies owned overflow hiding when reconnected', async () => {
  const el = (await fixture(fiveAvatars())) as LyraAvatarGroup;
  const avatars = [...el.querySelectorAll('lr-avatar')] as HTMLElement[];
  expect(avatars.map(isGroupHidden)).to.deep.equal([false, false, false, true, true]);
  const parent = el.parentElement!;

  el.remove();
  expect(avatars.every((avatar) => !isGroupHidden(avatar))).to.be.true;
  parent.append(el);
  await el.updateComplete;

  expect(avatars.map(isGroupHidden)).to.deep.equal([false, false, false, true, true]);
});

it('counts only author-visible, non-inert avatars and leaves invalid children untouched', async () => {
  const el = (await fixture(html`
    <lr-avatar-group max="1">
      <svg id="foreign"></svg>
      <lr-avatar id="hidden" hidden></lr-avatar>
      <lr-avatar id="inert" inert></lr-avatar>
      <lr-avatar id="first"></lr-avatar>
      <lr-avatar id="overflow"></lr-avatar>
      <div id="generic">generic</div>
    </lr-avatar-group>
  `)) as LyraAvatarGroup;
  const hidden = el.querySelector('#hidden')!;
  const inert = el.querySelector('#inert')!;
  const first = el.querySelector('#first')!;
  const overflow = el.querySelector('#overflow')!;
  expect(isGroupHidden(hidden)).to.be.false;
  expect(isGroupHidden(inert)).to.be.false;
  expect(isGroupHidden(first)).to.be.false;
  expect(isGroupHidden(overflow)).to.be.true;
  expect(el.querySelector('#foreign')!.hasAttribute('data-lr-avatar-group-hidden')).to.be.false;
  expect(el.querySelector('#generic')!.hasAttribute('data-lr-avatar-group-hidden')).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="overflow-badge"]')!.textContent!.trim()).to.equal('+1');
});

it('tracks live author hidden and inert writes without overwriting them', async () => {
  const el = (await fixture(html`
    <lr-avatar-group max="1"><lr-avatar id="a"></lr-avatar><lr-avatar id="b"></lr-avatar></lr-avatar-group>
  `)) as LyraAvatarGroup;
  const [a, b] = [...el.querySelectorAll('lr-avatar')];
  expect(isGroupHidden(b!)).to.be.true;
  a!.setAttribute('hidden', '');
  await new Promise((resolve) => queueMicrotask(resolve));
  await el.updateComplete;
  expect(isGroupHidden(b!)).to.be.false;
  expect(el.shadowRoot!.querySelector('[part="overflow-badge"]') === null).to.be.true;
  a!.removeAttribute('hidden');
  b!.setAttribute('inert', '');
  await new Promise((resolve) => queueMicrotask(resolve));
  await el.updateComplete;
  expect(a!.hasAttribute('hidden')).to.be.false;
  expect(b!.hasAttribute('inert')).to.be.true;
  expect(isGroupHidden(b!)).to.be.false;
});

it('defaults omitted child presentation while preserving explicit and later author values', async () => {
  const el = (await fixture(html`
    <lr-avatar-group size="large" shape="rounded" variant="brand">
      <lr-avatar id="owned"></lr-avatar>
      <lr-avatar id="explicit" size="small" shape="square" variant="danger"></lr-avatar>
    </lr-avatar-group>
  `)) as LyraAvatarGroup;
  const owned = el.querySelector('#owned')!;
  const explicit = el.querySelector('#explicit')!;
  expect([owned.getAttribute('size'), owned.getAttribute('shape'), owned.getAttribute('variant')]).to.deep.equal([
    'large', 'rounded', 'brand',
  ]);
  expect([explicit.getAttribute('size'), explicit.getAttribute('shape'), explicit.getAttribute('variant')]).to.deep.equal([
    'small', 'square', 'danger',
  ]);
  owned.setAttribute('size', 'xs');
  el.size = 'xl';
  await el.updateComplete;
  expect(owned.getAttribute('size')).to.equal('xs');
  expect(explicit.getAttribute('size')).to.equal('small');
  el.remove();
  expect(owned.getAttribute('size')).to.equal('xs');
  expect(owned.hasAttribute('shape')).to.be.false;
  expect(owned.hasAttribute('variant')).to.be.false;
});

it('relinquishes a group-owned default after an explicit same-value author attribute write', async () => {
  const el = (await fixture(html`
    <lr-avatar-group size="large"><lr-avatar id="owned"></lr-avatar></lr-avatar-group>
  `)) as LyraAvatarGroup;
  const owned = el.querySelector('#owned')!;
  await new Promise((resolve) => requestAnimationFrame(resolve));
  expect(owned.getAttribute('size')).to.equal('large');

  owned.setAttribute('size', 'large');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  el.size = 'xl';
  await el.updateComplete;
  expect(owned.getAttribute('size')).to.equal('large');
});

it('keeps restored defaults absent after a removed avatar settles', async () => {
  const el = (await fixture(html`
    <lr-avatar-group size="large" shape="rounded" variant="brand">
      <lr-avatar id="owned"></lr-avatar>
    </lr-avatar-group>
  `)) as LyraAvatarGroup;
  const owned = el.querySelector('#owned') as HTMLElement & { updateComplete: Promise<boolean> };
  owned.remove();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await el.updateComplete;
  await owned.updateComplete;
  expect([owned.hasAttribute('size'), owned.hasAttribute('shape'), owned.hasAttribute('variant')]).to.deep.equal([
    false, false, false,
  ]);
});

it('applies group defaults to a previously mounted avatar that omitted presentation attributes', async () => {
  const avatar = (await fixture(html`<lr-avatar initials="AB"></lr-avatar>`)) as HTMLElement & {
    updateComplete: Promise<boolean>;
  };
  await avatar.updateComplete;
  expect([avatar.hasAttribute('size'), avatar.hasAttribute('shape'), avatar.hasAttribute('variant')]).to.deep.equal([
    false, false, false,
  ]);

  const group = (await fixture(html`
    <lr-avatar-group size="large" shape="rounded" variant="brand"></lr-avatar-group>
  `)) as LyraAvatarGroup;
  group.append(avatar);
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await group.updateComplete;
  expect([avatar.getAttribute('size'), avatar.getAttribute('shape'), avatar.getAttribute('variant')]).to.deep.equal([
    'large', 'rounded', 'brand',
  ]);
});

it('marks the first effective visible avatar instead of the first DOM child', async () => {
  const el = (await fixture(html`
    <lr-avatar-group><lr-avatar hidden></lr-avatar><lr-avatar id="visible"></lr-avatar></lr-avatar-group>
  `)) as LyraAvatarGroup;
  const [hidden, visible] = [...el.querySelectorAll('lr-avatar')];
  expect(hidden!.hasAttribute('data-lr-avatar-group-first')).to.be.false;
  expect(visible!.hasAttribute('data-lr-avatar-group-first')).to.be.true;
  expect(getComputedStyle(visible!).marginInlineStart).to.equal('0px');
});

it('keeps a 40px action surface while painting an avatar-sized disc at every small tier', async () => {
  const expected = new Map([['2xs', 24], ['xs', 32], ['small', 40]]);
  for (const [size, paintedSize] of expected) {
    const el = (await fixture(html`
      <lr-avatar-group size=${size} max="0"><lr-avatar></lr-avatar></lr-avatar-group>
    `)) as LyraAvatarGroup;
    const action = el.shadowRoot!.querySelector('[part="overflow-badge"]') as HTMLElement;
    const visual = el.shadowRoot!.querySelector('[part="overflow-badge-visual"]') as HTMLElement;
    expect(action.getBoundingClientRect().width).to.be.at.least(40);
    expect(visual.getBoundingClientRect().width).to.equal(paintedSize);
  }
});

it('preserves an explicit empty host aria-label', async () => {
  const el = (await fixture(html`
    <lr-avatar-group aria-label="" label="fallback"><lr-avatar></lr-avatar></lr-avatar-group>
  `)) as LyraAvatarGroup;
  expect(el.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('');
});
