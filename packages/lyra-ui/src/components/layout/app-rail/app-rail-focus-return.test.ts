import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
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
async function hostWithHidingTrigger(options: { reShow: boolean; withoutToggle?: boolean }): Promise<HostFixture> {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = 'host-trigger';
  trigger.textContent = 'Menu';
  document.body.appendChild(trigger);
  const rail = await fixture<LyraAppRail>(html`
    <lr-app-rail ?without-toggle=${options.withoutToggle ?? true} style="--lr-transition-base:0ms">
      <button id="nav-item" type="button">Home</button>
    </lr-app-rail>
  `);
  rail.trigger = trigger;
  mobile(rail);
  await rail.updateComplete;
  const onToggle = (event: Event): void => {
    const { expanded } = (event as CustomEvent<LyraAppRailToggleDetail>).detail;
    if (expanded) {
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
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false, withoutToggle: false });
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

  for (const path of closePaths) {
    it(`returns to the rail host after ${path.name} when the hidden toggle and opener cannot receive focus`, async () => {
      const { rail, trigger, navItem, cleanup } = await hostWithHidingTrigger({ reShow: false });
      try {
        await openFromTrigger(rail, trigger);
        await path.close(rail, navItem);
        await rail.updateComplete;
        expect(rail.open).to.equal(false);
        await waitUntil(() => deepActive() === rail, `focus stayed on ${describeActive()}`);
        expect(rail.getAttribute('tabindex')).to.equal('-1');
        trigger.style.visibility = '';
        trigger.focus();
        expect(rail.hasAttribute('tabindex')).to.equal(false);
      } finally {
        cleanup();
      }
    });
  }

  it('keeps the temporary host tabindex through a window-level blur that leaves the host focused', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    try {
      await openFromTrigger(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      await waitUntil(() => deepActive() === rail, `focus stayed on ${describeActive()}`);
      // A window or tab losing system focus fires blur at the focused element while
      // document.activeElement stays on it.
      rail.dispatchEvent(new FocusEvent('blur'));
      expect(rail.getAttribute('tabindex')).to.equal('-1');
      for (let frame = 0; frame < 2; frame++) await nextFrame();
      expect(deepActive() === rail, `focus moved to ${describeActive()}`).to.equal(true);
      expect(rail.getAttribute('tabindex')).to.equal('-1');
      trigger.style.visibility = '';
      trigger.focus();
      await waitUntil(() => deepActive() === trigger, `focus stayed on ${describeActive()}`);
      expect(rail.hasAttribute('tabindex')).to.equal(false);
    } finally {
      cleanup();
    }
  });

  it('hands the temporary host tabindex back when focus left the host while the window was in the background', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    // Engines fire no blur at the old element for a focus move made while the window lacks
    // system focus; suppress it here to model that move.
    const suppressBlur = (event: Event): void => event.stopImmediatePropagation();
    try {
      await openFromTrigger(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      await waitUntil(() => deepActive() === rail, `focus stayed on ${describeActive()}`);
      rail.dispatchEvent(new FocusEvent('blur'));
      trigger.style.visibility = '';
      rail.addEventListener('blur', suppressBlur, { capture: true });
      trigger.focus();
      rail.removeEventListener('blur', suppressBlur, { capture: true });
      await waitUntil(() => deepActive() === trigger, `focus stayed on ${describeActive()}`);
      expect(rail.getAttribute('tabindex')).to.equal('-1');
      window.dispatchEvent(new FocusEvent('focus'));
      expect(rail.hasAttribute('tabindex')).to.equal(false);
      expect(deepActive() === trigger, `focus moved to ${describeActive()}`).to.equal(true);
    } finally {
      rail.removeEventListener('blur', suppressBlur, { capture: true });
      cleanup();
    }
  });

  it('keeps the temporary host tabindex when the window regains focus with the host still focused', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    try {
      await openFromTrigger(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      await waitUntil(() => deepActive() === rail, `focus stayed on ${describeActive()}`);
      rail.dispatchEvent(new FocusEvent('blur'));
      window.dispatchEvent(new FocusEvent('focus'));
      expect(rail.getAttribute('tabindex')).to.equal('-1');
      expect(deepActive() === rail, `focus moved to ${describeActive()}`).to.equal(true);
    } finally {
      cleanup();
    }
  });

  it('removes the temporary host tabindex when the rail disconnects while holding fallback focus', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    const parent = rail.parentNode!;
    // Not every engine fires blur at a focused element that is removed; suppress it here so only
    // the disconnect cleanup can hand the attribute back.
    const suppressBlur = (event: Event): void => event.stopImmediatePropagation();
    try {
      await openFromTrigger(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      await waitUntil(() => deepActive() === rail, `focus stayed on ${describeActive()}`);
      rail.addEventListener('blur', suppressBlur, { capture: true });
      rail.remove();
      rail.removeEventListener('blur', suppressBlur, { capture: true });
      expect(rail.hasAttribute('tabindex')).to.equal(false);
      parent.appendChild(rail);
      await rail.updateComplete;
      expect(rail.hasAttribute('tabindex')).to.equal(false);
      // No listener left over from the removed fallback strips a tabindex authored after reconnect.
      rail.setAttribute('tabindex', '-1');
      rail.focus();
      await waitUntil(() => deepActive() === rail, `focus stayed on ${describeActive()}`);
      trigger.style.visibility = '';
      trigger.focus();
      await waitUntil(() => deepActive() === trigger, `focus stayed on ${describeActive()}`);
      window.dispatchEvent(new FocusEvent('focus'));
      expect(rail.getAttribute('tabindex')).to.equal('-1');
    } finally {
      rail.removeEventListener('blur', suppressBlur, { capture: true });
      cleanup();
    }
  });

  it('preserves an authored tabindex when the rail host receives fallback focus', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    rail.tabIndex = 0;
    try {
      await openFromTrigger(rail, trigger);
      rail.toggle();
      await rail.updateComplete;
      await waitUntil(() => deepActive() === rail, `focus stayed on ${describeActive()}`);
      trigger.style.visibility = '';
      trigger.focus();
      expect(rail.getAttribute('tabindex')).to.equal('0');
    } finally {
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

async function settleFrames(count = 4): Promise<void> {
  for (let frame = 0; frame < count; frame++) await nextFrame();
}

function blurActive(): void {
  (document.activeElement as HTMLElement | null)?.blur();
}

async function openByKeyboard(rail: LyraAppRail, trigger: HTMLButtonElement): Promise<void> {
  await focusByKeyboard(trigger);
  rail.toggle();
  await rail.updateComplete;
  expect(rail.open).to.equal(true);
}

/** A focusable application region, the typical last-resort focus target. */
function fallbackTarget(id: string, parent: Node = document.body): HTMLElement {
  const main = document.createElement('main');
  main.id = id;
  main.tabIndex = -1;
  main.textContent = 'View';
  parent.appendChild(main);
  return main;
}

/** `focusFallback` as a stable primitive for assertions: the id string, `null`, or the element's id. */
function fallbackValue(rail: LyraAppRail): string | null {
  const value = rail.focusFallback;
  return value === null || typeof value === 'string' ? value : `element#${value.id}`;
}

type HostLoss = 'hidden' | 'inert ancestor';

/** A host that takes the rail itself out of the layout as the overlay closes -- `hidden` on the
 *  rail, or `inert` on its parent -- and puts it back when the overlay reopens. */
function loseHostOnClose(rail: LyraAppRail, loss: HostLoss): () => void {
  const parent = rail.parentElement!;
  const onToggle = (event: Event): void => {
    if ((event as CustomEvent<LyraAppRailToggleDetail>).detail.expanded) {
      rail.hidden = false;
      parent.inert = false;
      return;
    }
    if (loss === 'hidden') rail.hidden = true;
    else parent.inert = true;
  };
  rail.addEventListener('lr-toggle', onToggle);
  return () => {
    rail.removeEventListener('lr-toggle', onToggle);
    rail.hidden = false;
    parent.inert = false;
  };
}

describe('app rail focus return when nothing held focus at open', () => {
  async function scriptOpenedRail(withoutToggle: boolean): Promise<LyraAppRail> {
    const rail = await fixture<LyraAppRail>(html`
      <lr-app-rail ?without-toggle=${withoutToggle} style="--lr-transition-base:0ms">
        <button type="button">Home</button>
      </lr-app-rail>
    `);
    mobile(rail);
    await rail.updateComplete;
    blurActive();
    rail.open = true;
    await rail.updateComplete;
    expect(rail.open).to.equal(true);
    return rail;
  }

  it('continues past an overlay opened with nothing focused to the built-in toggle', async () => {
    const rail = await scriptOpenedRail(false);
    rail.open = false;
    await rail.updateComplete;
    const toggle = rail.shadowRoot!.querySelector<HTMLButtonElement>('[part="toggle"]')!;
    await waitUntil(() => deepActive() === toggle, `focus stayed on ${describeActive()}`);
  });

  it('continues past an overlay opened with nothing focused to the rail host under without-toggle', async () => {
    const rail = await scriptOpenedRail(true);
    rail.open = false;
    await rail.updateComplete;
    await waitUntil(() => deepActive() === rail, `focus stayed on ${describeActive()}`);
    expect(rail.getAttribute('tabindex')).to.equal('-1');
  });
});

describe('app rail focus fallback', () => {
  const losses: HostLoss[] = ['hidden', 'inert ancestor'];
  for (const path of closePaths) {
    for (const loss of losses) {
      it(`moves focus to focusFallback after ${path.name} when the rail host is lost (${loss})`, async () => {
        const { rail, trigger, navItem, cleanup } = await hostWithHidingTrigger({ reShow: false });
        const main = fallbackTarget('fallback-main');
        const release = loseHostOnClose(rail, loss);
        try {
          rail.focusFallback = main;
          await openByKeyboard(rail, trigger);
          await path.close(rail, navItem);
          await rail.updateComplete;
          expect(rail.open).to.equal(false);
          await waitUntil(() => deepActive() === main, `focus stayed on ${describeActive()}`);
          expect(rail.hasAttribute('tabindex')).to.equal(false);
        } finally {
          release();
          main.remove();
          cleanup();
        }
      });
    }
  }

  it('resolves the focus-fallback attribute as an id in the root of the rail', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    const main = fallbackTarget('fb-main');
    const release = loseHostOnClose(rail, 'hidden');
    try {
      rail.setAttribute('focus-fallback', 'fb-main');
      await openByKeyboard(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      await waitUntil(() => deepActive() === main, `focus stayed on ${describeActive()}`);
    } finally {
      release();
      main.remove();
      cleanup();
    }
  });

  it('resolves focus-fallback inside the shadow root that contains the rail, never the document', async () => {
    const decoy = fallbackTarget('scoped-main');
    const outer = document.createElement('div');
    document.body.appendChild(outer);
    const root = outer.attachShadow({ mode: 'open' });
    root.innerHTML = '<button id="scoped-trigger" type="button">Menu</button>'
      + '<lr-app-rail without-toggle focus-fallback="scoped-main" style="--lr-transition-base:0ms">'
      + '<button type="button">Home</button></lr-app-rail>'
      + '<main id="scoped-main" tabindex="-1">View</main>';
    const rail = root.querySelector<LyraAppRail>('lr-app-rail')!;
    const trigger = root.querySelector<HTMLButtonElement>('#scoped-trigger')!;
    const scopedMain = root.querySelector<HTMLElement>('#scoped-main')!;
    const onToggle = (event: Event): void => {
      if ((event as CustomEvent<LyraAppRailToggleDetail>).detail.expanded) trigger.style.visibility = 'hidden';
      else rail.hidden = true;
    };
    try {
      await rail.updateComplete;
      rail.trigger = trigger;
      mobile(rail);
      await rail.updateComplete;
      rail.addEventListener('lr-toggle', onToggle);
      await openByKeyboard(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      await waitUntil(() => deepActive() === scopedMain, `focus stayed on ${describeActive()}`);
      expect(deepActive() === decoy, `focus moved to ${describeActive()}`).to.equal(false);
    } finally {
      rail.removeEventListener('lr-toggle', onToggle);
      outer.remove();
      decoy.remove();
    }
  });

  it('prefers an available rail host over focusFallback', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    const main = fallbackTarget('fallback-main');
    try {
      rail.focusFallback = main;
      await openByKeyboard(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      await waitUntil(() => deepActive() === rail, `focus stayed on ${describeActive()}`);
      await settleFrames(2);
      expect(deepActive() === main, `focus moved to ${describeActive()}`).to.equal(false);
    } finally {
      main.remove();
      cleanup();
    }
  });

  it('prefers a trigger the host re-shows over focusFallback', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: true });
    const main = fallbackTarget('fallback-main');
    const release = loseHostOnClose(rail, 'hidden');
    try {
      rail.focusFallback = main;
      await openByKeyboard(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      await waitUntil(() => deepActive() === trigger, `focus stayed on ${describeActive()}`);
    } finally {
      release();
      main.remove();
      cleanup();
    }
  });

  const unavailable: Array<{ name: string; setUp(rail: LyraAppRail): { candidate: HTMLElement; dispose(): void } }> = [
    {
      name: 'hidden',
      setUp: (rail) => {
        const candidate = fallbackTarget('unavailable-main');
        candidate.hidden = true;
        rail.focusFallback = candidate;
        return { candidate, dispose: () => candidate.remove() };
      },
    },
    {
      name: 'under an inert ancestor',
      setUp: (rail) => {
        const wrapper = document.createElement('div');
        wrapper.inert = true;
        document.body.appendChild(wrapper);
        const candidate = fallbackTarget('unavailable-main', wrapper);
        rail.focusFallback = candidate;
        return { candidate, dispose: () => wrapper.remove() };
      },
    },
    {
      name: 'aria-hidden',
      setUp: (rail) => {
        const candidate = fallbackTarget('unavailable-main');
        candidate.setAttribute('aria-hidden', 'true');
        rail.focusFallback = candidate;
        return { candidate, dispose: () => candidate.remove() };
      },
    },
    {
      name: 'an element removed from the document before the close',
      setUp: (rail) => {
        const candidate = fallbackTarget('unavailable-main');
        rail.focusFallback = candidate;
        candidate.remove();
        return { candidate, dispose: () => candidate.remove() };
      },
    },
    {
      name: 'an id that resolves to nothing',
      setUp: (rail) => {
        const candidate = fallbackTarget('present-main');
        rail.setAttribute('focus-fallback', 'missing-main');
        return { candidate, dispose: () => candidate.remove() };
      },
    },
    {
      name: 'a region without a tabindex',
      setUp: (rail) => {
        const candidate = document.createElement('main');
        candidate.id = 'unfocusable-main';
        candidate.textContent = 'View';
        document.body.appendChild(candidate);
        rail.focusFallback = candidate;
        return { candidate, dispose: () => candidate.remove() };
      },
    },
    {
      // Characterization only: anything inside the rail is unavailable whenever the rail host is.
      name: 'content slotted into the rail itself',
      setUp: (rail) => {
        const candidate = document.createElement('button');
        candidate.type = 'button';
        candidate.slot = 'header';
        candidate.textContent = 'Brand';
        rail.appendChild(candidate);
        rail.focusFallback = candidate;
        return { candidate, dispose: () => candidate.remove() };
      },
    },
  ];
  for (const scenario of unavailable) {
    it(`leaves focus where it is when focusFallback is ${scenario.name}`, async () => {
      const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
      const { candidate, dispose } = scenario.setUp(rail);
      const hadTabIndex = candidate.hasAttribute('tabindex');
      const release = loseHostOnClose(rail, 'hidden');
      try {
        await openByKeyboard(rail, trigger);
        await sendKeys({ press: 'Escape' });
        await rail.updateComplete;
        await settleFrames();
        expect(deepActive() === candidate, `focus moved to ${describeActive()}`).to.equal(false);
        expect(rail.hasAttribute('tabindex')).to.equal(false);
        expect(candidate.hasAttribute('tabindex')).to.equal(hadTabIndex);
      } finally {
        release();
        dispose();
        cleanup();
      }
    });
  }

  it('resolves focusFallback when the pass runs, honoring a reassignment made while the overlay is open', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    const first = fallbackTarget('first-main');
    const second = fallbackTarget('second-main');
    const release = loseHostOnClose(rail, 'hidden');
    try {
      rail.focusFallback = first;
      await openByKeyboard(rail, trigger);
      rail.focusFallback = second;
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      await waitUntil(() => deepActive() === second, `focus stayed on ${describeActive()}`);
    } finally {
      release();
      first.remove();
      second.remove();
      cleanup();
    }
  });

  it('resolves focusFallback when the pass runs, honoring a reassignment made right after the close', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    const first = fallbackTarget('first-main');
    const second = fallbackTarget('second-main');
    const release = loseHostOnClose(rail, 'hidden');
    try {
      rail.focusFallback = first;
      await openByKeyboard(rail, trigger);
      rail.toggle();
      rail.focusFallback = second;
      await rail.updateComplete;
      expect(rail.open).to.equal(false);
      await waitUntil(() => deepActive() === second, `focus stayed on ${describeActive()}`);
    } finally {
      release();
      first.remove();
      second.remove();
      cleanup();
    }
  });

  it('finds an id-named fallback the host re-creates from its own frame callback after the close', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    let current = fallbackTarget('re-main');
    const release = loseHostOnClose(rail, 'hidden');
    const recreate = (event: Event): void => {
      if ((event as CustomEvent<LyraAppRailToggleDetail>).detail.expanded) return;
      requestAnimationFrame(() => {
        current.remove();
        current = fallbackTarget('re-main');
      });
    };
    const original = current;
    rail.addEventListener('lr-toggle', recreate);
    try {
      rail.setAttribute('focus-fallback', 're-main');
      await openByKeyboard(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      await waitUntil(() => current !== original && deepActive() === current, `focus stayed on ${describeActive()}`);
    } finally {
      rail.removeEventListener('lr-toggle', recreate);
      release();
      current.remove();
      cleanup();
    }
  });

  it('never takes back focus moved elsewhere before the pass, even with focusFallback set', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    const main = fallbackTarget('fallback-main');
    const elsewhere = document.createElement('input');
    elsewhere.id = 'elsewhere';
    elsewhere.setAttribute('aria-label', 'Elsewhere');
    document.body.appendChild(elsewhere);
    const release = loseHostOnClose(rail, 'hidden');
    try {
      rail.focusFallback = main;
      await openByKeyboard(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      elsewhere.focus();
      await settleFrames();
      expect(deepActive() === elsewhere, `focus moved to ${describeActive()}`).to.equal(true);
    } finally {
      release();
      elsewhere.remove();
      main.remove();
      cleanup();
    }
  });

  it('abandons the fallback when the overlay reopens before the pass runs', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    const main = fallbackTarget('fallback-main');
    const release = loseHostOnClose(rail, 'hidden');
    try {
      rail.focusFallback = main;
      await openByKeyboard(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      rail.toggle();
      await rail.updateComplete;
      await settleFrames();
      expect(rail.open).to.equal(true);
      expect(deepActive() === main, `focus moved to ${describeActive()}`).to.equal(false);
    } finally {
      rail.open = false;
      await rail.updateComplete;
      release();
      main.remove();
      cleanup();
    }
  });

  it('is not consulted when a breakpoint change closes the overlay by leaving mobile', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    const main = fallbackTarget('fallback-main');
    try {
      rail.focusFallback = main;
      await openByKeyboard(rail, trigger);
      (rail as unknown as { onMobileChange(event: { matches: boolean }): void }).onMobileChange({ matches: false });
      await rail.updateComplete;
      await settleFrames();
      expect(rail.open).to.equal(false);
      expect(deepActive() === main, `focus moved to ${describeActive()}`).to.equal(false);
      const active = deepActive();
      expect(rail.contains(active) || rail.shadowRoot!.contains(active), `focus moved to ${describeActive()}`)
        .to.equal(true);
    } finally {
      main.remove();
      cleanup();
    }
  });

  it('reaches focusFallback after a script open with nothing focused', async () => {
    const rail = await fixture<LyraAppRail>(html`
      <lr-app-rail without-toggle style="--lr-transition-base:0ms">
        <button type="button">Home</button>
      </lr-app-rail>
    `);
    const main = fallbackTarget('fallback-main');
    try {
      rail.focusFallback = main;
      mobile(rail);
      await rail.updateComplete;
      blurActive();
      rail.open = true;
      await rail.updateComplete;
      rail.hidden = true;
      rail.open = false;
      await rail.updateComplete;
      await waitUntil(() => deepActive() === main, `focus stayed on ${describeActive()}`);
    } finally {
      rail.hidden = false;
      main.remove();
    }
  });

  it('unset (the default), a close with every target unavailable leaves focus where it is and hands the temporary tabindex back', async () => {
    const { rail, trigger, cleanup } = await hostWithHidingTrigger({ reShow: false });
    const release = loseHostOnClose(rail, 'hidden');
    try {
      expect(fallbackValue(rail)).to.equal(null);
      expect(rail.hasAttribute('focus-fallback')).to.equal(false);
      await openByKeyboard(rail, trigger);
      await sendKeys({ press: 'Escape' });
      await rail.updateComplete;
      await settleFrames();
      expect(deepActive() === trigger, `focus moved to ${describeActive()}`).to.equal(false);
      expect(deepActive() === rail, `focus moved to ${describeActive()}`).to.equal(false);
      expect(rail.hasAttribute('tabindex')).to.equal(false);
    } finally {
      release();
      cleanup();
    }
  });

  it('reads the focus-fallback attribute back as a string, clears to null on removal, and writes no attribute for an element', async () => {
    const rail = await fixture<LyraAppRail>(html`<lr-app-rail><button type="button">Home</button></lr-app-rail>`);
    const main = fallbackTarget('contract-main');
    try {
      rail.setAttribute('focus-fallback', 'contract-main');
      expect(fallbackValue(rail)).to.equal('contract-main');
      rail.removeAttribute('focus-fallback');
      expect(fallbackValue(rail)).to.equal(null);
      rail.focusFallback = main;
      await rail.updateComplete;
      expect(rail.focusFallback === main).to.equal(true);
      expect(fallbackValue(rail)).to.equal('element#contract-main');
      expect(rail.hasAttribute('focus-fallback')).to.equal(false);
    } finally {
      main.remove();
    }
  });
});
