import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import './animation.js';
import { setReducedMotion } from '../../../../test/wtr-media.js';

for (const reduced of [false, true]) {
  it(`creates one initial playing animation and start lifecycle (reduced motion ${reduced})`, async () => {
    await setReducedMotion(reduced ? 'reduce' : 'no-preference');
    const parent = await fixture<HTMLDivElement>(html`<div></div>`);
    const el = document.createElement('lr-animation');
    el.name = 'fade-in';
    el.play = true;
    el.duration = 10000;
    el.iterations = 1;
    const target = document.createElement('div');
    target.textContent = 'Animated content';
    const animate = target.animate.bind(target);
    let created = 0;
    target.animate = (...args) => { created += 1; return animate(...args); };
    const events: string[] = [];
    el.addEventListener('lr-start', () => events.push('start'));
    el.addEventListener('lr-finish', () => events.push('finish'));
    el.append(target);
    try {
      parent.append(el);
      await el.updateComplete;
      await waitUntil(() => events.includes('start'), 'lr-start never fired');
      if (reduced) await waitUntil(() => events.includes('finish'));
      expect(created).to.equal(1);
      expect(events).to.deep.equal(reduced ? ['start', 'finish'] : ['start']);
      if (!reduced) expect(target.getAnimations().length).to.equal(1);
      else el.start();
      if (!reduced) el.duration = 20000;
      await el.updateComplete;
      const starts = (): number => events.filter((event) => event === 'start').length;
      await waitUntil(() => starts() === 2, 'second lr-start never fired');
      expect(starts()).to.equal(2);
      el.remove();
      el.play = true;
      parent.append(el);
      await el.updateComplete;
      await waitUntil(() => starts() === 3, 'third lr-start never fired');
      expect(starts()).to.equal(3);
    } finally {
      el.remove();
      await setReducedMotion('no-preference');
    }
  });
}
