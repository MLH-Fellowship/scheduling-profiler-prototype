// @flow

import type {Rect, Point} from './geometry';

import {Surface} from './Surface';
import {View} from './View';
import {rectIntersectsRect, rectIntersectionWithRect} from './geometry';

export type Layouter = (views: View[], containingFrame: Rect) => void;

export const layeredLayout: Layouter = (views, frame) =>
  views.forEach(subview => {
    subview.setFrame(frame);
  });

export const verticallyStackedLayout: Layouter = (views, frame) => {
  let currentY = 0;
  views.forEach(view => {
    const desiredSize = view.desiredSize();
    const height = desiredSize
      ? desiredSize.height
      : frame.size.height - currentY;
    const proposedFrame = {
      origin: {x: frame.origin.x, y: currentY},
      size: {width: frame.size.width, height},
    };
    view.setFrame(proposedFrame);
    currentY += height;
  });
};

export class StaticLayoutView extends View {
  subviews: View[] = [];
  layouter: Layouter;

  constructor(
    surface: Surface,
    frame: Rect,
    layouter: Layouter,
    subviews: View[],
  ) {
    super(surface, frame);
    this.layouter = layouter;
    subviews.forEach(subview => this.addSubview(subview));
  }

  addSubview(view: View) {
    this.subviews.push(view);
    view.superview = this;
  }

  layoutSubviews() {
    this.layouter(this.subviews, this.frame);
  }

  drawRect(context: CanvasRenderingContext2D, rect: Rect) {
    this.subviews.forEach(subview => {
      if (rectIntersectsRect(rect, subview.frame)) {
        subview.displayIfNeeded(
          context,
          rectIntersectionWithRect(rect, subview.frame),
        );
      }
    });
  }

  hitTest(point: Point): ?View {
    if (super.hitTest(point) !== this) {
      return;
    }
    // Views are painted first to last, so they should be hit tested last to
    // first (so that views in front are hit tested first).
    for (let i = this.subviews.length - 1; i >= 0; i--) {
      const hitTestView = this.subviews[i].hitTest(point);
      if (hitTestView) {
        return hitTestView;
      }
    }
  }
}
