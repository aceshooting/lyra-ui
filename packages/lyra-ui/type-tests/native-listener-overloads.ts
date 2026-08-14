import { LyraPage as RootLyraPage } from "../src/lyra.js";
import { LyraDropdownItem } from "../src/components/layout/menu/dropdown-item.class.js";
import { LyraPage } from "../src/components/layout/page/page.class.js";

declare const page: LyraPage;
declare const rootPage: RootLyraPage;
declare const item: LyraDropdownItem;

const pageClick = function (this: LyraPage, event: MouseEvent): void {
  const current: LyraPage = this;
  const button: number = event.button;
  void current;
  void button;
};
page.addEventListener("click", pageClick);
page.removeEventListener("click", pageClick);

rootPage.addEventListener("click", (event) => {
  const mouse: MouseEvent = event;
  void mouse;
});

const itemFocus = function (this: LyraDropdownItem, event: FocusEvent): void {
  const current: LyraDropdownItem = this;
  const related: EventTarget | null = event.relatedTarget;
  void current;
  void related;
};
item.addEventListener("focus", itemFocus);
item.removeEventListener("focus", itemFocus);

page.addEventListener("lr-nav-toggle", (event) => {
  const open: boolean = event.detail.open;
  void open;
});

page.addEventListener("consumer-specific-event", (event) => {
  const fallback: Event = event;
  void fallback;
});
