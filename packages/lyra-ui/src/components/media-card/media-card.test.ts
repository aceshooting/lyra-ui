import { fixture, expect, html, oneEvent } from '@open-wc/testing';
import './media-card.js';
import type { LyraMediaCard } from './media-card.js';
import { safeMediaSrc, safeLinkHref } from './media-card.js';

const DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('safeMediaSrc / safeLinkHref', () => {
  it('allows http:/https:/blob: for both', () => {
    for (const url of ['http://example.test/a.png', 'https://example.test/a.png', 'blob:https://example.test/uuid']) {
      expect(safeMediaSrc(url)).to.equal(url);
      expect(safeLinkHref(url)).to.equal(url);
    }
  });

  it('allows data: as a media src but rejects it as a link href', () => {
    expect(safeMediaSrc(DATA_URI)).to.equal(DATA_URI);
    expect(safeLinkHref(DATA_URI)).to.be.null;
  });

  it('rejects javascript:/vbscript:/mailto:/tel: for both', () => {
    for (const url of ['javascript:alert(1)', 'vbscript:msgbox(1)', 'mailto:a@b.test', 'tel:+15551234567']) {
      expect(safeMediaSrc(url), url).to.be.null;
      expect(safeLinkHref(url), url).to.be.null;
    }
  });

  it('is case-insensitive on the scheme', () => {
    expect(safeMediaSrc('JavaScript:alert(1)')).to.be.null;
    expect(safeMediaSrc('HTTPS://example.test/a.png')).to.equal('HTTPS://example.test/a.png');
  });

  it('allows relative and scheme-relative URLs (no scheme at all)', () => {
    for (const url of ['/foo/bar.png', 'foo/bar.png', '//example.test/foo.png', '?x=1', '#frag']) {
      expect(safeMediaSrc(url), url).to.equal(url);
      expect(safeLinkHref(url), url).to.equal(url);
    }
  });

  it('treats an empty or whitespace-only string as absent (null), not "safe relative"', () => {
    expect(safeMediaSrc('')).to.be.null;
    expect(safeMediaSrc('   ')).to.be.null;
    expect(safeLinkHref('')).to.be.null;
  });

  it('trims surrounding whitespace from an otherwise-safe URL', () => {
    expect(safeMediaSrc('  https://example.test/a.png  ')).to.equal('https://example.test/a.png');
  });

  it('is not fooled by an embedded tab used to defeat a naive scheme regex', () => {
    // "java\tscript:alert(1)" fails a naive /^[a-z]+:/ match (so a
    // hand-rolled regex would wrongly call this "relative, therefore safe")
    // while a browser attribute sink still normalizes it down to a working
    // javascript: URL -- this is exactly the class of bypass `new URL()`
    // based checking closes, since the platform parser applies the same
    // tab-stripping normalization the browser itself uses.
    expect(safeMediaSrc('java\tscript:alert(1)')).to.be.null;
    expect(safeLinkHref('java\tscript:alert(1)')).to.be.null;
  });
});

describe('defaults', () => {
  it('starts with every prop empty/unset', async () => {
    const el = (await fixture(html`<lyra-media-card></lyra-media-card>`)) as LyraMediaCard;
    expect(el.src).to.equal('');
    expect(el.kind).to.be.undefined;
    expect(el.mimeType).to.equal('');
    expect(el.filename).to.equal('');
    expect(el.alt).to.equal('');
    expect(el.accessibleLabel).to.equal('');
  });

  it('renders the inert file-chip fallback with "Untitled file" when nothing is set', async () => {
    const el = (await fixture(html`<lyra-media-card></lyra-media-card>`)) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.tagName).to.equal('SPAN');
    expect(el.shadowRoot!.querySelector('[part="filename"]')!.textContent).to.equal('Untitled file');
  });

  it('fails closed when the src attribute is removed at runtime', async () => {
    const el = (await fixture(html`
      <lyra-media-card
        src="https://example.test/report.pdf"
        kind="file"
        filename="report.pdf"
      ></lyra-media-card>
    `)) as LyraMediaCard;
    el.removeAttribute('src');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')?.tagName).to.equal('SPAN');
  });
});

describe('kind resolution', () => {
  it('reflects kind onto the host attribute when explicitly set', async () => {
    const el = (await fixture(html`<lyra-media-card kind="video"></lyra-media-card>`)) as LyraMediaCard;
    expect(el.getAttribute('kind')).to.equal('video');
  });

  it('leaves the kind attribute unset when relying on auto-detection', async () => {
    const el = (await fixture(html`<lyra-media-card mime-type="image/png"></lyra-media-card>`)) as LyraMediaCard;
    expect(el.hasAttribute('kind')).to.be.false;
    expect(el.kind).to.be.undefined;
  });

  it('auto-detects image from an image/* mime-type', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" mime-type="image/png"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('img[part="media"]')).to.exist;
  });

  it('auto-detects video from a video/* mime-type', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="https://example.test/a.mp4" mime-type="video/mp4"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('video[part="media"]')).to.exist;
  });

  it('falls back to the file chip for a mime-type matching neither image/* nor video/*', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="https://example.test/a.zip" mime-type="application/zip"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('[part="file-icon"]')).to.exist;
    expect(el.shadowRoot!.querySelector('img[part="media"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('video[part="media"]')).to.not.exist;
  });

  it('an explicit kind wins over mime-type detection', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" mime-type="image/png" kind="file"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('[part="file-icon"]')).to.exist;
    expect(el.shadowRoot!.querySelector('img[part="media"]')).to.not.exist;
  });
});

describe('kind="image"', () => {
  it('renders a button > img with the given (safe) src', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" kind="image"></lyra-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.tagName).to.equal('BUTTON');
    const img = el.shadowRoot!.querySelector('img[part="media"]') as HTMLImageElement;
    expect(img.getAttribute('src')).to.equal('https://example.test/a.png');
  });

  it('alt falls back from alt -> filename -> generic description', async () => {
    const withAlt = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" kind="image" filename="a.png" alt="A red square"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect((withAlt.shadowRoot!.querySelector('img') as HTMLImageElement).alt).to.equal('A red square');

    const withFilenameOnly = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" kind="image" filename="a.png"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect((withFilenameOnly.shadowRoot!.querySelector('img') as HTMLImageElement).alt).to.equal('a.png');

    const withNeither = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" kind="image"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect((withNeither.shadowRoot!.querySelector('img') as HTMLImageElement).alt).to.equal('Image attachment');
  });

  it('the button aria-label is "Open {filename}", falling back to "Open {alt}" then a generic description', async () => {
    const withFilename = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" kind="image" filename="a.png" alt="ignored"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(withFilename.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Open a.png');

    const withAltOnly = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" kind="image" alt="A red square"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(withAltOnly.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Open A red square',
    );

    const withNeither = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" kind="image"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(withNeither.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Open image attachment',
    );
  });

  it('emits lyra-open with { src, filename } when the card is clicked', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" kind="image" filename="a.png"></lyra-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    setTimeout(() => base.click());
    const ev = await oneEvent(el, 'lyra-open');
    expect(ev.detail).to.deep.equal({ src: 'https://example.test/a.png', filename: 'a.png' });
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
    expect(ev.cancelable).to.be.true;
  });

  it('trims a whitespace-padded src in the emitted lyra-open detail to match what is actually rendered', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="  https://example.test/a.png  " kind="image" filename="a.png"></lyra-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    setTimeout(() => base.click());
    const ev = await oneEvent(el, 'lyra-open');
    expect(ev.detail).to.deep.equal({ src: 'https://example.test/a.png', filename: 'a.png' });
  });

  it('falls back to the inert file chip, always a plain SPAN never an A, for a src whose scheme fails the media-src check', async () => {
    for (const src of ['ftp://example.test/a.png', 'about:blank', 'mailto:a@b.test']) {
      const el = (await fixture(
        html`<lyra-media-card src=${src} kind="image" filename="a.png"></lyra-media-card>`,
      )) as LyraMediaCard;
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      // The href allowlist is a strict subset of the media-src allowlist, so
      // a src that already failed the wider media-src check necessarily
      // fails the narrower href check too -- see the class doc.
      expect(base.tagName, src).to.equal('SPAN');
    }
  });

  it('falls back to the inert file chip when src fails the safe-URL check', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="javascript:alert(1)" kind="image" filename="payload.jpg"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('img[part="media"]')).to.not.exist;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    // javascript: fails both the media-src and href allowlists, so there is
    // nothing safe to link to either -- a plain, unclickable span.
    expect(base.tagName).to.equal('SPAN');
    expect(el.shadowRoot!.querySelector('[part="filename"]')!.textContent).to.equal('payload.jpg');
  });

  it('renders a real <img> for a data: URI src (allowed for media, unlike link href)', async () => {
    const el = (await fixture(
      html`<lyra-media-card src=${DATA_URI} kind="image" filename="pixel.png"></lyra-media-card>`,
    )) as LyraMediaCard;
    const img = el.shadowRoot!.querySelector('img[part="media"]') as HTMLImageElement;
    expect(img).to.exist;
    expect(img.getAttribute('src')).to.equal(DATA_URI);
  });
});

describe('kind="video"', () => {
  it('renders a non-interactive base div containing video[controls] and a separate open-button', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="https://example.test/a.mp4" kind="video"></lyra-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.tagName).to.equal('DIV');
    const video = el.shadowRoot!.querySelector('video[part="media"]') as HTMLVideoElement;
    expect(video).to.exist;
    expect(video.hasAttribute('controls')).to.be.true;
    expect(video.getAttribute('src')).to.equal('https://example.test/a.mp4');
    expect(el.shadowRoot!.querySelector('[part="open-button"]')).to.exist;
  });

  it('the video aria-label falls back from alt -> filename -> generic description', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="https://example.test/a.mp4" kind="video" filename="clip.mp4"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('video')!.getAttribute('aria-label')).to.equal('clip.mp4');
  });

  it('the open-button aria-label is "Open {filename}", falling back to "Open {alt}" then a generic description', async () => {
    const withFilename = (await fixture(
      html`<lyra-media-card src="https://example.test/a.mp4" kind="video" filename="clip.mp4" alt="ignored"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(withFilename.shadowRoot!.querySelector('[part="open-button"]')!.getAttribute('aria-label')).to.equal(
      'Open clip.mp4',
    );

    const withAltOnly = (await fixture(
      html`<lyra-media-card src="https://example.test/a.mp4" kind="video" alt="a walkthrough clip"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(withAltOnly.shadowRoot!.querySelector('[part="open-button"]')!.getAttribute('aria-label')).to.equal(
      'Open a walkthrough clip',
    );

    const withNeither = (await fixture(
      html`<lyra-media-card src="https://example.test/a.mp4" kind="video"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(withNeither.shadowRoot!.querySelector('[part="open-button"]')!.getAttribute('aria-label')).to.equal(
      'Open video attachment',
    );
  });

  it('emits lyra-open with { src, filename } when open-button is clicked', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="https://example.test/a.mp4" kind="video" filename="clip.mp4"></lyra-media-card>`,
    )) as LyraMediaCard;
    const openButton = el.shadowRoot!.querySelector('[part="open-button"]') as HTMLButtonElement;
    setTimeout(() => openButton.click());
    const ev = await oneEvent(el, 'lyra-open');
    expect(ev.detail).to.deep.equal({ src: 'https://example.test/a.mp4', filename: 'clip.mp4' });
  });

  it('falls back to the file chip when src fails the safe-URL check', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="vbscript:msgbox(1)" kind="video" filename="clip.mp4"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('video[part="media"]')).to.not.exist;
    expect(el.shadowRoot!.querySelector('[part="file-icon"]')).to.exist;
  });

  it('falls back to the inert file chip, always a plain SPAN never an A, for a src whose scheme fails the media-src check', async () => {
    for (const src of ['ftp://example.test/a.mp4', 'about:blank', 'mailto:a@b.test']) {
      const el = (await fixture(
        html`<lyra-media-card src=${src} kind="video" filename="clip.mp4"></lyra-media-card>`,
      )) as LyraMediaCard;
      const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      // The href allowlist is a strict subset of the media-src allowlist, so
      // a src that already failed the wider media-src check necessarily
      // fails the narrower href check too -- see the class doc.
      expect(base.tagName, src).to.equal('SPAN');
    }
  });

  it('renders a real <video> for a data: URI src', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="data:video/mp4;base64,AAAA" kind="video" filename="clip.mp4"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('video[part="media"]')).to.exist;
  });
});

describe('kind="file" (generic chip)', () => {
  it('renders an <a href download> when src passes the (stricter) href safety check', async () => {
    const el = (await fixture(
      html`<lyra-media-card
        src="https://example.test/report.pdf"
        kind="file"
        filename="report.pdf"
      ></lyra-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
    expect(base.tagName).to.equal('A');
    expect(base.getAttribute('href')).to.equal('https://example.test/report.pdf');
    expect(base.getAttribute('download')).to.equal('report.pdf');
    expect(base.getAttribute('aria-label')).to.equal('Open report.pdf');
  });

  it('renders an inert <span> (no href) for a data: URI src, since data: is excluded from link hrefs', async () => {
    const el = (await fixture(
      html`<lyra-media-card src=${DATA_URI} kind="file" filename="pixel.png"></lyra-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.tagName).to.equal('SPAN');
    expect(el.shadowRoot!.querySelector('[part="filename"]')!.textContent).to.equal('pixel.png');
  });

  it('renders an inert <span> when src is unset', async () => {
    const el = (await fixture(html`<lyra-media-card kind="file" filename="report.pdf"></lyra-media-card>`)) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.tagName).to.equal('SPAN');
  });

  it('sets the filename as both the visible text and a title tooltip', async () => {
    const el = (await fixture(
      html`<lyra-media-card kind="file" filename="a-very-long-quarterly-report.pdf"></lyra-media-card>`,
    )) as LyraMediaCard;
    const filenamePart = el.shadowRoot!.querySelector('[part="filename"]') as HTMLElement;
    expect(filenamePart.textContent).to.equal('a-very-long-quarterly-report.pdf');
    expect(filenamePart.getAttribute('title')).to.equal('a-very-long-quarterly-report.pdf');
  });

  it('emits lyra-open with { src, filename } when the link is activated', async () => {
    const el = (await fixture(
      html`<lyra-media-card
        src="https://example.test/report.pdf"
        kind="file"
        filename="report.pdf"
      ></lyra-media-card>`,
    )) as LyraMediaCard;
    const link = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
    // Prevent the actual navigation/download inside the test runner while
    // still exercising the real click -> handler -> emit path (same pattern
    // as <lyra-document-preview>'s identical download-link test).
    link.addEventListener('click', (e) => e.preventDefault());
    setTimeout(() => link.click());
    const ev = await oneEvent(el, 'lyra-open');
    expect(ev.detail).to.deep.equal({ src: 'https://example.test/report.pdf', filename: 'report.pdf' });
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
  });

  it('propagates preventDefault() on lyra-open to the native click, suppressing the link default', async () => {
    const el = (await fixture(
      html`<lyra-media-card
        src="https://example.test/report.pdf"
        kind="file"
        filename="report.pdf"
      ></lyra-media-card>`,
    )) as LyraMediaCard;
    el.addEventListener('lyra-open', (e) => e.preventDefault());
    const link = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
    // A synthetic dispatchEvent() (unlike a real `.click()`) never invokes
    // the anchor's own built-in navigation behavior, so this safely
    // exercises the real @click-bound handler with zero risk of the test
    // page actually navigating away, while still observing whether that
    // handler forwards the lyra-open cancellation onto the native event --
    // the exact thing under test here.
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).to.be.true;
  });

  it('does not call preventDefault on the native click when lyra-open is left uncancelled', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="https://example.test/report.pdf" kind="file" filename="report.pdf"></lyra-media-card>`,
    )) as LyraMediaCard;
    const link = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
    // Strip href/download right before dispatching -- an anchor with no
    // href has no activation behavior at all (nothing to navigate to or
    // download), which removes any risk of a real navigation/download side
    // effect while leaving the @click-bound handler under test completely
    // untouched (Lit's binding lives on the node itself, independent of its
    // attributes), so `defaultPrevented` still faithfully reflects only
    // what that handler chose to do.
    link.removeAttribute('href');
    link.removeAttribute('download');
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).to.be.false;
  });
});

describe('max-height', () => {
  it('sets the --lyra-media-card-max-height custom property on [part="base"] when given (file-chip span)', async () => {
    const el = (await fixture(
      html`<lyra-media-card kind="file" filename="report.pdf" max-height="12rem"></lyra-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('--lyra-media-card-max-height').trim()).to.equal('12rem');
  });

  it('sets the --lyra-media-card-max-height custom property on [part="base"] when given (image button)', async () => {
    const el = (await fixture(
      html`<lyra-media-card
        src="https://example.test/a.png"
        kind="image"
        max-height="18rem"
      ></lyra-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('--lyra-media-card-max-height').trim()).to.equal('18rem');
  });

  it('leaves no inline custom property when max-height is unset', async () => {
    const el = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" kind="image"></lyra-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('--lyra-media-card-max-height')).to.equal('');
  });
});

describe('string localization', () => {
  it('defaults every built-in fallback string to English', async () => {
    const el = (await fixture(html`<lyra-media-card></lyra-media-card>`)) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('[part="filename"]')!.textContent).to.equal('Untitled file');

    // The generic "Open {kind} attachment" branch of accessibleLabel only
    // renders as an aria-label on an interactive element -- the plain inert
    // <span> fallback (no safe href, no name) has no accessible action at
    // all -- so exercise it via the <a> case (a safe href, no filename/alt).
    const genericOpen = (await fixture(
      html`<lyra-media-card src="https://example.test/report.pdf" kind="file"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(genericOpen.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Open file attachment',
    );

    const image = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" kind="image"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect((image.shadowRoot!.querySelector('img') as HTMLImageElement).alt).to.equal('Image attachment');
    expect(image.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Open image attachment',
    );

    const video = (await fixture(
      html`<lyra-media-card src="https://example.test/a.mp4" kind="video"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(video.shadowRoot!.querySelector('video')!.getAttribute('aria-label')).to.equal('Video attachment');
    expect(video.shadowRoot!.querySelector('[part="open-button"]')!.getAttribute('aria-label')).to.equal(
      'Open video attachment',
    );

    const named = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" kind="image" filename="a.png"></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(named.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Open a.png');
  });

  it('honors a strings override for every mediaCard* key', async () => {
    const overrides = {
      mediaCardUntitledFile: 'Fichier sans titre',
      mediaCardOpenName: 'Ouvrir {name}',
      mediaCardOpenFileAttachment: 'Ouvrir la pièce jointe fichier',
      mediaCardOpenImageAttachment: "Ouvrir la pièce jointe d'image",
      mediaCardOpenVideoAttachment: 'Ouvrir la pièce jointe vidéo',
      mediaCardImageAttachment: 'Pièce jointe image',
      mediaCardVideoAttachment: 'Pièce jointe vidéo',
    };

    const untitled = (await fixture(
      html`<lyra-media-card kind="file" .strings=${overrides}></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(untitled.shadowRoot!.querySelector('[part="filename"]')!.textContent).to.equal('Fichier sans titre');

    const openFallback = (await fixture(
      html`<lyra-media-card src="https://example.test/report.pdf" kind="file" .strings=${overrides}></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(openFallback.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Ouvrir la pièce jointe fichier',
    );

    const openNamed = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" kind="image" filename="a.png" .strings=${overrides}></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(openNamed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Ouvrir a.png',
    );

    const image = (await fixture(
      html`<lyra-media-card src="https://example.test/a.png" kind="image" .strings=${overrides}></lyra-media-card>`,
    )) as LyraMediaCard;
    expect((image.shadowRoot!.querySelector('img') as HTMLImageElement).alt).to.equal('Pièce jointe image');
    expect(image.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      "Ouvrir la pièce jointe d'image",
    );

    const video = (await fixture(
      html`<lyra-media-card src="https://example.test/a.mp4" kind="video" .strings=${overrides}></lyra-media-card>`,
    )) as LyraMediaCard;
    expect(video.shadowRoot!.querySelector('video')!.getAttribute('aria-label')).to.equal('Pièce jointe vidéo');
    expect(video.shadowRoot!.querySelector('[part="open-button"]')!.getAttribute('aria-label')).to.equal(
      'Ouvrir la pièce jointe vidéo',
    );
  });
});

describe('accessibility', () => {
  it('forwards a reactive aria-label/action override to each actionable rendering', async () => {
    const image = (await fixture(html`
      <lyra-media-card
        aria-label="Open image in lightbox"
        src="https://example.test/a.png"
        kind="image"
        filename="a.png"
      ></lyra-media-card>
    `)) as LyraMediaCard;
    expect(image.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Open image in lightbox',
    );

    const video = (await fixture(html`
      <lyra-media-card
        aria-label="Open video in dialog"
        src="https://example.test/a.mp4"
        kind="video"
        filename="a.mp4"
      ></lyra-media-card>
    `)) as LyraMediaCard;
    const openButton = video.shadowRoot!.querySelector('[part="open-button"]') as HTMLButtonElement;
    expect(openButton.getAttribute('aria-label')).to.equal('Open video in dialog');

    const file = (await fixture(html`
      <lyra-media-card
        aria-label="Download quarterly report"
        src="https://example.test/report.pdf"
        kind="file"
        filename="report.pdf"
      ></lyra-media-card>
    `)) as LyraMediaCard;
    const link = file.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
    expect(link.getAttribute('aria-label')).to.equal('Download quarterly report');

    file.accessibleLabel = 'Save quarterly report';
    await file.updateComplete;
    expect(link.getAttribute('aria-label')).to.equal('Save quarterly report');
  });

  it('is accessible in the default (empty) state', async () => {
    const el = (await fixture(html`<lyra-media-card></lyra-media-card>`)) as LyraMediaCard;
    await expect(el).to.be.accessible();
  });

  it('is accessible with a populated image card', async () => {
    const el = (await fixture(html`
      <lyra-media-card src="https://example.test/a.png" kind="image" filename="a.png" alt="A red square"></lyra-media-card>
    `)) as LyraMediaCard;
    await expect(el).to.be.accessible();
  });

  it('is accessible with a populated video card', async () => {
    const el = (await fixture(html`
      <lyra-media-card src="https://example.test/a.mp4" kind="video" filename="clip.mp4"></lyra-media-card>
    `)) as LyraMediaCard;
    await expect(el).to.be.accessible();
  });

  it('is accessible with a populated file chip (safe link)', async () => {
    const el = (await fixture(html`
      <lyra-media-card src="https://example.test/report.pdf" kind="file" filename="report.pdf"></lyra-media-card>
    `)) as LyraMediaCard;
    await expect(el).to.be.accessible();
  });

  it('is accessible in the unsafe-URL inert fallback state', async () => {
    const el = (await fixture(html`
      <lyra-media-card src="javascript:alert(1)" kind="image" filename="payload.jpg"></lyra-media-card>
    `)) as LyraMediaCard;
    await expect(el).to.be.accessible();
  });
});
