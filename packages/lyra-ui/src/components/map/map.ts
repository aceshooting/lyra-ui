export * from './map.class.js';
import { LyraMap } from './map.class.js';
import { defineElement } from '../../internal/prefix.js';
import "../skeleton/skeleton.js";
defineElement('map', LyraMap);
