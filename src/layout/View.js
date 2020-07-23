// @flow

import type {Interaction} from '../useCanvasInteraction';
import type {Rect, Size, Point} from './geometry';

import {Surface} from './Surface';
import {
  rectIntersectsRect,
  rectEqualToRect,
  rectContainsPoint,
} from './geometry';

export class View {
  surface: Surface;
  frame: Rect;
  superview: ?View;

  needsDisplay = true;

  constructor(surface: Surface, frame: Rect) {
    this.surface = surface;
    this.frame = frame;
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

  displayIfNeeded(context: CanvasRenderingContext2D, rect: Rect) {
    if (this.needsDisplay && rectIntersectsRect(this.frame, rect)) {
      this.layoutSubviews();
      this.drawRect(context, rect);
      this.needsDisplay = false;
    }
  }

  drawRect(context: CanvasRenderingContext2D, rect: Rect) {}

  /**
   * Override to prevent hit testing of this view (and its subviews).
   */
  hitTest(point: Point): ?View {
    return rectContainsPoint(point, this.frame) ? this : null;
  }

  nextResponder(): ?View {
    return this.superview;
  }

  handleInteractionOrBubbleUp(interaction: Interaction) {
    if (this.handleInteraction(interaction)) {
      return;
    }

    const nextResponder = this.nextResponder();
    if (nextResponder) {
      nextResponder.handleInteractionOrBubbleUp(interaction);
    }
  }

  handleInteraction(interaction: Interaction): ?boolean {}
}
