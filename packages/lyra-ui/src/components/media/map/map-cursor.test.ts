import { expect } from '@open-wc/testing';
import { MapCursorOwner } from './map-cursor.js';

describe('map cursor ownership', () => {
  it('restores peer cursor priority after pick and hover modes', () => {
    const canvas = document.createElement('canvas'), owner = new MapCursorOwner(); canvas.style.setProperty('cursor', 'grab', 'important');
    owner.set(canvas, 'pick'); expect(canvas.style.cursor).to.equal('crosshair'); owner.set(canvas, 'hover'); expect(canvas.style.cursor).to.equal('pointer');
    owner.clear(); expect(canvas.style.cursor).to.equal('grab'); expect(canvas.style.getPropertyPriority('cursor')).to.equal('important');
  });
  it('preserves external writes and releases a previous canvas', () => {
    const first = document.createElement('canvas'), second = document.createElement('canvas'), owner = new MapCursorOwner();
    owner.set(first, 'hover'); first.style.cursor = 'wait'; owner.clear(); expect(first.style.cursor).to.equal('wait');
    owner.set(first, 'pick'); first.style.cursor = 'zoom-in'; owner.set(first, 'hover'); owner.set(second, 'pick');
    expect(first.style.cursor).to.equal('zoom-in'); owner.set(second, undefined); expect(second.style.cursor).to.equal('');
  });
  it('preserves an external same-value priority change on clear and after a mode transition', () => {
    const canvas = document.createElement('canvas'), owner = new MapCursorOwner(); canvas.style.cursor = 'grab';
    owner.set(canvas, 'hover'); canvas.style.setProperty('cursor', 'pointer', 'important'); owner.clear();
    expect(canvas.style.cursor).to.equal('pointer'); expect(canvas.style.getPropertyPriority('cursor')).to.equal('important');
    owner.set(canvas, 'hover'); canvas.style.setProperty('cursor', 'pointer', 'important'); owner.set(canvas, 'pick'); owner.clear();
    expect(canvas.style.cursor).to.equal('pointer'); expect(canvas.style.getPropertyPriority('cursor')).to.equal('important');
  });
});
