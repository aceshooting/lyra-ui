export * from './confirm-bar.class.js';
import { LyraConfirmBar } from './confirm-bar.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../layout/details/details.js';
import '../../utility/json-viewer/json-viewer.js';
import '../../utility/live-region/live-region.js';
import '../../forms/button/button.js';
defineElement('confirm-bar', LyraConfirmBar);
