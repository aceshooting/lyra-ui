import { elementUpdated, expect, fixture } from '@open-wc/testing';
import './dock-panel.js';
import type { LyraDockPanel, LyraDockPanelResizeDetail } from './dock-panel.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

async function dockedFixture(attrs = ''): Promise<LyraDockPanel> {
  const wrapper = await fixture<HTMLDivElement>(
    `<div style="position: relative; height: 20rem; inline-size: 60rem; display: flex;">
      <div style="flex: 1;">main</div>
      <lr-dock-panel placement="end" ${attrs}>panel body</lr-dock-panel>
    </div>`
  );
  const panel = wrapper.querySelector('lr-dock-panel') as LyraDockPanel;
  await elementUpdated(panel);
  return panel;
}

function pointer(pointerId: number, init: PointerEventInit = {}): PointerEventInit {
  return { bubbles: true, pointerId, pointerType: 'mouse', isPrimary: true, button: 0, ...init };
}

function handleOf(panel: LyraDockPanel): HTMLElement {
  const handle = panel.shadowRoot!.querySelector<HTMLElement>('[part="handle"]')!;
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};
  return handle;
}

describe('lr-dock-panel gesture edges', () => {
  it('ignores moves, cancels and releases from a pointer other than the dragging one', async () => {
    const el = await dockedFixture('extent="300px" min-extent="100px" max-extent="500px"');
    const handle = handleOf(el);
    const resized: string[] = [];
    const changes: string[] = [];
    el.addEventListener('lr-resize', (e) => resized.push((e as CustomEvent<LyraDockPanelResizeDetail>).detail.extent));
    el.addEventListener('lr-resize-change', (e) => changes.push((e as CustomEvent<LyraDockPanelResizeDetail>).detail.extent));

    handle.dispatchEvent(new PointerEvent('pointerdown', pointer(21, { clientX: 200 })));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 22, clientX: 100 }));
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 22 }));
    window.dispatchEvent(new PointerEvent('pointerup', pointer(22)));
    expect(resized).to.deep.equal([]);
    expect(el.extent).to.equal('300px');

    // The original drag survived the foreign pointer and still settles.
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 21, clientX: 160 }));
    window.dispatchEvent(new PointerEvent('pointerup', pointer(21)));
    expect(resized).to.deep.equal(['340px']);
    expect(changes).to.deep.equal(['340px']);
  });

  for (const property of ['withoutResize', 'disabled'] as const) {
    it(`abandons an active drag when ${property} is set mid-gesture`, async () => {
      const el = await dockedFixture('extent="300px" min-extent="100px" max-extent="500px"');
      const handle = handleOf(el);
      const resized: string[] = [];
      el.addEventListener('lr-resize', (e) => resized.push((e as CustomEvent<LyraDockPanelResizeDetail>).detail.extent));

      handle.dispatchEvent(new PointerEvent('pointerdown', pointer(31, { clientX: 200 })));
      el[property] = true;
      await elementUpdated(el);
      expect(el.shadowRoot!.querySelector('[part="handle"]') === null).to.equal(true);

      el[property] = false;
      await elementUpdated(el);
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 31, clientX: 120 }));
      window.dispatchEvent(new PointerEvent('pointerup', pointer(31)));
      expect(resized).to.deep.equal([]);
      expect(el.extent).to.equal('300px');
    });
  }

  it('ignores a toggle requested from inside its own toggle-request listener', async () => {
    const el = await dockedFixture('extent="300px" collapsible');
    let requests = 0;
    let nestedResult: boolean | undefined;
    el.addEventListener('lr-toggle-request', () => {
      requests += 1;
      nestedResult = el.toggle();
    });
    const toggles: boolean[] = [];
    el.addEventListener('lr-toggle', (e) => toggles.push((e as CustomEvent<{ expanded: boolean }>).detail.expanded));

    expect(el.collapse()).to.equal(true);
    expect(requests).to.equal(1);
    // The nested call reported the still-expanded state and did not dispatch again.
    expect(nestedResult).to.equal(true);
    expect(toggles).to.deep.equal([false]);
    expect(el.collapsed).to.equal(true);
  });

  it('skips the remaining resize events when an lr-resize listener collapses the panel', async () => {
    const el = await dockedFixture('extent="300px" min-extent="100px" max-extent="500px"');
    const handle = handleOf(el);
    const seen: string[] = [];
    for (const type of ['lr-resize', 'lr-resize-input', 'lr-resize-change']) el.addEventListener(type, () => seen.push(type));
    el.addEventListener('lr-resize', () => { el.collapsed = true; }, { once: true });

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(seen).to.deep.equal(['lr-resize']);
    expect(el.collapsed).to.equal(true);
  });

  it('skips the settle event when an lr-resize-input listener switches resizing off', async () => {
    const el = await dockedFixture('extent="300px" min-extent="100px" max-extent="500px"');
    const handle = handleOf(el);
    const seen: string[] = [];
    for (const type of ['lr-resize', 'lr-resize-input', 'lr-resize-change']) el.addEventListener(type, () => seen.push(type));
    el.addEventListener('lr-resize-input', () => { el.withoutResize = true; }, { once: true });

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true }));
    expect(seen).to.deep.equal(['lr-resize', 'lr-resize-input']);
  });

  it('skips the drag input event when an lr-resize listener collapses the panel mid-drag', async () => {
    const el = await dockedFixture('extent="300px" min-extent="100px" max-extent="500px"');
    const handle = handleOf(el);
    const seen: string[] = [];
    for (const type of ['lr-resize', 'lr-resize-input', 'lr-resize-change']) el.addEventListener(type, () => seen.push(type));
    el.addEventListener('lr-resize', () => { el.collapsed = true; }, { once: true });

    handle.dispatchEvent(new PointerEvent('pointerdown', pointer(41, { clientX: 200 })));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 41, clientX: 150 }));
    window.dispatchEvent(new PointerEvent('pointerup', pointer(41)));
    expect(seen).to.deep.equal(['lr-resize']);
    expect(el.collapsed).to.equal(true);
  });
});

describe('lr-dock-panel rail focus edges', () => {
  async function railFixture(): Promise<LyraDockPanel> {
    const wrapper = await fixture<HTMLDivElement>(
      `<div style="position:relative;block-size:20rem;inline-size:40rem;display:flex">
        <lr-dock-panel placement="start" extent="240px">
          <span slot="rail" id="label">Rail label</span>
          <button id="inside">inside</button>
        </lr-dock-panel>
        <div style="flex:1">main</div>
      </div>`
    );
    const panel = wrapper.querySelector('lr-dock-panel') as LyraDockPanel;
    await elementUpdated(panel);
    return panel;
  }

  it('falls back to the host when collapsing leaves only unfocusable rail items', async () => {
    const panel = await railFixture();
    const inside = panel.querySelector<HTMLElement>('#inside')!;
    await focusByKeyboard(inside);
    panel.collapse();
    await elementUpdated(panel);
    await elementUpdated(panel);
    expect(document.activeElement === panel).to.equal(true);
  });

  it('keeps rail layout while more rail items are slotted in', async () => {
    const panel = await railFixture();
    panel.collapsed = true;
    await elementUpdated(panel);
    const base = panel.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
    expect(base.hasAttribute('data-rail')).to.equal(true);
    const extra = document.createElement('span');
    extra.slot = 'rail';
    extra.textContent = 'More';
    panel.append(extra);
    await new Promise((resolve) => requestAnimationFrame(resolve));
    await elementUpdated(panel);
    expect(base.hasAttribute('data-rail')).to.equal(true);
    expect(extra.getClientRects().length > 0).to.equal(true);
  });
});
