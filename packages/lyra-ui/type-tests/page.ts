import { LyraPage } from '../src/lyra.js';
import { LyraPage as LayoutLyraPage } from '../src/components/layout/index.js';
import type { PageNavigationPlacement, PageView } from '../src/lyra.js';

const layoutConstructor: typeof LyraPage = LayoutLyraPage;
void layoutConstructor;

declare const page: LyraPage;
page.view = 'mobile';
page.navigationPlacement = 'end';

const view: PageView = page.view;
const navigationPlacement: PageNavigationPlacement = page.navigationPlacement;
void view;
void navigationPlacement;
