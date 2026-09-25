// Late definition needs a page where `lr-toggle` has never been registered, and the tag prefix is a
// constant, so this case cannot share a page with any file that imports the toggle eagerly. Only
// the group's own registration entry is imported statically; it must not register `lr-toggle`.
import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './toggle-group.js';
import type { LyraToggleGroup } from './toggle-group.class.js';
import type { LyraToggle } from '../toggle/toggle.class.js';

const control = (toggle: LyraToggle): HTMLButtonElement | null =>
  toggle.shadowRoot?.querySelector<HTMLButtonElement>('[part~="button"]') ?? null;

describe('<lr-toggle-group> with a late lr-toggle definition', () => {
  it('adopts toggles that upgrade after the group, applying a value assigned before they existed', async () => {
    expect(customElements.get('lr-toggle') === undefined, 'lr-toggle must not be registered yet').to.equal(true);
    const group = await fixture<LyraToggleGroup>(html`<lr-toggle-group label="Formatting" size="s">
      <lr-toggle value="a">A</lr-toggle>
      <lr-toggle value="b">B</lr-toggle>
      <lr-toggle value="c">C</lr-toggle>
    </lr-toggle-group>`);
    group.value = ['b'];
    const toggles = [...group.querySelectorAll('lr-toggle')] as LyraToggle[];
    expect(toggles.every((toggle) => control(toggle) === null), 'nothing rendered before definition').to.equal(true);

    await import('../toggle/toggle.js');
    await customElements.whenDefined('lr-toggle');
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    await waitUntil(() => toggles.every((toggle) => control(toggle) !== null), 'the toggles never rendered');
    const stops = toggles.map((toggle) => control(toggle)!.getAttribute('tabindex'));
    expect(stops).to.deep.equal(['-1', '0', '-1']);
    expect(toggles.map((toggle) => toggle.pressed)).to.deep.equal([false, true, false]);
    expect([...group.value]).to.deep.equal(['b']);
    expect(toggles.every((toggle) => toggle.hasAttribute('data-lr-group-size'))).to.equal(true);
    await waitUntil(
      () => control(toggles[1]!)!.getAttribute('data-run') === 'middle',
      'runs were not projected after the late upgrade',
    );
    expect(toggles.map((toggle) => control(toggle)!.getAttribute('data-run'))).to.deep.equal([
      'start',
      'middle',
      'end',
    ]);
  });
});
