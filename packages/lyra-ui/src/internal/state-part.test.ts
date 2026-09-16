import { expect } from '@open-wc/testing';

import { statePart } from './state-part.js';

describe('statePart', () => {
  it('returns the bare base name when no states are supplied', () => {
    expect(statePart('segment')).to.equal('segment');
  });

  it('returns the bare base name when every state is off', () => {
    expect(statePart('segment', { selected: false, empty: undefined })).to.equal('segment');
  });

  it('appends one active state after the base', () => {
    expect(statePart('segment', { selected: true })).to.equal('segment segment-selected');
  });

  it('keeps several active states in declaration order', () => {
    expect(statePart('segment', { selected: true, empty: true, disabled: true })).to.equal(
      'segment segment-selected segment-empty segment-disabled',
    );
  });

  it('skips inactive states without leaving an empty token', () => {
    const value = statePart('legend-item', { selected: false, empty: true, disabled: false });
    expect(value).to.equal('legend-item legend-item-empty');
    expect(value.split(' ').filter((token) => token === '')).to.deep.equal([]);
  });

  it('treats undefined as off, so an optional flag never emits a token', () => {
    expect(statePart('item', { disabled: undefined, selected: true })).to.equal('item item-selected');
  });

  it('honours a custom separator for a component mirroring an upstream part vocabulary', () => {
    expect(
      statePart('item', { selected: true, expanded: true }, { separators: ['--'] }),
    ).to.equal('item item--selected item--expanded');
  });

  it('emits every requested separator spelling for a component that has shipped both', () => {
    expect(
      statePart('pagination-item', { active: true }, { separators: ['-', '--'] }),
    ).to.equal('pagination-item pagination-item-active pagination-item--active');
  });

  it('publishes a string-valued state as a parameterized token', () => {
    expect(statePart('line', { interactive: true, highlight: 'warning' })).to.equal(
      'line line-interactive line-highlight-warning',
    );
  });

  it('treats null and the empty string as off for a string-valued state', () => {
    expect(statePart('line', { highlight: null, match: '' })).to.equal('line');
  });

  it('applies every separator to a parameterized token as well', () => {
    expect(statePart('cell', { highlight: 'info' }, { separators: ['-', '--'] })).to.equal(
      'cell cell-highlight-info cell--highlight-info',
    );
  });

  it('never repeats a token when two separators would collide', () => {
    expect(statePart('x', { a: true }, { separators: ['-', '-'] })).to.equal('x x-a');
  });
});
