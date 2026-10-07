import { expect } from '@open-wc/testing';
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { AccessibleTextController } from './accessible-text-controller.js';

function controllerHost(onAdd: (controller: ReactiveController) => void): HTMLElement & ReactiveControllerHost {
  return Object.assign(document.createElement('div'), {
    addController: onAdd,
    removeController: (_controller: ReactiveController) => undefined,
    requestUpdate: () => undefined,
    updateComplete: Promise.resolve(true),
  });
}

it('tracks assigned label text and releases its observer across lifecycle changes', async () => {
  let lifecycle: ReactiveController | undefined;
  const host = controllerHost((controller) => { lifecycle = controller; });
  const root = host.attachShadow({ mode: 'open' });
  root.append(document.createElement('slot'));
  const label = document.createElement('span');
  label.textContent = 'First';
  host.append(label);
  document.body.append(host);
  let changes = 0;
  const controller = new AccessibleTextController(host, [''], () => { changes += 1; });
  try {
    lifecycle?.hostConnected?.();
    expect(controller.text()).to.equal('First');
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    changes = 0;
    label.textContent = 'Second';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(controller.text()).to.equal('Second');
    expect(changes).to.be.greaterThan(0);
    const beforeUpdate = changes;
    label.textContent = 'Third';
    lifecycle?.hostUpdated?.();
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(changes).to.be.greaterThan(beforeUpdate);
    const beforeDisconnect = changes;
    lifecycle?.hostDisconnected?.();
    label.textContent = 'Fourth';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(changes).to.equal(beforeDisconnect);
  } finally {
    lifecycle?.hostDisconnected?.();
    host.remove();
  }
});

it('ignores unrelated style writes on a forwarded label ancestor', async () => {
  const wrapper = document.createElement('div');
  const label = document.createElement('span');
  label.textContent = 'Forwarded';
  wrapper.append(label);
  let lifecycle: ReactiveController | undefined;
  const host = controllerHost((controller) => { lifecycle = controller; });
  host.append(document.createElement('slot'));
  wrapper.attachShadow({ mode: 'open' }).append(host);
  document.body.append(wrapper);
  let changes = 0;
  new AccessibleTextController(host, [], () => { changes += 1; });
  try {
    lifecycle?.hostConnected?.();
    label.textContent = 'Changed';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    const baseline = changes;
    wrapper.style.color = 'red';
    await new Promise<void>((resolve) => queueMicrotask(resolve));
    expect(changes).to.equal(baseline);
  } finally {
    lifecycle?.hostDisconnected?.();
    wrapper.remove();
  }
});
