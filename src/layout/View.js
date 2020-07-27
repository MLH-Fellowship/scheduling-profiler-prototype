// @flow

import type {Interaction} from '../useCanvasInteraction';
import type {Rect, Size, Point} from './geometry';

import {Surface} from './Surface';
import {
  rectIntersectsRect,
  rectEqualToRect,
  rectContainsPoint,
  sizeIsEmpty,
  sizeIsValid,
  zeroRect,
} from './geometry';

export class View {
  surface: Surface;

  frame: Rect;
  visibleArea: Rect;

  superview: ?View;

  needsDisplay = true;

  constructor(surface: Surface, frame: Rect, visibleArea: Rect = frame) {
    this.surface = surface;
    this.frame = frame;
    this.visibleArea = visibleArea;
  }

  /**
   * Invalidates view's contents.
   */
  setNeedsDisplay() {
    this.needsDisplay = true;
    if (this.superview) {
      this.superview.setNeedsDisplay();
    }
  }

  setFrame(newFrame: Rect) {
    if (!rectEqualToRect(this.frame, newFrame)) {
      this.frame = newFrame;
      if (sizeIsValid(newFrame.size)) {
        this.frame = newFrame;
      } else {
        this.frame = zeroRect;
      }
      this.setNeedsDisplay();
    }
  }

  setVisibleArea(newVisibleArea: Rect) {
    if (!rectEqualToRect(this.visibleArea, newVisibleArea)) {
      if (sizeIsValid(newVisibleArea.size)) {
        this.visibleArea = newVisibleArea;
      } else {
        this.visibleArea = zeroRect;
      }
      this.setNeedsDisplay();
    }
  }

  desiredSize(): ?Size {}

  /**
   * Layout self and subviews.
   *
   * Call `setNeedsDisplay` if we are to redraw.
   *
   * To be overwritten by subclasses.
   */
  layoutSubviews() {}

  displayIfNeeded(context: CanvasRenderingContext2D) {
    if (
      this.needsDisplay &&
      rectIntersectsRect(this.frame, this.visibleArea) &&
      !sizeIsEmpty(this.visibleArea.size)
    ) {
      this.layoutSubviews();
      this.draw(context);
      this.needsDisplay = false;
    }
  }

  draw(context: CanvasRenderingContext2D) {}

  handleInteractionAndPropagateToSubviews(interaction: Interaction): ?boolean {}
}
