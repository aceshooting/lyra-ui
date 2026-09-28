/** @deprecated Import @aceshooting/lyra-ui/components/lr-json-viewer.js to register this component. */
export * from './json-viewer.class.js';
import { LyraJsonViewer } from './json-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('json-viewer', LyraJsonViewer);
