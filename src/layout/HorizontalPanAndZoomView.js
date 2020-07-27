// @flow

import type {
  Interaction,
  HorizontalPanStartInteraction,
  HorizontalPanMoveInteraction,
  HorizontalPanEndInteraction,
} from '../useCanvasInteraction';
import type {Rect, Point} from './geometry';

import {Surface} from './Surface';
import {View} from './View';
import {rectContainsPoint} from './geometry';
import {MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL} from '../canvas/constants'; // TODO: Remove external dependency

type HorizontalPanAndZoomState = {
  /** Horizontal offset; positive in the left direction */
  offsetX: number,
  zoomLevel: number,
};

function clamp(min: number, max: number, value: number): number {
  if (Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(value)) {
    throw new Error(
      `Clamp was called with NaN. Args: min: ${min}, max: ${max}, value: ${value}.`,
    );
  }
  return Math.max(min, Math.min(max, value));
}

export class HorizontalPanAndZoomView extends View {
  contentView: View;
  intrinsicContentWidth: number;

  panAndZoomState: HorizontalPanAndZoomState = {
    offsetX: 0,
    zoomLevel: 0.25,
  };

  stateDeriver: (
    state: HorizontalPanAndZoomState,
  ) => HorizontalPanAndZoomState = state => state;

  onStateChange: (state: HorizontalPanAndZoomState) => void = () => {};

  constructor(
    surface: Surface,
    frame: Rect,
    contentView: View,
    intrinsicContentWidth: number,
    stateDeriver?: (
      state: HorizontalPanAndZoomState,
    ) => HorizontalPanAndZoomState,
    onStateChange?: (state: HorizontalPanAndZoomState) => void,
  ) {
    super(surface, frame);
    this.contentView = contentView;
    contentView.superview = this;
    this.intrinsicContentWidth = intrinsicContentWidth;
    if (stateDeriver) this.stateDeriver = stateDeriver;
    if (onStateChange) this.onStateChange = onStateChange;
  }

  layoutSubviews() {
    const {offsetX, zoomLevel} = this.panAndZoomState;
    const proposedFrame = {
      origin: {
        x: this.frame.origin.x + offsetX,
        y: this.frame.origin.y,
      },
      size: {
        width: this.intrinsicContentWidth * zoomLevel,
        height: this.contentView.frame.size.height,
      },
    };
    this.contentView.setFrame(proposedFrame);
  }

  drawRect(context: CanvasRenderingContext2D, rect: Rect) {
    this.contentView.displayIfNeeded(context, rect);
  }

  hitTest(point: Point): ?View {
    if (super.hitTest(point) !== this) {
      return;
    }
    return this.contentView.hitTest(point);
  }

  isPanning = false;

  handleHorizontalPanStart(interaction: HorizontalPanStartInteraction) {
    const {x, y} = interaction.payload.event;
    const mousePosition = {x, y};
    if (rectContainsPoint(mousePosition, this.frame)) {
      this.isPanning = true;
      return true;
    }
  }

  handleHorizontalPanMove(interaction: HorizontalPanMoveInteraction) {
    if (!this.isPanning) {
      return;
    }
    const {offsetX} = this.panAndZoomState;
    const {movementX} = interaction.payload.event;
    const proposedNewState = this.clampedProposedState({
      ...this.panAndZoomState,
      offsetX: offsetX + movementX,
    });
    this.panAndZoomState = this.stateDeriver(proposedNewState);
    this.onStateChange(this.panAndZoomState);
    this.setNeedsDisplay();
    return true;
  }

  handleHorizontalPanEnd(interaction: HorizontalPanEndInteraction) {
    if (this.isPanning) {
      this.isPanning = false;
      return true;
    }
  }

  // handleHorizontalScroll(interaction) {
  //   // TODO: Scroll
  //   this.contentView.handleInteraction(interaction);
  // }
  handleInteraction(interaction: Interaction) {
    switch (interaction.type) {
      case 'horizontal-pan-start':
        return this.handleHorizontalPanStart(interaction);
      case 'horizontal-pan-move':
        return this.handleHorizontalPanMove(interaction);
      case 'horizontal-pan-end':
        return this.handleHorizontalPanEnd(interaction);
    }
  }

  /**
   * @private
   */
  clampedProposedState(
    proposedState: HorizontalPanAndZoomState,
  ): HorizontalPanAndZoomState {
    return {
      offsetX: clamp(
        -(this.contentView.frame.size.width - this.frame.size.width),
        0,
        proposedState.offsetX,
      ),
      zoomLevel: clamp(MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL, proposedState.zoomLevel),
    };
  }
}
