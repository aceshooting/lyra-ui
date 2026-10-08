import { expect } from '@open-wc/testing';
import './agent-run/agent-run.js';
import './artifact-panel/artifact-panel.js';

type Updating = HTMLElement & { updateComplete: Promise<boolean>; render: () => unknown } & Record<string, unknown>;

/** Reads private state at the element's very first render, before any slotchange can correct it. */
async function firstRenderState(tag: string, slot: string, key: string): Promise<unknown> {
  const el = document.createElement(tag) as Updating;
  el.append(Object.assign(document.createElement('span'), { slot }));
  let seen: unknown;
  const render = el.render.bind(el);
  el.render = () => {
    seen ??= el[key];
    return render();
  };
  document.body.append(el);
  try {
    await el.updateComplete;
    return seen;
  } finally {
    el.remove();
  }
}

describe('first-render slot presence', () => {
  it('lr-agent-run knows its header slot on the first render', async () => {
    expect(await firstRenderState('lr-agent-run', 'header', 'hasHeaderSlot')).to.equal(true);
  });

  it('lr-artifact-panel knows its code slot on the first render', async () => {
    expect(await firstRenderState('lr-artifact-panel', 'code', 'hasCodeSlot')).to.equal(true);
  });
});
