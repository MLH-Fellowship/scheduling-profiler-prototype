// @flow

import type {Interaction, HoverInteraction} from '../../useCanvasInteraction';
import type {
  Flamechart,
  FlamechartStackFrame,
  FlamechartStackLayer,
} from '../../types';
import type {Rect, Size} from '../../layout';

import {
  ColorView,
  Surface,
  View,
  layeredLayout,
  rectContainsPoint,
  rectEqualToRect,
  rectIntersectionWithRect,
  rectIntersectsRect,
  verticallyStackedLayout,
} from '../../layout';
import {
  durationToWidth,
  positioningScaleFactor,
  timestampToPosition,
  trimFlamechartText,
} from '../canvasUtils';
import {
  COLORS,
  FLAMECHART_FONT_SIZE,
  FLAMECHART_FRAME_HEIGHT,
  FLAMECHART_TEXT_PADDING,
  COLOR_HOVER_DIM_DELTA,
  REACT_WORK_BORDER_SIZE,
} from '../constants';
import {ColorGenerator, dimmedColor, hslaColorToString} from '../colors';

// Source: https://source.chromium.org/chromium/chromium/src/+/master:out/Debug/gen/devtools/timeline/TimelineUIUtils.js;l=2109;drc=fb32e928d79707a693351b806b8710b2f6b7d399
const colorGenerator = new ColorGenerator(
  {min: 30, max: 330},
  {min: 50, max: 80, count: 3},
  85,
);
colorGenerator.setColorForID('', {h: 43.6, s: 45.8, l: 90.6, a: 100});

function defaultHslaColorForStackFrame({scriptUrl}: FlamechartStackFrame) {
  return colorGenerator.colorForID(scriptUrl || '');
}

function defaultColorForStackFrame(stackFrame: FlamechartStackFrame): string {
  const color = defaultHslaColorForStackFrame(stackFrame);
  return hslaColorToString(color);
}

function hoverColorForStackFrame(stackFrame: FlamechartStackFrame): string {
  const color = dimmedColor(
    defaultHslaColorForStackFrame(stackFrame),
    COLOR_HOVER_DIM_DELTA,
  );
  return hslaColorToString(color);
}

class FlamechartStackLayerView extends View {
  /** Layer to display */
  _stackLayer: FlamechartStackLayer;

  /** A set of `stackLayer`'s frames, for efficient lookup. */
  _stackFrameSet: Set<FlamechartStackFrame>;

  _intrinsicSize: Size;

  _hoveredStackFrame: FlamechartStackFrame | null = null;
  _onHover: ((node: FlamechartStackFrame | null) => void) | null = null;

  constructor(
    surface: Surface,
    frame: Rect,
    stackLayer: FlamechartStackLayer,
    duration: number,
  ) {
    super(surface, frame);
    this._stackLayer = stackLayer;
    this._stackFrameSet = new Set(stackLayer);
    this._intrinsicSize = {
      width: duration,
      height: FLAMECHART_FRAME_HEIGHT,
    };
  }

  desiredSize() {
    return this._intrinsicSize;
  }

  setHoveredFlamechartStackFrame(
    hoveredStackFrame: FlamechartStackFrame | null,
  ) {
    if (this._hoveredStackFrame === hoveredStackFrame) {
      return; // We're already hovering over this frame
    }

    // Only care about frames displayed by this view.
    const stackFrameToSet =
      hoveredStackFrame && this._stackFrameSet.has(hoveredStackFrame)
        ? hoveredStackFrame
        : null;
    if (this._hoveredStackFrame === stackFrameToSet) {
      return; // Resulting state is unchanged
    }
    this._hoveredStackFrame = stackFrameToSet;
    this.setNeedsDisplay();
  }

  draw(context: CanvasRenderingContext2D) {
    const {
      frame,
      _stackLayer,
      _hoveredStackFrame,
      _intrinsicSize,
      visibleArea,
    } = this;

    context.fillStyle = COLORS.BACKGROUND;
    context.fillRect(
      visibleArea.origin.x,
      visibleArea.origin.y,
      visibleArea.size.width,
      visibleArea.size.height,
    );

    context.textAlign = 'left';
    context.textBaseline = 'middle';
    context.font = `${FLAMECHART_FONT_SIZE}px sans-serif`;

    const scaleFactor = positioningScaleFactor(_intrinsicSize.width, frame);

    for (let i = 0; i < _stackLayer.length; i++) {
      const stackFrame = _stackLayer[i];
      const {name, timestamp, duration} = stackFrame;

      const width = durationToWidth(duration, scaleFactor);
      if (width < 1) {
        continue; // Too small to render at this zoom level
      }

      const x = Math.floor(timestampToPosition(timestamp, scaleFactor, frame));
      const nodeRect: Rect = {
        origin: {x, y: frame.origin.y},
        size: {
          width: Math.floor(width - REACT_WORK_BORDER_SIZE),
          height: Math.floor(FLAMECHART_FRAME_HEIGHT - REACT_WORK_BORDER_SIZE),
        },
      };
      if (!rectIntersectsRect(nodeRect, visibleArea)) {
        continue; // Not in view
      }

      const showHoverHighlight = _hoveredStackFrame === _stackLayer[i];
      context.fillStyle = showHoverHighlight
        ? hoverColorForStackFrame(stackFrame)
        : defaultColorForStackFrame(stackFrame);

      const drawableRect = rectIntersectionWithRect(nodeRect, visibleArea);
      context.fillRect(
        drawableRect.origin.x,
        drawableRect.origin.y,
        drawableRect.size.width,
        drawableRect.size.height,
      );

      if (width > FLAMECHART_TEXT_PADDING * 2) {
        const trimmedName = trimFlamechartText(
          context,
          name,
          width - FLAMECHART_TEXT_PADDING * 2 + (x < 0 ? x : 0),
        );

        if (trimmedName !== null) {
          context.fillStyle = COLORS.PRIORITY_LABEL;

          // Prevent text from being drawn outside `viewableArea`
          const textOverflowsViewableArea = !rectEqualToRect(
            drawableRect,
            nodeRect,
          );
          if (textOverflowsViewableArea) {
            context.save();
            context.rect(
              drawableRect.origin.x,
              drawableRect.origin.y,
              drawableRect.size.width,
              drawableRect.size.height,
            );
            context.clip();
          }

          context.fillText(
            trimmedName,
            nodeRect.origin.x + FLAMECHART_TEXT_PADDING - (x < 0 ? x : 0),
            nodeRect.origin.y + FLAMECHART_FRAME_HEIGHT / 2,
          );

          if (textOverflowsViewableArea) {
            context.restore();
          }
        }
      }
    }
  }

  /**
   * @private
   */
  _handleHover(interaction: HoverInteraction) {
    const {_stackLayer, frame, _intrinsicSize, _onHover, visibleArea} = this;
    const {location} = interaction.payload;
    if (!_onHover || !rectContainsPoint(location, visibleArea)) {
      return;
    }

    // Find the node being hovered over.
    const scaleFactor = positioningScaleFactor(_intrinsicSize.width, frame);
    let startIndex = 0;
    let stopIndex = _stackLayer.length - 1;
    while (startIndex <= stopIndex) {
      const currentIndex = Math.floor((startIndex + stopIndex) / 2);
      const flamechartStackFrame = _stackLayer[currentIndex];
      const {timestamp, duration} = flamechartStackFrame;

      const width = durationToWidth(duration, scaleFactor);
      const x = Math.floor(timestampToPosition(timestamp, scaleFactor, frame));
      if (x <= location.x && x + width >= location.x) {
        _onHover(flamechartStackFrame);
        return;
      }

      if (x > location.x) {
        stopIndex = currentIndex - 1;
      } else {
        startIndex = currentIndex + 1;
      }
    }

    _onHover(null);
  }

  handleInteraction(interaction: Interaction) {
    switch (interaction.type) {
      case 'hover':
        this._handleHover(interaction);
        break;
    }
  }
}

export class FlamechartView extends View {
  _flamechartRowViews: FlamechartStackLayerView[] = [];

  /** Container view that vertically stacks flamechart rows */
  _verticalStackView: View;

  _hoveredStackFrame: FlamechartStackFrame | null = null;
  _onHover: ((node: FlamechartStackFrame | null) => void) | null = null;

  constructor(
    surface: Surface,
    frame: Rect,
    flamechart: Flamechart,
    duration: number,
  ) {
    super(surface, frame, layeredLayout);
    this.setDataAndUpdateSubviews(flamechart, duration);
  }

  setDataAndUpdateSubviews(flamechart: Flamechart, duration: number) {
    const {surface, frame, _onHover, _hoveredStackFrame} = this;

    // Clear existing rows on data update
    if (this._verticalStackView) {
      this.removeAllSubviews();
      this._flamechartRowViews = [];
    }

    this._verticalStackView = new View(surface, frame, verticallyStackedLayout);
    this._flamechartRowViews = flamechart.map(stackLayer => {
      const rowView = new FlamechartStackLayerView(
        surface,
        frame,
        stackLayer,
        duration,
      );
      this._verticalStackView.addSubview(rowView);

      // Update states
      rowView._onHover = _onHover;
      rowView.setHoveredFlamechartStackFrame(_hoveredStackFrame);
      return rowView;
    });

    // Add a plain background view to prevent gaps from appearing between
    // flamechartRowViews.
    const colorView = new ColorView(surface, frame, COLORS.BACKGROUND);
    this.addSubview(colorView);
    this.addSubview(this._verticalStackView);
  }

  setHoveredFlamechartStackFrame(
    hoveredStackFrame: FlamechartStackFrame | null,
  ) {
    this._hoveredStackFrame = hoveredStackFrame;
    this._flamechartRowViews.forEach(rowView =>
      rowView.setHoveredFlamechartStackFrame(hoveredStackFrame),
    );
  }

  setOnHover(onHover: (node: FlamechartStackFrame | null) => void) {
    this._onHover = onHover;
    this._flamechartRowViews.forEach(rowView => (rowView._onHover = onHover));
  }

  desiredSize() {
    // Ignore the wishes of the background color view
    return this._verticalStackView.desiredSize();
  }

  /**
   * @private
   */
  _handleHover(interaction: HoverInteraction) {
    const {_onHover, visibleArea} = this;
    if (!_onHover) {
      return;
    }

    const {location} = interaction.payload;
    if (!rectContainsPoint(location, visibleArea)) {
      // Clear out any hovered flamechart stack frame
      _onHover(null);
    }
  }

  handleInteraction(interaction: Interaction) {
    switch (interaction.type) {
      case 'hover':
        this._handleHover(interaction);
        break;
    }
  }
}
