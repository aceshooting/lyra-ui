import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { safeActionLinkHref, safeLinkHref } from './safe-url.js';

const ACTION_SCHEMES = new Set(['http:', 'https:', 'blob:', 'mailto:', 'tel:', 'sms:']);
const scheme = fc.constantFrom('http', 'https', 'blob', 'mailto', 'tel', 'sms', 'javascript', 'data', 'vbscript', 'file', 'ftp', 'TEL', 'Sms');
const candidate = fc.oneof(fc.string(), fc.tuple(scheme, fc.string()).map(([name, rest]) => `${name}:${rest}`));

it('admits only action-link schemes or scheme-less URLs, and never less than safeLinkHref', () => {
  fc.assert(fc.property(candidate, (url) => {
    const action = safeActionLinkHref(url);
    if (safeLinkHref(url) !== null) expect(action, 'superset of safeLinkHref').to.equal(safeLinkHref(url));
    if (action === null) return;
    expect(action, 'trimmed').to.equal(url.trim());
    let protocol: string | null = null;
    try { protocol = new URL(action).protocol; } catch { protocol = null; }
    if (protocol !== null) expect(ACTION_SCHEMES.has(protocol), protocol).to.equal(true);
  }), propertyRuns());
});
