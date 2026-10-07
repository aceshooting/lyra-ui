import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import { LitElement, css, type TemplateResult } from 'lit';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './dock-panel.js';
import type { LyraDockPanel } from './dock-panel.js';

class DockShellHost extends LitElement {
  static override styles = css`:host { display: block; inline-size: 300px; block-size: 200px; }`;
  protected override render(): TemplateResult {
    return html`<lr-dock-panel placement="start" extent="500px" max-extent="100%">panel</lr-dock-panel>`;
  }
}
customElements.define('dock-shell-host', DockShellHost);

async function docked(attributes = ''): Promise<LyraDockPanel> {
  const wrapper = await fixture<HTMLDivElement>(`<div style="display: flex; block-size: 20rem;">
    <div style="flex: 1">main</div><lr-dock-panel placement="end" ${attributes}></lr-dock-panel></div>`);
  const panel = wrapper.querySelector('lr-dock-panel') as LyraDockPanel;
  await panel.updateComplete;
  return panel;
}

const handleOf = (panel: LyraDockPanel): HTMLElement => panel.shadowRoot!.querySelector<HTMLElement>('[part="handle"]')!;
const toggleOf = (panel: LyraDockPanel): HTMLElement => panel.shadowRoot!.querySelector<HTMLElement>('[part="collapse-toggle"]')!;
const keydown = (key: string, init: KeyboardEventInit = {}): KeyboardEvent =>
  new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });

describe('dock-panel at the top of a shadow root', () => {
  it('bounds itself by the shadow host and re-clamps when the host resizes', async () => {
    const host = await fixture<DockShellHost>(html`<dock-shell-host></dock-shell-host>`);
    const panel = host.shadowRoot!.querySelector('lr-dock-panel') as LyraDockPanel;
    await panel.updateComplete;
    expect(panel.getBoundingClientRect().width).to.be.at.most(300);
    host.style.inlineSize = '200px';
    await waitUntil(() => panel.getBoundingClientRect().width <= 200, 'the panel follows its container');
  });
});

describe('dock-panel focus', () => {
  it('moves focus to the collapse toggle when collapsing around focused content', async () => {
    const panel = await docked('collapsible');
    const inside = document.createElement('button');
    inside.textContent = 'inside';
    panel.append(inside);
    await focusByKeyboard(inside);
    panel.collapsed = true;
    await panel.updateComplete;
    expect(panel.shadowRoot!.activeElement === toggleOf(panel)).to.equal(true);
  });

  it('moves focus to the collapse toggle when the focused handle goes away', async () => {
    const panel = await docked('collapsible');
    await focusByKeyboard(handleOf(panel));
    panel.withoutResize = true;
    await panel.updateComplete;
    expect(panel.shadowRoot!.activeElement === toggleOf(panel)).to.equal(true);
  });
});

describe('dock-panel handle keyboard', () => {
  it('leaves modified arrows to the browser', async () => {
    const panel = await docked('extent="300px" min-extent="100px" max-extent="500px"');
    for (const init of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      const event = keydown('ArrowLeft', init);
      handleOf(panel).dispatchEvent(event);
      expect(event.defaultPrevented, JSON.stringify(init)).to.equal(false);
    }
    expect(panel.extent).to.equal('300px');
  });

  it('jumps to the minimum and maximum extent with Home and End', async () => {
    const panel = await docked('extent="300px" min-extent="100px" max-extent="500px"');
    const requested: string[] = [];
    panel.addEventListener('lr-resize-request', (event) => requested.push((event as CustomEvent<{ extent: string }>).detail.extent));
    handleOf(panel).dispatchEvent(keydown('Home'));
    expect(panel.extent).to.equal('100px');
    handleOf(panel).dispatchEvent(keydown('End'));
    expect(panel.extent).to.equal('500px');
    expect(requested).to.deep.equal(['100px', '500px']);
  });
});

describe('dock-panel pointer capture', () => {
  it('survives a pointerdown whose pointer cannot be captured', async () => {
    const panel = await docked('extent="300px" min-extent="100px" max-extent="500px"');
    const down = (pointerId: number): void => {
      handleOf(panel).dispatchEvent(new PointerEvent('pointerdown', { pointerId, isPrimary: true, button: 0, clientX: 200, bubbles: true }));
    };
    down(99);
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 99 }));
    let inputs = 0;
    panel.addEventListener('lr-resize-input', () => { inputs += 1; });
    down(100);
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 100, clientX: 150 }));
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 100 }));
    expect(inputs, 'a later drag still starts').to.equal(1);
  });
});
