import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import type { LyraDetails } from './details.class.js';
import './details.js';

it('ignores malformed fragment encoding and reveals a nested default-slot target', async () => {
  const originalUrl = window.location.href;
  try {
    window.history.replaceState(window.history.state, '', '#%E0%A4%A');
    const malformed = (await fixture(html`<lr-details summary="Malformed">No target</lr-details>`)) as LyraDetails;
    await malformed.updateComplete;
    await Promise.resolve();
    expect(malformed.open, 'an invalid encoded fragment does not open a disclosure').to.equal(false);

    const targetId = `nested-details-${Math.random().toString(36).slice(2)}`;
    window.history.replaceState(window.history.state, '', `#${targetId}`);
    const nested = (await fixture(html`<lr-details summary="Nested target">
      <div><section><span id=${targetId}>Target content</span></section></div>
    </lr-details>`)) as LyraDetails;
    await waitUntil(() => nested.open, 'a nested default-slot fragment target should reveal its disclosure');
    expect(nested.shadowRoot!.querySelector<HTMLElement>('[part="content"]')!.hidden).to.equal(false);
  } finally {
    window.history.replaceState(window.history.state, '', originalUrl);
  }
});

it('cancels a queued fragment reveal on disconnect and resumes it on reconnect', async () => {
  const originalUrl = window.location.href;
  const targetId = `reconnect-details-${Math.random().toString(36).slice(2)}`;
  const el = document.createElement('lr-details') as LyraDetails;
  try {
    window.history.replaceState(window.history.state, '', `#${targetId}`);
    el.setAttribute('summary', 'Reconnect target');
    const target = document.createElement('span');
    target.id = targetId;
    target.textContent = 'Target content';
    el.append(target);
    document.body.append(el);
    el.remove();
    await Promise.resolve();
    expect(el.open, 'disconnect invalidates the queued reveal').to.equal(false);

    document.body.append(el);
    await waitUntil(() => el.open, 'reconnection queues a fresh fragment reveal');
  } finally {
    el.remove();
    window.history.replaceState(window.history.state, '', originalUrl);
  }
});

it('synchronizes a native details close back through the public toggle lifecycle', async () => {
  const el = (await fixture(html`<lr-details summary="Native state">Panel content</lr-details>`)) as LyraDetails;
  el.open = true;
  await el.updateComplete;
  let toggles = 0;
  el.addEventListener('lr-toggle', (event) => {
    if (event.target === el) toggles += 1;
  });
  const native = el.shadowRoot!.querySelector<HTMLDetailsElement>('details.native-details')!;
  expect(native.open).to.equal(true);
  native.open = false;
  await waitUntil(() => !el.open, 'the native toggle safety net closes the public disclosure');
  await waitUntil(() => toggles === 1, 'the accepted native close emits one public toggle');
  expect(native.open).to.equal(false);
});
