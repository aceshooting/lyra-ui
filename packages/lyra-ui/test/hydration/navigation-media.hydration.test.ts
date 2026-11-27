import { html, ssrFixture, ssrStaticDocument } from '../wtr-ssr-fixture.js';
import { expect, waitUntil } from '@open-wc/testing';
import type { LyraTabGroup } from '../../src/components/lr-tab-group.js';
import type { LyraVideo } from '../../src/components/lr-video.js';

const clip = new URL('../../src/components/media/media-card/fixtures/sample.mp4', import.meta.url).href;
const videoRegistration = '/dist/components/lr-video.js';

it('hydrates the measured tab overflow menu from an unmeasured server strip', async () => {
  const template = html`<lr-tab-group overflow="menu" active="reports"
    style="inline-size: 230px; --lr-tab-group-tab-padding: 6px 12px; font: 16px monospace">
    <lr-tab panel="overview">Overview</lr-tab>
    <lr-tab panel="activity">Activity</lr-tab>
    <lr-tab panel="artifacts">Artifacts</lr-tab>
    <lr-tab panel="history">History</lr-tab>
    <lr-tab panel="settings">Settings</lr-tab>
    <lr-tab panel="reports">Reports</lr-tab>
    <lr-tab-panel name="overview">Overview panel</lr-tab-panel>
    <lr-tab-panel name="activity">Activity panel</lr-tab-panel>
    <lr-tab-panel name="artifacts">Artifacts panel</lr-tab-panel>
    <lr-tab-panel name="history">History panel</lr-tab-panel>
    <lr-tab-panel name="settings">Settings panel</lr-tab-panel>
    <lr-tab-panel name="reports">Reports panel</lr-tab-panel>
  </lr-tab-group>`;
  const server = await ssrStaticDocument(template);
  const serverGroup = server.querySelector('lr-tab-group')!;
  expect(serverGroup.getAttribute('active')).to.equal('reports');
  expect(serverGroup.shadowRoot!.querySelector<HTMLElement>('[part="overflow-trigger"]')?.hidden).to.equal(true);
  expect(serverGroup.shadowRoot!.querySelectorAll('[part="overflow-menu"]').length).to.equal(0);
  expect(serverGroup.querySelector('lr-tab-panel[name="reports"]')?.textContent).to.equal('Reports panel');

  const group = await ssrFixture<LyraTabGroup>(template);
  const more = () => group.shadowRoot!.querySelector<HTMLButtonElement>('[part="overflow-trigger"]:not([hidden])');
  await waitUntil(() => more()?.getAttribute('aria-selected') === 'true', 'hydrated strip measures the active overflow tab');
  expect(group.active).to.equal('reports');
  more()!.click();
  const menuItem = (name: string) => group.shadowRoot!.querySelector<HTMLButtonElement>(
    `[part="overflow-item"][data-slot="${name}"]`,
  );
  await waitUntil(() => menuItem('reports')?.getAttribute('aria-checked') === 'true');
  expect(menuItem('settings')?.textContent?.trim()).to.equal('Settings');
  menuItem('settings')!.click();
  await waitUntil(() => group.active === 'settings' && more()?.getAttribute('aria-expanded') === 'false');
  const panel = group.shadowRoot!.querySelector('[role="tabpanel"]:not([hidden])')!;
  expect(panel.querySelector('slot')?.name).to.equal('settings');
});

it('upgrades server-rendered video markup and plays a same-task source change at its natural contained ratio', async function () {
  this.timeout(15000);
  const template = html`<div style="inline-size: 480px; block-size: 240px">
    <lr-video fit="contain" aspect-ratio="auto" controls="none" muted preload="none" src=${clip}
      style="--aspect-ratio: 1"></lr-video>
  </div>`;
  const server = await ssrStaticDocument(template);
  const player = server.querySelector<LyraVideo>('lr-video')!;
  expect(player.shadowRoot === null).to.equal(true);
  expect(player.getAttribute('fit')).to.equal('contain');
  expect(player.getAttribute('aspect-ratio')).to.equal('auto');
  expect(player.getAttribute('src')).to.equal(clip);
  expect(player.style.getPropertyValue('--aspect-ratio')).to.equal('1');

  // lr-video is client-rendered. Adopt the actual server fallback into the live fixture using
  // the built registration, which upgrades it without needing declarative shadow markup.
  const stage = player.parentElement!;
  const container = server.defaultView!.frameElement!.parentElement!;
  await import(videoRegistration);
  container.append(stage);
  await player.updateComplete;
  const native = player.getVideoElement()!;
  expect(native.src).to.equal(clip);
  const initialFrame = native.getBoundingClientRect();
  expect(initialFrame.width).to.be.closeTo(240, 1);
  expect(initialFrame.height).to.be.closeTo(240, 1);
  expect(native.videoWidth).to.equal(0);
  const next = clip + '?hydrated-replacement';
  player.src = next;
  try {
    await player.play();
    await waitUntil(() => {
      const rect = native.getBoundingClientRect();
      return native.videoWidth > native.videoHeight && rect.width > rect.height;
    }, 'the replacement metadata sizes the hydrated player', { timeout: 10000 });
    const frame = native.getBoundingClientRect();
    const allocation = stage.getBoundingClientRect();
    const ratio = native.videoWidth / native.videoHeight;
    expect(native.currentSrc).to.equal(next);
    expect(native.paused).to.equal(false);
    expect(player.getVideoElement() === native).to.equal(true);
    expect(frame.width).to.be.closeTo(Math.min(allocation.width, allocation.height * ratio), 1);
    expect(frame.height).to.be.closeTo(frame.width / ratio, 1);
    expect(frame.left + frame.width / 2).to.be.closeTo(allocation.left + allocation.width / 2, 1);
  } finally {
    player.pause();
  }
});
