import { expect } from '@open-wc/testing';
import { resolveGuardedRel } from './link-rel.js';

describe('resolveGuardedRel', () => {
  it('omits the attribute when no author token and no target remain', () => {
    for (const [rel, target] of [
      [undefined, undefined],
      [null, null],
      ['', ''],
      [' \t\n ', ''],
      [undefined, ''],
      ['', null],
    ] as const) {
      expect(resolveGuardedRel(rel, target), `${String(rel)} / ${String(target)}`).to.equal(undefined);
    }
  });

  it('renders exactly the author tokens for a same-tab link', () => {
    expect(resolveGuardedRel('me', undefined)).to.equal('me');
    expect(resolveGuardedRel('nofollow license', '')).to.equal('nofollow license');
    expect(resolveGuardedRel('  author   help  ', null)).to.equal('author help');
  });

  it('force-adds the noopener noreferrer guard whenever target is non-empty', () => {
    expect(resolveGuardedRel(undefined, '_blank')).to.equal('noopener noreferrer');
    expect(resolveGuardedRel('', '_blank')).to.equal('noopener noreferrer');
    expect(resolveGuardedRel(null, 'preview')).to.equal('noopener noreferrer');
    expect(resolveGuardedRel(undefined, '_self')).to.equal('noopener noreferrer');
  });

  it('merges author tokens ahead of the guard', () => {
    expect(resolveGuardedRel('me', '_blank')).to.equal('me noopener noreferrer');
    expect(resolveGuardedRel('nofollow me', 'preview')).to.equal('nofollow me noopener noreferrer');
  });

  it('keeps an author guard token in its first-occurrence position without repeating it', () => {
    expect(resolveGuardedRel('noreferrer', '_blank')).to.equal('noreferrer noopener');
    expect(resolveGuardedRel('noopener noreferrer', '_blank')).to.equal('noopener noreferrer');
    expect(resolveGuardedRel('noreferrer me noopener', '_blank')).to.equal('noreferrer me noopener');
  });

  it('strips opener in any letter case, with or without a target', () => {
    expect(resolveGuardedRel('opener', undefined)).to.equal(undefined);
    expect(resolveGuardedRel('OPENER Opener oPeNeR', '')).to.equal(undefined);
    expect(resolveGuardedRel('opener nofollow', '')).to.equal('nofollow');
    expect(resolveGuardedRel('OPENER', '_blank')).to.equal('noopener noreferrer');
    expect(resolveGuardedRel('me Opener', '_blank')).to.equal('me noopener noreferrer');
  });

  it('de-duplicates repeated author tokens, keeping first-occurrence order', () => {
    expect(resolveGuardedRel('me me', '')).to.equal('me');
    expect(resolveGuardedRel('me nofollow me license nofollow', '')).to.equal('me nofollow license');
    expect(resolveGuardedRel('noopener noopener', '_blank')).to.equal('noopener noreferrer');
  });

  it('splits on any whitespace, including tab, newline, and a no-break space', () => {
    expect(resolveGuardedRel('me\tnofollow', '')).to.equal('me nofollow');
    expect(resolveGuardedRel('me\nnofollow\r\nlicense', '')).to.equal('me nofollow license');
    expect(resolveGuardedRel('me nofollow', '')).to.equal('me nofollow');
    expect(resolveGuardedRel(' opener ', '_blank')).to.equal('noopener noreferrer');
  });
});
