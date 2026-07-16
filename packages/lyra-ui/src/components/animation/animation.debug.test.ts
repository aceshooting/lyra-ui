import { aTimeout, fixture, html } from '@open-wc/testing';
import './animation.js';
import type { LyraAnimation } from './animation.class.js';

it('debug: counts lyra-start / createAnimation invocations on initial connect with play preset', async () => {
  let starts = 0;
  const el = document.createElement('lyra-animation') as LyraAnimation;
  el.setAttribute('name', 'spin');
  el.setAttribute('play', '');
  el.setAttribute('iterations', '1');
  const child = document.createElement('div');
  child.textContent = 'x';
  el.append(child);
  el.addEventListener('lyra-start', () => {
    starts++;
    console.log('LYRA-START FIRED, count=', starts);
  });
  const origAnimate = child.animate.bind(child);
  let animateCalls = 0;
  child.animate = ((...args: Parameters<typeof origAnimate>) => {
    animateCalls++;
    console.log('ANIMATE CALL #', animateCalls);
    return origAnimate(...args);
  }) as typeof child.animate;
  document.body.append(el);
  await aTimeout(50);
  console.log('FINAL starts=', starts, 'animateCalls=', animateCalls);
  el.remove();
});

it('debug: fixture-based, no play preset, then toggle after settle', async () => {
  const el = (await fixture(html`<lyra-animation name="spin" iterations="1"><div>x</div></lyra-animation>`)) as LyraAnimation;
  await el.updateComplete;
  await aTimeout(0);
  console.log('after settle, animation exists?', Boolean((el as unknown as { animation?: unknown }).animation));
});
