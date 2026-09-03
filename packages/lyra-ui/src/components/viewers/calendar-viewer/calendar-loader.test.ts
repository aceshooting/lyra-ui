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

  it('accepts a callable namespace carrying the complete parser capability', async () => {
    const callable = Object.assign(() => undefined, {
      parse: () => ({}),
      Component: class {},
      Event: class {},
    });

    expect(await loadIcalDeps(() => Promise.resolve(callable))).to.equal(callable);
  });

  it('returns null with one fixed dev diagnostic that never includes importer failures', async () => {
    const error = new Error('ical boom; calendar-secret');
    const originalWarn = console.warn;
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    runtime.litIssuedWarnings = new Set();
    try {
      expect(await loadIcalDeps(() => Promise.reject(error))).to.be.null;
      expect(await loadIcalDeps(() => Promise.reject(new Error('second failure')))).to.be.null;
      expect(calls).to.have.length(1);
      const message = calls.flat().map(String).join(' ');
      expect(message).to.equal('<lr-calendar-viewer> could not load its optional ical.js peer.');
      expect(message).to.not.contain(error.message);
      expect(message).to.not.contain('second failure');
    } finally {
      console.warn = originalWarn;
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
    }
  });

  it('stays silent when Lit development diagnostics are unavailable', async () => {
    const originalWarn = console.warn;
    const runtime = globalThis as typeof globalThis & { litIssuedWarnings?: Set<string> };
    const originalIssuedWarnings = runtime.litIssuedWarnings;
    const calls: unknown[][] = [];
    console.warn = (...args: unknown[]) => calls.push(args);
    delete runtime.litIssuedWarnings;
    try {
      expect(await loadIcalDeps(() => Promise.reject(new Error('production secret')))).to.be.null;
      expect(calls).to.have.length(0);
    } finally {
      console.warn = originalWarn;
      if (originalIssuedWarnings === undefined) delete runtime.litIssuedWarnings;
      else runtime.litIssuedWarnings = originalIssuedWarnings;
    }
  });
});
