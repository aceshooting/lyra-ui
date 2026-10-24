import { expect } from '@open-wc/testing';
import { detectPlatform } from './platform.js';

describe('detectPlatform', () => {
  it('prefers the client-hint platform over the legacy platform and the user agent', () => {
    expect(detectPlatform({ userAgentData: { platform: 'macOS' }, platform: 'Win32', userAgent: 'Linux' })).to.equal('mac');
    expect(detectPlatform({ userAgentData: { platform: 'Windows' }, platform: 'MacIntel' })).to.equal('windows');
  });

  it('falls through an empty hint to the legacy platform and then the user agent', () => {
    expect(detectPlatform({ userAgentData: { platform: '' }, platform: 'MacIntel' })).to.equal('mac');
    expect(detectPlatform({ platform: '', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' })).to.equal('windows');
    expect(detectPlatform({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' })).to.equal('mac');
  });

  it('recognizes Apple device families and Windows, and treats everything else as linux', () => {
    for (const platform of ['MacIntel', 'iPhone', 'iPad', 'iPod touch']) {
      expect(detectPlatform({ platform }), platform).to.equal('mac');
    }
    expect(detectPlatform({ platform: 'Win32' })).to.equal('windows');
    for (const platform of ['Linux x86_64', 'CrOS', 'Android', '']) {
      expect(detectPlatform({ platform }), platform).to.equal('linux');
    }
    expect(detectPlatform({})).to.equal('linux');
    expect(detectPlatform(null)).to.equal('linux');
  });

  it('reads the ambient navigator when no source is given', () => {
    expect(detectPlatform()).to.equal(detectPlatform(navigator));
    expect(['mac', 'windows', 'linux']).to.include(detectPlatform());
  });
  it('resolves to linux when the environment has no navigator', () => {
    const original = Object.getOwnPropertyDescriptor(window, 'navigator');
    Object.defineProperty(window, 'navigator', { configurable: true, get: () => undefined });
    try {
      expect(detectPlatform()).to.equal('linux');
    } finally {
      if (original) Object.defineProperty(window, 'navigator', original);
      else Reflect.deleteProperty(window, 'navigator');
    }
    expect(detectPlatform()).to.equal(detectPlatform(navigator));
  });
});
