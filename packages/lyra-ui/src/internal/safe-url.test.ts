import { expect } from '@open-wc/testing';
import {
  safeDocumentNavigationUrl,
  safeDownloadHref,
  safeFetchUrl,
  safeFrameSrc,
  safeLinkHref,
  safeMediaSrc,
  parseLinkSchemes,
  safeLinkHrefWithin,
  safeActionLinkHref,
  type SafeUrlDocumentLocation,
} from './safe-url.js';

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
      expect(safeDownloadHref(url), url).to.equal(url);
    }
  });

  it('allows data URLs for resource sinks but never for link navigation', () => {
    for (const url of ['data:text/plain,hello', 'data:image/svg+xml,<svg></svg>']) {
      expect(safeMediaSrc(url), url).to.equal(url);
      expect(safeFetchUrl(url), url).to.equal(url);
      expect(safeLinkHref(url), url).to.be.null;
      expect(safeDownloadHref(url), url).to.be.null;
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
      expect(safeDownloadHref(url), url).to.be.null;
    }
  });

  it('allows mailto: links for navigation but never as a resource, fetch source, or download', () => {
    // A `mailto:` opens the mail client rather than navigating an active document, so it is safe as
    // an `<a href>` target -- but it is not a fetchable/rendered resource, so the resource sinks
    // still reject it. `safeDownloadHref` sides with the resource sinks: a mail handoff names no
    // retrievable bytes, so it is not a valid target for an anchor carrying `download`.
    expect(safeLinkHref('mailto:hello@example.com')).to.equal('mailto:hello@example.com');
    expect(safeMediaSrc('mailto:hello@example.com')).to.be.null;
    expect(safeFetchUrl('mailto:hello@example.com')).to.be.null;
    expect(safeDownloadHref('mailto:hello@example.com')).to.be.null;
  });

  it('keeps the download allowlist a strict subset of the media-src allowlist', () => {
    // Media components rely on this invariant to skip a redundant re-check: a `src` that already
    // failed `safeMediaSrc` cannot pass `safeDownloadHref`, so an image/video whose scheme is
    // rejected always degrades to the inert, unclickable chip rather than a live anchor. Widening
    // either allowlist without re-checking this is what broke `lr-media-card` once already.
    for (const url of [
      'mailto:hello@example.com',
      'javascript:alert(1)',
      'vbscript:msgbox(1)',
      'tel:+352000000',
      'about:blank',
      'ftp://example.test/file',
      'file:///tmp/secret',
    ]) {
      if (safeMediaSrc(url) === null) expect(safeDownloadHref(url), url).to.be.null;
    }
    // `data:` is the one direction the subset permits to differ: a resource sink may render it,
    // but navigating or downloading it must not.
    expect(safeMediaSrc('data:text/plain,hello')).to.equal('data:text/plain,hello');
    expect(safeDownloadHref('data:text/plain,hello')).to.be.null;
  });

  it('uses browser URL normalization before checking the scheme', () => {
    for (const url of ['java\tscript:alert(1)', 'jav\nascript:alert(1)', ' \rJaVa\nScRiPt:alert(1)']) {
      expect(safeMediaSrc(url), url).to.be.null;
      expect(safeFetchUrl(url), url).to.be.null;
      expect(safeLinkHref(url), url).to.be.null;
      expect(safeDownloadHref(url), url).to.be.null;
    }
  });

  it('rejects empty and malformed absolute or scheme-relative URLs', () => {
    for (const url of ['', '   ', 'https://[::1', '//[::1']) {
      expect(safeMediaSrc(url), url).to.be.null;
      expect(safeFetchUrl(url), url).to.be.null;
      expect(safeLinkHref(url), url).to.be.null;
      expect(safeDownloadHref(url), url).to.be.null;
    }
  });

  it('fails closed for non-string runtime values', () => {
    for (const value of [null, undefined, 0, {}, []]) {
      expect(safeMediaSrc(value as string)).to.be.null;
      expect(safeFetchUrl(value as string)).to.be.null;
      expect(safeLinkHref(value as string)).to.be.null;
      expect(safeDownloadHref(value as string)).to.be.null;
    }
  });

  it('trims a safe value without resolving relative URLs against the parser base', () => {
    expect(safeLinkHref('  ../report.pdf  ')).to.equal('../report.pdf');
    expect(safeFetchUrl('  data:text/plain,hello  ')).to.equal('data:text/plain,hello');
  });

  it('allows only http(s) and relative URLs for a document-navigation sink, rejecting data/blob/mailto', () => {
    for (const url of ['http://example.test/app', 'HTTPS://example.test/app', '/relative/app', '?query=1']) {
      expect(safeDocumentNavigationUrl(url), url).to.equal(url);
      expect(safeFrameSrc(url), url).to.equal(url);
    }
    for (const url of [
      'data:text/html,<script>alert(1)</script>',
      'blob:https://example.test/id',
      'mailto:hello@example.com',
      'javascript:alert(1)',
      'file:///tmp/secret',
    ]) {
      expect(safeDocumentNavigationUrl(url), url).to.be.null;
      expect(safeFrameSrc(url), url).to.be.null;
    }
  });

  it('keeps safeFrameSrc and safeDocumentNavigationUrl behaviorally identical', () => {
    for (const url of [
      'https://example.test/app',
      'data:text/html,<p>hi</p>',
      'mailto:hello@example.com',
      '',
      '   ',
      null,
      undefined,
    ]) {
      expect(safeFrameSrc(url as string)).to.equal(safeDocumentNavigationUrl(url as string));
    }
  });

  it('fails closed for non-string runtime values on the document-navigation sink', () => {
    for (const value of [null, undefined, 0, {}, []]) {
      expect(safeDocumentNavigationUrl(value as string)).to.be.null;
      expect(safeFrameSrc(value as string)).to.be.null;
    }
  });
});

describe('narrowed navigation link schemes', () => {
  it('parses only known link schemes plus relative, case-insensitively', () => {
    expect(parseLinkSchemes(undefined)).to.equal(null);
    expect(parseLinkSchemes(null)).to.equal(null);
    expect([...parseLinkSchemes('HTTPS: mailto,relative')!].sort()).to.deep.equal(['https:', 'mailto:', 'relative']);
    expect([...parseLinkSchemes('data javascript vbscript ftp')!]).to.deep.equal([]);
    expect([...parseLinkSchemes('')!]).to.deep.equal([]);
  });

  it('keeps only the listed absolute schemes', () => {
    const httpsOnly = parseLinkSchemes('https')!;
    expect(safeLinkHrefWithin(' https://example.test/a ', httpsOnly)).to.equal('https://example.test/a');
    for (const url of ['http://example.test/a', 'mailto:someone@example.test', 'blob:https://example.test/id',
      '/relative', 'relative/path', '//cdn.example.test/a', '?q=1', '#frag', 'HTTP://example.test']) {
      expect(safeLinkHrefWithin(url, httpsOnly), url).to.equal(null);
    }
  });

  it('admits scheme-less URLs only with the relative token', () => {
    const allowed = parseLinkSchemes('https relative')!;
    for (const url of ['/relative', 'relative/path', '//cdn.example.test/a', '?q=1', '#frag']) {
      expect(safeLinkHrefWithin(url, allowed), url).to.equal(url);
    }
    expect(safeLinkHrefWithin('mailto:a@example.test', allowed)).to.equal(null);
  });

  it('never widens past the default link allowlist', () => {
    const everything = parseLinkSchemes('http https blob mailto relative data javascript')!;
    for (const url of ['javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<p>x</p>', 'vbscript:x', '', 42]) {
      expect(safeLinkHrefWithin(url, everything), String(url)).to.equal(null);
    }
    expect(safeLinkHrefWithin('https://example.test', new Set())).to.equal(null);
  });
});

describe('author-written action links', () => {
  it('adds tel: and sms: handoffs to the navigation allowlist', () => {
    expect(safeActionLinkHref('tel:+40700000100')).to.equal('tel:+40700000100');
    expect(safeActionLinkHref(' SMS:+40700000100?body=Hi ')).to.equal('SMS:+40700000100?body=Hi');
    for (const url of ['https://example.com', '/path', 'mailto:a@example.com', 'blob:https://example.com/id']) {
      expect(safeActionLinkHref(url), url).to.equal(url);
    }
  });

  it('keeps tel: and sms: out of every other sink, including the general navigation link', () => {
    for (const url of ['tel:+40700000100', 'sms:+40700000100']) {
      expect(safeLinkHref(url), url).to.be.null;
      expect(safeDownloadHref(url), url).to.be.null;
      expect(safeMediaSrc(url), url).to.be.null;
      expect(safeFetchUrl(url), url).to.be.null;
      expect(safeDocumentNavigationUrl(url), url).to.be.null;
    }
  });

  it('still rejects executable, document and obfuscated schemes and non-strings', () => {
    for (const url of ['javascript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd', 'facetime:+1', '']) {
      expect(safeActionLinkHref(url), url).to.be.null;
    }
    expect(safeActionLinkHref(42)).to.be.null;
    expect(safeActionLinkHref(null)).to.be.null;
  });
});

describe('same-origin custom-scheme resources', () => {
  const app: SafeUrlDocumentLocation = { protocol: 'app:', host: 'host', origin: 'app://host' };

  it('admits an absolute URL on the document\'s own custom-scheme origin for resource sinks only', () => {
    for (const url of ['app://host/assets/x.svg', ' APP://host/flags/fr.svg?v=1#a ']) {
      expect(safeMediaSrc(url, URL, app), url).to.equal(url.trim());
      expect(safeFetchUrl(url, URL, app), url).to.equal(url.trim());
      expect(safeLinkHref(url), url).to.be.null;
      expect(safeDownloadHref(url), url).to.be.null;
      expect(safeDocumentNavigationUrl(url), url).to.be.null;
    }
  });

  it('refuses a custom-scheme URL on any other origin or without an authority', () => {
    for (const url of ['app://other/x.svg', 'app://host:8080/x.svg', 'app://host.evil/x', 'other://host/x.svg',
      'app:host/x.svg', 'app:///x.svg', 'app://user@other/x']) {
      expect(safeMediaSrc(url, URL, app), url).to.be.null;
      expect(safeFetchUrl(url, URL, app), url).to.be.null;
    }
  });

  it('never admits script-executing, local-file or about: schemes, whatever the document location claims', () => {
    const cases: [SafeUrlDocumentLocation, string][] = [
      [{ protocol: 'javascript:', host: 'host', origin: 'javascript://host' }, 'javascript://host/%0aalert(1)'],
      [{ protocol: 'vbscript:', host: 'host', origin: 'vbscript://host' }, 'vbscript://host/%0amsgbox(1)'],
      [{ protocol: 'file:', host: '', origin: 'file://' }, 'file:///etc/passwd'],
      [{ protocol: 'file:', host: 'share', origin: 'file://share' }, 'file://share/secret'],
      [{ protocol: 'about:', host: '', origin: 'null' }, 'about:blank'],
    ];
    for (const [documentLocation, url] of cases) {
      expect(safeMediaSrc(url, URL, documentLocation), url).to.be.null;
      expect(safeFetchUrl(url, URL, documentLocation), url).to.be.null;
    }
    for (const url of ['javascript:alert(1)', 'java\tscript:alert(1)', 'vbscript:x', 'file:///etc/passwd', 'about:blank']) {
      expect(safeMediaSrc(url, URL, app), url).to.be.null;
    }
  });

  it('refuses when the document origin is opaque or does not match its own scheme and host', () => {
    for (const documentLocation of [
      { protocol: 'app:', host: 'host', origin: 'null' },
      { protocol: 'app:', host: 'host', origin: 'app://other' },
      { protocol: 'app:', host: '', origin: 'app://' },
      { protocol: 'app:', host: 'host', origin: 42 } as unknown as SafeUrlDocumentLocation,
    ]) {
      expect(safeMediaSrc('app://host/x.svg', URL, documentLocation)).to.be.null;
    }
  });

  it('keeps the default allowlist unchanged under a custom-scheme document and without a location', () => {
    for (const documentLocation of [app, null, undefined]) {
      for (const url of ['http://example.test/a', 'https://example.test/a', 'blob:https://example.test/id',
        'data:image/svg+xml,<svg></svg>', '/root/path', 'relative/path', '//cdn.example.test/a', '?q=1']) {
        expect(safeMediaSrc(url, URL, documentLocation), url).to.equal(url);
        expect(safeFetchUrl(url, URL, documentLocation), url).to.equal(url);
      }
      for (const url of ['mailto:a@example.test', 'tel:+1', 'ftp://example.test/f', '', 42]) {
        expect(safeMediaSrc(url, URL, documentLocation), String(url)).to.be.null;
      }
    }
    expect(safeMediaSrc('app://host/x.svg', URL, null)).to.be.null;
    expect(safeFetchUrl('app://host/x.svg', URL, undefined)).to.be.null;
  });

  it('reads the current document location by default', () => {
    expect(safeMediaSrc('app://host/x.svg')).to.be.null;
    expect(safeMediaSrc(`${location.origin}/x.svg`)).to.equal(`${location.origin}/x.svg`);
  });
});
