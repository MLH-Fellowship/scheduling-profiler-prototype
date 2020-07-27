// @flow

import type {
  Interaction,
  HorizontalPanStartInteraction,
  HorizontalPanMoveInteraction,
  HorizontalPanEndInteraction,
  WheelPlainInteraction,
  WheelWithShiftInteraction,
  WheelWithControlInteraction,
  WheelWithMetaInteraction,
} from '../useCanvasInteraction';
import type {Rect} from './geometry';

import {Surface} from './Surface';
import {View} from './View';
import {rectContainsPoint} from './geometry';
import {
  MIN_ZOOM_LEVEL,
  MAX_ZOOM_LEVEL,
  MOVE_WHEEL_DELTA_THRESHOLD,
} from '../canvas/constants'; // TODO: Remove external dependency

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
  return Math.min(max, Math.max(min, value));
}

function zoomLevelAndIntrinsicWidthToFrameWidth(
  zoomLevel: number,
  intrinsicWidth: number,
): number {
  return intrinsicWidth * zoomLevel;
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
        width: zoomLevelAndIntrinsicWidthToFrameWidth(
          zoomLevel,
          this.intrinsicContentWidth,
        ),
        height: this.frame.size.height,
      },
    };
    this.contentView.setFrame(proposedFrame);
    this.contentView.setVisibleArea(this.visibleArea);
  }

  draw(context: CanvasRenderingContext2D) {
    this.contentView.displayIfNeeded(context);
  }

  isPanning = false;

  handleHorizontalPanStart(interaction: HorizontalPanStartInteraction) {
    if (rectContainsPoint(interaction.payload.location, this.frame)) {
      this.isPanning = true;
    }
  }

  handleHorizontalPanMove(interaction: HorizontalPanMoveInteraction) {
    if (!this.isPanning) {
      return;
    }
    const {offsetX} = this.panAndZoomState;
    const {movementX} = interaction.payload.event;
    this.updateState({
      ...this.panAndZoomState,
      offsetX: offsetX + movementX,
    });
  }

  handleHorizontalPanEnd(interaction: HorizontalPanEndInteraction) {
    if (this.isPanning) {
      this.isPanning = false;
    }
  }

  handleWheelPlain(interaction: WheelPlainInteraction) {
    const {
      location,
      event: {deltaX, deltaY},
    } = interaction.payload;
    if (!rectContainsPoint(location, this.frame)) {
      return; // Not scrolling on view
    }

    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    if (absDeltaY > absDeltaX) {
      return; // Scrolling vertically
    }

    if (absDeltaX < MOVE_WHEEL_DELTA_THRESHOLD) {
      return;
    }

    this.updateState({
      ...this.panAndZoomState,
      offsetX: this.panAndZoomState.offsetX - deltaX,
    });
  }

  handleWheelZoom(
    interaction:
      | WheelWithShiftInteraction
      | WheelWithControlInteraction
      | WheelWithMetaInteraction,
  ) {
    const {
      location,
      event: {deltaY},
    } = interaction.payload;
    if (!rectContainsPoint(location, this.frame)) {
      return; // Not scrolling on view
    }

    const absDeltaY = Math.abs(deltaY);
    if (absDeltaY < MOVE_WHEEL_DELTA_THRESHOLD) {
      return;
    }

    const clampedState = this.clampedProposedState({
      ...this.panAndZoomState,
      zoomLevel: this.panAndZoomState.zoomLevel * (1 + 0.005 * -deltaY),
    });

    // Determine where the mouse is, and adjust the offset so that point stays
    // centered after zooming.
    const oldMouseXInFrame =
      this.visibleArea.origin.x - this.contentView.frame.origin.x + location.x;
    const fractionalMouseX =
      oldMouseXInFrame / this.contentView.frame.size.width;

    const newContentWidth = zoomLevelAndIntrinsicWidthToFrameWidth(
      clampedState.zoomLevel,
      this.intrinsicContentWidth,
    );
    const newMouseXInFrame = fractionalMouseX * newContentWidth;

    const adjustedState = this.clampedProposedState(
      {
        ...clampedState,
        offsetX: -(newMouseXInFrame - location.x),
      },
      newContentWidth,
    );

    this.panAndZoomState = this.stateDeriver(adjustedState);
    this.onStateChange(this.panAndZoomState);
    this.setNeedsDisplay();
  }

  handleInteractionAndPropagateToSubviews(interaction: Interaction) {
    switch (interaction.type) {
      case 'horizontal-pan-start':
        this.handleHorizontalPanStart(interaction);
        break;
      case 'horizontal-pan-move':
        this.handleHorizontalPanMove(interaction);
        break;
      case 'horizontal-pan-end':
        this.handleHorizontalPanEnd(interaction);
        break;
      case 'wheel-plain':
        this.handleWheelPlain(interaction);
        break;
      case 'wheel-shift':
      case 'wheel-control':
      case 'wheel-meta':
        this.handleWheelZoom(interaction);
        break;
    }
    this.contentView.handleInteractionAndPropagateToSubviews(interaction);
  }

  /**
   * @private
   */
  updateState(proposedState: HorizontalPanAndZoomState) {
    const clampedState = this.clampedProposedState(proposedState);
    this.panAndZoomState = this.stateDeriver(clampedState);
    this.onStateChange(this.panAndZoomState);
    this.setNeedsDisplay();
  }

  /**
   * @private
   */
  clampedProposedState(
    proposedState: HorizontalPanAndZoomState,
    knownContentViewWidth: number = this.contentView.frame.size.width,
  ): HorizontalPanAndZoomState {
    return {
      offsetX: clamp(
        -(knownContentViewWidth - this.frame.size.width),
        0,
        proposedState.offsetX,
      ),
      zoomLevel: clamp(MIN_ZOOM_LEVEL, MAX_ZOOM_LEVEL, proposedState.zoomLevel),
    };
  }
}
