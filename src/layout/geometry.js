// @flow

type MutablePoint = {x: number, y: number};
type MutableSize = {width: number, height: number};

export type Point = $ReadOnly<MutablePoint>;
export type Size = $ReadOnly<MutableSize>;
export type Rect = $ReadOnly<{origin: Point, size: Size}>;

export const zeroPoint: Point = Object.freeze({x: 0, y: 0});
export const zeroSize: Size = Object.freeze({width: 0, height: 0});
export const zeroRect: Rect = Object.freeze({
  origin: zeroPoint,
  size: zeroSize,
});

export function pointEqualToPoint(point1: Point, point2: Point): boolean {
  return point1.x === point2.x && point1.y === point2.y;
}

export function sizeEqualToSize(size1: Size, size2: Size): boolean {
  return size1.width === size2.width && size1.height === size2.height;
}

export function rectEqualToRect(rect1: Rect, rect2: Rect): boolean {
  return (
    pointEqualToPoint(rect1.origin, rect2.origin) &&
    sizeEqualToSize(rect1.size, rect2.size)
  );
}

export function rectIntersectsRect(rect1: Rect, rect2: Rect): boolean {
  const rect1Left = rect1.origin.x;
  const rect1Right = rect1.origin.x + rect1.size.width;
  const rect1Top = rect1.origin.y;
  const rect1Bottom = rect1.origin.y + rect1.size.height;

  const rect2Left = rect2.origin.x;
  const rect2Right = rect2.origin.x + rect2.size.width;
  const rect2Top = rect2.origin.y;
  const rect2Bottom = rect2.origin.y + rect2.size.height;

  return !(
    rect1Right < rect2Left ||
    rect2Right < rect1Left ||
    rect1Bottom < rect2Top ||
    rect2Bottom < rect1Top
  );
}

/**
 * Prerequisite: rect1 must intersect with rect2.
 */
export function rectIntersectionWithRect(rect1: Rect, rect2: Rect): Rect {
  const rect1Left = rect1.origin.x;
  const rect1Right = rect1.origin.x + rect1.size.width;
  const rect1Top = rect1.origin.y;
  const rect1Bottom = rect1.origin.y + rect1.size.height;

  const rect2Left = rect2.origin.x;
  const rect2Right = rect2.origin.x + rect2.size.width;
  const rect2Top = rect2.origin.y;
  const rect2Bottom = rect2.origin.y + rect2.size.height;

  const intersectLeft = Math.max(rect1Left, rect2Left);
  const intersectRight = Math.min(rect1Right, rect2Right);
  const intersectTop = Math.max(rect1Top, rect2Top);
  const intersectBottom = Math.min(rect1Bottom, rect2Bottom);

  return {
    origin: {
      x: intersectLeft,
      y: intersectTop,
    },
    size: {
      width: intersectRight - intersectLeft,
      height: intersectBottom - intersectTop,
    },
  };
}

export function rectContainsPoint(point: Point, rect: Rect): boolean {
  const rectLeft = rect.origin.x;
  const rectRight = rect.origin.x + rect.size.width;
  const rectTop = rect.origin.y;
  const rectBottom = rect.origin.y + rect.size.height;
  return !(
    rectRight < point.x ||
    point.x < rectLeft ||
    rectBottom < point.y ||
    point.y < rectTop
  );
}
