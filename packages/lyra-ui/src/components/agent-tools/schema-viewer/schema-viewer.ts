export * from './schema-viewer.class.js';
import { LyraJsonSchemaViewer } from './schema-viewer.class.js';
import { defineElement } from '../../../internal/prefix.js';
import '../../overlays/badge/badge.js';
import '../../overlays/empty/empty.js';

defineElement('json-schema-viewer', LyraJsonSchemaViewer);
