import { expect } from '@open-wc/testing';
import * as fc from 'fast-check';
import { propertyRuns } from '../../test/property-options.js';
import { safeActionLinkHref, safeFetchUrl, safeLinkHref, safeMediaSrc } from './safe-url.js';

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

const RESOURCE_SCHEMES = new Set(['http:', 'https:', 'blob:', 'data:']);
const NEVER_SAME_ORIGIN = new Set(['javascript:', 'vbscript:', 'file:', 'about:']);
const docScheme = fc.constantFrom('app', 'tauri', 'javascript', 'vbscript', 'file', 'about', 'http', 'https');
const docHost = fc.constantFrom('', 'host', 'localhost', 'host:8080');
const documentLocation = fc.tuple(docScheme, docHost, fc.boolean()).map(([name, host, opaque]) => ({
  protocol: `${name}:`,
  host,
  origin: opaque ? 'null' : `${name}://${host}`,
}));
const resourceCandidate = fc.oneof(
  candidate,
  fc.tuple(docScheme, fc.constantFrom('://', ':', ':///', '://user@'), docHost, fc.string())
    .map(([name, sep, host, rest]) => `${name}${sep}${host}/${rest}`),
);

it('widens resource sinks only to the exact same-origin, non-executable document scheme', () => {
  fc.assert(fc.property(resourceCandidate, documentLocation, (url, loc) => {
    const baseline = safeMediaSrc(url, URL, null);
    const result = safeMediaSrc(url, URL, loc);
    expect(safeFetchUrl(url, URL, loc), 'fetch matches media').to.equal(result);
    if (baseline !== null) expect(result, 'never narrower than the default').to.equal(baseline);
    if (result === null || result === baseline) return;
    const parsed = new URL(result);
    expect(RESOURCE_SCHEMES.has(parsed.protocol), 'only non-default schemes widen').to.equal(false);
    expect(NEVER_SAME_ORIGIN.has(parsed.protocol), parsed.protocol).to.equal(false);
    expect(parsed.protocol, 'scheme').to.equal(loc.protocol);
    expect(parsed.host, 'host').to.equal(loc.host);
    expect(parsed.host, 'authority').to.not.equal('');
    expect(loc.origin, 'document origin').to.equal(`${loc.protocol}//${loc.host}`);
  }), propertyRuns());
});
