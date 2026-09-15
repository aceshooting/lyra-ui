import { aTimeout, expect, fixture, html, oneEvent, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import './app-rail-group.js';
import '../app-rail/app-rail-item.js';
import '../app-rail/app-rail.js';
import type { LyraAppRail } from '../app-rail/app-rail.js';
import type { LyraAppRailGroup } from './app-rail-group.class.js';

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
    expect(el.open).to.equal(true);
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
    expect((event as CustomEvent<{ open: boolean }>).detail.open).to.equal(false);
    expect(order.join()).to.equal('request,toggle');
    await el.updateComplete;
    expect(el.open).to.equal(false);
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
    expect(el.open).to.equal(true);
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
      el.open = true;
    });
    let settled = 0;
    el.addEventListener('lr-toggle', () => {
      settled += 1;
    });
    (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLButtonElement).click();
    await el.updateComplete;
    expect(el.open).to.equal(true);
    expect(settled).to.equal(0);
  });

  it('accepts open="false" from markup, which a presence-based boolean cannot parse', async () => {
    const el = (await fixture<LyraAppRailGroup>(html`
      <lr-app-rail-group collapsible heading="Workspaces" open="false">
        <lr-app-rail-item href="/one">One</lr-app-rail-item>
      </lr-app-rail-group>
    `)) as LyraAppRailGroup;
    await el.updateComplete;
    expect(el.open).to.equal(false);
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
    await waitUntil(() => el.open === false, 'Enter on the focused toggle collapses the group');
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
    expect(el.open).to.equal(true);
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
      html`<lr-app-rail-group collapsible heading="A" open="false"></lr-app-rail-group>`
    )) as LyraAppRailGroup;
    const rtl = (await fixture<LyraAppRailGroup>(
      html`<lr-app-rail-group dir="rtl" collapsible heading="A" open="false"></lr-app-rail-group>`
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

    el.open = false;
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
    el.open = false;
    await el.updateComplete;
    expect(
      (el.shadowRoot!.querySelector('[part="toggle"]') as HTMLElement).getAttribute('aria-label')
    ).to.equal('Déplier');
  });
});
