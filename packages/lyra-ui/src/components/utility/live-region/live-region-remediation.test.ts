import { expect, fixture, waitUntil } from '@open-wc/testing';
import type { TemplateResult } from 'lit';
import { Basic } from './live-region.stories.js';
import { ANNOUNCEMENT_SINK_ATTRIBUTE } from '../../../internal/announcer.js';

for (const buttonIndex of [0, 1]) {
it(`lets Basic story button ${buttonIndex + 1} announce through the rendered region and visible log`, async () => {
  const root = await fixture<HTMLElement>((Basic.render as () => TemplateResult)());
  const buttons = root.querySelectorAll<HTMLButtonElement>('button');
  const log = root.querySelector<HTMLElement>('[data-log]')!;
  expect(buttons.length).to.equal(2);
  await waitUntil(() => root.querySelector('lr-live-region')!.hasAttribute('data-observed'));
  for (let index = 0; index < buttons.length; index++) {
    buttons[buttonIndex]!.click();
    await waitUntil(() => log.children.length === index + 1, 'the story action did not append its announcement');
    expect(log.firstElementChild?.textContent).to.include('3 new messages');
    const sink = document.querySelector(`[${ANNOUNCEMENT_SINK_ATTRIBUTE}="polite"]`)!;
    expect(sink.textContent).to.include('3 new messages');
  }
});
}
