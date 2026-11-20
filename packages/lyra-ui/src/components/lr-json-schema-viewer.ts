export * from './agent-tools/schema-viewer/schema-viewer.class.js';
import { LyraJsonSchemaViewer } from './agent-tools/schema-viewer/schema-viewer.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-badge.js';
import './lr-empty.js';

defineElement('json-schema-viewer', LyraJsonSchemaViewer);
