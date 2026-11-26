import { clamp, finiteInteger, finiteRange } from '../../../internal/numbers.js';

export interface EditorSettings {
  adjustments: {
    exposure: number;
    contrast: number;
    highlights: number;
    shadows: number;
    saturation: number;
    vibrance: number;
    warmth: number;
    tint: number;
    vignette: number;
  };
  aspect: number;
  cropScale: number;
  cropX: number;
  cropY: number;
  turns: number;
  flipX: boolean;
  flipY: boolean;
}

export function defaultEditorSettings(): EditorSettings {
  return {
    adjustments: {
      exposure: 0,
      contrast: 0,
      highlights: 0,
      shadows: 0,
      saturation: 0,
      vibrance: 0,
      warmth: 0,
      tint: 0,
      vignette: 0,
    },
    aspect: 0,
    cropScale: 100,
    cropX: 50,
    cropY: 50,
    turns: 0,
    flipX: false,
    flipY: false,
  };
}

export function editorImageGeometry(
  sourceWidth: number,
  sourceHeight: number,
  settings: EditorSettings,
  maxEdge?: number,
) {
  const turns = (finiteInteger(settings.turns, 0) % 4 + 4) % 4;
  const swapAxes = turns % 2 === 1;
  const orientedWidth = swapAxes ? sourceHeight : sourceWidth;
  const orientedHeight = swapAxes ? sourceWidth : sourceHeight;
  const originalAspect = orientedWidth / orientedHeight;
  const requestedAspect = finiteRange(settings.aspect, 0, 0);
  // Clamp to aspect ratios that can retain at least one source pixel on both axes.
  const aspect = clamp(requestedAspect || originalAspect, 1 / orientedHeight, orientedWidth);
  const baseWidth = Math.min(orientedWidth, orientedHeight * aspect);
  const baseHeight = Math.min(orientedHeight, orientedWidth / aspect);
  const minimumScale = 1 / Math.min(baseWidth, baseHeight);
  const scale = Math.min(1, Math.max(minimumScale, finiteRange(settings.cropScale, 100, 1, 100) / 100));
  const cropWidth = baseWidth * scale;
  const cropHeight = baseHeight * scale;
  const cropLeft = (orientedWidth - cropWidth) * finiteRange(settings.cropX, 50, 0, 100) / 100;
  const cropTop = (orientedHeight - cropHeight) * finiteRange(settings.cropY, 50, 0, 100) / 100;
  const longestEdge = Math.max(cropWidth, cropHeight);
  const edgeLimit = finiteInteger(maxEdge ?? Math.ceil(longestEdge), Math.ceil(longestEdge), 1);
  const outputScale = Math.min(1, edgeLimit / longestEdge);

  return {
    turns,
    orientedWidth,
    orientedHeight,
    cropLeft,
    cropTop,
    cropWidth,
    cropHeight,
    width: Math.max(1, Math.round(cropWidth * outputScale)),
    height: Math.max(1, Math.round(cropHeight * outputScale)),
  };
}

const quarterTurns = [
  [1, 0, 0, 1],
  [0, 1, -1, 0],
  [-1, 0, 0, -1],
  [0, -1, 1, 0],
] as const;

export function renderEditorImage(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  settings: EditorSettings,
  maxEdge?: number,
): void {
  const sourceWidth = image.naturalWidth;
  const sourceHeight = image.naturalHeight;
  if (sourceWidth === 0 || sourceHeight === 0) throw new Error('Image has no decoded dimensions');

  const geometry = editorImageGeometry(sourceWidth, sourceHeight, settings, maxEdge);
  canvas.width = geometry.width;
  canvas.height = geometry.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image canvas is unavailable');

  const scaleX = geometry.width / geometry.cropWidth;
  const scaleY = geometry.height / geometry.cropHeight;
  context.setTransform(scaleX, 0, 0, scaleY, -geometry.cropLeft * scaleX, -geometry.cropTop * scaleY);
  context.translate(geometry.orientedWidth / 2, geometry.orientedHeight / 2);
  context.scale(settings.flipX ? -1 : 1, settings.flipY ? -1 : 1);
  const [a, b, c, d] = quarterTurns[geometry.turns]!;
  context.transform(a, b, c, d, 0, 0);
  context.drawImage(image, -sourceWidth / 2, -sourceHeight / 2);
  context.resetTransform();

  applyAdjustments(context, geometry.width, geometry.height, settings.adjustments);
}

function applyAdjustments(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  adjustments: EditorSettings['adjustments'],
): void {
  const exposure = finiteRange(adjustments.exposure, 0, -100, 100) / 100;
  const contrast = finiteRange(adjustments.contrast, 0, -100, 100) / 100;
  const highlights = finiteRange(adjustments.highlights, 0, -100, 100) / 100;
  const shadows = finiteRange(adjustments.shadows, 0, -100, 100) / 100;
  const saturation = finiteRange(adjustments.saturation, 0, -100, 100) / 100;
  const vibrance = finiteRange(adjustments.vibrance, 0, -100, 100) / 100;
  const warmth = finiteRange(adjustments.warmth, 0, -100, 100) / 100;
  const tint = finiteRange(adjustments.tint, 0, -100, 100) / 100;
  const vignette = finiteRange(adjustments.vignette, 0, 0, 100) / 100;
  if (!(exposure || contrast || highlights || shadows || saturation || vibrance || warmth || tint || vignette)) {
    return;
  }

  const frame = context.getImageData(0, 0, width, height);
  const { data } = frame;
  const exposureGain = 2 ** exposure;
  const contrastGain = 2 ** contrast;
  for (let y = 0; y < height; y++) {
    const verticalDistance = (2 * (y + 0.5) / height - 1) ** 2;
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      if (data[index + 3] === 0) continue;
      const red = data[index]! / 255;
      const green = data[index + 1]! / 255;
      const blue = data[index + 2]! / 255;
      const luma = red * 0.2126 + green * 0.7152 + blue * 0.0722;
      const highlightWeight = luma ** 2;
      const shadowWeight = (1 - luma) ** 2;
      const light = (luma * exposureGain - 0.5) * contrastGain + 0.5
        + 0.3 * (highlights * highlightWeight + shadows * shadowWeight);
      const chroma = Math.max(red, green, blue) - Math.min(red, green, blue);
      const colorGain = exposureGain * contrastGain * (1 + saturation) * (1 + vibrance * (1 - chroma));
      const radialDistance = ((2 * (x + 0.5) / width - 1) ** 2 + verticalDistance) / 2;
      const vignetteGain = 1 - 0.85 * vignette * radialDistance ** 2;

      data[index] = 255 * vignetteGain * (light + (red - luma) * colorGain + 0.16 * warmth + 0.06 * tint);
      data[index + 1] = 255 * vignetteGain * (light + (green - luma) * colorGain - 0.12 * tint);
      data[index + 2] = 255 * vignetteGain * (light + (blue - luma) * colorGain - 0.16 * warmth + 0.06 * tint);
    }
  }
  context.putImageData(frame, 0, 0);
}
