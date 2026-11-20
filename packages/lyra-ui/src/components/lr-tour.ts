export * from './utility/tour/tour.class.js';
import { LyraTour } from './utility/tour/tour.class.js';
import { defineElement } from '../internal/prefix.js';
defineElement('tour', LyraTour);
