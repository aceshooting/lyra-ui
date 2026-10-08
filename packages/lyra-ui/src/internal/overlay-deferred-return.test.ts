import { expect, waitUntil } from '@open-wc/testing';
import { activateOverlay } from './overlay-manager.js';

function createHost() {
  const host = document.createElement('section') as HTMLElement & { updateComplete: Promise<unknown> };
  host.updateComplete = Promise.resolve();
  const panel = document.createElement('div');
  panel.tabIndex = -1;
  const inside = document.createElement('button');
  panel.append(inside);
  host.append(panel);
  const trigger = document.createElement('button');
  document.body.append(trigger, host);
  return { host, panel, inside, trigger };
}

describe('overlay deferredReturn', () => {
  it('returns focus to a trigger the host only re-shows after the close', async () => {
    const { host, panel, inside, trigger } = createHost();
    let open = true;
    trigger.hidden = true;
    const handle = activateOverlay({
      host,
      panel: () => panel,
      onEscape: () => undefined,
      restoreFocusTo: trigger,
      deferredReturn: () => ({ candidates: () => [trigger], isCurrent: () => !open }),
    });
    inside.focus();
    open = false;
    handle.deactivate();
    expect(document.activeElement === trigger).to.equal(false);
    trigger.hidden = false;
    await waitUntil(() => document.activeElement === trigger, 'focus returns to the re-shown trigger');
    host.remove();
    trigger.remove();
  });

  it('skips the pass when the close does not restore focus or the factory declines', async () => {
    const { host, panel, inside, trigger } = createHost();
    let calls = 0;
    const handle = activateOverlay({
      host,
      panel: () => panel,
      onEscape: () => undefined,
      restoreFocusTo: trigger,
      deferredReturn: () => {
        calls++;
        return undefined;
      },
    });
    inside.focus();
    handle.deactivate({ restoreFocus: false });
    expect(calls).to.equal(0);
    const again = activateOverlay({
      host,
      panel: () => panel,
      onEscape: () => undefined,
      deferredReturn: () => {
        calls++;
        return undefined;
      },
    });
    again.deactivate();
    expect(calls).to.equal(1);
    host.remove();
    trigger.remove();
  });

  it('abandons a pending pass when the overlay is activated again', async () => {
    const { host, panel, inside, trigger } = createHost();
    trigger.hidden = true;
    const options = {
      host,
      panel: () => panel,
      onEscape: () => undefined,
      restoreFocusTo: trigger,
      deferredReturn: () => ({ candidates: () => [trigger] }),
    };
    activateOverlay(options);
    inside.focus();
    const first = activateOverlay(options);
    first.deactivate();
    const { deferredReturn: _omitted, ...plain } = options;
    const second = activateOverlay(plain);
    trigger.hidden = false;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    expect(document.activeElement === trigger).to.equal(false);
    second.deactivate({ restoreFocus: false });
    host.remove();
    trigger.remove();
  });
});
