import { expect } from '@open-wc/testing';
import { safeFetchUrl, safeLinkHref, safeMediaSrc } from './safe-url.js';

describe('sink-specific safe URL helpers', () => {
  it('allows web, blob, relative, and scheme-relative resource URLs', () => {
    for (const url of [
      'http://example.test/a',
      'HTTPS://example.test/a',
      'blob:https://example.test/id',
      '/root/path',
      'relative/path',
      '//cdn.example.test/a',
      '?query=1',
      '#fragment',
    ]) {
      expect(safeMediaSrc(url), url).to.equal(url);
      expect(safeFetchUrl(url), url).to.equal(url);
      expect(safeLinkHref(url), url).to.equal(url);
    }
  });

  it('allows data URLs for resource sinks but never for link navigation', () => {
    for (const url of ['data:text/plain,hello', 'data:image/svg+xml,<svg></svg>']) {
      expect(safeMediaSrc(url), url).to.equal(url);
      expect(safeFetchUrl(url), url).to.equal(url);
      expect(safeLinkHref(url), url).to.be.null;
    }
  });

  it('rejects executable, navigation-only, local, and unsupported schemes', () => {
    for (const url of [
      'javascript:alert(1)',
      'vbscript:msgbox(1)',
      'file:///tmp/secret',
      'ftp://example.test/file',
      'about:blank',
      'tel:+352000000',
    ]) {
      expect(safeMediaSrc(url), url).to.be.null;
      expect(safeFetchUrl(url), url).to.be.null;
      expect(safeLinkHref(url), url).to.be.null;
    }
  });

  it('allows mailto: links for navigation but never as a resource or fetch source', () => {
    // A `mailto:` opens the mail client rather than navigating an active document, so it is safe as
    // an `<a href>` target -- but it is not a fetchable/rendered resource, so the resource sinks
    // still reject it.
    expect(safeLinkHref('mailto:hello@example.com')).to.equal('mailto:hello@example.com');
    expect(safeMediaSrc('mailto:hello@example.com')).to.be.null;
    expect(safeFetchUrl('mailto:hello@example.com')).to.be.null;
  });

  it('uses browser URL normalization before checking the scheme', () => {
    for (const url of ['java\tscript:alert(1)', 'jav\nascript:alert(1)', ' \rJaVa\nScRiPt:alert(1)']) {
      expect(safeMediaSrc(url), url).to.be.null;
      expect(safeFetchUrl(url), url).to.be.null;
      expect(safeLinkHref(url), url).to.be.null;
    }
  });

  it('rejects empty and malformed absolute or scheme-relative URLs', () => {
    for (const url of ['', '   ', 'https://[::1', '//[::1']) {
      expect(safeMediaSrc(url), url).to.be.null;
      expect(safeFetchUrl(url), url).to.be.null;
      expect(safeLinkHref(url), url).to.be.null;
    }
  });

  it('fails closed for non-string runtime values', () => {
    for (const value of [null, undefined, 0, {}, []]) {
      expect(safeMediaSrc(value as string)).to.be.null;
      expect(safeFetchUrl(value as string)).to.be.null;
      expect(safeLinkHref(value as string)).to.be.null;
    }
  });

  it('trims a safe value without resolving relative URLs against the parser base', () => {
    expect(safeLinkHref('  ../report.pdf  ')).to.equal('../report.pdf');
    expect(safeFetchUrl('  data:text/plain,hello  ')).to.equal('data:text/plain,hello');
  });
});
