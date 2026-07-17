export * from './confirm-bar.class.js';
import { LyraConfirmBar } from './confirm-bar.class.js';
import { defineElement } from '../../internal/prefix.js';
import '../details/details.js';
import '../json-viewer/json-viewer.js';
import '../live-region/live-region.js';
defineElement('confirm-bar', LyraConfirmBar);
