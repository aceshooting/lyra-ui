import { expect, fixture, html, nextFrame, waitUntil } from '@open-wc/testing';
import './button.js';
import '../icon-button/icon-button.js';
import type { LyraButton } from './button.js';
import type { LyraIconButton } from '../icon-button/icon-button.js';
import { sendKeys } from '@web/test-runner-commands';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';

describe('lr-button semantic state forwarding', () => {
  it('forwards pressed and current state reactively without adding a second role owner', async () => {
    const action = await fixture<LyraButton>(html`<lr-button aria-pressed="true" aria-current="page">Monthly</lr-button>`);
    const control = (): HTMLElement => action.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!;
    expect(control().getAttribute('aria-pressed')).to.equal('true');
    expect(control().getAttribute('aria-current')).to.equal('page');
    expect(action.hasAttribute('role')).to.equal(false);
    expect(action.hasAttribute('tabindex')).to.equal(false);
    for (const value of ['false', 'mixed', 'true']) {
      action.ariaPressed = value;
      await action.updateComplete;
      expect(control().getAttribute('aria-pressed')).to.equal(value);
    }
    for (const value of ['step', 'location', 'date', 'time', 'true', 'false']) {
      action.setAttribute('aria-current', value);
      await action.updateComplete;
      expect(control().getAttribute('aria-current')).to.equal(value);
    }
    action.href = '#monthly';
    await action.updateComplete;
    expect(control().localName).to.equal('a');
    // `aria-pressed` deliberately stops at the anchor: only a button can be a toggle, so `link`
    // does not allow it and forwarding it fails axe's aria-allowed-attr. `aria-current` is global
    // and does forward.
    expect(control().hasAttribute('aria-pressed')).to.equal(false);
    expect(control().getAttribute('aria-current')).to.equal('false');
    action.removeAttribute('aria-pressed');
    action.removeAttribute('aria-current');
    await action.updateComplete;
    expect(control().hasAttribute('aria-pressed')).to.equal(false);
    expect(control().hasAttribute('aria-current')).to.equal(false);
    action.href = undefined;
    await action.updateComplete;
    expect(control().localName).to.equal('button');
    expect(control().hasAttribute('aria-pressed')).to.equal(false);
  });

  it('omits unsupported or empty state tokens and preserves the unset native action', async () => {
    const action = await fixture<LyraButton>(html`<lr-button>Save</lr-button>`);
    const control = action.shadowRoot!.querySelector('button')!;
    expect(control.hasAttribute('aria-pressed')).to.equal(false);
    expect(control.hasAttribute('aria-current')).to.equal(false);
    for (const value of ['', 'invalid', 'true false']) {
      action.setAttribute('aria-pressed', value);
      action.setAttribute('aria-current', value);
      await action.updateComplete;
      expect(control.hasAttribute('aria-pressed')).to.equal(false);
      expect(control.hasAttribute('aria-current')).to.equal(false);
    }
  });

  it('keeps the pressed owner focused through native keyboard activation and disabled changes', async () => {
    const action = await fixture<LyraButton>(html`<lr-button aria-pressed="false">Monthly</lr-button>`);
    let clicks = 0;
    action.addEventListener('click', () => {
      clicks++;
      action.ariaPressed = action.ariaPressed === 'true' ? 'false' : 'true';
    });
    const control = action.shadowRoot!.querySelector('button')!;
    action.focus();
    await sendKeys({ press: 'Enter' });
    await waitUntil(() => control.getAttribute('aria-pressed') === 'true');
    expect(clicks).to.equal(1);
    expect(action.shadowRoot!.activeElement?.localName).to.equal('button');
    await sendKeys({ press: 'Space' });
    await waitUntil(() => control.getAttribute('aria-pressed') === 'false');
    expect(clicks).to.equal(2);
    action.disabled = true;
    action.ariaPressed = 'mixed';
    await action.updateComplete;
    expect(control.disabled).to.equal(true);
    expect(control.getAttribute('aria-pressed')).to.equal('mixed');
    action.click();
    expect(clicks).to.equal(2);
  });

  it('exposes accessible toggle buttons and current links including disabled navigation', async () => {
    const wrapper = await fixture<HTMLDivElement>(html`<div>
      <lr-button aria-pressed="false">Monthly</lr-button>
      <lr-button href="#overview" aria-current="page">Overview</lr-button>
    </div>`);
    await expect(wrapper).to.be.accessible();
    const link = wrapper.querySelectorAll<LyraButton>('lr-button')[1]!;
    link.disabled = true;
    await link.updateComplete;
    const control = link.shadowRoot!.querySelector('a')!;
    expect(control.getAttribute('aria-current')).to.equal('page');
    expect(control.hasAttribute('href')).to.equal(false);
    expect(control.getAttribute('aria-disabled')).to.equal('true');
    link.removeAttribute('aria-current');
    await link.updateComplete;
    expect(control.hasAttribute('aria-current')).to.equal(false);
  });
});

for (const tag of ['lr-button', 'lr-icon-button'] as const) {
  describe(`${tag} external description identity`, () => {
    it('follows same-ID replacement and live source mutations while preserving other ARIA', async () => {
      const wrapper = await fixture<HTMLDivElement>(html`<div>
        <span id="action-description">External</span><span id="action-controls">Controlled</span>
        ${tag === 'lr-button'
          ? html`<lr-button aria-describedby="action-description missing action-description" aria-controls="action-controls" aria-label="Action">Action</lr-button>`
          : html`<lr-icon-button aria-describedby="action-description missing action-description" aria-controls="action-controls" aria-label="Action"></lr-icon-button>`}
      </div>`);
      const action = wrapper.querySelector<LyraButton | LyraIconButton>(tag)!;
      const source = wrapper.querySelector('span')!;
      const owner = (): HTMLElement => action.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!;
      const refs = (): readonly Element[] => owner().ariaDescribedByElements ?? [];
      await waitUntil(() => refs()[0] === source);
      expect(refs().length).to.equal(1);
      const replacement = document.createElement('span');
      replacement.id = source.id;
      replacement.textContent = 'Replacement';
      source.replaceWith(replacement);
      await waitUntil(() => refs()[0] === replacement);
      expect(refs()[0]?.textContent).to.equal('Replacement');
      expect(owner().getAttribute('aria-label')).to.equal('Action');
      expect(owner().ariaControlsElements?.[0] === wrapper.querySelector('#action-controls')).to.equal(true);
      replacement.remove();
      await waitUntil(() => refs().length === 0);
      wrapper.prepend(replacement);
      await waitUntil(() => refs()[0] === replacement);
      replacement.id = 'renamed-action-description';
      await waitUntil(() => refs().length === 0);
      action.setAttribute('aria-describedby', replacement.id);
      await waitUntil(() => refs()[0] === replacement);
      action.removeAttribute('aria-describedby');
      await waitUntil(() => refs().length === 0);
      action.remove();
      action.setAttribute('aria-describedby', replacement.id);
      wrapper.append(action);
      await waitUntil(() => refs()[0] === replacement);
      action.href = '#local-action';
      await action.updateComplete;
      expect(owner().localName).to.equal('a');
      await waitUntil(() => refs()[0] === replacement);
      action.href = undefined;
      await action.updateComplete;
      expect(owner().localName).to.equal('button');
      await waitUntil(() => refs()[0] === replacement);
    });

    it('resolves descriptions from its current host shadow root and adopted document', async () => {
      const wrapper = await fixture<HTMLDivElement>(html`<div><iframe></iframe></div>`);
      const scope = document.createElement('div');
      wrapper.append(scope);
      const root = scope.attachShadow({ mode: 'open' });
      root.innerHTML = `<span id="scoped-action-description">Scoped</span><${tag} aria-label="Action" aria-describedby="scoped-action-description"></${tag}>`;
      const action = root.querySelector<LyraButton | LyraIconButton>(tag)!;
      await action.updateComplete;
      const refs = (): readonly Element[] => action.shadowRoot!.querySelector<HTMLElement>('[part~="button"]')!.ariaDescribedByElements ?? [];
      await waitUntil(() => refs()[0] === root.querySelector('span'));
      const targetDocument = wrapper.querySelector('iframe')!.contentDocument!;
      const target = targetDocument.createElement('span');
      target.id = 'scoped-action-description';
      target.textContent = 'Adopted';
      targetDocument.body.append(target, action);
      await waitUntil(() => refs()[0] === target);
      expect(refs().length).to.equal(1);
    });
  });
}

it('keeps keyboard focus on the host while loading, then hands it back', async () => {
  const el = await fixture<LyraButton>(html`<lr-button>Save</lr-button>`);
  const base = el.shadowRoot!.querySelector<HTMLElement>('[part~="base"]')!;
  await focusByKeyboard(el);
  expect(el.shadowRoot!.activeElement === base, 'precondition: the button holds focus').to.equal(true);
  el.loading = true;
  await el.updateComplete;
  await nextFrame();
  await nextFrame();
  expect(document.activeElement === el, 'focus parks on the host').to.equal(true);
  el.loading = false;
  await el.updateComplete;
  expect(el.shadowRoot!.activeElement === base, 'focus returns to the button').to.equal(true);
  expect(el.hasAttribute('tabindex'), 'the temporary tabindex is removed').to.equal(false);
});

it('names itself from an external label without its hidden helper text', async () => {
  const wrapper = await fixture<HTMLElement>(html`<div><label for="hidden-helper-button">Save <span aria-hidden="true">Ctrl+S</span></label><lr-button id="hidden-helper-button">Go</lr-button></div>`);
  const el = wrapper.querySelector<LyraButton>('lr-button')!;
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[part~="base"]')!.getAttribute('aria-label')).to.equal('Save');
});

it('matches type case-insensitively, like a native button', async () => {
  const form = await fixture<HTMLFormElement>(html`<form><lr-button type="Submit">Go</lr-button></form>`);
  const el = form.querySelector<LyraButton>('lr-button')!;
  expect(el.type).to.equal('submit');
  let submitted = 0;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitted += 1;
  });
  el.click();
  expect(submitted).to.equal(1);
  (el as unknown as { type: string }).type = 'RESET';
  expect(el.type).to.equal('reset');
});

describe('lr-button as the default submit button for native fields', () => {
  const enterIn = async (markup: string, target = 'input'): Promise<FormData[]> => {
    const form = await fixture<HTMLFormElement>(markup);
    const submissions: FormData[] = [];
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      submissions.push(new FormData(form, (event as SubmitEvent).submitter));
    });
    form.querySelector<HTMLElement>(target)!.focus();
    await sendKeys({ press: 'Enter' });
    return submissions;
  };

  it('submits nothing past a disabled lr-button', async () => {
    const submissions = await enterIn('<form><input name="q" value="x"><lr-button type="submit" disabled>Go</lr-button></form>');
    expect(submissions).to.have.length(0);
  });

  it('submits with the lr-button name and value', async () => {
    const submissions = await enterIn('<form><input name="q" value="x"><lr-button type="submit" name="op" value="search">Go</lr-button></form>');
    expect(submissions).to.have.length(1);
    expect(submissions[0]!.get('op')).to.equal('search');
  });

  it('submits from one of several native fields', async () => {
    const submissions = await enterIn('<form><input name="a"><input name="b"><lr-button type="submit">Go</lr-button></form>');
    expect(submissions).to.have.length(1);
  });

  it('leaves Enter in a native checkbox alone', async () => {
    const submissions = await enterIn('<form><input type="checkbox" name="c"><lr-button type="submit">Go</lr-button></form>');
    expect(submissions).to.have.length(0);
  });
});
