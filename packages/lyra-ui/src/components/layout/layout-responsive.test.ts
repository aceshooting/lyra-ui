import { expect, fixture, html } from "@open-wc/testing";
import "./breadcrumb/breadcrumb.js";
import "./breadcrumb/breadcrumb-item.js";
import "./details/details.js";
import "./reorder-list/reorder-list.js";
import "./reorder-list/reorder-item.js";
import "./multi-split/multi-split.js";
import type { LyraMultiSplit } from "./multi-split/multi-split.js";
import { nextFrame, waitUntil } from '@open-wc/testing';
import './navigation-menu/navigation-menu.js';
import type { LyraNavigationMenu } from './navigation-menu/navigation-menu.js';

const LONG_LABEL = "unbroken".repeat(4_096);

function expectContained(frame: HTMLElement, label: string): void {
  expect(
    frame.scrollWidth,
    `${label}: ${frame.scrollWidth}px scroll width in a ${frame.clientWidth}px allocation`
  ).to.be.at.most(frame.clientWidth + 1);
}

it("contains long public breadcrumb labels in a 320px allocation", async () => {
  const frame = (await fixture(html`
    <div style="inline-size:320px">
      <lr-breadcrumb>
        <lr-breadcrumb-item current>${LONG_LABEL}</lr-breadcrumb-item>
      </lr-breadcrumb>
    </div>
  `)) as HTMLElement;

  expectContained(frame, "breadcrumb");
});

it("contains long details summary and panel content in a 320px allocation", async () => {
  const frame = (await fixture(html`
    <div style="inline-size:320px">
      <lr-details open>
        <span slot="summary">${LONG_LABEL}</span>
        <span>${LONG_LABEL}</span>
      </lr-details>
    </div>
  `)) as HTMLElement;

  expectContained(frame, "details");
});

it("contains long reorder-item labels in a 320px allocation", async () => {
  const frame = (await fixture(html`
    <div style="inline-size:320px">
      <lr-reorder-list>
        <lr-reorder-item value="long">${LONG_LABEL}</lr-reorder-item>
      </lr-reorder-list>
    </div>
  `)) as HTMLElement;

  expectContained(frame, "reorder list");
});

it("contains long split-panel content in a 320px allocation", async () => {
  const frame = (await fixture(html`
    <div style="inline-size:320px">
      <lr-multi-split style="block-size:120px">
        <section>${LONG_LABEL}</section>
        <section>${LONG_LABEL}</section>
      </lr-multi-split>
    </div>
  `)) as HTMLElement;
  const split = frame.querySelector("lr-multi-split") as LyraMultiSplit;
  await split.updateComplete;

  expectContained(frame, "split");
});

it('contains long navigation-menu labels in a 320px allocation, collapsed or not', async () => {
  const bar = (await fixture(html`
    <div style="inline-size:320px">
      <lr-navigation-menu>
        <lr-navigation-menu-item open>${LONG_LABEL}<div slot="panel">${LONG_LABEL}</div></lr-navigation-menu-item>
        <lr-navigation-menu-item href="#long">${LONG_LABEL}</lr-navigation-menu-item>
      </lr-navigation-menu>
    </div>
  `)) as HTMLElement;
  const barMenu = bar.querySelector('lr-navigation-menu') as LyraNavigationMenu;
  await barMenu.updateComplete;
  await waitUntil(() => barMenu.querySelector('[role="listitem"]') !== null, 'the menu never bound its items');
  expect(barMenu.collapsed).to.equal(false);
  expectContained(bar, 'navigation menu bar');

  const collapsed = (await fixture(html`
    <div style="inline-size:320px">
      <lr-navigation-menu mobile-breakpoint="40rem" expanded>
        <lr-navigation-menu-item open>${LONG_LABEL}<div slot="panel">${LONG_LABEL}</div></lr-navigation-menu-item>
        <lr-navigation-menu-item href="#long">${LONG_LABEL}</lr-navigation-menu-item>
      </lr-navigation-menu>
    </div>
  `)) as HTMLElement;
  const collapsedMenu = collapsed.querySelector('lr-navigation-menu') as LyraNavigationMenu;
  await waitUntil(() => collapsedMenu.collapsed, 'the long-label menu never collapsed');
  await collapsedMenu.updateComplete;
  await nextFrame();
  expectContained(collapsed, 'navigation menu collapsed');
});
