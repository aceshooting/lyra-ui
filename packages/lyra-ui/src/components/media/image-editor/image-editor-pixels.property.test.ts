import { expect } from '@open-wc/testing';
import fc from 'fast-check';
import { propertyRuns } from '../../../../test/property-options.js';
import { defaultEditorSettings, editorImageGeometry, renderEditorImage } from './image-editor-pixels.js';

describe('image editor pixels', () => {
  it('keeps the oriented crop inside the image and limits preview dimensions', () => {
    fc.assert(
      fc.property(
        fc.record({
          width: fc.integer({ min: 1, max: 6000 }),
          height: fc.integer({ min: 1, max: 6000 }),
          aspect: fc.double({ min: 0, max: 4, noNaN: true }),
          cropScale: fc.integer({ min: -100, max: 200 }),
          cropX: fc.integer({ min: -100, max: 200 }),
          cropY: fc.integer({ min: -100, max: 200 }),
          turns: fc.integer(),
          maxEdge: fc.integer({ min: 1, max: 1200 }),
        }),
        ({ width, height, maxEdge, ...settings }) => {
          const geometry = editorImageGeometry(width, height, {
            ...defaultEditorSettings(),
            ...settings,
          }, maxEdge);
          const { cropWidth, cropHeight, cropLeft, cropTop, orientedWidth, orientedHeight } = geometry;
          expect(cropLeft).to.be.at.least(0);
          expect(cropTop).to.be.at.least(0);
          expect(cropLeft + cropWidth).to.be.at.most(orientedWidth + 1e-8);
          expect(cropTop + cropHeight).to.be.at.most(orientedHeight + 1e-8);
          expect(geometry.width).to.be.within(1, maxEdge);
          expect(geometry.height).to.be.within(1, maxEdge);
        },
      ),
      propertyRuns(),
    );
  });

  async function imageFixture(): Promise<HTMLImageElement> {
    const source = document.createElement('canvas');
    source.width = 3;
    source.height = 2;
    const context = source.getContext('2d')!;
    const pixels = context.createImageData(3, 2);
    pixels.data.set([
      255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255,
      255, 255, 0, 255, 140, 100, 80, 255, 128, 128, 128, 128,
    ]);
    context.putImageData(pixels, 0, 0);
    const image = new Image();
    image.src = source.toDataURL();
    await image.decode();
    return image;
  }

  it('uses decoded size at neutral and maps clockwise turns and flips in output space', async () => {
    const image = await imageFixture();
    const canvas = document.createElement('canvas');
    const settings = defaultEditorSettings();
    renderEditorImage(canvas, image, settings);
    const context = canvas.getContext('2d')!;
    expect([canvas.width, canvas.height]).to.deep.equal([3, 2]);
    expect([...context.getImageData(0, 0, 1, 1).data]).to.deep.equal([255, 0, 0, 255]);
    expect(context.getImageData(2, 1, 1, 1).data[3]).to.equal(128);

    renderEditorImage(canvas, image, { ...settings, turns: 1 });
    expect([canvas.width, canvas.height]).to.deep.equal([2, 3]);
    expect([...context.getImageData(0, 0, 1, 1).data]).to.deep.equal([255, 255, 0, 255]);
    expect([...context.getImageData(1, 0, 1, 1).data]).to.deep.equal([255, 0, 0, 255]);

    renderEditorImage(canvas, image, { ...settings, turns: 1, flipX: true });
    expect([...context.getImageData(0, 0, 1, 1).data]).to.deep.equal([255, 0, 0, 255]);
    renderEditorImage(canvas, image, { ...settings, turns: 1, flipY: true });
    expect([...context.getImageData(1, 0, 1, 1).data]).to.deep.equal([0, 0, 255, 255]);
  });

  it('changes rendered pixels independently for every adjustment and preserves transparency', async () => {
    const image = await imageFixture();
    const canvas = document.createElement('canvas');
    const settings = defaultEditorSettings();
    renderEditorImage(canvas, image, settings);
    const context = canvas.getContext('2d')!;
    const read = () => Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data);
    const original = read();
    for (const key of Object.keys(settings.adjustments) as (keyof typeof settings.adjustments)[]) {
      renderEditorImage(canvas, image, {
        ...settings, adjustments: { ...settings.adjustments, [key]: 75 },
      });
      const adjusted = read();
      expect(adjusted, key).not.to.deep.equal(original);
      expect(adjusted.filter((_, index) => index % 4 === 3), key)
        .to.deep.equal(original.filter((_, index) => index % 4 === 3));
    }
  });

  it('halves each color channel at minimum exposure', async () => {
    const canvas = document.createElement('canvas');
    const settings = defaultEditorSettings();
    settings.adjustments.exposure = -100;
    renderEditorImage(canvas, await imageFixture(), settings);
    expect([...canvas.getContext('2d')!.getImageData(1, 1, 1, 1).data]).to.deep.equal([70, 50, 40, 255]);
  });

  it('leaves fully transparent pixels untouched by exposure and tint', async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 1;
    canvas.getContext('2d')!.fillRect(0, 0, 1, 1);
    const image = new Image();
    image.src = canvas.toDataURL();
    await image.decode();
    const settings = defaultEditorSettings();
    settings.adjustments.tint = 80;
    settings.adjustments.exposure = 90;
    renderEditorImage(canvas, image, settings);
    expect([...canvas.getContext('2d')!.getImageData(1, 0, 1, 1).data]).to.deep.equal([0, 0, 0, 0]);
  });

  it('rejects an undecoded image before resizing the destination', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 9;
    expect(() => renderEditorImage(canvas, new Image(), defaultEditorSettings())).to.throw('decoded dimensions');
    expect(canvas.width).to.equal(9);
  });

  it('positions a square crop and preserves alpha when adjusting colors', async () => {
    const image = await imageFixture();
    const canvas = document.createElement('canvas');
    const settings = defaultEditorSettings();
    settings.aspect = 1;
    settings.cropX = 100;
    settings.adjustments.saturation = -100;
    renderEditorImage(canvas, image, settings);
    const context = canvas.getContext('2d')!;
    expect([canvas.width, canvas.height]).to.deep.equal([2, 2]);
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data;
    expect(red).to.equal(green).and.to.equal(blue);
    expect(red).to.be.greaterThan(128);
    expect(alpha).to.equal(255);
    expect(context.getImageData(1, 1, 1, 1).data[3]).to.equal(128);
  });
});
