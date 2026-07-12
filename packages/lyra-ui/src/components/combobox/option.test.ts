import { fixture, expect, html } from '@open-wc/testing';
import './option.js';
import type { LyraOption } from './option.js';

it('establishes the shared --lyra-* design tokens on its own host', async () => {
  const el = (await fixture(html`<lyra-option value="a">A</lyra-option>`)) as LyraOption;
  const text = getComputedStyle(el).getPropertyValue('--lyra-color-text').trim();
  expect(text).to.not.equal('');
});

it('resolves label from the label attribute when present', async () => {
  const el = (await fixture(html`<lyra-option value="a" label="Alpha">A</lyra-option>`)) as LyraOption;
  expect(el.label).to.equal('Alpha');
});

it('falls back to text content when the label attribute is absent', async () => {
  const el = (await fixture(html`<lyra-option value="a">Alpha</lyra-option>`)) as LyraOption;
  expect(el.label).to.equal('Alpha');
});

it('falls back to text content when the label attribute is present but empty', async () => {
  const el = (await fixture(html`<lyra-option value="a" label="">Alpha</lyra-option>`)) as LyraOption;
  expect(el.label).to.equal('Alpha');
});

it('exposes sub and dotColor properties, empty by default', async () => {
  const el = (await fixture(html`<lyra-option value="a">A</lyra-option>`)) as LyraOption;
  expect(el.sub).to.equal('');
  expect(el.dotColor).to.equal('');
});

it('reflects sub and dot-color attributes onto their properties', async () => {
  const el = (await fixture(
    html`<lyra-option value="a" sub="Running" dot-color="green">A</lyra-option>`,
  )) as LyraOption;
  expect(el.sub).to.equal('Running');
  expect(el.dotColor).to.equal('green');
});
