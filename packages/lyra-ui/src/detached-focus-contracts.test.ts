import { expect, fixture, html } from '@open-wc/testing';
import './all.js';
import { ROOT_BARREL_TAGS } from './internal/root-registration-allowlist.js';
import { focusByKeyboard } from '../test/wtr-focus.js';

// A framework ref can invoke a control before its first render. Native detached controls do
// not take focus or emit focus events; wrappers must preserve that contract before refs exist.
for (const tag of ROOT_BARREL_TAGS) {
  const Constructor = customElements.get(tag);
  if (!Constructor || (Constructor.prototype.focus === HTMLElement.prototype.focus &&
    Constructor.prototype.blur === HTMLElement.prototype.blur)) continue;

  it(`${tag} preserves document focus when its public focus methods run before connection`, async () => {
    const outside = await fixture<HTMLButtonElement>(html`<button>Keep focus</button>`);
    await focusByKeyboard(outside);
    const element = document.createElement(tag);
    const events: string[] = [];
    for (const name of ['focus', 'blur', 'focusin', 'focusout']) element.addEventListener(name, () => events.push(name));
    element.focus({ preventScroll: true });
    element.blur();
    expect(document.activeElement === outside).to.equal(true);
    expect(events).to.deep.equal([]);
    expect(element.isConnected).to.equal(false);
  });
}
