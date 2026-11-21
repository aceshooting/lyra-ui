import { expect, fixture, html } from '@open-wc/testing';
import { RovingTreeFocus } from './roving-tree-focus.js';

function press(target: Element, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('RovingTreeFocus edges', () => {
  let host: HTMLDivElement;
  let tree: HTMLElement | null;
  let dir: 'ltr' | 'rtl';
  let roving: RovingTreeFocus;
  const control = (id: string) => host.querySelector<HTMLElement>('#' + id)!;

  beforeEach(async () => {
    host = await fixture<HTMLDivElement>(html`
      <div>
        <div id="tree">
          <div class="row"><button id="a1" part="x">a1</button><button id="a2" part="y">a2</button></div>
          <div class="row"><button id="b1" part="x" disabled>b1</button><button id="b2" part="y">b2</button></div>
          <div class="row"><button id="c1" part="x">c1</button></div>
        </div>
        <button id="outside">outside</button>
      </div>`);
    tree = host.querySelector<HTMLElement>('#tree');
    dir = 'ltr';
    roving = new RovingTreeFocus({ tree: () => tree, row: '.row', control: 'button', direction: () => dir });
    host.addEventListener('keydown', roving.onKeyDown);
    roving.sync();
  });

  it('keeps one tab stop, moves it on focus and clears it with no tree', () => {
    expect(control('a1').tabIndex).to.equal(0);
    expect(control('a2').tabIndex).to.equal(-1);
    roving.onFocusIn({ target: control('c1') } as unknown as FocusEvent);
    expect(control('c1').tabIndex).to.equal(0);
    expect(control('a1').tabIndex).to.equal(-1);
    roving.onFocusIn({ target: control('outside') } as unknown as FocusEvent);
    roving.onFocusIn({ target: null } as unknown as FocusEvent);
    expect(control('c1').tabIndex).to.equal(0);
    (control('c1') as HTMLButtonElement).disabled = true;
    roving.sync();
    expect(control('a1').tabIndex).to.equal(0);
    tree = null;
    roving.sync();
    roving.onFocusIn({ target: control('a1') } as unknown as FocusEvent);
    expect(press(control('a1'), 'ArrowDown').defaultPrevented).to.equal(false);
  });

  it('moves between rows preferring the same part, and clamps at the ends', () => {
    control('a2').focus();
    expect(press(control('a2'), 'ArrowDown').defaultPrevented).to.equal(true);
    expect(host.ownerDocument.activeElement).to.equal(control('b2'));
    press(control('b2'), 'ArrowDown');
    expect(host.ownerDocument.activeElement).to.equal(control('c1'));
    expect(press(control('c1'), 'ArrowDown').defaultPrevented).to.equal(true);
    expect(host.ownerDocument.activeElement).to.equal(control('c1'));
    press(control('c1'), 'ArrowUp');
    expect(host.ownerDocument.activeElement).to.equal(control('b2'));
    press(control('b2'), 'Home');
    expect(host.ownerDocument.activeElement).to.equal(control('a1'));
    press(control('a1'), 'End');
    expect(host.ownerDocument.activeElement).to.equal(control('c1'));
  });

  it('moves within a row, mirrored under RTL, and stops at the row edge', () => {
    control('a1').focus();
    press(control('a1'), 'ArrowRight');
    expect(host.ownerDocument.activeElement).to.equal(control('a2'));
    expect(press(control('a2'), 'ArrowRight').defaultPrevented).to.equal(false);
    dir = 'rtl';
    press(control('a2'), 'ArrowRight');
    expect(host.ownerDocument.activeElement).to.equal(control('a1'));
  });

  it('ignores handled events, outside targets and unavailable controls', () => {
    control('a1').focus();
    const handled = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
    handled.preventDefault();
    control('a1').dispatchEvent(handled);
    expect(host.ownerDocument.activeElement).to.equal(control('a1'));
    expect(press(control('outside'), 'ArrowDown').defaultPrevented).to.equal(false);
    expect(press(control('b1'), 'ArrowDown').defaultPrevented).to.equal(false);
    expect(press(control('a1'), 'ArrowDown', { ctrlKey: true }).defaultPrevented).to.equal(false);
    expect(press(control('a1'), 'x').defaultPrevented).to.equal(false);
  });
});
