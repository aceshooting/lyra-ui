import { expect, fixture, html } from '@open-wc/testing';
import type { ReactiveControllerHost } from 'lit';
import { OrientationBreakpointController } from './orientation-breakpoint.js';

/** A minimal ReactiveControllerHost backed by a real element, so the controller
 *  can resolve `em` against a genuine computed font size. Mirrors
 *  anchored-validity.test.ts's `{ addController: () => {} }` stub host. */
async function makeHost(style = ''): Promise<ReactiveControllerHost & Element> {
  const el = (await fixture(html`<div style="${style}"></div>`)) as HTMLElement;
  return Object.assign(el, {
    addController() {},
    removeController() {},
    requestUpdate() {},
    updateComplete: Promise.resolve(true),
  }) as unknown as ReactiveControllerHost & Element;
}

/** A `window.matchMedia` stand-in whose `(max-width: <n>px)` queries are evaluated against a
 *  mutable pretend viewport width, so a test can cross a breakpoint on demand. The real viewport
 *  can't be resized from inside the test page, and the detach/reattach case specifically needs the
 *  crossing to happen while the controller has no `change` listener attached — nothing a real
 *  `MediaQueryList` can be made to do here. Only bare `px` queries are understood, which is what
 *  `arm()` serializes for these tests. Restore in a `finally`. */
function installMatchMediaStub(initialWidth: number): { setWidth(width: number): void; restore(): void } {
  const original = window.matchMedia;
  let width = initialWidth;
  const lists: Array<{ media: string; max: number; listeners: Set<(e: MediaQueryListEvent) => void> }> = [];

  window.matchMedia = ((query: string) => {
    const match = /\(max-width:\s*([\d.]+)px\)/.exec(query);
    const max = match ? Number.parseFloat(match[1]) : Number.NaN;
    const entry = { media: query, max, listeners: new Set<(e: MediaQueryListEvent) => void>() };
    lists.push(entry);
    return {
      media: query,
      get matches() {
        return width <= max;
      },
      addEventListener: (_type: string, fn: (e: MediaQueryListEvent) => void) => entry.listeners.add(fn),
      removeEventListener: (_type: string, fn: (e: MediaQueryListEvent) => void) => entry.listeners.delete(fn),
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  return {
    setWidth(next: number): void {
      const before = lists.map((entry) => width <= entry.max);
      width = next;
      lists.forEach((entry, i) => {
        const matches = width <= entry.max;
        if (matches === before[i]) return;
        for (const fn of [...entry.listeners]) fn({ matches, media: entry.media } as MediaQueryListEvent);
      });
    },
    restore(): void {
      window.matchMedia = original;
    },
  };
}

describe('OrientationBreakpointController', () => {
  it('is inert until configured', async () => {
    const c = new OrientationBreakpointController(await makeHost(), () => {});
    expect(c.resolved).to.equal(undefined);
    expect(c.active).to.be.false;
    expect(c.containerObservationEnabled).to.be.false;
    expect(c.isBelow(0)).to.be.false;
  });

  it('compares container width strictly below the breakpoint', async () => {
    const c = new OrientationBreakpointController(await makeHost(), () => {});
    c.configure(500, 'container');
    expect(c.resolved).to.equal(500);
    expect(c.active).to.be.true;
    expect(c.containerObservationEnabled).to.be.true;
    expect(c.isBelow(499)).to.be.true;
    expect(c.isBelow(500), 'strict <, so equal is NOT below').to.be.false;
    expect(c.isBelow(501)).to.be.false;
  });

  it('resolves a rem breakpoint against the root font size', async () => {
    const root = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
    const c = new OrientationBreakpointController(await makeHost(), () => {});
    c.configure('10rem', 'container');
    expect(c.resolved).to.be.closeTo(10 * root, 0.001);
  });

  it('resolves an em breakpoint against the host element font size', async () => {
    const c = new OrientationBreakpointController(await makeHost('font-size: 20px'), () => {});
    c.configure('3em', 'container');
    expect(c.resolved).to.be.closeTo(60, 0.001);
  });

  it('treats an unresolvable breakpoint as fully unset', async () => {
    const c = new OrientationBreakpointController(await makeHost(), () => {});
    c.configure('80vw', 'container');
    expect(c.resolved).to.equal(undefined);
    expect(c.active).to.be.false;
    expect(c.containerObservationEnabled).to.be.false;
    expect(c.isBelow(0)).to.be.false;
  });

  it('arms no container observation under viewport basis', async () => {
    const c = new OrientationBreakpointController(await makeHost(), () => {});
    c.configure('99999px', 'viewport');
    expect(c.containerObservationEnabled).to.be.false;
  });

  it('reports below under viewport basis when an absurdly large query matches', async () => {
    const c = new OrientationBreakpointController(await makeHost(), () => {});
    c.configure('99999px', 'viewport');
    expect(c.isBelow(0)).to.be.true;
    expect(c.isBelow(1e9), 'container width is irrelevant under viewport basis').to.be.true;
  });

  it('reports not-below under viewport basis when an absurdly small query never matches', async () => {
    const c = new OrientationBreakpointController(await makeHost(), () => {});
    c.configure('1px', 'viewport');
    expect(c.isBelow(0)).to.be.false;
  });

  it('serializes a bare number to px for the media query', async () => {
    const c = new OrientationBreakpointController(await makeHost(), () => {});
    c.configure(99999, 'viewport');
    expect(c.isBelow(0)).to.be.true;
  });

  it('serializes a bare numeric string to px for the media query', async () => {
    const below = new OrientationBreakpointController(await makeHost(), () => {});
    below.configure('99999', 'viewport');
    expect(below.resolved).to.equal(99999);
    expect(below.isBelow(0)).to.be.true;

    const notBelow = new OrientationBreakpointController(await makeHost(), () => {});
    notBelow.configure('1', 'viewport');
    expect(notBelow.resolved).to.equal(1);
    expect(notBelow.isBelow(0)).to.be.false;
  });

  it('is active for an em breakpoint under viewport basis, driven by the media query rather than resolved', async () => {
    const below = new OrientationBreakpointController(await makeHost('font-size: 20px'), () => {});
    below.configure('99999em', 'viewport');
    expect(below.active).to.be.true;
    expect(below.containerObservationEnabled, 'still false under viewport basis').to.be.false;
    expect(below.isBelow(0)).to.be.true;

    const notBelow = new OrientationBreakpointController(await makeHost('font-size: 20px'), () => {});
    notBelow.configure('1em', 'viewport');
    expect(notBelow.active).to.be.true;
    expect(notBelow.isBelow(0)).to.be.false;
  });

  it('stays inactive under viewport basis for a value matchMedia grammar rejects', async () => {
    for (const raw of ['', 'auto', '80vw', Number.NaN] as const) {
      const c = new OrientationBreakpointController(await makeHost(), () => {});
      c.configure(raw, 'viewport');
      expect(c.active, `active for ${JSON.stringify(raw)}`).to.be.false;
      expect(c.containerObservationEnabled, `containerObservationEnabled for ${JSON.stringify(raw)}`).to.be.false;
      expect(c.isBelow(0), `isBelow for ${JSON.stringify(raw)}`).to.be.false;
    }
  });

  it('re-arms against the new query when reconfigured', async () => {
    const c = new OrientationBreakpointController(await makeHost(), () => {});
    c.configure('1px', 'viewport');
    expect(c.isBelow(0)).to.be.false;
    c.configure('99999px', 'viewport');
    expect(c.isBelow(0), 'a stale MediaQueryList would keep this false').to.be.true;
  });

  it('switches to width comparison when the basis changes to container', async () => {
    const c = new OrientationBreakpointController(await makeHost(), () => {});
    c.configure('99999px', 'viewport');
    expect(c.isBelow(1e9)).to.be.true;
    c.configure('99999px', 'container');
    expect(c.isBelow(1e9), 'container basis must consult the width again').to.be.false;
    expect(c.isBelow(10)).to.be.true;
  });

  it('re-arms after a disconnect/reconnect cycle without announcing an unchanged state', async () => {
    let fired = 0;
    const c = new OrientationBreakpointController(await makeHost(), () => {
      fired += 1;
    });
    c.configure('99999px', 'viewport');
    c.hostDisconnected();
    c.hostConnected();
    expect(c.isBelow(0)).to.be.true;
    expect(fired, 'the query still matches, so nothing transitioned').to.equal(0);
  });

  it('announces a crossing that happened while detached', async () => {
    const media = installMatchMediaStub(1000);
    try {
      let fired = 0;
      const c = new OrientationBreakpointController(await makeHost(), () => {
        fired += 1;
      });
      c.configure('600px', 'viewport');
      expect(c.isBelow(0), '1000px viewport is above a 600px breakpoint').to.be.false;

      c.hostDisconnected();
      media.setWidth(500);
      expect(fired, 'the listener is torn down while detached, so nothing can be observed').to.equal(0);

      c.hostConnected();
      expect(c.isBelow(0), 'the reconnected state must be current, not stale').to.be.true;
      expect(fired, 'the reconnect must announce the crossing it slept through').to.equal(1);
    } finally {
      media.restore();
    }
  });

  it('announces a crossing back the other way while detached', async () => {
    const media = installMatchMediaStub(500);
    try {
      let fired = 0;
      const c = new OrientationBreakpointController(await makeHost(), () => {
        fired += 1;
      });
      c.configure('600px', 'viewport');
      expect(c.isBelow(0)).to.be.true;

      c.hostDisconnected();
      media.setWidth(1000);
      c.hostConnected();
      expect(c.isBelow(0)).to.be.false;
      expect(fired).to.equal(1);
    } finally {
      media.restore();
    }
  });

  it('fires nothing on the first hostConnected(), before any configure()', async () => {
    // Lit connects controllers before the host's first update, so this runs while the basis is
    // still the `'container'` default and no breakpoint has been authored. An unconditional
    // announcement here would reach the host before its first render and let it emit a mount-time
    // transition event that never happened.
    let fired = 0;
    const c = new OrientationBreakpointController(await makeHost(), () => {
      fired += 1;
    });
    c.hostConnected();
    expect(fired).to.equal(0);
    expect(c.isBelow(0)).to.be.false;
  });
});
