import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './tab-group.js';
import './tab.js';
import './tab-panel.js';
import type { LyraTabGroup } from './tab-group.class.js';

for (const outside of [false, true]) {
  it(`repairs removal of a manually focused unselected tab with outside focus=${outside}`, async () => {
    const root = await fixture<HTMLElement>(html`<div><button id="outside">Outside</button>
      <lr-tab-group activation="manual">
        <lr-tab panel="a">A</lr-tab><lr-tab panel="b">B</lr-tab><lr-tab panel="c">C</lr-tab>
        <lr-tab-panel name="a">A panel</lr-tab-panel><lr-tab-panel name="b">B panel</lr-tab-panel><lr-tab-panel name="c">C panel</lr-tab-panel>
      </lr-tab-group></div>`);
    const group = root.querySelector<LyraTabGroup>('lr-tab-group')!;
    const first = group.shadowRoot!.querySelector<HTMLElement>('[part="tab"][data-slot="a"]')!;
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, composed: true, cancelable: true }));
    expect(group.shadowRoot!.activeElement?.getAttribute('data-slot')).to.equal('b');
    expect(group.active).to.equal('a');
    let changes = 0;
    group.addEventListener('lr-tab-show', () => changes++);
    group.addEventListener('lr-tab-hide', () => changes++);
    if (outside) root.querySelector<HTMLElement>('#outside')!.focus();
    group.querySelector('lr-tab[panel="b"]')!.remove();
    await waitUntil(() => group.shadowRoot!.querySelectorAll('[part="tab"]').length === 2);
    expect(group.active).to.equal('a');
    expect(changes).to.equal(0);
    if (outside) expect(document.activeElement?.id).to.equal('outside');
    else {
      expect(group.shadowRoot!.activeElement?.getAttribute('part')).to.equal('tab');
      expect(group.shadowRoot!.activeElement?.getAttribute('tabindex')).to.equal('0');
    }
  });
}

describe('selection corrected after the active tab becomes unavailable', () => {
  const mount = (active = 'b') => fixture<LyraTabGroup>(html`
    <lr-tab-group active=${active}>
      <lr-tab panel="a">A</lr-tab><lr-tab panel="b">B</lr-tab><lr-tab panel="c">C</lr-tab>
      <lr-tab-panel name="a">A panel</lr-tab-panel><lr-tab-panel name="b">B panel</lr-tab-panel><lr-tab-panel name="c">C panel</lr-tab-panel>
    </lr-tab-group>`);
  const record = (group: LyraTabGroup): string[] => {
    const log: string[] = [];
    for (const type of ['hide', 'show'] as const) {
      group.addEventListener(`lr-tab-${type}`, (event) => log.push(`${type}:${(event as CustomEvent<{ name: string }>).detail.name}`));
    }
    return log;
  };

  it('reports hide then show and moves to the following tab when the active tab is removed', async () => {
    const group = await mount();
    const log = record(group);
    group.querySelector('lr-tab[panel="b"]')!.remove();
    await waitUntil(() => group.active === 'c');
    expect(log).to.deep.equal(['hide:b', 'show:c']);
  });

  it('moves to the preceding tab when the removed active tab was the last', async () => {
    const group = await mount('c');
    const log = record(group);
    group.querySelector('lr-tab[panel="c"]')!.remove();
    await waitUntil(() => group.active === 'b');
    expect(log).to.deep.equal(['hide:c', 'show:b']);
  });

  it('reports the same correction when the active tab becomes disabled', async () => {
    const group = await mount();
    const log = record(group);
    group.querySelector('lr-tab[panel="b"]')!.setAttribute('disabled', '');
    await waitUntil(() => group.active === 'c');
    expect(log).to.deep.equal(['hide:b', 'show:c']);
  });

  it('reports only the hide when no tab remains to select', async () => {
    const group = await fixture<LyraTabGroup>(html`<lr-tab-group><lr-tab panel="a">A</lr-tab><lr-tab-panel name="a">A panel</lr-tab-panel></lr-tab-group>`);
    const log = record(group);
    group.querySelector('lr-tab')!.remove();
    await waitUntil(() => group.active === '');
    expect(log).to.deep.equal(['hide:a']);
  });

  it('stays silent for the initial default and for an invalid active assignment', async () => {
    const group = await mount('missing');
    const log = record(group);
    expect(group.active).to.equal('a');
    group.active = 'unknown';
    await group.updateComplete;
    expect(group.active).to.equal('a');
    expect(log).to.deep.equal([]);
  });
});

describe('keyboard chords', () => {
  it('leaves Alt, Ctrl, Meta and composition keys to the browser', async () => {
    const group = await fixture<LyraTabGroup>(html`
      <lr-tab-group>
        <lr-tab panel="a">A</lr-tab><lr-tab panel="b">B</lr-tab>
        <lr-tab-panel name="a">A panel</lr-tab-panel><lr-tab-panel name="b">B panel</lr-tab-panel>
      </lr-tab-group>`);
    const first = group.shadowRoot!.querySelector<HTMLElement>('[part="tab"]')!;
    for (const init of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { isComposing: true }]) {
      for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true, ...init });
        first.dispatchEvent(event);
        expect(event.defaultPrevented, `${key} with ${Object.keys(init)[0]}`).to.equal(false);
      }
    }
    expect(group.active).to.equal('a');
  });
});
