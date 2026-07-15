import { expect } from '@open-wc/testing';
import { clearIcalCache, loadIcal, loadIcalDeps } from './calendar-loader.js';

afterEach(() => clearIcalCache());

describe('calendar loader', () => {
  it('loads the real ical.js namespace', async () => {
    const module = await loadIcal();
    expect(module?.parse).to.exist;
    expect(module?.Component).to.exist;
    expect(module?.Event).to.exist;
  });

  it('caches the resolved module', async () => {
    const first = await loadIcal();
    const second = await loadIcal();
    expect(first).to.equal(second);
  });

  it('returns null and logs the real error when loading fails', async () => {
    const error = new Error('ical boom');
    const originalWarn = console.warn;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    try {
      expect(await loadIcalDeps(() => Promise.reject(error))).to.be.null;
      expect(calls.flat()).to.contain(error);
      expect(calls.flat().join(' ')).to.contain('pnpm add ical.js');
    } finally { console.warn = originalWarn; }
  });
});
