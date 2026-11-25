export * from './data/radial-bar/radial-bar.class.js';
import { LyraRadialBar } from './data/radial-bar/radial-bar.class.js';
import { defineElement } from '../internal/prefix.js';

defineElement('radial-bar', LyraRadialBar);
