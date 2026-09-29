export * from './geojson-view.class.js';
import { LyraGeojsonView } from './geojson-view.class.js';
import { defineElement } from '../../../internal/prefix.js';
import './geojson-viewer.js';

defineElement('geojson-view', LyraGeojsonView);
