import { expect, fixture } from '@open-wc/testing';
import { compactContainerQuery, mediumContainerQuery, wideContainerQuery } from './container-breakpoints.styles.js';

it('measures container breakpoints against the root font size, not fixed pixels', async () => {
  const host = await fixture<HTMLElement>(`<div style="container-type: inline-size; inline-size: 500px"><i></i></div>`);
  const style = document.createElement('style');
  style.textContent = [
    ['compact', compactContainerQuery],
    ['medium', mediumContainerQuery],
    ['wide', wideContainerQuery],
  ].map(([name, query]) => `@container ${String(query)} { i { --probe-${name}: 1; } }`).join('\n');
  document.head.append(style);
  const root = document.documentElement;
  const original = root.style.fontSize;
  const probes = (): string[] => {
    const computed = getComputedStyle(host.querySelector('i')!);
    return ['compact', 'medium', 'wide'].map((name) => computed.getPropertyValue(`--probe-${name}`).trim());
  };
  try {
    root.style.fontSize = '16px';
    expect(probes()).to.deep.equal(['', '', '1']);
    root.style.fontSize = '32px';
    expect(probes()).to.deep.equal(['1', '1', '1']);
  } finally {
    root.style.fontSize = original;
    style.remove();
  }
});
