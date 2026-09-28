/** @deprecated Import @aceshooting/lyra-ui/components/lr-page.js to register this component. */
export * from './page.class.js';
import { defineElement } from '../../../internal/prefix.js';
import { LyraPage } from './page.class.js';

defineElement('page', LyraPage);
