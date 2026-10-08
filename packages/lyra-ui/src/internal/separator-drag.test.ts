import { expect } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  SeparatorDragController,
  separatorArrowDirection,
  separatorDelta,
} from './separator-drag.js';

const pointer = (type: string, init: PointerEventInit = {}): PointerEvent =>
  new PointerEvent(type, { pointerId: 1, bubbles: true, clientX: 0, clientY: 0, ...init });
const key = (name: string, init: KeyboardEventInit = {}): KeyboardEvent => new KeyboardEvent('keydown', { key: name, ...init });

function controllerFixture(): {
  controller: SeparatorDragController;
  moves: number[];
  ends: string[];
  handle: HTMLElement;
  host: ReactiveController[];
} {
  const hostControllers: ReactiveController[] = [];
  const host = { addController: (controller: ReactiveController) => hostControllers.push(controller) } as unknown as ReactiveControllerHost;
  const moves: number[] = [];
  const ends: string[] = [];
  const controller = new SeparatorDragController(host, (event) => moves.push(event.clientX), (event) => ends.push(event.type));
  const handle = document.body.appendChild(document.createElement('div'));
  return { controller, moves, ends, handle, host: hostControllers };
}

describe('separator drag helpers', () => {
  it('mirrors the inline delta under RTL only', () => {
    const event = pointer('pointermove', { clientX: 130, clientY: 40 });
    expect(separatorDelta(100, event, 'inline', false)).to.equal(30);
    expect(separatorDelta(100, event, 'inline', true)).to.equal(-30);
    expect(separatorDelta(10, event, 'block', true)).to.equal(30);
  });

  it('maps arrows to the logical direction and bails on modifiers', () => {
    expect(separatorArrowDirection(key('ArrowRight'), 'inline', false)).to.equal(1);
    expect(separatorArrowDirection(key('ArrowRight'), 'inline', true)).to.equal(-1);
    expect(separatorArrowDirection(key('ArrowUp'), 'block', true)).to.equal(-1);
    expect(separatorArrowDirection(key('ArrowLeft'), 'block', false)).to.equal(0);
    for (const init of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }]) {
      expect(separatorArrowDirection(key('ArrowRight', init), 'inline', false), JSON.stringify(init)).to.equal(0);
    }
  });
});

describe('SeparatorDragController', () => {
  it('routes moves and one end for a started pointer, then stops listening', () => {
    const { controller, moves, ends, handle } = controllerFixture();
    expect(controller.start(pointer('pointerdown'), handle)).to.equal(true);
    window.dispatchEvent(pointer('pointermove', { clientX: 5 }));
    window.dispatchEvent(pointer('pointermove', { clientX: 9, pointerId: 2 }));
    window.dispatchEvent(pointer('pointerup'));
    window.dispatchEvent(pointer('pointermove', { clientX: 7 }));
    window.dispatchEvent(pointer('pointerup'));
    handle.remove();
    expect(moves).to.deep.equal([5]);
    expect(ends).to.deep.equal(['pointerup']);
  });

  it('refuses a second start for the same pointer', () => {
    const { controller, handle } = controllerFixture();
    expect(controller.start(pointer('pointerdown'), handle)).to.equal(true);
    expect(controller.start(pointer('pointerdown'), handle)).to.equal(false);
    controller.cancelAll();
    handle.remove();
  });

  it('tears the window listeners down when the host disconnects', () => {
    const { controller, moves, ends, handle } = controllerFixture();
    controller.start(pointer('pointerdown'), handle);
    controller.hostDisconnected();
    window.dispatchEvent(pointer('pointermove', { clientX: 5 }));
    window.dispatchEvent(pointer('pointercancel'));
    handle.remove();
    expect(moves).to.deep.equal([]);
    expect(ends).to.deep.equal([]);
  });

  it('survives a pointer that cannot be captured', () => {
    const { controller, ends, handle } = controllerFixture();
    expect(controller.start(pointer('pointerdown', { pointerId: 987 }), handle)).to.equal(true);
    window.dispatchEvent(pointer('pointercancel', { pointerId: 987 }));
    handle.remove();
    expect(ends).to.deep.equal(['pointercancel']);
  });
});
