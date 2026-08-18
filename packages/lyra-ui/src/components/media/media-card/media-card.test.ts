import { fixture, expect, html, waitUntil, oneEvent } from '@open-wc/testing';
import { resetMouse, sendMouse } from '../../../../test/wtr-mouse.js';
import './media-card.js';
import '../../conversation/chat-message/chat-message.js';
import type { LyraMediaCard } from './media-card.js';
import * as mediaCardExports from './media-card.js';
import { expectStaleAttribute } from '../../../../test/expected-stale-attributes.js';

// Removed-attribute regression tests below deliberately author these; see the helper.
expectStaleAttribute('lr-media-card', 'appearance');

const DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

it('keeps sink validators internal to the component entry', () => {
  expect(Object.hasOwn(mediaCardExports, 'safeMediaSrc')).to.be.false;
  expect(Object.hasOwn(mediaCardExports, 'safeLinkHref')).to.be.false;
});

it('validates maxHeight before assigning the base custom property', async () => {
  const el = await fixture<LyraMediaCard>(html`<lr-media-card kind="file"></lr-media-card>`);
  el.maxHeight = '12rem;position:fixed';
  await el.updateComplete;
  const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
  expect(base.style.position).to.equal('');
  expect(base.style.getPropertyValue('--lr-media-card-max-height')).to.equal('');
  el.maxHeight = 'calc(12rem + 2px)';
  await el.updateComplete;
  expect(base.style.getPropertyValue('--lr-media-card-max-height')).to.equal('calc(12rem + 2px)');
});

describe('internal media-card URL validation', () => {
  it('allows http:/https:/blob: for the download sink', async () => {
    for (const url of ['http://example.test/a.png', 'https://example.test/a.png', 'blob:https://example.test/uuid']) {
      const file = await fixture<LyraMediaCard>(html`
        <lr-media-card kind="file" .src=${url}></lr-media-card>
      `);
      expect(file.shadowRoot!.querySelector('[part="base"]')?.tagName).to.equal('A');
      expect(file.shadowRoot!.querySelector('a')?.getAttribute('href')).to.equal(url);
    }
  });

  it('allows data: as a media src but renders no link for the same file URL', async () => {
    const image = await fixture<LyraMediaCard>(html`
      <lr-media-card kind="image" .src=${DATA_URI}></lr-media-card>
    `);
    expect(image.shadowRoot!.querySelector('img')?.getAttribute('src')).to.equal(DATA_URI);

    const file = await fixture<LyraMediaCard>(html`
      <lr-media-card kind="file" .src=${DATA_URI}></lr-media-card>
    `);
    expect(file.shadowRoot!.querySelector('[part="base"]')?.tagName).to.equal('SPAN');
    expect(file.shadowRoot!.querySelectorAll('a')).to.have.length(0);
  });

  it('rejects javascript:/vbscript:/mailto:/tel: from both rendered sink kinds', async () => {
    for (const url of ['javascript:alert(1)', 'vbscript:msgbox(1)', 'mailto:a@b.test', 'tel:+15551234567']) {
      const image = await fixture<LyraMediaCard>(html`
        <lr-media-card kind="image" .src=${url}></lr-media-card>
      `);
      expect(image.shadowRoot!.querySelector('[part="base"]')?.tagName, url).to.equal('SPAN');
      expect(image.shadowRoot!.querySelectorAll('img, video, a'), url).to.have.length(0);

      const file = await fixture<LyraMediaCard>(html`
        <lr-media-card kind="file" .src=${url}></lr-media-card>
      `);
      expect(file.shadowRoot!.querySelector('[part="base"]')?.tagName, url).to.equal('SPAN');
      expect(file.shadowRoot!.querySelectorAll('a'), url).to.have.length(0);
    }
  });

  it('is case-insensitive on the scheme', async () => {
    const unsafe = await fixture<LyraMediaCard>(html`
      <lr-media-card kind="image" src="JavaScript:alert(1)"></lr-media-card>
    `);
    expect(unsafe.shadowRoot!.querySelectorAll('img, video, a')).to.have.length(0);

    const safe = await fixture<LyraMediaCard>(html`
      <lr-media-card kind="file" src="HTTPS://example.test/a.png"></lr-media-card>
    `);
    expect(safe.shadowRoot!.querySelector('a')?.getAttribute('href')).to.equal(
      'HTTPS://example.test/a.png',
    );
  });

  it('allows relative and scheme-relative URLs', async () => {
    for (const url of ['/foo/bar.png', 'foo/bar.png', '//example.test/foo.png', '?x=1', '#frag']) {
      const file = await fixture<LyraMediaCard>(html`
        <lr-media-card kind="file" .src=${url}></lr-media-card>
      `);
      expect(file.shadowRoot!.querySelector('a')?.getAttribute('href'), url).to.equal(url);
    }
  });

  it('treats an empty or whitespace-only string as an absent sink', async () => {
    for (const url of ['', '   ']) {
      const image = await fixture<LyraMediaCard>(html`
        <lr-media-card kind="image" .src=${url}></lr-media-card>
      `);
      expect(image.shadowRoot!.querySelector('[part="base"]')?.tagName).to.equal('SPAN');
      expect(image.shadowRoot!.querySelectorAll('img, video, a')).to.have.length(0);
    }
  });

  it('trims surrounding whitespace from an otherwise-safe URL', async () => {
    const file = await fixture<LyraMediaCard>(html`
      <lr-media-card kind="file" src="  https://example.test/a.png  "></lr-media-card>
    `);
    expect(file.shadowRoot!.querySelector('a')?.getAttribute('href')).to.equal(
      'https://example.test/a.png',
    );
  });

  it('is not fooled by an embedded tab used to defeat a naive scheme regex', async () => {
    // "java\tscript:alert(1)" fails a naive /^[a-z]+:/ match (so a
    // hand-rolled regex would wrongly call this "relative, therefore safe")
    // while a browser attribute sink still normalizes it down to a working
    // javascript: URL -- this is exactly the class of bypass `new URL()`
    // based checking closes, since the platform parser applies the same
    // tab-stripping normalization the browser itself uses.
    const image = await fixture<LyraMediaCard>(html`
      <lr-media-card kind="image" src=${'java\tscript:alert(1)'}></lr-media-card>
    `);
    expect(image.shadowRoot!.querySelectorAll('img, video, a')).to.have.length(0);
  });
});

describe('defaults', () => {
  it('starts with every prop empty/unset', async () => {
    const el = (await fixture(html`<lr-media-card></lr-media-card>`)) as LyraMediaCard;
    expect(el.src).to.equal('');
    expect(el.kind).to.be.undefined;
    expect(el.mimeType).to.equal('');
    expect(el.filename).to.equal('');
    expect(el.alt).to.equal('');
    expect(el.accessibleLabel).to.equal(null);
  });

  it('renders the inert file-chip fallback with "Untitled file" when nothing is set', async () => {
    const el = (await fixture(html`<lr-media-card></lr-media-card>`)) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const icon = el.shadowRoot!.querySelector('[part="file-icon"]') as HTMLElement;
    expect(base.tagName).to.equal('SPAN');
    expect(icon.getAttribute('aria-hidden')).to.equal('true');
    expect(icon.inert).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="filename"]')!.textContent).to.equal('Untitled file');
  });

  it('fails closed when the src attribute is removed at runtime', async () => {
    const el = (await fixture(html`
      <lr-media-card
        src="https://example.test/report.pdf"
        kind="file"
        filename="report.pdf"
      ></lr-media-card>
    `)) as LyraMediaCard;
    el.removeAttribute('src');
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('[part="base"]')?.tagName).to.equal('SPAN');
  });
});

it('forwards host focus(), blur(), and click() to the resolved primary action', async () => {
  const el = (await fixture(html`
    <lr-media-card src="https://example.test/a.mp4" kind="video"></lr-media-card>
  `)) as LyraMediaCard;
  const button = el.shadowRoot!.querySelector('[part="open-button"]') as HTMLButtonElement;
  let opens = 0;
  el.addEventListener('lr-media-open', () => opens++);
  el.focus();
  expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal('open-button');
  el.blur();
  expect((el.shadowRoot!.activeElement) === (null)).to.equal(true);
  el.click();
  expect(opens).to.equal(1);
  expect(button.disabled).to.be.false;
});

it('relays one bubbling composed native focus/blur pair from every primary action', async () => {
  const cases = [
    {
      markup: html`<lr-media-card src="https://example.test/a.png" kind="image"></lr-media-card>`,
      part: 'base',
    },
    {
      markup: html`<lr-media-card src="https://example.test/a.mp4" kind="video"></lr-media-card>`,
      part: 'open-button',
    },
    {
      markup: html`<lr-media-card src="https://example.test/a.pdf" kind="file"></lr-media-card>`,
      part: 'base',
    },
  ] as const;

  for (const { markup, part } of cases) {
    const el = (await fixture(markup)) as LyraMediaCard;
    const events: FocusEvent[] = [];
    el.addEventListener('focus', (event) => events.push(event));
    el.addEventListener('blur', (event) => events.push(event));

    el.focus({ preventScroll: true });
    expect(el.shadowRoot!.activeElement?.getAttribute('part')).to.equal(part);
    el.blur();

    expect(events.map((event) => event.type)).to.deep.equal(['focus', 'blur']);
    expect(events.every((event) => event instanceof FocusEvent)).to.be.true;
    expect(
      events.every(
        (event) =>
          event.target === el && event.bubbles && event.composed,
      ),
    ).to.be.true;
  }
});

describe('kind resolution', () => {
  it('reflects kind onto the host attribute when explicitly set', async () => {
    const el = (await fixture(html`<lr-media-card kind="video"></lr-media-card>`)) as LyraMediaCard;
    expect(el.getAttribute('kind')).to.equal('video');
  });

  it('leaves the kind attribute unset when relying on auto-detection', async () => {
    const el = (await fixture(html`<lr-media-card mime-type="image/png"></lr-media-card>`)) as LyraMediaCard;
    expect(el.hasAttribute('kind')).to.be.false;
    expect(el.kind).to.be.undefined;
  });

  it('auto-detects image from an image/* mime-type', async () => {
    const el = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" mime-type="image/png"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('img[part="media"]')).to.exist;
  });

  it('auto-detects video from a video/* mime-type', async () => {
    const el = (await fixture(
      html`<lr-media-card src="https://example.test/a.mp4" mime-type="video/mp4"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('video[part="media"]')).to.exist;
  });

  it('falls back to the file chip for a mime-type matching neither image/* nor video/*', async () => {
    const el = (await fixture(
      html`<lr-media-card src="https://example.test/a.zip" mime-type="application/zip"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('[part="file-icon"]')).to.exist;
    expect((el.shadowRoot!.querySelector('img[part="media"]')) == null).to.be.true;
    expect((el.shadowRoot!.querySelector('video[part="media"]')) == null).to.be.true;
  });

  it('an explicit kind wins over mime-type detection', async () => {
    const el = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" mime-type="image/png" kind="file"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('[part="file-icon"]')).to.exist;
    expect((el.shadowRoot!.querySelector('img[part="media"]')) == null).to.be.true;
  });
});

describe('kind="image"', () => {
  it('renders a button > img with the given (safe) src', async () => {
    const el = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" kind="image"></lr-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.tagName).to.equal('BUTTON');
    const img = el.shadowRoot!.querySelector('img[part="media"]') as HTMLImageElement;
    expect(img.getAttribute('src')).to.equal('https://example.test/a.png');
  });

  it('alt falls back from alt -> filename -> generic description', async () => {
    const withAlt = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" kind="image" filename="a.png" alt="A red square"></lr-media-card>`,
    )) as LyraMediaCard;
    expect((withAlt.shadowRoot!.querySelector('img') as HTMLImageElement).alt).to.equal('A red square');

    const withFilenameOnly = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" kind="image" filename="a.png"></lr-media-card>`,
    )) as LyraMediaCard;
    expect((withFilenameOnly.shadowRoot!.querySelector('img') as HTMLImageElement).alt).to.equal('a.png');

    const withNeither = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" kind="image"></lr-media-card>`,
    )) as LyraMediaCard;
    expect((withNeither.shadowRoot!.querySelector('img') as HTMLImageElement).alt).to.equal('Image attachment');
  });

  it('the button aria-label is "Open {filename}", falling back to "Open {alt}" then a generic description', async () => {
    const withFilename = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" kind="image" filename="a.png" alt="ignored"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(withFilename.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal('Open a.png');

    const withAltOnly = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" kind="image" alt="A red square"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(withAltOnly.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Open A red square',
    );

    const withNeither = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" kind="image"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(withNeither.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Open image attachment',
    );
  });

  it('emits a noncancelable lr-media-open notification when the image card is clicked', async () => {
    const el = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" kind="image" filename="a.png"></lr-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    setTimeout(() => base.click());
    const ev = await oneEvent(el, 'lr-media-open');
    expect(ev.detail).to.deep.equal({ src: 'https://example.test/a.png', filename: 'a.png' });
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
    expect(ev.cancelable).to.be.false;
  });

  it('trims a whitespace-padded src in the emitted lr-media-open detail to match rendering', async () => {
    const el = (await fixture(
      html`<lr-media-card src="  https://example.test/a.png  " kind="image" filename="a.png"></lr-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLButtonElement;
    setTimeout(() => base.click());
    const ev = await oneEvent(el, 'lr-media-open');
    expect(ev.detail).to.deep.equal({ src: 'https://example.test/a.png', filename: 'a.png' });
  });

  it('falls back to the inert file chip, always a plain SPAN never an A, for a src whose scheme fails the media-src check', async () => {
    for (const src of ['ftp://example.test/a.png', 'about:blank', 'mailto:a@b.test']) {
      const el = (await fixture(
        html`<lr-media-card src=${src} kind="image" filename="a.png"></lr-media-card>`,
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
      html`<lr-media-card src="javascript:alert(1)" kind="image" filename="payload.jpg"></lr-media-card>`,
    )) as LyraMediaCard;
    expect((el.shadowRoot!.querySelector('img[part="media"]')) == null).to.be.true;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    // javascript: fails both the media-src and href allowlists, so there is
    // nothing safe to link to either -- a plain, unclickable span.
    expect(base.tagName).to.equal('SPAN');
    expect(el.shadowRoot!.querySelector('[part="filename"]')!.textContent).to.equal('payload.jpg');
  });

  it('renders a real <img> for a data: URI src (allowed for media, unlike link href)', async () => {
    const el = (await fixture(
      html`<lr-media-card src=${DATA_URI} kind="image" filename="pixel.png"></lr-media-card>`,
    )) as LyraMediaCard;
    const img = el.shadowRoot!.querySelector('img[part="media"]') as HTMLImageElement;
    expect((img) != null).to.equal(true);
    expect(img.getAttribute('src')).to.equal(DATA_URI);
  });
});

describe('kind="video"', () => {
  it('renders a non-interactive base div containing video[controls] and a separate open-button', async () => {
    const el = (await fixture(
      html`<lr-media-card src="https://example.test/a.mp4" kind="video"></lr-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.tagName).to.equal('DIV');
    const video = el.shadowRoot!.querySelector('video[part="media"]') as HTMLVideoElement;
    expect((video) != null).to.equal(true);
    expect(video.hasAttribute('controls')).to.be.true;
    expect(video.getAttribute('src')).to.equal('https://example.test/a.mp4');
    expect(el.shadowRoot!.querySelector('[part="open-button"]')).to.exist;
  });

  it('gives the open-button the shared minimum hit area', async () => {
    const el = (await fixture(
      html`<lr-media-card src="https://example.test/a.mp4" kind="video"></lr-media-card>`,
    )) as LyraMediaCard;
    const openButton = el.shadowRoot!.querySelector('[part="open-button"]') as HTMLElement;
    expect(getComputedStyle(openButton).minInlineSize).to.equal('40px');
    expect(getComputedStyle(openButton).minBlockSize).to.equal('40px');
  });

  it('the video aria-label falls back from alt -> filename -> generic description', async () => {
    const el = (await fixture(
      html`<lr-media-card src="https://example.test/a.mp4" kind="video" filename="clip.mp4"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('video')!.getAttribute('aria-label')).to.equal('clip.mp4');
  });

  it('the open-button aria-label is "Open {filename}", falling back to "Open {alt}" then a generic description', async () => {
    const withFilename = (await fixture(
      html`<lr-media-card src="https://example.test/a.mp4" kind="video" filename="clip.mp4" alt="ignored"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(withFilename.shadowRoot!.querySelector('[part="open-button"]')!.getAttribute('aria-label')).to.equal(
      'Open clip.mp4',
    );

    const withAltOnly = (await fixture(
      html`<lr-media-card src="https://example.test/a.mp4" kind="video" alt="a walkthrough clip"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(withAltOnly.shadowRoot!.querySelector('[part="open-button"]')!.getAttribute('aria-label')).to.equal(
      'Open a walkthrough clip',
    );

    const withNeither = (await fixture(
      html`<lr-media-card src="https://example.test/a.mp4" kind="video"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(withNeither.shadowRoot!.querySelector('[part="open-button"]')!.getAttribute('aria-label')).to.equal(
      'Open video attachment',
    );
  });

  it('emits noncancelable lr-media-open when the video open-button is clicked', async () => {
    const el = (await fixture(
      html`<lr-media-card src="https://example.test/a.mp4" kind="video" filename="clip.mp4"></lr-media-card>`,
    )) as LyraMediaCard;
    const openButton = el.shadowRoot!.querySelector('[part="open-button"]') as HTMLButtonElement;
    setTimeout(() => openButton.click());
    const ev = await oneEvent(el, 'lr-media-open');
    expect(ev.detail).to.deep.equal({ src: 'https://example.test/a.mp4', filename: 'clip.mp4' });
    expect(ev.cancelable).to.be.false;
  });

  it('falls back to the file chip when src fails the safe-URL check', async () => {
    const el = (await fixture(
      html`<lr-media-card src="vbscript:msgbox(1)" kind="video" filename="clip.mp4"></lr-media-card>`,
    )) as LyraMediaCard;
    expect((el.shadowRoot!.querySelector('video[part="media"]')) == null).to.be.true;
    expect(el.shadowRoot!.querySelector('[part="file-icon"]')).to.exist;
  });

  it('falls back to the inert file chip, always a plain SPAN never an A, for a src whose scheme fails the media-src check', async () => {
    for (const src of ['ftp://example.test/a.mp4', 'about:blank', 'mailto:a@b.test']) {
      const el = (await fixture(
        html`<lr-media-card src=${src} kind="video" filename="clip.mp4"></lr-media-card>`,
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
      html`<lr-media-card src="data:video/mp4;base64,AAAA" kind="video" filename="clip.mp4"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('video[part="media"]')).to.exist;
  });
});

describe('kind="file" (generic chip)', () => {
  it('renders an <a href download> when src passes the (stricter) href safety check', async () => {
    const el = (await fixture(
      html`<lr-media-card
        src="https://example.test/report.pdf"
        kind="file"
        filename="report.pdf"
      ></lr-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
    expect(base.tagName).to.equal('A');
    expect(base.getAttribute('href')).to.equal('https://example.test/report.pdf');
    expect(base.getAttribute('download')).to.equal('report.pdf');
    expect(base.getAttribute('aria-label')).to.equal('Open report.pdf');
  });

  it('renders an inert <span> (no href) for a data: URI src, since data: is excluded from link hrefs', async () => {
    const el = (await fixture(
      html`<lr-media-card src=${DATA_URI} kind="file" filename="pixel.png"></lr-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.tagName).to.equal('SPAN');
    expect(el.shadowRoot!.querySelector('[part="filename"]')!.textContent).to.equal('pixel.png');
  });

  it('renders an inert <span> when src is unset', async () => {
    const el = (await fixture(html`<lr-media-card kind="file" filename="report.pdf"></lr-media-card>`)) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.tagName).to.equal('SPAN');
  });

  it('sets the filename as both the visible text and a title tooltip', async () => {
    const el = (await fixture(
      html`<lr-media-card kind="file" filename="a-very-long-quarterly-report.pdf"></lr-media-card>`,
    )) as LyraMediaCard;
    const filenamePart = el.shadowRoot!.querySelector('[part="filename"]') as HTMLElement;
    expect(filenamePart.textContent).to.equal('a-very-long-quarterly-report.pdf');
    expect(filenamePart.getAttribute('title')).to.equal('a-very-long-quarterly-report.pdf');
  });

  it('emits cancelable lr-before-media-download when the safe file link is activated', async () => {
    const el = (await fixture(
      html`<lr-media-card
        src="https://example.test/report.pdf"
        kind="file"
        filename="report.pdf"
      ></lr-media-card>`,
    )) as LyraMediaCard;
    const link = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
    // Prevent the actual navigation/download inside the test runner while
    // still exercising the real click -> handler -> emit path (same pattern
    // as <lr-document-preview>'s identical download-link test).
    link.addEventListener('click', (e) => e.preventDefault());
    setTimeout(() => link.click());
    const ev = await oneEvent(el, 'lr-before-media-download');
    expect(ev.detail).to.deep.equal({ src: 'https://example.test/report.pdf', filename: 'report.pdf' });
    expect(ev.bubbles).to.be.true;
    expect(ev.composed).to.be.true;
    expect(ev.cancelable).to.be.true;
  });

  it('propagates lr-before-media-download prevention to the native file-link click', async () => {
    const el = (await fixture(
      html`<lr-media-card
        src="https://example.test/report.pdf"
        kind="file"
        filename="report.pdf"
      ></lr-media-card>`,
    )) as LyraMediaCard;
    el.addEventListener('lr-before-media-download', (e) => e.preventDefault());
    const link = el.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
    // A synthetic dispatchEvent() (unlike a real `.click()`) never invokes
    // the anchor's own built-in navigation behavior, so this safely
    // exercises the real @click-bound handler with zero risk of the test
    // page actually navigating away, while still observing whether that
    // handler forwards the before-download cancellation onto the native event --
    // the exact thing under test here.
    const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(clickEvent);
    expect(clickEvent.defaultPrevented).to.be.true;
  });

  it('does not prevent the native click when lr-before-media-download is left uncancelled', async () => {
    const el = (await fixture(
      html`<lr-media-card src="https://example.test/report.pdf" kind="file" filename="report.pdf"></lr-media-card>`,
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
  it('sets the --lr-media-card-max-height custom property on [part="base"] when given (file-chip span)', async () => {
    const el = (await fixture(
      html`<lr-media-card kind="file" filename="report.pdf" max-height="12rem"></lr-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('--lr-media-card-max-height').trim()).to.equal('12rem');
  });

  it('sets the --lr-media-card-max-height custom property on [part="base"] when given (image button)', async () => {
    const el = (await fixture(
      html`<lr-media-card
        src="https://example.test/a.png"
        kind="image"
        max-height="18rem"
      ></lr-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('--lr-media-card-max-height').trim()).to.equal('18rem');
  });

  it('leaves no inline custom property when max-height is unset', async () => {
    const el = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" kind="image"></lr-media-card>`,
    )) as LyraMediaCard;
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    expect(base.style.getPropertyValue('--lr-media-card-max-height')).to.equal('');
  });
});

describe('string localization', () => {
  it('defaults every built-in fallback string to English', async () => {
    const el = (await fixture(html`<lr-media-card></lr-media-card>`)) as LyraMediaCard;
    expect(el.shadowRoot!.querySelector('[part="filename"]')!.textContent).to.equal('Untitled file');

    // The generic "Open {kind} attachment" branch of accessibleLabel only
    // renders as an aria-label on an interactive element -- the plain inert
    // <span> fallback (no safe href, no name) has no accessible action at
    // all -- so exercise it via the <a> case (a safe href, no filename/alt).
    const genericOpen = (await fixture(
      html`<lr-media-card src="https://example.test/report.pdf" kind="file"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(genericOpen.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Open file attachment',
    );

    const image = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" kind="image"></lr-media-card>`,
    )) as LyraMediaCard;
    expect((image.shadowRoot!.querySelector('img') as HTMLImageElement).alt).to.equal('Image attachment');
    expect(image.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Open image attachment',
    );

    const video = (await fixture(
      html`<lr-media-card src="https://example.test/a.mp4" kind="video"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(video.shadowRoot!.querySelector('video')!.getAttribute('aria-label')).to.equal('Video attachment');
    expect(video.shadowRoot!.querySelector('[part="open-button"]')!.getAttribute('aria-label')).to.equal(
      'Open video attachment',
    );

    const named = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" kind="image" filename="a.png"></lr-media-card>`,
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
      html`<lr-media-card kind="file" .strings=${overrides}></lr-media-card>`,
    )) as LyraMediaCard;
    expect(untitled.shadowRoot!.querySelector('[part="filename"]')!.textContent).to.equal('Fichier sans titre');

    const openFallback = (await fixture(
      html`<lr-media-card src="https://example.test/report.pdf" kind="file" .strings=${overrides}></lr-media-card>`,
    )) as LyraMediaCard;
    expect(openFallback.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Ouvrir la pièce jointe fichier',
    );

    const openNamed = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" kind="image" filename="a.png" .strings=${overrides}></lr-media-card>`,
    )) as LyraMediaCard;
    expect(openNamed.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Ouvrir a.png',
    );

    const image = (await fixture(
      html`<lr-media-card src="https://example.test/a.png" kind="image" .strings=${overrides}></lr-media-card>`,
    )) as LyraMediaCard;
    expect((image.shadowRoot!.querySelector('img') as HTMLImageElement).alt).to.equal('Pièce jointe image');
    expect(image.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      "Ouvrir la pièce jointe d'image",
    );

    const video = (await fixture(
      html`<lr-media-card src="https://example.test/a.mp4" kind="video" .strings=${overrides}></lr-media-card>`,
    )) as LyraMediaCard;
    expect(video.shadowRoot!.querySelector('video')!.getAttribute('aria-label')).to.equal('Pièce jointe vidéo');
    expect(video.shadowRoot!.querySelector('[part="open-button"]')!.getAttribute('aria-label')).to.equal(
      'Ouvrir la pièce jointe vidéo',
    );
  });
});

describe('accessibility', () => {
  it('keeps a host label on the host and gives each nested action a purpose-specific name', async () => {
    const image = (await fixture(html`
      <lr-media-card
        aria-label="Open image in lightbox"
        src="https://example.test/a.png"
        kind="image"
        filename="a.png"
      ></lr-media-card>
    `)) as LyraMediaCard;
    expect(image.shadowRoot!.querySelector('[part="base"]')!.getAttribute('aria-label')).to.equal(
      'Open a.png',
    );

    const video = (await fixture(html`
      <lr-media-card
        aria-label="Open video in dialog"
        src="https://example.test/a.mp4"
        kind="video"
        filename="a.mp4"
      ></lr-media-card>
    `)) as LyraMediaCard;
    const openButton = video.shadowRoot!.querySelector('[part="open-button"]') as HTMLButtonElement;
    expect(openButton.getAttribute('aria-label')).to.equal('Open a.mp4');

    const file = (await fixture(html`
      <lr-media-card
        aria-label="Download quarterly report"
        src="https://example.test/report.pdf"
        kind="file"
        filename="report.pdf"
      ></lr-media-card>
    `)) as LyraMediaCard;
    const link = file.shadowRoot!.querySelector('[part="base"]') as HTMLAnchorElement;
    expect(link.getAttribute('aria-label')).to.equal('Open report.pdf');

    file.accessibleLabel = 'Save quarterly report';
    await file.updateComplete;
    expect(link.getAttribute('aria-label')).to.equal('Save quarterly report');

    file.accessibleLabel = '';
    await file.updateComplete;
    expect(link.getAttribute('aria-label')).to.equal('Open report.pdf');

    // An explicit null -- the property's default -- renders identically to the
    // explicit empty string above: both fall through to the generated
    // purpose-specific name rather than naming the action with an empty string.
    file.accessibleLabel = null;
    await file.updateComplete;
    expect(link.getAttribute('aria-label')).to.equal('Open report.pdf');
  });

  it('preserves an explicit empty host label without leaving nested actions unnamed or duplicating later host names', async () => {
    const cases = [
      {
        kind: 'image',
        src: 'https://example.test/image.png',
        filename: 'image.png',
        selector: '[part="base"]',
      },
      {
        kind: 'video',
        src: 'https://example.test/clip.mp4',
        filename: 'clip.mp4',
        selector: '[part="open-button"]',
      },
      {
        kind: 'file',
        src: 'https://example.test/report.pdf',
        filename: 'report.pdf',
        selector: '[part="base"]',
      },
    ] as const;

    for (const { kind, src, filename, selector } of cases) {
      const el = (await fixture(html`
        <lr-media-card
          aria-label=""
          kind=${kind}
          src=${src}
          filename=${filename}
        ></lr-media-card>
      `)) as LyraMediaCard;
      const action = () => el.shadowRoot?.querySelector<HTMLElement>(selector);

      expect(action()?.getAttribute('aria-label')).to.equal(`Open ${filename}`);

      el.setAttribute('aria-label', `Live ${kind} action`);
      await el.updateComplete;
      expect(action()?.getAttribute('aria-label')).to.equal(`Open ${filename}`);

      el.removeAttribute('aria-label');
      await el.updateComplete;
      expect(action()?.getAttribute('aria-label')).to.equal(`Open ${filename}`);
    }
  });

  it('is accessible in the default (empty) state', async () => {
    const el = (await fixture(html`<lr-media-card></lr-media-card>`)) as LyraMediaCard;
    await expect(el).to.be.accessible();
  });

  it('is accessible with a populated image card', async () => {
    const el = (await fixture(html`
      <lr-media-card src="https://example.test/a.png" kind="image" filename="a.png" alt="A red square"></lr-media-card>
    `)) as LyraMediaCard;
    await expect(el).to.be.accessible();
  });

  it('is accessible with a populated video card', async () => {
    const el = (await fixture(html`
      <lr-media-card src="https://example.test/a.mp4" kind="video" filename="clip.mp4"></lr-media-card>
    `)) as LyraMediaCard;
    await expect(el).to.be.accessible();
  });

  it('is accessible with a populated file chip (safe link)', async () => {
    const el = (await fixture(html`
      <lr-media-card src="https://example.test/report.pdf" kind="file" filename="report.pdf"></lr-media-card>
    `)) as LyraMediaCard;
    await expect(el).to.be.accessible();
  });

  it('is accessible in the unsafe-URL inert fallback state', async () => {
    const el = (await fixture(html`
      <lr-media-card src="javascript:alert(1)" kind="image" filename="payload.jpg"></lr-media-card>
    `)) as LyraMediaCard;
    await expect(el).to.be.accessible();
  });
});

// Regression coverage for the card-chrome-missing-compact-escape-hatch defect class -- a
// consumer rendering many <lr-media-card> attachment previews inside a dense chat transcript
// (the component's own documented primary use case) needs a way to suppress the per-card
// bordered chrome, matching the `frame="plain"` convention the library uses for every container
// that can dissolve into its surroundings.
describe('frame', () => {
  const baseChrome = (el: LyraMediaCard) => {
    const base = el.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
    const s = getComputedStyle(base);
    return {
      borderTopWidth: s.borderTopWidth,
      borderTopLeftRadius: s.borderTopLeftRadius,
      backgroundColor: s.backgroundColor,
      paddingTop: s.paddingTop,
      paddingLeft: s.paddingLeft,
    };
  };

  it('defaults to "card" (bordered chrome)', async () => {
    const el = (await fixture(html`<lr-media-card kind="file" filename="a.txt"></lr-media-card>`)) as LyraMediaCard;
    expect(el.frame).to.equal('card');
    expect(el.hasAttribute('frame')).to.be.true;
    const chrome = baseChrome(el);
    expect(chrome.borderTopWidth).to.not.equal('0px');
    expect(chrome.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
  });

  it('drops border, background, padding and radius under frame="plain" for the file-chip fallback', async () => {
    const el = (await fixture(
      html`<lr-media-card frame="plain" kind="file" filename="a.txt"></lr-media-card>`,
    )) as LyraMediaCard;
    expect(el.getAttribute('frame')).to.equal('plain');
    const chrome = baseChrome(el);
    expect(chrome.borderTopWidth).to.equal('0px');
    expect(chrome.borderTopLeftRadius).to.equal('0px');
    expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    expect(chrome.paddingTop).to.equal('0px');
    expect(chrome.paddingLeft).to.equal('0px');
  });

  it('drops border and background under frame="plain" for the image kind too', async () => {
    const el = (await fixture(
      html`<lr-media-card frame="plain" src="https://example.test/a.png" kind="image"></lr-media-card>`,
    )) as LyraMediaCard;
    const chrome = baseChrome(el);
    expect(chrome.borderTopWidth).to.equal('0px');
    expect(chrome.backgroundColor).to.equal('rgba(0, 0, 0, 0)');
  });

  it('is accessible in the plain frame state', async () => {
    const el = (await fixture(
      html`<lr-media-card frame="plain" kind="file" filename="a.txt"></lr-media-card>`,
    )) as LyraMediaCard;
    await expect(el).to.be.accessible();
  });

  it('exposes no `appearance` property, and a stale appearance="plain" keeps the card chrome', async () => {
    const originalWarn = console.warn;
    console.warn = () => {};
    let el: LyraMediaCard;
    try {
      el = (await fixture(
        html`<lr-media-card appearance="plain" kind="file" filename="a.txt"></lr-media-card>`,
      )) as LyraMediaCard;
    } finally {
      console.warn = originalWarn;
    }
    expect('appearance' in el, 'appearance is gone from the instance').to.be.false;
    const chrome = baseChrome(el);
    expect(chrome.borderTopWidth, 'the card border is still drawn').to.not.equal('0px');
    expect(chrome.backgroundColor, 'the card background is still drawn').to.not.equal('rgba(0, 0, 0, 0)');
  });
});

describe('active-state cssprops', () => {
  type ActivePaint = Readonly<{ borderTopColor: string; backgroundColor: string }>;

  function centerOf(target: HTMLElement): [number, number] {
    const rect = target.getBoundingClientRect();
    expect(rect.width, 'the press target has real geometry').to.be.greaterThan(0);
    expect(rect.height, 'the press target has real geometry').to.be.greaterThan(0);
    return [Math.round(rect.left + rect.width / 2), Math.round(rect.top + rect.height / 2)];
  }

  async function pressedPaint(target: HTMLElement): Promise<ActivePaint> {
    try {
      // Polled, not asserted once: WebKit does not always have :active applied by the time the
      // synthetic mousedown promise resolves (observed failing exactly here on the safari lane while
      // passing on Chromium and Firefox in the same run). Same treatment slider.test.ts's thumb and
      // time-range.test.ts's handle paint assertions already carry. open-wc's waitUntil() default
      // timeout (1000ms) has since been observed too tight -- widened first to 15000ms, then to
      // 25000ms, both since observed insufficient on a loaded full-engine-suite WebKit shard; this
      // reproduces 0/3 locally under repeated runs (unlike three other WebKit-shard failures
      // diagnosed the same day -- image-viewer, poll-status, map -- all genuine JS-level ordering
      // races once investigated), consistent with an occasional dropped/lost synthetic pointer
      // event at the OS/compositor level rather than a bug a longer wait alone can fix. Retry the
      // whole move+down sequence, not just the wait, up to 3 times: a fresh mousedown after
      // resetMouse() gives the input pipeline a clean attempt instead of continuing to wait on one
      // that may never arrive. Each call site below raises its own mocha this.timeout() for the
      // full retry budget.
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) await resetMouse();
        await sendMouse({ type: 'move', position: centerOf(target) });
        await sendMouse({ type: 'down' });
        try {
          await waitUntil(
            () => target.matches(':active'),
            'the physical pointer puts the card action in its active state',
            { timeout: 8000 },
          );
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          await sendMouse({ type: 'up' });
        }
      }
      if (lastError) throw lastError;
      const style = getComputedStyle(target);
      return { borderTopColor: style.borderTopColor, backgroundColor: style.backgroundColor };
    } finally {
      await resetMouse();
    }
  }

  function fallbackPaint(card: LyraMediaCard): ActivePaint {
    const probe = document.createElement('span');
    probe.style.setProperty(
      'border-top-color',
      'color-mix(in oklab, var(--lr-color-brand), var(--lr-color-mix-partner) var(--lr-color-mix-active))',
    );
    probe.style.setProperty(
      'background-color',
      'color-mix(in oklab, var(--lr-color-surface), var(--lr-color-mix-partner) var(--lr-color-mix-active))',
    );
    card.shadowRoot!.append(probe);
    const style = getComputedStyle(probe);
    const paint = { borderTopColor: style.borderTopColor, backgroundColor: style.backgroundColor };
    probe.remove();
    return paint;
  }

  it('keeps the prior token-derived active paint when no component property is supplied', async function () {
    // pressedPaint() can now run up to 3 retry attempts at 8000ms each; mocha's own
    // suite-wide 6000ms default (see web-test-runner.config.js) would otherwise cut it off first.
    this.timeout(35000);
    const card = (await fixture(html`
      <lr-media-card
        style="--lr-transition-fast: 0ms"
        src="https://example.test/roof-photo.png"
        kind="image"
        filename="roof-photo.png"
      ></lr-media-card>
    `)) as LyraMediaCard;
    const target = card.shadowRoot!.querySelector('[part="base"]') as HTMLElement;

    expect(await pressedPaint(target)).to.deep.equal(fallbackPaint(card));
  });

  it('inherits pressed border and background properties from an ancestor for image and file actions', async function () {
    // Two cards each call pressedPaint() in the loop below, each now up to 3 retry attempts at
    // 8000ms; mocha's own suite-wide 6000ms default (see web-test-runner.config.js) would
    // otherwise cut this off long before either could finish.
    this.timeout(70000);
    const wrapper = await fixture<HTMLElement>(html`
      <div style="
        --lr-media-card-active-border-color: rgb(10, 20, 30);
        --lr-media-card-active-bg: rgb(40, 50, 60);
      ">
        <lr-media-card
          style="--lr-transition-fast: 0ms"
          src="https://example.test/roof-photo.png"
          kind="image"
          filename="roof-photo.png"
        ></lr-media-card>
        <lr-media-card
          style="--lr-transition-fast: 0ms"
          src="https://example.test/quarterly-report.pdf"
          kind="file"
          filename="quarterly-report.pdf"
        ></lr-media-card>
      </div>
    `);
    const cards = [...wrapper.querySelectorAll<LyraMediaCard>('lr-media-card')];
    expect(cards.length).to.equal(2);

    for (const card of cards) {
      const target = card.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      expect(getComputedStyle(card).getPropertyValue('--lr-media-card-active-border-color').trim()).to.equal(
        'rgb(10, 20, 30)',
      );
      expect(getComputedStyle(card).getPropertyValue('--lr-media-card-active-bg').trim()).to.equal('rgb(40, 50, 60)');
      expect(getComputedStyle(target).getPropertyValue('--lr-media-card-active-border-color').trim()).to.equal(
        'rgb(10, 20, 30)',
      );
      expect(getComputedStyle(target).getPropertyValue('--lr-media-card-active-bg').trim()).to.equal('rgb(40, 50, 60)');
      if (target instanceof HTMLAnchorElement) {
        // resetMouse() releases the physical pointer after the assertion. Keep that real click
        // from navigating away while preserving the browser's actual :active state.
        target.addEventListener('click', (event) => event.preventDefault());
      }
      expect(await pressedPaint(target), `${card.kind} action receives the inherited pressed paint`).to.deep.equal({
        borderTopColor: 'rgb(10, 20, 30)',
        backgroundColor: 'rgb(40, 50, 60)',
      });
    }
  });
});

describe('narrow chat-message attachment compositions', () => {
  const longLtrFilename = 'quarterly-rooftop-installation-verification-and-compliance-summary-final-revision.pdf';
  const longRtlFilename = 'ملخص-التحقق-والامتثال-لتركيب-الألواح-الشمسية-النهائي-للمراجعة.pdf';

  it('keeps long file names and video open actions inside a 320px LTR and Arabic RTL chat allocation', async () => {
    const cases = [
      {
        dir: 'ltr',
        lang: 'en',
        body: 'Here is the complete installation report and the walkthrough recording for the rooftop team.',
        filename: longLtrFilename,
      },
      {
        dir: 'rtl',
        lang: 'ar',
        body: 'إليك تقرير التركيب الكامل وتسجيل الجولة لفريق السطح.',
        filename: longRtlFilename,
      },
    ] as const;

    for (const { dir, lang, body, filename } of cases) {
      const allocation = await fixture<HTMLElement>(html`
        <div dir=${dir} lang=${lang} style="inline-size: 320px; max-inline-size: 100%;">
          <lr-chat-message data-role="assistant">
            ${body}
            <lr-media-card
              slot="attachments"
              src="https://example.test/${filename}"
              kind="file"
              filename=${filename}
            ></lr-media-card>
            <lr-media-card
              slot="attachments"
              src="data:video/mp4;base64,AAAA"
              kind="video"
              filename="${lang === 'ar' ? 'جولة-السطح.mp4' : 'rooftop-walkthrough.mp4'}"
            ></lr-media-card>
          </lr-chat-message>
        </div>
      `);
      const message = allocation.querySelector('lr-chat-message') as HTMLElement;
      await (message as { updateComplete: Promise<unknown> }).updateComplete;
      const bubble = message.shadowRoot!.querySelector('[part="bubble"]') as HTMLElement;
      const [fileCard, videoCard] = [...message.querySelectorAll<LyraMediaCard>('lr-media-card')];
      const fileBase = fileCard!.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      const filenamePart = fileCard!.shadowRoot!.querySelector('[part="filename"]') as HTMLElement;
      const videoBase = videoCard!.shadowRoot!.querySelector('[part="base"]') as HTMLElement;
      const openButton = videoCard!.shadowRoot!.querySelector('[part="open-button"]') as HTMLElement;
      const allocationRect = allocation.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const fileRect = fileBase.getBoundingClientRect();
      const filenameRect = filenamePart.getBoundingClientRect();
      const videoRect = videoBase.getBoundingClientRect();
      const openRect = openButton.getBoundingClientRect();

      expect(bubbleRect.left, `${dir} bubble stays inside the allocation`).to.be.at.least(allocationRect.left - 0.5);
      expect(bubbleRect.right, `${dir} bubble stays inside the allocation`).to.be.at.most(allocationRect.right + 0.5);
      expect(fileRect.left, `${dir} file card stays inside the bubble`).to.be.at.least(bubbleRect.left - 0.5);
      expect(fileRect.right, `${dir} file card stays inside the bubble`).to.be.at.most(bubbleRect.right + 0.5);
      expect(filenameRect.left, `${dir} filename stays inside its chip`).to.be.at.least(fileRect.left - 0.5);
      expect(filenameRect.right, `${dir} filename stays inside its chip`).to.be.at.most(fileRect.right + 0.5);
      expect(getComputedStyle(filenamePart).textOverflow, `${dir} filename can ellipsize`).to.equal('ellipsis');
      expect(filenamePart.scrollWidth, `${dir} filename actually has an ellipsis boundary`).to.be.greaterThan(
        filenamePart.clientWidth,
      );
      expect(videoRect.left, `${dir} video card stays inside the bubble`).to.be.at.least(bubbleRect.left - 0.5);
      expect(videoRect.right, `${dir} video card stays inside the bubble`).to.be.at.most(bubbleRect.right + 0.5);
      expect(openRect.left, `${dir} video open action stays inside the video card`).to.be.at.least(videoRect.left - 0.5);
      expect(openRect.right, `${dir} video open action stays inside the video card`).to.be.at.most(videoRect.right + 0.5);
      expect(openRect.top, `${dir} video open action stays inside the video card`).to.be.at.least(videoRect.top - 0.5);
      expect(openRect.bottom, `${dir} video open action stays inside the video card`).to.be.at.most(videoRect.bottom + 0.5);
      expect(getComputedStyle(openButton).minInlineSize, `${dir} video open action keeps its hit floor`).to.equal('40px');
      expect(getComputedStyle(openButton).minBlockSize, `${dir} video open action keeps its hit floor`).to.equal('40px');
    }
  });
});
