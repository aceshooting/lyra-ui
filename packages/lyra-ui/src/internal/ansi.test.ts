import { expect } from '@open-wc/testing';
import { createAnsiParser, type AnsiSegment } from './ansi.js';

function flat(segments: AnsiSegment[]): { text: string; fg?: string; bg?: string; bold?: boolean }[] {
  return segments.map((s) => ({
    text: s.text,
    fg: s.styles.fg,
    bg: s.styles.bg,
    bold: s.styles.bold,
  }));
}

describe('createAnsiParser', () => {
  it('passes plain text through unchanged with default (unstyled) styles', () => {
    const parser = createAnsiParser();
    const segments = parser.push('hello world');
    expect(segments).to.have.lengthOf(1);
    expect(segments[0].text).to.equal('hello world');
    expect(segments[0].styles).to.deep.equal({
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      inverse: false,
    });
  });

  it('applies bold (SGR 1) to subsequent text and resets on SGR 0', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b[1mBOLD\x1b[0mplain');
    expect(flat(segments)).to.deep.equal([
      { text: 'BOLD', fg: undefined, bg: undefined, bold: true },
      { text: 'plain', fg: undefined, bg: undefined, bold: false },
    ]);
  });

  it('maps a named foreground color (SGR 31 = red) to the red terminal color var', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b[31mred text');
    expect(segments[0].styles.fg).to.equal('var(--lyra-terminal-color-red)');
  });

  it('maps a bright background color (SGR 104 = bright blue bg)', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b[104mtext');
    expect(segments[0].styles.bg).to.equal('var(--lyra-terminal-color-bright-blue)');
  });

  it('resolves 256-color (38;5;n) to the named var for n < 16 and rgb() for n >= 16', () => {
    const parser = createAnsiParser();
    const low = parser.push('\x1b[38;5;1mlow');
    expect(low[0].styles.fg).to.equal('var(--lyra-terminal-color-red)');
    const cube = createAnsiParser().push('\x1b[38;5;196mcube');
    expect(cube[0].styles.fg).to.equal('rgb(255, 0, 0)');
    const gray = createAnsiParser().push('\x1b[38;5;244mgray');
    expect(gray[0].styles.fg).to.match(/^rgb\(\d+, \d+, \d+\)$/);
  });

  it('resolves truecolor (38;2;r;g;b) to a literal rgb()', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b[38;2;10;20;30mtruecolor');
    expect(segments[0].styles.fg).to.equal('rgb(10, 20, 30)');
  });

  it('applies multiple SGR params in one sequence (1;31)', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b[1;31mboldred');
    expect(segments[0].styles.bold).to.be.true;
    expect(segments[0].styles.fg).to.equal('var(--lyra-terminal-color-red)');
  });

  it('ignores an unknown SGR param without throwing or altering other state', () => {
    const parser = createAnsiParser();
    expect(() => parser.push('\x1b[5mblink-not-supported')).to.not.throw();
    const segments = createAnsiParser().push('\x1b[5;31mtext');
    expect(segments[0].styles.fg).to.equal('var(--lyra-terminal-color-red)');
  });

  it('strips a non-SGR CSI sequence (cursor move) without emitting it as text', () => {
    const parser = createAnsiParser();
    const segments = parser.push('before\x1b[2Kafter');
    expect(segments.map((s) => s.text).join('')).to.equal('beforeafter');
  });

  it('strips an OSC sequence terminated by BEL', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b]0;window title\x07visible');
    expect(segments.map((s) => s.text).join('')).to.equal('visible');
  });

  it('strips an OSC sequence terminated by ST (ESC \\\\)', () => {
    const parser = createAnsiParser();
    const segments = parser.push('\x1b]0;title\x1b\\visible');
    expect(segments.map((s) => s.text).join('')).to.equal('visible');
  });

  it('buffers a CSI sequence split across two push() calls', () => {
    const parser = createAnsiParser();
    const first = parser.push('plain\x1b[3');
    expect(first.map((s) => s.text).join('')).to.equal('plain');
    const second = parser.push('1mred');
    expect(second[0].styles.fg).to.equal('var(--lyra-terminal-color-red)');
    expect(second[0].text).to.equal('red');
  });

  it('buffers a bare trailing ESC split from the rest of its sequence across two push() calls', () => {
    const parser = createAnsiParser();
    const first = parser.push('text\x1b');
    expect(first.map((s) => s.text).join('')).to.equal('text');
    const second = parser.push('[31mfoo');
    expect(second).to.have.length(1);
    expect(second[0].text).to.equal('foo');
    expect(second[0].styles.fg).to.equal('var(--lyra-terminal-color-red)');
  });

  it('buffers an OSC sequence split across two push() calls', () => {
    const parser = createAnsiParser();
    const first = parser.push('start\x1b]0;ti');
    expect(first.map((s) => s.text).join('')).to.equal('start');
    const second = parser.push('tle\x07end');
    expect(second.map((s) => s.text).join('')).to.equal('end');
  });

  it('reset() clears style state and any buffered partial sequence', () => {
    const parser = createAnsiParser();
    parser.push('\x1b[1;31mbold-red\x1b[3');
    parser.reset();
    const segments = parser.push('plain');
    expect(segments[0].styles).to.deep.equal({
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      inverse: false,
    });
    expect(segments[0].text).to.equal('plain');
  });

  it('applies dim/italic/underline/inverse (SGR 2/3/4/7) and clears each with its own reset code', () => {
    const parser = createAnsiParser();
    const on = parser.push('\x1b[2;3;4;7mstyled');
    expect(on[0].styles).to.deep.include({
      dim: true,
      italic: true,
      underline: true,
      inverse: true,
    });
    const off = parser.push('\x1b[22;23;24;27mplain');
    expect(off[0].styles).to.deep.include({
      bold: false,
      dim: false,
      italic: false,
      underline: false,
      inverse: false,
    });
  });

  it('maps the full 30-37/40-47 and 90-97/100-107 named color ranges', () => {
    expect(createAnsiParser().push('\x1b[37mwhite')[0].styles.fg).to.equal(
      'var(--lyra-terminal-color-white)',
    );
    expect(createAnsiParser().push('\x1b[47mwhite-bg')[0].styles.bg).to.equal(
      'var(--lyra-terminal-color-white)',
    );
    expect(createAnsiParser().push('\x1b[90mbright-black')[0].styles.fg).to.equal(
      'var(--lyra-terminal-color-bright-black)',
    );
    expect(createAnsiParser().push('\x1b[107mbright-white-bg')[0].styles.bg).to.equal(
      'var(--lyra-terminal-color-bright-white)',
    );
  });

  it('clears fg/bg back to the default color on SGR 39/49', () => {
    const parser = createAnsiParser();
    const colored = parser.push('\x1b[31;41mtext');
    expect(colored[0].styles.fg).to.equal('var(--lyra-terminal-color-red)');
    expect(colored[0].styles.bg).to.equal('var(--lyra-terminal-color-red)');
    const cleared = parser.push('\x1b[39;49mtext');
    expect(cleared[0].styles.fg).to.be.undefined;
    expect(cleared[0].styles.bg).to.be.undefined;
  });

  it('resolves 256-color background (48;5;n) the same way as foreground', () => {
    const segments = createAnsiParser().push('\x1b[48;5;196mbg');
    expect(segments[0].styles.bg).to.equal('rgb(255, 0, 0)');
  });

  it('resolves truecolor background (48;2;r;g;b) to a literal rgb()', () => {
    const segments = createAnsiParser().push('\x1b[48;2;1;2;3mbg');
    expect(segments[0].styles.bg).to.equal('rgb(1, 2, 3)');
  });
});
