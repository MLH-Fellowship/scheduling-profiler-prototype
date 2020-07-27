// @flow

import type {
  Interaction,
  VerticalPanStartInteraction,
  VerticalPanMoveInteraction,
  VerticalPanEndInteraction,
} from '../useCanvasInteraction';
import type {Rect} from './geometry';

import {Surface} from './Surface';
import {View} from './View';
import {rectContainsPoint} from './geometry';

type VerticalScrollState = {|
  offsetY: number,
|};

// TODO: Deduplicate
function clamp(min: number, max: number, value: number): number {
  if (Number.isNaN(min) || Number.isNaN(max) || Number.isNaN(value)) {
    throw new Error(
      `Clamp was called with NaN. Args: min: ${min}, max: ${max}, value: ${value}.`,
    );
  }
  return Math.min(max, Math.max(min, value));
}

export class VerticalScrollView extends View {
  contentView: View;
  intrinsicContentHeight: number;

  scrollState: VerticalScrollState = {
    offsetY: 0,
  };

  stateDeriver: (state: VerticalScrollState) => VerticalScrollState = state =>
    state;

  onStateChange: (state: VerticalScrollState) => void = () => {};

  constructor(
    surface: Surface,
    frame: Rect,
    contentView: View,
    intrinsicContentHeight: number,
    stateDeriver?: (state: VerticalScrollState) => VerticalScrollState,
    onStateChange?: (state: VerticalScrollState) => void,
  ) {
    super(surface, frame);
    this.contentView = contentView;
    contentView.superview = this;
    this.intrinsicContentHeight = intrinsicContentHeight;
    if (stateDeriver) this.stateDeriver = stateDeriver;
    if (onStateChange) this.onStateChange = onStateChange;
  }

  setFrame(frame: Rect) {
    super.setFrame(frame);
  }

  layoutSubviews() {
    const {offsetY} = this.scrollState;
    const proposedFrame = {
      origin: {
        x: this.frame.origin.x,
        y: this.frame.origin.y + offsetY,
      },
      size: {
        width: this.frame.size.width,
        height: this.intrinsicContentHeight,
      },
    };
    this.contentView.setFrame(proposedFrame);
    this.contentView.setVisibleArea(this.visibleArea);
  }

  draw(context: CanvasRenderingContext2D) {
    this.contentView.displayIfNeeded(context);
  }

  isPanning = false;

  handleVerticalPanStart(interaction: VerticalPanStartInteraction) {
    if (rectContainsPoint(interaction.payload.location, this.frame)) {
      this.isPanning = true;
    }
  }

  handleVerticalPanMove(interaction: VerticalPanMoveInteraction) {
    if (!this.isPanning) {
      return;
    }
    const {offsetY} = this.scrollState;
    const {movementY} = interaction.payload.event;
    const proposedNewState = this.clampedProposedState({
      ...this.scrollState,
      offsetY: offsetY + movementY,
    });
    this.scrollState = this.stateDeriver(proposedNewState);
    this.onStateChange(this.scrollState);
    this.setNeedsDisplay();
  }

  handleVerticalPanEnd(interaction: VerticalPanEndInteraction) {
    if (this.isPanning) {
      this.isPanning = false;
    }
  }

  // handleVerticalScroll(interaction) {
  //   // TODO: Scroll
  //   this.contentView.handleInteractionAndPropagateToSubviews(interaction);
  // }

  handleInteractionAndPropagateToSubviews(interaction: Interaction) {
    switch (interaction.type) {
      case 'vertical-pan-start':
        this.handleVerticalPanStart(interaction);
        break;
      case 'vertical-pan-move':
        this.handleVerticalPanMove(interaction);
        break;
      case 'vertical-pan-end':
        this.handleVerticalPanEnd(interaction);
        break;
    }
    this.contentView.handleInteractionAndPropagateToSubviews(interaction);
  }

  /**
   * @private
   */
  clampedProposedState(
    proposedState: VerticalScrollState,
  ): VerticalScrollState {
    return {
      offsetY: clamp(
        -(this.contentView.frame.size.height - this.frame.size.height),
        0,
        proposedState.offsetY,
      ),
    };
  }
}
