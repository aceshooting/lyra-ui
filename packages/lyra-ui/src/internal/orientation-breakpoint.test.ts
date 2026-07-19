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

describe('OrientationBreakpointController', () => {
  it('is inert until configured', async () => {
    const c = new OrientationBreakpointController(await makeHost(), () => {});
    expect(c.resolved).to.equal(undefined);
    expect(c.containerObservationEnabled).to.be.false;
    expect(c.isBelow(0)).to.be.false;
  });

  it('compares container width strictly below the breakpoint', async () => {
    const c = new OrientationBreakpointController(await makeHost(), () => {});
    c.configure(500, 'container');
    expect(c.resolved).to.equal(500);
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

  it('re-arms after a disconnect/reconnect cycle', async () => {
    const c = new OrientationBreakpointController(await makeHost(), () => {});
    c.configure('99999px', 'viewport');
    c.hostDisconnected();
    c.hostConnected();
    expect(c.isBelow(0)).to.be.true;
  });
});
