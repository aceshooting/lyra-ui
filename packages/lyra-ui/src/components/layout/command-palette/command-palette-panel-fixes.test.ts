import { expect, fixture, html, nextFrame } from '@open-wc/testing';
import './command-palette.js';
import type { LyraCommandPalette } from './command-palette.js';

const commands = [{ commandId: 'save', label: 'Save' }, { commandId: 'open', label: 'Open' }];

async function opened(template = html`<lr-command-palette .commands=${commands}></lr-command-palette>`): Promise<LyraCommandPalette> {
  const el = await fixture<LyraCommandPalette>(template);
  el.openPalette();
  await el.updateComplete;
  return el;
}
const input = (el: LyraCommandPalette): HTMLInputElement => el.shadowRoot!.querySelector('input')!;
const press = (el: LyraCommandPalette, init: KeyboardEventInit): KeyboardEvent => {
  const event = new KeyboardEvent('keydown', { bubbles: true, composed: true, cancelable: true, ...init });
  input(el).dispatchEvent(event);
  return event;
};

describe('command palette search input', () => {
  it('exposes the combobox role with a name of its own', async () => {
    const el = await opened();
    const field = input(el);
    expect(field.getAttribute('role')).to.equal('combobox');
    expect(field.getAttribute('aria-expanded')).to.equal('true');
    expect(field.getAttribute('aria-autocomplete')).to.equal('list');
    expect(field.getAttribute('aria-label')).to.equal('Command palette');
  });

  it('treats a whitespace-only aria-label as absent', async () => {
    const el = await opened(html`<lr-command-palette aria-label="  " .commands=${commands}></lr-command-palette>`);
    expect(el.shadowRoot!.querySelector('[part="dialog"]')!.getAttribute('aria-label')).to.equal('Command palette');
    expect(input(el).getAttribute('aria-label')).to.equal('Command palette');
  });
});

describe('command palette keys', () => {
  it('does not select on a modified or repeated Enter, nor cancel it', async () => {
    const el = await opened();
    let selected = 0;
    el.addEventListener('lr-select', () => { selected += 1; });
    expect(press(el, { key: 'Enter', ctrlKey: true }).defaultPrevented).to.equal(false);
    expect(press(el, { key: 'ArrowDown', altKey: true }).defaultPrevented).to.equal(false);
    expect(press(el, { key: 'Enter', shiftKey: true }).defaultPrevented).to.equal(false);
    expect(press(el, { key: 'Enter', repeat: true }).defaultPrevented).to.equal(false);
    expect(selected).to.equal(0);
    press(el, { key: 'Enter' });
    expect(selected).to.equal(1);
  });

  it('does not run onSelect or close after a listener disabled the command', async () => {
    let ran = 0;
    const list = [{ commandId: 'save', label: 'Save', onSelect: () => { ran += 1; } }];
    const el = await opened(html`<lr-command-palette .commands=${list}></lr-command-palette>`);
    el.addEventListener('lr-select', () => { el.commands = [{ ...list[0]!, disabled: true }]; });
    el.shadowRoot!.querySelector<HTMLButtonElement>('[part="command"]')!.click();
    expect(ran).to.equal(0);
    expect(el.open).to.equal(true);
  });
});

it('leaves Home and End to the search caret until it reaches the requested boundary', async () => {
  const el = await opened(html`<lr-command-palette .commands=${[
    { commandId: 'one', label: 'Run one' }, { commandId: 'two', label: 'Run two' },
  ]}></lr-command-palette>`);
  const field = input(el);
  field.value = 'run';
  field.dispatchEvent(new Event('input', { bubbles: true }));
  await el.updateComplete;
  field.setSelectionRange(1, 1);
  for (const key of ['Home', 'End']) {
    expect(press(el, { key }).defaultPrevented).to.equal(false);
  }
  field.setSelectionRange(0, field.value.length);
  expect(press(el, { key: 'End' }).defaultPrevented).to.equal(false);
  field.setSelectionRange(field.value.length, field.value.length);
  expect(press(el, { key: 'End', shiftKey: true }).defaultPrevented).to.equal(false);
  expect(press(el, { key: 'End' }).defaultPrevented).to.equal(true);
  await el.updateComplete;
  expect(el.shadowRoot!.querySelector('[data-active="true"]')?.textContent).to.include('Run two');
});

it('leaves an Enter already handled by the search field alone', async () => {
  const el = await opened();
  input(el).addEventListener('keydown', event => event.preventDefault(), { once: true });
  press(el, { key: 'Enter' });
  expect(el.open).to.equal(true);
});

it('drops a command replaced by a different action with the same identity', async () => {
  let calls = 0;
  const list = [{ commandId: 'edit', label: 'Edit', onSelect: () => { calls++; } }];
  const el = await opened(html`<lr-command-palette .commands=${list}></lr-command-palette>`);
  el.addEventListener('lr-select', () => { el.commands = [{ commandId: 'edit', label: 'Replacement' }]; });
  press(el, { key: 'Enter' });
  expect(calls).to.equal(0);
  expect(el.open).to.equal(true);
});

it('keeps the keyboard selection when the pointer enters another option', async () => {
  const el = await opened();
  const [first, second] = el.shadowRoot!.querySelectorAll<HTMLElement>('[role="option"]');
  second!.dispatchEvent(new MouseEvent('mouseenter'));
  await el.updateComplete;
  expect(input(el).getAttribute('aria-activedescendant')).to.equal(first!.id);
  const selected: string[] = [];
  el.addEventListener('lr-select', event => selected.push(event.detail.command.commandId));
  press(el, { key: 'Enter' });
  expect(selected).to.deep.equal(['save']);
});

for (const transition of ['remove', 'close'] as const) {
  it(`abandons activation when the selection listener asks to ${transition} the palette`, async () => {
    let calls = 0;
    const el = await opened(html`<lr-command-palette .commands=${[
      { commandId: 'run', label: 'Run', onSelect: () => { calls++; } },
    ]}></lr-command-palette>`);
    el.addEventListener('lr-select', () => {
      if (transition === 'remove') el.remove();
      else el.close();
    });
    press(el, { key: 'Enter' });
    expect(calls).to.equal(0);
  });
}

it('coalesces row pitch measurements within a frame', async () => {
  const el = await opened();
  await nextFrame();
  const runtime = el as unknown as { scheduleRowPitchMeasurement(): void };
  const original = window.requestAnimationFrame;
  let scheduled = 0;
  window.requestAnimationFrame = callback => {
    scheduled++;
    return original.call(window, callback);
  };
  try {
    el.style.setProperty('--lr-command-palette-row-height', '62px');
    runtime.scheduleRowPitchMeasurement();
    runtime.scheduleRowPitchMeasurement();
    expect(scheduled).to.equal(1);
  } finally {
    window.requestAnimationFrame = original;
  }
  await nextFrame();
  await el.updateComplete;
  expect(el.shadowRoot!.querySelectorAll<HTMLElement>('[part="command"]')[1]!.style.transform).to.equal('translateY(62px)');
});

it('abandons a published replacement action even when the command object is reused', async () => {
  const calls: string[] = [];
  const command = { commandId: 'run', label: 'Run', onSelect: () => { calls.push('old'); } };
  const el = await opened(html`<lr-command-palette .commands=${[command]}></lr-command-palette>`);
  el.addEventListener('lr-select', () => {
    command.onSelect = () => { calls.push('new'); };
    el.commands = [command];
  }, { once: true });
  press(el, { key: 'Enter' });
  expect(calls).to.deep.equal([]);
  expect(el.open).to.equal(true);
  await el.updateComplete;
  press(el, { key: 'Enter' });
  expect(calls).to.deep.equal(['new']);
});
