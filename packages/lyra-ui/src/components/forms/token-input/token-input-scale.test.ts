import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import { recordScaleMeasurement } from '../../../../test/scale-budgets.js';
import { captureDevWarnings } from '../../../../test/expected-dev-warnings.js';
import { sendKeys } from '@web/test-runner-commands';
import { sendMouse, resetMouse } from '../../../../test/wtr-mouse.js';
import { focusByKeyboard } from '../../../../test/wtr-focus.js';
import './token-input.js';
import type { LyraTokenInput } from './token-input.js';
const tokens = Array.from({ length: 1000 }, (_, index) => `Token ${index}`);
async function settle(el: LyraTokenInput) { await el.updateComplete; await nextFrame(); await el.updateComplete; }
it('keeps 1,000 tokens mounted for the implicit or non-finite default and warns once', async () => {
  const warnings = await captureDevWarnings(async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input .value=${tokens}></lr-token-input>`);
    const count = () => el.shadowRoot!.querySelectorAll('[part="token"]').length;
    expect(count()).to.equal(1000);
    el.setAttribute('max-tokens-visible', '200');
    await settle(el);
    expect(count()).to.equal(200);
    expect(el.shadowRoot!.querySelector('[part="token-overflow"]')?.textContent).to.contain('800');
    el.removeAttribute('max-tokens-visible');
    await settle(el);
    expect(count()).to.equal(1000);
    el.maxTokensVisible = Number.NaN;
    await settle(el);
    expect(el.maxTokensVisible).to.equal(0);
    expect(count()).to.equal(1000);
  });
  expect(warnings).to.have.length(1);
  expect(warnings[0]).to.contain('max-tokens-visible');
});

it('keeps explicit zero unlimited and warning-free for attributes and properties', async () => {
  const warnings = await captureDevWarnings(async () => {
    for (const el of [
      await fixture<LyraTokenInput>(html`<lr-token-input max-tokens-visible="0" .value=${tokens}></lr-token-input>`),
      await fixture<LyraTokenInput>(html`<lr-token-input .maxTokensVisible=${0} .value=${tokens}></lr-token-input>`),
    ]) expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).to.equal(1000);
  });
  expect(warnings).to.deep.equal([]);
});

it('warns after explicit unlimited changes to an omitted or non-finite limit', async () => {
  for (const fallback of ['removed', 'non-finite']) {
    const warnings = await captureDevWarnings(async () => {
      const el = await fixture<LyraTokenInput>(html`<lr-token-input max-tokens-visible="0" .value=${tokens}></lr-token-input>`);
      if (fallback === 'removed') el.removeAttribute('max-tokens-visible');
      else el.maxTokensVisible = Number.POSITIVE_INFINITY;
      await settle(el);
      expect(el.maxTokensVisible).to.equal(0);
      expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).to.equal(1000);
    });
    expect(warnings).to.have.length(1);
    expect(warnings[0]).to.contain('max-tokens-visible');
  }
});

it('pages to duplicate occurrences by pointer and keyboard, removes the last token and resets', async () => {
  const values = ['first', 'same', 'third', 'same', 'last'];
  const form = await fixture<HTMLFormElement>(html`<form>
    <lr-token-input max-tokens-visible="2" name="tokens" .defaultValue=${values}
      .strings=${{ next: 'Weiter', previous: 'Zurück' }}></lr-token-input></form>`);
  const el = form.querySelector('lr-token-input')!;
  const page = (name: string) => el.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${name}-page"]`)!;
  const visible = () => Array.from(el.shadowRoot!.querySelectorAll('[part="token"] > span'), node => node.textContent);
  expect(visible()).to.deep.equal(values.slice(0, 2));
  expect(page('next').textContent?.trim()).to.equal('Weiter');
  expect(page('previous').textContent?.trim()).to.equal('Zurück');
  page('previous').click();
  page('next').click();
  await settle(el);
  expect(visible()).to.deep.equal(values.slice(2, 4));
  await focusByKeyboard(page('next'));
  await sendKeys({ press: 'Enter' });
  await settle(el);
  expect(visible()).to.deep.equal(['same', 'last']);
  expect(el.shadowRoot!.activeElement === page('next')).to.equal(true);
  expect(new FormData(form).getAll('tokens')).to.deep.equal(values);
  page('next').click();
  Array.from(el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="remove"]')).at(-1)!.click();
  await settle(el);
  expect(new FormData(form).getAll('tokens')).to.deep.equal(values.slice(0, 4));
  page('previous').click();
  await settle(el);
  expect(visible()).to.deep.equal(values.slice(0, 2));
  page('next').click();
  await settle(el);
  form.reset();
  await settle(el);
  expect(visible()).to.deep.equal(values.slice(0, 2));
  expect(new FormData(form).getAll('tokens')).to.deep.equal(values);
});

it('keeps a vetoed edit on its page and applies an accepted edit before paging', async () => {
  const el = await fixture<LyraTokenInput>(html`<lr-token-input editable max-tokens-visible="2"
    .value=${['One', 'Two', 'Three', 'Four']}></lr-token-input>`);
  const next = () => el.shadowRoot!.querySelector<HTMLButtonElement>('[part="next-page"]')!;
  const label = () => el.shadowRoot!.querySelector<HTMLElement>('[part="token-label"]')!;
  label().click();
  await settle(el);
  const editor = el.shadowRoot!.querySelector<HTMLInputElement>('[part="token-editor"]')!;
  editor.value = 'Revised';
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  el.addEventListener('lr-token-edit-request', event => event.preventDefault(), { once: true });
  next().click();
  await settle(el);
  expect(editor.isConnected).to.equal(true);
  expect(editor.value).to.equal('Revised');
  expect(el.value[0]).to.equal('One');
  next().click();
  await settle(el);
  expect(el.value[0]).to.equal('Revised');
  expect(label().textContent).to.equal('Three');
});

it('honors an edit veto once per pointer click and keeps focus on the current editor or page action', async () => {
  const el = await fixture<LyraTokenInput>(html`<lr-token-input editable max-tokens-visible="1"
    .value=${['One', 'Two']}></lr-token-input>`);
  const button = (page: string) => el.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${page}-page"]`)!;
  const click = async (target: HTMLElement) => {
    const { x, y, width, height } = target.getBoundingClientRect();
    await sendMouse({ type: 'click', position: [Math.round(x + width / 2), Math.round(y + height / 2)] });
    await settle(el);
  };
  el.shadowRoot!.querySelector<HTMLElement>('[part="token-label"]')!.click();
  await settle(el);
  const editor = el.shadowRoot!.querySelector<HTMLInputElement>('[part="token-editor"]')!;
  editor.value = 'Revised';
  editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
  let requests = 0;
  el.addEventListener('lr-token-edit-request', event => {
    if (++requests === 1) event.preventDefault();
  });
  try {
    await click(button('previous'));
    expect(requests).to.equal(0);
    expect(el.shadowRoot!.activeElement === editor).to.equal(true);
    await click(button('next'));
    expect(requests).to.equal(1);
    expect(el.shadowRoot!.activeElement === editor).to.equal(true);
    expect(el.value[0]).to.equal('One');
    await click(button('next'));
    expect(requests).to.equal(2);
    expect(el.value[0]).to.equal('Revised');
    expect(el.shadowRoot!.querySelector('[part="token-label"]')?.textContent).to.equal('Two');
    expect(el.shadowRoot!.activeElement === button('next')).to.equal(true);
  } finally {
    await resetMouse();
  }
});

for (const duringEdit of ['disable', 'detach'] as const) {
  it(`stops paging when an edit request listener chooses to ${duringEdit} the field`, async () => {
    const el = await fixture<LyraTokenInput>(html`<lr-token-input editable max-tokens-visible="1"
      .value=${['First', 'Second']}></lr-token-input>`);
    el.shadowRoot!.querySelector<HTMLElement>('[part="token-label"]')!.click();
    await settle(el);
    const editor = el.shadowRoot!.querySelector<HTMLInputElement>('[part="token-editor"]')!;
    editor.value = 'Changed';
    editor.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));
    el.addEventListener('lr-token-edit-request', () => {
      if (duringEdit === 'disable') el.disabled = true;
      else el.remove();
    }, { once: true });
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="next-page"]')!.click();
    await settle(el);
    expect(el.value).to.deep.equal(['First', 'Second']);
    expect(el.shadowRoot!.querySelector('[part="token-label"]')?.textContent).to.equal('First');
  });
}

it('respects a limit or value changed before paging buttons rerender', async () => {
  const el = await fixture<LyraTokenInput>(html`<lr-token-input max-tokens-visible="1"
    .value=${['First', 'Second']}></lr-token-input>`);
  const next = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="next-page"]')!;
  expect(next.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))).to.equal(true);
  el.maxTokensVisible = 0;
  next.click();
  await settle(el);
  expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).to.equal(2);
  el.maxTokensVisible = 1;
  await settle(el);
  const stale = el.shadowRoot!.querySelector<HTMLButtonElement>('[part="next-page"]')!;
  el.value = ['First'];
  stale.click();
  await settle(el);
  expect(el.shadowRoot!.querySelector('[part="token"] > span')?.textContent).to.equal('First');
  expect(el.shadowRoot!.querySelectorAll('[part="next-page"]').length).to.equal(0);
});

it('allows read-only paging and ignores a click during live disabling', async () => {
  const values = ['One', 'Two'];
  const el = await fixture<LyraTokenInput>(html`<lr-token-input readonly max-tokens-visible="1"
    .value=${values}></lr-token-input>`);
  const page = (name: string) => el.shadowRoot!.querySelector<HTMLButtonElement>(`[part="${name}-page"]`)!;
  page('next').click();
  await settle(el);
  const visible = () => el.shadowRoot!.querySelector('[part="token"] > span')?.textContent;
  expect(visible()).to.equal('Two');
  el.disabled = true;
  page('previous').click();
  await settle(el);
  expect(page('previous').disabled).to.equal(true);
  expect(visible()).to.equal('Two');
  expect(el.value).to.deep.equal(values);
});

it('keeps a large literal-delimited add request atomic and preserves all accepted tokens', async () => {
  const el = await fixture<LyraTokenInput>(html`<lr-token-input max-tokens-visible="3" delimiter="||"></lr-token-input>`);
  const field = el.shadowRoot!.querySelector<HTMLInputElement>('[part="input"]')!;
  const values = Array.from({ length: 1000 }, (_, n) => `item${n}`);
  field.value = values.join(' || ') + '|| || item0';
  field.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertFromPaste' }));
  const commits: string[] = [];
  el.addEventListener('change', () => commits.push('change'));
  el.addEventListener('lr-token-add-request', event => {
    expect(event.detail.values).to.deep.equal(values);
    event.preventDefault();
  }, { once: true });
  const enter = () => field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  enter();
  expect(el.value.length).to.equal(0);
  expect(commits).to.deep.equal([]);
  enter();
  await settle(el);
  expect(commits).to.deep.equal(['change']);
  expect(el.value).to.deep.equal(values);
  expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).to.equal(3);
});
it('bounds token markup and preserves keyed survivors on removal', async () => {
  const el = await fixture<LyraTokenInput>(html`<lr-token-input label="Tokens" max-tokens-visible="10" .value=${tokens}></lr-token-input>`);
  await settle(el);
  expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).equal(10);
  expect(el.shadowRoot!.querySelector('[part="token-overflow"]')?.textContent).contain('990');
  const second = el.shadowRoot!.querySelectorAll('[part="token"]')[1]!;
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove"]')!.click(); await settle(el);
  expect(el.value[0]).equal('Token 1');
  expect(el.shadowRoot!.querySelector('[part="token"]') === second).equal(true);
  recordScaleMeasurement('lr-token-input', 'n=1000 capped remove', { mountedTokens: el.shadowRoot!.querySelectorAll('[part="token"]').length });
});
it('keeps keyboard destinations visible in an editable token window', async () => {
  const el = await fixture<LyraTokenInput>(html`<lr-token-input label="Tokens" editable max-tokens-visible="4" .value=${tokens}></lr-token-input>`);
  await settle(el);
  el.shadowRoot!.querySelector<HTMLElement>('[part="token-label"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, composed: true }));
  await settle(el);
  expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).equal(4);
  expect(el.shadowRoot!.activeElement?.textContent).equal('Token 999');
});
it('localizes overflow and retains the full value in a disabled capped control', async () => {
  const el = await fixture<LyraTokenInput>(html`<lr-token-input label="Tokens" disabled max-tokens-visible="2"
    .strings=${{ selectSelectedOverflow: '{n} hidden tokens' }} .value=${tokens}></lr-token-input>`);
  await settle(el);
  expect(el.shadowRoot!.querySelector('[part="token-overflow"]')?.textContent).contain('998 hidden tokens');
  el.shadowRoot!.querySelector<HTMLButtonElement>('[part="remove"]')?.click(); await settle(el);
  expect(el.value.length).equal(1000);
  expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).equal(2);
});

it('retains a focused remove action through a new token cap and repairs it after a controlled shrink', async () => {
  const values = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'];
  const form = await fixture<HTMLFormElement>(html`
    <form><lr-token-input label="Tokens" name="tokens" .value=${values}
      .strings=${{ selectSelectedOverflow: '{n} hidden tokens', removeWithContext: 'Remove {label}' }}></lr-token-input></form>
  `);
  const el = form.querySelector('lr-token-input')!;
  const events: string[] = [];
  for (const name of ['input', 'change', 'lr-input', 'lr-change']) el.addEventListener(name, () => events.push(name));
  const remove = el.shadowRoot!.querySelectorAll<HTMLButtonElement>('[part="remove"]')[4]!;
  await focusByKeyboard(remove);
  expect(el.shadowRoot!.activeElement === remove).equal(true);

  el.maxTokensVisible = 2;
  await settle(el);

  expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).equal(2);
  expect(el.shadowRoot!.activeElement === remove, 'the focused tail survives the new window').equal(true);
  expect(remove.isConnected).equal(true);
  expect(el.shadowRoot!.querySelector('[part="token-overflow"]')?.textContent).contain('3 hidden tokens');
  expect(new FormData(form).getAll('tokens')).deep.equal(values);

  el.value = values.slice(0, 3);
  await settle(el);

  expect(el.shadowRoot!.querySelectorAll('[part="token"]').length).equal(2);
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).equal('remove');
  expect(el.shadowRoot!.activeElement?.getAttribute('aria-label')).equal('Remove Charlie');
  expect(el.shadowRoot!.querySelector('[part="token-overflow"]')?.textContent).contain('1 hidden tokens');
  expect(new FormData(form).getAll('tokens')).deep.equal(['Alpha', 'Bravo', 'Charlie']);
  expect(events).deep.equal([]);
});
