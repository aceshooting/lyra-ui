export * from './ingestion-queue.class.js';
import { LyraIngestionQueue } from './ingestion-queue.class.js';
import { defineElement } from '../../../internal/prefix.js';
defineElement('ingestion-queue', LyraIngestionQueue);
