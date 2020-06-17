// @flow

import memoize from 'memoize-one';
import { INTERVAL_TIMES,MAX_INTERVAL_SIZE_PX } from './constants';

// hidpi canvas: https://www.html5rocks.com/en/tutorials/canvas/hidpi/
export function configureRetinaCanvas(
  canvas: HTMLCanvasElement,
  height: number,
  width: number
): number {
  const dpr: number = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  return dpr;
}

export const getCanvasContext = memoize(
  (
    canvas: HTMLCanvasElement,
    height: number,
    width: number,
    scaleCanvas: boolean = true
  ): CanvasRenderingContext2D => {
    const context = canvas.getContext('2d', { alpha: false });
    if (scaleCanvas) {
      const dpr = configureRetinaCanvas(canvas, height, width);
      // Scale all drawing operations by the dpr, so you don't have to worry about the difference.
      context.scale(dpr, dpr);
    }
    return context;
  }
);

export function getCanvasMousePos(
  canvas: HTMLCanvasElement,
  mouseEvent: MouseEvent
) {
  const rect =
    canvas instanceof HTMLCanvasElement
      ? canvas.getBoundingClientRect()
      : { left: 0, top: 0 };
  const canvasMouseX = mouseEvent.clientX - rect.left;
  const canvasMouseY = mouseEvent.clientY - rect.top;

  return { canvasMouseX, canvasMouseY };
}

// Time mark intervals vary based on the current zoom range and the time it represents.
// In Chrome, these seem to range from 70-140 pixels wide.
// Time wise, they represent intervals of e.g. 1s, 500ms, 200ms, 100ms, 50ms, 20ms.
// Based on zoom, we should determine which amount to actually show.
export function getTimeTickInterval(zoomLevel) {
  let interval = INTERVAL_TIMES[0];
  for (let i = 0; i < INTERVAL_TIMES.length; i++) {
    const currentInterval = INTERVAL_TIMES[i];
    const pixels = currentInterval * zoomLevel;
    if (pixels <= MAX_INTERVAL_SIZE_PX) {
      interval = currentInterval;
    }
  }
  return interval;
}

export const cachedFlamegraphTextWidths = new Map();
export const trimFlamegraphText = (context, text, width) => {
  for (let i = text.length - 1; i >= 0; i--) {
    const trimmedText = i === text.length - 1 ? text : text.substr(0, i) + '…';

    let measuredWidth = cachedFlamegraphTextWidths.get(trimmedText);
    if (measuredWidth == null) {
      measuredWidth = context.measureText(trimmedText).width;
      cachedFlamegraphTextWidths.set(trimmedText, measuredWidth);
    }

    if (measuredWidth <= width) {
      return trimmedText;
    }
  }

  return null;
};