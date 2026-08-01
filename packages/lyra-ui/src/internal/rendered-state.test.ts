import { expect } from '@open-wc/testing';
import { hasRenderedLayoutBox, RenderedStateController } from './rendered-state.js';

function createRenderedHost(): { wrapper: HTMLDivElement; host: HTMLDivElement } {
  const wrapper = document.createElement('div');
  wrapper.dataset.renderedStateTest = '';
  const host = document.createElement('div');
  host.style.display = 'block';
  host.style.inlineSize = '10px';
  host.style.blockSize = '10px';
  wrapper.append(host);
  document.body.append(wrapper);
  return { wrapper, host };
}

async function waitForState(states: boolean[], expectedLength: number): Promise<void> {
  const started = performance.now();
  while (states.length < expectedLength) {
    if (performance.now() - started > 2000) {
      throw new Error(`Timed out waiting for ${expectedLength} rendered-state observations; received ${states}`);
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
}

afterEach(() => {
  document.querySelectorAll('[data-rendered-state-test]').forEach((element) => element.remove());
});

it('reports whether the host generates a layout box, including through a hidden ancestor', () => {
  const { wrapper, host } = createRenderedHost();
  expect(hasRenderedLayoutBox(host)).to.be.true;

  wrapper.style.display = 'none';
  expect(hasRenderedLayoutBox(host)).to.be.false;

  wrapper.style.display = '';
  host.style.display = 'none';
  expect(hasRenderedLayoutBox(host)).to.be.false;

  host.style.display = 'block';
  host.remove();
  expect(hasRenderedLayoutBox(host)).to.be.false;
});

it('reports initial, hidden, and restored rendered states exactly once per transition', async () => {
  const { wrapper, host } = createRenderedHost();
  const states: boolean[] = [];
  const controller = new RenderedStateController(host, (rendered) => states.push(rendered));
  controller.start();

  expect(states).to.deep.equal([true]);
  wrapper.style.display = 'none';
  await waitForState(states, 2);
  expect(states).to.deep.equal([true, false]);

  wrapper.style.display = '';
  await waitForState(states, 3);
  expect(states).to.deep.equal([true, false, true]);

  controller.stop();
});

it('tracks disconnect and reconnect without replacing the controller', async () => {
  const { wrapper, host } = createRenderedHost();
  const states: boolean[] = [];
  const controller = new RenderedStateController(host, (rendered) => states.push(rendered));
  controller.start();

  host.remove();
  await waitForState(states, 2);
  expect(states).to.deep.equal([true, false]);

  wrapper.append(host);
  await waitForState(states, 3);
  expect(states).to.deep.equal([true, false, true]);

  controller.stop();
});

it('falls back to animation-frame checks when observer constructors are unavailable', async () => {
  const resizeDescriptor = Object.getOwnPropertyDescriptor(window, 'ResizeObserver');
  const mutationDescriptor = Object.getOwnPropertyDescriptor(window, 'MutationObserver');
  Object.defineProperty(window, 'ResizeObserver', { configurable: true, writable: true, value: undefined });
  Object.defineProperty(window, 'MutationObserver', { configurable: true, writable: true, value: undefined });

  const { wrapper, host } = createRenderedHost();
  const states: boolean[] = [];
  const controller = new RenderedStateController(host, (rendered) => states.push(rendered));
  try {
    controller.start();
    expect(states).to.deep.equal([true]);

    wrapper.style.display = 'none';
    await waitForState(states, 2);
    wrapper.style.display = '';
    await waitForState(states, 3);

    expect(states).to.deep.equal([true, false, true]);
  } finally {
    controller.stop();
    if (resizeDescriptor) Object.defineProperty(window, 'ResizeObserver', resizeDescriptor);
    else delete (window as unknown as { ResizeObserver?: unknown }).ResizeObserver;
    if (mutationDescriptor) Object.defineProperty(window, 'MutationObserver', mutationDescriptor);
    else delete (window as unknown as { MutationObserver?: unknown }).MutationObserver;
  }
});

it('stops observing and can be restarted with a fresh current-state report', async () => {
  const { wrapper, host } = createRenderedHost();
  const states: boolean[] = [];
  const controller = new RenderedStateController(host, (rendered) => states.push(rendered));
  controller.start();
  controller.stop();

  wrapper.style.display = 'none';
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  expect(states).to.deep.equal([true]);

  controller.start();
  expect(states).to.deep.equal([true, false]);
  controller.stop();
});
