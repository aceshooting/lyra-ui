export * from './page-rail.class.js';
import { LyraPageRail } from './page-rail.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../layout/virtual-list/virtual-list.js';
import '../../media/file-icon/file-icon.js';
import '../../overlays/skeleton/skeleton.js';
defineElement('page-rail', LyraPageRail);
