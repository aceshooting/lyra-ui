import { expect, fixture, html } from '@open-wc/testing';
import { preserveFocusAcross, restoreComposedFocus } from './focus-repair.js';

describe('focus repair', () => {
  async function toolbar() {
    return fixture<HTMLElement>(html`
      <div tabindex="-1">
        <button id="a">A</button><button id="b">B</button>
      </div>
      <button id="outside">Out</button>`).then(host => ({
        host,
        a: host.querySelector<HTMLButtonElement>('#a')!,
        b: host.querySelector<HTMLButtonElement>('#b')!,
        outside: host.parentElement!.querySelector<HTMLButtonElement>('#outside')!,
      }));
  }

  it('never strands focus on body after disabling the focused control', async () => {
    const { host, a, b } = await toolbar();
    a.focus();
    preserveFocusAcross(host, () => { a.disabled = true; });
    expect(document.activeElement).to.equal(b);
  });

  it('prefers the supplied fallback and survives removal of the focused control', async () => {
    const { host, a, b } = await toolbar();
    a.focus();
    preserveFocusAcross(host, () => a.remove(), () => b);
    expect(document.activeElement).to.equal(b);
  });

  it('falls back to the host when nothing inside can take focus', async () => {
    const { host, a, b } = await toolbar();
    a.focus();
    preserveFocusAcross(host, () => { a.disabled = true; b.disabled = true; });
    expect(document.activeElement).to.equal(host);
  });

  it('leaves unrelated focus untouched', async () => {
    const { host, a, outside } = await toolbar();
    outside.focus();
    preserveFocusAcross(host, () => { a.disabled = true; });
    expect(document.activeElement).to.equal(outside);
  });

  it('restores after a later render when told focus was inside', async () => {
    const { host, a, b } = await toolbar();
    a.focus();
    a.remove();
    restoreComposedFocus(host, false);
    expect(document.activeElement).to.equal(document.body);
    restoreComposedFocus(host, true);
    expect(document.activeElement).to.equal(b);
  });
});
