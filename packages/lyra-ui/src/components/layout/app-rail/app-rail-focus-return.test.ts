import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import type { LyraAppRail, LyraAppRailToggleDetail } from './app-rail.class.js';
import './app-rail.js';

// Deterministic matchMedia stand-in, so the rail's mode never depends on the test viewport.
let originalMatchMedia: typeof window.matchMedia;
beforeEach(() => {
  originalMatchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }) as unknown as MediaQueryList) as typeof window.matchMedia;
});
afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

function mobile(rail: LyraAppRail): void {
  (rail as unknown as { onMobileChange(event: { matches: boolean }): void }).onMobileChange({ matches: true });
}

function deepActive(): Element | null {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

function describeActive(): string {
  const active = deepActive();
  return active ? `${active.localName}${active.id ? `#${active.id}` : ''}` : 'null';
}

interface HostFixture {
  rail: LyraAppRail;
  trigger: HTMLButtonElement;
  navItem: HTMLButtonElement;
  cleanup(): void;
}

/**
 * A host that hides its own hamburger while the drawer is open and re-shows it from its own
 * render, a frame after it learns of the close through `lr-toggle` -- the shape of a framework
 * host whose render is scheduled rather than synchronous with the event.
 */
async function hostWithHidingTrigger(options: { reShow: boolean; hideToggle?: boolean }): Promise<HostFixture> {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = 'host-trigger';
  trigger.textContent = 'Menu';
  document.body.appendChild(trigger);
  const rail = await fixture<LyraAppRail>(html`
    <lr-app-rail ?hide-toggle=${options.hideToggle ?? true} style="--lr-transition-base:0ms">
      <button id="nav-item" type="button">Home</button>
    </lr-app-rail>
  `);
  rail.trigger = trigger;
  mobile(rail);
  await rail.updateComplete;
  const onToggle = (event: Event): void => {
    const { open } = (event as CustomEvent<LyraAppRailToggleDetail>).detail;
    if (open) {
      trigger.style.visibility = 'hidden';
      return;
    }
    if (options.reShow) requestAnimationFrame(() => { trigger.style.visibility = ''; });
  };
  rail.addEventListener('lr-toggle', onToggle);
  return {
    rail,
    trigger,
    navItem: rail.querySelector<HTMLButtonElement>('#nav-item')!,
    cleanup: () => {
      rail.removeEventListener('lr-toggle', onToggle);
      trigger.remove();
    },
  };
}

async function openFromTrigger(rail: LyraAppRail, trigger: HTMLButtonElement): Promise<void> {
  trigger.focus();
  rail.toggle();
  await rail.updateComplete;
  expect(rail.open).to.equal(true);
  expect(trigger.style.visibility).to.equal('hidden');
}

const closePaths: Array<{ name: string; close(rail: LyraAppRail, navItem: HTMLButtonElement): Promise<void> }> = [
  { name: 'Escape', close: async () => { await sendKeys({ press: 'Escape' }); } },
  {
    name: 'a backdrop click',
    close: async (rail) => { rail.shadowRoot!.querySelector<HTMLElement>('[part="backdrop"]')!.click(); },
  },
  { name: 'a nav-item click', close: async (_rail, navItem) => { navItem.click(); } },
  { name: 'toggle()', close: async (rail) => { rail.toggle(); } },
];

describe('app rail mobile overlay focus return', () => {
  for (const path of closePaths) {
    it(`returns focus to a trigger the host re-shows after ${path.name} closes the overlay`, async () => {
      const { rail, trigger, navItem, cleanup } = await hostWithHidingTrigger({ reShow: true });
      try {
        await openFromTrigger(rail, trigger);
        await path.close(rail, navItem);
        await rail.updateComplete;
        expect(rail.open).to.equal(false);
        await waitUntil(() => deepActive() === trigger, `focus stayed on ${describeActive()}`);
      } finally {
        cleanup();
      }
    });
  }

  it('falls back to the element that held focus when the overlay opened while the trigger stays hidden', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    const opener = document.createElement('button');
    opener.type = 'button';
    opener.id = 'opener';
    opener.textContent = 'Search';
    document.body.appendChild(opener);
    try {
      opener.focus();
      rail.toggle();
      await rail.updateComplete;
      expect(trigger.style.visibility).to.equal('hidden');
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      await waitUntil(() => deepActive() === opener, `focus stayed on ${describeActive()}`);
      expect(getComputedStyle(trigger).visibility).to.equal('hidden');
    } finally {
      opener.remove();
      cleanup();
    }
  });

  it('falls back to the built-in toggle when neither the trigger nor the opener can take focus', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false, hideToggle: false });
    try {
      await openFromTrigger(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      const toggle = rail.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!;
      await waitUntil(() => deepActive() === toggle, `focus stayed on ${describeActive()}`);
    } finally {
      cleanup();
    }
  });

  it('never steals focus the user moved elsewhere before the deferred return runs', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: true });
    const elsewhere = document.createElement('input');
    elsewhere.id = 'elsewhere';
    elsewhere.setAttribute('aria-label', 'Elsewhere');
    document.body.appendChild(elsewhere);
    try {
      await openFromTrigger(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      elsewhere.focus();
      for (let frame = 0; frame < 4; frame++) await nextFrame();
      expect(getComputedStyle(trigger).visibility).to.equal('visible');
      expect(deepActive() === elsewhere, `focus moved to ${describeActive()}`).to.equal(true);
    } finally {
      elsewhere.remove();
      cleanup();
    }
  });

  it('returns focus to a trigger reassigned while the overlay is open', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: true });
    const replacement = document.createElement('button');
    replacement.type = 'button';
    replacement.id = 'replacement-trigger';
    replacement.textContent = 'Menu (moved)';
    document.body.appendChild(replacement);
    try {
      await openFromTrigger(rail, trigger);
      rail.trigger = replacement;
      await rail.updateComplete;
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      expect(rail.open).to.equal(false);
      await waitUntil(() => deepActive() === replacement, `focus stayed on ${describeActive()}`);
    } finally {
      replacement.remove();
      cleanup();
    }
  });

  it('returns focus to a for-association retargeted while the overlay is open', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: true });
    const replacement = document.createElement('button');
    replacement.type = 'button';
    replacement.id = 'replacement-for-trigger';
    replacement.textContent = 'Menu (moved)';
    document.body.appendChild(replacement);
    try {
      rail.trigger = null;
      rail.for = trigger.id;
      await rail.updateComplete;
      await openFromTrigger(rail, trigger);
      rail.for = replacement.id;
      await rail.updateComplete;
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      await waitUntil(() => deepActive() === replacement, `focus stayed on ${describeActive()}`);
    } finally {
      replacement.remove();
      cleanup();
    }
  });

  it('abandons a pending return when the overlay reopens before it runs', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: true });
    try {
      await openFromTrigger(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      rail.toggle();
      await rail.updateComplete;
      for (let frame = 0; frame < 4; frame++) await nextFrame();
      expect(rail.open).to.equal(true);
      expect(rail.contains(deepActive()) || rail.shadowRoot!.contains(deepActive()), `focus moved to ${describeActive()}`)
        .to.equal(true);
    } finally {
      rail.open = false;
      await rail.updateComplete;
      cleanup();
    }
  });
});
