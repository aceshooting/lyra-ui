export type { MapLibreSourceDataDiff } from './media/map/map-loader.js';
export * from './media/map/map.class.js';
import { LyraMap } from './media/map/map.class.js';
import { defineElement } from '../internal/prefix.js';
import './lr-skeleton.js';
defineElement('map', LyraMap);
