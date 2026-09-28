import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './app-rail-group.js';
import '../app-rail/app-rail-item.js';
import '../app-rail/app-rail.js';
import type { LyraAppRail } from '../app-rail/app-rail.js';
import type { LyraAppRailGroup } from './app-rail-group.class.js';
import {
  captureDeprecationWarnings,
  type DeprecatedUsage,
} from '../../../../test/expected-deprecations.js';

function populated(): ReturnType<typeof html> {
  return html`
    <lr-app-rail-group heading="Workspaces">
      <lr-app-rail-item href="/one">One</lr-app-rail-item>
      <lr-app-rail-item href="/two">Two</lr-app-rail-item>
    </lr-app-rail-group>
  `;
}

describe('<lr-app-rail-group>', () => {
  it('renders its heading as a heading landmark that names the group', async () => {
    const el = (await fixture<LyraAppRailGroup>(populated())) as LyraAppRailGroup;
    await el.updateComplete;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;

    expect(base.getAttribute('role')).to.equal('group');
    expect(heading.getAttribute('role')).to.equal('heading');
    expect(heading.getAttribute('aria-level')).to.equal('3');
    expect(heading.textContent?.trim()).to.equal('Workspaces');
    expect(base.getAttribute('aria-labelledby')).to.equal(heading.id);
    expect(heading.id.length > 0).to.equal(true);
  });

  it('clamps headingLevel into the 1-6 range a heading can actually carry', async () => {
    const el = (await fixture<LyraAppRailGroup>(
      html`<lr-app-rail-group heading="Pinned" heading-level="9"></lr-app-rail-group>`
    )) as LyraAppRailGroup;
    await el.updateComplete;
    const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
    expect(heading.getAttribute('aria-level')).to.equal('6');

    el.headingLevel = Number.NaN;
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement).getAttribute('aria-level')
    ).to.equal('3');
  });

  it('lets the heading slot replace the heading property', async () => {
    const el = (await fixture<LyraAppRailGroup>(html`
      <lr-app-rail-group heading="Fallback">
        <span slot="heading">Slotted</span>
        <lr-app-rail-item href="/one">One</lr-app-rail-item>
      </lr-app-rail-group>
    `)) as LyraAppRailGroup;
    await el.updateComplete;
    const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
    expect(heading.textContent?.includes('Fallback')).to.equal(false);
    const slot = heading.querySelector('slot[name="heading"]') as HTMLSlotElement;
    expect(slot.assignedElements()[0]?.textContent).to.equal('Slotted');
  });

  it('survives rewriting the heading after mount, with the property still winning', async () => {
    // Regression: the heading slot's fallback content IS `this.heading`, and the slotchange
    // handler read `assignedNodes({ flatten: true })`, which reports fallback as if a consumer had
    // slotted it. Rewriting `heading` then flipped `hasHeadingSlot` on every render, and under
    // WebKit -- which fires `slotchange` for a fallback mutation, unlike Chromium and Firefox --
    // that became an unbreakable microtask loop that hung the whole page.
    const el = (await fixture<LyraAppRailGroup>(html`
      <lr-app-rail-group heading="Workspaces">
        <lr-app-rail-item href="/one">One</lr-app-rail-item>
      </lr-app-rail-group>
    `)) as LyraAppRailGroup;
    await el.updateComplete;
    const headingText = (): string =>
      (el.shadowRoot!.querySelector('[part="heading-text"]') as HTMLElement).textContent!.trim();
    expect(headingText()).to.equal('Workspaces');

    el.heading = 'Projects';
    await el.updateComplete;
    await aTimeout(0);
    expect(headingText()).to.equal('Projects');

    el.heading = 'Archive';
    await el.updateComplete;
    await aTimeout(0);
    expect(headingText()).to.equal('Archive');
  });

  it('still lets a slotted heading win after the heading property is rewritten', async () => {
    const el = (await fixture<LyraAppRailGroup>(html`
      <lr-app-rail-group heading="Workspaces">
        <span slot="heading">Rich heading</span>
        <lr-app-rail-item href="/one">One</lr-app-rail-item>
      </lr-app-rail-group>
    `)) as LyraAppRailGroup;
    await el.updateComplete;
    await aTimeout(0);
    // The slotted node lives in the light DOM, so read it through the slot rather than through the
    // wrapper's textContent -- which only ever holds the fallback the property renders.
    const slot = (): HTMLSlotElement =>
      el.shadowRoot!.querySelector('slot[name="heading"]') as HTMLSlotElement;
    const slottedText = (): string =>
      (slot().assignedElements()[0] as HTMLElement | undefined)?.textContent?.trim() ?? '';
    expect(slottedText()).to.equal('Rich heading');
    expect(slot().textContent!.trim()).to.equal('');

    el.heading = 'Projects';
    await el.updateComplete;
    await aTimeout(0);
    expect(slottedText()).to.equal('Rich heading');
    // The property must NOT reappear alongside the slotted heading.
    expect(slot().textContent!.trim()).to.equal('');
  });

  it('renders no toggle and shows its content until `collapsible` opts in', async () => {
    const el = (await fixture<LyraAppRailGroup>(populated())) as LyraAppRailGroup;
    await el.updateComplete;
    expect(el.collapsible).to.equal(false);
    expect(el.collapsed).to.equal(false);
    expect(el.shadowRoot!.querySelector('[part="toggle"]') === null).to.equal(true);
    const content = el.shadowRoot!.querySelector('[part="content"]') as HTMLElement;
    expect(content.hasAttribute('hidden')).to.equal(false);
  });

  it('collapses through the request/commit pair and announces the settled state', async () => {
    const el = (await fixture<LyraAppRailGroup>(html`
      <lr-app-rail-group collapsible heading="Workspaces">
        <lr-app-rail-item href="/one">One</lr-app-rail-item>
      </lr-app-rail-group>
    `)) as LyraAppRailGroup;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).to.equal('true');
    expect(toggle.getAttribute('aria-controls')).to.equal(
      (el.shadowRoot!.querySelector('[part="content"]') as HTMLElement).id
    );

    const order: string[] = [];
    el.addEventListener('lr-toggle-request', () => order.push('request'));
    el.addEventListener('lr-toggle', () => order.push('toggle'));
    const settled = oneEvent(el, 'lr-toggle');
    toggle.click();
    const event = await settled;
    expect((event as CustomEvent<{ expanded: boolean }>).detail.expanded).to.equal(false);
    expect(order.join()).to.equal('request,toggle');
    await el.updateComplete;
    expect(el.collapsed).to.equal(true);
    expect(el.hasAttribute('collapsed'), 'collapsed reflects').to.equal(true);
    expect(
      (el.shadowRoot!.querySelector('[part="content"]') as HTMLElement).hasAttribute('hidden')
    ).to.equal(true);
    expect(
      (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement).getAttribute('aria-expanded')
    ).to.equal('false');
  });

  it('keeps the group open when the request is vetoed, and emits no settled event', async () => {
    const el = (await fixture<LyraAppRailGroup>(html`
      <lr-app-rail-group collapsible heading="Workspaces">
        <lr-app-rail-item href="/one">One</lr-app-rail-item>
      </lr-app-rail-group>
    `)) as LyraAppRailGroup;
    await el.updateComplete;
    let settled = 0;
    el.addEventListener('lr-toggle', () => {
      settled += 1;
    });
    el.addEventListener('lr-toggle-request', (event) => {
      event.preventDefault();
    });
    (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.collapsed).to.equal(false);
    expect(settled).to.equal(0);
  });

  it('lets a listener resolve the toggle itself without the default commit clobbering it', async () => {
    const el = (await fixture<LyraAppRailGroup>(html`
      <lr-app-rail-group collapsible heading="Workspaces">
        <lr-app-rail-item href="/one">One</lr-app-rail-item>
      </lr-app-rail-group>
    `)) as LyraAppRailGroup;
    await el.updateComplete;
    // Writes back the value the property already holds: a before/after value compare cannot see
    // this, which is exactly why the pair tracks writes instead.
    el.addEventListener('lr-toggle-request', () => {
      el.collapsed = false;
    });
    let settled = 0;
    el.addEventListener('lr-toggle', () => {
      settled += 1;
    });
    (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.collapsed).to.equal(false);
    expect(settled).to.equal(0);
  });

  it('accepts collapsed from markup', async () => {
    const el = (await fixture<LyraAppRailGroup>(html`
      <lr-app-rail-group collapsible heading="Workspaces" collapsed>
        <lr-app-rail-item href="/one">One</lr-app-rail-item>
      </lr-app-rail-group>
    `)) as LyraAppRailGroup;
    await el.updateComplete;
    expect(el.collapsed).to.equal(true);
    expect(
      (el.shadowRoot!.querySelector('[part="content"]') as HTMLElement).hasAttribute('hidden')
    ).to.equal(true);
  });

  it('toggles from the keyboard when the toggle itself holds focus', async () => {
    const el = (await fixture<LyraAppRailGroup>(html`
      <lr-app-rail-group collapsible heading="Workspaces">
        <lr-app-rail-item href="/one">One</lr-app-rail-item>
      </lr-app-rail-group>
    `)) as LyraAppRailGroup;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    toggle.focus();
    expect(el.shadowRoot!.activeElement === toggle).to.equal(true);
    // A real key press, and no programmatic .click(): a synthetic KeyboardEvent never produces a
    // native click, so a dispatch-then-click pair asserts nothing about the keyboard.
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => el.collapsed === true, 'Enter on the focused toggle collapses the group');
  });

  it('renders header actions as a sibling of the heading control', async () => {
    const el = (await fixture<LyraAppRailGroup>(html`
      <lr-app-rail-group collapsible heading="Workspaces">
        <button slot="header-actions" id="group-action">Add</button>
        <lr-app-rail-item href="/one">One</lr-app-rail-item>
      </lr-app-rail-group>
    `)) as LyraAppRailGroup;
    await el.updateComplete;
    const heading = el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement;
    const actions = el.shadowRoot!.querySelector('[part="header-actions"]') as HTMLElement;
    expect(heading.contains(actions)).to.equal(false);
    expect(actions.parentNode === heading.parentNode).to.equal(true);
    let toggles = 0;
    el.addEventListener('lr-toggle', () => {
      toggles += 1;
    });
    (el.querySelector('#group-action') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(toggles).to.equal(0);
    expect(el.collapsed).to.equal(false);
  });

  it('hides the header-actions wrapper when nothing is slotted into it', async () => {
    const el = (await fixture<LyraAppRailGroup>(populated())) as LyraAppRailGroup;
    await el.updateComplete;
    const actions = el.shadowRoot!.querySelector('[part="header-actions"]') as HTMLElement;
    expect(actions.hasAttribute('hidden')).to.equal(true);
    expect(getComputedStyle(actions).display).to.equal('none');
  });

  it('points the toggle glyph the opposite way under dir="rtl"', async () => {
    const glyph = (el: LyraAppRailGroup): string =>
      getComputedStyle(el.shadowRoot!.querySelector('[part="toggle-icon"]') as HTMLElement)
        .transform;
    const ltr = (await fixture<LyraAppRailGroup>(
      html`<lr-app-rail-group collapsible heading="A" collapsed></lr-app-rail-group>`
    )) as LyraAppRailGroup;
    const rtl = (await fixture<LyraAppRailGroup>(
      html`<lr-app-rail-group dir="rtl" collapsible heading="A" collapsed></lr-app-rail-group>`
    )) as LyraAppRailGroup;
    await ltr.updateComplete;
    await rtl.updateComplete;
    expect(glyph(rtl)).to.not.equal(glyph(ltr));
  });

  it('forwards icon-only to its own items, including items added later', async () => {
    const el = (await fixture<LyraAppRailGroup>(populated())) as LyraAppRailGroup;
    await el.updateComplete;
    el.setAttribute('icon-only', '');
    await el.updateComplete;
    await waitUntil(
      () =>
        Array.from(el.querySelectorAll('lr-app-rail-item')).every((item) =>
          item.hasAttribute('icon-only')
        ),
      'every slotted item mirrors the group icon-only state'
    );

    const late = document.createElement('lr-app-rail-item');
    el.appendChild(late);
    await waitUntil(() => late.hasAttribute('icon-only'), 'a late item mirrors it too');

    el.removeAttribute('icon-only');
    await el.updateComplete;
    await waitUntil(
      () =>
        Array.from(el.querySelectorAll('lr-app-rail-item')).every(
          (item) => !item.hasAttribute('icon-only')
        ),
      'clearing the group state clears every item'
    );
  });

  it('is marked icon-only by an owning rail that entered icon-only mode', async () => {
    const rail = (await fixture<LyraAppRail>(html`
      <lr-app-rail force-mode="icon-only">
        <lr-app-rail-group heading="Workspaces">
          <lr-app-rail-item href="/one">One</lr-app-rail-item>
        </lr-app-rail-group>
      </lr-app-rail>
    `)) as LyraAppRail;
    await rail.updateComplete;
    const group = rail.querySelector('lr-app-rail-group') as LyraAppRailGroup;
    await waitUntil(
      () => group.hasAttribute('icon-only'),
      'the rail marks a slotted group the same way it marks a slotted item'
    );
    await waitUntil(
      () => (rail.querySelector('lr-app-rail-item') as HTMLElement).hasAttribute('icon-only'),
      'the group then forwards it to the items it owns'
    );

    rail.forceMode = 'full';
    await rail.updateComplete;
    await waitUntil(() => !group.hasAttribute('icon-only'));
    await waitUntil(
      () => !(rail.querySelector('lr-app-rail-item') as HTMLElement).hasAttribute('icon-only')
    );
  });

  it('marks a nested group instead of reaching past it, so an inner re-render cannot unclip deep items', async () => {
    const rail = (await fixture<LyraAppRail>(html`
      <lr-app-rail force-mode="icon-only">
        <lr-app-rail-group heading="Outer">
          <lr-app-rail-item href="/top">Top</lr-app-rail-item>
          <lr-app-rail-group heading="Inner">
            <lr-app-rail-item href="/deep">Deep</lr-app-rail-item>
          </lr-app-rail-group>
        </lr-app-rail-group>
      </lr-app-rail>
    `)) as LyraAppRail;
    await rail.updateComplete;
    const groups = Array.from(rail.querySelectorAll('lr-app-rail-group')) as LyraAppRailGroup[];
    const outer = groups[0]!;
    const inner = groups[1]!;
    const deep = rail.querySelector('lr-app-rail-item[href="/deep"]') as HTMLElement;
    await waitUntil(
      () => inner.hasAttribute('icon-only'),
      'the outer group marks the nested group, not just the items under it'
    );
    await waitUntil(
      () => deep.hasAttribute('icon-only'),
      'the nested group then forwards to the item it owns'
    );

    // The regression this guards: with a single deep query the outer group wrote `icon-only` onto
    // `deep` while never marking `inner`, so the very next inner re-render re-ran the inner sync
    // with `iconOnly === false` and stripped it again.
    inner.heading = 'Inner renamed';
    await inner.updateComplete;
    expect(deep.hasAttribute('icon-only')).to.equal(true);
    expect(inner.hasAttribute('icon-only')).to.equal(true);

    rail.forceMode = 'full';
    await rail.updateComplete;
    await waitUntil(() => !inner.hasAttribute('icon-only'), 'clearing cascades into the nested group');
    await waitUntil(() => !deep.hasAttribute('icon-only'), 'and on to the deep item');
    expect(outer.hasAttribute('icon-only')).to.equal(false);
  });

  it('clips the heading out of layout in icon-only mode whether or not the group is collapsible', async () => {
    for (const collapsible of [false, true]) {
      const el = (await fixture<LyraAppRailGroup>(html`
        <lr-app-rail-group
          ?collapsible=${collapsible}
          heading="A deliberately long workspaces section title"
        ></lr-app-rail-group>
      `)) as LyraAppRailGroup;
      await el.updateComplete;
      const text = el.shadowRoot!.querySelector('[part="heading-text"]') as HTMLElement;
      const label = `collapsible=${String(collapsible)}`;
      expect(text.getBoundingClientRect().width, `${label}: wide before icon-only`).to.be.greaterThan(
        2
      );

      el.setAttribute('icon-only', '');
      await el.updateComplete;
      await waitUntil(
        () => text.getBoundingClientRect().width < 2,
        // The non-collapsible path was the broken one: a plain inline span ignores inline-size,
        // block-size and overflow, so only clip-path applied and the title kept its full width.
        `${label}: the heading text collapses out of layout`
      );
      expect(
        (el.shadowRoot!.querySelector('[part="base"]') as HTMLElement).getAttribute(
          'aria-labelledby'
        ),
        `${label}: still named`
      ).to.equal((el.shadowRoot!.querySelector('[part="heading"]') as HTMLElement).id);
    }
  });

  it('resolves the collapsible toggle to a square instead of stretching the row while icon-only', async () => {
    const el = (await fixture<LyraAppRailGroup>(html`
      <lr-app-rail-group collapsible icon-only heading="Workspaces"></lr-app-rail-group>
    `)) as LyraAppRailGroup;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
    const rect = toggle.getBoundingClientRect();
    expect(rect.width).to.be.above(0);
    expect(Math.abs(rect.width - rect.height)).to.be.below(1);
  });

  it('stops forwarding once it disconnects', async () => {
    const el = (await fixture<LyraAppRailGroup>(populated())) as LyraAppRailGroup;
    await el.updateComplete;
    el.setAttribute('icon-only', '');
    await el.updateComplete;
    await waitUntil(() =>
      Array.from(el.querySelectorAll('lr-app-rail-item')).every((item) =>
        item.hasAttribute('icon-only')
      )
    );
    el.remove();
    await aTimeout(0);
    const late = document.createElement('lr-app-rail-item');
    el.appendChild(late);
    await aTimeout(0);
    expect(late.hasAttribute('icon-only')).to.equal(false);
  });

  it('is accessible populated, and collapsed', async () => {
    const el = (await fixture<LyraAppRailGroup>(html`
      <lr-app-rail-group collapsible heading="Workspaces">
        <button slot="header-actions" aria-label="Add workspace">+</button>
        <lr-app-rail-item href="/one">One</lr-app-rail-item>
        <lr-app-rail-item href="/two">Two</lr-app-rail-item>
      </lr-app-rail-group>
    `)) as LyraAppRailGroup;
    await el.updateComplete;
    await expect(el).to.be.accessible();

    el.collapsed = true;
    await el.updateComplete;
    await expect(el).to.be.accessible();
  });

  it('honors a strings override for the collapsed group toggle name', async () => {
    const el = (await fixture<LyraAppRailGroup>(html`
      <lr-app-rail-group
        collapsible
        .strings=${{ collapse: 'Replier', expand: 'Déplier' }}
      ></lr-app-rail-group>
    `)) as LyraAppRailGroup;
    await el.updateComplete;
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-label')).to.equal('Replier');
    el.collapsed = true;
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement).getAttribute('aria-label')
    ).to.equal('Déplier');
  });
});

describe('collecting already-slotted heading/header-actions content without relying on the initial slotchange', () => {
  function slotted(): { el: LyraAppRailGroup; heading: HTMLSpanElement; actions: HTMLSpanElement } {
    const heading = document.createElement('span');
    heading.slot = 'heading';
    heading.textContent = 'Rich heading';
    const actions = document.createElement('span');
    actions.slot = 'header-actions';
    actions.textContent = 'Actions';
    const el = document.createElement('lr-app-rail-group') as LyraAppRailGroup;
    el.collapsible = true;
    el.append(heading, actions);
    return { el, heading, actions };
  }

  it('populates hasHeadingSlot/hasHeaderActionsSlot when the initial slotchange is suppressed (simulating happy-dom)', async () => {
    // happy-dom (through at least 20.14.5) never fires `slotchange` for a slot's INITIAL
    // assignment. This suite runs in a real browser, which DOES fire it -- so to reproduce the
    // happy-dom condition deterministically here, swallow every such event with a capture-phase
    // listener on the render root: capture-phase fires on the way down to each `<slot>` itself,
    // before that slot's own bubble-phase `@slotchange` binding ever sees it.
    const { el } = slotted();
    document.body.append(el);
    let intercepted = 0;
    el.renderRoot!.addEventListener(
      'slotchange',
      (e) => {
        intercepted++;
        e.stopImmediatePropagation();
      },
      { capture: true }
    );
    try {
      await el.updateComplete;
      await aTimeout(50);
      expect(
        intercepted,
        "a real browser does fire each named slot's own initial slotchange -- this test suppresses them to reproduce happy-dom, which never fires either at all"
      ).to.be.greaterThan(0);
      const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
      expect(
        toggle.hasAttribute('aria-label'),
        'firstUpdated() collected the already-slotted rich heading, so the toggle defers its accessible name to that heading text instead of a generic collapse/expand label'
      ).to.equal(false);
      expect(
        el.shadowRoot!.querySelector('[part="header-actions"]')!.hasAttribute('hidden'),
        "firstUpdated() collected the already-slotted header-actions content, with no slotchange ever reaching the component's own listener"
      ).to.equal(false);
    } finally {
      el.remove();
    }
  });

  it('is idempotent: a real slotchange landing on top of the firstUpdated() collection does not change the result', async () => {
    // No interception here -- both firstUpdated()'s own call and the real, un-suppressed initial
    // slotchange events fire for the same batch. The diagnostic listener below proves the real
    // firing actually happened, so this test exercises the double-invocation path it claims to.
    const { el } = slotted();
    document.body.append(el);
    let realSlotchangeCount = 0;
    el.renderRoot!.addEventListener(
      'slotchange',
      () => realSlotchangeCount++,
      { capture: true }
    );
    try {
      await el.updateComplete;
      await aTimeout(50);
      expect(
        realSlotchangeCount,
        'the real initial slotchange events must actually have fired for this to prove anything about double-invocation'
      ).to.be.greaterThan(0);
      const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement;
      expect(toggle.hasAttribute('aria-label')).to.equal(false);
      expect(
        el.shadowRoot!.querySelector('[part="header-actions"]')!.hasAttribute('hidden')
      ).to.equal(false);
    } finally {
      el.remove();
    }
  });
});

describe('lr-app-rail-group: collapsed and the deprecated inverted open alias', () => {
  const aliasUsage: readonly DeprecatedUsage[] = [
    { tag: 'lr-app-rail-group', kind: 'property', name: 'open' },
  ];
  const contentHidden = (el: LyraAppRailGroup): boolean =>
    (el.shadowRoot!.querySelector('[part="content"]') as HTMLElement).hasAttribute('hidden');
  const toggleExpanded = (el: LyraAppRailGroup): string | null =>
    (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement).getAttribute('aria-expanded');

  it('renders open="false" exactly like collapsed, and warns once naming collapsed', async () => {
    const canonical = await fixture<LyraAppRailGroup>(
      html`<lr-app-rail-group collapsible heading="A" collapsed></lr-app-rail-group>`
    );
    await canonical.updateComplete;
    const aliased: LyraAppRailGroup[] = [];
    const warnings = await captureDeprecationWarnings(aliasUsage, async () => {
      for (let index = 0; index < 2; index += 1) {
        const el = await fixture<LyraAppRailGroup>(
          html`<lr-app-rail-group collapsible heading="A" open="false"></lr-app-rail-group>`
        );
        await el.updateComplete;
        aliased.push(el);
      }
    });
    for (const el of aliased) {
      expect(el.collapsed).to.equal(true);
      expect(el.open).to.equal(false);
      expect(contentHidden(el)).to.equal(contentHidden(canonical));
      expect(toggleExpanded(el)).to.equal(toggleExpanded(canonical));
    }
    expect(warnings.map(({ key }) => key)).to.deep.equal([
      'lyra-deprecated:lr-app-rail-group:property:open',
    ]);
    expect(warnings[0]!.message).to.contain('collapsed');
  });

  it('keeps the open property working as the inverse of collapsed', async () => {
    const el = await fixture<LyraAppRailGroup>(
      html`<lr-app-rail-group collapsible heading="A"></lr-app-rail-group>`
    );
    let warnings = await captureDeprecationWarnings(aliasUsage, () => undefined);
    expect(el.open, 'reading the alias never warns').to.equal(true);
    expect(warnings).to.have.length(0);
    warnings = await captureDeprecationWarnings(aliasUsage, async () => {
      el.open = false;
      await el.updateComplete;
    });
    expect(warnings).to.have.length(1);
    expect(el.collapsed).to.equal(true);
    expect(contentHidden(el)).to.equal(true);
    expect(el.getAttribute('open'), 'the alias keeps reflecting').to.equal('false');
    el.collapsed = false;
    await el.updateComplete;
    expect(el.open).to.equal(true);
    expect(el.hasAttribute('open')).to.equal(false);
    expect(contentHidden(el)).to.equal(false);
  });

  it('lets the last authored attribute win between collapsed and the open alias', async () => {
    const results: boolean[] = [];
    await captureDeprecationWarnings(aliasUsage, async () => {
      for (const markup of [
        html`<lr-app-rail-group heading="A" open collapsed></lr-app-rail-group>`,
        html`<lr-app-rail-group heading="A" collapsed open></lr-app-rail-group>`,
      ]) {
        const el = await fixture<LyraAppRailGroup>(markup);
        await el.updateComplete;
        results.push(el.collapsed);
      }
    });
    expect(results).to.deep.equal([true, false]);
  });

  it('lets the last write win in both directions after the first render', async () => {
    const warnings = await captureDeprecationWarnings(aliasUsage, async () => {
      const el = await fixture<LyraAppRailGroup>(
        html`<lr-app-rail-group collapsible heading="A" collapsed></lr-app-rail-group>`
      );
      await el.updateComplete;
      el.setAttribute('open', '');
      await el.updateComplete;
      expect(el.collapsed).to.equal(false);
      expect(el.hasAttribute('collapsed')).to.equal(false);
      expect(contentHidden(el)).to.equal(false);
      el.collapsed = true;
      await el.updateComplete;
      expect(el.open).to.equal(false);
      expect(el.getAttribute('open')).to.equal('false');
      expect(contentHidden(el)).to.equal(true);
    });
    expect(warnings.map(({ key }) => key)).to.deep.equal([
      'lyra-deprecated:lr-app-rail-group:property:open',
    ]);
  });

  it('keeps a lone open attribute driving collapsed after the first render', async () => {
    await captureDeprecationWarnings(aliasUsage, async () => {
      const el = await fixture<LyraAppRailGroup>(
        html`<lr-app-rail-group collapsible heading="A" open="false"></lr-app-rail-group>`
      );
      await el.updateComplete;
      expect(el.hasAttribute('collapsed'), 'reflected from the alias').to.equal(true);
      el.setAttribute('open', 'true');
      await el.updateComplete;
      expect(el.collapsed).to.equal(false);
      expect(el.hasAttribute('collapsed')).to.equal(false);
      expect(contentHidden(el)).to.equal(false);
      el.setAttribute('open', 'false');
      await el.updateComplete;
      expect(el.collapsed).to.equal(true);
    });
  });

  it('lets a request listener resolve the toggle through the open alias', async () => {
    const el = await fixture<LyraAppRailGroup>(
      html`<lr-app-rail-group collapsible heading="A"></lr-app-rail-group>`
    );
    await el.updateComplete;
    let settled = 0;
    el.addEventListener('lr-toggle', () => (settled += 1));
    el.addEventListener('lr-toggle-request', () => {
      el.open = true;
    });
    await captureDeprecationWarnings(aliasUsage, async () => {
      (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement).click();
      await el.updateComplete;
    });
    expect(el.collapsed).to.equal(false);
    expect(settled).to.equal(0);
  });

  it('reports the proposed and settled state as expanded beside the deprecated open key', async () => {
    const el = await fixture<LyraAppRailGroup>(
      html`<lr-app-rail-group collapsible heading="A"></lr-app-rail-group>`
    );
    await el.updateComplete;
    const details: string[] = [];
    el.addEventListener('lr-toggle-request', (event) => details.push(JSON.stringify(event.detail)));
    el.addEventListener('lr-toggle', (event) => details.push(JSON.stringify(event.detail)));
    const toggle = el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement;
    toggle.click();
    await el.updateComplete;
    toggle.click();
    await el.updateComplete;
    expect(details).to.deep.equal([
      JSON.stringify({ open: false, expanded: false }),
      JSON.stringify({ open: false, expanded: false }),
      JSON.stringify({ open: true, expanded: true }),
      JSON.stringify({ open: true, expanded: true }),
    ]);
  });
});
